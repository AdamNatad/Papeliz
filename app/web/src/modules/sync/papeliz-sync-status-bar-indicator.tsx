import { lazy, Suspense, useEffect } from 'react'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { getVaultEntryName } from '../vault/papeliz-vault-relative-paths'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { usePapelizSyncClockTime } from './papeliz-sync-clock'
import { isPapelizSyncUsedOnThisDevice, readPapelizSyncDevFakeEngineScenarioText, usePapelizSyncEngineSnapshot, usePapelizSyncEngineStore } from './papeliz-sync-engine-store'
import type { PapelizSyncEngineEvent } from './papeliz-sync-engine-contract'
import { createPapelizSyncLocalVaultFiles } from './papeliz-sync-local-vault-files'
import { describePapelizSyncStatusForStatusBar } from './papeliz-sync-screen-words'
import { requestPapelizSettingsGearSyncPage } from './papeliz-sync-settings-gear-request-store'
import { papelizSyncStatusIcons } from './papeliz-sync-status-icons'
import { reportPapelizSyncVaultFileSaved, reportPapelizSyncVaultNoteLeft, sendWaitingPapelizSyncChangesNow } from './papeliz-sync-workspace-reports'

// Sync in the workspace's status bar: the open vault's sync state beside the note's save state (A:
// an icon and a word, the icon alone below 640 px), and the connection between the workspace and
// the engine. Nothing shows, and nothing of Sync loads, until this device has used Sync.

// Sync's dialogs load with the rest of Sync's screens, only once the engine has.
const PapelizSyncDialogHost = lazy(() => import('./papeliz-sync-dialog-host').then((syncDialogHostModule) => ({ default: syncDialogHostModule.PapelizSyncDialogHost })))

export function PapelizSyncStatusBarIndicator({ papelizVaultId }: { papelizVaultId: string }) {
  const syncEngineReading = usePapelizSyncEngineSnapshot()
  const syncClockTime = usePapelizSyncClockTime()
  const openVaultSyncReading = syncEngineReading?.syncEngineSnapshot.syncLocalVaults.find((syncLocalVault) => syncLocalVault.papelizVaultId === papelizVaultId)
  if (openVaultSyncReading === undefined) return null
  const syncStatusDescription = describePapelizSyncStatusForStatusBar(
    openVaultSyncReading.syncVaultStatus,
    openVaultSyncReading.syncVaultTransferProgress?.syncTransferredFileCount ?? null,
    openVaultSyncReading.syncVaultTransferProgress?.syncTransferFileCount ?? null,
    syncClockTime,
  )
  const SyncStatusIcon = papelizSyncStatusIcons[syncStatusDescription.syncStatusIconKind]
  return (
    <button
      type="button"
      title={syncStatusDescription.syncStatusTitle}
      aria-label={`${syncStatusDescription.syncStatusWord}. Open Sync settings`}
      onClick={requestPapelizSettingsGearSyncPage}
      className={joinPapelizClassNames(
        'flex flex-none items-center gap-1.5 rounded-full underline-offset-2 hover:underline focus-visible:outline-white',
        syncStatusDescription.isSyncStatusAttention && 'font-semibold text-white underline',
      )}
    >
      <SyncStatusIcon
        className={joinPapelizClassNames('size-[13px] flex-none', syncStatusDescription.syncStatusIconKind === 'syncing' && 'animate-spin [animation-duration:2s]')}
        aria-hidden="true"
      />
      <span className="max-sm:hidden">{syncStatusDescription.syncStatusWord}</span>
    </button>
  )
}

function describeSyncEngineEventForNotice(syncEngineEvent: PapelizSyncEngineEvent): string | null {
  switch (syncEngineEvent.syncEngineEventKind) {
    case 'attachment-kept-both':
      return `“${getVaultEntryName(syncEngineEvent.vaultFileRelativePath)}” changed on two devices, so both are kept: the other one is “${getVaultEntryName(syncEngineEvent.keptOtherCopyRelativePath)}”.`
    case 'edit-kept-over-delete':
      return `“${getVaultEntryName(syncEngineEvent.vaultFileRelativePath)}” was deleted on another device, but you had changed it, so it stays.`
    case 'moved-to-trash-by-other-device':
      return `“${getVaultEntryName(syncEngineEvent.vaultFileRelativePath)}” was moved to the trash on another device, so it’s in this vault’s trash too.`
    case 'file-too-large-to-sync':
      return `“${getVaultEntryName(syncEngineEvent.vaultFileRelativePath)}” is larger than your plan allows, so it stays on this device only.`
    case 'signed-in':
      return null
  }
}

// Mounted once in the status bar, which is there while a vault is open. It loads the engine at start
// when this device has signed in to Sync before, attaches the open vault, tells the engine about
// saves and the notes left, and sends what's waiting when the tab is left.
export function PapelizSyncWorkspaceConnection() {
  const papelizSyncEngine = usePapelizSyncEngineStore((syncEngineState) => syncEngineState.papelizSyncEngine)
  const loadPapelizSyncEngine = usePapelizSyncEngineStore((syncEngineState) => syncEngineState.loadPapelizSyncEngine)
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)
  const showWorkspaceNotice = usePapelizWorkspaceStore((workspaceState) => workspaceState.showWorkspaceNotice)

  useEffect(() => {
    if (isPapelizSyncUsedOnThisDevice() || readPapelizSyncDevFakeEngineScenarioText() !== null) void loadPapelizSyncEngine()
  }, [loadPapelizSyncEngine])

  useEffect(() => {
    if (papelizSyncEngine === null || openVault === null) return
    const papelizVaultKind = openVault.papelizVaultAdapter.papelizVaultKind
    // The sample vault never syncs.
    if (papelizVaultKind === 'sample-vault-in-memory') return
    return papelizSyncEngine.attachSyncToOpenVault({
      papelizVaultId: openVault.papelizVaultId,
      papelizVaultKind,
      papelizVaultDisplayName: openVault.papelizVaultDisplayName,
      syncLocalVaultFiles: createPapelizSyncLocalVaultFiles(openVault.papelizVaultAdapter),
    })
  }, [papelizSyncEngine, openVault])

  // A note saved from its tab (it went from saving to saved), and a note left for another one.
  // Renames, moves, the trash, copies, new notes, Papeliz's own files and the Assistant's writes to
  // notes that aren't open are reported by the workspace store itself (papeliz-sync-workspace-reports.ts).
  useEffect(() => {
    if (papelizSyncEngine === null) return
    return usePapelizWorkspaceStore.subscribe((workspaceState, previousWorkspaceState) => {
      const currentOpenVault = workspaceState.openVault
      if (currentOpenVault === null || currentOpenVault !== previousWorkspaceState.openVault) return
      for (const [vaultNoteRelativePath, loadedVaultNote] of Object.entries(workspaceState.loadedVaultNotesByRelativePath)) {
        const previousLoadedVaultNote = previousWorkspaceState.loadedVaultNotesByRelativePath[vaultNoteRelativePath]
        if (previousLoadedVaultNote?.noteSaveState === 'saving' && loadedVaultNote.noteSaveState === 'saved') {
          reportPapelizSyncVaultFileSaved(currentOpenVault.papelizVaultId, vaultNoteRelativePath)
        }
      }
      const previousActiveVaultNoteRelativePath = previousWorkspaceState.activeVaultNoteRelativePath
      if (previousActiveVaultNoteRelativePath === null || previousActiveVaultNoteRelativePath === workspaceState.activeVaultNoteRelativePath) return
      // A rename moves the open note's path but keeps its session: that isn't leaving it.
      const previousActiveLoadedNote = previousWorkspaceState.loadedVaultNotesByRelativePath[previousActiveVaultNoteRelativePath]
      const currentActiveLoadedNote =
        workspaceState.activeVaultNoteRelativePath === null ? undefined : workspaceState.loadedVaultNotesByRelativePath[workspaceState.activeVaultNoteRelativePath]
      if (previousActiveLoadedNote !== undefined && previousActiveLoadedNote.loadedNoteSessionId === currentActiveLoadedNote?.loadedNoteSessionId) return
      reportPapelizSyncVaultNoteLeft(currentOpenVault.papelizVaultId, previousActiveVaultNoteRelativePath)
    })
  }, [papelizSyncEngine])

  // Leaving the tab or closing Papeliz: the open note counts as left, and what's waiting goes now.
  useEffect(() => {
    if (papelizSyncEngine === null) return
    const sendWaitingChangesOnLeaving = () => {
      const { openVault: currentOpenVault, activeVaultNoteRelativePath } = usePapelizWorkspaceStore.getState()
      if (currentOpenVault !== null && activeVaultNoteRelativePath !== null) reportPapelizSyncVaultNoteLeft(currentOpenVault.papelizVaultId, activeVaultNoteRelativePath)
      sendWaitingPapelizSyncChangesNow()
    }
    const sendWaitingChangesWhenHidden = () => {
      if (document.visibilityState === 'hidden') sendWaitingChangesOnLeaving()
    }
    document.addEventListener('visibilitychange', sendWaitingChangesWhenHidden)
    window.addEventListener('pagehide', sendWaitingChangesOnLeaving)
    return () => {
      document.removeEventListener('visibilitychange', sendWaitingChangesWhenHidden)
      window.removeEventListener('pagehide', sendWaitingChangesOnLeaving)
    }
  }, [papelizSyncEngine])

  // One-off notices about the open vault, as toasts.
  const openVaultId = openVault?.papelizVaultId ?? null
  useEffect(() => {
    if (papelizSyncEngine === null) return
    return papelizSyncEngine.subscribeToSyncEngineEvents((syncEngineEvent) => {
      if ('papelizVaultId' in syncEngineEvent && syncEngineEvent.papelizVaultId !== openVaultId) return
      const syncEngineEventNotice = describeSyncEngineEventForNotice(syncEngineEvent)
      if (syncEngineEventNotice !== null) showWorkspaceNotice('info', syncEngineEventNotice)
    })
  }, [papelizSyncEngine, openVaultId, showWorkspaceNotice])

  if (papelizSyncEngine === null) return null
  return (
    <Suspense fallback={null}>
      <PapelizSyncDialogHost isSyncDialogDrawnInPlace={false} />
    </Suspense>
  )
}
