import { writePapelizExportZipFile, type PapelizExportZipEntry } from '../export-zip/papeliz-export-zip-file-writer'
import { runPapelizBrowserVaultChangeExclusively } from './papeliz-browser-vault-locks'
import {
  getPapelizBrowserVaultEnvironment,
  getPapelizBrowserVaultFolderHandle,
  updatePapelizBrowserVaultRecord,
  type PapelizBrowserVaultEnvironment,
  type PapelizBrowserVaultRecord,
} from './papeliz-browser-vaults'
import { PapelizVaultOperationError } from './papeliz-vault-adapter'

// Download backup: the whole browser vault as one `.zip`, every file in it (hidden ones too, so
// `.papeliz/` and `.trash/` come back) inside one folder named after the vault. Unzipped, it opens as
// a folder vault; zipped, it imports back as a browser vault anywhere.

function padPapelizBackupTimePart(backupTimePart: number): string {
  return String(backupTimePart).padStart(2, '0')
}

// "Field Notes 2026-10-30 1441.zip", in local time. A vault's name already works as a file name.
export function buildPapelizBrowserVaultBackupFileName(papelizVaultDisplayName: string, browserVaultBackupDate: Date): string {
  const backupDateText = `${browserVaultBackupDate.getFullYear()}-${padPapelizBackupTimePart(browserVaultBackupDate.getMonth() + 1)}-${padPapelizBackupTimePart(browserVaultBackupDate.getDate())}`
  const backupTimeText = `${padPapelizBackupTimePart(browserVaultBackupDate.getHours())}${padPapelizBackupTimePart(browserVaultBackupDate.getMinutes())}`
  return `${papelizVaultDisplayName} ${backupDateText} ${backupTimeText}.zip`
}

// Every file and every empty folder in the vault's folder, under `<vault name>/`.
export async function collectPapelizBrowserVaultBackupZipEntries(browserVaultFolderHandle: FileSystemDirectoryHandle, papelizVaultDisplayName: string): Promise<PapelizExportZipEntry[]> {
  const backupZipEntries: PapelizExportZipEntry[] = []
  const collectBackupFolder = async (backupFolderHandle: FileSystemDirectoryHandle, backupFolderZipPath: string) => {
    let isBackupFolderEmpty = true
    for await (const [backupEntryName, backupEntryHandle] of backupFolderHandle.entries()) {
      isBackupFolderEmpty = false
      const backupEntryZipPath = `${backupFolderZipPath}/${backupEntryName}`
      if (backupEntryHandle.kind === 'directory') await collectBackupFolder(backupEntryHandle as FileSystemDirectoryHandle, backupEntryZipPath)
      else backupZipEntries.push({ zipEntryPath: backupEntryZipPath, zipEntryBytes: new Uint8Array(await (await (backupEntryHandle as FileSystemFileHandle).getFile()).arrayBuffer()) })
    }
    if (isBackupFolderEmpty) backupZipEntries.push({ zipEntryPath: `${backupFolderZipPath}/`, zipEntryBytes: new Uint8Array(0) })
  }
  await collectBackupFolder(browserVaultFolderHandle, papelizVaultDisplayName)
  return backupZipEntries
}

// The backup's `.zip`, read under the vault's writes lock so it never catches a move half done.
export async function createPapelizBrowserVaultBackupZipBlob(
  browserVaultRecord: PapelizBrowserVaultRecord,
  browserVaultBackupDate: Date,
  browserVaultEnvironment: PapelizBrowserVaultEnvironment = getPapelizBrowserVaultEnvironment(),
): Promise<Blob> {
  const browserVaultFolderHandle = await getPapelizBrowserVaultFolderHandle(browserVaultRecord.papelizVaultId, browserVaultEnvironment)
  if (browserVaultFolderHandle === null) throw new PapelizVaultOperationError('Vault Not Found')
  const backupZipEntries = await runPapelizBrowserVaultChangeExclusively(browserVaultEnvironment.browserVaultLockManager, browserVaultRecord.papelizVaultId, () =>
    collectPapelizBrowserVaultBackupZipEntries(browserVaultFolderHandle, browserVaultRecord.papelizVaultDisplayName),
  )
  return writePapelizExportZipFile(backupZipEntries, { zipEntryModifiedDate: browserVaultBackupDate })
}

// A backup was handed to the browser: nothing has changed since, and the reminder starts over.
export function notePapelizBrowserVaultBackedUp(
  papelizVaultId: string,
  browserVaultEnvironment: PapelizBrowserVaultEnvironment = getPapelizBrowserVaultEnvironment(),
): Promise<PapelizBrowserVaultRecord | null> {
  return updatePapelizBrowserVaultRecord(
    papelizVaultId,
    {
      papelizBrowserVaultLastBackupAt: browserVaultEnvironment.readCurrentTime(),
      papelizBrowserVaultFirstChangeSinceBackupAt: null,
      papelizBrowserVaultBackupReminderShownAt: null,
    },
    browserVaultEnvironment,
  )
}
