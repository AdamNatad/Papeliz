import { afterEach, describe, expect, it } from 'vitest'
import { PapelizInMemoryVaultAdapter } from '../vault/papeliz-in-memory-vault-adapter'
import { getPapelizVaultSearchClient, startPapelizVaultKnowledgeSync, usePapelizVaultKnowledgeStore } from './papeliz-vault-knowledge-store'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

async function waitInTestUntil(isTestConditionMet: () => boolean) {
  for (let attempt = 0; attempt < 100 && !isTestConditionMet(); attempt += 1) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 20))
  }
  expect(isTestConditionMet()).toBe(true)
}

async function searchVaultNotePathsInTest(searchQueryText: string): Promise<string[]> {
  return (await getPapelizVaultSearchClient().searchVaultNotes(searchQueryText, 20)).map((vaultSearchResult) => vaultSearchResult.vaultNoteRelativePath)
}

let stopVaultKnowledgeSyncInTest: (() => void) | null = null

afterEach(async () => {
  stopVaultKnowledgeSyncInTest?.()
  stopVaultKnowledgeSyncInTest = null
  await usePapelizWorkspaceStore.getState().closeVaultInWorkspace()
})

describe('the vault search index', () => {
  it('tells the search box to look again once a note’s text changes, so an edited note leaves the results', async () => {
    stopVaultKnowledgeSyncInTest = startPapelizVaultKnowledgeSync()
    await usePapelizWorkspaceStore.getState().openVaultInWorkspace(
      {
        papelizVaultId: 'knowledge-search-vault',
        papelizVaultDisplayName: 'Test vault',
        papelizVaultAdapter: new PapelizInMemoryVaultAdapter([{ vaultNoteRelativePath: 'Garden.md', vaultNoteText: '# Garden\n\nPlant the purple beans by the fence.\n' }]),
      },
      { firstVaultNoteRelativePathToOpen: 'Garden.md', firstNoteViewMode: 'md-code', expandAllTopLevelFolders: false },
    )
    await waitInTestUntil(() => usePapelizVaultKnowledgeStore.getState().vaultKnowledgeBuildState === 'ready')
    expect(await searchVaultNotePathsInTest('purple beans')).toEqual(['Garden.md'])

    const searchIndexVersionBeforeEdit = usePapelizVaultKnowledgeStore.getState().vaultSearchIndexVersion
    const loadedGardenNote = usePapelizWorkspaceStore.getState().loadedVaultNotesByRelativePath['Garden.md']!
    usePapelizWorkspaceStore.getState().updateVaultNoteDraftText(loadedGardenNote.loadedNoteSessionId, '# Garden\n\nPlant the squash by the fence.\n')

    await waitInTestUntil(() => usePapelizVaultKnowledgeStore.getState().vaultSearchIndexVersion > searchIndexVersionBeforeEdit)
    expect(await searchVaultNotePathsInTest('purple beans')).toEqual([])
    expect(await searchVaultNotePathsInTest('squash')).toEqual(['Garden.md'])
  })
})
