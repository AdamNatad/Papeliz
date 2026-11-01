import { json } from '@codemirror/lang-json'
import { codeFolding, foldGutter, foldKeymap, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state'
import { Decoration, EditorView, keymap, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { findPapelizJsonParseProblem, type PapelizJsonParseProblem } from './papeliz-json-parse-problem'
import type { PapelizJsonTreeValueKind } from './papeliz-json-tree-model'

// A JSON file in MD Code: JSON colors, folding beside the line numbers, and the line where the file
// stops parsing marked, a moment after typing stops. The colors are theme variables from
// papeliz-webapp.css, shared with the JSON tree, and keep WCAG AA on both themes.
export const papelizJsonPropertyNameColor = 'var(--color-papeliz-callout-blue-ink)'
export const papelizJsonValueKindColors: Record<PapelizJsonTreeValueKind, string> = {
  object: 'var(--color-papeliz-ink-subtle)',
  array: 'var(--color-papeliz-ink-subtle)',
  string: 'var(--color-papeliz-callout-green-ink)',
  number: 'var(--color-papeliz-callout-orange-ink)',
  boolean: 'var(--color-papeliz-callout-purple-ink)',
  null: 'var(--color-papeliz-ink-subtle)',
}

const papelizJsonCodeHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: papelizJsonPropertyNameColor },
  { tag: tags.string, color: papelizJsonValueKindColors.string },
  { tag: tags.number, color: papelizJsonValueKindColors.number },
  { tag: tags.bool, color: papelizJsonValueKindColors.boolean },
  { tag: tags.null, color: papelizJsonValueKindColors.null, fontStyle: 'italic' },
  { tag: [tags.brace, tags.squareBracket, tags.separator], color: 'var(--color-papeliz-ink-subtle)' },
])

// How long after the last change the file is parsed again.
const papelizJsonParseRecheckDelayMilliseconds = 400

const papelizJsonParseProblemFoundEffect = StateEffect.define<PapelizJsonParseProblem | null>()

class PapelizJsonParseProblemNoteWidget extends WidgetType {
  override eq(): boolean {
    return true
  }

  override toDOM(): HTMLElement {
    return Object.assign(document.createElement('span'), { className: 'papeliz-json-parse-problem-note', textContent: 'JSON stops parsing here' })
  }
}

function markJsonParseProblem(jsonParseProblem: PapelizJsonParseProblem | null, editorState: EditorState): DecorationSet {
  if (jsonParseProblem === null) return Decoration.none
  const problemOffset = Math.min(jsonParseProblem.jsonParseProblemOffset, editorState.doc.length)
  const problemLine = editorState.doc.lineAt(problemOffset)
  const problemMarks = [Decoration.line({ class: 'papeliz-json-parse-problem-line' }).range(problemLine.from)]
  if (problemOffset < problemLine.to) problemMarks.push(Decoration.mark({ class: 'papeliz-json-parse-problem-mark' }).range(problemOffset, problemOffset + 1))
  problemMarks.push(Decoration.widget({ widget: new PapelizJsonParseProblemNoteWidget(), side: 1 }).range(problemLine.to))
  return Decoration.set(problemMarks, true)
}

const papelizJsonParseProblemDecorationsField = StateField.define<DecorationSet>({
  create: (editorState) => markJsonParseProblem(findPapelizJsonParseProblem(editorState.doc.toString()), editorState),
  update: (problemDecorations, editorTransaction) => {
    for (const transactionEffect of editorTransaction.effects) {
      if (transactionEffect.is(papelizJsonParseProblemFoundEffect)) return markJsonParseProblem(transactionEffect.value, editorTransaction.state)
    }
    return editorTransaction.docChanged ? problemDecorations.map(editorTransaction.changes) : problemDecorations
  },
  provide: (problemDecorationsField) => EditorView.decorations.from(problemDecorationsField),
})

const papelizJsonParseRecheck = ViewPlugin.fromClass(
  class {
    private jsonParseRecheckTimer: ReturnType<typeof setTimeout> | undefined

    update(editorViewUpdate: ViewUpdate): void {
      if (!editorViewUpdate.docChanged) return
      clearTimeout(this.jsonParseRecheckTimer)
      const changedEditorView = editorViewUpdate.view
      this.jsonParseRecheckTimer = setTimeout(() => {
        changedEditorView.dispatch({ effects: papelizJsonParseProblemFoundEffect.of(findPapelizJsonParseProblem(changedEditorView.state.doc.toString())) })
      }, papelizJsonParseRecheckDelayMilliseconds)
    }

    destroy(): void {
      clearTimeout(this.jsonParseRecheckTimer)
    }
  },
)

const papelizJsonCodeTheme = EditorView.theme({
  '.cm-foldGutter .cm-gutterElement': { padding: '0 6px 0 0', color: 'var(--color-papeliz-ink-subtle)', cursor: 'pointer' },
  '.cm-foldGutter .cm-gutterElement:hover': { color: 'var(--color-papeliz-ink)' },
  '.cm-foldPlaceholder': {
    margin: '0 2px',
    padding: '0 6px',
    border: 'none',
    borderRadius: '9999px',
    backgroundColor: 'var(--color-papeliz-surface-gray)',
    color: 'var(--color-papeliz-ink-muted)',
  },
  '.papeliz-json-parse-problem-line': { backgroundColor: 'var(--color-papeliz-diff-removed)' },
  '.papeliz-json-parse-problem-mark': { textDecoration: 'underline wavy var(--color-papeliz-diff-removed-ink)', textUnderlineOffset: '3px' },
  '.papeliz-json-parse-problem-note': {
    marginLeft: '12px',
    fontFamily: 'var(--font-sans)',
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--color-papeliz-diff-removed-ink)',
  },
})

export const papelizJsonCodePresentation: Extension = [
  json(),
  syntaxHighlighting(papelizJsonCodeHighlightStyle),
  codeFolding(),
  foldGutter(),
  keymap.of(foldKeymap),
  papelizJsonParseProblemDecorationsField,
  papelizJsonParseRecheck,
  papelizJsonCodeTheme,
]
