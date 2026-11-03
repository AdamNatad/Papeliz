import { describe, expect, it } from 'vitest'
import {
  canPapelizSyncCarryNewVault,
  describePapelizNewVaultParentFolderPlace,
  findPapelizNewVaultCreateBlock,
  isPapelizNewVaultSyncThisVaultOn,
  readPapelizNewVaultEncryptionChoice,
  readPapelizNewVaultParentFolderName,
  readPapelizNewVaultPartsKind,
  readPapelizNewVaultSyncVaultEncryptionChoice,
  type PapelizNewVaultCreateState,
  type PapelizNewVaultEncryptionPick,
} from './papeliz-new-vault-form-rules'

// New Vault's rules: the parts each build shows (Encryption in every build, "Sync This Vault" where
// Sync is), Create Vault's gate (the name, the folder taken in the place picked, End-to-end's
// passphrase), what the vault is made with and Sync turned on with, and how the place reads.

const standardEncryptionPick: PapelizNewVaultEncryptionPick = {
  chosenNewVaultEncryptionKind: 'standard',
  typedNewVaultPassphrase: '',
  repeatedNewVaultPassphrase: '',
}
const endToEndEncryptionPick: PapelizNewVaultEncryptionPick = {
  chosenNewVaultEncryptionKind: 'end-to-end',
  typedNewVaultPassphrase: 'correct horse battery',
  repeatedNewVaultPassphrase: 'correct horse battery',
}

const readyCreateState: PapelizNewVaultCreateState = {
  newVaultNameProblem: null,
  newVaultFolderNameTaken: null,
  newVaultEncryptionPick: null,
  isNewVaultConfirmHeld: false,
}

describe('New Vault’s parts under Location', () => {
  it('asks Standard or End-to-end in every build, adds "Sync This Vault" where Sync is, and shows neither in Use Template’s form', () => {
    expect(readPapelizNewVaultPartsKind(true, false)).toBe('encryption')
    expect(readPapelizNewVaultPartsKind(true, true)).toBe('encryption-and-sync-switch')
    expect(readPapelizNewVaultPartsKind(false, true)).toBe('none')
    expect(readPapelizNewVaultPartsKind(false, false)).toBe('none')
  })

  it('makes a Standard vault, or an End-to-end one with its passphrase; Use Template’s form makes a Standard one', () => {
    expect(readPapelizNewVaultEncryptionChoice(standardEncryptionPick)).toEqual({ newVaultEncryptionKind: 'standard' })
    expect(readPapelizNewVaultEncryptionChoice(endToEndEncryptionPick)).toEqual({ newVaultEncryptionKind: 'end-to-end', newEndToEndVaultPassphrase: 'correct horse battery' })
    expect(readPapelizNewVaultEncryptionChoice(null)).toEqual({ newVaultEncryptionKind: 'standard' })
  })

  it('has "Sync This Vault" off while signed out, on once signed in, and off when switched off', () => {
    expect(isPapelizNewVaultSyncThisVaultOn(false, null, 'standard')).toBe(false)
    expect(isPapelizNewVaultSyncThisVaultOn(false, true, 'standard')).toBe(false)
    expect(isPapelizNewVaultSyncThisVaultOn(true, null, 'standard')).toBe(true)
    expect(isPapelizNewVaultSyncThisVaultOn(true, false, 'standard')).toBe(false)
  })

  it('keeps "Sync This Vault" off for End-to-end, which Sync doesn’t carry yet', () => {
    expect(canPapelizSyncCarryNewVault('standard')).toBe(true)
    expect(canPapelizSyncCarryNewVault('end-to-end')).toBe(false)
    expect(isPapelizNewVaultSyncThisVaultOn(true, null, 'end-to-end')).toBe(false)
    expect(isPapelizNewVaultSyncThisVaultOn(true, true, 'end-to-end')).toBe(false)
  })

  it('turns Sync on with the kind picked under Encryption, End-to-end with the vault’s passphrase, or not at all', () => {
    expect(readPapelizNewVaultSyncVaultEncryptionChoice(true, { newVaultEncryptionKind: 'standard' })).toEqual({ syncVaultEncryptionKind: 'standard' })
    expect(readPapelizNewVaultSyncVaultEncryptionChoice(true, { newVaultEncryptionKind: 'end-to-end', newEndToEndVaultPassphrase: 'correct horse battery' })).toEqual({
      syncVaultEncryptionKind: 'end-to-end',
      syncVaultPassphrase: 'correct horse battery',
    })
    expect(readPapelizNewVaultSyncVaultEncryptionChoice(false, { newVaultEncryptionKind: 'end-to-end', newEndToEndVaultPassphrase: 'correct horse battery' })).toBeNull()
  })
})

describe('Create Vault', () => {
  it('can be pressed with a usable name and nothing else in the way', () => {
    expect(findPapelizNewVaultCreateBlock(readyCreateState)).toBeNull()
    expect(findPapelizNewVaultCreateBlock({ ...readyCreateState, newVaultEncryptionPick: standardEncryptionPick })).toBeNull()
  })

  it('stays off for an empty or unusable name', () => {
    expect(findPapelizNewVaultCreateBlock({ ...readyCreateState, newVaultNameProblem: 'Name Empty' })).toBe('name-problem')
  })

  it('stays off when the place picked already has a folder of that name with notes, or a file of that name', () => {
    expect(findPapelizNewVaultCreateBlock({ ...readyCreateState, newVaultFolderNameTaken: 'folder-not-empty' })).toBe('folder-name-taken')
    expect(findPapelizNewVaultCreateBlock({ ...readyCreateState, newVaultFolderNameTaken: 'file-has-the-name' })).toBe('folder-name-taken')
  })

  it('waits for End-to-end’s passphrase, with or without Sync: 12 characters or more, typed the same twice', () => {
    const withEndToEndPick = (typedNewVaultPassphrase: string, repeatedNewVaultPassphrase: string) =>
      findPapelizNewVaultCreateBlock({ ...readyCreateState, newVaultEncryptionPick: { ...endToEndEncryptionPick, typedNewVaultPassphrase, repeatedNewVaultPassphrase } })
    expect(withEndToEndPick('', '')).toBe('passphrase-not-ready')
    expect(withEndToEndPick('too short', 'too short')).toBe('passphrase-not-ready')
    expect(withEndToEndPick('correct horse battery', 'correct horse batter')).toBe('passphrase-not-ready')
    expect(withEndToEndPick('correct horse battery', 'correct horse battery')).toBeNull()
    // Standard asks no passphrase.
    expect(findPapelizNewVaultCreateBlock({ ...readyCreateState, newVaultEncryptionPick: { ...standardEncryptionPick, typedNewVaultPassphrase: 'short' } })).toBeNull()
  })

  it('stays off while the vault is being made', () => {
    expect(findPapelizNewVaultCreateBlock({ ...readyCreateState, isNewVaultConfirmHeld: true })).toBe('held')
  })
})

describe('where the vault’s folder goes', () => {
  it('reads as the whole path in Papeliz for Windows, ending with a separator before the name', () => {
    const desktopParentFolder = { newVaultParentFolderKind: 'desktop-folder-path' as const, desktopParentFolderPath: 'C:\\Users\\Ada\\Documents\\Papeliz' }
    expect(describePapelizNewVaultParentFolderPlace(desktopParentFolder)).toBe('C:\\Users\\Ada\\Documents\\Papeliz\\')
    expect(describePapelizNewVaultParentFolderPlace({ ...desktopParentFolder, desktopParentFolderPath: 'D:\\' })).toBe('D:\\')
    expect(readPapelizNewVaultParentFolderName(desktopParentFolder)).toBe('Papeliz')
  })

  it('reads as the folder’s name in a browser, which gives Papeliz no path', () => {
    const browserParentFolder = { newVaultParentFolderKind: 'browser-folder-handle' as const, browserParentFolderHandle: { name: 'Vaults' } as FileSystemDirectoryHandle }
    expect(describePapelizNewVaultParentFolderPlace(browserParentFolder)).toBe('Vaults › ')
    expect(readPapelizNewVaultParentFolderName(browserParentFolder)).toBe('Vaults')
  })
})
