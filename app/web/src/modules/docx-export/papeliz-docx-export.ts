import { Document, Packer, TextRun } from 'docx'
import { writePapelizExportZipFile, type PapelizExportZipEntry } from '../export-zip/papeliz-export-zip-file-writer'
import { readPapelizImportZipFile } from '../export-zip/papeliz-import-zip-file-reader'
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
  buildPapelizDocxExportBody,
  createPapelizDocxExportBodyElement,
  getPapelizDocxExportCalloutIconKey,
  listPapelizDocxExportCalloutIcons,
  type PapelizDocxExportBlock,
} from './papeliz-docx-export-document-from-hast'
import {
  createPapelizDocxExportCachedIconDrawer,
  createPapelizDocxExportPagePictureTools,
  preparePapelizDocxExportNotePictures,
  type PapelizDocxExportNotePictures,
  type PapelizDocxExportPicture,
  type PapelizDocxExportPictureTools,
} from './papeliz-docx-export-pictures'
import {
  buildPapelizDocxExportFooter,
  buildPapelizDocxExportNumbering,
  buildPapelizDocxExportPageProperties,
  buildPapelizDocxExportStyles,
  fromDocxTwips,
  getDocxExportPrintColor,
  getPapelizDocxExportTextHeightTwips,
  getPapelizDocxExportTextWidthTwips,
  removePapelizDocxExportUnwritableCharacters,
} from './papeliz-docx-export-styles'
import { buildPapelizDocxExportPropertiesBlocks, describePapelizDocxExportGapParagraph } from './papeliz-docx-export-tables'

// Export › Word: the Settings gear's Export page loads this with `import()` when someone exports as
// Word, so the `docx` library downloads only then. One note becomes `<Note name>.docx`; several notes
// become `<Vault name> Word.zip`, one `.docx` per note in the vault's folders, linked to each other.
// Notes are written one at a time, on the main thread, with a turn for the page between them. Each
// file holds its pictures and diagrams, so it shows them anywhere, and fetches nothing when opened.

export const papelizDocxExportFileMediaType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export interface PapelizDocxExportVault {
  vaultAdapter: PapelizVaultAdapter
  vaultDisplayName: string
}

export interface PapelizDocxExportOptions {
  docxExportVault: PapelizDocxExportVault
  // The ticked notes, in the file list's order.
  docxExportVaultNoteRelativePaths: readonly string[]
  // Every note in the vault: links resolve over them as MD View resolves them.
  docxExportEveryVaultNoteRelativePath: readonly string[]
  docxExportPageSize: PapelizExportPageSize
  docxExportNoteFontFamily: PapelizNoteFontFamily
  // How pictures are read, drawn and written again; the page's canvas, `fetch` and Mermaid unless given.
  docxExportPictureTools?: Partial<PapelizDocxExportPictureTools>
  onDocxExportProgress?: (exportedNoteCount: number, docxExportNoteCount: number) => void
  docxExportAbortSignal?: AbortSignal
}

export interface PapelizDocxExportResult {
  docxExportFileName: string
  docxExportFileBlob: Blob
  // What the export couldn't carry, for the Export page to say.
  docxExportNotices: string[]
}

export interface PapelizDocxExportFileKind {
  docxExportFileName: string
  docxExportFileDescription: string
  docxExportFileMediaType: string
  docxExportFileExtension: string
}

export interface PapelizDocxExportNoteFileOptions {
  vaultNoteRelativePath: string
  vaultNoteText: string
  resolveWikilinkTarget: PapelizWikilinkTargetResolver
  docxExportPageSize: PapelizExportPageSize
  docxExportNoteFontFamily: PapelizNoteFontFamily
  // The link from this note's file to another note's file in the same `.zip`; none for one note.
  getDocxExportNoteFileHref?: (targetVaultNoteRelativePath: string) => string | null
  // The vault's pictures the note shows; without them, they keep MD View's "Image: …" line.
  resolveVaultFileReference?: PapelizHtmlExportVaultFileResolver
  readVaultFileBlob?: (vaultFileRelativePath: string) => Promise<Blob>
  docxExportPictureTools?: Partial<PapelizDocxExportPictureTools>
  docxExportAbortSignal?: AbortSignal
}

export interface PapelizDocxExportNoteFile {
  docxExportNoteFileBlob: Blob
  // What the note's file couldn't carry: pictures that couldn't be read, diagrams that couldn't be drawn.
  docxExportNoteNotices: string[]
}

// "Projects/Launch plan.md" -> "Launch plan.docx"
export function getPapelizDocxExportFileNameForNote(vaultNoteRelativePath: string): string {
  return `${getPapelizSafeFileNameStem(getVaultNoteTitle(vaultNoteRelativePath), 'Note')}.docx`
}

// "Field Notes" -> "Field Notes Word.zip"
export function getPapelizDocxExportZipFileName(vaultDisplayName: string): string {
  return `${getPapelizSafeFileNameStem(vaultDisplayName, 'Notes')} Word.zip`
}

// What the export will save, known before it runs, so the save dialog can open first.
export function describePapelizDocxExportFile(vaultDisplayName: string, docxExportVaultNoteRelativePaths: readonly string[]): PapelizDocxExportFileKind {
  const onlyDocxExportVaultNoteRelativePath = docxExportVaultNoteRelativePaths.length === 1 ? docxExportVaultNoteRelativePaths[0] : undefined
  if (onlyDocxExportVaultNoteRelativePath !== undefined) {
    return {
      docxExportFileName: getPapelizDocxExportFileNameForNote(onlyDocxExportVaultNoteRelativePath),
      docxExportFileDescription: 'Word document',
      docxExportFileMediaType: papelizDocxExportFileMediaType,
      docxExportFileExtension: '.docx',
    }
  }
  return {
    docxExportFileName: getPapelizDocxExportZipFileName(vaultDisplayName),
    docxExportFileDescription: 'Word documents (.zip)',
    docxExportFileMediaType: 'application/zip',
    docxExportFileExtension: '.zip',
  }
}

// Each note's path inside the `.zip`: its vault folders, then its safe name. Two notes whose names
// end up the same in one folder (also when only their case differs, which Windows can't keep apart)
// get " 2", " 3" after the name.
export function getPapelizDocxExportZipEntryPaths(docxExportVaultNoteRelativePaths: readonly string[]): Map<string, string> {
  const zipEntryPathsByVaultNoteRelativePath = new Map<string, string>()
  const takenZipEntryPathKeys = new Set<string>()
  for (const vaultNoteRelativePath of docxExportVaultNoteRelativePaths) {
    const vaultFolderRelativePath = getVaultEntryParentFolderRelativePath(vaultNoteRelativePath)
    const zipFolderPath = splitVaultRelativePath(vaultFolderRelativePath)
      .map((vaultFolderName) => `${getPapelizSafeFileNameStem(vaultFolderName, 'Folder')}/`)
      .join('')
    const zipFileNameStem = getPapelizSafeFileNameStem(getVaultNoteTitle(vaultNoteRelativePath), 'Note')
    let zipEntryPath = `${zipFolderPath}${zipFileNameStem}.docx`
    for (let zipFileNameRepeatNumber = 2; takenZipEntryPathKeys.has(zipEntryPath.toLowerCase()); zipFileNameRepeatNumber += 1) {
      zipEntryPath = `${zipFolderPath}${zipFileNameStem} ${zipFileNameRepeatNumber}.docx`
    }
    takenZipEntryPathKeys.add(zipEntryPath.toLowerCase())
    zipEntryPathsByVaultNoteRelativePath.set(vaultNoteRelativePath, zipEntryPath)
  }
  return zipEntryPathsByVaultNoteRelativePath
}

// A relative link from one file in the `.zip` to another, which Word on a computer opens once the
// `.zip` is unpacked: "Guides/Callouts.docx" to "Projects/Garden plan.docx" is
// "../Projects/Garden%20plan.docx".
export function getPapelizDocxExportRelativeFileHref(fromZipEntryPath: string, toZipEntryPath: string): string {
  const fromZipFolderNames = fromZipEntryPath.split('/').slice(0, -1)
  const toZipPathSegments = toZipEntryPath.split('/')
  let sharedFolderCount = 0
  while (sharedFolderCount < fromZipFolderNames.length && sharedFolderCount < toZipPathSegments.length - 1 && fromZipFolderNames[sharedFolderCount] === toZipPathSegments[sharedFolderCount]) {
    sharedFolderCount += 1
  }
  return [...fromZipFolderNames.slice(sharedFolderCount).map(() => '..'), ...toZipPathSegments.slice(sharedFolderCount).map((zipPathSegment) => encodeURIComponent(zipPathSegment))].join('/')
}

function createPapelizDocxExportEmptyNoteBlock(): PapelizDocxExportBlock {
  return { docxExportParagraphOptions: { children: [new TextRun({ text: 'This note is empty.', color: getDocxExportPrintColor('--color-papeliz-ink-subtle') })] } }
}

// "Garden plan" with 2 web pictures missing -> "Couldn’t load 2 pictures from the web for “Garden
// plan”; they show as their address."
function describeDocxExportNoteNotices(docxExportNoteName: string, notePictures: PapelizDocxExportNotePictures): string[] {
  const docxExportNoteNotices: string[] = []
  const { missingWebPictureCount, missingVaultPictureNames, undrawnMermaidDiagramCount } = notePictures
  if (missingWebPictureCount > 0) {
    docxExportNoteNotices.push(
      missingWebPictureCount === 1
        ? `Couldn’t load a picture from the web for “${docxExportNoteName}”; it shows as its address.`
        : `Couldn’t load ${missingWebPictureCount} pictures from the web for “${docxExportNoteName}”; they show as their address.`,
    )
  }
  if (missingVaultPictureNames.length > 0) {
    const missingVaultPictureNamesText = missingVaultPictureNames.map((missingVaultPictureName) => `“${missingVaultPictureName}”`).join(', ')
    docxExportNoteNotices.push(`Couldn’t read ${missingVaultPictureNamesText} for “${docxExportNoteName}”; ${missingVaultPictureNames.length === 1 ? 'it shows' : 'they show'} as a line.`)
  }
  if (undrawnMermaidDiagramCount > 0) {
    docxExportNoteNotices.push(
      undrawnMermaidDiagramCount === 1
        ? `Couldn’t draw a diagram in “${docxExportNoteName}”; it shows as its source.`
        : `Couldn’t draw ${undrawnMermaidDiagramCount} diagrams in “${docxExportNoteName}”; they show as their source.`,
    )
  }
  return docxExportNoteNotices
}

const papelizDocxExportXmlPartPathPattern = /^word\/[^/]+\.xml$/

// Word reads a line break inside an attribute as a space, so each one in a picture's description (a
// diagram's Mermaid source) is written as a character reference, which the `docx` library doesn't do.
// The file is read and written again with Papeliz's own zip code.
async function keepPapelizDocxExportDescriptionLineBreaks(docxExportFileBlob: Blob): Promise<Blob> {
  const { importZipEntries } = readPapelizImportZipFile(new Uint8Array(await docxExportFileBlob.arrayBuffer()))
  const utf8Decoder = new TextDecoder()
  const utf8Encoder = new TextEncoder()
  const docxExportZipEntries: PapelizExportZipEntry[] = []
  for (const importZipEntry of importZipEntries) {
    if (importZipEntry.isImportZipEntryFolder) continue
    let zipEntryBytes = await importZipEntry.readImportZipEntryBytes()
    if (papelizDocxExportXmlPartPathPattern.test(importZipEntry.importZipEntryPath)) {
      const xmlPartText = utf8Decoder.decode(zipEntryBytes)
      const keptXmlPartText = xmlPartText.replace(/ descr="[^"]*"/g, (descriptionAttributeText) => descriptionAttributeText.replace(/\n/g, '&#xA;'))
      if (keptXmlPartText !== xmlPartText) zipEntryBytes = utf8Encoder.encode(keptXmlPartText)
    }
    docxExportZipEntries.push({ zipEntryPath: importZipEntry.importZipEntryPath, zipEntryBytes })
  }
  const keptDocxExportFileBlob = await writePapelizExportZipFile(docxExportZipEntries, { zipEntryModifiedDate: new Date() })
  return new Blob([keptDocxExportFileBlob], { type: papelizDocxExportFileMediaType })
}

// One note as a Word file: the same tree MD View's locked page draws, with the note's properties
// above it and its pictures held inside. The document's information holds the note's name as its
// title and nothing else about the person: author and "last modified by" are left empty.
export async function buildPapelizDocxExportNoteFile(noteFileOptions: PapelizDocxExportNoteFileOptions): Promise<PapelizDocxExportNoteFile> {
  const noteParsedText = escapePapelizWikilinkPipesInTableRows(noteFileOptions.vaultNoteText)
  const { noteFrontmatterText, noteHastRoot } = renderPapelizMdViewNote(noteFileOptions.vaultNoteText, {
    resolveWikilinkTarget: noteFileOptions.resolveWikilinkTarget,
    fromVaultNoteRelativePath: noteFileOptions.vaultNoteRelativePath,
  })
  const noteFrontmatterProperties = noteFrontmatterText === null ? [] : readPapelizNoteFrontmatterProperties(noteFrontmatterText)
  const docxExportNoteName = removePapelizDocxExportUnwritableCharacters(getVaultNoteTitle(noteFileOptions.vaultNoteRelativePath))
  const docxExportTextWidthTwips = getPapelizDocxExportTextWidthTwips(noteFileOptions.docxExportPageSize)
  const docxExportTextHeightTwips = getPapelizDocxExportTextHeightTwips(noteFileOptions.docxExportPageSize)
  const docxExportPictureTools: PapelizDocxExportPictureTools = { ...createPapelizDocxExportPagePictureTools(), ...noteFileOptions.docxExportPictureTools }

  const docxExportCalloutIconPictures = new Map<string, PapelizDocxExportPicture>()
  for (const { calloutIconName, calloutInkColor } of listPapelizDocxExportCalloutIcons(noteHastRoot)) {
    const calloutIconPicture = await docxExportPictureTools.drawDocxExportIconPng(calloutIconName, calloutInkColor)
    if (calloutIconPicture !== null) docxExportCalloutIconPictures.set(getPapelizDocxExportCalloutIconKey(calloutIconName, calloutInkColor), calloutIconPicture)
  }
  const { readVaultFileBlob } = noteFileOptions
  const notePictures = await preparePapelizDocxExportNotePictures({
    noteHastRoot,
    vaultNoteRelativePath: noteFileOptions.vaultNoteRelativePath,
    resolveWikilinkTarget: noteFileOptions.resolveWikilinkTarget,
    resolveVaultFileReference: readVaultFileBlob === undefined ? null : (noteFileOptions.resolveVaultFileReference ?? null),
    readVaultFileBlob: readVaultFileBlob ?? (() => Promise.reject(new Error('This export has no vault files.'))),
    docxExportPictureTools,
    docxExportNoteFontFamily: noteFileOptions.docxExportNoteFontFamily,
    docxExportTextWidthPoints: fromDocxTwips(docxExportTextWidthTwips),
    docxExportTextHeightPoints: fromDocxTwips(docxExportTextHeightTwips),
    ...(noteFileOptions.docxExportAbortSignal === undefined ? {} : { docxExportAbortSignal: noteFileOptions.docxExportAbortSignal }),
  })

  const { docxExportBlocks, docxExportNumberedListStarts } = buildPapelizDocxExportBody({
    noteHastRoot,
    noteParsedText,
    vaultNoteRelativePath: noteFileOptions.vaultNoteRelativePath,
    resolveWikilinkTarget: noteFileOptions.resolveWikilinkTarget,
    getDocxExportNoteFileHref: noteFileOptions.getDocxExportNoteFileHref ?? (() => null),
    docxExportTextWidthTwips,
    docxExportTextHeightTwips,
    docxExportCalloutIconPictures,
    docxExportNotePicturesByElement: notePictures.docxExportNotePicturesByElement,
  })
  const noteDocxExportBlocks: PapelizDocxExportBlock[] = [
    ...(noteFrontmatterProperties.length > 0 ? buildPapelizDocxExportPropertiesBlocks(noteFrontmatterProperties, docxExportTextWidthTwips) : []),
    ...docxExportBlocks,
    ...(noteFileOptions.vaultNoteText.trim().length === 0 ? [createPapelizDocxExportEmptyNoteBlock()] : []),
  ]
  // Word needs a paragraph at the end of the document, after a table too.
  const lastDocxExportBlock = noteDocxExportBlocks.at(-1)
  if (lastDocxExportBlock === undefined || 'docxExportTable' in lastDocxExportBlock) {
    noteDocxExportBlocks.push({ docxExportParagraphOptions: describePapelizDocxExportGapParagraph(0) })
  }

  const docxExportDocument = new Document({
    title: docxExportNoteName,
    creator: '',
    lastModifiedBy: '',
    styles: buildPapelizDocxExportStyles(noteFileOptions.docxExportNoteFontFamily, getPapelizHtmlExportNoteLanguageTag(noteFrontmatterProperties)),
    numbering: buildPapelizDocxExportNumbering(docxExportNumberedListStarts),
    sections: [
      {
        properties: buildPapelizDocxExportPageProperties(noteFileOptions.docxExportPageSize),
        footers: { default: buildPapelizDocxExportFooter(docxExportNoteName, noteFileOptions.docxExportPageSize) },
        children: noteDocxExportBlocks.map(createPapelizDocxExportBodyElement),
      },
    ],
  })
  const docxExportNoteFileBlob = await Packer.toBlob(docxExportDocument)
  const hasDescriptionLineBreak = [...notePictures.docxExportNotePicturesByElement.values()].some(
    (notePicture) => 'docxExportShownPicture' in notePicture && notePicture.docxExportShownPicture.pictureDescription.includes('\n'),
  )
  return {
    docxExportNoteFileBlob: hasDescriptionLineBreak ? await keepPapelizDocxExportDescriptionLineBreaks(docxExportNoteFileBlob) : docxExportNoteFileBlob,
    docxExportNoteNotices: describeDocxExportNoteNotices(docxExportNoteName, notePictures),
  }
}

function waitForPapelizDocxExportPageTurn(): Promise<void> {
  return new Promise((resolvePageTurn) => setTimeout(resolvePageTurn, 0))
}

export async function exportPapelizNotesAsDocx(docxExportOptions: PapelizDocxExportOptions): Promise<PapelizDocxExportResult> {
  const { docxExportVault, docxExportVaultNoteRelativePaths, docxExportAbortSignal } = docxExportOptions
  const resolveWikilinkTarget = createPapelizWikilinkTargetResolver(docxExportOptions.docxExportEveryVaultNoteRelativePath)
  // One set of tools for the whole export, so each icon and the diagrams' fonts are prepared once.
  const pagePictureTools = { ...createPapelizDocxExportPagePictureTools(), ...docxExportOptions.docxExportPictureTools }
  const docxExportPictureTools: PapelizDocxExportPictureTools = { ...pagePictureTools, drawDocxExportIconPng: createPapelizDocxExportCachedIconDrawer(pagePictureTools.drawDocxExportIconPng) }
  const resolveVaultFileReference = createPapelizHtmlExportVaultFileResolver(await docxExportVault.vaultAdapter.listVaultAttachmentFileRelativePaths())
  const readVaultFileBlob = (vaultFileRelativePath: string) => docxExportVault.vaultAdapter.readVaultAttachmentFileBlob(vaultFileRelativePath)
  const docxExportNoteCount = docxExportVaultNoteRelativePaths.length
  const docxExportNotices: string[] = []
  const writeDocxExportNoteFile = async (vaultNoteRelativePath: string, getDocxExportNoteFileHref: PapelizDocxExportNoteFileOptions['getDocxExportNoteFileHref']) => {
    const { docxExportNoteFileBlob, docxExportNoteNotices } = await buildPapelizDocxExportNoteFile({
      vaultNoteRelativePath,
      vaultNoteText: await docxExportVault.vaultAdapter.readVaultNoteText(vaultNoteRelativePath),
      resolveWikilinkTarget,
      docxExportPageSize: docxExportOptions.docxExportPageSize,
      docxExportNoteFontFamily: docxExportOptions.docxExportNoteFontFamily,
      ...(getDocxExportNoteFileHref === undefined ? {} : { getDocxExportNoteFileHref }),
      resolveVaultFileReference,
      readVaultFileBlob,
      docxExportPictureTools,
      ...(docxExportAbortSignal === undefined ? {} : { docxExportAbortSignal }),
    })
    docxExportNotices.push(...docxExportNoteNotices)
    return docxExportNoteFileBlob
  }

  const onlyDocxExportVaultNoteRelativePath = docxExportNoteCount === 1 ? docxExportVaultNoteRelativePaths[0] : undefined
  if (onlyDocxExportVaultNoteRelativePath !== undefined) {
    docxExportAbortSignal?.throwIfAborted()
    // One note's file has no other files beside it, so its links to other notes stay text.
    const docxExportFileBlob = await writeDocxExportNoteFile(onlyDocxExportVaultNoteRelativePath, undefined)
    docxExportAbortSignal?.throwIfAborted()
    docxExportOptions.onDocxExportProgress?.(1, 1)
    return { docxExportFileName: getPapelizDocxExportFileNameForNote(onlyDocxExportVaultNoteRelativePath), docxExportFileBlob, docxExportNotices }
  }

  const zipEntryPathsByVaultNoteRelativePath = getPapelizDocxExportZipEntryPaths(docxExportVaultNoteRelativePaths)
  const docxExportZipEntries: PapelizExportZipEntry[] = []
  for (const vaultNoteRelativePath of docxExportVaultNoteRelativePaths) {
    docxExportAbortSignal?.throwIfAborted()
    const zipEntryPath = zipEntryPathsByVaultNoteRelativePath.get(vaultNoteRelativePath) ?? getPapelizDocxExportFileNameForNote(vaultNoteRelativePath)
    const docxExportNoteFileBlob = await writeDocxExportNoteFile(vaultNoteRelativePath, (targetVaultNoteRelativePath) => {
      const targetZipEntryPath = zipEntryPathsByVaultNoteRelativePath.get(targetVaultNoteRelativePath)
      return targetZipEntryPath === undefined ? null : getPapelizDocxExportRelativeFileHref(zipEntryPath, targetZipEntryPath)
    })
    docxExportZipEntries.push({ zipEntryPath, zipEntryBytes: new Uint8Array(await docxExportNoteFileBlob.arrayBuffer()) })
    docxExportOptions.onDocxExportProgress?.(docxExportZipEntries.length, docxExportNoteCount)
    await waitForPapelizDocxExportPageTurn()
  }
  docxExportAbortSignal?.throwIfAborted()
  return {
    docxExportFileName: getPapelizDocxExportZipFileName(docxExportVault.vaultDisplayName),
    docxExportFileBlob: await writePapelizExportZipFile(docxExportZipEntries, { zipEntryModifiedDate: new Date() }),
    docxExportNotices,
  }
}
