import { expect, test, type Page } from '@playwright/test'

// The workspace's top bar at four window sizes, on the web (`msedge`) and as Papeliz for Windows builds
// it (`msedge-desktop`, with Windows' three buttons at the bar's right edge): no two of its items overlap
// or leave the bar, the view switch's labels show when there's room and give way when there isn't,
// Export and Settings fold into More only at the narrowest, and the page never scrolls sideways.

interface PapelizTopbarItemBox {
  topbarItemName: string
  boxLeft: number
  boxRight: number
  boxTop: number
  boxBottom: number
}

interface PapelizTopbarReading {
  topbarItemBoxes: PapelizTopbarItemBox[]
  topbarLeft: number
  topbarRight: number
  areSwitchLabelsShown: boolean
  isMoreShown: boolean
  areExportAndSettingsShown: boolean
  areWindowButtonsShown: boolean
  isPageScrollingSideways: boolean
}

async function readTopbar(page: Page): Promise<PapelizTopbarReading> {
  return page.evaluate(() => {
    const topbarElement = document.querySelector<HTMLElement>('header.group\\/papeliz-topbar')!
    const isShown = (shownElement: Element) => shownElement.getClientRects().length > 0 && shownElement.getBoundingClientRect().width > 0.5
    const topbarItemElements: Element[] = []
    for (const topbarPart of topbarElement.children) {
      if (!topbarPart.hasAttribute('data-papeliz-topbar-side')) {
        topbarItemElements.push(topbarPart)
        continue
      }
      for (const topbarSideChild of topbarPart.children) {
        if (getComputedStyle(topbarSideChild).display === 'contents') topbarItemElements.push(...topbarSideChild.children)
        else topbarItemElements.push(topbarSideChild)
      }
    }
    const topbarItemBoxes = topbarItemElements.filter(isShown).map((topbarItemElement) => {
      const itemRect = topbarItemElement.getBoundingClientRect()
      return {
        topbarItemName: topbarItemElement.getAttribute('aria-label') ?? topbarItemElement.textContent?.trim().slice(0, 24) ?? topbarItemElement.tagName,
        boxLeft: itemRect.left,
        boxRight: itemRect.right,
        boxTop: itemRect.top,
        boxBottom: itemRect.bottom,
      }
    })
    const topbarRect = topbarElement.getBoundingClientRect()
    const switchLabelElement = topbarElement.querySelector('[role="group"][aria-label="Note view"] button span')!
    const topbarButton = (topbarButtonLabel: string) => topbarElement.querySelector(`button[aria-label="${topbarButtonLabel}"]`)
    return {
      topbarItemBoxes,
      topbarLeft: topbarRect.left,
      topbarRight: topbarRect.right,
      areSwitchLabelsShown: getComputedStyle(switchLabelElement).position !== 'absolute',
      isMoreShown: topbarButton('More') !== null && isShown(topbarButton('More')!),
      areExportAndSettingsShown: isShown(topbarButton('Export')!) && isShown(topbarButton('Settings')!),
      areWindowButtonsShown: topbarElement.querySelector('[role="group"][aria-label="Window"]') !== null,
      isPageScrollingSideways: document.documentElement.scrollWidth > window.innerWidth,
    }
  })
}

function findOverlappingTopbarItems(topbarItemBoxes: readonly PapelizTopbarItemBox[]): string[] {
  const overlappingTopbarItemPairs: string[] = []
  for (const [firstItemIndex, firstItemBox] of topbarItemBoxes.entries()) {
    for (const secondItemBox of topbarItemBoxes.slice(firstItemIndex + 1)) {
      const overlapWidth = Math.min(firstItemBox.boxRight, secondItemBox.boxRight) - Math.max(firstItemBox.boxLeft, secondItemBox.boxLeft)
      const overlapHeight = Math.min(firstItemBox.boxBottom, secondItemBox.boxBottom) - Math.max(firstItemBox.boxTop, secondItemBox.boxTop)
      if (overlapWidth > 0.5 && overlapHeight > 0.5) overlappingTopbarItemPairs.push(`${firstItemBox.topbarItemName} / ${secondItemBox.topbarItemName}`)
    }
  }
  return overlappingTopbarItemPairs
}

const papelizTopbarTestWindowSizes = [
  { width: 1280, height: 800 },
  { width: 900, height: 600 },
  { width: 640, height: 480 },
  { width: 400, height: 300 },
] as const

test('the top bar fits at 1280, 900, 640 and 400 × 300, with nothing overlapping', async ({ page }, testInfo) => {
  const isDesktopApp = testInfo.project.name === 'msedge-desktop'
  await page.goto('/')
  await page.getByRole('button', { name: 'Try Sample' }).first().click()
  await expect(page.locator('header').getByText('Sample vault')).toBeVisible()

  for (const testWindowSize of papelizTopbarTestWindowSizes) {
    await page.setViewportSize(testWindowSize)
    // The bar refits when its width changes; wait for the frame that measures it.
    await expect.poll(async () => findOverlappingTopbarItems((await readTopbar(page)).topbarItemBoxes), { message: `${testWindowSize.width} px` }).toEqual([])
    const topbarReading = await readTopbar(page)
    expect(topbarReading.areWindowButtonsShown, `${testWindowSize.width} px`).toBe(isDesktopApp)
    for (const topbarItemBox of topbarReading.topbarItemBoxes) {
      expect(topbarItemBox.boxLeft, `${topbarItemBox.topbarItemName} at ${testWindowSize.width} px`).toBeGreaterThanOrEqual(topbarReading.topbarLeft - 0.5)
      expect(topbarItemBox.boxRight, `${topbarItemBox.topbarItemName} at ${testWindowSize.width} px`).toBeLessThanOrEqual(topbarReading.topbarRight + 0.5)
    }
    expect(topbarReading.isPageScrollingSideways, `${testWindowSize.width} px`).toBe(false)
    // Export and Settings or More, never both.
    expect(topbarReading.isMoreShown, `${testWindowSize.width} px`).toBe(!topbarReading.areExportAndSettingsShown)

    if (testWindowSize.width === 1280) {
      expect(topbarReading.areSwitchLabelsShown).toBe(true)
      expect(topbarReading.isMoreShown).toBe(false)
    }
    if (testWindowSize.width === 400) {
      expect(topbarReading.areSwitchLabelsShown).toBe(false)
      if (isDesktopApp) expect(topbarReading.isMoreShown).toBe(true)
    }
  }

  // Back to the widest: everything comes back.
  await page.setViewportSize(papelizTopbarTestWindowSizes[0])
  await expect.poll(async () => (await readTopbar(page)).areSwitchLabelsShown).toBe(true)
  expect((await readTopbar(page)).isMoreShown).toBe(false)
})

test('at the narrowest, More opens Export and Settings, each under More', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try Sample' }).first().click()
  await expect(page.locator('header').getByText('Sample vault')).toBeVisible()
  // The file list and the Assistant open over the note on a narrow window, the Assistant over the bar
  // too; both are put away.
  await page.locator('header').getByRole('button', { name: 'Hide the File List' }).click()
  const assistantPanelButton = page.locator('header').getByRole('button', { name: 'AI Assistant' })
  if ((await assistantPanelButton.getAttribute('aria-pressed')) === 'true') await assistantPanelButton.click()
  // Narrower until the bar folds Export and Settings: at 400 px in Papeliz for Windows, a little
  // narrower on the web, which has no window buttons.
  const moreButton = page.locator('header').getByRole('button', { name: 'More' })
  for (const narrowWindowWidth of [400, 360, 330, 300, 280, 260]) {
    await page.setViewportSize({ width: narrowWindowWidth, height: 300 })
    await page.waitForTimeout(100)
    if (await moreButton.isVisible()) break
  }
  await expect(moreButton).toBeVisible()
  const moreButtonBox = (await moreButton.boundingBox())!

  await moreButton.click()
  await page.getByRole('menu', { name: 'More' }).getByRole('menuitem', { name: 'Export…' }).click()
  const exportPanel = page.getByRole('dialog', { name: 'Export' })
  await expect(exportPanel).toBeVisible()
  expect((await exportPanel.boundingBox())!.y).toBeGreaterThanOrEqual(moreButtonBox.y + moreButtonBox.height)
  await page.keyboard.press('Escape')
  await expect(exportPanel).toHaveCount(0)

  await moreButton.click()
  await page.getByRole('menu', { name: 'More' }).getByRole('menuitem', { name: 'Settings' }).click()
  const settingsPanel = page.getByRole('dialog', { name: 'Settings' })
  await expect(settingsPanel).toBeVisible()
  expect((await settingsPanel.boundingBox())!.y).toBeGreaterThanOrEqual(moreButtonBox.y + moreButtonBox.height)
})
