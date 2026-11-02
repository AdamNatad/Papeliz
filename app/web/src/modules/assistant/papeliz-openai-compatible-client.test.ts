import { describe, expect, it } from 'vitest'
import { findPapelizAssistantProviderPreset } from './papeliz-assistant-provider-presets'
import { PapelizAssistantProviderError, listPapelizProviderModelNames, streamPapelizChatCompletion } from './papeliz-openai-compatible-client'

const testProviderConnection = { providerBaseUrl: 'https://provider.test/v1/', providerApiKey: 'test-key', providerModelName: 'test-model' }

// Fake keys shaped like each provider's, for the error-cleaning tests.
const fakeOpenAiApiKey = 'sk-proj-PAPELIZ-FAKE-TEST-KEY-0000000000'
const fakeOpenRouterApiKey = 'sk-or-v1-papeliz-fake-test-key-0000000000000000'
const fakeGeminiApiKey = 'AIzaPapelizFakeTestKey_0000000'
const fakeFireworksApiKey = 'fw_papelizFakeTestKey000000'
const fakeTogetherApiKey = 'papeliz-fake-together-test-key-0000'
const fakeGroqApiKey = 'gsk_papeliz_fake_test_key_0000'

function createEventStreamResponse(streamPieces: readonly string[]): Response {
  const streamEncoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(streamController) {
        for (const streamPiece of streamPieces) streamController.enqueue(streamEncoder.encode(streamPiece))
        streamController.close()
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  )
}

function sseLine(streamedChunk: unknown): string {
  return `data: ${JSON.stringify(streamedChunk)}\n\n`
}

describe('the OpenAI-compatible client', () => {
  it('streams text as it arrives, even when lines are split across reads', async () => {
    const requests: Array<{ requestUrl: string; requestInit: RequestInit }> = []
    const textDeltas: string[] = []
    const streamText = sseLine({ choices: [{ delta: { content: 'Hello' } }] }) + sseLine({ choices: [{ delta: { content: ', vault' }, finish_reason: 'stop' }] }) + 'data: [DONE]\n\n'
    const chatCompletionResult = await streamPapelizChatCompletion({
      providerConnection: testProviderConnection,
      chatMessages: [{ role: 'user', content: 'Hi' }],
      onAssistantTextDelta: (assistantTextDelta) => textDeltas.push(assistantTextDelta),
      fetchFunction: async (requestUrl, requestInit) => {
        requests.push({ requestUrl, requestInit })
        return createEventStreamResponse([streamText.slice(0, 23), streamText.slice(23, 61), streamText.slice(61)])
      },
    })
    // No counts came back, so they are estimated: 32 characters sent and 12 received, at 4 a token.
    expect(chatCompletionResult).toEqual({
      assistantText: 'Hello, vault',
      assistantToolCalls: [],
      completionFinishReason: 'stop',
      completionTokenUsage: { completionInputTokenCount: 8, completionOutputTokenCount: 3, isCompletionTokenUsageEstimated: true },
      completionProviderReportedCostUsd: null,
      isReasoningEffortRefused: false,
    })
    expect(textDeltas).toEqual(['Hello', ', vault'])
    expect(requests[0]?.requestUrl).toBe('https://provider.test/v1/chat/completions')
    expect((requests[0]?.requestInit.headers as Record<string, string>)['Authorization']).toBe('Bearer test-key')
    expect(JSON.parse(String(requests[0]?.requestInit.body))).toMatchObject({ model: 'test-model', stream: true, stream_options: { include_usage: true } })
  })

  it('reads the provider’s token counts from the last chunk', async () => {
    const chatCompletionResult = await streamPapelizChatCompletion({
      providerConnection: testProviderConnection,
      chatMessages: [{ role: 'user', content: 'Hi' }],
      fetchFunction: async () =>
        createEventStreamResponse([
          sseLine({ choices: [{ delta: { content: 'Hello' }, finish_reason: 'stop' }] }),
          sseLine({ choices: [], usage: { prompt_tokens: 1200, completion_tokens: 34, total_tokens: 1234 } }),
          'data: [DONE]\n\n',
        ]),
    })
    expect(chatCompletionResult.completionTokenUsage).toEqual({ completionInputTokenCount: 1200, completionOutputTokenCount: 34, isCompletionTokenUsageEstimated: false })
  })

  it('reads token counts from a plain JSON answer, and works out a missing output count from the total', async () => {
    const chatCompletionResult = await streamPapelizChatCompletion({
      providerConnection: testProviderConnection,
      chatMessages: [{ role: 'user', content: 'Hi' }],
      fetchFunction: async () => Response.json({ choices: [{ message: { content: 'ready' }, finish_reason: 'stop' }], usage: { prompt_tokens: 40, total_tokens: 42 } }),
    })
    expect(chatCompletionResult.completionTokenUsage).toEqual({ completionInputTokenCount: 40, completionOutputTokenCount: 2, isCompletionTokenUsageEstimated: false })
  })

  it('asks once more without stream_options when the server refuses it, and leaves it out from then on', async () => {
    const strictProviderConnection = { ...testProviderConnection, providerBaseUrl: 'https://strict-provider.test/v1' }
    const sentRequestBodies: Array<Record<string, unknown>> = []
    const strictProviderFetch = async (_requestUrl: string, requestInit: RequestInit) => {
      const sentRequestBody = JSON.parse(String(requestInit.body)) as Record<string, unknown>
      sentRequestBodies.push(sentRequestBody)
      if ('stream_options' in sentRequestBody) return Response.json({ error: { message: 'Unrecognized request argument supplied: stream_options' } }, { status: 400 })
      return createEventStreamResponse([sseLine({ choices: [{ delta: { content: 'ready' }, finish_reason: 'stop' }] }), 'data: [DONE]\n\n'])
    }
    const chatCompletionResult = await streamPapelizChatCompletion({
      providerConnection: strictProviderConnection,
      chatMessages: [{ role: 'user', content: 'Hi' }],
      fetchFunction: strictProviderFetch,
    })
    expect(chatCompletionResult.assistantText).toBe('ready')
    expect(chatCompletionResult.completionTokenUsage.isCompletionTokenUsageEstimated).toBe(true)
    expect(sentRequestBodies.map((sentRequestBody) => 'stream_options' in sentRequestBody)).toEqual([true, false])

    await streamPapelizChatCompletion({ providerConnection: strictProviderConnection, chatMessages: [{ role: 'user', content: 'Again' }], fetchFunction: strictProviderFetch })
    expect(sentRequestBodies.map((sentRequestBody) => 'stream_options' in sentRequestBody)).toEqual([true, false, false])
  })

  it('does not ask again after a 400 about something else', async () => {
    let providerRequestCount = 0
    await expect(
      streamPapelizChatCompletion({
        providerConnection: { ...testProviderConnection, providerBaseUrl: 'https://other-provider.test/v1' },
        chatMessages: [{ role: 'user', content: 'Hi' }],
        fetchFunction: async () => {
          providerRequestCount += 1
          return Response.json({ error: { message: 'Unknown model' } }, { status: 400 })
        },
      }),
    ).rejects.toThrow(/Unknown model/)
    expect(providerRequestCount).toBe(1)
  })

  it('sends the effort, and asks once more without it when the model refuses it', async () => {
    const sentRequestBodies: Array<Record<string, unknown>> = []
    const chatCompletionResult = await streamPapelizChatCompletion({
      providerConnection: { ...testProviderConnection, providerBaseUrl: 'https://effort-provider.test/v1' },
      chatMessages: [{ role: 'user', content: 'Hi' }],
      reasoningEffort: 'high',
      fetchFunction: async (_requestUrl, requestInit) => {
        const sentRequestBody = JSON.parse(String(requestInit.body)) as Record<string, unknown>
        sentRequestBodies.push(sentRequestBody)
        if ('reasoning_effort' in sentRequestBody) return Response.json({ error: { message: 'reasoning_effort is not supported with this model' } }, { status: 400 })
        return Response.json({ choices: [{ message: { content: 'Hello' }, finish_reason: 'stop' }], usage: { prompt_tokens: 9, completion_tokens: 1 } })
      },
    })
    expect(sentRequestBodies.map((sentRequestBody) => sentRequestBody['reasoning_effort'])).toEqual(['high', undefined])
    expect(chatCompletionResult.isReasoningEffortRefused).toBe(true)
    expect(chatCompletionResult.assistantText).toBe('Hello')
  })

  it('reads what the request cost when the provider says so', async () => {
    const chatCompletionResult = await streamPapelizChatCompletion({
      providerConnection: testProviderConnection,
      chatMessages: [{ role: 'user', content: 'Hi' }],
      fetchFunction: async () =>
        createEventStreamResponse([
          sseLine({ choices: [{ delta: { content: 'Hi' }, finish_reason: 'stop' }] }),
          sseLine({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 2, cost: 0.000042 } }),
          'data: [DONE]\n\n',
        ]),
    })
    expect(chatCompletionResult.completionProviderReportedCostUsd).toBe(0.000042)
    expect(chatCompletionResult.isReasoningEffortRefused).toBe(false)
  })

  it('puts tool calls back together from their pieces', async () => {
    const chatCompletionResult = await streamPapelizChatCompletion({
      providerConnection: testProviderConnection,
      chatMessages: [{ role: 'user', content: 'Find my garden notes' }],
      chatTools: [{ type: 'function', function: { name: 'searchVaultNotes', description: 'Search', parameters: { type: 'object' } } }],
      fetchFunction: async () =>
        createEventStreamResponse([
          sseLine({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'searchVaultNotes', arguments: '{"query":' } }] } }] }),
          sseLine({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"garden"}' } }] } }] }),
          sseLine({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }),
          'data: [DONE]\n\n',
        ]),
    })
    expect(chatCompletionResult.assistantToolCalls).toEqual([
      { id: 'call_1', type: 'function', function: { name: 'searchVaultNotes', arguments: '{"query":"garden"}' } },
    ])
    expect(chatCompletionResult.completionFinishReason).toBe('tool_calls')
  })

  it('reads a plain JSON answer from a server that ignores streaming', async () => {
    const chatCompletionResult = await streamPapelizChatCompletion({
      providerConnection: testProviderConnection,
      chatMessages: [{ role: 'user', content: 'Hi' }],
      fetchFunction: async () => Response.json({ choices: [{ message: { content: 'ready' }, finish_reason: 'stop' }] }),
    })
    expect(chatCompletionResult.assistantText).toBe('ready')
  })

  it('explains provider errors without ever repeating the key', async () => {
    const providerErrorPromise = streamPapelizChatCompletion({
      providerConnection: testProviderConnection,
      chatMessages: [{ role: 'user', content: 'Hi' }],
      fetchFunction: async () => Response.json({ error: { message: 'Invalid API key' } }, { status: 401 }),
    })
    await expect(providerErrorPromise).rejects.toBeInstanceOf(PapelizAssistantProviderError)
    await expect(providerErrorPromise).rejects.toThrow(/refused the API key \(401\).*Invalid API key/)
    await expect(providerErrorPromise).rejects.not.toThrow(/test-key/)
    await expect(
      streamPapelizChatCompletion({
        providerConnection: testProviderConnection,
        chatMessages: [{ role: 'user', content: 'Hi' }],
        fetchFunction: async () => {
          throw new TypeError('Failed to fetch')
        },
      }),
    ).rejects.toThrow(/Could not reach provider\.test/)
  })

  it('hides the key when a JSON error body repeats it', async () => {
    const providerConnection = { providerBaseUrl: findPapelizAssistantProviderPreset('openrouter').providerBaseUrl, providerApiKey: fakeOpenRouterApiKey, providerModelName: 'test-model' }
    const providerErrorPromise = streamPapelizChatCompletion({
      providerConnection,
      chatMessages: [{ role: 'user', content: 'Hi' }],
      fetchFunction: async () => Response.json({ error: { message: `No auth credentials found for key ${fakeOpenRouterApiKey}`, code: 401 } }, { status: 401 }),
    })
    await expect(providerErrorPromise).rejects.toThrow('The provider refused the API key (401). The provider said: No auth credentials found for key [hidden]')
    await expect(providerErrorPromise).rejects.not.toThrow(/papeliz-fake/)
  })

  it('hides a key in the query of an address in a raw error body', async () => {
    const geminiBaseUrl = findPapelizAssistantProviderPreset('google-gemini').providerBaseUrl
    // A body with no message to pick (a list), so its text is used as it is.
    const geminiErrorBodyText = JSON.stringify([
      { error: { code: 400, message: `API key not valid. Request ${geminiBaseUrl}/chat/completions?key=${fakeGeminiApiKey} was refused.`, status: 'INVALID_ARGUMENT' } },
    ])
    const providerErrorPromise = streamPapelizChatCompletion({
      providerConnection: { providerBaseUrl: geminiBaseUrl, providerApiKey: fakeGeminiApiKey, providerModelName: 'test-model' },
      chatMessages: [{ role: 'user', content: 'Hi' }],
      fetchFunction: async () => new Response(geminiErrorBodyText, { status: 400, headers: { 'content-type': 'application/json' } }),
    })
    await expect(providerErrorPromise).rejects.toThrow(`chat/completions?key=[hidden] was refused.`)
    await expect(providerErrorPromise).rejects.not.toThrow(/PapelizFake/)
  })

  it('hides a key a proxy echoes in its headers, even where the text is cut short', async () => {
    const providerConnection = { providerBaseUrl: findPapelizAssistantProviderPreset('fireworks').providerBaseUrl, providerApiKey: fakeFireworksApiKey, providerModelName: 'test-model' }
    const headerEchoErrorPromise = streamPapelizChatCompletion({
      providerConnection,
      chatMessages: [{ role: 'user', content: 'Hi' }],
      fetchFunction: async () => new Response(`Bad gateway. Upstream request:\nPOST /v1/chat/completions\nAuthorization: Bearer ${fakeFireworksApiKey}\n`, { status: 502 }),
    })
    await expect(headerEchoErrorPromise).rejects.toThrow('The provider answered with an error (502). The provider said: Bad gateway. Upstream request:\nPOST /v1/chat/completions\nAuthorization: Bearer [hidden]')
    // The raw text is kept to 300 characters; a key across that cut is still hidden, not half shown.
    const cutErrorPromise = streamPapelizChatCompletion({
      providerConnection,
      chatMessages: [{ role: 'user', content: 'Hi' }],
      fetchFunction: async () => new Response(`${'x '.repeat(146)}${fakeFireworksApiKey} more text after the key`, { status: 500 }),
    })
    await expect(cutErrorPromise).rejects.toThrow(/x \[hidden\]$/)
    await expect(cutErrorPromise).rejects.not.toThrow(/fw_/)
  })

  it('still retries without a refused field when the refusal repeats the key, and hides it in the last error', async () => {
    const providerRequestBodies: Array<Record<string, unknown>> = []
    const providerErrorPromise = streamPapelizChatCompletion({
      providerConnection: { providerBaseUrl: findPapelizAssistantProviderPreset('together').providerBaseUrl, providerApiKey: fakeTogetherApiKey, providerModelName: 'test-model' },
      chatMessages: [{ role: 'user', content: 'Hi' }],
      fetchFunction: async (_requestUrl, requestInit) => {
        providerRequestBodies.push(JSON.parse(String(requestInit.body)) as Record<string, unknown>)
        return providerRequestBodies.length === 1
          ? Response.json({ error: { message: `Unrecognized request argument supplied: stream_options (Authorization: Bearer ${fakeTogetherApiKey})` } }, { status: 400 })
          : Response.json({ error: { message: `Invalid API key ${fakeTogetherApiKey}` } }, { status: 401 })
      },
    })
    await expect(providerErrorPromise).rejects.toThrow('The provider refused the API key (401). The provider said: Invalid API key [hidden]')
    expect(providerRequestBodies).toHaveLength(2)
    expect(providerRequestBodies[1]).not.toHaveProperty('stream_options')
  })

  it('names the host, and quotes nothing, when a successful answer is not JSON', async () => {
    const htmlAnswer = () => new Response(`<html>key=${fakeTogetherApiKey}</html>`, { status: 200, headers: { 'content-type': 'text/html' } })
    const chatErrorPromise = streamPapelizChatCompletion({ providerConnection: testProviderConnection, chatMessages: [{ role: 'user', content: 'Hi' }], fetchFunction: async () => htmlAnswer() })
    await expect(chatErrorPromise).rejects.toThrow('provider.test answered with something other than JSON. Check the base URL.')
    await expect(listPapelizProviderModelNames(testProviderConnection, async () => htmlAnswer())).rejects.toThrow(/^provider\.test answered with something other than JSON/)
  })

  it('hides the key when the stream breaks with a message that quotes it, and passes Stop on as it is', async () => {
    const providerConnection = { providerBaseUrl: findPapelizAssistantProviderPreset('openai').providerBaseUrl, providerApiKey: fakeOpenAiApiKey, providerModelName: 'test-model' }
    const createBrokenEventStreamResponse = (streamError: Error) =>
      new Response(
        new ReadableStream({
          start(streamController) {
            streamController.error(streamError)
          },
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      )
    const brokenStreamErrorPromise = streamPapelizChatCompletion({
      providerConnection,
      chatMessages: [{ role: 'user', content: 'Hi' }],
      fetchFunction: async () => createBrokenEventStreamResponse(new TypeError(`Connection reset while sending Authorization: Bearer ${fakeOpenAiApiKey}`)),
    })
    await expect(brokenStreamErrorPromise).rejects.toBeInstanceOf(PapelizAssistantProviderError)
    await expect(brokenStreamErrorPromise).rejects.toThrow('Connection reset while sending Authorization: Bearer [hidden]')
    await expect(brokenStreamErrorPromise).rejects.not.toThrow(/papeliz-fake/i)
    await expect(
      streamPapelizChatCompletion({
        providerConnection,
        chatMessages: [{ role: 'user', content: 'Hi' }],
        fetchFunction: async () => createBrokenEventStreamResponse(new DOMException('The user aborted a request.', 'AbortError')),
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('hides the key in a model list error', async () => {
    const providerConnection = { providerBaseUrl: findPapelizAssistantProviderPreset('groq').providerBaseUrl, providerApiKey: fakeGroqApiKey, providerModelName: '' }
    const modelListErrorPromise = listPapelizProviderModelNames(providerConnection, async () => Response.json({ error: { message: `Invalid API Key: ${fakeGroqApiKey}` } }, { status: 401 }))
    await expect(modelListErrorPromise).rejects.toThrow('The provider refused the API key (401). The provider said: Invalid API Key: [hidden]')
  })

  it('lists the models a key can use', async () => {
    expect(
      await listPapelizProviderModelNames(testProviderConnection, async () => Response.json({ data: [{ id: 'b-model' }, { id: 'a-model' }] })),
    ).toEqual(['a-model', 'b-model'])
  })
})
