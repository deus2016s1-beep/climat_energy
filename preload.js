// preload.js — безопасный мост между Electron и страницей
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  // PDF
  savePDF: () => ipcRenderer.invoke('save-pdf'),
  // Сохранение / загрузка КП
  saveKP: (data) => ipcRenderer.invoke('save-kp', data),
  loadKP: () => ipcRenderer.invoke('load-kp'),
  // Автонумерация
  getNextKpNum: () => ipcRenderer.invoke('get-next-kp-num'),
  getCurrentKpNum: () => ipcRenderer.invoke('get-current-kp-num'),
  // История
  getRecentFiles: () => ipcRenderer.invoke('get-recent-files'),
  addRecentFile: (filePath) => ipcRenderer.invoke('add-recent-file', filePath),
  openRecentFile: (filePath) => ipcRenderer.invoke('open-recent-file', filePath),
})
