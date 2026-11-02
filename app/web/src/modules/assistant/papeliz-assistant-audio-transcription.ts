import { convertPapelizAudioToSpeechWavPieces } from './papeliz-assistant-audio-recording'
import { transcribePapelizAssistantAudio } from './papeliz-assistant-image-and-audio-client'
import { buildPapelizAssistantMediaProviderConnection, type PapelizAssistantMediaModelChoice } from './papeliz-assistant-media-model-choices-store'
import { findPapelizAssistantTranscriptionPreset } from './papeliz-assistant-media-provider-presets'
import { PapelizAssistantProviderError } from './papeliz-openai-compatible-client'

// Speech to text with the person's chosen transcription model, for the chat's microphone and
// Transcribe Here. The audio is sent as it is when the provider takes it whole; otherwise it is turned
// into speech WAV in this browser and sent in pieces the provider takes, transcribed in order.

interface PapelizAudioTranscriptionRequest {
  transcriptionAudioBlob: Blob
  transcriptionAudioFileName: string
  transcriptionModelChoice: PapelizAssistantMediaModelChoice
  onTranscriptionProgressText?: (transcriptionProgressText: string) => void
  abortSignal?: AbortSignal
}

export async function transcribePapelizAudioWithChosenModel(audioTranscriptionRequest: PapelizAudioTranscriptionRequest): Promise<string> {
  const { transcriptionAudioBlob, transcriptionAudioFileName, transcriptionModelChoice, onTranscriptionProgressText, abortSignal } = audioTranscriptionRequest
  const transcriptionPreset = findPapelizAssistantTranscriptionPreset(transcriptionModelChoice.papelizAssistantProviderId)
  const mediaConnection = buildPapelizAssistantMediaProviderConnection('transcription', transcriptionModelChoice)
  if (mediaConnection.mediaConnectionOutcome !== 'ready') throw new PapelizAssistantProviderError(mediaConnection.mediaSetupProblem, null)
  if (transcriptionPreset === null) throw new PapelizAssistantProviderError('This provider doesn’t transcribe.', null)
  const isSentAsSpeechWav = transcriptionPreset.isSpeechWavRequired || transcriptionAudioBlob.size > transcriptionPreset.transcriptionAudioByteLimit
  if (isSentAsSpeechWav) onTranscriptionProgressText?.('Preparing the audio…')
  const transcribedAudioPieces = isSentAsSpeechWav
    ? (await convertPapelizAudioToSpeechWavPieces(transcriptionAudioBlob, transcriptionPreset.transcriptionAudioChunkSeconds)).map((speechWavPiece, pieceIndex, allPieces) => ({
        audioPieceBlob: speechWavPiece,
        audioPieceFileName: allPieces.length === 1 ? 'recording.wav' : `recording-part-${pieceIndex + 1}.wav`,
      }))
    : [{ audioPieceBlob: transcriptionAudioBlob, audioPieceFileName: transcriptionAudioFileName }]
  const transcriptPieceTexts: string[] = []
  for (const [pieceIndex, { audioPieceBlob, audioPieceFileName }] of transcribedAudioPieces.entries()) {
    if (abortSignal?.aborted === true) throw new DOMException('Transcription stopped.', 'AbortError')
    onTranscriptionProgressText?.(
      transcribedAudioPieces.length === 1 ? `Transcribing with ${mediaConnection.providerDisplayName}…` : `Transcribing part ${pieceIndex + 1} of ${transcribedAudioPieces.length}…`,
    )
    transcriptPieceTexts.push(
      await transcribePapelizAssistantAudio({
        providerConnection: mediaConnection.providerConnection,
        transcriptionApiShape: transcriptionPreset.transcriptionApiShape,
        transcriptionAudioBlob: audioPieceBlob,
        transcriptionAudioFileName: audioPieceFileName,
        transcriptionLanguageCode: null,
        transcriptionAutoLanguageValue: transcriptionPreset.transcriptionAutoLanguageValue,
        ...(abortSignal === undefined ? {} : { abortSignal }),
      }),
    )
  }
  return transcriptPieceTexts.join('\n\n')
}
