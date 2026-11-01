import {
  getVaultEntryName,
  isVaultRelativePathInTrash,
  isVaultRelativePathInsideFolder,
  joinVaultRelativePath,
  papelizVaultRootFolderRelativePath,
  papelizVaultTrashFolderName,
  splitVaultRelativePath,
} from '../vault/papeliz-vault-relative-paths'
import { carryVaultEntryLocksThroughMove, removeVaultEntryLocksInside } from './papeliz-vault-entry-locks'
import {
  carryVaultEntryLooksThroughMove,
  parsePapelizStoredVaultEntryLooks,
  removeVaultEntryLooksInside,
  type PapelizVaultEntryLook,
  type PapelizVaultEntryLooks,
} from './papeliz-vault-entry-looks'

// Where each note or folder in the trash came from, so Restore can put it back there, and the locks
// and colors and icons it had, so Restore brings those back too. Papeliz notes it down when it moves
// something into `.trash/`; the record travels with the vault, in `.papeliz/trash-origins.json`:
//   { "about": "…", "trashOrigins": { ".trash/Inbox 2.md": "Projects/Inbox.md" },
//     "trashedEntryLocks": [".trash/Inbox 2.md"], "trashedEntryLooks": { ".trash/Inbox 2.md": { "lookColor": "blue" } } }
// The live lock and look lists drop an entry while it is in the trash. An entry with no record
// (moved there by another app, say) goes back to the top of the vault, as it is.

export const papelizTrashOriginsFileName = 'trash-origins.json'

// Each place before the trash, by the entry's path in `.trash/`.
export type PapelizVaultTrashOrigins = Readonly<Record<string, string>>

export interface PapelizVaultTrashRecord {
  vaultTrashOrigins: PapelizVaultTrashOrigins
  // The locks and looks on trashed entries and inside them, by their paths in `.trash/`.
  trashedVaultEntryLocks: readonly string[]
  trashedVaultEntryLooks: PapelizVaultEntryLooks
}

export const emptyPapelizVaultTrashRecord: PapelizVaultTrashRecord = { vaultTrashOrigins: {}, trashedVaultEntryLocks: [], trashedVaultEntryLooks: {} }

export function parsePapelizTrashOriginsFile(trashOriginsFileText: string | null): PapelizVaultTrashRecord {
  if (trashOriginsFileText === null) return emptyPapelizVaultTrashRecord
  let savedTrashRecord: { trashOrigins?: unknown; trashedEntryLocks?: unknown; trashedEntryLooks?: unknown } | null
  try {
    savedTrashRecord = JSON.parse(trashOriginsFileText) as typeof savedTrashRecord
  } catch {
    return emptyPapelizVaultTrashRecord
  }
  const savedTrashOrigins = savedTrashRecord?.trashOrigins
  const savedTrashedEntryLocks = savedTrashRecord?.trashedEntryLocks
  return {
    vaultTrashOrigins:
      typeof savedTrashOrigins !== 'object' || savedTrashOrigins === null
        ? {}
        : Object.fromEntries(
            Object.entries(savedTrashOrigins).filter(
              (savedTrashOrigin): savedTrashOrigin is [string, string] =>
                isVaultRelativePathInTrash(savedTrashOrigin[0]) &&
                typeof savedTrashOrigin[1] === 'string' &&
                splitVaultRelativePath(savedTrashOrigin[1]).length > 0 &&
                !isVaultRelativePathInTrash(savedTrashOrigin[1]),
            ),
          ),
    trashedVaultEntryLocks: Array.isArray(savedTrashedEntryLocks)
      ? savedTrashedEntryLocks.filter(
          (savedTrashedEntryLock): savedTrashedEntryLock is string => typeof savedTrashedEntryLock === 'string' && isVaultRelativePathInTrash(savedTrashedEntryLock),
        )
      : [],
    trashedVaultEntryLooks: Object.fromEntries(
      Object.entries(parsePapelizStoredVaultEntryLooks(savedTrashRecord?.trashedEntryLooks)).filter(([trashedVaultEntryRelativePath]) =>
        isVaultRelativePathInTrash(trashedVaultEntryRelativePath),
      ),
    ),
  }
}

export function formatPapelizTrashOriginsFile(vaultTrashRecord: PapelizVaultTrashRecord): string {
  return `${JSON.stringify(
    {
      about: 'Where each note or folder in this vault’s .trash folder was before, and the locks, colors and icons it had, for Restore.',
      trashOrigins: vaultTrashRecord.vaultTrashOrigins,
      ...(vaultTrashRecord.trashedVaultEntryLocks.length > 0 ? { trashedEntryLocks: vaultTrashRecord.trashedVaultEntryLocks } : {}),
      ...(Object.keys(vaultTrashRecord.trashedVaultEntryLooks).length > 0 ? { trashedEntryLooks: vaultTrashRecord.trashedVaultEntryLooks } : {}),
    },
    null,
    2,
  )}\n`
}

// The entry right inside `.trash/` that holds `vaultTrashEntryRelativePath` (or is it).
export function getTopVaultTrashEntryRelativePath(vaultTrashEntryRelativePath: string): string {
  return joinVaultRelativePath(papelizVaultTrashFolderName, splitVaultRelativePath(vaultTrashEntryRelativePath)[1] ?? '')
}

// Where Restore puts a note or folder from the trash: back where it was, or, inside a trashed
// folder, where it was inside that folder. With no record, at the top of the vault.
export function findVaultTrashEntryRestorePath(vaultTrashEntryRelativePath: string, vaultTrashOrigins: PapelizVaultTrashOrigins): string {
  const topVaultTrashEntryRelativePath = getTopVaultTrashEntryRelativePath(vaultTrashEntryRelativePath)
  const topVaultTrashEntryOrigin =
    vaultTrashOrigins[topVaultTrashEntryRelativePath] ?? joinVaultRelativePath(papelizVaultRootFolderRelativePath, getVaultEntryName(topVaultTrashEntryRelativePath))
  const pathInsideTopVaultTrashEntry = splitVaultRelativePath(vaultTrashEntryRelativePath).slice(2)
  return [topVaultTrashEntryOrigin, ...pathInsideTopVaultTrashEntry].join('/')
}

function pickVaultEntryLooksInside(vaultEntryLooks: PapelizVaultEntryLooks, vaultEntryRelativePath: string): Record<string, PapelizVaultEntryLook> {
  return Object.fromEntries(
    Object.entries(vaultEntryLooks).filter(([lookedVaultEntryRelativePath]) => isVaultRelativePathInsideFolder(lookedVaultEntryRelativePath, vaultEntryRelativePath)),
  )
}

// Notes down an entry Papeliz just moved into `.trash/`: where it was, and the locks and looks on it
// and inside it, at their paths in the trash. Anything the record still held at that path belonged
// to an entry that has since left the trash some other way, so it goes.
export function recordVaultEntryMovedToTrash(
  vaultTrashRecord: PapelizVaultTrashRecord,
  vaultEntryRelativePath: string,
  vaultTrashEntryRelativePath: string,
  lockedVaultEntryRelativePaths: readonly string[],
  vaultEntryLooks: PapelizVaultEntryLooks,
): PapelizVaultTrashRecord {
  const trashedEntryLocks = lockedVaultEntryRelativePaths.filter((lockedVaultEntryRelativePath) =>
    isVaultRelativePathInsideFolder(lockedVaultEntryRelativePath, vaultEntryRelativePath),
  )
  return {
    vaultTrashOrigins: { ...vaultTrashRecord.vaultTrashOrigins, [vaultTrashEntryRelativePath]: vaultEntryRelativePath },
    trashedVaultEntryLocks: [
      ...removeVaultEntryLocksInside(vaultTrashRecord.trashedVaultEntryLocks, vaultTrashEntryRelativePath),
      ...carryVaultEntryLocksThroughMove(trashedEntryLocks, vaultEntryRelativePath, vaultTrashEntryRelativePath),
    ],
    trashedVaultEntryLooks: {
      ...removeVaultEntryLooksInside(vaultTrashRecord.trashedVaultEntryLooks, vaultTrashEntryRelativePath),
      ...carryVaultEntryLooksThroughMove(pickVaultEntryLooksInside(vaultEntryLooks, vaultEntryRelativePath), vaultEntryRelativePath, vaultTrashEntryRelativePath),
    },
  }
}

// Takes a restored entry out of the record: its origin when it sat right inside `.trash/`, and the
// locks and looks on it and inside it, which come back at the path Restore put it.
export function takeVaultEntryRestoredFromTrash(
  vaultTrashRecord: PapelizVaultTrashRecord,
  vaultTrashEntryRelativePath: string,
  restoredVaultEntryRelativePath: string,
): {
  vaultTrashRecord: PapelizVaultTrashRecord
  restoredVaultEntryLocks: string[]
  restoredVaultEntryLooks: Record<string, PapelizVaultEntryLook>
} {
  const restoredTrashEntryLocks = vaultTrashRecord.trashedVaultEntryLocks.filter((trashedVaultEntryLock) =>
    isVaultRelativePathInsideFolder(trashedVaultEntryLock, vaultTrashEntryRelativePath),
  )
  return {
    vaultTrashRecord: {
      vaultTrashOrigins: Object.fromEntries(
        Object.entries(vaultTrashRecord.vaultTrashOrigins).filter(([savedVaultTrashEntryRelativePath]) => savedVaultTrashEntryRelativePath !== vaultTrashEntryRelativePath),
      ),
      trashedVaultEntryLocks: removeVaultEntryLocksInside(vaultTrashRecord.trashedVaultEntryLocks, vaultTrashEntryRelativePath),
      trashedVaultEntryLooks: removeVaultEntryLooksInside(vaultTrashRecord.trashedVaultEntryLooks, vaultTrashEntryRelativePath),
    },
    restoredVaultEntryLocks: carryVaultEntryLocksThroughMove(restoredTrashEntryLocks, vaultTrashEntryRelativePath, restoredVaultEntryRelativePath),
    restoredVaultEntryLooks: carryVaultEntryLooksThroughMove(
      pickVaultEntryLooksInside(vaultTrashRecord.trashedVaultEntryLooks, vaultTrashEntryRelativePath),
      vaultTrashEntryRelativePath,
      restoredVaultEntryRelativePath,
    ),
  }
}
