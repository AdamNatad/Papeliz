import { redo, redoDepth, selectAll, undo, undoDepth } from '@codemirror/commands'
import { ChangeSet } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import {
  CircleCheck,
  ClipboardPaste,
  Copy,
  Heading1,
  Heading2,
  Heading3,
  Link,
  List,
  ListOrdered,
  ListTodo,
  MessageSquare,
  OctagonAlert,
  Quote,
  Redo2,
  Scissors,
  SeparatorHorizontal,
  Sparkles,
  StickyNote,
  TextQuote,
  TextSelect,
  TriangleAlert,
  Type,
  Undo2,
  Ban,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizColorPicker } from '../ui/papeliz-color-picker'
import { subscribeToPapelizWindowWidthChange } from '../ui/papeliz-window-width-change'
import { describePapelizKeyBindingShortcut, usePapelizKeyBindingsStore, type PapelizKeyBindingActionId } from '../workspace/papeliz-key-bindings-store'
import {
  changePapelizNoteCalloutCard,
  findPapelizNoteCalloutCard,
  insertPapelizNoteCallout,
  removePapelizNoteCalloutCard,
  papelizNoteCalloutColors,
  type PapelizNoteCalloutKind,
} from './papeliz-note-callout-cards'
import { findPapelizInlineMarkdownFormatWrap, type PapelizInlineMarkdownFormat } from './papeliz-note-inline-formatting'
import {
  findPapelizLineMarkdownFormatOfSelection,
  insertPapelizNoteDivider,
  togglePapelizLineMarkdownFormat,
  type PapelizLineMarkdownFormat,
} from './papeliz-note-line-formatting'
import { runPapelizInlineMarkdownFormat } from './papeliz-note-formatting-commands'
import {
  applyPapelizTextStyle,
  findPapelizTextStyleAround,
  papelizNoteTextSizes,
  type PapelizNoteTextStyle,
} from './papeliz-note-text-style'

interface PapelizNoteContextMenuProps {
  noteEditorView: EditorView
  menuAnchorLeft: number
  menuAnchorTop: number
  isEditWithAssistantAvailable: boolean
  onEditWithAssistant: () => void
  onAskAssistantInPanel: (selectedText: string) => void
  onNoteContextMenuProblem: (problemMessage: string) => void
  onNoteContextMenuClose: () => void
}

// Bold, Italic and Underline show their shortcut from Key Bindings after the name.
const papelizInlineFormatMenuButtons: ReadonlyArray<{
  inlineMarkdownFormat: PapelizInlineMarkdownFormat
  formatLabel: string
  formatKeyBindingActionId?: PapelizKeyBindingActionId
  formatGlyph: ReactNode
}> = [
  { inlineMarkdownFormat: 'bold', formatLabel: 'Bold', formatKeyBindingActionId: 'note-format-bold', formatGlyph: 'B' },
  { inlineMarkdownFormat: 'italic', formatLabel: 'Italic', formatKeyBindingActionId: 'note-format-italic', formatGlyph: 'I' },
  { inlineMarkdownFormat: 'underline', formatLabel: 'Underline', formatKeyBindingActionId: 'note-format-underline', formatGlyph: 'U' },
  { inlineMarkdownFormat: 'strikethrough', formatLabel: 'Strikethrough', formatGlyph: 'S' },
  { inlineMarkdownFormat: 'inline-code', formatLabel: 'Code', formatGlyph: '</>' },
  { inlineMarkdownFormat: 'wikilink', formatLabel: 'Link to a note', formatGlyph: '[[ ]]' },
  { inlineMarkdownFormat: 'link', formatLabel: 'Web link', formatGlyph: <Link className="size-[15px]" aria-hidden="true" /> },
]

const papelizLineFormatMenuButtons: ReadonlyArray<{ lineMarkdownFormat: PapelizLineMarkdownFormat; formatLabel: string; FormatIcon: LucideIcon }> = [
  { lineMarkdownFormat: 'heading-1', formatLabel: 'Heading 1', FormatIcon: Heading1 },
  { lineMarkdownFormat: 'heading-2', formatLabel: 'Heading 2', FormatIcon: Heading2 },
  { lineMarkdownFormat: 'heading-3', formatLabel: 'Heading 3', FormatIcon: Heading3 },
  { lineMarkdownFormat: 'bulleted-list', formatLabel: 'Bulleted list', FormatIcon: List },
  { lineMarkdownFormat: 'numbered-list', formatLabel: 'Numbered list', FormatIcon: ListOrdered },
  { lineMarkdownFormat: 'checklist', formatLabel: 'Checklist', FormatIcon: ListTodo },
  { lineMarkdownFormat: 'quote', formatLabel: 'Quote', FormatIcon: TextQuote },
]

// Each kind wears its card's own colors, as the note draws them.
const papelizCalloutMenuButtons: ReadonlyArray<{ calloutKind: PapelizNoteCalloutKind; calloutLabel: string; CalloutIcon: LucideIcon; calloutToneClassName: string }> = [
  { calloutKind: 'note', calloutLabel: 'Note card', CalloutIcon: StickyNote, calloutToneClassName: 'bg-papeliz-blue-soft text-papeliz-blue' },
  { calloutKind: 'success', calloutLabel: 'Success card', CalloutIcon: CircleCheck, calloutToneClassName: 'bg-papeliz-diff-added text-papeliz-diff-added-ink' },
  { calloutKind: 'warning', calloutLabel: 'Warning card', CalloutIcon: TriangleAlert, calloutToneClassName: 'bg-papeliz-warning text-papeliz-warning-ink' },
  { calloutKind: 'danger', calloutLabel: 'Danger card', CalloutIcon: OctagonAlert, calloutToneClassName: 'bg-papeliz-diff-removed text-papeliz-diff-removed-ink' },
  { calloutKind: 'quote', calloutLabel: 'Quote card', CalloutIcon: Quote, calloutToneClassName: 'bg-papeliz-surface-gray text-papeliz-ink-muted' },
]

const papelizNoteContextMenuViewportMargin = 8

// What the menu shows, read from the editor once when it opens.
function readNoteContextMenuEditorSnapshot(noteEditorView: EditorView) {
  const editorState = noteEditorView.state
  const mainSelection = editorState.selection.main
  const nearbyTextFrom = Math.max(0, mainSelection.from - 8)
  const nearbyText = editorState.sliceDoc(nearbyTextFrom, Math.min(editorState.doc.length, mainSelection.to + 512))
  const lineTextFrom = editorState.doc.lineAt(mainSelection.from).from
  const selectedLinesText = editorState.sliceDoc(lineTextFrom, editorState.doc.lineAt(mainSelection.to).to)
  return {
    selectedText: editorState.selection.ranges.map((selectionRange) => editorState.sliceDoc(selectionRange.from, selectionRange.to)).join('\n'),
    isNoteReadOnly: editorState.readOnly,
    appliedInlineFormats: new Set(
      papelizInlineFormatMenuButtons
        .filter(
          ({ inlineMarkdownFormat }) =>
            findPapelizInlineMarkdownFormatWrap(nearbyText, mainSelection.from - nearbyTextFrom, mainSelection.to - nearbyTextFrom, inlineMarkdownFormat) !== null,
        )
        .map(({ inlineMarkdownFormat }) => inlineMarkdownFormat),
    ),
    appliedLineFormat: findPapelizLineMarkdownFormatOfSelection(selectedLinesText, mainSelection.from - lineTextFrom, mainSelection.to - lineTextFrom),
    canUndo: undoDepth(editorState) > 0,
    canRedo: redoDepth(editorState) > 0,
    currentTextStyle: findPapelizTextStyleAround(editorState.doc.toString(), mainSelection.from, mainSelection.to),
    currentCalloutCard: findPapelizNoteCalloutCard(editorState.doc.toString(), mainSelection.head),
  }
}

function runLineMarkdownFormat(noteEditorView: EditorView, lineMarkdownFormat: PapelizLineMarkdownFormat): void {
  const editorState = noteEditorView.state
  const mainSelection = editorState.selection.main
  const lineFormatChanges = ChangeSet.of(
    togglePapelizLineMarkdownFormat(editorState.doc.toString(), mainSelection.from, mainSelection.to, lineMarkdownFormat).map((textChange) => ({
      from: textChange.changeFrom,
      to: textChange.changeTo,
      insert: textChange.insertedText,
    })),
    editorState.doc.length,
  )
  // A cursor at a line's start ends up after the new prefix, ready to type.
  noteEditorView.dispatch({ changes: lineFormatChanges, selection: editorState.selection.map(lineFormatChanges, 1), userEvent: 'input.format', scrollIntoView: true })
}

function runInsertDivider(noteEditorView: EditorView): void {
  const editorState = noteEditorView.state
  const { dividerTextChange, cursorPositionAfterDivider } = insertPapelizNoteDivider(editorState.doc.toString(), editorState.selection.main.to)
  noteEditorView.dispatch({
    changes: { from: dividerTextChange.changeFrom, to: dividerTextChange.changeTo, insert: dividerTextChange.insertedText },
    selection: { anchor: cursorPositionAfterDivider },
    userEvent: 'input.format',
    scrollIntoView: true,
  })
}

function runTextStyle(noteEditorView: EditorView, textStyleChange: Partial<PapelizNoteTextStyle>): void {
  const mainSelection = noteEditorView.state.selection.main
  const styleResult = applyPapelizTextStyle(noteEditorView.state.doc.toString(), mainSelection.from, mainSelection.to, textStyleChange)
  if (styleResult === null) return
  noteEditorView.dispatch({
    changes: styleResult.textChanges.map((textChange) => ({ from: textChange.changeFrom, to: textChange.changeTo, insert: textChange.insertedText })),
    selection: { anchor: styleResult.formattedSelectionFrom, head: styleResult.formattedSelectionTo },
    userEvent: 'input.format',
    scrollIntoView: true,
  })
}

// Inside a card, a card button changes that card's kind or color; elsewhere it puts a new card in.
function runCalloutCardChoice(noteEditorView: EditorView, calloutKind: PapelizNoteCalloutKind, calloutColor: string | null = null): void {
  const mainSelection = noteEditorView.state.selection.main
  const noteText = noteEditorView.state.doc.toString()
  const calloutResult =
    changePapelizNoteCalloutCard(noteText, mainSelection.head, calloutKind, calloutColor) ??
    insertPapelizNoteCallout(noteText, mainSelection.from, mainSelection.to, calloutKind, calloutColor)
  noteEditorView.dispatch({
    changes: calloutResult.textChanges.map((textChange) => ({ from: textChange.changeFrom, to: textChange.changeTo, insert: textChange.insertedText })),
    selection: { anchor: calloutResult.formattedSelectionFrom, head: calloutResult.formattedSelectionTo },
    userEvent: 'input.format',
    scrollIntoView: true,
  })
}

// Turns the card the cursor is in back into plain lines.
function runCalloutCardRemoval(noteEditorView: EditorView): void {
  const calloutResult = removePapelizNoteCalloutCard(noteEditorView.state.doc.toString(), noteEditorView.state.selection.main.head)
  if (calloutResult === null) return
  noteEditorView.dispatch({
    changes: calloutResult.textChanges.map((textChange) => ({ from: textChange.changeFrom, to: textChange.changeTo, insert: textChange.insertedText })),
    selection: { anchor: calloutResult.formattedSelectionFrom },
    userEvent: 'input.format',
    scrollIntoView: true,
  })
}

interface PapelizNoteContextMenuItemProps {
  menuItemLabel: string
  MenuItemIcon: LucideIcon
  menuItemShortcutLabel?: string
  isMenuItemDisabled?: boolean
  // The Assistant's two items stand out: Edit in Papeliz's blue, Ask on a soft blue.
  menuItemTone?: 'plain' | 'assistant-edit' | 'assistant-ask'
  onMenuItemSelect: () => void
}

const papelizNoteContextMenuItemToneClassNames = {
  plain: {
    menuItemClassName: 'text-papeliz-ink hover:bg-papeliz-hover focus-visible:bg-papeliz-hover',
    menuItemIconClassName: 'text-papeliz-ink-muted',
    menuItemShortcutClassName: 'text-papeliz-ink-subtle',
  },
  'assistant-edit': {
    menuItemClassName:
      'bg-linear-to-r from-papeliz-gradient-start to-papeliz-gradient-end font-semibold text-white shadow-[0_2px_8px_rgb(0_100_212/0.25)] hover:brightness-[1.06] focus-visible:brightness-[1.06]',
    menuItemIconClassName: 'text-white',
    menuItemShortcutClassName: 'rounded-full bg-white/20 px-1.5 py-0.5 text-white',
  },
  'assistant-ask': {
    menuItemClassName: 'bg-papeliz-blue-soft font-semibold text-papeliz-blue hover:bg-papeliz-blue-soft-hover focus-visible:bg-papeliz-blue-soft-hover',
    menuItemIconClassName: 'text-papeliz-blue',
    menuItemShortcutClassName: 'text-papeliz-blue',
  },
} as const

function PapelizNoteContextMenuItem({
  menuItemLabel,
  MenuItemIcon,
  menuItemShortcutLabel,
  isMenuItemDisabled = false,
  menuItemTone = 'plain',
  onMenuItemSelect,
}: PapelizNoteContextMenuItemProps) {
  const toneClassNames = papelizNoteContextMenuItemToneClassNames[menuItemTone]
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      disabled={isMenuItemDisabled}
      data-papeliz-note-context-menu-item=""
      onClick={onMenuItemSelect}
      className={joinPapelizClassNames(
        'flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13.5px] transition-[background-color,filter] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40',
        toneClassNames.menuItemClassName,
      )}
    >
      <MenuItemIcon className={joinPapelizClassNames('size-4 flex-none', toneClassNames.menuItemIconClassName)} aria-hidden="true" />
      <span className="flex-1">{menuItemLabel}</span>
      {menuItemShortcutLabel !== undefined && (
        <span className={joinPapelizClassNames('text-xs', toneClassNames.menuItemShortcutClassName)}>{menuItemShortcutLabel}</span>
      )}
    </button>
  )
}

function PapelizNoteContextMenuDivider() {
  return <div role="separator" className="mx-1 my-1 h-px bg-papeliz-line" />
}

// The note's context menu, its only formatting menu: inline formats, line formats (headings,
// lists, checklist, quote), callout cards, the Assistant, the clipboard, and Undo/Redo. Arrow keys move through every button; Esc
// or a click elsewhere closes it and puts the cursor back in the note.
export function PapelizNoteContextMenu({
  noteEditorView,
  menuAnchorLeft,
  menuAnchorTop,
  isEditWithAssistantAvailable,
  onEditWithAssistant,
  onAskAssistantInPanel,
  onNoteContextMenuProblem,
  onNoteContextMenuClose,
}: PapelizNoteContextMenuProps) {
  const noteContextMenuRef = useRef<HTMLDivElement>(null)
  const [noteContextMenuEditorSnapshot] = useState(() => readNoteContextMenuEditorSnapshot(noteEditorView))
  const [clampedMenuPosition, setClampedMenuPosition] = useState({ menuLeft: menuAnchorLeft, menuTop: menuAnchorTop })
  // The rainbow wheels open a color picker, for a custom card or for the selected text.
  const [colorPickerPurpose, setColorPickerPurpose] = useState<'custom-card' | 'text-color' | null>(null)
  const onNoteContextMenuCloseRef = useRef(onNoteContextMenuClose)
  const papelizKeyBindings = usePapelizKeyBindingsStore((keyBindingsState) => keyBindingsState.papelizKeyBindings)
  const { selectedText, isNoteReadOnly, appliedInlineFormats, appliedLineFormat, canUndo, canRedo, currentTextStyle, currentCalloutCard } =
    noteContextMenuEditorSnapshot
  const hasSelectedText = selectedText.trim().length > 0
  const isClipboardReadable = typeof navigator.clipboard?.readText === 'function'

  useEffect(() => {
    onNoteContextMenuCloseRef.current = onNoteContextMenuClose
  })

  useLayoutEffect(() => {
    const noteContextMenuElement = noteContextMenuRef.current
    if (noteContextMenuElement === null) return
    const noteContextMenuRect = noteContextMenuElement.getBoundingClientRect()
    // Opens below and right of the pointer. It flips left when it would leave the window's right
    // side, and near the bottom it slides up only as far as it must to fit, never scrolling.
    const menuLeft =
      menuAnchorLeft + noteContextMenuRect.width + papelizNoteContextMenuViewportMargin > window.innerWidth
        ? Math.max(papelizNoteContextMenuViewportMargin, menuAnchorLeft - noteContextMenuRect.width)
        : menuAnchorLeft
    const menuTop = Math.max(
      papelizNoteContextMenuViewportMargin,
      Math.min(menuAnchorTop, window.innerHeight - noteContextMenuRect.height - papelizNoteContextMenuViewportMargin),
    )
    setClampedMenuPosition({ menuLeft, menuTop })
    noteContextMenuElement.focus({ preventScroll: true })
  }, [menuAnchorLeft, menuAnchorTop])

  useEffect(() => {
    const closeOnOutsidePointer = (pointerEvent: PointerEvent) => {
      if (!noteContextMenuRef.current?.contains(pointerEvent.target as Node)) onNoteContextMenuCloseRef.current()
    }
    const closeOnWindowChange = () => onNoteContextMenuCloseRef.current()
    // The note scrolling closes the menu; the menu scrolling itself (on a short screen) does not.
    const closeOnScrollOutside = (scrollEvent: Event) => {
      if (!noteContextMenuRef.current?.contains(scrollEvent.target as Node)) onNoteContextMenuCloseRef.current()
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer, true)
    document.addEventListener('scroll', closeOnScrollOutside, true)
    const stopWatchingWindowWidth = subscribeToPapelizWindowWidthChange(closeOnWindowChange)
    window.addEventListener('blur', closeOnWindowChange)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
      document.removeEventListener('scroll', closeOnScrollOutside, true)
      stopWatchingWindowWidth()
      window.removeEventListener('blur', closeOnWindowChange)
    }
  }, [])

  // Runs a menu action, then gives the note its cursor back.
  const runInNote = (noteAction: () => void) => () => {
    onNoteContextMenuClose()
    noteAction()
    noteEditorView.focus()
  }

  const copySelectedText = async (shouldRemoveSelectedText: boolean) => {
    onNoteContextMenuClose()
    noteEditorView.focus()
    try {
      await navigator.clipboard.writeText(selectedText)
    } catch {
      onNoteContextMenuProblem(shouldRemoveSelectedText ? 'Couldn’t cut (Use Ctrl+X)' : 'Couldn’t copy (Use Ctrl+C)')
      return
    }
    if (shouldRemoveSelectedText) {
      noteEditorView.dispatch(noteEditorView.state.replaceSelection(''), { userEvent: 'delete.cut' })
    }
  }

  const pasteClipboardText = async () => {
    onNoteContextMenuClose()
    noteEditorView.focus()
    try {
      const clipboardText = await navigator.clipboard.readText()
      noteEditorView.dispatch(noteEditorView.state.replaceSelection(clipboardText), { userEvent: 'input.paste', scrollIntoView: true })
    } catch {
      onNoteContextMenuProblem('Couldn’t paste (Use Ctrl+V)')
    }
  }

  const moveMenuFocus = (keyboardEvent: KeyboardEvent<HTMLDivElement>) => {
    const noteContextMenuButtons = [...(noteContextMenuRef.current?.querySelectorAll<HTMLButtonElement>('[data-papeliz-note-context-menu-item]:not(:disabled)') ?? [])]
    const focusedButtonIndex = noteContextMenuButtons.findIndex((noteContextMenuButton) => noteContextMenuButton === document.activeElement)
    let nextButtonIndex: number | null = null
    if (keyboardEvent.key === 'ArrowDown' || keyboardEvent.key === 'ArrowRight') nextButtonIndex = (focusedButtonIndex + 1) % noteContextMenuButtons.length
    if (keyboardEvent.key === 'ArrowUp' || keyboardEvent.key === 'ArrowLeft') {
      nextButtonIndex = (Math.max(focusedButtonIndex, 0) - 1 + noteContextMenuButtons.length) % noteContextMenuButtons.length
    }
    if (keyboardEvent.key === 'Home') nextButtonIndex = 0
    if (keyboardEvent.key === 'End') nextButtonIndex = noteContextMenuButtons.length - 1
    if (nextButtonIndex !== null) {
      keyboardEvent.preventDefault()
      noteContextMenuButtons[nextButtonIndex]?.focus()
      return
    }
    if (keyboardEvent.key === 'Escape' || keyboardEvent.key === 'Tab') {
      keyboardEvent.preventDefault()
      keyboardEvent.stopPropagation()
      onNoteContextMenuClose()
      noteEditorView.focus()
    }
  }

  return createPortal(
    <div
      ref={noteContextMenuRef}
      role="menu"
      aria-label="Note actions"
      tabIndex={-1}
      onKeyDown={moveMenuFocus}
      onContextMenu={(contextMenuEvent) => contextMenuEvent.preventDefault()}
      className="papeliz-pop-enter fixed z-50 max-h-[calc(100dvh-16px)] w-[288px] overflow-y-auto overscroll-contain rounded-2xl border border-papeliz-line bg-papeliz-surface p-1.5 shadow-papeliz-pop outline-none [scrollbar-width:thin]"
      style={{ left: clampedMenuPosition.menuLeft, top: clampedMenuPosition.menuTop }}
    >
      {!isNoteReadOnly && (
        <>
          <div role="group" aria-label="Format" className="flex items-center justify-between px-0.5">
            {papelizInlineFormatMenuButtons.map(({ inlineMarkdownFormat, formatLabel, formatKeyBindingActionId, formatGlyph }) => {
              const formatButtonLabel =
                formatKeyBindingActionId === undefined ? formatLabel : `${formatLabel} (${describePapelizKeyBindingShortcut(formatKeyBindingActionId, papelizKeyBindings)})`
              return (
                <button
                  key={inlineMarkdownFormat}
                  type="button"
                  role="menuitemcheckbox"
                  tabIndex={-1}
                  aria-checked={appliedInlineFormats.has(inlineMarkdownFormat)}
                  aria-pressed={appliedInlineFormats.has(inlineMarkdownFormat)}
                  aria-label={formatButtonLabel}
                  title={formatButtonLabel}
                  data-papeliz-note-context-menu-item=""
                  data-papeliz-inline-markdown-format={inlineMarkdownFormat}
                  onClick={runInNote(() => runPapelizInlineMarkdownFormat(noteEditorView, inlineMarkdownFormat))}
                  className="papeliz-note-format-button focus-visible:bg-papeliz-hover focus-visible:outline-none"
                >
                  {formatGlyph}
                </button>
              )
            })}
          </div>
          <div role="group" aria-label="Turn the lines into" className="mt-0.5 flex items-center justify-between px-0.5">
            {papelizLineFormatMenuButtons.map(({ lineMarkdownFormat, formatLabel, FormatIcon }) => (
              <button
                key={lineMarkdownFormat}
                type="button"
                role="menuitemcheckbox"
                tabIndex={-1}
                aria-checked={appliedLineFormat === lineMarkdownFormat}
                aria-label={formatLabel}
                title={formatLabel}
                data-papeliz-note-context-menu-item=""
                onClick={runInNote(() => runLineMarkdownFormat(noteEditorView, lineMarkdownFormat))}
                className={joinPapelizClassNames(
                  'grid size-[30px] place-items-center rounded-full text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink focus-visible:bg-papeliz-hover focus-visible:outline-none',
                  appliedLineFormat === lineMarkdownFormat && 'bg-papeliz-blue-soft text-papeliz-blue hover:bg-papeliz-blue-soft-hover hover:text-papeliz-blue',
                )}
              >
                <FormatIcon className="size-4" aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-label="Divider"
              title="Divider (a line across the note)"
              data-papeliz-note-context-menu-item=""
              onClick={runInNote(() => runInsertDivider(noteEditorView))}
              className="grid size-[30px] place-items-center rounded-full text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink focus-visible:bg-papeliz-hover focus-visible:outline-none"
            >
              <SeparatorHorizontal className="size-4" aria-hidden="true" />
            </button>
          </div>
          <PapelizNoteContextMenuDivider />
          <p className="px-2.5 pt-0.5 pb-1 text-[11.5px] font-semibold text-papeliz-ink-subtle">Text color</p>
          <div role="group" aria-label="Text color" className="flex items-center justify-between px-1.5">
            {papelizNoteCalloutColors.map((textColorName) => (
              <button
                key={textColorName}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-label={`${textColorName.charAt(0).toUpperCase()}${textColorName.slice(1)} text`}
                title={`${textColorName.charAt(0).toUpperCase()}${textColorName.slice(1)} text`}
                data-papeliz-note-context-menu-item=""
                aria-pressed={currentTextStyle?.textColor === textColorName}
                onClick={runInNote(() => runTextStyle(noteEditorView, { textColor: textColorName }))}
                className="grid size-[22px] place-items-center rounded-full transition-transform hover:scale-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-blue aria-pressed:ring-2 aria-pressed:ring-papeliz-ink aria-pressed:ring-offset-2 aria-pressed:ring-offset-papeliz-surface"
                style={{ background: `var(--color-papeliz-callout-${textColorName}-ink)` }}
              />
            ))}
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-label="Text in any color"
              aria-expanded={colorPickerPurpose === 'text-color'}
              title="Pick any color for the text"
              data-papeliz-note-context-menu-item=""
              onClick={() => setColorPickerPurpose(colorPickerPurpose === 'text-color' ? null : 'text-color')}
              className="grid size-[24px] place-items-center rounded-full transition-transform hover:scale-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-blue"
            >
              <span aria-hidden="true" className="papeliz-custom-card-color-wheel size-[20px] rounded-full" />
            </button>
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-label="Remove the text color"
              title="Remove the text color"
              disabled={!currentTextStyle?.textColor}
              data-papeliz-note-context-menu-item=""
              onClick={runInNote(() => runTextStyle(noteEditorView, { textColor: null }))}
              className="grid size-[24px] place-items-center rounded-full text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-blue"
            >
              <Ban className="size-4" aria-hidden="true" />
            </button>
          </div>
          {colorPickerPurpose === 'text-color' && (
            <div className="papeliz-pop-enter mx-1 mt-1.5 rounded-xl bg-papeliz-surface-soft p-2">
              <PapelizColorPicker
                colorPickerLabel="Any color for the text"
                initialHexColor="#e11d48"
                chooseColorButtonLabel="Color text"
                onColorChoose={(textHexColor) => runInNote(() => runTextStyle(noteEditorView, { textColor: textHexColor }))()}
              />
            </div>
          )}
          <p className="px-2.5 pt-2 pb-1 text-[11.5px] font-semibold text-papeliz-ink-subtle">Text size</p>
          <div role="group" aria-label="Text size" className="flex items-end gap-1 px-1.5">
            <button
              type="button"
              role="menuitemradio"
              tabIndex={-1}
              aria-checked={currentTextStyle === null || currentTextStyle.textSize === null}
              aria-label="Normal size"
              title="Normal size: the text's own size"
              data-papeliz-note-context-menu-item=""
              onClick={runInNote(() => runTextStyle(noteEditorView, { textSize: null }))}
              className="grid h-8 flex-1 place-items-center rounded-lg text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink aria-checked:bg-papeliz-blue-soft aria-checked:text-papeliz-blue focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-papeliz-blue"
            >
              <Type className="size-4" aria-hidden="true" />
            </button>
            {papelizNoteTextSizes.map(({ textSize, textSizeLabel }, textSizeIndex) => (
              <button
                key={textSize}
                type="button"
                role="menuitemradio"
                tabIndex={-1}
                aria-checked={currentTextStyle?.textSize === textSize}
                aria-label={`${textSizeLabel} text`}
                title={`${textSizeLabel} text`}
                data-papeliz-note-context-menu-item=""
                onClick={runInNote(() => runTextStyle(noteEditorView, { textSize }))}
                className="grid h-8 flex-1 place-items-center rounded-lg font-semibold text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink aria-checked:bg-papeliz-blue-soft aria-checked:text-papeliz-blue focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-papeliz-blue"
                style={{ fontSize: [11, 15, 18, 21][textSizeIndex] }}
              >
                A
              </button>
            ))}
          </div>
          <p className="px-2.5 pt-2 pb-1 text-[11.5px] font-semibold text-papeliz-ink-subtle">Cards</p>
          <div role="group" aria-label="Cards" className="flex items-center justify-between px-1.5">
            {papelizCalloutMenuButtons.map(({ calloutKind, calloutLabel, CalloutIcon, calloutToneClassName }) => (
              <button
                key={calloutKind}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-label={currentCalloutCard === null ? calloutLabel : `Make this a ${calloutLabel.toLowerCase()}`}
                aria-pressed={currentCalloutCard !== null && currentCalloutCard.calloutKind === calloutKind && currentCalloutCard.calloutColor === null}
                title={currentCalloutCard === null ? (hasSelectedText ? `${calloutLabel} around the selection` : calloutLabel) : `Make this a ${calloutLabel.toLowerCase()}`}
                data-papeliz-note-context-menu-item=""
                onClick={runInNote(() => runCalloutCardChoice(noteEditorView, calloutKind))}
                className={joinPapelizClassNames(
                  'grid size-[32px] place-items-center rounded-lg transition-[filter,transform] hover:brightness-95 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-papeliz-blue aria-pressed:ring-2 aria-pressed:ring-papeliz-ink/70 aria-pressed:ring-offset-1 aria-pressed:ring-offset-papeliz-surface',
                  calloutToneClassName,
                )}
              >
                <CalloutIcon className="size-4" aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-label="Custom card, in any color"
              aria-expanded={colorPickerPurpose === 'custom-card'}
              title="Custom card: pick any color"
              data-papeliz-note-context-menu-item=""
              onClick={() => setColorPickerPurpose(colorPickerPurpose === 'custom-card' ? null : 'custom-card')}
              className="grid size-[32px] place-items-center rounded-lg transition-transform hover:bg-papeliz-hover active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-papeliz-blue aria-expanded:bg-papeliz-hover"
            >
              <span aria-hidden="true" className="papeliz-custom-card-color-wheel size-[20px] rounded-full" />
            </button>
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-label="Remove the card"
              title={currentCalloutCard === null ? 'Put the cursor in a card to remove it' : 'Remove the card, keeping its text'}
              disabled={currentCalloutCard === null}
              data-papeliz-note-context-menu-item=""
              onClick={runInNote(() => runCalloutCardRemoval(noteEditorView))}
              className="grid size-[32px] place-items-center rounded-lg text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-papeliz-blue"
            >
              <Ban className="size-4" aria-hidden="true" />
            </button>
          </div>
          {colorPickerPurpose === 'custom-card' && (
            <div className="papeliz-pop-enter mx-1 mt-1.5 flex flex-col gap-2 rounded-xl bg-papeliz-surface-soft p-2">
              <div role="group" aria-label="Custom card colors" className="flex items-center justify-between">
                {papelizNoteCalloutColors.map((customCardColor) => (
                  <button
                    key={customCardColor}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    aria-label={`${customCardColor.charAt(0).toUpperCase()}${customCardColor.slice(1)} card`}
                    title={`${customCardColor.charAt(0).toUpperCase()}${customCardColor.slice(1)}`}
                    data-papeliz-note-context-menu-item=""
                    onClick={runInNote(() => runCalloutCardChoice(noteEditorView, 'note', customCardColor))}
                    className="size-[22px] rounded-full transition-transform hover:scale-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-blue"
                    style={{
                      background: `var(--color-papeliz-callout-${customCardColor}-ground)`,
                      boxShadow: `inset 0 0 0 2px var(--color-papeliz-callout-${customCardColor}-ink)`,
                    }}
                  />
                ))}
              </div>
              <PapelizColorPicker
                colorPickerLabel="Any color for the card"
                initialHexColor="#7c3aed"
                chooseColorButtonLabel="Add card"
                onColorChoose={(customCardHexColor) => runInNote(() => runCalloutCardChoice(noteEditorView, 'note', customCardHexColor))()}
              />
            </div>
          )}
        </>
      )}
      <PapelizNoteContextMenuDivider />
      <div role="group" aria-label="Assistant" className="flex flex-col gap-1">
        {!isNoteReadOnly && (
          <PapelizNoteContextMenuItem
            menuItemLabel="Edit with Assistant"
            MenuItemIcon={Sparkles}
            menuItemShortcutLabel={describePapelizKeyBindingShortcut('assistant-inline-edit', papelizKeyBindings).replace(/\+(?=.)/g, ' ')}
            menuItemTone="assistant-edit"
            isMenuItemDisabled={!hasSelectedText || !isEditWithAssistantAvailable}
            onMenuItemSelect={() => {
              onNoteContextMenuClose()
              noteEditorView.focus()
              onEditWithAssistant()
            }}
          />
        )}
        <PapelizNoteContextMenuItem
          menuItemLabel="Ask Assistant"
          MenuItemIcon={MessageSquare}
          menuItemTone="assistant-ask"
          onMenuItemSelect={() => {
            onNoteContextMenuClose()
            onAskAssistantInPanel(selectedText)
          }}
        />
      </div>
      <PapelizNoteContextMenuDivider />
      {!isNoteReadOnly && (
        <PapelizNoteContextMenuItem
          menuItemLabel="Cut"
          MenuItemIcon={Scissors}
          menuItemShortcutLabel="Ctrl X"
          isMenuItemDisabled={!hasSelectedText}
          onMenuItemSelect={() => void copySelectedText(true)}
        />
      )}
      <PapelizNoteContextMenuItem
        menuItemLabel="Copy"
        MenuItemIcon={Copy}
        menuItemShortcutLabel="Ctrl C"
        isMenuItemDisabled={!hasSelectedText}
        onMenuItemSelect={() => void copySelectedText(false)}
      />
      {!isNoteReadOnly && (
        <PapelizNoteContextMenuItem
          menuItemLabel="Paste"
          MenuItemIcon={ClipboardPaste}
          menuItemShortcutLabel="Ctrl V"
          isMenuItemDisabled={!isClipboardReadable}
          onMenuItemSelect={() => void pasteClipboardText()}
        />
      )}
      <PapelizNoteContextMenuItem
        menuItemLabel="Select all"
        MenuItemIcon={TextSelect}
        menuItemShortcutLabel="Ctrl A"
        onMenuItemSelect={runInNote(() => selectAll(noteEditorView))}
      />
      {!isNoteReadOnly && (
        <>
          <PapelizNoteContextMenuDivider />
          <PapelizNoteContextMenuItem
            menuItemLabel="Undo"
            MenuItemIcon={Undo2}
            menuItemShortcutLabel="Ctrl Z"
            isMenuItemDisabled={!canUndo}
            onMenuItemSelect={runInNote(() => undo(noteEditorView))}
          />
          <PapelizNoteContextMenuItem
            menuItemLabel="Redo"
            MenuItemIcon={Redo2}
            menuItemShortcutLabel="Ctrl Y"
            isMenuItemDisabled={!canRedo}
            onMenuItemSelect={runInNote(() => redo(noteEditorView))}
          />
        </>
      )}
    </div>,
    document.body,
  )
}
