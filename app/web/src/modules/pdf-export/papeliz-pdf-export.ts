import { writePapelizExportZipFile, type PapelizExportZipEntry } from '../export-zip/papeliz-export-zip-file-writer'
import type { PapelizExportPageSize } from '../export-print-style/papeliz-export-print-style'
import { getPapelizHtmlExportNoteLanguageTag } from '../html-export/papeliz-html-export-note-article'
import { createPapelizWikilinkTargetResolver, type PapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { renderPapelizMdViewNote } from '../md-view/papeliz-md-view-render-pipeline'
import { escapePapelizWikilinkPipesInTableRows } from '../md-view/papeliz-md-view-table-model'
import { readPapelizNoteFrontmatterProperties } from '../md-view/papeliz-note-frontmatter-properties'
import type { PapelizVaultAdapter } from '../vault/papeliz-vault-adapter'
import { getVaultEntryParentFolderRelativePath, getVaultNoteTitle, splitVaultRelativePath } from '../vault/papeliz-vault-relative-paths'
import { getPapelizSafeFileNameStem } from '../workspace/papeliz-export-file-save'
import type { PapelizNoteFontFamily } from '../workspace/papeliz-note-typography-store'
import { describePapelizPdfExportFailure, PapelizPdfExportError } from './papeliz-pdf-export-errors'
import { readPapelizPdfExportFontFile, type PapelizPdfExportFontFileReader } from './papeliz-pdf-export-font-files'
import { listPapelizPdfExportNoteFontFaceKeys } from './papeliz-pdf-export-fonts'
import { resolvePapelizPdfExportLimits } from './papeliz-pdf-export-limits'
import { buildPapelizPdfExportNoteDocument } from './papeliz-pdf-export-note-document-from-hast'
import type { PapelizPdfExportNotePdfJob } from './papeliz-pdf-export-note-pdf'
import { createPapelizPdfExportNotePdfWriter, type PapelizPdfExportNotePdfWriter } from './papeliz-pdf-export-worker-client'

// Export › PDF: the Settings gear's Export page loads this with `import()` when someone exports as
// PDF. Papeliz writes the PDF itself, with no print window: each note is read here as MD View reads
// it, then laid out and written in the PDF worker, which holds pdfkit. One note becomes
// `<Note name>.pdf`; several become `<Vault name> PDF.zip`, one `.pdf` per note in the vault's folders.

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
}

// What the worker needs for one note: the note read as MD View reads it, and the font files its text
// uses. The note's name is the PDF's title; its `lang` property is the PDF's language.
export async function buildPapelizPdfExportNotePdfJob(notePdfJobOptions: PapelizPdfExportNotePdfJobOptions): Promise<PapelizPdfExportNotePdfJob> {
  const { noteFrontmatterText, noteHastRoot } = renderPapelizMdViewNote(notePdfJobOptions.vaultNoteText, {
    resolveWikilinkTarget: notePdfJobOptions.resolveWikilinkTarget,
    fromVaultNoteRelativePath: notePdfJobOptions.vaultNoteRelativePath,
  })
  const pdfExportNoteDocument = buildPapelizPdfExportNoteDocument({
    noteHastRoot,
    noteParsedText: escapePapelizWikilinkPipesInTableRows(notePdfJobOptions.vaultNoteText),
    noteFrontmatterText,
    noteFontFamily: notePdfJobOptions.pdfExportNoteFontFamily,
    vaultNoteRelativePath: notePdfJobOptions.vaultNoteRelativePath,
    resolveWikilinkTarget: notePdfJobOptions.resolveWikilinkTarget,
  })
  const pdfExportDocumentTitle = getVaultNoteTitle(notePdfJobOptions.vaultNoteRelativePath)
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
