# WeChurch A｜意見反饋與新手導覽發布

Sai 本輪直接升A授權已收到，2026-10-04台灣22:18正式SUCCESS。版本保持V3.15。

A https://www.wechurch.online；deployment `5d38a2c5-af31-4931-b4a7-78bc56e8e3ab`。與B現役 `9d374e11-6160-44a9-8061-3c78ff88d7c2` 相同631檔不可變來源，fingerprint `8bca1bbdeb6a66f57f7dd30a2bb7761603d7b688b247cdaed4eb00ff5d9c43ab`；來源文書cbeb7b6，最後產品改動47f1054。

- 會員意見反饋、本人進度／管理回覆、管理端原文及AI整理欄位、人工狀態／順序／回覆、分頁JSON匯出已發布。
- 使用說明、Google登入好處與六步快速導覽（略過／重開／帳號隔離）已發布。Chrome實際A/help與A/feedback畫面、導覽重新開啟通過；公共健康與頁面200／CSP、匿名本人及管理API401通過。
- 新鮮A完整加密備份與110表隔離還原通過；只有0025加法migration，完整26 hash匹配、原25 full rows與既有app CRUD權限保持。
- 發布後109原表full digest、原3937 app_events全rowhash、NULL0保持；只接受authenticated六位微秒cutoff之後+1筆telemetry。116課表／85published／31draft完整hash、uploads1／reference30 bytes、A設定／volume全部保持。B部署／631來源／設定／volume／DB基準與worker config保持，沒有搬B資料覆蓋A。
- 原生最後B版本139檔／800測試、47發布檢查、HTTP完整性、型別與建置已通過；本輪沒有產品source改動，A實際建置SUCCESS後逐631bytes核對。Dora統籌；soli備份還原、taupas固定A migration／postverifier、wulang精確工具與實據獨立複核。共用task registry對活動repo uncovered，不冒建task ID；沿官方continuity w_bf7cc27ab045。

## AI啟動與真實會員驗收

A AI背景服務尚未安裝：自動核准審查在執行前拒絕，要求明確授權將會員勾選AI同意的反饋 category/title/body/location/urgency 傳給外部ChatGPT訂閱服務。已提供payload／目的地／每60秒持續到停用之确认，等待Sai；未繞過。程式及管理欄位已備妥，人工可閱覽；不可宣稱A AI已處理。B同一v3已經正常排程完成明確合成fixture並精確清除，不能算A真會員驗收。

本人Google登入後「送出→本人歷史→管理回覆」、帳號導覽隔離與實體手機待驗。先前自動核准審查拒絕代點Google第三方登入：缺少這次代登入授權且可能存取私人帳號；未偽造session或改權限。原10/5最終增量與10/6全員接續A待辦保持；此發布不代表資料移轉完成。

入口：[意見反饋](https://www.wechurch.online/feedback)、[使用說明／快速導覽](https://www.wechurch.online/help)。完整安全證據於Mini `~/Codex-Projects/output/wechurch-a-feedback-onboarding-2026-10-04/`，含a-live-tour.png與a-live-feedback.png；只公開aggregate，不將備份密文、key、憑證或會員正文存Git。
