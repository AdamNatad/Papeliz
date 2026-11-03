import { CircleCheck, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { isPapelizSyncNewPassphraseReady, PapelizSyncNewPassphraseFields, PapelizSyncPassphraseField } from '../sync/papeliz-sync-passphrase-fields'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import type { PapelizOpenVault } from '../vault/papeliz-open-vault'
import type { PapelizVaultAdapter } from '../vault/papeliz-vault-adapter'
import {
  changePapelizEndToEndVaultPassphrase,
  changePapelizVaultToEndToEnd,
  changePapelizVaultToStandard,
  describePapelizWrongVaultPassphrase,
  isPapelizEndToEndVaultAdapter,
  type PapelizVaultEncryptionKindChangeProgress,
  type PapelizVaultEncryptionKindChangeResult,
} from '../vault/papeliz-vault-encryption'
import { describePapelizVaultEncryptionFailureMessage, PapelizVaultEncryptionChangeProgressBlock } from './papeliz-vault-encryption-parts'
import {
  formatPapelizVaultFileCount,
  formatPapelizVaultFileCountTitle,
  papelizBrowserStandardVaultReadableLine,
  papelizEarlierPlainCopiesStayReadableLine,
  papelizEndToEndVaultPassphraseNotRecoverableLine,
  papelizNewEndToEndVaultPassphraseFieldLabel,
  papelizStandardVaultReadableByOtherAppsLine,
  papelizVaultEncryptionChangeEachFileLine,
  papelizVaultEncryptionChangeKeepOpenLine,
} from './papeliz-vault-encryption-screen-words'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

// Settings › Vault › Encryption's three changes, each in its own dialog:
// - Change to End-to-end: the passphrase twice, with both warnings (it can't be recovered; copies made
//   before stay readable), then every file encrypted with its progress, then Done.
// - Change to Standard: the passphrase again, so nobody at an unlocked vault can undo it in two
//   clicks, with the warning, then every file decrypted, then Done.
// - Change Passphrase: the current one and the new one twice. Only the key's wrap changes, so no file is
//   rewritten.
// While a change rewrites the files the vault's notes are saved and closed, and nothing else reads
// it; Done opens it again as its new kind. A change that stops part-way carries on the next time the
// vault opens, so the vault closes then.

export type PapelizVaultEncryptionChange = 'to-end-to-end' | 'to-standard' | 'change-passphrase'

type PapelizVaultEncryptionChangeStage =
  | { encryptionChangeStageKind: 'asking' }
  | { encryptionChangeStageKind: 'checking-passphrase' }
  | { encryptionChangeStageKind: 'wrong-passphrase' }
  | { encryptionChangeStageKind: 'refused'; encryptionChangeFailureMessage: string }
  | { encryptionChangeStageKind: 'rewriting-files'; vaultEncryptionKindChangeProgress: PapelizVaultEncryptionKindChangeProgress | null }
  | { encryptionChangeStageKind: 'done'; changedVaultAdapter: PapelizVaultAdapter | null; changedVaultFileCount: number | null }
  // It stopped part-way: the vault closes, and the change carries on the next time it opens.
  | { encryptionChangeStageKind: 'stopped'; encryptionChangeFailureMessage: string }

interface PapelizVaultEncryptionChangeDialogProps {
  // The open vault the change is for.
  changedOpenVault: PapelizOpenVault
  vaultEncryptionChange: PapelizVaultEncryptionChange
  // The notes and files listed in the vault, for the dialog's words; the progress counts them exactly.
  listedVaultFileCount: number
  onVaultEncryptionChangeDialogClose: () => void
}

export function PapelizVaultEncryptionChangeDialog({ changedOpenVault, vaultEncryptionChange, listedVaultFileCount, onVaultEncryptionChangeDialogClose }: PapelizVaultEncryptionChangeDialogProps) {
  const isBrowserVault = changedOpenVault.papelizVaultAdapter.papelizVaultKind === 'browser-vault-in-opfs'
  const { papelizVaultDisplayName } = changedOpenVault
  const vaultEncryptionChangeDialogRef = useRef<HTMLDialogElement>(null)
  const [encryptionChangeStage, setEncryptionChangeStage] = useState<PapelizVaultEncryptionChangeStage>({ encryptionChangeStageKind: 'asking' })
  const [typedCurrentVaultPassphrase, setTypedCurrentVaultPassphrase] = useState('')
  const [isCurrentVaultPassphraseShown, setIsCurrentVaultPassphraseShown] = useState(false)
  const [typedNewVaultPassphrase, setTypedNewVaultPassphrase] = useState('')
  const [repeatedNewVaultPassphrase, setRepeatedNewVaultPassphrase] = useState('')
  const isEncryptionChangeRunning = encryptionChangeStage.encryptionChangeStageKind === 'checking-passphrase' || encryptionChangeStage.encryptionChangeStageKind === 'rewriting-files'
  const listedVaultFileCountWords = formatPapelizVaultFileCount(listedVaultFileCount)

  useEffect(() => {
    const vaultEncryptionChangeDialogElement = vaultEncryptionChangeDialogRef.current
    if (vaultEncryptionChangeDialogElement === null) return
    vaultEncryptionChangeDialogElement.showModal()
    return () => vaultEncryptionChangeDialogElement.close()
  }, [])

  // Esc and a click outside close it, except while it is changing the vault.
  const cancelVaultEncryptionChange = () => {
    if (isEncryptionChangeRunning) return
    if (encryptionChangeStage.encryptionChangeStageKind === 'done') {
      finishVaultEncryptionChange()
      return
    }
    if (encryptionChangeStage.encryptionChangeStageKind === 'stopped') {
      closeVaultAfterStoppedChange()
      return
    }
    onVaultEncryptionChangeDialogClose()
  }

  const finishVaultEncryptionChange = () => {
    if (encryptionChangeStage.encryptionChangeStageKind !== 'done') return
    void usePapelizWorkspaceStore.getState().finishOpenVaultEncryptionChange(encryptionChangeStage.changedVaultAdapter)
    onVaultEncryptionChangeDialogClose()
  }

  const closeVaultAfterStoppedChange = () => {
    onVaultEncryptionChangeDialogClose()
    void usePapelizWorkspaceStore.getState().closeVaultInWorkspace()
  }

  // A change of kind: the vault is held (its notes saved and closed), then rewritten file by file.
  const runVaultEncryptionKindChange = async () => {
    const changedOpenVaultAdapter = changedOpenVault.papelizVaultAdapter
    setEncryptionChangeStage({ encryptionChangeStageKind: 'checking-passphrase' })
    await usePapelizWorkspaceStore.getState().holdOpenVaultForEncryptionChange()
    const showVaultEncryptionKindChangeProgress = (vaultEncryptionKindChangeProgress: PapelizVaultEncryptionKindChangeProgress) =>
      setEncryptionChangeStage({ encryptionChangeStageKind: 'rewriting-files', vaultEncryptionKindChangeProgress })
    let vaultEncryptionKindChangeResult: PapelizVaultEncryptionKindChangeResult
    if (vaultEncryptionChange === 'to-end-to-end') {
      vaultEncryptionKindChangeResult = await changePapelizVaultToEndToEnd({
        standardVaultAdapter: changedOpenVaultAdapter,
        vaultPassphrase: typedNewVaultPassphrase,
        onVaultEncryptionKindChangeProgress: showVaultEncryptionKindChangeProgress,
      })
    } else if (isPapelizEndToEndVaultAdapter(changedOpenVaultAdapter)) {
      vaultEncryptionKindChangeResult = await changePapelizVaultToStandard({
        endToEndVaultAdapter: changedOpenVaultAdapter,
        vaultPassphrase: typedCurrentVaultPassphrase,
        onVaultEncryptionKindChangeProgress: showVaultEncryptionKindChangeProgress,
      })
    } else {
      vaultEncryptionKindChangeResult = { vaultEncryptionKindChangeOutcome: 'failed', vaultEncryptionFailureCode: 'Already Standard' }
    }
    setTypedCurrentVaultPassphrase('')
    setTypedNewVaultPassphrase('')
    setRepeatedNewVaultPassphrase('')
    if (vaultEncryptionKindChangeResult.vaultEncryptionKindChangeOutcome === 'changed') {
      setEncryptionChangeStage((runningStage) => ({
        encryptionChangeStageKind: 'done',
        changedVaultAdapter: vaultEncryptionKindChangeResult.changedVaultAdapter,
        changedVaultFileCount: runningStage.encryptionChangeStageKind === 'rewriting-files' ? (runningStage.vaultEncryptionKindChangeProgress?.vaultEncryptionChangeFilesInAll ?? null) : null,
      }))
      return
    }
    if (vaultEncryptionKindChangeResult.vaultEncryptionKindChangeOutcome === 'wrong-passphrase') {
      // Nothing was changed: the vault opens again as it was.
      await usePapelizWorkspaceStore.getState().finishOpenVaultEncryptionChange(null)
      setEncryptionChangeStage({ encryptionChangeStageKind: 'wrong-passphrase' })
      return
    }
    const encryptionChangeFailureMessage = describePapelizVaultEncryptionFailureMessage(
      `Couldn’t change “${papelizVaultDisplayName}” to ${vaultEncryptionChange === 'to-end-to-end' ? 'End-to-end' : 'Standard'}`,
      vaultEncryptionKindChangeResult.vaultEncryptionFailureCode,
    )
    setEncryptionChangeStage((runningStage) =>
      runningStage.encryptionChangeStageKind === 'rewriting-files' ? { encryptionChangeStageKind: 'stopped', encryptionChangeFailureMessage } : { encryptionChangeStageKind: 'refused', encryptionChangeFailureMessage },
    )
  }

  // Change Passphrase: nothing is rewritten, so the vault stays open.
  const runVaultPassphraseChange = async () => {
    const changedOpenVaultAdapter = changedOpenVault.papelizVaultAdapter
    if (!isPapelizEndToEndVaultAdapter(changedOpenVaultAdapter)) return
    setEncryptionChangeStage({ encryptionChangeStageKind: 'checking-passphrase' })
    const vaultPassphraseChangeResult = await changePapelizEndToEndVaultPassphrase({
      endToEndVaultAdapter: changedOpenVaultAdapter,
      currentVaultPassphrase: typedCurrentVaultPassphrase,
      newVaultPassphrase: typedNewVaultPassphrase,
    })
    if (vaultPassphraseChangeResult.vaultPassphraseChangeOutcome === 'changed') {
      setTypedCurrentVaultPassphrase('')
      setTypedNewVaultPassphrase('')
      setRepeatedNewVaultPassphrase('')
      setEncryptionChangeStage({ encryptionChangeStageKind: 'done', changedVaultAdapter: null, changedVaultFileCount: null })
      return
    }
    setEncryptionChangeStage(
      vaultPassphraseChangeResult.vaultPassphraseChangeOutcome === 'wrong-passphrase'
        ? { encryptionChangeStageKind: 'wrong-passphrase' }
        : {
            encryptionChangeStageKind: 'refused',
            encryptionChangeFailureMessage: describePapelizVaultEncryptionFailureMessage(`Couldn’t change the passphrase of “${papelizVaultDisplayName}”`, vaultPassphraseChangeResult.vaultEncryptionFailureCode),
          },
    )
  }

  const isNewVaultPassphraseReady = isPapelizSyncNewPassphraseReady(typedNewVaultPassphrase, repeatedNewVaultPassphrase)
  const isEncryptionChangeActionReady =
    vaultEncryptionChange === 'to-end-to-end'
      ? isNewVaultPassphraseReady
      : vaultEncryptionChange === 'to-standard'
        ? typedCurrentVaultPassphrase !== ''
        : typedCurrentVaultPassphrase !== '' && isNewVaultPassphraseReady

  const currentVaultPassphraseField = (currentVaultPassphraseFieldLabel: string) => (
    <div>
      <PapelizSyncPassphraseField
        syncPassphraseFieldLabel={currentVaultPassphraseFieldLabel}
        syncPassphrase={typedCurrentVaultPassphrase}
        onSyncPassphraseChange={(changedVaultPassphrase) => {
          setTypedCurrentVaultPassphrase(changedVaultPassphrase)
          if (encryptionChangeStage.encryptionChangeStageKind === 'wrong-passphrase') setEncryptionChangeStage({ encryptionChangeStageKind: 'asking' })
        }}
        isSyncPassphraseShown={isCurrentVaultPassphraseShown}
        onSyncPassphraseShownToggle={() => setIsCurrentVaultPassphraseShown(!isCurrentVaultPassphraseShown)}
        syncPassphraseAutoComplete="current-password"
        isSyncPassphraseFieldFocusedFirst
      />
      {encryptionChangeStage.encryptionChangeStageKind === 'wrong-passphrase' && (
        <p role="alert" className="mt-1.5 text-[12px] leading-snug font-medium text-papeliz-diff-removed-ink">
          {describePapelizWrongVaultPassphrase(papelizVaultDisplayName)}
        </p>
      )}
    </div>
  )

  let vaultEncryptionChangeDialogTitle: string
  let vaultEncryptionChangeDialogBody: ReactNode
  let vaultEncryptionChangeDialogFoot: ReactNode
  if (encryptionChangeStage.encryptionChangeStageKind === 'done') {
    const changedVaultFileCountWords = formatPapelizVaultFileCount(encryptionChangeStage.changedVaultFileCount ?? listedVaultFileCount)
    vaultEncryptionChangeDialogTitle =
      vaultEncryptionChange === 'change-passphrase'
        ? 'Passphrase Changed'
        : `${papelizVaultDisplayName} is ${vaultEncryptionChange === 'to-end-to-end' ? 'End-to-end' : 'Standard'}`
    vaultEncryptionChangeDialogBody = (
      <p className="flex items-start gap-2">
        <CircleCheck className="mt-0.5 size-4 flex-none text-papeliz-ok" aria-hidden="true" />
        <span>
          {vaultEncryptionChange === 'to-end-to-end'
            ? `${changedVaultFileCountWords} encrypted, and their plain copies removed from this ${isBrowserVault ? 'browser' : 'folder'}. Papeliz asks for the passphrase the next time the vault opens.`
            : vaultEncryptionChange === 'to-standard'
              ? `${changedVaultFileCountWords} are plain Markdown again, and the encrypted copies are removed. No passphrase is asked now.`
              : `Use the new passphrase the next time ${papelizVaultDisplayName} opens. No file was rewritten, and devices that remembered it keep opening it.`}
        </span>
      </p>
    )
    vaultEncryptionChangeDialogFoot = (
      <span className="ml-auto">
        <PapelizPillButton pillButtonVariant="primary" className="min-w-28" onClick={finishVaultEncryptionChange} autoFocus>
          Done
        </PapelizPillButton>
      </span>
    )
  } else if (encryptionChangeStage.encryptionChangeStageKind === 'rewriting-files' || (encryptionChangeStage.encryptionChangeStageKind === 'checking-passphrase' && vaultEncryptionChange !== 'change-passphrase')) {
    const isEncrypting = vaultEncryptionChange === 'to-end-to-end'
    vaultEncryptionChangeDialogTitle = `${isEncrypting ? 'Encrypting' : 'Decrypting'} ${papelizVaultDisplayName}`
    vaultEncryptionChangeDialogBody = (
      <PapelizVaultEncryptionChangeProgressBlock
        papelizVaultDisplayName={papelizVaultDisplayName}
        vaultEncryptionKindChangeDirection={isEncrypting ? 'to-end-to-end' : 'to-standard'}
        vaultEncryptionKindChangeProgress={encryptionChangeStage.encryptionChangeStageKind === 'rewriting-files' ? encryptionChangeStage.vaultEncryptionKindChangeProgress : null}
      >
        <p className="text-[13px] leading-snug">{papelizVaultEncryptionChangeKeepOpenLine}</p>
        {isEncrypting && <p className="text-[12px] leading-snug text-papeliz-ink-subtle">{papelizVaultEncryptionChangeEachFileLine}</p>}
      </PapelizVaultEncryptionChangeProgressBlock>
    )
    vaultEncryptionChangeDialogFoot = null
  } else if (encryptionChangeStage.encryptionChangeStageKind === 'stopped') {
    vaultEncryptionChangeDialogTitle = `${papelizVaultDisplayName} Stopped Part-way`
    vaultEncryptionChangeDialogBody = (
      <p role="alert" className="flex items-start gap-2 rounded-xl bg-papeliz-diff-removed px-3 py-2.5 text-[13px] leading-snug font-medium text-papeliz-diff-removed-ink">
        <TriangleAlert className="mt-0.5 size-4 flex-none" aria-hidden="true" />
        <span>{encryptionChangeStage.encryptionChangeFailureMessage} The vault closes now, and the change carries on the next time it opens.</span>
      </p>
    )
    vaultEncryptionChangeDialogFoot = (
      <span className="ml-auto">
        <PapelizPillButton pillButtonVariant="primary" className="min-w-28" onClick={closeVaultAfterStoppedChange} autoFocus>
          Close Vault
        </PapelizPillButton>
      </span>
    )
  } else {
    const isCheckingPassphrase = encryptionChangeStage.encryptionChangeStageKind === 'checking-passphrase'
    vaultEncryptionChangeDialogTitle =
      vaultEncryptionChange === 'change-passphrase'
        ? 'Change Passphrase'
        : `Change ${papelizVaultDisplayName} to ${vaultEncryptionChange === 'to-end-to-end' ? 'End-to-end' : 'Standard'}`
    vaultEncryptionChangeDialogBody = (
      <div className="flex flex-col gap-3">
        <p>
          {vaultEncryptionChange === 'to-end-to-end'
            ? `Papeliz encrypts all ${listedVaultFileCountWords} in this vault on this device, with a passphrase you choose. Other apps won’t be able to read them.`
            : vaultEncryptionChange === 'to-standard'
              ? `Papeliz decrypts all ${listedVaultFileCountWords} back to plain Markdown, so any app on this device can read them.`
              : 'The vault’s key stays the same and only its wrap changes, so no file is rewritten. Devices that remembered this vault keep opening it.'}
        </p>
        {vaultEncryptionChange !== 'to-end-to-end' &&
          currentVaultPassphraseField(vaultEncryptionChange === 'to-standard' ? 'Enter the passphrase to go on' : 'Current passphrase')}
        {vaultEncryptionChange !== 'to-standard' && (
          <div className="-mt-4">
            <PapelizSyncNewPassphraseFields
              newSyncPassphrase={typedNewVaultPassphrase}
              onNewSyncPassphraseChange={setTypedNewVaultPassphrase}
              repeatedSyncPassphrase={repeatedNewVaultPassphrase}
              onRepeatedSyncPassphraseChange={setRepeatedNewVaultPassphrase}
              newSyncPassphraseFieldLabel={vaultEncryptionChange === 'to-end-to-end' ? papelizNewEndToEndVaultPassphraseFieldLabel : 'New passphrase'}
              isNewSyncPassphraseFieldFocusedFirst={vaultEncryptionChange === 'to-end-to-end'}
            />
          </div>
        )}
        <PapelizVaultEncryptionChangeWarning>
          {vaultEncryptionChange === 'to-standard'
            ? isBrowserVault
              ? papelizBrowserStandardVaultReadableLine
              : papelizStandardVaultReadableByOtherAppsLine
            : papelizEndToEndVaultPassphraseNotRecoverableLine}
        </PapelizVaultEncryptionChangeWarning>
        {vaultEncryptionChange === 'to-end-to-end' && <PapelizVaultEncryptionChangeWarning>{papelizEarlierPlainCopiesStayReadableLine}</PapelizVaultEncryptionChangeWarning>}
        {encryptionChangeStage.encryptionChangeStageKind === 'refused' && (
          <p role="alert" className="text-[13px] leading-snug font-medium text-papeliz-diff-removed-ink">
            {encryptionChangeStage.encryptionChangeFailureMessage}
          </p>
        )}
      </div>
    )
    vaultEncryptionChangeDialogFoot = (
      <>
        <PapelizPillButton pillButtonVariant="dialog-cancel" className="min-w-28" disabled={isCheckingPassphrase} onClick={onVaultEncryptionChangeDialogClose}>
          Cancel
        </PapelizPillButton>
        <PapelizPillButton
          pillButtonVariant={vaultEncryptionChange === 'to-standard' ? 'danger' : 'primary'}
          disabled={!isEncryptionChangeActionReady || isCheckingPassphrase}
          onClick={() => void (vaultEncryptionChange === 'change-passphrase' ? runVaultPassphraseChange() : runVaultEncryptionKindChange())}
        >
          {isCheckingPassphrase
            ? 'Checking…'
            : vaultEncryptionChange === 'to-end-to-end'
              ? `Encrypt ${formatPapelizVaultFileCountTitle(listedVaultFileCount)}`
              : vaultEncryptionChange === 'to-standard'
                ? `Decrypt ${formatPapelizVaultFileCountTitle(listedVaultFileCount)}`
                : 'Change Passphrase'}
        </PapelizPillButton>
      </>
    )
  }

  return (
    <dialog
      ref={vaultEncryptionChangeDialogRef}
      aria-labelledby="papeliz-vault-encryption-change-dialog-title"
      aria-busy={isEncryptionChangeRunning || undefined}
      onCancel={(cancelEvent) => {
        cancelEvent.preventDefault()
        cancelVaultEncryptionChange()
      }}
      onClick={(clickEvent) => {
        if (clickEvent.target === vaultEncryptionChangeDialogRef.current) cancelVaultEncryptionChange()
      }}
      className="papeliz-dialog-enter m-auto max-h-[calc(100dvh-32px)] w-[min(460px,calc(100vw-32px))] rounded-3xl border border-papeliz-line bg-papeliz-surface p-0 text-papeliz-ink shadow-papeliz-pop backdrop:bg-papeliz-backdrop"
    >
      <div className="p-6">
        <h2 id="papeliz-vault-encryption-change-dialog-title" className="text-lg font-semibold">
          {vaultEncryptionChangeDialogTitle}
        </h2>
        <div className="mt-2 text-[14px] leading-snug text-papeliz-ink-muted">{vaultEncryptionChangeDialogBody}</div>
        {vaultEncryptionChangeDialogFoot !== null && <div className="mt-6 flex items-center justify-between gap-2">{vaultEncryptionChangeDialogFoot}</div>}
      </div>
    </dialog>
  )
}

function PapelizVaultEncryptionChangeWarning({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-papeliz-warning px-3 py-2.5 text-[12.5px] leading-[1.45] text-papeliz-warning-ink">
      <TriangleAlert className="mt-0.5 size-[15px] flex-none" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}
