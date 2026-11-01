import { describe, expect, it } from 'vitest'
import { pickPapelizRememberedNoteTabsStillInVault } from './papeliz-remembered-note-tabs'

describe('picking the remembered tabs still in the vault', () => {
  const vaultNotesStillThere = new Set(['Inbox.md', 'Projects/Plan.md', 'Reading.md'])
  const isVaultNoteStillThere = (vaultNoteRelativePath: string) => vaultNotesStillThere.has(vaultNoteRelativePath)

  it('keeps the order and the note in front', () => {
    expect(
      pickPapelizRememberedNoteTabsStillInVault(
        { rememberedNoteTabRelativePaths: ['Reading.md', 'Inbox.md', 'Projects/Plan.md'], rememberedActiveVaultNoteRelativePath: 'Inbox.md' },
        isVaultNoteStillThere,
      ),
    ).toEqual({ noteTabRelativePaths: ['Reading.md', 'Inbox.md', 'Projects/Plan.md'], activeVaultNoteRelativePath: 'Inbox.md' })
  })

  it('leaves out gone notes and a tab listed twice', () => {
    expect(
      pickPapelizRememberedNoteTabsStillInVault(
        { rememberedNoteTabRelativePaths: ['Old.md', 'Inbox.md', 'Inbox.md', 'Reading.md'], rememberedActiveVaultNoteRelativePath: 'Reading.md' },
        isVaultNoteStillThere,
      ),
    ).toEqual({ noteTabRelativePaths: ['Inbox.md', 'Reading.md'], activeVaultNoteRelativePath: 'Reading.md' })
  })

  it('brings the next tab forward when the note in front is gone, or the last one at the end', () => {
    expect(
      pickPapelizRememberedNoteTabsStillInVault(
        { rememberedNoteTabRelativePaths: ['Inbox.md', 'Old.md', 'Reading.md'], rememberedActiveVaultNoteRelativePath: 'Old.md' },
        isVaultNoteStillThere,
      ).activeVaultNoteRelativePath,
    ).toBe('Reading.md')
    expect(
      pickPapelizRememberedNoteTabsStillInVault(
        { rememberedNoteTabRelativePaths: ['Inbox.md', 'Reading.md', 'Old.md'], rememberedActiveVaultNoteRelativePath: 'Old.md' },
        isVaultNoteStillThere,
      ).activeVaultNoteRelativePath,
    ).toBe('Reading.md')
  })

  it('gives no note in front when nothing is left', () => {
    expect(
      pickPapelizRememberedNoteTabsStillInVault({ rememberedNoteTabRelativePaths: ['Old.md'], rememberedActiveVaultNoteRelativePath: 'Old.md' }, isVaultNoteStillThere),
    ).toEqual({ noteTabRelativePaths: [], activeVaultNoteRelativePath: null })
  })
})
