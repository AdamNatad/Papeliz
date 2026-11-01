import { expect, test, type Page } from '@playwright/test'
import { computePapelizTemplateFileSha256Base64, computePapelizTemplateIncludedFileListDigest } from '../src/modules/template-gallery/papeliz-template-gallery-checks'
import type { PapelizTemplateGalleryRow } from '../src/modules/template-gallery/papeliz-template-gallery-contract'
import { createPapelizFakeTemplateNetwork, type PapelizFakeTemplateRepository } from '../src/modules/template-gallery/papeliz-template-gallery-fake-network.test-support'
import {
  createGardenJournalTemplateFiles,
  gardenJournalManifest,
  gardenJournalRepositoryName,
  gardenJournalTemplateCommitSha,
} from '../src/modules/template-gallery/papeliz-template-gallery-fixtures.test-support'

// Templates in a real browser, with GitHub, jsDelivr, raw files and the Templates server stubbed: the
// gallery lists a made-up template, its page renders its first note and what's inside, Preview shows a
// note picked in its file tree, and Use Template makes a browser vault from it that opens on the first
// note. Submit Template's Check names each check, and Submit stays off when one fails. Nothing reaches
// the network, and nothing asks the Templates server.

const gardenJournalTemplateFiles = createGardenJournalTemplateFiles()
// The same template with a script tag in a note, for the check that fails.
const scriptedJournalRepositoryName = { templateRepositoryOwner: 'garden-notes', templateRepositoryName: 'Scripted-Journal' }

const fakeTemplateRepositories: PapelizFakeTemplateRepository[] = [
  { ...gardenJournalRepositoryName, templateFilesByCommitSha: { [gardenJournalTemplateCommitSha]: gardenJournalTemplateFiles }, newestTemplateCommitSha: gardenJournalTemplateCommitSha },
  {
    ...scriptedJournalRepositoryName,
    templateFilesByCommitSha: { [gardenJournalTemplateCommitSha]: { ...gardenJournalTemplateFiles, 'Crops/Tomatoes.md': '# Tomatoes\n\n<script>alert(1)</script>\n' } },
    newestTemplateCommitSha: gardenJournalTemplateCommitSha,
  },
]

// Garden Journal's gallery row, as the built-in Featured list carries one: its files' fingerprint
// counts every file the manifest includes.
async function buildGardenJournalTemplateGalleryRow(): Promise<PapelizTemplateGalleryRow> {
  const includedTemplateFileSha256Base64ByRelativePath = new Map<string, string>()
  let templateIncludedByteCount = 0
  for (const [templateFileRelativePath, templateFileContents] of Object.entries(gardenJournalTemplateFiles)) {
    if (templateFileRelativePath === 'papeliz-template.json' || templateFileRelativePath.startsWith('drafts/')) continue
    const templateFileBytes = typeof templateFileContents === 'string' ? new TextEncoder().encode(templateFileContents) : templateFileContents
    includedTemplateFileSha256Base64ByRelativePath.set(templateFileRelativePath, await computePapelizTemplateFileSha256Base64(templateFileBytes))
    templateIncludedByteCount += templateFileBytes.length
  }
  return {
    papelizTemplateGalleryId: `${gardenJournalRepositoryName.templateRepositoryOwner}/${gardenJournalRepositoryName.templateRepositoryName}`,
    ...gardenJournalRepositoryName,
    templateCommitSha: gardenJournalTemplateCommitSha,
    templateIncludedFileListDigest: await computePapelizTemplateIncludedFileListDigest(includedTemplateFileSha256Base64ByRelativePath),
    templateName: gardenJournalManifest.templateName,
    templateDescription: gardenJournalManifest.templateDescription,
    templateTags: gardenJournalManifest.templateTags,
    templateFirstNotePath: gardenJournalManifest.templateFirstNotePath,
    templateLicenseId: 'MIT',
    templateThumbnailPictureUrl: null,
    templateIncludedFileCount: includedTemplateFileSha256Base64ByRelativePath.size,
    templateIncludedByteCount,
    isTemplateRunningCommands: false,
    isTemplateFeatured: true,
    templateListedAt: null,
    templateCheckedAt: null,
    templateUpVoteCount: 0,
    templateDownVoteCount: 0,
    templateTopRank: null,
  }
}

// GitHub, jsDelivr and raw files answer from the made-up repositories; the Templates server answers
// nothing, and each request to it is counted.
async function stubTemplateNetwork(page: Page): Promise<{ templatesServerRequestUrls: string[] }> {
  const fakeTemplateNetwork = createPapelizFakeTemplateNetwork(fakeTemplateRepositories)
  const templatesServerRequestUrls: string[] = []
  await page.route(/^https:\/\/(data\.jsdelivr\.com|cdn\.jsdelivr\.net|raw\.githubusercontent\.com|api\.github\.com)\//, async (stubbedRoute) => {
    const fakeTemplateResponse = await fakeTemplateNetwork.templateGalleryFetch(stubbedRoute.request().url())
    await stubbedRoute.fulfill({
      status: fakeTemplateResponse.status,
      headers: { ...Object.fromEntries(fakeTemplateResponse.headers), 'access-control-allow-origin': '*' },
      body: Buffer.from(await fakeTemplateResponse.arrayBuffer()),
    })
  })
  await page.route('**/api/templates/**', async (stubbedRoute) => {
    templatesServerRequestUrls.push(stubbedRoute.request().url())
    await stubbedRoute.fulfill({ status: 404, body: '' })
  })
  return { templatesServerRequestUrls }
}

async function openTemplates(page: Page) {
  await page.getByRole('region', { name: 'Start' }).getByRole('button', { name: /^Templates/ }).click()
  await expect(page.getByRole('heading', { name: 'Templates', exact: true })).toBeVisible()
}

test('Templates lists a template, shows its page and Preview, and makes a browser vault from it', async ({ page }) => {
  const { templatesServerRequestUrls } = await stubTemplateNetwork(page)
  await page.goto('/')
  const isBrowserStorageOn = await page.evaluate(() => navigator.storage.getDirectory().then(() => true, () => false))
  test.skip(!isBrowserStorageOn, 'This browser refuses its private storage (Playwright’s WebKit for Windows does), so it keeps no browser vaults.')

  await openTemplates(page)
  await expect(page.getByRole('region', { name: 'Start' }).getByRole('button', { name: /^Templates/ })).toHaveAttribute('aria-current', 'true')
  // New and Top 100 wait for the Templates server.
  await page.getByRole('tab', { name: 'Top 100' }).click()
  await expect(page.getByText('Top 100 isn’t available yet')).toBeVisible()
  await page.getByRole('tab', { name: 'Featured' }).click()

  // The template, as the built-in Featured list would carry it.
  const gardenJournalTemplateGalleryRow = await buildGardenJournalTemplateGalleryRow()
  await page.evaluate(async (seededTemplateGalleryRow) => {
    const { setPapelizTemplateGalleryRowsForTests } = await import('/src/modules/template-gallery/papeliz-template-gallery-store.ts')
    setPapelizTemplateGalleryRowsForTests([seededTemplateGalleryRow])
  }, gardenJournalTemplateGalleryRow)

  await page.getByRole('button', { name: /^Garden Journal/ }).click()
  await expect(page.getByRole('heading', { name: 'Garden Journal', exact: true })).toBeVisible()
  await expect(page.getByRole('article', { name: 'MD View' }).getByRole('heading', { name: 'Start here' })).toBeVisible()
  await expect(page.getByRole('region', { name: /What’s inside/ })).toContainText('Crops')

  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Preview · Garden Journal' })).toBeVisible()
  const previewFileTree = page.getByRole('navigation', { name: 'Files' })
  await previewFileTree.getByRole('button', { name: 'Crops' }).click()
  await previewFileTree.getByRole('button', { name: 'Tomatoes.md' }).click()
  await expect(page.getByRole('article', { name: 'MD View' }).getByRole('heading', { name: 'Tomatoes' })).toBeVisible()

  // Use Template: New Vault's form, with the template at its top, once its files are read and checked.
  await page.getByRole('button', { name: 'Use Template' }).click()
  await expect(page.getByRole('heading', { name: 'New Vault' })).toBeVisible()
  await expect(page.getByText('From Garden Journal')).toBeVisible()
  await expect(page.getByText(/^Checked: \d+ files go into the vault\.$/)).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Garden Journal')
  const browserStorageChoice = page.getByRole('radio', { name: /Browser Storage/ })
  if (await browserStorageChoice.isEnabled()) await browserStorageChoice.check()
  await page.getByRole('button', { name: 'Create Vault' }).click()

  // The vault opens on the template's first note in MD View, with its folders, and knows where it came
  // from.
  await expect(page.getByRole('textbox', { name: 'Note text' })).toContainText('One note per crop lives in Crops/.')
  await expect(page.getByRole('contentinfo')).toContainText('Start here.md')
  await expect(page.getByRole('group', { name: 'Note view' }).getByRole('button', { name: 'MD View' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('navigation', { name: 'Notes' }).getByText('Crops', { exact: true })).toBeVisible()
  const templateSourceFileText = await page.evaluate(async () => {
    const { listPapelizBrowserVaults, getPapelizBrowserVaultFolderHandle } = await import('/src/modules/vault/papeliz-browser-vaults.ts')
    const madeBrowserVaultRecord = (await listPapelizBrowserVaults()).find((browserVaultRecord) => browserVaultRecord.papelizVaultDisplayName === 'Garden Journal')
    const madeBrowserVaultFolder = await getPapelizBrowserVaultFolderHandle(madeBrowserVaultRecord!.papelizVaultId)
    const papelizFolder = await madeBrowserVaultFolder!.getDirectoryHandle('.papeliz')
    return (await (await papelizFolder.getFileHandle('template-source.json')).getFile()).text()
  })
  expect(JSON.parse(templateSourceFileText)).toMatchObject({ papelizTemplateGalleryId: 'garden-notes/Garden-Journal', templateSourceCommitSha: gardenJournalTemplateCommitSha })
  expect(templatesServerRequestUrls).toEqual([])
})

test('Submit Template checks a repository and keeps Submit off while a check fails', async ({ page }) => {
  const { templatesServerRequestUrls } = await stubTemplateNetwork(page)
  await page.goto('/')
  await openTemplates(page)
  await page.getByRole('button', { name: 'Submit Template' }).click()
  await expect(page.getByRole('heading', { name: 'Submit Template' })).toBeVisible()
  const repositoryLinkField = page.getByRole('textbox', { name: 'Repository link' })
  const submitButton = page.getByRole('button', { name: 'Submit', exact: true })

  await repositoryLinkField.fill('https://github.com/garden-notes/Garden-Journal')
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  const templateCheckList = page.getByRole('list', { name: 'Checks' })
  await expect(templateCheckList).toContainText('Its license is MIT.')
  await expect(submitButton).toBeEnabled()
  await submitButton.click()
  await expect(page.getByRole('status').filter({ hasText: 'Submitting opens with the Templates server' })).toBeVisible()

  await repositoryLinkField.fill('garden-notes/Scripted-Journal')
  await expect(templateCheckList).toHaveCount(0)
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  await expect(templateCheckList.getByRole('listitem').filter({ hasText: /^Failed: Notes/ })).toBeVisible()
  await expect(page.getByText('Fix what failed, push the change, and press Check again.')).toBeVisible()
  await expect(submitButton).toBeDisabled()
  expect(templatesServerRequestUrls).toEqual([])
})
