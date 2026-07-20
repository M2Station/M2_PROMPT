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
  setAppIcon: (dataUrl) => ipcRenderer.invoke('app:setIcon', dataUrl),
  exportPrompt: (payload) => ipcRenderer.invoke('prompt:export', payload),
  exportSinglePrompt: (payload) => ipcRenderer.invoke('prompt:exportSingle', payload),
  openFolder: (targetPath) => ipcRenderer.invoke('prompt:openFolder', targetPath),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  pickFolder: (defaultPath) => ipcRenderer.invoke('dialog:pickFolder', defaultPath),
  openProject: () => ipcRenderer.invoke('project:open'),
  openProjectPath: (dirPath) => ipcRenderer.invoke('project:openPath', dirPath),
  getInitialFolder: () => ipcRenderer.invoke('app:getInitialFolder'),
  onOpenProjectFolder: (cb) => {
    if (typeof cb !== 'function') return;
    ipcRenderer.on('app:openProjectFolder', (_e, dir) => cb(dir));
  },
  saveProject: (payload) => ipcRenderer.invoke('project:save', payload),
  loadSnippets: () => ipcRenderer.invoke('snippets:load'),
  saveSnippets: (data) => ipcRenderer.invoke('snippets:save', data),
  openSnippetsFile: () => ipcRenderer.invoke('snippets:openFile'),
  saveImage: (payload) => ipcRenderer.invoke('image:save', payload),
  readImageDataUrl: (payload) => ipcRenderer.invoke('image:readDataUrl', payload),
  copyImageToClipboard: (payload) => ipcRenderer.invoke('image:copyToClipboard', payload),
  deleteImage: (payload) => ipcRenderer.invoke('image:delete', payload),
  restoreImage: (payload) => ipcRenderer.invoke('image:restore', payload),
  loadI18n: (lang) => ipcRenderer.invoke('i18n:load', lang),
});
