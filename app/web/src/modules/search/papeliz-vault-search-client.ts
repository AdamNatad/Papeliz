import { PapelizVaultSearchCore, type PapelizVaultSearchNote, type PapelizVaultSearchResult } from './papeliz-vault-search-core'
import type { PapelizVaultSearchWorkerRequest, PapelizVaultSearchWorkerResponse } from './papeliz-vault-search-messages'

// The page's side of vault search. In the browser the index runs in a Web Worker; where workers
// don't exist (unit tests) the same search runs in place.

export interface PapelizVaultSearchClient {
  replaceAllVaultSearchNotes(vaultSearchNotes: PapelizVaultSearchNote[]): void
  upsertVaultSearchNote(vaultSearchNote: PapelizVaultSearchNote): void
  removeVaultSearchNotes(vaultNoteRelativePaths: string[]): void
  searchVaultNotes(searchQueryText: string, searchResultLimit: number): Promise<PapelizVaultSearchResult[]>
}

function createWorkerVaultSearchClient(): PapelizVaultSearchClient {
  const papelizVaultSearchWorker = new Worker(new URL('./papeliz-vault-search-worker.ts', import.meta.url), { type: 'module' })
  const pendingSearchResolversByRequestId = new Map<number, (vaultSearchResults: PapelizVaultSearchResult[]) => void>()
  let nextSearchRequestId = 1
  papelizVaultSearchWorker.addEventListener('message', (messageEvent: MessageEvent<PapelizVaultSearchWorkerResponse>) => {
    const resolveSearch = pendingSearchResolversByRequestId.get(messageEvent.data.searchRequestId)
    pendingSearchResolversByRequestId.delete(messageEvent.data.searchRequestId)
    resolveSearch?.(messageEvent.data.vaultSearchResults)
  })
  const postSearchWorkerRequest = (searchWorkerRequest: PapelizVaultSearchWorkerRequest) => papelizVaultSearchWorker.postMessage(searchWorkerRequest)
  return {
    replaceAllVaultSearchNotes: (vaultSearchNotes) => postSearchWorkerRequest({ searchWorkerRequestKind: 'replace-all-notes', vaultSearchNotes }),
    upsertVaultSearchNote: (vaultSearchNote) => postSearchWorkerRequest({ searchWorkerRequestKind: 'upsert-note', vaultSearchNote }),
    removeVaultSearchNotes: (vaultNoteRelativePaths) => postSearchWorkerRequest({ searchWorkerRequestKind: 'remove-notes', vaultNoteRelativePaths }),
    searchVaultNotes: (searchQueryText, searchResultLimit) =>
      new Promise((resolveSearch) => {
        const searchRequestId = nextSearchRequestId++
        pendingSearchResolversByRequestId.set(searchRequestId, resolveSearch)
        postSearchWorkerRequest({ searchWorkerRequestKind: 'search', searchRequestId, searchQueryText, searchResultLimit })
      }),
  }
}

function createInPlaceVaultSearchClient(): PapelizVaultSearchClient {
  const papelizVaultSearchCore = new PapelizVaultSearchCore()
  return {
    replaceAllVaultSearchNotes: (vaultSearchNotes) => papelizVaultSearchCore.replaceAllVaultSearchNotes(vaultSearchNotes),
    upsertVaultSearchNote: (vaultSearchNote) => papelizVaultSearchCore.upsertVaultSearchNote(vaultSearchNote),
    removeVaultSearchNotes: (vaultNoteRelativePaths) => papelizVaultSearchCore.removeVaultSearchNotes(vaultNoteRelativePaths),
    searchVaultNotes: async (searchQueryText, searchResultLimit) => papelizVaultSearchCore.searchVaultNotes(searchQueryText, searchResultLimit),
  }
}

export function createPapelizVaultSearchClient(): PapelizVaultSearchClient {
  return typeof Worker === 'function' && typeof window !== 'undefined' ? createWorkerVaultSearchClient() : createInPlaceVaultSearchClient()
}
