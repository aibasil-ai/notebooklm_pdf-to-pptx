## ADDED Requirements

### Requirement: 每頁輸出為單一影像投影片
系統 MUST 將每一頁 PDF 轉為單一影像，並以全版圖片形式輸出到對應的 PPT 投影片。

#### Scenario: 正常輸出單頁影像投影片
- **WHEN** 使用者上傳包含多頁的 PDF 並開始轉換
- **THEN** 系統 MUST 產生與 PDF 頁數相同的投影片，且每頁只有一張全版影像

### Requirement: 保留頁面順序與比例
系統 MUST 保留 PDF 的頁面順序與寬高比例，輸出投影片的尺寸應與 PDF 頁面比例一致。

#### Scenario: 依原始順序輸出
- **WHEN** PDF 含有 N 頁
- **THEN** 產生的 PPT MUST 依原順序建立 N 張投影片

### Requirement: 禁止文字與元素重建
系統 MUST 不解析 PDF 文字內容、不重建文字或圖形元素於 PPT 中。

#### Scenario: 不產生可編輯文字
- **WHEN** 轉換完成
- **THEN** 產生的 PPT MUST 不包含可編輯文字或向量圖形物件

### Requirement: 轉換期間可中止
系統 MUST 支援使用者在轉換過程中中止作業，並停止後續頁面的處理。

#### Scenario: 使用者中止轉換
- **WHEN** 使用者在轉換進行中觸發中止
- **THEN** 系統 MUST 停止後續頁面渲染並回報已中止狀態
