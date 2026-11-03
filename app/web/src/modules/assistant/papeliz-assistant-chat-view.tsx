import { FileSearch, FileText, Link2, Tags, WandSparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { isPapelizDesktopApp } from 'virtual:papeliz-desktop-platform-availability'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { usePapelizKeyBindingShortcutLabel } from '../workspace/papeliz-key-bindings-store'
import { selectActiveVaultMarkdownNoteRelativePath, usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import {
  isPapelizAssistantPlanChatEntry,
  papelizSuggestLinksRequestText,
  papelizSuggestTagsRequestText,
  usePapelizAssistantConversationStore,
  type PapelizAssistantChatEntry,
} from './papeliz-assistant-conversation-store'
import { PapelizAssistantChatImaginePictures } from './papeliz-assistant-chat-imagine-pictures'
import { PapelizAssistantMessageMarkdown } from './papeliz-assistant-message-markdown'
import { usePapelizAssistantPanelUiStore } from './papeliz-assistant-panel-ui-store'
import { PapelizAssistantPlanBuildStrip, PapelizAssistantPlanCard, PapelizAssistantPlanEmptyPage, PapelizAssistantPlanModeAnswerChips } from './papeliz-assistant-plan-card'
import { PapelizAssistantProposalCard } from './papeliz-assistant-proposal-card'
import { PapelizAssistantQuestionCard } from './papeliz-assistant-question-card'
import {
  getActivePapelizAssistantProviderConnection,
  papelizAssistantProviderNotChosenProblem,
  usePapelizAssistantProviderSettingsStore,
} from './papeliz-assistant-provider-settings-store'
import { usePapelizAssistantRunOptionsStore } from './papeliz-assistant-run-options-store'
import { PapelizAssistantReplyProviderModelLabel, PapelizAssistantToolActivityRow } from './papeliz-assistant-tool-activity-row'

// The Plan answers that aren't plans and end their answer (a question asked in Plan): Switch to Ask
// and Plan a Fix go under them. The answer running now gets them once it ends.
function findPlanModeFinalAnswerEntryIds(chatEntries: readonly PapelizAssistantChatEntry[], isAssistantRunning: boolean): ReadonlySet<string> {
  const planModeFinalAnswerEntryIds = new Set<string>()
  let candidateChatEntryId: string | null = null
  for (const chatEntry of chatEntries) {
    if (chatEntry.assistantPlanStepRun !== undefined) continue
    if (chatEntry.chatEntryKind === 'user-message') {
      if (candidateChatEntryId !== null) planModeFinalAnswerEntryIds.add(candidateChatEntryId)
      candidateChatEntryId = null
    } else if (chatEntry.chatEntryKind === 'assistant-message' && chatEntry.chatEntryText.trim().length > 0) {
      candidateChatEntryId =
        chatEntry.assistantMessageMode === 'plan' && chatEntry.assistantPlanDocument === undefined && !chatEntry.isChatEntryStreaming ? chatEntry.chatEntryId : null
    } else if (chatEntry.chatEntryKind === 'question' || chatEntry.chatEntryKind === 'proposal') {
      candidateChatEntryId = null
    }
  }
  if (candidateChatEntryId !== null && !isAssistantRunning) planModeFinalAnswerEntryIds.add(candidateChatEntryId)
  return planModeFinalAnswerEntryIds
}

function PapelizAssistantChatEntryView({ chatEntry, isPlanModeFinalAnswer }: { chatEntry: PapelizAssistantChatEntry; isPlanModeFinalAnswer: boolean }): ReactNode {
  const requestAssistantProviderSettingsPage = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.requestAssistantProviderSettingsPage)
  switch (chatEntry.chatEntryKind) {
    case 'user-message':
      return (
        <div className="papeliz-pop-enter flex flex-col items-end gap-1">
          {chatEntry.chatEntryContextLabel !== null && <span className="px-2 text-[11.5px] text-papeliz-ink-subtle">About {chatEntry.chatEntryContextLabel}</span>}
          {chatEntry.isSteeringMessage === true && (
            <span className="px-2 text-[11.5px] text-papeliz-ink-subtle" title="Sent while the assistant was answering; it reads this before its next step.">
              Steered
            </span>
          )}
          {(chatEntry.userMessageAttachments ?? []).length > 0 && (
            <ul aria-label="Sent files" className="flex max-w-[88%] flex-wrap justify-end gap-1.5">
              {(chatEntry.userMessageAttachments ?? []).map((sentAttachment) =>
                sentAttachment.attachmentImageDataUrl !== null ? (
                  <li key={sentAttachment.assistantAttachmentId}>
                    <img
                      src={sentAttachment.attachmentImageDataUrl}
                      alt={sentAttachment.attachmentFileName}
                      title={sentAttachment.attachmentFileName}
                      className="max-h-36 max-w-[200px] rounded-2xl border border-papeliz-line object-cover"
                    />
                  </li>
                ) : (
                  <li
                    key={sentAttachment.assistantAttachmentId}
                    className="flex h-8 max-w-[220px] items-center gap-1.5 rounded-xl border border-papeliz-line bg-papeliz-surface px-2.5 text-[12.5px]"
                  >
                    <FileText className="size-3.5 flex-none text-papeliz-ink-muted" aria-hidden="true" />
                    <span className="truncate">{sentAttachment.attachmentFileName}</span>
                  </li>
                ),
              )}
            </ul>
          )}
          {chatEntry.chatEntryText.length > 0 && (
            <div className="papeliz-selectable-text max-w-[88%] rounded-[20px] bg-papeliz-surface-gray px-3.5 py-2.5 text-sm whitespace-pre-wrap">{chatEntry.chatEntryText}</div>
          )}
        </div>
      )
    case 'assistant-message':
      if (isPapelizAssistantPlanChatEntry(chatEntry) && !chatEntry.isChatEntryStreaming) {
        return <PapelizAssistantPlanCard planEntry={chatEntry} planCardPlacement="conversation" />
      }
      // A reply that ended with nothing written (the request failed) shows only the notice after it.
      if (!chatEntry.isChatEntryStreaming && chatEntry.chatEntryText.length === 0) return null
      return (
        <div className="papeliz-pop-enter flex flex-col gap-3">
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-[13px] text-papeliz-ink-subtle">
              <span className="grid size-[22px] flex-none place-items-center rounded-full bg-linear-to-r from-papeliz-gradient-start to-papeliz-gradient-end text-white">
                <WandSparkles className="size-3" aria-hidden="true" />
              </span>
              <b className="font-semibold text-papeliz-ink">Assistant</b>
              <PapelizAssistantReplyProviderModelLabel replyProviderModel={chatEntry} />
              {chatEntry.isChatEntryStreaming && <span className="papeliz-saving-dot size-1.5 rounded-full bg-papeliz-blue" aria-label="Writing" />}
            </div>
            {chatEntry.chatEntryText.length === 0 ? (
              <p className="text-sm text-papeliz-ink-subtle">Thinking…</p>
            ) : (
              <PapelizAssistantMessageMarkdown assistantMessageText={chatEntry.chatEntryText} />
            )}
          </div>
          {isPlanModeFinalAnswer && <PapelizAssistantPlanModeAnswerChips />}
        </div>
      )
    case 'tool-activity':
      return <PapelizAssistantToolActivityRow chatEntry={chatEntry} />
    case 'imagine-pictures':
      return <PapelizAssistantChatImaginePictures chatImagineRunId={chatEntry.chatImagineRunId} imaginePromptText={chatEntry.imaginePromptText} />
    case 'proposal':
      return <PapelizAssistantProposalCard assistantProposalId={chatEntry.assistantProposalId} />
    case 'question':
      return <PapelizAssistantQuestionCard questionEntry={chatEntry} />
    case 'notice':
      return (
        <div
          role={chatEntry.isChatEntryError ? 'alert' : 'status'}
          className={joinPapelizClassNames(
            'papeliz-pop-enter papeliz-selectable-text rounded-2xl px-3.5 py-2.5 text-[13px]',
            chatEntry.isChatEntryError ? 'bg-papeliz-diff-removed text-papeliz-diff-removed-ink' : 'bg-papeliz-surface text-papeliz-ink-muted',
          )}
        >
          {chatEntry.chatEntryText}
          {chatEntry.isChatEntryError && (
            <button type="button" className="ml-2 font-semibold underline underline-offset-2" onClick={() => requestAssistantProviderSettingsPage()}>
              AI Provider
            </button>
          )}
        </div>
      )
  }
}

// The conversation: messages, what the assistant looked at, and its proposals. A plan shows as its
// card, with what Build does for each step drawn under that step rather than here; opened to full
// height, the card takes the whole page. Plan has an empty page of its own.
export function PapelizAssistantChatView() {
  const chatEntries = usePapelizAssistantConversationStore((conversationState) => conversationState.chatEntries)
  const fullHeightAssistantPlanChatEntryId = usePapelizAssistantConversationStore((conversationState) => conversationState.fullHeightAssistantPlanChatEntryId)
  const assistantProposalsById = usePapelizAssistantConversationStore((conversationState) => conversationState.assistantProposalsById)
  const isAssistantRunning = usePapelizAssistantConversationStore((conversationState) => conversationState.isAssistantRunning)
  const sendAssistantMessage = usePapelizAssistantConversationStore((conversationState) => conversationState.sendAssistantMessage)
  const acceptAllPendingAssistantProposals = usePapelizAssistantConversationStore((conversationState) => conversationState.acceptAllPendingAssistantProposals)
  const assistantMode = usePapelizAssistantRunOptionsStore((runOptionsState) => runOptionsState.assistantMode)
  usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.providerSettingsByProviderId)
  usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.activeAssistantProviderId)
  const activeVaultMarkdownNoteRelativePath = usePapelizWorkspaceStore(selectActiveVaultMarkdownNoteRelativePath)
  const chatScrollAreaRef = useRef<HTMLDivElement>(null)
  const pendingProposalCount = Object.values(assistantProposalsById).filter((assistantProposal) => assistantProposal.proposalStatus === 'pending').length
  const activeProviderConnection = getActivePapelizAssistantProviderConnection()
  const inlineEditShortcutLabel = usePapelizKeyBindingShortcutLabel('assistant-inline-edit')
  const planModeFinalAnswerEntryIds = useMemo(() => findPlanModeFinalAnswerEntryIds(chatEntries, isAssistantRunning), [chatEntries, isAssistantRunning])
  const fullHeightPlanEntry =
    fullHeightAssistantPlanChatEntryId === null
      ? null
      : (chatEntries.filter(isPapelizAssistantPlanChatEntry).find((chatEntry) => chatEntry.chatEntryId === fullHeightAssistantPlanChatEntryId) ?? null)

  useEffect(() => {
    const chatScrollArea = chatScrollAreaRef.current
    if (chatScrollArea !== null) chatScrollArea.scrollTo({ top: chatScrollArea.scrollHeight, behavior: 'smooth' })
  }, [chatEntries, fullHeightPlanEntry])

  if (fullHeightPlanEntry !== null) {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-2.5 pt-2.5 pb-2">
        <PapelizAssistantPlanCard planEntry={fullHeightPlanEntry} planCardPlacement="full-height" />
      </div>
    )
  }

  return (
    <div ref={chatScrollAreaRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-[18px] pt-4 pb-3">
      <PapelizAssistantPlanBuildStrip chatScrollAreaRef={chatScrollAreaRef} />
      {chatEntries.length === 0 && activeProviderConnection.providerConnectionOutcome !== 'ready' && (
        <div className="papeliz-pop-enter m-auto flex max-w-[300px] flex-col items-center gap-3 py-8 text-center">
          <span className="grid size-11 place-items-center rounded-full bg-papeliz-blue-soft text-papeliz-blue">
            <WandSparkles className="size-[18px]" aria-hidden="true" />
          </span>
          <h3 className="text-[17px] font-semibold">Set up the AI Assistant</h3>
          <p className="text-sm text-papeliz-ink-muted">
            {isPapelizDesktopApp
              ? 'Runs on your own API key, sent straight from this computer to the provider you pick.'
              : 'Runs on your own API key, sent straight from this browser to the provider you pick.'}
          </p>
          {/* Half set up: what is still missing ("Add your OpenAI API key."). */}
          {activeProviderConnection.providerSetupProblem !== papelizAssistantProviderNotChosenProblem && (
            <p className="text-[13px] font-medium text-papeliz-ink">{activeProviderConnection.providerSetupProblem}</p>
          )}
        </div>
      )}
      {chatEntries.length === 0 && activeProviderConnection.providerConnectionOutcome === 'ready' && assistantMode === 'plan' && <PapelizAssistantPlanEmptyPage />}
      {chatEntries.length === 0 && activeProviderConnection.providerConnectionOutcome === 'ready' && assistantMode !== 'plan' && (
        <div className="papeliz-pop-enter my-auto flex flex-col gap-3 py-6">
          <p className="text-sm text-papeliz-ink-muted">
            Ask about your notes, plan a change, or switch to Write: the assistant proposes edits as diffs, and nothing changes until you accept.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {activeVaultMarkdownNoteRelativePath !== null && (
              <button type="button" className="papeliz-assistant-suggestion-chip" onClick={() => void sendAssistantMessage('Summarize this note in a few bullet points.')}>
                <FileSearch className="size-3.5" aria-hidden="true" /> Summarize This Note
              </button>
            )}
            {activeVaultMarkdownNoteRelativePath !== null && (
              <button type="button" className="papeliz-assistant-suggestion-chip" onClick={() => void sendAssistantMessage('Which of my notes are related to this one, and how?')}>
                <Link2 className="size-3.5" aria-hidden="true" /> Related Notes
              </button>
            )}
            <button type="button" className="papeliz-assistant-suggestion-chip" onClick={() => void sendAssistantMessage(papelizSuggestLinksRequestText)}>
              <Link2 className="size-3.5" aria-hidden="true" /> Suggest Links
            </button>
            <button type="button" className="papeliz-assistant-suggestion-chip" onClick={() => void sendAssistantMessage(papelizSuggestTagsRequestText)}>
              <Tags className="size-3.5" aria-hidden="true" /> Suggest Tags
            </button>
          </div>
          <p className="text-xs text-papeliz-ink-subtle">Select text in a note and press {inlineEditShortcutLabel} to edit it in place.</p>
        </div>
      )}
      {chatEntries.map((chatEntry) =>
        chatEntry.assistantPlanStepRun === undefined ? (
          <PapelizAssistantChatEntryView key={chatEntry.chatEntryId} chatEntry={chatEntry} isPlanModeFinalAnswer={planModeFinalAnswerEntryIds.has(chatEntry.chatEntryId)} />
        ) : null,
      )}
      {pendingProposalCount > 1 && !isAssistantRunning && (
        <div className="papeliz-pop-enter sticky bottom-0 flex items-center gap-2 rounded-full border border-papeliz-blue-line bg-papeliz-surface px-3 py-1.5 shadow-papeliz-card">
          <span className="text-[13px] text-papeliz-ink-muted">{pendingProposalCount} changes waiting</span>
          <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" className="ml-auto" onClick={() => void acceptAllPendingAssistantProposals()}>
            Accept All
          </PapelizPillButton>
        </div>
      )}
    </div>
  )
}
