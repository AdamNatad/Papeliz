import { describe, expect, it } from 'vitest'
import { findVaultTrashEntryRestorePath, formatPapelizTrashOriginsFile, parsePapelizTrashOriginsFile } from './papeliz-vault-trash-origins'

describe('where the trash’s notes came from', () => {
  it('reads back what it wrote, and drops entries that don’t fit', () => {
    const vaultTrashOrigins = { '.trash/Inbox 2.md': 'Projects/Inbox.md', '.trash/Old': 'Work/Old' }
    expect(parsePapelizTrashOriginsFile(formatPapelizTrashOriginsFile(vaultTrashOrigins))).toEqual(vaultTrashOrigins)
    expect(
      parsePapelizTrashOriginsFile(
        JSON.stringify({ trashOrigins: { 'Inbox.md': 'Projects/Inbox.md', '.trash/A.md': '.trash/B.md', '.trash/C.md': 7, '.trash/D.md': '' } }),
      ),
    ).toEqual({})
    expect(parsePapelizTrashOriginsFile('not json')).toEqual({})
    expect(parsePapelizTrashOriginsFile(null)).toEqual({})
  })

  it('puts an entry back where it was, a note inside a trashed folder where it was in it, and anything else at the top', () => {
    const vaultTrashOrigins = { '.trash/Inbox 2.md': 'Projects/Inbox.md', '.trash/Old': 'Work/Old' }
    expect(findVaultTrashEntryRestorePath('.trash/Inbox 2.md', vaultTrashOrigins)).toBe('Projects/Inbox.md')
    expect(findVaultTrashEntryRestorePath('.trash/Old/Drafts/Plan.md', vaultTrashOrigins)).toBe('Work/Old/Drafts/Plan.md')
    expect(findVaultTrashEntryRestorePath('.trash/From another app.md', vaultTrashOrigins)).toBe('From another app.md')
  })
})
