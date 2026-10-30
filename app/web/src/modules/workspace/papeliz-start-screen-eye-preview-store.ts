import { create } from 'zustand'
import type { PapelizFolderAccessOffReason } from '../vault/papeliz-folder-access-support'
import type { PapelizRecentVault } from '../vault/papeliz-recent-vaults'

// What the start screen shows while the eye previewer (development builds only,
// papeliz-workspace-eye-previewer.ts) holds one of its states: made-up vaults and the state to
// start in. Nothing else sets it, so outside development builds it stays null and the start screen
// is always live.
export interface PapelizStartScreenEyePreview {
  // Each pick starts the start screen over.
  startScreenEyePreviewNumber: number
  previewRememberedVaultFolders: PapelizRecentVault[]
  previewFolderAccessOffReason: PapelizFolderAccessOffReason | null
  isPreviewHiddenVaultListShown: boolean
  previewRecentVaultSearchText: string
  isPreviewRecentVaultListReloading: boolean
  previewVaultFolderDeleteScope: 'one-vault' | 'all-hidden-vaults' | null
  isPreviewVaultFolderDeleting: boolean
  previewStartScreenNotice: { previewNoticeKind: 'info' | 'error'; previewNoticeMessage: string } | null
}

interface PapelizStartScreenEyePreviewState {
  heldStartScreenEyePreview: PapelizStartScreenEyePreview | null
}

export const usePapelizStartScreenEyePreviewStore = create<PapelizStartScreenEyePreviewState>()(() => ({
  heldStartScreenEyePreview: null,
}))
