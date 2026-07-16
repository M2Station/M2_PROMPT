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
const { ipcMain, app, shell, dialog, BrowserWindow, nativeImage } = require('electron');

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

// Strip the leading <!-- ... --> header and the first "# heading" from an
// exported section file, returning the section name (from the heading) and its
// body content.
function stripHeaderAndHeading(text) {
  let t = String(text || '').replace(/^\uFEFF/, '');
  const cm = t.match(/^\s*<!--[\s\S]*?-->\s*/);
  if (cm) t = t.slice(cm[0].length);
  let name = null;
  const hm = t.match(/^#\s+(.+?)[ \t]*\r?\n/);
  if (hm) {
    name = hm[1].trim();
    t = t.slice(hm[0].length);
  }
  t = t.replace(/^\r?\n+/, '').replace(/\s+$/, '');
  return { name, content: t };
}

// Parse a combined prompt.md (## Section headings) into { name, content }[].
function parseCombined(text) {
  let t = String(text || '').replace(/^\uFEFF/, '');
  const cm = t.match(/^\s*<!--[\s\S]*?-->\s*/);
  if (cm) t = t.slice(cm[0].length);
  t = t.replace(/^#\s+.+?\r?\n/, ''); // drop the top-level title
  const marks = [];
  const re = /(^|\r?\n)##\s+(.+?)[ \t]*\r?\n/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    marks.push({ start: m.index + m[1].length, bodyStart: re.lastIndex, name: m[2].trim() });
  }
  const sections = [];
  for (let i = 0; i < marks.length; i += 1) {
    const end = i + 1 < marks.length ? marks[i + 1].start : t.length;
    const content = t.slice(marks[i].bodyStart, end).replace(/^\r?\n+/, '').replace(/\s+$/, '');
    sections.push({ name: marks[i].name, content });
  }
  return sections;
}

// Read a previously-exported project folder back into editable data.
function readProjectFolder(dir) {
  const out = {
    projectName: '',
    date: '',
    model: '',
    notes: '',
    customFields: [],
    sections: [],
  };

  let info = null;
  const infoPath = path.join(dir, 'info.json');
  if (fs.existsSync(infoPath)) {
    try {
      info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    } catch (_e) {
      info = null;
    }
  }
  if (info) {
    out.projectName = info.projectName || '';
    out.date = info.date || '';
    out.model = info.model || '';
    out.notes = info.notes || '';
    if (Array.isArray(info.customFields)) {
      out.customFields = info.customFields
        .filter((c) => c && (c.key || c.value))
        .map((c) => ({ key: String(c.key || ''), value: String(c.value || '') }));
    }
  }

  // Sections from per-section subfolders (each holds <name>.md).
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const subdir = path.join(dir, ent.name);
    let mdFile = path.join(subdir, `${ent.name}.md`);
    if (!fs.existsSync(mdFile)) {
      const md = fs.readdirSync(subdir).find((f) => f.toLowerCase().endsWith('.md'));
      if (!md) continue;
      mdFile = path.join(subdir, md);
    }
    try {
      const parsed = stripHeaderAndHeading(fs.readFileSync(mdFile, 'utf8'));
      out.sections.push({ name: parsed.name || ent.name, content: parsed.content });
    } catch (_e) {
      /* skip unreadable section */
    }
  }

  // Preserve the original export order recorded in info.json.
  if (info && Array.isArray(info.sections) && info.sections.length && out.sections.length) {
    const order = info.sections.map((s) => String(s.name || '').toLowerCase());
    out.sections.sort((a, b) => {
      const ia = order.indexOf(a.name.toLowerCase());
      const ib = order.indexOf(b.name.toLowerCase());
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }

  // Fallbacks when there are no per-section subfolders.
  if (!out.sections.length) {
    const combined = path.join(dir, 'prompt.md');
    if (fs.existsSync(combined)) {
      const secs = parseCombined(fs.readFileSync(combined, 'utf8'));
      if (secs.length) out.sections = secs;
    }
  }
  if (!out.sections.length) {
    const anyMd = fs.readdirSync(dir).find((f) => f.toLowerCase().endsWith('.md'));
    if (anyMd) {
      const parsed = stripHeaderAndHeading(fs.readFileSync(path.join(dir, anyMd), 'utf8'));
      out.sections.push({ name: parsed.name || 'Prompt', content: parsed.content });
    }
  }

  if (!out.projectName) {
    out.projectName = path.basename(dir).replace(/^\d{8}_\d{4}_/, '');
  }
  return out;
}

// Write project data into an existing folder (in-place save; overwrites files
// and prunes section folders that are no longer present).
function writeProjectInto(dir, info) {
  ensureDir(dir);
  const sections = Array.isArray(info.sections) ? info.sections : [];
  const nonEmpty = sections.filter((s) => (s.content || '').trim());
  const written = [];

  const meta = {
    projectName: info.projectName || '',
    date: info.date || '',
    model: info.model || '',
    notes: info.notes || '',
    customFields: info.customFields || [],
    sections: sections.map((s) => ({ name: s.name, chars: (s.content || '').length })),
    savedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(dir, 'info.json'), JSON.stringify(meta, null, 2), 'utf8');
  written.push('info.json');

  fs.writeFileSync(path.join(dir, 'prompt.md'), buildCombined(info, nonEmpty), 'utf8');
  written.push('prompt.md');

  const wanted = new Set();
  for (const s of nonEmpty) {
    const base = sanitizeName(s.name, info.typeLen);
    wanted.add(base.toLowerCase());
    const secDir = path.join(dir, base);
    ensureDir(secDir);
    const body = `${buildHeader(info)}\n\n# ${s.name}\n\n${(s.content || '').trim()}\n`;
    fs.writeFileSync(path.join(secDir, `${base}.md`), body, 'utf8');
    written.push(`${base}/${base}.md`);
  }

  // Prune section folders that are no longer present (renamed/removed/emptied).
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    if (wanted.has(ent.name.toLowerCase())) continue;
    const sig = path.join(dir, ent.name, `${ent.name}.md`);
    if (fs.existsSync(sig)) {
      fs.rmSync(path.join(dir, ent.name), { recursive: true, force: true });
    }
  }
  return written;
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

  // Set the window / taskbar icon from a PNG data URL rendered by the renderer
  // (so the app icon matches the in-app M2 logo without a bundled icon file).
  ipcMain.handle('app:setIcon', (_e, dataUrl) => {
    try {
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/png')) {
        const img = nativeImage.createFromDataURL(dataUrl);
        const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
        if (win && img && !img.isEmpty()) win.setIcon(img);
      }
    } catch (_err) {
      /* ignore */
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

  // Open an exported project folder (pick + read) so it can be edited again.
  ipcMain.handle('project:open', async () => {
    try {
      const win = BrowserWindow.getFocusedWindow();
      const opts = { properties: ['openDirectory'], defaultPath: defaultOutputRoot() };
      const res = win
        ? await dialog.showOpenDialog(win, opts)
        : await dialog.showOpenDialog(opts);
      if (res.canceled || !res.filePaths.length) return { canceled: true };
      const dir = res.filePaths[0];
      const project = readProjectFolder(dir);
      return {
        ok: true,
        project: Object.assign({}, project, { sourcePath: dir, parentPath: path.dirname(dir) }),
      };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  // Save edits back into a previously-opened project folder (in place).
  ipcMain.handle('project:save', (_e, payload) => {
    try {
      const info = payload || {};
      const dir = info.sourcePath;
      if (!dir || !path.isAbsolute(dir)) return { ok: false, error: 'NO_PATH' };
      if (!fs.existsSync(dir)) return { ok: false, error: 'MISSING' };
      const files = writeProjectInto(dir, info);
      return { ok: true, path: dir, files };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  ipcMain.handle('snippets:load', () => {
    try {
      const external = path.join(appRoot(), 'snippets.json');
      if (fs.existsSync(external)) {
        return JSON.parse(fs.readFileSync(external, 'utf8'));
      }
    } catch (_e) {
      /* fall through to the project-root copy */
    }
    try {
      const rootCopy = path.join(__dirname, '..', '..', 'snippets.json');
      return JSON.parse(fs.readFileSync(rootCopy, 'utf8'));
    } catch (_e) {
      return {};
    }
  });

  // Persist edited snippets back to the editable snippets.json next to the app.
  ipcMain.handle('snippets:save', (_e, data) => {
    try {
      if (!data || typeof data !== 'object') return { ok: false, error: 'INVALID' };
      const external = path.join(appRoot(), 'snippets.json');
      fs.writeFileSync(external, JSON.stringify(data, null, 2), 'utf8');
      return { ok: true, path: external };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  // Open the editable snippets.json in the OS default application so power
  // users can edit it by hand. Ensures the external editable copy exists first
  // (seeding it from the packaged project-root copy when missing).
  ipcMain.handle('snippets:openFile', async () => {
    try {
      const external = path.join(appRoot(), 'snippets.json');
      if (!fs.existsSync(external)) {
        let seed = '{}\n';
        try {
          const rootCopy = path.join(__dirname, '..', '..', 'snippets.json');
          if (fs.existsSync(rootCopy)) seed = fs.readFileSync(rootCopy, 'utf8');
        } catch (_e) {
          /* fall back to an empty object */
        }
        fs.writeFileSync(external, seed, 'utf8');
      }
      const err = await shell.openPath(external);
      if (err) return { ok: false, error: err };
      return { ok: true, path: external };
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
      const folderName = info.usePrefix === false ? abbr : `${date}_${time}_${abbr}`;
      const root = resolveOutputRoot(info.outputBase);
      const outDir = path.join(root, folderName);
      ensureDir(outDir);

      const written = [];

      // info.json — all project fields + section list
      const meta = {
        projectName: info.projectName || '',
        date: info.date || '',
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
      const folderName = info.usePrefix === false ? abbr : `${date}_${time}_${abbr}`;
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
