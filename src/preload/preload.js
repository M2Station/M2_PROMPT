/*
 * M2_PROMPT
 * Copyright (c) 2026 OA Hsiao
 * SPDX-License-Identifier: MIT
 *
 * This source code is licensed under the MIT License found in the
 * LICENSE file in the root directory of this source tree.
 */
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Minimal, explicit API exposed to the renderer. No Node access leaks.
contextBridge.exposeInMainWorld('m2prompt', {
  appVersion: () => ipcRenderer.invoke('app:version'),
  setStartupBg: (color) => ipcRenderer.invoke('app:setStartupBg', color),
  exportPrompt: (payload) => ipcRenderer.invoke('prompt:export', payload),
  exportSinglePrompt: (payload) => ipcRenderer.invoke('prompt:exportSingle', payload),
  openFolder: (targetPath) => ipcRenderer.invoke('prompt:openFolder', targetPath),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  pickFolder: (defaultPath) => ipcRenderer.invoke('dialog:pickFolder', defaultPath),
  loadI18n: (lang) => ipcRenderer.invoke('i18n:load', lang),
});
