import { deflateSync } from 'node:zlib'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generatePapelizAssistantImages, type PapelizAssistantGeneratedImage } from './papeliz-assistant-image-and-audio-client'
import {
  addPapelizMadeImaginePictures,
  describePapelizImagineMakingLine,
  removePapelizImaginePictureFromThread,
  selectIsPapelizImagineMaking,
  usePapelizImagineStore,
  type PapelizImagineThreadEntry,
} from './papeliz-assistant-imagine-store'
import { PapelizAssistantProviderError } from './papeliz-openai-compatible-client'

// The Imagine tab's thread: each prompt sent from its box, with the pictures it made or what went
// wrong, each picture brought in, and the pictures made from the chat or a note. The provider is a
// stand-in, so no key or network is used.

vi.mock('./papeliz-assistant-image-and-audio-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./papeliz-assistant-image-and-audio-client')>()),
  generatePapelizAssistantImages: vi.fn(),
}))

vi.mock('./papeliz-assistant-media-model-choices-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./papeliz-assistant-media-model-choices-store')>()),
  buildPapelizAssistantMediaProviderConnection: () => ({
    mediaConnectionOutcome: 'ready',
    providerConnection: { providerBaseUrl: 'https://papeliz-test-provider.invalid/v1/', providerApiKey: 'papeliz-test-key-not-a-real-key', providerModelName: 'muse-image-1.0' },
    providerDisplayName: 'Meta Model API',
  }),
}))

const testImageModelChoice = { papelizAssistantProviderId: 'meta-model-api', providerModelName: 'muse-image-1.0' }

const pngCrcTable = Array.from({ length: 256 }, (_, tableIndex) => {
  let crcValue = tableIndex
  for (let bitIndex = 0; bitIndex < 8; bitIndex += 1) crcValue = crcValue & 1 ? 0xedb88320 ^ (crcValue >>> 1) : crcValue >>> 1
  return crcValue >>> 0
})

function buildPngChunk(pngChunkType: string, pngChunkData: Buffer): Buffer {
  const chunkTypeAndData = Buffer.concat([Buffer.from(pngChunkType, 'latin1'), pngChunkData])
  let crcValue = 0xffffffff
  for (const crcInputByte of chunkTypeAndData) crcValue = pngCrcTable[(crcValue ^ crcInputByte) & 0xff]! ^ (crcValue >>> 8)
  const lengthBytes = Buffer.alloc(4)
  lengthBytes.writeUInt32BE(pngChunkData.length)
  const crcBytes = Buffer.alloc(4)
  crcBytes.writeUInt32BE((crcValue ^ 0xffffffff) >>> 0)
  return Buffer.concat([lengthBytes, chunkTypeAndData, crcBytes])
}

// A 2×2 blue picture with no metadata in it.
function buildTestPicture(): Blob {
  const headerData = Buffer.alloc(13)
  headerData.writeUInt32BE(2, 0)
  headerData.writeUInt32BE(2, 4)
  headerData.set([8, 2, 0, 0, 0], 8)
  const pictureRow = Buffer.from([0, 0x00, 0x64, 0xd4, 0x00, 0x64, 0xd4])
  const pngBytes = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    buildPngChunk('IHDR', headerData),
    buildPngChunk('IDAT', deflateSync(Buffer.concat([pictureRow, pictureRow]))),
    buildPngChunk('IEND', Buffer.alloc(0)),
  ])
  return new Blob([pngBytes], { type: 'image/png' })
}

function buildPromptEntry(imagineThreadEntryId: string, imaginePictureIds: string[]): Extract<PapelizImagineThreadEntry, { imagineThreadEntryKind: 'prompt' }> {
  return {
    imagineThreadEntryId,
    imagineThreadEntryKind: 'prompt',
    imaginePromptText: 'A red fox in snow',
    imaginePromptPlace: 'imagine',
    imageModelLabel: 'muse-image-1.0 · Meta Model API',
    requestedPictureCount: imaginePictureIds.length,
    imaginePromptStage: 'made',
    imaginePromptProblem: null,
    imaginePictureIds,
  }
}

const readImagineThreadEntries = () => usePapelizImagineStore.getState().imagineThreadEntries

beforeEach(() => {
  vi.mocked(generatePapelizAssistantImages).mockReset()
  usePapelizImagineStore.setState({
    imaginePromptText: '',
    imagineImageAspectRatio: null,
    imagineGeneratedPictureCount: 1,
    imaginePictures: [],
    imagineThreadEntries: [],
    imaginePictureInsertion: null,
  })
})

describe('the Imagine thread’s words and pieces', () => {
  it('says what is being made, and with which model', () => {
    expect(describePapelizImagineMakingLine(1, 'muse-image-1.0 · Meta Model API')).toBe('Making the picture with muse-image-1.0 · Meta Model API…')
    expect(describePapelizImagineMakingLine(3, 'muse-image-1.0 · Meta Model API')).toBe('Making 3 pictures with muse-image-1.0 · Meta Model API…')
  })

  it('takes a removed picture out of its entry, and the entry out once its last picture is gone', () => {
    const imagineThreadEntries = [buildPromptEntry('two-pictures', ['picture-1', 'picture-2']), buildPromptEntry('one-picture', ['picture-3'])]
    const afterFirstRemoval = removePapelizImaginePictureFromThread(imagineThreadEntries, 'picture-1')
    expect(afterFirstRemoval.map((imagineThreadEntry) => imagineThreadEntry.imaginePictureIds)).toEqual([['picture-2'], ['picture-3']])
    expect(removePapelizImaginePictureFromThread(afterFirstRemoval, 'picture-3').map((imagineThreadEntry) => imagineThreadEntry.imagineThreadEntryId)).toEqual(['two-pictures'])
  })

  it('counts only the Imagine tab’s own prompts as making pictures', () => {
    const makingEntry = { ...buildPromptEntry('making', []), imaginePromptStage: 'making' as const }
    expect(selectIsPapelizImagineMaking({ imagineThreadEntries: [makingEntry] })).toBe(true)
    expect(selectIsPapelizImagineMaking({ imagineThreadEntries: [{ ...makingEntry, imaginePromptPlace: 'chat' }] })).toBe(false)
    expect(selectIsPapelizImagineMaking({ imagineThreadEntries: [buildPromptEntry('made', ['picture-1'])] })).toBe(false)
  })
})

describe('sending a prompt from the Imagine box', () => {
  it('empties the box, shows the prompt as making, then puts the pictures under it', async () => {
    let finishMakingPictures: (generatedImages: PapelizAssistantGeneratedImage[]) => void = () => undefined
    vi.mocked(generatePapelizAssistantImages).mockReturnValueOnce(
      new Promise((resolveGeneratedImages) => {
        finishMakingPictures = resolveGeneratedImages
      }),
    )
    usePapelizImagineStore.setState({ imaginePromptText: '  A red fox in snow  ', imagineGeneratedPictureCount: 2 })
    const sentPrompt = usePapelizImagineStore.getState().sendImaginePrompt(testImageModelChoice)

    expect(usePapelizImagineStore.getState().imaginePromptText).toBe('')
    expect(readImagineThreadEntries()).toMatchObject([
      { imagineThreadEntryKind: 'prompt', imaginePromptText: 'A red fox in snow', imaginePromptPlace: 'imagine', requestedPictureCount: 2, imaginePromptStage: 'making' },
    ])
    expect(readImagineThreadEntries()[0]).toMatchObject({ imageModelLabel: 'muse-image-1.0 · Meta Model API' })
    expect(selectIsPapelizImagineMaking(usePapelizImagineStore.getState())).toBe(true)
    // One prompt at a time: a second Send while pictures are being made does nothing.
    usePapelizImagineStore.setState({ imaginePromptText: 'A second prompt' })
    await usePapelizImagineStore.getState().sendImaginePrompt(testImageModelChoice)
    expect(readImagineThreadEntries()).toHaveLength(1)

    finishMakingPictures([
      { generatedImageBlob: buildTestPicture(), revisedImagePromptText: null },
      { generatedImageBlob: buildTestPicture(), revisedImagePromptText: null },
    ])
    await sentPrompt
    const [madeEntry] = readImagineThreadEntries()
    expect(madeEntry).toMatchObject({ imaginePromptStage: 'made', imaginePromptProblem: null })
    expect(madeEntry?.imaginePictureIds).toHaveLength(2)
    expect(usePapelizImagineStore.getState().imaginePictures.map((imaginePicture) => imaginePicture.imaginePictureId).sort()).toEqual([...(madeEntry?.imaginePictureIds ?? [])].sort())
    expect(usePapelizImagineStore.getState().imaginePictures[0]).toMatchObject({ imaginePictureDescriptionText: 'A red fox in snow', isRemoveC2paOn: true })
    expect(vi.mocked(generatePapelizAssistantImages).mock.calls[0]?.[0]).toMatchObject({ imagePromptText: 'A red fox in snow', generatedImageCount: 2 })
  })

  it('sends the chosen aspect ratio as the model’s size, and 1:1 until one is chosen', async () => {
    vi.mocked(generatePapelizAssistantImages).mockResolvedValue([{ generatedImageBlob: buildTestPicture(), revisedImagePromptText: null }])
    usePapelizImagineStore.setState({ imaginePromptText: 'A red fox in snow' })
    await usePapelizImagineStore.getState().sendImaginePrompt(testImageModelChoice)
    usePapelizImagineStore.getState().setImagineImageAspectRatio('16:9')
    usePapelizImagineStore.setState({ imaginePromptText: 'A wide valley at dusk' })
    await usePapelizImagineStore.getState().sendImaginePrompt(testImageModelChoice)
    expect(vi.mocked(generatePapelizAssistantImages).mock.calls.map(([imageGenerationRequest]) => [imageGenerationRequest.imageSizeValue, imageGenerationRequest.imageSizeFieldStyle])).toEqual([
      ['1024x1024', 'size-text'],
      ['1536x864', 'size-text'],
    ])
  })

  it('shows what went wrong in place of the pictures', async () => {
    vi.mocked(generatePapelizAssistantImages).mockRejectedValueOnce(new PapelizAssistantProviderError('Meta Model API turned the prompt down.', 400))
    usePapelizImagineStore.setState({ imaginePromptText: 'A red fox in snow' })
    await usePapelizImagineStore.getState().sendImaginePrompt(testImageModelChoice)
    expect(readImagineThreadEntries()).toMatchObject([{ imaginePromptStage: 'failed', imaginePromptProblem: 'Meta Model API turned the prompt down.', imaginePictureIds: [] }])
    expect(usePapelizImagineStore.getState().imaginePictures).toEqual([])
  })

  it('marks the prompt stopped when Stop is pressed', async () => {
    vi.mocked(generatePapelizAssistantImages).mockImplementationOnce(
      ({ abortSignal }) =>
        new Promise((_resolveGeneratedImages, rejectGeneratedImages) => {
          abortSignal?.addEventListener('abort', () => rejectGeneratedImages(new DOMException('Stopped.', 'AbortError')))
        }),
    )
    usePapelizImagineStore.setState({ imaginePromptText: 'A red fox in snow' })
    const sentPrompt = usePapelizImagineStore.getState().sendImaginePrompt(testImageModelChoice)
    usePapelizImagineStore.getState().stopImagineGeneration()
    await sentPrompt
    expect(readImagineThreadEntries()).toMatchObject([{ imaginePromptStage: 'stopped', imaginePromptProblem: null }])
    expect(selectIsPapelizImagineMaking(usePapelizImagineStore.getState())).toBe(false)
  })
})

describe('pictures that join the thread from elsewhere', () => {
  it('gives each brought-in file its own entry: the picture, or why it was turned away', async () => {
    await usePapelizImagineStore
      .getState()
      .bringInImaginePictureFiles([new File([buildTestPicture()], 'diagram.png', { type: 'image/png' }), new File(['not a picture'], 'notes.txt', { type: 'text/plain' })])
    const [pictureEntry, refusedEntry] = readImagineThreadEntries()
    expect(pictureEntry).toMatchObject({ imagineThreadEntryKind: 'brought-in', broughtInPictureFileName: 'diagram.png', broughtInPictureProblem: null })
    expect(pictureEntry?.imaginePictureIds).toEqual([usePapelizImagineStore.getState().imaginePictures[0]?.imaginePictureId])
    expect(refusedEntry).toMatchObject({ broughtInPictureFileName: 'notes.txt', broughtInPictureProblem: 'notes.txt isn’t a PNG, JPEG or WebP picture.', imaginePictureIds: [] })

    // Removing the picture takes its entry with it; the refused file's line stays.
    usePapelizImagineStore.getState().removeImaginePicture(pictureEntry?.imaginePictureIds[0] ?? '')
    expect(readImagineThreadEntries().map((imagineThreadEntry) => imagineThreadEntry.imagineThreadEntryKind === 'brought-in' && imagineThreadEntry.broughtInPictureFileName)).toEqual(['notes.txt'])
  })

  it('adds the chat’s and a note’s pictures under their prompt, saying where they were made', async () => {
    await addPapelizMadeImaginePictures([buildTestPicture()], 'A blue square on white paper', 'muse-image-1.0 · Meta Model API', 'chat')
    await addPapelizMadeImaginePictures([buildTestPicture()], 'A lighthouse', 'muse-image-1.0 · Meta Model API', 'note')
    expect(readImagineThreadEntries()).toMatchObject([
      { imaginePromptText: 'A blue square on white paper', imaginePromptPlace: 'chat', imaginePromptStage: 'made' },
      { imaginePromptText: 'A lighthouse', imaginePromptPlace: 'note', imaginePromptStage: 'made' },
    ])
    // The Imagine box's own prompts are in the thread already, so its pictures add no entry.
    await addPapelizMadeImaginePictures([buildTestPicture()], 'A red fox', 'muse-image-1.0 · Meta Model API', 'imagine')
    expect(readImagineThreadEntries()).toHaveLength(2)
  })
})
