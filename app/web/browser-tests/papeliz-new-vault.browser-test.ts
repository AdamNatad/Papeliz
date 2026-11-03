import { expect, test, type Page } from '@playwright/test'

// New Vault on the web, in a real browser: Location shows this browser's own places (two tiles where
// folders work, one plain line where they don't), the folder it goes in with Browse…, and Compare;
// Encryption asks Standard or End-to-end in every build, Standard first. On the development fake
// engine, "Sync This Vault" is on once signed in, syncs a Standard vault once made, stays off for
// End-to-end (Sync doesn't carry it yet), and Settings › Sync changes a synced vault's encryption by
// syncing it again.

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

test('New Vault shows this browser’s places, the folder it goes in, and Standard or End-to-end', async ({ page }) => {
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
  // Encryption, in every build: Standard first, End-to-end asking its passphrase only once picked.
  const encryptionPart = newVaultForm.getByRole('region', { name: 'Encryption' })
  await expect(encryptionPart.getByRole('radio', { name: /^Standard/ })).toBeChecked()
  await expect(encryptionPart).toContainText('Plain Markdown files any app can open.')
  await expect(encryptionPart).toContainText('Encrypted with a passphrase only you know.')
  await expect(encryptionPart.locator('[data-papeliz-new-vault-passphrase-part-open="false"]')).toHaveAttribute('inert', '')
  await expect(newVaultForm).not.toContainText('is coming')
  if (!isSyncInThisBuild) await expect(newVaultForm.getByRole('switch', { name: 'Sync This Vault' })).toHaveCount(0)
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
  // The kind is asked anyway: it's how the vault opens on this device.
  await expect(newVaultForm.getByRole('radio', { name: /^Standard/ })).toBeChecked()
})

test('a new Standard vault syncs once made, End-to-end keeps Sync off, and Settings › Sync changes the synced copy to End-to-end', async ({ page }) => {
  await page.goto('/?papeliz-sync-fake-engine=nothing-synced-yet')
  const newVaultForm = await openNewVaultForm(page)
  const createVaultButton = newVaultForm.getByRole('button', { name: 'Create Vault' })
  const syncThisVaultSwitch = newVaultForm.getByRole('switch', { name: 'Sync This Vault' })
  await chooseBrowserStorage(newVaultForm)
  await newVaultForm.getByLabel('Vault Name').fill('Travel Notes')

  // Signed in: "Sync This Vault" is on, with Standard picked under Encryption.
  await expect(syncThisVaultSwitch).toHaveAttribute('aria-checked', 'true')
  await expect(newVaultForm.getByRole('radio', { name: /^Standard/ })).toBeChecked()
  await expect(newVaultForm).toContainText('Uploads encrypted with a key Papeliz keeps')

  // End-to-end: Sync doesn't carry it yet, so the switch goes off and says so; Standard brings it back.
  await newVaultForm.getByRole('radio', { name: /^End-to-end/ }).check()
  await expect(syncThisVaultSwitch).toHaveAttribute('aria-checked', 'false')
  await expect(syncThisVaultSwitch).toBeDisabled()
  await expect(newVaultForm).toContainText('Sync doesn’t carry End-to-end vaults yet.')
  await newVaultForm.getByRole('radio', { name: /^Standard/ }).check()
  await expect(syncThisVaultSwitch).toHaveAttribute('aria-checked', 'true')
  await createVaultButton.click()

  // The vault opens and starts its first upload.
  const statusBar = page.locator('footer')
  await expect(statusBar).toContainText('Travel Notes')
  await expect(statusBar).toContainText('Synced', { timeout: 20_000 })

  // Settings › Sync: its encryption, and Change to End-to-end, which syncs it again with a passphrase.
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Sync', exact: true }).click()
  await expect(page.getByText('Encryption: Standard')).toBeVisible()
  await page.getByRole('button', { name: 'Change to End-to-end…' }).click()
  const changeEncryptionDialog = page.getByRole('dialog', { name: 'Change “Travel Notes” to End-to-end?' })
  await changeEncryptionDialog.getByRole('button', { name: 'Continue' }).click()
  const passphraseDialog = page.getByRole('dialog', { name: 'Choose a Passphrase for “Travel Notes”' })
  await passphraseDialog.getByLabel('Passphrase', { exact: true }).fill(testVaultPassphrase)
  await passphraseDialog.getByLabel('Type it again').fill(testVaultPassphrase)
  await passphraseDialog.getByRole('button', { name: 'Delete and Sync Again' }).click()
  const syncedAgainDialog = page.getByRole('dialog', { name: '“Travel Notes” Is End-to-end Now' })
  await expect(syncedAgainDialog).toBeVisible({ timeout: 20_000 })
  await syncedAgainDialog.getByRole('button', { name: 'Done' }).click()
  // The dialog sits on the page, outside the Settings gear, which a press there closes.
  if ((await page.getByRole('button', { name: 'Sync', exact: true }).count()) === 0) await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Sync', exact: true }).click()
  await expect(page.getByText('Encryption: End-to-end')).toBeVisible()
})

test('choosing End-to-end opens its passphrase with motion, and reduced motion changes it at once', async ({ page }) => {
  const newVaultForm = await openNewVaultForm(page)
  const encryptionPart = newVaultForm.getByRole('region', { name: 'Encryption' })
  const passphrasePart = encryptionPart.locator('[data-papeliz-new-vault-passphrase-part-open]')
  const readPassphrasePartHeight = async () => (await passphrasePart.boundingBox())?.height ?? 0
  await expect(passphrasePart).toHaveAttribute('data-papeliz-new-vault-passphrase-part-open', 'false')
  expect(await readPassphrasePartHeight()).toBeLessThan(1)
  // The tiles cross-fade over 180 ms, the passphrase part grows over 220 ms.
  expect(await encryptionPart.locator('label').first().evaluate((tileElement) => getComputedStyle(tileElement).transitionDuration)).toContain('0.18s')
  expect(await passphrasePart.evaluate((partElement) => getComputedStyle(partElement).transitionDuration)).toContain('0.22s')

  // Choosing End-to-end: the part grows from nothing, the focus goes to its first field, and the radio's
  // dot grows to full size.
  await encryptionPart.getByRole('radio', { name: /^End-to-end/ }).check()
  await expect(encryptionPart.getByLabel('Vault passphrase')).toBeFocused()
  await expect.poll(readPassphrasePartHeight).toBeGreaterThan(100)
  await expect
    .poll(() => encryptionPart.getByRole('radio', { name: /^End-to-end/ }).evaluate((radioElement) => getComputedStyle(radioElement).backgroundSize))
    .toBe('100% 100%')

  // Standard again: the part shuts and its fields leave the tab order.
  await encryptionPart.getByRole('radio', { name: /^Standard/ }).check()
  await expect(passphrasePart).toHaveAttribute('inert', '')
  await expect.poll(readPassphrasePartHeight).toBeLessThan(1)

  // Reduced motion: nothing moves.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await passphrasePart.evaluate((partElement) => getComputedStyle(partElement).transitionDuration)).toBe('0s')
  await encryptionPart.getByRole('radio', { name: /^End-to-end/ }).check()
  expect(await readPassphrasePartHeight()).toBeGreaterThan(100)
})
