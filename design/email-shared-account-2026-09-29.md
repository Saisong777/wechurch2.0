# WeChurch 郵件系統與公用帳號接手

## 邊界

- 本輪只更新 B；不切換 A、不群發會員、不移轉既有網域。後續經 Sai 逐項核准，新增 WeChurch 專用寄件子網域、三筆 DNS、受限金鑰及單封指定收件人的連線測試。
- Google 公用帳號管理 Resend，網站使用受限 API key；Google 密碼不得放入 Railway、程式、日誌或 Git。
- From 使用經 Resend 驗證的教會網域；Reply-To 可設為教會公用信箱。管理帳號、寄件者網域及回覆信箱是三個不同設定。
- 2026-09-29 盤點 A/B：未設定 RESEND_API_KEY、RESEND_FROM_EMAIL、RESEND_REPLY_TO 或舊 Replit connector。B 的 DISABLE_OUTBOUND_EMAIL=1。此為當時設定快照，不代表個人 Resend 帳號沒有歷史資料。

## 工程修改

- 寄件者與回覆地址改成私密環境設定，移除舊 connector 與收件地址／完整供應商回應日誌。
- B 即使誤放憑證也禁止寄信，測試按鈕只產生本人預覽；未接服務不回報寄送成功。
- 群發預設不選任何人，管理員確認主旨和人數後才寄；只准現有會員地址，每人獨立寄送，單次最多100位、5附件、合計約2MiB。
- 請求限制、15秒供應商逾時、收件地址去重及同一未改動請求的冪等鍵；不自動重試不確定結果。
- 每日信尊重訂閱、偏好時間／時區及同一天寄送紀錄；手動測試不占用排程寄送紀錄。
- 信中連結留在所屬站台，模板跳轉只允許同來源；新增登入後管理訂閱／停止接收入口。
- 「服務已接受」與實際送達明確區分。
- 補齊下載紀錄及會員資料提醒的舊入口：相容通知類型、收件人確認／上限、附件上限、B狀態、部分失敗顯示及同請求重試識別。小螢幕姓名／地址上下排列。

## 帳號接手與後續門檻

1. 已完成：Sai 同意 Resend 登入條款並親自完成 Google 登入，進入 implanner139 團隊。
2. 已完成：保留仍有業務寄信的既有 Heaven Concept 網域與金鑰，沒有 claim、搬移或修改。未升級付費方案。
3. 已完成：經核准新增 mail.wechurch.online；手動新增三筆 DNS，原25筆皆未改動，四台 authoritative NS 讀回正確，Resend 顯示 Verified。
4. 已完成：經核准建立 WeChurch B Staging，Sending access 且僅限 mail.wechurch.online。金鑰只配置 Railway B 私密變數；一次性本機暫存已移除，A 沒有使用此金鑰。
5. 已完成：使用同一金鑰，從獨立維護流程向核准公用信箱寄出一封不含會員資料的文字測試信。Resend 接受並回報 Delivered；沒有放寬 B 的外寄防護，不等於 B 應用開放寄信。
6. 待本人驗收：Gmail 收件匣／垃圾郵件分類、完整郵件標頭 SPF／DKIM／DMARC，以及其他收件服務。Resend 顯示 Delivered 不代表主收件匣或本人已讀。
7. A 切換另行批准，保留可回復設定。不要以 B 預覽通過代替外寄或 A 上線。

## 未交付的範圍

- 沒有建立背景排程；目前 DAILY_FOLLOW_EMAIL_CRON_SECRET 未配置。儲存訂閱偏好不表示每天已有排程寄出。
- 沒有耐久寄信佇列；100人同步批次是保守上限，不是5000人群發能力。大量寄送需 outbox／worker、全域節流、重試、退信抑制及可恢復進度。
- Resend 接受 API 請求不等於送達。送達／退信 webhook、抑制名單與一鍵退訂仍待正式外寄前完成。
- 現有 `/api/webhooks/resend/inbound` 是舊自訂 secret 格式，不是 Resend 原生簽章 webhook，不得直接設定為 Resend 回呼。
- 私人筆記／關懷摘要現為本人主動訂閱內容；正式大量啟用前再確認資料最小化與收件通知隱私。

## 來源

- [Resend 冪等鍵](https://resend.com/docs/dashboard/emails/idempotency-keys)：有效期24小時；不同內容重用相同鍵會衝突。這不是永久 exactly-once 保證。
- [Resend 網域 Claim](https://resend.com/changelog/domain-claim)：轉移可能將網域自原團隊釋出，因此不可直接用新帳號搶移。
- [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email)：HTTP寄送格式、附件及冪等鍵。

## 驗收

- 來源 `7a2f4d3`；B `746de00e-9916-467b-b2b6-e1b71d169a53` SUCCESS，指紋 `d41872bd927b13ef263d21aa4b01b1d57087a42ce4e75391689778d1d9aa71b3`。
- 型別檢查、666功能測試、36部署保護測試、隔離PostgreSQL整合及正式打包通過；變更檔lint零錯誤，既有警告未全面清理。
- B實際API：預覽202且success=false／previewOnly=true，連結B同來源，群發503；沒有真實外寄。
- 320／390／1440px瀏覽器：本人預覽、預設0收件人、選擇後仍禁止B寄送、無橫向溢出、零頁面異常；另檢視深色畫面。
- 證據：`output/playwright/email/ea5dcea9-6ec7-4257-a233-488776396683/results.json` 與截圖；臨時測試會員／登入session清除，缺席回讀通過。
- A仍為 `a8a4db29-527f-4cc3-8d17-caed230f69cb`，沒有改變部署或憑證。GitHub-safe版本紀錄見 `design/releases/b-746de00e-9916-467b-b2b6-e1b71d169a53.json`。
- 公用帳號登入、DNS、真實外寄、實體手機與 A 切換均未完成，不包含在以上通過範圍。

以上為第一階段程式驗收的歷史範圍；帳號與 DNS 狀態以下列接手驗收為準。

## 公用帳號接手驗收

- B 設定已套用，部署 `631fc550-a45c-4db9-91ca-f3eff21da2ee` SUCCESS；本次沒有修改應用程式碼。
- 寄件者：`WeChurch | iM行動教會 <notifications@mail.wechurch.online>`；Reply-To：`implanner139@gmail.com`。
- Resend 金鑰名稱 `WeChurch B Staging`，ID `b34a9f6b-7918-4c9f-8921-8734c38aa3a9`；文件只記管理識別，不記金鑰內容。
- 單封測試信 ID `01a0ec6f-6ac5-7ad4-ab07-5686d5b39a25`，2026-09-29 17:12 台灣時間，收件人共1位；UI 顯示 Sent / Delivered，From 與 Reply-To 相符。
- 實際 B 容器已讀到三項 Resend 設定，APP_ENV=staging、DISABLE_OUTBOUND_EMAIL=1。A 的變數內容雜湊與部署 ID 前後一致。
- 設定後再跑 B 驗收：320／390／1440px本人預覽、B同來源連結、預設0收件人、群發503、無橫向溢出、零頁面異常；測試帳號與session已清除。
- 驗收輸出：`output/playwright/email/91fde971-f65b-4f5e-9a39-dc33cdba52f2/results.json`。此瀏覽器流程沒有寄信；另行核准的供應商連線測試僅1封。
- 保留門檻：B不開放會員外寄；A切換、背景排程、退信抑制／webhook、耐久佇列、一鍵退訂、追蹤與隱私最小化、實體收件匣／標頭確認仍未交付。
