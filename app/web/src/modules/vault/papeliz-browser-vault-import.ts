import { readPapelizImportZipFile } from '../export-zip/papeliz-import-zip-file-reader'
import { runPapelizBrowserVaultChangeExclusively } from './papeliz-browser-vault-locks'
import { readPapelizBrowserStorageEstimate } from './papeliz-browser-vault-storage'
import {
  createPapelizBrowserVault,
  deletePapelizBrowserVault,
  getPapelizBrowserVaultEnvironment,
  getPapelizBrowserVaultFolderHandle,
  type PapelizBrowserVaultEnvironment,
  type PapelizBrowserVaultRecord,
} from './papeliz-browser-vaults'
import { PapelizVaultOperationError } from './papeliz-vault-adapter'
import { papelizBrowserVaultSettingsFileName, papelizVaultSettingsFolderName, pickFreeVaultEntryName } from './papeliz-vault-relative-paths'

// Starting a browser vault from notes people already have: a `.zip` (a Papeliz backup, or any zip of
// notes) or a folder picked with the browser's folder upload. An import always makes a new vault; it
// never changes one that is there. Whatever the source, the files go in as they are, hidden folders
// such as `.papeliz/` and `.trash/` included, so a backup comes back exactly; a `.git/` folder and the
// leftovers other systems add (`__MACOSX/`, `.DS_Store`, `Thumbs.db`, `desktop.ini`) stay out.

export interface PapelizBrowserVaultImportFile {
  // Inside the new vault: "Ideas/Offline first.md".
  importFileRelativePath: string
  isImportFileFolder: boolean
  importFileByteCount: number
  readImportFileBytes: () => Promise<Uint8Array>
}

export interface PapelizBrowserVaultImportPlan {
  suggestedBrowserVaultName: string
  browserVaultImportFiles: PapelizBrowserVaultImportFile[]
  // Left out: leftovers, `.git/`, and paths that would leave the vault.
  skippedImportFileCount: number
  // Files only; empty folders aren't counted.
  importFileCount: number
  importTotalByteCount: number
}

export interface PapelizBrowserVaultImportOptions {
  onBrowserVaultImportProgress?: (importedFileCount: number, importFileCount: number) => void
  browserVaultImportAbortSignal?: AbortSignal
}

const papelizImportLeftoverFileNames = new Set(['.ds_store', 'thumbs.db', 'desktop.ini'])
const papelizImportLeftoverFolderName = '__MACOSX'
const papelizImportGitFolderName = '.git'
// A Papeliz backup's name ends with the time it was made: "Field Notes 2026-10-30 1441".
const papelizBackupFileNameTimePattern = /\s+\d{4}-\d{2}-\d{2}\s+\d{4}$/

function isImportLeftover(importFilePathSegments: readonly string[]): boolean {
  const importFileName = importFilePathSegments.at(-1)?.toLowerCase() ?? ''
  return importFilePathSegments.includes(papelizImportLeftoverFolderName) || papelizImportLeftoverFileNames.has(importFileName)
}

// "Field Notes 2026-10-30 1441.zip" -> "Field Notes".
export function suggestPapelizBrowserVaultNameFromFileName(importSourceFileName: string): string {
  return importSourceFileName.replace(/\.zip$/i, '').replace(papelizBackupFileNameTimePattern, '').trim()
}

async function planBrowserVaultImport(
  rawImportFiles: readonly PapelizBrowserVaultImportFile[],
  fallbackBrowserVaultName: string,
  alreadySkippedImportFileCount: number,
): Promise<PapelizBrowserVaultImportPlan> {
  let skippedImportFileCount = alreadySkippedImportFileCount
  const keptImportFiles = rawImportFiles.filter((rawImportFile) => {
    const isImportFileKept = !isImportLeftover(rawImportFile.importFileRelativePath.split('/'))
    if (!isImportFileKept) skippedImportFileCount += 1
    return isImportFileKept
  })
  // Everything inside one top folder (how a zipped folder looks): that folder goes, and names the vault.
  const topFolderNames = new Set(keptImportFiles.map((keptImportFile) => keptImportFile.importFileRelativePath.split('/')[0] ?? ''))
  const [onlyTopFolderName] = [...topFolderNames]
  const isEverythingInOneTopFolder =
    topFolderNames.size === 1 &&
    onlyTopFolderName !== undefined &&
    keptImportFiles.every((keptImportFile) => keptImportFile.importFileRelativePath.includes('/') || keptImportFile.isImportFileFolder)
  const browserVaultImportFiles: PapelizBrowserVaultImportFile[] = []
  let backupBrowserVaultName: string | null = null
  for (const keptImportFile of keptImportFiles) {
    const importFileRelativePath = isEverythingInOneTopFolder
      ? keptImportFile.importFileRelativePath.split('/').slice(1).join('/')
      : keptImportFile.importFileRelativePath
    if (importFileRelativePath.length === 0) continue
    if (importFileRelativePath.split('/')[0] === papelizImportGitFolderName) {
      skippedImportFileCount += 1
      continue
    }
    // A Papeliz backup names its vault; the new vault writes its own.
    if (importFileRelativePath === `${papelizVaultSettingsFolderName}/${papelizBrowserVaultSettingsFileName}`) {
      try {
        const backupSettingsFile = JSON.parse(new TextDecoder().decode(await keptImportFile.readImportFileBytes())) as { papelizBrowserVaultName?: unknown } | null
        if (typeof backupSettingsFile?.papelizBrowserVaultName === 'string') backupBrowserVaultName = backupSettingsFile.papelizBrowserVaultName
      } catch {
        // A file that doesn't read leaves the name to the folder or the zip.
      }
      continue
    }
    browserVaultImportFiles.push({ ...keptImportFile, importFileRelativePath })
  }
  return {
    suggestedBrowserVaultName: backupBrowserVaultName ?? (isEverythingInOneTopFolder ? onlyTopFolderName : fallbackBrowserVaultName),
    browserVaultImportFiles,
    skippedImportFileCount,
    importFileCount: browserVaultImportFiles.filter((browserVaultImportFile) => !browserVaultImportFile.isImportFileFolder).length,
    importTotalByteCount: browserVaultImportFiles.reduce((importTotalByteCount, browserVaultImportFile) => importTotalByteCount + browserVaultImportFile.importFileByteCount, 0),
  }
}

// What a `.zip` holds, ready to import. Fails with the zip's problem ("Not A Zip", ...).
export async function planPapelizBrowserVaultImportFromZip(zipFileName: string, zipFileBytes: Uint8Array): Promise<PapelizBrowserVaultImportPlan> {
  const { importZipEntries, skippedUnsafeZipEntryCount } = readPapelizImportZipFile(zipFileBytes)
  return planBrowserVaultImport(
    importZipEntries.map((importZipEntry) => ({
      importFileRelativePath: importZipEntry.importZipEntryPath,
      isImportFileFolder: importZipEntry.isImportZipEntryFolder,
      importFileByteCount: importZipEntry.importZipEntryByteCount,
      readImportFileBytes: importZipEntry.readImportZipEntryBytes,
    })),
    suggestPapelizBrowserVaultNameFromFileName(zipFileName),
    skippedUnsafeZipEntryCount,
  )
}

// What a picked folder holds (`<input type="file" webkitdirectory>`): each file's path starts with
// the folder's own name, which names the vault.
export async function planPapelizBrowserVaultImportFromFolder(pickedFolderFiles: readonly File[]): Promise<PapelizBrowserVaultImportPlan> {
  if (pickedFolderFiles.length === 0 || pickedFolderFiles.some((pickedFolderFile) => pickedFolderFile.webkitRelativePath.length === 0)) {
    throw new PapelizVaultOperationError('Browser Sent No Files')
  }
  return planBrowserVaultImport(
    pickedFolderFiles.map((pickedFolderFile) => ({
      importFileRelativePath: pickedFolderFile.webkitRelativePath.replaceAll('\\', '/'),
      isImportFileFolder: false,
      importFileByteCount: pickedFolderFile.size,
      readImportFileBytes: async () => new Uint8Array(await pickedFolderFile.arrayBuffer()),
    })),
    'Imported Vault',
    0,
  )
}

// Makes the new vault and writes every file into it, under its writes lock. A vault that can't be
// finished (stopped, full, a damaged zip) is taken back whole.
export async function importPapelizBrowserVault(
  typedBrowserVaultName: string,
  browserVaultImportPlan: PapelizBrowserVaultImportPlan,
  browserVaultImportOptions: PapelizBrowserVaultImportOptions = {},
  browserVaultEnvironment: PapelizBrowserVaultEnvironment = getPapelizBrowserVaultEnvironment(),
): Promise<PapelizBrowserVaultRecord> {
  const browserStorageEstimate = await readPapelizBrowserStorageEstimate()
  if (
    browserStorageEstimate !== null &&
    browserStorageEstimate.browserStorageQuotaByteCount - browserStorageEstimate.browserStorageUsedByteCount < browserVaultImportPlan.importTotalByteCount
  ) {
    throw new PapelizVaultOperationError('Not Enough Browser Storage')
  }
  const importedBrowserVaultRecord = await createPapelizBrowserVault(typedBrowserVaultName, browserVaultEnvironment)
  try {
    const browserVaultFolderHandle = await getPapelizBrowserVaultFolderHandle(importedBrowserVaultRecord.papelizVaultId, browserVaultEnvironment)
    if (browserVaultFolderHandle === null) throw new PapelizVaultOperationError('Vault Not Found')
    await runPapelizBrowserVaultChangeExclusively(browserVaultEnvironment.browserVaultLockManager, importedBrowserVaultRecord.papelizVaultId, () =>
      writeBrowserVaultImportFiles(browserVaultFolderHandle, browserVaultImportPlan.browserVaultImportFiles, browserVaultImportOptions, browserVaultEnvironment),
    )
    return importedBrowserVaultRecord
  } catch (browserVaultImportError) {
    await deletePapelizBrowserVault(importedBrowserVaultRecord, browserVaultEnvironment)
    throw browserVaultImportError
  }
}

async function writeBrowserVaultImportFiles(
  browserVaultFolderHandle: FileSystemDirectoryHandle,
  browserVaultImportFiles: readonly PapelizBrowserVaultImportFile[],
  browserVaultImportOptions: PapelizBrowserVaultImportOptions,
  browserVaultEnvironment: PapelizBrowserVaultEnvironment,
): Promise<void> {
  // Names compare without case, as everywhere in a vault: "a.md" beside "A.md" comes in as "a 2.md".
  const folderHandlesByLowerCasePath = new Map<string, FileSystemDirectoryHandle>([['', browserVaultFolderHandle]])
  const takenLowerCaseNamesByFolderPath = new Map<string, Set<string>>()
  const getImportFolderHandle = async (importFolderPathSegments: readonly string[]): Promise<FileSystemDirectoryHandle> => {
    let importFolderHandle = browserVaultFolderHandle
    for (let segmentIndex = 0; segmentIndex < importFolderPathSegments.length; segmentIndex += 1) {
      const lowerCaseFolderPath = importFolderPathSegments.slice(0, segmentIndex + 1).join('/').toLowerCase()
      const knownFolderHandle = folderHandlesByLowerCasePath.get(lowerCaseFolderPath)
      if (knownFolderHandle !== undefined) {
        importFolderHandle = knownFolderHandle
        continue
      }
      importFolderHandle = await importFolderHandle.getDirectoryHandle(importFolderPathSegments[segmentIndex] ?? '', { create: true })
      folderHandlesByLowerCasePath.set(lowerCaseFolderPath, importFolderHandle)
    }
    return importFolderHandle
  }

  let importedFileCount = 0
  for (const browserVaultImportFile of browserVaultImportFiles) {
    if (browserVaultImportOptions.browserVaultImportAbortSignal?.aborted === true) throw new PapelizVaultOperationError('Import Stopped')
    const importFilePathSegments = browserVaultImportFile.importFileRelativePath.split('/')
    if (browserVaultImportFile.isImportFileFolder) {
      await getImportFolderHandle(importFilePathSegments)
    } else {
      const importFolderPathSegments = importFilePathSegments.slice(0, -1)
      const importFolderHandle = await getImportFolderHandle(importFolderPathSegments)
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
      const importedFileHandle = await importFolderHandle.getFileHandle(freeImportFileName, { create: true })
      await browserVaultEnvironment.vaultFileContentsWriter(importedFileHandle, new Blob([(await browserVaultImportFile.readImportFileBytes()) as Uint8Array<ArrayBuffer>]))
    }
    importedFileCount += 1
    browserVaultImportOptions.onBrowserVaultImportProgress?.(importedFileCount, browserVaultImportFiles.length)
  }
}
