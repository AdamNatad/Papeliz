import { describe, expect, it } from 'vitest'
import {
  carryVaultEntryOrderThroughMove,
  formatPapelizFileListOrderFile,
  listVaultFolderEntryNamesInOrder,
  parsePapelizFileListOrderFile,
  placeVaultEntryName,
} from './papeliz-vault-entry-order'

const testVaultEntries = [
  { vaultEntryRelativePath: 'Projects', vaultEntryKind: 'folder' as const },
  { vaultEntryRelativePath: 'Inbox.md', vaultEntryKind: 'note' as const },
  { vaultEntryRelativePath: 'Archive', vaultEntryKind: 'folder' as const },
  { vaultEntryRelativePath: 'Start here.md', vaultEntryKind: 'note' as const },
  { vaultEntryRelativePath: 'Projects/Plan.md', vaultEntryKind: 'note' as const },
]

describe('the file list order', () => {
  it('shows folders first, then by name, until an order is chosen', () => {
    expect(listVaultFolderEntryNamesInOrder(testVaultEntries, '', {})).toEqual(['Archive', 'Projects', 'Inbox.md', 'Start here.md'])
  })

  it('sorts notes by title, so a copy comes right after its original', () => {
    const copiedNotes = [
      { vaultEntryRelativePath: 'Callouts copy.md', vaultEntryKind: 'note' as const },
      { vaultEntryRelativePath: 'Callouts.md', vaultEntryKind: 'note' as const },
      { vaultEntryRelativePath: 'Callouts copy 2.md', vaultEntryKind: 'note' as const },
    ]
    expect(listVaultFolderEntryNamesInOrder(copiedNotes, '', {})).toEqual(['Callouts.md', 'Callouts copy.md', 'Callouts copy 2.md'])
  })

  it('puts chosen names first, in order, and the rest after in the usual order', () => {
    expect(listVaultFolderEntryNamesInOrder(testVaultEntries, '', { '': ['Start here.md', 'Projects'] })).toEqual([
      'Start here.md',
      'Projects',
      'Archive',
      'Inbox.md',
    ])
  })

  it('places a name before, after, first or last', () => {
    const shownNames = ['Archive', 'Projects', 'Inbox.md', 'Start here.md']
    expect(placeVaultEntryName(shownNames, 'Start here.md', { vaultEntryPlacementKind: 'before', anchorVaultEntryName: 'Archive' })).toEqual([
      'Start here.md',
      'Archive',
      'Projects',
      'Inbox.md',
    ])
    expect(placeVaultEntryName(shownNames, 'Archive', { vaultEntryPlacementKind: 'after', anchorVaultEntryName: 'Inbox.md' })).toEqual([
      'Projects',
      'Inbox.md',
      'Archive',
      'Start here.md',
    ])
    expect(placeVaultEntryName(shownNames, 'Inbox.md', { vaultEntryPlacementKind: 'first' })).toEqual(['Inbox.md', 'Archive', 'Projects', 'Start here.md'])
    expect(placeVaultEntryName(shownNames, 'New.md', { vaultEntryPlacementKind: 'last' })).toEqual([...shownNames, 'New.md'])
  })

  it('writes the order file as readable JSON and reads it back, ignoring anything else', () => {
    const vaultEntryOrder = { '': ['Start here.md', 'Guides'], Guides: ['Callouts.md'] }
    const orderFileText = formatPapelizFileListOrderFile(vaultEntryOrder)
    expect(orderFileText).toContain('"fileListOrder"')
    expect(parsePapelizFileListOrderFile(orderFileText)).toEqual(vaultEntryOrder)
    expect(parsePapelizFileListOrderFile(null)).toEqual({})
    expect(parsePapelizFileListOrderFile('not json')).toEqual({})
    expect(parsePapelizFileListOrderFile('{"fileListOrder":{"":["A.md",3],"X":"nope"}}')).toEqual({ '': ['A.md'] })
  })

  it('keeps the order through renames and moves', () => {
    const vaultEntryOrder = { '': ['Inbox.md', 'Projects'], Projects: ['Plan.md', 'Notes.md'] }
    expect(carryVaultEntryOrderThroughMove(vaultEntryOrder, 'Inbox.md', 'Today.md')).toEqual({ '': ['Today.md', 'Projects'], Projects: ['Plan.md', 'Notes.md'] })
    expect(carryVaultEntryOrderThroughMove(vaultEntryOrder, 'Projects', 'Work')).toEqual({ '': ['Inbox.md', 'Work'], Work: ['Plan.md', 'Notes.md'] })
    expect(carryVaultEntryOrderThroughMove(vaultEntryOrder, 'Inbox.md', 'Projects/Inbox.md')).toEqual({
      '': ['Projects'],
      Projects: ['Plan.md', 'Notes.md'],
    })
  })
})
