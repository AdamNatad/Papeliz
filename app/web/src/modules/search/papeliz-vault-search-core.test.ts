import { describe, expect, it } from 'vitest'
import { PapelizVaultSearchCore } from './papeliz-vault-search-core'

function createTestSearch() {
  const papelizVaultSearchCore = new PapelizVaultSearchCore()
  papelizVaultSearchCore.replaceAllVaultSearchNotes([
    { vaultNoteRelativePath: 'Projects/Garden plan.md', vaultNoteTitle: 'Garden plan', vaultNoteText: 'Three raised beds along the south fence. Tomatoes want deep watering.' },
    { vaultNoteRelativePath: 'Inbox.md', vaultNoteTitle: 'Inbox', vaultNoteText: 'Ask about the shared tool shed.' },
    { vaultNoteRelativePath: 'Watering.md', vaultNoteTitle: 'Watering', vaultNoteText: 'Mornings only.' },
  ])
  return papelizVaultSearchCore
}

describe('vault search', () => {
  it('finds notes by their words, titles first, with a snippet around the match', () => {
    const vaultSearchResults = createTestSearch().searchVaultNotes('watering', 5)
    expect(vaultSearchResults.map((vaultSearchResult) => vaultSearchResult.vaultNoteRelativePath)).toEqual(['Watering.md', 'Projects/Garden plan.md'])
    expect(vaultSearchResults[1]?.searchResultSnippet).toContain('deep watering')
  })

  it('finds word beginnings and tolerates a small typo', () => {
    expect(createTestSearch().searchVaultNotes('toma', 5).map((vaultSearchResult) => vaultSearchResult.vaultNoteTitle)).toEqual(['Garden plan'])
    expect(createTestSearch().searchVaultNotes('shedd', 5).map((vaultSearchResult) => vaultSearchResult.vaultNoteTitle)).toEqual(['Inbox'])
  })

  it('follows changes to notes', () => {
    const papelizVaultSearchCore = createTestSearch()
    papelizVaultSearchCore.upsertVaultSearchNote({ vaultNoteRelativePath: 'Inbox.md', vaultNoteTitle: 'Inbox', vaultNoteText: 'Buy compost.' })
    papelizVaultSearchCore.removeVaultSearchNotes(['Watering.md'])
    expect(papelizVaultSearchCore.searchVaultNotes('shed', 5)).toEqual([])
    expect(papelizVaultSearchCore.searchVaultNotes('compost', 5).map((vaultSearchResult) => vaultSearchResult.vaultNoteTitle)).toEqual(['Inbox'])
    expect(papelizVaultSearchCore.searchVaultNotes('mornings', 5)).toEqual([])
  })
})
