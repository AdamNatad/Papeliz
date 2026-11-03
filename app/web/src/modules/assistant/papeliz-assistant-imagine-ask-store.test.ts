import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildPapelizImagineAskSystemMessage,
  selectIsPapelizImagineAskAnswering,
  splitPapelizImagineAskAnswer,
  usePapelizImagineAskStore,
} from './papeliz-assistant-imagine-ask-store'
import { PapelizAssistantProviderError, streamPapelizChatCompletion } from './papeliz-openai-compatible-client'

// Imagine's Ask: the talk with the chat model before a picture is drawn, and the prompts its answers
// mark worth drawing. The chat model is a stand-in, so no key or network is used.

vi.mock('./papeliz-openai-compatible-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./papeliz-openai-compatible-client')>()),
  streamPapelizChatCompletion: vi.fn(),
}))

let isChatProviderReady = true
vi.mock('./papeliz-assistant-provider-settings-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./papeliz-assistant-provider-settings-store')>()),
  getActivePapelizAssistantProviderConnection: () =>
    isChatProviderReady
      ? {
          providerConnectionOutcome: 'ready',
          providerConnection: { providerBaseUrl: 'https://papeliz-test-provider.invalid/v1/', providerApiKey: 'papeliz-test-key-not-a-real-key', providerModelName: 'muse-spark-1.3' },
          providerDisplayName: 'Meta Model API',
        }
      : { providerConnectionOutcome: 'not-set-up', providerSetupProblem: 'Choose a provider.' },
}))

function buildStandInCompletion(assistantText: string) {
  return {
    assistantText,
    assistantToolCalls: [],
    completionFinishReason: 'stop',
    completionTokenUsage: { completionInputTokenCount: 100, completionOutputTokenCount: 20, isCompletionTokenUsageEstimated: false },
    completionProviderReportedCostUsd: null,
    isReasoningEffortRefused: false,
  }
}

const readImagineAskEntries = () => usePapelizImagineAskStore.getState().imagineAskEntries

beforeEach(() => {
  isChatProviderReady = true
  vi.mocked(streamPapelizChatCompletion).mockReset()
  usePapelizImagineAskStore.setState({ imagineAskDraftText: '', imagineAskEntries: [] })
})

describe('an Ask answer split into words and prompts worth drawing', () => {
  it('finds each ```draw block, and keeps the words around them', () => {
    expect(
      splitPapelizImagineAskAnswer('A soft dawn light suits it.\n\n```draw\nA watercolor lighthouse at dawn, soft pink sky\n```\n\nOr try dusk:\n```draw\nThe same lighthouse at dusk\n```'),
    ).toEqual([
      { askAnswerPartKind: 'words', askAnswerWordsText: 'A soft dawn light suits it.' },
      { askAnswerPartKind: 'draw-prompt', drawPromptText: 'A watercolor lighthouse at dawn, soft pink sky', isDrawPromptComplete: true },
      { askAnswerPartKind: 'words', askAnswerWordsText: 'Or try dusk:' },
      { askAnswerPartKind: 'draw-prompt', drawPromptText: 'The same lighthouse at dusk', isDrawPromptComplete: true },
    ])
  })

  it('shows a prompt still arriving as not ready to draw', () => {
    expect(splitPapelizImagineAskAnswer('Here it is:\n```draw\nA red fox in')).toEqual([
      { askAnswerPartKind: 'words', askAnswerWordsText: 'Here it is:' },
      { askAnswerPartKind: 'draw-prompt', drawPromptText: 'A red fox in', isDrawPromptComplete: false },
    ])
  })

  it('leaves other code blocks and plain answers as words', () => {
    expect(splitPapelizImagineAskAnswer('What mood do you want?')).toEqual([{ askAnswerPartKind: 'words', askAnswerWordsText: 'What mood do you want?' }])
    expect(splitPapelizImagineAskAnswer('```css\ncolor: red;\n```')).toEqual([{ askAnswerPartKind: 'words', askAnswerWordsText: '```css\ncolor: red;\n```' }])
  })

  it('tells the model it helps describe a picture, draws nothing, and how to mark a prompt', () => {
    const askSystemMessage = buildPapelizImagineAskSystemMessage('muse-image-1.0')
    expect(askSystemMessage).toContain('before they draw it with an image model (muse-image-1.0)')
    expect(askSystemMessage).toContain('never say you made one')
    expect(askSystemMessage).toContain('```draw')
    expect(buildPapelizImagineAskSystemMessage(null)).toContain('with an image model.')
  })
})

describe('sending a question from Ask', () => {
  it('empties the box, streams the answer in, and sends the talk so far with each question', async () => {
    vi.mocked(streamPapelizChatCompletion).mockImplementationOnce(async ({ onAssistantTextDelta }) => {
      onAssistantTextDelta?.('Try soft ')
      onAssistantTextDelta?.('dawn light.')
      return buildStandInCompletion('Try soft dawn light.')
    })
    usePapelizImagineAskStore.setState({ imagineAskDraftText: '  What light suits a lighthouse?  ' })
    await usePapelizImagineAskStore.getState().sendImagineAskQuestion()
    expect(usePapelizImagineAskStore.getState().imagineAskDraftText).toBe('')
    expect(readImagineAskEntries()).toMatchObject([
      { imagineAskEntryKind: 'question', askQuestionText: 'What light suits a lighthouse?' },
      { imagineAskEntryKind: 'answer', askAnswerText: 'Try soft dawn light.', isAskAnswerStreaming: false, askAnswerProblem: null },
    ])

    vi.mocked(streamPapelizChatCompletion).mockResolvedValueOnce(buildStandInCompletion('```draw\nA lighthouse at dawn\n```'))
    usePapelizImagineAskStore.setState({ imagineAskDraftText: 'Write me the prompt' })
    await usePapelizImagineAskStore.getState().sendImagineAskQuestion()
    const secondRequest = vi.mocked(streamPapelizChatCompletion).mock.calls[1]?.[0]
    expect(secondRequest?.chatMessages.map((chatMessage) => chatMessage.role)).toEqual(['system', 'user', 'assistant', 'user'])
    expect(secondRequest?.chatMessages.at(-1)).toEqual({ role: 'user', content: 'Write me the prompt' })
    // Ask talks only: it never offers the model a tool.
    expect(secondRequest?.chatTools).toBeUndefined()
  })

  it('shows what went wrong under the question, and leaves that answer out of the next request', async () => {
    vi.mocked(streamPapelizChatCompletion).mockRejectedValueOnce(new PapelizAssistantProviderError('The provider turned the key down.', 401))
    usePapelizImagineAskStore.setState({ imagineAskDraftText: 'A question' })
    await usePapelizImagineAskStore.getState().sendImagineAskQuestion()
    expect(readImagineAskEntries()[1]).toMatchObject({ askAnswerText: '', askAnswerProblem: 'The provider turned the key down.', isAskAnswerStreaming: false })

    vi.mocked(streamPapelizChatCompletion).mockResolvedValueOnce(buildStandInCompletion('An answer'))
    usePapelizImagineAskStore.setState({ imagineAskDraftText: 'Again' })
    await usePapelizImagineAskStore.getState().sendImagineAskQuestion()
    expect(vi.mocked(streamPapelizChatCompletion).mock.calls[1]?.[0].chatMessages.map((chatMessage) => chatMessage.role)).toEqual(['system', 'user', 'user'])
  })

  it('stops an answer on Stop, keeping what came', async () => {
    vi.mocked(streamPapelizChatCompletion).mockImplementationOnce(
      ({ abortSignal, onAssistantTextDelta }) =>
        new Promise((_resolveCompletion, rejectCompletion) => {
          onAssistantTextDelta?.('A lighthouse ')
          abortSignal?.addEventListener('abort', () => rejectCompletion(new DOMException('Stopped.', 'AbortError')))
        }),
    )
    usePapelizImagineAskStore.setState({ imagineAskDraftText: 'Describe a lighthouse' })
    const sentQuestion = usePapelizImagineAskStore.getState().sendImagineAskQuestion()
    expect(selectIsPapelizImagineAskAnswering(usePapelizImagineAskStore.getState())).toBe(true)
    usePapelizImagineAskStore.getState().stopImagineAskAnswer()
    await sentQuestion
    expect(readImagineAskEntries()[1]).toMatchObject({ askAnswerText: 'A lighthouse ', isAskAnswerStopped: true, askAnswerProblem: null, isAskAnswerStreaming: false })
    expect(selectIsPapelizImagineAskAnswering(usePapelizImagineAskStore.getState())).toBe(false)
  })

  it('sends nothing before a chat provider is set up', async () => {
    isChatProviderReady = false
    usePapelizImagineAskStore.setState({ imagineAskDraftText: 'A question' })
    await usePapelizImagineAskStore.getState().sendImagineAskQuestion()
    expect(readImagineAskEntries()).toEqual([])
    expect(usePapelizImagineAskStore.getState().imagineAskDraftText).toBe('A question')
    expect(streamPapelizChatCompletion).not.toHaveBeenCalled()
  })
})
