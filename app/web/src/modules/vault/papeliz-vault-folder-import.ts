import { isPapelizDesktopApp } from 'virtual:papeliz-desktop-platform-availability'
import { normalizePapelizImportZipEntryPath, readPapelizImportZipFile } from '../export-zip/papeliz-import-zip-file-reader'
import type { PapelizImportedTemplateFolderSource } from '../template-gallery/papeliz-template-gallery-imported-folders'
import { findPapelizTemplatePictureFormatByName, stripPapelizTemplatePictureMetadata } from '../template-gallery/papeliz-template-gallery-picture-metadata'
import type { PapelizVaultFileContentsWriter } from './papeliz-directory-handle-vault-adapter'
import { PapelizVaultOperationError } from './papeliz-vault-adapter'
import {
  papelizVaultChatSessionFolderName,
  papelizVaultEarlierChatSessionFolderName,
  papelizVaultSettingsFolderName,
  papelizVaultTrashFolderName,
  pickFreeVaultEntryName,
} from './papeliz-vault-relative-paths'

// Files coming into a vault from outside, written as they are: a new vault's files (an import, a
// template), and Import from Files, Zip or Template in an open vault. The last always go into a new
// folder at the vault's top, named after what was imported ("P1-Workflow", "Field Notes", or
// "Imported Files" for loose files) or the next free name ("Field Notes 2"), so nothing already in the
// vault changes, and the folder is an ordinary one afterwards. On the way into an open vault:
// - a `.git/` folder and the leftovers other systems add (`__MACOSX/`, `.DS_Store`, `Thumbs.db`,
//   `desktop.ini`) stay out, and so do the import's own `.papeliz/`, `.csessions/`, `.chatsession/`
//   and `.trash/`, which mean something only at a vault's top;
// - PNG, JPEG and WebP pictures lose their metadata (a picture that doesn't read as its type comes in
//   as it is);
// - at most 20,000 files come in at once, and on the web at most 2 GB; in the desktop app, which
//   writes the files one at a time, no total applies, only 1 GB for each file.

export interface PapelizVaultImportFile {
  // Inside the new vault, or the new folder: "Ideas/Offline first.md".
  importFileRelativePath: string
  isImportFileFolder: boolean
  importFileByteCount: number
  readImportFileBytes: () => Promise<Uint8Array>
}

export interface PapelizVaultImportOptions {
  onBrowserVaultImportProgress?: (importedFileCount: number, importFileCount: number) => void
  browserVaultImportAbortSignal?: AbortSignal
}

// What Import from Files, Zip or Template brings into an open vault, ready to write.
export interface PapelizVaultFolderImportPlan {
  // The new folder's name before a free one is picked.
  suggestedVaultFolderName: string
  vaultFolderImportFiles: PapelizVaultImportFile[]
  // Left out: leftovers, `.git/`, the import's own Papeliz folders, and paths that would leave it.
  skippedImportFileCount: number
  // Files only; empty folders aren't counted.
  importFileCount: number
  importTotalByteCount: number
}

export interface PapelizVaultFolderImportOptions {
  onVaultFolderImportProgress?: (importedFileCount: number, importFileCount: number) => void
  // Import from Template: where the folder came from, recorded in the vault's `.papeliz/`
  // (papeliz-template-gallery-imported-folders.ts).
  importedTemplateFolderSource?: PapelizImportedTemplateFolderSource
}

// - `imported`: the new folder, from the vault's top ("P1-Workflow 2"), and how many files went in.
// - `failed`: why, as a sentence. A write that stopped partway keeps the files written so far, and
//   the sentence says so.
export type PapelizVaultFolderImportResult =
  | { vaultFolderImportOutcome: 'imported'; importedVaultFolderRelativePath: string; importedFileCount: number }
  | { vaultFolderImportOutcome: 'failed'; vaultFolderImportFailureMessage: string }

export const papelizVaultFolderImportMostFileCount = 20_000
// The most an import brings in all: 2 GB on the web. None in the desktop app, whose native side
// writes the files one at a time, so the total doesn't matter there.
export const papelizVaultFolderImportMostTotalByteCount = isPapelizDesktopApp ? Number.POSITIVE_INFINITY : 2 * 1024 * 1024 * 1024
// The biggest one file an import brings: 1 GB in the desktop app, so a single native write stays a
// reasonable size. None of its own on the web, where the total's 2 GB already bounds it.
export const papelizVaultFolderImportMostFileByteCount = isPapelizDesktopApp ? 1024 * 1024 * 1024 : Number.POSITIVE_INFINITY
// Loose files, picked without a folder, come in under this name.
export const papelizImportedFilesVaultFolderName = 'Imported Files'

const papelizImportLeftoverFileNames: ReadonlySet<string> = new Set(['.ds_store', 'thumbs.db', 'desktop.ini'])
const papelizImportLeftoverFolderName = '__MACOSX'
const papelizImportGitFolderName = '.git'
// Papeliz's own folders, as an import's top may hold them (a backup does).
const papelizImportOwnTopFolderNames: ReadonlySet<string> = new Set(
  [papelizVaultSettingsFolderName, papelizVaultChatSessionFolderName, papelizVaultEarlierChatSessionFolderName, papelizVaultTrashFolderName].map((ownTopFolderName) =>
    ownTopFolderName.toLowerCase(),
  ),
)

// A leftover another system adds, in any import (a new vault's too).
export function isPapelizImportLeftover(importFilePathSegments: readonly string[]): boolean {
  const importFileName = importFilePathSegments.at(-1)?.toLowerCase() ?? ''
  return importFilePathSegments.includes(papelizImportLeftoverFolderName) || papelizImportLeftoverFileNames.has(importFileName)
}

// "Field Notes.zip", "P1-Workflow" -> a name a vault folder can have: no character a system refuses, no
// dot or space at either end, 100 characters at most; "Imported Files" when nothing is left.
export function makePapelizImportVaultFolderName(importSourceName: string): string {
  const importVaultFolderName = importSourceName
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+/, '')
    .slice(0, 100)
    .replace(/[\s.]+$/, '')
  return importVaultFolderName.length > 0 ? importVaultFolderName : papelizImportedFilesVaultFolderName
}

// A PNG, JPEG or WebP picture's bytes without its metadata, as they're read.
function stripImportedPictureMetadata(vaultImportFile: PapelizVaultImportFile): PapelizVaultImportFile {
  const pictureFormat = findPapelizTemplatePictureFormatByName(vaultImportFile.importFileRelativePath)
  if (pictureFormat === null || vaultImportFile.isImportFileFolder) return vaultImportFile
  return {
    ...vaultImportFile,
    readImportFileBytes: async () => {
      const pictureBytes = await vaultImportFile.readImportFileBytes()
      try {
        return stripPapelizTemplatePictureMetadata(pictureBytes, pictureFormat)
      } catch {
        return pictureBytes
      }
    },
  }
}

// Leaves out what an open vault never takes, checks the limits, and strips pictures as they're read.
// Fails with "Too Many Files" or "Import Too Large" (too much in all on the web, one file too big in
// the desktop app).
export function planPapelizVaultFolderImport(
  suggestedVaultFolderName: string,
  rawVaultImportFiles: readonly PapelizVaultImportFile[],
  alreadySkippedImportFileCount = 0,
): PapelizVaultFolderImportPlan {
  let skippedImportFileCount = alreadySkippedImportFileCount
  const vaultFolderImportFiles: PapelizVaultImportFile[] = []
  for (const rawVaultImportFile of rawVaultImportFiles) {
    const importFilePathSegments = rawVaultImportFile.importFileRelativePath.split('/')
    const lowerCasePathSegments = importFilePathSegments.map((importFilePathSegment) => importFilePathSegment.toLowerCase())
    const isLeftOut =
      isPapelizImportLeftover(importFilePathSegments) ||
      lowerCasePathSegments.includes(papelizImportGitFolderName) ||
      papelizImportOwnTopFolderNames.has(lowerCasePathSegments[0] ?? '')
    if (isLeftOut) {
      if (!rawVaultImportFile.isImportFileFolder) skippedImportFileCount += 1
      continue
    }
    vaultFolderImportFiles.push(stripImportedPictureMetadata(rawVaultImportFile))
  }
  const importedFiles = vaultFolderImportFiles.filter((vaultFolderImportFile) => !vaultFolderImportFile.isImportFileFolder)
  const importTotalByteCount = importedFiles.reduce((totalByteCount, importedFile) => totalByteCount + importedFile.importFileByteCount, 0)
  if (importedFiles.length > papelizVaultFolderImportMostFileCount) throw new PapelizVaultOperationError('Too Many Files')
  if (importTotalByteCount > papelizVaultFolderImportMostTotalByteCount) throw new PapelizVaultOperationError('Import Too Large')
  if (importedFiles.some((importedFile) => importedFile.importFileByteCount > papelizVaultFolderImportMostFileByteCount)) {
    throw new PapelizVaultOperationError('Import Too Large')
  }
  return {
    suggestedVaultFolderName: makePapelizImportVaultFolderName(suggestedVaultFolderName),
    vaultFolderImportFiles,
    skippedImportFileCount,
    importFileCount: importedFiles.length,
    importTotalByteCount,
  }
}

// Import from Zip: into a folder named after the zip, without ".zip". A zip that holds one folder with
// everything in it brings what's inside that folder. Fails with the zip's problem ("Not A Zip", ...).
export function planPapelizVaultFolderImportFromZip(zipFileName: string, zipFileBytes: Uint8Array): PapelizVaultFolderImportPlan {
  const { importZipEntries, skippedUnsafeZipEntryCount } = readPapelizImportZipFile(zipFileBytes)
  // Leftovers go first, so a `__MACOSX/` beside the top folder doesn't stop it being taken off.
  const keptZipEntries = importZipEntries.filter((importZipEntry) => !isPapelizImportLeftover(importZipEntry.importZipEntryPath.split('/')))
  const skippedLeftoverFileCount = importZipEntries.filter((importZipEntry) => !importZipEntry.isImportZipEntryFolder && !keptZipEntries.includes(importZipEntry)).length
  const topFolderNames = new Set(keptZipEntries.map((keptZipEntry) => keptZipEntry.importZipEntryPath.split('/')[0] ?? ''))
  const isEverythingInOneTopFolder =
    topFolderNames.size === 1 && keptZipEntries.every((keptZipEntry) => keptZipEntry.importZipEntryPath.includes('/') || keptZipEntry.isImportZipEntryFolder)
  const rawVaultImportFiles = keptZipEntries.flatMap((importZipEntry): PapelizVaultImportFile[] => {
    const importFileRelativePath = isEverythingInOneTopFolder ? importZipEntry.importZipEntryPath.split('/').slice(1).join('/') : importZipEntry.importZipEntryPath
    if (importFileRelativePath.length === 0) return []
    return [
      {
        importFileRelativePath,
        isImportFileFolder: importZipEntry.isImportZipEntryFolder,
        importFileByteCount: importZipEntry.importZipEntryByteCount,
        readImportFileBytes: importZipEntry.readImportZipEntryBytes,
      },
    ]
  })
  return planPapelizVaultFolderImport(zipFileName.replace(/\.zip$/i, ''), rawVaultImportFiles, skippedUnsafeZipEntryCount + skippedLeftoverFileCount)
}

// Import from Files: a picked folder (`<input webkitdirectory>`, each path starting with its name)
// comes in under its own name; loose files under "Imported Files".
export function planPapelizVaultFolderImportFromFiles(pickedFiles: readonly File[]): PapelizVaultFolderImportPlan {
  if (pickedFiles.length === 0) throw new PapelizVaultOperationError('Browser Sent No Files')
  const pickedFilePaths = pickedFiles.map((pickedFile) => (pickedFile.webkitRelativePath.length > 0 ? normalizePapelizImportZipEntryPath(pickedFile.webkitRelativePath) : null))
  const pickedFolderNames = new Set(pickedFilePaths.map((pickedFilePath) => (pickedFilePath?.includes('/') === true ? pickedFilePath.split('/')[0] : null)))
  const [pickedFolderName] = [...pickedFolderNames]
  const isOneFolderPicked = pickedFolderNames.size === 1 && typeof pickedFolderName === 'string'
  let skippedImportFileCount = 0
  const rawVaultImportFiles = pickedFiles.flatMap((pickedFile, pickedFileIndex): PapelizVaultImportFile[] => {
    const pickedFilePath = pickedFilePaths[pickedFileIndex] ?? null
    const importFileRelativePath = isOneFolderPicked ? (pickedFilePath ?? '').split('/').slice(1).join('/') : normalizePapelizImportZipEntryPath(pickedFile.name)
    if (importFileRelativePath === null || importFileRelativePath.length === 0) {
      skippedImportFileCount += 1
      return []
    }
    return [{ importFileRelativePath, isImportFileFolder: false, importFileByteCount: pickedFile.size, readImportFileBytes: async () => new Uint8Array(await pickedFile.arrayBuffer()) }]
  })
  return planPapelizVaultFolderImport(isOneFolderPicked ? pickedFolderName : papelizImportedFilesVaultFolderName, rawVaultImportFiles, skippedImportFileCount)
}

// How an import's folders are made and its files written, for each way a vault reaches its folder:
// directory handles in a browser, or paths on disk in Papeliz for Windows
// (papeliz-desktop-folder-vault-adapter.ts). `VaultImportFolder` is what that way holds a folder by.
export interface PapelizVaultImportFolderWriter<VaultImportFolder> {
  // The folder of that name inside the parent, made when it isn't there yet.
  makeVaultImportSubfolder(vaultImportParentFolder: VaultImportFolder, vaultImportSubfolderName: string): Promise<VaultImportFolder>
  // Writes one file whole, under a name already picked free in its folder.
  writeVaultImportFile(vaultImportFolder: VaultImportFolder, vaultImportFileName: string, readImportFileBytes: () => Promise<Uint8Array>): Promise<void>
}

// Writes the files into a folder through the writer, making their folders: the same names, progress
// and stop for every kind of vault folder.
export async function writePapelizVaultImportFilesThroughFolderWriter<VaultImportFolder>(
  importVaultFolder: VaultImportFolder,
  vaultImportFiles: readonly PapelizVaultImportFile[],
  vaultImportOptions: PapelizVaultImportOptions,
  vaultImportFolderWriter: PapelizVaultImportFolderWriter<VaultImportFolder>,
): Promise<void> {
  // Names compare without case, as everywhere in a vault: "a.md" beside "A.md" comes in as "a 2.md".
  const importFoldersByLowerCasePath = new Map<string, VaultImportFolder>([['', importVaultFolder]])
  const takenLowerCaseNamesByFolderPath = new Map<string, Set<string>>()
  const getImportFolder = async (importFolderPathSegments: readonly string[]): Promise<VaultImportFolder> => {
    let importFolder = importVaultFolder
    for (let segmentIndex = 0; segmentIndex < importFolderPathSegments.length; segmentIndex += 1) {
      const lowerCaseFolderPath = importFolderPathSegments.slice(0, segmentIndex + 1).join('/').toLowerCase()
      const knownImportFolder = importFoldersByLowerCasePath.get(lowerCaseFolderPath)
      if (knownImportFolder !== undefined) {
        importFolder = knownImportFolder
        continue
      }
      importFolder = await vaultImportFolderWriter.makeVaultImportSubfolder(importFolder, importFolderPathSegments[segmentIndex] ?? '')
      importFoldersByLowerCasePath.set(lowerCaseFolderPath, importFolder)
    }
    return importFolder
  }

  let importedFileCount = 0
  for (const vaultImportFile of vaultImportFiles) {
    if (vaultImportOptions.browserVaultImportAbortSignal?.aborted === true) throw new PapelizVaultOperationError('Import Stopped')
    const importFilePathSegments = vaultImportFile.importFileRelativePath.split('/')
    if (vaultImportFile.isImportFileFolder) {
      await getImportFolder(importFilePathSegments)
    } else {
      const importFolderPathSegments = importFilePathSegments.slice(0, -1)
      const importFolder = await getImportFolder(importFolderPathSegments)
      const lowerCaseFolderPath = importFolderPathSegments.join('/').toLowerCase()
      const takenLowerCaseNames = takenLowerCaseNamesByFolderPath.get(lowerCaseFolderPath) ?? new Set<string>()
      takenLowerCaseNamesByFolderPath.set(lowerCaseFolderPath, takenLowerCaseNames)
      const importFileName = importFilePathSegments.at(-1) ?? ''
      const dotIndex = importFileName.lastIndexOf('.')
      const freeImportFileName = pickFreeVaultEntryName(
        dotIndex > 0 ? importFileName.slice(0, dotIndex) : importFileName,
        dotIndex > 0 ? importFileName.slice(dotIndex) : '',
        (candidateImportFileName) => takenLowerCaseNames.has(candidateImportFileName.toLowerCase()),
      )
      takenLowerCaseNames.add(freeImportFileName.toLowerCase())
      await vaultImportFolderWriter.writeVaultImportFile(importFolder, freeImportFileName, () => vaultImportFile.readImportFileBytes())
    }
    importedFileCount += 1
    vaultImportOptions.onBrowserVaultImportProgress?.(importedFileCount, vaultImportFiles.length)
  }
}

// Writes the files into a vault's folder, or into a new folder inside one: a browser vault's import, a
// new folder vault from a template (papeliz-template-gallery-vault-maker.ts), or Import from Files, Zip
// or Template.
export async function writePapelizVaultImportFiles(
  importVaultFolderHandle: FileSystemDirectoryHandle,
  vaultImportFiles: readonly PapelizVaultImportFile[],
  vaultImportOptions: PapelizVaultImportOptions,
  vaultFileContentsWriter: PapelizVaultFileContentsWriter,
): Promise<void> {
  await writePapelizVaultImportFilesThroughFolderWriter(importVaultFolderHandle, vaultImportFiles, vaultImportOptions, {
    makeVaultImportSubfolder: (vaultImportParentFolderHandle, vaultImportSubfolderName) => vaultImportParentFolderHandle.getDirectoryHandle(vaultImportSubfolderName, { create: true }),
    writeVaultImportFile: async (vaultImportFolderHandle, vaultImportFileName, readImportFileBytes) => {
      const importedFileHandle = await vaultImportFolderHandle.getFileHandle(vaultImportFileName, { create: true })
      await vaultFileContentsWriter(importedFileHandle, new Blob([(await readImportFileBytes()) as Uint8Array<ArrayBuffer>]))
    },
  })
}

// The new folder's name at the vault's top: the import's own, made a name a vault folder can have, or
// the next free one ("Field Notes 2"), compared without case.
export function pickFreePapelizImportVaultFolderName(suggestedVaultFolderName: string, vaultTopEntryNames: Iterable<string>): string {
  const takenLowerCaseTopNames = new Set<string>()
  for (const vaultTopEntryName of vaultTopEntryNames) takenLowerCaseTopNames.add(vaultTopEntryName.toLowerCase())
  return pickFreeVaultEntryName(makePapelizImportVaultFolderName(suggestedVaultFolderName), '', (candidateFolderName) => takenLowerCaseTopNames.has(candidateFolderName.toLowerCase()))
}

// A new folder at the top of a vault reached through a directory handle, named `suggestedVaultFolderName`
// or the next free name, with the files written into it. Gives back the folder's name.
export async function writePapelizVaultImportFilesIntoNewFolder(
  vaultRootFolderHandle: FileSystemDirectoryHandle,
  suggestedVaultFolderName: string,
  vaultImportFiles: readonly PapelizVaultImportFile[],
  vaultImportOptions: PapelizVaultImportOptions,
  vaultFileContentsWriter: PapelizVaultFileContentsWriter,
): Promise<string> {
  const vaultTopEntryNames: string[] = []
  for await (const vaultTopEntryName of vaultRootFolderHandle.keys()) vaultTopEntryNames.push(vaultTopEntryName)
  const importVaultFolderName = pickFreePapelizImportVaultFolderName(suggestedVaultFolderName, vaultTopEntryNames)
  const importVaultFolderHandle = await vaultRootFolderHandle.getDirectoryHandle(importVaultFolderName, { create: true })
  await writePapelizVaultImportFiles(importVaultFolderHandle, vaultImportFiles, vaultImportOptions, vaultFileContentsWriter)
  return importVaultFolderName
}
