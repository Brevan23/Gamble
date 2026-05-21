// src/capture/region-selector.js
'use strict';

const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');

/**
 * Open a fullscreen transparent overlay for the user to draw a capture region.
 *
 * @returns {Promise<{x,y,width,height}|null>}
 *   Resolves with region object, or null if the user cancelled.
 */
function openRegionSelector() {
  return new Promise((resolve) => {
    const selectorWin = new BrowserWindow({
      fullscreen:  true,
      frame:       false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: {
        preload:          path.join(__dirname, 'selector-preload.js'),
        contextIsolation: true,
        nodeIntegration:  false,
      },
    });

    selectorWin.loadFile(path.join(__dirname, 'region-selector.html'));

    let resolved = false;

    function finish(region) {
      if (resolved) return;
      resolved = true;
      ipcMain.removeListener('capture:regionSelected', onRegion);
      if (!selectorWin.isDestroyed()) selectorWin.close();
      resolve(region);
    }

    function onRegion(_, region) { finish(region); }

    ipcMain.on('capture:regionSelected', onRegion);
    selectorWin.on('closed', () => finish(null));
  });
}

module.exports = { openRegionSelector };
