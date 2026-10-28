import { ArrowLeft, ChartNoAxesColumn, History, ListChecks, MessageCircleQuestion, PenLine, Settings, SquarePen, WandSparkles, X } from 'lucide-react'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
import { PapelizSlidingChoiceGroup } from '../ui/papeliz-sliding-choice-group'
import { PapelizAssistantChatView } from './papeliz-assistant-chat-view'
import { PapelizAssistantComposer } from './papeliz-assistant-composer'
import { usePapelizAssistantConversationStore } from './papeliz-assistant-conversation-store'
import { usePapelizAssistantPanelUiStore } from './papeliz-assistant-panel-ui-store'
import { getActivePapelizAssistantProviderConnection, usePapelizAssistantProviderSettingsStore } from './papeliz-assistant-provider-settings-store'
import { usePapelizAssistantRunOptionsStore, type PapelizAssistantMode } from './papeliz-assistant-run-options-store'
import { PapelizAssistantSessionsView } from './papeliz-assistant-sessions-view'
import { PapelizAssistantUsageView } from './papeliz-assistant-usage-view'

interface PapelizAssistantPanelProps {
  onAssistantPanelClose: () => void
}

const papelizAssistantModeChoices: ReadonlyArray<{
  assistantMode: PapelizAssistantMode
  assistantModeLabel: string
  AssistantModeIcon: typeof PenLine
}> = [
  { assistantMode: 'ask', assistantModeLabel: 'Ask', AssistantModeIcon: MessageCircleQuestion },
  { assistantMode: 'plan', assistantModeLabel: 'Plan', AssistantModeIcon: ListChecks },
  { assistantMode: 'write', assistantModeLabel: 'Write', AssistantModeIcon: PenLine },
]

// The line under the mode switch: what the mode does.
function describeAssistantModeHint(assistantMode: PapelizAssistantMode, isBypassPermissionOn: boolean): string {
  if (assistantMode === 'ask') return 'Ask about your notes. Nothing changes.'
  if (assistantMode === 'plan') return 'Turn an idea into a step-by-step plan. Nothing changes until you press Write It.'
  return isBypassPermissionOn ? 'Edits, adds and deletes notes. Bypass permission is on, so changes apply at once.' : 'Edits, adds and deletes notes. You review each change.'
}

// The docked AI Assistant panel, for the AI only. The chat answers in one of three modes, Ask, Plan
// and Write, picked in the switch at the top. Sessions (every chat saved in this vault) and Usage
// (the tokens and cost the assistant used here) open from the header, in place of the chat. The
// open note's Outline and Backlinks are under the file list, as This note. The gear opens the
// provider settings. Until a provider is set up there is nothing to type into: the chat shows the
// setup card.
export function PapelizAssistantPanel({ onAssistantPanelClose }: PapelizAssistantPanelProps) {
  const assistantPanelTab = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.assistantPanelTab)
  const setAssistantPanelTab = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.setAssistantPanelTab)
  const setProviderSettingsDialogOpen = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.setProviderSettingsDialogOpen)
  const startNewAssistantChat = usePapelizAssistantConversationStore((conversationState) => conversationState.startNewAssistantChat)
  const hasAssistantChatEntries = usePapelizAssistantConversationStore((conversationState) => conversationState.chatEntries.length > 0)
  const assistantMode = usePapelizAssistantRunOptionsStore((runOptionsState) => runOptionsState.assistantMode)
  const setAssistantMode = usePapelizAssistantRunOptionsStore((runOptionsState) => runOptionsState.setAssistantMode)
  const isBypassPermissionOn = usePapelizAssistantRunOptionsStore((runOptionsState) => runOptionsState.assistantChangePermission === 'bypass-permission')
  // Read again whenever the provider or its settings change.
  usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.activeAssistantProviderId)
  usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.providerSettingsByProviderId)
  const isAssistantProviderReady = getActivePapelizAssistantProviderConnection().providerConnectionOutcome === 'ready'

  // Sessions and Usage open in place of the chat; pressed again, they go back to it.
  const toggleAssistantPanelView = (assistantPanelView: 'sessions' | 'usage') =>
    setAssistantPanelTab(assistantPanelTab === assistantPanelView ? 'chat' : assistantPanelView)

  return (
    <aside aria-label="AI Assistant" className="flex h-full min-h-0 flex-col bg-papeliz-surface-soft">
      <div className="flex h-10 flex-none items-center gap-2.5 bg-papeliz-tab-strip pt-1.5 pr-3 pl-[18px] shadow-[inset_0_-1px_0_var(--color-papeliz-line)]">
        <span className="grid size-[22px] flex-none place-items-center rounded-full bg-linear-to-r from-papeliz-gradient-start to-papeliz-gradient-end text-white">
          <WandSparkles className="size-3" aria-hidden="true" />
        </span>
        <h2 className="text-[15px] font-semibold">AI Assistant</h2>
        {/* New chat, Sessions, Usage, Provider settings (which the composer's model chip also opens)
            and Close. */}
        <div className="ml-auto flex items-center gap-0.5">
          <PapelizIconButton
            iconButtonLabel="New chat"
            iconButtonSize="small"
            onClick={() => {
              startNewAssistantChat()
              setAssistantPanelTab('chat')
            }}
          >
            <SquarePen className="size-[15px]" aria-hidden="true" />
          </PapelizIconButton>
          <PapelizIconButton
            iconButtonLabel="Sessions"
            iconButtonSize="small"
            aria-pressed={assistantPanelTab === 'sessions'}
            onClick={() => toggleAssistantPanelView('sessions')}
          >
            <History className="size-[15px]" aria-hidden="true" />
          </PapelizIconButton>
          <PapelizIconButton iconButtonLabel="Usage" iconButtonSize="small" aria-pressed={assistantPanelTab === 'usage'} onClick={() => toggleAssistantPanelView('usage')}>
            <ChartNoAxesColumn className="size-[15px]" aria-hidden="true" />
          </PapelizIconButton>
          <PapelizIconButton iconButtonLabel="Provider settings" iconButtonSize="small" aria-haspopup="dialog" onClick={() => setProviderSettingsDialogOpen(true)}>
            <Settings className="size-[15px]" aria-hidden="true" />
          </PapelizIconButton>
          <PapelizIconButton iconButtonLabel="Close the AI Assistant panel" iconButtonSize="small" onClick={onAssistantPanelClose}>
            <X className="size-[15px]" aria-hidden="true" />
          </PapelizIconButton>
        </div>
      </div>

      {/* The modes: a solid blue sliding switch, so the chosen one stands out in both themes. They
          follow the panel's width: icon and label when wide, the label alone at the default width,
          and the icon alone (the label as its tooltip) when narrow. */}
      {assistantPanelTab === 'chat' && (
        <div className="@container flex-none px-3.5 pt-2.5">
          <PapelizSlidingChoiceGroup
            slidingChoiceGroupLabel="AI Assistant mode"
            slidingChoiceGroupRole="radiogroup"
            slidingChoiceGroupTone="solid-blue"
            chosenSlidingChoiceValue={assistantMode}
            onSlidingChoiceSelect={setAssistantMode}
            slidingChoices={papelizAssistantModeChoices.map(({ assistantMode: modeValue, assistantModeLabel, AssistantModeIcon }) => ({
              slidingChoiceValue: modeValue,
              slidingChoiceTitle: assistantModeLabel,
              slidingChoiceContent: (
                <>
                  <AssistantModeIcon className="hidden size-3.5 @max-[17.5rem]:block @min-[26rem]:block" aria-hidden="true" />
                  <span className="truncate @max-[17.5rem]:sr-only">{assistantModeLabel}</span>
                </>
              ),
            }))}
          />
          <p className="mt-1.5 px-1 text-[12px] leading-snug text-papeliz-ink-muted">{describeAssistantModeHint(assistantMode, isBypassPermissionOn)}</p>
        </div>
      )}
      {assistantPanelTab !== 'chat' && (
        <div className="flex flex-none items-center gap-1.5 px-2.5 pt-2">
          <PapelizIconButton iconButtonLabel="Back to the chat" iconButtonSize="small" onClick={() => setAssistantPanelTab('chat')}>
            <ArrowLeft className="size-[15px]" aria-hidden="true" />
          </PapelizIconButton>
          <h3 className="text-[14px] font-semibold">{assistantPanelTab === 'sessions' ? 'Sessions' : 'Usage'}</h3>
        </div>
      )}

      {assistantPanelTab === 'chat' && (
        <>
          <PapelizAssistantChatView />
          {isAssistantProviderReady ? (
            <div className="flex-none px-3.5 pb-2">
              <PapelizAssistantComposer composerPlacement="panel" />
            </div>
          ) : (
            // An earlier chat can still be read; the setup card is above it only when the chat is
            // empty, so the way to set up is here instead of a box to type in.
            hasAssistantChatEntries && (
              <div className="flex flex-none items-center gap-3 px-[18px] pb-2.5 text-[13px] text-papeliz-ink-muted">
                <span className="min-w-0 flex-1">Set up a provider to keep chatting.</span>
                <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" onClick={() => setProviderSettingsDialogOpen(true)}>
                  Choose a provider
                </PapelizPillButton>
              </div>
            )
          )}
        </>
      )}
      {assistantPanelTab === 'sessions' && <PapelizAssistantSessionsView />}
      {assistantPanelTab === 'usage' && <PapelizAssistantUsageView />}
    </aside>
  )
}
