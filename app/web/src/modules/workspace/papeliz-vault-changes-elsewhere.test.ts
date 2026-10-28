import { afterEach, describe, expect, it } from 'vitest'
import { createPapelizFakeVaultFolder, readPapelizFakeVaultFolder } from '../vault/papeliz-fake-file-system-access.test-support'
import { PapelizFolderOnDiskVaultAdapter } from '../vault/papeliz-folder-on-disk-vault-adapter'
import type { PapelizVaultChangeMessage } from './papeliz-vault-change-channel'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

const gardenNoteText = '# Garden\n\nKale\nBeans\nTomatoes\n'

async function openFolderTestVault(fakeVaultFileContentsByRelativePath: Record<string, string>) {
  const fakeVaultRootHandle = await createPapelizFakeVaultFolder('Field Notes', fakeVaultFileContentsByRelativePath)
  const folderVaultAdapter = new PapelizFolderOnDiskVaultAdapter(fakeVaultRootHandle as unknown as FileSystemDirectoryHandle)
  await usePapelizWorkspaceStore.getState().openVaultInWorkspace(
    { papelizVaultId: 'changes-elsewhere-vault', papelizVaultDisplayName: 'Field Notes', papelizVaultAdapter: folderVaultAdapter },
    { firstVaultNoteRelativePathToOpen: 'Garden.md', firstNoteViewMode: 'md-code', expandAllTopLevelFolders: false },
  )
  return { fakeVaultRootHandle, folderVaultAdapter }
}

function typeIntoVaultNote(vaultNoteRelativePath: string, typedVaultNoteText: string) {
  const loadedVaultNote = usePapelizWorkspaceStore.getState().loadedVaultNotesByRelativePath[vaultNoteRelativePath]!
  usePapelizWorkspaceStore.getState().updateVaultNoteDraftText(loadedVaultNote.loadedNoteSessionId, typedVaultNoteText)
}

afterEach(async () => {
  await usePapelizWorkspaceStore.getState().closeVaultInWorkspace()
})

describe('a note changed in another tab or app', () => {
  it('combines this tab’s changes with a version saved elsewhere when they touch different lines', async () => {
    const { fakeVaultRootHandle, folderVaultAdapter } = await openFolderTestVault({ 'Garden.md': gardenNoteText })
    typeIntoVaultNote('Garden.md', '# Garden\n\nKale\nBeans\nTomatoes, cherry\n')
    await folderVaultAdapter.writeVaultNoteText('Garden.md', '# Garden\n\nKale, curly\nBeans\nTomatoes\n')
    await usePapelizWorkspaceStore.getState().saveVaultNoteNow('Garden.md')
    expect((await readPapelizFakeVaultFolder(fakeVaultRootHandle))['Garden.md']).toBe('# Garden\n\nKale, curly\nBeans\nTomatoes, cherry\n')
    expect(usePapelizWorkspaceStore.getState().loadedVaultNotesByRelativePath['Garden.md']).toMatchObject({
      draftVaultNoteText: '# Garden\n\nKale, curly\nBeans\nTomatoes, cherry\n',
      noteSaveState: 'saved',
    })
  })

  it('waits for the user where both changed the same line, then saves what they chose', async () => {
    const { fakeVaultRootHandle, folderVaultAdapter } = await openFolderTestVault({ 'Garden.md': gardenNoteText })
    typeIntoVaultNote('Garden.md', '# Garden\n\nKale, red\nBeans\nTomatoes\n')
    await folderVaultAdapter.writeVaultNoteText('Garden.md', '# Garden\n\nKale, curly\nBeans\nTomatoes\n')
    await usePapelizWorkspaceStore.getState().saveVaultNoteNow('Garden.md')
    const loadedGardenNote = usePapelizWorkspaceStore.getState().loadedVaultNotesByRelativePath['Garden.md']!
    expect(loadedGardenNote.noteSaveState).toBe('save-conflict')
    expect((await readPapelizFakeVaultFolder(fakeVaultRootHandle))['Garden.md']).toBe('# Garden\n\nKale, curly\nBeans\nTomatoes\n')
    await usePapelizWorkspaceStore.getState().resolveVaultNoteSaveConflict(loadedGardenNote.loadedNoteSessionId, { 'conflict-1': 'mine' })
    expect((await readPapelizFakeVaultFolder(fakeVaultRootHandle))['Garden.md']).toBe('# Garden\n\nKale, red\nBeans\nTomatoes\n')
    expect(usePapelizWorkspaceStore.getState().loadedVaultNotesByRelativePath['Garden.md']?.noteSaveState).toBe('saved')
  })

  it('takes in a version another tab saved when this tab has no changes of its own', async () => {
    const { folderVaultAdapter } = await openFolderTestVault({ 'Garden.md': gardenNoteText })
    await folderVaultAdapter.writeVaultNoteText('Garden.md', '# Garden\n\nKale\nBeans\nPeppers\n')
    // As another tab of this browser would announce it.
    const otherTabChannel = new BroadcastChannel('papeliz:vault-changes:v1')
    otherTabChannel.postMessage({
      vaultChangeMessageVersion: 1,
      papelizVaultId: 'changes-elsewhere-vault',
      changedVaultNoteRelativePaths: ['Garden.md'],
      vaultChangeSenderId: 'another-tab',
    } satisfies PapelizVaultChangeMessage)
    otherTabChannel.close()
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (usePapelizWorkspaceStore.getState().loadedVaultNotesByRelativePath['Garden.md']?.draftVaultNoteText.includes('Peppers')) break
      await new Promise((resolveWait) => setTimeout(resolveWait, 20))
    }
    expect(usePapelizWorkspaceStore.getState().loadedVaultNotesByRelativePath['Garden.md']).toMatchObject({
      savedVaultNoteText: '# Garden\n\nKale\nBeans\nPeppers\n',
      draftVaultNoteText: '# Garden\n\nKale\nBeans\nPeppers\n',
    })
  })
})
