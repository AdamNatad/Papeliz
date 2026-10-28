import { create } from 'zustand'
import { papelizNoteTabsLayoutSettingName, readPapelizUserSetting, writePapelizUserSetting } from '../settings/papeliz-user-settings'

// How the open notes' tabs sit when there are more than fit: Scroll keeps one row with a scrollbar
// under it; Stack wraps them onto more rows, so every tab shows. Chosen in the Accessibility menu
// and kept in the browser's settings.

export type PapelizNoteTabsLayout = 'scroll' | 'stack'

interface PapelizNoteTabsLayoutState {
  noteTabsLayout: PapelizNoteTabsLayout
  loadNoteTabsLayout: () => Promise<void>
  setNoteTabsLayout: (noteTabsLayout: PapelizNoteTabsLayout) => void
}

export const usePapelizNoteTabsLayoutStore = create<PapelizNoteTabsLayoutState>()((setNoteTabsLayoutState) => ({
  noteTabsLayout: 'scroll',
  loadNoteTabsLayout: async () => {
    const savedNoteTabsLayout = await readPapelizUserSetting<unknown>(papelizNoteTabsLayoutSettingName, 'scroll')
    setNoteTabsLayoutState({ noteTabsLayout: savedNoteTabsLayout === 'stack' ? 'stack' : 'scroll' })
  },
  setNoteTabsLayout: (noteTabsLayout) => {
    setNoteTabsLayoutState({ noteTabsLayout })
    void writePapelizUserSetting(papelizNoteTabsLayoutSettingName, noteTabsLayout).catch(() => undefined)
  },
}))
