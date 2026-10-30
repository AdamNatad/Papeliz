import { create } from 'zustand'
import { listPapelizRecentVaults, reopenPapelizRecentVault } from '../vault/papeliz-recent-vaults'
import type { PapelizOpenVault } from '../vault/papeliz-open-vault'
import type { PapelizVaultAdapter } from '../vault/papeliz-vault-adapter'
import { usePapelizBrowserStorageStore } from '../workspace/papeliz-browser-storage-store'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import type { PapelizSyncEngine, PapelizSyncLocalVaultReading } from './papeliz-sync-engine-contract'
import { createPapelizSyncLocalVaultFiles } from './papeliz-sync-local-vault-files'
import { describePapelizSyncActionFailureNow } from './papeliz-sync-screen-words'

// The synced vaults Fetch from Sync is downloading from the start screen, by the new vault on this
// device each goes into. The vault is attached to the engine here rather than by the workspace, so it
// goes on downloading while the start screen shows Recent Vaults or another vault is open. Once it's
// all here it's detached, a notice offers Open, and its row is an ordinary recent vault.

// - `downloading`: files are coming in (or about to).
// - `stopped`: it stopped partway; the files already here stay, and Try again picks up from there.
export type PapelizSyncStartScreenDownloadStage = 'downloading' | 'stopped'

export interface PapelizSyncStartScreenDownload {
  papelizVaultId: string
  papelizSyncVaultId: string
  // The new vault's name on this device (a folder's own name, or the browser vault's).
  papelizVaultDisplayName: string
  // Download a copy only: Sync is turned off for it once it's all here.
  isSyncFetchCopyOnly: boolean
  syncStartScreenDownloadStage: PapelizSyncStartScreenDownloadStage
  // From the engine's first-download progress; null until it reports.
  syncTransferredFileCount: number | null
  syncTransferFileCount: number | null
  // Why it stopped, in the screens' words.
  syncStartScreenDownloadStopWords: string | null
}

interface PapelizSyncStartScreenDownloadState {
  syncStartScreenDownloadsByVaultId: Readonly<Record<string, PapelizSyncStartScreenDownload>>
}

export const usePapelizSyncStartScreenDownloadStore = create<PapelizSyncStartScreenDownloadState>()(() => ({
  syncStartScreenDownloadsByVaultId: {},
}))

// What a download holds besides its row: the engine, the vault it fills and its attachment.
interface PapelizSyncStartScreenDownloadAttachment {
  papelizSyncEngine: PapelizSyncEngine
  papelizOpenVault: PapelizOpenVault
  detachSyncFromDownloadedVault: () => void
  // The engine took the download (`downloadSyncedVaultInto` answered done). Until then Try again asks
  // for it again; after, it attaches the vault again and the engine picks up.
  isSyncDownloadTaken: boolean
}

const syncStartScreenDownloadAttachmentsByVaultId = new Map<string, PapelizSyncStartScreenDownloadAttachment>()
let stopFollowingSyncEngineSnapshot: (() => void) | null = null

function changeSyncStartScreenDownload(papelizVaultId: string, syncStartScreenDownloadChange: Partial<PapelizSyncStartScreenDownload>): void {
  const syncStartScreenDownloadsByVaultId = usePapelizSyncStartScreenDownloadStore.getState().syncStartScreenDownloadsByVaultId
  const syncStartScreenDownload = syncStartScreenDownloadsByVaultId[papelizVaultId]
  if (syncStartScreenDownload === undefined) return
  usePapelizSyncStartScreenDownloadStore.setState({
    syncStartScreenDownloadsByVaultId: { ...syncStartScreenDownloadsByVaultId, [papelizVaultId]: { ...syncStartScreenDownload, ...syncStartScreenDownloadChange } },
  })
}

function forgetSyncStartScreenDownload(papelizVaultId: string): void {
  const { [papelizVaultId]: _forgottenSyncStartScreenDownload, ...otherSyncStartScreenDownloadsByVaultId } =
    usePapelizSyncStartScreenDownloadStore.getState().syncStartScreenDownloadsByVaultId
  usePapelizSyncStartScreenDownloadStore.setState({ syncStartScreenDownloadsByVaultId: otherSyncStartScreenDownloadsByVaultId })
  const syncStartScreenDownloadAttachment = syncStartScreenDownloadAttachmentsByVaultId.get(papelizVaultId)
  syncStartScreenDownloadAttachmentsByVaultId.delete(papelizVaultId)
  if (syncStartScreenDownloadAttachment !== undefined) {
    syncStartScreenDownloadAttachment.detachSyncFromDownloadedVault()
    // A browser vault holds this tab's open lock until its adapter closes; opening it later takes it again.
    syncStartScreenDownloadAttachment.papelizOpenVault.papelizVaultAdapter.closeVaultAdapter?.()
  }
  if (syncStartScreenDownloadAttachmentsByVaultId.size === 0) {
    stopFollowingSyncEngineSnapshot?.()
    stopFollowingSyncEngineSnapshot = null
  }
}

function attachSyncToDownloadedVault(papelizSyncEngine: PapelizSyncEngine, papelizOpenVault: PapelizOpenVault): () => void {
  const papelizVaultKind = papelizOpenVault.papelizVaultAdapter.papelizVaultKind
  if (papelizVaultKind === 'sample-vault-in-memory') return () => undefined
  return papelizSyncEngine.attachSyncToOpenVault({
    papelizVaultId: papelizOpenVault.papelizVaultId,
    papelizVaultKind,
    papelizVaultDisplayName: papelizOpenVault.papelizVaultDisplayName,
    syncLocalVaultFiles: createPapelizSyncLocalVaultFiles(papelizOpenVault.papelizVaultAdapter),
  })
}

// Why a download that is still underway can't go on, or null while it can.
function describeSyncStartScreenDownloadStop(syncLocalVault: PapelizSyncLocalVaultReading): string | null {
  switch (syncLocalVault.syncVaultStatus.syncStatusKind) {
    case 'offline':
      return 'Can’t reach Sync.'
    case 'signed-out':
      return 'Signed out of Sync.'
    case 'locked':
      return 'Sync is locked on this device.'
    default:
      return null
  }
}

// Opens a downloaded vault from the notice's Open, the way Recent Vaults does. Runs from its click, so
// a folder can be asked for again.
export async function openPapelizSyncDownloadedVaultFromClick(papelizVaultId: string): Promise<void> {
  const { openVaultInWorkspace, showWorkspaceNotice } = usePapelizWorkspaceStore.getState()
  const downloadedRecentVault = (await listPapelizRecentVaults(true)).find((recentVault) => recentVault.papelizVaultId === papelizVaultId)
  if (downloadedRecentVault === undefined) {
    showWorkspaceNotice('error', 'Couldn’t find that vault any more.')
    return
  }
  if (downloadedRecentVault.papelizRecentVaultKind === 'browser-vault-in-opfs') usePapelizBrowserStorageStore.getState().askBrowserToKeepStorage()
  const openVaultResult = await reopenPapelizRecentVault(downloadedRecentVault)
  if (openVaultResult.openVaultOutcome === 'failed') showWorkspaceNotice('error', openVaultResult.openVaultFailureMessage)
  if (openVaultResult.openVaultOutcome !== 'opened') return
  await openVaultInWorkspace(openVaultResult.papelizOpenVault, { firstVaultNoteRelativePathToOpen: null, firstNoteViewMode: 'md-code', expandAllTopLevelFolders: false })
}

async function finishSyncStartScreenDownload(papelizVaultId: string): Promise<void> {
  const syncStartScreenDownload = usePapelizSyncStartScreenDownloadStore.getState().syncStartScreenDownloadsByVaultId[papelizVaultId]
  const syncStartScreenDownloadAttachment = syncStartScreenDownloadAttachmentsByVaultId.get(papelizVaultId)
  if (syncStartScreenDownload === undefined || syncStartScreenDownloadAttachment === undefined) return
  if (syncStartScreenDownload.isSyncFetchCopyOnly) await syncStartScreenDownloadAttachment.papelizSyncEngine.turnSyncOffForVault(papelizVaultId)
  forgetSyncStartScreenDownload(papelizVaultId)
  usePapelizWorkspaceStore
    .getState()
    .showWorkspaceNotice(
      'info',
      syncStartScreenDownload.isSyncFetchCopyOnly
        ? `“${syncStartScreenDownload.papelizVaultDisplayName}” is on this device, as a copy that won’t sync.`
        : `“${syncStartScreenDownload.papelizVaultDisplayName}” is on this device.`,
      { workspaceNoticeActionLabel: 'Open', onWorkspaceNoticeAction: () => void openPapelizSyncDownloadedVaultFromClick(papelizVaultId) },
    )
}

// Each new snapshot moves the downloads on: their progress, a stop, or the end.
function followSyncEngineSnapshotForDownloads(papelizSyncEngine: PapelizSyncEngine): void {
  const syncLocalVaults = papelizSyncEngine.getSyncEngineSnapshot().syncLocalVaults
  for (const syncStartScreenDownload of Object.values(usePapelizSyncStartScreenDownloadStore.getState().syncStartScreenDownloadsByVaultId)) {
    const syncStartScreenDownloadAttachment = syncStartScreenDownloadAttachmentsByVaultId.get(syncStartScreenDownload.papelizVaultId)
    if (syncStartScreenDownloadAttachment?.papelizSyncEngine !== papelizSyncEngine || !syncStartScreenDownloadAttachment.isSyncDownloadTaken) continue
    const downloadedSyncLocalVault = syncLocalVaults.find((syncLocalVault) => syncLocalVault.papelizVaultId === syncStartScreenDownload.papelizVaultId)
    if (downloadedSyncLocalVault === undefined) continue
    const syncVaultTransferProgress = downloadedSyncLocalVault.syncVaultTransferProgress
    if (syncVaultTransferProgress === null) {
      if (downloadedSyncLocalVault.syncVaultStatus.syncStatusKind === 'synced') void finishSyncStartScreenDownload(syncStartScreenDownload.papelizVaultId)
      continue
    }
    const syncStartScreenDownloadStopWords = describeSyncStartScreenDownloadStop(downloadedSyncLocalVault)
    changeSyncStartScreenDownload(syncStartScreenDownload.papelizVaultId, {
      syncStartScreenDownloadStage: syncStartScreenDownloadStopWords === null ? 'downloading' : 'stopped',
      syncStartScreenDownloadStopWords,
      syncTransferredFileCount: syncVaultTransferProgress.syncTransferredFileCount,
      syncTransferFileCount: syncVaultTransferProgress.syncTransferFileCount,
    })
  }
}

// Asks the engine for the download; a refusal stops it with the reason.
async function askSyncEngineForStartScreenDownload(papelizVaultId: string): Promise<void> {
  const syncStartScreenDownload = usePapelizSyncStartScreenDownloadStore.getState().syncStartScreenDownloadsByVaultId[papelizVaultId]
  const syncStartScreenDownloadAttachment = syncStartScreenDownloadAttachmentsByVaultId.get(papelizVaultId)
  if (syncStartScreenDownload === undefined || syncStartScreenDownloadAttachment === undefined) return
  changeSyncStartScreenDownload(papelizVaultId, { syncStartScreenDownloadStage: 'downloading', syncStartScreenDownloadStopWords: null })
  const syncDownloadOutcome = await syncStartScreenDownloadAttachment.papelizSyncEngine.downloadSyncedVaultInto(syncStartScreenDownload.papelizSyncVaultId, papelizVaultId)
  if (syncDownloadOutcome.syncActionOutcome === 'failed') {
    changeSyncStartScreenDownload(papelizVaultId, { syncStartScreenDownloadStage: 'stopped', syncStartScreenDownloadStopWords: describePapelizSyncActionFailureNow(syncDownloadOutcome) })
    return
  }
  syncStartScreenDownloadAttachment.isSyncDownloadTaken = true
  followSyncEngineSnapshotForDownloads(syncStartScreenDownloadAttachment.papelizSyncEngine)
}

export interface PapelizSyncStartScreenDownloadRequest {
  papelizSyncEngine: PapelizSyncEngine
  // The new, empty vault on this device: a folder just picked, or a browser vault just made.
  papelizOpenVault: PapelizOpenVault
  papelizSyncVaultId: string
  isSyncFetchCopyOnly: boolean
}

export async function startPapelizSyncStartScreenDownload({ papelizSyncEngine, papelizOpenVault, papelizSyncVaultId, isSyncFetchCopyOnly }: PapelizSyncStartScreenDownloadRequest): Promise<void> {
  const { papelizVaultId } = papelizOpenVault
  usePapelizSyncStartScreenDownloadStore.setState((syncStartScreenDownloadState) => ({
    syncStartScreenDownloadsByVaultId: {
      ...syncStartScreenDownloadState.syncStartScreenDownloadsByVaultId,
      [papelizVaultId]: {
        papelizVaultId,
        papelizSyncVaultId,
        papelizVaultDisplayName: papelizOpenVault.papelizVaultDisplayName,
        isSyncFetchCopyOnly,
        syncStartScreenDownloadStage: 'downloading',
        syncTransferredFileCount: null,
        syncTransferFileCount: null,
        syncStartScreenDownloadStopWords: null,
      },
    },
  }))
  syncStartScreenDownloadAttachmentsByVaultId.set(papelizVaultId, {
    papelizSyncEngine,
    papelizOpenVault,
    detachSyncFromDownloadedVault: attachSyncToDownloadedVault(papelizSyncEngine, papelizOpenVault),
    isSyncDownloadTaken: false,
  })
  if (stopFollowingSyncEngineSnapshot === null) {
    stopFollowingSyncEngineSnapshot = papelizSyncEngine.subscribeToSyncEngineSnapshot(() => followSyncEngineSnapshotForDownloads(papelizSyncEngine))
  }
  await askSyncEngineForStartScreenDownload(papelizVaultId)
}

// Try again on a stopped row: asks for the download again if the engine never took it, otherwise
// attaches the vault again so the engine picks up where it stopped.
export async function retryPapelizSyncStartScreenDownload(papelizVaultId: string): Promise<void> {
  const syncStartScreenDownloadAttachment = syncStartScreenDownloadAttachmentsByVaultId.get(papelizVaultId)
  if (syncStartScreenDownloadAttachment === undefined) return
  if (!syncStartScreenDownloadAttachment.isSyncDownloadTaken) {
    await askSyncEngineForStartScreenDownload(papelizVaultId)
    return
  }
  changeSyncStartScreenDownload(papelizVaultId, { syncStartScreenDownloadStage: 'downloading', syncStartScreenDownloadStopWords: null })
  syncStartScreenDownloadAttachment.detachSyncFromDownloadedVault()
  syncStartScreenDownloadAttachment.detachSyncFromDownloadedVault = attachSyncToDownloadedVault(
    syncStartScreenDownloadAttachment.papelizSyncEngine,
    syncStartScreenDownloadAttachment.papelizOpenVault,
  )
  followSyncEngineSnapshotForDownloads(syncStartScreenDownloadAttachment.papelizSyncEngine)
}

// A synced vault downloads only into a vault with nothing in it yet: no notes, folders or other files
// (Papeliz's own `.papeliz/` aside). A vault with notes joins a synced vault through Connect instead.
export async function isPapelizVaultEmptyForSyncDownload(papelizVaultAdapter: PapelizVaultAdapter): Promise<boolean> {
  const [vaultTreeEntries, vaultAttachmentFileRelativePaths] = await Promise.all([
    papelizVaultAdapter.listVaultTreeEntries({ isEveryHiddenVaultEntryListed: true }),
    papelizVaultAdapter.listVaultAttachmentFileRelativePaths(),
  ])
  const isPapelizOwnVaultEntry = (vaultEntryRelativePath: string) => vaultEntryRelativePath === '.papeliz' || vaultEntryRelativePath.startsWith('.papeliz/')
  return vaultTreeEntries.every((vaultTreeEntry) => isPapelizOwnVaultEntry(vaultTreeEntry.vaultEntryRelativePath)) && vaultAttachmentFileRelativePaths.length === 0
}

// Tests start each case from nothing.
export function resetPapelizSyncStartScreenDownloadsForTests(): void {
  for (const syncStartScreenDownloadAttachment of syncStartScreenDownloadAttachmentsByVaultId.values()) syncStartScreenDownloadAttachment.detachSyncFromDownloadedVault()
  syncStartScreenDownloadAttachmentsByVaultId.clear()
  stopFollowingSyncEngineSnapshot?.()
  stopFollowingSyncEngineSnapshot = null
  usePapelizSyncStartScreenDownloadStore.setState({ syncStartScreenDownloadsByVaultId: {} })
}
