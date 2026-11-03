import { create } from 'zustand'
import { readPapelizUserSetting, writePapelizUserSetting } from '../settings/papeliz-user-settings'
import type { PapelizAssistantProviderConnection } from './papeliz-openai-compatible-client'
import {
  findPapelizAssistantImageGenerationPreset,
  findPapelizAssistantPictureDescriptionPreset,
  findPapelizAssistantTranscriptionPreset,
} from './papeliz-assistant-media-provider-presets'
import { findPapelizAssistantProviderPreset } from './papeliz-assistant-provider-presets'
import {
  buildPapelizAssistantProviderConnection,
  listPapelizSavedAssistantProviderIds,
  resolvePapelizActiveAssistantProviderModel,
  usePapelizAssistantProviderSettingsStore,
  type PapelizAssistantProviderSettingsRecord,
} from './papeliz-assistant-provider-settings-store'

// The models Draw, Transcribe and Describe Picture use, apart from the chat's model chip (Models for
// Each Task, in Settings › AI Provider). Each lists the models of the providers the person has added
// that can do the task (papeliz-assistant-media-provider-presets.ts), plus any model name the person
// typed for one of them; the Meta Model API's come first. A task with nothing chosen is on Automatic:
// Draw and Transcribe use the first model offered, and Describe Picture uses the chat's model ("Same as
// Chat"). Edit Picture follows Draw. The picks are remembered on this device. No key is kept here: a
// call uses the provider's own saved settings, so its key goes only to it.

export type PapelizAssistantMediaKind = 'image-generation' | 'transcription' | 'picture-description'

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
  chosenPictureDescriptionModel: PapelizAssistantMediaModelChoice | null
  typedImageGenerationModels: PapelizAssistantMediaModelChoice[]
  typedTranscriptionModels: PapelizAssistantMediaModelChoice[]
  typedPictureDescriptionModels: PapelizAssistantMediaModelChoice[]
}

// Each task's fields in the record.
const papelizChosenMediaModelFieldNames = {
  'image-generation': 'chosenImageGenerationModel',
  transcription: 'chosenTranscriptionModel',
  'picture-description': 'chosenPictureDescriptionModel',
} as const satisfies Record<PapelizAssistantMediaKind, keyof PapelizAssistantMediaModelChoicesRecord>

const papelizTypedMediaModelsFieldNames = {
  'image-generation': 'typedImageGenerationModels',
  transcription: 'typedTranscriptionModels',
  'picture-description': 'typedPictureDescriptionModels',
} as const satisfies Record<PapelizAssistantMediaKind, keyof PapelizAssistantMediaModelChoicesRecord>

// Kept in this browser's settings store, beside the chat's model pick.
export const papelizAssistantMediaModelChoicesSettingName = 'papelizAssistantMediaModelChoices'

const papelizEmptyMediaModelChoices: PapelizAssistantMediaModelChoicesRecord = {
  chosenImageGenerationModel: null,
  chosenTranscriptionModel: null,
  chosenPictureDescriptionModel: null,
  typedImageGenerationModels: [],
  typedTranscriptionModels: [],
  typedPictureDescriptionModels: [],
}

interface PapelizAssistantMediaModelChoicesState extends PapelizAssistantMediaModelChoicesRecord {
  mediaModelChoicesLoadState: 'not-loaded' | 'loading' | 'loaded'
  // Reads the saved picks once; every later call waits for that same read.
  loadAssistantMediaModelChoices: () => Promise<void>
  chooseAssistantMediaModel: (assistantMediaKind: PapelizAssistantMediaKind, mediaModelChoice: PapelizAssistantMediaModelChoice) => Promise<void>
  // Back to Automatic (Same as Chat, for Describe Picture).
  chooseAssistantMediaModelAutomatically: (assistantMediaKind: PapelizAssistantMediaKind) => Promise<void>
  // Adds a model name for one provider and picks it.
  addTypedAssistantMediaModel: (assistantMediaKind: PapelizAssistantMediaKind, mediaModelChoice: PapelizAssistantMediaModelChoice) => Promise<void>
}

export function selectPapelizChosenAssistantMediaModelChoice(
  choicesRecord: PapelizAssistantMediaModelChoicesRecord,
  assistantMediaKind: PapelizAssistantMediaKind,
): PapelizAssistantMediaModelChoice | null {
  return choicesRecord[papelizChosenMediaModelFieldNames[assistantMediaKind]]
}

export function selectPapelizTypedAssistantMediaModels(
  choicesRecord: PapelizAssistantMediaModelChoicesRecord,
  assistantMediaKind: PapelizAssistantMediaKind,
): PapelizAssistantMediaModelChoice[] {
  return choicesRecord[papelizTypedMediaModelsFieldNames[assistantMediaKind]]
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
  return {
    chosenImageGenerationModel: readChoice(storedRecord.chosenImageGenerationModel),
    chosenTranscriptionModel: readChoice(storedRecord.chosenTranscriptionModel),
    chosenPictureDescriptionModel: readChoice(storedRecord.chosenPictureDescriptionModel),
    typedImageGenerationModels: readChoiceList(storedRecord.typedImageGenerationModels),
    typedTranscriptionModels: readChoiceList(storedRecord.typedTranscriptionModels),
    typedPictureDescriptionModels: readChoiceList(storedRecord.typedPictureDescriptionModels),
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
  assistantMediaKind: PapelizAssistantMediaKind,
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
      chosenPictureDescriptionModel: choicesState.chosenPictureDescriptionModel,
      typedImageGenerationModels: choicesState.typedImageGenerationModels,
      typedTranscriptionModels: choicesState.typedTranscriptionModels,
      typedPictureDescriptionModels: choicesState.typedPictureDescriptionModels,
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
        const typedModels = selectPapelizTypedAssistantMediaModels(choicesRecord, assistantMediaKind)
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
// Any added provider may describe pictures with a vision model the person types; only the ones known
// to see pictures are suggested.
function listSuggestedMediaModelNames(assistantMediaKind: PapelizAssistantMediaKind, papelizAssistantProviderId: string): readonly string[] | null {
  if (assistantMediaKind === 'image-generation') return findPapelizAssistantImageGenerationPreset(papelizAssistantProviderId)?.suggestedImageModelNames ?? null
  if (assistantMediaKind === 'transcription') return findPapelizAssistantTranscriptionPreset(papelizAssistantProviderId)?.suggestedTranscriptionModelNames ?? null
  return findPapelizAssistantPictureDescriptionPreset(papelizAssistantProviderId)?.suggestedVisionModelNames ?? []
}

// Every model the person can use for a task now: the added providers in the presets' order (the Meta
// Model API first), each with Papeliz's suggested models, then the ones typed for it.
export function listPapelizOfferedAssistantMediaModels(
  assistantMediaKind: PapelizAssistantMediaKind,
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
  assistantMediaKind: PapelizAssistantMediaKind,
  providerSettingsByProviderId: Record<string, PapelizAssistantProviderSettingsRecord>,
): string[] {
  return listPapelizSavedAssistantProviderIds(providerSettingsByProviderId).filter((savedProviderId) => listSuggestedMediaModelNames(assistantMediaKind, savedProviderId) !== null)
}

// The chosen model while it is still offered. Otherwise Automatic: the first one offered, or none for
// Describe Picture, which then uses the chat's model.
export function resolvePapelizChosenAssistantMediaModel(
  offeredMediaModels: readonly PapelizAssistantOfferedMediaModel[],
  chosenMediaModel: PapelizAssistantMediaModelChoice | null,
  assistantMediaKind: PapelizAssistantMediaKind = 'image-generation',
): PapelizAssistantOfferedMediaModel | null {
  const offeredChosenMediaModel = offeredMediaModels.find((offeredMediaModel) => isSameMediaModelChoice(offeredMediaModel, chosenMediaModel))
  if (offeredChosenMediaModel !== undefined || assistantMediaKind === 'picture-description') return offeredChosenMediaModel ?? null
  return offeredMediaModels[0] ?? null
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
  assistantMediaKind: PapelizAssistantMediaKind,
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

function listOfferedAssistantMediaModelsNow(assistantMediaKind: PapelizAssistantMediaKind): PapelizAssistantOfferedMediaModel[] {
  return listPapelizOfferedAssistantMediaModels(
    assistantMediaKind,
    usePapelizAssistantProviderSettingsStore.getState().providerSettingsByProviderId,
    selectPapelizTypedAssistantMediaModels(usePapelizAssistantMediaModelChoicesStore.getState(), assistantMediaKind),
  )
}

// The model a task uses now (the one picked while it is still offered, else Automatic's), or null
// while no added provider can do it; for Describe Picture, null is the chat's model.
export function resolvePapelizAssistantMediaModelNow(assistantMediaKind: PapelizAssistantMediaKind): PapelizAssistantMediaModelChoice | null {
  return resolvePapelizChosenAssistantMediaModel(
    listOfferedAssistantMediaModelsNow(assistantMediaKind),
    selectPapelizChosenAssistantMediaModelChoice(usePapelizAssistantMediaModelChoicesStore.getState(), assistantMediaKind),
    assistantMediaKind,
  )
}

// The same, once the saved picks have been read.
export async function resolvePapelizAssistantMediaModelWhenLoaded(assistantMediaKind: PapelizAssistantMediaKind): Promise<PapelizAssistantMediaModelChoice | null> {
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
  // Describe Picture on Same as Chat: this is the chat's model.
  isMediaModelSameAsChat: boolean
}

// One task's picks: its chosen model (null for Automatic) and the names typed for it.
export interface PapelizAssistantMediaModelPicks {
  chosenMediaModelChoice: PapelizAssistantMediaModelChoice | null
  typedMediaModels: readonly PapelizAssistantMediaModelChoice[]
}

// The model a task uses now, in words for the mic, Models for Each Task and the cards: its name and
// provider, and whether Automatic (or Same as Chat) picked it. Null while nothing can do the task.
export function describePapelizAssistantMediaModelInUse(
  assistantMediaKind: PapelizAssistantMediaKind,
  providerSettingsState: Parameters<typeof resolvePapelizActiveAssistantProviderModel>[0] = usePapelizAssistantProviderSettingsStore.getState(),
  mediaModelPicks: PapelizAssistantMediaModelPicks = {
    chosenMediaModelChoice: selectPapelizChosenAssistantMediaModelChoice(usePapelizAssistantMediaModelChoicesStore.getState(), assistantMediaKind),
    typedMediaModels: selectPapelizTypedAssistantMediaModels(usePapelizAssistantMediaModelChoicesStore.getState(), assistantMediaKind),
  },
): PapelizAssistantMediaModelInUse | null {
  const { chosenMediaModelChoice, typedMediaModels } = mediaModelPicks
  const offeredMediaModels = listPapelizOfferedAssistantMediaModels(assistantMediaKind, providerSettingsState.providerSettingsByProviderId, typedMediaModels)
  const mediaModelInUse = resolvePapelizChosenAssistantMediaModel(offeredMediaModels, chosenMediaModelChoice, assistantMediaKind)
  const isMediaModelChosenAutomatically = !offeredMediaModels.some((offeredMediaModel) => isSameMediaModelChoice(offeredMediaModel, chosenMediaModelChoice))
  const describeModel = (mediaModelChoice: PapelizAssistantMediaModelChoice, isMediaModelSameAsChat: boolean): PapelizAssistantMediaModelInUse => ({
    papelizAssistantProviderId: mediaModelChoice.papelizAssistantProviderId,
    providerModelName: mediaModelChoice.providerModelName,
    mediaModelShortName: mediaModelChoice.providerModelName.slice(mediaModelChoice.providerModelName.lastIndexOf('/') + 1),
    providerDisplayName: findPapelizAssistantProviderPreset(mediaModelChoice.papelizAssistantProviderId).providerPresetDisplayName,
    isMediaModelChosenAutomatically,
    isMediaModelSameAsChat,
  })
  if (mediaModelInUse !== null) return describeModel(mediaModelInUse, false)
  if (assistantMediaKind !== 'picture-description') return null
  const chatProviderModel = resolvePapelizActiveAssistantProviderModel(providerSettingsState)
  return chatProviderModel === null ? null : describeModel(chatProviderModel, true)
}
