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
  getPapelizPdfExportLatinFontFaceKey,
  getPapelizPdfExportNoteFontFamilyName,
  papelizPdfExportCodeBoxFontStyle,
  papelizPdfExportPropertyNameFontWeight,
  resolvePapelizPdfExportTextRunFontStyle,
  type PapelizPdfExportFontFamilyName,
  type PapelizPdfExportFontStyle,
  type PapelizPdfExportFontWeight,
} from './papeliz-pdf-export-fonts'
import {
  createPapelizPdfExportStyledTextOperations,
  layOutPapelizPdfExportTextLines,
  measurePapelizPdfExportTextContentWidths,
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
  type PapelizPdfExportOperationTagging,
  type PapelizPdfExportPageOperation,
  type PapelizPdfExportStructureElement,
  type PapelizPdfExportStructureRole,
} from './papeliz-pdf-export-page-layout-plan'
import type { PapelizPdfExportTextMeasurer } from './papeliz-pdf-export-text-measuring'
import {
  createPapelizPdfExportIconVectorDrawing,
  findPapelizPdfExportVectorDrawingProblem,
  getPapelizPdfExportPropertyIconName,
  type PapelizPdfExportVectorDrawing,
} from './papeliz-pdf-export-vector-drawing'

// Each block of the note as lines in MD View's print sizes (the shared print style), with the spaces
// around it, its box, and the rules for where a page may break inside it. Blocks inside lists, quotes,
// callouts and footnotes become blocks of their own, indented to their place: a list item's bullet,
// number or task box sits beside its first line, and a quote's bar or a callout's card beside or
// behind every page's piece of it. A table is one block whose lines are its rows. The
// structure a screen reader follows (lists, quotes, links, footnotes) and the bookmarks come out of
// the same walk.

export interface PapelizPdfExportBlockBox {
  boxPaddingTopPoints: number
  boxPaddingBottomPoints: number
  boxPaddingHorizontalPoints: number
  // null: no ground (a table's).
  boxGroundColor: string | null
  boxBorderColor: string
  boxBorderWidthPoints: number
  boxCornerRadiusPoints: number
}

// What holds blocks and is drawn beside or behind every page's piece of them: a quote's bar, a
// callout's card. Its insets reach from its first block's first line up to its top edge, and from its
// last block's last line down to its bottom edge, so a page that starts or ends inside it shows only
// what is on that page.
export interface PapelizPdfExportBlockContainer {
  containerKey: string
  // From the content area's left edge.
  containerLeftPoints: number
  containerWidthPoints: number
  containerGroundColor: string
  containerCornerRadiusPoints: number
  containerTopInsetPoints: number
  containerBottomInsetPoints: number
  containerFirstBlock: PapelizPdfExportLaidOutBlock | null
  containerLastBlock: PapelizPdfExportLaidOutBlock | null
}

export interface PapelizPdfExportLaidOutBlock {
  // From the content area's left edge, and the room it takes from there.
  blockLeftPoints: number
  blockWidthPoints: number
  // Margins, which overlap a neighbour's as CSS margins do; the first block on a page drops its own.
  blockSpaceAbovePoints: number
  blockSpaceBelowPoints: number
  // Space inside the containers the block opens or closes (their padding, and the margins inside
  // it), which never overlaps and stays at a page's top.
  blockFixedSpaceAbovePoints: number
  blockFixedSpaceBelowPoints: number
  blockLines: PapelizPdfExportLaidOutLine[]
  // Drawn behind each page's piece of the block, with full padding.
  blockBox: PapelizPdfExportBlockBox | null
  // The containers the block sits in, outermost first.
  blockContainers: PapelizPdfExportBlockContainer[]
  // A table's header row, drawn again at the top of every page the table runs onto.
  isBlockFirstLineRepeated: boolean
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
// A quote: 6px above and 18px below it, 2px of padding inside its bar, which is 3px wide.
const papelizPdfExportQuotePaddingVerticalPoints = scalePapelizMdViewPixelsToPrintPoints(2)
// A callout's card: 16px corners, MD View's padding, 7px between the icon and the title.
const papelizPdfExportCalloutCornerRadiusPoints = scalePapelizMdViewPixelsToPrintPoints(16)
// A callout of at most this many lines stays on one page; a longer one keeps its title with the start.
const papelizPdfExportCalloutKeptWholeLineCount = 6
// A property chip's icon: 14px, 6px before the name.
const papelizPdfExportPropertyIconSizePoints = scalePapelizMdViewPixelsToPrintPoints(14)
// Tables: MD View's 14px corners; text shrinks to this before long words break.
const papelizPdfExportTableCornerRadiusPoints = scalePapelizMdViewPixelsToPrintPoints(14)
const papelizPdfExportTableSmallestTextSizePoints = 7.5
// MD View rounds a picture's corners by 12px; a picture leaves 24 pt of a page for the lines around it.
const papelizPdfExportPictureCornerRadiusPoints = scalePapelizMdViewPixelsToPrintPoints(12)
const papelizPdfExportPictureHeightMarginPoints = 24
// A diagram that can't be drawn: its source, then MD View's error line in 13.5px text.
const papelizPdfExportDiagramErrorPaddingVerticalPoints = scalePapelizMdViewPixelsToPrintPoints(8)
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
  placeContainers: readonly PapelizPdfExportBlockContainer[]
  parentStructureElementKey: string | null
  // MD View sets a task item's paragraphs without gaps (`li.task-list-item > p`).
  isInsideTaskListItem: boolean
  // How many lists hold this place (a list here takes the next bullet), and whether it is a list
  // item's own body (a list here is nested, with 4px above it).
  placeListDepth: number
  isListItemPlace: boolean
  // In a footnote, a picture takes at most a third of a page's height.
  isSmallPictureRoom: boolean
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
  nextContainerNumber: number
  contentHeightPoints: number
  // The note's pictures that passed the worker's check.
  usableNotePictureIndexes: ReadonlySet<number>
}

interface PapelizPdfExportBlockTextLook {
  noteFontFamilyName: PapelizPdfExportFontFamilyName
  blockFontWeight: PapelizPdfExportFontWeight
  blockTextSizePoints: number
  blockTextColor: string
  blockLetterSpacingPoints: number
}

function addStructureElement(structureRole: PapelizPdfExportStructureRole, parentStructureElementKey: string | null, noteLayout: PapelizPdfExportNoteLayout, structureAlternateText: string | null = null): string {
  const structureElementKey = `structure-${noteLayout.nextStructureElementNumber}`
  noteLayout.nextStructureElementNumber += 1
  noteLayout.structureElements.push({ structureElementKey, structureRole, parentStructureElementKey, structureAlternateText })
  return structureElementKey
}

// A link's own structure element, inside the block that shows it; once per link.
function getLinkStructureElementKey(textRunLink: PapelizPdfExportTextRunLink, blockStructureElementKey: string, noteLayout: PapelizPdfExportNoteLayout): string {
  const linkStructureElementKey = `link-${textRunLink.noteLinkNumber}`
  if (!noteLayout.linkStructureElementKeys.has(linkStructureElementKey)) {
    noteLayout.linkStructureElementKeys.add(linkStructureElementKey)
    noteLayout.structureElements.push({ structureElementKey: linkStructureElementKey, structureRole: 'Link', parentStructureElementKey: blockStructureElementKey, structureAlternateText: null })
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
    textInlinePicture: null,
  }
}

// An icon or a picture takes the place of one object character, which breaks as a picture in a line.
const papelizPdfExportInlineIconStandInText = '\uFFFC'

// The room a picture in a block may take: the block's width, and a page's height (less a margin for
// the lines around it), or a third of it in a table row or a footnote.
interface PapelizPdfExportPictureRoom {
  pictureRoomWidthPoints: number
  pictureRoomHeightPoints: number
}

// MD View's size for a picture on the 17 px -> 11 pt scale, made smaller to fit its room, its shape kept.
function fitPictureSizePoints(pictureShownPixelWidth: number, pictureShownPixelHeight: number, pictureRoom: PapelizPdfExportPictureRoom): { pictureWidthPoints: number; pictureHeightPoints: number } {
  const scaledWidthPoints = scalePapelizMdViewPixelsToPrintPoints(Math.max(1, pictureShownPixelWidth))
  const scaledHeightPoints = scalePapelizMdViewPixelsToPrintPoints(Math.max(1, pictureShownPixelHeight))
  const fitScale = Math.min(1, pictureRoom.pictureRoomWidthPoints / scaledWidthPoints, pictureRoom.pictureRoomHeightPoints / scaledHeightPoints)
  return { pictureWidthPoints: scaledWidthPoints * fitScale, pictureHeightPoints: scaledHeightPoints * fitScale }
}

function buildStyledTextPieces(
  inlineRuns: readonly PapelizPdfExportInlineRun[],
  blockTextLook: PapelizPdfExportBlockTextLook,
  blockStructureElementKey: string,
  noteLayout: PapelizPdfExportNoteLayout,
  pictureRoom: PapelizPdfExportPictureRoom,
): PapelizPdfExportStyledTextPiece[] {
  return inlineRuns.map((inlineRun): PapelizPdfExportStyledTextPiece => {
    if (inlineRun.inlineRunKind === 'line-break') return { styledPieceKind: 'line-break' }
    const pieceStyle = resolveTextRunStyle(inlineRun.textRunLook, inlineRun.textRunLink, blockTextLook, blockStructureElementKey, noteLayout)
    if (inlineRun.inlineRunKind === 'icon') {
      return { styledPieceKind: 'text', pieceText: papelizPdfExportInlineIconStandInText, pieceStyle: { ...pieceStyle, textInlineIcon: { inlineIconName: inlineRun.inlineIconName } } }
    }
    if (inlineRun.inlineRunKind === 'picture') {
      // A picture the worker's check refused prints as MD View's chip.
      if (!noteLayout.usableNotePictureIndexes.has(inlineRun.notePictureIndex)) return { styledPieceKind: 'text', pieceText: `Picture: ${inlineRun.pictureAlternateText}`.trimEnd(), pieceStyle }
      const { pictureWidthPoints, pictureHeightPoints } = fitPictureSizePoints(inlineRun.pictureShownPixelWidth, inlineRun.pictureShownPixelHeight, pictureRoom)
      return {
        styledPieceKind: 'text',
        pieceText: papelizPdfExportInlineIconStandInText,
        pieceStyle: {
          ...pieceStyle,
          textChip: null,
          textInlinePicture: {
            notePictureIndex: inlineRun.notePictureIndex,
            pictureWidthPoints,
            pictureHeightPoints,
            pictureCornerRadiusPoints: Math.min(papelizPdfExportPictureCornerRadiusPoints, pictureWidthPoints / 2, pictureHeightPoints / 2),
            figureStructureElementKey: addStructureElement('Figure', pieceStyle.textLink?.linkStructureElementKey ?? blockStructureElementKey, noteLayout, inlineRun.pictureAlternateText),
          },
        },
      }
    }
    return { styledPieceKind: 'text', pieceText: inlineRun.textRunText, pieceStyle: { ...pieceStyle, textDestinationName: inlineRun.textRunDestinationName } }
  })
}

function getBlockPictureRoom(blockPlace: PapelizPdfExportBlockPlace, noteLayout: PapelizPdfExportNoteLayout, isSmallPictureRoom = false): PapelizPdfExportPictureRoom {
  return {
    pictureRoomWidthPoints: blockPlace.placeWidthPoints,
    pictureRoomHeightPoints: isSmallPictureRoom ? noteLayout.contentHeightPoints / 3 : noteLayout.contentHeightPoints - papelizPdfExportPictureHeightMarginPoints,
  }
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
      case 'vector-drawing':
        return { ...pageOperation, drawingLeftPoints: roundPapelizPdfExportPoints(pageOperation.drawingLeftPoints + leftPoints), drawingTopPoints: roundPapelizPdfExportPoints(pageOperation.drawingTopPoints + topPoints) }
      case 'picture':
        return { ...pageOperation, pictureLeftPoints: roundPapelizPdfExportPoints(pageOperation.pictureLeftPoints + leftPoints), pictureTopPoints: roundPapelizPdfExportPoints(pageOperation.pictureTopPoints + topPoints) }
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
  const styledTextOperations = createPapelizPdfExportStyledTextOperations(
    textToPrint,
    { textFontStyle, textSizePoints, textColor, characterSpacingPoints: 0, openTypeFeatureSet: 'standard' },
    textLeftPoints,
    textBaselinePoints,
    { operationTaggingKind: 'structure', structureElementKey },
    noteLayout.textMeasurer,
  )
  noteLayout.missingCharacterCount += styledTextOperations.missingCharacterCount
  return { textRunOperations: [...styledTextOperations.pictureOperations, ...styledTextOperations.textOperations], textWidthPoints: styledTextOperations.textWidthPoints }
}

type PapelizPdfExportPlacedBlockParts = Omit<
  PapelizPdfExportLaidOutBlock,
  'blockContainers' | 'blockLeftPoints' | 'blockWidthPoints' | 'blockFixedSpaceAbovePoints' | 'blockFixedSpaceBelowPoints' | 'isBlockFirstLineRepeated'
> &
  Partial<Pick<PapelizPdfExportLaidOutBlock, 'blockWidthPoints' | 'isBlockFirstLineRepeated'>>

function pushLaidOutBlock(laidOutBlock: PapelizPdfExportPlacedBlockParts, blockPlace: PapelizPdfExportBlockPlace, noteLayout: PapelizPdfExportNoteLayout): void {
  noteLayout.missingCharacterCount += countMissingCharacters(laidOutBlock.blockLines)
  noteLayout.laidOutBlocks.push({
    blockWidthPoints: blockPlace.placeWidthPoints,
    isBlockFirstLineRepeated: false,
    ...laidOutBlock,
    blockLeftPoints: blockPlace.placeLeftPoints,
    blockFixedSpaceAbovePoints: 0,
    blockFixedSpaceBelowPoints: 0,
    blockContainers: [...blockPlace.placeContainers],
  })
}

interface PapelizPdfExportContainerSpacing {
  containerMarginTopPoints: number
  containerMarginBottomPoints: number
  containerPaddingTopPoints: number
  containerPaddingBottomPoints: number
  // MD View drops the last block's margin inside a callout's body (`> :last-child`).
  isLastInnerMarginDropped: boolean
}

// The blocks laid out since `firstBlockIndex` go inside the container: its padding and the inner
// margins next to it become fixed space, and its own margins overlap its neighbours'.
function closeBlockContainer(blockContainer: PapelizPdfExportBlockContainer, firstBlockIndex: number, containerSpacing: PapelizPdfExportContainerSpacing, noteLayout: PapelizPdfExportNoteLayout): void {
  const firstContainedBlock = noteLayout.laidOutBlocks[firstBlockIndex]
  const lastContainedBlock = noteLayout.laidOutBlocks.at(-1)
  if (firstContainedBlock === undefined || lastContainedBlock === undefined || noteLayout.laidOutBlocks.length <= firstBlockIndex) return
  blockContainer.containerTopInsetPoints = containerSpacing.containerPaddingTopPoints + firstContainedBlock.blockSpaceAbovePoints + firstContainedBlock.blockFixedSpaceAbovePoints
  firstContainedBlock.blockFixedSpaceAbovePoints = blockContainer.containerTopInsetPoints
  firstContainedBlock.blockSpaceAbovePoints = containerSpacing.containerMarginTopPoints
  blockContainer.containerBottomInsetPoints =
    (containerSpacing.isLastInnerMarginDropped ? 0 : lastContainedBlock.blockSpaceBelowPoints) + lastContainedBlock.blockFixedSpaceBelowPoints + containerSpacing.containerPaddingBottomPoints
  lastContainedBlock.blockFixedSpaceBelowPoints = blockContainer.containerBottomInsetPoints
  lastContainedBlock.blockSpaceBelowPoints = containerSpacing.containerMarginBottomPoints
  blockContainer.containerFirstBlock = firstContainedBlock
  blockContainer.containerLastBlock = lastContainedBlock
}

function createBlockContainer(containerLeftPoints: number, containerWidthPoints: number, containerGroundColor: string, containerCornerRadiusPoints: number, noteLayout: PapelizPdfExportNoteLayout): PapelizPdfExportBlockContainer {
  const containerKey = `container-${noteLayout.nextContainerNumber}`
  noteLayout.nextContainerNumber += 1
  return {
    containerKey,
    containerLeftPoints,
    containerWidthPoints,
    containerGroundColor,
    containerCornerRadiusPoints,
    containerTopInsetPoints: 0,
    containerBottomInsetPoints: 0,
    containerFirstBlock: null,
    containerLastBlock: null,
  }
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
    styledTextPieces: buildStyledTextPieces(headingBlock.headingInlineRuns, blockTextLook, structureElementKey, noteLayout, getBlockPictureRoom(blockPlace, noteLayout)),
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
    styledTextPieces: buildStyledTextPieces(paragraphBlock.paragraphInlineRuns, blockTextLook, structureElementKey, noteLayout, getBlockPictureRoom(blockPlace, noteLayout, blockPlace.isSmallPictureRoom)),
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

// A diagram as MD View draws it: its picture centered, made smaller to fit, never split. A picture
// the worker's check refused leaves the diagram's source.
interface PapelizPdfExportPreparedVectorDrawing {
  vectorDrawing: PapelizPdfExportVectorDrawing
  vectorTextRunFontFaceKeys: string[]
}

// A diagram's vector drawing ready to draw: each label split into the faces that draw it, each piece
// placed after the one before as measured. Null (the picture is drawn then) when the drawing fails its
// check or a label has characters no embedded face draws as they are.
function prepareDiagramVectorDrawing(vectorDrawing: PapelizPdfExportVectorDrawing, noteLayout: PapelizPdfExportNoteLayout): PapelizPdfExportPreparedVectorDrawing | null {
  if (findPapelizPdfExportVectorDrawingProblem(vectorDrawing) !== null) return null
  const vectorTextRuns: PapelizPdfExportVectorDrawing['vectorTextRuns'] = []
  const vectorTextRunFontFaceKeys: string[] = []
  for (const vectorTextRun of vectorDrawing.vectorTextRuns) {
    const labelFontFamilyName = vectorTextRun.vectorTextRunFontFamilyName
    const labelFontStyle: PapelizPdfExportFontStyle = {
      fontFamilyName: labelFontFamilyName,
      fontWeight: choosePapelizPdfExportFontWeight(labelFontFamilyName, vectorTextRun.vectorTextRunFontWeight),
      isFontItalic: vectorTextRun.isVectorTextRunItalic,
    }
    let pieceLeft = vectorTextRun.vectorTextRunLeft
    for (const fontPiece of noteLayout.textMeasurer.splitTextIntoFontPieces(vectorTextRun.vectorTextRunText, labelFontStyle)) {
      if (fontPiece.fontFaceKey === null || fontPiece.isFontPieceSlanted || fontPiece.isFontPieceThickened) return null
      vectorTextRuns.push({ ...vectorTextRun, vectorTextRunText: fontPiece.fontPieceText, vectorTextRunLeft: pieceLeft })
      vectorTextRunFontFaceKeys.push(fontPiece.fontFaceKey)
      pieceLeft += noteLayout.textMeasurer.measureTextWidthPoints(fontPiece.fontPieceText, fontPiece.fontFaceKey, vectorTextRun.vectorTextRunSize, 0, 'standard')
    }
  }
  return { vectorDrawing: { ...vectorDrawing, vectorTextRuns }, vectorTextRunFontFaceKeys }
}

function layOutDiagram(diagramBlock: Extract<PapelizPdfExportNoteBlock, { noteBlockKind: 'diagram' }>, blockPlace: PapelizPdfExportBlockPlace, noteLayout: PapelizPdfExportNoteLayout): void {
  const preparedVectorDrawing = diagramBlock.diagramVectorDrawing === null ? null : prepareDiagramVectorDrawing(diagramBlock.diagramVectorDrawing, noteLayout)
  if (preparedVectorDrawing === null && !noteLayout.usableNotePictureIndexes.has(diagramBlock.notePictureIndex)) {
    layOutCodeBox(diagramBlock.diagramAlternateText, null, blockPlace, noteLayout)
    return
  }
  const { pictureWidthPoints, pictureHeightPoints } = fitPictureSizePoints(diagramBlock.pictureShownPixelWidth, diagramBlock.pictureShownPixelHeight, getBlockPictureRoom(blockPlace, noteLayout))
  const figureStructureElementKey = addStructureElement('Figure', blockPlace.parentStructureElementKey, noteLayout, diagramBlock.diagramAlternateText)
  const diagramLeftPoints = roundPapelizPdfExportPoints((blockPlace.placeWidthPoints - pictureWidthPoints) / 2)
  const figureTagging: PapelizPdfExportOperationTagging = { operationTaggingKind: 'structure', structureElementKey: figureStructureElementKey }
  // As vectors, its labels real text, at the picture's size; else as the picture.
  const diagramOperation: PapelizPdfExportPageOperation =
    preparedVectorDrawing === null
      ? {
          pageOperationKind: 'picture',
          pictureSource: { pictureSourceKind: 'note-picture', notePictureIndex: diagramBlock.notePictureIndex },
          pictureLeftPoints: diagramLeftPoints,
          pictureTopPoints: 0,
          pictureWidthPoints: roundPapelizPdfExportPoints(pictureWidthPoints),
          pictureHeightPoints: roundPapelizPdfExportPoints(pictureHeightPoints),
          pictureCornerRadiusPoints: 0,
          operationTagging: figureTagging,
        }
      : {
          pageOperationKind: 'vector-drawing',
          vectorDrawing: preparedVectorDrawing.vectorDrawing,
          vectorTextRunFontFaceKeys: preparedVectorDrawing.vectorTextRunFontFaceKeys,
          drawingLeftPoints: diagramLeftPoints,
          drawingTopPoints: 0,
          drawingScale: pictureWidthPoints / preparedVectorDrawing.vectorDrawing.vectorDrawingWidth,
          operationTagging: figureTagging,
        }
  pushLaidOutBlock(
    {
      blockSpaceAbovePoints: papelizExportPrintSpacingInPoints.blockSpaceAbovePoints,
      blockSpaceBelowPoints: papelizExportPrintSpacingInPoints.blockSpaceBelowPoints,
      blockLines: [
        {
          lineHeightPoints: roundPapelizPdfExportPoints(pictureHeightPoints),
          lineBaselinePoints: roundPapelizPdfExportPoints(pictureHeightPoints),
          lineContentWidthPoints: roundPapelizPdfExportPoints(blockPlace.placeWidthPoints),
          lineOperations: [diagramOperation],
          missingCharacterCount: 0,
        },
      ],
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

// MD View's error line under a diagram's source, in the error colors, kept with the source.
function layOutDiagramErrorLine(codeBoxErrorText: string, blockPlace: PapelizPdfExportBlockPlace, noteLayout: PapelizPdfExportNoteLayout): void {
  const structureElementKey = addStructureElement('P', blockPlace.parentStructureElementKey, noteLayout)
  const errorTextSizePoints = papelizExportPrintTextSizesInPoints.codeBlockTextSizePoints
  const errorBox: PapelizPdfExportBlockBox = {
    boxPaddingTopPoints: papelizPdfExportDiagramErrorPaddingVerticalPoints,
    boxPaddingBottomPoints: papelizPdfExportDiagramErrorPaddingVerticalPoints,
    boxPaddingHorizontalPoints: papelizExportPrintSpacingInPoints.codeBlockPaddingHorizontalPoints,
    boxGroundColor: papelizExportPrintColorsByToken['--color-papeliz-error-notice-ground'],
    boxBorderColor: papelizExportPrintColorsByToken['--color-papeliz-error-notice-line'],
    boxBorderWidthPoints: papelizExportPrintSpacingInPoints.hairlineWidthPoints,
    boxCornerRadiusPoints: scalePapelizMdViewPixelsToPrintPoints(14),
  }
  const errorLines = layOutPapelizPdfExportTextLines({
    styledTextPieces: [
      {
        styledPieceKind: 'text',
        pieceText: codeBoxErrorText,
        pieceStyle: {
          textFontStyle: getNoteTextFontStyle(noteLayout),
          textSizePoints: errorTextSizePoints,
          textColor: papelizExportPrintColorsByToken['--color-papeliz-error-notice-ink'],
          characterSpacingPoints: 0,
          openTypeFeatureSet: 'standard',
          textUnderline: null,
          isTextStruck: false,
          baselineShiftPoints: 0,
          textChip: null,
          textLink: null,
          textDestinationName: null,
          textInlineIcon: null,
          textInlinePicture: null,
        },
      },
    ],
    lineWidthPoints: blockPlace.placeWidthPoints - 2 * (errorBox.boxPaddingHorizontalPoints + errorBox.boxBorderWidthPoints),
    lineStrut: { strutFontStyle: getNoteTextFontStyle(noteLayout), strutTextSizePoints: errorTextSizePoints, lineHeightRatio: papelizExportBodyLineHeight },
    wrappedLineIndentPoints: 0,
    structureElementKey,
    textMeasurer: noteLayout.textMeasurer,
  })
  pushLaidOutBlock(
    {
      blockSpaceAbovePoints: 0,
      blockSpaceBelowPoints: papelizExportPrintSpacingInPoints.blockSpaceBelowPoints,
      blockLines: errorLines,
      blockBox: errorBox,
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

function layOutCodeBox(codeBoxText: string, codeBoxErrorText: string | null, blockPlace: PapelizPdfExportBlockPlace, noteLayout: PapelizPdfExportNoteLayout): void {
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
    textInlinePicture: null,
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
      blockSpaceBelowPoints: codeBoxErrorText === null ? papelizExportPrintSpacingInPoints.blockSpaceBelowPoints : 0,
      blockLines: codeBoxLines,
      blockBox: papelizPdfExportCodeBoxLook,
      isBlockKeptWithNext: codeBoxErrorText !== null,
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
          lineContentWidthPoints: roundPapelizPdfExportPoints(blockPlace.placeWidthPoints),
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
      // Digits and the dot are always in the family's `latin` file.
      const numberFontFaceKey = getPapelizPdfExportLatinFontFaceKey(numberFontStyle)
      const spaceWidthPoints = noteLayout.textMeasurer.measureTextWidthPoints(' ', numberFontFaceKey, markerTextSizePoints, 0, 'standard')
      const numberWidthPoints = noteLayout.textMeasurer.measureTextWidthPoints(numberText, numberFontFaceKey, markerTextSizePoints, 0, 'standard')
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

// A quote: its blocks indented past its bar, in the muted ink, the bar beside every page's piece.
function layOutQuote(quoteBlocks: readonly PapelizPdfExportNoteBlock[], blockPlace: PapelizPdfExportBlockPlace, noteLayout: PapelizPdfExportNoteLayout): void {
  const quoteIndentPoints = papelizExportPrintSpacingInPoints.quoteBarWidthPoints + papelizExportPrintSpacingInPoints.quoteIndentPoints
  const quoteBar = createBlockContainer(blockPlace.placeLeftPoints, papelizExportPrintSpacingInPoints.quoteBarWidthPoints, papelizExportPrintColorsByToken['--color-papeliz-line-strong'], 0, noteLayout)
  const firstQuoteBlockIndex = noteLayout.laidOutBlocks.length
  layOutNoteBlocks(
    quoteBlocks,
    {
      ...blockPlace,
      placeLeftPoints: blockPlace.placeLeftPoints + quoteIndentPoints,
      placeWidthPoints: blockPlace.placeWidthPoints - quoteIndentPoints,
      placeTextColor: blockPlace.placeTextColor ?? papelizExportPrintColorsByToken['--color-papeliz-ink-muted'],
      placeContainers: [...blockPlace.placeContainers, quoteBar],
      parentStructureElementKey: addStructureElement('BlockQuote', blockPlace.parentStructureElementKey, noteLayout),
      isInsideTaskListItem: false,
      isListItemPlace: false,
    },
    noteLayout,
  )
  closeBlockContainer(
    quoteBar,
    firstQuoteBlockIndex,
    {
      containerMarginTopPoints: papelizExportPrintSpacingInPoints.blockSpaceAbovePoints,
      containerMarginBottomPoints: papelizExportPrintSpacingInPoints.blockSpaceBelowPoints,
      containerPaddingTopPoints: papelizPdfExportQuotePaddingVerticalPoints,
      containerPaddingBottomPoints: papelizPdfExportQuotePaddingVerticalPoints,
      isLastInnerMarginDropped: false,
    },
    noteLayout,
  )
}

// MD View's callout title: the kind's icon, then the title in the callout's ink, 14px and bold,
// the icon in the middle of the first line.
function layOutCalloutTitle(calloutBlock: Extract<PapelizPdfExportNoteBlock, { noteBlockKind: 'callout' }>, titlePlace: PapelizPdfExportBlockPlace, noteLayout: PapelizPdfExportNoteLayout): void {
  const { calloutIconSizePoints, calloutIconGapPoints, calloutTitleSpaceBelowPoints } = papelizExportPrintSpacingInPoints
  const calloutTitleTextSizePoints = papelizExportPrintTextSizesInPoints.calloutTitleTextSizePoints
  const iconSpacePoints = calloutIconSizePoints + calloutIconGapPoints
  const structureElementKey = addStructureElement('P', titlePlace.parentStructureElementKey, noteLayout)
  const blockTextLook: PapelizPdfExportBlockTextLook = {
    noteFontFamilyName: noteLayout.noteFontFamilyName,
    blockFontWeight: 600,
    blockTextSizePoints: calloutTitleTextSizePoints,
    blockTextColor: calloutBlock.calloutInkColor,
    blockLetterSpacingPoints: 0,
  }
  const titleLines = layOutPapelizPdfExportTextLines({
    styledTextPieces: buildStyledTextPieces(calloutBlock.calloutTitleInlineRuns, blockTextLook, structureElementKey, noteLayout, getBlockPictureRoom(titlePlace, noteLayout, true)),
    lineWidthPoints: titlePlace.placeWidthPoints - iconSpacePoints,
    lineStrut: { strutFontStyle: getNoteTextFontStyle(noteLayout, 600), strutTextSizePoints: calloutTitleTextSizePoints, lineHeightRatio: papelizExportBodyLineHeight },
    wrappedLineIndentPoints: 0,
    structureElementKey,
    textMeasurer: noteLayout.textMeasurer,
  })
  const firstTitleLine = titleLines[0]
  if (firstTitleLine !== undefined) {
    firstTitleLine.lineOperations.unshift({
      pageOperationKind: 'vector-drawing',
      vectorDrawing: createPapelizPdfExportIconVectorDrawing(calloutBlock.calloutIconName, calloutBlock.calloutInkColor),
      vectorTextRunFontFaceKeys: [],
      drawingLeftPoints: roundPapelizPdfExportPoints(-iconSpacePoints),
      drawingTopPoints: roundPapelizPdfExportPoints((firstTitleLine.lineHeightPoints - calloutIconSizePoints) / 2),
      drawingScale: roundPapelizPdfExportPoints(calloutIconSizePoints / papelizPdfExportIconViewBoxSize),
      operationTagging: { operationTaggingKind: 'artifact', artifactType: 'Layout' },
    })
  }
  pushLaidOutBlock(
    {
      blockSpaceAbovePoints: 0,
      blockSpaceBelowPoints: calloutTitleSpaceBelowPoints,
      blockLines: titleLines,
      blockBox: null,
      isBlockKeptWithNext: calloutBlock.calloutBlocks.length > 0,
      blockKeptWholeLineCount: Number.POSITIVE_INFINITY,
      minimumLinesBeforePageBreak: 1,
      minimumLinesAfterPageBreak: 1,
      isBlockLeftOutAtPageTop: false,
    },
    { ...titlePlace, placeLeftPoints: titlePlace.placeLeftPoints + iconSpacePoints, placeWidthPoints: titlePlace.placeWidthPoints - iconSpacePoints },
    noteLayout,
  )
}

// A callout as MD View's card: its ground behind every page's piece, the title, then the body in 16px
// text. Six lines or fewer stay on one page; a longer one keeps its title with the body's start.
function layOutCallout(calloutBlock: Extract<PapelizPdfExportNoteBlock, { noteBlockKind: 'callout' }>, blockPlace: PapelizPdfExportBlockPlace, noteLayout: PapelizPdfExportNoteLayout): void {
  const { calloutPaddingHorizontalPoints, calloutPaddingVerticalPoints } = papelizExportPrintSpacingInPoints
  const calloutCard = createBlockContainer(blockPlace.placeLeftPoints, blockPlace.placeWidthPoints, calloutBlock.calloutGroundColor, papelizPdfExportCalloutCornerRadiusPoints, noteLayout)
  const calloutPlace: PapelizPdfExportBlockPlace = {
    ...blockPlace,
    placeLeftPoints: blockPlace.placeLeftPoints + calloutPaddingHorizontalPoints,
    placeWidthPoints: blockPlace.placeWidthPoints - 2 * calloutPaddingHorizontalPoints,
    placeTextSizePoints: papelizExportPrintTextSizesInPoints.calloutBodyTextSizePoints,
    placeContainers: [...blockPlace.placeContainers, calloutCard],
    parentStructureElementKey: addStructureElement('Div', blockPlace.parentStructureElementKey, noteLayout),
    isInsideTaskListItem: false,
    isListItemPlace: false,
  }
  const firstCalloutBlockIndex = noteLayout.laidOutBlocks.length
  layOutCalloutTitle(calloutBlock, calloutPlace, noteLayout)
  layOutNoteBlocks(calloutBlock.calloutBlocks, calloutPlace, noteLayout)
  const calloutLaidOutBlocks = noteLayout.laidOutBlocks.slice(firstCalloutBlockIndex)
  if (calloutLaidOutBlocks.reduce((calloutLineCount, laidOutBlock) => calloutLineCount + laidOutBlock.blockLines.length, 0) <= papelizPdfExportCalloutKeptWholeLineCount) {
    for (const calloutLaidOutBlock of calloutLaidOutBlocks.slice(0, -1)) {
      calloutLaidOutBlock.isBlockKeptWithNext = true
      calloutLaidOutBlock.blockKeptWholeLineCount = Number.POSITIVE_INFINITY
    }
    const lastCalloutLaidOutBlock = calloutLaidOutBlocks.at(-1)
    if (lastCalloutLaidOutBlock !== undefined) lastCalloutLaidOutBlock.blockKeptWholeLineCount = Number.POSITIVE_INFINITY
  }
  closeBlockContainer(
    calloutCard,
    firstCalloutBlockIndex,
    {
      containerMarginTopPoints: papelizExportPrintSpacingInPoints.blockSpaceAbovePoints,
      containerMarginBottomPoints: papelizExportPrintSpacingInPoints.blockSpaceBelowPoints,
      containerPaddingTopPoints: calloutPaddingVerticalPoints,
      containerPaddingBottomPoints: calloutPaddingVerticalPoints,
      isLastInnerMarginDropped: true,
    },
    noteLayout,
  )
}

interface PapelizPdfExportTableCellLayout {
  tableCellStructureElementKey: string
  tableCellStyledPieces: PapelizPdfExportStyledTextPiece[]
  tableCellAlignment: 'left' | 'center' | 'right'
}

// A row taller than a page, cut between lines into pieces that fit: each cell takes its lines while
// they fit, the first piece keeps the top padding and the last the bottom.
function sliceTableRowCells(cellLines: readonly PapelizPdfExportLaidOutLine[][], sliceRoomPoints: number): PapelizPdfExportLaidOutLine[][][] {
  const rowSlices: PapelizPdfExportLaidOutLine[][][] = []
  const remainingCellLines = cellLines.map((cellLineList) => [...cellLineList])
  while (remainingCellLines.some((cellLineList) => cellLineList.length > 0)) {
    rowSlices.push(
      remainingCellLines.map((cellLineList) => {
        const slicedLines: PapelizPdfExportLaidOutLine[] = []
        let slicedHeightPoints = 0
        while (cellLineList.length > 0) {
          const nextLine = cellLineList[0] as PapelizPdfExportLaidOutLine
          if (slicedLines.length > 0 && slicedHeightPoints + nextLine.lineHeightPoints > sliceRoomPoints) break
          slicedLines.push(cellLineList.shift() as PapelizPdfExportLaidOutLine)
          slicedHeightPoints += nextLine.lineHeightPoints
        }
        return slicedLines
      }),
    )
  }
  return rowSlices
}

// The top edge of a rectangle with only its top corners rounded, as path data in points.
function describeTopRoundedRectanglePathData(rectangleWidthPoints: number, rectangleHeightPoints: number, cornerRadiusPoints: number): string {
  const n = (pathNumber: number) => String(roundPapelizPdfExportPoints(pathNumber))
  const radius = Math.min(cornerRadiusPoints, rectangleWidthPoints / 2, rectangleHeightPoints)
  return `M0 ${n(radius)}A${n(radius)} ${n(radius)} 0 0 1 ${n(radius)} 0H${n(rectangleWidthPoints - radius)}A${n(radius)} ${n(radius)} 0 0 1 ${n(rectangleWidthPoints)} ${n(radius)}V${n(rectangleHeightPoints)}H0Z`
}

// A Markdown table as MD View draws it: a rounded border, a shaded header row, a line between rows.
// Columns are sized as a browser's automatic layout sizes them, from each column's narrowest and
// widest content; a table too wide for the page sets its text at 7.5 pt, then breaks long words. Rows
// never split (only one taller than a page), and the header row repeats on every page.
function layOutTable(tableBlock: Extract<PapelizPdfExportNoteBlock, { noteBlockKind: 'table' }>, blockPlace: PapelizPdfExportBlockPlace, noteLayout: PapelizPdfExportNoteLayout): void {
  const { tableCellPaddingHorizontalPoints, tableCellPaddingVerticalPoints, hairlineWidthPoints } = papelizExportPrintSpacingInPoints
  const tableStructureElementKey = addStructureElement('Table', blockPlace.parentStructureElementKey, noteLayout)
  const tableColumnCount = Math.max(1, ...tableBlock.tableRows.map((tableRow) => tableRow.tableCells.length))
  const tableRoomPoints = blockPlace.placeWidthPoints - 2 * hairlineWidthPoints
  const tableRowStructureElementKeys = tableBlock.tableRows.map(() => addStructureElement('TR', tableStructureElementKey, noteLayout))
  const tableCellStructureElementKeys = tableBlock.tableRows.map((tableRow, tableRowIndex) =>
    tableRow.tableCells.map(() => addStructureElement(tableRow.isTableHeaderRow ? 'TH' : 'TD', tableRowStructureElementKeys[tableRowIndex] ?? tableStructureElementKey, noteLayout)),
  )
  const buildCellLayouts = (tableTextSizePoints: number): PapelizPdfExportTableCellLayout[][] =>
    tableBlock.tableRows.map((tableRow, tableRowIndex) =>
      tableRow.tableCells.map((tableCell, tableCellIndex) => {
        const tableCellStructureElementKey = tableCellStructureElementKeys[tableRowIndex]?.[tableCellIndex] ?? tableStructureElementKey
        const blockTextLook: PapelizPdfExportBlockTextLook = {
          noteFontFamilyName: noteLayout.noteFontFamilyName,
          blockFontWeight: tableRow.isTableHeaderRow ? 600 : 400,
          blockTextSizePoints: tableTextSizePoints,
          blockTextColor: blockPlace.placeTextColor ?? papelizPdfExportInkColor,
          blockLetterSpacingPoints: 0,
        }
        return {
          tableCellStructureElementKey,
          tableCellStyledPieces: buildStyledTextPieces(tableCell.tableCellInlineRuns, blockTextLook, tableCellStructureElementKey, noteLayout, {
            pictureRoomWidthPoints: tableRoomPoints / tableColumnCount - 2 * tableCellPaddingHorizontalPoints,
            pictureRoomHeightPoints: noteLayout.contentHeightPoints / 3,
          }),
          tableCellAlignment: tableCell.tableCellAlignment,
        }
      }),
    )
  const createCellLineStrut = (tableTextSizePoints: number, isTableHeaderRow: boolean): PapelizPdfExportLineStrut => ({
    strutFontStyle: getNoteTextFontStyle(noteLayout, isTableHeaderRow ? 600 : 400),
    strutTextSizePoints: tableTextSizePoints,
    lineHeightRatio: papelizExportBodyLineHeight,
  })
  // Each column's narrowest and widest content, padding included, at a text size.
  const measureColumns = (tableTextSizePoints: number, cellLayouts: PapelizPdfExportTableCellLayout[][]) => {
    const columnMinimumWidthsPoints = Array.from({ length: tableColumnCount }, () => 2 * tableCellPaddingHorizontalPoints)
    const columnMaximumWidthsPoints = Array.from({ length: tableColumnCount }, () => 2 * tableCellPaddingHorizontalPoints)
    cellLayouts.forEach((rowCellLayouts, tableRowIndex) => {
      rowCellLayouts.forEach((cellLayout, tableCellIndex) => {
        const { minimumContentWidthPoints, maximumContentWidthPoints } = measurePapelizPdfExportTextContentWidths({
          styledTextPieces: cellLayout.tableCellStyledPieces,
          lineWidthPoints: Number.POSITIVE_INFINITY,
          lineStrut: createCellLineStrut(tableTextSizePoints, tableBlock.tableRows[tableRowIndex]?.isTableHeaderRow === true),
          wrappedLineIndentPoints: 0,
          structureElementKey: cellLayout.tableCellStructureElementKey,
          textMeasurer: noteLayout.textMeasurer,
        })
        columnMinimumWidthsPoints[tableCellIndex] = Math.max(columnMinimumWidthsPoints[tableCellIndex] ?? 0, minimumContentWidthPoints + 2 * tableCellPaddingHorizontalPoints)
        columnMaximumWidthsPoints[tableCellIndex] = Math.max(columnMaximumWidthsPoints[tableCellIndex] ?? 0, maximumContentWidthPoints + 2 * tableCellPaddingHorizontalPoints)
      })
    })
    return { columnMinimumWidthsPoints, columnMaximumWidthsPoints }
  }
  const sumPoints = (pointValues: readonly number[]) => pointValues.reduce((pointSum, pointValue) => pointSum + pointValue, 0)
  let tableTextSizePoints = papelizExportPrintTextSizesInPoints.tableTextSizePoints
  let cellLayouts = buildCellLayouts(tableTextSizePoints)
  let { columnMinimumWidthsPoints, columnMaximumWidthsPoints } = measureColumns(tableTextSizePoints, cellLayouts)
  if (sumPoints(columnMinimumWidthsPoints) > tableRoomPoints) {
    tableTextSizePoints = papelizPdfExportTableSmallestTextSizePoints
    cellLayouts = buildCellLayouts(tableTextSizePoints)
    ;({ columnMinimumWidthsPoints, columnMaximumWidthsPoints } = measureColumns(tableTextSizePoints, cellLayouts))
  }
  const minimumTableWidthPoints = sumPoints(columnMinimumWidthsPoints)
  const maximumTableWidthPoints = sumPoints(columnMaximumWidthsPoints)
  const columnWidthsPoints =
    maximumTableWidthPoints <= tableRoomPoints
      ? columnMaximumWidthsPoints
      : minimumTableWidthPoints <= tableRoomPoints
        ? columnMinimumWidthsPoints.map(
            (columnMinimumWidthPoints, columnIndex) =>
              columnMinimumWidthPoints + ((columnMaximumWidthsPoints[columnIndex] ?? 0) - columnMinimumWidthPoints) * ((tableRoomPoints - minimumTableWidthPoints) / (maximumTableWidthPoints - minimumTableWidthPoints)),
          )
        : columnMinimumWidthsPoints.map((columnMinimumWidthPoints) => (columnMinimumWidthPoints * tableRoomPoints) / minimumTableWidthPoints)
  const tableInnerWidthPoints = sumPoints(columnWidthsPoints)
  const headerGroundColor = papelizExportPrintColorsByToken['--color-papeliz-surface-soft']
  const rowLineColor = papelizExportPrintColorsByToken['--color-papeliz-line']
  const innerCornerRadiusPoints = Math.max(0, papelizPdfExportTableCornerRadiusPoints - hairlineWidthPoints)
  const tableLines: PapelizPdfExportLaidOutLine[] = []
  let headerRowHeightPoints = 0
  tableBlock.tableRows.forEach((tableRow, tableRowIndex) => {
    const rowCellLayouts = cellLayouts[tableRowIndex] ?? []
    const cellLines = Array.from({ length: tableColumnCount }, (_tableColumn, tableColumnIndex) => {
      const cellLayout = rowCellLayouts[tableColumnIndex]
      if (cellLayout === undefined) return []
      return layOutPapelizPdfExportTextLines({
        styledTextPieces: cellLayout.tableCellStyledPieces,
        lineWidthPoints: Math.max(1, (columnWidthsPoints[tableColumnIndex] ?? 0) - 2 * tableCellPaddingHorizontalPoints),
        lineStrut: createCellLineStrut(tableTextSizePoints, tableRow.isTableHeaderRow),
        wrappedLineIndentPoints: 0,
        structureElementKey: cellLayout.tableCellStructureElementKey,
        textMeasurer: noteLayout.textMeasurer,
      })
    })
    // A line above every row but the first, so a page that ends inside the table ends on its border.
    const rowBorderPoints = tableRowIndex === 0 ? 0 : hairlineWidthPoints
    // A row taller than what a page holds below the repeated header is cut between its lines.
    const sliceRoomPoints = noteLayout.contentHeightPoints - headerRowHeightPoints - 2 * hairlineWidthPoints - 2 * tableCellPaddingVerticalPoints - rowBorderPoints
    const rowSlices = Math.max(...cellLines.map(sumLineHeights)) > sliceRoomPoints ? sliceTableRowCells(cellLines, sliceRoomPoints) : [cellLines]
    rowSlices.forEach((sliceCellLines, rowSliceIndex) => {
      const isFirstSlice = rowSliceIndex === 0
      const isLastSlice = rowSliceIndex === rowSlices.length - 1
      const sliceBorderPoints = isFirstSlice ? rowBorderPoints : 0
      const slicePaddingTopPoints = sliceBorderPoints + (isFirstSlice ? tableCellPaddingVerticalPoints : 0)
      const sliceContentHeightPoints = Math.max(0, ...sliceCellLines.map(sumLineHeights))
      const sliceHeightPoints = slicePaddingTopPoints + sliceContentHeightPoints + (isLastSlice ? tableCellPaddingVerticalPoints : 0)
      const rowOperations: PapelizPdfExportPageOperation[] = []
      if (sliceBorderPoints > 0) {
        rowOperations.push({
          pageOperationKind: 'rectangle',
          rectangleLeftPoints: 0,
          rectangleTopPoints: 0,
          rectangleWidthPoints: roundPapelizPdfExportPoints(tableInnerWidthPoints),
          rectangleHeightPoints: roundPapelizPdfExportPoints(sliceBorderPoints),
          rectangleCornerRadiusPoints: 0,
          rectangleFillColor: rowLineColor,
          rectangleStrokeColor: null,
          rectangleStrokeWidthPoints: 0,
        })
      }
      if (tableRow.isTableHeaderRow) {
        const headerGroundHeightPoints = sliceHeightPoints - sliceBorderPoints
        rowOperations.push(
          tableRowIndex === 0 && isFirstSlice
            ? {
                pageOperationKind: 'path',
                pathData: describeTopRoundedRectanglePathData(tableInnerWidthPoints, headerGroundHeightPoints, innerCornerRadiusPoints),
                pathLeftPoints: 0,
                pathTopPoints: roundPapelizPdfExportPoints(sliceBorderPoints),
                pathScale: 1,
                pathFillColor: headerGroundColor,
                pathStrokeColor: null,
                pathStrokeWidth: 0,
              }
            : {
                pageOperationKind: 'rectangle',
                rectangleLeftPoints: 0,
                rectangleTopPoints: roundPapelizPdfExportPoints(sliceBorderPoints),
                rectangleWidthPoints: roundPapelizPdfExportPoints(tableInnerWidthPoints),
                rectangleHeightPoints: roundPapelizPdfExportPoints(headerGroundHeightPoints),
                rectangleCornerRadiusPoints: 0,
                rectangleFillColor: headerGroundColor,
                rectangleStrokeColor: null,
                rectangleStrokeWidthPoints: 0,
              },
        )
      }
      let cellLeftPoints = 0
      sliceCellLines.forEach((cellLineList, tableColumnIndex) => {
        const columnWidthPoints = columnWidthsPoints[tableColumnIndex] ?? 0
        const cellTextWidthPoints = columnWidthPoints - 2 * tableCellPaddingHorizontalPoints
        const cellAlignment = rowCellLayouts[tableColumnIndex]?.tableCellAlignment ?? 'left'
        let lineTopPoints = slicePaddingTopPoints
        for (const cellLine of cellLineList) {
          const alignmentShiftPoints = cellAlignment === 'left' ? 0 : Math.max(0, cellTextWidthPoints - cellLine.lineContentWidthPoints) / (cellAlignment === 'center' ? 2 : 1)
          rowOperations.push(...movePapelizPdfExportOperations(cellLine.lineOperations, cellLeftPoints + tableCellPaddingHorizontalPoints + alignmentShiftPoints, lineTopPoints))
          lineTopPoints += cellLine.lineHeightPoints
        }
        noteLayout.missingCharacterCount += countMissingCharacters(cellLineList)
        cellLeftPoints += columnWidthPoints
      })
      tableLines.push({
        lineHeightPoints: roundPapelizPdfExportPoints(sliceHeightPoints),
        lineBaselinePoints: roundPapelizPdfExportPoints(slicePaddingTopPoints + (sliceCellLines.find((cellLineList) => cellLineList.length > 0)?.[0]?.lineBaselinePoints ?? 0)),
        lineContentWidthPoints: roundPapelizPdfExportPoints(tableInnerWidthPoints),
        lineOperations: rowOperations,
        missingCharacterCount: 0,
      })
    })
    if (tableRowIndex === 0 && tableRow.isTableHeaderRow) headerRowHeightPoints = sumLineHeights(tableLines)
  })
  const hasHeaderRow = tableBlock.tableRows[0]?.isTableHeaderRow === true && tableLines.length > 1
  pushLaidOutBlock(
    {
      blockWidthPoints: tableInnerWidthPoints + 2 * hairlineWidthPoints,
      blockSpaceAbovePoints: papelizExportPrintSpacingInPoints.blockSpaceAbovePoints,
      blockSpaceBelowPoints: papelizExportPrintSpacingInPoints.blockSpaceBelowPoints,
      blockLines: tableLines,
      blockBox: {
        boxPaddingTopPoints: 0,
        boxPaddingBottomPoints: 0,
        boxPaddingHorizontalPoints: 0,
        boxGroundColor: null,
        boxBorderColor: rowLineColor,
        boxBorderWidthPoints: hairlineWidthPoints,
        boxCornerRadiusPoints: papelizPdfExportTableCornerRadiusPoints,
      },
      isBlockKeptWithNext: false,
      blockKeptWholeLineCount: 0,
      // The header row never ends a page alone.
      minimumLinesBeforePageBreak: hasHeaderRow ? 2 : 1,
      minimumLinesAfterPageBreak: 1,
      isBlockLeftOutAtPageTop: false,
      isBlockFirstLineRepeated: hasHeaderRow,
    },
    blockPlace,
    noteLayout,
  )
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
      isSmallPictureRoom: true,
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
                textInlinePicture: null,
              },
            },
          ],
          lineWidthPoints,
          lineStrut: chipLineStrut,
          wrappedLineIndentPoints: 0,
          structureElementKey: chipStructureElementKey,
          textMeasurer: noteLayout.textMeasurer,
        })
  // The icon and its gap come before the name.
  const chipIconSpacePoints = papelizPdfExportPropertyIconSizePoints + papelizPdfExportPropertyChipGapPoints
  const chipTextRoomPoints = Math.max(1, chipRoomPoints - 2 * papelizPdfExportPropertyChipPaddingHorizontalPoints - chipIconSpacePoints)
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
      chipTextOperations.push(...movePapelizPdfExportOperations(columnLine.lineOperations, papelizPdfExportPropertyChipPaddingHorizontalPoints + chipIconSpacePoints + columnLeftPoints, lineTopPoints))
      lineTopPoints += columnLine.lineHeightPoints
    }
  }
  placeColumnLines(propertyNameLines, 0)
  placeColumnLines(propertyValuesLines, valuesLeftPoints)
  noteLayout.missingCharacterCount += countMissingCharacters(propertyNameLines) + countMissingCharacters(propertyValuesLines)
  const chipTextHeightPoints = Math.max(sumLineHeights(propertyNameLines), sumLineHeights(propertyValuesLines))
  // MD View's icon for the property, in the chip's muted ink, on the text's middle.
  chipTextOperations.unshift({
    pageOperationKind: 'vector-drawing',
    vectorDrawing: createPapelizPdfExportIconVectorDrawing(getPapelizPdfExportPropertyIconName(noteProperty.notePropertyName), papelizExportPrintColorsByToken['--color-papeliz-ink-muted']),
    vectorTextRunFontFaceKeys: [],
    drawingLeftPoints: roundPapelizPdfExportPoints(papelizPdfExportPropertyChipPaddingHorizontalPoints),
    drawingTopPoints: roundPapelizPdfExportPoints((chipTextHeightPoints - papelizPdfExportPropertyIconSizePoints) / 2),
    drawingScale: roundPapelizPdfExportPoints(papelizPdfExportPropertyIconSizePoints / papelizPdfExportIconViewBoxSize),
    operationTagging: { operationTaggingKind: 'artifact', artifactType: 'Layout' },
  })
  return {
    chipWidthPoints: Math.min(chipRoomPoints, 2 * papelizPdfExportPropertyChipPaddingHorizontalPoints + chipIconSpacePoints + valuesLeftPoints + measureLinesWidthPoints(propertyValuesLines)),
    chipTextHeightPoints,
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
    return {
      lineHeightPoints: roundPapelizPdfExportPoints(rowHeightPoints + rowGapPoints),
      lineBaselinePoints: roundPapelizPdfExportPoints(rowHeightPoints / 2),
      lineContentWidthPoints: roundPapelizPdfExportPoints(chipLeftPoints),
      lineOperations: rowOperations,
      missingCharacterCount: 0,
    }
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
        layOutCodeBox(noteBlock.codeBoxText, noteBlock.codeBoxErrorText, blockPlace, noteLayout)
        if (noteBlock.codeBoxErrorText !== null) layOutDiagramErrorLine(noteBlock.codeBoxErrorText, blockPlace, noteLayout)
        break
      case 'diagram':
        layOutDiagram(noteBlock, blockPlace, noteLayout)
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
      case 'callout':
        layOutCallout(noteBlock, blockPlace, noteLayout)
        break
      case 'table':
        layOutTable(noteBlock, blockPlace, noteLayout)
        break
    }
  }
}

export interface PapelizPdfExportNoteLayoutOptions {
  pdfExportNoteDocument: PapelizPdfExportNoteDocument
  contentWidthPoints: number
  // A page's text area's height: a table row taller than it is split, a picture made smaller to fit.
  contentHeightPoints: number
  textMeasurer: PapelizPdfExportTextMeasurer
  usableNotePictureIndexes: ReadonlySet<number>
}

export function layOutPapelizPdfExportNoteBlocks({ pdfExportNoteDocument, contentWidthPoints, contentHeightPoints, textMeasurer, usableNotePictureIndexes }: PapelizPdfExportNoteLayoutOptions): PapelizPdfExportLaidOutNote {
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
    nextContainerNumber: 1,
    contentHeightPoints,
    usableNotePictureIndexes,
  }
  layOutNoteBlocks(
    pdfExportNoteDocument.noteBlocks,
    {
      placeLeftPoints: 0,
      placeWidthPoints: contentWidthPoints,
      placeTextColor: null,
      placeTextSizePoints: papelizExportBodyTextSizePoints,
      placeContainers: [],
      parentStructureElementKey: null,
      isInsideTaskListItem: false,
      placeListDepth: 0,
      isListItemPlace: false,
      isSmallPictureRoom: false,
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
