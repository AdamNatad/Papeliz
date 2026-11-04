import { CircleCheck, RefreshCw, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { PapelizLoadingWords } from '../ui/papeliz-loading-dots'
import { PapelizLoadingRing } from '../ui/papeliz-loading-ring'
import type { PapelizSyncEngine, PapelizSyncEngineSnapshot, PapelizSyncVaultEncryptionChoice, PapelizSyncVaultEncryptionKind } from './papeliz-sync-engine-contract'
import { closePapelizSyncSetUpDialog } from './papeliz-sync-flow-store'
import { isPapelizSyncNewPassphraseReady, PapelizSyncNewPassphraseFields } from './papeliz-sync-passphrase-fields'
import { PapelizSyncDialogFrame, PapelizSyncDialogSteps, PapelizSyncFailureLine, PapelizSyncTransferReadout } from './papeliz-sync-page-parts'
import { describePapelizSyncActionFailureNow, papelizSyncVaultEncryptionKindDisplayNames, papelizSyncVaultPassphraseNotRecoverableLine } from './papeliz-sync-screen-words'
import {
  changePapelizSyncVaultEncryption,
  readPapelizSyncVaultOtherEncryptionKind,
  turnPapelizSyncOnAgainWithOtherEncryption,
  type PapelizSyncVaultEncryptionChangeOutcome,
  type PapelizSyncVaultEncryptionChangeStep,
} from './papeliz-sync-vault-encryption-change'

// Change Encryption, from Settings › Sync for the open vault that syncs: what happens, then the
// passphrase when it goes End-to-end, then the synced copy deleted and the vault uploaded again with
// the other kind, its progress read from the engine's snapshot. Going to Standard has no passphrase
// step. A passphrase passes straight to the engine and is kept only while typed.

type PapelizSyncChangeEncryptionDialogStep = 'what-happens' | 'passphrase' | 'syncing-again'

type PapelizSyncChangeEncryptionRunState =
  | { changeEncryptionRunKind: 'not-started' }
  | { changeEncryptionRunKind: 'running'; runningSyncVaultEncryptionChangeStep: PapelizSyncVaultEncryptionChangeStep }
  | { changeEncryptionRunKind: 'changed' }
  | { changeEncryptionRunKind: 'failed'; failedSyncVaultEncryptionChangeStep: PapelizSyncVaultEncryptionChangeStep; changeEncryptionFailureWords: string }

interface PapelizSyncChangeEncryptionDialogProps {
  papelizSyncEngine: PapelizSyncEngine
  syncEngineSnapshot: PapelizSyncEngineSnapshot
  papelizVaultId: string
  papelizSyncVaultId: string
  syncVaultName: string
  currentSyncVaultEncryptionKind: PapelizSyncVaultEncryptionKind
  isSyncDialogDrawnInPlace: boolean
}

function readChangeEncryptionStepLabels(newSyncVaultEncryptionKind: PapelizSyncVaultEncryptionKind): readonly string[] {
  return newSyncVaultEncryptionKind === 'end-to-end' ? ['What Happens', 'Passphrase', 'Sync Again'] : ['What Happens', 'Sync Again']
}

export function PapelizSyncChangeEncryptionDialog({
  papelizSyncEngine,
  syncEngineSnapshot,
  papelizVaultId,
  papelizSyncVaultId,
  syncVaultName,
  currentSyncVaultEncryptionKind,
  isSyncDialogDrawnInPlace,
}: PapelizSyncChangeEncryptionDialogProps) {
  const newSyncVaultEncryptionKind = readPapelizSyncVaultOtherEncryptionKind(currentSyncVaultEncryptionKind)
  const newSyncVaultEncryptionKindName = papelizSyncVaultEncryptionKindDisplayNames[newSyncVaultEncryptionKind]
  const isGoingEndToEnd = newSyncVaultEncryptionKind === 'end-to-end'
  const [changeEncryptionDialogStep, setChangeEncryptionDialogStep] = useState<PapelizSyncChangeEncryptionDialogStep>('what-happens')
  const [changeEncryptionRunState, setChangeEncryptionRunState] = useState<PapelizSyncChangeEncryptionRunState>({ changeEncryptionRunKind: 'not-started' })
  const [typedSyncVaultPassphrase, setTypedSyncVaultPassphrase] = useState('')
  const [repeatedSyncVaultPassphrase, setRepeatedSyncVaultPassphrase] = useState('')
  // Kept for Try Again after the synced copy was deleted, until the dialog closes.
  const [newSyncVaultEncryptionChoice, setNewSyncVaultEncryptionChoice] = useState<PapelizSyncVaultEncryptionChoice | null>(null)
  const isChangeEncryptionRunning = changeEncryptionRunState.changeEncryptionRunKind === 'running'

  const followChangeEncryptionOutcome = (syncVaultEncryptionChangeOutcome: PapelizSyncVaultEncryptionChangeOutcome) => {
    if (syncVaultEncryptionChangeOutcome.syncVaultEncryptionChangeOutcome === 'changed') {
      setChangeEncryptionRunState({ changeEncryptionRunKind: 'changed' })
      // The passphrase isn't needed again: the engine now holds the vault's key.
      setTypedSyncVaultPassphrase('')
      setRepeatedSyncVaultPassphrase('')
      setNewSyncVaultEncryptionChoice(null)
      return
    }
    setChangeEncryptionRunState({
      changeEncryptionRunKind: 'failed',
      failedSyncVaultEncryptionChangeStep: syncVaultEncryptionChangeOutcome.failedSyncVaultEncryptionChangeStep,
      changeEncryptionFailureWords: describePapelizSyncActionFailureNow(syncVaultEncryptionChangeOutcome.failedSyncActionOutcome),
    })
  }
  const followChangeEncryptionStep = (runningSyncVaultEncryptionChangeStep: PapelizSyncVaultEncryptionChangeStep) =>
    setChangeEncryptionRunState({ changeEncryptionRunKind: 'running', runningSyncVaultEncryptionChangeStep })

  const startChangingEncryption = () => {
    const chosenSyncVaultEncryptionChoice: PapelizSyncVaultEncryptionChoice = isGoingEndToEnd
      ? { syncVaultEncryptionKind: 'end-to-end', syncVaultPassphrase: typedSyncVaultPassphrase }
      : { syncVaultEncryptionKind: 'standard' }
    setNewSyncVaultEncryptionChoice(chosenSyncVaultEncryptionChoice)
    setChangeEncryptionDialogStep('syncing-again')
    void changePapelizSyncVaultEncryption(
      papelizSyncEngine,
      { papelizVaultId, papelizSyncVaultId, newSyncVaultEncryptionChoice: chosenSyncVaultEncryptionChoice },
      followChangeEncryptionStep,
    ).then(followChangeEncryptionOutcome)
  }
  const tryChangingEncryptionAgain = () => {
    if (changeEncryptionRunState.changeEncryptionRunKind !== 'failed') return
    if (changeEncryptionRunState.failedSyncVaultEncryptionChangeStep === 'turning-sync-on' && newSyncVaultEncryptionChoice !== null) {
      void turnPapelizSyncOnAgainWithOtherEncryption(papelizSyncEngine, papelizVaultId, newSyncVaultEncryptionChoice, followChangeEncryptionStep).then(followChangeEncryptionOutcome)
      return
    }
    startChangingEncryption()
  }

  const dialogFrameProps = {
    syncDialogTitleId: 'papeliz-sync-change-encryption-dialog-title',
    SyncDialogIcon: RefreshCw,
    syncDialogSteps: (
      <PapelizSyncDialogSteps
        syncDialogStepLabels={readChangeEncryptionStepLabels(newSyncVaultEncryptionKind)}
        currentSyncDialogStepIndex={
          changeEncryptionDialogStep === 'what-happens' ? 0 : changeEncryptionDialogStep === 'passphrase' ? 1 : readChangeEncryptionStepLabels(newSyncVaultEncryptionKind).length - 1
        }
      />
    ),
    isSyncDialogDrawnInPlace,
    onSyncDialogCancel: () => {
      if (!isChangeEncryptionRunning) closePapelizSyncSetUpDialog()
    },
  }
  const deleteAndSyncAgainButton = (isDeleteAndSyncAgainReady: boolean) => (
    <PapelizPillButton pillButtonVariant="red-primary" disabled={!isDeleteAndSyncAgainReady} onClick={startChangingEncryption}>
      Delete and Sync Again
    </PapelizPillButton>
  )

  // 1. What happens, before anything changes.
  if (changeEncryptionDialogStep === 'what-happens') {
    return (
      <PapelizSyncDialogFrame
        {...dialogFrameProps}
        syncDialogTitle={`Change “${syncVaultName}” to ${newSyncVaultEncryptionKindName}?`}
        syncDialogFooter={
          <>
            <PapelizPillButton pillButtonVariant="gray" onClick={closePapelizSyncSetUpDialog}>
              Cancel
            </PapelizPillButton>
            {isGoingEndToEnd ? (
              <PapelizPillButton pillButtonVariant="primary" onClick={() => setChangeEncryptionDialogStep('passphrase')}>
                Continue
              </PapelizPillButton>
            ) : (
              deleteAndSyncAgainButton(true)
            )}
          </>
        }
      >
        <ul className="mt-4 flex list-disc flex-col gap-1.5 pl-5 text-[13px] leading-[1.45] text-papeliz-ink-muted">
          <li>
            Its synced copy and its old versions are deleted from Sync, then it uploads again,{' '}
            {isGoingEndToEnd ? 'locked with a passphrase only you know.' : 'with a key Papeliz keeps, so it needs no passphrase.'}
          </li>
          <li>The notes on this device don’t change.</li>
          <li>Your other devices stop syncing it. On each, download it again from Synced Vaults{isGoingEndToEnd ? ' and type the passphrase' : ''}.</li>
        </ul>
      </PapelizSyncDialogFrame>
    )
  }

  // 2. End-to-end: its passphrase, twice.
  if (changeEncryptionDialogStep === 'passphrase') {
    const isNewPassphraseReady = isPapelizSyncNewPassphraseReady(typedSyncVaultPassphrase, repeatedSyncVaultPassphrase)
    return (
      <PapelizSyncDialogFrame
        {...dialogFrameProps}
        syncDialogTitle={`Choose a Passphrase for “${syncVaultName}”`}
        syncDialogIntro="It locks this vault before anything leaves this device. You type it once on each device that downloads it."
        syncDialogFooter={
          <>
            <PapelizPillButton
              pillButtonVariant="gray"
              onClick={() => {
                setTypedSyncVaultPassphrase('')
                setRepeatedSyncVaultPassphrase('')
                setChangeEncryptionDialogStep('what-happens')
              }}
            >
              Back
            </PapelizPillButton>
            {deleteAndSyncAgainButton(isNewPassphraseReady)}
          </>
        }
      >
        <form
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault()
            if (isNewPassphraseReady) startChangingEncryption()
          }}
        >
          <PapelizSyncNewPassphraseFields
            newSyncPassphrase={typedSyncVaultPassphrase}
            onNewSyncPassphraseChange={setTypedSyncVaultPassphrase}
            repeatedSyncPassphrase={repeatedSyncVaultPassphrase}
            onRepeatedSyncPassphraseChange={setRepeatedSyncVaultPassphrase}
            newSyncPassphraseFieldLabel="Passphrase"
          />
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-papeliz-warning px-3 py-2.5 text-[12.5px] leading-[1.45] text-papeliz-warning-ink">
          <TriangleAlert className="mt-0.5 size-[15px] flex-none" aria-hidden="true" />
          <span>{papelizSyncVaultPassphraseNotRecoverableLine}</span>
        </p>
      </PapelizSyncDialogFrame>
    )
  }

  // 3. Syncing again: the synced copy deleted, Sync on again, then the upload's progress.
  const vaultSyncReading = syncEngineSnapshot.syncLocalVaults.find((syncLocalVault) => syncLocalVault.papelizVaultId === papelizVaultId)
  const syncVaultTransferProgress = vaultSyncReading?.syncVaultTransferProgress ?? null
  const isChanged = changeEncryptionRunState.changeEncryptionRunKind === 'changed'
  const isUploadDone = isChanged && vaultSyncReading !== undefined && syncVaultTransferProgress === null && vaultSyncReading.syncVaultStatus.syncStatusKind !== 'syncing'
  const isSyncedCopyDeleted =
    isChanged ||
    (changeEncryptionRunState.changeEncryptionRunKind === 'running' && changeEncryptionRunState.runningSyncVaultEncryptionChangeStep === 'turning-sync-on') ||
    (changeEncryptionRunState.changeEncryptionRunKind === 'failed' && changeEncryptionRunState.failedSyncVaultEncryptionChangeStep === 'turning-sync-on')
  const changeEncryptionFailureLine =
    changeEncryptionRunState.changeEncryptionRunKind !== 'failed'
      ? null
      : changeEncryptionRunState.failedSyncVaultEncryptionChangeStep === 'deleting-synced-copy'
        ? `Nothing changed: the synced copy couldn’t be deleted. ${changeEncryptionRunState.changeEncryptionFailureWords}`
        : `The synced copy was deleted, but Sync didn’t turn on again, so “${syncVaultName}” doesn’t sync for now. ${changeEncryptionRunState.changeEncryptionFailureWords}`
  return (
    <PapelizSyncDialogFrame
      {...dialogFrameProps}
      syncDialogTitle={isUploadDone ? `“${syncVaultName}” Is ${newSyncVaultEncryptionKindName} Now` : `Changing “${syncVaultName}” to ${newSyncVaultEncryptionKindName}`}
      syncDialogIntro={
        isUploadDone
          ? `It synced again${isGoingEndToEnd ? ', locked with your passphrase' : ''}. On your other devices, download it again from Synced Vaults.`
          : isChanged
            ? 'You can close this: it goes on in the background, and the status bar shows how far it is.'
            : undefined
      }
      syncDialogFooter={
        changeEncryptionRunState.changeEncryptionRunKind === 'failed' ? (
          <>
            <PapelizPillButton pillButtonVariant="gray" onClick={closePapelizSyncSetUpDialog}>
              Close
            </PapelizPillButton>
            <PapelizPillButton pillButtonVariant="primary" onClick={tryChangingEncryptionAgain}>
              Try Again
            </PapelizPillButton>
          </>
        ) : (
          <PapelizPillButton pillButtonVariant={isUploadDone ? 'primary' : 'gray'} disabled={isChangeEncryptionRunning} onClick={closePapelizSyncSetUpDialog}>
            {isUploadDone ? 'Done' : 'Close'}
          </PapelizPillButton>
        )
      }
    >
      {!isUploadDone && (
        <div className="mt-4 flex flex-col gap-2.5 text-[13px]" role="status">
          <p className="flex items-center gap-2">
            {isSyncedCopyDeleted ? (
              <CircleCheck className="size-4 flex-none text-papeliz-ok" aria-hidden="true" />
            ) : (
              <PapelizLoadingRing />
            )}
            {isSyncedCopyDeleted ? 'Synced copy deleted' : <PapelizLoadingWords loadingWords="Deleting the synced copy…" />}
          </p>
          {isSyncedCopyDeleted && changeEncryptionRunState.changeEncryptionRunKind !== 'failed' && (
            <div>
              {syncVaultTransferProgress === null ? (
                <p className="flex items-center gap-2">
                  <PapelizLoadingRing />
                  <PapelizLoadingWords loadingWords={`Turning Sync on again, ${newSyncVaultEncryptionKindName}…`} />
                </p>
              ) : (
                <PapelizSyncTransferReadout
                  syncTransferWords={`Uploading${isGoingEndToEnd ? ', locked with the passphrase' : ''}`}
                  syncTransferredFileCount={syncVaultTransferProgress.syncTransferredFileCount}
                  syncTransferFileCount={syncVaultTransferProgress.syncTransferFileCount}
                />
              )}
            </div>
          )}
        </div>
      )}
      {changeEncryptionFailureLine !== null && <PapelizSyncFailureLine className="mt-3">{changeEncryptionFailureLine}</PapelizSyncFailureLine>}
    </PapelizSyncDialogFrame>
  )
}
