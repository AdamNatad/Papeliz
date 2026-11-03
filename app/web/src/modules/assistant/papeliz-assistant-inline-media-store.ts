import { create } from 'zustand'
import { selectActiveVaultMarkdownNoteRelativePath, usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { getPapelizAudioFileExtension, startPapelizAssistantAudioRecording, type PapelizAssistantAudioRecording } from './papeliz-assistant-audio-recording'
import { transcribePapelizAudioWithChosenModel } from './papeliz-assistant-audio-transcription'
import { editPapelizAssistantImage } from './papeliz-assistant-image-and-audio-client'
import {
  addPapelizMadeImaginePictures,
  buildPapelizImaginePictureLinkMarkdown,
  makePapelizImaginePictures,
  pickPapelizImaginePictureFileRelativePath,
  savePapelizImaginePictureAt,
  usePapelizImagineStore,
} from './papeliz-assistant-imagine-store'
import { readPapelizInlineEditRange, setPapelizInlineEditRangeEffect } from './papeliz-assistant-inline-edit-extension'
import { usePapelizInlineEditStore } from './papeliz-assistant-inline-edit-store'
import {
  buildPapelizAssistantMediaProviderConnection,
  resolvePapelizAssistantImageEditingModelNow,
  resolvePapelizAssistantMediaModelWhenLoaded,
  usePapelizAssistantMediaModelChoicesStore,
} from './papeliz-assistant-media-model-choices-store'
import { buildPapelizVaultFileLinkPathFromNote } from './papeliz-assistant-media-vault-files'
import {
  findPapelizNotePictureLinkAround,
  readPapelizNotePictureForProvider,
  replacePapelizPictureLinkAltText,
  type PapelizNotePictureLink,
} from './papeliz-assistant-note-picture-links'
import { describePapelizAssistantMediaProblem } from './papeliz-assistant-media-problem-words'
import { insertPapelizBlockAfterCursorLine } from './papeliz-assistant-media-vault-files'
import { takePapelizPendingInlineMediaAction, type PapelizInlineMediaAction } from './papeliz-assistant-inline-media-request'
import { getActivePapelizAssistantProviderConnection } from './papeliz-assistant-provider-settings-store'
import { PapelizAssistantProviderError, streamPapelizChatCompletion, type PapelizAssistantProviderConnection } from './papeliz-openai-compatible-client'

// The assistant's media actions in a note, beside Rewrite in the inline card, each with the person's
// own provider:
// - Imagine: a picture of the selected text, or of a prompt, put after it or at the cursor;
// - Transcribe: speech, written up by the chat's model, put at the cursor;
// - Describe Picture: a model that sees pictures (Models for Each Task, or the chat's) writes its alt text;
// - Edit Picture: Draw's model changes the picture as asked, where its provider edits pictures (the
//   Meta Model API's image edits), and the link points at the new one; the old file stays.
// Each ends as a change shown in place, accepted or rejected like any inline edit: Accept saves a new
// picture into the vault (cleaned of metadata while Remove Metadata is on) and makes the change in the note, as
// one change Undo takes back. Reject saves nothing.

export type PapelizInlineMediaStage = 'ready' | 'recording' | 'working' | 'review' | 'failed'

interface PapelizInlineMediaState {
  inlineMediaAction: PapelizInlineMediaAction | null
  inlineMediaStage: PapelizInlineMediaStage
  inlineMediaProgressText: string | null
  inlineMediaProblem: string | null
  inlineImaginePromptText: string
  inlineImaginePictureId: string | null
  // When the microphone started, for the timer.
  inlineRecordingStartedAtMilliseconds: number | null
  inlineTranscriptText: string
  // Written up by the chat's model, or the transcript as spoken.
  isInlineTranscriptWrittenUp: boolean
  inlineWrittenUpText: string
  // What goes into the note on Accept, after the cursor's line or the selection.
  inlineInsertedBlockText: string
  // Describe Picture and Edit Picture change the passage itself: the picture link in it, as found
  // in the passage, the picture to show, and the passage as it would read.
  inlinePictureLink: PapelizNotePictureLink | null
  inlineSourcePictureUrl: string | null
  inlineEditPicturePromptText: string
  inlineReplacementPassageText: string
  setInlineEditPicturePromptText: (inlineEditPicturePromptText: string) => void
  describeInlinePicture: () => Promise<void>
  editInlinePicture: () => Promise<void>
  // Starts an action in the open card, for its passage (or its cursor, with no passage).
  startInlineMediaAction: (inlineMediaAction: PapelizInlineMediaAction) => void
  setInlineImaginePromptText: (inlineImaginePromptText: string) => void
  generateInlinePicture: () => Promise<void>
  setInlinePictureRemoveMetadata: (isRemoveMetadataOn: boolean) => void
  startInlineRecording: () => Promise<void>
  stopInlineRecording: () => Promise<void>
  transcribeInlineAudioFile: (audioFile: File) => Promise<void>
  setIsInlineTranscriptWrittenUp: (isInlineTranscriptWrittenUp: boolean) => void
  acceptInlineMedia: () => Promise<void>
  resetInlineMedia: () => void
}

let activeInlineMediaAbortController: AbortController | null = null
let activeInlineAudioRecording: PapelizAssistantAudioRecording | null = null

function startInlineMediaAbortController(): AbortController {
  activeInlineMediaAbortController?.abort()
  activeInlineMediaAbortController = new AbortController()
  return activeInlineMediaAbortController
}

// What the chat model is told for Transcribe's written-up text.
export const papelizSpokenTextWriteUpInstructionText =
  'You turn a transcript of speech into clean written text for a Markdown note. Fix punctuation, drop filler words and false starts, and split it into paragraphs (or a list, where the speaker lists things). Keep the speaker’s words, meaning and language; add nothing that wasn’t said. Reply with the text only: no title, no preamble, no code fence.'

const papelizEmptyInlineMediaFields = {
  inlineMediaAction: null,
  inlineMediaStage: 'ready',
  inlineMediaProgressText: null,
  inlineMediaProblem: null,
  inlineImaginePromptText: '',
  inlineImaginePictureId: null,
  inlineRecordingStartedAtMilliseconds: null,
  inlineTranscriptText: '',
  isInlineTranscriptWrittenUp: true,
  inlineWrittenUpText: '',
  inlineInsertedBlockText: '',
  inlinePictureLink: null,
  inlineSourcePictureUrl: null,
  inlineEditPicturePromptText: '',
  inlineReplacementPassageText: '',
} satisfies Partial<PapelizInlineMediaState>

// What the chat model is told for Describe Picture.
export const papelizPictureAltTextInstructionText =
  'You write the alt text for a picture in a Markdown note: one plain sentence, under 125 characters, saying what the picture shows and what matters in it for the note. No "image of" or "picture of", no quotes. Reply with the alt text only.'

// The picture link Describe Picture and Edit Picture act on: the one in the passage, or, when the
// passage holds only part of one (a link wrapped over two lines, half selected), the whole link around
// it, which then becomes the passage. Its place is given within the passage.
function widenInlinePassageToPictureLink(): PapelizNotePictureLink | null {
  const { selectedPassageText, inlineEditEditorView } = usePapelizInlineEditStore.getState()
  const passagePictureLink = findPapelizNotePictureLinkAround(selectedPassageText, 0, selectedPassageText.length)
  if (passagePictureLink !== null || inlineEditEditorView === null) return passagePictureLink
  const inlineEditRange = readPapelizInlineEditRange(inlineEditEditorView.state)
  if (inlineEditRange === null) return null
  const notePictureLink = findPapelizNotePictureLinkAround(inlineEditEditorView.state.doc.toString(), inlineEditRange.inlineEditFrom, inlineEditRange.inlineEditTo)
  if (notePictureLink === null) return null
  inlineEditEditorView.dispatch({ effects: setPapelizInlineEditRangeEffect.of({ inlineEditFrom: notePictureLink.pictureLinkFrom, inlineEditTo: notePictureLink.pictureLinkTo }) })
  usePapelizInlineEditStore.setState({ selectedPassageText: notePictureLink.pictureLinkMarkdown })
  return { ...notePictureLink, pictureLinkFrom: 0, pictureLinkTo: notePictureLink.pictureLinkMarkdown.length }
}

// Describe Picture's model: the one chosen in Models for Each Task, or the chat's on Same as Chat.
async function buildPictureDescriptionConnection(): Promise<
  { providerConnectionOutcome: 'ready'; providerConnection: PapelizAssistantProviderConnection } | { providerConnectionOutcome: 'not-set-up'; providerSetupProblem: string }
> {
  const pictureDescriptionModel = await resolvePapelizAssistantMediaModelWhenLoaded('picture-description')
  if (pictureDescriptionModel === null) return getActivePapelizAssistantProviderConnection()
  const mediaConnection = buildPapelizAssistantMediaProviderConnection('picture-description', pictureDescriptionModel)
  return mediaConnection.mediaConnectionOutcome === 'ready'
    ? { providerConnectionOutcome: 'ready', providerConnection: mediaConnection.providerConnection }
    : { providerConnectionOutcome: 'not-set-up', providerSetupProblem: mediaConnection.mediaSetupProblem }
}

export const usePapelizInlineMediaStore = create<PapelizInlineMediaState>()((setInlineMediaState, getInlineMediaState) => {
  const failInlineMedia = (inlineMediaError: unknown) =>
    setInlineMediaState({ inlineMediaStage: 'failed', inlineMediaProgressText: null, inlineMediaProblem: describePapelizAssistantMediaProblem(inlineMediaError) })

  // Where each picture made here goes on Accept, chosen when it is shown.
  const plannedPictureVaultFileRelativePaths = new Map<string, string>()

  // The picture's link, from the open note's folder, once the picture has a planned place.
  const showInlinePictureInsertion = async (inlineImaginePictureId: string) => {
    const vaultNoteRelativePath = selectActiveVaultMarkdownNoteRelativePath(usePapelizWorkspaceStore.getState())
    const imaginePicture = usePapelizImagineStore.getState().imaginePictures.find((keptPicture) => keptPicture.imaginePictureId === inlineImaginePictureId)
    if (vaultNoteRelativePath === null || imaginePicture === undefined) throw new PapelizAssistantProviderError('Open the note again, then try once more.', null)
    const plannedPictureVaultFileRelativePath = imaginePicture.savedVaultFileRelativePath ?? (await pickPapelizImaginePictureFileRelativePath(inlineImaginePictureId))
    plannedPictureVaultFileRelativePaths.set(inlineImaginePictureId, plannedPictureVaultFileRelativePath)
    setInlineMediaState({
      inlineMediaStage: 'review',
      inlineMediaProgressText: null,
      inlineImaginePictureId,
      inlineInsertedBlockText: buildPapelizImaginePictureLinkMarkdown(imaginePicture, vaultNoteRelativePath, plannedPictureVaultFileRelativePath),
    })
  }
  const writeUpInlineTranscript = async (inlineTranscriptText: string, inlineMediaAbortController: AbortController) => {
    const chatProviderConnection = getActivePapelizAssistantProviderConnection()
    if (chatProviderConnection.providerConnectionOutcome !== 'ready') {
      // No chat model: the transcript goes in as spoken.
      setInlineMediaState({ inlineMediaStage: 'review', inlineMediaProgressText: null, isInlineTranscriptWrittenUp: false, inlineInsertedBlockText: inlineTranscriptText })
      return
    }
    setInlineMediaState({ inlineMediaProgressText: `Writing it up with ${chatProviderConnection.providerConnection.providerModelName}…` })
    const writtenUpResult = await streamPapelizChatCompletion({
      providerConnection: chatProviderConnection.providerConnection,
      chatMessages: [
        { role: 'system', content: papelizSpokenTextWriteUpInstructionText },
        { role: 'user', content: `<transcript>\n${inlineTranscriptText}\n</transcript>` },
      ],
      abortSignal: inlineMediaAbortController.signal,
    })
    if (activeInlineMediaAbortController !== inlineMediaAbortController) return
    const inlineWrittenUpText = writtenUpResult.assistantText.replace(/^\s*```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i, '$1').trim()
    setInlineMediaState({
      inlineMediaStage: 'review',
      inlineMediaProgressText: null,
      inlineWrittenUpText,
      isInlineTranscriptWrittenUp: inlineWrittenUpText.length > 0,
      inlineInsertedBlockText: inlineWrittenUpText.length > 0 ? inlineWrittenUpText : inlineTranscriptText,
    })
  }

  const transcribeInlineAudio = async (audioBlob: Blob, audioFileName: string) => {
    const transcriptionModelChoice = await resolvePapelizAssistantMediaModelWhenLoaded('transcription')
    if (transcriptionModelChoice === null) {
      failInlineMedia(new PapelizAssistantProviderError('Add a provider that transcribes (the Meta Model API does) in Settings › AI Provider.', null))
      return
    }
    const inlineMediaAbortController = startInlineMediaAbortController()
    setInlineMediaState({ inlineMediaStage: 'working', inlineMediaProblem: null })
    try {
      const inlineTranscriptText = await transcribePapelizAudioWithChosenModel({
        transcriptionAudioBlob: audioBlob,
        transcriptionAudioFileName: audioFileName,
        transcriptionModelChoice,
        abortSignal: inlineMediaAbortController.signal,
        onTranscriptionProgressText: (inlineMediaProgressText) => setInlineMediaState({ inlineMediaProgressText }),
      })
      if (activeInlineMediaAbortController !== inlineMediaAbortController) return
      setInlineMediaState({ inlineTranscriptText })
      await writeUpInlineTranscript(inlineTranscriptText, inlineMediaAbortController)
    } catch (inlineMediaError) {
      if (inlineMediaError instanceof DOMException && inlineMediaError.name === 'AbortError') return
      if (activeInlineMediaAbortController === inlineMediaAbortController) failInlineMedia(inlineMediaError)
    }
  }

  return {
    ...papelizEmptyInlineMediaFields,
    startInlineMediaAction: (inlineMediaAction) => {
      activeInlineMediaAbortController?.abort()
      activeInlineAudioRecording?.cancelAudioRecording()
      activeInlineAudioRecording = null
      const selectedPassageText = usePapelizInlineEditStore.getState().selectedPassageText.trim()
      setInlineMediaState({
        ...papelizEmptyInlineMediaFields,
        inlineMediaAction,
        // A picture of the selected words, ready to make.
        inlineImaginePromptText: inlineMediaAction === 'imagine' ? selectedPassageText.slice(0, 1000) : '',
      })
      if (inlineMediaAction === 'describe-picture' || inlineMediaAction === 'edit-picture') {
        const inlinePictureLink = widenInlinePassageToPictureLink()
        if (inlinePictureLink === null) {
          failInlineMedia(new PapelizAssistantProviderError('Put the cursor on a picture in the note first.', null))
          return
        }
        setInlineMediaState({ inlinePictureLink })
        const vaultNoteRelativePath = selectActiveVaultMarkdownNoteRelativePath(usePapelizWorkspaceStore.getState()) ?? ''
        void readPapelizNotePictureForProvider(inlinePictureLink, vaultNoteRelativePath).then(
          (inlineSourcePictureUrl) => {
            if (getInlineMediaState().inlinePictureLink === inlinePictureLink) setInlineMediaState({ inlineSourcePictureUrl })
          },
          (pictureReadError: unknown) => {
            if (getInlineMediaState().inlinePictureLink === inlinePictureLink) failInlineMedia(pictureReadError)
          },
        )
        if (inlineMediaAction === 'describe-picture') void getInlineMediaState().describeInlinePicture()
      }
    },

    setInlineEditPicturePromptText: (inlineEditPicturePromptText) => setInlineMediaState({ inlineEditPicturePromptText }),

    describeInlinePicture: async () => {
      const { inlinePictureLink } = getInlineMediaState()
      if (inlinePictureLink === null) return
      const pictureDescriptionConnection = await buildPictureDescriptionConnection()
      if (getInlineMediaState().inlinePictureLink !== inlinePictureLink) return
      if (pictureDescriptionConnection.providerConnectionOutcome !== 'ready') {
        failInlineMedia(new PapelizAssistantProviderError(pictureDescriptionConnection.providerSetupProblem, null))
        return
      }
      const inlineMediaAbortController = startInlineMediaAbortController()
      setInlineMediaState({
        inlineMediaStage: 'working',
        inlineMediaProblem: null,
        inlineMediaProgressText: `${pictureDescriptionConnection.providerConnection.providerModelName} is looking at the picture…`,
      })
      try {
        const vaultNoteRelativePath = selectActiveVaultMarkdownNoteRelativePath(usePapelizWorkspaceStore.getState()) ?? ''
        const pictureUrl = await readPapelizNotePictureForProvider(inlinePictureLink, vaultNoteRelativePath)
        const describedResult = await streamPapelizChatCompletion({
          providerConnection: pictureDescriptionConnection.providerConnection,
          chatMessages: [
            { role: 'system', content: papelizPictureAltTextInstructionText },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Note: ${usePapelizInlineEditStore.getState().vaultNoteTitle}${inlinePictureLink.pictureAltText.length > 0 ? `\nIts alt text now: ${inlinePictureLink.pictureAltText}` : ''}`,
                },
                { type: 'image_url', image_url: { url: pictureUrl } },
              ],
            },
          ],
          abortSignal: inlineMediaAbortController.signal,
        })
        if (activeInlineMediaAbortController !== inlineMediaAbortController) return
        const describedAltText = describedResult.assistantText.trim().replace(/^["“]|["”]$/g, '')
        if (describedAltText.length === 0) throw new PapelizAssistantProviderError('The model answered with nothing. Try again.', null)
        const passageText = usePapelizInlineEditStore.getState().selectedPassageText
        setInlineMediaState({
          inlineMediaStage: 'review',
          inlineMediaProgressText: null,
          inlineSourcePictureUrl: pictureUrl,
          inlineReplacementPassageText:
            passageText.slice(0, inlinePictureLink.pictureLinkFrom) + replacePapelizPictureLinkAltText(inlinePictureLink, describedAltText) + passageText.slice(inlinePictureLink.pictureLinkTo),
        })
      } catch (inlineMediaError) {
        if (inlineMediaError instanceof DOMException && inlineMediaError.name === 'AbortError') return
        if (activeInlineMediaAbortController === inlineMediaAbortController) failInlineMedia(inlineMediaError)
      }
    },

    editInlinePicture: async () => {
      const { inlinePictureLink, inlineEditPicturePromptText } = getInlineMediaState()
      if (inlinePictureLink === null || inlineEditPicturePromptText.trim().length === 0) return
      await usePapelizAssistantMediaModelChoicesStore.getState().loadAssistantMediaModelChoices()
      const imageEditingModel = resolvePapelizAssistantImageEditingModelNow()
      if (imageEditingModel === null) {
        failInlineMedia(new PapelizAssistantProviderError('Edit Picture uses Draw’s model, and it doesn’t edit pictures. Choose muse-image-1.0, on the Meta Model API, for Draw.', null))
        return
      }
      const mediaConnection = buildPapelizAssistantMediaProviderConnection('image-generation', imageEditingModel)
      if (mediaConnection.mediaConnectionOutcome !== 'ready') {
        failInlineMedia(new PapelizAssistantProviderError(mediaConnection.mediaSetupProblem, null))
        return
      }
      const inlineMediaAbortController = startInlineMediaAbortController()
      setInlineMediaState({ inlineMediaStage: 'working', inlineMediaProblem: null, inlineMediaProgressText: `Changing the picture with ${imageEditingModel.providerModelName}…` })
      try {
        const vaultNoteRelativePath = selectActiveVaultMarkdownNoteRelativePath(usePapelizWorkspaceStore.getState())
        if (vaultNoteRelativePath === null) throw new PapelizAssistantProviderError('Open the note again, then try once more.', null)
        const sourcePictureUrl = getInlineMediaState().inlineSourcePictureUrl ?? (await readPapelizNotePictureForProvider(inlinePictureLink, vaultNoteRelativePath))
        const editedImages = await editPapelizAssistantImage({
          providerConnection: mediaConnection.providerConnection,
          imageEditPromptText: inlineEditPicturePromptText,
          sourceImageUrl: sourcePictureUrl,
          abortSignal: inlineMediaAbortController.signal,
        })
        if (activeInlineMediaAbortController !== inlineMediaAbortController) return
        const [editedImaginePicture] = await addPapelizMadeImaginePictures(
          editedImages.map((editedImage) => editedImage.generatedImageBlob),
          inlinePictureLink.pictureAltText.length > 0 ? inlinePictureLink.pictureAltText : inlineEditPicturePromptText,
          `${imageEditingModel.providerModelName} · ${mediaConnection.providerDisplayName}`,
          'note',
        )
        if (editedImaginePicture === undefined) throw new PapelizAssistantProviderError('The provider sent a picture Papeliz can’t read.', null)
        const plannedPictureVaultFileRelativePath = await pickPapelizImaginePictureFileRelativePath(editedImaginePicture.imaginePictureId)
        plannedPictureVaultFileRelativePaths.set(editedImaginePicture.imaginePictureId, plannedPictureVaultFileRelativePath)
        const passageText = usePapelizInlineEditStore.getState().selectedPassageText
        const editedPictureLinkMarkdown = `![${inlinePictureLink.pictureAltText}](${buildPapelizVaultFileLinkPathFromNote(vaultNoteRelativePath, plannedPictureVaultFileRelativePath)})`
        setInlineMediaState({
          inlineMediaStage: 'review',
          inlineMediaProgressText: null,
          inlineImaginePictureId: editedImaginePicture.imaginePictureId,
          inlineReplacementPassageText: passageText.slice(0, inlinePictureLink.pictureLinkFrom) + editedPictureLinkMarkdown + passageText.slice(inlinePictureLink.pictureLinkTo),
        })
      } catch (inlineMediaError) {
        if (inlineMediaError instanceof DOMException && inlineMediaError.name === 'AbortError') return
        if (activeInlineMediaAbortController === inlineMediaAbortController) failInlineMedia(inlineMediaError)
      }
    },

    setInlineImaginePromptText: (inlineImaginePromptText) => setInlineMediaState({ inlineImaginePromptText }),

    generateInlinePicture: async () => {
      const { inlineImaginePromptText } = getInlineMediaState()
      if (inlineImaginePromptText.trim().length === 0) return
      const imageModelChoice = await resolvePapelizAssistantMediaModelWhenLoaded('image-generation')
      if (imageModelChoice === null) {
        failInlineMedia(new PapelizAssistantProviderError('Add a provider that makes pictures (the Meta Model API does) in Settings › AI Provider.', null))
        return
      }
      const inlineMediaAbortController = startInlineMediaAbortController()
      setInlineMediaState({ inlineMediaStage: 'working', inlineMediaProblem: null, inlineMediaProgressText: `Making the picture with ${imageModelChoice.providerModelName}…` })
      try {
        const [madeImaginePicture] = await makePapelizImaginePictures({
          imageModelChoice,
          imagePromptText: inlineImaginePromptText,
          storedImageShapeText: usePapelizImagineStore.getState().imagineImageAspectRatio,
          pictureCount: 1,
          abortSignal: inlineMediaAbortController.signal,
          imaginePromptPlace: 'note',
        })
        if (activeInlineMediaAbortController !== inlineMediaAbortController || madeImaginePicture === undefined) return
        await showInlinePictureInsertion(madeImaginePicture.imaginePictureId)
      } catch (inlineMediaError) {
        if (inlineMediaError instanceof DOMException && inlineMediaError.name === 'AbortError') return
        if (activeInlineMediaAbortController === inlineMediaAbortController) failInlineMedia(inlineMediaError)
      }
    },

    setInlinePictureRemoveMetadata: (isRemoveMetadataOn) => {
      const { inlineImaginePictureId } = getInlineMediaState()
      if (inlineImaginePictureId !== null) usePapelizImagineStore.getState().setImaginePictureRemoveMetadata(inlineImaginePictureId, isRemoveMetadataOn)
    },

    startInlineRecording: async () => {
      if (activeInlineAudioRecording !== null) return
      setInlineMediaState({ inlineMediaProblem: null })
      try {
        activeInlineAudioRecording = await startPapelizAssistantAudioRecording()
        setInlineMediaState({ inlineMediaStage: 'recording', inlineRecordingStartedAtMilliseconds: activeInlineAudioRecording.audioRecordingStartedAtMilliseconds })
      } catch (recordingStartError) {
        failInlineMedia(recordingStartError)
      }
    },

    stopInlineRecording: async () => {
      const inlineAudioRecording = activeInlineAudioRecording
      if (inlineAudioRecording === null) return
      activeInlineAudioRecording = null
      const recordedAudioBlob = await inlineAudioRecording.stopAudioRecording()
      setInlineMediaState({ inlineRecordingStartedAtMilliseconds: null })
      if (recordedAudioBlob.size === 0) {
        failInlineMedia(new PapelizAssistantProviderError('Nothing was recorded. Check the microphone and try again.', null))
        return
      }
      await transcribeInlineAudio(recordedAudioBlob, `recording${getPapelizAudioFileExtension(recordedAudioBlob.type)}`)
    },

    transcribeInlineAudioFile: (audioFile) => transcribeInlineAudio(audioFile, audioFile.name || 'audio'),

    setIsInlineTranscriptWrittenUp: (isInlineTranscriptWrittenUp) => {
      const { inlineTranscriptText, inlineWrittenUpText } = getInlineMediaState()
      setInlineMediaState({
        isInlineTranscriptWrittenUp,
        inlineInsertedBlockText: isInlineTranscriptWrittenUp && inlineWrittenUpText.length > 0 ? inlineWrittenUpText : inlineTranscriptText,
      })
    },

    acceptInlineMedia: async () => {
      const { inlineMediaStage, inlineInsertedBlockText, inlineImaginePictureId, inlineMediaAction, inlineReplacementPassageText } = getInlineMediaState()
      const { inlineEditEditorView, selectedPassageText } = usePapelizInlineEditStore.getState()
      const isPassageReplaced = inlineMediaAction === 'describe-picture' || inlineMediaAction === 'edit-picture'
      if (inlineMediaStage !== 'review' || inlineEditEditorView === null || (isPassageReplaced ? inlineReplacementPassageText : inlineInsertedBlockText).length === 0) return
      const inlineEditRange = readPapelizInlineEditRange(inlineEditEditorView.state)
      if (inlineEditRange === null || inlineEditEditorView.state.sliceDoc(inlineEditRange.inlineEditFrom, inlineEditRange.inlineEditTo) !== selectedPassageText) {
        failInlineMedia(new PapelizAssistantProviderError('The passage changed while the assistant worked. Select it again.', null))
        return
      }
      setInlineMediaState({ inlineMediaStage: 'working', inlineMediaProgressText: 'Saving…' })
      try {
        if ((inlineMediaAction === 'imagine' || inlineMediaAction === 'edit-picture') && inlineImaginePictureId !== null) {
          const plannedPictureVaultFileRelativePath = plannedPictureVaultFileRelativePaths.get(inlineImaginePictureId)
          const imaginePicture = usePapelizImagineStore.getState().imaginePictures.find((keptPicture) => keptPicture.imaginePictureId === inlineImaginePictureId)
          if (plannedPictureVaultFileRelativePath === undefined || imaginePicture === undefined) throw new PapelizAssistantProviderError('The picture was removed.', null)
          if (imaginePicture.savedVaultFileRelativePath !== plannedPictureVaultFileRelativePath) await savePapelizImaginePictureAt(inlineImaginePictureId, plannedPictureVaultFileRelativePath)
        }
        // The note may have changed while the picture was saved: the range follows it.
        const latestInlineEditRange = readPapelizInlineEditRange(inlineEditEditorView.state) ?? inlineEditRange
        if (inlineEditEditorView.state.sliceDoc(latestInlineEditRange.inlineEditFrom, latestInlineEditRange.inlineEditTo) !== selectedPassageText) {
          throw new PapelizAssistantProviderError('The passage changed while the picture was saved. Select it again.', null)
        }
        const noteTextInsertion = isPassageReplaced
          ? null
          : insertPapelizBlockAfterCursorLine(inlineEditEditorView.state.doc.toString(), latestInlineEditRange.inlineEditTo, inlineInsertedBlockText)
        // One change in the editor, so Undo takes it back.
        inlineEditEditorView.dispatch({
          changes:
            noteTextInsertion === null
              ? { from: latestInlineEditRange.inlineEditFrom, to: latestInlineEditRange.inlineEditTo, insert: inlineReplacementPassageText }
              : { from: noteTextInsertion.insertedAtTextOffset, insert: noteTextInsertion.insertedNoteText },
          effects: setPapelizInlineEditRangeEffect.of(null),
          userEvent: 'input.papeliz-inline-media',
        })
        inlineEditEditorView.focus()
        usePapelizInlineEditStore.setState({ inlineEditEditorView: null })
        getInlineMediaState().resetInlineMedia()
      } catch (inlineMediaError) {
        failInlineMedia(inlineMediaError)
      }
    },

    resetInlineMedia: () => {
      activeInlineMediaAbortController?.abort()
      activeInlineMediaAbortController = null
      activeInlineAudioRecording?.cancelAudioRecording()
      activeInlineAudioRecording = null
      setInlineMediaState({ ...papelizEmptyInlineMediaFields })
    },
  }
})

// Each card that opens starts with the action asked for (Transcribe Here, Imagine Here) or none; a card
// that closes ends whatever its action was doing.
usePapelizInlineEditStore.subscribe((inlineEditState, previousInlineEditState) => {
  if (inlineEditState.inlineEditOpenCount !== previousInlineEditState.inlineEditOpenCount) {
    const pendingInlineMediaAction = takePapelizPendingInlineMediaAction()
    if (pendingInlineMediaAction === null) usePapelizInlineMediaStore.getState().resetInlineMedia()
    else usePapelizInlineMediaStore.getState().startInlineMediaAction(pendingInlineMediaAction)
  } else if (inlineEditState.inlineEditEditorView === null && previousInlineEditState.inlineEditEditorView !== null) {
    usePapelizInlineMediaStore.getState().resetInlineMedia()
  }
})
