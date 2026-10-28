import { MessageSquare } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { isPapelizChatSessionNotePath } from './papeliz-assistant-chat-session-files'
import { usePapelizAssistantConversationStore } from './papeliz-assistant-conversation-store'
import { usePapelizAssistantInlineEditUsageFileWriteStore } from './papeliz-assistant-inline-edit-usage-file'
import { usePapelizAssistantPanelUiStore } from './papeliz-assistant-panel-ui-store'
import { formatPapelizAssistantTokenCountInFull, type PapelizAssistantTokenUsageTally } from './papeliz-assistant-token-usage'
import {
  readPapelizAssistantVaultTokenUsageRecords,
  summarizePapelizAssistantVaultTokenUsage,
  type PapelizAssistantVaultTokenUsageRecords,
} from './papeliz-assistant-vault-token-usage'

const papelizUsageViewSessionDateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function formatChatSessionUpdatedAt(chatSessionUpdatedAt: string): string {
  const chatSessionUpdatedDate = new Date(chatSessionUpdatedAt)
  return Number.isNaN(chatSessionUpdatedDate.getTime()) ? '' : papelizUsageViewSessionDateFormat.format(chatSessionUpdatedDate)
}

// "12,034 in · 2,210 out · 6 requests", with "about" in front when any figure is estimated.
function describeAssistantTokenUsageTally(assistantTokenUsageTally: PapelizAssistantTokenUsageTally, isAtLineStart: boolean): string {
  const tokenUsageDescription = [
    `${formatPapelizAssistantTokenCountInFull(assistantTokenUsageTally.assistantInputTokenCount)} in`,
    `${formatPapelizAssistantTokenCountInFull(assistantTokenUsageTally.assistantOutputTokenCount)} out`,
    `${formatPapelizAssistantTokenCountInFull(assistantTokenUsageTally.assistantRequestCount)} ${assistantTokenUsageTally.assistantRequestCount === 1 ? 'request' : 'requests'}`,
  ].join(' · ')
  if (!assistantTokenUsageTally.isAssistantTokenCountEstimated) return tokenUsageDescription
  return `${isAtLineStart ? 'About' : 'about'} ${tokenUsageDescription}`
}

function PapelizUsageViewSectionHeading({ children }: { children: ReactNode }) {
  return <h3 className="px-2 pb-1 text-[12px] font-semibold text-papeliz-ink-subtle">{children}</h3>
}

function PapelizUsageViewTotalRow({ usageTotalLabel, usageTotalCount, isUsageTotalEstimated }: { usageTotalLabel: string; usageTotalCount: number; isUsageTotalEstimated: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-2 py-1 text-sm">
      <dt className="text-papeliz-ink-muted">{usageTotalLabel}</dt>
      <dd className="font-semibold tabular-nums">
        {isUsageTotalEstimated && <span className="font-normal text-papeliz-ink-subtle">about </span>}
        {formatPapelizAssistantTokenCountInFull(usageTotalCount)}
      </dd>
    </div>
  )
}

// Usage: the tokens the assistant used in this vault, from the chat session notes (and the inline
// edits' file), per model and per chat. A chat opens in Chat, as from Sessions.
export function PapelizAssistantUsageView() {
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)
  const vaultTreeEntries = usePapelizWorkspaceStore((workspaceState) => workspaceState.vaultTreeEntries)
  const chatVaultId = usePapelizAssistantConversationStore((conversationState) => conversationState.chatVaultId)
  const liveChatSessionVaultNoteRelativePath = usePapelizAssistantConversationStore((conversationState) => conversationState.chatSessionVaultNoteRelativePath)
  const liveChatSessionTokenUsage = usePapelizAssistantConversationStore((conversationState) => conversationState.chatSessionTokenUsage)
  const openSavedChatSession = usePapelizAssistantConversationStore((conversationState) => conversationState.openSavedChatSession)
  const setAssistantPanelTab = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.setAssistantPanelTab)
  const inlineEditUsageFileWriteCount = usePapelizAssistantInlineEditUsageFileWriteStore((writeState) => writeState.inlineEditUsageFileWriteCount)
  const [vaultTokenUsageRecords, setVaultTokenUsageRecords] = useState<PapelizAssistantVaultTokenUsageRecords | null>(null)

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

  // Read again when another chat becomes the open one too, so the one left behind shows its last save.
  useEffect(() => {
    if (openVault === null) return
    let isTokenUsageReadStale = false
    const chatSessionVaultNoteRelativePaths = chatSessionVaultNoteRelativePathsKey.length === 0 ? [] : chatSessionVaultNoteRelativePathsKey.split('\n')
    void readPapelizAssistantVaultTokenUsageRecords(openVault, chatSessionVaultNoteRelativePaths).then((readVaultTokenUsageRecords) => {
      if (!isTokenUsageReadStale) setVaultTokenUsageRecords(readVaultTokenUsageRecords)
    })
    return () => {
      isTokenUsageReadStale = true
    }
  }, [openVault, chatSessionVaultNoteRelativePathsKey, liveChatSessionVaultNoteRelativePath, inlineEditUsageFileWriteCount])

  // The open chat's figures come from the conversation itself, which may be ahead of its note.
  const vaultTokenUsageSummary = useMemo(() => {
    if (vaultTokenUsageRecords === null || vaultTokenUsageRecords.papelizVaultId !== openVault?.papelizVaultId) return null
    const isLiveChatInThisVault = chatVaultId === vaultTokenUsageRecords.papelizVaultId && liveChatSessionVaultNoteRelativePath !== null
    return summarizePapelizAssistantVaultTokenUsage(
      vaultTokenUsageRecords.assistantUsageViewSessionRows.map((assistantUsageViewSessionRow) =>
        isLiveChatInThisVault && assistantUsageViewSessionRow.chatSessionVaultNoteRelativePath === liveChatSessionVaultNoteRelativePath
          ? { ...assistantUsageViewSessionRow, chatSessionTokenUsage: liveChatSessionTokenUsage }
          : assistantUsageViewSessionRow,
      ),
      vaultTokenUsageRecords.inlineEditModelTokenUsageTallies,
    )
  }, [vaultTokenUsageRecords, openVault, chatVaultId, liveChatSessionVaultNoteRelativePath, liveChatSessionTokenUsage])

  if (openVault === null) return <p className="px-[18px] py-4 text-sm text-papeliz-ink-subtle">Open a vault to see the assistant’s usage in it.</p>
  if (vaultTokenUsageSummary === null) return <p className="px-[18px] py-4 text-sm text-papeliz-ink-subtle">Reading usage…</p>

  const olderChatSessionsNotice =
    vaultTokenUsageSummary.chatSessionWithoutTokenUsageCount > 0 ? (
      <p className="px-2 pt-1 text-xs text-papeliz-ink-subtle">
        {vaultTokenUsageSummary.chatSessionWithoutTokenUsageCount === 1
          ? '1 saved chat has no usage recorded (saved before usage was kept), so it isn’t counted.'
          : `${vaultTokenUsageSummary.chatSessionWithoutTokenUsageCount} saved chats have no usage recorded (saved before usage was kept), so they aren’t counted.`}
      </p>
    ) : null
  const usageFiguresNotice = (
    <p className="px-2 text-xs leading-relaxed text-papeliz-ink-subtle">
      Figures are your provider’s own token counts, or estimates (marked “about”) where it gave none. Cost isn’t shown.
    </p>
  )

  if (vaultTokenUsageSummary.vaultTokenUsageTally.assistantRequestCount === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
        <p className="px-2 pt-1 text-sm text-papeliz-ink-subtle">No assistant usage in this vault yet.</p>
        {olderChatSessionsNotice}
        {usageFiguresNotice}
      </div>
    )
  }

  const { vaultTokenUsageTally, vaultModelTokenUsageTallies, inlineEditsTokenUsageTally, assistantUsageViewSessionRowsWithTokenUsage } = vaultTokenUsageSummary
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 py-3">
      <section aria-label="This vault">
        <PapelizUsageViewSectionHeading>This vault</PapelizUsageViewSectionHeading>
        <dl>
          <PapelizUsageViewTotalRow
            usageTotalLabel="Input tokens"
            usageTotalCount={vaultTokenUsageTally.assistantInputTokenCount}
            isUsageTotalEstimated={vaultTokenUsageTally.isAssistantTokenCountEstimated}
          />
          <PapelizUsageViewTotalRow
            usageTotalLabel="Output tokens"
            usageTotalCount={vaultTokenUsageTally.assistantOutputTokenCount}
            isUsageTotalEstimated={vaultTokenUsageTally.isAssistantTokenCountEstimated}
          />
          <PapelizUsageViewTotalRow usageTotalLabel="Requests" usageTotalCount={vaultTokenUsageTally.assistantRequestCount} isUsageTotalEstimated={false} />
        </dl>
      </section>

      <section aria-label="By model">
        <PapelizUsageViewSectionHeading>By model</PapelizUsageViewSectionHeading>
        <ul className="flex flex-col">
          {vaultModelTokenUsageTallies.map((modelTokenUsageTally) => (
            <li key={modelTokenUsageTally.providerModelName} className="px-2 py-1.5">
              <span className="block truncate text-sm font-medium">{modelTokenUsageTally.providerModelName}</span>
              <span className="block text-xs text-papeliz-ink-subtle tabular-nums">{describeAssistantTokenUsageTally(modelTokenUsageTally, true)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Chats">
        <PapelizUsageViewSectionHeading>Chats</PapelizUsageViewSectionHeading>
        {assistantUsageViewSessionRowsWithTokenUsage.length === 0 && <p className="px-2 py-1 text-sm text-papeliz-ink-subtle">No chats have recorded usage yet.</p>}
        <ul className="flex flex-col gap-px">
          {assistantUsageViewSessionRowsWithTokenUsage.map((assistantUsageViewSessionRow) => {
            const chatSessionUpdatedAtLabel = formatChatSessionUpdatedAt(assistantUsageViewSessionRow.chatSessionUpdatedAt)
            return (
              <li key={assistantUsageViewSessionRow.chatSessionVaultNoteRelativePath}>
                <button
                  type="button"
                  aria-current={assistantUsageViewSessionRow.chatSessionVaultNoteRelativePath === liveChatSessionVaultNoteRelativePath ? 'true' : undefined}
                  onClick={() => {
                    setAssistantPanelTab('chat')
                    void openSavedChatSession(assistantUsageViewSessionRow.chatSessionVaultNoteRelativePath)
                  }}
                  className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-papeliz-hover"
                >
                  <MessageSquare className="size-4 flex-none text-papeliz-ink-subtle" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {assistantUsageViewSessionRow.chatSessionTitle || getVaultNoteTitle(assistantUsageViewSessionRow.chatSessionVaultNoteRelativePath)}
                    </span>
                    <span className="block text-xs text-papeliz-ink-subtle tabular-nums">
                      {chatSessionUpdatedAtLabel.length > 0 && `${chatSessionUpdatedAtLabel} · `}
                      {describeAssistantTokenUsageTally(assistantUsageViewSessionRow.chatSessionTokenUsage.chatSessionTokenUsageTally, chatSessionUpdatedAtLabel.length === 0)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {olderChatSessionsNotice}
      </section>

      {inlineEditsTokenUsageTally.assistantRequestCount > 0 && (
        <section aria-label="Inline edits">
          <PapelizUsageViewSectionHeading>Inline edits</PapelizUsageViewSectionHeading>
          <p className="px-2 py-1 text-sm text-papeliz-ink-muted tabular-nums">{describeAssistantTokenUsageTally(inlineEditsTokenUsageTally, true)}</p>
        </section>
      )}

      {usageFiguresNotice}
    </div>
  )
}
