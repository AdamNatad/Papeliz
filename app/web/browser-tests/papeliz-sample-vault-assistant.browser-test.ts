import { expect, test, type Page, type Route } from '@playwright/test'

// The assistant's whole loop in a real browser, against a provider the test plays: open the sample
// vault, set up a Custom provider with a made-up key, ask for an edit, review the diff the assistant
// proposes, accept it and see the note change. Then an answer with pictures in it. Every provider
// call is answered here, and any other request off this computer is refused, so no real key or
// outside network is ever used.

const testProviderBaseUrl = 'https://papeliz-test-provider.invalid/v1'
const testProviderApiKey = 'papeliz-test-key-not-a-real-key'
const testProviderModelName = 'papeliz-test-model'

// The edit the test provider proposes to the sample vault's first note.
const startHereOriginalSentence = 'Welcome to the sample vault.'
const startHereEditedSentence = 'Welcome to the Papeliz sample vault.'
const startHereEditReason = 'Names the app in the first sentence.'

interface TestProviderChatRequest {
  providerRequestAuthorization: string | null
  providerRequestModelName: string
  providerRequestMessages: Array<{ role: string; content?: unknown; tool_call_id?: string }>
  providerRequestToolNames: string[]
}

interface TestProviderReply {
  content: string | null
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
}

// The provider's two answers, in order: propose the edit, then say so.
const startHereEditProviderReplies: TestProviderReply[] = [
  {
    content: null,
    tool_calls: [
      {
        id: 'call_propose_start_here_edit',
        type: 'function',
        function: {
          name: 'proposeVaultNoteEdit',
          arguments: JSON.stringify({
            vaultNoteRelativePath: 'Start here.md',
            edits: [{ findText: startHereOriginalSentence, replaceWithText: startHereEditedSentence }],
            reason: startHereEditReason,
          }),
        },
      },
    ],
  },
  { content: 'I proposed an edit to [[Start here]]. Review the diff and accept it if it reads right.' },
]

// Test Connection's tiny request (papeliz-openai-compatible-client.ts), answered apart from the chat.
const connectionTestMessageText = 'Reply with the single word: ready'

function isConnectionTestRequest(providerRequestMessages: Array<{ content?: unknown }>): boolean {
  return providerRequestMessages.length === 1 && providerRequestMessages[0]?.content === connectionTestMessageText
}

function answerConnectionTest(route: Route): Promise<void> {
  return route.fulfill({
    status: 200,
    headers: testProviderCorsHeaders,
    json: { choices: [{ index: 0, message: { role: 'assistant', content: 'ready' }, finish_reason: 'stop' }] },
  })
}

const testProviderCorsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
}

// Answers the provider's chat calls from `testProviderReplies`, in order, and refuses every other
// request that would leave this computer. Test Connection's request is answered apart and only its key
// is noted. Returns what the page asked the provider, and anything refused.
async function playTestProvider(
  page: Page,
  testProviderReplies: TestProviderReply[],
): Promise<{ testProviderChatRequests: TestProviderChatRequest[]; testProviderConnectionTestAuthorizations: Array<string | null>; refusedOutsideRequestUrls: string[] }> {
  const testProviderChatRequests: TestProviderChatRequest[] = []
  const testProviderConnectionTestAuthorizations: Array<string | null> = []
  const refusedOutsideRequestUrls: string[] = []
  // Routes added later are tried first: the provider's own, then this guard for everything else.
  await page.route('**/*', async (route: Route) => {
    const requestUrl = new URL(route.request().url())
    if (requestUrl.hostname === '127.0.0.1' || requestUrl.hostname === 'localhost') return route.continue()
    refusedOutsideRequestUrls.push(requestUrl.href)
    return route.abort('blockedbyclient')
  })
  await page.route(`${testProviderBaseUrl}/**`, async (route: Route) => {
    const providerRequest = route.request()
    if (providerRequest.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: testProviderCorsHeaders })
    if (providerRequest.method() !== 'POST' || !providerRequest.url().endsWith('/chat/completions')) {
      return route.fulfill({ status: 404, headers: testProviderCorsHeaders, json: { error: { message: 'Not served by the test provider.' } } })
    }
    const providerRequestBody = providerRequest.postDataJSON() as {
      model: string
      messages: TestProviderChatRequest['providerRequestMessages']
      tools?: Array<{ function: { name: string } }>
    }
    if (isConnectionTestRequest(providerRequestBody.messages)) {
      testProviderConnectionTestAuthorizations.push(await providerRequest.headerValue('authorization'))
      return answerConnectionTest(route)
    }
    testProviderChatRequests.push({
      providerRequestAuthorization: await providerRequest.headerValue('authorization'),
      providerRequestModelName: providerRequestBody.model,
      providerRequestMessages: providerRequestBody.messages,
      providerRequestToolNames: (providerRequestBody.tools ?? []).map((providerTool) => providerTool.function.name),
    })
    const testProviderReply = testProviderReplies[testProviderChatRequests.length - 1] ?? { content: 'Done.' }
    return route.fulfill({
      status: 200,
      headers: testProviderCorsHeaders,
      json: {
        id: `chatcmpl-test-${testProviderChatRequests.length}`,
        object: 'chat.completion',
        model: testProviderModelName,
        choices: [{ index: 0, message: { role: 'assistant', ...testProviderReply }, finish_reason: 'tool_calls' in testProviderReply ? 'tool_calls' : 'stop' }],
        usage: { prompt_tokens: 1200 * testProviderChatRequests.length, completion_tokens: 40 },
      },
    })
  })
  return { testProviderChatRequests, testProviderConnectionTestAuthorizations, refusedOutsideRequestUrls }
}

// A Custom provider at the test provider's address, added on the Settings panel's AI Provider page,
// which the panel's set-up button opens: Add Provider, Custom, then its address, key and a typed
// model. Add Provider stays off until Test Connection passes. Esc then closes the panel.
async function setUpTestProvider(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Choose a Provider' }).click()
  const settingsPanel = page.getByRole('dialog', { name: 'Settings' })
  await expect(settingsPanel.getByRole('heading', { name: 'Saved Providers' })).toBeVisible()
  await settingsPanel.getByRole('button', { name: 'Add Provider', exact: true }).click()
  await page.getByRole('dialog', { name: 'Add Provider' }).getByRole('option', { name: /^Custom/ }).click()
  const addCustomDialog = page.getByRole('dialog', { name: 'Add Custom' })
  await addCustomDialog.getByRole('textbox', { name: 'Base URL' }).fill(testProviderBaseUrl)
  await addCustomDialog.getByLabel(/^API Key/).fill(testProviderApiKey)
  await addCustomDialog.getByRole('textbox', { name: 'Model Name' }).fill(testProviderModelName)
  await addCustomDialog.getByRole('button', { name: 'Add Model', exact: true }).click()
  await expect(addCustomDialog.getByRole('switch', { name: testProviderModelName })).toHaveAttribute('aria-checked', 'true')
  await expect(addCustomDialog.getByRole('button', { name: 'Add Provider', exact: true })).toBeDisabled()
  await addCustomDialog.getByRole('button', { name: 'Test Connection', exact: true }).click()
  await expect(addCustomDialog.getByText(`Connected. ${testProviderModelName} answered`, { exact: false })).toBeVisible()
  await addCustomDialog.getByRole('button', { name: 'Add Provider', exact: true }).click()
  await expect(addCustomDialog).toBeHidden()
  await expect(settingsPanel.getByRole('listitem').filter({ hasText: 'Custom' })).toContainText('1 model on')
  await page.keyboard.press('Escape')
  await expect(settingsPanel).toBeHidden()
}

test('the assistant proposes an edit to a sample note, shows the diff, and changes the note only once it is accepted', async ({ page }) => {
  const { testProviderChatRequests, refusedOutsideRequestUrls } = await playTestProvider(page, startHereEditProviderReplies)
  await page.goto('/')
  await page.getByRole('button', { name: 'Try Sample' }).first().click()
  const noteEditorContent = page.locator('.cm-content').first()
  await expect(noteEditorContent).toContainText(startHereOriginalSentence)

  await setUpTestProvider(page)
  // Write proposes changes; each one waits for review.
  await page.getByRole('radio', { name: 'Write' }).click()
  await expect(page.getByText('Edits, adds and deletes notes. You review each change.')).toBeVisible()
  const assistantComposer = page.getByRole('textbox', { name: 'Message the assistant' })
  await assistantComposer.fill('Make the first sentence of this note name the app.')
  await assistantComposer.press('Enter')

  // The diff: the card names the note and the reason, with the removed and added words.
  const proposalAcceptButton = page.getByRole('button', { name: 'Accept', exact: true }).first()
  await expect(proposalAcceptButton).toBeVisible()
  await expect(page.getByText(startHereEditReason)).toBeVisible()
  await expect(page.locator('.papeliz-text-diff-added').first()).toContainText('Papeliz')
  await expect(page.getByText('I proposed an edit to')).toBeVisible()
  // Nothing has changed yet.
  await expect(noteEditorContent).toContainText(startHereOriginalSentence)
  await expect(noteEditorContent).not.toContainText(startHereEditedSentence)

  // View shows the whole note as it would be, read-only; Accept there writes it.
  await page.getByRole('button', { name: 'View', exact: true }).click()
  const proposalPreview = page.getByRole('region', { name: 'Proposed Start here, read-only' })
  await expect(proposalPreview).toContainText(startHereEditedSentence)
  await proposalPreview.getByRole('button', { name: 'Accept', exact: true }).click()
  await expect(proposalPreview).toBeHidden()
  await expect(page.getByText('Accepted', { exact: true })).toBeVisible()
  await expect(noteEditorContent).toContainText(startHereEditedSentence)
  await expect(noteEditorContent).not.toContainText(startHereOriginalSentence)

  // What the provider was sent: the made-up key and model, the request with the edit tool, then the
  // tool's result for the proposal.
  expect(testProviderChatRequests).toHaveLength(2)
  for (const testProviderChatRequest of testProviderChatRequests) {
    expect(testProviderChatRequest.providerRequestAuthorization).toBe(`Bearer ${testProviderApiKey}`)
    expect(testProviderChatRequest.providerRequestModelName).toBe(testProviderModelName)
  }
  const [firstChatRequest, secondChatRequest] = testProviderChatRequests
  expect(firstChatRequest?.providerRequestToolNames).toContain('proposeVaultNoteEdit')
  expect(JSON.stringify(firstChatRequest?.providerRequestMessages.at(-1))).toContain('Make the first sentence of this note name the app.')
  const proposalToolResult = secondChatRequest?.providerRequestMessages.find((providerMessage) => providerMessage.tool_call_id === 'call_propose_start_here_edit')
  expect(JSON.stringify(proposalToolResult?.content)).toContain('proposed')
  expect(refusedOutsideRequestUrls).toEqual([])
})

// An answer with a web picture and a picture kept in the vault. The web picture waits behind Show,
// and its host hears nothing until Show is pressed; the vault picture shows as MD View shows it.
const webPictureTestAddress = 'https://pictures.papeliz-test.invalid/quarterly-chart.svg'
const webPictureTestHostName = 'pictures.papeliz-test.invalid'
const pictureAnswerProviderReplies: TestProviderReply[] = [
  { content: `Here is the chart: ![Quarterly chart](${webPictureTestAddress})

And the plan: ![Floor plan](Attachments/floor-plan.png)` },
]

test('a web picture in an answer loads only once Show is pressed, and a vault picture shows as in MD View', async ({ page }) => {
  const { refusedOutsideRequestUrls } = await playTestProvider(page, pictureAnswerProviderReplies)
  // Tried before the guard: the picture's host answers with a small drawing and counts each request.
  const webPictureRequestUrls: string[] = []
  await page.route(`https://${webPictureTestHostName}/**`, async (route: Route) => {
    webPictureRequestUrls.push(route.request().url())
    return route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="#0064d4"/></svg>',
    })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Try Sample' }).first().click()
  await setUpTestProvider(page)
  const assistantComposer = page.getByRole('textbox', { name: 'Message the assistant' })
  await assistantComposer.fill('Show me the quarterly chart and the floor plan.')
  await assistantComposer.press('Enter')

  const assistantAnswer = page.locator('.papeliz-assistant-message-markdown').filter({ hasText: 'Here is the chart' })
  const webPicturePlaceholder = assistantAnswer.locator('.papeliz-assistant-web-picture-placeholder')
  await expect(webPicturePlaceholder).toContainText('Image: Quarterly chart')
  await expect(webPicturePlaceholder).toContainText(webPictureTestHostName)
  await expect(assistantAnswer.getByText('Image: Floor plan', { exact: true })).toBeVisible()
  await expect(assistantAnswer.locator('img')).toHaveCount(0)
  expect(webPictureRequestUrls).toEqual([])

  await assistantAnswer.getByRole('button', { name: `Show the picture from ${webPictureTestHostName}` }).click()
  const shownWebPicture = assistantAnswer.getByRole('img', { name: 'Quarterly chart' })
  await expect(shownWebPicture).toHaveAttribute('src', webPictureTestAddress)
  await expect.poll(() => shownWebPicture.evaluate((shownWebPictureElement: HTMLImageElement) => shownWebPictureElement.naturalWidth)).toBeGreaterThan(0)
  await expect(webPicturePlaceholder).toHaveCount(0)
  expect(webPictureRequestUrls).toEqual([webPictureTestAddress])
  // The vault picture still shows as MD View's label, with no Show button of its own.
  await expect(assistantAnswer.getByText('Image: Floor plan', { exact: true })).toBeVisible()
  await expect(assistantAnswer.getByRole('button', { name: /^Show/ })).toHaveCount(0)
  expect(refusedOutsideRequestUrls).toEqual([])
})

// A second provider the test plays on this computer's LM Studio address: it lists two models and
// records each chat call. Nothing reaches a real server there; the route answers first.
const secondTestProviderBaseUrl = 'http://localhost:1234/v1'
const secondTestProviderApiKey = 'papeliz-second-test-key-not-a-real-key'
const secondTestProviderModelNames = ['papeliz-second-model-a', 'papeliz-second-model-b'] as const

test('two providers each keep their own key, and the model chip sends each message to the model picked there', async ({ page }) => {
  const { testProviderChatRequests, testProviderConnectionTestAuthorizations, refusedOutsideRequestUrls } = await playTestProvider(page, [])
  const secondTestProviderChatRequests: Array<{ providerRequestAuthorization: string | null; providerRequestModelName: string }> = []
  const secondTestProviderConnectionTestAuthorizations: Array<string | null> = []
  await page.route(`${secondTestProviderBaseUrl}/**`, async (route: Route) => {
    const providerRequest = route.request()
    if (providerRequest.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: testProviderCorsHeaders })
    if (providerRequest.method() === 'GET' && providerRequest.url().endsWith('/models')) {
      return route.fulfill({ status: 200, headers: testProviderCorsHeaders, json: { data: secondTestProviderModelNames.map((providerModelName) => ({ id: providerModelName })) } })
    }
    const providerRequestBody = providerRequest.postDataJSON() as { model: string; messages: Array<{ content?: unknown }> }
    if (isConnectionTestRequest(providerRequestBody.messages)) {
      secondTestProviderConnectionTestAuthorizations.push(await providerRequest.headerValue('authorization'))
      return answerConnectionTest(route)
    }
    secondTestProviderChatRequests.push({ providerRequestAuthorization: await providerRequest.headerValue('authorization'), providerRequestModelName: providerRequestBody.model })
    return route.fulfill({
      status: 200,
      headers: testProviderCorsHeaders,
      json: { choices: [{ index: 0, message: { role: 'assistant', content: 'Answered by the second provider.' }, finish_reason: 'stop' }] },
    })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Try Sample' }).first().click()
  await setUpTestProvider(page)
  expect(testProviderConnectionTestAuthorizations).toEqual([`Bearer ${testProviderApiKey}`])

  // The model chip's menu leads to Settings › AI Provider; add the second provider there. Its test
  // lists its models first, and asks for one to be switched on before it can pass.
  const modelChip = page.getByRole('button', { name: `Model: ${testProviderModelName}` })
  await modelChip.click()
  await page.getByRole('menu', { name: 'Model' }).getByRole('menuitem', { name: 'AI Provider' }).click()
  const settingsPanel = page.getByRole('dialog', { name: 'Settings' })
  await settingsPanel.getByRole('button', { name: 'Add Provider', exact: true }).click()
  const addProviderDialog = page.getByRole('dialog', { name: 'Add Provider' })
  await expect(addProviderDialog.getByRole('option', { name: /^Custom/ })).toBeDisabled()
  await addProviderDialog.getByRole('option', { name: /^LM Studio Local/ }).click()
  const addLmStudioDialog = page.getByRole('dialog', { name: 'Add LM Studio Local' })
  await addLmStudioDialog.getByLabel(/^API Key/).fill(secondTestProviderApiKey)
  await addLmStudioDialog.getByRole('button', { name: 'Test Connection', exact: true }).click()
  await expect(addLmStudioDialog.getByText('2 models found.', { exact: false })).toBeVisible()
  await expect(addLmStudioDialog.getByRole('button', { name: 'Add Provider', exact: true })).toBeDisabled()
  await addLmStudioDialog.getByRole('switch', { name: secondTestProviderModelNames[1] }).click()
  await expect(addLmStudioDialog.getByRole('switch', { name: secondTestProviderModelNames[1] })).toHaveAttribute('aria-checked', 'true')
  await expect(addLmStudioDialog.getByRole('switch', { name: secondTestProviderModelNames[0] })).toHaveAttribute('aria-checked', 'false')
  await addLmStudioDialog.getByRole('button', { name: 'Test Connection', exact: true }).click()
  await expect(addLmStudioDialog.getByText(`Connected. ${secondTestProviderModelNames[1]} answered`, { exact: false })).toBeVisible()
  await addLmStudioDialog.getByRole('button', { name: 'Add Provider', exact: true }).click()
  await expect(addLmStudioDialog).toBeHidden()
  expect(secondTestProviderConnectionTestAuthorizations).toEqual([`Bearer ${secondTestProviderApiKey}`])
  // Where each key goes: its own provider's address, under its name.
  await expect(settingsPanel.getByRole('listitem').filter({ hasText: 'Custom' })).toContainText('papeliz-test-provider.invalid')
  await expect(settingsPanel.getByRole('listitem').filter({ hasText: 'LM Studio Local' })).toContainText('localhost:1234 · 1 model on')
  await page.keyboard.press('Escape')
  await expect(settingsPanel).toBeHidden()

  // Both providers' models are on the chip's menu; the second one answers once it is picked.
  await modelChip.click()
  const modelMenu = page.getByRole('menu', { name: 'Model' })
  await expect(modelMenu.getByRole('menuitemradio', { name: testProviderModelName })).toHaveAttribute('aria-checked', 'true')
  await expect(modelMenu.getByRole('menuitemradio', { name: secondTestProviderModelNames[0] })).toHaveCount(0)
  await modelMenu.getByRole('menuitemradio', { name: secondTestProviderModelNames[1] }).click()
  await expect(page.getByRole('button', { name: `Model: ${secondTestProviderModelNames[1]}` })).toBeVisible()
  const assistantComposer = page.getByRole('textbox', { name: 'Message the assistant' })
  await assistantComposer.fill('Which provider answers?')
  await assistantComposer.press('Enter')
  await expect(page.getByText('Answered by the second provider.')).toBeVisible()
  expect(secondTestProviderChatRequests).toEqual([
    { providerRequestAuthorization: `Bearer ${secondTestProviderApiKey}`, providerRequestModelName: secondTestProviderModelNames[1] },
  ])
  expect(testProviderChatRequests).toEqual([])

  // Picked back, the first provider answers, with its own key.
  await page.getByRole('button', { name: `Model: ${secondTestProviderModelNames[1]}` }).click()
  await page.getByRole('menu', { name: 'Model' }).getByRole('menuitemradio', { name: testProviderModelName }).click()
  await assistantComposer.fill('And now?')
  await assistantComposer.press('Enter')
  await expect.poll(() => testProviderChatRequests.length).toBe(1)
  expect(testProviderChatRequests[0]).toMatchObject({ providerRequestAuthorization: `Bearer ${testProviderApiKey}`, providerRequestModelName: testProviderModelName })
  expect(secondTestProviderChatRequests).toHaveLength(1)

  // The gear opens the provider's modal. Remove asks first; Esc cancels only the question, and the
  // modal stays open. Then the provider and its models are gone from the page and the chip.
  await page.getByRole('button', { name: `Model: ${testProviderModelName}` }).click()
  await page.getByRole('menu', { name: 'Model' }).getByRole('menuitem', { name: 'AI Provider' }).click()
  await settingsPanel.getByRole('button', { name: 'LM Studio Local Settings', exact: true }).click()
  const lmStudioDialog = page.getByRole('dialog', { name: 'LM Studio Local' })
  await lmStudioDialog.getByRole('button', { name: 'Remove Provider', exact: true }).click()
  const removeProviderDialog = page.getByRole('dialog', { name: 'Remove LM Studio Local?' })
  await expect(removeProviderDialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(removeProviderDialog).toBeHidden()
  await expect(lmStudioDialog).toBeVisible()
  await lmStudioDialog.getByRole('button', { name: 'Remove Provider', exact: true }).click()
  await removeProviderDialog.getByRole('button', { name: 'Remove Provider', exact: true }).click()
  await expect(lmStudioDialog).toBeHidden()
  await expect(settingsPanel.getByRole('listitem').filter({ hasText: 'LM Studio Local' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: `Model: ${testProviderModelName}` }).click()
  await expect(page.getByRole('menu', { name: 'Model' }).getByRole('menuitemradio')).toHaveCount(1)
  expect(refusedOutsideRequestUrls).toEqual([])
})
