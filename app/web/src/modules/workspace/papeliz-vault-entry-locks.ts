import { isVaultRelativePathInsideFolder, isVaultRelativePathWritableByPapeliz, replaceVaultRelativePathPrefix } from '../vault/papeliz-vault-relative-paths'

// Editing locks, per note or per folder, and one for the whole vault. A note can be read but not
// changed while it, or any folder it is in, is locked, or while the whole vault is. The whole
// vault's lock sits beside the others without changing them, so unlocking it brings each note's
// own lock back as it was. Both travel with the vault, in `.papeliz/locked-entries.json`:
//   { "about": "…", "wholeVaultLocked": true, "lockedEntries": ["Projects", "Start here.md"] }

export const papelizLockedEntriesFileName = 'locked-entries.json'

// The locked note or folder that keeps `vaultNoteRelativePath` from being edited (the note itself
// first, then its nearest folder), or null when it can be edited.
export function findLockingVaultEntry(lockedVaultEntryRelativePaths: readonly string[], vaultNoteRelativePath: string | null): string | null {
  if (vaultNoteRelativePath === null) return null
  if (lockedVaultEntryRelativePaths.includes(vaultNoteRelativePath)) return vaultNoteRelativePath
  const lockingFolders = lockedVaultEntryRelativePaths.filter((lockedVaultEntryRelativePath) =>
    isVaultRelativePathInsideFolder(vaultNoteRelativePath, lockedVaultEntryRelativePath),
  )
  return lockingFolders.sort((firstFolder, secondFolder) => secondFolder.length - firstFolder.length)[0] ?? null
}

// What keeps a note from being edited: it sits in a hidden folder Papeliz never writes to, the
// whole vault is locked, or the note or a folder it is in is locked.
export type PapelizVaultNoteEditingLock =
  | { vaultNoteEditingLockKind: 'hidden-folder' }
  | { vaultNoteEditingLockKind: 'whole-vault' }
  | { vaultNoteEditingLockKind: 'vault-entry'; lockingVaultEntryRelativePath: string }

export function findVaultNoteEditingLock(
  isWholeVaultEditingLocked: boolean,
  lockedVaultEntryRelativePaths: readonly string[],
  vaultNoteRelativePath: string | null,
): PapelizVaultNoteEditingLock | null {
  if (vaultNoteRelativePath === null) return null
  if (!isVaultRelativePathWritableByPapeliz(vaultNoteRelativePath)) return { vaultNoteEditingLockKind: 'hidden-folder' }
  if (isWholeVaultEditingLocked) return { vaultNoteEditingLockKind: 'whole-vault' }
  const lockingVaultEntryRelativePath = findLockingVaultEntry(lockedVaultEntryRelativePaths, vaultNoteRelativePath)
  return lockingVaultEntryRelativePath === null ? null : { vaultNoteEditingLockKind: 'vault-entry', lockingVaultEntryRelativePath }
}

// Keeps locks on entries that were renamed or moved, and on everything inside a moved folder.
export function carryVaultEntryLocksThroughMove(
  lockedVaultEntryRelativePaths: readonly string[],
  fromVaultEntryRelativePath: string,
  toVaultEntryRelativePath: string,
): string[] {
  return lockedVaultEntryRelativePaths.map((lockedVaultEntryRelativePath) =>
    replaceVaultRelativePathPrefix(lockedVaultEntryRelativePath, fromVaultEntryRelativePath, toVaultEntryRelativePath),
  )
}

// Drops the locks on an entry that went to the trash and on everything inside it.
export function removeVaultEntryLocksInside(lockedVaultEntryRelativePaths: readonly string[], removedVaultEntryRelativePath: string): string[] {
  return lockedVaultEntryRelativePaths.filter(
    (lockedVaultEntryRelativePath) =>
      lockedVaultEntryRelativePath !== removedVaultEntryRelativePath && !isVaultRelativePathInsideFolder(lockedVaultEntryRelativePath, removedVaultEntryRelativePath),
  )
}

export function formatPapelizLockedEntriesFile(lockedVaultEntryRelativePaths: readonly string[], isWholeVaultEditingLocked = false): string {
  return `${JSON.stringify(
    {
      about: 'Notes and folders Papeliz keeps from being edited in this vault.',
      ...(isWholeVaultEditingLocked ? { wholeVaultLocked: true } : {}),
      lockedEntries: lockedVaultEntryRelativePaths,
    },
    null,
    2,
  )}\n`
}

export function parsePapelizWholeVaultEditingLock(lockedEntriesFileText: string | null): boolean {
  if (lockedEntriesFileText === null) return false
  try {
    return (JSON.parse(lockedEntriesFileText) as { wholeVaultLocked?: unknown } | null)?.wholeVaultLocked === true
  } catch {
    return false
  }
}

export function parsePapelizLockedEntriesFile(lockedEntriesFileText: string | null): string[] {
  if (lockedEntriesFileText === null) return []
  try {
    const lockedEntries = (JSON.parse(lockedEntriesFileText) as { lockedEntries?: unknown } | null)?.lockedEntries
    return Array.isArray(lockedEntries) ? lockedEntries.filter((lockedEntry): lockedEntry is string => typeof lockedEntry === 'string' && lockedEntry.length > 0) : []
  } catch {
    return []
  }
}
