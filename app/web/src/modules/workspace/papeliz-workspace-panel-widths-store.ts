import { create } from 'zustand'
import { papelizWorkspacePanelWidthsSettingName, readPapelizUserSetting, writePapelizUserSetting } from '../settings/papeliz-user-settings'

// How wide the file list and the docked Assistant are. Both are dragged by their inner edge and
// kept in the browser's settings, so they come back the same next time.

export interface PapelizWorkspacePanelWidths {
  explorerPanelWidth: number
  assistantPanelWidth: number
}

export const papelizExplorerPanelWidthLimits = { minimumPanelWidth: 200, defaultPanelWidth: 264, maximumPanelWidth: 480 } as const
export const papelizAssistantPanelWidthLimits = { minimumPanelWidth: 320, defaultPanelWidth: 400, maximumPanelWidth: 680 } as const

interface PapelizWorkspacePanelWidthsState extends PapelizWorkspacePanelWidths {
  loadWorkspacePanelWidths: () => Promise<void>
  setExplorerPanelWidth: (explorerPanelWidth: number) => void
  setAssistantPanelWidth: (assistantPanelWidth: number) => void
  saveWorkspacePanelWidths: () => void
}

function clampPanelWidth(panelWidth: number, panelWidthLimits: { minimumPanelWidth: number; maximumPanelWidth: number }): number {
  if (!Number.isFinite(panelWidth)) return panelWidthLimits.minimumPanelWidth
  return Math.round(Math.min(panelWidthLimits.maximumPanelWidth, Math.max(panelWidthLimits.minimumPanelWidth, panelWidth)))
}

export const usePapelizWorkspacePanelWidthsStore = create<PapelizWorkspacePanelWidthsState>()((setPanelWidthsState, getPanelWidthsState) => ({
  explorerPanelWidth: papelizExplorerPanelWidthLimits.defaultPanelWidth,
  assistantPanelWidth: papelizAssistantPanelWidthLimits.defaultPanelWidth,

  loadWorkspacePanelWidths: async () => {
    const savedPanelWidths = await readPapelizUserSetting<Partial<PapelizWorkspacePanelWidths> | null>(papelizWorkspacePanelWidthsSettingName, null)
    if (savedPanelWidths === null || typeof savedPanelWidths !== 'object') return
    setPanelWidthsState({
      explorerPanelWidth: clampPanelWidth(savedPanelWidths.explorerPanelWidth ?? papelizExplorerPanelWidthLimits.defaultPanelWidth, papelizExplorerPanelWidthLimits),
      assistantPanelWidth: clampPanelWidth(
        savedPanelWidths.assistantPanelWidth ?? papelizAssistantPanelWidthLimits.defaultPanelWidth,
        papelizAssistantPanelWidthLimits,
      ),
    })
  },

  setExplorerPanelWidth: (explorerPanelWidth) => setPanelWidthsState({ explorerPanelWidth: clampPanelWidth(explorerPanelWidth, papelizExplorerPanelWidthLimits) }),
  setAssistantPanelWidth: (assistantPanelWidth) =>
    setPanelWidthsState({ assistantPanelWidth: clampPanelWidth(assistantPanelWidth, papelizAssistantPanelWidthLimits) }),

  saveWorkspacePanelWidths: () => {
    const { explorerPanelWidth, assistantPanelWidth } = getPanelWidthsState()
    void writePapelizUserSetting<PapelizWorkspacePanelWidths>(papelizWorkspacePanelWidthsSettingName, { explorerPanelWidth, assistantPanelWidth }).catch(() => undefined)
  },
}))
