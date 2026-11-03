import { PapelizVaultOperationError, type PapelizVaultAdapter, type PapelizVaultKind, type PapelizVaultTreeEntry, type PapelizVaultTreeListingOptions } from './papeliz-vault-adapter'
import type { PapelizEndToEndVaultAdapter, PapelizVaultEncryptionKindChangeDirection } from './papeliz-vault-encryption'
import {
  createPapelizEncryptedVaultEntryId,
  decryptPapelizEncryptedVaultFileContents,
  encryptPapelizVaultFile,
  encryptPapelizVaultFolderMarker,
  makePapelizEncryptedVaultFileName,
  openPapelizEncryptedVaultFileHeader,
  papelizEncryptedVaultFilesFolderName,
  readPapelizEncryptedVaultEntryIdFromFileName,
  resealPapelizEncryptedVaultFile,
  type PapelizEncryptedVaultEntryHeader,
  type PapelizEndToEndVaultKeys,
} from './papeliz-vault-encryption-format'
import { PapelizVaultDecryptionError } from './papeliz-vault-encryption-primitives'
import { papelizVaultEncryptionSettingsFileName } from './papeliz-vault-encryption-settings-file'
import type { PapelizVaultStoredFileAccess } from './papeliz-vault-encryption-stored-files'
import type { PapelizUnlockedVaultEncryptionKeyHolder } from './papeliz-vault-encryption-unlocked-key'
import {
  assertPapelizVaultSettingsFileName,
  assertVaultCopyOutsideItsSource,
  assertVaultEntryNameIsFreeAmongNames,
  assertVaultPathInsideTrash,
  assertVaultPathWritableByPapeliz,
  isVaultEntryLeftOutOfTreeListing,
  isVaultFolderOpenedForTreeListing,
  isVaultRenameCaseOnly,
  pickFreeVaultTrashEntryName,
} from './papeliz-vault-folder-adapter-rules'
import {
  pickFreePapelizImportVaultFolderName,
  writePapelizVaultImportFilesThroughFolderWriter,
  type PapelizVaultImportFile,
  type PapelizVaultImportOptions,
} from './papeliz-vault-folder-import'
import {
  getVaultEntryName,
  getVaultEntryParentFolderRelativePath,
  isVaultNoteFileName,
  isVaultRelativePathInsideFolder,
  joinVaultRelativePath,
  papelizBrowserVaultSettingsFileName,
  papelizVaultRootFolderRelativePath,
  papelizVaultSettingsFolderName,
  papelizVaultTrashFolderName,
  replaceVaultRelativePathPrefix,
  splitVaultRelativePath,
} from './papeliz-vault-relative-paths'
import { assertVaultTextFileOpenableAtByteLength, classifyVaultFileByName, isVaultFileSampleBytesPlainText, papelizVaultFileByteCheckLength } from './papeliz-vault-text-files'

// An unlocked End-to-end vault, as the workspace sees it: the same adapter every vault has, on
// decrypted paths and contents, over the vault's own adapter, which holds only encrypted files
// (papeliz-vault-encryption-format.ts says how each is laid out).
//
// The decrypted names live in memory only: an index from each encrypted file's entry ID to the path it
// carries, built when the vault unlocks and brought up to date at every listing, reading again only the
// files whose size or last change moved (another tab or app changed them). A folder is there while
// anything is in it; an empty folder keeps a marker file of its own. Nothing is deleted outright except
// a note New Note made a moment ago, as in every vault: a deleted entry is moved into the vault's own
// encrypted `.trash/`.

interface PapelizEncryptedVaultIndexEntry {
  encryptedVaultEntryId: string
  encryptedVaultEntryKind: 'file' | 'folder'
  vaultEntryRelativePath: string
  // As last listed; null for a file this adapter wrote since, which the next listing takes as it is.
  storedFileByteLength: number | null
  storedFileModifiedAt: number | null
}

type PapelizEncryptedVaultFileHeader = Extract<PapelizEncryptedVaultEntryHeader, { encryptedVaultEntryKind: 'file' }>

// What `readVaultAttachmentFileBlob` gives a picture, video or PDF, so MD View shows it from memory as
// a folder's own file would show.
const papelizDecryptedVaultFileMimeTypesByExtension: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  md: 'text/markdown',
  txt: 'text/plain',
  json: 'application/json',
}

function readDecryptedVaultFileMimeType(vaultFileRelativePath: string): string {
  const vaultFileName = getVaultEntryName(vaultFileRelativePath)
  const extensionDotIndex = vaultFileName.lastIndexOf('.')
  if (extensionDotIndex <= 0) return ''
  return papelizDecryptedVaultFileMimeTypesByExtension[vaultFileName.slice(extensionDotIndex + 1).toLowerCase()] ?? ''
}

// The file list's rules for a folder's listing, applied to a whole path: a path is listed when neither
// it nor a folder above it is left out, and no folder above it is one the list doesn't open (`.git/`).
function isEncryptedVaultEntryListedInTree(vaultEntryRelativePath: string, isEveryHiddenVaultEntryListed: boolean): boolean {
  const vaultPathSegments = splitVaultRelativePath(vaultEntryRelativePath)
  for (let vaultPathSegmentCount = 1; vaultPathSegmentCount <= vaultPathSegments.length; vaultPathSegmentCount += 1) {
    if (isVaultEntryLeftOutOfTreeListing(vaultPathSegments.slice(0, vaultPathSegmentCount).join('/'), isEveryHiddenVaultEntryListed)) return false
    if (vaultPathSegmentCount < vaultPathSegments.length && !isVaultFolderOpenedForTreeListing(vaultPathSegments[vaultPathSegmentCount - 1] ?? '')) return false
  }
  return true
}

function compareVaultRelativePathsFolderFirst(firstVaultEntryRelativePath: string, secondVaultEntryRelativePath: string): number {
  const firstVaultPathSegments = splitVaultRelativePath(firstVaultEntryRelativePath)
  const secondVaultPathSegments = splitVaultRelativePath(secondVaultEntryRelativePath)
  for (let vaultPathSegmentIndex = 0; vaultPathSegmentIndex < Math.min(firstVaultPathSegments.length, secondVaultPathSegments.length); vaultPathSegmentIndex += 1) {
    const segmentComparison = (firstVaultPathSegments[vaultPathSegmentIndex] ?? '').localeCompare(secondVaultPathSegments[vaultPathSegmentIndex] ?? '')
    if (segmentComparison !== 0) return segmentComparison
  }
  return firstVaultPathSegments.length - secondVaultPathSegments.length
}

function listVaultRelativePathAncestorFolders(vaultEntryRelativePath: string): string[] {
  const vaultPathSegments = splitVaultRelativePath(vaultEntryRelativePath)
  return vaultPathSegments.slice(0, -1).map((_unusedSegment, vaultPathSegmentIndex) => vaultPathSegments.slice(0, vaultPathSegmentIndex + 1).join('/'))
}

export function makePapelizEncryptedVaultFileRelativePath(encryptedVaultEntryId: string): string {
  return joinVaultRelativePath(papelizEncryptedVaultFilesFolderName, makePapelizEncryptedVaultFileName(encryptedVaultEntryId))
}

const papelizVaultTextDecoder = new TextDecoder()
const papelizVaultTextEncoder = new TextEncoder()

export class PapelizEndToEndEncryptingVaultAdapter implements PapelizEndToEndVaultAdapter {
  readonly papelizVaultEncryptionKind = 'end-to-end' as const
  readonly papelizVaultKind: PapelizVaultKind
  readonly papelizEncryptedVaultId: string
  readonly runVaultChangeExclusively?: PapelizVaultAdapter['runVaultChangeExclusively']

  private readonly encryptedVaultIndexEntriesById = new Map<string, PapelizEncryptedVaultIndexEntry>()
  // Encrypted files that don't open with this vault's key, by their stored path.
  private readonly damagedEncryptedVaultFileRelativePaths = new Set<string>()
  // A file whose name doesn't say whether it is text, checked once until it changes.
  private readonly vaultFileByteChecksByEntryId = new Map<string, { checkedStoredFileByteLength: number | null; checkedStoredFileModifiedAt: number | null; isCheckedVaultFilePlainText: boolean }>()
  private readonly decryptedVaultFileObjectUrls = new Set<string>()
  private readonly endToEndVaultLockListeners = new Set<() => void>()
  private isLocked = false

  private constructor(
    private readonly storedVaultAdapter: PapelizVaultAdapter & PapelizVaultStoredFileAccess,
    private readonly unlockedVaultEncryptionKeyHolder: PapelizUnlockedVaultEncryptionKeyHolder,
    private unfinishedVaultEncryptionKindChangeDirection: PapelizVaultEncryptionKindChangeDirection | null,
  ) {
    this.papelizVaultKind = storedVaultAdapter.papelizVaultKind
    this.papelizEncryptedVaultId = unlockedVaultEncryptionKeyHolder.papelizEncryptedVaultId
    const storedVaultChangeRunner = storedVaultAdapter.runVaultChangeExclusively?.bind(storedVaultAdapter)
    if (storedVaultChangeRunner) this.runVaultChangeExclusively = storedVaultChangeRunner
  }

  // Reads every encrypted file's path once, so the vault opens with its names known.
  static async wrapStoredVaultAdapter(
    storedVaultAdapter: PapelizVaultAdapter & PapelizVaultStoredFileAccess,
    unlockedVaultEncryptionKeyHolder: PapelizUnlockedVaultEncryptionKeyHolder,
    unfinishedVaultEncryptionKindChange: PapelizVaultEncryptionKindChangeDirection | null,
  ): Promise<PapelizEndToEndEncryptingVaultAdapter> {
    const endToEndVaultAdapter = new PapelizEndToEndEncryptingVaultAdapter(storedVaultAdapter, unlockedVaultEncryptionKeyHolder, unfinishedVaultEncryptionKindChange)
    await endToEndVaultAdapter.refreshEncryptedVaultIndex()
    return endToEndVaultAdapter
  }

  // The vault's own adapter and key, for a change of kind and Change Passphrase.
  readStoredVaultAdapterForEncryption(): PapelizVaultAdapter & PapelizVaultStoredFileAccess {
    this.requireEndToEndVaultKeys()
    return this.storedVaultAdapter
  }

  readUnlockedVaultEncryptionKeyHolder(): PapelizUnlockedVaultEncryptionKeyHolder {
    this.requireEndToEndVaultKeys()
    return this.unlockedVaultEncryptionKeyHolder
  }

  get unfinishedVaultEncryptionKindChange(): PapelizVaultEncryptionKindChangeDirection | null {
    return this.unfinishedVaultEncryptionKindChangeDirection
  }

  // A change of kind finished (or started) while this adapter is open.
  noteVaultEncryptionKindChange(unfinishedVaultEncryptionKindChange: PapelizVaultEncryptionKindChangeDirection | null): void {
    this.unfinishedVaultEncryptionKindChangeDirection = unfinishedVaultEncryptionKindChange
  }

  // Encrypted files that didn't open at the last listing, by their stored path.
  listDamagedEncryptedVaultFileRelativePaths(): string[] {
    return [...this.damagedEncryptedVaultFileRelativePaths]
  }

  // Locking -------------------------------------------------------------------------------------------

  isEndToEndVaultLocked(): boolean {
    return this.isLocked
  }

  lockEndToEndVault(): void {
    if (this.isLocked) return
    this.isLocked = true
    this.unlockedVaultEncryptionKeyHolder.dropVaultEncryptionKey()
    this.encryptedVaultIndexEntriesById.clear()
    this.damagedEncryptedVaultFileRelativePaths.clear()
    this.vaultFileByteChecksByEntryId.clear()
    for (const decryptedVaultFileObjectUrl of this.decryptedVaultFileObjectUrls) URL.revokeObjectURL(decryptedVaultFileObjectUrl)
    this.decryptedVaultFileObjectUrls.clear()
    const endToEndVaultLockListeners = [...this.endToEndVaultLockListeners]
    this.endToEndVaultLockListeners.clear()
    for (const onEndToEndVaultLocked of endToEndVaultLockListeners) onEndToEndVaultLocked()
  }

  listenForEndToEndVaultLock(onEndToEndVaultLocked: () => void): () => void {
    if (this.isLocked) {
      onEndToEndVaultLocked()
      return () => undefined
    }
    this.endToEndVaultLockListeners.add(onEndToEndVaultLocked)
    return () => {
      this.endToEndVaultLockListeners.delete(onEndToEndVaultLocked)
    }
  }

  closeVaultAdapter(): void {
    this.lockEndToEndVault()
    this.storedVaultAdapter.closeVaultAdapter?.()
  }

  private requireEndToEndVaultKeys(): PapelizEndToEndVaultKeys {
    const endToEndVaultKeys = this.isLocked ? null : this.unlockedVaultEncryptionKeyHolder.readEndToEndVaultKeys()
    if (endToEndVaultKeys === null) throw new PapelizVaultOperationError('Vault Locked')
    return endToEndVaultKeys
  }

  // The index ------------------------------------------------------------------------------------------

  async refreshEncryptedVaultIndex(): Promise<void> {
    const endToEndVaultKeys = this.requireEndToEndVaultKeys()
    const storedVaultFileStats = await this.storedVaultAdapter.listStoredVaultFileStats()
    const listedEncryptedVaultEntryIds = new Set<string>()
    for (const storedVaultFileStat of storedVaultFileStats) {
      if (getVaultEntryParentFolderRelativePath(storedVaultFileStat.vaultFileRelativePath) !== papelizEncryptedVaultFilesFolderName) continue
      const encryptedVaultEntryId = readPapelizEncryptedVaultEntryIdFromFileName(getVaultEntryName(storedVaultFileStat.vaultFileRelativePath))
      if (encryptedVaultEntryId === null) continue
      listedEncryptedVaultEntryIds.add(encryptedVaultEntryId)
      const knownIndexEntry = this.encryptedVaultIndexEntriesById.get(encryptedVaultEntryId)
      if (knownIndexEntry !== undefined && knownIndexEntry.storedFileByteLength === null) {
        knownIndexEntry.storedFileByteLength = storedVaultFileStat.vaultFileByteLength
        knownIndexEntry.storedFileModifiedAt = storedVaultFileStat.vaultFileModifiedAt
        continue
      }
      if (
        knownIndexEntry !== undefined &&
        knownIndexEntry.storedFileByteLength === storedVaultFileStat.vaultFileByteLength &&
        knownIndexEntry.storedFileModifiedAt === storedVaultFileStat.vaultFileModifiedAt
      ) {
        continue
      }
      try {
        const encryptedVaultEntryHeader = await openPapelizEncryptedVaultFileHeader(
          endToEndVaultKeys,
          encryptedVaultEntryId,
          await this.storedVaultAdapter.readVaultFileBytes(storedVaultFileStat.vaultFileRelativePath),
        )
        this.encryptedVaultIndexEntriesById.set(encryptedVaultEntryId, {
          encryptedVaultEntryId,
          encryptedVaultEntryKind: encryptedVaultEntryHeader.encryptedVaultEntryKind,
          vaultEntryRelativePath: encryptedVaultEntryHeader.vaultEntryRelativePath,
          storedFileByteLength: storedVaultFileStat.vaultFileByteLength,
          storedFileModifiedAt: storedVaultFileStat.vaultFileModifiedAt,
        })
        this.damagedEncryptedVaultFileRelativePaths.delete(storedVaultFileStat.vaultFileRelativePath)
      } catch (encryptedVaultFileReadError) {
        if (!(encryptedVaultFileReadError instanceof PapelizVaultDecryptionError)) throw encryptedVaultFileReadError
        this.encryptedVaultIndexEntriesById.delete(encryptedVaultEntryId)
        this.damagedEncryptedVaultFileRelativePaths.add(storedVaultFileStat.vaultFileRelativePath)
        console.warn('Papeliz: an encrypted vault file does not open with this vault’s key:', storedVaultFileStat.vaultFileRelativePath)
      }
    }
    for (const knownEncryptedVaultEntryId of [...this.encryptedVaultIndexEntriesById.keys()]) {
      if (!listedEncryptedVaultEntryIds.has(knownEncryptedVaultEntryId)) this.encryptedVaultIndexEntriesById.delete(knownEncryptedVaultEntryId)
    }
  }

  private listEncryptedVaultIndexEntries(): PapelizEncryptedVaultIndexEntry[] {
    return [...this.encryptedVaultIndexEntriesById.values()]
  }

  private findEncryptedVaultFileIndexEntry(vaultFileRelativePath: string): PapelizEncryptedVaultIndexEntry | undefined {
    return this.listEncryptedVaultIndexEntries().find(
      (indexEntry) => indexEntry.encryptedVaultEntryKind === 'file' && indexEntry.vaultEntryRelativePath === vaultFileRelativePath,
    )
  }

  private isVaultFolderPresent(vaultFolderRelativePath: string): boolean {
    if (vaultFolderRelativePath === papelizVaultRootFolderRelativePath) return true
    return this.listEncryptedVaultIndexEntries().some(
      (indexEntry) =>
        (indexEntry.encryptedVaultEntryKind === 'folder' && indexEntry.vaultEntryRelativePath === vaultFolderRelativePath) ||
        indexEntry.vaultEntryRelativePath.startsWith(`${vaultFolderRelativePath}/`),
    )
  }

  // What a path names now: a file, a folder (with or without its marker), or nothing.
  private findVaultEntryKind(vaultEntryRelativePath: string): 'file' | 'folder' | null {
    if (this.findEncryptedVaultFileIndexEntry(vaultEntryRelativePath) !== undefined) return 'file'
    return this.isVaultFolderPresent(vaultEntryRelativePath) && vaultEntryRelativePath !== papelizVaultRootFolderRelativePath ? 'folder' : null
  }

  // Every entry at the path or inside it: the file itself, or a folder's marker and everything in it.
  private listEncryptedVaultIndexEntriesAt(vaultEntryRelativePath: string): PapelizEncryptedVaultIndexEntry[] {
    return this.listEncryptedVaultIndexEntries().filter((indexEntry) => isVaultRelativePathInsideFolder(indexEntry.vaultEntryRelativePath, vaultEntryRelativePath))
  }

  private listVaultFolderChildNames(vaultFolderRelativePath: string): Set<string> {
    const vaultFolderChildNames = new Set<string>()
    for (const indexEntry of this.listEncryptedVaultIndexEntries()) {
      const vaultEntryRelativePath = indexEntry.vaultEntryRelativePath
      if (vaultFolderRelativePath !== papelizVaultRootFolderRelativePath && !vaultEntryRelativePath.startsWith(`${vaultFolderRelativePath}/`)) continue
      const pathInsideFolder = vaultFolderRelativePath === papelizVaultRootFolderRelativePath ? vaultEntryRelativePath : vaultEntryRelativePath.slice(vaultFolderRelativePath.length + 1)
      const vaultFolderChildName = splitVaultRelativePath(pathInsideFolder)[0]
      if (vaultFolderChildName !== undefined) vaultFolderChildNames.add(vaultFolderChildName)
    }
    return vaultFolderChildNames
  }

  // A path as the vault already spells it: each folder or file name matched without case, as on
  // Windows and macOS, and kept as it was typed where nothing matches. So "projects/plan.md" reaches
  // "Projects/Plan.md", and a note made in "projects/" lands in "Projects/".
  private resolveVaultPathCasing(vaultEntryRelativePath: string): string {
    let resolvedVaultEntryRelativePath = papelizVaultRootFolderRelativePath
    for (const vaultPathSegment of splitVaultRelativePath(vaultEntryRelativePath)) {
      const vaultFolderChildNames = this.listVaultFolderChildNames(resolvedVaultEntryRelativePath)
      const lowerCaseVaultPathSegment = vaultPathSegment.toLowerCase()
      const existingVaultPathSegment = vaultFolderChildNames.has(vaultPathSegment)
        ? vaultPathSegment
        : ([...vaultFolderChildNames].find((vaultFolderChildName) => vaultFolderChildName.toLowerCase() === lowerCaseVaultPathSegment) ?? vaultPathSegment)
      resolvedVaultEntryRelativePath = joinVaultRelativePath(resolvedVaultEntryRelativePath, existingVaultPathSegment)
    }
    return resolvedVaultEntryRelativePath
  }

  // A path whose folder is resolved as above, its own name kept as typed: for what is about to be made.
  private resolveVaultParentFolderCasing(vaultEntryRelativePath: string): string {
    return joinVaultRelativePath(this.resolveVaultPathCasing(getVaultEntryParentFolderRelativePath(vaultEntryRelativePath)), getVaultEntryName(vaultEntryRelativePath))
  }

  private assertVaultFolderPresent(vaultFolderRelativePath: string): void {
    if (!this.isVaultFolderPresent(vaultFolderRelativePath)) throw new PapelizVaultOperationError('Not In Vault')
  }

  private assertVaultEntryNameFree(vaultEntryRelativePath: string): void {
    assertVaultEntryNameIsFreeAmongNames(this.listVaultFolderChildNames(getVaultEntryParentFolderRelativePath(vaultEntryRelativePath)), getVaultEntryName(vaultEntryRelativePath))
  }

  // Encrypted files ------------------------------------------------------------------------------------

  private async writeEncryptedVaultEntryFile(
    encryptedVaultEntryId: string,
    encryptedVaultEntryKind: 'file' | 'folder',
    vaultEntryRelativePath: string,
    encryptedVaultFileBytes: Uint8Array,
  ): Promise<void> {
    await this.storedVaultAdapter.writeStoredVaultFileBytes(makePapelizEncryptedVaultFileRelativePath(encryptedVaultEntryId), encryptedVaultFileBytes)
    this.encryptedVaultIndexEntriesById.set(encryptedVaultEntryId, {
      encryptedVaultEntryId,
      encryptedVaultEntryKind,
      vaultEntryRelativePath,
      storedFileByteLength: null,
      storedFileModifiedAt: null,
    })
    this.vaultFileByteChecksByEntryId.delete(encryptedVaultEntryId)
  }

  // Writes a file's plain bytes at its path, under its own entry when there is one, so a save keeps
  // the file's identity.
  async writeEncryptedVaultFileBytes(vaultFileRelativePath: string, plainBytes: Uint8Array): Promise<void> {
    const endToEndVaultKeys = this.requireEndToEndVaultKeys()
    const encryptedVaultEntryId = this.findEncryptedVaultFileIndexEntry(vaultFileRelativePath)?.encryptedVaultEntryId ?? createPapelizEncryptedVaultEntryId()
    await this.writeEncryptedVaultEntryFile(
      encryptedVaultEntryId,
      'file',
      vaultFileRelativePath,
      await encryptPapelizVaultFile(endToEndVaultKeys, encryptedVaultEntryId, vaultFileRelativePath, plainBytes),
    )
  }

  private async writeEncryptedVaultFolderMarker(vaultFolderRelativePath: string): Promise<void> {
    const endToEndVaultKeys = this.requireEndToEndVaultKeys()
    const encryptedVaultEntryId = createPapelizEncryptedVaultEntryId()
    await this.writeEncryptedVaultEntryFile(
      encryptedVaultEntryId,
      'folder',
      vaultFolderRelativePath,
      await encryptPapelizVaultFolderMarker(endToEndVaultKeys, encryptedVaultEntryId, vaultFolderRelativePath),
    )
  }

  // A folder a change of kind brings along: kept with a marker when nothing in it shows it.
  async keepVaultFolderMarker(vaultFolderRelativePath: string): Promise<void> {
    await this.keepVaultFolderAfterItEmpties(vaultFolderRelativePath)
  }

  // An encrypted file a change back to Standard has just removed.
  forgetEncryptedVaultEntryAt(encryptedVaultFileRelativePath: string): void {
    const encryptedVaultEntryId = readPapelizEncryptedVaultEntryIdFromFileName(getVaultEntryName(encryptedVaultFileRelativePath))
    if (encryptedVaultEntryId !== null) this.encryptedVaultIndexEntriesById.delete(encryptedVaultEntryId)
  }

  // A folder something was just moved or taken out of stays, as on disk: once nothing is left in it,
  // it gets its marker.
  private async keepVaultFolderAfterItEmpties(vaultFolderRelativePath: string): Promise<void> {
    if (!this.isVaultFolderPresent(vaultFolderRelativePath)) await this.writeEncryptedVaultFolderMarker(vaultFolderRelativePath)
  }

  private async readEncryptedVaultFileHeader(indexEntry: PapelizEncryptedVaultIndexEntry): Promise<PapelizEncryptedVaultFileHeader> {
    const endToEndVaultKeys = this.requireEndToEndVaultKeys()
    let encryptedVaultEntryHeader: PapelizEncryptedVaultEntryHeader
    try {
      encryptedVaultEntryHeader = await openPapelizEncryptedVaultFileHeader(
        endToEndVaultKeys,
        indexEntry.encryptedVaultEntryId,
        await this.storedVaultAdapter.readVaultFileBytes(makePapelizEncryptedVaultFileRelativePath(indexEntry.encryptedVaultEntryId)),
      )
    } catch (encryptedVaultFileReadError) {
      if (encryptedVaultFileReadError instanceof PapelizVaultDecryptionError) throw new PapelizVaultOperationError('Encrypted File Damaged')
      throw encryptedVaultFileReadError
    }
    // Another tab or app moved it since the index was read.
    if (encryptedVaultEntryHeader.encryptedVaultEntryKind !== 'file' || encryptedVaultEntryHeader.vaultEntryRelativePath !== indexEntry.vaultEntryRelativePath) {
      indexEntry.vaultEntryRelativePath = encryptedVaultEntryHeader.vaultEntryRelativePath
      indexEntry.encryptedVaultEntryKind = encryptedVaultEntryHeader.encryptedVaultEntryKind
      throw new PapelizVaultOperationError('Not In Vault')
    }
    return encryptedVaultEntryHeader
  }

  private async decryptVaultFileContents(encryptedVaultFileHeader: PapelizEncryptedVaultFileHeader): Promise<Uint8Array<ArrayBuffer>> {
    try {
      return await decryptPapelizEncryptedVaultFileContents(this.requireEndToEndVaultKeys(), encryptedVaultFileHeader)
    } catch (encryptedVaultFileReadError) {
      if (encryptedVaultFileReadError instanceof PapelizVaultDecryptionError) throw new PapelizVaultOperationError('Encrypted File Damaged')
      throw encryptedVaultFileReadError
    }
  }

  // A file's plain bytes, whole.
  async readDecryptedVaultFileBytes(vaultFileRelativePath: string): Promise<Uint8Array<ArrayBuffer>> {
    this.requireEndToEndVaultKeys()
    const indexEntry = this.findEncryptedVaultFileIndexEntry(this.resolveVaultPathCasing(vaultFileRelativePath))
    if (indexEntry === undefined) throw new PapelizVaultOperationError('Not In Vault')
    return this.decryptVaultFileContents(await this.readEncryptedVaultFileHeader(indexEntry))
  }

  // Every file and empty folder, with its decrypted path, for a change back to Standard.
  listDecryptedVaultEntries(): { vaultEntryRelativePath: string; encryptedVaultEntryKind: 'file' | 'folder'; encryptedVaultFileRelativePath: string }[] {
    this.requireEndToEndVaultKeys()
    return this.listEncryptedVaultIndexEntries().map((indexEntry) => ({
      vaultEntryRelativePath: indexEntry.vaultEntryRelativePath,
      encryptedVaultEntryKind: indexEntry.encryptedVaultEntryKind,
      encryptedVaultFileRelativePath: makePapelizEncryptedVaultFileRelativePath(indexEntry.encryptedVaultEntryId),
    }))
  }

  // Moves or copies every entry at a path to another, each sealed again at its new path (and, for a
  // copy, under a new entry ID). The contents are kept as they are encrypted.
  private async moveOrCopyEncryptedVaultEntries(fromVaultEntryRelativePath: string, toVaultEntryRelativePath: string, isCopy: boolean): Promise<void> {
    const endToEndVaultKeys = this.requireEndToEndVaultKeys()
    const movedIndexEntries = this.listEncryptedVaultIndexEntriesAt(fromVaultEntryRelativePath)
    for (const movedIndexEntry of movedIndexEntries) {
      const newVaultEntryRelativePath = replaceVaultRelativePathPrefix(movedIndexEntry.vaultEntryRelativePath, fromVaultEntryRelativePath, toVaultEntryRelativePath)
      const newEncryptedVaultEntryId = isCopy ? createPapelizEncryptedVaultEntryId() : movedIndexEntry.encryptedVaultEntryId
      if (movedIndexEntry.encryptedVaultEntryKind === 'folder') {
        await this.writeEncryptedVaultEntryFile(
          newEncryptedVaultEntryId,
          'folder',
          newVaultEntryRelativePath,
          await encryptPapelizVaultFolderMarker(endToEndVaultKeys, newEncryptedVaultEntryId, newVaultEntryRelativePath),
        )
        continue
      }
      const encryptedVaultFileHeader = await this.readEncryptedVaultFileHeader(movedIndexEntry)
      await this.writeEncryptedVaultEntryFile(
        newEncryptedVaultEntryId,
        'file',
        newVaultEntryRelativePath,
        await resealPapelizEncryptedVaultFile(endToEndVaultKeys, newEncryptedVaultEntryId, newVaultEntryRelativePath, encryptedVaultFileHeader),
      )
    }
  }

  // The adapter ------------------------------------------------------------------------------------------

  async listVaultTreeEntries(vaultTreeListingOptions?: PapelizVaultTreeListingOptions): Promise<PapelizVaultTreeEntry[]> {
    await this.refreshEncryptedVaultIndex()
    const isEveryHiddenVaultEntryListed = vaultTreeListingOptions?.isEveryHiddenVaultEntryListed === true
    const vaultTreeEntriesByPath = new Map<string, PapelizVaultTreeEntry>()
    for (const indexEntry of this.listEncryptedVaultIndexEntries()) {
      const vaultFolderRelativePaths = listVaultRelativePathAncestorFolders(indexEntry.vaultEntryRelativePath)
      if (indexEntry.encryptedVaultEntryKind === 'folder') vaultFolderRelativePaths.push(indexEntry.vaultEntryRelativePath)
      for (const vaultFolderRelativePath of vaultFolderRelativePaths) {
        if (isEncryptedVaultEntryListedInTree(vaultFolderRelativePath, isEveryHiddenVaultEntryListed)) {
          vaultTreeEntriesByPath.set(vaultFolderRelativePath, { vaultEntryRelativePath: vaultFolderRelativePath, vaultEntryKind: 'folder' })
        }
      }
      if (indexEntry.encryptedVaultEntryKind !== 'file' || !isEncryptedVaultEntryListedInTree(indexEntry.vaultEntryRelativePath, isEveryHiddenVaultEntryListed)) continue
      const vaultFileNameKind = classifyVaultFileByName(getVaultEntryName(indexEntry.vaultEntryRelativePath))
      if (vaultFileNameKind === 'vault-note') {
        vaultTreeEntriesByPath.set(indexEntry.vaultEntryRelativePath, { vaultEntryRelativePath: indexEntry.vaultEntryRelativePath, vaultEntryKind: 'note' })
      } else if (vaultFileNameKind === 'vault-text-file' || (vaultFileNameKind === 'vault-file-needing-byte-check' && (await this.isEncryptedVaultFilePlainText(indexEntry)))) {
        vaultTreeEntriesByPath.set(indexEntry.vaultEntryRelativePath, { vaultEntryRelativePath: indexEntry.vaultEntryRelativePath, vaultEntryKind: 'text-file' })
      }
    }
    return [...vaultTreeEntriesByPath.values()].sort((firstTreeEntry, secondTreeEntry) =>
      compareVaultRelativePathsFolderFirst(firstTreeEntry.vaultEntryRelativePath, secondTreeEntry.vaultEntryRelativePath),
    )
  }

  private async isEncryptedVaultFilePlainText(indexEntry: PapelizEncryptedVaultIndexEntry): Promise<boolean> {
    const earlierByteCheck = this.vaultFileByteChecksByEntryId.get(indexEntry.encryptedVaultEntryId)
    if (
      earlierByteCheck !== undefined &&
      earlierByteCheck.checkedStoredFileByteLength === indexEntry.storedFileByteLength &&
      earlierByteCheck.checkedStoredFileModifiedAt === indexEntry.storedFileModifiedAt
    ) {
      return earlierByteCheck.isCheckedVaultFilePlainText
    }
    try {
      const plainBytes = await this.decryptVaultFileContents(await this.readEncryptedVaultFileHeader(indexEntry))
      const isCheckedVaultFilePlainText = isVaultFileSampleBytesPlainText(plainBytes.subarray(0, papelizVaultFileByteCheckLength))
      this.vaultFileByteChecksByEntryId.set(indexEntry.encryptedVaultEntryId, {
        checkedStoredFileByteLength: indexEntry.storedFileByteLength,
        checkedStoredFileModifiedAt: indexEntry.storedFileModifiedAt,
        isCheckedVaultFilePlainText,
      })
      return isCheckedVaultFilePlainText
    } catch {
      // Unreadable right now: left out until the next listing.
      return false
    }
  }

  async readVaultNoteText(vaultNoteRelativePath: string): Promise<string> {
    const plainBytes = await this.readDecryptedVaultFileBytes(vaultNoteRelativePath)
    assertVaultTextFileOpenableAtByteLength(vaultNoteRelativePath, plainBytes.length)
    return papelizVaultTextDecoder.decode(plainBytes)
  }

  async writeVaultNoteText(vaultNoteRelativePath: string, vaultNoteText: string): Promise<void> {
    assertVaultPathWritableByPapeliz(vaultNoteRelativePath)
    this.requireEndToEndVaultKeys()
    const resolvedVaultEntryRelativePath = this.resolveVaultParentFolderCasing(vaultNoteRelativePath)
    this.assertVaultFolderPresent(getVaultEntryParentFolderRelativePath(resolvedVaultEntryRelativePath))
    await this.writeEncryptedVaultFileBytes(resolvedVaultEntryRelativePath, papelizVaultTextEncoder.encode(vaultNoteText))
  }

  async createVaultNote(vaultNoteRelativePath: string, vaultNoteText: string): Promise<void> {
    assertVaultPathWritableByPapeliz(vaultNoteRelativePath)
    this.requireEndToEndVaultKeys()
    const resolvedVaultEntryRelativePath = this.resolveVaultParentFolderCasing(vaultNoteRelativePath)
    this.assertVaultFolderPresent(getVaultEntryParentFolderRelativePath(resolvedVaultEntryRelativePath))
    this.assertVaultEntryNameFree(resolvedVaultEntryRelativePath)
    await this.writeEncryptedVaultFileBytes(resolvedVaultEntryRelativePath, papelizVaultTextEncoder.encode(vaultNoteText))
  }

  async createVaultFolder(vaultFolderRelativePath: string): Promise<void> {
    assertVaultPathWritableByPapeliz(vaultFolderRelativePath)
    this.requireEndToEndVaultKeys()
    const resolvedVaultEntryRelativePath = this.resolveVaultParentFolderCasing(vaultFolderRelativePath)
    this.assertVaultFolderPresent(getVaultEntryParentFolderRelativePath(resolvedVaultEntryRelativePath))
    this.assertVaultEntryNameFree(resolvedVaultEntryRelativePath)
    await this.writeEncryptedVaultFolderMarker(resolvedVaultEntryRelativePath)
  }

  async createVaultAttachmentFile(vaultAttachmentFileRelativePath: string, vaultAttachmentFileBlob: Blob): Promise<void> {
    assertVaultPathWritableByPapeliz(vaultAttachmentFileRelativePath)
    this.requireEndToEndVaultKeys()
    const resolvedVaultEntryRelativePath = this.resolveVaultParentFolderCasing(vaultAttachmentFileRelativePath)
    this.assertVaultFolderPresent(getVaultEntryParentFolderRelativePath(resolvedVaultEntryRelativePath))
    this.assertVaultEntryNameFree(resolvedVaultEntryRelativePath)
    await this.writeEncryptedVaultFileBytes(resolvedVaultEntryRelativePath, new Uint8Array(await vaultAttachmentFileBlob.arrayBuffer()))
  }

  async listVaultAttachmentFileRelativePaths(): Promise<string[]> {
    this.requireEndToEndVaultKeys()
    return this.listEncryptedVaultIndexEntries()
      .filter(
        (indexEntry) =>
          indexEntry.encryptedVaultEntryKind === 'file' &&
          !isVaultNoteFileName(getVaultEntryName(indexEntry.vaultEntryRelativePath)) &&
          splitVaultRelativePath(indexEntry.vaultEntryRelativePath).every((vaultPathSegment) => !vaultPathSegment.startsWith('.')),
      )
      .map((indexEntry) => indexEntry.vaultEntryRelativePath)
      .sort(compareVaultRelativePathsFolderFirst)
  }

  async readVaultAttachmentFileBlob(vaultAttachmentFileRelativePath: string): Promise<Blob> {
    const plainBytes = await this.readDecryptedVaultFileBytes(vaultAttachmentFileRelativePath)
    return new Blob([plainBytes], { type: readDecryptedVaultFileMimeType(vaultAttachmentFileRelativePath) })
  }

  async createDecryptedVaultFileObjectUrl(vaultFileRelativePath: string): Promise<string> {
    const decryptedVaultFileBlob = await this.readVaultAttachmentFileBlob(vaultFileRelativePath)
    // Locked while it was being read: nothing is handed out.
    this.requireEndToEndVaultKeys()
    const decryptedVaultFileObjectUrl = URL.createObjectURL(decryptedVaultFileBlob)
    this.decryptedVaultFileObjectUrls.add(decryptedVaultFileObjectUrl)
    return decryptedVaultFileObjectUrl
  }

  async renameVaultEntry(typedFromVaultEntryRelativePath: string, typedToVaultEntryRelativePath: string): Promise<void> {
    assertVaultPathWritableByPapeliz(typedFromVaultEntryRelativePath)
    assertVaultPathWritableByPapeliz(typedToVaultEntryRelativePath)
    this.requireEndToEndVaultKeys()
    const fromVaultEntryRelativePath = this.resolveVaultPathCasing(typedFromVaultEntryRelativePath)
    const toVaultEntryRelativePath = this.resolveVaultParentFolderCasing(typedToVaultEntryRelativePath)
    if (this.findVaultEntryKind(fromVaultEntryRelativePath) === null) throw new PapelizVaultOperationError('File Not Found')
    this.assertVaultFolderPresent(getVaultEntryParentFolderRelativePath(toVaultEntryRelativePath))
    if (!isVaultRenameCaseOnly(fromVaultEntryRelativePath, toVaultEntryRelativePath)) {
      this.assertVaultEntryNameFree(toVaultEntryRelativePath)
      assertVaultCopyOutsideItsSource(fromVaultEntryRelativePath.toLowerCase(), toVaultEntryRelativePath.toLowerCase())
    }
    await this.moveOrCopyEncryptedVaultEntries(fromVaultEntryRelativePath, toVaultEntryRelativePath, false)
    await this.keepVaultFolderAfterItEmpties(getVaultEntryParentFolderRelativePath(fromVaultEntryRelativePath))
  }

  async copyVaultEntry(typedFromVaultEntryRelativePath: string, typedToVaultEntryRelativePath: string): Promise<void> {
    assertVaultPathWritableByPapeliz(typedFromVaultEntryRelativePath)
    assertVaultPathWritableByPapeliz(typedToVaultEntryRelativePath)
    this.requireEndToEndVaultKeys()
    const fromVaultEntryRelativePath = this.resolveVaultPathCasing(typedFromVaultEntryRelativePath)
    const toVaultEntryRelativePath = this.resolveVaultParentFolderCasing(typedToVaultEntryRelativePath)
    assertVaultCopyOutsideItsSource(fromVaultEntryRelativePath.toLowerCase(), toVaultEntryRelativePath.toLowerCase())
    this.assertVaultFolderPresent(getVaultEntryParentFolderRelativePath(toVaultEntryRelativePath))
    this.assertVaultEntryNameFree(toVaultEntryRelativePath)
    const sourceVaultEntryKind = this.findVaultEntryKind(fromVaultEntryRelativePath)
    if (sourceVaultEntryKind === null) throw new PapelizVaultOperationError('File Not Found')
    await this.moveOrCopyEncryptedVaultEntries(fromVaultEntryRelativePath, toVaultEntryRelativePath, true)
    // A folder with nothing in it but its folders' markers copies them; one with no marker at all
    // (made by hand) still arrives.
    if (sourceVaultEntryKind === 'folder') await this.keepVaultFolderAfterItEmpties(toVaultEntryRelativePath)
  }

  async importVaultFilesIntoNewFolder(
    suggestedVaultFolderName: string,
    vaultImportFiles: readonly PapelizVaultImportFile[],
    vaultImportOptions: PapelizVaultImportOptions = {},
  ): Promise<string> {
    this.requireEndToEndVaultKeys()
    const importVaultFolderName = pickFreePapelizImportVaultFolderName(suggestedVaultFolderName, this.listVaultFolderChildNames(papelizVaultRootFolderRelativePath))
    await this.writeVaultImportFilesInto(importVaultFolderName, vaultImportFiles, vaultImportOptions)
    return importVaultFolderName
  }

  // Import's files, encrypted as they come in, into a folder of the vault ('' for its top). A stop
  // part-way keeps what was written, with its folders.
  async writeVaultImportFilesInto(
    importVaultFolderRelativePath: string,
    vaultImportFiles: readonly PapelizVaultImportFile[],
    vaultImportOptions: PapelizVaultImportOptions,
  ): Promise<void> {
    const madeImportFolderRelativePaths = importVaultFolderRelativePath === papelizVaultRootFolderRelativePath ? [] : [importVaultFolderRelativePath]
    try {
      await writePapelizVaultImportFilesThroughFolderWriter(importVaultFolderRelativePath, vaultImportFiles, vaultImportOptions, {
        makeVaultImportSubfolder: async (vaultImportParentFolderRelativePath, vaultImportSubfolderName) => {
          const vaultImportSubfolderRelativePath = joinVaultRelativePath(vaultImportParentFolderRelativePath, vaultImportSubfolderName)
          madeImportFolderRelativePaths.push(vaultImportSubfolderRelativePath)
          return vaultImportSubfolderRelativePath
        },
        writeVaultImportFile: async (vaultImportFolderRelativePath, vaultImportFileName, readImportFileBytes) => {
          await this.writeEncryptedVaultFileBytes(joinVaultRelativePath(vaultImportFolderRelativePath, vaultImportFileName), await readImportFileBytes())
        },
      })
    } finally {
      if (!this.isLocked) {
        for (const madeImportFolderRelativePath of madeImportFolderRelativePaths) await this.keepVaultFolderAfterItEmpties(madeImportFolderRelativePath)
      }
    }
  }

  async moveVaultEntryToTrash(typedVaultEntryRelativePath: string): Promise<string> {
    assertVaultPathWritableByPapeliz(typedVaultEntryRelativePath)
    this.requireEndToEndVaultKeys()
    const vaultEntryRelativePath = this.resolveVaultPathCasing(typedVaultEntryRelativePath)
    const trashedVaultEntryKind = this.findVaultEntryKind(vaultEntryRelativePath)
    if (trashedVaultEntryKind === null) throw new PapelizVaultOperationError('File Not Found')
    const vaultTrashEntryRelativePath = joinVaultRelativePath(
      papelizVaultTrashFolderName,
      pickFreeVaultTrashEntryName(
        getVaultEntryName(vaultEntryRelativePath),
        trashedVaultEntryKind === 'folder',
        this.listVaultFolderChildNames(this.resolveVaultPathCasing(papelizVaultTrashFolderName)),
      ),
    )
    await this.moveOrCopyEncryptedVaultEntries(vaultEntryRelativePath, vaultTrashEntryRelativePath, false)
    await this.keepVaultFolderAfterItEmpties(getVaultEntryParentFolderRelativePath(vaultEntryRelativePath))
    return vaultTrashEntryRelativePath
  }

  async restoreVaultEntryFromTrash(typedVaultTrashEntryRelativePath: string, typedToVaultEntryRelativePath: string): Promise<void> {
    assertVaultPathInsideTrash(typedVaultTrashEntryRelativePath)
    assertVaultPathWritableByPapeliz(typedToVaultEntryRelativePath)
    this.requireEndToEndVaultKeys()
    const vaultTrashEntryRelativePath = this.resolveVaultPathCasing(typedVaultTrashEntryRelativePath)
    const toVaultEntryRelativePath = this.resolveVaultParentFolderCasing(typedToVaultEntryRelativePath)
    if (this.findVaultEntryKind(vaultTrashEntryRelativePath) === null) throw new PapelizVaultOperationError('File Not Found')
    this.assertVaultFolderPresent(getVaultEntryParentFolderRelativePath(toVaultEntryRelativePath))
    this.assertVaultEntryNameFree(toVaultEntryRelativePath)
    await this.moveOrCopyEncryptedVaultEntries(vaultTrashEntryRelativePath, toVaultEntryRelativePath, false)
    await this.keepVaultFolderAfterItEmpties(getVaultEntryParentFolderRelativePath(vaultTrashEntryRelativePath))
  }

  async takeBackEmptyNewVaultNote(typedNewVaultNoteRelativePath: string): Promise<boolean> {
    assertVaultPathWritableByPapeliz(typedNewVaultNoteRelativePath)
    this.requireEndToEndVaultKeys()
    if (!isVaultNoteFileName(getVaultEntryName(typedNewVaultNoteRelativePath))) return false
    const newVaultNoteRelativePath = this.resolveVaultPathCasing(typedNewVaultNoteRelativePath)
    const indexEntry = this.findEncryptedVaultFileIndexEntry(newVaultNoteRelativePath)
    if (indexEntry === undefined) throw new PapelizVaultOperationError('Not In Vault')
    if ((await this.decryptVaultFileContents(await this.readEncryptedVaultFileHeader(indexEntry))).length > 0) return false
    await this.storedVaultAdapter.removeStoredVaultEntry(makePapelizEncryptedVaultFileRelativePath(indexEntry.encryptedVaultEntryId))
    this.encryptedVaultIndexEntriesById.delete(indexEntry.encryptedVaultEntryId)
    await this.keepVaultFolderAfterItEmpties(getVaultEntryParentFolderRelativePath(newVaultNoteRelativePath))
    return true
  }

  // `.papeliz/vault-encryption.json` and a browser vault's own name file stay plain, as they are read
  // before the vault is unlocked; the encryption's file is never written from here. Every other
  // settings file is an encrypted file at `.papeliz/<name>`.
  async readPapelizVaultSettingsFile(papelizVaultSettingsFileName: string): Promise<string | null> {
    assertPapelizVaultSettingsFileName(papelizVaultSettingsFileName)
    this.requireEndToEndVaultKeys()
    if (papelizVaultSettingsFileName === papelizVaultEncryptionSettingsFileName || papelizVaultSettingsFileName === papelizBrowserVaultSettingsFileName) {
      return this.storedVaultAdapter.readPapelizVaultSettingsFile(papelizVaultSettingsFileName)
    }
    const vaultSettingsFileRelativePath = this.resolveVaultPathCasing(joinVaultRelativePath(papelizVaultSettingsFolderName, papelizVaultSettingsFileName))
    if (this.findEncryptedVaultFileIndexEntry(vaultSettingsFileRelativePath) === undefined) return null
    return papelizVaultTextDecoder.decode(await this.readDecryptedVaultFileBytes(vaultSettingsFileRelativePath))
  }

  async writePapelizVaultSettingsFile(papelizVaultSettingsFileName: string, papelizVaultSettingsFileText: string): Promise<void> {
    assertPapelizVaultSettingsFileName(papelizVaultSettingsFileName)
    this.requireEndToEndVaultKeys()
    if (papelizVaultSettingsFileName === papelizVaultEncryptionSettingsFileName) throw new PapelizVaultOperationError('Unknown Settings File')
    if (papelizVaultSettingsFileName === papelizBrowserVaultSettingsFileName) {
      await this.storedVaultAdapter.writePapelizVaultSettingsFile(papelizVaultSettingsFileName, papelizVaultSettingsFileText)
      return
    }
    await this.writeEncryptedVaultFileBytes(joinVaultRelativePath(papelizVaultSettingsFolderName, papelizVaultSettingsFileName), papelizVaultTextEncoder.encode(papelizVaultSettingsFileText))
  }
}
