import { papelizDesktopSavingFileSuffix, type PapelizDesktopFileSystem, type PapelizDesktopFileSystemEntry } from '../desktop/papeliz-desktop-platform-contract'
import type { PapelizVaultSyncableFileStat } from './papeliz-directory-handle-vault-adapter'
import { PapelizVaultOperationError, type PapelizVaultAdapter, type PapelizVaultTreeEntry, type PapelizVaultTreeListingOptions } from './papeliz-vault-adapter'
import {
  assertPapelizVaultSettingsFileName,
  assertVaultCopyOutsideItsSource,
  assertVaultEntryNameIsFreeAmongNames,
  assertVaultPathInsideTrash,
  assertVaultPathWritableByPapeliz,
  isVaultEntryLeftOutOfTreeListing,
  isVaultFolderOpenedForTreeListing,
  isVaultFolderSearchedForSyncableFiles,
  isVaultRenameCaseOnly,
  PapelizVaultFileByteCheckMemory,
  pickFreeVaultTrashEntryName,
  pickVaultCaseOnlyRenameTemporaryName,
} from './papeliz-vault-folder-adapter-rules'
import {
  pickFreePapelizImportVaultFolderName,
  writePapelizVaultImportFilesThroughFolderWriter,
  type PapelizVaultImportFile,
  type PapelizVaultImportFolderWriter,
  type PapelizVaultImportOptions,
} from './papeliz-vault-folder-import'
import {
  getVaultEntryName,
  getVaultEntryParentFolderRelativePath,
  isVaultFileRelativePathSyncable,
  isVaultNoteFileName,
  joinVaultRelativePath,
  papelizVaultRootFolderRelativePath,
  papelizVaultSettingsFolderName,
  papelizVaultTrashFolderName,
} from './papeliz-vault-relative-paths'
import {
  assertVaultEntryRelativePathCarriedByVaultEncryption,
  assertVaultFileRelativePathCarriedByVaultEncryption,
  assertVaultFolderRelativePathCarriedByVaultEncryption,
  isVaultFileRelativePathCarriedByVaultEncryption,
  isVaultFolderSearchedForVaultEncryption,
  type PapelizVaultStoredFileAccess,
} from './papeliz-vault-encryption-stored-files'
import { assertVaultTextFileOpenableAtByteLength, classifyVaultFileByName, papelizVaultFileByteCheckLength } from './papeliz-vault-text-files'

// Papeliz Sync's whole-file access, as a folder opened in the browser has it
// (papeliz-sync-local-vault-files.ts finds these methods by name).
interface PapelizDesktopFolderVaultWholeFileAccess {
  listSyncableVaultFileStats(): Promise<PapelizVaultSyncableFileStat[]>
  readVaultFileBytes(vaultFileRelativePath: string): Promise<Uint8Array>
  writeVaultFileBytes(vaultFileRelativePath: string, vaultFileBytes: Uint8Array): Promise<void>
}

// A vault path segment Papeliz reaches on disk: a plain name. Never empty, never with a "\" or a ":",
// which Windows reads as a folder separator or a drive, and never "." or ".." or a name ending in a
// dot or a space: Windows reads the first two as the folder itself or the one above, and trims the
// rest, so "Plan." would reach "Plan".
function isDesktopVaultPathSegmentReachable(vaultPathSegment: string): boolean {
  return vaultPathSegment.length > 0 && !/[\\:]/.test(vaultPathSegment) && !/[. ]$/.test(vaultPathSegment)
}

// A vault that is a real folder on disk in Papeliz for Windows, reached by absolute path through the
// desktop app's native file calls instead of a browser's directory handles. It behaves as a folder
// opened in the browser does (papeliz-directory-handle-vault-adapter.ts), with the same rules
// (papeliz-vault-folder-adapter-rules.ts): hidden entries, names compared without case, the trash,
// `.papeliz/` and Papeliz Sync's whole-file access. Nothing is deleted outright: a deleted note or
// folder goes into `.trash/` in one native rename.
export function createPapelizDesktopFolderVaultAdapter(desktopVaultFolderPath: string, desktopFileSystem: PapelizDesktopFileSystem): PapelizVaultAdapter {
  const vaultFileByteCheckMemory = new PapelizVaultFileByteCheckMemory()

  // The one place a vault path becomes an absolute path on disk ("" is the vault folder itself). A
  // path with an empty segment, "..", or anything else that would reach outside the vault folder fails
  // with "Outside Vault" before any native call.
  const resolveDesktopVaultPath = (vaultEntryRelativePath: string): string => {
    if (vaultEntryRelativePath === papelizVaultRootFolderRelativePath) return desktopVaultFolderPath
    const vaultPathSegments = vaultEntryRelativePath.split('/')
    if (!vaultPathSegments.every(isDesktopVaultPathSegmentReachable)) throw new PapelizVaultOperationError('Outside Vault')
    return desktopFileSystem.joinDesktopPath(desktopVaultFolderPath, ...vaultPathSegments)
  }

  // A vault entry's absolute path, name and folder, once its whole path passed the check above.
  const locateDesktopVaultEntry = (vaultEntryRelativePath: string) => ({
    desktopEntryPath: resolveDesktopVaultPath(vaultEntryRelativePath),
    vaultEntryName: getVaultEntryName(vaultEntryRelativePath),
    vaultParentFolderRelativePath: getVaultEntryParentFolderRelativePath(vaultEntryRelativePath),
  })

  // A folder's entries that a vault path can reach again; any other (a name ending in a dot, made
  // outside Windows' usual calls) stays out, as nothing in Papeliz could open or change it. So does a
  // save's own `.papeliz-saving` file, which a crash in the middle of a save could leave behind.
  const listDesktopVaultFolderEntries = async (vaultFolderRelativePath: string): Promise<PapelizDesktopFileSystemEntry[]> =>
    (await desktopFileSystem.listDesktopFolderEntries(resolveDesktopVaultPath(vaultFolderRelativePath))).filter(
      (desktopFolderEntry) =>
        isDesktopVaultPathSegmentReachable(desktopFolderEntry.desktopEntryName) && !desktopFolderEntry.desktopEntryName.endsWith(papelizDesktopSavingFileSuffix),
    )

  // A folder that must be there. One moved or trashed meanwhile fails with "Not In Vault", as a
  // missing entry does in a folder opened in the browser; the vault folder itself is taken as there.
  const resolveExistingDesktopVaultFolderPath = async (vaultFolderRelativePath: string): Promise<string> => {
    const desktopFolderPath = resolveDesktopVaultPath(vaultFolderRelativePath)
    if (vaultFolderRelativePath === papelizVaultRootFolderRelativePath) return desktopFolderPath
    const desktopFolderEntry = await desktopFileSystem.readDesktopEntry(desktopFolderPath)
    if (desktopFolderEntry?.isDesktopEntryFolder !== true) throw new PapelizVaultOperationError('Not In Vault')
    return desktopFolderPath
  }

  // A file that must be there, with what its entry says (its size, when known). A file that is gone,
  // or a folder in its place, fails with "Not In Vault".
  const readExistingDesktopVaultFileEntry = async (vaultFileRelativePath: string) => {
    const desktopFilePath = resolveDesktopVaultPath(vaultFileRelativePath)
    const desktopFileEntry = await desktopFileSystem.readDesktopEntry(desktopFilePath)
    if (desktopFileEntry === null || desktopFileEntry.isDesktopEntryFolder) throw new PapelizVaultOperationError('Not In Vault')
    return { desktopFilePath, desktopFileEntry }
  }

  // The folder must be there, and no entry in it may have the name, whatever its case.
  const assertDesktopVaultEntryNameIsFree = async (vaultFolderRelativePath: string, vaultEntryName: string): Promise<void> => {
    await resolveExistingDesktopVaultFolderPath(vaultFolderRelativePath)
    const desktopFolderEntries = await listDesktopVaultFolderEntries(vaultFolderRelativePath)
    assertVaultEntryNameIsFreeAmongNames(
      desktopFolderEntries.map((desktopFolderEntry) => desktopFolderEntry.desktopEntryName),
      vaultEntryName,
    )
  }

  // The entry of exactly that name, as its folder lists it. Fails with "File Not Found", as a folder
  // opened in the browser does.
  const findDesktopVaultEntry = async (vaultEntryRelativePath: string): Promise<PapelizDesktopFileSystemEntry> => {
    const vaultEntryName = getVaultEntryName(vaultEntryRelativePath)
    const desktopFolderEntries = await listDesktopVaultFolderEntries(getVaultEntryParentFolderRelativePath(vaultEntryRelativePath))
    const foundDesktopEntry = desktopFolderEntries.find((desktopFolderEntry) => desktopFolderEntry.desktopEntryName === vaultEntryName)
    if (foundDesktopEntry === undefined) throw new PapelizVaultOperationError('File Not Found')
    return foundDesktopEntry
  }

  // The native side reads a file only whole, so the byte check reads it all once and looks at its
  // start; the memory keeps the answer until the file changes.
  const isDesktopVaultFilePlainText = async (desktopFileEntry: PapelizDesktopFileSystemEntry, vaultFileRelativePath: string): Promise<boolean> => {
    try {
      return await vaultFileByteCheckMemory.isVaultFilePlainText(vaultFileRelativePath, desktopFileEntry.desktopFileByteCount, desktopFileEntry.desktopEntryModifiedAt, async () =>
        (await desktopFileSystem.readDesktopFileBytes(resolveDesktopVaultPath(vaultFileRelativePath))).subarray(0, papelizVaultFileByteCheckLength),
      )
    } catch {
      // Unreadable right now (another app holding it, say): left out until the next listing.
      return false
    }
  }

  const moveDesktopVaultEntryToTrash = async (vaultEntryRelativePath: string): Promise<string> => {
    const { desktopEntryPath, vaultEntryName, vaultParentFolderRelativePath } = locateDesktopVaultEntry(vaultEntryRelativePath)
    assertVaultPathWritableByPapeliz(vaultEntryRelativePath)
    await resolveExistingDesktopVaultFolderPath(vaultParentFolderRelativePath)
    const trashedDesktopEntry = await findDesktopVaultEntry(vaultEntryRelativePath)
    await desktopFileSystem.makeDesktopFolder(resolveDesktopVaultPath(papelizVaultTrashFolderName))
    const vaultTrashEntryNames = (await listDesktopVaultFolderEntries(papelizVaultTrashFolderName)).map((vaultTrashDesktopEntry) => vaultTrashDesktopEntry.desktopEntryName)
    const vaultTrashEntryRelativePath = joinVaultRelativePath(
      papelizVaultTrashFolderName,
      pickFreeVaultTrashEntryName(vaultEntryName, trashedDesktopEntry.isDesktopEntryFolder, vaultTrashEntryNames),
    )
    await desktopFileSystem.renameDesktopEntry(desktopEntryPath, resolveDesktopVaultPath(vaultTrashEntryRelativePath))
    return vaultTrashEntryRelativePath
  }

  // Import from Files, Zip or Template writes by vault path, each one checked as any other.
  const desktopVaultImportFolderWriter: PapelizVaultImportFolderWriter<string> = {
    makeVaultImportSubfolder: async (vaultImportParentFolderRelativePath, vaultImportSubfolderName) => {
      const vaultImportSubfolderRelativePath = joinVaultRelativePath(vaultImportParentFolderRelativePath, vaultImportSubfolderName)
      await desktopFileSystem.makeDesktopFolder(resolveDesktopVaultPath(vaultImportSubfolderRelativePath))
      return vaultImportSubfolderRelativePath
    },
    writeVaultImportFile: async (vaultImportFolderRelativePath, vaultImportFileName, readImportFileBytes) => {
      const desktopImportFilePath = resolveDesktopVaultPath(joinVaultRelativePath(vaultImportFolderRelativePath, vaultImportFileName))
      await desktopFileSystem.writeDesktopFileBytes(desktopImportFilePath, await readImportFileBytes())
    },
  }

  // Every file, with its size and last change, in the folders and of the paths the two rules let in.
  const collectDesktopVaultFileStats = async (
    isVaultFolderSearched: (vaultParentFolderRelativePath: string, vaultFolderName: string) => boolean,
    isVaultFileListed: (vaultFileRelativePath: string) => boolean,
  ): Promise<PapelizVaultSyncableFileStat[]> => {
    const collectedVaultFileStats: PapelizVaultSyncableFileStat[] = []
    const collectVaultFolderFileStats = async (vaultFolderRelativePath: string) => {
      for (const desktopFolderEntry of await listDesktopVaultFolderEntries(vaultFolderRelativePath)) {
        const vaultEntryName = desktopFolderEntry.desktopEntryName
        const vaultEntryRelativePath = joinVaultRelativePath(vaultFolderRelativePath, vaultEntryName)
        if (desktopFolderEntry.isDesktopEntryFolder) {
          if (isVaultFolderSearched(vaultFolderRelativePath, vaultEntryName)) await collectVaultFolderFileStats(vaultEntryRelativePath)
        } else if (isVaultFileListed(vaultEntryRelativePath)) {
          // A size the listing doesn't give is measured by reading the file. A time it doesn't give
          // is the time of this listing, so Sync reads the file and compares what is in it rather
          // than taking it as unchanged.
          collectedVaultFileStats.push({
            vaultFileRelativePath: vaultEntryRelativePath,
            vaultFileByteLength: desktopFolderEntry.desktopFileByteCount ?? (await desktopFileSystem.readDesktopFileBytes(resolveDesktopVaultPath(vaultEntryRelativePath))).length,
            vaultFileModifiedAt: desktopFolderEntry.desktopEntryModifiedAt ?? Date.now(),
          })
        }
      }
    }
    await collectVaultFolderFileStats(papelizVaultRootFolderRelativePath)
    return collectedVaultFileStats
  }

  // Writes the whole file, making its folders.
  const writeWholeDesktopVaultFileBytes = async (vaultFileRelativePath: string, vaultFileBytes: Uint8Array): Promise<void> => {
    const { desktopEntryPath, vaultParentFolderRelativePath } = locateDesktopVaultEntry(vaultFileRelativePath)
    if (vaultParentFolderRelativePath !== papelizVaultRootFolderRelativePath) await desktopFileSystem.makeDesktopFolder(resolveDesktopVaultPath(vaultParentFolderRelativePath))
    await desktopFileSystem.writeDesktopFileBytes(desktopEntryPath, vaultFileBytes)
  }

  const desktopFolderVaultAdapter: PapelizVaultAdapter & PapelizDesktopFolderVaultWholeFileAccess & PapelizVaultStoredFileAccess = {
    papelizVaultKind: 'folder-on-disk',

    async listVaultTreeEntries(vaultTreeListingOptions?: PapelizVaultTreeListingOptions): Promise<PapelizVaultTreeEntry[]> {
      const isEveryHiddenVaultEntryListed = vaultTreeListingOptions?.isEveryHiddenVaultEntryListed === true
      const vaultTreeEntries: PapelizVaultTreeEntry[] = []
      const collectVaultFolderEntries = async (vaultFolderRelativePath: string) => {
        for (const desktopFolderEntry of await listDesktopVaultFolderEntries(vaultFolderRelativePath)) {
          const vaultEntryName = desktopFolderEntry.desktopEntryName
          const vaultEntryRelativePath = joinVaultRelativePath(vaultFolderRelativePath, vaultEntryName)
          if (isVaultEntryLeftOutOfTreeListing(vaultEntryRelativePath, isEveryHiddenVaultEntryListed)) continue
          if (desktopFolderEntry.isDesktopEntryFolder) {
            vaultTreeEntries.push({ vaultEntryRelativePath, vaultEntryKind: 'folder' })
            if (isVaultFolderOpenedForTreeListing(vaultEntryName)) await collectVaultFolderEntries(vaultEntryRelativePath)
            continue
          }
          const vaultFileNameKind = classifyVaultFileByName(vaultEntryName)
          if (vaultFileNameKind === 'vault-note') {
            vaultTreeEntries.push({ vaultEntryRelativePath, vaultEntryKind: 'note' })
          } else if (vaultFileNameKind === 'vault-text-file' || (vaultFileNameKind === 'vault-file-needing-byte-check' && (await isDesktopVaultFilePlainText(desktopFolderEntry, vaultEntryRelativePath)))) {
            vaultTreeEntries.push({ vaultEntryRelativePath, vaultEntryKind: 'text-file' })
          }
        }
      }
      await collectVaultFolderEntries(papelizVaultRootFolderRelativePath)
      return vaultTreeEntries
    },

    async readVaultNoteText(vaultNoteRelativePath: string): Promise<string> {
      const { desktopFilePath, desktopFileEntry } = await readExistingDesktopVaultFileEntry(vaultNoteRelativePath)
      // A text file over 5 MB is refused by the size its entry gives, before its text is read; when
      // the entry doesn't give one, by the text read.
      if (desktopFileEntry.desktopFileByteCount !== null) assertVaultTextFileOpenableAtByteLength(vaultNoteRelativePath, desktopFileEntry.desktopFileByteCount)
      const vaultNoteText = await desktopFileSystem.readDesktopFileText(desktopFilePath)
      if (desktopFileEntry.desktopFileByteCount === null) assertVaultTextFileOpenableAtByteLength(vaultNoteRelativePath, new TextEncoder().encode(vaultNoteText).length)
      return vaultNoteText
    },

    async writeVaultNoteText(vaultNoteRelativePath: string, vaultNoteText: string): Promise<void> {
      const { desktopEntryPath, vaultParentFolderRelativePath } = locateDesktopVaultEntry(vaultNoteRelativePath)
      assertVaultPathWritableByPapeliz(vaultNoteRelativePath)
      await resolveExistingDesktopVaultFolderPath(vaultParentFolderRelativePath)
      await desktopFileSystem.writeDesktopFileText(desktopEntryPath, vaultNoteText)
    },

    async createVaultNote(vaultNoteRelativePath: string, vaultNoteText: string): Promise<void> {
      const { desktopEntryPath, vaultEntryName, vaultParentFolderRelativePath } = locateDesktopVaultEntry(vaultNoteRelativePath)
      assertVaultPathWritableByPapeliz(vaultNoteRelativePath)
      await assertDesktopVaultEntryNameIsFree(vaultParentFolderRelativePath, vaultEntryName)
      await desktopFileSystem.writeDesktopFileText(desktopEntryPath, vaultNoteText)
    },

    async createVaultFolder(vaultFolderRelativePath: string): Promise<void> {
      const { desktopEntryPath, vaultEntryName, vaultParentFolderRelativePath } = locateDesktopVaultEntry(vaultFolderRelativePath)
      assertVaultPathWritableByPapeliz(vaultFolderRelativePath)
      await assertDesktopVaultEntryNameIsFree(vaultParentFolderRelativePath, vaultEntryName)
      await desktopFileSystem.makeDesktopFolder(desktopEntryPath)
    },

    async createVaultAttachmentFile(vaultAttachmentFileRelativePath: string, vaultAttachmentFileBlob: Blob): Promise<void> {
      const { desktopEntryPath, vaultEntryName, vaultParentFolderRelativePath } = locateDesktopVaultEntry(vaultAttachmentFileRelativePath)
      assertVaultPathWritableByPapeliz(vaultAttachmentFileRelativePath)
      await assertDesktopVaultEntryNameIsFree(vaultParentFolderRelativePath, vaultEntryName)
      await desktopFileSystem.writeDesktopFileBytes(desktopEntryPath, new Uint8Array(await vaultAttachmentFileBlob.arrayBuffer()))
    },

    async listVaultAttachmentFileRelativePaths(): Promise<string[]> {
      const vaultAttachmentFileRelativePaths: string[] = []
      const collectVaultFolderAttachmentFiles = async (vaultFolderRelativePath: string) => {
        for (const desktopFolderEntry of await listDesktopVaultFolderEntries(vaultFolderRelativePath)) {
          const vaultEntryName = desktopFolderEntry.desktopEntryName
          if (vaultEntryName.startsWith('.')) continue
          const vaultEntryRelativePath = joinVaultRelativePath(vaultFolderRelativePath, vaultEntryName)
          if (desktopFolderEntry.isDesktopEntryFolder) await collectVaultFolderAttachmentFiles(vaultEntryRelativePath)
          else if (!isVaultNoteFileName(vaultEntryName)) vaultAttachmentFileRelativePaths.push(vaultEntryRelativePath)
        }
      }
      await collectVaultFolderAttachmentFiles(papelizVaultRootFolderRelativePath)
      return vaultAttachmentFileRelativePaths
    },

    async readVaultAttachmentFileBlob(vaultAttachmentFileRelativePath: string): Promise<Blob> {
      const { desktopFilePath } = await readExistingDesktopVaultFileEntry(vaultAttachmentFileRelativePath)
      return new Blob([(await desktopFileSystem.readDesktopFileBytes(desktopFilePath)) as Uint8Array<ArrayBuffer>])
    },

    async renameVaultEntry(fromVaultEntryRelativePath: string, toVaultEntryRelativePath: string): Promise<void> {
      const fromVaultEntry = locateDesktopVaultEntry(fromVaultEntryRelativePath)
      const toVaultEntry = locateDesktopVaultEntry(toVaultEntryRelativePath)
      assertVaultPathWritableByPapeliz(fromVaultEntryRelativePath)
      assertVaultPathWritableByPapeliz(toVaultEntryRelativePath)
      await resolveExistingDesktopVaultFolderPath(fromVaultEntry.vaultParentFolderRelativePath)
      await resolveExistingDesktopVaultFolderPath(toVaultEntry.vaultParentFolderRelativePath)

      // "inbox.md" and "Inbox.md" are the same file on Windows, and the native rename refuses a taken
      // target, so the rename goes through a temporary name.
      if (isVaultRenameCaseOnly(fromVaultEntryRelativePath, toVaultEntryRelativePath)) {
        await findDesktopVaultEntry(fromVaultEntryRelativePath)
        const temporaryDesktopEntryPath = resolveDesktopVaultPath(
          joinVaultRelativePath(toVaultEntry.vaultParentFolderRelativePath, pickVaultCaseOnlyRenameTemporaryName(fromVaultEntry.vaultEntryName)),
        )
        await desktopFileSystem.renameDesktopEntry(fromVaultEntry.desktopEntryPath, temporaryDesktopEntryPath)
        await desktopFileSystem.renameDesktopEntry(temporaryDesktopEntryPath, toVaultEntry.desktopEntryPath)
        return
      }

      await assertDesktopVaultEntryNameIsFree(toVaultEntry.vaultParentFolderRelativePath, toVaultEntry.vaultEntryName)
      await findDesktopVaultEntry(fromVaultEntryRelativePath)
      await desktopFileSystem.renameDesktopEntry(fromVaultEntry.desktopEntryPath, toVaultEntry.desktopEntryPath)
    },

    async copyVaultEntry(fromVaultEntryRelativePath: string, toVaultEntryRelativePath: string): Promise<void> {
      const fromVaultEntry = locateDesktopVaultEntry(fromVaultEntryRelativePath)
      const toVaultEntry = locateDesktopVaultEntry(toVaultEntryRelativePath)
      assertVaultPathWritableByPapeliz(fromVaultEntryRelativePath)
      assertVaultPathWritableByPapeliz(toVaultEntryRelativePath)
      assertVaultCopyOutsideItsSource(fromVaultEntryRelativePath, toVaultEntryRelativePath)
      // "ideas/Copy" is inside "Ideas" on Windows, so the check runs again without case before the
      // native copy, which copies everything in a folder, hidden entries too.
      assertVaultCopyOutsideItsSource(fromVaultEntryRelativePath.toLowerCase(), toVaultEntryRelativePath.toLowerCase())
      await resolveExistingDesktopVaultFolderPath(fromVaultEntry.vaultParentFolderRelativePath)
      await assertDesktopVaultEntryNameIsFree(toVaultEntry.vaultParentFolderRelativePath, toVaultEntry.vaultEntryName)
      await findDesktopVaultEntry(fromVaultEntryRelativePath)
      await desktopFileSystem.copyDesktopEntry(fromVaultEntry.desktopEntryPath, toVaultEntry.desktopEntryPath)
    },

    async importVaultFilesIntoNewFolder(suggestedVaultFolderName: string, vaultImportFiles: readonly PapelizVaultImportFile[], vaultImportOptions: PapelizVaultImportOptions = {}): Promise<string> {
      const vaultTopDesktopEntries = await listDesktopVaultFolderEntries(papelizVaultRootFolderRelativePath)
      const importVaultFolderName = pickFreePapelizImportVaultFolderName(
        suggestedVaultFolderName,
        vaultTopDesktopEntries.map((vaultTopDesktopEntry) => vaultTopDesktopEntry.desktopEntryName),
      )
      await desktopFileSystem.makeDesktopFolder(resolveDesktopVaultPath(importVaultFolderName))
      await writePapelizVaultImportFilesThroughFolderWriter(importVaultFolderName, vaultImportFiles, vaultImportOptions, desktopVaultImportFolderWriter)
      return importVaultFolderName
    },

    moveVaultEntryToTrash: moveDesktopVaultEntryToTrash,

    async restoreVaultEntryFromTrash(vaultTrashEntryRelativePath: string, toVaultEntryRelativePath: string): Promise<void> {
      const vaultTrashEntry = locateDesktopVaultEntry(vaultTrashEntryRelativePath)
      const toVaultEntry = locateDesktopVaultEntry(toVaultEntryRelativePath)
      assertVaultPathInsideTrash(vaultTrashEntryRelativePath)
      assertVaultPathWritableByPapeliz(toVaultEntryRelativePath)
      await resolveExistingDesktopVaultFolderPath(vaultTrashEntry.vaultParentFolderRelativePath)
      await assertDesktopVaultEntryNameIsFree(toVaultEntry.vaultParentFolderRelativePath, toVaultEntry.vaultEntryName)
      await findDesktopVaultEntry(vaultTrashEntryRelativePath)
      await desktopFileSystem.renameDesktopEntry(vaultTrashEntry.desktopEntryPath, toVaultEntry.desktopEntryPath)
    },

    async takeBackEmptyNewVaultNote(newVaultNoteRelativePath: string): Promise<boolean> {
      const { vaultEntryName } = locateDesktopVaultEntry(newVaultNoteRelativePath)
      assertVaultPathWritableByPapeliz(newVaultNoteRelativePath)
      if (!isVaultNoteFileName(vaultEntryName)) return false
      const { desktopFilePath, desktopFileEntry } = await readExistingDesktopVaultFileEntry(newVaultNoteRelativePath)
      const newVaultNoteByteCount = desktopFileEntry.desktopFileByteCount ?? (await desktopFileSystem.readDesktopFileBytes(desktopFilePath)).length
      if (newVaultNoteByteCount > 0) return false
      // The note was made a moment ago and is still empty, so it is removed outright, as the folder
      // adapter does, rather than leaving an empty note in `.trash/`.
      await desktopFileSystem.removeDesktopEntry(desktopFilePath)
      return true
    },

    async readPapelizVaultSettingsFile(papelizVaultSettingsFileName: string): Promise<string | null> {
      assertPapelizVaultSettingsFileName(papelizVaultSettingsFileName)
      const desktopSettingsFilePath = resolveDesktopVaultPath(joinVaultRelativePath(papelizVaultSettingsFolderName, papelizVaultSettingsFileName))
      const desktopSettingsFileEntry = await desktopFileSystem.readDesktopEntry(desktopSettingsFilePath)
      if (desktopSettingsFileEntry === null || desktopSettingsFileEntry.isDesktopEntryFolder) return null
      return desktopFileSystem.readDesktopFileText(desktopSettingsFilePath)
    },

    async writePapelizVaultSettingsFile(papelizVaultSettingsFileName: string, papelizVaultSettingsFileText: string): Promise<void> {
      assertPapelizVaultSettingsFileName(papelizVaultSettingsFileName)
      await desktopFileSystem.makeDesktopFolder(resolveDesktopVaultPath(papelizVaultSettingsFolderName))
      await desktopFileSystem.writeDesktopFileText(
        resolveDesktopVaultPath(joinVaultRelativePath(papelizVaultSettingsFolderName, papelizVaultSettingsFileName)),
        papelizVaultSettingsFileText,
      )
    },

    // Papeliz Sync's own access (papeliz-sync-local-vault-files.ts): every file it carries, whole, with
    // sizes and times (papeliz-vault-relative-paths.ts says which). Hidden folders and files stay out,
    // except `.papeliz/` and `.csessions/` at the top.
    listSyncableVaultFileStats(): Promise<PapelizVaultSyncableFileStat[]> {
      return collectDesktopVaultFileStats(isVaultFolderSearchedForSyncableFiles, isVaultFileRelativePathSyncable)
    },

    async readVaultFileBytes(vaultFileRelativePath: string): Promise<Uint8Array> {
      const { desktopFilePath } = await readExistingDesktopVaultFileEntry(vaultFileRelativePath)
      return desktopFileSystem.readDesktopFileBytes(desktopFilePath)
    },

    // Writes the whole file, making its folders. Only a file Sync carries.
    async writeVaultFileBytes(vaultFileRelativePath: string, vaultFileBytes: Uint8Array): Promise<void> {
      locateDesktopVaultEntry(vaultFileRelativePath)
      if (!isVaultFileRelativePathSyncable(vaultFileRelativePath)) throw new PapelizVaultOperationError('Not Synced')
      await writeWholeDesktopVaultFileBytes(vaultFileRelativePath, vaultFileBytes)
    },

    // Vault encryption's own access (papeliz-vault-encryption-stored-files.ts): every file a change of
    // kind carries, whole, by its path as stored.
    listStoredVaultFileStats(): Promise<PapelizVaultSyncableFileStat[]> {
      return collectDesktopVaultFileStats(isVaultFolderSearchedForVaultEncryption, isVaultFileRelativePathCarriedByVaultEncryption)
    },

    async writeStoredVaultFileBytes(storedVaultFileRelativePath: string, storedVaultFileBytes: Uint8Array): Promise<void> {
      locateDesktopVaultEntry(storedVaultFileRelativePath)
      assertVaultFileRelativePathCarriedByVaultEncryption(storedVaultFileRelativePath)
      await writeWholeDesktopVaultFileBytes(storedVaultFileRelativePath, storedVaultFileBytes)
    },

    // The native remove takes a folder with everything in it, so a folder is removed only once it lists
    // nothing.
    async removeStoredVaultEntry(storedVaultEntryRelativePath: string): Promise<void> {
      const { desktopEntryPath } = locateDesktopVaultEntry(storedVaultEntryRelativePath)
      assertVaultEntryRelativePathCarriedByVaultEncryption(storedVaultEntryRelativePath)
      const storedDesktopEntry = await desktopFileSystem.readDesktopEntry(desktopEntryPath)
      if (storedDesktopEntry === null) throw new PapelizVaultOperationError('Not In Vault')
      // As a browser's own folder remove refuses one that isn't empty.
      if (storedDesktopEntry.isDesktopEntryFolder && (await desktopFileSystem.listDesktopFolderEntries(desktopEntryPath)).length > 0) {
        throw new DOMException('The folder is not empty.', 'InvalidModificationError')
      }
      await desktopFileSystem.removeDesktopEntry(desktopEntryPath)
    },

    async makeStoredVaultFolder(storedVaultFolderRelativePath: string): Promise<void> {
      const { desktopEntryPath } = locateDesktopVaultEntry(storedVaultFolderRelativePath)
      assertVaultFolderRelativePathCarriedByVaultEncryption(storedVaultFolderRelativePath)
      await desktopFileSystem.makeDesktopFolder(desktopEntryPath)
    },
  }
  return desktopFolderVaultAdapter
}
