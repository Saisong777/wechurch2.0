# Railway B 執行環境恢復

## 範圍與目前狀態

Sai 已同意建立替代 B 執行環境並保留原資料。2026-09-26 00:01，替代服务部署
`94c8148d-5b7e-43d2-b7d6-ea5bb21fa3fa` 成功；原 B 網址已接至新服務。
00:07 完整研經線上比對通過；最後正在驗證後續正常發布流程。
這是 B 預覽與恢復，不是 A 發布，也不是 Railway 已確認底層事故根因。

## 現役目標

- 專案：`9371f53f-3043-4a19-b25f-a55d891fb46a`
- B 環境：`ae398a3f-4f0e-4617-8c55-838d1c5b47d9`
- **現役 B 服務**：`fef7af7c-e3c3-4977-8294-c3a123a4242e`（wechurch-staging-recovery）
- B 網址不變：<https://wechurch-staging-staging.up.railway.app>
- 同一個 PostgreSQL 服務：`0d52eb1a-b8e6-4f0f-b8ba-c652ddacebc8`
- 同一個檔案 volume：`cbbf9530-1d9d-45ab-9e1b-f575a8d3b0aa`，仍掛載 `/data`
- 舊服務 `cf36df49-a0f4-4224-80f2-4d0e4d1c1194` 保留，不再接收原 B 網址流量，沒有自動部署來源。
- 舊網址已改成 `wechurch-staging-retired-20260926.up.railway.app`，不是測試入口。
- A 網站既有部署 `a8a4db29-527f-4cc3-8d17-caed230f69cb` 未修改，A DB 未写入。

正常發布一律使用 `scripts/railway-staging.mjs` 的現役 target。不要再使用歷史報告中的舊服務 ID。
正常流程是 `npm run staging:deploy`，不是執行一次性 `ops/recover-b-runtime.mjs`。
新服務沿用 B 的登入憑證、SESSION_SECRET、邀請碼、Google callback 及私有資料庫設定；
Railway 自動產生的 service identity 沒有從舊服務照搬，也没有關閉環境隔離檢查。

## 已驗證的恢復證據

1. 原 DB 可達，恢復前有 users 64、auth_users 63、devotional_notes 106、
   user_reading_progress 1,114、reading_plan_template_items 312。只查筆數，未列出私人內容。
2. 掛接的是原 volume，沒有建立空資料庫、清空上傳檔或用舊備份覆蓋資料。
3. 新服務讀回 487 個程式檔案的版本指紋 `390b8bad31f3b36ac3cafa10fca4172f5d6cc9f6d23508940124b2d4da7aef83`。
4. 26 個研經資料／授權檔案逐檔相同，SQLite hash：
   `595e942f856a8fd5aa536606c059afcb73a8292bcdd37a454476f038a54e365c`。
5. 原 B 網址 health 200；16 組 API 結果與原包完全相同，包括譯本、註釋、原文、字典、串珠、搜尋。
6. 隱藏資料路徑及編碼變形皆 404；未登入的私人筆記／收藏為 401。
7. 瀏覽器既有登入仍有效，首頁與每日靈修進度正確，聖經及頁內筆記正常載入；來源與授權頁已實際開啟。

## 發布可靠性

本次發現兩個不同問題，不混為一談：

- 舊服務的停止／移除狀態反覆回到 RUNNING，但 SSH 找不到 instance；同 image、同設定在替代服務成功，原 volume 亦可掛載及讀取。底層原因未由 Railway 證實，但 B 已不再依賴該舊服務。
- Railway CLI 上傳 30 秒逾時，會留下 SNAPSHOT_CODE 失敗部署。它沒有令現役服務停止。正常發布已改用既有、可核對不可變快照與資料資產的 180 秒上傳器；仍先跑完整測試與隔離檢查，出錯不自動重試。

建立 volume 額外平台快照的請求回應 Not Authorized，沒有重試繞過，也不宣稱平台快照成功。
原有加密本機備份保留；最新完整加密備份與異地耐久性須另列實際驗證結果。
原始事故日誌、設定及私人資料不提交公開 GitHub。

## 剩餘驗收

- [ ] 正常發布流程在現役新服務成功，重新讀回最終指紋。
- [ ] Google 登入安全流程與最終部署 API 再驗證。
- [ ] 完成新的 DB／檔案／設定本機加密備份並讀回。
- [ ] Sai 實體手機試用；A 發布另行確認。
