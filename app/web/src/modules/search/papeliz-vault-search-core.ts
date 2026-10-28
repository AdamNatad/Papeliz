import MiniSearch from 'minisearch'

// Full-text search over a vault's notes (MiniSearch). It runs inside a Web Worker in the app
// (papeliz-vault-search-worker.ts) so a large vault never slows typing; it is a plain class here so
// tests can use it directly.

export interface PapelizVaultSearchNote {
  vaultNoteRelativePath: string
  vaultNoteTitle: string
  vaultNoteText: string
}

export interface PapelizVaultSearchResult {
  vaultNoteRelativePath: string
  vaultNoteTitle: string
  searchResultScore: number
  // A short passage around the first match, for the result list and the assistant.
  searchResultSnippet: string
}

const papelizSearchSnippetRadius = 70

function createPapelizMiniSearch() {
  return new MiniSearch<PapelizVaultSearchNote>({
    idField: 'vaultNoteRelativePath',
    fields: ['vaultNoteTitle', 'vaultNoteText'],
    storeFields: ['vaultNoteTitle'],
    searchOptions: { boost: { vaultNoteTitle: 3 }, prefix: true, fuzzy: 0.15, combineWith: 'AND' },
  })
}

function buildSearchSnippet(vaultNoteText: string, matchedTerms: readonly string[]): string {
  const lowerCaseNoteText = vaultNoteText.toLowerCase()
  let firstMatchIndex = -1
  for (const matchedTerm of matchedTerms) {
    const termIndex = lowerCaseNoteText.indexOf(matchedTerm.toLowerCase())
    if (termIndex !== -1 && (firstMatchIndex === -1 || termIndex < firstMatchIndex)) firstMatchIndex = termIndex
  }
  if (firstMatchIndex === -1) firstMatchIndex = 0
  const snippetStart = Math.max(0, firstMatchIndex - papelizSearchSnippetRadius)
  const snippetEnd = Math.min(vaultNoteText.length, firstMatchIndex + papelizSearchSnippetRadius)
  const snippetText = vaultNoteText.slice(snippetStart, snippetEnd).replace(/\s+/g, ' ').trim()
  return `${snippetStart > 0 ? '…' : ''}${snippetText}${snippetEnd < vaultNoteText.length ? '…' : ''}`
}

export class PapelizVaultSearchCore {
  private papelizMiniSearch = createPapelizMiniSearch()
  private readonly vaultNoteTextsByRelativePath = new Map<string, string>()

  replaceAllVaultSearchNotes(vaultSearchNotes: readonly PapelizVaultSearchNote[]): void {
    this.papelizMiniSearch = createPapelizMiniSearch()
    this.vaultNoteTextsByRelativePath.clear()
    this.papelizMiniSearch.addAll(vaultSearchNotes)
    for (const vaultSearchNote of vaultSearchNotes) this.vaultNoteTextsByRelativePath.set(vaultSearchNote.vaultNoteRelativePath, vaultSearchNote.vaultNoteText)
  }

  upsertVaultSearchNote(vaultSearchNote: PapelizVaultSearchNote): void {
    if (this.papelizMiniSearch.has(vaultSearchNote.vaultNoteRelativePath)) this.papelizMiniSearch.discard(vaultSearchNote.vaultNoteRelativePath)
    this.papelizMiniSearch.add(vaultSearchNote)
    this.vaultNoteTextsByRelativePath.set(vaultSearchNote.vaultNoteRelativePath, vaultSearchNote.vaultNoteText)
  }

  removeVaultSearchNotes(vaultNoteRelativePaths: readonly string[]): void {
    for (const vaultNoteRelativePath of vaultNoteRelativePaths) {
      if (this.papelizMiniSearch.has(vaultNoteRelativePath)) this.papelizMiniSearch.discard(vaultNoteRelativePath)
      this.vaultNoteTextsByRelativePath.delete(vaultNoteRelativePath)
    }
  }

  searchVaultNotes(searchQueryText: string, searchResultLimit: number): PapelizVaultSearchResult[] {
    if (searchQueryText.trim().length === 0) return []
    return this.papelizMiniSearch
      .search(searchQueryText)
      .slice(0, searchResultLimit)
      .map((miniSearchResult) => {
        const vaultNoteRelativePath = String(miniSearchResult.id)
        return {
          vaultNoteRelativePath,
          vaultNoteTitle: String(miniSearchResult['vaultNoteTitle'] ?? vaultNoteRelativePath),
          searchResultScore: Math.round(miniSearchResult.score * 100) / 100,
          searchResultSnippet: buildSearchSnippet(this.vaultNoteTextsByRelativePath.get(vaultNoteRelativePath) ?? '', miniSearchResult.terms),
        }
      })
  }
}
