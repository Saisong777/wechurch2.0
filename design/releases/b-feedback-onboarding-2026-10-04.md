# WeChurch B 意見反饋與新手導覽（2026-10-04）

Mini local-only 接手紀錄。Primary Owner 05｜WeChurch；Dora GPT/Codex 統籌，taupas 實作，wulang 獨立複核，soli 備份還原及持久紀錄核對。共用 Workspaces task registry 對此活動 repo 未接入，不宣稱有登記任務 ID。

B 最終部署 `9d374e11-6160-44a9-8061-3c78ff88d7c2` SUCCESS；631 個來源檔全部實際雲端 byte hash 相符，fingerprint `8bca1bbdeb6a66f57f7dd30a2bb7761603d7b688b247cdaed4eb00ff5d9c43ab`。native record 見 `b-9d374e11-6160-44a9-8061-3c78ff88d7c2.json`。版本保持 V3.15。

## 功能與驗證

- 會員意見反饋、本人進度／管理回覆、管理端原文／AI 分類摘要與證據／緊急及重要程度／建議處理順序、分頁 JSON 匯出。人工狀態、順序和回覆保持獨立。
- 使用說明、Google 登入好處與六步快速導覽；可略過、重開，草稿和完成狀態依帳號隔離。
- 前端 v3、後端 v2、worker v3 精確版本各有 wulang 實質獨立複核。原生最後檢查 139 檔／800 測試、47 發布檢查、HTTP 完整性、型別與建置通過；Python worker 另有 9 項獨立驗證。
- 匿名 Chrome 已實際核對導覽六步／重開／略過、反饋草稿返回、登入好處；320／390／1440 寬度無橫向溢出。尺寸測試不等於實體手機驗收。
- B 只新增 `0025_member_feedback`，全部 26 migrations hash 相符，原 25 rows 保持。課表 116 筆／85 published 及完整內容保持。
- B worker v3 四檔 aggregate `f39f6abdf174f8fdfef3bcecd89bcea3b0ba92525f430aca6210e4646fc78e2c`；Mini LaunchAgent `com.sai.wechurch-feedback-ai-b` 每 60 秒，載入的 arguments／PATH／runtime 與 schema hashes 已核對，沿用既有 ChatGPT 訂閱，不走付費 API fallback。實際 model selection `codex-cli-default`，resolved model 未回報。
- 正常背景 tick 完成唯一明確合成 fixture：ready、嚴格 AI schema／逐字 evidence／source hash 通過；人工 status=new、priority=P2、reply 空白、version/sourceVersion=1 保持；未建立登入、session 或角色。fixture 最後精確清除、user／feedback／events absence 確認。
- 13:51:24 UTC 最後唯讀核對：109 原表完整 hash 保持，原 3468 筆 app_events 全內容 hash 保留，只增加 9 筆嚴格晚於 authenticated 六位微秒 cutoff 的紀錄，NULL 0。原 strict 全表 fail 保留；不宣稱 app_events 全表內容未增加。新兩表回到 before 0/0 全內容 hash；原 uploads 1 檔與 30 讀經資源每個 byte hash 相同，settings／volume 保持。

## 正式站與待辦

A 本輪程式／DB migration／worker 未更新；仍 `35cca5b7-042f-49e6-8a49-5bdab3750ec7`，611 檔來源、25 migration、課表、設定及 volume 已唯讀核對保持。A/B 各自完整加密備份與全表隔離還原通過，備份不包含於 GitHub；A 升版須新的 Sai 批准及新鮮備份門檻，不以 B DB 覆蓋 A。

本人 Google 登入後的會員送出／本人歷史／管理員回覆 UI 及實體手機仍待驗。自動核准審查拒絕代點 Google 登入，理由為可能存取私人帳號且缺少本次代登入授權。未繞過、不偽造 session。

原 10/5 最終增量資料與 10/6 會員接續的移轉待辦保持，不以本輪功能完成代替。

完整安全證據與各版複核：`~/Codex-Projects/output/wechurch-feedback-onboarding-2026-10-04/`。本記錄只含成果與限制，不含會員原文或憑證。
