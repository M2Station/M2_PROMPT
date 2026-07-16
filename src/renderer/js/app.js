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
        author: '',
        category: '',
        model: '',
        notes: '',
        customFields: [],
        outputBase: '',
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
      libLeftWidth: 360,
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
  }

  function activeProject() {
    return state.projects.find((p) => p.id === state.activeProjectId) || state.projects[0];
  }

  function activeSection(proj) {
    const p = proj || activeProject();
    return p.sections.find((s) => s.id === p.activeSectionId) || p.sections[0];
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
    const d = new Date();
    const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const time = `${pad(d.getHours())}${pad(d.getMinutes())}`;
    const abbr = abbreviate(activeProject().fields.projectName, state.abbrevLen);
    return `${date}_${time}_${abbr}`;
  }

  function counterText(text) {
    const lines = text ? text.split('\n').length : 0;
    const chars = text ? text.length : 0;
    if (lang === 'zh') return `${lines} 行 · ${chars} 字元`;
    return `${lines} lines · ${chars} chars`;
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
    el('author').value = f.author || '';
    el('category').value = f.category || '';
    el('model').value = f.model || '';
    el('notes').value = f.notes || '';
    el('outputBase').value = f.outputBase || '';
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

      const name = document.createElement('span');
      name.className = 'tab-name';
      name.textContent = s.name;
      btn.appendChild(name);

      btn.addEventListener('click', () => {
        p.activeSectionId = s.id;
        saveState();
        renderSection();
      });
      btn.addEventListener('dblclick', () => renameSection(s));

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
    });

    const add = document.createElement('button');
    add.className = 'tab tab-add';
    add.textContent = '+';
    add.addEventListener('click', () => {
      const s = newSection(lang === 'zh' ? '新分頁' : 'New');
      p.sections.push(s);
      p.activeSectionId = s.id;
      saveState();
      renderSection();
      setTimeout(() => renameSection(s), 0);
    });
    tabs.appendChild(add);
  }

  function renameSection(s) {
    const label = lang === 'zh' ? '分頁名稱：' : 'Tab name:';
    const next = window.prompt(label, s.name);
    if (next && next.trim()) {
      s.name = next.trim();
      saveState();
      renderSection();
    }
  }

  function renderSection() {
    renderSectionTabs();
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
    ta.placeholder =
      lang === 'zh'
        ? `在此輸入「${s.name}」的 Prompt 內容…`
        : `Enter the "${s.name}" prompt here…`;
    ta.spellcheck = false;
    ta.addEventListener('input', () => {
      s.content = ta.value;
      el('counter').textContent = counterText(ta.value);
      saveState();
    });
    ta.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        doExport();
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
      author: 'author',
      category: 'category',
      model: 'model',
      notes: 'notes',
      outputBase: 'outputBase',
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
        author: '',
        category: '',
        model: '',
        notes: '',
        customFields: [],
        outputBase: '',
      };
      saveState();
      renderFields();
      renderProjectTabs();
      toast(t('toast.reset'), 'info');
    });

    el('btnNextProj').addEventListener('click', () => {
      const p = activeProject();
      p.fields.projectName = '';
      p.sections = DEFAULT_SECTIONS.map((n) => newSection(n));
      p.activeSectionId = p.sections[0].id;
      saveState();
      renderFields();
      renderProjectTabs();
      renderSection();
      toast(t('toast.nextProj'), 'info');
    });

    el('btnCopySummary').addEventListener('click', async () => {
      const f = activeProject().fields;
      const lines = [
        `Project : ${f.projectName || ''}`,
        `Date    : ${f.date || ''}`,
        `Author  : ${f.author || ''}`,
        `Category: ${f.category || ''}`,
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
  }

  // ------------------------------------------------------------------
  // Export
  // ------------------------------------------------------------------
  function exportPayload() {
    const p = activeProject();
    return {
      projectName: p.fields.projectName,
      date: p.fields.date,
      author: p.fields.author,
      category: p.fields.category,
      model: p.fields.model,
      notes: p.fields.notes,
      customFields: p.fields.customFields,
      outputBase: p.fields.outputBase,
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
        refreshLibrary();
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
        refreshLibrary();
      } else if (res && res.error === 'EMPTY') {
        toast(t('toast.exportEmpty'), 'error');
      } else {
        toast(t('toast.exportErr') + (res ? res.error : ''), 'error');
      }
    } catch (e) {
      toast(t('toast.exportErr') + e.message, 'error');
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
    openBtn.textContent = t('lib.open');
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
  // Library
  // ------------------------------------------------------------------
  let libItems = [];
  let libSelected = null;

  async function refreshLibrary() {
    const res = await api.listDir('');
    const path = res && res.path ? res.path : '';
    el('libPath').textContent = path;
    el('libPath').title = path;
    libItems = res && res.ok ? res.items.filter((it) => it.isDir) : [];
    renderLibTree();
  }

  function renderLibTree() {
    const tree = el('libTree');
    const filter = (el('libFilter').value || '').trim().toLowerCase();
    const items = filter
      ? libItems.filter((it) => it.name.toLowerCase().includes(filter))
      : libItems;
    el('libCount').textContent = String(items.length);
    tree.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'ana-empty';
      empty.textContent = t('lib.empty');
      tree.appendChild(empty);
      return;
    }
    items.forEach((it) => {
      const row = document.createElement('div');
      row.className = 'ana-row' + (libSelected === it.path ? ' selected' : '');
      const ic = document.createElement('span');
      ic.className = 'ana-ic';
      ic.innerHTML =
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
      const main = document.createElement('div');
      main.className = 'ana-rowmain';
      const name = document.createElement('span');
      name.className = 'ana-name';
      name.textContent = it.name;
      const sub = document.createElement('span');
      sub.className = 'ana-sub';
      sub.textContent = new Date(it.mtime).toLocaleString();
      main.appendChild(name);
      main.appendChild(sub);
      row.appendChild(ic);
      row.appendChild(main);
      row.addEventListener('click', () => openLibItem(it));
      tree.appendChild(row);
    });
  }

  async function openLibItem(it) {
    libSelected = it.path;
    renderLibTree();
    el('libViewName').textContent = it.name;
    el('btnLibOpenThis').disabled = false;
    el('btnLibOpenThis').onclick = () => api.openFolder(it.path);

    // Prefer prompt.md; fall back to first file in folder.
    const listing = await api.listDir(it.path);
    let target = null;
    if (listing && listing.ok) {
      target =
        listing.items.find((x) => !x.isDir && x.name.toLowerCase() === 'prompt.md') ||
        listing.items.find((x) => !x.isDir && /\.(md|txt|json)$/i.test(x.name)) ||
        listing.items.find((x) => !x.isDir);
    }
    if (!target) {
      el('libViewContent').textContent = '';
      return;
    }
    const read = await api.readText(target.path);
    const text = read && read.ok ? read.text : (read ? read.error : '');
    el('libViewContent').textContent = text;
    el('libViewMeta').textContent = counterText(text);
    el('btnLibCopy').disabled = false;
    el('btnLibCopy').onclick = async () => {
      try {
        await navigator.clipboard.writeText(text);
        toast(t('toast.copyOk'), 'success');
      } catch (_e) {
        toast('Clipboard error', 'error');
      }
    };
  }

  function wireLibrary() {
    el('btnLibRefresh').addEventListener('click', refreshLibrary);
    el('btnLibOpen').addEventListener('click', () => api.openFolder(''));
    el('libFilter').addEventListener('input', renderLibTree);
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
        if (view === 'library') refreshLibrary();
      });
    });

    el('btnExport').addEventListener('click', doExport);
    el('btnExportSingle').addEventListener('click', doExportSingle);
    el('btnOpenExplorer').addEventListener('click', () => api.openFolder(''));
    el('btnOpenBase').addEventListener('click', () => {
      const base = (activeProject().fields.outputBase || '').trim();
      api.openFolder(base);
    });
    el('btnBrowseBase').addEventListener('click', async () => {
      const picked = await api.pickFolder(activeProject().fields.outputBase);
      if (picked) {
        activeProject().fields.outputBase = picked;
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
  }

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------
  async function init() {
    try {
      const v = await api.appVersion();
      el('appVersion').textContent = 'v' + v;
    } catch (_e) {
      /* ignore */
    }

    wireFields();
    wireViews();
    wireSettings();
    wireLibrary();
    wireSplitter('splitter', '.layout', '--left-width', 'leftWidth', 260, 640);
    wireSplitter('libSplitter', '.analysis-body', '--ana-left-width', 'libLeftWidth', 240, 640);

    await loadLang(state.lang || 'zh');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
