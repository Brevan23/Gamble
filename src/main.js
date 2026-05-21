// src/main.js
'use strict';

const {
  app, BrowserWindow, Tray, Menu,
  globalShortcut, ipcMain, screen, nativeImage,
} = require('electron');
const path    = require('path');
const Counter  = require('./counter');
const settings = require('./settings');

// ── State ─────────────────────────────────────────────────────────────────
const counter   = new Counter(settings.get('totalDecks'));
let win         = null;
let tray        = null;
let isExpanded  = false;

const COLLAPSED = { width: 90,  height: 90  };
const EXPANDED  = { width: 220, height: 300 };

// ── Helpers ───────────────────────────────────────────────────────────────
function getDefaultPosition(size) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return { x: width - size.width - 20, y: height - size.height - 20 };
}

function broadcastState() {
  if (win && !win.isDestroyed()) {
    win.webContents.send('counter:stateUpdate', counter.getState());
  }
}

function setExpanded(expanded) {
  if (!win || win.isDestroyed()) return;
  isExpanded = expanded;
  const size = expanded ? EXPANDED : COLLAPSED;

  // Resize from the bottom-right corner by adjusting x/y accordingly
  const [cx, cy] = win.getPosition();
  const [cw, ch] = win.getSize();
  const nx = cx + cw  - size.width;
  const ny = cy + ch  - size.height;

  win.setBounds({ x: nx, y: ny, width: size.width, height: size.height }, true);
  win.webContents.send('window:expandChange', expanded);

  if (expanded) win.focus();
}

// ── Window ────────────────────────────────────────────────────────────────
function createWindow() {
  const savedPos = settings.get('position');
  const size     = COLLAPSED;
  const pos      = savedPos || getDefaultPosition(size);

  win = new BrowserWindow({
    width:       size.width,
    height:      size.height,
    x:           pos.x,
    y:           pos.y,
    frame:       false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable:   false,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.on('moved', () => {
    const [x, y] = win.getPosition();
    settings.set('position', { x, y });
  });
}

// ── Tray ──────────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  const icon     = nativeImage.createFromPath(iconPath);
  tray           = new Tray(icon);

  tray.setToolTip('Card Counter');

  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: 'Show / Hide',
      click: () => win.isVisible() ? win.hide() : win.show(),
    },
    {
      label: 'Reset Shoe',
      click: () => {
        counter.reset();
        broadcastState();
        if (win && !win.isDestroyed()) win.webContents.send('counter:reset');
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));

  tray.on('click', () => win.isVisible() ? win.hide() : win.show());
}

// ── Global shortcut ───────────────────────────────────────────────────────
function registerShortcuts() {
  // Ctrl+Shift+Space = toggle expand/collapse (only global shortcut)
  const registered = globalShortcut.register('Ctrl+Shift+Space', () => {
    if (!win.isVisible()) { win.show(); setExpanded(true); }
    else setExpanded(!isExpanded);
  });

  if (!registered) {
    console.error('Warning: Ctrl+Shift+Space shortcut could not be registered');
  }
}

// ── IPC handlers ──────────────────────────────────────────────────────────
ipcMain.handle('counter:logCard',  (_, key) => { counter.logCard(key); broadcastState(); return counter.getState(); });
ipcMain.handle('counter:reset', () => {
  counter.reset();
  broadcastState();
  if (win && !win.isDestroyed()) win.webContents.send('counter:reset');
  return counter.getState();
});
ipcMain.handle('counter:getState', ()       => counter.getState());
ipcMain.handle('counter:setDecks', (_, n)   => { counter.setDecks(n);  broadcastState(); return counter.getState(); });

ipcMain.handle('settings:getAll',  ()            => settings.getAll());
ipcMain.handle('settings:set',     (_, key, val) => { settings.set(key, val); return true; });

ipcMain.handle('window:toggleExpand', () => {
  setExpanded(!isExpanded);
  return isExpanded;
});

// ── App lifecycle ─────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();
  registerShortcuts();
});

app.on('will-quit',         () => globalShortcut.unregisterAll());
app.on('window-all-closed', (e) => e.preventDefault()); // keep alive in tray
