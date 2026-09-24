# B 站 Google 註冊與登入

## 範圍

只更新 Railway B。A 的程式、資料庫及 Google 登入憑證不變。
本次不匯入 Firebase 會員或筆記，不還原已清除的測試會員。

受邀使用者進入 B 後，按「使用 Google 帳號繼續」。首次登入建立一般會員，
再次登入沿用 Google 的固定身分；不因電子郵件相同就自動合併別人的帳號，
不自動授予管理員權限。舊系統移轉應以經驗證的 Google provider UID 對照，
不能只以電子郵件判定身分。

## 必要設定

- Google Web OAuth client：WeChurch B Staging，獨立於 A。
- 回呼：`https://wechurch-staging-staging.up.railway.app/api/callback`
- `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`：只存 Railway B 私密設定。
- `STAGING_GOOGLE_CLIENT_ID` 必須等於 B 的 `GOOGLE_CLIENT_ID`。
- `STAGING_GOOGLE_LOGIN_ENABLED=1`、`AUTH_REGISTRATION_MODE=google-only`。
- 保留 B 原有的邀請、獨立資料庫、session secret 與禁止外部發送設定。
- 權限僅 `openid email profile`，不要求 Gmail、Drive 或離線存取。
- 新增 migration `0012_google_account_links`，需備份後才執行。

前端向 `/api/auth/options` 取得實際設定；設定失效時不偷偷回退成信箱註冊。
後端也會拒絕 Google-only 模式的信箱註冊請求。OAuth 啟用 state 與 PKCE，
回呼固定為已驗證網址，不從外部 Host 標頭推導。

## 發布及驗收

以 B 已部署版本 `b-2026-09-15-43a342c3` 為基礎，在獨立乾淨工作目錄建立功能分支，
不把原工作目錄尚未整理的其他修改一起發布。

1. 保存 B 資料庫、上傳檔與私密設定的加密備份，金鑰在 Git 外獨立保存。
2. 套用 migration，再執行 `npm run staging:deploy` 的發布檢查。
3. `npm run staging:verify` 在 Google-only 模式改跑無假會員的驗證。
4. 另用真實 Google 帳號完成瀏覽器登入、登出及再次登入；不能把 OAuth 轉址成功當成登入成功。
5. 核對新會員不重複、未授予管理員、A deployment 未變，並保存 B 版本指紋。

無假會員驗證會檢查邀請限制、信箱註冊關閉、獨立回呼、基本權限、偽造／取消回呼拒絕，
以及前後會員數不變。它不取代真實 Google 同意與登入驗收。

## 回復與限制

GitHub 保存程式與安全的版本指紋；不保存 OAuth JSON、session、備份金鑰或資料庫內容。
此次備份在本機私密目錄，尚不能稱為異地耐久備份。
回退程式須同時評估 Google-only 設定；不得刪除已建立的 Google 身分對照或覆寫新會員資料。
尚未執行 Firebase 資料匯入、A/B 會員移轉或 A 正式發布。
