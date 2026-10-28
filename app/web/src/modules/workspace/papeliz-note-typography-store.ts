import { create } from 'zustand'
import {
  papelizNoteTypographySettingName,
  papelizNoteZoomPercentSettingName,
  readPapelizUserSetting,
  writePapelizUserSetting,
} from '../settings/papeliz-user-settings'

// How notes are set: the font, its size and how wide the text runs. MD View, MD Code (a little
// smaller, always monospace) and the rendered page all read them as CSS variables on the page, and
// they are kept in the browser's settings.

export type PapelizNoteFontFamily = 'sans' | 'serif' | 'mono'
export type PapelizNoteColumnWidth = 'narrow' | 'normal' | 'wide' | 'full'

export interface PapelizNoteTypography {
  noteFontFamily: PapelizNoteFontFamily
  noteFontSize: number
  noteColumnWidth: PapelizNoteColumnWidth
}

export const papelizNoteFontSizeLimits = { minimumNoteFontSize: 14, defaultNoteFontSize: 17, maximumNoteFontSize: 24 } as const

export const papelizDefaultNoteTypography: PapelizNoteTypography = {
  noteFontFamily: 'sans',
  noteFontSize: papelizNoteFontSizeLimits.defaultNoteFontSize,
  noteColumnWidth: 'normal',
}

// Zoom, as in a document editor: the note's text size and column width scale together, so MD Code,
// MD View and the rendered page all grow or shrink as one. The app's own buttons stay their size.
export const papelizNoteZoomPercentLimits = { minimumNoteZoomPercent: 50, defaultNoteZoomPercent: 100, maximumNoteZoomPercent: 200 } as const
export const papelizNoteZoomPercentChoices = [50, 75, 90, 100, 110, 125, 150, 175, 200] as const
const papelizNoteZoomPercentStep = 10

function clampNoteZoomPercent(noteZoomPercent: number): number {
  if (!Number.isFinite(noteZoomPercent)) return papelizNoteZoomPercentLimits.defaultNoteZoomPercent
  return Math.round(Math.min(papelizNoteZoomPercentLimits.maximumNoteZoomPercent, Math.max(papelizNoteZoomPercentLimits.minimumNoteZoomPercent, noteZoomPercent)))
}

const papelizNoteFontFamilyValues: Record<PapelizNoteFontFamily, string> = {
  sans: 'var(--font-sans)',
  serif: 'var(--font-serif)',
  mono: 'var(--font-mono)',
}

// Pixel widths, before zoom; Full is the whole column.
const papelizNoteColumnWidthPixels: Record<PapelizNoteColumnWidth, number | null> = {
  narrow: 600,
  normal: 720,
  wide: 900,
  full: null,
}

function clampNoteFontSize(noteFontSize: number): number {
  if (!Number.isFinite(noteFontSize)) return papelizNoteFontSizeLimits.defaultNoteFontSize
  return Math.round(Math.min(papelizNoteFontSizeLimits.maximumNoteFontSize, Math.max(papelizNoteFontSizeLimits.minimumNoteFontSize, noteFontSize)))
}

function applyNoteTypographyToPage({ noteFontFamily, noteFontSize, noteColumnWidth }: PapelizNoteTypography, noteZoomPercent: number): void {
  const rootStyle = document.documentElement.style
  const noteZoomFactor = noteZoomPercent / 100
  const noteColumnWidthPixels = papelizNoteColumnWidthPixels[noteColumnWidth]
  rootStyle.setProperty('--papeliz-note-font-family', papelizNoteFontFamilyValues[noteFontFamily])
  const roundToHundredths = (unroundedPixels: number) => Math.round(unroundedPixels * 100) / 100
  rootStyle.setProperty('--papeliz-note-font-size', `${roundToHundredths(noteFontSize * noteZoomFactor)}px`)
  rootStyle.setProperty('--papeliz-note-column-width', noteColumnWidthPixels === null ? '100%' : `${roundToHundredths(noteColumnWidthPixels * noteZoomFactor)}px`)
}

interface PapelizNoteTypographyState extends PapelizNoteTypography {
  // The note's zoom, 50% to 200%; kept apart from the text settings, so resetting them keeps it.
  noteZoomPercent: number
  loadNoteTypography: () => Promise<void>
  changeNoteTypography: (noteTypographyChanges: Partial<PapelizNoteTypography>) => void
  setNoteZoomPercent: (noteZoomPercent: number) => void
  // One step in or out (10%), from the status bar's buttons or Ctrl+scroll.
  stepNoteZoomPercent: (noteZoomDirection: 'in' | 'out') => void
}

export const usePapelizNoteTypographyStore = create<PapelizNoteTypographyState>()((setTypographyState, getTypographyState) => ({
  ...papelizDefaultNoteTypography,
  noteZoomPercent: papelizNoteZoomPercentLimits.defaultNoteZoomPercent,

  loadNoteTypography: async () => {
    const [savedNoteTypography, savedNoteZoomPercent] = await Promise.all([
      readPapelizUserSetting<Partial<PapelizNoteTypography> | null>(papelizNoteTypographySettingName, null),
      readPapelizUserSetting<unknown>(papelizNoteZoomPercentSettingName, papelizNoteZoomPercentLimits.defaultNoteZoomPercent),
    ])
    const noteZoomPercent = clampNoteZoomPercent(typeof savedNoteZoomPercent === 'number' ? savedNoteZoomPercent : papelizNoteZoomPercentLimits.defaultNoteZoomPercent)
    setTypographyState({ noteZoomPercent })
    if (savedNoteTypography === null || typeof savedNoteTypography !== 'object') {
      applyNoteTypographyToPage(getTypographyState(), noteZoomPercent)
      return
    }
    const loadedNoteTypography: PapelizNoteTypography = {
      noteFontFamily: savedNoteTypography.noteFontFamily !== undefined && savedNoteTypography.noteFontFamily in papelizNoteFontFamilyValues ? savedNoteTypography.noteFontFamily : 'sans',
      noteFontSize: clampNoteFontSize(savedNoteTypography.noteFontSize ?? papelizNoteFontSizeLimits.defaultNoteFontSize),
      noteColumnWidth:
        savedNoteTypography.noteColumnWidth !== undefined && savedNoteTypography.noteColumnWidth in papelizNoteColumnWidthPixels ? savedNoteTypography.noteColumnWidth : 'normal',
    }
    setTypographyState(loadedNoteTypography)
    applyNoteTypographyToPage(loadedNoteTypography, noteZoomPercent)
  },

  changeNoteTypography: (noteTypographyChanges) => {
    const { noteFontFamily, noteFontSize, noteColumnWidth } = getTypographyState()
    const changedNoteTypography: PapelizNoteTypography = {
      noteFontFamily: noteTypographyChanges.noteFontFamily ?? noteFontFamily,
      noteFontSize: clampNoteFontSize(noteTypographyChanges.noteFontSize ?? noteFontSize),
      noteColumnWidth: noteTypographyChanges.noteColumnWidth ?? noteColumnWidth,
    }
    setTypographyState(changedNoteTypography)
    applyNoteTypographyToPage(changedNoteTypography, getTypographyState().noteZoomPercent)
    void writePapelizUserSetting(papelizNoteTypographySettingName, changedNoteTypography).catch(() => undefined)
  },

  setNoteZoomPercent: (noteZoomPercent) => {
    const clampedNoteZoomPercent = clampNoteZoomPercent(noteZoomPercent)
    if (clampedNoteZoomPercent === getTypographyState().noteZoomPercent) return
    setTypographyState({ noteZoomPercent: clampedNoteZoomPercent })
    applyNoteTypographyToPage(getTypographyState(), clampedNoteZoomPercent)
    void writePapelizUserSetting(papelizNoteZoomPercentSettingName, clampedNoteZoomPercent).catch(() => undefined)
  },

  stepNoteZoomPercent: (noteZoomDirection) => {
    const currentNoteZoomPercent = getTypographyState().noteZoomPercent
    // Steps land on whole tens, so 95% steps to 100%, not 105%.
    const steppedNoteZoomPercent =
      noteZoomDirection === 'in'
        ? Math.floor(currentNoteZoomPercent / papelizNoteZoomPercentStep) * papelizNoteZoomPercentStep + papelizNoteZoomPercentStep
        : Math.ceil(currentNoteZoomPercent / papelizNoteZoomPercentStep) * papelizNoteZoomPercentStep - papelizNoteZoomPercentStep
    getTypographyState().setNoteZoomPercent(steppedNoteZoomPercent)
  },
}))
