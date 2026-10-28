import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PapelizFakeDirectoryHandle } from '../vault/papeliz-fake-file-system-access.test-support'
import { createPapelizFakeVaultFolder, readPapelizFakeVaultFolder } from '../vault/papeliz-fake-file-system-access.test-support'

// Two tabs of one browser on the same folder vault. Each tab is the app loaded once more: its own
// workspace store, its own change channel and its own sender, as two real tabs have.

type PapelizWorkspaceStoreHook = (typeof import('./papeliz-workspace-store'))['usePapelizWorkspaceStore']

const gardenNoteText = '# Garden\n\nKale\nBeans\nTomatoes\n'
const vaultTabsOpenInTest: PapelizWorkspaceStoreHook[] = []

async function openVaultInAnotherTab(fakeVaultRootHandle: PapelizFakeDirectoryHandle): Promise<PapelizWorkspaceStoreHook> {
  vi.resetModules()
  const { usePapelizWorkspaceStore } = await import('./papeliz-workspace-store')
  const { PapelizFolderOnDiskVaultAdapter } = await import('../vault/papeliz-folder-on-disk-vault-adapter')
  await usePapelizWorkspaceStore.getState().openVaultInWorkspace(
    {
      papelizVaultId: 'two-tabs-vault',
      papelizVaultDisplayName: 'Field Notes',
      papelizVaultAdapter: new PapelizFolderOnDiskVaultAdapter(fakeVaultRootHandle as unknown as FileSystemDirectoryHandle),
    },
    { firstVaultNoteRelativePathToOpen: 'Garden.md', firstNoteViewMode: 'md-code', expandAllTopLevelFolders: false },
  )
  vaultTabsOpenInTest.push(usePapelizWorkspaceStore)
  return usePapelizWorkspaceStore
}

async function openVaultInTwoTabs(fakeVaultFileContentsByRelativePath: Record<string, string>) {
  const fakeVaultRootHandle = await createPapelizFakeVaultFolder('Field Notes', fakeVaultFileContentsByRelativePath)
  const firstVaultTab = await openVaultInAnotherTab(fakeVaultRootHandle)
  const secondVaultTab = await openVaultInAnotherTab(fakeVaultRootHandle)
  return { fakeVaultRootHandle, firstVaultTab, secondVaultTab }
}

function typeIntoVaultNoteInTab(vaultTab: PapelizWorkspaceStoreHook, vaultNoteRelativePath: string, typedVaultNoteText: string) {
  const loadedVaultNote = vaultTab.getState().loadedVaultNotesByRelativePath[vaultNoteRelativePath]!
  vaultTab.getState().updateVaultNoteDraftText(loadedVaultNote.loadedNoteSessionId, typedVaultNoteText)
}

async function waitInTestUntil(isTestConditionMet: () => boolean) {
  for (let attempt = 0; attempt < 100 && !isTestConditionMet(); attempt += 1) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 20))
  }
  expect(isTestConditionMet()).toBe(true)
}

afterEach(async () => {
  for (const vaultTab of vaultTabsOpenInTest.splice(0)) await vaultTab.getState().closeVaultInWorkspace()
})

describe('one folder vault open in two tabs', () => {
  it('shows a note saved in one tab in the other', async () => {
    const { firstVaultTab, secondVaultTab } = await openVaultInTwoTabs({ 'Garden.md': gardenNoteText })
    typeIntoVaultNoteInTab(firstVaultTab, 'Garden.md', '# Garden\n\nKale\nBeans\nPeppers\n')
    await firstVaultTab.getState().saveVaultNoteNow('Garden.md')
    await waitInTestUntil(() => secondVaultTab.getState().loadedVaultNotesByRelativePath['Garden.md']?.draftVaultNoteText.includes('Peppers') === true)
    expect(secondVaultTab.getState().loadedVaultNotesByRelativePath['Garden.md']).toMatchObject({
      savedVaultNoteText: '# Garden\n\nKale\nBeans\nPeppers\n',
      noteSaveState: 'saved',
    })
  })

  it('keeps both tabs’ changes when they changed different lines', async () => {
    const { fakeVaultRootHandle, firstVaultTab, secondVaultTab } = await openVaultInTwoTabs({ 'Garden.md': gardenNoteText })
    typeIntoVaultNoteInTab(firstVaultTab, 'Garden.md', '# Garden\n\nKale, curly\nBeans\nTomatoes\n')
    typeIntoVaultNoteInTab(secondVaultTab, 'Garden.md', '# Garden\n\nKale\nBeans\nTomatoes, cherry\n')
    await firstVaultTab.getState().saveVaultNoteNow('Garden.md')
    await secondVaultTab.getState().saveVaultNoteNow('Garden.md')
    const bothTabsVaultNoteText = '# Garden\n\nKale, curly\nBeans\nTomatoes, cherry\n'
    expect((await readPapelizFakeVaultFolder(fakeVaultRootHandle))['Garden.md']).toBe(bothTabsVaultNoteText)
    // The first tab, with nothing left unsaved, takes in the combined note.
    await waitInTestUntil(() => firstVaultTab.getState().loadedVaultNotesByRelativePath['Garden.md']?.draftVaultNoteText === bothTabsVaultNoteText)
    expect(secondVaultTab.getState().loadedVaultNotesByRelativePath['Garden.md']?.noteSaveState).toBe('saved')
  })

  it('asks in the second tab when both changed the same line, and keeps both lines unless told otherwise', async () => {
    const { fakeVaultRootHandle, firstVaultTab, secondVaultTab } = await openVaultInTwoTabs({ 'Garden.md': gardenNoteText })
    typeIntoVaultNoteInTab(firstVaultTab, 'Garden.md', '# Garden\n\nKale, curly\nBeans\nTomatoes\n')
    typeIntoVaultNoteInTab(secondVaultTab, 'Garden.md', '# Garden\n\nKale, red\nBeans\nTomatoes\n')
    await firstVaultTab.getState().saveVaultNoteNow('Garden.md')
    await secondVaultTab.getState().saveVaultNoteNow('Garden.md')
    const secondTabGardenNote = secondVaultTab.getState().loadedVaultNotesByRelativePath['Garden.md']!
    expect(secondTabGardenNote.noteSaveState).toBe('save-conflict')
    // Nothing is written over while the second tab waits.
    expect((await readPapelizFakeVaultFolder(fakeVaultRootHandle))['Garden.md']).toBe('# Garden\n\nKale, curly\nBeans\nTomatoes\n')
    await secondVaultTab.getState().resolveVaultNoteSaveConflict(secondTabGardenNote.loadedNoteSessionId, {})
    const savedGardenNoteText = (await readPapelizFakeVaultFolder(fakeVaultRootHandle))['Garden.md']
    expect(savedGardenNoteText).toContain('Kale, curly')
    expect(savedGardenNoteText).toContain('Kale, red')
    await waitInTestUntil(() => firstVaultTab.getState().loadedVaultNotesByRelativePath['Garden.md']?.draftVaultNoteText === savedGardenNoteText)
  })

  it('shows a note made or renamed in one tab in the other’s file list', async () => {
    const { secondVaultTab, firstVaultTab } = await openVaultInTwoTabs({ 'Garden.md': gardenNoteText, 'Beans.md': '# Beans\n' })
    await firstVaultTab.getState().renameVaultEntry('Beans.md', 'Peas')
    await firstVaultTab.getState().createVaultNoteFromAssistant('Seeds/Order.md', '# Order\n')
    const listedInSecondTab = () => secondVaultTab.getState().vaultTreeEntries.map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath)
    await waitInTestUntil(() => listedInSecondTab().includes('Peas.md') && listedInSecondTab().includes('Seeds/Order.md'))
    expect(listedInSecondTab()).not.toContain('Beans.md')
  })

  it('closes a note in the other tab when it was trashed in one, and nothing was unsaved there', async () => {
    const { fakeVaultRootHandle, firstVaultTab, secondVaultTab } = await openVaultInTwoTabs({ 'Garden.md': gardenNoteText, 'Beans.md': '# Beans\n' })
    await firstVaultTab.getState().moveVaultEntryToTrash('Garden.md')
    await waitInTestUntil(() => !secondVaultTab.getState().openNoteTabRelativePaths.includes('Garden.md'))
    expect(secondVaultTab.getState().loadedVaultNotesByRelativePath['Garden.md']).toBeUndefined()
    await new Promise((resolveWait) => setTimeout(resolveWait, 900))
    expect(Object.keys(await readPapelizFakeVaultFolder(fakeVaultRootHandle))).not.toContain('Garden.md')
  })

  it('never writes a trashed note back by itself when the other tab still had changes to it', async () => {
    const { fakeVaultRootHandle, firstVaultTab, secondVaultTab } = await openVaultInTwoTabs({ 'Garden.md': gardenNoteText })
    typeIntoVaultNoteInTab(secondVaultTab, 'Garden.md', '# Garden\n\nKale\nBeans\nTomatoes, cherry\n')
    await firstVaultTab.getState().moveVaultEntryToTrash('Garden.md')
    await secondVaultTab.getState().saveVaultNoteNow('Garden.md')
    expect(Object.keys(await readPapelizFakeVaultFolder(fakeVaultRootHandle))).not.toContain('Garden.md')
    const secondTabGardenNote = secondVaultTab.getState().loadedVaultNotesByRelativePath['Garden.md']!
    expect(secondTabGardenNote.noteSaveState).toBe('save-conflict')
    expect(secondVaultTab.getState().vaultNoteSaveConflictsByLoadedNoteSessionId[secondTabGardenNote.loadedNoteSessionId]?.vaultNoteSaveConflictKind).toBe(
      'deleted-elsewhere',
    )
    // Keep my copy puts it back, with this tab's changes.
    await secondVaultTab.getState().resolveVaultNoteDeletedElsewhere(secondTabGardenNote.loadedNoteSessionId, 'keep-my-copy')
    expect((await readPapelizFakeVaultFolder(fakeVaultRootHandle))['Garden.md']).toBe('# Garden\n\nKale\nBeans\nTomatoes, cherry\n')
    expect(secondVaultTab.getState().loadedVaultNotesByRelativePath['Garden.md']?.noteSaveState).toBe('saved')
  })

  it('lets the other tab close a trashed note it had changes to, without writing it back', async () => {
    const { fakeVaultRootHandle, firstVaultTab, secondVaultTab } = await openVaultInTwoTabs({ 'Garden.md': gardenNoteText, 'Beans.md': '# Beans\n' })
    typeIntoVaultNoteInTab(secondVaultTab, 'Garden.md', '# Garden\n\nKale\nBeans\nTomatoes, cherry\n')
    await firstVaultTab.getState().moveVaultEntryToTrash('Garden.md')
    await secondVaultTab.getState().saveVaultNoteNow('Garden.md')
    const secondTabGardenNote = secondVaultTab.getState().loadedVaultNotesByRelativePath['Garden.md']!
    await secondVaultTab.getState().resolveVaultNoteDeletedElsewhere(secondTabGardenNote.loadedNoteSessionId, 'close-note')
    expect(secondVaultTab.getState().openNoteTabRelativePaths).not.toContain('Garden.md')
    await new Promise((resolveWait) => setTimeout(resolveWait, 900))
    expect(Object.keys(await readPapelizFakeVaultFolder(fakeVaultRootHandle))).not.toContain('Garden.md')
  })
})
