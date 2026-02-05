## Why

目前流程會解析 PDF 文字與版面，對掃描件、字型缺失或版面複雜的來源容易失真。改為每頁完整畫面轉成圖片並置入 PPT，可確保視覺一致且輸出更穩定。

## What Changes

- **BREAKING**: 停用 PDF 文字與版面解析，輸出 PPT 不再包含可編輯文字或圖形。
- 將每頁 PDF 渲染成單張圖片，作為對應 PPT 投影片的全版圖片內容。
- 保留頁面順序與尺寸比例，PPT 每頁對應一張 PDF 頁面圖片。
- 移除或停用與文字抽取、元素重建相關的流程。

## Capabilities

### New Capabilities
- `pdf-to-ppt-image-slides`: 將 PDF 每頁渲染為圖片並輸出為不可編輯的 PPT 投影片。

### Modified Capabilities

## Impact

- 影響 PDF 解析與渲染管線、PPT 產出器與輸出格式行為。
- 影響對外 CLI/ API 的輸出預期（不再提供可編輯內容）。
- 可能增加輸出檔案大小與記憶體/處理時間需求。
