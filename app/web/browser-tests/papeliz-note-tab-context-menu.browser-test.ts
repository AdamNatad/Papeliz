import { expect, test, type Page } from '@playwright/test'

// The note tabs' menu, in a real browser: a right-click on a tab opens Close, Close Others and Close
// All; Close Others keeps that tab in front, Close All leaves the note area empty, Shift+F10 opens the
// menu on a focused tab, and Close Others is off while only one tab is open.

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  const isBrowserStorageOn = await page.evaluate(() => navigator.storage.getDirectory().then(() => true, () => false))
  test.skip(!isBrowserStorageOn, 'This browser refuses its private storage (Playwright’s WebKit for Windows does), so it keeps no browser vaults.')
})

const noteTabMenuBrowserVaultName = 'Tab Menu Notes'
const noteTabMenuNoteTextsByFileName: Record<string, string> = {
  'Inbox.md': '# Inbox\n',
  'Reading.md': '# Reading\n',
  'Ideas.md': '# Ideas\n',
}

// Makes the browser vault straight through the app's own modules, as a vault left from an earlier
// visit would be.
async function seedNoteTabMenuBrowserVault(page: Page) {
  await page.evaluate(
    async ({ seededBrowserVaultName, seededNoteTextsByFileName }) => {
      const { createPapelizBrowserVault, getPapelizBrowserVaultFolderHandle } = await import('/src/modules/vault/papeliz-browser-vaults.ts')
      const { createPapelizBrowserVaultFileContentsWriter } = await import('/src/modules/vault/papeliz-browser-vault-file-writer.ts')
      const seededBrowserVaultRecord = await createPapelizBrowserVault(seededBrowserVaultName)
      const seededBrowserVaultFolder = await getPapelizBrowserVaultFolderHandle(seededBrowserVaultRecord.papelizVaultId)
      const writeSeededFile = createPapelizBrowserVaultFileContentsWriter()
      for (const [seededFileName, seededNoteText] of Object.entries(seededNoteTextsByFileName)) {
        await writeSeededFile(await seededBrowserVaultFolder!.getFileHandle(seededFileName, { create: true }), seededNoteText)
      }
    },
    { seededBrowserVaultName: noteTabMenuBrowserVaultName, seededNoteTextsByFileName: noteTabMenuNoteTextsByFileName },
  )
  await page.reload()
}

function findNoteTabTitleButton(page: Page, vaultNoteTitle: string) {
  return page.getByRole('navigation', { name: 'Open notes' }).getByRole('button', { name: vaultNoteTitle, exact: true })
}

async function openNotesInTabs(page: Page, vaultNoteTitles: readonly string[]) {
  const fileList = page.getByRole('navigation', { name: 'Notes' })
  for (const vaultNoteTitle of vaultNoteTitles) {
    await fileList.getByText(vaultNoteTitle, { exact: true }).click()
    await expect(findNoteTabTitleButton(page, vaultNoteTitle)).toHaveAttribute('aria-current', 'page')
  }
}

test('a tab’s right-click menu closes the other tabs, then all of them', async ({ page }) => {
  await seedNoteTabMenuBrowserVault(page)
  await page.getByRole('button', { name: new RegExp(`^${noteTabMenuBrowserVaultName}`) }).first().click()
  await expect(page.locator('footer')).toContainText(noteTabMenuBrowserVaultName)
  const openNoteTabs = page.getByRole('navigation', { name: 'Open notes' }).locator('[data-papeliz-note-tab-path]')
  await openNotesInTabs(page, ['Inbox', 'Reading', 'Ideas'])
  await expect(openNoteTabs).toHaveCount(3)

  // Close Others, from a tab that isn't the open one: it stays, and comes to the front.
  await findNoteTabTitleButton(page, 'Reading').click({ button: 'right' })
  const readingNoteTabMenu = page.getByRole('menu', { name: 'Reading' })
  await expect(readingNoteTabMenu.getByRole('menuitem')).toHaveText(['Close', 'Close Others', 'Close All'])
  await readingNoteTabMenu.getByRole('menuitem', { name: 'Close Others' }).click()
  await expect(readingNoteTabMenu).toHaveCount(0)
  await expect(openNoteTabs).toHaveCount(1)
  await expect(findNoteTabTitleButton(page, 'Reading')).toHaveAttribute('aria-current', 'page')

  // With one tab open, Close Others is off: a click on it does nothing, and the arrow keys pass over it.
  await findNoteTabTitleButton(page, 'Reading').click({ button: 'right' })
  const closeOthersMenuItem = readingNoteTabMenu.getByRole('menuitem', { name: 'Close Others' })
  await expect(closeOthersMenuItem).toHaveAttribute('aria-disabled', 'true')
  await expect(readingNoteTabMenu.getByRole('menuitem', { name: 'Close', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(readingNoteTabMenu.getByRole('menuitem', { name: 'Close All' })).toBeFocused()
  await closeOthersMenuItem.click({ force: true })
  await expect(readingNoteTabMenu).toBeVisible()
  await expect(openNoteTabs).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(readingNoteTabMenu).toHaveCount(0)

  // Shift+F10 on a focused tab opens the same menu. Close, picked with the keys, leaves focus on the
  // tab now open; Close All leaves the note area empty.
  await openNotesInTabs(page, ['Inbox', 'Ideas'])
  await expect(openNoteTabs).toHaveCount(3)
  await findNoteTabTitleButton(page, 'Ideas').focus()
  await page.keyboard.press('Shift+F10')
  const ideasNoteTabMenu = page.getByRole('menu', { name: 'Ideas' })
  await expect(ideasNoteTabMenu.getByRole('menuitem', { name: 'Close', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(openNoteTabs).toHaveCount(2)
  await expect(findNoteTabTitleButton(page, 'Inbox')).toBeFocused()
  await page.keyboard.press('Shift+F10')
  const inboxNoteTabMenu = page.getByRole('menu', { name: 'Inbox' })
  await expect(inboxNoteTabMenu.getByRole('menuitem', { name: 'Close', exact: true })).toBeFocused()
  await page.keyboard.press('End')
  await expect(inboxNoteTabMenu.getByRole('menuitem', { name: 'Close All' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(inboxNoteTabMenu).toHaveCount(0)
  await expect(openNoteTabs).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'No note open' })).toBeVisible()
})
