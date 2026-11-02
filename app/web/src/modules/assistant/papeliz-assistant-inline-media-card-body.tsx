import { ArrowUp, Check, FileAudio, ImagePlus, Lock, Mic, Paintbrush, RotateCw, ScanEye, Square } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { formatPapelizAudioDuration, isPapelizAudioRecordingAvailable } from './papeliz-assistant-audio-recording'
import { describePapelizRemovedImageMetadata } from './papeliz-assistant-image-metadata-strip'
import { usePapelizImagineStore } from './papeliz-assistant-imagine-store'
import { usePapelizInlineEditStore } from './papeliz-assistant-inline-edit-store'
import { usePapelizInlineMediaStore } from './papeliz-assistant-inline-media-store'
import { resolvePapelizAssistantMediaModelNow } from './papeliz-assistant-media-model-choices-store'
import { PapelizAssistantMediaSwitch } from './papeliz-assistant-media-parts'
import { findPapelizAssistantProviderPreset } from './papeliz-assistant-provider-presets'
import { usePapelizAssistantPanelUiStore } from './papeliz-assistant-panel-ui-store'
import { PapelizTextDiffView } from './papeliz-assistant-proposal-card'
import { diffPapelizTextByWords } from './papeliz-assistant-text-diff'

function PapelizInlineRecordingTimer({ recordingStartedAtMilliseconds }: { recordingStartedAtMilliseconds: number }) {
  const [recordedSeconds, setRecordedSeconds] = useState(0)
  useEffect(() => {
    const timerInterval = window.setInterval(() => setRecordedSeconds((performance.now() - recordingStartedAtMilliseconds) / 1000), 250)
    return () => window.clearInterval(timerInterval)
  }, [recordingStartedAtMilliseconds])
  return <span className="tabular-nums">{formatPapelizAudioDuration(recordedSeconds)}</span>
}

// Imagine or Transcribe inside the inline card, in place of the instruction box: the picture or the
// written text, then the change it makes, with Accept, Reject and Try Again.
export function PapelizAssistantInlineMediaCardBody() {
  const inlineMediaAction = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.inlineMediaAction)
  const inlineMediaStage = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.inlineMediaStage)
  const inlineMediaProgressText = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.inlineMediaProgressText)
  const inlineMediaProblem = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.inlineMediaProblem)
  const inlineImaginePromptText = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.inlineImaginePromptText)
  const inlineImaginePictureId = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.inlineImaginePictureId)
  const inlineRecordingStartedAtMilliseconds = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.inlineRecordingStartedAtMilliseconds)
  const inlineTranscriptText = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.inlineTranscriptText)
  const inlineWrittenUpText = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.inlineWrittenUpText)
  const isInlineTranscriptWrittenUp = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.isInlineTranscriptWrittenUp)
  const inlineInsertedBlockText = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.inlineInsertedBlockText)
  const setInlineImaginePromptText = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.setInlineImaginePromptText)
  const generateInlinePicture = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.generateInlinePicture)
  const setInlinePictureRemoveC2pa = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.setInlinePictureRemoveC2pa)
  const startInlineRecording = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.startInlineRecording)
  const stopInlineRecording = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.stopInlineRecording)
  const transcribeInlineAudioFile = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.transcribeInlineAudioFile)
  const setIsInlineTranscriptWrittenUp = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.setIsInlineTranscriptWrittenUp)
  const startInlineMediaAction = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.startInlineMediaAction)
  const acceptInlineMedia = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.acceptInlineMedia)
  const closeInlineEdit = usePapelizInlineEditStore((inlineEditState) => inlineEditState.closeInlineEdit)
  const requestAssistantProviderSettingsPage = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.requestAssistantProviderSettingsPage)
  const inlineImaginePicture = usePapelizImagineStore((imagineState) =>
    inlineImaginePictureId === null ? undefined : imagineState.imaginePictures.find((imaginePicture) => imaginePicture.imaginePictureId === inlineImaginePictureId),
  )
  const imaginePromptInputRef = useRef<HTMLInputElement>(null)
  const audioFileInputRef = useRef<HTMLInputElement>(null)

  const inlineMediaModel =
    inlineMediaAction === 'describe-picture'
      ? null
      : resolvePapelizAssistantMediaModelNow(inlineMediaAction === 'transcribe' ? 'transcription' : 'image-generation')
  const inlineMediaProviderName = inlineMediaModel === null ? null : findPapelizAssistantProviderPreset(inlineMediaModel.papelizAssistantProviderId).providerPresetDisplayName
  const inlinePictureLink = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.inlinePictureLink)
  const inlineSourcePictureUrl = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.inlineSourcePictureUrl)
  const inlineEditPicturePromptText = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.inlineEditPicturePromptText)
  const inlineReplacementPassageText = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.inlineReplacementPassageText)
  const setInlineEditPicturePromptText = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.setInlineEditPicturePromptText)
  const describeInlinePicture = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.describeInlinePicture)
  const editInlinePicture = usePapelizInlineMediaStore((inlineMediaState) => inlineMediaState.editInlinePicture)
  const selectedPassageText = usePapelizInlineEditStore((inlineEditState) => inlineEditState.selectedPassageText)
  const isPassageReplaced = inlineMediaAction === 'describe-picture' || inlineMediaAction === 'edit-picture'
  const insertedTextDiffParts = useMemo(
    () => (isPassageReplaced ? diffPapelizTextByWords(selectedPassageText, inlineReplacementPassageText) : diffPapelizTextByWords('', inlineInsertedBlockText)),
    [isPassageReplaced, selectedPassageText, inlineReplacementPassageText, inlineInsertedBlockText],
  )

  useEffect(() => {
    if (inlineMediaAction === 'imagine' || inlineMediaAction === 'edit-picture') requestAnimationFrame(() => imaginePromptInputRef.current?.focus())
  }, [inlineMediaAction])

  if (inlineMediaAction === null) return null
  const isImagine = inlineMediaAction === 'imagine'
  const metadataLine =
    inlineImaginePicture === undefined || inlineImaginePicture.imaginePictureMetadataNames === null
      ? null
      : inlineImaginePicture.imaginePictureMetadataNames.length === 0
        ? 'No metadata found.'
        : `Carries ${describePapelizRemovedImageMetadata(inlineImaginePicture.imaginePictureMetadataNames)}. ${inlineImaginePicture.isRemoveC2paOn ? 'Removed when saved.' : 'Kept when saved.'}`

  const isPictureAction = inlineMediaAction === 'describe-picture' || inlineMediaAction === 'edit-picture'

  return (
    <>
      {inlineMediaAction === 'describe-picture' ? (
        <div className="flex items-center gap-2.5 py-2.5 pr-2.5 pl-3.5">
          <span className="grid size-[22px] flex-none place-items-center rounded-full bg-linear-to-r from-papeliz-gradient-start to-papeliz-gradient-end text-white">
            <ScanEye className="size-3" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 text-[15px] text-papeliz-ink-subtle">The chat’s model looks at the picture and writes its alt text.</span>
        </div>
      ) : inlineMediaAction === 'edit-picture' ? (
        <form
          className="flex items-center gap-2.5 py-2.5 pr-2.5 pl-3.5"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault()
            void editInlinePicture()
          }}
        >
          <span className="grid size-[22px] flex-none place-items-center rounded-full bg-linear-to-r from-papeliz-gradient-start to-papeliz-gradient-end text-white">
            <Paintbrush className="size-3" aria-hidden="true" />
          </span>
          <input
            ref={imaginePromptInputRef}
            value={inlineEditPicturePromptText}
            onChange={(changeEvent) => setInlineEditPicturePromptText(changeEvent.target.value)}
            placeholder="What should change in the picture?"
            aria-label="Change to make in the picture"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-papeliz-ink outline-none placeholder:text-papeliz-ink-subtle"
          />
          <button
            type="submit"
            aria-label="Edit Picture"
            title="Change the picture (Enter)"
            disabled={inlineEditPicturePromptText.trim().length === 0 || inlineMediaStage === 'working' || inlinePictureLink === null}
            className="grid size-[34px] flex-none place-items-center rounded-full bg-papeliz-gradient-start text-white transition-[transform,opacity] active:scale-90 disabled:opacity-40"
          >
            <ArrowUp className="size-4" strokeWidth={2.4} aria-hidden="true" />
          </button>
        </form>
      ) : isImagine ? (
        <form
          className="flex items-center gap-2.5 py-2.5 pr-2.5 pl-3.5"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault()
            void generateInlinePicture()
          }}
        >
          <span className="grid size-[22px] flex-none place-items-center rounded-full bg-linear-to-r from-papeliz-gradient-start to-papeliz-gradient-end text-white">
            <ImagePlus className="size-3" aria-hidden="true" />
          </span>
          <input
            ref={imaginePromptInputRef}
            value={inlineImaginePromptText}
            onChange={(changeEvent) => setInlineImaginePromptText(changeEvent.target.value)}
            placeholder="Describe the picture to make here"
            aria-label="Picture to make"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-papeliz-ink outline-none placeholder:text-papeliz-ink-subtle"
          />
          <button
            type="submit"
            aria-label="Imagine"
            title="Make the picture (Enter)"
            disabled={inlineImaginePromptText.trim().length === 0 || inlineMediaStage === 'working'}
            className="grid size-[34px] flex-none place-items-center rounded-full bg-papeliz-gradient-start text-white transition-[transform,opacity] active:scale-90 disabled:opacity-40"
          >
            <ArrowUp className="size-4" strokeWidth={2.4} aria-hidden="true" />
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2 py-2.5 pr-2.5 pl-3.5">
          <span className="grid size-[22px] flex-none place-items-center rounded-full bg-linear-to-r from-papeliz-gradient-start to-papeliz-gradient-end text-white">
            <Mic className="size-3" aria-hidden="true" />
          </span>
          {inlineMediaStage === 'recording' ? (
            <>
              <span className="flex min-w-0 flex-1 items-center gap-2 text-[15px]" aria-live="polite">
                <span className="size-2.5 flex-none animate-pulse rounded-full bg-papeliz-diff-removed-ink" aria-hidden="true" />
                Recording{' '}
                {inlineRecordingStartedAtMilliseconds !== null && <PapelizInlineRecordingTimer recordingStartedAtMilliseconds={inlineRecordingStartedAtMilliseconds} />}
              </span>
              <PapelizPillButton pillButtonVariant="red-primary" pillButtonSize="small" onClick={() => void stopInlineRecording()}>
                <Square className="size-3.5" aria-hidden="true" /> Stop
              </PapelizPillButton>
            </>
          ) : (
            <>
              <span className="min-w-0 flex-1 text-[15px] text-papeliz-ink-subtle">Speak, and the words land here, written up.</span>
              <PapelizPillButton
                pillButtonVariant="primary"
                pillButtonSize="small"
                disabled={!isPapelizAudioRecordingAvailable() || inlineMediaStage === 'working'}
                title="The browser asks for the microphone the first time"
                onClick={() => void startInlineRecording()}
              >
                <Mic className="size-3.5" aria-hidden="true" /> Record
              </PapelizPillButton>
              <PapelizPillButton pillButtonVariant="outline" pillButtonSize="small" disabled={inlineMediaStage === 'working'} onClick={() => audioFileInputRef.current?.click()}>
                <FileAudio className="size-3.5" aria-hidden="true" /> Audio File
              </PapelizPillButton>
              <input
                ref={audioFileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.mp4,.webm,.ogg,.opus,.flac,.aac"
                hidden
                aria-label="Transcribe an audio file here"
                onChange={(fileInputEvent) => {
                  const audioFile = fileInputEvent.target.files?.[0]
                  if (audioFile !== undefined) void transcribeInlineAudioFile(audioFile)
                  fileInputEvent.target.value = ''
                }}
              />
            </>
          )}
        </div>
      )}

      {isPictureAction && inlineSourcePictureUrl !== null && inlineMediaStage !== 'review' && (
        <div className="border-t border-papeliz-line px-4 py-3">
          <img src={inlineSourcePictureUrl} alt={inlinePictureLink?.pictureAltText ?? ''} className="max-h-40 max-w-[min(100%,16rem)] rounded-xl border border-papeliz-line object-contain" />
        </div>
      )}
      {(inlineMediaStage === 'working' || inlineMediaStage === 'review' || inlineMediaStage === 'failed') && (
        <div className="flex flex-col gap-2.5 border-t border-papeliz-line px-4 py-3 text-[15px] leading-relaxed" aria-live="polite">
          {inlineMediaStage === 'working' && <p className="text-sm text-papeliz-ink-muted">{inlineMediaProgressText ?? 'Working…'}</p>}
          {inlineMediaStage === 'failed' && (
            <p role="alert" className="papeliz-selectable-text text-sm text-papeliz-diff-removed-ink">
              {inlineMediaProblem}
              {inlineMediaModel === null && (
                <button type="button" className="ml-1.5 font-medium text-papeliz-blue underline" onClick={() => requestAssistantProviderSettingsPage()}>
                  Choose a Provider
                </button>
              )}
            </p>
          )}
          {inlineMediaStage === 'review' && inlineMediaAction === 'describe-picture' && inlineSourcePictureUrl !== null && (
            <img src={inlineSourcePictureUrl} alt="" className="max-h-40 max-w-[min(100%,16rem)] rounded-xl border border-papeliz-line object-contain" />
          )}
          {inlineMediaStage === 'review' && (isImagine || inlineMediaAction === 'edit-picture') && inlineImaginePicture !== undefined && (
            <div className="flex flex-wrap items-start gap-3">
              <img
                src={inlineImaginePicture.imaginePicturePreviewUrl}
                alt={inlineImaginePicture.imaginePictureDescriptionText}
                className="max-h-56 max-w-[min(100%,18rem)] rounded-xl border border-papeliz-line object-contain"
              />
              <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                <PapelizAssistantMediaSwitch mediaSwitchLabel="Remove C2PA" isMediaSwitchOn={inlineImaginePicture.isRemoveC2paOn} onMediaSwitchToggle={setInlinePictureRemoveC2pa} />
                {metadataLine !== null && <p className="text-[12px] leading-snug text-papeliz-ink-subtle">{metadataLine}</p>}
              </div>
            </div>
          )}
          {inlineMediaStage === 'review' && !isImagine && inlineWrittenUpText.length > 0 && inlineTranscriptText.length > 0 && (
            <div className="flex">
              <PapelizAssistantMediaSwitch mediaSwitchLabel="Written Up" isMediaSwitchOn={isInlineTranscriptWrittenUp} onMediaSwitchToggle={setIsInlineTranscriptWrittenUp} />
            </div>
          )}
          {inlineMediaStage === 'review' && <PapelizTextDiffView textDiffParts={insertedTextDiffParts} />}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-papeliz-line bg-papeliz-surface-soft px-3.5 py-2.5">
        <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" disabled={inlineMediaStage !== 'review'} onClick={() => void acceptInlineMedia()}>
          <Check className="size-3.5" aria-hidden="true" /> Accept <span className="text-[11.5px] opacity-75">Ctrl ↵</span>
        </PapelizPillButton>
        <PapelizPillButton pillButtonSize="small" onClick={closeInlineEdit}>
          Reject <span className="text-[11.5px] opacity-75">Esc</span>
        </PapelizPillButton>
        <PapelizPillButton
          pillButtonSize="small"
          disabled={
            inlineMediaStage === 'working' ||
            inlineMediaStage === 'recording' ||
            (isImagine && inlineImaginePromptText.trim().length === 0) ||
            (inlineMediaAction === 'edit-picture' && inlineEditPicturePromptText.trim().length === 0)
          }
          onClick={() => {
            if (isImagine) void generateInlinePicture()
            else if (inlineMediaAction === 'describe-picture') void describeInlinePicture()
            else if (inlineMediaAction === 'edit-picture') void editInlinePicture()
            else startInlineMediaAction('transcribe')
          }}
        >
          <RotateCw className="size-3.5" aria-hidden="true" /> Try Again
        </PapelizPillButton>
        <span className="ml-auto flex min-w-0 items-center gap-1.5 text-xs text-papeliz-ink-subtle">
          <Lock className="size-3 flex-none" aria-hidden="true" />
          <span className="truncate">
            {inlineMediaAction === 'describe-picture'
              ? 'The picture goes only to the chat’s provider'
              : inlineMediaModel === null || inlineMediaProviderName === null
                ? 'Sent only to your own provider'
                : `${inlineMediaModel.providerModelName}, straight to ${inlineMediaProviderName}`}
          </span>
        </span>
      </div>
    </>
  )
}
