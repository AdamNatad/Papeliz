import { create } from 'zustand'

// Which part of the AI Assistant panel shows, and whether provider settings are open.
export type PapelizAssistantPanelTab = 'chat' | 'sessions' | 'usage'

interface PapelizAssistantPanelUiState {
  assistantPanelTab: PapelizAssistantPanelTab
  isProviderSettingsDialogOpen: boolean
  // Bumped to move keyboard focus into the chat composer (after "Ask Assistant", say).
  composerFocusRequestCount: number
  setAssistantPanelTab: (assistantPanelTab: PapelizAssistantPanelTab) => void
  setProviderSettingsDialogOpen: (isProviderSettingsDialogOpen: boolean) => void
  requestComposerFocus: () => void
}

export const usePapelizAssistantPanelUiStore = create<PapelizAssistantPanelUiState>()((setPanelUiState) => ({
  assistantPanelTab: 'chat',
  isProviderSettingsDialogOpen: false,
  composerFocusRequestCount: 0,
  setAssistantPanelTab: (assistantPanelTab) => setPanelUiState({ assistantPanelTab }),
  setProviderSettingsDialogOpen: (isProviderSettingsDialogOpen) => setPanelUiState({ isProviderSettingsDialogOpen }),
  requestComposerFocus: () => setPanelUiState((panelUiState) => ({ composerFocusRequestCount: panelUiState.composerFocusRequestCount + 1 })),
}))
