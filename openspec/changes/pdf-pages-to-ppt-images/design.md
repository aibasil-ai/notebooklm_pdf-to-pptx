## Context

目前轉換流程在 `web/src/worker.js` 使用 `pdfjs-dist` 逐頁解析，先以 `getTextContent()` 取得文字，再嘗試用 `OffscreenCanvas` 渲染背景影像，最後以 `pptxgenjs` 建立投影片，背景影像（若成功）+ 逐段文字疊在投影片上。此流程在掃描件或版面複雜時容易失真，且文字抽取成本高。

本次變更要求改為「每頁只輸出一張完整頁面影像」，不再提供可編輯文字或圖形。

## Goals / Non-Goals

**Goals:**
- 每一頁 PDF 以單張圖片輸出到 PPT 投影片，保留頁面順序與尺寸比例。
- 不再解析或重建 PDF 文字、圖形與版面。
- 保持瀏覽器端（Web Worker）完成轉換的流程與進度回報。

**Non-Goals:**
- 不提供任何可編輯文字或物件。
- 不做 OCR 或語意結構重建。
- 不新增後端服務或伺服器端渲染。

## Decisions

- **Decision 1: 使用 `pdfjs-dist` 直接渲染頁面為影像，再寫入 PPT。**
  - Rationale: 現有流程已在 Web Worker 內使用 `pdfjs-dist`，改為純影像輸出可最大化重用並簡化邏輯。
  - Alternatives: 將渲染移到主執行緒（增加 UI 卡頓風險）、改用伺服器端渲染（增加部署與成本）。

- **Decision 2: 以 `slide.addImage()` 放入全版影像，而非背景 + 文字疊加。**
  - Rationale: 單一全版影像能確保投影片內容一致，避免背景圖與文字層級差異。
  - Alternatives: 使用 `slide.background`（可行但背景圖有些檢視器相容性差異，且無法控制裁切/縮放行為）。

- **Decision 3: 設定固定渲染比例（例如 `scale = 2`）並保留頁面比例。**
  - Rationale: 兼顧畫質與檔案大小，避免 1:1 解析度過低造成模糊。
  - Alternatives: 動態依頁面大小調整比例（複雜度增加）、使用 1.0（檔案小但畫質不足）。

- **Decision 4: 移除 `getTextContent()` 與文字版面重建流程。**
  - Rationale: 符合「不可編輯」的產品需求，降低錯誤與處理成本。
  - Alternatives: 保留文字抽取作為可選輸出（不符合此次需求）。

## Risks / Trade-offs

- [輸出檔案變大] → 以固定渲染比例並評估改用 JPEG（可選）降低大小。
- [記憶體與時間成本上升] → 分頁逐一渲染、每頁完成即釋放中間 buffer，保留取消機制。
- [OffscreenCanvas 不支援] → 明確顯示錯誤訊息或降級為提示「需支援 OffscreenCanvas」。
- [圖片畫質不足或過大] → 提供可調整的 `scale` 常數，必要時加入上限。

## Migration Plan

1. 更新 `web/src/worker.js`：移除文字抽取流程，新增「頁面渲染成影像」的主流程，並以 `slide.addImage()` 建立滿版投影片。
2. 更新狀態與 log 文字，移除「解析文字內容」等訊息。
3. 以多種 PDF（含掃描件/多頁/大頁面）進行手動驗證，確認輸出 PPT 每頁皆為完整影像。
4. 若需回復舊流程，回退 `worker.js` 到先前版本即可。

## Open Questions

- 渲染比例 `scale` 的預設值應為多少？是否需要提供使用者可調參數？給我一個適當的預設值，並提供使用者可調參數，旁邊說明參數如何調整以及會如何影響變化。
- 影像格式優先使用 PNG 還是 JPEG？是否允許以檔案大小為優先的策略切換？允許以檔案大小為優先的策略切換。
- OffscreenCanvas 不支援時的體驗要「中止並提示」還是「改為主執行緒渲染」？OffscreenCanvas不支援時改為主執行緒渲染，若OffscreenCanvas有支援則繼續。
