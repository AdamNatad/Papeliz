import { Check, CircleAlert, Mic, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { useStore } from 'zustand'
import { PapelizIconButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizLoadingBar } from '../ui/papeliz-loading-bar'
import { PapelizLoadingClock, usePapelizLoadingStartedAtMilliseconds } from '../ui/papeliz-loading-clock'
import { readPapelizLoadingPartFromWords } from '../ui/papeliz-loading-progress-count'
import { PapelizLoadingRing } from '../ui/papeliz-loading-ring'
import { formatPapelizAudioDuration, papelizMicrophoneFirstAskSentence } from './papeliz-assistant-audio-recording'
import { usePapelizAssistantMediaModelInUse } from './papeliz-assistant-media-parts'
import { createPapelizOnePressMicController, type PapelizOnePressMicFixStep, type PapelizOnePressMicStore } from './papeliz-assistant-one-press-mic-controller'

// The one-press mic's parts, shared by every box where you write to the assistant: the mic, the row
// that stands in for the box's own row while it records or transcribes (× · level line · timer · ✓),
// the problem line under the box, and the hidden audio-file input that + and the problem line open.

// The mic, ✓ and the busy circle share one round size, so ✓ and the circle land exactly on the mic.
const papelizOnePressMicRoundClassName =
  'grid size-8 flex-none place-items-center rounded-full transition-[background-color,color,opacity,transform] duration-150 active:scale-90 pointer-coarse:size-10'

const papelizOnePressMicLevelBarCount = 96
const papelizOnePressMicLevelDrawMilliseconds = 70

// A box's own mic: the words it hears go to `landTranscribedWords`. Leaving the box throws away a
// recording still running.
export function usePapelizOnePressMic(landTranscribedWords: (transcribedWords: string) => void): PapelizOnePressMicStore {
  const [onePressMicStore] = useState(() => createPapelizOnePressMicController())
  useLayoutEffect(() => onePressMicStore.getState().setTranscribedWordsReceiver(landTranscribedWords))
  useEffect(() => () => onePressMicStore.getState().cancelOnePressMic(), [onePressMicStore])
  return onePressMicStore
}

export function useIsPapelizOnePressMicBusy(onePressMicStore: PapelizOnePressMicStore): boolean {
  return useStore(onePressMicStore, (onePressMicState) => onePressMicState.onePressMicStage === 'recording' || onePressMicState.onePressMicStage === 'transcribing')
}

// Esc throws a recording away or stops a transcription; Enter finishes a recording. Returns true when
// the key belonged to the mic.
export function handlePapelizOnePressMicKey(keyboardEvent: KeyboardEvent, onePressMicStore: PapelizOnePressMicStore): boolean {
  const { onePressMicStage, cancelOnePressMic, finishOnePressMicRecording } = onePressMicStore.getState()
  if (onePressMicStage !== 'recording' && onePressMicStage !== 'transcribing') return false
  if (keyboardEvent.key === 'Escape') {
    keyboardEvent.preventDefault()
    keyboardEvent.stopPropagation()
    cancelOnePressMic()
    return true
  }
  if (keyboardEvent.key === 'Enter' && !keyboardEvent.nativeEvent.isComposing) {
    keyboardEvent.preventDefault()
    if (onePressMicStage === 'recording') void finishOnePressMicRecording()
    return true
  }
  return false
}

interface PapelizOnePressMicButtonProps {
  onePressMicStore: PapelizOnePressMicStore
  isMicDisabled?: boolean
  // Pressed when the box can't take words yet (no provider): the press does this instead.
  onMicPressInstead?: () => void
  // The chat box's row narrows it when it is short of room.
  micButtonClassName?: string
}

// The mic's hover: how it works, which model transcribes (Transcribe's, in Models for Transcribe and
// Draw, or what Automatic uses now), and the browser's first question.
export function describePapelizOnePressMicTitle(transcriptionModelInUse: { providerModelName: string; providerDisplayName: string } | null): string {
  const transcriptionModelSentence =
    transcriptionModelInUse === null ? '' : ` Transcribes with ${transcriptionModelInUse.providerModelName}, on ${transcriptionModelInUse.providerDisplayName}.`
  return `Speak: press to record, press again to stop.${transcriptionModelSentence} ${papelizMicrophoneFirstAskSentence}.`
}

// The recorder row's words while it transcribes: the step, then the model it uses ("Transcribing ·
// muse-voice-transcribe-1.0", "Part 2 of 3 · whisper-large-v3-turbo"). The provider is in the mic's
// hover, so "Transcribing with Groq…" reads as "Transcribing" here.
export function describePapelizOnePressMicTranscribingWords(transcribingProgressText: string | null, transcriptionModelName: string | null): string {
  const transcribingStepWords = (transcribingProgressText ?? 'Transcribing…')
    .replace(/…$/, '')
    .replace(/^Transcribing with .+$/, 'Transcribing')
    .replace(/^Transcribing part /, 'Part ')
  return transcriptionModelName === null ? `${transcribingStepWords}…` : `${transcribingStepWords} · ${transcriptionModelName}`
}

export function PapelizOnePressMicButton({ onePressMicStore, isMicDisabled = false, onMicPressInstead, micButtonClassName }: PapelizOnePressMicButtonProps) {
  const isMicStarting = useStore(onePressMicStore, (onePressMicState) => onePressMicState.onePressMicStage === 'starting')
  const transcriptionModelInUse = usePapelizAssistantMediaModelInUse('transcription')
  return (
    <button
      type="button"
      aria-label="Speak"
      aria-busy={isMicStarting ? true : undefined}
      title={describePapelizOnePressMicTitle(transcriptionModelInUse)}
      disabled={isMicDisabled || isMicStarting}
      onClick={() => (onMicPressInstead === undefined ? void onePressMicStore.getState().pressOnePressMic() : onMicPressInstead())}
      className={joinPapelizClassNames(
        papelizOnePressMicRoundClassName,
        'text-papeliz-ink-muted hover:bg-papeliz-hover hover:text-papeliz-ink disabled:opacity-40',
        isMicStarting && 'bg-papeliz-blue-soft text-papeliz-blue disabled:opacity-100',
        micButtonClassName,
      )}
    >
      <Mic className="size-[17px]" aria-hidden="true" />
    </button>
  )
}

// The loudness of the last few seconds, newest on the right. With reduced motion it lies still: the
// timer and the red dot still show it records.
function PapelizOnePressMicLevelLine({ onePressMicStore }: { onePressMicStore: PapelizOnePressMicStore }) {
  const levelLineRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const levelLineElement = levelLineRef.current
    if (levelLineElement === null || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const soundLevelHistory: number[] = Array.from({ length: papelizOnePressMicLevelBarCount }, () => 0)
    let lastDrawnAtMilliseconds = 0
    let levelFrameRequestId = 0
    const drawSoundLevel = (frameTimeMilliseconds: number) => {
      if (frameTimeMilliseconds - lastDrawnAtMilliseconds >= papelizOnePressMicLevelDrawMilliseconds) {
        lastDrawnAtMilliseconds = frameTimeMilliseconds
        soundLevelHistory.shift()
        soundLevelHistory.push(onePressMicStore.getState().readOnePressMicSoundLevel())
        for (const [levelBarIndex, levelBarElement] of [...levelLineElement.children].entries()) {
          if (levelBarElement instanceof HTMLElement) levelBarElement.style.height = `${3 + Math.round((soundLevelHistory[levelBarIndex] ?? 0) * 17)}px`
        }
      }
      levelFrameRequestId = requestAnimationFrame(drawSoundLevel)
    }
    levelFrameRequestId = requestAnimationFrame(drawSoundLevel)
    return () => cancelAnimationFrame(levelFrameRequestId)
  }, [onePressMicStore])
  return (
    <span
      ref={levelLineRef}
      role="img"
      aria-label="Sound level"
      className="flex h-6 min-w-0 flex-1 items-center justify-end gap-[2px] overflow-hidden px-1.5 [mask-image:linear-gradient(90deg,transparent,#000_26%)]"
    >
      {Array.from({ length: papelizOnePressMicLevelBarCount }, (_, levelBarIndex) => (
        <span key={levelBarIndex} className="block h-[3px] w-[2.5px] flex-none rounded-full bg-papeliz-blue" />
      ))}
    </span>
  )
}

function PapelizOnePressMicTimer({ recordingStartedAtMilliseconds }: { recordingStartedAtMilliseconds: number }) {
  const [recordedSeconds, setRecordedSeconds] = useState(0)
  useEffect(() => {
    const timerIntervalId = window.setInterval(() => setRecordedSeconds(Math.floor((performance.now() - recordingStartedAtMilliseconds) / 1000)), 250)
    return () => window.clearInterval(timerIntervalId)
  }, [recordingStartedAtMilliseconds])
  return <span>{formatPapelizAudioDuration(recordedSeconds)}</span>
}

interface PapelizOnePressMicTranscribingLineProps {
  transcribingWords: string
  transcribingProgressText: string | null
}

// What transcribing is doing and a clock, over a thin bar that fills part by part when a long
// recording is sent in parts, and slides until a part is done.
function PapelizOnePressMicTranscribingLine({ transcribingWords, transcribingProgressText }: PapelizOnePressMicTranscribingLineProps) {
  const transcribingStartedAtMilliseconds = usePapelizLoadingStartedAtMilliseconds()
  const transcribingPart = readPapelizLoadingPartFromWords(transcribingProgressText ?? '')
  const transcribedPartsPercent =
    transcribingPart === null || transcribingPart.runningPartNumber === 1
      ? null
      : Math.floor(((transcribingPart.runningPartNumber - 1) / transcribingPart.loadingPartCount) * 100)
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1 px-1.5">
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-papeliz-ink-muted" aria-live="polite">
          {transcribingWords}
        </span>
        <PapelizLoadingClock loadingStartedAtMilliseconds={transcribingStartedAtMilliseconds} />
      </span>
      <PapelizLoadingBar loadingBarPercent={transcribedPartsPercent} loadingBarLabel="Transcribing" />
    </span>
  )
}

interface PapelizOnePressMicRecorderRowProps {
  onePressMicStore: PapelizOnePressMicStore
  // Whatever follows the mic at rest (Send, Run), drawn the same, so ✓ lands on the mic's own spot.
  trailingControls?: ReactNode
}

// The box's row while the mic records or transcribes: × where the row starts, the level line and the
// timer (or "Transcribing · <model>"), then ✓ (or the busy circle) where the mic was. ✓ takes focus, so Enter
// finishes; Esc throws the recording away.
export function PapelizOnePressMicRecorderRow({ onePressMicStore, trailingControls }: PapelizOnePressMicRecorderRowProps) {
  const onePressMicStage = useStore(onePressMicStore, (onePressMicState) => onePressMicState.onePressMicStage)
  const recordingStartedAtMilliseconds = useStore(onePressMicStore, (onePressMicState) => onePressMicState.recordingStartedAtMilliseconds)
  const transcribingProgressText = useStore(onePressMicStore, (onePressMicState) => onePressMicState.transcribingProgressText)
  const transcriptionModelInUse = usePapelizAssistantMediaModelInUse('transcription')
  const doneButtonRef = useRef<HTMLButtonElement>(null)
  const isRecording = onePressMicStage === 'recording'
  useEffect(() => {
    if (isRecording) doneButtonRef.current?.focus()
  }, [isRecording])

  return (
    <>
      <button
        type="button"
        aria-label={isRecording ? 'Throw the Recording Away' : 'Stop Transcribing'}
        title={isRecording ? 'Throw the recording away (Esc)' : 'Stop transcribing (Esc)'}
        onClick={() => onePressMicStore.getState().cancelOnePressMic()}
        className="mr-0.5 grid size-7 flex-none place-items-center rounded-full text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink pointer-coarse:size-10"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
      {isRecording ? (
        <>
          <PapelizOnePressMicLevelLine onePressMicStore={onePressMicStore} />
          <span className="flex flex-none items-center gap-1.5 px-1.5 text-[12.5px] text-papeliz-ink tabular-nums" role="timer" aria-label="Recording time">
            <span className="size-[7px] flex-none animate-pulse rounded-full bg-papeliz-error-notice-icon motion-reduce:animate-none" aria-hidden="true" />
            {recordingStartedAtMilliseconds !== null && <PapelizOnePressMicTimer recordingStartedAtMilliseconds={recordingStartedAtMilliseconds} />}
          </span>
          <button
            ref={doneButtonRef}
            type="button"
            aria-label="Done Speaking"
            title="Done: put the words in the box (Enter)"
            onClick={() => void onePressMicStore.getState().finishOnePressMicRecording()}
            className={joinPapelizClassNames(papelizOnePressMicRoundClassName, 'bg-papeliz-gradient-start text-white shadow-[0_0_0_3px_var(--color-papeliz-blue-soft)] hover:brightness-110')}
          >
            <Check className="size-4" strokeWidth={2.6} aria-hidden="true" />
          </button>
        </>
      ) : (
        <>
          <PapelizOnePressMicTranscribingLine
            transcribingWords={describePapelizOnePressMicTranscribingWords(transcribingProgressText, transcriptionModelInUse?.providerModelName ?? null)}
            transcribingProgressText={transcribingProgressText}
          />
          <span className={joinPapelizClassNames(papelizOnePressMicRoundClassName, 'text-papeliz-blue')} aria-hidden="true">
            <PapelizLoadingRing />
          </span>
        </>
      )}
      {trailingControls}
    </>
  )
}

const papelizOnePressMicFixStepLabels: Readonly<Record<PapelizOnePressMicFixStep, string>> = {
  'bring-audio-file': 'Transcribe an Audio File',
  'record-again': 'Try Again',
  'transcribe-again': 'Try Again',
  'choose-provider': 'Choose a Provider',
}

interface PapelizOnePressMicProblemLineProps {
  onePressMicStore: PapelizOnePressMicStore
  onBringAudioFile: () => void
  onChooseProvider: () => void
  className?: string
}

// What went wrong, in today's words, under the box, with the one step that fixes it.
export function PapelizOnePressMicProblemLine({ onePressMicStore, onBringAudioFile, onChooseProvider, className }: PapelizOnePressMicProblemLineProps) {
  const onePressMicProblem = useStore(onePressMicStore, (onePressMicState) => onePressMicState.onePressMicProblem)
  if (onePressMicProblem === null) return null
  const takeFixStep = () => {
    const { dismissOnePressMicProblem, pressOnePressMic, transcribeOnePressMicAudioAgain } = onePressMicStore.getState()
    dismissOnePressMicProblem()
    if (onePressMicProblem.onePressMicFixStep === 'bring-audio-file') onBringAudioFile()
    else if (onePressMicProblem.onePressMicFixStep === 'record-again') void pressOnePressMic()
    else if (onePressMicProblem.onePressMicFixStep === 'transcribe-again') void transcribeOnePressMicAudioAgain()
    else onChooseProvider()
  }
  return (
    <p role="alert" className={joinPapelizClassNames('flex items-start gap-1.5 text-[12.5px] leading-snug text-papeliz-diff-removed-ink', className)}>
      <CircleAlert className="mt-0.5 size-3.5 flex-none" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        {onePressMicProblem.onePressMicProblemText}{' '}
        <button type="button" onClick={takeFixStep} className="font-semibold whitespace-nowrap text-papeliz-blue hover:underline">
          {papelizOnePressMicFixStepLabels[onePressMicProblem.onePressMicFixStep]}
        </button>
      </span>
      <PapelizIconButton iconButtonLabel="Dismiss" iconButtonSize="extra-small" onClick={() => onePressMicStore.getState().dismissOnePressMicProblem()}>
        <X className="size-3" aria-hidden="true" />
      </PapelizIconButton>
    </p>
  )
}

interface PapelizOnePressMicAudioFileInputProps {
  onePressMicStore: PapelizOnePressMicStore
  audioFileInputRef: RefObject<HTMLInputElement | null>
  audioFileInputLabel: string
}

// The hidden picker behind "Transcribe an Audio File": the file's words go to the box like spoken ones.
export function PapelizOnePressMicAudioFileInput({ onePressMicStore, audioFileInputRef, audioFileInputLabel }: PapelizOnePressMicAudioFileInputProps) {
  return (
    <input
      ref={audioFileInputRef}
      type="file"
      accept="audio/*,.mp3,.wav,.m4a,.mp4,.webm,.ogg,.opus,.flac,.aac"
      hidden
      aria-label={audioFileInputLabel}
      onChange={(fileInputEvent) => {
        const audioFile = fileInputEvent.target.files?.[0]
        if (audioFile !== undefined) void onePressMicStore.getState().transcribeOnePressMicAudioFile(audioFile)
        fileInputEvent.target.value = ''
      }}
    />
  )
}
