import { expect, test, type Page } from '@playwright/test'

// Text files in a browser vault, in a real browser: a JSON file opens in MD Code only, with JSON
// colors, and is edited and saved there; a JSON file that doesn't parse has the line where it stops
// marked; a `.gitignore` shows with Show Hidden and opens read-only, as hidden files do. While a
// text file is in front, MD View is greyed out, and a note's tab brings back the view picked for it.

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  const isBrowserStorageOn = await page.evaluate(() => navigator.storage.getDirectory().then(() => true, () => false))
  test.skip(!isBrowserStorageOn, 'This browser refuses its private storage (Playwright’s WebKit for Windows does), so it keeps no browser vaults.')
})

const textFilesBrowserVaultName = 'Agent Files'
const textFilesByName: Record<string, string> = {
  'Start.md': '# Start\n',
  'settings.json': '{\n  "hooks": { "Stop": [ { "command": "echo done" } ] },\n  "model": "sonnet",\n  "count": 3\n}\n',
  'broken.json': '{\n  "theme": "dark",\n}\n',
  '.gitignore': 'node_modules/\ndist/\n',
}

// Makes the browser vault straight through the app's own modules, as a vault left from an earlier
// visit would be.
async function seedBrowserVaultWithTextFiles(page: Page) {
  await page.evaluate(
    async ({ seededBrowserVaultName, seededTextFilesByName }) => {
      const { createPapelizBrowserVault, getPapelizBrowserVaultFolderHandle } = await import('/src/modules/vault/papeliz-browser-vaults.ts')
      const { createPapelizBrowserVaultFileContentsWriter } = await import('/src/modules/vault/papeliz-browser-vault-file-writer.ts')
      const seededBrowserVaultRecord = await createPapelizBrowserVault(seededBrowserVaultName)
      const seededBrowserVaultFolder = await getPapelizBrowserVaultFolderHandle(seededBrowserVaultRecord.papelizVaultId)
      const writeSeededFile = createPapelizBrowserVaultFileContentsWriter()
      for (const [seededFileName, seededFileText] of Object.entries(seededTextFilesByName)) {
        await writeSeededFile(await seededBrowserVaultFolder!.getFileHandle(seededFileName, { create: true }), seededFileText)
      }
    },
    { seededBrowserVaultName: textFilesBrowserVaultName, seededTextFilesByName: textFilesByName },
  )
  await page.reload()
}

async function readBrowserVaultFileText(page: Page, vaultFileName: string): Promise<string> {
  return page.evaluate(
    async ({ readBrowserVaultName, readVaultFileName }) => {
      const { listPapelizBrowserVaults, getPapelizBrowserVaultFolderHandle } = await import('/src/modules/vault/papeliz-browser-vaults.ts')
      const readBrowserVaultRecord = (await listPapelizBrowserVaults()).find((browserVaultRecord) => browserVaultRecord.papelizVaultDisplayName === readBrowserVaultName)
      const readBrowserVaultFolder = await getPapelizBrowserVaultFolderHandle(readBrowserVaultRecord!.papelizVaultId)
      // A page may be swapping the file in right now; the poll reads again.
      return (await (await readBrowserVaultFolder!.getFileHandle(readVaultFileName)).getFile()).text().catch(() => '')
    },
    { readBrowserVaultName: textFilesBrowserVaultName, readVaultFileName: vaultFileName },
  )
}

function findNoteViewButton(page: Page, noteViewLabel: 'MD Code' | 'MD View') {
  return page.getByRole('group', { name: 'Note view' }).getByRole('button', { name: noteViewLabel })
}

test('a browser vault opens a JSON file and a .gitignore in MD Code only, and keeps MD View for notes', async ({ page }) => {
  await seedBrowserVaultWithTextFiles(page)
  await page.getByRole('button', { name: new RegExp(`^${textFilesBrowserVaultName}`) }).first().click()
  await expect(page.locator('footer')).toContainText(textFilesBrowserVaultName)
  const fileList = page.getByRole('navigation', { name: 'Notes' })
  await expect(fileList.getByText('settings.json', { exact: true })).toBeVisible()
  await expect(fileList.getByText('.gitignore', { exact: true })).toHaveCount(0)

  // Notes open in MD View; a JSON file still opens in MD Code, with MD View greyed out.
  await fileList.getByText('Start', { exact: true }).click()
  await expect(findNoteViewButton(page, 'MD View')).toHaveAttribute('aria-pressed', 'true')
  await fileList.getByText('settings.json', { exact: true }).click()
  await expect(findNoteViewButton(page, 'MD Code')).toHaveAttribute('aria-pressed', 'true')
  await expect(findNoteViewButton(page, 'MD View')).toHaveAttribute('aria-disabled', 'true')
  await findNoteViewButton(page, 'MD View').click({ force: true })
  await expect(findNoteViewButton(page, 'MD Code')).toHaveAttribute('aria-pressed', 'true')

  // The JSON file edited and saved.
  const fileTextEditor = page.getByRole('textbox', { name: 'File text' })
  await expect(fileTextEditor).toContainText('"model": "sonnet"')
  await fileTextEditor.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('{ "model": "opus" }')
  await expect.poll(() => readBrowserVaultFileText(page, 'settings.json'), { timeout: 10_000 }).toBe('{ "model": "opus" }')

  // A JSON file that doesn't parse has the line where it stops marked.
  await fileList.getByText('broken.json', { exact: true }).click()
  await expect(page.locator('.papeliz-json-parse-problem-line')).toHaveText(/^}/)
  await expect(page.getByText('JSON stops parsing here')).toBeVisible()

  // Show Hidden lists the .gitignore; it opens as plain text, read-only.
  await page.getByRole('button', { name: 'Show Hidden' }).click()
  await fileList.getByText('.gitignore', { exact: true }).click()
  const gitignoreEditor = page.getByRole('textbox', { name: 'File text' })
  await expect(gitignoreEditor).toContainText('node_modules/')
  await expect(gitignoreEditor).toHaveAttribute('aria-readonly', 'true')
  await expect(page.getByRole('navigation', { name: 'Where this file is' })).toContainText('Read-only')

  // Back on the note, MD View comes back.
  await page.getByRole('button', { name: 'Start', exact: true }).first().click()
  await expect(findNoteViewButton(page, 'MD View')).toHaveAttribute('aria-pressed', 'true')
  await expect(findNoteViewButton(page, 'MD View')).not.toHaveAttribute('aria-disabled', 'true')
})
