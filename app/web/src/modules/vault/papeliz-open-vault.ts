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
      return { openVaultOutcome: 'failed', openVaultFailureMessage: 'Couldn’t open the folder (No Permission)' }
    }
    return { openVaultOutcome: 'failed', openVaultFailureMessage: 'Couldn’t open the folder (Unknown Error)' }
  }
}

// Shows the browser's folder picker and opens the folder picked, remembering it for Recent vaults.
// Must run from a click.
export async function pickAndOpenPapelizVaultFolder(): Promise<PapelizOpenVaultResult> {
  const vaultFolderPickResult = await pickPapelizVaultFolderHandle()
  if (!('vaultFolderPickOutcome' in vaultFolderPickResult)) return vaultFolderPickResult
  return openPapelizVaultFolderHandle(vaultFolderPickResult.papelizVaultFolderHandle)
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
    return { openVaultOutcome: 'failed', openVaultFailureMessage: `Couldn’t open “${papelizVaultFolderHandle.name}” (Folder Not Found)` }
  }
  if (papelizVaultFolderPermission !== 'granted') {
    return { openVaultOutcome: 'failed', openVaultFailureMessage: 'Couldn’t open the folder (No Permission)' }
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
