// Transcribe's audio on this device: a recording made with the browser's microphone, which the browser
// asks permission for only when Record is pressed, and the length of any audio before it is sent. The
// audio stays in this page's memory; it goes only to the provider that transcribes it, and into the
// vault only when the person asks for that.
//
// Providers that hear audio inside a chat take WAV or MP3 only, so a recording or another format is
// turned into a WAV here first: one channel at 16 kHz, which speech models work at, as 16-bit samples.

export interface PapelizAssistantAudioRecording {
  // When the microphone started, for the timer beside Stop.
  audioRecordingStartedAtMilliseconds: number
  stopAudioRecording: () => Promise<Blob>
  cancelAudioRecording: () => void
}

export class PapelizAssistantAudioRecordingError extends Error {
  override readonly name = 'PapelizAssistantAudioRecordingError'
}

// The first the browser can record: Chrome and Edge record WebM with Opus, Safari MP4 with AAC.
const papelizPreferredRecordingMimeTypes: readonly string[] = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

export function isPapelizAudioRecordingAvailable(): boolean {
  return typeof MediaRecorder !== 'undefined' && navigator.mediaDevices?.getUserMedia !== undefined
}

function describeMicrophoneRefusal(microphoneError: unknown): string {
  const microphoneErrorName = microphoneError instanceof DOMException ? microphoneError.name : ''
  if (microphoneErrorName === 'NotAllowedError' || microphoneErrorName === 'SecurityError') {
    return 'The microphone isn’t allowed for Papeliz. Allow it in the browser’s site settings, or bring in an audio file.'
  }
  if (microphoneErrorName === 'NotFoundError' || microphoneErrorName === 'OverconstrainedError') return 'No microphone was found.'
  if (microphoneErrorName === 'NotReadableError') return 'The microphone is in use by another app.'
  return 'The microphone could not start.'
}

// Asks for the microphone (the browser's own prompt, the first time) and starts recording.
export async function startPapelizAssistantAudioRecording(): Promise<PapelizAssistantAudioRecording> {
  if (!isPapelizAudioRecordingAvailable()) throw new PapelizAssistantAudioRecordingError('This browser can’t record audio. Bring in an audio file instead.')
  let microphoneStream: MediaStream
  try {
    microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
  } catch (microphoneError) {
    throw new PapelizAssistantAudioRecordingError(describeMicrophoneRefusal(microphoneError))
  }
  const recordingMimeType = papelizPreferredRecordingMimeTypes.find((candidateMimeType) => MediaRecorder.isTypeSupported(candidateMimeType))
  const audioRecorder = new MediaRecorder(microphoneStream, recordingMimeType === undefined ? undefined : { mimeType: recordingMimeType })
  const recordedAudioChunks: Blob[] = []
  audioRecorder.addEventListener('dataavailable', (recordedDataEvent) => {
    if (recordedDataEvent.data.size > 0) recordedAudioChunks.push(recordedDataEvent.data)
  })
  const releaseMicrophone = () => {
    for (const microphoneTrack of microphoneStream.getTracks()) microphoneTrack.stop()
  }
  audioRecorder.start(1000)
  return {
    audioRecordingStartedAtMilliseconds: performance.now(),
    stopAudioRecording: () =>
      new Promise<Blob>((resolveRecording) => {
        audioRecorder.addEventListener(
          'stop',
          () => {
            releaseMicrophone()
            resolveRecording(new Blob(recordedAudioChunks, { type: (audioRecorder.mimeType || recordingMimeType || 'audio/webm').split(';')[0] }))
          },
          { once: true },
        )
        if (audioRecorder.state === 'inactive') audioRecorder.dispatchEvent(new Event('stop'))
        else audioRecorder.stop()
      }),
    cancelAudioRecording: () => {
      if (audioRecorder.state !== 'inactive') audioRecorder.stop()
      releaseMicrophone()
      recordedAudioChunks.length = 0
    },
  }
}

// The file name a recording is sent and saved under, from its type.
export function getPapelizAudioFileExtension(audioMimeType: string): string {
  if (/webm/i.test(audioMimeType)) return '.webm'
  if (/mp4|m4a|aac/i.test(audioMimeType)) return '.m4a'
  if (/ogg|opus/i.test(audioMimeType)) return '.ogg'
  if (/wav/i.test(audioMimeType)) return '.wav'
  if (/mpeg|mp3/i.test(audioMimeType)) return '.mp3'
  if (/flac/i.test(audioMimeType)) return '.flac'
  return '.webm'
}

async function decodePapelizAudio(audioBlob: Blob): Promise<AudioBuffer> {
  // An offline context decodes without asking for the speakers, and without a click first.
  const decodingAudioContext = new OfflineAudioContext(1, 1, 16_000)
  try {
    return await decodingAudioContext.decodeAudioData(await audioBlob.arrayBuffer())
  } catch {
    throw new PapelizAssistantAudioRecordingError('This audio can’t be read. Try MP3, WAV, M4A or WebM.')
  }
}

// How long the audio plays, in seconds. A recording's own header often leaves the length out, so the
// audio is decoded to measure it.
export async function readPapelizAudioDurationSeconds(audioBlob: Blob): Promise<number> {
  return (await decodePapelizAudio(audioBlob)).duration
}

const papelizSpeechWavSampleRate = 16_000

function writeAsciiText(wavView: DataView, byteOffset: number, asciiText: string): void {
  for (let characterIndex = 0; characterIndex < asciiText.length; characterIndex += 1) wavView.setUint8(byteOffset + characterIndex, asciiText.charCodeAt(characterIndex))
}

// One channel of samples from -1 to 1 as a 16-bit PCM WAV file.
export function encodePapelizMonoWav(monoSamples: Float32Array, wavSampleRate: number): Blob {
  const wavHeaderByteCount = 44
  const wavBytes = new ArrayBuffer(wavHeaderByteCount + monoSamples.length * 2)
  const wavView = new DataView(wavBytes)
  writeAsciiText(wavView, 0, 'RIFF')
  wavView.setUint32(4, 36 + monoSamples.length * 2, true)
  writeAsciiText(wavView, 8, 'WAVE')
  writeAsciiText(wavView, 12, 'fmt ')
  wavView.setUint32(16, 16, true)
  wavView.setUint16(20, 1, true) // PCM
  wavView.setUint16(22, 1, true) // one channel
  wavView.setUint32(24, wavSampleRate, true)
  wavView.setUint32(28, wavSampleRate * 2, true)
  wavView.setUint16(32, 2, true)
  wavView.setUint16(34, 16, true)
  writeAsciiText(wavView, 36, 'data')
  wavView.setUint32(40, monoSamples.length * 2, true)
  for (let sampleIndex = 0; sampleIndex < monoSamples.length; sampleIndex += 1) {
    const clampedSample = Math.max(-1, Math.min(1, monoSamples[sampleIndex]!))
    wavView.setInt16(wavHeaderByteCount + sampleIndex * 2, clampedSample < 0 ? clampedSample * 0x8000 : clampedSample * 0x7fff, true)
  }
  return new Blob([wavBytes], { type: 'audio/wav' })
}

// Any audio the browser can play, as speech WAV (one channel at 16 kHz) in pieces of at most
// `maximumPieceSeconds`, for providers that take WAV only or a file of limited size.
export async function convertPapelizAudioToSpeechWavPieces(audioBlob: Blob, maximumPieceSeconds: number): Promise<Blob[]> {
  const decodedAudio = await decodePapelizAudio(audioBlob)
  const resampledSampleCount = Math.max(1, Math.ceil(decodedAudio.duration * papelizSpeechWavSampleRate))
  const resamplingAudioContext = new OfflineAudioContext(1, resampledSampleCount, papelizSpeechWavSampleRate)
  const audioSource = resamplingAudioContext.createBufferSource()
  audioSource.buffer = decodedAudio
  audioSource.connect(resamplingAudioContext.destination)
  audioSource.start()
  const speechSamples = (await resamplingAudioContext.startRendering()).getChannelData(0)
  const pieceSampleCount = Math.max(1, Math.floor(maximumPieceSeconds * papelizSpeechWavSampleRate))
  const speechWavPieces: Blob[] = []
  for (let pieceStartSample = 0; pieceStartSample < speechSamples.length; pieceStartSample += pieceSampleCount) {
    speechWavPieces.push(encodePapelizMonoWav(speechSamples.subarray(pieceStartSample, pieceStartSample + pieceSampleCount), papelizSpeechWavSampleRate))
  }
  return speechWavPieces
}

// "3:07" or "1:02:45".
export function formatPapelizAudioDuration(audioDurationSeconds: number): string {
  const wholeSeconds = Math.max(0, Math.round(audioDurationSeconds))
  const hourCount = Math.floor(wholeSeconds / 3600)
  const minuteCount = Math.floor((wholeSeconds % 3600) / 60)
  const secondCount = wholeSeconds % 60
  const paddedSeconds = String(secondCount).padStart(2, '0')
  return hourCount > 0 ? `${hourCount}:${String(minuteCount).padStart(2, '0')}:${paddedSeconds}` : `${minuteCount}:${paddedSeconds}`
}

// "2.4 MB", "830 KB".
export function formatPapelizMediaByteSize(mediaByteCount: number): string {
  if (mediaByteCount >= 1024 * 1024) return `${(mediaByteCount / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(mediaByteCount / 1024))} KB`
}
