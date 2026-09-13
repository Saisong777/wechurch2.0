# WeChurch 分享牆獨立單元

## 已確認的使用流程

本次採既有 App 的導覽調整，不更換視覺風格或加入第二套導覽。依 Sai 確認的資訊架構，區分個人操練、全站分享與小組交流。

- 主要入口依序為今日、聖經、禱告、分享牆、小組，手機與桌面使用相同來源。
- `/share` 保留為相容入口，直接開啟 `/grace-record` 個人禱告，不再經過單一卡片選擇頁。
- `/walls` 直接開啟可用的公開牆；靈修與代禱分頁維持分開，不混合成一條動態。
- `/devotion-wall`、`/prayer-wall` 歸屬分享牆，不能標示為禱告子頁；原分享連結仍有效。
- 小組使用共用導覽，小組選擇器保留在內容區；關懷可由首頁與手機選單進入。
- 分享牆的首頁捷徑移至小組旁，不再嵌於個人禱告區。
- 帳號設定、工具、管理依原有位置與角色規則呈現，不增加底部導覽。

## 不變的界線

沒有變更資料庫、API、授權、匿名或保存期限。個人筆記與禱告不自動分享；公開分享不等於同意牧養追蹤；小組內容不自動公開。既有功能開關仍適用。

## 驗證與發布

- B 網址：https://wechurch-staging-staging.up.railway.app/
- 程式來源：`302acc7822578c74eae07ea8dd2e1aadac3df9b5`。
- B 部署識別：`e046c9cc-5fce-42ee-b2b9-ef3e7a610bbc`；429 檔預期指紋：`51fe843c39f77a647407b2955afe5539af0c3bd7fdff9139723693239b5e2dba`。
- 功能分支：`codex/independent-sharing-walls`；草稿 PR #6，不是正式發布批准。
- 修改前救援標籤：`b-2026-09-13-3fb876e4`。
- B 版面／操作驗證腳本：`ops/verify-daily-portals.mjs`；證據只在被 Git 忽略的 `output/playwright/independent-walls-results.json`，不把個人畫面上傳公開 repo。
- 部署已 SUCCESS，health 與遠端指紋回讀一致。部署結果與實際 SHA-256 請以本版 `design/releases/` 紀錄及 `release-manifest.json` 為準；`node ops/verify-b-checkpoint.mjs` 可驗證取回的程式。
- 重建時用 Node 22、`npm ci`、`npm run typecheck`、`npm test`、`npm run test:deployment`、`npm run test:integrity`、`npm run build`；整合測試使用隔離資料庫。
- GitHub 保存程式、migration、指紋與說明。B DB、上傳檔、密碼必須另行加密備份；不能以取回程式代替完整資料還原。
- 只發布 B，A 與 main 不更新；integration 仍未合併，請從本次救援標籤或功能分支取回版本。
