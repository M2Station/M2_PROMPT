/*
 * M2_PROMPT
 * Copyright (c) 2026 OA Hsiao
 * SPDX-License-Identifier: MIT
 *
 * This source code is licensed under the MIT License found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { ipcMain, app, shell, dialog, BrowserWindow } = require('electron');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

// In development the app root is the project folder; once packaged, write next
// to the executable so exports live beside the installed app.
function appRoot() {
  if (app.isPackaged) return path.dirname(app.getPath('exe'));
  return path.join(__dirname, '..', '..');
}

function defaultOutputRoot() {
  return path.join(appRoot(), 'PROMPT_OUTPUT');
}

// Resolve the effective output root: an explicit (absolute) base if the user
// supplied one, otherwise the app-level PROMPT_OUTPUT folder.
function resolveOutputRoot(outputBase) {
  const base = (outputBase || '').trim();
  if (base && path.isAbsolute(base)) return base;
  return defaultOutputRoot();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Sanitize a name so it is safe to use as a file / folder name (no path
// traversal, no reserved characters).
function sanitizeName(name, maxLen) {
  const cleaned = String(name || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/\.+$/, '')
    .replace(/^_+|_+$/g, '');
  const limit = Number.isFinite(maxLen) && maxLen > 0 ? maxLen : 60;
  return (cleaned || 'PROMPT').slice(0, limit);
}

function abbreviate(name, maxLen) {
  const upper = String(name || '')
    .trim()
    .toUpperCase()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '');
  const limit = Number.isFinite(maxLen) && maxLen > 0 ? maxLen : 30;
  return (upper || 'PROMPT').slice(0, limit);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function stamp(d) {
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}`;
  return { date, time };
}

// Build the human-readable header embedded at the top of an exported prompt.
function buildHeader(info) {
  const lines = [];
  lines.push('<!--');
  lines.push(`  Project : ${info.projectName || ''}`);
  if (info.date) lines.push(`  Date    : ${info.date}`);
  if (info.author) lines.push(`  Author  : ${info.author}`);
  if (info.category) lines.push(`  Category: ${info.category}`);
  if (info.model) lines.push(`  Model   : ${info.model}`);
  if (info.notes) lines.push(`  Notes   : ${info.notes}`);
  if (Array.isArray(info.customFields)) {
    for (const f of info.customFields) {
      if (f && f.key) lines.push(`  ${f.key}: ${f.value || ''}`);
    }
  }
  lines.push('-->');
  return lines.join('\n');
}

// Assemble the combined prompt markdown from all non-empty sections.
function buildCombined(info, sections) {
  const parts = [buildHeader(info), ''];
  parts.push(`# ${info.projectName || 'Prompt'}`);
  parts.push('');
  for (const s of sections) {
    const content = (s.content || '').trim();
    if (!content) continue;
    parts.push(`## ${s.name}`);
    parts.push('');
    parts.push(content);
    parts.push('');
  }
  return parts.join('\n');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// IPC registration
// ---------------------------------------------------------------------------

function registerIpc() {
  ipcMain.handle('app:version', () => app.getVersion());

  ipcMain.handle('app:setStartupBg', (_e, color) => {
    try {
      if (typeof color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(color)) {
        const p = path.join(app.getPath('userData'), 'startup.json');
        fs.writeFileSync(p, JSON.stringify({ bg: color }), 'utf8');
      }
    } catch (_err) {
      /* best-effort cache */
    }
    return true;
  });

  ipcMain.handle('shell:openExternal', async (_e, url) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  });

  ipcMain.handle('prompt:openFolder', async (_e, targetPath) => {
    const dir = targetPath && targetPath.trim() ? targetPath : defaultOutputRoot();
    try {
      ensureDir(dir);
    } catch (_err) {
      /* ignore */
    }
    const err = await shell.openPath(dir);
    return !err;
  });

  ipcMain.handle('dialog:pickFolder', async (_e, defaultPath) => {
    const win = BrowserWindow.getFocusedWindow();
    const opts = { properties: ['openDirectory', 'createDirectory'] };
    if (defaultPath && defaultPath.trim()) opts.defaultPath = defaultPath;
    const res = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts);
    if (res.canceled || !res.filePaths.length) return null;
    return res.filePaths[0];
  });

  ipcMain.handle('fs:promptRoot', () => defaultOutputRoot());

  ipcMain.handle('fs:list', (_e, dirPath) => {
    const target = dirPath && dirPath.trim() ? dirPath : defaultOutputRoot();
    try {
      ensureDir(target);
      const entries = fs.readdirSync(target, { withFileTypes: true });
      const items = entries.map((ent) => {
        const full = path.join(target, ent.name);
        let mtime = 0;
        let size = 0;
        try {
          const st = fs.statSync(full);
          mtime = st.mtimeMs;
          size = st.size;
        } catch (_err) {
          /* ignore */
        }
        return {
          name: ent.name,
          path: full,
          isDir: ent.isDirectory(),
          mtime,
          size,
        };
      });
      items.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return b.mtime - a.mtime;
      });
      return { ok: true, path: target, items };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  ipcMain.handle('fs:readText', (_e, filePath) => {
    try {
      const text = fs.readFileSync(filePath, 'utf8');
      return { ok: true, text };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  ipcMain.handle('fs:writeText', (_e, payload) => {
    try {
      const { filePath, text } = payload || {};
      if (!filePath) return { ok: false, error: 'No file path' };
      fs.writeFileSync(filePath, text == null ? '' : String(text), 'utf8');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  ipcMain.handle('i18n:load', (_e, lang) => {
    const safe = lang === 'en' ? 'en' : 'zh';
    try {
      const p = path.join(__dirname, '..', 'renderer', 'i18n', `${safe}.json`);
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (_err) {
      return {};
    }
  });

  // -------- Export a full prompt (all sections) --------
  ipcMain.handle('prompt:export', (_e, payload) => {
    try {
      const info = payload || {};
      const sections = Array.isArray(info.sections) ? info.sections : [];
      const nonEmpty = sections.filter((s) => (s.content || '').trim());
      if (!nonEmpty.length) {
        return { ok: false, error: 'EMPTY' };
      }

      const now = new Date();
      const { date, time } = stamp(now);
      const abbr = abbreviate(info.projectName, info.abbrevLen);
      const folderName = `${date}_${time}_${abbr}`;
      const root = resolveOutputRoot(info.outputBase);
      const outDir = path.join(root, folderName);
      ensureDir(outDir);

      const written = [];

      // info.json — all project fields + section list
      const meta = {
        projectName: info.projectName || '',
        date: info.date || '',
        author: info.author || '',
        category: info.category || '',
        model: info.model || '',
        notes: info.notes || '',
        customFields: info.customFields || [],
        sections: sections.map((s) => ({
          name: s.name,
          chars: (s.content || '').length,
        })),
        exportedAt: now.toISOString(),
      };
      const metaPath = path.join(outDir, 'info.json');
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
      written.push('info.json');

      // Combined prompt.md
      const combined = buildCombined(info, nonEmpty);
      const combinedPath = path.join(outDir, 'prompt.md');
      fs.writeFileSync(combinedPath, combined, 'utf8');
      written.push('prompt.md');

      // Per-section files
      for (const s of nonEmpty) {
        const fileBase = sanitizeName(s.name, info.typeLen);
        const secDir = path.join(outDir, fileBase);
        ensureDir(secDir);
        const secPath = path.join(secDir, `${fileBase}.md`);
        const body = `${buildHeader(info)}\n\n# ${s.name}\n\n${(s.content || '').trim()}\n`;
        fs.writeFileSync(secPath, body, 'utf8');
        written.push(`${fileBase}/${fileBase}.md`);
      }

      return { ok: true, folder: folderName, path: outDir, files: written };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  // -------- Export a single section --------
  ipcMain.handle('prompt:exportSingle', (_e, payload) => {
    try {
      const info = payload || {};
      const section = info.section || {};
      if (!(section.content || '').trim()) {
        return { ok: false, error: 'EMPTY' };
      }

      const now = new Date();
      const { date, time } = stamp(now);
      const abbr = abbreviate(info.projectName, info.abbrevLen);
      const folderName = `${date}_${time}_${abbr}`;
      const root = resolveOutputRoot(info.outputBase);
      const outDir = path.join(root, folderName);
      ensureDir(outDir);

      const fileBase = sanitizeName(section.name, info.typeLen);
      const secDir = path.join(outDir, fileBase);
      ensureDir(secDir);
      const secPath = path.join(secDir, `${fileBase}.md`);
      const body = `${buildHeader(info)}\n\n# ${section.name}\n\n${(section.content || '').trim()}\n`;
      fs.writeFileSync(secPath, body, 'utf8');

      return { ok: true, folder: folderName, path: outDir, files: [`${fileBase}/${fileBase}.md`] };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
}

module.exports = { registerIpc };
