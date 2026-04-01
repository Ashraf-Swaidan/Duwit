export {}

declare global {
  interface Window {
    electron: {
      platform: NodeJS.Platform
      versions: NodeJS.ProcessVersions
      windowControls: {
        minimize: () => Promise<void>
        toggleMaximize: () => Promise<boolean>
        close: () => Promise<void>
        isMaximized: () => Promise<boolean>
      }
    }
  }
}
