import { EditorSelection, Prec, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { isPapelizKeyBindingPressed } from '../workspace/papeliz-key-bindings-store'
import { togglePapelizInlineMarkdownFormat, type PapelizInlineMarkdownFormat } from './papeliz-note-inline-formatting'

// The editor commands for inline formats, used by the note's context menu and by Ctrl+B, Ctrl+I
// and Ctrl+U (or the keys chosen in Key Bindings). Each selection range is formatted on its own; a
// format already on comes off.

export function runPapelizInlineMarkdownFormat(editorView: EditorView, inlineMarkdownFormat: PapelizInlineMarkdownFormat): boolean {
  const editorState = editorView.state
  if (editorState.readOnly) return false
  const noteText = editorState.doc.toString()
  editorView.dispatch(
    editorState.changeByRange((selectionRange) => {
      const formatResult = togglePapelizInlineMarkdownFormat(noteText, selectionRange.from, selectionRange.to, inlineMarkdownFormat)
      return {
        changes: formatResult.textChanges.map((textChange) => ({ from: textChange.changeFrom, to: textChange.changeTo, insert: textChange.insertedText })),
        range: EditorSelection.range(formatResult.formattedSelectionFrom, formatResult.formattedSelectionTo),
      }
    }),
    { userEvent: 'input.format', scrollIntoView: true },
  )
  return true
}

// Ahead of the default keys, where Ctrl+I selects the enclosing syntax. Each binding checks the
// press against its current Key Binding as it happens, so a changed shortcut works at once in every
// note, open or cached.
export const papelizNoteFormattingKeymapExtension: Extension = Prec.high(
  keymap.of([
    { any: (editorView, keyboardEvent) => isPapelizKeyBindingPressed(keyboardEvent, 'note-format-bold') && runPapelizInlineMarkdownFormat(editorView, 'bold') },
    { any: (editorView, keyboardEvent) => isPapelizKeyBindingPressed(keyboardEvent, 'note-format-italic') && runPapelizInlineMarkdownFormat(editorView, 'italic') },
    {
      any: (editorView, keyboardEvent) => isPapelizKeyBindingPressed(keyboardEvent, 'note-format-underline') && runPapelizInlineMarkdownFormat(editorView, 'underline'),
    },
  ]),
)
