import { expect, test, type Page } from '@playwright/test'

// The workspace's top bar at the widths a window, a tablet and a phone give it, on the web (`msedge`) and as
// Papeliz for Windows builds it (`msedge-desktop`, with Windows' three buttons at the bar's right edge): no two of
// its items overlap or leave the bar, the word Papeliz shows at every width, and the page never scrolls sideways.
// The bar gives way in its order (the vault's name, the switch's labels, the switch's place in the centre, Export
// and Settings into More, then the Assistant into More), each part going at one width and staying gone below it.
// The Assistant, Export and the gear stay their own buttons while they fit; More, drawn as the phone app's square
// menu, shows only when it stands for two of them or more.

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
  isPapelizWordShown: boolean
  isVaultNameShown: boolean
  areSwitchLabelsShown: boolean
  hasSwitchLeftTheCentre: boolean
  isAssistantShown: boolean
  isExportShown: boolean
  isSettingsGearShown: boolean
  isMoreShown: boolean
  isMoreSquareMenu: boolean
  areWindowButtonsShown: boolean
  isPageScrollingSideways: boolean
}

async function readTopbar(page: Page): Promise<PapelizTopbarReading> {
  return page.evaluate(() => {
    const topbarElement = document.querySelector<HTMLElement>('header.group\\/papeliz-topbar')!
    const isShown = (shownElement: Element | null) => shownElement !== null && shownElement.getClientRects().length > 0 && shownElement.getBoundingClientRect().width > 0.5
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
    const topbarLeftSideElement = topbarElement.querySelector('[data-papeliz-topbar-side]')!
    const papelizWordElement = [...topbarLeftSideElement.querySelectorAll('span')].find((spanElement) => spanElement.textContent === 'Papeliz')!
    const switchLabelElement = topbarElement.querySelector('[role="group"][aria-label="Note view"] button span')!
    const topbarButton = (topbarButtonLabel: string) => topbarElement.querySelector(`button[aria-label="${topbarButtonLabel}"]`)
    return {
      topbarItemBoxes,
      topbarLeft: topbarRect.left,
      topbarRight: topbarRect.right,
      // Shown in full: not hidden from sight, and not cut off at the left side's edge.
      isPapelizWordShown:
        isShown(papelizWordElement) &&
        getComputedStyle(papelizWordElement).position !== 'absolute' &&
        papelizWordElement.getBoundingClientRect().right <= topbarLeftSideElement.getBoundingClientRect().right + 0.5,
      isVaultNameShown: isShown(topbarElement.querySelector('[data-papeliz-topbar-vault-name]')),
      areSwitchLabelsShown: getComputedStyle(switchLabelElement).position !== 'absolute',
      // The bar's own step, not Papeliz for Windows' window buttons, which also push the switch left of centre.
      hasSwitchLeftTheCentre: topbarElement.hasAttribute('data-papeliz-topbar-switch-uncentered'),
      isAssistantShown: isShown(topbarButton('AI Assistant')),
      isExportShown: isShown(topbarButton('Export')),
      isSettingsGearShown: isShown(topbarButton('Settings')),
      isMoreShown: isShown(topbarButton('More')),
      isMoreSquareMenu: topbarButton('More')?.querySelector('svg.lucide-square-menu') !== null,
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

// The window at this width, once the bar has measured it (it refits in the frame after its width changes).
async function setTopbarWindowSize(page: Page, topbarWindowSize: { width: number; height: number }) {
  await page.setViewportSize(topbarWindowSize)
  await page.evaluate(() => new Promise((resolveAfterTwoFrames) => requestAnimationFrame(() => requestAnimationFrame(resolveAfterTwoFrames))))
}

// What the bar has given up, as names, so a narrower width can be checked to keep each one.
function listTopbarGivenUpParts(topbarReading: PapelizTopbarReading): string[] {
  return [
    !topbarReading.isVaultNameShown && 'the vault’s name',
    !topbarReading.areSwitchLabelsShown && 'the switch’s labels',
    topbarReading.hasSwitchLeftTheCentre && 'the switch’s place in the centre',
    !topbarReading.isExportShown && !topbarReading.isSettingsGearShown && 'Export and Settings',
    !topbarReading.isAssistantShown && 'the Assistant',
  ].filter((givenUpPart): givenUpPart is string => givenUpPart !== false)
}

const papelizTopbarGiveWayOrder = ['the vault’s name', 'the switch’s labels', 'the switch’s place in the centre', 'Export and Settings', 'the Assistant']

async function openSampleVaultWithPanelsAway(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try Sample' }).first().click()
  await expect(page.locator('header').getByText('Sample vault')).toBeVisible()
  // The file list and the Assistant open over the note on a narrow window, the Assistant over the bar
  // too; both are put away.
  await page.locator('header').getByRole('button', { name: 'Hide the File List' }).click()
  const assistantPanelButton = page.locator('header').getByRole('button', { name: 'AI Assistant' })
  if ((await assistantPanelButton.getAttribute('aria-pressed')) === 'true') await assistantPanelButton.click()
}

const papelizTopbarTestWindowSizes = [
  { width: 1280, height: 800 },
  { width: 900, height: 600 },
  { width: 640, height: 480 },
  { width: 412, height: 800 },
  { width: 400, height: 300 },
  { width: 360, height: 740 },
  { width: 300, height: 600 },
  { width: 280, height: 600 },
] as const

test('the top bar fits from 1280 px down to the narrowest window, keeps the word Papeliz, and gives way in its order', async ({ page }, testInfo) => {
  const isDesktopApp = testInfo.project.name === 'msedge-desktop'
  await openSampleVaultWithPanelsAway(page)

  let givenUpPartsAtWiderWidth: string[] = []
  for (const testWindowSize of papelizTopbarTestWindowSizes) {
    // 400 × 300 is Papeliz for Windows' smallest window, so it goes no narrower; the web goes on to 280 px.
    if (isDesktopApp ? testWindowSize.width < 400 : testWindowSize.width === 400) continue
    await setTopbarWindowSize(page, testWindowSize)
    const widthLabel = `${testWindowSize.width} px`
    await expect.poll(async () => findOverlappingTopbarItems((await readTopbar(page)).topbarItemBoxes), { message: widthLabel }).toEqual([])
    const topbarReading = await readTopbar(page)
    expect(topbarReading.areWindowButtonsShown, widthLabel).toBe(isDesktopApp)
    for (const topbarItemBox of topbarReading.topbarItemBoxes) {
      expect(topbarItemBox.boxLeft, `${topbarItemBox.topbarItemName} at ${widthLabel}`).toBeGreaterThanOrEqual(topbarReading.topbarLeft - 0.5)
      expect(topbarItemBox.boxRight, `${topbarItemBox.topbarItemName} at ${widthLabel}`).toBeLessThanOrEqual(topbarReading.topbarRight + 0.5)
    }
    expect(topbarReading.isPageScrollingSideways, widthLabel).toBe(false)
    expect(topbarReading.isPapelizWordShown, `the word Papeliz at ${widthLabel}`).toBe(true)

    // Export and the gear fold together, and only then More (the square menu) shows: never for one button.
    expect(topbarReading.isSettingsGearShown, `the gear at ${widthLabel}`).toBe(topbarReading.isExportShown)
    expect(topbarReading.isMoreShown, `More at ${widthLabel}`).toBe(!topbarReading.isSettingsGearShown)
    expect(topbarReading.isMoreSquareMenu, widthLabel).toBe(true)

    // What it gave up comes in the bar's order, and what went at a wider width stays gone.
    const givenUpParts = listTopbarGivenUpParts(topbarReading)
    expect(givenUpParts, widthLabel).toEqual(papelizTopbarGiveWayOrder.slice(0, givenUpParts.length))
    expect(givenUpParts.length, widthLabel).toBeGreaterThanOrEqual(givenUpPartsAtWiderWidth.length)
    givenUpPartsAtWiderWidth = givenUpParts

    if (testWindowSize.width === 1280) expect(givenUpParts, widthLabel).toEqual([])
    // A phone: the Assistant, Export and the gear beside the switch's icons, and no More. At 360 px the switch has
    // left the centre so the word Papeliz keeps its room.
    if (!isDesktopApp && testWindowSize.width === 412) expect(givenUpParts, widthLabel).toEqual(['the vault’s name', 'the switch’s labels'])
    if (!isDesktopApp && testWindowSize.width === 360) {
      expect(givenUpParts, widthLabel).toEqual(['the vault’s name', 'the switch’s labels', 'the switch’s place in the centre'])
    }
    if (!isDesktopApp && testWindowSize.width === 300) expect(givenUpParts.at(-1), widthLabel).toBe('Export and Settings')
    // At the narrowest, More alone on the right.
    if (testWindowSize.width === 280 || (isDesktopApp && testWindowSize.width === 400)) expect(givenUpParts.at(-1), widthLabel).toBe('the Assistant')
  }

  // Back to the widest: everything comes back.
  await setTopbarWindowSize(page, papelizTopbarTestWindowSizes[0])
  await expect.poll(async () => listTopbarGivenUpParts(await readTopbar(page))).toEqual([])
  expect((await readTopbar(page)).isMoreShown).toBe(false)
})

test('from 680 down to 600 px, one pixel at a time, each part of the bar goes once and stays gone', async ({ page }) => {
  await openSampleVaultWithPanelsAway(page)
  let givenUpPartsAtWiderWidth: string[] = []
  for (let topbarWindowWidth = 680; topbarWindowWidth >= 600; topbarWindowWidth--) {
    await setTopbarWindowSize(page, { width: topbarWindowWidth, height: 480 })
    const givenUpParts = listTopbarGivenUpParts(await readTopbar(page))
    for (const givenUpPartAtWiderWidth of givenUpPartsAtWiderWidth) expect(givenUpParts, `${topbarWindowWidth} px`).toContain(givenUpPartAtWiderWidth)
    givenUpPartsAtWiderWidth = givenUpParts
  }
})

test('More holds Export and Settings, then the Assistant too, each opening from More', async ({ page }, testInfo) => {
  // Papeliz for Windows' window goes no narrower than 400 px.
  const narrowestTopbarWindowWidth = testInfo.project.name === 'msedge-desktop' ? 400 : 260
  await openSampleVaultWithPanelsAway(page)
  const moreButton = page.locator('header').getByRole('button', { name: 'More' })
  const moreMenu = page.getByRole('menu', { name: 'More' })

  // Narrows the window a few pixels at a time until the bar reads as `isWantedTopbarReading` wants.
  async function narrowTopbarUntil(isWantedTopbarReading: (topbarReading: PapelizTopbarReading) => boolean): Promise<number> {
    for (let topbarWindowWidth = 632; topbarWindowWidth >= narrowestTopbarWindowWidth; topbarWindowWidth -= 4) {
      await setTopbarWindowSize(page, { width: topbarWindowWidth, height: 600 })
      if (isWantedTopbarReading(await readTopbar(page))) return topbarWindowWidth
    }
    throw new Error('The bar never read as wanted')
  }

  // Export and Settings folded in, the Assistant still its own button: Export…, then Settings, each panel
  // hanging from More.
  await narrowTopbarUntil((topbarReading) => topbarReading.isMoreShown && topbarReading.isAssistantShown)
  await expect(moreButton.locator('svg.lucide-square-menu')).toBeVisible()
  const moreButtonBox = (await moreButton.boundingBox())!
  await moreButton.click()
  await expect(moreMenu.getByRole('menuitem')).toHaveText(['Export…', 'Settings'])
  await moreMenu.getByRole('menuitem', { name: 'Export…' }).click()
  const exportPanel = page.getByRole('dialog', { name: 'Export' })
  await expect(exportPanel).toBeVisible()
  expect((await exportPanel.boundingBox())!.y).toBeGreaterThanOrEqual(moreButtonBox.y + moreButtonBox.height)
  await page.keyboard.press('Escape')
  await expect(exportPanel).toHaveCount(0)
  await moreButton.click()
  await moreMenu.getByRole('menuitem', { name: 'Settings' }).click()
  const settingsPanel = page.getByRole('dialog', { name: 'Settings' })
  await expect(settingsPanel).toBeVisible()
  expect((await settingsPanel.boundingBox())!.y).toBeGreaterThanOrEqual(moreButtonBox.y + moreButtonBox.height)
  await page.keyboard.press('Escape')
  await expect(settingsPanel).toHaveCount(0)
  // Esc gives focus back to More, which stands in for the gear, without its title (so no tooltip stays up).
  await expect(moreButton).toBeFocused()
  await expect(moreButton).not.toHaveAttribute('title')

  // The Assistant folded in too: More alone on the right, and its first item opens the Assistant.
  await narrowTopbarUntil((topbarReading) => !topbarReading.isAssistantShown)
  await moreButton.click()
  await expect(moreMenu.getByRole('menuitem')).toHaveText(['AI Assistant', 'Export…', 'Settings'])
  await moreMenu.getByRole('menuitem', { name: 'AI Assistant' }).click()
  await expect(page.locator('header [data-papeliz-topbar-folded-buttons] button[aria-label="AI Assistant"]')).toHaveAttribute('aria-pressed', 'true')
})
