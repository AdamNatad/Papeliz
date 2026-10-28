import { Prec, StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state'
import { Decoration, EditorView, keymap, WidgetType } from '@codemirror/view'
import { isPapelizKeyBindingPressed } from '../workspace/papeliz-key-bindings-store'
import { usePapelizAssistantPanelUiStore } from './papeliz-assistant-panel-ui-store'
import { getActivePapelizAssistantProviderConnection } from './papeliz-assistant-provider-settings-store'

// The editor's side of inline assistant edits. "Edit with Assistant" in the note's context menu (or
// Ctrl+K, or the keys chosen in Key Bindings) starts one. The chosen passage is then remembered as a range that follows typing elsewhere, marked,
// and an edit box opens as a block right under it; the React card is drawn into that block.

export interface PapelizInlineEditRange {
  inlineEditFrom: number
  inlineEditTo: number
}

export interface PapelizInlineEditEditorHandlers {
  openInlineEdit: (editorView: EditorView, inlineEditRange: PapelizInlineEditRange) => void
}

export const setPapelizInlineEditRangeEffect = StateEffect.define<PapelizInlineEditRange | null>({
  map: (inlineEditRange, changeMapping) =>
    inlineEditRange === null
      ? null
      : { inlineEditFrom: changeMapping.mapPos(inlineEditRange.inlineEditFrom, 1), inlineEditTo: changeMapping.mapPos(inlineEditRange.inlineEditTo, -1) },
})

class PapelizInlineEditHostWidget extends WidgetType {
  constructor(readonly inlineEditHostElement: HTMLElement) {
    super()
  }

  override eq(otherWidget: PapelizInlineEditHostWidget): boolean {
    return otherWidget.inlineEditHostElement === this.inlineEditHostElement
  }

  toDOM(): HTMLElement {
    return this.inlineEditHostElement
  }

  override get estimatedHeight(): number {
    return 200
  }

  // The card handles its own clicks and typing; the editor leaves them alone.
  override ignoreEvent(): boolean {
    return true
  }
}

export function readPapelizInlineEditRange(editorState: EditorState): PapelizInlineEditRange | null {
  return editorState.field(papelizInlineEditRangeField, false) ?? null
}

const papelizInlineEditRangeField = StateField.define<PapelizInlineEditRange | null>({
  create: () => null,
  update: (inlineEditRange, editorTransaction) => {
    let updatedInlineEditRange =
      inlineEditRange === null
        ? null
        : {
            inlineEditFrom: editorTransaction.changes.mapPos(inlineEditRange.inlineEditFrom, 1),
            inlineEditTo: editorTransaction.changes.mapPos(inlineEditRange.inlineEditTo, -1),
          }
    for (const editorEffect of editorTransaction.effects) {
      if (editorEffect.is(setPapelizInlineEditRangeEffect)) updatedInlineEditRange = editorEffect.value
    }
    return updatedInlineEditRange
  },
})

export function canOfferPapelizInlineEdit(editorState: EditorState): boolean {
  const mainSelection = editorState.selection.main
  return (
    !editorState.readOnly &&
    readPapelizInlineEditRange(editorState) === null &&
    !mainSelection.empty &&
    editorState.sliceDoc(mainSelection.from, mainSelection.to).trim().length > 0
  )
}

// Opens the edit box under the selection. Until a provider is set up there is nothing to type: the
// provider settings open instead.
export function openPapelizInlineEditForSelection(editorView: EditorView, inlineEditHandlers: { current: PapelizInlineEditEditorHandlers }): boolean {
  if (!canOfferPapelizInlineEdit(editorView.state)) return false
  if (getActivePapelizAssistantProviderConnection().providerConnectionOutcome !== 'ready') {
    usePapelizAssistantPanelUiStore.getState().setProviderSettingsDialogOpen(true)
    return true
  }
  const mainSelection = editorView.state.selection.main
  const inlineEditRange = { inlineEditFrom: mainSelection.from, inlineEditTo: mainSelection.to }
  editorView.dispatch({ effects: setPapelizInlineEditRangeEffect.of(inlineEditRange) })
  inlineEditHandlers.current.openInlineEdit(editorView, inlineEditRange)
  return true
}

export function createPapelizInlineEditExtension(
  inlineEditHostElement: HTMLElement,
  inlineEditHandlers: { current: PapelizInlineEditEditorHandlers },
): Extension {
  const inlineEditHostWidget = new PapelizInlineEditHostWidget(inlineEditHostElement)

  const inlineEditDecorations = EditorView.decorations.compute([papelizInlineEditRangeField], (editorState) => {
    const inlineEditRange = readPapelizInlineEditRange(editorState)
    if (inlineEditRange === null) return Decoration.none
    const markedTo = Math.max(inlineEditRange.inlineEditFrom, inlineEditRange.inlineEditTo)
    const inlineEditDecorationRanges = [Decoration.widget({ widget: inlineEditHostWidget, block: true, side: 1 }).range(editorState.doc.lineAt(markedTo).to)]
    if (markedTo > inlineEditRange.inlineEditFrom) {
      inlineEditDecorationRanges.unshift(Decoration.mark({ class: 'cm-papeliz-inline-edit-passage' }).range(inlineEditRange.inlineEditFrom, markedTo))
    }
    return Decoration.set(inlineEditDecorationRanges, true)
  })

  return [
    papelizInlineEditRangeField,
    inlineEditDecorations,
    // Checked against the current Key Binding as the key is pressed; ahead of the default keys, so
    // a chosen shortcut wins over theirs.
    Prec.high(
      keymap.of([
        {
          any: (editorView, keyboardEvent) =>
            isPapelizKeyBindingPressed(keyboardEvent, 'assistant-inline-edit') && openPapelizInlineEditForSelection(editorView, inlineEditHandlers),
        },
      ]),
    ),
  ]
}
