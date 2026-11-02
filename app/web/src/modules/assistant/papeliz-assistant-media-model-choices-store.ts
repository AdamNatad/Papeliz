import { create } from 'zustand'
import { readPapelizUserSetting, writePapelizUserSetting } from '../settings/papeliz-user-settings'
import type { PapelizAssistantProviderConnection } from './papeliz-openai-compatible-client'
import {
  findPapelizAssistantImageGenerationPreset,
  findPapelizAssistantTranscriptionPreset,
  type PapelizAssistantImageGenerationPreset,
  type PapelizAssistantTranscriptionPreset,
} from './papeliz-assistant-media-provider-presets'
import { findPapelizAssistantProviderPreset } from './papeliz-assistant-provider-presets'
import {
  buildPapelizAssistantProviderConnection,
  listPapelizSavedAssistantProviderIds,
  usePapelizAssistantProviderSettingsStore,
  type PapelizAssistantProviderSettingsRecord,
} from './papeliz-assistant-provider-settings-store'

// The models Imagine and Transcribe use, apart from the chat's model chip. Each lists the image or
// transcription models of the providers the person has added in Settings › AI Provider (the ones whose
// provider offers that, papeliz-assistant-media-provider-presets.ts), plus any model name the person
// typed for one of them; the Meta Model API's come first. The pick is remembered on this device.
// No key is kept here: a call uses the provider's own saved settings, so its key goes only to it.

export type PapelizAssistantMediaKind = 'image-generation' | 'transcription'

export interface PapelizAssistantMediaModelChoice {
  papelizAssistantProviderId: string
  providerModelName: string
}

export interface PapelizAssistantOfferedMediaModel extends PapelizAssistantMediaModelChoice {
  providerDisplayName: string
  // Typed by the person rather than suggested by Papeliz.
  isMediaModelTypedByPerson: boolean
}

interface PapelizAssistantMediaModelChoicesRecord {
  chosenImageGenerationModel: PapelizAssistantMediaModelChoice | null
  chosenTranscriptionModel: PapelizAssistantMediaModelChoice | null
  typedImageGenerationModels: PapelizAssistantMediaModelChoice[]
  typedTranscriptionModels: PapelizAssistantMediaModelChoice[]
}

// Kept in this browser's settings store, beside the chat's model pick.
export const papelizAssistantMediaModelChoicesSettingName = 'papelizAssistantMediaModelChoices'

const papelizEmptyMediaModelChoices: PapelizAssistantMediaModelChoicesRecord = {
  chosenImageGenerationModel: null,
  chosenTranscriptionModel: null,
  typedImageGenerationModels: [],
  typedTranscriptionModels: [],
}

interface PapelizAssistantMediaModelChoicesState extends PapelizAssistantMediaModelChoicesRecord {
  mediaModelChoicesLoadState: 'not-loaded' | 'loading' | 'loaded'
  loadAssistantMediaModelChoices: () => Promise<void>
  chooseAssistantMediaModel: (assistantMediaKind: PapelizAssistantMediaKind, mediaModelChoice: PapelizAssistantMediaModelChoice) => void
  // Adds a model name for one provider and picks it.
  addTypedAssistantMediaModel: (assistantMediaKind: PapelizAssistantMediaKind, mediaModelChoice: PapelizAssistantMediaModelChoice) => void
}

function isMediaModelChoice(storedValue: unknown): storedValue is PapelizAssistantMediaModelChoice {
  return (
    typeof storedValue === 'object' &&
    storedValue !== null &&
    typeof (storedValue as PapelizAssistantMediaModelChoice).papelizAssistantProviderId === 'string' &&
    typeof (storedValue as PapelizAssistantMediaModelChoice).providerModelName === 'string'
  )
}

function readStoredMediaModelChoices(storedValue: unknown): PapelizAssistantMediaModelChoicesRecord {
  if (typeof storedValue !== 'object' || storedValue === null) return papelizEmptyMediaModelChoices
  const storedRecord = storedValue as Partial<Record<keyof PapelizAssistantMediaModelChoicesRecord, unknown>>
  const readChoiceList = (storedList: unknown) => (Array.isArray(storedList) ? storedList.filter(isMediaModelChoice) : [])
  return {
    chosenImageGenerationModel: isMediaModelChoice(storedRecord.chosenImageGenerationModel) ? storedRecord.chosenImageGenerationModel : null,
    chosenTranscriptionModel: isMediaModelChoice(storedRecord.chosenTranscriptionModel) ? storedRecord.chosenTranscriptionModel : null,
    typedImageGenerationModels: readChoiceList(storedRecord.typedImageGenerationModels),
    typedTranscriptionModels: readChoiceList(storedRecord.typedTranscriptionModels),
  }
}

function isSameMediaModelChoice(firstChoice: PapelizAssistantMediaModelChoice | null, secondChoice: PapelizAssistantMediaModelChoice | null): boolean {
  return (
    firstChoice !== null &&
    secondChoice !== null &&
    firstChoice.papelizAssistantProviderId === secondChoice.papelizAssistantProviderId &&
    firstChoice.providerModelName === secondChoice.providerModelName
  )
}

export const usePapelizAssistantMediaModelChoicesStore = create<PapelizAssistantMediaModelChoicesState>()((setChoicesState, getChoicesState) => {
  const saveMediaModelChoices = () => {
    const { chosenImageGenerationModel, chosenTranscriptionModel, typedImageGenerationModels, typedTranscriptionModels } = getChoicesState()
    void writePapelizUserSetting<PapelizAssistantMediaModelChoicesRecord>(papelizAssistantMediaModelChoicesSettingName, {
      chosenImageGenerationModel,
      chosenTranscriptionModel,
      typedImageGenerationModels,
      typedTranscriptionModels,
    }).catch(() => undefined)
  }
  return {
    ...papelizEmptyMediaModelChoices,
    mediaModelChoicesLoadState: 'not-loaded',
    loadAssistantMediaModelChoices: async () => {
      if (getChoicesState().mediaModelChoicesLoadState !== 'not-loaded') return
      setChoicesState({ mediaModelChoicesLoadState: 'loading' })
      const storedMediaModelChoices = readStoredMediaModelChoices(await readPapelizUserSetting<unknown>(papelizAssistantMediaModelChoicesSettingName, null))
      setChoicesState({ ...storedMediaModelChoices, mediaModelChoicesLoadState: 'loaded' })
    },
    chooseAssistantMediaModel: (assistantMediaKind, mediaModelChoice) => {
      setChoicesState(assistantMediaKind === 'image-generation' ? { chosenImageGenerationModel: mediaModelChoice } : { chosenTranscriptionModel: mediaModelChoice })
      saveMediaModelChoices()
    },
    addTypedAssistantMediaModel: (assistantMediaKind, mediaModelChoice) => {
      const trimmedChoice = { ...mediaModelChoice, providerModelName: mediaModelChoice.providerModelName.trim() }
      if (trimmedChoice.providerModelName.length === 0) return
      setChoicesState((choicesState) => {
        const typedModels = assistantMediaKind === 'image-generation' ? choicesState.typedImageGenerationModels : choicesState.typedTranscriptionModels
        const keptTypedModels = typedModels.some((typedModel) => isSameMediaModelChoice(typedModel, trimmedChoice)) ? typedModels : [...typedModels, trimmedChoice]
        return assistantMediaKind === 'image-generation'
          ? { typedImageGenerationModels: keptTypedModels, chosenImageGenerationModel: trimmedChoice }
          : { typedTranscriptionModels: keptTypedModels, chosenTranscriptionModel: trimmedChoice }
      })
      saveMediaModelChoices()
    },
  }
})

function findMediaPreset(assistantMediaKind: PapelizAssistantMediaKind, papelizAssistantProviderId: string) {
  return assistantMediaKind === 'image-generation'
    ? findPapelizAssistantImageGenerationPreset(papelizAssistantProviderId)
    : findPapelizAssistantTranscriptionPreset(papelizAssistantProviderId)
}

// Every model the person can use for pictures or speech now: the added providers in the presets'
// order (the Meta Model API first), each with Papeliz's suggested models, then the ones typed for it.
export function listPapelizOfferedAssistantMediaModels(
  assistantMediaKind: PapelizAssistantMediaKind,
  providerSettingsByProviderId: Record<string, PapelizAssistantProviderSettingsRecord>,
  typedMediaModels: readonly PapelizAssistantMediaModelChoice[],
): PapelizAssistantOfferedMediaModel[] {
  const offeredMediaModels: PapelizAssistantOfferedMediaModel[] = []
  for (const savedProviderId of listPapelizSavedAssistantProviderIds(providerSettingsByProviderId)) {
    const mediaPreset = findMediaPreset(assistantMediaKind, savedProviderId)
    if (mediaPreset === null) continue
    const providerDisplayName = findPapelizAssistantProviderPreset(savedProviderId).providerPresetDisplayName
    const suggestedModelNames = assistantMediaKind === 'image-generation'
      ? (mediaPreset as PapelizAssistantImageGenerationPreset).suggestedImageModelNames
      : (mediaPreset as PapelizAssistantTranscriptionPreset).suggestedTranscriptionModelNames
    for (const suggestedModelName of suggestedModelNames) {
      offeredMediaModels.push({ papelizAssistantProviderId: savedProviderId, providerModelName: suggestedModelName, providerDisplayName, isMediaModelTypedByPerson: false })
    }
    for (const typedMediaModel of typedMediaModels) {
      if (typedMediaModel.papelizAssistantProviderId !== savedProviderId || suggestedModelNames.includes(typedMediaModel.providerModelName)) continue
      offeredMediaModels.push({ ...typedMediaModel, providerDisplayName, isMediaModelTypedByPerson: true })
    }
  }
  return offeredMediaModels
}

// The added providers that offer pictures or speech, for "Use another model" to type a name for.
export function listPapelizMediaCapableSavedProviderIds(
  assistantMediaKind: PapelizAssistantMediaKind,
  providerSettingsByProviderId: Record<string, PapelizAssistantProviderSettingsRecord>,
): string[] {
  return listPapelizSavedAssistantProviderIds(providerSettingsByProviderId).filter((savedProviderId) => findMediaPreset(assistantMediaKind, savedProviderId) !== null)
}

// The chosen model while it is still offered, else the first one offered.
export function resolvePapelizChosenAssistantMediaModel(
  offeredMediaModels: readonly PapelizAssistantOfferedMediaModel[],
  chosenMediaModel: PapelizAssistantMediaModelChoice | null,
): PapelizAssistantOfferedMediaModel | null {
  return offeredMediaModels.find((offeredMediaModel) => isSameMediaModelChoice(offeredMediaModel, chosenMediaModel)) ?? offeredMediaModels[0] ?? null
}

export function describePapelizAssistantMediaModelChoiceValue(mediaModelChoice: PapelizAssistantMediaModelChoice): string {
  return `${mediaModelChoice.papelizAssistantProviderId}\u0000${mediaModelChoice.providerModelName}`
}

export function readPapelizAssistantMediaModelChoiceValue(mediaModelChoiceValue: string): PapelizAssistantMediaModelChoice | null {
  const separatorIndex = mediaModelChoiceValue.indexOf('\u0000')
  if (separatorIndex === -1) return null
  return { papelizAssistantProviderId: mediaModelChoiceValue.slice(0, separatorIndex), providerModelName: mediaModelChoiceValue.slice(separatorIndex + 1) }
}

// What a picture or speech call sends: the provider's own saved address, key and headers, with the
// media model.
export function buildPapelizAssistantMediaProviderConnection(
  assistantMediaKind: PapelizAssistantMediaKind,
  mediaModelChoice: PapelizAssistantMediaModelChoice,
): { mediaConnectionOutcome: 'ready'; providerConnection: PapelizAssistantProviderConnection; providerDisplayName: string } | { mediaConnectionOutcome: 'not-set-up'; mediaSetupProblem: string } {
  const providerSettings = usePapelizAssistantProviderSettingsStore.getState().providerSettingsByProviderId[mediaModelChoice.papelizAssistantProviderId]
  const providerPreset = findPapelizAssistantProviderPreset(mediaModelChoice.papelizAssistantProviderId)
  if (providerSettings === undefined) return { mediaConnectionOutcome: 'not-set-up', mediaSetupProblem: 'Add a provider in Settings › AI Provider first.' }
  if (providerPreset.isProviderApiKeyRequired && providerSettings.providerApiKey.trim().length === 0) {
    return { mediaConnectionOutcome: 'not-set-up', mediaSetupProblem: `Add your ${providerPreset.providerPresetDisplayName} API key first.` }
  }
  if (findMediaPreset(assistantMediaKind, mediaModelChoice.papelizAssistantProviderId) === null) {
    return { mediaConnectionOutcome: 'not-set-up', mediaSetupProblem: `${providerPreset.providerPresetDisplayName} doesn’t offer this.` }
  }
  return {
    mediaConnectionOutcome: 'ready',
    providerConnection: buildPapelizAssistantProviderConnection(providerSettings, mediaModelChoice.providerModelName),
    providerDisplayName: providerPreset.providerPresetDisplayName,
  }
}

// The model chosen for pictures or speech now (the one picked while it is still offered, else the
// first offered), or null while no added provider offers it.
export function resolvePapelizAssistantMediaModelNow(assistantMediaKind: PapelizAssistantMediaKind): PapelizAssistantMediaModelChoice | null {
  const choicesState = usePapelizAssistantMediaModelChoicesStore.getState()
  const offeredMediaModels = listPapelizOfferedAssistantMediaModels(
    assistantMediaKind,
    usePapelizAssistantProviderSettingsStore.getState().providerSettingsByProviderId,
    assistantMediaKind === 'image-generation' ? choicesState.typedImageGenerationModels : choicesState.typedTranscriptionModels,
  )
  return resolvePapelizChosenAssistantMediaModel(
    offeredMediaModels,
    assistantMediaKind === 'image-generation' ? choicesState.chosenImageGenerationModel : choicesState.chosenTranscriptionModel,
  )
}
