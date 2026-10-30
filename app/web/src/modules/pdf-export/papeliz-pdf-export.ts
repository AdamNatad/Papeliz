import type { PapelizDocxExportPictureTools } from '../docx-export/papeliz-docx-export-pictures'
import { writePapelizExportZipFile, type PapelizExportZipEntry } from '../export-zip/papeliz-export-zip-file-writer'
import type { PapelizExportPageSize } from '../export-print-style/papeliz-export-print-style'
import { getPapelizHtmlExportNoteLanguageTag } from '../html-export/papeliz-html-export-note-article'
import { createPapelizHtmlExportVaultFileResolver, type PapelizHtmlExportVaultFileResolver } from '../html-export/papeliz-html-export-vault-files'
import { createPapelizWikilinkTargetResolver, type PapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { renderPapelizMdViewNote } from '../md-view/papeliz-md-view-render-pipeline'
import { escapePapelizWikilinkPipesInTableRows } from '../md-view/papeliz-md-view-table-model'
import { readPapelizNoteFrontmatterProperties } from '../md-view/papeliz-note-frontmatter-properties'
import type { PapelizVaultAdapter } from '../vault/papeliz-vault-adapter'
import { getVaultEntryParentFolderRelativePath, getVaultNoteTitle, splitVaultRelativePath } from '../vault/papeliz-vault-relative-paths'
import { getPapelizSafeFileNameStem } from '../workspace/papeliz-export-file-save'
import type { PapelizNoteFontFamily } from '../workspace/papeliz-note-typography-store'
import {
  createPapelizPdfExportPagePictureTools,
  drawPapelizPdfExportCharacterPicturesOnCanvas,
  preparePapelizPdfExportNotePictures,
  type PapelizPdfExportCharacterPictureDrawer,
} from './papeliz-pdf-export-assets'
import { listPapelizPdfExportCharacterPictureRequests } from './papeliz-pdf-export-character-pictures'
import {
  choosePapelizPdfExportComputerFontFiles,
  createPapelizPdfExportBrowserComputerFontSource,
  createPapelizPdfExportComputerFontReading,
  listPapelizPdfExportComputerFontRequests,
  type PapelizPdfExportComputerFontFile,
  type PapelizPdfExportComputerFontReading,
  type PapelizPdfExportComputerFontsAsker,
  type PapelizPdfExportComputerFontSource,
} from './papeliz-pdf-export-computer-fonts'
import { drawPapelizPdfExportVectorDiagramOnPage, type PapelizPdfExportVectorDiagramDrawer } from './papeliz-pdf-export-diagram-drawing'
import { describePapelizPdfExportFailure, PapelizPdfExportError } from './papeliz-pdf-export-errors'
import { readPapelizPdfExportFontFile, type PapelizPdfExportFontFileReader } from './papeliz-pdf-export-font-files'
import { listPapelizPdfExportNoteFontFaceKeys } from './papeliz-pdf-export-fonts'
import { resolvePapelizPdfExportLimits } from './papeliz-pdf-export-limits'
import { buildPapelizPdfExportNoteDocument } from './papeliz-pdf-export-note-document-from-hast'
import type { PapelizPdfExportNotePdfJob } from './papeliz-pdf-export-note-pdf'
import { getPapelizPdfExportPageArea } from './papeliz-pdf-export-page-area'
import { createPapelizPdfExportNotePdfWriter, type PapelizPdfExportNotePdfWriter } from './papeliz-pdf-export-worker-client'

// Export › PDF: the Settings gear's Export page loads this with `import()` when someone exports as
// PDF. Papeliz writes the PDF itself, with no print window: each note is read here as MD View reads
// it, with its pictures drawn again on the page's canvas (and, for characters no bundled font has, the
// computer's fonts when the person allows them), then laid out and written in the PDF worker, which
// holds pdfkit. One note becomes `<Note name>.pdf`; several become `<Vault name> PDF.zip`, one `.pdf`
// per note in the vault's folders.

export { PapelizPdfExportError } from './papeliz-pdf-export-errors'

export const papelizPdfExportFileMediaType = 'application/pdf'

export interface PapelizPdfExportVault {
  vaultAdapter: PapelizVaultAdapter
  vaultDisplayName: string
}

export interface PapelizPdfExportOptions {
  pdfExportVault: PapelizPdfExportVault
  // The ticked notes, in the file list's order.
  pdfExportVaultNoteRelativePaths: readonly string[]
  // Every note in the vault: links resolve over them as MD View resolves them.
  pdfExportEveryVaultNoteRelativePath: readonly string[]
  pdfExportPageSize: PapelizExportPageSize
  pdfExportNoteFontFamily: PapelizNoteFontFamily
  onPdfExportProgress?: (exportedNoteCount: number, pdfExportNoteCount: number) => void
  pdfExportAbortSignal?: AbortSignal
  // Where the font files come from and what writes each note's PDF: the app's own files and the
  // PDF worker unless given (tests, which have no worker).
  readPdfExportFontFile?: PapelizPdfExportFontFileReader
  pdfExportNotePdfWriter?: PapelizPdfExportNotePdfWriter
  // How pictures, diagrams and characters no font has are drawn: the page's canvas, `fetch` and
  // MD View's Mermaid unless given.
  pdfExportPictureTools?: Partial<PapelizDocxExportPictureTools>
  drawPdfExportCharacterPictures?: PapelizPdfExportCharacterPictureDrawer
  // How diagrams become vector drawings: MD View's print draw walked on the page unless given.
  drawPdfExportVectorDiagram?: PapelizPdfExportVectorDiagramDrawer
  // How the Export page asks to use the computer's fonts, when the browser hasn't been told yet.
  askPdfExportComputerFonts?: PapelizPdfExportComputerFontsAsker
  // Where the computer's fonts come from: the browser's Local Font Access unless given (tests give
  // their own, or null for none).
  pdfExportComputerFontSource?: PapelizPdfExportComputerFontSource | null
}

export interface PapelizPdfExportResult {
  pdfExportFileName: string
  pdfExportFileBlob: Blob
  // What the export couldn't carry, for the Export page to say.
  pdfExportNotices: string[]
}

export interface PapelizPdfExportFileKind {
  pdfExportFileName: string
  pdfExportFileDescription: string
  pdfExportFileMediaType: string
  pdfExportFileExtension: string
}

// "Projects/Launch plan.md" -> "Launch plan.pdf"
export function getPapelizPdfExportFileNameForNote(vaultNoteRelativePath: string): string {
  return `${getPapelizSafeFileNameStem(getVaultNoteTitle(vaultNoteRelativePath), 'Note')}.pdf`
}

// "Field Notes" -> "Field Notes PDF.zip"
export function getPapelizPdfExportZipFileName(vaultDisplayName: string): string {
  return `${getPapelizSafeFileNameStem(vaultDisplayName, 'Notes')} PDF.zip`
}

// What the export will save, known before it runs, so the save dialog can open first.
export function describePapelizPdfExportFile(vaultDisplayName: string, pdfExportVaultNoteRelativePaths: readonly string[]): PapelizPdfExportFileKind {
  const onlyPdfExportVaultNoteRelativePath = pdfExportVaultNoteRelativePaths.length === 1 ? pdfExportVaultNoteRelativePaths[0] : undefined
  if (onlyPdfExportVaultNoteRelativePath !== undefined) {
    return {
      pdfExportFileName: getPapelizPdfExportFileNameForNote(onlyPdfExportVaultNoteRelativePath),
      pdfExportFileDescription: 'PDF document',
      pdfExportFileMediaType: papelizPdfExportFileMediaType,
      pdfExportFileExtension: '.pdf',
    }
  }
  return {
    pdfExportFileName: getPapelizPdfExportZipFileName(vaultDisplayName),
    pdfExportFileDescription: 'PDF documents (.zip)',
    pdfExportFileMediaType: 'application/zip',
    pdfExportFileExtension: '.zip',
  }
}

// Each note's path inside the `.zip`: its vault folders, then its safe name. Two notes whose names
// end up the same in one folder (also when only their case differs) get " 2", " 3" after the name.
export function getPapelizPdfExportZipEntryPaths(pdfExportVaultNoteRelativePaths: readonly string[]): Map<string, string> {
  const zipEntryPathsByVaultNoteRelativePath = new Map<string, string>()
  const takenZipEntryPathKeys = new Set<string>()
  for (const vaultNoteRelativePath of pdfExportVaultNoteRelativePaths) {
    const zipFolderPath = splitVaultRelativePath(getVaultEntryParentFolderRelativePath(vaultNoteRelativePath))
      .map((vaultFolderName) => `${getPapelizSafeFileNameStem(vaultFolderName, 'Folder')}/`)
      .join('')
    const zipFileNameStem = getPapelizSafeFileNameStem(getVaultNoteTitle(vaultNoteRelativePath), 'Note')
    let zipEntryPath = `${zipFolderPath}${zipFileNameStem}.pdf`
    for (let zipFileNameRepeatNumber = 2; takenZipEntryPathKeys.has(zipEntryPath.toLowerCase()); zipFileNameRepeatNumber += 1) {
      zipEntryPath = `${zipFolderPath}${zipFileNameStem} ${zipFileNameRepeatNumber}.pdf`
    }
    takenZipEntryPathKeys.add(zipEntryPath.toLowerCase())
    zipEntryPathsByVaultNoteRelativePath.set(vaultNoteRelativePath, zipEntryPath)
  }
  return zipEntryPathsByVaultNoteRelativePath
}

export interface PapelizPdfExportNotePdfJobOptions {
  vaultNoteRelativePath: string
  vaultNoteText: string
  resolveWikilinkTarget: PapelizWikilinkTargetResolver
  pdfExportPageSize: PapelizExportPageSize
  pdfExportNoteFontFamily: PapelizNoteFontFamily
  readPdfExportFontFile: PapelizPdfExportFontFileReader
  // Font files already read in this export, by face key.
  pdfExportFontFilesByFaceKey: Map<string, Uint8Array>
  pdfExportCreationDate: Date
  // The vault's pictures the note shows, and how pictures and characters are drawn; without them,
  // pictures keep MD View's chip, diagrams their source, and characters no font has print as boxes.
  resolveVaultFileReference?: PapelizHtmlExportVaultFileResolver
  readVaultFileBlob?: (vaultFileRelativePath: string) => Promise<Blob>
  pdfExportPictureTools?: PapelizDocxExportPictureTools
  drawPdfExportCharacterPictures?: PapelizPdfExportCharacterPictureDrawer
  drawPdfExportVectorDiagram?: PapelizPdfExportVectorDiagramDrawer
  // The computer's fonts, for characters no bundled font has, and the faces already read in this
  // export; without a source those characters print as pictures.
  pdfExportComputerFontSource?: PapelizPdfExportComputerFontSource | null
  pdfExportComputerFontReading?: PapelizPdfExportComputerFontReading
  pdfExportAbortSignal?: AbortSignal
}

// What the worker needs for one note: the note read as MD View reads it, its pictures and diagrams,
// pictures of the characters no bundled font has (kept for any the computer's fonts don't draw either),
// the computer's fonts for them, and the font files its text uses. The note's name is the PDF's title;
// its `lang` property is the PDF's language.
export async function buildPapelizPdfExportNotePdfJob(notePdfJobOptions: PapelizPdfExportNotePdfJobOptions): Promise<PapelizPdfExportNotePdfJob> {
  const { noteFrontmatterText, noteHastRoot } = renderPapelizMdViewNote(notePdfJobOptions.vaultNoteText, {
    resolveWikilinkTarget: notePdfJobOptions.resolveWikilinkTarget,
    fromVaultNoteRelativePath: notePdfJobOptions.vaultNoteRelativePath,
  })
  const pdfExportDocumentTitle = getVaultNoteTitle(notePdfJobOptions.vaultNoteRelativePath)
  const pdfExportPageArea = getPapelizPdfExportPageArea(notePdfJobOptions.pdfExportPageSize)
  const { readVaultFileBlob } = notePdfJobOptions
  const notePictures = await preparePapelizPdfExportNotePictures({
    noteHastRoot,
    vaultNoteRelativePath: notePdfJobOptions.vaultNoteRelativePath,
    pdfExportNoteName: pdfExportDocumentTitle,
    resolveWikilinkTarget: notePdfJobOptions.resolveWikilinkTarget,
    resolveVaultFileReference: readVaultFileBlob === undefined ? null : (notePdfJobOptions.resolveVaultFileReference ?? null),
    readVaultFileBlob: readVaultFileBlob ?? (() => Promise.reject(new Error('This export has no vault files.'))),
    pdfExportPictureTools: notePdfJobOptions.pdfExportPictureTools ?? createPapelizPdfExportPagePictureTools(),
    pdfExportNoteFontFamily: notePdfJobOptions.pdfExportNoteFontFamily,
    contentWidthPoints: pdfExportPageArea.contentWidthPoints,
    contentHeightPoints: pdfExportPageArea.contentBottomPoints - pdfExportPageArea.contentTopPoints,
    ...(notePdfJobOptions.pdfExportAbortSignal === undefined ? {} : { pdfExportAbortSignal: notePdfJobOptions.pdfExportAbortSignal }),
  })
  // Each diagram drawn as vectors too, when the page can walk its drawing; its picture stays the
  // fallback.
  const drawPdfExportVectorDiagram = notePdfJobOptions.drawPdfExportVectorDiagram ?? drawPapelizPdfExportVectorDiagramOnPage
  for (const notePictureEntry of notePictures.notePictureEntriesByElement.values()) {
    if (notePictureEntry.notePictureEntryKind !== 'shown' || !notePictureEntry.isMermaidDiagram) continue
    notePdfJobOptions.pdfExportAbortSignal?.throwIfAborted()
    notePictureEntry.diagramVectorDrawing = await drawPdfExportVectorDiagram(notePictureEntry.pictureDescription, notePdfJobOptions.pdfExportNoteFontFamily)
  }
  const pdfExportNoteDocument = buildPapelizPdfExportNoteDocument({
    noteHastRoot,
    noteParsedText: escapePapelizWikilinkPipesInTableRows(notePdfJobOptions.vaultNoteText),
    noteFrontmatterText,
    noteFontFamily: notePdfJobOptions.pdfExportNoteFontFamily,
    vaultNoteRelativePath: notePdfJobOptions.vaultNoteRelativePath,
    resolveWikilinkTarget: notePdfJobOptions.resolveWikilinkTarget,
    notePictureEntriesByElement: notePictures.notePictureEntriesByElement,
  })
  const pdfExportLimits = resolvePapelizPdfExportLimits()
  const drawPdfExportCharacterPictures = notePdfJobOptions.drawPdfExportCharacterPictures ?? drawPapelizPdfExportCharacterPicturesOnCanvas
  const characterPictureRequests = listPapelizPdfExportCharacterPictureRequests(pdfExportNoteDocument, pdfExportDocumentTitle, pdfExportLimits.maximumCharacterPictureCount)
  const pdfExportCharacterPictures = await drawPdfExportCharacterPictures(characterPictureRequests)
  let pdfExportComputerFonts: PapelizPdfExportComputerFontFile[] = []
  const computerFontRequests = listPapelizPdfExportComputerFontRequests(characterPictureRequests)
  const { pdfExportComputerFontSource } = notePdfJobOptions
  if (computerFontRequests.length > 0 && pdfExportComputerFontSource !== undefined && pdfExportComputerFontSource !== null) {
    const localFonts = await pdfExportComputerFontSource.listComputerFonts(pdfExportDocumentTitle)
    notePdfJobOptions.pdfExportAbortSignal?.throwIfAborted()
    if (localFonts !== null) {
      pdfExportComputerFonts = await choosePapelizPdfExportComputerFontFiles(
        computerFontRequests,
        localFonts,
        notePdfJobOptions.pdfExportComputerFontReading ?? createPapelizPdfExportComputerFontReading(),
      )
    }
  }
  const pdfExportFontFiles: Array<{ fontFaceKey: string; fontFileBytes: Uint8Array }> = []
  for (const fontFaceKey of listPapelizPdfExportNoteFontFaceKeys(pdfExportNoteDocument, pdfExportDocumentTitle)) {
    let fontFileBytes = notePdfJobOptions.pdfExportFontFilesByFaceKey.get(fontFaceKey)
    if (fontFileBytes === undefined) {
      try {
        fontFileBytes = await notePdfJobOptions.readPdfExportFontFile(fontFaceKey)
      } catch (fontFileError) {
        throw new PapelizPdfExportError('pdf-export-font-unreadable', `The font file ${fontFaceKey} couldn’t be read: ${String(fontFileError)}`)
      }
      notePdfJobOptions.pdfExportFontFilesByFaceKey.set(fontFaceKey, fontFileBytes)
    }
    pdfExportFontFiles.push({ fontFaceKey, fontFileBytes })
  }
  return {
    pdfExportNoteDocument,
    pdfExportFontFiles,
    pdfExportPageSize: notePdfJobOptions.pdfExportPageSize,
    pdfExportDocumentTitle,
    pdfExportDocumentLanguageTag: getPapelizHtmlExportNoteLanguageTag(noteFrontmatterText === null ? [] : readPapelizNoteFrontmatterProperties(noteFrontmatterText)),
    pdfExportCreationDateIso: notePdfJobOptions.pdfExportCreationDate.toISOString(),
    pdfExportPictures: notePictures.pdfExportPictures,
    pdfExportCharacterPictures,
    pdfExportComputerFonts,
    pdfExportPreparationNotices: notePictures.pdfExportPictureNotices,
  }
}

export async function exportPapelizNotesAsPdf(pdfExportOptions: PapelizPdfExportOptions): Promise<PapelizPdfExportResult> {
  const { pdfExportVault, pdfExportVaultNoteRelativePaths, pdfExportAbortSignal } = pdfExportOptions
  const resolveWikilinkTarget = createPapelizWikilinkTargetResolver(pdfExportOptions.pdfExportEveryVaultNoteRelativePath)
  const pdfExportFontFilesByFaceKey = new Map<string, Uint8Array>()
  const pdfExportCreationDate = new Date()
  const pdfExportLimits = resolvePapelizPdfExportLimits()
  const pdfExportNoteCount = pdfExportVaultNoteRelativePaths.length
  const pdfExportNotices: string[] = []
  const notePdfWriter = pdfExportOptions.pdfExportNotePdfWriter ?? createPapelizPdfExportNotePdfWriter()
  // One set of picture tools for the whole export, so the diagrams' fonts are prepared once.
  const pdfExportPictureTools: PapelizDocxExportPictureTools = { ...createPapelizPdfExportPagePictureTools(), ...pdfExportOptions.pdfExportPictureTools }
  const resolveVaultFileReference = createPapelizHtmlExportVaultFileResolver(await pdfExportVault.vaultAdapter.listVaultAttachmentFileRelativePaths())
  // Asked at most once, and each face read at most once, in the whole export.
  const pdfExportComputerFontSource =
    pdfExportOptions.pdfExportComputerFontSource !== undefined ? pdfExportOptions.pdfExportComputerFontSource : createPapelizPdfExportBrowserComputerFontSource(pdfExportOptions.askPdfExportComputerFonts ?? null)
  const pdfExportComputerFontReading = createPapelizPdfExportComputerFontReading()
  const readVaultFileBlob = (vaultFileRelativePath: string) => pdfExportVault.vaultAdapter.readVaultAttachmentFileBlob(vaultFileRelativePath)
  const writeNotePdfFile = async (vaultNoteRelativePath: string, exportedNoteCount: number): Promise<Uint8Array> => {
    pdfExportAbortSignal?.throwIfAborted()
    const vaultNoteText = await pdfExportVault.vaultAdapter.readVaultNoteText(vaultNoteRelativePath)
    try {
      const notePdfJob = await buildPapelizPdfExportNotePdfJob({
        vaultNoteRelativePath,
        vaultNoteText,
        resolveWikilinkTarget,
        pdfExportPageSize: pdfExportOptions.pdfExportPageSize,
        pdfExportNoteFontFamily: pdfExportOptions.pdfExportNoteFontFamily,
        readPdfExportFontFile: pdfExportOptions.readPdfExportFontFile ?? readPapelizPdfExportFontFile,
        pdfExportFontFilesByFaceKey,
        pdfExportCreationDate,
        resolveVaultFileReference,
        readVaultFileBlob,
        pdfExportPictureTools,
        pdfExportComputerFontSource,
        pdfExportComputerFontReading,
        ...(pdfExportOptions.drawPdfExportCharacterPictures === undefined ? {} : { drawPdfExportCharacterPictures: pdfExportOptions.drawPdfExportCharacterPictures }),
        ...(pdfExportOptions.drawPdfExportVectorDiagram === undefined ? {} : { drawPdfExportVectorDiagram: pdfExportOptions.drawPdfExportVectorDiagram }),
        ...(pdfExportAbortSignal === undefined ? {} : { pdfExportAbortSignal }),
      })
      const { pdfFileBytes, pdfExportNoteNotices } = await notePdfWriter.writeNotePdf(notePdfJob, () => {}, pdfExportAbortSignal)
      pdfExportNotices.push(...pdfExportNoteNotices)
      pdfExportOptions.onPdfExportProgress?.(exportedNoteCount + 1, pdfExportNoteCount)
      return pdfFileBytes
    } catch (notePdfError) {
      if (!(notePdfError instanceof PapelizPdfExportError)) throw notePdfError
      // The worker's detail goes to the console; the Export page shows a plain line.
      console.warn('Papeliz PDF export:', notePdfError.message)
      throw new PapelizPdfExportError(notePdfError.pdfExportErrorCode, describePapelizPdfExportFailure(notePdfError.pdfExportErrorCode, getPapelizPdfExportFileNameForNote(vaultNoteRelativePath)))
    }
  }

  try {
    const onlyPdfExportVaultNoteRelativePath = pdfExportNoteCount === 1 ? pdfExportVaultNoteRelativePaths[0] : undefined
    if (onlyPdfExportVaultNoteRelativePath !== undefined) {
      const pdfFileBytes = await writeNotePdfFile(onlyPdfExportVaultNoteRelativePath, 0)
      pdfExportAbortSignal?.throwIfAborted()
      return {
        pdfExportFileName: getPapelizPdfExportFileNameForNote(onlyPdfExportVaultNoteRelativePath),
        pdfExportFileBlob: new Blob([pdfFileBytes as BlobPart], { type: papelizPdfExportFileMediaType }),
        pdfExportNotices,
      }
    }
    const zipEntryPathsByVaultNoteRelativePath = getPapelizPdfExportZipEntryPaths(pdfExportVaultNoteRelativePaths)
    const pdfExportZipEntries: PapelizExportZipEntry[] = []
    let pdfExportZipByteCount = 0
    for (const vaultNoteRelativePath of pdfExportVaultNoteRelativePaths) {
      const pdfFileBytes = await writeNotePdfFile(vaultNoteRelativePath, pdfExportZipEntries.length)
      pdfExportZipByteCount += pdfFileBytes.byteLength
      if (pdfExportZipByteCount > pdfExportLimits.maximumPdfZipByteCount) {
        throw new PapelizPdfExportError('pdf-export-limit-reached', 'this export is over 1 GB; export fewer notes at a time')
      }
      pdfExportZipEntries.push({ zipEntryPath: zipEntryPathsByVaultNoteRelativePath.get(vaultNoteRelativePath) ?? getPapelizPdfExportFileNameForNote(vaultNoteRelativePath), zipEntryBytes: pdfFileBytes })
    }
    pdfExportAbortSignal?.throwIfAborted()
    return {
      pdfExportFileName: getPapelizPdfExportZipFileName(pdfExportVault.vaultDisplayName),
      pdfExportFileBlob: await writePapelizExportZipFile(pdfExportZipEntries, { zipEntryModifiedDate: pdfExportCreationDate }),
      pdfExportNotices,
    }
  } finally {
    notePdfWriter.closeNotePdfWriter()
  }
}
