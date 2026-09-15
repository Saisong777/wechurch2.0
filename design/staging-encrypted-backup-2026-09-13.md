# B 站加密備份與還原

## 邊界

程式與 migration 進 Git；DB、上傳檔、設定與金鑰不進 Git。這份工具沒有自動排程、沒有異地上傳、沒有自動產生金鑰，也不會改 A。

`npm run staging:backup` 是發布前本機暫存的 DB 快照，不能當作異地加密備份。`npm run staging:backup:encrypted` 才封裝 DB、B 的 `/data` 與環境設定。

## 封裝

1. 保管者先提供 Git 工作區外、權限 0600 或 0400 的 32-byte 原始二進位金鑰；另外保存離線復原副本，不能和備份僅放在同一裝置。遺失金鑰無法解密。
2. 指定既有的 Git 工作區外目錄為 `WECHURCH_BACKUP_DIR`，金鑰檔路徑為 `WECHURCH_BACKUP_KEY_FILE`，再執行 `npm run staging:backup:encrypted`。不要把金鑰本身放進指令或環境變數。
3. 工具重新驗證 B 的部署及資料庫隔離，取得新 pg_dump、上傳 volume 和設定，逐份 AES-256-GCM 加密、解密校驗與檔案雜湊回讀。
4. 只有三份全部成功才寫出 `manifest.json`，`complete: true`。失敗目錄不可當作完整備份。
5. 將加密檔與 manifest 放進已核准的異地儲存，重新驗 SHA-256，另訂留存期間及到期清理。此步目前未連接儲存供應者，不會自行執行。

## 解密與演練

使用 `node scripts/decrypt-staging-backup.mjs /absolute/archive.enc /absolute/private/output`，仍需 `WECHURCH_BACKUP_KEY_FILE`。輸出目錄必須在 Git 工作區外、權限 0700；輸出不覆寫既有檔案。解密成功不等於還原成功。

- DB 先檢查 `pg_restore -l`，還原到一次性的 PostgreSQL 17 資料庫，驗證 migration、關鍵筆數與引用完整性。
- 上傳檔先檢查 tar 清單，確認沒有絕對路徑、`..` 或非預期符號連結，再解開到新的隔離目錄；不得直接覆蓋服務中的 `/data`。
- 設定僅供保管者在隔離環境重建；禁止照搬正式外寄憑證到測試環境，禁止把所有環境變數列印到紀錄。
- 檢查登入、讀經、私人筆記、分享與上傳檔引用後，才記錄完整還原演練通過。不要對 A 自動還原。

## 已知限制

DB 與 volume 是先後取得，不是同一時間的原子快照。涉及上傳寫入的完整演練必須安排暫停寫入的時段或驗證所有引用關係。工具目前以記憶體處理、每份 base64 回應上限 128 MiB；超限會失敗，不宣稱適用大容量備份。真正異地落地、保留政策、金鑰託管及聯合還原仍待完成。
