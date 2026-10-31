import { CloudUpload, KeyRound, LoaderCircle, Lock, ShieldCheck, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import type { PapelizSyncActionOutcome, PapelizSyncEngine, PapelizSyncEngineSnapshot, PapelizSyncVaultEncryptionKind } from './papeliz-sync-engine-contract'
import { closePapelizSyncSetUpDialog, describePapelizSyncSignInFromClickFailure, startPapelizSyncSignInFromClick, type PapelizSyncSetUpDialogRequest } from './papeliz-sync-flow-store'
import { isPapelizSyncNewPassphraseReady, PapelizSyncNewPassphraseFields } from './papeliz-sync-passphrase-fields'
import { PapelizSyncDialogFrame, PapelizSyncDialogSteps, PapelizSyncFailureLine, PapelizSyncLoadingLine, PapelizSyncProgressBar } from './papeliz-sync-page-parts'
import {
  describePapelizSyncActionFailureNow,
  papelizSyncVaultEncryptionKindDisplayNames,
  papelizSyncVaultEncryptionKindReaderLines,
  papelizSyncVaultNameReadableLine,
  papelizSyncVaultPassphraseNotRecoverableLine,
} from './papeliz-sync-screen-words'

// The set-up dialog. Turn on Sync for this vault: Standard (selected) or End-to-end, the passphrase
// typed twice for End-to-end, then the first upload. Change passphrase: a new one for an End-to-end
// vault this device holds the key of. A passphrase passes straight to the engine and is kept only
// while typed.

type PapelizSyncSetUpStep =
  | { syncSetUpStepKind: 'encryption-kind' }
  | { syncSetUpStepKind: 'vault-passphrase' }
  | { syncSetUpStepKind: 'first-transfer'; transferredPapelizVaultId: string }
  | { syncSetUpStepKind: 'new-vault-passphrase' }
  | { syncSetUpStepKind: 'vault-passphrase-changed' }

type PapelizSyncSetUpActionState =
  | { setUpActionKind: 'idle' }
  | { setUpActionKind: 'running' }
  | { setUpActionKind: 'failed'; setUpFailureWords: string }
  // Changing a passphrase needs a sign-in from the last few minutes.
  | { setUpActionKind: 'fresh-sign-in-needed'; retrySetUpActionAfterSignIn: () => Promise<void> }

const papelizSyncEncryptionKindIcons: Record<PapelizSyncVaultEncryptionKind, LucideIcon> = {
  standard: ShieldCheck,
  'end-to-end': Lock,
}

function readTurnOnStepLabels(chosenSyncVaultEncryptionKind: PapelizSyncVaultEncryptionKind): readonly string[] {
  return chosenSyncVaultEncryptionKind === 'end-to-end' ? ['Encryption', 'Passphrase', 'Upload'] : ['Encryption', 'Upload']
}

function readTurnOnStepIndex(syncSetUpStep: PapelizSyncSetUpStep, chosenSyncVaultEncryptionKind: PapelizSyncVaultEncryptionKind): number {
  if (syncSetUpStep.syncSetUpStepKind === 'encryption-kind') return 0
  if (syncSetUpStep.syncSetUpStepKind === 'vault-passphrase') return 1
  return readTurnOnStepLabels(chosenSyncVaultEncryptionKind).length - 1
}

// The warning under every new End-to-end passphrase.
function PapelizSyncPassphraseNotRecoverableNote() {
  return (
    <p className="mt-3 flex items-start gap-2 rounded-xl bg-papeliz-warning px-3 py-2.5 text-[12.5px] leading-[1.45] text-papeliz-warning-ink">
      <TriangleAlert className="mt-0.5 size-[15px] flex-none" aria-hidden="true" />
      <span>{papelizSyncVaultPassphraseNotRecoverableLine}</span>
    </p>
  )
}

interface PapelizSyncSetUpDialogProps {
  papelizSyncEngine: PapelizSyncEngine
  syncEngineSnapshot: PapelizSyncEngineSnapshot
  syncSetUpDialogRequest: PapelizSyncSetUpDialogRequest
  isSyncDialogDrawnInPlace: boolean
}

export function PapelizSyncSetUpDialog({ papelizSyncEngine, syncEngineSnapshot, syncSetUpDialogRequest, isSyncDialogDrawnInPlace }: PapelizSyncSetUpDialogProps) {
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)
  const isOpenVaultSyncable = openVault !== null && openVault.papelizVaultAdapter.papelizVaultKind !== 'sample-vault-in-memory'
  const openVaultSyncReading =
    openVault === null ? undefined : syncEngineSnapshot.syncLocalVaults.find((syncLocalVault) => syncLocalVault.papelizVaultId === openVault.papelizVaultId)
  const [syncSetUpStep, setSyncSetUpStep] = useState<PapelizSyncSetUpStep>(() => {
    if (syncSetUpDialogRequest.syncSetUpDialogKind === 'change-vault-passphrase') return { syncSetUpStepKind: 'new-vault-passphrase' }
    // An open vault that already syncs needs no choice: its upload shows.
    if (openVault !== null && openVaultSyncReading !== undefined) return { syncSetUpStepKind: 'first-transfer', transferredPapelizVaultId: openVault.papelizVaultId }
    return { syncSetUpStepKind: 'encryption-kind' }
  })
  const [setUpActionState, setSetUpActionState] = useState<PapelizSyncSetUpActionState>({ setUpActionKind: 'idle' })
  const [chosenSyncVaultEncryptionKind, setChosenSyncVaultEncryptionKind] = useState<PapelizSyncVaultEncryptionKind>('standard')
  const [typedSyncVaultPassphrase, setTypedSyncVaultPassphrase] = useState('')
  const [repeatedSyncVaultPassphrase, setRepeatedSyncVaultPassphrase] = useState('')
  const isSetUpActionRunning = setUpActionState.setUpActionKind === 'running'

  const forgetTypedPassphrase = () => {
    setTypedSyncVaultPassphrase('')
    setRepeatedSyncVaultPassphrase('')
  }

  const runSetUpAction = async <SyncActionDoneValue,>(
    syncSetUpAction: () => Promise<PapelizSyncActionOutcome<SyncActionDoneValue>>,
    onSetUpActionDone: (syncActionDoneValue: SyncActionDoneValue) => void,
  ): Promise<void> => {
    setSetUpActionState({ setUpActionKind: 'running' })
    const setUpActionOutcome = await syncSetUpAction()
    if (setUpActionOutcome.syncActionOutcome === 'done') {
      setSetUpActionState({ setUpActionKind: 'idle' })
      onSetUpActionDone(setUpActionOutcome.syncActionDoneValue)
      return
    }
    if (setUpActionOutcome.syncActionFailureKind === 'fresh-sign-in-required') {
      setSetUpActionState({ setUpActionKind: 'fresh-sign-in-needed', retrySetUpActionAfterSignIn: () => runSetUpAction(syncSetUpAction, onSetUpActionDone) })
      return
    }
    setSetUpActionState({ setUpActionKind: 'failed', setUpFailureWords: describePapelizSyncActionFailureNow(setUpActionOutcome) })
  }

  const setUpActionLine =
    setUpActionState.setUpActionKind === 'failed' ? (
      <PapelizSyncFailureLine className="mt-3">{setUpActionState.setUpFailureWords}</PapelizSyncFailureLine>
    ) : setUpActionState.setUpActionKind === 'fresh-sign-in-needed' ? (
      <div className="mt-3 rounded-xl border border-papeliz-blue-line bg-papeliz-blue-soft px-3 py-2.5 text-[12.5px] leading-[1.45]">
        <p className="font-semibold">Sign in again to continue</p>
        <p className="mt-0.5">This needs a sign-in from the last 10 minutes, so Papeliz knows it’s you. The sign-in page opens in a new tab, then this carries on.</p>
        <PapelizPillButton
          pillButtonVariant="primary"
          pillButtonSize="small"
          className="mt-2"
          onClick={() => {
            const retrySetUpActionAfterSignIn = setUpActionState.retrySetUpActionAfterSignIn
            setSetUpActionState({ setUpActionKind: 'running' })
            void startPapelizSyncSignInFromClick(papelizSyncEngine, null).then((signInFromClickOutcome) => {
              if (signInFromClickOutcome.syncSignInOutcome === 'signed-in') return retrySetUpActionAfterSignIn()
              setSetUpActionState({
                setUpActionKind: 'failed',
                setUpFailureWords: describePapelizSyncSignInFromClickFailure(signInFromClickOutcome) ?? 'Signing in was cancelled, so nothing changed.',
              })
            })
          }}
        >
          Sign in again
        </PapelizPillButton>
      </div>
    ) : null

  const runningButtonContent = (buttonLabel: string): ReactNode =>
    isSetUpActionRunning ? (
      <>
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        {buttonLabel}
      </>
    ) : (
      buttonLabel
    )

  const isTurnOnDialog = syncSetUpDialogRequest.syncSetUpDialogKind === 'turn-on-vault-sync'
  const dialogFrameProps = {
    syncDialogTitleId: 'papeliz-sync-set-up-dialog-title',
    SyncDialogIcon: isTurnOnDialog ? CloudUpload : KeyRound,
    syncDialogSteps:
      isTurnOnDialog && isOpenVaultSyncable ? (
        <PapelizSyncDialogSteps
          syncDialogStepLabels={readTurnOnStepLabels(chosenSyncVaultEncryptionKind)}
          currentSyncDialogStepIndex={readTurnOnStepIndex(syncSetUpStep, chosenSyncVaultEncryptionKind)}
        />
      ) : undefined,
    isSyncDialogDrawnInPlace,
    onSyncDialogCancel: () => {
      if (!isSetUpActionRunning) closePapelizSyncSetUpDialog()
    },
  }
  const notNowButton = (
    <PapelizPillButton pillButtonVariant="gray" disabled={isSetUpActionRunning} onClick={closePapelizSyncSetUpDialog}>
      Not now
    </PapelizPillButton>
  )

  // Change passphrase: the new one twice, for a vault this device holds the key of.
  if (syncSetUpDialogRequest.syncSetUpDialogKind === 'change-vault-passphrase') {
    const { papelizSyncVaultId, syncVaultName } = syncSetUpDialogRequest
    if (syncSetUpStep.syncSetUpStepKind === 'vault-passphrase-changed') {
      return (
        <PapelizSyncDialogFrame
          {...dialogFrameProps}
          syncDialogTitle="The passphrase is changed"
          syncDialogIntro={`Use the new one when a device asks for “${syncVaultName}”.`}
          syncDialogFooter={
            <PapelizPillButton pillButtonVariant="primary" onClick={closePapelizSyncSetUpDialog}>
              Done
            </PapelizPillButton>
          }
        />
      )
    }
    const isNewPassphraseReady = isPapelizSyncNewPassphraseReady(typedSyncVaultPassphrase, repeatedSyncVaultPassphrase)
    const changeVaultPassphrase = () => {
      const newSyncVaultPassphrase = typedSyncVaultPassphrase
      void runSetUpAction(
        () => papelizSyncEngine.changeSyncVaultPassphrase(papelizSyncVaultId, newSyncVaultPassphrase),
        () => {
          forgetTypedPassphrase()
          setSyncSetUpStep({ syncSetUpStepKind: 'vault-passphrase-changed' })
        },
      )
    }
    return (
      <PapelizSyncDialogFrame
        {...dialogFrameProps}
        syncDialogTitle={`Change the passphrase for “${syncVaultName}”`}
        syncDialogIntro="Devices that already have this vault stay unlocked; a device that downloads it later uses the new one. Nothing uploads again."
        syncDialogFooter={
          <>
            <PapelizPillButton pillButtonVariant="gray" disabled={isSetUpActionRunning} onClick={closePapelizSyncSetUpDialog}>
              Cancel
            </PapelizPillButton>
            <PapelizPillButton pillButtonVariant="primary" disabled={!isNewPassphraseReady || isSetUpActionRunning} onClick={changeVaultPassphrase}>
              {runningButtonContent('Change passphrase')}
            </PapelizPillButton>
          </>
        }
      >
        <form
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault()
            if (isNewPassphraseReady && !isSetUpActionRunning) changeVaultPassphrase()
          }}
        >
          <PapelizSyncNewPassphraseFields
            newSyncPassphrase={typedSyncVaultPassphrase}
            onNewSyncPassphraseChange={setTypedSyncVaultPassphrase}
            repeatedSyncPassphrase={repeatedSyncVaultPassphrase}
            onRepeatedSyncPassphraseChange={setRepeatedSyncVaultPassphrase}
            newSyncPassphraseFieldLabel="New passphrase"
          />
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
        <PapelizSyncPassphraseNotRecoverableNote />
        {setUpActionLine}
      </PapelizSyncDialogFrame>
    )
  }

  // No vault to turn Sync on for: the sample vault, or none open.
  if (!isOpenVaultSyncable || openVault === null) {
    return (
      <PapelizSyncDialogFrame
        {...dialogFrameProps}
        syncDialogTitle="Turn on Sync for a vault"
        syncDialogIntro="Open a folder or a browser vault, then turn Sync on for it in Settings."
        syncDialogFooter={
          <PapelizPillButton pillButtonVariant="primary" onClick={closePapelizSyncSetUpDialog}>
            Done
          </PapelizPillButton>
        }
      />
    )
  }

  const openVaultName = openVault.papelizVaultDisplayName
  const papelizVaultId = openVault.papelizVaultId
  const startSyncingOpenVault = () => {
    const syncVaultPassphrase = typedSyncVaultPassphrase
    void runSetUpAction(
      () =>
        papelizSyncEngine.turnSyncOnForVault(
          papelizVaultId,
          chosenSyncVaultEncryptionKind === 'end-to-end' ? { syncVaultEncryptionKind: 'end-to-end', syncVaultPassphrase } : { syncVaultEncryptionKind: 'standard' },
        ),
      () => {
        forgetTypedPassphrase()
        setSyncSetUpStep({ syncSetUpStepKind: 'first-transfer', transferredPapelizVaultId: papelizVaultId })
      },
    )
  }

  // 1. Who can read it: Standard (selected) or End-to-end.
  if (syncSetUpStep.syncSetUpStepKind === 'encryption-kind') {
    return (
      <PapelizSyncDialogFrame
        {...dialogFrameProps}
        syncDialogTitle="Turn on Sync for this vault"
        syncDialogIntro={`“${openVaultName}” uploads encrypted, and your other devices can download it. Choose who can read it.`}
        syncDialogFooter={
          <>
            {notNowButton}
            <PapelizPillButton
              pillButtonVariant="primary"
              disabled={isSetUpActionRunning}
              onClick={() => {
                if (chosenSyncVaultEncryptionKind === 'standard') {
                  startSyncingOpenVault()
                  return
                }
                setSetUpActionState({ setUpActionKind: 'idle' })
                setSyncSetUpStep({ syncSetUpStepKind: 'vault-passphrase' })
              }}
            >
              {runningButtonContent(chosenSyncVaultEncryptionKind === 'standard' ? 'Start syncing' : 'Continue')}
            </PapelizPillButton>
          </>
        }
      >
        <div className="mt-4 flex flex-col gap-2" role="radiogroup" aria-label={`Who can read “${openVaultName}”`}>
          {(['standard', 'end-to-end'] as const).map((syncVaultEncryptionKind) => {
            const EncryptionKindIcon = papelizSyncEncryptionKindIcons[syncVaultEncryptionKind]
            const isEncryptionKindChosen = syncVaultEncryptionKind === chosenSyncVaultEncryptionKind
            return (
              <label
                key={syncVaultEncryptionKind}
                className={joinPapelizClassNames(
                  'flex cursor-pointer items-start gap-2.5 rounded-2xl border px-3 py-2.5 transition-colors',
                  isEncryptionKindChosen ? 'border-papeliz-blue-line bg-papeliz-blue-soft' : 'border-papeliz-line bg-papeliz-surface hover:bg-papeliz-hover',
                )}
              >
                <input
                  type="radio"
                  name="papeliz-sync-vault-encryption-kind"
                  checked={isEncryptionKindChosen}
                  disabled={isSetUpActionRunning}
                  onChange={() => setChosenSyncVaultEncryptionKind(syncVaultEncryptionKind)}
                  className="mt-[3px] size-[15px] flex-none accent-papeliz-blue"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
                    <EncryptionKindIcon className="size-[15px] flex-none text-papeliz-blue" aria-hidden="true" />
                    {papelizSyncVaultEncryptionKindDisplayNames[syncVaultEncryptionKind]}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-[1.45] text-papeliz-ink-muted">{papelizSyncVaultEncryptionKindReaderLines[syncVaultEncryptionKind]}</span>
                </span>
              </label>
            )
          })}
        </div>
        <p className="mt-3 text-[12px] leading-[1.45] text-papeliz-ink-subtle">
          {papelizSyncVaultNameReadableLine} To switch later, delete it from Sync and turn Sync on again.
        </p>
        {setUpActionLine}
      </PapelizSyncDialogFrame>
    )
  }

  // 2. End-to-end: its passphrase, twice.
  if (syncSetUpStep.syncSetUpStepKind === 'vault-passphrase') {
    const isNewPassphraseReady = isPapelizSyncNewPassphraseReady(typedSyncVaultPassphrase, repeatedSyncVaultPassphrase)
    return (
      <PapelizSyncDialogFrame
        {...dialogFrameProps}
        syncDialogTitle={`Choose a passphrase for “${openVaultName}”`}
        syncDialogIntro="It locks this vault before anything leaves this device. You type it once on each device that downloads the vault."
        syncDialogFooter={
          <>
            <PapelizPillButton
              pillButtonVariant="gray"
              disabled={isSetUpActionRunning}
              onClick={() => {
                forgetTypedPassphrase()
                setSetUpActionState({ setUpActionKind: 'idle' })
                setSyncSetUpStep({ syncSetUpStepKind: 'encryption-kind' })
              }}
            >
              Back
            </PapelizPillButton>
            <PapelizPillButton pillButtonVariant="primary" disabled={!isNewPassphraseReady || isSetUpActionRunning} onClick={startSyncingOpenVault}>
              {runningButtonContent('Start syncing')}
            </PapelizPillButton>
          </>
        }
      >
        <form
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault()
            if (isNewPassphraseReady && !isSetUpActionRunning) startSyncingOpenVault()
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
        <PapelizSyncPassphraseNotRecoverableNote />
        {setUpActionLine}
      </PapelizSyncDialogFrame>
    )
  }

  // 3. The first upload, with its progress. It goes on with the dialog closed.
  const transferredPapelizVaultId = syncSetUpStep.syncSetUpStepKind === 'first-transfer' ? syncSetUpStep.transferredPapelizVaultId : papelizVaultId
  const transferredVaultReading = syncEngineSnapshot.syncLocalVaults.find((syncLocalVault) => syncLocalVault.papelizVaultId === transferredPapelizVaultId) ?? openVaultSyncReading
  const transferredVaultName = papelizVaultId === transferredPapelizVaultId ? openVaultName : 'This vault'
  const syncVaultTransferProgress = transferredVaultReading?.syncVaultTransferProgress ?? null
  const isTransferDone = transferredVaultReading !== undefined && syncVaultTransferProgress === null && transferredVaultReading.syncVaultStatus.syncStatusKind !== 'syncing'
  return (
    <PapelizSyncDialogFrame
      {...dialogFrameProps}
      syncDialogTitle={isTransferDone ? `“${transferredVaultName}” syncs` : `Syncing “${transferredVaultName}”`}
      syncDialogIntro={
        isTransferDone
          ? 'It’s up to date. Changes now sync by themselves while the vault is open; the status bar shows where they stand.'
          : 'You can close this: it goes on in the background, and the status bar shows how far it is.'
      }
      syncDialogFooter={
        <PapelizPillButton pillButtonVariant={isTransferDone ? 'primary' : 'gray'} onClick={closePapelizSyncSetUpDialog}>
          {isTransferDone ? 'Done' : 'Close'}
        </PapelizPillButton>
      }
    >
      {!isTransferDone && (
        <div className="mt-5">
          {syncVaultTransferProgress === null ? (
            <PapelizSyncLoadingLine>Getting ready…</PapelizSyncLoadingLine>
          ) : (
            <>
              <PapelizSyncProgressBar
                syncProgressLabel="First upload"
                syncProgressFraction={syncVaultTransferProgress.syncTransferFileCount === 0 ? 1 : syncVaultTransferProgress.syncTransferredFileCount / syncVaultTransferProgress.syncTransferFileCount}
              />
              <p className="mt-1.5 text-[12px] text-papeliz-ink-subtle tabular-nums" role="status">
                {syncVaultTransferProgress.syncTransferredFileCount.toLocaleString('en-US')} of {syncVaultTransferProgress.syncTransferFileCount.toLocaleString('en-US')} files
              </p>
            </>
          )}
        </div>
      )}
    </PapelizSyncDialogFrame>
  )
}
