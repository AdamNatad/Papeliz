import { describe, expect, it } from 'vitest'
import {
  carryVaultEntryLooksThroughMove,
  formatPapelizFileListLooksFile,
  parsePapelizFileListLooksFile,
  removeVaultEntryLooksInside,
  setPapelizVaultEntryLook,
} from './papeliz-vault-entry-looks'

describe('colors and icons in the file list', () => {
  it('reads back what it writes, and skips colors and icons it does not know', () => {
    const vaultEntryLooks = { Projects: { lookColor: 'green' as const, lookIconName: 'sprout' as const }, 'Inbox.md': { lookColor: '#a1b2c3' as const } }
    expect(parsePapelizFileListLooksFile(formatPapelizFileListLooksFile(vaultEntryLooks))).toEqual(vaultEntryLooks)
    expect(parsePapelizFileListLooksFile('{"fileListLooks":{"A":{"lookColor":"teal","lookIconName":"dragon"},"B":{"lookIconName":"star"}}}')).toEqual({
      B: { lookIconName: 'star' },
    })
    expect(parsePapelizFileListLooksFile('not json')).toEqual({})
  })

  it('follows a renamed folder, drops what went to the trash, and clears an empty look', () => {
    const vaultEntryLooks = { Projects: { lookColor: 'green' as const }, 'Projects/Garden.md': { lookIconName: 'flower' as const }, 'Inbox.md': { lookColor: 'red' as const } }
    expect(Object.keys(carryVaultEntryLooksThroughMove(vaultEntryLooks, 'Projects', 'Work'))).toEqual(['Work', 'Work/Garden.md', 'Inbox.md'])
    expect(Object.keys(removeVaultEntryLooksInside(vaultEntryLooks, 'Projects'))).toEqual(['Inbox.md'])
    expect(setPapelizVaultEntryLook(vaultEntryLooks, 'Inbox.md', {})).not.toHaveProperty('Inbox.md')
  })
})
