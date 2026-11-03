import type { PapelizTranscriptionApiShape } from './papeliz-assistant-image-and-audio-client'

// Which providers make pictures (Imagine), turn speech into text (Transcribe) and see pictures
// (Describe Picture, at the end), through which API and with which models, beside the chat presets
// (papeliz-assistant-provider-presets.ts). Read from each vendor's API docs on 2026-11-03. "Browser
// access confirmed" means the endpoint was asked without a key, as Chrome asks, whether
// `https://papeliz.com` may send Authorization and Content-Type to it, and said yes, the same day. A
// provider missing from the pictures or speech lists offers neither: Claude, DeepSeek and Groq make no
// pictures; Claude and DeepSeek hear no audio; Fireworks retired both on 2026-06-10.
//
// The Meta Model API comes first and offers both: `muse-image-1.0` on the OpenAI-shaped
// `/images/generations` (WebP by default), and `muse-voice-transcribe-1.0` on its own
// `/asr/transcribe`, which takes a 16-bit mono WAV of up to 10 minutes and labels speakers.

// The picture shapes the Imagine menu offers, as width:height; Auto leaves the shape to the provider.
export type PapelizAssistantImageAspectRatio = 'auto' | '1:1' | '2:3' | '3:2' | '16:9' | '9:16'

export interface PapelizAssistantImageAspectRatioChoice {
  imageAspectRatio: PapelizAssistantImageAspectRatio
  // What is sent for it, as the preset's `imageSizeFieldStyle` says: "1536x1024" as `size` (or as
  // `width` and `height`), "16:9" as `aspect_ratio`, the provider's own "auto", or null to send no
  // size at all.
  imageSizeValue: string | null
  // Set when only some of the provider's picture models make this shape: the names of those that do.
  imageModelNamePattern?: RegExp
}

export interface PapelizAssistantImageGenerationPreset {
  // Where the request goes, after the base URL: OpenAI's `images/generations`, OpenRouter's `images`.
  imageGenerationProviderPath: string
  suggestedImageModelNames: readonly string[]
  // The shapes it makes, each listed only where the provider's docs say so; 1:1 is the default where
  // offered. Empty: no size is sent, the provider picks, and the menu offers no shape.
  imageAspectRatioChoices: readonly PapelizAssistantImageAspectRatioChoice[]
  // How the size is sent: "1024x1024" as `size`, as `width` and `height` (Together), or "16:9" as
  // `aspect_ratio` (OpenRouter).
  imageSizeFieldStyle: 'size-text' | 'width-and-height' | 'aspect-ratio'
  // What `response_format` asks for so pictures come back as bytes, or null when the API always does
  // (OpenAI's GPT image models refuse the field).
  imageResponseFormatValue: string | null
  isImageGenerationBrowserAccessConfirmed: boolean
  // Edit Picture: the provider changes a picture as a prompt says. Only the Meta Model API's
  // `POST /images/edits` JSON form is built so far.
  isImageEditingOffered?: boolean
}

export interface PapelizAssistantTranscriptionPreset {
  transcriptionApiShape: PapelizTranscriptionApiShape
  suggestedTranscriptionModelNames: readonly string[]
  // The largest request the provider takes.
  transcriptionAudioByteLimit: number
  // The audio is sent as speech WAV (one channel, 16 kHz, 16-bit) in pieces of at most this many
  // seconds when the provider takes WAV only, or when the file is over the byte limit.
  transcriptionAudioChunkSeconds: number
  isSpeechWavRequired: boolean
  // What `language` is sent as when the person leaves it to the model, for an API that would
  // otherwise assume English (Together), or null to send none.
  transcriptionAutoLanguageValue: string | null
  isTranscriptionBrowserAccessConfirmed: boolean
}

// The three sizes every OpenAI-shaped picture API takes.
const papelizOpenAiStandardImageAspectRatioChoices: readonly PapelizAssistantImageAspectRatioChoice[] = [
  { imageAspectRatio: '1:1', imageSizeValue: '1024x1024' },
  { imageAspectRatio: '2:3', imageSizeValue: '1024x1536' },
  { imageAspectRatio: '3:2', imageSizeValue: '1536x1024' },
]

const papelizMegabyte = 1024 * 1024

export const papelizAssistantImageGenerationPresetsByProviderId: Readonly<Record<string, PapelizAssistantImageGenerationPreset>> = {
  'meta-model-api': {
    imageGenerationProviderPath: 'images/generations',
    suggestedImageModelNames: ['muse-image-1.0'],
    // Any width x height sets only the shape, and Meta picks the resolution; "auto" (or no size) is
    // its default shape.
    imageAspectRatioChoices: [
      { imageAspectRatio: 'auto', imageSizeValue: 'auto' },
      ...papelizOpenAiStandardImageAspectRatioChoices,
      { imageAspectRatio: '16:9', imageSizeValue: '1536x864' },
      { imageAspectRatio: '9:16', imageSizeValue: '864x1536' },
    ],
    imageSizeFieldStyle: 'size-text',
    imageResponseFormatValue: 'b64_json',
    isImageGenerationBrowserAccessConfirmed: true,
    isImageEditingOffered: true,
  },
  openai: {
    imageGenerationProviderPath: 'images/generations',
    suggestedImageModelNames: ['gpt-image-2', 'chatgpt-image-latest'],
    // Every GPT image model takes the three standard sizes and "auto"; the gpt-image-2 family (2.5
    // included) also takes any width x height divisible by 16, between 1:3 and 3:1.
    imageAspectRatioChoices: [
      { imageAspectRatio: 'auto', imageSizeValue: 'auto' },
      ...papelizOpenAiStandardImageAspectRatioChoices,
      { imageAspectRatio: '16:9', imageSizeValue: '1536x864', imageModelNamePattern: /^gpt-image-2/ },
      { imageAspectRatio: '9:16', imageSizeValue: '864x1536', imageModelNamePattern: /^gpt-image-2/ },
    ],
    imageSizeFieldStyle: 'size-text',
    imageResponseFormatValue: null,
    isImageGenerationBrowserAccessConfirmed: true,
  },
  'google-gemini': {
    imageGenerationProviderPath: 'images/generations',
    // The two its OpenAI-compatible endpoint's docs name.
    suggestedImageModelNames: ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'],
    // Its OpenAI-compatible endpoint takes `size` but names no values, so none is sent.
    imageAspectRatioChoices: [],
    imageSizeFieldStyle: 'size-text',
    imageResponseFormatValue: 'b64_json',
    isImageGenerationBrowserAccessConfirmed: true,
  },
  openrouter: {
    // OpenRouter's own image API, which always answers in base64.
    imageGenerationProviderPath: 'images',
    suggestedImageModelNames: ['google/gemini-2.5-flash-image', 'openai/gpt-image-2', 'black-forest-labs/flux.2-pro'],
    // Its `aspect_ratio` takes each of these for any model, and "auto" lets the model choose; a model
    // that can't make one is given its nearest.
    imageAspectRatioChoices: [
      { imageAspectRatio: 'auto', imageSizeValue: 'auto' },
      { imageAspectRatio: '1:1', imageSizeValue: '1:1' },
      { imageAspectRatio: '2:3', imageSizeValue: '2:3' },
      { imageAspectRatio: '3:2', imageSizeValue: '3:2' },
      { imageAspectRatio: '16:9', imageSizeValue: '16:9' },
      { imageAspectRatio: '9:16', imageSizeValue: '9:16' },
    ],
    imageSizeFieldStyle: 'aspect-ratio',
    imageResponseFormatValue: null,
    isImageGenerationBrowserAccessConfirmed: true,
  },
  together: {
    imageGenerationProviderPath: 'images/generations',
    suggestedImageModelNames: ['black-forest-labs/FLUX.2-pro', 'black-forest-labs/FLUX.1.1-pro'],
    // FLUX takes any width and height from 256 to 1920 in steps of 8; without them it makes its own
    // default size, so there is no Auto.
    imageAspectRatioChoices: [
      { imageAspectRatio: '1:1', imageSizeValue: '1024x1024' },
      { imageAspectRatio: '2:3', imageSizeValue: '832x1248' },
      { imageAspectRatio: '3:2', imageSizeValue: '1248x832' },
      { imageAspectRatio: '16:9', imageSizeValue: '1280x720' },
      { imageAspectRatio: '9:16', imageSizeValue: '720x1280' },
    ],
    imageSizeFieldStyle: 'width-and-height',
    imageResponseFormatValue: 'base64',
    isImageGenerationBrowserAccessConfirmed: true,
  },
  // Any OpenAI-compatible API: the person types its image model. Its sizes aren't known, so it gets
  // the three standard ones, and Auto sends none.
  custom: {
    imageGenerationProviderPath: 'images/generations',
    suggestedImageModelNames: [],
    imageAspectRatioChoices: [{ imageAspectRatio: 'auto', imageSizeValue: null }, ...papelizOpenAiStandardImageAspectRatioChoices],
    imageSizeFieldStyle: 'size-text',
    imageResponseFormatValue: 'b64_json',
    isImageGenerationBrowserAccessConfirmed: false,
  },
}

export const papelizAssistantTranscriptionPresetsByProviderId: Readonly<Record<string, PapelizAssistantTranscriptionPreset>> = {
  'meta-model-api': {
    transcriptionApiShape: 'meta-asr-transcribe-endpoint',
    suggestedTranscriptionModelNames: ['muse-voice-transcribe-1.0'],
    transcriptionAudioByteLimit: 32 * papelizMegabyte,
    // Ten minutes a request, with room to spare.
    transcriptionAudioChunkSeconds: 590,
    isSpeechWavRequired: true,
    transcriptionAutoLanguageValue: null,
    isTranscriptionBrowserAccessConfirmed: true,
  },
  openai: {
    transcriptionApiShape: 'audio-transcriptions-endpoint',
    suggestedTranscriptionModelNames: ['gpt-transcribe'],
    transcriptionAudioByteLimit: 25 * papelizMegabyte,
    transcriptionAudioChunkSeconds: 600,
    isSpeechWavRequired: false,
    transcriptionAutoLanguageValue: null,
    isTranscriptionBrowserAccessConfirmed: true,
  },
  'google-gemini': {
    // No transcription endpoint: the audio goes into a chat as `input_audio`.
    transcriptionApiShape: 'chat-completions-audio-input',
    suggestedTranscriptionModelNames: ['gemini-2.5-flash'],
    // A request with audio inside it may be 20 MB; five minutes of speech WAV in base64 is about 13 MB.
    transcriptionAudioByteLimit: 20 * papelizMegabyte,
    transcriptionAudioChunkSeconds: 300,
    isSpeechWavRequired: true,
    transcriptionAutoLanguageValue: null,
    isTranscriptionBrowserAccessConfirmed: true,
  },
  openrouter: {
    transcriptionApiShape: 'audio-transcriptions-endpoint',
    suggestedTranscriptionModelNames: ['openai/whisper-large-v3', 'openai/gpt-4o-transcribe'],
    transcriptionAudioByteLimit: 25 * papelizMegabyte,
    transcriptionAudioChunkSeconds: 600,
    isSpeechWavRequired: false,
    transcriptionAutoLanguageValue: null,
    isTranscriptionBrowserAccessConfirmed: true,
  },
  groq: {
    transcriptionApiShape: 'audio-transcriptions-endpoint',
    suggestedTranscriptionModelNames: ['whisper-large-v3-turbo', 'whisper-large-v3'],
    transcriptionAudioByteLimit: 25 * papelizMegabyte,
    transcriptionAudioChunkSeconds: 600,
    isSpeechWavRequired: false,
    transcriptionAutoLanguageValue: null,
    isTranscriptionBrowserAccessConfirmed: true,
  },
  together: {
    transcriptionApiShape: 'audio-transcriptions-endpoint',
    suggestedTranscriptionModelNames: ['openai/whisper-large-v3'],
    transcriptionAudioByteLimit: 80 * papelizMegabyte,
    transcriptionAudioChunkSeconds: 600,
    isSpeechWavRequired: false,
    transcriptionAutoLanguageValue: 'auto',
    isTranscriptionBrowserAccessConfirmed: true,
  },
  custom: {
    transcriptionApiShape: 'audio-transcriptions-endpoint',
    suggestedTranscriptionModelNames: [],
    transcriptionAudioByteLimit: 25 * papelizMegabyte,
    transcriptionAudioChunkSeconds: 600,
    isSpeechWavRequired: false,
    transcriptionAutoLanguageValue: null,
    isTranscriptionBrowserAccessConfirmed: false,
  },
}

export function findPapelizAssistantImageGenerationPreset(papelizAssistantProviderId: string): PapelizAssistantImageGenerationPreset | null {
  return Object.hasOwn(papelizAssistantImageGenerationPresetsByProviderId, papelizAssistantProviderId)
    ? (papelizAssistantImageGenerationPresetsByProviderId[papelizAssistantProviderId] ?? null)
    : null
}

export function findPapelizAssistantTranscriptionPreset(papelizAssistantProviderId: string): PapelizAssistantTranscriptionPreset | null {
  return Object.hasOwn(papelizAssistantTranscriptionPresetsByProviderId, papelizAssistantProviderId)
    ? (papelizAssistantTranscriptionPresetsByProviderId[papelizAssistantProviderId] ?? null)
    : null
}

export interface PapelizAssistantPictureDescriptionPreset {
  // Chat models the provider's docs list as taking a picture (`image_url`, a `data:` URL included) on
  // its OpenAI-compatible chat endpoint, the most recommended first.
  suggestedVisionModelNames: readonly string[]
}

// The models Describe Picture offers: only chat models known to see pictures, read from each
// provider's docs on 2026-11-03. Any other added provider can still describe pictures with a vision
// model the person types (Other Model), as Ollama Local and LM Studio do with the model they run.
// Left out until their docs say more: Fireworks' vision model (its guide may be out of date), Groq's
// limited preview, and Ollama Cloud and OpenCode, whose docs name no vision model.
export const papelizAssistantPictureDescriptionPresetsByProviderId: Readonly<Record<string, PapelizAssistantPictureDescriptionPreset>> = {
  'meta-model-api': { suggestedVisionModelNames: ['muse-spark-1.3', 'muse-spark-1.2', 'muse-spark-1.1', 'muse-wonder-1.0'] },
  claude: { suggestedVisionModelNames: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'] },
  openai: { suggestedVisionModelNames: ['gpt-6-astra', 'gpt-6.1-sol', 'gpt-6.1-terra', 'gpt-6-luna'] },
  'google-gemini': { suggestedVisionModelNames: ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-4-argon'] },
  openrouter: { suggestedVisionModelNames: ['openai/gpt-6-astra', 'google/gemini-3.8-flash', 'anthropic/claude-sonnet-5.5', 'meta/muse-spark-1.3'] },
  groq: { suggestedVisionModelNames: ['qwen/qwen3.8-27b'] },
  together: { suggestedVisionModelNames: ['moonshotai/Kimi-K3', 'nvidia/NVIDIA-Nemotron-3.5-Super-VL', 'Qwen/Qwen3.5-9B'] },
  // deepseek-v4-pro sees no pictures.
  deepseek: { suggestedVisionModelNames: ['deepseek-flash'] },
}

export function findPapelizAssistantPictureDescriptionPreset(papelizAssistantProviderId: string): PapelizAssistantPictureDescriptionPreset | null {
  return Object.hasOwn(papelizAssistantPictureDescriptionPresetsByProviderId, papelizAssistantProviderId)
    ? (papelizAssistantPictureDescriptionPresetsByProviderId[papelizAssistantProviderId] ?? null)
    : null
}
