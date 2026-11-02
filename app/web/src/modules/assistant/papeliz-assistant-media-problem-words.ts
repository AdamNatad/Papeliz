import { describePapelizErrorSentence } from '../vault/papeliz-failure-code-words'
import { PapelizAssistantAudioRecordingError } from './papeliz-assistant-audio-recording'
import { PapelizAssistantImageMetadataStripError } from './papeliz-assistant-image-metadata-strip'
import { PapelizAssistantProviderError } from './papeliz-openai-compatible-client'

// The sentence under Imagine's or Transcribe's controls when something fails: a provider's, the
// microphone's or the picture cleaner's own words (already cleaned of the key), or the vault's sentence
// for a save that failed.
export function describePapelizAssistantMediaProblem(mediaProblemError: unknown): string {
  if (
    mediaProblemError instanceof PapelizAssistantProviderError ||
    mediaProblemError instanceof PapelizAssistantAudioRecordingError ||
    mediaProblemError instanceof PapelizAssistantImageMetadataStripError
  ) {
    return mediaProblemError.message
  }
  return describePapelizErrorSentence(mediaProblemError)
}
