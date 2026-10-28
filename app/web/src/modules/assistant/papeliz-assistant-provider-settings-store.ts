import { create } from 'zustand'
import {
  deletePapelizBrowserDatabaseRecord,
  isPapelizBrowserDatabaseAvailable,
  papelizAssistantProviderKeysStoreName,
  putPapelizBrowserDatabaseRecord,
  readAllPapelizBrowserDatabaseRecords,
} from '../browser-database/papeliz-browser-database'
import { papelizActiveAssistantProviderSettingName, readPapelizUserSetting, writePapelizUserSetting } from '../settings/papeliz-user-settings'
import type { PapelizAssistantProviderConnection } from './papeliz-openai-compatible-client'
import { findPapelizAssistantProviderPreset, papelizDefaultAssistantProviderId } from './papeliz-assistant-provider-presets'

// One row of the IndexedDB store `papelizAssistantProviderKeys`: what the user set for one
// provider. The key stays in this browser's IndexedDB and goes only to `providerBaseUrl`.
export interface PapelizAssistantProviderSettingsRecord {
  papelizAssistantProviderId: string
  providerBaseUrl: string
  providerModelName: string
  providerApiKey: string
}

interface PapelizAssistantProviderSettingsState {
  activeAssistantProviderId: string
  providerSettingsByProviderId: Record<string, PapelizAssistantProviderSettingsRecord>
  providerSettingsLoadState: 'not-loaded' | 'loading' | 'loaded'
  loadAssistantProviderSettings: () => Promise<void>
  saveAssistantProviderSettings: (providerSettings: PapelizAssistantProviderSettingsRecord, shouldMakeActive: boolean) => Promise<void>
  forgetAssistantProviderSettings: (papelizAssistantProviderId: string) => Promise<void>
}

export function createDefaultPapelizAssistantProviderSettings(papelizAssistantProviderId: string): PapelizAssistantProviderSettingsRecord {
  const providerPreset = findPapelizAssistantProviderPreset(papelizAssistantProviderId)
  return {
    papelizAssistantProviderId,
    providerBaseUrl: providerPreset.providerBaseUrl,
    providerModelName: providerPreset.suggestedProviderModelNames[0] ?? '',
    providerApiKey: '',
  }
}

export const usePapelizAssistantProviderSettingsStore = create<PapelizAssistantProviderSettingsState>()((setSettingsState, getSettingsState) => ({
  activeAssistantProviderId: papelizDefaultAssistantProviderId,
  providerSettingsByProviderId: {},
  providerSettingsLoadState: 'not-loaded',

  loadAssistantProviderSettings: async () => {
    if (getSettingsState().providerSettingsLoadState !== 'not-loaded') return
    setSettingsState({ providerSettingsLoadState: 'loading' })
    const storedProviderSettings = isPapelizBrowserDatabaseAvailable()
      ? await readAllPapelizBrowserDatabaseRecords<PapelizAssistantProviderSettingsRecord>(papelizAssistantProviderKeysStoreName).catch(() => [])
      : []
    const activeAssistantProviderId = await readPapelizUserSetting<string>(papelizActiveAssistantProviderSettingName, papelizDefaultAssistantProviderId)
    setSettingsState({
      activeAssistantProviderId,
      providerSettingsByProviderId: Object.fromEntries(
        storedProviderSettings.map((providerSettings) => [providerSettings.papelizAssistantProviderId, providerSettings]),
      ),
      providerSettingsLoadState: 'loaded',
    })
  },

  saveAssistantProviderSettings: async (providerSettings, shouldMakeActive) => {
    const trimmedProviderSettings: PapelizAssistantProviderSettingsRecord = {
      ...providerSettings,
      providerBaseUrl: providerSettings.providerBaseUrl.trim(),
      providerModelName: providerSettings.providerModelName.trim(),
      providerApiKey: providerSettings.providerApiKey.trim(),
    }
    setSettingsState((settingsState) => ({
      providerSettingsByProviderId: { ...settingsState.providerSettingsByProviderId, [trimmedProviderSettings.papelizAssistantProviderId]: trimmedProviderSettings },
      activeAssistantProviderId: shouldMakeActive ? trimmedProviderSettings.papelizAssistantProviderId : settingsState.activeAssistantProviderId,
    }))
    if (isPapelizBrowserDatabaseAvailable()) await putPapelizBrowserDatabaseRecord(papelizAssistantProviderKeysStoreName, trimmedProviderSettings)
    if (shouldMakeActive) await writePapelizUserSetting(papelizActiveAssistantProviderSettingName, trimmedProviderSettings.papelizAssistantProviderId)
  },

  forgetAssistantProviderSettings: async (papelizAssistantProviderId) => {
    setSettingsState((settingsState) => {
      const providerSettingsByProviderId = { ...settingsState.providerSettingsByProviderId }
      delete providerSettingsByProviderId[papelizAssistantProviderId]
      return { providerSettingsByProviderId }
    })
    if (isPapelizBrowserDatabaseAvailable()) await deletePapelizBrowserDatabaseRecord(papelizAssistantProviderKeysStoreName, papelizAssistantProviderId)
  },
}))

// The setup problem while no provider has been chosen at all.
export const papelizAssistantProviderNotChosenProblem = 'Add your provider and API key to start.'

// The provider the assistant should use now, or a plain reason why it can't run yet.
export function getActivePapelizAssistantProviderConnection():
  | { providerConnectionOutcome: 'ready'; providerConnection: PapelizAssistantProviderConnection; providerDisplayName: string }
  | { providerConnectionOutcome: 'not-set-up'; providerSetupProblem: string } {
  const settingsState = usePapelizAssistantProviderSettingsStore.getState()
  const providerPreset = findPapelizAssistantProviderPreset(settingsState.activeAssistantProviderId)
  const providerSettings = settingsState.providerSettingsByProviderId[settingsState.activeAssistantProviderId]
  if (providerSettings === undefined) return { providerConnectionOutcome: 'not-set-up', providerSetupProblem: papelizAssistantProviderNotChosenProblem }
  if (providerSettings.providerBaseUrl.length === 0) return { providerConnectionOutcome: 'not-set-up', providerSetupProblem: 'Set the provider’s base URL.' }
  if (providerSettings.providerModelName.length === 0) return { providerConnectionOutcome: 'not-set-up', providerSetupProblem: 'Choose a model.' }
  if (providerPreset.isProviderApiKeyRequired && providerSettings.providerApiKey.length === 0) {
    return { providerConnectionOutcome: 'not-set-up', providerSetupProblem: `Add your ${providerPreset.providerPresetDisplayName} API key.` }
  }
  return {
    providerConnectionOutcome: 'ready',
    providerConnection: {
      providerBaseUrl: providerSettings.providerBaseUrl,
      providerApiKey: providerSettings.providerApiKey,
      providerModelName: providerSettings.providerModelName,
    },
    providerDisplayName: providerPreset.providerPresetDisplayName,
  }
}
