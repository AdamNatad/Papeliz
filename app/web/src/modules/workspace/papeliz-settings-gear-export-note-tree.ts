import type { PapelizVaultEntryKind, PapelizVaultTreeEntry } from '../vault/papeliz-vault-adapter'
import {
  getVaultEntryName,
  getVaultEntryParentFolderRelativePath,
  getVaultNoteTitle,
  papelizVaultRootFolderRelativePath,
} from '../vault/papeliz-vault-relative-paths'
import { sortVaultFolderEntries, type PapelizVaultEntryOrder } from './papeliz-vault-entry-order'

// The Settings gear's Export page: the vault's notes as a folder tree to tick. A folder's box ticks
// every note inside it, subfolders too, and shows "some" when only part of it is ticked.

export interface PapelizExportTreeNode {
  vaultEntryRelativePath: string
  vaultEntryKind: PapelizVaultEntryKind
  exportTreeNodeName: string
  childExportTreeNodes: PapelizExportTreeNode[]
}

export type PapelizExportTreeNodeTickState = 'ticked' | 'partly-ticked' | 'unticked'

// The tree in the file list's order. Folders with no notes anywhere inside are left out: there is
// nothing in them to export.
export function buildPapelizExportNoteTree(
  vaultTreeEntries: readonly PapelizVaultTreeEntry[],
  vaultEntryOrder: PapelizVaultEntryOrder,
): PapelizExportTreeNode[] {
  const rootExportTreeNodes: PapelizExportTreeNode[] = []
  const folderExportTreeNodesByRelativePath = new Map<string, PapelizExportTreeNode>()
  // Parents sort before their children, so every folder exists before its entries arrive.
  const vaultTreeEntriesByDepth = [...vaultTreeEntries].sort(
    (firstEntry, secondEntry) => firstEntry.vaultEntryRelativePath.split('/').length - secondEntry.vaultEntryRelativePath.split('/').length,
  )
  for (const vaultTreeEntry of vaultTreeEntriesByDepth) {
    const exportTreeNode: PapelizExportTreeNode = {
      ...vaultTreeEntry,
      exportTreeNodeName:
        vaultTreeEntry.vaultEntryKind === 'note' ? getVaultNoteTitle(vaultTreeEntry.vaultEntryRelativePath) : getVaultEntryName(vaultTreeEntry.vaultEntryRelativePath),
      childExportTreeNodes: [],
    }
    if (vaultTreeEntry.vaultEntryKind === 'folder') folderExportTreeNodesByRelativePath.set(vaultTreeEntry.vaultEntryRelativePath, exportTreeNode)
    const parentFolderRelativePath = getVaultEntryParentFolderRelativePath(vaultTreeEntry.vaultEntryRelativePath)
    const parentExportTreeNode = folderExportTreeNodesByRelativePath.get(parentFolderRelativePath)
    if (parentFolderRelativePath !== papelizVaultRootFolderRelativePath && parentExportTreeNode !== undefined) parentExportTreeNode.childExportTreeNodes.push(exportTreeNode)
    else rootExportTreeNodes.push(exportTreeNode)
  }
  const sortAndPruneExportTreeNodes = (exportTreeNodes: PapelizExportTreeNode[], vaultFolderRelativePath: string): PapelizExportTreeNode[] =>
    sortVaultFolderEntries(exportTreeNodes, vaultFolderRelativePath, vaultEntryOrder)
      .map((exportTreeNode) => ({
        ...exportTreeNode,
        childExportTreeNodes: sortAndPruneExportTreeNodes(exportTreeNode.childExportTreeNodes, exportTreeNode.vaultEntryRelativePath),
      }))
      .filter((exportTreeNode) => exportTreeNode.vaultEntryKind === 'note' || exportTreeNode.childExportTreeNodes.length > 0)
  return sortAndPruneExportTreeNodes(rootExportTreeNodes, papelizVaultRootFolderRelativePath)
}

// Every note at or under these nodes, in the tree's order.
export function listExportNoteRelativePaths(exportTreeNodes: readonly PapelizExportTreeNode[]): string[] {
  return exportTreeNodes.flatMap((exportTreeNode) =>
    exportTreeNode.vaultEntryKind === 'note' ? [exportTreeNode.vaultEntryRelativePath] : listExportNoteRelativePaths(exportTreeNode.childExportTreeNodes),
  )
}

export function readExportTreeNodeTickState(
  exportTreeNode: PapelizExportTreeNode,
  tickedVaultNoteRelativePaths: ReadonlySet<string>,
): PapelizExportTreeNodeTickState {
  const exportNoteRelativePaths = listExportNoteRelativePaths([exportTreeNode])
  const tickedExportNoteCount = exportNoteRelativePaths.filter((exportNoteRelativePath) => tickedVaultNoteRelativePaths.has(exportNoteRelativePath)).length
  if (tickedExportNoteCount === 0) return 'unticked'
  return tickedExportNoteCount === exportNoteRelativePaths.length ? 'ticked' : 'partly-ticked'
}

// Clicking a box: a note flips; a folder that is fully ticked unticks everything in it, otherwise
// it ticks everything in it.
export function toggleExportTreeNodeTick(exportTreeNode: PapelizExportTreeNode, tickedVaultNoteRelativePaths: ReadonlySet<string>): Set<string> {
  const nextTickedVaultNoteRelativePaths = new Set(tickedVaultNoteRelativePaths)
  const isExportTreeNodeTicked = readExportTreeNodeTickState(exportTreeNode, tickedVaultNoteRelativePaths) === 'ticked'
  for (const exportNoteRelativePath of listExportNoteRelativePaths([exportTreeNode])) {
    if (isExportTreeNodeTicked) nextTickedVaultNoteRelativePaths.delete(exportNoteRelativePath)
    else nextTickedVaultNoteRelativePaths.add(exportNoteRelativePath)
  }
  return nextTickedVaultNoteRelativePaths
}

// The search box: notes whose title holds every typed word, in the tree's order.
export function findExportNotesMatchingSearch(exportTreeNodes: readonly PapelizExportTreeNode[], exportNoteSearchText: string): PapelizExportTreeNode[] {
  const exportNoteSearchWords = exportNoteSearchText.toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (exportNoteSearchWords.length === 0) return []
  const exportNoteMatches: PapelizExportTreeNode[] = []
  const collectExportNoteMatches = (searchedExportTreeNodes: readonly PapelizExportTreeNode[]) => {
    for (const exportTreeNode of searchedExportTreeNodes) {
      if (exportTreeNode.vaultEntryKind === 'folder') {
        collectExportNoteMatches(exportTreeNode.childExportTreeNodes)
        continue
      }
      const exportNoteTitle = exportTreeNode.exportTreeNodeName.toLocaleLowerCase()
      if (exportNoteSearchWords.every((exportNoteSearchWord) => exportNoteTitle.includes(exportNoteSearchWord))) exportNoteMatches.push(exportTreeNode)
    }
  }
  collectExportNoteMatches(exportTreeNodes)
  return exportNoteMatches
}
