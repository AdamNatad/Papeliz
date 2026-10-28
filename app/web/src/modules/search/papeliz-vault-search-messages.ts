import type { PapelizVaultSearchNote, PapelizVaultSearchResult } from './papeliz-vault-search-core'

// The messages between the page and the search worker.

export type PapelizVaultSearchWorkerRequest =
  | { searchWorkerRequestKind: 'replace-all-notes'; vaultSearchNotes: PapelizVaultSearchNote[] }
  | { searchWorkerRequestKind: 'upsert-note'; vaultSearchNote: PapelizVaultSearchNote }
  | { searchWorkerRequestKind: 'remove-notes'; vaultNoteRelativePaths: string[] }
  | { searchWorkerRequestKind: 'search'; searchRequestId: number; searchQueryText: string; searchResultLimit: number }

export interface PapelizVaultSearchWorkerResponse {
  searchRequestId: number
  vaultSearchResults: PapelizVaultSearchResult[]
}
