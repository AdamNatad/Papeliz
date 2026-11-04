import { expect, test } from '@playwright/test'

// A menu puts focus back on its button when Esc closes it, and Edge shows the title of a button focused from
// a key as a tooltip that stays until focus moves on. So the button has no title then: it comes back when
// focus leaves the button or the pointer comes over it, and a Tab onto the button finds it there. Checked on
// the file list's Import. (The tooltip itself is the browser's own window, which a page check can't see;
// this checks the title it's drawn from.)

test('the Import menu closed with Esc leaves Import focused without its title, until focus leaves it or the pointer comes over it', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try Sample' }).first().click()
  await expect(page.locator('header').getByText('Sample vault')).toBeVisible()
  const newButton = page.getByRole('button', { name: 'New', exact: true })
  const importButton = page.getByRole('button', { name: 'Import', exact: true })
  const importMenu = page.getByRole('menu', { name: 'Import' })
  await expect(importButton).toHaveAttribute('title', 'Import')

  await importButton.click()
  await expect(importMenu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(importMenu).toHaveCount(0)
  await expect(importButton).toBeFocused()
  await expect(importButton).not.toHaveAttribute('title')
  await expect(importButton).toHaveAccessibleName('Import')

  // Focus moves on: the title is back, and a Tab onto Import, from New just before it, finds it there.
  await page.keyboard.press('Tab')
  await expect(importButton).not.toBeFocused()
  await expect(importButton).toHaveAttribute('title', 'Import')
  await newButton.focus()
  await page.keyboard.press('Tab')
  await expect(importButton).toBeFocused()
  await expect(importButton).toHaveAttribute('title', 'Import')

  // Opened with Enter and closed with Esc again, the pointer elsewhere: the pointer coming over Import
  // brings the title back.
  await page.mouse.move(600, 500)
  await page.keyboard.press('Enter')
  await expect(importMenu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(importButton).toBeFocused()
  await expect(importButton).not.toHaveAttribute('title')
  await importButton.hover()
  await expect(importButton).toHaveAttribute('title', 'Import')
})
