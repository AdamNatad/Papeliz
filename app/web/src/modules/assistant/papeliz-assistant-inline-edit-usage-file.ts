import { create } from 'zustand'
import type { PapelizVaultAdapter } from '../vault/papeliz-vault-adapter'
import { addPapelizAssistantModelTokenUsageTally, tallyPapelizChatCompletionTokenUsage, type PapelizAssistantModelTokenUsageTally } from './papeliz-assistant-token-usage'
import type { PapelizChatCompletionTokenUsage } from './papeliz-openai-compatible-client'

// Inline edits (Ctrl+K) have no chat note to keep their token use in, so it is added up per model in
// the vault's `.papeliz/assistant-inline-edit-usage.json`, beside Papeliz's other files for the
// vault. It travels with the folder like the chat notes do. The file looks like this:
//
//   {
//     "about": "…",
//     "inlineEditTokenUsageByModel": [
//       { "providerModelName": "example-model", "assistantInputTokenCount": 1520, "assistantOutputTokenCount": 210,
//         "assistantRequestCount": 4, "isAssistantTokenCountEstimated": false }
//     ]
//   }

export const papelizAssistantInlineEditUsageFileName = 'assistant-inline-edit-usage.json'

export function formatPapelizAssistantInlineEditUsageFile(inlineEditModelTokenUsageTallies: readonly PapelizAssistantModelTokenUsageTally[]): string {
  const papelizInlineEditUsageFile = {
    about: 'Tokens Papeliz’s inline edits (Ctrl+K) used in this vault, per model: the provider’s own counts, or estimates where it gave none.',
    inlineEditTokenUsageByModel: inlineEditModelTokenUsageTallies,
  }
  return `${JSON.stringify(papelizInlineEditUsageFile, null, 2)}\n`
}

function readStoredTokenCount(storedTokenCount: unknown): number {
  return typeof storedTokenCount === 'number' && Number.isFinite(storedTokenCount) && storedTokenCount >= 0 ? Math.round(storedTokenCount) : 0
}

function readStoredCostUsd(storedCostUsd: unknown): number {
  return typeof storedCostUsd === 'number' && Number.isFinite(storedCostUsd) && storedCostUsd >= 0 ? storedCostUsd : 0
}

// Reads the file; anything it cannot read as usage counts as none.
export function parsePapelizAssistantInlineEditUsageFile(inlineEditUsageFileText: string | null): PapelizAssistantModelTokenUsageTally[] {
  if (inlineEditUsageFileText === null) return []
  let parsedInlineEditUsageFile: unknown
  try {
    parsedInlineEditUsageFile = JSON.parse(inlineEditUsageFileText)
  } catch {
    return []
  }
  const storedModelTokenUsageTallies = (parsedInlineEditUsageFile as { inlineEditTokenUsageByModel?: unknown } | null)?.inlineEditTokenUsageByModel
  if (!Array.isArray(storedModelTokenUsageTallies)) return []
  let inlineEditModelTokenUsageTallies: PapelizAssistantModelTokenUsageTally[] = []
  for (const storedModelTokenUsageTally of storedModelTokenUsageTallies as unknown[]) {
    if (typeof storedModelTokenUsageTally !== 'object' || storedModelTokenUsageTally === null) continue
    const storedTallyFields = storedModelTokenUsageTally as Record<string, unknown>
    inlineEditModelTokenUsageTallies = addPapelizAssistantModelTokenUsageTally(
      inlineEditModelTokenUsageTallies,
      typeof storedTallyFields['providerModelName'] === 'string' ? storedTallyFields['providerModelName'] : '',
      {
        assistantInputTokenCount: readStoredTokenCount(storedTallyFields['assistantInputTokenCount']),
        assistantOutputTokenCount: readStoredTokenCount(storedTallyFields['assistantOutputTokenCount']),
        assistantRequestCount: readStoredTokenCount(storedTallyFields['assistantRequestCount']),
        isAssistantTokenCountEstimated: storedTallyFields['isAssistantTokenCountEstimated'] === true,
        ...(readStoredTokenCount(storedTallyFields['assistantProviderReportedCostRequestCount']) > 0
          ? {
              assistantProviderReportedCostUsd: readStoredCostUsd(storedTallyFields['assistantProviderReportedCostUsd']),
              assistantProviderReportedCostRequestCount: readStoredTokenCount(storedTallyFields['assistantProviderReportedCostRequestCount']),
            }
          : {}),
      },
    )
  }
  return inlineEditModelTokenUsageTallies
}

// Bumped after each write, so an open Usage tab reads the file again.
export const usePapelizAssistantInlineEditUsageFileWriteStore = create<{ inlineEditUsageFileWriteCount: number }>()(() => ({ inlineEditUsageFileWriteCount: 0 }))

// One write after another, so two edits finishing together both count.
let inlineEditUsageFileWriteQueue: Promise<void> = Promise.resolve()

export function recordPapelizInlineEditTokenUsageInVault(
  papelizVaultAdapter: PapelizVaultAdapter,
  providerModelName: string,
  completionTokenUsage: PapelizChatCompletionTokenUsage,
  completionProviderReportedCostUsd: number | null = null,
): Promise<void> {
  const inlineEditUsageFileWrite = inlineEditUsageFileWriteQueue.then(async () => {
    // A file that cannot be read is left alone rather than replaced by this one edit.
    const inlineEditUsageFileText = await papelizVaultAdapter.readPapelizVaultSettingsFile(papelizAssistantInlineEditUsageFileName)
    const inlineEditModelTokenUsageTallies = addPapelizAssistantModelTokenUsageTally(
      parsePapelizAssistantInlineEditUsageFile(inlineEditUsageFileText),
      providerModelName,
      tallyPapelizChatCompletionTokenUsage(completionTokenUsage, completionProviderReportedCostUsd),
    )
    await papelizVaultAdapter.writePapelizVaultSettingsFile(papelizAssistantInlineEditUsageFileName, formatPapelizAssistantInlineEditUsageFile(inlineEditModelTokenUsageTallies))
    usePapelizAssistantInlineEditUsageFileWriteStore.setState((writeState) => ({ inlineEditUsageFileWriteCount: writeState.inlineEditUsageFileWriteCount + 1 }))
  })
  inlineEditUsageFileWriteQueue = inlineEditUsageFileWrite.catch(() => undefined)
  return inlineEditUsageFileWrite
}
