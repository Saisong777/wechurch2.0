# ✝️ WeChurch 2.0 — 我們就是教會

一個為基督教社群設計的全功能平台，整合聖經研讀、禱告分享、小組互動與 AI 輔助靈修。

---

## ✨ 功能介紹

| 模組 | 說明 |
|------|------|
| 📖 **聖經閱讀** | 多版本聖經，支援 TTS 朗讀 |
| 🕰️ **Jesus Timeline** | 互動式聖經時間軸探索 |
| 📅 **靈修計畫** | 個人讀經計畫，附每日提醒 |
| 🧠 **Soul Gym** | 即時協作小組查經 + 隨機分組 |
| 🙏 **禱告牆** | 匿名發布禱告請求，社群互動 |
| 🎲 **Icebreaker** | 小組破冰遊戲與隨機分組工具 |
| 📝 **靈修筆記** | 7步驟靈修格式的記錄系統 |
| 🤖 **AI 分析** | OpenAI 驅動的查經報告與靈修分析 |
| 📓 **筆記本** | 整合所有筆記，支援匯出 |

---

## 🛠 技術架構

```
前端：React 18 + TypeScript + Vite + Tailwind CSS + Shadcn/UI
後端：Node.js + Express.js
資料庫：PostgreSQL + Drizzle ORM
AI：OpenAI API
部署：Replit
```

---

## 🚀 快速開始

### 前置需求

- Node.js 18+
- PostgreSQL 14+
- npm 或 pnpm

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

開啟瀏覽器至`http://localhost:3000`

---

## 🔐 環境變數設定

| 變數名稱 | 說明 | 取得方式 |
|---------|------|---------|
| DATABASE_URL | PostgreSQL 連線字串 | 本地或雲端 DB |
| OPENAI_API_KEY | OpenAI API 金鑰 | platform.openai.com |
| SESSION_SECRET | Session 加密金鑰 | 隨機生成 |
| JWT_SECRET | JWT 簽名密鑰 | 隨機生成 |
| PORT | 伺服器埠號 | 預設 3000 |
| NODE_ENV | 執行環境 | development / production |

> ⚠️ **重要**：.env 文件絕對不能上傳至 Git！

---

## 🗄 資料庫設定

```bash
npm run db:push      # 推送 schema
npm run db:generate  # 產生 migration
npm run db:migrate   # 執行 migration
npm run db:studio    # 開啟 Drizzle Studio
```

---

## 💻 開發指令

```bash
npm run dev          # 啟動開發伺服器
npm run build        # 建置生產版本
npm run typecheck    # TypeScript 型別檢查
npm run lint         # ESLint 檢查
npm test             # 執行測試
```

---

## 🚢 部署（Replit）

1. Fork 此 repo 至 Replit
2. 在 Replit Secrets 設定所有環境變數
3. 點擊 Deploy

---

## 📁 專案結構

```
wechurch2.0/
├── client/       # 前端 React 應用
├── server/       # 後端 Express API
├── shared/       # 共用型別/邏輯
├── public/       # 靜態資源
├── .env.example  # 環境變數範本
└── drizzle.config.ts
```

---

## 📄 授權

本專案保留所有權利。如需使用請聯繫作者。
