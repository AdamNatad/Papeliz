import { create } from 'zustand'
import {
  deletePapelizBrowserDatabaseRecord,
  isPapelizBrowserDatabaseAvailable,
  papelizAssistantProviderKeysStoreName,
  putPapelizBrowserDatabaseRecord,
  readAllPapelizBrowserDatabaseRecords,
} from '../browser-database/papeliz-browser-database'
import {
  papelizActiveAssistantProviderModelNameSettingName,
  papelizActiveAssistantProviderSettingName,
  readPapelizUserSetting,
  writePapelizUserSetting,
} from '../settings/papeliz-user-settings'
import type { PapelizAssistantProviderConnection } from './papeliz-openai-compatible-client'
import { findPapelizAssistantProviderPreset, papelizAssistantProviderPresets, papelizDefaultAssistantProviderId } from './papeliz-assistant-provider-presets'

// One row of the IndexedDB store `papelizAssistantProviderKeys`: what the user set for one
// provider. Several providers can be saved at once, one row each. Each key stays in this browser's
// IndexedDB and goes only to its own row's `providerBaseUrl`.
export interface PapelizAssistantProviderSettingsRecord {
  papelizAssistantProviderId: string
  providerBaseUrl: string
  providerApiKey: string
  // The models switched on for the assistant's model chip, in the order they were switched on.
  enabledProviderModelNames?: string[]
  // Saved before several models could be switched on: the provider's one model. It counts as the
  // only model switched on until the provider is saved again (listPapelizEnabledProviderModelNames).
  providerModelName?: string
  // Advanced, each left out for the provider's own default: the context window the assistant's gauge
  // measures against, the most tokens an answer may use (`max_tokens`) and the `temperature` sent.
  providerContextWindowTokenCount?: number
  providerMaximumOutputTokenCount?: number
  providerTemperature?: number
}

// The provider and model the assistant answers with.
export interface PapelizActiveAssistantProviderModel {
  papelizAssistantProviderId: string
  providerModelName: string
}

interface PapelizAssistantProviderSettingsState {
  // The provider and model picked last on the model chip. When that model is switched off or its
  // provider removed, the assistant uses the next one switched on (resolvePapelizActiveAssistantProviderModel).
  activeAssistantProviderId: string
  activeAssistantProviderModelName: string
  providerSettingsByProviderId: Record<string, PapelizAssistantProviderSettingsRecord>
  providerSettingsLoadState: 'not-loaded' | 'loading' | 'loaded'
  loadAssistantProviderSettings: () => Promise<void>
  // Saves each provider given, by its id; the others stay as they are.
  saveAssistantProviderSettings: (providerSettingsList: readonly PapelizAssistantProviderSettingsRecord[]) => Promise<void>
  forgetAssistantProviderSettings: (papelizAssistantProviderId: string) => Promise<void>
  chooseActiveAssistantProviderModel: (activeProviderModel: PapelizActiveAssistantProviderModel) => Promise<void>
}

// A provider's switched-on models. A row saved before several models could be switched on has only
// `providerModelName`, which carries over as its one model.
export function listPapelizEnabledProviderModelNames(providerSettings: PapelizAssistantProviderSettingsRecord | undefined): string[] {
  if (providerSettings === undefined) return []
  if (providerSettings.enabledProviderModelNames !== undefined) return providerSettings.enabledProviderModelNames
  const carriedOverProviderModelName = providerSettings.providerModelName?.trim() ?? ''
  return carriedOverProviderModelName.length > 0 ? [carriedOverProviderModelName] : []
}

// An Advanced number as it may be saved: a whole count of at least 1, or a temperature from 0 to 2.
export function readPapelizProviderTokenCount(storedTokenCount: unknown): number | undefined {
  return typeof storedTokenCount === 'number' && Number.isInteger(storedTokenCount) && storedTokenCount >= 1 ? storedTokenCount : undefined
}

export function readPapelizProviderTemperature(storedTemperature: unknown): number | undefined {
  return typeof storedTemperature === 'number' && Number.isFinite(storedTemperature) && storedTemperature >= 0 && storedTemperature <= 2 ? storedTemperature : undefined
}

// A row as it is saved now: switched-on models only, trimmed, each once, and the Advanced numbers
// that are set.
function normalizePapelizAssistantProviderSettings(providerSettings: PapelizAssistantProviderSettingsRecord): PapelizAssistantProviderSettingsRecord {
  const enabledProviderModelNames = [
    ...new Set(listPapelizEnabledProviderModelNames(providerSettings).map((providerModelName) => providerModelName.trim()).filter((providerModelName) => providerModelName.length > 0)),
  ]
  const providerContextWindowTokenCount = readPapelizProviderTokenCount(providerSettings.providerContextWindowTokenCount)
  const providerMaximumOutputTokenCount = readPapelizProviderTokenCount(providerSettings.providerMaximumOutputTokenCount)
  const providerTemperature = readPapelizProviderTemperature(providerSettings.providerTemperature)
  return {
    papelizAssistantProviderId: providerSettings.papelizAssistantProviderId,
    providerBaseUrl: providerSettings.providerBaseUrl.trim(),
    providerApiKey: providerSettings.providerApiKey.trim(),
    enabledProviderModelNames,
    ...(providerContextWindowTokenCount === undefined ? {} : { providerContextWindowTokenCount }),
    ...(providerMaximumOutputTokenCount === undefined ? {} : { providerMaximumOutputTokenCount }),
    ...(providerTemperature === undefined ? {} : { providerTemperature }),
  }
}

// What a provider's settings send with each request, besides the model: its own address and key,
// the headers its preset needs and its Advanced settings. Never another provider's.
export function buildPapelizAssistantProviderConnection(
  providerSettings: PapelizAssistantProviderSettingsRecord,
  providerModelName: string,
): PapelizAssistantProviderConnection {
  const providerPreset = findPapelizAssistantProviderPreset(providerSettings.papelizAssistantProviderId)
  const providerMaximumOutputTokenCount = readPapelizProviderTokenCount(providerSettings.providerMaximumOutputTokenCount)
  const providerTemperature = readPapelizProviderTemperature(providerSettings.providerTemperature)
  return {
    providerBaseUrl: providerSettings.providerBaseUrl.trim(),
    providerApiKey: providerSettings.providerApiKey.trim(),
    providerModelName,
    ...(providerPreset.providerExtraRequestHeaders === undefined ? {} : { providerExtraRequestHeaders: providerPreset.providerExtraRequestHeaders }),
    ...(providerMaximumOutputTokenCount === undefined ? {} : { providerMaximumOutputTokenCount }),
    ...(providerTemperature === undefined ? {} : { providerTemperature }),
  }
}

export function createDefaultPapelizAssistantProviderSettings(papelizAssistantProviderId: string): PapelizAssistantProviderSettingsRecord {
  const providerPreset = findPapelizAssistantProviderPreset(papelizAssistantProviderId)
  return {
    papelizAssistantProviderId,
    providerBaseUrl: providerPreset.providerBaseUrl,
    providerApiKey: '',
    enabledProviderModelNames: [],
  }
}

// The saved providers in the presets' order (the default preset first, Custom last).
export function listPapelizSavedAssistantProviderIds(providerSettingsByProviderId: Record<string, PapelizAssistantProviderSettingsRecord>): string[] {
  const presetProviderIds = papelizAssistantProviderPresets.map((providerPreset) => providerPreset.papelizAssistantProviderId)
  return Object.keys(providerSettingsByProviderId).sort(
    (firstProviderId, secondProviderId) =>
      (presetProviderIds.indexOf(firstProviderId) + 1 || presetProviderIds.length + 1) - (presetProviderIds.indexOf(secondProviderId) + 1 || presetProviderIds.length + 1),
  )
}

// The model the assistant uses: the one picked last while it is still switched on, else the picked
// provider's first model, else the first model of the first provider that has one. Null while no
// provider has a model switched on.
export function resolvePapelizActiveAssistantProviderModel(
  settingsState: Pick<PapelizAssistantProviderSettingsState, 'activeAssistantProviderId' | 'activeAssistantProviderModelName' | 'providerSettingsByProviderId'>,
): PapelizActiveAssistantProviderModel | null {
  const activeProviderModelNames = listPapelizEnabledProviderModelNames(settingsState.providerSettingsByProviderId[settingsState.activeAssistantProviderId])
  const activeProviderModelName = activeProviderModelNames.includes(settingsState.activeAssistantProviderModelName)
    ? settingsState.activeAssistantProviderModelName
    : activeProviderModelNames[0]
  if (activeProviderModelName !== undefined) return { papelizAssistantProviderId: settingsState.activeAssistantProviderId, providerModelName: activeProviderModelName }
  for (const savedProviderId of listPapelizSavedAssistantProviderIds(settingsState.providerSettingsByProviderId)) {
    const firstProviderModelName = listPapelizEnabledProviderModelNames(settingsState.providerSettingsByProviderId[savedProviderId])[0]
    if (firstProviderModelName !== undefined) return { papelizAssistantProviderId: savedProviderId, providerModelName: firstProviderModelName }
  }
  return null
}

// For components: plain strings, so a selector gives back the same value while nothing changed.
export function selectActivePapelizAssistantProviderModelName(settingsState: PapelizAssistantProviderSettingsState): string {
  return resolvePapelizActiveAssistantProviderModel(settingsState)?.providerModelName ?? ''
}

export function selectActivePapelizAssistantProviderId(settingsState: PapelizAssistantProviderSettingsState): string {
  return resolvePapelizActiveAssistantProviderModel(settingsState)?.papelizAssistantProviderId ?? settingsState.activeAssistantProviderId
}

// The context window set in Advanced for the provider in use, or null to go by the model's own.
export function selectActivePapelizAssistantProviderContextWindowTokenCount(settingsState: PapelizAssistantProviderSettingsState): number | null {
  const activeProviderModel = resolvePapelizActiveAssistantProviderModel(settingsState)
  if (activeProviderModel === null) return null
  return readPapelizProviderTokenCount(settingsState.providerSettingsByProviderId[activeProviderModel.papelizAssistantProviderId]?.providerContextWindowTokenCount) ?? null
}

export const usePapelizAssistantProviderSettingsStore = create<PapelizAssistantProviderSettingsState>()((setSettingsState, getSettingsState) => ({
  activeAssistantProviderId: papelizDefaultAssistantProviderId,
  activeAssistantProviderModelName: '',
  providerSettingsByProviderId: {},
  providerSettingsLoadState: 'not-loaded',

  loadAssistantProviderSettings: async () => {
    if (getSettingsState().providerSettingsLoadState !== 'not-loaded') return
    setSettingsState({ providerSettingsLoadState: 'loading' })
    const storedProviderSettings = isPapelizBrowserDatabaseAvailable()
      ? await readAllPapelizBrowserDatabaseRecords<PapelizAssistantProviderSettingsRecord>(papelizAssistantProviderKeysStoreName).catch(() => [])
      : []
    const activeAssistantProviderId = await readPapelizUserSetting<string>(papelizActiveAssistantProviderSettingName, papelizDefaultAssistantProviderId)
    // Saved before several models: none, so the active provider's one model is used.
    const activeAssistantProviderModelName = await readPapelizUserSetting<string>(papelizActiveAssistantProviderModelNameSettingName, '')
    setSettingsState({
      activeAssistantProviderId,
      activeAssistantProviderModelName,
      providerSettingsByProviderId: Object.fromEntries(
        storedProviderSettings.map((providerSettings) => [providerSettings.papelizAssistantProviderId, normalizePapelizAssistantProviderSettings(providerSettings)]),
      ),
      providerSettingsLoadState: 'loaded',
    })
  },

  saveAssistantProviderSettings: async (providerSettingsList) => {
    const normalizedProviderSettingsList = providerSettingsList.map(normalizePapelizAssistantProviderSettings)
    const activeProviderModelBeforeSave = resolvePapelizActiveAssistantProviderModel(getSettingsState())
    setSettingsState((settingsState) => ({
      providerSettingsByProviderId: {
        ...settingsState.providerSettingsByProviderId,
        ...Object.fromEntries(normalizedProviderSettingsList.map((providerSettings) => [providerSettings.papelizAssistantProviderId, providerSettings])),
      },
    }))
    if (isPapelizBrowserDatabaseAvailable()) {
      for (const providerSettings of normalizedProviderSettingsList) await putPapelizBrowserDatabaseRecord(papelizAssistantProviderKeysStoreName, providerSettings)
    }
    // Adding a provider or a model never changes the model in use; only the model chip does, or
    // switching that model off. The first save picks the first model switched on.
    const settingsStateAfterSave = getSettingsState()
    const isModelInUseStillOn =
      activeProviderModelBeforeSave !== null &&
      listPapelizEnabledProviderModelNames(settingsStateAfterSave.providerSettingsByProviderId[activeProviderModelBeforeSave.papelizAssistantProviderId]).includes(
        activeProviderModelBeforeSave.providerModelName,
      )
    const keptActiveProviderModel = isModelInUseStillOn ? activeProviderModelBeforeSave : resolvePapelizActiveAssistantProviderModel(settingsStateAfterSave)
    if (
      keptActiveProviderModel !== null &&
      (keptActiveProviderModel.papelizAssistantProviderId !== settingsStateAfterSave.activeAssistantProviderId ||
        keptActiveProviderModel.providerModelName !== settingsStateAfterSave.activeAssistantProviderModelName)
    ) {
      await getSettingsState().chooseActiveAssistantProviderModel(keptActiveProviderModel)
    }
  },

  forgetAssistantProviderSettings: async (papelizAssistantProviderId) => {
    setSettingsState((settingsState) => {
      const providerSettingsByProviderId = { ...settingsState.providerSettingsByProviderId }
      delete providerSettingsByProviderId[papelizAssistantProviderId]
      return { providerSettingsByProviderId }
    })
    if (isPapelizBrowserDatabaseAvailable()) await deletePapelizBrowserDatabaseRecord(papelizAssistantProviderKeysStoreName, papelizAssistantProviderId)
  },

  chooseActiveAssistantProviderModel: async ({ papelizAssistantProviderId, providerModelName }) => {
    setSettingsState({ activeAssistantProviderId: papelizAssistantProviderId, activeAssistantProviderModelName: providerModelName })
    await writePapelizUserSetting(papelizActiveAssistantProviderSettingName, papelizAssistantProviderId)
    await writePapelizUserSetting(papelizActiveAssistantProviderModelNameSettingName, providerModelName)
  },
}))

// The setup problem while no provider has been chosen at all.
export const papelizAssistantProviderNotChosenProblem = 'Add your provider and API key to start.'

// The provider and model the assistant should use now, or a plain reason why it can't run yet.
export function getActivePapelizAssistantProviderConnection():
  | { providerConnectionOutcome: 'ready'; providerConnection: PapelizAssistantProviderConnection; providerDisplayName: string }
  | { providerConnectionOutcome: 'not-set-up'; providerSetupProblem: string } {
  const settingsState = usePapelizAssistantProviderSettingsStore.getState()
  const activeProviderModel = resolvePapelizActiveAssistantProviderModel(settingsState)
  if (activeProviderModel === null) {
    return {
      providerConnectionOutcome: 'not-set-up',
      providerSetupProblem: Object.keys(settingsState.providerSettingsByProviderId).length === 0 ? papelizAssistantProviderNotChosenProblem : 'Switch on a model.',
    }
  }
  const providerPreset = findPapelizAssistantProviderPreset(activeProviderModel.papelizAssistantProviderId)
  const providerSettings = settingsState.providerSettingsByProviderId[activeProviderModel.papelizAssistantProviderId]
  if (providerSettings === undefined) return { providerConnectionOutcome: 'not-set-up', providerSetupProblem: papelizAssistantProviderNotChosenProblem }
  if (providerSettings.providerBaseUrl.length === 0) return { providerConnectionOutcome: 'not-set-up', providerSetupProblem: 'Set the provider’s base URL.' }
  if (providerPreset.isProviderApiKeyRequired && providerSettings.providerApiKey.length === 0) {
    return { providerConnectionOutcome: 'not-set-up', providerSetupProblem: `Add your ${providerPreset.providerPresetDisplayName} API key.` }
  }
  // The key and the address come from the same row, so a key goes only to its own provider.
  return {
    providerConnectionOutcome: 'ready',
    providerConnection: buildPapelizAssistantProviderConnection(providerSettings, activeProviderModel.providerModelName),
    providerDisplayName: providerPreset.providerPresetDisplayName,
  }
}
