// One interface for every place a vault can live: the bundled sample vault in memory, a folder on
// the user's disk, or a browser vault in the browser's Origin Private File System. The rest of the
// app talks only to this interface.

export type PapelizVaultKind = 'sample-vault-in-memory' | 'folder-on-disk' | 'browser-vault-in-opfs'

// A folder or a browser vault outlives this tab: other tabs (and, for a folder, other apps) can
// change it, and unsaved typing gets recovery copies. The sample vault is this tab's alone.
export function isPapelizVaultKeptBeyondThisTab(papelizVaultKind: PapelizVaultKind): boolean {
  return papelizVaultKind !== 'sample-vault-in-memory'
}

// A text file is a plain-text file that isn't a note (JSON, YAML, `.gitignore`, a script):
// it shows in the file list and opens in a tab, but links, search, the outline, the AI Assistant's
// note tools and export know only notes (papeliz-vault-text-files.ts says which files are text).
export type PapelizVaultEntryKind = 'note' | 'folder' | 'text-file'

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
  // Every folder, `.md` note and text file. Hidden folders and files (`.git/`, `.trash/`,
  // `.gitignore`, ...) are left out, except Papeliz's own `.csessions/` (and the earlier
  // `.chatsession/`), unless the options ask for every hidden entry. Papeliz's own `.papeliz/` is
  // never listed.
  listVaultTreeEntries(vaultTreeListingOptions?: PapelizVaultTreeListingOptions): Promise<PapelizVaultTreeEntry[]>
  // A note's or a text file's text; writing it and the rest below take either. A text file over
  // 5 MB isn't read and fails with "Text File Over 5 MB" (papeliz-vault-text-files.ts).
  readVaultNoteText(vaultNoteRelativePath: string): Promise<string>
  writeVaultNoteText(vaultNoteRelativePath: string, vaultNoteText: string): Promise<void>
  // Fails when something already has that name.
  createVaultNote(vaultNoteRelativePath: string, vaultNoteText: string): Promise<void>
  createVaultFolder(vaultFolderRelativePath: string): Promise<void>
  // A file that isn't a note (a picture added to an AI Assistant chat), written whole. Its folder
  // must be there already, and its name free.
  createVaultAttachmentFile(vaultAttachmentFileRelativePath: string, vaultAttachmentFileBlob: Blob): Promise<void>
  // Every file that isn't a note (pictures, PDFs and the like), for an export to find what notes
  // show or link to. Hidden folders and files are left out.
  listVaultAttachmentFileRelativePaths(): Promise<string[]>
  // A file that isn't a note, whole. Fails when it isn't there.
  readVaultAttachmentFileBlob(vaultAttachmentFileRelativePath: string): Promise<Blob>
  // Renames or moves a note or a whole folder. Fails when the target name is taken.
  renameVaultEntry(fromVaultEntryRelativePath: string, toVaultEntryRelativePath: string): Promise<void>
  // Copies a note, or a folder with everything in it, to a new path. Fails when the target name is
  // taken or a folder would be copied into itself.
  copyVaultEntry(fromVaultEntryRelativePath: string, toVaultEntryRelativePath: string): Promise<void>
  // Moves a note or folder into the vault's `.trash/` folder; never deletes it.
  // Returns where it went, for example ".trash/Inbox.md".
  moveVaultEntryToTrash(vaultEntryRelativePath: string): Promise<string>
  // Moves a note or folder out of `.trash/` (Restore) to a path outside hidden folders. That path's
  // folder must be there already, and its name free.
  restoreVaultEntryFromTrash(vaultTrashEntryRelativePath: string, toVaultEntryRelativePath: string): Promise<void>
  // Takes back a note New Note made a moment ago, while it is still empty: Escape on its name.
  // Anything with even one byte in it stays, and this gives back false. A vault without it keeps
  // the note.
  takeBackEmptyNewVaultNote?(newVaultNoteRelativePath: string): Promise<boolean>
  // Papeliz's own files for this vault, in its `.papeliz/` folder (the file list's order, say), by
  // plain file name. Reading gives null when the file is not there yet; writing makes the folder
  // when needed. Nothing else in a hidden folder is read or written.
  readPapelizVaultSettingsFile(papelizVaultSettingsFileName: string): Promise<string | null>
  writePapelizVaultSettingsFile(papelizVaultSettingsFileName: string, papelizVaultSettingsFileText: string): Promise<void>
  // Runs one change (a save's read, merge and write; a rename; a move) while no other tab of this
  // browser changes the vault. Only a browser vault has it; the workspace runs its changes through it
  // one at a time, so it is never called inside itself.
  runVaultChangeExclusively?<VaultChangeResult>(vaultChange: () => Promise<VaultChangeResult>): Promise<VaultChangeResult>
  // The workspace is done with the vault (Close Vault, or another vault opened).
  closeVaultAdapter?(): void
}

export class PapelizVaultOperationError extends Error {
  override readonly name = 'PapelizVaultOperationError'
}

// The note or folder isn't there (any more): moved, renamed or trashed by another tab or app.
export function isPapelizVaultEntryMissingError(vaultError: unknown): boolean {
  if (vaultError instanceof PapelizVaultOperationError) return vaultError.message === 'Not In Vault'
  return vaultError instanceof DOMException && vaultError.name === 'NotFoundError'
}

export function describePapelizVaultError(vaultError: unknown): string {
  if (vaultError instanceof PapelizVaultOperationError) return vaultError.message
  if (vaultError instanceof DOMException) {
    if (vaultError.name === 'NotAllowedError') return 'No Permission'
    if (vaultError.name === 'NotFoundError') return 'File Not Found'
    if (vaultError.name === 'NoModificationAllowedError') return 'File In Use'
    if (vaultError.name === 'QuotaExceededError') return 'Disk Full'
  }
  // The browser's own words stay out of the toast; they go to the console for debugging.
  console.warn('Papeliz vault error:', vaultError)
  return 'Unknown Error'
}
