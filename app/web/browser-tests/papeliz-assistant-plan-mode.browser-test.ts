import { expect, test, type Page, type Route } from '@playwright/test'

// Plan mode in a real browser, against a provider the test plays: in the sample vault, ask for a plan,
// change it on its card (a step's words, its order, a step ticked as done), Build it, review the first
// step's change, Stop the second step while it runs, Continue it, and see the plan built, its note in
// Plans/ ticked. Every provider call is answered here, and any other request off this computer is
// refused, so no real key or outside network is used.

const testProviderBaseUrl = 'https://papeliz-test-provider.invalid/v1'
const testProviderApiKey = 'papeliz-test-key-not-a-real-key'
const testProviderModelName = 'papeliz-test-model'
const connectionTestMessageText = 'Reply with the single word: ready'

const startHereOriginalSentence = 'Welcome to the sample vault.'
const startHereEditedSentence = 'Welcome to the Papeliz sample vault.'

const tidyStartNotePlanText = [
  'I read the sample notes.',
  '',
  '# Tidy the start note',
  '',
  'Goal: A clearer first note.',
  '',
  '- [ ] Name the app in [[Start here]].',
  '- [ ] Add a line about [[Plan Ideas]].',
  '- [ ] Link the sample notes from [[Start here]].',
].join('\n')

const testProviderCorsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
}

interface TestProviderChatRequest {
  providerRequestMessages: Array<{ role: string; content?: unknown }>
  providerRequestToolNames: string[]
}

type TestProviderReply = { content: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }

// Answers each chat call from what it asks (`answerTestProviderRequest`), or holds it unanswered when
// that gives 'hold', and refuses every other request that would leave this computer.
async function playPlanTestProvider(
  page: Page,
  answerTestProviderRequest: (testProviderChatRequest: TestProviderChatRequest) => TestProviderReply | 'hold',
): Promise<{ testProviderChatRequests: TestProviderChatRequest[]; heldProviderRoutes: Route[]; refusedOutsideRequestUrls: string[] }> {
  const testProviderChatRequests: TestProviderChatRequest[] = []
  const heldProviderRoutes: Route[] = []
  const refusedOutsideRequestUrls: string[] = []
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
    const providerRequestBody = providerRequest.postDataJSON() as { messages: TestProviderChatRequest['providerRequestMessages']; tools?: Array<{ function: { name: string } }> }
    if (providerRequestBody.messages.length === 1 && providerRequestBody.messages[0]?.content === connectionTestMessageText) {
      return route.fulfill({ status: 200, headers: testProviderCorsHeaders, json: { choices: [{ index: 0, message: { role: 'assistant', content: 'ready' }, finish_reason: 'stop' }] } })
    }
    const testProviderChatRequest: TestProviderChatRequest = {
      providerRequestMessages: providerRequestBody.messages,
      providerRequestToolNames: (providerRequestBody.tools ?? []).map((providerTool) => providerTool.function.name),
    }
    testProviderChatRequests.push(testProviderChatRequest)
    const testProviderReply = answerTestProviderRequest(testProviderChatRequest)
    if (testProviderReply === 'hold') {
      heldProviderRoutes.push(route)
      return
    }
    return route.fulfill({
      status: 200,
      headers: testProviderCorsHeaders,
      json: {
        id: `chatcmpl-test-${testProviderChatRequests.length}`,
        object: 'chat.completion',
        model: testProviderModelName,
        choices: [{ index: 0, message: { role: 'assistant', ...testProviderReply }, finish_reason: testProviderReply.tool_calls === undefined ? 'stop' : 'tool_calls' }],
        usage: { prompt_tokens: 900, completion_tokens: 40 },
      },
    })
  })
  return { testProviderChatRequests, heldProviderRoutes, refusedOutsideRequestUrls }
}

// A Custom provider at the test provider's address, added on the Settings panel's AI Provider page.
async function setUpTestProvider(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Choose a Provider' }).click()
  const settingsPanel = page.getByRole('dialog', { name: 'Settings' })
  await settingsPanel.getByRole('button', { name: 'Add Provider', exact: true }).click()
  const addCustomDialog = page.getByRole('dialog', { name: 'Add Provider' })
  await addCustomDialog.getByRole('button', { name: /^Provider / }).click()
  await addCustomDialog.getByRole('option', { name: /^Custom/ }).click()
  await addCustomDialog.getByRole('textbox', { name: 'Base URL' }).fill(testProviderBaseUrl)
  await addCustomDialog.getByLabel(/^API Key/).fill(testProviderApiKey)
  await addCustomDialog.getByRole('textbox', { name: 'Model Name' }).fill(testProviderModelName)
  await addCustomDialog.getByRole('button', { name: 'Add Model', exact: true }).click()
  await addCustomDialog.getByRole('button', { name: 'Test Connection', exact: true }).click()
  await expect(addCustomDialog.getByText(`Connected. ${testProviderModelName} answered`, { exact: false })).toBeVisible()
  await addCustomDialog.getByRole('button', { name: 'Add Provider', exact: true }).click()
  await expect(addCustomDialog).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(settingsPanel).toBeHidden()
}

function readLastProviderMessageText(testProviderChatRequest: TestProviderChatRequest): string {
  const lastProviderMessage = testProviderChatRequest.providerRequestMessages.at(-1)
  return typeof lastProviderMessage?.content === 'string' ? lastProviderMessage.content : ''
}

test('Plan writes a plan that is changed on its card, then Build reviews each step, stops and continues', async ({ page }) => {
  let isSecondStepHeld = true
  const { testProviderChatRequests, heldProviderRoutes, refusedOutsideRequestUrls } = await playPlanTestProvider(page, (testProviderChatRequest) => {
    if (testProviderChatRequest.providerRequestMessages.at(-1)?.role === 'tool') return { content: 'I proposed naming the app.' }
    const lastMessageText = readLastProviderMessageText(testProviderChatRequest)
    if (lastMessageText.startsWith('Build step 1 of 3')) {
      return {
        content: null,
        tool_calls: [
          {
            id: 'call_name_the_app',
            type: 'function',
            function: {
              name: 'proposeVaultNoteEdit',
              arguments: JSON.stringify({
                vaultNoteRelativePath: 'Start here.md',
                edits: [{ findText: startHereOriginalSentence, replaceWithText: startHereEditedSentence }],
                reason: 'Names the app in the first sentence.',
              }),
            },
          },
        ],
      }
    }
    if (lastMessageText.startsWith('Build step 2 of 3')) {
      if (isSecondStepHeld) return 'hold'
      return { content: 'The other sample notes already link to it, so nothing needed changing.' }
    }
    return { content: tidyStartNotePlanText }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Try Sample' }).first().click()
  const noteEditorContent = page.locator('.cm-content').first()
  await expect(noteEditorContent).toContainText(startHereOriginalSentence)
  await setUpTestProvider(page)

  await page.getByRole('radio', { name: 'Plan' }).click()
  await expect(page.getByText('Plans are saved in the Plans folder when you build them.')).toBeVisible()
  const assistantComposer = page.getByRole('textbox', { name: 'Message the assistant' })
  await assistantComposer.fill('Plan a tidy-up of the start note.')
  await assistantComposer.press('Enter')

  // The plan, as a card of steps; a note a step creates is outlined, and listed under Creates.
  const planCard = page.getByRole('group', { name: 'Plan: Tidy the start note' })
  await expect(planCard).toBeVisible()
  await expect(planCard.getByText('A clearer first note.')).toBeVisible()
  const planStepList = planCard.getByRole('list', { name: 'Steps' })
  await expect(planStepList.getByRole('listitem')).toHaveCount(3)
  await expect(planCard.getByText('Creates')).toBeVisible()
  expect(testProviderChatRequests[0]?.providerRequestToolNames.some((toolName) => toolName.startsWith('propose'))).toBe(false)

  // Change step 3's words, move it up with Alt+Up, and tick the step about Plan Ideas as already done.
  await planCard.getByRole('button', { name: 'Change Step 3' }).click()
  const stepWordsBox = planCard.getByRole('textbox', { name: 'Step 3' })
  await expect(stepWordsBox).toBeFocused()
  await stepWordsBox.fill('Link [[Start here]] from the other sample notes.')
  await stepWordsBox.press('Enter')
  await expect(planStepList.getByRole('listitem').nth(2)).toContainText('Link Start here from the other sample notes.')
  await planCard.getByRole('checkbox', { name: 'Step 3 Done' }).focus()
  await page.keyboard.press('Alt+ArrowUp')
  await expect(planStepList.getByRole('listitem').nth(1)).toContainText('Link Start here from the other sample notes.')
  await expect(planStepList.getByRole('listitem').nth(2)).toContainText('Add a line about Plan Ideas.')
  await planCard.getByRole('checkbox', { name: 'Step 3 Done' }).click()
  await expect(planCard.getByRole('checkbox', { name: 'Step 3 Done' })).toBeChecked()
  await expect(planCard.getByText('Builds 2 of 3 · 1 ticked')).toBeVisible()

  // Build saves the plan in Plans/, then step 1 proposes its change and waits for review.
  await planCard.getByRole('button', { name: 'Build', exact: true }).click()
  await expect(planCard.getByText('Step 1 of 3 · waiting for you')).toBeVisible()
  await expect(planCard.getByText('Saved in Plans')).toBeVisible()
  await expect(planCard.getByText('Needs review')).toBeVisible()
  await expect(noteEditorContent).toContainText(startHereOriginalSentence)
  const firstStepRequest = testProviderChatRequests.find((testProviderChatRequest) => readLastProviderMessageText(testProviderChatRequest).startsWith('Build step 1 of 3'))
  expect(readLastProviderMessageText(firstStepRequest!)).toContain('- [ ] Link [[Start here]] from the other sample notes.\n- [x] Add a line about [[Plan Ideas]].')
  expect(firstStepRequest?.providerRequestToolNames).toContain('proposeVaultNoteEdit')
  expect(firstStepRequest?.providerRequestToolNames).not.toContain('askUserQuestion')

  // Accepting it changes the note and starts step 2, which Stop ends while it runs.
  await planCard.getByRole('button', { name: 'Accept', exact: true }).click()
  await expect(noteEditorContent).toContainText(startHereEditedSentence)
  await expect(planCard.getByText('Step 2 of 3', { exact: true })).toBeVisible()
  await expect.poll(() => heldProviderRoutes.length).toBe(1)
  await planCard.getByRole('button', { name: 'Stop', exact: true }).click()
  await expect(planCard.getByText('Stopped at step 2')).toBeVisible()
  await expect(planCard.getByText('Stopped. Continue starts this step again.')).toBeVisible()
  await heldProviderRoutes[0]?.abort().catch(() => undefined)

  // Continue starts step 2 again; it needs no change, the ticked step is skipped, and the plan is built.
  isSecondStepHeld = false
  await planCard.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(planCard.getByText('Done · 3 of 3')).toBeVisible()
  expect(testProviderChatRequests.filter((testProviderChatRequest) => readLastProviderMessageText(testProviderChatRequest).startsWith('Build step 2 of 3'))).toHaveLength(2)
  expect(testProviderChatRequests.filter((testProviderChatRequest) => readLastProviderMessageText(testProviderChatRequest).startsWith('Build step 3'))).toHaveLength(0)

  // The plan's note in Plans/ is a ticked checklist tied to its chat (the editor draws its
  // frontmatter as properties and its ticks as checkboxes).
  await planCard.getByRole('button', { name: 'Open Plan Note', exact: true }).click()
  await expect(noteEditorContent.getByRole('listitem').filter({ hasText: /^papeliz-plan\s*done$/ })).toBeVisible()
  await expect(noteEditorContent.getByRole('listitem').filter({ hasText: /^papeliz-plan-chat\s*\S/ })).toContainText('Plan a tidy-up of the start note')
  await expect(noteEditorContent).toContainText('Name the app in Start here. Link Start here from the other sample notes. Add a line about Plan Ideas.')
  await expect(noteEditorContent.getByRole('checkbox', { checked: true })).toHaveCount(3)
  await expect(noteEditorContent.getByRole('checkbox', { checked: false })).toHaveCount(0)
  expect(refusedOutsideRequestUrls).toEqual([])
})
