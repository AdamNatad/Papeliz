import type { EditorView } from '@codemirror/view'
import { create } from 'zustand'
import { readPapelizInlineEditRange, setPapelizInlineEditRangeEffect } from './papeliz-assistant-inline-edit-extension'
import { runPapelizInlineEdit } from './papeliz-assistant-inline-edit-run'

// The inline edit that is open, if any: which passage, what was asked, and the assistant's answer.
export type PapelizInlineEditStage = 'composing' | 'running' | 'review' | 'failed'

interface PapelizInlineEditState {
  inlineEditEditorView: EditorView | null
  selectedPassageText: string
  vaultNoteTitle: string
  inlineEditStage: PapelizInlineEditStage
  inlineEditInstruction: string
  replacementPassageText: string
  inlineEditProblem: string | null
  openInlineEdit: (inlineEditEditorView: EditorView, selectedPassageText: string, vaultNoteTitle: string) => void
  setInlineEditInstruction: (inlineEditInstruction: string) => void
  runInlineEdit: (inlineEditInstruction: string) => Promise<void>
  acceptInlineEdit: () => void
  closeInlineEdit: () => void
}

let activeInlineEditAbortController: AbortController | null = null

export const usePapelizInlineEditStore = create<PapelizInlineEditState>()((setInlineEditState, getInlineEditState) => ({
  inlineEditEditorView: null,
  selectedPassageText: '',
  vaultNoteTitle: '',
  inlineEditStage: 'composing',
  inlineEditInstruction: '',
  replacementPassageText: '',
  inlineEditProblem: null,

  openInlineEdit: (inlineEditEditorView, selectedPassageText, vaultNoteTitle) => {
    activeInlineEditAbortController?.abort()
    setInlineEditState({
      inlineEditEditorView,
      selectedPassageText,
      vaultNoteTitle,
      inlineEditStage: 'composing',
      inlineEditInstruction: '',
      replacementPassageText: '',
      inlineEditProblem: null,
    })
  },

  setInlineEditInstruction: (inlineEditInstruction) => setInlineEditState({ inlineEditInstruction }),

  runInlineEdit: async (inlineEditInstruction) => {
    const { selectedPassageText, vaultNoteTitle } = getInlineEditState()
    if (inlineEditInstruction.trim().length === 0) return
    activeInlineEditAbortController?.abort()
    const inlineEditAbortController = new AbortController()
    activeInlineEditAbortController = inlineEditAbortController
    setInlineEditState({ inlineEditInstruction, inlineEditStage: 'running', replacementPassageText: '', inlineEditProblem: null })
    try {
      const replacementPassageText = await runPapelizInlineEdit({
        inlineEditInstruction,
        selectedPassageText,
        vaultNoteTitle,
        abortSignal: inlineEditAbortController.signal,
        onReplacementTextDelta: (replacementTextDelta) =>
          setInlineEditState((inlineEditState) => ({ replacementPassageText: inlineEditState.replacementPassageText + replacementTextDelta })),
      })
      if (activeInlineEditAbortController === inlineEditAbortController) setInlineEditState({ replacementPassageText, inlineEditStage: 'review' })
    } catch (inlineEditError) {
      if (inlineEditError instanceof DOMException && inlineEditError.name === 'AbortError') return
      setInlineEditState({
        inlineEditStage: 'failed',
        inlineEditProblem: inlineEditError instanceof Error ? inlineEditError.message : 'The assistant could not edit the passage.',
      })
    }
  },

  acceptInlineEdit: () => {
    const { inlineEditEditorView, selectedPassageText, replacementPassageText } = getInlineEditState()
    if (inlineEditEditorView === null) return
    const inlineEditRange = readPapelizInlineEditRange(inlineEditEditorView.state)
    if (inlineEditRange === null || inlineEditEditorView.state.sliceDoc(inlineEditRange.inlineEditFrom, inlineEditRange.inlineEditTo) !== selectedPassageText) {
      setInlineEditState({ inlineEditStage: 'failed', inlineEditProblem: 'The passage changed while the assistant worked. Select it again.' })
      return
    }
    // One change in the editor, so Undo puts the old passage back.
    inlineEditEditorView.dispatch({
      changes: { from: inlineEditRange.inlineEditFrom, to: inlineEditRange.inlineEditTo, insert: replacementPassageText },
      selection: { anchor: inlineEditRange.inlineEditFrom + replacementPassageText.length },
      effects: setPapelizInlineEditRangeEffect.of(null),
      userEvent: 'input.papeliz-inline-edit',
    })
    inlineEditEditorView.focus()
    setInlineEditState({ inlineEditEditorView: null })
  },

  closeInlineEdit: () => {
    activeInlineEditAbortController?.abort()
    activeInlineEditAbortController = null
    const { inlineEditEditorView } = getInlineEditState()
    if (inlineEditEditorView !== null && readPapelizInlineEditRange(inlineEditEditorView.state) !== null) {
      inlineEditEditorView.dispatch({ effects: setPapelizInlineEditRangeEffect.of(null) })
      inlineEditEditorView.focus()
    }
    setInlineEditState({ inlineEditEditorView: null })
  },
}))
