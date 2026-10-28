import { create } from 'zustand'
import { papelizFileListThisNoteSectionSettingName, readPapelizUserSetting, writePapelizUserSetting } from '../settings/papeliz-user-settings'

// This note, under the file list: whether it is folded, and whether it shows the open note's
// Outline or its Backlinks. Kept in the browser's settings.

export type PapelizFileListThisNoteView = 'outline' | 'backlinks'

interface PapelizFileListThisNoteSectionSetting {
  isThisNoteSectionFolded: boolean
  thisNoteSectionView: PapelizFileListThisNoteView
}

interface PapelizFileListThisNoteState extends PapelizFileListThisNoteSectionSetting {
  loadFileListThisNoteSection: () => Promise<void>
  setThisNoteSectionFolded: (isThisNoteSectionFolded: boolean) => void
  setThisNoteSectionView: (thisNoteSectionView: PapelizFileListThisNoteView) => void
}

export const usePapelizFileListThisNoteStore = create<PapelizFileListThisNoteState>()((setThisNoteState, getThisNoteState) => {
  const saveThisNoteSection = () => {
    const { isThisNoteSectionFolded, thisNoteSectionView } = getThisNoteState()
    void writePapelizUserSetting<PapelizFileListThisNoteSectionSetting>(papelizFileListThisNoteSectionSettingName, {
      isThisNoteSectionFolded,
      thisNoteSectionView,
    }).catch(() => undefined)
  }
  return {
    isThisNoteSectionFolded: false,
    thisNoteSectionView: 'outline',
    loadFileListThisNoteSection: async () => {
      const savedThisNoteSection = await readPapelizUserSetting<Partial<PapelizFileListThisNoteSectionSetting> | null>(papelizFileListThisNoteSectionSettingName, null)
      setThisNoteState({
        isThisNoteSectionFolded: savedThisNoteSection?.isThisNoteSectionFolded === true,
        thisNoteSectionView: savedThisNoteSection?.thisNoteSectionView === 'backlinks' ? 'backlinks' : 'outline',
      })
    },
    setThisNoteSectionFolded: (isThisNoteSectionFolded) => {
      setThisNoteState({ isThisNoteSectionFolded })
      saveThisNoteSection()
    },
    setThisNoteSectionView: (thisNoteSectionView) => {
      setThisNoteState({ thisNoteSectionView })
      saveThisNoteSection()
    },
  }
})
