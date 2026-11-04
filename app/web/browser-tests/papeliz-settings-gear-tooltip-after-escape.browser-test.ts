import { expect, test, type Locator, type Page } from '@playwright/test'

// The Settings gear's tooltip is its title, which Edge shows for a button focused from a key until focus
// moves on. Esc closes Settings and puts focus back on the gear, so the gear has no title then: it comes
// back when focus leaves the gear or the pointer comes back over it. A Tab onto the gear and a click
// outside keep it, and the gear's name stays Settings throughout. The same goes for a confirm question
// closed with Esc, which puts focus back on what had it: Close Vault's, here. (The tooltip itself is the
// browser's own window, which a page check can't see; this checks the title it's drawn from.)

async function openSampleVaultSettingsGear(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try Sample' }).first().click()
  await expect(page.locator('header').getByText('Sample vault')).toBeVisible()
  return page.locator('header').getByRole('button', { name: 'Settings' })
}

// Focus moves on, and the title is back; then a Tab onto the gear, from Export just before it (what comes
// after the gear can still be loading in a development build), finds it there.
async function tabAwayAndBackOntoSettingsGear(page: Page, settingsGearButton: Locator) {
  await page.keyboard.press('Tab')
  await expect(settingsGearButton).not.toBeFocused()
  await expect(settingsGearButton).toHaveAttribute('title', 'Settings')
  await page.locator('header').getByRole('button', { name: 'Export' }).focus()
  await page.keyboard.press('Tab')
  await expect(settingsGearButton).toBeFocused()
  await expect(settingsGearButton).toHaveAttribute('title', 'Settings')
}

test('after Esc the gear keeps focus without its title, until focus leaves it', async ({ page }) => {
  const settingsGearButton = await openSampleVaultSettingsGear(page)
  const settingsPanel = page.getByRole('dialog', { name: 'Settings' })
  await expect(settingsGearButton).toHaveAttribute('title', 'Settings')

  await settingsGearButton.click()
  await expect(settingsPanel).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(settingsPanel).toHaveCount(0)
  await expect(settingsGearButton).toBeFocused()
  await expect(settingsGearButton).not.toHaveAttribute('title')
  await expect(settingsGearButton).toHaveAccessibleName('Settings')
  await tabAwayAndBackOntoSettingsGear(page, settingsGearButton)
})

test('after Esc the title comes back when the pointer comes back over the gear, and a click outside keeps it', async ({ page }) => {
  const settingsGearButton = await openSampleVaultSettingsGear(page)
  const settingsPanel = page.getByRole('dialog', { name: 'Settings' })

  // Opened and closed with the keyboard: Esc with the pointer elsewhere.
  await settingsGearButton.focus()
  await page.keyboard.press('Enter')
  await expect(settingsPanel).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(settingsGearButton).toBeFocused()
  await expect(settingsGearButton).not.toHaveAttribute('title')
  // Its hover tooltip as usual once the pointer comes over it.
  await settingsGearButton.hover()
  await expect(settingsGearButton).toHaveAttribute('title', 'Settings')

  // A click outside closes Settings without touching the title.
  await settingsGearButton.click()
  await expect(settingsPanel).toBeVisible()
  await page.locator('.cm-content').first().click()
  await expect(settingsPanel).toHaveCount(0)
  await expect(settingsGearButton).toHaveAttribute('title', 'Settings')
})

test('after Close Vault’s question closes with Esc the gear has focus without its title, until focus leaves it or the pointer comes over it', async ({ page }) => {
  const settingsGearButton = await openSampleVaultSettingsGear(page)
  const closeVaultQuestion = page.getByRole('dialog', { name: /^Close “/ })
  const askCloseVaultThenEscape = async () => {
    await settingsGearButton.click()
    await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Close Vault' }).click()
    await expect(closeVaultQuestion).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(closeVaultQuestion).toHaveCount(0)
    await expect(settingsGearButton).toBeFocused()
  }

  await askCloseVaultThenEscape()
  await expect(settingsGearButton).not.toHaveAttribute('title')
  await expect(settingsGearButton).toHaveAccessibleName('Settings')
  await tabAwayAndBackOntoSettingsGear(page, settingsGearButton)

  // Again, then the pointer over the gear brings the title back.
  await page.mouse.move(600, 500)
  await askCloseVaultThenEscape()
  await expect(settingsGearButton).not.toHaveAttribute('title')
  await settingsGearButton.hover()
  await expect(settingsGearButton).toHaveAttribute('title', 'Settings')
  // The vault stayed open.
  await expect(page.locator('header').getByText('Sample vault')).toBeVisible()
})
