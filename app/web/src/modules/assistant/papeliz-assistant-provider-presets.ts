// The providers offered in settings. Each speaks the OpenAI Chat Completions format; a preset only
// fills in the base URL and suggests models, and the user can change both. The first one is
// preselected. "Browser access confirmed" means a call straight from a browser page was checked
// to be allowed; the others are expected to work but are not checked yet.

export interface PapelizAssistantProviderPreset {
  papelizAssistantProviderId: string
  providerPresetDisplayName: string
  providerPresetDescription: string
  providerBaseUrl: string
  suggestedProviderModelNames: readonly string[]
  isProviderApiKeyRequired: boolean
  providerApiKeyHelpUrl: string | null
  isBrowserAccessConfirmed: boolean
}

export const papelizCustomAssistantProviderId = 'custom'

export const papelizAssistantProviderPresets: readonly PapelizAssistantProviderPreset[] = [
  {
    papelizAssistantProviderId: 'meta-model-api',
    providerPresetDisplayName: 'Muse Spark · Meta Model API',
    providerPresetDescription: 'Recommended. Long context, so the assistant can work across many notes at once.',
    providerBaseUrl: 'https://api.meta.ai/v1',
    suggestedProviderModelNames: ['muse-spark-1.3', 'muse-spark-1.1'],
    isProviderApiKeyRequired: true,
    providerApiKeyHelpUrl: 'https://dev.meta.ai/',
    isBrowserAccessConfirmed: true,
  },
  {
    papelizAssistantProviderId: 'openai',
    providerPresetDisplayName: 'OpenAI',
    providerPresetDescription: 'OpenAI’s hosted models.',
    providerBaseUrl: 'https://api.openai.com/v1',
    suggestedProviderModelNames: [],
    isProviderApiKeyRequired: true,
    providerApiKeyHelpUrl: 'https://platform.openai.com/api-keys',
    isBrowserAccessConfirmed: true,
  },
  {
    papelizAssistantProviderId: 'openrouter',
    providerPresetDisplayName: 'OpenRouter',
    providerPresetDescription: 'Many hosted models behind one key.',
    providerBaseUrl: 'https://openrouter.ai/api/v1',
    suggestedProviderModelNames: [],
    isProviderApiKeyRequired: true,
    providerApiKeyHelpUrl: 'https://openrouter.ai/keys',
    isBrowserAccessConfirmed: false,
  },
  {
    papelizAssistantProviderId: 'groq',
    providerPresetDisplayName: 'Groq',
    providerPresetDescription: 'Fast hosted open-weights models.',
    providerBaseUrl: 'https://api.groq.com/openai/v1',
    suggestedProviderModelNames: [],
    isProviderApiKeyRequired: true,
    providerApiKeyHelpUrl: 'https://console.groq.com/keys',
    isBrowserAccessConfirmed: false,
  },
  {
    papelizAssistantProviderId: 'together',
    providerPresetDisplayName: 'Together',
    providerPresetDescription: 'Hosted open-weights models.',
    providerBaseUrl: 'https://api.together.xyz/v1',
    suggestedProviderModelNames: [],
    isProviderApiKeyRequired: true,
    providerApiKeyHelpUrl: 'https://api.together.ai/settings/api-keys',
    isBrowserAccessConfirmed: false,
  },
  {
    papelizAssistantProviderId: 'fireworks',
    providerPresetDisplayName: 'Fireworks',
    providerPresetDescription: 'Hosted open-weights models.',
    providerBaseUrl: 'https://api.fireworks.ai/inference/v1',
    suggestedProviderModelNames: [],
    isProviderApiKeyRequired: true,
    providerApiKeyHelpUrl: 'https://fireworks.ai/account/api-keys',
    isBrowserAccessConfirmed: false,
  },
  {
    papelizAssistantProviderId: 'google-gemini',
    providerPresetDisplayName: 'Google Gemini',
    providerPresetDescription: 'Gemini models through Google’s OpenAI-compatible endpoint.',
    providerBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    suggestedProviderModelNames: [],
    isProviderApiKeyRequired: true,
    providerApiKeyHelpUrl: 'https://aistudio.google.com/apikey',
    isBrowserAccessConfirmed: false,
  },
  {
    papelizAssistantProviderId: 'ollama-cloud',
    providerPresetDisplayName: 'Ollama Cloud',
    providerPresetDescription: 'Ollama’s hosted models, with a key from your ollama.com account.',
    providerBaseUrl: 'https://ollama.com/v1',
    suggestedProviderModelNames: [],
    isProviderApiKeyRequired: true,
    providerApiKeyHelpUrl: 'https://ollama.com/settings/keys',
    isBrowserAccessConfirmed: false,
  },
  {
    papelizAssistantProviderId: 'opencode-zen',
    providerPresetDisplayName: 'OpenCode Zen',
    providerPresetDescription: 'OpenCode’s pay-as-you-go models. Models served through Chat Completions work (DeepSeek, GLM, Kimi, MiniMax and others).',
    providerBaseUrl: 'https://opencode.ai/zen/v1',
    suggestedProviderModelNames: [],
    isProviderApiKeyRequired: true,
    providerApiKeyHelpUrl: 'https://opencode.ai/zen',
    isBrowserAccessConfirmed: false,
  },
  {
    papelizAssistantProviderId: 'opencode-go',
    providerPresetDisplayName: 'OpenCode Go',
    providerPresetDescription: 'OpenCode’s subscription with a curated set of open models. Models served through Chat Completions work.',
    providerBaseUrl: 'https://opencode.ai/zen/go/v1',
    suggestedProviderModelNames: [],
    isProviderApiKeyRequired: true,
    providerApiKeyHelpUrl: 'https://opencode.ai/docs/go/',
    isBrowserAccessConfirmed: false,
  },
  {
    papelizAssistantProviderId: 'ollama',
    providerPresetDisplayName: 'Ollama (on this computer)',
    providerPresetDescription: 'Local models. Allow Papeliz’s address in OLLAMA_ORIGINS first.',
    providerBaseUrl: 'http://localhost:11434/v1',
    suggestedProviderModelNames: [],
    isProviderApiKeyRequired: false,
    providerApiKeyHelpUrl: null,
    isBrowserAccessConfirmed: false,
  },
  {
    papelizAssistantProviderId: 'lm-studio',
    providerPresetDisplayName: 'LM Studio (on this computer)',
    providerPresetDescription: 'Local models from LM Studio’s server.',
    providerBaseUrl: 'http://localhost:1234/v1',
    suggestedProviderModelNames: [],
    isProviderApiKeyRequired: false,
    providerApiKeyHelpUrl: null,
    isBrowserAccessConfirmed: false,
  },
  {
    papelizAssistantProviderId: papelizCustomAssistantProviderId,
    providerPresetDisplayName: 'Custom',
    providerPresetDescription: 'Any OpenAI-compatible API: type its base URL.',
    providerBaseUrl: '',
    suggestedProviderModelNames: [],
    isProviderApiKeyRequired: false,
    providerApiKeyHelpUrl: null,
    isBrowserAccessConfirmed: false,
  },
]

export const papelizDefaultAssistantProviderId = papelizAssistantProviderPresets[0]?.papelizAssistantProviderId ?? papelizCustomAssistantProviderId

export function findPapelizAssistantProviderPreset(papelizAssistantProviderId: string): PapelizAssistantProviderPreset {
  return (
    papelizAssistantProviderPresets.find((providerPreset) => providerPreset.papelizAssistantProviderId === papelizAssistantProviderId) ??
    papelizAssistantProviderPresets[papelizAssistantProviderPresets.length - 1]!
  )
}

// How many tokens each suggested model's context window holds, for the gauge beside the model chip.
// Only a published size goes here. `null` means the size is not confirmed yet, and the gauge then
// shows only the tokens the chat holds, never a guessed limit; so does any model not listed.
export const papelizAssistantModelContextWindowTokenCounts: Readonly<Record<string, number | null>> = {
  // Long context ("about a million tokens"), but no exact size is confirmed yet.
  'muse-spark-1.3': null,
  'muse-spark-1.1': null,
}

// A model's context window size, by its name as typed or after a provider's "vendor/" prefix.
export function findPapelizAssistantModelContextWindowTokenCount(providerModelName: string): number | null {
  const normalizedProviderModelName = providerModelName.trim().toLowerCase()
  const unprefixedProviderModelName = normalizedProviderModelName.slice(normalizedProviderModelName.lastIndexOf('/') + 1)
  const readListedContextWindowTokenCount = (listedProviderModelName: string) =>
    Object.hasOwn(papelizAssistantModelContextWindowTokenCounts, listedProviderModelName)
      ? (papelizAssistantModelContextWindowTokenCounts[listedProviderModelName] ?? null)
      : null
  return readListedContextWindowTokenCount(normalizedProviderModelName) ?? readListedContextWindowTokenCount(unprefixedProviderModelName)
}
