import { FileAudio, ImagePlus, Mic, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PapelizPopoverMenu, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { formatPapelizAudioDuration, getPapelizAudioFileExtension, isPapelizAudioRecordingAvailable, startPapelizAssistantAudioRecording, type PapelizAssistantAudioRecording } from './papeliz-assistant-audio-recording'
import { transcribePapelizAudioWithChosenModel } from './papeliz-assistant-audio-transcription'
import { usePapelizChatImagineStore } from './papeliz-assistant-chat-imagine-store'
import { usePapelizAssistantConversationStore } from './papeliz-assistant-conversation-store'
import { resolvePapelizAssistantMediaModelNow } from './papeliz-assistant-media-model-choices-store'
import { describePapelizAssistantMediaProblem } from './papeliz-assistant-media-problem-words'
import { usePapelizAssistantPanelUiStore } from './papeliz-assistant-panel-ui-store'

// The chat box's own Meta-model buttons, beside Add Files:
// - the microphone records (the browser asks for it only then) or takes an audio file, and the
//   transcript goes into the chat box, to send as it is or after a change; in Write the assistant
//   turns it into a note as a change to accept;
// - Imagine makes a picture of what is typed, shown in the chat with Remove C2PA, Save to Vault and
//   Put in Note.

const papelizComposerMediaButtonClassName =
  'grid size-7 flex-none place-items-center rounded-full text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink disabled:opacity-40 pointer-coarse:size-10'

function PapelizComposerRecordingTimer({ recordingStartedAtMilliseconds }: { recordingStartedAtMilliseconds: number }) {
  const [recordedSeconds, setRecordedSeconds] = useState(0)
  useEffect(() => {
    const timerInterval = window.setInterval(() => setRecordedSeconds((performance.now() - recordingStartedAtMilliseconds) / 1000), 250)
    return () => window.clearInterval(timerInterval)
  }, [recordingStartedAtMilliseconds])
  return <span className="tabular-nums">{formatPapelizAudioDuration(recordedSeconds)}</span>
}

let activeComposerAudioRecording: PapelizAssistantAudioRecording | null = null

export function PapelizAssistantComposerMediaButtons() {
  const composerDraftText = usePapelizAssistantConversationStore((conversationState) => conversationState.composerDraftText)
  const setComposerDraftText = usePapelizAssistantConversationStore((conversationState) => conversationState.setComposerDraftText)
  const imagineInChat = usePapelizChatImagineStore((chatImagineState) => chatImagineState.imagineInChat)
  const requestComposerFocus = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.requestComposerFocus)
  const [voiceMenuPosition, setVoiceMenuPosition] = useState<PapelizPopoverMenuPosition | null>(null)
  const [recordingStartedAtMilliseconds, setRecordingStartedAtMilliseconds] = useState<number | null>(null)
  const [transcribingProgressText, setTranscribingProgressText] = useState<string | null>(null)
  const audioFileInputRef = useRef<HTMLInputElement>(null)

  const showComposerMediaProblem = (composerMediaError: unknown) =>
    usePapelizWorkspaceStore.getState().showWorkspaceNotice('error', describePapelizAssistantMediaProblem(composerMediaError))

  // The transcript joins whatever is already typed, and the box takes focus to send it.
  const transcribeIntoComposer = async (audioBlob: Blob, audioFileName: string) => {
    const transcriptionModelChoice = resolvePapelizAssistantMediaModelNow('transcription')
    if (transcriptionModelChoice === null) {
      usePapelizWorkspaceStore.getState().showWorkspaceNotice('error', 'Add a provider that transcribes (the Meta Model API does) in Settings › AI Provider.')
      return
    }
    setTranscribingProgressText('Transcribing…')
    try {
      const transcriptText = await transcribePapelizAudioWithChosenModel({
        transcriptionAudioBlob: audioBlob,
        transcriptionAudioFileName: audioFileName,
        transcriptionModelChoice,
        onTranscriptionProgressText: setTranscribingProgressText,
      })
      const typedDraftText = usePapelizAssistantConversationStore.getState().composerDraftText.trimEnd()
      setComposerDraftText(typedDraftText.length > 0 ? `${typedDraftText}\n\n${transcriptText}` : transcriptText)
      requestComposerFocus()
    } catch (transcriptionError) {
      showComposerMediaProblem(transcriptionError)
    } finally {
      setTranscribingProgressText(null)
    }
  }

  const startComposerRecording = async () => {
    try {
      activeComposerAudioRecording = await startPapelizAssistantAudioRecording()
      setRecordingStartedAtMilliseconds(activeComposerAudioRecording.audioRecordingStartedAtMilliseconds)
    } catch (recordingStartError) {
      showComposerMediaProblem(recordingStartError)
    }
  }

  const stopComposerRecording = async () => {
    const composerAudioRecording = activeComposerAudioRecording
    if (composerAudioRecording === null) return
    activeComposerAudioRecording = null
    setRecordingStartedAtMilliseconds(null)
    const recordedAudioBlob = await composerAudioRecording.stopAudioRecording()
    if (recordedAudioBlob.size > 0) await transcribeIntoComposer(recordedAudioBlob, `recording${getPapelizAudioFileExtension(recordedAudioBlob.type)}`)
  }

  useEffect(
    () => () => {
      activeComposerAudioRecording?.cancelAudioRecording()
      activeComposerAudioRecording = null
    },
    [],
  )

  if (recordingStartedAtMilliseconds !== null) {
    return (
      <button
        type="button"
        aria-label="Stop Recording"
        title="Stop, and put the words in the chat box"
        onClick={() => void stopComposerRecording()}
        className="mr-0.5 flex h-7 flex-none items-center gap-1.5 rounded-full bg-papeliz-diff-removed-ink px-2.5 text-[12.5px] font-medium text-white pointer-coarse:h-10"
      >
        <Square className="size-3 fill-current" aria-hidden="true" />
        <PapelizComposerRecordingTimer recordingStartedAtMilliseconds={recordingStartedAtMilliseconds} />
      </button>
    )
  }

  return (
    <>
      {transcribingProgressText !== null ? (
        <span className="mr-1 flex-none text-[12px] text-papeliz-ink-muted" aria-live="polite">
          {transcribingProgressText}
        </span>
      ) : (
        <button
          type="button"
          aria-label="Speak"
          aria-haspopup="menu"
          aria-expanded={voiceMenuPosition !== null}
          title="Speak to the assistant: record or bring in audio, and the words go in the chat box"
          onClick={(clickEvent) => {
            const voiceButtonRect = clickEvent.currentTarget.getBoundingClientRect()
            setVoiceMenuPosition({ menuAnchorLeft: voiceButtonRect.left, menuAnchorTop: voiceButtonRect.bottom + 4 })
          }}
          className={papelizComposerMediaButtonClassName}
        >
          <Mic className="size-4" aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        aria-label="Imagine a Picture"
        title={composerDraftText.trim().length === 0 ? 'Imagine: type what to picture, then press here' : 'Imagine: make a picture of what you typed'}
        disabled={composerDraftText.trim().length === 0}
        onClick={() => {
          const imaginePromptText = composerDraftText
          setComposerDraftText('')
          void imagineInChat(imaginePromptText)
        }}
        className={joinPapelizClassNames(papelizComposerMediaButtonClassName, 'mr-0.5')}
      >
        <ImagePlus className="size-4" aria-hidden="true" />
      </button>
      <input
        ref={audioFileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.mp4,.webm,.ogg,.opus,.flac,.aac"
        hidden
        aria-label="Transcribe an audio file into the chat box"
        onChange={(fileInputEvent) => {
          const audioFile = fileInputEvent.target.files?.[0]
          if (audioFile !== undefined) void transcribeIntoComposer(audioFile, audioFile.name || 'audio')
          fileInputEvent.target.value = ''
        }}
      />
      {voiceMenuPosition !== null && (
        <PapelizPopoverMenu
          menuLabel="Speak"
          menuPosition={voiceMenuPosition}
          onMenuClose={() => setVoiceMenuPosition(null)}
          menuItems={[
            ...(isPapelizAudioRecordingAvailable() ? [{ menuItemKey: 'record', menuItemLabel: 'Record', MenuItemIcon: Mic, onMenuItemSelect: () => void startComposerRecording() }] : []),
            { menuItemKey: 'audio-file', menuItemLabel: 'Transcribe an Audio File', MenuItemIcon: FileAudio, onMenuItemSelect: () => audioFileInputRef.current?.click() },
          ]}
        />
      )}
    </>
  )
}
