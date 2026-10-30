// ```mermaid blocks drawn as diagrams, in the editable MD View and on the locked page. Mermaid is
// large, so it loads (its own chunk) only when a note first shows a diagram. It runs with
// `securityLevel: 'strict'`: labels can hold no HTML or script, and click handlers are off. The
// diagrams take their colors from the app's theme and are drawn again when the theme changes.

type PapelizMermaidApi = (typeof import('mermaid'))['default']
type PapelizShownTheme = 'light' | 'dark'

type PapelizMermaidDrawResult = { mermaidDiagramSvgText: string } | { mermaidDiagramErrorMessage: string }

let papelizMermaidApiPromise: Promise<PapelizMermaidApi> | null = null
// Mermaid's settings are global, so diagrams are drawn one at a time, each with its theme set first.
let papelizMermaidDrawQueue: Promise<unknown> = Promise.resolve()
let papelizMermaidDiagramCount = 0

const papelizMermaidDrawResultsByThemeAndSource = new Map<string, PapelizMermaidDrawResult>()
const papelizMermaidDrawResultCacheLimit = 40

interface PapelizMountedMermaidDiagram {
  mermaidDiagramSource: string
  onMermaidDiagramDrawn: () => void
}

const papelizMountedMermaidDiagramsByElement = new Map<HTMLElement, PapelizMountedMermaidDiagram>()
let isFollowingThemeForMermaidDiagrams = false

function loadPapelizMermaidApi(): Promise<PapelizMermaidApi> {
  papelizMermaidApiPromise ??= import('mermaid').then((mermaidModule) => mermaidModule.default)
  // A failed download (offline) is tried again the next time a diagram is shown.
  papelizMermaidApiPromise.catch(() => {
    papelizMermaidApiPromise = null
  })
  return papelizMermaidApiPromise
}

function readShownPapelizTheme(): PapelizShownTheme {
  const papelizThemeAttribute = document.documentElement.dataset['papelizTheme']
  if (papelizThemeAttribute === 'dark' || papelizThemeAttribute === 'light') return papelizThemeAttribute
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readPapelizThemeColor(papelizColorVariableName: string, fallbackColor: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(papelizColorVariableName).trim() || fallbackColor
}

function describePapelizMermaidSettings(shownTheme: PapelizShownTheme): Parameters<PapelizMermaidApi['initialize']>[0] {
  const noteFontFamily = getComputedStyle(document.documentElement).getPropertyValue('--papeliz-note-font-family').trim() || 'sans-serif'
  const isDarkTheme = shownTheme === 'dark'
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    // A diagram with a mistake throws; MD View shows the message beside the source instead.
    suppressErrorRendering: true,
    // Dagre lays out flowcharts from a small chunk; Mermaid's own default, ELK, is a 1.5 MB download.
    // A diagram can still ask for ELK in its own settings.
    layout: 'dagre',
    theme: 'base',
    darkMode: isDarkTheme,
    fontFamily: noteFontFamily,
    themeVariables: {
      darkMode: isDarkTheme,
      fontFamily: noteFontFamily,
      fontSize: '15px',
      background: readPapelizThemeColor('--color-papeliz-surface', isDarkTheme ? '#15161a' : '#ffffff'),
      primaryColor: readPapelizThemeColor('--color-papeliz-blue-soft', isDarkTheme ? '#172a45' : '#eaf2fe'),
      primaryBorderColor: readPapelizThemeColor('--color-papeliz-blue', isDarkTheme ? '#5ea2ff' : '#0064d4'),
      primaryTextColor: readPapelizThemeColor('--color-papeliz-ink', isDarkTheme ? '#ececef' : '#111112'),
      secondaryColor: readPapelizThemeColor('--color-papeliz-surface-gray', isDarkTheme ? '#282b31' : '#e8ebf0'),
      tertiaryColor: readPapelizThemeColor('--color-papeliz-surface-soft', isDarkTheme ? '#1d1f24' : '#f2f4f7'),
      lineColor: readPapelizThemeColor('--color-papeliz-ink-subtle', isDarkTheme ? '#959aa3' : '#686c73'),
      edgeLabelBackground: readPapelizThemeColor('--color-papeliz-surface', isDarkTheme ? '#15161a' : '#ffffff'),
      textColor: readPapelizThemeColor('--color-papeliz-ink', isDarkTheme ? '#ececef' : '#111112'),
    },
  }
}

// The first line of Mermaid's message, short enough for one line under the source.
function shortenMermaidErrorMessage(mermaidError: unknown): string {
  const mermaidErrorText = mermaidError instanceof Error ? mermaidError.message : String(mermaidError)
  const firstErrorLine =
    mermaidErrorText
      .split('\n')
      .find((errorLine) => errorLine.trim().length > 0)
      ?.trim()
      .replace(/:$/, '') ?? 'unknown error'
  return firstErrorLine.length > 160 ? `${firstErrorLine.slice(0, 157)}…` : firstErrorLine
}

function drawPapelizMermaidDiagramSvg(mermaidDiagramSource: string, shownTheme: PapelizShownTheme): Promise<PapelizMermaidDrawResult> {
  const drawCacheKey = `${shownTheme}\n${mermaidDiagramSource}`
  const cachedDrawResult = papelizMermaidDrawResultsByThemeAndSource.get(drawCacheKey)
  if (cachedDrawResult !== undefined) return Promise.resolve(cachedDrawResult)
  const queuedDraw = papelizMermaidDrawQueue.then(async (): Promise<PapelizMermaidDrawResult> => {
    let papelizMermaidApi: PapelizMermaidApi
    try {
      papelizMermaidApi = await loadPapelizMermaidApi()
    } catch {
      return { mermaidDiagramErrorMessage: 'The diagram drawer could not be loaded. Check the connection and open the note again.' }
    }
    papelizMermaidDiagramCount += 1
    const mermaidDiagramElementId = `papeliz-mermaid-diagram-${papelizMermaidDiagramCount}`
    try {
      papelizMermaidApi.initialize(describePapelizMermaidSettings(shownTheme))
      const { svg: mermaidDiagramSvgText } = await papelizMermaidApi.render(mermaidDiagramElementId, mermaidDiagramSource)
      return { mermaidDiagramSvgText }
    } catch (mermaidError) {
      // Mermaid draws in a scratch element under <body>; a failed draw can leave it there.
      document.getElementById(`d${mermaidDiagramElementId}`)?.remove()
      return { mermaidDiagramErrorMessage: shortenMermaidErrorMessage(mermaidError) }
    }
  })
  papelizMermaidDrawQueue = queuedDraw
  return queuedDraw.then((drawResult) => {
    if (papelizMermaidDrawResultsByThemeAndSource.size >= papelizMermaidDrawResultCacheLimit) {
      const oldestDrawCacheKey = papelizMermaidDrawResultsByThemeAndSource.keys().next().value
      if (oldestDrawCacheKey !== undefined) papelizMermaidDrawResultsByThemeAndSource.delete(oldestDrawCacheKey)
    }
    papelizMermaidDrawResultsByThemeAndSource.set(drawCacheKey, drawResult)
    return drawResult
  })
}

function showPapelizMermaidDrawResult(diagramElement: HTMLElement, mermaidDiagramSource: string, drawResult: PapelizMermaidDrawResult): void {
  if ('mermaidDiagramSvgText' in drawResult) {
    diagramElement.classList.remove('papeliz-mermaid-diagram-has-error')
    // Mermaid's own output in strict mode: labels are sanitized and nothing in it runs.
    diagramElement.innerHTML = drawResult.mermaidDiagramSvgText
    return
  }
  diagramElement.classList.add('papeliz-mermaid-diagram-has-error')
  const errorLineElement = document.createElement('p')
  errorLineElement.className = 'papeliz-mermaid-diagram-error'
  errorLineElement.textContent = `This diagram can’t be drawn: ${drawResult.mermaidDiagramErrorMessage}`
  const sourceElement = document.createElement('pre')
  sourceElement.className = 'papeliz-mermaid-diagram-source'
  sourceElement.textContent = mermaidDiagramSource
  diagramElement.replaceChildren(sourceElement, errorLineElement)
}

function drawMountedPapelizMermaidDiagram(diagramElement: HTMLElement): void {
  const mountedMermaidDiagram = papelizMountedMermaidDiagramsByElement.get(diagramElement)
  if (mountedMermaidDiagram === undefined) return
  const { mermaidDiagramSource } = mountedMermaidDiagram
  if (mermaidDiagramSource.trim().length === 0) {
    showPapelizMermaidDrawResult(diagramElement, mermaidDiagramSource, { mermaidDiagramErrorMessage: 'the diagram is empty.' })
    return
  }
  const shownTheme = readShownPapelizTheme()
  // A diagram already drawn (the cursor left its block, or the note was opened again) shows at once.
  const cachedDrawResult = papelizMermaidDrawResultsByThemeAndSource.get(`${shownTheme}\n${mermaidDiagramSource}`)
  if (cachedDrawResult !== undefined) {
    showPapelizMermaidDrawResult(diagramElement, mermaidDiagramSource, cachedDrawResult)
    return
  }
  // A diagram drawn again for a new theme keeps the old drawing until the new one is ready.
  if (!diagramElement.hasChildNodes()) {
    const placeholderElement = document.createElement('p')
    placeholderElement.className = 'papeliz-mermaid-diagram-placeholder'
    placeholderElement.textContent = 'Drawing the diagram…'
    diagramElement.replaceChildren(placeholderElement)
  }
  void drawPapelizMermaidDiagramSvg(mermaidDiagramSource, shownTheme).then((drawResult) => {
    // The element may have been taken off the page, or given another diagram, in the meantime.
    if (papelizMountedMermaidDiagramsByElement.get(diagramElement) !== mountedMermaidDiagram) return
    showPapelizMermaidDrawResult(diagramElement, mermaidDiagramSource, drawResult)
    mountedMermaidDiagram.onMermaidDiagramDrawn()
  })
}

function followThemeForMermaidDiagrams(): void {
  if (isFollowingThemeForMermaidDiagrams) return
  isFollowingThemeForMermaidDiagrams = true
  const drawMountedDiagramsAgain = () => {
    for (const diagramElement of papelizMountedMermaidDiagramsByElement.keys()) drawMountedPapelizMermaidDiagram(diagramElement)
  }
  new MutationObserver(drawMountedDiagramsAgain).observe(document.documentElement, { attributes: true, attributeFilter: ['data-papeliz-theme'] })
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawMountedDiagramsAgain)
}

// Draws `mermaidDiagramSource` into `diagramElement`, which Mermaid code then owns until unmounted.
export function mountPapelizMermaidDiagram(diagramElement: HTMLElement, mermaidDiagramSource: string, onMermaidDiagramDrawn: () => void = () => undefined): void {
  followThemeForMermaidDiagrams()
  papelizMountedMermaidDiagramsByElement.set(diagramElement, { mermaidDiagramSource, onMermaidDiagramDrawn })
  drawMountedPapelizMermaidDiagram(diagramElement)
}

export function unmountPapelizMermaidDiagram(diagramElement: HTMLElement): void {
  papelizMountedMermaidDiagramsByElement.delete(diagramElement)
}
