import { expect, test, type Locator, type Page, type Route } from '@playwright/test'

// The chat box in a real browser: the "sees" menu's five choices reaching the request, the context ring
// and its card (hover, keyboard and tap, and a window size set from the card), the row fitting its
// width, on a phone too, and Retry after an error. Every provider call is answered here, and any other
// request off this computer is refused, so no real key or outside network is ever used.

const testProviderBaseUrl = 'https://papeliz-test-provider.invalid/v1'
const testProviderApiKey = 'papeliz-test-key-not-a-real-key'
const testProviderModelName = 'papeliz-test-model'
const connectionTestMessageText = 'Reply with the single word: ready'

const testProviderCorsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
}

interface PapelizTestProviderPlay {
  // Each chat request's system message, in order.
  testProviderSystemMessages: string[]
  refusedOutsideRequestUrls: string[]
  // Set to hold the next answers until it resolves; set to answer with an error instead.
  holdNextAnswersUntil: Promise<void> | null
  answerNextWithError: boolean
}

// Answers the provider's chat calls with "Done." (1,200 tokens in and 40 out), Test Connection's
// request apart, and refuses every other request that would leave this computer.
async function playTestProvider(page: Page): Promise<PapelizTestProviderPlay> {
  const testProviderPlay: PapelizTestProviderPlay = { testProviderSystemMessages: [], refusedOutsideRequestUrls: [], holdNextAnswersUntil: null, answerNextWithError: false }
  await page.route('**/*', async (route: Route) => {
    const requestUrl = new URL(route.request().url())
    if (requestUrl.hostname === '127.0.0.1' || requestUrl.hostname === 'localhost') return route.continue()
    testProviderPlay.refusedOutsideRequestUrls.push(requestUrl.href)
    return route.abort('blockedbyclient')
  })
  await page.route(`${testProviderBaseUrl}/**`, async (route: Route) => {
    const providerRequest = route.request()
    if (providerRequest.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: testProviderCorsHeaders })
    const providerRequestBody = providerRequest.postDataJSON() as { messages: Array<{ role: string; content?: unknown }> }
    if (providerRequestBody.messages.length === 1 && providerRequestBody.messages[0]?.content === connectionTestMessageText) {
      return route.fulfill({ status: 200, headers: testProviderCorsHeaders, json: { choices: [{ index: 0, message: { role: 'assistant', content: 'ready' }, finish_reason: 'stop' }] } })
    }
    const systemMessage = providerRequestBody.messages.find((providerMessage) => providerMessage.role === 'system')
    testProviderPlay.testProviderSystemMessages.push(typeof systemMessage?.content === 'string' ? systemMessage.content : '')
    if (testProviderPlay.holdNextAnswersUntil !== null) await testProviderPlay.holdNextAnswersUntil
    if (testProviderPlay.answerNextWithError) {
      testProviderPlay.answerNextWithError = false
      return route.fulfill({ status: 401, headers: testProviderCorsHeaders, json: { error: { message: 'Not now.' } } })
    }
    return route.fulfill({
      status: 200,
      headers: testProviderCorsHeaders,
      json: {
        object: 'chat.completion',
        model: testProviderModelName,
        choices: [{ index: 0, message: { role: 'assistant', content: 'Done.' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1200, completion_tokens: 40 },
      },
    })
  })
  return testProviderPlay
}

async function openSampleVaultWithAssistantPanel(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Try Sample' }).first().click()
  const assistantComposer = page.getByRole('textbox', { name: 'Message the assistant' })
  const assistantPanelButton = page.getByRole('button', { name: 'AI Assistant', exact: true })
  await expect(assistantPanelButton).toBeVisible()
  if (!(await assistantComposer.isVisible())) await assistantPanelButton.click()
  await expect(assistantComposer).toBeVisible()
}

// A Custom provider at the test provider's address, with a typed model whose window size isn't known.
async function openSampleVaultWithTestProvider(page: Page): Promise<void> {
  await page.goto('/')
  await openSampleVaultWithAssistantPanel(page)
  await page.getByRole('button', { name: 'Choose a Provider' }).click()
  const settingsPanel = page.getByRole('dialog', { name: 'Settings' })
  await settingsPanel.getByRole('button', { name: 'Add Provider', exact: true }).click()
  const addProviderDialog = page.getByRole('dialog', { name: 'Add Provider' })
  await addProviderDialog.getByRole('button', { name: /^Provider / }).click()
  await addProviderDialog.getByRole('option', { name: /^Custom/ }).click()
  await addProviderDialog.getByRole('textbox', { name: 'Base URL' }).fill(testProviderBaseUrl)
  await addProviderDialog.getByLabel(/^API Key/).fill(testProviderApiKey)
  await addProviderDialog.getByRole('textbox', { name: 'Model Name' }).fill(testProviderModelName)
  await addProviderDialog.getByRole('button', { name: 'Add Model', exact: true }).click()
  await addProviderDialog.getByRole('button', { name: 'Test Connection', exact: true }).click()
  await expect(addProviderDialog.getByText(`Connected. ${testProviderModelName} answered`, { exact: false })).toBeVisible()
  await addProviderDialog.getByRole('button', { name: 'Add Provider', exact: true }).click()
  await expect(addProviderDialog).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(settingsPanel).toBeHidden()
}

async function sendAndWaitForAnswer(page: Page, testProviderPlay: PapelizTestProviderPlay, messageText: string): Promise<string> {
  const requestCountBefore = testProviderPlay.testProviderSystemMessages.length
  const assistantComposer = page.getByRole('textbox', { name: 'Message the assistant' })
  await assistantComposer.fill(messageText)
  await assistantComposer.press('Enter')
  await expect.poll(() => testProviderPlay.testProviderSystemMessages.length).toBe(requestCountBefore + 1)
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toHaveCount(0)
  return testProviderPlay.testProviderSystemMessages.at(-1) ?? ''
}

async function chooseWhatTheAssistantSees(page: Page, contextMenuItemName: RegExp): Promise<void> {
  await page.getByRole('button', { name: /^Sees / }).click()
  await page.getByRole('menu', { name: 'What the Assistant Sees' }).getByRole('menuitemradio', { name: contextMenuItemName }).click()
}

test('each of the five "sees" choices reaches the request, and the pickers choose notes and a folder', async ({ page }) => {
  const testProviderPlay = await playTestProvider(page)
  await openSampleVaultWithTestProvider(page)
  // Two notes open: Start here, then Inbox in front.
  await page.getByRole('navigation', { name: 'Notes' }).getByText('Inbox', { exact: true }).click()
  await expect(page.getByRole('button', { name: /^Sees This Note/ })).toBeVisible()

  const thisNoteSystemMessage = await sendAndWaitForAnswer(page, testProviderPlay, 'What is in this?')
  expect(thisNoteSystemMessage).toContain('Its text:\n<note path="Inbox.md">')

  await chooseWhatTheAssistantSees(page, /^Open Notes/)
  await expect(page.getByRole('button', { name: 'Sees Open Notes' })).toBeVisible()
  const openNotesSystemMessage = await sendAndWaitForAnswer(page, testProviderPlay, 'What is in these?')
  expect(openNotesSystemMessage).toContain('The user asks about these 2 notes')
  expect(openNotesSystemMessage).toContain('<note path="Start here.md">')
  expect(openNotesSystemMessage).toContain('<note path="Inbox.md">')

  // Selected Notes… opens Choose Notes with the note in front ticked.
  await chooseWhatTheAssistantSees(page, /^Selected Notes/)
  const chooseNotesSheet = page.getByRole('dialog', { name: 'Choose Notes' })
  await expect(chooseNotesSheet.getByRole('searchbox', { name: 'Search notes' })).toBeFocused()
  await expect(chooseNotesSheet.getByRole('checkbox', { name: 'Inbox' })).toBeChecked()
  await chooseNotesSheet.getByRole('searchbox', { name: 'Search notes' }).fill('call')
  await chooseNotesSheet.getByRole('checkbox', { name: 'Callouts' }).check()
  await chooseNotesSheet.getByRole('button', { name: 'Use 2 Notes' }).click()
  await expect(chooseNotesSheet).toBeHidden()
  await expect(page.getByRole('button', { name: 'Sees 2 Notes' })).toBeFocused()
  const selectedNotesSystemMessage = await sendAndWaitForAnswer(page, testProviderPlay, 'Compare them.')
  expect(selectedNotesSystemMessage).toContain('<note path="Inbox.md">')
  expect(selectedNotesSystemMessage).toContain('<note path="Guides/Callouts.md">')
  expect(selectedNotesSystemMessage).not.toContain('<note path="Start here.md">')

  // A Folder… opens Choose a Folder; Esc puts it away, as a menu does.
  await chooseWhatTheAssistantSees(page, /^A Folder/)
  const chooseFolderSheet = page.getByRole('dialog', { name: 'Choose a Folder' })
  await expect(chooseFolderSheet.getByRole('radio', { name: /^Projects/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(chooseFolderSheet).toBeHidden()
  await expect(page.getByRole('complementary').getByText('AI Assistant', { exact: true })).toBeVisible()
  await chooseWhatTheAssistantSees(page, /^A Folder/)
  await chooseFolderSheet.getByRole('radio', { name: /^Projects/ }).check()
  await chooseFolderSheet.getByRole('button', { name: 'Use Projects' }).click()
  await expect(page.getByRole('button', { name: 'Sees Projects' })).toBeVisible()
  const folderSystemMessage = await sendAndWaitForAnswer(page, testProviderPlay, 'Summarize the folder.')
  expect(folderSystemMessage).toContain('<note path="Projects/Garden plan.md">')
  expect(folderSystemMessage).toContain('<note path="Projects/Reading list.md">')
  expect(folderSystemMessage).not.toContain('<note path="Inbox.md">')

  await chooseWhatTheAssistantSees(page, /^Whole Vault/)
  await expect(page.getByRole('button', { name: 'Sees Whole Vault' })).toBeVisible()
  const wholeVaultSystemMessage = await sendAndWaitForAnswer(page, testProviderPlay, 'Search everything.')
  expect(wholeVaultSystemMessage).not.toContain('<note path=')
  expect(testProviderPlay.refusedOutsideRequestUrls).toEqual([])
})

function readContextRing(page: Page): Locator {
  return page.getByRole('button', { name: /^Context: .*\. Show details$/ })
}

test('the context ring is always there, opens its card on hover and from the keyboard, and takes a window size', async ({ page }) => {
  const testProviderPlay = await playTestProvider(page)
  await openSampleVaultWithTestProvider(page)
  // Before the first message: an empty, dashed ring, since this typed model's window isn't known.
  await expect(readContextRing(page)).toHaveAccessibleName('Context: 0 tokens, window size not known. Show details')
  await sendAndWaitForAnswer(page, testProviderPlay, 'Hello')
  await expect(readContextRing(page)).toHaveAccessibleName('Context: 1.2k tokens, window size not known. Show details')

  // Hover opens the card after a short pause; leaving closes it.
  const contextWindowCard = page.getByRole('dialog', { name: 'Context window' })
  await readContextRing(page).hover()
  await expect(contextWindowCard).toBeVisible()
  await expect(contextWindowCard).toContainText('The size of this model’s window isn’t known.')
  await page.mouse.move(10, 10)
  await expect(contextWindowCard).toBeHidden()

  // From the keyboard: Tab onto the ring opens it, Esc closes it, Enter opens it and moves into it.
  await page.getByRole('textbox', { name: 'Message the assistant' }).focus()
  for (let tabPressCount = 0; tabPressCount < 8 && !(await readContextRing(page).evaluate((ringElement) => ringElement === document.activeElement)); tabPressCount += 1) {
    await page.keyboard.press('Tab')
  }
  await expect(readContextRing(page)).toBeFocused()
  await expect(contextWindowCard).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(contextWindowCard).toBeHidden()
  await page.keyboard.press('Enter')
  await expect(contextWindowCard).toBeVisible()
  await expect(contextWindowCard.getByRole('textbox', { name: 'Context window, in tokens' })).toBeFocused()

  // The size is set from the card and kept in the provider's Advanced settings; the ring then fills.
  await contextWindowCard.getByRole('button', { name: '131,072 tokens' }).click()
  await expect(contextWindowCard.getByRole('textbox', { name: 'Context window, in tokens' })).toHaveValue('131072')
  await contextWindowCard.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(readContextRing(page)).toHaveAccessibleName('Context: 1.2k of 128k tokens (<1%). Show details')
  await expect(contextWindowCard).toContainText('Set in Advanced')
  await expect(contextWindowCard).toContainText('131,072')
  await page.keyboard.press('Escape')
  await expect(contextWindowCard).toBeHidden()
  await expect(readContextRing(page)).toBeFocused()

  await page.reload()
  await openSampleVaultWithAssistantPanel(page)
  await expect(readContextRing(page)).toHaveAccessibleName('Context: 0 of 128k tokens (0%). Show details')
  expect(testProviderPlay.refusedOutsideRequestUrls).toEqual([])
})

// The row's measured steps, read from the attributes on the row.
async function readComposerRowFit(page: Page): Promise<{ doesComposerRowFit: boolean; composerRowSteps: string[] }> {
  return page.locator('[data-papeliz-composer-row]').evaluate((composerRowElement) => ({
    doesComposerRowFit: composerRowElement.scrollWidth <= composerRowElement.clientWidth + 0.5,
    composerRowSteps: [...composerRowElement.attributes]
      .map((composerRowAttribute) => composerRowAttribute.name)
      .filter((composerRowAttributeName) => composerRowAttributeName.startsWith('data-papeliz-composer-') && composerRowAttributeName !== 'data-papeliz-composer-row')
      .map((composerRowAttributeName) => composerRowAttributeName.replace('data-papeliz-composer-', '')),
  }))
}

// The panel's own handle stops at 320px, so the panel is held at each width by its style.
async function holdAssistantPanelAtWidth(page: Page, assistantPanelWidth: number): Promise<void> {
  await page.locator('[data-papeliz-composer-row]').evaluate((composerRowElement, heldPanelWidth) => {
    const assistantPanelElement = composerRowElement.closest('aside')
    if (assistantPanelElement === null) throw new Error('The chat box is not in the panel.')
    for (const widthPropertyName of ['width', 'minWidth', 'maxWidth'] as const) assistantPanelElement.style[widthPropertyName] = `${heldPanelWidth}px`
  }, assistantPanelWidth)
}

test('the chat box row fits at 280, 360 and 480 px, also while the assistant answers', async ({ page }) => {
  const testProviderPlay = await playTestProvider(page)
  await openSampleVaultWithTestProvider(page)
  const composerRowStepsByPanelWidth = new Map<number, string[]>()
  for (const assistantPanelWidth of [480, 360, 280]) {
    await holdAssistantPanelAtWidth(page, assistantPanelWidth)
    await expect.poll(() => readComposerRowFit(page)).toMatchObject({ doesComposerRowFit: true })
    composerRowStepsByPanelWidth.set(assistantPanelWidth, (await readComposerRowFit(page)).composerRowSteps)
    // The ring, the mic and Send never go; every hidden word stays in the button's name.
    await expect(readContextRing(page)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Speak' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sees This Note' })).toBeVisible()
  }
  // A narrower row takes more steps, each in order; at 280 Effort is in the model's menu.
  expect(composerRowStepsByPanelWidth.get(480)?.length).toBeLessThan(composerRowStepsByPanelWidth.get(360)?.length ?? 0)
  expect(composerRowStepsByPanelWidth.get(360)?.length).toBeLessThan(composerRowStepsByPanelWidth.get(280)?.length ?? 0)
  expect(composerRowStepsByPanelWidth.get(280)).toEqual(expect.arrayContaining(['effort-icon', 'sees-icon', 'effort-folded', 'model-name-cut']))
  await expect(page.getByRole('button', { name: `Model: ${testProviderModelName}` })).toHaveText(/^papeliz(-test)?…$/, { useInnerText: true })
  await page.getByRole('button', { name: `Model: ${testProviderModelName}` }).click()
  const modelMenu = page.getByRole('menu', { name: 'Model' })
  await expect(modelMenu.getByRole('menuitemradio', { name: 'High' })).toBeVisible()
  await modelMenu.getByRole('menuitemradio', { name: 'High' }).click()
  await expect(page.getByRole('button', { name: 'Effort: High' })).toBeHidden()

  // While the answer is held, with a message typed: Queue and Steer give way to icons, and the model
  // chip steps aside for them and Stop.
  let releaseHeldAnswer = () => {}
  testProviderPlay.holdNextAnswersUntil = new Promise<void>((resolveHeldAnswer) => {
    releaseHeldAnswer = resolveHeldAnswer
  })
  const assistantComposer = page.getByRole('textbox', { name: 'Message the assistant' })
  await assistantComposer.fill('A long question')
  await assistantComposer.press('Enter')
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible()
  await assistantComposer.fill('One more thing')
  await expect.poll(() => readComposerRowFit(page)).toMatchObject({ doesComposerRowFit: true })
  const answeringRowSteps = (await readComposerRowFit(page)).composerRowSteps
  expect(answeringRowSteps).toEqual(expect.arrayContaining(['steer-icons', 'model-chip-aside']))
  await expect(page.getByRole('button', { name: 'Queue', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Steer', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: `Model: ${testProviderModelName}` })).toBeHidden()
  testProviderPlay.holdNextAnswersUntil = null
  releaseHeldAnswer()
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: `Model: ${testProviderModelName}` })).toBeVisible()
  expect(testProviderPlay.refusedOutsideRequestUrls).toEqual([])
})

test('on a 375 px phone the row fits with finger-sized buttons, and a tap opens the ring’s card', async ({ browser, browserName }) => {
  const phoneContext = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, ...(browserName === 'chromium' ? { isMobile: true } : {}) })
  const page = await phoneContext.newPage()
  const testProviderPlay = await playTestProvider(page)
  await openSampleVaultWithTestProvider(page)
  await expect.poll(() => readComposerRowFit(page)).toMatchObject({ doesComposerRowFit: true })
  for (const fingerButton of [page.getByRole('button', { name: 'Speak' }), page.getByRole('button', { name: 'Send' }), readContextRing(page)]) {
    const fingerButtonBox = await fingerButton.boundingBox()
    expect(fingerButtonBox?.height).toBeGreaterThanOrEqual(40)
    expect(fingerButtonBox?.width).toBeGreaterThanOrEqual(36)
  }
  await readContextRing(page).tap()
  const contextWindowCard = page.getByRole('dialog', { name: 'Context window' })
  await expect(contextWindowCard).toBeVisible()
  await expect(contextWindowCard).toContainText('Nothing sent yet in this conversation.')
  await page.getByRole('textbox', { name: 'Message the assistant' }).tap()
  await expect(contextWindowCard).toBeHidden()
  expect(testProviderPlay.refusedOutsideRequestUrls).toEqual([])
  await phoneContext.close()
})

test('an answer that failed shows one red line with Retry, which asks the same question again', async ({ page }) => {
  const testProviderPlay = await playTestProvider(page)
  await openSampleVaultWithTestProvider(page)
  testProviderPlay.answerNextWithError = true
  await sendAndWaitForAnswer(page, testProviderPlay, 'Summarize my inbox')
  const retryButton = page.getByRole('button', { name: 'Retry', exact: true })
  await expect(retryButton).toBeVisible()
  await expect(page.getByRole('button', { name: 'AI Provider', exact: true })).toBeVisible()
  await expect(page.getByText('The provider refused the API key (401).', { exact: false })).toBeVisible()

  await retryButton.click()
  await expect.poll(() => testProviderPlay.testProviderSystemMessages.length).toBe(2)
  await expect(page.locator('.papeliz-assistant-message-markdown').filter({ hasText: 'Done.' })).toBeVisible()
  await expect(retryButton).toHaveCount(0)
  await expect(page.getByText('The provider refused the API key (401).', { exact: false })).toHaveCount(0)
  await expect(page.getByText('Summarize my inbox', { exact: true })).toHaveCount(1)
  expect(testProviderPlay.refusedOutsideRequestUrls).toEqual([])
})
