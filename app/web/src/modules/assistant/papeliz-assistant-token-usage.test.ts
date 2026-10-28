import { describe, expect, it } from 'vitest'
import { findPapelizAssistantModelContextWindowTokenCount } from './papeliz-assistant-provider-presets'
import {
  addPapelizChatCompletionToChatSessionTokenUsage,
  formatPapelizAssistantTokenCountShort,
  papelizEmptyChatSessionTokenUsage,
  readPapelizAssistantContextWindowGauge,
} from './papeliz-assistant-token-usage'

describe('assistant token usage', () => {
  it('shortens token counts for the gauge', () => {
    expect(formatPapelizAssistantTokenCountShort(950)).toBe('950')
    expect(formatPapelizAssistantTokenCountShort(12_400)).toBe('12.4k')
    expect(formatPapelizAssistantTokenCountShort(128_000)).toBe('128k')
    expect(formatPapelizAssistantTokenCountShort(999_700)).toBe('1M')
    expect(formatPapelizAssistantTokenCountShort(1_048_576)).toBe('1.05M')
  })

  it('adds each request to the chat, per model, and keeps the last request as the context', () => {
    const firstChatSessionTokenUsage = addPapelizChatCompletionToChatSessionTokenUsage(papelizEmptyChatSessionTokenUsage, 'model-a', {
      completionInputTokenCount: 1000,
      completionOutputTokenCount: 50,
      isCompletionTokenUsageEstimated: false,
    })
    const secondChatSessionTokenUsage = addPapelizChatCompletionToChatSessionTokenUsage(firstChatSessionTokenUsage, 'model-b', {
      completionInputTokenCount: 1200,
      completionOutputTokenCount: 30,
      isCompletionTokenUsageEstimated: true,
    })
    expect(secondChatSessionTokenUsage.chatSessionTokenUsageTally).toEqual({
      assistantInputTokenCount: 2200,
      assistantOutputTokenCount: 80,
      assistantRequestCount: 2,
      isAssistantTokenCountEstimated: true,
    })
    expect(secondChatSessionTokenUsage.chatSessionModelTokenUsageTallies.map((modelTally) => [modelTally.providerModelName, modelTally.isAssistantTokenCountEstimated])).toEqual([
      ['model-a', false],
      ['model-b', true],
    ])
    expect(secondChatSessionTokenUsage.chatSessionContextTokenCount).toBe(1230)
    expect(secondChatSessionTokenUsage.isChatSessionContextTokenCountEstimated).toBe(true)
  })

  it('reads the context window gauge against a known size, amber from 80% and red from 95%', () => {
    expect(readPapelizAssistantContextWindowGauge(12_400, false, 128_000)).toMatchObject({
      contextWindowFillLevel: 'roomy',
      contextWindowGaugeDescription: 'Context: 12.4k of 128k tokens (10%)',
    })
    expect(readPapelizAssistantContextWindowGauge(102_400, true, 128_000)).toMatchObject({
      contextWindowFillLevel: 'filling',
      contextWindowGaugeDescription: 'Context: about 102k of 128k tokens (80%)',
    })
    expect(readPapelizAssistantContextWindowGauge(121_600, false, 128_000).contextWindowFillLevel).toBe('nearly-full')
  })

  it('shows only the tokens used when the model’s window size is not known', () => {
    expect(readPapelizAssistantContextWindowGauge(12_400, false, null)).toEqual({
      contextWindowFilledFraction: null,
      contextWindowFillLevel: 'roomy',
      contextWindowGaugeShortLabel: '12.4k',
      contextWindowGaugeDescription: '12.4k tokens in this chat',
    })
    expect(readPapelizAssistantContextWindowGauge(12_400, true, null).contextWindowGaugeDescription).toBe('About 12.4k tokens in this chat')
    expect(findPapelizAssistantModelContextWindowTokenCount('some-unlisted-model')).toBeNull()
    expect(findPapelizAssistantModelContextWindowTokenCount('constructor')).toBeNull()
  })
})
