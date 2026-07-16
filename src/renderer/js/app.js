/*
 * M2_PROMPT
 * Copyright (c) 2026 OA Hsiao
 * SPDX-License-Identifier: MIT
 *
 * This source code is licensed under the MIT License found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict';

(function () {
  const api = window.m2prompt;
  const $ = (sel) => document.querySelector(sel);
  const el = (id) => document.getElementById(id);

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  const STORE_KEY = 'm2prompt_state_v1';
  const DEFAULT_SECTIONS = ['System', 'User', 'Context', 'Examples'];

  let i18n = {};
  let lang = 'zh';

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function newSection(name) {
    return { id: uid(), name: name || 'Prompt', content: '' };
  }

  function newProject() {
    return {
      id: uid(),
      fields: {
        projectName: '',
        date: todayStr(),
        model: '',
        notes: '',
        customFields: [],
      },
      sections: DEFAULT_SECTIONS.map((n) => newSection(n)),
      activeSectionId: null,
    };
  }

  function defaultState() {
    const p = newProject();
    p.activeSectionId = p.sections[0].id;
    return {
      lang: 'zh',
      abbrevLen: 30,
      typeLen: 60,
      leftWidth: 380,
      usePrefix: false,
      outputBase: '',
      editorFontSize: 13,
      projects: [p],
      activeProjectId: p.id,
    };
  }

  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && Array.isArray(s.projects) && s.projects.length) return s;
      }
    } catch (_e) {
      /* ignore */
    }
    return defaultState();
  }

  function saveState() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (_e) {
      /* ignore */
    }
    updateSaveButton();
  }

  function activeProject() {
    return state.projects.find((p) => p.id === state.activeProjectId) || state.projects[0];
  }

  function activeSection(proj) {
    const p = proj || activeProject();
    return p.sections.find((s) => s.id === p.activeSectionId) || p.sections[0];
  }

  // Serialize a project's savable content, to detect unsaved edits after Open.
  function projectSignature(p) {
    const f = p.fields || {};
    return JSON.stringify({
      projectName: f.projectName || '',
      date: f.date || '',
      model: f.model || '',
      notes: f.notes || '',
      customFields: f.customFields || [],
      sections: (p.sections || []).map((s) => ({ name: s.name, content: s.content })),
    });
  }

  // Show the SAVE button only for a project opened from disk with unsaved edits.
  function updateSaveButton() {
    const btn = document.getElementById('btnSave');
    if (!btn) return;
    const p = activeProject();
    const dirty = !!(p && p.sourcePath && projectSignature(p) !== p.savedSig);
    btn.style.display = dirty ? '' : 'none';
  }

  // A section (tab) is "dirty" when its content or name differs from the version
  // last opened/saved from disk. Only meaningful for projects opened from disk.
  function sectionDirty(p, s) {
    if (!p || !p.sourcePath) return false;
    return s.content !== s.savedContent || s.name !== s.savedName;
  }

  // Toggle the red "modified" style on each section tab in place (no rebuild).
  function refreshSectionTabDirty() {
    const p = activeProject();
    const tabs = document.getElementById('sectionTabs');
    if (!tabs) return;
    tabs.querySelectorAll('.tab').forEach((b) => {
      const sid = b.dataset.sid;
      if (!sid) return;
      const s = p.sections.find((x) => x.id === sid);
      b.classList.toggle('dirty', !!(s && sectionDirty(p, s)));
    });
  }

  // ------------------------------------------------------------------
  // i18n
  // ------------------------------------------------------------------
  function t(key) {
    return (i18n && i18n[key]) || key;
  }

  async function loadLang(next) {
    lang = next === 'en' ? 'en' : 'zh';
    state.lang = lang;
    try {
      i18n = (await api.loadI18n(lang)) || {};
    } catch (_e) {
      i18n = {};
    }
    applyI18n();
    el('langLabel').textContent = lang === 'zh' ? '中' : 'EN';
    renderAll();
    saveState();
  }

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const k = node.getAttribute('data-i18n');
      const v = t(k);
      if (v) node.textContent = v;
    });
    document.querySelectorAll('[data-i18n-ph]').forEach((node) => {
      const k = node.getAttribute('data-i18n-ph');
      const v = t(k);
      if (v) node.setAttribute('placeholder', v);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((node) => {
      const k = node.getAttribute('data-i18n-title');
      const v = t(k);
      if (v) node.setAttribute('title', v);
    });
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function abbreviate(name, maxLen) {
    const upper = String(name || '')
      .trim()
      .toUpperCase()
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, '_')
      .replace(/^_+|_+$/g, '');
    const limit = maxLen > 0 ? maxLen : 30;
    return (upper || 'PROMPT').slice(0, limit);
  }

  function folderPreview() {
    const abbr = abbreviate(activeProject().fields.projectName, state.abbrevLen);
    if (!state.usePrefix) return abbr;
    const d = new Date();
    const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const time = `${pad(d.getHours())}${pad(d.getMinutes())}`;
    return `${date}_${time}_${abbr}`;
  }

  function counterText(text) {
    const lines = text ? text.split('\n').length : 0;
    const chars = text ? text.length : 0;
    if (lang === 'zh') return `${lines} 行 · ${chars} 字元`;
    return `${lines} lines · ${chars} chars`;
  }

  // Editor-only font size (persisted). Affects just the prompt textarea.
  function editorFontPx() {
    const v = Number(state.editorFontSize);
    return Number.isFinite(v) ? Math.max(10, Math.min(28, v)) : 13;
  }

  function setEditorFont(size) {
    const next = Math.max(10, Math.min(28, Math.round(size)));
    state.editorFontSize = next;
    const ta = el('sectionBody') && el('sectionBody').querySelector('.log-input');
    if (ta) ta.style.fontSize = next + 'px';
    saveState();
  }

  function bumpEditorFont(delta) {
    setEditorFont(editorFontPx() + delta);
  }

  // ------------------------------------------------------------------
  // Toasts
  // ------------------------------------------------------------------
  function toast(msg, kind) {
    const box = el('toasts');
    const node = document.createElement('div');
    node.className = `toast toast-${kind || 'info'}`;
    node.textContent = msg;
    box.appendChild(node);
    requestAnimationFrame(() => node.classList.add('show'));
    setTimeout(() => {
      node.classList.remove('show');
      setTimeout(() => node.remove(), 320);
    }, 2600);
  }

  // ------------------------------------------------------------------
  // Rendering: project tabs
  // ------------------------------------------------------------------
  function renderProjectTabs() {
    const nav = el('projTabs');
    nav.innerHTML = '';
    state.projects.forEach((p) => {
      const btn = document.createElement('button');
      btn.className = 'exp-tab' + (p.id === state.activeProjectId ? ' active' : '');
      const name = document.createElement('span');
      const label = (p.fields.projectName || '').trim();
      name.className = 'exp-tab-name' + (label ? '' : ' untitled');
      name.textContent = label || (lang === 'zh' ? '未命名' : 'Untitled');
      btn.appendChild(name);
      btn.addEventListener('click', () => {
        state.activeProjectId = p.id;
        saveState();
        renderAll();
      });
      if (state.projects.length > 1) {
        const close = document.createElement('span');
        close.className = 'exp-tab-close';
        close.textContent = '\u00d7';
        close.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = state.projects.findIndex((x) => x.id === p.id);
          state.projects.splice(idx, 1);
          if (state.activeProjectId === p.id) {
            state.activeProjectId = state.projects[Math.max(0, idx - 1)].id;
          }
          saveState();
          renderAll();
        });
        btn.appendChild(close);
      }
      nav.appendChild(btn);
    });

    const add = document.createElement('button');
    add.className = 'exp-tab-add';
    add.textContent = '+';
    add.title = lang === 'zh' ? '新增專案' : 'New project';
    add.addEventListener('click', () => {
      const p = newProject();
      p.activeSectionId = p.sections[0].id;
      state.projects.push(p);
      state.activeProjectId = p.id;
      saveState();
      renderAll();
    });
    nav.appendChild(add);
  }

  // ------------------------------------------------------------------
  // Rendering: fields
  // ------------------------------------------------------------------
  function renderFields() {
    const f = activeProject().fields;
    el('projectName').value = f.projectName || '';
    el('date').value = f.date || '';
    el('model').value = f.model || '';
    el('notes').value = f.notes || '';
    el('outputBase').value = state.outputBase || '';
    el('usePrefix').checked = state.usePrefix === true;
    el('folderPreview').textContent = folderPreview();
    renderCustomFields();
  }

  function renderCustomFields() {
    const wrap = el('customFields');
    const f = activeProject().fields;
    wrap.innerHTML = '';
    if (!f.customFields.length) {
      const empty = document.createElement('div');
      empty.className = 'custom-empty';
      empty.textContent = t('custom.empty');
      wrap.appendChild(empty);
      return;
    }
    f.customFields.forEach((row, i) => {
      const div = document.createElement('div');
      div.className = 'custom-row';
      const key = document.createElement('input');
      key.type = 'text';
      key.value = row.key || '';
      key.placeholder = t('custom.key.ph');
      key.addEventListener('input', () => {
        row.key = key.value;
        saveState();
      });
      const val = document.createElement('input');
      val.type = 'text';
      val.value = row.value || '';
      val.placeholder = t('custom.value.ph');
      val.addEventListener('input', () => {
        row.value = val.value;
        saveState();
      });
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'btn-remove';
      rm.textContent = '\u00d7';
      rm.addEventListener('click', () => {
        f.customFields.splice(i, 1);
        saveState();
        renderCustomFields();
      });
      div.appendChild(key);
      div.appendChild(val);
      div.appendChild(rm);
      wrap.appendChild(div);
    });
  }

  // ------------------------------------------------------------------
  // Rendering: section (function) tabs + editor
  // ------------------------------------------------------------------
  let pendingRenameId = null;

  // Section (tab) names must be unique within a project - they become folder /
  // file names on export, so a clash would overwrite files. Compared
  // case-insensitively (Windows paths are case-insensitive).
  function sectionNameExists(proj, nameLower, excludeId) {
    return proj.sections.some(
      (x) => x.id !== excludeId && (x.name || '').trim().toLowerCase() === nameLower
    );
  }

  function uniqueSectionName(proj, base, excludeId) {
    const fallback = lang === 'zh' ? '新分頁' : 'New';
    const trimmed = (base || '').trim() || fallback;
    let candidate = trimmed;
    let n = 2;
    while (sectionNameExists(proj, candidate.toLowerCase(), excludeId)) {
      candidate = `${trimmed} (${n})`;
      n += 1;
    }
    return candidate;
  }

  function renderSectionTabs() {
    const p = activeProject();
    const tabs = el('sectionTabs');
    tabs.innerHTML = '';
    if (!p.sections.some((s) => s.id === p.activeSectionId)) {
      p.activeSectionId = p.sections[0] && p.sections[0].id;
    }
    p.sections.forEach((s) => {
      const btn = document.createElement('button');
      btn.className = 'tab' + (s.id === p.activeSectionId ? ' active' : '');
      btn.title = t('tab.rename.title');
      btn.dataset.sid = s.id;

      const name = document.createElement('span');
      name.className = 'tab-name';
      name.textContent = s.name;
      btn.appendChild(name);

      // Single click switches tab with a LIGHT update (toggle active class +
      // rebuild the editor only). We intentionally do NOT rebuild the tab
      // buttons here, so the element survives and dblclick-to-rename fires.
      btn.addEventListener('click', () => {
        if (p.activeSectionId !== s.id) {
          p.activeSectionId = s.id;
          saveState();
        }
        el('sectionTabs')
          .querySelectorAll('.tab')
          .forEach((b) => b.classList.toggle('active', b.dataset.sid === s.id));
        renderEditor();
      });
      btn.addEventListener('dblclick', (e) => {
        e.preventDefault();
        beginRename(s, btn, name);
      });

      if (p.sections.length > 1) {
        const close = document.createElement('span');
        close.className = 'exp-tab-close';
        close.textContent = '\u00d7';
        close.style.marginLeft = '2px';
        close.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = p.sections.findIndex((x) => x.id === s.id);
          p.sections.splice(idx, 1);
          if (p.activeSectionId === s.id) {
            p.activeSectionId = p.sections[Math.max(0, idx - 1)].id;
          }
          saveState();
          renderSection();
        });
        btn.appendChild(close);
      }
      tabs.appendChild(btn);

      if (s.id === pendingRenameId) {
        pendingRenameId = null;
        requestAnimationFrame(() => beginRename(s, btn, name));
      }
    });

    const add = document.createElement('button');
    add.className = 'tab tab-add';
    add.textContent = '+';
    add.addEventListener('click', () => {
      const s = newSection(uniqueSectionName(p, lang === 'zh' ? '新分頁' : 'New'));
      p.sections.push(s);
      p.activeSectionId = s.id;
      pendingRenameId = s.id;
      saveState();
      renderSection();
    });
    tabs.appendChild(add);
    refreshSectionTabDirty();
  }

  // Inline tab rename (Electron's renderer has no window.prompt). Swaps the
  // tab label for a text input; Enter / blur commits, Escape cancels.
  function beginRename(s, btn, nameSpan) {
    if (btn.querySelector('.tab-rename-input')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tab-rename-input';
    input.value = s.name;
    input.spellcheck = false;
    input.maxLength = 100;

    ['click', 'dblclick', 'mousedown'].forEach((ev) =>
      input.addEventListener(ev, (e) => e.stopPropagation())
    );

    let done = false;
    const commit = (save) => {
      if (done) return;
      const next = input.value.trim();
      // Reject a name that clashes with another tab in this project.
      if (save && next && sectionNameExists(activeProject(), next.toLowerCase(), s.id)) {
        toast(t('toast.dupName'), 'error');
        requestAnimationFrame(() => {
          input.focus();
          input.select();
        });
        return;
      }
      done = true;
      if (save && next) {
        s.name = next;
        saveState();
      }
      renderSection();
    };

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        commit(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        commit(false);
      }
    });
    input.addEventListener('blur', () => commit(true));

    nameSpan.replaceWith(input);
    input.focus();
    input.select();
  }

  function renderSection() {
    renderSectionTabs();
    renderEditor();
  }

  function renderEditor() {
    const p = activeProject();
    const s = activeSection(p);
    const body = el('sectionBody');
    body.innerHTML = '';
    if (!s) return;

    const pane = document.createElement('div');
    pane.className = 'log-pane active';

    const ta = document.createElement('textarea');
    ta.className = 'log-input';
    ta.value = s.content || '';
    ta.style.fontSize = editorFontPx() + 'px';
    ta.placeholder =
      lang === 'zh'
        ? `在此輸入「${s.name}」的 Prompt 內容…`
        : `Enter the "${s.name}" prompt here…`;
    ta.spellcheck = false;
    ta.addEventListener('input', () => {
      s.content = ta.value;
      el('counter').textContent = counterText(ta.value);
      saveState();
      refreshSectionTabDirty();
    });
    ta.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        doExport();
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          bumpEditorFont(1);
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          bumpEditorFont(-1);
        } else if (e.key === '0') {
          e.preventDefault();
          setEditorFont(13);
        }
      }
    });

    pane.appendChild(ta);
    body.appendChild(pane);
    el('counter').textContent = counterText(s.content || '');
  }

  // ------------------------------------------------------------------
  // Field input wiring
  // ------------------------------------------------------------------
  function wireFields() {
    const map = {
      projectName: 'projectName',
      date: 'date',
      model: 'model',
      notes: 'notes',
    };
    Object.keys(map).forEach((id) => {
      el(id).addEventListener('input', () => {
        activeProject().fields[map[id]] = el(id).value;
        if (id === 'projectName') {
          el('folderPreview').textContent = folderPreview();
          renderProjectTabs();
        }
        saveState();
      });
    });

    el('btnRefreshTime').addEventListener('click', () => {
      activeProject().fields.date = todayStr();
      el('date').value = activeProject().fields.date;
      el('folderPreview').textContent = folderPreview();
      saveState();
    });

    el('outputBase').addEventListener('input', () => {
      state.outputBase = el('outputBase').value;
      saveState();
    });

    el('usePrefix').addEventListener('change', () => {
      state.usePrefix = el('usePrefix').checked;
      el('folderPreview').textContent = folderPreview();
      saveState();
    });

    el('btnAddField').addEventListener('click', () => {
      activeProject().fields.customFields.push({ key: '', value: '' });
      saveState();
      renderCustomFields();
    });

    el('btnResetFields').addEventListener('click', () => {
      const p = activeProject();
      p.fields = {
        projectName: '',
        date: todayStr(),
        model: '',
        notes: '',
        customFields: [],
      };
      saveState();
      renderFields();
      renderProjectTabs();
      toast(t('toast.reset'), 'info');
    });

    el('btnCopySummary').addEventListener('click', async () => {
      const f = activeProject().fields;
      const lines = [
        `Project : ${f.projectName || ''}`,
        `Date    : ${f.date || ''}`,
        `Model   : ${f.model || ''}`,
        `Notes   : ${f.notes || ''}`,
      ];
      f.customFields.forEach((c) => {
        if (c.key) lines.push(`${c.key}: ${c.value || ''}`);
      });
      try {
        await navigator.clipboard.writeText(lines.join('\n'));
        toast(t('toast.summaryOk'), 'success');
      } catch (_e) {
        toast('Clipboard error', 'error');
      }
    });

    el('btnClearLogs').addEventListener('click', () => {
      const s = activeSection();
      if (s) {
        s.content = '';
        saveState();
        renderSection();
      }
    });

    el('btnFontDown').addEventListener('click', () => bumpEditorFont(-1));
    el('btnFontUp').addEventListener('click', () => bumpEditorFont(1));
  }

  // ------------------------------------------------------------------
  // Export
  // ------------------------------------------------------------------
  function exportPayload() {
    const p = activeProject();
    return {
      projectName: p.fields.projectName,
      date: p.fields.date,
      model: p.fields.model,
      notes: p.fields.notes,
      customFields: p.fields.customFields,
      outputBase: state.outputBase,
      usePrefix: state.usePrefix === true,
      abbrevLen: state.abbrevLen,
      typeLen: state.typeLen,
      sections: p.sections.map((s) => ({ name: s.name, content: s.content })),
    };
  }

  async function doExport() {
    const btn = el('btnExport');
    btn.classList.add('loading');
    try {
      const res = await api.exportPrompt(exportPayload());
      if (res && res.ok) {
        showResult(res);
        toast(`${t('toast.exportOk')} ${res.folder}`, 'success');
      } else if (res && res.error === 'EMPTY') {
        toast(t('toast.exportEmpty'), 'error');
      } else {
        toast(t('toast.exportErr') + (res ? res.error : ''), 'error');
      }
    } catch (e) {
      toast(t('toast.exportErr') + e.message, 'error');
    } finally {
      btn.classList.remove('loading');
    }
  }

  async function doExportSingle() {
    const p = activeProject();
    const s = activeSection(p);
    if (!s) return;
    const payload = exportPayload();
    delete payload.sections;
    payload.section = { name: s.name, content: s.content };
    try {
      const res = await api.exportSinglePrompt(payload);
      if (res && res.ok) {
        showResult(res);
        toast(`${t('toast.exportOk')} ${res.folder}`, 'success');
      } else if (res && res.error === 'EMPTY') {
        toast(t('toast.exportEmpty'), 'error');
      } else {
        toast(t('toast.exportErr') + (res ? res.error : ''), 'error');
      }
    } catch (e) {
      toast(t('toast.exportErr') + e.message, 'error');
    }
  }

  async function doSave() {
    const p = activeProject();
    if (!p.sourcePath) return;
    const btn = el('btnSave');
    btn.classList.add('loading');
    try {
      const payload = exportPayload();
      payload.sourcePath = p.sourcePath;
      const res = await api.saveProject(payload);
      if (res && res.ok) {
        p.sections.forEach((s) => {
          s.savedContent = s.content;
          s.savedName = s.name;
        });
        p.savedSig = projectSignature(p);
        saveState();
        refreshSectionTabDirty();
        toast(t('toast.saveOk'), 'success');
      } else {
        toast(t('toast.saveErr') + (res ? res.error : ''), 'error');
      }
    } catch (e) {
      toast(t('toast.saveErr') + e.message, 'error');
    } finally {
      btn.classList.remove('loading');
    }
  }

  function showResult(res) {
    const box = el('result');
    box.classList.remove('hidden');
    box.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'result-head';
    const title = document.createElement('span');
    title.className = 'result-title';
    title.textContent = t('result.title');
    const openBtn = document.createElement('button');
    openBtn.className = 'btn btn-ghost btn-sm';
    openBtn.textContent = t('result.open');
    openBtn.addEventListener('click', () => api.openFolder(res.path));
    head.appendChild(title);
    head.appendChild(openBtn);
    const pathEl = document.createElement('div');
    pathEl.className = 'result-path';
    pathEl.textContent = res.path;
    const list = document.createElement('ul');
    list.className = 'result-files';
    (res.files || []).forEach((fname) => {
      const li = document.createElement('li');
      li.textContent = fname;
      list.appendChild(li);
    });
    box.appendChild(head);
    box.appendChild(pathEl);
    box.appendChild(list);
  }

  // ------------------------------------------------------------------
  // Open an exported project folder for editing
  // ------------------------------------------------------------------
  async function openProjectFolder() {
    let res;
    try {
      res = await api.openProject();
    } catch (e) {
      toast(t('toast.openErr') + e.message, 'error');
      return;
    }
    if (!res || res.canceled) return;
    if (!res.ok) {
      toast(t('toast.openErr') + (res.error || ''), 'error');
      return;
    }
    const d = res.project || {};
    if (!Array.isArray(d.sections) || !d.sections.length) {
      toast(t('toast.openEmpty'), 'error');
      return;
    }

    const proj = newProject();
    proj.fields.projectName = d.projectName || '';
    proj.fields.date = d.date || todayStr();
    proj.fields.model = d.model || '';
    proj.fields.notes = d.notes || '';
    proj.fields.customFields = Array.isArray(d.customFields)
      ? d.customFields.map((c) => ({ key: c.key || '', value: c.value || '' }))
      : [];

    proj.sections = [];
    d.sections.forEach((s) => {
      const nm = uniqueSectionName(proj, s.name || 'Prompt');
      const ns = newSection(nm);
      ns.content = s.content || '';
      ns.savedContent = ns.content;
      ns.savedName = nm;
      proj.sections.push(ns);
    });
    proj.activeSectionId = proj.sections[0].id;
    proj.sourcePath = d.sourcePath || '';
    proj.savedSig = projectSignature(proj);

    state.projects.push(proj);
    state.activeProjectId = proj.id;
    saveState();
    renderAll();
    toast(t('toast.openOk'), 'success');
  }

  // ------------------------------------------------------------------
  // Feature view switching
  // ------------------------------------------------------------------
  function wireViews() {
    document.querySelectorAll('.feature-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        document.querySelectorAll('.feature-tab').forEach((b) => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.feature-view').forEach((v) => v.classList.remove('active'));
        el('view-' + view).classList.add('active');
      });
    });

    el('btnExport').addEventListener('click', doExport);
    el('btnExportSingle').addEventListener('click', doExportSingle);
    el('btnSave').addEventListener('click', doSave);
    el('btnOpenExplorer').addEventListener('click', () => api.openFolder(''));
    el('btnOpenProject').addEventListener('click', openProjectFolder);
    el('btnOpenFolder').addEventListener('click', () => {
      const base = (state.outputBase || '').trim();
      api.openFolder(base);
    });
    el('btnOpenBase').addEventListener('click', () => {
      const base = (state.outputBase || '').trim();
      api.openFolder(base);
    });
    el('btnBrowseBase').addEventListener('click', async () => {
      const picked = await api.pickFolder(state.outputBase);
      if (picked) {
        state.outputBase = picked;
        el('outputBase').value = picked;
        saveState();
      }
    });

    el('appCredit').addEventListener('click', (e) => {
      e.preventDefault();
      api.openExternal('https://github.com/oahsiao');
    });

    el('btnLang').addEventListener('click', () => loadLang(lang === 'zh' ? 'en' : 'zh'));

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const outputVisible = el('view-output').classList.contains('active');
        if (outputVisible) {
          e.preventDefault();
          doExport();
        }
      }
    });
  }

  // ------------------------------------------------------------------
  // Settings
  // ------------------------------------------------------------------
  function wireSettings() {
    const modal = el('settingsModal');
    el('btnSettings').addEventListener('click', () => {
      populateSettings();
      modal.classList.remove('hidden');
    });
    el('btnSettingsClose').addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });

    const sel = el('setTheme');
    window.M2Themes.list().forEach((th) => {
      const opt = document.createElement('option');
      opt.value = th.id;
      opt.textContent = th.name;
      sel.appendChild(opt);
    });
    sel.value = window.M2Themes.current();
    sel.addEventListener('change', () => window.M2Themes.apply(sel.value));

    el('setAbbrevLen').addEventListener('input', () => {
      const v = Math.max(1, Math.min(40, parseInt(el('setAbbrevLen').value, 10) || 30));
      state.abbrevLen = v;
      el('setPreview').textContent = abbreviate(activeProject().fields.projectName || 'Example Prompt', v);
      el('folderPreview').textContent = folderPreview();
      saveState();
    });
    el('setTypeLen').addEventListener('input', () => {
      const v = Math.max(1, Math.min(100, parseInt(el('setTypeLen').value, 10) || 60));
      state.typeLen = v;
      saveState();
    });
  }

  function populateSettings() {
    el('setTheme').value = window.M2Themes.current();
    el('setAbbrevLen').value = state.abbrevLen;
    el('setTypeLen').value = state.typeLen;
    el('setPreview').textContent = abbreviate(activeProject().fields.projectName || 'Example Prompt', state.abbrevLen);
  }

  // ------------------------------------------------------------------
  // Splitters
  // ------------------------------------------------------------------
  function wireSplitter(splitterId, layoutSel, cssVar, stateKey, min, max) {
    const splitter = el(splitterId);
    if (!splitter) return;
    const layout = $(layoutSel);
    layout.style.setProperty(cssVar, state[stateKey] + 'px');
    let dragging = false;
    splitter.addEventListener('mousedown', (e) => {
      dragging = true;
      splitter.classList.add('dragging');
      document.body.classList.add('col-resizing');
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const rect = layout.getBoundingClientRect();
      let w = e.clientX - rect.left;
      w = Math.max(min, Math.min(max, w));
      state[stateKey] = Math.round(w);
      layout.style.setProperty(cssVar, state[stateKey] + 'px');
    });
    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      splitter.classList.remove('dragging');
      document.body.classList.remove('col-resizing');
      saveState();
    });
  }

  // ------------------------------------------------------------------
  // Render all
  // ------------------------------------------------------------------
  function renderAll() {
    renderProjectTabs();
    renderFields();
    renderSection();
    updateSaveButton();
  }

  // ------------------------------------------------------------------
  // Snippet palettes (floating, draggable, resizable panels of quick inserts)
  // ------------------------------------------------------------------
  let SNIPPETS = {};

  function buildSnipBar() {
    const bar = el('snipCats');
    if (!bar) return;
    bar.innerHTML = '';
    Object.keys(SNIPPETS).forEach((cat) => {
      const cfg = SNIPPETS[cat] || {};
      const btn = document.createElement('button');
      btn.className = 'snip-cat';
      btn.dataset.cat = cat;
      btn.textContent = cfg.label || cat;
      btn.addEventListener('click', () => toggleSnipPanel(cat));
      bar.appendChild(btn);
    });
  }

  function setCatActive(cat, on) {
    const btn = document.querySelector(`.snip-cat[data-cat="${cat}"]`);
    if (btn) btn.classList.toggle('active', on);
  }

  // Insert text into the active prompt editor at the cursor position.
  function insertSnippet(text) {
    const ta = el('sectionBody') && el('sectionBody').querySelector('.log-input');
    if (!ta) {
      toast(t('snip.noEditor'), 'error');
      return;
    }
    ta.focus();
    // Insert via execCommand so the change joins the textarea's native undo
    // stack (Ctrl+Z undoes an inserted snippet just like typed text). The
    // resulting 'input' event syncs content / counter / dirty state.
    let inserted = false;
    try {
      inserted = document.execCommand('insertText', false, text);
    } catch (_e) {
      inserted = false;
    }
    if (!inserted) {
      const start = typeof ta.selectionStart === 'number' ? ta.selectionStart : ta.value.length;
      const end = typeof ta.selectionEnd === 'number' ? ta.selectionEnd : ta.value.length;
      ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
      const caret = start + text.length;
      ta.selectionStart = caret;
      ta.selectionEnd = caret;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function savePanelGeom(cat, panel) {
    if (!panel || !panel.isConnected) return;
    const r = panel.getBoundingClientRect();
    if (r.width < 120 || r.height < 90) return; // ignore collapsed / removed panels
    if (!state.snipPanels) state.snipPanels = {};
    state.snipPanels[cat] = {
      left: Math.round(r.left),
      top: Math.round(r.top),
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
    saveState();
  }

  // Restore a panel's saved position/size. Falls back to a top-left default
  // when there is no saved geometry or the saved position is unreasonable
  // (off-screen / header not reachable, e.g. after the window was resized).
  function panelGeom(cat) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const idx = Math.max(0, Object.keys(SNIPPETS).indexOf(cat));
    const def = { left: 16 + idx * 24, top: 72 + idx * 24, width: 240, height: 260 };
    const g = state.snipPanels && state.snipPanels[cat];
    if (!g) return def;
    const valid =
      Number.isFinite(g.left) &&
      Number.isFinite(g.top) &&
      Number.isFinite(g.width) &&
      Number.isFinite(g.height) &&
      g.width >= 150 &&
      g.height >= 100 &&
      g.left >= 0 &&
      g.top >= 0 &&
      g.left <= W - 80 &&
      g.top <= H - 40;
    if (!valid) return def;
    return { left: g.left, top: g.top, width: Math.min(g.width, W), height: Math.min(g.height, H) };
  }

  const snipGeomTimers = {};
  const snipObservers = {};
  let activeSnipCat = null;

  // Fully close a panel: persist its final geometry, stop observing it, then
  // remove it. (If the ResizeObserver were left to fire after removal it would
  // save a zeroed rect, making the panel reopen at the top-left.)
  function closeSnipPanel(cat) {
    const panel = document.getElementById('snip-panel-' + cat);
    if (snipObservers[cat]) {
      try {
        snipObservers[cat].disconnect();
      } catch (_e) {
        /* ignore */
      }
      delete snipObservers[cat];
    }
    clearTimeout(snipGeomTimers[cat]);
    if (panel) {
      savePanelGeom(cat, panel);
      panel.remove();
    }
    if (activeSnipCat === cat) activeSnipCat = null;
    setCatActive(cat, false);
  }

  function toggleSnipPanel(cat) {
    const existing = document.getElementById('snip-panel-' + cat);
    if (existing) {
      closeSnipPanel(cat);
      return;
    }
    const cfg = SNIPPETS[cat];
    if (!cfg) return;

    const panel = document.createElement('div');
    panel.className = 'snip-panel';
    panel.id = 'snip-panel-' + cat;

    const geom = panelGeom(cat);
    panel.style.left = geom.left + 'px';
    panel.style.top = geom.top + 'px';
    panel.style.width = geom.width + 'px';
    panel.style.height = geom.height + 'px';

    const head = document.createElement('div');
    head.className = 'snip-head';
    const title = document.createElement('span');
    title.textContent = cfg.label || cat;
    const close = document.createElement('button');
    close.className = 'snip-close';
    close.textContent = '\u00d7';
    close.addEventListener('click', () => closeSnipPanel(cat));
    head.appendChild(title);
    head.appendChild(close);

    const body = document.createElement('div');
    body.className = 'snip-body';
    (cfg.items || []).forEach((it) => {
      const b = document.createElement('button');
      b.className = 'snip-item';
      b.textContent = it.label || it.text || '';
      b.title = it.text || '';
      b.addEventListener('click', () => insertSnippet(it.text || ''));
      body.appendChild(b);
    });

    panel.appendChild(head);
    panel.appendChild(body);
    document.body.appendChild(panel);
    setCatActive(cat, true);
    activeSnipCat = cat;

    // Drag by the header.
    head.addEventListener('mousedown', (e) => {
      if (e.target === close) return;
      const rect = panel.getBoundingClientRect();
      const offX = e.clientX - rect.left;
      const offY = e.clientY - rect.top;
      panel.classList.add('dragging');
      const move = (ev) => {
        panel.style.left = Math.max(0, ev.clientX - offX) + 'px';
        panel.style.top = Math.max(0, ev.clientY - offY) + 'px';
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        panel.classList.remove('dragging');
        savePanelGeom(cat, panel);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
      e.preventDefault();
    });

    // Persist size changes from the resize grip.
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(() => {
        clearTimeout(snipGeomTimers[cat]);
        snipGeomTimers[cat] = setTimeout(() => savePanelGeom(cat, panel), 300);
      });
      ro.observe(panel);
      snipObservers[cat] = ro;
    }
  }

  function wireSnippets() {
    buildSnipBar();
    wireSnipManager();

    // Track which snippet panel the user last interacted with (or opened) so
    // Escape can close it. Clicking outside any panel disarms Escape.
    document.addEventListener('mousedown', (e) => {
      const panel = e.target && e.target.closest ? e.target.closest('.snip-panel') : null;
      activeSnipCat = panel ? panel.id.replace('snip-panel-', '') : null;
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !activeSnipCat) return;
      if (document.getElementById('snip-panel-' + activeSnipCat)) {
        e.preventDefault();
        closeSnipPanel(activeSnipCat);
      }
      activeSnipCat = null;
    });
  }

  // ------------------------------------------------------------------
  // Snippet manager: add / delete snippets & categories, paste-to-add.
  // Edits persist to snippets.json and rebuild the toolbar live.
  // ------------------------------------------------------------------
  let snipMgrCat = null;
  let snipSaveTimer = null;

  function persistSnippets(immediate) {
    buildSnipBar();
    clearTimeout(snipSaveTimer);
    const doSave = () => {
      if (api.saveSnippets) {
        try {
          api.saveSnippets(SNIPPETS);
        } catch (_e) {
          /* ignore */
        }
      }
    };
    if (immediate) doSave();
    else snipSaveTimer = setTimeout(doSave, 400);
  }

  function firstLineLabel(text) {
    const line =
      String(text || '')
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.length > 0) || 'Snippet';
    return line.slice(0, 16);
  }

  function renderSnipManager() {
    const cats = Object.keys(SNIPPETS);
    if (!snipMgrCat || !SNIPPETS[snipMgrCat]) snipMgrCat = cats[0] || null;

    const sel = el('snipCatSelect');
    sel.innerHTML = '';
    cats.forEach((k) => {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = SNIPPETS[k].label || k;
      sel.appendChild(opt);
    });
    if (snipMgrCat) sel.value = snipMgrCat;
    el('snipCatLabel').value = snipMgrCat ? SNIPPETS[snipMgrCat].label || '' : '';

    const list = el('snipItemList');
    list.innerHTML = '';
    const items = snipMgrCat && SNIPPETS[snipMgrCat].items;
    if (!items || !items.length) {
      const empty = document.createElement('div');
      empty.className = 'snip-edit-empty';
      empty.textContent = t('snip.manage.empty');
      list.appendChild(empty);
      return;
    }
    items.forEach((it, i) => {
      const row = document.createElement('div');
      row.className = 'snip-edit-row';
      const labelIn = document.createElement('input');
      labelIn.type = 'text';
      labelIn.value = it.label || '';
      labelIn.placeholder = t('snip.manage.labelPh');
      labelIn.addEventListener('input', () => {
        it.label = labelIn.value;
        persistSnippets(false);
      });
      const textIn = document.createElement('textarea');
      textIn.value = it.text || '';
      textIn.rows = 2;
      textIn.spellcheck = false;
      textIn.addEventListener('input', () => {
        it.text = textIn.value;
        persistSnippets(false);
      });
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn-remove';
      del.textContent = '\u00d7';
      del.addEventListener('click', () => {
        SNIPPETS[snipMgrCat].items.splice(i, 1);
        persistSnippets(true);
        renderSnipManager();
      });
      row.appendChild(labelIn);
      row.appendChild(textIn);
      row.appendChild(del);
      list.appendChild(row);
    });
  }

  function openSnipManager() {
    snipMgrCat = Object.keys(SNIPPETS)[0] || null;
    renderSnipManager();
    const dialog = el('snipManagerModal').querySelector('.modal');
    if (dialog) {
      // Re-center each open (keep any resized dimensions).
      dialog.style.position = '';
      dialog.style.left = '';
      dialog.style.top = '';
      dialog.style.margin = '';
    }
    el('snipManagerModal').classList.remove('hidden');
  }

  // Make a modal dialog draggable by a handle (e.g. its header).
  function makeModalDraggable(dialog, handle) {
    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest && e.target.closest('.btn-remove')) return;
      const rect = dialog.getBoundingClientRect();
      dialog.style.position = 'absolute';
      dialog.style.margin = '0';
      dialog.style.left = rect.left + 'px';
      dialog.style.top = rect.top + 'px';
      const offX = e.clientX - rect.left;
      const offY = e.clientY - rect.top;
      const move = (ev) => {
        dialog.style.left = Math.max(0, ev.clientX - offX) + 'px';
        dialog.style.top = Math.max(0, ev.clientY - offY) + 'px';
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
      e.preventDefault();
    });
  }

  function wireSnipManager() {
    const modal = el('snipManagerModal');
    if (!modal) return;
    el('btnSnipManage').addEventListener('click', openSnipManager);
    el('btnSnipManagerClose').addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });

    const dialog = modal.querySelector('.modal');
    const head = dialog && dialog.querySelector('.modal-head');
    if (dialog && head) makeModalDraggable(dialog, head);

    el('snipCatSelect').addEventListener('change', () => {
      snipMgrCat = el('snipCatSelect').value;
      renderSnipManager();
    });

    el('snipCatLabel').addEventListener('input', () => {
      if (snipMgrCat && SNIPPETS[snipMgrCat]) {
        SNIPPETS[snipMgrCat].label = el('snipCatLabel').value;
        const opt = el('snipCatSelect').querySelector('option[value="' + snipMgrCat + '"]');
        if (opt) opt.textContent = el('snipCatLabel').value || snipMgrCat;
        persistSnippets(false);
      }
    });

    el('btnSnipAddCat').addEventListener('click', () => {
      const name = el('snipNewCat').value.trim();
      if (!name) return;
      const key = 'cat_' + Date.now().toString(36);
      SNIPPETS[key] = { label: name, items: [] };
      el('snipNewCat').value = '';
      snipMgrCat = key;
      persistSnippets(true);
      renderSnipManager();
    });

    el('btnSnipDelCat').addEventListener('click', () => {
      if (!snipMgrCat) return;
      if (!window.confirm(t('snip.manage.delCatConfirm'))) return;
      delete SNIPPETS[snipMgrCat];
      snipMgrCat = Object.keys(SNIPPETS)[0] || null;
      persistSnippets(true);
      renderSnipManager();
    });

    el('btnSnipAddItem').addEventListener('click', () => {
      if (!snipMgrCat) {
        toast(t('snip.manage.needCat'), 'error');
        return;
      }
      const text = el('snipNewText').value;
      if (!text.trim()) {
        toast(t('snip.manage.needText'), 'error');
        return;
      }
      let label = el('snipNewLabel').value.trim();
      if (!label) label = firstLineLabel(text);
      SNIPPETS[snipMgrCat].items.push({ label, text });
      el('snipNewLabel').value = '';
      el('snipNewText').value = '';
      persistSnippets(true);
      renderSnipManager();
      toast(t('snip.manage.added'), 'success');
    });
  }

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------
  // The M2 logo path (bright purple) — used to paint the window / taskbar icon.
  const M2_LOGO_PATH =
    'M474.500 5.091 C 369.720 13.291,269.833 53.534,190.500 119.511 C 164.616 141.037,141.773 163.914,121.904 188.211 C 46.367 280.576,6.980 391.590,7.025 512.000 C 7.071 633.721,52.941 752.327,135.677 844.650 C 179.034 893.031,229.632 931.814,286.500 960.256 C 367.991 1001.013,456.545 1018.990,546.170 1012.970 C 646.559 1006.228,740.144 970.848,821.000 909.073 C 903.470 846.063,968.149 753.678,997.474 657.000 C 1012.996 605.829,1018.990 565.277,1018.997 511.395 C 1019.000 481.311,1018.159 466.844,1014.934 441.500 C 995.771 290.911,906.460 155.598,773.500 75.706 C 711.963 38.730,644.372 15.731,571.500 6.970 C 557.228 5.255,546.562 4.739,520.000 4.479 C 501.575 4.299,481.100 4.575,474.500 5.091 M553.000 92.045 C 622.278 98.285,693.122 124.222,751.779 164.820 C 778.194 183.102,807.986 209.567,828.612 233.070 C 874.497 285.356,907.232 350.199,922.475 419.000 C 935.933 479.742,935.737 546.581,921.934 603.104 C 898.062 700.867,843.346 784.061,763.277 844.336 C 705.991 887.461,634.151 916.559,563.000 925.454 C 400.593 945.760,237.673 864.755,152.797 721.500 C 122.057 669.616,101.064 605.170,96.065 547.339 C 94.676 531.267,94.638 489.693,95.998 474.000 C 102.282 401.519,128.084 329.349,168.658 270.765 C 198.517 227.653,236.961 189.944,281.000 160.570 C 298.844 148.668,307.730 143.541,328.142 133.370 C 372.979 111.026,426.624 96.097,476.500 92.082 C 484.200 91.462,492.525 90.785,495.000 90.577 C 502.349 89.959,540.596 90.927,553.000 92.045 M254.667 238.667 C 254.300 239.033,254.000 358.508,254.000 504.167 L 254.000 769.000 297.497 769.000 L 340.995 769.000 341.247 577.250 L 341.500 385.500 425.500 469.203 C 471.700 515.239,509.801 553.039,510.170 553.203 C 510.538 553.366,569.157 495.475,640.435 424.555 L 770.030 295.611 769.765 267.055 L 769.500 238.500 741.000 238.379 L 712.500 238.258 612.000 338.218 L 511.500 438.178 411.967 338.089 L 312.434 238.000 283.884 238.000 C 268.181 238.000,255.033 238.300,254.667 238.667 M640.020 475.903 L 510.539 604.791 465.551 560.645 C 440.807 536.365,409.861 505.967,396.781 493.094 L 373.000 469.687 373.097 531.094 L 373.194 592.500 393.244 611.500 C 404.271 621.950,435.315 651.823,462.229 677.885 L 511.164 725.269 516.332 720.311 C 535.862 701.573,603.741 635.446,640.827 599.028 C 665.208 575.088,685.570 555.350,686.077 555.167 C 686.637 554.964,687.000 596.948,687.000 661.917 L 687.000 769.000 728.500 769.000 L 770.000 769.000 770.000 558.000 C 770.000 441.950,769.888 347.003,769.750 347.008 C 769.612 347.012,711.234 405.015,640.020 475.903 ';

  // Rasterize the purple M2 logo to a PNG and set it as the window / taskbar
  // icon so it matches the in-app logo (Electron shows its default otherwise).
  function setAppIcon() {
    if (!api.setAppIcon) return;
    try {
      const svg =
        "<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256' viewBox='0 0 1024 1024' fill='#b26bff'>" +
        "<path fill-rule='evenodd' d='" +
        M2_LOGO_PATH +
        "'/></svg>";
      const img = new Image();
      img.onload = () => {
        try {
          const size = 256;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, size, size);
          ctx.drawImage(img, 0, 0, size, size);
          api.setAppIcon(canvas.toDataURL('image/png'));
        } catch (_e) {
          /* ignore */
        }
      };
      img.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
    } catch (_e) {
      /* ignore */
    }
  }

  async function init() {
    try {
      const v = await api.appVersion();
      el('appVersion').textContent = 'v' + v;
      document.title = 'M2 PROMPT v' + v;
    } catch (_e) {
      /* ignore */
    }

    setAppIcon();

    try {
      SNIPPETS = (await api.loadSnippets()) || {};
    } catch (_e) {
      SNIPPETS = {};
    }

    wireFields();
    wireViews();
    wireSettings();
    wireSnippets();
    wireSplitter('splitter', '.layout', '--left-width', 'leftWidth', 260, 640);

    await loadLang(state.lang || 'zh');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
