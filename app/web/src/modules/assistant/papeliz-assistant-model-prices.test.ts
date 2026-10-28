import { describe, expect, it } from 'vitest'
import { formatPapelizChatSessionFile, parsePapelizChatSessionFile } from './papeliz-assistant-chat-session-files'
import { findPapelizAssistantModelPrice, formatPapelizAssistantCostUsd, workOutPapelizAssistantModelCost } from './papeliz-assistant-model-prices'
import { addPapelizChatCompletionToChatSessionTokenUsage, papelizEmptyChatSessionTokenUsage } from './papeliz-assistant-token-usage'

const oneRequestTokenUsage = { completionInputTokenCount: 1_000_000, completionOutputTokenCount: 100_000, isCompletionTokenUsageEstimated: false }

describe('what the assistant’s tokens cost', () => {
  it('finds a price by the model’s name, after a provider prefix, and the user’s price first', () => {
    expect(findPapelizAssistantModelPrice('muse-spark-1.3', {})?.modelPriceSource).toBe('papeliz-list')
    expect(findPapelizAssistantModelPrice('openai/GPT-5-mini', {})?.modelPrice).toEqual({ inputUsdPerMillionTokens: 0.25, outputUsdPerMillionTokens: 2 })
    expect(findPapelizAssistantModelPrice('my-local-model', {})).toBeNull()
    const userModelPrices = { 'muse-spark-1.3': { inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 2 } }
    expect(findPapelizAssistantModelPrice('Muse-Spark-1.3', userModelPrices)).toEqual({ modelPrice: userModelPrices['muse-spark-1.3'], modelPriceSource: 'typed-by-user' })
  })

  it('uses the provider’s own figure when it gave one for every request, or else the price', () => {
    const pricedTally = { assistantInputTokenCount: 1_000_000, assistantOutputTokenCount: 100_000, assistantRequestCount: 2, isAssistantTokenCountEstimated: false }
    expect(workOutPapelizAssistantModelCost(pricedTally, findPapelizAssistantModelPrice('muse-spark-1.3', {}))).toEqual({
      modelCostUsd: 1.25 + 0.425,
      modelCostSource: 'papeliz-list',
    })
    const reportedTally = { ...pricedTally, assistantProviderReportedCostUsd: 0.5, assistantProviderReportedCostRequestCount: 2 }
    expect(workOutPapelizAssistantModelCost(reportedTally, null)).toEqual({ modelCostUsd: 0.5, modelCostSource: 'provider-reported' })
    expect(workOutPapelizAssistantModelCost(pricedTally, null)).toBeNull()
    expect(formatPapelizAssistantCostUsd(0.004)).toBe('<$0.01')
    expect(formatPapelizAssistantCostUsd(1.675)).toBe('$1.68')
  })

  it('keeps the provider’s figure in the saved chat', () => {
    const chatSessionTokenUsage = addPapelizChatCompletionToChatSessionTokenUsage(papelizEmptyChatSessionTokenUsage, 'openrouter/model-a', oneRequestTokenUsage, 0.0123)
    const savedChatSession = parsePapelizChatSessionFile(
      formatPapelizChatSessionFile({
        papelizChatSessionId: 'priced',
        chatSessionTitle: 'Priced',
        chatSessionCreatedAt: '2026-10-29T01:00:00.000Z',
        chatSessionUpdatedAt: '2026-10-29T01:00:00.000Z',
        chatSessionModelName: 'openrouter/model-a',
        chatSessionMessages: [{ chatSessionMessageRole: 'user', chatSessionMessageText: 'Hi' }],
        chatSessionTokenUsage,
      }),
    )
    expect(savedChatSession?.chatSessionTokenUsage.chatSessionModelTokenUsageTallies[0]).toMatchObject({
      providerModelName: 'openrouter/model-a',
      assistantProviderReportedCostUsd: 0.0123,
      assistantProviderReportedCostRequestCount: 1,
    })
    expect(savedChatSession?.chatSessionTokenUsage.chatSessionTokenUsageTally.assistantProviderReportedCostUsd).toBe(0.0123)
  })
})
