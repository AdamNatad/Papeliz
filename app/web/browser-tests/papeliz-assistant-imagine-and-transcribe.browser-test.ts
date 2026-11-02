import { deflateSync } from 'node:zlib'
import { expect, test, type Locator, type Page, type Route } from '@playwright/test'

// The assistant's Meta-model actions in a real browser, against a provider the test plays at a made-up
// address: the Meta Model API preset with its base URL pointed there and a made-up key, so Meta's own
// request shapes (`/images/generations`, `/images/edits`, `/asr/transcribe`, vision in chat) are what
// the page sends. Every provider call is answered here, and any other request off this computer is
// refused, so no real key or outside network is used. The pictures the provider "makes" carry C2PA
// content credentials and a text chunk, built byte by byte while the test runs: no picture with
// metadata is stored in the repository.

const testProviderBaseUrl = 'https://papeliz-test-provider.invalid/v1'
const testProviderApiKey = 'papeliz-test-key-not-a-real-key'
const metaChatModelName = 'muse-spark-1.3'
const testC2paManifestText = 'c2pa manifest store made by a picture generator'
const testSpokenTranscriptText = 'um so we ship the release on friday and uh Ana writes the release notes'
const testWrittenUpText = 'We ship the release on Friday. Ana writes the release notes.'
const testPictureAltText = 'A blue square on white paper'
const testWrittenNoteText = '# Friday release\n\nThe team agreed to ship on Friday.'

const testProviderCorsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
}

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

// A 16×16 one-colour picture that any browser draws, with a C2PA chunk and a text chunk in it.
function buildTestPictureWithContentCredentials(pictureRgb: readonly [number, number, number] = [0x00, 0x64, 0xd4]): Buffer {
  const pictureSide = 16
  const headerData = Buffer.alloc(13)
  headerData.writeUInt32BE(pictureSide, 0)
  headerData.writeUInt32BE(pictureSide, 4)
  headerData.set([8, 2, 0, 0, 0], 8)
  const pictureRow = Buffer.concat([Buffer.from([0]), Buffer.alloc(pictureSide * 3, Buffer.from(pictureRgb))])
  const pixelData = deflateSync(Buffer.concat(Array.from({ length: pictureSide }, () => pictureRow)))
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    buildPngChunk('IHDR', headerData),
    buildPngChunk('caBX', Buffer.from(testC2paManifestText, 'latin1')),
    buildPngChunk('tEXt', Buffer.from('Software\0A picture generator', 'latin1')),
    buildPngChunk('IDAT', pixelData),
    buildPngChunk('IEND', Buffer.alloc(0)),
  ])
}

// One second of a 440 Hz tone as a 16 kHz mono WAV.
function buildTestSpeechWav(): Buffer {
  const wavSampleRate = 16_000
  const sampleBytes = Buffer.alloc(wavSampleRate * 2)
  for (let sampleIndex = 0; sampleIndex < wavSampleRate; sampleIndex += 1) {
    sampleBytes.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * sampleIndex) / wavSampleRate) * 8000), sampleIndex * 2)
  }
  const wavHeader = Buffer.alloc(44)
  wavHeader.write('RIFF', 0, 'latin1')
  wavHeader.writeUInt32LE(36 + sampleBytes.length, 4)
  wavHeader.write('WAVEfmt ', 8, 'latin1')
  wavHeader.writeUInt32LE(16, 16)
  wavHeader.writeUInt16LE(1, 20)
  wavHeader.writeUInt16LE(1, 22)
  wavHeader.writeUInt32LE(wavSampleRate, 24)
  wavHeader.writeUInt32LE(wavSampleRate * 2, 28)
  wavHeader.writeUInt16LE(2, 32)
  wavHeader.writeUInt16LE(16, 34)
  wavHeader.write('data', 36, 'latin1')
  wavHeader.writeUInt32LE(sampleBytes.length, 40)
  return Buffer.concat([wavHeader, sampleBytes])
}

interface TestProviderRequestRecord {
  providerRequestPath: string
  providerRequestAuthorization: string | null
  providerRequestBodyText: string
}

// Answers the provider's calls as the Meta Model API would, and refuses every other request that
// would leave this computer.
async function playTestMetaProvider(page: Page): Promise<{ testProviderRequests: TestProviderRequestRecord[]; refusedOutsideRequestUrls: string[] }> {
  const testProviderRequests: TestProviderRequestRecord[] = []
  const refusedOutsideRequestUrls: string[] = []
  await page.route('**/*', async (route: Route) => {
    const requestUrl = new URL(route.request().url())
    if (requestUrl.hostname === '127.0.0.1' || requestUrl.hostname === 'localhost' || requestUrl.protocol === 'blob:' || requestUrl.protocol === 'data:') return route.continue()
    refusedOutsideRequestUrls.push(requestUrl.href)
    return route.abort('blockedbyclient')
  })
  await page.route(`${testProviderBaseUrl}/**`, async (route: Route) => {
    const providerRequest = route.request()
    if (providerRequest.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: testProviderCorsHeaders })
    const providerRequestPath = new URL(providerRequest.url()).pathname.replace('/v1/', '')
    if (providerRequest.method() === 'GET' && providerRequestPath === 'models') {
      return route.fulfill({ status: 200, headers: testProviderCorsHeaders, json: { data: [{ id: metaChatModelName }] } })
    }
    const providerRequestBodyText = providerRequest.postDataBuffer()?.toString('latin1') ?? ''
    testProviderRequests.push({ providerRequestPath, providerRequestAuthorization: await providerRequest.headerValue('authorization'), providerRequestBodyText })
    if (providerRequestPath === 'images/generations') {
      return route.fulfill({ status: 200, headers: testProviderCorsHeaders, json: { data: [{ b64_json: buildTestPictureWithContentCredentials().toString('base64') }] } })
    }
    if (providerRequestPath === 'images/edits') {
      return route.fulfill({ status: 200, headers: testProviderCorsHeaders, json: { data: [{ b64_json: buildTestPictureWithContentCredentials([0xd4, 0x20, 0x20]).toString('base64') }] } })
    }
    if (providerRequestPath === 'asr/transcribe') {
      return route.fulfill({ status: 200, headers: testProviderCorsHeaders, json: { sessionId: 'papeliz-test-session', transcript: testSpokenTranscriptText, audioDurationMs: 1000, turns: [] } })
    }
    if (providerRequestPath === 'chat/completions') {
      const chatRequestBody = providerRequest.postDataJSON() as { messages: Array<{ content?: unknown }> }
      const chatAnswerText =
        chatRequestBody.messages.length === 1 && chatRequestBody.messages[0]?.content === 'Reply with the single word: ready'
          ? 'ready'
          : providerRequestBodyText.includes('clean written text')
            ? testWrittenUpText
            : providerRequestBodyText.includes('alt text')
              ? testPictureAltText
              : testWrittenNoteText
      return route.fulfill({
        status: 200,
        headers: testProviderCorsHeaders,
        json: { choices: [{ index: 0, message: { role: 'assistant', content: chatAnswerText }, finish_reason: 'stop' }], usage: { prompt_tokens: 300, completion_tokens: 30 } },
      })
    }
    return route.fulfill({ status: 404, headers: testProviderCorsHeaders, json: { error: { message: 'Not served by the test provider.' } } })
  })
  return { testProviderRequests, refusedOutsideRequestUrls }
}

// The Meta Model API, added as Settings › AI Provider adds it, its base URL changed (under Advanced)
// to the provider the test plays.
async function setUpTestMetaProvider(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Choose a Provider' }).first().click()
  const settingsPanel = page.getByRole('dialog', { name: 'Settings' })
  await settingsPanel.getByRole('button', { name: 'Add Provider', exact: true }).click()
  const addProviderDialog = page.getByRole('dialog', { name: 'Add Provider' })
  await expect(addProviderDialog.getByRole('button', { name: /^Provider Meta Model API/ })).toBeVisible()
  await addProviderDialog.getByLabel(/^API Key/).fill(testProviderApiKey)
  await addProviderDialog.getByRole('button', { name: /^Advanced/ }).click()
  await addProviderDialog.getByRole('textbox', { name: 'Base URL' }).fill(testProviderBaseUrl)
  await addProviderDialog.getByRole('button', { name: 'Load Models', exact: true }).click()
  const metaChatModelSwitch = addProviderDialog.getByRole('switch', { name: metaChatModelName })
  await expect(metaChatModelSwitch).toBeVisible()
  if ((await metaChatModelSwitch.getAttribute('aria-checked')) !== 'true') await metaChatModelSwitch.click()
  await expect(metaChatModelSwitch).toHaveAttribute('aria-checked', 'true')
  await addProviderDialog.getByRole('button', { name: 'Test Connection', exact: true }).click()
  await expect(addProviderDialog.getByText(`Connected. ${metaChatModelName} answered`, { exact: false })).toBeVisible()
  await addProviderDialog.getByRole('button', { name: 'Add Provider', exact: true }).click()
  await expect(addProviderDialog).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(settingsPanel).toBeHidden()
}

async function openSampleVaultWithMetaProvider(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try Sample' }).first().click()
  await expect(page.locator('.cm-content').first()).toContainText('Welcome to the sample vault.')
  await setUpTestMetaProvider(page)
}

async function readBlobPictureBytes(page: Page, blobPictureUrl: string): Promise<Buffer> {
  return Buffer.from(await page.evaluate(async (pictureUrl) => [...new Uint8Array(await (await fetch(pictureUrl)).arrayBuffer())], blobPictureUrl))
}

function expectPictureCleaned(savedPictureBytes: Buffer): void {
  expect(savedPictureBytes.includes(Buffer.from('caBX', 'latin1'))).toBe(false)
  expect(savedPictureBytes.includes(Buffer.from(testC2paManifestText, 'latin1'))).toBe(false)
  expect(savedPictureBytes.includes(Buffer.from('tEXt', 'latin1'))).toBe(false)
}

// In MD Code: selects the whole line holding `lineText`, then opens Edit with Assistant (Ctrl+K).
async function openInlineCardOnLine(page: Page, lineText: string): Promise<Locator> {
  await page.locator('.cm-line', { hasText: lineText }).first().click()
  await page.keyboard.press('Home')
  await page.keyboard.press('Shift+End')
  await page.keyboard.press('Control+k')
  const inlineCard = page.locator('.papeliz-inline-edit-host [role="dialog"]')
  await expect(inlineCard).toBeVisible()
  return inlineCard
}

test('Imagine from the chat box: the picture shows in the chat, and Put in Note saves it cleaned of C2PA once the diff is accepted', async ({ page }) => {
  const { testProviderRequests, refusedOutsideRequestUrls } = await playTestMetaProvider(page)
  await openSampleVaultWithMetaProvider(page)
  const noteEditorContent = page.locator('.cm-content').first()
  const assistantPanel = page.getByRole('complementary', { name: 'AI Assistant' })
  const imagineButton = assistantPanel.getByRole('button', { name: 'Imagine a Picture' })
  await expect(imagineButton).toBeDisabled()
  await assistantPanel.getByRole('textbox', { name: 'Message the assistant' }).fill('A blue square on white paper')
  await imagineButton.click()

  const chatPictures = assistantPanel.getByRole('region', { name: 'Imagine: A blue square on white paper' })
  const chatPicture = chatPictures.getByRole('img', { name: 'A blue square on white paper' })
  await expect(chatPicture).toBeVisible()
  await expect.poll(() => chatPicture.evaluate((pictureElement: HTMLImageElement) => pictureElement.naturalWidth)).toBe(16)
  await expect(chatPictures.getByText('Carries C2PA content credentials and a text chunk. Removed when saved.')).toBeVisible()
  const imagesRequest = testProviderRequests.find((providerRequest) => providerRequest.providerRequestPath === 'images/generations')
  expect(imagesRequest?.providerRequestAuthorization).toBe(`Bearer ${testProviderApiKey}`)
  expect(JSON.parse(imagesRequest?.providerRequestBodyText ?? '{}')).toMatchObject({ model: 'muse-image-1.0', prompt: 'A blue square on white paper', n: 1, response_format: 'b64_json' })
  // Only Test Connection went to the chat's model: the picture didn't.
  expect(testProviderRequests.filter((providerRequest) => providerRequest.providerRequestPath === 'chat/completions')).toHaveLength(1)

  await chatPictures.getByRole('button', { name: 'Put in Note' }).click()
  const pictureDiffCard = chatPictures.getByRole('region', { name: 'Change to Start here' })
  await expect(pictureDiffCard.locator('.papeliz-text-diff-added')).toContainText('![A blue square on white paper](Attachments/imagine-')
  await pictureDiffCard.getByRole('button', { name: 'Accept', exact: true }).click()
  await expect(pictureDiffCard).toBeHidden()
  await page.getByRole('button', { name: 'MD Code', exact: true }).click()
  await expect(noteEditorContent).toContainText('![A blue square on white paper](Attachments/imagine-')
  expect(await noteEditorContent.locator('.cm-line').first().textContent()).toBe('---')
  await expect(chatPictures.getByText('Saved without C2PA content credentials and a text chunk.')).toBeVisible()
  expectPictureCleaned(await readBlobPictureBytes(page, (await chatPicture.getAttribute('src')) ?? ''))

  // The Imagine tab keeps every picture made, wherever it was made.
  await assistantPanel.getByRole('button', { name: 'Imagine', exact: true }).click()
  await expect(assistantPanel.getByRole('img', { name: 'A blue square on white paper' })).toBeVisible()
  expect(refusedOutsideRequestUrls).toEqual([])
})

test('a picture brought into Imagine with Remove C2PA off is saved as it came', async ({ page }) => {
  await playTestMetaProvider(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Try Sample' }).first().click()
  const assistantPanel = page.getByRole('complementary', { name: 'AI Assistant' })
  await assistantPanel.getByRole('button', { name: 'Imagine', exact: true }).click()
  // No provider yet: the tab says what to add, and bringing in a picture still works.
  await expect(assistantPanel.getByText('Add a provider that makes pictures')).toBeVisible()
  await assistantPanel.getByLabel('Bring in a picture').setInputFiles({ name: 'diagram.png', mimeType: 'image/png', buffer: buildTestPictureWithContentCredentials() })
  await expect(assistantPanel.getByRole('img', { name: 'diagram.png' })).toBeVisible()
  await assistantPanel.getByRole('switch', { name: 'Remove C2PA' }).click()
  await expect(assistantPanel.getByText('Carries C2PA content credentials and a text chunk. Kept when saved.')).toBeVisible()
  await assistantPanel.getByRole('button', { name: 'Save to Vault' }).click()
  await expect(assistantPanel.getByText('Saved as it came, metadata and all.')).toBeVisible()
  await expect(assistantPanel.getByText(/^In the vault: picture-\d{4}-\d{2}-\d{2}-\d{4}-diagram\.png$/)).toBeVisible()
  const savedPictureBytes = await readBlobPictureBytes(page, (await assistantPanel.getByRole('img', { name: 'diagram.png' }).getAttribute('src')) ?? '')
  expect(savedPictureBytes.includes(Buffer.from(testC2paManifestText, 'latin1'))).toBe(true)
})

test('Speak in the chat box: an audio file goes to Meta’s transcription as WAV, and the words land in the chat box', async ({ page }) => {
  const { testProviderRequests, refusedOutsideRequestUrls } = await playTestMetaProvider(page)
  await openSampleVaultWithMetaProvider(page)
  const assistantPanel = page.getByRole('complementary', { name: 'AI Assistant' })
  await assistantPanel.getByRole('button', { name: 'Speak' }).click()
  const audioFileChooser = page.waitForEvent('filechooser')
  await page.getByRole('menu', { name: 'Speak' }).getByRole('menuitem', { name: 'Transcribe an Audio File' }).click()
  await (await audioFileChooser).setFiles({ name: 'standup.wav', mimeType: 'audio/wav', buffer: buildTestSpeechWav() })
  await expect(assistantPanel.getByRole('textbox', { name: 'Message the assistant' })).toHaveValue(testSpokenTranscriptText)

  const transcriptionRequest = testProviderRequests.find((providerRequest) => providerRequest.providerRequestPath === 'asr/transcribe')
  expect(transcriptionRequest?.providerRequestAuthorization).toBe(`Bearer ${testProviderApiKey}`)
  expect(transcriptionRequest?.providerRequestBodyText).toContain('name="request"')
  expect(transcriptionRequest?.providerRequestBodyText).toContain('"model":"muse-voice-transcribe-1.0","audioEncoding":"WAV","mode":"DIARIZATION"')
  expect(transcriptionRequest?.providerRequestBodyText).toContain('name="audio"; filename="recording.wav"')
  expect(transcriptionRequest?.providerRequestBodyText).toContain('RIFF')
  expect(refusedOutsideRequestUrls).toEqual([])
})

// A stand-in microphone: getUserMedia is counted, and answers with a tone from the page's own audio
// instead of a real device, so Record runs unattended in every browser.
test('Record in the chat box asks for the microphone only when pressed, and its words land in the chat box', async ({ page }) => {
  const { testProviderRequests } = await playTestMetaProvider(page)
  await page.addInitScript(() => {
    const papelizTestWindow = window as unknown as { papelizTestMicrophoneRequestCount: number }
    papelizTestWindow.papelizTestMicrophoneRequestCount = 0
    navigator.mediaDevices.getUserMedia = async () => {
      papelizTestWindow.papelizTestMicrophoneRequestCount += 1
      const toneAudioContext = new AudioContext()
      const toneOscillator = toneAudioContext.createOscillator()
      const toneDestination = toneAudioContext.createMediaStreamDestination()
      toneOscillator.connect(toneDestination)
      toneOscillator.start()
      return toneDestination.stream
    }
  })
  await openSampleVaultWithMetaProvider(page)
  const readMicrophoneRequestCount = () => page.evaluate(() => (window as unknown as { papelizTestMicrophoneRequestCount: number }).papelizTestMicrophoneRequestCount)
  const assistantPanel = page.getByRole('complementary', { name: 'AI Assistant' })
  expect(await readMicrophoneRequestCount()).toBe(0)
  await assistantPanel.getByRole('button', { name: 'Speak' }).click()
  await page.getByRole('menu', { name: 'Speak' }).getByRole('menuitem', { name: 'Record' }).click()
  const stopRecordingButton = assistantPanel.getByRole('button', { name: 'Stop Recording' })
  await expect(stopRecordingButton).toBeVisible()
  expect(await readMicrophoneRequestCount()).toBe(1)
  await page.waitForTimeout(1500)
  await stopRecordingButton.click()
  await expect(assistantPanel.getByRole('textbox', { name: 'Message the assistant' })).toHaveValue(testSpokenTranscriptText)
  expect(testProviderRequests.filter((providerRequest) => providerRequest.providerRequestPath === 'asr/transcribe')).toHaveLength(1)
})

test('beside Rewrite: Imagine from a selection and Transcribe arrive in the note as inline changes to accept', async ({ page }) => {
  const { testProviderRequests, refusedOutsideRequestUrls } = await playTestMetaProvider(page)
  await openSampleVaultWithMetaProvider(page)
  await page.getByRole('button', { name: 'MD Code', exact: true }).click()
  const noteEditorContent = page.locator('.cm-content').first()

  // Imagine: the selected words are the prompt; the picture goes on lines after them.
  let inlineCard = await openInlineCardOnLine(page, 'Try these')
  await expect(inlineCard.getByRole('button', { name: 'Rewrite' })).toBeVisible()
  await inlineCard.getByRole('button', { name: 'Imagine', exact: true }).click()
  await expect(inlineCard.getByRole('textbox', { name: 'Picture to make' })).toHaveValue('## Try these')
  await inlineCard.getByRole('textbox', { name: 'Picture to make' }).fill(testPictureAltText)
  await inlineCard.getByRole('button', { name: 'Imagine', exact: true }).click()
  await expect(inlineCard.getByRole('switch', { name: 'Remove C2PA' })).toHaveAttribute('aria-checked', 'true')
  await expect(inlineCard.locator('.papeliz-text-diff-added')).toContainText(`![${testPictureAltText}](Attachments/imagine-`)
  // The card is drawn inside the editor, so the note's own lines are checked: nothing changed yet.
  await expect(page.locator('.cm-line', { hasText: '](Attachments/imagine-' })).toHaveCount(0)
  await inlineCard.getByRole('button', { name: /^Accept/ }).click()
  await expect(inlineCard).toBeHidden()
  await expect(noteEditorContent).toContainText(`![${testPictureAltText}](Attachments/imagine-`)

  // Transcribe: the audio goes to Meta's transcription, the chat's model writes it up, and the
  // written text goes after the selected line.
  inlineCard = await openInlineCardOnLine(page, '# Start here')
  await inlineCard.getByRole('button', { name: 'Transcribe', exact: true }).click()
  await inlineCard.getByLabel('Transcribe an audio file here').setInputFiles({ name: 'memo.wav', mimeType: 'audio/wav', buffer: buildTestSpeechWav() })
  await expect(inlineCard.locator('.papeliz-text-diff-added')).toContainText(testWrittenUpText)
  await inlineCard.getByRole('switch', { name: 'Written Up' }).click()
  await expect(inlineCard.locator('.papeliz-text-diff-added')).toContainText(testSpokenTranscriptText)
  await inlineCard.getByRole('switch', { name: 'Written Up' }).click()
  await inlineCard.getByRole('button', { name: /^Accept/ }).click()
  await expect(inlineCard).toBeHidden()
  await expect(noteEditorContent).toContainText(testWrittenUpText)
  const writeUpRequest = testProviderRequests.find(
    (providerRequest) => providerRequest.providerRequestPath === 'chat/completions' && providerRequest.providerRequestBodyText.includes('clean written text'),
  )
  expect(writeUpRequest?.providerRequestBodyText).toContain(testSpokenTranscriptText)
  expect(writeUpRequest?.providerRequestBodyText).toContain(metaChatModelName)
  expect(refusedOutsideRequestUrls).toEqual([])
})

test('the note’s right-click menu offers Imagine Here and Transcribe Here, and Describe and Edit Picture on a picture', async ({ page }) => {
  const { refusedOutsideRequestUrls } = await playTestMetaProvider(page)
  await openSampleVaultWithMetaProvider(page)
  await page.getByRole('button', { name: 'MD Code', exact: true }).click()
  const noteActionsMenu = page.getByRole('menu', { name: 'Note actions' })
  const inlineCard = page.locator('.papeliz-inline-edit-host [role="dialog"]')

  // A right-click with no selection: Imagine Here puts the picture after the clicked line.
  await page.locator('.cm-line', { hasText: 'Try these' }).first().click({ button: 'right' })
  await expect(noteActionsMenu.getByRole('menuitem', { name: 'Describe Picture' })).toHaveCount(0)
  await noteActionsMenu.getByRole('menuitem', { name: 'Imagine Here' }).click()
  await expect(inlineCard).toHaveAttribute('aria-label', 'Imagine a picture here')
  await inlineCard.getByRole('textbox', { name: 'Picture to make' }).fill(testPictureAltText)
  await inlineCard.getByRole('button', { name: 'Imagine', exact: true }).click()
  await inlineCard.getByRole('button', { name: /^Accept/ }).click()
  await expect(inlineCard).toBeHidden()
  await expect(page.locator('.cm-line', { hasText: `![${testPictureAltText}](Attachments/imagine-` })).toHaveCount(1)

  // Transcribe Here, at the clicked line.
  await page.locator('.cm-line', { hasText: '# Start here' }).first().click({ button: 'right' })
  await noteActionsMenu.getByRole('menuitem', { name: 'Transcribe Here' }).click()
  await expect(inlineCard).toHaveAttribute('aria-label', 'Transcribe speech here')
  await inlineCard.getByLabel('Transcribe an audio file here').setInputFiles({ name: 'memo.wav', mimeType: 'audio/wav', buffer: buildTestSpeechWav() })
  await expect(inlineCard.locator('.papeliz-text-diff-added')).toContainText(testWrittenUpText)
  await inlineCard.getByRole('button', { name: /^Accept/ }).click()
  await expect(page.locator('.cm-line', { hasText: testWrittenUpText })).toHaveCount(1)

  // On the picture's line, the menu offers Describe Picture and Edit Picture.
  await page.locator('.cm-line', { hasText: '](Attachments/imagine-' }).first().click({ button: 'right' })
  await expect(noteActionsMenu.getByRole('menuitem', { name: 'Edit Picture' })).toBeVisible()
  await noteActionsMenu.getByRole('menuitem', { name: 'Describe Picture' }).click()
  await expect(inlineCard).toHaveAttribute('aria-label', 'Describe the picture')
  await expect(inlineCard.locator('.papeliz-text-diff')).toContainText(`![${testPictureAltText}](Attachments/imagine-`)
  await inlineCard.getByRole('button', { name: 'Reject' }).click()
  await expect(inlineCard).toBeHidden()
  expect(refusedOutsideRequestUrls).toEqual([])
})

test('Describe Picture writes a picture’s alt text with Meta’s vision, and Edit Picture points the link at a changed picture', async ({ page }) => {
  const { testProviderRequests, refusedOutsideRequestUrls } = await playTestMetaProvider(page)
  await openSampleVaultWithMetaProvider(page)
  await page.getByRole('button', { name: 'MD Code', exact: true }).click()
  const noteEditorContent = page.locator('.cm-content').first()
  let inlineCard = await openInlineCardOnLine(page, 'Welcome to the sample vault.')
  await inlineCard.getByRole('button', { name: 'Imagine', exact: true }).click()
  await inlineCard.getByRole('textbox', { name: 'Picture to make' }).fill('square')
  await inlineCard.getByRole('button', { name: 'Imagine', exact: true }).click()
  await inlineCard.getByRole('button', { name: /^Accept/ }).click()
  await expect(noteEditorContent).toContainText('![square](Attachments/imagine-')

  // Describe Picture: the picture goes to the chat's model as a picture, and its answer becomes the alt text.
  inlineCard = await openInlineCardOnLine(page, '![square](Attachments/imagine-')
  await inlineCard.getByRole('button', { name: 'Describe Picture' }).click()
  await expect(inlineCard.locator('.papeliz-text-diff')).toContainText(`![${testPictureAltText}](Attachments/imagine-`)
  const describeRequest = testProviderRequests.find(
    (providerRequest) => providerRequest.providerRequestPath === 'chat/completions' && providerRequest.providerRequestBodyText.includes('alt text'),
  )
  expect(describeRequest?.providerRequestBodyText).toContain('"type":"image_url"')
  expect(describeRequest?.providerRequestBodyText).toContain('data:image/')
  await inlineCard.getByRole('button', { name: /^Accept/ }).click()
  await expect(inlineCard).toBeHidden()
  await expect(noteEditorContent).toContainText(`![${testPictureAltText}](Attachments/imagine-`)
  await expect(noteEditorContent).not.toContainText('![square]')

  // Edit Picture: Meta's image edits get the picture and the change; the link points at the new file.
  const describedLinkText = (await page.locator('.cm-line', { hasText: `![${testPictureAltText}](` }).first().textContent()) ?? ''
  inlineCard = await openInlineCardOnLine(page, `![${testPictureAltText}](`)
  await inlineCard.getByRole('button', { name: 'Edit Picture' }).click()
  await inlineCard.getByRole('textbox', { name: 'Change to make in the picture' }).fill('Make it red')
  await inlineCard.getByRole('button', { name: 'Edit Picture' }).click()
  await expect(inlineCard.getByRole('switch', { name: 'Remove C2PA' })).toHaveAttribute('aria-checked', 'true')
  const editRequest = testProviderRequests.find((providerRequest) => providerRequest.providerRequestPath === 'images/edits')
  expect(JSON.parse(editRequest?.providerRequestBodyText ?? '{}')).toMatchObject({ model: 'muse-image-1.0', prompt: 'Make it red', n: 1 })
  expect(editRequest?.providerRequestBodyText).toContain('"images":[{"image_url":"data:image/png;base64,')
  await inlineCard.getByRole('button', { name: /^Accept/ }).click()
  await expect(inlineCard).toBeHidden()
  const editedLinkText = (await page.locator('.cm-line', { hasText: `![${testPictureAltText}](` }).first().textContent()) ?? ''
  expect(editedLinkText).toMatch(/^!\[A blue square on white paper\]\(Attachments\/imagine-.+\)$/)
  expect(editedLinkText).not.toBe(describedLinkText)
  expect(refusedOutsideRequestUrls).toEqual([])
})
