import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import { Prec, StateEffect, StateField, type EditorState, type Extension, type Range } from '@codemirror/state'
import { Decoration, EditorView, keymap, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { createElement } from 'react'
import { createRoot, type Root as ReactRoot } from 'react-dom/client'
import { getPapelizWikilinkDisplayText, parsePapelizWikilinkInnerText } from '../links/papeliz-wikilink-targets'
import { papelizNoteEditorFrontmatterTag } from '../note-editor/papeliz-note-editor-markdown-syntax'
import { parsePapelizHexColor } from '../ui/papeliz-color-values'
import { describePapelizTextStyleCss, matchPapelizTextStyleOpenTag } from '../note-editor/papeliz-note-text-style'
import { papelizUnderlineCloseTag, papelizUnderlineOpenTag } from '../note-editor/papeliz-note-inline-formatting'
import { isPapelizKeyBindingPressed } from '../workspace/papeliz-key-bindings-store'
import { PapelizNoteFrontmatterPropertyChips } from './papeliz-note-frontmatter-property-chips'
import { readPapelizNoteFrontmatterProperties, type PapelizNoteFrontmatterProperty } from './papeliz-note-frontmatter-properties'
import { mountPapelizMermaidDiagram, unmountPapelizMermaidDiagram } from './papeliz-md-view-mermaid-diagrams'
import { findPapelizMdViewRenderedBlocks } from './papeliz-md-view-rendered-blocks'
import {
  collectPapelizMdViewTableWikilinkTargets,
  readPapelizMdViewTableModel,
  splitPapelizMarkdownTableRow,
  type PapelizMdViewInlineContent,
  type PapelizMdViewTableModel,
} from './papeliz-md-view-table-model'

type PapelizMdViewSyntaxNode = ReturnType<ReturnType<typeof syntaxTree>['resolveInner']>

// MD View: the note shown rendered, and still editable. It is the same Markdown text as MD Code,
// drawn with decorations: marks such as `#`, `**` and `[[ ]]` are hidden and the result styled,
// except on the lines the cursor is on, where the raw Markdown shows so it can be edited. Nothing
// is converted, so the file stays exactly the Markdown that was typed.

export interface PapelizMdViewWikilinkHandlers {
  isWikilinkTargetResolved: (wikilinkTargetNoteName: string) => boolean
  activateWikilinkTarget: (wikilinkTargetNoteName: string) => void
}

const papelizMdViewHighlightStyle = HighlightStyle.define([
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--color-papeliz-blue)' },
  { tag: tags.monospace, fontFamily: 'var(--font-mono)' },
  { tag: [tags.processingInstruction, tags.labelName, tags.contentSeparator], color: 'var(--color-papeliz-ink-subtle)' },
  { tag: papelizNoteEditorFrontmatterTag, color: 'var(--color-papeliz-ink-muted)' },
])

const papelizMdViewTheme = EditorView.theme({
  // The note's text settings, from the "Aa" button.
  '.cm-scroller': {
    fontFamily: 'var(--papeliz-note-font-family)',
    fontSize: 'var(--papeliz-note-font-size)',
    lineHeight: '1.7',
  },
  '.cm-content': { padding: '0 0 160px' },
  '.cm-line': { padding: '0 2px' },
})

// `> [!kind]` or `> [!kind|color]`, then an optional title.
const papelizCalloutFirstLinePattern = /^(\s*>\s?)\[!([A-Za-z][\w-]*)(?:\|([A-Za-z-]+|#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}))?\][+-]?[ \t]*(.*)$/
const papelizMdViewTagPattern = /(^|[\s(])#([\p{L}\p{N}_\-/]*[\p{L}_][\p{L}\p{N}_\-/]*)/gu
const papelizMdViewSkippedForTagNodeNames = new Set([
  'FencedCode',
  'CodeBlock',
  'InlineCode',
  'PapelizFrontmatter',
  'Link',
  'Image',
  'URL',
  'Autolink',
  'PapelizWikilink',
  'HTMLBlock',
  'HTMLTag',
])

function createPapelizMdViewWikilinkAnchor(
  wikilinkTargetNoteName: string,
  wikilinkDisplayText: string,
  isWikilinkTargetResolved: boolean,
  wikilinkHandlers: { current: PapelizMdViewWikilinkHandlers },
): HTMLAnchorElement {
  const wikilinkAnchor = document.createElement('a')
  wikilinkAnchor.href = '#'
  wikilinkAnchor.className = isWikilinkTargetResolved ? 'cm-papeliz-md-view-wikilink' : 'cm-papeliz-md-view-wikilink cm-papeliz-md-view-wikilink-unresolved'
  wikilinkAnchor.textContent = wikilinkDisplayText
  wikilinkAnchor.title = isWikilinkTargetResolved ? `Open “${wikilinkTargetNoteName}”` : `Create “${wikilinkTargetNoteName}”`
  wikilinkAnchor.addEventListener('click', (clickEvent) => {
    clickEvent.preventDefault()
    wikilinkHandlers.current.activateWikilinkTarget(wikilinkTargetNoteName)
  })
  return wikilinkAnchor
}

// Ctrl+click (Cmd+click) opens a web link in a new tab; a plain click places the cursor.
function openPapelizMdViewWebLinkOnModifiedClick(clickEvent: MouseEvent): boolean {
  if (!(clickEvent.ctrlKey || clickEvent.metaKey) || !(clickEvent.target instanceof Element)) return false
  const linkHref = clickEvent.target.closest('[data-papeliz-link-href]')?.getAttribute('data-papeliz-link-href')
  if (linkHref === null || linkHref === undefined) return false
  window.open(linkHref, '_blank', 'noopener,noreferrer')
  clickEvent.preventDefault()
  return true
}

class PapelizMdViewWikilinkWidget extends WidgetType {
  constructor(
    readonly wikilinkTargetNoteName: string,
    readonly wikilinkDisplayText: string,
    readonly isWikilinkTargetResolved: boolean,
    readonly wikilinkHandlers: { current: PapelizMdViewWikilinkHandlers },
  ) {
    super()
  }

  override eq(otherWidget: PapelizMdViewWikilinkWidget): boolean {
    return (
      otherWidget.wikilinkTargetNoteName === this.wikilinkTargetNoteName &&
      otherWidget.wikilinkDisplayText === this.wikilinkDisplayText &&
      otherWidget.isWikilinkTargetResolved === this.isWikilinkTargetResolved
    )
  }

  toDOM(): HTMLElement {
    return createPapelizMdViewWikilinkAnchor(this.wikilinkTargetNoteName, this.wikilinkDisplayText, this.isWikilinkTargetResolved, this.wikilinkHandlers)
  }

  override ignoreEvent(): boolean {
    return true
  }
}

class PapelizMdViewTaskCheckboxWidget extends WidgetType {
  constructor(readonly isTaskChecked: boolean) {
    super()
  }

  override eq(otherWidget: PapelizMdViewTaskCheckboxWidget): boolean {
    return otherWidget.isTaskChecked === this.isTaskChecked
  }

  toDOM(editorView: EditorView): HTMLElement {
    const taskCheckbox = document.createElement('input')
    taskCheckbox.type = 'checkbox'
    taskCheckbox.checked = this.isTaskChecked
    taskCheckbox.className = 'cm-papeliz-md-view-task-checkbox'
    taskCheckbox.setAttribute('aria-label', this.isTaskChecked ? 'Mark as not done' : 'Mark as done')
    taskCheckbox.addEventListener('mousedown', (mouseDownEvent) => mouseDownEvent.preventDefault())
    taskCheckbox.addEventListener('click', (clickEvent) => {
      clickEvent.preventDefault()
      if (editorView.state.readOnly) return
      // Ticking a box changes just the one character between the brackets: "[ ]" <-> "[x]".
      const taskMarkerStart = editorView.posAtDOM(taskCheckbox)
      if (!/^\[[ xX]\]$/.test(editorView.state.sliceDoc(taskMarkerStart, taskMarkerStart + 3))) return
      editorView.dispatch({
        changes: { from: taskMarkerStart + 1, to: taskMarkerStart + 2, insert: this.isTaskChecked ? ' ' : 'x' },
        userEvent: 'input.toggle-task',
      })
    })
    return taskCheckbox
  }

  override ignoreEvent(): boolean {
    return true
  }
}

class PapelizMdViewTextWidget extends WidgetType {
  constructor(
    readonly widgetText: string,
    readonly widgetClassName: string,
  ) {
    super()
  }

  override eq(otherWidget: PapelizMdViewTextWidget): boolean {
    return otherWidget.widgetText === this.widgetText && otherWidget.widgetClassName === this.widgetClassName
  }

  toDOM(): HTMLElement {
    const textWidgetElement = document.createElement('span')
    textWidgetElement.className = this.widgetClassName
    textWidgetElement.textContent = this.widgetText
    return textWidgetElement
  }
}

interface PapelizMdViewDecorationSets {
  mdViewDecorations: DecorationSet
  // The hidden tags of colored text: always hidden in MD View, and atomic, so the cursor and
  // Backspace pass over a whole tag instead of breaking it.
  colorTagHiddenDecorations: DecorationSet
}

// The note's frontmatter as property chips, as on the locked MD View page. A click on them puts the
// cursor in the frontmatter, which then shows as its raw text to be edited.
class PapelizMdViewFrontmatterPropertiesWidget extends WidgetType {
  private frontmatterPropertiesRoot: ReactRoot | null = null

  constructor(
    private readonly frontmatterText: string,
    private readonly noteFrontmatterProperties: readonly PapelizNoteFrontmatterProperty[],
  ) {
    super()
  }

  override eq(otherWidget: PapelizMdViewFrontmatterPropertiesWidget): boolean {
    return otherWidget.frontmatterText === this.frontmatterText
  }

  toDOM(): HTMLElement {
    const frontmatterPropertiesElement = document.createElement('div')
    frontmatterPropertiesElement.className = 'cm-papeliz-md-view-frontmatter-properties'
    frontmatterPropertiesElement.title = 'Click to edit the properties'
    this.frontmatterPropertiesRoot = createRoot(frontmatterPropertiesElement)
    this.frontmatterPropertiesRoot.render(createElement(PapelizNoteFrontmatterPropertyChips, { noteFrontmatterProperties: this.noteFrontmatterProperties }))
    return frontmatterPropertiesElement
  }

  override destroy(): void {
    // Unmounted after CodeMirror's update, never during a React render.
    const finishedFrontmatterPropertiesRoot = this.frontmatterPropertiesRoot
    this.frontmatterPropertiesRoot = null
    queueMicrotask(() => finishedFrontmatterPropertiesRoot?.unmount())
  }

  // Clicks reach the editor, which puts the cursor in the frontmatter.
  override ignoreEvent(): boolean {
    return false
  }
}

// Puts the cursor on a line of a drawn block, so the block shows its Markdown to be edited there.
function placeCursorInRenderedBlock(editorView: EditorView, renderedBlockElement: HTMLElement, blockLineIndex: number, cursorOffsetInLine: (blockLineText: string) => number): void {
  const noteDocument = editorView.state.doc
  const firstBlockLine = noteDocument.lineAt(editorView.posAtDOM(renderedBlockElement))
  const cursorLine = noteDocument.line(Math.min(firstBlockLine.number + blockLineIndex, noteDocument.lines))
  editorView.dispatch({ selection: { anchor: cursorLine.from + Math.min(cursorOffsetInLine(cursorLine.text), cursorLine.length) }, userEvent: 'select.pointer' })
  editorView.focus()
}

function appendPapelizMdViewInlineContents(
  parentElement: HTMLElement,
  inlineContents: readonly PapelizMdViewInlineContent[],
  resolvedWikilinkTargetNoteNames: ReadonlySet<string>,
  wikilinkHandlers: { current: PapelizMdViewWikilinkHandlers },
): void {
  for (const inlineContent of inlineContents) {
    switch (inlineContent.inlineContentKind) {
      case 'text': {
        parentElement.append(inlineContent.inlineText)
        break
      }
      case 'inline-code': {
        const inlineCodeElement = document.createElement('code')
        inlineCodeElement.className = 'cm-papeliz-md-view-inline-code'
        inlineCodeElement.textContent = inlineContent.inlineText
        parentElement.append(inlineCodeElement)
        break
      }
      case 'strong':
      case 'emphasis':
      case 'strikethrough': {
        const emphasisElement = document.createElement(inlineContent.inlineContentKind === 'strong' ? 'strong' : inlineContent.inlineContentKind === 'emphasis' ? 'em' : 's')
        appendPapelizMdViewInlineContents(emphasisElement, inlineContent.inlineChildren, resolvedWikilinkTargetNoteNames, wikilinkHandlers)
        parentElement.append(emphasisElement)
        break
      }
      case 'link': {
        // Drawn like links in the rest of MD View: Ctrl+click opens a web link.
        const linkElement = document.createElement('span')
        linkElement.className = 'cm-papeliz-md-view-link'
        if (/^(https?:|mailto:)/i.test(inlineContent.linkHref)) {
          linkElement.dataset['papelizLinkHref'] = inlineContent.linkHref
          linkElement.title = `${inlineContent.linkHref} (Ctrl+click to open)`
        }
        appendPapelizMdViewInlineContents(linkElement, inlineContent.inlineChildren, resolvedWikilinkTargetNoteNames, wikilinkHandlers)
        parentElement.append(linkElement)
        break
      }
      case 'wikilink': {
        parentElement.append(
          createPapelizMdViewWikilinkAnchor(
            inlineContent.wikilinkTargetNoteName,
            inlineContent.wikilinkDisplayText,
            resolvedWikilinkTargetNoteNames.has(inlineContent.wikilinkTargetNoteName),
            wikilinkHandlers,
          ),
        )
        break
      }
    }
  }
}

// A GitHub-flavored table drawn as a real table. A click in it puts the cursor in the clicked cell's
// Markdown; a wikilink in a cell opens its note, and Ctrl+click opens a web link.
class PapelizMdViewTableWidget extends WidgetType {
  constructor(
    readonly tableMarkdownText: string,
    readonly tableModel: PapelizMdViewTableModel,
    readonly resolvedWikilinkTargetNoteNames: ReadonlySet<string>,
    readonly wikilinkHandlers: { current: PapelizMdViewWikilinkHandlers },
  ) {
    super()
  }

  override eq(otherWidget: PapelizMdViewTableWidget): boolean {
    return (
      otherWidget.tableMarkdownText === this.tableMarkdownText &&
      otherWidget.resolvedWikilinkTargetNoteNames.size === this.resolvedWikilinkTargetNoteNames.size &&
      [...otherWidget.resolvedWikilinkTargetNoteNames].every((wikilinkTargetNoteName) => this.resolvedWikilinkTargetNoteNames.has(wikilinkTargetNoteName))
    )
  }

  toDOM(editorView: EditorView): HTMLElement {
    const tableBlockElement = document.createElement('div')
    tableBlockElement.className = 'cm-papeliz-md-view-table-block'
    const tableElement = document.createElement('table')
    tableElement.className = 'cm-papeliz-md-view-table'
    const appendTableRow = (rowGroupElement: HTMLElement, tableRowCells: PapelizMdViewInlineContent[][], tableCellTagName: 'th' | 'td', tableLineIndex: number) => {
      const tableRowElement = document.createElement('tr')
      tableRowElement.dataset['papelizTableLineIndex'] = String(tableLineIndex)
      tableRowCells.forEach((tableCellContents, tableColumnIndex) => {
        const tableCellElement = document.createElement(tableCellTagName)
        tableCellElement.dataset['papelizTableColumnIndex'] = String(tableColumnIndex)
        const tableColumnAlignment = this.tableModel.tableColumnAlignments[tableColumnIndex]
        if (tableColumnAlignment !== null && tableColumnAlignment !== undefined) tableCellElement.dataset['papelizTableColumnAlignment'] = tableColumnAlignment
        appendPapelizMdViewInlineContents(tableCellElement, tableCellContents, this.resolvedWikilinkTargetNoteNames, this.wikilinkHandlers)
        tableRowElement.append(tableCellElement)
      })
      rowGroupElement.append(tableRowElement)
    }
    const tableHeadElement = document.createElement('thead')
    appendTableRow(tableHeadElement, this.tableModel.tableHeaderCells, 'th', 0)
    tableElement.append(tableHeadElement)
    if (this.tableModel.tableBodyRows.length > 0) {
      const tableBodyElement = document.createElement('tbody')
      // Line 1 of the table is its `| --- |` row, so body rows start at line 2.
      this.tableModel.tableBodyRows.forEach((tableBodyRowCells, tableBodyRowIndex) => appendTableRow(tableBodyElement, tableBodyRowCells, 'td', tableBodyRowIndex + 2))
      tableElement.append(tableBodyElement)
    }
    tableBlockElement.append(tableElement)

    tableBlockElement.addEventListener('mousedown', (mouseDownEvent) => {
      if (mouseDownEvent.button !== 0 || !(mouseDownEvent.target instanceof Element)) return
      const pressedElement = mouseDownEvent.target
      // Links act on the click that follows.
      if (pressedElement.closest('.cm-papeliz-md-view-wikilink') !== null) {
        mouseDownEvent.preventDefault()
        return
      }
      if ((mouseDownEvent.ctrlKey || mouseDownEvent.metaKey) && pressedElement.closest('[data-papeliz-link-href]') !== null) {
        mouseDownEvent.preventDefault()
        return
      }
      // The scroll bar under a wide table scrolls it.
      if (pressedElement === tableBlockElement && mouseDownEvent.offsetY >= tableBlockElement.clientHeight) return
      mouseDownEvent.preventDefault()
      const pressedRowElement = pressedElement.closest<HTMLElement>('tr')
      const pressedCellElement = pressedElement.closest<HTMLElement>('th, td')
      const tableLineIndex = Number(pressedRowElement?.dataset['papelizTableLineIndex'] ?? 0)
      const tableColumnIndex = pressedCellElement === null ? null : Number(pressedCellElement.dataset['papelizTableColumnIndex'])
      placeCursorInRenderedBlock(editorView, tableBlockElement, tableLineIndex, (tableLineText) =>
        tableColumnIndex === null ? tableLineText.length : (splitPapelizMarkdownTableRow(tableLineText)[tableColumnIndex]?.tableCellSourceTo ?? tableLineText.length),
      )
    })
    tableBlockElement.addEventListener('click', (clickEvent) => openPapelizMdViewWebLinkOnModifiedClick(clickEvent))
    return tableBlockElement
  }

  // The table handles its own clicks (above).
  override ignoreEvent(): boolean {
    return true
  }
}

// A ```mermaid block drawn as its diagram. A click shows its source, with the cursor on its first line.
class PapelizMdViewMermaidDiagramWidget extends WidgetType {
  constructor(readonly mermaidDiagramSource: string) {
    super()
  }

  override eq(otherWidget: PapelizMdViewMermaidDiagramWidget): boolean {
    return otherWidget.mermaidDiagramSource === this.mermaidDiagramSource
  }

  toDOM(editorView: EditorView): HTMLElement {
    const mermaidDiagramElement = document.createElement('div')
    mermaidDiagramElement.className = 'cm-papeliz-md-view-mermaid-block papeliz-mermaid-diagram'
    mermaidDiagramElement.title = 'Click to edit the diagram'
    mermaidDiagramElement.addEventListener('mousedown', (mouseDownEvent) => {
      if (mouseDownEvent.button !== 0) return
      mouseDownEvent.preventDefault()
      placeCursorInRenderedBlock(editorView, mermaidDiagramElement, 1, (diagramLineText) => diagramLineText.length)
    })
    // A drawn diagram is taller than its placeholder: the editor measures it again.
    mountPapelizMermaidDiagram(mermaidDiagramElement, this.mermaidDiagramSource, () => editorView.requestMeasure())
    return mermaidDiagramElement
  }

  override destroy(mermaidDiagramElement: HTMLElement): void {
    unmountPapelizMermaidDiagram(mermaidDiagramElement)
  }

  override ignoreEvent(): boolean {
    return true
  }
}

// Whether the editor has focus, kept in the state so the block widgets (the frontmatter's chips,
// tables and diagrams: block decorations, which only a state field may provide) can show the raw
// text while the cursor is in them.
const setPapelizMdViewEditorFocused = StateEffect.define<boolean>()

interface PapelizMdViewBlockWidgetsState {
  isMdViewEditorFocused: boolean
  blockWidgetDecorations: DecorationSet
}

function buildFrontmatterPropertiesDecoration(
  editorState: EditorState,
  isCursorInBlock: (blockLineFrom: number, blockLineTo: number) => boolean,
): Range<Decoration> | null {
  let frontmatterRange: { frontmatterFrom: number; frontmatterTo: number } | null = null
  syntaxTree(editorState).iterate({
    from: 0,
    to: 1,
    enter: (syntaxNode) => {
      if (syntaxNode.name !== 'PapelizFrontmatter') return
      frontmatterRange = { frontmatterFrom: syntaxNode.from, frontmatterTo: syntaxNode.to }
      return false
    },
  })
  if (frontmatterRange === null) return null
  const { frontmatterFrom, frontmatterTo } = frontmatterRange
  const noteDocument = editorState.doc
  const firstFrontmatterLine = noteDocument.lineAt(frontmatterFrom)
  const lastFrontmatterLine = noteDocument.lineAt(frontmatterTo)
  if (isCursorInBlock(firstFrontmatterLine.from, lastFrontmatterLine.to) || lastFrontmatterLine.number <= firstFrontmatterLine.number + 1) return null
  const frontmatterText = noteDocument.sliceString(noteDocument.line(firstFrontmatterLine.number + 1).from, noteDocument.line(lastFrontmatterLine.number - 1).to)
  const noteFrontmatterProperties = readPapelizNoteFrontmatterProperties(frontmatterText)
  if (noteFrontmatterProperties.length === 0) return null
  return Decoration.replace({ widget: new PapelizMdViewFrontmatterPropertiesWidget(frontmatterText, noteFrontmatterProperties), block: true }).range(
    firstFrontmatterLine.from,
    lastFrontmatterLine.to,
  )
}

function buildPapelizMdViewBlockWidgetDecorations(
  editorState: EditorState,
  isMdViewEditorFocused: boolean,
  wikilinkHandlers: { current: PapelizMdViewWikilinkHandlers },
): DecorationSet {
  const noteDocument = editorState.doc
  const blockWidgetRanges: Range<Decoration>[] = []
  // The cursor in a block shows its raw Markdown, to be edited.
  const isCursorInBlock = (blockLineFrom: number, blockLineTo: number) =>
    isMdViewEditorFocused && editorState.selection.ranges.some((selectionRange) => selectionRange.from <= blockLineTo && selectionRange.to >= blockLineFrom)

  const frontmatterPropertiesDecoration = buildFrontmatterPropertiesDecoration(editorState, isCursorInBlock)
  if (frontmatterPropertiesDecoration !== null) blockWidgetRanges.push(frontmatterPropertiesDecoration)

  for (const renderedBlock of findPapelizMdViewRenderedBlocks(syntaxTree(editorState), (textFrom, textTo) => editorState.sliceDoc(textFrom, textTo))) {
    const blockLineFrom = noteDocument.lineAt(renderedBlock.renderedBlockFrom).from
    const blockLineTo = noteDocument.lineAt(renderedBlock.renderedBlockTo).to
    if (isCursorInBlock(blockLineFrom, blockLineTo)) continue
    if (renderedBlock.renderedBlockKind === 'mermaid-diagram') {
      blockWidgetRanges.push(
        Decoration.replace({ widget: new PapelizMdViewMermaidDiagramWidget(renderedBlock.mermaidDiagramSource), block: true }).range(blockLineFrom, blockLineTo),
      )
      continue
    }
    const tableMarkdownText = noteDocument.sliceString(blockLineFrom, blockLineTo)
    const tableModel = readPapelizMdViewTableModel(tableMarkdownText)
    if (tableModel === null) continue
    const resolvedWikilinkTargetNoteNames = new Set(
      collectPapelizMdViewTableWikilinkTargets(tableModel).filter((wikilinkTargetNoteName) =>
        wikilinkHandlers.current.isWikilinkTargetResolved(wikilinkTargetNoteName),
      ),
    )
    blockWidgetRanges.push(
      Decoration.replace({
        widget: new PapelizMdViewTableWidget(tableMarkdownText, tableModel, resolvedWikilinkTargetNoteNames, wikilinkHandlers),
        block: true,
      }).range(blockLineFrom, blockLineTo),
    )
  }
  return Decoration.set(blockWidgetRanges, true)
}

// Up and Down step into a drawn block (properties, a table, a diagram) instead of over it, so it
// shows its Markdown with the cursor on its first line (Down) or its last line (Up).
function moveCursorIntoRenderedBlock(editorView: EditorView, blockWidgetsField: StateField<PapelizMdViewBlockWidgetsState>, isMovingDown: boolean): boolean {
  const editorState = editorView.state
  const mainSelection = editorState.selection.main
  if (editorState.selection.ranges.length > 1 || !mainSelection.empty) return false
  const cursorLine = editorState.doc.lineAt(mainSelection.head)
  const defaultCursorTarget = editorView.moveVertically(mainSelection, isMovingDown).head
  if (isMovingDown ? defaultCursorTarget <= cursorLine.to : defaultCursorTarget >= cursorLine.from) return false
  let enteredBlockCursorPosition: number | null = null
  editorState.field(blockWidgetsField).blockWidgetDecorations.between(
    isMovingDown ? cursorLine.to + 1 : defaultCursorTarget,
    isMovingDown ? defaultCursorTarget : cursorLine.from - 1,
    (blockFrom, blockTo) => {
      // The nearest block: the first one below, or the last one above.
      if (isMovingDown && blockFrom > cursorLine.to) enteredBlockCursorPosition ??= blockFrom
      if (!isMovingDown && blockTo < cursorLine.from) enteredBlockCursorPosition = editorState.doc.lineAt(blockTo).from
    },
  )
  if (enteredBlockCursorPosition === null) return false
  editorView.dispatch({ selection: { anchor: enteredBlockCursorPosition }, scrollIntoView: true, userEvent: 'select' })
  return true
}

function createPapelizMdViewBlockWidgetsField(wikilinkHandlers: { current: PapelizMdViewWikilinkHandlers }) {
  return StateField.define<PapelizMdViewBlockWidgetsState>({
    create: (editorState) => ({
      isMdViewEditorFocused: false,
      blockWidgetDecorations: buildPapelizMdViewBlockWidgetDecorations(editorState, false, wikilinkHandlers),
    }),
    update: (blockWidgetsState, transaction) => {
      let isMdViewEditorFocused = blockWidgetsState.isMdViewEditorFocused
      for (const transactionEffect of transaction.effects) {
        if (transactionEffect.is(setPapelizMdViewEditorFocused)) isMdViewEditorFocused = transactionEffect.value
      }
      if (
        !transaction.docChanged &&
        !transaction.selection &&
        isMdViewEditorFocused === blockWidgetsState.isMdViewEditorFocused &&
        syntaxTree(transaction.startState) === syntaxTree(transaction.state)
      ) {
        return blockWidgetsState
      }
      return {
        isMdViewEditorFocused,
        blockWidgetDecorations: buildPapelizMdViewBlockWidgetDecorations(transaction.state, isMdViewEditorFocused, wikilinkHandlers),
      }
    },
    provide: (blockWidgetsField) => EditorView.decorations.from(blockWidgetsField, (blockWidgetsState) => blockWidgetsState.blockWidgetDecorations),
  })
}

function buildPapelizMdViewDecorations(editorView: EditorView, wikilinkHandlers: { current: PapelizMdViewWikilinkHandlers }): PapelizMdViewDecorationSets {
  const editorState: EditorState = editorView.state
  const noteDocument = editorState.doc
  const mdViewDecorationRanges: Range<Decoration>[] = []
  const colorTagHiddenRanges: Range<Decoration>[] = []
  const isEditorFocused = editorView.hasFocus
  const selectionRanges = editorState.selection.ranges

  // The cursor reveals the raw Markdown of the lines it is on, and of the inline element it touches.
  const focusedLineNumbers = new Set<number>()
  if (isEditorFocused) {
    for (const selectionRange of selectionRanges) {
      const firstSelectedLineNumber = noteDocument.lineAt(selectionRange.from).number
      const lastSelectedLineNumber = noteDocument.lineAt(selectionRange.to).number
      for (let selectedLineNumber = firstSelectedLineNumber; selectedLineNumber <= lastSelectedLineNumber; selectedLineNumber += 1) {
        focusedLineNumbers.add(selectedLineNumber)
      }
    }
  }
  const isLineFocused = (documentPosition: number) => focusedLineNumbers.has(noteDocument.lineAt(documentPosition).number)
  const touchesSelection = (rangeFrom: number, rangeTo: number) =>
    isEditorFocused && selectionRanges.some((selectionRange) => selectionRange.from <= rangeTo && selectionRange.to >= rangeFrom)
  const isOnOneLine = (rangeFrom: number, rangeTo: number) => noteDocument.lineAt(rangeFrom).number === noteDocument.lineAt(rangeTo).number

  const hideMarkdown = (hiddenFrom: number, hiddenTo: number) => {
    if (hiddenTo > hiddenFrom && isOnOneLine(hiddenFrom, hiddenTo)) mdViewDecorationRanges.push(Decoration.replace({}).range(hiddenFrom, hiddenTo))
  }
  const replaceWithWidget = (replacedFrom: number, replacedTo: number, replacingWidget: WidgetType) => {
    if (replacedTo > replacedFrom && isOnOneLine(replacedFrom, replacedTo)) {
      mdViewDecorationRanges.push(Decoration.replace({ widget: replacingWidget }).range(replacedFrom, replacedTo))
    }
  }
  const markText = (markedFrom: number, markedTo: number, markClassName: string, markAttributes?: Record<string, string>) => {
    if (markedTo > markedFrom) mdViewDecorationRanges.push(Decoration.mark({ class: markClassName, attributes: markAttributes }).range(markedFrom, markedTo))
  }
  const decorateLines = (blockFrom: number, blockTo: number, lineClassName: string, lineAttributes?: Record<string, string>) => {
    const firstLineNumber = noteDocument.lineAt(blockFrom).number
    const lastLineNumber = noteDocument.lineAt(blockTo).number
    for (let blockLineNumber = firstLineNumber; blockLineNumber <= lastLineNumber; blockLineNumber += 1) {
      const blockLineClassNames = [lineClassName]
      if (blockLineNumber === firstLineNumber) blockLineClassNames.push(`${lineClassName}-first`)
      if (blockLineNumber === lastLineNumber) blockLineClassNames.push(`${lineClassName}-last`)
      mdViewDecorationRanges.push(
        Decoration.line({ class: blockLineClassNames.join(' '), attributes: lineAttributes }).range(noteDocument.line(blockLineNumber).from),
      )
    }
  }
  const followingSpaceLength = (afterPosition: number) => (editorState.sliceDoc(afterPosition, afterPosition + 1) === ' ' ? 1 : 0)

  const tagSkippedRanges: Array<{ skippedFrom: number; skippedTo: number }> = []
  const visibleFrom = editorView.visibleRanges[0]?.from ?? 0
  const visibleTo = editorView.visibleRanges[editorView.visibleRanges.length - 1]?.to ?? noteDocument.length

  syntaxTree(editorState).iterate({
    from: visibleFrom,
    to: visibleTo,
    enter: (syntaxNodeRef) => {
      const { name: syntaxNodeName, from: nodeFrom, to: nodeTo } = syntaxNodeRef
      const syntaxNode: PapelizMdViewSyntaxNode = syntaxNodeRef.node
      if (papelizMdViewSkippedForTagNodeNames.has(syntaxNodeName)) tagSkippedRanges.push({ skippedFrom: nodeFrom, skippedTo: nodeTo })

      const atxHeadingMatch = /^ATXHeading([1-6])$/.exec(syntaxNodeName)
      if (atxHeadingMatch) {
        decorateLines(nodeFrom, nodeFrom, `cm-papeliz-md-view-heading cm-papeliz-md-view-heading-${atxHeadingMatch[1]}`)
        return
      }

      switch (syntaxNodeName) {
        case 'HeaderMark': {
          if (!syntaxNode.parent?.name.startsWith('ATXHeading') || isLineFocused(nodeFrom)) return
          const headingLine = noteDocument.lineAt(nodeFrom)
          if (nodeFrom === headingLine.from) hideMarkdown(nodeFrom, nodeTo + followingSpaceLength(nodeTo))
          else hideMarkdown(editorState.sliceDoc(nodeFrom - 1, nodeFrom) === ' ' ? nodeFrom - 1 : nodeFrom, nodeTo)
          return
        }
        case 'Emphasis':
        case 'StrongEmphasis':
        case 'Strikethrough':
        case 'InlineCode': {
          if (syntaxNodeName === 'InlineCode') markText(nodeFrom, nodeTo, 'cm-papeliz-md-view-inline-code')
          if (touchesSelection(nodeFrom, nodeTo)) return
          for (let childNode = syntaxNode.firstChild; childNode !== null; childNode = childNode.nextSibling) {
            if (childNode.name === 'EmphasisMark' || childNode.name === 'StrikethroughMark' || childNode.name === 'CodeMark') {
              hideMarkdown(childNode.from, childNode.to)
            }
          }
          return
        }
        case 'Link': {
          const linkUrlNode = syntaxNode.getChild('URL')
          const linkMarkNodes = syntaxNode.getChildren('LinkMark')
          const openingLinkMark = linkMarkNodes[0]
          const closingTextLinkMark = linkMarkNodes[1]
          if (linkUrlNode === null || openingLinkMark === undefined || closingTextLinkMark === undefined) return
          const linkHref = editorState.sliceDoc(linkUrlNode.from, linkUrlNode.to)
          markText(
            openingLinkMark.to,
            closingTextLinkMark.from,
            'cm-papeliz-md-view-link',
            /^(https?:|mailto:)/i.test(linkHref) ? { 'data-papeliz-link-href': linkHref, title: `${linkHref} (Ctrl+click to open)` } : undefined,
          )
          if (touchesSelection(nodeFrom, nodeTo)) return
          hideMarkdown(openingLinkMark.from, openingLinkMark.to)
          hideMarkdown(closingTextLinkMark.from, nodeTo)
          return false
        }
        case 'PapelizWikilink': {
          if (touchesSelection(nodeFrom, nodeTo)) return false
          const wikilinkParts = parsePapelizWikilinkInnerText(editorState.sliceDoc(nodeFrom + 2, nodeTo - 2))
          replaceWithWidget(
            nodeFrom,
            nodeTo,
            new PapelizMdViewWikilinkWidget(
              wikilinkParts.wikilinkTargetNoteName,
              getPapelizWikilinkDisplayText(wikilinkParts),
              wikilinkHandlers.current.isWikilinkTargetResolved(wikilinkParts.wikilinkTargetNoteName),
              wikilinkHandlers,
            ),
          )
          return false
        }
        case 'TaskMarker': {
          const isTaskChecked = /x/i.test(editorState.sliceDoc(nodeFrom, nodeTo))
          if (isTaskChecked) markText(nodeTo, noteDocument.lineAt(nodeFrom).to, 'cm-papeliz-md-view-task-done')
          if (!touchesSelection(nodeFrom, nodeTo)) replaceWithWidget(nodeFrom, nodeTo, new PapelizMdViewTaskCheckboxWidget(isTaskChecked))
          return
        }
        case 'ListMark': {
          // Wrapped lines of a list item line up under its text, not under the bullet.
          // The widths are those of the drawn bullet or checkbox (in em), plus any leading spaces.
          const listItemLine = noteDocument.lineAt(nodeFrom)
          const listMarkWidthInEm = syntaxNode.nextSibling?.name === 'Task' ? 1.55 : syntaxNode.parent?.parent?.name === 'BulletList' ? 1 : 1.4
          const listItemIndentInEm = (nodeFrom - listItemLine.from) * 0.28 + listMarkWidthInEm
          mdViewDecorationRanges.push(
            Decoration.line({
              class: 'cm-papeliz-md-view-list-line',
              attributes: { style: `--papeliz-list-hanging-indent: ${listItemIndentInEm.toFixed(2)}em` },
            }).range(listItemLine.from),
          )
          if (isLineFocused(nodeFrom) || syntaxNode.parent?.parent?.name !== 'BulletList') return
          if (syntaxNode.nextSibling?.name === 'Task') hideMarkdown(nodeFrom, nodeTo + followingSpaceLength(nodeTo))
          else replaceWithWidget(nodeFrom, nodeTo, new PapelizMdViewTextWidget('•', 'cm-papeliz-md-view-bullet'))
          return
        }
        case 'Blockquote': {
          if (syntaxNode.parent?.name === 'Blockquote') return
          const quoteFirstLine = noteDocument.lineAt(nodeFrom)
          const calloutFirstLineMatch = papelizCalloutFirstLinePattern.exec(quoteFirstLine.text)
          if (calloutFirstLineMatch === null) {
            decorateLines(nodeFrom, nodeTo, 'cm-papeliz-md-view-quote-line')
            return
          }
          const papelizCalloutKind = (calloutFirstLineMatch[2] ?? 'note').toLowerCase()
          const papelizCalloutColor = calloutFirstLineMatch[3]?.toLowerCase()
          // A hex color is any color the picker chose; the card's shades are mixed from it.
          const papelizCalloutHexColor = papelizCalloutColor === undefined ? null : parsePapelizHexColor(papelizCalloutColor)
          decorateLines(nodeFrom, nodeTo, 'cm-papeliz-md-view-callout-line', {
            'data-papeliz-callout-kind': papelizCalloutKind,
            ...(papelizCalloutColor === undefined ? {} : { 'data-papeliz-callout-color': papelizCalloutHexColor ?? papelizCalloutColor }),
            ...(papelizCalloutHexColor === null || !papelizCalloutColor?.startsWith('#') ? {} : { style: `--papeliz-callout-custom-color: ${papelizCalloutHexColor}` }),
          })
          if (isLineFocused(nodeFrom)) return
          const calloutKindStart = quoteFirstLine.from + (calloutFirstLineMatch[1] ?? '').length
          const calloutTitleText = calloutFirstLineMatch[4] ?? ''
          const calloutTitleStart = quoteFirstLine.to - calloutTitleText.length
          if (calloutTitleText.trim().length > 0) {
            hideMarkdown(calloutKindStart, calloutTitleStart)
            markText(calloutTitleStart, quoteFirstLine.to, 'cm-papeliz-md-view-callout-title')
          } else {
            const calloutDefaultTitle = papelizCalloutKind.charAt(0).toUpperCase() + papelizCalloutKind.slice(1).replace(/-/g, ' ')
            replaceWithWidget(calloutKindStart, quoteFirstLine.to, new PapelizMdViewTextWidget(calloutDefaultTitle, 'cm-papeliz-md-view-callout-title'))
          }
          return
        }
        case 'HTMLTag': {
          // `<span style="color: …; font-size: …">words</span>` draws the words in that color and
          // size, and `<u>words</u>` underlines them. MD View never shows the tags, even on the
          // cursor's line; MD Code shows the Markdown as it is.
          const htmlTagText = noteDocument.sliceString(nodeFrom, nodeTo)
          if (htmlTagText.toLowerCase() === papelizUnderlineOpenTag) {
            const underlineLine = noteDocument.lineAt(nodeFrom)
            const underlineCloseTagIndex = underlineLine.text.toLowerCase().indexOf(papelizUnderlineCloseTag, nodeTo - underlineLine.from)
            if (underlineCloseTagIndex === -1) return
            const underlineCloseTagFrom = underlineLine.from + underlineCloseTagIndex
            markText(nodeTo, underlineCloseTagFrom, 'cm-papeliz-md-view-underlined-text')
            for (const [tagFrom, tagTo] of [
              [nodeFrom, nodeTo],
              [underlineCloseTagFrom, underlineCloseTagFrom + papelizUnderlineCloseTag.length],
            ] as const) {
              const hiddenTagDecoration = Decoration.replace({}).range(tagFrom, tagTo)
              mdViewDecorationRanges.push(hiddenTagDecoration)
              colorTagHiddenRanges.push(hiddenTagDecoration)
            }
            return
          }
          const textStyle = matchPapelizTextStyleOpenTag(htmlTagText)
          if (textStyle === null) return
          const tagLine = noteDocument.lineAt(nodeFrom)
          const closeTagIndex = tagLine.text.indexOf('</span>', nodeTo - tagLine.from)
          if (closeTagIndex === -1) return
          const closeTagFrom = tagLine.from + closeTagIndex
          markText(nodeTo, closeTagFrom, 'cm-papeliz-md-view-styled-text', { style: describePapelizTextStyleCss(textStyle) })
          for (const [tagFrom, tagTo] of [
            [nodeFrom, nodeTo],
            [closeTagFrom, closeTagFrom + '</span>'.length],
          ] as const) {
            const hiddenTagDecoration = Decoration.replace({}).range(tagFrom, tagTo)
            mdViewDecorationRanges.push(hiddenTagDecoration)
            colorTagHiddenRanges.push(hiddenTagDecoration)
          }
          return
        }
        case 'QuoteMark': {
          if (!isLineFocused(nodeFrom)) hideMarkdown(nodeFrom, nodeTo + followingSpaceLength(nodeTo))
          return
        }
        case 'HorizontalRule': {
          if (isLineFocused(nodeFrom)) return
          decorateLines(nodeFrom, nodeFrom, 'cm-papeliz-md-view-rule-line')
          hideMarkdown(nodeFrom, nodeTo)
          return
        }
        case 'FencedCode':
        case 'CodeBlock': {
          decorateLines(nodeFrom, nodeTo, 'cm-papeliz-md-view-code-line')
          return false
        }
        case 'PapelizFrontmatter': {
          decorateLines(nodeFrom, nodeTo, 'cm-papeliz-md-view-frontmatter-line')
          return false
        }
        case 'Table': {
          decorateLines(nodeFrom, nodeTo, 'cm-papeliz-md-view-table-line')
          return
        }
        default:
          return
      }
    },
  })

  // `#tags` in running text become chips; inside code, links and frontmatter they stay text.
  for (let visibleLineNumber = noteDocument.lineAt(visibleFrom).number; visibleLineNumber <= noteDocument.lineAt(visibleTo).number; visibleLineNumber += 1) {
    const visibleLine = noteDocument.line(visibleLineNumber)
    for (const tagMatch of visibleLine.text.matchAll(papelizMdViewTagPattern)) {
      const tagFrom = visibleLine.from + (tagMatch.index ?? 0) + (tagMatch[1] ?? '').length
      const tagTo = tagFrom + 1 + (tagMatch[2] ?? '').replace(/\/+$/, '').length
      const isInsideSkippedNode = tagSkippedRanges.some(({ skippedFrom, skippedTo }) => tagFrom >= skippedFrom && tagFrom < skippedTo)
      if (!isInsideSkippedNode) markText(tagFrom, tagTo, 'cm-papeliz-md-view-tag')
    }
  }

  return { mdViewDecorations: Decoration.set(mdViewDecorationRanges, true), colorTagHiddenDecorations: Decoration.set(colorTagHiddenRanges, true) }
}

function findWikilinkTargetAtCursor(editorState: EditorState): string | null {
  const cursorPosition = editorState.selection.main.head
  for (const cursorSide of [-1, 1] as const) {
    for (let syntaxNode: PapelizMdViewSyntaxNode | null = syntaxTree(editorState).resolveInner(cursorPosition, cursorSide); syntaxNode !== null; syntaxNode = syntaxNode.parent) {
      if (syntaxNode.name === 'PapelizWikilink') {
        return parsePapelizWikilinkInnerText(editorState.sliceDoc(syntaxNode.from + 2, syntaxNode.to - 2)).wikilinkTargetNoteName
      }
    }
  }
  return null
}

export function createPapelizMdViewPresentation(wikilinkHandlers: { current: PapelizMdViewWikilinkHandlers }): Extension {
  const papelizMdViewDecorationsPlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      colorTagHiddenDecorations: DecorationSet

      constructor(editorView: EditorView) {
        const mdViewDecorationSets = buildPapelizMdViewDecorations(editorView, wikilinkHandlers)
        this.decorations = mdViewDecorationSets.mdViewDecorations
        this.colorTagHiddenDecorations = mdViewDecorationSets.colorTagHiddenDecorations
      }

      update(viewUpdate: ViewUpdate) {
        if (
          viewUpdate.docChanged ||
          viewUpdate.viewportChanged ||
          viewUpdate.selectionSet ||
          viewUpdate.focusChanged ||
          syntaxTree(viewUpdate.startState) !== syntaxTree(viewUpdate.state)
        ) {
          const mdViewDecorationSets = buildPapelizMdViewDecorations(viewUpdate.view, wikilinkHandlers)
          this.decorations = mdViewDecorationSets.mdViewDecorations
          this.colorTagHiddenDecorations = mdViewDecorationSets.colorTagHiddenDecorations
        }
      }
    },
    { decorations: (decorationsPlugin) => decorationsPlugin.decorations },
  )
  const papelizMdViewBlockWidgetsField = createPapelizMdViewBlockWidgetsField(wikilinkHandlers)

  return [
    syntaxHighlighting(papelizMdViewHighlightStyle),
    papelizMdViewTheme,
    EditorView.editorAttributes.of({ class: 'papeliz-md-view' }),
    papelizMdViewDecorationsPlugin,
    papelizMdViewBlockWidgetsField,
    EditorView.focusChangeEffect.of((_editorState, isFocusing) => setPapelizMdViewEditorFocused.of(isFocusing)),
    EditorView.atomicRanges.of((editorView) => editorView.plugin(papelizMdViewDecorationsPlugin)?.colorTagHiddenDecorations ?? Decoration.none),
    // Ctrl+Enter opens the `[[wikilink]]` under the cursor; Up and Down step into drawn blocks.
    Prec.high(
      keymap.of([
        {
          // Ctrl+Enter by default; checked against the current Key Binding as the key is pressed.
          any: (editorView, keyboardEvent) => {
            if (!isPapelizKeyBindingPressed(keyboardEvent, 'md-view-wikilink-open')) return false
            const wikilinkTargetNoteName = findWikilinkTargetAtCursor(editorView.state)
            if (wikilinkTargetNoteName === null) return false
            wikilinkHandlers.current.activateWikilinkTarget(wikilinkTargetNoteName)
            return true
          },
        },
        { key: 'ArrowDown', run: (editorView) => moveCursorIntoRenderedBlock(editorView, papelizMdViewBlockWidgetsField, true) },
        { key: 'ArrowUp', run: (editorView) => moveCursorIntoRenderedBlock(editorView, papelizMdViewBlockWidgetsField, false) },
      ]),
    ),
    EditorView.domEventHandlers({ click: openPapelizMdViewWebLinkOnModifiedClick }),
  ]
}
