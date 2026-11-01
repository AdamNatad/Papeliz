import {
  getVaultEntryName,
  isVaultRelativePathInTrash,
  joinVaultRelativePath,
  papelizVaultRootFolderRelativePath,
  papelizVaultTrashFolderName,
  splitVaultRelativePath,
} from '../vault/papeliz-vault-relative-paths'

// Where each note or folder in the trash came from, so Restore can put it back there. Papeliz
// notes it down when it moves something into `.trash/`; the record travels with the vault, in
// `.papeliz/trash-origins.json`:
//   { "about": "…", "trashOrigins": { ".trash/Inbox 2.md": "Projects/Inbox.md" } }
// An entry with no record (moved there by another app, say) goes back to the top of the vault.

export const papelizTrashOriginsFileName = 'trash-origins.json'

// Each place before the trash, by the entry's path in `.trash/`.
export type PapelizVaultTrashOrigins = Readonly<Record<string, string>>

export function parsePapelizTrashOriginsFile(trashOriginsFileText: string | null): PapelizVaultTrashOrigins {
  if (trashOriginsFileText === null) return {}
  try {
    const savedTrashOrigins = (JSON.parse(trashOriginsFileText) as { trashOrigins?: unknown } | null)?.trashOrigins
    if (typeof savedTrashOrigins !== 'object' || savedTrashOrigins === null) return {}
    return Object.fromEntries(
      Object.entries(savedTrashOrigins).filter(
        (savedTrashOrigin): savedTrashOrigin is [string, string] =>
          isVaultRelativePathInTrash(savedTrashOrigin[0]) &&
          typeof savedTrashOrigin[1] === 'string' &&
          splitVaultRelativePath(savedTrashOrigin[1]).length > 0 &&
          !isVaultRelativePathInTrash(savedTrashOrigin[1]),
      ),
    )
  } catch {
    return {}
  }
}

export function formatPapelizTrashOriginsFile(vaultTrashOrigins: PapelizVaultTrashOrigins): string {
  return `${JSON.stringify({ about: 'Where each note or folder in this vault’s .trash folder was before, for Restore.', trashOrigins: vaultTrashOrigins }, null, 2)}\n`
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
