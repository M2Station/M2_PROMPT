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
const { app, BrowserWindow, Menu } = require('electron');
const { registerIpc } = require('./ipc');

let mainWindow = null;

// Folder passed on the command line (e.g. from the Explorer right-click menu
// -> "M2_PROMPT.exe" "%1"). Captured at startup so the renderer can pull it once
// it has finished booting, and re-sent to the live window on a second launch.
let initialFolder = null;

// Pick the first CLI argument that is an existing directory. In development the
// first two argv entries are electron.exe + the app path ('.'), so skip them;
// a packaged build only has the exe in front. Validating isDirectory() keeps
// flags and the exe path itself from being mistaken for a folder.
function folderArgFrom(argv) {
  const args = (argv || []).slice(app.isPackaged ? 1 : 2);
  for (const a of args) {
    try {
      if (a && fs.existsSync(a) && fs.statSync(a).isDirectory()) return a;
    } catch (_e) {
      /* not a readable path - ignore */
    }
  }
  return null;
}

// Background color shown the instant the window appears (before the renderer
// paints). Cached from the user's last theme so dark-theme users don't get a
// white flash. Falls back to the default "Daylight" light background.
function startupBackground() {
  try {
    const p = path.join(app.getPath('userData'), 'startup.json');
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (j && typeof j.bg === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(j.bg)) return j.bg;
  } catch (e) {
    /* no cache yet - use default */
  }
  return '#f4f4f4';
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: true,
    autoHideMenuBar: true,
    backgroundColor: startupBackground(),
    title: 'M2 PROMPT v' + app.getVersion(),
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// A minimal, hidden application menu whose roles register the standard editing
// accelerators (Ctrl+Z / Ctrl+Y undo-redo, cut / copy / paste, select-all) so
// they work inside text fields. Without any menu these shortcuts are dead.
function applyEditMenu() {
  const template = [
    {
      label: '&Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Single-instance: if M2_PROMPT is already running, hand the right-clicked
// folder to the existing window instead of spawning a duplicate (which would
// otherwise fight over the same settings / localStorage).
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  initialFolder = folderArgFrom(process.argv);

  app.on('second-instance', (_e, argv) => {
    const folder = folderArgFrom(argv);
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    if (folder && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('app:openProjectFolder', folder);
    }
  });

  app.whenReady().then(() => {
    if (process.platform === 'win32') app.setAppUserModelId('com.m2station.m2prompt');
    applyEditMenu();
    registerIpc({ getInitialFolder: () => initialFolder });
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
