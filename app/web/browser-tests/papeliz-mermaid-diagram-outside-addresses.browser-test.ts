import { expect, test, type Page } from '@playwright/test'
import { papelizMermaidDiagramTypeSamples } from './papeliz-mermaid-diagram-type-samples'

// A diagram that names pictures and files from outside the vault (an image shape's web picture, a
// label's `<img>`, a sequence actor's icon, CSS `url()` and `@import` in styles and settings) draws
// in MD View, the HTML export and the print exports without one request leaving the app, and what it
// draws points at nothing outside. Ordinary diagrams draw exactly as Mermaid draws them.

interface PapelizMermaidOutsideAddressSample {
  mermaidDiagramSampleLabel: string
  mermaidDiagramSource: string
  // Text the drawing still shows (a label around a picture that is taken out).
  expectedDrawnTexts: string[]
  expectedPlaceholderPictureCount: number
  // A diagram that still asks for a file after the source rewrite isn't drawn.
  isRefused?: boolean
}

const papelizMermaidOutsideAddressSamples: readonly PapelizMermaidOutsideAddressSample[] = [
  {
    mermaidDiagramSampleLabel: 'an image shape with a web picture',
    mermaidDiagramSource: 'flowchart LR\n  A@{ img: "https://evil.example/flowchart.png", label: "Web picture", pos: "t", h: 60, constraint: "on" } --> B[Next]',
    expectedDrawnTexts: ['Web picture', 'Next'],
    expectedPlaceholderPictureCount: 1,
  },
  {
    mermaidDiagramSampleLabel: 'image shapes with protocol-relative, data: and vault pictures',
    mermaidDiagramSource:
      'flowchart LR\n  A@{ img: //evil.example/relative.png, label: "Relative" } --> B@{ img: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", label: "Data" } --> C@{ img: "attachments/cat.png", label: "Vault cat" }',
    expectedDrawnTexts: ['Relative', 'Data', 'Vault cat'],
    expectedPlaceholderPictureCount: 3,
  },
  {
    mermaidDiagramSampleLabel: 'an image shape over several lines',
    mermaidDiagramSource: 'flowchart TB\n  A@{\n    img: https://evil.example/block.png\n    label: Block picture\n    pos: b\n  }',
    expectedDrawnTexts: ['Block picture'],
    expectedPlaceholderPictureCount: 1,
  },
  {
    mermaidDiagramSampleLabel: 'labels holding pictures',
    mermaidDiagramSource:
      'flowchart LR\n  A["<img src=\'https://evil.example/label.png\'> picture"] --> B["<video poster=\'https://evil.example/poster.png\'></video> video"] --> C["<input type=image src=\'https://evil.example/input.png\'> input"]\n  C --> D["<svg><image href=\'https://evil.example/svg.png\'/></svg> svg"] --> E["<table background=\'https://evil.example/table.png\'><tr><td>table</td></tr></table>"]\n  E --> F["<picture><source srcset=\'https://evil.example/source.png\'><img src=\'x.png\'></picture> picture element"]',
    expectedDrawnTexts: ['picture', 'video', 'input', 'svg', 'table', 'picture element'],
    expectedPlaceholderPictureCount: 0,
  },
  {
    mermaidDiagramSampleLabel: 'labels styled with pictures',
    mermaidDiagramSource:
      'flowchart LR\n  A["<span style=\'background-image:url(https://evil.example/span.png)\'>span</span>"] --> B["<span style=\'background:&#117;rl(https://evil.example/entity.png)\'>entity</span>"] --> C["<b style=#quot;background:#117;rl(https://evil.example/mermaid-entity.png)#quot;>Mermaid entity</b>"]',
    expectedDrawnTexts: ['span', 'entity', 'Mermaid entity'],
    expectedPlaceholderPictureCount: 0,
  },
  // A flowchart's style statements can't hold a bracket at all; a state diagram's are read whole.
  {
    mermaidDiagramSampleLabel: 'class statements with pictures',
    mermaidDiagramSource:
      "stateDiagram-v2\n  [*] --> Classed\n  Classed --> Escaped\n  classDef pictured background-image:url('//evil.example/class.png'),color:#111\n  class Classed pictured\n  classDef escaped background-image:u\\72l(https://evil.example/escaped-class.png),cursor:url(https://evil.example/cursor.cur)\n  class Escaped escaped",
    expectedDrawnTexts: ['Classed', 'Escaped'],
    expectedPlaceholderPictureCount: 0,
  },
  {
    mermaidDiagramSampleLabel: 'style statements with pictures',
    mermaidDiagramSource: 'classDiagram\n  class Shape\n  class Circle\n  Shape <|-- Circle\n  style Circle background:url(https://evil.example/class-style.png)',
    expectedDrawnTexts: ['Shape', 'Circle'],
    expectedPlaceholderPictureCount: 0,
  },
  {
    mermaidDiagramSampleLabel: 'settings that import a stylesheet and set a background',
    mermaidDiagramSource:
      '%%{init: {"themeCSS": "@import url(https://evil.example/theme.css); .label { background: url(https://evil.example/theme.png) }", "fontFamily": "sans-serif; background: image-set(\\"https://evil.example/font.png\\" 1x)"}}%%\nflowchart LR\n  A[Themed] --> B[Settings]',
    expectedDrawnTexts: ['Themed', 'Settings'],
    expectedPlaceholderPictureCount: 0,
  },
  {
    mermaidDiagramSampleLabel: 'frontmatter settings with a background',
    mermaidDiagramSource: '---\nconfig:\n  themeCSS: ".node rect { fill: url(#none) } .label { background-image: url(\'https://evil.example/frontmatter.png\') }"\n---\nflowchart LR\n  A[Frontmatter] --> B[Done]',
    expectedDrawnTexts: ['Frontmatter', 'Done'],
    expectedPlaceholderPictureCount: 0,
  },
  {
    mermaidDiagramSampleLabel: 'a sequence actor with a web icon',
    mermaidDiagramSource: 'sequenceDiagram\n  participant A as Alice\n  participant B as Bob\n  properties A: {"class": "internal", "icon": "https://evil.example/icon.png"}\n  properties B: {"\\u0069con": "//evil.example/escaped-icon.png"}\n  A->>B: Hello',
    expectedDrawnTexts: ['Alice', 'Bob', 'Hello'],
    expectedPlaceholderPictureCount: 0,
  },
  {
    mermaidDiagramSampleLabel: 'settings that spell url() in JSON escapes',
    mermaidDiagramSource: '%%{init: {"themeCSS": ".label { background: \\u0075rl(https://evil.example/json-escaped.png) }"}}%%\nflowchart LR\n  A --> B',
    expectedDrawnTexts: [],
    expectedPlaceholderPictureCount: 0,
    isRefused: true,
  },
]

interface PapelizMermaidOutsideAddressReport {
  mermaidDiagramSampleLabel: string
  mermaidDiagramDrawErrorMessage: string | null
  drawnDiagramText: string
  placeholderPictureCount: number
  // "where: what" for each part of a drawing that points outside or loads a file.
  outsideReferenceDescriptions: string[]
}

// Runs in the page: draws each sample in MD View (mounted on the page), for the HTML export and for
// paper, and reads what each drawing points at. Everything it uses is defined inside it, as
// `page.evaluate` requires.
async function drawPapelizMermaidOutsideAddressSamplesInPage(mermaidDiagramSamples: readonly PapelizMermaidOutsideAddressSample[]): Promise<PapelizMermaidOutsideAddressReport[]> {
  const { mountPapelizMermaidDiagram, unmountPapelizMermaidDiagram, drawPapelizMermaidDiagramSvgForExport, drawPapelizMermaidDiagramForPrint, drawPapelizMermaidDiagramPngForPrint } = await import(
    '/src/modules/md-view/papeliz-md-view-mermaid-diagrams.ts'
  )
  const { findCssFileLoadingWord, papelizMermaidPlaceholderPictureAddress } = await import('/src/modules/md-view/papeliz-md-view-mermaid-outside-addresses.ts')
  const fileLoadingElementSelector = 'img, picture, source, video, audio, track, input, iframe, frame, object, embed, link, meta, base, script, foreignObject svg'
  const computedFileLoadingStyleNames = ['backgroundImage', 'listStyleImage', 'borderImageSource', 'maskImage', 'cursor', 'content'] as const
  const describeOutsideReferences = (drawingWhereText: string, drawingRoot: ParentNode, isOnPage: boolean): string[] => {
    const outsideReferenceDescriptions: string[] = []
    for (const fileLoadingElement of drawingRoot.querySelectorAll(fileLoadingElementSelector)) outsideReferenceDescriptions.push(`${drawingWhereText}: a <${fileLoadingElement.localName}>`)
    for (const drawingElement of drawingRoot.querySelectorAll('*')) {
      for (const drawingAttribute of Array.from(drawingElement.attributes)) {
        const isAddressAttribute = /^(?:src|srcset|poster|background|data|href|xlink:href)$/i.test(drawingAttribute.name)
        const isInsideReference = drawingElement.localName === 'a' || drawingAttribute.value.startsWith('#') || drawingAttribute.value === papelizMermaidPlaceholderPictureAddress
        if (isAddressAttribute && !isInsideReference) outsideReferenceDescriptions.push(`${drawingWhereText}: ${drawingElement.localName} ${drawingAttribute.name}="${drawingAttribute.value.slice(0, 60)}"`)
        if (!isAddressAttribute && findCssFileLoadingWord(drawingAttribute.value) !== null) outsideReferenceDescriptions.push(`${drawingWhereText}: ${drawingElement.localName} ${drawingAttribute.name} loads a file`)
      }
      if (drawingElement.localName === 'style' && findCssFileLoadingWord(drawingElement.textContent ?? '') !== null) outsideReferenceDescriptions.push(`${drawingWhereText}: <style> loads a file`)
      if (!isOnPage) continue
      const drawingElementStyle = getComputedStyle(drawingElement)
      for (const computedStyleName of computedFileLoadingStyleNames) {
        if (drawingElementStyle[computedStyleName].includes('url(')) outsideReferenceDescriptions.push(`${drawingWhereText}: ${drawingElement.localName} ${computedStyleName} is ${drawingElementStyle[computedStyleName].slice(0, 60)}`)
      }
    }
    return outsideReferenceDescriptions
  }
  const readDrawingText = (drawingSvgText: string) => {
    const drawingTemplate = document.createElement('template')
    drawingTemplate.innerHTML = drawingSvgText
    return drawingTemplate.content
  }

  const sampleReports: PapelizMermaidOutsideAddressReport[] = []
  for (const { mermaidDiagramSampleLabel, mermaidDiagramSource } of mermaidDiagramSamples) {
    const diagramElement = document.createElement('div')
    document.body.append(diagramElement)
    await new Promise<void>((resolveDrawn) => mountPapelizMermaidDiagram(diagramElement, mermaidDiagramSource, resolveDrawn))
    const sampleReport: PapelizMermaidOutsideAddressReport = {
      mermaidDiagramSampleLabel,
      mermaidDiagramDrawErrorMessage: diagramElement.querySelector('.papeliz-mermaid-diagram-error')?.textContent ?? null,
      drawnDiagramText: diagramElement.querySelector('svg')?.textContent ?? '',
      placeholderPictureCount: Array.from(diagramElement.querySelectorAll('image')).filter((pictureElement) => pictureElement.getAttribute('href') === papelizMermaidPlaceholderPictureAddress).length,
      outsideReferenceDescriptions: describeOutsideReferences('MD View', diagramElement, true),
    }
    unmountPapelizMermaidDiagram(diagramElement)
    diagramElement.remove()
    const exportDrawResult = await drawPapelizMermaidDiagramSvgForExport(mermaidDiagramSource, 'dark', () => null)
    if ('mermaidDiagramSvgText' in exportDrawResult) sampleReport.outsideReferenceDescriptions.push(...describeOutsideReferences('HTML export', readDrawingText(exportDrawResult.mermaidDiagramSvgText), false))
    const printDrawResult = await drawPapelizMermaidDiagramForPrint(mermaidDiagramSource, { readPrintColor: () => null, printFontFamily: 'sans-serif' })
    if ('mermaidDiagramSvgText' in printDrawResult) sampleReport.outsideReferenceDescriptions.push(...describeOutsideReferences('print', readDrawingText(printDrawResult.mermaidDiagramSvgText), false))
    // The Word picture: drawn from the print drawing through an <img>, which loads nothing outside.
    await drawPapelizMermaidDiagramPngForPrint(mermaidDiagramSource, { readPrintColor: () => null, printFontFamily: 'sans-serif', printFontFaceCss: '', pngPixelScale: 1 })
    sampleReports.push(sampleReport)
  }
  // Pictures and fonts start loading a moment after they are asked for.
  await new Promise((resolveWait) => setTimeout(resolveWait, 500))
  return sampleReports
}

// Every request the page makes to a host other than the dev server is recorded and refused, and so
// is every picture or media file it asks the dev server for once the app is open.
async function openPapelizRecordingOutsideRequests(page: Page): Promise<{ outsideRequestAddresses: string[]; pictureRequestAddresses: string[] }> {
  const outsideRequestAddresses: string[] = []
  const pictureRequestAddresses: string[] = []
  await page.route('**/*', (interceptedRoute) => {
    const requestAddress = interceptedRoute.request().url()
    if (['127.0.0.1', 'localhost'].includes(new URL(requestAddress).hostname)) return interceptedRoute.continue()
    outsideRequestAddresses.push(requestAddress)
    return interceptedRoute.abort()
  })
  await page.addInitScript(() => window.localStorage.setItem('papelizThemePreference', 'light'))
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Start' }).getByRole('button', { name: /^New Vault/ })).toBeVisible()
  page.on('request', (pageRequest) => {
    if (['image', 'media'].includes(pageRequest.resourceType()) && !pageRequest.url().startsWith('data:')) pictureRequestAddresses.push(pageRequest.url())
  })
  return { outsideRequestAddresses, pictureRequestAddresses }
}

test('a diagram that names pictures and files from outside draws without asking for any of them', async ({ page }) => {
  test.setTimeout(240_000)
  const { outsideRequestAddresses, pictureRequestAddresses } = await openPapelizRecordingOutsideRequests(page)
  const sampleReports = await page.evaluate(drawPapelizMermaidOutsideAddressSamplesInPage, papelizMermaidOutsideAddressSamples)
  for (const [sampleIndex, sampleReport] of sampleReports.entries()) {
    const outsideAddressSample = papelizMermaidOutsideAddressSamples[sampleIndex]!
    const sampleLabel = sampleReport.mermaidDiagramSampleLabel
    expect.soft(sampleReport.outsideReferenceDescriptions, `${sampleLabel}: what the drawing points at outside`).toEqual([])
    if (outsideAddressSample.isRefused === true) {
      expect.soft(sampleReport.mermaidDiagramDrawErrorMessage, `${sampleLabel} isn't drawn`).toBe('This diagram can’t be drawn: it loads a file from outside the vault, which Papeliz doesn’t allow.')
      continue
    }
    expect.soft(sampleReport.mermaidDiagramDrawErrorMessage, `${sampleLabel} draws`).toBeNull()
    expect.soft(sampleReport.placeholderPictureCount, `${sampleLabel}: placeholder pictures`).toBe(outsideAddressSample.expectedPlaceholderPictureCount)
    for (const expectedDrawnText of outsideAddressSample.expectedDrawnTexts) expect.soft(sampleReport.drawnDiagramText, `${sampleLabel} still shows "${expectedDrawnText}"`).toContain(expectedDrawnText)
  }
  expect(outsideRequestAddresses).toEqual([])
  expect(pictureRequestAddresses).toEqual([])

  // The control: Mermaid drawing the same image shape by itself asks for the picture, and the
  // recording sees it.
  await page.evaluate(async () => {
    const mermaidModuleAddress = performance
      .getEntriesByType('resource')
      .map((resourceEntry) => resourceEntry.name)
      .find((resourceAddress) => /\/mermaid(?:\.core)?\.m?js(?:\?|$)/.test(resourceAddress))
    if (mermaidModuleAddress === undefined) throw new Error('Mermaid was not loaded.')
    const { default: mermaidApi } = await import(/* @vite-ignore */ mermaidModuleAddress)
    await mermaidApi.render('papeliz-mermaid-unguarded-control', 'flowchart LR\n  A@{ img: "https://evil.example/unguarded-control.png", label: "Unguarded" }').catch(() => undefined)
    await new Promise((resolveWait) => setTimeout(resolveWait, 500))
  })
  expect(outsideRequestAddresses).toContain('https://evil.example/unguarded-control.png')
})

test('the check of what Mermaid parsed finds each picture and file the source rewrite takes out', async ({ page }) => {
  await openPapelizRecordingOutsideRequests(page)
  const parsedCheckReports = await page.evaluate(async () => {
    const { drawPapelizMermaidDiagramSvgForExport } = await import('/src/modules/md-view/papeliz-md-view-mermaid-diagrams.ts')
    const { findOutsideAddressInParsedMermaidDiagram, removeOutsideAddressesFromMermaidDiagramSource } = await import('/src/modules/md-view/papeliz-md-view-mermaid-outside-addresses.ts')
    // One draw loads Mermaid; the check then parses with the same Mermaid the app uses.
    await drawPapelizMermaidDiagramSvgForExport('flowchart LR\n  A --> B', 'light', () => null)
    const mermaidModuleAddress = performance
      .getEntriesByType('resource')
      .map((resourceEntry) => resourceEntry.name)
      .find((resourceAddress) => /\/mermaid(?:\.core)?\.m?js(?:\?|$)/.test(resourceAddress))
    if (mermaidModuleAddress === undefined) throw new Error('Mermaid was not loaded.')
    const { default: mermaidApi } = await import(/* @vite-ignore */ mermaidModuleAddress)
    const unguardedMermaidDiagramSources = [
      'flowchart LR\n  A@{ img: "https://evil.example/flowchart.png", label: "Web picture" }',
      'flowchart LR\n  A@{ label: "Escaped key", "\\x69mg": "https://evil.example/escaped-key.png" }',
      'sequenceDiagram\n  participant A\n  properties A: {"icon": "https://evil.example/icon.png"}\n  A->>A: hi',
      "stateDiagram-v2\n  [*] --> Classed\n  classDef pictured background-image:url('//evil.example/class.png')\n  class Classed pictured",
      'classDiagram\n  class Circle\n  style Circle background:url(https://evil.example/style.png)',
    ]
    const findOutsideAddressInMermaidParse = async (mermaidDiagramSource: string) => {
      try {
        return findOutsideAddressInParsedMermaidDiagram((await mermaidApi.mermaidAPI.getDiagramFromText(mermaidDiagramSource)).db)
      } catch (mermaidParseError) {
        return `Mermaid can't read it: ${String(mermaidParseError).split('\n')[0]}`
      }
    }
    const parsedCheckReports: Array<{ unguardedFinding: string | null; guardedFinding: string | null }> = []
    for (const unguardedMermaidDiagramSource of unguardedMermaidDiagramSources) {
      parsedCheckReports.push({
        unguardedFinding: await findOutsideAddressInMermaidParse(unguardedMermaidDiagramSource),
        guardedFinding: await findOutsideAddressInMermaidParse(removeOutsideAddressesFromMermaidDiagramSource(unguardedMermaidDiagramSource)),
      })
    }
    return parsedCheckReports
  })
  expect(parsedCheckReports).toEqual([
    { unguardedFinding: 'https://evil.example/flowchart.png', guardedFinding: null },
    { unguardedFinding: 'https://evil.example/escaped-key.png', guardedFinding: null },
    { unguardedFinding: 'https://evil.example/icon.png', guardedFinding: null },
    { unguardedFinding: 'url(', guardedFinding: null },
    { unguardedFinding: 'url(', guardedFinding: null },
  ])
})

test('ordinary diagrams of every type come through the guard exactly as Mermaid draws them', async ({ page }) => {
  test.setTimeout(240_000)
  const { outsideRequestAddresses } = await openPapelizRecordingOutsideRequests(page)
  const changedSampleDescriptions = await page.evaluate(async (mermaidDiagramSamples) => {
    const { drawPapelizMermaidDiagramSvgForExport } = await import('/src/modules/md-view/papeliz-md-view-mermaid-diagrams.ts')
    const { removeOutsideAddressesFromMermaidDiagramSource, removeOutsideAddressesFromMermaidDiagramSvgText } = await import('/src/modules/md-view/papeliz-md-view-mermaid-outside-addresses.ts')
    await drawPapelizMermaidDiagramSvgForExport('flowchart LR\n  A --> B', 'light', () => null)
    const mermaidModuleAddress = performance
      .getEntriesByType('resource')
      .map((resourceEntry) => resourceEntry.name)
      .find((resourceAddress) => /\/mermaid(?:\.core)?\.m?js(?:\?|$)/.test(resourceAddress))
    if (mermaidModuleAddress === undefined) throw new Error('Mermaid was not loaded.')
    const { default: mermaidApi } = await import(/* @vite-ignore */ mermaidModuleAddress)
    const changedSampleDescriptions: string[] = []
    for (const [sampleIndex, { mermaidDiagramSampleLabel, mermaidDiagramSource }] of mermaidDiagramSamples.entries()) {
      if (removeOutsideAddressesFromMermaidDiagramSource(mermaidDiagramSource) !== mermaidDiagramSource) changedSampleDescriptions.push(`${mermaidDiagramSampleLabel}: its source`)
      // Papeliz's draw leaves its settings for this diagram in place; Mermaid then draws it again
      // directly, and the drawing cleaner must find nothing to change in what Mermaid drew.
      await drawPapelizMermaidDiagramSvgForExport(mermaidDiagramSource, 'light', () => null)
      let mermaidDiagramSvgText: string
      try {
        ;({ svg: mermaidDiagramSvgText } = await mermaidApi.render(`papeliz-mermaid-guard-check-${sampleIndex}`, mermaidDiagramSource))
      } catch {
        continue
      }
      if (removeOutsideAddressesFromMermaidDiagramSvgText(mermaidDiagramSvgText) !== mermaidDiagramSvgText) changedSampleDescriptions.push(`${mermaidDiagramSampleLabel}: its drawing`)
    }
    return changedSampleDescriptions
  }, papelizMermaidDiagramTypeSamples)
  expect(changedSampleDescriptions).toEqual([])
  expect(outsideRequestAddresses).toEqual([])
})
