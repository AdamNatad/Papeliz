import { mergePapelizVaultNoteText } from '../vault/papeliz-vault-note-merge'
import type { PapelizSyncNoteThreeWayMerge } from './papeliz-sync-engine-contract'

// The three-way merge the engine gets from the platform: the app's own, the one two tabs and other
// apps already use, with the other device in the place of "saved". A clash goes to the clash dialog,
// which merges the same three texts again to show each spot (papeliz-sync-note-clash-dialog.tsx).
export const mergePapelizSyncNoteText: PapelizSyncNoteThreeWayMerge = (baseNoteText, otherDeviceNoteText, thisDeviceNoteText) => {
  const vaultNoteMergeResult = mergePapelizVaultNoteText(baseNoteText, otherDeviceNoteText, thisDeviceNoteText)
  return vaultNoteMergeResult.mergeOutcome === 'clean'
    ? { syncNoteMergeOutcome: 'merged', mergedNoteText: vaultNoteMergeResult.mergedVaultNoteText }
    : { syncNoteMergeOutcome: 'clash' }
}
