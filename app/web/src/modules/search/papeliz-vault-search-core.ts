import MiniSearch from 'minisearch'
import { buildVaultSearchSnippet, convertVaultNoteTextToSearchSnippetText, splitVaultSearchTextIntoWords } from './papeliz-vault-search-snippets'

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
  // A short passage of the note's plain text, starting just before the first match, for the result
  // list and the assistant.
  searchResultSnippet: string
  // The note's words that matched (lower case), for the result list to bold them.
  searchResultMatchedWords: string[]
}

function createPapelizMiniSearch() {
  return new MiniSearch<PapelizVaultSearchNote>({
    idField: 'vaultNoteRelativePath',
    fields: ['vaultNoteTitle', 'vaultNoteText'],
    storeFields: ['vaultNoteTitle'],
    tokenize: splitVaultSearchTextIntoWords,
    searchOptions: { boost: { vaultNoteTitle: 3 }, prefix: true, fuzzy: 0.15, combineWith: 'AND' },
  })
}

export class PapelizVaultSearchCore {
  private papelizMiniSearch = createPapelizMiniSearch()
  // Each note's plain text, for snippets.
  private readonly vaultNoteSnippetTextsByRelativePath = new Map<string, string>()

  replaceAllVaultSearchNotes(vaultSearchNotes: readonly PapelizVaultSearchNote[]): void {
    this.papelizMiniSearch = createPapelizMiniSearch()
    this.vaultNoteSnippetTextsByRelativePath.clear()
    this.papelizMiniSearch.addAll(vaultSearchNotes)
    for (const vaultSearchNote of vaultSearchNotes) this.rememberVaultNoteSnippetText(vaultSearchNote)
  }

  upsertVaultSearchNote(vaultSearchNote: PapelizVaultSearchNote): void {
    if (this.papelizMiniSearch.has(vaultSearchNote.vaultNoteRelativePath)) this.papelizMiniSearch.discard(vaultSearchNote.vaultNoteRelativePath)
    this.papelizMiniSearch.add(vaultSearchNote)
    this.rememberVaultNoteSnippetText(vaultSearchNote)
  }

  removeVaultSearchNotes(vaultNoteRelativePaths: readonly string[]): void {
    for (const vaultNoteRelativePath of vaultNoteRelativePaths) {
      if (this.papelizMiniSearch.has(vaultNoteRelativePath)) this.papelizMiniSearch.discard(vaultNoteRelativePath)
      this.vaultNoteSnippetTextsByRelativePath.delete(vaultNoteRelativePath)
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
          searchResultSnippet: buildVaultSearchSnippet(this.vaultNoteSnippetTextsByRelativePath.get(vaultNoteRelativePath) ?? '', miniSearchResult.terms),
          searchResultMatchedWords: miniSearchResult.terms,
        }
      })
  }

  private rememberVaultNoteSnippetText(vaultSearchNote: PapelizVaultSearchNote): void {
    this.vaultNoteSnippetTextsByRelativePath.set(vaultSearchNote.vaultNoteRelativePath, convertVaultNoteTextToSearchSnippetText(vaultSearchNote.vaultNoteText))
  }
}
