import { Check, Copy, Download, KeyRound, LoaderCircle } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import type { PapelizSyncAccountKeyDraft, PapelizSyncAccountVaultReading, PapelizSyncActionOutcome, PapelizSyncEngine, PapelizSyncEngineSnapshot } from './papeliz-sync-engine-contract'
import { closePapelizSyncSetUpDialog, describePapelizSyncSignInFromClickFailure, openPapelizSyncSetUpDialog, startPapelizSyncSignInFromClick, type PapelizSyncSetUpDialogMode } from './papeliz-sync-flow-store'
import { isPapelizSyncNewPassphraseReady, PapelizSyncNewPassphraseFields, PapelizSyncPassphraseField, papelizSyncTextFieldClassName } from './papeliz-sync-passphrase-fields'
import { PapelizSyncDialogFrame, PapelizSyncDialogSteps, PapelizSyncFailureLine, PapelizSyncLoadingLine, PapelizSyncProgressBar, PapelizSyncTextButton } from './papeliz-sync-page-parts'
import { buildPapelizSyncRecoveryKitText, describePapelizSyncActionFailureNow, formatPapelizSyncByteSize, groupPapelizSyncRecoveryKeyText } from './papeliz-sync-screen-words'

// The set-up dialog (B): on the first device a Sync passphrase, the Recovery Key, then which vaults
// sync and the first upload. A second device unlocks with the passphrase (or the Recovery Key) and
// then picks what its open vault does. Start over and Change passphrase use the same dialog. The
// passphrase and the Recovery Key pass straight to the engine and are kept only while typed.

type PapelizSyncSetUpStep =
  | { syncSetUpStepKind: 'passphrase' }
  | { syncSetUpStepKind: 'recovery-key-unlock' }
  | { syncSetUpStepKind: 'recovery-key'; syncAccountKeyDraft: PapelizSyncAccountKeyDraft }
  | { syncSetUpStepKind: 'vaults' }
  | { syncSetUpStepKind: 'first-transfer'; transferredPapelizVaultId: string }
  | { syncSetUpStepKind: 'passphrase-changed' }

type PapelizSyncSetUpActionState =
  | { setUpActionKind: 'idle' }
  | { setUpActionKind: 'running' }
  | { setUpActionKind: 'failed'; setUpFailureWords: string }
  // Changing the passphrase and Start over need a sign-in from the last few minutes.
  | { setUpActionKind: 'fresh-sign-in-needed'; retrySetUpActionAfterSignIn: () => Promise<void> }

// What the open vault does after unlocking: sync as a vault of its own, join (Connect) one of the
// account's synced vaults, or nothing for now.
type PapelizSyncOpenVaultChoice = { openVaultChoiceKind: 'sync-as-new' } | { openVaultChoiceKind: 'connect'; papelizSyncVaultId: string } | { openVaultChoiceKind: 'not-now' }

function isSameOpenVaultChoice(firstOpenVaultChoice: PapelizSyncOpenVaultChoice, secondOpenVaultChoice: PapelizSyncOpenVaultChoice): boolean {
  if (firstOpenVaultChoice.openVaultChoiceKind === 'connect' && secondOpenVaultChoice.openVaultChoiceKind === 'connect') {
    return firstOpenVaultChoice.papelizSyncVaultId === secondOpenVaultChoice.papelizSyncVaultId
  }
  return firstOpenVaultChoice.openVaultChoiceKind === secondOpenVaultChoice.openVaultChoiceKind
}

const papelizSyncSetUpStepLabels: Record<PapelizSyncSetUpDialogMode, readonly string[]> = {
  'set-up': ['Passphrase', 'Recovery Key', 'Vaults'],
  'start-over': ['New passphrase', 'Recovery Key', 'Vaults'],
  unlock: ['Passphrase', 'Vaults'],
  'change-passphrase': [],
}

function readSetUpStepIndex(syncSetUpDialogMode: PapelizSyncSetUpDialogMode, syncSetUpStep: PapelizSyncSetUpStep): number {
  if (syncSetUpStep.syncSetUpStepKind === 'passphrase' || syncSetUpStep.syncSetUpStepKind === 'recovery-key-unlock') return 0
  if (syncSetUpStep.syncSetUpStepKind === 'recovery-key') return 1
  return syncSetUpDialogMode === 'unlock' ? 1 : 2
}

function downloadPapelizSyncRecoveryKit(recoveryKitText: string): void {
  const recoveryKitUrl = URL.createObjectURL(new Blob([recoveryKitText], { type: 'text/plain;charset=utf-8' }))
  const recoveryKitLink = document.createElement('a')
  recoveryKitLink.href = recoveryKitUrl
  recoveryKitLink.download = 'Papeliz Sync Recovery Kit.txt'
  recoveryKitLink.click()
  setTimeout(() => URL.revokeObjectURL(recoveryKitUrl), 10_000)
}

interface PapelizSyncSetUpDialogProps {
  papelizSyncEngine: PapelizSyncEngine
  syncEngineSnapshot: PapelizSyncEngineSnapshot
  syncSetUpDialogMode: PapelizSyncSetUpDialogMode
  isSyncDialogDrawnInPlace: boolean
}

export function PapelizSyncSetUpDialog({ papelizSyncEngine, syncEngineSnapshot, syncSetUpDialogMode, isSyncDialogDrawnInPlace }: PapelizSyncSetUpDialogProps) {
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)
  const [syncSetUpStep, setSyncSetUpStep] = useState<PapelizSyncSetUpStep>({ syncSetUpStepKind: 'passphrase' })
  const [setUpActionState, setSetUpActionState] = useState<PapelizSyncSetUpActionState>({ setUpActionKind: 'idle' })
  const [typedSyncPassphrase, setTypedSyncPassphrase] = useState('')
  const [repeatedSyncPassphrase, setRepeatedSyncPassphrase] = useState('')
  const [typedRecoveryKeyText, setTypedRecoveryKeyText] = useState('')
  const [isRecoveryKeySavedTicked, setIsRecoveryKeySavedTicked] = useState(false)
  const [isRecoveryKeyCopied, setIsRecoveryKeyCopied] = useState(false)
  const [accountVaultsOutcome, setAccountVaultsOutcome] = useState<PapelizSyncActionOutcome<PapelizSyncAccountVaultReading[]> | null>(null)
  const [openVaultChoice, setOpenVaultChoice] = useState<PapelizSyncOpenVaultChoice | null>(
    syncSetUpDialogMode === 'unlock' ? null : { openVaultChoiceKind: 'sync-as-new' },
  )
  const isSetUpActionRunning = setUpActionState.setUpActionKind === 'running'
  const isOpenVaultSyncable = openVault !== null && openVault.papelizVaultAdapter.papelizVaultKind !== 'sample-vault-in-memory'
  const openVaultSyncReading =
    openVault === null ? undefined : syncEngineSnapshot.syncLocalVaults.find((syncLocalVault) => syncLocalVault.papelizVaultId === openVault.papelizVaultId)

  const forgetTypedSecrets = () => {
    setTypedSyncPassphrase('')
    setRepeatedSyncPassphrase('')
    setTypedRecoveryKeyText('')
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

  // The account's synced vaults, for a second device's Connect.
  const isVaultsStepShown = syncSetUpStep.syncSetUpStepKind === 'vaults'
  useEffect(() => {
    if (!isVaultsStepShown || syncSetUpDialogMode !== 'unlock') return
    let isVaultsStepLeft = false
    void papelizSyncEngine.listSyncedVaultsOnAccount().then((listedAccountVaultsOutcome) => {
      if (!isVaultsStepLeft) setAccountVaultsOutcome(listedAccountVaultsOutcome)
    })
    return () => {
      isVaultsStepLeft = true
    }
  }, [isVaultsStepShown, syncSetUpDialogMode, papelizSyncEngine])

  const goToVaultsStep = () => {
    forgetTypedSecrets()
    // An open vault that already syncs needs no choice.
    if (openVault !== null && papelizSyncEngine.getSyncEngineSnapshot().syncLocalVaults.some((syncLocalVault) => syncLocalVault.papelizVaultId === openVault.papelizVaultId)) {
      setSyncSetUpStep({ syncSetUpStepKind: 'first-transfer', transferredPapelizVaultId: openVault.papelizVaultId })
      return
    }
    setSyncSetUpStep({ syncSetUpStepKind: 'vaults' })
  }

  const syncSetUpStepLabels = papelizSyncSetUpStepLabels[syncSetUpDialogMode]
  const syncDialogSteps =
    syncSetUpStepLabels.length === 0 ? undefined : <PapelizSyncDialogSteps syncDialogStepLabels={syncSetUpStepLabels} currentSyncDialogStepIndex={readSetUpStepIndex(syncSetUpDialogMode, syncSetUpStep)} />

  const setUpActionLine =
    setUpActionState.setUpActionKind === 'failed' ? (
      <PapelizSyncFailureLine className="mt-3">{setUpActionState.setUpFailureWords}</PapelizSyncFailureLine>
    ) : setUpActionState.setUpActionKind === 'fresh-sign-in-needed' ? (
      <div className="mt-3 rounded-xl border border-papeliz-blue-line bg-papeliz-blue-soft px-3 py-2.5 text-[12.5px] leading-[1.45]">
        <p>To do this, sign in again so Papeliz knows it’s you. The sign-in page opens in a new tab.</p>
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

  const cancelButton = (
    <PapelizPillButton pillButtonVariant="gray" disabled={isSetUpActionRunning} onClick={closePapelizSyncSetUpDialog}>
      {syncSetUpStep.syncSetUpStepKind === 'first-transfer' || syncSetUpStep.syncSetUpStepKind === 'passphrase-changed'
        ? 'Close'
        : syncSetUpStep.syncSetUpStepKind === 'vaults' && !isOpenVaultSyncable
          ? 'Done'
          : 'Not now'}
    </PapelizPillButton>
  )
  const runningButtonContent = (buttonLabel: string): ReactNode =>
    isSetUpActionRunning ? (
      <>
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        {buttonLabel}
      </>
    ) : (
      buttonLabel
    )

  const dialogFrameProps = {
    syncDialogTitleId: 'papeliz-sync-set-up-dialog-title',
    SyncDialogIcon: KeyRound,
    syncDialogSteps,
    isSyncDialogDrawnInPlace,
    onSyncDialogCancel: () => {
      if (!isSetUpActionRunning) closePapelizSyncSetUpDialog()
    },
  }

  // A new passphrase: set-up, Start over and Change passphrase.
  if (syncSetUpStep.syncSetUpStepKind === 'passphrase' && syncSetUpDialogMode !== 'unlock') {
    const isNewPassphraseReady = isPapelizSyncNewPassphraseReady(typedSyncPassphrase, repeatedSyncPassphrase)
    const submitNewPassphrase = () => {
      const newSyncPassphrase = typedSyncPassphrase
      if (syncSetUpDialogMode === 'change-passphrase') {
        void runSetUpAction(
          () => papelizSyncEngine.changeSyncPassphrase(newSyncPassphrase),
          () => {
            forgetTypedSecrets()
            setSyncSetUpStep({ syncSetUpStepKind: 'passphrase-changed' })
          },
        )
        return
      }
      void runSetUpAction(
        () => (syncSetUpDialogMode === 'start-over' ? papelizSyncEngine.startSyncOver(newSyncPassphrase) : papelizSyncEngine.prepareSyncAccountKeys(newSyncPassphrase)),
        (syncAccountKeyDraft) => {
          forgetTypedSecrets()
          setIsRecoveryKeySavedTicked(false)
          setSyncSetUpStep({ syncSetUpStepKind: 'recovery-key', syncAccountKeyDraft })
        },
      )
    }
    return (
      <PapelizSyncDialogFrame
        {...dialogFrameProps}
        syncDialogTitle={
          syncSetUpDialogMode === 'start-over' ? 'Start over with new keys' : syncSetUpDialogMode === 'change-passphrase' ? 'Change your Sync passphrase' : 'Create your Sync passphrase'
        }
        syncDialogIntro={
          syncSetUpDialogMode === 'start-over' ? (
            <>
              With neither your passphrase nor your Recovery Key, nobody can open the synced copy, Papeliz included. Starting over <b>deletes the synced copy and its old
              versions</b> and makes new keys; then each device uploads its vaults again. The notes on your devices aren’t touched.
            </>
          ) : syncSetUpDialogMode === 'change-passphrase' ? (
            'Your other devices stay unlocked; a device that unlocks later uses the new one. Nothing has to upload again.'
          ) : (
            'It locks your notes before they leave this device. It’s separate from how you sign in, and Papeliz never sees it, so Papeliz can’t reset it.'
          )
        }
        syncDialogFooter={
          <>
            {cancelButton}
            <PapelizPillButton
              pillButtonVariant={syncSetUpDialogMode === 'start-over' ? 'red-primary' : 'primary'}
              disabled={!isNewPassphraseReady || isSetUpActionRunning}
              onClick={submitNewPassphrase}
            >
              {runningButtonContent(syncSetUpDialogMode === 'start-over' ? 'Start over' : syncSetUpDialogMode === 'change-passphrase' ? 'Change passphrase' : 'Continue')}
            </PapelizPillButton>
          </>
        }
      >
        <form
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault()
            if (isNewPassphraseReady && !isSetUpActionRunning) submitNewPassphrase()
          }}
        >
          <PapelizSyncNewPassphraseFields
            newSyncPassphrase={typedSyncPassphrase}
            onNewSyncPassphraseChange={setTypedSyncPassphrase}
            repeatedSyncPassphrase={repeatedSyncPassphrase}
            onRepeatedSyncPassphraseChange={setRepeatedSyncPassphrase}
            newSyncPassphraseFieldLabel={syncSetUpDialogMode === 'set-up' ? 'Sync passphrase' : 'New Sync passphrase'}
          />
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
        {setUpActionLine}
      </PapelizSyncDialogFrame>
    )
  }

  // A second device: the passphrase once.
  if (syncSetUpStep.syncSetUpStepKind === 'passphrase') {
    const isPassphraseTyped = typedSyncPassphrase !== ''
    const unlockWithPassphrase = () => {
      const syncPassphrase = typedSyncPassphrase
      void runSetUpAction(() => papelizSyncEngine.unlockSyncWithPassphrase(syncPassphrase), goToVaultsStep)
    }
    return (
      <PapelizSyncDialogFrame
        {...dialogFrameProps}
        syncDialogTitle="Unlock Sync on this device"
        syncDialogIntro="Enter your Sync passphrase. Papeliz asks for it once on each device."
        syncDialogFooter={
          <>
            {cancelButton}
            <PapelizPillButton pillButtonVariant="primary" disabled={!isPassphraseTyped || isSetUpActionRunning} onClick={unlockWithPassphrase}>
              {runningButtonContent('Unlock')}
            </PapelizPillButton>
          </>
        }
      >
        <form
          className="mt-4"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault()
            if (isPassphraseTyped && !isSetUpActionRunning) unlockWithPassphrase()
          }}
        >
          <PapelizSyncPassphraseField
            syncPassphraseFieldLabel="Sync passphrase"
            syncPassphrase={typedSyncPassphrase}
            onSyncPassphraseChange={setTypedSyncPassphrase}
            isSyncPassphraseShown={false}
            syncPassphraseAutoComplete="current-password"
            isSyncPassphraseFieldFocusedFirst
          />
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
        {setUpActionLine}
        <p className="mt-4 text-[12.5px] leading-[1.5] text-papeliz-ink-muted">
          Forgot it?{' '}
          <PapelizSyncTextButton
            onClick={() => {
              forgetTypedSecrets()
              setSetUpActionState({ setUpActionKind: 'idle' })
              setSyncSetUpStep({ syncSetUpStepKind: 'recovery-key-unlock' })
            }}
          >
            Use your Recovery Key
          </PapelizSyncTextButton>
          . Lost both?{' '}
          <PapelizSyncTextButton onClick={() => openPapelizSyncSetUpDialog('start-over')}>Start over</PapelizSyncTextButton>
        </p>
      </PapelizSyncDialogFrame>
    )
  }

  // A lost passphrase: the Recovery Key unlocks and sets a new one.
  if (syncSetUpStep.syncSetUpStepKind === 'recovery-key-unlock') {
    const isRecoveryUnlockReady = typedRecoveryKeyText.trim() !== '' && isPapelizSyncNewPassphraseReady(typedSyncPassphrase, repeatedSyncPassphrase)
    const unlockWithRecoveryKey = () => {
      const syncRecoveryKeyText = typedRecoveryKeyText
      const newSyncPassphrase = typedSyncPassphrase
      void runSetUpAction(() => papelizSyncEngine.unlockSyncWithRecoveryKey(syncRecoveryKeyText, newSyncPassphrase), goToVaultsStep)
    }
    return (
      <PapelizSyncDialogFrame
        {...dialogFrameProps}
        syncDialogTitle="Unlock with your Recovery Key"
        syncDialogIntro="Type or paste the 24 characters from your Recovery Kit, then choose a new Sync passphrase."
        syncDialogFooter={
          <>
            <PapelizPillButton
              pillButtonVariant="gray"
              disabled={isSetUpActionRunning}
              onClick={() => {
                forgetTypedSecrets()
                setSetUpActionState({ setUpActionKind: 'idle' })
                setSyncSetUpStep({ syncSetUpStepKind: 'passphrase' })
              }}
            >
              Back
            </PapelizPillButton>
            <PapelizPillButton pillButtonVariant="primary" disabled={!isRecoveryUnlockReady || isSetUpActionRunning} onClick={unlockWithRecoveryKey}>
              {runningButtonContent('Unlock')}
            </PapelizPillButton>
          </>
        }
      >
        <label className="mt-4 block">
          <span className="mb-1 block text-[12px] font-medium text-papeliz-ink-subtle">Recovery Key</span>
          <input
            type="text"
            value={typedRecoveryKeyText}
            onChange={(changeEvent) => setTypedRecoveryKeyText(changeEvent.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
            className={`${papelizSyncTextFieldClassName} font-mono tracking-wide`}
          />
        </label>
        <PapelizSyncNewPassphraseFields
          newSyncPassphrase={typedSyncPassphrase}
          onNewSyncPassphraseChange={setTypedSyncPassphrase}
          repeatedSyncPassphrase={repeatedSyncPassphrase}
          onRepeatedSyncPassphraseChange={setRepeatedSyncPassphrase}
          newSyncPassphraseFieldLabel="New Sync passphrase"
        />
        {setUpActionLine}
      </PapelizSyncDialogFrame>
    )
  }

  // The Recovery Key, shown once. Nothing is sent until Continue, so leaving here leaves nothing behind.
  if (syncSetUpStep.syncSetUpStepKind === 'recovery-key') {
    const { syncAccountKeyDraft } = syncSetUpStep
    const signInEmailAddress = syncEngineSnapshot.syncSignIn.syncSignInKind === 'signed-in' ? syncEngineSnapshot.syncSignIn.syncSignInEmailAddress : null
    return (
      <PapelizSyncDialogFrame
        {...dialogFrameProps}
        syncDialogTitle="Save your Recovery Key"
        syncDialogIntro="It opens your synced notes if you forget your Sync passphrase. Papeliz can’t reset either one: without both, the synced copy can’t be opened. The notes on your devices are never affected."
        syncDialogFooter={
          <>
            <PapelizPillButton
              pillButtonVariant="gray"
              disabled={isSetUpActionRunning}
              onClick={() => {
                setSetUpActionState({ setUpActionKind: 'idle' })
                setSyncSetUpStep({ syncSetUpStepKind: 'passphrase' })
              }}
            >
              Back
            </PapelizPillButton>
            <PapelizPillButton
              pillButtonVariant="primary"
              disabled={!isRecoveryKeySavedTicked || isSetUpActionRunning}
              onClick={() => void runSetUpAction(() => papelizSyncEngine.confirmSyncAccountKeys(syncAccountKeyDraft.syncAccountKeyDraftId), goToVaultsStep)}
            >
              {runningButtonContent('Continue')}
            </PapelizPillButton>
          </>
        }
      >
        <p
          className="papeliz-selectable-text mt-4 rounded-2xl border border-papeliz-blue-line bg-papeliz-blue-soft px-4 py-3 text-center font-mono text-[17px] font-medium tracking-[0.08em] break-words text-papeliz-ink max-sm:text-[15px]"
          aria-label="Recovery Key"
        >
          {groupPapelizSyncRecoveryKeyText(syncAccountKeyDraft.syncRecoveryKeyText)}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <PapelizPillButton
            pillButtonVariant="line"
            pillButtonSize="small"
            onClick={() => downloadPapelizSyncRecoveryKit(buildPapelizSyncRecoveryKitText(syncAccountKeyDraft.syncRecoveryKeyText, signInEmailAddress))}
          >
            <Download className="size-3.5" aria-hidden="true" />
            Download Recovery Kit
          </PapelizPillButton>
          <PapelizPillButton
            pillButtonVariant="line"
            pillButtonSize="small"
            onClick={() => {
              void navigator.clipboard.writeText(groupPapelizSyncRecoveryKeyText(syncAccountKeyDraft.syncRecoveryKeyText)).then(() => setIsRecoveryKeyCopied(true))
            }}
          >
            {isRecoveryKeyCopied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
            {isRecoveryKeyCopied ? 'Copied' : 'Copy'}
          </PapelizPillButton>
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-2 text-[13px] leading-[1.45]">
          <input
            type="checkbox"
            checked={isRecoveryKeySavedTicked}
            onChange={(changeEvent) => setIsRecoveryKeySavedTicked(changeEvent.target.checked)}
            className="mt-0.5 size-[15px] flex-none accent-papeliz-blue"
          />
          <span>I saved my Recovery Key somewhere safe, away from this device.</span>
        </label>
        {setUpActionLine}
      </PapelizSyncDialogFrame>
    )
  }

  if (syncSetUpStep.syncSetUpStepKind === 'passphrase-changed') {
    return (
      <PapelizSyncDialogFrame
        {...dialogFrameProps}
        syncDialogTitle="Your passphrase is changed"
        syncDialogIntro="Use the new one when a device asks for it. Your Recovery Key stays the same."
        syncDialogFooter={
          <PapelizPillButton pillButtonVariant="primary" onClick={closePapelizSyncSetUpDialog}>
            Done
          </PapelizPillButton>
        }
      />
    )
  }

  // Which vaults sync: the vault open here. Others sync from Sync in the gear once they're open.
  if (syncSetUpStep.syncSetUpStepKind === 'vaults') {
    const accountVaultsToConnect =
      accountVaultsOutcome?.syncActionOutcome === 'done'
        ? accountVaultsOutcome.syncActionDoneValue.filter((accountVault) => accountVault.papelizVaultIdOnThisDevice === null)
        : []
    const applyOpenVaultChoice = () => {
      if (openVault === null || openVaultChoice === null || openVaultChoice.openVaultChoiceKind === 'not-now') {
        closePapelizSyncSetUpDialog()
        return
      }
      const papelizVaultId = openVault.papelizVaultId
      void runSetUpAction<unknown>(
        () =>
          openVaultChoice.openVaultChoiceKind === 'connect'
            ? papelizSyncEngine.connectVaultToSyncedVault(papelizVaultId, openVaultChoice.papelizSyncVaultId)
            : papelizSyncEngine.turnSyncOnForVault(papelizVaultId),
        () => setSyncSetUpStep({ syncSetUpStepKind: 'first-transfer', transferredPapelizVaultId: papelizVaultId }),
      )
    }
    const openVaultChoiceRow = (openVaultChoiceKey: string, rowOpenVaultChoice: PapelizSyncOpenVaultChoice, openVaultChoiceTitle: ReactNode, openVaultChoiceDetail: ReactNode) => (
      <label key={openVaultChoiceKey} className="flex cursor-pointer items-start gap-2.5 px-3 py-2.5 has-checked:bg-papeliz-blue-soft">
        <input
          type="radio"
          name="papeliz-sync-open-vault-choice"
          checked={openVaultChoice !== null && isSameOpenVaultChoice(openVaultChoice, rowOpenVaultChoice)}
          onChange={() => setOpenVaultChoice(rowOpenVaultChoice)}
          className="mt-0.5 size-[15px] flex-none accent-papeliz-blue"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium">{openVaultChoiceTitle}</span>
          <span className="block text-[12px] leading-[1.4] text-papeliz-ink-subtle">{openVaultChoiceDetail}</span>
        </span>
      </label>
    )
    return (
      <PapelizSyncDialogFrame
        {...dialogFrameProps}
        syncDialogTitle="Choose what syncs"
        syncDialogIntro={
          isOpenVaultSyncable
            ? 'A vault syncs while it’s open in Papeliz. To sync another vault, open it and turn Sync on in Settings.'
            : 'Sync is set up. Open a folder or a browser vault, then turn Sync on for it in Settings.'
        }
        syncDialogFooter={
          <>
            {cancelButton}
            {isOpenVaultSyncable && (
              <PapelizPillButton pillButtonVariant="primary" disabled={openVaultChoice === null || isSetUpActionRunning} onClick={applyOpenVaultChoice}>
                {runningButtonContent(openVaultChoice?.openVaultChoiceKind === 'not-now' ? 'Done' : 'Start syncing')}
              </PapelizPillButton>
            )}
          </>
        }
      >
        {isOpenVaultSyncable && openVault !== null && (
          <div className="mt-4 divide-y divide-papeliz-line overflow-hidden rounded-2xl border border-papeliz-line" role="radiogroup" aria-label={`What “${openVault.papelizVaultDisplayName}” does`}>
            {openVaultChoiceRow(
              'sync-as-new',
              { openVaultChoiceKind: 'sync-as-new' },
              <>Sync “{openVault.papelizVaultDisplayName}”</>,
              'It uploads, encrypted, and your other devices can download it.',
            )}
            {syncSetUpDialogMode === 'unlock' && accountVaultsOutcome === null && (
              <div className="px-3">
                <PapelizSyncLoadingLine>Reading your synced vaults…</PapelizSyncLoadingLine>
              </div>
            )}
            {accountVaultsToConnect.map((accountVault) =>
              openVaultChoiceRow(
                `connect-${accountVault.papelizSyncVaultId}`,
                { openVaultChoiceKind: 'connect', papelizSyncVaultId: accountVault.papelizSyncVaultId },
                <>Join “{accountVault.syncVaultName ?? 'a synced vault'}”</>,
                `Merges the two, note by note: ${accountVault.syncVaultFileCount.toLocaleString('en-US')} files, ${formatPapelizSyncByteSize(accountVault.syncVaultStoredByteLength)} synced.`,
              ),
            )}
            {openVaultChoiceRow('not-now', { openVaultChoiceKind: 'not-now' }, 'Not now', 'This vault stays on this device only. You can turn Sync on later.')}
          </div>
        )}
        {accountVaultsOutcome?.syncActionOutcome === 'failed' && (
          <PapelizSyncFailureLine className="mt-3">{describePapelizSyncActionFailureNow(accountVaultsOutcome)}</PapelizSyncFailureLine>
        )}
        {setUpActionLine}
      </PapelizSyncDialogFrame>
    )
  }

  // The first upload (or Connect's merge), with its progress. It goes on with the dialog closed.
  const transferredVaultReading = syncEngineSnapshot.syncLocalVaults.find((syncLocalVault) => syncLocalVault.papelizVaultId === syncSetUpStep.transferredPapelizVaultId) ?? openVaultSyncReading
  const transferredVaultName = openVault?.papelizVaultId === syncSetUpStep.transferredPapelizVaultId ? openVault.papelizVaultDisplayName : 'This vault'
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
