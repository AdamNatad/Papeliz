import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { readPapelizImportZipFile } from '../src/modules/export-zip/papeliz-import-zip-file-reader'

// Browser vaults in a real browser: made, written, kept across a reload, shared by two pages,
// imported from a zip, backed up as a download, and written through the worker Safari before 26
// needs. Each test starts in a fresh browser context, so its storage starts empty. A browser that
// refuses its private storage skips them, and says so.

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  const isBrowserStorageOn = await page.evaluate(() => navigator.storage.getDirectory().then(() => true, () => false))
  test.skip(!isBrowserStorageOn, 'This browser refuses its private storage (Playwright’s WebKit for Windows does), so it keeps no browser vaults.')
})

// Chrome and Edge open folders too, so New Vault asks where to keep a vault there.
async function isFolderOnDiskOffered(page: Page): Promise<boolean> {
  return page.evaluate(() => typeof window.showDirectoryPicker === 'function')
}

const gardenNoteText = '# Garden\n\nKale\nBeans\nTomatoes\n'

// Makes a browser vault with one note straight through the app's own modules, as a vault left from
// an earlier visit would be.
async function seedBrowserVaultWithGardenNote(page: Page, papelizBrowserVaultName: string) {
  await page.goto('/')
  await page.evaluate(
    async ({ seededBrowserVaultName, seededGardenNoteText }) => {
      const { createPapelizBrowserVault, getPapelizBrowserVaultFolderHandle } = await import('/src/modules/vault/papeliz-browser-vaults.ts')
      const seededBrowserVaultRecord = await createPapelizBrowserVault(seededBrowserVaultName)
      const seededBrowserVaultFolder = await getPapelizBrowserVaultFolderHandle(seededBrowserVaultRecord.papelizVaultId)
      const gardenFileHandle = await seededBrowserVaultFolder!.getFileHandle('Garden.md', { create: true })
      const { createPapelizBrowserVaultFileContentsWriter } = await import('/src/modules/vault/papeliz-browser-vault-file-writer.ts')
      await createPapelizBrowserVaultFileContentsWriter()(gardenFileHandle, seededGardenNoteText)
    },
    { seededBrowserVaultName: papelizBrowserVaultName, seededGardenNoteText: gardenNoteText },
  )
  await page.reload()
}

async function openRecentBrowserVaultNote(page: Page, papelizBrowserVaultName: string, vaultNoteTitle: string) {
  await page.getByRole('button', { name: new RegExp(`^${papelizBrowserVaultName}`) }).first().click()
  await expect(page.locator('footer')).toContainText(papelizBrowserVaultName)
  await page.getByText(vaultNoteTitle, { exact: true }).first().click()
  await expect(page.locator('.cm-content')).toBeVisible()
}

async function readBrowserVaultNoteText(page: Page, papelizBrowserVaultName: string, vaultNoteFileName: string): Promise<string> {
  return page.evaluate(
    async ({ readBrowserVaultName, readVaultNoteFileName }) => {
      const { listPapelizBrowserVaults, getPapelizBrowserVaultFolderHandle } = await import('/src/modules/vault/papeliz-browser-vaults.ts')
      const readBrowserVaultRecord = (await listPapelizBrowserVaults()).find((browserVaultRecord) => browserVaultRecord.papelizVaultDisplayName === readBrowserVaultName)
      const readBrowserVaultFolder = await getPapelizBrowserVaultFolderHandle(readBrowserVaultRecord!.papelizVaultId)
      // A page may be swapping the note in right now; the poll reads again.
      return (await (await readBrowserVaultFolder!.getFileHandle(readVaultNoteFileName)).getFile()).text().catch(() => '')
    },
    { readBrowserVaultName: papelizBrowserVaultName, readVaultNoteFileName: vaultNoteFileName },
  )
}

test('the start page offers browser vaults, and no folder actions that can’t work', async ({ page }) => {
  const isFolderVaultOffered = await isFolderOnDiskOffered(page)
  await expect(page.getByRole('button', { name: /^New Vault/ })).toContainText(isFolderVaultOffered ? 'On disk or in this browser.' : 'Kept in this browser.')
  // Importing happens inside an open vault, not from the start page.
  await expect(page.getByRole('button', { name: /^Import Vault/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Open Vault/ })).toHaveCount(isFolderVaultOffered ? 1 : 0)
})

test('a new browser vault keeps its notes across a reload', async ({ page }) => {
  await page.getByRole('button', { name: /^New Vault/ }).click()
  // New Vault's form takes Recent Vaults' place in the start card. Where folders work it starts on
  // Folder Storage; elsewhere that card is off and Browser Storage is chosen already.
  const newVaultForm = page.getByRole('region', { name: 'New Vault' })
  if (await isFolderOnDiskOffered(page)) await newVaultForm.getByRole('radio', { name: /^Browser Storage/ }).click()
  await newVaultForm.getByLabel('Name').fill('Field Notes')
  await newVaultForm.getByRole('button', { name: 'Create Vault' }).click()
  // The first note starts with its name ready to type.
  await page.waitForFunction(() => document.activeElement instanceof HTMLInputElement)
  await page.keyboard.press('Control+a')
  await page.keyboard.type('Garden')
  await page.keyboard.press('Enter')
  await page.locator('.cm-content').click()
  await page.keyboard.type('# Garden\n\nKale and beans.')
  await expect(page.locator('footer')).toContainText('Saved in browser')
  await page.reload()
  await expect(page.getByRole('button', { name: /Field Notes/ }).first()).toContainText('In this browser')
  await openRecentBrowserVaultNote(page, 'Field Notes', 'Garden')
  await expect(page.locator('.cm-content')).toContainText('Kale and beans.')
})

test('two pages saving one note at the same moment keep both changes', async ({ page, context }) => {
  await seedBrowserVaultWithGardenNote(page, 'Field Notes')
  const secondPage = await context.newPage()
  await secondPage.goto('/')
  await openRecentBrowserVaultNote(page, 'Field Notes', 'Garden')
  await openRecentBrowserVaultNote(secondPage, 'Field Notes', 'Garden')
  // The first page changes "Kale", the second "Tomatoes"; both save at once.
  for (const [editingPage, editedLineNumber, addedText] of [
    [page, 3, ', curly'],
    [secondPage, 5, ', cherry'],
  ] as const) {
    await editingPage.locator('.cm-line').nth(editedLineNumber - 1).click()
    await editingPage.keyboard.press('End')
    await editingPage.keyboard.type(addedText)
  }
  await Promise.all([page.keyboard.press('Control+s'), secondPage.keyboard.press('Control+s')])
  await expect.poll(() => readBrowserVaultNoteText(page, 'Field Notes', 'Garden.md')).toBe('# Garden\n\nKale, curly\nBeans\nTomatoes, cherry\n')
  // A vault open in a page can't be deleted from another.
  const deleteOutcome = await secondPage.evaluate(async () => {
    const { listPapelizBrowserVaults, deletePapelizBrowserVault } = await import('/src/modules/vault/papeliz-browser-vaults.ts')
    const [openBrowserVaultRecord] = await listPapelizBrowserVaults()
    return deletePapelizBrowserVault(openBrowserVaultRecord!)
  })
  expect(deleteOutcome).toEqual({ browserVaultDeleteOutcome: 'failed', browserVaultDeleteFailureMessage: 'Couldn’t delete “Field Notes” (Open In Another Tab)' })
})

test('a zip imports as a new browser vault, and Download backup saves it all as a zip', async ({ page }) => {
  // Chrome and Edge would ask where to save it in a window the test can't answer: download it instead,
  // as every other browser does.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined })
  })
  await page.reload()
  const importZipBytes = await page.evaluate(async () => {
    const { writePapelizExportZipFile } = await import('/src/modules/export-zip/papeliz-export-zip-file-writer.ts')
    const utf8Encoder = new TextEncoder()
    const importZipBlob = await writePapelizExportZipFile(
      [
        ['Garden Club/Inbox.md', '# Inbox\n\nSeeds to order.'],
        ['Garden Club/Plans/Spring.md', '# Spring'],
        ['Garden Club/.trash/Old.md', '# Old'],
      ].map(([zipEntryPath, zipEntryText]) => ({ zipEntryPath: zipEntryPath!, zipEntryBytes: utf8Encoder.encode(zipEntryText) })),
      { zipEntryModifiedDate: new Date() },
    )
    return [...new Uint8Array(await importZipBlob.arrayBuffer())]
  })
  // The start page has no import any more, so the zip goes in through the app's own import module, as
  // the import inside an open vault will; the new vault is then opened from Recent Vaults.
  const importedBrowserVaultName = await page.evaluate(async (importZipByteValues) => {
    const { planPapelizBrowserVaultImportFromZip, importPapelizBrowserVault } = await import('/src/modules/vault/papeliz-browser-vault-import.ts')
    const browserVaultImportPlan = await planPapelizBrowserVaultImportFromZip('Garden Club.zip', new Uint8Array(importZipByteValues))
    const importedBrowserVaultRecord = await importPapelizBrowserVault(browserVaultImportPlan.suggestedBrowserVaultName, browserVaultImportPlan)
    return importedBrowserVaultRecord.papelizVaultDisplayName
  }, importZipBytes)
  expect(importedBrowserVaultName).toBe('Garden Club')
  await page.reload()
  await page.getByRole('button', { name: /^Garden Club/ }).first().click()
  await expect(page.locator('footer')).toContainText('Garden Club')
  await expect(page.getByText('Plans', { exact: true }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
  await page.getByRole('button', { name: 'Settings', exact: true }).last().click()
  await page.getByRole('tab', { name: 'Reminder' }).click()
  await expect(page.getByText('Last backup')).toBeVisible()
  const backupDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download backup' }).click()
  const backupDownload = await backupDownloadPromise
  expect(backupDownload.suggestedFilename()).toMatch(/^Garden Club \d{4}-\d{2}-\d{2} \d{4}\.zip$/)
  const backupZipBytes = new Uint8Array(await readFile(await backupDownload.path()))
  const backupZipEntryPaths = readPapelizImportZipFile(backupZipBytes).importZipEntries.map((importZipEntry) => importZipEntry.importZipEntryPath).sort()
  expect(backupZipEntryPaths).toEqual(['Garden Club/.papeliz/browser-vault.json', 'Garden Club/.trash/Old.md', 'Garden Club/Inbox.md', 'Garden Club/Plans/Spring.md'])
  await expect(page.locator('footer')).toContainText('Backed up')
})

test('the worker writes a file the way Safari before 26 has to', async ({ page }) => {
  const workerWriteResult = await page.evaluate(async () => {
    const { createPapelizBrowserVaultFileContentsWriter } = await import('/src/modules/vault/papeliz-browser-vault-file-writer.ts')
    const originPrivateFileSystemRoot = await navigator.storage.getDirectory()
    const workerFileHandle = await originPrivateFileSystemRoot.getFileHandle('papeliz-worker-write-check.md', { create: true })
    const writeThroughWorker = createPapelizBrowserVaultFileContentsWriter({ isWritableStreamOnFileHandle: () => false })
    await writeThroughWorker(workerFileHandle, 'A longer first version of the note.')
    await writeThroughWorker(workerFileHandle, 'Shorter.')
    return {
      writtenText: await (await workerFileHandle.getFile()).text(),
      hasWritableStream: typeof FileSystemFileHandle.prototype.createWritable === 'function',
    }
  })
  expect(workerWriteResult.writtenText).toBe('Shorter.')
  test.info().annotations.push({ type: 'createWritable', description: String(workerWriteResult.hasWritableStream) })
})
