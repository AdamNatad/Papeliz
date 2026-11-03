import { isPapelizDesktopApp } from 'virtual:papeliz-desktop-platform-availability'
import { PapelizAssistantProviderError, buildPapelizProviderUrl, type PapelizAssistantProviderConnection } from './papeliz-openai-compatible-client'
import { redactPapelizAssistantProviderErrorText } from './papeliz-assistant-provider-error-redaction'

// The assistant's image and audio calls, beside the chat client (papeliz-openai-compatible-client.ts):
// Imagine's pictures and Transcribe's speech to text. Like the chat, each call goes from this page
// straight to the provider the person chose, with that provider's own key in the Authorization header,
// and nothing else hears of it. The key is never logged, and every error leaving this file is cleaned
// of it. A picture or a transcript comes back to the page only; nothing is saved until the person
// saves it.
//
// Pictures come from OpenAI's `POST /images/generations` shape, which the Meta Model API, Gemini,
// Together and OpenRouter (at its own `/images`) follow. Speech goes one of three ways, as the
// providers offer it:
// - OpenAI's `POST /audio/transcriptions`, a multipart form with the audio file;
// - the Meta Model API's `POST /asr/transcribe`, a multipart form with a `request` JSON part and a
//   WAV `audio` part, which can label who is speaking;
// - a chat completion given the audio as an `input_audio` part (WAV or MP3) and asked for the words.

export type PapelizTranscriptionApiShape = 'audio-transcriptions-endpoint' | 'meta-asr-transcribe-endpoint' | 'chat-completions-audio-input'

type PapelizMediaFetchFunction = (requestUrl: string, requestInit: RequestInit) => Promise<Response>

// Who makes the calls, in the messages about a provider or a picture link out of reach: a browser
// page on the web, Papeliz itself in the desktop app.
const papelizMediaCallerName = isPapelizDesktopApp ? 'Papeliz' : 'a browser'
const papelizMediaDownloaderName = isPapelizDesktopApp ? 'Papeliz' : 'this page'

export interface PapelizAssistantImageGenerationRequest {
  providerConnection: PapelizAssistantProviderConnection
  // After the base URL: `images/generations`, or OpenRouter's `images`.
  imageGenerationProviderPath: string
  imagePromptText: string
  // "1024x1024" and the like (or a ratio such as "16:9" for `aspect_ratio`), or null for the
  // provider's own default.
  imageSizeValue: string | null
  // Sent as `size`, as `width` and `height`, or as `aspect_ratio`.
  imageSizeFieldStyle: 'size-text' | 'width-and-height' | 'aspect-ratio'
  generatedImageCount: number
  // What `response_format` asks for so the picture comes back as bytes, not a link: OpenAI's
  // "b64_json", or null to send none.
  imageResponseFormatValue: string | null
  abortSignal?: AbortSignal
  fetchFunction?: PapelizMediaFetchFunction
}

export interface PapelizAssistantGeneratedImage {
  generatedImageBlob: Blob
  // The prompt as the provider rewrote it, when it says.
  revisedImagePromptText: string | null
}

export interface PapelizAssistantTranscriptionRequest {
  providerConnection: PapelizAssistantProviderConnection
  transcriptionApiShape: PapelizTranscriptionApiShape
  // A chat-input provider takes WAV or MP3 only; the caller turns a recording into WAV first
  // (papeliz-assistant-audio-recording.ts).
  transcriptionAudioBlob: Blob
  transcriptionAudioFileName: string
  // An ISO 639-1 code such as "en", or null to let the model tell.
  transcriptionLanguageCode: string | null
  // Sent as `language` when no language is given, for an API that would otherwise assume one.
  transcriptionAutoLanguageValue?: string | null
  abortSignal?: AbortSignal
  fetchFunction?: PapelizMediaFetchFunction
}

function describeProviderHost(providerBaseUrl: string): string {
  try {
    return new URL(providerBaseUrl).host
  } catch {
    return 'the provider'
  }
}

// The key's header and the preset's own, never Content-Type for a form: the browser writes that one
// with the form's boundary.
function buildMediaProviderHeaders(providerConnection: PapelizAssistantProviderConnection, isJsonBody: boolean): Record<string, string> {
  const providerHeaders: Record<string, string> = { ...providerConnection.providerExtraRequestHeaders }
  if (isJsonBody) providerHeaders['Content-Type'] = 'application/json'
  if (providerConnection.providerApiKey.trim().length > 0) providerHeaders['Authorization'] = `Bearer ${providerConnection.providerApiKey.trim()}`
  return providerHeaders
}

async function readMediaProviderErrorMessage(providerResponse: Response, providerApiKey: string): Promise<string> {
  const providerResponseText = await providerResponse.text().catch(() => '')
  try {
    const providerErrorBody = JSON.parse(providerResponseText) as { error?: { message?: unknown } | string; message?: unknown; detail?: unknown }
    const providerErrorBodyMessage =
      typeof providerErrorBody.error === 'string'
        ? providerErrorBody.error
        : typeof providerErrorBody.error?.message === 'string'
          ? providerErrorBody.error.message
          : typeof providerErrorBody.message === 'string'
            ? providerErrorBody.message
            : typeof providerErrorBody.detail === 'string'
              ? providerErrorBody.detail
              : null
    if (providerErrorBodyMessage !== null) return redactPapelizAssistantProviderErrorText(providerErrorBodyMessage, providerApiKey).slice(0, 600)
  } catch {
    // Not JSON: the raw text is used.
  }
  return redactPapelizAssistantProviderErrorText(providerResponseText.slice(0, 4000), providerApiKey).slice(0, 300)
}

function explainMediaProviderStatus(providerHttpStatus: number, providerErrorMessage: string): string {
  const providerMessageSuffix = providerErrorMessage.length > 0 ? ` The provider said: ${providerErrorMessage}` : ''
  if (providerHttpStatus === 401 || providerHttpStatus === 403) return `The provider refused the API key (${providerHttpStatus}).${providerMessageSuffix}`
  if (providerHttpStatus === 404) return `The address or the model was not found (404). This provider may not offer it.${providerMessageSuffix}`
  if (providerHttpStatus === 413) return `The file is larger than the provider takes (413).${providerMessageSuffix}`
  if (providerHttpStatus === 429) return `The provider says there were too many requests or the quota ran out (429).${providerMessageSuffix}`
  return `The provider answered with an error (${providerHttpStatus}).${providerMessageSuffix}`
}

async function sendMediaProviderRequest(
  providerConnection: PapelizAssistantProviderConnection,
  providerPath: string,
  requestInit: RequestInit,
  fetchFunction: PapelizMediaFetchFunction,
): Promise<Response> {
  if (providerConnection.providerBaseUrl.trim().length === 0) throw new PapelizAssistantProviderError('Set the provider’s base URL first.', null)
  let providerResponse: Response
  try {
    providerResponse = await fetchFunction(buildPapelizProviderUrl(providerConnection.providerBaseUrl, providerPath), requestInit)
  } catch (providerFetchError) {
    if (providerFetchError instanceof DOMException && providerFetchError.name === 'AbortError') throw providerFetchError
    throw new PapelizAssistantProviderError(
      `Could not reach ${describeProviderHost(providerConnection.providerBaseUrl)}. Check the base URL and your connection, and that the provider accepts calls from ${papelizMediaCallerName}.`,
      null,
    )
  }
  if (!providerResponse.ok) {
    throw new PapelizAssistantProviderError(
      explainMediaProviderStatus(providerResponse.status, await readMediaProviderErrorMessage(providerResponse, providerConnection.providerApiKey)),
      providerResponse.status,
    )
  }
  return providerResponse
}

async function readMediaProviderJsonBody(providerConnection: PapelizAssistantProviderConnection, providerResponse: Response): Promise<unknown> {
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

// Every error that leaves this file is cleaned of the key. Stop stays an `AbortError`.
async function runMediaProviderCallWithKeyHidden<MediaProviderCallResult>(
  providerConnection: PapelizAssistantProviderConnection,
  mediaProviderCall: () => Promise<MediaProviderCallResult>,
): Promise<MediaProviderCallResult> {
  try {
    return await mediaProviderCall()
  } catch (mediaProviderCallError) {
    if (!(mediaProviderCallError instanceof Error) || (mediaProviderCallError instanceof DOMException && mediaProviderCallError.name === 'AbortError')) {
      throw mediaProviderCallError
    }
    throw new PapelizAssistantProviderError(
      redactPapelizAssistantProviderErrorText(mediaProviderCallError.message, providerConnection.providerApiKey),
      mediaProviderCallError instanceof PapelizAssistantProviderError ? mediaProviderCallError.providerHttpStatus : null,
    )
  }
}

// A server that does not know an optional field says so with a 400 (or a 422) whose message names it.
function isOptionalMediaRequestFieldRejection(mediaRequestError: unknown, rejectedFieldPattern: RegExp): boolean {
  return (
    mediaRequestError instanceof PapelizAssistantProviderError &&
    (mediaRequestError.providerHttpStatus === 400 || mediaRequestError.providerHttpStatus === 422) &&
    rejectedFieldPattern.test(mediaRequestError.message)
  )
}

// ---------------------------------------------------------------- Pictures

const papelizImageMimeTypesBySignature: ReadonlyArray<{ signatureBytes: readonly number[]; signatureOffset: number; imageMimeType: string }> = [
  { signatureBytes: [0x89, 0x50, 0x4e, 0x47], signatureOffset: 0, imageMimeType: 'image/png' },
  { signatureBytes: [0xff, 0xd8, 0xff], signatureOffset: 0, imageMimeType: 'image/jpeg' },
  { signatureBytes: [0x57, 0x45, 0x42, 0x50], signatureOffset: 8, imageMimeType: 'image/webp' },
]

// The picture's own first bytes say what it is; the provider's label can be wrong or missing.
export function detectPapelizGeneratedImageMimeType(imageBytes: Uint8Array): string | null {
  return (
    papelizImageMimeTypesBySignature.find(({ signatureBytes, signatureOffset }) =>
      signatureBytes.every((signatureByte, byteIndex) => imageBytes[signatureOffset + byteIndex] === signatureByte),
    )?.imageMimeType ?? null
  )
}

function decodeBase64ToBytes(base64Text: string): Uint8Array<ArrayBuffer> {
  const binaryText = atob(base64Text.replace(/\s+/g, ''))
  const decodedBytes = new Uint8Array(binaryText.length)
  for (let byteOffset = 0; byteOffset < binaryText.length; byteOffset += 1) decodedBytes[byteOffset] = binaryText.charCodeAt(byteOffset)
  return decodedBytes
}

function buildGeneratedImageBlob(imageBytes: Uint8Array<ArrayBuffer>): Blob {
  const imageMimeType = detectPapelizGeneratedImageMimeType(imageBytes)
  if (imageMimeType === null) throw new PapelizAssistantProviderError('The provider sent a picture in a format Papeliz can’t show (only PNG, JPEG and WebP).', null)
  return new Blob([imageBytes], { type: imageMimeType })
}

// A picture the provider gives as base64, a `data:` URL or a link. A link is read without the key
// (it belongs to the provider's own address only); a host that refuses this page says so.
async function readGeneratedImageSource(imageSourceText: string, fetchFunction: PapelizMediaFetchFunction, abortSignal: AbortSignal | undefined): Promise<Blob> {
  const dataUrlMatch = /^data:image\/[a-z0-9.+-]+;base64,(.+)$/is.exec(imageSourceText)
  if (dataUrlMatch !== null) return buildGeneratedImageBlob(decodeBase64ToBytes(dataUrlMatch[1]!))
  if (!/^https?:\/\//i.test(imageSourceText)) return buildGeneratedImageBlob(decodeBase64ToBytes(imageSourceText))
  let imageResponse: Response
  try {
    imageResponse = await fetchFunction(imageSourceText, { method: 'GET', credentials: 'omit', ...(abortSignal === undefined ? {} : { signal: abortSignal }) })
  } catch (imageFetchError) {
    if (imageFetchError instanceof DOMException && imageFetchError.name === 'AbortError') throw imageFetchError
    throw new PapelizAssistantProviderError(`The picture is at ${describeProviderHost(imageSourceText)}, which doesn’t let ${papelizMediaDownloaderName} download it.`, null)
  }
  if (!imageResponse.ok) throw new PapelizAssistantProviderError(`The picture’s link answered with an error (${imageResponse.status}).`, imageResponse.status)
  return buildGeneratedImageBlob(new Uint8Array(await imageResponse.arrayBuffer()))
}

interface PapelizImagesGenerationsResponseBody {
  data?: Array<{ b64_json?: unknown; url?: unknown; revised_prompt?: unknown }>
}

const papelizImageResponseFormatFieldPattern = /response_format|response format/i
const papelizImageSizeFieldPattern = /\b(size|width|height|aspect_ratio)\b|aspect ratio/i

// "1536x1024" as `width` 1536 and `height` 1024.
function readImageSizeWidthAndHeight(imageSizeValue: string): { width: number; height: number } | null {
  const imageSizeMatch = /^(\d{2,5})x(\d{2,5})$/.exec(imageSizeValue)
  return imageSizeMatch === null ? null : { width: Number(imageSizeMatch[1]), height: Number(imageSizeMatch[2]) }
}

async function generateImagesThroughImagesEndpoint(imageGenerationRequest: PapelizAssistantImageGenerationRequest, fetchFunction: PapelizMediaFetchFunction) {
  const { providerConnection, imageGenerationProviderPath, imagePromptText, imageSizeValue, imageSizeFieldStyle, generatedImageCount, imageResponseFormatValue, abortSignal } =
    imageGenerationRequest
  const sendImagesRequest = async (isResponseFormatSent: boolean, isSizeSent: boolean) => {
    const requestBody: Record<string, unknown> = { model: providerConnection.providerModelName, prompt: imagePromptText, n: generatedImageCount }
    if (isSizeSent && imageSizeValue !== null) {
      const imageWidthAndHeight = imageSizeFieldStyle === 'width-and-height' ? readImageSizeWidthAndHeight(imageSizeValue) : null
      if (imageWidthAndHeight !== null) Object.assign(requestBody, imageWidthAndHeight)
      else if (imageSizeFieldStyle === 'aspect-ratio') requestBody['aspect_ratio'] = imageSizeValue
      else requestBody['size'] = imageSizeValue
    }
    if (isResponseFormatSent && imageResponseFormatValue !== null) requestBody['response_format'] = imageResponseFormatValue
    const providerResponse = await sendMediaProviderRequest(
      providerConnection,
      imageGenerationProviderPath,
      {
        method: 'POST',
        headers: buildMediaProviderHeaders(providerConnection, true),
        body: JSON.stringify(requestBody),
        ...(abortSignal === undefined ? {} : { signal: abortSignal }),
      },
      fetchFunction,
    )
    return (await readMediaProviderJsonBody(providerConnection, providerResponse)) as PapelizImagesGenerationsResponseBody
  }
  // A model that always answers in base64 may refuse `response_format`, and one with fixed sizes may
  // refuse `size`: each is sent again without the field it named.
  let imagesResponseBody: PapelizImagesGenerationsResponseBody
  try {
    imagesResponseBody = await sendImagesRequest(true, true)
  } catch (imagesRequestError) {
    if (isOptionalMediaRequestFieldRejection(imagesRequestError, papelizImageResponseFormatFieldPattern)) imagesResponseBody = await sendImagesRequest(false, true)
    else if (isOptionalMediaRequestFieldRejection(imagesRequestError, papelizImageSizeFieldPattern)) imagesResponseBody = await sendImagesRequest(true, false)
    else throw imagesRequestError
  }
  return readGeneratedImagesFromResponseBody(imagesResponseBody, fetchFunction, abortSignal)
}

async function readGeneratedImagesFromResponseBody(
  imagesResponseBody: PapelizImagesGenerationsResponseBody,
  fetchFunction: PapelizMediaFetchFunction,
  abortSignal: AbortSignal | undefined,
): Promise<PapelizAssistantGeneratedImage[]> {
  const generatedImages: PapelizAssistantGeneratedImage[] = []
  for (const generatedImageEntry of imagesResponseBody.data ?? []) {
    const imageSourceText = typeof generatedImageEntry.b64_json === 'string' ? generatedImageEntry.b64_json : typeof generatedImageEntry.url === 'string' ? generatedImageEntry.url : null
    if (imageSourceText === null) continue
    generatedImages.push({
      generatedImageBlob: await readGeneratedImageSource(imageSourceText, fetchFunction, abortSignal),
      revisedImagePromptText: typeof generatedImageEntry.revised_prompt === 'string' ? generatedImageEntry.revised_prompt : null,
    })
  }
  return generatedImages
}

export interface PapelizAssistantImageEditingRequest {
  providerConnection: PapelizAssistantProviderConnection
  imageEditPromptText: string
  // The picture to change: a `data:` URL, or an https address the provider reads itself.
  sourceImageUrl: string
  abortSignal?: AbortSignal
  fetchFunction?: PapelizMediaFetchFunction
}

// Changes a picture as the prompt says, with the Meta Model API's `POST /images/edits` in its JSON
// form (`images: [{ image_url }]`), answering as `/images/generations` does. Gives back the new
// picture; the old one is left as it is.
export function editPapelizAssistantImage(imageEditingRequest: PapelizAssistantImageEditingRequest): Promise<PapelizAssistantGeneratedImage[]> {
  const fetchFunction = imageEditingRequest.fetchFunction ?? ((requestUrl, requestInit) => fetch(requestUrl, requestInit))
  const { providerConnection, imageEditPromptText, sourceImageUrl, abortSignal } = imageEditingRequest
  return runMediaProviderCallWithKeyHidden(providerConnection, async () => {
    if (imageEditPromptText.trim().length === 0) throw new PapelizAssistantProviderError('Say what should change first.', null)
    const providerResponse = await sendMediaProviderRequest(
      providerConnection,
      'images/edits',
      {
        method: 'POST',
        headers: buildMediaProviderHeaders(providerConnection, true),
        body: JSON.stringify({
          model: providerConnection.providerModelName,
          prompt: imageEditPromptText.trim(),
          images: [{ image_url: sourceImageUrl }],
          n: 1,
          response_format: 'b64_json',
        }),
        ...(abortSignal === undefined ? {} : { signal: abortSignal }),
      },
      fetchFunction,
    )
    const editedImages = await readGeneratedImagesFromResponseBody(
      (await readMediaProviderJsonBody(providerConnection, providerResponse)) as PapelizImagesGenerationsResponseBody,
      fetchFunction,
      abortSignal,
    )
    if (editedImages.length === 0) throw new PapelizAssistantProviderError('The provider answered without a picture. Try another wording.', null)
    return editedImages
  })
}

// Asks the provider for pictures of the prompt. Gives back at least one picture, or throws.
export function generatePapelizAssistantImages(imageGenerationRequest: PapelizAssistantImageGenerationRequest): Promise<PapelizAssistantGeneratedImage[]> {
  const fetchFunction = imageGenerationRequest.fetchFunction ?? ((requestUrl, requestInit) => fetch(requestUrl, requestInit))
  return runMediaProviderCallWithKeyHidden(imageGenerationRequest.providerConnection, async () => {
    if (imageGenerationRequest.providerConnection.providerModelName.trim().length === 0) throw new PapelizAssistantProviderError('Choose an image model first.', null)
    if (imageGenerationRequest.imagePromptText.trim().length === 0) throw new PapelizAssistantProviderError('Describe the picture first.', null)
    const generatedImages = await generateImagesThroughImagesEndpoint(imageGenerationRequest, fetchFunction)
    if (generatedImages.length === 0) throw new PapelizAssistantProviderError('The provider answered without a picture. Try another model or prompt.', null)
    return generatedImages
  })
}

// ---------------------------------------------------------------- Speech

async function readBlobAsBase64(audioBlob: Blob): Promise<string> {
  const audioBytes = new Uint8Array(await audioBlob.arrayBuffer())
  let audioBinaryText = ''
  for (let byteOffset = 0; byteOffset < audioBytes.length; byteOffset += 0x8000) audioBinaryText += String.fromCharCode(...audioBytes.subarray(byteOffset, byteOffset + 0x8000))
  return btoa(audioBinaryText)
}

// `input_audio` takes "wav" or "mp3".
function readChatInputAudioFormat(transcriptionAudioBlob: Blob, transcriptionAudioFileName: string): 'wav' | 'mp3' {
  if (/wav/i.test(transcriptionAudioBlob.type) || /\.wav$/i.test(transcriptionAudioFileName)) return 'wav'
  if (/mpeg|mp3/i.test(transcriptionAudioBlob.type) || /\.mp3$/i.test(transcriptionAudioFileName)) return 'mp3'
  throw new PapelizAssistantProviderError('This provider takes WAV or MP3 audio only.', null)
}

// What the model is asked, for a provider that hears audio in a chat.
export const papelizChatTranscriptionInstructionText =
  'Transcribe this recording word for word. Answer with the transcript only: no title, no notes, no timestamps. Start a new paragraph when the speaker changes or the topic turns.'

async function transcribeThroughTranscriptionsEndpoint(transcriptionRequest: PapelizAssistantTranscriptionRequest, fetchFunction: PapelizMediaFetchFunction): Promise<string> {
  const { providerConnection, transcriptionAudioBlob, transcriptionAudioFileName, transcriptionLanguageCode, transcriptionAutoLanguageValue, abortSignal } = transcriptionRequest
  // The model before the file: some servers read the form in order.
  const transcriptionForm = new FormData()
  transcriptionForm.append('model', providerConnection.providerModelName)
  transcriptionForm.append('response_format', 'json')
  const sentLanguageValue = transcriptionLanguageCode ?? transcriptionAutoLanguageValue ?? null
  if (sentLanguageValue !== null) transcriptionForm.append('language', sentLanguageValue)
  transcriptionForm.append('file', transcriptionAudioBlob, transcriptionAudioFileName)
  const providerResponse = await sendMediaProviderRequest(
    providerConnection,
    'audio/transcriptions',
    { method: 'POST', headers: buildMediaProviderHeaders(providerConnection, false), body: transcriptionForm, ...(abortSignal === undefined ? {} : { signal: abortSignal }) },
    fetchFunction,
  )
  // `json` gives `{ "text": … }`; a server that ignores it may answer in plain text.
  const transcriptionResponseText = await providerResponse.text()
  try {
    const transcriptionResponseBody = JSON.parse(transcriptionResponseText) as { text?: unknown }
    if (typeof transcriptionResponseBody.text === 'string') return transcriptionResponseBody.text
  } catch {
    return transcriptionResponseText
  }
  throw new PapelizAssistantProviderError('The provider answered without a transcript.', providerResponse.status)
}

interface PapelizMetaAsrTranscribeResponseBody {
  transcript?: unknown
  turns?: Array<{ transcript?: unknown; speaker?: unknown }>
}

// A transcript with who spoke: each turn as "Speaker A: …" in its own paragraph, merged while the same
// speaker goes on. With one speaker (or none named), the plain transcript.
export function formatPapelizSpeakerLabelledTranscript(metaAsrResponseBody: PapelizMetaAsrTranscribeResponseBody): string {
  const plainTranscriptText = typeof metaAsrResponseBody.transcript === 'string' ? metaAsrResponseBody.transcript : ''
  const speakerTurns = (metaAsrResponseBody.turns ?? []).filter(
    (speakerTurn): speakerTurn is { transcript: string; speaker: string } =>
      typeof speakerTurn.transcript === 'string' && speakerTurn.transcript.trim().length > 0 && typeof speakerTurn.speaker === 'string' && speakerTurn.speaker !== 'unknown',
  )
  if (new Set(speakerTurns.map((speakerTurn) => speakerTurn.speaker)).size < 2) return plainTranscriptText
  const speakerParagraphs: Array<{ speakerLabel: string; spokenText: string }> = []
  for (const speakerTurn of speakerTurns) {
    const lastSpeakerParagraph = speakerParagraphs[speakerParagraphs.length - 1]
    if (lastSpeakerParagraph?.speakerLabel === speakerTurn.speaker) lastSpeakerParagraph.spokenText += ` ${speakerTurn.transcript.trim()}`
    else speakerParagraphs.push({ speakerLabel: speakerTurn.speaker, spokenText: speakerTurn.transcript.trim() })
  }
  return speakerParagraphs.map(({ speakerLabel, spokenText }) => `Speaker ${speakerLabel}: ${spokenText}`).join('\n\n')
}

// Meta's own API: a `request` JSON part (as `curl -F 'request=...;type=application/json'` sends it)
// and the WAV. Diarization labels the speakers, which suits meeting notes.
async function transcribeThroughMetaAsrEndpoint(transcriptionRequest: PapelizAssistantTranscriptionRequest, fetchFunction: PapelizMediaFetchFunction): Promise<string> {
  const { providerConnection, transcriptionAudioBlob, transcriptionAudioFileName, transcriptionLanguageCode, abortSignal } = transcriptionRequest
  const metaAsrRequestSettings: Record<string, unknown> = { model: providerConnection.providerModelName, audioEncoding: 'WAV', mode: 'DIARIZATION' }
  if (transcriptionLanguageCode !== null) metaAsrRequestSettings['languageBias'] = [transcriptionLanguageCode]
  const sendMetaAsrRequest = (isRequestSentAsJsonPart: boolean) => {
    const metaAsrForm = new FormData()
    if (isRequestSentAsJsonPart) metaAsrForm.append('request', new Blob([JSON.stringify(metaAsrRequestSettings)], { type: 'application/json' }), 'request.json')
    else metaAsrForm.append('request', JSON.stringify(metaAsrRequestSettings))
    metaAsrForm.append('audio', transcriptionAudioBlob, transcriptionAudioFileName)
    return sendMediaProviderRequest(
      providerConnection,
      'asr/transcribe',
      {
        method: 'POST',
        headers: { ...buildMediaProviderHeaders(providerConnection, false), Accept: 'application/json' },
        body: metaAsrForm,
        ...(abortSignal === undefined ? {} : { signal: abortSignal }),
      },
      fetchFunction,
    )
  }
  // A server that wants the settings as a plain form field says so about `request`: sent once more
  // that way.
  let providerResponse: Response
  try {
    providerResponse = await sendMetaAsrRequest(true)
  } catch (metaAsrRequestError) {
    const isRequestPartRefused =
      metaAsrRequestError instanceof PapelizAssistantProviderError &&
      (metaAsrRequestError.providerHttpStatus === 415 || isOptionalMediaRequestFieldRejection(metaAsrRequestError, /\brequest\b|json|content.type|multipart part/i))
    if (!isRequestPartRefused) throw metaAsrRequestError
    providerResponse = await sendMetaAsrRequest(false)
  }
  const metaAsrResponseBody = (await readMediaProviderJsonBody(providerConnection, providerResponse)) as PapelizMetaAsrTranscribeResponseBody
  if (typeof metaAsrResponseBody.transcript !== 'string') throw new PapelizAssistantProviderError('The provider answered without a transcript.', providerResponse.status)
  return formatPapelizSpeakerLabelledTranscript(metaAsrResponseBody)
}

async function transcribeThroughChatCompletions(transcriptionRequest: PapelizAssistantTranscriptionRequest, fetchFunction: PapelizMediaFetchFunction): Promise<string> {
  const { providerConnection, transcriptionAudioBlob, transcriptionAudioFileName, transcriptionLanguageCode, abortSignal } = transcriptionRequest
  const inputAudioFormat = readChatInputAudioFormat(transcriptionAudioBlob, transcriptionAudioFileName)
  const instructionText = transcriptionLanguageCode === null ? papelizChatTranscriptionInstructionText : `${papelizChatTranscriptionInstructionText} The language is ${transcriptionLanguageCode}.`
  const providerResponse = await sendMediaProviderRequest(
    providerConnection,
    'chat/completions',
    {
      method: 'POST',
      headers: buildMediaProviderHeaders(providerConnection, true),
      body: JSON.stringify({
        model: providerConnection.providerModelName,
        stream: false,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: instructionText },
              { type: 'input_audio', input_audio: { data: await readBlobAsBase64(transcriptionAudioBlob), format: inputAudioFormat } },
            ],
          },
        ],
      }),
      ...(abortSignal === undefined ? {} : { signal: abortSignal }),
    },
    fetchFunction,
  )
  const chatResponseBody = (await readMediaProviderJsonBody(providerConnection, providerResponse)) as { choices?: Array<{ message?: { content?: unknown } }> }
  const transcriptText = chatResponseBody.choices?.[0]?.message?.content
  if (typeof transcriptText !== 'string') throw new PapelizAssistantProviderError('The provider answered without a transcript.', providerResponse.status)
  return transcriptText
}

// Turns speech into text with the person's provider. Gives back the transcript, trimmed.
export function transcribePapelizAssistantAudio(transcriptionRequest: PapelizAssistantTranscriptionRequest): Promise<string> {
  const fetchFunction = transcriptionRequest.fetchFunction ?? ((requestUrl, requestInit) => fetch(requestUrl, requestInit))
  return runMediaProviderCallWithKeyHidden(transcriptionRequest.providerConnection, async () => {
    if (transcriptionRequest.providerConnection.providerModelName.trim().length === 0) throw new PapelizAssistantProviderError('Choose a transcription model first.', null)
    const transcriptText =
      transcriptionRequest.transcriptionApiShape === 'audio-transcriptions-endpoint'
        ? await transcribeThroughTranscriptionsEndpoint(transcriptionRequest, fetchFunction)
        : transcriptionRequest.transcriptionApiShape === 'meta-asr-transcribe-endpoint'
          ? await transcribeThroughMetaAsrEndpoint(transcriptionRequest, fetchFunction)
          : await transcribeThroughChatCompletions(transcriptionRequest, fetchFunction)
    if (transcriptText.trim().length === 0) throw new PapelizAssistantProviderError('The provider heard no words in the recording.', null)
    return transcriptText.trim()
  })
}
