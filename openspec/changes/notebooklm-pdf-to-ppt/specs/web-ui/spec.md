## ADDED Requirements

### Requirement: 選取本機 NotebookLM PDF
系統 MUST 提供網頁介面讓使用者選取本機的 NotebookLM PDF 檔案。

#### Scenario: 使用者選取 PDF
- **WHEN** 使用者在網頁介面選擇 PDF 並開始轉換
- **THEN** 系統 SHALL 取得本機檔案並進入處理流程

### Requirement: 禁止上傳至伺服器
系統 MUST 在瀏覽器端完成轉換流程，不得將原始 PDF 上傳至伺服器。

#### Scenario: 轉換流程啟動
- **WHEN** 使用者啟動轉換流程
- **THEN** 系統 SHALL 僅在瀏覽器端處理且不進行網路上傳

### Requirement: 檔案驗證與大小限制
系統 MUST 驗證選取檔案為 PDF 且符合大小限制，否則拒絕處理。

#### Scenario: 檔案格式不符合
- **WHEN** 使用者選取非 PDF 檔案
- **THEN** 系統 SHALL 顯示錯誤訊息並拒絕開始轉換

### Requirement: 建立本地轉換工作與狀態識別
系統 MUST 為每次轉換建立本地工作並提供可追蹤的狀態識別。

#### Scenario: 成功建立本地工作
- **WHEN** 檔案通過驗證
- **THEN** 系統 SHALL 建立本地工作並回傳可用於顯示狀態的識別

### Requirement: 使用 Web Worker 執行轉換
系統 MUST 使用 Web Worker 執行轉換，避免主執行緒被阻塞。

#### Scenario: 轉換進行中
- **WHEN** 轉換在進行中
- **THEN** 系統 SHALL 保持介面可操作且持續更新進度

### Requirement: 顯示轉換進度與狀態
系統 MUST 在網頁介面顯示轉換進度與狀態（進行中、完成、失敗）。

#### Scenario: 轉換工作尚未完成
- **WHEN** 轉換工作尚未完成
- **THEN** 系統 SHALL 在介面顯示目前狀態與進度

### Requirement: 下載轉換結果
系統 MUST 在轉換完成後提供 PPTX 檔案下載。

#### Scenario: 轉換完成
- **WHEN** 轉換工作成功完成
- **THEN** 系統 SHALL 提供 PPTX 下載連結

### Requirement: 轉換失敗提示
系統 MUST 在轉換失敗時顯示錯誤訊息與建議操作。

#### Scenario: 轉換失敗
- **WHEN** 轉換工作失敗
- **THEN** 系統 SHALL 顯示錯誤訊息並提示可重新嘗試
