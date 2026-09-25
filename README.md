# WeChurch B 站可重建版本

## 目前分支狀態：B 已恢復，聖經整合可預覽

2026-09-26 已將原 B 網址切至替代執行服務，保留原資料庫、檔案 volume、
登入設定與會員內容。正常發布流程亦已驗證成功，A 未發布。

- 現役 B 服務：`fef7af7c-e3c3-4977-8294-c3a123a4242e`。
- 已驗收部署：`729f62d8-6556-4456-a5e1-5abee0442588`。
- 487 檔指紋：`34c72177c8b07be6033774e3fbf4401d2df6f120b7f32bffea02039fa68df821`。
- 原網址、16 組研經 API、26 個資料／授權檔校驗、隱藏路徑 404、私人資料權限及 Google 安全流程已驗證。
- [精確來源與發布紀錄](design/releases/b-729f62d8-6556-4456-a5e1-5abee0442588.json)
  與 [恢復及後續發布方式](design/railway-b-recovery-2026-09-26.md)。

`release-manifest.json` 保存程式指紋，`bible-study-asset-manifest.json` 只保存
資料資產名稱與校驗值，不含資料內容。沿革見 [聖經整合紀錄](design/bible-integration-2026-09-25.md)，
手機尺寸／桌面操作範圍見 [UI 驗收](design/bible-ui-acceptance-2026-09-25.md)。
實體手機及 Sai 最終預覽確認仍待完成。舊服務的底層異常未由 Railway 證實；
[支援草稿](design/railway-container-support-2026-09-25.md) 尚未送出。

下方保留上一個 Railway B 已驗收版本的基準紀錄。不是 A 正式發布，也不包含資料庫、上傳檔案或密碼。原工作目錄中未整理的其他資料沒有被刪除。

本版套用三人並肩 Logo 與 Together UI/UX。設計與驗收範圍見 [更新紀錄](design/ui-ux-refresh-2026-09-13.md)。

保留同工測試邀請與小組邀請跨登入返回；2026-09-24 改為 Google 註冊／登入，真實登入已驗收。見 [Google 登入紀錄](google-staging-registration-2026-09-24.md)。LINE 未啟用，沒有將 B 會員搬到 A。

## 歷史基準版本（不是目前部署）

- B 網址：https://wechurch-staging-staging.up.railway.app
- B 部署：`6f2da44e-0757-4b1f-bcfb-c1ea04a7f110`
- 程式指紋：`be78c5e3595537e23186b9db465f0ffaf2a74bc69a47f8abdc5d79d1e3dff1d1`
- 上一版包含 479 個程式檔案；應取回原驗收提交重建，不用本候選版取代舊版指紋。
- 2026-09-25 每日靈修筆記改為同頁展開，儲存後留在原位，可隨時上滑閱讀；保留底部儲存／分享與草稿保護。見 [頁內筆記驗收](inline-note-audit-2026-09-25.md)。此項取代每日靈修的彈窗，其餘筆記入口暫保留原形式。
- 2026-09-25 移除手機外層固定高度與衝突捲動設定，外觀選擇移至手機選單最上方；見 [手機捲動與外觀驗收](mobile-scroll-audit-2026-09-25.md)。實體 iPhone 手勢仍待驗收。
- 2026-09-25 靈修筆記採桌面置中、手機滿版；底部「儲存（自己看）」與「分享」，可選所屬小組或公開靈修牆、選擇部分或全部內容，移除編輯器 AI 分析；見 [儲存與分享驗收](note-sharing-audit-2026-09-25.md)。本次取代先前頂端儲存配置。
- 2026-09-25 每日靈修改為經文／靈修／禱告分頁、可調字級及分段原文；見 [閱讀頁驗收](reader-audit-2026-09-25.md)。
- 2026-09-25 已將 9/24 快照的 62 位舊會員、105 篇筆記與 1,114 筆打卡匯入 B；見 [匯入與剩餘門檻](im-bible-b-import-2026-09-25.md)。A 尚未切換。
- 2026-09-25 新增明亮／暗色／跟隨裝置，見 [外觀驗收](appearance-2026-09-25.md)。
- `node ops/verify-b-checkpoint.mjs` 可以逐檔核對版本；不需要資料庫或密碼。
- `design/releases/` 保存發布紀錄時，`sourceCommit` 指向確切來源提交，不以日期或分支名稱代替。

## A / B 工作規則

1. `main` 只用於 A 正式站；`integration` 是 B 的整合分支；功能修改使用獨立分支。目前 B 仍採人工部署，尚未接上 GitHub 自動部署。
2. 本分支是固定的救援基準，不是自動升級 A 的入口。不得直接合併 main。
3. 開始修改前已有 GitHub 基準；修改過程小步提交到功能分支，不能等 B 全部測完才保存。
4. CI 通過後才部署 B。每次 B 發布記錄 commit、migration、部署 ID 與實際版本指紋。
5. B 驗收與 Sai 明確確認後，才準備 A 發布。只發布程式與相容的 migration，絕不把 B DB 覆蓋 A。

## 從 GitHub 重建

1. 取回本分支或固定 B 標籤，在新的目錄核對 `release-manifest.json`。
2. 使用 Node 22、`npm ci`，執行 `npm run typecheck`、`npm test`、`npm run test:deployment`、`npm run build`。完整驗收另以一次性 PostgreSQL 17 跑 `npm run test:integrity`；目前 GitHub 沿用既有 CI，尚未加入這個資料庫測試。
3. 建立或選定 Railway 的 B 專用環境、B 資料庫及 B 上傳 volume；不可選 A。實際密碼從另行保管的位置取回，`.env.example` 只列範本。
4. B 的環境需設定獨立 `SESSION_SECRET`、`DATABASE_URL`、`STAGING_ACCESS_CODE`、`APP_ENV=staging`、正確 B environment/database identity、`PUBLIC_BASE_URL`、`UPLOAD_ROOT=/data`，並禁止外部發送。
5. 資料庫與上傳檔先在隔離位置還原、核對版本及引用，再切換 B。程式回退不會自動回復資料，不能直接把舊備份覆蓋正在新增的資料。
6. 部署本標籤的確切版本；回讀 B 版本指紋、health，測試登入、讀經、筆記、分享、權限及手機操作。

## 備份邊界

目前 GitHub 只保障程式可取回。DB／上傳檔／設定的完整異地加密備份與聯合還原還需要另外完成，見 [加密備份操作](design/staging-encrypted-backup-2026-09-13.md)。Git 分支與版本標籤不等於資料備份。

本次檢查針對待提交檔案及目前可用密鑰比對，不宣稱整個歷史完全沒有敏感資訊。既有 Git 歷史不重寫；舊的公開郵件設定與已存在的歷史檔案若需移除，另做專門處理。
