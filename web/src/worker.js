import pptxgen from 'pptxgenjs';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';

GlobalWorkerOptions.workerSrc = workerSrc;

const POINTS_PER_INCH = 72;
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

    postStatus('載入 PDF', 5);
    postLog('啟動瀏覽器端轉換流程。');

    const loadingTask = getDocument({ data: buffer });
    const pdf = await loadingTask.promise;

    if (cancelled) return postCancelled();

    const pages = [];
    const total = pdf.numPages;

    for (let index = 1; index <= total; index += 1) {
      if (cancelled) return postCancelled();

      const page = await pdf.getPage(index);
      const viewport = page.getViewport({ scale: 1 });
      const pageHeight = viewport.height;
      const pageWidth = viewport.width;

      postStatus(`解析第 ${index} / ${total} 頁`, 10 + Math.round((index / total) * 50));
      postLog(`解析第 ${index} 頁文字內容。`);

      const textContent = await page.getTextContent();
      const textItems = extractTextItems(textContent, pageHeight);

      let backgroundData = null;
      try {
        backgroundData = await renderPageBackground(page);
      } catch (err) {
        postLog(`背景渲染失敗：第 ${index} 頁改用純文字輸出。`);
      }

      pages.push({
        width: pageWidth,
        height: pageHeight,
        textItems,
        backgroundData
      });
    }

    if (cancelled) return postCancelled();

    postStatus('產生 PPTX', 80);
    postLog('建立 PPTX 投影片。');

    const pptxBuffer = await buildPptx(pages, fileName);

    postStatus('完成輸出', 95);

    const outputName = toPptxName(fileName);
    self.postMessage(
      {
        type: 'RESULT',
        payload: {
          buffer: pptxBuffer,
          fileName: outputName
        }
      },
      [pptxBuffer]
    );
  } catch (err) {
    postError(err);
  }
}

function extractTextItems(textContent, pageHeight) {
  return textContent.items
    .filter((item) => item.str && item.str.trim().length > 0)
    .map((item) => {
      const [a, b, c, d, e, f] = item.transform;
      const fontSize = Math.max(8, Math.abs(d) || item.height || 12);
      const width = Math.max(item.width || 0, fontSize * 0.4);
      const height = Math.max(item.height || fontSize, fontSize);
      const x = e;
      const yTop = pageHeight - f - height;

      return {
        text: item.str,
        x: toInches(Math.max(0, x)),
        y: toInches(Math.max(0, yTop)),
        w: toInches(width),
        h: toInches(height),
        fontSize: Math.round(fontSize),
        raw: { a, b, c, d }
      };
    });
}

async function renderPageBackground(page) {
  if (!self.OffscreenCanvas) return null;

  const scale = 1.2;
  const viewport = page.getViewport({ scale });
  const canvas = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return null;

  const renderTask = page.render({
    canvasContext: context,
    viewport
  });
  await renderTask.promise;

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const buffer = await blob.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  return `data:image/png;base64,${base64}`;
}

async function buildPptx(pages, fileName) {
  const pptx = new pptxgen();

  if (pages.length > 0) {
    const layoutName = 'PDF_LAYOUT';
    const widthIn = toInches(pages[0].width);
    const heightIn = toInches(pages[0].height);
    pptx.defineLayout({ name: layoutName, width: widthIn, height: heightIn });
    pptx.layout = layoutName;
  }

  pages.forEach((page, index) => {
    const slide = pptx.addSlide();

    if (page.backgroundData) {
      slide.background = { data: page.backgroundData };
    }

    if (page.width && page.height && index === 0) {
      postLog(`投影片尺寸：${page.width.toFixed(1)}x${page.height.toFixed(1)} points`);
    }

    page.textItems.forEach((item) => {
      slide.addText(item.text, {
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        fontSize: item.fontSize,
        color: '2D2D2D'
      });
    });
  });

  postStatus('輸出 PPTX', 90);
  const base64 = await pptx.write({ outputType: 'base64' });
  const bytes = base64ToBytes(base64);
  postLog(`PPTX 產生完成（${formatBytes(bytes.length)}）。`);
  return bytes.buffer;
}

function toPptxName(fileName) {
  if (!fileName) return 'notebooklm-export.pptx';
  return fileName.replace(/\.pdf$/i, '') + '.pptx';
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
