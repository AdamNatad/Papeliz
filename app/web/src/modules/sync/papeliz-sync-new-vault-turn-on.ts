import type { PapelizSyncActionOutcome, PapelizSyncEngine, PapelizSyncVaultEncryptionChoice } from './papeliz-sync-engine-contract'

// New Vault's "Sync This Vault": the kind picked there waits here until the workspace has attached the
// new vault to the engine (papeliz-sync-status-bar-indicator.tsx), which a vault must be before Sync is
// turned on for it. It is kept in memory only, so an End-to-end passphrase is never written anywhere,
// and taken once.
const waitingNewVaultSyncEncryptionChoicesByVaultId = new Map<string, PapelizSyncVaultEncryptionChoice>()

export function waitToTurnPapelizSyncOnForNewVault(papelizVaultId: string, syncVaultEncryptionChoice: PapelizSyncVaultEncryptionChoice): void {
  waitingNewVaultSyncEncryptionChoicesByVaultId.set(papelizVaultId, syncVaultEncryptionChoice)
}

// Turns Sync on for a new vault just attached, as Settings › Sync › Turn On Sync does, when New Vault
// asked for it; null when it didn't.
export function turnPapelizSyncOnForNewVaultWhenWaiting(
  papelizSyncEngine: PapelizSyncEngine,
  papelizVaultId: string,
): Promise<PapelizSyncActionOutcome<{ papelizSyncVaultId: string }>> | null {
  const waitingSyncVaultEncryptionChoice = waitingNewVaultSyncEncryptionChoicesByVaultId.get(papelizVaultId)
  if (waitingSyncVaultEncryptionChoice === undefined) return null
  waitingNewVaultSyncEncryptionChoicesByVaultId.delete(papelizVaultId)
  return papelizSyncEngine.turnSyncOnForVault(papelizVaultId, waitingSyncVaultEncryptionChoice)
}
