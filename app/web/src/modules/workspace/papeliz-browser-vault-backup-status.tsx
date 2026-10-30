import { useEffect, useState } from 'react'
import { isPapelizBrowserStorageNearlyFull } from '../vault/papeliz-browser-vault-storage'
import { usePapelizBrowserStorageStore } from './papeliz-browser-storage-store'
import { isPapelizBrowserVaultBackupOverdue, isPapelizBrowserVaultBackupReminderDue, usePapelizBrowserVaultBackupReminderStore } from './papeliz-browser-vault-backup-reminder-store'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

// How often the open browser vault's row (the reminder, the last backup) is read again, and how often
// the browser's storage is measured.
const papelizBrowserVaultBackupReminderCheckMilliseconds = 60_000
const papelizBrowserStorageCheckMilliseconds = 10 * 60_000

const papelizBackupTimeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const papelizBackupDayFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

function isSameLocalDay(firstTime: number, secondTime: number): boolean {
  return new Date(firstTime).toDateString() === new Date(secondTime).toDateString()
}

// "2:41 PM" today, "Oct 29" before.
export function describePapelizBackupTimeShort(backupTime: number, currentTime: number): string {
  return isSameLocalDay(backupTime, currentTime) ? papelizBackupTimeFormat.format(backupTime) : papelizBackupDayFormat.format(backupTime)
}

// "Today, 2:41 PM" or "Oct 29, 2:41 PM".
export function describePapelizBackupTimeLong(backupTime: number, currentTime: number): string {
  return `${isSameLocalDay(backupTime, currentTime) ? 'Today' : papelizBackupDayFormat.format(backupTime)}, ${papelizBackupTimeFormat.format(backupTime)}`
}

// "today at 2:41 PM" or "on Oct 29 at 2:41 PM", inside a sentence.
export function describePapelizBackupTimeInSentence(backupTime: number, currentTime: number): string {
  return `${isSameLocalDay(backupTime, currentTime) ? 'today' : `on ${papelizBackupDayFormat.format(backupTime)}`} at ${papelizBackupTimeFormat.format(backupTime)}`
}

// What a browser vault's reminder and Close Vault say about its last backup.
export function describePapelizChangesSinceBackup(lastBackupAt: number | null, currentTime: number): string {
  return lastBackupAt === null ? 'It has no backup yet.' : `It has changes since its last backup, ${describePapelizBackupTimeInSentence(lastBackupAt, currentTime)}.`
}

// The time now, read again every half minute, for words such as "Backed up 2:41 PM".
export function usePapelizBackupClockTime(): number {
  const [backupClockTime, setBackupClockTime] = useState(() => Date.now())
  useEffect(() => {
    const backupClockTimer = setInterval(() => setBackupClockTime(Date.now()), 30_000)
    return () => clearInterval(backupClockTimer)
  }, [])
  return backupClockTime
}

// Close Vault's line for a browser vault with changes since its last backup.
export function PapelizBrowserVaultChangesSinceBackupLine() {
  const openBrowserVaultRecord = usePapelizBrowserVaultBackupReminderStore((reminderState) => reminderState.openBrowserVaultRecord)
  const backupClockTime = usePapelizBackupClockTime()
  if (openBrowserVaultRecord === null || openBrowserVaultRecord.papelizBrowserVaultFirstChangeSinceBackupAt === null) return null
  return <p className="mt-2">{describePapelizChangesSinceBackup(openBrowserVaultRecord.papelizBrowserVaultLastBackupAt, backupClockTime)}</p>
}

// Download backup with its toasts: where it went, or why it couldn't. Run it from a click.
export function useDownloadOpenBrowserVaultBackupWithNotice(): () => Promise<boolean> {
  const showWorkspaceNotice = usePapelizWorkspaceStore((workspaceState) => workspaceState.showWorkspaceNotice)
  const downloadOpenBrowserVaultBackup = usePapelizBrowserVaultBackupReminderStore((reminderState) => reminderState.downloadOpenBrowserVaultBackup)
  return async () => {
    const browserVaultBackupDownloadResult = await downloadOpenBrowserVaultBackup()
    if (browserVaultBackupDownloadResult?.browserVaultBackupDownloadOutcome === 'downloaded') {
      showWorkspaceNotice('info', `Backed up as “${browserVaultBackupDownloadResult.browserVaultBackupFileName}”.`)
      return true
    }
    if (browserVaultBackupDownloadResult?.browserVaultBackupDownloadOutcome === 'failed') {
      showWorkspaceNotice('error', browserVaultBackupDownloadResult.browserVaultBackupFailureMessage)
    }
    return false
  }
}

// The status bar's backup state for a browser vault: "Backed up 2:41 PM", a "Backup due" chip that
// downloads one, and "Storage nearly full". It also keeps the reminder: while the tab is in view it
// looks once a minute and shows the toast when one is due.
export function PapelizBrowserVaultBackupStatus({ papelizVaultId }: { papelizVaultId: string }) {
  const openBrowserVaultRecord = usePapelizBrowserVaultBackupReminderStore((reminderState) => reminderState.openBrowserVaultRecord)
  const isBrowserVaultBackupDownloading = usePapelizBrowserVaultBackupReminderStore((reminderState) => reminderState.isBrowserVaultBackupDownloading)
  const browserStorageEstimate = usePapelizBrowserStorageStore((browserStorageState) => browserStorageState.browserStorageEstimate)
  const showWorkspaceNotice = usePapelizWorkspaceStore((workspaceState) => workspaceState.showWorkspaceNotice)
  const isBrowserStorageFullSaveFailure = usePapelizWorkspaceStore((workspaceState) =>
    Object.values(workspaceState.loadedVaultNotesByRelativePath).some(
      (loadedVaultNote) => loadedVaultNote.noteSaveState === 'save-failed' && loadedVaultNote.noteSaveErrorMessage === 'Browser Storage Full',
    ),
  )
  const downloadBackupWithNotice = useDownloadOpenBrowserVaultBackupWithNotice()
  const backupClockTime = usePapelizBackupClockTime()

  useEffect(() => {
    const { refreshOpenBrowserVaultRecord, noteBrowserVaultBackupReminderShown } = usePapelizBrowserVaultBackupReminderStore.getState()
    const { refreshBrowserStorageState } = usePapelizBrowserStorageStore.getState()
    const checkBackupReminder = async () => {
      await refreshOpenBrowserVaultRecord(papelizVaultId)
      const checkedBrowserVaultRecord = usePapelizBrowserVaultBackupReminderStore.getState().openBrowserVaultRecord
      const currentTime = Date.now()
      if (checkedBrowserVaultRecord === null || document.visibilityState !== 'visible') return
      if (!isPapelizBrowserVaultBackupReminderDue(checkedBrowserVaultRecord, currentTime)) return
      await noteBrowserVaultBackupReminderShown(currentTime)
      const backupSinceText = describePapelizChangesSinceBackup(checkedBrowserVaultRecord.papelizBrowserVaultLastBackupAt, currentTime)
      showWorkspaceNotice('info', `Back up “${checkedBrowserVaultRecord.papelizVaultDisplayName}”? ${backupSinceText}`, {
        workspaceNoticeActionLabel: 'Download backup',
        onWorkspaceNoticeAction: () => void downloadBackupWithNotice(),
      })
    }
    void checkBackupReminder()
    void refreshBrowserStorageState()
    const backupReminderTimer = setInterval(() => void checkBackupReminder(), papelizBrowserVaultBackupReminderCheckMilliseconds)
    const browserStorageTimer = setInterval(() => void refreshBrowserStorageState(), papelizBrowserStorageCheckMilliseconds)
    const checkOnReturn = () => {
      if (document.visibilityState === 'visible') void checkBackupReminder()
    }
    document.addEventListener('visibilitychange', checkOnReturn)
    return () => {
      clearInterval(backupReminderTimer)
      clearInterval(browserStorageTimer)
      document.removeEventListener('visibilitychange', checkOnReturn)
      void refreshOpenBrowserVaultRecord(null)
    }
    // The toast's action only needs the latest download, which reads the store when clicked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [papelizVaultId, showWorkspaceNotice])

  // A save that failed for want of storage says so, and offers a backup.
  useEffect(() => {
    if (!isBrowserStorageFullSaveFailure) return
    void usePapelizBrowserStorageStore.getState().refreshBrowserStorageState()
    showWorkspaceNotice('error', 'Couldn’t save (Browser Storage Full)', {
      workspaceNoticeActionLabel: 'Download backup',
      onWorkspaceNoticeAction: () => void downloadBackupWithNotice(),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBrowserStorageFullSaveFailure, showWorkspaceNotice])

  if (openBrowserVaultRecord === null || openBrowserVaultRecord.papelizVaultId !== papelizVaultId) return null
  const isBackupOverdue = isPapelizBrowserVaultBackupOverdue(openBrowserVaultRecord, backupClockTime)
  const lastBackupAt = openBrowserVaultRecord.papelizBrowserVaultLastBackupAt

  return (
    <>
      {isPapelizBrowserStorageNearlyFull(browserStorageEstimate) && (
        <span
          className="flex-none rounded-full bg-papeliz-warning px-1.5 text-[11px] leading-[17px] font-semibold text-papeliz-warning-ink"
          title="This browser’s storage is nearly full. Download a backup, then make room."
        >
          Storage nearly full
        </span>
      )}
      {isBackupOverdue ? (
        <button
          type="button"
          disabled={isBrowserVaultBackupDownloading}
          onClick={() => void downloadBackupWithNotice()}
          title="This vault has changes since its last backup. Download one now."
          className="flex-none rounded-full bg-white px-1.5 text-[11px] leading-[17px] font-semibold text-papeliz-topbar hover:bg-white/90 focus-visible:outline-white disabled:opacity-70"
        >
          {isBrowserVaultBackupDownloading ? 'Backing up…' : 'Backup due'}
        </button>
      ) : (
        lastBackupAt !== null && <span className="max-sm:hidden">Backed up {describePapelizBackupTimeShort(lastBackupAt, backupClockTime)}</span>
      )}
    </>
  )
}
