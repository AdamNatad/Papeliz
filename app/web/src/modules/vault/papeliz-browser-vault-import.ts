import { readPapelizImportZipFile } from '../export-zip/papeliz-import-zip-file-reader'
import { runPapelizBrowserVaultChangeExclusively } from './papeliz-browser-vault-locks'
import { readPapelizBrowserStorageEstimate } from './papeliz-browser-vault-storage'
import {
  createPapelizBrowserVault,
  deletePapelizBrowserVault,
  getPapelizBrowserVaultEnvironment,
  getPapelizBrowserVaultFolderHandle,
  openPapelizBrowserVault,
  type PapelizBrowserVaultEnvironment,
  type PapelizBrowserVaultRecord,
} from './papeliz-browser-vaults'
import { PapelizBrowserVaultAdapter } from './papeliz-browser-vault-adapter'
import type { PapelizOpenVault } from './papeliz-open-vault'
import { PapelizVaultOperationError } from './papeliz-vault-adapter'
import {
  makePapelizEndToEndVault,
  readPapelizUnlockedVaultEncryptionKey,
  wrapPapelizVaultAdapterWithEndToEndEncryption,
  writePapelizVaultImportFilesIntoEndToEndVault,
  type PapelizEndToEndVaultAdapter,
  type PapelizUnlockedVaultEncryptionKey,
  type PapelizVaultPassphraseKeyProgressListener,
} from './papeliz-vault-encryption'
import { isPapelizImportLeftover, writePapelizVaultImportFiles, type PapelizVaultImportFile, type PapelizVaultImportOptions } from './papeliz-vault-folder-import'
import { papelizBrowserVaultSettingsFileName, papelizVaultSettingsFolderName } from './papeliz-vault-relative-paths'

// Starting a browser vault from notes people already have: a `.zip` (a Papeliz backup, or any zip of
// notes) or a folder picked with the browser's folder upload. An import always makes a new vault; it
// never changes one that is there. Whatever the source, the files go in as they are, hidden folders
// such as `.papeliz/` and `.trash/` included, so a backup comes back exactly; a `.git/` folder and the
// leftovers other systems add (`__MACOSX/`, `.DS_Store`, `Thumbs.db`, `desktop.ini`) stay out.

// One file to import, and how far an import has got (papeliz-vault-folder-import.ts).
export type PapelizBrowserVaultImportFile = PapelizVaultImportFile
export type PapelizBrowserVaultImportOptions = PapelizVaultImportOptions

export interface PapelizBrowserVaultImportPlan {
  suggestedBrowserVaultName: string
  browserVaultImportFiles: PapelizBrowserVaultImportFile[]
  // Left out: leftovers, `.git/`, and paths that would leave the vault.
  skippedImportFileCount: number
  // Files only; empty folders aren't counted.
  importFileCount: number
  importTotalByteCount: number
}

const papelizImportGitFolderName = '.git'
// A Papeliz backup's name ends with the time it was made: "Field Notes 2026-10-30 1441".
const papelizBackupFileNameTimePattern = /\s+\d{4}-\d{2}-\d{2}\s+\d{4}$/

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
    const isImportFileKept = !isPapelizImportLeftover(rawImportFile.importFileRelativePath.split('/'))
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
      writePapelizVaultImportFiles(browserVaultFolderHandle, browserVaultImportPlan.browserVaultImportFiles, browserVaultImportOptions, browserVaultEnvironment.vaultFileContentsWriter),
    )
    return importedBrowserVaultRecord
  } catch (browserVaultImportError) {
    await deletePapelizBrowserVault(importedBrowserVaultRecord, browserVaultEnvironment)
    throw browserVaultImportError
  }
}

// The same, when End-to-end is picked for the new vault (papeliz-vault-encryption.ts): the vault is made
// End-to-end before anything comes in, and every file is encrypted as it is written, so nothing plain
// ever lands in it. Like the import above, it is filled before any tab opens it; then it is opened and
// handed back unlocked, as New Vault's End-to-end vault is. A vault that can't be finished (stopped,
// full, a damaged zip, a passphrase too short) is taken back whole; the failure is thrown as a code.
export async function importPapelizEndToEndBrowserVault(
  typedBrowserVaultName: string,
  browserVaultImportPlan: PapelizBrowserVaultImportPlan,
  endToEndVaultImportRequest: { vaultPassphrase: string; onVaultPassphraseKeyProgress?: PapelizVaultPassphraseKeyProgressListener },
  browserVaultImportOptions: PapelizBrowserVaultImportOptions = {},
  browserVaultEnvironment: PapelizBrowserVaultEnvironment = getPapelizBrowserVaultEnvironment(),
): Promise<PapelizOpenVault & { papelizVaultAdapter: PapelizEndToEndVaultAdapter }> {
  const browserStorageEstimate = await readPapelizBrowserStorageEstimate()
  if (
    browserStorageEstimate !== null &&
    browserStorageEstimate.browserStorageQuotaByteCount - browserStorageEstimate.browserStorageUsedByteCount < browserVaultImportPlan.importTotalByteCount
  ) {
    throw new PapelizVaultOperationError('Not Enough Browser Storage')
  }
  const importedBrowserVaultRecord = await createPapelizBrowserVault(typedBrowserVaultName, browserVaultEnvironment)
  const { papelizVaultId } = importedBrowserVaultRecord
  let unlockedVaultEncryptionKey: PapelizUnlockedVaultEncryptionKey
  try {
    const browserVaultFolderHandle = await getPapelizBrowserVaultFolderHandle(papelizVaultId, browserVaultEnvironment)
    if (browserVaultFolderHandle === null) throw new PapelizVaultOperationError('Vault Not Found')
    // The vault's own adapter for the import alone, holding no open lock.
    const importingBrowserVaultAdapter = new PapelizBrowserVaultAdapter(browserVaultFolderHandle, {
      papelizVaultId,
      browserVaultLockManager: browserVaultEnvironment.browserVaultLockManager,
      onBrowserVaultChanged: () => undefined,
      releaseBrowserVaultOpenLock: () => undefined,
      vaultFileContentsWriter: browserVaultEnvironment.vaultFileContentsWriter,
    })
    const endToEndVaultMakeResult = await makePapelizEndToEndVault({
      newVaultOpenVault: { papelizVaultId, papelizVaultDisplayName: importedBrowserVaultRecord.papelizVaultDisplayName, papelizVaultAdapter: importingBrowserVaultAdapter },
      ...endToEndVaultImportRequest,
    })
    if (endToEndVaultMakeResult.endToEndVaultUnlockOutcome !== 'unlocked') {
      throw new PapelizVaultOperationError(endToEndVaultMakeResult.endToEndVaultUnlockOutcome === 'failed' ? endToEndVaultMakeResult.vaultEncryptionFailureCode : 'Unknown Error')
    }
    const importingEndToEndVaultAdapter = endToEndVaultMakeResult.papelizOpenVault.papelizVaultAdapter
    await runPapelizBrowserVaultChangeExclusively(browserVaultEnvironment.browserVaultLockManager, papelizVaultId, () =>
      writePapelizVaultImportFilesIntoEndToEndVault(importingEndToEndVaultAdapter, browserVaultImportPlan.browserVaultImportFiles, browserVaultImportOptions),
    )
    unlockedVaultEncryptionKey = readPapelizUnlockedVaultEncryptionKey(importingEndToEndVaultAdapter)
  } catch (browserVaultImportError) {
    await deletePapelizBrowserVault(importedBrowserVaultRecord, browserVaultEnvironment)
    throw browserVaultImportError
  }
  const browserVaultOpenResult = await openPapelizBrowserVault(importedBrowserVaultRecord, browserVaultEnvironment)
  if (browserVaultOpenResult.openVaultOutcome !== 'opened') throw new PapelizVaultOperationError('Vault Not Found')
  const { papelizOpenVault } = browserVaultOpenResult
  return { ...papelizOpenVault, papelizVaultAdapter: await wrapPapelizVaultAdapterWithEndToEndEncryption(papelizOpenVault.papelizVaultAdapter, unlockedVaultEncryptionKey) }
}
