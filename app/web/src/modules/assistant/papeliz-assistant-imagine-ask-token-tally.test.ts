import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePapelizImagineAskStore } from './papeliz-assistant-imagine-ask-store'
import { papelizEmptyChatSessionTokenUsage } from './papeliz-assistant-token-usage'
import { streamPapelizChatCompletion } from './papeliz-openai-compatible-client'

// Imagine's Ask tallies its tokens for the context ring in its box, as the notes chat does. The chat
// model is a stand-in, so no key or network is used.

vi.mock('./papeliz-openai-compatible-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./papeliz-openai-compatible-client')>()),
  streamPapelizChatCompletion: vi.fn(),
}))

vi.mock('./papeliz-assistant-provider-settings-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./papeliz-assistant-provider-settings-store')>()),
  getActivePapelizAssistantProviderConnection: () => ({
    providerConnectionOutcome: 'ready',
    providerConnection: { providerBaseUrl: 'https://papeliz-test-provider.invalid/v1/', providerApiKey: 'papeliz-test-key-not-a-real-key', providerModelName: 'muse-spark-1.3' },
    providerDisplayName: 'Meta Model API',
  }),
}))

function buildStandInCompletion(completionInputTokenCount: number, completionOutputTokenCount: number) {
  return {
    assistantText: 'Try soft dawn light.',
    assistantToolCalls: [],
    completionFinishReason: 'stop',
    completionTokenUsage: { completionInputTokenCount, completionOutputTokenCount, isCompletionTokenUsageEstimated: false },
    completionProviderReportedCostUsd: null,
    isReasoningEffortRefused: false,
  }
}

beforeEach(() => {
  vi.mocked(streamPapelizChatCompletion).mockReset()
  usePapelizImagineAskStore.setState({ imagineAskDraftText: '', imagineAskEntries: [], imagineAskTokenUsage: papelizEmptyChatSessionTokenUsage })
})

describe('Ask’s token tally', () => {
  it('adds each answer’s tokens, and keeps the last request as how full the window is', async () => {
    vi.mocked(streamPapelizChatCompletion).mockResolvedValueOnce(buildStandInCompletion(400, 60)).mockResolvedValueOnce(buildStandInCompletion(900, 40))
    usePapelizImagineAskStore.setState({ imagineAskDraftText: 'What light suits a lighthouse?' })
    await usePapelizImagineAskStore.getState().sendImagineAskQuestion()
    usePapelizImagineAskStore.setState({ imagineAskDraftText: 'And at night?' })
    await usePapelizImagineAskStore.getState().sendImagineAskQuestion()

    expect(usePapelizImagineAskStore.getState().imagineAskTokenUsage).toEqual({
      chatSessionTokenUsageTally: { assistantInputTokenCount: 1300, assistantOutputTokenCount: 100, assistantRequestCount: 2, isAssistantTokenCountEstimated: false },
      chatSessionModelTokenUsageTallies: [
        { providerModelName: 'muse-spark-1.3', assistantInputTokenCount: 1300, assistantOutputTokenCount: 100, assistantRequestCount: 2, isAssistantTokenCountEstimated: false },
      ],
      chatSessionContextTokenCount: 940,
      isChatSessionContextTokenCountEstimated: false,
    })
  })

  it('counts nothing for an answer that failed', async () => {
    vi.mocked(streamPapelizChatCompletion).mockRejectedValueOnce(new Error('No route to the provider.'))
    usePapelizImagineAskStore.setState({ imagineAskDraftText: 'A question' })
    await usePapelizImagineAskStore.getState().sendImagineAskQuestion()
    expect(usePapelizImagineAskStore.getState().imagineAskTokenUsage).toEqual(papelizEmptyChatSessionTokenUsage)
  })
})
