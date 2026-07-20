# 發版流程 / Release Process

M2_PROMPT 的發版流程。發版透過推送版號 **tag**（`v*`）自動觸發
[`.github/workflows/release.yml`](../.github/workflows/release.yml)：它會用
electron-builder 建置 Windows NSIS 安裝檔（x64 + ARM64），並建立對應的 GitHub
Release、把安裝檔上傳到 **Releases 頁面**。

> 🌐 Language / 語言：本文件以繁體中文為主，指令可直接複製使用。

---

## 前置條件 / Prerequisites

- [GitHub CLI](https://cli.github.com/) `gh`（已登入：`gh auth status`）
- `git`、Node.js / npm
- 對 repo 有 push 權限（含推送 tag）

---

## 版號規則 / Versioning

採用語意化版號 `MAJOR.MINOR.PATCH`。當只說 **`RELEASE`**（不給版號）時的預設行為：

| 指令 | 由 `0.1.0` 推算 | 說明 |
|------|----------------|------|
| `RELEASE`       | `0.1.1` | 預設：**patch +1** |
| `RELEASE minor` | `0.2.0` | minor +1，patch 歸零 |
| `RELEASE major` | `1.0.0` | major +1，其餘歸零 |
| `RELEASE X.Y.Z` | `X.Y.Z` | 指定版號 |

> 若指定版號**跳號**（例如 `0.1.0 → 0.1.3`），請先確認是否刻意跳過。

---

## 發版步驟 / Steps to cut a release `vX.Y.Z`

### 1. 同步 `main`

```powershell
git checkout main
git pull origin main --ff-only
```

### 2. 更新版號（兩個檔案）

- `package.json` → `version`
- `package-lock.json` → **兩處**：頂層 `version` 與 `packages[""].version`

> ⚠️ 兩個檔案的版號必須一致，否則 `npm ci`（CI 使用）會失敗。
> 也可以直接用 `npm version X.Y.Z --no-git-tag-version` 一次更新兩個檔案。

### 3. 本機驗證建置（可選但建議）

```powershell
npm ci
npm run pack        # 只建未封裝版，快速確認能打包
```

### 4. 提交並推送

```powershell
git commit -am "chore: release vX.Y.Z"
git push origin main
```

> 若 `main` 為受保護分支，請改走 PR：建立 `chore/release-vX.Y.Z` 分支、開 PR、
> 等 **Build** 檢查通過後合併，再回到 `main` 打 tag。

### 5. 打 tag 並推送（觸發自動發佈）

```powershell
git tag -a vX.Y.Z -m "M2_PROMPT vX.Y.Z"
git push origin vX.Y.Z
```

推送 tag 會觸發 [`release.yml`](../.github/workflows/release.yml)，
在 `windows-latest` 上建置並自動建立 GitHub Release。

### 6. 驗證發佈結果

```powershell
gh run list --workflow Release --limit 1
gh release view vX.Y.Z --json name,tagName,url,assets
```

Release 應包含下方列出的安裝檔。

---

## 雙架構建置 / Dual-arch build (x64 + ARM64)

`package.json` 的 build 設定：

```jsonc
"win": {
  "target": [{ "target": "nsis", "arch": ["x64", "arm64"] }],
  "artifactName": "${productName}-${version}-${arch}.${ext}"
}
```

electron-builder 會產生數個 `.exe`，release workflow 會把 `dist\*.exe` 全部上傳到
Release：

| 檔案 | 架構 |
|------|------|
| `M2_PROMPT-<ver>-x64.exe`   | x64 |
| `M2_PROMPT-<ver>-arm64.exe` | ARM64 |

本機建置指令：

```powershell
npm run dist          # x64 + ARM64
npm run dist:x64      # 只建 x64
npm run dist:arm64    # 只建 ARM64
npm run pack          # 只產生未封裝的 dist\win-unpacked\（測試用）
```

> ARM64 版本可在 x64 機器上交叉編譯 — electron-builder 會自動下載對應的 ARM64
> Electron 二進位檔。

---

## 手動觸發 / Manual trigger

不想打 tag 時，也可以在 GitHub 的 **Actions → Release → Run workflow**
（`workflow_dispatch`）手動執行；此時會以當下的預設分支建置，Release 名稱取自
執行時的 ref。一般情況仍建議走 tag 流程以保留版本對應。

---

## 注意事項 / Gotchas

- **Tag 名稱以 `v` 開頭**（例如 `v0.1.1`），否則不會觸發 release workflow。
- release workflow 用 `npm run dist -- --publish never` 只在本機建置，改由後續的
  `gh release create` 步驟上傳；避免 electron-builder 自行發佈而因缺少 token 失敗。
- 需要 repo 的 **Actions 對 contents 有 write 權限**（workflow 已宣告
  `permissions: contents: write`，使用內建的 `GITHUB_TOKEN`）。
- 重打同一個 tag 前，請先刪除舊 tag 與對應 Release，否則 `gh release create` 會失敗。
