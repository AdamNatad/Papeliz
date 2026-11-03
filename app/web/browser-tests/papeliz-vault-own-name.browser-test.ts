import { expect, test, type Page } from '@playwright/test'

// A folder vault's own name, in a real Edge: Settings › Vault renames a folder vault, the top bar shows
// the new name at once, Recent Vaults shows it after Close Vault, and it opens with it again, after a
// reload too. The folder keeps its own name. The folder window can't be answered here, so Open Vault is
// handed a folder in the browser's private storage instead, which Edge treats as any folder it opens.

const testVaultFolderName = 'Field Notes'

test.beforeEach(async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Only Chrome and Edge open folders as vaults.')
  await page.addInitScript((pickedVaultFolderName) => {
    window.showDirectoryPicker = async () => {
      const testFolderVaultsHandle = await (await navigator.storage.getDirectory()).getDirectoryHandle('papeliz-test-folder-vaults', { create: true })
      return testFolderVaultsHandle.getDirectoryHandle(pickedVaultFolderName, { create: true })
    }
  }, testVaultFolderName)
})

async function openSettingsVaultTab(page: Page) {
  const settingsPanel = page.getByRole('dialog', { name: 'Settings' })
  if (!(await settingsPanel.isVisible())) await page.locator('header').getByRole('button', { name: 'Settings', exact: true }).click()
  await settingsPanel.getByRole('navigation', { name: 'Settings' }).getByRole('button', { name: 'Settings', exact: true }).click()
  return settingsPanel.getByRole('tabpanel', { name: 'Vault' })
}

// What the test folder holds in its `.papeliz/vault-name.json`, or null when it has none.
async function readTestVaultOwnNameFileText(page: Page): Promise<string | null> {
  return page.evaluate(async (vaultFolderName) => {
    try {
      const testFolderVaultsHandle = await (await navigator.storage.getDirectory()).getDirectoryHandle('papeliz-test-folder-vaults')
      const vaultSettingsFolderHandle = await (await testFolderVaultsHandle.getDirectoryHandle(vaultFolderName)).getDirectoryHandle('.papeliz')
      return await (await (await vaultSettingsFolderHandle.getFileHandle('vault-name.json')).getFile()).text()
    } catch {
      return null
    }
  }, testVaultFolderName)
}

test('Settings › Vault renames a folder vault: the top bar and Recent Vaults show it, and it opens with it again', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('region', { name: 'Start' }).getByRole('button', { name: /^Open Vault/ }).click()
  const topBar = page.locator('header')
  await expect(topBar).toContainText(testVaultFolderName, { timeout: 20_000 })
  expect(await readTestVaultOwnNameFileText(page)).toBeNull()

  // The field is the folder's name until one is saved; Rename saves the new one in the vault.
  const vaultTab = await openSettingsVaultTab(page)
  const vaultNameField = vaultTab.getByLabel('Vault Name')
  await expect(vaultNameField).toHaveValue(testVaultFolderName)
  await expect(vaultTab).toContainText('Folder Storage. The folder on your computer keeps its own name.')
  const renameButton = vaultTab.getByRole('button', { name: 'Rename' })
  await expect(renameButton).toBeDisabled()
  await vaultNameField.fill('Work/Home')
  await expect(vaultTab.getByRole('alert')).toBeVisible()
  await expect(renameButton).toBeDisabled()
  await vaultNameField.fill('Garden Journal')
  await renameButton.click()
  await expect(topBar).toContainText('Garden Journal')
  await expect(page.locator('footer')).toContainText('Garden Journal')
  await expect(page).toHaveTitle('Garden Journal · Papeliz')
  expect(JSON.parse((await readTestVaultOwnNameFileText(page)) ?? 'null')).toEqual({ papelizVaultName: 'Garden Journal' })

  // Close Vault: Recent Vaults shows the new name, and the vault opens with it.
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Close Vault' }).click()
  await page.getByRole('dialog', { name: 'Close “Garden Journal”?' }).getByRole('button', { name: 'Close Vault' }).click()
  const recentVaultsRegion = page.getByRole('region', { name: 'Recent Vaults' })
  const renamedVaultRowButton = recentVaultsRegion.getByRole('button', { name: /^Garden Journal/ }).first()
  await expect(renamedVaultRowButton).toBeVisible()
  await expect(recentVaultsRegion.getByRole('button', { name: new RegExp(`^${testVaultFolderName}`) })).toHaveCount(0)
  await renamedVaultRowButton.click()
  await expect(topBar).toContainText('Garden Journal', { timeout: 20_000 })

  // After a reload, from Recent Vaults again: the name was read back from the vault.
  await page.reload()
  await page.getByRole('region', { name: 'Recent Vaults' }).getByRole('button', { name: /^Garden Journal/ }).first().click()
  await expect(topBar).toContainText('Garden Journal', { timeout: 20_000 })
  await expect((await openSettingsVaultTab(page)).getByLabel('Vault Name')).toHaveValue('Garden Journal')
})
