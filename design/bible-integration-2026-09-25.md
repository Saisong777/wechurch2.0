# 聖經功能整合：B 站預覽

## 目前狀態

程式整合與獨立資料上傳完成；新版曾在 B 成功啟動並完成操作測試，
**最後邊界修正版部署受阻，目前正在恢復 B，不能視為可交付狀態**。
Railway 曾停在 `Creating containers`，沒有新應用程式啟動紀錄，B 回應 502。
22:55 明確停止仍標為 Active、實際已無法服務的舊部署後，再重新部署原本正常版本。
22:57:46 B `__healthcheck` 回應 200，部署 `0bed20b2-2bcb-4359-badd-d08f0564c52e`
為 SUCCESS，舊版聖經頁已能開啟。重新核對 B volume 全部 26 個檔案成功。
這證明恢復有效，但不把殘留部署狀態當作已獲 Railway 確認的根因。
隨後 `51e93a5b-c1d7-401b-a556-3951c22ad09a` 成功運行新聖經整合，
已完成真實 B 的 320／390／1280px 操作測試，見 [UI 驗收紀錄](bible-ui-acceptance-2026-09-25.md)。
線上資料比對通過 16 組原包結果，但特殊編碼的隱藏上傳路徑進入 SPA 並回應 200 HTML。
未觀察到資料檔洩漏；已補明確 404，測試先重現失敗、修後完整驗證通過。
部署此修正時再次卡在 Creating containers；`ead9d0a6`、`dfe90c2c`、`a834b82d`
均未見應用程式啟動紀錄，已中止。23:27 啟動 `4c53d64f-f517-4009-85ac-e475f07385c8`
恢復曾成功的整合版本 `0b689a324f42db4b`，尚待成功及 health 確認。
目前不發布到 A，也不把本機畫面或先前短暫成功當作現在 B 正常的證據。

- 最後修正版來源提交：`5c202b9857e85842232ae4363e215ab18ebb3757`
- 候選快照指紋：`390b8bad31f3b36ac3cafa10fca4172f5d6cc9f6d23508940124b2d4da7aef83`（487 檔）
- 資料庫指紋：`595e942f856a8fd5aa536606c059afcb73a8292bcdd37a454476f038a54e365c`
- 26 個資料／授權檔案已於 B volume 逐檔核對，與原包相同。
- 通過型別檢查、406 項功能測試、7 項部署測試、DB/HTTP 完整性測試及 build。
- 卡住並中止的部署：`bcb241cc-3419-44af-8ae4-aeb1175d117c`、`c2ac7531-1c72-4e42-8ed4-d5aa5d3f3e60`。
- 上一版：`6f2da44e-0757-4b1f-bcfb-c1ea04a7f110`；沒有建立本次成功發布紀錄。
- 舊版恢復工作：`2428f4f2-8cbe-4a55-96d8-9b7ed09371b2`，沿用舊指紋 `be78c5e3595537e2`。
  22:42 左右 Railway 畫面顯示 build 35 秒完成，Creating containers 已超過 7 分鐘，
  Network/healthchecks 尚未開始。不能將控制台的舊版 Active/Online 標籤當作服務已恢復。
- 22:39:15 B `__healthcheck` 仍回應 Railway 502，request id `GhJGrPUMQQe3gCXUmrpb1w`。
  新版與舊版皆遇到同階段阻擋，需查 Railway 容器建立／volume 掛載；根因未證實。
- A 部署已再次讀回為 `a8a4db29-527f-4cc3-8d17-caed230f69cb`、SUCCESS、沒有變更。
- 22:48:07 歷史健康檢查為 502，request id `E_Rbbz6QRkWKCyOtV7rehQ`；
  這次舊版恢復最後失敗，後由 `0bed20b2` 恢復成功。不可用此歷史狀態取代最新部署讀回。
- 根目錄 `release-manifest.json` 保存候選版 487 個程式檔案的校驗值，重建檢查通過；
  它是候選版證據，不代表線上發布成功。資料校驗清單亦只保存名稱與 hash，不含 DB。

恢復後先查 B health 與實際版本，再處理容器建立問題。只有新版真正啟動後，才跑
`ops/verify-bible-staging.mjs`、手機／桌面 UI 驗收與成功發布紀錄。不移除 volume，
不重建會員 DB，不為繞過問題關閉登入／健康檢查或改動 A。
若恢復工作持續卡住，提供上述 deployment IDs、request id、區域
`asia-southeast1-eqsg3a` 與 volume `cbbf9530-1d9d-45ab-9e1b-f575a8d3b0aa`
請 Railway 查容器與儲存掛載。不要刪除或重建 volume；其中包含既有上傳檔及已驗證研經資料。

23:32 透過官方 API 讀回 Railway 已產生的部署診斷：`2428f4f2` 分類為
`infra_error`，建置與推送成功，但 CREATE_CONTAINER 持續 pending，建議聯絡 Railway。
這是平台自動診斷，並非工程人員確認的根因。另直接讀回 `4c53d64f` 的事件：
15:27:58Z BUILD_IMAGE 完成，15:28:00Z CREATE_CONTAINER 開始後無 completedAt，
沒有應用程式日誌或可供程式修正的錯誤。沒有啟動付費 Agent 對話，也未另行委派 Claude。

## 已確認範圍

2026-09-25 Sai 更正：合併的是現有「聖經」功能，不是新增「進階研讀」入口。
沿用 `/learn/bible`、`/bible`、現有導覽及登入；每日靈修、會員資料及 A 站不變。
本次屬功能整合，視覺沿用 Together，不做全站改版。

## 檢視

- 現有 BiblePage 有書卷／章節、搜尋、朗讀、複製、圖卡、筆記、收藏。
- 新包有雙譯本、五類註釋、原文、字典、串珠及來源揭露，沒有會員系統。
- 新包 SHA256SUMS 全通過，原有 10 項 Python 測試通過。
- 原頁手機／桌面整合前瀏覽器截圖尚未驗收，不以程式閱讀冒充視覺驗收。
- 來源：README、INTEGRATION、NOTICE、VALIDATION、驗收紀錄及實際程式。

## 版面及資料界線

同一個聖經入口：經文優先；書卷、章、譯本、對照、字級在閱讀控制區。
註釋／原文／串珠就所選經節展開，不另設頁面或重複導覽。
串珠、查字用小視窗，返回仍在原處；筆記留在頁面內。
保留既有朗讀、複製、圖卡、個人筆記、收藏入口與權限。
個人記錄寫入 WeChurch PostgreSQL，研經資料只讀獨立 SQLite。

執行位置全部是 Railway：既有 Node 22 容器處理 UI/API，worker 讀取容器內
`/data/.bible-study/public-20260925-v1/data/core.sqlite`。MacBook 只作開發及上傳；
不依賴 Mac mini、Tailscale、8879 或本機服務。唯讀資料在 Railway 持久 volume
的獨立隱藏目錄，B 設定 `BIBLE_STUDY_DIR` 指向固定版本，不放在暫存 `/tmp`。
上傳檔案服務拒絕此目錄，DB 原檔不提供 HTTP 下載；會員內容仍在既有 PostgreSQL。

預設 cmncbt，可對照 engwebp；不將舊 CUV 電子檔加到本包。
經文合節須保留起訖節號，原文不假裝已與中文對齊。
保留來源、授權、修改說明；不連接 8879 或任何私人原始資料。

## 發布界線

GitHub 倉庫為公開；部署包／資料庫／交付程式不得整包提交。
原包及校驗值另存於本機交付位置。B 部署另帶已驗證唯讀資料資產；
程式指紋和資料資產指紋分開記錄。先 B 預覽，A 須 Sai 再確認。

### 重建與大檔上傳

1. 從獨立保存的 `bible-study-public-v1.zip` 解開原包，保留原檔。
2. 執行 `node scripts/bible-study-assets.mjs <解開的包目錄> bible-study-data`，
   校驗版本與每個納入檔案。此目錄被 Git 排除，不可 `git add -f`。
3. `node ops/upload-bible-assets-b.mjs` 使用 Railway 官方登入的 terminal relay
   分段傳輸，只寫 B 的新版本目錄，每段確認接收、整包 hash 與逐檔 hash 通過後
   才原子啟用；原版本不覆寫。將 B 的 `BIBLE_STUDY_DIR` 設為上述固定路徑。
4. `npm run staging:deploy` 執行完整測試，重新比對本機與 Railway 的資料指紋，
   再建立只含程式與資產清單的小型快照。CLI 30 秒及上傳端 524 的兩次大檔
   失敗均未改動舊站；不再走整份 DB 隨程式上傳的路徑。
   如 CLI 在 30 秒逾時，先查部署狀態。確認失敗後，可執行
   `node ops/upload-verified-b-snapshot.mjs`；它會重新核對同一個不可變快照與
   B volume，以官方 `up` 協定延長等待至 180 秒，不跳過發布前測試。
5. 等 Railway SUCCESS 後執行 `node ops/verify-bible-staging.mjs`，以真實 B
   HTTPS 回應逐項比對原包資料，檢查私人路徑與未登入會員資料的拒絕行為。
   再執行 `npm run staging:release:record`，從線上容器回讀程式及資料指紋，
   並做真實 B 網址的 UI 驗收。單純上傳成功不算完成。

大型研經包的異地耐久備份仍需另外保管；公開 GitHub 不保存資料庫。

## 驗收清單

- [x] 原包檔案校驗與原有測試
- [x] 整合 API 輸入檢查、只讀、來源白名單及私人路徑拒絕
- [x] 雙譯本、合節、註釋切換、原文查字、串珠、搜尋（真實 B 首次成功版）
- [x] 個人筆記與收藏沿用會員隔離（本機隔離資料庫 HTTP 測試）
- [x] 手機尺寸及桌面、明暗模式、欄位聚焦（真實 B 首次成功版）
- [ ] 實體手機鍵盤／手勢、最終修正版完整線上驗收
- [ ] B 部署與版本讀回，A 不變
