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

// The smallest a wide diagram is shown on a page, as a share of its own size: Mermaid's 15 px labels
// never drop below 10 px. A narrower column scrolls the diagram sideways instead.
const papelizMermaidDiagramSmallestScale = 2 / 3

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

// Each color token below, with its light and dark values from papeliz-webapp.css, for when a token
// can't be read (paper knows only some of them).
const papelizMermaidColorTokenFallbacks = {
  '--color-papeliz-surface': ['#ffffff', '#15161a'],
  '--color-papeliz-surface-soft': ['#f2f4f7', '#1d1f24'],
  '--color-papeliz-surface-gray': ['#e8ebf0', '#282b31'],
  '--color-papeliz-line': ['#dce0e6', '#30333a'],
  '--color-papeliz-line-strong': ['#c5cbd3', '#444851'],
  '--color-papeliz-ink': ['#111112', '#ececef'],
  '--color-papeliz-ink-muted': ['#55595f', '#b4b8bf'],
  '--color-papeliz-ink-subtle': ['#686c73', '#959aa3'],
  '--color-papeliz-blue': ['#0064d4', '#5ea2ff'],
  '--color-papeliz-callout-red-ground': ['#fde8e7', '#3b1816'],
  '--color-papeliz-callout-red-ink': ['#a3302a', '#ff8f80'],
  '--color-papeliz-callout-orange-ground': ['#ffeedd', '#3a2410'],
  '--color-papeliz-callout-orange-ink': ['#9a4a00', '#ffb370'],
  '--color-papeliz-callout-yellow-ground': ['#fff5c7', '#352c0c'],
  '--color-papeliz-callout-yellow-ink': ['#7a5d00', '#f2d264'],
  '--color-papeliz-callout-green-ground': ['#e2f5e7', '#12301f'],
  '--color-papeliz-callout-green-ink': ['#17663a', '#74d69e'],
  '--color-papeliz-callout-teal-ground': ['#dcf4f0', '#0f302c'],
  '--color-papeliz-callout-blue-ground': ['#eaf2fe', '#172a45'],
  '--color-papeliz-callout-blue-ink': ['#0057ba', '#7db4ff'],
  '--color-papeliz-callout-purple-ground': ['#efe9ff', '#2a1f4a'],
  '--color-papeliz-callout-purple-ink': ['#5b3fc4', '#b8a4ff'],
  '--color-papeliz-callout-pink-ground': ['#fde7f3', '#3d1730'],
  '--color-papeliz-callout-gray-ground': ['#e8ebf0', '#282b31'],
  '--color-papeliz-look-red': ['#d93b30', '#ff7d6e'],
  '--color-papeliz-look-orange': ['#e2640d', '#ff9a52'],
  '--color-papeliz-look-yellow': ['#b88700', '#f5c542'],
  '--color-papeliz-look-green': ['#218358', '#4cc38a'],
  '--color-papeliz-look-blue': ['#0064d4', '#5b9dff'],
  '--color-papeliz-look-purple': ['#7c3fc0', '#b48cf0'],
  '--color-papeliz-look-pink': ['#c7307f', '#f17cbd'],
  '--color-papeliz-look-gray': ['#6b6f76', '#a2a8b2'],
} as const satisfies Record<string, readonly [string, string]>

type PapelizMermaidColorTokenName = keyof typeof papelizMermaidColorTokenFallbacks

// The colors of a run of values (pie slices, chart series, Venn sets), in this order.
const papelizMermaidSeriesColorTokenNames = [
  '--color-papeliz-look-blue',
  '--color-papeliz-look-orange',
  '--color-papeliz-look-green',
  '--color-papeliz-look-purple',
  '--color-papeliz-look-pink',
  '--color-papeliz-look-red',
  '--color-papeliz-look-yellow',
  '--color-papeliz-look-gray',
] as const satisfies readonly PapelizMermaidColorTokenName[]

// Mermaid's twelve section colors (mindmap, timeline, kanban, treemap) in the dark theme, where
// Mermaid's own come out near black.
const papelizMermaidDarkSectionColorTokenNames = [
  '--color-papeliz-callout-blue-ground',
  '--color-papeliz-callout-gray-ground',
  '--color-papeliz-callout-teal-ground',
  '--color-papeliz-callout-purple-ground',
  '--color-papeliz-callout-pink-ground',
  '--color-papeliz-callout-orange-ground',
  '--color-papeliz-callout-green-ground',
  '--color-papeliz-callout-yellow-ground',
  '--color-papeliz-callout-red-ground',
  '--color-papeliz-callout-blue-ground',
  '--color-papeliz-callout-purple-ground',
  '--color-papeliz-callout-teal-ground',
] as const satisfies readonly PapelizMermaidColorTokenName[]

// C4's settings that name a typeface (Mermaid's default is Open Sans), one per kind of box.
const papelizMermaidC4FontFamilySettingNames = [
  'personFontFamily',
  'external_personFontFamily',
  'systemFontFamily',
  'external_systemFontFamily',
  'system_dbFontFamily',
  'external_system_dbFontFamily',
  'system_queueFontFamily',
  'external_system_queueFontFamily',
  'containerFontFamily',
  'external_containerFontFamily',
  'container_dbFontFamily',
  'external_container_dbFontFamily',
  'container_queueFontFamily',
  'external_container_queueFontFamily',
  'componentFontFamily',
  'external_componentFontFamily',
  'component_dbFontFamily',
  'external_component_dbFontFamily',
  'component_queueFontFamily',
  'external_component_queueFontFamily',
  'boundaryFontFamily',
  'messageFontFamily',
] as const

// A diagram can name its own theme, in its frontmatter (`config:` then `theme: forest`) or in an
// `%%{init: {"theme": "dark"}}%%` line. It is then drawn in that theme alone, in the note's typeface.
function namesItsOwnMermaidTheme(mermaidDiagramSource: string): boolean {
  const frontmatterMatch = /^\s*---[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*---/.exec(mermaidDiagramSource)
  if (/^[ \t]+theme[ \t]*:/m.test(frontmatterMatch?.[1] ?? '')) return true
  return /%%\{\s*init(?:ialize)?\s*:[\s\S]*?["']?\btheme["']?\s*:/.test(mermaidDiagramSource)
}

// The theme colors Mermaid would otherwise fix whatever the theme: light grounds that turn
// unreadable in the dark theme (notes, Gantt, Cynefin, railroad, packet, tree view, event modeling),
// section colors that turn near black, and series colors too alike to tell apart. `themeCss` covers
// what Mermaid writes into the drawing, which no theme setting reaches: C4's gray labels and lines,
// the typeface of a sequence diagram's step numbers, and (dark theme) a radar chart's curves.
function describePapelizMermaidThemeOverridesForEveryDiagram(
  isDarkTheme: boolean,
  readThemeColor: (papelizColorVariableName: string, fallbackColor: string) => string,
  noteFontFamily: string,
): { themeVariables: Record<string, unknown>; themeCss: string } {
  const readShownThemeColor = (papelizColorTokenName: PapelizMermaidColorTokenName) =>
    readThemeColor(papelizColorTokenName, papelizMermaidColorTokenFallbacks[papelizColorTokenName][isDarkTheme ? 1 : 0])
  const surfaceColor = readShownThemeColor('--color-papeliz-surface')
  const inkColor = readShownThemeColor('--color-papeliz-ink')
  const seriesColors = papelizMermaidSeriesColorTokenNames.map(readShownThemeColor)
  const numberSeriesColors = (themeVariablePrefix: string) => Object.fromEntries(seriesColors.map((seriesColor, seriesIndex) => [`${themeVariablePrefix}${seriesIndex + 1}`, seriesColor]))
  const themeCssRules = [
    `text[fill="#444444"], tspan[fill="#444444"] { fill: ${readShownThemeColor('--color-papeliz-ink-muted')}; }`,
    `line[stroke="#444444"], path[stroke="#444444"], rect[stroke="#444444"] { stroke: ${readShownThemeColor('--color-papeliz-ink-subtle')}; }`,
    `.sequenceNumber { font-family: ${noteFontFamily}; }`,
  ]
  if (isDarkTheme) {
    papelizMermaidDarkSectionColorTokenNames.forEach((_, sectionIndex) => {
      const curveColor = seriesColors[sectionIndex % seriesColors.length]
      themeCssRules.push(`.radarCurve-${sectionIndex}, .radarLegendBox-${sectionIndex} { fill: ${curveColor}; stroke: ${curveColor}; }`)
    })
  }
  return {
    themeCss: themeCssRules.join('\n'),
    themeVariables: {
      // Railroad diagrams draw their terminals in `secondBkg`.
      secondBkg: readShownThemeColor('--color-papeliz-surface-gray'),
      secondaryTextColor: inkColor,
      tertiaryTextColor: inkColor,
      // Notes (sequence, class and state diagrams) look like a yellow callout.
      noteBkgColor: readShownThemeColor('--color-papeliz-callout-yellow-ground'),
      noteTextColor: readShownThemeColor('--color-papeliz-callout-yellow-ink'),
      // A sequence diagram's step numbers sit on circles of the ink color.
      sequenceNumberColor: surfaceColor,
      altSectionBkgColor: surfaceColor,
      excludeBkgColor: readShownThemeColor('--color-papeliz-surface-soft'),
      gridColor: readShownThemeColor('--color-papeliz-line'),
      doneTaskBkgColor: readShownThemeColor('--color-papeliz-surface-gray'),
      doneTaskBorderColor: readShownThemeColor('--color-papeliz-line-strong'),
      critBkgColor: readShownThemeColor('--color-papeliz-callout-red-ground'),
      critBorderColor: readShownThemeColor('--color-papeliz-callout-red-ink'),
      vertLineColor: readShownThemeColor('--color-papeliz-blue'),
      // Pie slices are told apart by color, with their labels in the ground's color.
      ...numberSeriesColors('pie'),
      pieOpacity: '1',
      pieStrokeColor: surfaceColor,
      pieOuterStrokeColor: readShownThemeColor('--color-papeliz-line-strong'),
      pieSectionTextColor: surfaceColor,
      pieTitleTextColor: inkColor,
      pieLegendTextColor: inkColor,
      ...numberSeriesColors('venn'),
      xyChart: { plotColorPalette: seriesColors.join(',') },
      ...(isDarkTheme ? Object.fromEntries(papelizMermaidDarkSectionColorTokenNames.map((sectionColorTokenName, sectionIndex) => [`cScale${sectionIndex}`, readShownThemeColor(sectionColorTokenName)])) : {}),
      archEdgeColor: readShownThemeColor('--color-papeliz-ink-subtle'),
      archEdgeArrowColor: readShownThemeColor('--color-papeliz-ink-subtle'),
      archGroupBorderColor: readShownThemeColor('--color-papeliz-line-strong'),
      packet: {
        startByteColor: readShownThemeColor('--color-papeliz-ink-subtle'),
        endByteColor: readShownThemeColor('--color-papeliz-ink-subtle'),
        labelColor: inkColor,
        titleColor: inkColor,
        blockStrokeColor: readShownThemeColor('--color-papeliz-line-strong'),
        blockFillColor: readShownThemeColor('--color-papeliz-surface-soft'),
      },
      treeView: {
        labelColor: inkColor,
        lineColor: readShownThemeColor('--color-papeliz-line-strong'),
        iconColor: readShownThemeColor('--color-papeliz-ink-subtle'),
        descriptionColor: readShownThemeColor('--color-papeliz-callout-green-ink'),
      },
      // Cynefin's five domains in the callout colors closest to Mermaid's own.
      cynefin: {
        complexBg: readShownThemeColor('--color-papeliz-callout-green-ground'),
        complicatedBg: readShownThemeColor('--color-papeliz-callout-blue-ground'),
        clearBg: readShownThemeColor('--color-papeliz-callout-yellow-ground'),
        chaoticBg: readShownThemeColor('--color-papeliz-callout-red-ground'),
        confusionBg: readShownThemeColor('--color-papeliz-callout-purple-ground'),
        cliffColor: readShownThemeColor('--color-papeliz-callout-red-ink'),
        textColor: inkColor,
        labelColor: inkColor,
      },
      // Event modeling's boxes keep their usual colors, as callouts.
      emUiFill: surfaceColor,
      emUiStroke: readShownThemeColor('--color-papeliz-line-strong'),
      emCommandFill: readShownThemeColor('--color-papeliz-callout-blue-ground'),
      emCommandStroke: readShownThemeColor('--color-papeliz-callout-blue-ink'),
      emEventFill: readShownThemeColor('--color-papeliz-callout-orange-ground'),
      emEventStroke: readShownThemeColor('--color-papeliz-callout-orange-ink'),
      emReadModelFill: readShownThemeColor('--color-papeliz-callout-green-ground'),
      emReadModelStroke: readShownThemeColor('--color-papeliz-callout-green-ink'),
      emProcessorFill: readShownThemeColor('--color-papeliz-callout-purple-ground'),
      emProcessorStroke: readShownThemeColor('--color-papeliz-callout-purple-ink'),
      emSwimlaneBackgroundOdd: readShownThemeColor('--color-papeliz-surface-soft'),
      emSwimlaneBackgroundStroke: readShownThemeColor('--color-papeliz-line'),
      emRelationStroke: readShownThemeColor('--color-papeliz-ink-subtle'),
      emArrowhead: readShownThemeColor('--color-papeliz-ink-subtle'),
    },
  }
}

// `readThemeColor` gives a color token's value, or the fallback: the page's own colors on screen,
// or a theme's colors for an export (drawPapelizMermaidDiagramSvgForExport). `printFontFamily` draws
// for paper (drawPapelizMermaidDiagramForPrint): in that typeface, with every label as SVG text.
function describePapelizMermaidSettings(
  shownTheme: PapelizShownTheme,
  readThemeColor: (papelizColorVariableName: string, fallbackColor: string) => string = readPapelizThemeColor,
  printFontFamily: string | null = null,
): Parameters<PapelizMermaidApi['initialize']>[0] {
  const noteFontFamily = printFontFamily ?? (getComputedStyle(document.documentElement).getPropertyValue('--papeliz-note-font-family').trim() || 'sans-serif')
  const isDarkTheme = shownTheme === 'dark'
  const papelizMermaidThemeOverrides = describePapelizMermaidThemeOverridesForEveryDiagram(isDarkTheme, readThemeColor, noteFontFamily)
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    // HTML labels sit in `<foreignObject>`, which a canvas won't draw; paper needs plain SVG text.
    ...(printFontFamily === null ? {} : { htmlLabels: false }),
    // A diagram with a mistake throws; MD View shows the message beside the source instead.
    suppressErrorRendering: true,
    // Dagre lays out flowcharts from a small chunk; Mermaid's own default, ELK, is a 1.5 MB download.
    // A diagram can still ask for ELK in its own settings.
    layout: 'dagre',
    theme: 'base',
    darkMode: isDarkTheme,
    fontFamily: noteFontFamily,
    // Diagram types that name their own typeface instead of following `fontFamily`.
    sequence: { actorFontFamily: noteFontFamily, noteFontFamily, messageFontFamily: noteFontFamily },
    journey: { taskFontFamily: noteFontFamily, titleFontFamily: noteFontFamily },
    timeline: { taskFontFamily: noteFontFamily },
    usecase: { actorFontFamily: noteFontFamily, usecaseFontFamily: noteFontFamily },
    c4: Object.fromEntries(papelizMermaidC4FontFamilySettingNames.map((c4FontFamilySettingName) => [c4FontFamilySettingName, noteFontFamily])),
    themeCSS: papelizMermaidThemeOverrides.themeCss,
    themeVariables: {
      darkMode: isDarkTheme,
      fontFamily: noteFontFamily,
      fontSize: '15px',
      background: readThemeColor('--color-papeliz-surface', isDarkTheme ? '#15161a' : '#ffffff'),
      primaryColor: readThemeColor('--color-papeliz-blue-soft', isDarkTheme ? '#172a45' : '#eaf2fe'),
      primaryBorderColor: readThemeColor('--color-papeliz-blue', isDarkTheme ? '#5ea2ff' : '#0064d4'),
      primaryTextColor: readThemeColor('--color-papeliz-ink', isDarkTheme ? '#ececef' : '#111112'),
      secondaryColor: readThemeColor('--color-papeliz-surface-gray', isDarkTheme ? '#282b31' : '#e8ebf0'),
      tertiaryColor: readThemeColor('--color-papeliz-surface-soft', isDarkTheme ? '#1d1f24' : '#f2f4f7'),
      lineColor: readThemeColor('--color-papeliz-ink-subtle', isDarkTheme ? '#959aa3' : '#686c73'),
      edgeLabelBackground: readThemeColor('--color-papeliz-surface', isDarkTheme ? '#15161a' : '#ffffff'),
      textColor: readThemeColor('--color-papeliz-ink', isDarkTheme ? '#ececef' : '#111112'),
      ...papelizMermaidThemeOverrides.themeVariables,
    },
  }
}

// The settings for a diagram that names its own theme: Papeliz's typeface, and none of its colors.
function keepOnlyPapelizMermaidTypeface(papelizMermaidSettings: Parameters<PapelizMermaidApi['initialize']>[0]): Parameters<PapelizMermaidApi['initialize']>[0] {
  const { theme: _papelizTheme, darkMode: _papelizDarkMode, themeCSS: _papelizThemeCss, themeVariables: papelizThemeVariables, ...papelizTypefaceSettings } = papelizMermaidSettings
  return { ...papelizTypefaceSettings, themeVariables: { fontFamily: papelizThemeVariables?.fontFamily, fontSize: papelizThemeVariables?.fontSize } }
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

// One draw, after every draw before it: Mermaid's settings are global.
function queuePapelizMermaidDraw(mermaidDiagramSource: string, describeMermaidSettings: () => Parameters<PapelizMermaidApi['initialize']>[0]): Promise<PapelizMermaidDrawResult> {
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
      papelizMermaidApi.initialize(namesItsOwnMermaidTheme(mermaidDiagramSource) ? keepOnlyPapelizMermaidTypeface(describeMermaidSettings()) : describeMermaidSettings())
      const { svg: mermaidDiagramSvgText } = await papelizMermaidApi.render(mermaidDiagramElementId, mermaidDiagramSource)
      return { mermaidDiagramSvgText }
    } catch (mermaidError) {
      // Mermaid draws in a scratch element under <body>; a failed draw can leave it there.
      document.getElementById(`d${mermaidDiagramElementId}`)?.remove()
      return { mermaidDiagramErrorMessage: shortenMermaidErrorMessage(mermaidError) }
    }
  })
  papelizMermaidDrawQueue = queuedDraw
  return queuedDraw
}

// A drawing as a page shows it (MD View, the locked page, an exported page). Mermaid's <svg> fills the
// column and never grows past its own width; it also keeps `papelizMermaidDiagramSmallestScale` of
// that width, so a narrower column scrolls it sideways (papeliz-webapp.css lifts this for printing).
// A link a diagram makes (`click A "https://…"`) opens in a new tab, as a note's web links do.
function preparePapelizMermaidDiagramSvgForPage(drawResult: PapelizMermaidDrawResult): PapelizMermaidDrawResult {
  if (!('mermaidDiagramSvgText' in drawResult)) return drawResult
  // A template's content is inert: nothing in it loads or runs.
  const mermaidDiagramTemplate = document.createElement('template')
  mermaidDiagramTemplate.innerHTML = drawResult.mermaidDiagramSvgText
  const mermaidDiagramSvgElement = mermaidDiagramTemplate.content.querySelector('svg')
  if (mermaidDiagramSvgElement === null) return drawResult
  const mermaidDiagramPixelWidth = Number.parseFloat(mermaidDiagramSvgElement.style.maxWidth)
  if (Number.isFinite(mermaidDiagramPixelWidth) && mermaidDiagramPixelWidth > 0) {
    mermaidDiagramSvgElement.style.minWidth = `${Math.round(mermaidDiagramPixelWidth * papelizMermaidDiagramSmallestScale)}px`
  }
  for (const mermaidDiagramLinkElement of mermaidDiagramSvgElement.querySelectorAll('a')) {
    mermaidDiagramLinkElement.setAttribute('target', '_blank')
    mermaidDiagramLinkElement.setAttribute('rel', 'noopener noreferrer')
  }
  return { mermaidDiagramSvgText: mermaidDiagramTemplate.innerHTML }
}

// Draws a diagram for an exported page in a theme's colors, whatever the app shows; `readExportThemeColor`
// gives a color token's value in that theme. Not kept in the on-screen cache.
export function drawPapelizMermaidDiagramSvgForExport(
  mermaidDiagramSource: string,
  exportTheme: PapelizShownTheme,
  readExportThemeColor: (papelizColorVariableName: string) => string | null,
): Promise<PapelizMermaidDrawResult> {
  return queuePapelizMermaidDraw(mermaidDiagramSource, () =>
    describePapelizMermaidSettings(exportTheme, (papelizColorVariableName, fallbackColor) => readExportThemeColor(papelizColorVariableName) ?? fallbackColor),
  ).then(preparePapelizMermaidDiagramSvgForPage)
}

export interface PapelizMermaidPrintDrawOptions {
  // A color token's value on paper ("--color-papeliz-blue" -> "#0064d4"), or null for the light default.
  readPrintColor: (papelizColorVariableName: string) => string | null
  // The labels' typeface, a CSS font-family list ("'Figtree', sans-serif").
  printFontFamily: string
}

export interface PapelizMermaidPrintDrawing {
  mermaidDiagramSvgText: string
  // The drawing's own size in CSS pixels, from its viewBox.
  mermaidDiagramPixelWidth: number
  mermaidDiagramPixelHeight: number
}

export type PapelizMermaidPrintDrawResult = PapelizMermaidPrintDrawing | { mermaidDiagramErrorMessage: string }

// "-8 -8 523.5 374" -> 523.5 × 374; null when the drawing has no usable viewBox.
function readMermaidSvgViewBoxSize(mermaidDiagramSvgText: string): { viewBoxWidth: number; viewBoxHeight: number } | null {
  const viewBoxMatch = /<svg\b[^>]*\bviewBox="([^"]+)"/.exec(mermaidDiagramSvgText)
  const viewBoxNumbers = viewBoxMatch?.[1]?.trim().split(/[\s,]+/).map(Number) ?? []
  const [, , viewBoxWidth, viewBoxHeight] = viewBoxNumbers
  if (viewBoxNumbers.length !== 4 || viewBoxWidth === undefined || viewBoxHeight === undefined) return null
  return Number.isFinite(viewBoxWidth) && Number.isFinite(viewBoxHeight) && viewBoxWidth > 0 && viewBoxHeight > 0 ? { viewBoxWidth, viewBoxHeight } : null
}

// A drawing without a viewBox (Mermaid's info diagram) gives its width as `max-width`, and its height
// as an attribute or not at all: then the drawing is measured, hidden, on the page. Null when it has
// no size even so.
function readMermaidSvgStyledSize(mermaidDiagramSvgText: string): { viewBoxWidth: number; viewBoxHeight: number } | null {
  const svgStartTag = /<svg\b[^>]*>/.exec(mermaidDiagramSvgText)?.[0] ?? ''
  const viewBoxWidth = Number(/\bmax-width:\s*([\d.]+)px/.exec(svgStartTag)?.[1])
  let viewBoxHeight = Number(/\bheight="([\d.]+)"/.exec(svgStartTag)?.[1])
  if (!(viewBoxHeight > 0)) {
    const measuringElement = document.createElement('div')
    measuringElement.style.cssText = 'position: fixed; left: -100000px; top: 0; visibility: hidden'
    // Mermaid's own output in strict mode, as MD View shows it: nothing in it runs.
    measuringElement.innerHTML = mermaidDiagramSvgText
    document.body.append(measuringElement)
    const drawnContentBox = measuringElement.querySelector('svg')?.getBBox()
    measuringElement.remove()
    viewBoxHeight = drawnContentBox === undefined ? Number.NaN : Math.ceil(drawnContentBox.y + drawnContentBox.height)
  }
  return Number.isFinite(viewBoxWidth) && Number.isFinite(viewBoxHeight) && viewBoxWidth > 0 && viewBoxHeight > 0 ? { viewBoxWidth, viewBoxHeight } : null
}

// Mermaid writes its drawing as HTML, which isn't always XML: a diagram link's `xlink:href` comes
// without its namespace, and event modeling's labels hold `<br>`. Read the way a page reads it, the
// drawing is written out again as XML.
function rewriteMermaidSvgTextAsXml(mermaidDiagramSvgText: string): string {
  const mermaidDiagramSvgElement = new DOMParser().parseFromString(mermaidDiagramSvgText, 'text/html').body.querySelector('svg')
  return mermaidDiagramSvgElement === null ? mermaidDiagramSvgText : new XMLSerializer().serializeToString(mermaidDiagramSvgElement)
}

// Draws a diagram for paper (the PDF and Word exports): in the light theme's colors whatever the app
// shows, and every label as SVG text, so the drawing can also become a picture. Not kept in the
// on-screen cache.
export async function drawPapelizMermaidDiagramForPrint(mermaidDiagramSource: string, printDrawOptions: PapelizMermaidPrintDrawOptions): Promise<PapelizMermaidPrintDrawResult> {
  if (mermaidDiagramSource.trim().length === 0) return { mermaidDiagramErrorMessage: 'the diagram is empty.' }
  // Mermaid measures each label with the page's fonts, so the typeface is loaded first.
  try {
    await document.fonts.load(`15px ${printDrawOptions.printFontFamily}`)
  } catch {
    // A typeface that can't load is measured in the browser's fallback, as it is then drawn.
  }
  const drawResult = await queuePapelizMermaidDraw(mermaidDiagramSource, () =>
    describePapelizMermaidSettings('light', (papelizColorVariableName, fallbackColor) => printDrawOptions.readPrintColor(papelizColorVariableName) ?? fallbackColor, printDrawOptions.printFontFamily),
  )
  if (!('mermaidDiagramSvgText' in drawResult)) return drawResult
  const viewBoxSize = readMermaidSvgViewBoxSize(drawResult.mermaidDiagramSvgText) ?? readMermaidSvgStyledSize(drawResult.mermaidDiagramSvgText)
  if (viewBoxSize === null) return { mermaidDiagramErrorMessage: 'the drawing has no size.' }
  return { mermaidDiagramSvgText: drawResult.mermaidDiagramSvgText, mermaidDiagramPixelWidth: viewBoxSize.viewBoxWidth, mermaidDiagramPixelHeight: viewBoxSize.viewBoxHeight }
}

export interface PapelizMermaidPrintPngOptions extends PapelizMermaidPrintDrawOptions {
  // `@font-face` rules with `data:` URLs for the labels' typeface: a picture made from SVG can't use
  // the page's fonts. Empty for a typeface every computer has.
  printFontFaceCss: string
  // How many picture pixels per CSS pixel of the drawing (2 stays sharp on paper).
  pngPixelScale: number
}

export interface PapelizMermaidPrintPng extends PapelizMermaidPrintDrawing {
  mermaidDiagramPngBytes: Uint8Array
  mermaidDiagramPngPixelWidth: number
  mermaidDiagramPngPixelHeight: number
}

// The print drawing as a PNG on white, for Word and the PDF's picture path. A canvas draws Mermaid's
// SVG through an `<img>`, which runs nothing and loads nothing from outside.
export async function drawPapelizMermaidDiagramPngForPrint(
  mermaidDiagramSource: string,
  printPngOptions: PapelizMermaidPrintPngOptions,
): Promise<PapelizMermaidPrintPng | { mermaidDiagramErrorMessage: string }> {
  const printDrawResult = await drawPapelizMermaidDiagramForPrint(mermaidDiagramSource, printPngOptions)
  if (!('mermaidDiagramSvgText' in printDrawResult)) return printDrawResult
  const { mermaidDiagramPixelWidth, mermaidDiagramPixelHeight } = printDrawResult
  try {
    const svgDocument = new DOMParser().parseFromString(rewriteMermaidSvgTextAsXml(printDrawResult.mermaidDiagramSvgText), 'image/svg+xml')
    const svgElement = svgDocument.documentElement
    if (svgElement.localName !== 'svg' || svgDocument.getElementsByTagName('parsererror').length > 0) return { mermaidDiagramErrorMessage: 'the drawing can’t be read.' }
    // The drawing at its own size, rather than the page's width.
    svgElement.setAttribute('width', String(mermaidDiagramPixelWidth))
    svgElement.setAttribute('height', String(mermaidDiagramPixelHeight))
    svgElement.removeAttribute('style')
    svgElement.setAttribute('font-family', printPngOptions.printFontFamily) // for labels Mermaid gives no typeface (Wardley's)
    if (printPngOptions.printFontFaceCss.length > 0) {
      const fontStyleElement = svgDocument.createElementNS('http://www.w3.org/2000/svg', 'style')
      fontStyleElement.textContent = printPngOptions.printFontFaceCss
      svgElement.insertBefore(fontStyleElement, svgElement.firstChild)
    }
    const diagramImage = new Image()
    diagramImage.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svgDocument))}`
    await diagramImage.decode()
    const mermaidDiagramPngPixelWidth = Math.max(1, Math.round(mermaidDiagramPixelWidth * printPngOptions.pngPixelScale))
    const mermaidDiagramPngPixelHeight = Math.max(1, Math.round(mermaidDiagramPixelHeight * printPngOptions.pngPixelScale))
    const diagramCanvas = document.createElement('canvas')
    diagramCanvas.width = mermaidDiagramPngPixelWidth
    diagramCanvas.height = mermaidDiagramPngPixelHeight
    const diagramCanvasContext = diagramCanvas.getContext('2d')
    if (diagramCanvasContext === null) return { mermaidDiagramErrorMessage: 'the drawing can’t be made a picture here.' }
    diagramCanvasContext.fillStyle = printPngOptions.readPrintColor('--color-papeliz-surface') ?? '#ffffff'
    diagramCanvasContext.fillRect(0, 0, mermaidDiagramPngPixelWidth, mermaidDiagramPngPixelHeight)
    diagramCanvasContext.drawImage(diagramImage, 0, 0, mermaidDiagramPngPixelWidth, mermaidDiagramPngPixelHeight)
    // `toBlob` waits for the page to be idle, a second at a time while it draws no frames.
    const diagramPngDataUrl = diagramCanvas.toDataURL('image/png')
    const diagramPngBinaryText = atob(diagramPngDataUrl.slice(diagramPngDataUrl.indexOf(',') + 1))
    const mermaidDiagramPngBytes = new Uint8Array(diagramPngBinaryText.length)
    for (let pngByteIndex = 0; pngByteIndex < diagramPngBinaryText.length; pngByteIndex += 1) mermaidDiagramPngBytes[pngByteIndex] = diagramPngBinaryText.charCodeAt(pngByteIndex)
    return { ...printDrawResult, mermaidDiagramPngBytes, mermaidDiagramPngPixelWidth, mermaidDiagramPngPixelHeight }
  } catch {
    return { mermaidDiagramErrorMessage: 'the drawing can’t be made a picture here.' }
  }
}

function drawPapelizMermaidDiagramSvg(mermaidDiagramSource: string, shownTheme: PapelizShownTheme): Promise<PapelizMermaidDrawResult> {
  const drawCacheKey = `${shownTheme}\n${mermaidDiagramSource}`
  const cachedDrawResult = papelizMermaidDrawResultsByThemeAndSource.get(drawCacheKey)
  if (cachedDrawResult !== undefined) return Promise.resolve(cachedDrawResult)
  return queuePapelizMermaidDraw(mermaidDiagramSource, () => describePapelizMermaidSettings(shownTheme)).then((rawDrawResult) => {
    const drawResult = preparePapelizMermaidDiagramSvgForPage(rawDrawResult)
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
