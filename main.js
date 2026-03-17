const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

// ─── App data helpers ────────────────────────────────────────────────────────
function getConfigPath() {
  return path.join(app.getPath('userData'), 'climat-config.json')
}

function readConfig() {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf8')
    return JSON.parse(raw)
  } catch { return {} }
}

function writeConfig(data) {
  const dir = path.dirname(getConfigPath())
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(getConfigPath(), JSON.stringify(data, null, 2), 'utf8')
}

app.commandLine.appendSwitch('disable-gpu-sandbox')

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    title: 'КП — Climat Energy',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0d1b34',
    show: false,
  })

  mainWindow.loadFile('index.html')
  mainWindow.once('ready-to-show', () => mainWindow.show())

  // ─── Меню приложения ─────────────────────────────────────────────────────
  const menu = Menu.buildFromTemplate([
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Новое КП',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.executeJavaScript('newKP()')
        },
        { type: 'separator' },
        {
          label: 'Сохранить PDF',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow?.webContents.executeJavaScript('savePDF()')
        },
        { type: 'separator' },
        {
          label: 'Сохранить КП…',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.executeJavaScript('saveKPFile()')
        },
        {
          label: 'Открыть КП…',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.executeJavaScript('loadKPFile()')
        },
        { type: 'separator' },
        { label: 'Выход', accelerator: 'Alt+F4', role: 'quit' }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload', label: 'Обновить' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Сбросить масштаб' },
        { role: 'zoomIn', label: 'Увеличить', accelerator: 'CmdOrCtrl+=' },
        { role: 'zoomOut', label: 'Уменьшить' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Полноэкранный режим' }
      ]
    },
    {
      label: 'Справка',
      submenu: [
        {
          label: 'О программе',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'О программе',
            message: 'КП — Генератор коммерческих предложений',
            detail: 'Версия 2.3\n© 2025 Climat Energy\n\nПрограмма для создания, сохранения и экспорта КП в PDF.\nАвтонумерация · История КП · Быстрый доступ',
            buttons: ['OK']
          })
        }
      ]
    }
  ])
  Menu.setApplicationMenu(menu)
}

// ─── IPC: Сохранение PDF ──────────────────────────────────────────────────
ipcMain.handle('save-pdf', async () => {
  const win = mainWindow
  if (!win) return { ok: false, error: 'Нет активного окна' }

  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: 'Сохранить коммерческое предложение',
    defaultPath: `КП_Climat_Energy_${new Date().toISOString().slice(0, 10)}.pdf`,
    filters: [{ name: 'PDF файлы', extensions: ['pdf'] }],
  })

  if (canceled || !filePath) return { ok: false, canceled: true }

  try {
    const data = await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      landscape: false,
      marginsType: 0, // Respect CSS @page margins
    })
    fs.writeFileSync(filePath, data)
    shell.showItemInFolder(filePath)
    return { ok: true, path: filePath }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// ─── IPC: Сохранение состояния КП ────────────────────────────────────────
ipcMain.handle('save-kp', async (_event, data) => {
  const win = mainWindow
  if (!win) return { ok: false }

  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: 'Сохранить проект КП',
    defaultPath: `КП_${data.kpNum || 'проект'}_${new Date().toISOString().slice(0, 10)}.kp.json`,
    filters: [
      { name: 'Проект КП (*.kp.json)', extensions: ['json'] },
      { name: 'Все файлы', extensions: ['*'] },
    ],
  })

  if (canceled || !filePath) return { ok: false, canceled: true }

  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
    return { ok: true, path: filePath }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

// ─── IPC: Загрузка состояния КП ───────────────────────────────────────────
ipcMain.handle('load-kp', async () => {
  const win = mainWindow
  if (!win) return { ok: false }

  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title: 'Открыть проект КП',
    filters: [
      { name: 'Проект КП (*.kp.json)', extensions: ['json'] },
      { name: 'Все файлы', extensions: ['*'] },
    ],
    properties: ['openFile'],
  })

  if (canceled || !filePaths?.length) return { ok: false, canceled: true }

  try {
    const raw = fs.readFileSync(filePaths[0], 'utf8')
    const data = JSON.parse(raw)
    return { ok: true, data, path: filePaths[0] }
  } catch (err) {
    return { ok: false, error: 'Не удалось прочитать файл: ' + err.message }
  }
})

// ─── IPC: Автонумерация КП ────────────────────────────────────────────────
ipcMain.handle('get-next-kp-num', () => {
  const config = readConfig()
  const year = new Date().getFullYear()
  let lastNum = config.lastKpNum || 0
  let lastYear = config.lastKpYear || year

  if (lastYear !== year) {
    lastNum = 0
    lastYear = year
  }

  lastNum++
  config.lastKpNum = lastNum
  config.lastKpYear = lastYear
  writeConfig(config)

  const num = String(lastNum).padStart(3, '0')
  return `${num} / ${lastYear}`
})

ipcMain.handle('get-current-kp-num', () => {
  const config = readConfig()
  const year = new Date().getFullYear()
  const num = String(config.lastKpNum || 0).padStart(3, '0')
  return `${num} / ${config.lastKpYear || year}`
})

// ─── IPC: История последних КП ───────────────────────────────────────────
ipcMain.handle('get-recent-files', () => {
  const config = readConfig()
  return config.recentFiles || []
})

ipcMain.handle('add-recent-file', (_event, filePath) => {
  const config = readConfig()
  let recent = config.recentFiles || []

  // Remove duplicate if exists
  recent = recent.filter(f => f.path !== filePath)

  // Add to the beginning
  recent.unshift({
    path: filePath,
    name: path.basename(filePath),
    date: new Date().toISOString(),
  })

  // Keep only last 10
  recent = recent.slice(0, 10)

  config.recentFiles = recent
  writeConfig(config)
  return recent
})

ipcMain.handle('open-recent-file', async (_event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      // Remove from recent if file doesn't exist
      const config = readConfig()
      config.recentFiles = (config.recentFiles || []).filter(f => f.path !== filePath)
      writeConfig(config)
      return { ok: false, error: 'Файл не найден: ' + filePath }
    }
    const raw = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(raw)
    return { ok: true, data, path: filePath }
  } catch (err) {
    return { ok: false, error: 'Не удалось прочитать файл: ' + err.message }
  }
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => app.quit())
