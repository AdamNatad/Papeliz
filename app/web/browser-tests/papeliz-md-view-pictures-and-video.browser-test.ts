import { expect, test, type Page } from '@playwright/test'

// MD View's pictures and videos in a real browser, in both views: a vault picture inside a web link
// (as P1-Workflow's README starts), a web picture, an `![[embed]]` with a width, a vault video that
// waits for its controls, a missing picture, and a YouTube link that reaches YouTube only once play is
// pressed. Every request off this computer is answered here or refused, so nothing reaches the web.

const youTubeTestVideoId = 'aBc_12-xYz9'
const pictureInLinkHref = 'https://papeliz.com/templates/p1-workflow/'
const webPictureUrl = 'https://pictures.example.com/chart.png'
// One blue pixel, a PNG with no metadata.
const onePixelPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

const mediaTestNoteText = [
  `[![Dot in a link](Pictures/dot.png)](${pictureInLinkHref})`,
  '',
  `![Web chart](${webPictureUrl})`,
  '',
  '![[dot.png|40]]',
  '',
  '![[clip.webm]]',
  '',
  `[Garden tour](https://www.youtube.com/watch?v=${youTubeTestVideoId}&t=30)`,
  '',
  '![Gone](Pictures/gone.png)',
  '',
  'The end.',
].join('\n')

interface MediaTestNetwork {
  youTubeRequestUrls: string[]
  refusedOutsideRequestUrls: string[]
}

// Answers the web picture and YouTube's player with stand-ins, and refuses everything else outside.
async function answerMediaTestNetwork(page: Page): Promise<MediaTestNetwork> {
  const mediaTestNetwork: MediaTestNetwork = { youTubeRequestUrls: [], refusedOutsideRequestUrls: [] }
  await page.context().route('**/*', (route) => {
    const requestUrl = new URL(route.request().url())
    if (requestUrl.hostname === '127.0.0.1' || requestUrl.hostname === 'localhost') return route.continue()
    if (/(^|\.)(youtube|youtube-nocookie|ytimg|googlevideo)\.com$|^youtu\.be$/.test(requestUrl.hostname)) {
      mediaTestNetwork.youTubeRequestUrls.push(requestUrl.href)
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Player stand-in</title><p>Player stand-in</p>' })
    }
    if (requestUrl.href === webPictureUrl) return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(onePixelPngBase64, 'base64') })
    mediaTestNetwork.refusedOutsideRequestUrls.push(requestUrl.href)
    return route.abort()
  })
  return mediaTestNetwork
}

// The sample vault with a picture, a short recorded video and the media note, opened in MD View.
async function openMediaTestNote(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try Sample' }).first().click()
  await expect(page.locator('.cm-content').first()).toBeVisible()
  await page.evaluate(
    async ({ seededPngBase64, seededNoteText }) => {
      const { usePapelizWorkspaceStore } = await import('/src/modules/workspace/papeliz-workspace-store.ts')
      const workspaceState = usePapelizWorkspaceStore.getState()
      const sampleVaultAdapter = workspaceState.openVault!.papelizVaultAdapter
      const pngBytes = Uint8Array.from(atob(seededPngBase64), (binaryCharacter) => binaryCharacter.charCodeAt(0))
      // A browser vault's files carry no type; MD View types them by their extension.
      await sampleVaultAdapter.createVaultAttachmentFile('Pictures/dot.png', new Blob([pngBytes]))

      // A quarter second of a drawn canvas, recorded as WebM: a real video file the browser can play.
      const videoCanvas = Object.assign(document.createElement('canvas'), { width: 64, height: 36 })
      const videoCanvasContext = videoCanvas.getContext('2d')!
      const videoRecorder = new MediaRecorder(videoCanvas.captureStream(24), { mimeType: 'video/webm' })
      const recordedVideoChunks: Blob[] = []
      videoRecorder.ondataavailable = (recordedEvent) => recordedVideoChunks.push(recordedEvent.data)
      const videoRecorderStopped = new Promise((resolveStopped) => (videoRecorder.onstop = resolveStopped))
      videoRecorder.start()
      for (let drawnFrameIndex = 0; drawnFrameIndex < 6; drawnFrameIndex += 1) {
        videoCanvasContext.fillStyle = drawnFrameIndex % 2 === 0 ? '#0064d4' : '#ffffff'
        videoCanvasContext.fillRect(0, 0, 64, 36)
        await new Promise((resolveFrame) => setTimeout(resolveFrame, 50))
      }
      videoRecorder.stop()
      await videoRecorderStopped
      await sampleVaultAdapter.createVaultAttachmentFile('clip.webm', new Blob(recordedVideoChunks))

      await workspaceState.createVaultNoteFromAssistant('Media test.md', seededNoteText)
      await usePapelizWorkspaceStore.getState().openVaultNote('Media test.md')
      usePapelizWorkspaceStore.getState().setNoteViewMode('md-view')
      // Window.open is recorded rather than opened: Ctrl+click on a linked picture calls it.
      const openedWindowUrls: string[] = []
      Object.assign(window, { papelizTestOpenedWindowUrls: openedWindowUrls })
      window.open = (openedUrl?: string | URL) => {
        openedWindowUrls.push(String(openedUrl))
        return null
      }
    },
    { seededPngBase64: onePixelPngBase64, seededNoteText: mediaTestNoteText },
  )
}

// Whether a picture has loaded, and from where.
async function readShownPicture(page: Page, pictureSelector: string) {
  const shownPicture = page.locator(pictureSelector).first()
  await expect(shownPicture).toBeVisible()
  await expect.poll(() => shownPicture.evaluate((pictureElement: HTMLImageElement) => pictureElement.complete && pictureElement.naturalWidth > 0)).toBe(true)
  return shownPicture.evaluate((pictureElement: HTMLImageElement) => ({ pictureSource: pictureElement.currentSrc, pictureWidthAttribute: pictureElement.getAttribute('width') }))
}

async function expectYouTubeLoadsOnlyAfterPlay(page: Page, mediaTestNetwork: MediaTestNetwork, mdViewScope: string): Promise<void> {
  const youTubePlayButton = page.locator(mdViewScope).getByRole('button', { name: 'Play “Garden tour” from YouTube' })
  await expect(youTubePlayButton).toBeVisible()
  expect(await page.locator(`${mdViewScope} iframe`).count()).toBe(0)
  expect(mediaTestNetwork.youTubeRequestUrls).toEqual([])

  await youTubePlayButton.click()
  const youTubePlayer = page.locator(`${mdViewScope} iframe.papeliz-md-view-youtube-player`)
  await expect(youTubePlayer).toBeVisible()
  expect(await youTubePlayer.getAttribute('src')).toBe(`https://www.youtube-nocookie.com/embed/${youTubeTestVideoId}?autoplay=1`)
  expect(await youTubePlayer.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin')
  expect(await youTubePlayer.getAttribute('allow')).toBe('autoplay; encrypted-media; fullscreen; picture-in-picture')
  expect(await youTubePlayer.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin')
  await expect.poll(() => mediaTestNetwork.youTubeRequestUrls).toEqual([`https://www.youtube-nocookie.com/embed/${youTubeTestVideoId}?autoplay=1`])
}

test('the editable MD View shows vault and web pictures, a picture inside a link, a video, and YouTube only after play', async ({ page }) => {
  const mediaTestNetwork = await answerMediaTestNetwork(page)
  await openMediaTestNote(page)
  // Off the cursor's lines, every picture shows.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  const editableMdView = '.papeliz-md-view .cm-content'

  const linkedPicture = await readShownPicture(page, `${editableMdView} .cm-papeliz-md-view-media[data-papeliz-link-href="${pictureInLinkHref}"] img.papeliz-md-view-picture`)
  expect(linkedPicture.pictureSource).toMatch(/^blob:/)
  expect((await readShownPicture(page, `${editableMdView} img[alt="Web chart"]`)).pictureSource).toBe(webPictureUrl)
  const embeddedPicture = await readShownPicture(page, `${editableMdView} img[alt="dot.png"]`)
  expect(embeddedPicture.pictureSource).toMatch(/^blob:/)
  expect(embeddedPicture.pictureWidthAttribute).toBe('40')
  await expect(page.locator(editableMdView).getByText('Picture not found: Pictures/gone.png')).toBeVisible()

  // The video learns its length and waits for its controls.
  const vaultVideo = page.locator(`${editableMdView} video.papeliz-md-view-video`)
  await expect(vaultVideo).toBeVisible()
  await expect.poll(() => vaultVideo.evaluate((videoElement: HTMLVideoElement) => videoElement.readyState >= HTMLMediaElement.HAVE_METADATA)).toBe(true)
  expect(await vaultVideo.evaluate((videoElement: HTMLVideoElement) => ({ isVideoPaused: videoElement.paused, hasAutoplay: videoElement.autoplay, hasControls: videoElement.controls }))).toEqual({
    isVideoPaused: true,
    hasAutoplay: false,
    hasControls: true,
  })

  // Each drawn picture or video is one box on its line: the editor's cursor markers beside it add no
  // blank line above or below it, so its line is no taller than it, or than a line of text.
  const textLineHeight = await page.locator(`${editableMdView} .cm-line`, { hasText: 'The end.' }).evaluate((textLineElement) => textLineElement.getBoundingClientRect().height)
  const mediaLineHeightGaps = await page.locator(`${editableMdView} .cm-line:has(.cm-papeliz-md-view-media)`).evaluateAll(
    (mediaLineElements, shownTextLineHeight) =>
      mediaLineElements.map(
        (mediaLineElement) =>
          mediaLineElement.getBoundingClientRect().height - Math.max(mediaLineElement.querySelector('.cm-papeliz-md-view-media')!.getBoundingClientRect().height, shownTextLineHeight),
      ),
    textLineHeight,
  )
  expect(mediaLineHeightGaps.length).toBeGreaterThanOrEqual(5)
  for (const mediaLineHeightGap of mediaLineHeightGaps) expect(mediaLineHeightGap).toBeLessThan(2)

  // Ctrl+click on the linked picture opens the link; a plain click shows its Markdown to edit.
  const linkedPictureElement = page.locator(`${editableMdView} .cm-papeliz-md-view-media[data-papeliz-link-href="${pictureInLinkHref}"] img`)
  await linkedPictureElement.click({ modifiers: ['ControlOrMeta'] })
  expect(await page.evaluate(() => (window as unknown as { papelizTestOpenedWindowUrls: string[] }).papelizTestOpenedWindowUrls)).toEqual([pictureInLinkHref])
  await linkedPictureElement.click()
  await expect(page.locator(editableMdView)).toContainText(`[![Dot in a link](Pictures/dot.png)](${pictureInLinkHref})`)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())

  await expectYouTubeLoadsOnlyAfterPlay(page, mediaTestNetwork, editableMdView)
  expect(mediaTestNetwork.refusedOutsideRequestUrls).toEqual([])
})

test('the locked MD View shows the picture inside its link, the video and YouTube only after play', async ({ page }) => {
  const mediaTestNetwork = await answerMediaTestNetwork(page)
  await openMediaTestNote(page)
  await page.evaluate(async () => {
    const { usePapelizWorkspaceStore } = await import('/src/modules/workspace/papeliz-workspace-store.ts')
    usePapelizWorkspaceStore.getState().setWholeVaultEditingLocked(true)
  })
  const lockedMdView = 'article.papeliz-md-view-article[aria-label="MD View"]'
  await expect(page.locator(lockedMdView)).toBeVisible()

  expect((await readShownPicture(page, `${lockedMdView} a[href="${pictureInLinkHref}"] img.papeliz-md-view-picture`)).pictureSource).toMatch(/^blob:/)
  expect((await readShownPicture(page, `${lockedMdView} img[alt="Web chart"]`)).pictureSource).toBe(webPictureUrl)
  expect((await readShownPicture(page, `${lockedMdView} img[alt="dot.png"]`)).pictureWidthAttribute).toBe('40')
  const vaultVideo = page.locator(`${lockedMdView} video.papeliz-md-view-video`)
  await expect.poll(() => vaultVideo.evaluate((videoElement: HTMLVideoElement) => videoElement.readyState >= HTMLMediaElement.HAVE_METADATA)).toBe(true)
  expect(await vaultVideo.evaluate((videoElement: HTMLVideoElement) => videoElement.paused)).toBe(true)
  await expect(page.locator(lockedMdView).getByText('Picture not found: Pictures/gone.png')).toBeVisible()

  await expectYouTubeLoadsOnlyAfterPlay(page, mediaTestNetwork, lockedMdView)
  expect(mediaTestNetwork.refusedOutsideRequestUrls).toEqual([])
})
