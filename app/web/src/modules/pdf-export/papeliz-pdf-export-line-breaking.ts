import bidiFactory from 'bidi-js'
import LineBreaker from 'linebreak'
import { getPapelizPdfExportLatinFontFaceKey, type PapelizPdfExportFontStyle } from './papeliz-pdf-export-fonts'
import {
  getPapelizPdfExportGlyphlessText,
  isPapelizPdfExportWordPictureGrapheme,
  papelizPdfExportCharacterPictureFontFaceKey,
  papelizPdfExportRightToLeftTextPattern,
  splitPapelizPdfExportTextIntoPictureUnits,
} from './papeliz-pdf-export-character-pictures'
import type { PapelizPdfExportInlineIconName, PapelizPdfExportLinkTarget } from './papeliz-pdf-export-note-document'
import {
  roundPapelizPdfExportPoints,
  type PapelizPdfExportOpenTypeFeatureSet,
  type PapelizPdfExportLinkAreaOperation,
  type PapelizPdfExportOperationTagging,
  type PapelizPdfExportPageOperation,
  type PapelizPdfExportRectangleOperation,
} from './papeliz-pdf-export-page-layout-plan'
import type { PapelizPdfExportTextMeasurer } from './papeliz-pdf-export-text-measuring'
import type { PapelizPdfExportCharacterPicture } from './papeliz-pdf-export-character-pictures'

// Lines from styled text, as a browser sets them: break opportunities from Unicode's line-break
// rules (UAX #14), never inside a character cluster, no hyphenation, left aligned. A word longer than
// the line breaks between characters, as MD View's `overflow-wrap: break-word`. Each line is then put
// in display order by Unicode's bidirectional algorithm (UAX #9, bidi-js) with a left-to-right base, as
// MD View sets it: a right-to-left run's words go right to left, each word shaped by its font, and
// its brackets mirrored. Its text is still written in reading order, so it copies and reads aloud in
// order. Lines take the CSS inline box heights, so a larger run makes its line taller. A link gets a
// clickable area over each of its line pieces. Each line's drawing is placed from its own top left;
// the pagination moves it onto the page.

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

// One of the note's pictures in a line, its bottom on the baseline, at the size the layout fitted it to.
export interface PapelizPdfExportInlinePictureLook {
  notePictureIndex: number
  pictureWidthPoints: number
  pictureHeightPoints: number
  pictureCornerRadiusPoints: number
  // Its Figure, which holds its description.
  figureStructureElementKey: string
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
  textInlinePicture: PapelizPdfExportInlinePictureLook | null
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
  // How far its drawing reaches from the line's left, wrapped-line indent included (to center or
  // right-align a table cell's lines).
  lineContentWidthPoints: number
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

export interface PapelizPdfExportTextRunStyle {
  textFontStyle: PapelizPdfExportFontStyle
  textSizePoints: number
  textColor: string
  characterSpacingPoints: number
  openTypeFeatureSet: PapelizPdfExportOpenTypeFeatureSet
}

export interface PapelizPdfExportStyledTextOperations {
  textOperations: PapelizPdfExportPageOperation[]
  // Pictures of characters, drawn under their text.
  pictureOperations: PapelizPdfExportPageOperation[]
  textWidthPoints: number
  missingCharacterCount: number
}

// A computer font's upright face drawn as its bold is stroked as wide as browsers thicken it: a 24th
// of the size up to 9 pt, a 32nd from 36 pt, in between in proportion.
export function getPapelizPdfExportThickenedStrokeWidthPoints(textSizePoints: number): number {
  const sizeShare = Math.min(1, Math.max(0, (textSizePoints - 9) / (36 - 9)))
  return textSizePoints * (1 / 24 + sizeShare * (1 / 32 - 1 / 24))
}

// The slant browsers give an upright face drawn as its italic.
const papelizPdfExportSlantDegrees = 12

// Text in one style as page operations from its left edge on its baseline: each piece in the font
// that has it (a bundled file, else a computer font); text no font has as its picture, with the text
// written over it in the outline-free font; without a picture, the `latin` file's empty box. Measured
// as drawn.
export function createPapelizPdfExportStyledTextOperations(
  styledText: string,
  textRunStyle: PapelizPdfExportTextRunStyle,
  textLeftPoints: number,
  textBaselinePoints: number,
  operationTagging: PapelizPdfExportOperationTagging,
  textMeasurer: PapelizPdfExportTextMeasurer,
): PapelizPdfExportStyledTextOperations {
  const { textFontStyle, textSizePoints, textColor, characterSpacingPoints } = textRunStyle
  const textOperations: PapelizPdfExportPageOperation[] = []
  const pictureOperations: PapelizPdfExportPageOperation[] = []
  let missingCharacterCount = 0
  let penLeftPoints = textLeftPoints
  const pushFontText = (fontText: string, fontFaceKey: string, isFontSlanted: boolean, isFontThickened: boolean) => {
    const openTypeFeatureSet = textMeasurer.chooseOpenTypeFeatureSet(fontText, fontFaceKey, textRunStyle.openTypeFeatureSet)
    const fontTextWidthPoints = textMeasurer.measureTextWidthPoints(fontText, fontFaceKey, textSizePoints, characterSpacingPoints, openTypeFeatureSet)
    missingCharacterCount += textMeasurer.countMissingCharacters(fontText, fontFaceKey)
    // A right-to-left word goes into the PDF in display order: the font's layout turns it, or, in a
    // font without layout tables (which shapes nothing), it is given turned.
    const isTurnedHere = papelizPdfExportRightToLeftTextPattern.test(fontText) && !textMeasurer.hasFontLayoutTables(fontFaceKey)
    textOperations.push({
      pageOperationKind: 'text-run',
      textRunText: isTurnedHere ? Array.from(fontText).reverse().join('') : fontText,
      fontFaceKey,
      textSizePoints: roundPapelizPdfExportPoints(textSizePoints),
      textColor,
      characterSpacingPoints: roundPapelizPdfExportPoints(characterSpacingPoints),
      openTypeFeatureSet,
      textLeftPoints: roundPapelizPdfExportPoints(penLeftPoints),
      textBaselinePoints: roundPapelizPdfExportPoints(textBaselinePoints),
      textWidthPoints: roundPapelizPdfExportPoints(fontTextWidthPoints),
      textSynthesis:
        isFontSlanted || isFontThickened
          ? {
              textSlantDegrees: isFontSlanted ? papelizPdfExportSlantDegrees : 0,
              textStrokeWidthPoints: isFontThickened ? roundPapelizPdfExportPoints(getPapelizPdfExportThickenedStrokeWidthPoints(textSizePoints)) : 0,
            }
          : null,
      operationTagging,
    })
    penLeftPoints += fontTextWidthPoints + characterSpacingPoints
  }
  const pushPictureText = (pictureCharactersText: string, characterPicture: PapelizPdfExportCharacterPicture) => {
    const advancePoints = characterPicture.advanceEm * textSizePoints
    const pictureHeightPoints = characterPicture.heightEm * textSizePoints
    const { picturePixelWidth, picturePixelHeight } = characterPicture.pictureFile
    pictureOperations.push({
      pageOperationKind: 'picture',
      pictureSource: { pictureSourceKind: 'character-picture', characterPictureKey: characterPicture.characterPictureKey },
      pictureLeftPoints: roundPapelizPdfExportPoints(penLeftPoints),
      pictureTopPoints: roundPapelizPdfExportPoints(textBaselinePoints - characterPicture.topAboveBaselineEm * textSizePoints),
      pictureWidthPoints: roundPapelizPdfExportPoints((pictureHeightPoints * picturePixelWidth) / picturePixelHeight),
      pictureHeightPoints: roundPapelizPdfExportPoints(pictureHeightPoints),
      pictureCornerRadiusPoints: 0,
      operationTagging: { operationTaggingKind: 'artifact', artifactType: 'Layout' },
    })
    textOperations.push({
      pageOperationKind: 'text-run',
      textRunText: getPapelizPdfExportGlyphlessText(pictureCharactersText),
      fontFaceKey: papelizPdfExportCharacterPictureFontFaceKey,
      textSizePoints: roundPapelizPdfExportPoints(textSizePoints),
      textColor,
      characterSpacingPoints: 0,
      openTypeFeatureSet: 'no-ligatures',
      textLeftPoints: roundPapelizPdfExportPoints(penLeftPoints),
      textBaselinePoints: roundPapelizPdfExportPoints(textBaselinePoints),
      textWidthPoints: roundPapelizPdfExportPoints(advancePoints),
      textSynthesis: null,
      operationTagging,
    })
    penLeftPoints += advancePoints + characterSpacingPoints
  }
  const latinFontFaceKey = getPapelizPdfExportLatinFontFaceKey(textFontStyle)
  for (const fontPiece of textMeasurer.splitTextIntoFontPieces(styledText, textFontStyle)) {
    if (fontPiece.fontFaceKey !== null) {
      pushFontText(fontPiece.fontPieceText, fontPiece.fontFaceKey, fontPiece.isFontPieceSlanted, fontPiece.isFontPieceThickened)
      continue
    }
    let unpicturedText = ''
    const pushUnpicturedText = () => {
      if (unpicturedText.length > 0) pushFontText(unpicturedText, latinFontFaceKey, false, false)
      unpicturedText = ''
    }
    for (const pictureUnit of splitPapelizPdfExportTextIntoPictureUnits(fontPiece.fontPieceText)) {
      // A word drawn as one picture; failing that, its characters one by one.
      const unitCharacterPicture = textMeasurer.getCharacterPicture(pictureUnit, textColor, textFontStyle)
      const pictureTexts = unitCharacterPicture === null ? Array.from(papelizPdfExportTextGraphemeSegmenter.segment(pictureUnit), ({ segment }) => segment) : [pictureUnit]
      for (const pictureText of pictureTexts) {
        const characterPicture = unitCharacterPicture ?? textMeasurer.getCharacterPicture(pictureText, textColor, textFontStyle)
        if (characterPicture === null) {
          unpicturedText += pictureText
          continue
        }
        pushUnpicturedText()
        pushPictureText(pictureText, characterPicture)
      }
    }
    pushUnpicturedText()
  }
  return { textOperations, pictureOperations, textWidthPoints: penLeftPoints - textLeftPoints, missingCharacterCount }
}

// Text in one style on one line, in display order (a footer's note name).
export function createPapelizPdfExportDisplayTextOperations(
  displayText: string,
  textRunStyle: PapelizPdfExportTextRunStyle,
  textLeftPoints: number,
  textBaselinePoints: number,
  operationTagging: PapelizPdfExportOperationTagging,
  textMeasurer: PapelizPdfExportTextMeasurer,
): PapelizPdfExportStyledTextOperations {
  const displayFragments = orderLineFragmentsForDisplay([{ styledPieceIndex: 0, fragmentText: displayText, isStyledPieceStart: true, isStyledPieceEnd: true }])
  const orderedTextOperations: Array<{ logicalFragmentOrder: number; textOperations: PapelizPdfExportPageOperation[] }> = []
  const pictureOperations: PapelizPdfExportPageOperation[] = []
  let missingCharacterCount = 0
  let penLeftPoints = textLeftPoints
  for (const displayFragment of displayFragments) {
    const fragmentOperations = createPapelizPdfExportStyledTextOperations(displayFragment.fragmentText, textRunStyle, penLeftPoints, textBaselinePoints, operationTagging, textMeasurer)
    orderedTextOperations.push({ logicalFragmentOrder: displayFragment.logicalFragmentOrder, textOperations: fragmentOperations.textOperations })
    pictureOperations.push(...fragmentOperations.pictureOperations)
    missingCharacterCount += fragmentOperations.missingCharacterCount
    penLeftPoints += fragmentOperations.textWidthPoints
  }
  return {
    textOperations: orderedTextOperations
      .sort((firstOrderedOperations, secondOrderedOperations) => firstOrderedOperations.logicalFragmentOrder - secondOrderedOperations.logicalFragmentOrder)
      .flatMap(({ textOperations }) => textOperations),
    pictureOperations,
    textWidthPoints: penLeftPoints - textLeftPoints,
    missingCharacterCount,
  }
}

// Text in one style, measured as drawn. An icon or a picture is as wide as its box.
function measureStyledTextWidthPoints(styledText: string, textStyle: PapelizPdfExportResolvedTextStyle, textMeasurer: PapelizPdfExportTextMeasurer): number {
  if (textStyle.textInlineIcon !== null) return getPapelizPdfExportInlineIconWidthPoints(textStyle.textInlineIcon, textStyle.textSizePoints)
  if (textStyle.textInlinePicture !== null) return textStyle.textInlinePicture.pictureWidthPoints
  return createPapelizPdfExportStyledTextOperations(styledText, textStyle, 0, 0, { operationTaggingKind: 'artifact', artifactType: 'Layout' }, textMeasurer).textWidthPoints
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

// A line fragment placed in display order: a piece of one style at one bidirectional level.
interface PapelizDisplayLineFragment extends PapelizLineFragment {
  // Its place in reading order, in which its text is written.
  logicalFragmentOrder: number
  // A chip's padding goes on the outer edges of its displayed pieces.
  hasLeftChipPadding: boolean
  hasRightChipPadding: boolean
}

interface PapelizBidiLineChunk extends PapelizDisplayLineFragment {
  bidiLevel: number
  isWordChunk: boolean
}

let papelizPdfExportBidi: ReturnType<typeof bidiFactory> | null = null

// A line's fragments in the order they show; a line without right-to-left text keeps its order.
// Left-to-right text keeps one chunk per fragment and
// level; right-to-left text splits into its words and its other characters, each mirrored where it
// has a mirror ("(" for ")"). Then the runs at each level from the highest down to the lowest odd one
// are reversed (UAX #9 rule L2).
function orderLineFragmentsForDisplay(lineFragments: readonly PapelizLineFragment[]): PapelizDisplayLineFragment[] {
  const lineText = lineFragments.map((lineFragment) => lineFragment.fragmentText).join('')
  if (!papelizPdfExportRightToLeftTextPattern.test(lineText)) {
    return lineFragments.map((lineFragment, lineFragmentIndex) => ({
      ...lineFragment,
      logicalFragmentOrder: lineFragmentIndex,
      hasLeftChipPadding: lineFragment.isStyledPieceStart,
      hasRightChipPadding: lineFragment.isStyledPieceEnd,
    }))
  }
  papelizPdfExportBidi ??= bidiFactory()
  const lineBidi = papelizPdfExportBidi
  const { levels: bidiLevels } = lineBidi.getEmbeddingLevels(lineText, 'ltr')
  const lineChunks: PapelizBidiLineChunk[] = []
  let fragmentStartOffset = 0
  for (const lineFragment of lineFragments) {
    const fragmentChunks: PapelizBidiLineChunk[] = []
    for (const { segment: graphemeText, index: graphemeOffset } of papelizPdfExportTextGraphemeSegmenter.segment(lineFragment.fragmentText)) {
      const bidiLevel = bidiLevels[fragmentStartOffset + graphemeOffset] ?? 0
      const isRightToLeft = bidiLevel % 2 === 1
      const isWordGrapheme = isRightToLeft && isPapelizPdfExportWordPictureGrapheme(graphemeText)
      const displayedGraphemeText =
        isRightToLeft && !isWordGrapheme ? Array.from(graphemeText, (graphemeCharacter) => lineBidi.getMirroredCharacter(graphemeCharacter) ?? graphemeCharacter).join('') : graphemeText
      const lastFragmentChunk = fragmentChunks.at(-1)
      const joinsLastChunk = lastFragmentChunk !== undefined && lastFragmentChunk.bidiLevel === bidiLevel && (!isRightToLeft || (isWordGrapheme && lastFragmentChunk.isWordChunk))
      if (joinsLastChunk) {
        lastFragmentChunk.fragmentText += displayedGraphemeText
        continue
      }
      fragmentChunks.push({
        ...lineFragment,
        fragmentText: displayedGraphemeText,
        isStyledPieceStart: false,
        isStyledPieceEnd: false,
        logicalFragmentOrder: lineChunks.length + fragmentChunks.length,
        hasLeftChipPadding: false,
        hasRightChipPadding: false,
        bidiLevel,
        isWordChunk: isWordGrapheme,
      })
    }
    const firstFragmentChunk = fragmentChunks[0]
    const lastFragmentChunk = fragmentChunks.at(-1)
    if (firstFragmentChunk !== undefined) firstFragmentChunk.isStyledPieceStart = lineFragment.isStyledPieceStart
    if (lastFragmentChunk !== undefined) lastFragmentChunk.isStyledPieceEnd = lineFragment.isStyledPieceEnd
    lineChunks.push(...fragmentChunks)
    fragmentStartOffset += lineFragment.fragmentText.length
  }
  const highestBidiLevel = Math.max(...lineChunks.map((lineChunk) => lineChunk.bidiLevel))
  const lowestOddBidiLevel = Math.min(...lineChunks.map((lineChunk) => (lineChunk.bidiLevel % 2 === 1 ? lineChunk.bidiLevel : lineChunk.bidiLevel + 1)))
  for (let reversedBidiLevel = highestBidiLevel; reversedBidiLevel >= lowestOddBidiLevel; reversedBidiLevel -= 1) {
    for (let runStartIndex = 0; runStartIndex < lineChunks.length; ) {
      if ((lineChunks[runStartIndex]?.bidiLevel ?? 0) < reversedBidiLevel) {
        runStartIndex += 1
        continue
      }
      let runEndIndex = runStartIndex
      while (runEndIndex + 1 < lineChunks.length && (lineChunks[runEndIndex + 1]?.bidiLevel ?? 0) >= reversedBidiLevel) runEndIndex += 1
      lineChunks.splice(runStartIndex, runEndIndex - runStartIndex + 1, ...lineChunks.slice(runStartIndex, runEndIndex + 1).reverse())
      runStartIndex = runEndIndex + 1
    }
  }
  // A chip's padding at the outer edges of its piece's chunks as they show.
  const displayIndexesByStyledPiece = new Map<number, number[]>()
  lineChunks.forEach((lineChunk, displayIndex) => displayIndexesByStyledPiece.set(lineChunk.styledPieceIndex, [...(displayIndexesByStyledPiece.get(lineChunk.styledPieceIndex) ?? []), displayIndex]))
  for (const [styledPieceIndex, displayIndexes] of displayIndexesByStyledPiece) {
    const pieceChunks = lineChunks.filter((lineChunk) => lineChunk.styledPieceIndex === styledPieceIndex)
    const hasPieceStart = pieceChunks.some((lineChunk) => lineChunk.isStyledPieceStart)
    const hasPieceEnd = pieceChunks.some((lineChunk) => lineChunk.isStyledPieceEnd)
    const leftmostChunk = lineChunks[displayIndexes[0] ?? 0]
    const rightmostChunk = lineChunks[displayIndexes.at(-1) ?? 0]
    if (leftmostChunk !== undefined) leftmostChunk.hasLeftChipPadding = hasPieceStart
    if (rightmostChunk !== undefined) rightmostChunk.hasRightChipPadding = hasPieceEnd
  }
  return lineChunks
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
  const { ascentEm, descentEm } = textMeasurer.getFontFaceMetrics(getPapelizPdfExportLatinFontFaceKey(fontStyle))
  const halfLeadingPoints = (lineHeightRatio * textSizePoints - (ascentEm + descentEm) * textSizePoints) / 2
  return {
    aboveBaselinePoints: halfLeadingPoints + ascentEm * textSizePoints + baselineShiftPoints,
    belowBaselinePoints: halfLeadingPoints + descentEm * textSizePoints - baselineShiftPoints,
  }
}

// Where a chip's ground sits, from the baseline: around the text's own height, or centered on it at
// its fixed height (a tag).
function measureChipExtent(textStyle: PapelizPdfExportResolvedTextStyle, textChip: PapelizPdfExportTextChipLook, textMeasurer: PapelizPdfExportTextMeasurer): PapelizInlineBoxExtent {
  const { ascentEm, descentEm } = textMeasurer.getFontFaceMetrics(getPapelizPdfExportLatinFontFaceKey(textStyle.textFontStyle))
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
  const lineFragments = orderLineFragmentsForDisplay(buildLineFragments(lineTokens))
  const strutExtent = measureInlineBoxExtent(lineStrut.strutFontStyle, lineStrut.strutTextSizePoints, lineStrut.lineHeightRatio, 0, textMeasurer)
  let lineAbovePoints = strutExtent.aboveBaselinePoints
  let lineBelowPoints = strutExtent.belowBaselinePoints
  for (const lineFragment of lineFragments) {
    const fragmentStyle = getPieceStyle(styledTextPieces, lineFragment.styledPieceIndex)
    if (fragmentStyle === null) continue
    const fragmentExtent = measureInlineBoxExtent(fragmentStyle.textFontStyle, fragmentStyle.textSizePoints, lineStrut.lineHeightRatio, fragmentStyle.baselineShiftPoints, textMeasurer)
    lineAbovePoints = Math.max(lineAbovePoints, fragmentExtent.aboveBaselinePoints, (fragmentStyle.textInlinePicture?.pictureHeightPoints ?? 0) + fragmentStyle.baselineShiftPoints)
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
  // Each with its fragment's place in reading order, the order the text is written in.
  const orderedTextOperations: Array<{ logicalFragmentOrder: number; textOperation: PapelizPdfExportPageOperation }> = []
  const decorationOperations: PapelizPdfExportPageOperation[] = []
  let lastChipOperation: { styledPieceIndex: number; chipRectangleOperation: PapelizPdfExportRectangleOperation } | null = null
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
    if (lineFragment.hasLeftChipPadding) fragmentLeftPoints += chipPaddingPoints
    const textStartPoints = fragmentLeftPoints
    const pushTextOperation = (textOperation: PapelizPdfExportPageOperation) => orderedTextOperations.push({ logicalFragmentOrder: lineFragment.logicalFragmentOrder, textOperation })
    const textBaselinePoints = lineBaselinePoints - fragmentStyle.baselineShiftPoints
    const { textInlineIcon, textInlinePicture, textLink } = fragmentStyle
    if (textInlinePicture !== null) {
      pushTextOperation({
        pageOperationKind: 'picture',
        pictureSource: { pictureSourceKind: 'note-picture', notePictureIndex: textInlinePicture.notePictureIndex },
        pictureLeftPoints: roundPapelizPdfExportPoints(textStartPoints),
        pictureTopPoints: roundPapelizPdfExportPoints(textBaselinePoints - textInlinePicture.pictureHeightPoints),
        pictureWidthPoints: roundPapelizPdfExportPoints(textInlinePicture.pictureWidthPoints),
        pictureHeightPoints: roundPapelizPdfExportPoints(textInlinePicture.pictureHeightPoints),
        pictureCornerRadiusPoints: roundPapelizPdfExportPoints(textInlinePicture.pictureCornerRadiusPoints),
        operationTagging: { operationTaggingKind: 'structure', structureElementKey: textInlinePicture.figureStructureElementKey },
      })
      fragmentLeftPoints += textInlinePicture.pictureWidthPoints
    }
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
    const isFragmentText = textInlineIcon === null && textInlinePicture === null
    if (isFragmentText && lineFragment.fragmentText.length > 0) {
      const fragmentOperations = createPapelizPdfExportStyledTextOperations(
        lineFragment.fragmentText,
        fragmentStyle,
        fragmentLeftPoints,
        textBaselinePoints,
        { operationTaggingKind: 'structure', structureElementKey: textLink?.linkStructureElementKey ?? structureElementKey },
        textMeasurer,
      )
      chipOperations.push(...fragmentOperations.pictureOperations)
      fragmentOperations.textOperations.forEach(pushTextOperation)
      missingCharacterCount += fragmentOperations.missingCharacterCount
      fragmentLeftPoints += fragmentOperations.textWidthPoints
    }
    const textEndPoints = isFragmentText ? fragmentLeftPoints - fragmentStyle.characterSpacingPoints : fragmentLeftPoints
    if (lineFragment.hasRightChipPadding) fragmentLeftPoints += chipPaddingPoints
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
    if (fragmentStyle.textChip !== null && lastChipOperation?.styledPieceIndex === lineFragment.styledPieceIndex) {
      // The next displayed piece of the same chip widens its ground.
      lastChipOperation.chipRectangleOperation.rectangleWidthPoints = roundPapelizPdfExportPoints(fragmentLeftPoints - lastChipOperation.chipRectangleOperation.rectangleLeftPoints)
    } else if (fragmentStyle.textChip !== null) {
      const chipExtent = measureChipExtent(fragmentStyle, fragmentStyle.textChip, textMeasurer)
      const chipRectangleOperation: PapelizPdfExportRectangleOperation = {
        pageOperationKind: 'rectangle',
        rectangleLeftPoints: roundPapelizPdfExportPoints(chipStartPoints),
        rectangleTopPoints: roundPapelizPdfExportPoints(lineBaselinePoints - chipExtent.aboveBaselinePoints),
        rectangleWidthPoints: roundPapelizPdfExportPoints(fragmentLeftPoints - chipStartPoints),
        rectangleHeightPoints: roundPapelizPdfExportPoints(chipExtent.aboveBaselinePoints + chipExtent.belowBaselinePoints),
        rectangleCornerRadiusPoints: roundPapelizPdfExportPoints(fragmentStyle.textChip.chipCornerRadiusPoints),
        rectangleFillColor: fragmentStyle.textChip.chipGroundColor,
        rectangleStrokeColor: null,
        rectangleStrokeWidthPoints: 0,
      }
      chipOperations.push(chipRectangleOperation)
      lastChipOperation = { styledPieceIndex: lineFragment.styledPieceIndex, chipRectangleOperation }
    }
    if (fragmentStyle.textChip === null) lastChipOperation = null
    const fragmentFontFaceMetrics = textMeasurer.getFontFaceMetrics(getPapelizPdfExportLatinFontFaceKey(fragmentStyle.textFontStyle))
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
      lineContentWidthPoints: roundPapelizPdfExportPoints(fragmentLeftPoints),
      // Places first, grounds, then text, then the lines through and under it and the icons, then
      // the links' areas over all of it.
      lineOperations: [
        ...placeOperations,
        ...chipOperations,
        ...orderedTextOperations.sort((firstOrderedOperation, secondOrderedOperation) => firstOrderedOperation.logicalFragmentOrder - secondOrderedOperation.logicalFragmentOrder).map(({ textOperation }) => textOperation),
        ...decorationOperations,
        ...linkAreaOperations,
      ],
      missingCharacterCount,
    },
    lineContentWidthPoints: fragmentLeftPoints - lineLeftPoints,
  }
}

export interface PapelizPdfExportTextContentWidths {
  // The widest word: the narrowest the text can be set without breaking inside a word.
  minimumContentWidthPoints: number
  // The widest line when nothing wraps.
  maximumContentWidthPoints: number
}

// A browser's min-content and max-content widths of the text, which size a table's columns.
export function measurePapelizPdfExportTextContentWidths(textLinesOptions: PapelizPdfExportTextLinesOptions): PapelizPdfExportTextContentWidths {
  let minimumContentWidthPoints = 0
  let maximumContentWidthPoints = 0
  let lineFullWidthPoints = 0
  for (const textToken of listTextTokens(textLinesOptions)) {
    minimumContentWidthPoints = Math.max(minimumContentWidthPoints, textToken.tokenContentWidthPoints)
    maximumContentWidthPoints = Math.max(maximumContentWidthPoints, lineFullWidthPoints + textToken.tokenContentWidthPoints)
    lineFullWidthPoints = textToken.isLineEndRequired ? 0 : lineFullWidthPoints + textToken.tokenFullWidthPoints
  }
  return { minimumContentWidthPoints, maximumContentWidthPoints }
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
