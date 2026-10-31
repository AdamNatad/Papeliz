import {
  deletePapelizBrowserDatabaseRecord,
  papelizBrowserVaultsStoreName,
  putPapelizBrowserDatabaseRecord,
  readAllPapelizBrowserDatabaseRecords,
  readPapelizBrowserDatabaseRecord,
} from '../browser-database/papeliz-browser-database'
import { PapelizBrowserVaultAdapter } from './papeliz-browser-vault-adapter'
import { createPapelizBrowserVaultFileContentsWriter } from './papeliz-browser-vault-file-writer'
import { announcePapelizBrowserVaultListChange } from './papeliz-browser-vault-list-channel'
import {
  getPapelizBrowserLockManager,
  holdPapelizBrowserVaultOpenLock,
  isPapelizBrowserVaultOpenInSomeTab,
  runPapelizBrowserVaultChangeExclusively,
  type PapelizBrowserVaultLockManager,
} from './papeliz-browser-vault-locks'
import type { PapelizVaultFileContentsWriter } from './papeliz-directory-handle-vault-adapter'
import type { PapelizOpenVaultResult } from './papeliz-open-vault'
import { describePapelizVaultError, PapelizVaultOperationError } from './papeliz-vault-adapter'
import { describeVaultEntryNameProblem, papelizBrowserVaultSettingsFileName, papelizVaultSettingsFolderName, pickFreeVaultEntryName } from './papeliz-vault-relative-paths'

// The browser vaults kept in this browser. Each one is a folder in the Origin Private File System,
// `papeliz-browser-vaults/<papelizVaultId>/`, laid out exactly like a folder on disk. The folder is
// named by the id, never the vault's name, so a rename only changes the list. The list is a row per
// vault in IndexedDB (`papelizBrowserVaults`); the name is also kept in the vault's own
// `.papeliz/browser-vault.json`, so a vault whose row went missing is listed again, and a backup
// carries its name.

export const papelizBrowserVaultsFolderName = 'papeliz-browser-vaults'
export const papelizBrowserVaultNameLongestLength = 80
// What a vault rebuilt from a folder with no name is called.
const papelizBrowserVaultFallbackName = 'Browser Vault'

export const papelizBrowserVaultBackupReminderIntervalChoices = [10, 30, 60] as const
export type PapelizBrowserVaultBackupReminderIntervalMinutes = (typeof papelizBrowserVaultBackupReminderIntervalChoices)[number]
export const papelizBrowserVaultDefaultBackupReminderIntervalMinutes: PapelizBrowserVaultBackupReminderIntervalMinutes = 30

export interface PapelizBrowserVaultRecord {
  papelizVaultId: string
  papelizVaultDisplayName: string
  papelizBrowserVaultCreatedAt: number
  papelizVaultLastOpenedAt: number
  // When it was hidden from Recent vaults into the Hidden list; null while it is on Recent vaults.
  papelizVaultHiddenAt: number | null
  // The last Download backup; null before the first.
  papelizBrowserVaultLastBackupAt: number | null
  // The first change written after the last backup; null while nothing changed since.
  papelizBrowserVaultFirstChangeSinceBackupAt: number | null
  papelizBrowserVaultBackupReminderOn: boolean
  papelizBrowserVaultBackupReminderIntervalMinutes: PapelizBrowserVaultBackupReminderIntervalMinutes
  // When the reminder last showed (or Later was chosen), in any tab; null if never.
  papelizBrowserVaultBackupReminderShownAt: number | null
}

// What `.papeliz/browser-vault.json` holds.
interface PapelizBrowserVaultSettingsFile {
  papelizBrowserVaultName: string
  papelizBrowserVaultCreatedAt: number
}

// Where the list of browser vaults is kept: IndexedDB in the browser, a map in the tests.
export interface PapelizBrowserVaultRecordStore {
  readAllBrowserVaultRecords(): Promise<PapelizBrowserVaultRecord[]>
  readBrowserVaultRecord(papelizVaultId: string): Promise<PapelizBrowserVaultRecord | undefined>
  putBrowserVaultRecord(browserVaultRecord: PapelizBrowserVaultRecord): Promise<void>
  deleteBrowserVaultRecord(papelizVaultId: string): Promise<void>
}

// Everything the browser vaults reach outside themselves, so the tests can give their own.
export interface PapelizBrowserVaultEnvironment {
  browserVaultRecordStore: PapelizBrowserVaultRecordStore
  getOriginPrivateFileSystemRoot: () => Promise<FileSystemDirectoryHandle>
  browserVaultLockManager: PapelizBrowserVaultLockManager | null
  vaultFileContentsWriter: PapelizVaultFileContentsWriter
  createPapelizVaultId: () => string
  readCurrentTime: () => number
}

const papelizIndexedDatabaseBrowserVaultRecordStore: PapelizBrowserVaultRecordStore = {
  readAllBrowserVaultRecords: () => readAllPapelizBrowserDatabaseRecords<PapelizBrowserVaultRecord>(papelizBrowserVaultsStoreName),
  readBrowserVaultRecord: (papelizVaultId) => readPapelizBrowserDatabaseRecord<PapelizBrowserVaultRecord>(papelizBrowserVaultsStoreName, papelizVaultId),
  putBrowserVaultRecord: (browserVaultRecord) => putPapelizBrowserDatabaseRecord(papelizBrowserVaultsStoreName, browserVaultRecord),
  deleteBrowserVaultRecord: (papelizVaultId) => deletePapelizBrowserDatabaseRecord(papelizBrowserVaultsStoreName, papelizVaultId),
}

let papelizDefaultBrowserVaultEnvironment: PapelizBrowserVaultEnvironment | null = null

export function getPapelizBrowserVaultEnvironment(): PapelizBrowserVaultEnvironment {
  papelizDefaultBrowserVaultEnvironment ??= {
    browserVaultRecordStore: papelizIndexedDatabaseBrowserVaultRecordStore,
    getOriginPrivateFileSystemRoot: () => navigator.storage.getDirectory(),
    browserVaultLockManager: getPapelizBrowserLockManager(),
    vaultFileContentsWriter: createPapelizBrowserVaultFileContentsWriter(),
    createPapelizVaultId: () => crypto.randomUUID(),
    readCurrentTime: () => Date.now(),
  }
  return papelizDefaultBrowserVaultEnvironment
}

function isBrowserVaultBackupReminderIntervalMinutes(intervalMinutes: unknown): intervalMinutes is PapelizBrowserVaultBackupReminderIntervalMinutes {
  return papelizBrowserVaultBackupReminderIntervalChoices.some((intervalChoice) => intervalChoice === intervalMinutes)
}

// Fills in what a row saved by an earlier Papeliz may lack.
function completeBrowserVaultRecord(storedBrowserVaultRecord: PapelizBrowserVaultRecord): PapelizBrowserVaultRecord {
  return {
    ...storedBrowserVaultRecord,
    papelizVaultHiddenAt: storedBrowserVaultRecord.papelizVaultHiddenAt ?? null,
    papelizBrowserVaultLastBackupAt: storedBrowserVaultRecord.papelizBrowserVaultLastBackupAt ?? null,
    papelizBrowserVaultFirstChangeSinceBackupAt: storedBrowserVaultRecord.papelizBrowserVaultFirstChangeSinceBackupAt ?? null,
    papelizBrowserVaultBackupReminderOn: storedBrowserVaultRecord.papelizBrowserVaultBackupReminderOn !== false,
    papelizBrowserVaultBackupReminderIntervalMinutes: isBrowserVaultBackupReminderIntervalMinutes(storedBrowserVaultRecord.papelizBrowserVaultBackupReminderIntervalMinutes)
      ? storedBrowserVaultRecord.papelizBrowserVaultBackupReminderIntervalMinutes
      : papelizBrowserVaultDefaultBackupReminderIntervalMinutes,
    papelizBrowserVaultBackupReminderShownAt: storedBrowserVaultRecord.papelizBrowserVaultBackupReminderShownAt ?? null,
  }
}

function createBrowserVaultRecord(papelizVaultId: string, papelizVaultDisplayName: string, papelizBrowserVaultCreatedAt: number): PapelizBrowserVaultRecord {
  return {
    papelizVaultId,
    papelizVaultDisplayName,
    papelizBrowserVaultCreatedAt,
    papelizVaultLastOpenedAt: papelizBrowserVaultCreatedAt,
    papelizVaultHiddenAt: null,
    papelizBrowserVaultLastBackupAt: null,
    papelizBrowserVaultFirstChangeSinceBackupAt: null,
    papelizBrowserVaultBackupReminderOn: true,
    papelizBrowserVaultBackupReminderIntervalMinutes: papelizBrowserVaultDefaultBackupReminderIntervalMinutes,
    papelizBrowserVaultBackupReminderShownAt: null,
  }
}

async function getBrowserVaultsFolderHandle(browserVaultEnvironment: PapelizBrowserVaultEnvironment, shouldCreateFolder: boolean): Promise<FileSystemDirectoryHandle | null> {
  const originPrivateFileSystemRoot = await browserVaultEnvironment.getOriginPrivateFileSystemRoot()
  try {
    return await originPrivateFileSystemRoot.getDirectoryHandle(papelizBrowserVaultsFolderName, { create: shouldCreateFolder })
  } catch (browserVaultsFolderError) {
    if ((browserVaultsFolderError as { name?: unknown } | null)?.name === 'NotFoundError') return null
    throw browserVaultsFolderError
  }
}

// The vault's own folder, or null when it is gone.
export async function getPapelizBrowserVaultFolderHandle(
  papelizVaultId: string,
  browserVaultEnvironment: PapelizBrowserVaultEnvironment = getPapelizBrowserVaultEnvironment(),
): Promise<FileSystemDirectoryHandle | null> {
  const browserVaultsFolderHandle = await getBrowserVaultsFolderHandle(browserVaultEnvironment, false)
  if (browserVaultsFolderHandle === null) return null
  try {
    return await browserVaultsFolderHandle.getDirectoryHandle(papelizVaultId)
  } catch (browserVaultFolderError) {
    const browserVaultFolderErrorName = (browserVaultFolderError as { name?: unknown } | null)?.name
    if (browserVaultFolderErrorName === 'NotFoundError' || browserVaultFolderErrorName === 'TypeMismatchError') return null
    throw browserVaultFolderError
  }
}

async function writeBrowserVaultSettingsFile(
  browserVaultFolderHandle: FileSystemDirectoryHandle,
  browserVaultSettingsFile: PapelizBrowserVaultSettingsFile,
  browserVaultEnvironment: PapelizBrowserVaultEnvironment,
): Promise<void> {
  const vaultSettingsFolderHandle = await browserVaultFolderHandle.getDirectoryHandle(papelizVaultSettingsFolderName, { create: true })
  const browserVaultSettingsFileHandle = await vaultSettingsFolderHandle.getFileHandle(papelizBrowserVaultSettingsFileName, { create: true })
  await browserVaultEnvironment.vaultFileContentsWriter(browserVaultSettingsFileHandle, `${JSON.stringify(browserVaultSettingsFile, null, 2)}\n`)
}

// What a vault's `.papeliz/browser-vault.json` holds (its name), or null when it has none.
export async function readPapelizBrowserVaultSettingsFile(browserVaultFolderHandle: FileSystemDirectoryHandle): Promise<PapelizBrowserVaultSettingsFile | null> {
  try {
    const vaultSettingsFolderHandle = await browserVaultFolderHandle.getDirectoryHandle(papelizVaultSettingsFolderName)
    const browserVaultSettingsFileHandle = await vaultSettingsFolderHandle.getFileHandle(papelizBrowserVaultSettingsFileName)
    const parsedBrowserVaultSettingsFile = JSON.parse(await (await browserVaultSettingsFileHandle.getFile()).text()) as Partial<PapelizBrowserVaultSettingsFile> | null
    if (typeof parsedBrowserVaultSettingsFile?.papelizBrowserVaultName !== 'string') return null
    return {
      papelizBrowserVaultName: parsedBrowserVaultSettingsFile.papelizBrowserVaultName,
      papelizBrowserVaultCreatedAt:
        typeof parsedBrowserVaultSettingsFile.papelizBrowserVaultCreatedAt === 'number' ? parsedBrowserVaultSettingsFile.papelizBrowserVaultCreatedAt : 0,
    }
  } catch {
    return null
  }
}

// Every browser vault, most recently opened first. A row whose folder is gone leaves the list; a
// folder with no row is listed again from its `.papeliz/browser-vault.json`.
export async function listPapelizBrowserVaults(
  browserVaultEnvironment: PapelizBrowserVaultEnvironment = getPapelizBrowserVaultEnvironment(),
): Promise<PapelizBrowserVaultRecord[]> {
  const { browserVaultRecordStore } = browserVaultEnvironment
  const storedBrowserVaultRecords = (await browserVaultRecordStore.readAllBrowserVaultRecords()).map(completeBrowserVaultRecord)
  const browserVaultsFolderHandle = await getBrowserVaultsFolderHandle(browserVaultEnvironment, false)
  const browserVaultFolderHandlesById = new Map<string, FileSystemDirectoryHandle>()
  if (browserVaultsFolderHandle !== null) {
    for await (const [browserVaultFolderName, browserVaultFolderHandle] of browserVaultsFolderHandle.entries()) {
      if (browserVaultFolderHandle.kind === 'directory') browserVaultFolderHandlesById.set(browserVaultFolderName, browserVaultFolderHandle as FileSystemDirectoryHandle)
    }
  }
  const listedBrowserVaultRecords: PapelizBrowserVaultRecord[] = []
  for (const storedBrowserVaultRecord of storedBrowserVaultRecords) {
    if (browserVaultFolderHandlesById.delete(storedBrowserVaultRecord.papelizVaultId)) listedBrowserVaultRecords.push(storedBrowserVaultRecord)
    else await browserVaultRecordStore.deleteBrowserVaultRecord(storedBrowserVaultRecord.papelizVaultId).catch(() => undefined)
  }
  for (const [papelizVaultId, browserVaultFolderHandle] of browserVaultFolderHandlesById) {
    const browserVaultSettingsFile = await readPapelizBrowserVaultSettingsFile(browserVaultFolderHandle)
    const rebuiltBrowserVaultRecord = createBrowserVaultRecord(
      papelizVaultId,
      pickFreePapelizBrowserVaultName(browserVaultSettingsFile?.papelizBrowserVaultName ?? papelizBrowserVaultFallbackName, listedBrowserVaultRecords),
      browserVaultSettingsFile?.papelizBrowserVaultCreatedAt ?? 0,
    )
    await browserVaultRecordStore.putBrowserVaultRecord(rebuiltBrowserVaultRecord).catch(() => undefined)
    listedBrowserVaultRecords.push(rebuiltBrowserVaultRecord)
  }
  return listedBrowserVaultRecords.sort((firstBrowserVault, secondBrowserVault) => secondBrowserVault.papelizVaultLastOpenedAt - firstBrowserVault.papelizVaultLastOpenedAt)
}

export async function readPapelizBrowserVaultRecord(
  papelizVaultId: string,
  browserVaultEnvironment: PapelizBrowserVaultEnvironment = getPapelizBrowserVaultEnvironment(),
): Promise<PapelizBrowserVaultRecord | null> {
  const storedBrowserVaultRecord = await browserVaultEnvironment.browserVaultRecordStore.readBrowserVaultRecord(papelizVaultId)
  return storedBrowserVaultRecord === undefined ? null : completeBrowserVaultRecord(storedBrowserVaultRecord)
}

// What is wrong with a name for a browser vault, or null. Names are unique among browser vaults,
// compared without case, and must work as a folder's name (a backup unzips into one).
export function findPapelizBrowserVaultNameProblem(
  typedBrowserVaultName: string,
  browserVaultRecords: readonly PapelizBrowserVaultRecord[],
  renamedPapelizVaultId: string | null = null,
): string | null {
  const trimmedBrowserVaultName = typedBrowserVaultName.trim()
  const browserVaultNameProblem = describeVaultEntryNameProblem(trimmedBrowserVaultName)
  if (browserVaultNameProblem !== null) return browserVaultNameProblem
  if (trimmedBrowserVaultName.length > papelizBrowserVaultNameLongestLength) return 'Name Too Long'
  const lowerCaseBrowserVaultName = trimmedBrowserVaultName.toLowerCase()
  const isBrowserVaultNameTaken = browserVaultRecords.some(
    (browserVaultRecord) =>
      browserVaultRecord.papelizVaultId !== renamedPapelizVaultId && browserVaultRecord.papelizVaultDisplayName.toLowerCase() === lowerCaseBrowserVaultName,
  )
  return isBrowserVaultNameTaken ? 'Name Taken' : null
}

// "Field Notes", then "Field Notes 2", "Field Notes 3", ... until no browser vault has it.
export function pickFreePapelizBrowserVaultName(preferredBrowserVaultName: string, browserVaultRecords: readonly PapelizBrowserVaultRecord[]): string {
  const takenLowerCaseBrowserVaultNames = new Set(browserVaultRecords.map((browserVaultRecord) => browserVaultRecord.papelizVaultDisplayName.toLowerCase()))
  const trimmedPreferredBrowserVaultName = preferredBrowserVaultName.trim().slice(0, papelizBrowserVaultNameLongestLength - 4).trim()
  return pickFreeVaultEntryName(trimmedPreferredBrowserVaultName.length > 0 ? trimmedPreferredBrowserVaultName : papelizBrowserVaultFallbackName, '', (candidateBrowserVaultName) =>
    takenLowerCaseBrowserVaultNames.has(candidateBrowserVaultName.toLowerCase()),
  )
}

// Makes an empty browser vault. Fails with the name's problem ("Name Taken", ...).
export async function createPapelizBrowserVault(
  typedBrowserVaultName: string,
  browserVaultEnvironment: PapelizBrowserVaultEnvironment = getPapelizBrowserVaultEnvironment(),
): Promise<PapelizBrowserVaultRecord> {
  const browserVaultRecords = await listPapelizBrowserVaults(browserVaultEnvironment)
  const browserVaultNameProblem = findPapelizBrowserVaultNameProblem(typedBrowserVaultName, browserVaultRecords)
  if (browserVaultNameProblem !== null) throw new PapelizVaultOperationError(browserVaultNameProblem)
  const papelizBrowserVaultName = typedBrowserVaultName.trim()
  const papelizVaultId = browserVaultEnvironment.createPapelizVaultId()
  const papelizBrowserVaultCreatedAt = browserVaultEnvironment.readCurrentTime()
  const browserVaultsFolderHandle = await getBrowserVaultsFolderHandle(browserVaultEnvironment, true)
  if (browserVaultsFolderHandle === null) throw new PapelizVaultOperationError('Storage Off')
  const browserVaultFolderHandle = await browserVaultsFolderHandle.getDirectoryHandle(papelizVaultId, { create: true })
  await writeBrowserVaultSettingsFile(browserVaultFolderHandle, { papelizBrowserVaultName, papelizBrowserVaultCreatedAt }, browserVaultEnvironment)
  const createdBrowserVaultRecord = createBrowserVaultRecord(papelizVaultId, papelizBrowserVaultName, papelizBrowserVaultCreatedAt)
  await browserVaultEnvironment.browserVaultRecordStore.putBrowserVaultRecord(createdBrowserVaultRecord)
  announcePapelizBrowserVaultListChange()
  return createdBrowserVaultRecord
}

// Changes the name Papeliz shows; the folder keeps its id. Refused while the vault is open in a tab.
export async function renamePapelizBrowserVault(
  papelizVaultId: string,
  typedBrowserVaultName: string,
  browserVaultEnvironment: PapelizBrowserVaultEnvironment = getPapelizBrowserVaultEnvironment(),
): Promise<PapelizBrowserVaultRecord> {
  if (await isPapelizBrowserVaultOpenInSomeTab(browserVaultEnvironment.browserVaultLockManager, papelizVaultId)) {
    throw new PapelizVaultOperationError('Open In Another Tab')
  }
  const browserVaultRecords = await listPapelizBrowserVaults(browserVaultEnvironment)
  const renamedBrowserVaultRecord = browserVaultRecords.find((browserVaultRecord) => browserVaultRecord.papelizVaultId === papelizVaultId)
  const browserVaultFolderHandle = await getPapelizBrowserVaultFolderHandle(papelizVaultId, browserVaultEnvironment)
  if (renamedBrowserVaultRecord === undefined || browserVaultFolderHandle === null) throw new PapelizVaultOperationError('Vault Not Found')
  const browserVaultNameProblem = findPapelizBrowserVaultNameProblem(typedBrowserVaultName, browserVaultRecords, papelizVaultId)
  if (browserVaultNameProblem !== null) throw new PapelizVaultOperationError(browserVaultNameProblem)
  const updatedBrowserVaultRecord: PapelizBrowserVaultRecord = { ...renamedBrowserVaultRecord, papelizVaultDisplayName: typedBrowserVaultName.trim() }
  await runPapelizBrowserVaultChangeExclusively(browserVaultEnvironment.browserVaultLockManager, papelizVaultId, () =>
    writeBrowserVaultSettingsFile(
      browserVaultFolderHandle,
      { papelizBrowserVaultName: updatedBrowserVaultRecord.papelizVaultDisplayName, papelizBrowserVaultCreatedAt: updatedBrowserVaultRecord.papelizBrowserVaultCreatedAt },
      browserVaultEnvironment,
    ),
  )
  await browserVaultEnvironment.browserVaultRecordStore.putBrowserVaultRecord(updatedBrowserVaultRecord)
  announcePapelizBrowserVaultListChange()
  return updatedBrowserVaultRecord
}

// Hides a vault from Recent vaults into the Hidden list, or restores it. Only the list changes.
export async function setPapelizBrowserVaultHidden(
  browserVaultRecord: PapelizBrowserVaultRecord,
  isBrowserVaultHidden: boolean,
  browserVaultEnvironment: PapelizBrowserVaultEnvironment = getPapelizBrowserVaultEnvironment(),
): Promise<void> {
  const storedBrowserVaultRecord = (await readPapelizBrowserVaultRecord(browserVaultRecord.papelizVaultId, browserVaultEnvironment)) ?? browserVaultRecord
  await browserVaultEnvironment.browserVaultRecordStore.putBrowserVaultRecord({
    ...storedBrowserVaultRecord,
    papelizVaultHiddenAt: isBrowserVaultHidden ? browserVaultEnvironment.readCurrentTime() : null,
  })
  announcePapelizBrowserVaultListChange()
}

export type PapelizBrowserVaultDeleteResult =
  | { browserVaultDeleteOutcome: 'deleted' }
  | { browserVaultDeleteOutcome: 'failed'; browserVaultDeleteFailureMessage: string }

// Delete in the start screen's Hidden list: erases the vault, with every note and file in it, from
// this browser, then takes it off the list. Refused while the vault is open in a tab.
export async function deletePapelizBrowserVault(
  browserVaultRecord: PapelizBrowserVaultRecord,
  browserVaultEnvironment: PapelizBrowserVaultEnvironment = getPapelizBrowserVaultEnvironment(),
): Promise<PapelizBrowserVaultDeleteResult> {
  const { papelizVaultId, papelizVaultDisplayName } = browserVaultRecord
  const describeDeleteFailure = (browserVaultDeleteReason: string): PapelizBrowserVaultDeleteResult => ({
    browserVaultDeleteOutcome: 'failed',
    browserVaultDeleteFailureMessage: `Couldn’t delete “${papelizVaultDisplayName}” (${browserVaultDeleteReason})`,
  })
  try {
    if (await isPapelizBrowserVaultOpenInSomeTab(browserVaultEnvironment.browserVaultLockManager, papelizVaultId)) return describeDeleteFailure('Open In Another Tab')
    await runPapelizBrowserVaultChangeExclusively(browserVaultEnvironment.browserVaultLockManager, papelizVaultId, async () => {
      const browserVaultsFolderHandle = await getBrowserVaultsFolderHandle(browserVaultEnvironment, false)
      // A folder that is already gone only needs to leave the list.
      await browserVaultsFolderHandle?.removeEntry(papelizVaultId, { recursive: true }).catch((browserVaultRemoveError: unknown) => {
        if ((browserVaultRemoveError as { name?: unknown } | null)?.name !== 'NotFoundError') throw browserVaultRemoveError
      })
    })
    await browserVaultEnvironment.browserVaultRecordStore.deleteBrowserVaultRecord(papelizVaultId)
  } catch (browserVaultDeleteError) {
    return describeDeleteFailure(describePapelizVaultError(browserVaultDeleteError))
  }
  announcePapelizBrowserVaultListChange()
  return { browserVaultDeleteOutcome: 'deleted' }
}

// Notes the first change after the last backup, so the backup reminder knows it is due. Later
// changes leave the time as it is.
export async function notePapelizBrowserVaultChangedSinceBackup(
  papelizVaultId: string,
  browserVaultEnvironment: PapelizBrowserVaultEnvironment = getPapelizBrowserVaultEnvironment(),
): Promise<void> {
  const browserVaultRecord = await readPapelizBrowserVaultRecord(papelizVaultId, browserVaultEnvironment)
  if (browserVaultRecord === null || browserVaultRecord.papelizBrowserVaultFirstChangeSinceBackupAt !== null) return
  await browserVaultEnvironment.browserVaultRecordStore.putBrowserVaultRecord({
    ...browserVaultRecord,
    papelizBrowserVaultFirstChangeSinceBackupAt: browserVaultEnvironment.readCurrentTime(),
  })
}

// Changes one or more of a vault's own fields (the backup reminder's) and gives back the new row.
export async function updatePapelizBrowserVaultRecord(
  papelizVaultId: string,
  browserVaultRecordChanges: Partial<
    Pick<
      PapelizBrowserVaultRecord,
      | 'papelizBrowserVaultLastBackupAt'
      | 'papelizBrowserVaultFirstChangeSinceBackupAt'
      | 'papelizBrowserVaultBackupReminderOn'
      | 'papelizBrowserVaultBackupReminderIntervalMinutes'
      | 'papelizBrowserVaultBackupReminderShownAt'
    >
  >,
  browserVaultEnvironment: PapelizBrowserVaultEnvironment = getPapelizBrowserVaultEnvironment(),
): Promise<PapelizBrowserVaultRecord | null> {
  const browserVaultRecord = await readPapelizBrowserVaultRecord(papelizVaultId, browserVaultEnvironment)
  if (browserVaultRecord === null) return null
  const updatedBrowserVaultRecord = { ...browserVaultRecord, ...browserVaultRecordChanges }
  await browserVaultEnvironment.browserVaultRecordStore.putBrowserVaultRecord(updatedBrowserVaultRecord)
  return updatedBrowserVaultRecord
}

// Opens a browser vault: it goes to the top of Recent vaults (off the Hidden list), and this tab
// holds its open lock until the workspace closes it.
export async function openPapelizBrowserVault(
  browserVaultRecord: PapelizBrowserVaultRecord,
  browserVaultEnvironment: PapelizBrowserVaultEnvironment = getPapelizBrowserVaultEnvironment(),
): Promise<PapelizOpenVaultResult> {
  const { papelizVaultId, papelizVaultDisplayName } = browserVaultRecord
  let browserVaultFolderHandle: FileSystemDirectoryHandle | null
  try {
    browserVaultFolderHandle = await getPapelizBrowserVaultFolderHandle(papelizVaultId, browserVaultEnvironment)
  } catch (browserVaultOpenError) {
    return { openVaultOutcome: 'failed', openVaultFailureMessage: `Couldn’t open “${papelizVaultDisplayName}” (${describePapelizVaultError(browserVaultOpenError)})` }
  }
  if (browserVaultFolderHandle === null) {
    return { openVaultOutcome: 'failed', openVaultFailureMessage: `Couldn’t open “${papelizVaultDisplayName}” (Vault Not Found)` }
  }
  const storedBrowserVaultRecord = (await readPapelizBrowserVaultRecord(papelizVaultId, browserVaultEnvironment).catch(() => null)) ?? browserVaultRecord
  await browserVaultEnvironment.browserVaultRecordStore
    .putBrowserVaultRecord({ ...storedBrowserVaultRecord, papelizVaultLastOpenedAt: browserVaultEnvironment.readCurrentTime(), papelizVaultHiddenAt: null })
    .catch(() => undefined)
  announcePapelizBrowserVaultListChange()
  const releaseBrowserVaultOpenLock = holdPapelizBrowserVaultOpenLock(browserVaultEnvironment.browserVaultLockManager, papelizVaultId)
  return {
    openVaultOutcome: 'opened',
    papelizOpenVault: {
      papelizVaultId,
      papelizVaultDisplayName: storedBrowserVaultRecord.papelizVaultDisplayName,
      papelizVaultAdapter: new PapelizBrowserVaultAdapter(browserVaultFolderHandle, {
        papelizVaultId,
        browserVaultLockManager: browserVaultEnvironment.browserVaultLockManager,
        onBrowserVaultChanged: () => void notePapelizBrowserVaultChangedSinceBackup(papelizVaultId, browserVaultEnvironment).catch(() => undefined),
        releaseBrowserVaultOpenLock,
        vaultFileContentsWriter: browserVaultEnvironment.vaultFileContentsWriter,
      }),
    },
  }
}
