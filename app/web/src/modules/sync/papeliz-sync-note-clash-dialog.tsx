import { useEffect, useState } from 'react'
import { mergePapelizVaultNoteText, resolvePapelizVaultNoteMerge } from '../vault/papeliz-vault-note-merge'
import { PapelizNoteSaveConflictDialog } from '../workspace/papeliz-note-save-conflict-dialog'
import type { PapelizSyncEngine, PapelizSyncNoteClashSummary, PapelizSyncNoteClashTexts } from './papeliz-sync-engine-contract'
import { putOffPapelizSyncNoteClash } from './papeliz-sync-flow-store'

// A note this device and another changed on the same lines, in today's clash dialog (A), naming
// the other device. The texts come from the engine; the app's own merge shows each spot, and the
// settled text goes back to Sync (Keep both by default, so nothing is lost).

interface PapelizSyncNoteClashDialogProps {
  papelizSyncEngine: PapelizSyncEngine
  syncNoteClash: PapelizSyncNoteClashSummary
}

export function PapelizSyncNoteClashDialog({ papelizSyncEngine, syncNoteClash }: PapelizSyncNoteClashDialogProps) {
  const [syncNoteClashTexts, setSyncNoteClashTexts] = useState<PapelizSyncNoteClashTexts | null>(null)
  const papelizSyncClashId = syncNoteClash.papelizSyncClashId

  useEffect(() => {
    let isClashDialogLeft = false
    void papelizSyncEngine.readSyncNoteClashTexts(papelizSyncClashId).then((readClashTexts) => {
      if (isClashDialogLeft) return
      // Settled on another device meanwhile: nothing left to show.
      if (readClashTexts === null) putOffPapelizSyncNoteClash(papelizSyncClashId)
      else setSyncNoteClashTexts(readClashTexts)
    })
    return () => {
      isClashDialogLeft = true
    }
  }, [papelizSyncEngine, papelizSyncClashId])

  if (syncNoteClashTexts === null) return null
  const vaultNoteMergeResult = mergePapelizVaultNoteText(syncNoteClashTexts.baseNoteText, syncNoteClashTexts.otherDeviceNoteText, syncNoteClashTexts.thisDeviceNoteText)
  return (
    <PapelizNoteSaveConflictDialog
      vaultNoteSaveConflict={{
        vaultNoteSaveConflictKind: 'same-lines-changed',
        vaultNoteRelativePath: syncNoteClash.vaultNoteRelativePath,
        baseVaultNoteText: syncNoteClashTexts.baseNoteText,
        savedElsewhereVaultNoteText: syncNoteClashTexts.otherDeviceNoteText,
        myVaultNoteText: syncNoteClashTexts.thisDeviceNoteText,
        vaultNoteMergeResult,
      }}
      syncNoteClashOtherDevice={{
        otherSyncDeviceName: syncNoteClash.otherSyncDeviceName,
        onSyncNoteClashSave: (mergeChoicesByConflictId) => {
          void papelizSyncEngine.settleSyncNoteClash(papelizSyncClashId, resolvePapelizVaultNoteMerge(vaultNoteMergeResult, mergeChoicesByConflictId))
        },
      }}
      onSaveConflictDialogClose={() => putOffPapelizSyncNoteClash(papelizSyncClashId)}
    />
  )
}
