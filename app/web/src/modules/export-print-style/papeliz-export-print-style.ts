// The print values the Word and PDF exports share: MD View's look on paper. Colors are MD View's
// light theme (papeliz-webapp.css), whatever the app shows, since paper is white. Sizes are MD View's
// CSS sizes scaled to an 11 pt body, so a printed note keeps MD View's proportions. The test beside
// this file checks every color against the stylesheet.

export type PapelizExportPageSize = 'a4' | 'letter'

export const papelizExportPageSizesInPoints: Readonly<Record<PapelizExportPageSize, { pageWidthPoints: number; pageHeightPoints: number }>> = {
  a4: { pageWidthPoints: 595.28, pageHeightPoints: 841.89 },
  letter: { pageWidthPoints: 612, pageHeightPoints: 792 },
}

export const papelizExportPageMarginsInMillimeters = { topMillimeters: 20, rightMillimeters: 20, bottomMillimeters: 22, leftMillimeters: 20 } as const

// The footer: the note's name on the left, the page number on the right.
export const papelizExportFooterDistanceFromPageEdgeMillimeters = 10
export const papelizExportFooterTextSizePoints = 8

// Regions that print on US Letter; every other region prints on A4.
const papelizExportLetterPaperRegionCodes: ReadonlySet<string> = new Set(['US', 'CA', 'MX', 'PH', 'CL', 'CO', 'VE', 'CR', 'GT', 'PA', 'DO', 'PR'])

// The paper a person's region uses, from the browser's languages ("en-US" -> Letter, "de-DE" -> A4).
export function choosePapelizExportDefaultPageSize(browserLanguageTags: readonly string[]): PapelizExportPageSize {
  for (const browserLanguageTag of browserLanguageTags) {
    let browserRegionCode: string | undefined
    try {
      browserRegionCode = new Intl.Locale(browserLanguageTag).region
    } catch {
      continue
    }
    if (browserRegionCode !== undefined) return papelizExportLetterPaperRegionCodes.has(browserRegionCode.toUpperCase()) ? 'letter' : 'a4'
  }
  return 'a4'
}

// MD View's body text is 17 px; on paper it is 11 pt.
export const papelizExportBodyTextSizePoints = 11
export const papelizExportBodyLineHeight = 1.6
const papelizMdViewBodyTextSizePixels = 17

export function scalePapelizMdViewPixelsToPrintPoints(mdViewPixels: number): number {
  return (mdViewPixels * papelizExportBodyTextSizePoints) / papelizMdViewBodyTextSizePixels
}

function scalePapelizMdViewEmsToPrintPoints(mdViewEms: number): number {
  return mdViewEms * papelizExportBodyTextSizePoints
}

// `.papeliz-md-view-article` and the rules under it.
export const papelizExportPrintTextSizesInPoints = {
  heading1TextSizePoints: scalePapelizMdViewEmsToPrintPoints(2.24),
  heading2TextSizePoints: scalePapelizMdViewEmsToPrintPoints(1.3),
  heading3TextSizePoints: scalePapelizMdViewEmsToPrintPoints(1.06),
  heading4To6TextSizePoints: scalePapelizMdViewPixelsToPrintPoints(16),
  // Inline code is 0.86em of the text around it.
  inlineCodeTextSizeRatio: 0.86,
  codeBlockTextSizePoints: scalePapelizMdViewPixelsToPrintPoints(13.5),
  tableTextSizePoints: scalePapelizMdViewPixelsToPrintPoints(14.5),
  tagTextSizePoints: scalePapelizMdViewPixelsToPrintPoints(13),
  propertyTextSizePoints: scalePapelizMdViewPixelsToPrintPoints(13),
  calloutTitleTextSizePoints: scalePapelizMdViewPixelsToPrintPoints(14),
  calloutBodyTextSizePoints: scalePapelizMdViewPixelsToPrintPoints(16),
  footnotesTextSizePoints: scalePapelizMdViewPixelsToPrintPoints(14),
} as const

export const papelizExportPrintLineHeights = {
  heading1LineHeight: 1.15,
  heading2LineHeight: 1.3,
  heading3LineHeight: 1.35,
  codeBlockLineHeight: 1.65,
} as const

// Space above and below blocks, from MD View's margins.
export const papelizExportPrintSpacingInPoints = {
  heading1SpaceBelowPoints: scalePapelizMdViewPixelsToPrintPoints(14),
  heading2SpaceAbovePoints: scalePapelizMdViewPixelsToPrintPoints(30),
  heading2SpaceBelowPoints: scalePapelizMdViewPixelsToPrintPoints(8),
  heading3SpaceAbovePoints: scalePapelizMdViewPixelsToPrintPoints(24),
  heading3SpaceBelowPoints: scalePapelizMdViewPixelsToPrintPoints(6),
  heading4To6SpaceAbovePoints: scalePapelizMdViewPixelsToPrintPoints(20),
  heading4To6SpaceBelowPoints: scalePapelizMdViewPixelsToPrintPoints(6),
  paragraphSpaceBelowPoints: scalePapelizMdViewPixelsToPrintPoints(14),
  listItemSpaceBelowPoints: scalePapelizMdViewPixelsToPrintPoints(4),
  listSpaceBelowPoints: scalePapelizMdViewPixelsToPrintPoints(16),
  listIndentPoints: scalePapelizMdViewPixelsToPrintPoints(24),
  taskListItemIndentPoints: scalePapelizMdViewPixelsToPrintPoints(30),
  quoteBarWidthPoints: scalePapelizMdViewPixelsToPrintPoints(3),
  quoteIndentPoints: scalePapelizMdViewPixelsToPrintPoints(16),
  blockSpaceAbovePoints: scalePapelizMdViewPixelsToPrintPoints(6),
  blockSpaceBelowPoints: scalePapelizMdViewPixelsToPrintPoints(18),
  codeBlockPaddingVerticalPoints: scalePapelizMdViewPixelsToPrintPoints(14),
  codeBlockPaddingHorizontalPoints: scalePapelizMdViewPixelsToPrintPoints(16),
  ruleSpaceAbovePoints: scalePapelizMdViewPixelsToPrintPoints(26),
  ruleSpaceBelowPoints: scalePapelizMdViewPixelsToPrintPoints(26),
  propertiesSpaceBelowPoints: scalePapelizMdViewPixelsToPrintPoints(22),
  tableCellPaddingVerticalPoints: scalePapelizMdViewPixelsToPrintPoints(9),
  tableCellPaddingHorizontalPoints: scalePapelizMdViewPixelsToPrintPoints(14),
  calloutPaddingVerticalPoints: scalePapelizMdViewPixelsToPrintPoints(14),
  calloutPaddingHorizontalPoints: scalePapelizMdViewPixelsToPrintPoints(18),
  calloutTitleSpaceBelowPoints: scalePapelizMdViewPixelsToPrintPoints(4),
  calloutIconSizePoints: scalePapelizMdViewPixelsToPrintPoints(16),
  calloutIconGapPoints: scalePapelizMdViewPixelsToPrintPoints(7),
  footnotesSpaceAbovePoints: scalePapelizMdViewPixelsToPrintPoints(30),
  hairlineWidthPoints: scalePapelizMdViewPixelsToPrintPoints(1),
} as const

// MD View's light theme colors, by their token in papeliz-webapp.css.
export const papelizExportPrintColorsByToken = {
  '--color-papeliz-surface': '#ffffff',
  '--color-papeliz-ink': '#111112',
  '--color-papeliz-ink-muted': '#55595f',
  '--color-papeliz-ink-subtle': '#686c73',
  '--color-papeliz-blue': '#0064d4',
  '--color-papeliz-blue-soft': '#eaf2fe',
  '--color-papeliz-line': '#dce0e6',
  '--color-papeliz-line-strong': '#c5cbd3',
  '--color-papeliz-surface-soft': '#f2f4f7',
  '--color-papeliz-surface-gray': '#e8ebf0',
  '--color-papeliz-warning': '#fff4e0',
  '--color-papeliz-warning-ink': '#8a4b00',
  '--color-papeliz-diff-added': '#e2f5e7',
  '--color-papeliz-diff-added-ink': '#17663a',
  '--color-papeliz-diff-removed': '#fde8e7',
  '--color-papeliz-diff-removed-ink': '#a3302a',
  '--color-papeliz-error-notice-ground': '#fdecea',
  '--color-papeliz-error-notice-line': '#e0544b',
  '--color-papeliz-error-notice-ink': '#8f1f19',
  '--color-papeliz-callout-red-ground': '#fde8e7',
  '--color-papeliz-callout-red-ink': '#a3302a',
  '--color-papeliz-callout-orange-ground': '#ffeedd',
  '--color-papeliz-callout-orange-ink': '#9a4a00',
  '--color-papeliz-callout-yellow-ground': '#fff5c7',
  '--color-papeliz-callout-yellow-ink': '#7a5d00',
  '--color-papeliz-callout-green-ground': '#e2f5e7',
  '--color-papeliz-callout-green-ink': '#17663a',
  '--color-papeliz-callout-teal-ground': '#dcf4f0',
  '--color-papeliz-callout-teal-ink': '#0e6b61',
  '--color-papeliz-callout-blue-ground': '#eaf2fe',
  '--color-papeliz-callout-blue-ink': '#0057ba',
  '--color-papeliz-callout-purple-ground': '#efe9ff',
  '--color-papeliz-callout-purple-ink': '#5b3fc4',
  '--color-papeliz-callout-pink-ground': '#fde7f3',
  '--color-papeliz-callout-pink-ink': '#a3236b',
  '--color-papeliz-callout-gray-ground': '#e8ebf0',
  '--color-papeliz-callout-gray-ink': '#4b5058',
} as const

export type PapelizExportPrintColorToken = keyof typeof papelizExportPrintColorsByToken

// A color token's print color, or null for a token that isn't one of them.
export function getPapelizExportPrintColor(papelizColorToken: string): string | null {
  return Object.hasOwn(papelizExportPrintColorsByToken, papelizColorToken) ? papelizExportPrintColorsByToken[papelizColorToken as PapelizExportPrintColorToken] : null
}

type PapelizOklabColor = readonly [oklabLightness: number, oklabA: number, oklabB: number]

function convertSrgbChannelToLinear(srgbChannel: number): number {
  return srgbChannel <= 0.04045 ? srgbChannel / 12.92 : ((srgbChannel + 0.055) / 1.055) ** 2.4
}

function convertLinearChannelToSrgb(linearChannel: number): number {
  return linearChannel <= 0.0031308 ? linearChannel * 12.92 : 1.055 * linearChannel ** (1 / 2.4) - 0.055
}

// "#7c3aed" in Björn Ottosson's Oklab, the space CSS's `color-mix(in oklab, …)` mixes in.
function convertHexColorToOklab(hexColor: string): PapelizOklabColor {
  const [linearRed, linearGreen, linearBlue] = [1, 3, 5].map((hexChannelIndex) => convertSrgbChannelToLinear(Number.parseInt(hexColor.slice(hexChannelIndex, hexChannelIndex + 2), 16) / 255)) as [number, number, number]
  const coneLong = Math.cbrt(0.4122214708 * linearRed + 0.5363325363 * linearGreen + 0.0514459929 * linearBlue)
  const coneMedium = Math.cbrt(0.2119034982 * linearRed + 0.6806995451 * linearGreen + 0.1073969566 * linearBlue)
  const coneShort = Math.cbrt(0.0883024619 * linearRed + 0.2817188376 * linearGreen + 0.6299787005 * linearBlue)
  return [
    0.2104542553 * coneLong + 0.793617785 * coneMedium - 0.0040720468 * coneShort,
    1.9779984951 * coneLong - 2.428592205 * coneMedium + 0.4505937099 * coneShort,
    0.0259040371 * coneLong + 0.7827717662 * coneMedium - 0.808675766 * coneShort,
  ]
}

function convertOklabToHexColor([oklabLightness, oklabA, oklabB]: PapelizOklabColor): string {
  const coneLong = (oklabLightness + 0.3963377774 * oklabA + 0.2158037573 * oklabB) ** 3
  const coneMedium = (oklabLightness - 0.1055613458 * oklabA - 0.0638541728 * oklabB) ** 3
  const coneShort = (oklabLightness - 0.0894841775 * oklabA - 1.291485548 * oklabB) ** 3
  const linearChannels = [
    4.0767416621 * coneLong - 3.3077115913 * coneMedium + 0.2309699292 * coneShort,
    -1.2684380046 * coneLong + 2.6097574011 * coneMedium - 0.3413193965 * coneShort,
    -0.0041960863 * coneLong - 0.7034186147 * coneMedium + 1.707614701 * coneShort,
  ]
  return `#${linearChannels
    .map((linearChannel) => Math.round(Math.min(1, Math.max(0, convertLinearChannelToSrgb(linearChannel))) * 255).toString(16).padStart(2, '0'))
    .join('')}`
}

// CSS's `color-mix(in oklab, firstColor firstColorShare, secondColor)`, for hex colors.
export function mixPapelizExportPrintColorsInOklab(firstHexColor: string, firstColorShare: number, secondHexColor: string): string {
  const [firstLightness, firstA, firstB] = convertHexColorToOklab(firstHexColor)
  const [secondLightness, secondA, secondB] = convertHexColorToOklab(secondHexColor)
  const mixOklabChannel = (firstChannel: number, secondChannel: number) => firstChannel * firstColorShare + secondChannel * (1 - firstColorShare)
  return convertOklabToHexColor([mixOklabChannel(firstLightness, secondLightness), mixOklabChannel(firstA, secondA), mixOklabChannel(firstB, secondB)])
}

export interface PapelizExportCalloutPrintColors {
  calloutGroundColor: string
  calloutInkColor: string
}

// The ground and ink of each callout kind that has its own colors; every other kind is blue.
const papelizExportCalloutColorTokensByKind: Readonly<Record<string, readonly [PapelizExportPrintColorToken, PapelizExportPrintColorToken]>> = {
  warning: ['--color-papeliz-warning', '--color-papeliz-warning-ink'],
  caution: ['--color-papeliz-warning', '--color-papeliz-warning-ink'],
  attention: ['--color-papeliz-warning', '--color-papeliz-warning-ink'],
  danger: ['--color-papeliz-diff-removed', '--color-papeliz-diff-removed-ink'],
  error: ['--color-papeliz-diff-removed', '--color-papeliz-diff-removed-ink'],
  failure: ['--color-papeliz-diff-removed', '--color-papeliz-diff-removed-ink'],
  bug: ['--color-papeliz-diff-removed', '--color-papeliz-diff-removed-ink'],
  success: ['--color-papeliz-diff-added', '--color-papeliz-diff-added-ink'],
  check: ['--color-papeliz-diff-added', '--color-papeliz-diff-added-ink'],
  done: ['--color-papeliz-diff-added', '--color-papeliz-diff-added-ink'],
  quote: ['--color-papeliz-surface-gray', '--color-papeliz-ink-muted'],
  cite: ['--color-papeliz-surface-gray', '--color-papeliz-ink-muted'],
  abstract: ['--color-papeliz-callout-teal-ground', '--color-papeliz-callout-teal-ink'],
  summary: ['--color-papeliz-callout-teal-ground', '--color-papeliz-callout-teal-ink'],
  tldr: ['--color-papeliz-callout-teal-ground', '--color-papeliz-callout-teal-ink'],
  question: ['--color-papeliz-callout-yellow-ground', '--color-papeliz-callout-yellow-ink'],
  help: ['--color-papeliz-callout-yellow-ground', '--color-papeliz-callout-yellow-ink'],
  faq: ['--color-papeliz-callout-yellow-ground', '--color-papeliz-callout-yellow-ink'],
  example: ['--color-papeliz-callout-purple-ground', '--color-papeliz-callout-purple-ink'],
}

// A callout card's colors as MD View draws them (`.papeliz-md-view-callout`): its own color when it
// names one (a card color, or a hex color mixed into the paper and the ink), else its kind's.
export function getPapelizExportCalloutPrintColors(calloutKind: string, calloutColor: string | null): PapelizExportCalloutPrintColors {
  if (calloutColor !== null && /^#[0-9a-f]{6}$/i.test(calloutColor)) {
    const { '--color-papeliz-surface': surfaceColor, '--color-papeliz-ink': inkColor } = papelizExportPrintColorsByToken
    return {
      calloutGroundColor: mixPapelizExportPrintColorsInOklab(calloutColor.toLowerCase(), 0.16, surfaceColor),
      calloutInkColor: mixPapelizExportPrintColorsInOklab(calloutColor.toLowerCase(), 0.7, inkColor),
    }
  }
  const namedCalloutGroundColor = calloutColor === null ? null : getPapelizExportPrintColor(`--color-papeliz-callout-${calloutColor}-ground`)
  const namedCalloutInkColor = calloutColor === null ? null : getPapelizExportPrintColor(`--color-papeliz-callout-${calloutColor}-ink`)
  if (namedCalloutGroundColor !== null && namedCalloutInkColor !== null) return { calloutGroundColor: namedCalloutGroundColor, calloutInkColor: namedCalloutInkColor }
  const blueCalloutColorTokens: readonly [PapelizExportPrintColorToken, PapelizExportPrintColorToken] = ['--color-papeliz-blue-soft', '--color-papeliz-blue']
  const [calloutGroundToken, calloutInkToken] = Object.hasOwn(papelizExportCalloutColorTokensByKind, calloutKind)
    ? (papelizExportCalloutColorTokensByKind[calloutKind] ?? blueCalloutColorTokens)
    : blueCalloutColorTokens
  return { calloutGroundColor: papelizExportPrintColorsByToken[calloutGroundToken], calloutInkColor: papelizExportPrintColorsByToken[calloutInkToken] }
}
