import { AppWindow, Download, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useEffect } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizSlidingChoiceGroup } from '../ui/papeliz-sliding-choice-group'
import { papelizBrowserVaultBackupReminderIntervalChoices, type PapelizBrowserVaultBackupReminderIntervalMinutes } from '../vault/papeliz-browser-vaults'
import { formatPapelizStorageByteCount, isPapelizBrowserSafari, isPapelizBrowserStorageNearlyFull } from '../vault/papeliz-browser-vault-storage'
import { usePapelizBrowserStorageStore } from './papeliz-browser-storage-store'
import { describePapelizBackupTimeLong, useDownloadOpenBrowserVaultBackupWithNotice, usePapelizBackupClockTime } from './papeliz-browser-vault-backup-status'
import { usePapelizBrowserVaultBackupReminderStore } from './papeliz-browser-vault-backup-reminder-store'

// What the storage line says: whether the browser keeps this site's storage, and how full it is.
function PapelizBrowserStorageLine() {
  const browserStorageKeptState = usePapelizBrowserStorageStore((browserStorageState) => browserStorageState.browserStorageKeptState)
  const browserStorageEstimate = usePapelizBrowserStorageStore((browserStorageState) => browserStorageState.browserStorageEstimate)
  const usedStorageText = browserStorageEstimate === null ? '' : ` ${formatPapelizStorageByteCount(browserStorageEstimate.browserStorageUsedByteCount)} used.`

  if (isPapelizBrowserStorageNearlyFull(browserStorageEstimate) && browserStorageEstimate !== null) {
    return (
      <p className="mt-3 flex gap-2 rounded-xl bg-papeliz-warning px-2.5 py-2 text-[12px] leading-snug text-papeliz-warning-ink">
        <TriangleAlert className="mt-px size-4 flex-none" aria-hidden="true" />
        <span>
          <b className="block font-semibold">Storage nearly full</b>
          {formatPapelizStorageByteCount(browserStorageEstimate.browserStorageUsedByteCount)} of{' '}
          {formatPapelizStorageByteCount(browserStorageEstimate.browserStorageQuotaByteCount)} used. Download a backup, then make room.
        </span>
      </p>
    )
  }
  if (browserStorageKeptState === 'kept') {
    return (
      <p className="mt-3 flex gap-2 rounded-xl bg-papeliz-diff-added px-2.5 py-2 text-[12px] leading-snug text-papeliz-ink-muted">
        <ShieldCheck className="mt-px size-4 flex-none text-papeliz-diff-added-ink" aria-hidden="true" />
        <span>
          <b className="block font-semibold text-papeliz-diff-added-ink">Kept</b>
          This browser won’t clear it to make room.{usedStorageText}
        </span>
      </p>
    )
  }
  return (
    <p className="mt-3 flex gap-2 rounded-xl border border-papeliz-line bg-papeliz-surface-soft px-2.5 py-2 text-[12px] leading-snug text-papeliz-ink-muted">
      <AppWindow className="mt-px size-4 flex-none" aria-hidden="true" />
      <span>
        <b className="block font-semibold text-papeliz-ink">Not kept for sure</b>
        {isPapelizBrowserSafari()
          ? 'Safari may clear it when your disk runs low, or after 7 days of using Safari without opening Papeliz.'
          : 'This browser may clear it when your disk runs low.'}
        {usedStorageText}
      </span>
    </p>
  )
}

// Settings › Reminder, for a vault kept in the browser: the backup reminder, the last backup,
// Download backup, and whether the browser keeps its storage.
export function PapelizSettingsGearReminderTab() {
  const openBrowserVaultRecord = usePapelizBrowserVaultBackupReminderStore((reminderState) => reminderState.openBrowserVaultRecord)
  const isBrowserVaultBackupDownloading = usePapelizBrowserVaultBackupReminderStore((reminderState) => reminderState.isBrowserVaultBackupDownloading)
  const setBrowserVaultBackupReminder = usePapelizBrowserVaultBackupReminderStore((reminderState) => reminderState.setBrowserVaultBackupReminder)
  const downloadBackupWithNotice = useDownloadOpenBrowserVaultBackupWithNotice()
  const backupClockTime = usePapelizBackupClockTime()

  useEffect(() => {
    void usePapelizBrowserStorageStore.getState().refreshBrowserStorageState()
  }, [])

  if (openBrowserVaultRecord === null) return null
  const isBackupReminderOn = openBrowserVaultRecord.papelizBrowserVaultBackupReminderOn
  const lastBackupAt = openBrowserVaultRecord.papelizBrowserVaultLastBackupAt

  return (
    <div>
      <p className="text-[12.5px] leading-snug text-papeliz-ink-muted">
        This vault is kept in this browser. Clearing the site’s data deletes it, so download a backup now and then.
      </p>
      <button
        type="button"
        role="switch"
        aria-checked={isBackupReminderOn}
        onClick={() => void setBrowserVaultBackupReminder({ papelizBrowserVaultBackupReminderOn: !isBackupReminderOn })}
        className="mt-3 flex w-full items-center justify-between gap-2 rounded-lg py-1 text-left text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-papeliz-blue"
      >
        Backup reminder
        <span
          aria-hidden="true"
          className={joinPapelizClassNames(
            'relative h-4 w-7 flex-none rounded-full transition-colors after:absolute after:top-0.5 after:size-3 after:rounded-full after:bg-white after:shadow-[0_1px_2px_rgb(17_17_18/0.25)] after:transition-[left] after:duration-150',
            isBackupReminderOn ? 'bg-papeliz-blue after:left-3.5' : 'bg-papeliz-line-strong after:left-0.5',
          )}
        />
      </button>
      <p className="mt-2 mb-1.5 text-[12px] font-semibold text-papeliz-ink-muted">Remind me every</p>
      <PapelizSlidingChoiceGroup<`${PapelizBrowserVaultBackupReminderIntervalMinutes}`>
        slidingChoiceGroupLabel="Remind me every"
        slidingChoiceGroupRole="radiogroup"
        slidingChoices={papelizBrowserVaultBackupReminderIntervalChoices.map((intervalMinutes) => ({
          slidingChoiceValue: `${intervalMinutes}`,
          slidingChoiceContent: `${intervalMinutes} min`,
        }))}
        chosenSlidingChoiceValue={`${openBrowserVaultRecord.papelizBrowserVaultBackupReminderIntervalMinutes}`}
        onSlidingChoiceSelect={(chosenIntervalMinutesText) =>
          void setBrowserVaultBackupReminder({
            papelizBrowserVaultBackupReminderIntervalMinutes: Number(chosenIntervalMinutesText) as PapelizBrowserVaultBackupReminderIntervalMinutes,
          })
        }
        slidingChoiceGroupClassName={isBackupReminderOn ? undefined : 'opacity-50'}
      />
      <p className="mt-3 flex justify-between gap-2 text-[12.5px] text-papeliz-ink-muted">
        Last backup
        <b className="font-semibold text-papeliz-ink">{lastBackupAt === null ? 'Never' : describePapelizBackupTimeLong(lastBackupAt, backupClockTime)}</b>
      </p>
      <PapelizPillButton
        pillButtonVariant="primary"
        disabled={isBrowserVaultBackupDownloading}
        onClick={() => void downloadBackupWithNotice()}
        className="mt-3 w-full justify-center"
      >
        <Download className="size-4" aria-hidden="true" />
        {isBrowserVaultBackupDownloading ? 'Backing up…' : 'Download backup'}
      </PapelizPillButton>
      <PapelizBrowserStorageLine />
    </div>
  )
}
