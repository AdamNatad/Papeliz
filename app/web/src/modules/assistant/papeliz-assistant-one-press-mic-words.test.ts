import { describe, expect, it } from 'vitest'
import { describePapelizOnePressMicTitle, describePapelizOnePressMicTranscribingWords } from './papeliz-assistant-one-press-mic'

// The mic names the model that transcribes: on hover at rest, and in the recorder row while it works.

describe('the mic’s words for the model that transcribes', () => {
  it('names the model and its provider in the hover, or nothing when no provider transcribes', () => {
    expect(describePapelizOnePressMicTitle({ providerModelName: 'muse-voice-transcribe-1.0', providerDisplayName: 'Meta Model API' })).toMatch(
      /^Speak: press to record, press again to stop\. Transcribes with muse-voice-transcribe-1\.0, on Meta Model API\. .+\.$/,
    )
    expect(describePapelizOnePressMicTitle(null)).not.toContain('Transcribes with')
    expect(describePapelizOnePressMicTitle(null)).toMatch(/^Speak: press to record, press again to stop\. .+\.$/)
  })

  it('reads "Transcribing · <model>" and "Part 2 of 3 · <model>" in the recorder row', () => {
    expect(describePapelizOnePressMicTranscribingWords(null, 'muse-voice-transcribe-1.0')).toBe('Transcribing · muse-voice-transcribe-1.0')
    expect(describePapelizOnePressMicTranscribingWords('Transcribing…', 'muse-voice-transcribe-1.0')).toBe('Transcribing · muse-voice-transcribe-1.0')
    expect(describePapelizOnePressMicTranscribingWords('Transcribing with Groq…', 'whisper-large-v3-turbo')).toBe('Transcribing · whisper-large-v3-turbo')
    expect(describePapelizOnePressMicTranscribingWords('Transcribing part 2 of 3…', 'whisper-large-v3-turbo')).toBe('Part 2 of 3 · whisper-large-v3-turbo')
    expect(describePapelizOnePressMicTranscribingWords('Preparing the audio…', 'gpt-transcribe')).toBe('Preparing the audio · gpt-transcribe')
    // No model known: the step alone, as before.
    expect(describePapelizOnePressMicTranscribingWords('Transcribing part 2 of 3…', null)).toBe('Part 2 of 3…')
    expect(describePapelizOnePressMicTranscribingWords(null, null)).toBe('Transcribing…')
  })
})
