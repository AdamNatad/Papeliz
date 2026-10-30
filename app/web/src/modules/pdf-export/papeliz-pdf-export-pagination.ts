import { papelizExportFooterTextSizePoints, papelizExportPrintColorsByToken, papelizExportPrintSpacingInPoints } from '../export-print-style/papeliz-export-print-style'
import { movePapelizPdfExportOperations, papelizPdfExportQuoteBarOverhangPoints, type PapelizPdfExportLaidOutBlock } from './papeliz-pdf-export-block-layout'
import { getPapelizPdfExportFontFaceKey, splitPapelizPdfExportTextBySubset, type PapelizPdfExportFontStyle } from './papeliz-pdf-export-fonts'
import type { PapelizPdfExportLaidOutLine } from './papeliz-pdf-export-line-breaking'
import { roundPapelizPdfExportPoints, type PapelizPdfExportPagePlan, type PapelizPdfExportRectangleOperation } from './papeliz-pdf-export-page-layout-plan'
import type { PapelizPdfExportTextMeasurer } from './papeliz-pdf-export-text-measuring'

// The laid-out blocks onto pages, under the keep rules: a heading moves on with the start of what
// follows it; a paragraph or list item leaves at least two lines on each side of a break (an item's
// first line stays with its bullet, which is drawn on it); a short code box moves whole and a long
// one splits with three lines on each side; the properties' chips never split; a rule that would
// open a page is left out. Each page's piece of a box is drawn with its own ground, and a quote's bar
// beside each page's piece of the quote. The first block on a page drops its space above. Then each
// page's footer: the note's name on the left, "2 / 9" on the right.

export interface PapelizPdfExportPageArea {
  pageWidthPoints: number
  pageHeightPoints: number
  contentLeftPoints: number
  contentTopPoints: number
  contentWidthPoints: number
  contentBottomPoints: number
  // The footer's line ends this far above the page's bottom edge.
  footerBottomFromPageEdgePoints: number
}

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
  return laidOutBlock.blockBox === null ? 0 : laidOutBlock.blockBox.boxPaddingTopPoints + laidOutBlock.blockBox.boxPaddingBottomPoints
}

function getBlockHeight(laidOutBlock: PapelizPdfExportLaidOutBlock): number {
  return getBoxPaddingHeight(laidOutBlock) + sumLineHeights(laidOutBlock.blockLines)
}

// The least of a block that has to fit below a heading kept with it: the lines a page may end on,
// or all of a block that can't split; for another heading, all of it and what it keeps in turn.
function getLeadingPieceHeight(laidOutBlocks: readonly PapelizPdfExportLaidOutBlock[], laidOutBlockIndex: number): number {
  const laidOutBlock = laidOutBlocks[laidOutBlockIndex]
  if (laidOutBlock === undefined) return 0
  const previousLaidOutBlock = laidOutBlocks[laidOutBlockIndex - 1]
  const spaceAbovePoints = Math.max(previousLaidOutBlock?.blockSpaceBelowPoints ?? 0, laidOutBlock.blockSpaceAbovePoints)
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

export function paginatePapelizPdfExportBlocks(paginationOptions: PapelizPdfExportPaginationOptions): PapelizPdfExportPagePlan[] {
  const { laidOutBlocks, pdfExportPageArea } = paginationOptions
  const { contentLeftPoints, contentTopPoints, contentBottomPoints } = pdfExportPageArea
  const pdfExportPages: PapelizPdfExportPagePlan[] = [{ pageOperations: [] }]
  let cursorTopPoints = contentTopPoints
  let isPageEmpty = true
  // This page's quote bars, by quote: each grows down as the quote's blocks are placed.
  let pageQuoteBarsByQuoteKey = new Map<string, PapelizPdfExportRectangleOperation>()
  const getCurrentPage = () => pdfExportPages[pdfExportPages.length - 1] as PapelizPdfExportPagePlan
  const startNewPage = () => {
    pdfExportPages.push({ pageOperations: [] })
    cursorTopPoints = contentTopPoints
    isPageEmpty = true
    pageQuoteBarsByQuoteKey = new Map()
  }
  const drawQuoteBars = (laidOutBlock: PapelizPdfExportLaidOutBlock, pieceTopPoints: number, pieceBottomPoints: number) => {
    for (const { quoteKey, quoteBarLeftPoints } of laidOutBlock.blockQuoteBars) {
      const quoteBarBottomPoints = pieceBottomPoints + papelizPdfExportQuoteBarOverhangPoints
      const pageQuoteBar = pageQuoteBarsByQuoteKey.get(quoteKey)
      if (pageQuoteBar !== undefined) {
        pageQuoteBar.rectangleHeightPoints = roundPapelizPdfExportPoints(quoteBarBottomPoints - pageQuoteBar.rectangleTopPoints)
        continue
      }
      const quoteBarTopPoints = Math.max(0, pieceTopPoints - papelizPdfExportQuoteBarOverhangPoints)
      const quoteBar: PapelizPdfExportRectangleOperation = {
        pageOperationKind: 'rectangle',
        rectangleLeftPoints: roundPapelizPdfExportPoints(contentLeftPoints + quoteBarLeftPoints),
        rectangleTopPoints: roundPapelizPdfExportPoints(quoteBarTopPoints),
        rectangleWidthPoints: roundPapelizPdfExportPoints(papelizExportPrintSpacingInPoints.quoteBarWidthPoints),
        rectangleHeightPoints: roundPapelizPdfExportPoints(quoteBarBottomPoints - quoteBarTopPoints),
        rectangleCornerRadiusPoints: 0,
        rectangleFillColor: papelizExportPrintColorsByToken['--color-papeliz-line-strong'],
        rectangleStrokeColor: null,
        rectangleStrokeWidthPoints: 0,
      }
      pageQuoteBarsByQuoteKey.set(quoteKey, quoteBar)
      getCurrentPage().pageOperations.push(quoteBar)
    }
  }
  const placeBlockPiece = (laidOutBlock: PapelizPdfExportLaidOutBlock, pieceLines: readonly PapelizPdfExportLaidOutLine[]) => {
    const pageOperations = getCurrentPage().pageOperations
    const { blockBox } = laidOutBlock
    const pieceHeightPoints = getBoxPaddingHeight(laidOutBlock) + sumLineHeights(pieceLines)
    drawQuoteBars(laidOutBlock, cursorTopPoints, cursorTopPoints + pieceHeightPoints)
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
    let lineTopPoints = cursorTopPoints + (blockBox?.boxPaddingTopPoints ?? 0)
    for (const pieceLine of pieceLines) {
      pageOperations.push(...movePapelizPdfExportOperations(pieceLine.lineOperations, lineLeftPoints, lineTopPoints))
      lineTopPoints += pieceLine.lineHeightPoints
    }
    cursorTopPoints += pieceHeightPoints
    isPageEmpty = false
  }

  laidOutBlocks.forEach((laidOutBlock, laidOutBlockIndex) => {
    const previousLaidOutBlock = laidOutBlocks[laidOutBlockIndex - 1]
    // Neighbouring blocks' spaces overlap, as CSS margins do.
    const spaceAbovePoints = Math.max(previousLaidOutBlock?.blockSpaceBelowPoints ?? 0, laidOutBlock.blockSpaceAbovePoints)
    if (laidOutBlock.isBlockLeftOutAtPageTop && (isPageEmpty || cursorTopPoints + spaceAbovePoints + getBlockHeight(laidOutBlock) > contentBottomPoints)) return
    if (!isPageEmpty && laidOutBlock.isBlockKeptWithNext) {
      const keptHeightPoints = spaceAbovePoints + getBlockHeight(laidOutBlock) + getLeadingPieceHeight(laidOutBlocks, laidOutBlockIndex + 1)
      if (cursorTopPoints + keptHeightPoints > contentBottomPoints) startNewPage()
    }
    if (!isPageEmpty) cursorTopPoints += spaceAbovePoints
    let remainingLines = laidOutBlock.blockLines
    let isFirstPiece = true
    while (remainingLines.length > 0) {
      const roomPoints = contentBottomPoints - cursorTopPoints
      if (getBoxPaddingHeight(laidOutBlock) + sumLineHeights(remainingLines) <= roomPoints) {
        placeBlockPiece(laidOutBlock, remainingLines)
        break
      }
      const isKeptWhole = isFirstPiece && remainingLines.length <= laidOutBlock.blockKeptWholeLineCount
      const splitLineCount = isKeptWhole ? 0 : chooseSplitLineCount(laidOutBlock, remainingLines, roomPoints)
      if (splitLineCount > 0) {
        placeBlockPiece(laidOutBlock, remainingLines.slice(0, splitLineCount))
        remainingLines = remainingLines.slice(splitLineCount)
        startNewPage()
      } else if (!isPageEmpty) {
        startNewPage()
      } else {
        // Taller than a whole page, or its rules can't be kept on one: as much as fits.
        const forcedLineCount = Math.max(1, countFittingLines(laidOutBlock, remainingLines, roomPoints))
        placeBlockPiece(laidOutBlock, remainingLines.slice(0, forcedLineCount))
        remainingLines = remainingLines.slice(forcedLineCount)
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

function measureFooterTextWidthPoints(footerText: string, paginationOptions: PapelizPdfExportPaginationOptions): number {
  return splitPapelizPdfExportTextBySubset(footerText).reduce(
    (footerTextWidthPoints, { segmentText, fontSubsetName }) =>
      footerTextWidthPoints +
      paginationOptions.textMeasurer.measureTextWidthPoints(
        segmentText,
        getPapelizPdfExportFontFaceKey({ ...paginationOptions.footerFontStyle, fontSubsetName: fontSubsetName ?? 'latin' }),
        papelizExportFooterTextSizePoints,
        0,
        'standard',
      ),
    0,
  )
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
  let textLeftPoints = footerLeftPoints
  for (const { segmentText, fontSubsetName } of splitPapelizPdfExportTextBySubset(footerText)) {
    const fontFaceKey = getPapelizPdfExportFontFaceKey({ ...paginationOptions.footerFontStyle, fontSubsetName: fontSubsetName ?? 'latin' })
    const textWidthPoints = paginationOptions.textMeasurer.measureTextWidthPoints(segmentText, fontFaceKey, papelizExportFooterTextSizePoints, 0, 'standard')
    pagePlan.pageOperations.push({
      pageOperationKind: 'text-run',
      textRunText: segmentText,
      fontFaceKey,
      textSizePoints: papelizExportFooterTextSizePoints,
      textColor: papelizExportPrintColorsByToken['--color-papeliz-ink-subtle'],
      characterSpacingPoints: 0,
      openTypeFeatureSet: 'standard',
      textLeftPoints: roundPapelizPdfExportPoints(textLeftPoints),
      textBaselinePoints: roundPapelizPdfExportPoints(footerBaselinePoints),
      textWidthPoints: roundPapelizPdfExportPoints(textWidthPoints),
      operationTagging: { operationTaggingKind: 'artifact', artifactType: 'Pagination' },
    })
    textLeftPoints += textWidthPoints
  }
}

function addPapelizPdfExportPageFooters(pdfExportPages: readonly PapelizPdfExportPagePlan[], paginationOptions: PapelizPdfExportPaginationOptions): void {
  const { pdfExportPageArea, textMeasurer, footerFontStyle } = paginationOptions
  const { descentEm } = textMeasurer.getFontFaceMetrics(getPapelizPdfExportFontFaceKey({ ...footerFontStyle, fontSubsetName: 'latin' }))
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
