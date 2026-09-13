# WeChurch GitHub / Railway A-B 工作地圖

日期：2026-09-13

最新 B：Together UI/UX `74d531a1-6abb-49e5-9632-b21c80baca97`，分支 `codex/b-checkpoint-2026-09-13-together`，runtime source `f2d7a4b34f9d098a18407a40906499eeae979ea4`，435 檔與 B 指紋一致。詳見 [UI/UX 更新與驗收](ui-ux-refresh-2026-09-13.md)。A 未變更；integration 仍不是最新 B。

前版 B（保留救援點）：分享牆獨立版 `e046c9cc-5fce-42ee-b2b9-ef3e7a610bbc`，分支 `codex/independent-sharing-walls`，救援標籤 `b-2026-09-13-e046c9cc`，source `302acc7822578c74eae07ea8dd2e1aadac3df9b5`。429 檔與 B 指紋一致；詳見 [分享牆獨立單元](independent-walls-2026-09-13.md)。前版 3fb876e4 與下列 a14d8f91 保留為修改前救援點，不再是最新 B。integration 尚未更新，不可把它當成最新 B 來源。

## 已落地的程式救援點

- GitHub：`Saisong777/wechurch2.0`（公開 repository）；A 與 B 共用一個版本庫，使用不同分支，不另建第二份程式庫。
- B 備份分支：`codex/b-checkpoint-2026-09-13`；固定標籤：`b-2026-09-13-a14d8f91`。
- 確切來源：`8792764a5d6dc1acdd017083c593690dad3731ad`，對應 B 部署 `a14d8f91-521e-4c7f-a0b8-dbd976903328`。
- 已從 GitHub 固定標籤重新下載，427 個部署檔案 SHA-256 全部吻合；驗證工具 4 項測試通過。這是程式取回驗證，不是資料庫完整還原。
- PR #4 是到 `integration` 的草稿；未合併。`main` 與 `integration` 仍保持原提交。B 仍人工部署，不跟隨 GitHub 自動部署。
- `main`、`integration` 已要求 PR、`validate` CI、分支保持最新及討論解決；管理者亦適用，禁止 force-push 與刪除。不要求第二位審查者，Sai 的 A 發布批准仍是人工 gate。
- `b-*` 標籤已啟用禁止改寫與刪除的規則。管理者仍可變更治理設定，不等於不可破壞的異地備份。
- 目前憑證不含 workflow 修改權限，所以 GitHub 沿用原有 CI；本機新增的 CI 資料庫／部署測試步驟尚未上傳。
- 既有 GitHub CI run `34751935450` 已成功，對應備份分支含 release record 的提交 `331241e6a2543e14a4914743f74a2284f55824ad`。檢查成功不代表零 lint warning 或完整資料庫整合 CI。
- DB、上傳檔、設定與密鑰不在這份 GitHub 備份中；完整異地加密備份尚未完成。

## 目標

這份地圖回答一件事：如果 Railway B 站壞掉、設定跑掉、資料庫出問題，WeChurch 仍然可以從 GitHub 紀錄與安全備份被重建。

核心原則：

- GitHub 保存「可重建 B 站的來源與說明」，不是保存整個 Railway runtime。
- Railway 保存正在運作的 A / B 站。
- 資料庫、上傳檔案、密碼與使用者資料不能直接放進 GitHub；需要另外做安全備份。

## 角色分工

| 區塊 | 負責內容 | 可否放 GitHub | 備註 |
| --- | --- | --- | --- |
| GitHub repo | 程式碼、migration、文件、發布紀錄、重建步驟 | 可以 | 這是主要版本備份與協作來源 |
| GitHub branch / PR | 本次要測的功能與修正 | 可以 | B 通過後才整理進正式發布 |
| Railway A 站 | 正式網站 runtime | 不直接備份到 GitHub | `https://wechurch.online` |
| Railway B 站 | 測試、修改、升級 runtime | 不直接備份到 GitHub | `https://wechurch-staging-staging.up.railway.app` |
| Railway A DB / volume | 正式資料與檔案 | 不可直接放 GitHub | 需正式備份與還原演練 |
| Railway B DB / volume | 測試資料與檔案 | 不可直接放 GitHub | 需加密備份；GitHub 只記錄位置與指紋 |
| Railway variables | Secrets、OAuth、DB URL、session secret | 不可 | GitHub 可保存變數名稱與用途，不保存值 |
| `artifacts/` | 本機驗收證據、備份、暫存輸出 | 不可直接上傳 | 已被 Git 忽略；只能摘要進文件 |

## GitHub 上的「B 站備份」應該包含什麼

GitHub 不應該放一份 B 站資料庫，也不應該放密碼。GitHub 應該放的是「B 站可以被重建」所需的非敏感材料：

1. 程式碼與 `package-lock.json`。
2. 已審查 migration，例如 `migrations/*.sql`。
3. Railway B 的公開網址、service / environment 識別資訊、部署規則。
4. B 站部署腳本與驗收腳本，例如 `staging:check`、`staging:deploy`、`staging:verify`。
5. release manifest：commit、部署時間、migration 清單、版本指紋。
6. 不含個資的測試資料範本與 seed。
7. 重建 Runbook：B app 掛掉、B DB 掛掉、B volume 掛掉時要怎麼恢復。

## GitHub 上不應該放什麼

以下內容不能直接進 GitHub：

1. `.env` 或任何 secret 值。
2. `DATABASE_URL`、OAuth secret、LINE secret、AI API key、邀請碼實值。
3. B / A 的原始資料庫 dump。
4. 使用者資料、會員名單、禱告內容、私密筆記、測試帳號密碼。
5. 上傳檔案原件，除非已確認是公開素材且沒有個資。
6. 未遮蔽的瀏覽器截圖、API log、Railway log。

## 建議的 Git 分支地圖

目前狀態：B 站暫時用 `npm run staging:deploy` 部署帶指紋的測試快照，不自動跟隨 GitHub。

穩定後建議：

| 分支 / 標籤 | 用途 |
| --- | --- |
| `main` | A 站正式來源。合併到這裡等同準備正式發布。 |
| `integration` | B 整合分支；目前仍保留舊版本，PR #4 尚未合併。 |
| `codex/*` | 單一功能或修正。完成後 PR 到 B 分支；既有 feature 分支保留。 |
| `b-*` tag | 已備份 B 的固定救援版本，禁止改寫／刪除。 |
| `release/YYYY-MM-DD-*` | B 已通過、準備升 A 的固定版本。 |
| `prod/YYYY-MM-DD-*` tag | A 站實際發布版本記錄。 |

在 CI 與分支保護完成以前，不要把 B 站重新接回自動部署，避免 dirty 工作樹或半成品直接進 B。

## 標準工作流

### 1. 修改前

1. 從 GitHub 拉取正確的 B 基準，目前為上述固定標籤；不把尚未更新的 integration 當成最新 B。
2. 建立功能分支或明確整理本次變更範圍。
3. 若會改資料庫，先寫 migration，不用 schema push 代替 migration。
4. 確認這次要進 B 的檔案，避免把不相關 dirty worktree 一起帶入。
5. 修改過程以小步 commit 保存到功能分支；不要等所有功能做完才第一次備份。

### 2. 更新 B 站

1. `npm run safe:check`
2. `npm run staging:check`
3. 若有 schema 變更：
   - `npm run staging:backup`
   - `npm run staging:migrate`
4. `npm run staging:deploy`
5. 等 Railway 回報 SUCCESS。
6. 讀回 B 站實際版本指紋與 health check。
7. `npm run staging:verify`
8. 手機、桌面、UI/UX、登入、權限與主要流程都在 B 站測。

### 3. B 通過後

1. 把通過 B 的程式、migration、文件整理成 GitHub commit / PR。
2. 記錄 B 的部署 ID、commit、migration 清單、驗收結果。
3. 建立 release branch 或 tag。
4. 不把 B DB 複製到 A；只把同一批程式與 migration 升到 A。

### 4. 更新 A 站

1. 先做 A DB 與上傳檔案備份。
2. 在隔離環境驗證 A 備份可以還原。
3. 套用 B 已驗證的同一批 migration。
4. 部署同一個 GitHub 版本到 A。
5. 跑 A 站最小 smoke check：health、登入、主要頁面、關鍵 API。
6. 記錄正式部署版本與 rollback 位置。

## B 站故障復原地圖

### B app 掛掉

從 GitHub 找最後通過 B 的 commit / release branch，重新部署到 Railway B service。若 B service 設定遺失，依本文件與 A/B 發布規則重建 service，再套入 B 的 Railway variables。

### B DB 掛掉

不要從 A DB 補到 B。使用最近一次 B 專用加密備份還原，再套用 GitHub 中尚未還原的 migration。還原後跑 `staging:verify`。

### B 上傳檔案遺失

使用 B 專用上傳檔案備份還原，並核對檔案 manifest / checksum。若只有非必要測試檔遺失，可以重新產生測試資料，但要在發布紀錄中註明。

### B 設定遺失

GitHub 保存變數名稱、用途與必要性；實際 secret 值從 Railway / 密碼管理器 / 既定安全位置重新填入。不可從 log 或文件找 secret。

## 目前缺口

| 缺口 | 風險 | 下一步 |
| --- | --- | --- |
| B DB 備份目前主要留在本機 `artifacts/railway-staging/` | 本機壞掉時，B 備份也可能不見 | 決定一個加密雲端備份位置 |
| B 上傳 volume 尚未建立固定備份排程 | B 上傳檔案遺失時不一定能還原 | 做 volume export / manifest / checksum |
| 已有固定 B 程式標籤及 GitHub-safe release record；後續每次發布仍須保存 | 新部署可能超過已備份版本 | 每次 B 驗收後記錄新 commit、指紋與標籤 |
| B 備份已獨立保存，integration 尚未合併 | 誤從舊整合分支開始會漏掉近期工作 | 先使用固定 B 基準，再審查 PR #4 |
| GitHub 新增 CI 步驟受 workflow 權限限制 | 雲端 CI 未涵蓋資料庫與部署整合測試 | 保留本機隔離測試；另行取得必要授權後更新 CI |
| A 升版仍需人工流程 | 可以，但需要清楚 gate | 建立 A release checklist |

## 最小可落地版本

先做四件事就能大幅降低風險：

1. GitHub 保留這份工作地圖與 A/B 發布規則。
2. 每次 B 通過後，提交 GitHub-safe release manifest。
3. B migration 前做 DB 備份，並把備份加密後放到耐久儲存。
4. B 升 A 前固定 commit / tag，A 只吃這個版本。

## 判斷句

GitHub 要有「B 站的重建備份」，但不應該有「B 站的原始資料備份」。真正安全的做法是：GitHub 保存可重建的版本、規則、migration 與指紋；資料庫與上傳檔案用加密備份另外保存。
