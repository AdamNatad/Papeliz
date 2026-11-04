import { create } from 'zustand'

// Which part of the AI Assistant panel shows, and whether the provider settings were asked for
// (Choose a Provider, the model chip, an error's link, an inline edit with no provider): the
// workspace's Settings gear then opens on its AI Provider page and clears the request. Asked for at
// Models for Transcribe and Draw (the chips' menus), the page also scrolls to that section, which takes
// the request back.
export type PapelizAssistantPanelTab = 'chat' | 'imagine' | 'sessions' | 'usage'

interface PapelizAssistantPanelUiState {
  assistantPanelTab: PapelizAssistantPanelTab
  isAssistantProviderSettingsPageRequested: boolean
  isAssistantModelsForEachTaskSectionRequested: boolean
  // Bumped to move keyboard focus into the chat composer (after "Ask Assistant", say).
  composerFocusRequestCount: number
  setAssistantPanelTab: (assistantPanelTab: PapelizAssistantPanelTab) => void
  requestAssistantProviderSettingsPage: () => void
  clearAssistantProviderSettingsPageRequest: () => void
  requestAssistantModelsForEachTaskSection: () => void
  clearAssistantModelsForEachTaskSectionRequest: () => void
  requestComposerFocus: () => void
}

export const usePapelizAssistantPanelUiStore = create<PapelizAssistantPanelUiState>()((setPanelUiState) => ({
  assistantPanelTab: 'chat',
  isAssistantProviderSettingsPageRequested: false,
  isAssistantModelsForEachTaskSectionRequested: false,
  composerFocusRequestCount: 0,
  setAssistantPanelTab: (assistantPanelTab) => setPanelUiState({ assistantPanelTab }),
  requestAssistantProviderSettingsPage: () => setPanelUiState({ isAssistantProviderSettingsPageRequested: true }),
  clearAssistantProviderSettingsPageRequest: () => setPanelUiState({ isAssistantProviderSettingsPageRequested: false }),
  requestAssistantModelsForEachTaskSection: () => setPanelUiState({ isAssistantProviderSettingsPageRequested: true, isAssistantModelsForEachTaskSectionRequested: true }),
  clearAssistantModelsForEachTaskSectionRequest: () => setPanelUiState({ isAssistantModelsForEachTaskSectionRequested: false }),
  requestComposerFocus: () => setPanelUiState((panelUiState) => ({ composerFocusRequestCount: panelUiState.composerFocusRequestCount + 1 })),
}))
