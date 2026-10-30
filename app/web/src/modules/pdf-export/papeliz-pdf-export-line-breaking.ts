import LineBreaker from 'linebreak'
import {
  getPapelizPdfExportFontFaceKey,
  splitPapelizPdfExportTextBySubset,
  type PapelizPdfExportFontStyle,
} from './papeliz-pdf-export-fonts'
import type { PapelizPdfExportInlineIconName, PapelizPdfExportLinkTarget } from './papeliz-pdf-export-note-document'
import {
  roundPapelizPdfExportPoints,
  type PapelizPdfExportOpenTypeFeatureSet,
  type PapelizPdfExportLinkAreaOperation,
  type PapelizPdfExportPageOperation,
} from './papeliz-pdf-export-page-layout-plan'
import type { PapelizPdfExportTextMeasurer } from './papeliz-pdf-export-text-measuring'

// Lines from styled text, as a browser sets them: break opportunities from Unicode's line-break
// rules (UAX #14), never inside a character cluster, no hyphenation, left aligned. A word longer than
// the line breaks between characters, as MD View's `overflow-wrap: break-word`. Lines take the CSS
// inline box heights, so a larger run makes its line taller. A link gets a clickable area over each
// of its line pieces. Each line's drawing is placed from its own top left; the pagination moves it
// onto the page.

export interface PapelizPdfExportTextChipLook {
  chipGroundColor: string
  chipPaddingHorizontalPoints: number
  chipPaddingVerticalPoints: number
  chipCornerRadiusPoints: number
  // A tag's chip has a fixed height; null fits the text.
  chipHeightPoints: number | null
}

export interface PapelizPdfExportResolvedTextLink {
  // The link's own structure element, inside its block's.
  linkStructureElementKey: string
  linkTarget: PapelizPdfExportLinkTarget
  linkDescription: string
}

// A drawn picture in a line in place of text, as wide as its box: its path in a 24-unit square.
export interface PapelizPdfExportInlineIconLook {
  inlineIconName: PapelizPdfExportInlineIconName
}

export interface PapelizPdfExportResolvedTextStyle {
  textFontStyle: PapelizPdfExportFontStyle
  textSizePoints: number
  textColor: string
  characterSpacingPoints: number
  openTypeFeatureSet: PapelizPdfExportOpenTypeFeatureSet
  textUnderline: { underlineColor: string; isUnderlineDashed: boolean } | null
  isTextStruck: boolean
  // Up for superscript, down (negative) for subscript.
  baselineShiftPoints: number
  textChip: PapelizPdfExportTextChipLook | null
  textLink: PapelizPdfExportResolvedTextLink | null
  // A named place at the piece's start.
  textDestinationName: string | null
  textInlineIcon: PapelizPdfExportInlineIconLook | null
}

export type PapelizPdfExportStyledTextPiece = { styledPieceKind: 'text'; pieceText: string; pieceStyle: PapelizPdfExportResolvedTextStyle } | { styledPieceKind: 'line-break' }

export interface PapelizPdfExportLineStrut {
  // The block's own text, which sets every line's least height and its baseline.
  strutFontStyle: PapelizPdfExportFontStyle
  strutTextSizePoints: number
  lineHeightRatio: number
}

export interface PapelizPdfExportTextLinesOptions {
  styledTextPieces: readonly PapelizPdfExportStyledTextPiece[]
  lineWidthPoints: number
  lineStrut: PapelizPdfExportLineStrut
  // Lines after a wrap start this far in (code); 0 for prose.
  wrappedLineIndentPoints: number
  structureElementKey: string
  textMeasurer: PapelizPdfExportTextMeasurer
}

export interface PapelizPdfExportLaidOutLine {
  lineHeightPoints: number
  // From the line's top: where a list item's bullet or number sits.
  lineBaselinePoints: number
  // Placed from the line's own top left.
  lineOperations: PapelizPdfExportPageOperation[]
  missingCharacterCount: number
}

// Text may reach a hair past the line, as glyph edges do in a browser.
const papelizPdfExportLineWidthTolerancePoints = 0.01

interface PapelizPdfExportInlineIconDrawing {
  // In a 24-unit square, stroked in the text's color with round ends.
  iconPathData: string
  iconStrokeWidth: number
  iconWidthEm: number
}

// MD View's "↩" after a footnote: a hooked arrow pointing back.
const papelizPdfExportInlineIconDrawings: Readonly<Record<PapelizPdfExportInlineIconName, PapelizPdfExportInlineIconDrawing>> = {
  'footnote-back-arrow': { iconPathData: 'M15 6a4 4 0 0 1 0 8H5M9 10l-4 4 4 4', iconStrokeWidth: 2, iconWidthEm: 0.95 },
}
const papelizPdfExportInlineIconViewBoxSize = 24
// An icon's middle sits where a lowercase letter's middle does.
const papelizPdfExportInlineIconMiddleAboveBaselineEm = 0.32

export function getPapelizPdfExportInlineIconWidthPoints(inlineIconLook: PapelizPdfExportInlineIconLook, textSizePoints: number): number {
  return papelizPdfExportInlineIconDrawings[inlineIconLook.inlineIconName].iconWidthEm * textSizePoints
}

interface PapelizTextTokenPiece {
  styledPieceIndex: number
  tokenPieceText: string
  isStyledPieceStart: boolean
  isStyledPieceEnd: boolean
}

interface PapelizTextToken {
  tokenPieces: PapelizTextTokenPiece[]
  // Without the spaces after it, which hang past a line's end.
  tokenContentWidthPoints: number
  tokenFullWidthPoints: number
  isLineEndRequired: boolean
}

const papelizPdfExportTextGraphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

function getPieceStyle(styledTextPieces: readonly PapelizPdfExportStyledTextPiece[], styledPieceIndex: number): PapelizPdfExportResolvedTextStyle | null {
  const styledTextPiece = styledTextPieces[styledPieceIndex]
  return styledTextPiece?.styledPieceKind === 'text' ? styledTextPiece.pieceStyle : null
}

// Text in one style, split by the font file that has each character, measured as drawn. An icon is
// as wide as its box.
function measureStyledTextWidthPoints(styledText: string, textStyle: PapelizPdfExportResolvedTextStyle, textMeasurer: PapelizPdfExportTextMeasurer): number {
  if (textStyle.textInlineIcon !== null) return getPapelizPdfExportInlineIconWidthPoints(textStyle.textInlineIcon, textStyle.textSizePoints)
  let styledTextWidthPoints = 0
  for (const { segmentText, fontSubsetName } of splitPapelizPdfExportTextBySubset(styledText)) {
    const fontFaceKey = getPapelizPdfExportFontFaceKey({ ...textStyle.textFontStyle, fontSubsetName: fontSubsetName ?? 'latin' })
    styledTextWidthPoints +=
      textMeasurer.measureTextWidthPoints(segmentText, fontFaceKey, textStyle.textSizePoints, textStyle.characterSpacingPoints, textStyle.openTypeFeatureSet) + textStyle.characterSpacingPoints
  }
  return styledTextWidthPoints
}

function measureTokenPiecesWidthPoints(tokenPieces: readonly PapelizTextTokenPiece[], textLinesOptions: PapelizPdfExportTextLinesOptions): number {
  let tokenWidthPoints = 0
  for (const tokenPiece of tokenPieces) {
    const pieceStyle = getPieceStyle(textLinesOptions.styledTextPieces, tokenPiece.styledPieceIndex)
    if (pieceStyle === null || tokenPiece.tokenPieceText.length === 0) continue
    const chipPaddingPoints = pieceStyle.textChip?.chipPaddingHorizontalPoints ?? 0
    if (tokenPiece.isStyledPieceStart) tokenWidthPoints += chipPaddingPoints
    if (tokenPiece.isStyledPieceEnd) tokenWidthPoints += chipPaddingPoints
    tokenWidthPoints += measureStyledTextWidthPoints(tokenPiece.tokenPieceText, pieceStyle, textLinesOptions.textMeasurer)
  }
  return tokenWidthPoints
}

function createTextToken(tokenPieces: PapelizTextTokenPiece[], isLineEndRequired: boolean, textLinesOptions: PapelizPdfExportTextLinesOptions): PapelizTextToken {
  // The spaces and line end after a token's last character take no room at a line's end.
  const contentTokenPieces: PapelizTextTokenPiece[] = []
  let isTrailingSpace = true
  for (let tokenPieceIndex = tokenPieces.length - 1; tokenPieceIndex >= 0; tokenPieceIndex -= 1) {
    const tokenPiece = tokenPieces[tokenPieceIndex] as PapelizTextTokenPiece
    if (!isTrailingSpace) {
      contentTokenPieces.unshift(tokenPiece)
      continue
    }
    const trimmedPieceText = tokenPiece.tokenPieceText.replace(/[ \n]+$/, '')
    if (trimmedPieceText.length > 0) {
      isTrailingSpace = false
      contentTokenPieces.unshift({ ...tokenPiece, tokenPieceText: trimmedPieceText })
    }
  }
  return {
    tokenPieces,
    tokenContentWidthPoints: measureTokenPiecesWidthPoints(contentTokenPieces, textLinesOptions),
    tokenFullWidthPoints: measureTokenPiecesWidthPoints(
      tokenPieces.map((tokenPiece) => ({ ...tokenPiece, tokenPieceText: tokenPiece.tokenPieceText.replace(/\n/g, '') })),
      textLinesOptions,
    ),
    isLineEndRequired,
  }
}

// The text between break opportunities, each with its pieces in their styles.
function listTextTokens(textLinesOptions: PapelizPdfExportTextLinesOptions): PapelizTextToken[] {
  const { styledTextPieces } = textLinesOptions
  const styledPieceStartOffsets: number[] = []
  let paragraphText = ''
  for (const styledTextPiece of styledTextPieces) {
    styledPieceStartOffsets.push(paragraphText.length)
    paragraphText += styledTextPiece.styledPieceKind === 'text' ? styledTextPiece.pieceText : '\n'
  }
  const textTokens: PapelizTextToken[] = []
  const paragraphLineBreaker = new LineBreaker(paragraphText)
  let tokenStartOffset = 0
  for (let lineBreakOpportunity = paragraphLineBreaker.nextBreak(); lineBreakOpportunity !== null; lineBreakOpportunity = paragraphLineBreaker.nextBreak()) {
    const tokenEndOffset = lineBreakOpportunity.position
    if (tokenEndOffset <= tokenStartOffset) continue
    const tokenPieces: PapelizTextTokenPiece[] = []
    styledTextPieces.forEach((styledTextPiece, styledPieceIndex) => {
      if (styledTextPiece.styledPieceKind !== 'text') return
      const styledPieceStartOffset = styledPieceStartOffsets[styledPieceIndex] ?? 0
      const styledPieceEndOffset = styledPieceStartOffset + styledTextPiece.pieceText.length
      const pieceStartOffset = Math.max(tokenStartOffset, styledPieceStartOffset)
      const pieceEndOffset = Math.min(tokenEndOffset, styledPieceEndOffset)
      if (pieceEndOffset <= pieceStartOffset) return
      tokenPieces.push({
        styledPieceIndex,
        tokenPieceText: paragraphText.slice(pieceStartOffset, pieceEndOffset),
        isStyledPieceStart: pieceStartOffset === styledPieceStartOffset,
        isStyledPieceEnd: pieceEndOffset === styledPieceEndOffset,
      })
    })
    textTokens.push(createTextToken(tokenPieces, lineBreakOpportunity.required && paragraphText[tokenEndOffset - 1] === '\n', textLinesOptions))
    tokenStartOffset = tokenEndOffset
  }
  return textTokens
}

// A word too long for any line, one character cluster per token, so it breaks where it has to.
function splitTokenIntoGraphemeTokens(textToken: PapelizTextToken, textLinesOptions: PapelizPdfExportTextLinesOptions): PapelizTextToken[] {
  const graphemeTokens: PapelizTextToken[] = []
  textToken.tokenPieces.forEach((tokenPiece, tokenPieceIndex) => {
    const pieceGraphemes = Array.from(papelizPdfExportTextGraphemeSegmenter.segment(tokenPiece.tokenPieceText), ({ segment }) => segment)
    pieceGraphemes.forEach((pieceGrapheme, pieceGraphemeIndex) => {
      const isLastGrapheme = tokenPieceIndex === textToken.tokenPieces.length - 1 && pieceGraphemeIndex === pieceGraphemes.length - 1
      graphemeTokens.push(
        createTextToken(
          [
            {
              styledPieceIndex: tokenPiece.styledPieceIndex,
              tokenPieceText: pieceGrapheme,
              isStyledPieceStart: tokenPiece.isStyledPieceStart && pieceGraphemeIndex === 0,
              isStyledPieceEnd: tokenPiece.isStyledPieceEnd && pieceGraphemeIndex === pieceGraphemes.length - 1,
            },
          ],
          isLastGrapheme && textToken.isLineEndRequired,
          textLinesOptions,
        ),
      )
    })
  })
  return graphemeTokens
}

interface PapelizLineFragment {
  styledPieceIndex: number
  fragmentText: string
  isStyledPieceStart: boolean
  isStyledPieceEnd: boolean
}

// A line's tokens as runs in one style each, without the spaces and line end that hang past it.
function buildLineFragments(lineTokens: readonly PapelizTextToken[]): PapelizLineFragment[] {
  const lineFragments: PapelizLineFragment[] = []
  for (const lineToken of lineTokens) {
    for (const tokenPiece of lineToken.tokenPieces) {
      const lastLineFragment = lineFragments.at(-1)
      if (lastLineFragment !== undefined && lastLineFragment.styledPieceIndex === tokenPiece.styledPieceIndex) {
        lastLineFragment.fragmentText += tokenPiece.tokenPieceText
        lastLineFragment.isStyledPieceEnd = tokenPiece.isStyledPieceEnd
      } else {
        lineFragments.push({ ...tokenPiece, fragmentText: tokenPiece.tokenPieceText })
      }
    }
  }
  for (const lineFragment of lineFragments) lineFragment.fragmentText = lineFragment.fragmentText.replace(/\n/g, '')
  for (let lineFragmentIndex = lineFragments.length - 1; lineFragmentIndex >= 0; lineFragmentIndex -= 1) {
    const lineFragment = lineFragments[lineFragmentIndex] as PapelizLineFragment
    lineFragment.fragmentText = lineFragment.fragmentText.replace(/ +$/, '')
    if (lineFragment.fragmentText.length > 0) break
  }
  return lineFragments.filter((lineFragment) => lineFragment.fragmentText.length > 0)
}

interface PapelizInlineBoxExtent {
  aboveBaselinePoints: number
  belowBaselinePoints: number
}

// A CSS inline box: its line height around its text, the leading split above and below.
function measureInlineBoxExtent(
  fontStyle: PapelizPdfExportFontStyle,
  textSizePoints: number,
  lineHeightRatio: number,
  baselineShiftPoints: number,
  textMeasurer: PapelizPdfExportTextMeasurer,
): PapelizInlineBoxExtent {
  const { ascentEm, descentEm } = textMeasurer.getFontFaceMetrics(getPapelizPdfExportFontFaceKey({ ...fontStyle, fontSubsetName: 'latin' }))
  const halfLeadingPoints = (lineHeightRatio * textSizePoints - (ascentEm + descentEm) * textSizePoints) / 2
  return {
    aboveBaselinePoints: halfLeadingPoints + ascentEm * textSizePoints + baselineShiftPoints,
    belowBaselinePoints: halfLeadingPoints + descentEm * textSizePoints - baselineShiftPoints,
  }
}

// Where a chip's ground sits, from the baseline: around the text's own height, or centered on it at
// its fixed height (a tag).
function measureChipExtent(textStyle: PapelizPdfExportResolvedTextStyle, textChip: PapelizPdfExportTextChipLook, textMeasurer: PapelizPdfExportTextMeasurer): PapelizInlineBoxExtent {
  const { ascentEm, descentEm } = textMeasurer.getFontFaceMetrics(getPapelizPdfExportFontFaceKey({ ...textStyle.textFontStyle, fontSubsetName: 'latin' }))
  const textAbovePoints = ascentEm * textStyle.textSizePoints + textStyle.baselineShiftPoints
  const textBelowPoints = descentEm * textStyle.textSizePoints - textStyle.baselineShiftPoints
  if (textChip.chipHeightPoints === null) {
    return { aboveBaselinePoints: textAbovePoints + textChip.chipPaddingVerticalPoints, belowBaselinePoints: textBelowPoints + textChip.chipPaddingVerticalPoints }
  }
  const chipCenterAboveBaselinePoints = (textAbovePoints - textBelowPoints) / 2
  return { aboveBaselinePoints: chipCenterAboveBaselinePoints + textChip.chipHeightPoints / 2, belowBaselinePoints: textChip.chipHeightPoints / 2 - chipCenterAboveBaselinePoints }
}

interface PapelizLaidOutLineDraft {
  laidOutLine: PapelizPdfExportLaidOutLine
  lineContentWidthPoints: number
}

function layOutLine(lineTokens: readonly PapelizTextToken[], lineLeftPoints: number, textLinesOptions: PapelizPdfExportTextLinesOptions): PapelizLaidOutLineDraft {
  const { styledTextPieces, lineStrut, textMeasurer, structureElementKey } = textLinesOptions
  const lineFragments = buildLineFragments(lineTokens)
  const strutExtent = measureInlineBoxExtent(lineStrut.strutFontStyle, lineStrut.strutTextSizePoints, lineStrut.lineHeightRatio, 0, textMeasurer)
  let lineAbovePoints = strutExtent.aboveBaselinePoints
  let lineBelowPoints = strutExtent.belowBaselinePoints
  for (const lineFragment of lineFragments) {
    const fragmentStyle = getPieceStyle(styledTextPieces, lineFragment.styledPieceIndex)
    if (fragmentStyle === null) continue
    const fragmentExtent = measureInlineBoxExtent(fragmentStyle.textFontStyle, fragmentStyle.textSizePoints, lineStrut.lineHeightRatio, fragmentStyle.baselineShiftPoints, textMeasurer)
    lineAbovePoints = Math.max(lineAbovePoints, fragmentExtent.aboveBaselinePoints)
    lineBelowPoints = Math.max(lineBelowPoints, fragmentExtent.belowBaselinePoints)
    const fragmentChip = fragmentStyle.textChip
    if (fragmentChip !== null && fragmentChip.chipHeightPoints !== null) {
      const chipExtent = measureChipExtent(fragmentStyle, fragmentChip, textMeasurer)
      lineAbovePoints = Math.max(lineAbovePoints, chipExtent.aboveBaselinePoints)
      lineBelowPoints = Math.max(lineBelowPoints, chipExtent.belowBaselinePoints)
    }
  }
  const lineBaselinePoints = lineAbovePoints
  const lineHeightPoints = lineAbovePoints + lineBelowPoints
  const placeOperations: PapelizPdfExportPageOperation[] = []
  const chipOperations: PapelizPdfExportPageOperation[] = []
  const textOperations: PapelizPdfExportPageOperation[] = []
  const decorationOperations: PapelizPdfExportPageOperation[] = []
  const linkAreaOperations: PapelizPdfExportLinkAreaOperation[] = []
  let missingCharacterCount = 0
  let fragmentLeftPoints = lineLeftPoints
  for (const lineFragment of lineFragments) {
    const fragmentStyle = getPieceStyle(styledTextPieces, lineFragment.styledPieceIndex)
    if (fragmentStyle === null) continue
    const chipStartPoints = fragmentLeftPoints
    const chipPaddingPoints = fragmentStyle.textChip?.chipPaddingHorizontalPoints ?? 0
    if (fragmentStyle.textDestinationName !== null && lineFragment.isStyledPieceStart) {
      placeOperations.push({ pageOperationKind: 'destination', destinationName: fragmentStyle.textDestinationName, destinationTopPoints: 0 })
    }
    if (lineFragment.isStyledPieceStart) fragmentLeftPoints += chipPaddingPoints
    const textStartPoints = fragmentLeftPoints
    const textBaselinePoints = lineBaselinePoints - fragmentStyle.baselineShiftPoints
    const { textInlineIcon, textLink } = fragmentStyle
    if (textInlineIcon !== null) {
      const { iconPathData, iconStrokeWidth } = papelizPdfExportInlineIconDrawings[textInlineIcon.inlineIconName]
      const iconSizePoints = getPapelizPdfExportInlineIconWidthPoints(textInlineIcon, fragmentStyle.textSizePoints)
      decorationOperations.push({
        pageOperationKind: 'path',
        pathData: iconPathData,
        pathLeftPoints: roundPapelizPdfExportPoints(textStartPoints),
        pathTopPoints: roundPapelizPdfExportPoints(textBaselinePoints - papelizPdfExportInlineIconMiddleAboveBaselineEm * fragmentStyle.textSizePoints - iconSizePoints / 2),
        pathScale: roundPapelizPdfExportPoints(iconSizePoints / papelizPdfExportInlineIconViewBoxSize),
        pathFillColor: null,
        pathStrokeColor: fragmentStyle.textColor,
        pathStrokeWidth: iconStrokeWidth,
      })
      fragmentLeftPoints += iconSizePoints
    }
    const fragmentText = textInlineIcon === null ? lineFragment.fragmentText : ''
    for (const { segmentText, fontSubsetName } of splitPapelizPdfExportTextBySubset(fragmentText)) {
      const fontFaceKey = getPapelizPdfExportFontFaceKey({ ...fragmentStyle.textFontStyle, fontSubsetName: fontSubsetName ?? 'latin' })
      const openTypeFeatureSet = textMeasurer.chooseOpenTypeFeatureSet(segmentText, fontFaceKey, fragmentStyle.openTypeFeatureSet)
      const textWidthPoints = textMeasurer.measureTextWidthPoints(segmentText, fontFaceKey, fragmentStyle.textSizePoints, fragmentStyle.characterSpacingPoints, openTypeFeatureSet)
      missingCharacterCount += textMeasurer.countMissingCharacters(segmentText, fontFaceKey)
      textOperations.push({
        pageOperationKind: 'text-run',
        textRunText: segmentText,
        fontFaceKey,
        textSizePoints: roundPapelizPdfExportPoints(fragmentStyle.textSizePoints),
        textColor: fragmentStyle.textColor,
        characterSpacingPoints: roundPapelizPdfExportPoints(fragmentStyle.characterSpacingPoints),
        openTypeFeatureSet,
        textLeftPoints: roundPapelizPdfExportPoints(fragmentLeftPoints),
        textBaselinePoints: roundPapelizPdfExportPoints(textBaselinePoints),
        textWidthPoints: roundPapelizPdfExportPoints(textWidthPoints),
        operationTagging: { operationTaggingKind: 'structure', structureElementKey: textLink?.linkStructureElementKey ?? structureElementKey },
      })
      fragmentLeftPoints += textWidthPoints + fragmentStyle.characterSpacingPoints
    }
    const textEndPoints = textInlineIcon === null ? fragmentLeftPoints - fragmentStyle.characterSpacingPoints : fragmentLeftPoints
    if (lineFragment.isStyledPieceEnd) fragmentLeftPoints += chipPaddingPoints
    if (textLink !== null) {
      // One area for the pieces of one link that sit side by side on this line.
      const lastLinkAreaOperation = linkAreaOperations.at(-1)
      if (lastLinkAreaOperation?.structureElementKey === textLink.linkStructureElementKey) {
        lastLinkAreaOperation.linkAreaWidthPoints = fragmentLeftPoints - lastLinkAreaOperation.linkAreaLeftPoints
      } else {
        linkAreaOperations.push({
          pageOperationKind: 'link-area',
          linkAreaLeftPoints: chipStartPoints,
          linkAreaTopPoints: 0,
          linkAreaWidthPoints: fragmentLeftPoints - chipStartPoints,
          linkAreaHeightPoints: roundPapelizPdfExportPoints(lineHeightPoints),
          linkAreaTarget: textLink.linkTarget,
          linkAreaDescription: textLink.linkDescription,
          structureElementKey: textLink.linkStructureElementKey,
        })
      }
    }
    if (fragmentStyle.textChip !== null) {
      const chipExtent = measureChipExtent(fragmentStyle, fragmentStyle.textChip, textMeasurer)
      chipOperations.push({
        pageOperationKind: 'rectangle',
        rectangleLeftPoints: roundPapelizPdfExportPoints(chipStartPoints),
        rectangleTopPoints: roundPapelizPdfExportPoints(lineBaselinePoints - chipExtent.aboveBaselinePoints),
        rectangleWidthPoints: roundPapelizPdfExportPoints(fragmentLeftPoints - chipStartPoints),
        rectangleHeightPoints: roundPapelizPdfExportPoints(chipExtent.aboveBaselinePoints + chipExtent.belowBaselinePoints),
        rectangleCornerRadiusPoints: roundPapelizPdfExportPoints(fragmentStyle.textChip.chipCornerRadiusPoints),
        rectangleFillColor: fragmentStyle.textChip.chipGroundColor,
        rectangleStrokeColor: null,
        rectangleStrokeWidthPoints: 0,
      })
    }
    const fragmentFontFaceMetrics = textMeasurer.getFontFaceMetrics(getPapelizPdfExportFontFaceKey({ ...fragmentStyle.textFontStyle, fontSubsetName: 'latin' }))
    if (fragmentStyle.textUnderline !== null) {
      const underlineThicknessPoints = Math.max(0.4, fragmentFontFaceMetrics.underlineThicknessEm * fragmentStyle.textSizePoints)
      const underlineTopPoints = textBaselinePoints + fragmentFontFaceMetrics.underlineOffsetEm * fragmentStyle.textSizePoints + underlineThicknessPoints / 2
      decorationOperations.push({
        pageOperationKind: 'line',
        lineFromLeftPoints: roundPapelizPdfExportPoints(textStartPoints),
        lineFromTopPoints: roundPapelizPdfExportPoints(underlineTopPoints),
        lineToLeftPoints: roundPapelizPdfExportPoints(textEndPoints),
        lineToTopPoints: roundPapelizPdfExportPoints(underlineTopPoints),
        lineColor: fragmentStyle.textUnderline.underlineColor,
        lineWidthPoints: roundPapelizPdfExportPoints(underlineThicknessPoints),
        lineDashPoints: fragmentStyle.textUnderline.isUnderlineDashed ? roundPapelizPdfExportPoints(Math.max(1.5, 3 * underlineThicknessPoints)) : null,
      })
    }
    if (fragmentStyle.isTextStruck) {
      const strikeThicknessPoints = Math.max(0.4, fragmentFontFaceMetrics.strikeThicknessEm * fragmentStyle.textSizePoints)
      const strikeTopPoints = textBaselinePoints - fragmentFontFaceMetrics.strikeOffsetEm * fragmentStyle.textSizePoints
      decorationOperations.push({
        pageOperationKind: 'line',
        lineFromLeftPoints: roundPapelizPdfExportPoints(textStartPoints),
        lineFromTopPoints: roundPapelizPdfExportPoints(strikeTopPoints),
        lineToLeftPoints: roundPapelizPdfExportPoints(textEndPoints),
        lineToTopPoints: roundPapelizPdfExportPoints(strikeTopPoints),
        lineColor: fragmentStyle.textColor,
        lineWidthPoints: roundPapelizPdfExportPoints(strikeThicknessPoints),
        lineDashPoints: null,
      })
    }
  }
  for (const linkAreaOperation of linkAreaOperations) {
    linkAreaOperation.linkAreaLeftPoints = roundPapelizPdfExportPoints(linkAreaOperation.linkAreaLeftPoints)
    linkAreaOperation.linkAreaWidthPoints = roundPapelizPdfExportPoints(linkAreaOperation.linkAreaWidthPoints)
  }
  return {
    laidOutLine: {
      lineHeightPoints: roundPapelizPdfExportPoints(lineHeightPoints),
      lineBaselinePoints: roundPapelizPdfExportPoints(lineBaselinePoints),
      // Places first, grounds, then text, then the lines through and under it and the icons, then
      // the links' areas over all of it.
      lineOperations: [...placeOperations, ...chipOperations, ...textOperations, ...decorationOperations, ...linkAreaOperations],
      missingCharacterCount,
    },
    lineContentWidthPoints: fragmentLeftPoints - lineLeftPoints,
  }
}

export function layOutPapelizPdfExportTextLines(textLinesOptions: PapelizPdfExportTextLinesOptions): PapelizPdfExportLaidOutLine[] {
  const { lineWidthPoints, wrappedLineIndentPoints } = textLinesOptions
  const textTokens = listTextTokens(textLinesOptions)
  const laidOutLines: PapelizPdfExportLaidOutLine[] = []
  let lineTokens: PapelizTextToken[] = []
  let lineFullWidthPoints = 0
  let isWrappedLine = false
  const getLineLeftPoints = () => (isWrappedLine ? wrappedLineIndentPoints : 0)
  // Ends the line; a token that turns out not to fit when the whole line is measured goes back.
  const closeLine = (isLineEndRequired: boolean): number => {
    let returnedTokenCount = 0
    let lineDraft = layOutLine(lineTokens, getLineLeftPoints(), textLinesOptions)
    while (lineTokens.length > 1 && lineDraft.lineContentWidthPoints > lineWidthPoints - getLineLeftPoints() + papelizPdfExportLineWidthTolerancePoints) {
      lineTokens = lineTokens.slice(0, -1)
      returnedTokenCount += 1
      lineDraft = layOutLine(lineTokens, getLineLeftPoints(), textLinesOptions)
    }
    laidOutLines.push(lineDraft.laidOutLine)
    lineTokens = []
    lineFullWidthPoints = 0
    // The next line goes on with the same text unless the text itself ended this one.
    isWrappedLine = !isLineEndRequired || returnedTokenCount > 0
    return returnedTokenCount
  }
  for (let textTokenIndex = 0; textTokenIndex < textTokens.length; ) {
    const textToken = textTokens[textTokenIndex] as PapelizTextToken
    const roomPoints = lineWidthPoints - getLineLeftPoints() + papelizPdfExportLineWidthTolerancePoints
    if (lineTokens.length > 0 && lineFullWidthPoints + textToken.tokenContentWidthPoints > roomPoints) {
      textTokenIndex -= closeLine(false)
      continue
    }
    const tokenText = textToken.tokenPieces.map((tokenPiece) => tokenPiece.tokenPieceText).join('').trim()
    if (lineTokens.length === 0 && textToken.tokenContentWidthPoints > roomPoints && Array.from(papelizPdfExportTextGraphemeSegmenter.segment(tokenText)).length > 1) {
      textTokens.splice(textTokenIndex, 1, ...splitTokenIntoGraphemeTokens(textToken, textLinesOptions))
      continue
    }
    lineTokens.push(textToken)
    lineFullWidthPoints += textToken.tokenFullWidthPoints
    textTokenIndex += 1
    if (textToken.isLineEndRequired) textTokenIndex -= closeLine(true)
  }
  if (lineTokens.length > 0 || laidOutLines.length === 0) closeLine(true)
  return laidOutLines
}
