import { describe, expect, it } from 'vitest'
import {
  emptyPapelizVaultTrashRecord,
  findVaultTrashEntryRestorePath,
  formatPapelizTrashOriginsFile,
  parsePapelizTrashOriginsFile,
  recordVaultEntryMovedToTrash,
  takeVaultEntryRestoredFromTrash,
} from './papeliz-vault-trash-origins'

describe('where the trash’s notes came from', () => {
  it('reads back what it wrote, and drops entries that don’t fit', () => {
    const vaultTrashRecord = {
      vaultTrashOrigins: { '.trash/Inbox 2.md': 'Projects/Inbox.md', '.trash/Old': 'Work/Old' },
      trashedVaultEntryLocks: ['.trash/Old', '.trash/Old/Plan.md'],
      trashedVaultEntryLooks: { '.trash/Inbox 2.md': { lookColor: 'blue' as const, lookIconName: 'rocket' as const } },
    }
    expect(parsePapelizTrashOriginsFile(formatPapelizTrashOriginsFile(vaultTrashRecord))).toEqual(vaultTrashRecord)
    expect(
      parsePapelizTrashOriginsFile(
        JSON.stringify({
          trashOrigins: { 'Inbox.md': 'Projects/Inbox.md', '.trash/A.md': '.trash/B.md', '.trash/C.md': 7, '.trash/D.md': '' },
          trashedEntryLocks: ['Inbox.md', 7, '.trash/E.md'],
          trashedEntryLooks: { 'Inbox.md': { lookColor: 'blue' }, '.trash/F.md': { lookColor: 'not a color' } },
        }),
      ),
    ).toEqual({ ...emptyPapelizVaultTrashRecord, trashedVaultEntryLocks: ['.trash/E.md'] })
    // A record from before locks and looks were kept reads with none.
    expect(parsePapelizTrashOriginsFile(JSON.stringify({ trashOrigins: { '.trash/Old': 'Work/Old' } }))).toEqual({
      ...emptyPapelizVaultTrashRecord,
      vaultTrashOrigins: { '.trash/Old': 'Work/Old' },
    })
    expect(formatPapelizTrashOriginsFile(emptyPapelizVaultTrashRecord)).not.toContain('trashedEntry')
    expect(parsePapelizTrashOriginsFile('not json')).toEqual(emptyPapelizVaultTrashRecord)
    expect(parsePapelizTrashOriginsFile(null)).toEqual(emptyPapelizVaultTrashRecord)
  })

  it('puts an entry back where it was, a note inside a trashed folder where it was in it, and anything else at the top', () => {
    const vaultTrashOrigins = { '.trash/Inbox 2.md': 'Projects/Inbox.md', '.trash/Old': 'Work/Old' }
    expect(findVaultTrashEntryRestorePath('.trash/Inbox 2.md', vaultTrashOrigins)).toBe('Projects/Inbox.md')
    expect(findVaultTrashEntryRestorePath('.trash/Old/Drafts/Plan.md', vaultTrashOrigins)).toBe('Work/Old/Drafts/Plan.md')
    expect(findVaultTrashEntryRestorePath('.trash/From another app.md', vaultTrashOrigins)).toBe('From another app.md')
  })

  it('keeps a trashed entry’s locks and looks, and gives them back at the path Restore used', () => {
    const vaultTrashRecord = recordVaultEntryMovedToTrash(
      // Left over from an earlier ".trash/Projects" that left the trash some other way.
      { ...emptyPapelizVaultTrashRecord, trashedVaultEntryLocks: ['.trash/Projects/Gone.md'], trashedVaultEntryLooks: { '.trash/Projects': { lookColor: 'red' } } },
      'Work/Projects',
      '.trash/Projects',
      ['Work/Projects', 'Work/Projects/Plan.md', 'Work/Other.md'],
      { 'Work/Projects/Plan.md': { lookColor: 'green' }, 'Work/Projects': { lookIconName: 'rocket' }, 'Work/Other.md': { lookColor: 'blue' } },
    )
    expect(vaultTrashRecord).toEqual({
      vaultTrashOrigins: { '.trash/Projects': 'Work/Projects' },
      trashedVaultEntryLocks: ['.trash/Projects', '.trash/Projects/Plan.md'],
      trashedVaultEntryLooks: { '.trash/Projects/Plan.md': { lookColor: 'green' }, '.trash/Projects': { lookIconName: 'rocket' } },
    })
    // One note out of the folder takes only its own lock and look; the folder's stay with it.
    const planRestore = takeVaultEntryRestoredFromTrash(vaultTrashRecord, '.trash/Projects/Plan.md', 'Work/Projects/Plan.md')
    expect(planRestore.restoredVaultEntryLocks).toEqual(['Work/Projects/Plan.md'])
    expect(planRestore.restoredVaultEntryLooks).toEqual({ 'Work/Projects/Plan.md': { lookColor: 'green' } })
    expect(planRestore.vaultTrashRecord).toEqual({
      vaultTrashOrigins: { '.trash/Projects': 'Work/Projects' },
      trashedVaultEntryLocks: ['.trash/Projects'],
      trashedVaultEntryLooks: { '.trash/Projects': { lookIconName: 'rocket' } },
    })
    // The folder, under a free name.
    const folderRestore = takeVaultEntryRestoredFromTrash(planRestore.vaultTrashRecord, '.trash/Projects', 'Work/Projects 2')
    expect(folderRestore.restoredVaultEntryLocks).toEqual(['Work/Projects 2'])
    expect(folderRestore.restoredVaultEntryLooks).toEqual({ 'Work/Projects 2': { lookIconName: 'rocket' } })
    expect(folderRestore.vaultTrashRecord).toEqual(emptyPapelizVaultTrashRecord)
  })
})
