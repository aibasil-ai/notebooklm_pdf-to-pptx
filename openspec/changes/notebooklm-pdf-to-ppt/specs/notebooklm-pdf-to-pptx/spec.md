## ADDED Requirements

### Requirement: 瀏覽器端產生 PPTX
系統 MUST 在瀏覽器端完成 PPTX 產生，不得將原始 PDF 或中介資料上傳至伺服器。

#### Scenario: 轉換在瀏覽器完成
- **WHEN** 使用者啟動轉換流程
- **THEN** 系統 SHALL 在瀏覽器端完成 PPTX 產生且不進行網路上傳

### Requirement: 建立 PPTX 簡報輸出
系統 MUST 依中介版面模型輸出可編輯的 PPTX 檔案，並保留頁面順序。

#### Scenario: 中介模型包含多頁
- **WHEN** 輸入的中介模型包含多頁
- **THEN** 系統 SHALL 依序產生對應的 PPTX 投影片

### Requirement: 設定投影片尺寸與座標
系統 MUST 以 PDF 頁面尺寸建立投影片尺寸，並轉換座標至 PPTX 的單位系統。

#### Scenario: PDF 為自訂尺寸
- **WHEN** PDF 頁面尺寸為非標準比例
- **THEN** 系統 SHALL 以相同寬高建立投影片以維持比例

### Requirement: 轉換背景元素
系統 MUST 將中介模型中的背景元素設定為投影片背景。

#### Scenario: 中介模型包含背景圖
- **WHEN** 中介模型標記背景圖
- **THEN** 系統 SHALL 將該圖像設為投影片背景層

### Requirement: 轉換文字區塊為可編輯文字
系統 MUST 將文字區塊轉換為可編輯文字框，保留內容、字型、字級與位置。

#### Scenario: 文字區塊含有字型資訊
- **WHEN** 文字區塊包含字型與字級
- **THEN** 系統 SHALL 套用相對應字型與字級於文字框

### Requirement: 轉換圖片區塊
系統 MUST 將圖片區塊轉換為可編輯圖片元素並維持位置與尺寸。

#### Scenario: 圖片區塊包含邊界矩形
- **WHEN** 圖片區塊有邊界矩形
- **THEN** 系統 SHALL 以相同位置與尺寸放置圖片元素

### Requirement: 降級輸出為整頁圖片
系統 MUST 在標記為降級的頁面以整頁圖片方式輸出，並保留頁面順序。

#### Scenario: 頁面標記可降級
- **WHEN** 中介模型標記該頁可降級
- **THEN** 系統 SHALL 以整頁圖片輸出該投影片

### Requirement: 轉換過程驗證與回報
系統 MUST 在輸出後提供基本驗證結果與警告清單（如字型缺失、元素遺失）。

#### Scenario: 轉換存在字型缺失
- **WHEN** 轉換時發現字型缺失
- **THEN** 系統 SHALL 記錄警告並使用預設字型
