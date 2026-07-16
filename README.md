# M2 PROMPT

> 🌐 Language / 語言: English · 繁體中文

An Electron desktop app for quickly authoring prompts. Same layout and visual
language as [M2_LOG](https://github.com/M2Station/M2_LOG), adapted for prompt
engineering. Fill in the project fields on the left, add any number of
**function tabs** on the right (System / User / Context / Examples / custom) and
type your prompt, then hit **Export** — the app writes a timestamped folder with
`info.json`, a combined `prompt.md`, and one file per section.

## ✨ Features

### Prompt authoring
- **Multi-project tabs** — work on several projects at once; add / close tabs (at least one stays open).
- **Project fields** — Name, Date (with a "now" refresh button), Author, Category, Target Model, Notes.
- **Custom fields** — add / remove your own key/value fields.
- **Function tabs** — dynamic prompt sections; `+` to add, double-click to rename, `×` to remove. Live line / character counter.

### Export
- **Export** creates `<output-root>/<YYYYMMDD>_<HHmm>_<ABBR>/` containing:
  - `info.json` — all project fields + section list.
  - `prompt.md` — the combined prompt (header + every non-empty section).
  - `<section>/<section>.md` for each non-empty section (header embedded).
- **Export This Tab** — export only the current section.
- **Configurable output root** — leave empty for the app-level `PROMPT_OUTPUT/`, or enter an absolute path / pick one via Browse.
- `Ctrl + Enter` to export quickly.

### Look & feel
- **Settings (⚙)** — folder-name length (1–40), tab-name length (1–100), theme.
- **Themes** — Daylight (Light), Low Key (Dark), VS Code (Dark), Army, Army (Dark).
- **Bilingual EN / 中** interface.
- Draggable splitter; all fields / sections persist via `localStorage`.

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
└─ 20260716_1430_CUSTOMER_SUPPORT_BOT/
   ├─ info.json
   ├─ prompt.md          ← combined prompt (all sections)
   ├─ System/
   │  └─ System.md
   └─ User/
      └─ User.md
```

## 🗂️ Project structure

```
src/
  main/      Electron main process (main / ipc)
  preload/   contextBridge bridge (window.m2prompt)
  renderer/  index.html, css/styles.css, js/{app,themes}.js, i18n/{en,zh}.json
scripts/     repair-electron.ps1 (rebuilds a half-installed Electron binary)
M2_PROMPT.cmd        launcher (auto-installs Node + deps, then npm start)
M2_PROMPT_Admin.cmd  same launcher, self-elevated via UAC
package.json electron + electron-builder
```

## 📦 Build the installer

```
npm install
npm run dist
```

Produces `dist\M2_PROMPT-<version>-x64.exe` and `...-arm64.exe`. Use
`npm run dist:x64` / `npm run dist:arm64` for a single architecture, or
`npm run pack` for an unpacked build.

## 🔒 Security

- Runs with `contextIsolation: true` and `nodeIntegration: false`; the renderer talks to main only through the limited API exposed by preload.
- Section names are sanitized before being used as folder / file names to prevent path traversal.

## 📄 License

MIT © 2026 OA Hsiao

---

# M2 PROMPT · 繁體中文

> 🌐 Language / 語言: English · 繁體中文

用來快速撰寫 Prompt 的 Electron 桌面 App。沿用
[M2_LOG](https://github.com/M2Station/M2_LOG) 的版面與視覺風格，針對 Prompt
工程調整。左邊填寫專案欄位，右邊可新增多個**功能分頁**（System / User / Context /
Examples / 自訂）輸入 Prompt，按「輸出」即自動建立帶時間戳的資料夾，內含
`info.json`、合併後的 `prompt.md`，以及每個分頁各一個檔案。

## ✨ 功能

### Prompt 撰寫
- **多專案分頁** — 同時處理多個專案；可新增／關閉分頁（至少保留一個）。
- **專案欄位** — 名稱、日期（含「現在時間」更新鈕）、作者、分類、目標模型、備註。
- **自訂欄位** — 可新增／移除自己的鍵值欄位。
- **功能分頁** — 動態 Prompt 區塊；`+` 新增、雙擊重新命名、`×` 移除，含行數／字元即時計數。

### 輸出
- **輸出** 自動建立 `<輸出根目錄>/<YYYYMMDD>_<HHmm>_<縮寫>/`，內含：
  - `info.json`：專案欄位與分頁清單。
  - `prompt.md`：合併後的完整 Prompt（表頭＋每個有內容的分頁）。
  - 每個有內容的分頁 → `<分頁>/<分頁>.md`（表頭崁在最上面）。
- **輸出此分頁** — 只輸出目前這個分頁。
- **可設定輸出根目錄** — 留空＝App 同層的 `PROMPT_OUTPUT/`，或填絕對路徑／用 Browse 選擇。
- `Ctrl + Enter` 快速輸出。

### 外觀
- **設定（⚙）** — 資料夾名稱長度（1–40）、分頁名稱長度（1–100）、佈景主題。
- **佈景主題** — Daylight（淺色）、Low Key（深色）、VS Code（深色）、Army、Army（深色）。
- **中／英雙語** 介面。
- 可拖曳的分隔線；所有欄位／分頁透過 `localStorage` 記憶。

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

## 📄 授權

MIT © 2026 OA Hsiao

