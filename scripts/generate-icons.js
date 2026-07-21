// ============================================================
// generate-icons.js
//
// Produces the app icon assets from the in-app M2 logo so the
// installer, the installed .exe, and the Start-menu / desktop
// shortcuts all show the real logo (electron-builder auto-detects
// build/icon.ico; Electron's window uses src/assets/icon.png).
//
//   build/icon.ico     - multi-resolution Windows icon (16..256)
//   src/assets/icon.png - 256x256 PNG (referenced by main.js)
//
// The logo path is read straight from src/renderer/js/app.js
// (M2_LOGO_PATH) so there is a single source of truth. Rendering
// reuses the same SVG -> canvas -> PNG technique the app uses at
// runtime in setAppIcon(), so no extra native tooling is required.
//
//   Run:  npm run icons     (i.e. `electron scripts/generate-icons.js`)
// ============================================================
'use strict';

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP_JS = path.join(ROOT, 'src', 'renderer', 'js', 'app.js');
const OUT_ICO = path.join(ROOT, 'build', 'icon.ico');
const OUT_PNG = path.join(ROOT, 'src', 'assets', 'icon.png');

// Icon sizes packed into the .ico (Windows picks the best per context).
const SIZES = [16, 24, 32, 48, 64, 128, 256];
const LOGO_FILL = '#b26bff';

// Pull the raw SVG path data out of the renderer source.
function readLogoPath() {
  const src = fs.readFileSync(APP_JS, 'utf8');
  const m = src.match(/const\s+M2_LOGO_PATH\s*=\s*'([^']+)'/);
  if (!m) throw new Error('M2_LOGO_PATH not found in ' + APP_JS);
  return m[1];
}

// Rasterize the logo at one size inside the renderer and return PNG bytes.
async function renderPng(win, size, logoPath) {
  const dataUrl = await win.webContents.executeJavaScript(
    `(() => new Promise((resolve, reject) => {
      const size = ${size};
      const svg =
        "<svg xmlns='http://www.w3.org/2000/svg' width='" + size + "' height='" + size +
        "' viewBox='0 0 1024 1024' fill='${LOGO_FILL}'>" +
        "<path fill-rule='evenodd' d='" + ${JSON.stringify(logoPath)} + "'/></svg>";
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = size; c.height = size;
          const ctx = c.getContext('2d');
          ctx.clearRect(0, 0, size, size);
          ctx.drawImage(img, 0, 0, size, size);
          resolve(c.toDataURL('image/png'));
        } catch (e) { reject(e); }
      };
      img.onerror = () => reject(new Error('svg decode failed'));
      img.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
    }))()`,
    true
  );
  return Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
}

// Pack PNG buffers into a Windows .ico (PNG-compressed entries, Vista+).
function buildIco(entries) {
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const dir = [];
  let offset = 6 + count * 16;
  for (const { size, buffer } of entries) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width  (0 == 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height (0 == 256)
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(buffer.length, 8); // image byte size
    e.writeUInt32LE(offset, 12); // image byte offset
    dir.push(e);
    offset += buffer.length;
  }
  return Buffer.concat([header, ...dir, ...entries.map((x) => x.buffer)]);
}

async function main() {
  const logoPath = readLogoPath();

  const win = new BrowserWindow({
    show: false,
    width: 320,
    height: 320,
    webPreferences: { offscreen: true },
  });
  await win.loadURL('data:text/html,<!doctype html><html><body></body></html>');

  const entries = [];
  for (const size of SIZES) {
    entries.push({ size, buffer: await renderPng(win, size, logoPath) });
  }
  win.destroy();

  fs.mkdirSync(path.dirname(OUT_ICO), { recursive: true });
  fs.mkdirSync(path.dirname(OUT_PNG), { recursive: true });

  const png256 = entries.find((e) => e.size === 256).buffer;
  fs.writeFileSync(OUT_PNG, png256);
  fs.writeFileSync(OUT_ICO, buildIco(entries));

  console.log('Wrote ' + path.relative(ROOT, OUT_PNG) + ' (' + png256.length + ' bytes)');
  console.log(
    'Wrote ' + path.relative(ROOT, OUT_ICO) + ' with sizes ' + SIZES.join(', ')
  );
}

app.whenReady()
  .then(main)
  .then(() => app.quit())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
