import { describe, expect, it } from 'vitest'
import { isPapelizSyncVaultCopiedHere } from './papeliz-sync-fetched-copies'

const researchNotesSyncVaultId = 'pzvault_research'
const syncVaultCopiesHere: ReadonlyMap<string, string> = new Map([[researchNotesSyncVaultId, 'research-notes-copy']])

describe('whether a synced vault is here as a copy', () => {
  it('is, when its copy is here and it syncs with nothing on this device', () => {
    expect(isPapelizSyncVaultCopiedHere(researchNotesSyncVaultId, null, syncVaultCopiesHere)).toBe(true)
  })

  it('is, when the account was read while the copy still downloaded, linked', () => {
    expect(isPapelizSyncVaultCopiedHere(researchNotesSyncVaultId, 'research-notes-copy', syncVaultCopiesHere)).toBe(true)
  })

  it('isn’t, when it syncs with another vault on this device', () => {
    expect(isPapelizSyncVaultCopiedHere(researchNotesSyncVaultId, 'research-notes', syncVaultCopiesHere)).toBe(false)
  })

  it('isn’t, with no copy here', () => {
    expect(isPapelizSyncVaultCopiedHere('pzvault_travel', null, syncVaultCopiesHere)).toBe(false)
  })
})
