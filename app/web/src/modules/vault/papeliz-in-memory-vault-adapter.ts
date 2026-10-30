import { PapelizVaultOperationError, type PapelizVaultAdapter, type PapelizVaultTreeEntry, type PapelizVaultTreeListingOptions } from './papeliz-vault-adapter'
import {
  isPapelizVaultSettingsFileName,
  getVaultEntryName,
  getVaultEntryParentFolderRelativePath,
  isVaultRelativePathHidden,
  isVaultRelativePathInsideFolder,
  isVaultRelativePathWritableByPapeliz,
  joinVaultRelativePath,
  papelizVaultRootFolderRelativePath,
  papelizVaultTrashFolderName,
  pickFreeVaultEntryName,
  replaceVaultRelativePathPrefix,
  splitVaultRelativePath,
} from './papeliz-vault-relative-paths'

export interface PapelizInMemoryVaultNote {
  vaultNoteRelativePath: string
  vaultNoteText: string
}

// A vault that lives only in this tab: the sample vault. Names compare without case, the way
// Windows and macOS folders do, so the sample vault behaves like a folder on disk.
export class PapelizInMemoryVaultAdapter implements PapelizVaultAdapter {
  readonly papelizVaultKind = 'sample-vault-in-memory' as const
  private readonly vaultNoteTextsByRelativePath = new Map<string, string>()
  private readonly vaultFolderRelativePaths = new Set<string>()
  // Files that aren't notes, such as pictures added to a chat. They are kept but not listed.
  private readonly vaultAttachmentFileBlobsByRelativePath = new Map<string, Blob>()
  // Papeliz's own files for the vault (what a folder keeps in `.papeliz/`), by file name.
  private readonly papelizVaultSettingsFileTextsByName = new Map<string, string>()

  constructor(initialVaultNotes: readonly PapelizInMemoryVaultNote[]) {
    for (const initialVaultNote of initialVaultNotes) {
      this.vaultNoteTextsByRelativePath.set(initialVaultNote.vaultNoteRelativePath, initialVaultNote.vaultNoteText)
      this.addMissingParentFolders(initialVaultNote.vaultNoteRelativePath)
    }
  }

  async readPapelizVaultSettingsFile(papelizVaultSettingsFileName: string): Promise<string | null> {
    this.assertPapelizVaultSettingsFileName(papelizVaultSettingsFileName)
    return this.papelizVaultSettingsFileTextsByName.get(papelizVaultSettingsFileName) ?? null
  }

  async writePapelizVaultSettingsFile(papelizVaultSettingsFileName: string, papelizVaultSettingsFileText: string): Promise<void> {
    this.assertPapelizVaultSettingsFileName(papelizVaultSettingsFileName)
    this.papelizVaultSettingsFileTextsByName.set(papelizVaultSettingsFileName, papelizVaultSettingsFileText)
  }

  async listVaultTreeEntries(vaultTreeListingOptions?: PapelizVaultTreeListingOptions): Promise<PapelizVaultTreeEntry[]> {
    const isEveryHiddenVaultEntryListed = vaultTreeListingOptions?.isEveryHiddenVaultEntryListed === true
    const vaultTreeEntries: PapelizVaultTreeEntry[] = []
    for (const vaultFolderRelativePath of this.vaultFolderRelativePaths) {
      if (isEveryHiddenVaultEntryListed || isVaultRelativePathWritableByPapeliz(vaultFolderRelativePath)) {
        vaultTreeEntries.push({ vaultEntryRelativePath: vaultFolderRelativePath, vaultEntryKind: 'folder' })
      }
    }
    for (const vaultNoteRelativePath of this.vaultNoteTextsByRelativePath.keys()) {
      if (isEveryHiddenVaultEntryListed || isVaultRelativePathWritableByPapeliz(vaultNoteRelativePath)) {
        vaultTreeEntries.push({ vaultEntryRelativePath: vaultNoteRelativePath, vaultEntryKind: 'note' })
      }
    }
    return vaultTreeEntries
  }

  async readVaultNoteText(vaultNoteRelativePath: string): Promise<string> {
    const vaultNoteText = this.vaultNoteTextsByRelativePath.get(vaultNoteRelativePath)
    if (vaultNoteText === undefined) throw new PapelizVaultOperationError('Not In Vault')
    return vaultNoteText
  }

  async writeVaultNoteText(vaultNoteRelativePath: string, vaultNoteText: string): Promise<void> {
    this.assertWritableByPapeliz(vaultNoteRelativePath)
    this.vaultNoteTextsByRelativePath.set(vaultNoteRelativePath, vaultNoteText)
    this.addMissingParentFolders(vaultNoteRelativePath)
  }

  async createVaultNote(vaultNoteRelativePath: string, vaultNoteText: string): Promise<void> {
    this.assertWritableByPapeliz(vaultNoteRelativePath)
    this.assertNameIsFree(vaultNoteRelativePath)
    this.vaultNoteTextsByRelativePath.set(vaultNoteRelativePath, vaultNoteText)
    this.addMissingParentFolders(vaultNoteRelativePath)
  }

  async createVaultAttachmentFile(vaultAttachmentFileRelativePath: string, vaultAttachmentFileBlob: Blob): Promise<void> {
    this.assertWritableByPapeliz(vaultAttachmentFileRelativePath)
    this.assertNameIsFree(vaultAttachmentFileRelativePath)
    if (this.vaultAttachmentFileBlobsByRelativePath.has(vaultAttachmentFileRelativePath)) throw new PapelizVaultOperationError('Name Taken')
    this.vaultAttachmentFileBlobsByRelativePath.set(vaultAttachmentFileRelativePath, vaultAttachmentFileBlob)
    this.addMissingParentFolders(vaultAttachmentFileRelativePath)
  }

  // A file written with `createVaultAttachmentFile`, or null.
  readVaultAttachmentFile(vaultAttachmentFileRelativePath: string): Blob | null {
    return this.vaultAttachmentFileBlobsByRelativePath.get(vaultAttachmentFileRelativePath) ?? null
  }

  async listVaultAttachmentFileRelativePaths(): Promise<string[]> {
    return [...this.vaultAttachmentFileBlobsByRelativePath.keys()].filter((vaultAttachmentFileRelativePath) => !isVaultRelativePathHidden(vaultAttachmentFileRelativePath))
  }

  async readVaultAttachmentFileBlob(vaultAttachmentFileRelativePath: string): Promise<Blob> {
    const vaultAttachmentFileBlob = this.vaultAttachmentFileBlobsByRelativePath.get(vaultAttachmentFileRelativePath)
    if (vaultAttachmentFileBlob === undefined) throw new PapelizVaultOperationError('Not In Vault')
    return vaultAttachmentFileBlob
  }

  async createVaultFolder(vaultFolderRelativePath: string): Promise<void> {
    this.assertWritableByPapeliz(vaultFolderRelativePath)
    this.assertNameIsFree(vaultFolderRelativePath)
    this.vaultFolderRelativePaths.add(vaultFolderRelativePath)
    this.addMissingParentFolders(vaultFolderRelativePath)
  }

  async renameVaultEntry(fromVaultEntryRelativePath: string, toVaultEntryRelativePath: string): Promise<void> {
    this.assertWritableByPapeliz(fromVaultEntryRelativePath)
    this.assertWritableByPapeliz(toVaultEntryRelativePath)
    const isCaseOnlyRename = fromVaultEntryRelativePath.toLowerCase() === toVaultEntryRelativePath.toLowerCase()
    if (!isCaseOnlyRename) this.assertNameIsFree(toVaultEntryRelativePath)
    this.moveVaultEntry(fromVaultEntryRelativePath, toVaultEntryRelativePath)
  }

  async copyVaultEntry(fromVaultEntryRelativePath: string, toVaultEntryRelativePath: string): Promise<void> {
    this.assertWritableByPapeliz(fromVaultEntryRelativePath)
    this.assertWritableByPapeliz(toVaultEntryRelativePath)
    if (isVaultRelativePathInsideFolder(toVaultEntryRelativePath, fromVaultEntryRelativePath)) {
      throw new PapelizVaultOperationError('Into Itself')
    }
    this.assertNameIsFree(toVaultEntryRelativePath)
    const vaultNoteText = this.vaultNoteTextsByRelativePath.get(fromVaultEntryRelativePath)
    if (vaultNoteText !== undefined) {
      this.vaultNoteTextsByRelativePath.set(toVaultEntryRelativePath, vaultNoteText)
      this.addMissingParentFolders(toVaultEntryRelativePath)
      return
    }
    if (!this.vaultFolderRelativePaths.has(fromVaultEntryRelativePath)) {
      throw new PapelizVaultOperationError('Not In Vault')
    }
    for (const vaultFolderRelativePath of [...this.vaultFolderRelativePaths]) {
      if (isVaultRelativePathInsideFolder(vaultFolderRelativePath, fromVaultEntryRelativePath)) {
        this.vaultFolderRelativePaths.add(replaceVaultRelativePathPrefix(vaultFolderRelativePath, fromVaultEntryRelativePath, toVaultEntryRelativePath))
      }
    }
    for (const [vaultNoteRelativePath, copiedVaultNoteText] of [...this.vaultNoteTextsByRelativePath]) {
      if (isVaultRelativePathInsideFolder(vaultNoteRelativePath, fromVaultEntryRelativePath)) {
        this.vaultNoteTextsByRelativePath.set(
          replaceVaultRelativePathPrefix(vaultNoteRelativePath, fromVaultEntryRelativePath, toVaultEntryRelativePath),
          copiedVaultNoteText,
        )
      }
    }
    this.addMissingParentFolders(toVaultEntryRelativePath)
  }

  async moveVaultEntryToTrash(vaultEntryRelativePath: string): Promise<string> {
    this.assertWritableByPapeliz(vaultEntryRelativePath)
    const vaultEntryName = getVaultEntryName(vaultEntryRelativePath)
    const dotIndex = this.vaultNoteTextsByRelativePath.has(vaultEntryRelativePath) ? vaultEntryName.lastIndexOf('.') : -1
    const vaultEntryBaseName = dotIndex > 0 ? vaultEntryName.slice(0, dotIndex) : vaultEntryName
    const vaultEntryExtension = dotIndex > 0 ? vaultEntryName.slice(dotIndex) : ''
    const trashVaultEntryName = pickFreeVaultEntryName(vaultEntryBaseName, vaultEntryExtension, (candidateName) =>
      this.hasVaultEntryIgnoringCase(joinVaultRelativePath(papelizVaultTrashFolderName, candidateName)),
    )
    const trashVaultEntryRelativePath = joinVaultRelativePath(papelizVaultTrashFolderName, trashVaultEntryName)
    this.vaultFolderRelativePaths.add(papelizVaultTrashFolderName)
    this.moveVaultEntry(vaultEntryRelativePath, trashVaultEntryRelativePath)
    return trashVaultEntryRelativePath
  }

  private moveVaultEntry(fromVaultEntryRelativePath: string, toVaultEntryRelativePath: string): void {
    const vaultNoteText = this.vaultNoteTextsByRelativePath.get(fromVaultEntryRelativePath)
    if (vaultNoteText !== undefined) {
      this.vaultNoteTextsByRelativePath.delete(fromVaultEntryRelativePath)
      this.vaultNoteTextsByRelativePath.set(toVaultEntryRelativePath, vaultNoteText)
      this.addMissingParentFolders(toVaultEntryRelativePath)
      return
    }
    if (!this.vaultFolderRelativePaths.has(fromVaultEntryRelativePath)) {
      throw new PapelizVaultOperationError('Not In Vault')
    }
    for (const vaultFolderRelativePath of [...this.vaultFolderRelativePaths]) {
      if (isVaultRelativePathInsideFolder(vaultFolderRelativePath, fromVaultEntryRelativePath)) {
        this.vaultFolderRelativePaths.delete(vaultFolderRelativePath)
        this.vaultFolderRelativePaths.add(
          replaceVaultRelativePathPrefix(vaultFolderRelativePath, fromVaultEntryRelativePath, toVaultEntryRelativePath),
        )
      }
    }
    for (const [vaultNoteRelativePath, movedVaultNoteText] of [...this.vaultNoteTextsByRelativePath]) {
      if (isVaultRelativePathInsideFolder(vaultNoteRelativePath, fromVaultEntryRelativePath)) {
        this.vaultNoteTextsByRelativePath.delete(vaultNoteRelativePath)
        this.vaultNoteTextsByRelativePath.set(
          replaceVaultRelativePathPrefix(vaultNoteRelativePath, fromVaultEntryRelativePath, toVaultEntryRelativePath),
          movedVaultNoteText,
        )
      }
    }
    this.addMissingParentFolders(toVaultEntryRelativePath)
  }

  private addMissingParentFolders(vaultEntryRelativePath: string): void {
    let vaultFolderRelativePath = getVaultEntryParentFolderRelativePath(vaultEntryRelativePath)
    while (vaultFolderRelativePath !== papelizVaultRootFolderRelativePath) {
      this.vaultFolderRelativePaths.add(vaultFolderRelativePath)
      vaultFolderRelativePath = getVaultEntryParentFolderRelativePath(vaultFolderRelativePath)
    }
  }

  private hasVaultEntryIgnoringCase(vaultEntryRelativePath: string): boolean {
    const lowerCaseVaultEntryRelativePath = vaultEntryRelativePath.toLowerCase()
    for (const vaultNoteRelativePath of this.vaultNoteTextsByRelativePath.keys()) {
      if (vaultNoteRelativePath.toLowerCase() === lowerCaseVaultEntryRelativePath) return true
    }
    for (const vaultFolderRelativePath of this.vaultFolderRelativePaths) {
      if (vaultFolderRelativePath.toLowerCase() === lowerCaseVaultEntryRelativePath) return true
    }
    return false
  }

  private assertNameIsFree(vaultEntryRelativePath: string): void {
    if (this.hasVaultEntryIgnoringCase(vaultEntryRelativePath)) {
      throw new PapelizVaultOperationError('Name Taken')
    }
  }

  private assertPapelizVaultSettingsFileName(papelizVaultSettingsFileName: string): void {
    if (!isPapelizVaultSettingsFileName(papelizVaultSettingsFileName)) {
      throw new PapelizVaultOperationError('Unknown Settings File')
    }
  }

  private assertWritableByPapeliz(vaultEntryRelativePath: string): void {
    if (!isVaultRelativePathWritableByPapeliz(vaultEntryRelativePath) || splitVaultRelativePath(vaultEntryRelativePath).length === 0) {
      throw new PapelizVaultOperationError('Hidden Folder')
    }
  }
}
