import './styles.css';

const MAX_BYTES = 50 * 1024 * 1024;

const fileInput = document.getElementById('fileInput');
const fileMeta = document.getElementById('fileMeta');
const fileNameEl = fileMeta.querySelector('.file-meta__name');
const fileSizeEl = fileMeta.querySelector('.file-meta__size');
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
  log('開始讀取檔案，準備交給 Web Worker。');

  cleanupWorker();
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.addEventListener('message', handleWorkerMessage);
  worker.addEventListener('error', handleWorkerError);

  try {
    const buffer = await currentFile.arrayBuffer();
    worker.postMessage(
      {
        type: 'START',
        payload: {
          fileName: currentFile.name,
          buffer
        }
      },
      [buffer]
    );
  } catch (err) {
    handleWorkerError(err);
  }
}

function cancelConversion() {
  if (!worker) return;
  worker.postMessage({ type: 'CANCEL' });
  worker.terminate();
  worker = null;
  setStatus('已中止', 0);
  log('轉換已中止，可重新開始。');
  setControls({ canStart: true, canCancel: false, canDownload: false });
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
    const { buffer, fileName } = payload;
    downloadName = fileName || 'notebooklm-export.pptx';
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    });
    downloadUrl = URL.createObjectURL(blob);
    setStatus('完成', 100);
    log('轉換完成，準備下載。');
    setControls({ canStart: true, canCancel: false, canDownload: true });
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
  log('Web Worker 發生錯誤，請重試。');
  if (err?.message) log(err.message);
  setControls({ canStart: true, canCancel: false, canDownload: false });
  cleanupWorker();
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
