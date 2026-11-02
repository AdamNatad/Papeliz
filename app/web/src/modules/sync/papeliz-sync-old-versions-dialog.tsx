import { History, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { PapelizConfirmDialog } from '../ui/papeliz-confirm-dialog'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import type { PapelizSyncActionOutcome, PapelizSyncEngine, PapelizSyncFileVersionReading } from './papeliz-sync-engine-contract'
import { usePapelizSyncClockTime } from './papeliz-sync-clock'
import { setPapelizSyncOldVersionsDialogShown } from './papeliz-sync-flow-store'
import { PapelizSyncDialogFrame, PapelizSyncFailureLine, PapelizSyncLoadingLine, PapelizSyncPageSmallText } from './papeliz-sync-page-parts'
import {
  describePapelizSyncActionFailure,
  describePapelizSyncActionFailureNow,
  describePapelizSyncClockTime,
  describePapelizSyncOldVersionCount,
  describePapelizSyncOldVersionDeletion,
  formatPapelizSyncByteSize,
} from './papeliz-sync-screen-words'

// Old versions of the open note, newest first, from Sync's version history: look at one, restore it,
// which makes it the newest version on every device, or delete it. Old versions count toward storage, so
// deleting one, or all of them, frees room; the newest version always stays. Each delete is confirmed.

interface PapelizSyncOldVersionsDialogProps {
  papelizSyncEngine: PapelizSyncEngine
  papelizVaultId: string
  vaultNoteRelativePath: string
}

type PapelizSyncShownVersionText = { syncFileVersion: number; shownVersionText: string | null; shownVersionFailureWords: string | null }

// Which delete waits for its confirm: one version, or every old one.
type PapelizSyncOldVersionDeleteRequest = { oldVersionDeleteKind: 'one-version'; deletedFileVersion: PapelizSyncFileVersionReading } | { oldVersionDeleteKind: 'every-old-version' }

export function PapelizSyncOldVersionsDialog({ papelizSyncEngine, papelizVaultId, vaultNoteRelativePath }: PapelizSyncOldVersionsDialogProps) {
  const syncClockTime = usePapelizSyncClockTime()
  const [fileVersionsOutcome, setFileVersionsOutcome] = useState<PapelizSyncActionOutcome<PapelizSyncFileVersionReading[]> | null>(null)
  const [shownVersionText, setShownVersionText] = useState<PapelizSyncShownVersionText | null>(null)
  const [restoredSyncFileVersion, setRestoredSyncFileVersion] = useState<number | null>(null)
  const [restoreFailureWords, setRestoreFailureWords] = useState<string | null>(null)
  const [restoringSyncFileVersion, setRestoringSyncFileVersion] = useState<number | null>(null)
  const [oldVersionDeleteRequest, setOldVersionDeleteRequest] = useState<PapelizSyncOldVersionDeleteRequest | null>(null)
  const [isOldVersionDeleteRunning, setIsOldVersionDeleteRunning] = useState(false)
  const [oldVersionDeleteWords, setOldVersionDeleteWords] = useState<{ deleteResultWords: string; isDeleteFailed: boolean } | null>(null)
  const [fileVersionsReadCount, setFileVersionsReadCount] = useState(0)

  useEffect(() => {
    let isOldVersionsDialogLeft = false
    void papelizSyncEngine.listSyncFileVersions(papelizVaultId, vaultNoteRelativePath).then((listedFileVersionsOutcome) => {
      if (!isOldVersionsDialogLeft) setFileVersionsOutcome(listedFileVersionsOutcome)
    })
    return () => {
      isOldVersionsDialogLeft = true
    }
  }, [papelizSyncEngine, papelizVaultId, vaultNoteRelativePath, fileVersionsReadCount])

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

  // The confirmed delete; the list is read again afterwards, so it shows what is left.
  const deleteOldVersions = async (confirmedDeleteRequest: PapelizSyncOldVersionDeleteRequest) => {
    setIsOldVersionDeleteRunning(true)
    const oldVersionDeleteOutcome =
      confirmedDeleteRequest.oldVersionDeleteKind === 'one-version'
        ? await papelizSyncEngine.deleteSyncFileVersion(papelizVaultId, vaultNoteRelativePath, confirmedDeleteRequest.deletedFileVersion.syncFileVersion)
        : await papelizSyncEngine.deleteSyncFileOldVersions(papelizVaultId, vaultNoteRelativePath)
    setIsOldVersionDeleteRunning(false)
    setOldVersionDeleteRequest(null)
    setOldVersionDeleteWords(
      oldVersionDeleteOutcome.syncActionOutcome === 'done'
        ? { deleteResultWords: describePapelizSyncOldVersionDeletion(oldVersionDeleteOutcome.syncActionDoneValue), isDeleteFailed: false }
        : { deleteResultWords: describePapelizSyncActionFailureNow(oldVersionDeleteOutcome), isDeleteFailed: true },
    )
    if (confirmedDeleteRequest.oldVersionDeleteKind === 'one-version' && shownVersionText?.syncFileVersion === confirmedDeleteRequest.deletedFileVersion.syncFileVersion) setShownVersionText(null)
    setFileVersionsReadCount((readCount) => readCount + 1)
  }

  const listedFileVersions = fileVersionsOutcome?.syncActionOutcome === 'done' ? fileVersionsOutcome.syncActionDoneValue : []
  // The newest version is listed first and always stays.
  const oldFileVersionCount = Math.max(0, listedFileVersions.length - 1)

  return (
    <>
      <PapelizSyncDialogFrame
        syncDialogTitleId="papeliz-sync-old-versions-dialog-title"
        SyncDialogIcon={History}
        isSyncDialogDrawnInPlace={false}
        onSyncDialogCancel={() => setPapelizSyncOldVersionsDialogShown(false)}
        syncDialogTitle={`Old Versions of “${getVaultNoteTitle(vaultNoteRelativePath)}”`}
        syncDialogIntro="Restoring one makes it the newest version on every device. The version it replaces stays in this list. Old versions count toward storage, and deleting them frees it."
        syncDialogWidthClassName="w-[min(600px,calc(100vw-32px))]"
        syncDialogFooter={
          <>
            <PapelizPillButton pillButtonVariant="gray" className="mr-auto" onClick={() => setPapelizSyncOldVersionsDialogShown(false)}>
              Close
            </PapelizPillButton>
            <PapelizPillButton
              pillButtonVariant="line"
              disabled={oldFileVersionCount === 0 || isOldVersionDeleteRunning || restoringSyncFileVersion !== null}
              onClick={() => setOldVersionDeleteRequest({ oldVersionDeleteKind: 'every-old-version' })}
            >
              Delete All Old Versions
            </PapelizPillButton>
          </>
        }
      >
        <div className="mt-4">
          {fileVersionsOutcome === null ? (
            <PapelizSyncLoadingLine>Reading old versions…</PapelizSyncLoadingLine>
          ) : fileVersionsOutcome.syncActionOutcome === 'failed' ? (
            <PapelizSyncFailureLine>{describePapelizSyncActionFailure(fileVersionsOutcome, syncClockTime)}</PapelizSyncFailureLine>
          ) : listedFileVersions.length === 0 ? (
            <p className="text-[13px] text-papeliz-ink-muted">This note has no old versions yet.</p>
          ) : (
            <ol className="divide-y divide-papeliz-line overflow-hidden rounded-2xl border border-papeliz-line">
              {listedFileVersions.map((fileVersion, fileVersionIndex) => (
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
                        disabled={restoringSyncFileVersion !== null || isOldVersionDeleteRunning}
                        onClick={() => void restoreVersion(fileVersion.syncFileVersion)}
                      >
                        {restoringSyncFileVersion === fileVersion.syncFileVersion && <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />}
                        {restoredSyncFileVersion === fileVersion.syncFileVersion ? 'Restored' : 'Restore'}
                      </PapelizPillButton>
                    )}
                    {fileVersionIndex > 0 && (
                      <PapelizPillButton
                        pillButtonVariant="line"
                        pillButtonSize="small"
                        aria-label={`Delete the version from ${describePapelizSyncClockTime(fileVersion.syncFileChangedAt, syncClockTime)}`}
                        disabled={restoringSyncFileVersion !== null || isOldVersionDeleteRunning}
                        onClick={() => setOldVersionDeleteRequest({ oldVersionDeleteKind: 'one-version', deletedFileVersion: fileVersion })}
                      >
                        Delete
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
          {oldVersionDeleteWords !== null &&
            (oldVersionDeleteWords.isDeleteFailed ? (
              <PapelizSyncFailureLine className="mt-2">{oldVersionDeleteWords.deleteResultWords}</PapelizSyncFailureLine>
            ) : (
              <PapelizSyncPageSmallText className="mt-2">{oldVersionDeleteWords.deleteResultWords}</PapelizSyncPageSmallText>
            ))}
        </div>
      </PapelizSyncDialogFrame>
      {/* Beside the dialog, not inside it, so its Esc closes only the confirm; on the page body, as the
          dialog is, so nothing around this dialog's host styles it. */}
      {oldVersionDeleteRequest !== null &&
        createPortal(
          <PapelizConfirmDialog
            confirmDialogTitle={oldVersionDeleteRequest.oldVersionDeleteKind === 'one-version' ? 'Delete This Old Version?' : 'Delete All Old Versions?'}
            confirmDialogBody={
              <p>
                {oldVersionDeleteRequest.oldVersionDeleteKind === 'one-version'
                  ? `The version from ${describePapelizSyncClockTime(oldVersionDeleteRequest.deletedFileVersion.syncFileChangedAt, syncClockTime)} is deleted from Sync on every device. `
                  : `${oldFileVersionCount === 1 ? 'Its one old version is' : `All ${describePapelizSyncOldVersionCount(oldFileVersionCount)} of “${getVaultNoteTitle(vaultNoteRelativePath)}” are`} deleted from Sync on every device. `}
                The newest version stays, and so does the note on your devices. This can’t be undone.
              </p>
            }
            confirmButtonLabel={isOldVersionDeleteRunning ? 'Deleting…' : 'Delete'}
            isConfirmActionDangerous
            isConfirmButtonDisabled={isOldVersionDeleteRunning}
            onConfirm={() => void deleteOldVersions(oldVersionDeleteRequest)}
            onCancel={() => {
              if (!isOldVersionDeleteRunning) setOldVersionDeleteRequest(null)
            }}
          />,
          document.body,
        )}
    </>
  )
}
