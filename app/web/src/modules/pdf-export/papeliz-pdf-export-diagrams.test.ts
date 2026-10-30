import { describe, expect, it } from 'vitest'
import type { PapelizDocxExportPictureTools } from '../docx-export/papeliz-docx-export-pictures'
import { createPapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { buildPapelizPdfExportNotePdfJob } from './papeliz-pdf-export'
import type { PapelizPdfExportVectorDiagramDrawer } from './papeliz-pdf-export-diagram-drawing'
import { planPapelizPdfExportNotePages, writePapelizPdfExportNotePdf } from './papeliz-pdf-export-note-pdf'
import type { PapelizPdfExportVectorDrawingOperation } from './papeliz-pdf-export-page-layout-plan'
import { papelizPdfExportIdentityVectorTransform, type PapelizPdfExportVectorDrawing } from './papeliz-pdf-export-vector-drawing'
import {
  createPapelizPdfExportTestPngBytes,
  papelizPdfExportTestDate,
  readPapelizPdfExportBodyText,
  readPapelizPdfExportFileLatin1Text,
  readPapelizPdfExportFileWithPdfJs,
  readPapelizPdfExportTestFontFile,
  removePapelizPdfExportTestWhitespace,
} from './papeliz-pdf-export.test-support'

// Phase 7 of the PDF export: a Mermaid diagram as vectors, its labels real text, when the page could
// walk its drawing; its picture otherwise.

const flowchartSource = 'flowchart LR\n  A[Write a block] --> B[Ünïcode label]'

// A box with a label, a line to a second box and an arrowhead, as the page's walk would give it.
const testVectorDrawing: PapelizPdfExportVectorDrawing = {
  vectorDrawingWidth: 300,
  vectorDrawingHeight: 60,
  vectorShapes: [
    {
      vectorShapePathData: 'M0 0H120V60H0Z',
      vectorShapeTransform: papelizPdfExportIdentityVectorTransform,
      vectorShapeFillColor: '#eaf2fe',
      vectorShapeFillOpacity: 1,
      vectorShapeFillRule: 'nonzero',
      vectorShapeStrokeColor: '#0064d4',
      vectorShapeStrokeOpacity: 1,
      vectorShapeStrokeWidth: 1,
      vectorShapeLineCap: 'butt',
      vectorShapeLineJoin: 'miter',
      vectorShapeMiterLimit: 4,
      vectorShapeDashArray: [],
      vectorShapeDashOffset: 0,
      vectorShapeFillGradient: null,
      vectorShapeStrokeGradient: null,
    },
    {
      vectorShapePathData: 'M120 30L170 30',
      vectorShapeTransform: papelizPdfExportIdentityVectorTransform,
      vectorShapeFillColor: null,
      vectorShapeFillOpacity: 1,
      vectorShapeFillRule: 'nonzero',
      vectorShapeStrokeColor: '#686c73',
      vectorShapeStrokeOpacity: 1,
      vectorShapeStrokeWidth: 2,
      vectorShapeLineCap: 'butt',
      vectorShapeLineJoin: 'miter',
      vectorShapeMiterLimit: 4,
      vectorShapeDashArray: [3, 3],
      vectorShapeDashOffset: 0,
      vectorShapeFillGradient: null,
      vectorShapeStrokeGradient: null,
    },
  ],
  vectorTextRuns: [
    {
      vectorTextRunText: 'Write a block',
      vectorTextRunFontFamilyName: 'figtree',
      vectorTextRunFontWeight: 400,
      isVectorTextRunItalic: false,
      vectorTextRunSize: 15,
      vectorTextRunColor: '#111112',
      vectorTextRunOpacity: 1,
      vectorTextRunTransform: [1, 0, 0, 1, 10, 0],
      vectorTextRunLeft: 0,
      vectorTextRunBaseline: 35,
    },
    {
      vectorTextRunText: 'Ünïcode łabel',
      vectorTextRunFontFamilyName: 'figtree',
      vectorTextRunFontWeight: 700,
      isVectorTextRunItalic: false,
      vectorTextRunSize: 15,
      vectorTextRunColor: '#111112',
      vectorTextRunOpacity: 1,
      vectorTextRunTransform: [1, 0, 0, 1, 180, 0],
      vectorTextRunLeft: 0,
      vectorTextRunBaseline: 35,
    },
  ],
}

const testPictureTools: PapelizDocxExportPictureTools = {
  drawDocxExportIconPng: async () => null,
  rewriteDocxExportPicture: async () => null,
  fetchDocxExportWebPicture: async () => null,
  drawDocxExportMermaidDiagramPng: async () => ({
    docxExportPicture: { pictureBytes: createPapelizPdfExportTestPngBytes(30, 6), pictureType: 'png', picturePixelWidth: 30, picturePixelHeight: 6 },
    mermaidDiagramPixelWidth: 300,
    mermaidDiagramPixelHeight: 60,
  }),
}

async function buildDiagramTestJob(drawPdfExportVectorDiagram: PapelizPdfExportVectorDiagramDrawer) {
  const noteText = `# Diagram\n\n\`\`\`mermaid\n${flowchartSource}\n\`\`\`\n`
  return buildPapelizPdfExportNotePdfJob({
    vaultNoteRelativePath: 'Diagram.md',
    vaultNoteText: noteText,
    resolveWikilinkTarget: createPapelizWikilinkTargetResolver(['Diagram.md']),
    pdfExportPageSize: 'a4',
    pdfExportNoteFontFamily: 'sans',
    readPdfExportFontFile: readPapelizPdfExportTestFontFile,
    pdfExportFontFilesByFaceKey: new Map(),
    pdfExportCreationDate: papelizPdfExportTestDate,
    pdfExportPictureTools: testPictureTools,
    drawPdfExportVectorDiagram,
  })
}

describe('PDF export vector diagrams', () => {
  it('draws a diagram as vectors with its labels as real text in the embedded faces, its source as its alternate text', async () => {
    const drawnDiagramSources: string[] = []
    const notePdfJob = await buildDiagramTestJob(async (mermaidDiagramSource, noteFontFamily) => {
      drawnDiagramSources.push(`${noteFontFamily}: ${mermaidDiagramSource}`)
      return testVectorDrawing
    })
    expect(drawnDiagramSources).toEqual([`sans: ${flowchartSource}`])
    // The labels' faces are read: the bold one in Figtree's 600, "ł" in its `latin-ext` file.
    expect(notePdfJob.pdfExportFontFiles.map(({ fontFaceKey }) => fontFaceKey)).toEqual(expect.arrayContaining(['figtree-latin-600-normal', 'figtree-latin-ext-600-normal']))
    const pageOperations = planPapelizPdfExportNotePages(notePdfJob).pageLayoutPlan.pdfExportPages.flatMap((pagePlan) => pagePlan.pageOperations)
    const vectorDrawingOperation = pageOperations.find((pageOperation): pageOperation is PapelizPdfExportVectorDrawingOperation => pageOperation.pageOperationKind === 'vector-drawing' && pageOperation.vectorDrawing.vectorDrawingWidth === 300)
    expect(vectorDrawingOperation).toBeDefined()
    // Each label in the pieces its faces draw.
    expect(vectorDrawingOperation?.vectorDrawing.vectorTextRuns.map((vectorTextRun) => vectorTextRun.vectorTextRunText)).toEqual(['Write a block', 'Ünïcode ', 'ł', 'abel'])
    expect(vectorDrawingOperation?.vectorTextRunFontFaceKeys).toEqual(['figtree-latin-400-normal', 'figtree-latin-600-normal', 'figtree-latin-ext-600-normal', 'figtree-latin-600-normal'])
    expect(pageOperations.some((pageOperation) => pageOperation.pageOperationKind === 'picture')).toBe(false)
    const { pdfFileBytes } = await writePapelizPdfExportNotePdf(notePdfJob)
    // No picture of it in the file; its labels copy out.
    expect(readPapelizPdfExportFileLatin1Text(pdfFileBytes)).not.toMatch(/\/Subtype \/Image/)
    const pdfJsReading = await readPapelizPdfExportFileWithPdfJs(pdfFileBytes)
    expect(removePapelizPdfExportTestWhitespace(readPapelizPdfExportBodyText(pdfJsReading))).toBe('DiagramWriteablockÜnïcodełabel')
    expect(JSON.stringify(pdfJsReading.pdfJsStructureTreesByPage)).toContain('"role":"Figure"')
  })

  it('draws the picture when the page couldn’t walk the drawing, or a label has a character no embedded face has', async () => {
    for (const vectorDrawing of [null, { ...testVectorDrawing, vectorTextRuns: [{ ...testVectorDrawing.vectorTextRuns[0]!, vectorTextRunText: 'Label 漢字' }] }]) {
      const notePdfJob = await buildDiagramTestJob(async () => vectorDrawing)
      const pageOperations = planPapelizPdfExportNotePages(notePdfJob).pageLayoutPlan.pdfExportPages.flatMap((pagePlan) => pagePlan.pageOperations)
      expect(pageOperations.filter((pageOperation) => pageOperation.pageOperationKind === 'picture')).toHaveLength(1)
      expect(pageOperations.some((pageOperation) => pageOperation.pageOperationKind === 'vector-drawing' && pageOperation.vectorDrawing.vectorDrawingWidth === 300)).toBe(false)
    }
  })
})
