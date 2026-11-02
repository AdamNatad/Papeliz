import { afterEach, describe, expect, it, vi } from 'vitest'
import { PapelizInMemoryVaultAdapter } from '../vault/papeliz-in-memory-vault-adapter'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { usePapelizAssistantConversationStore } from './papeliz-assistant-conversation-store'
import { runPapelizInlineEdit } from './papeliz-assistant-inline-edit-run'
import { usePapelizAssistantProviderSettingsStore } from './papeliz-assistant-provider-settings-store'
import { usePapelizAssistantRunOptionsStore } from './papeliz-assistant-run-options-store'

interface RecordedProviderRequest {
  providerRequestUrl: string
  providerRequestAuthorization: string | null
  providerRequestModelName: string
}

// Two made-up providers that answer every request and record where it went, with which key.
function createRecordingProviderFetch() {
  const recordedProviderRequests: RecordedProviderRequest[] = []
  const recordingProviderFetch = vi.fn(async (requestUrl: string, requestInit: RequestInit) => {
    recordedProviderRequests.push({
      providerRequestUrl: requestUrl,
      providerRequestAuthorization: new Headers(requestInit.headers).get('Authorization'),
      providerRequestModelName: (JSON.parse(String(requestInit.body)) as { model: string }).model,
    })
    return Response.json({ choices: [{ message: { content: 'Done.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 10 } })
  })
  return { recordingProviderFetch, recordedProviderRequests }
}

async function waitUntil(isConditionMet: () => boolean) {
  for (let attempt = 0; attempt < 100 && !isConditionMet(); attempt += 1) await new Promise((resolveWait) => setTimeout(resolveWait, 10))
}

afterEach(async () => {
  vi.unstubAllGlobals()
  usePapelizAssistantConversationStore.getState().startNewAssistantChat()
  usePapelizAssistantRunOptionsStore.setState({ assistantMode: 'ask' })
  await usePapelizWorkspaceStore.getState().closeVaultInWorkspace()
})

describe('several providers and models in the assistant', () => {
  it('sends each message to the model picked on the chip, with that provider’s key only, and inline edits follow the pick', async () => {
    const { recordingProviderFetch, recordedProviderRequests } = createRecordingProviderFetch()
    vi.stubGlobal('fetch', recordingProviderFetch)
    await usePapelizWorkspaceStore.getState().openVaultInWorkspace(
      {
        papelizVaultId: `provider-model-switch-${crypto.randomUUID()}`,
        papelizVaultDisplayName: 'Test vault',
        papelizVaultAdapter: new PapelizInMemoryVaultAdapter([{ vaultNoteRelativePath: 'Garden.md', vaultNoteText: '# Garden' }]),
      },
      { firstVaultNoteRelativePathToOpen: null, firstNoteViewMode: 'md-view', expandAllTopLevelFolders: false },
    )
    await waitUntil(() => usePapelizWorkspaceStore.getState().vaultTreeEntries.length > 0)
    usePapelizAssistantProviderSettingsStore.setState({
      activeAssistantProviderId: 'meta-model-api',
      activeAssistantProviderModelName: 'muse-spark-1.1',
      providerSettingsByProviderId: {
        'meta-model-api': {
          papelizAssistantProviderId: 'meta-model-api',
          providerBaseUrl: 'https://first-provider.test/v1',
          providerApiKey: 'test-first-key',
          enabledProviderModelNames: ['muse-spark-1.3', 'muse-spark-1.1'],
        },
        openrouter: {
          papelizAssistantProviderId: 'openrouter',
          providerBaseUrl: 'https://second-provider.test/api/v1',
          providerApiKey: 'test-second-key',
          enabledProviderModelNames: ['vendor/model-one'],
        },
      },
    })

    await usePapelizAssistantConversationStore.getState().sendAssistantMessage('First question')
    // What the chip shows is what is asked.
    usePapelizAssistantProviderSettingsStore.setState({ activeAssistantProviderId: 'openrouter', activeAssistantProviderModelName: 'vendor/model-one' })
    await usePapelizAssistantConversationStore.getState().sendAssistantMessage('Second question')
    await runPapelizInlineEdit({
      inlineEditInstruction: 'Shorter',
      selectedPassageText: 'A long passage.',
      vaultNoteTitle: 'Garden',
      abortSignal: new AbortController().signal,
      onReplacementTextDelta: () => undefined,
    })

    expect(recordedProviderRequests).toEqual([
      { providerRequestUrl: 'https://first-provider.test/v1/chat/completions', providerRequestAuthorization: 'Bearer test-first-key', providerRequestModelName: 'muse-spark-1.1' },
      { providerRequestUrl: 'https://second-provider.test/api/v1/chat/completions', providerRequestAuthorization: 'Bearer test-second-key', providerRequestModelName: 'vendor/model-one' },
      { providerRequestUrl: 'https://second-provider.test/api/v1/chat/completions', providerRequestAuthorization: 'Bearer test-second-key', providerRequestModelName: 'vendor/model-one' },
    ])
  })
})
