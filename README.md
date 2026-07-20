# M2 PROMPT

> 🌐 Language / 語言: English · 繁體中文

An Electron desktop app for quickly authoring, tracking and managing prompts.
Same layout and visual language as
[M2_LOG](https://github.com/M2Station/M2_LOG), adapted for prompt engineering.
Fill in the project fields on the left, add any number of **function tabs** on
the right (System / User / Context / Examples / custom), drop in ready-made
**snippets** and type your prompt, then hit **Export** — the app writes a folder
with `info.json`, a combined `prompt.md`, and one file per section. Any exported
folder can be reopened later to keep editing.

## ✨ Features

### Prompt authoring
- **Multi-project tabs** — work on several projects at once; add / close tabs (at least one stays open).
- **Project fields** — Name, Date (with a "now" refresh button), Target Model, Notes.
- **Folder name from the project name** — auto-uppercased, spaces become `_`, and used as the output folder abbreviation (length configurable, default 30). Tick **PRE_FIX** to prepend a `YYYYMMDD_HHmm_` date-time stamp.
- **Custom fields** — add / remove your own key / value fields (embedded in every export header).
- **Function tabs** — dynamic prompt sections; `+` to add, double-click to rename, `×` to remove, with a live line / character counter.

### Snippets
- **Snippet palettes** — floating, draggable, resizable panels of one-click inserts, grouped by category (Function / Performance / Debug / Loop / …).
- **Insert at the cursor** — click a snippet to drop reusable role / goal / step / format / constraint blocks straight into the active tab (undo-friendly).
- **SNIPPET Settings** — add / rename / delete categories and snippets, or paste content to create a new one; edits persist to `snippets.json` and rebuild the toolbar live.

### Export
- **Export** creates `<output-root>/<[YYYYMMDD_HHmm_]ABBR>/` containing:
  - `info.json` — all project fields + section list.
  - `prompt.md` — the combined prompt (header + every non-empty section).
  - `<section>/<section>.md` for each non-empty section (header embedded).
- **Export This Tab** — export only the current section (header included).
- **Configurable output root** — leave empty for the app-level `PROMPT_OUTPUT/`, or enter an absolute path (e.g. `D:\Prompts`) / pick one via Browse.
- **Copy Summary** (project fields → clipboard) and **Reset** (fields back to defaults).
- `Ctrl + Enter` to export quickly.

### Open & edit
- **Open Project** — load a previously exported folder back into the editor (fields, custom fields and all sections).
- **Save** — write your changes back to the same folder, so exports round-trip cleanly.

### Look & feel
- **Settings (⚙)** — folder-name length (1–40), tab-name length (1–100), theme.
- **Themes** — Daylight (Light), Low Key (Dark), VS Code (Dark), Army, Army (Dark).
- **Bilingual EN / 中** interface; the app version shows in the window title.
- Draggable splitter; editor zoom (`Ctrl +` / `Ctrl -`); all fields / sections persist via `localStorage`.

## 🚀 Getting started

Easiest: double-click `M2_PROMPT.cmd` (the first run auto-installs Node.js and
dependencies, downloads Electron, then launches).

Or manually:

```
npm install
npm start
```

> If you need to run elevated (e.g. to match an elevated VS Code), use
> `M2_PROMPT_Admin.cmd` — it self-elevates via UAC.

## 📂 Output layout example

Project name `Customer Support Bot` (abbreviation `CUSTOMER_SUPPORT_BOT`),
sections System / User:

```
PROMPT_OUTPUT/
└─ CUSTOMER_SUPPORT_BOT/          ← tick PRE_FIX for 20260716_1430_CUSTOMER_SUPPORT_BOT/
   ├─ info.json
   ├─ prompt.md          ← combined prompt (all sections)
   ├─ System/
   │  └─ System.md       ← project header embedded at the top
   └─ User/
      └─ User.md         ← project header embedded at the top
```

## ⚙️ Configuration

- Output defaults to `PROMPT_OUTPUT/` next to the app (project root in development; next to the EXE once installed). Set an absolute path in the **Output Root** field, or use Browse.
- Folder / tab name abbreviation lengths and the theme: open **⚙ Settings**.
- Snippet palettes live in `snippets.json` — edit them in-app via **⚙ SNIPPET Settings**.

## 📦 Build the installer

Uses [electron-builder](https://www.electron.build/) to produce Windows NSIS
installers for both x64 and ARM64:

```
npm install
npm run dist
```

Produces one installer per architecture:

- `dist\M2_PROMPT-<version>-x64.exe`
- `dist\M2_PROMPT-<version>-arm64.exe`

Use `npm run dist:x64` / `npm run dist:arm64` to build a single architecture, or
`npm run pack` for an unpacked build. ARM64 builds cross-compile fine from an
x64 machine — electron-builder downloads the matching Electron binaries
automatically.

> 🚀 To cut a versioned GitHub Release — installers are built and attached to the
> **Releases** page automatically when you push a `v*` tag — see
> [docs/RELEASE.md](docs/RELEASE.md).

## 🗂️ Project structure

```
src/
  main/      Electron main process (main / ipc)
  preload/   contextBridge bridge (window.m2prompt)
  renderer/  index.html, css/styles.css, js/{app,themes}.js, i18n/{en,zh}.json
snippets.json  built-in snippet palettes (editable via ⚙ SNIPPET Settings)
scripts/     repair-electron.ps1 (rebuilds a half-installed Electron binary)
docs/        RELEASE.md (versioned GitHub Release guide)
.github/     CI workflows (build sanity check / tag-triggered release)
M2_PROMPT.cmd        launcher (auto-installs Node + deps, then npm start)
M2_PROMPT_Admin.cmd  same launcher, self-elevated via UAC
package.json electron + electron-builder
```

## 🔒 Security

- Runs with `contextIsolation: true` and `nodeIntegration: false`; the renderer talks to the main process only through the limited API exposed by preload (`window.m2prompt`).
- Section names are sanitized before being used as folder / file names to prevent path traversal.

## 📄 License

[MIT](LICENSE) © 2026 OA Hsiao

---

# M2 PROMPT · 繁體中文

> 🌐 Language / 語言: English · 繁體中文

用來快速撰寫、追蹤與管理 Prompt 的 Electron 桌面 App。沿用
[M2_LOG](https://github.com/M2Station/M2_LOG) 的版面與視覺風格，針對 Prompt
工程調整。左邊填寫專案欄位，右邊可新增多個**功能分頁**（System / User / Context /
Examples / 自訂），插入現成的**片語（snippet）**並輸入 Prompt，按「輸出」即建立
資料夾，內含 `info.json`、合併後的 `prompt.md`，以及每個分頁各一個檔案；日後還能
重新開啟任一輸出資料夾繼續編輯。

## ✨ 功能

### Prompt 撰寫
- **多專案分頁** — 同時處理多個專案；可新增／關閉分頁（至少保留一個）。
- **專案欄位** — 名稱、日期（含「現在時間」更新鈕）、目標模型、備註。
- **由專案名稱產生資料夾名稱** — 自動轉大寫、空白換 `_`，並當作輸出資料夾縮寫（長度可設定，預設 30）。勾選 **PRE_FIX** 會在前面加上 `YYYYMMDD_HHmm_` 日期時間。
- **自訂欄位** — 可新增／移除自己的鍵值欄位（會崁入每次輸出的表頭）。
- **功能分頁** — 動態 Prompt 區塊；`+` 新增、雙擊重新命名、`×` 移除，含行數／字元即時計數。

### 片語（Snippet）
- **片語面板** — 可浮動、拖曳、縮放的一鍵插入面板，依分類分組（功能 / 效能 / DEBUG / 閉迴 / …）。
- **游標處插入** — 點一下片語，即可把可重複使用的角色／目標／步驟／格式／限制區塊直接插入目前分頁（支援復原）。
- **SNIPPET 設定** — 新增／重新命名／刪除分類與片語，或貼上內容直接建立；編輯會存回 `snippets.json` 並即時重建工具列。

### 輸出
- **輸出** 自動建立 `<輸出根目錄>/<[YYYYMMDD_HHmm_]縮寫>/`，內含：
  - `info.json`：專案欄位與分頁清單。
  - `prompt.md`：合併後的完整 Prompt（表頭＋每個有內容的分頁）。
  - 每個有內容的分頁 → `<分頁>/<分頁>.md`（表頭崁在最上面）。
- **輸出此分頁** — 只輸出目前這個分頁（含表頭）。
- **可設定輸出根目錄** — 留空＝App 同層的 `PROMPT_OUTPUT/`，或填絕對路徑（例如 `D:\Prompts`）／用 Browse 選擇。
- **複製摘要**（專案欄位 → 剪貼簿）與 **還原預設**（欄位回到預設值）。
- `Ctrl + Enter` 快速輸出。

### 開啟與編輯
- **開啟專案** — 把先前輸出的資料夾重新載入編輯器（欄位、自訂欄位與所有分頁）。
- **儲存** — 把變更寫回同一個資料夾，讓輸出可以完整往返編輯。

### 外觀
- **設定（⚙）** — 資料夾名稱長度（1–40）、分頁名稱長度（1–100）、佈景主題。
- **佈景主題** — Daylight（淺色）、Low Key（深色）、VS Code（深色）、Army、Army（深色）。
- **中／英雙語** 介面；App 版本顯示在視窗標題列。
- 可拖曳的分隔線；編輯器縮放（`Ctrl +` / `Ctrl -`）；所有欄位／分頁透過 `localStorage` 記憶。

## 🚀 啟動

最簡單：雙擊 `M2_PROMPT.cmd`（第一次會自動安裝 Node.js 與相依套件、下載
Electron，然後啟動）。

或手動：

```
npm install
npm start
```

> 若需要以系統管理員權限執行（例如對應以系統管理員執行的 VS Code），
> 請改用 `M2_PROMPT_Admin.cmd`，它會經由 UAC 自動提權。

## 📂 輸出結構範例

專案名稱 `Customer Support Bot`（縮寫 `CUSTOMER_SUPPORT_BOT`），分頁 System / User：

```
PROMPT_OUTPUT/
└─ CUSTOMER_SUPPORT_BOT/          ← 勾選 PRE_FIX 則為 20260716_1430_CUSTOMER_SUPPORT_BOT/
   ├─ info.json
   ├─ prompt.md          ← 合併後的完整 Prompt（所有分頁）
   ├─ System/
   │  └─ System.md       ← 最上面崁入專案表頭
   └─ User/
      └─ User.md         ← 最上面崁入專案表頭
```

## ⚙️ 設定

- 預設輸出到 App 同層的 `PROMPT_OUTPUT/`（開發時為專案根目錄；安裝後為 EXE 同層）。可在「輸出根目錄」欄位填絕對路徑，或用 Browse 選擇。
- 資料夾／分頁名稱縮寫長度與佈景主題：點右上角 **⚙ 設定**。
- 片語面板存在 `snippets.json` — 可在 App 內透過 **⚙ SNIPPET 設定** 編輯。

## 📦 打包安裝檔

使用 [electron-builder](https://www.electron.build/) 同時產生 x64 與 ARM64 兩種
Windows NSIS 安裝檔：

```
npm install
npm run dist
```

會依架構各產生一個安裝檔：

- `dist\M2_PROMPT-<版本>-x64.exe`
- `dist\M2_PROMPT-<版本>-arm64.exe`

只想建置單一架構時，使用 `npm run dist:x64` 或 `npm run dist:arm64`；`npm run pack`
則只產生未封裝的版本。在 x64 機器上也能順利交叉編譯出 ARM64 版本 —
electron-builder 會自動下載對應的 Electron 二進位檔。

> 🚀 要發佈帶版號的 GitHub Release（推送 `v*` tag 後會自動建置安裝檔並附到
> **Releases** 頁面），請參考 [docs/RELEASE.md](docs/RELEASE.md)。

## 🗂️ 專案結構

```
src/
  main/      Electron 主行程（main / ipc）
  preload/   contextBridge 橋接（window.m2prompt）
  renderer/  index.html、css/styles.css、js/{app,themes}.js、i18n/{en,zh}.json
snippets.json  內建片語面板（可透過 ⚙ SNIPPET 設定 編輯）
scripts/     repair-electron.ps1（修復未安裝完成的 Electron 二進位檔）
docs/        RELEASE.md（帶版號的 GitHub Release 發版指南）
.github/     CI 工作流程（build 健檢／tag 觸發的 release）
M2_PROMPT.cmd        啟動器（自動裝 Node 與相依套件，然後 npm start）
M2_PROMPT_Admin.cmd  同上但經由 UAC 自動提權
package.json electron + electron-builder
```

## 🔒 安全

- 採 `contextIsolation: true`、`nodeIntegration: false`，renderer 只透過 preload 暴露的有限 API（`window.m2prompt`）與主行程溝通。
- 分頁名稱會先消毒再當資料夾／檔案名，避免路徑穿越。

## 📄 授權

[MIT](LICENSE) © 2026 OA Hsiao

