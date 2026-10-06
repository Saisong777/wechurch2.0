# 管理者刪除與恢復小家

本次使用既有 `archived` 狀態實作可恢復的刪除，不新增 schema。小家管理一般名單提供刪除；已刪除區亦收納舊版封存的小家，可具名確認恢復。

`DELETE /api/life-groups/management/:id` 與 `POST /api/life-groups/management/:id/restore` 均要求 JSON `{ version, confirmName }`，名稱須與已鎖定的小家完整相符。沿用原本教會級小家管理範圍與系統管理員能力；指派的小家長、個別小家管理範圍及一般成員不能刪除或恢復。

刪除前一般在籍成員必須先轉家或退出。沒有綁定帳號的在籍紀錄亦阻擋刪除。保留小家長／牧者指派、會員、分享、留言、關懷、筆記與讀經進度；只改小家的 lifecycle、is_active、is_listed、version、updated_at，撤銷邀請並新增管理異動紀錄。恢復後仍未公開，不恢復舊邀請。

設定表單僅提供運作中與暫停，後端拒絕透過一般 PATCH 跨入或離開 archived 狀態。版本衝突或重複刪除／恢復回 409；一般成員尚在、NULL 成員資料、權限或名稱錯誤均不修改資料。刪除和加入／轉家沿用同一小家 row lock，因此不會部分修改。

本機契約及 React 測試涵蓋取消、完整名稱、失敗、忙碌、防重送、成員阻擋與恢復。`scripts/verify-family-delete-http.ts` 由既有 disposable loopback integrity runner 呼叫，使用合成資料核對真實 HTTP、SQL、版本競爭、權限、資料保留及恢復；本機 SQL 測試不取代 B 的使用者可見驗收。

本說明未授權刪除任何既有小家；部署與 B 實際驗收由 Dora 統籌另行核對。
