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
      previewMode: false,
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
        // Accept an empty projects array too (the "no project open" state).
        if (s && Array.isArray(s.projects)) return s;
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
    if (!p) return null;
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

  // A project is "dirty" when it was opened / saved from disk and its current
  // content differs from the last saved version (drives the Save button and the
  // red project-tab indicator).
  function projectDirty(p) {
    return !!(p && p.sourcePath && projectSignature(p) !== p.savedSig);
  }

  // Toggle the red "modified" style on each project tab in place (no rebuild).
  function refreshProjectTabDirty() {
    const nav = document.getElementById('projTabs');
    if (!nav) return;
    nav.querySelectorAll('.exp-tab').forEach((btn) => {
      const pid = btn.dataset.pid;
      if (!pid) return;
      const p = state.projects.find((x) => x.id === pid);
      btn.classList.toggle('dirty', projectDirty(p));
    });
  }

  // Show the SAVE button only for a project opened from disk with unsaved edits.
  function updateSaveButton() {
    const btn = document.getElementById('btnSave');
    if (!btn) return;
    btn.style.display = projectDirty(activeProject()) ? '' : 'none';
    refreshProjectTabDirty();
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
    const p = activeProject();
    if (!p) return '';
    const abbr = abbreviate(p.fields.projectName, state.abbrevLen);
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
    const body = el('sectionBody');
    const ta = body && body.querySelector('.log-input');
    if (ta) ta.style.fontSize = next + 'px';
    const pv = body && body.querySelector('.md-preview');
    if (pv) pv.style.fontSize = next + 'px';
    saveState();
  }

  function bumpEditorFont(delta) {
    setEditorFont(editorFontPx() + delta);
  }

  // SNIPPET-manager dialog font size (persisted). Scales the text of the
  // "SNIPPET Settings" popup via the --snip-font CSS variable so the A-/A/A+
  // controls enlarge or shrink everything inside it at once.
  const SNIP_FONT_DEFAULT = 12.5;

  function snipMgrFontPx() {
    const v = Number(state.snipMgrFontSize);
    return Number.isFinite(v) ? Math.max(10, Math.min(22, v)) : SNIP_FONT_DEFAULT;
  }

  function applySnipMgrFont() {
    const modal = el('snipManagerModal');
    const dialog = modal && modal.querySelector('.modal');
    if (dialog) dialog.style.setProperty('--snip-font', snipMgrFontPx() + 'px');
  }

  function setSnipMgrFont(size) {
    state.snipMgrFontSize = Math.max(10, Math.min(22, size));
    applySnipMgrFont();
    saveState();
  }

  function bumpSnipMgrFont(delta) {
    setSnipMgrFont(snipMgrFontPx() + delta);
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
  const TAB_ICON_FOLDER =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
  const TAB_ICON_NEWDOC =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>';

  // Close a single project tab (always keeps at least one project open).
  function closeProjectTab(pid) {
    const idx = state.projects.findIndex((x) => x.id === pid);
    if (idx === -1) return;
    state.projects.splice(idx, 1);
    if (state.activeProjectId === pid) {
      state.activeProjectId = state.projects.length ? state.projects[Math.max(0, idx - 1)].id : null;
    }
    saveState();
    renderAll();
  }

  // Close every project tab except `pid` (confirms first, since drafts are lost).
  function closeOtherProjectTabs(pid) {
    const keep = state.projects.find((x) => x.id === pid);
    if (!keep || state.projects.length <= 1) return;
    const others = state.projects.length - 1;
    const msg = lang === 'zh' ? `關閉其他 ${others} 個專案分頁？` : `Close ${others} other project tab(s)?`;
    if (!window.confirm(msg)) return;
    state.projects = [keep];
    state.activeProjectId = keep.id;
    saveState();
    renderAll();
  }

  function closeTabContextMenu() {
    const m = document.getElementById('tabCtxMenu');
    if (m) m.remove();
  }

  function showTabContextMenu(x, y, pid) {
    closeTabContextMenu();
    closeImageContextMenu();
    closeTextContextMenu();
    const zh = lang === 'zh';
    const only = state.projects.length <= 1;
    const menu = document.createElement('div');
    menu.className = 'ctx-menu';
    menu.id = 'tabCtxMenu';
    const item = (label, disabled, fn) => {
      const it = document.createElement('div');
      it.className = 'ctx-item' + (disabled ? ' disabled' : '');
      const lab = document.createElement('span');
      lab.textContent = label;
      it.appendChild(lab);
      if (!disabled) {
        it.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          closeTabContextMenu();
          fn();
        });
      }
      menu.appendChild(it);
    };
    item(zh ? '關閉' : 'Close', false, () => closeProjectTab(pid));
    item(zh ? '關閉其他' : 'Close others', only, () => closeOtherProjectTabs(pid));
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(4, Math.min(x, window.innerWidth - r.width - 6)) + 'px';
    menu.style.top = Math.max(4, Math.min(y, window.innerHeight - r.height - 6)) + 'px';
  }

  function renderProjectTabs() {
    const nav = el('projTabs');
    nav.innerHTML = '';
    state.projects.forEach((p) => {
      const btn = document.createElement('button');
      btn.className =
        'exp-tab' + (p.id === state.activeProjectId ? ' active' : '') + (projectDirty(p) ? ' dirty' : '');
      btn.dataset.pid = p.id;
      const icon = document.createElement('span');
      icon.className = 'exp-tab-icon';
      icon.innerHTML = p.sourcePath ? TAB_ICON_FOLDER : TAB_ICON_NEWDOC;
      icon.title = p.sourcePath
        ? (lang === 'zh' ? '已開啟的專案' : 'Opened project')
        : (lang === 'zh' ? '新專案（尚未輸出）' : 'New project (not exported yet)');
      btn.appendChild(icon);
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
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showTabContextMenu(e.clientX, e.clientY, p.id);
      });
      const close = document.createElement('span');
      close.className = 'exp-tab-close';
      close.textContent = '\u00d7';
      close.title = lang === 'zh' ? '關閉' : 'Close';
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        closeProjectTab(p.id);
      });
      btn.appendChild(close);
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
    if (!p) return;
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
    const body = el('sectionBody');
    hideImageToolbar();
    selAnchorBlock = null;
    lastActiveBlock = null;
    selFocusBlock = null;
    body.innerHTML = '';
    if (!p) return;
    const s = activeSection(p);
    if (!s) return;

    const preview = state.previewMode === true;

    const pane = document.createElement('div');
    pane.className = 'log-pane active';

    const ta = document.createElement('textarea');
    ta.className = 'log-input';
    ta.value = s.content || '';
    ta.style.fontSize = editorFontPx() + 'px';
    ta.style.display = preview ? 'none' : '';
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
    ta.addEventListener('keydown', (e) => handleEditorKeydown(e, ta));
    ta.addEventListener('paste', (e) => handleEditorPaste(e, ta));
    ta.addEventListener('dragover', (e) => {
      if (hasImageDrag(e)) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      }
    });
    ta.addEventListener('drop', (e) => handleEditorDrop(e, ta));
    ta.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showTextContextMenu(e.clientX, e.clientY, ta);
    });
    pane.appendChild(ta);

    // WYSIWYG (Typora-like) editable view: each block renders inline and turns
    // into its Markdown source when you click into it.
    const wysBox = document.createElement('div');
    wysBox.className = 'md-preview md-wys';
    wysBox.style.fontSize = editorFontPx() + 'px';
    wysBox.style.display = preview ? '' : 'none';
    wysBox.addEventListener('mousedown', (e) => {
      if (e.target === wysBox) clearBlockSelection(wysBox);
    });
    wysBox.addEventListener('scroll', () => {
      if (toolbarImg) positionImageToolbar(getImageToolbar(), toolbarImg);
    });
    wysBox.addEventListener('dragover', (e) => {
      if (hasImageDrag(e)) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      }
    });
    wysBox.addEventListener('drop', (e) => handleWysDrop(e, wysBox, s, imageDescriptor(p)));
    wysBox.addEventListener('contextmenu', (e) => {
      const target = e.target;
      const block = target && target.closest ? target.closest('.md-block') : null;
      const editing = !!(block && block.classList.contains('editing'));
      const img = target && target.closest ? target.closest('img') : null;
      // Right-click an image (not while editing its source) -> image menu.
      if (img && img.dataset && img.dataset.rel && !editing) {
        e.preventDefault();
        showImageContextMenu(e.clientX, e.clientY, img);
        return;
      }
      // Right-click text -> open the block for editing (if needed) and show the
      // Markdown formatting menu targeting its source textarea.
      if (block) {
        e.preventDefault();
        if (!editing) enterBlockEdit(block, s, imageDescriptor(p));
        const ta2 = block.querySelector('.md-block-edit');
        if (ta2) showTextContextMenu(e.clientX, e.clientY, ta2);
      }
    });
    pane.appendChild(wysBox);

    body.appendChild(pane);
    el('counter').textContent = counterText(s.content || '');

    if (preview) renderWysiwyg(wysBox, s, imageDescriptor(p));
    updatePreviewToggle();
    updateSelectionToolbar();
    recordHistory();
  }

  // ------------------------------------------------------------------
  // Editor helpers: WYSIWYG preview, Typora-style shortcuts, image paste
  // ------------------------------------------------------------------
  function activeEditorTextarea() {
    // Prefer whichever editor textarea currently has focus: a WYSIWYG paragraph
    // being edited (.md-block-edit) or the raw source editor (.log-input).
    const ae = document.activeElement;
    if (ae && ae.classList && (ae.classList.contains('md-block-edit') || ae.classList.contains('log-input'))) {
      return ae;
    }
    // In source mode the visible .log-input is the editor even without focus.
    if (!state.previewMode) {
      return el('sectionBody') && el('sectionBody').querySelector('.log-input');
    }
    return null;
  }

  // Describes where this project's files (and its img/ folder) live, so the
  // main process can save / read pasted images in the right place.
  function imageDescriptor(p) {
    const proj = p || activeProject();
    return {
      sourcePath: proj.sourcePath || '',
      outputBase: state.outputBase || '',
      projectName: (proj.fields && proj.fields.projectName) || '',
      abbrevLen: state.abbrevLen,
    };
  }

  function updatePreviewToggle() {
    const bp = el('btnPreview');
    if (!bp) return;
    const on = state.previewMode === true;
    bp.classList.toggle('active', on);
    const lbl = bp.querySelector('.btn-preview-label');
    if (lbl) lbl.textContent = on ? t('btn.edit') : t('btn.preview');
    bp.title = on ? t('btn.edit.title') : t('btn.preview.title');
  }

  // Insert text at the caret, joining the textarea's native undo stack so
  // Ctrl+Z reverts it. The resulting 'input' event syncs content / counter.
  function insertIntoEditor(ta, text) {
    ta.focus();
    let ok = false;
    try {
      ok = document.execCommand('insertText', false, text);
    } catch (_e) {
      ok = false;
    }
    if (!ok) {
      const start = typeof ta.selectionStart === 'number' ? ta.selectionStart : ta.value.length;
      const end = typeof ta.selectionEnd === 'number' ? ta.selectionEnd : ta.value.length;
      ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
      const caret = start + text.length;
      ta.selectionStart = ta.selectionEnd = caret;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // Wrap the selection with markers (bold / italic / code / strike). Toggles
  // the markers off when the selection is already wrapped.
  function wrapSelection(ta, before, after, placeholder) {
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = ta.value.slice(start, end);
    if (sel && ta.value.slice(start - before.length, start) === before && ta.value.slice(end, end + after.length) === after) {
      ta.selectionStart = start - before.length;
      ta.selectionEnd = end + after.length;
      insertIntoEditor(ta, sel);
      return;
    }
    const inner = sel || placeholder || '';
    insertIntoEditor(ta, before + inner + after);
    const from = start + before.length;
    ta.selectionStart = from;
    ta.selectionEnd = from + inner.length;
  }

  function insertLink(ta) {
    const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
    const text = sel || (lang === 'zh' ? '連結文字' : 'link text');
    const startPos = ta.selectionStart;
    insertIntoEditor(ta, `[${text}](url)`);
    const urlStart = startPos + 1 + text.length + 2;
    ta.selectionStart = urlStart;
    ta.selectionEnd = urlStart + 3;
  }

  function insertCodeBlock(ta) {
    const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
    const startPos = ta.selectionStart;
    insertIntoEditor(ta, '```\n' + (sel || '') + '\n```');
    if (!sel) {
      const caret = startPos + 4;
      ta.selectionStart = ta.selectionEnd = caret;
    }
  }

  function insertHorizontalRule(ta) {
    const before = ta.value.slice(0, ta.selectionStart);
    const pre = before && !before.endsWith('\n') ? '\n' : '';
    insertIntoEditor(ta, pre + '---\n');
  }

  // Line-based helpers operate on the caret line (start..end of that line).
  function caretLineRange(ta) {
    const val = ta.value;
    const ls = val.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    let le = val.indexOf('\n', ta.selectionStart);
    if (le === -1) le = val.length;
    return { ls, le, line: val.slice(ls, le) };
  }

  function setHeadingLine(ta, level) {
    const { ls, le, line } = caretLineRange(ta);
    const indent = (line.match(/^(\s*)/) || ['', ''])[1];
    const bare = line.slice(indent.length).replace(/^#{1,6}\s+/, '');
    const isSame = new RegExp('^\\s*#{' + level + '}\\s+').test(line);
    const newLine = isSame ? indent + bare : indent + '#'.repeat(level) + ' ' + bare;
    ta.selectionStart = ls;
    ta.selectionEnd = le;
    insertIntoEditor(ta, newLine);
    ta.selectionStart = ta.selectionEnd = ls + newLine.length;
  }

  function toggleLinePrefix(ta, prefix) {
    const { ls, le, line } = caretLineRange(ta);
    const indent = (line.match(/^(\s*)/) || ['', ''])[1];
    const rest = line.slice(indent.length);
    let newLine;
    if (rest.startsWith(prefix)) {
      newLine = indent + rest.slice(prefix.length);
    } else {
      newLine = indent + prefix + rest.replace(/^([-*+]\s+|>\s+|\d+[.)]\s+)/, '');
    }
    ta.selectionStart = ls;
    ta.selectionEnd = le;
    insertIntoEditor(ta, newLine);
    ta.selectionStart = ta.selectionEnd = ls + newLine.length;
  }

  // Enter inside a list continues it (next bullet / number); Enter on an empty
  // item ends the list. Returns true when it handled the key.
  function handleEnterList(ta) {
    if (ta.selectionStart !== ta.selectionEnd) return false;
    const { ls, line } = caretLineRange(ta);
    const consumed = line.slice(0, ta.selectionStart - ls);
    const m = consumed.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (!m) return false;
    const indent = m[1];
    const marker = m[2];
    const rest = m[3];
    if (rest.trim() === '') {
      ta.selectionStart = ls;
      ta.selectionEnd = ls + consumed.length;
      insertIntoEditor(ta, indent);
      return true;
    }
    let nextMarker = marker;
    if (/^\d+[.)]$/.test(marker)) {
      nextMarker = parseInt(marker, 10) + 1 + marker.slice(-1);
    }
    insertIntoEditor(ta, '\n' + indent + nextMarker + ' ');
    return true;
  }

  function indentSelection(ta, outdent) {
    if (ta.selectionStart === ta.selectionEnd && !outdent) {
      insertIntoEditor(ta, '  ');
      return;
    }
    const val = ta.value;
    const ls = val.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    let le = val.indexOf('\n', ta.selectionEnd);
    if (le === -1) le = val.length;
    const block = val.slice(ls, le);
    const newBlock = block
      .split('\n')
      .map((ln) => (outdent ? ln.replace(/^ {1,2}|^\t/, '') : '  ' + ln))
      .join('\n');
    ta.selectionStart = ls;
    ta.selectionEnd = le;
    insertIntoEditor(ta, newBlock);
    ta.selectionStart = ls;
    ta.selectionEnd = ls + newBlock.length;
  }

  function handleEditorKeydown(e, ta) {
    const mod = e.ctrlKey || e.metaKey;

    if (mod && !e.shiftKey && !e.altKey) {
      if (e.key === '=' || e.key === '+') { e.preventDefault(); bumpEditorFont(1); return; }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); bumpEditorFont(-1); return; }
      if (e.key === '0') { e.preventDefault(); setEditorFont(13); return; }
    }

    // Typora-style formatting shortcuts.
    if (mod && !e.altKey) {
      const k = e.key.toLowerCase();
      if (!e.shiftKey && k === 'b') { e.preventDefault(); wrapSelection(ta, '**', '**', lang === 'zh' ? '粗體' : 'bold'); return; }
      if (!e.shiftKey && k === 'i') { e.preventDefault(); wrapSelection(ta, '*', '*', lang === 'zh' ? '斜體' : 'italic'); return; }
      if (!e.shiftKey && e.key === '`') { e.preventDefault(); wrapSelection(ta, '`', '`', 'code'); return; }
      if (e.shiftKey && k === 'x') { e.preventDefault(); wrapSelection(ta, '~~', '~~', lang === 'zh' ? '刪除線' : 'strike'); return; }
      if (!e.shiftKey && k === 'k') { e.preventDefault(); insertLink(ta); return; }
      if (e.shiftKey && k === 'c') { e.preventDefault(); insertCodeBlock(ta); return; }
      if (!e.shiftKey && /^[1-6]$/.test(e.key)) { e.preventDefault(); setHeadingLine(ta, parseInt(e.key, 10)); return; }
      if (e.shiftKey && k === 'q') { e.preventDefault(); toggleLinePrefix(ta, '> '); return; }
      if (e.shiftKey && k === 'l') { e.preventDefault(); toggleLinePrefix(ta, '- '); return; }
    }

    if (!mod && !e.shiftKey && !e.altKey && e.key === 'Enter' && !e.isComposing) {
      if (handleEnterList(ta)) { e.preventDefault(); return; }
    }

    if (e.key === 'Tab' && !mod && !e.altKey) {
      e.preventDefault();
      indentSelection(ta, e.shiftKey);
    }
  }

  // Pull an image blob from a DataTransfer (clipboard paste or drag-drop), or
  // null when it carries no image.
  function extractImageFromDataTransfer(dt) {
    if (!dt) return null;
    const items = dt.items ? Array.from(dt.items) : [];
    const imgItem = items.find((it) => it.kind === 'file' && it.type && it.type.indexOf('image/') === 0);
    if (imgItem) {
      const blob = imgItem.getAsFile();
      if (blob) return { blob, mime: imgItem.type };
    }
    if (dt.files && dt.files.length) {
      const f = Array.from(dt.files).find((x) => x.type && x.type.indexOf('image/') === 0);
      if (f) return { blob: f, mime: f.type };
    }
    return null;
  }

  // Pull an image blob from a paste event's clipboard, or null for non-images.
  function extractImageFromClipboard(e) {
    return extractImageFromDataTransfer(e.clipboardData);
  }

  // True when a drag event carries image file(s) (used to accept the drop).
  function hasImageDrag(e) {
    const dt = e.dataTransfer;
    if (!dt) return false;
    if (dt.items && dt.items.length) {
      return Array.from(dt.items).some((it) => it.kind === 'file' && (!it.type || it.type.indexOf('image/') === 0));
    }
    if (dt.types && Array.from(dt.types).indexOf('Files') !== -1) return true;
    return false;
  }

  // True when a drag event carries any file (used to block window navigation).
  function dragHasFiles(e) {
    const dt = e.dataTransfer;
    if (!dt) return false;
    if (dt.types && Array.from(dt.types).indexOf('Files') !== -1) return true;
    if (dt.items && Array.from(dt.items).some((it) => it.kind === 'file')) return true;
    return false;
  }

  async function saveClipboardImage(info) {
    const buf = new Uint8Array(await info.blob.arrayBuffer());
    return api.saveImage(Object.assign({}, imageDescriptor(activeProject()), {
      mime: info.mime || info.blob.type || 'image/png',
      name: info.blob.name || '',
      data: buf,
    }));
  }

  // Ctrl+V of a screenshot / image in the raw source editor: save it under the
  // project's img/ and insert ![](img/<name>). Non-image pastes fall through.
  async function handleEditorPaste(e, ta) {
    const info = extractImageFromClipboard(e);
    if (!info) return;
    e.preventDefault();
    try {
      const res = await saveClipboardImage(info);
      if (!res || !res.ok) {
        toast(t('toast.imgErr') + ((res && res.error) || ''), 'error');
        return;
      }
      insertIntoEditor(ta, `![](${res.rel})`);
      toast(t('toast.imgOk') + res.rel, 'success');
    } catch (err) {
      toast(t('toast.imgErr') + (err && err.message ? err.message : err), 'error');
    }
  }

  // Drag-and-drop an image file into the raw source editor: save it under the
  // project's img/ and insert ![](img/<name>) at the caret.
  async function handleEditorDrop(e, ta) {
    const info = extractImageFromDataTransfer(e.dataTransfer);
    if (!info) return;
    e.preventDefault();
    try {
      const res = await saveClipboardImage(info);
      if (!res || !res.ok) {
        toast(t('toast.imgErr') + ((res && res.error) || ''), 'error');
        return;
      }
      ta.focus();
      insertIntoEditor(ta, `![](${res.rel})`);
      toast(t('toast.imgOk') + res.rel, 'success');
    } catch (err) {
      toast(t('toast.imgErr') + (err && err.message ? err.message : err), 'error');
    }
  }

  // Drag-and-drop an image file into the WYSIWYG view: save it and append an
  // image block (rendered immediately) before the trailing "+ Add paragraph".
  async function handleWysDrop(e, container, s, desc) {
    const info = extractImageFromDataTransfer(e.dataTransfer);
    if (!info) return;
    e.preventDefault();
    try {
      const res = await saveClipboardImage(info);
      if (!res || !res.ok) {
        toast(t('toast.imgErr') + ((res && res.error) || ''), 'error');
        return;
      }
      const add = container.querySelector('.md-add');
      const imgBlock = makeBlockEl('![](' + res.rel + ')', s, desc);
      if (add) container.insertBefore(imgBlock, add);
      else container.appendChild(imgBlock);
      syncContentFromBlocks(container, s);
      toast(t('toast.imgOk') + res.rel, 'success');
    } catch (err) {
      toast(t('toast.imgErr') + (err && err.message ? err.message : err), 'error');
    }
  }

  // ------------------------------------------------------------------
  // Typora-like inline WYSIWYG: rendered blocks that turn into their Markdown
  // source when clicked. `s.content` stays the canonical Markdown throughout.
  // ------------------------------------------------------------------

  // Resolve local img/ images to data URLs (the renderer CSP blocks file:).
  function resolvePreviewImages(container, desc) {
    Array.from(container.querySelectorAll('img')).forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (/^(data:|https?:)/i.test(src)) return;
      img.dataset.rel = src;
      img.addEventListener('mouseenter', () => showImageToolbar(img));
      img.addEventListener('mouseleave', scheduleToolbarHide);
      api
        .readImageDataUrl(Object.assign({}, desc, { rel: src }))
        .then((res) => {
          if (res && res.ok) img.setAttribute('src', res.dataUrl);
          else img.replaceWith(document.createTextNode('⚠ ' + src));
        })
        .catch(() => {});
    });
  }

  function renderBlockInto(rendered, src, desc) {
    if (!src || !src.trim()) {
      rendered.innerHTML =
        '<span class="md-block-empty">' + (lang === 'zh' ? '空白段落（點此輸入）…' : 'empty paragraph…') + '</span>';
      return;
    }
    let html = '';
    try {
      html = window.M2MD && window.M2MD.render ? window.M2MD.render(src) : '';
    } catch (_e) {
      html = '';
    }
    rendered.innerHTML = html;
    resolvePreviewImages(rendered, desc);
  }

  function makeBlockEl(src, s, desc) {
    const b = document.createElement('div');
    b.className = 'md-block';
    b.dataset.src = src || '';
    const rendered = document.createElement('div');
    rendered.className = 'md-rendered';
    renderBlockInto(rendered, src || '', desc);
    b.appendChild(rendered);

    // A "+" at the bottom of every block inserts a new paragraph right after it,
    // so paragraphs can be added between blocks (not only at the end).
    const ins = document.createElement('div');
    ins.className = 'md-block-insert';
    const plus = document.createElement('span');
    plus.className = 'md-ins-plus';
    plus.textContent = '+';
    plus.title = lang === 'zh' ? '在此新增段落' : 'Insert a paragraph here';
    ins.appendChild(plus);
    plus.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    plus.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      insertBlockAfter(b, s, desc);
    });
    b.appendChild(ins);

    b.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const container = wysContainerOf(b);
      const img = e.target && e.target.closest ? e.target.closest('img') : null;

      // Ctrl / Cmd + click on an image opens it in the full-screen lightbox.
      if ((e.ctrlKey || e.metaKey) && img && img.dataset && img.dataset.rel) {
        e.preventDefault();
        openImageLightbox(img);
        return;
      }

      // Shift + click extends a paragraph selection from the anchor to here.
      if (e.shiftKey) {
        e.preventDefault();
        commitEditingBlock(container);
        selectBlockRange(container, selAnchorBlock || b, b);
        selFocusBlock = b;
        return;
      }

      // Ctrl / Cmd + click on text toggles this paragraph in the selection.
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        commitEditingBlock(container);
        toggleBlockSelected(b);
        selAnchorBlock = b;
        selFocusBlock = b;
        return;
      }

      if (b.classList.contains('editing')) return;

      // Plain press: a click selects this paragraph; a drag selects across them
      // (double-click edits it).
      e.preventDefault();
      beginBlockPress(e, b, container, s, desc);
    });

    // Double-click enters edit mode on this paragraph.
    b.addEventListener('dblclick', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (b.classList.contains('editing')) return;
      e.preventDefault();
      const container = wysContainerOf(b);
      clearBlockSelection(container);
      enterBlockEdit(b, s, desc);
    });
    return b;
  }

  function autoSizeBlock(ta) {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }

  function wysContainerOf(b) {
    return (b.closest && b.closest('.md-wys')) || b.parentNode;
  }

  // True when a block's Markdown contains an inline image.
  function blockHasImage(src) {
    return /!\[[^\]]*\]\([^)]*\)/.test(String(src || ''));
  }

  // Parse the first image in a block's Markdown -> { alt, rel, width } or null.
  function firstImageInfo(md) {
    const m = String(md || '').match(/!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?\s*\)/);
    if (!m) return null;
    const wm = String(m[3] || '').match(/^\s*w=(\d{1,4})\s*$/i);
    return { alt: m[1] || '', rel: m[2] || '', width: wm ? parseInt(wm[1], 10) : null };
  }

  // Live-update the image preview shown above the source while an image block is
  // being edited. Adjusts size / alt in place when the file is unchanged (no
  // flicker); re-renders fully only when the image identity actually changes.
  let imgPreviewTimer = null;
  function liveSyncImagePreview(b, val, desc) {
    if (imgPreviewTimer) clearTimeout(imgPreviewTimer);
    imgPreviewTimer = setTimeout(() => {
      const rendered = b.querySelector('.md-rendered');
      if (!rendered) return;
      const info = firstImageInfo(val);
      if (!info) return; // incomplete / removed image: keep the last preview until commit
      const img = rendered.querySelector('img');
      if (img && img.dataset && img.dataset.rel === info.rel) {
        if (info.width) {
          img.style.width = info.width + 'px';
          img.style.maxWidth = 'none';
        } else {
          img.style.width = '';
          img.style.maxWidth = '';
        }
        img.alt = info.alt;
      } else {
        renderBlockInto(rendered, val, desc);
      }
    }, 220);
  }

  function enterBlockEdit(b, s, desc) {
    if (b.classList.contains('editing')) return;
    hideImageToolbar();
    lastActiveBlock = b;
    const isImage = blockHasImage(b.dataset.src || '');
    const rendered = b.querySelector('.md-rendered');
    // For image blocks keep the rendered picture visible above the source, so
    // the user can see it while editing the Markdown; other blocks hide it.
    if (rendered) rendered.style.display = isImage ? '' : 'none';
    const ta = document.createElement('textarea');
    ta.className = 'md-block-edit';
    ta.value = b.dataset.src || '';
    ta.spellcheck = false;
    ta.style.fontSize = editorFontPx() + 'px';
    b.appendChild(ta);
    b.classList.add('editing');
    if (isImage) b.classList.add('editing-image');
    autoSizeBlock(ta);
    ta.focus();
    ta.selectionStart = ta.selectionEnd = ta.value.length;
    ta.addEventListener('input', () => {
      autoSizeBlock(ta);
      if (b.classList.contains('editing-image')) liveSyncImagePreview(b, ta.value, desc);
    });
    ta.addEventListener('keydown', (e) => handleBlockKeydown(e, ta, b, s, desc));
    ta.addEventListener('paste', (e) => handleBlockPaste(e, ta, b, s, desc));
    ta.addEventListener('blur', () => commitBlock(b, s, desc));
  }

  function renderBlockView(b, desc) {
    b.classList.remove('editing');
    b.classList.remove('editing-image');
    const ta = b.querySelector('.md-block-edit');
    if (ta) {
      // Removing a focused textarea fires 'blur' -> commitBlock synchronously,
      // which would re-enter and try to remove the same node again (throwing
      // "node to be removed is no longer a child"). Suppress that commit.
      b.__tearingDown = true;
      try { ta.remove(); } finally { b.__tearingDown = false; }
    }
    let rendered = b.querySelector('.md-rendered');
    if (!rendered) {
      rendered = document.createElement('div');
      rendered.className = 'md-rendered';
      b.appendChild(rendered);
    }
    rendered.style.display = '';
    renderBlockInto(rendered, b.dataset.src || '', desc);
  }

  function syncContentFromBlocks(container, s) {
    const srcs = Array.from(container.querySelectorAll('.md-block'))
      .map((elm) => elm.dataset.src || '')
      .filter((x) => x.trim() !== '');
    s.content = srcs.join('\n\n');
    el('counter').textContent = counterText(s.content);
    saveState();
    refreshSectionTabDirty();
    recordHistory();
  }

  // ------------------------------------------------------------------
  // Editor undo history: per-section content snapshots (keeps 60, >= 10 steps).
  // Native textarea undo still handles fine-grained typing while a block or the
  // source box is focused; this covers structural ops (add / delete / paste
  // image / format / zoom) when Ctrl+Z is pressed outside a text field.
  // ------------------------------------------------------------------
  const sectionHistories = new Map(); // sectionId -> { stack: [content], pos }
  const deletedImageBytes = new Map(); // rel -> { base64, desc }
  let restoringHistory = false;

  function recordHistory() {
    if (restoringHistory) return;
    const s = activeSection();
    if (!s) return;
    const h = sectionHistories.get(s.id);
    if (!h) {
      sectionHistories.set(s.id, { stack: [s.content], pos: 0 });
      return;
    }
    if (h.stack[h.pos] === s.content) return;
    h.stack = h.stack.slice(0, h.pos + 1);
    h.stack.push(s.content);
    if (h.stack.length > 60) h.stack.shift();
    h.pos = h.stack.length - 1;
  }

  // Re-write any deleted image files referenced by restored content.
  function restoreDeletedImages(content) {
    if (!deletedImageBytes.size) return;
    const re = /!\[[^\]]*\]\(\s*([^)\s]+)/g;
    const seen = new Set();
    let m;
    while ((m = re.exec(content)) !== null) {
      const rel = m[1];
      if (seen.has(rel)) continue;
      seen.add(rel);
      const entry = deletedImageBytes.get(rel);
      if (entry && entry.base64) {
        api.restoreImage(Object.assign({}, entry.desc, { rel, base64: entry.base64 })).catch(() => {});
      }
    }
  }

  function applyHistoryState(h) {
    const s = activeSection();
    if (!s) return false;
    restoringHistory = true;
    s.content = h.stack[h.pos];
    restoreDeletedImages(s.content);
    saveState();
    renderEditor();
    refreshSectionTabDirty();
    restoringHistory = false;
    return true;
  }

  function undoEditor() {
    const s = activeSection();
    if (!s) return false;
    const h = sectionHistories.get(s.id);
    if (!h || h.pos <= 0) return false;
    h.pos -= 1;
    return applyHistoryState(h);
  }

  function redoEditor() {
    const s = activeSection();
    if (!s) return false;
    const h = sectionHistories.get(s.id);
    if (!h || h.pos >= h.stack.length - 1) return false;
    h.pos += 1;
    return applyHistoryState(h);
  }

  function commitBlock(b, s, desc) {
    // Guard against re-entrancy: tearing down the textarea (renderBlockView /
    // b.remove()) blurs it, which fires this same handler mid-removal. Also skip
    // while an async image paste is in-flight on this block (see handleBlockPaste).
    if (b.__tearingDown || b.__pasting) return;
    const ta = b.querySelector('.md-block-edit');
    if (!ta) return;
    const container = wysContainerOf(b);
    const val = ta.value;
    const subs = window.M2MD && window.M2MD.splitBlocks ? window.M2MD.splitBlocks(val) : val.trim() ? [val.trim()] : [];
    if (subs.length <= 1) {
      b.dataset.src = subs.length ? subs[0] : '';
      if (!b.dataset.src && container.querySelectorAll('.md-block').length > 1) {
        b.remove();
      } else {
        renderBlockView(b, desc);
      }
    } else {
      subs.forEach((sub) => container.insertBefore(makeBlockEl(sub, s, desc), b));
      b.remove();
    }
    syncContentFromBlocks(container, s);
  }

  function handleBlockKeydown(e, ta, b, s, desc) {
    // Ctrl/Cmd+Enter ends the current paragraph: commit it and start a new one
    // below (an empty paragraph is just committed / left).
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      const before = ta.value.replace(/\s+$/, '');
      if (before === '') {
        ta.blur();
        return;
      }
      const container = wysContainerOf(b);
      b.dataset.src = before;
      renderBlockView(b, desc);
      const nb = makeBlockEl('', s, desc);
      if (b.nextSibling) container.insertBefore(nb, b.nextSibling);
      else container.appendChild(nb);
      syncContentFromBlocks(container, s);
      enterBlockEdit(nb, s, desc);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      ta.blur();
      // Select the paragraph you just left so Up / Down navigate from here and
      // Enter / F2 re-enter it.
      const container = wysContainerOf(b);
      if (container && container.contains(b)) {
        clearBlockSelection(container);
        b.classList.add('selected');
        selAnchorBlock = b;
        selFocusBlock = b;
        lastActiveBlock = b;
        updateSelectionToolbar();
      }
      return;
    }
    // Plain Enter is a line break within the paragraph (Ctrl+Enter ends it).
    if (e.key === 'Enter' && !(e.ctrlKey || e.metaKey) && !e.isComposing) {
      return; // let the textarea insert a newline
    }
    handleEditorKeydown(e, ta);
  }

  // Pasting an image inside a block drops it in as its own image block right
  // below (so it renders immediately) and moves the caret into a fresh block.
  async function handleBlockPaste(e, ta, b, s, desc) {
    const info = extractImageFromClipboard(e);
    if (!info) return;
    e.preventDefault();
    // Capture the container now (while `b` is connected) and keep this block
    // alive through the async save. Otherwise a blur during the await would let
    // commitBlock commit/remove `b`, and the resumed paste would then operate on
    // a detached node -> "node to be removed is no longer a child ... moved in a
    // 'blur' event handler".
    const container = wysContainerOf(b);
    b.__pasting = true;
    try {
      const res = await saveClipboardImage(info);
      if (!res || !res.ok) {
        toast(t('toast.imgErr') + ((res && res.error) || ''), 'error');
        return;
      }
      b.dataset.src = ta.value;
      renderBlockView(b, desc);
      const hadText = (b.dataset.src || '').trim() !== '';
      const imgBlock = makeBlockEl('![](' + res.rel + ')', s, desc);
      const nextBlock = makeBlockEl('', s, desc);
      const anchor = b.nextSibling;
      if (container) {
        container.insertBefore(imgBlock, anchor);
        container.insertBefore(nextBlock, anchor);
      }
      // If the block we pasted into was empty, drop it so no blank line remains.
      if (!hadText) b.remove();
      syncContentFromBlocks(container, s);
      enterBlockEdit(nextBlock, s, desc);
      toast(t('toast.imgOk') + res.rel, 'success');
    } catch (err) {
      toast(t('toast.imgErr') + (err && err.message ? err.message : err), 'error');
    } finally {
      b.__pasting = false;
    }
  }

  function renderWysiwyg(container, s, desc) {
    container.innerHTML = '';
    let blocks = window.M2MD && window.M2MD.splitBlocks ? window.M2MD.splitBlocks(s.content || '') : [];
    if (!blocks.length) blocks = [''];
    blocks.forEach((src) => container.appendChild(makeBlockEl(src, s, desc)));
  }

  // ------------------------------------------------------------------
  // Multi-paragraph selection: Shift/Ctrl + click or drag to select several
  // blocks, then copy (Ctrl+C) or delete (Del) them together.
  // ------------------------------------------------------------------
  let selAnchorBlock = null;
  let lastActiveBlock = null;
  let selFocusBlock = null;

  function wysContainer() {
    return el('sectionBody') && el('sectionBody').querySelector('.md-wys');
  }

  function clearBlockSelection(container) {
    const c = container || wysContainer();
    if (c) c.querySelectorAll('.md-block.selected').forEach((b) => b.classList.remove('selected'));
    selFocusBlock = null;
    updateSelectionToolbar();
  }

  function toggleBlockSelected(b) {
    if (b) b.classList.toggle('selected');
    updateSelectionToolbar();
  }

  function selectBlockRange(container, a, b) {
    const blocks = Array.from(container.querySelectorAll('.md-block'));
    let ia = blocks.indexOf(a);
    let ib = blocks.indexOf(b);
    if (ia === -1 || ib === -1) return;
    if (ia > ib) {
      const tmp = ia;
      ia = ib;
      ib = tmp;
    }
    blocks.forEach((blk, i) => blk.classList.toggle('selected', i >= ia && i <= ib));
    updateSelectionToolbar();
  }

  function blockFromPoint(x, y, container) {
    const node = document.elementFromPoint(x, y);
    const b = node && node.closest ? node.closest('.md-block') : null;
    return b && container.contains(b) ? b : null;
  }

  // Finish whichever block is open for editing so selection acts on settled MD.
  function commitEditingBlock(container) {
    const editing = container && container.querySelector('.md-block.editing');
    const ta = editing && editing.querySelector('.md-block-edit');
    if (ta) ta.blur();
  }

  // A plain press either edits the block (click) or starts a drag-selection.
  function beginBlockPress(e, block, container, s, desc) {
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    const move = (ev) => {
      if (!dragging) {
        if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) < 6) return;
        dragging = true;
        selAnchorBlock = block;
        commitEditingBlock(container);
      }
      const over = blockFromPoint(ev.clientX, ev.clientY, container);
      if (over) {
        selectBlockRange(container, block, over);
        selFocusBlock = over;
      }
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      if (!dragging) {
        // A single click selects the paragraph (double-click edits it).
        clearBlockSelection(container);
        block.classList.add('selected');
        selAnchorBlock = block;
        selFocusBlock = block;
        lastActiveBlock = block;
        updateSelectionToolbar();
      }
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }

  function copySelectedBlocks(container) {
    const c = container || wysContainer();
    const sel = c ? Array.from(c.querySelectorAll('.md-block.selected')) : [];
    if (!sel.length) return;
    const md = sel.map((b) => b.dataset.src || '').filter((x) => x.trim() !== '').join('\n\n');
    navigator.clipboard.writeText(md).then(
      () => toast(lang === 'zh' ? `已複製 ${sel.length} 個段落` : `Copied ${sel.length} paragraph(s)`, 'success'),
      () => toast('Clipboard error', 'error')
    );
  }

  function deleteSelectedBlocks(container) {
    const c = container || wysContainer();
    if (!c) return;
    const sel = Array.from(c.querySelectorAll('.md-block.selected'));
    if (!sel.length) return;
    const s = activeSection();
    if (!s) return;
    const n = sel.length;
    sel.forEach((b) => b.remove());
    syncContentFromBlocks(c, s);
    renderEditor();
    refreshSectionTabDirty();
    toast(lang === 'zh' ? `已删除 ${n} 個段落（Ctrl+Z 復原）` : `Deleted ${n} paragraph(s) (Ctrl+Z to undo)`, 'info');
  }

  function getSelectionToolbar() {
    let bar = document.getElementById('blockSelBar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.className = 'blocksel-bar';
    bar.id = 'blockSelBar';
    const count = document.createElement('span');
    count.className = 'blocksel-count';
    const mk = (cls, fn) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'blocksel-btn' + (cls ? ' ' + cls : '');
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        fn();
      });
      return btn;
    };
    bar._count = count;
    bar._btnCopy = mk('', () => copySelectedBlocks(wysContainer()));
    bar._btnDelete = mk('danger', () => deleteSelectedBlocks(wysContainer()));
    bar._btnClear = mk('', () => clearBlockSelection(wysContainer()));
    bar.appendChild(count);
    bar.appendChild(bar._btnCopy);
    bar.appendChild(bar._btnDelete);
    bar.appendChild(bar._btnClear);
    document.body.appendChild(bar);
    return bar;
  }

  function updateSelectionToolbar() {
    const c = wysContainer();
    const n = c ? c.querySelectorAll('.md-block.selected').length : 0;
    const bar = getSelectionToolbar();
    // The action bar is for bulk actions, so only show it for multi-selection;
    // a single navigated / selected paragraph stays clean.
    if (n < 2) {
      bar.classList.remove('open');
      return;
    }
    const zh = lang === 'zh';
    bar._count.textContent = zh ? `已選取 ${n} 個段落` : `${n} selected`;
    bar._btnCopy.textContent = zh ? '複製' : 'Copy';
    bar._btnDelete.textContent = zh ? '删除' : 'Delete';
    bar._btnClear.textContent = zh ? '取消' : 'Clear';
    bar.classList.add('open');
  }

  // Keyboard paragraph navigation. Plain Arrow moves a single-block selection;
  // Shift+Arrow extends a range from the anchor (multi-select).
  function moveBlockSelection(container, dir, extend) {
    const blocks = Array.from(container.querySelectorAll('.md-block'));
    if (!blocks.length) return;
    const inDom = (elm) => !!elm && blocks.indexOf(elm) !== -1;
    const selected = blocks.filter((b) => b.classList.contains('selected'));

    // The moving end (focus) of the selection.
    let focus = null;
    if (inDom(selFocusBlock) && selFocusBlock.classList.contains('selected')) focus = selFocusBlock;
    else if (selected.length) focus = dir > 0 ? selected[selected.length - 1] : selected[0];
    else if (inDom(lastActiveBlock)) focus = lastActiveBlock;

    if (!focus) {
      // Nothing to move from yet: select an edge block.
      const edge = blocks[dir > 0 ? 0 : blocks.length - 1];
      blocks.forEach((b) => b.classList.toggle('selected', b === edge));
      selAnchorBlock = edge;
      selFocusBlock = edge;
      updateSelectionToolbar();
      edge.scrollIntoView({ block: 'nearest' });
      return;
    }

    const idx = Math.max(0, Math.min(blocks.length - 1, blocks.indexOf(focus) + dir));
    const target = blocks[idx];

    if (extend) {
      if (!inDom(selAnchorBlock)) selAnchorBlock = focus;
      selectBlockRange(container, selAnchorBlock, target);
      selFocusBlock = target;
    } else {
      blocks.forEach((b) => b.classList.toggle('selected', b === target));
      selAnchorBlock = target;
      selFocusBlock = target;
      updateSelectionToolbar();
    }
    target.scrollIntoView({ block: 'nearest' });
  }

  // Enter edit mode on the currently selected paragraph (Enter key).
  function editSelectedBlock(container) {
    const cur = container.querySelector('.md-block.selected');
    if (!cur) return;
    clearBlockSelection(container);
    const p = activeProject();
    enterBlockEdit(cur, activeSection(p), imageDescriptor(p));
  }

  // Insert a fresh empty paragraph right after `block` and edit it.
  function insertBlockAfter(block, s, desc) {
    const container = wysContainerOf(block);
    clearBlockSelection(container);
    const nb = makeBlockEl('', s, desc);
    block.after(nb);
    enterBlockEdit(nb, s, desc);
  }

  // ------------------------------------------------------------------
  // Image right-click menu: copy to clipboard / delete (Ctrl+Z to undo)
  // ------------------------------------------------------------------

  function closeImageContextMenu() {
    const m = document.getElementById('imgCtxMenu');
    if (m) m.remove();
  }

  function showImageContextMenu(x, y, img) {
    closeImageContextMenu();
    const menu = document.createElement('div');
    menu.className = 'ctx-menu';
    menu.id = 'imgCtxMenu';
    const item = (label, danger, fn) => {
      const it = document.createElement('div');
      it.className = 'ctx-item' + (danger ? ' danger' : '');
      it.textContent = label;
      it.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeImageContextMenu();
        fn();
      });
      return it;
    };
    menu.appendChild(item(lang === 'zh' ? '放大' : 'Zoom in', false, () => zoomImage(img, 1.2)));
    menu.appendChild(item(lang === 'zh' ? '縮小' : 'Zoom out', false, () => zoomImage(img, 1 / 1.2)));
    menu.appendChild(item(lang === 'zh' ? '複製圖片' : 'Copy image', false, () => copyImageToClipboard(img)));
    menu.appendChild(item(lang === 'zh' ? '開啟圖片位置' : 'Open image location', false, () => revealImageLocation(img)));
    menu.appendChild(item(lang === 'zh' ? '刪除圖片' : 'Delete image', true, () => deleteImageFromWysiwyg(img)));
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(4, Math.min(x, window.innerWidth - r.width - 6)) + 'px';
    menu.style.top = Math.max(4, Math.min(y, window.innerHeight - r.height - 6)) + 'px';
  }

  // ------------------------------------------------------------------
  // Text right-click menu: apply Markdown formatting to the selection.
  // ------------------------------------------------------------------
  function closeTextContextMenu() {
    const m = document.getElementById('txtCtxMenu');
    if (m) m.remove();
  }

  function showTextContextMenu(x, y, ta) {
    if (!ta) return;
    closeTextContextMenu();
    closeImageContextMenu();
    const zh = lang === 'zh';
    const menu = document.createElement('div');
    menu.className = 'ctx-menu';
    menu.id = 'txtCtxMenu';

    const addItem = (label, hint, fn) => {
      const it = document.createElement('div');
      it.className = 'ctx-item';
      const lab = document.createElement('span');
      lab.textContent = label;
      it.appendChild(lab);
      if (hint) {
        const kb = document.createElement('span');
        kb.className = 'ctx-kbd';
        kb.textContent = hint;
        it.appendChild(kb);
      }
      // mousedown + preventDefault keeps the textarea focused so its selection
      // survives; then we apply the formatting helper to it.
      it.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeTextContextMenu();
        ta.focus();
        try {
          fn(ta);
        } catch (_e) {
          /* ignore */
        }
      });
      menu.appendChild(it);
    };
    const addSep = () => {
      const sp = document.createElement('div');
      sp.className = 'ctx-sep';
      menu.appendChild(sp);
    };

    addItem(zh ? '粗體' : 'Bold', 'Ctrl+B', (t) => wrapSelection(t, '**', '**', zh ? '粗體' : 'bold'));
    addItem(zh ? '斜體' : 'Italic', 'Ctrl+I', (t) => wrapSelection(t, '*', '*', zh ? '斜體' : 'italic'));
    addItem(zh ? '刪除線' : 'Strikethrough', 'Ctrl+Shift+X', (t) => wrapSelection(t, '~~', '~~', zh ? '刪除線' : 'strike'));
    addItem(zh ? '行內程式碼' : 'Inline code', 'Ctrl+`', (t) => wrapSelection(t, '`', '`', 'code'));
    addSep();
    addItem(zh ? '標題 1' : 'Heading 1', 'Ctrl+1', (t) => setHeadingLine(t, 1));
    addItem(zh ? '標題 2' : 'Heading 2', 'Ctrl+2', (t) => setHeadingLine(t, 2));
    addItem(zh ? '標題 3' : 'Heading 3', 'Ctrl+3', (t) => setHeadingLine(t, 3));
    addSep();
    addItem(zh ? '引用' : 'Blockquote', 'Ctrl+Shift+Q', (t) => toggleLinePrefix(t, '> '));
    addItem(zh ? '項目符號清單' : 'Bulleted list', 'Ctrl+Shift+L', (t) => toggleLinePrefix(t, '- '));
    addItem(zh ? '編號清單' : 'Numbered list', '', (t) => toggleLinePrefix(t, '1. '));
    addSep();
    addItem(zh ? '程式碼區塊' : 'Code block', 'Ctrl+Shift+C', (t) => insertCodeBlock(t));
    addItem(zh ? '連結' : 'Link', 'Ctrl+K', (t) => insertLink(t));
    addItem(zh ? '分隔線' : 'Horizontal rule', '', (t) => insertHorizontalRule(t));

    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(4, Math.min(x, window.innerWidth - r.width - 6)) + 'px';
    menu.style.top = Math.max(4, Math.min(y, window.innerHeight - r.height - 6)) + 'px';
  }

  async function copyImageToClipboard(img) {
    const rel = img && img.dataset ? img.dataset.rel : '';
    if (!rel) return;
    try {
      const res = await api.copyImageToClipboard(Object.assign({}, imageDescriptor(activeProject()), { rel }));
      if (res && res.ok) toast(lang === 'zh' ? '圖片已複製到剪貼簿' : 'Image copied to clipboard', 'success');
      else toast((lang === 'zh' ? '複製失敗：' : 'Copy failed: ') + ((res && res.error) || ''), 'error');
    } catch (err) {
      toast((lang === 'zh' ? '複製失敗：' : 'Copy failed: ') + (err && err.message ? err.message : err), 'error');
    }
  }

  // Remove the ![alt](rel) Markdown for a given image path from the content.
  function removeImageMarkdown(content, rel) {
    const esc = String(rel).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('!\\[[^\\]]*\\]\\(\\s*' + esc + '(?:\\s+"[^"]*")?\\s*\\)', 'g');
    return String(content)
      .replace(re, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\n+|\n+$/g, '');
  }

  async function deleteImageFromWysiwyg(img) {
    const rel = img && img.dataset ? img.dataset.rel : '';
    if (!rel) return;
    const p = activeProject();
    const s = activeSection(p);
    const desc = imageDescriptor(p);
    let base64 = null;
    try {
      const res = await api.deleteImage(Object.assign({}, desc, { rel }));
      if (res && res.ok) base64 = res.base64 || null;
    } catch (_e) {
      /* file may already be gone - still remove the markdown */
    }
    if (base64) {
      deletedImageBytes.set(rel, { base64, desc });
      if (deletedImageBytes.size > 30) {
        deletedImageBytes.delete(deletedImageBytes.keys().next().value);
      }
    }
    s.content = removeImageMarkdown(s.content, rel);
    saveState();
    renderEditor();
    refreshSectionTabDirty();
    toast(lang === 'zh' ? '已刪除圖片（Ctrl+Z 可還原）' : 'Image deleted (Ctrl+Z to undo)', 'info');
  }

  // ------------------------------------------------------------------
  // Image hover toolbar (Typora-style): floats above an image in the WYSIWYG
  // view with zoom out / zoom in / copy / open-location / delete actions.
  // ------------------------------------------------------------------
  let toolbarImg = null;
  let toolbarHideTimer = null;

  const TB_ICONS = {
    zoomOut:
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
    zoomIn:
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
    copy:
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    open:
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    del:
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    expand:
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
  };

  function getImageToolbar() {
    let bar = document.getElementById('imgToolbar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.className = 'img-toolbar';
    bar.id = 'imgToolbar';
    const mk = (icon, danger, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'img-tb-btn' + (danger ? ' danger' : '');
      b.innerHTML = icon;
      // Prevent the click from bubbling into the block (which would enter edit).
      b.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      b.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (toolbarImg) fn(toolbarImg);
      });
      return b;
    };
    bar._btnZoomOut = mk(TB_ICONS.zoomOut, false, (img) => zoomImage(img, 1 / 1.2));
    bar._btnZoomIn = mk(TB_ICONS.zoomIn, false, (img) => zoomImage(img, 1.2));
    bar._btnExpand = mk(TB_ICONS.expand, false, (img) => openImageLightbox(img));
    bar._btnCopy = mk(TB_ICONS.copy, false, (img) => copyImageToClipboard(img));
    bar._btnOpen = mk(TB_ICONS.open, false, (img) => revealImageLocation(img));
    bar._btnDelete = mk(TB_ICONS.del, true, (img) => deleteImageFromWysiwyg(img));
    [bar._btnZoomOut, bar._btnZoomIn, bar._btnExpand, bar._btnCopy, bar._btnOpen, bar._btnDelete].forEach((b) => bar.appendChild(b));
    bar.addEventListener('mouseenter', cancelToolbarHide);
    bar.addEventListener('mouseleave', scheduleToolbarHide);
    window.addEventListener('resize', hideImageToolbar);
    document.body.appendChild(bar);
    return bar;
  }

  function positionImageToolbar(bar, img) {
    if (!bar || !img) return;
    const r = img.getBoundingClientRect();
    const bodyEl = el('sectionBody');
    const bounds = bodyEl ? bodyEl.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    // Hide when the image is scrolled out of the editor viewport.
    if (r.bottom < bounds.top || r.top > bounds.bottom) {
      hideImageToolbar();
      return;
    }
    const bw = bar.offsetWidth;
    const bh = bar.offsetHeight;
    let top = r.top - bh - 4;
    if (top < bounds.top + 2) top = r.top + 4; // overlay just inside the image top
    const left = Math.max(6, Math.min(r.left, window.innerWidth - bw - 6));
    bar.style.left = Math.round(left) + 'px';
    bar.style.top = Math.round(top) + 'px';
  }

  function showImageToolbar(img) {
    const blk = img && img.closest ? img.closest('.md-block') : null;
    // While a block's Markdown source is open, editing happens in the textarea;
    // don't overlay the toolbar (its zoom would desync from the source text).
    if (blk && blk.classList.contains('editing')) return;
    cancelToolbarHide();
    toolbarImg = img;
    const bar = getImageToolbar();
    const zh = lang === 'zh';
    bar._btnZoomOut.title = zh ? '縮小' : 'Zoom out';
    bar._btnZoomIn.title = zh ? '放大' : 'Zoom in';
    bar._btnExpand.title = zh ? '燈箱檢視（Ctrl+點按）' : 'Lightbox view (Ctrl+click)';
    bar._btnCopy.title = zh ? '複製到剪貼簿' : 'Copy to clipboard';
    bar._btnOpen.title = zh ? '開啟圖片位置' : 'Open image location';
    bar._btnDelete.title = zh ? '刪除（檔案＋語法）' : 'Delete (file + Markdown)';
    bar.classList.add('visible');
    bar.style.display = 'flex';
    positionImageToolbar(bar, img);
  }

  function hideImageToolbar() {
    const bar = document.getElementById('imgToolbar');
    if (bar) {
      bar.classList.remove('visible');
      bar.style.display = 'none';
    }
    toolbarImg = null;
  }

  function scheduleToolbarHide() {
    cancelToolbarHide();
    toolbarHideTimer = setTimeout(hideImageToolbar, 180);
  }

  function cancelToolbarHide() {
    if (toolbarHideTimer) {
      clearTimeout(toolbarHideTimer);
      toolbarHideTimer = null;
    }
  }

  // Current effective pixel width of an image (explicit style width, else the
  // width it currently renders at).
  function imageWidthPx(img) {
    const styled = parseInt(img.style.width, 10);
    if (Number.isFinite(styled) && styled > 0) return styled;
    const r = img.getBoundingClientRect();
    if (r.width) return Math.round(r.width);
    return img.naturalWidth || 320;
  }

  // Store an explicit pixel width in the Markdown for the image whose path is
  // `rel`, as its title: ![alt](rel "w=NNN"). Portable (degrades to a tooltip).
  function setImageWidthInMarkdown(md, rel, width) {
    const esc = String(rel).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(!\\[[^\\]]*\\]\\(\\s*' + esc + ')(?:\\s+"[^"]*")?(\\s*\\))', 'g');
    return String(md).replace(re, '$1 "w=' + width + '"$2');
  }

  // Zoom an image by a factor and persist the new width into the block's
  // Markdown source so it survives reloads / export.
  function zoomImage(img, factor) {
    const block = img && img.closest ? img.closest('.md-block') : null;
    const rel = img && img.dataset ? img.dataset.rel : '';
    if (!block || !rel) return;
    let next = Math.round(imageWidthPx(img) * factor);
    next = Math.max(48, Math.min(2400, next));
    img.style.width = next + 'px';
    img.style.maxWidth = 'none';
    block.dataset.src = setImageWidthInMarkdown(block.dataset.src || '', rel, next);
    syncContentFromBlocks(wysContainerOf(block), activeSection(activeProject()));
    const bar = document.getElementById('imgToolbar');
    if (bar && toolbarImg === img) positionImageToolbar(bar, img);
  }

  // Reveal an inserted image in the OS file manager, selecting the file.
  async function revealImageLocation(img) {
    const rel = img && img.dataset ? img.dataset.rel : '';
    if (!rel) return;
    try {
      const res = await api.revealImage(Object.assign({}, imageDescriptor(activeProject()), { rel }));
      if (!res || !res.ok) {
        toast((lang === 'zh' ? '無法開啟位置：' : 'Cannot open location: ') + ((res && res.error) || ''), 'error');
      }
    } catch (err) {
      toast((lang === 'zh' ? '無法開啟位置：' : 'Cannot open location: ') + (err && err.message ? err.message : err), 'error');
    }
  }

  // ------------------------------------------------------------------
  // Image lightbox: Ctrl/Cmd + click (or the toolbar expand button) opens the
  // image full-screen with wheel-zoom and drag-to-pan. Esc / backdrop closes.
  // ------------------------------------------------------------------
  let lbEls = null;
  let lbScale = 1;
  let lbTx = 0;
  let lbTy = 0;

  function applyLbTransform() {
    if (!lbEls) return;
    lbEls.img.style.transform = 'translate(' + lbTx + 'px, ' + lbTy + 'px) scale(' + lbScale + ')';
    lbEls.img.classList.toggle('zoomed', lbScale > 1);
  }

  function updateLbZoom() {
    if (lbEls) lbEls.zoom.textContent = Math.round(lbScale * 100) + '%';
  }

  function lbReset() {
    lbScale = 1;
    lbTx = 0;
    lbTy = 0;
    applyLbTransform();
    updateLbZoom();
  }

  function lbZoomBy(factor) {
    const next = Math.max(1, Math.min(8, lbScale * factor));
    const ratio = next / lbScale;
    lbTx *= ratio;
    lbTy *= ratio;
    lbScale = next;
    if (lbScale === 1) {
      lbTx = 0;
      lbTy = 0;
    }
    applyLbTransform();
    updateLbZoom();
  }

  function onLbWheel(e) {
    e.preventDefault();
    const rect = lbEls.stage.getBoundingClientRect();
    const cx = e.clientX - (rect.left + rect.width / 2);
    const cy = e.clientY - (rect.top + rect.height / 2);
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const next = Math.max(1, Math.min(8, lbScale * factor));
    const ratio = next / lbScale;
    lbTx = cx - (cx - lbTx) * ratio;
    lbTy = cy - (cy - lbTy) * ratio;
    lbScale = next;
    if (lbScale === 1) {
      lbTx = 0;
      lbTy = 0;
    }
    applyLbTransform();
    updateLbZoom();
  }

  function onLbImgDown(e) {
    if (lbScale <= 1) return;
    e.preventDefault();
    const sx = e.clientX - lbTx;
    const sy = e.clientY - lbTy;
    lbEls.img.classList.add('grabbing');
    const move = (ev) => {
      lbTx = ev.clientX - sx;
      lbTy = ev.clientY - sy;
      applyLbTransform();
    };
    const up = () => {
      if (lbEls) lbEls.img.classList.remove('grabbing');
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }

  function onLbKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeLightbox();
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      lbZoomBy(1.3);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      lbZoomBy(1 / 1.3);
    } else if (e.key === '0') {
      e.preventDefault();
      lbReset();
    }
  }

  function buildLightbox() {
    if (lbEls) return lbEls;
    const overlay = document.createElement('div');
    overlay.className = 'lightbox';
    overlay.id = 'imgLightbox';

    const bar = document.createElement('div');
    bar.className = 'lightbox-bar';
    const zoom = document.createElement('span');
    zoom.className = 'lb-zoom';
    const RESET_ICON =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
    const CLOSE_ICON =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    const mkBtn = (icon, act) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lb-btn' + (act === 'close' ? ' lb-close' : '');
      b.innerHTML = icon;
      b.dataset.act = act;
      return b;
    };
    bar.appendChild(mkBtn(TB_ICONS.zoomOut, 'zoomout'));
    bar.appendChild(zoom);
    bar.appendChild(mkBtn(TB_ICONS.zoomIn, 'zoomin'));
    bar.appendChild(mkBtn(RESET_ICON, 'reset'));
    bar.appendChild(mkBtn(CLOSE_ICON, 'close'));

    const stage = document.createElement('div');
    stage.className = 'lightbox-stage';
    const img = document.createElement('img');
    img.className = 'lightbox-img';
    img.draggable = false;
    stage.appendChild(img);

    overlay.appendChild(bar);
    overlay.appendChild(stage);
    document.body.appendChild(overlay);

    bar.addEventListener('mousedown', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('.lb-btn') : null;
      if (!btn) return;
      e.preventDefault();
      const act = btn.dataset.act;
      if (act === 'close') closeLightbox();
      else if (act === 'zoomin') lbZoomBy(1.3);
      else if (act === 'zoomout') lbZoomBy(1 / 1.3);
      else if (act === 'reset') lbReset();
    });
    stage.addEventListener('mousedown', (e) => {
      if (e.target === stage) closeLightbox();
    });
    stage.addEventListener('wheel', onLbWheel, { passive: false });
    img.addEventListener('mousedown', onLbImgDown);
    img.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (lbScale > 1) lbReset();
      else lbZoomBy(2);
    });

    lbEls = { overlay, stage, img, zoom };
    return lbEls;
  }

  function showLightbox(src, alt) {
    closeImageContextMenu();
    closeTextContextMenu();
    hideImageToolbar();
    const els = buildLightbox();
    els.img.src = src;
    els.img.alt = alt || '';
    lbReset();
    els.overlay.classList.add('open');
    document.addEventListener('keydown', onLbKey);
  }

  function closeLightbox() {
    if (lbEls) lbEls.overlay.classList.remove('open');
    document.removeEventListener('keydown', onLbKey);
  }

  // Resolve an image element's source to a data URL and show it in the lightbox.
  async function openImageLightbox(img) {
    if (!img) return;
    let src = img.currentSrc || img.src || '';
    if (!/^(data:|https?:)/i.test(src) && img.dataset && img.dataset.rel) {
      try {
        const res = await api.readImageDataUrl(
          Object.assign({}, imageDescriptor(activeProject()), { rel: img.dataset.rel })
        );
        if (res && res.ok) src = res.dataUrl;
      } catch (_e) {
        /* ignore */
      }
    }
    if (!src) return;
    showLightbox(src, img.getAttribute('alt') || '');
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

    const bp = el('btnPreview');
    if (bp) {
      bp.addEventListener('click', () => {
        state.previewMode = !state.previewMode;
        saveState();
        renderEditor();
      });
    }
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
    if (!activeProject()) return;
    const btn = el('btnExport');
    btn.classList.add('loading');
    try {
      // Capture any paragraph open for editing before reading the payload.
      commitEditingBlock(wysContainer());
      const originalId = state.activeProjectId;
      const res = await api.exportPrompt(exportPayload());
      if (res && res.ok) {
        showResult(res);
        toast(`${t('toast.exportOk')} ${res.folder}`, 'success');
        // Re-open the exported folder as a disk-backed project and close the
        // original draft tab, so further edits are saved back to that folder.
        await reopenExportedProject(res.path, originalId);
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
    commitEditingBlock(wysContainer());
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
    if (!p || !p.sourcePath) return;
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

  // Turn loaded project data (from the dialog or an Explorer hand-off) into a
  // new in-app project tab. Returns false when the folder held no sections.
  function applyLoadedProject(d, opts) {
    opts = opts || {};
    if (!d || !Array.isArray(d.sections) || !d.sections.length) {
      toast(t('toast.openEmpty'), 'error');
      return false;
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
    if (!opts.silent) toast(t('toast.openOk'), 'success');
    return true;
  }

  async function openProjectFolder() {
    let res;
    try {
      res = await api.openProject(state.outputBase);
    } catch (e) {
      toast(t('toast.openErr') + e.message, 'error');
      return;
    }
    if (!res || res.canceled) return;
    if (!res.ok) {
      toast(t('toast.openErr') + (res.error || ''), 'error');
      return;
    }
    applyLoadedProject(res.project || {});
  }

  // Auto-open a specific exported folder handed over by the Explorer
  // right-click menu (on launch, or from a later launch while already open).
  async function openProjectByPath(dir) {
    if (!dir || typeof api.openProjectPath !== 'function') return;
    let res;
    try {
      res = await api.openProjectPath(dir);
    } catch (e) {
      toast(t('toast.openErr') + e.message, 'error');
      return;
    }
    if (!res || !res.ok) {
      toast(t('toast.openErr') + ((res && res.error) || ''), 'error');
      return;
    }
    applyLoadedProject(res.project || {});
  }

  // Remove a project tab by id (never the last remaining one), keeping a valid
  // active tab afterwards.
  function removeProjectById(id) {
    if (!id) return;
    const idx = state.projects.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const wasActive = state.activeProjectId === id;
    state.projects.splice(idx, 1);
    if (wasActive) {
      state.activeProjectId = state.projects.length ? state.projects[Math.max(0, idx - 1)].id : null;
    }
    saveState();
    renderAll();
  }

  // After a successful export, re-open the exported folder as a disk-backed
  // project (so further edits use Save) and close the original draft tab.
  async function reopenExportedProject(dir, originalId) {
    if (!dir || typeof api.openProjectPath !== 'function') return;
    let res;
    try {
      res = await api.openProjectPath(dir);
    } catch (_e) {
      return; // keep the original tab open if re-opening failed
    }
    if (!res || !res.ok || !res.project) return;
    const ok = applyLoadedProject(res.project, { silent: true });
    if (ok) removeProjectById(originalId);
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

    // Ctrl+Z restores the most recently deleted image (when not typing in a
    // field, so it never steals a textarea's native undo). Esc / outside click
    // dismisses the image right-click menu.
    document.addEventListener('keydown', (e) => {
      const ae = document.activeElement;
      const inField = ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT');

      // Ctrl/Cmd+S saves the current project (commits any open paragraph first).
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 's' || e.key === 'S')) {
        if (!document.querySelector('.modal-overlay:not(.hidden)')) {
          e.preventDefault();
          commitEditingBlock(wysContainer());
          const proj = activeProject();
          if (proj && proj.sourcePath) {
            doSave();
          } else {
            toast(lang === 'zh' ? '新專案請先「輸出」以儲存到磁碟' : 'Export the new project first to save it to disk', 'info');
          }
          return;
        }
      }

      // Alt+F opens a project folder (same as the Open Project button).
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyF') {
        if (!document.querySelector('.modal-overlay:not(.hidden)')) {
          e.preventDefault();
          openProjectFolder();
          return;
        }
      }

      // Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y) outside text fields: undo / redo the
      // editor content (paragraph & image structural ops). Inside a textarea the
      // browser's native per-keystroke undo handles Ctrl+Z instead.
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y')) {
        if (!inField) {
          const redo = e.shiftKey || e.key === 'y' || e.key === 'Y';
          e.preventDefault();
          if (redo) redoEditor();
          else undoEditor();
          return;
        }
      }

      // Paragraph navigation & actions (when not typing in a field).
      if (!inField && state.previewMode) {
        const container = wysContainer();
        const modalOpen = document.querySelector('.modal-overlay:not(.hidden)');
        if (container && !modalOpen) {
          const hasSel = !!container.querySelector('.md-block.selected');
          const canNav = hasSel || (lastActiveBlock && container.contains(lastActiveBlock));
          if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && canNav) {
            e.preventDefault();
            moveBlockSelection(container, e.key === 'ArrowDown' ? 1 : -1, e.shiftKey);
            return;
          }
          // Ctrl/Cmd+A selects every paragraph.
          if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'a' || e.key === 'A')) {
            const all = Array.from(container.querySelectorAll('.md-block'));
            if (all.length) {
              e.preventDefault();
              all.forEach((b) => b.classList.add('selected'));
              selAnchorBlock = all[0];
              selFocusBlock = all[all.length - 1];
              updateSelectionToolbar();
              return;
            }
          }
          if (hasSel) {
            if (e.key === 'F2' || (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey)) {
              e.preventDefault();
              editSelectedBlock(container);
              return;
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
              e.preventDefault();
              deleteSelectedBlocks(container);
              return;
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
              e.preventDefault();
              copySelectedBlocks(container);
              return;
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) {
              e.preventDefault();
              copySelectedBlocks(container);
              deleteSelectedBlocks(container);
              return;
            }
            if (e.key === 'Escape') {
              clearBlockSelection(container);
              return;
            }
          }
        }
      }

      if (e.key === 'Escape') {
        closeImageContextMenu();
        closeTextContextMenu();
        closeTabContextMenu();
      }
    });
    document.addEventListener('mousedown', (e) => {
      const m = document.getElementById('imgCtxMenu');
      if (m && !m.contains(e.target)) closeImageContextMenu();
      const tm = document.getElementById('txtCtxMenu');
      if (tm && !tm.contains(e.target)) closeTextContextMenu();
      const pm = document.getElementById('tabCtxMenu');
      if (pm && !pm.contains(e.target)) closeTabContextMenu();
    });
    document.addEventListener('scroll', () => {
      closeImageContextMenu();
      closeTextContextMenu();
      closeTabContextMenu();
    }, true);
    window.addEventListener('blur', () => {
      closeImageContextMenu();
      closeTextContextMenu();
      closeTabContextMenu();
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
      const pn = (activeProject() && activeProject().fields.projectName) || 'Example Prompt';
      el('setPreview').textContent = abbreviate(pn, v);
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
    const pn = (activeProject() && activeProject().fields.projectName) || 'Example Prompt';
    el('setPreview').textContent = abbreviate(pn, state.abbrevLen);
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
  // When no project is open, gray out the left fields panel and blank the
  // editor (the "+" tab or Open Project brings a project back).
  function applyNoProjectState(isEmpty) {
    const layout = document.querySelector('.layout');
    if (layout) layout.classList.toggle('no-project', isEmpty);
    const panel = document.querySelector('.panel-form');
    if (panel) {
      panel.querySelectorAll('input, textarea, button').forEach((elm) => {
        elm.disabled = isEmpty;
      });
    }
    if (!isEmpty) return;
    ['projectName', 'date', 'model', 'notes', 'outputBase'].forEach((id) => {
      const elm = el(id);
      if (elm) elm.value = '';
    });
    const up = el('usePrefix');
    if (up) up.checked = false;
    const cf = el('customFields');
    if (cf) cf.innerHTML = '';
    const fp = el('folderPreview');
    if (fp) fp.textContent = '';
    const st = el('sectionTabs');
    if (st) st.innerHTML = '';
    const sb = el('sectionBody');
    if (sb) sb.innerHTML = '';
    const counter = el('counter');
    if (counter) counter.textContent = '';
    hideImageToolbar();
  }

  function renderAll() {
    renderProjectTabs();
    const hasProject = !!activeProject();
    applyNoProjectState(!hasProject);
    if (hasProject) {
      renderFields();
      renderSection();
    }
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
      // Don't steal focus from the editor, so opening a panel doesn't commit
      // (and close) the paragraph currently being edited.
      btn.addEventListener('mousedown', (e) => e.preventDefault());
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
    // Insert at the caret of the focused editor — a WYSIWYG paragraph being
    // edited or the raw source editor. insertIntoEditor joins the textarea's
    // native undo stack (Ctrl+Z) and fires 'input' to sync content / counter.
    const ta = activeEditorTextarea();
    if (ta) {
      insertIntoEditor(ta, text);
      return;
    }
    // WYSIWYG mode with no paragraph open for editing: append the snippet as a
    // new block so it still lands in the current tab.
    const s = activeSection();
    if (!s) {
      toast(t('snip.noEditor'), 'error');
      return;
    }
    s.content = s.content && s.content.trim() ? s.content.replace(/\s*$/, '') + '\n\n' + text : text;
    saveState();
    renderSection();
    refreshSectionTabDirty();
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
      // Keep the editor focused (don't blur / commit the paragraph being edited)
      // so the snippet inserts at the caret instead of a stale target.
      b.addEventListener('mousedown', (e) => e.preventDefault());
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
  // Snippet manager: add / delete / reorder snippets & categories.
  // Edits are staged in a working copy (snipDraft); they are only applied to
  // SNIPPETS / snippets.json when the user clicks Save.
  // ------------------------------------------------------------------
  let snipMgrCat = null;
  let snipSaveTimer = null;
  let snipDraft = null;
  let snipDirty = false;

  function cloneSnippets(obj) {
    try {
      return JSON.parse(JSON.stringify(obj || {}));
    } catch (_e) {
      return {};
    }
  }

  function markSnipDirty() {
    snipDirty = true;
    updateSnipDirty();
  }

  function updateSnipDirty() {
    const flag = el('snipDirtyFlag');
    if (flag) flag.classList.toggle('show', snipDirty);
    const save = el('btnSnipSave');
    if (save) save.disabled = !snipDirty;
  }

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

  // Grow a manager textarea to fit its content so long snippets show in full
  // instead of a cramped 2-row box. No-op while the dialog is hidden (its
  // scrollHeight is 0 then); openSnipManager re-fits once the dialog is shown.
  function autosizeSnipText(ta) {
    if (!ta) return;
    ta.style.height = 'auto';
    if (ta.scrollHeight > 0) ta.style.height = ta.scrollHeight + 'px';
  }

  function autosizeAllSnipText() {
    const list = el('snipItemList');
    if (list) list.querySelectorAll('textarea').forEach(autosizeSnipText);
  }

  function renderSnipManager() {
    const data = snipDraft || {};
    const cats = Object.keys(data);
    if (!snipMgrCat || !data[snipMgrCat]) snipMgrCat = cats[0] || null;

    const sel = el('snipCatSelect');
    sel.innerHTML = '';
    cats.forEach((k) => {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = data[k].label || k;
      sel.appendChild(opt);
    });
    if (snipMgrCat) sel.value = snipMgrCat;
    el('snipCatLabel').value = snipMgrCat ? data[snipMgrCat].label || '' : '';

    const list = el('snipItemList');
    list.innerHTML = '';
    const items = snipMgrCat && data[snipMgrCat].items;
    if (!items || !items.length) {
      const empty = document.createElement('div');
      empty.className = 'snip-edit-empty';
      empty.textContent = t('snip.manage.empty');
      list.appendChild(empty);
      return;
    }
    items.forEach((it) => {
      const row = document.createElement('div');
      row.className = 'snip-edit-row';
      row._item = it;

      const handle = document.createElement('div');
      handle.className = 'snip-drag';
      handle.textContent = '\u2630';
      handle.title = t('snip.manage.dragReorder');
      handle.addEventListener('mousedown', () => {
        row.draggable = true;
      });
      handle.addEventListener('mouseup', () => {
        row.draggable = false;
      });

      row.addEventListener('dragstart', (e) => {
        row.classList.add('dragging');
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', () => {
        row.draggable = false;
        row.classList.remove('dragging');
        commitSnipOrder();
      });

      const labelIn = document.createElement('input');
      labelIn.type = 'text';
      labelIn.value = it.label || '';
      labelIn.placeholder = t('snip.manage.labelPh');
      labelIn.addEventListener('input', () => {
        it.label = labelIn.value;
        markSnipDirty();
      });

      const textIn = document.createElement('textarea');
      textIn.value = it.text || '';
      textIn.rows = 2;
      textIn.spellcheck = false;
      textIn.addEventListener('input', () => {
        it.text = textIn.value;
        autosizeSnipText(textIn);
        markSnipDirty();
      });
      autosizeSnipText(textIn);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn-remove';
      del.textContent = '\u00d7';
      del.title = t('snip.manage.delItem');
      del.addEventListener('click', () => {
        const arr = data[snipMgrCat].items;
        const idx = arr.indexOf(it);
        if (idx >= 0) arr.splice(idx, 1);
        markSnipDirty();
        renderSnipManager();
      });

      row.appendChild(handle);
      row.appendChild(labelIn);
      row.appendChild(textIn);
      row.appendChild(del);
      list.appendChild(row);
    });
    autosizeAllSnipText();
  }

  function openSnipManager() {
    snipDraft = cloneSnippets(SNIPPETS);
    snipDirty = false;
    snipMgrCat = Object.keys(snipDraft)[0] || null;
    renderSnipManager();
    updateSnipDirty();
    el('snipNewCat').value = '';
    el('snipNewLabel').value = '';
    el('snipNewText').value = '';
    const dialog = el('snipManagerModal').querySelector('.modal');
    if (dialog) {
      // Re-center each open (keep any resized dimensions).
      dialog.style.position = '';
      dialog.style.left = '';
      dialog.style.top = '';
      dialog.style.margin = '';
    }
    applySnipMgrFont();
    el('snipManagerModal').classList.remove('hidden');
    autosizeAllSnipText();
  }

  // Open the editable snippets.json in the OS default editor for hand-editing.
  async function openSnippetsFile() {
    if (!api.openSnippetsFile) return;
    try {
      const res = await api.openSnippetsFile();
      if (res && res.ok === false) toast(t('snip.manage.openFileErr'), 'error');
    } catch (_e) {
      toast(t('snip.manage.openFileErr'), 'error');
    }
  }

  // Close the manager, optionally discarding staged (unsaved) edits.
  function closeSnipManager(force) {
    if (!force && snipDirty && !window.confirm(t('snip.manage.discardConfirm'))) return;
    snipDraft = null;
    snipDirty = false;
    updateSnipDirty();
    el('snipManagerModal').classList.add('hidden');
  }

  // Apply the staged draft to the live snippets and persist. The manager stays
  // open afterwards (Save no longer closes it) — the dialog only closes via the
  // Cancel/Close button, the X, or Esc.
  function saveSnipManager() {
    if (!snipDraft) return;
    SNIPPETS = cloneSnippets(snipDraft);
    persistSnippets(true);
    snipDirty = false;
    updateSnipDirty();
    toast(t('snip.manage.saved'), 'success');
  }

  // After a drag-and-drop, rebuild the active category's item order from the
  // DOM order, then re-render to refresh row handlers.
  function commitSnipOrder() {
    if (!snipDraft || !snipMgrCat || !snipDraft[snipMgrCat]) return;
    const list = el('snipItemList');
    const rows = Array.prototype.slice.call(list.querySelectorAll('.snip-edit-row'));
    const newItems = rows.map((r) => r._item).filter(Boolean);
    const old = snipDraft[snipMgrCat].items;
    if (newItems.length === old.length) {
      const changed = newItems.some((x, idx) => x !== old[idx]);
      snipDraft[snipMgrCat].items = newItems;
      if (changed) markSnipDirty();
    }
    renderSnipManager();
  }

  // Find the row a dragged item should be inserted before, from the pointer Y.
  function getSnipDragAfter(container, y) {
    const els = Array.prototype.slice.call(
      container.querySelectorAll('.snip-edit-row:not(.dragging)')
    );
    let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
    els.forEach((child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        closest = { offset, element: child };
      }
    });
    return closest.element;
  }

  // Make a modal dialog draggable by a handle (e.g. its header).
  function makeModalDraggable(dialog, handle) {
    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest && e.target.closest('.modal-head-tools')) return;
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
    el('btnSnipManagerClose').addEventListener('click', () => closeSnipManager(false));
    el('btnSnipCancel').addEventListener('click', () => closeSnipManager(false));
    el('btnSnipSave').addEventListener('click', saveSnipManager);
    el('btnSnipOpenFile').addEventListener('click', openSnippetsFile);
    el('btnSnipFontDown').addEventListener('click', () => bumpSnipMgrFont(-1));
    el('btnSnipFontUp').addEventListener('click', () => bumpSnipMgrFont(1));
    el('btnSnipFontReset').addEventListener('click', () => setSnipMgrFont(SNIP_FONT_DEFAULT));
    applySnipMgrFont();

    // While the manager is open, Esc closes it and Ctrl/Cmd+S saves (mirroring
    // the Save button, including its disabled-when-unchanged state). Registered
    // before the palette Esc handler and stops propagation so the shortcuts act
    // only on the dialog, not any floating panel behind the overlay.
    document.addEventListener('keydown', (e) => {
      if (modal.classList.contains('hidden')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeSnipManager(false);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const save = el('btnSnipSave');
        if (save && !save.disabled) saveSnipManager();
      }
    });

    const dialog = modal.querySelector('.modal');
    const head = dialog && dialog.querySelector('.modal-head');
    if (dialog && head) makeModalDraggable(dialog, head);

    // Live-reorder rows while dragging one by its handle.
    const listEl = el('snipItemList');
    listEl.addEventListener('dragover', (e) => {
      const dragging = listEl.querySelector('.snip-edit-row.dragging');
      if (!dragging) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      const after = getSnipDragAfter(listEl, e.clientY);
      if (after == null) listEl.appendChild(dragging);
      else if (after !== dragging) listEl.insertBefore(dragging, after);
    });
    listEl.addEventListener('drop', (e) => e.preventDefault());

    el('snipCatSelect').addEventListener('change', () => {
      snipMgrCat = el('snipCatSelect').value;
      renderSnipManager();
    });

    el('snipCatLabel').addEventListener('input', () => {
      if (snipDraft && snipMgrCat && snipDraft[snipMgrCat]) {
        snipDraft[snipMgrCat].label = el('snipCatLabel').value;
        const opt = el('snipCatSelect').querySelector('option[value="' + snipMgrCat + '"]');
        if (opt) opt.textContent = el('snipCatLabel').value || snipMgrCat;
        markSnipDirty();
      }
    });

    el('btnSnipAddCat').addEventListener('click', () => {
      if (!snipDraft) return;
      const name = el('snipNewCat').value.trim();
      if (!name) return;
      const key = 'cat_' + Date.now().toString(36);
      snipDraft[key] = { label: name, items: [] };
      el('snipNewCat').value = '';
      snipMgrCat = key;
      markSnipDirty();
      renderSnipManager();
    });

    el('btnSnipDelCat').addEventListener('click', () => {
      if (!snipDraft || !snipMgrCat) return;
      if (!window.confirm(t('snip.manage.delCatConfirm'))) return;
      delete snipDraft[snipMgrCat];
      snipMgrCat = Object.keys(snipDraft)[0] || null;
      markSnipDirty();
      renderSnipManager();
    });

    el('btnSnipAddItem').addEventListener('click', () => {
      if (!snipDraft || !snipMgrCat) {
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
      snipDraft[snipMgrCat].items.push({ label, text });
      el('snipNewLabel').value = '';
      el('snipNewText').value = '';
      markSnipDirty();
      renderSnipManager();
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

    // Prevent the window from navigating to a file when one is dropped outside
    // an editor drop target (the editors handle their own image drops).
    window.addEventListener('dragover', (e) => {
      if (dragHasFiles(e)) e.preventDefault();
    });
    window.addEventListener('drop', (e) => {
      if (dragHasFiles(e)) e.preventDefault();
    });

    await loadLang(state.lang || 'zh');

    // Explorer right-click hand-off: open the folder passed on launch, and keep
    // listening for folders sent by later launches while this window is open.
    if (typeof api.onOpenProjectFolder === 'function') {
      api.onOpenProjectFolder((dir) => openProjectByPath(dir));
    }
    try {
      const cliFolder = typeof api.getInitialFolder === 'function' ? await api.getInitialFolder() : null;
      if (cliFolder) await openProjectByPath(cliFolder);
    } catch (_e) {
      /* no initial folder - normal launch */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
