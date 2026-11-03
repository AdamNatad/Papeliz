import { expect, test } from '@playwright/test'

// The AI Assistant panel's switch, in a real browser: Ask, Plan, Write and Imagine. Imagine opens in
// place of the chat and keeps the run mode; a mode goes back to the chat. The header has no Imagine
// button of its own; Sessions and Usage still open from it, with a way back.

test('the switch moves between the chat’s modes and Imagine, keeping the run mode', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try Sample' }).first().click()
  const assistantPanel = page.getByRole('complementary', { name: 'AI Assistant' })
  const assistantPanelSwitch = assistantPanel.getByRole('radiogroup', { name: 'AI Assistant mode' })
  await expect(assistantPanelSwitch.getByRole('radio')).toHaveText(['Ask', 'Plan', 'Write', 'Imagine'])
  await expect(assistantPanel.getByRole('button', { name: 'Imagine', exact: true })).toHaveCount(0)
  const picturesSection = assistantPanel.getByRole('region', { name: 'Pictures' })

  // Plan: the chat, with Plan's line.
  await assistantPanelSwitch.getByRole('radio', { name: 'Plan' }).click()
  await expect(assistantPanelSwitch.getByRole('radio', { name: 'Plan' })).toHaveAttribute('aria-checked', 'true')
  await expect(assistantPanel).toContainText('Turn an idea into a step-by-step plan.')
  await expect(picturesSection).toHaveCount(0)

  // Imagine: its tab in place of the chat, the switch still showing, and no back arrow.
  await assistantPanelSwitch.getByRole('radio', { name: 'Imagine' }).click()
  await expect(assistantPanelSwitch.getByRole('radio', { name: 'Imagine' })).toHaveAttribute('aria-checked', 'true')
  await expect(assistantPanelSwitch.getByRole('radio', { name: 'Plan' })).toHaveAttribute('aria-checked', 'false')
  await expect(picturesSection).toBeVisible()
  await expect(assistantPanel).toContainText('Every picture made or brought in stays here')
  await expect(assistantPanel.getByRole('button', { name: 'Back to the Chat' })).toHaveCount(0)

  // Sessions from the header, then back: the chat is still in Plan, the mode Imagine left alone.
  await assistantPanel.getByRole('button', { name: 'Sessions' }).click()
  await expect(assistantPanelSwitch).toHaveCount(0)
  await assistantPanel.getByRole('button', { name: 'Back to the Chat' }).click()
  await expect(assistantPanelSwitch.getByRole('radio', { name: 'Plan' })).toHaveAttribute('aria-checked', 'true')
  await expect(picturesSection).toHaveCount(0)

  // Imagine again, then Write: back to the chat, in Write.
  await assistantPanelSwitch.getByRole('radio', { name: 'Imagine' }).click()
  await expect(picturesSection).toBeVisible()
  await assistantPanelSwitch.getByRole('radio', { name: 'Write' }).click()
  await expect(assistantPanelSwitch.getByRole('radio', { name: 'Write' })).toHaveAttribute('aria-checked', 'true')
  await expect(picturesSection).toHaveCount(0)
  await expect(assistantPanel).toContainText('Edits, adds and deletes notes.')
})
