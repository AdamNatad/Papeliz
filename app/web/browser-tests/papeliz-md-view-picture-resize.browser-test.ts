import { expect, test, type Locator, type Page } from '@playwright/test'

// Resizing pictures in the editable MD View, in a real browser: a vault picture dragged smaller, its
// width in MD Code and undone in one step; an embed stepped with the keys; a web picture dragged
// larger; a width typed in MD Code; and the read view showing the width with no handle. Every request
// off this computer is answered here or refused.

const webPictureUrl = 'https://pictures.example.com/chart.png'

const resizeTestNoteText = ['# Resize test', '', '![Blue box](Pictures/blue.png)', '', '![[blue.png]]', '', `![Web chart](${webPictureUrl})`, '', 'The end.'].join('\n')

// A plain picture of the given size, drawn on a canvas in the page: a PNG with no metadata.
async function drawTestPicturePngBase64(page: Page, pictureWidthPixels: number, pictureHeightPixels: number): Promise<string> {
  return page.evaluate(
    async ({ drawnWidthPixels, drawnHeightPixels }) => {
      const pictureCanvas = Object.assign(document.createElement('canvas'), { width: drawnWidthPixels, height: drawnHeightPixels })
      const pictureCanvasContext = pictureCanvas.getContext('2d')!
      pictureCanvasContext.fillStyle = '#0064d4'
      pictureCanvasContext.fillRect(0, 0, drawnWidthPixels, drawnHeightPixels)
      pictureCanvasContext.fillStyle = '#ffffff'
      pictureCanvasContext.fillRect(20, 20, drawnHeightPixels - 40, drawnHeightPixels - 40)
      const pictureBlob = await new Promise<Blob>((resolveBlob) => pictureCanvas.toBlob((drawnBlob) => resolveBlob(drawnBlob!), 'image/png'))
      const pictureBytes = new Uint8Array(await pictureBlob.arrayBuffer())
      return btoa(Array.from(pictureBytes, (pictureByte) => String.fromCharCode(pictureByte)).join(''))
    },
    { drawnWidthPixels: pictureWidthPixels, drawnHeightPixels: pictureHeightPixels },
  )
}

// The sample vault with a 400 × 200 vault picture and the resize note, opened in MD View; the web
// picture is a 300 × 150 stand-in.
async function openResizeTestNote(page: Page): Promise<{ refusedOutsideRequestUrls: string[] }> {
  const refusedOutsideRequestUrls: string[] = []
  await page.goto('/')
  await page.getByRole('button', { name: 'Try Sample' }).first().click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  const webPicturePngBase64 = await drawTestPicturePngBase64(page, 300, 150)
  await page.context().route('**/*', (route) => {
    const requestUrl = new URL(route.request().url())
    if (requestUrl.hostname === '127.0.0.1' || requestUrl.hostname === 'localhost') return route.continue()
    if (requestUrl.href === webPictureUrl) return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(webPicturePngBase64, 'base64') })
    refusedOutsideRequestUrls.push(requestUrl.href)
    return route.abort()
  })
  const vaultPicturePngBase64 = await drawTestPicturePngBase64(page, 400, 200)
  await page.evaluate(
    async ({ seededPngBase64, seededNoteText }) => {
      const { usePapelizWorkspaceStore } = await import('/src/modules/workspace/papeliz-workspace-store.ts')
      const workspaceState = usePapelizWorkspaceStore.getState()
      const pngBytes = Uint8Array.from(atob(seededPngBase64), (binaryCharacter) => binaryCharacter.charCodeAt(0))
      await workspaceState.openVault!.papelizVaultAdapter.createVaultAttachmentFile('Pictures/blue.png', new Blob([pngBytes]))
      await workspaceState.createVaultNoteFromAssistant('Resize test.md', seededNoteText)
      await usePapelizWorkspaceStore.getState().openVaultNote('Resize test.md')
      usePapelizWorkspaceStore.getState().setNoteViewMode('md-view')
    },
    { seededPngBase64: vaultPicturePngBase64, seededNoteText: resizeTestNoteText },
  )
  return { refusedOutsideRequestUrls }
}

async function setNoteViewMode(page: Page, noteViewMode: 'md-code' | 'md-view'): Promise<void> {
  await page.evaluate(async (wantedNoteViewMode) => {
    const { usePapelizWorkspaceStore } = await import('/src/modules/workspace/papeliz-workspace-store.ts')
    usePapelizWorkspaceStore.getState().setNoteViewMode(wantedNoteViewMode)
  }, noteViewMode)
}

const editableMdView = '.papeliz-md-view .cm-content'

// A picture widget in the editable MD View, by its picture's description, once the picture shows.
async function findShownPictureWidget(page: Page, pictureAltText: string): Promise<Locator> {
  const pictureWidget = page.locator(`${editableMdView} .cm-papeliz-md-view-media-resizable`, { has: page.locator(`img[alt="${pictureAltText}"]`) })
  const shownPicture = pictureWidget.locator('img.papeliz-md-view-picture')
  await expect(shownPicture).toBeVisible()
  await expect.poll(() => shownPicture.evaluate((pictureElement: HTMLImageElement) => pictureElement.complete && pictureElement.naturalWidth > 0)).toBe(true)
  return pictureWidget
}

async function readShownPictureWidth(pictureWidget: Locator): Promise<number> {
  return pictureWidget.locator('img.papeliz-md-view-picture').evaluate((pictureElement: HTMLImageElement) => pictureElement.offsetWidth)
}

// Drags a picture's handle across by the given distance, checking the width shown while it moves.
async function dragPictureHandle(page: Page, pictureWidget: Locator, dragDistancePixels: number, expectedDraggedWidthPixels: number): Promise<void> {
  const pictureResizeHandle = pictureWidget.getByRole('slider')
  await pictureWidget.hover()
  await expect.poll(() => pictureResizeHandle.evaluate((handleElement) => getComputedStyle(handleElement).opacity)).toBe('1')
  const handleBox = (await pictureResizeHandle.boundingBox())!
  const handleCenterX = handleBox.x + handleBox.width / 2
  const handleCenterY = handleBox.y + handleBox.height / 2
  await page.mouse.move(handleCenterX, handleCenterY)
  await page.mouse.down()
  await page.mouse.move(handleCenterX + dragDistancePixels, handleCenterY, { steps: 6 })
  await expect(pictureWidget.locator('.papeliz-md-view-picture-resize-width')).toHaveText(`${expectedDraggedWidthPixels} px`)
  await page.mouse.up()
}

test('a vault picture drags smaller, shows its width in MD Code, and undoes in one step', async ({ page }) => {
  const { refusedOutsideRequestUrls } = await openResizeTestNote(page)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())

  const vaultPictureWidget = await findShownPictureWidget(page, 'Blue box')
  const vaultPictureHandle = vaultPictureWidget.getByRole('slider', { name: 'Resize picture: Blue box' })
  await expect(vaultPictureHandle).toHaveAttribute('aria-valuetext', '400 pixels wide')
  // The handle shows only on hover or focus.
  expect(await vaultPictureHandle.evaluate((handleElement) => getComputedStyle(handleElement).opacity)).toBe('0')

  await dragPictureHandle(page, vaultPictureWidget, -150, 250)
  await expect.poll(() => readShownPictureWidth(vaultPictureWidget)).toBe(250)
  await expect(vaultPictureHandle).toHaveAttribute('aria-valuetext', '250 pixels wide')
  // The press never moved the cursor into the picture's Markdown: the picture still shows.
  await expect(page.locator(editableMdView)).not.toContainText('![Blue box')

  await setNoteViewMode(page, 'md-code')
  await expect(page.locator('.cm-content').first()).toContainText('![Blue box|250](Pictures/blue.png)')
  await setNoteViewMode(page, 'md-view')

  // Undo puts the old width back in one step.
  await page.locator(`${editableMdView} .cm-line`, { hasText: 'The end.' }).click()
  await page.keyboard.press('ControlOrMeta+z')
  await setNoteViewMode(page, 'md-code')
  await expect(page.locator('.cm-content').first()).toContainText('![Blue box](Pictures/blue.png)')
  await expect(page.locator('.cm-content').first()).not.toContainText('|250')
  expect(refusedOutsideRequestUrls).toEqual([])
})

test('an embed steps smaller and larger with the keys, within the note’s column', async ({ page }) => {
  await openResizeTestNote(page)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())

  const embedPictureWidget = await findShownPictureWidget(page, 'blue.png')
  const embedPictureHandle = embedPictureWidget.getByRole('slider', { name: 'Resize picture: blue.png' })
  const noteColumnWidthPixels = Number(await embedPictureHandle.getAttribute('aria-valuemax'))
  expect(noteColumnWidthPixels).toBeGreaterThan(400)
  const pictureWidthStepPixels = Math.round(noteColumnWidthPixels / 10)

  // Tab from the note's text reaches each picture's handle in turn, which shows on focus.
  await page.locator(`${editableMdView} .cm-line`, { hasText: 'The end.' }).click()
  await page.keyboard.press('Tab')
  await expect(page.locator(editableMdView).getByRole('slider', { name: 'Resize picture: Blue box' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(embedPictureHandle).toBeFocused()
  await expect.poll(() => embedPictureHandle.evaluate((handleElement) => getComputedStyle(handleElement).opacity)).toBe('1')
  await page.keyboard.press('ArrowLeft')
  await expect.poll(() => readShownPictureWidth(embedPictureWidget)).toBe(400 - pictureWidthStepPixels)
  // The handle keeps the keyboard's focus as the picture changes, so the next press steps again.
  await expect(embedPictureHandle).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect.poll(() => readShownPictureWidth(embedPictureWidget)).toBe(400 - 2 * pictureWidthStepPixels)
  await expect(embedPictureHandle).toHaveAttribute('aria-valuetext', `${400 - 2 * pictureWidthStepPixels} pixels wide`)
  await page.keyboard.press('End')
  await expect.poll(() => readShownPictureWidth(embedPictureWidget)).toBe(noteColumnWidthPixels)
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => readShownPictureWidth(embedPictureWidget)).toBe(noteColumnWidthPixels)
  await page.keyboard.press('Home')
  await expect.poll(() => readShownPictureWidth(embedPictureWidget)).toBe(48)
  // On a picture this small the handle sits outside its corner, so a click on the picture still
  // reaches it and shows its Markdown.
  await expect(embedPictureHandle).toHaveAttribute('data-papeliz-picture-resize-handle-outside', 'true')
  await embedPictureWidget.locator('img.papeliz-md-view-picture').click()
  await expect(page.locator(editableMdView)).toContainText('![[blue.png|48]]')

  await setNoteViewMode(page, 'md-code')
  await expect(page.locator('.cm-content').first()).toContainText('![[blue.png|48]]')
})

test('a web picture drags larger, a width typed in MD Code resizes it, and the read view shows it with no handle', async ({ page }) => {
  const { refusedOutsideRequestUrls } = await openResizeTestNote(page)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())

  const webPictureWidget = await findShownPictureWidget(page, 'Web chart')
  await dragPictureHandle(page, webPictureWidget, 100, 400)
  await expect.poll(() => readShownPictureWidth(webPictureWidget)).toBe(400)

  // A width typed in MD Code resizes the picture in MD View; taking it away gives back its own size.
  await setNoteViewMode(page, 'md-code')
  const webPictureMarkdownLine = page.locator('.cm-content .cm-line', { hasText: `![Web chart|400](${webPictureUrl})` })
  await webPictureMarkdownLine.click()
  await page.keyboard.press('Home')
  for (let movedCharacterCount = 0; movedCharacterCount < '![Web chart'.length; movedCharacterCount += 1) await page.keyboard.press('ArrowRight')
  for (let selectedCharacterCount = 0; selectedCharacterCount < '|400'.length; selectedCharacterCount += 1) await page.keyboard.press('Shift+ArrowRight')
  await page.keyboard.type('|120')
  await expect(page.locator('.cm-content').first()).toContainText(`![Web chart|120](${webPictureUrl})`)
  await setNoteViewMode(page, 'md-view')
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await expect.poll(async () => readShownPictureWidth(await findShownPictureWidget(page, 'Web chart'))).toBe(120)

  // The read view shows the saved width and offers no handle.
  await page.evaluate(async () => {
    const { usePapelizWorkspaceStore } = await import('/src/modules/workspace/papeliz-workspace-store.ts')
    usePapelizWorkspaceStore.getState().setWholeVaultEditingLocked(true)
  })
  const lockedMdView = page.locator('article.papeliz-md-view-article[aria-label="MD View"]')
  const lockedWebPicture = lockedMdView.locator('img[alt="Web chart"]')
  await expect(lockedWebPicture).toHaveAttribute('width', '120')
  await expect.poll(() => lockedWebPicture.evaluate((pictureElement: HTMLImageElement) => pictureElement.offsetWidth)).toBe(120)
  await expect(lockedMdView.getByRole('slider')).toHaveCount(0)
  expect(refusedOutsideRequestUrls).toEqual([])
})
