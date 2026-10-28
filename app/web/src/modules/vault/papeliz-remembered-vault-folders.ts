import {
  deletePapelizBrowserDatabaseRecord,
  isPapelizBrowserDatabaseAvailable,
  papelizVaultFolderHandlesStoreName,
  putPapelizBrowserDatabaseRecord,
  readAllPapelizBrowserDatabaseRecords,
} from '../browser-database/papeliz-browser-database'
import { describePapelizVaultError } from './papeliz-vault-adapter'

// One row of `papelizVaultFolderHandles`: a folder the user opened, so the welcome screen can offer
// it again. The browser keeps the handle; permission is asked again when the folder is reopened.
export interface PapelizRememberedVaultFolder {
  papelizVaultId: string
  papelizVaultDisplayName: string
  papelizVaultFolderHandle: FileSystemDirectoryHandle
  papelizVaultLastOpenedAt: number
  // When the vault was hidden from Recent vaults into the Hidden list; null (or missing, on rows
  // saved before there was a Hidden list) while it is on Recent vaults.
  papelizVaultHiddenAt?: number | null
}

export function isFolderOnDiskVaultSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function' && window.isSecureContext
}

export async function listRememberedVaultFolders(): Promise<PapelizRememberedVaultFolder[]> {
  if (!isPapelizBrowserDatabaseAvailable()) return []
  const rememberedVaultFolders = await readAllPapelizBrowserDatabaseRecords<PapelizRememberedVaultFolder>(papelizVaultFolderHandlesStoreName)
  return rememberedVaultFolders.sort(
    (firstVaultFolder, secondVaultFolder) => secondVaultFolder.papelizVaultLastOpenedAt - firstVaultFolder.papelizVaultLastOpenedAt,
  )
}

// Saves the folder (or refreshes its "last opened" time when the same folder was opened before).
export async function rememberVaultFolder(papelizVaultFolderHandle: FileSystemDirectoryHandle): Promise<PapelizRememberedVaultFolder> {
  const rememberedVaultFolders = await listRememberedVaultFolders().catch(() => [])
  let sameRememberedVaultFolder: PapelizRememberedVaultFolder | undefined
  for (const rememberedVaultFolder of rememberedVaultFolders) {
    if (await rememberedVaultFolder.papelizVaultFolderHandle.isSameEntry(papelizVaultFolderHandle).catch(() => false)) {
      sameRememberedVaultFolder = rememberedVaultFolder
      break
    }
  }
  const updatedRememberedVaultFolder: PapelizRememberedVaultFolder = {
    papelizVaultId: sameRememberedVaultFolder?.papelizVaultId ?? crypto.randomUUID(),
    papelizVaultDisplayName: papelizVaultFolderHandle.name,
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

export async function forgetRememberedVaultFolder(papelizVaultId: string): Promise<void> {
  if (!isPapelizBrowserDatabaseAvailable()) return
  await deletePapelizBrowserDatabaseRecord(papelizVaultFolderHandlesStoreName, papelizVaultId)
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
  const { papelizVaultDisplayName, papelizVaultFolderHandle } = rememberedVaultFolder
  if (typeof papelizVaultFolderHandle.remove !== 'function') {
    return {
      vaultFolderDeleteOutcome: 'failed',
      vaultFolderDeleteFailureMessage: `Couldn’t delete “${papelizVaultDisplayName}” (Browser Can’t Delete)`,
    }
  }
  try {
    if ((await ensureVaultFolderPermission(papelizVaultFolderHandle)) !== 'granted') {
      return {
        vaultFolderDeleteOutcome: 'failed',
        vaultFolderDeleteFailureMessage: `Couldn’t delete “${papelizVaultDisplayName}” (No Permission)`,
      }
    }
    await papelizVaultFolderHandle.remove({ recursive: true })
  } catch (vaultFolderDeleteError) {
    // A folder that is already gone from the disk only needs to leave the list.
    if (!(vaultFolderDeleteError instanceof DOMException && vaultFolderDeleteError.name === 'NotFoundError')) {
      return {
        vaultFolderDeleteOutcome: 'failed',
        vaultFolderDeleteFailureMessage: `Couldn’t delete “${papelizVaultDisplayName}” (${describePapelizVaultError(vaultFolderDeleteError)})`,
      }
    }
  }
  await forgetRememberedVaultFolder(rememberedVaultFolder.papelizVaultId)
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
