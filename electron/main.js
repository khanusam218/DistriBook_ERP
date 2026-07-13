const { app, BrowserWindow, dialog, shell, Menu } = require('electron')
const path = require('path')
const http = require('http')
const net = require('net')
const fs = require('fs')
const crypto = require('crypto')

// ── Environment ───────────────────────────────────────────────────────────────
process.env.PORT = '5002'
process.env.NODE_ENV = 'production'

// Databases go to writable userData folder
const userDataPath = app.getPath('userData')
process.env.DB_DIR = userDataPath

// JWT secret: generated once per install and persisted in userData, instead of a
// fixed string baked into the app (which would be identical — and readable — across
// every client's install).
function getOrCreateJwtSecret() {
  const secretPath = path.join(userDataPath, '.jwt-secret')
  try {
    if (fs.existsSync(secretPath)) return fs.readFileSync(secretPath, 'utf8').trim()
  } catch {}
  const secret = crypto.randomBytes(48).toString('hex')
  if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true })
  fs.writeFileSync(secretPath, secret, { mode: 0o600 })
  return secret
}
process.env.JWT_SECRET = getOrCreateJwtSecret()

// ── Copy initial databases to userData on first run ───────────────────────────
function initDatabases() {
  if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true })

  const srcDir = app.isPackaged
    ? path.join(process.resourcesPath, 'databases')
    : path.join(__dirname, '..')

  if (!fs.existsSync(srcDir)) return

  const dbFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.db'))
  for (const dbFile of dbFiles) {
    const dest = path.join(userDataPath, dbFile)
    if (!fs.existsSync(dest)) {
      try { fs.copyFileSync(path.join(srcDir, dbFile), dest) } catch (e) { console.error('DB copy error:', e) }
    }
  }
}

// ── Check if port is already in use ──────────────────────────────────────────
function isPortInUse(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
    tester.once('error', () => resolve(true))
    tester.once('listening', () => { tester.close(); resolve(false) })
    tester.listen(port, '127.0.0.1')
  })
}

// ── Windows ───────────────────────────────────────────────────────────────────
let mainWindow = null
let splashWindow = null

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 280,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    webPreferences: { nodeIntegration: false }
  })
  splashWindow.loadFile(path.join(__dirname, 'splash.html'))
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    show: false,
    title: 'Thok Software ERP',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  })

  Menu.setApplicationMenu(null)
  mainWindow.loadURL('http://localhost:5002')
  mainWindow.maximize()

  // Print/export previews across the app use window.open() to build a new document
  // and call .print() on it. Electron denies window.open() by default (since v14),
  // so without this handler every "Print" button silently does nothing.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'allow' }))

  // Hard refresh shortcuts — Ctrl+Shift+R or F5 reload the app bypassing cache
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isCtrlShiftR = input.control && input.shift && input.key.toLowerCase() === 'r'
    const isF5 = input.key === 'F5'
    if (input.type === 'keyDown' && (isCtrlShiftR || isF5)) {
      mainWindow.webContents.reloadIgnoringCache()
    }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy()
      splashWindow = null
    }
    mainWindow.show()
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

function waitForBackend(callback, attempts = 0) {
  const maxAttempts = 40
  http.get('http://localhost:5002/api/health', res => {
    if (res.statusCode === 200) return callback()
    if (attempts < maxAttempts) setTimeout(() => waitForBackend(callback, attempts + 1), 500)
    else dialog.showErrorBox('Startup Error', 'Server did not start in time. Please restart the app.')
  }).on('error', () => {
    if (attempts < maxAttempts) setTimeout(() => waitForBackend(callback, attempts + 1), 500)
    else dialog.showErrorBox('Startup Error', 'Could not connect to the server. Please restart the app.')
  })
}

// ── Safety net: suppress any EADDRINUSE that escapes server.js ────────────────
process.on('uncaughtException', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('Port already in use — skipping server start.')
  } else {
    throw err
  }
})

// ── App Lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  try { initDatabases() } catch (e) { console.error('Database init failed:', e) }

  createSplash()

  // Only start the backend if port 5002 is free
  const portBusy = await isPortInUse(5002)
  if (!portBusy) {
    try {
      require('../backend/src/server.js')
    } catch (e) {
      if (e.code !== 'EADDRINUSE') {
        dialog.showErrorBox('Backend Error', `Failed to start server: ${e.message}`)
        app.quit()
        return
      }
    }
  } else {
    console.log('Port 5002 already in use — connecting to existing server.')
  }

  waitForBackend(() => createMainWindow())
})

app.on('window-all-closed', () => app.quit())
app.on('activate', () => { if (!mainWindow) createMainWindow() })
