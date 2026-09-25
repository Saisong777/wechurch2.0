# B 新譯本、實機與異地備份驗收

## 新譯本

本輪新增一個不同的中文譯本：免費易讀聖經（簡體・新約），來源 ID `cmnfeb`。
不是商業 ERV，也不是既有當代譯本的繁簡重複計算。和合本仍為預設。

- [eBible 來源](https://ebible.org/bible/details.php?id=cmnfeb)
- [授權原文](https://ebible.org/cmnfeb/copyright.htm)
- [出版社](https://www.freebibleministry.org/)
- [來源 ZIP](https://ebible.org/Scriptures/cmnfeb_vpl.zip)
- Copyright 2022 Free Bible Ministry, Inc.; CC BY-SA 4.0。
- 來源 ZIP SHA-256：`0d241664fdfdbbbd12c61f7b6df876d5b0bba3f6f558d2b31d0d3d823bb0a510`。

實際下載包僅有新約 27 卷、260 章、7,959 筆經節列，其中 17 列正文為空；
匯入 7,942 段非空正文，不用其他譯本填補，也不自行改寫。保留原始簡體字。
使用者選到舊約會看見「僅收錄新約」，可讀馬太福音或切回和合本。
保留版權、授權連結、來源版本與修改說明；資料轉換貢獻同樣依 CC BY-SA 4.0。
授權核對不代表教會已完成逐節譯文審核，A 正式採用仍需確認。

世界中文聖經 `cmnswcb` 的上游明示為草稿，本輪不加入；未取得開放授權的新譯本也不加入。
查核來源：[世界中文聖經聲明](https://ebible.org/cmnswcb/copyright.htm)、
[新譯本資料頁](https://ebible.org/bible/details.php?id=cmn-ncvt)。

## 發布及驗收

- B 部署 `cc831c94-08ea-4e6c-b152-c335d711a2f4`，Railway SUCCESS。
- 程式來源 `006f55e1ec40d95cdd9b9684c8f6ac236d5c04d7`。
- 487 檔指紋 `aaf67719382db8aa432cc798dd796cc8151e97e885431f67b91ef9a09d37866b`。
- 資料版本 `public-20260926-v3`，獨立於保留的 v1/v2。
- DB SHA-256 `c2bbdf5f4bb7b9cc809472515f6070c432061d87382a20d95971eb68df55313f`。
- inventory SHA-256 `769fc01eab03cbe891e1540eeffd7cae53c30336353bbbc2b54e22ae33b8a68a`。
- 型別、412 項功能、7 項部署、隔離 DB/HTTP 完整性、build 通過。
- 25 組真實 B 研經 API 與只讀資料比對、全部資料資產 hash、會員登入限制、私人路徑阻擋通過。
- 320/390/1280px 真實 B：新約閱讀、譯本對照、舊約提示與跳往馬太福音通過；無水平溢出、無瀏覽器錯誤。
- 新譯本來源展開資訊含正確署名、授權與新約限制。
- A 部署仍為 `a8a4db29-527f-4cc3-8d17-caed230f69cb`。沒有發布 A，沒有寫入會員 DB 或筆記。

[精確發布紀錄](releases/b-cc831c94-08ea-4e6c-b152-c335d711a2f4.json)。
退回時取 `b-2026-09-26-d21c8707` 程式並使用 `/data/.bible-study/public-20260926-v2`；
只回退程式與只讀資料，不覆蓋會員 DB。部署前重新做 B 隔離及版本核對。

## 本人 iPhone 驗收

Sai 回覆：「iphone 15 pro ,chrome ,測試沒問題」。
因此登入、捲動與導覽、譯本對照與串珠、私人筆記儲存四項，記為本人實機通過。
裝置 iPhone 15 Pro，瀏覽器 Chrome，iOS 版本未提供，不自行推定。
此回報對應新增 FEB 前的 v2/d21c8707；v3 新增 FEB 的尺寸驗收另列於上方，
不將先前實機回報擴大成所有譯本、Android、所有 iOS 版本或整站功能全部通過。

## 備份與還原

獲 Sai 明確同意，目的地為私人「WeChurch B 加密備份」Google Drive 資料夾。
備份集 `b-recovery-1790356218353`，時間 `2026-09-25T17:10:18.356Z`。
manifest SHA-256 `7d2220934c92a400f2a8937963d7b62d63cbc1c46b3625963efd32e20a7560b1`。

Format 2 含五份 AES-256-GCM 加密檔：DB、私人上傳檔、設定、核對證據、v3 只讀研經資料；
僅加密檔與不含會員資料的校驗清單送上 Drive，金鑰不同行、不進 Git。
DB 使用同一 exported snapshot 取得 dump 與內容摘要；上傳目錄在打包前後核對雜湊。
排除 `/data/.bible-study` 後，另備份經遠端全部 hash 核對的現役 v3 研經資料。
不是刪除或替換先前備份，不含未使用的歷史只讀資料版本。

本機還原已通過：96 張資料表逐表筆數及內容摘要相同、上傳檔 hash 相同、
研經資料全部校驗相同、B 設定身分一致。DB 快照沒有 `/uploads/` 格式的引用，
故該項掃描為 0，不宣稱已驗證不存在的附件引用情境。

Drive 上傳及下載後完整還原已通過：`2026-09-25T17:29:36.493Z`。
五份加密檔與 manifest 皆重新由 Drive 下載至獨立目錄；逐份長度及 SHA-256 核對相同。
以雲端下載檔再做完整還原，96 張表內容摘要、上傳檔、只讀研經資料、設定身分全部吻合。

- [私人備份資料夾](https://drive.google.com/drive/folders/1eDjB3URwsvK5CEOojkIk8nQbyuCrk9bq)
- [本次備份集](https://drive.google.com/drive/folders/1MUIGhgR6qwEe7d6qQA62Ril1n_i8ZlHC)
- 已讀回 `shared: false`，僅原帳戶 owner；六個檔案皆未分享。
- 本機 receipt：`~/.local/share/wechurch-migration/backups/drive-readback-1790356218353/restore-verification.json`。
- 傳輸曾遇 rclone 公用 API 查詢配額 403；未改權限，以已連接 Drive 讀取及直接檔案上傳完成。不把失敗的嘗試算成功。

## 復原操作

1. 取回本 Git 版本，安裝 lockfile 依賴；使用 Node 22、Python 3.9+、Docker PostgreSQL 17。
2. 將五份加密檔及 manifest 下載至 Git 工作區外的新私人目錄。
3. 由保管者取回 32-byte 金鑰檔，權限 0600/0400，設 `WECHURCH_BACKUP_KEY_FILE` 為絕對路徑。不要把金鑰值寫入指令或紀錄。
4. `node ops/verify-b-recovery-set.mjs /absolute/private/download-directory`。
5. 工具先驗 ciphertext hash、AES-GCM、B 身分與安全解包，還原至新的本機隔離資料庫；逐表比對資料及上傳檔、研經檔。
6. 成功產生 `restore-verification.json` 後，由保管者另行確認切換，不能直接覆蓋服務中的 A/B。

`ops/seal-b-recovery-set.mjs` 可在設定 `WECHURCH_BACKUP_DIR` 與金鑰路徑後建立新快照。
所有敏感設定只在記憶體解密；解密後 DB/檔案保存在 0700 的隔離還原目錄，不進 Git。
每次演練的 PostgreSQL 容器結束後停止；工具不會自動刪除還原資料或先前備份。

## 保留限制

- 本輪是一次已核准的備份，不是定期排程，也沒有設定自動刪除政策。
- 金鑰仍由原本機 `~/.config/wechurch-im-migration/backup.key` 保管；獨立離線或密碼管理器的復原副本尚未驗證。失去金鑰無法解密，即使 Drive 檔案健全。金鑰不可上傳到同一備份資料夾。
- DB 與上傳檔不是跨儲存原子快照；有上傳更新時須停寫或重新核對引用，不得只信 tar 成功。
- 此有界工具的 DB 傳輸 32 MiB、私人上傳 base64 128 MiB、參考 archive 512 MiB 緩衝；超限失敗，不宣稱無限串流。
- Google OAuth 等外部平台的設定與同意畫面不是單靠 DB 還原即可重建；復原須沿既有 B 登入部署文件核對。
