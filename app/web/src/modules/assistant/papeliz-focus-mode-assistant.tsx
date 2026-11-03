import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PapelizIconButton } from '../ui/papeliz-buttons'
import { isPapelizAssistantPlanChatEntry, usePapelizAssistantConversationStore } from './papeliz-assistant-conversation-store'
import { PapelizAssistantComposer } from './papeliz-assistant-composer'
import { PapelizAssistantMessageMarkdown } from './papeliz-assistant-message-markdown'
import { PapelizAssistantPlanCard, PapelizAssistantPlanModeAnswerChips } from './papeliz-assistant-plan-card'
import { PapelizAssistantProposalCard } from './papeliz-assistant-proposal-card'

// Focus mode keeps only the note on screen, with a large composer floating at the bottom. The
// latest answer rises above the composer and can be put away. A plan rises as the same plan card as in
// the panel, with what Build does under its steps, and builds from there.
export function PapelizFocusModeAssistant() {
  const chatEntries = usePapelizAssistantConversationStore((conversationState) => conversationState.chatEntries)
  const isAssistantRunning = usePapelizAssistantConversationStore((conversationState) => conversationState.isAssistantRunning)
  const [dismissedChatEntryCount, setDismissedChatEntryCount] = useState(chatEntries.length)
  const answerScrollAreaRef = useRef<HTMLDivElement>(null)

  // The latest exchange: everything after the last message the user sent (the messages Build sends
  // for a plan's steps don't count, so the plan stays in sight while it builds).
  const lastUserMessageIndex = chatEntries.findLastIndex((chatEntry) => chatEntry.chatEntryKind === 'user-message' && chatEntry.assistantPlanStepRun === undefined)
  const latestAnswerEntries = lastUserMessageIndex === -1 ? [] : chatEntries.slice(lastUserMessageIndex + 1).filter((chatEntry) => chatEntry.assistantPlanStepRun === undefined)
  const isLatestAnswerShown = lastUserMessageIndex !== -1 && chatEntries.length > dismissedChatEntryCount
  // A Plan answer that ends the exchange and isn't a plan: a question asked in Plan.
  const lastLatestAnswerEntry = latestAnswerEntries.findLast((chatEntry) => chatEntry.chatEntryKind === 'assistant-message' && chatEntry.chatEntryText.trim().length > 0)
  const isPlanModeAnswerFinal =
    !isAssistantRunning &&
    lastLatestAnswerEntry?.chatEntryKind === 'assistant-message' &&
    lastLatestAnswerEntry.assistantMessageMode === 'plan' &&
    lastLatestAnswerEntry.assistantPlanDocument === undefined &&
    !latestAnswerEntries.some((chatEntry) => chatEntry.chatEntryKind === 'question' || chatEntry.chatEntryKind === 'proposal')

  useEffect(() => {
    answerScrollAreaRef.current?.scrollTo({ top: answerScrollAreaRef.current.scrollHeight })
  }, [chatEntries])

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-4 pb-6">
      {isLatestAnswerShown && (
        <div className="papeliz-notice-enter pointer-events-auto relative w-full max-w-[720px] rounded-3xl border border-papeliz-line bg-papeliz-surface shadow-papeliz-pop">
          <PapelizIconButton
            iconButtonLabel="Put the Answer Away"
            iconButtonSize="small"
            className="absolute top-2.5 right-2.5"
            onClick={() => setDismissedChatEntryCount(chatEntries.length)}
          >
            <X className="size-4" aria-hidden="true" />
          </PapelizIconButton>
          <div ref={answerScrollAreaRef} className="flex max-h-[42vh] flex-col gap-3 overflow-y-auto px-5 py-4 pr-12">
            {latestAnswerEntries.length === 0 && isAssistantRunning && <p className="text-sm text-papeliz-ink-subtle">Thinking…</p>}
            {latestAnswerEntries.map((chatEntry) => {
              if (isPapelizAssistantPlanChatEntry(chatEntry) && !chatEntry.isChatEntryStreaming) {
                return <PapelizAssistantPlanCard key={chatEntry.chatEntryId} planEntry={chatEntry} planCardPlacement="focus" />
              }
              if (chatEntry.chatEntryKind === 'assistant-message' && chatEntry.chatEntryText.length > 0) {
                return <PapelizAssistantMessageMarkdown key={chatEntry.chatEntryId} assistantMessageText={chatEntry.chatEntryText} />
              }
              if (chatEntry.chatEntryKind === 'proposal') return <PapelizAssistantProposalCard key={chatEntry.chatEntryId} assistantProposalId={chatEntry.assistantProposalId} />
              if (chatEntry.chatEntryKind === 'notice') {
                return (
                  <p key={chatEntry.chatEntryId} className={chatEntry.isChatEntryError ? 'text-sm text-papeliz-diff-removed-ink' : 'text-sm text-papeliz-ink-muted'}>
                    {chatEntry.chatEntryText}
                  </p>
                )
              }
              if (chatEntry.chatEntryKind === 'tool-activity') {
                return (
                  <p key={chatEntry.chatEntryId} className="text-[12.5px] text-papeliz-ink-subtle">
                    {chatEntry.toolActivityLabel}
                  </p>
                )
              }
              return null
            })}
            {isPlanModeAnswerFinal && <PapelizAssistantPlanModeAnswerChips />}
          </div>
        </div>
      )}
      <div className="pointer-events-auto w-full max-w-[720px]">
        <PapelizAssistantComposer composerPlacement="floating" />
      </div>
    </div>
  )
}
