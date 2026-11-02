import { create } from 'zustand'

// Which part of the AI Assistant panel shows, and whether the provider settings were asked for
// (Choose a Provider, the model chip, an error's link, an inline edit with no provider): the
// workspace's Settings gear then opens on its AI Provider page and clears the request.
export type PapelizAssistantPanelTab = 'chat' | 'sessions' | 'usage'

interface PapelizAssistantPanelUiState {
  assistantPanelTab: PapelizAssistantPanelTab
  isAssistantProviderSettingsPageRequested: boolean
  // Bumped to move keyboard focus into the chat composer (after "Ask Assistant", say).
  composerFocusRequestCount: number
  setAssistantPanelTab: (assistantPanelTab: PapelizAssistantPanelTab) => void
  requestAssistantProviderSettingsPage: () => void
  clearAssistantProviderSettingsPageRequest: () => void
  requestComposerFocus: () => void
}

export const usePapelizAssistantPanelUiStore = create<PapelizAssistantPanelUiState>()((setPanelUiState) => ({
  assistantPanelTab: 'chat',
  isAssistantProviderSettingsPageRequested: false,
  composerFocusRequestCount: 0,
  setAssistantPanelTab: (assistantPanelTab) => setPanelUiState({ assistantPanelTab }),
  requestAssistantProviderSettingsPage: () => setPanelUiState({ isAssistantProviderSettingsPageRequested: true }),
  clearAssistantProviderSettingsPageRequest: () => setPanelUiState({ isAssistantProviderSettingsPageRequested: false }),
  requestComposerFocus: () => setPanelUiState((panelUiState) => ({ composerFocusRequestCount: panelUiState.composerFocusRequestCount + 1 })),
}))
