// preload.js — безопасный мост между Electron и страницей
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  // PDF
  savePDF: () => ipcRenderer.invoke('save-pdf'),
  // Сохранение / загрузка КП
  saveKP: (data) => ipcRenderer.invoke('save-kp', data),
  loadKP: () => ipcRenderer.invoke('load-kp'),
})
