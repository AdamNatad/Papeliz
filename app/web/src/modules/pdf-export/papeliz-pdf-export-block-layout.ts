import {
  papelizExportBodyLineHeight,
  papelizExportBodyTextSizePoints,
  papelizExportPrintColorsByToken,
  papelizExportPrintLineHeights,
  papelizExportPrintSpacingInPoints,
  papelizExportPrintTextSizesInPoints,
  scalePapelizMdViewPixelsToPrintPoints,
} from '../export-print-style/papeliz-export-print-style'
import {
  choosePapelizPdfExportFontWeight,
  getPapelizPdfExportBlockFontWeight,
  getPapelizPdfExportFontFaceKey,
  getPapelizPdfExportNoteFontFamilyName,
  papelizPdfExportCodeBoxFontStyle,
  papelizPdfExportPropertyNameFontWeight,
  resolvePapelizPdfExportTextRunFontStyle,
  splitPapelizPdfExportTextBySubset,
  type PapelizPdfExportFontFamilyName,
  type PapelizPdfExportFontStyle,
  type PapelizPdfExportFontWeight,
} from './papeliz-pdf-export-fonts'
import {
  layOutPapelizPdfExportTextLines,
  type PapelizPdfExportLaidOutLine,
  type PapelizPdfExportLineStrut,
  type PapelizPdfExportResolvedTextStyle,
  type PapelizPdfExportStyledTextPiece,
} from './papeliz-pdf-export-line-breaking'
import type {
  PapelizPdfExportFootnote,
  PapelizPdfExportHeadingLevel,
  PapelizPdfExportInlineRun,
  PapelizPdfExportListItem,
  PapelizPdfExportListKind,
  PapelizPdfExportNoteBlock,
  PapelizPdfExportNoteDocument,
  PapelizPdfExportNoteProperty,
  PapelizPdfExportTextRunLink,
  PapelizPdfExportTextRunLook,
} from './papeliz-pdf-export-note-document'
import {
  roundPapelizPdfExportPoints,
  type PapelizPdfExportBookmark,
  type PapelizPdfExportPageOperation,
  type PapelizPdfExportStructureElement,
  type PapelizPdfExportStructureRole,
} from './papeliz-pdf-export-page-layout-plan'
import type { PapelizPdfExportTextMeasurer } from './papeliz-pdf-export-text-measuring'

// Each block of the note as lines in MD View's print sizes (the shared print style), with the spaces
// around it, its box, and the rules for where a page may break inside it. Blocks inside lists, quotes
// and footnotes become blocks of their own, indented to their place: a list item's bullet, number or
// task box sits beside its first line, and a quote's bar beside every page's piece of it. The
// structure a screen reader follows (lists, quotes, links, footnotes) and the bookmarks come out of
// the same walk.

export interface PapelizPdfExportBlockBox {
  boxPaddingTopPoints: number
  boxPaddingBottomPoints: number
  boxPaddingHorizontalPoints: number
  boxGroundColor: string
  boxBorderColor: string
  boxBorderWidthPoints: number
  boxCornerRadiusPoints: number
}

// The bar of a quote the block sits in, from the content area's left edge.
export interface PapelizPdfExportQuoteBar {
  quoteKey: string
  quoteBarLeftPoints: number
}

export interface PapelizPdfExportLaidOutBlock {
  // From the content area's left edge, and the room it takes from there.
  blockLeftPoints: number
  blockWidthPoints: number
  blockSpaceAbovePoints: number
  blockSpaceBelowPoints: number
  blockLines: PapelizPdfExportLaidOutLine[]
  // Drawn behind each page's piece of the block, with full padding.
  blockBox: PapelizPdfExportBlockBox | null
  // The quotes the block sits in, outermost first.
  blockQuoteBars: PapelizPdfExportQuoteBar[]
  // A heading moves to the next page with the start of what follows it.
  isBlockKeptWithNext: boolean
  // A block of at most this many lines never splits.
  blockKeptWholeLineCount: number
  // Lines left at a page's end and carried to the next page's start when the block splits.
  minimumLinesBeforePageBreak: number
  minimumLinesAfterPageBreak: number
  // A rule is left out where it would open a page.
  isBlockLeftOutAtPageTop: boolean
}

export interface PapelizPdfExportLaidOutNote {
  laidOutBlocks: PapelizPdfExportLaidOutBlock[]
  // In reading order, each after its parent.
  structureElements: PapelizPdfExportStructureElement[]
  bookmarks: PapelizPdfExportBookmark[]
  missingCharacterCount: number
}

interface PapelizPdfExportHeadingPrintLook {
  headingTextSizePoints: number
  headingLineHeightRatio: number
  headingSpaceAbovePoints: number
  headingSpaceBelowPoints: number
}

const { heading1TextSizePoints, heading2TextSizePoints, heading3TextSizePoints, heading4To6TextSizePoints } = papelizExportPrintTextSizesInPoints
const { heading1LineHeight, heading2LineHeight, heading3LineHeight, codeBlockLineHeight } = papelizExportPrintLineHeights
const papelizPdfExportHeading4To6PrintLook: PapelizPdfExportHeadingPrintLook = {
  headingTextSizePoints: heading4To6TextSizePoints,
  headingLineHeightRatio: papelizExportBodyLineHeight,
  headingSpaceAbovePoints: papelizExportPrintSpacingInPoints.heading4To6SpaceAbovePoints,
  headingSpaceBelowPoints: papelizExportPrintSpacingInPoints.heading4To6SpaceBelowPoints,
}
const papelizPdfExportHeadingPrintLooks: Readonly<Record<PapelizPdfExportHeadingLevel, PapelizPdfExportHeadingPrintLook>> = {
  1: { headingTextSizePoints: heading1TextSizePoints, headingLineHeightRatio: heading1LineHeight, headingSpaceAbovePoints: 0, headingSpaceBelowPoints: papelizExportPrintSpacingInPoints.heading1SpaceBelowPoints },
  2: {
    headingTextSizePoints: heading2TextSizePoints,
    headingLineHeightRatio: heading2LineHeight,
    headingSpaceAbovePoints: papelizExportPrintSpacingInPoints.heading2SpaceAbovePoints,
    headingSpaceBelowPoints: papelizExportPrintSpacingInPoints.heading2SpaceBelowPoints,
  },
  3: {
    headingTextSizePoints: heading3TextSizePoints,
    headingLineHeightRatio: heading3LineHeight,
    headingSpaceAbovePoints: papelizExportPrintSpacingInPoints.heading3SpaceAbovePoints,
    headingSpaceBelowPoints: papelizExportPrintSpacingInPoints.heading3SpaceBelowPoints,
  },
  4: papelizPdfExportHeading4To6PrintLook,
  5: papelizPdfExportHeading4To6PrintLook,
  6: papelizPdfExportHeading4To6PrintLook,
}

// MD View's first heading is set 0.02em tighter.
const papelizPdfExportHeading1LetterSpacingEm = -0.02
// Superscript sits a third of the text above the baseline, subscript a fifth below, as browsers set them.
const papelizPdfExportSuperscriptShiftEm = 1 / 3
const papelizPdfExportSubscriptShiftEm = -1 / 5
// Paragraph lines: at least two at a page's end and two at the next page's start.
const papelizPdfExportParagraphLinesAtPageBreak = 2
// Code: 12 lines or fewer stay on one page; a longer box leaves at least three lines on each side.
const papelizPdfExportCodeBoxKeptWholeLineCount = 12
const papelizPdfExportCodeBoxLinesAtPageBreak = 3
// A wrapped code line goes on two characters in.
const papelizPdfExportCodeBoxWrappedLineIndentCharacters = '  '

// MD View's lists (papeliz-webapp.css): a task item has 2px below it, a list inside an item 4px above.
const papelizPdfExportTaskListItemSpaceBelowPoints = scalePapelizMdViewPixelsToPrintPoints(2)
const papelizPdfExportNestedListSpaceAbovePoints = scalePapelizMdViewPixelsToPrintPoints(4)
// Bullets by depth: a disc, a ring, a square, then again. Sizes and places in ems of the item's text,
// as a browser draws its list markers.
type PapelizPdfExportBulletShape = 'disc' | 'ring' | 'square'
const papelizPdfExportBulletShapesByDepth: readonly PapelizPdfExportBulletShape[] = ['disc', 'ring', 'square']
const papelizPdfExportBulletSizeEm = 0.32
const papelizPdfExportBulletMiddleLeftOfTextEm = 0.62
const papelizPdfExportBulletMiddleAboveBaselineEm = 0.31
const papelizPdfExportRingBulletLineWidthEm = 0.07
// A task's box: 18px with a 1.6px border and 6px corners, its middle on the text's middle (1px lower,
// as MD View sets it), the item's text 30px in. Done, it is blue with MD View's white check.
const papelizPdfExportTaskBoxSizePoints = scalePapelizMdViewPixelsToPrintPoints(18)
const papelizPdfExportTaskBoxBorderWidthPoints = scalePapelizMdViewPixelsToPrintPoints(1.6)
const papelizPdfExportTaskBoxCornerRadiusPoints = scalePapelizMdViewPixelsToPrintPoints(6)
const papelizPdfExportTaskBoxMiddleAboveBaselineEm = 0.32
const papelizPdfExportTaskBoxLowerPoints = scalePapelizMdViewPixelsToPrintPoints(1)
const papelizPdfExportTaskCheckPathData = 'M20 6 9 17l-5-5'
const papelizPdfExportTaskCheckSizePoints = scalePapelizMdViewPixelsToPrintPoints(12)
const papelizPdfExportTaskCheckStrokeWidth = 3.2
const papelizPdfExportIconViewBoxSize = 24
// A quote's bar reaches 2px past its first and last lines, as MD View's padding.
export const papelizPdfExportQuoteBarOverhangPoints = scalePapelizMdViewPixelsToPrintPoints(2)
// A property chip: 13px text at 1.4 line height, at least 28px tall, 2px × 11px padding, 6px between
// its name and values and between chips; its name may take at most this share of a wrapped chip.
const papelizPdfExportPropertyLineHeight = 1.4
const papelizPdfExportPropertyChipHeightPoints = scalePapelizMdViewPixelsToPrintPoints(28)
const papelizPdfExportPropertyChipPaddingVerticalPoints = scalePapelizMdViewPixelsToPrintPoints(2)
const papelizPdfExportPropertyChipPaddingHorizontalPoints = scalePapelizMdViewPixelsToPrintPoints(11)
const papelizPdfExportPropertyChipGapPoints = scalePapelizMdViewPixelsToPrintPoints(6)
const papelizPdfExportPropertyNameShareOfWrappedChip = 0.4

const papelizPdfExportCodeBoxLook: PapelizPdfExportBlockBox = {
  boxPaddingTopPoints: papelizExportPrintSpacingInPoints.codeBlockPaddingVerticalPoints,
  boxPaddingBottomPoints: papelizExportPrintSpacingInPoints.codeBlockPaddingVerticalPoints,
  boxPaddingHorizontalPoints: papelizExportPrintSpacingInPoints.codeBlockPaddingHorizontalPoints,
  boxGroundColor: papelizExportPrintColorsByToken['--color-papeliz-surface-soft'],
  boxBorderColor: papelizExportPrintColorsByToken['--color-papeliz-line'],
  boxBorderWidthPoints: papelizExportPrintSpacingInPoints.hairlineWidthPoints,
  boxCornerRadiusPoints: scalePapelizMdViewPixelsToPrintPoints(14),
}

const papelizPdfExportInkColor = papelizExportPrintColorsByToken['--color-papeliz-ink']

// Where a block sits: its left edge and room, the color and size its text inherits, the quotes around
// it, and the structure element it belongs to.
interface PapelizPdfExportBlockPlace {
  placeLeftPoints: number
  placeWidthPoints: number
  placeTextColor: string | null
  placeTextSizePoints: number
  placeQuoteBars: readonly PapelizPdfExportQuoteBar[]
  parentStructureElementKey: string | null
  // MD View sets a task item's paragraphs without gaps (`li.task-list-item > p`).
  isInsideTaskListItem: boolean
  // How many lists hold this place (a list here takes the next bullet), and whether it is a list
  // item's own body (a list here is nested, with 4px above it).
  placeListDepth: number
  isListItemPlace: boolean
}

interface PapelizPdfExportNoteLayout {
  noteFontFamilyName: PapelizPdfExportFontFamilyName
  textMeasurer: PapelizPdfExportTextMeasurer
  laidOutBlocks: PapelizPdfExportLaidOutBlock[]
  structureElements: PapelizPdfExportStructureElement[]
  linkStructureElementKeys: Set<string>
  bookmarks: PapelizPdfExportBookmark[]
  // The levels of the headings the next bookmark may hang under, outermost first.
  openHeadingLevels: PapelizPdfExportHeadingLevel[]
  missingCharacterCount: number
  nextStructureElementNumber: number
  nextQuoteNumber: number
}

interface PapelizPdfExportBlockTextLook {
  noteFontFamilyName: PapelizPdfExportFontFamilyName
  blockFontWeight: PapelizPdfExportFontWeight
  blockTextSizePoints: number
  blockTextColor: string
  blockLetterSpacingPoints: number
}

function addStructureElement(structureRole: PapelizPdfExportStructureRole, parentStructureElementKey: string | null, noteLayout: PapelizPdfExportNoteLayout): string {
  const structureElementKey = `structure-${noteLayout.nextStructureElementNumber}`
  noteLayout.nextStructureElementNumber += 1
  noteLayout.structureElements.push({ structureElementKey, structureRole, parentStructureElementKey })
  return structureElementKey
}

// A link's own structure element, inside the block that shows it; once per link.
function getLinkStructureElementKey(textRunLink: PapelizPdfExportTextRunLink, blockStructureElementKey: string, noteLayout: PapelizPdfExportNoteLayout): string {
  const linkStructureElementKey = `link-${textRunLink.noteLinkNumber}`
  if (!noteLayout.linkStructureElementKeys.has(linkStructureElementKey)) {
    noteLayout.linkStructureElementKeys.add(linkStructureElementKey)
    noteLayout.structureElements.push({ structureElementKey: linkStructureElementKey, structureRole: 'Link', parentStructureElementKey: blockStructureElementKey })
  }
  return linkStructureElementKey
}

function resolveTextRunStyle(
  textRunLook: PapelizPdfExportTextRunLook,
  textRunLink: PapelizPdfExportTextRunLink | null,
  blockTextLook: PapelizPdfExportBlockTextLook,
  blockStructureElementKey: string,
  noteLayout: PapelizPdfExportNoteLayout,
): PapelizPdfExportResolvedTextStyle {
  const textSizePoints = textRunLook.textRunFixedSizePoints ?? blockTextLook.blockTextSizePoints * textRunLook.textRunSizeRatio
  const textColor = textRunLook.textRunColor ?? blockTextLook.blockTextColor
  const surroundingTextSizePoints = textRunLook.textRunBaselineShift === null ? textSizePoints : textSizePoints / 0.83
  const { textRunChip } = textRunLook
  return {
    textFontStyle: resolvePapelizPdfExportTextRunFontStyle(blockTextLook.noteFontFamilyName, blockTextLook.blockFontWeight, textRunLook),
    textSizePoints,
    textColor,
    characterSpacingPoints: blockTextLook.blockLetterSpacingPoints,
    openTypeFeatureSet: textRunLook.isTextRunMonospace ? 'no-ligatures' : 'standard',
    textUnderline: textRunLook.textRunUnderline === null ? null : { underlineColor: textRunLook.textRunUnderline.underlineColor ?? textColor, isUnderlineDashed: textRunLook.textRunUnderline.isUnderlineDashed },
    isTextStruck: textRunLook.isTextRunStruck,
    baselineShiftPoints:
      textRunLook.textRunBaselineShift === 'superscript'
        ? papelizPdfExportSuperscriptShiftEm * surroundingTextSizePoints
        : textRunLook.textRunBaselineShift === 'subscript'
          ? papelizPdfExportSubscriptShiftEm * surroundingTextSizePoints
          : 0,
    textChip:
      textRunChip === null
        ? null
        : {
            chipGroundColor: textRunChip.chipGroundColor,
            chipPaddingHorizontalPoints: textRunChip.chipPaddingHorizontalEm * textSizePoints,
            chipPaddingVerticalPoints: textRunChip.chipPaddingVerticalEm * textSizePoints,
            chipCornerRadiusPoints: textRunChip.chipCornerRadiusEm * textSizePoints,
            chipHeightPoints: textRunChip.chipHeightEm === null ? null : textRunChip.chipHeightEm * textSizePoints,
          },
    textLink:
      textRunLink === null
        ? null
        : {
            linkStructureElementKey: getLinkStructureElementKey(textRunLink, blockStructureElementKey, noteLayout),
            linkTarget: textRunLink.noteLinkTarget,
            linkDescription: textRunLink.noteLinkDescription,
          },
    textDestinationName: null,
    textInlineIcon: null,
  }
}

// An icon takes the place of one object character, which breaks like a picture in a line.
const papelizPdfExportInlineIconStandInText = '￼'

function buildStyledTextPieces(
  inlineRuns: readonly PapelizPdfExportInlineRun[],
  blockTextLook: PapelizPdfExportBlockTextLook,
  blockStructureElementKey: string,
  noteLayout: PapelizPdfExportNoteLayout,
): PapelizPdfExportStyledTextPiece[] {
  return inlineRuns.map((inlineRun): PapelizPdfExportStyledTextPiece => {
    if (inlineRun.inlineRunKind === 'line-break') return { styledPieceKind: 'line-break' }
    const pieceStyle = resolveTextRunStyle(inlineRun.textRunLook, inlineRun.textRunLink, blockTextLook, blockStructureElementKey, noteLayout)
    if (inlineRun.inlineRunKind === 'icon') {
      return { styledPieceKind: 'text', pieceText: papelizPdfExportInlineIconStandInText, pieceStyle: { ...pieceStyle, textInlineIcon: { inlineIconName: inlineRun.inlineIconName } } }
    }
    return { styledPieceKind: 'text', pieceText: inlineRun.textRunText, pieceStyle: { ...pieceStyle, textDestinationName: inlineRun.textRunDestinationName } }
  })
}

function countMissingCharacters(laidOutLines: readonly PapelizPdfExportLaidOutLine[]): number {
  return laidOutLines.reduce((missingCharacterCount, laidOutLine) => missingCharacterCount + laidOutLine.missingCharacterCount, 0)
}

// Where a block's lines start: inside its box's padding and border.
function getLaidOutBlockLineLeftPoints(laidOutBlock: PapelizPdfExportLaidOutBlock): number {
  return laidOutBlock.blockLeftPoints + (laidOutBlock.blockBox === null ? 0 : laidOutBlock.blockBox.boxPaddingHorizontalPoints + laidOutBlock.blockBox.boxBorderWidthPoints)
}

// Operations placed from a point instead of a line's top left.
export function movePapelizPdfExportOperations(pageOperations: readonly PapelizPdfExportPageOperation[], leftPoints: number, topPoints: number): PapelizPdfExportPageOperation[] {
  return pageOperations.map((pageOperation): PapelizPdfExportPageOperation => {
    switch (pageOperation.pageOperationKind) {
      case 'text-run':
        return { ...pageOperation, textLeftPoints: roundPapelizPdfExportPoints(pageOperation.textLeftPoints + leftPoints), textBaselinePoints: roundPapelizPdfExportPoints(pageOperation.textBaselinePoints + topPoints) }
      case 'rectangle':
        return { ...pageOperation, rectangleLeftPoints: roundPapelizPdfExportPoints(pageOperation.rectangleLeftPoints + leftPoints), rectangleTopPoints: roundPapelizPdfExportPoints(pageOperation.rectangleTopPoints + topPoints) }
      case 'line':
        return {
          ...pageOperation,
          lineFromLeftPoints: roundPapelizPdfExportPoints(pageOperation.lineFromLeftPoints + leftPoints),
          lineFromTopPoints: roundPapelizPdfExportPoints(pageOperation.lineFromTopPoints + topPoints),
          lineToLeftPoints: roundPapelizPdfExportPoints(pageOperation.lineToLeftPoints + leftPoints),
          lineToTopPoints: roundPapelizPdfExportPoints(pageOperation.lineToTopPoints + topPoints),
        }
      case 'path':
        return { ...pageOperation, pathLeftPoints: roundPapelizPdfExportPoints(pageOperation.pathLeftPoints + leftPoints), pathTopPoints: roundPapelizPdfExportPoints(pageOperation.pathTopPoints + topPoints) }
      case 'link-area':
        return { ...pageOperation, linkAreaLeftPoints: roundPapelizPdfExportPoints(pageOperation.linkAreaLeftPoints + leftPoints), linkAreaTopPoints: roundPapelizPdfExportPoints(pageOperation.linkAreaTopPoints + topPoints) }
      case 'destination':
        return { ...pageOperation, destinationTopPoints: roundPapelizPdfExportPoints(pageOperation.destinationTopPoints + topPoints) }
    }
  })
}

// The text of one style, measured and drawn piece by piece in the file that has each character.
function createTextRunOperations(
  textToPrint: string,
  textFontStyle: PapelizPdfExportFontStyle,
  textSizePoints: number,
  textColor: string,
  textLeftPoints: number,
  textBaselinePoints: number,
  structureElementKey: string,
  noteLayout: PapelizPdfExportNoteLayout,
): { textRunOperations: PapelizPdfExportPageOperation[]; textWidthPoints: number } {
  const textRunOperations: PapelizPdfExportPageOperation[] = []
  let textEndPoints = textLeftPoints
  for (const { segmentText, fontSubsetName } of splitPapelizPdfExportTextBySubset(textToPrint)) {
    const fontFaceKey = getPapelizPdfExportFontFaceKey({ ...textFontStyle, fontSubsetName: fontSubsetName ?? 'latin' })
    const segmentWidthPoints = noteLayout.textMeasurer.measureTextWidthPoints(segmentText, fontFaceKey, textSizePoints, 0, 'standard')
    noteLayout.missingCharacterCount += noteLayout.textMeasurer.countMissingCharacters(segmentText, fontFaceKey)
    textRunOperations.push({
      pageOperationKind: 'text-run',
      textRunText: segmentText,
      fontFaceKey,
      textSizePoints: roundPapelizPdfExportPoints(textSizePoints),
      textColor,
      characterSpacingPoints: 0,
      openTypeFeatureSet: 'standard',
      textLeftPoints: roundPapelizPdfExportPoints(textEndPoints),
      textBaselinePoints: roundPapelizPdfExportPoints(textBaselinePoints),
      textWidthPoints: roundPapelizPdfExportPoints(segmentWidthPoints),
      operationTagging: { operationTaggingKind: 'structure', structureElementKey },
    })
    textEndPoints += segmentWidthPoints
  }
  return { textRunOperations, textWidthPoints: textEndPoints - textLeftPoints }
}

function pushLaidOutBlock(laidOutBlock: Omit<PapelizPdfExportLaidOutBlock, 'blockQuoteBars' | 'blockLeftPoints' | 'blockWidthPoints'>, blockPlace: PapelizPdfExportBlockPlace, noteLayout: PapelizPdfExportNoteLayout): void {
  noteLayout.missingCharacterCount += countMissingCharacters(laidOutBlock.blockLines)
  noteLayout.laidOutBlocks.push({ ...laidOutBlock, blockLeftPoints: blockPlace.placeLeftPoints, blockWidthPoints: blockPlace.placeWidthPoints, blockQuoteBars: [...blockPlace.placeQuoteBars] })
}

function getNoteTextFontStyle(noteLayout: PapelizPdfExportNoteLayout, wantedFontWeight: PapelizPdfExportFontWeight = 400): PapelizPdfExportFontStyle {
  return { fontFamilyName: noteLayout.noteFontFamilyName, fontWeight: choosePapelizPdfExportFontWeight(noteLayout.noteFontFamilyName, wantedFontWeight), isFontItalic: false }
}

function layOutHeading(headingBlock: Extract<PapelizPdfExportNoteBlock, { noteBlockKind: 'heading' }>, blockPlace: PapelizPdfExportBlockPlace, noteLayout: PapelizPdfExportNoteLayout): void {
  const headingPrintLook = papelizPdfExportHeadingPrintLooks[headingBlock.headingLevel]
  const blockFontWeight = getPapelizPdfExportBlockFontWeight(headingBlock)
  const structureElementKey = addStructureElement(`H${headingBlock.headingLevel}`, blockPlace.parentStructureElementKey, noteLayout)
  const blockTextLook: PapelizPdfExportBlockTextLook = {
    noteFontFamilyName: noteLayout.noteFontFamilyName,
    blockFontWeight,
    blockTextSizePoints: headingPrintLook.headingTextSizePoints,
    blockTextColor: blockPlace.placeTextColor ?? papelizPdfExportInkColor,
    blockLetterSpacingPoints: headingBlock.headingLevel === 1 ? papelizPdfExportHeading1LetterSpacingEm * headingPrintLook.headingTextSizePoints : 0,
  }
  const headingLines = layOutPapelizPdfExportTextLines({
    styledTextPieces: buildStyledTextPieces(headingBlock.headingInlineRuns, blockTextLook, structureElementKey, noteLayout),
    lineWidthPoints: blockPlace.placeWidthPoints,
    lineStrut: { strutFontStyle: getNoteTextFontStyle(noteLayout, blockFontWeight), strutTextSizePoints: headingPrintLook.headingTextSizePoints, lineHeightRatio: headingPrintLook.headingLineHeightRatio },
    wrappedLineIndentPoints: 0,
    structureElementKey,
    textMeasurer: noteLayout.textMeasurer,
  })
  const { headingDestinationName } = headingBlock
  const firstHeadingLine = headingLines[0]
  if (headingDestinationName !== null && firstHeadingLine !== undefined) {
    firstHeadingLine.lineOperations.unshift({ pageOperationKind: 'destination', destinationName: headingDestinationName, destinationTopPoints: 0 })
    const bookmarkTitle = headingBlock.headingInlineRuns
      .map((inlineRun) => (inlineRun.inlineRunKind === 'text' ? inlineRun.textRunText : ' '))
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
    if (bookmarkTitle.length > 0) {
      // A heading hangs under the nearest heading above it of a higher level.
      while ((noteLayout.openHeadingLevels.at(-1) ?? 0) >= headingBlock.headingLevel) noteLayout.openHeadingLevels.pop()
      noteLayout.bookmarks.push({ bookmarkTitle, bookmarkDepth: noteLayout.openHeadingLevels.length + 1, bookmarkDestinationName: headingDestinationName })
      noteLayout.openHeadingLevels.push(headingBlock.headingLevel)
    }
  }
  pushLaidOutBlock(
    {
      blockSpaceAbovePoints: headingPrintLook.headingSpaceAbovePoints,
      blockSpaceBelowPoints: headingPrintLook.headingSpaceBelowPoints,
      blockLines: headingLines,
      blockBox: null,
      isBlockKeptWithNext: true,
      blockKeptWholeLineCount: Number.POSITIVE_INFINITY,
      minimumLinesBeforePageBreak: 1,
      minimumLinesAfterPageBreak: 1,
      isBlockLeftOutAtPageTop: false,
    },
    blockPlace,
    noteLayout,
  )
}

function layOutParagraph(paragraphBlock: Extract<PapelizPdfExportNoteBlock, { noteBlockKind: 'paragraph' }>, blockPlace: PapelizPdfExportBlockPlace, noteLayout: PapelizPdfExportNoteLayout): void {
  const structureElementKey = addStructureElement('P', blockPlace.parentStructureElementKey, noteLayout)
  const blockTextLook: PapelizPdfExportBlockTextLook = {
    noteFontFamilyName: noteLayout.noteFontFamilyName,
    blockFontWeight: 400,
    blockTextSizePoints: blockPlace.placeTextSizePoints,
    blockTextColor: paragraphBlock.paragraphTextColor ?? blockPlace.placeTextColor ?? papelizPdfExportInkColor,
    blockLetterSpacingPoints: 0,
  }
  const paragraphLines = layOutPapelizPdfExportTextLines({
    styledTextPieces: buildStyledTextPieces(paragraphBlock.paragraphInlineRuns, blockTextLook, structureElementKey, noteLayout),
    lineWidthPoints: blockPlace.placeWidthPoints,
    lineStrut: { strutFontStyle: getNoteTextFontStyle(noteLayout), strutTextSizePoints: blockPlace.placeTextSizePoints, lineHeightRatio: papelizExportBodyLineHeight },
    wrappedLineIndentPoints: 0,
    structureElementKey,
    textMeasurer: noteLayout.textMeasurer,
  })
  pushLaidOutBlock(
    {
      blockSpaceAbovePoints: 0,
      blockSpaceBelowPoints: paragraphBlock.hasParagraphSpacing && !blockPlace.isInsideTaskListItem ? papelizExportPrintSpacingInPoints.paragraphSpaceBelowPoints : 0,
      blockLines: paragraphLines,
      blockBox: null,
      isBlockKeptWithNext: false,
      blockKeptWholeLineCount: 0,
      minimumLinesBeforePageBreak: papelizPdfExportParagraphLinesAtPageBreak,
      minimumLinesAfterPageBreak: papelizPdfExportParagraphLinesAtPageBreak,
      isBlockLeftOutAtPageTop: false,
    },
    blockPlace,
    noteLayout,
  )
}

function layOutCodeBox(codeBoxText: string, blockPlace: PapelizPdfExportBlockPlace, noteLayout: PapelizPdfExportNoteLayout): void {
  const { textMeasurer } = noteLayout
  const structureElementKey = addStructureElement('Code', blockPlace.parentStructureElementKey, noteLayout)
  const codeBoxTextSizePoints = papelizExportPrintTextSizesInPoints.codeBlockTextSizePoints
  const codeBoxStyle: PapelizPdfExportResolvedTextStyle = {
    textFontStyle: papelizPdfExportCodeBoxFontStyle,
    textSizePoints: codeBoxTextSizePoints,
    textColor: blockPlace.placeTextColor ?? papelizPdfExportInkColor,
    characterSpacingPoints: 0,
    openTypeFeatureSet: 'no-ligatures',
    textUnderline: null,
    isTextStruck: false,
    baselineShiftPoints: 0,
    textChip: null,
    textLink: null,
    textDestinationName: null,
    textInlineIcon: null,
  }
  const codeBoxStrut: PapelizPdfExportLineStrut = { strutFontStyle: papelizPdfExportCodeBoxFontStyle, strutTextSizePoints: codeBoxTextSizePoints, lineHeightRatio: codeBlockLineHeight }
  const codeBoxLineWidthPoints = blockPlace.placeWidthPoints - 2 * (papelizPdfExportCodeBoxLook.boxPaddingHorizontalPoints + papelizPdfExportCodeBoxLook.boxBorderWidthPoints)
  const wrappedLineIndentPoints = textMeasurer.measureTextWidthPoints(
    papelizPdfExportCodeBoxWrappedLineIndentCharacters,
    getPapelizPdfExportFontFaceKey({ ...papelizPdfExportCodeBoxFontStyle, fontSubsetName: 'latin' }),
    codeBoxTextSizePoints,
    0,
    'no-ligatures',
  )
  const codeBoxLines = codeBoxText.split('\n').flatMap((codeLineText) =>
    layOutPapelizPdfExportTextLines({
      styledTextPieces: codeLineText.length === 0 ? [] : [{ styledPieceKind: 'text', pieceText: codeLineText, pieceStyle: codeBoxStyle }],
      lineWidthPoints: codeBoxLineWidthPoints,
      lineStrut: codeBoxStrut,
      wrappedLineIndentPoints,
      structureElementKey,
      textMeasurer,
    }),
  )
  pushLaidOutBlock(
    {
      blockSpaceAbovePoints: papelizExportPrintSpacingInPoints.blockSpaceAbovePoints,
      blockSpaceBelowPoints: papelizExportPrintSpacingInPoints.blockSpaceBelowPoints,
      blockLines: codeBoxLines,
      blockBox: papelizPdfExportCodeBoxLook,
      isBlockKeptWithNext: false,
      blockKeptWholeLineCount: papelizPdfExportCodeBoxKeptWholeLineCount,
      minimumLinesBeforePageBreak: papelizPdfExportCodeBoxLinesAtPageBreak,
      minimumLinesAfterPageBreak: papelizPdfExportCodeBoxLinesAtPageBreak,
      isBlockLeftOutAtPageTop: false,
    },
    blockPlace,
    noteLayout,
  )
}

// A rule: a hairline across its place, left out where it would open a page.
function layOutRule(blockPlace: PapelizPdfExportBlockPlace, noteLayout: PapelizPdfExportNoteLayout): void {
  const { hairlineWidthPoints } = papelizExportPrintSpacingInPoints
  pushLaidOutBlock(
    {
      blockSpaceAbovePoints: papelizExportPrintSpacingInPoints.ruleSpaceAbovePoints,
      blockSpaceBelowPoints: papelizExportPrintSpacingInPoints.ruleSpaceBelowPoints,
      blockLines: [
        {
          lineHeightPoints: roundPapelizPdfExportPoints(hairlineWidthPoints),
          lineBaselinePoints: roundPapelizPdfExportPoints(hairlineWidthPoints),
          lineOperations: [
            {
              pageOperationKind: 'rectangle',
              rectangleLeftPoints: 0,
              rectangleTopPoints: 0,
              rectangleWidthPoints: roundPapelizPdfExportPoints(blockPlace.placeWidthPoints),
              rectangleHeightPoints: roundPapelizPdfExportPoints(hairlineWidthPoints),
              rectangleCornerRadiusPoints: 0,
              rectangleFillColor: papelizExportPrintColorsByToken['--color-papeliz-line'],
              rectangleStrokeColor: null,
              rectangleStrokeWidthPoints: 0,
            },
          ],
          missingCharacterCount: 0,
        },
      ],
      blockBox: null,
      isBlockKeptWithNext: false,
      blockKeptWholeLineCount: Number.POSITIVE_INFINITY,
      minimumLinesBeforePageBreak: 1,
      minimumLinesAfterPageBreak: 1,
      isBlockLeftOutAtPageTop: true,
    },
    blockPlace,
    noteLayout,
  )
}

// What sits beside a list item's first line.
type PapelizPdfExportListItemMarker =
  | { listItemMarkerKind: 'bullet'; bulletShape: PapelizPdfExportBulletShape }
  | { listItemMarkerKind: 'number'; listItemNumber: number }
  | { listItemMarkerKind: 'task-box'; isTaskDone: boolean }
  | { listItemMarkerKind: 'none' }

// The marker's drawing, from the item's text start (left) and its first line's baseline (top).
// A number is the item's label in the structure.
function createListItemMarkerOperations(
  listItemMarker: PapelizPdfExportListItemMarker,
  markerTextSizePoints: number,
  markerColor: string,
  itemStructureElementKey: string,
  noteLayout: PapelizPdfExportNoteLayout,
): PapelizPdfExportPageOperation[] {
  switch (listItemMarker.listItemMarkerKind) {
    case 'bullet': {
      const bulletSizePoints = papelizPdfExportBulletSizeEm * markerTextSizePoints
      const bulletMiddleLeftPoints = -papelizPdfExportBulletMiddleLeftOfTextEm * markerTextSizePoints
      const bulletMiddleTopPoints = -papelizPdfExportBulletMiddleAboveBaselineEm * markerTextSizePoints
      const ringLineWidthPoints = papelizPdfExportRingBulletLineWidthEm * markerTextSizePoints
      return [
        {
          pageOperationKind: 'rectangle',
          rectangleLeftPoints: roundPapelizPdfExportPoints(bulletMiddleLeftPoints - bulletSizePoints / 2),
          rectangleTopPoints: roundPapelizPdfExportPoints(bulletMiddleTopPoints - bulletSizePoints / 2),
          rectangleWidthPoints: roundPapelizPdfExportPoints(bulletSizePoints),
          rectangleHeightPoints: roundPapelizPdfExportPoints(bulletSizePoints),
          rectangleCornerRadiusPoints: listItemMarker.bulletShape === 'square' ? 0 : roundPapelizPdfExportPoints(bulletSizePoints / 2),
          rectangleFillColor: listItemMarker.bulletShape === 'ring' ? null : markerColor,
          rectangleStrokeColor: listItemMarker.bulletShape === 'ring' ? markerColor : null,
          rectangleStrokeWidthPoints: listItemMarker.bulletShape === 'ring' ? roundPapelizPdfExportPoints(ringLineWidthPoints) : 0,
        },
      ]
    }
    case 'number': {
      // "3." ends a space's width before the item's text, as a browser places its list numbers.
      const numberFontStyle = getNoteTextFontStyle(noteLayout)
      const numberText = `${listItemMarker.listItemNumber}.`
      const spaceWidthPoints = noteLayout.textMeasurer.measureTextWidthPoints(' ', getPapelizPdfExportFontFaceKey({ ...numberFontStyle, fontSubsetName: 'latin' }), markerTextSizePoints, 0, 'standard')
      const numberWidthPoints = splitPapelizPdfExportTextBySubset(numberText).reduce(
        (textWidthPoints, { segmentText, fontSubsetName }) =>
          textWidthPoints +
          noteLayout.textMeasurer.measureTextWidthPoints(segmentText, getPapelizPdfExportFontFaceKey({ ...numberFontStyle, fontSubsetName: fontSubsetName ?? 'latin' }), markerTextSizePoints, 0, 'standard'),
        0,
      )
      const labelStructureElementKey = addStructureElement('Lbl', itemStructureElementKey, noteLayout)
      return createTextRunOperations(numberText, numberFontStyle, markerTextSizePoints, markerColor, -spaceWidthPoints - numberWidthPoints, 0, labelStructureElementKey, noteLayout).textRunOperations
    }
    case 'task-box': {
      const { isTaskDone } = listItemMarker
      const taskBoxTopPoints = -papelizPdfExportTaskBoxMiddleAboveBaselineEm * markerTextSizePoints - papelizPdfExportTaskBoxSizePoints / 2 + papelizPdfExportTaskBoxLowerPoints
      const taskBoxLeftPoints = -scalePapelizMdViewPixelsToPrintPoints(30)
      const blueColor = papelizExportPrintColorsByToken['--color-papeliz-blue']
      const taskBoxOperations: PapelizPdfExportPageOperation[] = [
        {
          pageOperationKind: 'rectangle',
          rectangleLeftPoints: roundPapelizPdfExportPoints(taskBoxLeftPoints),
          rectangleTopPoints: roundPapelizPdfExportPoints(taskBoxTopPoints),
          rectangleWidthPoints: roundPapelizPdfExportPoints(papelizPdfExportTaskBoxSizePoints),
          rectangleHeightPoints: roundPapelizPdfExportPoints(papelizPdfExportTaskBoxSizePoints),
          rectangleCornerRadiusPoints: roundPapelizPdfExportPoints(papelizPdfExportTaskBoxCornerRadiusPoints),
          rectangleFillColor: isTaskDone ? blueColor : papelizExportPrintColorsByToken['--color-papeliz-surface'],
          rectangleStrokeColor: isTaskDone ? blueColor : papelizExportPrintColorsByToken['--color-papeliz-line-strong'],
          rectangleStrokeWidthPoints: roundPapelizPdfExportPoints(papelizPdfExportTaskBoxBorderWidthPoints),
        },
      ]
      if (isTaskDone) {
        const taskCheckInsetPoints = (papelizPdfExportTaskBoxSizePoints - papelizPdfExportTaskCheckSizePoints) / 2
        taskBoxOperations.push({
          pageOperationKind: 'path',
          pathData: papelizPdfExportTaskCheckPathData,
          pathLeftPoints: roundPapelizPdfExportPoints(taskBoxLeftPoints + taskCheckInsetPoints),
          pathTopPoints: roundPapelizPdfExportPoints(taskBoxTopPoints + taskCheckInsetPoints),
          pathScale: roundPapelizPdfExportPoints(papelizPdfExportTaskCheckSizePoints / papelizPdfExportIconViewBoxSize),
          pathFillColor: null,
          pathStrokeColor: papelizExportPrintColorsByToken['--color-papeliz-surface'],
          pathStrokeWidth: papelizPdfExportTaskCheckStrokeWidth,
        })
      }
      return taskBoxOperations
    }
    case 'none':
      return []
  }
}

interface PapelizPdfExportListItemPlan {
  listItemBlocks: readonly PapelizPdfExportNoteBlock[]
  listItemMarker: PapelizPdfExportListItemMarker
  // Its text in the subtle ink (a done task), else the list's.
  listItemTextColor: string | null
  // A footnote's place, at its first line.
  listItemDestinationName: string | null
}

interface PapelizPdfExportListPlan {
  listItemPlans: PapelizPdfExportListItemPlan[]
  listIndentPoints: number
  listItemSpaceBelowPoints: number
  isTaskList: boolean
  // L/LI/Lbl/LBody for a list; each footnote is a Note holding its number and text.
  isFootnoteList: boolean
}

// A list's items: each item's blocks indented to the item's text, its marker beside its first line,
// MD View's gaps between items, and a list item, label and body in the structure.
function layOutListItems(listPlan: PapelizPdfExportListPlan, blockPlace: PapelizPdfExportBlockPlace, noteLayout: PapelizPdfExportNoteLayout): void {
  const listStructureElementKey = listPlan.isFootnoteList ? blockPlace.parentStructureElementKey : addStructureElement('L', blockPlace.parentStructureElementKey, noteLayout)
  const itemTextLeftPoints = blockPlace.placeLeftPoints + listPlan.listIndentPoints
  for (const listItemPlan of listPlan.listItemPlans) {
    const itemStructureElementKey = addStructureElement(listPlan.isFootnoteList ? 'Note' : 'LI', listStructureElementKey, noteLayout)
    // The label goes in first, so it reads before the item's text.
    const markerOperations = createListItemMarkerOperations(
      listItemPlan.listItemMarker,
      blockPlace.placeTextSizePoints,
      listItemPlan.listItemTextColor ?? blockPlace.placeTextColor ?? papelizPdfExportInkColor,
      itemStructureElementKey,
      noteLayout,
    )
    const itemPlace: PapelizPdfExportBlockPlace = {
      ...blockPlace,
      placeLeftPoints: itemTextLeftPoints,
      placeWidthPoints: blockPlace.placeWidthPoints - listPlan.listIndentPoints,
      placeTextColor: listItemPlan.listItemTextColor ?? blockPlace.placeTextColor,
      parentStructureElementKey: listPlan.isFootnoteList ? itemStructureElementKey : addStructureElement('LBody', itemStructureElementKey, noteLayout),
      isInsideTaskListItem: listPlan.isTaskList,
      placeListDepth: blockPlace.placeListDepth + 1,
      isListItemPlace: true,
    }
    const firstItemBlockIndex = noteLayout.laidOutBlocks.length
    layOutNoteBlocks(listItemPlan.listItemBlocks, itemPlace, noteLayout)
    // An empty item still shows its marker, on a line of its own.
    if (noteLayout.laidOutBlocks.length === firstItemBlockIndex) {
      layOutParagraph({ noteBlockKind: 'paragraph', paragraphInlineRuns: [], paragraphTextColor: null, hasParagraphSpacing: false }, itemPlace, noteLayout)
    }
    const firstItemBlock = noteLayout.laidOutBlocks[firstItemBlockIndex] as PapelizPdfExportLaidOutBlock
    const firstItemLine = firstItemBlock.blockLines[0]
    if (firstItemLine !== undefined) {
      const itemDestinationOperations: PapelizPdfExportPageOperation[] =
        listItemPlan.listItemDestinationName === null ? [] : [{ pageOperationKind: 'destination', destinationName: listItemPlan.listItemDestinationName, destinationTopPoints: 0 }]
      firstItemLine.lineOperations.unshift(
        ...itemDestinationOperations,
        ...movePapelizPdfExportOperations(markerOperations, itemTextLeftPoints - getLaidOutBlockLineLeftPoints(firstItemBlock), firstItemLine.lineBaselinePoints),
      )
    }
    const lastItemBlock = noteLayout.laidOutBlocks.at(-1) as PapelizPdfExportLaidOutBlock
    lastItemBlock.blockSpaceBelowPoints = Math.max(lastItemBlock.blockSpaceBelowPoints, listPlan.listItemSpaceBelowPoints)
  }
}

function getListItemMarker(listKind: PapelizPdfExportListKind, listItem: PapelizPdfExportListItem, listItemNumber: number, listDepth: number): PapelizPdfExportListItemMarker {
  if (listKind === 'numbered') return { listItemMarkerKind: 'number', listItemNumber }
  if (listKind === 'task') return listItem.listItemTaskState === null ? { listItemMarkerKind: 'none' } : { listItemMarkerKind: 'task-box', isTaskDone: listItem.listItemTaskState === 'done' }
  return { listItemMarkerKind: 'bullet', bulletShape: papelizPdfExportBulletShapesByDepth[listDepth % papelizPdfExportBulletShapesByDepth.length] ?? 'disc' }
}

function layOutList(listBlock: Extract<PapelizPdfExportNoteBlock, { noteBlockKind: 'list' }>, blockPlace: PapelizPdfExportBlockPlace, noteLayout: PapelizPdfExportNoteLayout): void {
  const isTaskList = listBlock.listKind === 'task'
  const firstListBlockIndex = noteLayout.laidOutBlocks.length
  layOutListItems(
    {
      listItemPlans: listBlock.listItems.map((listItem, listItemIndex) => ({
        listItemBlocks: listItem.listItemBlocks,
        listItemMarker: getListItemMarker(listBlock.listKind, listItem, listBlock.listStartNumber + listItemIndex, blockPlace.placeListDepth),
        // A done task's text is gray, nested lists included, as in MD View.
        listItemTextColor: listItem.listItemTaskState === 'done' ? papelizExportPrintColorsByToken['--color-papeliz-ink-subtle'] : null,
        listItemDestinationName: null,
      })),
      listIndentPoints: isTaskList ? papelizExportPrintSpacingInPoints.taskListItemIndentPoints : papelizExportPrintSpacingInPoints.listIndentPoints,
      listItemSpaceBelowPoints: isTaskList ? papelizPdfExportTaskListItemSpaceBelowPoints : papelizExportPrintSpacingInPoints.listItemSpaceBelowPoints,
      isTaskList,
      isFootnoteList: false,
    },
    blockPlace,
    noteLayout,
  )
  // A list inside an item has 4px above it and nothing of its own below; a list in the note, 16px below.
  const firstListBlock = noteLayout.laidOutBlocks[firstListBlockIndex]
  const lastListBlock = noteLayout.laidOutBlocks.at(-1)
  if (firstListBlock === undefined || lastListBlock === undefined) return
  if (blockPlace.isListItemPlace) firstListBlock.blockSpaceAbovePoints = Math.max(firstListBlock.blockSpaceAbovePoints, papelizPdfExportNestedListSpaceAbovePoints)
  else lastListBlock.blockSpaceBelowPoints = Math.max(lastListBlock.blockSpaceBelowPoints, papelizExportPrintSpacingInPoints.listSpaceBelowPoints)
}

function layOutQuote(quoteBlocks: readonly PapelizPdfExportNoteBlock[], blockPlace: PapelizPdfExportBlockPlace, noteLayout: PapelizPdfExportNoteLayout): void {
  const quoteKey = `quote-${noteLayout.nextQuoteNumber}`
  noteLayout.nextQuoteNumber += 1
  const quoteIndentPoints = papelizExportPrintSpacingInPoints.quoteBarWidthPoints + papelizExportPrintSpacingInPoints.quoteIndentPoints
  const firstQuoteBlockIndex = noteLayout.laidOutBlocks.length
  layOutNoteBlocks(
    quoteBlocks,
    {
      ...blockPlace,
      placeLeftPoints: blockPlace.placeLeftPoints + quoteIndentPoints,
      placeWidthPoints: blockPlace.placeWidthPoints - quoteIndentPoints,
      placeTextColor: blockPlace.placeTextColor ?? papelizExportPrintColorsByToken['--color-papeliz-ink-muted'],
      placeQuoteBars: [...blockPlace.placeQuoteBars, { quoteKey, quoteBarLeftPoints: blockPlace.placeLeftPoints }],
      parentStructureElementKey: addStructureElement('BlockQuote', blockPlace.parentStructureElementKey, noteLayout),
      isInsideTaskListItem: false,
      isListItemPlace: false,
    },
    noteLayout,
  )
  const firstQuoteBlock = noteLayout.laidOutBlocks[firstQuoteBlockIndex]
  const lastQuoteBlock = noteLayout.laidOutBlocks.at(-1)
  if (firstQuoteBlock === undefined || lastQuoteBlock === undefined) return
  firstQuoteBlock.blockSpaceAbovePoints = Math.max(firstQuoteBlock.blockSpaceAbovePoints, papelizExportPrintSpacingInPoints.blockSpaceAbovePoints + papelizPdfExportQuoteBarOverhangPoints)
  lastQuoteBlock.blockSpaceBelowPoints = Math.max(lastQuoteBlock.blockSpaceBelowPoints, papelizExportPrintSpacingInPoints.blockSpaceBelowPoints)
}

function layOutFootnotes(noteFootnotes: readonly PapelizPdfExportFootnote[], blockPlace: PapelizPdfExportBlockPlace, noteLayout: PapelizPdfExportNoteLayout): void {
  const firstFootnoteBlockIndex = noteLayout.laidOutBlocks.length
  // MD View's footnotes: 14px, in the muted ink, numbered as a list.
  layOutListItems(
    {
      listItemPlans: noteFootnotes.map((noteFootnote) => ({
        listItemBlocks: noteFootnote.footnoteBlocks,
        listItemMarker: { listItemMarkerKind: 'number', listItemNumber: noteFootnote.footnoteNumber },
        listItemTextColor: null,
        listItemDestinationName: noteFootnote.footnoteDestinationName,
      })),
      listIndentPoints: papelizExportPrintSpacingInPoints.listIndentPoints,
      listItemSpaceBelowPoints: papelizExportPrintSpacingInPoints.listItemSpaceBelowPoints,
      isTaskList: false,
      isFootnoteList: true,
    },
    {
      ...blockPlace,
      placeTextColor: blockPlace.placeTextColor ?? papelizExportPrintColorsByToken['--color-papeliz-ink-muted'],
      placeTextSizePoints: papelizExportPrintTextSizesInPoints.footnotesTextSizePoints,
    },
    noteLayout,
  )
  const firstFootnoteBlock = noteLayout.laidOutBlocks[firstFootnoteBlockIndex]
  const lastFootnoteBlock = noteLayout.laidOutBlocks.at(-1)
  if (firstFootnoteBlock === undefined || lastFootnoteBlock === undefined) return
  firstFootnoteBlock.blockSpaceAbovePoints = Math.max(firstFootnoteBlock.blockSpaceAbovePoints, papelizExportPrintSpacingInPoints.footnotesSpaceAbovePoints)
  lastFootnoteBlock.blockSpaceBelowPoints = Math.max(lastFootnoteBlock.blockSpaceBelowPoints, papelizExportPrintSpacingInPoints.listSpaceBelowPoints)
}

// The right edge of what a set of lines draws.
function measureLinesWidthPoints(laidOutLines: readonly PapelizPdfExportLaidOutLine[]): number {
  let linesWidthPoints = 0
  for (const laidOutLine of laidOutLines) {
    for (const lineOperation of laidOutLine.lineOperations) {
      if (lineOperation.pageOperationKind === 'text-run') linesWidthPoints = Math.max(linesWidthPoints, lineOperation.textLeftPoints + lineOperation.textWidthPoints)
    }
  }
  return linesWidthPoints
}

function sumLineHeights(laidOutLines: readonly PapelizPdfExportLaidOutLine[]): number {
  return laidOutLines.reduce((lineHeightSumPoints, laidOutLine) => lineHeightSumPoints + laidOutLine.lineHeightPoints, 0)
}

interface PapelizPdfExportPropertyChip {
  chipWidthPoints: number
  chipTextHeightPoints: number
  // From the chip's top left, its text block centered on the chip's height later.
  chipTextOperations: PapelizPdfExportPageOperation[]
}

// One chip: the property's name, then its values, each wrapping in its own column when the chip is
// wider than the line, as MD View's flex chip shrinks.
function layOutPropertyChip(noteProperty: PapelizPdfExportNoteProperty, chipRoomPoints: number, propertiesStructureElementKey: string, noteLayout: PapelizPdfExportNoteLayout): PapelizPdfExportPropertyChip {
  const chipStructureElementKey = addStructureElement('LBody', addStructureElement('LI', propertiesStructureElementKey, noteLayout), noteLayout)
  const propertyTextSizePoints = papelizExportPrintTextSizesInPoints.propertyTextSizePoints
  const chipLineStrut: PapelizPdfExportLineStrut = { strutFontStyle: getNoteTextFontStyle(noteLayout), strutTextSizePoints: propertyTextSizePoints, lineHeightRatio: papelizPdfExportPropertyLineHeight }
  const layOutChipText = (chipText: string, textColor: string, wantedFontWeight: PapelizPdfExportFontWeight, lineWidthPoints: number) =>
    chipText.length === 0
      ? []
      : layOutPapelizPdfExportTextLines({
          styledTextPieces: [
            {
              styledPieceKind: 'text',
              pieceText: chipText,
              pieceStyle: {
                textFontStyle: getNoteTextFontStyle(noteLayout, wantedFontWeight),
                textSizePoints: propertyTextSizePoints,
                textColor,
                characterSpacingPoints: 0,
                openTypeFeatureSet: 'standard',
                textUnderline: null,
                isTextStruck: false,
                baselineShiftPoints: 0,
                textChip: null,
                textLink: null,
                textDestinationName: null,
                textInlineIcon: null,
              },
            },
          ],
          lineWidthPoints,
          lineStrut: chipLineStrut,
          wrappedLineIndentPoints: 0,
          structureElementKey: chipStructureElementKey,
          textMeasurer: noteLayout.textMeasurer,
        })
  const chipTextRoomPoints = Math.max(1, chipRoomPoints - 2 * papelizPdfExportPropertyChipPaddingHorizontalPoints)
  const layOutPropertyName = (lineWidthPoints: number) => layOutChipText(noteProperty.notePropertyName, papelizPdfExportInkColor, papelizPdfExportPropertyNameFontWeight, lineWidthPoints)
  const layOutPropertyValues = (lineWidthPoints: number) => layOutChipText(noteProperty.notePropertyValuesText, papelizExportPrintColorsByToken['--color-papeliz-ink-muted'], 400, lineWidthPoints)
  let propertyNameLines = layOutPropertyName(Number.POSITIVE_INFINITY)
  const propertyNameWidthPoints = measureLinesWidthPoints(propertyNameLines)
  const valuesGapPoints = noteProperty.notePropertyValuesText.length === 0 ? 0 : papelizPdfExportPropertyChipGapPoints
  let propertyValuesLines = layOutPropertyValues(Number.POSITIVE_INFINITY)
  let valuesLeftPoints = propertyNameWidthPoints + valuesGapPoints
  if (valuesLeftPoints + measureLinesWidthPoints(propertyValuesLines) > chipTextRoomPoints) {
    const nameColumnWidthPoints = Math.min(propertyNameWidthPoints, chipTextRoomPoints * papelizPdfExportPropertyNameShareOfWrappedChip)
    propertyNameLines = layOutPropertyName(nameColumnWidthPoints)
    valuesLeftPoints = measureLinesWidthPoints(propertyNameLines) + valuesGapPoints
    propertyValuesLines = layOutPropertyValues(Math.max(1, chipTextRoomPoints - valuesLeftPoints))
  }
  const chipTextOperations: PapelizPdfExportPageOperation[] = []
  const placeColumnLines = (columnLines: readonly PapelizPdfExportLaidOutLine[], columnLeftPoints: number) => {
    let lineTopPoints = 0
    for (const columnLine of columnLines) {
      chipTextOperations.push(...movePapelizPdfExportOperations(columnLine.lineOperations, papelizPdfExportPropertyChipPaddingHorizontalPoints + columnLeftPoints, lineTopPoints))
      lineTopPoints += columnLine.lineHeightPoints
    }
  }
  placeColumnLines(propertyNameLines, 0)
  placeColumnLines(propertyValuesLines, valuesLeftPoints)
  noteLayout.missingCharacterCount += countMissingCharacters(propertyNameLines) + countMissingCharacters(propertyValuesLines)
  return {
    chipWidthPoints: Math.min(chipRoomPoints, 2 * papelizPdfExportPropertyChipPaddingHorizontalPoints + valuesLeftPoints + measureLinesWidthPoints(propertyValuesLines)),
    chipTextHeightPoints: Math.max(sumLineHeights(propertyNameLines), sumLineHeights(propertyValuesLines)),
    chipTextOperations,
  }
}

// The note's properties as MD View's chips, side by side and wrapping into rows; a row's chips are as
// tall as its tallest. The chips never split across pages.
function layOutProperties(noteProperties: readonly PapelizPdfExportNoteProperty[], blockPlace: PapelizPdfExportBlockPlace, noteLayout: PapelizPdfExportNoteLayout): void {
  const propertiesStructureElementKey = addStructureElement('L', blockPlace.parentStructureElementKey, noteLayout)
  const propertyChips = noteProperties.map((noteProperty) => layOutPropertyChip(noteProperty, blockPlace.placeWidthPoints, propertiesStructureElementKey, noteLayout))
  const chipRows: PapelizPdfExportPropertyChip[][] = []
  let rowWidthPoints = 0
  for (const propertyChip of propertyChips) {
    const currentChipRow = chipRows.at(-1)
    if (currentChipRow !== undefined && rowWidthPoints + papelizPdfExportPropertyChipGapPoints + propertyChip.chipWidthPoints <= blockPlace.placeWidthPoints) {
      currentChipRow.push(propertyChip)
      rowWidthPoints += papelizPdfExportPropertyChipGapPoints + propertyChip.chipWidthPoints
      continue
    }
    chipRows.push([propertyChip])
    rowWidthPoints = propertyChip.chipWidthPoints
  }
  const chipGroundColor = papelizExportPrintColorsByToken['--color-papeliz-surface-gray']
  const propertiesLines = chipRows.map((chipRow, chipRowIndex): PapelizPdfExportLaidOutLine => {
    const rowHeightPoints = Math.max(papelizPdfExportPropertyChipHeightPoints, ...chipRow.map((propertyChip) => propertyChip.chipTextHeightPoints + 2 * papelizPdfExportPropertyChipPaddingVerticalPoints))
    const rowOperations: PapelizPdfExportPageOperation[] = []
    let chipLeftPoints = 0
    for (const propertyChip of chipRow) {
      rowOperations.push({
        pageOperationKind: 'rectangle',
        rectangleLeftPoints: roundPapelizPdfExportPoints(chipLeftPoints),
        rectangleTopPoints: 0,
        rectangleWidthPoints: roundPapelizPdfExportPoints(propertyChip.chipWidthPoints),
        rectangleHeightPoints: roundPapelizPdfExportPoints(rowHeightPoints),
        rectangleCornerRadiusPoints: roundPapelizPdfExportPoints(Math.min(rowHeightPoints, propertyChip.chipWidthPoints) / 2),
        rectangleFillColor: chipGroundColor,
        rectangleStrokeColor: null,
        rectangleStrokeWidthPoints: 0,
      })
      rowOperations.push(...movePapelizPdfExportOperations(propertyChip.chipTextOperations, chipLeftPoints, (rowHeightPoints - propertyChip.chipTextHeightPoints) / 2))
      chipLeftPoints += propertyChip.chipWidthPoints + papelizPdfExportPropertyChipGapPoints
    }
    const rowGapPoints = chipRowIndex < chipRows.length - 1 ? papelizPdfExportPropertyChipGapPoints : 0
    return { lineHeightPoints: roundPapelizPdfExportPoints(rowHeightPoints + rowGapPoints), lineBaselinePoints: roundPapelizPdfExportPoints(rowHeightPoints / 2), lineOperations: rowOperations, missingCharacterCount: 0 }
  })
  pushLaidOutBlock(
    {
      blockSpaceAbovePoints: 0,
      blockSpaceBelowPoints: papelizExportPrintSpacingInPoints.propertiesSpaceBelowPoints,
      blockLines: propertiesLines,
      blockBox: null,
      isBlockKeptWithNext: false,
      blockKeptWholeLineCount: Number.POSITIVE_INFINITY,
      minimumLinesBeforePageBreak: 1,
      minimumLinesAfterPageBreak: 1,
      isBlockLeftOutAtPageTop: false,
    },
    blockPlace,
    noteLayout,
  )
}

function layOutNoteBlocks(noteBlocks: readonly PapelizPdfExportNoteBlock[], blockPlace: PapelizPdfExportBlockPlace, noteLayout: PapelizPdfExportNoteLayout): void {
  for (const noteBlock of noteBlocks) {
    switch (noteBlock.noteBlockKind) {
      case 'heading':
        layOutHeading(noteBlock, blockPlace, noteLayout)
        break
      case 'paragraph':
        layOutParagraph(noteBlock, blockPlace, noteLayout)
        break
      case 'code-box':
        layOutCodeBox(noteBlock.codeBoxText, blockPlace, noteLayout)
        break
      case 'list':
        layOutList(noteBlock, blockPlace, noteLayout)
        break
      case 'quote':
        layOutQuote(noteBlock.quoteBlocks, blockPlace, noteLayout)
        break
      case 'rule':
        layOutRule(blockPlace, noteLayout)
        break
      case 'properties':
        layOutProperties(noteBlock.noteProperties, blockPlace, noteLayout)
        break
      case 'footnotes':
        layOutFootnotes(noteBlock.noteFootnotes, blockPlace, noteLayout)
        break
    }
  }
}

export interface PapelizPdfExportNoteLayoutOptions {
  pdfExportNoteDocument: PapelizPdfExportNoteDocument
  contentWidthPoints: number
  textMeasurer: PapelizPdfExportTextMeasurer
}

export function layOutPapelizPdfExportNoteBlocks({ pdfExportNoteDocument, contentWidthPoints, textMeasurer }: PapelizPdfExportNoteLayoutOptions): PapelizPdfExportLaidOutNote {
  const noteLayout: PapelizPdfExportNoteLayout = {
    noteFontFamilyName: getPapelizPdfExportNoteFontFamilyName(pdfExportNoteDocument.noteFontFamily),
    textMeasurer,
    laidOutBlocks: [],
    structureElements: [],
    linkStructureElementKeys: new Set(),
    bookmarks: [],
    openHeadingLevels: [],
    missingCharacterCount: 0,
    nextStructureElementNumber: 1,
    nextQuoteNumber: 1,
  }
  layOutNoteBlocks(
    pdfExportNoteDocument.noteBlocks,
    {
      placeLeftPoints: 0,
      placeWidthPoints: contentWidthPoints,
      placeTextColor: null,
      placeTextSizePoints: papelizExportBodyTextSizePoints,
      placeQuoteBars: [],
      parentStructureElementKey: null,
      isInsideTaskListItem: false,
      placeListDepth: 0,
      isListItemPlace: false,
    },
    noteLayout,
  )
  return {
    laidOutBlocks: noteLayout.laidOutBlocks,
    structureElements: noteLayout.structureElements,
    bookmarks: noteLayout.bookmarks,
    missingCharacterCount: noteLayout.missingCharacterCount,
  }
}
