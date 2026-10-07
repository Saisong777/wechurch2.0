# 首次登入：明確確認教會或目前沒有教會

Owner：05｜WeChurch；Dora 統籌；Taupas 實作；wulang 獨立驗收待完成。
Baseline：`01f3aeaace5f839f40d4b0bb087164f616f1c8d8`。前一版 B 驗收不能替代本版本驗收。A/B 發布仍依既有規約，本文件不授權發布。

成功條件：新登入者先明確選擇 API 提供的有效教會或「目前沒有教會」，再確認一次，才能進入任何登入後頁面；沒有預選值。不建立第四間教會，不把未選者預設為 iM。已存在有效歸屬、歷史鎖及系統管理員救援入口保留。明選沒有教會後可使用個人功能，沒有任何教會私有權限；重登入不再要求選擇。日後歸屬由管理者核定。

## 資料與並行

0030 只新增 `users.church_choice_none boolean NOT NULL DEFAULT false`，並以 check 約束 true 時 church 必須 NULL 且 choice lock 必須 true。既有 0029 完全不改；所有舊帳號不推斷成沒有教會，不重寫既有教會、lock 或歷史。沒有新表、依賴或假教會 catalog entry。

POST `/api/me/church-onboarding` 的 churchId 明確 `null` 表示沒有教會；缺值、空字串、UI sentinel 及未知教會均拒絕。選擇仍用 affiliation advisory lock/user FOR UPDATE，寫 lock、none flag 及 initial_choice event 同一交易。none event 是 NULL→NULL，requestId 保留；同 requestId 同選擇重試冪等，不同選擇409，另一 requestId 第二次403。管理者任何教會核定均清除 none flag、保留 lock；NULL→NULL 核定亦然，並建立 source=admin 的 NULL→NULL 分類異動事件，讓本人明確選擇被管理者調整可追查。舊 requestId 重試只回歷史收據和目前歸屬，不能覆蓋管理者後來決定。

Status reason 新增 `no_church`；context、管理者未分派列表及登入收件匣回 choiceNone，區別本人已確認沒有教會與待確認歸屬。這些帳號仍只有系統管理員可以在未分派範圍看到，任何教會 staff 不可藉此取得其他範圍身分。登入當時歷史仍保留原未分派 scope，不事後改寫。

## 使用流程

所有 SPA routes 均包在 AppLayout。登入狀態未解析、教會 context 未完成或錯誤、onboarding pending/error/缺資料以及 canChoose，均不 mount route children、主選單、教會切換或新手導覽。這包含個人筆記和深連結。只有選擇／重試／登出介面可見；教會 context 錯誤優先於 disabled query 的 pending，避免無法重試的轉圈。匿名公開頁保留。

已明選沒有教會的人，頂部顯示「目前沒有教會」；教會私有頁說明個人筆記、聖經可用及日後聯繫管理者，不再催首次選擇。原教會 API 的 server scope guard 保持；個人 owner API 保持原身分驗證，不把 UI gate 當資料授權邊界。

教會清單由 API 的集中 catalog 提供，前端不硬寫三家；本次沒有教會管理 CRUD。新增未來教會仍需後端 catalog、DB seed/constraints、SQL scope mapping 與 durable login trigger 按原規約一起擴充，不宣稱只改前端即可上線。

## 驗證及限制

作者執行 typecheck、元件與完整既有測試、deployment tests、lint/build，以及專用 loopback PostgreSQL 的 fresh migrations／真 HTTP 合成會員測試。HTTP 補 none/replay/race、空值/未知值拒絕、管理者 null→null/轉會、資料庫 check、重登入、私有 scope 拒絕與個人 notes 保留、staff 身分隔離；legacy migration fixture 斷言所有原帳號 none=false。AppLayout 深連結／pending/error/auth-loading 全阻擋，以及選擇取消、none 確認、API 未來選項與錯誤恢復皆有測試。

程式通過不等於實際 B UI 或 QA 通過。作者沒有操作 A/B、GitHub push、真會員或 localhost UI。手機/B 可見操作、獨立 QA 及發布皆由 Dora 另依最後實際 source 辦理。
