import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readPapelizUserSetting, writePapelizUserSetting } from '../settings/papeliz-user-settings'
import {
  buildPapelizAssistantMediaProviderConnection,
  describePapelizAssistantMediaModelInUse,
  listPapelizMediaCapableSavedProviderIds,
  listPapelizOfferedAssistantMediaModels,
  papelizAssistantMediaModelChoicesSettingName,
  resolvePapelizAssistantImageEditingModelNow,
  resolvePapelizAssistantMediaModelNow,
  resolvePapelizAssistantMediaModelWhenLoaded,
  usePapelizAssistantMediaModelChoicesStore,
} from './papeliz-assistant-media-model-choices-store'
import { usePapelizAssistantProviderSettingsStore, type PapelizAssistantProviderSettingsRecord } from './papeliz-assistant-provider-settings-store'

// Models for Each Task's store: Automatic as a cleared pick, the transcription pick saved and used,
// Describe Picture's vision models with Same as Chat, and Edit Picture following Draw. The settings
// store is a stand-in, so nothing is kept between tests; the keys are made up.

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
    chosenPictureDescriptionModel: null,
    typedImageGenerationModels: [],
    typedTranscriptionModels: [],
    typedPictureDescriptionModels: [],
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
})

describe('Describe Picture', () => {
  it('offers only the known vision models of the added providers, then the typed ones', async () => {
    expect(
      listPapelizOfferedAssistantMediaModels('picture-description', metaAndGroqProviderSettings, [{ papelizAssistantProviderId: 'groq', providerModelName: 'my-vision-model' }]).map(
        (offeredMediaModel) => `${offeredMediaModel.providerDisplayName} ${offeredMediaModel.providerModelName}${offeredMediaModel.isMediaModelTypedByPerson ? ' (typed)' : ''}`,
      ),
    ).toEqual([
      'Meta Model API muse-spark-1.3',
      'Meta Model API muse-spark-1.2',
      'Meta Model API muse-spark-1.1',
      'Meta Model API muse-wonder-1.0',
      'Groq qwen/qwen3.8-27b',
      'Groq my-vision-model (typed)',
    ])
  })

  it('lets a vision model be typed for any added provider, and sends it to that provider', () => {
    const customProviderSettings = { ...metaAndGroqProviderSettings, custom: buildTestProviderSettings('custom', ['local-chat']) }
    expect(listPapelizMediaCapableSavedProviderIds('picture-description', customProviderSettings)).toEqual(['meta-model-api', 'groq', 'custom'])
    expect(listPapelizMediaCapableSavedProviderIds('transcription', customProviderSettings)).toEqual(['meta-model-api', 'groq', 'custom'])
    usePapelizAssistantProviderSettingsStore.setState({ providerSettingsByProviderId: customProviderSettings })
    expect(buildPapelizAssistantMediaProviderConnection('picture-description', { papelizAssistantProviderId: 'custom', providerModelName: 'llava-local' })).toMatchObject({
      mediaConnectionOutcome: 'ready',
      providerConnection: { providerModelName: 'llava-local' },
    })
  })

  it('is Same as Chat until a model is chosen: the chat’s model is the one in use', async () => {
    expect(resolvePapelizAssistantMediaModelNow('picture-description')).toBeNull()
    expect(describePapelizAssistantMediaModelInUse('picture-description')).toMatchObject({
      providerModelName: 'muse-spark-1.3',
      providerDisplayName: 'Meta Model API',
      isMediaModelChosenAutomatically: true,
      isMediaModelSameAsChat: true,
    })
    await usePapelizAssistantMediaModelChoicesStore.getState().chooseAssistantMediaModel('picture-description', { papelizAssistantProviderId: 'groq', providerModelName: 'qwen/qwen3.8-27b' })
    expect(describePapelizAssistantMediaModelInUse('picture-description')).toMatchObject({
      providerModelName: 'qwen/qwen3.8-27b',
      mediaModelShortName: 'qwen3.8-27b',
      providerDisplayName: 'Groq',
      isMediaModelSameAsChat: false,
    })
    await usePapelizAssistantMediaModelChoicesStore.getState().chooseAssistantMediaModelAutomatically('picture-description')
    expect(describePapelizAssistantMediaModelInUse('picture-description')).toMatchObject({ isMediaModelSameAsChat: true })
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
