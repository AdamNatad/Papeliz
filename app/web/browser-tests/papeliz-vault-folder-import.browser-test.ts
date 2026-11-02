import { mkdir, writeFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { writePapelizExportZipFile } from '../src/modules/export-zip/papeliz-export-zip-file-writer'

// Import from Files, Import from Folder and Import from Zip in an open browser vault, in a real
// browser: each brings what it imports into its own new folder at the vault's top (loose files into
// "Imported Files", a picked folder under its own name, a zip under its name), the vault's own notes
// stay as they were, and the imported folder reorganizes like any other. A browser that refuses its
// private storage skips them.

const gardenNoteText = '# Garden\n\nKale\nBeans\n'

// A browser vault with one note, made through the app's own modules, then opened from Recent Vaults.
async function openBrowserVaultWithGardenNote(page: Page, papelizBrowserVaultName: string) {
  await page.goto('/')
  const isBrowserStorageOn = await page.evaluate(() => navigator.storage.getDirectory().then(() => true, () => false))
  test.skip(!isBrowserStorageOn, 'This browser refuses its private storage (Playwright’s WebKit for Windows does), so it keeps no browser vaults.')
  await page.evaluate(
    async ({ seededBrowserVaultName, seededGardenNoteText }) => {
      const { createPapelizBrowserVault, getPapelizBrowserVaultFolderHandle } = await import('/src/modules/vault/papeliz-browser-vaults.ts')
      const { createPapelizBrowserVaultFileContentsWriter } = await import('/src/modules/vault/papeliz-browser-vault-file-writer.ts')
      const seededBrowserVaultRecord = await createPapelizBrowserVault(seededBrowserVaultName)
      const seededBrowserVaultFolder = await getPapelizBrowserVaultFolderHandle(seededBrowserVaultRecord.papelizVaultId)
      await createPapelizBrowserVaultFileContentsWriter()(await seededBrowserVaultFolder!.getFileHandle('Garden.md', { create: true }), seededGardenNoteText)
    },
    { seededBrowserVaultName: papelizBrowserVaultName, seededGardenNoteText: gardenNoteText },
  )
  await page.reload()
  await page.getByRole('button', { name: new RegExp(`^${papelizBrowserVaultName}`) }).first().click()
  await expect(page.getByRole('navigation', { name: 'Notes' }).getByText('Garden', { exact: true })).toBeVisible()
}

// Every file in the open browser vault, by path, as text.
async function readBrowserVaultFiles(page: Page, papelizBrowserVaultName: string): Promise<Record<string, string>> {
  return page.evaluate(async (readBrowserVaultName) => {
    const { listPapelizBrowserVaults, getPapelizBrowserVaultFolderHandle } = await import('/src/modules/vault/papeliz-browser-vaults.ts')
    const readBrowserVaultRecord = (await listPapelizBrowserVaults()).find((browserVaultRecord) => browserVaultRecord.papelizVaultDisplayName === readBrowserVaultName)
    const vaultFileTextsByPath: Record<string, string> = {}
    const readVaultFolder = async (vaultFolderHandle: FileSystemDirectoryHandle, vaultFolderPath: string) => {
      for await (const [vaultEntryName, vaultEntryHandle] of vaultFolderHandle.entries()) {
        const vaultEntryPath = vaultFolderPath === '' ? vaultEntryName : `${vaultFolderPath}/${vaultEntryName}`
        if (vaultEntryHandle.kind === 'directory') await readVaultFolder(vaultEntryHandle as FileSystemDirectoryHandle, vaultEntryPath)
        else vaultFileTextsByPath[vaultEntryPath] = await (await (vaultEntryHandle as FileSystemFileHandle).getFile()).text()
      }
    }
    await readVaultFolder((await getPapelizBrowserVaultFolderHandle(readBrowserVaultRecord!.papelizVaultId))!, '')
    return vaultFileTextsByPath
  }, papelizBrowserVaultName)
}

async function chooseImportMenuItem(page: Page, importMenuItemName: string) {
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await page.getByRole('menuitem', { name: importMenuItemName }).click()
}

test('Import from Zip brings a zip into a new folder named after it, and the vault’s notes stay as they were', async ({ page }) => {
  await openBrowserVaultWithGardenNote(page, 'Zip Import Vault')
  const fieldNotesZipBlob = await writePapelizExportZipFile(
    [
      { zipEntryPath: 'Field Notes/Start.md', zipEntryBytes: new TextEncoder().encode('# Start\n') },
      { zipEntryPath: 'Field Notes/Crops/Beans.md', zipEntryBytes: new TextEncoder().encode('# Beans\n') },
      { zipEntryPath: 'Field Notes/.git/HEAD', zipEntryBytes: new TextEncoder().encode('ref: refs/heads/main\n') },
    ],
    { zipEntryModifiedDate: new Date(2026, 10, 2) },
  )
  const zipFileChooserShown = page.waitForEvent('filechooser')
  await chooseImportMenuItem(page, 'Import from Zip')
  await (await zipFileChooserShown).setFiles({ name: 'Field Notes.zip', mimeType: 'application/zip', buffer: Buffer.from(await fieldNotesZipBlob.arrayBuffer()) })

  await expect(page.getByText('Imported 2 files into “Field Notes”. 1 left out', { exact: false })).toBeVisible()
  const notesList = page.getByRole('navigation', { name: 'Notes' })
  await expect(notesList.getByText('Field Notes', { exact: true })).toBeVisible()
  await expect(notesList.getByText('Start', { exact: true })).toBeVisible()
  const vaultFiles = await readBrowserVaultFiles(page, 'Zip Import Vault')
  expect(vaultFiles).toMatchObject({ 'Garden.md': gardenNoteText, 'Field Notes/Start.md': '# Start\n', 'Field Notes/Crops/Beans.md': '# Beans\n' })
  expect(Object.keys(vaultFiles).some((vaultFilePath) => vaultFilePath.includes('.git'))).toBe(false)

  // The same zip again comes in beside it, under the next free name.
  const secondZipFileChooserShown = page.waitForEvent('filechooser')
  await chooseImportMenuItem(page, 'Import from Zip')
  await (await secondZipFileChooserShown).setFiles({ name: 'Field Notes.zip', mimeType: 'application/zip', buffer: Buffer.from(await fieldNotesZipBlob.arrayBuffer()) })
  await expect(notesList.getByText('Field Notes 2', { exact: true })).toBeVisible()
})

test('Import from Files brings loose files into “Imported Files”, Import from Folder a folder under its own name, and the folder reorganizes like any other', async ({ page }, testInfo) => {
  await openBrowserVaultWithGardenNote(page, 'Files Import Vault')

  const looseFilesChooserShown = page.waitForEvent('filechooser')
  await chooseImportMenuItem(page, 'Import from Files')
  await (await looseFilesChooserShown).setFiles([
    { name: 'Seeds.md', mimeType: 'text/markdown', buffer: Buffer.from('# Seeds\n') },
    { name: 'Shopping list.txt', mimeType: 'text/plain', buffer: Buffer.from('Compost\n') },
  ])
  const notesList = page.getByRole('navigation', { name: 'Notes' })
  await expect(notesList.getByText('Imported Files', { exact: true })).toBeVisible()
  await expect(notesList.getByText('Seeds', { exact: true })).toBeVisible()

  // A picked folder, written into this test's own output folder, which Playwright clears itself.
  const pickedFolderPath = testInfo.outputPath('Crop Notes')
  await mkdir(`${pickedFolderPath}/Beds`, { recursive: true })
  await writeFile(`${pickedFolderPath}/Plan.md`, '# Plan\n')
  await writeFile(`${pickedFolderPath}/Beds/North.md`, '# North\n')
  const folderChooserShown = page.waitForEvent('filechooser')
  await chooseImportMenuItem(page, 'Import from Folder')
  await (await folderChooserShown).setFiles(pickedFolderPath)
  await expect(notesList.getByText('Crop Notes', { exact: true })).toBeVisible()

  expect(await readBrowserVaultFiles(page, 'Files Import Vault')).toMatchObject({
    'Garden.md': gardenNoteText,
    'Imported Files/Seeds.md': '# Seeds\n',
    'Imported Files/Shopping list.txt': 'Compost\n',
    'Crop Notes/Plan.md': '# Plan\n',
    'Crop Notes/Beds/North.md': '# North\n',
  })

  // An imported folder is an ordinary folder: it renames, and its notes move out of it.
  await page.evaluate(async () => {
    const { usePapelizWorkspaceStore } = await import('/src/modules/workspace/papeliz-workspace-store.ts')
    await usePapelizWorkspaceStore.getState().renameVaultEntry('Imported Files', 'Loose Notes')
    await usePapelizWorkspaceStore.getState().moveVaultEntryIntoFolder('Crop Notes/Plan.md', '')
  })
  await expect.poll(() => readBrowserVaultFiles(page, 'Files Import Vault')).toMatchObject({ 'Loose Notes/Seeds.md': '# Seeds\n', 'Plan.md': '# Plan\n', 'Crop Notes/Beds/North.md': '# North\n' })
  await expect(notesList.getByText('Loose Notes', { exact: true })).toBeVisible()
})
