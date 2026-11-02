import { ArrowUp, Check, ImagePlus, Languages, Lock, MessageSquare, Mic, Paintbrush, Pencil, RotateCw, ScanEye, SpellCheck, TextQuote } from 'lucide-react'
import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { usePapelizAssistantConversationStore } from './papeliz-assistant-conversation-store'
import { describePapelizInlineEditQuickAction, type PapelizInlineEditQuickAction } from './papeliz-assistant-inline-edit-run'
import { readPapelizInlineEditRange } from './papeliz-assistant-inline-edit-extension'
import { usePapelizInlineEditStore } from './papeliz-assistant-inline-edit-store'
import { PapelizAssistantInlineMediaCardBody } from './papeliz-assistant-inline-media-card-body'
import { usePapelizInlineMediaStore } from './papeliz-assistant-inline-media-store'
import { findPapelizNotePictureLinkAround } from './papeliz-assistant-note-picture-links'
import { usePapelizAssistantPanelUiStore } from './papeliz-assistant-panel-ui-store'
import { PapelizTextDiffView } from './papeliz-assistant-proposal-card'
import { diffPapelizTextByWords } from './papeliz-assistant-text-diff'

const papelizInlineEditQuickActions: ReadonlyArray<{ inlineEditQuickAction: PapelizInlineEditQuickAction; quickActionLabel: string; QuickActionIcon: typeof Pencil }> = [
  { inlineEditQuickAction: 'shorter', quickActionLabel: 'Shorter', QuickActionIcon: TextQuote },
  { inlineEditQuickAction: 'rewrite', quickActionLabel: 'Rewrite', QuickActionIcon: Pencil },
  { inlineEditQuickAction: 'fix-grammar', quickActionLabel: 'Fix Grammar', QuickActionIcon: SpellCheck },
  { inlineEditQuickAction: 'translate', quickActionLabel: 'Translate', QuickActionIcon: Languages },
]

interface PapelizAssistantInlineEditCardProps {
  inlineEditHostElement: HTMLElement
  vaultNoteRelativePath: string
}

// The edit box under a selected passage: an instruction or a quick action, then the change shown
// in place as a diff with Accept, Reject and Try Again. Drawn into the editor's block widget. Imagine
// and Transcribe, beside the quick actions (and on the note's right-click menu), turn the card into
// their own (papeliz-assistant-inline-media-card-body.tsx), which ends in a change shown the same way.
export function PapelizAssistantInlineEditCard({ inlineEditHostElement, vaultNoteRelativePath }: PapelizAssistantInlineEditCardProps) {
  const inlineEditInstructionInputRef = useRef<HTMLInputElement>(null)
  const selectedPassageText = usePapelizInlineEditStore((inlineEditState) => inlineEditState.selectedPassageText)
  const inlineEditStage = usePapelizInlineEditStore((inlineEditState) => inlineEditState.inlineEditStage)
  const inlineEditInstruction = usePapelizInlineEditStore((inlineEditState) => inlineEditState.inlineEditInstruction)
  const replacementPassageText = usePapelizInlineEditStore((inlineEditState) => inlineEditState.replacementPassageText)
  const inlineEditProblem = usePapelizInlineEditStore((inlineEditState) => inlineEditState.inlineEditProblem)
  const setInlineEditInstruction = usePapelizInlineEditStore((inlineEditState) => inlineEditState.setInlineEditInstruction)
  const runInlineEdit = usePapelizInlineEditStore((inlineEditState) => inlineEditState.runInlineEdit)
  const acceptInlineEdit = usePapelizInlineEditStore((inlineEditState) => inlineEditState.acceptInlineEdit)
  const closeInlineEdit = usePapelizInlineEditStore((inlineEditState) => inlineEditState.closeInlineEdit)
  const setPendingSelectionContext = usePapelizAssistantConversationStore((conversationState) => conversationState.setPendingSelectionContext)
  const setComposerDraftText = usePapelizAssistantConversationStore((conversationState) => conversationState.setComposerDraftText)
  const setAssistantPanelOpen = usePapelizWorkspaceStore((workspaceState) => workspaceState.setAssistantPanelOpen)
  const setAssistantPanelTab = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.setAssistantPanelTab)
  const requestComposerFocus = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.requestComposerFocus)
  const inlineMediaAction = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.inlineMediaAction)
  const startInlineMediaAction = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.startInlineMediaAction)
  const acceptInlineMedia = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.acceptInlineMedia)

  const inlineEditEditorView = usePapelizInlineEditStore((inlineEditState) => inlineEditState.inlineEditEditorView)
  // A picture in the passage, or one the passage is part of (Describe Picture and Edit Picture then
  // take the whole link).
  const isPictureInPassage = useMemo(() => {
    if (findPapelizNotePictureLinkAround(selectedPassageText, 0, selectedPassageText.length) !== null) return true
    const inlineEditRange = inlineEditEditorView === null ? null : readPapelizInlineEditRange(inlineEditEditorView.state)
    return (
      inlineEditEditorView !== null &&
      inlineEditRange !== null &&
      findPapelizNotePictureLinkAround(inlineEditEditorView.state.doc.toString(), inlineEditRange.inlineEditFrom, inlineEditRange.inlineEditTo) !== null
    )
  }, [selectedPassageText, inlineEditEditorView])
  const passageDiffParts = useMemo(
    () => (inlineEditStage === 'composing' ? [] : diffPapelizTextByWords(selectedPassageText, replacementPassageText)),
    [inlineEditStage, selectedPassageText, replacementPassageText],
  )

  useEffect(() => {
    requestAnimationFrame(() => inlineEditInstructionInputRef.current?.focus())
  }, [])

  const askAboutPassageInPanel = () => {
    setPendingSelectionContext({ vaultNoteRelativePath, selectedText: selectedPassageText })
    setComposerDraftText(inlineEditInstruction)
    setAssistantPanelOpen(true)
    setAssistantPanelTab('chat')
    closeInlineEdit()
    requestComposerFocus()
  }

  const handleInlineEditKeys = (keyboardEvent: KeyboardEvent<HTMLDivElement>) => {
    if (keyboardEvent.key === 'Escape') {
      keyboardEvent.preventDefault()
      keyboardEvent.stopPropagation()
      closeInlineEdit()
    } else if (keyboardEvent.key === 'Enter' && (keyboardEvent.ctrlKey || keyboardEvent.metaKey) && inlineMediaAction !== null) {
      keyboardEvent.preventDefault()
      void acceptInlineMedia()
    } else if (keyboardEvent.key === 'Enter' && (keyboardEvent.ctrlKey || keyboardEvent.metaKey) && inlineEditStage === 'review') {
      keyboardEvent.preventDefault()
      acceptInlineEdit()
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-label={
        inlineMediaAction === 'imagine'
          ? 'Imagine a picture here'
          : inlineMediaAction === 'transcribe'
            ? 'Transcribe speech here'
            : inlineMediaAction === 'describe-picture'
              ? 'Describe the picture'
              : inlineMediaAction === 'edit-picture'
                ? 'Edit the picture'
                : 'Edit the selection with the assistant'
      }
      onKeyDown={handleInlineEditKeys}
      className="papeliz-pop-enter my-2.5 overflow-hidden rounded-[22px] border border-papeliz-blue-line bg-papeliz-surface font-sans text-sm leading-normal shadow-papeliz-pop"
    >
      {inlineMediaAction !== null ? (
        <PapelizAssistantInlineMediaCardBody />
      ) : (
        <>
          <form
            className="flex items-center gap-2.5 py-2.5 pr-2.5 pl-3.5"
            onSubmit={(submitEvent) => {
              submitEvent.preventDefault()
              void runInlineEdit(inlineEditInstruction)
            }}
          >
            <span className="grid size-[22px] flex-none place-items-center rounded-full bg-linear-to-r from-papeliz-gradient-start to-papeliz-gradient-end text-white">
              <MessageSquare className="size-3" aria-hidden="true" />
            </span>
            <input
              ref={inlineEditInstructionInputRef}
              value={inlineEditInstruction}
              onChange={(changeEvent) => setInlineEditInstruction(changeEvent.target.value)}
              placeholder="What should change? Or pick one below"
              aria-label="Instruction for the selection"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-papeliz-ink outline-none placeholder:text-papeliz-ink-subtle"
            />
            <button
              type="submit"
              aria-label="Run"
              title="Run (Enter)"
              disabled={inlineEditInstruction.trim().length === 0 || inlineEditStage === 'running'}
              className="grid size-[34px] flex-none place-items-center rounded-full bg-papeliz-gradient-start text-white transition-[transform,opacity] active:scale-90 disabled:opacity-40"
            >
              <ArrowUp className="size-4" strokeWidth={2.4} aria-hidden="true" />
            </button>
          </form>
          <div className="flex flex-wrap gap-1.5 px-3.5 pb-3">
            {papelizInlineEditQuickActions.map(({ inlineEditQuickAction, quickActionLabel, QuickActionIcon }) => {
              const quickActionInstruction = describePapelizInlineEditQuickAction(inlineEditQuickAction)
              return (
                <button
                  key={inlineEditQuickAction}
                  type="button"
                  disabled={inlineEditStage === 'running'}
                  aria-pressed={inlineEditInstruction === quickActionInstruction}
                  onClick={() => void runInlineEdit(quickActionInstruction)}
                  className="papeliz-assistant-suggestion-chip"
                >
                  <QuickActionIcon className="size-3.5" aria-hidden="true" />
                  {quickActionLabel}
                </button>
              )
            })}
            <button type="button" className="papeliz-assistant-suggestion-chip" disabled={inlineEditStage === 'running'} onClick={() => startInlineMediaAction('imagine')}>
              <ImagePlus className="size-3.5" aria-hidden="true" />
              Imagine
            </button>
            <button type="button" className="papeliz-assistant-suggestion-chip" disabled={inlineEditStage === 'running'} onClick={() => startInlineMediaAction('transcribe')}>
              <Mic className="size-3.5" aria-hidden="true" />
              Transcribe
            </button>
            {isPictureInPassage && (
              <>
                <button type="button" className="papeliz-assistant-suggestion-chip" disabled={inlineEditStage === 'running'} onClick={() => startInlineMediaAction('describe-picture')}>
                  <ScanEye className="size-3.5" aria-hidden="true" />
                  Describe Picture
                </button>
                <button type="button" className="papeliz-assistant-suggestion-chip" disabled={inlineEditStage === 'running'} onClick={() => startInlineMediaAction('edit-picture')}>
                  <Paintbrush className="size-3.5" aria-hidden="true" />
                  Edit Picture
                </button>
              </>
            )}
            <button type="button" className="papeliz-assistant-suggestion-chip" onClick={askAboutPassageInPanel}>
              <MessageSquare className="size-3.5" aria-hidden="true" />
              Ask Assistant
            </button>
          </div>
          {inlineEditStage !== 'composing' && (
            <div className="border-t border-papeliz-line px-4 py-3 text-[15px] leading-relaxed" aria-live="polite">
              {inlineEditStage === 'failed' ? (
                <p role="alert" className="papeliz-selectable-text text-sm text-papeliz-diff-removed-ink">
                  {inlineEditProblem}
                </p>
              ) : (
                <PapelizTextDiffView textDiffParts={passageDiffParts} />
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-papeliz-line bg-papeliz-surface-soft px-3.5 py-2.5">
            <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" disabled={inlineEditStage !== 'review'} onClick={acceptInlineEdit}>
              <Check className="size-3.5" aria-hidden="true" /> Accept <span className="text-[11.5px] opacity-75">Ctrl ↵</span>
            </PapelizPillButton>
            <PapelizPillButton pillButtonSize="small" onClick={closeInlineEdit}>
              Reject <span className="text-[11.5px] opacity-75">Esc</span>
            </PapelizPillButton>
            <PapelizPillButton
              pillButtonSize="small"
              disabled={inlineEditStage === 'running' || inlineEditStage === 'composing'}
              onClick={() => void runInlineEdit(inlineEditInstruction)}
            >
              <RotateCw className="size-3.5" aria-hidden="true" /> Try Again
            </PapelizPillButton>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-papeliz-ink-subtle">
              <Lock className="size-3" aria-hidden="true" />
              {inlineEditStage === 'running' ? 'Writing…' : 'Only this passage goes to your provider'}
            </span>
          </div>
        </>
      )}
    </div>,
    inlineEditHostElement,
  )
}
