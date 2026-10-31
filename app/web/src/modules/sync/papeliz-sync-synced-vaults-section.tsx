import { LoaderCircle, Trash2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { PapelizConfirmDialog } from '../ui/papeliz-confirm-dialog'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import type { PapelizSyncAccountVaultReading, PapelizSyncActionOutcome, PapelizSyncEngine } from './papeliz-sync-engine-contract'
import { PapelizSyncFailureLine, PapelizSyncLoadingLine, PapelizSyncPageBox, PapelizSyncPageLabel, PapelizSyncPageSmallText, PapelizSyncTextButton } from './papeliz-sync-page-parts'
import { describePapelizSyncActionFailureNow, formatPapelizSyncByteSize } from './papeliz-sync-screen-words'

// The Sync page's "Synced vaults": every vault on the account, with its files, its size and whether
// it's this vault or on this device, each with Delete from Sync (Adam's pick B, 2026-10-31). Deleting
// takes the synced copy and its old versions off the account; every device keeps its files and stops
// syncing that vault. The confirmation asks for the vault's name, as Delete in the Hidden list does.

export type PapelizSyncAccountVaultPlace = 'this-vault' | 'on-this-device' | 'not-on-this-device'

export function readPapelizSyncAccountVaultPlace(accountVault: PapelizSyncAccountVaultReading, openPapelizVaultId: string | null): PapelizSyncAccountVaultPlace {
  if (accountVault.papelizVaultIdOnThisDevice === null) return 'not-on-this-device'
  return accountVault.papelizVaultIdOnThisDevice === openPapelizVaultId ? 'this-vault' : 'on-this-device'
}

export function readPapelizSyncAccountVaultDisplayName(accountVault: PapelizSyncAccountVaultReading): string {
  return accountVault.syncVaultName ?? 'Synced vault'
}

// The name typed in the confirmation matches the vault's (spaces around it aside).
export function isPapelizSyncVaultDeleteConfirmationTyped(typedSyncVaultName: string, accountVault: PapelizSyncAccountVaultReading): boolean {
  return typedSyncVaultName.trim() === readPapelizSyncAccountVaultDisplayName(accountVault).trim()
}

interface PapelizSyncSyncedVaultsSectionProps {
  papelizSyncEngine: PapelizSyncEngine
  // The page's read of the account's vaults; null while it reads.
  accountVaultsOutcome: PapelizSyncActionOutcome<PapelizSyncAccountVaultReading[]> | null
  openPapelizVaultId: string | null
  onAccountVaultsReadAgain: () => void
}

export function PapelizSyncSyncedVaultsSection({ papelizSyncEngine, accountVaultsOutcome, openPapelizVaultId, onAccountVaultsReadAgain }: PapelizSyncSyncedVaultsSectionProps) {
  const showWorkspaceNotice = usePapelizWorkspaceStore((workspaceState) => workspaceState.showWorkspaceNotice)
  const [accountVaultToDelete, setAccountVaultToDelete] = useState<PapelizSyncAccountVaultReading | null>(null)
  const [typedSyncVaultName, setTypedSyncVaultName] = useState('')
  const [deletingPapelizSyncVaultId, setDeletingPapelizSyncVaultId] = useState<string | null>(null)
  const [syncVaultDeleteFailureWords, setSyncVaultDeleteFailureWords] = useState<string | null>(null)

  const deleteAccountVaultFromSync = async (confirmedAccountVault: PapelizSyncAccountVaultReading) => {
    setAccountVaultToDelete(null)
    setSyncVaultDeleteFailureWords(null)
    setDeletingPapelizSyncVaultId(confirmedAccountVault.papelizSyncVaultId)
    const syncVaultDeleteOutcome = await papelizSyncEngine.deleteSyncedVaultFromAccount(confirmedAccountVault.papelizSyncVaultId)
    setDeletingPapelizSyncVaultId(null)
    if (syncVaultDeleteOutcome.syncActionOutcome === 'failed') {
      setSyncVaultDeleteFailureWords(`Couldn’t delete “${readPapelizSyncAccountVaultDisplayName(confirmedAccountVault)}” from Sync. ${describePapelizSyncActionFailureNow(syncVaultDeleteOutcome)}`)
      return
    }
    showWorkspaceNotice('info', `Deleted “${readPapelizSyncAccountVaultDisplayName(confirmedAccountVault)}” from Sync. Your devices keep its files.`)
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
          const accountVaultName = readPapelizSyncAccountVaultDisplayName(accountVault)
          const accountVaultPlace = readPapelizSyncAccountVaultPlace(accountVault, openPapelizVaultId)
          const isAccountVaultDeleting = deletingPapelizSyncVaultId === accountVault.papelizSyncVaultId
          return (
            <div key={accountVault.papelizSyncVaultId} className="flex min-h-11 items-center gap-2.5 px-3 py-2">
              <span aria-hidden="true" className="grid size-7 flex-none place-items-center rounded-lg bg-papeliz-blue-soft text-[13px] font-semibold text-papeliz-blue">
                {accountVaultName.trim().charAt(0).toUpperCase() || '·'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[12.5px] font-medium">{accountVaultName}</span>
                  {accountVaultPlace !== 'not-on-this-device' && (
                    <span className="inline-flex h-[18px] flex-none items-center rounded-full bg-papeliz-surface-gray px-[7px] text-[10.5px] font-semibold text-papeliz-ink-muted">
                      {accountVaultPlace === 'this-vault' ? 'This vault' : 'On this device'}
                    </span>
                  )}
                </div>
                <div className="text-[11.5px] leading-[1.35] text-papeliz-ink-subtle tabular-nums">
                  {accountVault.syncVaultFileCount.toLocaleString('en-US')} {accountVault.syncVaultFileCount === 1 ? 'file' : 'files'} · {formatPapelizSyncByteSize(accountVault.syncVaultStoredByteLength)}
                  {accountVaultPlace === 'not-on-this-device' ? ' · not on this device' : ''}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Delete “${accountVaultName}” from Sync`}
                title={`Delete “${accountVaultName}” from Sync`}
                disabled={deletingPapelizSyncVaultId !== null}
                onClick={() => {
                  setTypedSyncVaultName('')
                  setAccountVaultToDelete(accountVault)
                }}
                className="grid size-7 flex-none place-items-center rounded-full border border-papeliz-line text-papeliz-ink-muted transition-colors hover:border-papeliz-diff-removed-ink/40 hover:bg-papeliz-diff-removed hover:text-papeliz-diff-removed-ink focus-visible:text-papeliz-diff-removed-ink disabled:opacity-50"
              >
                {isAccountVaultDeleting ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3.5" aria-hidden="true" />}
              </button>
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
      {accountVaultToDelete !== null && (
        <PapelizConfirmDialog
          confirmDialogTitle={`Delete “${readPapelizSyncAccountVaultDisplayName(accountVaultToDelete)}” from Sync?`}
          confirmDialogBody={
            <>
              <p>
                This deletes the synced copy of “{readPapelizSyncAccountVaultDisplayName(accountVaultToDelete)}” and all its old versions from your Sync account. The notes on
                your devices stay, but none of them syncs this vault any more.
              </p>
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-papeliz-warning px-3 py-2.5 text-[13px] leading-[1.45] text-papeliz-warning-ink">
                <TriangleAlert className="mt-0.5 size-[15px] flex-none" aria-hidden="true" />
                <span>It can’t be undone. Turning Sync on for it again uploads it as a new synced vault.</span>
              </p>
              <label className="mt-4 block text-[13px] font-medium text-papeliz-ink">
                Type <span className="papeliz-selectable-text font-semibold">{readPapelizSyncAccountVaultDisplayName(accountVaultToDelete)}</span> to delete it
                <input
                  value={typedSyncVaultName}
                  onChange={(changeEvent) => setTypedSyncVaultName(changeEvent.target.value)}
                  onKeyDown={(keyDownEvent) => {
                    if (keyDownEvent.key !== 'Enter' || !isPapelizSyncVaultDeleteConfirmationTyped(typedSyncVaultName, accountVaultToDelete)) return
                    keyDownEvent.preventDefault()
                    void deleteAccountVaultFromSync(accountVaultToDelete)
                  }}
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-1.5 block h-9 w-full rounded-xl border border-papeliz-line bg-papeliz-surface px-3 text-[14px] font-normal text-papeliz-ink focus:border-papeliz-blue-line focus:shadow-[0_0_0_3px_var(--color-papeliz-blue-soft)] focus:outline-none"
                />
              </label>
            </>
          }
          confirmButtonLabel="Delete from Sync"
          isConfirmActionDangerous
          isConfirmButtonDisabled={!isPapelizSyncVaultDeleteConfirmationTyped(typedSyncVaultName, accountVaultToDelete)}
          onConfirm={() => void deleteAccountVaultFromSync(accountVaultToDelete)}
          onCancel={() => setAccountVaultToDelete(null)}
        />
      )}
    </>
  )
}
