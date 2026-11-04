import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readPapelizUserSetting, writePapelizUserSetting } from '../settings/papeliz-user-settings'
import {
  buildPapelizAssistantMediaProviderConnection,
  describePapelizAssistantMediaModelInUse,
  listPapelizMediaCapableSavedProviderIds,
  papelizAssistantMediaModelChoicesSettingName,
  resolvePapelizAssistantImageEditingModelNow,
  resolvePapelizAssistantMediaModelNow,
  resolvePapelizAssistantMediaModelWhenLoaded,
  usePapelizAssistantMediaModelChoicesStore,
} from './papeliz-assistant-media-model-choices-store'
import { usePapelizAssistantProviderSettingsStore, type PapelizAssistantProviderSettingsRecord } from './papeliz-assistant-provider-settings-store'

// The store behind Models for Transcribe and Draw: Automatic as a cleared pick, the transcription pick
// saved and used, Describe Picture always on the chat's model, and Edit Picture following Draw. The
// settings store is a stand-in, so nothing is kept between tests; the keys are made up.

let storedMediaModelChoicesValue: unknown = null
vi.mock('../settings/papeliz-user-settings', () => ({
  readPapelizUserSetting: vi.fn(async (userSettingName: string, fallbackUserSettingValue: unknown) =>
    userSettingName === 'papelizAssistantMediaModelChoices' && storedMediaModelChoicesValue !== null ? storedMediaModelChoicesValue : fallbackUserSettingValue,
  ),
  writePapelizUserSetting: vi.fn(async () => undefined),
}))

function buildTestProviderSettings(papelizAssistantProviderId: string, enabledProviderModelNames: string[]): PapelizAssistantProviderSettingsRecord {
  return { papelizAssistantProviderId, providerBaseUrl: 'https://papeliz-test-provider.invalid/v1', providerApiKey: 'papeliz-test-key-not-a-real-key', enabledProviderModelNames }
}

const metaAndGroqProviderSettings = {
  'meta-model-api': buildTestProviderSettings('meta-model-api', ['muse-spark-1.3']),
  groq: buildTestProviderSettings('groq', ['llama-test-chat']),
}

const groqWhisperChoice = { papelizAssistantProviderId: 'groq', providerModelName: 'whisper-large-v3-turbo' }

function readSavedMediaModelChoices(): Record<string, unknown> | undefined {
  return vi.mocked(writePapelizUserSetting).mock.calls.at(-1)?.[1] as Record<string, unknown> | undefined
}

beforeEach(() => {
  storedMediaModelChoicesValue = null
  vi.mocked(readPapelizUserSetting).mockClear()
  vi.mocked(writePapelizUserSetting).mockClear()
  usePapelizAssistantProviderSettingsStore.setState({
    providerSettingsByProviderId: metaAndGroqProviderSettings,
    activeAssistantProviderId: 'meta-model-api',
    activeAssistantProviderModelName: 'muse-spark-1.3',
    providerSettingsLoadState: 'not-loaded',
  })
  usePapelizAssistantMediaModelChoicesStore.setState({
    chosenImageGenerationModel: null,
    chosenTranscriptionModel: null,
    typedImageGenerationModels: [],
    typedTranscriptionModels: [],
    mediaModelChoicesLoadState: 'not-loaded',
  })
})

describe('Automatic', () => {
  it('is a cleared pick: the first model offered is used, and a pick goes back to it', async () => {
    expect(resolvePapelizAssistantMediaModelNow('transcription')).toMatchObject({ papelizAssistantProviderId: 'meta-model-api', providerModelName: 'muse-voice-transcribe-1.0' })
    expect(describePapelizAssistantMediaModelInUse('transcription')).toMatchObject({ providerModelName: 'muse-voice-transcribe-1.0', providerDisplayName: 'Meta Model API', isMediaModelChosenAutomatically: true })

    await usePapelizAssistantMediaModelChoicesStore.getState().chooseAssistantMediaModel('transcription', groqWhisperChoice)
    expect(describePapelizAssistantMediaModelInUse('transcription')).toMatchObject({ providerModelName: 'whisper-large-v3-turbo', providerDisplayName: 'Groq', isMediaModelChosenAutomatically: false })

    await usePapelizAssistantMediaModelChoicesStore.getState().chooseAssistantMediaModelAutomatically('transcription')
    expect(usePapelizAssistantMediaModelChoicesStore.getState().chosenTranscriptionModel).toBeNull()
    expect(readSavedMediaModelChoices()).toMatchObject({ chosenTranscriptionModel: null })
    expect(resolvePapelizAssistantMediaModelNow('transcription')?.providerModelName).toBe('muse-voice-transcribe-1.0')
  })

  it('is used again when the chosen model is no longer offered, and says so', async () => {
    await usePapelizAssistantMediaModelChoicesStore.getState().chooseAssistantMediaModel('transcription', groqWhisperChoice)
    usePapelizAssistantProviderSettingsStore.setState({ providerSettingsByProviderId: { 'meta-model-api': metaAndGroqProviderSettings['meta-model-api'] } })
    expect(describePapelizAssistantMediaModelInUse('transcription')).toMatchObject({ providerModelName: 'muse-voice-transcribe-1.0', isMediaModelChosenAutomatically: true })
  })

  it('names nothing while no added provider can do the task', () => {
    usePapelizAssistantProviderSettingsStore.setState({ providerSettingsByProviderId: { claude: buildTestProviderSettings('claude', ['claude-sonnet-5-5']) } })
    expect(describePapelizAssistantMediaModelInUse('transcription')).toBeNull()
    expect(describePapelizAssistantMediaModelInUse('image-generation')).toBeNull()
  })
})

describe('the transcription pick', () => {
  it('is saved when chosen, and used once read back', async () => {
    await usePapelizAssistantMediaModelChoicesStore.getState().chooseAssistantMediaModel('transcription', groqWhisperChoice)
    expect(vi.mocked(writePapelizUserSetting)).toHaveBeenLastCalledWith(papelizAssistantMediaModelChoicesSettingName, expect.objectContaining({ chosenTranscriptionModel: groqWhisperChoice }))

    // A new page: the saved pick is read back and used.
    storedMediaModelChoicesValue = readSavedMediaModelChoices()
    usePapelizAssistantMediaModelChoicesStore.setState({ chosenTranscriptionModel: null, mediaModelChoicesLoadState: 'not-loaded' })
    expect(await resolvePapelizAssistantMediaModelWhenLoaded('transcription')).toMatchObject(groqWhisperChoice)
  })

  it('is read as soon as the providers are, so the mic uses it before Imagine or the settings open', async () => {
    storedMediaModelChoicesValue = { chosenTranscriptionModel: groqWhisperChoice }
    usePapelizAssistantProviderSettingsStore.setState({ providerSettingsLoadState: 'loaded' })
    await vi.waitFor(() => expect(usePapelizAssistantMediaModelChoicesStore.getState().mediaModelChoicesLoadState).toBe('loaded'))
    expect(resolvePapelizAssistantMediaModelNow('transcription')).toMatchObject(groqWhisperChoice)
  })

  it('waits for the saved picks when chosen before they are read, keeping the ones it didn’t change', async () => {
    storedMediaModelChoicesValue = { typedTranscriptionModels: [{ papelizAssistantProviderId: 'groq', providerModelName: 'whisper-large-v3' }], chosenImageGenerationModel: null }
    await usePapelizAssistantMediaModelChoicesStore.getState().chooseAssistantMediaModel('transcription', groqWhisperChoice)
    expect(usePapelizAssistantMediaModelChoicesStore.getState()).toMatchObject({
      chosenTranscriptionModel: groqWhisperChoice,
      typedTranscriptionModels: [{ papelizAssistantProviderId: 'groq', providerModelName: 'whisper-large-v3' }],
    })
    expect(readSavedMediaModelChoices()).toMatchObject({ typedTranscriptionModels: [{ papelizAssistantProviderId: 'groq', providerModelName: 'whisper-large-v3' }] })
  })

  it('can be typed for any added provider that transcribes, Custom too', () => {
    const customProviderSettings = { ...metaAndGroqProviderSettings, custom: buildTestProviderSettings('custom', ['local-chat']) }
    expect(listPapelizMediaCapableSavedProviderIds('transcription', customProviderSettings)).toEqual(['meta-model-api', 'groq', 'custom'])
    usePapelizAssistantProviderSettingsStore.setState({ providerSettingsByProviderId: customProviderSettings })
    expect(buildPapelizAssistantMediaProviderConnection('transcription', { papelizAssistantProviderId: 'custom', providerModelName: 'whisper-local' })).toMatchObject({
      mediaConnectionOutcome: 'ready',
      providerConnection: { providerModelName: 'whisper-local' },
    })
  })
})

describe('Describe Picture', () => {
  it('always uses the chat’s model, and follows it', () => {
    expect(describePapelizAssistantMediaModelInUse('picture-description')).toMatchObject({
      providerModelName: 'muse-spark-1.3',
      providerDisplayName: 'Meta Model API',
      isMediaModelSameAsChat: true,
    })
    usePapelizAssistantProviderSettingsStore.setState({ activeAssistantProviderId: 'groq', activeAssistantProviderModelName: 'llama-test-chat' })
    expect(describePapelizAssistantMediaModelInUse('picture-description')).toMatchObject({ providerModelName: 'llama-test-chat', providerDisplayName: 'Groq', isMediaModelSameAsChat: true })
  })

  it('leaves a model chosen for it before unread, and the next save drops it', async () => {
    storedMediaModelChoicesValue = {
      chosenPictureDescriptionModel: { papelizAssistantProviderId: 'groq', providerModelName: 'qwen/qwen3.8-27b' },
      typedPictureDescriptionModels: [{ papelizAssistantProviderId: 'groq', providerModelName: 'my-vision-model' }],
    }
    await usePapelizAssistantMediaModelChoicesStore.getState().loadAssistantMediaModelChoices()
    expect(describePapelizAssistantMediaModelInUse('picture-description')).toMatchObject({ providerModelName: 'muse-spark-1.3', isMediaModelSameAsChat: true })
    await usePapelizAssistantMediaModelChoicesStore.getState().chooseAssistantMediaModel('transcription', groqWhisperChoice)
    expect(readSavedMediaModelChoices()).not.toHaveProperty('chosenPictureDescriptionModel')
    expect(readSavedMediaModelChoices()).not.toHaveProperty('typedPictureDescriptionModels')
  })

  it('names nothing while no chat model is switched on', () => {
    usePapelizAssistantProviderSettingsStore.setState({ providerSettingsByProviderId: { groq: buildTestProviderSettings('groq', []) }, activeAssistantProviderId: 'groq' })
    expect(describePapelizAssistantMediaModelInUse('picture-description')).toBeNull()
  })
})

describe('Edit Picture', () => {
  it('follows Draw: Draw’s model while its provider edits pictures, else none', async () => {
    usePapelizAssistantProviderSettingsStore.setState({
      providerSettingsByProviderId: { ...metaAndGroqProviderSettings, openai: buildTestProviderSettings('openai', ['gpt-6-astra']) },
    })
    expect(resolvePapelizAssistantImageEditingModelNow()).toMatchObject({ papelizAssistantProviderId: 'meta-model-api', providerModelName: 'muse-image-1.0' })
    await usePapelizAssistantMediaModelChoicesStore.getState().chooseAssistantMediaModel('image-generation', { papelizAssistantProviderId: 'openai', providerModelName: 'gpt-image-2' })
    expect(resolvePapelizAssistantImageEditingModelNow()).toBeNull()
    await usePapelizAssistantMediaModelChoicesStore.getState().chooseAssistantMediaModelAutomatically('image-generation')
    expect(resolvePapelizAssistantImageEditingModelNow()?.providerModelName).toBe('muse-image-1.0')
  })
})
