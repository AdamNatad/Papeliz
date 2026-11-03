import { afterEach, describe, expect, it, vi } from 'vitest'
import { papelizMicrophoneFirstAskSentence, startPapelizAssistantAudioRecording } from './papeliz-assistant-audio-recording'
import { generatePapelizAssistantImages } from './papeliz-assistant-image-and-audio-client'

// This file runs as Papeliz for Windows does: the picture and speech messages name Papeliz and this
// computer, never a browser or a page.
vi.mock('virtual:papeliz-desktop-platform-availability', () => ({ isPapelizDesktopApp: true }))

const testProviderConnection = {
  providerBaseUrl: 'https://papeliz-test-provider.invalid/v1/',
  providerApiKey: 'papeliz-test-key-not-a-real-key-0123456789',
  providerModelName: 'papeliz-test-image-model',
}

function generateTestPictures(fetchFunction: (requestUrl: string, requestInit: RequestInit) => Promise<Response>) {
  return generatePapelizAssistantImages({
    providerConnection: testProviderConnection,
    imageGenerationProviderPath: 'images/generations',
    imageSizeFieldStyle: 'size-text',
    imagePromptText: 'A red fox in snow',
    imageSizeText: '1024x1024',
    generatedImageCount: 1,
    imageResponseFormatValue: 'b64_json',
    fetchFunction,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('picture and speech messages in the desktop app', () => {
  it('asks whether the provider accepts calls from Papeliz', async () => {
    await expect(
      generateTestPictures(async () => {
        throw new TypeError('Failed to fetch')
      }),
    ).rejects.toThrow('Could not reach papeliz-test-provider.invalid. Check the base URL and your connection, and that the provider accepts calls from Papeliz.')
  })

  it('says a picture link Papeliz can’t download', async () => {
    await expect(
      generateTestPictures(async (requestUrl) => {
        if (requestUrl.startsWith('https://pictures.test/')) throw new TypeError('Failed to fetch')
        return Response.json({ data: [{ url: 'https://pictures.test/fox.png' }] })
      }),
    ).rejects.toThrow('The picture is at pictures.test, which doesn’t let Papeliz download it.')
  })

  it('says Papeliz asks for the microphone, and where Windows allows it again', async () => {
    expect(papelizMicrophoneFirstAskSentence).toBe('Papeliz asks for the microphone the first time')
    vi.stubGlobal('MediaRecorder', class {})
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: async () => {
          throw new DOMException('Permission denied', 'NotAllowedError')
        },
      },
    })
    await expect(startPapelizAssistantAudioRecording()).rejects.toThrow(
      'The microphone isn’t allowed for Papeliz. Allow it in Windows’ microphone settings (Privacy & security › Microphone), or bring in an audio file.',
    )
  })

  it('says Papeliz can’t record on this computer when recording isn’t there', async () => {
    vi.stubGlobal('MediaRecorder', undefined)
    await expect(startPapelizAssistantAudioRecording()).rejects.toThrow('Papeliz can’t record audio on this computer. Bring in an audio file instead.')
  })
})
