import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  papelizAssistantProviderKeysStoreName,
  papelizUserSettingsStoreName,
  readAllPapelizBrowserDatabaseRecords,
} from '../browser-database/papeliz-browser-database'
import { papelizActiveAssistantProviderModelNameSettingName, papelizActiveAssistantProviderSettingName } from '../settings/papeliz-user-settings'
import {
  getActivePapelizAssistantProviderConnection,
  resolvePapelizActiveAssistantProviderModel,
  selectActivePapelizAssistantProviderContextWindowTokenCount,
  usePapelizAssistantProviderSettingsStore,
  type PapelizAssistantProviderSettingsRecord,
} from './papeliz-assistant-provider-settings-store'

// The browser's IndexedDB, as plain maps: one per store, keyed as the real stores are.
const testBrowserDatabaseStores = vi.hoisted(() => new Map<string, Map<string, unknown>>())
vi.mock('../browser-database/papeliz-browser-database', async (importOriginal) => {
  const originalBrowserDatabaseModule = await importOriginal<typeof import('../browser-database/papeliz-browser-database')>()
  const testStoreKeyPaths: Record<string, string> = { papelizAssistantProviderKeys: 'papelizAssistantProviderId', papelizUserSettings: 'papelizUserSettingName' }
  const readTestStore = (objectStoreName: string) => {
    if (!testBrowserDatabaseStores.has(objectStoreName)) testBrowserDatabaseStores.set(objectStoreName, new Map())
    return testBrowserDatabaseStores.get(objectStoreName)!
  }
  return {
    ...originalBrowserDatabaseModule,
    isPapelizBrowserDatabaseAvailable: () => true,
    readPapelizBrowserDatabaseRecord: async (objectStoreName: string, storedRecordKey: string) => structuredClone(readTestStore(objectStoreName).get(storedRecordKey)),
    readAllPapelizBrowserDatabaseRecords: async (objectStoreName: string) => [...readTestStore(objectStoreName).values()].map((storedRecord) => structuredClone(storedRecord)),
    putPapelizBrowserDatabaseRecord: async (objectStoreName: string, storedRecord: Record<string, unknown>) => {
      readTestStore(objectStoreName).set(String(storedRecord[testStoreKeyPaths[objectStoreName]!]), structuredClone(storedRecord))
    },
    deletePapelizBrowserDatabaseRecord: async (objectStoreName: string, storedRecordKey: string) => {
      readTestStore(objectStoreName).delete(storedRecordKey)
    },
  }
})

function storeTestBrowserDatabaseRecord(objectStoreName: string, storedRecordKey: string, storedRecord: unknown) {
  if (!testBrowserDatabaseStores.has(objectStoreName)) testBrowserDatabaseStores.set(objectStoreName, new Map())
  testBrowserDatabaseStores.get(objectStoreName)!.set(storedRecordKey, storedRecord)
}

function storeTestUserSetting(papelizUserSettingName: string, papelizUserSettingValue: unknown) {
  storeTestBrowserDatabaseRecord(papelizUserSettingsStoreName, papelizUserSettingName, { papelizUserSettingName, papelizUserSettingValue })
}

const metaProviderSettings: PapelizAssistantProviderSettingsRecord = {
  papelizAssistantProviderId: 'meta-model-api',
  providerBaseUrl: 'https://api.meta.ai/v1',
  providerApiKey: 'test-meta-key',
  enabledProviderModelNames: ['muse-spark-1.3', 'muse-spark-1.1'],
}
const openRouterProviderSettings: PapelizAssistantProviderSettingsRecord = {
  papelizAssistantProviderId: 'openrouter',
  providerBaseUrl: 'https://openrouter.ai/api/v1',
  providerApiKey: 'test-openrouter-key',
  enabledProviderModelNames: ['vendor/model-one'],
}

beforeEach(() => {
  testBrowserDatabaseStores.clear()
  usePapelizAssistantProviderSettingsStore.setState({
    activeAssistantProviderId: 'meta-model-api',
    activeAssistantProviderModelName: '',
    providerSettingsByProviderId: {},
    providerSettingsLoadState: 'not-loaded',
  })
})

describe('AI Provider settings with several providers', () => {
  it('carries today’s one saved provider over as the first provider, with its key and model and nothing to redo', async () => {
    // Saved before several providers: one row with one model, and the chosen provider's id.
    storeTestBrowserDatabaseRecord(papelizAssistantProviderKeysStoreName, 'openrouter', {
      papelizAssistantProviderId: 'openrouter',
      providerBaseUrl: 'https://openrouter.ai/api/v1',
      providerModelName: 'vendor/model-one',
      providerApiKey: 'test-openrouter-key',
    })
    storeTestUserSetting(papelizActiveAssistantProviderSettingName, 'openrouter')

    await usePapelizAssistantProviderSettingsStore.getState().loadAssistantProviderSettings()

    expect(usePapelizAssistantProviderSettingsStore.getState().providerSettingsByProviderId).toEqual({
      openrouter: {
        papelizAssistantProviderId: 'openrouter',
        providerBaseUrl: 'https://openrouter.ai/api/v1',
        providerApiKey: 'test-openrouter-key',
        enabledProviderModelNames: ['vendor/model-one'],
      },
    })
    expect(getActivePapelizAssistantProviderConnection()).toEqual({
      providerConnectionOutcome: 'ready',
      providerConnection: { providerBaseUrl: 'https://openrouter.ai/api/v1', providerApiKey: 'test-openrouter-key', providerModelName: 'vendor/model-one' },
      providerDisplayName: 'OpenRouter',
    })
    // The old row stays as it was until the provider is saved again; then it is saved in the new shape.
    await usePapelizAssistantProviderSettingsStore.getState().saveAssistantProviderSettings([
      usePapelizAssistantProviderSettingsStore.getState().providerSettingsByProviderId['openrouter']!,
    ])
    expect(await readAllPapelizBrowserDatabaseRecords(papelizAssistantProviderKeysStoreName)).toEqual([
      {
        papelizAssistantProviderId: 'openrouter',
        providerBaseUrl: 'https://openrouter.ai/api/v1',
        providerApiKey: 'test-openrouter-key',
        enabledProviderModelNames: ['vendor/model-one'],
      },
    ])
  })

  it('keeps several providers, each with its own key, and the model picked last across a reload', async () => {
    await usePapelizAssistantProviderSettingsStore.getState().saveAssistantProviderSettings([metaProviderSettings, openRouterProviderSettings])
    await usePapelizAssistantProviderSettingsStore.getState().chooseActiveAssistantProviderModel({ papelizAssistantProviderId: 'openrouter', providerModelName: 'vendor/model-one' })

    usePapelizAssistantProviderSettingsStore.setState({ providerSettingsByProviderId: {}, providerSettingsLoadState: 'not-loaded', activeAssistantProviderModelName: '' })
    await usePapelizAssistantProviderSettingsStore.getState().loadAssistantProviderSettings()

    const settingsState = usePapelizAssistantProviderSettingsStore.getState()
    expect(Object.keys(settingsState.providerSettingsByProviderId).sort()).toEqual(['meta-model-api', 'openrouter'])
    expect(settingsState.providerSettingsByProviderId['meta-model-api']?.providerApiKey).toBe('test-meta-key')
    expect(settingsState.providerSettingsByProviderId['openrouter']?.providerApiKey).toBe('test-openrouter-key')
    expect(testBrowserDatabaseStores.get(papelizUserSettingsStoreName)?.get(papelizActiveAssistantProviderModelNameSettingName)).toMatchObject({
      papelizUserSettingValue: 'vendor/model-one',
    })
    expect(resolvePapelizActiveAssistantProviderModel(settingsState)).toEqual({ papelizAssistantProviderId: 'openrouter', providerModelName: 'vendor/model-one' })
  })

  it('pairs each model with its own provider’s address and key only', async () => {
    await usePapelizAssistantProviderSettingsStore.getState().saveAssistantProviderSettings([metaProviderSettings, openRouterProviderSettings])

    await usePapelizAssistantProviderSettingsStore.getState().chooseActiveAssistantProviderModel({ papelizAssistantProviderId: 'meta-model-api', providerModelName: 'muse-spark-1.1' })
    expect(getActivePapelizAssistantProviderConnection()).toMatchObject({
      providerConnection: { providerBaseUrl: 'https://api.meta.ai/v1', providerApiKey: 'test-meta-key', providerModelName: 'muse-spark-1.1' },
    })

    await usePapelizAssistantProviderSettingsStore.getState().chooseActiveAssistantProviderModel({ papelizAssistantProviderId: 'openrouter', providerModelName: 'vendor/model-one' })
    expect(getActivePapelizAssistantProviderConnection()).toMatchObject({
      providerConnection: { providerBaseUrl: 'https://openrouter.ai/api/v1', providerApiKey: 'test-openrouter-key', providerModelName: 'vendor/model-one' },
    })
  })

  it('keeps the model in use when another provider is added, even one listed before it', async () => {
    await usePapelizAssistantProviderSettingsStore.getState().saveAssistantProviderSettings([openRouterProviderSettings])
    await usePapelizAssistantProviderSettingsStore.getState().saveAssistantProviderSettings([metaProviderSettings])

    expect(resolvePapelizActiveAssistantProviderModel(usePapelizAssistantProviderSettingsStore.getState())).toEqual({
      papelizAssistantProviderId: 'openrouter',
      providerModelName: 'vendor/model-one',
    })
    expect(testBrowserDatabaseStores.get(papelizUserSettingsStoreName)?.get(papelizActiveAssistantProviderSettingName)).toMatchObject({
      papelizUserSettingValue: 'openrouter',
    })
  })

  it('moves to the next model switched on when the picked one is switched off or its provider removed', async () => {
    await usePapelizAssistantProviderSettingsStore.getState().saveAssistantProviderSettings([metaProviderSettings, openRouterProviderSettings])
    await usePapelizAssistantProviderSettingsStore.getState().chooseActiveAssistantProviderModel({ papelizAssistantProviderId: 'meta-model-api', providerModelName: 'muse-spark-1.1' })

    // Switched off: the same provider's first model still on.
    await usePapelizAssistantProviderSettingsStore.getState().saveAssistantProviderSettings([{ ...metaProviderSettings, enabledProviderModelNames: ['muse-spark-1.3'] }])
    expect(resolvePapelizActiveAssistantProviderModel(usePapelizAssistantProviderSettingsStore.getState())).toEqual({
      papelizAssistantProviderId: 'meta-model-api',
      providerModelName: 'muse-spark-1.3',
    })

    // Removed: the next provider with a model on, and its row is gone from the browser.
    await usePapelizAssistantProviderSettingsStore.getState().forgetAssistantProviderSettings('meta-model-api')
    expect(resolvePapelizActiveAssistantProviderModel(usePapelizAssistantProviderSettingsStore.getState())).toEqual({
      papelizAssistantProviderId: 'openrouter',
      providerModelName: 'vendor/model-one',
    })
    expect(testBrowserDatabaseStores.get(papelizAssistantProviderKeysStoreName)?.has('meta-model-api')).toBe(false)

    // No model on anywhere: the assistant says what to do.
    await usePapelizAssistantProviderSettingsStore.getState().saveAssistantProviderSettings([{ ...openRouterProviderSettings, enabledProviderModelNames: [] }])
    expect(getActivePapelizAssistantProviderConnection()).toEqual({ providerConnectionOutcome: 'not-set-up', providerSetupProblem: 'Switch on a model.' })
  })

  it('saves switched-on models trimmed and each once, and asks for a key a provider needs', async () => {
    await usePapelizAssistantProviderSettingsStore.getState().saveAssistantProviderSettings([
      { ...openRouterProviderSettings, providerApiKey: '  ', enabledProviderModelNames: [' vendor/model-one ', 'vendor/model-one', ''] },
    ])
    expect(usePapelizAssistantProviderSettingsStore.getState().providerSettingsByProviderId['openrouter']?.enabledProviderModelNames).toEqual(['vendor/model-one'])
    expect(getActivePapelizAssistantProviderConnection()).toEqual({ providerConnectionOutcome: 'not-set-up', providerSetupProblem: 'Add your OpenRouter API key.' })
  })

  it('gives Claude Anthropic’s browser header, and keeps only Advanced settings that read', async () => {
    await usePapelizAssistantProviderSettingsStore.getState().saveAssistantProviderSettings([
      {
        papelizAssistantProviderId: 'claude',
        providerBaseUrl: 'https://api.anthropic.com/v1',
        providerApiKey: 'test-claude-key',
        enabledProviderModelNames: ['claude-sonnet-5-5'],
        providerContextWindowTokenCount: 200000,
        providerMaximumOutputTokenCount: 1.5,
        providerTemperature: 0.7,
      },
    ])

    expect(usePapelizAssistantProviderSettingsStore.getState().providerSettingsByProviderId['claude']).toEqual({
      papelizAssistantProviderId: 'claude',
      providerBaseUrl: 'https://api.anthropic.com/v1',
      providerApiKey: 'test-claude-key',
      enabledProviderModelNames: ['claude-sonnet-5-5'],
      providerContextWindowTokenCount: 200000,
      providerTemperature: 0.7,
    })
    expect(selectActivePapelizAssistantProviderContextWindowTokenCount(usePapelizAssistantProviderSettingsStore.getState())).toBe(200000)
    expect(getActivePapelizAssistantProviderConnection()).toEqual({
      providerConnectionOutcome: 'ready',
      providerConnection: {
        providerBaseUrl: 'https://api.anthropic.com/v1',
        providerApiKey: 'test-claude-key',
        providerModelName: 'claude-sonnet-5-5',
        providerExtraRequestHeaders: { 'anthropic-dangerous-direct-browser-access': 'true' },
        providerTemperature: 0.7,
      },
      providerDisplayName: 'Claude',
    })
  })
})
