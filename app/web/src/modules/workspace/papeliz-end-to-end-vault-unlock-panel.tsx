import { Lock, TriangleAlert } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { PapelizSyncPassphraseField } from '../sync/papeliz-sync-passphrase-fields'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizLoadingCoverCard } from '../ui/papeliz-loading-cover-card'
import { PapelizLoadingWords } from '../ui/papeliz-loading-dots'
import { PapelizLoadingRing } from '../ui/papeliz-loading-ring'
import { usePapelizFooterEqualButtonWidthRef } from '../ui/papeliz-footer-equal-button-width'
import type { PapelizOpenVault } from '../vault/papeliz-open-vault'
import {
  describePapelizWrongVaultPassphrase,
  finishPapelizVaultEncryptionKindChange,
  unlockPapelizEndToEndVault,
  type PapelizLockedEndToEndVault,
  type PapelizVaultEncryptionKindChangeProgress,
} from '../vault/papeliz-vault-encryption'
import { newVaultFormFooterActionButtonColorClassName, newVaultFormFooterButtonClassName, newVaultFormFooterCancelButtonColorClassName } from './papeliz-new-vault-form'
import {
  describePapelizVaultEncryptionFailureMessage,
  PapelizEndToEndVaultBadge,
  PapelizVaultEncryptionChangeProgressBlock,
  PapelizVaultLetterTile,
  readPapelizRememberEndToEndVaultLine,
} from './papeliz-vault-encryption-parts'
import {
  describePapelizEndToEndVaultLockedLine,
  papelizEndToEndVaultForgottenPassphraseLine,
  papelizEndToEndVaultFoundByOpenVaultLine,
  papelizEndToEndVaultWrongPassphraseHintLine,
  papelizRememberEndToEndVaultSwitchLabel,
  papelizVaultEncryptionChangeKeepOpenLine,
} from './papeliz-vault-encryption-screen-words'

// The help guide on End-to-end vaults: the passphrase, unlocking, and what a forgotten one means.
const papelizEndToEndVaultUnlockHelpArticleUrl = 'https://papeliz.com/help/end-to-end-vaults/'
const papelizEndToEndVaultUnlockHelpLinkLabel = 'Help: End-to-end vaults'

// How Unlock came to show, for the line at its top: a Recent Vaults row says nothing more; Open Vault
// says the folder it found is an End-to-end vault; Lock Now says the vault was locked.
export type PapelizEndToEndVaultUnlockReason = 'opened-from-recent-vaults' | 'found-by-open-vault' | 'locked-now'

interface PapelizEndToEndVaultUnlockPanelProps {
  endToEndVaultUnlockPanelHeadingId: string
  papelizLockedEndToEndVault: PapelizLockedEndToEndVault
  // Where the vault is: its whole path in Papeliz for Windows, its storage on the web.
  endToEndVaultPlaceLine: string
  endToEndVaultUnlockReason: PapelizEndToEndVaultUnlockReason
  // Why the vault didn't open without its passphrase (the key this device remembered no longer opens
  // it), or null.
  endToEndVaultUnlockNoticeLine: string | null
  // The vault, unlocked (and, when a change of kind had stopped part-way, changed): the start screen
  // opens it.
  onEndToEndVaultUnlocked: (unlockedOpenVault: PapelizOpenVault) => void
  onEndToEndVaultUnlockCancel: () => void
}

type PapelizEndToEndVaultUnlockStage =
  | { endToEndVaultUnlockStageKind: 'typing' }
  | { endToEndVaultUnlockStageKind: 'unlocking' }
  | { endToEndVaultUnlockStageKind: 'wrong-passphrase' }
  | { endToEndVaultUnlockStageKind: 'failed'; endToEndVaultUnlockFailureMessage: string }
  // A change of kind that had stopped part-way carries on before the vault opens.
  | { endToEndVaultUnlockStageKind: 'finishing-kind-change'; vaultEncryptionKindChangeProgress: PapelizVaultEncryptionKindChangeProgress | null }

// Unlock, in the start card in place of Recent Vaults: the vault's name, place and badge, its
// passphrase, Remember on This Device (off at first, with what it means here) and the line about a
// forgotten passphrase. Unlock shows "Unlocking…" while the passphrase becomes its key (about a
// second, on purpose); a wrong one says so under the box, with no lockout. A change of kind that had
// stopped part-way carries on, with its progress, before the vault opens. Esc cancels.
export function PapelizEndToEndVaultUnlockPanel({
  endToEndVaultUnlockPanelHeadingId,
  papelizLockedEndToEndVault,
  endToEndVaultPlaceLine,
  endToEndVaultUnlockReason,
  endToEndVaultUnlockNoticeLine,
  onEndToEndVaultUnlocked,
  onEndToEndVaultUnlockCancel,
}: PapelizEndToEndVaultUnlockPanelProps) {
  const endToEndVaultUnlockIdPrefix = useId()
  const endToEndVaultUnlockFooterRef = usePapelizFooterEqualButtonWidthRef(128)
  const [typedVaultPassphrase, setTypedVaultPassphrase] = useState('')
  const [isVaultPassphraseShown, setIsVaultPassphraseShown] = useState(false)
  const [isRememberOnThisDeviceTicked, setIsRememberOnThisDeviceTicked] = useState(false)
  const [endToEndVaultUnlockStage, setEndToEndVaultUnlockStage] = useState<PapelizEndToEndVaultUnlockStage>({ endToEndVaultUnlockStageKind: 'typing' })
  const { papelizVaultDisplayName } = papelizLockedEndToEndVault
  const isEndToEndVaultUnlockRunning =
    endToEndVaultUnlockStage.endToEndVaultUnlockStageKind === 'unlocking' || endToEndVaultUnlockStage.endToEndVaultUnlockStageKind === 'finishing-kind-change'
  const vaultPassphraseProblemId = `${endToEndVaultUnlockIdPrefix}-passphrase-problem`

  const unlockEndToEndVault = async () => {
    if (isEndToEndVaultUnlockRunning || typedVaultPassphrase === '') return
    setEndToEndVaultUnlockStage({ endToEndVaultUnlockStageKind: 'unlocking' })
    const endToEndVaultUnlockResult = await unlockPapelizEndToEndVault(papelizLockedEndToEndVault, {
      vaultPassphrase: typedVaultPassphrase,
      isVaultKeyRememberedOnThisDevice: isRememberOnThisDeviceTicked,
    })
    if (endToEndVaultUnlockResult.endToEndVaultUnlockOutcome === 'wrong-passphrase') {
      setEndToEndVaultUnlockStage({ endToEndVaultUnlockStageKind: 'wrong-passphrase' })
      return
    }
    if (endToEndVaultUnlockResult.endToEndVaultUnlockOutcome !== 'unlocked') {
      setEndToEndVaultUnlockStage({
        endToEndVaultUnlockStageKind: 'failed',
        endToEndVaultUnlockFailureMessage:
          endToEndVaultUnlockResult.endToEndVaultUnlockOutcome === 'failed'
            ? describePapelizVaultEncryptionFailureMessage(`Couldn’t unlock “${papelizVaultDisplayName}”`, endToEndVaultUnlockResult.vaultEncryptionFailureCode)
            : `Couldn’t unlock “${papelizVaultDisplayName}”.`,
      })
      return
    }
    setTypedVaultPassphrase('')
    const unlockedOpenVault = endToEndVaultUnlockResult.papelizOpenVault
    if (unlockedOpenVault.papelizVaultAdapter.unfinishedVaultEncryptionKindChange === null) {
      onEndToEndVaultUnlocked(unlockedOpenVault)
      return
    }
    setEndToEndVaultUnlockStage({ endToEndVaultUnlockStageKind: 'finishing-kind-change', vaultEncryptionKindChangeProgress: null })
    const vaultEncryptionKindChangeResult = await finishPapelizVaultEncryptionKindChange(unlockedOpenVault.papelizVaultAdapter, (vaultEncryptionKindChangeProgress) =>
      setEndToEndVaultUnlockStage({ endToEndVaultUnlockStageKind: 'finishing-kind-change', vaultEncryptionKindChangeProgress }),
    )
    if (vaultEncryptionKindChangeResult.vaultEncryptionKindChangeOutcome === 'changed') {
      onEndToEndVaultUnlocked({ ...unlockedOpenVault, papelizVaultAdapter: vaultEncryptionKindChangeResult.changedVaultAdapter })
      return
    }
    setEndToEndVaultUnlockStage({
      endToEndVaultUnlockStageKind: 'failed',
      endToEndVaultUnlockFailureMessage:
        vaultEncryptionKindChangeResult.vaultEncryptionKindChangeOutcome === 'failed'
          ? describePapelizVaultEncryptionFailureMessage(`Couldn’t finish changing “${papelizVaultDisplayName}”`, vaultEncryptionKindChangeResult.vaultEncryptionFailureCode)
          : `Couldn’t finish changing “${papelizVaultDisplayName}”.`,
    })
  }

  const endToEndVaultUnlockTopLine: ReactNode =
    endToEndVaultUnlockNoticeLine ??
    (endToEndVaultUnlockReason === 'locked-now'
      ? describePapelizEndToEndVaultLockedLine(papelizVaultDisplayName)
      : endToEndVaultUnlockReason === 'found-by-open-vault'
        ? papelizEndToEndVaultFoundByOpenVaultLine
        : null)

  return (
    <div
      onKeyDown={(keyDownEvent) => {
        if (keyDownEvent.key !== 'Escape' || keyDownEvent.defaultPrevented || isEndToEndVaultUnlockRunning) return
        keyDownEvent.preventDefault()
        onEndToEndVaultUnlockCancel()
      }}
      className="papeliz-welcome-enter flex min-h-0 flex-1 flex-col"
    >
      <div className="px-3 pt-[11px] pb-1">
        <div className="flex items-center gap-2">
          <h2 id={endToEndVaultUnlockPanelHeadingId} className="min-w-0 truncate text-[18px] font-semibold tracking-[-0.01em]">
            Unlock {papelizVaultDisplayName}
          </h2>
          <a
            href={papelizEndToEndVaultUnlockHelpArticleUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={papelizEndToEndVaultUnlockHelpLinkLabel}
            title={papelizEndToEndVaultUnlockHelpLinkLabel}
            className="grid size-[22px] flex-none place-items-center rounded-full border border-papeliz-line text-[12.5px] leading-none font-bold text-papeliz-ink-muted transition-colors hover:border-papeliz-blue-line hover:bg-papeliz-blue-soft hover:text-papeliz-blue"
          >
            ?
          </a>
        </div>
      </div>

      <form
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault()
          void unlockEndToEndVault()
        }}
        className="relative flex min-h-0 flex-1 flex-col"
      >
        {endToEndVaultUnlockStage.endToEndVaultUnlockStageKind === 'unlocking' && (
          <PapelizLoadingCoverCard loadingWords={`Unlocking ${papelizVaultDisplayName}`} loadingCoverPlacement="over-pane" />
        )}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pt-2 pb-3">
          {endToEndVaultUnlockTopLine !== null && <p className="text-[12.5px] leading-snug text-papeliz-ink-muted">{endToEndVaultUnlockTopLine}</p>}

          <div className="flex items-center gap-3 rounded-xl border border-papeliz-line px-2.5 py-2">
            <PapelizVaultLetterTile papelizVaultDisplayName={papelizVaultDisplayName} isEndToEndVault />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[13.5px] font-semibold">{papelizVaultDisplayName}</span>
              <span className="truncate text-[11.5px] text-papeliz-ink-subtle" dir="ltr">
                {endToEndVaultPlaceLine}
              </span>
            </span>
            <PapelizEndToEndVaultBadge className="max-sm:hidden" />
          </div>

          {endToEndVaultUnlockStage.endToEndVaultUnlockStageKind === 'finishing-kind-change' ? (
            <PapelizVaultEncryptionChangeProgressBlock
              papelizVaultDisplayName={papelizVaultDisplayName}
              vaultEncryptionKindChangeDirection={papelizLockedEndToEndVault.unfinishedVaultEncryptionKindChange ?? 'to-end-to-end'}
              vaultEncryptionKindChangeProgress={endToEndVaultUnlockStage.vaultEncryptionKindChangeProgress}
            >
              <p className="text-[12px] leading-snug text-papeliz-ink-subtle">{papelizVaultEncryptionChangeKeepOpenLine}</p>
            </PapelizVaultEncryptionChangeProgressBlock>
          ) : (
            <>
              <div>
                <PapelizSyncPassphraseField
                  syncPassphraseFieldLabel="Passphrase"
                  syncPassphrase={typedVaultPassphrase}
                  onSyncPassphraseChange={(changedVaultPassphrase) => {
                    setTypedVaultPassphrase(changedVaultPassphrase)
                    if (endToEndVaultUnlockStage.endToEndVaultUnlockStageKind !== 'unlocking') setEndToEndVaultUnlockStage({ endToEndVaultUnlockStageKind: 'typing' })
                  }}
                  isSyncPassphraseShown={isVaultPassphraseShown}
                  onSyncPassphraseShownToggle={() => setIsVaultPassphraseShown(!isVaultPassphraseShown)}
                  syncPassphraseAutoComplete="current-password"
                  isSyncPassphraseFieldFocusedFirst
                />
                {endToEndVaultUnlockStage.endToEndVaultUnlockStageKind === 'wrong-passphrase' && (
                  <div id={vaultPassphraseProblemId} role="alert">
                    <p className="mt-1.5 text-[12px] leading-snug font-medium text-papeliz-diff-removed-ink">{describePapelizWrongVaultPassphrase(papelizVaultDisplayName)}</p>
                    <p className="mt-0.5 text-[12px] leading-snug text-papeliz-ink-subtle">{papelizEndToEndVaultWrongPassphraseHintLine}</p>
                  </div>
                )}
                {endToEndVaultUnlockStage.endToEndVaultUnlockStageKind === 'failed' && (
                  <p id={vaultPassphraseProblemId} role="alert" className="mt-1.5 flex items-start gap-2 rounded-lg bg-papeliz-diff-removed px-2.5 py-1.5 text-[12px] leading-snug font-medium text-papeliz-diff-removed-ink">
                    <TriangleAlert className="mt-px size-3.5 flex-none" aria-hidden="true" />
                    <span>{endToEndVaultUnlockStage.endToEndVaultUnlockFailureMessage}</span>
                  </p>
                )}
              </div>

              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={isRememberOnThisDeviceTicked}
                  disabled={isEndToEndVaultUnlockRunning}
                  onChange={(changeEvent) => setIsRememberOnThisDeviceTicked(changeEvent.target.checked)}
                  className="mt-0.5 size-4 flex-none cursor-pointer accent-papeliz-blue"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13px] leading-tight font-semibold text-papeliz-ink">{papelizRememberEndToEndVaultSwitchLabel}</span>
                  <span className="text-[12px] leading-snug text-papeliz-ink-subtle">{readPapelizRememberEndToEndVaultLine()}</span>
                </span>
              </label>

              <p className="text-[12px] leading-snug text-papeliz-ink-subtle">{papelizEndToEndVaultForgottenPassphraseLine}</p>
            </>
          )}
        </div>

        <div ref={endToEndVaultUnlockFooterRef} className="flex items-center justify-between gap-2 border-t border-papeliz-line p-3">
          <button
            type="button"
            disabled={isEndToEndVaultUnlockRunning}
            onClick={onEndToEndVaultUnlockCancel}
            className={joinPapelizClassNames(newVaultFormFooterButtonClassName, newVaultFormFooterCancelButtonColorClassName)}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isEndToEndVaultUnlockRunning || typedVaultPassphrase === ''}
            aria-describedby={endToEndVaultUnlockStage.endToEndVaultUnlockStageKind === 'wrong-passphrase' || endToEndVaultUnlockStage.endToEndVaultUnlockStageKind === 'failed' ? vaultPassphraseProblemId : undefined}
            className={joinPapelizClassNames(newVaultFormFooterButtonClassName, newVaultFormFooterActionButtonColorClassName)}
          >
            {isEndToEndVaultUnlockRunning ? <PapelizLoadingRing loadingRingTone="on-blue" /> : <Lock className="size-3.5" aria-hidden="true" />}
            {endToEndVaultUnlockStage.endToEndVaultUnlockStageKind === 'unlocking' ? (
              <PapelizLoadingWords loadingWords="Unlocking…" />
            ) : endToEndVaultUnlockStage.endToEndVaultUnlockStageKind === 'finishing-kind-change' ? (
              <PapelizLoadingWords loadingWords="Changing…" />
            ) : (
              'Unlock'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
