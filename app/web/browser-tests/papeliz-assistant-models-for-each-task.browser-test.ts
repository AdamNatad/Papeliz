import { expect, test, type Locator, type Page, type Route } from '@playwright/test'

// Settings › AI Provider › Models for Transcribe and Draw in a real browser, against providers the test
// plays at made-up addresses (each preset's base URL changed under Advanced, with a made-up key), so no
// real key or outside network is used: every other request off this computer is refused.
// - Only Transcribe and Draw have rows: Chat's model is the chip's, and Describe Picture uses it.
// - A provider that can neither transcribe nor draw: those rows are Add Provider, with who can.
// - Transcribe on Automatic (the green A), then on a chosen model, then back: the row and the mic's
//   hover follow.
// - The chip's "Models for Transcribe and Draw" opens the page at the section, and the page never
//   scrolls.

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
  return settingsPanel.getByRole('region', { name: 'Models for Transcribe and Draw' })
}

// The Settings panel's page column: it holds the whole AI Provider page without scrolling.
async function isSettingsPageScrolling(settingsPanel: Locator): Promise<boolean> {
  return settingsPanel
    .getByRole('heading', { name: 'Saved Providers' })
    .evaluate((savedProvidersHeading) => (savedProvidersHeading.parentElement === null ? true : savedProvidersHeading.parentElement.scrollHeight > savedProvidersHeading.parentElement.clientHeight))
}

async function readMicTitle(page: Page): Promise<string> {
  return (await page.getByRole('complementary', { name: 'AI Assistant' }).getByRole('button', { name: 'Speak', exact: true }).getAttribute('title')) ?? ''
}

test('a provider that can neither transcribe nor draw: those rows are Add Provider, and only Transcribe and Draw have rows', async ({ page }) => {
  const refusedOutsideRequestUrls = await playTestProviders(page)
  const settingsPanel = await openSampleVaultAtAiProvider(page)
  await addTestProvider(page, testDeepSeekProvider)
  await expect(settingsPanel).toContainText('Manage your configured API Keys.')
  const modelsForEachTaskSection = readModelsForEachTaskSection(settingsPanel)
  await expect(modelsForEachTaskSection).toContainText('Configure which AI model each task uses.')
  await expect(modelsForEachTaskSection.getByRole('listitem')).toHaveCount(2)
  await expect(modelsForEachTaskSection).not.toContainText('Chat')
  await expect(modelsForEachTaskSection).not.toContainText('Describe Picture')
  // Each row is Add Provider, with who can do the task in its hover and its description.
  const transcribeAddProviderRow = modelsForEachTaskSection.getByRole('button', { name: 'Add Provider for Transcribe' })
  await expect(transcribeAddProviderRow).toContainText('None of your providers transcribes.')
  await expect(transcribeAddProviderRow).toHaveAccessibleDescription(/^None of your providers transcribes\. The Meta Model API, OpenAI.* transcribe\.$/)
  await expect(transcribeAddProviderRow).toHaveAttribute('title', /^None of your providers transcribes\. The Meta Model API, OpenAI.* transcribe\.$/)
  const drawAddProviderRow = modelsForEachTaskSection.getByRole('button', { name: 'Add Provider for Draw' })
  await expect(drawAddProviderRow).toContainText('None of your providers makes pictures.')
  await expect(drawAddProviderRow).toHaveAccessibleDescription(/ make pictures\.$/)
  // The notes under the rows and the key note are gone.
  await expect(settingsPanel).not.toContainText('Automatic is the first')
  await expect(settingsPanel).not.toContainText('Each key stays')
  // Add Provider in a row opens the same dialog as the page's button, which stays blue.
  await expect(settingsPanel.getByRole('button', { name: 'Add Provider', exact: true })).toHaveCSS('background-color', 'rgb(0, 100, 212)')
  await transcribeAddProviderRow.click()
  await expect(page.getByRole('dialog', { name: 'Add Provider' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  // The mic names no transcription model, since nothing can transcribe.
  expect(await readMicTitle(page)).not.toContain('Transcribes with')
  expect(refusedOutsideRequestUrls).toEqual([])
})

test('Transcribe’s row moves the mic’s model and back to Automatic, and the page never scrolls', async ({ page }) => {
  const refusedOutsideRequestUrls = await playTestProviders(page)
  const settingsPanel = await openSampleVaultAtAiProvider(page)
  await addTestProvider(page, testMetaProvider)
  const modelsForEachTaskSection = readModelsForEachTaskSection(settingsPanel)
  const transcribeRow = modelsForEachTaskSection.getByRole('button', { name: /^Transcribe/ })
  // Automatic is the green A, named for screen readers, with what it uses as the row's description.
  await expect(transcribeRow.getByRole('img', { name: 'Automatic' })).toBeVisible()
  await expect(transcribeRow).toHaveAccessibleName('Transcribe Automatic muse-voice-transcribe-1.0 · Meta Model API')
  await expect(transcribeRow).toHaveAccessibleDescription('Uses the first of your providers that transcribes, the Meta Model API first.')
  await expect(transcribeRow).toContainText('muse-voice-transcribe-1.0 · Meta Model API')
  const drawRow = modelsForEachTaskSection.getByRole('button', { name: /^Draw/ })
  await expect(drawRow.getByRole('img', { name: 'Automatic' })).toBeVisible()
  await expect(drawRow).toHaveAccessibleDescription('Uses the first of your providers that makes pictures, the Meta Model API first.')
  // The A's tooltip on hover.
  await transcribeRow.getByRole('img', { name: 'Automatic' }).hover()
  await expect(page.getByText('Uses the first of your providers that transcribes, the Meta Model API first.', { exact: true }).last()).toBeVisible()
  expect(await isSettingsPageScrolling(settingsPanel)).toBe(false)
  await page.keyboard.press('Escape')
  await expect(settingsPanel).toBeHidden()
  expect(await readMicTitle(page)).toContain('Transcribes with muse-voice-transcribe-1.0, on Meta Model API.')

  // The chip's menu opens the page at the section.
  const assistantPanel = page.getByRole('complementary', { name: 'AI Assistant' })
  await assistantPanel.getByRole('button', { name: 'Model: muse-spark-1.3' }).click()
  await page.getByRole('menu', { name: 'Model' }).getByRole('menuitem', { name: 'Models for Transcribe and Draw' }).click()
  await expect(modelsForEachTaskSection).toBeInViewport()

  // A second provider, then Transcribe on its model: no longer Automatic, and the mic follows.
  await addTestProvider(page, testOpenAiProvider)
  expect(await isSettingsPageScrolling(settingsPanel)).toBe(false)
  await transcribeRow.click()
  const transcribeModelMenu = page.getByRole('menu', { name: 'Transcribe Model' })
  await expect(transcribeModelMenu.getByRole('menuitemradio', { name: /^Automatic/ })).toHaveAttribute('aria-checked', 'true')
  await expect(transcribeModelMenu.getByRole('menuitemradio', { name: /^Automatic/ })).toContainText('muse-voice-transcribe-1.0 now')
  await transcribeModelMenu.getByRole('menuitemradio', { name: 'gpt-transcribe' }).click()
  await expect(transcribeRow).toContainText('gpt-transcribe · OpenAI')
  await expect(transcribeRow.getByRole('img', { name: 'Automatic' })).toHaveCount(0)
  await expect(transcribeRow).not.toHaveAttribute('aria-describedby')
  await expect.poll(() => readMicTitle(page)).toContain('Transcribes with gpt-transcribe, on OpenAI.')

  // Back to Automatic: the first provider that can, the Meta Model API.
  await transcribeRow.click()
  await page.getByRole('menu', { name: 'Transcribe Model' }).getByRole('menuitemradio', { name: /^Automatic/ }).click()
  await expect(transcribeRow.getByRole('img', { name: 'Automatic' })).toBeVisible()
  await expect.poll(() => readMicTitle(page)).toContain('Transcribes with muse-voice-transcribe-1.0, on Meta Model API.')
  expect(refusedOutsideRequestUrls).toEqual([])
})
