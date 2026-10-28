// One interface for every place a vault can live: the bundled sample vault in memory, or a folder
// on the user's disk. The rest of the app talks only to this interface.

export type PapelizVaultKind = 'sample-vault-in-memory' | 'folder-on-disk'

export type PapelizVaultEntryKind = 'note' | 'folder'

export interface PapelizVaultTreeEntry {
  vaultEntryRelativePath: string
  vaultEntryKind: PapelizVaultEntryKind
}

export interface PapelizVaultTreeListingOptions {
  // Show Hidden: also list hidden folders and their notes (`.trash/`, another app's folder). A
  // `.git/` folder is listed but not opened: it holds no notes and can be very large.
  isEveryHiddenVaultEntryListed: boolean
}

export interface PapelizVaultAdapter {
  readonly papelizVaultKind: PapelizVaultKind
  // Every folder and `.md` note. Hidden folders (`.git/`, `.trash/`, ...) are left out, except
  // Papeliz's own `.csessions/` (and the earlier `.chatsession/`), unless the options ask for every
  // hidden entry.
  listVaultTreeEntries(vaultTreeListingOptions?: PapelizVaultTreeListingOptions): Promise<PapelizVaultTreeEntry[]>
  readVaultNoteText(vaultNoteRelativePath: string): Promise<string>
  writeVaultNoteText(vaultNoteRelativePath: string, vaultNoteText: string): Promise<void>
  // Fails when something already has that name.
  createVaultNote(vaultNoteRelativePath: string, vaultNoteText: string): Promise<void>
  createVaultFolder(vaultFolderRelativePath: string): Promise<void>
  // Renames or moves a note or a whole folder. Fails when the target name is taken.
  renameVaultEntry(fromVaultEntryRelativePath: string, toVaultEntryRelativePath: string): Promise<void>
  // Copies a note, or a folder with everything in it, to a new path. Fails when the target name is
  // taken or a folder would be copied into itself.
  copyVaultEntry(fromVaultEntryRelativePath: string, toVaultEntryRelativePath: string): Promise<void>
  // Moves a note or folder into the vault's `.trash/` folder; never deletes it.
  // Returns where it went, for example ".trash/Inbox.md".
  moveVaultEntryToTrash(vaultEntryRelativePath: string): Promise<string>
  // Papeliz's own files for this vault, in its `.papeliz/` folder (the file list's order, say), by
  // plain file name. Reading gives null when the file is not there yet; writing makes the folder
  // when needed. Nothing else in a hidden folder is read or written.
  readPapelizVaultSettingsFile(papelizVaultSettingsFileName: string): Promise<string | null>
  writePapelizVaultSettingsFile(papelizVaultSettingsFileName: string, papelizVaultSettingsFileText: string): Promise<void>
}

export class PapelizVaultOperationError extends Error {
  override readonly name = 'PapelizVaultOperationError'
}

export function describePapelizVaultError(vaultError: unknown): string {
  if (vaultError instanceof PapelizVaultOperationError) return vaultError.message
  if (vaultError instanceof DOMException) {
    if (vaultError.name === 'NotAllowedError') return 'Papeliz no longer has permission to this folder.'
    if (vaultError.name === 'NotFoundError') return 'The file is no longer in the folder.'
    if (vaultError.name === 'NoModificationAllowedError') return 'The file is locked by another program.'
    if (vaultError.name === 'QuotaExceededError') return 'The disk is full.'
    return vaultError.message || vaultError.name
  }
  if (vaultError instanceof Error) return vaultError.message
  return 'Something went wrong.'
}
