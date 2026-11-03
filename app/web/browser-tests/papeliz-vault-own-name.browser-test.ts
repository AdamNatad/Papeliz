import { expect, test, type Page } from '@playwright/test'

// A folder vault's own name, in a real Edge: Settings › Vault renames a folder vault, the top bar shows
// the new name at once, Recent Vaults shows it after Close Vault, and it opens with it again, after a
// reload too. The folder keeps its own name. New Vault's folder name follows the vault's until changed,
// and a folder already there offers the next free name, or Open It for a vault, changing nothing in it.
// The folder window can't be answered here, so it hands back a folder in the browser's private storage
// instead, which Edge treats as any folder it opens: "Field Notes", or the one a test names.

const testVaultFolderName = 'Field Notes'

type PapelizTestPickedFolderWindow = Window & { papelizTestPickedFolderName?: string }

test.beforeEach(async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Only Chrome and Edge open folders as vaults.')
  await page.addInitScript((defaultPickedFolderName) => {
    window.showDirectoryPicker = async () => {
      const testFolderVaultsHandle = await (await navigator.storage.getDirectory()).getDirectoryHandle('papeliz-test-folder-vaults', { create: true })
      const pickedFolderName = (window as PapelizTestPickedFolderWindow).papelizTestPickedFolderName ?? defaultPickedFolderName
      return testFolderVaultsHandle.getDirectoryHandle(pickedFolderName, { create: true })
    }
  }, testVaultFolderName)
})

// Writes text files under the test's folders, by paths like "Vaults/My Notes/Inbox.md".
async function writeTestFolderFiles(page: Page, testFolderFiles: Record<string, string>): Promise<void> {
  await page.evaluate(async (writtenTestFolderFiles) => {
    const testFolderVaultsHandle = await (await navigator.storage.getDirectory()).getDirectoryHandle('papeliz-test-folder-vaults', { create: true })
    for (const [testFileRelativePath, testFileText] of Object.entries(writtenTestFolderFiles)) {
      const testFilePathParts = testFileRelativePath.split('/')
      let testFolderHandle = testFolderVaultsHandle
      for (const testFolderName of testFilePathParts.slice(0, -1)) testFolderHandle = await testFolderHandle.getDirectoryHandle(testFolderName, { create: true })
      const testFileWritable = await (await testFolderHandle.getFileHandle(testFilePathParts.at(-1)!, { create: true })).createWritable()
      await testFileWritable.write(testFileText)
      await testFileWritable.close()
    }
  }, testFolderFiles)
}

// A text file under the test's folders, or null when it isn't there.
async function readTestFolderFileText(page: Page, testFileRelativePath: string): Promise<string | null> {
  return page.evaluate(async (readTestFileRelativePath) => {
    try {
      const testFilePathParts = readTestFileRelativePath.split('/')
      let testFolderHandle = await (await navigator.storage.getDirectory()).getDirectoryHandle('papeliz-test-folder-vaults')
      for (const testFolderName of testFilePathParts.slice(0, -1)) testFolderHandle = await testFolderHandle.getDirectoryHandle(testFolderName)
      return await (await (await testFolderHandle.getFileHandle(testFilePathParts.at(-1)!)).getFile()).text()
    } catch {
      return null
    }
  }, testFileRelativePath)
}

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
  await vaultNameField.fill('   ')
  await expect(vaultTab.getByRole('alert')).toBeVisible()
  await expect(renameButton).toBeDisabled()
  // A vault's name may hold what a folder's can't; this one is typed, then changed again.
  await vaultNameField.fill('Work/Home')
  await expect(vaultTab.getByRole('alert')).toHaveCount(0)
  await expect(renameButton).toBeEnabled()
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

test('New Vault: the folder name follows the vault name until changed, and a folder already there offers the next free name or Open It', async ({ page }) => {
  await page.goto('/')
  await writeTestFolderFiles(page, {
    'Vaults/My Notes/.papeliz/vault-name.json': '{\n  "papelizVaultName": "Research"\n}\n',
    'Vaults/My Notes/Inbox.md': '# Inbox\n',
    'Vaults/Garden/Beds.md': '# Beds\n',
  })
  await page.evaluate(() => {
    ;(window as PapelizTestPickedFolderWindow).papelizTestPickedFolderName = 'Vaults'
  })

  const openNewVaultFormInVaults = async () => {
    await page.getByRole('region', { name: 'Start' }).getByRole('button', { name: /^New Vault/ }).click()
    const newVaultForm = page.getByRole('region', { name: 'New Vault' })
    await newVaultForm.getByRole('button', { name: 'Browse for the Folder It Goes In' }).click()
    await expect(newVaultForm).toContainText('Vaults ›')
    return newVaultForm
  }
  let newVaultForm = await openNewVaultFormInVaults()
  const vaultNameField = newVaultForm.getByLabel('Vault Name')
  const createVaultButton = newVaultForm.getByRole('button', { name: 'Create Vault' })

  // It follows the vault's name, with what a folder can't hold replaced.
  await vaultNameField.fill('Work/Home: 2026')
  await expect(newVaultForm).toContainText('Papeliz makes the folder Work-Home- 2026 in “Vaults”')

  // A plain folder already there: the next free name, and no Open It.
  await vaultNameField.fill('Garden')
  await expect(newVaultForm).toContainText('A folder named “Garden” is already there.')
  await expect(newVaultForm.getByRole('button', { name: 'Use “Garden 2”' })).toBeVisible()
  await expect(newVaultForm.getByRole('button', { name: 'Open It' })).toHaveCount(0)
  await expect(createVaultButton).toBeDisabled()

  // A vault already there: Open It opens it as it is.
  await vaultNameField.fill('My Notes')
  await expect(newVaultForm).toContainText('The folder “My Notes” there is already a Papeliz vault.')
  await newVaultForm.getByRole('button', { name: 'Open It' }).click()
  const topBar = page.locator('header')
  await expect(topBar).toContainText('Research', { timeout: 20_000 })
  expect(await readTestFolderFileText(page, 'Vaults/My Notes/Inbox.md')).toBe('# Inbox\n')
  await page.locator('header').getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Close Vault' }).click()
  await page.getByRole('dialog', { name: 'Close “Research”?' }).getByRole('button', { name: 'Close Vault' }).click()

  // Use "My Notes 2": the folder takes that name and stops following, so a new vault name leaves it.
  newVaultForm = await openNewVaultFormInVaults()
  await newVaultForm.getByLabel('Vault Name').fill('My Notes')
  await newVaultForm.getByRole('button', { name: 'Use “My Notes 2”' }).click()
  await expect(newVaultForm).toContainText('Papeliz makes the folder My Notes 2 in “Vaults”')
  await newVaultForm.getByLabel('Vault Name').fill('Fresh Notes')
  await expect(newVaultForm).toContainText('Papeliz makes the folder My Notes 2 in “Vaults”')
  await newVaultForm.getByRole('button', { name: 'Change Folder Name' }).click()
  await expect(newVaultForm.getByLabel('Folder Name')).toHaveValue('My Notes 2')
  await newVaultForm.getByRole('button', { name: 'Create Vault' }).click()
  await expect(topBar).toContainText('Fresh Notes', { timeout: 20_000 })
  expect(JSON.parse((await readTestFolderFileText(page, 'Vaults/My Notes 2/.papeliz/vault-name.json')) ?? 'null')).toEqual({ papelizVaultName: 'Fresh Notes' })
  expect(await readTestFolderFileText(page, 'Vaults/My Notes/.papeliz/vault-name.json')).toBe('{\n  "papelizVaultName": "Research"\n}\n')
})
