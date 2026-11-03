import type { PapelizDesktopFileSystem, PapelizDesktopPlatform } from '../desktop/papeliz-desktop-platform-contract'
import { createPapelizDesktopFolderVaultAdapter } from './papeliz-desktop-folder-vault-adapter'
import { describePapelizFailureCodeMessage, describePapelizFailureMessage } from './papeliz-failure-code-words'
import { describePapelizFolderAccessOffReason } from './papeliz-folder-access-support'
import { PapelizFolderOnDiskVaultAdapter } from './papeliz-folder-on-disk-vault-adapter'
import { PapelizInMemoryVaultAdapter } from './papeliz-in-memory-vault-adapter'
import { PapelizVaultOperationError, type PapelizVaultAdapter } from './papeliz-vault-adapter'
import {
  ensureVaultFolderPermission,
  isFolderOnDiskVaultSupported,
  isRememberedDesktopPathVaultFolder,
  readDesktopVaultFolderName,
  rememberDesktopVaultFolderPath,
  rememberVaultFolder,
  renameRememberedVaultFolder,
  waitForPapelizDesktopPlatform,
  type PapelizRememberedVaultFolder,
} from './papeliz-remembered-vault-folders'
import { papelizSampleVaultDisplayName, papelizSampleVaultNotes } from './papeliz-sample-vault-notes'
import { findPapelizLockedEndToEndVault, type PapelizLockedEndToEndVault } from './papeliz-vault-encryption'
import {
  choosePapelizFolderVaultDisplayName,
  findPapelizVaultOwnNameProblem,
  readPapelizFolderVaultOwnNameBeforeUnlock,
  writePapelizVaultOwnName,
} from './papeliz-vault-own-name'
import { describeVaultEntryNameProblem, papelizVaultSettingsFolderName } from './papeliz-vault-relative-paths'

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

// Why a name typed for a new folder vault's folder can't be a folder's name, as a code ("Name Empty",
// "Has A Blocked Character", ...), or null when it can. Whether the place picked already has that
// name is known only once it is picked.
export function findPapelizNewFolderVaultNameProblem(typedNewVaultFolderName: string): string | null {
  return describeVaultEntryNameProblem(typedNewVaultFolderName)
}

// The longest folder name findPapelizNewFolderVaultNameProblem allows.
const papelizNewVaultFolderNameLongestLength = 200
// What a vault name with nothing a folder can use makes.
const papelizNewVaultFolderNameFallback = 'Vault'

// A character no folder name can hold on Windows, macOS or Linux, or a control character.
function isCharacterBlockedInFolderName(vaultNameCharacter: string): boolean {
  const characterCode = vaultNameCharacter.charCodeAt(0)
  return '\\/:*?"<>|'.includes(vaultNameCharacter) || characterCode < 0x20 || characterCode === 0x7f
}

// A character a folder's name can't start or end with: one it can't hold at all, a dot or a space.
function isCharacterBlockedAtFolderNameEdge(vaultNameCharacter: string): boolean {
  return isCharacterBlockedInFolderName(vaultNameCharacter) || vaultNameCharacter === '.' || vaultNameCharacter.trim() === ''
}

// New Vault's folder name while it follows the vault's name: the name without what a folder's name
// can't start or end with, each character inside it a folder can't hold made a hyphen (as exports name
// their files), cut to a folder name's length. "Work/Home" makes "Work-Home", "What next?" makes "What
// next", and a name with nothing left makes "Vault".
export function makePapelizNewVaultFolderNameFromVaultName(newVaultName: string): string {
  const vaultNameCharacters = [...newVaultName]
  let firstKeptCharacterIndex = 0
  let afterLastKeptCharacterIndex = vaultNameCharacters.length
  while (firstKeptCharacterIndex < afterLastKeptCharacterIndex && isCharacterBlockedAtFolderNameEdge(vaultNameCharacters[firstKeptCharacterIndex]!)) firstKeptCharacterIndex += 1
  while (afterLastKeptCharacterIndex > firstKeptCharacterIndex && isCharacterBlockedAtFolderNameEdge(vaultNameCharacters[afterLastKeptCharacterIndex - 1]!)) afterLastKeptCharacterIndex -= 1
  const newVaultFolderName = vaultNameCharacters
    .slice(firstKeptCharacterIndex, afterLastKeptCharacterIndex)
    .map((vaultNameCharacter) => (isCharacterBlockedInFolderName(vaultNameCharacter) ? '-' : vaultNameCharacter))
    .join('')
    .slice(0, papelizNewVaultFolderNameLongestLength)
    .replace(/[.\s]+$/, '')
  return newVaultFolderName.length > 0 ? newVaultFolderName : papelizNewVaultFolderNameFallback
}

// What already has New Vault's folder name in the place picked: a Papeliz vault (a folder with its own
// `.papeliz/`), another folder with something in it, or a file. An empty folder of that name isn't in
// the way: the vault is made in it, and nothing is overwritten or merged.
export type PapelizNewVaultFolderNameTaken = 'folder-is-a-vault' | 'folder-not-empty' | 'file-has-the-name'

// New Vault's folder, inside the folder picked: a new folder of the name chosen, or an empty one of
// that name already there. A folder there with anything in it is refused, since opening one that holds
// notes is Open Vault's job, and so is a file of that name.
export type PapelizNewFolderVaultFolderResult =
  | { newFolderVaultFolderOutcome: 'ready'; papelizVaultFolderHandle: FileSystemDirectoryHandle }
  | { newFolderVaultFolderOutcome: 'folder-not-empty' | 'file-has-the-name' }

// Why New Vault's folder couldn't be used: the name is taken in the place picked.
export function describeNewFolderVaultNameTakenMessage(newVaultFolderNameTaken: PapelizNewVaultFolderNameTaken, newVaultFolderName: string): string {
  if (newVaultFolderNameTaken === 'folder-is-a-vault') return `The folder “${newVaultFolderName}” there is already a Papeliz vault. Pick another name or another place.`
  const takenNameEntryKind = newVaultFolderNameTaken === 'folder-not-empty' ? 'folder' : 'file'
  return `A ${takenNameEntryKind} named “${newVaultFolderName}” is already there. Pick another name or another place.`
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
// rule: a folder of that name with anything in it (a Papeliz vault, or another folder), or a file of
// that name. Null when it is free, or when the place can't be read, so the check never refuses what
// Create Vault would make.
export async function findPapelizNewVaultFolderNameTaken(
  newVaultParentFolder: PapelizNewVaultParentFolder,
  newVaultFolderName: string,
): Promise<PapelizNewVaultFolderNameTaken | null> {
  try {
    if (newVaultParentFolder.newVaultParentFolderKind === 'desktop-folder-path') {
      const papelizDesktopPlatform = await waitForPapelizDesktopPlatform()
      if (papelizDesktopPlatform === null) return null
      const { desktopFileSystem } = papelizDesktopPlatform
      const desktopVaultFolderPath = desktopFileSystem.joinDesktopPath(newVaultParentFolder.desktopParentFolderPath, newVaultFolderName)
      const existingDesktopEntry = await desktopFileSystem.readDesktopEntry(desktopVaultFolderPath)
      if (existingDesktopEntry === null) return null
      if (!existingDesktopEntry.isDesktopEntryFolder) return 'file-has-the-name'
      const existingVaultSettingsEntry = await desktopFileSystem.readDesktopEntry(desktopFileSystem.joinDesktopPath(desktopVaultFolderPath, papelizVaultSettingsFolderName))
      if (existingVaultSettingsEntry?.isDesktopEntryFolder === true) return 'folder-is-a-vault'
      return (await desktopFileSystem.listDesktopFolderEntries(desktopVaultFolderPath)).length > 0 ? 'folder-not-empty' : null
    }
    let existingVaultFolderHandle: FileSystemDirectoryHandle
    try {
      existingVaultFolderHandle = await newVaultParentFolder.browserParentFolderHandle.getDirectoryHandle(newVaultFolderName)
    } catch (existingFolderError) {
      return existingFolderError instanceof DOMException && existingFolderError.name === 'TypeMismatchError' ? 'file-has-the-name' : null
    }
    const isExistingFolderAVault = await existingVaultFolderHandle.getDirectoryHandle(papelizVaultSettingsFolderName).then(
      () => true,
      () => false,
    )
    if (isExistingFolderAVault) return 'folder-is-a-vault'
    for await (const _existingFolderEntryName of existingVaultFolderHandle.keys()) return 'folder-not-empty'
    return null
  } catch {
    return null
  }
}

// How many numbered names New Vault tries for a folder name that is taken.
const papelizNewVaultFreeFolderNameTryCount = 99

// New Vault's one-press fix for a folder name that is taken in the place picked: the next numbered name
// that isn't ("My Notes 2", then "My Notes 3", ...; "My Notes 2" goes on to "My Notes 3"). Null when none
// of them is free.
export async function findPapelizNewVaultFreeFolderName(newVaultParentFolder: PapelizNewVaultParentFolder, takenNewVaultFolderName: string): Promise<string | null> {
  const numberedFolderNameMatch = /^(.*\S) (\d+)$/.exec(takenNewVaultFolderName.trim())
  const freeFolderNameStem = numberedFolderNameMatch?.[1] ?? takenNewVaultFolderName.trim()
  const firstFreeFolderNameNumber = numberedFolderNameMatch === null ? 2 : Number(numberedFolderNameMatch[2]) + 1
  for (let freeFolderNameNumber = firstFreeFolderNameNumber; freeFolderNameNumber < firstFreeFolderNameNumber + papelizNewVaultFreeFolderNameTryCount; freeFolderNameNumber += 1) {
    const freeFolderNameNumberSuffix = ` ${freeFolderNameNumber}`
    const candidateFolderName = `${freeFolderNameStem.slice(0, papelizNewVaultFolderNameLongestLength - freeFolderNameNumberSuffix.length).trimEnd()}${freeFolderNameNumberSuffix}`
    if ((await findPapelizNewVaultFolderNameTaken(newVaultParentFolder, candidateFolderName)) === null) return candidateFolderName
  }
  return null
}

// New Vault's Open It, when its folder name is already a Papeliz vault in the place picked: that vault
// opens as Open Vault opens one (an End-to-end vault asks for its passphrase), and nothing in it
// changes.
export async function openPapelizExistingFolderVaultInNewVaultPlace(
  newVaultParentFolder: PapelizNewVaultParentFolder,
  existingVaultFolderName: string,
): Promise<PapelizExistingVaultOpenResult> {
  if (newVaultParentFolder.newVaultParentFolderKind === 'desktop-folder-path') {
    const papelizDesktopPlatform = await waitForPapelizDesktopPlatform()
    if (papelizDesktopPlatform === null) {
      return { openVaultOutcome: 'failed', openVaultFailureMessage: describePapelizFailureCodeMessage(`Couldn’t open “${existingVaultFolderName}”`, 'Not Supported Yet') }
    }
    const existingDesktopVaultFolderPath = papelizDesktopPlatform.desktopFileSystem.joinDesktopPath(newVaultParentFolder.desktopParentFolderPath, existingVaultFolderName)
    return findPapelizLockedEndToEndVault(await openPapelizDesktopVaultFolderPath(existingDesktopVaultFolderPath, papelizDesktopPlatform, { isDesktopVaultFolderJustPicked: true }))
  }
  let existingVaultFolderHandle: FileSystemDirectoryHandle
  try {
    existingVaultFolderHandle = await newVaultParentFolder.browserParentFolderHandle.getDirectoryHandle(existingVaultFolderName)
  } catch (existingVaultFolderError) {
    return {
      openVaultOutcome: 'failed',
      openVaultFailureMessage: describePapelizFailureMessage(`Couldn’t open “${existingVaultFolderName}”`, existingVaultFolderError, {
        failedEntryName: existingVaultFolderName,
        failedEntryKind: 'folder',
      }),
    }
  }
  return findPapelizLockedEndToEndVault(await openPapelizVaultFolderHandle(existingVaultFolderHandle))
}

// New Vault's folder, made in the place picked under the folder name chosen, and opened and remembered
// as any folder vault is. The vault's own name is saved in it, whatever the folder is called.
export async function makeAndOpenNewPapelizFolderVault(
  newVaultParentFolder: PapelizNewVaultParentFolder,
  newVaultFolderName: string,
  newVaultName: string = newVaultFolderName,
): Promise<PapelizOpenVaultResult> {
  if (newVaultParentFolder.newVaultParentFolderKind === 'desktop-folder-path') {
    const papelizDesktopPlatform = await waitForPapelizDesktopPlatform()
    if (papelizDesktopPlatform === null) {
      return { openVaultOutcome: 'failed', openVaultFailureMessage: describePapelizFailureCodeMessage(`Couldn’t make “${newVaultName}”`, 'Not Supported Yet') }
    }
    return makeAndOpenNewPapelizDesktopFolderVault(newVaultParentFolder.desktopParentFolderPath, newVaultFolderName, newVaultName, papelizDesktopPlatform)
  }
  let newFolderVaultFolderResult: PapelizNewFolderVaultFolderResult
  try {
    newFolderVaultFolderResult = await makePapelizNewFolderVaultFolder(newVaultParentFolder.browserParentFolderHandle, newVaultFolderName)
  } catch (newVaultFolderError) {
    return {
      openVaultOutcome: 'failed',
      openVaultFailureMessage: describePapelizFailureMessage(`Couldn’t make “${newVaultName}”`, newVaultFolderError, { failedEntryName: newVaultFolderName, failedEntryKind: 'folder' }),
    }
  }
  if (newFolderVaultFolderResult.newFolderVaultFolderOutcome !== 'ready') {
    return { openVaultOutcome: 'failed', openVaultFailureMessage: describeNewFolderVaultNameTakenMessage(newFolderVaultFolderResult.newFolderVaultFolderOutcome, newVaultFolderName) }
  }
  await writePapelizNewBrowserFolderVaultOwnName(newFolderVaultFolderResult.papelizVaultFolderHandle, newVaultName)
  return openPapelizVaultFolderHandle(newFolderVaultFolderResult.papelizVaultFolderHandle)
}

// A folder vault just made (New Vault, Use Template) keeps the name typed for it as its own, so the
// name stays when the folder is renamed. Saved before it opens, so it opens with it. Unsaved, the vault
// shows its folder's name, which a template's folder shares; nothing else fails for it.
export async function writePapelizNewBrowserFolderVaultOwnName(newVaultFolderHandle: FileSystemDirectoryHandle, newVaultName: string): Promise<void> {
  await writePapelizVaultOwnName(new PapelizFolderOnDiskVaultAdapter(newVaultFolderHandle), newVaultName).catch(() => undefined)
}

// The same for a folder made by its path in Papeliz for Windows.
export async function writePapelizNewDesktopFolderVaultOwnName(
  newDesktopVaultFolderPath: string,
  desktopFileSystem: PapelizDesktopFileSystem,
  newVaultName: string,
): Promise<void> {
  await writePapelizVaultOwnName(createPapelizDesktopFolderVaultAdapter(newDesktopVaultFolderPath, desktopFileSystem), newVaultName).catch(() => undefined)
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
  const folderVaultAdapter = new PapelizFolderOnDiskVaultAdapter(papelizVaultFolderHandle)
  const folderVaultOwnNameRead = await readPapelizFolderVaultOwnNameBeforeUnlock(folderVaultAdapter)
  const rememberedVaultFolder = await rememberVaultFolder(papelizVaultFolderHandle, folderVaultOwnNameRead).catch(() => null)
  return {
    openVaultOutcome: 'opened',
    papelizOpenVault: {
      papelizVaultId: rememberedVaultFolder?.papelizVaultId ?? crypto.randomUUID(),
      papelizVaultDisplayName: rememberedVaultFolder?.papelizVaultDisplayName ?? choosePapelizFolderVaultDisplayName(folderVaultOwnNameRead, papelizVaultFolderHandle.name, undefined),
      papelizVaultAdapter: folderVaultAdapter,
    },
  }
}

// Settings › Vault's Rename for a folder vault: the name is saved in the vault (sealed with its files
// when it is End-to-end), and Recent Vaults shows it. The folder on disk keeps its own name. Fails with
// the name's problem ("Name Empty", ...) or the write's. Gives back the name saved.
export async function renameOpenPapelizFolderVault(papelizOpenVault: PapelizOpenVault, typedVaultOwnName: string): Promise<string> {
  if (papelizOpenVault.papelizVaultAdapter.papelizVaultKind !== 'folder-on-disk') throw new PapelizVaultOperationError('Not Supported Yet')
  const vaultOwnNameProblem = findPapelizVaultOwnNameProblem(typedVaultOwnName)
  if (vaultOwnNameProblem !== null) throw new PapelizVaultOperationError(vaultOwnNameProblem)
  const papelizVaultOwnName = typedVaultOwnName.trim()
  await writePapelizVaultOwnName(papelizOpenVault.papelizVaultAdapter, papelizVaultOwnName)
  await renameRememberedVaultFolder(papelizOpenVault.papelizVaultId, papelizVaultOwnName).catch(() => null)
  return papelizVaultOwnName
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
  newVaultFolderName: string,
  newVaultName: string,
  papelizDesktopPlatform: PapelizDesktopPlatform,
): Promise<PapelizOpenVaultResult> {
  let newFolderVaultFolderResult: PapelizNewDesktopFolderVaultFolderResult
  try {
    newFolderVaultFolderResult = await makePapelizNewDesktopFolderVaultFolder(desktopParentFolderPath, newVaultFolderName, papelizDesktopPlatform.desktopFileSystem)
  } catch (newVaultFolderError) {
    return {
      openVaultOutcome: 'failed',
      openVaultFailureMessage: describePapelizFailureMessage(`Couldn’t make “${newVaultName}”`, newVaultFolderError, { failedEntryName: newVaultFolderName, failedEntryKind: 'folder' }),
    }
  }
  if (newFolderVaultFolderResult.newFolderVaultFolderOutcome !== 'ready') {
    return { openVaultOutcome: 'failed', openVaultFailureMessage: describeNewFolderVaultNameTakenMessage(newFolderVaultFolderResult.newFolderVaultFolderOutcome, newVaultFolderName) }
  }
  await writePapelizNewDesktopFolderVaultOwnName(newFolderVaultFolderResult.desktopVaultFolderPath, papelizDesktopPlatform.desktopFileSystem, newVaultName)
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
  // The folder's name, for what goes wrong before the vault's own name is read.
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
  const desktopVaultFolderAdapter = createPapelizDesktopFolderVaultAdapter(desktopVaultFolderPath, desktopFileSystem)
  const folderVaultOwnNameRead = await readPapelizFolderVaultOwnNameBeforeUnlock(desktopVaultFolderAdapter)
  const rememberedVaultFolder = await rememberDesktopVaultFolderPath(desktopVaultFolderPath, folderVaultOwnNameRead).catch(() => null)
  return {
    openVaultOutcome: 'opened',
    papelizOpenVault: {
      papelizVaultId: rememberedVaultFolder?.papelizVaultId ?? crypto.randomUUID(),
      papelizVaultDisplayName: rememberedVaultFolder?.papelizVaultDisplayName ?? choosePapelizFolderVaultDisplayName(folderVaultOwnNameRead, papelizVaultDisplayName, undefined),
      papelizVaultAdapter: desktopVaultFolderAdapter,
    },
  }
}
