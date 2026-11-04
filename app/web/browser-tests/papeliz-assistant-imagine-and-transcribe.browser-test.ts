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
// A prompt the test provider turns down, to see the problem in place of the pictures.
const testTurnedDownPromptText = 'A picture the test provider turns down'
// Imagine's Ask: the chat model's answer, with a prompt worth drawing in its ```draw block.
const testAskDrawPromptText = 'A watercolor lighthouse at dawn, soft pink sky'
const testAskAnswerText = `Soft dawn light suits a lighthouse.\n\n\`\`\`draw\n${testAskDrawPromptText}\n\`\`\``

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
      if (providerRequestBodyText.includes(testTurnedDownPromptText)) {
        return route.fulfill({ status: 400, headers: testProviderCorsHeaders, json: { error: { message: 'The test provider turned this prompt down.' } } })
      }
      // As many pictures as the request's `n` asks for.
      const requestedPictureCount = Number((JSON.parse(providerRequestBodyText.length > 0 ? providerRequestBodyText : '{}') as { n?: number }).n ?? 1)
      return route.fulfill({
        status: 200,
        headers: testProviderCorsHeaders,
        json: { data: Array.from({ length: requestedPictureCount }, () => ({ b64_json: buildTestPictureWithContentCredentials().toString('base64') })) },
      })
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
          : providerRequestBodyText.includes('before they draw it')
            ? testAskAnswerText
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

// Scrolls the note by its own scrolling box, the first one around the editor that has room to scroll,
// as reading on would.
async function scrollNoteBy(page: Page, scrolledPixels: number): Promise<void> {
  await page
    .locator('.cm-content')
    .first()
    .evaluate((noteContentElement, pixelsToScroll) => {
      let noteScrollingElement = noteContentElement.parentElement
      while (noteScrollingElement !== null && noteScrollingElement.scrollHeight <= noteScrollingElement.clientHeight) noteScrollingElement = noteScrollingElement.parentElement
      noteScrollingElement?.scrollBy(0, pixelsToScroll)
    }, scrolledPixels)
}

interface PapelizTestElementBox {
  x: number
  y: number
  width: number
  height: number
}

// Where each element is, all read in the same frame, so a new entry still settling into the thread can't
// skew a comparison between them.
async function readElementBoxesInOneFrame(page: Page, boxedElementLocators: readonly Locator[]): Promise<PapelizTestElementBox[]> {
  const boxedElementHandles = await Promise.all(boxedElementLocators.map((boxedElementLocator) => boxedElementLocator.elementHandle()))
  return page.evaluate(
    (boxedElements) =>
      boxedElements.map((boxedElement) => {
        const boxedElementRect = boxedElement!.getBoundingClientRect()
        return { x: boxedElementRect.x, y: boxedElementRect.y, width: boxedElementRect.width, height: boxedElementRect.height }
      }),
    boxedElementHandles,
  )
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
  // Imagine a Picture is under +, and waits until there is something to picture.
  await assistantPanel.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('menu', { name: 'Add' }).getByRole('menuitem', { name: 'Imagine a Picture' })).toHaveAttribute('aria-disabled', 'true')
  await page.keyboard.press('Escape')
  await assistantPanel.getByRole('textbox', { name: 'Message the assistant' }).fill('A blue square on white paper')
  await assistantPanel.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByRole('menu', { name: 'Add' }).getByRole('menuitem', { name: 'Imagine a Picture' }).click()

  const chatPictures = assistantPanel.getByRole('region', { name: 'Imagine: A blue square on white paper' })
  const chatPicture = chatPictures.getByRole('img', { name: 'A blue square on white paper' })
  await expect(chatPicture).toBeVisible()
  await expect.poll(() => chatPicture.evaluate((pictureElement: HTMLImageElement) => pictureElement.naturalWidth)).toBe(16)
  await expect(chatPictures.getByRole('switch', { name: 'Remove Metadata' })).toHaveAttribute('aria-checked', 'true')
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
  await expect(chatPictures.getByText(/^In the vault: imagine-/)).toBeVisible()
  expectPictureCleaned(await readBlobPictureBytes(page, (await chatPicture.getAttribute('src')) ?? ''))

  // The Imagine tab's thread keeps every picture made, wherever it was made.
  await assistantPanel.getByRole('tab', { name: 'Imagine', exact: true }).click()
  const imagineThreadEntry = assistantPanel.getByRole('region', { name: 'Imagine: A blue square on white paper' })
  await expect(imagineThreadEntry.getByText('From the Notes tab')).toBeVisible()
  await expect(imagineThreadEntry.getByRole('img', { name: 'A blue square on white paper' })).toBeVisible()
  expect(refusedOutsideRequestUrls).toEqual([])
})

test('the Imagine tab is a thread: an example fills the box, Enter sends, and the picture shows under the prompt with Put in Note', async ({ page }) => {
  const { testProviderRequests, refusedOutsideRequestUrls } = await playTestMetaProvider(page)
  await openSampleVaultWithMetaProvider(page)
  const assistantPanel = page.getByRole('complementary', { name: 'AI Assistant' })
  await assistantPanel.getByRole('tab', { name: 'Imagine', exact: true }).click()
  const promptBox = assistantPanel.getByRole('textbox', { name: 'Describe a picture' })
  const sendButton = assistantPanel.getByRole('button', { name: 'Send', exact: true })
  // The empty thread says what Imagine does; an example fills the box and sends nothing.
  await expect(assistantPanel.getByText('Nothing is sent until Send.', { exact: false })).toBeVisible()
  await expect(sendButton).toBeDisabled()
  await assistantPanel.getByRole('button', { name: 'A watercolor lighthouse at dawn' }).click()
  await expect(promptBox).toHaveValue('A watercolor lighthouse at dawn')
  await expect(promptBox).toBeFocused()
  expect(countProviderRequests(testProviderRequests, 'images/generations')).toBe(0)
  // Shift+Enter starts a new line; Enter sends.
  await promptBox.fill('A red fox')
  await promptBox.press('Shift+Enter')
  await promptBox.pressSequentially('in snow')
  await expect(promptBox).toHaveValue('A red fox\nin snow')
  expect(countProviderRequests(testProviderRequests, 'images/generations')).toBe(0)
  await expect(assistantPanel.getByRole('button', { name: 'Picture model: muse-image-1.0' })).toBeVisible()
  await promptBox.press('Enter')
  await expect(promptBox).toHaveValue('')

  const foxEntry = assistantPanel.getByRole('region', { name: /^Imagine: A red fox\s+in snow$/ })
  const foxPicture = foxEntry.getByRole('img', { name: /^A red fox\s+in snow$/ })
  await expect(foxPicture).toBeVisible()
  // One picture takes the reply column's whole width, with no box and no line about what it carries:
  // the model on the left and Remove Metadata at the right of one line.
  const foxCard = foxEntry.getByRole('listitem')
  const foxRemoveMetadataSwitch = foxCard.getByRole('switch', { name: 'Remove Metadata' })
  await expect(foxRemoveMetadataSwitch).toHaveAttribute('aria-checked', 'true')
  await expect(foxCard.getByText('C2PA', { exact: true })).toHaveCount(0)
  await expect(foxCard.getByText(/^Carries /)).toHaveCount(0)
  const [foxPicturesListBox, foxCardBox, foxModelLineBox, foxRemoveMetadataSwitchBox] = await readElementBoxesInOneFrame(page, [
    foxEntry.getByRole('list', { name: 'Pictures' }),
    foxCard,
    foxCard.getByText('muse-image-1.0 · Meta Model API'),
    foxRemoveMetadataSwitch,
  ])
  expect(foxCardBox!.width).toBeGreaterThan(foxPicturesListBox!.width - 1)
  expect(Math.abs(foxModelLineBox!.y + foxModelLineBox!.height / 2 - (foxRemoveMetadataSwitchBox!.y + foxRemoveMetadataSwitchBox!.height / 2))).toBeLessThan(6)
  expect(foxCardBox!.x + foxCardBox!.width - (foxRemoveMetadataSwitchBox!.x + foxRemoveMetadataSwitchBox!.width)).toBeLessThan(8)
  expect(JSON.parse(testProviderRequests.find((providerRequest) => providerRequest.providerRequestPath === 'images/generations')?.providerRequestBodyText ?? '{}')).toMatchObject({
    model: 'muse-image-1.0',
    prompt: 'A red fox\nin snow',
    n: 1,
  })
  // The box stays at the bottom of the panel, below the thread.
  const panelBox = await assistantPanel.boundingBox()
  const promptBoxBox = await promptBox.boundingBox()
  const foxEntryBox = await foxEntry.boundingBox()
  expect(panelBox !== null && promptBoxBox !== null && foxEntryBox !== null).toBe(true)
  expect(panelBox!.y + panelBox!.height - (promptBoxBox!.y + promptBoxBox!.height)).toBeLessThan(90)
  expect(foxEntryBox!.y).toBeLessThan(promptBoxBox!.y)

  // A second prompt joins below the first; a refused one shows its problem in its own place.
  await promptBox.fill('A blue square on white paper')
  await sendButton.click()
  await expect(assistantPanel.getByRole('region', { name: 'Imagine: A blue square on white paper' }).getByRole('img')).toBeVisible()
  await promptBox.fill(testTurnedDownPromptText)
  await sendButton.click()
  await expect(assistantPanel.getByRole('region', { name: `Imagine: ${testTurnedDownPromptText}` }).getByRole('alert')).toContainText('turned this prompt down')
  const threadEntryNames = await assistantPanel.getByRole('region', { name: /^Imagine: / }).evaluateAll((entryElements) => entryElements.map((entryElement) => entryElement.getAttribute('aria-label')))
  expect(threadEntryNames).toEqual(['Imagine: A red fox\nin snow', 'Imagine: A blue square on white paper', `Imagine: ${testTurnedDownPromptText}`])

  await foxEntry.getByRole('button', { name: 'Put in Note' }).click()
  const pictureDiffCard = foxEntry.getByRole('region', { name: 'Change to Start here' })
  await expect(pictureDiffCard.locator('.papeliz-text-diff-added')).toContainText('](Attachments/imagine-')
  await pictureDiffCard.getByRole('button', { name: 'Accept', exact: true }).click()
  await expect(pictureDiffCard).toBeHidden()
  await expect(foxEntry.getByText(/^In the vault: imagine-/)).toBeVisible()
  expectPictureCleaned(await readBlobPictureBytes(page, (await foxPicture.getAttribute('src')) ?? ''))
  await page.getByRole('button', { name: 'MD Code', exact: true }).click()
  await expect(page.locator('.cm-content').first()).toContainText('](Attachments/imagine-')
  expect(refusedOutsideRequestUrls).toEqual([])
})

// OpenAI, added from Draw's picture model menu (Models for Transcribe and Draw opens Settings › AI
// Provider at that section) as a second provider, its base URL changed to the provider the test plays.
async function addTestOpenAiProviderFromDraw(page: Page, assistantPanel: Locator): Promise<void> {
  await assistantPanel.getByRole('button', { name: /^Picture model: / }).click()
  await page.getByRole('menu', { name: 'Picture Model' }).getByRole('menuitem', { name: 'Models for Transcribe and Draw' }).click()
  const settingsPanel = page.getByRole('dialog', { name: 'Settings' })
  await expect(settingsPanel.getByRole('region', { name: 'Models for Transcribe and Draw' })).toBeInViewport()
  await settingsPanel.getByRole('button', { name: 'Add Provider', exact: true }).click()
  const addProviderDialog = page.getByRole('dialog', { name: 'Add Provider' })
  await addProviderDialog.getByRole('button', { name: /^Provider / }).click()
  await addProviderDialog.getByRole('option', { name: /^OpenAI/ }).click()
  await expect(addProviderDialog.getByRole('button', { name: /^Provider OpenAI/ })).toBeVisible()
  await addProviderDialog.getByLabel(/^API Key/).fill(testProviderApiKey)
  await addProviderDialog.getByRole('button', { name: /^Advanced/ }).click()
  await addProviderDialog.getByRole('textbox', { name: 'Base URL' }).fill(testProviderBaseUrl)
  await addProviderDialog.getByRole('button', { name: 'Load Models', exact: true }).click()
  const chatModelSwitch = addProviderDialog.getByRole('switch', { name: metaChatModelName })
  await expect(chatModelSwitch).toBeVisible()
  if ((await chatModelSwitch.getAttribute('aria-checked')) !== 'true') await chatModelSwitch.click()
  await addProviderDialog.getByRole('button', { name: 'Test Connection', exact: true }).click()
  await expect(addProviderDialog.getByText(`Connected. ${metaChatModelName} answered`, { exact: false })).toBeVisible()
  await addProviderDialog.getByRole('button', { name: 'Add Provider', exact: true }).click()
  await expect(addProviderDialog).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(settingsPanel).toBeHidden()
}

test('Draw’s aspect ratio menu: 16:9 is sent as the model’s size, and a model that can’t make it doesn’t offer it', async ({ page }) => {
  const { testProviderRequests, refusedOutsideRequestUrls } = await playTestMetaProvider(page)
  await openSampleVaultWithMetaProvider(page)
  const assistantPanel = page.getByRole('complementary', { name: 'AI Assistant' })
  await assistantPanel.getByRole('tab', { name: 'Imagine', exact: true }).click()
  const aspectRatioChip = assistantPanel.getByRole('button', { name: /^Aspect ratio: / })
  await expect(aspectRatioChip).toHaveAccessibleName('Aspect ratio: 1:1, 1 picture')
  await expect(aspectRatioChip).toContainText('1:1 ·')

  // One plain list of ratios, each with its outline, then the count under its own heading.
  await aspectRatioChip.click()
  const aspectRatioMenu = page.getByRole('menu', { name: 'Aspect Ratio and Pictures' })
  await expect(aspectRatioMenu.getByRole('menuitemradio')).toHaveText(['Auto', '1:1', '2:3', '3:2', '16:9', '9:16', '1 Picture', '2 Pictures', '3 Pictures', '4 Pictures'])
  await expect(aspectRatioMenu.getByRole('menuitemradio', { name: '1:1', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(aspectRatioMenu.getByRole('menuitemradio', { name: '16:9', exact: true }).locator('svg rect')).toHaveAttribute('height', '10.125')
  await expect(aspectRatioMenu.getByText('Shape', { exact: true })).toHaveCount(0)
  await aspectRatioMenu.getByRole('menuitemradio', { name: '16:9', exact: true }).click()
  await expect(aspectRatioChip).toHaveAccessibleName('Aspect ratio: 16:9, 1 picture')

  const promptBox = assistantPanel.getByRole('textbox', { name: 'Describe a picture' })
  await promptBox.fill('A wide valley at dusk')
  await promptBox.press('Enter')
  await expect(assistantPanel.getByRole('region', { name: 'Imagine: A wide valley at dusk' }).getByRole('img')).toBeVisible()
  const readImagesRequestBodies = () =>
    testProviderRequests
      .filter((providerRequest) => providerRequest.providerRequestPath === 'images/generations')
      .map((providerRequest) => JSON.parse(providerRequest.providerRequestBodyText) as Record<string, unknown>)
  expect(readImagesRequestBodies().at(-1)).toMatchObject({ model: 'muse-image-1.0', prompt: 'A wide valley at dusk', size: '1536x864' })

  // OpenAI's chatgpt-image-latest makes only the standard sizes: no 16:9 or 9:16, and the picture is 1:1.
  await addTestOpenAiProviderFromDraw(page, assistantPanel)
  await assistantPanel.getByRole('button', { name: /^Picture model: / }).click()
  await page.getByRole('menu', { name: 'Picture Model' }).getByRole('menuitemradio', { name: 'chatgpt-image-latest' }).click()
  await expect(aspectRatioChip).toHaveAccessibleName('Aspect ratio: 1:1, 1 picture')
  await aspectRatioChip.click()
  await expect(aspectRatioMenu.getByRole('menuitemradio')).toHaveText(['Auto', '1:1', '2:3', '3:2', '1 Picture', '2 Pictures', '3 Pictures', '4 Pictures'])
  await page.keyboard.press('Escape')

  // gpt-image-2 takes any size, so the 16:9 chosen before comes back and is sent.
  await assistantPanel.getByRole('button', { name: /^Picture model: / }).click()
  await page.getByRole('menu', { name: 'Picture Model' }).getByRole('menuitemradio', { name: 'gpt-image-2' }).click()
  await expect(aspectRatioChip).toHaveAccessibleName('Aspect ratio: 16:9, 1 picture')
  await promptBox.fill('A tall lighthouse in fog')
  await promptBox.press('Enter')
  await expect(assistantPanel.getByRole('region', { name: 'Imagine: A tall lighthouse in fog' }).getByRole('img')).toBeVisible()
  expect(readImagesRequestBodies().at(-1)).toMatchObject({ model: 'gpt-image-2', prompt: 'A tall lighthouse in fog', size: '1536x864' })
  expect(refusedOutsideRequestUrls).toEqual([])
})

test('Imagine’s Ask talks a picture through with the chat model, and Draw This puts its prompt in Draw without sending it', async ({ page }) => {
  const { testProviderRequests, refusedOutsideRequestUrls } = await playTestMetaProvider(page)
  await openSampleVaultWithMetaProvider(page)
  const assistantPanel = page.getByRole('complementary', { name: 'AI Assistant' })
  await assistantPanel.getByRole('tab', { name: 'Imagine', exact: true }).click()
  // Imagine opens on Draw.
  await expect(assistantPanel.getByRole('tab', { name: 'Draw', exact: true })).toHaveAttribute('aria-selected', 'true')
  await assistantPanel.getByRole('tab', { name: 'Ask', exact: true }).click()
  const questionBox = assistantPanel.getByRole('textbox', { name: 'Ask about a picture' })
  await expect(assistantPanel.getByRole('button', { name: `Model: ${metaChatModelName}` })).toBeVisible()
  await questionBox.fill('What light suits a lighthouse?')
  await questionBox.press('Enter')
  await expect(questionBox).toHaveValue('')

  const askAnswer = assistantPanel.getByRole('region', { name: 'Answer' })
  await expect(askAnswer.getByText('Soft dawn light suits a lighthouse.')).toBeVisible()
  await expect(askAnswer.getByText(testAskDrawPromptText)).toBeVisible()
  const askRequest = testProviderRequests.filter((providerRequest) => providerRequest.providerRequestPath === 'chat/completions').at(-1)
  const askRequestBody = JSON.parse(askRequest?.providerRequestBodyText ?? '{}') as { model: string; messages: Array<{ role: string; content: string }>; tools?: unknown }
  expect(askRequestBody.model).toBe(metaChatModelName)
  expect(askRequestBody.messages[0]?.content).toContain('You cannot draw or show pictures')
  expect(askRequestBody.messages.at(-1)).toEqual({ role: 'user', content: 'What light suits a lighthouse?' })
  expect(askRequestBody.tools).toBeUndefined()

  await askAnswer.getByRole('button', { name: 'Draw This' }).click()
  await expect(assistantPanel.getByRole('tab', { name: 'Draw', exact: true })).toHaveAttribute('aria-selected', 'true')
  const promptBox = assistantPanel.getByRole('textbox', { name: 'Describe a picture' })
  await expect(promptBox).toHaveValue(testAskDrawPromptText)
  await expect(promptBox).toBeFocused()
  expect(countProviderRequests(testProviderRequests, 'images/generations')).toBe(0)
  // Ask keeps its own talk while the page is open.
  await assistantPanel.getByRole('tab', { name: 'Ask', exact: true }).click()
  await expect(assistantPanel.getByRole('region', { name: 'Answer' }).getByText('Soft dawn light suits a lighthouse.')).toBeVisible()
  expect(refusedOutsideRequestUrls).toEqual([])
})

// Watches, from now on, every scroll of the page or of a box around the assistant panel (the app's shell),
// and keeps the largest offset any of them reached. The panel's own lists, inside it, aren't watched.
async function watchPageAndShellScrollOffsets(page: Page, assistantPanel: Locator): Promise<() => Promise<number>> {
  await assistantPanel.evaluate((assistantPanelElement) => {
    const shellElements: Element[] = []
    for (let shellElement: Element | null = assistantPanelElement; shellElement !== null; shellElement = shellElement.parentElement) shellElements.push(shellElement)
    const pageAndShellScrollWatch = { largestPageOrShellScrollOffset: Math.max(Math.abs(window.scrollX), Math.abs(window.scrollY)) }
    ;(window as unknown as { papelizPageAndShellScrollWatch: typeof pageAndShellScrollWatch }).papelizPageAndShellScrollWatch = pageAndShellScrollWatch
    document.addEventListener(
      'scroll',
      (scrollEvent) => {
        const scrolledElement = scrollEvent.target === document ? document.scrollingElement : (scrollEvent.target as Element)
        if (scrolledElement === null || !shellElements.includes(scrolledElement)) return
        pageAndShellScrollWatch.largestPageOrShellScrollOffset = Math.max(pageAndShellScrollWatch.largestPageOrShellScrollOffset, Math.abs(scrolledElement.scrollTop), Math.abs(scrolledElement.scrollLeft))
      },
      { capture: true },
    )
  })
  return () => page.evaluate(() => (window as unknown as { papelizPageAndShellScrollWatch: { largestPageOrShellScrollOffset: number } }).papelizPageAndShellScrollWatch.largestPageOrShellScrollOffset)
}

// How many pixels clearly differ between two pictures of the same place, read with the page's own picture
// decoding. A spring of the window shifts everything by many pixels; drawing noise changes a few by a shade.
async function countClearlyChangedPixels(page: Page, firstPicturePng: Buffer, secondPicturePng: Buffer): Promise<number> {
  return page.evaluate(
    async ([firstPictureBase64, secondPictureBase64]) => {
      const readPicturePixels = async (pictureBase64: string) => {
        const pictureBitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(pictureBase64), (pictureCharacter) => pictureCharacter.charCodeAt(0))], { type: 'image/png' }))
        const pictureCanvas = new OffscreenCanvas(pictureBitmap.width, pictureBitmap.height)
        const pictureCanvasContext = pictureCanvas.getContext('2d')!
        pictureCanvasContext.drawImage(pictureBitmap, 0, 0)
        return pictureCanvasContext.getImageData(0, 0, pictureBitmap.width, pictureBitmap.height).data
      }
      const [firstPicturePixels, secondPicturePixels] = await Promise.all([readPicturePixels(firstPictureBase64), readPicturePixels(secondPictureBase64)])
      let clearlyChangedPixelCount = 0
      for (let pixelByteIndex = 0; pixelByteIndex < firstPicturePixels.length; pixelByteIndex += 4) {
        const redChange = Math.abs(firstPicturePixels[pixelByteIndex]! - secondPicturePixels[pixelByteIndex]!)
        const greenChange = Math.abs(firstPicturePixels[pixelByteIndex + 1]! - secondPicturePixels[pixelByteIndex + 1]!)
        const blueChange = Math.abs(firstPicturePixels[pixelByteIndex + 2]! - secondPicturePixels[pixelByteIndex + 2]!)
        if (Math.max(redChange, greenChange, blueChange) > 48) clearlyChangedPixelCount += 1
      }
      return clearlyChangedPixelCount
    },
    [firstPicturePng.toString('base64'), secondPicturePng.toString('base64')] as const,
  )
}

// Wheel turns past the end of a list, with the pointer over it, must leave the window itself where it is.
// Edge on Windows springs the whole page, title bar and all, when a turn runs past the end, and no scroll
// offset shows it, so the window's left edge (the file list) is compared, picture by picture, with how it
// looked before the turns. The pictures are all taken first, so comparing them can't slow the turns down.
async function expectWindowStillUnderWheelTurnsPastListEnd(page: Page, wheeledListLocator: Locator): Promise<void> {
  const viewportSize = page.viewportSize()!
  const wheeledListBox = (await wheeledListLocator.boundingBox())!
  const wheeledListShownTop = Math.max(wheeledListBox.y, 0)
  const wheeledListShownBottom = Math.min(wheeledListBox.y + wheeledListBox.height, viewportSize.height)
  await page.mouse.move(wheeledListBox.x + wheeledListBox.width / 2, (wheeledListShownTop + wheeledListShownBottom) / 2)
  // To the list's end first, then a beat for its own scrolling to finish.
  for (let wheelTurnIndex = 0; wheelTurnIndex < 12; wheelTurnIndex += 1) await page.mouse.wheel(0, 400)
  await page.waitForTimeout(1000)
  const windowEdgeClip = { x: 0, y: 0, width: 240, height: viewportSize.height }
  const windowEdgeBeforeTurns = await page.screenshot({ clip: windowEdgeClip })
  const windowEdgesDuringTurns: Buffer[] = []
  for (let wheelTurnIndex = 0; wheelTurnIndex < 3; wheelTurnIndex += 1) {
    await page.mouse.wheel(0, 140)
    for (let pictureIndex = 0; pictureIndex < 3; pictureIndex += 1) windowEdgesDuringTurns.push(await page.screenshot({ clip: windowEdgeClip }))
  }
  const clearlyChangedPixelCounts: number[] = []
  for (const windowEdgeDuringTurns of windowEdgesDuringTurns) clearlyChangedPixelCounts.push(await countClearlyChangedPixels(page, windowEdgeBeforeTurns, windowEdgeDuringTurns))
  expect(clearlyChangedPixelCounts.filter((clearlyChangedPixelCount) => clearlyChangedPixelCount > 20)).toEqual([])
}

test('only Imagine’s own list moves: Draw This, a picture landing and Put in Note leave the page and the shell still, and wheel turns past a list’s end don’t spring the window', { tag: '@papeliz-desktop-app' }, async ({ page }) => {
  const { refusedOutsideRequestUrls } = await playTestMetaProvider(page)
  await openSampleVaultWithMetaProvider(page)
  const assistantPanel = page.getByRole('complementary', { name: 'AI Assistant' })
  await assistantPanel.getByRole('tab', { name: 'Imagine', exact: true }).click()
  await assistantPanel.getByRole('tab', { name: 'Ask', exact: true }).click()
  const questionBox = assistantPanel.getByRole('textbox', { name: 'Ask about a picture' })
  await questionBox.fill('What light suits a lighthouse?')
  await questionBox.press('Enter')
  const askAnswer = assistantPanel.getByRole('region', { name: 'Answer' })
  await expect(askAnswer.getByText(testAskDrawPromptText)).toBeVisible()

  // Draw This: Draw opens with the prompt in its focused box.
  const readLargestPageOrShellScrollOffset = await watchPageAndShellScrollOffsets(page, assistantPanel)
  await askAnswer.getByRole('button', { name: 'Draw This' }).click()
  const promptBox = assistantPanel.getByRole('textbox', { name: 'Describe a picture' })
  await expect(promptBox).toHaveValue(testAskDrawPromptText)
  await expect(promptBox).toBeFocused()
  await page.waitForTimeout(800)
  expect(await readLargestPageOrShellScrollOffset()).toBe(0)
  const drawSection = assistantPanel.getByRole('tabpanel', { name: 'Draw' })
  await expectWindowStillUnderWheelTurnsPastListEnd(page, drawSection)
  await expectWindowStillUnderWheelTurnsPastListEnd(page, page.locator('.cm-content').first())

  // The picture lands, and Draw's list scrolls to it; then Put in Note's change comes into view in the list.
  await promptBox.press('Enter')
  const drawnPictureEntry = assistantPanel.getByRole('region', { name: `Imagine: ${testAskDrawPromptText}` })
  const drawnPicture = drawnPictureEntry.getByRole('img')
  await expect(drawnPicture).toBeVisible()
  await page.waitForTimeout(800)
  await expect(drawnPicture).toBeInViewport()
  expect(await readLargestPageOrShellScrollOffset()).toBe(0)
  await drawnPictureEntry.getByRole('button', { name: 'Put in Note' }).click()
  const pictureDiffCard = drawnPictureEntry.getByRole('region', { name: 'Change to Start here' })
  await expect(pictureDiffCard).toBeVisible()
  await page.waitForTimeout(800)
  await expect(pictureDiffCard.getByRole('button', { name: 'Accept', exact: true })).toBeInViewport()
  expect(await readLargestPageOrShellScrollOffset()).toBe(0)
  await expectWindowStillUnderWheelTurnsPastListEnd(page, drawSection)
  await expectWindowStillUnderWheelTurnsPastListEnd(page, page.locator('.cm-content').first())
  expect(await readLargestPageOrShellScrollOffset()).toBe(0)
  expect(refusedOutsideRequestUrls).toEqual([])
})

test('Imagine’s Gallery lists every picture newest first, with its actions, a lightbox and Show in Draw', async ({ page }) => {
  const { refusedOutsideRequestUrls } = await playTestMetaProvider(page)
  await openSampleVaultWithMetaProvider(page)
  const assistantPanel = page.getByRole('complementary', { name: 'AI Assistant' })
  await assistantPanel.getByRole('tab', { name: 'Imagine', exact: true }).click()
  // Empty, Gallery says what shows there and goes to Draw.
  await assistantPanel.getByRole('tab', { name: 'Gallery', exact: true }).click()
  await expect(assistantPanel.getByText('Every picture you draw or bring in shows here, newest first.')).toBeVisible()
  await assistantPanel.getByRole('button', { name: 'Go to Draw' }).click()
  await expect(assistantPanel.getByRole('tab', { name: 'Draw', exact: true })).toHaveAttribute('aria-selected', 'true')

  const promptBox = assistantPanel.getByRole('textbox', { name: 'Describe a picture' })
  for (const sentPromptText of ['A red fox', 'A blue square on white paper']) {
    await promptBox.fill(sentPromptText)
    await promptBox.press('Enter')
    await expect(assistantPanel.getByRole('region', { name: `Imagine: ${sentPromptText}` }).getByRole('img')).toBeVisible()
  }
  await assistantPanel.getByLabel('Bring in a picture').setInputFiles({ name: 'diagram.png', mimeType: 'image/png', buffer: buildTestPictureWithContentCredentials() })
  await expect(assistantPanel.getByRole('region', { name: 'Brought in: diagram.png' }).getByRole('img')).toBeVisible()

  await assistantPanel.getByRole('tab', { name: 'Gallery', exact: true }).click()
  const galleryList = assistantPanel.getByRole('list', { name: 'Gallery' })
  await expect(galleryList.getByRole('listitem')).toHaveCount(3)
  expect(await galleryList.getByRole('listitem').evaluateAll((tileElements) => tileElements.map((tileElement) => tileElement.getAttribute('aria-label')))).toEqual([
    'diagram.png',
    'Picture of A blue square on white paper',
    'Picture of A red fox',
  ])
  const foxTile = galleryList.getByRole('listitem', { name: 'Picture of A red fox' })
  await expect(foxTile.getByText('A red fox', { exact: true })).toBeVisible()
  await expect(foxTile.getByText('muse-image-1.0 · Meta Model API')).toBeVisible()
  await expect(galleryList.getByRole('listitem', { name: 'diagram.png' }).getByText('Brought in: diagram.png')).toBeVisible()
  await expect(foxTile.getByRole('switch', { name: 'Remove Metadata' })).toHaveAttribute('aria-checked', 'true')
  await expect(foxTile.getByRole('button', { name: 'Put in Note' })).toBeEnabled()
  await foxTile.getByRole('button', { name: 'Save to Vault' }).click()
  await expect(foxTile.getByText(/^In the vault: imagine-\d{4}-\d{2}-\d{2}-\d{4}-a-red-fox\.png$/)).toBeVisible()
  expectPictureCleaned(await readBlobPictureBytes(page, (await foxTile.getByRole('img').getAttribute('src')) ?? ''))

  // Pressed, a picture opens in the lightbox with its whole prompt; Show in Draw goes to its place in the thread.
  await foxTile.getByRole('button', { name: 'A red fox' }).click()
  const largerView = page.getByRole('dialog', { name: 'A red fox' })
  await expect(largerView.getByRole('img', { name: 'A red fox' })).toBeVisible()
  await largerView.getByRole('button', { name: 'Show in Draw' }).click()
  await expect(largerView).toBeHidden()
  await expect(assistantPanel.getByRole('tab', { name: 'Draw', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(assistantPanel.getByRole('region', { name: 'Imagine: A red fox' })).toBeInViewport()
  expect(refusedOutsideRequestUrls).toEqual([])
})

// How far Draw's thread is scrolled, by its own scrolling box: the first one around the entry that has room.
async function readDrawThreadScroll(drawThreadEntry: Locator): Promise<{ drawThreadScrollTop: number; isDrawThreadScrollable: boolean }> {
  return drawThreadEntry.evaluate((drawThreadEntryElement) => {
    let drawThreadScrollingElement = drawThreadEntryElement.parentElement
    while (drawThreadScrollingElement !== null && drawThreadScrollingElement.scrollHeight <= drawThreadScrollingElement.clientHeight) drawThreadScrollingElement = drawThreadScrollingElement.parentElement
    return { drawThreadScrollTop: drawThreadScrollingElement?.scrollTop ?? 0, isDrawThreadScrollable: drawThreadScrollingElement !== null && drawThreadScrollingElement !== document.documentElement }
  })
}

// The tooltip bubble, drawn over the whole page; screen readers get its words from the switch instead.
function readTooltipBubble(page: Page, tooltipBubbleText: string): Locator {
  return page.locator('body > div[aria-hidden="true"]', { hasText: tooltipBubbleText })
}

async function sendDrawPrompts(assistantPanel: Locator, drawPromptTexts: readonly string[]): Promise<void> {
  await assistantPanel.getByRole('tab', { name: 'Imagine', exact: true }).click()
  const promptBox = assistantPanel.getByRole('textbox', { name: 'Describe a picture' })
  for (const drawPromptText of drawPromptTexts) {
    await promptBox.fill(drawPromptText)
    await promptBox.press('Enter')
    await expect(assistantPanel.getByRole('region', { name: `Imagine: ${drawPromptText}` }).getByRole('img')).toBeVisible()
  }
}

test('a picture in Draw opens in a lightbox by mouse and by keyboard, and its card has Remove Metadata’s tooltip and full-width buttons', async ({ page }) => {
  const { refusedOutsideRequestUrls } = await playTestMetaProvider(page)
  await openSampleVaultWithMetaProvider(page)
  const assistantPanel = page.getByRole('complementary', { name: 'AI Assistant' })
  await sendDrawPrompts(assistantPanel, ['A red fox', 'A blue square on white paper'])
  const foxEntry = assistantPanel.getByRole('region', { name: 'Imagine: A red fox' })
  const foxCard = foxEntry.getByRole('listitem', { name: 'Picture of A red fox' })
  const foxPictureButton = foxCard.getByRole('button', { name: 'A red fox' })
  await foxCard.scrollIntoViewIfNeeded()

  // Put in Note and Save to Vault fill the card's width, one under the other.
  const [foxCardBox, putInNoteBox, saveToVaultBox] = await readElementBoxesInOneFrame(page, [
    foxCard,
    foxCard.getByRole('button', { name: 'Put in Note' }),
    foxCard.getByRole('button', { name: 'Save to Vault' }),
  ])
  expect(putInNoteBox!.width).toBeGreaterThan(foxCardBox!.width - 20)
  expect(Math.abs(saveToVaultBox!.width - putInNoteBox!.width)).toBeLessThan(1)
  expect(saveToVaultBox!.y).toBeGreaterThanOrEqual(putInNoteBox!.y + putInNoteBox!.height)

  // Remove Metadata says what it removes: on hover, on keyboard focus, and to screen readers.
  const removeMetadataSwitch = foxCard.getByRole('switch', { name: 'Remove Metadata' })
  await expect(removeMetadataSwitch).toHaveAccessibleDescription(
    'Removed when saved: C2PA content credentials, EXIF (camera, date and location), XMP and IPTC, text chunks and comments. The picture itself is untouched.',
  )
  const removeMetadataTooltip = readTooltipBubble(page, 'The picture itself is untouched.')
  await removeMetadataSwitch.hover()
  await expect(removeMetadataTooltip).toBeVisible()
  for (const removedMetadataLine of ['C2PA content credentials', 'EXIF: camera, date and location', 'XMP and IPTC', 'Text chunks and comments']) {
    await expect(removeMetadataTooltip).toContainText(removedMetadataLine)
  }
  await page.mouse.move(1, 1)
  await expect(removeMetadataTooltip).toBeHidden()
  await foxCard.getByRole('button', { name: 'Remove from Imagine' }).focus()
  await page.keyboard.press('Tab')
  await expect(removeMetadataSwitch).toBeFocused()
  await expect(removeMetadataTooltip).toBeVisible()
  await page.keyboard.press('Shift+Tab')
  await expect(removeMetadataTooltip).toBeHidden()

  // Pressed, the picture opens over the page, larger than on the card and inside the window, with the
  // card's actions under it; the page behind doesn't scroll. The picture is scrolled fully into view
  // first, so the click itself has nothing to scroll.
  await foxPictureButton.scrollIntoViewIfNeeded()
  const foxCardPictureBox = await foxCard.getByRole('img').boundingBox()
  const drawThreadScrollBefore = await readDrawThreadScroll(foxEntry)
  expect(drawThreadScrollBefore.isDrawThreadScrollable).toBe(true)
  await foxPictureButton.click()
  const pictureLightbox = page.getByRole('dialog', { name: 'A red fox' })
  const lightboxPicture = pictureLightbox.getByRole('img', { name: 'A red fox' })
  await expect(lightboxPicture).toBeVisible()
  const lightboxPictureBox = await lightboxPicture.boundingBox()
  const windowSize = page.viewportSize()
  expect(lightboxPictureBox !== null && foxCardPictureBox !== null && windowSize !== null).toBe(true)
  expect(lightboxPictureBox!.width).toBeGreaterThan(foxCardPictureBox!.width)
  expect(lightboxPictureBox!.x).toBeGreaterThanOrEqual(0)
  expect(lightboxPictureBox!.y + lightboxPictureBox!.height).toBeLessThanOrEqual(windowSize!.height)
  await expect(pictureLightbox.getByRole('button', { name: 'Put in Note' })).toBeInViewport()
  await expect(pictureLightbox.getByRole('button', { name: 'Save to Vault' })).toBeInViewport()
  await page.mouse.move(windowSize!.width / 2, windowSize!.height / 2)
  await page.mouse.wheel(0, -600)
  await page.mouse.wheel(0, 600)
  expect((await readDrawThreadScroll(foxEntry)).drawThreadScrollTop).toBe(drawThreadScrollBefore.drawThreadScrollTop)
  // A press on the picture keeps it open; Esc closes it and gives focus back to the picture.
  await lightboxPicture.click()
  await expect(pictureLightbox).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(pictureLightbox).toBeHidden()
  await expect(foxPictureButton).toBeFocused()

  // By keyboard: Enter opens it with focus inside, Tab stays inside, and Close gives focus back.
  await page.keyboard.press('Enter')
  await expect(pictureLightbox.getByRole('button', { name: 'Close' })).toBeFocused()
  // Tab goes round the lightbox's buttons (and out to the browser's own bar), never to the page behind.
  for (let tabPressCount = 0; tabPressCount < 6; tabPressCount += 1) {
    await page.keyboard.press('Tab')
    expect(
      await page.evaluate(() => {
        const focusedElement = document.activeElement
        if (focusedElement === null || focusedElement === document.body) return 'the browser’s bar'
        return focusedElement.closest('dialog')?.getAttribute('aria-label') ?? 'the page behind'
      }),
    ).not.toBe('the page behind')
  }
  await pictureLightbox.getByRole('button', { name: 'Close' }).focus()
  await page.keyboard.press('Enter')
  await expect(pictureLightbox).toBeHidden()
  await expect(foxPictureButton).toBeFocused()

  // A press beside the picture closes it; Put in Note from it closes it and shows the change under the picture.
  await foxPictureButton.click()
  await expect(lightboxPicture).toBeVisible()
  await page.mouse.click(6, windowSize!.height / 2)
  await expect(pictureLightbox).toBeHidden()
  await foxPictureButton.click()
  await pictureLightbox.getByRole('button', { name: 'Put in Note' }).click()
  await expect(pictureLightbox).toBeHidden()
  await expect(foxEntry.getByRole('region', { name: 'Change to Start here' })).toBeVisible()

  // Two pictures from one prompt share the column's width, side by side.
  const aspectRatioChip = assistantPanel.getByRole('button', { name: /^Aspect ratio: / })
  await aspectRatioChip.click()
  await page.getByRole('menu', { name: 'Aspect Ratio and Pictures' }).getByRole('menuitemradio', { name: '2 Pictures' }).click()
  await expect(aspectRatioChip).toHaveAccessibleName('Aspect ratio: 1:1, 2 pictures')
  const promptBox = assistantPanel.getByRole('textbox', { name: 'Describe a picture' })
  await promptBox.fill('Two red foxes')
  await promptBox.press('Enter')
  const twoFoxesPicturesList = assistantPanel.getByRole('region', { name: 'Imagine: Two red foxes' }).getByRole('list', { name: 'Pictures' })
  await expect(twoFoxesPicturesList.getByRole('listitem')).toHaveCount(2)
  const [twoFoxesPicturesListBox, firstFoxCardBox, secondFoxCardBox] = await readElementBoxesInOneFrame(page, [
    twoFoxesPicturesList,
    twoFoxesPicturesList.getByRole('listitem').nth(0),
    twoFoxesPicturesList.getByRole('listitem').nth(1),
  ])
  expect(secondFoxCardBox!.y).toBeCloseTo(firstFoxCardBox!.y, 0)
  expect(secondFoxCardBox!.x).toBeGreaterThan(firstFoxCardBox!.x + firstFoxCardBox!.width)
  expect(firstFoxCardBox!.width + secondFoxCardBox!.width).toBeGreaterThan(twoFoxesPicturesListBox!.width - 20)
  expect(refusedOutsideRequestUrls).toEqual([])
})

test('on a 375 px phone a Draw picture’s buttons fill its card, and its lightbox fits the window with its actions', async ({ browser, browserName }) => {
  const phoneContext = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, ...(browserName === 'chromium' ? { isMobile: true } : {}) })
  const page = await phoneContext.newPage()
  const { refusedOutsideRequestUrls } = await playTestMetaProvider(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Try Sample' }).first().tap()
  await expect(page.locator('.cm-content').first()).toContainText('Welcome to the sample vault.')
  // On a phone the assistant opens from the top bar.
  await page.getByRole('button', { name: 'AI Assistant', exact: true }).tap()
  await setUpTestMetaProvider(page)
  const assistantPanel = page.getByRole('complementary', { name: 'AI Assistant' })
  await sendDrawPrompts(assistantPanel, ['A red fox'])
  const foxCard = assistantPanel.getByRole('region', { name: 'Imagine: A red fox' }).getByRole('listitem', { name: 'Picture of A red fox' })
  await foxCard.scrollIntoViewIfNeeded()
  const foxCardBox = await foxCard.boundingBox()
  const putInNoteBox = await foxCard.getByRole('button', { name: 'Put in Note' }).boundingBox()
  expect(foxCardBox !== null && putInNoteBox !== null).toBe(true)
  expect(foxCardBox!.x + foxCardBox!.width).toBeLessThanOrEqual(375)
  expect(putInNoteBox!.width).toBeGreaterThan(foxCardBox!.width - 20)

  await foxCard.getByRole('button', { name: 'A red fox' }).tap()
  const pictureLightbox = page.getByRole('dialog', { name: 'A red fox' })
  const lightboxPictureBox = await pictureLightbox.getByRole('img', { name: 'A red fox' }).boundingBox()
  expect(lightboxPictureBox).not.toBeNull()
  expect(lightboxPictureBox!.x).toBeGreaterThanOrEqual(0)
  expect(lightboxPictureBox!.x + lightboxPictureBox!.width).toBeLessThanOrEqual(375)
  for (const lightboxButtonName of ['Close', 'Put in Note', 'Save to Vault']) {
    await expect(pictureLightbox.getByRole('button', { name: lightboxButtonName })).toBeInViewport({ ratio: 1 })
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  await pictureLightbox.getByRole('button', { name: 'Close' }).tap()
  await expect(pictureLightbox).toBeHidden()
  expect(refusedOutsideRequestUrls).toEqual([])
  await phoneContext.close()
})

test('a picture brought into Imagine with Remove Metadata off is saved as it came', async ({ page }) => {
  await playTestMetaProvider(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Try Sample' }).first().click()
  const assistantPanel = page.getByRole('complementary', { name: 'AI Assistant' })
  await assistantPanel.getByRole('tab', { name: 'Imagine', exact: true }).click()
  // No provider yet: the box still shows, with a line to choose one, and bringing in a picture still works.
  await expect(assistantPanel.getByText('Choose a provider that makes pictures')).toBeVisible()
  await expect(assistantPanel.getByRole('textbox', { name: 'Describe a picture' })).toBeVisible()
  await assistantPanel.getByRole('textbox', { name: 'Describe a picture' }).fill('A red fox')
  await expect(assistantPanel.getByRole('button', { name: 'Send', exact: true })).toBeDisabled()
  await assistantPanel.getByRole('button', { name: 'Add', exact: true }).click()
  const pictureFileChooser = page.waitForEvent('filechooser')
  await page.getByRole('menu', { name: 'Add' }).getByRole('menuitem', { name: 'Bring In a Picture' }).click()
  await (await pictureFileChooser).setFiles({ name: 'diagram.png', mimeType: 'image/png', buffer: buildTestPictureWithContentCredentials() })
  const broughtInEntry = assistantPanel.getByRole('region', { name: 'Brought in: diagram.png' })
  await expect(broughtInEntry.getByText('Brought in: diagram.png')).toBeVisible()
  await expect(broughtInEntry.getByRole('img', { name: 'diagram.png' })).toBeVisible()
  await assistantPanel.getByRole('switch', { name: 'Remove Metadata' }).click()
  await expect(assistantPanel.getByRole('switch', { name: 'Remove Metadata' })).toHaveAttribute('aria-checked', 'false')
  await assistantPanel.getByRole('button', { name: 'Save to Vault' }).click()
  await expect(assistantPanel.getByRole('switch', { name: 'Remove Metadata' })).toBeDisabled()
  await expect(assistantPanel.getByText(/^In the vault: picture-\d{4}-\d{2}-\d{2}-\d{4}-diagram\.png$/)).toBeVisible()
  const savedPictureBytes = await readBlobPictureBytes(page, (await assistantPanel.getByRole('img', { name: 'diagram.png' }).getAttribute('src')) ?? '')
  expect(savedPictureBytes.includes(Buffer.from(testC2paManifestText, 'latin1'))).toBe(true)
  // Ask's box shows before a chat provider too, with the notes chat's line and button.
  await assistantPanel.getByRole('tab', { name: 'Ask', exact: true }).click()
  await expect(assistantPanel.getByText('Choose a provider to type or speak')).toBeVisible()
  await assistantPanel.getByRole('textbox', { name: 'Ask about a picture' }).fill('Which light?')
  await expect(assistantPanel.getByRole('button', { name: 'Send', exact: true })).toBeDisabled()
  // The box's own Choose a Provider opens Settings › AI Provider.
  await assistantPanel.getByRole('button', { name: 'Choose a Provider' }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
})

test('+ in the chat box: an audio file goes to Meta’s transcription as WAV, and the words land in the chat box', async ({ page }) => {
  const { testProviderRequests, refusedOutsideRequestUrls } = await playTestMetaProvider(page)
  await openSampleVaultWithMetaProvider(page)
  const assistantPanel = page.getByRole('complementary', { name: 'AI Assistant' })
  await assistantPanel.getByRole('button', { name: 'Add', exact: true }).click()
  const audioFileChooser = page.waitForEvent('filechooser')
  await page.getByRole('menu', { name: 'Add' }).getByRole('menuitem', { name: 'Transcribe an Audio File' }).click()
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
// instead of a real device (or refuses, as a browser does when the microphone isn't allowed), so the
// mic runs unattended in every browser.
async function installStandInMicrophone(page: Page, standInMicrophoneAnswer: 'tone' | 'refused'): Promise<() => Promise<number>> {
  await page.addInitScript((microphoneAnswer) => {
    const papelizTestWindow = window as unknown as { papelizTestMicrophoneRequestCount: number }
    papelizTestWindow.papelizTestMicrophoneRequestCount = 0
    navigator.mediaDevices.getUserMedia = async () => {
      papelizTestWindow.papelizTestMicrophoneRequestCount += 1
      if (microphoneAnswer === 'refused') throw new DOMException('Permission denied', 'NotAllowedError')
      const toneAudioContext = new AudioContext()
      const toneOscillator = toneAudioContext.createOscillator()
      const toneDestination = toneAudioContext.createMediaStreamDestination()
      toneOscillator.connect(toneDestination)
      toneOscillator.start()
      return toneDestination.stream
    }
  }, standInMicrophoneAnswer)
  return () => page.evaluate(() => (window as unknown as { papelizTestMicrophoneRequestCount: number }).papelizTestMicrophoneRequestCount)
}

function countProviderRequests(testProviderRequests: TestProviderRequestRecord[], providerRequestPath: string): number {
  return testProviderRequests.filter((providerRequest) => providerRequest.providerRequestPath === providerRequestPath).length
}

test('one press on the chat box’s mic records, ✓ in the mic’s place finishes, and the words land after what is typed; Esc throws a recording away', async ({ page }) => {
  const { testProviderRequests } = await playTestMetaProvider(page)
  const readMicrophoneRequestCount = await installStandInMicrophone(page, 'tone')
  await openSampleVaultWithMetaProvider(page)
  const assistantPanel = page.getByRole('complementary', { name: 'AI Assistant' })
  const messageBox = assistantPanel.getByRole('textbox', { name: 'Message the assistant' })
  const micButton = assistantPanel.getByRole('button', { name: 'Speak' })
  const doneButton = assistantPanel.getByRole('button', { name: 'Done Speaking' })
  const composerCard = messageBox.locator('xpath=..')
  expect(await readMicrophoneRequestCount()).toBe(0)

  // One press, no menu: the row becomes the recorder, with ✓ exactly where the mic was.
  await messageBox.fill('Summarize this note')
  const micButtonBox = await micButton.boundingBox()
  const restingCardBox = await composerCard.boundingBox()
  await micButton.click()
  await expect(doneButton).toBeFocused()
  expect(await readMicrophoneRequestCount()).toBe(1)
  const doneButtonBox = await doneButton.boundingBox()
  expect(Math.abs((doneButtonBox?.x ?? 0) - (micButtonBox?.x ?? -10))).toBeLessThan(1)
  expect(Math.abs((doneButtonBox?.y ?? 0) - (micButtonBox?.y ?? -10))).toBeLessThan(1)
  expect(Math.abs(((await composerCard.boundingBox())?.height ?? 0) - (restingCardBox?.height ?? -10))).toBeLessThan(1)
  await expect(assistantPanel.getByRole('img', { name: 'Sound level' })).toBeVisible()
  await expect(assistantPanel.getByRole('button', { name: 'Throw the Recording Away' })).toBeVisible()
  await expect(messageBox).toHaveValue('Summarize this note')
  await expect(assistantPanel.getByRole('button', { name: 'Send' })).toBeDisabled()
  await page.waitForTimeout(1500)
  await doneButton.click()
  await expect(messageBox).toHaveValue(`Summarize this note ${testSpokenTranscriptText}`)
  await expect(messageBox).toBeFocused()
  // Nothing was sent: the only chat call is Test Connection's.
  expect(countProviderRequests(testProviderRequests, 'chat/completions')).toBe(1)
  expect(countProviderRequests(testProviderRequests, 'asr/transcribe')).toBe(1)

  // Enter finishes too.
  await messageBox.fill('')
  await micButton.click()
  await expect(doneButton).toBeFocused()
  await page.waitForTimeout(1200)
  await page.keyboard.press('Enter')
  await expect(messageBox).toHaveValue(testSpokenTranscriptText)
  expect(countProviderRequests(testProviderRequests, 'chat/completions')).toBe(1)

  // Esc throws the recording away: nothing is transcribed and the text stays as it was.
  await micButton.click()
  await expect(doneButton).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(doneButton).toBeHidden()
  await expect(micButton).toBeVisible()
  await expect(messageBox).toHaveValue(testSpokenTranscriptText)
  expect(countProviderRequests(testProviderRequests, 'asr/transcribe')).toBe(2)
  // The chat panel stayed open (the workspace's own Esc left it alone).
  await expect(assistantPanel).toBeVisible()
})

test('a refused microphone shows a red line under the chat box, and its step brings in an audio file instead', async ({ page }) => {
  await playTestMetaProvider(page)
  await installStandInMicrophone(page, 'refused')
  await openSampleVaultWithMetaProvider(page)
  const assistantPanel = page.getByRole('complementary', { name: 'AI Assistant' })
  await assistantPanel.getByRole('button', { name: 'Speak' }).click()
  const problemLine = assistantPanel.getByRole('alert').filter({ hasText: 'The microphone isn’t allowed for Papeliz.' })
  await expect(problemLine).toBeVisible()
  const audioFileChooser = page.waitForEvent('filechooser')
  await problemLine.getByRole('button', { name: 'Transcribe an Audio File' }).click()
  await (await audioFileChooser).setFiles({ name: 'standup.wav', mimeType: 'audio/wav', buffer: buildTestSpeechWav() })
  await expect(assistantPanel.getByRole('textbox', { name: 'Message the assistant' })).toHaveValue(testSpokenTranscriptText)
  await expect(problemLine).toBeHidden()
})

test('before a provider is set, the chat box shows with its mic and a line to choose one', async ({ page }) => {
  await playTestMetaProvider(page)
  const readMicrophoneRequestCount = await installStandInMicrophone(page, 'tone')
  await page.goto('/')
  await page.getByRole('button', { name: 'Try Sample' }).first().click()
  const assistantPanel = page.getByRole('complementary', { name: 'AI Assistant' })
  await expect(assistantPanel.getByText('Choose a provider to type or speak')).toBeVisible()
  await expect(assistantPanel.getByRole('textbox', { name: 'Message the assistant' })).toBeVisible()
  await expect(assistantPanel.getByRole('button', { name: 'Send' })).toBeDisabled()
  // With nothing to send the words to, the mic opens the provider settings, and the microphone isn't asked for.
  await assistantPanel.getByRole('button', { name: 'Speak' }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
  expect(await readMicrophoneRequestCount()).toBe(0)
})

test('the Ctrl K card’s mic speaks the instruction, and nothing runs until Run; Esc stops the recording, not the card', async ({ page }) => {
  const { testProviderRequests } = await playTestMetaProvider(page)
  await installStandInMicrophone(page, 'tone')
  await openSampleVaultWithMetaProvider(page)
  await page.getByRole('button', { name: 'MD Code', exact: true }).click()
  const inlineCard = await openInlineCardOnLine(page, '# Start here')
  const doneButton = inlineCard.getByRole('button', { name: 'Done Speaking' })
  await inlineCard.getByRole('button', { name: 'Speak' }).click()
  await expect(doneButton).toBeFocused()
  await page.waitForTimeout(1200)
  await doneButton.click()
  await expect(inlineCard.getByRole('textbox', { name: 'Instruction for the selection' })).toHaveValue(testSpokenTranscriptText)
  await expect(inlineCard.getByRole('button', { name: 'Run' })).toBeEnabled()
  expect(countProviderRequests(testProviderRequests, 'chat/completions')).toBe(1)
  // The Transcribe chip, which writes speech into the note, is still there beside the quick actions.
  await expect(inlineCard.getByRole('button', { name: 'Transcribe', exact: true })).toBeVisible()

  await inlineCard.getByRole('button', { name: 'Speak' }).click()
  await expect(doneButton).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(doneButton).toBeHidden()
  await expect(inlineCard).toBeVisible()
  await expect(inlineCard.getByRole('textbox', { name: 'Instruction for the selection' })).toHaveValue(testSpokenTranscriptText)
})

test('Imagine’s box has its own mic and +, and the spoken words fill the prompt without making a picture', async ({ page }) => {
  const { testProviderRequests } = await playTestMetaProvider(page)
  await installStandInMicrophone(page, 'tone')
  await openSampleVaultWithMetaProvider(page)
  const assistantPanel = page.getByRole('complementary', { name: 'AI Assistant' })
  await assistantPanel.getByRole('tab', { name: 'Imagine', exact: true }).click()
  const promptBox = assistantPanel.getByRole('textbox', { name: 'Describe a picture' })
  await promptBox.fill('A red fox')
  const sendBox = await assistantPanel.getByRole('button', { name: 'Send', exact: true }).boundingBox()
  const micBox = await assistantPanel.getByRole('button', { name: 'Speak' }).boundingBox()
  await assistantPanel.getByRole('button', { name: 'Speak' }).click()
  const doneButton = assistantPanel.getByRole('button', { name: 'Done Speaking' })
  await expect(doneButton).toBeFocused()
  // ✓ lands where the mic was, with Send held beside it.
  const doneBox = await doneButton.boundingBox()
  expect(Math.abs((doneBox?.x ?? 0) - (micBox?.x ?? 0))).toBeLessThanOrEqual(1)
  expect(Math.abs((doneBox?.y ?? 0) - (micBox?.y ?? 0))).toBeLessThanOrEqual(1)
  await expect(assistantPanel.getByRole('button', { name: 'Send', exact: true })).toBeDisabled()
  expect(Math.abs(((await assistantPanel.getByRole('button', { name: 'Send', exact: true }).boundingBox())?.x ?? 0) - (sendBox?.x ?? 0))).toBeLessThanOrEqual(1)
  await page.waitForTimeout(1200)
  await page.keyboard.press('Enter')
  await expect(promptBox).toHaveValue(`A red fox ${testSpokenTranscriptText}`)
  expect(countProviderRequests(testProviderRequests, 'images/generations')).toBe(0)

  await assistantPanel.getByRole('button', { name: 'Add', exact: true }).click()
  const addMenu = page.getByRole('menu', { name: 'Add' })
  await expect(addMenu.getByRole('menuitem', { name: 'Bring In a Picture' })).toBeVisible()
  const audioFileChooser = page.waitForEvent('filechooser')
  await addMenu.getByRole('menuitem', { name: 'Transcribe an Audio File' }).click()
  await (await audioFileChooser).setFiles({ name: 'idea.wav', mimeType: 'audio/wav', buffer: buildTestSpeechWav() })
  await expect(promptBox).toHaveValue(`A red fox ${testSpokenTranscriptText} ${testSpokenTranscriptText}`)
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
  await expect(inlineCard.getByRole('switch', { name: 'Remove Metadata' })).toHaveAttribute('aria-checked', 'true')
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

  // Transcribe Here, at the clicked line. The note is scrolled down first, so the right-click brings
  // the line back into view just before the menu opens; that scroll's event, which comes a frame
  // later, must not close the menu.
  await scrollNoteBy(page, 600)
  await expect(page.locator('.cm-line', { hasText: '# Start here' }).first()).not.toBeInViewport()
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

  // Scrolling the note while the menu is open still closes it.
  await scrollNoteBy(page, -10_000)
  await page.locator('.cm-line', { hasText: 'Try these' }).first().click({ button: 'right' })
  await expect(noteActionsMenu).toBeVisible()
  await scrollNoteBy(page, 200)
  await expect(noteActionsMenu).toBeHidden()
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
  // Describe Picture always uses the chat's model, and the footer names it.
  expect(JSON.parse(describeRequest?.providerRequestBodyText ?? '{}')).toMatchObject({ model: metaChatModelName })
  await expect(inlineCard.getByText(`${metaChatModelName}, straight to Meta Model API`)).toBeVisible()
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
  await expect(inlineCard.getByRole('switch', { name: 'Remove Metadata' })).toHaveAttribute('aria-checked', 'true')
  const editRequest = testProviderRequests.find((providerRequest) => providerRequest.providerRequestPath === 'images/edits')
  expect(JSON.parse(editRequest?.providerRequestBodyText ?? '{}')).toMatchObject({ model: 'muse-image-1.0', prompt: 'Make it red', n: 1 })
  expect(editRequest?.providerRequestBodyText).toContain('"images":[{"image_url":"data:image/png;base64,')
  await inlineCard.getByRole('button', { name: /^Accept/ }).click()
  await expect(inlineCard).toBeHidden()
  const editedLinkText = (await page.locator('.cm-line', { hasText: `![${testPictureAltText}](` }).first().textContent()) ?? ''
  expect(editedLinkText).toMatch(/^!\[A blue square on white paper\]\(Attachments\/imagine-.+\)$/)
  expect(editedLinkText).not.toBe(describedLinkText)

  // Draw's chip starts on Automatic, and its menu ends with Models for Transcribe and Draw.
  const assistantPanel = page.getByRole('complementary', { name: 'AI Assistant' })
  await assistantPanel.getByRole('tab', { name: 'Imagine', exact: true }).click()
  await assistantPanel.getByRole('button', { name: /^Picture model: / }).click()
  const pictureModelMenu = page.getByRole('menu', { name: 'Picture Model' })
  await expect(pictureModelMenu.getByRole('menuitemradio')).toHaveText(['Automatic · muse-image-1.0', 'muse-image-1.0'])
  await expect(pictureModelMenu.getByRole('menuitemradio', { name: 'Automatic · muse-image-1.0' })).toHaveAttribute('aria-checked', 'true')
  await expect(pictureModelMenu.getByRole('menuitem', { name: 'Models for Transcribe and Draw' })).toBeVisible()
  await expect(pictureModelMenu.getByRole('menuitem', { name: 'AI Provider' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  // Edit Picture follows Draw: on OpenAI's gpt-image-2, which can't edit pictures, it isn't offered.
  await addTestOpenAiProviderFromDraw(page, assistantPanel)
  await assistantPanel.getByRole('button', { name: /^Picture model: / }).click()
  await pictureModelMenu.getByRole('menuitemradio', { name: 'gpt-image-2' }).click()
  inlineCard = await openInlineCardOnLine(page, `![${testPictureAltText}](`)
  await expect(inlineCard.getByRole('button', { name: 'Describe Picture' })).toBeVisible()
  await expect(inlineCard.getByRole('button', { name: 'Edit Picture' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(inlineCard).toBeHidden()
  // Back to Automatic: the Meta Model API's muse-image-1.0, which edits pictures.
  await assistantPanel.getByRole('button', { name: /^Picture model: / }).click()
  await pictureModelMenu.getByRole('menuitemradio', { name: /^Automatic/ }).click()
  await expect(assistantPanel.getByRole('button', { name: 'Picture model: muse-image-1.0' })).toBeVisible()
  inlineCard = await openInlineCardOnLine(page, `![${testPictureAltText}](`)
  await expect(inlineCard.getByRole('button', { name: 'Edit Picture' })).toBeVisible()
  expect(refusedOutsideRequestUrls).toEqual([])
})

test('while Edit Picture and Describe Picture wait for the provider, the card says so with a rocking mark and a clock above the old picture', async ({ page }) => {
  const { refusedOutsideRequestUrls } = await playTestMetaProvider(page)
  // The provider holds its answer to the picture's edit and to its description until the test lets it go.
  let releaseHeldProviderReply: () => void = () => {}
  let heldProviderReply = new Promise<void>((resolveHeldReply) => (releaseHeldProviderReply = resolveHeldReply))
  await page.route(`${testProviderBaseUrl}/**`, async (route: Route) => {
    const providerRequestPath = new URL(route.request().url()).pathname.replace('/v1/', '')
    const isPictureRequest = providerRequestPath === 'images/edits' || (providerRequestPath === 'chat/completions' && (route.request().postData() ?? '').includes('alt text'))
    if (isPictureRequest && route.request().method() === 'POST') await heldProviderReply
    return route.fallback()
  })
  await openSampleVaultWithMetaProvider(page)
  await page.getByRole('button', { name: 'MD Code', exact: true }).click()
  let inlineCard = await openInlineCardOnLine(page, 'Welcome to the sample vault.')
  await inlineCard.getByRole('button', { name: 'Imagine', exact: true }).click()
  await inlineCard.getByRole('textbox', { name: 'Picture to make' }).fill('square')
  await inlineCard.getByRole('button', { name: 'Imagine', exact: true }).click()
  await inlineCard.getByRole('button', { name: /^Accept/ }).click()
  await expect(page.locator('.cm-content').first()).toContainText('![square](Attachments/imagine-')

  // Edit Picture: the line names Draw's model and sits right under the request, above the old picture.
  inlineCard = await openInlineCardOnLine(page, '![square](Attachments/imagine-')
  await inlineCard.getByRole('button', { name: 'Edit Picture' }).click()
  await inlineCard.getByRole('textbox', { name: 'Change to make in the picture' }).fill('make it light mode')
  await inlineCard.getByRole('button', { name: 'Edit Picture' }).click()
  const editWaitingLine = inlineCard.getByText('Editing the picture with muse-image-1.0…', { exact: true })
  await expect(editWaitingLine).toBeVisible()
  const editWaitingHeader = inlineCard.locator('.papeliz-loading-work-header').filter({ hasText: 'Editing the picture with muse-image-1.0…' })
  await expect(editWaitingHeader.locator('.papeliz-loading-work-mark')).toBeVisible()
  await expect(editWaitingHeader.getByRole('timer', { name: 'Time so far' })).toHaveText(/^\d+:\d{2}$/)
  const oldPicture = inlineCard.getByRole('img', { name: 'square' })
  await expect(oldPicture).toBeVisible()
  const [editWaitingLineBox, oldPictureBox] = await readElementBoxesInOneFrame(page, [editWaitingLine, oldPicture])
  expect(editWaitingLineBox!.y + editWaitingLineBox!.height).toBeLessThanOrEqual(oldPictureBox!.y)
  expect(await editWaitingHeader.locator('.papeliz-loading-work-mark').evaluate((markElement) => getComputedStyle(markElement).animationName)).toBe('papeliz-loading-rock')
  // The old picture stays in view, dimmed under the sweeping sheen.
  const oldPictureSheen = inlineCard.locator('.papeliz-loading-picture-under-sheen .papeliz-loading-sheen-over')
  expect(await oldPictureSheen.evaluate((sheenElement) => getComputedStyle(sheenElement).animationName)).toBe('papeliz-loading-sheen-sweep')
  // Reject stops the wait while it runs.
  await expect(inlineCard.getByRole('button', { name: /^Reject/ })).toBeEnabled()
  // With reduced motion the mark stands still, the words stay, and the sheen breathes instead of sweeping.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await editWaitingHeader.locator('.papeliz-loading-work-mark').evaluate((markElement) => getComputedStyle(markElement).animationName)).toBe('none')
  expect(await oldPictureSheen.evaluate((sheenElement) => [getComputedStyle(sheenElement).animationName, getComputedStyle(sheenElement).animationDuration])).toEqual([
    'papeliz-loading-breathe',
    '1.4s',
  ])
  await expect(editWaitingLine).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect(inlineCard.getByRole('button', { name: /^Accept/ })).toBeDisabled()
  releaseHeldProviderReply()
  await expect(inlineCard.getByRole('switch', { name: 'Remove Metadata' })).toBeVisible()
  await expect(editWaitingLine).toHaveCount(0)
  await inlineCard.getByRole('button', { name: /^Accept/ }).click()
  await expect(inlineCard).toBeHidden()

  // Describe Picture: the same line, naming the chat's model, until the alt text arrives.
  heldProviderReply = new Promise<void>((resolveHeldReply) => (releaseHeldProviderReply = resolveHeldReply))
  inlineCard = await openInlineCardOnLine(page, '![square](Attachments/imagine-')
  await inlineCard.getByRole('button', { name: 'Describe Picture' }).click()
  const describeWaitingLine = inlineCard.getByText(`Describing the picture with ${metaChatModelName}…`, { exact: true })
  await expect(describeWaitingLine).toBeVisible()
  await expect(inlineCard.locator('.papeliz-loading-work-header').filter({ hasText: `Describing the picture with ${metaChatModelName}…` }).locator('.papeliz-loading-work-mark')).toBeVisible()
  // Two swept lines stand where the alt text will go.
  await expect(inlineCard.locator('.papeliz-loading-picture-text-lines')).toBeVisible()
  releaseHeldProviderReply()
  await expect(inlineCard.locator('.papeliz-text-diff')).toContainText(`![${testPictureAltText}](Attachments/imagine-`)
  await expect(describeWaitingLine).toHaveCount(0)
  expect(refusedOutsideRequestUrls).toEqual([])
})
