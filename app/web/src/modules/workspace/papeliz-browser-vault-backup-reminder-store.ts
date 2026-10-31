import { create } from 'zustand'
import { buildPapelizBrowserVaultBackupFileName, createPapelizBrowserVaultBackupZipBlob, notePapelizBrowserVaultBackedUp } from '../vault/papeliz-browser-vault-backup'
import {
  readPapelizBrowserVaultRecord,
  updatePapelizBrowserVaultRecord,
  type PapelizBrowserVaultBackupReminderIntervalMinutes,
  type PapelizBrowserVaultRecord,
} from '../vault/papeliz-browser-vaults'
import { describePapelizVaultError } from '../vault/papeliz-vault-adapter'
import { buildThenSavePapelizExportFile } from './papeliz-export-file-save'

// A browser vault's backups: Download backup, and the reminder (Settings › Reminder). The reminder is
// due only while the vault has changes since its last backup, once its interval has passed since the
// first of them, and again an interval after it last showed (Later counts as shown). It shows in the
// tab in view; the time it showed is kept in the vault's row, so the other tabs don't repeat it. The
// status bar says "Backup due" from the first interval on, until a backup is done.

const papelizMinuteMilliseconds = 60_000

function getBrowserVaultBackupReminderIntervalMilliseconds(browserVaultRecord: PapelizBrowserVaultRecord): number {
  return browserVaultRecord.papelizBrowserVaultBackupReminderIntervalMinutes * papelizMinuteMilliseconds
}

// The status bar's "Backup due": changes waiting longer than the interval.
export function isPapelizBrowserVaultBackupOverdue(browserVaultRecord: PapelizBrowserVaultRecord, currentTime: number): boolean {
  const firstChangeSinceBackupAt = browserVaultRecord.papelizBrowserVaultFirstChangeSinceBackupAt
  if (!browserVaultRecord.papelizBrowserVaultBackupReminderOn || firstChangeSinceBackupAt === null) return false
  return currentTime - firstChangeSinceBackupAt >= getBrowserVaultBackupReminderIntervalMilliseconds(browserVaultRecord)
}

// Whether the reminder should show now.
export function isPapelizBrowserVaultBackupReminderDue(browserVaultRecord: PapelizBrowserVaultRecord, currentTime: number): boolean {
  if (!isPapelizBrowserVaultBackupOverdue(browserVaultRecord, currentTime)) return false
  const backupReminderShownAt = browserVaultRecord.papelizBrowserVaultBackupReminderShownAt
  return backupReminderShownAt === null || currentTime - backupReminderShownAt >= getBrowserVaultBackupReminderIntervalMilliseconds(browserVaultRecord)
}

export type PapelizBrowserVaultBackupDownloadResult =
  | { browserVaultBackupDownloadOutcome: 'downloaded'; browserVaultBackupFileName: string }
  | { browserVaultBackupDownloadOutcome: 'cancelled' }
  | { browserVaultBackupDownloadOutcome: 'failed'; browserVaultBackupFailureMessage: string }

// Download backup, from a click: the backup is built first, then Chrome and Edge ask where to save it
// (shortly after the click only; a longer build downloads), other browsers download it. It counts as
// done once the file is handed over.
export async function downloadPapelizBrowserVaultBackupFromClick(browserVaultRecord: PapelizBrowserVaultRecord): Promise<PapelizBrowserVaultBackupDownloadResult> {
  const browserVaultBackupDate = new Date()
  const browserVaultBackupFileName = buildPapelizBrowserVaultBackupFileName(browserVaultRecord.papelizVaultDisplayName, browserVaultBackupDate)
  try {
    const { exportFileSaveOutcome: backupFileSaveOutcome } = await buildThenSavePapelizExportFile(
      browserVaultBackupFileName,
      { exportFileDescription: 'Vault backup (.zip)', exportFileMediaType: 'application/zip', exportFileExtension: '.zip' },
      async () => ({ exportFileBlob: await createPapelizBrowserVaultBackupZipBlob(browserVaultRecord, browserVaultBackupDate) }),
    )
    if (backupFileSaveOutcome === 'save-dialog-closed') return { browserVaultBackupDownloadOutcome: 'cancelled' }
    await notePapelizBrowserVaultBackedUp(browserVaultRecord.papelizVaultId)
    return { browserVaultBackupDownloadOutcome: 'downloaded', browserVaultBackupFileName }
  } catch (browserVaultBackupError) {
    return {
      browserVaultBackupDownloadOutcome: 'failed',
      browserVaultBackupFailureMessage: `Couldn’t back up “${browserVaultRecord.papelizVaultDisplayName}” (${describePapelizVaultError(browserVaultBackupError)})`,
    }
  }
}

interface PapelizBrowserVaultBackupReminderState {
  // The open browser vault's row, as last read; null when no browser vault is open.
  openBrowserVaultRecord: PapelizBrowserVaultRecord | null
  isBrowserVaultBackupDownloading: boolean
  // Reads the row again (or forgets it, for null).
  refreshOpenBrowserVaultRecord: (papelizVaultId: string | null) => Promise<void>
  setBrowserVaultBackupReminder: (
    backupReminderChanges: Partial<{ papelizBrowserVaultBackupReminderOn: boolean; papelizBrowserVaultBackupReminderIntervalMinutes: PapelizBrowserVaultBackupReminderIntervalMinutes }>,
  ) => Promise<void>
  noteBrowserVaultBackupReminderShown: (backupReminderShownAt: number) => Promise<void>
  downloadOpenBrowserVaultBackup: () => Promise<PapelizBrowserVaultBackupDownloadResult | null>
}

export const usePapelizBrowserVaultBackupReminderStore = create<PapelizBrowserVaultBackupReminderState>()((setReminderState, getReminderState) => ({
  openBrowserVaultRecord: null,
  isBrowserVaultBackupDownloading: false,

  refreshOpenBrowserVaultRecord: async (papelizVaultId) => {
    if (papelizVaultId === null) {
      setReminderState({ openBrowserVaultRecord: null })
      return
    }
    const openBrowserVaultRecord = await readPapelizBrowserVaultRecord(papelizVaultId).catch(() => null)
    setReminderState({ openBrowserVaultRecord })
  },

  setBrowserVaultBackupReminder: async (backupReminderChanges) => {
    const openBrowserVaultRecord = getReminderState().openBrowserVaultRecord
    if (openBrowserVaultRecord === null) return
    setReminderState({ openBrowserVaultRecord: { ...openBrowserVaultRecord, ...backupReminderChanges } })
    const updatedBrowserVaultRecord = await updatePapelizBrowserVaultRecord(openBrowserVaultRecord.papelizVaultId, backupReminderChanges).catch(() => null)
    if (updatedBrowserVaultRecord !== null) setReminderState({ openBrowserVaultRecord: updatedBrowserVaultRecord })
  },

  noteBrowserVaultBackupReminderShown: async (backupReminderShownAt) => {
    const openBrowserVaultRecord = getReminderState().openBrowserVaultRecord
    if (openBrowserVaultRecord === null) return
    const updatedBrowserVaultRecord = await updatePapelizBrowserVaultRecord(openBrowserVaultRecord.papelizVaultId, {
      papelizBrowserVaultBackupReminderShownAt: backupReminderShownAt,
    }).catch(() => null)
    if (updatedBrowserVaultRecord !== null) setReminderState({ openBrowserVaultRecord: updatedBrowserVaultRecord })
  },

  downloadOpenBrowserVaultBackup: async () => {
    const { openBrowserVaultRecord, isBrowserVaultBackupDownloading } = getReminderState()
    if (openBrowserVaultRecord === null || isBrowserVaultBackupDownloading) return null
    setReminderState({ isBrowserVaultBackupDownloading: true })
    try {
      const browserVaultBackupDownloadResult = await downloadPapelizBrowserVaultBackupFromClick(openBrowserVaultRecord)
      await getReminderState().refreshOpenBrowserVaultRecord(openBrowserVaultRecord.papelizVaultId)
      return browserVaultBackupDownloadResult
    } finally {
      setReminderState({ isBrowserVaultBackupDownloading: false })
    }
  },
}))
