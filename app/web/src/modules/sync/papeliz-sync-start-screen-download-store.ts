import { create } from 'zustand'
import { describePapelizFolderAccessOffReason } from '../vault/papeliz-folder-access-support'
import { PapelizFolderOnDiskVaultAdapter } from '../vault/papeliz-folder-on-disk-vault-adapter'
import { listPapelizRecentVaults, reopenPapelizRecentVault, type PapelizRecentVault } from '../vault/papeliz-recent-vaults'
import { openPapelizVaultFolderHandle, pickPapelizVaultFolderHandle, type PapelizOpenVault } from '../vault/papeliz-open-vault'
import type { PapelizVaultAdapter } from '../vault/papeliz-vault-adapter'
import { usePapelizBrowserStorageStore } from '../workspace/papeliz-browser-storage-store'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import type { PapelizSyncEngine, PapelizSyncLocalVaultReading } from './papeliz-sync-engine-contract'
import { usePapelizSyncEngineStore } from './papeliz-sync-engine-store'
import { forgetPapelizSyncFetchedCopy, listPapelizSyncFetchedCopies, rememberPapelizSyncFetchedCopy } from './papeliz-sync-fetched-copies'
import { createPapelizSyncLocalVaultFiles } from './papeliz-sync-local-vault-files'
import { describePapelizSyncActionFailureNow } from './papeliz-sync-screen-words'

// The synced vaults Fetch from Sync is downloading from the start screen, by the new vault on this
// device each goes into. The vault is attached to the engine here rather than by the workspace, so it
// goes on downloading while the start screen shows Recent Vaults or another vault is open. Once it's
// all here it's detached, a notice offers Open, and its row is an ordinary recent vault. Closing the
// tab pauses it; the next start screen picks it up (resumePapelizSyncStartScreenDownloads).

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

// A download that closing the tab left unfinished, in a vault that couldn't be opened again by itself
// (a folder the browser asks about again): Try again opens it from its click.
const syncStartScreenDownloadsWaitingToReopenByVaultId = new Map<string, { papelizSyncEngine: PapelizSyncEngine; waitingRecentVault: PapelizRecentVault }>()

// Why a download that closing the tab left unfinished waits, before its folder is opened again.
const papelizSyncDownloadPausedByClosingWords = 'Papeliz closed before it finished.'

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
  syncStartScreenDownloadsWaitingToReopenByVaultId.delete(papelizVaultId)
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

function addSyncStartScreenDownloadRow(syncStartScreenDownload: Pick<PapelizSyncStartScreenDownload, 'papelizVaultId' | 'papelizSyncVaultId' | 'papelizVaultDisplayName' | 'isSyncFetchCopyOnly'>): void {
  usePapelizSyncStartScreenDownloadStore.setState((syncStartScreenDownloadState) => ({
    syncStartScreenDownloadsByVaultId: {
      ...syncStartScreenDownloadState.syncStartScreenDownloadsByVaultId,
      [syncStartScreenDownload.papelizVaultId]: {
        ...syncStartScreenDownload,
        syncStartScreenDownloadStage: 'downloading',
        syncTransferredFileCount: null,
        syncTransferFileCount: null,
        syncStartScreenDownloadStopWords: null,
      },
    },
  }))
}

function followSyncEngineSnapshotWhileDownloading(papelizSyncEngine: PapelizSyncEngine): void {
  if (stopFollowingSyncEngineSnapshot === null) {
    stopFollowingSyncEngineSnapshot = papelizSyncEngine.subscribeToSyncEngineSnapshot(() => followSyncEngineSnapshotForDownloads(papelizSyncEngine))
  }
}

export async function startPapelizSyncStartScreenDownload({ papelizSyncEngine, papelizOpenVault, papelizSyncVaultId, isSyncFetchCopyOnly }: PapelizSyncStartScreenDownloadRequest): Promise<void> {
  const { papelizVaultId } = papelizOpenVault
  addSyncStartScreenDownloadRow({ papelizVaultId, papelizSyncVaultId, papelizVaultDisplayName: papelizOpenVault.papelizVaultDisplayName, isSyncFetchCopyOnly })
  // Kept from the start, so a copy whose download picks up after the tab closed stays a copy.
  if (isSyncFetchCopyOnly) rememberPapelizSyncFetchedCopy({ papelizVaultId, papelizSyncVaultId })
  syncStartScreenDownloadAttachmentsByVaultId.set(papelizVaultId, {
    papelizSyncEngine,
    papelizOpenVault,
    detachSyncFromDownloadedVault: attachSyncToDownloadedVault(papelizSyncEngine, papelizOpenVault),
    isSyncDownloadTaken: false,
  })
  followSyncEngineSnapshotWhileDownloading(papelizSyncEngine)
  await askSyncEngineForStartScreenDownload(papelizVaultId)
}

// Opens a vault whose first download closing the tab left unfinished, and attaches it, so the engine
// picks up where it was. A vault that doesn't open waits for Try again.
async function reopenSyncStartScreenDownloadVault(papelizSyncEngine: PapelizSyncEngine, unfinishedRecentVault: PapelizRecentVault): Promise<void> {
  const { papelizVaultId } = unfinishedRecentVault
  const openVaultResult = await reopenPapelizRecentVault(unfinishedRecentVault)
  if (usePapelizSyncStartScreenDownloadStore.getState().syncStartScreenDownloadsByVaultId[papelizVaultId] === undefined) {
    if (openVaultResult.openVaultOutcome === 'opened') openVaultResult.papelizOpenVault.papelizVaultAdapter.closeVaultAdapter?.()
    return
  }
  if (openVaultResult.openVaultOutcome !== 'opened') {
    syncStartScreenDownloadsWaitingToReopenByVaultId.set(papelizVaultId, { papelizSyncEngine, waitingRecentVault: unfinishedRecentVault })
    changeSyncStartScreenDownload(papelizVaultId, {
      syncStartScreenDownloadStage: 'stopped',
      syncStartScreenDownloadStopWords: openVaultResult.openVaultOutcome === 'failed' ? openVaultResult.openVaultFailureMessage : papelizSyncDownloadPausedByClosingWords,
    })
    return
  }
  syncStartScreenDownloadsWaitingToReopenByVaultId.delete(papelizVaultId)
  // Attached under the id its link has, whatever the folder's remembering gave back.
  const papelizOpenVault: PapelizOpenVault = { ...openVaultResult.papelizOpenVault, papelizVaultId }
  syncStartScreenDownloadAttachmentsByVaultId.set(papelizVaultId, {
    papelizSyncEngine,
    papelizOpenVault,
    detachSyncFromDownloadedVault: attachSyncToDownloadedVault(papelizSyncEngine, papelizOpenVault),
    isSyncDownloadTaken: true,
  })
  followSyncEngineSnapshotWhileDownloading(papelizSyncEngine)
  followSyncEngineSnapshotForDownloads(papelizSyncEngine)
}

// On the start screen, once the engine has loaded and Recent Vaults are read: each vault whose first
// download closing the tab left unfinished gets its row back and picks up where it was. A browser
// vault, or a folder the browser still lets Papeliz edit, goes on by itself; any other folder waits
// for Try again, since the browser asks about a folder only in answer to a click. A vault open in the
// workspace is left to the workspace, and a vault no longer in Recent Vaults is left alone.
export async function resumePapelizSyncStartScreenDownloads(papelizSyncEngine: PapelizSyncEngine, recentVaults: readonly PapelizRecentVault[]): Promise<void> {
  const fetchedCopyVaultIds = new Set(listPapelizSyncFetchedCopies().map((fetchedCopy) => fetchedCopy.papelizVaultId))
  const workspaceOpenVaultId = usePapelizWorkspaceStore.getState().openVault?.papelizVaultId ?? null
  for (const syncLinkedLocalVault of papelizSyncEngine.getSyncEngineSnapshot().syncLinkedLocalVaults) {
    const { papelizVaultId, papelizSyncVaultId } = syncLinkedLocalVault
    if (!syncLinkedLocalVault.isFirstDownloadUnfinished || papelizVaultId === workspaceOpenVaultId) continue
    if (usePapelizSyncStartScreenDownloadStore.getState().syncStartScreenDownloadsByVaultId[papelizVaultId] !== undefined) continue
    const unfinishedRecentVault = recentVaults.find((recentVault) => recentVault.papelizVaultId === papelizVaultId)
    if (unfinishedRecentVault === undefined) continue
    addSyncStartScreenDownloadRow({
      papelizVaultId,
      papelizSyncVaultId,
      papelizVaultDisplayName: unfinishedRecentVault.papelizVaultDisplayName,
      isSyncFetchCopyOnly: fetchedCopyVaultIds.has(papelizVaultId),
    })
    const isFolderStillAllowed =
      unfinishedRecentVault.papelizRecentVaultKind === 'browser-vault-in-opfs' ||
      (await unfinishedRecentVault.papelizVaultFolderHandle.queryPermission({ mode: 'readwrite' }).catch(() => 'denied')) === 'granted'
    if (!isFolderStillAllowed) {
      syncStartScreenDownloadsWaitingToReopenByVaultId.set(papelizVaultId, { papelizSyncEngine, waitingRecentVault: unfinishedRecentVault })
      changeSyncStartScreenDownload(papelizVaultId, { syncStartScreenDownloadStage: 'stopped', syncStartScreenDownloadStopWords: papelizSyncDownloadPausedByClosingWords })
      continue
    }
    await reopenSyncStartScreenDownloadVault(papelizSyncEngine, unfinishedRecentVault)
  }
}

// Try again on a stopped row: opens the vault again if closing the tab left it shut, asks for the
// download again if the engine never took it, otherwise attaches the vault again so the engine picks
// up where it stopped. Runs from its click, so a folder can be asked for again.
export async function retryPapelizSyncStartScreenDownload(papelizVaultId: string): Promise<void> {
  const syncStartScreenDownloadWaitingToReopen = syncStartScreenDownloadsWaitingToReopenByVaultId.get(papelizVaultId)
  if (syncStartScreenDownloadWaitingToReopen !== undefined) {
    changeSyncStartScreenDownload(papelizVaultId, { syncStartScreenDownloadStage: 'downloading', syncStartScreenDownloadStopWords: null })
    await reopenSyncStartScreenDownloadVault(syncStartScreenDownloadWaitingToReopen.papelizSyncEngine, syncStartScreenDownloadWaitingToReopen.waitingRecentVault)
    return
  }
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

// Folder Storage for a download: the folder window, then the folder picked, only when it's empty. A
// folder with notes is turned down before it's remembered, so it doesn't join Recent Vaults (one that
// was there already stays as it was). Must run from a click.
export async function pickEmptyPapelizVaultFolderForSyncDownload(): Promise<{ papelizOpenVault: PapelizOpenVault } | { syncDownloadFolderRefusalWords: string }> {
  const vaultFolderPickResult = await pickPapelizVaultFolderHandle()
  if (!('vaultFolderPickOutcome' in vaultFolderPickResult)) {
    if (vaultFolderPickResult.openVaultOutcome === 'cancelled') return { syncDownloadFolderRefusalWords: 'No folder picked.' }
    if (vaultFolderPickResult.openVaultOutcome === 'chooser-unavailable') return { syncDownloadFolderRefusalWords: describePapelizFolderAccessOffReason('chooser-unavailable') }
    return { syncDownloadFolderRefusalWords: vaultFolderPickResult.openVaultFailureMessage }
  }
  const { papelizVaultFolderHandle } = vaultFolderPickResult
  if (!(await isPapelizVaultEmptyForSyncDownload(new PapelizFolderOnDiskVaultAdapter(papelizVaultFolderHandle)).catch(() => false))) {
    return { syncDownloadFolderRefusalWords: `“${papelizVaultFolderHandle.name}” isn’t empty. Pick an empty folder, or make a new one in the folder window.` }
  }
  const openVaultResult = await openPapelizVaultFolderHandle(papelizVaultFolderHandle)
  if (openVaultResult.openVaultOutcome === 'opened') return { papelizOpenVault: openVaultResult.papelizOpenVault }
  return { syncDownloadFolderRefusalWords: openVaultResult.openVaultOutcome === 'failed' ? openVaultResult.openVaultFailureMessage : 'No folder picked.' }
}

// A vault deleted from this device (Delete in the Hidden list): this device stops syncing it and
// forgets it was a copy, so Fetch from Sync offers its synced vault again rather than calling it on
// this device. The synced copy on the account is untouched.
export function forgetPapelizSyncLinksOfDeletedVault(papelizVaultId: string): void {
  forgetPapelizSyncFetchedCopy(papelizVaultId)
  const papelizSyncEngine = usePapelizSyncEngineStore.getState().papelizSyncEngine
  if (papelizSyncEngine?.getSyncEngineSnapshot().syncLinkedLocalVaults.some((syncLinkedLocalVault) => syncLinkedLocalVault.papelizVaultId === papelizVaultId)) {
    void papelizSyncEngine.turnSyncOffForVault(papelizVaultId)
  }
}

// Tests start each case from nothing.
export function resetPapelizSyncStartScreenDownloadsForTests(): void {
  for (const syncStartScreenDownloadAttachment of syncStartScreenDownloadAttachmentsByVaultId.values()) syncStartScreenDownloadAttachment.detachSyncFromDownloadedVault()
  syncStartScreenDownloadAttachmentsByVaultId.clear()
  syncStartScreenDownloadsWaitingToReopenByVaultId.clear()
  stopFollowingSyncEngineSnapshot?.()
  stopFollowingSyncEngineSnapshot = null
  usePapelizSyncStartScreenDownloadStore.setState({ syncStartScreenDownloadsByVaultId: {} })
}
