# 聖經段落閱讀

## 範圍與成功條件

- B 站讀聖經頁提供明確的「段落／逐節」切換，新裝置預設段落。
- 裝置記住閱讀偏好；儲存受限時仍可切換。
- 段落連續排文、保留節號及原文內容，不推測或添加神學分段、小標題。
- 逐節、合併經節、選取、來源授權、查考、筆記及譯本對照仍可使用。
- 段落對照：桌面並排，手機依譯本上下排列；逐節對照仍逐節對齊。
- 不更動聖經資料庫、會員、筆記或 A 站。

## 實作

- 沿用 Radix 單選切換控制及既有網站字級／顏色。
- 經文在同一個段落中自然換行，段落中的經節使用真正可跨行的 inline span（保留 button 語意、鍵盤操作及焦點）；逐節模式才使用原生 button。操作列放在段落外。
- 偏好鍵：`study-reading-mode`；合法值 `paragraph`／`verses`。
- 每節仍以原始 verse/end_verse 識別，合併經節不拆分或重複。

## 驗證

以下為第一版紀錄，並非完整畫面驗收。使用者後續回報手機仍每節換行；更正及修復見下方。

- 11 項讀經元件測試通過，包含 3 項新增模式／保存／對照／受限儲存測試。
- 頁面及測試檔 lint 無錯誤；兩項原有 fast-refresh 警告仍保留。
- 全套 130 檔／741 項功能測試、42 項發布檢查、隔離 DB 真實 HTTP／完整性及 build 通過；測試 DB 已清除回讀。
- GitHub 來源：`4dc77a4`；B 部署 `41c75406-6f1e-4831-b628-42d6b8ceceff` 為 SUCCESS。
- 快照指紋：`9eb0013e5b99f079e08ccb8b1da385791102b0ee291d08c35bc9fc7499e8371e`；GitHub-safe release manifest 已核對 live fingerprint/sourceMatchesCommit。
- B DOM 已讀回「段落／逐節」控制、段落預設選取、創世記 1 章 31 個經節按鈕及來源授權。
- B Google 登入／邀請邊界驗證通過；A deployment 仍 `a8a4db29-527f-4cc3-8d17-caed230f69cb`。
- 手機／桌面視覺及完整線上操作驗收尚未完成：截圖與 viewport 工具逾時，工具回報 Mac 鎖定；已請 Sai 解鎖，未繞過鎖定。
- 可能送出的 1440×1000 viewport 覆寫未能在鎖定時確認／清除，接續時先 reset。
- 實體 iPhone 未重測，不以瀏覽器尺寸模擬宣稱實機驗收。

## 手機回報與修復

- 使用者 iPhone 截圖指出選中「段落」仍每節換行。
- B 站 390px 實際排版讀回：原生 `BUTTON` 的 computed display 為 `inline-block`；每節只有一個整塊矩形，第二節從下一行開始。僅指定 `display:inline` 無法消除原生按鈕的原子排版。
- 修正：段落模式改用可跨行的文字 span，保留節號、aria-pressed、可聚焦、Enter／Space 切換、選節查考與同頁筆記；逐節模式仍使用原生按鈕。
- 新增防回歸檢查：段落不得含原生 button、切回逐節恢復 button、鍵盤 Enter／Space 正常選取且不捲動／提交。
- 12 項 Reader 測試、130 檔／742 項功能測試、42 項發布檢查、隔離 DB 真實 HTTP／完整性與 build 已通過；來源 `e954fca`。
- B 修正版 `f656df97-8be6-4163-86af-d9757f5ce7f6` 為 SUCCESS；GitHub-safe manifest 已核對 live fingerprint／sourceMatchesCommit=true，指紋 `29eafd0aa14da6975b095c696c138fa83058ff51c48da927659d1f35707c60f9`。
- B 390px 直接量測：第 1 節與第 2 節第一個文字片段的 y 同為 707；第 2 節自然跨成 3 個 inline 片段，第 3 節接在第 2 節最後一行。無橫向溢出。
- B 320px 深色／最大閱讀字級 30（實際 33.75px）：經文仍跨行連續；雙譯本分成上下單欄，無橫向溢出。
- B 1440px 明亮／字級 20：雙譯本兩欄各 604px，經文連續，無橫向溢出，兩個譯本正文與來源沒有混合。
- B 實際操作：Enter 選第 2 節、查考及返回原節、同頁筆記帶入正確第 2 節（未輸入或儲存）、逐節模式保留選取、切回段落及重新整理後記住模式。
- 驗收後恢復明亮／字級 20、關閉測試對照，viewport override 已 reset；未修改任何會員資料或私人筆記。
- 畫面及排版證據（gitignored）：`artifacts/bible-paragraph-2026-09-30/mobile-390-fixed.png`、`mobile-320-dark-large-fixed.png`、`desktop-1440-comparison-fixed.png`、`layout-fixed.json`。
- 實體 iPhone 修正版仍待使用者操作確認；上述是實際 B 站的瀏覽器尺寸驗收，不宣稱實機測試已完成。
- B Google／邀請／偽造及取消 callback 邊界再次通過，未建立測試會員；首次驗證碰到短暫 SSH／網路逾時，稍後重跑成功，未更動安全設定。未重新進行真實 Google 同意流程。
