import type { PapelizVaultAdapter } from '../vault/papeliz-vault-adapter'
import { isVaultRelativePathInsideFolder } from '../vault/papeliz-vault-relative-paths'
import { usePapelizSyncEngineStore } from './papeliz-sync-engine-store'
import { hasPapelizSyncVaultAdapterWholeFileAccess } from './papeliz-sync-local-vault-files'

// What the workspace tells Papeliz Sync, so changes go up soon after they are made. Each call is
// cheap, never waits, and does nothing while the engine isn't loaded; none of them loads it.

export function reportPapelizSyncVaultFileSaved(papelizVaultId: string, vaultFileRelativePath: string): void {
  usePapelizSyncEngineStore.getState().papelizSyncEngine?.reportSyncVaultFileSaved(papelizVaultId, vaultFileRelativePath)
}

// A folder copied in Papeliz: every file in the copy is new to Sync. The copy's files are listed only
// while the engine is loaded; a vault that can't list them is read whole the next time it opens.
export function reportPapelizSyncVaultFolderCopied(papelizVaultId: string, papelizVaultAdapter: PapelizVaultAdapter, copiedVaultFolderRelativePath: string): void {
  const papelizSyncEngine = usePapelizSyncEngineStore.getState().papelizSyncEngine
  if (papelizSyncEngine === null || !hasPapelizSyncVaultAdapterWholeFileAccess(papelizVaultAdapter)) return
  void papelizVaultAdapter
    .listSyncableVaultFileStats()
    .then((syncableVaultFileStats) => {
      for (const { vaultFileRelativePath } of syncableVaultFileStats) {
        if (isVaultRelativePathInsideFolder(vaultFileRelativePath, copiedVaultFolderRelativePath)) papelizSyncEngine.reportSyncVaultFileSaved(papelizVaultId, vaultFileRelativePath)
      }
    })
    .catch(() => undefined)
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
