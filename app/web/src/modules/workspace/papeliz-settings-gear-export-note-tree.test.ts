import { describe, expect, it } from 'vitest'
import {
  buildPapelizExportNoteTree,
  findExportNotesMatchingSearch,
  listExportNoteRelativePaths,
  readExportTreeNodeTickState,
  toggleExportTreeNodeTick,
  type PapelizExportTreeNode,
} from './papeliz-settings-gear-export-note-tree'

function requireExportTreeNode(exportTreeNode: PapelizExportTreeNode | undefined): PapelizExportTreeNode {
  if (exportTreeNode === undefined) throw new Error('The test tree is missing a node.')
  return exportTreeNode
}

const testVaultEntries = [
  { vaultEntryRelativePath: 'Weekly plan.md', vaultEntryKind: 'note' as const },
  { vaultEntryRelativePath: 'Projects', vaultEntryKind: 'folder' as const },
  { vaultEntryRelativePath: 'Projects/Garden club', vaultEntryKind: 'folder' as const },
  { vaultEntryRelativePath: 'Projects/Garden club/Plant list.md', vaultEntryKind: 'note' as const },
  { vaultEntryRelativePath: 'Projects/Garden club/Meeting notes.md', vaultEntryKind: 'note' as const },
  { vaultEntryRelativePath: 'Projects/Welcome guide.md', vaultEntryKind: 'note' as const },
  { vaultEntryRelativePath: 'Empty', vaultEntryKind: 'folder' as const },
  { vaultEntryRelativePath: 'Reading list.md', vaultEntryKind: 'note' as const },
]

const testExportNoteTree = buildPapelizExportNoteTree(testVaultEntries, {})
const projectsExportTreeNode = requireExportTreeNode(testExportNoteTree[0])
const readingListExportTreeNode = requireExportTreeNode(testExportNoteTree[1])
const gardenClubExportTreeNode = requireExportTreeNode(projectsExportTreeNode.childExportTreeNodes[0])

describe('the Export page note tree', () => {
  it('follows the file list order and leaves out folders with no notes', () => {
    expect(testExportNoteTree.map((exportTreeNode) => exportTreeNode.exportTreeNodeName)).toEqual(['Projects', 'Reading list', 'Weekly plan'])
    expect(projectsExportTreeNode.childExportTreeNodes.map((exportTreeNode) => exportTreeNode.exportTreeNodeName)).toEqual(['Garden club', 'Welcome guide'])
    expect(listExportNoteRelativePaths(testExportNoteTree)).toEqual([
      'Projects/Garden club/Meeting notes.md',
      'Projects/Garden club/Plant list.md',
      'Projects/Welcome guide.md',
      'Reading list.md',
      'Weekly plan.md',
    ])
  })

  it('shows a folder as partly ticked when only some notes inside it are ticked', () => {
    const tickedVaultNoteRelativePaths = new Set(['Projects/Garden club/Meeting notes.md'])
    expect(readExportTreeNodeTickState(gardenClubExportTreeNode, tickedVaultNoteRelativePaths)).toBe('partly-ticked')
    expect(readExportTreeNodeTickState(projectsExportTreeNode, tickedVaultNoteRelativePaths)).toBe('partly-ticked')
    expect(readExportTreeNodeTickState(readingListExportTreeNode, tickedVaultNoteRelativePaths)).toBe('unticked')
  })

  it('ticks everything inside a folder, then unticks it all on the next click', () => {
    const tickedOnce = toggleExportTreeNodeTick(projectsExportTreeNode, new Set(['Projects/Garden club/Meeting notes.md']))
    expect(readExportTreeNodeTickState(projectsExportTreeNode, tickedOnce)).toBe('ticked')
    expect(readExportTreeNodeTickState(gardenClubExportTreeNode, tickedOnce)).toBe('ticked')
    const tickedTwice = toggleExportTreeNodeTick(projectsExportTreeNode, tickedOnce)
    expect(tickedTwice.size).toBe(0)
  })

  it('finds notes by every typed word, whichever folder they are in', () => {
    expect(findExportNotesMatchingSearch(testExportNoteTree, 'list').map((exportTreeNode) => exportTreeNode.vaultEntryRelativePath)).toEqual([
      'Projects/Garden club/Plant list.md',
      'Reading list.md',
    ])
    expect(findExportNotesMatchingSearch(testExportNoteTree, 'plant LIST')).toHaveLength(1)
    expect(findExportNotesMatchingSearch(testExportNoteTree, '   ')).toEqual([])
  })
})
