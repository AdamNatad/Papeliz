import { afterEach, describe, expect, it } from 'vitest'
import { requestPapelizFileExplorerSearch, usePapelizFileExplorerSearchRequestStore } from './papeliz-file-explorer-search-request-store'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

afterEach(() => {
  usePapelizFileExplorerSearchRequestStore.getState().clearPendingFileExplorerSearchRequest()
  usePapelizWorkspaceStore.setState({ isExplorerPanelOpen: true, isFocusModeOn: false })
})

describe('a search asked of the file list (a #tag clicked in MD View)', () => {
  it('opens the file list, leaving Focus mode, and waits there for the list to take it', () => {
    usePapelizWorkspaceStore.setState({ isExplorerPanelOpen: false, isFocusModeOn: true })
    requestPapelizFileExplorerSearch('#reading')
    expect(usePapelizWorkspaceStore.getState().isExplorerPanelOpen).toBe(true)
    expect(usePapelizWorkspaceStore.getState().isFocusModeOn).toBe(false)
    expect(usePapelizFileExplorerSearchRequestStore.getState().pendingFileExplorerSearchRequest?.fileExplorerSearchQueryText).toBe('#reading')
  })

  it('numbers each request, so the same search asked for again runs again', () => {
    requestPapelizFileExplorerSearch('#reading')
    const firstFileExplorerSearchRequest = usePapelizFileExplorerSearchRequestStore.getState().pendingFileExplorerSearchRequest
    usePapelizFileExplorerSearchRequestStore.getState().clearPendingFileExplorerSearchRequest()
    expect(usePapelizFileExplorerSearchRequestStore.getState().pendingFileExplorerSearchRequest).toBeNull()
    requestPapelizFileExplorerSearch('#reading')
    const secondFileExplorerSearchRequest = usePapelizFileExplorerSearchRequestStore.getState().pendingFileExplorerSearchRequest
    expect(secondFileExplorerSearchRequest?.fileExplorerSearchQueryText).toBe('#reading')
    expect(secondFileExplorerSearchRequest?.fileExplorerSearchRequestNumber).toBeGreaterThan(firstFileExplorerSearchRequest?.fileExplorerSearchRequestNumber ?? Infinity)
  })
})
