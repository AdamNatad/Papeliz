import { useEffect, type ReactNode } from 'react'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import type { PapelizSyncEngine, PapelizSyncEngineSnapshot } from './papeliz-sync-engine-contract'
import { usePapelizSyncEngineSnapshot, usePapelizSyncEngineStore } from './papeliz-sync-engine-store'
import { PapelizSyncDialogHost } from './papeliz-sync-dialog-host'
import { PapelizSyncLoadingLine, PapelizSyncPageText, PapelizSyncTextButton } from './papeliz-sync-page-parts'

interface PapelizSyncEngineGateProps {
  renderSyncEnginePage: (papelizSyncEngine: PapelizSyncEngine, syncEngineSnapshot: PapelizSyncEngineSnapshot) => ReactNode
}

// The gear's Account and Sync pages load the engine when they open, and say so plainly when this
// build has none. On the start page (no vault, so no status bar) Sync's dialogs are drawn from here.
export function PapelizSyncEngineGate({ renderSyncEnginePage }: PapelizSyncEngineGateProps) {
  const syncEngineLoadState = usePapelizSyncEngineStore((syncEngineState) => syncEngineState.syncEngineLoadState)
  const loadPapelizSyncEngine = usePapelizSyncEngineStore((syncEngineState) => syncEngineState.loadPapelizSyncEngine)
  const syncEngineReading = usePapelizSyncEngineSnapshot()
  const isStartPage = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault === null)

  useEffect(() => {
    void loadPapelizSyncEngine()
  }, [loadPapelizSyncEngine])

  if (syncEngineLoadState === 'not-in-this-build') return <PapelizSyncPageText className="py-2">Papeliz Sync isn’t part of this build of Papeliz.</PapelizSyncPageText>
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
