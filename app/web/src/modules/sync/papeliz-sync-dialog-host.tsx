import { useEffect } from 'react'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { usePapelizSyncEngineSnapshot } from './papeliz-sync-engine-store'
import { followPapelizSyncSnapshotInFlows, usePapelizSyncFlowStore } from './papeliz-sync-flow-store'
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
// set-up dialog, the clash dialog (it opens by itself for each new clash in the open vault) and Old
// versions.
export function PapelizSyncDialogHost({ isSyncDialogDrawnInPlace }: PapelizSyncDialogHostProps) {
  const syncEngineReading = usePapelizSyncEngineSnapshot()
  const syncSubscribeStep = usePapelizSyncFlowStore((syncFlowState) => syncFlowState.syncSubscribeStep)
  const syncSubscribeFailureWords = usePapelizSyncFlowStore((syncFlowState) => syncFlowState.syncSubscribeFailureWords)
  const syncSetUpDialogMode = usePapelizSyncFlowStore((syncFlowState) => syncFlowState.syncSetUpDialogMode)
  const shownSyncNoteClashId = usePapelizSyncFlowStore((syncFlowState) => syncFlowState.shownSyncNoteClashId)
  const laterSyncNoteClashIds = usePapelizSyncFlowStore((syncFlowState) => syncFlowState.laterSyncNoteClashIds)
  const isSyncOldVersionsDialogShown = usePapelizSyncFlowStore((syncFlowState) => syncFlowState.isSyncOldVersionsDialogShown)
  const openVaultId = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault?.papelizVaultId ?? null)
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
      {syncSetUpDialogMode !== null && (
        <PapelizSyncSetUpDialog
          key={syncSetUpDialogMode}
          papelizSyncEngine={papelizSyncEngine}
          syncEngineSnapshot={syncEngineReading.syncEngineSnapshot}
          syncSetUpDialogMode={syncSetUpDialogMode}
          isSyncDialogDrawnInPlace={isSyncDialogDrawnInPlace}
        />
      )}
      {shownSyncNoteClash !== undefined && syncSubscribeStep === null && syncSetUpDialogMode === null && (
        <PapelizSyncNoteClashDialog key={shownSyncNoteClash.papelizSyncClashId} papelizSyncEngine={papelizSyncEngine} syncNoteClash={shownSyncNoteClash} />
      )}
      {isSyncOldVersionsDialogShown && openVaultId !== null && activeVaultNoteRelativePath !== null && (
        <PapelizSyncOldVersionsDialog papelizSyncEngine={papelizSyncEngine} papelizVaultId={openVaultId} vaultNoteRelativePath={activeVaultNoteRelativePath} />
      )}
    </>
  )
}
