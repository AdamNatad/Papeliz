import { PapelizVaultSearchCore } from './papeliz-vault-search-core'
import type { PapelizVaultSearchWorkerRequest, PapelizVaultSearchWorkerResponse } from './papeliz-vault-search-messages'

// The search index lives in this worker, away from the page's main thread. The app's TypeScript
// setup uses the page's DOM types, so the worker's own scope is described here by what it uses.
interface PapelizVaultSearchWorkerScope {
  addEventListener(eventType: 'message', messageListener: (messageEvent: MessageEvent<PapelizVaultSearchWorkerRequest>) => void): void
  postMessage(searchWorkerResponse: PapelizVaultSearchWorkerResponse): void
}

const papelizVaultSearchCore = new PapelizVaultSearchCore()
const papelizVaultSearchWorkerScope = self as unknown as PapelizVaultSearchWorkerScope

papelizVaultSearchWorkerScope.addEventListener('message', (messageEvent) => {
  const searchWorkerRequest = messageEvent.data
  switch (searchWorkerRequest.searchWorkerRequestKind) {
    case 'replace-all-notes':
      papelizVaultSearchCore.replaceAllVaultSearchNotes(searchWorkerRequest.vaultSearchNotes)
      return
    case 'upsert-note':
      papelizVaultSearchCore.upsertVaultSearchNote(searchWorkerRequest.vaultSearchNote)
      return
    case 'remove-notes':
      papelizVaultSearchCore.removeVaultSearchNotes(searchWorkerRequest.vaultNoteRelativePaths)
      return
    case 'search': {
      const searchWorkerResponse: PapelizVaultSearchWorkerResponse = {
        searchRequestId: searchWorkerRequest.searchRequestId,
        vaultSearchResults: papelizVaultSearchCore.searchVaultNotes(searchWorkerRequest.searchQueryText, searchWorkerRequest.searchResultLimit),
      }
      papelizVaultSearchWorkerScope.postMessage(searchWorkerResponse)
    }
  }
})
