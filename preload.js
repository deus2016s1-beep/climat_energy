// preload.js — безопасный мост между Electron и страницей
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  savePDF: () => ipcRenderer.invoke('save-pdf'),
  onPDFSaved: (callback) => ipcRenderer.on('pdf-saved', (_event, result) => callback(result)),
})
