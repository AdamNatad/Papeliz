import { usePapelizSyncEngineStore } from './papeliz-sync-engine-store'

// What the workspace tells Papeliz Sync, so changes go up soon after they are made. Each call is
// cheap, never waits, and does nothing while the engine isn't loaded; none of them loads it.

export function reportPapelizSyncVaultFileSaved(papelizVaultId: string, vaultFileRelativePath: string): void {
  usePapelizSyncEngineStore.getState().papelizSyncEngine?.reportSyncVaultFileSaved(papelizVaultId, vaultFileRelativePath)
}

export function reportPapelizSyncVaultNoteLeft(papelizVaultId: string, vaultNoteRelativePath: string): void {
  usePapelizSyncEngineStore.getState().papelizSyncEngine?.reportSyncVaultNoteLeft(papelizVaultId, vaultNoteRelativePath)
}

// A rename or move made in Papeliz, sent as a rename rather than a delete and a new file.
export function reportPapelizSyncVaultEntryRenamed(papelizVaultId: string, fromVaultEntryRelativePath: string, toVaultEntryRelativePath: string): void {
  usePapelizSyncEngineStore.getState().papelizSyncEngine?.reportSyncVaultEntryRenamed(papelizVaultId, fromVaultEntryRelativePath, toVaultEntryRelativePath)
}

export function reportPapelizSyncVaultEntryMovedToTrash(papelizVaultId: string, vaultEntryRelativePath: string, vaultTrashRelativePath: string): void {
  usePapelizSyncEngineStore.getState().papelizSyncEngine?.reportSyncVaultEntryMovedToTrash(papelizVaultId, vaultEntryRelativePath, vaultTrashRelativePath)
}

// Leaving the tab or closing Papeliz.
export function sendWaitingPapelizSyncChangesNow(): void {
  void usePapelizSyncEngineStore.getState().papelizSyncEngine?.sendWaitingSyncChangesNow()
}
