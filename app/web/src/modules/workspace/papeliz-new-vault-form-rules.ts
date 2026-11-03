import type { PapelizSyncVaultEncryptionChoice, PapelizSyncVaultEncryptionKind } from '../sync/papeliz-sync-engine-contract'
import { isPapelizSyncNewPassphraseReady } from '../sync/papeliz-sync-passphrase-fields'
import type { PapelizNewVaultParentFolder } from '../vault/papeliz-open-vault'

// New Vault's rules, apart from its screen so tests can read them: which Sync part it shows, what
// keeps Create Vault off, and the kind of Sync it asks for.

// What sits under Location:
// - `none`: nothing (Use Template's form, which makes its vault its own way);
// - `sync-coming`: a build without Sync: one quiet line saying Sync, and its two kinds, are coming;
// - `sync-choice`: a build with Sync: the "Sync This Vault" switch, and Standard or End-to-end under it.
export type PapelizNewVaultSyncPartKind = 'none' | 'sync-coming' | 'sync-choice'

export function readPapelizNewVaultSyncPartKind(isNewVaultSyncPartShown: boolean, isPapelizSyncInThisBuild: boolean): PapelizNewVaultSyncPartKind {
  if (!isNewVaultSyncPartShown) return 'none'
  return isPapelizSyncInThisBuild ? 'sync-choice' : 'sync-coming'
}

// "Sync This Vault" as it stands: off until the person is signed in to Sync, then on unless they
// switched it off. Standard is the kind picked at first.
export interface PapelizNewVaultSyncChoice {
  isSyncThisVaultOn: boolean
  chosenSyncVaultEncryptionKind: PapelizSyncVaultEncryptionKind
  typedSyncVaultPassphrase: string
  repeatedSyncVaultPassphrase: string
}

export function isPapelizNewVaultSyncThisVaultOn(isSignedInToSync: boolean, syncThisVaultSwitchPick: boolean | null): boolean {
  return isSignedInToSync && (syncThisVaultSwitchPick ?? true)
}

// What Create Vault turns Sync on with once the vault opens, or null when it doesn't sync. End-to-end
// needs its passphrase, 12 characters or more and typed the same twice.
export function readPapelizNewVaultSyncVaultEncryptionChoice(newVaultSyncChoice: PapelizNewVaultSyncChoice): PapelizSyncVaultEncryptionChoice | null {
  if (!newVaultSyncChoice.isSyncThisVaultOn) return null
  if (newVaultSyncChoice.chosenSyncVaultEncryptionKind === 'standard') return { syncVaultEncryptionKind: 'standard' }
  return { syncVaultEncryptionKind: 'end-to-end', syncVaultPassphrase: newVaultSyncChoice.typedSyncVaultPassphrase }
}

// Why Create Vault is off, or null when it can be pressed:
// - `name-problem`: the name can't be the vault's (empty, a blocked character, taken in this browser);
// - `folder-name-taken`: the place picked already has a folder of that name with something in it, or
//   a file of that name;
// - `passphrase-not-ready`: End-to-end, with its passphrase too short or not typed the same twice;
// - `held`: the vault is being made, or Use Template's files aren't read yet.
export type PapelizNewVaultCreateBlock = 'name-problem' | 'folder-name-taken' | 'passphrase-not-ready' | 'held'

export interface PapelizNewVaultCreateState {
  newVaultNameProblem: string | null
  newVaultFolderNameTaken: 'folder-not-empty' | 'file-has-the-name' | null
  newVaultSyncChoice: PapelizNewVaultSyncChoice | null
  isNewVaultConfirmHeld: boolean
}

export function findPapelizNewVaultCreateBlock(newVaultCreateState: PapelizNewVaultCreateState): PapelizNewVaultCreateBlock | null {
  if (newVaultCreateState.newVaultNameProblem !== null) return 'name-problem'
  if (newVaultCreateState.newVaultFolderNameTaken !== null) return 'folder-name-taken'
  const { newVaultSyncChoice } = newVaultCreateState
  if (
    newVaultSyncChoice !== null &&
    newVaultSyncChoice.isSyncThisVaultOn &&
    newVaultSyncChoice.chosenSyncVaultEncryptionKind === 'end-to-end' &&
    !isPapelizSyncNewPassphraseReady(newVaultSyncChoice.typedSyncVaultPassphrase, newVaultSyncChoice.repeatedSyncVaultPassphrase)
  ) {
    return 'passphrase-not-ready'
  }
  return newVaultCreateState.isNewVaultConfirmHeld ? 'held' : null
}

// Where the vault's folder will be, as the Location row shows it: the place, then the vault's name.
// In Papeliz for Windows the place is its whole path; a browser tells Papeliz only the folder's name.
export function describePapelizNewVaultParentFolderPlace(newVaultParentFolder: PapelizNewVaultParentFolder): string {
  if (newVaultParentFolder.newVaultParentFolderKind === 'browser-folder-handle') return `${newVaultParentFolder.browserParentFolderHandle.name} › `
  const desktopParentFolderPath = newVaultParentFolder.desktopParentFolderPath
  return /[\\/]$/.test(desktopParentFolderPath) ? desktopParentFolderPath : `${desktopParentFolderPath}\\`
}

// The folder's name the line under Location names: the place picked's last part.
export function readPapelizNewVaultParentFolderName(newVaultParentFolder: PapelizNewVaultParentFolder): string {
  if (newVaultParentFolder.newVaultParentFolderKind === 'browser-folder-handle') return newVaultParentFolder.browserParentFolderHandle.name
  const desktopParentFolderPath = newVaultParentFolder.desktopParentFolderPath
  return desktopParentFolderPath.split(/[\\/]+/).filter((desktopPathName) => desktopPathName.length > 0).at(-1) ?? desktopParentFolderPath
}
