// preload.js — безопасный мост между Electron и страницей
// contextBridge используется для передачи только разрешённых API
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform
})
