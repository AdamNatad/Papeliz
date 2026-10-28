import { ArrowUp, FileText, Library, Square, TextSelect, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { PapelizIconButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { PapelizAssistantContextWindowGauge } from './papeliz-assistant-context-window-gauge'
import { usePapelizAssistantConversationStore } from './papeliz-assistant-conversation-store'
import { usePapelizAssistantPanelUiStore } from './papeliz-assistant-panel-ui-store'
import { findPapelizAssistantProviderPreset } from './papeliz-assistant-provider-presets'
import { usePapelizAssistantProviderSettingsStore } from './papeliz-assistant-provider-settings-store'

interface PapelizAssistantComposerProps {
  // `floating` is focus mode's large composer at the bottom of the note.
  composerPlacement: 'panel' | 'floating'
}

// Where the user writes to the assistant. Enter sends, Shift+Enter starts a new line. The chips
// show what the assistant will see (this note, or the vault) and which model answers; the gauge
// beside them shows how full that model's context window is.
export function PapelizAssistantComposer({ composerPlacement }: PapelizAssistantComposerProps) {
  const composerTextAreaRef = useRef<HTMLTextAreaElement>(null)
  const composerDraftText = usePapelizAssistantConversationStore((conversationState) => conversationState.composerDraftText)
  const isAssistantRunning = usePapelizAssistantConversationStore((conversationState) => conversationState.isAssistantRunning)
  const assistantContextMode = usePapelizAssistantConversationStore((conversationState) => conversationState.assistantContextMode)
  const pendingSelectionContext = usePapelizAssistantConversationStore((conversationState) => conversationState.pendingSelectionContext)
  const sendAssistantMessage = usePapelizAssistantConversationStore((conversationState) => conversationState.sendAssistantMessage)
  const stopAssistant = usePapelizAssistantConversationStore((conversationState) => conversationState.stopAssistant)
  const setComposerDraftText = usePapelizAssistantConversationStore((conversationState) => conversationState.setComposerDraftText)
  const setAssistantContextMode = usePapelizAssistantConversationStore((conversationState) => conversationState.setAssistantContextMode)
  const setPendingSelectionContext = usePapelizAssistantConversationStore((conversationState) => conversationState.setPendingSelectionContext)
  const activeVaultNoteRelativePath = usePapelizWorkspaceStore((workspaceState) => workspaceState.activeVaultNoteRelativePath)
  const activeAssistantProviderId = usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.activeAssistantProviderId)
  const activeProviderModelName = usePapelizAssistantProviderSettingsStore(
    (settingsState) => settingsState.providerSettingsByProviderId[settingsState.activeAssistantProviderId]?.providerModelName,
  )
  const composerFocusRequestCount = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.composerFocusRequestCount)
  const setProviderSettingsDialogOpen = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.setProviderSettingsDialogOpen)

  useEffect(() => {
    if (composerFocusRequestCount > 0) composerTextAreaRef.current?.focus()
  }, [composerFocusRequestCount])

  useEffect(() => {
    // The text area grows with what is typed, up to a few lines.
    const composerTextArea = composerTextAreaRef.current
    if (composerTextArea === null) return
    composerTextArea.style.height = 'auto'
    composerTextArea.style.height = `${Math.min(composerTextArea.scrollHeight, composerPlacement === 'floating' ? 200 : 160)}px`
  }, [composerDraftText, composerPlacement])

  const sendComposerDraft = () => {
    if (!isAssistantRunning) void sendAssistantMessage(composerDraftText)
  }
  const isNoteContextShown = assistantContextMode === 'active-note' && activeVaultNoteRelativePath !== null
  const providerChipLabel = activeProviderModelName ?? findPapelizAssistantProviderPreset(activeAssistantProviderId).providerPresetDisplayName

  return (
    <div
      className={joinPapelizClassNames(
        'rounded-3xl border border-papeliz-line bg-papeliz-surface pt-3 pr-3 pb-2.5 pl-4 shadow-papeliz-card transition-[border-color,box-shadow] duration-150 focus-within:border-papeliz-blue-line focus-within:shadow-[0_0_0_4px_var(--color-papeliz-blue-soft),var(--shadow-papeliz-card)]',
        composerPlacement === 'floating' && 'shadow-papeliz-pop',
      )}
    >
      {pendingSelectionContext !== null && (
        <div className="papeliz-pop-enter mb-2 flex items-start gap-2 rounded-2xl bg-papeliz-blue-soft px-3 py-2 text-[13px] text-papeliz-blue">
          <TextSelect className="mt-0.5 size-3.5 flex-none" aria-hidden="true" />
          <span className="line-clamp-2 min-w-0 flex-1 text-papeliz-ink-muted">
            <b className="font-semibold text-papeliz-blue">Selection · </b>
            {pendingSelectionContext.selectedText}
          </span>
          <PapelizIconButton iconButtonLabel="Remove the selection" iconButtonSize="extra-small" onClick={() => setPendingSelectionContext(null)}>
            <X className="size-3" aria-hidden="true" />
          </PapelizIconButton>
        </div>
      )}
      <textarea
        ref={composerTextAreaRef}
        rows={composerPlacement === 'floating' ? 2 : 2}
        value={composerDraftText}
        aria-label="Message the assistant"
        placeholder={isNoteContextShown ? 'Ask about this note, or ask for a change' : 'Ask about your notes'}
        onChange={(changeEvent) => setComposerDraftText(changeEvent.target.value)}
        onKeyDown={(keyboardEvent) => {
          if (keyboardEvent.key === 'Enter' && !keyboardEvent.shiftKey && !keyboardEvent.nativeEvent.isComposing) {
            keyboardEvent.preventDefault()
            sendComposerDraft()
          }
        }}
        className={joinPapelizClassNames(
          'block w-full resize-none bg-transparent text-papeliz-ink outline-none placeholder:text-papeliz-ink-subtle',
          composerPlacement === 'floating' ? 'text-[16px] leading-relaxed' : 'text-[15px] leading-normal',
        )}
      />
      <div className="mt-1.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setAssistantContextMode(assistantContextMode === 'active-note' ? 'whole-vault' : 'active-note')}
          title="What the assistant sees with your message. Click to switch."
          className="flex h-[30px] min-w-0 items-center gap-1.5 rounded-full bg-papeliz-surface-gray px-3 text-[13px] font-medium text-papeliz-ink transition-colors hover:bg-papeliz-surface-gray-hover"
        >
          {isNoteContextShown ? (
            <FileText className="size-3.5 flex-none text-papeliz-ink-muted" aria-hidden="true" />
          ) : (
            <Library className="size-3.5 flex-none text-papeliz-ink-muted" aria-hidden="true" />
          )}
          <span className="truncate">{isNoteContextShown ? getVaultNoteTitle(activeVaultNoteRelativePath) : 'Whole vault'}</span>
        </button>
        <button
          type="button"
          onClick={() => setProviderSettingsDialogOpen(true)}
          title="Provider and model. Click to change."
          className="flex h-[30px] min-w-0 items-center rounded-full bg-papeliz-surface-gray px-3 text-[13px] font-medium text-papeliz-ink-muted transition-colors hover:bg-papeliz-surface-gray-hover"
        >
          <span className="truncate">{providerChipLabel}</span>
        </button>
        <PapelizAssistantContextWindowGauge />
        {isAssistantRunning ? (
          <button
            type="button"
            aria-label="Stop"
            title="Stop"
            onClick={stopAssistant}
            className="ml-auto grid size-[34px] flex-none place-items-center rounded-full bg-papeliz-ink text-papeliz-surface transition-transform active:scale-90"
          >
            <Square className="size-3.5 fill-current" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Send"
            title="Send (Enter)"
            disabled={composerDraftText.trim().length === 0}
            onClick={sendComposerDraft}
            className="ml-auto grid size-[34px] flex-none place-items-center rounded-full bg-papeliz-gradient-start text-white transition-[transform,opacity,background-color] hover:brightness-95 active:scale-90 disabled:opacity-40"
          >
            <ArrowUp className="size-4" strokeWidth={2.4} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
