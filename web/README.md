# Web UI（純瀏覽器轉換）

此資料夾提供純瀏覽器版本的 Web UI 與 Web Worker 流程，所有轉換都在本機完成，不會上傳伺服器。

## 使用方式

```bash
cd /home/joshlin/AI/pdf-to-ppt/web
npm install
npm run dev
```

然後依終端輸出開啟本機網址（預設為 `http://127.0.0.1:5173`）。

## 注意事項

- 轉換流程已改為 `pdfjs-dist` + `pptxgenjs` 的純瀏覽器實作，無需 CDN。
- 若檔案過大或頁數過多，請留意瀏覽器記憶體使用量。
