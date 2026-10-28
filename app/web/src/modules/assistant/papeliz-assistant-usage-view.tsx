import { MessageSquare } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { isPapelizChatSessionNotePath } from './papeliz-assistant-chat-session-files'
import { usePapelizAssistantConversationStore } from './papeliz-assistant-conversation-store'
import { usePapelizAssistantInlineEditUsageFileWriteStore } from './papeliz-assistant-inline-edit-usage-file'
import {
  findPapelizAssistantModelPrice,
  formatPapelizAssistantCostUsd,
  papelizAssistantBuiltInModelPricesCheckedOn,
  usePapelizAssistantModelPricesStore,
  workOutPapelizAssistantModelCost,
  type PapelizAssistantModelCost,
} from './papeliz-assistant-model-prices'
import { usePapelizAssistantPanelUiStore } from './papeliz-assistant-panel-ui-store'
import {
  formatPapelizAssistantTokenCountInFull,
  type PapelizAssistantModelTokenUsageTally,
  type PapelizAssistantTokenUsageTally,
} from './papeliz-assistant-token-usage'
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

const papelizBuiltInPricesCheckedOnLabel = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(
  new Date(`${papelizAssistantBuiltInModelPricesCheckedOn}T12:00:00`),
)

// Where a model's cost came from, in a few words.
function describeModelCostSource(modelCost: PapelizAssistantModelCost | null): string {
  if (modelCost === null) return 'No price'
  if (modelCost.modelCostSource === 'provider-reported') return 'Provider’s figure'
  if (modelCost.modelCostSource === 'typed-by-user') return 'Your price'
  return 'Papeliz price'
}

// What several models' requests cost together. Null when none of them has a cost; `isCostPartial`
// when some do and some don't, and `isCostEstimated` when any is worked out from a price.
function addUpModelCosts(modelCosts: ReadonlyArray<PapelizAssistantModelCost | null>): { costUsd: number; isCostEstimated: boolean; isCostPartial: boolean } | null {
  const knownModelCosts = modelCosts.filter((modelCost): modelCost is PapelizAssistantModelCost => modelCost !== null)
  if (knownModelCosts.length === 0) return null
  return {
    costUsd: knownModelCosts.reduce((costUsd, modelCost) => costUsd + modelCost.modelCostUsd, 0),
    isCostEstimated: knownModelCosts.some((modelCost) => modelCost.modelCostSource !== 'provider-reported'),
    isCostPartial: knownModelCosts.length < modelCosts.length,
  }
}

// "about $0.61", or "$0.61+" when some of it has no price.
function describeAddedUpCost(addedUpCost: { costUsd: number; isCostEstimated: boolean; isCostPartial: boolean }): string {
  return `${addedUpCost.isCostEstimated ? 'about ' : ''}${formatPapelizAssistantCostUsd(addedUpCost.costUsd)}${addedUpCost.isCostPartial ? '+' : ''}`
}

// One model under By model: its tokens, its cost and where the cost came from. Its price is set in
// Provider settings, under Advanced.
function PapelizUsageViewModelRow({ modelTokenUsageTally }: { modelTokenUsageTally: PapelizAssistantModelTokenUsageTally }) {
  const userModelPrices = usePapelizAssistantModelPricesStore((modelPricesState) => modelPricesState.userModelPrices)
  const modelCost = workOutPapelizAssistantModelCost(modelTokenUsageTally, findPapelizAssistantModelPrice(modelTokenUsageTally.providerModelName, userModelPrices))
  return (
    <li className="flex items-start gap-2 px-2 py-1.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{modelTokenUsageTally.providerModelName}</span>
        <span className="block text-xs text-papeliz-ink-subtle tabular-nums">{describeAssistantTokenUsageTally(modelTokenUsageTally, true)}</span>
      </span>
      <span className="flex-none text-right">
        <span className="block text-sm font-semibold tabular-nums">
          {modelCost === null ? '—' : `${modelCost.modelCostSource === 'provider-reported' ? '' : 'about '}${formatPapelizAssistantCostUsd(modelCost.modelCostUsd)}`}
        </span>
        <span className="block text-[11px] text-papeliz-ink-subtle">{describeModelCostSource(modelCost)}</span>
      </span>
    </li>
  )
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

// Usage: the tokens the assistant used in this vault, and what they cost, from the chat session notes
// (and the inline edits' file), per model and per chat. A chat opens in the chat, as from Sessions.
export function PapelizAssistantUsageView() {
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)
  const vaultTreeEntries = usePapelizWorkspaceStore((workspaceState) => workspaceState.vaultTreeEntries)
  const chatVaultId = usePapelizAssistantConversationStore((conversationState) => conversationState.chatVaultId)
  const liveChatSessionVaultNoteRelativePath = usePapelizAssistantConversationStore((conversationState) => conversationState.chatSessionVaultNoteRelativePath)
  const liveChatSessionTokenUsage = usePapelizAssistantConversationStore((conversationState) => conversationState.chatSessionTokenUsage)
  const openSavedChatSession = usePapelizAssistantConversationStore((conversationState) => conversationState.openSavedChatSession)
  const setAssistantPanelTab = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.setAssistantPanelTab)
  const inlineEditUsageFileWriteCount = usePapelizAssistantInlineEditUsageFileWriteStore((writeState) => writeState.inlineEditUsageFileWriteCount)
  const userModelPrices = usePapelizAssistantModelPricesStore((modelPricesState) => modelPricesState.userModelPrices)
  // What a list of model rows cost together, at today's prices.
  const addUpModelTokenUsageCosts = (modelTokenUsageTallies: readonly PapelizAssistantModelTokenUsageTally[]) =>
    addUpModelCosts(
      modelTokenUsageTallies.map((modelTokenUsageTally) =>
        workOutPapelizAssistantModelCost(modelTokenUsageTally, findPapelizAssistantModelPrice(modelTokenUsageTally.providerModelName, userModelPrices)),
      ),
    )
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
      Tokens are your provider’s own counts, or estimates (marked “about”) where it gave none. Cost is the provider’s own figure where it gives one;
      otherwise it is worked out from the tokens at Papeliz’s price for the model, from the provider’s own price page (checked{' '}
      {papelizBuiltInPricesCheckedOnLabel}), or at the price set in Provider settings, under Advanced. Cached-input discounts aren’t counted, so your
      provider’s bill is what counts.
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

  const { vaultTokenUsageTally, vaultModelTokenUsageTallies, inlineEditsTokenUsageTally, assistantUsageViewSessionRowsWithTokenUsage, inlineEditModelTokenUsageTallies } =
    vaultTokenUsageSummary
  const vaultAddedUpCost = addUpModelTokenUsageCosts(vaultModelTokenUsageTallies)
  const inlineEditsAddedUpCost = addUpModelTokenUsageCosts(inlineEditModelTokenUsageTallies)
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
          <div className="flex items-baseline justify-between gap-3 px-2 py-1 text-sm">
            <dt className="text-papeliz-ink-muted">Cost</dt>
            <dd className="font-semibold tabular-nums">
              {vaultAddedUpCost === null ? <span className="font-normal text-papeliz-ink-subtle">No prices yet</span> : describeAddedUpCost(vaultAddedUpCost)}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-label="By model">
        <PapelizUsageViewSectionHeading>By model</PapelizUsageViewSectionHeading>
        <ul className="flex flex-col">
          {vaultModelTokenUsageTallies.map((modelTokenUsageTally) => (
            <PapelizUsageViewModelRow key={modelTokenUsageTally.providerModelName} modelTokenUsageTally={modelTokenUsageTally} />
          ))}
        </ul>
      </section>

      <section aria-label="Chats">
        <PapelizUsageViewSectionHeading>Chats</PapelizUsageViewSectionHeading>
        {assistantUsageViewSessionRowsWithTokenUsage.length === 0 && <p className="px-2 py-1 text-sm text-papeliz-ink-subtle">No chats have recorded usage yet.</p>}
        <ul className="flex flex-col gap-px">
          {assistantUsageViewSessionRowsWithTokenUsage.map((assistantUsageViewSessionRow) => {
            const chatSessionUpdatedAtLabel = formatChatSessionUpdatedAt(assistantUsageViewSessionRow.chatSessionUpdatedAt)
            const chatSessionAddedUpCost = addUpModelTokenUsageCosts(assistantUsageViewSessionRow.chatSessionTokenUsage.chatSessionModelTokenUsageTallies)
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
                      {chatSessionAddedUpCost !== null && ` · ${describeAddedUpCost(chatSessionAddedUpCost)}`}
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
          <p className="px-2 py-1 text-sm text-papeliz-ink-muted tabular-nums">
            {describeAssistantTokenUsageTally(inlineEditsTokenUsageTally, true)}
            {inlineEditsAddedUpCost !== null && ` · ${describeAddedUpCost(inlineEditsAddedUpCost)}`}
          </p>
        </section>
      )}

      {usageFiguresNotice}
    </div>
  )
}
