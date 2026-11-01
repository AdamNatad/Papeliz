import { describePapelizFailureCodeMessage, describePapelizFailureMessage } from './papeliz-failure-code-words'
import { describePapelizFolderAccessOffReason } from './papeliz-folder-access-support'
import { PapelizFolderOnDiskVaultAdapter } from './papeliz-folder-on-disk-vault-adapter'
import { PapelizInMemoryVaultAdapter } from './papeliz-in-memory-vault-adapter'
import type { PapelizVaultAdapter } from './papeliz-vault-adapter'
import {
  ensureVaultFolderPermission,
  isFolderOnDiskVaultSupported,
  rememberVaultFolder,
  type PapelizRememberedVaultFolder,
} from './papeliz-remembered-vault-folders'
import { papelizSampleVaultDisplayName, papelizSampleVaultNotes } from './papeliz-sample-vault-notes'
import { describeVaultEntryNameProblem } from './papeliz-vault-relative-paths'

export const papelizSampleVaultId = 'papeliz-sample-vault'

// A browser reports a folder window that never appeared the same way as one the user closed (an
// AbortError); some embedded browsers do this at once, without showing it. No one closes the
// window by hand this fast, so an abort sooner than this means the window didn't open.
export const papelizFolderWindowShortestHumanCancelMilliseconds = 400

export interface PapelizOpenVault {
  papelizVaultId: string
  papelizVaultDisplayName: string
  papelizVaultAdapter: PapelizVaultAdapter
}

export type PapelizOpenVaultResult =
  | { openVaultOutcome: 'opened'; papelizOpenVault: PapelizOpenVault }
  // The folder window was closed, or a folder was picked and the browser didn't let Papeliz edit it:
  // its "edit files" question was turned down, it refuses without asking, or it won't share that
  // system folder. Browsers report these the same way.
  | { openVaultOutcome: 'cancelled' }
  | { openVaultOutcome: 'failed'; openVaultFailureMessage: string }
  // The folder window failed to open from the user's own click: opening a folder is off for this
  // page until tried again.
  | { openVaultOutcome: 'chooser-unavailable' }

export function openPapelizSampleVault(): PapelizOpenVault {
  return {
    papelizVaultId: papelizSampleVaultId,
    papelizVaultDisplayName: papelizSampleVaultDisplayName,
    papelizVaultAdapter: new PapelizInMemoryVaultAdapter(papelizSampleVaultNotes),
  }
}

// The folder picked in the browser's folder window, not yet opened as a vault (nor remembered), or
// why there is none, as `PapelizOpenVaultResult` says.
export type PapelizVaultFolderPickResult =
  | { vaultFolderPickOutcome: 'picked'; papelizVaultFolderHandle: FileSystemDirectoryHandle }
  | Exclude<PapelizOpenVaultResult, { openVaultOutcome: 'opened' }>

// Shows the browser's folder picker. Must run from a click.
export async function pickPapelizVaultFolderHandle(): Promise<PapelizVaultFolderPickResult> {
  if (!isFolderOnDiskVaultSupported() || window.showDirectoryPicker === undefined) {
    return { openVaultOutcome: 'failed', openVaultFailureMessage: describePapelizFolderAccessOffReason('unsupported') }
  }
  const folderWindowOpenedAt = performance.now()
  try {
    return { vaultFolderPickOutcome: 'picked', papelizVaultFolderHandle: await window.showDirectoryPicker({ id: 'papeliz-vault-folder', mode: 'readwrite' }) }
  } catch (folderPickerError) {
    if (folderPickerError instanceof DOMException && folderPickerError.name === 'AbortError') {
      const isAbortTooFastForAPerson = performance.now() - folderWindowOpenedAt < papelizFolderWindowShortestHumanCancelMilliseconds
      return isAbortTooFastForAPerson ? { openVaultOutcome: 'chooser-unavailable' } : { openVaultOutcome: 'cancelled' }
    }
    if (folderPickerError instanceof DOMException && folderPickerError.name === 'SecurityError') return { openVaultOutcome: 'chooser-unavailable' }
    if (folderPickerError instanceof DOMException && folderPickerError.name === 'NotAllowedError') {
      return { openVaultOutcome: 'failed', openVaultFailureMessage: describePapelizFailureCodeMessage('Couldn’t open the folder', 'Permission Not Given') }
    }
    return { openVaultOutcome: 'failed', openVaultFailureMessage: describePapelizFailureCodeMessage('Couldn’t open the folder', 'Unknown Error') }
  }
}

// Shows the browser's folder picker and opens the folder picked, remembering it for Recent vaults.
// Must run from a click.
export async function pickAndOpenPapelizVaultFolder(): Promise<PapelizOpenVaultResult> {
  const vaultFolderPickResult = await pickPapelizVaultFolderHandle()
  if (!('vaultFolderPickOutcome' in vaultFolderPickResult)) return vaultFolderPickResult
  return openPapelizVaultFolderHandle(vaultFolderPickResult.papelizVaultFolderHandle)
}

// Why a name typed for a new folder vault can't be the folder's name, as a code ("Name Empty",
// "Has A Blocked Character", ...), or null when it can. Whether the place picked already has that
// name is known only once it is picked.
export function findPapelizNewFolderVaultNameProblem(typedNewVaultName: string): string | null {
  return describeVaultEntryNameProblem(typedNewVaultName)
}

// New Vault's folder, inside the folder picked: a new folder named after the vault, or an empty one of
// that name already there. A folder there with anything in it is refused, since opening one that holds
// notes is Open Vault's job, and so is a file of that name.
export type PapelizNewFolderVaultFolderResult =
  | { newFolderVaultFolderOutcome: 'ready'; papelizVaultFolderHandle: FileSystemDirectoryHandle }
  | { newFolderVaultFolderOutcome: 'folder-not-empty' | 'file-has-the-name' }

export async function makePapelizNewFolderVaultFolder(
  pickedPlaceFolderHandle: FileSystemDirectoryHandle,
  newVaultName: string,
): Promise<PapelizNewFolderVaultFolderResult> {
  let existingVaultFolderHandle: FileSystemDirectoryHandle | null = null
  try {
    existingVaultFolderHandle = await pickedPlaceFolderHandle.getDirectoryHandle(newVaultName)
  } catch (existingFolderError) {
    if (existingFolderError instanceof DOMException && existingFolderError.name === 'TypeMismatchError') return { newFolderVaultFolderOutcome: 'file-has-the-name' }
    if (!(existingFolderError instanceof DOMException && existingFolderError.name === 'NotFoundError')) throw existingFolderError
  }
  if (existingVaultFolderHandle !== null) {
    for await (const _existingFolderEntryName of existingVaultFolderHandle.keys()) return { newFolderVaultFolderOutcome: 'folder-not-empty' }
    return { newFolderVaultFolderOutcome: 'ready', papelizVaultFolderHandle: existingVaultFolderHandle }
  }
  return { newFolderVaultFolderOutcome: 'ready', papelizVaultFolderHandle: await pickedPlaceFolderHandle.getDirectoryHandle(newVaultName, { create: true }) }
}

// New Vault in a folder: the browser's folder window picks where it goes (with permission to change
// it), then the vault's folder is made there, named after the vault, and opened and remembered as any
// folder vault is. Must run from a click.
export async function pickPlaceAndOpenNewPapelizFolderVault(newVaultName: string): Promise<PapelizOpenVaultResult> {
  const placeFolderPickResult = await pickPapelizVaultFolderHandle()
  if (!('vaultFolderPickOutcome' in placeFolderPickResult)) return placeFolderPickResult
  let newFolderVaultFolderResult: PapelizNewFolderVaultFolderResult
  try {
    newFolderVaultFolderResult = await makePapelizNewFolderVaultFolder(placeFolderPickResult.papelizVaultFolderHandle, newVaultName)
  } catch (newVaultFolderError) {
    return {
      openVaultOutcome: 'failed',
      openVaultFailureMessage: describePapelizFailureMessage(`Couldn’t make “${newVaultName}”`, newVaultFolderError, { failedEntryName: newVaultName, failedEntryKind: 'folder' }),
    }
  }
  if (newFolderVaultFolderResult.newFolderVaultFolderOutcome !== 'ready') {
    const takenNameEntryKind = newFolderVaultFolderResult.newFolderVaultFolderOutcome === 'folder-not-empty' ? 'folder' : 'file'
    return { openVaultOutcome: 'failed', openVaultFailureMessage: `A ${takenNameEntryKind} named “${newVaultName}” is already there. Pick another name or another place.` }
  }
  return openPapelizVaultFolderHandle(newFolderVaultFolderResult.papelizVaultFolderHandle)
}

// Reopens a folder from the welcome screen's recent list, asking for permission again if the
// browser no longer has it. Must run from a click.
export async function reopenRememberedPapelizVaultFolder(rememberedVaultFolder: PapelizRememberedVaultFolder): Promise<PapelizOpenVaultResult> {
  return openPapelizVaultFolderHandle(rememberedVaultFolder.papelizVaultFolderHandle)
}

// Opens a folder as a vault and remembers it for Recent vaults (refreshing it when it's there already).
export async function openPapelizVaultFolderHandle(papelizVaultFolderHandle: FileSystemDirectoryHandle): Promise<PapelizOpenVaultResult> {
  let papelizVaultFolderPermission: 'granted' | 'denied'
  try {
    papelizVaultFolderPermission = await ensureVaultFolderPermission(papelizVaultFolderHandle)
  } catch {
    return { openVaultOutcome: 'failed', openVaultFailureMessage: describePapelizFailureCodeMessage(`Couldn’t open “${papelizVaultFolderHandle.name}”`, 'Folder Not Found') }
  }
  if (papelizVaultFolderPermission !== 'granted') {
    return { openVaultOutcome: 'failed', openVaultFailureMessage: describePapelizFailureCodeMessage('Couldn’t open the folder', 'Permission Not Given') }
  }
  const rememberedVaultFolder = await rememberVaultFolder(papelizVaultFolderHandle).catch(() => null)
  return {
    openVaultOutcome: 'opened',
    papelizOpenVault: {
      papelizVaultId: rememberedVaultFolder?.papelizVaultId ?? crypto.randomUUID(),
      papelizVaultDisplayName: papelizVaultFolderHandle.name,
      papelizVaultAdapter: new PapelizFolderOnDiskVaultAdapter(papelizVaultFolderHandle),
    },
  }
}
