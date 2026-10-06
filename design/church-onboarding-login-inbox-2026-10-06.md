# 首次教會選擇與登入收件匣

Task: `wechurch-church-onboarding-20261006`；Owner 05 WeChurch；作者 Taupas。
Baseline: `400f0dd45326cbf8797effcd49b178ab450e39f3`。作者只改 server/shared/migrations/專用測試；前端由 Dora 整合。未接入共用 task_records，不冒稱已 claim。此文件不是發布或雲端資料變更授權。

成功條件：首次未有教會歸屬／歷史的新帳號只可自選一次；後續需真正系統管理員以 expectedChurch 核定。管理員清空教會不重開自選。並行初選只成功一項，同 requestId 重試不新增異動；同 requestId 不同教會回衝突。未知歷史教會需管理者處理，名字／title／一般小家長不產生 staff 收件權限。

首次登入或新教會歸屬立即建立永久待處理項目；未知／未選教會只給系統管理員待分派。arrival 只回 staff 範圍內的帳號 email 識別，不加電話／地址／生日；讀回時再驗會員當下教會。日常登入按台北日＋教會＋canonical member 去重，保留每人次數、首次／最後時間。未選／未知歸屬登入也記在 __unassigned 每日歷史，只有系統管理員可看／標已讀；初選後保留本次登入當下未分派歷史，透過新教會 arrival 告知到教會，下次真正登入才計新教會。沒有外寄 email/LINE。已結束日期可由各 staff 個別標已讀，今日仍累積而不可先標已讀。days 回傳全部未讀日期與最近 60 天已讀日期，沒有截斷未讀資料。逐日成員清單可逐頁查看；轉出會員姓名與 userId 遮蔽，歷史計數保留。

`GET/POST /api/me/church-onboarding`、`GET /api/me/church-login-summary`、`GET /api/admin/church-login-inbox` 的介面在 `shared/churchOnboarding.ts`。arrival cursor 為 UTC microsecond ISO + `_` + arrival UUID；limit 1..50。`PATCH /api/admin/church-login-inbox/:id/handle` 需版本 CAS。`POST /api/admin/church-login-inbox/days/read` 用 `{day,scope?:'church'|'unassigned'}`；`GET /api/admin/church-login-inbox/days/:day?cursor=<user UUID>&limit=20&scope=church` 回成員頁與 nextCursor。所有 route 私有 no-store、驗 canonical actor/context 與同源寫入；非本 router 路徑直接 next('router')，不影響公開 Bible 等 API。

staff 依當下 `admin` 或同教會 `senior_pastor/pastor/minister` 真帳號角色，不依職稱文字、grant 或群組 leader。唯讀用 repeatable-read snapshot；寫入鎖 actor role/user，動態撤銷及轉教會失效。管理員可選教會或在未選教會時查看全域未分派。

0029 migration 增永久選擇鎖、登入歷史 marker、affiliation source/requestId、receipt/daily/arrival/read tables；既有帳號不冒稱剛到教會，既有非空歸屬或清空歷史永久鎖定。`auth_sessions` save 的 DB trigger 同交易記錄 receipt/daily/arrival，以 Passport serialize 驗證過的 canonical sessionUserId/sessionVersion/receipt/time 為來源；紀錄失敗即整筆 session save rollback，不會先登入成功再默默漏通知。相同 receipt 並行 save 使用 affiliation advisory lock 後重查 owner；相同 owner 冪等、不同 owner拒絕。logout/session replacement/expiry 不會刪掉已提交通知。server controlled loginReceiptAt 保留原始台北日；JS callback/middleware 同 receipt 冪等核對，不將一般 API 輪詢當新登入。此 trigger 不受 Drizzle schema-only push 描述，正式來源必須實際跑 migration。

作者驗證：34 個 auth/session/security 單元測試（含 Google callback session 失敗案例）；node TS typecheck；專用 fresh SQL migrations + 真 HTTP fixture，涵蓋初選 race/replay、歷史 migration backfill、清空後永久鎖、角色隔離/撤銷、待處理 CAS、60 天外未讀可達、逐人成員 pagination、轉出匿名、登入次數去重、原日記錄、receipt 失敗同交易 session rollback、並行 receipt save、完整教會 alias 與匿名公開 Bible 回歸。只有合成資料，專用 loopback PG，沒有 UI 或 A/B 驗收。

未驗：真人 Google/LINE 端到端、手機/B 可見 UI、雲端部署、獨立 reviewer；作者檢查不自簽 QA。parent 需對最終整合 source 再跑完整 checks 與 wulang 獨立審查。B/A 原發布閘門保持。

## 作者 v2：登入有效期限與完整回歸

新 router 在精確路徑 filter 後使用共用 persistAuthenticatedSession；有效 cookie／store 到期日不代替 Passport expires_at。已過期／缺 expires_at／stale sessionVersion／canonical mapping 不符的新 GET/POST/PATCH 均401，不能選教會或處理通知；公開 Bible仍匿名200。沒有新 receipt 的真正舊制 session 沿用 deserialize version/canonical identity guard；帶新 receipt 的 save 另外由 DB trigger拒絕跨owner或不完整新身份。既有 legacy fixture刪除 version/binding 時也必須刪 receipt/time，保留原驗證與 reset 後401斷言，不弱化 trigger。

標準 integrity runner 先建fresh disposable DB/worker跑全部既有 HTTP，再建另一個全新 DB/worker跑 ONBOARDING_ONLY；每個finally分別 DROP／absence verified。ONLY及其他既有custom模式各跑單stage。這避免新iM牧者合成帳號影響 care 原 available=false案例，也避免舊auth spray故意用完同IP失敗預算後影響新登入測試；不reset limiter、不削弱任何原斷言。前版獨立QA發現與full HTTP失敗保留，舊版source/review失效；只有作者v2完整checks才可交同版review。
