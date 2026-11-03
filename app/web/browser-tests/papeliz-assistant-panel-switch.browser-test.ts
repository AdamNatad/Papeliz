import { expect, test, type Page } from '@playwright/test'

// The AI Assistant panel's two levels, in a real browser: Notes and Imagine as tabs under the header,
// and on Notes the Ask | Plan | Write switch. Going to Imagine and back keeps the run mode. Sessions and
// Usage open from the header with a way back, the tabs staying with neither picked; a tab leaves them.

test('the Notes and Imagine tabs switch pages, keeping the run mode, and Sessions leaves both unpicked', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try Sample' }).first().click()
  const assistantPanel = page.getByRole('complementary', { name: 'AI Assistant' })
  const assistantPanelPageTabs = assistantPanel.getByRole('tablist', { name: 'AI Assistant pages' })
  const notesTab = assistantPanelPageTabs.getByRole('tab', { name: 'Notes' })
  const imagineTab = assistantPanelPageTabs.getByRole('tab', { name: 'Imagine' })
  const assistantModeSwitch = assistantPanel.getByRole('radiogroup', { name: 'AI Assistant mode' })
  const imaginePage = assistantPanel.getByRole('tabpanel', { name: 'Imagine' })
  await expect(assistantPanelPageTabs.getByRole('tab')).toHaveText(['Notes', 'Imagine'])
  await expect(notesTab).toHaveAttribute('aria-selected', 'true')
  await expect(assistantModeSwitch.getByRole('radio')).toHaveText(['Ask', 'Plan', 'Write'])
  await expect(assistantPanel.getByRole('button', { name: 'Imagine', exact: true })).toHaveCount(0)

  // Plan, on the Notes tab.
  await assistantModeSwitch.getByRole('radio', { name: 'Plan' }).click()
  await expect(assistantPanel).toContainText('Turn an idea into a step-by-step plan.')

  // Imagine: its page alone, with no mode switch or back arrow.
  await imagineTab.click()
  await expect(imagineTab).toHaveAttribute('aria-selected', 'true')
  await expect(notesTab).toHaveAttribute('aria-selected', 'false')
  await expect(imaginePage).toBeVisible()
  await expect(assistantModeSwitch).toHaveCount(0)
  await expect(assistantPanel.getByRole('button', { name: 'Back to Notes' })).toHaveCount(0)

  // Back to Notes: still in Plan.
  await notesTab.click()
  await expect(imaginePage).toHaveCount(0)
  await expect(assistantModeSwitch.getByRole('radio', { name: 'Plan' })).toHaveAttribute('aria-checked', 'true')

  // Sessions from the header: the tabs stay, neither picked, and the back arrow is there.
  await assistantPanel.getByRole('button', { name: 'Sessions' }).click()
  await expect(assistantPanel.getByRole('button', { name: 'Back to Notes' })).toBeVisible()
  await expect(notesTab).toHaveAttribute('aria-selected', 'false')
  await expect(imagineTab).toHaveAttribute('aria-selected', 'false')
  await expect(assistantModeSwitch).toHaveCount(0)

  // A tab leaves Sessions: Imagine, then Notes with the mode kept.
  await imagineTab.click()
  await expect(imaginePage).toBeVisible()
  await expect(assistantPanel.getByRole('button', { name: 'Back to Notes' })).toHaveCount(0)
  await notesTab.click()
  await expect(assistantModeSwitch.getByRole('radio', { name: 'Plan' })).toHaveAttribute('aria-checked', 'true')
})

// Where the underline is drawn against the chosen tab, and how it was last told to move.
async function readPageTabUnderline(page: Page, chosenTabName: string) {
  return page.evaluate((underlinedTabName) => {
    const pageTabList = document.querySelector('[role="tablist"][aria-label="AI Assistant pages"]')!
    const pageTabUnderline = pageTabList.querySelector<HTMLElement>('[data-papeliz-assistant-panel-page-tab-underline]')!
    const underlinedTab = [...pageTabList.querySelectorAll('[role="tab"]')].find((pageTab) => pageTab.textContent?.trim() === underlinedTabName)!
    const underlineRect = pageTabUnderline.getBoundingClientRect()
    const tabRect = underlinedTab.getBoundingClientRect()
    return {
      leftEdgeGap: Math.abs(underlineRect.left - tabRect.left),
      rightEdgeGap: Math.abs(underlineRect.right - tabRect.right),
      underlineTransition: pageTabUnderline.style.transition,
      underlineOpacity: pageTabUnderline.style.opacity,
    }
  }, chosenTabName)
}

test('the tab row’s underline appears in place, slides to the chosen tab, fades for Sessions, and only moves with reduced motion', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try Sample' }).first().click()
  const assistantPanelPageTabs = page.getByRole('tablist', { name: 'AI Assistant pages' })
  await expect(assistantPanelPageTabs.getByRole('tab', { name: 'Notes' })).toHaveAttribute('aria-selected', 'true')

  // The first draw: under Notes, with no slide.
  await expect.poll(async () => (await readPageTabUnderline(page, 'Notes')).leftEdgeGap).toBeLessThan(1)
  expect(await readPageTabUnderline(page, 'Notes')).toMatchObject({ underlineTransition: 'opacity 150ms ease-out', underlineOpacity: '1' })

  // Imagine: the right edge leads, then it settles exactly under the tab.
  await assistantPanelPageTabs.getByRole('tab', { name: 'Imagine' }).click()
  await expect.poll(async () => (await readPageTabUnderline(page, 'Imagine')).underlineTransition).toContain('right 200ms')
  await expect.poll(async () => {
    const imagineUnderline = await readPageTabUnderline(page, 'Imagine')
    return Math.max(imagineUnderline.leftEdgeGap, imagineUnderline.rightEdgeGap)
  }).toBeLessThan(1)

  // Sessions: the underline fades where it is, then comes back under the tab pressed.
  await page.getByRole('complementary', { name: 'AI Assistant' }).getByRole('button', { name: 'Sessions' }).click()
  await expect.poll(async () => (await readPageTabUnderline(page, 'Imagine')).underlineOpacity).toBe('0')
  await assistantPanelPageTabs.getByRole('tab', { name: 'Notes' }).click()
  await expect.poll(async () => (await readPageTabUnderline(page, 'Notes')).underlineOpacity).toBe('1')

  // A narrow row shows the icons alone: the underline follows, under each tab, and back when wide.
  const setPageTabListWidth = (pageTabListWidth: string) =>
    page.evaluate((cssWidth) => {
      document.querySelector<HTMLElement>('[role="tablist"][aria-label="AI Assistant pages"]')!.style.width = cssWidth
    }, pageTabListWidth)
  const readUnderlineGap = async (underlinedTabName: string) => {
    const pageTabUnderline = await readPageTabUnderline(page, underlinedTabName)
    return Math.max(pageTabUnderline.leftEdgeGap, pageTabUnderline.rightEdgeGap)
  }
  await setPageTabListWidth('200px')
  await expect.poll(() => readUnderlineGap('Notes')).toBeLessThan(1)
  await assistantPanelPageTabs.getByRole('tab', { name: 'Imagine' }).click()
  await expect.poll(() => readUnderlineGap('Imagine')).toBeLessThan(1)
  await setPageTabListWidth('')
  await expect.poll(() => readUnderlineGap('Imagine')).toBeLessThan(1)
  await assistantPanelPageTabs.getByRole('tab', { name: 'Notes' }).click()
  await expect.poll(() => readUnderlineGap('Notes')).toBeLessThan(1)

  // Reduced motion: the underline moves without the slide.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await assistantPanelPageTabs.getByRole('tab', { name: 'Imagine' }).click()
  await expect.poll(async () => (await readPageTabUnderline(page, 'Imagine')).underlineTransition).toBe('none')
  await expect.poll(async () => (await readPageTabUnderline(page, 'Imagine')).leftEdgeGap).toBeLessThan(1)
})
