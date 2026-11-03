import { createStore, type StoreApi } from 'zustand/vanilla'
import {
  PapelizAssistantAudioRecordingError,
  getPapelizAudioFileExtension,
  startPapelizAssistantAudioRecording,
  type PapelizAssistantAudioRecording,
} from './papeliz-assistant-audio-recording'
import { transcribePapelizAudioWithChosenModel } from './papeliz-assistant-audio-transcription'
import { resolvePapelizAssistantMediaModelNow } from './papeliz-assistant-media-model-choices-store'
import { describePapelizAssistantMediaProblem } from './papeliz-assistant-media-problem-words'
import { PapelizAssistantProviderError } from './papeliz-openai-compatible-client'

// The one-press mic in every box where you write to the assistant (the chat box, Focus mode's box,
// the Ctrl K card's instruction and Imagine's prompt). One press starts recording, a second press
// (on ✓, where the mic was) stops it, and the words go to the box after "Transcribing…". Each box
// has its own; nothing is sent or run from here, the box only receives the words.

// resting: the mic waits. starting: the microphone is being asked for. recording, then transcribing.
export type PapelizOnePressMicStage = 'resting' | 'starting' | 'recording' | 'transcribing'

// The one step offered under a problem, the one that fixes it.
export type PapelizOnePressMicFixStep = 'bring-audio-file' | 'record-again' | 'transcribe-again' | 'choose-provider'

export interface PapelizOnePressMicProblem {
  onePressMicProblemText: string
  onePressMicFixStep: PapelizOnePressMicFixStep
}

export interface PapelizOnePressMicState {
  onePressMicStage: PapelizOnePressMicStage
  // When the microphone started, for the timer; null unless recording.
  recordingStartedAtMilliseconds: number | null
  // "Transcribing…", or the transcription's own progress ("Transcribing part 2 of 3…").
  transcribingProgressText: string | null
  onePressMicProblem: PapelizOnePressMicProblem | null
  // Starts recording when resting, finishes when recording, and does nothing otherwise.
  pressOnePressMic: () => Promise<void>
  finishOnePressMicRecording: () => Promise<void>
  // Throws a recording away, or stops a transcription before its words arrive.
  cancelOnePressMic: () => void
  transcribeOnePressMicAudioFile: (audioFile: File) => Promise<void>
  // Sends the last audio again, after a transcription failed.
  transcribeOnePressMicAudioAgain: () => Promise<void>
  dismissOnePressMicProblem: () => void
  readOnePressMicSoundLevel: () => number
  // Where the heard words go: the box sets it, and sets it again as it changes.
  setTranscribedWordsReceiver: (receiveTranscribedWords: (transcribedWords: string) => void) => void
}

export type PapelizOnePressMicStore = StoreApi<PapelizOnePressMicState>

export interface PapelizOnePressMicAudioTranscriptionRequest {
  transcriptionAudioBlob: Blob
  transcriptionAudioFileName: string
  onTranscriptionProgressText: (transcriptionProgressText: string) => void
  abortSignal: AbortSignal
}

// What the mic records with and transcribes through: the browser and the chosen speech model, or
// stand-ins in tests.
export interface PapelizOnePressMicSpeechServices {
  // What is missing before anything can be transcribed, or null when a speech model is ready.
  findTranscriptionSetupProblem: () => string | null
  startAudioRecording: () => Promise<PapelizAssistantAudioRecording>
  transcribeAudio: (audioTranscriptionRequest: PapelizOnePressMicAudioTranscriptionRequest) => Promise<string>
}

export const papelizNoTranscriptionModelSentence = 'Add a provider that transcribes (the Meta Model API does) in Settings › AI Provider.'
export const papelizNothingRecordedSentence = 'Nothing was recorded. Check the microphone and try again.'
export const papelizNoWordsHeardSentence = 'No words were heard in the audio.'
const papelizTranscribingSentence = 'Transcribing…'

const papelizOnePressMicSpeechServices: PapelizOnePressMicSpeechServices = {
  findTranscriptionSetupProblem: () => (resolvePapelizAssistantMediaModelNow('transcription') === null ? papelizNoTranscriptionModelSentence : null),
  startAudioRecording: startPapelizAssistantAudioRecording,
  transcribeAudio: async ({ transcriptionAudioBlob, transcriptionAudioFileName, onTranscriptionProgressText, abortSignal }) => {
    const transcriptionModelChoice = resolvePapelizAssistantMediaModelNow('transcription')
    if (transcriptionModelChoice === null) throw new PapelizAssistantProviderError(papelizNoTranscriptionModelSentence, null)
    return transcribePapelizAudioWithChosenModel({
      transcriptionAudioBlob,
      transcriptionAudioFileName,
      transcriptionModelChoice,
      onTranscriptionProgressText,
      abortSignal,
    })
  },
}

// The words go after what is already typed: on the same line after a space, or, for a transcript of
// several paragraphs (speakers taking turns), after a blank line.
export function joinPapelizTranscribedWordsToText(typedText: string, transcribedWords: string): string {
  if (typedText.trim().length === 0) return transcribedWords
  if (transcribedWords.includes('\n')) return `${typedText.trimEnd()}\n\n${transcribedWords}`
  if (/\n[ \t]*$/.test(typedText)) return `${typedText.replace(/[ \t]+$/, '')}${transcribedWords}`
  return `${typedText.trimEnd()} ${transcribedWords}`
}

// The step that fixes what went wrong: another way in when the microphone fails, the provider's
// settings when no speech model is set up or the key is refused, otherwise another try.
function pickOnePressMicFixStep(onePressMicError: unknown, isAudioFromFile: boolean): PapelizOnePressMicFixStep {
  if (onePressMicError instanceof PapelizAssistantAudioRecordingError) return 'bring-audio-file'
  if (onePressMicError instanceof PapelizAssistantProviderError) {
    if (onePressMicError.message === papelizNoTranscriptionModelSentence) return 'choose-provider'
    if (onePressMicError.providerHttpStatus === 401 || onePressMicError.providerHttpStatus === 403) return 'choose-provider'
  }
  return isAudioFromFile ? 'bring-audio-file' : 'transcribe-again'
}

export function createPapelizOnePressMicController(speechServices: PapelizOnePressMicSpeechServices = papelizOnePressMicSpeechServices): PapelizOnePressMicStore {
  let receiveTranscribedWords: (transcribedWords: string) => void = () => undefined
  let activeAudioRecording: PapelizAssistantAudioRecording | null = null
  let transcriptionAbortController: AbortController | null = null
  let lastTranscribedAudio: { audioBlob: Blob; audioFileName: string; isAudioFromFile: boolean } | null = null
  // Each start or cancel begins a new run; a run's late results are dropped once another has begun.
  let onePressMicRunNumber = 0

  return createStore<PapelizOnePressMicState>((setOnePressMicState, getOnePressMicState) => {
    const showOnePressMicProblem = (onePressMicProblemText: string, onePressMicFixStep: PapelizOnePressMicFixStep) =>
      setOnePressMicState({
        onePressMicStage: 'resting',
        recordingStartedAtMilliseconds: null,
        transcribingProgressText: null,
        onePressMicProblem: { onePressMicProblemText, onePressMicFixStep },
      })

    const transcribeOnePressMicAudio = async (audioBlob: Blob, audioFileName: string, isAudioFromFile: boolean) => {
      const transcriptionRunNumber = ++onePressMicRunNumber
      lastTranscribedAudio = { audioBlob, audioFileName, isAudioFromFile }
      const transcriptionSetupProblem = speechServices.findTranscriptionSetupProblem()
      if (transcriptionSetupProblem !== null) {
        showOnePressMicProblem(transcriptionSetupProblem, 'choose-provider')
        return
      }
      transcriptionAbortController = new AbortController()
      setOnePressMicState({
        onePressMicStage: 'transcribing',
        recordingStartedAtMilliseconds: null,
        transcribingProgressText: papelizTranscribingSentence,
        onePressMicProblem: null,
      })
      try {
        const transcribedWords = (
          await speechServices.transcribeAudio({
            transcriptionAudioBlob: audioBlob,
            transcriptionAudioFileName: audioFileName,
            onTranscriptionProgressText: (transcriptionProgressText) => {
              if (transcriptionRunNumber === onePressMicRunNumber) setOnePressMicState({ transcribingProgressText: transcriptionProgressText })
            },
            abortSignal: transcriptionAbortController.signal,
          })
        ).trim()
        if (transcriptionRunNumber !== onePressMicRunNumber) return
        transcriptionAbortController = null
        if (transcribedWords.length === 0) {
          showOnePressMicProblem(papelizNoWordsHeardSentence, isAudioFromFile ? 'bring-audio-file' : 'record-again')
          return
        }
        setOnePressMicState({ onePressMicStage: 'resting', transcribingProgressText: null, onePressMicProblem: null })
        receiveTranscribedWords(transcribedWords)
      } catch (transcriptionError) {
        if (transcriptionRunNumber !== onePressMicRunNumber) return
        transcriptionAbortController = null
        showOnePressMicProblem(describePapelizAssistantMediaProblem(transcriptionError), pickOnePressMicFixStep(transcriptionError, isAudioFromFile))
      }
    }

    const startOnePressMicRecording = async () => {
      const recordingRunNumber = ++onePressMicRunNumber
      // With no speech model there is nothing to send a recording to, so the microphone isn't asked for.
      const transcriptionSetupProblem = speechServices.findTranscriptionSetupProblem()
      if (transcriptionSetupProblem !== null) {
        showOnePressMicProblem(transcriptionSetupProblem, 'choose-provider')
        return
      }
      setOnePressMicState({ onePressMicStage: 'starting', onePressMicProblem: null })
      try {
        const startedAudioRecording = await speechServices.startAudioRecording()
        if (recordingRunNumber !== onePressMicRunNumber) {
          startedAudioRecording.cancelAudioRecording()
          return
        }
        activeAudioRecording = startedAudioRecording
        setOnePressMicState({ onePressMicStage: 'recording', recordingStartedAtMilliseconds: startedAudioRecording.audioRecordingStartedAtMilliseconds })
      } catch (recordingStartError) {
        if (recordingStartError instanceof DOMException && recordingStartError.name === 'AbortError') return
        if (recordingRunNumber !== onePressMicRunNumber) return
        showOnePressMicProblem(describePapelizAssistantMediaProblem(recordingStartError), pickOnePressMicFixStep(recordingStartError, false))
      }
    }

    const finishOnePressMicRecording = async () => {
      const finishedAudioRecording = activeAudioRecording
      if (getOnePressMicState().onePressMicStage !== 'recording' || finishedAudioRecording === null) return
      activeAudioRecording = null
      const finishRunNumber = ++onePressMicRunNumber
      setOnePressMicState({ onePressMicStage: 'transcribing', recordingStartedAtMilliseconds: null, transcribingProgressText: papelizTranscribingSentence })
      const recordedAudioBlob = await finishedAudioRecording.stopAudioRecording()
      if (finishRunNumber !== onePressMicRunNumber) return
      if (recordedAudioBlob.size === 0) {
        showOnePressMicProblem(papelizNothingRecordedSentence, 'record-again')
        return
      }
      await transcribeOnePressMicAudio(recordedAudioBlob, `recording${getPapelizAudioFileExtension(recordedAudioBlob.type)}`, false)
    }

    return {
      onePressMicStage: 'resting',
      recordingStartedAtMilliseconds: null,
      transcribingProgressText: null,
      onePressMicProblem: null,
      pressOnePressMic: async () => {
        const { onePressMicStage } = getOnePressMicState()
        if (onePressMicStage === 'resting') await startOnePressMicRecording()
        else if (onePressMicStage === 'recording') await finishOnePressMicRecording()
      },
      finishOnePressMicRecording,
      cancelOnePressMic: () => {
        onePressMicRunNumber += 1
        activeAudioRecording?.cancelAudioRecording()
        activeAudioRecording = null
        transcriptionAbortController?.abort()
        transcriptionAbortController = null
        setOnePressMicState({ onePressMicStage: 'resting', recordingStartedAtMilliseconds: null, transcribingProgressText: null })
      },
      transcribeOnePressMicAudioFile: async (audioFile) => {
        const { onePressMicStage } = getOnePressMicState()
        if (onePressMicStage !== 'resting') return
        await transcribeOnePressMicAudio(audioFile, audioFile.name || 'audio', true)
      },
      transcribeOnePressMicAudioAgain: async () => {
        if (getOnePressMicState().onePressMicStage !== 'resting' || lastTranscribedAudio === null) return
        await transcribeOnePressMicAudio(lastTranscribedAudio.audioBlob, lastTranscribedAudio.audioFileName, lastTranscribedAudio.isAudioFromFile)
      },
      dismissOnePressMicProblem: () => setOnePressMicState({ onePressMicProblem: null }),
      readOnePressMicSoundLevel: () => activeAudioRecording?.readAudioRecordingSoundLevel() ?? 0,
      setTranscribedWordsReceiver: (transcribedWordsReceiver) => {
        receiveTranscribedWords = transcribedWordsReceiver
      },
    }
  })
}
