import type { PapelizChatCompletionTokenUsage } from './papeliz-openai-compatible-client'

// How many tokens the assistant used. Each request's figures come from the provider's own count, or
// are estimated where it gave none (papeliz-openai-compatible-client.ts). Chat sessions keep theirs
// in their note's frontmatter (papeliz-assistant-chat-session-files.ts), inline edits in the vault's
// `.papeliz/` folder (papeliz-assistant-inline-edit-usage-file.ts), and the Usage tab adds them up.
// Where a provider says what a request cost (OpenRouter does), that is kept too; Usage works out
// the rest from a price list (papeliz-assistant-model-prices.ts).

export interface PapelizAssistantTokenUsageTally {
  assistantInputTokenCount: number
  assistantOutputTokenCount: number
  assistantRequestCount: number
  // True when any figure in the tally is estimated, so it is shown with "about".
  isAssistantTokenCountEstimated: boolean
  // What the provider itself said the requests cost, in US dollars, and for how many requests it
  // said so. Left out while it said nothing.
  assistantProviderReportedCostUsd?: number
  assistantProviderReportedCostRequestCount?: number
}

export interface PapelizAssistantModelTokenUsageTally extends PapelizAssistantTokenUsageTally {
  providerModelName: string
}

export const papelizEmptyAssistantTokenUsageTally: PapelizAssistantTokenUsageTally = {
  assistantInputTokenCount: 0,
  assistantOutputTokenCount: 0,
  assistantRequestCount: 0,
  isAssistantTokenCountEstimated: false,
}

// The name a tally is kept under when the model was not recorded.
export const papelizUnknownProviderModelName = 'unknown'

export function addPapelizAssistantTokenUsageTallies(
  firstTokenUsageTally: PapelizAssistantTokenUsageTally,
  secondTokenUsageTally: PapelizAssistantTokenUsageTally,
): PapelizAssistantTokenUsageTally {
  const providerReportedCostRequestCount =
    (firstTokenUsageTally.assistantProviderReportedCostRequestCount ?? 0) + (secondTokenUsageTally.assistantProviderReportedCostRequestCount ?? 0)
  return {
    assistantInputTokenCount: firstTokenUsageTally.assistantInputTokenCount + secondTokenUsageTally.assistantInputTokenCount,
    assistantOutputTokenCount: firstTokenUsageTally.assistantOutputTokenCount + secondTokenUsageTally.assistantOutputTokenCount,
    assistantRequestCount: firstTokenUsageTally.assistantRequestCount + secondTokenUsageTally.assistantRequestCount,
    isAssistantTokenCountEstimated: firstTokenUsageTally.isAssistantTokenCountEstimated || secondTokenUsageTally.isAssistantTokenCountEstimated,
    ...(providerReportedCostRequestCount > 0
      ? {
          assistantProviderReportedCostUsd: (firstTokenUsageTally.assistantProviderReportedCostUsd ?? 0) + (secondTokenUsageTally.assistantProviderReportedCostUsd ?? 0),
          assistantProviderReportedCostRequestCount: providerReportedCostRequestCount,
        }
      : {}),
  }
}

export function sumPapelizAssistantTokenUsageTallies(tokenUsageTallies: readonly PapelizAssistantTokenUsageTally[]): PapelizAssistantTokenUsageTally {
  return tokenUsageTallies.reduce(addPapelizAssistantTokenUsageTallies, papelizEmptyAssistantTokenUsageTally)
}

// One request's figures as a tally, with its cost when the provider said it.
export function tallyPapelizChatCompletionTokenUsage(
  completionTokenUsage: PapelizChatCompletionTokenUsage,
  completionProviderReportedCostUsd: number | null = null,
): PapelizAssistantTokenUsageTally {
  return {
    assistantInputTokenCount: completionTokenUsage.completionInputTokenCount,
    assistantOutputTokenCount: completionTokenUsage.completionOutputTokenCount,
    assistantRequestCount: 1,
    isAssistantTokenCountEstimated: completionTokenUsage.isCompletionTokenUsageEstimated,
    ...(completionProviderReportedCostUsd === null
      ? {}
      : { assistantProviderReportedCostUsd: completionProviderReportedCostUsd, assistantProviderReportedCostRequestCount: 1 }),
  }
}

// Adds a tally to its model's row, adding the row when the model is new. Rows keep the order the
// models were first used in.
export function addPapelizAssistantModelTokenUsageTally(
  modelTokenUsageTallies: readonly PapelizAssistantModelTokenUsageTally[],
  providerModelName: string,
  addedTokenUsageTally: PapelizAssistantTokenUsageTally,
): PapelizAssistantModelTokenUsageTally[] {
  const tallyProviderModelName = providerModelName.trim() || papelizUnknownProviderModelName
  if (!modelTokenUsageTallies.some((modelTokenUsageTally) => modelTokenUsageTally.providerModelName === tallyProviderModelName)) {
    return [...modelTokenUsageTallies, { ...addPapelizAssistantTokenUsageTallies(papelizEmptyAssistantTokenUsageTally, addedTokenUsageTally), providerModelName: tallyProviderModelName }]
  }
  return modelTokenUsageTallies.map((modelTokenUsageTally) =>
    modelTokenUsageTally.providerModelName === tallyProviderModelName
      ? { providerModelName: tallyProviderModelName, ...addPapelizAssistantTokenUsageTallies(modelTokenUsageTally, addedTokenUsageTally) }
      : modelTokenUsageTally,
  )
}

// Merges several lists of model rows into one, biggest use first.
export function mergePapelizAssistantModelTokenUsageTallies(
  modelTokenUsageTallyLists: ReadonlyArray<readonly PapelizAssistantModelTokenUsageTally[]>,
): PapelizAssistantModelTokenUsageTally[] {
  let mergedModelTokenUsageTallies: PapelizAssistantModelTokenUsageTally[] = []
  for (const modelTokenUsageTallies of modelTokenUsageTallyLists) {
    for (const modelTokenUsageTally of modelTokenUsageTallies) {
      mergedModelTokenUsageTallies = addPapelizAssistantModelTokenUsageTally(mergedModelTokenUsageTallies, modelTokenUsageTally.providerModelName, modelTokenUsageTally)
    }
  }
  const readTallyTokenCount = (modelTokenUsageTally: PapelizAssistantModelTokenUsageTally) =>
    modelTokenUsageTally.assistantInputTokenCount + modelTokenUsageTally.assistantOutputTokenCount
  return mergedModelTokenUsageTallies.sort((firstModelTally, secondModelTally) => readTallyTokenCount(secondModelTally) - readTallyTokenCount(firstModelTally))
}

// One chat session's use: its totals, the same split by model (the model can change mid-chat), and
// how full the context window was after the last request.
export interface PapelizChatSessionTokenUsage {
  chatSessionTokenUsageTally: PapelizAssistantTokenUsageTally
  chatSessionModelTokenUsageTallies: PapelizAssistantModelTokenUsageTally[]
  // The last request's input tokens plus its output: what the next request starts from.
  chatSessionContextTokenCount: number
  isChatSessionContextTokenCountEstimated: boolean
}

export const papelizEmptyChatSessionTokenUsage: PapelizChatSessionTokenUsage = {
  chatSessionTokenUsageTally: papelizEmptyAssistantTokenUsageTally,
  chatSessionModelTokenUsageTallies: [],
  chatSessionContextTokenCount: 0,
  isChatSessionContextTokenCountEstimated: false,
}

export function addPapelizChatCompletionToChatSessionTokenUsage(
  chatSessionTokenUsage: PapelizChatSessionTokenUsage,
  providerModelName: string,
  completionTokenUsage: PapelizChatCompletionTokenUsage,
  completionProviderReportedCostUsd: number | null = null,
): PapelizChatSessionTokenUsage {
  const completionTokenUsageTally = tallyPapelizChatCompletionTokenUsage(completionTokenUsage, completionProviderReportedCostUsd)
  return {
    chatSessionTokenUsageTally: addPapelizAssistantTokenUsageTallies(chatSessionTokenUsage.chatSessionTokenUsageTally, completionTokenUsageTally),
    chatSessionModelTokenUsageTallies: addPapelizAssistantModelTokenUsageTally(
      chatSessionTokenUsage.chatSessionModelTokenUsageTallies,
      providerModelName,
      completionTokenUsageTally,
    ),
    chatSessionContextTokenCount: completionTokenUsage.completionInputTokenCount + completionTokenUsage.completionOutputTokenCount,
    isChatSessionContextTokenCountEstimated: completionTokenUsage.isCompletionTokenUsageEstimated,
  }
}

function trimTrailingZeroDecimals(tokenCountInUnits: number, decimalDigits: number): string {
  return tokenCountInUnits.toFixed(decimalDigits).replace(/\.?0+$/, '')
}

// A token count in a few characters: "950", "12.4k", "128k", "1.05M".
export function formatPapelizAssistantTokenCountShort(assistantTokenCount: number): string {
  if (assistantTokenCount < 1000) return String(Math.round(assistantTokenCount))
  const tokenCountInThousands = assistantTokenCount / 1000
  if (tokenCountInThousands < 100) return `${trimTrailingZeroDecimals(tokenCountInThousands, 1)}k`
  if (Math.round(tokenCountInThousands) < 1000) return `${Math.round(tokenCountInThousands)}k`
  const tokenCountInMillions = assistantTokenCount / 1_000_000
  return `${trimTrailingZeroDecimals(tokenCountInMillions, tokenCountInMillions < 10 ? 2 : 1)}M`
}

const papelizAssistantTokenCountInFullFormat = new Intl.NumberFormat('en-US')

// A token count with every digit: "12,034".
export function formatPapelizAssistantTokenCountInFull(assistantTokenCount: number): string {
  return papelizAssistantTokenCountInFullFormat.format(assistantTokenCount)
}

// The context window gauge beside the model chip: how much of the model's context window the chat
// fills, colored amber from 80% and red from 95%. With no known window size it only says how many
// tokens the chat holds.
export type PapelizAssistantContextWindowFillLevel = 'roomy' | 'filling' | 'nearly-full'

export interface PapelizAssistantContextWindowGaugeReading {
  // Null when the model's context window size is not known.
  contextWindowFilledFraction: number | null
  contextWindowFillLevel: PapelizAssistantContextWindowFillLevel
  // "12.4k", or "~12.4k" when estimated.
  contextWindowGaugeShortLabel: string
  // "Context: 12.4k of 128k tokens (10%)", or "12.4k tokens in this chat".
  contextWindowGaugeDescription: string
}

export const papelizContextWindowFillingFraction = 0.8
export const papelizContextWindowNearlyFullFraction = 0.95

export function readPapelizAssistantContextWindowGauge(
  chatSessionContextTokenCount: number,
  isChatSessionContextTokenCountEstimated: boolean,
  modelContextWindowTokenCount: number | null,
): PapelizAssistantContextWindowGaugeReading {
  const shortContextTokenCount = formatPapelizAssistantTokenCountShort(chatSessionContextTokenCount)
  const contextWindowGaugeShortLabel = `${isChatSessionContextTokenCountEstimated ? '~' : ''}${shortContextTokenCount}`
  if (modelContextWindowTokenCount === null || modelContextWindowTokenCount <= 0) {
    return {
      contextWindowFilledFraction: null,
      contextWindowFillLevel: 'roomy',
      contextWindowGaugeShortLabel,
      contextWindowGaugeDescription: `${isChatSessionContextTokenCountEstimated ? 'About ' : ''}${shortContextTokenCount} tokens in this chat`,
    }
  }
  const contextWindowFilledFraction = chatSessionContextTokenCount / modelContextWindowTokenCount
  const filledPercentage = contextWindowFilledFraction * 100
  const filledPercentageLabel = filledPercentage > 0 && filledPercentage < 1 ? '<1%' : `${Math.round(filledPercentage)}%`
  return {
    contextWindowFilledFraction,
    contextWindowFillLevel:
      contextWindowFilledFraction >= papelizContextWindowNearlyFullFraction
        ? 'nearly-full'
        : contextWindowFilledFraction >= papelizContextWindowFillingFraction
          ? 'filling'
          : 'roomy',
    contextWindowGaugeShortLabel,
    contextWindowGaugeDescription: `Context: ${isChatSessionContextTokenCountEstimated ? 'about ' : ''}${shortContextTokenCount} of ${formatPapelizAssistantTokenCountShort(modelContextWindowTokenCount)} tokens (${filledPercentageLabel})`,
  }
}
