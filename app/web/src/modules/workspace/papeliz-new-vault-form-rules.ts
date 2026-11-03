import type { PapelizSyncVaultEncryptionChoice } from '../sync/papeliz-sync-engine-contract'
import { isPapelizSyncNewPassphraseReady } from '../sync/papeliz-sync-passphrase-fields'
import type { PapelizNewVaultParentFolder } from '../vault/papeliz-open-vault'
import type { PapelizVaultEncryptionKind } from '../vault/papeliz-vault-encryption'

// New Vault's rules, apart from its screen so tests can read them: which parts it shows, what keeps
// Create Vault off, and the encryption and Sync it asks for.

// What sits under Location:
// - `none`: nothing (Use Template's form, which always makes a Standard vault);
// - `encryption`: Standard or End-to-end, in every build;
// - `encryption-and-sync-switch`: a build with Sync adds "Sync This Vault", which syncs the vault with
//   the kind picked above it.
export type PapelizNewVaultPartsKind = 'none' | 'encryption' | 'encryption-and-sync-switch'

export function readPapelizNewVaultPartsKind(areNewVaultEncryptionAndSyncPartsShown: boolean, isPapelizSyncInThisBuild: boolean): PapelizNewVaultPartsKind {
  if (!areNewVaultEncryptionAndSyncPartsShown) return 'none'
  return isPapelizSyncInThisBuild ? 'encryption-and-sync-switch' : 'encryption'
}

// The Encryption part as it stands. Standard is picked first; End-to-end asks its passphrase in place.
export interface PapelizNewVaultEncryptionPick {
  chosenNewVaultEncryptionKind: PapelizVaultEncryptionKind
  typedNewVaultPassphrase: string
  repeatedNewVaultPassphrase: string
}

// What Create Vault makes: a Standard vault, or an End-to-end one with its passphrase.
export type PapelizNewVaultEncryptionChoice =
  | { newVaultEncryptionKind: 'standard' }
  | { newVaultEncryptionKind: 'end-to-end'; newEndToEndVaultPassphrase: string }

export function readPapelizNewVaultEncryptionChoice(newVaultEncryptionPick: PapelizNewVaultEncryptionPick | null): PapelizNewVaultEncryptionChoice {
  if (newVaultEncryptionPick === null || newVaultEncryptionPick.chosenNewVaultEncryptionKind === 'standard') return { newVaultEncryptionKind: 'standard' }
  return { newVaultEncryptionKind: 'end-to-end', newEndToEndVaultPassphrase: newVaultEncryptionPick.typedNewVaultPassphrase }
}

// "Sync This Vault": off until the person is signed in to Sync, then on unless they switched it off.
// Sync carries only a Standard vault in this version, so End-to-end keeps it off.
export function isPapelizNewVaultSyncThisVaultOn(isSignedInToSync: boolean, syncThisVaultSwitchPick: boolean | null, chosenNewVaultEncryptionKind: PapelizVaultEncryptionKind): boolean {
  return canPapelizSyncCarryNewVault(chosenNewVaultEncryptionKind) && isSignedInToSync && (syncThisVaultSwitchPick ?? true)
}

export function canPapelizSyncCarryNewVault(chosenNewVaultEncryptionKind: PapelizVaultEncryptionKind): boolean {
  return chosenNewVaultEncryptionKind === 'standard'
}

// What Create Vault turns Sync on with once the vault opens, or null when it doesn't sync: the kind
// picked under Encryption, End-to-end with the vault's own passphrase.
export function readPapelizNewVaultSyncVaultEncryptionChoice(isSyncThisVaultOn: boolean, newVaultEncryptionChoice: PapelizNewVaultEncryptionChoice): PapelizSyncVaultEncryptionChoice | null {
  if (!isSyncThisVaultOn) return null
  if (newVaultEncryptionChoice.newVaultEncryptionKind === 'standard') return { syncVaultEncryptionKind: 'standard' }
  return { syncVaultEncryptionKind: 'end-to-end', syncVaultPassphrase: newVaultEncryptionChoice.newEndToEndVaultPassphrase }
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
  newVaultEncryptionPick: PapelizNewVaultEncryptionPick | null
  isNewVaultConfirmHeld: boolean
}

export function findPapelizNewVaultCreateBlock(newVaultCreateState: PapelizNewVaultCreateState): PapelizNewVaultCreateBlock | null {
  if (newVaultCreateState.newVaultNameProblem !== null) return 'name-problem'
  if (newVaultCreateState.newVaultFolderNameTaken !== null) return 'folder-name-taken'
  const { newVaultEncryptionPick } = newVaultCreateState
  if (
    newVaultEncryptionPick !== null &&
    newVaultEncryptionPick.chosenNewVaultEncryptionKind === 'end-to-end' &&
    !isPapelizSyncNewPassphraseReady(newVaultEncryptionPick.typedNewVaultPassphrase, newVaultEncryptionPick.repeatedNewVaultPassphrase)
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
