import type { PapelizSyncActionOutcome, PapelizSyncEngine, PapelizSyncVaultEncryptionChoice, PapelizSyncVaultEncryptionKind } from './papeliz-sync-engine-contract'

// Change Encryption, for an open vault that syncs. A synced vault's kind can't change in place (each
// kind keeps its key its own way), so its synced copy is deleted from the account, then Sync is turned
// on for it again with the other kind, which uploads it again. The notes on this device don't change.
// The steps are the engine's own calls, run one after the other for the person.

export type PapelizSyncVaultEncryptionChangeStep = 'deleting-synced-copy' | 'turning-sync-on'

export type PapelizSyncVaultEncryptionChangeOutcome =
  | { syncVaultEncryptionChangeOutcome: 'changed'; papelizSyncVaultId: string }
  | {
      syncVaultEncryptionChangeOutcome: 'failed'
      // Where it stopped: before anything changed, or with the synced copy already deleted and Sync
      // not on again (the vault then doesn't sync until Sync is turned on for it).
      failedSyncVaultEncryptionChangeStep: PapelizSyncVaultEncryptionChangeStep
      failedSyncActionOutcome: Extract<PapelizSyncActionOutcome<unknown>, { syncActionOutcome: 'failed' }>
    }

export function readPapelizSyncVaultOtherEncryptionKind(syncVaultEncryptionKind: PapelizSyncVaultEncryptionKind): PapelizSyncVaultEncryptionKind {
  return syncVaultEncryptionKind === 'standard' ? 'end-to-end' : 'standard'
}

export async function changePapelizSyncVaultEncryption(
  papelizSyncEngine: PapelizSyncEngine,
  {
    papelizVaultId,
    papelizSyncVaultId,
    newSyncVaultEncryptionChoice,
  }: { papelizVaultId: string; papelizSyncVaultId: string; newSyncVaultEncryptionChoice: PapelizSyncVaultEncryptionChoice },
  onSyncVaultEncryptionChangeStep: (syncVaultEncryptionChangeStep: PapelizSyncVaultEncryptionChangeStep) => void,
): Promise<PapelizSyncVaultEncryptionChangeOutcome> {
  onSyncVaultEncryptionChangeStep('deleting-synced-copy')
  const syncedCopyDeleteOutcome = await papelizSyncEngine.deleteSyncedVaultFromAccount(papelizSyncVaultId)
  if (syncedCopyDeleteOutcome.syncActionOutcome === 'failed') {
    return { syncVaultEncryptionChangeOutcome: 'failed', failedSyncVaultEncryptionChangeStep: 'deleting-synced-copy', failedSyncActionOutcome: syncedCopyDeleteOutcome }
  }
  return turnPapelizSyncOnAgainWithOtherEncryption(papelizSyncEngine, papelizVaultId, newSyncVaultEncryptionChoice, onSyncVaultEncryptionChangeStep)
}

// The second step alone: Try Again after the synced copy was deleted and Sync didn't turn on again.
export async function turnPapelizSyncOnAgainWithOtherEncryption(
  papelizSyncEngine: PapelizSyncEngine,
  papelizVaultId: string,
  newSyncVaultEncryptionChoice: PapelizSyncVaultEncryptionChoice,
  onSyncVaultEncryptionChangeStep: (syncVaultEncryptionChangeStep: PapelizSyncVaultEncryptionChangeStep) => void,
): Promise<PapelizSyncVaultEncryptionChangeOutcome> {
  onSyncVaultEncryptionChangeStep('turning-sync-on')
  const syncTurnOnOutcome = await papelizSyncEngine.turnSyncOnForVault(papelizVaultId, newSyncVaultEncryptionChoice)
  if (syncTurnOnOutcome.syncActionOutcome === 'failed') {
    return { syncVaultEncryptionChangeOutcome: 'failed', failedSyncVaultEncryptionChangeStep: 'turning-sync-on', failedSyncActionOutcome: syncTurnOnOutcome }
  }
  return { syncVaultEncryptionChangeOutcome: 'changed', papelizSyncVaultId: syncTurnOnOutcome.syncActionDoneValue.papelizSyncVaultId }
}
