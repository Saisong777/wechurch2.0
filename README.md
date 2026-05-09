# WeChurch 2.0 — 我們就是教會

一個為基督教社群設計的全功能平台，整合聖經研讀、禱告分享、小組互動與 AI 輔助靈修。

---

## 功能介紹

| 模組 | 說明 |
|------|------|
| **聖經閱讀** | 多版本聖經，支援 TTS 朗讀 |
| **Jesus Timeline** | 互動式聖經時間軸探索 |
| **靈修計畫** | 個人讀經計畫，附每日提醒 |
| **Soul Gym** | 即時協作小組查經 + 隨機分組 |
| **禱告牆** | 匿名發布禱告請求，社群互動 |
| **Icebreaker** | 小組破冰遊戲與隨機分組工具 |
| **靈修筆記** | 7步驟靈修格式的記錄系統 |
| **AI 分析** | OpenAI/Gemini 驅動的查經報告與靈修分析 |
| **筆記本** | 整合所有筆記，支援匯出 |

---

## 技術架構

```
前端：React 18 + TypeScript + Vite + Tailwind CSS + Shadcn/UI
後端：Node.js + Express.js
資料庫：PostgreSQL + Drizzle ORM
AI：OpenAI API
部署：GitHub -> Railway
```

---

## 快速開始

### 前置需求

- Node.js 20+
- PostgreSQL 14+
- npm

### 安裝步驟

```bash
# 1. Clone 專案
git clone https://github.com/Saisong777/wechurch2.0.git
cd wechurch2.0

# 2. 安裝依賴
npm install

# 3. 設定環境變數
cp .env.example .env

# 4. 初始化資料庫
npm run db:push

# 5. 啟動開發伺服器
npm run dev
```

開啟瀏覽器至 `http://localhost:5001`

---

## 環境變數設定

| 變數名稱 | 說明 | 取得方式 |
|---------|------|---------|
| DATABASE_URL | PostgreSQL 連線字串 | 本地或雲端 DB |
| AI_INTEGRATIONS_OPENAI_API_KEY | OpenAI API 金鑰 | platform.openai.com |
| AI_INTEGRATIONS_OPENAI_BASE_URL | OpenAI-compatible API base URL | 預設 `https://api.openai.com/v1` |
| GEMINI_API_KEY | Gemini API 金鑰 | Google AI Studio |
| SESSION_SECRET | Session 加密金鑰 | 隨機生成 |
| GOOGLE_CLIENT_ID | Google OAuth Client ID | Google Cloud Console |
| GOOGLE_CLIENT_SECRET | Google OAuth Client Secret | Google Cloud Console |
| RESEND_WEBHOOK_SECRET | Resend webhook 驗證密鑰 | Resend |
| PORT | 伺服器埠號 | 預設 5001，本機可不填 |
| NODE_ENV | 執行環境 | development / production |

重要：`.env` 文件絕對不能上傳至 Git。請從 `.env.example` 複製後填入本機或 Railway 的實際值。

---

## 資料庫設定

```bash
npm run db:push      # 推送 schema
```

---

## 開發指令

```bash
npm run dev          # 啟動開發伺服器
npm run build        # 建置生產版本
npm run lint         # ESLint 檢查
npm test             # 執行測試
npm run db:push      # 推送 Drizzle schema
npm run local:verify # 本機 production build 瀏覽器白屏檢查
npm run local:db     # 用 Docker 啟動本機 PostgreSQL
npm run db:push:local # 將 schema 推到本機 PostgreSQL
npm run safe:check   # push 前完整檢查：build + test + audit + browser smoke
npm run safe:check:full # 含 Docker PostgreSQL 的完整本機檢查
```

## Push 前本機驗證流程

正式站更新前，請先在本機跑完整檢查：

```bash
npm run safe:check
```

這個指令會：

1. 產生 production build。
2. 跑 Vitest。
3. 跑 `npm audit`。
4. 用本機 production server 啟動網站。
5. 用 headless Chrome 打開 `http://127.0.0.1:5099`，確認 React 已渲染、沒有白屏 runtime exception、沒有 CSP 擋住模組。

驗證截圖會輸出到 `artifacts/local-verify.png`。如果本機沒有 Chrome，請設定：

```bash
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

本機資料庫可用 Docker 啟動：

```bash
npm run local:db
npm run local:db:wait
npm run db:push:local
npm run local:prod
```

開啟網站：`http://localhost:5099`

如果要一次跑「資料庫 + schema + build + test + audit + 瀏覽器白屏檢查」：

```bash
npm run safe:check:full
```

---

## 部署（Railway）

此專案目前由 GitHub repo `Saisong777/wechurch2.0` 連到 Railway。

Railway 會依照 `nixpacks.toml`：

1. 執行 `npm run build`
2. 以 `npm start` 啟動 Express server

Railway production service 需要設定 `DATABASE_URL`、`SESSION_SECRET`、AI keys，以及 OAuth/email 相關 secrets。請在 Railway Variables 管理，不要提交到 repo。

---

## 專案結構

```
wechurch2.0/
├── src/          # 前端 React 應用
├── server/       # 後端 Express API
├── shared/       # 共用型別/邏輯
├── public/       # 靜態資源
├── .env.example  # 環境變數範本
└── drizzle.config.ts
```

---

## 授權

本專案保留所有權利。如需使用請聯繫作者。
