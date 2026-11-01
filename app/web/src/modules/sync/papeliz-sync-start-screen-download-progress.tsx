import { CloudDownload, TriangleAlert } from 'lucide-react'
import { describePapelizSyncFileCount } from './papeliz-sync-screen-words'
import type { PapelizSyncStartScreenDownload } from './papeliz-sync-start-screen-download-store'

// How far a download from the start screen is, the same on its Recent Vaults row and its Synced Vaults row.

// "12 of 318 files", or null until the engine reports.
export function describePapelizSyncStartScreenDownloadFileCount(syncStartScreenDownload: PapelizSyncStartScreenDownload): string | null {
  const { syncTransferredFileCount, syncTransferFileCount } = syncStartScreenDownload
  if (syncTransferredFileCount === null || syncTransferFileCount === null) return null
  return `${syncTransferredFileCount.toLocaleString('en-US')} of ${describePapelizSyncFileCount(syncTransferFileCount)}`
}

// Whole percent done, or null until the engine reports (or when there's nothing to download).
export function readPapelizSyncStartScreenDownloadPercent(syncStartScreenDownload: PapelizSyncStartScreenDownload): number | null {
  const { syncTransferredFileCount, syncTransferFileCount } = syncStartScreenDownload
  if (syncTransferredFileCount === null || !syncTransferFileCount) return null
  return Math.floor((100 * syncTransferredFileCount) / syncTransferFileCount)
}

// The lines under the vault's name: how far it is, with a bar, or where it stopped and why.
export function PapelizSyncStartScreenDownloadProgressLines({ syncStartScreenDownload }: { syncStartScreenDownload: PapelizSyncStartScreenDownload }) {
  const syncDownloadFileCountWords = describePapelizSyncStartScreenDownloadFileCount(syncStartScreenDownload)
  if (syncStartScreenDownload.syncStartScreenDownloadStage === 'stopped') {
    return (
      <span role="status" className="flex min-w-0 items-center gap-1 text-[11.5px] text-papeliz-diff-removed-ink">
        <TriangleAlert className="size-3 flex-none" aria-hidden="true" />
        <span className="truncate">
          {syncDownloadFileCountWords === null ? '' : `Stopped at ${syncDownloadFileCountWords}. `}
          {syncStartScreenDownload.syncStartScreenDownloadStopWords}
        </span>
      </span>
    )
  }
  return (
    <>
      <span role="status" className="flex items-center gap-1 text-[11.5px] text-papeliz-ink-subtle tabular-nums">
        <CloudDownload className="size-3 flex-none" aria-hidden="true" />
        {syncDownloadFileCountWords === null ? 'Getting ready to download…' : `Downloading ${syncDownloadFileCountWords}`}
      </span>
      <span aria-hidden="true" className="mt-0.5 h-1 overflow-hidden rounded-full bg-papeliz-surface-gray">
        <span
          className="block h-full rounded-full bg-papeliz-blue transition-[width] duration-300"
          style={{ width: `${readPapelizSyncStartScreenDownloadPercent(syncStartScreenDownload) ?? 0}%` }}
        />
      </span>
    </>
  )
}
