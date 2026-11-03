import { expect, test, type Page } from '@playwright/test'

// New Vault on the web, in a real browser: Location shows this browser's own places (two tiles where
// folders work, one plain line where they don't), the folder it goes in with Browse…, and Compare;
// the free build says Sync is coming where Encryption would be. On the development fake engine, "Sync
// This Vault" is on once signed in, End-to-end waits for its passphrase, the vault starts syncing once
// made, and Settings › Sync changes its encryption by syncing it again.

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  const isBrowserStorageOn = await page.evaluate(() => navigator.storage.getDirectory().then(() => true, () => false))
  test.skip(!isBrowserStorageOn, 'This browser refuses its private storage (Playwright’s WebKit for Windows does), so it keeps no browser vaults.')
})

const testVaultPassphrase = 'maple river cloud lantern'

async function openNewVaultForm(page: Page) {
  await page.getByRole('region', { name: 'Start' }).getByRole('button', { name: /^New Vault/ }).click()
  const newVaultForm = page.getByRole('region', { name: 'New Vault' })
  await expect(newVaultForm.getByLabel('Vault Name')).toBeFocused()
  return newVaultForm
}

// Browser Storage, as a tile where both places work, or already the one place where folders don't.
async function chooseBrowserStorage(newVaultForm: ReturnType<Page['getByRole']>) {
  const browserStorageTile = newVaultForm.getByRole('radio', { name: /^Browser Storage/ })
  if ((await browserStorageTile.count()) > 0) await browserStorageTile.check()
}

test('New Vault shows this browser’s places, the folder it goes in, and that Sync is coming', async ({ page }) => {
  const isSyncInThisBuild = (await page.getByRole('button', { name: /^Synced Vaults/ }).count()) > 0
  const newVaultForm = await openNewVaultForm(page)
  const locationPart = newVaultForm.getByRole('region', { name: 'Location' })
  const folderStorageTile = locationPart.getByRole('radio', { name: /^Folder Storage/ })
  if ((await folderStorageTile.count()) > 0) {
    // Folders work here: both places as tiles, Folder Storage first, then where its folder goes.
    await expect(folderStorageTile).toBeChecked()
    await expect(locationPart.getByRole('radio', { name: /^Browser Storage/ })).not.toBeChecked()
    await expect(locationPart).toContainText('No folder picked yet')
    await expect(locationPart.getByRole('button', { name: 'Browse for the Folder It Goes In' })).toBeVisible()
    await locationPart.getByRole('radio', { name: /^Browser Storage/ }).check()
    await expect(locationPart.getByRole('button', { name: 'Browse for the Folder It Goes In' })).toHaveCount(0)
    await expect(locationPart).toContainText('Kept inside this browser.')
  } else {
    // Folders don't work here: Browser Storage is the one place, as a plain line, not a choice of one.
    await expect(locationPart.getByRole('radio')).toHaveCount(0)
    await expect(locationPart).toContainText('the only place it can keep vaults')
  }
  // Compare shows how the places differ, and hides it again.
  await locationPart.getByRole('button', { name: 'Compare' }).click()
  await expect(locationPart.getByRole('table', { name: 'How the two places compare' })).toBeVisible()
  await locationPart.getByRole('button', { name: 'Hide Comparison' }).click()
  await expect(locationPart.getByRole('table')).toHaveCount(0)
  if (!isSyncInThisBuild) {
    await expect(newVaultForm).toContainText('Sync, with Standard or End-to-end encryption, is coming.')
    await expect(newVaultForm.getByRole('switch', { name: 'Sync This Vault' })).toHaveCount(0)
  }
  // A browser vault is made under its name.
  await newVaultForm.getByLabel('Vault Name').fill('Garden Notes')
  await newVaultForm.getByRole('button', { name: 'Create Vault' }).click()
  await expect(page.locator('footer')).toContainText('Garden Notes')
})

test('signed out of Sync, "Sync This Vault" is off, with Sign In beside it', async ({ page }) => {
  await page.goto('/?papeliz-sync-fake-engine=signed-out')
  const newVaultForm = await openNewVaultForm(page)
  const syncThisVaultSwitch = newVaultForm.getByRole('switch', { name: 'Sync This Vault' })
  await expect(newVaultForm.getByRole('button', { name: 'Sign In' })).toBeVisible()
  await expect(syncThisVaultSwitch).toHaveAttribute('aria-checked', 'false')
  await expect(syncThisVaultSwitch).toBeDisabled()
  await expect(newVaultForm.getByRole('radio', { name: /^End-to-end/ })).toHaveCount(0)
})

test('a new vault syncs End-to-end once its passphrase is typed twice, then changes to Standard by syncing again', async ({ page }) => {
  await page.goto('/?papeliz-sync-fake-engine=nothing-synced-yet')
  const newVaultForm = await openNewVaultForm(page)
  const createVaultButton = newVaultForm.getByRole('button', { name: 'Create Vault' })
  await chooseBrowserStorage(newVaultForm)
  await newVaultForm.getByLabel('Vault Name').fill('Travel Notes')

  // Signed in: "Sync This Vault" is on, with Standard picked at first.
  await expect(newVaultForm.getByRole('switch', { name: 'Sync This Vault' })).toHaveAttribute('aria-checked', 'true')
  await expect(newVaultForm.getByRole('radio', { name: /^Standard/ })).toBeChecked()
  await expect(createVaultButton).toBeEnabled()

  // End-to-end waits for its passphrase, 12 characters or more, typed the same twice.
  await newVaultForm.getByRole('radio', { name: /^End-to-end/ }).check()
  await expect(newVaultForm).toContainText('Papeliz can’t recover it.')
  await expect(createVaultButton).toBeDisabled()
  await newVaultForm.getByLabel('Passphrase', { exact: true }).fill(testVaultPassphrase)
  await newVaultForm.getByLabel('Type it again').fill('maple river cloud')
  await expect(createVaultButton).toBeDisabled()
  await newVaultForm.getByLabel('Type it again').fill(testVaultPassphrase)
  await expect(createVaultButton).toBeEnabled()
  await createVaultButton.click()

  // The vault opens and starts its first upload, End-to-end.
  const statusBar = page.locator('footer')
  await expect(statusBar).toContainText('Travel Notes')
  await expect(statusBar).toContainText('Synced', { timeout: 20_000 })

  // Settings › Sync: its encryption, and Change to Standard, which syncs it again.
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Sync', exact: true }).click()
  await expect(page.getByText('Encryption: End-to-end')).toBeVisible()
  await page.getByRole('button', { name: 'Change to Standard…' }).click()
  const changeEncryptionDialog = page.getByRole('dialog', { name: 'Change “Travel Notes” to Standard?' })
  await expect(changeEncryptionDialog).toContainText('Its synced copy and its old versions are deleted from Sync')
  await changeEncryptionDialog.getByRole('button', { name: 'Delete and Sync Again' }).click()
  const syncedAgainDialog = page.getByRole('dialog', { name: '“Travel Notes” Is Standard Now' })
  await expect(syncedAgainDialog).toBeVisible({ timeout: 20_000 })
  await syncedAgainDialog.getByRole('button', { name: 'Done' }).click()
  // The dialog sits on the page, outside the Settings gear, which a press there closes.
  if ((await page.getByRole('button', { name: 'Sync', exact: true }).count()) === 0) await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Sync', exact: true }).click()
  await expect(page.getByText('Encryption: Standard')).toBeVisible()
})
