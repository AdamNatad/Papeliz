import type { PapelizVaultEntryKind } from '../vault/papeliz-vault-adapter'
import { getVaultEntryName, getVaultEntryParentFolderRelativePath, replaceVaultRelativePathPrefix } from '../vault/papeliz-vault-relative-paths'

// The file list's own order. A folder on disk has no order, so the file list sorts folders first,
// then by name; once an entry is dragged or moved up or down, its folder keeps a list of entry
// names in the chosen order, saved in the vault itself (see below). Listed entries come first, in that order; entries not listed yet (a
// new note, say) follow in the usual order.

// Folder path ('' is the top of the vault) → its entry names, in the chosen order.
export type PapelizVaultEntryOrder = Readonly<Record<string, readonly string[]>>

// The order travels with the vault, in `.papeliz/file-list-order.json`, readable JSON:
//   { "about": "…", "fileListOrder": { "": ["Start here.md", "Guides"], "Guides": [...] } }
export const papelizFileListOrderFileName = 'file-list-order.json'

export function formatPapelizFileListOrderFile(vaultEntryOrder: PapelizVaultEntryOrder): string {
  const papelizFileListOrderFile = {
    about: 'The order Papeliz shows this vault’s notes and folders in: folder path → names. "" is the top of the vault.',
    fileListOrder: vaultEntryOrder,
  }
  return `${JSON.stringify(papelizFileListOrderFile, null, 2)}\n`
}

// Reads the order file; anything it cannot read as an order gives the plain order back.
export function parsePapelizFileListOrderFile(papelizFileListOrderFileText: string | null): PapelizVaultEntryOrder {
  if (papelizFileListOrderFileText === null) return {}
  let parsedFileListOrderFile: unknown
  try {
    parsedFileListOrderFile = JSON.parse(papelizFileListOrderFileText)
  } catch {
    return {}
  }
  const fileListOrder = (parsedFileListOrderFile as { fileListOrder?: unknown } | null)?.fileListOrder
  if (typeof fileListOrder !== 'object' || fileListOrder === null || Array.isArray(fileListOrder)) return {}
  const parsedVaultEntryOrder: Record<string, readonly string[]> = {}
  for (const [vaultFolderRelativePath, chosenEntryNames] of Object.entries(fileListOrder)) {
    if (Array.isArray(chosenEntryNames)) {
      parsedVaultEntryOrder[vaultFolderRelativePath] = chosenEntryNames.filter((chosenEntryName): chosenEntryName is string => typeof chosenEntryName === 'string')
    }
  }
  return parsedVaultEntryOrder
}

export type PapelizVaultEntryPlacement =
  | { vaultEntryPlacementKind: 'before' | 'after'; anchorVaultEntryName: string }
  | { vaultEntryPlacementKind: 'first' | 'last' }

interface PapelizOrderableVaultEntry {
  vaultEntryRelativePath: string
  vaultEntryKind: PapelizVaultEntryKind
}

// Notes compare by title, so "Plan" comes before "Plan copy" (with ".md" a space would sort first).
function getSortableVaultEntryName(vaultEntry: PapelizOrderableVaultEntry): string {
  const vaultEntryName = getVaultEntryName(vaultEntry.vaultEntryRelativePath)
  return vaultEntry.vaultEntryKind === 'note' ? vaultEntryName.replace(/\.md$/i, '') : vaultEntryName
}

function compareVaultEntriesByDefault(firstEntry: PapelizOrderableVaultEntry, secondEntry: PapelizOrderableVaultEntry): number {
  if (firstEntry.vaultEntryKind !== secondEntry.vaultEntryKind) return firstEntry.vaultEntryKind === 'folder' ? -1 : 1
  return getSortableVaultEntryName(firstEntry).localeCompare(getSortableVaultEntryName(secondEntry), undefined, { numeric: true, sensitivity: 'base' })
}

// Sorts the entries of one folder as the file list shows them.
export function sortVaultFolderEntries<OrderableVaultEntry extends PapelizOrderableVaultEntry>(
  vaultFolderEntries: readonly OrderableVaultEntry[],
  vaultFolderRelativePath: string,
  vaultEntryOrder: PapelizVaultEntryOrder,
): OrderableVaultEntry[] {
  const chosenEntryNames = vaultEntryOrder[vaultFolderRelativePath] ?? []
  const chosenPositionsByName = new Map(chosenEntryNames.map((chosenEntryName, chosenPosition) => [chosenEntryName, chosenPosition]))
  return [...vaultFolderEntries].sort((firstEntry, secondEntry) => {
    const firstChosenPosition = chosenPositionsByName.get(getVaultEntryName(firstEntry.vaultEntryRelativePath))
    const secondChosenPosition = chosenPositionsByName.get(getVaultEntryName(secondEntry.vaultEntryRelativePath))
    if (firstChosenPosition !== undefined && secondChosenPosition !== undefined) return firstChosenPosition - secondChosenPosition
    if (firstChosenPosition !== undefined) return -1
    if (secondChosenPosition !== undefined) return 1
    return compareVaultEntriesByDefault(firstEntry, secondEntry)
  })
}

// The names in one folder as shown, from the whole vault's entries.
export function listVaultFolderEntryNamesInOrder(
  vaultTreeEntries: readonly PapelizOrderableVaultEntry[],
  vaultFolderRelativePath: string,
  vaultEntryOrder: PapelizVaultEntryOrder,
): string[] {
  const vaultFolderEntries = vaultTreeEntries.filter(
    (vaultTreeEntry) => getVaultEntryParentFolderRelativePath(vaultTreeEntry.vaultEntryRelativePath) === vaultFolderRelativePath,
  )
  return sortVaultFolderEntries(vaultFolderEntries, vaultFolderRelativePath, vaultEntryOrder).map((vaultFolderEntry) =>
    getVaultEntryName(vaultFolderEntry.vaultEntryRelativePath),
  )
}

// The folder's new name order with `placedVaultEntryName` put at `vaultEntryPlacement`.
export function placeVaultEntryName(
  shownVaultEntryNames: readonly string[],
  placedVaultEntryName: string,
  vaultEntryPlacement: PapelizVaultEntryPlacement,
): string[] {
  const otherVaultEntryNames = shownVaultEntryNames.filter((shownVaultEntryName) => shownVaultEntryName !== placedVaultEntryName)
  let placedIndex = otherVaultEntryNames.length
  if (vaultEntryPlacement.vaultEntryPlacementKind === 'first') placedIndex = 0
  if (vaultEntryPlacement.vaultEntryPlacementKind === 'before' || vaultEntryPlacement.vaultEntryPlacementKind === 'after') {
    const anchorIndex = otherVaultEntryNames.indexOf(vaultEntryPlacement.anchorVaultEntryName)
    if (anchorIndex !== -1) placedIndex = vaultEntryPlacement.vaultEntryPlacementKind === 'before' ? anchorIndex : anchorIndex + 1
  }
  return [...otherVaultEntryNames.slice(0, placedIndex), placedVaultEntryName, ...otherVaultEntryNames.slice(placedIndex)]
}

// Keeps the order through a rename or a move: folder keys inside a moved folder follow it, and a
// renamed entry keeps its place under its new name. A moved entry leaves its old folder's list.
export function carryVaultEntryOrderThroughMove(
  vaultEntryOrder: PapelizVaultEntryOrder,
  fromVaultEntryRelativePath: string,
  toVaultEntryRelativePath: string,
): PapelizVaultEntryOrder {
  const carriedVaultEntryOrder: Record<string, readonly string[]> = {}
  for (const [vaultFolderRelativePath, chosenEntryNames] of Object.entries(vaultEntryOrder)) {
    carriedVaultEntryOrder[replaceVaultRelativePathPrefix(vaultFolderRelativePath, fromVaultEntryRelativePath, toVaultEntryRelativePath)] = chosenEntryNames
  }
  const fromVaultFolderRelativePath = getVaultEntryParentFolderRelativePath(fromVaultEntryRelativePath)
  const fromVaultEntryName = getVaultEntryName(fromVaultEntryRelativePath)
  const fromFolderEntryNames = carriedVaultEntryOrder[fromVaultFolderRelativePath]
  if (fromFolderEntryNames !== undefined) {
    carriedVaultEntryOrder[fromVaultFolderRelativePath] =
      fromVaultFolderRelativePath === getVaultEntryParentFolderRelativePath(toVaultEntryRelativePath)
        ? fromFolderEntryNames.map((chosenEntryName) => (chosenEntryName === fromVaultEntryName ? getVaultEntryName(toVaultEntryRelativePath) : chosenEntryName))
        : fromFolderEntryNames.filter((chosenEntryName) => chosenEntryName !== fromVaultEntryName)
  }
  return carriedVaultEntryOrder
}
