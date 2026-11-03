import { describe, expect, it } from 'vitest'
import { PapelizAssistantAudioRecordingError, type PapelizAssistantAudioRecording } from './papeliz-assistant-audio-recording'
import {
  createPapelizOnePressMicController,
  joinPapelizTranscribedWordsToText,
  papelizNoTranscriptionModelSentence,
  papelizNothingRecordedSentence,
  type PapelizOnePressMicAudioTranscriptionRequest,
  type PapelizOnePressMicSpeechServices,
} from './papeliz-assistant-one-press-mic-controller'
import { PapelizAssistantProviderError } from './papeliz-openai-compatible-client'

// A stand-in microphone and speech model: recordings hold the bytes given, and transcriptions wait
// until the test answers them, so every stage of the recorder row can be looked at.

interface StandInRecording {
  standInAudioRecording: PapelizAssistantAudioRecording
  wasCancelled: () => boolean
}

function createStandInRecording(recordedAudioText: string): StandInRecording {
  let isCancelled = false
  return {
    standInAudioRecording: {
      audioRecordingStartedAtMilliseconds: 1000,
      readAudioRecordingSoundLevel: () => 0.5,
      stopAudioRecording: async () => new Blob(recordedAudioText.length > 0 ? [recordedAudioText] : [], { type: 'audio/webm' }),
      cancelAudioRecording: () => {
        isCancelled = true
      },
    },
    wasCancelled: () => isCancelled,
  }
}

interface WaitingTranscription {
  audioTranscriptionRequest: PapelizOnePressMicAudioTranscriptionRequest
  answerTranscription: (transcribedWords: string) => void
  failTranscription: (transcriptionError: unknown) => void
}

function createStandInSpeech(standInOptions: { recordedAudioText?: string; transcriptionSetupProblem?: string | null; recordingStartError?: unknown } = {}) {
  const startedRecordings: StandInRecording[] = []
  const waitingTranscriptions: WaitingTranscription[] = []
  const landedWords: string[] = []
  const speechServices: PapelizOnePressMicSpeechServices = {
    findTranscriptionSetupProblem: () => standInOptions.transcriptionSetupProblem ?? null,
    startAudioRecording: async () => {
      if (standInOptions.recordingStartError !== undefined) throw standInOptions.recordingStartError
      const standInRecording = createStandInRecording(standInOptions.recordedAudioText ?? 'spoken audio')
      startedRecordings.push(standInRecording)
      return standInRecording.standInAudioRecording
    },
    transcribeAudio: (audioTranscriptionRequest) =>
      new Promise<string>((answerTranscription, failTranscription) => {
        waitingTranscriptions.push({ audioTranscriptionRequest, answerTranscription, failTranscription })
      }),
  }
  const onePressMicStore = createPapelizOnePressMicController(speechServices)
  onePressMicStore.getState().setTranscribedWordsReceiver((transcribedWords) => landedWords.push(transcribedWords))
  return { onePressMicStore, startedRecordings, waitingTranscriptions, landedWords }
}

// Lets the stand-ins' promises settle.
const settleStandIns = () => new Promise<void>((settled) => setTimeout(settled, 0))

describe('the one-press mic', () => {
  it('records on one press, transcribes on the second, and hands the words to its box', async () => {
    const { onePressMicStore, startedRecordings, waitingTranscriptions, landedWords } = createStandInSpeech()
    expect(onePressMicStore.getState().onePressMicStage).toBe('resting')
    await onePressMicStore.getState().pressOnePressMic()
    expect(onePressMicStore.getState()).toMatchObject({ onePressMicStage: 'recording', recordingStartedAtMilliseconds: 1000 })
    expect(onePressMicStore.getState().readOnePressMicSoundLevel()).toBe(0.5)
    expect(startedRecordings).toHaveLength(1)

    const secondPress = onePressMicStore.getState().pressOnePressMic()
    await settleStandIns()
    expect(onePressMicStore.getState()).toMatchObject({ onePressMicStage: 'transcribing', transcribingProgressText: 'Transcribing…', recordingStartedAtMilliseconds: null })
    expect(waitingTranscriptions[0]?.audioTranscriptionRequest.transcriptionAudioFileName).toBe('recording.webm')
    waitingTranscriptions[0]?.audioTranscriptionRequest.onTranscriptionProgressText('Transcribing part 2 of 3…')
    expect(onePressMicStore.getState().transcribingProgressText).toBe('Transcribing part 2 of 3…')
    waitingTranscriptions[0]?.answerTranscription('  list the open questions  ')
    await secondPress
    expect(landedWords).toEqual(['list the open questions'])
    expect(onePressMicStore.getState()).toMatchObject({ onePressMicStage: 'resting', transcribingProgressText: null, onePressMicProblem: null })
  })

  it('throws a recording away on cancel, and nothing reaches the box', async () => {
    const { onePressMicStore, startedRecordings, waitingTranscriptions, landedWords } = createStandInSpeech()
    await onePressMicStore.getState().pressOnePressMic()
    onePressMicStore.getState().cancelOnePressMic()
    expect(onePressMicStore.getState().onePressMicStage).toBe('resting')
    expect(startedRecordings[0]?.wasCancelled()).toBe(true)
    expect(waitingTranscriptions).toHaveLength(0)
    expect(landedWords).toEqual([])
  })

  it('stops a transcription on cancel, and its late words are dropped', async () => {
    const { onePressMicStore, waitingTranscriptions, landedWords } = createStandInSpeech()
    await onePressMicStore.getState().pressOnePressMic()
    void onePressMicStore.getState().pressOnePressMic()
    await settleStandIns()
    expect(onePressMicStore.getState().onePressMicStage).toBe('transcribing')
    // A press while transcribing does nothing.
    await onePressMicStore.getState().pressOnePressMic()
    expect(onePressMicStore.getState().onePressMicStage).toBe('transcribing')
    onePressMicStore.getState().cancelOnePressMic()
    expect(waitingTranscriptions[0]?.audioTranscriptionRequest.abortSignal.aborted).toBe(true)
    waitingTranscriptions[0]?.answerTranscription('too late')
    await settleStandIns()
    expect(landedWords).toEqual([])
    expect(onePressMicStore.getState().onePressMicStage).toBe('resting')
  })

  it('offers an audio file when the microphone is refused', async () => {
    const refusedSentence = 'The microphone isn’t allowed for Papeliz. Allow it in the browser’s site settings, or bring in an audio file.'
    const { onePressMicStore } = createStandInSpeech({ recordingStartError: new PapelizAssistantAudioRecordingError(refusedSentence) })
    await onePressMicStore.getState().pressOnePressMic()
    expect(onePressMicStore.getState()).toMatchObject({
      onePressMicStage: 'resting',
      onePressMicProblem: { onePressMicProblemText: refusedSentence, onePressMicFixStep: 'bring-audio-file' },
    })
  })

  it('doesn’t ask for the microphone when no speech model is set up, and offers the provider settings', async () => {
    const { onePressMicStore, startedRecordings } = createStandInSpeech({ transcriptionSetupProblem: papelizNoTranscriptionModelSentence })
    await onePressMicStore.getState().pressOnePressMic()
    expect(startedRecordings).toHaveLength(0)
    expect(onePressMicStore.getState().onePressMicProblem).toEqual({ onePressMicProblemText: papelizNoTranscriptionModelSentence, onePressMicFixStep: 'choose-provider' })
  })

  it('asks to record again when nothing was recorded', async () => {
    const { onePressMicStore, waitingTranscriptions } = createStandInSpeech({ recordedAudioText: '' })
    await onePressMicStore.getState().pressOnePressMic()
    await onePressMicStore.getState().pressOnePressMic()
    expect(waitingTranscriptions).toHaveLength(0)
    expect(onePressMicStore.getState().onePressMicProblem).toEqual({ onePressMicProblemText: papelizNothingRecordedSentence, onePressMicFixStep: 'record-again' })
  })

  it('keeps the audio after a failed transcription, and sends it again on Try Again', async () => {
    const { onePressMicStore, waitingTranscriptions, landedWords } = createStandInSpeech()
    await onePressMicStore.getState().pressOnePressMic()
    const secondPress = onePressMicStore.getState().pressOnePressMic()
    await settleStandIns()
    waitingTranscriptions[0]?.failTranscription(new PapelizAssistantProviderError('The provider answered with an error (500).', 500))
    await secondPress
    expect(onePressMicStore.getState().onePressMicProblem).toEqual({ onePressMicProblemText: 'The provider answered with an error (500).', onePressMicFixStep: 'transcribe-again' })

    const againPromise = onePressMicStore.getState().transcribeOnePressMicAudioAgain()
    await settleStandIns()
    expect(onePressMicStore.getState()).toMatchObject({ onePressMicStage: 'transcribing', onePressMicProblem: null })
    expect(await waitingTranscriptions[1]?.audioTranscriptionRequest.transcriptionAudioBlob.text()).toBe('spoken audio')
    waitingTranscriptions[1]?.answerTranscription('second time')
    await againPromise
    expect(landedWords).toEqual(['second time'])
  })

  it('offers the provider settings when the key is refused', async () => {
    const { onePressMicStore, waitingTranscriptions } = createStandInSpeech()
    const audioFilePromise = onePressMicStore.getState().transcribeOnePressMicAudioFile(new File(['memo'], 'memo.m4a', { type: 'audio/mp4' }))
    await settleStandIns()
    expect(waitingTranscriptions[0]?.audioTranscriptionRequest.transcriptionAudioFileName).toBe('memo.m4a')
    waitingTranscriptions[0]?.failTranscription(new PapelizAssistantProviderError('The provider refused the API key (401).', 401))
    await audioFilePromise
    expect(onePressMicStore.getState().onePressMicProblem?.onePressMicFixStep).toBe('choose-provider')
  })

  it('transcribes an audio file without the microphone', async () => {
    const { onePressMicStore, startedRecordings, waitingTranscriptions, landedWords } = createStandInSpeech()
    const audioFilePromise = onePressMicStore.getState().transcribeOnePressMicAudioFile(new File(['standup'], 'standup.wav', { type: 'audio/wav' }))
    await settleStandIns()
    expect(onePressMicStore.getState().onePressMicStage).toBe('transcribing')
    waitingTranscriptions[0]?.answerTranscription('From the standup.')
    await audioFilePromise
    expect(startedRecordings).toHaveLength(0)
    expect(landedWords).toEqual(['From the standup.'])
  })
})

describe('joining the words to what is typed', () => {
  it('fills an empty box with the words alone', () => {
    expect(joinPapelizTranscribedWordsToText('  ', 'Hello there')).toBe('Hello there')
  })

  it('puts the words after a space on the same line', () => {
    expect(joinPapelizTranscribedWordsToText('Summarize this note ', 'and list the open questions.')).toBe('Summarize this note and list the open questions.')
  })

  it('starts the words on the new line the typing ended with', () => {
    expect(joinPapelizTranscribedWordsToText('Notes:\n', 'first point')).toBe('Notes:\nfirst point')
  })

  it('puts a transcript of several speakers after a blank line', () => {
    expect(joinPapelizTranscribedWordsToText('Meeting', 'Speaker A: Hi.\n\nSpeaker B: Hello.')).toBe('Meeting\n\nSpeaker A: Hi.\n\nSpeaker B: Hello.')
  })
})
