import { describe, expect, it } from 'vitest'
import type { PapelizDesktopFileSystemFailureKind } from '../desktop/papeliz-desktop-platform-contract'
import { describePapelizVaultError, isPapelizVaultEntryMissingError } from './papeliz-vault-adapter'

function createDesktopFileSystemFailure(desktopFileSystemFailureKind: PapelizDesktopFileSystemFailureKind): Error {
  return Object.assign(new Error('native file call failed'), { desktopFileSystemFailureKind })
}

describe('a failed file call in Papeliz for Windows', () => {
  it('reads as the vault failure code for why it failed', () => {
    expect(describePapelizVaultError(createDesktopFileSystemFailure('not-found'))).toBe('File Not Found')
    expect(describePapelizVaultError(createDesktopFileSystemFailure('name-taken'))).toBe('Name Taken')
    expect(describePapelizVaultError(createDesktopFileSystemFailure('no-permission'))).toBe('No Permission')
    expect(describePapelizVaultError(createDesktopFileSystemFailure('in-use'))).toBe('File In Use')
    expect(describePapelizVaultError(createDesktopFileSystemFailure('disk-full'))).toBe('Disk Full')
  })

  it('counts as a missing entry only when nothing was there', () => {
    expect(isPapelizVaultEntryMissingError(createDesktopFileSystemFailure('not-found'))).toBe(true)
    expect(isPapelizVaultEntryMissingError(createDesktopFileSystemFailure('in-use'))).toBe(false)
  })
})
