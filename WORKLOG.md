# WeChurch 2.0 優化工作紀錄

> 這份文件是「我們上次做到哪」的續命包。每次打開專案先看這個。

---

## 背景

這個網站歷經 Lovable → Replit → Gemini + GPT 多輪 AI 輔助迭代而成，
2026-04-22 做了一次完整的安全與架構體檢（見 [分析結果](#分析結果快照)）。

**決定的方向**：不砍掉重練，走**漸進式強化**（Phase 1 → 2 → 3）。
**原因**：架構本身沒問題（React + Vite + Express + Postgres + Drizzle），
痛點是戰術層級的（缺 auth 檢查、god file、沒測試），值得逐步修，不值得重寫。

---

## 三階段路線圖

### Phase 1 — 止血（1 週內）

- [x] `/api/users` + `/api/user-roles` 加 auth（`server/routes.ts:3076-3092`）
- [x] `/api/user-roles/:userId` PUT 加 admin role check（`server/routes.ts:3094-3102`）
- [ ] OAuth callback 改環境變數（`server/replit_integrations/auth/replitAuth.ts:77`）
- [ ] `tsconfig` 啟用 `strict: true`（擋新增的 `any`）
- [ ] `npm audit` 處理 high 風險

### Phase 2 — 看得見（2–4 週）

- [ ] 接 Sentry
- [ ] 關鍵路徑測試：登入、開 session、AI 報告
- [ ] DB 補缺的 index（`participants.sessionId`、`prayers.createdAt`、`prayerComments.prayerId`）
- [ ] AI per-user 月額度 table
- [ ] GitHub Dependabot

### Phase 3 — 重整（1–3 個月，邊做新功能邊做）

- [ ] `server/routes.ts` 拆成 `routes/{sessions,prayers,ai,auth,users}.ts`
- [ ] `replit_integrations/` 改名為 `auth/` + `lib/`
- [ ] GDPR 帳號刪除 endpoint
- [ ] AI fallback（OpenAI ↔ Gemini）
- [ ] 禱告牆真匿名（不存 userId）
- [ ] 禱告、筆記欄位加密
- [ ] CSRF token
- [ ] 登入 endpoint brute-force 保護

---

## 進度紀錄

| 日期 | 做了什麼 | 備註 |
|---|---|---|
| 2026-04-22 | 完成安全 + 架構體檢，定下三階段路線 | 見下方「分析結果快照」 |
| 2026-04-23 | Phase 1 第 1、2 項：3 個 user 相關 endpoint 補上 auth + role 檢查 | PR: `phase-1-auth-fixes` |

---

## 分析結果快照（2026-04-22）

### 🚨 最緊急（已排入 Phase 1）
1. `/api/users` + `/api/user-roles` 無認證 → 任何人可撈全站 email / 生日 / 地址
2. `/api/user-roles/:userId` PUT 無授權 → 任何人可把自己升 admin

### 🔴 高風險
- AI 成本無上限
- Prompt Injection（使用者筆記直接進 AI prompt）
- 無帳號刪除 / GDPR 缺失
- 禱告牆「匿名」還是存 userId，可反查
- AI 送第三方未告知使用者

### 🟡 中風險
- `server/routes.ts` 4996 行 god file
- DB 缺 index
- 無 fallback（OpenAI/Gemini 一掛整個功能壞）
- AI 輸出未驗證直寫 DB
- Session `sameSite: lax`（應 strict）
- 檔案上傳無 MIME 驗證
- Webhook 只比字串、無 HMAC
- 所有狀態變更缺 CSRF token
- 登入無 brute-force 保護
- 測試只有 1 個檔
- `console.log` 當 log（重啟就消失）
- npm audit 28 個漏洞（13 high）

### 🟢 做得好
- Drizzle ORM 參數化查詢
- bcrypt + timingSafeEqual + 遺留密碼自動升級
- DOMPurify 用在 admin 信箱
- 基本 rate limit 有
- `/api/health` + `/api/health/detailed`

---

## 如何延續工作

**每次重新開始時**：
1. 打開這個檔案，看「進度紀錄」最後一行
2. 看「三階段路線圖」未打勾的最上面項目
3. 跟 Claude 說「繼續 WORKLOG 上的 Phase X」

**每完成一項**：
- 在路線圖對應項目打勾 `- [x]`
- 「進度紀錄」加一行（日期 + 做了什麼 + PR 連結）

---

## 相關檔案

- `~/Desktop/開啟 WeChurch.command` — 雙擊開啟 VS Code + Claude Code
