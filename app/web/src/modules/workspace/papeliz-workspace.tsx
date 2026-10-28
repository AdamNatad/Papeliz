import { useEffect, useState } from 'react'
import { movePapelizEarlierChatSessionsIntoChatSessionsFolder } from '../assistant/papeliz-assistant-chat-session-folder-move'
import { usePapelizAssistantConversationStore } from '../assistant/papeliz-assistant-conversation-store'
import { PapelizAssistantPanel } from '../assistant/papeliz-assistant-panel'
import { usePapelizAssistantPanelUiStore } from '../assistant/papeliz-assistant-panel-ui-store'
import { PapelizAssistantProviderSettingsDialog } from '../assistant/papeliz-assistant-provider-settings-dialog'
import { usePapelizAssistantProviderSettingsStore } from '../assistant/papeliz-assistant-provider-settings-store'
import { PapelizFocusModeAssistant } from '../assistant/papeliz-focus-mode-assistant'
import { createPapelizNoteEditorSessionCache } from '../note-editor/papeliz-note-editor'
import { PapelizConfirmDialog } from '../ui/papeliz-confirm-dialog'
import { usePapelizMediaQuery } from '../ui/papeliz-media-query'
import { PapelizPanelResizeHandle } from '../ui/papeliz-panel-resize-handle'
import { PapelizFileExplorer } from './papeliz-file-explorer'
import { PapelizFileListThisNoteSection } from './papeliz-file-list-this-note-section'
import { usePapelizFileListThisNoteStore } from './papeliz-file-list-this-note-store'
import { isPapelizKeyBindingPressed, usePapelizKeyBindingsStore } from './papeliz-key-bindings-store'
import { PapelizNoteArea } from './papeliz-note-area'
import { PapelizNoteTabsBar } from './papeliz-note-tabs-bar'
import { PapelizSlidingSidePanel } from './papeliz-sliding-side-panel'
import { PapelizStatusBar } from './papeliz-status-bar'
import { startPapelizVaultKnowledgeSync } from './papeliz-vault-knowledge-store'
import { usePapelizNoteTabsLayoutStore } from './papeliz-note-tabs-layout-store'
import { usePapelizNoteTypographyStore } from './papeliz-note-typography-store'
import { PapelizWorkspaceNotice } from './papeliz-workspace-notice'
import {
  papelizAssistantPanelWidthLimits,
  papelizExplorerPanelWidthLimits,
  usePapelizWorkspacePanelWidthsStore,
} from './papeliz-workspace-panel-widths-store'
import { PapelizWorkspaceTopbar } from './papeliz-workspace-topbar'
import { usePapelizWorkspaceStore, type PapelizWorkspaceSidePanel } from './papeliz-workspace-store'

function focusNoteEditorTextSoon(): void {
  requestAnimationFrame(() => document.querySelector<HTMLElement>('.papeliz-note-editor .cm-content')?.focus())
}

// Vaults whose earlier chat folders were already checked while this page has been open.
const papelizChatSessionMoveCheckedVaultIds = new Set<string>()

// The workspace: the blue topbar across the top and the blue status bar across the bottom; between
// them the files on the left, the note (with its open-notes strip on top) in the middle and the
// Assistant on the right, both docked beside the note. They work as an accordion: the note keeps
// at least 480 px, so opening one closes the other when both won't fit (and when the window gets too
// narrow, the one opened first closes). Below 768 px both open as drawers, one at a time. Docked or
// as drawers, both are resized by dragging their inner edge, and share one width each.
export function PapelizWorkspace() {
  const isExplorerPanelOpen = usePapelizWorkspaceStore((workspaceState) => workspaceState.isExplorerPanelOpen)
  const isAssistantPanelOpen = usePapelizWorkspaceStore((workspaceState) => workspaceState.isAssistantPanelOpen)
  const isFocusModeOn = usePapelizWorkspaceStore((workspaceState) => workspaceState.isFocusModeOn)
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)
  const isVaultCloseConfirmationShown = usePapelizWorkspaceStore((workspaceState) => workspaceState.isVaultCloseConfirmationShown)
  const setVaultCloseConfirmationShown = usePapelizWorkspaceStore((workspaceState) => workspaceState.setVaultCloseConfirmationShown)
  const closeVaultInWorkspace = usePapelizWorkspaceStore((workspaceState) => workspaceState.closeVaultInWorkspace)
  const setExplorerPanelOpen = usePapelizWorkspaceStore((workspaceState) => workspaceState.setExplorerPanelOpen)
  const setAssistantPanelOpen = usePapelizWorkspaceStore((workspaceState) => workspaceState.setAssistantPanelOpen)
  const isWideScreen = usePapelizMediaQuery('(min-width: 768px)')
  const isProviderSettingsDialogOpen = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.isProviderSettingsDialogOpen)
  const setProviderSettingsDialogOpen = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.setProviderSettingsDialogOpen)
  const explorerPanelWidth = usePapelizWorkspacePanelWidthsStore((panelWidthsState) => panelWidthsState.explorerPanelWidth)
  const assistantPanelWidth = usePapelizWorkspacePanelWidthsStore((panelWidthsState) => panelWidthsState.assistantPanelWidth)
  const setExplorerPanelWidth = usePapelizWorkspacePanelWidthsStore((panelWidthsState) => panelWidthsState.setExplorerPanelWidth)
  const setAssistantPanelWidth = usePapelizWorkspacePanelWidthsStore((panelWidthsState) => panelWidthsState.setAssistantPanelWidth)
  const saveWorkspacePanelWidths = usePapelizWorkspacePanelWidthsStore((panelWidthsState) => panelWidthsState.saveWorkspacePanelWidths)

  // The workspace is keyed by vault, so this cache (undo history and cursors) lasts one vault.
  const [noteEditorSessionCache] = useState(createPapelizNoteEditorSessionCache)

  // Links, tags, headings and search for the whole vault; the assistant's saved provider.
  useEffect(() => startPapelizVaultKnowledgeSync(), [])
  // Saved chats in the folders Papeliz used before move into `.csessions`, out of the file list:
  // once per vault while the page is open. The open chat follows its note.
  useEffect(() => {
    const openVault = usePapelizWorkspaceStore.getState().openVault
    if (openVault === null || papelizChatSessionMoveCheckedVaultIds.has(openVault.papelizVaultId)) return
    papelizChatSessionMoveCheckedVaultIds.add(openVault.papelizVaultId)
    void movePapelizEarlierChatSessionsIntoChatSessionsFolder(openVault.papelizVaultAdapter)
      .then((movedChatSessionPaths) => {
        if (movedChatSessionPaths.size === 0) return
        const movedLiveChatSessionPath = movedChatSessionPaths.get(usePapelizAssistantConversationStore.getState().chatSessionVaultNoteRelativePath ?? '')
        if (movedLiveChatSessionPath !== undefined) usePapelizAssistantConversationStore.setState({ chatSessionVaultNoteRelativePath: movedLiveChatSessionPath })
        return usePapelizWorkspaceStore.getState().refreshVaultTree()
      })
      .catch(() => undefined)
  }, [])
  useEffect(() => {
    void usePapelizAssistantProviderSettingsStore.getState().loadAssistantProviderSettings()
    // Saved widths can be wider than the defaults the vault opened with: check the fit again.
    void usePapelizWorkspacePanelWidthsStore
      .getState()
      .loadWorkspacePanelWidths()
      .then(() => usePapelizWorkspaceStore.getState().fitWorkspaceSidePanelsToWindow())
    void usePapelizNoteTypographyStore.getState().loadNoteTypography()
    void usePapelizNoteTabsLayoutStore.getState().loadNoteTabsLayout()
    void usePapelizFileListThisNoteStore.getState().loadFileListThisNoteSection()
    void usePapelizKeyBindingsStore.getState().loadKeyBindings()
  }, [])

  useEffect(() => {
    // The three shortcuts follow Accessibility > Key Bindings (Ctrl+E, Ctrl+S and Ctrl+Shift+F by
    // default); Esc stays Esc.
    const handleWorkspaceShortcut = (keyboardEvent: KeyboardEvent) => {
      const workspaceState = usePapelizWorkspaceStore.getState()
      if (isPapelizKeyBindingPressed(keyboardEvent, 'note-view-switch')) {
        keyboardEvent.preventDefault()
        workspaceState.toggleNoteViewMode()
        focusNoteEditorTextSoon()
      } else if (isPapelizKeyBindingPressed(keyboardEvent, 'vault-notes-save-all')) {
        keyboardEvent.preventDefault()
        void workspaceState.saveAllVaultNotesNow()
      } else if (isPapelizKeyBindingPressed(keyboardEvent, 'focus-mode-toggle')) {
        keyboardEvent.preventDefault()
        workspaceState.setFocusModeOn(!workspaceState.isFocusModeOn)
      } else if (keyboardEvent.key === 'Escape' && !keyboardEvent.defaultPrevented) {
        if (workspaceState.isFocusModeOn) workspaceState.setFocusModeOn(false)
        else if (!window.matchMedia('(min-width: 768px)').matches && workspaceState.isExplorerPanelOpen) workspaceState.setExplorerPanelOpen(false)
        else if (!window.matchMedia('(min-width: 768px)').matches && workspaceState.isAssistantPanelOpen) workspaceState.setAssistantPanelOpen(false)
      }
    }
    window.addEventListener('keydown', handleWorkspaceShortcut)
    return () => window.removeEventListener('keydown', handleWorkspaceShortcut)
  }, [])

  useEffect(() => {
    const fitSidePanelsToWindow = () => usePapelizWorkspaceStore.getState().fitWorkspaceSidePanelsToWindow()
    fitSidePanelsToWindow()
    window.addEventListener('resize', fitSidePanelsToWindow)
    return () => window.removeEventListener('resize', fitSidePanelsToWindow)
  }, [])

  // A panel dragged wider keeps its place; the other one hides if the note would get too narrow.
  const finishSidePanelResize = (resizedWorkspaceSidePanel: PapelizWorkspaceSidePanel) => {
    saveWorkspacePanelWidths()
    usePapelizWorkspaceStore.getState().fitWorkspaceSidePanelsToWindow(resizedWorkspaceSidePanel)
  }

  const isExplorerShown = !isFocusModeOn && isExplorerPanelOpen
  const isAssistantShown = !isFocusModeOn && isAssistantPanelOpen

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-papeliz-surface">
      <PapelizWorkspaceTopbar />

      <div className="flex min-h-0 flex-1">
        <PapelizSlidingSidePanel
          isSidePanelShown={isExplorerShown}
          sidePanelSide="left"
          sidePanelPlacement={isWideScreen ? 'docked' : 'drawer'}
          sidePanelWidth={explorerPanelWidth}
          sidePanelMaximumWidth={isWideScreen ? '40vw' : '86vw'}
          onSidePanelBackdropClick={() => setExplorerPanelOpen(false)}
        >
          <PapelizFileExplorer fileListFootSection={<PapelizFileListThisNoteSection noteEditorSessionCache={noteEditorSessionCache} />} />
          <PapelizPanelResizeHandle
            resizeHandleLabel="Resize the file list"
            resizedPanelSide="left"
            panelWidth={explorerPanelWidth}
            {...papelizExplorerPanelWidthLimits}
            onPanelWidthChange={setExplorerPanelWidth}
            onPanelResizeEnd={() => finishSidePanelResize('explorer')}
          />
        </PapelizSlidingSidePanel>

        <main className="relative flex min-w-0 flex-1 flex-col">
          <PapelizNoteTabsBar />
          <PapelizNoteArea noteEditorSessionCache={noteEditorSessionCache} />
          {isFocusModeOn && <PapelizFocusModeAssistant />}
        </main>

        <PapelizSlidingSidePanel
          isSidePanelShown={isAssistantShown}
          sidePanelSide="right"
          sidePanelPlacement={isWideScreen ? 'docked' : 'drawer'}
          sidePanelWidth={assistantPanelWidth}
          sidePanelMaximumWidth={isWideScreen ? '45vw' : '100vw'}
          onSidePanelBackdropClick={() => setAssistantPanelOpen(false)}
        >
          <PapelizAssistantPanel onAssistantPanelClose={() => setAssistantPanelOpen(false)} />
          <PapelizPanelResizeHandle
            resizeHandleLabel="Resize the Assistant panel"
            resizedPanelSide="right"
            panelWidth={assistantPanelWidth}
            {...papelizAssistantPanelWidthLimits}
            onPanelWidthChange={setAssistantPanelWidth}
            onPanelResizeEnd={() => finishSidePanelResize('assistant')}
          />
        </PapelizSlidingSidePanel>
      </div>

      <PapelizStatusBar />
      <PapelizWorkspaceNotice dockedAssistantPanelWidth={isAssistantShown && isWideScreen ? assistantPanelWidth : null} />
      {isVaultCloseConfirmationShown && openVault !== null && (
        <PapelizConfirmDialog
          confirmDialogTitle={`Close “${openVault.papelizVaultDisplayName}”?`}
          confirmDialogBody={
            openVault.papelizVaultAdapter.papelizVaultKind === 'folder-on-disk' ? (
              <p>Your notes are saved and stay in the folder. You go back to the start page, where you can open it again.</p>
            ) : (
              <p>This vault lives only in this browser tab, so changes to its notes are lost when it closes. You go back to the start page.</p>
            )
          }
          confirmButtonLabel="Close vault"
          onCancel={() => setVaultCloseConfirmationShown(false)}
          onConfirm={() => {
            setVaultCloseConfirmationShown(false)
            void closeVaultInWorkspace()
          }}
        />
      )}
      {isProviderSettingsDialogOpen && <PapelizAssistantProviderSettingsDialog onProviderSettingsDialogClose={() => setProviderSettingsDialogOpen(false)} />}
    </div>
  )
}
