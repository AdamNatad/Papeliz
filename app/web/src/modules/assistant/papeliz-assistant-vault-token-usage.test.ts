import { describe, expect, it } from 'vitest'
import { PapelizInMemoryVaultAdapter } from '../vault/papeliz-in-memory-vault-adapter'
import { formatPapelizChatSessionFile } from './papeliz-assistant-chat-session-files'
import {
  papelizAssistantInlineEditUsageFileName,
  parsePapelizAssistantInlineEditUsageFile,
  recordPapelizInlineEditTokenUsageInVault,
} from './papeliz-assistant-inline-edit-usage-file'
import { addPapelizChatCompletionToChatSessionTokenUsage, papelizEmptyChatSessionTokenUsage } from './papeliz-assistant-token-usage'
import { readPapelizAssistantVaultTokenUsageRecords, summarizePapelizAssistantVaultTokenUsage } from './papeliz-assistant-vault-token-usage'

function formatTestChatSessionFile(papelizChatSessionId: string, chatSessionUpdatedAt: string, providerModelName: string, completionInputTokenCount: number) {
  return formatPapelizChatSessionFile({
    papelizChatSessionId,
    chatSessionTitle: `Chat ${papelizChatSessionId}`,
    chatSessionCreatedAt: chatSessionUpdatedAt,
    chatSessionUpdatedAt,
    chatSessionModelName: providerModelName,
    chatSessionMessages: [{ chatSessionMessageRole: 'user', chatSessionMessageText: 'Hi' }],
    chatSessionTokenUsage:
      completionInputTokenCount === 0
        ? papelizEmptyChatSessionTokenUsage
        : addPapelizChatCompletionToChatSessionTokenUsage(papelizEmptyChatSessionTokenUsage, providerModelName, {
            completionInputTokenCount,
            completionOutputTokenCount: 10,
            isCompletionTokenUsageEstimated: false,
          }),
  })
}

describe('the vault’s assistant usage', () => {
  it('adds inline edits up per model in the vault’s .papeliz folder', async () => {
    const vaultAdapter = new PapelizInMemoryVaultAdapter([])
    await Promise.all([
      recordPapelizInlineEditTokenUsageInVault(vaultAdapter, 'model-a', { completionInputTokenCount: 100, completionOutputTokenCount: 20, isCompletionTokenUsageEstimated: false }),
      recordPapelizInlineEditTokenUsageInVault(vaultAdapter, 'model-a', { completionInputTokenCount: 50, completionOutputTokenCount: 5, isCompletionTokenUsageEstimated: true }),
      recordPapelizInlineEditTokenUsageInVault(vaultAdapter, 'model-b', { completionInputTokenCount: 10, completionOutputTokenCount: 1, isCompletionTokenUsageEstimated: false }),
    ])
    expect(parsePapelizAssistantInlineEditUsageFile(await vaultAdapter.readPapelizVaultSettingsFile(papelizAssistantInlineEditUsageFileName))).toEqual([
      { providerModelName: 'model-a', assistantInputTokenCount: 150, assistantOutputTokenCount: 25, assistantRequestCount: 2, isAssistantTokenCountEstimated: true },
      { providerModelName: 'model-b', assistantInputTokenCount: 10, assistantOutputTokenCount: 1, assistantRequestCount: 1, isAssistantTokenCountEstimated: false },
    ])
    expect(parsePapelizAssistantInlineEditUsageFile('not json')).toEqual([])
    expect(parsePapelizAssistantInlineEditUsageFile(null)).toEqual([])
  })

  it('reads every chat note and the inline edits, newest chat first, and adds them up', async () => {
    const vaultAdapter = new PapelizInMemoryVaultAdapter([
      { vaultNoteRelativePath: 'Chat Sessions/2026-10-26 0900 Older.md', vaultNoteText: formatTestChatSessionFile('older', '2026-10-26T09:00:00.000Z', 'model-a', 1000) },
      { vaultNoteRelativePath: 'Chat Sessions/2026-10-27 0900 Newer.md', vaultNoteText: formatTestChatSessionFile('newer', '2026-10-27T09:00:00.000Z', 'model-b', 3000) },
      { vaultNoteRelativePath: 'Chat Sessions/2026-10-20 0900 Before usage.md', vaultNoteText: formatTestChatSessionFile('before', '2026-10-20T09:00:00.000Z', 'model-a', 0) },
      { vaultNoteRelativePath: 'Chat Sessions/Not a chat.md', vaultNoteText: '# Just a note' },
    ])
    await recordPapelizInlineEditTokenUsageInVault(vaultAdapter, 'model-a', { completionInputTokenCount: 100, completionOutputTokenCount: 20, isCompletionTokenUsageEstimated: false })
    const vaultTokenUsageRecords = await readPapelizAssistantVaultTokenUsageRecords(
      { papelizVaultId: 'usage-test-vault', papelizVaultDisplayName: 'Usage test', papelizVaultAdapter: vaultAdapter },
      (await vaultAdapter.listVaultTreeEntries()).filter((vaultTreeEntry) => vaultTreeEntry.vaultEntryKind === 'note').map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath),
    )
    expect(vaultTokenUsageRecords.assistantUsageViewSessionRows.map((sessionRow) => sessionRow.chatSessionTitle)).toEqual(['Chat newer', 'Chat older', 'Chat before'])

    const vaultTokenUsageSummary = summarizePapelizAssistantVaultTokenUsage(
      vaultTokenUsageRecords.assistantUsageViewSessionRows,
      vaultTokenUsageRecords.inlineEditModelTokenUsageTallies,
    )
    expect(vaultTokenUsageSummary.vaultTokenUsageTally).toEqual({
      assistantInputTokenCount: 4100,
      assistantOutputTokenCount: 40,
      assistantRequestCount: 3,
      isAssistantTokenCountEstimated: false,
    })
    expect(vaultTokenUsageSummary.vaultModelTokenUsageTallies.map((modelTally) => [modelTally.providerModelName, modelTally.assistantInputTokenCount])).toEqual([
      ['model-b', 3000],
      ['model-a', 1100],
    ])
    expect(vaultTokenUsageSummary.assistantUsageViewSessionRowsWithTokenUsage).toHaveLength(2)
    expect(vaultTokenUsageSummary.chatSessionWithoutTokenUsageCount).toBe(1)
    expect(vaultTokenUsageSummary.inlineEditsTokenUsageTally.assistantRequestCount).toBe(1)
  })
})
