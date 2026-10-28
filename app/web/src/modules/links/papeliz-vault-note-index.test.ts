import { describe, expect, it } from 'vitest'
import { findPapelizVaultNoteBacklinks, readPapelizVaultNoteIndexEntry } from './papeliz-vault-note-index'

describe('the note index', () => {
  it('reads links, tags and headings from a note', () => {
    const vaultNoteIndexEntry = readPapelizVaultNoteIndexEntry(
      'Projects/Garden plan.md',
      '---\ntags: [project, garden]\n---\n# Garden plan\n\nSee [[Reading list]] and [[Callouts|callouts]]. #outdoors\n\n## To do\n\n`[[Not a link]]`',
    )
    expect(vaultNoteIndexEntry.vaultNoteTitle).toBe('Garden plan')
    expect(vaultNoteIndexEntry.outgoingWikilinkTargetNames).toEqual(['Reading list', 'Callouts'])
    expect(vaultNoteIndexEntry.vaultNoteTags.sort()).toEqual(['garden', 'outdoors', 'project'])
    expect(vaultNoteIndexEntry.vaultNoteHeadings).toEqual([
      { noteHeadingText: 'Garden plan', noteHeadingDepth: 1, noteHeadingLineNumber: 4 },
      { noteHeadingText: 'To do', noteHeadingDepth: 2, noteHeadingLineNumber: 8 },
    ])
  })

  it('finds the notes that link to a note', () => {
    const vaultNoteIndexEntries = [
      readPapelizVaultNoteIndexEntry('Start here.md', 'See [[Garden plan]] and [[Garden plan|the plan]].'),
      readPapelizVaultNoteIndexEntry('Projects/Reading list.md', 'Notes go in [[Garden plan]].'),
      readPapelizVaultNoteIndexEntry('Projects/Garden plan.md', 'Books: [[Reading list]].'),
      readPapelizVaultNoteIndexEntry('Inbox.md', 'Nothing linked here.'),
    ]
    expect(findPapelizVaultNoteBacklinks(vaultNoteIndexEntries, 'Projects/Garden plan.md')).toEqual([
      { linkingVaultNoteRelativePath: 'Start here.md', linkCount: 2 },
      { linkingVaultNoteRelativePath: 'Projects/Reading list.md', linkCount: 1 },
    ])
  })
})
