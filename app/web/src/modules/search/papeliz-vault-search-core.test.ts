import { describe, expect, it } from 'vitest'
import { PapelizVaultSearchCore } from './papeliz-vault-search-core'
import { convertVaultNoteTextToSearchSnippetText, splitVaultSearchSnippetAtMatchedWords, splitVaultSearchTextIntoWords } from './papeliz-vault-search-snippets'

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

  it('finds words written in code, as in `mermaid` or Ctrl+E', () => {
    const papelizVaultSearchCore = new PapelizVaultSearchCore()
    papelizVaultSearchCore.replaceAllVaultSearchNotes([
      {
        vaultNoteRelativePath: 'Writing.md',
        vaultNoteTitle: 'Writing',
        vaultNoteText: 'Draw a diagram in a `mermaid` block.\n\n```mermaid\nflowchart LR\n  A-->B\n```\n\nSwitch views with `Ctrl+E`, send with Ctrl+Enter.',
      },
    ])
    expect(papelizVaultSearchCore.searchVaultNotes('mermaid', 5).map((vaultSearchResult) => vaultSearchResult.vaultNoteTitle)).toEqual(['Writing'])
    expect(papelizVaultSearchCore.searchVaultNotes('ctrl', 5).map((vaultSearchResult) => vaultSearchResult.vaultNoteTitle)).toEqual(['Writing'])
    expect(papelizVaultSearchCore.searchVaultNotes('flowchart', 5)[0]?.searchResultMatchedWords).toEqual(['flowchart'])
  })

  it('shows a result as plain text that starts just before the matched word', () => {
    const papelizVaultSearchCore = new PapelizVaultSearchCore()
    papelizVaultSearchCore.replaceAllVaultSearchNotes([
      {
        vaultNoteRelativePath: 'Projects/Garden plan.md',
        vaultNoteTitle: 'Garden plan',
        vaultNoteText: [
          '---',
          'tags: [project, garden]',
          'status: planning',
          '---',
          '# Garden plan',
          '',
          'Three raised beds along the south fence, with room for a path between them so the wheelbarrow fits.',
          '',
          '> [!note] Water',
          '> Tomatoes want **deep** watering, see [[Watering|the watering note]] and [the guide](https://example.com/guide).',
          '',
          '| Bed | Crop |',
          '| --- | --- |',
          '| 1 | `Beans` |',
        ].join('\n'),
      },
    ])
    const [tomatoesResult] = papelizVaultSearchCore.searchVaultNotes('tomatoes', 5)
    expect(tomatoesResult?.searchResultSnippet).toMatch(/^…/)
    expect(tomatoesResult?.searchResultSnippet).toContain('Water Tomatoes want deep watering, see the watering note and the guide. Bed Crop 1 Beans')
    expect(tomatoesResult?.searchResultSnippet).not.toMatch(/[#*`>|[\]]|tags:|https/)
    // The matched word sits near the start, so a two-line result shows it.
    expect(tomatoesResult?.searchResultSnippet.indexOf('Tomatoes')).toBeLessThan(40)

    const [beansResult] = papelizVaultSearchCore.searchVaultNotes('beans', 5)
    expect(beansResult?.searchResultSnippet.endsWith('1 Beans')).toBe(true)
    const [firstLineResult] = papelizVaultSearchCore.searchVaultNotes('raised', 5)
    expect(firstLineResult?.searchResultSnippet).toMatch(/^Garden plan Three raised beds/)
  })
})

describe('search snippets', () => {
  it('cuts a snippet at its matched words, whole words only, ignoring case', () => {
    expect(splitVaultSearchSnippetAtMatchedWords('Plan the plan, then planting.', ['plan'])).toEqual([
      { snippetPartText: 'Plan', isMatchedWord: true },
      { snippetPartText: ' the ', isMatchedWord: false },
      { snippetPartText: 'plan', isMatchedWord: true },
      { snippetPartText: ', then planting.', isMatchedWord: false },
    ])
    expect(splitVaultSearchSnippetAtMatchedWords('Nothing here', [])).toEqual([{ snippetPartText: 'Nothing here', isMatchedWord: false }])
  })

  it('splits words on code marks and symbols but keeps words with letters from any language', () => {
    expect(splitVaultSearchTextIntoWords('`mermaid` Ctrl+E a=b x|y <tag> ~strike~ café naïve')).toEqual(['mermaid', 'Ctrl', 'E', 'a', 'b', 'x', 'y', 'tag', 'strike', 'café', 'naïve'])
    expect(convertVaultNoteTextToSearchSnippetText('- [x] Read __snake_case__ and ~~old~~ ==marked== <u>text</u>\n***\n## Done')).toBe(
      'Read snake_case and old marked text Done',
    )
  })
})
