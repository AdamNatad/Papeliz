import { describe, expect, it } from 'vitest'
import { editPapelizAssistantImage, generatePapelizAssistantImages, transcribePapelizAssistantAudio } from './papeliz-assistant-image-and-audio-client'
import type { PapelizAssistantProviderConnection } from './papeliz-openai-compatible-client'

// A provider played by the test: every request is answered here, so no real key or network is used.

const testProviderConnection: PapelizAssistantProviderConnection = {
  providerBaseUrl: 'https://papeliz-test-provider.invalid/v1/',
  providerApiKey: 'papeliz-test-key-not-a-real-key-0123456789',
  providerModelName: 'papeliz-test-image-model',
}

// The first bytes of a PNG, which is all the client checks before handing a picture on.
const testPngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const testPngBase64 = btoa(String.fromCharCode(...testPngBytes))

interface RecordedTestRequest {
  requestUrl: string
  requestInit: RequestInit
}

function createTestFetch(answerTestRequest: (recordedTestRequest: RecordedTestRequest, requestNumber: number) => Response) {
  const recordedTestRequests: RecordedTestRequest[] = []
  const testFetch = async (requestUrl: string, requestInit: RequestInit) => {
    recordedTestRequests.push({ requestUrl, requestInit })
    return answerTestRequest({ requestUrl, requestInit }, recordedTestRequests.length)
  }
  return { testFetch, recordedTestRequests }
}

function readJsonRequestBody(recordedTestRequest: RecordedTestRequest | undefined): Record<string, unknown> {
  return JSON.parse(String(recordedTestRequest?.requestInit.body)) as Record<string, unknown>
}

describe('Imagine pictures', () => {
  it('asks /images/generations for base64 pictures with the key, and reads them', async () => {
    const { testFetch, recordedTestRequests } = createTestFetch(() =>
      Response.json({ data: [{ b64_json: testPngBase64, revised_prompt: 'A red fox in fresh snow' }, { b64_json: testPngBase64 }] }),
    )
    const generatedImages = await generatePapelizAssistantImages({
      providerConnection: testProviderConnection,
      imageGenerationProviderPath: 'images/generations',
      imageSizeFieldStyle: 'size-text',
      imagePromptText: 'A red fox in snow',
      imageSizeText: '1024x1024',
      generatedImageCount: 2,
      imageResponseFormatValue: 'b64_json',
      fetchFunction: testFetch,
    })
    expect(recordedTestRequests[0]?.requestUrl).toBe('https://papeliz-test-provider.invalid/v1/images/generations')
    expect((recordedTestRequests[0]?.requestInit.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${testProviderConnection.providerApiKey}`)
    expect(readJsonRequestBody(recordedTestRequests[0])).toEqual({
      model: 'papeliz-test-image-model',
      prompt: 'A red fox in snow',
      n: 2,
      size: '1024x1024',
      response_format: 'b64_json',
    })
    expect(generatedImages).toHaveLength(2)
    expect(generatedImages[0]?.generatedImageBlob.type).toBe('image/png')
    expect(generatedImages[0]?.revisedImagePromptText).toBe('A red fox in fresh snow')
  })

  it('sends again without response_format when the model refuses it', async () => {
    const { testFetch, recordedTestRequests } = createTestFetch((_, requestNumber) =>
      requestNumber === 1
        ? Response.json({ error: { message: "Unknown parameter: 'response_format'." } }, { status: 400 })
        : Response.json({ data: [{ b64_json: testPngBase64 }] }),
    )
    const generatedImages = await generatePapelizAssistantImages({
      providerConnection: testProviderConnection,
      imageGenerationProviderPath: 'images/generations',
      imageSizeFieldStyle: 'size-text',
      imagePromptText: 'A red fox',
      imageSizeText: null,
      generatedImageCount: 1,
      imageResponseFormatValue: 'b64_json',
      fetchFunction: testFetch,
    })
    expect(recordedTestRequests).toHaveLength(2)
    expect(readJsonRequestBody(recordedTestRequests[1])).not.toHaveProperty('response_format')
    expect(readJsonRequestBody(recordedTestRequests[1])).not.toHaveProperty('size')
    expect(generatedImages).toHaveLength(1)
  })

  it('sends the size as width and height, and asks for base64 the way Together names it', async () => {
    const { testFetch, recordedTestRequests } = createTestFetch(() => Response.json({ data: [{ index: 0, type: 'b64_json', b64_json: testPngBase64 }] }))
    await generatePapelizAssistantImages({
      providerConnection: testProviderConnection,
      imageGenerationProviderPath: 'images/generations',
      imagePromptText: 'A red fox',
      imageSizeText: '1344x768',
      imageSizeFieldStyle: 'width-and-height',
      generatedImageCount: 1,
      imageResponseFormatValue: 'base64',
      fetchFunction: testFetch,
    })
    expect(readJsonRequestBody(recordedTestRequests[0])).toEqual({ model: 'papeliz-test-image-model', prompt: 'A red fox', n: 1, width: 1344, height: 768, response_format: 'base64' })
  })

  it('reads OpenRouter’s own image API at /images', async () => {
    const { testFetch, recordedTestRequests } = createTestFetch(() => Response.json({ data: [{ b64_json: testPngBase64, media_type: 'image/png' }] }))
    const generatedImages = await generatePapelizAssistantImages({
      providerConnection: testProviderConnection,
      imageGenerationProviderPath: 'images',
      imagePromptText: 'A red fox',
      imageSizeText: null,
      imageSizeFieldStyle: 'size-text',
      generatedImageCount: 1,
      imageResponseFormatValue: null,
      fetchFunction: testFetch,
    })
    expect(recordedTestRequests[0]?.requestUrl).toBe('https://papeliz-test-provider.invalid/v1/images')
    expect(readJsonRequestBody(recordedTestRequests[0])).not.toHaveProperty('response_format')
    expect(generatedImages[0]?.generatedImageBlob.type).toBe('image/png')
  })

  it('asks Meta’s /images/edits to change a picture, in its JSON shape', async () => {
    const { testFetch, recordedTestRequests } = createTestFetch(() => Response.json({ data: [{ b64_json: testPngBase64 }], output_format: 'png' }))
    const editedImages = await editPapelizAssistantImage({
      providerConnection: { ...testProviderConnection, providerModelName: 'muse-image-1.0' },
      imageEditPromptText: 'Make the sky a sunset',
      sourceImageUrl: `data:image/png;base64,${testPngBase64}`,
      fetchFunction: testFetch,
    })
    expect(recordedTestRequests[0]?.requestUrl).toBe('https://papeliz-test-provider.invalid/v1/images/edits')
    expect(readJsonRequestBody(recordedTestRequests[0])).toEqual({
      model: 'muse-image-1.0',
      prompt: 'Make the sky a sunset',
      images: [{ image_url: `data:image/png;base64,${testPngBase64}` }],
      n: 1,
      response_format: 'b64_json',
    })
    expect(editedImages[0]?.generatedImageBlob.type).toBe('image/png')
  })

  it('never shows the key in an error, even when the provider repeats it', async () => {
    const { testFetch } = createTestFetch(() => Response.json({ error: { message: `Bad key ${testProviderConnection.providerApiKey}` } }, { status: 401 }))
    const imageGeneration = generatePapelizAssistantImages({
      providerConnection: testProviderConnection,
      imageGenerationProviderPath: 'images/generations',
      imageSizeFieldStyle: 'size-text',
      imagePromptText: 'A red fox',
      imageSizeText: null,
      generatedImageCount: 1,
      imageResponseFormatValue: 'b64_json',
      fetchFunction: testFetch,
    })
    await expect(imageGeneration).rejects.toThrow(/refused the API key \(401\)/)
    await expect(imageGeneration).rejects.not.toThrow(testProviderConnection.providerApiKey)
  })

  it('refuses an answer that isn’t a PNG, JPEG or WebP', async () => {
    const { testFetch } = createTestFetch(() => Response.json({ data: [{ b64_json: btoa('GIF89a not a picture Papeliz takes') }] }))
    await expect(
      generatePapelizAssistantImages({
        providerConnection: testProviderConnection,
        imageGenerationProviderPath: 'images/generations',
      imageSizeFieldStyle: 'size-text',
        imagePromptText: 'A red fox',
        imageSizeText: null,
        generatedImageCount: 1,
        imageResponseFormatValue: 'b64_json',
        fetchFunction: testFetch,
      }),
    ).rejects.toThrow(/only PNG, JPEG and WebP/)
  })
})

describe('Transcribe speech', () => {
  const testAudioBlob = new Blob([Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3])], { type: 'audio/webm' })

  it('sends the audio as a form to /audio/transcriptions, without its own Content-Type', async () => {
    const { testFetch, recordedTestRequests } = createTestFetch(() => Response.json({ text: '  Hello from the meeting.  ' }))
    const transcriptText = await transcribePapelizAssistantAudio({
      providerConnection: { ...testProviderConnection, providerModelName: 'papeliz-test-transcription-model' },
      transcriptionApiShape: 'audio-transcriptions-endpoint',
      transcriptionAudioBlob: testAudioBlob,
      transcriptionAudioFileName: 'recording.webm',
      transcriptionLanguageCode: 'en',
      fetchFunction: testFetch,
    })
    expect(transcriptText).toBe('Hello from the meeting.')
    expect(recordedTestRequests[0]?.requestUrl).toBe('https://papeliz-test-provider.invalid/v1/audio/transcriptions')
    const sentHeaders = recordedTestRequests[0]?.requestInit.headers as Record<string, string>
    expect(sentHeaders['Content-Type']).toBeUndefined()
    expect(sentHeaders['Authorization']).toBe(`Bearer ${testProviderConnection.providerApiKey}`)
    const sentForm = recordedTestRequests[0]?.requestInit.body as FormData
    expect(sentForm.get('model')).toBe('papeliz-test-transcription-model')
    expect(sentForm.get('language')).toBe('en')
    expect((sentForm.get('file') as File).name).toBe('recording.webm')
    expect([...sentForm.keys()]).toEqual(['model', 'response_format', 'language', 'file'])
  })

  it('sends the API’s own word for any language when none is chosen', async () => {
    const { testFetch, recordedTestRequests } = createTestFetch(() => Response.json({ text: 'Hola.' }))
    await transcribePapelizAssistantAudio({
      providerConnection: testProviderConnection,
      transcriptionApiShape: 'audio-transcriptions-endpoint',
      transcriptionAudioBlob: testAudioBlob,
      transcriptionAudioFileName: 'recording.webm',
      transcriptionLanguageCode: null,
      transcriptionAutoLanguageValue: 'auto',
      fetchFunction: testFetch,
    })
    expect((recordedTestRequests[0]?.requestInit.body as FormData).get('language')).toBe('auto')
  })

  it('sends Meta’s transcription a request part and the WAV, and labels the speakers', async () => {
    const { testFetch, recordedTestRequests } = createTestFetch(() =>
      Response.json({
        sessionId: 'papeliz-test-session',
        transcript: 'Shall we start? Yes. First the budget.',
        audioDurationMs: 8240,
        turns: [
          { turnId: 1, startMs: 0, endMs: 1200, transcript: 'Shall we start?', speaker: 'A' },
          { turnId: 2, startMs: 1300, endMs: 1800, transcript: 'Yes.', speaker: 'B' },
          { turnId: 3, startMs: 1900, endMs: 3000, transcript: 'First the budget.', speaker: 'B' },
        ],
      }),
    )
    const transcriptText = await transcribePapelizAssistantAudio({
      providerConnection: { ...testProviderConnection, providerModelName: 'muse-voice-transcribe-1.0' },
      transcriptionApiShape: 'meta-asr-transcribe-endpoint',
      transcriptionAudioBlob: new Blob([Uint8Array.from([82, 73, 70, 70])], { type: 'audio/wav' }),
      transcriptionAudioFileName: 'recording.wav',
      transcriptionLanguageCode: null,
      fetchFunction: testFetch,
    })
    expect(transcriptText).toBe('Speaker A: Shall we start?\n\nSpeaker B: Yes. First the budget.')
    expect(recordedTestRequests[0]?.requestUrl).toBe('https://papeliz-test-provider.invalid/v1/asr/transcribe')
    const sentForm = recordedTestRequests[0]?.requestInit.body as FormData
    const sentRequestPart = sentForm.get('request') as File
    expect(sentRequestPart.type).toBe('application/json')
    expect(JSON.parse(await sentRequestPart.text())).toEqual({ model: 'muse-voice-transcribe-1.0', audioEncoding: 'WAV', mode: 'DIARIZATION' })
    expect((sentForm.get('audio') as File).name).toBe('recording.wav')
  })

  it('sends Meta’s request settings again as a plain field when the JSON part is refused', async () => {
    const { testFetch, recordedTestRequests } = createTestFetch((_, requestNumber) =>
      requestNumber === 1 ? new Response('Unsupported Media Type', { status: 415 }) : Response.json({ transcript: 'Hello.', turns: [] }),
    )
    const transcriptText = await transcribePapelizAssistantAudio({
      providerConnection: testProviderConnection,
      transcriptionApiShape: 'meta-asr-transcribe-endpoint',
      transcriptionAudioBlob: new Blob([Uint8Array.from([82, 73, 70, 70])], { type: 'audio/wav' }),
      transcriptionAudioFileName: 'recording.wav',
      transcriptionLanguageCode: 'en',
      fetchFunction: testFetch,
    })
    expect(transcriptText).toBe('Hello.')
    expect(typeof (recordedTestRequests[1]?.requestInit.body as FormData).get('request')).toBe('string')
    expect(JSON.parse(String((recordedTestRequests[1]?.requestInit.body as FormData).get('request')))['languageBias']).toEqual(['en'])
  })

  it('gives a chat-input provider the audio as input_audio and reads the words back', async () => {
    const { testFetch, recordedTestRequests } = createTestFetch(() => Response.json({ choices: [{ message: { content: 'Hello from the meeting.' } }] }))
    const transcriptText = await transcribePapelizAssistantAudio({
      providerConnection: testProviderConnection,
      transcriptionApiShape: 'chat-completions-audio-input',
      transcriptionAudioBlob: new Blob([Uint8Array.from([82, 73, 70, 70])], { type: 'audio/wav' }),
      transcriptionAudioFileName: 'recording.wav',
      transcriptionLanguageCode: null,
      fetchFunction: testFetch,
    })
    expect(transcriptText).toBe('Hello from the meeting.')
    const sentMessages = readJsonRequestBody(recordedTestRequests[0])['messages'] as Array<{ content: Array<{ type: string; input_audio?: { format: string; data: string } }> }>
    expect(sentMessages[0]?.content[1]).toEqual({ type: 'input_audio', input_audio: { format: 'wav', data: btoa('RIFF') } })
  })

  it('refuses audio a chat-input provider can’t take', async () => {
    const { testFetch } = createTestFetch(() => Response.json({}))
    await expect(
      transcribePapelizAssistantAudio({
        providerConnection: testProviderConnection,
        transcriptionApiShape: 'chat-completions-audio-input',
        transcriptionAudioBlob: testAudioBlob,
        transcriptionAudioFileName: 'recording.webm',
        transcriptionLanguageCode: null,
        fetchFunction: testFetch,
      }),
    ).rejects.toThrow(/WAV or MP3/)
  })
})
