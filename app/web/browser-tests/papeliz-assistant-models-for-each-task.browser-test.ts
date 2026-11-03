import { expect, test, type Locator, type Page, type Route } from '@playwright/test'

// Settings › AI Provider › Models for Each Task in a real browser, against providers the test plays at
// made-up addresses (each preset's base URL changed under Advanced, with a made-up key), so no real key
// or outside network is used: every other request off this computer is refused.
// - A provider that can neither transcribe nor draw: those rows say so, with Add Provider.
// - Transcribe on Automatic, then on a chosen model, then back: the row and the mic's hover follow.
// - Chat's row and the chat box's model chip are one choice.
// - The chip's "Models for Each Task" opens the page at the section.

const testProviderApiKey = 'papeliz-test-key-not-a-real-key'
const testProviderCorsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
}

interface PapelizTestProvider {
  providerPresetDisplayName: string
  testProviderBaseUrl: string
  testChatModelName: string
}

const testMetaProvider: PapelizTestProvider = { providerPresetDisplayName: 'Meta Model API', testProviderBaseUrl: 'https://papeliz-test-meta.invalid/v1', testChatModelName: 'muse-spark-1.3' }
const testOpenAiProvider: PapelizTestProvider = { providerPresetDisplayName: 'OpenAI', testProviderBaseUrl: 'https://papeliz-test-openai.invalid/v1', testChatModelName: 'gpt-test-chat' }
const testDeepSeekProvider: PapelizTestProvider = { providerPresetDisplayName: 'DeepSeek', testProviderBaseUrl: 'https://papeliz-test-deepseek.invalid/v1', testChatModelName: 'deepseek-flash' }

// Each test provider lists its one chat model and answers the connection test; anything else off this
// computer is refused.
async function playTestProviders(page: Page): Promise<string[]> {
  const refusedOutsideRequestUrls: string[] = []
  await page.route('**/*', async (route: Route) => {
    const requestUrl = new URL(route.request().url())
    if (requestUrl.hostname === '127.0.0.1' || requestUrl.hostname === 'localhost' || requestUrl.protocol === 'blob:' || requestUrl.protocol === 'data:') return route.continue()
    const testProvider = [testMetaProvider, testOpenAiProvider, testDeepSeekProvider].find((playedProvider) => route.request().url().startsWith(playedProvider.testProviderBaseUrl))
    if (testProvider === undefined) {
      refusedOutsideRequestUrls.push(requestUrl.href)
      return route.abort('blockedbyclient')
    }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: testProviderCorsHeaders })
    if (requestUrl.pathname.endsWith('/models')) return route.fulfill({ status: 200, headers: testProviderCorsHeaders, json: { data: [{ id: testProvider.testChatModelName }] } })
    if (requestUrl.pathname.endsWith('/chat/completions')) {
      return route.fulfill({
        status: 200,
        headers: testProviderCorsHeaders,
        json: { choices: [{ index: 0, message: { role: 'assistant', content: 'ready' }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 1 } },
      })
    }
    return route.fulfill({ status: 404, headers: testProviderCorsHeaders, json: { error: { message: 'Not served by the test provider.' } } })
  })
  return refusedOutsideRequestUrls
}

// Adds a provider from the open Settings panel, as a person does: the preset, a key, the base URL under
// Advanced, its chat model on, Test Connection, Add Provider.
async function addTestProvider(page: Page, testProvider: PapelizTestProvider): Promise<void> {
  const settingsPanel = page.getByRole('dialog', { name: 'Settings' })
  await settingsPanel.getByRole('button', { name: 'Add Provider', exact: true }).click()
  const addProviderDialog = page.getByRole('dialog', { name: 'Add Provider' })
  const providerChoiceButton = addProviderDialog.getByRole('button', { name: /^Provider / })
  if (!((await providerChoiceButton.getAttribute('aria-label')) ?? (await providerChoiceButton.innerText())).includes(testProvider.providerPresetDisplayName)) {
    await providerChoiceButton.click()
    await addProviderDialog.getByRole('option', { name: new RegExp(`^${testProvider.providerPresetDisplayName}`) }).click()
  }
  await expect(addProviderDialog.getByRole('button', { name: new RegExp(`^Provider ${testProvider.providerPresetDisplayName}`) })).toBeVisible()
  await addProviderDialog.getByLabel(/^API Key/).fill(testProviderApiKey)
  await addProviderDialog.getByRole('button', { name: /^Advanced/ }).click()
  await addProviderDialog.getByRole('textbox', { name: 'Base URL' }).fill(testProvider.testProviderBaseUrl)
  await addProviderDialog.getByRole('button', { name: 'Load Models', exact: true }).click()
  const chatModelSwitch = addProviderDialog.getByRole('switch', { name: testProvider.testChatModelName })
  await expect(chatModelSwitch).toBeVisible()
  if ((await chatModelSwitch.getAttribute('aria-checked')) !== 'true') await chatModelSwitch.click()
  await addProviderDialog.getByRole('button', { name: 'Test Connection', exact: true }).click()
  await expect(addProviderDialog.getByText(`Connected. ${testProvider.testChatModelName} answered`, { exact: false })).toBeVisible()
  await addProviderDialog.getByRole('button', { name: 'Add Provider', exact: true }).click()
  await expect(addProviderDialog).toBeHidden()
}

async function openSampleVaultAtAiProvider(page: Page): Promise<Locator> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try Sample' }).first().click()
  await expect(page.locator('.cm-content').first()).toContainText('Welcome to the sample vault.')
  await page.getByRole('button', { name: 'Choose a Provider' }).first().click()
  return page.getByRole('dialog', { name: 'Settings' })
}

function readModelsForEachTaskSection(settingsPanel: Locator): Locator {
  return settingsPanel.getByRole('region', { name: 'Models for Each Task' })
}

async function readMicTitle(page: Page): Promise<string> {
  return (await page.getByRole('complementary', { name: 'AI Assistant' }).getByRole('button', { name: 'Speak', exact: true }).getAttribute('title')) ?? ''
}

test('a provider that can neither transcribe nor draw: those rows say so, with Add Provider, and Describe Picture follows Chat', async ({ page }) => {
  const refusedOutsideRequestUrls = await playTestProviders(page)
  const settingsPanel = await openSampleVaultAtAiProvider(page)
  await addTestProvider(page, testDeepSeekProvider)
  const modelsForEachTaskSection = readModelsForEachTaskSection(settingsPanel)
  await expect(modelsForEachTaskSection.getByRole('button', { name: /^Chat/ })).toContainText('deepseek-flash · DeepSeek')
  await expect(modelsForEachTaskSection).toContainText('None of your providers transcribes.')
  await expect(modelsForEachTaskSection).toContainText('None of your providers makes pictures.')
  await expect(modelsForEachTaskSection.getByRole('button', { name: /^Describe Picture/ })).toContainText('Same as Chat · deepseek-flash')
  await expect(modelsForEachTaskSection).toContainText('The Meta Model API, OpenAI')
  await expect(modelsForEachTaskSection).toContainText('transcribe.')
  // The lock note no longer says the chip picks the model: the section does.
  await expect(settingsPanel).not.toContainText('picks the model for each message')
  // Add Provider in a row opens the same dialog as the page's button.
  await expect(modelsForEachTaskSection.getByRole('button', { name: 'Add Provider for Draw' })).toBeVisible()
  await modelsForEachTaskSection.getByRole('button', { name: 'Add Provider for Transcribe' }).click()
  await expect(page.getByRole('dialog', { name: 'Add Provider' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  // The mic names no transcription model, since nothing can transcribe.
  expect(await readMicTitle(page)).not.toContain('Transcribes with')
  expect(refusedOutsideRequestUrls).toEqual([])
})

test('Transcribe’s row moves the mic’s model and back to Automatic, and Chat’s row and the chip are one choice', async ({ page }) => {
  const refusedOutsideRequestUrls = await playTestProviders(page)
  const settingsPanel = await openSampleVaultAtAiProvider(page)
  await addTestProvider(page, testMetaProvider)
  const modelsForEachTaskSection = readModelsForEachTaskSection(settingsPanel)
  const transcribeRow = modelsForEachTaskSection.getByRole('button', { name: /^Transcribe/ })
  await expect(transcribeRow).toContainText('Automatic')
  await expect(transcribeRow).toContainText('muse-voice-transcribe-1.0 · Meta Model API')
  await expect(modelsForEachTaskSection.getByRole('button', { name: /^Draw/ })).toContainText('Automatic')
  await page.keyboard.press('Escape')
  await expect(settingsPanel).toBeHidden()
  expect(await readMicTitle(page)).toContain('Transcribes with muse-voice-transcribe-1.0, on Meta Model API.')

  // The chip's menu opens the page at the section.
  const assistantPanel = page.getByRole('complementary', { name: 'AI Assistant' })
  await assistantPanel.getByRole('button', { name: 'Model: muse-spark-1.3' }).click()
  await page.getByRole('menu', { name: 'Model' }).getByRole('menuitem', { name: 'Models for Each Task' }).click()
  await expect(modelsForEachTaskSection).toBeInViewport()

  // A second provider, then Transcribe on its model: no longer Automatic, and the mic follows.
  await addTestProvider(page, testOpenAiProvider)
  await transcribeRow.click()
  const transcribeModelMenu = page.getByRole('menu', { name: 'Transcribe Model' })
  await expect(transcribeModelMenu.getByRole('menuitemradio', { name: /^Automatic/ })).toHaveAttribute('aria-checked', 'true')
  await expect(transcribeModelMenu.getByRole('menuitemradio', { name: /^Automatic/ })).toContainText('muse-voice-transcribe-1.0 now')
  await transcribeModelMenu.getByRole('menuitemradio', { name: 'gpt-transcribe' }).click()
  await expect(transcribeRow).toContainText('gpt-transcribe · OpenAI')
  await expect(transcribeRow).not.toContainText('Automatic')
  await expect.poll(() => readMicTitle(page)).toContain('Transcribes with gpt-transcribe, on OpenAI.')

  // Chat's row: picking OpenAI's model is the chip's pick too.
  await modelsForEachTaskSection.getByRole('button', { name: /^Chat/ }).click()
  await page.getByRole('menu', { name: 'Chat Model' }).getByRole('menuitemradio', { name: 'gpt-test-chat' }).click()
  await expect(modelsForEachTaskSection.getByRole('button', { name: /^Chat/ })).toContainText('gpt-test-chat · OpenAI')
  await expect(assistantPanel.getByRole('button', { name: 'Model: gpt-test-chat' })).toBeVisible()
  // Describe Picture, on Same as Chat, follows the chat's model.
  await expect(modelsForEachTaskSection.getByRole('button', { name: /^Describe Picture/ })).toContainText('Same as Chat · gpt-test-chat')

  // Back to Automatic: the first provider that can, the Meta Model API.
  await transcribeRow.click()
  await page.getByRole('menu', { name: 'Transcribe Model' }).getByRole('menuitemradio', { name: /^Automatic/ }).click()
  await expect(transcribeRow).toContainText('Automatic')
  await expect.poll(() => readMicTitle(page)).toContain('Transcribes with muse-voice-transcribe-1.0, on Meta Model API.')
  expect(refusedOutsideRequestUrls).toEqual([])
})
