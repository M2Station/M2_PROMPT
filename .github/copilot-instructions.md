# Copilot Instructions

> 本檔案為 GitHub Copilot / Copilot Chat 的專案層級指引。
> 放置路徑：`.github/copilot-instructions.md`
> 標記 `<!-- TODO -->` 的區塊請依專案實際情況修改或刪除。

---

## 1. 溝通規範

- 對話回覆使用 **繁體中文**；程式碼、變數名稱、commit message、API 命名一律使用 **英文**。
- 專業術語保留英文原文（例如 firmware、schedule、dependency、build），不強制翻譯。
- 回答要簡潔、直接給結論與可執行的程式碼；不需要客套或重複問題內容。
- 不確定的地方要明確說「不確定」，不要臆測 API、參數名稱或檔案結構。

---

## 2. 專案概觀

- **專案名稱**：M2_PROMPT（npm 套件名 `m2-prompt-tool`）
- **用途**：Prompt 快速撰寫、追蹤與管理的 Electron 桌面 App；含欄位表單、Markdown WYSIWYG 編輯器、片語（snippet）面板與專案匯出。
- **使用者**：公開（MIT 授權，GitHub 公開 repo `M2Station/M2_PROMPT`）。
- **部署環境**：Windows 桌面（NSIS 安裝檔，x64 / arm64），透過 GitHub Releases 發佈；本機開發以 `npm start` 啟動 Electron。

---

### 相依套件原則

- **優先使用原生 API**，避免為小功能引入新套件。
- 新增相依套件前，先說明理由與替代方案。
- 禁止使用已停止維護（unmaintained）或有已知安全漏洞的套件。
- CDN 資源需固定版本號，不使用 `latest`。

---

## 4. 程式碼規範

### 通用

- 縮排：4 空白（HTML / CSS / JS 一致），不使用 Tab。
- 字串：JS 使用單引號 `'`，樣板字串用反引號。
- 結尾分號：**必加**。
- 檔案結尾保留一個空行，使用 UTF-8（無 BOM）、LF 換行。
- 單行長度盡量不超過 120 字元。
- 要支援多國語言, 將多國語言翻譯檔案獨立出來
- 要考量到中文亂碼問題
- 要考慮長目錄限制,預先檢測＂過長目錄所引發的問題
- 要有DEBUG機制, 發生錯誤可以提供LOG做後續的DEBUG

### 命名

| 對象 | 慣例 | 範例 |
|---|---|---|
| 變數 / 函式 | camelCase | `parseScheduleRow` |
| 類別 / 建構函式 | PascalCase | `ScheduleEngine` |
| 常數 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| 檔案 | kebab-case | `schedule-engine.js` |
| CSS class | kebab-case，語意化 | `.milestone-bar` |
| CSS 變數 | `--` + kebab-case | `--accent-cyan` |
| 私有成員 | `_` 前綴 | `_cache` |

### 函式撰寫

- 一個函式只做一件事，超過 50 行請考慮拆分。
- 參數超過 3 個時改用 options object。
- 明確 `return`，避免隱含回傳 `undefined` 造成的判斷錯誤。
- 副作用（DOM 操作、檔案 I/O、DB 寫入）要集中，不要散落在計算邏輯中。

### 註解

- 註解說明**為什麼**這樣做，而不是重複程式碼在做什麼。
- 公開函式加 JSDoc（型別 + 用途 + 邊界條件）。
- 暫時性程式碼標記 `// TODO:` 或 `// FIXME:` 並附上原因。
- **不要**產生大量無意義的裝飾性註解或分隔線。

---

## 5. 錯誤處理

- 對外部輸入（檔案、API、使用者輸入）一律驗證後再使用。
- 不使用空的 `catch {}`；至少要記錄或轉換為明確錯誤。
- 錯誤訊息要包含足以定位問題的上下文（檔名、欄位、索引值）。
- 非預期狀態使用 fail-fast，不要靜默降級（silent fallback）。
- 使用者可見的錯誤訊息用繁體中文；log 用英文。

---

## 6. 安全規範

- **嚴禁**在程式碼中寫入帳號、密碼、token、API key、內部 IP、客戶機密資料。
- 敏感設定放 `.env` 或設定檔，並確認已加入 `.gitignore`。
- 產生範例程式碼時使用明顯的假值：`YOUR_API_KEY`、`example.com`。
- SQL 一律使用參數化查詢（prepared statement），不做字串拼接。
- 前端輸出使用者資料時避免 `innerHTML`，優先 `textContent`；必要時做 escape。
- 涉及客戶（Microsoft / HP / ASUS / NVIDIA 等）專案代號或成本資訊時，不寫入公開 repo。

---

## 7. Git 規範

### Commit Message

採用 Conventional Commits：

```text
<type>(<scope>): <subject>

<body 選填，說明動機與影響範圍>
```

**type**：`feat` / `fix` / `refactor` / `perf` / `docs` / `style` / `test` / `chore` / `build`

- subject 使用英文、動詞原形開頭、不超過 72 字元、句尾不加句號。
- 一個 commit 只包含一個邏輯變更。
- 範例：`feat(scheduler): add reverse planning for PCB milestones`

### 分支

- `main`：可發佈狀態，不直接推送。
- `feature/<描述>`、`fix/<描述>`、`chore/<描述>`。
- PR 需自我檢查：能執行、無 console error、無殘留 debug 程式碼。

---

## 8. Copilot 行為規範

**必須做到：**

- 修改既有檔案時採 **最小變更**（minimal diff），不順手重排、重新格式化無關區塊。
- 修改前先參考專案現有寫法與命名風格，保持一致性優先於個人偏好。
- 產出程式碼要能直接執行；不留 `...`、`// 其他邏輯` 這類佔位內容。
- 多檔案變更時，先列出計畫再動手。
- 大規模重構、刪除檔案、變更資料結構前，**先詢問確認**。

**不要做：**

- 不要臆造不存在的函式、套件、設定項或檔案路徑。
- 不要在未被要求時新增框架、建置工具或抽象層。
- 不要為了「更好」而擅自改變既有 UI 行為或視覺樣式。
- 不要輸出冗長的前言、總結或再次貼上未修改的整份檔案。
- 不要移除既有註解、TODO 或看似無用但未確認的程式碼。

---

## 9. 單檔 HTML 工具規範

<!-- TODO: 若專案非單檔工具可刪除本節 -->

- 所有 HTML / CSS / JS 集中於單一 `.html`，可用瀏覽器直接開啟，無需伺服器。
- 外部資源僅允許：Google Fonts、CDN 上的 CDN 函式庫（固定版本）。
- 檔案內部分區順序：`<style>` → `<body>` 結構 → `<script>`，各區以區塊註解標示。
- 狀態集中管理於單一 `state` 物件，避免散落的全域變數。
- 資料持久化使用 `localStorage`，key 加專案前綴避免衝突。
- 需支援匯出（JSON / Excel / PPTX）時，功能獨立成函式，不與 render 邏輯混寫。

---

## 10. 視覺設計規範

<!-- TODO: 依專案調整；此為預設 dark HUD 風格 -->

- 深色底、高對比、資訊密度高，避免大面積留白與圓潤卡通風格。
- 字型：標題 `Orbitron`，數據與程式碼 `DM Mono`，中文回退 `Noto Sans TC`。
- 主色調：以 cyan（`#00e5ff`）為主、magenta（`#ff2fd0`）為輔的 neon accent。
- 顏色一律定義為 CSS 變數置於 `:root`，不在元件中硬寫色碼。
- 動效克制：transition 150–250ms，不使用彈跳或誇張進場動畫。
- 表格、Gantt、儀表板需支援大量資料，優先考慮可讀性與捲動效能。

---

## 11. 測試與驗證

<!-- TODO: 無測試框架的專案可簡化為手動檢查清單 -->

- 新增邏輯需附最小可驗證方式（單元測試或可執行範例）。
- 邊界條件必測：空值、空陣列、單一元素、極大值、非法輸入。
- 交付前檢查清單：
  - [ ] 可正常啟動 / 開啟，無 console error
  - [ ] 主要流程手動走過一次
  - [ ] 無殘留 `console.log` 與測試資料
  - [ ] 無硬編碼的機密資訊
  - [ ] README / 註解已同步更新
