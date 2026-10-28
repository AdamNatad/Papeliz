import { ChartNoAxesColumn, Ellipsis, KeyRound, Link2, MessageSquare, MessagesSquare, SquarePen, Tags, WandSparkles, X } from 'lucide-react'
import { useState } from 'react'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
import { PapelizPopoverMenu, type PapelizPopoverMenuItem, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import { PapelizSlidingChoiceGroup } from '../ui/papeliz-sliding-choice-group'
import { PapelizAssistantChatView } from './papeliz-assistant-chat-view'
import { PapelizAssistantComposer } from './papeliz-assistant-composer'
import { papelizSuggestLinksRequestText, papelizSuggestTagsRequestText, usePapelizAssistantConversationStore } from './papeliz-assistant-conversation-store'
import { usePapelizAssistantPanelUiStore, type PapelizAssistantPanelTab } from './papeliz-assistant-panel-ui-store'
import { getActivePapelizAssistantProviderConnection, usePapelizAssistantProviderSettingsStore } from './papeliz-assistant-provider-settings-store'
import { PapelizAssistantSessionsView } from './papeliz-assistant-sessions-view'
import { PapelizAssistantUsageView } from './papeliz-assistant-usage-view'

interface PapelizAssistantPanelProps {
  onAssistantPanelClose: () => void
}

// The docked AI Assistant panel, for the AI only: Chat (the assistant on your own key), Sessions
// (every chat saved in this vault) and Usage (the tokens the assistant used here). The open note's
// Outline and Backlinks are under the file list, as This note. Until a provider is set up there is
// nothing to type into: the chat shows the setup card, and the suggestions are left out of More.
export function PapelizAssistantPanel({ onAssistantPanelClose }: PapelizAssistantPanelProps) {
  const assistantPanelTab = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.assistantPanelTab)
  const setAssistantPanelTab = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.setAssistantPanelTab)
  const setProviderSettingsDialogOpen = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.setProviderSettingsDialogOpen)
  const startNewAssistantChat = usePapelizAssistantConversationStore((conversationState) => conversationState.startNewAssistantChat)
  const sendAssistantMessage = usePapelizAssistantConversationStore((conversationState) => conversationState.sendAssistantMessage)
  const hasAssistantChatEntries = usePapelizAssistantConversationStore((conversationState) => conversationState.chatEntries.length > 0)
  // Read again whenever the provider or its settings change.
  usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.activeAssistantProviderId)
  usePapelizAssistantProviderSettingsStore((settingsState) => settingsState.providerSettingsByProviderId)
  const isAssistantProviderReady = getActivePapelizAssistantProviderConnection().providerConnectionOutcome === 'ready'
  const [assistantMenuPosition, setAssistantMenuPosition] = useState<PapelizPopoverMenuPosition | null>(null)

  const assistantSuggestionMenuItems: PapelizPopoverMenuItem[] = [
    {
      menuItemKey: 'suggest-links',
      menuItemLabel: 'Suggest links across notes',
      MenuItemIcon: Link2,
      onMenuItemSelect: () => {
        setAssistantPanelTab('chat')
        void sendAssistantMessage(papelizSuggestLinksRequestText)
      },
    },
    {
      menuItemKey: 'suggest-tags',
      menuItemLabel: 'Suggest tags',
      MenuItemIcon: Tags,
      onMenuItemSelect: () => {
        setAssistantPanelTab('chat')
        void sendAssistantMessage(papelizSuggestTagsRequestText)
      },
    },
  ]

  const assistantPanelTabs: ReadonlyArray<{
    assistantPanelTab: PapelizAssistantPanelTab
    assistantPanelTabLabel: string
    AssistantPanelTabIcon: typeof MessageSquare
  }> = [
    { assistantPanelTab: 'chat', assistantPanelTabLabel: 'Chat', AssistantPanelTabIcon: MessageSquare },
    { assistantPanelTab: 'sessions', assistantPanelTabLabel: 'Sessions', AssistantPanelTabIcon: MessagesSquare },
    { assistantPanelTab: 'usage', assistantPanelTabLabel: 'Usage', AssistantPanelTabIcon: ChartNoAxesColumn },
  ]

  return (
    <aside aria-label="AI Assistant" className="flex h-full min-h-0 flex-col bg-papeliz-surface-soft">
      <div className="flex h-10 flex-none items-center gap-2.5 bg-papeliz-tab-strip pt-1.5 pr-3 pl-[18px] shadow-[inset_0_-1px_0_var(--color-papeliz-line)]">
        <span className="grid size-[22px] flex-none place-items-center rounded-full bg-linear-to-r from-papeliz-gradient-start to-papeliz-gradient-end text-white">
          <WandSparkles className="size-3" aria-hidden="true" />
        </span>
        <h2 className="text-[15px] font-semibold">AI Assistant</h2>
        {/* New chat, More (the two suggestions, then Provider and API key, which the composer's
            model chip also opens) and Close. Earlier chats are in Sessions. */}
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
            iconButtonLabel="More assistant actions"
            iconButtonSize="small"
            aria-haspopup="menu"
            aria-expanded={assistantMenuPosition !== null}
            onClick={(clickEvent) => {
              const menuButtonRect = clickEvent.currentTarget.getBoundingClientRect()
              setAssistantMenuPosition({ menuAnchorLeft: menuButtonRect.right - 200, menuAnchorTop: menuButtonRect.bottom + 6 })
            }}
          >
            <Ellipsis className="size-[15px]" aria-hidden="true" />
          </PapelizIconButton>
          <PapelizIconButton iconButtonLabel="Close the AI Assistant panel" iconButtonSize="small" onClick={onAssistantPanelClose}>
            <X className="size-[15px]" aria-hidden="true" />
          </PapelizIconButton>
        </div>
      </div>

      {/* The tabs: a solid blue sliding switch, so the open tab stands out in both themes. They
          follow the panel's width: icon and label when wide, the label alone at the default width,
          and the icon alone (the label as its tooltip) when narrow. */}
      <div className="@container flex-none px-3.5 pt-2.5">
        <PapelizSlidingChoiceGroup
          slidingChoiceGroupLabel="AI Assistant panel"
          slidingChoiceGroupRole="tablist"
          slidingChoiceGroupTone="solid-blue"
          chosenSlidingChoiceValue={assistantPanelTab}
          onSlidingChoiceSelect={setAssistantPanelTab}
          slidingChoices={assistantPanelTabs.map(({ assistantPanelTab: tabValue, assistantPanelTabLabel, AssistantPanelTabIcon }) => ({
            slidingChoiceValue: tabValue,
            slidingChoiceTitle: assistantPanelTabLabel,
            slidingChoiceContent: (
              <>
                <AssistantPanelTabIcon className="hidden size-3.5 @max-[17.5rem]:block @min-[26rem]:block" aria-hidden="true" />
                <span className="truncate @max-[17.5rem]:sr-only">{assistantPanelTabLabel}</span>
              </>
            ),
          }))}
        />
      </div>

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

      {assistantMenuPosition !== null && (
        <PapelizPopoverMenu
          menuLabel="Assistant actions"
          menuPosition={assistantMenuPosition}
          onMenuClose={() => setAssistantMenuPosition(null)}
          menuItems={[
            ...(isAssistantProviderReady ? assistantSuggestionMenuItems : []),
            {
              menuItemKey: 'provider-settings',
              menuItemLabel: 'Provider and API key',
              MenuItemIcon: KeyRound,
              // A line sets the settings apart from the two suggestions.
              menuItemGroupHeading: ' ',
              onMenuItemSelect: () => setProviderSettingsDialogOpen(true),
            },
          ]}
        />
      )}
    </aside>
  )
}
