import {
  deletePapelizBrowserDatabaseRecord,
  isPapelizBrowserDatabaseAvailable,
  papelizVaultFolderHandlesStoreName,
  putPapelizBrowserDatabaseRecord,
  readAllPapelizBrowserDatabaseRecords,
  readPapelizBrowserDatabaseRecord,
} from '../browser-database/papeliz-browser-database'
import type { PapelizDesktopPlatform } from '../desktop/papeliz-desktop-platform-contract'
import { loadPapelizDesktopPlatformOnce, usePapelizDesktopPlatformStore } from '../desktop/papeliz-desktop-platform-store'
import { deletePapelizRememberedNoteTabs } from './papeliz-remembered-note-tabs'
import { describePapelizFailureCodeMessage, describePapelizFailureMessage } from './papeliz-failure-code-words'
import { isPapelizVaultEntryMissingError } from './papeliz-vault-adapter'
import { choosePapelizFolderVaultDisplayName, type PapelizFolderVaultOwnNameRead } from './papeliz-vault-own-name'

// What every row of `papelizVaultFolderHandles` holds: a folder the user opened, so the welcome
// screen can offer it again.
interface PapelizRememberedVaultFolderListing {
  papelizVaultId: string
  // The vault's own name (papeliz-vault-own-name.ts), or its folder's when it has none. An End-to-end
  // vault's own name is sealed, so this is the one last seen until it is unlocked again.
  papelizVaultDisplayName: string
  papelizVaultLastOpenedAt: number
  // When the vault was hidden from Recent vaults into the Hidden list; null (or missing, on rows
  // saved before there was a Hidden list) while it is on Recent vaults.
  papelizVaultHiddenAt?: number | null
}

// A folder opened in the browser. The browser keeps the handle; permission is asked again when the
// folder is reopened.
export interface PapelizRememberedBrowserHandleVaultFolder extends PapelizRememberedVaultFolderListing {
  // Missing on rows saved before Papeliz for Windows remembered folders by path: every such row
  // holds a handle.
  papelizRememberedVaultFolderKind?: 'browser-folder-handle'
  papelizVaultFolderHandle: FileSystemDirectoryHandle
}

// A folder opened in Papeliz for Windows, by its absolute path. The desktop app's native side keeps
// it reachable at every start, so there is no permission to ask for.
export interface PapelizRememberedDesktopPathVaultFolder extends PapelizRememberedVaultFolderListing {
  papelizRememberedVaultFolderKind: 'desktop-folder-path'
  desktopVaultFolderPath: string
}

// One row of `papelizVaultFolderHandles`. Both kinds share the store and its key, so rows saved by
// an older Papeliz read as they always did.
export type PapelizRememberedVaultFolder = PapelizRememberedBrowserHandleVaultFolder | PapelizRememberedDesktopPathVaultFolder

export function isRememberedDesktopPathVaultFolder(
  rememberedVaultFolder: PapelizRememberedVaultFolder,
): rememberedVaultFolder is PapelizRememberedDesktopPathVaultFolder {
  return rememberedVaultFolder.papelizRememberedVaultFolderKind === 'desktop-folder-path'
}

// Papeliz for Windows' native side once it has loaded, or null in the web app (and when it failed
// to load, so the browser's own way still works).
export async function waitForPapelizDesktopPlatform(): Promise<PapelizDesktopPlatform | null> {
  await loadPapelizDesktopPlatformOnce().catch(() => null)
  return usePapelizDesktopPlatformStore.getState().papelizDesktopPlatform
}

// The vault's name for a folder reached by path: its last segment ("C:\Users\Ada\Field Notes" ->
// "Field Notes"), as a folder handle's name is. A drive root keeps its whole path.
export function readDesktopVaultFolderName(desktopVaultFolderPath: string): string {
  return desktopVaultFolderPath.split(/[\\/]+/).filter((desktopPathName) => desktopPathName.length > 0).at(-1) ?? desktopVaultFolderPath
}

// Windows compares paths without case, with either separator, and with or without a trailing one.
function isSameDesktopVaultFolderPath(firstDesktopVaultFolderPath: string, secondDesktopVaultFolderPath: string): boolean {
  const normalizeDesktopVaultFolderPath = (desktopVaultFolderPath: string) => desktopVaultFolderPath.replace(/[\\/]+/g, '\\').replace(/\\$/, '').toLowerCase()
  return normalizeDesktopVaultFolderPath(firstDesktopVaultFolderPath) === normalizeDesktopVaultFolderPath(secondDesktopVaultFolderPath)
}

export function isFolderOnDiskVaultSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function' && window.isSecureContext
}

// Most recently opened first. A folder remembered by path opens only in Papeliz for Windows, so a
// browser never lists one.
export async function listRememberedVaultFolders(): Promise<PapelizRememberedVaultFolder[]> {
  if (!isPapelizBrowserDatabaseAvailable()) return []
  const [rememberedVaultFolders, papelizDesktopPlatform] = await Promise.all([
    readAllPapelizBrowserDatabaseRecords<PapelizRememberedVaultFolder>(papelizVaultFolderHandlesStoreName),
    waitForPapelizDesktopPlatform(),
  ])
  return rememberedVaultFolders
    .filter((rememberedVaultFolder) => papelizDesktopPlatform !== null || !isRememberedDesktopPathVaultFolder(rememberedVaultFolder))
    .sort((firstVaultFolder, secondVaultFolder) => secondVaultFolder.papelizVaultLastOpenedAt - firstVaultFolder.papelizVaultLastOpenedAt)
}

// Saves the folder (or refreshes its "last opened" time when the same folder was opened before), with
// the name it opens with.
export async function rememberVaultFolder(
  papelizVaultFolderHandle: FileSystemDirectoryHandle,
  folderVaultOwnNameRead: PapelizFolderVaultOwnNameRead = { folderVaultOwnNameReadOutcome: 'none' },
): Promise<PapelizRememberedVaultFolder> {
  const rememberedVaultFolders = await listRememberedVaultFolders().catch(() => [])
  let sameRememberedVaultFolder: PapelizRememberedVaultFolder | undefined
  for (const rememberedVaultFolder of rememberedVaultFolders) {
    if (isRememberedDesktopPathVaultFolder(rememberedVaultFolder)) continue
    if (await rememberedVaultFolder.papelizVaultFolderHandle.isSameEntry(papelizVaultFolderHandle).catch(() => false)) {
      sameRememberedVaultFolder = rememberedVaultFolder
      break
    }
  }
  const updatedRememberedVaultFolder: PapelizRememberedVaultFolder = {
    papelizVaultId: sameRememberedVaultFolder?.papelizVaultId ?? crypto.randomUUID(),
    papelizVaultDisplayName: choosePapelizFolderVaultDisplayName(folderVaultOwnNameRead, papelizVaultFolderHandle.name, sameRememberedVaultFolder?.papelizVaultDisplayName),
    papelizVaultFolderHandle,
    papelizVaultLastOpenedAt: Date.now(),
    // Opening a folder again takes it off the Hidden list.
    papelizVaultHiddenAt: null,
  }
  if (isPapelizBrowserDatabaseAvailable()) {
    await putPapelizBrowserDatabaseRecord(papelizVaultFolderHandlesStoreName, updatedRememberedVaultFolder)
  }
  return updatedRememberedVaultFolder
}

// The same for a folder opened in Papeliz for Windows, found again by its path.
export async function rememberDesktopVaultFolderPath(
  desktopVaultFolderPath: string,
  folderVaultOwnNameRead: PapelizFolderVaultOwnNameRead = { folderVaultOwnNameReadOutcome: 'none' },
): Promise<PapelizRememberedDesktopPathVaultFolder> {
  const rememberedVaultFolders = await listRememberedVaultFolders().catch(() => [])
  const sameRememberedVaultFolder = rememberedVaultFolders.find(
    (rememberedVaultFolder) =>
      isRememberedDesktopPathVaultFolder(rememberedVaultFolder) && isSameDesktopVaultFolderPath(rememberedVaultFolder.desktopVaultFolderPath, desktopVaultFolderPath),
  )
  const updatedRememberedVaultFolder: PapelizRememberedDesktopPathVaultFolder = {
    papelizRememberedVaultFolderKind: 'desktop-folder-path',
    papelizVaultId: sameRememberedVaultFolder?.papelizVaultId ?? crypto.randomUUID(),
    papelizVaultDisplayName: choosePapelizFolderVaultDisplayName(
      folderVaultOwnNameRead,
      readDesktopVaultFolderName(desktopVaultFolderPath),
      sameRememberedVaultFolder?.papelizVaultDisplayName,
    ),
    desktopVaultFolderPath,
    papelizVaultLastOpenedAt: Date.now(),
    // Opening a folder again takes it off the Hidden list.
    papelizVaultHiddenAt: null,
  }
  if (isPapelizBrowserDatabaseAvailable()) {
    await putPapelizBrowserDatabaseRecord(papelizVaultFolderHandlesStoreName, updatedRememberedVaultFolder)
  }
  return updatedRememberedVaultFolder
}

// The name a remembered folder's vault shows, after it was renamed in Settings or unlocked: its own
// name, or with none saved (null), its folder's. Recent Vaults shows it from then on. Gives back that
// name, or null when the vault isn't on the list (a browser vault, or no IndexedDB here).
export async function renameRememberedVaultFolder(papelizVaultId: string, papelizVaultOwnName: string | null): Promise<string | null> {
  if (!isPapelizBrowserDatabaseAvailable()) return null
  const renamedVaultFolder = await readPapelizBrowserDatabaseRecord<PapelizRememberedVaultFolder>(papelizVaultFolderHandlesStoreName, papelizVaultId)
  if (renamedVaultFolder === undefined) return null
  const vaultFolderName = isRememberedDesktopPathVaultFolder(renamedVaultFolder)
    ? readDesktopVaultFolderName(renamedVaultFolder.desktopVaultFolderPath)
    : renamedVaultFolder.papelizVaultFolderHandle.name
  const papelizVaultDisplayName = papelizVaultOwnName ?? vaultFolderName
  if (renamedVaultFolder.papelizVaultDisplayName !== papelizVaultDisplayName) {
    await putPapelizBrowserDatabaseRecord(papelizVaultFolderHandlesStoreName, { ...renamedVaultFolder, papelizVaultDisplayName })
  }
  return papelizVaultDisplayName
}

// Takes a folder off the list. A folder remembered by path is also let go on the desktop app's native
// side, so the app stops reaching it; the folder itself stays.
export async function forgetRememberedVaultFolder(papelizVaultId: string): Promise<void> {
  if (!isPapelizBrowserDatabaseAvailable()) return
  const forgottenVaultFolder = await readPapelizBrowserDatabaseRecord<PapelizRememberedVaultFolder>(papelizVaultFolderHandlesStoreName, papelizVaultId).catch(
    () => undefined,
  )
  await deletePapelizBrowserDatabaseRecord(papelizVaultFolderHandlesStoreName, papelizVaultId)
  if (forgottenVaultFolder === undefined || !isRememberedDesktopPathVaultFolder(forgottenVaultFolder)) return
  const papelizDesktopPlatform = await waitForPapelizDesktopPlatform()
  // The row is gone either way; a native side that can't let go now only keeps reaching a folder no
  // vault on the list names.
  await papelizDesktopPlatform?.forgetDesktopVaultFolderPath(forgottenVaultFolder.desktopVaultFolderPath).catch(() => undefined)
}

export function isRememberedVaultFolderHidden(rememberedVaultFolder: PapelizRememberedVaultFolder): boolean {
  return (rememberedVaultFolder.papelizVaultHiddenAt ?? null) !== null
}

// Hides a vault from Recent vaults into the Hidden list, or restores it. Only the list changes:
// the folder and its notes stay where they are.
export async function setRememberedVaultFolderHidden(rememberedVaultFolder: PapelizRememberedVaultFolder, isVaultHidden: boolean): Promise<void> {
  if (!isPapelizBrowserDatabaseAvailable()) return
  await putPapelizBrowserDatabaseRecord(papelizVaultFolderHandlesStoreName, {
    ...rememberedVaultFolder,
    papelizVaultHiddenAt: isVaultHidden ? Date.now() : null,
  })
}

export function isVaultFolderDeleteSupported(): boolean {
  return typeof FileSystemHandle !== 'undefined' && typeof FileSystemHandle.prototype.remove === 'function'
}

export type PapelizVaultFolderDeleteResult =
  | { vaultFolderDeleteOutcome: 'deleted' }
  | { vaultFolderDeleteOutcome: 'failed'; vaultFolderDeleteFailureMessage: string }

// Delete in the start screen's Hidden list: erases the vault's folder, with every note and file in
// it, from the disk, then takes it off the list. The browser erases it for good; it does not go to
// the Recycle Bin. Must run from a click: the browser may ask for permission to change the folder,
// and one click allows one prompt, so in Delete All a folder that still needs one stays for the
// next click.
export async function deleteRememberedVaultFolderFromDisk(rememberedVaultFolder: PapelizRememberedVaultFolder): Promise<PapelizVaultFolderDeleteResult> {
  if (isRememberedDesktopPathVaultFolder(rememberedVaultFolder)) return deleteRememberedDesktopVaultFolderFromDisk(rememberedVaultFolder)
  const { papelizVaultDisplayName, papelizVaultFolderHandle } = rememberedVaultFolder
  if (typeof papelizVaultFolderHandle.remove !== 'function') {
    return {
      vaultFolderDeleteOutcome: 'failed',
      vaultFolderDeleteFailureMessage: describePapelizFailureCodeMessage(`Couldn’t delete “${papelizVaultDisplayName}”`, 'Browser Can’t Delete'),
    }
  }
  try {
    if ((await ensureVaultFolderPermission(papelizVaultFolderHandle)) !== 'granted') {
      return {
        vaultFolderDeleteOutcome: 'failed',
        vaultFolderDeleteFailureMessage: describePapelizFailureCodeMessage(`Couldn’t delete “${papelizVaultDisplayName}”`, 'Permission Not Given'),
      }
    }
    await papelizVaultFolderHandle.remove({ recursive: true })
  } catch (vaultFolderDeleteError) {
    // A folder that is already gone from the disk only needs to leave the list.
    if (!(vaultFolderDeleteError instanceof DOMException && vaultFolderDeleteError.name === 'NotFoundError')) {
      return {
        vaultFolderDeleteOutcome: 'failed',
        vaultFolderDeleteFailureMessage: describePapelizFailureMessage(`Couldn’t delete “${papelizVaultDisplayName}”`, vaultFolderDeleteError),
      }
    }
  }
  await forgetRememberedVaultFolder(rememberedVaultFolder.papelizVaultId)
  void deletePapelizRememberedNoteTabs(rememberedVaultFolder.papelizVaultId).catch(() => undefined)
  return { vaultFolderDeleteOutcome: 'deleted' }
}

// The same in Papeliz for Windows: the native side erases the folder by its path, with no permission
// to ask for, then the folder leaves the list and the native side lets it go.
async function deleteRememberedDesktopVaultFolderFromDisk(rememberedVaultFolder: PapelizRememberedDesktopPathVaultFolder): Promise<PapelizVaultFolderDeleteResult> {
  const { papelizVaultDisplayName, desktopVaultFolderPath } = rememberedVaultFolder
  const papelizDesktopPlatform = await waitForPapelizDesktopPlatform()
  if (papelizDesktopPlatform === null) {
    return {
      vaultFolderDeleteOutcome: 'failed',
      vaultFolderDeleteFailureMessage: describePapelizFailureCodeMessage(`Couldn’t delete “${papelizVaultDisplayName}”`, 'Not Supported Yet'),
    }
  }
  try {
    // A folder that is already gone from the disk only needs to leave the list.
    if ((await papelizDesktopPlatform.desktopFileSystem.readDesktopEntry(desktopVaultFolderPath)) !== null) {
      await papelizDesktopPlatform.desktopFileSystem.removeDesktopEntry(desktopVaultFolderPath)
    }
  } catch (vaultFolderDeleteError) {
    if (!isPapelizVaultEntryMissingError(vaultFolderDeleteError)) {
      return {
        vaultFolderDeleteOutcome: 'failed',
        vaultFolderDeleteFailureMessage: describePapelizFailureMessage(`Couldn’t delete “${papelizVaultDisplayName}”`, vaultFolderDeleteError),
      }
    }
  }
  await forgetRememberedVaultFolder(rememberedVaultFolder.papelizVaultId)
  void deletePapelizRememberedNoteTabs(rememberedVaultFolder.papelizVaultId).catch(() => undefined)
  return { vaultFolderDeleteOutcome: 'deleted' }
}

export type PapelizVaultFolderPermissionResult = 'granted' | 'denied'

// Checks read-and-write permission and asks for it when the browser no longer has it. Must run from
// a click or key press: the browser only shows its permission prompt in answer to the user.
export async function ensureVaultFolderPermission(papelizVaultFolderHandle: FileSystemDirectoryHandle): Promise<PapelizVaultFolderPermissionResult> {
  const papelizVaultFolderPermissionDescriptor = { mode: 'readwrite' } as const
  if ((await papelizVaultFolderHandle.queryPermission(papelizVaultFolderPermissionDescriptor)) === 'granted') return 'granted'
  return (await papelizVaultFolderHandle.requestPermission(papelizVaultFolderPermissionDescriptor)) === 'granted' ? 'granted' : 'denied'
}
