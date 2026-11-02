import { PapelizVaultOperationError } from './papeliz-vault-adapter'
import {
  getVaultEntryName,
  isPapelizVaultSettingsFileName,
  isVaultRelativePathInsideFolder,
  isVaultRelativePathInTrash,
  isVaultRelativePathWritableByPapeliz,
  papelizVaultRootFolderRelativePath,
  papelizVaultSettingsFolderName,
  papelizVaultSyncedHiddenFolderNames,
  pickFreeVaultEntryName,
  splitVaultFileNameAtExtension,
  splitVaultRelativePath,
} from './papeliz-vault-relative-paths'
import { isVaultFileSampleBytesPlainText } from './papeliz-vault-text-files'

// What every vault kept in a real folder does the same way, however it reaches the folder: through
// directory handles in a browser (papeliz-directory-handle-vault-adapter.ts) or by path in Papeliz for
// Windows (papeliz-desktop-folder-vault-adapter.ts). Names compare without case, the way Windows and
// macOS folders do.

// Listed under Show Hidden but never opened: it holds no notes and can be very large.
const papelizVaultGitFolderName = '.git'

// The file list never shows Papeliz's own `.papeliz/`, Show Hidden or not. Other hidden folders and
// files (.git, .trash, ...) are not part of the notes, except Papeliz's own saved chats; Show Hidden
// lists them all.
export function isVaultEntryLeftOutOfTreeListing(vaultEntryRelativePath: string, isEveryHiddenVaultEntryListed: boolean): boolean {
  if (vaultEntryRelativePath === papelizVaultSettingsFolderName) return true
  return getVaultEntryName(vaultEntryRelativePath).startsWith('.') && !isEveryHiddenVaultEntryListed && !isVaultRelativePathWritableByPapeliz(vaultEntryRelativePath)
}

// The file list goes into every folder it lists but `.git/`.
export function isVaultFolderOpenedForTreeListing(vaultFolderName: string): boolean {
  return vaultFolderName !== papelizVaultGitFolderName
}

// Papeliz Sync goes into every folder that isn't hidden, and into `.papeliz/` and `.csessions/` at
// the vault's top.
export function isVaultFolderSearchedForSyncableFiles(vaultParentFolderRelativePath: string, vaultFolderName: string): boolean {
  const isSyncedHiddenFolder = vaultParentFolderRelativePath === papelizVaultRootFolderRelativePath && papelizVaultSyncedHiddenFolderNames.includes(vaultFolderName)
  return !vaultFolderName.startsWith('.') || isSyncedHiddenFolder
}

export function assertPapelizVaultSettingsFileName(papelizVaultSettingsFileName: string): void {
  if (!isPapelizVaultSettingsFileName(papelizVaultSettingsFileName)) {
    throw new PapelizVaultOperationError('Unknown Settings File')
  }
}

export function assertVaultPathWritableByPapeliz(vaultEntryRelativePath: string): void {
  if (!isVaultRelativePathWritableByPapeliz(vaultEntryRelativePath)) {
    throw new PapelizVaultOperationError('Hidden Folder')
  }
}

// A note or folder inside `.trash/`, never the trash folder itself.
export function assertVaultPathInsideTrash(vaultEntryRelativePath: string): void {
  if (!isVaultRelativePathInTrash(vaultEntryRelativePath) || splitVaultRelativePath(vaultEntryRelativePath).length < 2) {
    throw new PapelizVaultOperationError('Not In Trash')
  }
}

// A folder is never copied into itself, or into a folder inside it.
export function assertVaultCopyOutsideItsSource(fromVaultEntryRelativePath: string, toVaultEntryRelativePath: string): void {
  if (isVaultRelativePathInsideFolder(toVaultEntryRelativePath, fromVaultEntryRelativePath)) {
    throw new PapelizVaultOperationError('Into Itself')
  }
}

// The names already in a folder, against the one about to be made there, ignoring case.
export function assertVaultEntryNameIsFreeAmongNames(existingVaultEntryNames: Iterable<string>, vaultEntryName: string): void {
  const lowerCaseVaultEntryName = vaultEntryName.toLowerCase()
  for (const existingVaultEntryName of existingVaultEntryNames) {
    if (existingVaultEntryName.toLowerCase() === lowerCaseVaultEntryName) {
      throw new PapelizVaultOperationError('Name Taken')
    }
  }
}

// On Windows and macOS "inbox.md" and "Inbox.md" are the same file, so a rename that changes only
// the case of a name goes through a temporary name first.
export function isVaultRenameCaseOnly(fromVaultEntryRelativePath: string, toVaultEntryRelativePath: string): boolean {
  return fromVaultEntryRelativePath.toLowerCase() === toVaultEntryRelativePath.toLowerCase()
}

export function pickVaultCaseOnlyRenameTemporaryName(fromVaultEntryName: string): string {
  return pickFreeVaultEntryName(`${fromVaultEntryName}.papeliz-renaming`, '', (candidateName) => candidateName.toLowerCase() === fromVaultEntryName.toLowerCase())
}

// The name an entry takes in `.trash/`: its own, or the next free one ("Inbox 2.md"). A folder's whole
// name is its base, so "Plans.v2" becomes "Plans.v2 2".
export function pickFreeVaultTrashEntryName(vaultEntryName: string, isVaultEntryFolder: boolean, vaultTrashEntryNames: Iterable<string>): string {
  const vaultTrashEntryNamesInLowerCase = new Set<string>()
  for (const vaultTrashEntryName of vaultTrashEntryNames) vaultTrashEntryNamesInLowerCase.add(vaultTrashEntryName.toLowerCase())
  const { vaultFileBaseName, vaultFileExtension } = isVaultEntryFolder ? { vaultFileBaseName: vaultEntryName, vaultFileExtension: '' } : splitVaultFileNameAtExtension(vaultEntryName)
  return pickFreeVaultEntryName(vaultFileBaseName, vaultFileExtension, (candidateName) => vaultTrashEntryNamesInLowerCase.has(candidateName.toLowerCase()))
}

// The byte check of a file whose name doesn't say whether it is text, kept until the file changes,
// so listing the vault again reads only files that are new or changed. A file whose size or last
// change the folder doesn't give is checked every time.
export class PapelizVaultFileByteCheckMemory {
  private readonly vaultFileByteChecksByRelativePath = new Map<string, { checkedVaultFileByteLength: number; checkedVaultFileModifiedAt: number; isCheckedVaultFilePlainText: boolean }>()

  async isVaultFilePlainText(
    vaultFileRelativePath: string,
    vaultFileByteLength: number | null,
    vaultFileModifiedAt: number | null,
    readVaultFileSampleBytes: () => Promise<Uint8Array>,
  ): Promise<boolean> {
    const earlierVaultFileByteCheck = this.vaultFileByteChecksByRelativePath.get(vaultFileRelativePath)
    const isVaultFileChangeKnown = vaultFileByteLength !== null && vaultFileModifiedAt !== null
    if (isVaultFileChangeKnown && earlierVaultFileByteCheck?.checkedVaultFileByteLength === vaultFileByteLength && earlierVaultFileByteCheck.checkedVaultFileModifiedAt === vaultFileModifiedAt) {
      return earlierVaultFileByteCheck.isCheckedVaultFilePlainText
    }
    const isCheckedVaultFilePlainText = isVaultFileSampleBytesPlainText(await readVaultFileSampleBytes())
    if (isVaultFileChangeKnown) {
      this.vaultFileByteChecksByRelativePath.set(vaultFileRelativePath, {
        checkedVaultFileByteLength: vaultFileByteLength,
        checkedVaultFileModifiedAt: vaultFileModifiedAt,
        isCheckedVaultFilePlainText,
      })
    }
    return isCheckedVaultFilePlainText
  }
}
