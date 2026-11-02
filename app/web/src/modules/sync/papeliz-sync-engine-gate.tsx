import { useEffect, useId, type ReactNode } from 'react'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import type { PapelizSyncEngine, PapelizSyncEngineSnapshot } from './papeliz-sync-engine-contract'
import { usePapelizSyncEngineSnapshot, usePapelizSyncEngineStore } from './papeliz-sync-engine-store'
import { PapelizSyncDialogHost } from './papeliz-sync-dialog-host'
import { PapelizSyncLoadingLine, PapelizSyncPageText, PapelizSyncTextButton } from './papeliz-sync-page-parts'

interface PapelizSyncEngineGateProps {
  renderSyncEnginePage: (papelizSyncEngine: PapelizSyncEngine, syncEngineSnapshot: PapelizSyncEngineSnapshot) => ReactNode
}

// The gear's Account and Sync pages load the engine when they open. A build without it, such as the
// free app deployed before Sync, shows a short note that Sync is coming, with nothing to press. On the
// start page (no vault, so no status bar) Sync's dialogs are drawn from here.
export function PapelizSyncEngineGate({ renderSyncEnginePage }: PapelizSyncEngineGateProps) {
  const syncEngineLoadState = usePapelizSyncEngineStore((syncEngineState) => syncEngineState.syncEngineLoadState)
  const loadPapelizSyncEngine = usePapelizSyncEngineStore((syncEngineState) => syncEngineState.loadPapelizSyncEngine)
  const syncEngineReading = usePapelizSyncEngineSnapshot()
  const isStartPage = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault === null)
  const syncComingNoteHeadingId = useId()

  useEffect(() => {
    void loadPapelizSyncEngine()
  }, [loadPapelizSyncEngine])

  if (syncEngineLoadState === 'not-in-this-build') {
    return (
      <section aria-labelledby={syncComingNoteHeadingId} className="py-2">
        <h3 id={syncComingNoteHeadingId} className="text-sm font-semibold text-papeliz-ink">
          Papeliz Sync is coming
        </h3>
        <PapelizSyncPageText className="mt-1">
          Your vaults on every device, kept in step, with an account. Until then, your vaults stay in this browser or in your folders.
        </PapelizSyncPageText>
      </section>
    )
  }
  if (syncEngineLoadState === 'failed-to-load') {
    return (
      <PapelizSyncPageText className="py-2">
        Papeliz Sync didn’t load. Check your connection, then{' '}
        <PapelizSyncTextButton onClick={() => void loadPapelizSyncEngine()}>try again</PapelizSyncTextButton>.
      </PapelizSyncPageText>
    )
  }
  if (syncEngineReading === null) return <PapelizSyncLoadingLine>Loading Sync…</PapelizSyncLoadingLine>
  return (
    <>
      {renderSyncEnginePage(syncEngineReading.papelizSyncEngine, syncEngineReading.syncEngineSnapshot)}
      {isStartPage && <PapelizSyncDialogHost isSyncDialogDrawnInPlace />}
    </>
  )
}
