import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { drawSelection, dropCursor, EditorView, keymap, rectangularSelection } from '@codemirror/view'
import { useEffect, useRef } from 'react'
import { papelizJsonCodePresentation } from '../json-view/papeliz-json-code-presentation'
import { papelizMdCodePresentation } from '../md-code/papeliz-md-code-presentation'
import { syncNoteEditorViewToText } from '../note-editor/papeliz-note-editor'
import { papelizNoteEditorBaseTheme } from '../note-editor/papeliz-note-editor-theme'

// A text file that isn't a note, in MD Code: the file's text exactly as it is, in the monospace
// face with line numbers, JSON with its colors, folding and parse mark, anything else plain. It has
// none of a note's Markdown: no `[[` list, formatting keys, AI Assistant edits or Outline. Its
// editor states share the note editor's cache, keyed by the same loaded-note sessions, so undo
// survives switching tabs.

export type PapelizVaultTextFileLanguage = 'json' | 'plain-text'

const papelizVaultTextFileEditingLockCompartment = new Compartment()
const papelizVaultTextFileEditingLockedExtension: Extension = EditorState.readOnly.of(true)
const papelizVaultTextFileEditingUnlockedExtension: Extension = EditorState.readOnly.of(false)

function getVaultTextFileEditingLockExtension(isVaultTextFileEditingLocked: boolean): Extension {
  return isVaultTextFileEditingLocked ? papelizVaultTextFileEditingLockedExtension : papelizVaultTextFileEditingUnlockedExtension
}

function createVaultTextFileEditorState(vaultTextFileText: string, vaultTextFileLanguage: PapelizVaultTextFileLanguage, isVaultTextFileEditingLocked: boolean): EditorState {
  return EditorState.create({
    doc: vaultTextFileText,
    extensions: [
      history(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      EditorState.allowMultipleSelections.of(true),
      EditorView.lineWrapping,
      highlightSelectionMatches(),
      search({ top: true }),
      EditorView.contentAttributes.of({ 'aria-label': 'File text', spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' }),
      keymap.of([...searchKeymap, ...historyKeymap, ...defaultKeymap]),
      papelizNoteEditorBaseTheme,
      papelizMdCodePresentation,
      vaultTextFileLanguage === 'json' ? papelizJsonCodePresentation : [],
      papelizVaultTextFileEditingLockCompartment.of(getVaultTextFileEditingLockExtension(isVaultTextFileEditingLocked)),
    ],
  })
}

function applyVaultTextFileEditingLock(vaultTextFileEditorView: EditorView, isVaultTextFileEditingLocked: boolean): void {
  const wantedEditingLock = getVaultTextFileEditingLockExtension(isVaultTextFileEditingLocked)
  if (papelizVaultTextFileEditingLockCompartment.get(vaultTextFileEditorView.state) === wantedEditingLock) return
  vaultTextFileEditorView.dispatch({ effects: papelizVaultTextFileEditingLockCompartment.reconfigure(wantedEditingLock) })
}

interface PapelizVaultTextFileEditorProps {
  loadedNoteSessionId: number
  vaultTextFileText: string
  vaultTextFileLanguage: PapelizVaultTextFileLanguage
  editorStatesByLoadedNoteSessionId: Map<number, EditorState>
  isVaultTextFileEditingLocked: boolean
  onVaultTextFileTextChange: (loadedNoteSessionId: number, vaultTextFileText: string) => void
}

export function PapelizVaultTextFileEditor({
  loadedNoteSessionId,
  vaultTextFileText,
  vaultTextFileLanguage,
  editorStatesByLoadedNoteSessionId,
  isVaultTextFileEditingLocked,
  onVaultTextFileTextChange,
}: PapelizVaultTextFileEditorProps) {
  const vaultTextFileEditorContainerRef = useRef<HTMLDivElement>(null)
  const vaultTextFileEditorViewRef = useRef<EditorView | null>(null)
  const onVaultTextFileTextChangeRef = useRef(onVaultTextFileTextChange)
  const latestPropsRef = useRef({ vaultTextFileText, isVaultTextFileEditingLocked })

  useEffect(() => {
    onVaultTextFileTextChangeRef.current = onVaultTextFileTextChange
    latestPropsRef.current = { vaultTextFileText, isVaultTextFileEditingLocked }
  })

  // One editor per file shown: the note area mounts this again for each file (keyed by its loaded
  // session), and the state goes back into the cache when it leaves.
  useEffect(() => {
    const vaultTextFileEditorContainer = vaultTextFileEditorContainerRef.current
    if (vaultTextFileEditorContainer === null) return
    const mountProps = latestPropsRef.current
    const vaultTextFileEditorView = new EditorView({
      parent: vaultTextFileEditorContainer,
      state:
        editorStatesByLoadedNoteSessionId.get(loadedNoteSessionId) ??
        createVaultTextFileEditorState(mountProps.vaultTextFileText, vaultTextFileLanguage, mountProps.isVaultTextFileEditingLocked),
      dispatchTransactions: (editorTransactions, dispatchingEditorView) => {
        dispatchingEditorView.update(editorTransactions)
        if (editorTransactions.some((editorTransaction) => editorTransaction.docChanged)) {
          onVaultTextFileTextChangeRef.current(loadedNoteSessionId, dispatchingEditorView.state.doc.toString())
        }
      },
    })
    vaultTextFileEditorViewRef.current = vaultTextFileEditorView
    applyVaultTextFileEditingLock(vaultTextFileEditorView, mountProps.isVaultTextFileEditingLocked)
    syncNoteEditorViewToText(vaultTextFileEditorView, mountProps.vaultTextFileText)
    return () => {
      editorStatesByLoadedNoteSessionId.set(loadedNoteSessionId, vaultTextFileEditorView.state)
      vaultTextFileEditorView.destroy()
      vaultTextFileEditorViewRef.current = null
    }
  }, [editorStatesByLoadedNoteSessionId, loadedNoteSessionId, vaultTextFileLanguage])

  useEffect(() => {
    const vaultTextFileEditorView = vaultTextFileEditorViewRef.current
    if (vaultTextFileEditorView !== null) syncNoteEditorViewToText(vaultTextFileEditorView, vaultTextFileText)
  }, [vaultTextFileText])

  useEffect(() => {
    const vaultTextFileEditorView = vaultTextFileEditorViewRef.current
    if (vaultTextFileEditorView !== null) applyVaultTextFileEditingLock(vaultTextFileEditorView, isVaultTextFileEditingLocked)
  }, [isVaultTextFileEditingLocked])

  return <div ref={vaultTextFileEditorContainerRef} className="papeliz-note-editor papeliz-vault-text-file-editor" />
}
