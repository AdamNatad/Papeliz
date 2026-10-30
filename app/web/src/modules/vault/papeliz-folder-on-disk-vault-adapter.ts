import { PapelizVaultOperationError, type PapelizVaultAdapter, type PapelizVaultTreeEntry, type PapelizVaultTreeListingOptions } from './papeliz-vault-adapter'
import {
  getVaultEntryName,
  getVaultEntryParentFolderRelativePath,
  isPapelizVaultSettingsFileName,
  isVaultNoteFileName,
  isVaultRelativePathInsideFolder,
  isVaultRelativePathWritableByPapeliz,
  joinVaultRelativePath,
  papelizVaultRootFolderRelativePath,
  papelizVaultSettingsFolderName,
  papelizVaultTrashFolderName,
  pickFreeVaultEntryName,
  splitVaultRelativePath,
} from './papeliz-vault-relative-paths'

type PapelizVaultEntryHandle = FileSystemFileHandle | FileSystemDirectoryHandle

// Listed under Show Hidden but never opened: it holds no notes and can be very large.
const papelizVaultGitFolderName = '.git'

// Folder listings type their entries as the base FileSystemHandle; `kind` tells the two apart.
function asPapelizVaultEntryHandle(fileSystemHandle: FileSystemHandle): PapelizVaultEntryHandle {
  return fileSystemHandle as PapelizVaultEntryHandle
}

// A vault that is a real folder on the user's disk, opened with the File System Access API
// (Chrome and Edge). Notes are written in place; nothing is ever deleted outright: a deleted note
// or folder is copied into the vault's `.trash/` folder before its original entry is removed.
export class PapelizFolderOnDiskVaultAdapter implements PapelizVaultAdapter {
  readonly papelizVaultKind = 'folder-on-disk' as const

  constructor(private readonly vaultRootFolderHandle: FileSystemDirectoryHandle) {}

  async listVaultTreeEntries(vaultTreeListingOptions?: PapelizVaultTreeListingOptions): Promise<PapelizVaultTreeEntry[]> {
    const isEveryHiddenVaultEntryListed = vaultTreeListingOptions?.isEveryHiddenVaultEntryListed === true
    const vaultTreeEntries: PapelizVaultTreeEntry[] = []
    const collectVaultFolderEntries = async (vaultFolderHandle: FileSystemDirectoryHandle, vaultFolderRelativePath: string) => {
      for await (const [vaultEntryName, listedVaultEntryHandle] of vaultFolderHandle.entries()) {
        const vaultEntryRelativePath = joinVaultRelativePath(vaultFolderRelativePath, vaultEntryName)
        // Hidden folders and files (.git, .trash, ...) are not part of the notes, except Papeliz's
        // own saved chats; Show Hidden lists them all.
        if (vaultEntryName.startsWith('.') && !isEveryHiddenVaultEntryListed && !isVaultRelativePathWritableByPapeliz(vaultEntryRelativePath)) continue
        const vaultEntryHandle = asPapelizVaultEntryHandle(listedVaultEntryHandle)
        if (vaultEntryHandle.kind === 'directory') {
          vaultTreeEntries.push({ vaultEntryRelativePath, vaultEntryKind: 'folder' })
          if (vaultEntryName !== papelizVaultGitFolderName) await collectVaultFolderEntries(vaultEntryHandle, vaultEntryRelativePath)
        } else if (isVaultNoteFileName(vaultEntryName)) {
          vaultTreeEntries.push({ vaultEntryRelativePath, vaultEntryKind: 'note' })
        }
      }
    }
    await collectVaultFolderEntries(this.vaultRootFolderHandle, papelizVaultRootFolderRelativePath)
    return vaultTreeEntries
  }

  async readPapelizVaultSettingsFile(papelizVaultSettingsFileName: string): Promise<string | null> {
    assertPapelizVaultSettingsFileName(papelizVaultSettingsFileName)
    try {
      const vaultSettingsFolderHandle = await this.vaultRootFolderHandle.getDirectoryHandle(papelizVaultSettingsFolderName)
      const vaultSettingsFileHandle = await vaultSettingsFolderHandle.getFileHandle(papelizVaultSettingsFileName)
      return await (await vaultSettingsFileHandle.getFile()).text()
    } catch (vaultSettingsReadError) {
      const vaultSettingsReadErrorName = (vaultSettingsReadError as { name?: unknown } | null)?.name
      if (vaultSettingsReadErrorName === 'NotFoundError' || vaultSettingsReadErrorName === 'TypeMismatchError') return null
      throw vaultSettingsReadError
    }
  }

  async writePapelizVaultSettingsFile(papelizVaultSettingsFileName: string, papelizVaultSettingsFileText: string): Promise<void> {
    assertPapelizVaultSettingsFileName(papelizVaultSettingsFileName)
    const vaultSettingsFolderHandle = await this.vaultRootFolderHandle.getDirectoryHandle(papelizVaultSettingsFolderName, { create: true })
    const vaultSettingsFileHandle = await vaultSettingsFolderHandle.getFileHandle(papelizVaultSettingsFileName, { create: true })
    await writeVaultFileContents(vaultSettingsFileHandle, papelizVaultSettingsFileText)
  }

  async readVaultNoteText(vaultNoteRelativePath: string): Promise<string> {
    const vaultParentFolderHandle = await this.getVaultFolderHandle(getVaultEntryParentFolderRelativePath(vaultNoteRelativePath))
    const vaultNoteFileHandle = await vaultParentFolderHandle.getFileHandle(getVaultEntryName(vaultNoteRelativePath))
    const vaultNoteFile = await vaultNoteFileHandle.getFile()
    return vaultNoteFile.text()
  }

  async writeVaultNoteText(vaultNoteRelativePath: string, vaultNoteText: string): Promise<void> {
    assertVaultPathWritableByPapeliz(vaultNoteRelativePath)
    const vaultParentFolderHandle = await this.getVaultFolderHandle(getVaultEntryParentFolderRelativePath(vaultNoteRelativePath))
    const vaultNoteFileHandle = await vaultParentFolderHandle.getFileHandle(getVaultEntryName(vaultNoteRelativePath), { create: true })
    await writeVaultFileContents(vaultNoteFileHandle, vaultNoteText)
  }

  async createVaultNote(vaultNoteRelativePath: string, vaultNoteText: string): Promise<void> {
    assertVaultPathWritableByPapeliz(vaultNoteRelativePath)
    const vaultNoteFileName = getVaultEntryName(vaultNoteRelativePath)
    const vaultParentFolderHandle = await this.getVaultFolderHandle(getVaultEntryParentFolderRelativePath(vaultNoteRelativePath))
    await assertVaultEntryNameIsFree(vaultParentFolderHandle, vaultNoteFileName)
    const vaultNoteFileHandle = await vaultParentFolderHandle.getFileHandle(vaultNoteFileName, { create: true })
    await writeVaultFileContents(vaultNoteFileHandle, vaultNoteText)
  }

  async createVaultAttachmentFile(vaultAttachmentFileRelativePath: string, vaultAttachmentFileBlob: Blob): Promise<void> {
    assertVaultPathWritableByPapeliz(vaultAttachmentFileRelativePath)
    const vaultAttachmentFileName = getVaultEntryName(vaultAttachmentFileRelativePath)
    const vaultParentFolderHandle = await this.getVaultFolderHandle(getVaultEntryParentFolderRelativePath(vaultAttachmentFileRelativePath))
    await assertVaultEntryNameIsFree(vaultParentFolderHandle, vaultAttachmentFileName)
    const vaultAttachmentFileHandle = await vaultParentFolderHandle.getFileHandle(vaultAttachmentFileName, { create: true })
    await writeVaultFileContents(vaultAttachmentFileHandle, vaultAttachmentFileBlob)
  }

  async listVaultAttachmentFileRelativePaths(): Promise<string[]> {
    const vaultAttachmentFileRelativePaths: string[] = []
    const collectVaultFolderAttachmentFiles = async (vaultFolderHandle: FileSystemDirectoryHandle, vaultFolderRelativePath: string) => {
      for await (const [vaultEntryName, listedVaultEntryHandle] of vaultFolderHandle.entries()) {
        if (vaultEntryName.startsWith('.')) continue
        const vaultEntryRelativePath = joinVaultRelativePath(vaultFolderRelativePath, vaultEntryName)
        const vaultEntryHandle = asPapelizVaultEntryHandle(listedVaultEntryHandle)
        if (vaultEntryHandle.kind === 'directory') await collectVaultFolderAttachmentFiles(vaultEntryHandle, vaultEntryRelativePath)
        else if (!isVaultNoteFileName(vaultEntryName)) vaultAttachmentFileRelativePaths.push(vaultEntryRelativePath)
      }
    }
    await collectVaultFolderAttachmentFiles(this.vaultRootFolderHandle, papelizVaultRootFolderRelativePath)
    return vaultAttachmentFileRelativePaths
  }

  async readVaultAttachmentFileBlob(vaultAttachmentFileRelativePath: string): Promise<Blob> {
    const vaultParentFolderHandle = await this.getVaultFolderHandle(getVaultEntryParentFolderRelativePath(vaultAttachmentFileRelativePath))
    const vaultAttachmentFileHandle = await vaultParentFolderHandle.getFileHandle(getVaultEntryName(vaultAttachmentFileRelativePath))
    return vaultAttachmentFileHandle.getFile()
  }

  async createVaultFolder(vaultFolderRelativePath: string): Promise<void> {
    assertVaultPathWritableByPapeliz(vaultFolderRelativePath)
    const vaultFolderName = getVaultEntryName(vaultFolderRelativePath)
    const vaultParentFolderHandle = await this.getVaultFolderHandle(getVaultEntryParentFolderRelativePath(vaultFolderRelativePath))
    await assertVaultEntryNameIsFree(vaultParentFolderHandle, vaultFolderName)
    await vaultParentFolderHandle.getDirectoryHandle(vaultFolderName, { create: true })
  }

  async renameVaultEntry(fromVaultEntryRelativePath: string, toVaultEntryRelativePath: string): Promise<void> {
    assertVaultPathWritableByPapeliz(fromVaultEntryRelativePath)
    assertVaultPathWritableByPapeliz(toVaultEntryRelativePath)
    const fromVaultParentFolderHandle = await this.getVaultFolderHandle(getVaultEntryParentFolderRelativePath(fromVaultEntryRelativePath))
    const toVaultParentFolderHandle = await this.getVaultFolderHandle(getVaultEntryParentFolderRelativePath(toVaultEntryRelativePath))
    const fromVaultEntryName = getVaultEntryName(fromVaultEntryRelativePath)
    const toVaultEntryName = getVaultEntryName(toVaultEntryRelativePath)
    const isCaseOnlyRename = fromVaultEntryRelativePath.toLowerCase() === toVaultEntryRelativePath.toLowerCase()

    if (isCaseOnlyRename) {
      // On Windows and macOS "inbox.md" and "Inbox.md" are the same file, so a case-only rename
      // goes through a temporary name first.
      const temporaryVaultEntryName = pickFreeVaultEntryName(`${fromVaultEntryName}.papeliz-renaming`, '', (candidateName) =>
        candidateName.toLowerCase() === fromVaultEntryName.toLowerCase(),
      )
      await moveVaultEntryHandle(fromVaultParentFolderHandle, fromVaultEntryName, toVaultParentFolderHandle, temporaryVaultEntryName)
      await moveVaultEntryHandle(toVaultParentFolderHandle, temporaryVaultEntryName, toVaultParentFolderHandle, toVaultEntryName)
      return
    }

    await assertVaultEntryNameIsFree(toVaultParentFolderHandle, toVaultEntryName)
    await moveVaultEntryHandle(fromVaultParentFolderHandle, fromVaultEntryName, toVaultParentFolderHandle, toVaultEntryName)
  }

  async copyVaultEntry(fromVaultEntryRelativePath: string, toVaultEntryRelativePath: string): Promise<void> {
    assertVaultPathWritableByPapeliz(fromVaultEntryRelativePath)
    assertVaultPathWritableByPapeliz(toVaultEntryRelativePath)
    if (isVaultRelativePathInsideFolder(toVaultEntryRelativePath, fromVaultEntryRelativePath)) {
      throw new PapelizVaultOperationError('Into Itself')
    }
    const fromVaultParentFolderHandle = await this.getVaultFolderHandle(getVaultEntryParentFolderRelativePath(fromVaultEntryRelativePath))
    const toVaultParentFolderHandle = await this.getVaultFolderHandle(getVaultEntryParentFolderRelativePath(toVaultEntryRelativePath))
    const toVaultEntryName = getVaultEntryName(toVaultEntryRelativePath)
    await assertVaultEntryNameIsFree(toVaultParentFolderHandle, toVaultEntryName)
    const sourceVaultEntryHandle = await findVaultEntryHandle(fromVaultParentFolderHandle, getVaultEntryName(fromVaultEntryRelativePath))
    await copyVaultEntryHandle(sourceVaultEntryHandle, toVaultParentFolderHandle, toVaultEntryName)
  }

  async moveVaultEntryToTrash(vaultEntryRelativePath: string): Promise<string> {
    assertVaultPathWritableByPapeliz(vaultEntryRelativePath)
    const vaultParentFolderHandle = await this.getVaultFolderHandle(getVaultEntryParentFolderRelativePath(vaultEntryRelativePath))
    const vaultEntryName = getVaultEntryName(vaultEntryRelativePath)
    const vaultEntryHandle = await findVaultEntryHandle(vaultParentFolderHandle, vaultEntryName)
    const vaultTrashFolderHandle = await this.vaultRootFolderHandle.getDirectoryHandle(papelizVaultTrashFolderName, { create: true })
    const vaultTrashEntryNamesInLowerCase = new Set<string>()
    for await (const vaultTrashEntryName of vaultTrashFolderHandle.keys()) vaultTrashEntryNamesInLowerCase.add(vaultTrashEntryName.toLowerCase())

    const dotIndex = vaultEntryHandle.kind === 'file' ? vaultEntryName.lastIndexOf('.') : -1
    const trashVaultEntryName = pickFreeVaultEntryName(
      dotIndex > 0 ? vaultEntryName.slice(0, dotIndex) : vaultEntryName,
      dotIndex > 0 ? vaultEntryName.slice(dotIndex) : '',
      (candidateName) => vaultTrashEntryNamesInLowerCase.has(candidateName.toLowerCase()),
    )
    await moveVaultEntryHandle(vaultParentFolderHandle, vaultEntryName, vaultTrashFolderHandle, trashVaultEntryName)
    return joinVaultRelativePath(papelizVaultTrashFolderName, trashVaultEntryName)
  }

  private async getVaultFolderHandle(vaultFolderRelativePath: string): Promise<FileSystemDirectoryHandle> {
    let vaultFolderHandle = this.vaultRootFolderHandle
    for (const vaultPathSegment of splitVaultRelativePath(vaultFolderRelativePath)) {
      vaultFolderHandle = await vaultFolderHandle.getDirectoryHandle(vaultPathSegment)
    }
    return vaultFolderHandle
  }
}

function assertPapelizVaultSettingsFileName(papelizVaultSettingsFileName: string): void {
  if (!isPapelizVaultSettingsFileName(papelizVaultSettingsFileName)) {
    throw new PapelizVaultOperationError('Unknown Settings File')
  }
}

function assertVaultPathWritableByPapeliz(vaultEntryRelativePath: string): void {
  if (!isVaultRelativePathWritableByPapeliz(vaultEntryRelativePath)) {
    throw new PapelizVaultOperationError('Hidden Folder')
  }
}

async function writeVaultFileContents(vaultFileHandle: FileSystemFileHandle, vaultFileContents: string | Blob): Promise<void> {
  // createWritable() writes to a temporary file and swaps it in on close(), so a failed write
  // leaves the old note untouched.
  const vaultFileWritableStream = await vaultFileHandle.createWritable()
  try {
    await vaultFileWritableStream.write(vaultFileContents)
    await vaultFileWritableStream.close()
  } catch (vaultWriteError) {
    await vaultFileWritableStream.abort().catch(() => undefined)
    throw vaultWriteError
  }
}

async function assertVaultEntryNameIsFree(vaultFolderHandle: FileSystemDirectoryHandle, vaultEntryName: string): Promise<void> {
  const lowerCaseVaultEntryName = vaultEntryName.toLowerCase()
  for await (const existingVaultEntryName of vaultFolderHandle.keys()) {
    if (existingVaultEntryName.toLowerCase() === lowerCaseVaultEntryName) {
      throw new PapelizVaultOperationError('Name Taken')
    }
  }
}

async function findVaultEntryHandle(vaultFolderHandle: FileSystemDirectoryHandle, vaultEntryName: string): Promise<PapelizVaultEntryHandle> {
  for await (const [existingVaultEntryName, existingVaultEntryHandle] of vaultFolderHandle.entries()) {
    if (existingVaultEntryName === vaultEntryName) return asPapelizVaultEntryHandle(existingVaultEntryHandle)
  }
  throw new PapelizVaultOperationError('File Not Found')
}

async function copyVaultEntryHandle(
  sourceVaultEntryHandle: PapelizVaultEntryHandle,
  targetVaultParentFolderHandle: FileSystemDirectoryHandle,
  targetVaultEntryName: string,
): Promise<void> {
  if (sourceVaultEntryHandle.kind === 'file') {
    const targetVaultFileHandle = await targetVaultParentFolderHandle.getFileHandle(targetVaultEntryName, { create: true })
    await writeVaultFileContents(targetVaultFileHandle, await sourceVaultEntryHandle.getFile())
    return
  }
  const targetVaultFolderHandle = await targetVaultParentFolderHandle.getDirectoryHandle(targetVaultEntryName, { create: true })
  for await (const [childVaultEntryName, childVaultEntryHandle] of sourceVaultEntryHandle.entries()) {
    await copyVaultEntryHandle(asPapelizVaultEntryHandle(childVaultEntryHandle), targetVaultFolderHandle, childVaultEntryName)
  }
}

// Copies the entry (a file, or a folder with everything in it) to its new place first, and removes
// the original only once the copy is complete. A failed copy leaves the original where it was and
// takes back its own half-made copy; the target name was checked free before, so nothing else is
// ever there.
async function moveVaultEntryHandle(
  sourceVaultParentFolderHandle: FileSystemDirectoryHandle,
  sourceVaultEntryName: string,
  targetVaultParentFolderHandle: FileSystemDirectoryHandle,
  targetVaultEntryName: string,
): Promise<void> {
  const sourceVaultEntryHandle = await findVaultEntryHandle(sourceVaultParentFolderHandle, sourceVaultEntryName)
  try {
    await copyVaultEntryHandle(sourceVaultEntryHandle, targetVaultParentFolderHandle, targetVaultEntryName)
  } catch (vaultCopyError) {
    await targetVaultParentFolderHandle.removeEntry(targetVaultEntryName, { recursive: true }).catch(() => undefined)
    throw vaultCopyError
  }
  await sourceVaultParentFolderHandle.removeEntry(sourceVaultEntryName, { recursive: sourceVaultEntryHandle.kind === 'directory' })
}
