import { isPapelizDesktopApp } from 'virtual:papeliz-desktop-platform-availability'
import { fetchFromPapelizProviderAddress } from './papeliz-assistant-provider-fetch'
import { redactPapelizAssistantProviderErrorText } from './papeliz-assistant-provider-error-redaction'

// The one client the assistant uses: OpenAI Chat Completions over `fetch`, streamed as server-sent
// events, with tool calls. It talks only to the base URL the user set, with the user's key in the
// Authorization header. The key is never logged and never part of an error message or a URL: every
// error the client throws is cleaned of it (papeliz-assistant-provider-error-redaction.ts).
// Each answer also says how many tokens it used: the provider's own count when it gives one, or an
// estimate (marked as one) when it does not.

// Who makes the calls, in the unreachable provider's message: a browser page on the web, Papeliz itself
// in the desktop app.
const papelizProviderUnreachableCallerName = isPapelizDesktopApp ? 'Papeliz' : 'a browser'

export interface PapelizAssistantProviderConnection {
  providerBaseUrl: string
  providerApiKey: string
  providerModelName: string
  // Headers the provider needs besides the key's, such as Claude's for calls from a browser page.
  providerExtraRequestHeaders?: Readonly<Record<string, string>>
  // Settings › AI Provider's Advanced: left out, the provider's own default applies.
  providerMaximumOutputTokenCount?: number
  providerTemperature?: number
}

export interface PapelizChatToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

// A part of a user message that carries more than text: the text, or a picture as a URL (a `data:`
// URL for one the user added).
export type PapelizChatUserContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }

export type PapelizChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | PapelizChatUserContentPart[] }
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
  // What the request cost in US dollars, when the provider says so itself (OpenRouter does).
  completionProviderReportedCostUsd: number | null
  // True when the server refused `reasoning_effort` and the request was sent again without it.
  isReasoningEffortRefused: boolean
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
  // Sent as `reasoning_effort` to models that think before they answer.
  reasoningEffort?: 'low' | 'medium' | 'high'
  fetchFunction?: PapelizFetchFunction
}

export function buildPapelizProviderUrl(providerBaseUrl: string, providerPath: string): string {
  return `${providerBaseUrl.trim().replace(/\/+$/, '')}/${providerPath}`
}

function buildProviderHeaders(providerConnection: PapelizAssistantProviderConnection): Record<string, string> {
  const providerHeaders: Record<string, string> = { ...providerConnection.providerExtraRequestHeaders, 'Content-Type': 'application/json' }
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

// The provider's own words: the message of a JSON error body, or the start of its text. A provider
// or proxy may repeat the key in them, so they are cleaned of it before they go into an error.
async function readProviderErrorMessage(providerResponse: Response, providerApiKey: string): Promise<string> {
  const providerResponseText = await providerResponse.text().catch(() => '')
  let providerErrorBodyMessage: string | null = null
  try {
    const providerErrorBody = JSON.parse(providerResponseText) as { error?: { message?: unknown } | string; message?: unknown }
    if (typeof providerErrorBody.error === 'string') providerErrorBodyMessage = providerErrorBody.error
    else if (typeof providerErrorBody.error?.message === 'string') providerErrorBodyMessage = providerErrorBody.error.message
    else if (typeof providerErrorBody.message === 'string') providerErrorBodyMessage = providerErrorBody.message
  } catch {
    // Not JSON: the raw text is used.
  }
  if (providerErrorBodyMessage !== null) return redactPapelizAssistantProviderErrorText(providerErrorBodyMessage, providerApiKey)
  // Cleaned before it is cut short, so a key across the cut is still found whole.
  return redactPapelizAssistantProviderErrorText(providerResponseText.slice(0, 4000), providerApiKey).slice(0, 300)
}

// A successful answer that isn't JSON (a proxy's web page, say). The browser's own parse error would
// quote a piece of the body, so a sentence of Papeliz's own is used instead.
async function readProviderJsonBody(providerConnection: PapelizAssistantProviderConnection, providerResponse: Response): Promise<unknown> {
  try {
    return await providerResponse.json()
  } catch (providerBodyReadError) {
    if (providerBodyReadError instanceof DOMException && providerBodyReadError.name === 'AbortError') throw providerBodyReadError
    throw new PapelizAssistantProviderError(
      `${describeProviderHost(providerConnection.providerBaseUrl)} answered with something other than JSON. Check the base URL.`,
      providerResponse.status,
    )
  }
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
      `Could not reach ${describeProviderHost(providerConnection.providerBaseUrl)}. Check the base URL and your connection, and that the provider accepts calls from ${papelizProviderUnreachableCallerName}.`,
      null,
    )
  }
  if (!providerResponse.ok) {
    throw new PapelizAssistantProviderError(
      explainProviderStatus(providerResponse.status, await readProviderErrorMessage(providerResponse, providerConnection.providerApiKey)),
      providerResponse.status,
    )
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
  // OpenRouter's charge for the request, in US dollars.
  cost?: unknown
}

interface PapelizStreamedChunk {
  choices?: Array<{
    delta?: { content?: string | null; tool_calls?: PapelizStreamedToolCallDelta[] }
    message?: { content?: string | null; tool_calls?: PapelizChatToolCall[] }
    finish_reason?: string | null
  }>
  usage?: PapelizProviderReportedTokenUsage | null
}

// Where the provider gives no count: about four characters a token, over what was sent and received,
// and a picture about a thousand tokens whatever its size.
const papelizEstimatedCharactersPerToken = 4
const papelizEstimatedTokensPerImage = 1000

interface PapelizChatCompletionTokenUsageEstimateRequest {
  sentChatMessages: readonly PapelizChatMessage[]
  sentChatTools?: readonly PapelizChatToolDefinition[] | undefined
  receivedAssistantText: string
  receivedToolCalls?: readonly PapelizChatToolCall[]
}

export function estimatePapelizChatCompletionTokenUsage(tokenUsageEstimateRequest: PapelizChatCompletionTokenUsageEstimateRequest): PapelizChatCompletionTokenUsage {
  const sentChatTools = tokenUsageEstimateRequest.sentChatTools ?? []
  let sentImageCount = 0
  // A picture's data says nothing of its tokens, so it is counted as pictures, not characters.
  const sentMessagesText = JSON.stringify(tokenUsageEstimateRequest.sentChatMessages, (messageFieldName, messageFieldValue: unknown) => {
    if (messageFieldName === 'image_url') {
      sentImageCount += 1
      return ''
    }
    return messageFieldValue
  })
  const sentCharacterCount = sentMessagesText.length + (sentChatTools.length > 0 ? JSON.stringify(sentChatTools).length : 0)
  const receivedCharacterCount =
    tokenUsageEstimateRequest.receivedAssistantText.length +
    (tokenUsageEstimateRequest.receivedToolCalls ?? []).reduce(
      (toolCallCharacterCount, receivedToolCall) => toolCallCharacterCount + receivedToolCall.function.name.length + receivedToolCall.function.arguments.length,
      0,
    )
  return {
    completionInputTokenCount: Math.ceil(sentCharacterCount / papelizEstimatedCharactersPerToken) + sentImageCount * papelizEstimatedTokensPerImage,
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

// A server that does not know an optional field says so with a 400 (or a 422 from a strict schema)
// whose message names it.
function isOptionalRequestFieldRejection(providerRequestError: unknown, rejectedFieldPattern: RegExp): boolean {
  return (
    providerRequestError instanceof PapelizAssistantProviderError &&
    (providerRequestError.providerHttpStatus === 400 || providerRequestError.providerHttpStatus === 422) &&
    rejectedFieldPattern.test(providerRequestError.message)
  )
}

const papelizStreamUsageOptionFieldPattern = /stream_options|include_usage/i
const papelizReasoningEffortFieldPattern = /reasoning_effort|reasoning effort|reasoning/i

// Every error that leaves the client is cleaned of the key, not only the provider's own words: a
// stream that breaks, or the browser, may quote what was sent too. Stop stays an `AbortError`.
async function runProviderCallWithKeyHiddenInErrors<ProviderCallResult>(
  providerConnection: PapelizAssistantProviderConnection,
  providerCall: () => Promise<ProviderCallResult>,
): Promise<ProviderCallResult> {
  try {
    return await providerCall()
  } catch (providerCallError) {
    if (!(providerCallError instanceof Error) || (providerCallError instanceof DOMException && providerCallError.name === 'AbortError')) throw providerCallError
    throw new PapelizAssistantProviderError(
      redactPapelizAssistantProviderErrorText(providerCallError.message, providerConnection.providerApiKey),
      providerCallError instanceof PapelizAssistantProviderError ? providerCallError.providerHttpStatus : null,
    )
  }
}

// Streams one chat completion. Text arrives through `onAssistantTextDelta` as it is written; tool
// calls arrive in pieces and are put back together before they are returned.
export function streamPapelizChatCompletion(chatCompletionRequest: PapelizChatCompletionRequest): Promise<PapelizChatCompletionResult> {
  return runProviderCallWithKeyHiddenInErrors(chatCompletionRequest.providerConnection, () => streamChatCompletionFromProvider(chatCompletionRequest))
}

async function streamChatCompletionFromProvider(chatCompletionRequest: PapelizChatCompletionRequest): Promise<PapelizChatCompletionResult> {
  const fetchFunction = chatCompletionRequest.fetchFunction ?? fetchFromPapelizProviderAddress
  const requestBody: Record<string, unknown> = {
    model: chatCompletionRequest.providerConnection.providerModelName,
    messages: chatCompletionRequest.chatMessages,
    stream: true,
  }
  if (chatCompletionRequest.chatTools !== undefined && chatCompletionRequest.chatTools.length > 0) {
    requestBody['tools'] = chatCompletionRequest.chatTools
    requestBody['tool_choice'] = 'auto'
  }
  const maximumCompletionTokens = chatCompletionRequest.maximumCompletionTokens ?? chatCompletionRequest.providerConnection.providerMaximumOutputTokenCount
  if (maximumCompletionTokens !== undefined) requestBody['max_tokens'] = maximumCompletionTokens
  if (chatCompletionRequest.providerConnection.providerTemperature !== undefined) requestBody['temperature'] = chatCompletionRequest.providerConnection.providerTemperature

  // The token counts come on the last chunk only when asked for.
  const providerBaseUrlKey = readProviderBaseUrlKey(chatCompletionRequest.providerConnection.providerBaseUrl)
  let shouldSendStreamUsageOption = !papelizProviderBaseUrlsRejectingStreamUsageOption.has(providerBaseUrlKey)
  let shouldSendReasoningEffort = chatCompletionRequest.reasoningEffort !== undefined
  let isReasoningEffortRefused = false
  const sendChatCompletionRequest = () =>
    sendProviderRequest(
      chatCompletionRequest.providerConnection,
      'chat/completions',
      {
        method: 'POST',
        headers: buildProviderHeaders(chatCompletionRequest.providerConnection),
        body: JSON.stringify({
          ...requestBody,
          ...(shouldSendStreamUsageOption ? { stream_options: { include_usage: true } } : {}),
          ...(shouldSendReasoningEffort ? { reasoning_effort: chatCompletionRequest.reasoningEffort } : {}),
        }),
        signal: chatCompletionRequest.abortSignal ?? null,
      },
      fetchFunction,
    )
  // A server that refuses `stream_options` or `reasoning_effort` is asked once more without it.
  // `stream_options` is then left out for that server from now on, and its usage is estimated unless
  // it sends counts anyway; the caller hears that the effort was refused, to stop sending it.
  let providerResponse: Response | null = null
  while (providerResponse === null) {
    try {
      providerResponse = await sendChatCompletionRequest()
    } catch (providerRequestError) {
      if (shouldSendStreamUsageOption && isOptionalRequestFieldRejection(providerRequestError, papelizStreamUsageOptionFieldPattern)) {
        papelizProviderBaseUrlsRejectingStreamUsageOption.add(providerBaseUrlKey)
        shouldSendStreamUsageOption = false
        continue
      }
      if (shouldSendReasoningEffort && isOptionalRequestFieldRejection(providerRequestError, papelizReasoningEffortFieldPattern)) {
        shouldSendReasoningEffort = false
        isReasoningEffortRefused = true
        continue
      }
      throw providerRequestError
    }
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
    takeChunk((await readProviderJsonBody(chatCompletionRequest.providerConnection, providerResponse)) as PapelizStreamedChunk)
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
  // Set inside `takeChunk`, which the type checker cannot follow.
  const settledReportedTokenUsage = reportedTokenUsage as PapelizProviderReportedTokenUsage | null
  const reportedCost = settledReportedTokenUsage?.cost
  return {
    assistantText,
    assistantToolCalls,
    completionFinishReason,
    completionProviderReportedCostUsd: typeof reportedCost === 'number' && Number.isFinite(reportedCost) && reportedCost >= 0 ? reportedCost : null,
    isReasoningEffortRefused,
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
  fetchFunction: PapelizFetchFunction = fetchFromPapelizProviderAddress,
): Promise<string[]> {
  return runProviderCallWithKeyHiddenInErrors(providerConnection, async () => {
    const providerResponse = await sendProviderRequest(providerConnection, 'models', { method: 'GET', headers: buildProviderHeaders(providerConnection) }, fetchFunction)
    const modelListBody = (await readProviderJsonBody(providerConnection, providerResponse)) as { data?: Array<{ id?: unknown }> }
    return (modelListBody.data ?? [])
      .map((modelListEntry) => (typeof modelListEntry.id === 'string' ? modelListEntry.id : ''))
      .filter((providerModelName) => providerModelName.length > 0)
      .sort((firstModelName, secondModelName) => firstModelName.localeCompare(secondModelName))
  })
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
