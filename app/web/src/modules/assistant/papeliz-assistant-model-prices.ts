import { create } from 'zustand'
import { papelizAssistantModelPricesSettingName, readPapelizUserSetting, writePapelizUserSetting } from '../settings/papeliz-user-settings'
import type { PapelizAssistantTokenUsageTally } from './papeliz-assistant-token-usage'

// What a model's tokens cost, for Usage. A request's cost is the provider's own figure where it
// gives one (OpenRouter does, on every answer). Otherwise it is worked out from the tokens and a
// price per million: one the user typed for that model, or Papeliz's own list below. Prices change,
// so the list says when it was checked, and any price can be typed over.

export interface PapelizAssistantModelPrice {
  inputUsdPerMillionTokens: number
  outputUsdPerMillionTokens: number
}

// When Papeliz's own prices were last checked against each provider's price page.
export const papelizAssistantBuiltInModelPricesCheckedOn = '2026-10-29'

// The same date as people read it: "Oct 29, 2026".
export const papelizAssistantBuiltInModelPricesCheckedOnLabel = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(
  new Date(`${papelizAssistantBuiltInModelPricesCheckedOn}T12:00:00`),
)

// A price per million tokens in dollars, without the sign: "0.10", "0.075", "4.00".
export function formatPapelizAssistantModelPricePerMillionTokens(usdPerMillionTokens: number): string {
  return usdPerMillionTokens.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

// Papeliz's own prices, in US dollars per million tokens, for prompts at each provider's standard
// size and tier. Discounts for cached input, and the higher prices some models charge for very long
// prompts, aren't counted. Models with no public price are left out.
export const papelizAssistantBuiltInModelPrices: Readonly<Record<string, PapelizAssistantModelPrice>> = {
  // The default provider's models.
  'muse-spark-1.3': { inputUsdPerMillionTokens: 1.25, outputUsdPerMillionTokens: 4.25 },
  'muse-spark-1.2': { inputUsdPerMillionTokens: 1.25, outputUsdPerMillionTokens: 4.25 },
  'muse-spark-1.1': { inputUsdPerMillionTokens: 1.25, outputUsdPerMillionTokens: 4.25 },
  'muse-spark-1.3-contributor': { inputUsdPerMillionTokens: 0.1, outputUsdPerMillionTokens: 0.2 },
  'muse-spark-1.2-contributor': { inputUsdPerMillionTokens: 0.1, outputUsdPerMillionTokens: 0.2 },
  'muse-wonder-1.0': { inputUsdPerMillionTokens: 4, outputUsdPerMillionTokens: 20 },
  // OpenAI.
  'gpt-6-astra': { inputUsdPerMillionTokens: 10, outputUsdPerMillionTokens: 50 },
  'gpt-6.1-sol': { inputUsdPerMillionTokens: 2, outputUsdPerMillionTokens: 10 },
  'gpt-6.1-terra': { inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 5 },
  'gpt-6-sol': { inputUsdPerMillionTokens: 2, outputUsdPerMillionTokens: 10 },
  'gpt-6-luna': { inputUsdPerMillionTokens: 0.1, outputUsdPerMillionTokens: 0.5 },
  // An offer price, said to last at least through November 21, 2026.
  'gpt-5.6-sol': { inputUsdPerMillionTokens: 4, outputUsdPerMillionTokens: 20 },
  'gpt-5.6-terra': { inputUsdPerMillionTokens: 2, outputUsdPerMillionTokens: 12 },
  'gpt-5.6-luna': { inputUsdPerMillionTokens: 0.2, outputUsdPerMillionTokens: 1.2 },
  'gpt-5.5': { inputUsdPerMillionTokens: 5, outputUsdPerMillionTokens: 30 },
  'gpt-5.4': { inputUsdPerMillionTokens: 2.5, outputUsdPerMillionTokens: 15 },
  'gpt-5.4-mini': { inputUsdPerMillionTokens: 0.75, outputUsdPerMillionTokens: 4.5 },
  'gpt-5.4-nano': { inputUsdPerMillionTokens: 0.2, outputUsdPerMillionTokens: 1.25 },
  'gpt-5.2': { inputUsdPerMillionTokens: 1.75, outputUsdPerMillionTokens: 14 },
  'gpt-5.1': { inputUsdPerMillionTokens: 1.25, outputUsdPerMillionTokens: 10 },
  'gpt-5': { inputUsdPerMillionTokens: 1.25, outputUsdPerMillionTokens: 10 },
  'gpt-5-mini': { inputUsdPerMillionTokens: 0.25, outputUsdPerMillionTokens: 2 },
  'gpt-5-nano': { inputUsdPerMillionTokens: 0.05, outputUsdPerMillionTokens: 0.4 },
  // Groq.
  'openai/gpt-oss-120b': { inputUsdPerMillionTokens: 0.15, outputUsdPerMillionTokens: 0.6 },
  'openai/gpt-oss-20b': { inputUsdPerMillionTokens: 0.075, outputUsdPerMillionTokens: 0.3 },
  'qwen/qwen3.8-27b': { inputUsdPerMillionTokens: 0.8, outputUsdPerMillionTokens: 4 },
}

export type PapelizAssistantModelPriceSource = 'typed-by-user' | 'papeliz-list'

// The price for a model, by its name as typed or after a provider's "vendor/" prefix: the user's
// own first, then Papeliz's. Null when neither has one.
export function findPapelizAssistantModelPrice(
  providerModelName: string,
  userModelPrices: Readonly<Record<string, PapelizAssistantModelPrice>>,
): { modelPrice: PapelizAssistantModelPrice; modelPriceSource: PapelizAssistantModelPriceSource } | null {
  const normalizedProviderModelName = providerModelName.trim().toLowerCase()
  const userModelPrice = userModelPrices[normalizedProviderModelName]
  if (userModelPrice !== undefined) return { modelPrice: userModelPrice, modelPriceSource: 'typed-by-user' }
  const unprefixedProviderModelName = normalizedProviderModelName.slice(normalizedProviderModelName.lastIndexOf('/') + 1)
  const builtInModelPrice =
    (Object.hasOwn(papelizAssistantBuiltInModelPrices, normalizedProviderModelName) ? papelizAssistantBuiltInModelPrices[normalizedProviderModelName] : undefined) ??
    (Object.hasOwn(papelizAssistantBuiltInModelPrices, unprefixedProviderModelName) ? papelizAssistantBuiltInModelPrices[unprefixedProviderModelName] : undefined)
  return builtInModelPrice === undefined ? null : { modelPrice: builtInModelPrice, modelPriceSource: 'papeliz-list' }
}

export type PapelizAssistantModelCostSource = 'provider-reported' | PapelizAssistantModelPriceSource

export interface PapelizAssistantModelCost {
  modelCostUsd: number
  modelCostSource: PapelizAssistantModelCostSource
}

// What one model's requests cost: the provider's own figure when it gave one for every request,
// or else the tokens at the model's price. Null when there is neither.
export function workOutPapelizAssistantModelCost(
  modelTokenUsageTally: PapelizAssistantTokenUsageTally,
  modelPrice: { modelPrice: PapelizAssistantModelPrice; modelPriceSource: PapelizAssistantModelPriceSource } | null,
): PapelizAssistantModelCost | null {
  const providerReportedCostRequestCount = modelTokenUsageTally.assistantProviderReportedCostRequestCount ?? 0
  if (providerReportedCostRequestCount > 0 && providerReportedCostRequestCount >= modelTokenUsageTally.assistantRequestCount) {
    return { modelCostUsd: modelTokenUsageTally.assistantProviderReportedCostUsd ?? 0, modelCostSource: 'provider-reported' }
  }
  if (modelPrice === null) return null
  return {
    modelCostUsd:
      (modelTokenUsageTally.assistantInputTokenCount * modelPrice.modelPrice.inputUsdPerMillionTokens +
        modelTokenUsageTally.assistantOutputTokenCount * modelPrice.modelPrice.outputUsdPerMillionTokens) /
      1_000_000,
    modelCostSource: modelPrice.modelPriceSource,
  }
}

// A cost in a few characters: "$0.61", "<$0.01", "$0.00".
export function formatPapelizAssistantCostUsd(costUsd: number): string {
  if (costUsd > 0 && costUsd < 0.01) return '<$0.01'
  return `$${costUsd.toFixed(2)}`
}

interface PapelizAssistantModelPricesState {
  // The prices the user typed, by model name in lower case.
  userModelPrices: Record<string, PapelizAssistantModelPrice>
  loadUserModelPrices: () => Promise<void>
  setUserModelPrice: (providerModelName: string, modelPrice: PapelizAssistantModelPrice | null) => void
}

function isStoredModelPrice(storedModelPrice: unknown): storedModelPrice is PapelizAssistantModelPrice {
  if (typeof storedModelPrice !== 'object' || storedModelPrice === null) return false
  const { inputUsdPerMillionTokens, outputUsdPerMillionTokens } = storedModelPrice as Record<string, unknown>
  return (
    typeof inputUsdPerMillionTokens === 'number' &&
    typeof outputUsdPerMillionTokens === 'number' &&
    inputUsdPerMillionTokens >= 0 &&
    outputUsdPerMillionTokens >= 0
  )
}

// The prices the user typed over Papeliz's own, kept in the browser's settings.
export const usePapelizAssistantModelPricesStore = create<PapelizAssistantModelPricesState>()((setModelPricesState, getModelPricesState) => ({
  userModelPrices: {},
  loadUserModelPrices: async () => {
    const storedUserModelPrices = await readPapelizUserSetting<Record<string, unknown> | null>(papelizAssistantModelPricesSettingName, null)
    const userModelPrices: Record<string, PapelizAssistantModelPrice> = {}
    for (const [providerModelName, storedModelPrice] of Object.entries(storedUserModelPrices ?? {})) {
      if (isStoredModelPrice(storedModelPrice)) userModelPrices[providerModelName] = storedModelPrice
    }
    setModelPricesState({ userModelPrices })
  },
  // A null price goes back to Papeliz's own.
  setUserModelPrice: (providerModelName, modelPrice) => {
    const normalizedProviderModelName = providerModelName.trim().toLowerCase()
    const userModelPrices = { ...getModelPricesState().userModelPrices }
    if (modelPrice === null) delete userModelPrices[normalizedProviderModelName]
    else userModelPrices[normalizedProviderModelName] = modelPrice
    setModelPricesState({ userModelPrices })
    void writePapelizUserSetting(papelizAssistantModelPricesSettingName, userModelPrices).catch(() => undefined)
  },
}))
