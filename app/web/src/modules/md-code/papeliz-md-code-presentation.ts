import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { EditorView, highlightActiveLineGutter, lineNumbers } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { papelizNoteEditorFrontmatterTag, papelizNoteEditorWikilinkTag } from '../note-editor/papeliz-note-editor-markdown-syntax'

// MD Code: the note as raw Markdown, like a code editor — monospace, line numbers, every mark
// visible, with colors for headings, links, code and frontmatter. Colors keep WCAG AA on both
// themes (they are theme variables from papeliz-webapp.css).
const papelizMdCodeHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: '700' },
  { tag: [tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6, tags.heading], fontWeight: '600' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url, papelizNoteEditorWikilinkTag], color: 'var(--color-papeliz-blue)' },
  { tag: [tags.processingInstruction, tags.labelName, tags.contentSeparator], color: 'var(--color-papeliz-ink-subtle)' },
  { tag: tags.monospace, color: 'var(--color-papeliz-code-ink)' },
  { tag: tags.quote, color: 'var(--color-papeliz-ink-muted)' },
  { tag: tags.atom, color: 'var(--color-papeliz-blue)' },
  { tag: papelizNoteEditorFrontmatterTag, color: 'var(--color-papeliz-frontmatter-ink)' },
])

const papelizMdCodeTheme = EditorView.theme({
  // Always monospace, a little smaller than the note's text size.
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    fontSize: 'calc(var(--papeliz-note-font-size) - 3px)',
    lineHeight: '1.8',
  },
  '.cm-content': { padding: '2px 0 160px' },
  '.cm-line': { padding: '0 8px 0 4px' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--color-papeliz-ink-subtle)',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '34px',
    padding: '0 12px 0 0',
    fontSize: '12px',
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--color-papeliz-ink)' },
})

export const papelizMdCodePresentation: Extension = [
  lineNumbers(),
  highlightActiveLineGutter(),
  syntaxHighlighting(papelizMdCodeHighlightStyle),
  papelizMdCodeTheme,
  EditorView.editorAttributes.of({ class: 'papeliz-md-code' }),
]
