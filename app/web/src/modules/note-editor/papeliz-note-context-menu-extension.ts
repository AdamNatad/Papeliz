import { EditorSelection, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

// The editor's side of the note's context menu. A right-click (or the Menu key) opens Papeliz's own
// menu instead of the browser's; Shift+right-click still gives the browser's, which has the
// spelling suggestions. A right-click outside the selection moves the cursor there first, so the
// menu acts on what was clicked.

export interface PapelizNoteContextMenuEditorHandlers {
  openNoteContextMenu: (editorView: EditorView, menuAnchorLeft: number, menuAnchorTop: number) => void
}

export function createPapelizNoteContextMenuExtension(noteContextMenuHandlers: { current: PapelizNoteContextMenuEditorHandlers }): Extension {
  return EditorView.domEventHandlers({
    contextmenu: (contextMenuEvent, editorView) => {
      if (contextMenuEvent.shiftKey) return false
      contextMenuEvent.preventDefault()
      // The Menu key (or Shift+F10) reports no mouse button; the menu then opens at the cursor.
      const isOpenedFromKeyboard = contextMenuEvent.button !== 2
      if (isOpenedFromKeyboard) {
        const cursorCoordinates = editorView.coordsAtPos(editorView.state.selection.main.head)
        noteContextMenuHandlers.current.openNoteContextMenu(editorView, cursorCoordinates?.left ?? 0, cursorCoordinates?.bottom ?? 0)
        return true
      }
      const clickedPosition = editorView.posAtCoords({ x: contextMenuEvent.clientX, y: contextMenuEvent.clientY })
      const isClickInsideSelection =
        clickedPosition !== null &&
        editorView.state.selection.ranges.some((selectionRange) => !selectionRange.empty && clickedPosition >= selectionRange.from && clickedPosition <= selectionRange.to)
      if (clickedPosition !== null && !isClickInsideSelection) editorView.dispatch({ selection: EditorSelection.cursor(clickedPosition) })
      editorView.focus()
      noteContextMenuHandlers.current.openNoteContextMenu(editorView, contextMenuEvent.clientX, contextMenuEvent.clientY)
      return true
    },
  })
}
