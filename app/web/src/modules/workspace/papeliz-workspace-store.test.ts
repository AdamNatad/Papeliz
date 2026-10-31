import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePapelizSyncEngineStore } from '../sync/papeliz-sync-engine-store'
import { createPapelizSyncFakeEngine } from '../sync/papeliz-sync-fake-engine'
import { createPapelizFakeVaultFolder } from '../vault/papeliz-fake-file-system-access.test-support'
import { PapelizFolderOnDiskVaultAdapter } from '../vault/papeliz-folder-on-disk-vault-adapter'
import { PapelizInMemoryVaultAdapter, type PapelizInMemoryVaultNote } from '../vault/papeliz-in-memory-vault-adapter'
import type { PapelizVaultAdapter } from '../vault/papeliz-vault-adapter'
import { selectActiveVaultNoteLockingEntry, usePapelizWorkspaceStore } from './papeliz-workspace-store'

let testVaultCounter = 0

async function openTestVault(testVaultNotes: readonly PapelizInMemoryVaultNote[], testVaultAdapter?: PapelizVaultAdapter) {
  const vaultAdapter = testVaultAdapter ?? new PapelizInMemoryVaultAdapter(testVaultNotes)
  testVaultCounter += 1
  await usePapelizWorkspaceStore.getState().openVaultInWorkspace(
    { papelizVaultId: `test-vault-${testVaultCounter}`, papelizVaultDisplayName: 'Test vault', papelizVaultAdapter: vaultAdapter },
    { firstVaultNoteRelativePathToOpen: null, firstNoteViewMode: 'md-code', expandAllTopLevelFolders: false },
  )
  return vaultAdapter
}

function typeIntoVaultNote(vaultNoteRelativePath: string, typedVaultNoteText: string) {
  const workspaceState = usePapelizWorkspaceStore.getState()
  const loadedVaultNote = workspaceState.loadedVaultNotesByRelativePath[vaultNoteRelativePath]
  if (loadedVaultNote === undefined) throw new Error(`${vaultNoteRelativePath} is not open`)
  workspaceState.updateVaultNoteDraftText(loadedVaultNote.loadedNoteSessionId, typedVaultNoteText)
}

function getNoteSaveState(vaultNoteRelativePath: string) {
  return usePapelizWorkspaceStore.getState().loadedVaultNotesByRelativePath[vaultNoteRelativePath]?.noteSaveState
}

// Waits until every save, rename and move already queued has finished.
async function waitForQueuedVaultOperations() {
  await usePapelizWorkspaceStore.getState().saveVaultNoteNow('no note has this path')
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(async () => {
  vi.useRealTimers()
  await usePapelizWorkspaceStore.getState().closeVaultInWorkspace()
})

describe('autosave', () => {
  it('saves a moment after typing stops, not on every key', async () => {
    const vaultAdapter = await openTestVault([{ vaultNoteRelativePath: 'Inbox.md', vaultNoteText: '# Inbox' }])
    await usePapelizWorkspaceStore.getState().openVaultNote('Inbox.md')
    typeIntoVaultNote('Inbox.md', '# Inbox\nfirst')
    await vi.advanceTimersByTimeAsync(500)
    typeIntoVaultNote('Inbox.md', '# Inbox\nfirst and second')
    await vi.advanceTimersByTimeAsync(500)
    expect(getNoteSaveState('Inbox.md')).toBe('unsaved')
    expect(await vaultAdapter.readVaultNoteText('Inbox.md')).toBe('# Inbox')
    await vi.advanceTimersByTimeAsync(300)
    await waitForQueuedVaultOperations()
    expect(getNoteSaveState('Inbox.md')).toBe('saved')
    expect(await vaultAdapter.readVaultNoteText('Inbox.md')).toBe('# Inbox\nfirst and second')
  })

  it('saves the latest text when typing continues during a slow save', async () => {
    let finishSlowWrite: () => void = () => undefined
    class SlowVaultAdapter extends PapelizInMemoryVaultAdapter {
      override async writeVaultNoteText(vaultNoteRelativePath: string, vaultNoteText: string) {
        if (vaultNoteText === 'first') await new Promise<void>((resolveSlowWrite) => (finishSlowWrite = resolveSlowWrite))
        await super.writeVaultNoteText(vaultNoteRelativePath, vaultNoteText)
      }
    }
    const vaultAdapter = await openTestVault([], new SlowVaultAdapter([{ vaultNoteRelativePath: 'Inbox.md', vaultNoteText: '' }]))
    await usePapelizWorkspaceStore.getState().openVaultNote('Inbox.md')
    typeIntoVaultNote('Inbox.md', 'first')
    await vi.advanceTimersByTimeAsync(700)
    expect(getNoteSaveState('Inbox.md')).toBe('saving')
    typeIntoVaultNote('Inbox.md', 'second')
    finishSlowWrite()
    await vi.advanceTimersByTimeAsync(700)
    await waitForQueuedVaultOperations()
    expect(await vaultAdapter.readVaultNoteText('Inbox.md')).toBe('second')
    expect(getNoteSaveState('Inbox.md')).toBe('saved')
  })

  it('keeps a tab open, with its changes, when the note could not be saved', async () => {
    class FullDiskVaultAdapter extends PapelizInMemoryVaultAdapter {
      override async writeVaultNoteText(): Promise<void> {
        throw new DOMException('The disk is full.', 'QuotaExceededError')
      }
    }
    await openTestVault([], new FullDiskVaultAdapter([{ vaultNoteRelativePath: 'Inbox.md', vaultNoteText: '' }]))
    await usePapelizWorkspaceStore.getState().openVaultNote('Inbox.md')
    typeIntoVaultNote('Inbox.md', 'precious words')
    await usePapelizWorkspaceStore.getState().closeVaultNoteTab('Inbox.md')
    const workspaceState = usePapelizWorkspaceStore.getState()
    expect(workspaceState.openNoteTabRelativePaths).toEqual(['Inbox.md'])
    expect(workspaceState.loadedVaultNotesByRelativePath['Inbox.md']?.draftVaultNoteText).toBe('precious words')
    expect(workspaceState.loadedVaultNotesByRelativePath['Inbox.md']?.noteSaveErrorMessage).toBe('Disk Full')
    expect(workspaceState.workspaceNotice?.workspaceNoticeKind).toBe('error')
    expect(workspaceState.workspaceNotice?.workspaceNoticeMessage).toBe('Couldn’t close “Inbox” (Not Saved)')
  })
})

describe('renaming', () => {
  it('saves pending changes first, then keeps saving under the new name', async () => {
    const vaultAdapter = await openTestVault([{ vaultNoteRelativePath: 'Inbox.md', vaultNoteText: '' }])
    await usePapelizWorkspaceStore.getState().openVaultNote('Inbox.md')
    typeIntoVaultNote('Inbox.md', 'draft')
    const vaultEntryRenameResult = await usePapelizWorkspaceStore.getState().renameVaultEntry('Inbox.md', 'Today')
    expect(vaultEntryRenameResult).toEqual({ vaultEntryRenameOutcome: 'renamed', renamedVaultEntryRelativePath: 'Today.md' })
    expect(await vaultAdapter.readVaultNoteText('Today.md')).toBe('draft')
    expect(usePapelizWorkspaceStore.getState().openNoteTabRelativePaths).toEqual(['Today.md'])
    expect(usePapelizWorkspaceStore.getState().activeVaultNoteRelativePath).toBe('Today.md')
    typeIntoVaultNote('Today.md', 'draft, then more')
    await vi.advanceTimersByTimeAsync(700)
    await waitForQueuedVaultOperations()
    expect(await vaultAdapter.readVaultNoteText('Today.md')).toBe('draft, then more')
    await expect(vaultAdapter.readVaultNoteText('Inbox.md')).rejects.toThrow()
  })

  it('moves open tabs along when their folder is renamed', async () => {
    await openTestVault([
      { vaultNoteRelativePath: 'Ideas/A.md', vaultNoteText: 'a' },
      { vaultNoteRelativePath: 'Ideas/B.md', vaultNoteText: 'b' },
      { vaultNoteRelativePath: 'Ideas 2/C.md', vaultNoteText: 'c' },
    ])
    for (const vaultNoteRelativePath of ['Ideas/A.md', 'Ideas/B.md', 'Ideas 2/C.md']) await usePapelizWorkspaceStore.getState().openVaultNote(vaultNoteRelativePath)
    await usePapelizWorkspaceStore.getState().renameVaultEntry('Ideas', 'Projects')
    const workspaceState = usePapelizWorkspaceStore.getState()
    expect(workspaceState.openNoteTabRelativePaths).toEqual(['Projects/A.md', 'Projects/B.md', 'Ideas 2/C.md'])
    expect(workspaceState.expandedVaultFolderRelativePaths).toEqual({ Projects: true, 'Ideas 2': true })
  })

  it('refuses names that are taken or that a disk would not accept', async () => {
    await openTestVault([
      { vaultNoteRelativePath: 'Inbox.md', vaultNoteText: '' },
      { vaultNoteRelativePath: 'Other.md', vaultNoteText: '' },
    ])
    expect(await usePapelizWorkspaceStore.getState().renameVaultEntry('Inbox.md', 'other')).toMatchObject({ vaultEntryRenameOutcome: 'refused' })
    expect(await usePapelizWorkspaceStore.getState().renameVaultEntry('Inbox.md', 'Plan: week 1')).toMatchObject({ vaultEntryRenameOutcome: 'refused' })
    expect(await usePapelizWorkspaceStore.getState().renameVaultEntry('Inbox.md', '.hidden')).toMatchObject({ vaultEntryRenameOutcome: 'refused' })
  })
})

describe('open-note tabs', () => {
  it('reorders open tabs when one is dragged, and ignores tabs that are not open', async () => {
    await openTestVault([
      { vaultNoteRelativePath: 'A.md', vaultNoteText: '' },
      { vaultNoteRelativePath: 'B.md', vaultNoteText: '' },
      { vaultNoteRelativePath: 'C.md', vaultNoteText: '' },
    ])
    for (const vaultNoteRelativePath of ['A.md', 'B.md', 'C.md']) await usePapelizWorkspaceStore.getState().openVaultNote(vaultNoteRelativePath)
    usePapelizWorkspaceStore.getState().moveVaultNoteTab('A.md', 2)
    expect(usePapelizWorkspaceStore.getState().openNoteTabRelativePaths).toEqual(['B.md', 'C.md', 'A.md'])
    usePapelizWorkspaceStore.getState().moveVaultNoteTab('C.md', -4)
    expect(usePapelizWorkspaceStore.getState().openNoteTabRelativePaths).toEqual(['C.md', 'B.md', 'A.md'])
    usePapelizWorkspaceStore.getState().moveVaultNoteTab('Missing.md', 0)
    expect(usePapelizWorkspaceStore.getState().openNoteTabRelativePaths).toEqual(['C.md', 'B.md', 'A.md'])
    expect(usePapelizWorkspaceStore.getState().activeVaultNoteRelativePath).toBe('C.md')
  })
})

describe('revealing an entry in the file list', () => {
  it('opens the list and expands the folders on the way, and the folder itself', async () => {
    await openTestVault([{ vaultNoteRelativePath: 'Projects/Garden/Beds.md', vaultNoteText: '' }])
    usePapelizWorkspaceStore.getState().setExplorerPanelOpen(false)
    usePapelizWorkspaceStore.getState().revealVaultEntryInFileList('Projects/Garden', 'folder')
    const workspaceState = usePapelizWorkspaceStore.getState()
    expect(workspaceState.isExplorerPanelOpen).toBe(true)
    expect(workspaceState.expandedVaultFolderRelativePaths['Projects']).toBe(true)
    expect(workspaceState.expandedVaultFolderRelativePaths['Projects/Garden']).toBe(true)
  })
})

describe('moving into another folder', () => {
  it('moves a note with its open tab into a folder and back to the top', async () => {
    const vaultAdapter = await openTestVault([
      { vaultNoteRelativePath: 'Inbox.md', vaultNoteText: 'keep me' },
      { vaultNoteRelativePath: 'Projects/Plan.md', vaultNoteText: '' },
    ])
    await usePapelizWorkspaceStore.getState().openVaultNote('Inbox.md')
    await usePapelizWorkspaceStore.getState().moveVaultEntryIntoFolder('Inbox.md', 'Projects')
    let workspaceState = usePapelizWorkspaceStore.getState()
    expect(workspaceState.activeVaultNoteRelativePath).toBe('Projects/Inbox.md')
    expect(workspaceState.openNoteTabRelativePaths).toEqual(['Projects/Inbox.md'])
    expect(await vaultAdapter.readVaultNoteText('Projects/Inbox.md')).toBe('keep me')
    expect(workspaceState.workspaceNotice?.workspaceNoticeMessage).toBe('Moved “Inbox” into “Projects”.')
    await usePapelizWorkspaceStore.getState().moveVaultEntryIntoFolder('Projects/Inbox.md', '')
    workspaceState = usePapelizWorkspaceStore.getState()
    expect(workspaceState.activeVaultNoteRelativePath).toBe('Inbox.md')
  })

  it('refuses a taken name and a folder going into itself', async () => {
    await openTestVault([
      { vaultNoteRelativePath: 'Plan.md', vaultNoteText: '' },
      { vaultNoteRelativePath: 'Projects/Plan.md', vaultNoteText: '' },
      { vaultNoteRelativePath: 'Projects/Garden/Beds.md', vaultNoteText: '' },
    ])
    await usePapelizWorkspaceStore.getState().moveVaultEntryIntoFolder('Plan.md', 'Projects')
    expect(usePapelizWorkspaceStore.getState().workspaceNotice?.workspaceNoticeMessage).toContain('(Name Taken)')
    await usePapelizWorkspaceStore.getState().moveVaultEntryIntoFolder('Projects', 'Projects/Garden')
    expect(usePapelizWorkspaceStore.getState().workspaceNotice?.workspaceNoticeMessage).toContain('(Into Itself)')
    const vaultEntryPaths = usePapelizWorkspaceStore.getState().vaultTreeEntries.map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath)
    expect(vaultEntryPaths).toContain('Plan.md')
    expect(vaultEntryPaths).toContain('Projects/Garden/Beds.md')
  })
})

describe('the file list order', () => {
  it('moves an entry up and down among its folder, and places a dragged one before another', async () => {
    await openTestVault([
      { vaultNoteRelativePath: 'A.md', vaultNoteText: '' },
      { vaultNoteRelativePath: 'B.md', vaultNoteText: '' },
      { vaultNoteRelativePath: 'C.md', vaultNoteText: '' },
      { vaultNoteRelativePath: 'Projects/Plan.md', vaultNoteText: '' },
    ])
    const rootOrder = () => usePapelizWorkspaceStore.getState().vaultEntryOrder['']
    usePapelizWorkspaceStore.getState().moveVaultEntryUpOrDown('C.md', 'up')
    expect(rootOrder()).toEqual(['Projects', 'A.md', 'C.md', 'B.md'])
    usePapelizWorkspaceStore.getState().moveVaultEntryUpOrDown('Projects', 'up')
    expect(rootOrder()).toEqual(['Projects', 'A.md', 'C.md', 'B.md'])
    await usePapelizWorkspaceStore.getState().placeVaultEntryInFolder('B.md', '', { vaultEntryPlacementKind: 'before', anchorVaultEntryName: 'Projects' })
    expect(rootOrder()).toEqual(['B.md', 'Projects', 'A.md', 'C.md'])
  })

  it('keeps a renamed entry in its place, and moves a dragged one into a folder at a spot', async () => {
    await openTestVault([
      { vaultNoteRelativePath: 'A.md', vaultNoteText: '' },
      { vaultNoteRelativePath: 'B.md', vaultNoteText: '' },
      { vaultNoteRelativePath: 'Projects/Plan.md', vaultNoteText: '' },
      { vaultNoteRelativePath: 'Projects/Tasks.md', vaultNoteText: '' },
    ])
    usePapelizWorkspaceStore.getState().moveVaultEntryUpOrDown('B.md', 'up')
    await usePapelizWorkspaceStore.getState().renameVaultEntry('B.md', 'Today')
    expect(usePapelizWorkspaceStore.getState().vaultEntryOrder['']).toEqual(['Projects', 'Today.md', 'A.md'])
    await usePapelizWorkspaceStore
      .getState()
      .placeVaultEntryInFolder('A.md', 'Projects', { vaultEntryPlacementKind: 'after', anchorVaultEntryName: 'Plan.md' })
    const workspaceState = usePapelizWorkspaceStore.getState()
    expect(workspaceState.vaultEntryOrder['Projects']).toEqual(['Plan.md', 'A.md', 'Tasks.md'])
    expect(workspaceState.vaultEntryOrder['']).toEqual(['Projects', 'Today.md'])
  })

  it('saves the order in the vault and finds it there when the vault opens again', async () => {
    const vaultAdapter = await openTestVault([
      { vaultNoteRelativePath: 'A.md', vaultNoteText: '' },
      { vaultNoteRelativePath: 'B.md', vaultNoteText: '' },
    ])
    usePapelizWorkspaceStore.getState().moveVaultEntryUpOrDown('B.md', 'up')
    await vi.waitFor(async () => expect(await vaultAdapter.readPapelizVaultSettingsFile('file-list-order.json')).toContain('"B.md"'))
    await usePapelizWorkspaceStore.getState().closeVaultInWorkspace()
    expect(usePapelizWorkspaceStore.getState().vaultEntryOrder).toEqual({})
    await openTestVault([], vaultAdapter)
    expect(usePapelizWorkspaceStore.getState().vaultEntryOrder['']).toEqual(['B.md', 'A.md'])
  })
})

describe('duplicate, copy and paste', () => {
  it('duplicates a note beside the original, right after it in a chosen order', async () => {
    const vaultAdapter = await openTestVault([
      { vaultNoteRelativePath: 'A.md', vaultNoteText: 'first' },
      { vaultNoteRelativePath: 'B.md', vaultNoteText: '' },
    ])
    usePapelizWorkspaceStore.getState().moveVaultEntryUpOrDown('B.md', 'up')
    await usePapelizWorkspaceStore.getState().duplicateVaultEntry('A.md')
    await usePapelizWorkspaceStore.getState().duplicateVaultEntry('A.md')
    expect(await vaultAdapter.readVaultNoteText('A copy.md')).toBe('first')
    expect(await vaultAdapter.readVaultNoteText('A copy 2.md')).toBe('first')
    expect(usePapelizWorkspaceStore.getState().vaultEntryOrder['']).toEqual(['B.md', 'A.md', 'A copy 2.md', 'A copy.md'])
  })

  it('pastes a copied folder into another folder, under its own name when free', async () => {
    const vaultAdapter = await openTestVault([
      { vaultNoteRelativePath: 'Guides/Links.md', vaultNoteText: 'links' },
      { vaultNoteRelativePath: 'Archive/Old.md', vaultNoteText: '' },
    ])
    usePapelizWorkspaceStore.getState().copyVaultEntryForPaste({ vaultEntryRelativePath: 'Guides', vaultEntryKind: 'folder' })
    await usePapelizWorkspaceStore.getState().pasteCopiedVaultEntry('Archive')
    expect(await vaultAdapter.readVaultNoteText('Archive/Guides/Links.md')).toBe('links')
    await usePapelizWorkspaceStore.getState().pasteCopiedVaultEntry('')
    expect(await vaultAdapter.readVaultNoteText('Guides copy/Links.md')).toBe('links')
    await usePapelizWorkspaceStore.getState().pasteCopiedVaultEntry('Guides')
    expect(usePapelizWorkspaceStore.getState().workspaceNotice?.workspaceNoticeMessage).toBe('Couldn’t paste “Guides” (Into Itself)')
  })
})

describe('editing locks', () => {
  it('locks the notes in a locked folder, keeps the lock through a rename and in the vault, and drops it with the trash', async () => {
    const vaultAdapter = await openTestVault([
      { vaultNoteRelativePath: 'Projects/Plan.md', vaultNoteText: '' },
      { vaultNoteRelativePath: 'Inbox.md', vaultNoteText: '' },
    ])
    await usePapelizWorkspaceStore.getState().openVaultNote('Projects/Plan.md')
    expect(selectActiveVaultNoteLockingEntry(usePapelizWorkspaceStore.getState())).toBeNull()
    usePapelizWorkspaceStore.getState().setVaultEntryEditingLocked('Projects', true)
    expect(selectActiveVaultNoteLockingEntry(usePapelizWorkspaceStore.getState())).toBe('Projects')
    await usePapelizWorkspaceStore.getState().renameVaultEntry('Projects', 'Work')
    expect(usePapelizWorkspaceStore.getState().lockedVaultEntryRelativePaths).toEqual(['Work'])
    expect(selectActiveVaultNoteLockingEntry(usePapelizWorkspaceStore.getState())).toBe('Work')
    await vi.waitFor(async () => expect(await vaultAdapter.readPapelizVaultSettingsFile('locked-entries.json')).toContain('"Work"'))
    await usePapelizWorkspaceStore.getState().closeVaultInWorkspace()
    await openTestVault([], vaultAdapter)
    expect(usePapelizWorkspaceStore.getState().lockedVaultEntryRelativePaths).toEqual(['Work'])
    await usePapelizWorkspaceStore.getState().moveVaultEntryToTrash('Work')
    expect(usePapelizWorkspaceStore.getState().lockedVaultEntryRelativePaths).toEqual([])
  })
})

describe('creating and moving to the trash', () => {
  it('picks a free name for a new note and starts renaming it', async () => {
    await openTestVault([{ vaultNoteRelativePath: 'Untitled.md', vaultNoteText: '' }])
    await usePapelizWorkspaceStore.getState().createVaultNoteInFolder('')
    const workspaceState = usePapelizWorkspaceStore.getState()
    expect(workspaceState.activeVaultNoteRelativePath).toBe('Untitled 2.md')
    expect(workspaceState.vaultEntryBeingRenamedRelativePath).toBe('Untitled 2.md')
  })

  it('creates the note an unresolved wikilink points to, with its folders', async () => {
    const vaultAdapter = await openTestVault([{ vaultNoteRelativePath: 'Inbox.md', vaultNoteText: '' }])
    await usePapelizWorkspaceStore.getState().openOrCreateVaultNoteForWikilinkTarget(null, 'Plans/Next week')
    expect(await vaultAdapter.readVaultNoteText('Plans/Next week.md')).toBe('')
    const workspaceState = usePapelizWorkspaceStore.getState()
    expect(workspaceState.activeVaultNoteRelativePath).toBe('Plans/Next week.md')
    expect(workspaceState.vaultTreeEntries).toContainEqual({ vaultEntryRelativePath: 'Plans', vaultEntryKind: 'folder' })
  })

  it('moves a note to the trash, closes its tab and says where it went', async () => {
    const vaultAdapter = await openTestVault([
      { vaultNoteRelativePath: 'Inbox.md', vaultNoteText: 'keep me' },
      { vaultNoteRelativePath: 'Other.md', vaultNoteText: '' },
    ])
    await usePapelizWorkspaceStore.getState().openVaultNote('Other.md')
    await usePapelizWorkspaceStore.getState().openVaultNote('Inbox.md')
    await usePapelizWorkspaceStore.getState().moveVaultEntryToTrash('Inbox.md')
    const workspaceState = usePapelizWorkspaceStore.getState()
    expect(workspaceState.openNoteTabRelativePaths).toEqual(['Other.md'])
    expect(workspaceState.activeVaultNoteRelativePath).toBe('Other.md')
    expect(workspaceState.workspaceNotice?.workspaceNoticeMessage).toBe('Moved “Inbox” to the trash.')
    expect(await vaultAdapter.readVaultNoteText('.trash/Inbox.md')).toBe('keep me')
    expect(workspaceState.vaultTreeEntries.map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath)).toEqual(['Other.md'])
  })
})

describe('what Papeliz Sync hears from the workspace', () => {
  // The fake engine stands in for the loaded engine; the reports go to it as they would to the real one.
  function loadTestSyncEngine() {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'on' })
    usePapelizSyncEngineStore.setState({ papelizSyncEngine: papelizSyncFakeEngine })
    return papelizSyncFakeEngine
  }

  function readOpenTestVaultId() {
    return usePapelizWorkspaceStore.getState().openVault?.papelizVaultId ?? ''
  }

  afterEach(() => {
    usePapelizSyncEngineStore.setState({ papelizSyncEngine: null })
  })

  it('hears a rename, a move and a move to the trash as such, with the paths they took', async () => {
    const papelizSyncFakeEngine = loadTestSyncEngine()
    await openTestVault([
      { vaultNoteRelativePath: 'Projects/Plan.md', vaultNoteText: '' },
      { vaultNoteRelativePath: 'Inbox.md', vaultNoteText: 'keep me' },
    ])
    const papelizVaultId = readOpenTestVaultId()
    await usePapelizWorkspaceStore.getState().renameVaultEntry('Projects', 'Work')
    await usePapelizWorkspaceStore.getState().moveVaultEntryIntoFolder('Inbox.md', 'Work')
    await usePapelizWorkspaceStore.getState().moveVaultEntryToTrash('Work/Inbox.md')
    expect(papelizSyncFakeEngine.fakeReportedSyncVaultEntryRenames).toEqual([
      { papelizVaultId, fromVaultEntryRelativePath: 'Projects', toVaultEntryRelativePath: 'Work' },
      { papelizVaultId, fromVaultEntryRelativePath: 'Inbox.md', toVaultEntryRelativePath: 'Work/Inbox.md' },
    ])
    expect(papelizSyncFakeEngine.fakeReportedSyncVaultEntryTrashMoves).toEqual([
      { papelizVaultId, vaultEntryRelativePath: 'Work/Inbox.md', vaultTrashRelativePath: '.trash/Inbox.md' },
    ])
  })

  it('hears the Assistant’s writes to notes that aren’t open, its new notes and its pictures', async () => {
    const papelizSyncFakeEngine = loadTestSyncEngine()
    await openTestVault([
      { vaultNoteRelativePath: 'Inbox.md', vaultNoteText: '' },
      { vaultNoteRelativePath: 'Open.md', vaultNoteText: '' },
    ])
    const papelizVaultId = readOpenTestVaultId()
    await usePapelizWorkspaceStore.getState().writeVaultNoteTextFromAssistant('Inbox.md', 'Linked to [[Open]]')
    await usePapelizWorkspaceStore.getState().createVaultNoteFromAssistant('Plans/Next week.md', '# Next week')
    const attachmentFileRelativePath = await usePapelizWorkspaceStore.getState().createChatAttachmentFileFromAssistant('photo.png', new Blob(['picture']))
    // An open note saves through its tab, which the status bar reports; the store doesn't report it twice.
    await usePapelizWorkspaceStore.getState().openVaultNote('Open.md')
    await usePapelizWorkspaceStore.getState().writeVaultNoteTextFromAssistant('Open.md', 'Changed by the Assistant')
    expect(papelizSyncFakeEngine.fakeReportedSyncVaultFileSaves).toEqual([
      { papelizVaultId, vaultFileRelativePath: 'Inbox.md' },
      { papelizVaultId, vaultFileRelativePath: 'Plans/Next week.md' },
      { papelizVaultId, vaultFileRelativePath: attachmentFileRelativePath },
    ])
    expect(attachmentFileRelativePath).toBe('.csessions/attachments/photo.png')
  })

  it('hears a new note, Papeliz’s own files, a duplicated note and every file in a copied folder', async () => {
    const papelizSyncFakeEngine = loadTestSyncEngine()
    const fakeVaultRootHandle = await createPapelizFakeVaultFolder('Copies', {
      'Projects/Plan.md': '# Plan',
      'Projects/Pictures/chart.png': 'picture',
      'Inbox.md': '',
    })
    await openTestVault([], new PapelizFolderOnDiskVaultAdapter(fakeVaultRootHandle.asFileSystemDirectoryHandle()))
    const papelizVaultId = readOpenTestVaultId()
    const readReportedSavePaths = () => papelizSyncFakeEngine.fakeReportedSyncVaultFileSaves.map((reportedSave) => reportedSave.vaultFileRelativePath)
    await usePapelizWorkspaceStore.getState().createVaultNoteInFolder('')
    usePapelizWorkspaceStore.getState().setVaultEntryEditingLocked('Inbox.md', true)
    await usePapelizWorkspaceStore.getState().duplicateVaultEntry('Inbox.md')
    await usePapelizWorkspaceStore.getState().duplicateVaultEntry('Projects')
    await vi.waitFor(() =>
      expect(readReportedSavePaths()).toEqual(
        expect.arrayContaining(['Untitled.md', '.papeliz/locked-entries.json', 'Inbox copy.md', 'Projects copy/Plan.md', 'Projects copy/Pictures/chart.png']),
      ),
    )
    expect(papelizSyncFakeEngine.fakeReportedSyncVaultFileSaves.every((reportedSave) => reportedSave.papelizVaultId === papelizVaultId)).toBe(true)
    // The original folder's files weren't changed, so they aren't reported.
    expect(readReportedSavePaths()).not.toContain('Projects/Plan.md')
  })

  it('reports nothing, and still works, while the engine isn’t loaded', async () => {
    const vaultAdapter = await openTestVault([{ vaultNoteRelativePath: 'Inbox.md', vaultNoteText: '' }])
    await usePapelizWorkspaceStore.getState().renameVaultEntry('Inbox.md', 'Outbox')
    await usePapelizWorkspaceStore.getState().writeVaultNoteTextFromAssistant('Outbox.md', 'written')
    expect(await vaultAdapter.readVaultNoteText('Outbox.md')).toBe('written')
  })
})
