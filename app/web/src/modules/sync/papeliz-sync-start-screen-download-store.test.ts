import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPapelizFakeVaultFolder, readPapelizFakeVaultFolder, type PapelizFakeDirectoryHandle } from '../vault/papeliz-fake-file-system-access.test-support'
import { PapelizFolderOnDiskVaultAdapter } from '../vault/papeliz-folder-on-disk-vault-adapter'
import { PapelizInMemoryVaultAdapter } from '../vault/papeliz-in-memory-vault-adapter'
import type { PapelizOpenVault } from '../vault/papeliz-open-vault'
import type { PapelizRecentVault } from '../vault/papeliz-recent-vaults'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { usePapelizSyncEngineStore } from './papeliz-sync-engine-store'
import { createPapelizSyncFakeEngine, papelizSyncFakeEnginePassphrase } from './papeliz-sync-fake-engine'
import { listPapelizSyncFetchedCopies, listPapelizSyncVaultIdsCopiedHere, rememberPapelizSyncFetchedCopy } from './papeliz-sync-fetched-copies'
import { createPapelizSyncLocalVaultFiles } from './papeliz-sync-local-vault-files'
import {
  forgetPapelizSyncLinksOfDeletedVault,
  isPapelizVaultEmptyForSyncDownload,
  pickEmptyPapelizVaultFolderForSyncDownload,
  resetPapelizSyncStartScreenDownloadsForTests,
  resumePapelizSyncStartScreenDownloads,
  retryPapelizSyncStartScreenDownload,
  startPapelizSyncStartScreenDownload,
  usePapelizSyncStartScreenDownloadStore,
} from './papeliz-sync-start-screen-download-store'

// Which folders are remembered for Recent Vaults, by name: the real remembering, watched.
const rememberedTestVaultFolderNames = vi.hoisted((): string[] => [])
vi.mock('../vault/papeliz-remembered-vault-folders', async (importOriginal) => {
  const rememberedVaultFoldersModule = await importOriginal<typeof import('../vault/papeliz-remembered-vault-folders')>()
  return {
    ...rememberedVaultFoldersModule,
    rememberVaultFolder: (papelizVaultFolderHandle: FileSystemDirectoryHandle) => {
      rememberedTestVaultFolderNames.push(papelizVaultFolderHandle.name)
      return rememberedVaultFoldersModule.rememberVaultFolder(papelizVaultFolderHandle)
    },
  }
})

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

// A browser's storage in memory: the page's local storage, or the fake engine's kept device state.
function createTestBrowserStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const storedTextsByKey = new Map<string, string>()
  return {
    getItem: (storageKey) => storedTextsByKey.get(storageKey) ?? null,
    setItem: (storageKey, storedText) => void storedTextsByKey.set(storageKey, storedText),
    removeItem: (storageKey) => void storedTextsByKey.delete(storageKey),
  }
}

function createTestRecentFolderVault(papelizVaultId: string, fakeVaultRootHandle: PapelizFakeDirectoryHandle): PapelizRecentVault {
  return {
    papelizRecentVaultKind: 'folder-on-disk',
    papelizVaultId,
    papelizVaultDisplayName: fakeVaultRootHandle.name,
    papelizVaultFolderHandle: fakeVaultRootHandle.asFileSystemDirectoryHandle(),
    papelizVaultLastOpenedAt: 0,
  }
}

describe('a download that closing the tab left unfinished', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createTestBrowserStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // Signs in and unlocks a new device, starts a download into an empty folder, lets a few files come,
  // then closes the tab: the timers stop, and the next page load starts a new fake engine from what
  // the device kept.
  async function closeTabPartwayThroughTestDownload(isSyncFetchCopyOnly: boolean) {
    vi.useFakeTimers()
    const fakeEngineKeptStateStorage = createTestBrowserStorage()
    const firstPageFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'new-device', fakeCallDelayMilliseconds: 10, fakeEngineKeptStateStorage })
    firstPageFakeEngine.startSyncSignIn({ papelizSyncStoragePlaceForNewAccount: null })
    firstPageFakeEngine.finishFakeSyncSignIn()
    const unlock = firstPageFakeEngine.unlockSyncWithPassphrase(papelizSyncFakeEnginePassphrase)
    await vi.advanceTimersByTimeAsync(10)
    await unlock
    const { fakeVaultRootHandle, papelizOpenVault } = await createEmptyTestVault('closed-tab-vault')
    const startedDownload = startPapelizSyncStartScreenDownload({ papelizSyncEngine: firstPageFakeEngine, papelizOpenVault, papelizSyncVaultId: researchNotesSyncVaultId, isSyncFetchCopyOnly })
    await vi.advanceTimersByTimeAsync(10)
    await startedDownload
    await vi.advanceTimersByTimeAsync(400 * 2)
    expect(readStartScreenDownload('closed-tab-vault')?.syncTransferredFileCount).toBe(298)
    vi.clearAllTimers()
    resetPapelizSyncStartScreenDownloadsForTests()
    const nextPageFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'new-device', fakeCallDelayMilliseconds: 10, fakeEngineKeptStateStorage })
    return { fakeVaultRootHandle, nextPageFakeEngine }
  }

  it('picks up on the next start screen, still a copy, and finishes as one', async () => {
    const { fakeVaultRootHandle, nextPageFakeEngine } = await closeTabPartwayThroughTestDownload(true)
    expect(nextPageFakeEngine.getSyncEngineSnapshot().syncAccountKeyState).toBe('unlocked')
    expect(nextPageFakeEngine.getSyncEngineSnapshot().syncLinkedLocalVaults).toEqual([
      { papelizVaultId: 'closed-tab-vault', papelizSyncVaultId: researchNotesSyncVaultId, isFirstDownloadUnfinished: true },
    ])
    await resumePapelizSyncStartScreenDownloads(nextPageFakeEngine, [createTestRecentFolderVault('closed-tab-vault', fakeVaultRootHandle)])
    expect(readStartScreenDownload('closed-tab-vault')).toMatchObject({ syncStartScreenDownloadStage: 'downloading', isSyncFetchCopyOnly: true })
    expect(readStartScreenDownload('closed-tab-vault')?.syncTransferredFileCount).toBe(298)
    await vi.advanceTimersByTimeAsync(400 * 9)
    await vi.waitFor(() => expect(readStartScreenDownload('closed-tab-vault')).toBeUndefined())
    expect(Object.keys(await readPapelizFakeVaultFolder(fakeVaultRootHandle))).toContain('Sources/Interviews.md')
    expect(nextPageFakeEngine.fakeEngineCallNames).toContain('turnSyncOffForVault')
    expect(usePapelizWorkspaceStore.getState().workspaceNotice?.workspaceNoticeMessage).toBe('“Research notes” is on this device, as a copy that won’t sync.')
    // Not linked, yet not offered again: Fetch from Sync calls it a copy on this device.
    expect(nextPageFakeEngine.getSyncEngineSnapshot().syncLinkedLocalVaults).toEqual([])
    expect(listPapelizSyncVaultIdsCopiedHere(new Set(['closed-tab-vault']))).toEqual(new Set([researchNotesSyncVaultId]))
    expect(listPapelizSyncVaultIdsCopiedHere(new Set(['another-vault']))).toEqual(new Set())
  })

  it('waits for Try again when the browser has to ask about the folder again', async () => {
    const { fakeVaultRootHandle, nextPageFakeEngine } = await closeTabPartwayThroughTestDownload(false)
    fakeVaultRootHandle.fakePermissionStates = { queryPermissionState: 'prompt', requestPermissionState: 'granted' }
    await resumePapelizSyncStartScreenDownloads(nextPageFakeEngine, [createTestRecentFolderVault('closed-tab-vault', fakeVaultRootHandle)])
    expect(readStartScreenDownload('closed-tab-vault')).toMatchObject({ syncStartScreenDownloadStage: 'stopped', syncStartScreenDownloadStopWords: 'Papeliz closed before it finished.' })
    expect(fakeVaultRootHandle.requestPermissionCallCount).toBe(0)
    await retryPapelizSyncStartScreenDownload('closed-tab-vault')
    expect(fakeVaultRootHandle.requestPermissionCallCount).toBe(1)
    expect(readStartScreenDownload('closed-tab-vault')?.syncStartScreenDownloadStage).toBe('downloading')
    await vi.advanceTimersByTimeAsync(400 * 9)
    await vi.waitFor(() => expect(readStartScreenDownload('closed-tab-vault')).toBeUndefined())
    expect(nextPageFakeEngine.fakeEngineCallNames).not.toContain('turnSyncOffForVault')
    expect(usePapelizWorkspaceStore.getState().workspaceNotice?.workspaceNoticeMessage).toBe('“Research notes” is on this device.')
  })

  it('leaves alone a vault that is open in the workspace, or gone from Recent Vaults', async () => {
    const { fakeVaultRootHandle, nextPageFakeEngine } = await closeTabPartwayThroughTestDownload(false)
    await resumePapelizSyncStartScreenDownloads(nextPageFakeEngine, [])
    expect(readStartScreenDownload('closed-tab-vault')).toBeUndefined()
    usePapelizWorkspaceStore.setState({
      openVault: { papelizVaultId: 'closed-tab-vault', papelizVaultDisplayName: 'Research notes', papelizVaultAdapter: new PapelizInMemoryVaultAdapter([]) },
    })
    await resumePapelizSyncStartScreenDownloads(nextPageFakeEngine, [createTestRecentFolderVault('closed-tab-vault', fakeVaultRootHandle)])
    expect(readStartScreenDownload('closed-tab-vault')).toBeUndefined()
    usePapelizWorkspaceStore.setState({ openVault: null })
  })
})

describe('the folder for a download', () => {
  function stubTestFolderWindow(pickedVaultRootHandle: PapelizFakeDirectoryHandle) {
    vi.stubGlobal('window', { isSecureContext: true, showDirectoryPicker: async () => pickedVaultRootHandle.asFileSystemDirectoryHandle() })
  }

  beforeEach(() => {
    rememberedTestVaultFolderNames.length = 0
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is turned down when it has notes, before it joins Recent Vaults', async () => {
    stubTestFolderWindow(await createPapelizFakeVaultFolder('Old notes', { 'Inbox.md': '# Inbox' }))
    expect(await pickEmptyPapelizVaultFolderForSyncDownload()).toEqual({
      syncDownloadFolderRefusalWords: '“Old notes” isn’t empty. Pick an empty folder, or make a new one in the folder window.',
    })
    expect(rememberedTestVaultFolderNames).toEqual([])
  })

  it('opens and is remembered when it’s empty', async () => {
    stubTestFolderWindow(await createPapelizFakeVaultFolder('New place', {}))
    const syncDownloadFolderPickResult = await pickEmptyPapelizVaultFolderForSyncDownload()
    expect('papelizOpenVault' in syncDownloadFolderPickResult && syncDownloadFolderPickResult.papelizOpenVault.papelizVaultDisplayName).toBe('New place')
    expect(rememberedTestVaultFolderNames).toEqual(['New place'])
  })
})

describe('a vault deleted from this device', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createTestBrowserStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    usePapelizSyncEngineStore.setState({ papelizSyncEngine: null })
  })

  it('stops syncing here and is no longer counted as a copy', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'on' })
    usePapelizSyncEngineStore.setState({ papelizSyncEngine: papelizSyncFakeEngine })
    papelizSyncFakeEngine.attachSyncToOpenVault({
      papelizVaultId: 'deleted-vault',
      papelizVaultKind: 'browser-vault-in-opfs',
      papelizVaultDisplayName: 'Deleted',
      syncLocalVaultFiles: createPapelizSyncLocalVaultFiles(new PapelizInMemoryVaultAdapter([])),
    })
    rememberPapelizSyncFetchedCopy({ papelizVaultId: 'deleted-vault', papelizSyncVaultId: researchNotesSyncVaultId })
    forgetPapelizSyncLinksOfDeletedVault('deleted-vault')
    await vi.waitFor(() => expect(papelizSyncFakeEngine.getSyncEngineSnapshot().syncLinkedLocalVaults).toEqual([]))
    expect(listPapelizSyncFetchedCopies()).toEqual([])
    // A vault that never synced asks nothing of the engine.
    forgetPapelizSyncLinksOfDeletedVault('never-synced-vault')
    expect(papelizSyncFakeEngine.fakeEngineCallNames.filter((fakeEngineCallName) => fakeEngineCallName === 'turnSyncOffForVault')).toHaveLength(1)
  })
})
