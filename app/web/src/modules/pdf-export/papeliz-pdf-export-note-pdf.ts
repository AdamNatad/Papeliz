import { create as createFontkitFont, type PapelizFontkitFont } from 'fontkit'
import {
  papelizExportFooterDistanceFromPageEdgeMillimeters,
  papelizExportPageMarginsInMillimeters,
  papelizExportPageSizesInPoints,
  type PapelizExportPageSize,
} from '../export-print-style/papeliz-export-print-style'
import { layOutPapelizPdfExportNoteBlocks } from './papeliz-pdf-export-block-layout'
import { PapelizPdfExportError } from './papeliz-pdf-export-errors'
import { checkPapelizPdfExportFileBytes } from './papeliz-pdf-export-file-check'
import { drawPapelizPdfExportPageLayoutPlan, openPapelizPdfExportDocument, type PapelizPdfExportOpenDocument } from './papeliz-pdf-export-file-writer'
import { getPapelizPdfExportNoteFontFamilyName } from './papeliz-pdf-export-fonts'
import { resolvePapelizPdfExportLimits, type PapelizPdfExportLimits } from './papeliz-pdf-export-limits'
import type { PapelizPdfExportNoteDocument } from './papeliz-pdf-export-note-document'
import { checkPapelizPdfExportPageLayoutPlan, type PapelizPdfExportPageLayoutPlan } from './papeliz-pdf-export-page-layout-plan'
import { paginatePapelizPdfExportBlocks, type PapelizPdfExportPageArea } from './papeliz-pdf-export-pagination'
import { createPapelizPdfExportTextMeasurer } from './papeliz-pdf-export-text-measuring'

// One note's PDF, from its note document and the font files it needs: fonts opened, the note laid
// out into a page layout plan, the plan checked and drawn, the finished file checked. This runs in the
// PDF worker (papeliz-pdf-export-worker.ts), and in tests as it is.

export interface PapelizPdfExportNotePdfJob {
  pdfExportNoteDocument: PapelizPdfExportNoteDocument
  pdfExportFontFiles: ReadonlyArray<{ fontFaceKey: string; fontFileBytes: Uint8Array }>
  pdfExportPageSize: PapelizExportPageSize
  // The note's name: the PDF's title and its footer.
  pdfExportDocumentTitle: string
  pdfExportDocumentLanguageTag: string
  pdfExportCreationDateIso: string
}

export interface PapelizPdfExportNotePdf {
  pdfFileBytes: Uint8Array
  pdfPageCount: number
  pdfExportNoteNotices: string[]
}

export interface PapelizPdfExportNotePdfProgress {
  onPdfExportNoteProgress?: (drawnPageCount: number, pdfPageCount: number) => void
  throwIfPdfExportCancelled?: () => void
}

const papelizPdfExportPointsPerMillimeter = 72 / 25.4

export function getPapelizPdfExportPageArea(pdfExportPageSize: PapelizExportPageSize): PapelizPdfExportPageArea {
  const { pageWidthPoints, pageHeightPoints } = papelizExportPageSizesInPoints[pdfExportPageSize]
  const { topMillimeters, rightMillimeters, bottomMillimeters, leftMillimeters } = papelizExportPageMarginsInMillimeters
  const contentLeftPoints = leftMillimeters * papelizPdfExportPointsPerMillimeter
  const contentTopPoints = topMillimeters * papelizPdfExportPointsPerMillimeter
  return {
    pageWidthPoints,
    pageHeightPoints,
    contentLeftPoints,
    contentTopPoints,
    contentWidthPoints: pageWidthPoints - contentLeftPoints - rightMillimeters * papelizPdfExportPointsPerMillimeter,
    contentBottomPoints: pageHeightPoints - bottomMillimeters * papelizPdfExportPointsPerMillimeter,
    footerBottomFromPageEdgePoints: papelizExportFooterDistanceFromPageEdgeMillimeters * papelizPdfExportPointsPerMillimeter,
  }
}

// "Garden plan" with 3 characters no font has -> "3 characters in “Garden plan” have no font in the
// PDF yet, so they print as boxes."
function describeMissingCharacters(missingCharacterCount: number, pdfExportDocumentTitle: string): string {
  return missingCharacterCount === 1
    ? `A character in “${pdfExportDocumentTitle}” has no font in the PDF yet, so it prints as a box.`
    : `${missingCharacterCount} characters in “${pdfExportDocumentTitle}” have no font in the PDF yet, so they print as boxes.`
}

function openFontkitFonts(pdfExportFontFiles: PapelizPdfExportNotePdfJob['pdfExportFontFiles']): Map<string, PapelizFontkitFont> {
  const fontkitFontsByFaceKey = new Map<string, PapelizFontkitFont>()
  for (const { fontFaceKey, fontFileBytes } of pdfExportFontFiles) {
    try {
      fontkitFontsByFaceKey.set(fontFaceKey, createFontkitFont(fontFileBytes))
    } catch (fontkitError) {
      throw new PapelizPdfExportError('pdf-export-font-unreadable', `The font ${fontFaceKey} couldn’t be read: ${String(fontkitError)}`)
    }
  }
  return fontkitFontsByFaceKey
}

export interface PapelizPdfExportPlannedNote {
  openDocument: PapelizPdfExportOpenDocument
  pageLayoutPlan: PapelizPdfExportPageLayoutPlan
  missingCharacterCount: number
}

// The note's fonts opened and its pages planned and checked, ready to draw.
export function planPapelizPdfExportNotePages(
  notePdfJob: PapelizPdfExportNotePdfJob,
  pdfExportLimits: PapelizPdfExportLimits = resolvePapelizPdfExportLimits(),
  throwIfPdfExportCancelled: () => void = () => {},
): PapelizPdfExportPlannedNote {
  const fontkitFontsByFaceKey = openFontkitFonts(notePdfJob.pdfExportFontFiles)
  const openDocument = openPapelizPdfExportDocument(
    {
      pdfExportDocumentTitle: notePdfJob.pdfExportDocumentTitle,
      pdfExportDocumentLanguageTag: notePdfJob.pdfExportDocumentLanguageTag,
      pdfExportCreationDate: new Date(notePdfJob.pdfExportCreationDateIso),
    },
    new Map(notePdfJob.pdfExportFontFiles.map(({ fontFaceKey, fontFileBytes }) => [fontFaceKey, fontFileBytes])),
    pdfExportLimits,
  )
  const textMeasurer = createPapelizPdfExportTextMeasurer(openDocument.pdfKitDocument, fontkitFontsByFaceKey)
  const pdfExportPageArea = getPapelizPdfExportPageArea(notePdfJob.pdfExportPageSize)
  let pageLayoutPlan: PapelizPdfExportPageLayoutPlan
  let missingCharacterCount: number
  try {
    const laidOutNote = layOutPapelizPdfExportNoteBlocks({ pdfExportNoteDocument: notePdfJob.pdfExportNoteDocument, contentWidthPoints: pdfExportPageArea.contentWidthPoints, textMeasurer })
    missingCharacterCount = laidOutNote.missingCharacterCount
    throwIfPdfExportCancelled()
    pageLayoutPlan = {
      pdfExportDocumentTitle: notePdfJob.pdfExportDocumentTitle,
      pdfExportDocumentLanguageTag: notePdfJob.pdfExportDocumentLanguageTag,
      pdfExportPageWidthPoints: pdfExportPageArea.pageWidthPoints,
      pdfExportPageHeightPoints: pdfExportPageArea.pageHeightPoints,
      pdfExportFontFaceKeys: [...fontkitFontsByFaceKey.keys()],
      pdfExportStructureElements: laidOutNote.structureElements,
      pdfExportPages: paginatePapelizPdfExportBlocks({
        laidOutBlocks: laidOutNote.laidOutBlocks,
        pdfExportPageArea,
        footerNoteName: notePdfJob.pdfExportDocumentTitle,
        footerFontStyle: { fontFamilyName: getPapelizPdfExportNoteFontFamilyName(notePdfJob.pdfExportNoteDocument.noteFontFamily), fontWeight: 400, isFontItalic: false },
        textMeasurer,
      }),
      pdfExportBookmarks: laidOutNote.bookmarks,
    }
  } catch (layoutError) {
    if (layoutError instanceof PapelizPdfExportError) throw layoutError
    throw new PapelizPdfExportError('pdf-export-layout-failed', `The note couldn’t be laid out: ${String(layoutError)}`)
  }
  checkPapelizPdfExportPageLayoutPlan(pageLayoutPlan, pdfExportLimits)
  return { openDocument, pageLayoutPlan, missingCharacterCount }
}

export async function writePapelizPdfExportNotePdf(
  notePdfJob: PapelizPdfExportNotePdfJob,
  notePdfProgress: PapelizPdfExportNotePdfProgress = {},
  pdfExportLimits: PapelizPdfExportLimits = resolvePapelizPdfExportLimits(),
): Promise<PapelizPdfExportNotePdf> {
  const throwIfPdfExportCancelled = notePdfProgress.throwIfPdfExportCancelled ?? (() => {})
  const { openDocument, pageLayoutPlan, missingCharacterCount } = planPapelizPdfExportNotePages(notePdfJob, pdfExportLimits, throwIfPdfExportCancelled)
  let pdfFileBytes: Uint8Array
  try {
    pdfFileBytes = await drawPapelizPdfExportPageLayoutPlan(openDocument, pageLayoutPlan, {
      onPdfPageDrawn: (drawnPageCount, pdfPageCount) => notePdfProgress.onPdfExportNoteProgress?.(drawnPageCount, pdfPageCount),
      throwIfPdfExportCancelled,
    })
  } catch (writerError) {
    if (writerError instanceof PapelizPdfExportError) throw writerError
    throw new PapelizPdfExportError('pdf-export-writer-failed', `The PDF couldn’t be written: ${String(writerError)}`)
  }
  checkPapelizPdfExportFileBytes(pdfFileBytes, { hasPdfBookmarks: pageLayoutPlan.pdfExportBookmarks.length > 0 })
  return {
    pdfFileBytes,
    pdfPageCount: pageLayoutPlan.pdfExportPages.length,
    pdfExportNoteNotices: missingCharacterCount > 0 ? [describeMissingCharacters(missingCharacterCount, notePdfJob.pdfExportDocumentTitle)] : [],
  }
}
