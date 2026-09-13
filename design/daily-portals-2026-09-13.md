# WeChurch 日常入口精簡

## 本次調整

- `/learn`：只保留打開聖經、每日靈修、查看筆記。
- 接續讀經、耶穌四季從讀經入口撤下；路由及既有資料保留，未刪除課程。
- `/share`：只保留我的禱告與恩典，以及一個分享牆入口。移除信息圖卡、禱告會及兩面牆重複並列的入口。
- `/walls`：直接開啟可用的分享牆，不多加一層選擇頁。以「今日靈修／代禱」切換；原 `/devotion-wall`、`/prayer-wall` 連結相容。
- 首頁移除禱告會入口，改以分享牆進入公開分享。沒有增加第二排或底部導覽。
- 功能開關持續適用，未開放的牆不出現在切換列。

## 資料界線

本次只調整入口及導覽，不改資料庫、匿名、公開期限、發布或撤回規則。個人禱告不是自動公開；靈修午夜移出公開牆，個人筆記仍保留。禱告牆與禱告會是不同功能，這次只撤下禱告會入口。

## 版本與復原

- 程式來源：`994b17caa3ca21cb37adc24aefde0d638fac9440`，包含原有筆記驗收腳本的空白領受檢查，逐檔對齊本次 B 快照。
- 功能分支：`codex/simplify-daily-portals`；草稿 PR #5，只到 integration，未批准正式發布。
- B 部署目標：`3fb876e4-725b-47ca-a9b7-f7432ede1a8f`。
- 預期指紋：`3689891660fcfa4876d1822881fbc9d5b7d19bde2009d57b3b53327e7316a7c1`。
- `release-manifest.json` 是逐檔核對來源；`node ops/verify-b-checkpoint.mjs` 驗證取回的程式。
- 修改前救援標籤：`b-2026-09-13-a14d8f91`。回退程式不等於回退資料；DB、上傳檔及 secrets 仍須另行加密備份。
- 沿用 Node 22、`npm ci`、`npm run typecheck`、`npm test`、`npm run test:deployment`、`npm run test:integrity`、`npm run build`。資料庫整合測試使用隔離容器。
- 只使用 B 的資料庫及環境設定，正式 A 不發布。B 仍人工部署，不能把 integration 的舊內容當作最新 B。

## 驗收

322 項單元／介面測試、7 項部署測試、隔離 HTTP／資料庫測試、型別與編譯通過；本次修改檔案 lint 無錯誤。B 實際部署與畫面驗收結果另見對應 release record 及本機 `output/playwright/daily-portals-results.json`，不能以這份說明代替驗收證據。
