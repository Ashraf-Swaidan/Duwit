import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("electron", {
  platform: process.platform,
  versions: process.versions,
  windowControls: {
    minimize: async () => {
      await ipcRenderer.invoke("window:minimize")
    },
    toggleMaximize: async () => {
      return (await ipcRenderer.invoke("window:toggleMaximize")) as boolean
    },
    close: async () => {
      await ipcRenderer.invoke("window:close")
    },
    isMaximized: async () => {
      return (await ipcRenderer.invoke("window:isMaximized")) as boolean
    },
  },
})
