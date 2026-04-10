export {}

declare global {
  interface Window {
    electron: {
      platform: string
      versions: Record<string, string>
      windowControls: {
        minimize: () => Promise<void>
        toggleMaximize: () => Promise<boolean>
        close: () => Promise<void>
        isMaximized: () => Promise<boolean>
      }
    }
  }
}
