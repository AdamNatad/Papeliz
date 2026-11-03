// The desktop app's side of `virtual:papeliz-desktop-platform`: the web app's desktop contract
// (app/web/src/modules/desktop/papeliz-desktop-platform-contract.ts) mapped to Tauri's plugins and to
// this app's own Rust commands (app/desktop/src). The desktop build points the webapp's Vite build at
// this file (PAPELIZ_WEBAPP_DESKTOP_PLATFORM_ENTRY), so its @tauri-apps imports resolve from
// app/desktop and the web build never carries them.
import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { sep } from '@tauri-apps/api/path'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { copyFile, exists, mkdir, readDir, readFile, readTextFile, remove, rename, stat, writeFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { fetch as fetchFromTauriNativeSide } from '@tauri-apps/plugin-http'
import { openUrl } from '@tauri-apps/plugin-opener'
import { check } from '@tauri-apps/plugin-updater'
import type {
  PapelizDesktopAppUpdate,
  PapelizDesktopFileSystem,
  PapelizDesktopFileSystemEntry,
  PapelizDesktopFileSystemFailure,
  PapelizDesktopFileSystemFailureKind,
  PapelizDesktopMaximizeButtonBounds,
  PapelizDesktopMaximizeButtonPointerState,
  PapelizDesktopPlatform,
  PapelizDesktopPlatformLoadResult,
  PapelizDesktopWindow,
} from '../../web/src/modules/desktop/papeliz-desktop-platform-contract'
import { papelizDesktopSavingFileSuffix } from '../../web/src/modules/desktop/papeliz-desktop-platform-contract'

type PapelizDesktopAppDistribution = PapelizDesktopPlatform['desktopAppDistribution']

// The Rust side's names (app/desktop/src). Its commands take their arguments in camelCase here.
const papelizDesktopRustCommandNames = {
  getAppDistribution: 'get_papeliz_desktop_app_distribution',
  pickVaultFolder: 'pick_papeliz_desktop_vault_folder',
  rememberVaultFolder: 'remember_papeliz_desktop_vault_folder',
  forgetVaultFolder: 'forget_papeliz_desktop_vault_folder',
  readNewVaultDefaultParentFolder: 'read_papeliz_desktop_new_vault_default_parent_folder_path',
  pickSaveFilePath: 'pick_papeliz_desktop_save_file_path',
  setMaximizeButtonBounds: 'set_papeliz_desktop_maximize_button_bounds',
  rememberVaultEncryptionKey: 'remember_papeliz_desktop_vault_encryption_key',
  readRememberedVaultEncryptionKey: 'read_remembered_papeliz_desktop_vault_encryption_key',
  forgetRememberedVaultEncryptionKey: 'forget_remembered_papeliz_desktop_vault_encryption_key',
} as const
const papelizDesktopMaximizeButtonPointerStateEventName = 'papeliz-desktop-maximize-button-pointer-state'

function desktopEntryNameFromPath(desktopEntryPath: string): string {
  return desktopEntryPath.split(/[\\/]+/).filter(Boolean).pop() ?? desktopEntryPath
}

function joinDesktopPath(desktopFolderPath: string, ...desktopPathNames: string[]): string {
  const desktopPathSeparator = sep()
  const trimmedDesktopPathParts = [desktopFolderPath.replace(/[\\/]+$/, ''), ...desktopPathNames.map((desktopPathName) => desktopPathName.replace(/^[\\/]+|[\\/]+$/g, ''))]
  return trimmedDesktopPathParts.filter((desktopPathPart) => desktopPathPart.length > 0).join(desktopPathSeparator)
}

// The Windows error codes (winerror.h) behind each failure the app names. The fs plugin passes on
// Rust's message, which ends with "(os error <code>)".
const papelizDesktopFailureKindByWindowsErrorCode: ReadonlyMap<number, PapelizDesktopFileSystemFailureKind> = new Map([
  [2, 'not-found'], // ERROR_FILE_NOT_FOUND
  [3, 'not-found'], // ERROR_PATH_NOT_FOUND
  [5, 'no-permission'], // ERROR_ACCESS_DENIED
  [32, 'in-use'], // ERROR_SHARING_VIOLATION
  [33, 'in-use'], // ERROR_LOCK_VIOLATION
  [39, 'disk-full'], // ERROR_HANDLE_DISK_FULL
  [80, 'name-taken'], // ERROR_FILE_EXISTS
  [112, 'disk-full'], // ERROR_DISK_FULL
  [183, 'name-taken'], // ERROR_ALREADY_EXISTS
])

function createPapelizDesktopFileSystemFailure(
  failureMessage: string,
  desktopFileSystemFailureKind: PapelizDesktopFileSystemFailureKind,
): PapelizDesktopFileSystemFailure {
  return Object.assign(new Error(failureMessage), { desktopFileSystemFailureKind })
}

function papelizDesktopFileSystemFailureFrom(fileCallError: unknown): PapelizDesktopFileSystemFailure {
  if (fileCallError instanceof Error && 'desktopFileSystemFailureKind' in fileCallError) {
    return fileCallError as PapelizDesktopFileSystemFailure
  }
  const failureMessage = fileCallError instanceof Error ? fileCallError.message : String(fileCallError)
  const windowsErrorCode = /\(os error (\d+)\)/.exec(failureMessage)?.[1]
  const failureKindFromWindows = windowsErrorCode ? papelizDesktopFailureKindByWindowsErrorCode.get(Number(windowsErrorCode)) : undefined
  // A path outside every folder the person picked is refused by the fs plugin's scope.
  const desktopFileSystemFailureKind = failureKindFromWindows ?? (failureMessage.startsWith('forbidden path') ? 'no-permission' : 'other')
  return createPapelizDesktopFileSystemFailure(failureMessage, desktopFileSystemFailureKind)
}

// Every file call throws a failure the app can name ("No Permission", "File In Use").
function withPapelizDesktopFileSystemFailures<FileCallArguments extends unknown[], FileCallResult>(
  fileCall: (...fileCallArguments: FileCallArguments) => Promise<FileCallResult>,
): (...fileCallArguments: FileCallArguments) => Promise<FileCallResult> {
  return async (...fileCallArguments) => {
    try {
      return await fileCall(...fileCallArguments)
    } catch (fileCallError) {
      throw papelizDesktopFileSystemFailureFrom(fileCallError)
    }
  }
}

async function failWhenDesktopEntryIsTaken(toDesktopEntryPath: string): Promise<void> {
  if (await exists(toDesktopEntryPath)) {
    throw createPapelizDesktopFileSystemFailure(`Something is already at ${toDesktopEntryPath}.`, 'name-taken')
  }
}

// A save writes the whole new file beside the old one, then moves it over the old one (on Windows the
// move replaces it in one step), so a save that fails leaves the old note as it was. The vault
// adapter never lists a file with this suffix (papelizDesktopSavingFileSuffix in the contract).
async function replaceDesktopFileWhole(desktopFilePath: string, writeSavingDesktopFile: (savingDesktopFilePath: string) => Promise<void>): Promise<void> {
  const savingDesktopFilePath = `${desktopFilePath}${papelizDesktopSavingFileSuffix}`
  try {
    await writeSavingDesktopFile(savingDesktopFilePath)
    await rename(savingDesktopFilePath, desktopFilePath)
  } catch (saveError) {
    await remove(savingDesktopFilePath).catch(() => {})
    throw saveError
  }
}

async function copyDesktopEntryWithin(fromDesktopEntryPath: string, toDesktopEntryPath: string): Promise<void> {
  const fromDesktopEntryInfo = await stat(fromDesktopEntryPath)
  if (!fromDesktopEntryInfo.isDirectory) {
    await copyFile(fromDesktopEntryPath, toDesktopEntryPath)
    return
  }
  await mkdir(toDesktopEntryPath)
  for (const desktopFolderChild of await readDir(fromDesktopEntryPath)) {
    await copyDesktopEntryWithin(joinDesktopPath(fromDesktopEntryPath, desktopFolderChild.name), joinDesktopPath(toDesktopEntryPath, desktopFolderChild.name))
  }
}

const papelizTauriDesktopFileSystem: PapelizDesktopFileSystem = {
  // A listing carries names and kinds only; size and last change come from readDesktopEntry, so a
  // large vault lists in one call instead of one per file.
  listDesktopFolderEntries: withPapelizDesktopFileSystemFailures(async (desktopFolderPath: string) =>
    (await readDir(desktopFolderPath)).map(
      (desktopFolderChild): PapelizDesktopFileSystemEntry => ({
        desktopEntryName: desktopFolderChild.name,
        isDesktopEntryFolder: desktopFolderChild.isDirectory,
        desktopFileByteCount: null,
        desktopEntryModifiedAt: null,
      }),
    ),
  ),
  readDesktopEntry: withPapelizDesktopFileSystemFailures(async (desktopEntryPath: string): Promise<PapelizDesktopFileSystemEntry | null> => {
    if (!(await exists(desktopEntryPath))) return null
    const desktopEntryInfo = await stat(desktopEntryPath)
    return {
      desktopEntryName: desktopEntryNameFromPath(desktopEntryPath),
      isDesktopEntryFolder: desktopEntryInfo.isDirectory,
      desktopFileByteCount: desktopEntryInfo.isDirectory ? null : desktopEntryInfo.size,
      desktopEntryModifiedAt: desktopEntryInfo.isDirectory ? null : (desktopEntryInfo.mtime?.getTime() ?? null),
    }
  }),
  readDesktopFileText: withPapelizDesktopFileSystemFailures((desktopFilePath: string) => readTextFile(desktopFilePath)),
  readDesktopFileBytes: withPapelizDesktopFileSystemFailures((desktopFilePath: string) => readFile(desktopFilePath)),
  writeDesktopFileText: withPapelizDesktopFileSystemFailures((desktopFilePath: string, desktopFileText: string) =>
    replaceDesktopFileWhole(desktopFilePath, (savingDesktopFilePath) => writeTextFile(savingDesktopFilePath, desktopFileText)),
  ),
  writeDesktopFileBytes: withPapelizDesktopFileSystemFailures((desktopFilePath: string, desktopFileBytes: Uint8Array) =>
    replaceDesktopFileWhole(desktopFilePath, (savingDesktopFilePath) => writeFile(savingDesktopFilePath, desktopFileBytes)),
  ),
  makeDesktopFolder: withPapelizDesktopFileSystemFailures((desktopFolderPath: string) => mkdir(desktopFolderPath, { recursive: true })),
  renameDesktopEntry: withPapelizDesktopFileSystemFailures(async (fromDesktopEntryPath: string, toDesktopEntryPath: string) => {
    await failWhenDesktopEntryIsTaken(toDesktopEntryPath)
    await rename(fromDesktopEntryPath, toDesktopEntryPath)
  }),
  copyDesktopEntry: withPapelizDesktopFileSystemFailures(async (fromDesktopEntryPath: string, toDesktopEntryPath: string) => {
    await failWhenDesktopEntryIsTaken(toDesktopEntryPath)
    await copyDesktopEntryWithin(fromDesktopEntryPath, toDesktopEntryPath)
  }),
  removeDesktopEntry: withPapelizDesktopFileSystemFailures((desktopEntryPath: string) => remove(desktopEntryPath, { recursive: true })),
  joinDesktopPath,
}

// A listener that Tauri hands back as a promise, as the contract's plain stop call.
function stopListeningLater(desktopListenerStart: Promise<() => void>): () => void {
  let stopDesktopListener: (() => void) | null = null
  let isDesktopListenerStopped = false
  void desktopListenerStart.then((stopStartedDesktopListener) => {
    if (isDesktopListenerStopped) stopStartedDesktopListener()
    else stopDesktopListener = stopStartedDesktopListener
  })
  return () => {
    isDesktopListenerStopped = true
    stopDesktopListener?.()
  }
}

function createPapelizTauriDesktopWindow(): PapelizDesktopWindow {
  const papelizDesktopMainWindow = getCurrentWindow()
  return {
    minimizeDesktopWindow: () => papelizDesktopMainWindow.minimize(),
    toggleDesktopWindowMaximized: () => papelizDesktopMainWindow.toggleMaximize(),
    isDesktopWindowMaximized: () => papelizDesktopMainWindow.isMaximized(),
    subscribeToDesktopWindowMaximized(onDesktopWindowMaximizedChange) {
      let lastKnownDesktopWindowMaximized: boolean | null = null
      return stopListeningLater(
        papelizDesktopMainWindow.onResized(async () => {
          const isDesktopWindowMaximized = await papelizDesktopMainWindow.isMaximized()
          if (isDesktopWindowMaximized === lastKnownDesktopWindowMaximized) return
          lastKnownDesktopWindowMaximized = isDesktopWindowMaximized
          onDesktopWindowMaximizedChange(isDesktopWindowMaximized)
        }),
      )
    },
    startDesktopWindowDragging: () => papelizDesktopMainWindow.startDragging(),
    setDesktopMaximizeButtonBounds: (desktopMaximizeButtonBounds: PapelizDesktopMaximizeButtonBounds | null) =>
      invoke(papelizDesktopRustCommandNames.setMaximizeButtonBounds, { desktopMaximizeButtonBounds }),
    subscribeToDesktopMaximizeButtonPointerState(onDesktopMaximizeButtonPointerStateChange) {
      return stopListeningLater(
        listen<PapelizDesktopMaximizeButtonPointerState>(papelizDesktopMaximizeButtonPointerStateEventName, (pointerStateEvent) =>
          onDesktopMaximizeButtonPointerStateChange(pointerStateEvent.payload),
        ),
      )
    },
    // Tauri closes the window once the handler settles, unless it asks to keep it open: when a note
    // couldn't be saved the handler throws, and the window stays open while the app says why.
    setDesktopWindowCloseRequestHandler(beforeDesktopWindowCloses) {
      return stopListeningLater(
        papelizDesktopMainWindow.onCloseRequested(async (desktopWindowCloseRequest) => {
          try {
            await beforeDesktopWindowCloses()
          } catch {
            desktopWindowCloseRequest.preventDefault()
          }
        }),
      )
    },
    // The same request Alt+F4 makes, so the close request handler above runs first.
    closeDesktopWindow: () => papelizDesktopMainWindow.close(),
  }
}

async function checkForPapelizDesktopAppUpdate(desktopAppDistribution: PapelizDesktopAppDistribution): Promise<PapelizDesktopAppUpdate | null> {
  // The Store package has no updater: the Store updates it.
  if (desktopAppDistribution === 'microsoft-store') return null
  try {
    const availableDesktopAppUpdate = await check()
    if (!availableDesktopAppUpdate) return null
    return {
      desktopAppUpdateVersion: availableDesktopAppUpdate.version,
      // On Windows the installer closes Papeliz, installs, and starts it again.
      installDesktopAppUpdate: () => availableDesktopAppUpdate.downloadAndInstall(),
    }
  } catch {
    return null
  }
}

export async function loadPapelizDesktopPlatform(): Promise<PapelizDesktopPlatformLoadResult> {
  const [desktopAppVersion, desktopAppDistribution] = await Promise.all([
    getVersion(),
    invoke<PapelizDesktopAppDistribution>(papelizDesktopRustCommandNames.getAppDistribution),
  ])
  const papelizDesktopPlatform: PapelizDesktopPlatform = {
    desktopAppVersion,
    desktopAppDistribution,
    desktopFileSystem: papelizTauriDesktopFileSystem,
    pickDesktopFolderPath: (desktopFolderPickerTitle) =>
      invoke<string | null>(papelizDesktopRustCommandNames.pickVaultFolder, { folderPickerTitle: desktopFolderPickerTitle }),
    // Refused as a forbidden path, so a no-permission failure, unless the folder is at or inside one
    // picked in this session, or already remembered.
    rememberDesktopVaultFolderPath: withPapelizDesktopFileSystemFailures((desktopVaultFolderPath: string) =>
      invoke<void>(papelizDesktopRustCommandNames.rememberVaultFolder, { vaultFolderPath: desktopVaultFolderPath }),
    ),
    forgetDesktopVaultFolderPath: (desktopVaultFolderPath) =>
      invoke(papelizDesktopRustCommandNames.forgetVaultFolder, { vaultFolderPath: desktopVaultFolderPath }),
    // <Documents>\Papeliz in Windows' own Documents folder, wherever it was moved. Rust lets the app
    // reach only that folder for this session, as if it were picked, and makes nothing.
    readDesktopNewVaultDefaultParentFolderPath: () =>
      invoke<string | null>(papelizDesktopRustCommandNames.readNewVaultDefaultParentFolder),
    // The Save dialog opens from Rust, which then lets the app write that one file and its
    // `.papeliz-saving` sibling for the rest of the session.
    pickDesktopSaveFilePath: (desktopSaveFileRequest) =>
      invoke<string | null>(papelizDesktopRustCommandNames.pickSaveFilePath, {
        suggestedDesktopFileName: desktopSaveFileRequest.suggestedDesktopFileName,
        desktopFileTypeFilters: desktopSaveFileRequest.desktopFileTypeFilters,
      }),
    async openLinkInSystemBrowser(externalLinkUrl) {
      const externalLinkProtocol = new URL(externalLinkUrl).protocol
      if (externalLinkProtocol !== 'https:' && externalLinkProtocol !== 'http:') return
      await openUrl(externalLinkUrl)
    },
    desktopWindow: createPapelizTauriDesktopWindow(),
    // The http plugin's allowed hosts are only the providers a web page can't reach
    // (capabilities/papeliz-desktop-main-window.json); any other address fails there.
    fetchFromDesktopNativeSide: fetchFromTauriNativeSide as typeof fetch,
    checkForDesktopAppUpdate: () => checkForPapelizDesktopAppUpdate(desktopAppDistribution),
    // An End-to-end vault's key in Windows Credential Manager, for this user on this computer. The bytes
    // cross to Rust and back as a list of numbers.
    rememberDesktopVaultEncryptionKey: (papelizVaultId, vaultEncryptionKeyBytes) =>
      invoke<void>(papelizDesktopRustCommandNames.rememberVaultEncryptionKey, { papelizVaultId, vaultEncryptionKeyBytes }),
    async readRememberedDesktopVaultEncryptionKey(papelizVaultId) {
      const rememberedVaultEncryptionKeyByteValues = await invoke<number[] | null>(
        papelizDesktopRustCommandNames.readRememberedVaultEncryptionKey,
        { papelizVaultId },
      )
      return rememberedVaultEncryptionKeyByteValues ? Uint8Array.from(rememberedVaultEncryptionKeyByteValues) : null
    },
    forgetRememberedDesktopVaultEncryptionKey: (papelizVaultId) =>
      invoke<void>(papelizDesktopRustCommandNames.forgetRememberedVaultEncryptionKey, { papelizVaultId }),
  }
  return { papelizDesktopPlatformAvailability: 'in-the-desktop-app', papelizDesktopPlatform }
}
