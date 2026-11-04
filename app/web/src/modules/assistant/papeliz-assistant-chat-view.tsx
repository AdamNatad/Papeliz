import { BookOpenText, ChevronRight, CircleAlert, FileSearch, FileText, Link2, Search, Tags, WandSparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { isPapelizDesktopApp } from 'virtual:papeliz-desktop-platform-availability'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizLoadingClock, usePapelizLoadingStartedAtMilliseconds } from '../ui/papeliz-loading-clock'
import { PapelizLoadingStepList } from '../ui/papeliz-loading-step-list'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
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

// While a reply is on its way: what it is doing, ticked off (waiting for the reply, then writing it),
// and how long it has taken so far. The composer's Stop ends it.
export function PapelizAssistantReplyLoadingSteps({ isReplyWriting }: { isReplyWriting: boolean }) {
  const replyStartedAtMilliseconds = usePapelizLoadingStartedAtMilliseconds()
  return (
    <div className="papeliz-assistant-reply-loading-steps" role="status" aria-label={isReplyWriting ? 'Writing the answer' : 'Waiting for the reply'}>
      <PapelizLoadingStepList
        loadingStepListFrame="bare"
        loadingSteps={[
          { loadingStepLabel: 'Waiting for the reply', loadingStepState: isReplyWriting ? 'done' : 'running' },
          { loadingStepLabel: 'Writing the answer', loadingStepState: isReplyWriting ? 'running' : 'waiting' },
        ]}
      />
      <p className="papeliz-assistant-reply-loading-clock-line">
        Working <PapelizLoadingClock loadingStartedAtMilliseconds={replyStartedAtMilliseconds} />
      </p>
    </div>
  )
}

type PapelizAssistantToolActivityChatEntry = Extract<PapelizAssistantChatEntry, { chatEntryKind: 'tool-activity' }>

// What the assistant looked at between two messages, as one line: "Read 1 note", "Looked at 3 notes",
// or the one step's own words. Pressed, it opens to each step, on a thin rule.
export function describePapelizAssistantToolActivityFold(toolActivityEntries: readonly PapelizAssistantToolActivityChatEntry[]): string {
  const lookedAtNoteCount = new Set(toolActivityEntries.flatMap((toolActivityEntry) => toolActivityEntry.toolActivityVaultNoteRelativePaths)).size
  const failedStepCount = toolActivityEntries.filter((toolActivityEntry) => toolActivityEntry.toolActivityKind === 'failed').length
  const noteCountWords = `${lookedAtNoteCount} ${lookedAtNoteCount === 1 ? 'note' : 'notes'}`
  const lookedAtWords =
    lookedAtNoteCount === 0
      ? toolActivityEntries.length === 1
        ? (toolActivityEntries[0]?.toolActivityLabel ?? '')
        : `${toolActivityEntries.length} steps`
      : toolActivityEntries.every((toolActivityEntry) => toolActivityEntry.toolActivityKind === 'read')
        ? `Read ${noteCountWords}`
        : `Looked at ${noteCountWords}`
  return failedStepCount === 0 || (toolActivityEntries.length === 1 && lookedAtNoteCount === 0) ? lookedAtWords : `${lookedAtWords} · ${failedStepCount} failed`
}

function PapelizAssistantToolActivityFold({ toolActivityEntries }: { toolActivityEntries: readonly PapelizAssistantToolActivityChatEntry[] }) {
  const [isToolActivityFoldOpen, setIsToolActivityFoldOpen] = useState(false)
  const hasFailedStep = toolActivityEntries.some((toolActivityEntry) => toolActivityEntry.toolActivityKind === 'failed')
  const isEveryStepARead = toolActivityEntries.every((toolActivityEntry) => toolActivityEntry.toolActivityKind === 'read')
  const ToolActivityFoldIcon = hasFailedStep ? CircleAlert : isEveryStepARead ? BookOpenText : Search
  return (
    <div className="papeliz-pop-enter flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={isToolActivityFoldOpen}
        title={toolActivityEntries.map((toolActivityEntry) => toolActivityEntry.toolActivityLabel).join('\n')}
        onClick={() => setIsToolActivityFoldOpen(!isToolActivityFoldOpen)}
        className={joinPapelizClassNames(
          'inline-flex w-fit max-w-full items-center gap-1.5 rounded-md text-left text-[12.5px] hover:text-papeliz-ink-muted',
          hasFailedStep ? 'text-papeliz-diff-removed-ink' : 'text-papeliz-ink-subtle',
        )}
      >
        <ToolActivityFoldIcon className="size-[13px] flex-none" aria-hidden="true" />
        <span className="min-w-0 truncate">{describePapelizAssistantToolActivityFold(toolActivityEntries)}</span>
        <ChevronRight className={joinPapelizClassNames('size-3 flex-none transition-transform duration-150', isToolActivityFoldOpen && 'rotate-90')} aria-hidden="true" />
      </button>
      {isToolActivityFoldOpen && (
        <div className="ml-1.5 flex flex-col gap-1 border-l border-papeliz-line pl-3">
          {toolActivityEntries.map((toolActivityEntry) => (
            <PapelizAssistantToolActivityRow key={toolActivityEntry.chatEntryId} chatEntry={toolActivityEntry} />
          ))}
        </div>
      )}
    </div>
  )
}

function PapelizAssistantChatEntryView({ chatEntry, isPlanModeFinalAnswer }: { chatEntry: PapelizAssistantChatEntry; isPlanModeFinalAnswer: boolean }): ReactNode {
  const requestAssistantProviderSettingsPage = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.requestAssistantProviderSettingsPage)
  const retryableAssistantErrorChatEntryId = usePapelizAssistantConversationStore((conversationState) => conversationState.retryableAssistantErrorChatEntryId)
  const retryAssistantAnswer = usePapelizAssistantConversationStore((conversationState) => conversationState.retryAssistantAnswer)
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
            <div className="papeliz-selectable-text max-w-[88%] rounded-[16px_16px_4px_16px] bg-papeliz-surface-soft px-[13px] py-[9px] text-sm whitespace-pre-wrap">{chatEntry.chatEntryText}</div>
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
            {/* "Assistant · model", one quiet line, with the dot while it writes. */}
            <div className="mb-1 flex min-w-0 items-center gap-1.5 text-[12.5px] text-papeliz-ink-subtle">
              <b className="font-semibold text-papeliz-ink-muted">Assistant</b>
              {chatEntry.assistantReplyProviderModelName !== undefined && (
                <span className="text-papeliz-line-strong" aria-hidden="true">
                  ·
                </span>
              )}
              <PapelizAssistantReplyProviderModelLabel replyProviderModel={chatEntry} />
            </div>
            {chatEntry.isChatEntryStreaming && <PapelizAssistantReplyLoadingSteps isReplyWriting={chatEntry.chatEntryText.length > 0} />}
            {chatEntry.chatEntryText.length > 0 && <PapelizAssistantMessageMarkdown assistantMessageText={chatEntry.chatEntryText} />}
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
      if (!chatEntry.isChatEntryError) {
        return (
          <p role="status" className="papeliz-pop-enter papeliz-selectable-text text-[13px] text-papeliz-ink-subtle">
            {chatEntry.chatEntryText}
          </p>
        )
      }
      // An error: one red line, with Retry while the answer can be asked again, and AI Provider.
      return (
        <div role="alert" className="papeliz-pop-enter flex flex-wrap items-start gap-x-2 gap-y-1 text-[13px] text-papeliz-diff-removed-ink">
          <CircleAlert className="mt-0.5 size-[15px] flex-none" aria-hidden="true" />
          <span className="papeliz-selectable-text min-w-0 flex-[1_1_180px]">{chatEntry.chatEntryText}</span>
          {/* The two stay together, at the right, when a narrow panel wraps them under the words. */}
          <span className="ml-auto flex flex-none gap-x-2">
            {chatEntry.chatEntryId === retryableAssistantErrorChatEntryId && (
              <button type="button" className="font-semibold text-papeliz-blue underline-offset-2 hover:underline" onClick={() => retryAssistantAnswer()}>
                Retry
              </button>
            )}
            <button type="button" className="font-semibold text-papeliz-blue underline-offset-2 hover:underline" onClick={() => requestAssistantProviderSettingsPage()}>
              AI Provider
            </button>
          </span>
        </div>
      )
  }
}

type PapelizAssistantConversationChatEntryGroup =
  | { chatEntryGroupKind: 'chat-entry'; chatEntry: PapelizAssistantChatEntry }
  | { chatEntryGroupKind: 'tool-activity-fold'; toolActivityEntries: PapelizAssistantToolActivityChatEntry[] }

// The conversation's entries as drawn: look-ups next to each other fold into one line, and a plan
// step's own entries stay under its step on the plan card.
export function groupPapelizAssistantConversationChatEntries(chatEntries: readonly PapelizAssistantChatEntry[]): PapelizAssistantConversationChatEntryGroup[] {
  const conversationChatEntryGroups: PapelizAssistantConversationChatEntryGroup[] = []
  for (const chatEntry of chatEntries) {
    if (chatEntry.assistantPlanStepRun !== undefined) continue
    const lastChatEntryGroup = conversationChatEntryGroups.at(-1)
    if (chatEntry.chatEntryKind !== 'tool-activity') conversationChatEntryGroups.push({ chatEntryGroupKind: 'chat-entry', chatEntry })
    else if (lastChatEntryGroup?.chatEntryGroupKind === 'tool-activity-fold') lastChatEntryGroup.toolActivityEntries.push(chatEntry)
    else conversationChatEntryGroups.push({ chatEntryGroupKind: 'tool-activity-fold', toolActivityEntries: [chatEntry] })
  }
  return conversationChatEntryGroups
}

// A suggestion on the empty panel: a quiet row, not a chip.
function PapelizAssistantEmptyPanelSuggestion({ SuggestionIcon, children, onSuggestionPick }: { SuggestionIcon: typeof Link2; children: ReactNode; onSuggestionPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onSuggestionPick}
      className="flex h-[34px] items-center gap-2 rounded-[10px] px-2 text-left text-[13.5px] text-papeliz-ink transition-colors hover:bg-papeliz-hover pointer-coarse:h-10"
    >
      <SuggestionIcon className="size-3.5 flex-none text-papeliz-ink-muted" aria-hidden="true" />
      {children}
    </button>
  )
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
  const conversationChatEntryGroups = useMemo(() => groupPapelizAssistantConversationChatEntries(chatEntries), [chatEntries])
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
    <div ref={chatScrollAreaRef} className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-[18px] pt-[18px] pb-3">
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
          <h3 className="text-[17px] font-semibold">
            {activeVaultMarkdownNoteRelativePath === null ? 'Ask about your notes' : `Ask about ${getVaultNoteTitle(activeVaultMarkdownNoteRelativePath)}`}
          </h3>
          <p className="-mt-1 text-sm text-papeliz-ink-muted">
            {activeVaultMarkdownNoteRelativePath === null ? '' : 'Or about your whole vault. '}Plan a change, or switch to Write: changes come as diffs, and nothing changes until you accept.
          </p>
          <div className="-mx-2 flex flex-col gap-0.5">
            {activeVaultMarkdownNoteRelativePath !== null && (
              <PapelizAssistantEmptyPanelSuggestion SuggestionIcon={FileSearch} onSuggestionPick={() => void sendAssistantMessage('Summarize this note in a few bullet points.')}>
                Summarize This Note
              </PapelizAssistantEmptyPanelSuggestion>
            )}
            {activeVaultMarkdownNoteRelativePath !== null && (
              <PapelizAssistantEmptyPanelSuggestion SuggestionIcon={Link2} onSuggestionPick={() => void sendAssistantMessage('Which of my notes are related to this one, and how?')}>
                Related Notes
              </PapelizAssistantEmptyPanelSuggestion>
            )}
            <PapelizAssistantEmptyPanelSuggestion SuggestionIcon={Link2} onSuggestionPick={() => void sendAssistantMessage(papelizSuggestLinksRequestText)}>
              Suggest Links
            </PapelizAssistantEmptyPanelSuggestion>
            <PapelizAssistantEmptyPanelSuggestion SuggestionIcon={Tags} onSuggestionPick={() => void sendAssistantMessage(papelizSuggestTagsRequestText)}>
              Suggest Tags
            </PapelizAssistantEmptyPanelSuggestion>
          </div>
          <p className="text-xs text-papeliz-ink-subtle">
            Select text in a note and press <kbd className="rounded-[5px] border border-papeliz-line-strong bg-papeliz-surface px-[5px] py-0.5 font-mono text-[11px] text-papeliz-ink-muted">{inlineEditShortcutLabel}</kbd> to edit it in place.
          </p>
        </div>
      )}
      {conversationChatEntryGroups.map((conversationChatEntryGroup) =>
        conversationChatEntryGroup.chatEntryGroupKind === 'tool-activity-fold' ? (
          <PapelizAssistantToolActivityFold key={conversationChatEntryGroup.toolActivityEntries[0]!.chatEntryId} toolActivityEntries={conversationChatEntryGroup.toolActivityEntries} />
        ) : (
          <PapelizAssistantChatEntryView
            key={conversationChatEntryGroup.chatEntry.chatEntryId}
            chatEntry={conversationChatEntryGroup.chatEntry}
            isPlanModeFinalAnswer={planModeFinalAnswerEntryIds.has(conversationChatEntryGroup.chatEntry.chatEntryId)}
          />
        ),
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
