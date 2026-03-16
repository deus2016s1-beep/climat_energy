const { app, BrowserWindow, Menu, shell, dialog } = require('electron')
const path = require('path')

// Disable hardware acceleration issues on some systems
app.commandLine.appendSwitch('disable-gpu-sandbox')

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'КП — Climat Energy',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0d1b34',
    show: false, // show after ready-to-show
  })

  win.loadFile('index.html')

  win.once('ready-to-show', () => {
    win.show()
  })

  // Меню приложения
  const menu = Menu.buildFromTemplate([
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Печать / Сохранить PDF',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            const focused = BrowserWindow.getFocusedWindow()
            if (focused) {
              focused.webContents.executeJavaScript('window.print()')
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Выход',
          accelerator: 'Alt+F4',
          role: 'quit'
        }
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
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'О программе',
              message: 'КП — Генератор коммерческих предложений',
              detail: 'Версия 2.0\n© 2025 Climat Energy\n\nПрограмма для создания и печати коммерческих предложений.',
              buttons: ['OK']
            })
          }
        }
      ]
    }
  ])
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
