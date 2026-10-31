import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPapelizFakeVaultFolder, readPapelizFakeVaultFolder } from '../vault/papeliz-fake-file-system-access.test-support'
import { PapelizFolderOnDiskVaultAdapter } from '../vault/papeliz-folder-on-disk-vault-adapter'
import { PapelizInMemoryVaultAdapter } from '../vault/papeliz-in-memory-vault-adapter'
import type { PapelizOpenVault } from '../vault/papeliz-open-vault'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { createPapelizSyncFakeEngine, papelizSyncFakeEnginePassphrase } from './papeliz-sync-fake-engine'
import {
  isPapelizVaultEmptyForSyncDownload,
  resetPapelizSyncStartScreenDownloadsForTests,
  retryPapelizSyncStartScreenDownload,
  startPapelizSyncStartScreenDownload,
  usePapelizSyncStartScreenDownloadStore,
} from './papeliz-sync-start-screen-download-store'

// Fetch from Sync's downloads from the start screen, against the fake engine's new-device scenarios.

const researchNotesSyncVaultId = 'pzvault_dddddddddddddddddddddddddd'

// A new, empty folder on this device for a download to fill (in the fake file system), which the
// fake engine writes the synced vault's notes into.
async function createEmptyTestVault(papelizVaultId: string) {
  const fakeVaultRootHandle = await createPapelizFakeVaultFolder('Research notes', {})
  const papelizOpenVault: PapelizOpenVault = {
    papelizVaultId,
    papelizVaultDisplayName: 'Research notes',
    papelizVaultAdapter: new PapelizFolderOnDiskVaultAdapter(fakeVaultRootHandle.asFileSystemDirectoryHandle()),
  }
  return { fakeVaultRootHandle, papelizOpenVault }
}

function readStartScreenDownload(papelizVaultId: string) {
  return usePapelizSyncStartScreenDownloadStore.getState().syncStartScreenDownloadsByVaultId[papelizVaultId]
}

beforeEach(() => {
  resetPapelizSyncStartScreenDownloadsForTests()
  usePapelizWorkspaceStore.setState({ workspaceNotice: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('a download from the start screen', () => {
  it('fills the new vault, keeps it syncing and offers Open', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'download-stops' })
    const { fakeVaultRootHandle, papelizOpenVault } = await createEmptyTestVault('downloaded-vault')
    await startPapelizSyncStartScreenDownload({
      papelizSyncEngine: papelizSyncFakeEngine,
      papelizOpenVault,
      papelizSyncVaultId: researchNotesSyncVaultId,
      isSyncFetchCopyOnly: false,
    })
    expect(papelizSyncFakeEngine.fakeEngineCallNames).toContain('downloadSyncedVaultInto')
    await vi.waitFor(() => expect(readStartScreenDownload('downloaded-vault')).toBeUndefined())
    const downloadedVaultFolderContents = await readPapelizFakeVaultFolder(fakeVaultRootHandle)
    expect(downloadedVaultFolderContents['Reading list.md']).toContain('# Reading list')
    expect(downloadedVaultFolderContents['Sources/Interviews.md']).toContain('# Interviews')
    expect(papelizSyncFakeEngine.fakeEngineCallNames).not.toContain('turnSyncOffForVault')
    const workspaceNotice = usePapelizWorkspaceStore.getState().workspaceNotice
    expect(workspaceNotice?.workspaceNoticeMessage).toBe('“Research notes” is on this device.')
    expect(workspaceNotice?.workspaceNoticeAction?.workspaceNoticeActionLabel).toBe('Open')
    // The account now lists it as on this device, so Fetch from Sync won't offer it again.
    const accountVaultsOutcome = await papelizSyncFakeEngine.listSyncedVaultsOnAccount()
    expect(accountVaultsOutcome.syncActionOutcome === 'done' && accountVaultsOutcome.syncActionDoneValue.find((accountVault) => accountVault.papelizSyncVaultId === researchNotesSyncVaultId)?.papelizVaultIdOnThisDevice).toBe(
      'downloaded-vault',
    )
  })

  it('turns Sync off once a copy is all here', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'download-stops' })
    await startPapelizSyncStartScreenDownload({
      papelizSyncEngine: papelizSyncFakeEngine,
      papelizOpenVault: (await createEmptyTestVault('copied-vault')).papelizOpenVault,
      papelizSyncVaultId: researchNotesSyncVaultId,
      isSyncFetchCopyOnly: true,
    })
    await vi.waitFor(() => expect(usePapelizWorkspaceStore.getState().workspaceNotice).not.toBeNull())
    expect(papelizSyncFakeEngine.fakeEngineCallNames).toContain('turnSyncOffForVault')
    expect(usePapelizWorkspaceStore.getState().workspaceNotice?.workspaceNoticeMessage).toBe('“Research notes” is on this device, as a copy that won’t sync.')
  })

  it('stops where the connection dropped, and picks up from there on Try again', async () => {
    vi.useFakeTimers()
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'download-stops', fakeCallDelayMilliseconds: 10 })
    const { fakeVaultRootHandle, papelizOpenVault } = await createEmptyTestVault('stopped-vault')
    const startedDownload = startPapelizSyncStartScreenDownload({
      papelizSyncEngine: papelizSyncFakeEngine,
      papelizOpenVault,
      papelizSyncVaultId: researchNotesSyncVaultId,
      isSyncFetchCopyOnly: false,
    })
    await vi.advanceTimersByTimeAsync(10)
    await startedDownload
    expect(readStartScreenDownload('stopped-vault')?.syncStartScreenDownloadStage).toBe('downloading')
    await vi.advanceTimersByTimeAsync(400 * 5)
    const stoppedDownload = readStartScreenDownload('stopped-vault')
    expect(stoppedDownload?.syncStartScreenDownloadStage).toBe('stopped')
    expect(stoppedDownload?.syncStartScreenDownloadStopWords).toBe('Can’t reach Sync.')
    expect(stoppedDownload?.syncTransferredFileCount).toBe(745)
    expect(stoppedDownload?.syncTransferFileCount).toBe(1482)
    expect(await readPapelizFakeVaultFolder(fakeVaultRootHandle)).toEqual({})

    await retryPapelizSyncStartScreenDownload('stopped-vault')
    expect(readStartScreenDownload('stopped-vault')?.syncStartScreenDownloadStage).toBe('downloading')
    await vi.advanceTimersByTimeAsync(400 * 6)
    expect(readStartScreenDownload('stopped-vault')).toBeUndefined()
    expect(Object.keys(await readPapelizFakeVaultFolder(fakeVaultRootHandle))).toContain('Sources/Interviews.md')
    expect(usePapelizWorkspaceStore.getState().workspaceNotice?.workspaceNoticeMessage).toBe('“Research notes” is on this device.')
  })

  it('stops with the reason when the engine refuses it', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'new-device' })
    await startPapelizSyncStartScreenDownload({
      papelizSyncEngine: papelizSyncFakeEngine,
      papelizOpenVault: (await createEmptyTestVault('refused-vault')).papelizOpenVault,
      papelizSyncVaultId: researchNotesSyncVaultId,
      isSyncFetchCopyOnly: false,
    })
    expect(readStartScreenDownload('refused-vault')?.syncStartScreenDownloadStage).toBe('stopped')
    expect(readStartScreenDownload('refused-vault')?.syncStartScreenDownloadStopWords).not.toBeNull()
  })
})

describe('the new-device scenario', () => {
  it('signs in locked, and lists three vaults with their names once unlocked', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'new-device' })
    expect(papelizSyncFakeEngine.getSyncEngineSnapshot().syncSignIn.syncSignInKind).toBe('signed-out')
    papelizSyncFakeEngine.startSyncSignIn({ papelizSyncStoragePlaceForNewAccount: null })
    papelizSyncFakeEngine.finishFakeSyncSignIn()
    expect(papelizSyncFakeEngine.getSyncEngineSnapshot().syncAccountKeyState).toBe('locked')
    expect(papelizSyncFakeEngine.getSyncEngineSnapshot().syncAccount?.syncSubscriptionState).toBe('active')
    const lockedVaultsOutcome = await papelizSyncFakeEngine.listSyncedVaultsOnAccount()
    expect(lockedVaultsOutcome.syncActionOutcome === 'done' && lockedVaultsOutcome.syncActionDoneValue.map((accountVault) => accountVault.syncVaultName)).toEqual([null, null, null])
    await papelizSyncFakeEngine.unlockSyncWithPassphrase(papelizSyncFakeEnginePassphrase)
    const unlockedVaultsOutcome = await papelizSyncFakeEngine.listSyncedVaultsOnAccount()
    expect(unlockedVaultsOutcome.syncActionOutcome === 'done' && unlockedVaultsOutcome.syncActionDoneValue.map((accountVault) => accountVault.syncVaultName)).toEqual([
      'Research notes',
      'Work',
      'Recipes',
    ])
  })
})

describe('an empty vault for a download', () => {
  it('has no notes or files', async () => {
    expect(await isPapelizVaultEmptyForSyncDownload(new PapelizInMemoryVaultAdapter([]))).toBe(true)
    expect(await isPapelizVaultEmptyForSyncDownload(new PapelizInMemoryVaultAdapter([{ vaultNoteRelativePath: 'Inbox.md', vaultNoteText: 'Hello' }]))).toBe(false)
  })
})
