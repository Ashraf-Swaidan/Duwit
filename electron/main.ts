import { app, BrowserWindow, ipcMain, nativeImage } from "electron"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function createWindow() {
  const windowIconPath = process.platform === "win32"
    ? path.join(process.cwd(), "public", "logo.ico")
    : path.join(process.cwd(), "public", "logo.svg")
  const windowIcon = nativeImage.createFromPath(windowIconPath)
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    // Allow practical split-screen and narrow desktop layouts.
    minWidth: 720,
    minHeight: 520,
    frame: false,
    titleBarStyle: "hidden",
    autoHideMenuBar: true,
    icon: windowIcon,
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
    mainWindow.setIcon(windowIcon)
    mainWindow.webContents.openDevTools({ mode: "detach" })
    return
  }

  mainWindow.setIcon(windowIcon)
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
  app.setAppUserModelId("com.duwit.app")
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
