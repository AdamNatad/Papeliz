import type { PapelizDesktopFileSystem, PapelizDesktopPlatform } from '../desktop/papeliz-desktop-platform-contract'
import { createPapelizDesktopFolderVaultAdapter } from './papeliz-desktop-folder-vault-adapter'
import { describePapelizFailureCodeMessage, describePapelizFailureMessage } from './papeliz-failure-code-words'
import { describePapelizFolderAccessOffReason } from './papeliz-folder-access-support'
import { PapelizFolderOnDiskVaultAdapter } from './papeliz-folder-on-disk-vault-adapter'
import { PapelizInMemoryVaultAdapter } from './papeliz-in-memory-vault-adapter'
import type { PapelizVaultAdapter } from './papeliz-vault-adapter'
import {
  ensureVaultFolderPermission,
  isFolderOnDiskVaultSupported,
  isRememberedDesktopPathVaultFolder,
  readDesktopVaultFolderName,
  rememberDesktopVaultFolderPath,
  rememberVaultFolder,
  waitForPapelizDesktopPlatform,
  type PapelizRememberedVaultFolder,
} from './papeliz-remembered-vault-folders'
import { papelizSampleVaultDisplayName, papelizSampleVaultNotes } from './papeliz-sample-vault-notes'
import { findPapelizLockedEndToEndVault, type PapelizLockedEndToEndVault } from './papeliz-vault-encryption'
import { describeVaultEntryNameProblem } from './papeliz-vault-relative-paths'

export const papelizSampleVaultId = 'papeliz-sample-vault'

// A browser reports a folder window that never appeared the same way as one the user closed (an
// AbortError); some embedded browsers do this at once, without showing it. No one closes the
// window by hand this fast, so an abort sooner than this means the window didn't open.
export const papelizFolderWindowShortestHumanCancelMilliseconds = 400

// The title of Windows' folder picker in Papeliz for Windows: the name of the start page's action
// that opened it.
export const papelizOpenVaultDesktopFolderPickerTitle = 'Open Vault'
export const papelizNewVaultDesktopFolderPickerTitle = 'New Vault'

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

// Why no vault was opened: a folder picked that wasn't, or couldn't be.
export type PapelizOpenVaultRefusal = Exclude<PapelizOpenVaultResult, { openVaultOutcome: 'opened' }>

// Opening a vault that may already be End-to-end (Open Vault, a Recent Vaults row): the same, or the
// vault found and waiting for its passphrase or its remembered key (papeliz-vault-encryption.ts), with
// nothing in it open yet. A vault New Vault or a template has just made is never End-to-end before it
// opens, so those give `PapelizOpenVaultResult`.
export type PapelizExistingVaultOpenResult =
  | PapelizOpenVaultResult
  | { openVaultOutcome: 'needs-unlock'; papelizLockedEndToEndVault: PapelizLockedEndToEndVault }

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
  | PapelizOpenVaultRefusal

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
// Must run from a click. In Papeliz for Windows it is Windows' own folder picker, and the folder is
// opened and remembered by its path.
export async function pickAndOpenPapelizVaultFolder(): Promise<PapelizExistingVaultOpenResult> {
  const papelizDesktopPlatform = await waitForPapelizDesktopPlatform()
  if (papelizDesktopPlatform !== null) return findPapelizLockedEndToEndVault(await pickAndOpenPapelizDesktopVaultFolder(papelizDesktopPlatform))
  const vaultFolderPickResult = await pickPapelizVaultFolderHandle()
  if (!('vaultFolderPickOutcome' in vaultFolderPickResult)) return vaultFolderPickResult
  return findPapelizLockedEndToEndVault(await openPapelizVaultFolderHandle(vaultFolderPickResult.papelizVaultFolderHandle))
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

// Why New Vault's folder couldn't be used: the name is taken in the place picked.
export function describeNewFolderVaultNameTakenMessage(newFolderVaultFolderOutcome: 'folder-not-empty' | 'file-has-the-name', newVaultName: string): string {
  const takenNameEntryKind = newFolderVaultFolderOutcome === 'folder-not-empty' ? 'folder' : 'file'
  return `A ${takenNameEntryKind} named “${newVaultName}” is already there. Pick another name or another place.`
}

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

// Where New Vault makes a vault's folder, picked before Create Vault: a folder's path in Papeliz for
// Windows, or a folder from the browser's folder window (which tells Papeliz only its name).
export type PapelizNewVaultParentFolder =
  | { newVaultParentFolderKind: 'desktop-folder-path'; desktopParentFolderPath: string }
  | { newVaultParentFolderKind: 'browser-folder-handle'; browserParentFolderHandle: FileSystemDirectoryHandle }

export type PapelizNewVaultParentFolderPickResult =
  | { newVaultParentFolderPickOutcome: 'picked'; pickedNewVaultParentFolder: PapelizNewVaultParentFolder }
  | PapelizOpenVaultRefusal

// The folder window, for where New Vault makes the vault (with permission to change it in a browser).
// Must run from a click.
export async function pickPapelizNewVaultParentFolder(): Promise<PapelizNewVaultParentFolderPickResult> {
  const papelizDesktopPlatform = await waitForPapelizDesktopPlatform()
  if (papelizDesktopPlatform !== null) {
    const desktopFolderPickResult = await pickPapelizDesktopFolderPath(papelizDesktopPlatform, papelizNewVaultDesktopFolderPickerTitle)
    if (!('desktopFolderPickOutcome' in desktopFolderPickResult)) return desktopFolderPickResult
    return {
      newVaultParentFolderPickOutcome: 'picked',
      pickedNewVaultParentFolder: { newVaultParentFolderKind: 'desktop-folder-path', desktopParentFolderPath: desktopFolderPickResult.pickedDesktopFolderPath },
    }
  }
  const browserFolderPickResult = await pickPapelizVaultFolderHandle()
  if (!('vaultFolderPickOutcome' in browserFolderPickResult)) return browserFolderPickResult
  return {
    newVaultParentFolderPickOutcome: 'picked',
    pickedNewVaultParentFolder: { newVaultParentFolderKind: 'browser-folder-handle', browserParentFolderHandle: browserFolderPickResult.papelizVaultFolderHandle },
  }
}

// Where New Vault starts in Papeliz for Windows, before another place is picked: `<Documents>\Papeliz`.
// Null in a browser, which has no such place, and when Documents can't be found.
export async function readPapelizNewVaultDefaultParentFolder(): Promise<PapelizNewVaultParentFolder | null> {
  const papelizDesktopPlatform = await waitForPapelizDesktopPlatform()
  if (papelizDesktopPlatform === null) return null
  try {
    const desktopParentFolderPath = await papelizDesktopPlatform.readDesktopNewVaultDefaultParentFolderPath()
    return desktopParentFolderPath === null ? null : { newVaultParentFolderKind: 'desktop-folder-path', desktopParentFolderPath }
  } catch {
    return null
  }
}

// Whether New Vault's folder name is taken in the place picked, by makePapelizNewFolderVaultFolder's
// rule: a folder of that name with anything in it, or a file of that name. Null when it is free, or
// when the place can't be read, so the check never refuses what Create Vault would make.
export async function findPapelizNewVaultFolderNameTaken(
  newVaultParentFolder: PapelizNewVaultParentFolder,
  newVaultName: string,
): Promise<'folder-not-empty' | 'file-has-the-name' | null> {
  try {
    if (newVaultParentFolder.newVaultParentFolderKind === 'desktop-folder-path') {
      const papelizDesktopPlatform = await waitForPapelizDesktopPlatform()
      if (papelizDesktopPlatform === null) return null
      const { desktopFileSystem } = papelizDesktopPlatform
      const desktopVaultFolderPath = desktopFileSystem.joinDesktopPath(newVaultParentFolder.desktopParentFolderPath, newVaultName)
      const existingDesktopEntry = await desktopFileSystem.readDesktopEntry(desktopVaultFolderPath)
      if (existingDesktopEntry === null) return null
      if (!existingDesktopEntry.isDesktopEntryFolder) return 'file-has-the-name'
      return (await desktopFileSystem.listDesktopFolderEntries(desktopVaultFolderPath)).length > 0 ? 'folder-not-empty' : null
    }
    let existingVaultFolderHandle: FileSystemDirectoryHandle
    try {
      existingVaultFolderHandle = await newVaultParentFolder.browserParentFolderHandle.getDirectoryHandle(newVaultName)
    } catch (existingFolderError) {
      return existingFolderError instanceof DOMException && existingFolderError.name === 'TypeMismatchError' ? 'file-has-the-name' : null
    }
    for await (const _existingFolderEntryName of existingVaultFolderHandle.keys()) return 'folder-not-empty'
    return null
  } catch {
    return null
  }
}

// New Vault's folder, made in the place picked and opened and remembered as any folder vault is.
export async function makeAndOpenNewPapelizFolderVault(newVaultParentFolder: PapelizNewVaultParentFolder, newVaultName: string): Promise<PapelizOpenVaultResult> {
  if (newVaultParentFolder.newVaultParentFolderKind === 'desktop-folder-path') {
    const papelizDesktopPlatform = await waitForPapelizDesktopPlatform()
    if (papelizDesktopPlatform === null) {
      return { openVaultOutcome: 'failed', openVaultFailureMessage: describePapelizFailureCodeMessage(`Couldn’t make “${newVaultName}”`, 'Not Supported Yet') }
    }
    return makeAndOpenNewPapelizDesktopFolderVault(newVaultParentFolder.desktopParentFolderPath, newVaultName, papelizDesktopPlatform)
  }
  let newFolderVaultFolderResult: PapelizNewFolderVaultFolderResult
  try {
    newFolderVaultFolderResult = await makePapelizNewFolderVaultFolder(newVaultParentFolder.browserParentFolderHandle, newVaultName)
  } catch (newVaultFolderError) {
    return {
      openVaultOutcome: 'failed',
      openVaultFailureMessage: describePapelizFailureMessage(`Couldn’t make “${newVaultName}”`, newVaultFolderError, { failedEntryName: newVaultName, failedEntryKind: 'folder' }),
    }
  }
  if (newFolderVaultFolderResult.newFolderVaultFolderOutcome !== 'ready') {
    return { openVaultOutcome: 'failed', openVaultFailureMessage: describeNewFolderVaultNameTakenMessage(newFolderVaultFolderResult.newFolderVaultFolderOutcome, newVaultName) }
  }
  return openPapelizVaultFolderHandle(newFolderVaultFolderResult.papelizVaultFolderHandle)
}

// New Vault in a folder: the browser's folder window picks where it goes (with permission to change
// it), then the vault's folder is made there, named after the vault, and opened and remembered as any
// folder vault is. Must run from a click. In Papeliz for Windows, Windows' own folder picker picks
// the place, and the folder is made, opened and remembered by its path.
export async function pickPlaceAndOpenNewPapelizFolderVault(newVaultName: string): Promise<PapelizOpenVaultResult> {
  const newVaultParentFolderPickResult = await pickPapelizNewVaultParentFolder()
  if (!('newVaultParentFolderPickOutcome' in newVaultParentFolderPickResult)) return newVaultParentFolderPickResult
  return makeAndOpenNewPapelizFolderVault(newVaultParentFolderPickResult.pickedNewVaultParentFolder, newVaultName)
}

// Reopens a folder from the welcome screen's recent list, asking for permission again if the
// browser no longer has it. Must run from a click. A folder remembered by path opens by its path in
// Papeliz for Windows, where there is no permission to ask for.
export async function reopenRememberedPapelizVaultFolder(rememberedVaultFolder: PapelizRememberedVaultFolder): Promise<PapelizExistingVaultOpenResult> {
  if (!isRememberedDesktopPathVaultFolder(rememberedVaultFolder)) return findPapelizLockedEndToEndVault(await openPapelizVaultFolderHandle(rememberedVaultFolder.papelizVaultFolderHandle))
  const papelizDesktopPlatform = await waitForPapelizDesktopPlatform()
  if (papelizDesktopPlatform === null) {
    return {
      openVaultOutcome: 'failed',
      openVaultFailureMessage: describePapelizFailureCodeMessage(`Couldn’t open “${rememberedVaultFolder.papelizVaultDisplayName}”`, 'Not Supported Yet'),
    }
  }
  return findPapelizLockedEndToEndVault(
    await openPapelizDesktopVaultFolderPath(rememberedVaultFolder.desktopVaultFolderPath, papelizDesktopPlatform, { isDesktopVaultFolderJustPicked: false }),
  )
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

// Windows' folder picker in Papeliz for Windows: the folder's absolute path, or why there is none. It
// is never "chooser-unavailable", since no page can stop the native picker from opening.
async function pickPapelizDesktopFolderPath(
  papelizDesktopPlatform: PapelizDesktopPlatform,
  desktopFolderPickerTitle: string,
): Promise<{ desktopFolderPickOutcome: 'picked'; pickedDesktopFolderPath: string } | PapelizOpenVaultRefusal> {
  try {
    const pickedDesktopFolderPath = await papelizDesktopPlatform.pickDesktopFolderPath(desktopFolderPickerTitle)
    return pickedDesktopFolderPath === null ? { openVaultOutcome: 'cancelled' } : { desktopFolderPickOutcome: 'picked', pickedDesktopFolderPath }
  } catch (desktopFolderPickerError) {
    return { openVaultOutcome: 'failed', openVaultFailureMessage: describePapelizFailureMessage('Couldn’t open the folder', desktopFolderPickerError) }
  }
}

// Open Vault in Papeliz for Windows. Must run from a click.
async function pickAndOpenPapelizDesktopVaultFolder(papelizDesktopPlatform: PapelizDesktopPlatform): Promise<PapelizOpenVaultResult> {
  const desktopFolderPickResult = await pickPapelizDesktopFolderPath(papelizDesktopPlatform, papelizOpenVaultDesktopFolderPickerTitle)
  if (!('desktopFolderPickOutcome' in desktopFolderPickResult)) return desktopFolderPickResult
  return openPapelizDesktopVaultFolderPath(desktopFolderPickResult.pickedDesktopFolderPath, papelizDesktopPlatform, { isDesktopVaultFolderJustPicked: true })
}

// New Vault's folder in Papeliz for Windows, by the browser's rules (makePapelizNewFolderVaultFolder):
// a new folder named after the vault inside the place picked, or an empty one of that name already
// there. A folder there with anything in it, or a file of that name, is refused and left as it was.
export type PapelizNewDesktopFolderVaultFolderResult =
  | { newFolderVaultFolderOutcome: 'ready'; desktopVaultFolderPath: string }
  | { newFolderVaultFolderOutcome: 'folder-not-empty' | 'file-has-the-name' }

export async function makePapelizNewDesktopFolderVaultFolder(
  pickedPlaceDesktopFolderPath: string,
  newVaultName: string,
  desktopFileSystem: PapelizDesktopFileSystem,
): Promise<PapelizNewDesktopFolderVaultFolderResult> {
  const desktopVaultFolderPath = desktopFileSystem.joinDesktopPath(pickedPlaceDesktopFolderPath, newVaultName)
  const existingDesktopEntry = await desktopFileSystem.readDesktopEntry(desktopVaultFolderPath)
  if (existingDesktopEntry !== null) {
    if (!existingDesktopEntry.isDesktopEntryFolder) return { newFolderVaultFolderOutcome: 'file-has-the-name' }
    if ((await desktopFileSystem.listDesktopFolderEntries(desktopVaultFolderPath)).length > 0) return { newFolderVaultFolderOutcome: 'folder-not-empty' }
    return { newFolderVaultFolderOutcome: 'ready', desktopVaultFolderPath }
  }
  await desktopFileSystem.makeDesktopFolder(desktopVaultFolderPath)
  return { newFolderVaultFolderOutcome: 'ready', desktopVaultFolderPath }
}

// New Vault in a folder in Papeliz for Windows. The vault's folder is made inside the place picked (or
// New Vault's starting place), which the native side keeps reachable for this session.
async function makeAndOpenNewPapelizDesktopFolderVault(
  desktopParentFolderPath: string,
  newVaultName: string,
  papelizDesktopPlatform: PapelizDesktopPlatform,
): Promise<PapelizOpenVaultResult> {
  let newFolderVaultFolderResult: PapelizNewDesktopFolderVaultFolderResult
  try {
    newFolderVaultFolderResult = await makePapelizNewDesktopFolderVaultFolder(desktopParentFolderPath, newVaultName, papelizDesktopPlatform.desktopFileSystem)
  } catch (newVaultFolderError) {
    return {
      openVaultOutcome: 'failed',
      openVaultFailureMessage: describePapelizFailureMessage(`Couldn’t make “${newVaultName}”`, newVaultFolderError, { failedEntryName: newVaultName, failedEntryKind: 'folder' }),
    }
  }
  if (newFolderVaultFolderResult.newFolderVaultFolderOutcome !== 'ready') {
    return { openVaultOutcome: 'failed', openVaultFailureMessage: describeNewFolderVaultNameTakenMessage(newFolderVaultFolderResult.newFolderVaultFolderOutcome, newVaultName) }
  }
  return openPapelizDesktopVaultFolderPath(newFolderVaultFolderResult.desktopVaultFolderPath, papelizDesktopPlatform, { isDesktopVaultFolderJustPicked: true })
}

// Opens a folder by its path as a vault in Papeliz for Windows and remembers it for Recent vaults
// (refreshing it when it's there already). A folder no longer at that path fails as a folder the
// browser can't find does. A folder just picked, or just made inside the place picked, is first
// remembered by the native side too, so the app may reach it at every later start; the place picked
// for New Vault never is. If that fails, the vault doesn't open, rather than vanishing next time.
export async function openPapelizDesktopVaultFolderPath(
  desktopVaultFolderPath: string,
  papelizDesktopPlatform: PapelizDesktopPlatform,
  { isDesktopVaultFolderJustPicked }: { isDesktopVaultFolderJustPicked: boolean },
): Promise<PapelizOpenVaultResult> {
  const papelizVaultDisplayName = readDesktopVaultFolderName(desktopVaultFolderPath)
  const { desktopFileSystem } = papelizDesktopPlatform
  try {
    const desktopVaultFolderEntry = await desktopFileSystem.readDesktopEntry(desktopVaultFolderPath)
    if (desktopVaultFolderEntry === null || !desktopVaultFolderEntry.isDesktopEntryFolder) {
      return { openVaultOutcome: 'failed', openVaultFailureMessage: describePapelizFailureCodeMessage(`Couldn’t open “${papelizVaultDisplayName}”`, 'Folder Not Found') }
    }
  } catch (desktopVaultFolderReadError) {
    return { openVaultOutcome: 'failed', openVaultFailureMessage: describePapelizFailureMessage(`Couldn’t open “${papelizVaultDisplayName}”`, desktopVaultFolderReadError) }
  }
  if (isDesktopVaultFolderJustPicked) {
    try {
      await papelizDesktopPlatform.rememberDesktopVaultFolderPath(desktopVaultFolderPath)
    } catch (desktopVaultFolderRememberError) {
      return { openVaultOutcome: 'failed', openVaultFailureMessage: describePapelizFailureMessage(`Couldn’t open “${papelizVaultDisplayName}”`, desktopVaultFolderRememberError) }
    }
  }
  const rememberedVaultFolder = await rememberDesktopVaultFolderPath(desktopVaultFolderPath).catch(() => null)
  return {
    openVaultOutcome: 'opened',
    papelizOpenVault: {
      papelizVaultId: rememberedVaultFolder?.papelizVaultId ?? crypto.randomUUID(),
      papelizVaultDisplayName,
      papelizVaultAdapter: createPapelizDesktopFolderVaultAdapter(desktopVaultFolderPath, desktopFileSystem),
    },
  }
}
