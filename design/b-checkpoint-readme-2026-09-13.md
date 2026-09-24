# WeChurch B 站可重建版本

這個分支保存 Railway B 測試站通過驗收的程式。不是 A 正式發布，也不包含資料庫、上傳檔案或密碼。原工作目錄中未整理的其他資料沒有被刪除。

本版套用三人並肩 Logo 與 Together UI/UX。設計與驗收範圍見 [更新紀錄](design/ui-ux-refresh-2026-09-13.md)。

保留同工測試邀請與小組邀請跨登入返回；2026-09-24 改為 Google 註冊／登入，真實登入已驗收。見 [Google 登入紀錄](google-staging-registration-2026-09-24.md)。LINE 未啟用，沒有將 B 會員搬到 A。

## 版本識別

- B 網址：https://wechurch-staging-staging.up.railway.app
- B 部署：`38b8a5c0-7b91-43fd-bf0f-d4222f163408`
- 程式指紋：`884d4f1cfad63f7514cab31aecadefe096a399e4caaf09980fb16c278d3536b4`
- `release-manifest.json` 列出實際 B 部署的 454 個檔案與 SHA-256。
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
