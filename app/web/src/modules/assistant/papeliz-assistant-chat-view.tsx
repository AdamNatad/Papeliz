import { BookOpenText, Check, CircleAlert, FilePen, FileSearch, FileText, Link2, List, ListChecks, PenLine, Search, Tags, WandSparkles } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import { usePapelizKeyBindingShortcutLabel } from '../workspace/papeliz-key-bindings-store'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import {
  papelizSuggestLinksRequestText,
  papelizSuggestTagsRequestText,
  usePapelizAssistantConversationStore,
  type PapelizAssistantChatEntry,
} from './papeliz-assistant-conversation-store'
import { PapelizAssistantMessageMarkdown } from './papeliz-assistant-message-markdown'
import { usePapelizAssistantPanelUiStore } from './papeliz-assistant-panel-ui-store'
import { PapelizAssistantProposalCard } from './papeliz-assistant-proposal-card'
import { PapelizAssistantQuestionCard } from './papeliz-assistant-question-card'
import {
  getActivePapelizAssistantProviderConnection,
  papelizAssistantProviderNotChosenProblem,
  usePapelizAssistantProviderSettingsStore,
} from './papeliz-assistant-provider-settings-store'
import type { PapelizAssistantToolActivityKind } from './papeliz-assistant-vault-tools'

const papelizToolActivityIcons: Record<PapelizAssistantToolActivityKind, typeof Search> = {
  searched: Search,
  read: BookOpenText,
  'listed-links': Link2,
  'listed-notes': List,
  proposed: FilePen,
  failed: CircleAlert,
}

function PapelizAssistantToolActivityRow({ chatEntry }: { chatEntry: Extract<PapelizAssistantChatEntry, { chatEntryKind: 'tool-activity' }> }) {
  const openVaultNote = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVaultNote)
  const ToolActivityIcon = papelizToolActivityIcons[chatEntry.toolActivityKind]
  const shownVaultNoteRelativePaths = chatEntry.toolActivityVaultNoteRelativePaths.slice(0, 4)
  return (
    <div
      className={joinPapelizClassNames(
        'papeliz-pop-enter flex flex-wrap items-center gap-1.5 text-[12.5px] text-papeliz-ink-subtle',
        chatEntry.toolActivityKind === 'failed' && 'text-papeliz-diff-removed-ink',
      )}
    >
      <ToolActivityIcon className="size-3.5 flex-none" aria-hidden="true" />
      <span>{chatEntry.toolActivityLabel}</span>
      {shownVaultNoteRelativePaths.map((vaultNoteRelativePath) => (
        <button
          key={vaultNoteRelativePath}
          type="button"
          title={vaultNoteRelativePath}
          onClick={() => void openVaultNote(vaultNoteRelativePath)}
          className="rounded-full bg-papeliz-blue-soft px-2 py-0.5 font-medium text-papeliz-blue hover:bg-papeliz-blue-soft-hover"
        >
          {getVaultNoteTitle(vaultNoteRelativePath)}
        </button>
      ))}
      {chatEntry.toolActivityVaultNoteRelativePaths.length > shownVaultNoteRelativePaths.length && (
        <span>+{chatEntry.toolActivityVaultNoteRelativePaths.length - shownVaultNoteRelativePaths.length}</span>
      )}
    </div>
  )
}

// A plan written in Plan mode: Write It switches to Write and has the assistant carry it out; Save
// as Note keeps it as a note at the top of the vault.
function PapelizAssistantPlanCard({ planEntry }: { planEntry: Extract<PapelizAssistantChatEntry, { chatEntryKind: 'assistant-message' }> }) {
  const isAssistantRunning = usePapelizAssistantConversationStore((conversationState) => conversationState.isAssistantRunning)
  const carryOutAssistantPlan = usePapelizAssistantConversationStore((conversationState) => conversationState.carryOutAssistantPlan)
  const saveAssistantPlanAsNote = usePapelizAssistantConversationStore((conversationState) => conversationState.saveAssistantPlanAsNote)
  const openVaultNote = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVaultNote)
  const savedPlanVaultNoteRelativePath = planEntry.savedPlanVaultNoteRelativePath ?? null
  // The plan's `# ` title goes in the card's header; the steps below it.
  const planTitleMatch = /^\s*#\s+(.+)\n?/.exec(planEntry.chatEntryText)
  const planTitle = planTitleMatch?.[1]?.trim() ?? null
  const planStepsText = planTitleMatch === null ? planEntry.chatEntryText : planEntry.chatEntryText.slice(planTitleMatch[0].length)
  return (
    <div className="papeliz-pop-enter flex-none overflow-hidden rounded-[18px] border border-papeliz-line bg-papeliz-surface shadow-papeliz-card">
      <div className="flex items-center gap-2 border-b border-papeliz-line px-3.5 py-2.5 text-[13px] text-papeliz-ink-muted">
        <ListChecks className="size-4 flex-none text-papeliz-blue" aria-hidden="true" />
        <span className="min-w-0">
          Plan{planTitle !== null && <b className="font-semibold text-papeliz-ink"> · {planTitle}</b>}
        </span>
      </div>
      <div className="max-h-96 overflow-y-auto px-3.5 py-2.5">
        <PapelizAssistantMessageMarkdown assistantMessageText={planStepsText.trim()} />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-papeliz-line bg-papeliz-surface-soft px-3.5 py-2.5">
        <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" disabled={isAssistantRunning} onClick={() => carryOutAssistantPlan(planEntry.chatEntryId)}>
          <PenLine className="size-3.5" aria-hidden="true" />
          Write It
        </PapelizPillButton>
        {savedPlanVaultNoteRelativePath === null ? (
          <PapelizPillButton pillButtonVariant="line" pillButtonSize="small" onClick={() => void saveAssistantPlanAsNote(planEntry.chatEntryId)}>
            Save as Note
          </PapelizPillButton>
        ) : (
          <button
            type="button"
            onClick={() => void openVaultNote(savedPlanVaultNoteRelativePath)}
            className="flex items-center gap-1.5 text-[13px] font-medium text-papeliz-diff-added-ink hover:underline"
          >
            <Check className="size-3.5" aria-hidden="true" /> Saved as “{getVaultNoteTitle(savedPlanVaultNoteRelativePath)}”
          </button>
        )}
      </div>
    </div>
  )
}

function PapelizAssistantChatEntryView({ chatEntry }: { chatEntry: PapelizAssistantChatEntry }): ReactNode {
  const setProviderSettingsDialogOpen = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.setProviderSettingsDialogOpen)
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
      if (chatEntry.assistantMessageMode === 'plan' && !chatEntry.isChatEntryStreaming && chatEntry.chatEntryText.trim().length > 0) {
        return <PapelizAssistantPlanCard planEntry={chatEntry} />
      }
      // A reply that ended with nothing written (the request failed) shows only the notice after it.
      if (!chatEntry.isChatEntryStreaming && chatEntry.chatEntryText.length === 0) return null
      return (
        <div className="papeliz-pop-enter">
          <div className="mb-1.5 flex items-center gap-2 text-[13px] text-papeliz-ink-subtle">
            <span className="grid size-[22px] flex-none place-items-center rounded-full bg-linear-to-r from-papeliz-gradient-start to-papeliz-gradient-end text-white">
              <WandSparkles className="size-3" aria-hidden="true" />
            </span>
            <b className="font-semibold text-papeliz-ink">Assistant</b>
            {chatEntry.isChatEntryStreaming && <span className="papeliz-saving-dot size-1.5 rounded-full bg-papeliz-blue" aria-label="Writing" />}
          </div>
          {chatEntry.chatEntryText.length === 0 ? (
            <p className="text-sm text-papeliz-ink-subtle">Thinking…</p>
          ) : (
            <PapelizAssistantMessageMarkdown assistantMessageText={chatEntry.chatEntryText} />
          )}
        </div>
      )
    case 'tool-activity':
      return <PapelizAssistantToolActivityRow chatEntry={chatEntry} />
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
            <button type="button" className="ml-2 font-semibold underline underline-offset-2" onClick={() => setProviderSettingsDialogOpen(true)}>
              Provider settings
            </button>
          )}
        </div>
      )
  }
}

// The conversation: messages, what the assistant looked at, and its proposals.
export function PapelizAssistantChatView() {
  const chatEntries = usePapelizAssistantConversationStore((conversationState) => conversationState.chatEntries)
  const assistantProposalsById = usePapelizAssistantConversationStore((conversationState) => conversationState.assistantProposalsById)
  const isAssistantRunning = usePapelizAssistantConversationStore((conversationState) => conversationState.isAssistantRunning)
  const sendAssistantMessage = usePapelizAssistantConversationStore((conversationState) => conversationState.sendAssistantMessage)
  const acceptAllPendingAssistantProposals = usePapelizAssistantConversationStore((conversationState) => conversationState.acceptAllPendingAssistantProposals)
  const setProviderSettingsDialogOpen = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.setProviderSettingsDialogOpen)
  usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.providerSettingsByProviderId)
  const activeVaultNoteRelativePath = usePapelizWorkspaceStore((workspaceState) => workspaceState.activeVaultNoteRelativePath)
  const chatScrollAreaRef = useRef<HTMLDivElement>(null)
  const pendingProposalCount = Object.values(assistantProposalsById).filter((assistantProposal) => assistantProposal.proposalStatus === 'pending').length
  const activeProviderConnection = getActivePapelizAssistantProviderConnection()
  const inlineEditShortcutLabel = usePapelizKeyBindingShortcutLabel('assistant-inline-edit')

  useEffect(() => {
    const chatScrollArea = chatScrollAreaRef.current
    if (chatScrollArea !== null) chatScrollArea.scrollTo({ top: chatScrollArea.scrollHeight, behavior: 'smooth' })
  }, [chatEntries])

  return (
    <div ref={chatScrollAreaRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-[18px] pt-4 pb-3">
      {chatEntries.length === 0 && activeProviderConnection.providerConnectionOutcome !== 'ready' && (
        <div className="papeliz-pop-enter m-auto flex max-w-[300px] flex-col items-center gap-3 py-8 text-center">
          <span className="grid size-11 place-items-center rounded-full bg-papeliz-blue-soft text-papeliz-blue">
            <WandSparkles className="size-[18px]" aria-hidden="true" />
          </span>
          <h3 className="text-[17px] font-semibold">Set up the AI Assistant</h3>
          <p className="text-sm text-papeliz-ink-muted">Runs on your own API key, sent straight from this browser to the provider you pick.</p>
          {/* Half set up: what is still missing ("Add your OpenAI API key."). */}
          {activeProviderConnection.providerSetupProblem !== papelizAssistantProviderNotChosenProblem && (
            <p className="text-[13px] font-medium text-papeliz-ink">{activeProviderConnection.providerSetupProblem}</p>
          )}
          <PapelizPillButton pillButtonVariant="primary" onClick={() => setProviderSettingsDialogOpen(true)}>
            Choose a provider
          </PapelizPillButton>
        </div>
      )}
      {chatEntries.length === 0 && activeProviderConnection.providerConnectionOutcome === 'ready' && (
        <div className="papeliz-pop-enter my-auto flex flex-col gap-3 py-6">
          <p className="text-sm text-papeliz-ink-muted">
            Ask about your notes, plan a change, or switch to Write: the assistant proposes edits as diffs, and nothing changes until you accept.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {activeVaultNoteRelativePath !== null && (
              <button type="button" className="papeliz-assistant-suggestion-chip" onClick={() => void sendAssistantMessage('Summarize this note in a few bullet points.')}>
                <FileSearch className="size-3.5" aria-hidden="true" /> Summarize this note
              </button>
            )}
            {activeVaultNoteRelativePath !== null && (
              <button type="button" className="papeliz-assistant-suggestion-chip" onClick={() => void sendAssistantMessage('Which of my notes are related to this one, and how?')}>
                <Link2 className="size-3.5" aria-hidden="true" /> Related notes
              </button>
            )}
            <button type="button" className="papeliz-assistant-suggestion-chip" onClick={() => void sendAssistantMessage(papelizSuggestLinksRequestText)}>
              <Link2 className="size-3.5" aria-hidden="true" /> Suggest links
            </button>
            <button type="button" className="papeliz-assistant-suggestion-chip" onClick={() => void sendAssistantMessage(papelizSuggestTagsRequestText)}>
              <Tags className="size-3.5" aria-hidden="true" /> Suggest tags
            </button>
          </div>
          <p className="text-xs text-papeliz-ink-subtle">Select text in a note and press {inlineEditShortcutLabel} to edit it in place.</p>
        </div>
      )}
      {chatEntries.map((chatEntry) => (
        <PapelizAssistantChatEntryView key={chatEntry.chatEntryId} chatEntry={chatEntry} />
      ))}
      {pendingProposalCount > 1 && !isAssistantRunning && (
        <div className="papeliz-pop-enter sticky bottom-0 flex items-center gap-2 rounded-full border border-papeliz-blue-line bg-papeliz-surface px-3 py-1.5 shadow-papeliz-card">
          <span className="text-[13px] text-papeliz-ink-muted">{pendingProposalCount} changes waiting</span>
          <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" className="ml-auto" onClick={() => void acceptAllPendingAssistantProposals()}>
            Accept all
          </PapelizPillButton>
        </div>
      )}
    </div>
  )
}
