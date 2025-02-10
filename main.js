const path = require('node:path')
const url = require('node:url')
const { BrowserWindow, app } = require('electron')

let window = null

function createWindow() {
  window = new BrowserWindow({
    height: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: true,
      preload: path.join(__dirname, './preload.js')
    },
    width: 900
  })
  window.webContents.openDevTools()

  const startUrl = url.format({
    pathname: path.join(__dirname, './index.html'),
    protocol: 'file:',
    slashes: true
  })
  window.loadURL(startUrl)

  window.on('closed', () => {
    window = null
  })
}

app.on('activate', () => {
  if (window === null) {
    createWindow()
  }
})

app.on('ready', () => {
  createWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})
