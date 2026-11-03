// The Android and iOS app's side of `virtual:papeliz-mobile-platform`
// (app/web/src/modules/mobile/papeliz-mobile-platform-contract.ts). The mobile build points the
// webapp's Vite build at this file (PAPELIZ_WEBAPP_MOBILE_PLATFORM_ENTRY), so its @tauri-apps imports
// resolve from app/mobile and papeliz.com never carries them. It gives:
// - the phone layout (papeliz-mobile-layout/), drawn in place of the web's once a vault is open;
// - App Storage, the vault folders kept inside Papeliz's own data folder on the phone, through Tauri's
//   fs plugin. The capability file (app/mobile/capabilities/papeliz-mobile-main-window.json) lets the
//   page reach that folder and nothing else. Its file calls keep the desktop contract's shape
//   (PapelizDesktopFileSystem), the one native folder contract both apps share;
// - links opening in the phone's browser.
import { getVersion } from '@tauri-apps/api/app'
import { appDataDir, sep } from '@tauri-apps/api/path'
import { copyFile, exists, mkdir, readDir, readFile, readTextFile, remove, rename, stat, writeFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { openUrl } from '@tauri-apps/plugin-opener'
import type {
  PapelizDesktopFileSystem,
  PapelizDesktopFileSystemEntry,
  PapelizDesktopFileSystemFailure,
  PapelizDesktopFileSystemFailureKind,
} from '../../web/src/modules/desktop/papeliz-desktop-platform-contract'
import { papelizDesktopSavingFileSuffix } from '../../web/src/modules/desktop/papeliz-desktop-platform-contract'
import type { PapelizMobilePlatformLoadResult } from '../../web/src/modules/mobile/papeliz-mobile-platform-contract'

export { PapelizMobileWorkspaceLayout } from '../papeliz-mobile-layout/papeliz-mobile-workspace-layout'

const papelizMobileAppStorageFolderName = 'Vaults'

function mobileEntryNameFromPath(mobileEntryPath: string): string {
  return mobileEntryPath.split('/').filter(Boolean).pop() ?? mobileEntryPath
}

function joinMobilePath(mobileFolderPath: string, ...mobilePathNames: string[]): string {
  const mobilePathSeparator = sep()
  const trimmedMobilePathParts = [mobileFolderPath.replace(/\/+$/, ''), ...mobilePathNames.map((mobilePathName) => mobilePathName.replace(/^\/+|\/+$/g, ''))]
  return trimmedMobilePathParts.filter((mobilePathPart) => mobilePathPart.length > 0).join(mobilePathSeparator)
}

// The POSIX error numbers (errno) behind each failure the app names, the same on Android and iOS for
// these. The fs plugin passes on Rust's message, which ends with "(os error <number>)".
const papelizMobileFailureKindByErrorNumber: ReadonlyMap<number, PapelizDesktopFileSystemFailureKind> = new Map([
  [1, 'no-permission'], // EPERM
  [2, 'not-found'], // ENOENT
  [13, 'no-permission'], // EACCES
  [16, 'in-use'], // EBUSY
  [17, 'name-taken'], // EEXIST
  [28, 'disk-full'], // ENOSPC
])

function createPapelizMobileFileSystemFailure(
  failureMessage: string,
  desktopFileSystemFailureKind: PapelizDesktopFileSystemFailureKind,
): PapelizDesktopFileSystemFailure {
  return Object.assign(new Error(failureMessage), { desktopFileSystemFailureKind })
}

function papelizMobileFileSystemFailureFrom(fileCallError: unknown): PapelizDesktopFileSystemFailure {
  if (fileCallError instanceof Error && 'desktopFileSystemFailureKind' in fileCallError) {
    return fileCallError as PapelizDesktopFileSystemFailure
  }
  const failureMessage = fileCallError instanceof Error ? fileCallError.message : String(fileCallError)
  const errorNumber = /\(os error (\d+)\)/.exec(failureMessage)?.[1]
  const failureKindFromErrorNumber = errorNumber ? papelizMobileFailureKindByErrorNumber.get(Number(errorNumber)) : undefined
  // A path outside the app's data folder is refused by the fs plugin's scope.
  const desktopFileSystemFailureKind = failureKindFromErrorNumber ?? (failureMessage.startsWith('forbidden path') ? 'no-permission' : 'other')
  return createPapelizMobileFileSystemFailure(failureMessage, desktopFileSystemFailureKind)
}

// Every file call throws a failure the app can name ("No Permission", "Phone Full").
function withPapelizMobileFileSystemFailures<FileCallArguments extends unknown[], FileCallResult>(
  fileCall: (...fileCallArguments: FileCallArguments) => Promise<FileCallResult>,
): (...fileCallArguments: FileCallArguments) => Promise<FileCallResult> {
  return async (...fileCallArguments) => {
    try {
      return await fileCall(...fileCallArguments)
    } catch (fileCallError) {
      throw papelizMobileFileSystemFailureFrom(fileCallError)
    }
  }
}

async function failWhenMobileEntryIsTaken(toMobileEntryPath: string): Promise<void> {
  if (await exists(toMobileEntryPath)) {
    throw createPapelizMobileFileSystemFailure(`Something is already at ${toMobileEntryPath}.`, 'name-taken')
  }
}

// A save writes the whole new file beside the old one, then moves it over the old one (a rename
// replaces it in one step on Android and iOS), so a save that fails leaves the old note as it was.
async function replaceMobileFileWhole(mobileFilePath: string, writeSavingMobileFile: (savingMobileFilePath: string) => Promise<void>): Promise<void> {
  const savingMobileFilePath = `${mobileFilePath}${papelizDesktopSavingFileSuffix}`
  try {
    await writeSavingMobileFile(savingMobileFilePath)
    await rename(savingMobileFilePath, mobileFilePath)
  } catch (saveError) {
    await remove(savingMobileFilePath).catch(() => {})
    throw saveError
  }
}

async function copyMobileEntryWithin(fromMobileEntryPath: string, toMobileEntryPath: string): Promise<void> {
  const fromMobileEntryInfo = await stat(fromMobileEntryPath)
  if (!fromMobileEntryInfo.isDirectory) {
    await copyFile(fromMobileEntryPath, toMobileEntryPath)
    return
  }
  await mkdir(toMobileEntryPath)
  for (const mobileFolderChild of await readDir(fromMobileEntryPath)) {
    await copyMobileEntryWithin(joinMobilePath(fromMobileEntryPath, mobileFolderChild.name), joinMobilePath(toMobileEntryPath, mobileFolderChild.name))
  }
}

const papelizTauriMobileAppStorageFileSystem: PapelizDesktopFileSystem = {
  // A listing carries names and kinds only; size and last change come from readDesktopEntry.
  listDesktopFolderEntries: withPapelizMobileFileSystemFailures(async (mobileFolderPath: string) =>
    (await readDir(mobileFolderPath)).map(
      (mobileFolderChild): PapelizDesktopFileSystemEntry => ({
        desktopEntryName: mobileFolderChild.name,
        isDesktopEntryFolder: mobileFolderChild.isDirectory,
        desktopFileByteCount: null,
        desktopEntryModifiedAt: null,
      }),
    ),
  ),
  readDesktopEntry: withPapelizMobileFileSystemFailures(async (mobileEntryPath: string): Promise<PapelizDesktopFileSystemEntry | null> => {
    if (!(await exists(mobileEntryPath))) return null
    const mobileEntryInfo = await stat(mobileEntryPath)
    return {
      desktopEntryName: mobileEntryNameFromPath(mobileEntryPath),
      isDesktopEntryFolder: mobileEntryInfo.isDirectory,
      desktopFileByteCount: mobileEntryInfo.isDirectory ? null : mobileEntryInfo.size,
      desktopEntryModifiedAt: mobileEntryInfo.isDirectory ? null : (mobileEntryInfo.mtime?.getTime() ?? null),
    }
  }),
  readDesktopFileText: withPapelizMobileFileSystemFailures((mobileFilePath: string) => readTextFile(mobileFilePath)),
  readDesktopFileBytes: withPapelizMobileFileSystemFailures((mobileFilePath: string) => readFile(mobileFilePath)),
  writeDesktopFileText: withPapelizMobileFileSystemFailures((mobileFilePath: string, mobileFileText: string) =>
    replaceMobileFileWhole(mobileFilePath, (savingMobileFilePath) => writeTextFile(savingMobileFilePath, mobileFileText)),
  ),
  writeDesktopFileBytes: withPapelizMobileFileSystemFailures((mobileFilePath: string, mobileFileBytes: Uint8Array) =>
    replaceMobileFileWhole(mobileFilePath, (savingMobileFilePath) => writeFile(savingMobileFilePath, mobileFileBytes)),
  ),
  makeDesktopFolder: withPapelizMobileFileSystemFailures((mobileFolderPath: string) => mkdir(mobileFolderPath, { recursive: true })),
  renameDesktopEntry: withPapelizMobileFileSystemFailures(async (fromMobileEntryPath: string, toMobileEntryPath: string) => {
    await failWhenMobileEntryIsTaken(toMobileEntryPath)
    await rename(fromMobileEntryPath, toMobileEntryPath)
  }),
  copyDesktopEntry: withPapelizMobileFileSystemFailures(async (fromMobileEntryPath: string, toMobileEntryPath: string) => {
    await failWhenMobileEntryIsTaken(toMobileEntryPath)
    await copyMobileEntryWithin(fromMobileEntryPath, toMobileEntryPath)
  }),
  removeDesktopEntry: withPapelizMobileFileSystemFailures((mobileEntryPath: string) => remove(mobileEntryPath, { recursive: true })),
  joinDesktopPath: joinMobilePath,
}

export async function loadPapelizMobilePlatform(): Promise<PapelizMobilePlatformLoadResult> {
  const mobileAppStorageFolderPath = joinMobilePath(await appDataDir(), papelizMobileAppStorageFolderName)
  await papelizTauriMobileAppStorageFileSystem.makeDesktopFolder(mobileAppStorageFolderPath)
  return {
    papelizMobilePlatformAvailability: 'in-the-mobile-app',
    papelizMobilePlatform: {
      mobileAppVersion: await getVersion(),
      mobileAppStorageFolderPath,
      mobileAppStorageFileSystem: papelizTauriMobileAppStorageFileSystem,
      async openLinkInSystemBrowser(externalLinkUrl: string) {
        const externalLinkProtocol = new URL(externalLinkUrl).protocol
        if (externalLinkProtocol !== 'https:' && externalLinkProtocol !== 'http:') return
        await openUrl(externalLinkUrl)
      },
    },
  }
}
