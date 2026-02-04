import pptxgen from 'pptxgenjs';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';

GlobalWorkerOptions.workerSrc = workerSrc;

const POINTS_PER_INCH = 72;
const DEFAULT_RENDER_SCALE = 2;
const DEFAULT_JPEG_QUALITY = 0.82;
const CMAP_URL = new URL('/pdfjs/cmaps/', self.location.origin).href;
const STANDARD_FONT_URL = new URL('/pdfjs/standard_fonts/', self.location.origin).href;
let cancelled = false;

self.onmessage = async (event) => {
  const { type, payload } = event.data || {};

  if (type === 'CANCEL') {
    cancelled = true;
    postLog('已收到中止要求。');
    return;
  }

  if (type === 'START') {
    cancelled = false;
    await handleStart(payload);
  }
};

async function handleStart(payload) {
  try {
    const { buffer, fileName } = payload;
    const renderScale = normalizeScale(payload?.scale);
    const imageFormat = normalizeFormat(payload?.imageFormat);
    const jpegQuality = normalizeJpegQuality(payload?.jpegQuality);

    postStatus('載入 PDF', 5);
    postLog('啟動瀏覽器端轉換流程（影像模式）。');

    const pdf = await loadPdf(buffer);

    if (cancelled) return postCancelled();

    const total = pdf.numPages;
    const pptx = new pptxgen();
    const layoutName = 'PDF_LAYOUT';
    let slideWidthPt = null;
    let slideHeightPt = null;

    for (let index = 1; index <= total; index += 1) {
      if (cancelled) return postCancelled();

      postStatus(`渲染第 ${index} / ${total} 頁`, 10 + Math.round((index / total) * 70));
      postLog(`渲染第 ${index} 頁影像。`);

      const page = await pdf.getPage(index);
      const viewport = page.getViewport({ scale: 1 });

      if (index === 1) {
        slideWidthPt = viewport.width;
        slideHeightPt = viewport.height;
        pptx.defineLayout({
          name: layoutName,
          width: toInches(slideWidthPt),
          height: toInches(slideHeightPt)
        });
        pptx.layout = layoutName;
        postLog(`投影片尺寸：${slideWidthPt.toFixed(1)}x${slideHeightPt.toFixed(1)} points`);
      }

      let imageData = null;
      try {
        imageData = await renderPageImage(page, renderScale, imageFormat, jpegQuality);
      } finally {
        page.cleanup();
      }

      if (cancelled) return postCancelled();

      const slide = pptx.addSlide();
      const frame = fitImageToSlide(viewport.width, viewport.height, slideWidthPt, slideHeightPt);
      slide.addImage({
        data: imageData,
        x: toInches(frame.x),
        y: toInches(frame.y),
        w: toInches(frame.w),
        h: toInches(frame.h)
      });
      imageData = null;
    }

    if (cancelled) return postCancelled();

    postStatus('輸出 PPTX', 90);
    postLog('建立 PPTX 投影片。');

    const base64 = await pptx.write({ outputType: 'base64' });
    const bytes = base64ToBytes(base64);
    postLog(`PPTX 產生完成（${formatBytes(bytes.length)}）。`);
    postStatus('完成輸出', 95);

    const outputName = toPptxName(fileName);
    self.postMessage(
      {
        type: 'RESULT',
        payload: {
          buffer: bytes.buffer,
          fileName: outputName
        }
      },
      [bytes.buffer]
    );
  } catch (err) {
    postError(err);
  }
}

async function renderPageImage(page, scale, imageFormat, jpegQuality) {
  if (!self.OffscreenCanvas) {
    throw new Error('此環境不支援 OffscreenCanvas，無法渲染 PDF 頁面影像。');
  }

  const viewport = page.getViewport({ scale });
  const canvas = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    throw new Error('無法取得 Canvas 2D context，頁面渲染失敗。');
  }

  const renderTask = page.render({
    canvasContext: context,
    viewport
  });
  await renderTask.promise;

  const mimeType = imageFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
  const blob = await canvas.convertToBlob({
    type: mimeType,
    quality: imageFormat === 'jpeg' ? jpegQuality : undefined
  });
  const buffer = await blob.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  return `data:${mimeType};base64,${base64}`;
}

function normalizeScale(value) {
  const scale = Number(value);
  if (!Number.isFinite(scale)) return DEFAULT_RENDER_SCALE;
  return Math.min(3, Math.max(1, scale));
}

function normalizeFormat(value) {
  if (value === 'jpeg') return 'jpeg';
  return 'png';
}

function normalizeJpegQuality(value) {
  const quality = Number(value);
  if (!Number.isFinite(quality)) return DEFAULT_JPEG_QUALITY;
  return Math.min(1, Math.max(0.4, quality));
}

async function loadPdf(buffer) {
  try {
    const loadingTask = getDocument({
      data: buffer,
      cMapUrl: CMAP_URL,
      cMapPacked: true,
      standardFontDataUrl: STANDARD_FONT_URL
    });
    return await loadingTask.promise;
  } catch (err) {
    postLog('CMap/字型資料載入失敗，改用預設模式重試。');
    const fallbackTask = getDocument({ data: buffer });
    return await fallbackTask.promise;
  }
}

function fitImageToSlide(pageWidthPt, pageHeightPt, slideWidthPt, slideHeightPt) {
  const scale = Math.min(slideWidthPt / pageWidthPt, slideHeightPt / pageHeightPt);
  const w = pageWidthPt * scale;
  const h = pageHeightPt * scale;
  const x = (slideWidthPt - w) / 2;
  const y = (slideHeightPt - h) / 2;
  return { x, y, w, h };
}

function toPptxName(fileName) {
  const base = sanitizeFileName(fileName);
  if (base.toLowerCase().endsWith('.pptx')) return base;
  if (base.toLowerCase().endsWith('.pdf')) return base.slice(0, -4) + '.pptx';
  return `${base}.pptx`;
}

function sanitizeFileName(fileName) {
  if (!fileName) return 'notebooklm-export';
  const base = String(fileName).split(/[/\\]/).pop();
  return base || 'notebooklm-export';
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function toInches(points) {
  return points / POINTS_PER_INCH;
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function postStatus(label, progress) {
  self.postMessage({
    type: 'STATUS',
    payload: {
      label,
      progress
    }
  });
}

function postLog(message) {
  self.postMessage({
    type: 'LOG',
    payload: {
      message
    }
  });
}

function postError(err) {
  self.postMessage({
    type: 'ERROR',
    payload: {
      message: err?.message || String(err)
    }
  });
}

function postCancelled() {
  postStatus('已中止', 0);
  postLog('轉換已中止。');
}
