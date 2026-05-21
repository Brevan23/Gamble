// src/capture/selector-preload.js
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('selector', {
  sendRegion: (region) => ipcRenderer.send('capture:regionSelected', region),
});
