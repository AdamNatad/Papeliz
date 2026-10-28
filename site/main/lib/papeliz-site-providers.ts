// The AI providers the assistant offers, in the app's order (app/web/src/modules/assistant/
// papeliz-assistant-provider-presets.ts). Each speaks the OpenAI-compatible format; a preset only
// fills in the base URL, and the user can change it. Providers whose servers refuse calls from a
// web page (Ollama Cloud, OpenCode Zen and Go, checked 2026-10-29) are left out, as in the app.

export type PapelizSiteProvider = {
  papelizSiteProviderName: string
  papelizSiteProviderDescription: string
  // A hosted provider's base URL; null for a provider that runs on the user's own computer.
  papelizSiteProviderBaseUrl: string | null
}

export const papelizSiteRecommendedProvider = {
  papelizSiteProviderName: 'Muse Spark · Meta Model API',
  papelizSiteProviderBaseUrl: 'https://api.meta.ai/v1',
  papelizSiteProviderModelNames: ['muse-spark-1.3', 'muse-spark-1.1'],
  papelizSiteProviderKeyPageUrl: 'https://dev.meta.ai/',
  papelizSiteProviderKeyPageLabel: 'Model API dashboard',
}

export const papelizSiteHostedProviders: readonly PapelizSiteProvider[] = [
  { papelizSiteProviderName: 'OpenAI', papelizSiteProviderDescription: 'OpenAI’s hosted models.', papelizSiteProviderBaseUrl: 'https://api.openai.com/v1' },
  { papelizSiteProviderName: 'OpenRouter', papelizSiteProviderDescription: 'Many hosted models behind one key.', papelizSiteProviderBaseUrl: 'https://openrouter.ai/api/v1' },
  { papelizSiteProviderName: 'Groq', papelizSiteProviderDescription: 'Fast hosted open-weights models.', papelizSiteProviderBaseUrl: 'https://api.groq.com/openai/v1' },
  { papelizSiteProviderName: 'Together', papelizSiteProviderDescription: 'Hosted open-weights models.', papelizSiteProviderBaseUrl: 'https://api.together.xyz/v1' },
  { papelizSiteProviderName: 'Fireworks', papelizSiteProviderDescription: 'Hosted open-weights models.', papelizSiteProviderBaseUrl: 'https://api.fireworks.ai/inference/v1' },
  {
    papelizSiteProviderName: 'Google Gemini',
    papelizSiteProviderDescription: 'Gemini models through Google’s OpenAI-compatible endpoint.',
    papelizSiteProviderBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  },
]

export const papelizSiteLocalProviders: readonly PapelizSiteProvider[] = [
  {
    papelizSiteProviderName: 'Ollama',
    papelizSiteProviderDescription: 'Models running on your computer. Allow Papeliz’s address in OLLAMA_ORIGINS first.',
    papelizSiteProviderBaseUrl: null,
  },
  { papelizSiteProviderName: 'LM Studio', papelizSiteProviderDescription: 'Models from LM Studio’s server on your computer.', papelizSiteProviderBaseUrl: null },
]

// The short list of names on the home page: every preset after the recommended one, then Custom.
export const papelizSiteOtherProviderNames = [
  ...papelizSiteHostedProviders.map((papelizSiteHostedProvider) => papelizSiteHostedProvider.papelizSiteProviderName),
  ...papelizSiteLocalProviders.map((papelizSiteLocalProvider) => papelizSiteLocalProvider.papelizSiteProviderName),
  'Any OpenAI-compatible URL',
]
