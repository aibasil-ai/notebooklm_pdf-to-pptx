import './styles.css';
import pptxgen from 'pptxgenjs';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';

GlobalWorkerOptions.workerSrc = workerSrc;

const MAX_BYTES = 50 * 1024 * 1024;
const DEFAULT_SCALE = 2;
const DEFAULT_JPEG_QUALITY = 0.82;
const POINTS_PER_INCH = 72;
const CMAP_URL = new URL('/pdfjs/cmaps/', window.location.origin).href;
const STANDARD_FONT_URL = new URL('/pdfjs/standard_fonts/', window.location.origin).href;

const fileInput = document.getElementById('fileInput');
const fileMeta = document.getElementById('fileMeta');
const fileNameEl = fileMeta.querySelector('.file-meta__name');
const fileSizeEl = fileMeta.querySelector('.file-meta__size');
const scaleInput = document.getElementById('scaleInput');
const scaleValue = document.getElementById('scaleValue');
const formatSelect = document.getElementById('formatSelect');
const startBtn = document.getElementById('startBtn');
const cancelBtn = document.getElementById('cancelBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusLabel = document.getElementById('statusLabel');
const progressLabel = document.getElementById('progressLabel');
const progressBar = document.getElementById('progressBar');
const logEl = document.getElementById('log');
const drop = document.querySelector('.drop');

let currentFile = null;
let worker = null;
let downloadUrl = null;
let downloadName = 'notebooklm-export.pptx';
let mainThreadActive = false;
let mainThreadCancel = false;

function setStatus(label, progress) {
  statusLabel.textContent = label;
  const value = Math.max(0, Math.min(100, progress));
  progressLabel.textContent = `${value}%`;
  progressBar.style.width = `${value}%`;
}

function log(message) {
  const line = document.createElement('div');
  line.textContent = message;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function resetLog() {
  logEl.innerHTML = '';
}

function resetDownload() {
  if (downloadUrl) {
    URL.revokeObjectURL(downloadUrl);
    downloadUrl = null;
  }
  downloadBtn.disabled = true;
}

function updateFileMeta(file) {
  if (!file) {
    fileNameEl.textContent = '尚未選取檔案';
    fileSizeEl.textContent = '—';
    return;
  }
  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatBytes(file.size);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function validateFile(file) {
  if (!file) return '請先選取 PDF 檔案。';
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return '檔案格式必須是 PDF。';
  if (file.size > MAX_BYTES) return `檔案超過 ${formatBytes(MAX_BYTES)} 上限。`;
  return null;
}

function setControls({ canStart, canCancel, canDownload }) {
  startBtn.disabled = !canStart;
  cancelBtn.disabled = !canCancel;
  downloadBtn.disabled = !canDownload;
}

function formatScale(value) {
  const scale = Number(value);
  if (Number.isNaN(scale)) return `${DEFAULT_SCALE.toFixed(1)}x`;
  const decimals = scale % 1 === 0 ? 1 : 2;
  return `${scale.toFixed(decimals)}x`;
}

function updateScaleLabel() {
  scaleValue.textContent = formatScale(scaleInput.value);
}

function getConversionOptions() {
  const scale = Math.min(3, Math.max(1, Number(scaleInput.value) || DEFAULT_SCALE));
  const mode = formatSelect.value;
  const imageFormat = mode === 'size' ? 'jpeg' : 'png';
  const jpegQuality = mode === 'size' ? DEFAULT_JPEG_QUALITY : null;
  return { scale, imageFormat, jpegQuality };
}

function supportsOffscreenCanvas() {
  return (
    typeof OffscreenCanvas !== 'undefined' &&
    typeof OffscreenCanvas.prototype?.convertToBlob === 'function'
  );
}

function cleanupWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

async function startConversion() {
  const error = validateFile(currentFile);
  if (error) {
    setStatus('檔案驗證失敗', 0);
    resetLog();
    log(error);
    return;
  }

  resetDownload();
  resetLog();
  setStatus('準備中', 2);
  setControls({ canStart: false, canCancel: true, canDownload: false });
  log('開始讀取檔案，準備轉換。');

  try {
    const buffer = await currentFile.arrayBuffer();
    const options = getConversionOptions();
    if (!supportsOffscreenCanvas()) {
      log('OffscreenCanvas 不支援，改用主執行緒渲染（可能較慢）。');
      await startConversionMainThread(buffer, currentFile.name, options);
      return;
    }

    cleanupWorker();
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.addEventListener('message', handleWorkerMessage);
    worker.addEventListener('error', handleWorkerError);

    worker.postMessage(
      {
        type: 'START',
        payload: {
          fileName: currentFile.name,
          buffer,
          ...options
        }
      },
      [buffer]
    );
  } catch (err) {
    handleWorkerError(err);
  }
}

function cancelConversion() {
  if (worker) {
    worker.postMessage({ type: 'CANCEL' });
    worker.terminate();
    worker = null;
    setStatus('已中止', 0);
    log('轉換已中止，可重新開始。');
    setControls({ canStart: true, canCancel: false, canDownload: false });
    return;
  }
  if (mainThreadActive) {
    mainThreadCancel = true;
    log('已收到中止要求。');
  }
}

function handleWorkerMessage(event) {
  const { type, payload } = event.data || {};

  if (type === 'STATUS') {
    setStatus(payload.label, payload.progress);
    return;
  }

  if (type === 'LOG') {
    log(payload.message);
    return;
  }

  if (type === 'RESULT') {
    finalizeDownload(payload.buffer, payload.fileName);
    return;
  }

  if (type === 'ERROR') {
    setStatus('轉換失敗', 0);
    log(payload.message || '轉換發生錯誤。');
    setControls({ canStart: true, canCancel: false, canDownload: false });
  }
}

function handleWorkerError(err) {
  setStatus('轉換失敗', 0);
  log('轉換發生錯誤，請重試。');
  if (err?.message) log(err.message);
  setControls({ canStart: true, canCancel: false, canDownload: false });
  cleanupWorker();
  mainThreadActive = false;
  mainThreadCancel = false;
}

function handleFileSelection(file) {
  currentFile = file || null;
  updateFileMeta(currentFile);
  resetDownload();
  resetLog();
  setStatus('待命中', 0);
  if (!currentFile) {
    setControls({ canStart: false, canCancel: false, canDownload: false });
    return;
  }

  const error = validateFile(currentFile);
  if (error) {
    setControls({ canStart: false, canCancel: false, canDownload: false });
    log(error);
    return;
  }

  setControls({ canStart: true, canCancel: false, canDownload: false });
  log('檔案已就緒，可以開始轉換。');
}

function triggerDownload() {
  if (!downloadUrl) return;
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = downloadName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

fileInput.addEventListener('change', (event) => {
  handleFileSelection(event.target.files?.[0]);
});

scaleInput.addEventListener('input', updateScaleLabel);

startBtn.addEventListener('click', startConversion);
cancelBtn.addEventListener('click', cancelConversion);
downloadBtn.addEventListener('click', triggerDownload);

['dragenter', 'dragover'].forEach((eventName) => {
  drop.addEventListener(eventName, (event) => {
    event.preventDefault();
    drop.classList.add('is-dragging');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  drop.addEventListener(eventName, (event) => {
    event.preventDefault();
    drop.classList.remove('is-dragging');
  });
});

drop.addEventListener('drop', (event) => {
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    fileInput.value = '';
    handleFileSelection(file);
  }
});

setControls({ canStart: false, canCancel: false, canDownload: false });
setStatus('待命中', 0);
log('選擇 NotebookLM PDF 後即可開始轉換。');
updateScaleLabel();

async function startConversionMainThread(buffer, fileName, options) {
  mainThreadActive = true;
  mainThreadCancel = false;

  try {
    postStatus('載入 PDF', 5);
    postLog('主執行緒開始渲染。');

    const pdf = await loadPdf(buffer);

    const total = pdf.numPages;
    const pptx = new pptxgen();
    const layoutName = 'PDF_LAYOUT';
    let slideWidthPt = null;
    let slideHeightPt = null;

    try {
      for (let index = 1; index <= total; index += 1) {
        if (mainThreadCancel) return postMainThreadCancelled();

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
          imageData = await renderPageImageOnMainThread(page, options);
        } finally {
          page.cleanup();
        }

        if (mainThreadCancel) return postMainThreadCancelled();

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
    } finally {
      pdf.cleanup();
    }

    if (mainThreadCancel) return postMainThreadCancelled();

    postStatus('輸出 PPTX', 90);
    postLog('建立 PPTX 投影片。');

    const base64 = await pptx.write({ outputType: 'base64' });
    const bytes = base64ToBytes(base64);
    postLog(`PPTX 產生完成（${formatBytes(bytes.length)}）。`);
    postStatus('完成輸出', 95);

    finalizeDownload(bytes.buffer, toPptxName(fileName));
  } catch (err) {
    handleWorkerError(err);
  } finally {
    mainThreadActive = false;
    mainThreadCancel = false;
  }
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
    log('CMap/字型資料載入失敗，改用預設模式重試。');
    const fallbackTask = getDocument({ data: buffer });
    return await fallbackTask.promise;
  }
}

async function renderPageImageOnMainThread(page, options) {
  const scale = options?.scale ?? DEFAULT_SCALE;
  const imageFormat = options?.imageFormat ?? 'png';
  const jpegQuality = options?.jpegQuality ?? DEFAULT_JPEG_QUALITY;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    throw new Error('無法取得 Canvas 2D context，頁面渲染失敗。');
  }

  const renderTask = page.render({
    canvasContext: context,
    viewport
  });
  await renderTask.promise;

  if (imageFormat === 'jpeg') {
    return canvas.toDataURL('image/jpeg', jpegQuality);
  }
  return canvas.toDataURL('image/png');
}

function fitImageToSlide(pageWidthPt, pageHeightPt, slideWidthPt, slideHeightPt) {
  const scale = Math.min(slideWidthPt / pageWidthPt, slideHeightPt / pageHeightPt);
  const w = pageWidthPt * scale;
  const h = pageHeightPt * scale;
  const x = (slideWidthPt - w) / 2;
  const y = (slideHeightPt - h) / 2;
  return { x, y, w, h };
}

function finalizeDownload(buffer, fileName) {
  downloadName = fileName || 'notebooklm-export.pptx';
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  });
  downloadUrl = URL.createObjectURL(blob);
  setStatus('完成', 100);
  log('轉換完成，準備下載。');
  setControls({ canStart: true, canCancel: false, canDownload: true });
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

function toInches(points) {
  return points / POINTS_PER_INCH;
}

function postStatus(label, progress) {
  setStatus(label, progress);
}

function postLog(message) {
  log(message);
}

function postMainThreadCancelled() {
  setStatus('已中止', 0);
  log('轉換已中止，可重新開始。');
  setControls({ canStart: true, canCancel: false, canDownload: false });
}
