// The providers offered in settings. Each speaks the OpenAI Chat Completions format; a preset only
// fills in the base URL and suggests models, and the user can change both. The first one is
// preselected. "Browser access confirmed" means a call straight from a browser page was checked
// to be allowed: on 2026-10-29 each hosted provider was asked, as Chrome asks, whether papeliz.com
// may send Authorization and Content-Type to its chat and model list. Meta, OpenAI, OpenRouter,
// Groq, Together, Fireworks and Google Gemini allow it. Ollama Cloud refuses it (405, no
// permission header) and OpenCode Zen and Go refuse it for chat (404), so a web page can't reach
// them; an app outside the browser could. Claude's API (checked 2026-11-03 the same way) allows
// papeliz.com its chat and model list only when the request also sends Anthropic's header for calls
// from a browser page, which the Claude preset adds (`providerExtraRequestHeaders`).

export interface PapelizAssistantProviderPreset {
  papelizAssistantProviderId: string
  providerPresetDisplayName: string
  providerPresetDescription: string
  providerBaseUrl: string
  suggestedProviderModelNames: readonly string[]
  isProviderApiKeyRequired: boolean
  providerApiKeyHelpUrl: string | null
  isBrowserAccessConfirmed: boolean
  // Where the provider runs, for the groups of Add Provider's list.
  providerPresetPlace: 'hosted' | 'this-computer' | 'any-address'
  // Headers this provider needs on every request besides the key's.
  providerExtraRequestHeaders?: Readonly<Record<string, string>>
}

export const papelizCustomAssistantProviderId = 'custom'

export const papelizAssistantProviderPresets: readonly PapelizAssistantProviderPreset[] = [
  {
    papelizAssistantProviderId: 'meta-model-api',
    providerPresetDisplayName: 'Meta Model API',
    providerPresetDescription: 'Recommended. Long context, so the assistant can work across many notes at once.',
    providerBaseUrl: 'https://api.meta.ai/v1',
    suggestedProviderModelNames: ['muse-spark-1.3', 'muse-spark-1.1'],
    isProviderApiKeyRequired: true,
    providerApiKeyHelpUrl: 'https://dev.meta.ai/',
    isBrowserAccessConfirmed: true,
    providerPresetPlace: 'hosted',
  },
  {
    papelizAssistantProviderId: 'claude',
    providerPresetDisplayName: 'Claude',
    providerPresetDescription: 'Anthropic’s Claude models.',
    providerBaseUrl: 'https://api.anthropic.com/v1',
    suggestedProviderModelNames: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5'],
    isProviderApiKeyRequired: true,
    providerApiKeyHelpUrl: 'https://console.anthropic.com/settings/keys',
    isBrowserAccessConfirmed: true,
    providerPresetPlace: 'hosted',
    providerExtraRequestHeaders: { 'anthropic-dangerous-direct-browser-access': 'true' },
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
    providerPresetPlace: 'hosted',
  },
  {
    papelizAssistantProviderId: 'openrouter',
    providerPresetDisplayName: 'OpenRouter',
    providerPresetDescription: 'Many hosted models behind one key.',
    providerBaseUrl: 'https://openrouter.ai/api/v1',
    suggestedProviderModelNames: [],
    isProviderApiKeyRequired: true,
    providerApiKeyHelpUrl: 'https://openrouter.ai/keys',
    isBrowserAccessConfirmed: true,
    providerPresetPlace: 'hosted',
  },
  {
    papelizAssistantProviderId: 'groq',
    providerPresetDisplayName: 'Groq',
    providerPresetDescription: 'Fast hosted open-weights models.',
    providerBaseUrl: 'https://api.groq.com/openai/v1',
    suggestedProviderModelNames: [],
    isProviderApiKeyRequired: true,
    providerApiKeyHelpUrl: 'https://console.groq.com/keys',
    isBrowserAccessConfirmed: true,
    providerPresetPlace: 'hosted',
  },
  {
    papelizAssistantProviderId: 'together',
    providerPresetDisplayName: 'Together',
    providerPresetDescription: 'Hosted open-weights models.',
    providerBaseUrl: 'https://api.together.xyz/v1',
    suggestedProviderModelNames: [],
    isProviderApiKeyRequired: true,
    providerApiKeyHelpUrl: 'https://api.together.ai/settings/api-keys',
    isBrowserAccessConfirmed: true,
    providerPresetPlace: 'hosted',
  },
  {
    papelizAssistantProviderId: 'fireworks',
    providerPresetDisplayName: 'Fireworks',
    providerPresetDescription: 'Hosted open-weights models.',
    providerBaseUrl: 'https://api.fireworks.ai/inference/v1',
    suggestedProviderModelNames: [],
    isProviderApiKeyRequired: true,
    providerApiKeyHelpUrl: 'https://fireworks.ai/account/api-keys',
    isBrowserAccessConfirmed: true,
    providerPresetPlace: 'hosted',
  },
  {
    papelizAssistantProviderId: 'google-gemini',
    providerPresetDisplayName: 'Google Gemini',
    providerPresetDescription: 'Gemini models through Google’s OpenAI-compatible endpoint.',
    providerBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    suggestedProviderModelNames: [],
    isProviderApiKeyRequired: true,
    providerApiKeyHelpUrl: 'https://aistudio.google.com/apikey',
    isBrowserAccessConfirmed: true,
    providerPresetPlace: 'hosted',
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
    providerPresetPlace: 'hosted',
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
    providerPresetPlace: 'hosted',
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
    providerPresetPlace: 'hosted',
  },
  {
    papelizAssistantProviderId: 'ollama',
    providerPresetDisplayName: 'Ollama Local',
    providerPresetDescription: 'Local models. Allow Papeliz’s address in OLLAMA_ORIGINS first.',
    providerBaseUrl: 'http://localhost:11434/v1',
    suggestedProviderModelNames: [],
    isProviderApiKeyRequired: false,
    providerApiKeyHelpUrl: null,
    isBrowserAccessConfirmed: false,
    providerPresetPlace: 'this-computer',
  },
  {
    papelizAssistantProviderId: 'lm-studio',
    providerPresetDisplayName: 'LM Studio Local',
    providerPresetDescription: 'Local models from LM Studio’s server.',
    providerBaseUrl: 'http://localhost:1234/v1',
    suggestedProviderModelNames: [],
    isProviderApiKeyRequired: false,
    providerApiKeyHelpUrl: null,
    isBrowserAccessConfirmed: false,
    providerPresetPlace: 'this-computer',
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
    providerPresetPlace: 'any-address',
  },
]

export const papelizDefaultAssistantProviderId = papelizAssistantProviderPresets[0]?.papelizAssistantProviderId ?? papelizCustomAssistantProviderId

// Providers whose servers refuse calls from a web page (checked 2026-10-29, above). Settings hides
// them until they allow it; a desktop app, outside the browser, could offer them.
export const papelizBrowserBlockedAssistantProviderIds: readonly string[] = ['ollama-cloud', 'opencode-zen', 'opencode-go']

// Providers whose answers carry what each request cost, which Usage counts before any price.
export const papelizRequestCostReportingAssistantProviderIds: readonly string[] = ['openrouter']

// The providers settings offers: the Meta Model API first, then Claude, then every other provider a
// web page can reach, those on this computer and Custom (Adam, 2026-10-29: "remove ollama cloud for
// now", then "Openrouter works or whatever works on the provider put it in"; 2026-11-02: "Meta Model
// API / Claude / OpenAI"). A hidden one stays defined, so settings saved for it still open, and it
// stays listed while it is the one chosen.
export const papelizOfferedAssistantProviderIds: readonly string[] = papelizAssistantProviderPresets
  .map((providerPreset) => providerPreset.papelizAssistantProviderId)
  .filter((papelizAssistantProviderId) => !papelizBrowserBlockedAssistantProviderIds.includes(papelizAssistantProviderId))

export function listPapelizOfferedAssistantProviderPresets(chosenAssistantProviderId: string): readonly PapelizAssistantProviderPreset[] {
  return papelizAssistantProviderPresets.filter(
    (providerPreset) =>
      papelizOfferedAssistantProviderIds.includes(providerPreset.papelizAssistantProviderId) || providerPreset.papelizAssistantProviderId === chosenAssistantProviderId,
  )
}

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
