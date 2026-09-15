# 同工測試與 LINE 身分銜接

## 本次驗收

- 可重建來源：`b77dbb6b00099e7918f7c79f48354c884a661346`；分支 `codex/b-checkpoint-2026-09-15-invites`。發布紀錄見 `design/releases/b-43a342c3-1e43-4866-90ad-06e846a3f3c5.json`。

- Railway B：`43a342c3-1e43-4866-90ad-06e846a3f3c5`，443 檔，指紋 `ef75eb2ee8866e0158de4efa2e05a5d97b0ea5b4aea4ee6450512ef8eaaceaae`。
- 普通新帳號完成實際 B 註冊與新 Session 登入；申請中不可讀小組，組長核准後可讀但不能產生組長邀請；移出後不能讀。自動驗收會員已移出小組，帳號保留為明確標記的測試資料。
- 瀏覽器實際點擊「接受邀請 → 首次使用／已有帳號 → 登入 → 保留小組邀請」通過；320、390、1440 px 無橫向溢出。
- 初次部署 `b669f762` 的 `no-referrer` 造成瀏覽器表單送出被 Origin 檢查拒絕；改用 `same-origin` 後完成驗收，不放寬跨站拒絕規則。此例確認 API 驗收不能代替瀏覽器表單驗收。
- 型別、單元、部署/加密、隔離 DB/HTTP、LINE 模擬身分整合、build 均通過；公開分享與私密內容界線的 B 驗收通過。
- 尚未實測真實 LINE OAuth、實體 iPhone LINE WebView；A 未改動、未搬會員資料。

## 邊界

- 本次只發布 Railway B，A 的程式、會員與 LINE 設定不改動。
- 使用既有小組邀請、加入申請與組長審核，不建立第二套小組權限。
- Email 是現在可用的測試入口。LINE 未設定、未開啟功能旗標或驗證失敗時，不顯示可用的 LINE 登入按鈕。
- 不把 B 的資料庫、角色、Session、密碼、禱告或牧養資料搬到 A。

## 同工流程

1. 小組長在「小組 → 小組成員」產生邀請碼，複製新增的邀請連結，私下傳給受邀同工。
2. B 連結包含七天有效的簽章，不包含管理員密碼或全站邀請主碼。憑證放 URL fragment，頁面讀取後移除，不進入一般 HTTP access log。
3. 同工接受邀請，建立自己的 Email 帳號，或在已有帳號時登入。密碼至少八碼。
4. 小組邀請在同分頁登入期間保留，登入後送出加入申請。未經小組長核准，不能讀取小組內容。
5. 小組長核准後成為一般成員。一般成員不能建立小組、產生組長邀請或取得管理權限。
6. 移出小組後，組內讀取權限立即收回。邀請主碼更換會撤銷所有已發出的 B 入站簽章。

注意：重產小組邀請碼會使舊碼不能加入小組，但不會提前撤銷已核發的 B 入站憑證；後者最長七天。暫不提供逐人撤銷 B 入站憑證。分享連結仍須保密。

## LINE 開通前置條件

LINE Developers Console 必須由 Sai 登入教會管理帳號。目前尚未取得已登入的 Console，不能確認 Provider、A Channel、Official Account 的關係。

在 Console 驗證後才配置以下項目，真實值只進 Railway secrets，不能提交 GitHub：

- `LINE_PROVIDER_ID`：教會 Provider。
- `LINE_PROVIDER_CHANNELS`：JSON 字典，明確將 A、B Channel ID 對應到該 Provider。不可只憑名稱猜測。
- B 使用獨立 Login Channel ID 與 secret，`STAGING_LINE_CHANNEL_ID` 鎖定 B Channel。
- `LINE_CALLBACK_URL` 必須是 B 的 HTTPS 網址加 `/api/line-login/callback`。
- 確認無誤後設 `STAGING_LINE_LOGIN_ENABLED=1`，開啟 B 的 `line_login_beta`。
- 若 Channel 為 Developing，測試者需要 Console Tester 身分；為避免要求每位同工申請開發者帳號，可評估 Published Login Channel 加本站受邀門檻。發布前需確認 LINE 後台要求與授權頁。
- 正式 LINE 訊息推播、webhook、Email 與排程仍禁止從 B 送出。

驗證必須包含 iPhone LINE 內建瀏覽器、外部 Safari/Chrome、拒絕授權、過期 state、錯誤 audience/nonce，以及既有會員綁定衝突。只有本機自動化不能代替真實 LINE OAuth 驗收。

## A 站啟用與遷移

同 Provider 的 LINE 使用者識別碼可以相同，A/B 仍維持獨立本地會員 ID。使用者首次到 A 需再按 LINE 登入，另一個 Channel 可能再次要求授權；這不等於填表重註冊。

本次已補上「只有後台明確列入同 Provider 的 Channel 才能延續既有綁定」的程式保護。沒有 Provider 對照時，維持拒絕跨 Channel 的預設。

這不是資料轉移工具，也尚未執行會員搬移。真正轉移前必須另外完成：

1. 取得本人同意，決定只移身分與必要個人資料；清楚排除測試內容。
2. 以已驗證的 Provider + LINE subject 比對，不能以姓名、照片或 Email 猜測同一人。
3. A 已有帳號的衝突列出供本人驗證，不自動覆蓋；新會員也不繼承 B 的權限。
4. A 的加密備份、dry-run 對照報告、來源 ID 對應、重複執行保護、回滾及人工核准。
5. 經核准才執行 A 的一次性身分匯入；不得在 B 登入時直接寫入 A。

## 驗證與還原

- `npm run staging:deploy` 執行 typecheck、unit、部署/加密測試、隔離 DB 的權限/LINE 身分整合測試及 build。
- `node scripts/verify-testing-invitations.mjs` 僅能連 B：建立或沿用「同工測試小組」，產生新邀請，建立標記的普通驗收會員，測試加入審核與移出。會輪替該小組邀請碼，不能當無副作用的健康檢查。
- 該腳本將可轉交同工的連結存入 ignored 的 `artifacts/railway-staging/coworker-invitation.txt`。檔案不包含管理員帳號密碼。
- `coworker-invitation.json` 與 `invitation-test-account.json` 是私密驗收產物，不提交 GitHub。
- 本次無 DB schema 變更；退回前版程式不刪除新增的普通帳號或小組。

## 官方依據

- [同 Provider 身分與 Channel 限制](https://developers.line.biz/en/docs/line-login/getting-started/)
- [LINE 授權同意](https://developers.line.biz/en/docs/line-login/managing-authorized-apps/)
- [網站登入與 callback](https://developers.line.biz/en/docs/line-login/integrate-line-login/)
