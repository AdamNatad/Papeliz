import { papelizExportFooterTextSizePoints, papelizExportPrintColorsByToken } from '../export-print-style/papeliz-export-print-style'
import { movePapelizPdfExportOperations, type PapelizPdfExportLaidOutBlock } from './papeliz-pdf-export-block-layout'
import { getPapelizPdfExportLatinFontFaceKey, type PapelizPdfExportFontStyle } from './papeliz-pdf-export-fonts'
import { createPapelizPdfExportDisplayTextOperations, type PapelizPdfExportLaidOutLine, type PapelizPdfExportStyledTextOperations } from './papeliz-pdf-export-line-breaking'
import type { PapelizPdfExportPageArea } from './papeliz-pdf-export-page-area'
import {
  roundPapelizPdfExportPoints,
  type PapelizPdfExportPageOperation,
  type PapelizPdfExportPagePlan,
  type PapelizPdfExportRectangleOperation,
} from './papeliz-pdf-export-page-layout-plan'
import type { PapelizPdfExportTextMeasurer } from './papeliz-pdf-export-text-measuring'

// The laid-out blocks onto pages, under the keep rules: a heading moves on with the start of what
// follows it; a paragraph or list item leaves at least two lines on each side of a break (an item's
// first line stays with its bullet, which is drawn on it); a short code box moves whole and a long
// one splits with three lines on each side; a short callout moves whole; table rows never split and
// the header row repeats; the properties' chips never split; a rule that would open a page is left
// out. Each page's piece of a box is drawn with its own ground, and each container (a quote's bar, a
// callout's card) beside or behind each page's piece of it. The first block on a page drops its
// margin. Then each page's footer: the note's name on the left, "2 / 9" on the right.

export interface PapelizPdfExportPaginationOptions {
  laidOutBlocks: readonly PapelizPdfExportLaidOutBlock[]
  pdfExportPageArea: PapelizPdfExportPageArea
  footerNoteName: string
  footerFontStyle: PapelizPdfExportFontStyle
  textMeasurer: PapelizPdfExportTextMeasurer
}

function sumLineHeights(laidOutLines: readonly PapelizPdfExportLaidOutLine[]): number {
  return laidOutLines.reduce((lineHeightSumPoints, laidOutLine) => lineHeightSumPoints + laidOutLine.lineHeightPoints, 0)
}

function getBoxPaddingHeight(laidOutBlock: PapelizPdfExportLaidOutBlock): number {
  const { blockBox } = laidOutBlock
  return blockBox === null ? 0 : blockBox.boxPaddingTopPoints + blockBox.boxPaddingBottomPoints + 2 * blockBox.boxBorderWidthPoints
}

function getBlockHeight(laidOutBlock: PapelizPdfExportLaidOutBlock): number {
  return getBoxPaddingHeight(laidOutBlock) + sumLineHeights(laidOutBlock.blockLines)
}

// The space between two blocks on one page: what closes the first's containers, their margins
// overlapping as CSS margins do, then what opens the second's.
function getSpaceBetweenBlocks(previousLaidOutBlock: PapelizPdfExportLaidOutBlock | undefined, laidOutBlock: PapelizPdfExportLaidOutBlock): number {
  return (
    (previousLaidOutBlock?.blockFixedSpaceBelowPoints ?? 0) + Math.max(previousLaidOutBlock?.blockSpaceBelowPoints ?? 0, laidOutBlock.blockSpaceAbovePoints) + laidOutBlock.blockFixedSpaceAbovePoints
  )
}

// The least of a block that has to fit below a heading kept with it: the lines a page may end on,
// or all of a block that can't split; for another kept block, all of it and what it keeps in turn.
function getLeadingPieceHeight(laidOutBlocks: readonly PapelizPdfExportLaidOutBlock[], laidOutBlockIndex: number): number {
  const laidOutBlock = laidOutBlocks[laidOutBlockIndex]
  if (laidOutBlock === undefined) return 0
  const spaceAbovePoints = getSpaceBetweenBlocks(laidOutBlocks[laidOutBlockIndex - 1], laidOutBlock)
  if (laidOutBlock.isBlockKeptWithNext) return spaceAbovePoints + getBlockHeight(laidOutBlock) + getLeadingPieceHeight(laidOutBlocks, laidOutBlockIndex + 1)
  const blockLineCount = laidOutBlock.blockLines.length
  const leadingLineCount = blockLineCount <= laidOutBlock.blockKeptWholeLineCount ? blockLineCount : Math.min(blockLineCount, laidOutBlock.minimumLinesBeforePageBreak)
  return spaceAbovePoints + getBoxPaddingHeight(laidOutBlock) + sumLineHeights(laidOutBlock.blockLines.slice(0, leadingLineCount))
}

function countFittingLines(laidOutBlock: PapelizPdfExportLaidOutBlock, remainingLines: readonly PapelizPdfExportLaidOutLine[], roomPoints: number): number {
  let fittingLineCount = 0
  let pieceHeightPoints = getBoxPaddingHeight(laidOutBlock)
  for (const remainingLine of remainingLines) {
    if (pieceHeightPoints + remainingLine.lineHeightPoints > roomPoints) break
    pieceHeightPoints += remainingLine.lineHeightPoints
    fittingLineCount += 1
  }
  return fittingLineCount
}

// How many of a block's remaining lines this page takes: all that fit, but never so few that a page
// ends on fewer lines than the block allows, nor so many that fewer are left for the next page.
function chooseSplitLineCount(laidOutBlock: PapelizPdfExportLaidOutBlock, remainingLines: readonly PapelizPdfExportLaidOutLine[], roomPoints: number): number {
  const largestSplitLineCount = Math.min(countFittingLines(laidOutBlock, remainingLines, roomPoints), remainingLines.length - laidOutBlock.minimumLinesAfterPageBreak)
  return largestSplitLineCount >= laidOutBlock.minimumLinesBeforePageBreak ? largestSplitLineCount : 0
}

// A table's header row drawn again on a later page: page furniture there, read once, with no links.
function createRepeatedLine(repeatedLine: PapelizPdfExportLaidOutLine): PapelizPdfExportLaidOutLine {
  return {
    ...repeatedLine,
    lineOperations: repeatedLine.lineOperations.flatMap((lineOperation): PapelizPdfExportPageOperation[] => {
      if (lineOperation.pageOperationKind === 'link-area' || lineOperation.pageOperationKind === 'destination') return []
      return lineOperation.pageOperationKind === 'text-run' ? [{ ...lineOperation, operationTagging: { operationTaggingKind: 'artifact' as const, artifactType: 'Pagination' as const } }] : [lineOperation]
    }),
  }
}

export function paginatePapelizPdfExportBlocks(paginationOptions: PapelizPdfExportPaginationOptions): PapelizPdfExportPagePlan[] {
  const { laidOutBlocks, pdfExportPageArea } = paginationOptions
  const { contentLeftPoints, contentTopPoints, contentBottomPoints } = pdfExportPageArea
  const pdfExportPages: PapelizPdfExportPagePlan[] = [{ pageOperations: [] }]
  let cursorTopPoints = contentTopPoints
  let isPageEmpty = true
  // This page's container grounds and bars, by container: each grows down as its blocks are placed.
  let pageContainerGroundsByKey = new Map<string, PapelizPdfExportRectangleOperation>()
  const getCurrentPage = () => pdfExportPages[pdfExportPages.length - 1] as PapelizPdfExportPagePlan
  const startNewPage = () => {
    pdfExportPages.push({ pageOperations: [] })
    cursorTopPoints = contentTopPoints
    isPageEmpty = true
    pageContainerGroundsByKey = new Map()
  }
  const drawContainerGrounds = (laidOutBlock: PapelizPdfExportLaidOutBlock, pieceTopPoints: number, pieceBottomPoints: number, isFirstPiece: boolean, isLastPiece: boolean) => {
    for (const blockContainer of laidOutBlock.blockContainers) {
      const groundBottomPoints = pieceBottomPoints + (isLastPiece && blockContainer.containerLastBlock === laidOutBlock ? blockContainer.containerBottomInsetPoints : 0)
      const pageContainerGround = pageContainerGroundsByKey.get(blockContainer.containerKey)
      if (pageContainerGround !== undefined) {
        pageContainerGround.rectangleHeightPoints = roundPapelizPdfExportPoints(groundBottomPoints - pageContainerGround.rectangleTopPoints)
        continue
      }
      const groundTopPoints = Math.max(0, pieceTopPoints - (isFirstPiece && blockContainer.containerFirstBlock === laidOutBlock ? blockContainer.containerTopInsetPoints : 0))
      const containerGround: PapelizPdfExportRectangleOperation = {
        pageOperationKind: 'rectangle',
        rectangleLeftPoints: roundPapelizPdfExportPoints(contentLeftPoints + blockContainer.containerLeftPoints),
        rectangleTopPoints: roundPapelizPdfExportPoints(groundTopPoints),
        rectangleWidthPoints: roundPapelizPdfExportPoints(blockContainer.containerWidthPoints),
        rectangleHeightPoints: roundPapelizPdfExportPoints(groundBottomPoints - groundTopPoints),
        rectangleCornerRadiusPoints: roundPapelizPdfExportPoints(blockContainer.containerCornerRadiusPoints),
        rectangleFillColor: blockContainer.containerGroundColor,
        rectangleStrokeColor: null,
        rectangleStrokeWidthPoints: 0,
      }
      pageContainerGroundsByKey.set(blockContainer.containerKey, containerGround)
      getCurrentPage().pageOperations.push(containerGround)
    }
  }
  const placeBlockPiece = (laidOutBlock: PapelizPdfExportLaidOutBlock, pieceLines: readonly PapelizPdfExportLaidOutLine[], isFirstPiece: boolean, isLastPiece: boolean) => {
    const pageOperations = getCurrentPage().pageOperations
    const { blockBox } = laidOutBlock
    const pieceHeightPoints = getBoxPaddingHeight(laidOutBlock) + sumLineHeights(pieceLines)
    drawContainerGrounds(laidOutBlock, cursorTopPoints, cursorTopPoints + pieceHeightPoints, isFirstPiece, isLastPiece)
    if (blockBox !== null) {
      pageOperations.push({
        pageOperationKind: 'rectangle',
        rectangleLeftPoints: roundPapelizPdfExportPoints(contentLeftPoints + laidOutBlock.blockLeftPoints),
        rectangleTopPoints: roundPapelizPdfExportPoints(cursorTopPoints),
        rectangleWidthPoints: roundPapelizPdfExportPoints(laidOutBlock.blockWidthPoints),
        rectangleHeightPoints: roundPapelizPdfExportPoints(pieceHeightPoints),
        rectangleCornerRadiusPoints: roundPapelizPdfExportPoints(blockBox.boxCornerRadiusPoints),
        rectangleFillColor: blockBox.boxGroundColor,
        rectangleStrokeColor: blockBox.boxBorderColor,
        rectangleStrokeWidthPoints: roundPapelizPdfExportPoints(blockBox.boxBorderWidthPoints),
      })
    }
    const lineLeftPoints = contentLeftPoints + laidOutBlock.blockLeftPoints + (blockBox === null ? 0 : blockBox.boxPaddingHorizontalPoints + blockBox.boxBorderWidthPoints)
    let lineTopPoints = cursorTopPoints + (blockBox === null ? 0 : blockBox.boxPaddingTopPoints + blockBox.boxBorderWidthPoints)
    for (const pieceLine of pieceLines) {
      pageOperations.push(...movePapelizPdfExportOperations(pieceLine.lineOperations, lineLeftPoints, lineTopPoints))
      lineTopPoints += pieceLine.lineHeightPoints
    }
    cursorTopPoints += pieceHeightPoints
    isPageEmpty = false
  }

  laidOutBlocks.forEach((laidOutBlock, laidOutBlockIndex) => {
    const spaceAbovePoints = getSpaceBetweenBlocks(laidOutBlocks[laidOutBlockIndex - 1], laidOutBlock)
    if (laidOutBlock.isBlockLeftOutAtPageTop && (isPageEmpty || cursorTopPoints + spaceAbovePoints + getBlockHeight(laidOutBlock) > contentBottomPoints)) return
    if (!isPageEmpty && laidOutBlock.isBlockKeptWithNext) {
      const keptHeightPoints = spaceAbovePoints + getBlockHeight(laidOutBlock) + getLeadingPieceHeight(laidOutBlocks, laidOutBlockIndex + 1)
      if (cursorTopPoints + keptHeightPoints > contentBottomPoints) startNewPage()
    }
    // A page's first block drops its margin and keeps the padding of the containers it opens.
    cursorTopPoints += isPageEmpty ? laidOutBlock.blockFixedSpaceAbovePoints : spaceAbovePoints
    const repeatedFirstLine = laidOutBlock.isBlockFirstLineRepeated && laidOutBlock.blockLines[0] !== undefined ? createRepeatedLine(laidOutBlock.blockLines[0]) : null
    let remainingLines = laidOutBlock.blockLines
    let isFirstPiece = true
    const continueOnNextPage = (placedLineCount: number) => {
      remainingLines = remainingLines.slice(placedLineCount)
      if (repeatedFirstLine !== null && remainingLines.length > 0) remainingLines = [repeatedFirstLine, ...remainingLines]
    }
    while (remainingLines.length > 0) {
      const roomPoints = contentBottomPoints - cursorTopPoints
      if (getBoxPaddingHeight(laidOutBlock) + sumLineHeights(remainingLines) <= roomPoints) {
        placeBlockPiece(laidOutBlock, remainingLines, isFirstPiece, true)
        break
      }
      const isKeptWhole = isFirstPiece && remainingLines.length <= laidOutBlock.blockKeptWholeLineCount
      const splitLineCount = isKeptWhole ? 0 : chooseSplitLineCount(laidOutBlock, remainingLines, roomPoints)
      if (splitLineCount > 0) {
        placeBlockPiece(laidOutBlock, remainingLines.slice(0, splitLineCount), isFirstPiece, false)
        continueOnNextPage(splitLineCount)
        startNewPage()
      } else if (!isPageEmpty) {
        startNewPage()
        if (isFirstPiece) cursorTopPoints += laidOutBlock.blockFixedSpaceAbovePoints
        continue
      } else {
        // Taller than a whole page, or its rules can't be kept on one: as much as fits, and never a
        // repeated header row alone.
        const leastForcedLineCount = repeatedFirstLine !== null && !isFirstPiece ? 2 : 1
        const forcedLineCount = Math.min(remainingLines.length, Math.max(leastForcedLineCount, countFittingLines(laidOutBlock, remainingLines, roomPoints)))
        placeBlockPiece(laidOutBlock, remainingLines.slice(0, forcedLineCount), isFirstPiece, forcedLineCount === remainingLines.length)
        continueOnNextPage(forcedLineCount)
        if (remainingLines.length > 0) startNewPage()
      }
      isFirstPiece = false
    }
  })
  // No page is left empty at the end.
  if (pdfExportPages.length > 1 && getCurrentPage().pageOperations.length === 0) pdfExportPages.pop()
  addPapelizPdfExportPageFooters(pdfExportPages, paginationOptions)
  return pdfExportPages
}

const papelizPdfExportFooterGapPoints = 12
const papelizPdfExportFooterEllipsis = '…'

// The footer's text as it is drawn: in display order, each piece in its font or as its picture.
function createFooterTextOperations(footerText: string, footerLeftPoints: number, footerBaselinePoints: number, paginationOptions: PapelizPdfExportPaginationOptions): PapelizPdfExportStyledTextOperations {
  return createPapelizPdfExportDisplayTextOperations(
    footerText,
    {
      textFontStyle: paginationOptions.footerFontStyle,
      textSizePoints: papelizExportFooterTextSizePoints,
      textColor: papelizExportPrintColorsByToken['--color-papeliz-ink-subtle'],
      characterSpacingPoints: 0,
      openTypeFeatureSet: 'standard',
    },
    footerLeftPoints,
    footerBaselinePoints,
    { operationTaggingKind: 'artifact', artifactType: 'Pagination' },
    paginationOptions.textMeasurer,
  )
}

function measureFooterTextWidthPoints(footerText: string, paginationOptions: PapelizPdfExportPaginationOptions): number {
  return createFooterTextOperations(footerText, 0, 0, paginationOptions).textWidthPoints
}

// "A very long note name that does not fit…": cut at a character, never inside one.
function fitFooterNoteName(footerNoteName: string, footerRoomPoints: number, paginationOptions: PapelizPdfExportPaginationOptions): string {
  if (measureFooterTextWidthPoints(footerNoteName, paginationOptions) <= footerRoomPoints) return footerNoteName
  const footerNoteNameGraphemes = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(footerNoteName), ({ segment }) => segment)
  for (let keptGraphemeCount = footerNoteNameGraphemes.length - 1; keptGraphemeCount > 0; keptGraphemeCount -= 1) {
    const fittedNoteName = `${footerNoteNameGraphemes.slice(0, keptGraphemeCount).join('').trimEnd()}${papelizPdfExportFooterEllipsis}`
    if (measureFooterTextWidthPoints(fittedNoteName, paginationOptions) <= footerRoomPoints) return fittedNoteName
  }
  return papelizPdfExportFooterEllipsis
}

function pushFooterText(pagePlan: PapelizPdfExportPagePlan, footerText: string, footerLeftPoints: number, footerBaselinePoints: number, paginationOptions: PapelizPdfExportPaginationOptions): void {
  const footerTextOperations = createFooterTextOperations(footerText, footerLeftPoints, footerBaselinePoints, paginationOptions)
  // Pictures of characters as artifacts of the page, like the footer itself.
  for (const pictureOperation of footerTextOperations.pictureOperations) {
    pagePlan.pageOperations.push(pictureOperation.pageOperationKind === 'picture' ? { ...pictureOperation, operationTagging: { operationTaggingKind: 'artifact', artifactType: 'Pagination' } } : pictureOperation)
  }
  pagePlan.pageOperations.push(...footerTextOperations.textOperations)
}

function addPapelizPdfExportPageFooters(pdfExportPages: readonly PapelizPdfExportPagePlan[], paginationOptions: PapelizPdfExportPaginationOptions): void {
  const { pdfExportPageArea, textMeasurer, footerFontStyle } = paginationOptions
  const { descentEm } = textMeasurer.getFontFaceMetrics(getPapelizPdfExportLatinFontFaceKey(footerFontStyle))
  const footerBaselinePoints = pdfExportPageArea.pageHeightPoints - pdfExportPageArea.footerBottomFromPageEdgePoints - descentEm * papelizExportFooterTextSizePoints
  const contentRightPoints = pdfExportPageArea.contentLeftPoints + pdfExportPageArea.contentWidthPoints
  pdfExportPages.forEach((pagePlan, pageIndex) => {
    const pageNumberText = `${pageIndex + 1} / ${pdfExportPages.length}`
    const pageNumberWidthPoints = measureFooterTextWidthPoints(pageNumberText, paginationOptions)
    const footerNoteName = fitFooterNoteName(paginationOptions.footerNoteName, pdfExportPageArea.contentWidthPoints - pageNumberWidthPoints - papelizPdfExportFooterGapPoints, paginationOptions)
    if (footerNoteName.trim().length > 0) pushFooterText(pagePlan, footerNoteName, pdfExportPageArea.contentLeftPoints, footerBaselinePoints, paginationOptions)
    pushFooterText(pagePlan, pageNumberText, contentRightPoints - pageNumberWidthPoints, footerBaselinePoints, paginationOptions)
  })
}
