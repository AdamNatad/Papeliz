import { describe, expect, it } from 'vitest'
import { PapelizAssistantProviderError, listPapelizProviderModelNames, streamPapelizChatCompletion } from './papeliz-openai-compatible-client'

const testProviderConnection = { providerBaseUrl: 'https://provider.test/v1/', providerApiKey: 'test-key', providerModelName: 'test-model' }

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

  it('lists the models a key can use', async () => {
    expect(
      await listPapelizProviderModelNames(testProviderConnection, async () => Response.json({ data: [{ id: 'b-model' }, { id: 'a-model' }] })),
    ).toEqual(['a-model', 'b-model'])
  })
})
