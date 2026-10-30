import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPapelizBrowserVault, openPapelizBrowserVault, type PapelizBrowserVaultEnvironment } from '../vault/papeliz-browser-vaults'
import { createPapelizFakeBrowserVaultEnvironment, getPapelizFakeBrowserVaultFolder } from '../vault/papeliz-fake-browser-vault-environment.test-support'
import { addPapelizFakeVaultFiles, readPapelizFakeVaultFolder } from '../vault/papeliz-fake-file-system-access.test-support'

// Two tabs of one browser on the same browser vault. Each tab is the app loaded once more (its own
// workspace store and change channel), sharing one browser: the same storage and the same Web Locks.

type PapelizWorkspaceStoreHook = (typeof import('./papeliz-workspace-store'))['usePapelizWorkspaceStore']

const gardenNoteText = '# Garden\n\nKale\nBeans\nTomatoes\n'
const vaultTabsOpenInTest: PapelizWorkspaceStoreHook[] = []

async function openBrowserVaultInAnotherTab(browserVaultEnvironment: PapelizBrowserVaultEnvironment, papelizVaultId: string): Promise<PapelizWorkspaceStoreHook> {
  vi.resetModules()
  const { usePapelizWorkspaceStore } = await import('./papeliz-workspace-store')
  const browserVaultRecords = await browserVaultEnvironment.browserVaultRecordStore.readAllBrowserVaultRecords()
  const browserVaultRecord = browserVaultRecords.find((storedBrowserVaultRecord) => storedBrowserVaultRecord.papelizVaultId === papelizVaultId)!
  const openVaultResult = await openPapelizBrowserVault(browserVaultRecord, browserVaultEnvironment)
  if (openVaultResult.openVaultOutcome !== 'opened') throw new Error('The test vault didn’t open.')
  await usePapelizWorkspaceStore.getState().openVaultInWorkspace(openVaultResult.papelizOpenVault, {
    firstVaultNoteRelativePathToOpen: 'Garden.md',
    firstNoteViewMode: 'md-code',
    expandAllTopLevelFolders: false,
  })
  vaultTabsOpenInTest.push(usePapelizWorkspaceStore)
  return usePapelizWorkspaceStore
}

async function openBrowserVaultInTwoTabs() {
  const { browserVaultEnvironment, fakeOriginPrivateFileSystemRoot, fakeLockManager } = createPapelizFakeBrowserVaultEnvironment()
  const browserVaultRecord = await createPapelizBrowserVault('Field Notes', browserVaultEnvironment)
  const fakeVaultRootHandle = await getPapelizFakeBrowserVaultFolder(fakeOriginPrivateFileSystemRoot, browserVaultRecord.papelizVaultId)
  await addPapelizFakeVaultFiles(fakeVaultRootHandle, { 'Garden.md': gardenNoteText })
  const firstVaultTab = await openBrowserVaultInAnotherTab(browserVaultEnvironment, browserVaultRecord.papelizVaultId)
  const secondVaultTab = await openBrowserVaultInAnotherTab(browserVaultEnvironment, browserVaultRecord.papelizVaultId)
  return { fakeVaultRootHandle, fakeLockManager, browserVaultRecord, firstVaultTab, secondVaultTab }
}

function typeIntoVaultNoteInTab(vaultTab: PapelizWorkspaceStoreHook, vaultNoteRelativePath: string, typedVaultNoteText: string) {
  const loadedVaultNote = vaultTab.getState().loadedVaultNotesByRelativePath[vaultNoteRelativePath]!
  vaultTab.getState().updateVaultNoteDraftText(loadedVaultNote.loadedNoteSessionId, typedVaultNoteText)
}

afterEach(async () => {
  for (const vaultTab of vaultTabsOpenInTest.splice(0)) await vaultTab.getState().closeVaultInWorkspace()
})

describe('one browser vault open in two tabs', () => {
  it('keeps both tabs’ changes when both save at the same moment', async () => {
    const { fakeVaultRootHandle, firstVaultTab, secondVaultTab } = await openBrowserVaultInTwoTabs()
    typeIntoVaultNoteInTab(firstVaultTab, 'Garden.md', '# Garden\n\nKale, curly\nBeans\nTomatoes\n')
    typeIntoVaultNoteInTab(secondVaultTab, 'Garden.md', '# Garden\n\nKale\nBeans\nTomatoes, cherry\n')
    // Neither waits for the other: the writes lock makes them take turns, and the second merges.
    await Promise.all([firstVaultTab.getState().saveVaultNoteNow('Garden.md'), secondVaultTab.getState().saveVaultNoteNow('Garden.md')])
    expect((await readPapelizFakeVaultFolder(fakeVaultRootHandle))['Garden.md']).toBe('# Garden\n\nKale, curly\nBeans\nTomatoes, cherry\n')
    expect(firstVaultTab.getState().loadedVaultNotesByRelativePath['Garden.md']?.noteSaveState).toBe('saved')
    expect(secondVaultTab.getState().loadedVaultNotesByRelativePath['Garden.md']?.noteSaveState).toBe('saved')
  })

  it('asks when both changed the same line at the same moment', async () => {
    const { firstVaultTab, secondVaultTab } = await openBrowserVaultInTwoTabs()
    typeIntoVaultNoteInTab(firstVaultTab, 'Garden.md', '# Garden\n\nKale, curly\nBeans\nTomatoes\n')
    typeIntoVaultNoteInTab(secondVaultTab, 'Garden.md', '# Garden\n\nKale, red\nBeans\nTomatoes\n')
    await Promise.all([firstVaultTab.getState().saveVaultNoteNow('Garden.md'), secondVaultTab.getState().saveVaultNoteNow('Garden.md')])
    const noteSaveStates = [firstVaultTab, secondVaultTab].map((vaultTab) => vaultTab.getState().loadedVaultNotesByRelativePath['Garden.md']?.noteSaveState).sort()
    expect(noteSaveStates).toEqual(['save-conflict', 'saved'])
  })

  it('lets go of the vault when the last tab closes it', async () => {
    const { fakeLockManager, browserVaultRecord, firstVaultTab, secondVaultTab } = await openBrowserVaultInTwoTabs()
    const heldOpenLockCount = async () =>
      (await fakeLockManager.query()).held.filter((heldLock) => heldLock.name === `papeliz-browser-vault-open:${browserVaultRecord.papelizVaultId}`).length
    await vi.waitFor(async () => expect(await heldOpenLockCount()).toBe(2))
    await firstVaultTab.getState().closeVaultInWorkspace()
    await vi.waitFor(async () => expect(await heldOpenLockCount()).toBe(1))
    await secondVaultTab.getState().closeVaultInWorkspace()
    await vi.waitFor(async () => expect(await heldOpenLockCount()).toBe(0))
  })
})
