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

const testProviderCorsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
}

// Answers the provider's chat calls from `testProviderReplies`, in order, and refuses every other
// request that would leave this computer. Returns what the page asked the provider, and anything refused.
async function playTestProvider(
  page: Page,
  testProviderReplies: TestProviderReply[],
): Promise<{ testProviderChatRequests: TestProviderChatRequest[]; refusedOutsideRequestUrls: string[] }> {
  const testProviderChatRequests: TestProviderChatRequest[] = []
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
  return { testProviderChatRequests, refusedOutsideRequestUrls }
}

// Settings for a Custom provider at the test provider's address, on the Settings panel's AI Provider
// page, which the panel's set-up button opens: the provider, address and key on Provider, the model on
// Model, then Save, and Esc closes the panel.
async function setUpTestProvider(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Choose a Provider' }).click()
  const settingsPanel = page.getByRole('dialog', { name: 'Settings' })
  await expect(settingsPanel.getByRole('tab', { name: 'Provider' })).toHaveAttribute('aria-selected', 'true')
  await settingsPanel.getByRole('button', { name: /Provider/ }).click()
  await page.getByRole('option', { name: /^Custom/ }).click()
  await settingsPanel.getByRole('textbox', { name: 'Base URL' }).fill(testProviderBaseUrl)
  await settingsPanel.getByLabel(/^API key/).fill(testProviderApiKey)
  await settingsPanel.getByRole('tab', { name: 'Model' }).click()
  await settingsPanel.getByRole('combobox', { name: 'Model', exact: true }).or(settingsPanel.getByRole('textbox', { name: 'Model', exact: true })).fill(testProviderModelName)
  await settingsPanel.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(settingsPanel.getByText('Saved', { exact: true })).toBeVisible()
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
