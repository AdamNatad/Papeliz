import { expect, test } from '@playwright/test'

// The loading look in a real browser. A counted job's readout shows the bar filled to its count and
// its steps open from the first frame; pressing the pill folds them for that readout only, so the
// next readout starts open again; and with reduced motion a sliding bar or a swept placeholder still
// breathes, so there is always a sign that work is happening.

test('the start counts its steps, with More info open, and every new readout starts open', async ({ page }) => {
  // The app's own settings never come back and the page's timers stand still, so the start waits at
  // its theme step with the code step done.
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => new EventTarget() as IDBOpenDBRequest
  })
  await page.clock.install({ time: new Date('2026-11-04T08:00:00') })
  await page.clock.pauseAt(new Date('2026-11-04T08:00:01'))
  await page.goto('/')

  const startProgressBar = page.getByRole('progressbar', { name: 'Starting Papeliz' })
  await expect(startProgressBar).toHaveAttribute('aria-valuenow', '33')
  const startReadoutPill = page.locator('.papeliz-loading-readout-pill')
  await expect(startReadoutPill).toHaveAttribute('aria-expanded', 'true')
  await expect(startReadoutPill).toContainText('33%')
  const startSteps = page.getByRole('list', { name: 'Steps' })
  await expect(startSteps).toBeVisible()
  await expect(startSteps.getByRole('listitem')).toHaveText([/Loading Papeliz/, /Reading your theme/, /Opening the start page/])
  await expect(startSteps.getByRole('listitem').nth(1)).toHaveAttribute('data-papeliz-loading-step-state', 'running')

  // The pill folds the steps away.
  await startReadoutPill.click()
  await expect(startReadoutPill).toHaveAttribute('aria-expanded', 'false')
  await expect(startSteps).toBeHidden()

  // The fold isn't kept: the next readout starts open.
  await page.reload()
  await expect(page.getByRole('progressbar', { name: 'Starting Papeliz' })).toHaveAttribute('aria-valuenow', '33')
  await expect(page.locator('.papeliz-loading-readout-pill')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('list', { name: 'Steps' })).toBeVisible()
})

test('opening a vault shows its opening screen, and reduced motion keeps the bar breathing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  // The workspace's code is held back, so the vault's opening screen stays up.
  let releaseWorkspaceCode = () => {}
  const workspaceCodeReleased = new Promise<void>((resolveWorkspaceCodeRelease) => {
    releaseWorkspaceCode = resolveWorkspaceCodeRelease
  })
  await page.route(/\/src\/modules\/workspace\/papeliz-workspace\.tsx/, async (workspaceCodeRoute) => {
    await workspaceCodeReleased
    await workspaceCodeRoute.continue()
  })
  await page.goto('/')
  await expect(page.locator('.papeliz-loading-opening-screen')).toHaveCount(0)
  await page.getByRole('button', { name: 'Try Sample' }).first().click()

  const vaultProgressBar = page.getByRole('progressbar', { name: 'Opening Sample vault' })
  await expect(vaultProgressBar).toBeVisible()
  // Nothing can be counted yet, so the bar slides and the pill shows no percentage.
  await expect(vaultProgressBar).not.toHaveAttribute('aria-valuenow', /.*/)
  await expect(page.locator('.papeliz-loading-readout-pill')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.papeliz-loading-readout-pill')).not.toContainText('%')
  await expect(page.getByRole('list', { name: 'Steps' }).getByRole('listitem')).toHaveText([/Loading MD Code and MD View/])

  // Reduced motion: the slide holds still and breathes instead of stopping dead.
  const slideMotion = await vaultProgressBar.locator('.papeliz-loading-bar-slide').evaluate((slideElement) => {
    const slideStyle = getComputedStyle(slideElement)
    return { animationName: slideStyle.animationName, animationDuration: slideStyle.animationDuration, animationPlayState: slideStyle.animationPlayState }
  })
  expect(slideMotion).toEqual({ animationName: 'papeliz-loading-breathe', animationDuration: '1.4s', animationPlayState: 'running' })

  releaseWorkspaceCode()
  await expect(page.locator('.cm-content, .papeliz-md-view-article').first()).toBeVisible()
  await expect(page.locator('.papeliz-loading-opening-screen')).toHaveCount(0)
})

test('a diagram being drawn says so with stepping dots in a swept box, which breathes with reduced motion', async ({ page }) => {
  // Mermaid's code is held back, so the diagram stays at its placeholder.
  let releaseMermaidCode = () => {}
  const mermaidCodeReleased = new Promise<void>((resolveMermaidCodeRelease) => {
    releaseMermaidCode = resolveMermaidCodeRelease
  })
  await page.route(/\/node_modules\/\.vite\/deps\/mermaid\.js/, async (mermaidCodeRoute) => {
    await mermaidCodeReleased
    await mermaidCodeRoute.continue()
  })
  await page.goto('/')
  await page.evaluate(async () => {
    const { mountPapelizMermaidDiagram } = await import('/src/modules/md-view/papeliz-md-view-mermaid-diagrams.ts')
    const diagramElement = document.createElement('div')
    diagramElement.className = 'papeliz-mermaid-diagram'
    diagramElement.id = 'papeliz-loading-test-diagram'
    document.body.append(diagramElement)
    mountPapelizMermaidDiagram(diagramElement, 'flowchart LR\n  Measure --> Order')
  })

  const diagramPlaceholder = page.locator('#papeliz-loading-test-diagram .papeliz-mermaid-diagram-placeholder')
  await expect(diagramPlaceholder).toHaveText('Drawing the diagram')
  await expect(diagramPlaceholder.locator('.papeliz-loading-dots')).toHaveCount(1)
  expect(await diagramPlaceholder.evaluate((placeholderElement) => getComputedStyle(placeholderElement).animationName)).toBe('papeliz-loading-sheen-sweep')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(
    await diagramPlaceholder.evaluate((placeholderElement) => [getComputedStyle(placeholderElement).animationName, getComputedStyle(placeholderElement).animationDuration]),
  ).toEqual(['papeliz-loading-breathe', '1.4s'])

  releaseMermaidCode()
  await expect(page.locator('#papeliz-loading-test-diagram svg').first()).toBeVisible()
  await expect(diagramPlaceholder).toHaveCount(0)
})
