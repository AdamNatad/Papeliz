import { describe, expect, it } from 'vitest'
import { findPapelizAssistantModelContextWindowTokenCount } from './papeliz-assistant-provider-presets'
import {
  addPapelizChatCompletionToChatSessionTokenUsage,
  formatPapelizAssistantContextWindowTokenCountShort,
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

  it('says a window that is a power of two the way people do, and any other size as a count', () => {
    expect(formatPapelizAssistantContextWindowTokenCountShort(1_048_576)).toBe('1M')
    expect(formatPapelizAssistantContextWindowTokenCountShort(2_097_152)).toBe('2M')
    expect(formatPapelizAssistantContextWindowTokenCountShort(262_144)).toBe('256k')
    expect(formatPapelizAssistantContextWindowTokenCountShort(131_072)).toBe('128k')
    expect(formatPapelizAssistantContextWindowTokenCountShort(32_768)).toBe('32k')
    expect(formatPapelizAssistantContextWindowTokenCountShort(128_000)).toBe('128k')
    expect(formatPapelizAssistantContextWindowTokenCountShort(200_000)).toBe('200k')
    expect(formatPapelizAssistantContextWindowTokenCountShort(512)).toBe('512')
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
      contextWindowFilledPercentageLabel: '10%',
      contextWindowGaugeDescription: 'Context: 12.4k of 128k tokens (10%)',
    })
    expect(readPapelizAssistantContextWindowGauge(12_400, false, 1_048_576).contextWindowGaugeDescription).toBe('Context: 12.4k of 1M tokens (1%)')
    expect(readPapelizAssistantContextWindowGauge(0, false, 1_048_576).contextWindowGaugeDescription).toBe('Context: 0 of 1M tokens (0%)')
    expect(readPapelizAssistantContextWindowGauge(102_400, true, 128_000)).toMatchObject({
      contextWindowFillLevel: 'filling',
      contextWindowGaugeDescription: 'Context: about 102k of 128k tokens (80%)',
    })
    expect(readPapelizAssistantContextWindowGauge(121_600, false, 128_000).contextWindowFillLevel).toBe('nearly-full')
  })

  it('says the tokens used, and that the size is not known, when the model’s window size is not known', () => {
    expect(readPapelizAssistantContextWindowGauge(12_400, false, null)).toEqual({
      contextWindowFilledFraction: null,
      contextWindowFillLevel: 'roomy',
      contextWindowGaugeShortLabel: '12.4k',
      contextWindowFilledPercentageLabel: null,
      contextWindowGaugeDescription: 'Context: 12.4k tokens, window size not known',
    })
    expect(readPapelizAssistantContextWindowGauge(12_400, true, null).contextWindowGaugeDescription).toBe('Context: about 12.4k tokens, window size not known')
    expect(findPapelizAssistantModelContextWindowTokenCount('some-unlisted-model')).toBeNull()
    // Every Muse Spark version, Contributor ids too, has Meta's listed 1,048,576-token window.
    for (const metaModelName of ['muse-spark-1.3', 'muse-spark-1.3-contributor', 'muse-spark-1.2', 'muse-spark-1.2-contributor', 'muse-spark-1.1', 'meta/Muse-Spark-1.3']) {
      expect(findPapelizAssistantModelContextWindowTokenCount(metaModelName)).toBe(1_048_576)
    }
    expect(findPapelizAssistantModelContextWindowTokenCount('constructor')).toBeNull()
  })
})
