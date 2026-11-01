import { FileQuestionMark, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import type { PapelizSyncActionOutcome, PapelizSyncEngine } from './papeliz-sync-engine-contract'
import { putOffPapelizSyncMissingFiles } from './papeliz-sync-flow-store'
import { PapelizSyncDialogFrame, PapelizSyncFailureLine } from './papeliz-sync-page-parts'
import {
  describePapelizSyncActionFailureNow,
  introducePapelizSyncMissingFilesDialog,
  papelizSyncMissingFilesDialogWords,
  titlePapelizSyncMissingFilesDeleteConfirm,
  titlePapelizSyncMissingFilesDialog,
} from './papeliz-sync-screen-words'

// A vault whose synced files went missing here while it was closed (its status is `files-missing`):
// the files are still on Sync, and nothing is sent as deleted until a choice here. Download them again
// is the main action; They were deleted asks once more before it removes them everywhere. Not now
// keeps them held, and the status bar keeps saying so.

interface PapelizSyncMissingFilesDialogProps {
  papelizSyncEngine: PapelizSyncEngine
  papelizVaultId: string
  papelizVaultDisplayName: string
  syncMissingFileCount: number
  isSyncDialogDrawnInPlace: boolean
}

export function PapelizSyncMissingFilesDialog({ papelizSyncEngine, papelizVaultId, papelizVaultDisplayName, syncMissingFileCount, isSyncDialogDrawnInPlace }: PapelizSyncMissingFilesDialogProps) {
  const missingFilesDialogTitleId = useId()
  const [isDeleteConfirmShown, setDeleteConfirmShown] = useState(false)
  const [isMissingFilesChoiceRunning, setMissingFilesChoiceRunning] = useState(false)
  const [missingFilesChoiceFailureWords, setMissingFilesChoiceFailureWords] = useState<string | null>(null)

  const putOffMissingFiles = () => putOffPapelizSyncMissingFiles(papelizVaultId)
  const runMissingFilesChoice = async (sendMissingFilesChoice: () => Promise<PapelizSyncActionOutcome>) => {
    setMissingFilesChoiceRunning(true)
    setMissingFilesChoiceFailureWords(null)
    const missingFilesChoiceOutcome = await sendMissingFilesChoice()
    setMissingFilesChoiceRunning(false)
    if (missingFilesChoiceOutcome.syncActionOutcome === 'failed') setMissingFilesChoiceFailureWords(describePapelizSyncActionFailureNow(missingFilesChoiceOutcome))
    else putOffMissingFiles()
  }

  if (isDeleteConfirmShown) {
    return (
      <PapelizSyncDialogFrame
        syncDialogTitleId={missingFilesDialogTitleId}
        SyncDialogIcon={Trash2}
        syncDialogTitle={titlePapelizSyncMissingFilesDeleteConfirm(syncMissingFileCount)}
        syncDialogIntro={papelizSyncMissingFilesDialogWords.deleteConfirmIntro}
        onSyncDialogCancel={() => setDeleteConfirmShown(false)}
        isSyncDialogDrawnInPlace={isSyncDialogDrawnInPlace}
        syncDialogWidthClassName="w-[min(440px,calc(100vw-32px))]"
        syncDialogFooter={
          <>
            {missingFilesChoiceFailureWords !== null && <PapelizSyncFailureLine className="mb-1 w-full">{missingFilesChoiceFailureWords}</PapelizSyncFailureLine>}
            <PapelizPillButton pillButtonVariant="dialog-cancel" className="mr-auto min-w-28" onClick={() => setDeleteConfirmShown(false)}>
              {papelizSyncMissingFilesDialogWords.deleteConfirmBackButtonLabel}
            </PapelizPillButton>
            <PapelizPillButton
              pillButtonVariant="dialog-confirm-danger"
              className="min-w-28"
              disabled={isMissingFilesChoiceRunning}
              onClick={() => void runMissingFilesChoice(() => papelizSyncEngine.confirmMissingSyncFilesDeleted(papelizVaultId))}
            >
              {papelizSyncMissingFilesDialogWords.deleteConfirmButtonLabel}
            </PapelizPillButton>
          </>
        }
      />
    )
  }

  return (
    <PapelizSyncDialogFrame
      syncDialogTitleId={missingFilesDialogTitleId}
      SyncDialogIcon={FileQuestionMark}
      syncDialogTitle={titlePapelizSyncMissingFilesDialog(syncMissingFileCount)}
      syncDialogIntro={introducePapelizSyncMissingFilesDialog(syncMissingFileCount, papelizVaultDisplayName)}
      onSyncDialogCancel={putOffMissingFiles}
      isSyncDialogDrawnInPlace={isSyncDialogDrawnInPlace}
      syncDialogFooter={
        <>
          {missingFilesChoiceFailureWords !== null && <PapelizSyncFailureLine className="mb-1 w-full">{missingFilesChoiceFailureWords}</PapelizSyncFailureLine>}
          <PapelizPillButton pillButtonVariant="dialog-cancel" className="mr-auto" onClick={putOffMissingFiles}>
            {papelizSyncMissingFilesDialogWords.notNowButtonLabel}
          </PapelizPillButton>
          <PapelizPillButton pillButtonVariant="dialog-confirm-danger" disabled={isMissingFilesChoiceRunning} onClick={() => setDeleteConfirmShown(true)}>
            {papelizSyncMissingFilesDialogWords.deletedButtonLabel}
          </PapelizPillButton>
          <PapelizPillButton
            pillButtonVariant="dialog-confirm"
            disabled={isMissingFilesChoiceRunning}
            onClick={() => void runMissingFilesChoice(() => papelizSyncEngine.downloadMissingSyncFilesAgain(papelizVaultId))}
          >
            {papelizSyncMissingFilesDialogWords.downloadAgainButtonLabel}
          </PapelizPillButton>
        </>
      }
    >
      <ul className="mt-4 flex flex-col gap-2 text-sm leading-[1.45] text-papeliz-ink-muted">
        <li>
          <b className="font-semibold text-papeliz-ink">{papelizSyncMissingFilesDialogWords.downloadAgainButtonLabel}</b> {papelizSyncMissingFilesDialogWords.downloadAgainChoiceText}
        </li>
        <li>
          <b className="font-semibold text-papeliz-ink">{papelizSyncMissingFilesDialogWords.deletedButtonLabel}</b> {papelizSyncMissingFilesDialogWords.deletedChoiceText}
        </li>
      </ul>
    </PapelizSyncDialogFrame>
  )
}
