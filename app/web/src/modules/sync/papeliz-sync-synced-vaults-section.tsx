import { KeyRound, LoaderCircle, Lock, LockOpen, Trash2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { PapelizConfirmDialog } from '../ui/papeliz-confirm-dialog'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import type { PapelizSyncAccountVaultReading, PapelizSyncActionOutcome, PapelizSyncEngine } from './papeliz-sync-engine-contract'
import { openPapelizSyncSetUpDialog } from './papeliz-sync-flow-store'
import { PapelizSyncFailureLine, PapelizSyncLoadingLine, PapelizSyncPageBox, PapelizSyncPageLabel, PapelizSyncPageSmallText, PapelizSyncTextButton } from './papeliz-sync-page-parts'
import { PapelizSyncPassphraseField } from './papeliz-sync-passphrase-fields'
import { describePapelizSyncActionFailureNow, describePapelizSyncFileCount, formatPapelizSyncByteSize, papelizSyncVaultEncryptionKindDisplayNames } from './papeliz-sync-screen-words'

// The Sync page's "Synced vaults": every vault on the account, with its files, its size, its kind and
// whether it's this vault or on this device, each with Remove from Sync (Adam's pick B, 2026-10-31;
// "Remove" rather than "Delete", as on the account page, 2026-11-01). Removing takes the synced copy and its old versions off the account; every device keeps its files and
// stops syncing that vault. The confirmation asks for the vault's name, as Delete in the Hidden list
// does. Every End-to-end vault has Change passphrase, which also asks the current passphrase when
// this device doesn't hold the vault's key; one here that is locked has Unlock too, whose "Forgot
// it?" leads to Remove from Sync, since its passphrase can't be recovered.

export type PapelizSyncAccountVaultPlace = 'this-vault' | 'on-this-device' | 'not-on-this-device'

export function readPapelizSyncAccountVaultPlace(accountVault: PapelizSyncAccountVaultReading, openPapelizVaultId: string | null): PapelizSyncAccountVaultPlace {
  if (accountVault.papelizVaultIdOnThisDevice === null) return 'not-on-this-device'
  return accountVault.papelizVaultIdOnThisDevice === openPapelizVaultId ? 'this-vault' : 'on-this-device'
}

// The name typed in the confirmation matches the vault's (spaces around it aside).
export function isPapelizSyncVaultDeleteConfirmationTyped(typedSyncVaultName: string, accountVault: PapelizSyncAccountVaultReading): boolean {
  return typedSyncVaultName.trim() === accountVault.syncVaultName.trim()
}

// Change passphrase works for every End-to-end vault on the account. Without the key here (a vault not
// downloaded here, or one here that lost it), it asks the current passphrase too. Unlock is for a
// vault on this device that lost its key.
export function canPapelizSyncVaultPassphraseChange(accountVault: PapelizSyncAccountVaultReading): boolean {
  return accountVault.syncVaultEncryptionKind === 'end-to-end'
}

export function isPapelizSyncVaultCurrentPassphraseAskedForChange(accountVault: PapelizSyncAccountVaultReading): boolean {
  return canPapelizSyncVaultPassphraseChange(accountVault) && accountVault.syncVaultLockState === 'locked'
}

export function isPapelizSyncVaultLockedHere(accountVault: PapelizSyncAccountVaultReading): boolean {
  return accountVault.syncVaultEncryptionKind === 'end-to-end' && accountVault.syncVaultLockState === 'locked' && accountVault.papelizVaultIdOnThisDevice !== null
}

// Which of a synced vault's dialogs is open; the page opens Unlock too, from its locked notice.
export type PapelizSyncAccountVaultDialogRequest = { accountVaultDialogKind: 'unlock' | 'delete'; papelizSyncVaultId: string }

const papelizSyncVaultRowButtonClassName =
  'grid size-7 flex-none place-items-center rounded-full border border-papeliz-line text-papeliz-ink-muted transition-colors disabled:opacity-50'

interface PapelizSyncSyncedVaultsSectionProps {
  papelizSyncEngine: PapelizSyncEngine
  // The page's read of the account's vaults; null while it reads.
  accountVaultsOutcome: PapelizSyncActionOutcome<PapelizSyncAccountVaultReading[]> | null
  openPapelizVaultId: string | null
  onAccountVaultsReadAgain: () => void
  accountVaultDialogRequest: PapelizSyncAccountVaultDialogRequest | null
  onAccountVaultDialogRequest: (accountVaultDialogRequest: PapelizSyncAccountVaultDialogRequest | null) => void
}

export function PapelizSyncSyncedVaultsSection({
  papelizSyncEngine,
  accountVaultsOutcome,
  openPapelizVaultId,
  onAccountVaultsReadAgain,
  accountVaultDialogRequest,
  onAccountVaultDialogRequest,
}: PapelizSyncSyncedVaultsSectionProps) {
  const showWorkspaceNotice = usePapelizWorkspaceStore((workspaceState) => workspaceState.showWorkspaceNotice)
  const [typedSyncVaultName, setTypedSyncVaultName] = useState('')
  const [typedSyncVaultPassphrase, setTypedSyncVaultPassphrase] = useState('')
  const [syncVaultUnlockFailureWords, setSyncVaultUnlockFailureWords] = useState<string | null>(null)
  const [isSyncVaultUnlockRunning, setSyncVaultUnlockRunning] = useState(false)
  const [deletingPapelizSyncVaultId, setDeletingPapelizSyncVaultId] = useState<string | null>(null)
  const [syncVaultDeleteFailureWords, setSyncVaultDeleteFailureWords] = useState<string | null>(null)

  const accountVaults = accountVaultsOutcome?.syncActionOutcome === 'done' ? accountVaultsOutcome.syncActionDoneValue : []
  const accountVaultInDialog =
    accountVaultDialogRequest === null ? undefined : accountVaults.find((accountVault) => accountVault.papelizSyncVaultId === accountVaultDialogRequest.papelizSyncVaultId)

  const openAccountVaultDialog = (accountVaultDialogKind: PapelizSyncAccountVaultDialogRequest['accountVaultDialogKind'], accountVault: PapelizSyncAccountVaultReading) => {
    setTypedSyncVaultName('')
    setTypedSyncVaultPassphrase('')
    setSyncVaultUnlockFailureWords(null)
    onAccountVaultDialogRequest({ accountVaultDialogKind, papelizSyncVaultId: accountVault.papelizSyncVaultId })
  }

  const closeAccountVaultDialog = () => {
    setTypedSyncVaultPassphrase('')
    onAccountVaultDialogRequest(null)
  }

  const deleteAccountVaultFromSync = async (confirmedAccountVault: PapelizSyncAccountVaultReading) => {
    closeAccountVaultDialog()
    setSyncVaultDeleteFailureWords(null)
    setDeletingPapelizSyncVaultId(confirmedAccountVault.papelizSyncVaultId)
    const syncVaultDeleteOutcome = await papelizSyncEngine.deleteSyncedVaultFromAccount(confirmedAccountVault.papelizSyncVaultId)
    setDeletingPapelizSyncVaultId(null)
    if (syncVaultDeleteOutcome.syncActionOutcome === 'failed') {
      setSyncVaultDeleteFailureWords(`Couldn’t remove “${confirmedAccountVault.syncVaultName}” from Sync. ${describePapelizSyncActionFailureNow(syncVaultDeleteOutcome)}`)
      return
    }
    showWorkspaceNotice('info', `Removed “${confirmedAccountVault.syncVaultName}” from Sync. Your devices keep its files.`)
    onAccountVaultsReadAgain()
  }

  const unlockAccountVault = async (accountVaultToUnlock: PapelizSyncAccountVaultReading) => {
    if (typedSyncVaultPassphrase === '' || isSyncVaultUnlockRunning) return
    setSyncVaultUnlockFailureWords(null)
    setSyncVaultUnlockRunning(true)
    const syncVaultUnlockOutcome = await papelizSyncEngine.unlockSyncedVaultWithPassphrase(accountVaultToUnlock.papelizSyncVaultId, typedSyncVaultPassphrase)
    setSyncVaultUnlockRunning(false)
    if (syncVaultUnlockOutcome.syncActionOutcome === 'failed') {
      setSyncVaultUnlockFailureWords(describePapelizSyncActionFailureNow(syncVaultUnlockOutcome))
      return
    }
    closeAccountVaultDialog()
    showWorkspaceNotice('info', `Unlocked “${accountVaultToUnlock.syncVaultName}” on this device.`)
    onAccountVaultsReadAgain()
  }

  let syncedVaultsBody
  if (accountVaultsOutcome === null) {
    syncedVaultsBody = <PapelizSyncLoadingLine>Reading your synced vaults…</PapelizSyncLoadingLine>
  } else if (accountVaultsOutcome.syncActionOutcome === 'failed') {
    syncedVaultsBody = (
      <PapelizSyncFailureLine>
        {describePapelizSyncActionFailureNow(accountVaultsOutcome)} <PapelizSyncTextButton onClick={onAccountVaultsReadAgain}>Try again</PapelizSyncTextButton>
      </PapelizSyncFailureLine>
    )
  } else if (accountVaultsOutcome.syncActionDoneValue.length === 0) {
    syncedVaultsBody = <PapelizSyncPageSmallText>None yet. Turn Sync on for a vault and it shows here.</PapelizSyncPageSmallText>
  } else {
    syncedVaultsBody = (
      <PapelizSyncPageBox>
        {accountVaultsOutcome.syncActionDoneValue.map((accountVault) => {
          const accountVaultName = accountVault.syncVaultName
          const accountVaultPlace = readPapelizSyncAccountVaultPlace(accountVault, openPapelizVaultId)
          const isAccountVaultDeleting = deletingPapelizSyncVaultId === accountVault.papelizSyncVaultId
          const isAccountVaultEndToEnd = accountVault.syncVaultEncryptionKind === 'end-to-end'
          return (
            // A long name takes two lines rather than being cut short. In the gear's column, a row with
            // three buttons (Unlock, Change passphrase, Remove) has its buttons under the name, on the right;
            // one or two still fit beside it.
            <div key={accountVault.papelizSyncVaultId} className="flex min-h-11 flex-wrap items-center justify-end gap-x-2.5 gap-y-1.5 px-3 py-2">
              <div className="flex min-w-[min(100%,9rem)] flex-1 items-center gap-2.5">
                <span aria-hidden="true" className="grid size-7 flex-none place-items-center rounded-lg bg-papeliz-blue-soft text-[13px] font-semibold text-papeliz-blue">
                  {accountVaultName.trim().charAt(0).toUpperCase() || '·'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span className="line-clamp-2 min-w-0 text-[12.5px] leading-[1.3] font-medium [overflow-wrap:anywhere]" title={accountVaultName}>
                      {accountVaultName}
                    </span>
                    {accountVaultPlace !== 'not-on-this-device' && (
                      <span className="inline-flex h-[18px] flex-none items-center rounded-full bg-papeliz-surface-gray px-[7px] text-[10.5px] font-semibold text-papeliz-ink-muted">
                        {accountVaultPlace === 'this-vault' ? 'This vault' : 'On this device'}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-1 text-[11.5px] leading-[1.35] text-papeliz-ink-subtle tabular-nums">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      {isAccountVaultEndToEnd && <Lock className="size-3 flex-none" aria-hidden="true" />}
                      {papelizSyncVaultEncryptionKindDisplayNames[accountVault.syncVaultEncryptionKind]}
                    </span>
                    {isPapelizSyncVaultLockedHere(accountVault) && <span className="whitespace-nowrap font-medium text-papeliz-warning-ink">· locked here</span>}
                    <span className="whitespace-nowrap">
                      · {describePapelizSyncFileCount(accountVault.syncVaultFileCount)} · {formatPapelizSyncByteSize(accountVault.syncVaultStoredByteLength)}
                    </span>
                    {accountVaultPlace === 'not-on-this-device' && <span className="whitespace-nowrap">· not on this device</span>}
                  </div>
                </div>
              </div>
              <div className="flex flex-none items-center gap-2.5">
                {isPapelizSyncVaultLockedHere(accountVault) && (
                  <button
                    type="button"
                    aria-label={`Unlock “${accountVaultName}” on this device`}
                    title={`Unlock “${accountVaultName}” on this device`}
                    disabled={deletingPapelizSyncVaultId !== null}
                    onClick={() => openAccountVaultDialog('unlock', accountVault)}
                    className={`${papelizSyncVaultRowButtonClassName} hover:border-papeliz-blue-line hover:bg-papeliz-blue-soft hover:text-papeliz-blue`}
                  >
                    <LockOpen className="size-3.5" aria-hidden="true" />
                  </button>
                )}
                {canPapelizSyncVaultPassphraseChange(accountVault) && (
                  <button
                    type="button"
                    aria-label={`Change the passphrase for “${accountVaultName}”`}
                    title={`Change the passphrase for “${accountVaultName}”`}
                    disabled={deletingPapelizSyncVaultId !== null}
                    onClick={() =>
                      openPapelizSyncSetUpDialog({
                        syncSetUpDialogKind: 'change-vault-passphrase',
                        papelizSyncVaultId: accountVault.papelizSyncVaultId,
                        syncVaultName: accountVaultName,
                        isCurrentSyncVaultPassphraseAsked: isPapelizSyncVaultCurrentPassphraseAskedForChange(accountVault),
                      })
                    }
                    className={`${papelizSyncVaultRowButtonClassName} hover:border-papeliz-blue-line hover:bg-papeliz-blue-soft hover:text-papeliz-blue`}
                  >
                    <KeyRound className="size-3.5" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Remove “${accountVaultName}” from Sync`}
                  title={`Remove “${accountVaultName}” from Sync`}
                  disabled={deletingPapelizSyncVaultId !== null}
                  onClick={() => openAccountVaultDialog('delete', accountVault)}
                  className={`${papelizSyncVaultRowButtonClassName} hover:border-papeliz-diff-removed-ink/40 hover:bg-papeliz-diff-removed hover:text-papeliz-diff-removed-ink focus-visible:text-papeliz-diff-removed-ink`}
                >
                  {isAccountVaultDeleting ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3.5" aria-hidden="true" />}
                </button>
              </div>
            </div>
          )
        })}
      </PapelizSyncPageBox>
    )
  }

  return (
    <>
      <PapelizSyncPageLabel>Synced vaults</PapelizSyncPageLabel>
      {syncedVaultsBody}
      {syncVaultDeleteFailureWords !== null && <PapelizSyncFailureLine className="mt-2">{syncVaultDeleteFailureWords}</PapelizSyncFailureLine>}
      {accountVaultDialogRequest?.accountVaultDialogKind === 'unlock' && accountVaultInDialog !== undefined && (
        <PapelizConfirmDialog
          confirmDialogTitle={`Unlock “${accountVaultInDialog.syncVaultName}” on this device`}
          confirmDialogBody={
            <>
              <p>It’s End-to-end. Enter its passphrase once on this device, and it syncs here again without asking.</p>
              <form
                className="mt-4"
                onSubmit={(submitEvent) => {
                  submitEvent.preventDefault()
                  void unlockAccountVault(accountVaultInDialog)
                }}
              >
                <PapelizSyncPassphraseField
                  syncPassphraseFieldLabel="Passphrase"
                  syncPassphrase={typedSyncVaultPassphrase}
                  onSyncPassphraseChange={setTypedSyncVaultPassphrase}
                  isSyncPassphraseShown={false}
                  syncPassphraseAutoComplete="current-password"
                />
                <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
              </form>
              {syncVaultUnlockFailureWords !== null && <PapelizSyncFailureLine className="mt-2">{syncVaultUnlockFailureWords}</PapelizSyncFailureLine>}
              <p className="mt-3 text-[13px] leading-[1.45]">
                Forgot it? Papeliz can’t recover it.{' '}
                <PapelizSyncTextButton disabled={isSyncVaultUnlockRunning} onClick={() => openAccountVaultDialog('delete', accountVaultInDialog)}>
                  Remove it from Sync
                </PapelizSyncTextButton>
                , then turn Sync on again from a device that still has the notes.
              </p>
            </>
          }
          confirmButtonLabel={isSyncVaultUnlockRunning ? 'Unlocking…' : 'Unlock'}
          isConfirmButtonDisabled={typedSyncVaultPassphrase === '' || isSyncVaultUnlockRunning}
          onConfirm={() => void unlockAccountVault(accountVaultInDialog)}
          onCancel={closeAccountVaultDialog}
        />
      )}
      {accountVaultDialogRequest?.accountVaultDialogKind === 'delete' && accountVaultInDialog !== undefined && (
        <PapelizConfirmDialog
          confirmDialogTitle={`Remove “${accountVaultInDialog.syncVaultName}” from Sync?`}
          confirmDialogBody={
            <>
              <p>
                This deletes the synced copy of “{accountVaultInDialog.syncVaultName}” and all its old versions from your Sync account. The notes on your devices stay, but none
                of them syncs this vault any more.
              </p>
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-papeliz-warning px-3 py-2.5 text-[13px] leading-[1.45] text-papeliz-warning-ink">
                <TriangleAlert className="mt-0.5 size-[15px] flex-none" aria-hidden="true" />
                <span>It can’t be undone. Turning Sync on for it again uploads it as a new synced vault.</span>
              </p>
              <label className="mt-4 block text-[13px] font-medium text-papeliz-ink">
                Type <span className="papeliz-selectable-text font-semibold">{accountVaultInDialog.syncVaultName}</span> to remove it
                <input
                  value={typedSyncVaultName}
                  onChange={(changeEvent) => setTypedSyncVaultName(changeEvent.target.value)}
                  onKeyDown={(keyDownEvent) => {
                    if (keyDownEvent.key !== 'Enter' || !isPapelizSyncVaultDeleteConfirmationTyped(typedSyncVaultName, accountVaultInDialog)) return
                    keyDownEvent.preventDefault()
                    void deleteAccountVaultFromSync(accountVaultInDialog)
                  }}
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-1.5 block h-9 w-full rounded-xl border border-papeliz-line bg-papeliz-surface px-3 text-[14px] font-normal text-papeliz-ink focus:border-papeliz-blue-line focus:shadow-[0_0_0_3px_var(--color-papeliz-blue-soft)] focus:outline-none"
                />
              </label>
            </>
          }
          confirmButtonLabel="Remove from Sync"
          isConfirmActionDangerous
          isConfirmButtonDisabled={!isPapelizSyncVaultDeleteConfirmationTyped(typedSyncVaultName, accountVaultInDialog)}
          onConfirm={() => void deleteAccountVaultFromSync(accountVaultInDialog)}
          onCancel={closeAccountVaultDialog}
        />
      )}
    </>
  )
}
