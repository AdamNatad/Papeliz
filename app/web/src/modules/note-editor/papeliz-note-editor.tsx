import { autocompletion, completionKeymap, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { drawSelection, dropCursor, EditorView, keymap, placeholder, rectangularSelection, tooltips } from '@codemirror/view'
import { useEffect, useRef } from 'react'
import { createPapelizInlineEditExtension, type PapelizInlineEditEditorHandlers } from '../assistant/papeliz-assistant-inline-edit-extension'
import { papelizMdCodePresentation } from '../md-code/papeliz-md-code-presentation'
import { createPapelizMdViewPresentation, type PapelizMdViewWikilinkHandlers } from '../md-view/papeliz-md-view-presentation'
import { papelizNoteEditorFrontmatterSyntax, papelizNoteEditorWikilinkSyntax } from './papeliz-note-editor-markdown-syntax'
import { papelizNoteEditorBaseTheme } from './papeliz-note-editor-theme'
import { createPapelizNoteContextMenuExtension, type PapelizNoteContextMenuEditorHandlers } from './papeliz-note-context-menu-extension'
import { papelizNoteFormattingKeymapExtension } from './papeliz-note-formatting-commands'

// The note's two views, behind the one main switch: MD Code shows the raw Markdown, MD View shows
// it rendered (and, unlocked, editable in place).
export type PapelizNoteViewMode = 'md-code' | 'md-view'

// Lives as long as the open vault: each note's editor state (text, undo history, cursor), so
// switching tabs or views keeps undo working, plus what MD View needs to draw wikilinks.
export interface PapelizNoteEditorSessionCache {
  editorStatesByLoadedNoteSessionId: Map<number, EditorState>
  wikilinkCompletionNoteTitles: { current: readonly string[] }
  mdViewWikilinkHandlers: { current: PapelizMdViewWikilinkHandlers }
  mdViewPresentation: Extension
  // The editor on screen, if any: inline assistant edits and the Outline act on it.
  activeNoteEditorView: { current: EditorView | null }
  // Where an inline assistant edit box is drawn inside the editor, and what opening one does.
  inlineEditHostElement: HTMLElement
  inlineEditHandlers: { current: PapelizInlineEditEditorHandlers }
  noteContextMenuHandlers: { current: PapelizNoteContextMenuEditorHandlers }
}

export function createPapelizNoteEditorSessionCache(): PapelizNoteEditorSessionCache {
  const mdViewWikilinkHandlers: { current: PapelizMdViewWikilinkHandlers } = {
    current: { isWikilinkTargetResolved: () => true, activateWikilinkTarget: () => undefined },
  }
  return {
    editorStatesByLoadedNoteSessionId: new Map(),
    wikilinkCompletionNoteTitles: { current: [] },
    mdViewWikilinkHandlers,
    mdViewPresentation: createPapelizMdViewPresentation(mdViewWikilinkHandlers),
    activeNoteEditorView: { current: null },
    inlineEditHostElement: Object.assign(document.createElement('div'), { className: 'papeliz-inline-edit-host' }),
    inlineEditHandlers: { current: { openInlineEdit: () => undefined } },
    noteContextMenuHandlers: { current: { openNoteContextMenu: () => undefined } },
  }
}

// The cache's holders are set only through these functions, from effects: the editor reads them
// when it needs them, so changing them never asks React to draw again.
export function setPapelizNoteEditorWikilinkCompletionTitles(noteEditorSessionCache: PapelizNoteEditorSessionCache, noteTitles: readonly string[]): void {
  noteEditorSessionCache.wikilinkCompletionNoteTitles.current = noteTitles
}

export function setPapelizNoteEditorMdViewWikilinkHandlers(
  noteEditorSessionCache: PapelizNoteEditorSessionCache,
  mdViewWikilinkHandlers: PapelizMdViewWikilinkHandlers,
): void {
  noteEditorSessionCache.mdViewWikilinkHandlers.current = mdViewWikilinkHandlers
}

export function setPapelizNoteEditorContextMenuHandlers(
  noteEditorSessionCache: PapelizNoteEditorSessionCache,
  noteContextMenuHandlers: PapelizNoteContextMenuEditorHandlers,
): void {
  noteEditorSessionCache.noteContextMenuHandlers.current = noteContextMenuHandlers
}

export function setPapelizNoteEditorInlineEditHandlers(
  noteEditorSessionCache: PapelizNoteEditorSessionCache,
  inlineEditHandlers: PapelizInlineEditEditorHandlers,
): void {
  noteEditorSessionCache.inlineEditHandlers.current = inlineEditHandlers
}

function rememberActiveNoteEditorView(noteEditorSessionCache: PapelizNoteEditorSessionCache, noteEditorView: EditorView): void {
  noteEditorSessionCache.activeNoteEditorView.current = noteEditorView
}

function forgetActiveNoteEditorView(noteEditorSessionCache: PapelizNoteEditorSessionCache, noteEditorView: EditorView): void {
  if (noteEditorSessionCache.activeNoteEditorView.current === noteEditorView) noteEditorSessionCache.activeNoteEditorView.current = null
}

// Switching views or locking reconfigures these two parts of the editor; the text, the cursor and
// the undo history stay as they are.
const papelizNotePresentationCompartment = new Compartment()
const papelizNoteEditingLockCompartment = new Compartment()
// Locked keeps the cursor, selection, copy and find; only changes are refused.
const papelizNoteEditingLockedExtension: Extension = EditorState.readOnly.of(true)
const papelizNoteEditingUnlockedExtension: Extension = EditorState.readOnly.of(false)

function getNotePresentationExtension(noteViewMode: PapelizNoteViewMode, noteEditorSessionCache: PapelizNoteEditorSessionCache): Extension {
  return noteViewMode === 'md-code' ? papelizMdCodePresentation : noteEditorSessionCache.mdViewPresentation
}

function getNoteEditingLockExtension(isNoteEditingLocked: boolean): Extension {
  return isNoteEditingLocked ? papelizNoteEditingLockedExtension : papelizNoteEditingUnlockedExtension
}

function createWikilinkCompletionSource(wikilinkCompletionNoteTitles: { current: readonly string[] }) {
  return (completionContext: CompletionContext): CompletionResult | null => {
    const typedWikilinkStart = completionContext.matchBefore(/\[\[[^[\]|#\n]*$/)
    if (typedWikilinkStart === null) return null
    const wikilinkNameStart = typedWikilinkStart.from + 2
    const wikilinkNoteOptions: Completion[] = wikilinkCompletionNoteTitles.current.map((noteTitle) => ({
      label: noteTitle,
      apply: (editorView, _completion, applyFrom, applyTo) => {
        const hasClosingBrackets = editorView.state.sliceDoc(applyTo, applyTo + 2) === ']]'
        const insertedText = hasClosingBrackets ? noteTitle : `${noteTitle}]]`
        editorView.dispatch({
          changes: { from: applyFrom, to: applyTo, insert: insertedText },
          selection: { anchor: applyFrom + noteTitle.length + 2 },
          userEvent: 'input.complete',
        })
      },
    }))
    return { from: wikilinkNameStart, options: wikilinkNoteOptions, validFor: /^[^[\]|#\n]*$/ }
  }
}

function getNoteEditorTooltipSpace(editorView: EditorView): { top: number; left: number; bottom: number; right: number } {
  const noteEditorRect = editorView.dom.getBoundingClientRect()
  return { top: 0, left: noteEditorRect.left + 8, bottom: window.innerHeight, right: noteEditorRect.right - 8 }
}

function createNoteEditorState(
  vaultNoteText: string,
  noteEditorSessionCache: PapelizNoteEditorSessionCache,
  noteViewMode: PapelizNoteViewMode,
  isNoteEditingLocked: boolean,
): EditorState {
  return EditorState.create({
    doc: vaultNoteText,
    extensions: [
      history(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      EditorState.allowMultipleSelections.of(true),
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage, extensions: [papelizNoteEditorFrontmatterSyntax, papelizNoteEditorWikilinkSyntax] }),
      highlightSelectionMatches(),
      search({ top: true }),
      autocompletion({ override: [createWikilinkCompletionSource(noteEditorSessionCache.wikilinkCompletionNoteTitles)], icons: false }),
      placeholder('Start writing…'),
      EditorView.contentAttributes.of({ 'aria-label': 'Note text', spellcheck: 'true', autocorrect: 'on' }),
      keymap.of([...completionKeymap, ...searchKeymap, ...historyKeymap, ...defaultKeymap]),
      papelizNoteEditorBaseTheme,
      // Tooltips (the `[[` completions) stay inside the note column, clear of its edges.
      tooltips({ tooltipSpace: getNoteEditorTooltipSpace }),
      createPapelizInlineEditExtension(noteEditorSessionCache.inlineEditHostElement, noteEditorSessionCache.inlineEditHandlers),
      createPapelizNoteContextMenuExtension(noteEditorSessionCache.noteContextMenuHandlers),
      papelizNoteFormattingKeymapExtension,
      papelizNotePresentationCompartment.of(getNotePresentationExtension(noteViewMode, noteEditorSessionCache)),
      papelizNoteEditingLockCompartment.of(getNoteEditingLockExtension(isNoteEditingLocked)),
    ],
  })
}

// Brings the editor to `vaultNoteText` when the note changed outside it (an accepted assistant
// edit): only the changed stretch is replaced, as one change that Undo can take back.
function syncNoteEditorViewToText(noteEditorView: EditorView, vaultNoteText: string): void {
  const editorText = noteEditorView.state.doc.toString()
  if (editorText === vaultNoteText) return
  let sharedStartLength = 0
  const shorterLength = Math.min(editorText.length, vaultNoteText.length)
  while (sharedStartLength < shorterLength && editorText[sharedStartLength] === vaultNoteText[sharedStartLength]) sharedStartLength += 1
  let sharedEndLength = 0
  while (
    sharedEndLength < shorterLength - sharedStartLength &&
    editorText[editorText.length - 1 - sharedEndLength] === vaultNoteText[vaultNoteText.length - 1 - sharedEndLength]
  ) {
    sharedEndLength += 1
  }
  noteEditorView.dispatch({
    changes: { from: sharedStartLength, to: editorText.length - sharedEndLength, insert: vaultNoteText.slice(sharedStartLength, vaultNoteText.length - sharedEndLength) },
    userEvent: 'input.papeliz-outside-change',
  })
}

// Brings a (possibly cached) editor state to the wanted view and lock.
function applyNoteViewModeAndLock(
  noteEditorView: EditorView,
  noteEditorSessionCache: PapelizNoteEditorSessionCache,
  noteViewMode: PapelizNoteViewMode,
  isNoteEditingLocked: boolean,
): void {
  const wantedPresentation = getNotePresentationExtension(noteViewMode, noteEditorSessionCache)
  const wantedEditingLock = getNoteEditingLockExtension(isNoteEditingLocked)
  const reconfigureEffects = []
  if (papelizNotePresentationCompartment.get(noteEditorView.state) !== wantedPresentation) {
    reconfigureEffects.push(papelizNotePresentationCompartment.reconfigure(wantedPresentation))
  }
  if (papelizNoteEditingLockCompartment.get(noteEditorView.state) !== wantedEditingLock) {
    reconfigureEffects.push(papelizNoteEditingLockCompartment.reconfigure(wantedEditingLock))
  }
  if (reconfigureEffects.length > 0) noteEditorView.dispatch({ effects: reconfigureEffects })
}

function getOrCreateNoteEditorState(
  noteEditorSessionCache: PapelizNoteEditorSessionCache,
  loadedNoteSessionId: number,
  vaultNoteText: string,
  noteViewMode: PapelizNoteViewMode,
  isNoteEditingLocked: boolean,
): EditorState {
  return (
    noteEditorSessionCache.editorStatesByLoadedNoteSessionId.get(loadedNoteSessionId) ??
    createNoteEditorState(vaultNoteText, noteEditorSessionCache, noteViewMode, isNoteEditingLocked)
  )
}

interface PapelizNoteEditorProps {
  loadedNoteSessionId: number
  vaultNoteText: string
  noteEditorSessionCache: PapelizNoteEditorSessionCache
  noteViewMode: PapelizNoteViewMode
  isNoteEditingLocked: boolean
  onVaultNoteTextChange: (loadedNoteSessionId: number, vaultNoteText: string) => void
}

// CodeMirror 6 on the note's Markdown, for both MD Code and MD View. The text is never converted,
// so the file stays byte-for-byte what was typed.
export function PapelizNoteEditor({
  loadedNoteSessionId,
  vaultNoteText,
  noteEditorSessionCache,
  noteViewMode,
  isNoteEditingLocked,
  onVaultNoteTextChange,
}: PapelizNoteEditorProps) {
  const noteEditorContainerRef = useRef<HTMLDivElement>(null)
  const noteEditorViewRef = useRef<EditorView | null>(null)
  const shownLoadedNoteSessionIdRef = useRef<number | null>(null)
  const onVaultNoteTextChangeRef = useRef(onVaultNoteTextChange)
  const latestPropsRef = useRef({ loadedNoteSessionId, vaultNoteText, noteViewMode, isNoteEditingLocked })

  useEffect(() => {
    onVaultNoteTextChangeRef.current = onVaultNoteTextChange
    latestPropsRef.current = { loadedNoteSessionId, vaultNoteText, noteViewMode, isNoteEditingLocked }
  })

  // Create the editor once; later notes swap their state into the same view.
  useEffect(() => {
    const noteEditorContainer = noteEditorContainerRef.current
    if (noteEditorContainer === null) return
    const mountProps = latestPropsRef.current
    const noteEditorView = new EditorView({
      parent: noteEditorContainer,
      state: getOrCreateNoteEditorState(
        noteEditorSessionCache,
        mountProps.loadedNoteSessionId,
        mountProps.vaultNoteText,
        mountProps.noteViewMode,
        mountProps.isNoteEditingLocked,
      ),
      dispatchTransactions: (editorTransactions, dispatchingEditorView) => {
        dispatchingEditorView.update(editorTransactions)
        const shownLoadedNoteSessionId = shownLoadedNoteSessionIdRef.current
        if (shownLoadedNoteSessionId !== null && editorTransactions.some((editorTransaction) => editorTransaction.docChanged)) {
          onVaultNoteTextChangeRef.current(shownLoadedNoteSessionId, dispatchingEditorView.state.doc.toString())
        }
      },
    })
    noteEditorViewRef.current = noteEditorView
    rememberActiveNoteEditorView(noteEditorSessionCache, noteEditorView)
    shownLoadedNoteSessionIdRef.current = mountProps.loadedNoteSessionId
    applyNoteViewModeAndLock(noteEditorView, noteEditorSessionCache, mountProps.noteViewMode, mountProps.isNoteEditingLocked)
    syncNoteEditorViewToText(noteEditorView, mountProps.vaultNoteText)
    return () => {
      if (shownLoadedNoteSessionIdRef.current !== null) {
        noteEditorSessionCache.editorStatesByLoadedNoteSessionId.set(shownLoadedNoteSessionIdRef.current, noteEditorView.state)
      }
      noteEditorView.destroy()
      noteEditorViewRef.current = null
      forgetActiveNoteEditorView(noteEditorSessionCache, noteEditorView)
      shownLoadedNoteSessionIdRef.current = null
    }
    // The editor view is created once per mount; note, view and lock changes are handled below.
  }, [noteEditorSessionCache])

  useEffect(() => {
    const noteEditorView = noteEditorViewRef.current
    if (noteEditorView === null || shownLoadedNoteSessionIdRef.current === loadedNoteSessionId) return
    if (shownLoadedNoteSessionIdRef.current !== null) {
      noteEditorSessionCache.editorStatesByLoadedNoteSessionId.set(shownLoadedNoteSessionIdRef.current, noteEditorView.state)
    }
    shownLoadedNoteSessionIdRef.current = loadedNoteSessionId
    const latestProps = latestPropsRef.current
    noteEditorView.setState(
      getOrCreateNoteEditorState(noteEditorSessionCache, loadedNoteSessionId, latestProps.vaultNoteText, latestProps.noteViewMode, latestProps.isNoteEditingLocked),
    )
    applyNoteViewModeAndLock(noteEditorView, noteEditorSessionCache, latestProps.noteViewMode, latestProps.isNoteEditingLocked)
    syncNoteEditorViewToText(noteEditorView, latestProps.vaultNoteText)
  }, [loadedNoteSessionId, noteEditorSessionCache])

  useEffect(() => {
    const noteEditorView = noteEditorViewRef.current
    if (noteEditorView !== null && shownLoadedNoteSessionIdRef.current === loadedNoteSessionId) syncNoteEditorViewToText(noteEditorView, vaultNoteText)
  }, [loadedNoteSessionId, vaultNoteText])

  useEffect(() => {
    const noteEditorView = noteEditorViewRef.current
    if (noteEditorView !== null) applyNoteViewModeAndLock(noteEditorView, noteEditorSessionCache, noteViewMode, isNoteEditingLocked)
  }, [noteEditorSessionCache, noteViewMode, isNoteEditingLocked])

  return <div ref={noteEditorContainerRef} className="papeliz-note-editor" />
}
