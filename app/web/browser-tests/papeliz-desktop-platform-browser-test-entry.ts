import type { PapelizDesktopFileSystem, PapelizDesktopPlatformLoadResult } from '../src/modules/desktop/papeliz-desktop-platform-contract'

// Papeliz for Windows' native side, stood in for the desktop Edge project (playwright.config.ts's
// `msedge-desktop`): the app builds as the desktop app, so its window buttons and desktop words show,
// but nothing here reaches a disk, a window or the network. Folders are empty and every call does
// nothing; the sample vault, which lives in memory, is what the tests open.
const browserTestDesktopFileSystem: PapelizDesktopFileSystem = {
  listDesktopFolderEntries: async () => [],
  readDesktopEntry: async () => null,
  readDesktopFileText: async () => '',
  readDesktopFileBytes: async () => new Uint8Array(),
  writeDesktopFileText: async () => undefined,
  writeDesktopFileBytes: async () => undefined,
  makeDesktopFolder: async () => undefined,
  renameDesktopEntry: async () => undefined,
  copyDesktopEntry: async () => undefined,
  removeDesktopEntry: async () => undefined,
  joinDesktopPath: (desktopFolderPath, ...desktopPathNames) => [desktopFolderPath, ...desktopPathNames].join(String.fromCharCode(92)),
}

export async function loadPapelizDesktopPlatform(): Promise<PapelizDesktopPlatformLoadResult> {
  return {
    papelizDesktopPlatformAvailability: 'in-the-desktop-app',
    papelizDesktopPlatform: {
      desktopAppVersion: '0.0.0-browser-test',
      desktopAppDistribution: 'microsoft-store',
      desktopFileSystem: browserTestDesktopFileSystem,
      pickDesktopFolderPath: async () => null,
      readDesktopNewVaultDefaultParentFolderPath: async () => null,
      rememberDesktopVaultFolderPath: async () => undefined,
      forgetDesktopVaultFolderPath: async () => undefined,
      rememberDesktopVaultEncryptionKey: async () => undefined,
      readRememberedDesktopVaultEncryptionKey: async () => null,
      forgetRememberedDesktopVaultEncryptionKey: async () => undefined,
      pickDesktopSaveFilePath: async () => null,
      openLinkInSystemBrowser: async () => undefined,
      desktopWindow: {
        minimizeDesktopWindow: async () => undefined,
        toggleDesktopWindowMaximized: async () => undefined,
        isDesktopWindowMaximized: async () => false,
        subscribeToDesktopWindowMaximized: () => () => undefined,
        startDesktopWindowDragging: async () => undefined,
        setDesktopMaximizeButtonBounds: async () => undefined,
        subscribeToDesktopMaximizeButtonPointerState: () => () => undefined,
        setDesktopWindowCloseRequestHandler: () => () => undefined,
        closeDesktopWindow: async () => undefined,
      },
      fetchFromDesktopNativeSide: fetch,
      checkForDesktopAppUpdate: async () => null,
    },
  }
}
