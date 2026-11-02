import { EditorView } from '@codemirror/view'
import { selectActiveVaultMarkdownNoteRelativePath, usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'

// What Imagine and Transcribe read of a note before they propose a change to it: its text now, with
// the changes not yet saved, and where its cursor is, from the editor on screen.

// The note's text as the person sees it (its open tab's draft), or null while it is still opening or
// isn't open.
export function readPapelizCurrentVaultNoteText(vaultNoteRelativePath: string): string | null {
  const loadedVaultNote = usePapelizWorkspaceStore.getState().loadedVaultNotesByRelativePath[vaultNoteRelativePath]
  return loadedVaultNote?.noteLoadState === 'loaded' ? loadedVaultNote.draftVaultNoteText : null
}

// The cursor's place in the open note, from the note editor on screen (MD Code, or MD View while it
// can be edited), or null when there is none: the locked view, or an editor showing other text.
export function readPapelizActiveNoteCursorTextOffset(activeVaultNoteText: string): number | null {
  if (selectActiveVaultMarkdownNoteRelativePath(usePapelizWorkspaceStore.getState()) === null) return null
  const noteEditorElements = document.querySelectorAll<HTMLElement>('.papeliz-note-editor .cm-editor')
  if (noteEditorElements.length !== 1) return null
  const noteEditorView = EditorView.findFromDOM(noteEditorElements[0]!)
  if (noteEditorView === null || noteEditorView.state.doc.toString() !== activeVaultNoteText) return null
  return noteEditorView.state.selection.main.head
}
