import { create } from 'zustand'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

// A search for the file list's Search notes box to run, asked for from elsewhere: a `#tag` clicked
// in MD View. The file list is not drawn while it is closed, so the request waits here until the
// list shows and takes it.
export interface PapelizFileExplorerSearchRequest {
  fileExplorerSearchQueryText: string
  // Counts up with each request, so asking for the same search again runs it again.
  fileExplorerSearchRequestNumber: number
}

interface PapelizFileExplorerSearchRequestState {
  pendingFileExplorerSearchRequest: PapelizFileExplorerSearchRequest | null
  clearPendingFileExplorerSearchRequest: () => void
}

export const usePapelizFileExplorerSearchRequestStore = create<PapelizFileExplorerSearchRequestState>()((setFileExplorerSearchRequestState) => ({
  pendingFileExplorerSearchRequest: null,
  clearPendingFileExplorerSearchRequest: () => setFileExplorerSearchRequestState({ pendingFileExplorerSearchRequest: null }),
}))

let lastFileExplorerSearchRequestNumber = 0

// Opens the file list (leaving Focus mode, which hides it) with its search box filled in.
export function requestPapelizFileExplorerSearch(fileExplorerSearchQueryText: string): void {
  lastFileExplorerSearchRequestNumber += 1
  usePapelizFileExplorerSearchRequestStore.setState({
    pendingFileExplorerSearchRequest: { fileExplorerSearchQueryText, fileExplorerSearchRequestNumber: lastFileExplorerSearchRequestNumber },
  })
  const workspaceState = usePapelizWorkspaceStore.getState()
  if (workspaceState.isFocusModeOn) workspaceState.setFocusModeOn(false)
  if (!workspaceState.isExplorerPanelOpen) workspaceState.setExplorerPanelOpen(true)
}
