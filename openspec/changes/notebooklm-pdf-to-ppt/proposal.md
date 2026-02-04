## Why

NotebookLM 目前只能輸出 PDF 簡報，使用者若要在 PowerPoint 中編輯或二次加工只能手動重做，成本高且容易出錯。除了轉換能力外，也需要一個直覺的網頁操作介面，讓非技術使用者能在瀏覽器內完成轉換並取得可編輯的 PPTX。

## What Changes

- 新增針對 NotebookLM PDF 的解析流程，能辨識頁面尺寸、背景、文字與圖片區塊。
- 新增 PDF 轉 PPTX 的輸出流程，保留版面配置與層級，產出可編輯的簡報檔。
- 新增轉換失敗的錯誤回報與基本驗證，提升轉換可用性。
- 新增網頁操作介面，可上傳 PDF、查看轉換進度並下載輸出檔案。
- 轉換流程改為在瀏覽器端完成，PDF 不上傳伺服器。

## Capabilities

### New Capabilities
- `notebooklm-pdf-ingest`: 解析 NotebookLM 產生的 PDF，萃取頁面尺寸、背景、文字與圖片區塊。
- `notebooklm-pdf-to-pptx`: 將解析結果轉成可編輯的 PPTX，維持版面比例與元素層級。
- `web-ui`: 提供網頁操作介面，支援上傳、瀏覽器端轉換、狀態檢視與下載。

### Modified Capabilities

## Impact

- 影響 PDF 解析與 PPTX 生成模組，以及其測試範本。
- 可能新增或調整第三方 PDF 解析／PPTX 產生依賴。
- 若有 CLI 或 API，需新增對 NotebookLM PDF 的輸入參數與錯誤訊息。
- 需要新增或擴充 Web 前端介面與靜態資源。
- 轉換在瀏覽器端執行，需評估前端效能與記憶體使用。
