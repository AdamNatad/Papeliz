import { create } from 'zustand'
import type { PapelizSyncAccountReading, PapelizSyncAccountVaultReading, PapelizSyncActionOutcome } from './papeliz-sync-engine-contract'

// What the start screen's Synced Vaults page shows, from Fetch's press, the engine's load and its snapshot.
export type PapelizSyncSyncedVaultsPageStep =
  | 'waiting-for-fetch'
  | 'loading-engine'
  | 'engine-not-loaded'
  | 'signed-out'
  | 'device-removed'
  | 'waiting-for-sign-in'
  | 'reading-account'
  | 'no-subscription'
  | 'subscription-held'
  | 'synced-vault-list'

// What the Synced Vaults page shows while its previewer (development builds only,
// papeliz-sync-synced-vaults-page-previewer-menu-items.ts) holds one of its states: the step, and the
// made-up account and vaults it needs. Nothing else sets it, so outside development builds it stays
// null and the page is always live.
export interface PapelizSyncSyncedVaultsPagePreview {
  // Each pick starts the page over.
  syncedVaultsPagePreviewNumber: number
  syncedVaultsPagePreviewChoiceKey: string
  previewSyncedVaultsPageStep: PapelizSyncSyncedVaultsPageStep
  previewSyncAccount: PapelizSyncAccountReading | null
  // The vault list's read; null while it reads.
  previewAccountVaultsOutcome: PapelizSyncActionOutcome<PapelizSyncAccountVaultReading[]> | null
  // The vault picked in the list at first (an End-to-end one, so its passphrase shows); null for the
  // page's own pick.
  previewChosenPapelizSyncVaultId: string | null
}

interface PapelizSyncSyncedVaultsPagePreviewState {
  heldSyncedVaultsPagePreview: PapelizSyncSyncedVaultsPagePreview | null
}

export const usePapelizSyncSyncedVaultsPagePreviewStore = create<PapelizSyncSyncedVaultsPagePreviewState>()(() => ({
  heldSyncedVaultsPagePreview: null,
}))

export function returnPapelizSyncSyncedVaultsPageToLive(): void {
  usePapelizSyncSyncedVaultsPagePreviewStore.setState({ heldSyncedVaultsPagePreview: null })
}
