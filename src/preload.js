// src/preload.js
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Counter
  logCard:        (key) => ipcRenderer.invoke('counter:logCard', key),
  reset:          ()    => ipcRenderer.invoke('counter:reset'),
  getState:       ()    => ipcRenderer.invoke('counter:getState'),
  setDecks:       (n)   => ipcRenderer.invoke('counter:setDecks', n),

  // Settings
  getSettings:    ()           => ipcRenderer.invoke('settings:getAll'),
  setSetting:     (key, value) => ipcRenderer.invoke('settings:set', key, value),

  // Window
  toggleExpand:   ()    => ipcRenderer.invoke('window:toggleExpand'),

  // Subscriptions (main → renderer pushes)
  onStateUpdate:  (cb)  => ipcRenderer.on('counter:stateUpdate',  (_, s)  => cb(s)),
  onExpandChange: (cb)  => ipcRenderer.on('window:expandChange',  (_, ex) => cb(ex)),
  onReset:        (cb)  => ipcRenderer.on('counter:reset',        ()      => cb()),

  // Capture
  openCaptureSelector: () => ipcRenderer.invoke('capture:openSelector'),
  startCapture:        () => ipcRenderer.invoke('capture:start'),
  stopCapture:         () => ipcRenderer.invoke('capture:stop'),
  onCaptureStatus:     (cb) => ipcRenderer.on('capture:status', (_, s) => cb(s)),
});
