import { create as createFontkitFont, type PapelizFontkitFont } from 'fontkit'
import type { PapelizExportPageSize } from '../export-print-style/papeliz-export-print-style'
import { layOutPapelizPdfExportNoteBlocks } from './papeliz-pdf-export-block-layout'
import { getPapelizPdfExportGlyphlessText, papelizPdfExportCharacterPictureFontFaceKey, type PapelizPdfExportCharacterPicture } from './papeliz-pdf-export-character-pictures'
import { PapelizPdfExportError } from './papeliz-pdf-export-errors'
import { checkPapelizPdfExportFileBytes } from './papeliz-pdf-export-file-check'
import { drawPapelizPdfExportPageLayoutPlan, openPapelizPdfExportDocument, type PapelizPdfExportOpenDocument, type PapelizPdfExportPictureFiles } from './papeliz-pdf-export-file-writer'
import { getPapelizPdfExportNoteFontFamilyName } from './papeliz-pdf-export-fonts'
import { buildPapelizPdfExportGlyphlessFont } from './papeliz-pdf-export-glyphless-font'
import { resolvePapelizPdfExportLimits, type PapelizPdfExportLimits } from './papeliz-pdf-export-limits'
import type { PapelizPdfExportNoteDocument } from './papeliz-pdf-export-note-document'
import type { PapelizPdfExportComputerFontFile } from './papeliz-pdf-export-computer-fonts'
import { checkPapelizPdfExportPageLayoutPlan, type PapelizPdfExportPageLayoutPlan } from './papeliz-pdf-export-page-layout-plan'
import { findPapelizPdfExportPictureProblem, type PapelizPdfExportPictureFile } from './papeliz-pdf-export-picture-check'
import { getPapelizPdfExportPageArea } from './papeliz-pdf-export-page-area'
import { paginatePapelizPdfExportBlocks } from './papeliz-pdf-export-pagination'
import { createPapelizPdfExportTextMeasurer, type PapelizPdfExportComputerFontFace } from './papeliz-pdf-export-text-measuring'

// One note's PDF, from its note document, the font files it needs and its pictures: pictures checked,
// fonts opened (the computer's fonts checked first, and an outline-free one for the characters that
// print as pictures), the note laid out into a page layout plan, the plan checked and drawn, the
// finished file checked. This runs in the PDF worker (papeliz-pdf-export-worker.ts), and in tests as
// it is.

export interface PapelizPdfExportNotePdfJob {
  pdfExportNoteDocument: PapelizPdfExportNoteDocument
  pdfExportFontFiles: ReadonlyArray<{ fontFaceKey: string; fontFileBytes: Uint8Array }>
  pdfExportPageSize: PapelizExportPageSize
  // The note's name: the PDF's title and its footer.
  pdfExportDocumentTitle: string
  pdfExportDocumentLanguageTag: string
  pdfExportCreationDateIso: string
  // The note's pictures and diagrams, each drawn again on the page's canvas, in the note's order.
  pdfExportPictures: PapelizPdfExportPictureFile[]
  // Pictures of the characters no font in the PDF has.
  pdfExportCharacterPictures: PapelizPdfExportCharacterPicture[]
  // Faces of fonts on the computer, for characters no bundled font has; none without permission.
  pdfExportComputerFonts: PapelizPdfExportComputerFontFile[]
  // What the page couldn't prepare (a picture it couldn't read, a diagram it couldn't draw).
  pdfExportPreparationNotices: string[]
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
    let fontkitFont: PapelizFontkitFont | null
    try {
      fontkitFont = createFontkitFont(fontFileBytes)
    } catch (fontkitError) {
      throw new PapelizPdfExportError('pdf-export-font-unreadable', `The font ${fontFaceKey} couldn’t be read: ${String(fontkitError)}`)
    }
    if (fontkitFont === null) throw new PapelizPdfExportError('pdf-export-font-unreadable', `The font ${fontFaceKey} holds no face.`)
    fontkitFontsByFaceKey.set(fontFaceKey, fontkitFont)
  }
  return fontkitFontsByFaceKey
}

// A font collection (`.ttc`) starts with "ttcf"; its faces are picked by PostScript name.
function isFontCollection(fontFileBytes: Uint8Array): boolean {
  return fontFileBytes[0] === 0x74 && fontFileBytes[1] === 0x74 && fontFileBytes[2] === 0x63 && fontFileBytes[3] === 0x66
}

// The font's maker allows embedding it as a subset: not "restricted license" alone, not "no
// subsetting", not "bitmap only" (OpenType's OS/2 `fsType`).
function canEmbedFontkitFont(fontkitFont: PapelizFontkitFont): boolean {
  const fontEmbeddingBits = fontkitFont['OS/2']?.fsType
  if (fontEmbeddingBits === undefined) return true
  if (fontEmbeddingBits.noSubsetting || fontEmbeddingBits.bitmapOnly) return false
  return !(fontEmbeddingBits.noEmbedding && !fontEmbeddingBits.viewOnly && !fontEmbeddingBits.editable)
}

interface PapelizPdfExportOpenComputerFonts {
  computerFontFaces: PapelizPdfExportComputerFontFace[]
  computerFontkitFontsByFaceKey: Map<string, PapelizFontkitFont>
  computerFontFilesByFaceKey: Map<string, Uint8Array>
  fontCollectionFaceNamesByFaceKey: Map<string, string>
}

// The computer's fonts are outside input: each is opened inside a `try` and kept only when it reads,
// names a face that exists, holds glyphs and may be embedded. One that fails leaves its characters to
// their pictures.
function openComputerFonts(computerFontFiles: readonly PapelizPdfExportComputerFontFile[]): PapelizPdfExportOpenComputerFonts {
  const openComputerFonts: PapelizPdfExportOpenComputerFonts = {
    computerFontFaces: [],
    computerFontkitFontsByFaceKey: new Map(),
    computerFontFilesByFaceKey: new Map(),
    fontCollectionFaceNamesByFaceKey: new Map(),
  }
  for (const computerFontFile of computerFontFiles) {
    const { computerFontFaceKey, fontFileBytes, computerFontPostscriptName } = computerFontFile
    const fontCollectionFaceName = isFontCollection(fontFileBytes) ? computerFontPostscriptName : null
    let fontkitFont: PapelizFontkitFont | null
    try {
      fontkitFont = fontCollectionFaceName === null ? createFontkitFont(fontFileBytes) : createFontkitFont(fontFileBytes, fontCollectionFaceName)
    } catch {
      fontkitFont = null
    }
    if (fontkitFont === null || fontkitFont.numGlyphs < 2 || fontkitFont.unitsPerEm <= 0 || !canEmbedFontkitFont(fontkitFont)) continue
    openComputerFonts.computerFontFaces.push({
      fontFaceKey: computerFontFaceKey,
      computerFontFamilyIndex: computerFontFile.computerFontFamilyIndex,
      computerFontScriptName: computerFontFile.computerFontScriptName,
      computerFontWeight: computerFontFile.computerFontWeight,
      isComputerFontItalic: computerFontFile.isComputerFontItalic,
    })
    openComputerFonts.computerFontkitFontsByFaceKey.set(computerFontFaceKey, fontkitFont)
    openComputerFonts.computerFontFilesByFaceKey.set(computerFontFaceKey, fontFileBytes)
    if (fontCollectionFaceName !== null) openComputerFonts.fontCollectionFaceNamesByFaceKey.set(computerFontFaceKey, fontCollectionFaceName)
  }
  return openComputerFonts
}

// "Garden plan" with one picture refused -> "A picture in “Garden plan” didn’t pass its check, so
// it shows as a line."
function describeRefusedPictures(refusedPictureCount: number, pdfExportDocumentTitle: string): string {
  return refusedPictureCount === 1
    ? `A picture in “${pdfExportDocumentTitle}” didn’t pass its check, so it shows as a line.`
    : `${refusedPictureCount} pictures in “${pdfExportDocumentTitle}” didn’t pass their check, so they show as lines.`
}

export interface PapelizPdfExportPlannedNote {
  openDocument: PapelizPdfExportOpenDocument
  pageLayoutPlan: PapelizPdfExportPageLayoutPlan
  pictureFiles: PapelizPdfExportPictureFiles
  missingCharacterCount: number
  refusedPictureCount: number
}

// The note's fonts opened and its pages planned and checked, ready to draw.
export function planPapelizPdfExportNotePages(
  notePdfJob: PapelizPdfExportNotePdfJob,
  pdfExportLimits: PapelizPdfExportLimits = resolvePapelizPdfExportLimits(),
  throwIfPdfExportCancelled: () => void = () => {},
): PapelizPdfExportPlannedNote {
  // Every picture is checked byte by byte; one that fails is left out with a notice.
  const usableNotePictureIndexes = new Set<number>()
  let refusedPictureCount = 0
  notePdfJob.pdfExportPictures.forEach((pictureFile, notePictureIndex) => {
    if (findPapelizPdfExportPictureProblem(pictureFile) === null) usableNotePictureIndexes.add(notePictureIndex)
    else refusedPictureCount += 1
  })
  const usableCharacterPictures = notePdfJob.pdfExportCharacterPictures
    .slice(0, pdfExportLimits.maximumCharacterPictureCount)
    .filter((characterPicture) => findPapelizPdfExportPictureProblem(characterPicture.pictureFile) === null)
  const pdfExportFontFiles = [...notePdfJob.pdfExportFontFiles]
  if (usableCharacterPictures.length > 0) {
    const glyphlessPictureTexts = usableCharacterPictures.map(({ pictureCharactersText, advanceEm }) => ({ pictureCharactersText: getPapelizPdfExportGlyphlessText(pictureCharactersText), advanceEm }))
    pdfExportFontFiles.push({ fontFaceKey: papelizPdfExportCharacterPictureFontFaceKey, fontFileBytes: buildPapelizPdfExportGlyphlessFont(glyphlessPictureTexts) })
  }
  const computerFonts = openComputerFonts(notePdfJob.pdfExportComputerFonts)
  const fontkitFontsByFaceKey = new Map([...openFontkitFonts(pdfExportFontFiles), ...computerFonts.computerFontkitFontsByFaceKey])
  const openDocument = openPapelizPdfExportDocument(
    {
      pdfExportDocumentTitle: notePdfJob.pdfExportDocumentTitle,
      pdfExportDocumentLanguageTag: notePdfJob.pdfExportDocumentLanguageTag,
      pdfExportCreationDate: new Date(notePdfJob.pdfExportCreationDateIso),
    },
    new Map([...pdfExportFontFiles.map(({ fontFaceKey, fontFileBytes }): [string, Uint8Array] => [fontFaceKey, fontFileBytes]), ...computerFonts.computerFontFilesByFaceKey]),
    pdfExportLimits,
    computerFonts.fontCollectionFaceNamesByFaceKey,
  )
  const characterPicturesByKey = new Map(usableCharacterPictures.map((characterPicture) => [characterPicture.characterPictureKey, characterPicture]))
  const textMeasurer = createPapelizPdfExportTextMeasurer(
    openDocument.pdfKitDocument,
    fontkitFontsByFaceKey,
    characterPicturesByKey,
    computerFonts.computerFontFaces,
    notePdfJob.pdfExportDocumentLanguageTag,
  )
  const pdfExportPageArea = getPapelizPdfExportPageArea(notePdfJob.pdfExportPageSize)
  let pageLayoutPlan: PapelizPdfExportPageLayoutPlan
  let missingCharacterCount: number
  try {
    const laidOutNote = layOutPapelizPdfExportNoteBlocks({
      pdfExportNoteDocument: notePdfJob.pdfExportNoteDocument,
      contentWidthPoints: pdfExportPageArea.contentWidthPoints,
      contentHeightPoints: pdfExportPageArea.contentBottomPoints - pdfExportPageArea.contentTopPoints,
      textMeasurer,
      usableNotePictureIndexes,
    })
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
      pdfExportNotePictureCount: notePdfJob.pdfExportPictures.length,
      pdfExportCharacterPictureKeys: [...characterPicturesByKey.keys()],
    }
  } catch (layoutError) {
    if (layoutError instanceof PapelizPdfExportError) throw layoutError
    throw new PapelizPdfExportError('pdf-export-layout-failed', `The note couldn’t be laid out: ${String(layoutError)}`)
  }
  checkPapelizPdfExportPageLayoutPlan(pageLayoutPlan, pdfExportLimits)
  return {
    openDocument,
    pageLayoutPlan,
    pictureFiles: { notePictureFiles: notePdfJob.pdfExportPictures, characterPictureFilesByKey: new Map(usableCharacterPictures.map(({ characterPictureKey, pictureFile }) => [characterPictureKey, pictureFile])) },
    missingCharacterCount,
    refusedPictureCount,
  }
}

export async function writePapelizPdfExportNotePdf(
  notePdfJob: PapelizPdfExportNotePdfJob,
  notePdfProgress: PapelizPdfExportNotePdfProgress = {},
  pdfExportLimits: PapelizPdfExportLimits = resolvePapelizPdfExportLimits(),
): Promise<PapelizPdfExportNotePdf> {
  const throwIfPdfExportCancelled = notePdfProgress.throwIfPdfExportCancelled ?? (() => {})
  const { openDocument, pageLayoutPlan, pictureFiles, missingCharacterCount, refusedPictureCount } = planPapelizPdfExportNotePages(notePdfJob, pdfExportLimits, throwIfPdfExportCancelled)
  let pdfFileBytes: Uint8Array
  try {
    pdfFileBytes = await drawPapelizPdfExportPageLayoutPlan(openDocument, pageLayoutPlan, pictureFiles, {
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
    pdfExportNoteNotices: [
      ...notePdfJob.pdfExportPreparationNotices,
      ...(refusedPictureCount > 0 ? [describeRefusedPictures(refusedPictureCount, notePdfJob.pdfExportDocumentTitle)] : []),
      ...(missingCharacterCount > 0 ? [describeMissingCharacters(missingCharacterCount, notePdfJob.pdfExportDocumentTitle)] : []),
    ],
  }
}
