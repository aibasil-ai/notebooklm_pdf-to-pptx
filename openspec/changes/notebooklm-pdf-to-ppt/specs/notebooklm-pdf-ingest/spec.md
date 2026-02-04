## ADDED Requirements

### Requirement: 瀏覽器端解析
系統 MUST 在瀏覽器端完成 PDF 解析，不得將原始 PDF 上傳至伺服器。

#### Scenario: 使用者在瀏覽器選擇 PDF
- **WHEN** 使用者在網頁介面選擇 PDF 並開始轉換
- **THEN** 系統 SHALL 僅在本機瀏覽器端處理且不進行網路上傳

### Requirement: 支援 NotebookLM PDF 輸入與頁面解析
系統 MUST 接受 NotebookLM 產生的 PDF 檔案作為輸入，並逐頁解析頁面尺寸與座標系統。

#### Scenario: 輸入為有效 NotebookLM PDF
- **WHEN** 使用者提供有效的 NotebookLM PDF
- **THEN** 系統 SHALL 讀取每一頁的寬高與原始座標資訊

### Requirement: 擷取頁面背景
系統 MUST 偵測每一頁是否存在整頁背景圖或底色，並將其標記為背景元素。

#### Scenario: 頁面包含整頁背景圖
- **WHEN** 解析到覆蓋全頁的背景圖像
- **THEN** 系統 SHALL 將該圖像標記為背景並保留其原始尺寸

### Requirement: 擷取文字區塊
系統 MUST 從 PDF 取得文字內容、字型、字級與文字區塊位置，並分群為可編輯文字區塊。

#### Scenario: 頁面包含多段文字
- **WHEN** 頁面含有多個文字區段
- **THEN** 系統 SHALL 依字距與行距將文字分群為多個文字區塊並保留座標

### Requirement: 擷取圖片區塊
系統 MUST 偵測並擷取頁面中的圖片元素，包含其邊界矩形與原始影像資料。

#### Scenario: 頁面包含嵌入圖片
- **WHEN** 解析到嵌入圖片元素
- **THEN** 系統 SHALL 匯出圖片內容並記錄其邊界座標

### Requirement: 建立中介版面模型輸出
系統 MUST 產生結構化的中介版面模型，包含頁面尺寸、背景、文字區塊與圖片區塊資訊。

#### Scenario: 解析完成後輸出中介模型
- **WHEN** 完成單頁解析
- **THEN** 系統 SHALL 產出包含頁面與元素清單的中介版面模型

### Requirement: 解析失敗回報
系統 MUST 在解析失敗時回報錯誤原因與頁碼，並標記為可降級處理。

#### Scenario: 解析頁面發生錯誤
- **WHEN** 解析任一頁面失敗
- **THEN** 系統 SHALL 回報錯誤原因與頁碼，並標記該頁可使用降級輸出
