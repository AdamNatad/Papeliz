import { expect, test, type Page } from '@playwright/test'

// End-to-end vaults on the web, in a real browser, kept in Browser Storage: New Vault makes one and
// opens it unlocked; the status bar shows its lock and Lock Now; Lock Now brings the start screen's
// Unlock, which says a wrong passphrase doesn't open it and the right one does; Remember on This
// Device opens it from its row with no passphrase until Settings forgets it; and Settings › Vault ›
// Encryption changes a vault's kind both ways, and its passphrase. Each unlock takes about a second on
// purpose, so these run slower than most.

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  const isBrowserStorageOn = await page.evaluate(() => navigator.storage.getDirectory().then(() => true, () => false))
  test.skip(!isBrowserStorageOn, 'This browser refuses its private storage (Playwright’s WebKit for Windows does), so it keeps no browser vaults.')
})

test.describe.configure({ timeout: 120_000 })

const testVaultPassphrase = 'maple river cloud lantern'
const otherTestVaultPassphrase = 'quiet harbor paper kite'

async function openNewVaultForm(page: Page) {
  await page.getByRole('region', { name: 'Start' }).getByRole('button', { name: /^New Vault/ }).click()
  const newVaultForm = page.getByRole('region', { name: 'New Vault' })
  await expect(newVaultForm.getByLabel('Vault Name')).toBeFocused()
  const browserStorageTile = newVaultForm.getByRole('radio', { name: /^Browser Storage/ })
  if ((await browserStorageTile.count()) > 0) await browserStorageTile.check()
  return newVaultForm
}

// New Vault, End-to-end, in Browser Storage: it opens unlocked, with its lock in the status bar.
async function makeEndToEndBrowserVault(page: Page, endToEndVaultName: string) {
  const newVaultForm = await openNewVaultForm(page)
  const createVaultButton = newVaultForm.getByRole('button', { name: 'Create Vault' })
  await newVaultForm.getByLabel('Vault Name').fill(endToEndVaultName)
  await newVaultForm.getByRole('radio', { name: /^End-to-end/ }).check()
  await expect(newVaultForm.getByLabel('Vault passphrase')).toBeFocused()
  await expect(newVaultForm).toContainText('neither Papeliz nor any third party can reset or recover it.')
  await expect(createVaultButton).toBeDisabled()
  await newVaultForm.getByLabel('Vault passphrase').fill(testVaultPassphrase)
  await newVaultForm.getByLabel('Type it again').fill('maple river cloud')
  await expect(createVaultButton).toBeDisabled()
  await newVaultForm.getByLabel('Type it again').fill(testVaultPassphrase)
  await expect(createVaultButton).toBeEnabled()
  await createVaultButton.click()
  const statusBar = page.locator('footer')
  await expect(statusBar).toContainText(endToEndVaultName, { timeout: 20_000 })
  await expect(statusBar).toContainText('End-to-end')
  await expect(statusBar.getByRole('button', { name: 'Lock Now' })).toBeVisible()
}

function readUnlockPanel(page: Page, endToEndVaultName: string) {
  return page.getByRole('region', { name: `Unlock ${endToEndVaultName}` })
}

async function unlockWithPassphrase(page: Page, endToEndVaultName: string, vaultPassphrase: string, isRememberedOnThisDevice = false) {
  const unlockPanel = readUnlockPanel(page, endToEndVaultName)
  await unlockPanel.getByLabel('Passphrase', { exact: true }).fill(vaultPassphrase)
  if (isRememberedOnThisDevice) await unlockPanel.getByRole('checkbox', { name: /^Remember on This Device/ }).check()
  await unlockPanel.getByRole('button', { name: 'Unlock' }).click()
}

// The gear's panel, opened from the top bar unless it is open already (a change's Done leaves it open).
async function openSettingsPanel(page: Page) {
  const settingsPanel = page.getByRole('dialog', { name: 'Settings' })
  if (!(await settingsPanel.isVisible())) await page.locator('header').getByRole('button', { name: 'Settings', exact: true }).click()
  return settingsPanel
}

async function openSettingsVaultTab(page: Page) {
  const settingsPanel = await openSettingsPanel(page)
  await settingsPanel.getByRole('navigation', { name: 'Settings' }).getByRole('button', { name: 'Settings', exact: true }).click()
  return settingsPanel.getByRole('region', { name: 'Encryption' })
}

test('a new End-to-end vault opens unlocked; Lock Now locks it, a wrong passphrase doesn’t open it, and the right one does', async ({ page }) => {
  await makeEndToEndBrowserVault(page, 'Private Notes')
  // A first note, so there is something to find again.
  await page.locator('.cm-content').first().fill('# Private Notes\n\nThe garden plan.')
  await expect(page.locator('footer')).toContainText('Saved in browser', { timeout: 10_000 })

  // Lock Now: the vault's tabs close and the start screen asks for its passphrase, saying why.
  await page.locator('footer').getByRole('button', { name: 'Lock Now' }).click()
  const unlockPanel = readUnlockPanel(page, 'Private Notes')
  await expect(unlockPanel).toBeVisible({ timeout: 10_000 })
  await expect(unlockPanel).toContainText('Private Notes is locked. Every note was saved, then cleared from memory with the key.')
  await expect(unlockPanel).toContainText('End-to-End Encryption')
  await expect(unlockPanel.getByRole('checkbox', { name: /^Remember on This Device/ })).not.toBeChecked()
  await expect(unlockPanel).toContainText('Forgot it? Papeliz can’t recover it.')

  // A wrong passphrase: it says so, with no lockout, and the vault stays locked.
  await unlockWithPassphrase(page, 'Private Notes', 'not the right passphrase')
  await expect(unlockPanel).toContainText('That passphrase doesn’t open Private Notes', { timeout: 20_000 })
  await expect(unlockPanel).toContainText('Check Caps Lock and the keyboard’s language.')
  await expect(page.locator('footer')).toHaveCount(0)

  // The right one opens it, with its note.
  await unlockWithPassphrase(page, 'Private Notes', testVaultPassphrase)
  await expect(page.locator('footer')).toContainText('Private Notes', { timeout: 20_000 })
  await expect(page.locator('footer')).toContainText('End-to-end')
  // Its tabs weren't remembered, so its first note opens from the file list.
  await page.getByRole('navigation', { name: 'Notes' }).getByRole('button', { name: 'Untitled', exact: true }).click()
  await expect(page.locator('.cm-content').first()).toContainText('The garden plan.')

  // Its row: the lock on its letter and the purple badge.
  await (await openSettingsPanel(page)).getByRole('button', { name: 'Lock Now' }).click()
  await page.getByRole('region', { name: `Unlock Private Notes` }).getByRole('button', { name: 'Cancel' }).click()
  const vaultRow = page.getByRole('listitem').filter({ hasText: 'Private Notes' })
  await expect(vaultRow).toContainText('End-to-End Encryption')
  await expect(vaultRow).not.toContainText('Remembered')
})

test('Remember on This Device opens the vault from its row with no passphrase, until Settings forgets it', async ({ page }) => {
  await makeEndToEndBrowserVault(page, 'Kept Notes')
  await page.locator('footer').getByRole('button', { name: 'Lock Now' }).click()
  await unlockWithPassphrase(page, 'Kept Notes', testVaultPassphrase, true)
  await expect(page.locator('footer')).toContainText('Kept Notes', { timeout: 20_000 })

  // Settings › Vault: the switch is on.
  const encryptionPart = await openSettingsVaultTab(page)
  const rememberSwitch = encryptionPart.getByRole('switch', { name: 'Remember on This Device' })
  await expect(rememberSwitch).toHaveAttribute('aria-checked', 'true')
  await expect(encryptionPart).toContainText('This browser then opens it without the passphrase, for anyone who uses it.')
  await page.keyboard.press('Escape')

  // Close Vault, then its row: Remembered, and it opens straight away.
  await (await openSettingsPanel(page)).getByRole('button', { name: 'Close Vault' }).click()
  await page.getByRole('dialog', { name: 'Close “Kept Notes”?' }).getByRole('button', { name: 'Close Vault' }).click()
  const vaultRow = page.getByRole('listitem').filter({ hasText: 'Kept Notes' })
  await expect(vaultRow).toContainText('Remembered')
  await vaultRow.getByRole('button').first().click()
  await expect(page.locator('footer')).toContainText('Kept Notes', { timeout: 20_000 })

  // Forgotten in Settings: the row asks for the passphrase again.
  const encryptionPartAgain = await openSettingsVaultTab(page)
  await encryptionPartAgain.getByRole('switch', { name: 'Remember on This Device' }).click()
  await expect(encryptionPartAgain.getByRole('switch', { name: 'Remember on This Device' })).toHaveAttribute('aria-checked', 'false')
  await page.keyboard.press('Escape')
  await page.locator('footer').getByRole('button', { name: 'Lock Now' }).click()
  await readUnlockPanel(page, 'Kept Notes').getByRole('button', { name: 'Cancel' }).click()
  await expect(vaultRow).not.toContainText('Remembered')
  await vaultRow.getByRole('button').first().click()
  await expect(readUnlockPanel(page, 'Kept Notes')).toBeVisible({ timeout: 10_000 })
})

test('Settings › Vault › Encryption changes a vault to End-to-end and back, and changes its passphrase', async ({ page }) => {
  // A Standard vault with a note.
  const newVaultForm = await openNewVaultForm(page)
  await newVaultForm.getByLabel('Vault Name').fill('Changing Notes')
  await expect(newVaultForm.getByRole('radio', { name: /^Standard/ })).toBeChecked()
  await newVaultForm.getByRole('button', { name: 'Create Vault' }).click()
  const statusBar = page.locator('footer')
  await expect(statusBar).toContainText('Changing Notes')
  await expect(statusBar).not.toContainText('End-to-end')
  await page.locator('.cm-content').first().fill('# Changing Notes\n\nStill here after each change.')
  await expect(statusBar).toContainText('Saved in browser', { timeout: 10_000 })

  // Standard: Change to End-to-end asks the passphrase twice, with both warnings, then shows progress
  // and Done; the vault opens again, End-to-end.
  let encryptionPart = await openSettingsVaultTab(page)
  await expect(encryptionPart).toContainText('Plain Markdown files any app can open.')
  await encryptionPart.getByRole('button', { name: 'Change to End-to-end' }).click()
  let changeDialog = page.getByRole('dialog', { name: 'Change Changing Notes to End-to-end' })
  await expect(changeDialog).toContainText('Copies made before stay readable')
  await changeDialog.getByLabel('Vault passphrase').fill(testVaultPassphrase)
  await changeDialog.getByLabel('Type it again').fill(testVaultPassphrase)
  await changeDialog.getByRole('button', { name: /^Encrypt \d/ }).click()
  let doneDialog = page.getByRole('dialog', { name: 'Changing Notes is End-to-end' })
  await expect(doneDialog).toBeVisible({ timeout: 30_000 })
  await doneDialog.getByRole('button', { name: 'Done' }).click()
  await expect(statusBar).toContainText('End-to-end', { timeout: 10_000 })

  // Change Passphrase: the current one, then the new one twice.
  encryptionPart = await openSettingsVaultTab(page)
  await expect(encryptionPart).toContainText('Encrypted with your passphrase.')
  await encryptionPart.getByRole('button', { name: 'Change Passphrase' }).click()
  changeDialog = page.getByRole('dialog', { name: 'Change Passphrase' })
  await changeDialog.getByLabel('Current passphrase').fill('not the right passphrase')
  await changeDialog.getByLabel('New passphrase').fill(otherTestVaultPassphrase)
  await changeDialog.getByLabel('Type it again').fill(otherTestVaultPassphrase)
  await changeDialog.getByRole('button', { name: 'Change Passphrase' }).click()
  await expect(changeDialog).toContainText('That passphrase doesn’t open Changing Notes', { timeout: 20_000 })
  await changeDialog.getByLabel('Current passphrase').fill(testVaultPassphrase)
  await changeDialog.getByRole('button', { name: 'Change Passphrase' }).click()
  doneDialog = page.getByRole('dialog', { name: 'Passphrase Changed' })
  await expect(doneDialog).toBeVisible({ timeout: 20_000 })
  await doneDialog.getByRole('button', { name: 'Done' }).click()

  // End-to-end: Change to Standard asks the passphrase again, then decrypts.
  encryptionPart = await openSettingsVaultTab(page)
  await encryptionPart.getByRole('button', { name: 'Change to Standard' }).click()
  changeDialog = page.getByRole('dialog', { name: 'Change Changing Notes to Standard' })
  await expect(changeDialog).toContainText('The key remembered on this device is dropped.')
  await changeDialog.getByLabel('Enter the passphrase to go on').fill(otherTestVaultPassphrase)
  await changeDialog.getByRole('button', { name: /^Decrypt \d/ }).click()
  doneDialog = page.getByRole('dialog', { name: 'Changing Notes is Standard' })
  await expect(doneDialog).toBeVisible({ timeout: 30_000 })
  await doneDialog.getByRole('button', { name: 'Done' }).click()
  await expect(statusBar).not.toContainText('End-to-end', { timeout: 10_000 })
  await page.getByRole('navigation', { name: 'Notes' }).getByRole('button', { name: 'Untitled', exact: true }).click()
  await expect(page.locator('.cm-content').first()).toContainText('Still here after each change.')
})
