import { describe, expect, it } from 'vitest'
import { planPapelizPdfExportNotePages, writePapelizPdfExportNotePdf } from './papeliz-pdf-export-note-pdf'
import type { PapelizPdfExportPageLayoutPlan, PapelizPdfExportPageOperation, PapelizPdfExportTextRunOperation } from './papeliz-pdf-export-page-layout-plan'
import {
  convertPapelizPdfExportSvgShapeToPathData,
  createPapelizPdfExportIconVectorDrawing,
  findPapelizPdfExportVectorDrawingProblem,
  type PapelizPdfExportVectorDrawing,
} from './papeliz-pdf-export-vector-drawing'
import { buildPapelizPdfExportTestNotePdfJob, getPapelizPdfExportTestNoteText, readPapelizPdfExportFileWithPdfJs } from './papeliz-pdf-export.test-support'

// Phase 3 of the PDF export: callout cards with their icons, tables, and Papeliz's own SVG drawing.

function listPageTextRuns(pageLayoutPlan: PapelizPdfExportPageLayoutPlan, pageIndex: number): PapelizPdfExportTextRunOperation[] {
  return (pageLayoutPlan.pdfExportPages[pageIndex]?.pageOperations ?? []).filter((pageOperation): pageOperation is PapelizPdfExportTextRunOperation => pageOperation.pageOperationKind === 'text-run')
}

function listPageRectangles(pageLayoutPlan: PapelizPdfExportPageLayoutPlan, pageIndex: number, rectangleFillColor: string): PapelizPdfExportPageOperation[] {
  return (pageLayoutPlan.pdfExportPages[pageIndex]?.pageOperations ?? []).filter((pageOperation) => pageOperation.pageOperationKind === 'rectangle' && pageOperation.rectangleFillColor === rectangleFillColor)
}

function createFillerParagraphs(paragraphCount: number): string {
  return Array.from({ length: paragraphCount }, (_fillerParagraph, paragraphIndex) => `Filler ${paragraphIndex + 1}: ${'Words that fill the page. '.repeat(12)}`).join('\n\n')
}

describe('PDF export drawings', () => {
  it('turns SVG shapes into path data', () => {
    expect(convertPapelizPdfExportSvgShapeToPathData('circle', { cx: '12', cy: '12', r: '10' })).toBe('M2 12A10 10 0 1 0 22 12A10 10 0 1 0 2 12Z')
    expect(convertPapelizPdfExportSvgShapeToPathData('rect', { x: '3', y: '3', width: '18', height: '18', rx: '2' })).toMatch(/^M5 3H19A2 2 0 0 1 21 5V19/)
    expect(convertPapelizPdfExportSvgShapeToPathData('rect', { x: '0', y: '0', width: '4', height: '2' })).toBe('M0 0H4V2H0Z')
    expect(convertPapelizPdfExportSvgShapeToPathData('line', { x1: '4', x2: '20', y1: '9', y2: '9' })).toBe('M4 9L20 9')
    expect(convertPapelizPdfExportSvgShapeToPathData('polyline', { points: '1,2 3,4 5,6' })).toBe('M1 2L3 4L5 6')
    expect(convertPapelizPdfExportSvgShapeToPathData('polygon', { points: '0 0 10 0 5 8' })).toBe('M0 0L10 0L5 8Z')
    expect(convertPapelizPdfExportSvgShapeToPathData('path', { d: 'M0 0 <script>' })).toBeNull()
    expect(convertPapelizPdfExportSvgShapeToPathData('circle', { cx: '1', cy: '1', r: '0' })).toBeNull()
    expect(convertPapelizPdfExportSvgShapeToPathData('foreignObject', {})).toBeNull()
  })

  it('draws only what passes its check', () => {
    const iconDrawing = createPapelizPdfExportIconVectorDrawing('Calendar', '#0064d4')
    expect(findPapelizPdfExportVectorDrawingProblem(iconDrawing)).toBeNull()
    const firstIconShape = iconDrawing.vectorShapes[0]
    if (firstIconShape === undefined) throw new Error('The icon has no shapes.')
    const withShapeChange = (shapeChange: object): PapelizPdfExportVectorDrawing => ({ ...iconDrawing, vectorShapes: [{ ...firstIconShape, ...shapeChange }] })
    expect(findPapelizPdfExportVectorDrawingProblem(withShapeChange({ vectorShapePathData: 'M0 0 L url(x)' }))).toMatch(/path data/)
    expect(findPapelizPdfExportVectorDrawingProblem(withShapeChange({ vectorShapePathData: 'L0 0' }))).toMatch(/move/)
    expect(findPapelizPdfExportVectorDrawingProblem(withShapeChange({ vectorShapePathData: 'M0 0L1e9 0' }))).toMatch(/out of bounds/)
    expect(findPapelizPdfExportVectorDrawingProblem(withShapeChange({ vectorShapeTransform: [1, 0, 0, 1, Number.NaN, 0] }))).toMatch(/transform/)
    expect(findPapelizPdfExportVectorDrawingProblem(withShapeChange({ vectorShapeStrokeColor: 'red' }))).toMatch(/color/)
    expect(findPapelizPdfExportVectorDrawingProblem(withShapeChange({ vectorShapeDashArray: [2, -1] }))).toMatch(/dashes/)
    expect(findPapelizPdfExportVectorDrawingProblem({ ...iconDrawing, vectorShapes: Array.from({ length: 10_001 }, () => firstIconShape) })).toMatch(/too many shapes/)
  })
})

describe('PDF export callouts', () => {
  it('draws callouts as MD View’s cards, in their kind’s colors with their icons', async () => {
    const { pageLayoutPlan } = planPapelizPdfExportNotePages(await buildPapelizPdfExportTestNotePdfJob('Guides/Callouts.md', getPapelizPdfExportTestNoteText('Guides/Callouts.md')))
    for (const calloutGroundColor of ['#eaf2fe', '#fff4e0', '#fde8e7', '#efe9ff']) expect(listPageRectangles(pageLayoutPlan, 0, calloutGroundColor).length, calloutGroundColor).toBeGreaterThan(0)
    const pageDrawings = (pageLayoutPlan.pdfExportPages[0]?.pageOperations ?? []).filter((pageOperation) => pageOperation.pageOperationKind === 'vector-drawing')
    // Five callout icons and the property chip's.
    expect(pageDrawings).toHaveLength(6)
    const calloutTitleRun = listPageTextRuns(pageLayoutPlan, 0).find((textRun) => textRun.textRunText === 'Warning')
    expect(calloutTitleRun?.textColor).toBe('#8a4b00')
    expect(calloutTitleRun?.fontFaceKey).toBe('figtree-latin-600-normal')
  })

  it('draws a long callout’s card on every page it spans, and keeps a short one on one page', async () => {
    const longCalloutText = `> [!note] A long callout\n${Array.from({ length: 70 }, (_calloutLine, calloutLineIndex) => `> Callout paragraph ${calloutLineIndex + 1}, one line of its own.\n>`).join('\n')}`
    const { pageLayoutPlan } = planPapelizPdfExportNotePages(await buildPapelizPdfExportTestNotePdfJob('Long callout.md', `${createFillerParagraphs(3)}\n\n${longCalloutText}`))
    expect(pageLayoutPlan.pdfExportPages.length).toBeGreaterThan(2)
    pageLayoutPlan.pdfExportPages.forEach((_pagePlan, pageIndex) => expect(listPageRectangles(pageLayoutPlan, pageIndex, '#eaf2fe'), `page ${pageIndex + 1}`).toHaveLength(1))

    // Filler that puts a five-line callout near a page's end: it moves to the next page whole.
    for (let fillerParagraphCount = 6; fillerParagraphCount <= 9; fillerParagraphCount += 1) {
      const shortCalloutText = '> [!tip] A short callout\n> One.\n>\n> Two.\n>\n> Three.\n>\n> Four.'
      const { pageLayoutPlan: shortCalloutPlan } = planPapelizPdfExportNotePages(await buildPapelizPdfExportTestNotePdfJob('Short callout.md', `${createFillerParagraphs(fillerParagraphCount)}\n\n${shortCalloutText}`))
      const pagesWithCallout = shortCalloutPlan.pdfExportPages.flatMap((_pagePlan, pageIndex) => (listPageRectangles(shortCalloutPlan, pageIndex, '#eaf2fe').length > 0 ? [pageIndex] : []))
      expect(pagesWithCallout, `${fillerParagraphCount} filler paragraphs`).toHaveLength(1)
    }
  })
})

describe('PDF export tables', () => {
  it('sizes columns like a browser, aligns cells, and repeats the header row on every page', async () => {
    const { pageLayoutPlan } = planPapelizPdfExportNotePages(await buildPapelizPdfExportTestNotePdfJob('Long table.md', getPapelizPdfExportTestNoteText('Long table.md')))
    expect(pageLayoutPlan.pdfExportPages.length).toBeGreaterThan(2)
    const itemPageIndexes = new Map<string, number[]>()
    pageLayoutPlan.pdfExportPages.forEach((_pagePlan, pageIndex) => {
      const pageTextRuns = listPageTextRuns(pageLayoutPlan, pageIndex)
      const headerRuns = pageTextRuns.filter((textRun) => ['Item', 'Note', 'Amount', 'Link'].includes(textRun.textRunText) && textRun.fontFaceKey === 'figtree-latin-600-normal')
      if (pageTextRuns.some((textRun) => /^Item \d/.test(textRun.textRunText))) expect(headerRuns.map((headerRun) => headerRun.textRunText), `page ${pageIndex + 1}`).toEqual(['Item', 'Note', 'Amount', 'Link'])
      // The header row read once: drawn again on later pages as page furniture.
      for (const headerRun of headerRuns) expect(headerRun.operationTagging.operationTaggingKind).toBe(pageIndex === 0 ? 'structure' : 'artifact')
      for (const textRun of pageTextRuns) {
        const itemMatch = /^Item (\d+)$/.exec(textRun.textRunText)
        const amountMatch = /^\d+\.\d\d$/.exec(textRun.textRunText)
        const rowKey = itemMatch?.[1] ?? (amountMatch === null ? null : `amount ${textRun.textRunText}`)
        if (rowKey !== null) itemPageIndexes.set(rowKey, [...(itemPageIndexes.get(rowKey) ?? []), pageIndex])
      }
    })
    // Every row, and every amount, on exactly one page.
    for (const [rowKey, rowPageIndexes] of itemPageIndexes) expect(rowPageIndexes, rowKey).toHaveLength(1)
    // Amounts are right-aligned: their right edges line up.
    const amountRightEdges = new Set(listPageTextRuns(pageLayoutPlan, 0).filter((textRun) => /^\d+\.\d\d$/.test(textRun.textRunText)).map((textRun) => Math.round(textRun.textLeftPoints + textRun.textWidthPoints)))
    expect(amountRightEdges.size).toBe(1)
    // The links column is centered: its dashes sit in the middle of their column.
    const dashLefts = new Set(listPageTextRuns(pageLayoutPlan, 0).filter((textRun) => textRun.textRunText === '—').map((textRun) => textRun.textLeftPoints))
    expect(dashLefts.size).toBe(1)
    const roles = new Set(pageLayoutPlan.pdfExportStructureElements.map((structureElement) => structureElement.structureRole))
    for (const tableRole of ['Table', 'TR', 'TH', 'TD']) expect(roles.has(tableRole as never)).toBe(true)
  })

  it('shrinks a table too wide for the page to 7.5 pt, then breaks long words, and splits a row taller than a page', async () => {
    const wideColumnCount = 9
    const wideTableText = [
      `| ${Array.from({ length: wideColumnCount }, (_column, columnIndex) => `Heading${columnIndex + 1}`).join(' | ')} |`,
      `| ${Array.from({ length: wideColumnCount }, () => '---').join(' | ')} |`,
      `| ${Array.from({ length: wideColumnCount }, () => 'Supercalifragilisticexpialidocious').join(' | ')} |`,
    ].join('\n')
    const { pageLayoutPlan } = planPapelizPdfExportNotePages(await buildPapelizPdfExportTestNotePdfJob('Wide table.md', wideTableText))
    const cellTextSizes = new Set(listPageTextRuns(pageLayoutPlan, 0).filter((textRun) => textRun.operationTagging.operationTaggingKind === 'structure').map((textRun) => textRun.textSizePoints))
    expect([...cellTextSizes]).toEqual([7.5])

    const tallRowText = `| Column |\n| --- |\n| ${Array.from({ length: 900 }, (_cellWord, cellWordIndex) => `Word${cellWordIndex + 1}`).join(' ')} |`
    const tallRowPdf = await writePapelizPdfExportNotePdf(await buildPapelizPdfExportTestNotePdfJob('Tall row.md', tallRowText))
    expect(tallRowPdf.pdfPageCount).toBeGreaterThan(1)
    const tallRowReading = await readPapelizPdfExportFileWithPdfJs(tallRowPdf.pdfFileBytes)
    const tallRowWords = tallRowReading.pdfJsTextItemsByPage
      .flat()
      .filter((pdfJsTextItem) => !pdfJsTextItem.isPdfJsArtifactText)
      .map((pdfJsTextItem) => pdfJsTextItem.pdfJsText)
      .join(' ')
      .match(/Word\d+/g)
    expect(tallRowWords).toHaveLength(900)
  })
})
