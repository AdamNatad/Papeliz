import { History, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import type { PapelizSyncActionOutcome, PapelizSyncEngine, PapelizSyncFileVersionReading } from './papeliz-sync-engine-contract'
import { usePapelizSyncClockTime } from './papeliz-sync-clock'
import { setPapelizSyncOldVersionsDialogShown } from './papeliz-sync-flow-store'
import { PapelizSyncDialogFrame, PapelizSyncFailureLine, PapelizSyncLoadingLine } from './papeliz-sync-page-parts'
import { describePapelizSyncActionFailure, describePapelizSyncActionFailureNow, describePapelizSyncClockTime, formatPapelizSyncByteSize } from './papeliz-sync-screen-words'

// Old versions of the open note, newest first, from Sync's version history: look at one, or restore
// it, which makes it the newest version on every device. Old versions count toward storage.

interface PapelizSyncOldVersionsDialogProps {
  papelizSyncEngine: PapelizSyncEngine
  papelizVaultId: string
  vaultNoteRelativePath: string
}

type PapelizSyncShownVersionText = { syncFileVersion: number; shownVersionText: string | null; shownVersionFailureWords: string | null }

export function PapelizSyncOldVersionsDialog({ papelizSyncEngine, papelizVaultId, vaultNoteRelativePath }: PapelizSyncOldVersionsDialogProps) {
  const syncClockTime = usePapelizSyncClockTime()
  const [fileVersionsOutcome, setFileVersionsOutcome] = useState<PapelizSyncActionOutcome<PapelizSyncFileVersionReading[]> | null>(null)
  const [shownVersionText, setShownVersionText] = useState<PapelizSyncShownVersionText | null>(null)
  const [restoredSyncFileVersion, setRestoredSyncFileVersion] = useState<number | null>(null)
  const [restoreFailureWords, setRestoreFailureWords] = useState<string | null>(null)
  const [restoringSyncFileVersion, setRestoringSyncFileVersion] = useState<number | null>(null)

  useEffect(() => {
    let isOldVersionsDialogLeft = false
    void papelizSyncEngine.listSyncFileVersions(papelizVaultId, vaultNoteRelativePath).then((listedFileVersionsOutcome) => {
      if (!isOldVersionsDialogLeft) setFileVersionsOutcome(listedFileVersionsOutcome)
    })
    return () => {
      isOldVersionsDialogLeft = true
    }
  }, [papelizSyncEngine, papelizVaultId, vaultNoteRelativePath])

  const showVersionText = async (syncFileVersion: number) => {
    setShownVersionText({ syncFileVersion, shownVersionText: null, shownVersionFailureWords: null })
    const versionBytesOutcome = await papelizSyncEngine.readSyncFileVersionBytes(papelizVaultId, vaultNoteRelativePath, syncFileVersion)
    setShownVersionText(
      versionBytesOutcome.syncActionOutcome === 'done'
        ? { syncFileVersion, shownVersionText: new TextDecoder().decode(versionBytesOutcome.syncActionDoneValue), shownVersionFailureWords: null }
        : { syncFileVersion, shownVersionText: null, shownVersionFailureWords: describePapelizSyncActionFailureNow(versionBytesOutcome) },
    )
  }

  const restoreVersion = async (syncFileVersion: number) => {
    setRestoringSyncFileVersion(syncFileVersion)
    setRestoreFailureWords(null)
    const restoreOutcome = await papelizSyncEngine.restoreSyncFileVersion(papelizVaultId, vaultNoteRelativePath, syncFileVersion)
    setRestoringSyncFileVersion(null)
    if (restoreOutcome.syncActionOutcome === 'done') setRestoredSyncFileVersion(syncFileVersion)
    else setRestoreFailureWords(describePapelizSyncActionFailureNow(restoreOutcome))
  }

  return (
    <PapelizSyncDialogFrame
      syncDialogTitleId="papeliz-sync-old-versions-dialog-title"
      SyncDialogIcon={History}
      isSyncDialogDrawnInPlace={false}
      onSyncDialogCancel={() => setPapelizSyncOldVersionsDialogShown(false)}
      syncDialogTitle={`Old versions of “${getVaultNoteTitle(vaultNoteRelativePath)}”`}
      syncDialogIntro="Restoring one makes it the newest version on every device. The version it replaces stays in this list."
      syncDialogWidthClassName="w-[min(600px,calc(100vw-32px))]"
      syncDialogFooter={
        <PapelizPillButton pillButtonVariant="gray" onClick={() => setPapelizSyncOldVersionsDialogShown(false)}>
          Close
        </PapelizPillButton>
      }
    >
      <div className="mt-4">
        {fileVersionsOutcome === null ? (
          <PapelizSyncLoadingLine>Reading old versions…</PapelizSyncLoadingLine>
        ) : fileVersionsOutcome.syncActionOutcome === 'failed' ? (
          <PapelizSyncFailureLine>{describePapelizSyncActionFailure(fileVersionsOutcome, syncClockTime)}</PapelizSyncFailureLine>
        ) : fileVersionsOutcome.syncActionDoneValue.length === 0 ? (
          <p className="text-[13px] text-papeliz-ink-muted">This note has no old versions yet.</p>
        ) : (
          <ol className="divide-y divide-papeliz-line overflow-hidden rounded-2xl border border-papeliz-line">
            {fileVersionsOutcome.syncActionDoneValue.map((fileVersion, fileVersionIndex) => (
              <li key={fileVersion.syncFileVersion} className="px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium">
                      {describePapelizSyncClockTime(fileVersion.syncFileChangedAt, syncClockTime)}
                      {fileVersionIndex === 0 && <span className="ml-1.5 text-[11.5px] font-semibold text-papeliz-blue">Newest</span>}
                    </p>
                    <p className="text-[12px] text-papeliz-ink-subtle">
                      {fileVersion.isSyncFileDeletedInVersion ? 'Deleted' : fileVersion.syncFileChangedOnDeviceName === null ? 'On a device' : `On ${fileVersion.syncFileChangedOnDeviceName}`} ·{' '}
                      {formatPapelizSyncByteSize(fileVersion.syncFileStoredByteLength)}
                    </p>
                  </div>
                  {!fileVersion.isSyncFileDeletedInVersion && (
                    <PapelizPillButton pillButtonVariant="gray" pillButtonSize="small" onClick={() => void showVersionText(fileVersion.syncFileVersion)}>
                      Look
                    </PapelizPillButton>
                  )}
                  {fileVersionIndex > 0 && !fileVersion.isSyncFileDeletedInVersion && (
                    <PapelizPillButton
                      pillButtonVariant="line"
                      pillButtonSize="small"
                      disabled={restoringSyncFileVersion !== null}
                      onClick={() => void restoreVersion(fileVersion.syncFileVersion)}
                    >
                      {restoringSyncFileVersion === fileVersion.syncFileVersion && <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />}
                      {restoredSyncFileVersion === fileVersion.syncFileVersion ? 'Restored' : 'Restore'}
                    </PapelizPillButton>
                  )}
                </div>
                {shownVersionText?.syncFileVersion === fileVersion.syncFileVersion &&
                  (shownVersionText.shownVersionFailureWords !== null ? (
                    <PapelizSyncFailureLine className="mt-2">{shownVersionText.shownVersionFailureWords}</PapelizSyncFailureLine>
                  ) : shownVersionText.shownVersionText === null ? (
                    <PapelizSyncLoadingLine>Opening this version…</PapelizSyncLoadingLine>
                  ) : (
                    <pre className="papeliz-selectable-text mt-2 max-h-56 overflow-y-auto rounded-xl bg-papeliz-surface-soft px-3 py-2 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap">
                      {shownVersionText.shownVersionText}
                    </pre>
                  ))}
              </li>
            ))}
          </ol>
        )}
        {restoreFailureWords !== null && <PapelizSyncFailureLine className="mt-2">{restoreFailureWords}</PapelizSyncFailureLine>}
      </div>
    </PapelizSyncDialogFrame>
  )
}
