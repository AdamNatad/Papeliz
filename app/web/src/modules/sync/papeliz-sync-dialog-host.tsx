import { useEffect } from 'react'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { PapelizSyncChangeEncryptionDialog } from './papeliz-sync-change-encryption-dialog'
import { usePapelizSyncEngineSnapshot } from './papeliz-sync-engine-store'
import { followPapelizSyncSnapshotInFlows, usePapelizSyncFlowStore } from './papeliz-sync-flow-store'
import { PapelizSyncMissingFilesDialog } from './papeliz-sync-missing-files-dialog'
import { PapelizSyncNoteClashDialog } from './papeliz-sync-note-clash-dialog'
import { PapelizSyncOldVersionsDialog } from './papeliz-sync-old-versions-dialog'
import { PapelizSyncSetUpDialog } from './papeliz-sync-set-up-dialog'
import { PapelizSyncSubscribeDialog } from './papeliz-sync-subscribe-dialog'

interface PapelizSyncDialogHostProps {
  // In the start page's gear the dialogs stay inside the gear (papeliz-sync-engine-gate.tsx); in the
  // workspace they are drawn on the page body from the status bar, which outlives the gear.
  isSyncDialogDrawnInPlace: boolean
}

// Sync's dialogs, wherever their flow stands (papeliz-sync-flow-store.ts): the subscribe dialog, the
// set-up dialog (or Change Encryption, which shares its place in the flow), the missing-files dialog (it opens by itself once when the open vault's files went
// missing here), the clash dialog (it opens by itself for each new clash in the open vault) and Old
// versions.
export function PapelizSyncDialogHost({ isSyncDialogDrawnInPlace }: PapelizSyncDialogHostProps) {
  const syncEngineReading = usePapelizSyncEngineSnapshot()
  const syncSubscribeStep = usePapelizSyncFlowStore((syncFlowState) => syncFlowState.syncSubscribeStep)
  const syncSubscribeFailureWords = usePapelizSyncFlowStore((syncFlowState) => syncFlowState.syncSubscribeFailureWords)
  const syncSetUpDialogRequest = usePapelizSyncFlowStore((syncFlowState) => syncFlowState.syncSetUpDialogRequest)
  const shownSyncNoteClashId = usePapelizSyncFlowStore((syncFlowState) => syncFlowState.shownSyncNoteClashId)
  const laterSyncNoteClashIds = usePapelizSyncFlowStore((syncFlowState) => syncFlowState.laterSyncNoteClashIds)
  const isSyncOldVersionsDialogShown = usePapelizSyncFlowStore((syncFlowState) => syncFlowState.isSyncOldVersionsDialogShown)
  const shownMissingSyncFilesVaultId = usePapelizSyncFlowStore((syncFlowState) => syncFlowState.shownMissingSyncFilesVaultId)
  const laterMissingSyncFilesVaultIds = usePapelizSyncFlowStore((syncFlowState) => syncFlowState.laterMissingSyncFilesVaultIds)
  const openVaultId = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault?.papelizVaultId ?? null)
  const openVaultDisplayName = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault?.papelizVaultDisplayName ?? null)
  const activeVaultNoteRelativePath = usePapelizWorkspaceStore((workspaceState) => workspaceState.activeVaultNoteRelativePath)
  const syncEngineSnapshot = syncEngineReading?.syncEngineSnapshot ?? null

  useEffect(() => {
    if (syncEngineSnapshot !== null) followPapelizSyncSnapshotInFlows(syncEngineSnapshot)
  }, [syncEngineSnapshot])

  if (syncEngineReading === null) return null
  const { papelizSyncEngine } = syncEngineReading
  const syncNoteClashesToSettle = syncEngineReading.syncEngineSnapshot.syncNoteClashesToSettle
  const shownSyncNoteClash =
    shownSyncNoteClashId !== null
      ? syncNoteClashesToSettle.find((syncNoteClash) => syncNoteClash.papelizSyncClashId === shownSyncNoteClashId)
      : syncNoteClashesToSettle.find((syncNoteClash) => syncNoteClash.papelizVaultId === openVaultId && !laterSyncNoteClashIds.includes(syncNoteClash.papelizSyncClashId))
  // Only while its status still says so: files that came back, or a choice made, close it.
  const missingFilesVaultId = shownMissingSyncFilesVaultId ?? (openVaultId !== null && !laterMissingSyncFilesVaultIds.includes(openVaultId) ? openVaultId : null)
  const missingFilesVaultStatus = syncEngineReading.syncEngineSnapshot.syncLocalVaults.find((syncLocalVault) => syncLocalVault.papelizVaultId === missingFilesVaultId)?.syncVaultStatus
  const isMissingFilesDialogShown = missingFilesVaultStatus?.syncStatusKind === 'files-missing' && syncSubscribeStep === null && syncSetUpDialogRequest === null

  return (
    <>
      {syncSubscribeStep !== null && (
        <PapelizSyncSubscribeDialog
          papelizSyncEngine={papelizSyncEngine}
          syncEngineSnapshot={syncEngineReading.syncEngineSnapshot}
          syncSubscribeStep={syncSubscribeStep}
          syncSubscribeFailureWords={syncSubscribeFailureWords}
          isSyncDialogDrawnInPlace={isSyncDialogDrawnInPlace}
        />
      )}
      {syncSetUpDialogRequest?.syncSetUpDialogKind === 'change-vault-encryption' && (
        <PapelizSyncChangeEncryptionDialog
          key={`change-vault-encryption-${syncSetUpDialogRequest.papelizSyncVaultId}`}
          papelizSyncEngine={papelizSyncEngine}
          syncEngineSnapshot={syncEngineReading.syncEngineSnapshot}
          papelizVaultId={syncSetUpDialogRequest.papelizVaultId}
          papelizSyncVaultId={syncSetUpDialogRequest.papelizSyncVaultId}
          syncVaultName={syncSetUpDialogRequest.syncVaultName}
          currentSyncVaultEncryptionKind={syncSetUpDialogRequest.currentSyncVaultEncryptionKind}
          isSyncDialogDrawnInPlace={isSyncDialogDrawnInPlace}
        />
      )}
      {syncSetUpDialogRequest !== null && syncSetUpDialogRequest.syncSetUpDialogKind !== 'change-vault-encryption' && (
        <PapelizSyncSetUpDialog
          key={syncSetUpDialogRequest.syncSetUpDialogKind === 'change-vault-passphrase' ? `change-vault-passphrase-${syncSetUpDialogRequest.papelizSyncVaultId}` : syncSetUpDialogRequest.syncSetUpDialogKind}
          papelizSyncEngine={papelizSyncEngine}
          syncEngineSnapshot={syncEngineReading.syncEngineSnapshot}
          syncSetUpDialogRequest={syncSetUpDialogRequest}
          isSyncDialogDrawnInPlace={isSyncDialogDrawnInPlace}
        />
      )}
      {isMissingFilesDialogShown && missingFilesVaultId !== null && missingFilesVaultStatus.syncStatusKind === 'files-missing' && (
        <PapelizSyncMissingFilesDialog
          key={missingFilesVaultId}
          papelizSyncEngine={papelizSyncEngine}
          papelizVaultId={missingFilesVaultId}
          papelizVaultDisplayName={missingFilesVaultId === openVaultId && openVaultDisplayName !== null ? openVaultDisplayName : 'this vault'}
          syncMissingFileCount={missingFilesVaultStatus.syncMissingFileCount}
          isSyncDialogDrawnInPlace={isSyncDialogDrawnInPlace}
        />
      )}
      {shownSyncNoteClash !== undefined && !isMissingFilesDialogShown && syncSubscribeStep === null && syncSetUpDialogRequest === null && (
        <PapelizSyncNoteClashDialog key={shownSyncNoteClash.papelizSyncClashId} papelizSyncEngine={papelizSyncEngine} syncNoteClash={shownSyncNoteClash} />
      )}
      {isSyncOldVersionsDialogShown && openVaultId !== null && activeVaultNoteRelativePath !== null && (
        <PapelizSyncOldVersionsDialog papelizSyncEngine={papelizSyncEngine} papelizVaultId={openVaultId} vaultNoteRelativePath={activeVaultNoteRelativePath} />
      )}
    </>
  )
}
