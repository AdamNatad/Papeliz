import { expect, test, type Page } from '@playwright/test'
import { papelizMermaidDiagramTypeSamples, type PapelizMermaidDiagramTypeSample } from './papeliz-mermaid-diagram-type-samples'

// Every diagram type Mermaid 12 offers, drawn the way MD View and the locked page draw them: it
// draws, in the note's typeface, with every label readable against what is behind it (3:1 at least)
// in both themes; a wide one keeps two thirds of its size inside a phone-width column; and each one
// becomes a picture for Word.

// Samples a browser engine can't draw, with Mermaid's message. Mermaid 12.2.0 measures an event
// modeling diagram's labels before they are on the page, which WebKit (Safari) refuses. It is
// Mermaid's to fix; the check fails once the sample draws, so the entry can then go.
const papelizMermaidDiagramBrowserDrawFailures = [
  { browserName: 'webkit', mermaidDiagramSampleLabel: 'event modeling', mermaidDiagramErrorMessage: 'svg element not in render tree' },
] as const

function findPapelizMermaidDiagramBrowserDrawFailure(browserName: string, mermaidDiagramSampleLabel: string) {
  return papelizMermaidDiagramBrowserDrawFailures.find(
    (browserDrawFailure) => browserDrawFailure.browserName === browserName && browserDrawFailure.mermaidDiagramSampleLabel === mermaidDiagramSampleLabel,
  )
}

interface PapelizMermaidDiagramSampleReport {
  mermaidDiagramSampleLabel: string
  drawnMermaidDiagramTypeName: string | null
  mermaidDiagramDrawErrorMessage: string | null
  // "Label: ink on ground (ratio)" for each label under 3:1.
  lowContrastLabelDescriptions: string[]
  // "Label: typeface" for each label not in the note's typeface.
  otherTypefaceLabelDescriptions: string[]
  // The drawing's shown width as a share of its own, and whether its box stays inside the column.
  mermaidDiagramShownScale: number | null
  isMermaidDiagramInsideColumn: boolean
}

interface PapelizMermaidDiagramDrawCheckOptions {
  mermaidDiagramSamples: readonly PapelizMermaidDiagramTypeSample[]
  shownPapelizTheme: 'light' | 'dark'
  noteColumnPixelWidth: number
}

// Runs in the page: draws each sample in a note column through MD View's own Mermaid module and
// reads what it drew. Everything it uses is defined inside it, as `page.evaluate` requires.
async function drawPapelizMermaidDiagramSamplesInPage({
  mermaidDiagramSamples,
  shownPapelizTheme,
  noteColumnPixelWidth,
}: PapelizMermaidDiagramDrawCheckOptions): Promise<PapelizMermaidDiagramSampleReport[]> {
  const { mountPapelizMermaidDiagram, unmountPapelizMermaidDiagram } = await import('/src/modules/md-view/papeliz-md-view-mermaid-diagrams.ts')
  await document.fonts.ready
  // The page opened in this theme (the saved choice); a different one means the check is wrong.
  if (document.documentElement.dataset['papelizTheme'] !== shownPapelizTheme) throw new Error(`The page shows the ${document.documentElement.dataset['papelizTheme'] ?? 'device'} theme, not ${shownPapelizTheme}.`)
  const rootStyle = getComputedStyle(document.documentElement)
  const readFirstFontFamily = (fontFamilyList: string) => (fontFamilyList.split(',')[0] ?? '').trim().replace(/^["']|["']$/g, '').toLowerCase()
  const noteFirstFontFamily = readFirstFontFamily(rootStyle.getPropertyValue('--papeliz-note-font-family'))

  const colorCanvasContext = document.createElement('canvas').getContext('2d')
  // [red, green, blue, alpha] for a CSS color, or null for none.
  const parseCssColor = (cssColorText: string): [number, number, number, number] | null => {
    if (colorCanvasContext === null || cssColorText === '' || cssColorText === 'none' || cssColorText === 'transparent') return null
    colorCanvasContext.fillStyle = '#000000'
    colorCanvasContext.fillStyle = cssColorText
    const normalizedColor = String(colorCanvasContext.fillStyle)
    if (normalizedColor.startsWith('#')) {
      const colorNumber = Number.parseInt(normalizedColor.slice(1), 16)
      return [(colorNumber >> 16) & 255, (colorNumber >> 8) & 255, colorNumber & 255, 1]
    }
    const [red = 0, green = 0, blue = 0, alpha = 1] = (normalizedColor.match(/[\d.]+/g) ?? []).map(Number)
    return [red, green, blue, alpha]
  }
  const readOpacity = (opacityText: string) => (Number.isNaN(Number.parseFloat(opacityText)) ? 1 : Number.parseFloat(opacityText))
  const blendColors = (topColor: [number, number, number, number], bottomColor: [number, number, number, number]): [number, number, number, number] => [
    topColor[0] * topColor[3] + bottomColor[0] * (1 - topColor[3]),
    topColor[1] * topColor[3] + bottomColor[1] * (1 - topColor[3]),
    topColor[2] * topColor[3] + bottomColor[2] * (1 - topColor[3]),
    1,
  ]
  const readRelativeLuminance = ([red, green, blue]: [number, number, number, number]) => {
    const toLinear = (colorChannel: number) => (colorChannel / 255 <= 0.03928 ? colorChannel / 255 / 12.92 : ((colorChannel / 255 + 0.055) / 1.055) ** 2.4)
    return 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue)
  }
  const readContrastRatio = (firstColor: [number, number, number, number], secondColor: [number, number, number, number]) => {
    const [lighterLuminance, darkerLuminance] = [readRelativeLuminance(firstColor), readRelativeLuminance(secondColor)].sort((first, second) => second - first)
    return ((lighterLuminance ?? 0) + 0.05) / ((darkerLuminance ?? 0) + 0.05)
  }
  const describeColor = (cssColor: [number, number, number, number]) => `rgb(${cssColor.slice(0, 3).map(Math.round).join(', ')})`
  const noteGroundColor = parseCssColor(rootStyle.getPropertyValue('--color-papeliz-surface').trim()) ?? [255, 255, 255, 1]

  // The color painted behind a point of a label: the filled shapes under it, over the note's ground.
  const readGroundColorAt = (pointX: number, pointY: number, labelElement: Element, diagramSvg: SVGSVGElement) => {
    const paintedLayerColors: Array<[number, number, number, number]> = []
    for (const stackedElement of document.elementsFromPoint(pointX, pointY)) {
      if (stackedElement === labelElement || labelElement.contains(stackedElement)) continue
      if (!diagramSvg.contains(stackedElement)) break
      if (['text', 'tspan', 'svg', 'g', 'foreignobject', 'line', 'polyline'].includes(stackedElement.tagName.toLowerCase())) continue
      const stackedStyle = getComputedStyle(stackedElement)
      const layerColor = parseCssColor(stackedElement instanceof SVGElement ? stackedStyle.fill : stackedStyle.backgroundColor)
      if (layerColor === null) continue
      layerColor[3] *= (stackedElement instanceof SVGElement ? readOpacity(stackedStyle.fillOpacity) : 1) * readOpacity(stackedStyle.opacity)
      if (layerColor[3] <= 0.02) continue
      paintedLayerColors.push(layerColor)
      if (layerColor[3] >= 0.99) break
    }
    return paintedLayerColors.reverse().reduce((groundBelow, layerColor) => blendColors(layerColor, groundBelow), noteGroundColor)
  }

  const noteColumnElement = document.createElement('div')
  noteColumnElement.className = 'papeliz-md-view-article'
  noteColumnElement.style.cssText = `position: fixed; inset: 0 auto 0 0; z-index: 2147483647; box-sizing: border-box; width: ${noteColumnPixelWidth}px; padding: 0 16px; overflow: auto; background: var(--color-papeliz-surface); color: var(--color-papeliz-ink)`
  document.body.append(noteColumnElement)

  const sampleReports: PapelizMermaidDiagramSampleReport[] = []
  for (const mermaidDiagramSample of mermaidDiagramSamples) {
    const diagramElement = document.createElement('div')
    diagramElement.className = 'papeliz-mermaid-diagram'
    noteColumnElement.replaceChildren(diagramElement)
    mountPapelizMermaidDiagram(diagramElement, mermaidDiagramSample.mermaidDiagramSource)
    const drawWaitStart = performance.now()
    while (performance.now() - drawWaitStart < 30_000 && (diagramElement.querySelector('.papeliz-mermaid-diagram-placeholder') !== null || diagramElement.childElementCount === 0)) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 50))
    }
    const diagramSvg = diagramElement.querySelector<SVGSVGElement>(':scope > svg')
    const sampleReport: PapelizMermaidDiagramSampleReport = {
      mermaidDiagramSampleLabel: mermaidDiagramSample.mermaidDiagramSampleLabel,
      drawnMermaidDiagramTypeName: diagramSvg?.getAttribute('aria-roledescription') ?? null,
      mermaidDiagramDrawErrorMessage: diagramSvg === null ? (diagramElement.textContent ?? 'nothing drawn') : null,
      lowContrastLabelDescriptions: [],
      otherTypefaceLabelDescriptions: [],
      mermaidDiagramShownScale: null,
      isMermaidDiagramInsideColumn: diagramElement.getBoundingClientRect().right <= noteColumnElement.getBoundingClientRect().right + 1,
    }
    if (diagramSvg !== null) {
      const drawingPixelWidth = Number.parseFloat(diagramSvg.style.maxWidth)
      if (drawingPixelWidth > 0) sampleReport.mermaidDiagramShownScale = diagramSvg.getBoundingClientRect().width / drawingPixelWidth
      const labelElements = [...diagramSvg.querySelectorAll('text, tspan, foreignObject span, foreignObject p, foreignObject div')].filter((labelElement) =>
        ['text', 'tspan'].includes(labelElement.tagName.toLowerCase()) ? labelElement.querySelector('tspan') === null : labelElement.childElementCount === 0,
      )
      for (const labelElement of labelElements) {
        const labelText = (labelElement.textContent ?? '').trim()
        if (labelText.length === 0) continue
        const labelStyle = getComputedStyle(labelElement)
        const labelFirstFontFamily = readFirstFontFamily(labelStyle.fontFamily)
        if (labelFirstFontFamily !== noteFirstFontFamily) sampleReport.otherTypefaceLabelDescriptions.push(`${labelText.slice(0, 30)}: ${labelFirstFontFamily}`)
        const isSvgLabel = labelElement instanceof SVGElement
        const labelInkColor = parseCssColor(isSvgLabel ? labelStyle.fill : labelStyle.color)
        if (labelInkColor === null) continue
        labelInkColor[3] *= (isSvgLabel ? readOpacity(labelStyle.fillOpacity) : 1) * readOpacity(labelStyle.opacity)
        let labelGroundColor: [number, number, number, number]
        const labelTextElement = labelElement.closest('text') ?? labelElement
        if (labelTextElement.classList.contains('sequenceNumber')) {
          // A step number sits on a circle drawn as a line marker, which no hit test sees.
          const stepNumberCircle = diagramSvg.querySelector('marker[id$="sequencenumber"] circle')
          labelGroundColor = (stepNumberCircle === null ? null : parseCssColor(getComputedStyle(stepNumberCircle).fill)) ?? noteGroundColor
        } else {
          labelElement.scrollIntoView({ block: 'center', inline: 'center' })
          const labelRect = labelElement.getBoundingClientRect()
          if (labelRect.width === 0) continue
          labelGroundColor = readGroundColorAt(labelRect.left + labelRect.width / 2, labelRect.top + labelRect.height / 2, labelTextElement, diagramSvg)
        }
        const labelContrastRatio = readContrastRatio(blendColors(labelInkColor, labelGroundColor), labelGroundColor)
        // C4 draws an external system in its own gray, with white labels, in every theme.
        const isC4ExternalSystemLabel = sampleReport.drawnMermaidDiagramTypeName === 'c4' && describeColor(labelGroundColor) === 'rgb(153, 153, 153)'
        if (labelContrastRatio < 3 && !isC4ExternalSystemLabel) {
          sampleReport.lowContrastLabelDescriptions.push(`${labelText.slice(0, 30)}: ${describeColor(labelInkColor)} on ${describeColor(labelGroundColor)} (${labelContrastRatio.toFixed(2)})`)
        }
      }
    }
    unmountPapelizMermaidDiagram(diagramElement)
    sampleReports.push(sampleReport)
  }
  noteColumnElement.remove()
  return sampleReports
}

// Opens the app in a theme the way a person's saved choice does (public/papeliz-theme-boot.js reads it
// before the first paint), so nothing switches it back while the diagrams are drawn.
async function openPapelizInTheme(page: Page, shownPapelizTheme: 'light' | 'dark') {
  await page.addInitScript((savedPapelizTheme) => window.localStorage.setItem('papelizThemePreference', savedPapelizTheme), shownPapelizTheme)
  await page.goto('/')
  await expect(page.getByRole('button', { name: /^New Vault/ })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-papeliz-theme', shownPapelizTheme)
}

async function drawPapelizMermaidDiagramSamples(page: Page, shownPapelizTheme: 'light' | 'dark', noteColumnPixelWidth: number): Promise<PapelizMermaidDiagramSampleReport[]> {
  await openPapelizInTheme(page, shownPapelizTheme)
  return page.evaluate(drawPapelizMermaidDiagramSamplesInPage, { mermaidDiagramSamples: papelizMermaidDiagramTypeSamples, shownPapelizTheme, noteColumnPixelWidth })
}

for (const shownPapelizTheme of ['light', 'dark'] as const) {
  test(`every diagram type draws in the note's typeface and reads in the ${shownPapelizTheme} theme`, async ({ page, browserName }) => {
    test.setTimeout(240_000)
    const sampleReports = await drawPapelizMermaidDiagramSamples(page, shownPapelizTheme, 760)
    for (const [sampleIndex, sampleReport] of sampleReports.entries()) {
      const mermaidDiagramSample = papelizMermaidDiagramTypeSamples[sampleIndex]!
      const browserDrawFailure = findPapelizMermaidDiagramBrowserDrawFailure(browserName, sampleReport.mermaidDiagramSampleLabel)
      if (browserDrawFailure !== undefined) {
        expect.soft(sampleReport.mermaidDiagramDrawErrorMessage, `${sampleReport.mermaidDiagramSampleLabel} still can't be drawn here`).toContain(browserDrawFailure.mermaidDiagramErrorMessage)
        continue
      }
      expect.soft(sampleReport.mermaidDiagramDrawErrorMessage, `${sampleReport.mermaidDiagramSampleLabel} draws`).toBeNull()
      expect.soft(sampleReport.drawnMermaidDiagramTypeName, `${sampleReport.mermaidDiagramSampleLabel} is drawn as its type`).toBe(mermaidDiagramSample.mermaidDiagramTypeName)
      expect.soft(sampleReport.lowContrastLabelDescriptions, `${sampleReport.mermaidDiagramSampleLabel}: labels under 3:1`).toEqual([])
      expect.soft(sampleReport.otherTypefaceLabelDescriptions, `${sampleReport.mermaidDiagramSampleLabel}: labels in another typeface`).toEqual([])
    }
  })
}

test('a wide diagram keeps two thirds of its size and scrolls inside a phone-width column', async ({ page }) => {
  test.setTimeout(240_000)
  const sampleReports = await drawPapelizMermaidDiagramSamples(page, 'light', 375)
  for (const sampleReport of sampleReports) {
    expect.soft(sampleReport.isMermaidDiagramInsideColumn, `${sampleReport.mermaidDiagramSampleLabel} stays inside the column`).toBe(true)
    // Rounding the smallest width to whole pixels can take a hair off two thirds.
    expect.soft(sampleReport.mermaidDiagramShownScale ?? 1, `${sampleReport.mermaidDiagramSampleLabel} keeps two thirds of its size`).toBeGreaterThanOrEqual(0.66)
  }
})

test('every diagram type becomes a picture for Word', async ({ page, browserName }) => {
  test.setTimeout(240_000)
  await openPapelizInTheme(page, 'light')
  const printPictureErrorMessages = await page.evaluate(async (mermaidDiagramSamples) => {
    const { drawPapelizMermaidDiagramPngForPrint } = await import('/src/modules/md-view/papeliz-md-view-mermaid-diagrams.ts')
    const noteFontFamily = getComputedStyle(document.documentElement).getPropertyValue('--papeliz-note-font-family').trim() || 'sans-serif'
    const pictureErrorMessages: string[] = []
    for (const mermaidDiagramSample of mermaidDiagramSamples) {
      const printPngResult = await drawPapelizMermaidDiagramPngForPrint(mermaidDiagramSample.mermaidDiagramSource, {
        readPrintColor: () => null,
        printFontFamily: noteFontFamily,
        printFontFaceCss: '',
        pngPixelScale: 1,
      })
      if ('mermaidDiagramErrorMessage' in printPngResult) pictureErrorMessages.push(`${mermaidDiagramSample.mermaidDiagramSampleLabel}: ${printPngResult.mermaidDiagramErrorMessage}`)
      else if (printPngResult.mermaidDiagramPngBytes.length < 100) pictureErrorMessages.push(`${mermaidDiagramSample.mermaidDiagramSampleLabel}: an empty picture`)
    }
    return pictureErrorMessages
  }, papelizMermaidDiagramTypeSamples)
  const expectedPictureErrorMessages = papelizMermaidDiagramBrowserDrawFailures
    .filter((browserDrawFailure) => browserDrawFailure.browserName === browserName)
    .map((browserDrawFailure) => `${browserDrawFailure.mermaidDiagramSampleLabel}: ${browserDrawFailure.mermaidDiagramErrorMessage}`)
  expect(printPictureErrorMessages).toEqual(expectedPictureErrorMessages)
})

// A label with an event handler, as the Mermaid check vault's settings note has it.
const mermaidDiagramSourceWithLabelHandler = 'flowchart LR\n  A["Ampersand &amp; quotes #quot;ok#quot;"] --> B["<b>bold?</b> <img src=x onerror=alert(1)>"]\n  B --> C["Ünïcödé ✓ 日本語"]'

test('a label’s event handler reaches no HTML reader, so the security policy has nothing to block', async ({ page, browserName }) => {
  // The dev server sends no security policy. This one blocks handlers only, and reports each one the
  // page reads, even in a scratch document where nothing runs (Chromium does).
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue()
    const documentResponse = await route.fetch()
    await route.fulfill({ response: documentResponse, headers: { ...documentResponse.headers(), 'content-security-policy': "script-src-attr 'none'" } })
  })
  await openPapelizInTheme(page, 'light')
  const labelHandlerReport = await page.evaluate(async (mermaidDiagramSource) => {
    const reportedPolicyViolations: string[] = []
    document.addEventListener('securitypolicyviolation', (violationEvent) => reportedPolicyViolations.push(`${violationEvent.violatedDirective} at ${violationEvent.sourceFile}:${violationEvent.lineNumber}`))
    const waitForPolicyReports = () => new Promise((resolveWait) => setTimeout(resolveWait, 300))
    // The policy reports here: a handler read in a scratch document.
    new DOMParser().parseFromString('<img src=x onerror=alert(1)>', 'text/html')
    await waitForPolicyReports()
    const controlViolationCount = reportedPolicyViolations.splice(0).length

    const { mountPapelizMermaidDiagram, unmountPapelizMermaidDiagram, drawPapelizMermaidDiagramSvgForExport, drawPapelizMermaidDiagramForPrint, drawPapelizMermaidDiagramPngForPrint } = await import(
      '/src/modules/md-view/papeliz-md-view-mermaid-diagrams.ts'
    )
    const diagramElement = document.createElement('div')
    document.body.append(diagramElement)
    await new Promise<void>((resolveDrawn) => mountPapelizMermaidDiagram(diagramElement, mermaidDiagramSource, resolveDrawn))
    const shownLabelElement = Array.from(diagramElement.querySelectorAll('foreignObject')).find((labelObject) => labelObject.textContent?.includes('bold?'))
    const shownLabelHtml = shownLabelElement?.querySelector('span, div')?.innerHTML ?? ''
    unmountPapelizMermaidDiagram(diagramElement)
    diagramElement.remove()
    const exportDrawResult = await drawPapelizMermaidDiagramSvgForExport(mermaidDiagramSource, 'dark', () => null)
    const printDrawResult = await drawPapelizMermaidDiagramForPrint(mermaidDiagramSource, { readPrintColor: () => null, printFontFamily: 'sans-serif' })
    const printPngResult = await drawPapelizMermaidDiagramPngForPrint(mermaidDiagramSource, { readPrintColor: () => null, printFontFamily: 'sans-serif', printFontFaceCss: '', pngPixelScale: 1 })
    await waitForPolicyReports()
    return {
      controlViolationCount,
      reportedPolicyViolations,
      shownLabelHtml,
      drawErrorMessages: [exportDrawResult, printDrawResult, printPngResult].flatMap((drawResult) => ('mermaidDiagramErrorMessage' in drawResult ? [drawResult.mermaidDiagramErrorMessage] : [])),
      handlerElementCount: document.querySelectorAll('[onerror], [onload], [onclick]').length,
    }
  }, mermaidDiagramSourceWithLabelHandler)
  if (browserName === 'chromium') expect(labelHandlerReport.controlViolationCount, 'the policy reports a handler read in a scratch document').toBe(1)
  expect(labelHandlerReport.reportedPolicyViolations).toEqual([])
  expect(labelHandlerReport.drawErrorMessages).toEqual([])
  expect(labelHandlerReport.handlerElementCount).toBe(0)
  // Drawn as strict mode draws it: the bold text and the picture, with no handler.
  expect(labelHandlerReport.shownLabelHtml).toContain('<b>bold?</b>')
  expect(labelHandlerReport.shownLabelHtml).toMatch(/<img src="x"[^>]*>/)
  expect(labelHandlerReport.shownLabelHtml).not.toContain('onerror')
})
