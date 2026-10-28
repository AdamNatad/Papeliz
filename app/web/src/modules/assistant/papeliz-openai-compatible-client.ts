// The one client the assistant uses: OpenAI Chat Completions over `fetch`, streamed as server-sent
// events, with tool calls. It talks only to the base URL the user set, with the user's key in the
// Authorization header. The key is never logged and never part of an error message or a URL.
// Each answer also says how many tokens it used: the provider's own count when it gives one, or an
// estimate (marked as one) when it does not.

export interface PapelizAssistantProviderConnection {
  providerBaseUrl: string
  providerApiKey: string
  providerModelName: string
}

export interface PapelizChatToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type PapelizChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: PapelizChatToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

export interface PapelizChatToolDefinition {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

export interface PapelizChatCompletionTokenUsage {
  completionInputTokenCount: number
  completionOutputTokenCount: number
  // True when the provider gave no count (or only part of one), so a figure is estimated.
  isCompletionTokenUsageEstimated: boolean
}

export interface PapelizChatCompletionResult {
  assistantText: string
  assistantToolCalls: PapelizChatToolCall[]
  completionFinishReason: string | null
  completionTokenUsage: PapelizChatCompletionTokenUsage
}

export class PapelizAssistantProviderError extends Error {
  override readonly name = 'PapelizAssistantProviderError'
  constructor(
    message: string,
    readonly providerHttpStatus: number | null,
  ) {
    super(message)
  }
}

type PapelizFetchFunction = (requestUrl: string, requestInit: RequestInit) => Promise<Response>

interface PapelizChatCompletionRequest {
  providerConnection: PapelizAssistantProviderConnection
  chatMessages: readonly PapelizChatMessage[]
  chatTools?: readonly PapelizChatToolDefinition[]
  abortSignal?: AbortSignal
  onAssistantTextDelta?: (assistantTextDelta: string) => void
  maximumCompletionTokens?: number
  fetchFunction?: PapelizFetchFunction
}

export function buildPapelizProviderUrl(providerBaseUrl: string, providerPath: string): string {
  return `${providerBaseUrl.trim().replace(/\/+$/, '')}/${providerPath}`
}

function buildProviderHeaders(providerConnection: PapelizAssistantProviderConnection): Record<string, string> {
  const providerHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  if (providerConnection.providerApiKey.trim().length > 0) providerHeaders['Authorization'] = `Bearer ${providerConnection.providerApiKey.trim()}`
  return providerHeaders
}

function describeProviderHost(providerBaseUrl: string): string {
  try {
    return new URL(providerBaseUrl).host
  } catch {
    return 'the provider'
  }
}

async function readProviderErrorMessage(providerResponse: Response): Promise<string> {
  const providerResponseText = await providerResponse.text().catch(() => '')
  try {
    const providerErrorBody = JSON.parse(providerResponseText) as { error?: { message?: unknown } | string; message?: unknown }
    if (typeof providerErrorBody.error === 'string') return providerErrorBody.error
    if (typeof providerErrorBody.error?.message === 'string') return providerErrorBody.error.message
    if (typeof providerErrorBody.message === 'string') return providerErrorBody.message
  } catch {
    // Not JSON: fall through to the raw text.
  }
  return providerResponseText.slice(0, 300)
}

function explainProviderStatus(providerHttpStatus: number, providerErrorMessage: string): string {
  const providerMessageSuffix = providerErrorMessage.length > 0 ? ` The provider said: ${providerErrorMessage}` : ''
  if (providerHttpStatus === 401 || providerHttpStatus === 403) return `The provider refused the API key (${providerHttpStatus}).${providerMessageSuffix}`
  if (providerHttpStatus === 404) return `The address or the model was not found (404).${providerMessageSuffix}`
  if (providerHttpStatus === 429) return `The provider says there were too many requests or the quota ran out (429).${providerMessageSuffix}`
  return `The provider answered with an error (${providerHttpStatus}).${providerMessageSuffix}`
}

async function sendProviderRequest(
  providerConnection: PapelizAssistantProviderConnection,
  providerPath: string,
  requestInit: RequestInit,
  fetchFunction: PapelizFetchFunction,
): Promise<Response> {
  if (providerConnection.providerBaseUrl.trim().length === 0) throw new PapelizAssistantProviderError('Set the provider’s base URL first.', null)
  let providerResponse: Response
  try {
    providerResponse = await fetchFunction(buildPapelizProviderUrl(providerConnection.providerBaseUrl, providerPath), requestInit)
  } catch (providerFetchError) {
    if (providerFetchError instanceof DOMException && providerFetchError.name === 'AbortError') throw providerFetchError
    throw new PapelizAssistantProviderError(
      `Could not reach ${describeProviderHost(providerConnection.providerBaseUrl)}. Check the base URL and your connection, and that the provider accepts calls from a browser.`,
      null,
    )
  }
  if (!providerResponse.ok) {
    throw new PapelizAssistantProviderError(explainProviderStatus(providerResponse.status, await readProviderErrorMessage(providerResponse)), providerResponse.status)
  }
  return providerResponse
}

interface PapelizStreamedToolCallDelta {
  index?: number
  id?: string
  function?: { name?: string; arguments?: string }
}

// The `usage` object the provider sends: on the last streamed chunk when asked for with
// `stream_options`, or on a plain JSON answer.
interface PapelizProviderReportedTokenUsage {
  prompt_tokens?: unknown
  completion_tokens?: unknown
  total_tokens?: unknown
}

interface PapelizStreamedChunk {
  choices?: Array<{
    delta?: { content?: string | null; tool_calls?: PapelizStreamedToolCallDelta[] }
    message?: { content?: string | null; tool_calls?: PapelizChatToolCall[] }
    finish_reason?: string | null
  }>
  usage?: PapelizProviderReportedTokenUsage | null
}

// Where the provider gives no count: about four characters a token, over what was sent and received.
const papelizEstimatedCharactersPerToken = 4

interface PapelizChatCompletionTokenUsageEstimateRequest {
  sentChatMessages: readonly PapelizChatMessage[]
  sentChatTools?: readonly PapelizChatToolDefinition[] | undefined
  receivedAssistantText: string
  receivedToolCalls?: readonly PapelizChatToolCall[]
}

export function estimatePapelizChatCompletionTokenUsage(tokenUsageEstimateRequest: PapelizChatCompletionTokenUsageEstimateRequest): PapelizChatCompletionTokenUsage {
  const sentChatTools = tokenUsageEstimateRequest.sentChatTools ?? []
  const sentCharacterCount = JSON.stringify(tokenUsageEstimateRequest.sentChatMessages).length + (sentChatTools.length > 0 ? JSON.stringify(sentChatTools).length : 0)
  const receivedCharacterCount =
    tokenUsageEstimateRequest.receivedAssistantText.length +
    (tokenUsageEstimateRequest.receivedToolCalls ?? []).reduce(
      (toolCallCharacterCount, receivedToolCall) => toolCallCharacterCount + receivedToolCall.function.name.length + receivedToolCall.function.arguments.length,
      0,
    )
  return {
    completionInputTokenCount: Math.ceil(sentCharacterCount / papelizEstimatedCharactersPerToken),
    completionOutputTokenCount: Math.ceil(receivedCharacterCount / papelizEstimatedCharactersPerToken),
    isCompletionTokenUsageEstimated: true,
  }
}

function readReportedTokenCount(reportedTokenCount: unknown): number | null {
  return typeof reportedTokenCount === 'number' && Number.isFinite(reportedTokenCount) && reportedTokenCount >= 0 ? Math.round(reportedTokenCount) : null
}

// The provider's counts where it gave them, and an estimate for whatever it left out.
function settleChatCompletionTokenUsage(
  reportedTokenUsage: PapelizProviderReportedTokenUsage | null,
  estimateTokenUsage: () => PapelizChatCompletionTokenUsage,
): PapelizChatCompletionTokenUsage {
  const reportedInputTokenCount = readReportedTokenCount(reportedTokenUsage?.prompt_tokens)
  const reportedTotalTokenCount = readReportedTokenCount(reportedTokenUsage?.total_tokens)
  let reportedOutputTokenCount = readReportedTokenCount(reportedTokenUsage?.completion_tokens)
  if (reportedOutputTokenCount === null && reportedInputTokenCount !== null && reportedTotalTokenCount !== null && reportedTotalTokenCount >= reportedInputTokenCount) {
    reportedOutputTokenCount = reportedTotalTokenCount - reportedInputTokenCount
  }
  // A request always sends some tokens; a zero there means the server filled the field without counting.
  const trustedInputTokenCount = reportedInputTokenCount !== null && reportedInputTokenCount > 0 ? reportedInputTokenCount : null
  if (trustedInputTokenCount !== null && reportedOutputTokenCount !== null) {
    return { completionInputTokenCount: trustedInputTokenCount, completionOutputTokenCount: reportedOutputTokenCount, isCompletionTokenUsageEstimated: false }
  }
  const estimatedTokenUsage = estimateTokenUsage()
  return {
    completionInputTokenCount: trustedInputTokenCount ?? estimatedTokenUsage.completionInputTokenCount,
    completionOutputTokenCount: reportedOutputTokenCount ?? estimatedTokenUsage.completionOutputTokenCount,
    isCompletionTokenUsageEstimated: true,
  }
}

// Base URLs whose server refused `stream_options` (since this page loaded); they are not sent it again.
const papelizProviderBaseUrlsRejectingStreamUsageOption = new Set<string>()

function readProviderBaseUrlKey(providerBaseUrl: string): string {
  return providerBaseUrl.trim().replace(/\/+$/, '').toLowerCase()
}

// A server that does not know `stream_options` says so with a 400 (or a 422 from a strict schema)
// whose message names it.
function isStreamUsageOptionRejection(providerRequestError: unknown): boolean {
  return (
    providerRequestError instanceof PapelizAssistantProviderError &&
    (providerRequestError.providerHttpStatus === 400 || providerRequestError.providerHttpStatus === 422) &&
    /stream_options|include_usage/i.test(providerRequestError.message)
  )
}

// Streams one chat completion. Text arrives through `onAssistantTextDelta` as it is written; tool
// calls arrive in pieces and are put back together before they are returned.
export async function streamPapelizChatCompletion(chatCompletionRequest: PapelizChatCompletionRequest): Promise<PapelizChatCompletionResult> {
  const fetchFunction = chatCompletionRequest.fetchFunction ?? ((requestUrl, requestInit) => fetch(requestUrl, requestInit))
  const requestBody: Record<string, unknown> = {
    model: chatCompletionRequest.providerConnection.providerModelName,
    messages: chatCompletionRequest.chatMessages,
    stream: true,
  }
  if (chatCompletionRequest.chatTools !== undefined && chatCompletionRequest.chatTools.length > 0) {
    requestBody['tools'] = chatCompletionRequest.chatTools
    requestBody['tool_choice'] = 'auto'
  }
  if (chatCompletionRequest.maximumCompletionTokens !== undefined) requestBody['max_tokens'] = chatCompletionRequest.maximumCompletionTokens

  // The token counts come on the last chunk only when asked for.
  const providerBaseUrlKey = readProviderBaseUrlKey(chatCompletionRequest.providerConnection.providerBaseUrl)
  const isStreamUsageOptionSent = !papelizProviderBaseUrlsRejectingStreamUsageOption.has(providerBaseUrlKey)
  const sendChatCompletionRequest = (shouldSendStreamUsageOption: boolean) =>
    sendProviderRequest(
      chatCompletionRequest.providerConnection,
      'chat/completions',
      {
        method: 'POST',
        headers: buildProviderHeaders(chatCompletionRequest.providerConnection),
        body: JSON.stringify(shouldSendStreamUsageOption ? { ...requestBody, stream_options: { include_usage: true } } : requestBody),
        signal: chatCompletionRequest.abortSignal ?? null,
      },
      fetchFunction,
    )
  let providerResponse: Response
  try {
    providerResponse = await sendChatCompletionRequest(isStreamUsageOptionSent)
  } catch (providerRequestError) {
    if (!isStreamUsageOptionSent || !isStreamUsageOptionRejection(providerRequestError)) throw providerRequestError
    // This server refuses `stream_options`: ask once more without it, and leave it out from now on.
    // Its usage is then estimated, unless it sends counts anyway.
    papelizProviderBaseUrlsRejectingStreamUsageOption.add(providerBaseUrlKey)
    providerResponse = await sendChatCompletionRequest(false)
  }

  let assistantText = ''
  let completionFinishReason: string | null = null
  let reportedTokenUsage: PapelizProviderReportedTokenUsage | null = null
  const toolCallsByIndex = new Map<number, PapelizChatToolCall>()

  const takeChunk = (streamedChunk: PapelizStreamedChunk) => {
    // The counts come on a chunk of their own (with no choices), or on the last one.
    if (typeof streamedChunk.usage === 'object' && streamedChunk.usage !== null) reportedTokenUsage = streamedChunk.usage
    const streamedChoice = streamedChunk.choices?.[0]
    if (streamedChoice === undefined) return
    if (streamedChoice.finish_reason) completionFinishReason = streamedChoice.finish_reason
    const streamedTextDelta = streamedChoice.delta?.content ?? streamedChoice.message?.content ?? ''
    if (streamedTextDelta.length > 0) {
      assistantText += streamedTextDelta
      chatCompletionRequest.onAssistantTextDelta?.(streamedTextDelta)
    }
    for (const [toolCallPosition, toolCallDelta] of (streamedChoice.delta?.tool_calls ?? []).entries()) {
      const toolCallIndex = toolCallDelta.index ?? toolCallPosition
      const assembledToolCall = toolCallsByIndex.get(toolCallIndex) ?? { id: '', type: 'function' as const, function: { name: '', arguments: '' } }
      if (toolCallDelta.id) assembledToolCall.id = toolCallDelta.id
      if (toolCallDelta.function?.name) assembledToolCall.function.name += toolCallDelta.function.name
      if (toolCallDelta.function?.arguments) assembledToolCall.function.arguments += toolCallDelta.function.arguments
      toolCallsByIndex.set(toolCallIndex, assembledToolCall)
    }
    for (const [toolCallPosition, wholeToolCall] of (streamedChoice.message?.tool_calls ?? []).entries()) toolCallsByIndex.set(toolCallPosition, wholeToolCall)
  }

  const isEventStream = (providerResponse.headers.get('content-type') ?? '').includes('text/event-stream')
  if (!isEventStream || providerResponse.body === null) {
    // Some servers ignore `stream: true` and answer with one JSON body.
    takeChunk((await providerResponse.json()) as PapelizStreamedChunk)
  } else {
    const streamReader = providerResponse.body.getReader()
    const streamDecoder = new TextDecoder()
    let unreadStreamText = ''
    let isStreamDone = false
    while (!isStreamDone) {
      const { value: streamBytes, done: isReaderDone } = await streamReader.read()
      if (isReaderDone) break
      unreadStreamText += streamDecoder.decode(streamBytes, { stream: true })
      const streamLines = unreadStreamText.split(/\r?\n/)
      unreadStreamText = streamLines.pop() ?? ''
      for (const streamLine of streamLines) {
        if (!streamLine.startsWith('data:')) continue
        const streamData = streamLine.slice(5).trim()
        if (streamData === '[DONE]') {
          isStreamDone = true
          break
        }
        if (streamData.length === 0) continue
        try {
          takeChunk(JSON.parse(streamData) as PapelizStreamedChunk)
        } catch {
          // A line that isn't JSON (a keep-alive comment, say) is skipped.
        }
      }
    }
    await streamReader.cancel().catch(() => undefined)
  }

  const assistantToolCalls = [...toolCallsByIndex.entries()]
    .sort(([firstIndex], [secondIndex]) => firstIndex - secondIndex)
    .map(([toolCallIndex, assembledToolCall]) => ({ ...assembledToolCall, id: assembledToolCall.id || `papeliz-tool-call-${toolCallIndex}` }))
  return {
    assistantText,
    assistantToolCalls,
    completionFinishReason,
    completionTokenUsage: settleChatCompletionTokenUsage(reportedTokenUsage, () =>
      estimatePapelizChatCompletionTokenUsage({
        sentChatMessages: chatCompletionRequest.chatMessages,
        sentChatTools: chatCompletionRequest.chatTools,
        receivedAssistantText: assistantText,
        receivedToolCalls: assistantToolCalls,
      }),
    ),
  }
}

// Asks the provider which models this key can use (`GET /models`). Not every provider offers it.
export async function listPapelizProviderModelNames(
  providerConnection: PapelizAssistantProviderConnection,
  fetchFunction: PapelizFetchFunction = (requestUrl, requestInit) => fetch(requestUrl, requestInit),
): Promise<string[]> {
  const providerResponse = await sendProviderRequest(providerConnection, 'models', { method: 'GET', headers: buildProviderHeaders(providerConnection) }, fetchFunction)
  const modelListBody = (await providerResponse.json()) as { data?: Array<{ id?: unknown }> }
  return (modelListBody.data ?? [])
    .map((modelListEntry) => (typeof modelListEntry.id === 'string' ? modelListEntry.id : ''))
    .filter((providerModelName) => providerModelName.length > 0)
    .sort((firstModelName, secondModelName) => firstModelName.localeCompare(secondModelName))
}

// A tiny request that proves the base URL, key and model work together.
export async function testPapelizProviderConnection(
  providerConnection: PapelizAssistantProviderConnection,
  fetchFunction?: PapelizFetchFunction,
): Promise<string> {
  if (providerConnection.providerModelName.trim().length === 0) throw new PapelizAssistantProviderError('Choose a model first.', null)
  const connectionTestResult = await streamPapelizChatCompletion({
    providerConnection,
    chatMessages: [{ role: 'user', content: 'Reply with the single word: ready' }],
    maximumCompletionTokens: 16,
    ...(fetchFunction === undefined ? {} : { fetchFunction }),
  })
  return connectionTestResult.assistantText.trim()
}
