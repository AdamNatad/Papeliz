import { expect, test, type Page } from '@playwright/test'

// The Settings gear's tooltip is its title, which Edge shows for a button focused from a key until focus
// moves on. Esc closes Settings and puts focus back on the gear, so the gear has no title then: it comes
// back when focus leaves the gear or the pointer comes back over it. A Tab onto the gear and a click
// outside keep it, and the gear's name stays Settings throughout. (The tooltip itself is the browser's
// own window, which a page check can't see; this checks the title it's drawn from.)

async function openSampleVaultSettingsGear(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try Sample' }).first().click()
  await expect(page.locator('header').getByText('Sample vault')).toBeVisible()
  return page.locator('header').getByRole('button', { name: 'Settings' })
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

  // Focus moves on: the title is back, and a Tab onto the gear finds it there.
  await page.keyboard.press('Tab')
  await expect(settingsGearButton).not.toBeFocused()
  await expect(settingsGearButton).toHaveAttribute('title', 'Settings')
  await page.keyboard.press('Shift+Tab')
  await expect(settingsGearButton).toBeFocused()
  await expect(settingsGearButton).toHaveAttribute('title', 'Settings')
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
