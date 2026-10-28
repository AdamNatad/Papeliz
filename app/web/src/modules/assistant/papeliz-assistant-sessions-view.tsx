import { MessagesSquare, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizConfirmDialog } from '../ui/papeliz-confirm-dialog'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { isPapelizChatSessionNotePath, papelizChatSessionsFolderName } from './papeliz-assistant-chat-session-files'
import { usePapelizAssistantConversationStore } from './papeliz-assistant-conversation-store'
import { usePapelizAssistantPanelUiStore } from './papeliz-assistant-panel-ui-store'
import { formatPapelizAssistantTokenCountShort } from './papeliz-assistant-token-usage'
import { readPapelizAssistantChatSessionRows, type PapelizAssistantUsageViewSessionRow } from './papeliz-assistant-vault-token-usage'

const papelizSessionTimeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const papelizSessionDayFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

// "Today", "Yesterday" or the date, for the heading over that day's chats.
function describeChatSessionDay(chatSessionUpdatedDate: Date, todayDate: Date): string {
  const startOfDay = (calendarDate: Date) => new Date(calendarDate.getFullYear(), calendarDate.getMonth(), calendarDate.getDate()).getTime()
  const daysAgo = Math.round((startOfDay(todayDate) - startOfDay(chatSessionUpdatedDate)) / 86_400_000)
  if (daysAgo === 0) return 'Today'
  if (daysAgo === 1) return 'Yesterday'
  return papelizSessionDayFormat.format(chatSessionUpdatedDate)
}

// "6 messages · 3.1k tokens", leaving out tokens a chat never recorded.
function describeChatSessionRow(chatSessionRow: PapelizAssistantUsageViewSessionRow): string {
  const chatSessionTokenUsageTally = chatSessionRow.chatSessionTokenUsage.chatSessionTokenUsageTally
  const chatSessionTokenCount = chatSessionTokenUsageTally.assistantInputTokenCount + chatSessionTokenUsageTally.assistantOutputTokenCount
  const chatSessionRowParts = [`${chatSessionRow.chatSessionMessageCount} ${chatSessionRow.chatSessionMessageCount === 1 ? 'message' : 'messages'}`]
  if (chatSessionTokenCount > 0) {
    chatSessionRowParts.push(`${chatSessionTokenUsageTally.isAssistantTokenCountEstimated ? 'about ' : ''}${formatPapelizAssistantTokenCountShort(chatSessionTokenCount)} tokens`)
  }
  return chatSessionRowParts.join(' · ')
}

// Sessions: every chat saved in this vault, newest first under its day, with a search. A click
// opens the chat in Chat. Each one is a note in the vault's hidden .csessions folder; Delete moves
// it to the vault's trash after a confirmation (the open chat gives way to a new one first).
export function PapelizAssistantSessionsView() {
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)
  const vaultTreeEntries = usePapelizWorkspaceStore((workspaceState) => workspaceState.vaultTreeEntries)
  const liveChatSessionVaultNoteRelativePath = usePapelizAssistantConversationStore((conversationState) => conversationState.chatSessionVaultNoteRelativePath)
  const isAssistantRunning = usePapelizAssistantConversationStore((conversationState) => conversationState.isAssistantRunning)
  const openSavedChatSession = usePapelizAssistantConversationStore((conversationState) => conversationState.openSavedChatSession)
  const startNewAssistantChat = usePapelizAssistantConversationStore((conversationState) => conversationState.startNewAssistantChat)
  const setAssistantPanelTab = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.setAssistantPanelTab)
  const moveVaultEntryToTrash = usePapelizWorkspaceStore((workspaceState) => workspaceState.moveVaultEntryToTrash)
  const [chatSessionAwaitingDelete, setChatSessionAwaitingDelete] = useState<{ chatSessionVaultNoteRelativePath: string; chatSessionTitle: string } | null>(null)
  const [chatSessionRowsRead, setChatSessionRowsRead] = useState<{ papelizVaultId: string; chatSessionRows: PapelizAssistantUsageViewSessionRow[] } | null>(null)
  const [chatSessionSearchText, setChatSessionSearchText] = useState('')

  // One string, so the notes are read again only when a chat note comes or goes.
  const chatSessionVaultNoteRelativePathsKey = useMemo(
    () =>
      vaultTreeEntries
        .filter((vaultTreeEntry) => vaultTreeEntry.vaultEntryKind === 'note' && isPapelizChatSessionNotePath(vaultTreeEntry.vaultEntryRelativePath))
        .map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath)
        .sort()
        .join('\n'),
    [vaultTreeEntries],
  )

  // Read again when another chat becomes the open one and when a reply finishes (the chat was saved).
  useEffect(() => {
    if (openVault === null || isAssistantRunning) return
    let isChatSessionReadStale = false
    const chatSessionVaultNoteRelativePaths = chatSessionVaultNoteRelativePathsKey.length === 0 ? [] : chatSessionVaultNoteRelativePathsKey.split('\n')
    void readPapelizAssistantChatSessionRows(openVault, chatSessionVaultNoteRelativePaths).then((chatSessionRows) => {
      if (!isChatSessionReadStale) setChatSessionRowsRead({ papelizVaultId: openVault.papelizVaultId, chatSessionRows })
    })
    return () => {
      isChatSessionReadStale = true
    }
  }, [openVault, chatSessionVaultNoteRelativePathsKey, liveChatSessionVaultNoteRelativePath, isAssistantRunning])

  const chatSessionDayGroups = useMemo(() => {
    if (chatSessionRowsRead === null || chatSessionRowsRead.papelizVaultId !== openVault?.papelizVaultId) return null
    const searchWords = chatSessionSearchText.trim().toLowerCase()
    const todayDate = new Date()
    const dayGroups: Array<{ chatSessionDayLabel: string; chatSessionRows: PapelizAssistantUsageViewSessionRow[] }> = []
    for (const chatSessionRow of chatSessionRowsRead.chatSessionRows) {
      const chatSessionTitle = chatSessionRow.chatSessionTitle || getVaultNoteTitle(chatSessionRow.chatSessionVaultNoteRelativePath)
      if (searchWords.length > 0 && !chatSessionTitle.toLowerCase().includes(searchWords)) continue
      const chatSessionUpdatedDate = new Date(chatSessionRow.chatSessionUpdatedAt)
      const chatSessionDayLabel = Number.isNaN(chatSessionUpdatedDate.getTime()) ? 'Earlier' : describeChatSessionDay(chatSessionUpdatedDate, todayDate)
      const lastDayGroup = dayGroups.at(-1)
      if (lastDayGroup?.chatSessionDayLabel === chatSessionDayLabel) lastDayGroup.chatSessionRows.push(chatSessionRow)
      else dayGroups.push({ chatSessionDayLabel, chatSessionRows: [chatSessionRow] })
    }
    return dayGroups
  }, [chatSessionRowsRead, openVault, chatSessionSearchText])

  if (openVault === null) return <p className="px-[18px] py-4 text-sm text-papeliz-ink-subtle">Open a vault to see its chat sessions.</p>

  const hasChatSessions = chatSessionRowsRead !== null && chatSessionRowsRead.chatSessionRows.length > 0
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {hasChatSessions && (
        <div className="flex-none px-3.5 pt-3">
          <label className="flex h-9 items-center gap-2 rounded-full border border-papeliz-line bg-papeliz-surface px-3.5 text-[13.5px] focus-within:border-papeliz-blue">
            <Search className="size-3.5 flex-none text-papeliz-ink-subtle" aria-hidden="true" />
            <input
              type="search"
              value={chatSessionSearchText}
              onChange={(changeEvent) => setChatSessionSearchText(changeEvent.target.value)}
              placeholder="Search chat sessions"
              aria-label="Search chat sessions"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-papeliz-ink-subtle"
            />
          </label>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-1 pb-3">
        {chatSessionDayGroups === null && <p className="px-2 py-3 text-sm text-papeliz-ink-subtle">Reading chat sessions…</p>}
        {chatSessionDayGroups !== null && !hasChatSessions && (
          <p className="px-2 py-3 text-sm text-papeliz-ink-subtle">No chat sessions yet. Each chat is saved here as you go.</p>
        )}
        {chatSessionDayGroups !== null && hasChatSessions && chatSessionDayGroups.length === 0 && (
          <p className="px-2 py-3 text-sm text-papeliz-ink-subtle">No chat session matches “{chatSessionSearchText.trim()}”.</p>
        )}
        {chatSessionDayGroups?.map(({ chatSessionDayLabel, chatSessionRows }) => (
          <section key={chatSessionDayLabel} aria-label={chatSessionDayLabel}>
            <h3 className="px-2 pt-3 pb-1 text-[12px] font-semibold text-papeliz-ink-subtle">{chatSessionDayLabel}</h3>
            <ul className="flex flex-col gap-px">
              {chatSessionRows.map((chatSessionRow) => {
                const isLiveChatSession = chatSessionRow.chatSessionVaultNoteRelativePath === liveChatSessionVaultNoteRelativePath
                const chatSessionUpdatedDate = new Date(chatSessionRow.chatSessionUpdatedAt)
                const chatSessionTitle = chatSessionRow.chatSessionTitle || getVaultNoteTitle(chatSessionRow.chatSessionVaultNoteRelativePath)
                // The chat being answered can't be deleted until the reply is done.
                const canDeleteChatSession = !(isAssistantRunning && isLiveChatSession)
                return (
                  <li key={chatSessionRow.chatSessionVaultNoteRelativePath} className="group/session-row relative">
                    <button
                      type="button"
                      aria-current={isLiveChatSession ? 'true' : undefined}
                      disabled={isAssistantRunning && !isLiveChatSession}
                      title={isAssistantRunning && !isLiveChatSession ? 'Wait for the reply to finish, or stop it, to open another chat' : undefined}
                      onClick={() => {
                        setAssistantPanelTab('chat')
                        if (!isLiveChatSession) void openSavedChatSession(chatSessionRow.chatSessionVaultNoteRelativePath)
                      }}
                      className={joinPapelizClassNames(
                        'flex w-full items-start gap-2.5 rounded-2xl px-3 py-2 text-left transition-colors disabled:opacity-50',
                        isLiveChatSession ? 'bg-papeliz-chosen-row-ground text-papeliz-chosen-row-ink' : 'hover:bg-papeliz-hover',
                      )}
                    >
                      <MessagesSquare
                        className={joinPapelizClassNames('mt-0.5 size-4 flex-none', isLiveChatSession ? 'text-papeliz-chosen-row-ink' : 'text-papeliz-ink-subtle')}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{chatSessionTitle}</span>
                        <span className="block truncate text-xs text-papeliz-ink-subtle tabular-nums">{describeChatSessionRow(chatSessionRow)}</span>
                      </span>
                      {/* The time gives way to Delete while the row is pointed at or focused. */}
                      {!Number.isNaN(chatSessionUpdatedDate.getTime()) && (
                        <time
                          dateTime={chatSessionRow.chatSessionUpdatedAt}
                          className={joinPapelizClassNames(
                            'flex-none pt-0.5 text-xs text-papeliz-ink-subtle tabular-nums',
                            canDeleteChatSession && 'group-focus-within/session-row:invisible group-hover/session-row:invisible',
                          )}
                        >
                          {papelizSessionTimeFormat.format(chatSessionUpdatedDate)}
                        </time>
                      )}
                    </button>
                    {canDeleteChatSession && (
                      <button
                        type="button"
                        aria-label={`Delete ${chatSessionTitle}`}
                        title="Delete this chat session"
                        onClick={() =>
                          setChatSessionAwaitingDelete({ chatSessionVaultNoteRelativePath: chatSessionRow.chatSessionVaultNoteRelativePath, chatSessionTitle })
                        }
                        className="absolute top-1.5 right-2 grid size-7 place-items-center rounded-full text-papeliz-ink-muted opacity-0 transition-[opacity,background-color,color] duration-150 group-focus-within/session-row:opacity-100 group-hover/session-row:opacity-100 hover:bg-papeliz-diff-removed hover:text-papeliz-diff-removed-ink focus-visible:opacity-100 max-md:opacity-100"
                      >
                        <Trash2 className="size-[15px]" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
      <p className="flex-none px-[18px] pb-3 text-xs text-papeliz-ink-subtle">
        Saved as notes in the vault’s hidden <code className="rounded bg-papeliz-surface-gray px-1 py-px text-[11.5px]">{papelizChatSessionsFolderName}</code> folder.
      </p>

      {chatSessionAwaitingDelete !== null && (
        <PapelizConfirmDialog
          confirmDialogTitle="Delete this chat session?"
          confirmDialogBody={
            <p>
              “{chatSessionAwaitingDelete.chatSessionTitle}” moves into this vault’s{' '}
              <code className="rounded-md bg-papeliz-surface-gray px-1.5 font-mono text-[13px]">.trash</code> folder, so nothing is erased. Its tokens leave
              the Usage totals.
              {chatSessionAwaitingDelete.chatSessionVaultNoteRelativePath === liveChatSessionVaultNoteRelativePath &&
                ' It is the chat open now, so a new chat starts in its place.'}
            </p>
          }
          confirmButtonLabel="Delete Session"
          onCancel={() => setChatSessionAwaitingDelete(null)}
          onConfirm={() => {
            const { chatSessionVaultNoteRelativePath } = chatSessionAwaitingDelete
            setChatSessionAwaitingDelete(null)
            // The open chat gives way first, so it isn't saved again into the note being deleted.
            if (chatSessionVaultNoteRelativePath === liveChatSessionVaultNoteRelativePath) startNewAssistantChat()
            void moveVaultEntryToTrash(chatSessionVaultNoteRelativePath)
          }}
        />
      )}
    </div>
  )
}
