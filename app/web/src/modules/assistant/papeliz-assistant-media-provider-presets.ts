import type { PapelizTranscriptionApiShape } from './papeliz-assistant-image-and-audio-client'

// Which providers make pictures (Imagine) and turn speech into text (Transcribe), through which API and
// with which models, beside the chat presets (papeliz-assistant-provider-presets.ts). Read from each
// vendor's API docs on 2026-11-03. "Browser access confirmed" means the endpoint was asked without a
// key, as Chrome asks, whether `https://papeliz.com` may send Authorization and Content-Type to it,
// and said yes, the same day. A provider missing here offers neither: Claude, DeepSeek and Groq make
// no pictures; Claude and DeepSeek hear no audio; Fireworks retired both on 2026-06-10.
//
// The Meta Model API comes first and offers both: `muse-image-1.0` on the OpenAI-shaped
// `/images/generations` (WebP by default), and `muse-voice-transcribe-1.0` on its own
// `/asr/transcribe`, which takes a 16-bit mono WAV of up to 10 minutes and labels speakers.

export interface PapelizAssistantImageSizeChoice {
  imageSizeText: string
  imageSizeLabel: string
}

export interface PapelizAssistantImageGenerationPreset {
  // Where the request goes, after the base URL: OpenAI's `images/generations`, OpenRouter's `images`.
  imageGenerationProviderPath: string
  suggestedImageModelNames: readonly string[]
  // The first is the default. Empty: no size is sent, and the provider picks.
  imageSizeChoices: readonly PapelizAssistantImageSizeChoice[]
  // How the size is sent: "1024x1024" as `size`, or as `width` and `height` (Together).
  imageSizeFieldStyle: 'size-text' | 'width-and-height'
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

const papelizSquareLandscapePortraitImageSizes: readonly PapelizAssistantImageSizeChoice[] = [
  { imageSizeText: '1024x1024', imageSizeLabel: 'Square' },
  { imageSizeText: '1536x1024', imageSizeLabel: 'Landscape' },
  { imageSizeText: '1024x1536', imageSizeLabel: 'Portrait' },
]

const papelizMegabyte = 1024 * 1024

export const papelizAssistantImageGenerationPresetsByProviderId: Readonly<Record<string, PapelizAssistantImageGenerationPreset>> = {
  'meta-model-api': {
    imageGenerationProviderPath: 'images/generations',
    suggestedImageModelNames: ['muse-image-1.0'],
    // The size sets the shape; Meta picks the resolution.
    imageSizeChoices: papelizSquareLandscapePortraitImageSizes,
    imageSizeFieldStyle: 'size-text',
    imageResponseFormatValue: 'b64_json',
    isImageGenerationBrowserAccessConfirmed: true,
    isImageEditingOffered: true,
  },
  openai: {
    imageGenerationProviderPath: 'images/generations',
    suggestedImageModelNames: ['gpt-image-2', 'chatgpt-image-latest'],
    imageSizeChoices: [...papelizSquareLandscapePortraitImageSizes, { imageSizeText: 'auto', imageSizeLabel: 'Auto' }],
    imageSizeFieldStyle: 'size-text',
    imageResponseFormatValue: null,
    isImageGenerationBrowserAccessConfirmed: true,
  },
  'google-gemini': {
    imageGenerationProviderPath: 'images/generations',
    // The two its OpenAI-compatible endpoint's docs name.
    suggestedImageModelNames: ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'],
    imageSizeChoices: [],
    imageSizeFieldStyle: 'size-text',
    imageResponseFormatValue: 'b64_json',
    isImageGenerationBrowserAccessConfirmed: true,
  },
  openrouter: {
    // OpenRouter's own image API, which always answers in base64.
    imageGenerationProviderPath: 'images',
    suggestedImageModelNames: ['google/gemini-2.5-flash-image', 'openai/gpt-image-2', 'black-forest-labs/flux.2-pro'],
    imageSizeChoices: papelizSquareLandscapePortraitImageSizes,
    imageSizeFieldStyle: 'size-text',
    imageResponseFormatValue: null,
    isImageGenerationBrowserAccessConfirmed: true,
  },
  together: {
    imageGenerationProviderPath: 'images/generations',
    suggestedImageModelNames: ['black-forest-labs/FLUX.2-pro', 'black-forest-labs/FLUX.1.1-pro'],
    imageSizeChoices: [
      { imageSizeText: '1024x1024', imageSizeLabel: 'Square' },
      { imageSizeText: '1344x768', imageSizeLabel: 'Landscape' },
      { imageSizeText: '768x1344', imageSizeLabel: 'Portrait' },
    ],
    imageSizeFieldStyle: 'width-and-height',
    imageResponseFormatValue: 'base64',
    isImageGenerationBrowserAccessConfirmed: true,
  },
  // Any OpenAI-compatible API: the person types its image model.
  custom: {
    imageGenerationProviderPath: 'images/generations',
    suggestedImageModelNames: [],
    imageSizeChoices: papelizSquareLandscapePortraitImageSizes,
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
