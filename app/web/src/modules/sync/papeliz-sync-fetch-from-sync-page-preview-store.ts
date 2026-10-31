import { create } from 'zustand'
import type { PapelizSyncAccountReading, PapelizSyncAccountVaultReading, PapelizSyncActionOutcome } from './papeliz-sync-engine-contract'

// What Fetch from Sync's page shows, from Fetch's press, the engine's load and its snapshot.
export type PapelizSyncFetchFromSyncStep =
  | 'waiting-for-fetch'
  | 'loading-engine'
  | 'engine-not-loaded'
  | 'signed-out'
  | 'device-removed'
  | 'waiting-for-sign-in'
  | 'reading-account'
  | 'no-subscription'
  | 'subscription-held'
  | 'cannot-reach-sync'
  | 'keys-not-set-up'
  | 'locked'
  | 'synced-vault-list'

// What Fetch from Sync's page shows while its previewer (development builds only,
// papeliz-sync-fetch-from-sync-page-previewer-button.tsx) holds one of its states: the step, and the
// made-up account and vaults it needs. Nothing else sets it, so outside development builds it stays
// null and the page is always live.
export interface PapelizSyncFetchFromSyncPagePreview {
  // Each pick starts the page over.
  fetchFromSyncPagePreviewNumber: number
  fetchFromSyncPagePreviewChoiceKey: string
  previewFetchFromSyncStep: PapelizSyncFetchFromSyncStep
  previewSyncAccount: PapelizSyncAccountReading | null
  // The vault list's read; null while it reads.
  previewAccountVaultsOutcome: PapelizSyncActionOutcome<PapelizSyncAccountVaultReading[]> | null
}

interface PapelizSyncFetchFromSyncPagePreviewState {
  heldFetchFromSyncPagePreview: PapelizSyncFetchFromSyncPagePreview | null
}

export const usePapelizSyncFetchFromSyncPagePreviewStore = create<PapelizSyncFetchFromSyncPagePreviewState>()(() => ({
  heldFetchFromSyncPagePreview: null,
}))

export function returnPapelizSyncFetchFromSyncPageToLive(): void {
  usePapelizSyncFetchFromSyncPagePreviewStore.setState({ heldFetchFromSyncPagePreview: null })
}
