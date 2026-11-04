import { create } from 'zustand'
import { readPapelizUserSetting, writePapelizUserSetting } from '../settings/papeliz-user-settings'
import type { PapelizAssistantProviderConnection } from './papeliz-openai-compatible-client'
import { findPapelizAssistantImageGenerationPreset, findPapelizAssistantTranscriptionPreset } from './papeliz-assistant-media-provider-presets'
import { findPapelizAssistantProviderPreset } from './papeliz-assistant-provider-presets'
import {
  buildPapelizAssistantProviderConnection,
  listPapelizSavedAssistantProviderIds,
  resolvePapelizActiveAssistantProviderModel,
  usePapelizAssistantProviderSettingsStore,
  type PapelizAssistantProviderSettingsRecord,
} from './papeliz-assistant-provider-settings-store'

// The models Draw and Transcribe use, apart from the chat's model chip (Models for Transcribe and Draw,
// in Settings › AI Provider). Each lists the models of the providers the person has added that can do
// the task (papeliz-assistant-media-provider-presets.ts), plus any model name the person typed for one
// of them; the Meta Model API's come first. A task with nothing chosen is on Automatic: it uses the
// first model offered. Describe Picture has no model of its own: it always uses the chat's ("Same as
// Chat"), and a model picked for it before is no longer read. Edit Picture follows Draw. The picks are
// remembered on this device. No key is kept here: a call uses the provider's own saved settings, so its
// key goes only to it.

export type PapelizAssistantMediaKind = 'image-generation' | 'transcription' | 'picture-description'

// The tasks whose model is picked; Describe Picture uses the chat's.
export type PapelizAssistantPickedModelMediaKind = Exclude<PapelizAssistantMediaKind, 'picture-description'>

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
  // Null is Automatic.
  chosenImageGenerationModel: PapelizAssistantMediaModelChoice | null
  chosenTranscriptionModel: PapelizAssistantMediaModelChoice | null
  typedImageGenerationModels: PapelizAssistantMediaModelChoice[]
  typedTranscriptionModels: PapelizAssistantMediaModelChoice[]
}

// Each task's fields in the record.
const papelizChosenMediaModelFieldNames = {
  'image-generation': 'chosenImageGenerationModel',
  transcription: 'chosenTranscriptionModel',
} as const satisfies Record<PapelizAssistantPickedModelMediaKind, keyof PapelizAssistantMediaModelChoicesRecord>

const papelizTypedMediaModelsFieldNames = {
  'image-generation': 'typedImageGenerationModels',
  transcription: 'typedTranscriptionModels',
} as const satisfies Record<PapelizAssistantPickedModelMediaKind, keyof PapelizAssistantMediaModelChoicesRecord>

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
  // Reads the saved picks once; every later call waits for that same read.
  loadAssistantMediaModelChoices: () => Promise<void>
  chooseAssistantMediaModel: (assistantMediaKind: PapelizAssistantPickedModelMediaKind, mediaModelChoice: PapelizAssistantMediaModelChoice) => Promise<void>
  // Back to Automatic.
  chooseAssistantMediaModelAutomatically: (assistantMediaKind: PapelizAssistantPickedModelMediaKind) => Promise<void>
  // Adds a model name for one provider and picks it.
  addTypedAssistantMediaModel: (assistantMediaKind: PapelizAssistantPickedModelMediaKind, mediaModelChoice: PapelizAssistantMediaModelChoice) => Promise<void>
}

// Describe Picture has no pick: nothing chosen, nothing typed.
const papelizNoTypedPictureDescriptionModels: readonly PapelizAssistantMediaModelChoice[] = []

export function selectPapelizChosenAssistantMediaModelChoice(
  choicesRecord: PapelizAssistantMediaModelChoicesRecord,
  assistantMediaKind: PapelizAssistantMediaKind,
): PapelizAssistantMediaModelChoice | null {
  return assistantMediaKind === 'picture-description' ? null : choicesRecord[papelizChosenMediaModelFieldNames[assistantMediaKind]]
}

export function selectPapelizTypedAssistantMediaModels(
  choicesRecord: PapelizAssistantMediaModelChoicesRecord,
  assistantMediaKind: PapelizAssistantMediaKind,
): readonly PapelizAssistantMediaModelChoice[] {
  return assistantMediaKind === 'picture-description' ? papelizNoTypedPictureDescriptionModels : choicesRecord[papelizTypedMediaModelsFieldNames[assistantMediaKind]]
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
  const readChoice = (storedChoice: unknown) => (isMediaModelChoice(storedChoice) ? storedChoice : null)
  const readChoiceList = (storedList: unknown) => (Array.isArray(storedList) ? storedList.filter(isMediaModelChoice) : [])
  // A Describe Picture model kept by an earlier version is left unread, and the next save drops it.
  return {
    chosenImageGenerationModel: readChoice(storedRecord.chosenImageGenerationModel),
    chosenTranscriptionModel: readChoice(storedRecord.chosenTranscriptionModel),
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

// The one read of the saved picks, shared by every caller until it ends.
let mediaModelChoicesLoadPromise: Promise<void> | null = null

function buildChosenMediaModelChange(
  assistantMediaKind: PapelizAssistantPickedModelMediaKind,
  mediaModelChoice: PapelizAssistantMediaModelChoice | null,
): Partial<PapelizAssistantMediaModelChoicesRecord> {
  const chosenMediaModelChange: Partial<PapelizAssistantMediaModelChoicesRecord> = {}
  chosenMediaModelChange[papelizChosenMediaModelFieldNames[assistantMediaKind]] = mediaModelChoice
  return chosenMediaModelChange
}

export const usePapelizAssistantMediaModelChoicesStore = create<PapelizAssistantMediaModelChoicesState>()((setChoicesState, getChoicesState) => {
  const saveMediaModelChoices = () => {
    const choicesState = getChoicesState()
    void writePapelizUserSetting<PapelizAssistantMediaModelChoicesRecord>(papelizAssistantMediaModelChoicesSettingName, {
      chosenImageGenerationModel: choicesState.chosenImageGenerationModel,
      chosenTranscriptionModel: choicesState.chosenTranscriptionModel,
      typedImageGenerationModels: choicesState.typedImageGenerationModels,
      typedTranscriptionModels: choicesState.typedTranscriptionModels,
    }).catch(() => undefined)
  }
  // A pick made before the saved picks are read waits for them, so it neither is overwritten by them
  // nor saves over the ones it didn't change.
  const changeMediaModelChoices = async (choicesChange: (choicesRecord: PapelizAssistantMediaModelChoicesRecord) => Partial<PapelizAssistantMediaModelChoicesRecord>) => {
    if (getChoicesState().mediaModelChoicesLoadState !== 'loaded') await getChoicesState().loadAssistantMediaModelChoices()
    setChoicesState((choicesState) => choicesChange(choicesState))
    saveMediaModelChoices()
  }
  return {
    ...papelizEmptyMediaModelChoices,
    mediaModelChoicesLoadState: 'not-loaded',
    loadAssistantMediaModelChoices: () => {
      if (getChoicesState().mediaModelChoicesLoadState === 'loaded') return Promise.resolve()
      mediaModelChoicesLoadPromise ??= (async () => {
        setChoicesState({ mediaModelChoicesLoadState: 'loading' })
        const storedMediaModelChoices = readStoredMediaModelChoices(await readPapelizUserSetting<unknown>(papelizAssistantMediaModelChoicesSettingName, null))
        setChoicesState({ ...storedMediaModelChoices, mediaModelChoicesLoadState: 'loaded' })
      })().finally(() => {
        mediaModelChoicesLoadPromise = null
      })
      return mediaModelChoicesLoadPromise
    },
    chooseAssistantMediaModel: (assistantMediaKind, mediaModelChoice) => changeMediaModelChoices(() => buildChosenMediaModelChange(assistantMediaKind, mediaModelChoice)),
    chooseAssistantMediaModelAutomatically: (assistantMediaKind) => changeMediaModelChoices(() => buildChosenMediaModelChange(assistantMediaKind, null)),
    addTypedAssistantMediaModel: (assistantMediaKind, mediaModelChoice) => {
      const trimmedChoice = { ...mediaModelChoice, providerModelName: mediaModelChoice.providerModelName.trim() }
      if (trimmedChoice.providerModelName.length === 0) return Promise.resolve()
      return changeMediaModelChoices((choicesRecord) => {
        const typedModels = choicesRecord[papelizTypedMediaModelsFieldNames[assistantMediaKind]]
        const typedMediaModelChange = buildChosenMediaModelChange(assistantMediaKind, trimmedChoice)
        typedMediaModelChange[papelizTypedMediaModelsFieldNames[assistantMediaKind]] = typedModels.some((typedModel) => isSameMediaModelChoice(typedModel, trimmedChoice))
          ? typedModels
          : [...typedModels, trimmedChoice]
        return typedMediaModelChange
      })
    },
  }
})

// The saved picks are read as soon as the providers are, so the mic and the note's cards use the
// chosen models even before Imagine or the settings have been opened.
usePapelizAssistantProviderSettingsStore.subscribe((providerSettingsState, previousProviderSettingsState) => {
  if (providerSettingsState.providerSettingsLoadState === 'loaded' && previousProviderSettingsState.providerSettingsLoadState !== 'loaded') {
    void usePapelizAssistantMediaModelChoicesStore.getState().loadAssistantMediaModelChoices()
  }
})

// The model names Papeliz suggests for one provider and task, or null when the provider can't do it.
function listSuggestedMediaModelNames(assistantMediaKind: PapelizAssistantPickedModelMediaKind, papelizAssistantProviderId: string): readonly string[] | null {
  if (assistantMediaKind === 'image-generation') return findPapelizAssistantImageGenerationPreset(papelizAssistantProviderId)?.suggestedImageModelNames ?? null
  return findPapelizAssistantTranscriptionPreset(papelizAssistantProviderId)?.suggestedTranscriptionModelNames ?? null
}

// Every model the person can use for a task now: the added providers in the presets' order (the Meta
// Model API first), each with Papeliz's suggested models, then the ones typed for it.
export function listPapelizOfferedAssistantMediaModels(
  assistantMediaKind: PapelizAssistantPickedModelMediaKind,
  providerSettingsByProviderId: Record<string, PapelizAssistantProviderSettingsRecord>,
  typedMediaModels: readonly PapelizAssistantMediaModelChoice[],
): PapelizAssistantOfferedMediaModel[] {
  const offeredMediaModels: PapelizAssistantOfferedMediaModel[] = []
  for (const savedProviderId of listPapelizSavedAssistantProviderIds(providerSettingsByProviderId)) {
    const suggestedModelNames = listSuggestedMediaModelNames(assistantMediaKind, savedProviderId)
    if (suggestedModelNames === null) continue
    const providerDisplayName = findPapelizAssistantProviderPreset(savedProviderId).providerPresetDisplayName
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

// The added providers that can do a task, for Other Model to type a name for.
export function listPapelizMediaCapableSavedProviderIds(
  assistantMediaKind: PapelizAssistantPickedModelMediaKind,
  providerSettingsByProviderId: Record<string, PapelizAssistantProviderSettingsRecord>,
): string[] {
  return listPapelizSavedAssistantProviderIds(providerSettingsByProviderId).filter((savedProviderId) => listSuggestedMediaModelNames(assistantMediaKind, savedProviderId) !== null)
}

// The chosen model while it is still offered. Otherwise Automatic: the first one offered.
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

// What a media call sends: the provider's own saved address, key and headers, with the task's model.
export function buildPapelizAssistantMediaProviderConnection(
  assistantMediaKind: PapelizAssistantPickedModelMediaKind,
  mediaModelChoice: PapelizAssistantMediaModelChoice,
): { mediaConnectionOutcome: 'ready'; providerConnection: PapelizAssistantProviderConnection; providerDisplayName: string } | { mediaConnectionOutcome: 'not-set-up'; mediaSetupProblem: string } {
  const providerSettings = usePapelizAssistantProviderSettingsStore.getState().providerSettingsByProviderId[mediaModelChoice.papelizAssistantProviderId]
  const providerPreset = findPapelizAssistantProviderPreset(mediaModelChoice.papelizAssistantProviderId)
  if (providerSettings === undefined) return { mediaConnectionOutcome: 'not-set-up', mediaSetupProblem: 'Add a provider in Settings › AI Provider first.' }
  if (providerPreset.isProviderApiKeyRequired && providerSettings.providerApiKey.trim().length === 0) {
    return { mediaConnectionOutcome: 'not-set-up', mediaSetupProblem: `Add your ${providerPreset.providerPresetDisplayName} API key first.` }
  }
  if (listSuggestedMediaModelNames(assistantMediaKind, mediaModelChoice.papelizAssistantProviderId) === null) {
    return { mediaConnectionOutcome: 'not-set-up', mediaSetupProblem: `${providerPreset.providerPresetDisplayName} doesn’t offer this.` }
  }
  return {
    mediaConnectionOutcome: 'ready',
    providerConnection: buildPapelizAssistantProviderConnection(providerSettings, mediaModelChoice.providerModelName),
    providerDisplayName: providerPreset.providerPresetDisplayName,
  }
}

function listOfferedAssistantMediaModelsNow(assistantMediaKind: PapelizAssistantPickedModelMediaKind): PapelizAssistantOfferedMediaModel[] {
  return listPapelizOfferedAssistantMediaModels(
    assistantMediaKind,
    usePapelizAssistantProviderSettingsStore.getState().providerSettingsByProviderId,
    selectPapelizTypedAssistantMediaModels(usePapelizAssistantMediaModelChoicesStore.getState(), assistantMediaKind),
  )
}

// The model a task uses now (the one picked while it is still offered, else Automatic's), or null
// while no added provider can do it.
export function resolvePapelizAssistantMediaModelNow(assistantMediaKind: PapelizAssistantPickedModelMediaKind): PapelizAssistantMediaModelChoice | null {
  return resolvePapelizChosenAssistantMediaModel(
    listOfferedAssistantMediaModelsNow(assistantMediaKind),
    selectPapelizChosenAssistantMediaModelChoice(usePapelizAssistantMediaModelChoicesStore.getState(), assistantMediaKind),
  )
}

// The same, once the saved picks have been read.
export async function resolvePapelizAssistantMediaModelWhenLoaded(assistantMediaKind: PapelizAssistantPickedModelMediaKind): Promise<PapelizAssistantMediaModelChoice | null> {
  await usePapelizAssistantMediaModelChoicesStore.getState().loadAssistantMediaModelChoices()
  return resolvePapelizAssistantMediaModelNow(assistantMediaKind)
}

// Edit Picture follows Draw: Draw's model while its provider edits pictures, else none.
export function resolvePapelizAssistantImageEditingModelNow(): PapelizAssistantMediaModelChoice | null {
  const drawImageModel = resolvePapelizAssistantMediaModelNow('image-generation')
  return drawImageModel !== null && findPapelizAssistantImageGenerationPreset(drawImageModel.papelizAssistantProviderId)?.isImageEditingOffered === true ? drawImageModel : null
}

export interface PapelizAssistantMediaModelInUse {
  papelizAssistantProviderId: string
  providerModelName: string
  // The name after the last "/": "flux.2-pro" for "black-forest-labs/flux.2-pro".
  mediaModelShortName: string
  providerDisplayName: string
  // Nothing chosen for the task (or the chosen model is no longer offered): Automatic picked this.
  isMediaModelChosenAutomatically: boolean
  // Describe Picture, always Same as Chat: this is the chat's model.
  isMediaModelSameAsChat: boolean
}

// One task's picks: its chosen model (null for Automatic) and the names typed for it.
export interface PapelizAssistantMediaModelPicks {
  chosenMediaModelChoice: PapelizAssistantMediaModelChoice | null
  typedMediaModels: readonly PapelizAssistantMediaModelChoice[]
}

// The model a task uses now, in words for the mic and the cards: its name and provider, and whether
// Automatic (or, for Describe Picture, the chat) picked it. Null while nothing can do the task.
export function describePapelizAssistantMediaModelInUse(
  assistantMediaKind: PapelizAssistantMediaKind,
  providerSettingsState: Parameters<typeof resolvePapelizActiveAssistantProviderModel>[0] = usePapelizAssistantProviderSettingsStore.getState(),
  mediaModelPicks: PapelizAssistantMediaModelPicks = {
    chosenMediaModelChoice: selectPapelizChosenAssistantMediaModelChoice(usePapelizAssistantMediaModelChoicesStore.getState(), assistantMediaKind),
    typedMediaModels: selectPapelizTypedAssistantMediaModels(usePapelizAssistantMediaModelChoicesStore.getState(), assistantMediaKind),
  },
): PapelizAssistantMediaModelInUse | null {
  const describeModel = (mediaModelChoice: PapelizAssistantMediaModelChoice, isMediaModelChosenAutomatically: boolean, isMediaModelSameAsChat: boolean): PapelizAssistantMediaModelInUse => ({
    papelizAssistantProviderId: mediaModelChoice.papelizAssistantProviderId,
    providerModelName: mediaModelChoice.providerModelName,
    mediaModelShortName: mediaModelChoice.providerModelName.slice(mediaModelChoice.providerModelName.lastIndexOf('/') + 1),
    providerDisplayName: findPapelizAssistantProviderPreset(mediaModelChoice.papelizAssistantProviderId).providerPresetDisplayName,
    isMediaModelChosenAutomatically,
    isMediaModelSameAsChat,
  })
  if (assistantMediaKind === 'picture-description') {
    const chatProviderModel = resolvePapelizActiveAssistantProviderModel(providerSettingsState)
    return chatProviderModel === null ? null : describeModel(chatProviderModel, true, true)
  }
  const { chosenMediaModelChoice, typedMediaModels } = mediaModelPicks
  const offeredMediaModels = listPapelizOfferedAssistantMediaModels(assistantMediaKind, providerSettingsState.providerSettingsByProviderId, typedMediaModels)
  const mediaModelInUse = resolvePapelizChosenAssistantMediaModel(offeredMediaModels, chosenMediaModelChoice)
  const isMediaModelChosenAutomatically = !offeredMediaModels.some((offeredMediaModel) => isSameMediaModelChoice(offeredMediaModel, chosenMediaModelChoice))
  return mediaModelInUse === null ? null : describeModel(mediaModelInUse, isMediaModelChosenAutomatically, false)
}
