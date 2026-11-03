import type { PapelizVaultSyncableFileStat } from './papeliz-directory-handle-vault-adapter'
import { PapelizVaultOperationError, type PapelizVaultAdapter } from './papeliz-vault-adapter'
import { isVaultFolderSearchedForSyncableFiles } from './papeliz-vault-folder-adapter-rules'
import { isVaultFileRelativePathSyncable, papelizVaultRootFolderRelativePath, papelizVaultTrashFolderName, splitVaultRelativePath } from './papeliz-vault-relative-paths'

// What a vault adapter adds so vault encryption can reach the files as they are stored, by their paths
// on disk: an End-to-end vault's encrypted files, and every file a change of kind rewrites. A folder on
// disk, a folder in Papeliz for Windows and a browser vault have it; the sample vault doesn't, so it
// can't be encrypted. The paths are the vault's own ("papeliz-encrypted-files/pzentry_….papeliz-encrypted",
// "Ideas/Plan.md"), checked by the same rules as every other vault path.
export interface PapelizVaultStoredFileAccess {
  // Every file a change of kind carries (isVaultFileRelativePathCarriedByVaultEncryption), with its size
  // and last change.
  listStoredVaultFileStats(): Promise<PapelizVaultSyncableFileStat[]>
  // Sync's own: any file, whole.
  readVaultFileBytes(vaultFileRelativePath: string): Promise<Uint8Array>
  // Writes the whole file, making its folders; the old contents are replaced whole or not at all. Only
  // a file a change of kind carries.
  writeStoredVaultFileBytes(storedVaultFileRelativePath: string, storedVaultFileBytes: Uint8Array): Promise<void>
  // Removes a file outright, or a folder only when it is empty (a folder with anything in it fails). The
  // vault's own deletes still go to `.trash/`: this is for a file whose copy is already written and
  // read back, in the encrypted or plain form.
  removeStoredVaultEntry(storedVaultEntryRelativePath: string): Promise<void>
  // Makes the folder and any missing folders above it; a folder already there is fine.
  makeStoredVaultFolder(storedVaultFolderRelativePath: string): Promise<void>
}

export function hasPapelizVaultStoredFileAccess(papelizVaultAdapter: PapelizVaultAdapter): papelizVaultAdapter is PapelizVaultAdapter & PapelizVaultStoredFileAccess {
  const storedFileAccessMethods = papelizVaultAdapter as Partial<PapelizVaultStoredFileAccess>
  return (
    typeof storedFileAccessMethods.listStoredVaultFileStats === 'function' &&
    typeof storedFileAccessMethods.readVaultFileBytes === 'function' &&
    typeof storedFileAccessMethods.writeStoredVaultFileBytes === 'function' &&
    typeof storedFileAccessMethods.removeStoredVaultEntry === 'function' &&
    typeof storedFileAccessMethods.makeStoredVaultFolder === 'function'
  )
}

const papelizVaultGitFolderName = '.git'

// A file a change of kind carries: every file Sync carries (the notes and files outside hidden folders,
// `.papeliz/` and `.csessions/`), and everything in the vault's `.trash/` but a `.git/` folder in it.
// Other apps' hidden folders (`.git/`, `.obsidian/`, ...) and hidden files stay as they are.
export function isVaultFileRelativePathCarriedByVaultEncryption(vaultFileRelativePath: string): boolean {
  if (isVaultFileRelativePathSyncable(vaultFileRelativePath)) return true
  const vaultPathSegments = splitVaultRelativePath(vaultFileRelativePath)
  return vaultPathSegments[0] === papelizVaultTrashFolderName && vaultPathSegments.length > 1 && !vaultPathSegments.includes(papelizVaultGitFolderName)
}

// Where the listing above goes: Sync's folders, `.trash/` at the vault's top, and every folder inside
// `.trash/` but a `.git/`.
export function isVaultFolderSearchedForVaultEncryption(vaultParentFolderRelativePath: string, vaultFolderName: string): boolean {
  if (vaultFolderName === papelizVaultGitFolderName) return false
  if (vaultParentFolderRelativePath === papelizVaultRootFolderRelativePath && vaultFolderName === papelizVaultTrashFolderName) return true
  if (splitVaultRelativePath(vaultParentFolderRelativePath)[0] === papelizVaultTrashFolderName) return true
  return isVaultFolderSearchedForSyncableFiles(vaultParentFolderRelativePath, vaultFolderName)
}

export function assertVaultFileRelativePathCarriedByVaultEncryption(storedVaultFileRelativePath: string): void {
  if (!isVaultFileRelativePathCarriedByVaultEncryption(storedVaultFileRelativePath)) throw new PapelizVaultOperationError('Hidden Folder')
}

// A folder the stored access may make or remove: one a carried file can sit in.
export function assertVaultFolderRelativePathCarriedByVaultEncryption(storedVaultFolderRelativePath: string): void {
  const vaultPathSegments = splitVaultRelativePath(storedVaultFolderRelativePath)
  if (vaultPathSegments.length === 0) throw new PapelizVaultOperationError('Outside Vault')
  const isFolderSearched = vaultPathSegments.every((vaultPathSegment, vaultPathSegmentIndex) =>
    isVaultFolderSearchedForVaultEncryption(vaultPathSegments.slice(0, vaultPathSegmentIndex).join('/'), vaultPathSegment),
  )
  if (!isFolderSearched) throw new PapelizVaultOperationError('Hidden Folder')
}

// Removing: a carried file, or a folder one can sit in.
export function assertVaultEntryRelativePathCarriedByVaultEncryption(storedVaultEntryRelativePath: string): void {
  if (!isVaultFileRelativePathCarriedByVaultEncryption(storedVaultEntryRelativePath)) assertVaultFolderRelativePathCarriedByVaultEncryption(storedVaultEntryRelativePath)
}

// Plain writes ------------------------------------------------------------------------------------------
// An End-to-end vault's own adapter is never handed out as it is. Locked, it is wrapped so every write
// fails with 'Plain Write Refused' (reads still work: they find only encrypted bytes); only this
// module's callers reach the adapter behind it, to write the encrypted files.

const papelizVaultAdaptersBehindPlainWriteRefusal = new WeakMap<PapelizVaultAdapter, PapelizVaultAdapter>()

const papelizVaultAdapterWriteMethodNames = [
  'writeVaultNoteText',
  'createVaultNote',
  'createVaultFolder',
  'createVaultAttachmentFile',
  'renameVaultEntry',
  'copyVaultEntry',
  'importVaultFilesIntoNewFolder',
  'moveVaultEntryToTrash',
  'restoreVaultEntryFromTrash',
  'takeBackEmptyNewVaultNote',
  'writePapelizVaultSettingsFile',
  'writeVaultFileBytes',
  'writeStoredVaultFileBytes',
  'removeStoredVaultEntry',
  'makeStoredVaultFolder',
] as const

function rejectPlainWriteIntoEndToEndVault(): Promise<never> {
  return Promise.reject(new PapelizVaultOperationError('Plain Write Refused'))
}

export function refusePlainWritesIntoPapelizEndToEndVault(storedVaultAdapter: PapelizVaultAdapter): PapelizVaultAdapter {
  const plainWriteRefusingAdapter = new Proxy(storedVaultAdapter, {
    get(proxiedVaultAdapter, vaultAdapterPropertyName, proxyReceiver) {
      if ((papelizVaultAdapterWriteMethodNames as readonly (string | symbol)[]).includes(vaultAdapterPropertyName)) {
        return typeof Reflect.get(proxiedVaultAdapter, vaultAdapterPropertyName) === 'function' ? rejectPlainWriteIntoEndToEndVault : undefined
      }
      const vaultAdapterProperty: unknown = Reflect.get(proxiedVaultAdapter, vaultAdapterPropertyName, proxyReceiver)
      return typeof vaultAdapterProperty === 'function' ? vaultAdapterProperty.bind(proxiedVaultAdapter) : vaultAdapterProperty
    },
  })
  papelizVaultAdaptersBehindPlainWriteRefusal.set(plainWriteRefusingAdapter, storedVaultAdapter)
  return plainWriteRefusingAdapter
}

// The adapter behind the refusal, or the adapter itself when it has none.
export function readPapelizVaultAdapterBehindPlainWriteRefusal(papelizVaultAdapter: PapelizVaultAdapter): PapelizVaultAdapter {
  return papelizVaultAdaptersBehindPlainWriteRefusal.get(papelizVaultAdapter) ?? papelizVaultAdapter
}
