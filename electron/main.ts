import { app, BrowserWindow, ipcMain } from "electron"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 680,
    frame: false,
    titleBarStyle: "hidden",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const devServerArgPrefix = "--dev-server-url="
  const devServerArg = process.argv.find((arg) =>
    arg.startsWith(devServerArgPrefix),
  )
  const devServerUrl = devServerArg?.slice(devServerArgPrefix.length)

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl)
    mainWindow.webContents.openDevTools({ mode: "detach" })
    return
  }

  void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"))
}

function registerWindowControls() {
  ipcMain.handle("window:minimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.handle("window:toggleMaximize", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false

    if (win.isMaximized()) {
      win.unmaximize()
      return false
    }

    win.maximize()
    return true
  })

  ipcMain.handle("window:close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle("window:isMaximized", (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  })
}

app.whenReady().then(() => {
  registerWindowControls()
  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
