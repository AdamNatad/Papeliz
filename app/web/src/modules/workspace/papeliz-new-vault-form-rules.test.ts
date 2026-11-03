import { describe, expect, it } from 'vitest'
import {
  describePapelizNewVaultParentFolderPlace,
  findPapelizNewVaultCreateBlock,
  isPapelizNewVaultSyncThisVaultOn,
  readPapelizNewVaultParentFolderName,
  readPapelizNewVaultSyncPartKind,
  readPapelizNewVaultSyncVaultEncryptionChoice,
  type PapelizNewVaultCreateState,
  type PapelizNewVaultSyncChoice,
} from './papeliz-new-vault-form-rules'

// New Vault's rules: the Sync part each build shows, Create Vault's gate (the name, the folder taken
// in the place picked, End-to-end's passphrase), the kind Sync is turned on with, and how the place
// reads.

const standardSyncChoice: PapelizNewVaultSyncChoice = {
  isSyncThisVaultOn: true,
  chosenSyncVaultEncryptionKind: 'standard',
  typedSyncVaultPassphrase: '',
  repeatedSyncVaultPassphrase: '',
}

const readyCreateState: PapelizNewVaultCreateState = {
  newVaultNameProblem: null,
  newVaultFolderNameTaken: null,
  newVaultSyncChoice: null,
  isNewVaultConfirmHeld: false,
}

describe('New Vault’s Sync part', () => {
  it('is a quiet line in a build without Sync, the switch and kinds in a build with it, and nothing in Use Template’s form', () => {
    expect(readPapelizNewVaultSyncPartKind(true, false)).toBe('sync-coming')
    expect(readPapelizNewVaultSyncPartKind(true, true)).toBe('sync-choice')
    expect(readPapelizNewVaultSyncPartKind(false, true)).toBe('none')
    expect(readPapelizNewVaultSyncPartKind(false, false)).toBe('none')
  })

  it('has "Sync This Vault" off while signed out, on once signed in, and off when switched off', () => {
    expect(isPapelizNewVaultSyncThisVaultOn(false, null)).toBe(false)
    expect(isPapelizNewVaultSyncThisVaultOn(false, true)).toBe(false)
    expect(isPapelizNewVaultSyncThisVaultOn(true, null)).toBe(true)
    expect(isPapelizNewVaultSyncThisVaultOn(true, false)).toBe(false)
  })

  it('turns Sync on with Standard, End-to-end and its passphrase, or not at all', () => {
    expect(readPapelizNewVaultSyncVaultEncryptionChoice(standardSyncChoice)).toEqual({ syncVaultEncryptionKind: 'standard' })
    expect(
      readPapelizNewVaultSyncVaultEncryptionChoice({
        ...standardSyncChoice,
        chosenSyncVaultEncryptionKind: 'end-to-end',
        typedSyncVaultPassphrase: 'correct horse battery',
        repeatedSyncVaultPassphrase: 'correct horse battery',
      }),
    ).toEqual({ syncVaultEncryptionKind: 'end-to-end', syncVaultPassphrase: 'correct horse battery' })
    expect(readPapelizNewVaultSyncVaultEncryptionChoice({ ...standardSyncChoice, isSyncThisVaultOn: false })).toBeNull()
  })
})

describe('Create Vault', () => {
  it('can be pressed with a usable name and nothing else in the way', () => {
    expect(findPapelizNewVaultCreateBlock(readyCreateState)).toBeNull()
    expect(findPapelizNewVaultCreateBlock({ ...readyCreateState, newVaultSyncChoice: standardSyncChoice })).toBeNull()
  })

  it('stays off for an empty or unusable name', () => {
    expect(findPapelizNewVaultCreateBlock({ ...readyCreateState, newVaultNameProblem: 'Name Empty' })).toBe('name-problem')
  })

  it('stays off when the place picked already has a folder of that name with notes, or a file of that name', () => {
    expect(findPapelizNewVaultCreateBlock({ ...readyCreateState, newVaultFolderNameTaken: 'folder-not-empty' })).toBe('folder-name-taken')
    expect(findPapelizNewVaultCreateBlock({ ...readyCreateState, newVaultFolderNameTaken: 'file-has-the-name' })).toBe('folder-name-taken')
  })

  it('waits for End-to-end’s passphrase: 12 characters or more, typed the same twice', () => {
    const endToEndSyncChoice = { ...standardSyncChoice, chosenSyncVaultEncryptionKind: 'end-to-end' as const }
    expect(findPapelizNewVaultCreateBlock({ ...readyCreateState, newVaultSyncChoice: endToEndSyncChoice })).toBe('passphrase-not-ready')
    expect(
      findPapelizNewVaultCreateBlock({
        ...readyCreateState,
        newVaultSyncChoice: { ...endToEndSyncChoice, typedSyncVaultPassphrase: 'too short', repeatedSyncVaultPassphrase: 'too short' },
      }),
    ).toBe('passphrase-not-ready')
    expect(
      findPapelizNewVaultCreateBlock({
        ...readyCreateState,
        newVaultSyncChoice: { ...endToEndSyncChoice, typedSyncVaultPassphrase: 'correct horse battery', repeatedSyncVaultPassphrase: 'correct horse batter' },
      }),
    ).toBe('passphrase-not-ready')
    expect(
      findPapelizNewVaultCreateBlock({
        ...readyCreateState,
        newVaultSyncChoice: { ...endToEndSyncChoice, typedSyncVaultPassphrase: 'correct horse battery', repeatedSyncVaultPassphrase: 'correct horse battery' },
      }),
    ).toBeNull()
    // Switched off, the passphrase isn't asked.
    expect(findPapelizNewVaultCreateBlock({ ...readyCreateState, newVaultSyncChoice: { ...endToEndSyncChoice, isSyncThisVaultOn: false } })).toBeNull()
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
