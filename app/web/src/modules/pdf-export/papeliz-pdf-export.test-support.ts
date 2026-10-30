import charisSilLatin400NormalWoffDataUrl from '@fontsource/charis-sil/files/charis-sil-latin-400-normal.woff?inline'
import charisSilLatin400ItalicWoffDataUrl from '@fontsource/charis-sil/files/charis-sil-latin-400-italic.woff?inline'
import charisSilLatin700NormalWoffDataUrl from '@fontsource/charis-sil/files/charis-sil-latin-700-normal.woff?inline'
import charisSilLatin700ItalicWoffDataUrl from '@fontsource/charis-sil/files/charis-sil-latin-700-italic.woff?inline'
import charisSilLatinExtended400NormalWoffDataUrl from '@fontsource/charis-sil/files/charis-sil-latin-ext-400-normal.woff?inline'
import charisSilLatinExtended400ItalicWoffDataUrl from '@fontsource/charis-sil/files/charis-sil-latin-ext-400-italic.woff?inline'
import charisSilLatinExtended700NormalWoffDataUrl from '@fontsource/charis-sil/files/charis-sil-latin-ext-700-normal.woff?inline'
import charisSilLatinExtended700ItalicWoffDataUrl from '@fontsource/charis-sil/files/charis-sil-latin-ext-700-italic.woff?inline'
import figtreeLatin400NormalWoffDataUrl from '@fontsource/figtree/files/figtree-latin-400-normal.woff?inline'
import figtreeLatin400ItalicWoffDataUrl from '@fontsource/figtree/files/figtree-latin-400-italic.woff?inline'
import figtreeLatin500NormalWoffDataUrl from '@fontsource/figtree/files/figtree-latin-500-normal.woff?inline'
import figtreeLatin500ItalicWoffDataUrl from '@fontsource/figtree/files/figtree-latin-500-italic.woff?inline'
import figtreeLatin600NormalWoffDataUrl from '@fontsource/figtree/files/figtree-latin-600-normal.woff?inline'
import figtreeLatin600ItalicWoffDataUrl from '@fontsource/figtree/files/figtree-latin-600-italic.woff?inline'
import figtreeLatinExtended400NormalWoffDataUrl from '@fontsource/figtree/files/figtree-latin-ext-400-normal.woff?inline'
import figtreeLatinExtended400ItalicWoffDataUrl from '@fontsource/figtree/files/figtree-latin-ext-400-italic.woff?inline'
import figtreeLatinExtended500NormalWoffDataUrl from '@fontsource/figtree/files/figtree-latin-ext-500-normal.woff?inline'
import figtreeLatinExtended500ItalicWoffDataUrl from '@fontsource/figtree/files/figtree-latin-ext-500-italic.woff?inline'
import figtreeLatinExtended600NormalWoffDataUrl from '@fontsource/figtree/files/figtree-latin-ext-600-normal.woff?inline'
import figtreeLatinExtended600ItalicWoffDataUrl from '@fontsource/figtree/files/figtree-latin-ext-600-italic.woff?inline'
import jetBrainsMonoLatin400NormalWoffDataUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff?inline'
import jetBrainsMonoLatin400ItalicWoffDataUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-italic.woff?inline'
import jetBrainsMonoLatin700NormalWoffDataUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff?inline'
import jetBrainsMonoLatin700ItalicWoffDataUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-italic.woff?inline'
import jetBrainsMonoLatinExtended400NormalWoffDataUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-400-normal.woff?inline'
import jetBrainsMonoLatinExtended400ItalicWoffDataUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-400-italic.woff?inline'
import jetBrainsMonoLatinExtended700NormalWoffDataUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-700-normal.woff?inline'
import jetBrainsMonoLatinExtended700ItalicWoffDataUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-700-italic.woff?inline'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createPapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { papelizSampleVaultNotes } from '../vault/papeliz-sample-vault-notes'
import type { PapelizNoteFontFamily } from '../workspace/papeliz-note-typography-store'
import { buildPapelizPdfExportNotePdfJob } from './papeliz-pdf-export'
import type { PapelizPdfExportFontFileReader } from './papeliz-pdf-export-font-files'
import type { PapelizPdfExportNoteBlock, PapelizPdfExportNoteDocument } from './papeliz-pdf-export-note-document'
import { writePapelizPdfExportNotePdf, type PapelizPdfExportNotePdfJob } from './papeliz-pdf-export-note-pdf'
import { createPapelizPdfExportAbortError, type PapelizPdfExportNotePdfWriter } from './papeliz-pdf-export-worker-client'

// For the PDF export's tests: the font files as the build inlines them (tests have no server to
// fetch from), the PDF worker's work done in place (tests have no workers), each PDF read back with
// pdf.js, an independent reader, and the text a note document asks the PDF to print.

const papelizPdfExportTestFontDataUrlsByFaceKey: Readonly<Record<string, string>> = {
  'charis-sil-latin-400-normal': charisSilLatin400NormalWoffDataUrl,
  'charis-sil-latin-400-italic': charisSilLatin400ItalicWoffDataUrl,
  'charis-sil-latin-700-normal': charisSilLatin700NormalWoffDataUrl,
  'charis-sil-latin-700-italic': charisSilLatin700ItalicWoffDataUrl,
  'charis-sil-latin-ext-400-normal': charisSilLatinExtended400NormalWoffDataUrl,
  'charis-sil-latin-ext-400-italic': charisSilLatinExtended400ItalicWoffDataUrl,
  'charis-sil-latin-ext-700-normal': charisSilLatinExtended700NormalWoffDataUrl,
  'charis-sil-latin-ext-700-italic': charisSilLatinExtended700ItalicWoffDataUrl,
  'figtree-latin-400-normal': figtreeLatin400NormalWoffDataUrl,
  'figtree-latin-400-italic': figtreeLatin400ItalicWoffDataUrl,
  'figtree-latin-500-normal': figtreeLatin500NormalWoffDataUrl,
  'figtree-latin-500-italic': figtreeLatin500ItalicWoffDataUrl,
  'figtree-latin-600-normal': figtreeLatin600NormalWoffDataUrl,
  'figtree-latin-600-italic': figtreeLatin600ItalicWoffDataUrl,
  'figtree-latin-ext-400-normal': figtreeLatinExtended400NormalWoffDataUrl,
  'figtree-latin-ext-400-italic': figtreeLatinExtended400ItalicWoffDataUrl,
  'figtree-latin-ext-500-normal': figtreeLatinExtended500NormalWoffDataUrl,
  'figtree-latin-ext-500-italic': figtreeLatinExtended500ItalicWoffDataUrl,
  'figtree-latin-ext-600-normal': figtreeLatinExtended600NormalWoffDataUrl,
  'figtree-latin-ext-600-italic': figtreeLatinExtended600ItalicWoffDataUrl,
  'jetbrains-mono-latin-400-normal': jetBrainsMonoLatin400NormalWoffDataUrl,
  'jetbrains-mono-latin-400-italic': jetBrainsMonoLatin400ItalicWoffDataUrl,
  'jetbrains-mono-latin-700-normal': jetBrainsMonoLatin700NormalWoffDataUrl,
  'jetbrains-mono-latin-700-italic': jetBrainsMonoLatin700ItalicWoffDataUrl,
  'jetbrains-mono-latin-ext-400-normal': jetBrainsMonoLatinExtended400NormalWoffDataUrl,
  'jetbrains-mono-latin-ext-400-italic': jetBrainsMonoLatinExtended400ItalicWoffDataUrl,
  'jetbrains-mono-latin-ext-700-normal': jetBrainsMonoLatinExtended700NormalWoffDataUrl,
  'jetbrains-mono-latin-ext-700-italic': jetBrainsMonoLatinExtended700ItalicWoffDataUrl,
}

export const readPapelizPdfExportTestFontFile: PapelizPdfExportFontFileReader = async (fontFaceKey) => {
  const fontDataUrl = papelizPdfExportTestFontDataUrlsByFaceKey[fontFaceKey]
  if (fontDataUrl === undefined) throw new Error(`No test font ${fontFaceKey}`)
  return Uint8Array.from(atob(fontDataUrl.slice(fontDataUrl.indexOf(',') + 1)), (binaryCharacter) => binaryCharacter.charCodeAt(0))
}

export const papelizPdfExportInPlaceNotePdfWriter: PapelizPdfExportNotePdfWriter = {
  writeNotePdf: (notePdfJob, onNotePdfProgress, pdfExportAbortSignal) =>
    writePapelizPdfExportNotePdf(notePdfJob, {
      onPdfExportNoteProgress: onNotePdfProgress,
      throwIfPdfExportCancelled: () => {
        if (pdfExportAbortSignal?.aborted) throw createPapelizPdfExportAbortError()
      },
    }),
  closeNotePdfWriter: () => {},
}

export interface PapelizPdfExportPdfJsTextItem {
  pdfJsText: string
  // From the page's bottom edge, as PDF counts.
  pdfJsBaselineFromBottomPoints: number
  pdfJsLeftPoints: number
  pdfJsFontName: string
}

export interface PapelizPdfExportPdfJsStructureNode {
  role?: string
  children?: PapelizPdfExportPdfJsStructureNode[]
}

export interface PapelizPdfExportPdfJsLink {
  pdfJsPageIndex: number
  // A web link's address, or the named place an internal link leads to.
  pdfJsLinkAddress: string | null
  pdfJsLinkDestinationName: string | null
  pdfJsLinkDescription: string | null
}

export interface PapelizPdfExportPdfJsBookmark {
  pdfJsBookmarkTitle: string
  pdfJsBookmarkDepth: number
  pdfJsBookmarkDestinationName: string | null
  // pdf.js's count: positive while open, negative while closed, absent without children.
  pdfJsBookmarkCount: number | null
}

export interface PapelizPdfExportPdfJsReading {
  pdfJsPageCount: number
  pdfJsPageSizes: Array<{ pageWidthPoints: number; pageHeightPoints: number }>
  pdfJsTextItemsByPage: PapelizPdfExportPdfJsTextItem[][]
  pdfJsTitle: string | null
  pdfJsXmpTitle: string | null
  pdfJsLanguageTag: string | null
  pdfJsStructureRoles: string[]
  pdfJsStructureTreesByPage: Array<PapelizPdfExportPdfJsStructureNode | null>
  pdfJsLinks: PapelizPdfExportPdfJsLink[]
  // Each named place's page.
  pdfJsDestinationPageIndexes: Map<string, number>
  // Depth first, in the outline's order.
  pdfJsBookmarks: PapelizPdfExportPdfJsBookmark[]
  pdfJsPageMode: string | null
}

interface PapelizPdfExportPdfJsOutlineItem {
  title: string
  dest: string | unknown[] | null
  count?: number
  items: PapelizPdfExportPdfJsOutlineItem[]
}

function flattenPdfJsOutline(pdfJsOutlineItems: readonly PapelizPdfExportPdfJsOutlineItem[], pdfJsBookmarkDepth: number, pdfJsBookmarks: PapelizPdfExportPdfJsBookmark[]): void {
  for (const pdfJsOutlineItem of pdfJsOutlineItems) {
    pdfJsBookmarks.push({
      pdfJsBookmarkTitle: pdfJsOutlineItem.title,
      pdfJsBookmarkDepth: pdfJsBookmarkDepth,
      pdfJsBookmarkDestinationName: typeof pdfJsOutlineItem.dest === 'string' ? pdfJsOutlineItem.dest : null,
      pdfJsBookmarkCount: pdfJsOutlineItem.count ?? null,
    })
    flattenPdfJsOutline(pdfJsOutlineItem.items, pdfJsBookmarkDepth + 1, pdfJsBookmarks)
  }
}

function collectStructureRoles(pdfJsStructureNode: PapelizPdfExportPdfJsStructureNode | null, structureRoles: string[]): void {
  if (pdfJsStructureNode === null) return
  if (typeof pdfJsStructureNode.role === 'string') structureRoles.push(pdfJsStructureNode.role)
  for (const pdfJsStructureChild of pdfJsStructureNode.children ?? []) collectStructureRoles(pdfJsStructureChild, structureRoles)
}

export async function readPapelizPdfExportFileWithPdfJs(pdfFileBytes: Uint8Array): Promise<PapelizPdfExportPdfJsReading> {
  // pdf.js takes the bytes it is given, so it reads a copy.
  const pdfJsLoadingTask = getDocument({ data: pdfFileBytes.slice(), verbosity: 0, useSystemFonts: false, disableFontFace: true })
  const pdfJsDocument = await pdfJsLoadingTask.promise
  try {
    const pdfJsPageSizes: PapelizPdfExportPdfJsReading['pdfJsPageSizes'] = []
    const pdfJsTextItemsByPage: PapelizPdfExportPdfJsTextItem[][] = []
    const pdfJsStructureRoles: string[] = []
    const pdfJsStructureTreesByPage: Array<PapelizPdfExportPdfJsStructureNode | null> = []
    const pdfJsLinks: PapelizPdfExportPdfJsLink[] = []
    for (let pageNumber = 1; pageNumber <= pdfJsDocument.numPages; pageNumber += 1) {
      const pdfJsPage = await pdfJsDocument.getPage(pageNumber)
      const [, , pageWidthPoints = 0, pageHeightPoints = 0] = pdfJsPage.view
      pdfJsPageSizes.push({ pageWidthPoints, pageHeightPoints })
      const pdfJsTextContent = await pdfJsPage.getTextContent()
      const pdfJsTextItems: PapelizPdfExportPdfJsTextItem[] = []
      for (const pdfJsItem of pdfJsTextContent.items) {
        if (!('str' in pdfJsItem) || pdfJsItem.str.length === 0) continue
        pdfJsTextItems.push({ pdfJsText: pdfJsItem.str, pdfJsBaselineFromBottomPoints: pdfJsItem.transform[5] ?? 0, pdfJsLeftPoints: pdfJsItem.transform[4] ?? 0, pdfJsFontName: pdfJsItem.fontName })
      }
      pdfJsTextItemsByPage.push(pdfJsTextItems)
      const pdfJsStructureTree = (await pdfJsPage.getStructTree()) as PapelizPdfExportPdfJsStructureNode | null
      pdfJsStructureTreesByPage.push(pdfJsStructureTree)
      collectStructureRoles(pdfJsStructureTree, pdfJsStructureRoles)
      for (const pdfJsAnnotation of (await pdfJsPage.getAnnotations()) as Array<{ subtype: string; url?: string; dest?: unknown; contentsObj?: { str?: string } }>) {
        if (pdfJsAnnotation.subtype !== 'Link') continue
        pdfJsLinks.push({
          pdfJsPageIndex: pageNumber - 1,
          pdfJsLinkAddress: pdfJsAnnotation.url ?? null,
          pdfJsLinkDestinationName: typeof pdfJsAnnotation.dest === 'string' ? pdfJsAnnotation.dest : null,
          pdfJsLinkDescription: pdfJsAnnotation.contentsObj?.str ?? null,
        })
      }
    }
    const pdfJsDestinationPageIndexes = new Map<string, number>()
    for (const [pdfJsDestinationName, pdfJsDestination] of await pdfJsDocument.getDestinations()) {
      pdfJsDestinationPageIndexes.set(pdfJsDestinationName, await pdfJsDocument.getPageIndex(pdfJsDestination[0] as { num: number; gen: number }))
    }
    const pdfJsBookmarks: PapelizPdfExportPdfJsBookmark[] = []
    flattenPdfJsOutline(((await pdfJsDocument.getOutline()) ?? []) as PapelizPdfExportPdfJsOutlineItem[], 1, pdfJsBookmarks)
    const pdfJsMetadata = await pdfJsDocument.getMetadata()
    const pdfJsInfo = pdfJsMetadata.info as { Title?: string; Language?: string }
    return {
      pdfJsPageCount: pdfJsDocument.numPages,
      pdfJsPageSizes,
      pdfJsTextItemsByPage,
      pdfJsTitle: pdfJsInfo.Title ?? null,
      pdfJsXmpTitle: (pdfJsMetadata.metadata?.get('dc:title') as string | undefined) ?? null,
      pdfJsLanguageTag: pdfJsInfo.Language ?? null,
      pdfJsStructureRoles,
      pdfJsStructureTreesByPage,
      pdfJsLinks,
      pdfJsDestinationPageIndexes,
      pdfJsBookmarks,
      pdfJsPageMode: (await pdfJsDocument.getPageMode()) ?? null,
    }
  } finally {
    await pdfJsLoadingTask.destroy()
  }
}

// Text without its spaces and line ends: lines wrap and fragments split differently in a PDF, but
// every character must be there once, in order.
export function removePapelizPdfExportTestWhitespace(textWithWhitespace: string): string {
  return textWithWhitespace.replace(/\s+/g, '')
}

function collectNoteBlocksText(pdfExportNoteBlocks: readonly PapelizPdfExportNoteBlock[], noteTextParts: string[]): void {
  for (const pdfExportNoteBlock of pdfExportNoteBlocks) {
    switch (pdfExportNoteBlock.noteBlockKind) {
      case 'heading':
      case 'paragraph': {
        const blockInlineRuns = pdfExportNoteBlock.noteBlockKind === 'heading' ? pdfExportNoteBlock.headingInlineRuns : pdfExportNoteBlock.paragraphInlineRuns
        // An icon is drawn, not written.
        noteTextParts.push(blockInlineRuns.map((blockInlineRun) => (blockInlineRun.inlineRunKind === 'text' ? blockInlineRun.textRunText : blockInlineRun.inlineRunKind === 'line-break' ? '\n' : '')).join(''))
        break
      }
      case 'code-box':
        noteTextParts.push(pdfExportNoteBlock.codeBoxText)
        break
      case 'list':
        pdfExportNoteBlock.listItems.forEach((listItem, listItemIndex) => {
          // Numbers are written; bullets and task boxes are drawn.
          if (pdfExportNoteBlock.listKind === 'numbered') noteTextParts.push(`${pdfExportNoteBlock.listStartNumber + listItemIndex}.`)
          collectNoteBlocksText(listItem.listItemBlocks, noteTextParts)
        })
        break
      case 'quote':
        collectNoteBlocksText(pdfExportNoteBlock.quoteBlocks, noteTextParts)
        break
      case 'properties':
        for (const { notePropertyName, notePropertyValuesText } of pdfExportNoteBlock.noteProperties) noteTextParts.push(notePropertyName, notePropertyValuesText)
        break
      case 'footnotes':
        for (const noteFootnote of pdfExportNoteBlock.noteFootnotes) {
          noteTextParts.push(`${noteFootnote.footnoteNumber}.`)
          collectNoteBlocksText(noteFootnote.footnoteBlocks, noteTextParts)
        }
        break
      case 'rule':
        break
    }
  }
}

// The body text a note document asks for, in order: every block's runs, code, list and footnote
// numbers, and the properties' names and values.
export function collectPapelizPdfExportNoteDocumentText(pdfExportNoteDocument: PapelizPdfExportNoteDocument): string {
  const noteTextParts: string[] = []
  collectNoteBlocksText(pdfExportNoteDocument.noteBlocks, noteTextParts)
  return noteTextParts.join('\n')
}

// The shared test notes and the nine sample notes, as one vault, and the PDF job for each.
const papelizExportTestNoteTextsByModulePath = import.meta.glob('../export-print-style/papeliz-export-test-notes/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// The shared test notes, as notes of one vault: "papeliz-export-test-note-every-block.md" is "Every block.md".
const papelizExportTestNotes = Object.entries(papelizExportTestNoteTextsByModulePath).map(([testNoteModulePath, vaultNoteText]) => {
  const testNoteNameSlug = /papeliz-export-test-note-([\w-]+)\.md$/.exec(testNoteModulePath)?.[1] ?? 'note'
  const testNoteName = testNoteNameSlug.charAt(0).toUpperCase() + testNoteNameSlug.slice(1).replace(/-/g, ' ')
  return { vaultNoteRelativePath: `${testNoteName}.md`, vaultNoteText }
})

export const papelizPdfExportTestVaultNotes = [...papelizSampleVaultNotes, ...papelizExportTestNotes]
const resolveTestWikilinkTarget = createPapelizWikilinkTargetResolver(papelizPdfExportTestVaultNotes.map((testVaultNote) => testVaultNote.vaultNoteRelativePath))
export const papelizPdfExportTestDate = new Date('2026-01-02T03:04:05.000Z')
// The footer's line sits 10 mm up from the page's bottom; body text never comes below 22 mm.
const papelizPdfExportTestFooterTopFromBottomPoints = 50

export function getPapelizPdfExportTestNoteText(vaultNoteRelativePath: string): string {
  const testVaultNote = papelizPdfExportTestVaultNotes.find((testVaultNoteCandidate) => testVaultNoteCandidate.vaultNoteRelativePath === vaultNoteRelativePath)
  if (testVaultNote === undefined) throw new Error(`No test note ${vaultNoteRelativePath}`)
  return testVaultNote.vaultNoteText
}

export async function buildPapelizPdfExportTestNotePdfJob(
  vaultNoteRelativePath: string,
  vaultNoteText: string,
  noteFontFamily: PapelizNoteFontFamily = 'sans',
  pdfExportPageSize: 'a4' | 'letter' = 'a4',
): Promise<PapelizPdfExportNotePdfJob> {
  return buildPapelizPdfExportNotePdfJob({
    vaultNoteRelativePath,
    vaultNoteText,
    resolveWikilinkTarget: resolveTestWikilinkTarget,
    pdfExportPageSize,
    pdfExportNoteFontFamily: noteFontFamily,
    readPdfExportFontFile: readPapelizPdfExportTestFontFile,
    pdfExportFontFilesByFaceKey: new Map(),
    pdfExportCreationDate: papelizPdfExportTestDate,
  })
}

export function readPapelizPdfExportBodyText(pdfJsReading: PapelizPdfExportPdfJsReading): string {
  return pdfJsReading.pdfJsTextItemsByPage
    .flat()
    .filter((pdfJsTextItem) => pdfJsTextItem.pdfJsBaselineFromBottomPoints > papelizPdfExportTestFooterTopFromBottomPoints)
    .map((pdfJsTextItem) => pdfJsTextItem.pdfJsText)
    .join('')
}

export function readPapelizPdfExportFileLatin1Text(pdfFileBytes: Uint8Array): string {
  let pdfLatin1Text = ''
  for (let byteOffset = 0; byteOffset < pdfFileBytes.length; byteOffset += 0x8000) pdfLatin1Text += String.fromCharCode(...pdfFileBytes.subarray(byteOffset, byteOffset + 0x8000))
  return pdfLatin1Text
}
