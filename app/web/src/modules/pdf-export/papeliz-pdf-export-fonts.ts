import type { PapelizNoteFontFamily } from '../workspace/papeliz-note-typography-store'
import {
  listPapelizPdfExportNoteBlockInlineRuns,
  visitPapelizPdfExportNoteBlocks,
  type PapelizPdfExportNoteBlock,
  type PapelizPdfExportNoteDocument,
  type PapelizPdfExportTextRunLook,
} from './papeliz-pdf-export-note-document'

// Which font file draws which text. The PDF embeds the app's own typefaces (SIL OFL 1.1, which
// allows embedding), each split by @fontsource into a `latin` and a `latin-ext` file with the same
// Unicode ranges the app's CSS gives them. A character takes the file whose range holds it; one in
// neither range has no bundled font. Used on the main thread (which files to read) and in the worker
// (which file draws each piece), so both agree.

export type PapelizPdfExportFontFamilyName = 'figtree' | 'charis-sil' | 'jetbrains-mono'
export type PapelizPdfExportFontWeight = 400 | 500 | 600 | 700
export type PapelizPdfExportFontSubsetName = 'latin' | 'latin-ext'

export interface PapelizPdfExportFontStyle {
  fontFamilyName: PapelizPdfExportFontFamilyName
  fontWeight: PapelizPdfExportFontWeight
  isFontItalic: boolean
}

export interface PapelizPdfExportFontFace extends PapelizPdfExportFontStyle {
  fontSubsetName: PapelizPdfExportFontSubsetName
}

// "figtree-latin-600-italic": the @fontsource file's own name, without ".woff".
export function getPapelizPdfExportFontFaceKey(pdfExportFontFace: PapelizPdfExportFontFace): string {
  return `${pdfExportFontFace.fontFamilyName}-${pdfExportFontFace.fontSubsetName}-${pdfExportFontFace.fontWeight}-${pdfExportFontFace.isFontItalic ? 'italic' : 'normal'}`
}

// The weights each family ships with the app; both have upright and italic files for each.
const papelizPdfExportFontFamilyWeights: Readonly<Record<PapelizPdfExportFontFamilyName, readonly PapelizPdfExportFontWeight[]>> = {
  figtree: [400, 500, 600],
  'charis-sil': [400, 700],
  'jetbrains-mono': [400, 700],
}

// CSS's weight matching: up to 500, the nearest lighter weight first; above 500, the nearest heavier
// first. In Charis SIL and JetBrains Mono, links and the first heading (500) print at 400, bold and
// other headings (600) at 700.
export function choosePapelizPdfExportFontWeight(fontFamilyName: PapelizPdfExportFontFamilyName, wantedFontWeight: PapelizPdfExportFontWeight): PapelizPdfExportFontWeight {
  const availableFontWeights = papelizPdfExportFontFamilyWeights[fontFamilyName]
  if (availableFontWeights.includes(wantedFontWeight)) return wantedFontWeight
  const lighterFontWeights = availableFontWeights.filter((availableFontWeight) => availableFontWeight < wantedFontWeight).reverse()
  const heavierFontWeights = availableFontWeights.filter((availableFontWeight) => availableFontWeight > wantedFontWeight)
  const fontWeightsInOrder = wantedFontWeight <= 500 ? [...lighterFontWeights, ...heavierFontWeights] : [...heavierFontWeights, ...lighterFontWeights]
  return fontWeightsInOrder[0] ?? 400
}

// The note font setting: Sans in Figtree, Serif in Charis SIL, Mono in JetBrains Mono.
export function getPapelizPdfExportNoteFontFamilyName(noteFontFamily: PapelizNoteFontFamily): PapelizPdfExportFontFamilyName {
  if (noteFontFamily === 'mono') return 'jetbrains-mono'
  return noteFontFamily === 'serif' ? 'charis-sil' : 'figtree'
}

// MD View's weights: text 400, the first heading 500, other headings 600 (papeliz-webapp.css).
export function getPapelizPdfExportBlockFontWeight(pdfExportNoteBlock: PapelizPdfExportNoteBlock): PapelizPdfExportFontWeight {
  if (pdfExportNoteBlock.noteBlockKind !== 'heading') return 400
  return pdfExportNoteBlock.headingLevel === 1 ? 500 : 600
}

// The face a run of text asks for: monospace runs (inline code) in JetBrains Mono, the rest in the
// note's family; the run's own weight (bold, a link) or the block's.
export function resolvePapelizPdfExportTextRunFontStyle(
  noteFontFamilyName: PapelizPdfExportFontFamilyName,
  blockFontWeight: PapelizPdfExportFontWeight,
  textRunLook: PapelizPdfExportTextRunLook,
): PapelizPdfExportFontStyle {
  const fontFamilyName: PapelizPdfExportFontFamilyName = textRunLook.isTextRunMonospace ? 'jetbrains-mono' : noteFontFamilyName
  return {
    fontFamilyName,
    fontWeight: choosePapelizPdfExportFontWeight(fontFamilyName, textRunLook.textRunFontWeight ?? blockFontWeight),
    isFontItalic: textRunLook.isTextRunItalic,
  }
}

// A property chip's name is 500, as MD View's `<b>` in a chip.
export const papelizPdfExportPropertyNameFontWeight: PapelizPdfExportFontWeight = 500

// Code boxes: JetBrains Mono 400, upright.
export const papelizPdfExportCodeBoxFontStyle: PapelizPdfExportFontStyle = { fontFamilyName: 'jetbrains-mono', fontWeight: 400, isFontItalic: false }

type PapelizUnicodeCodePointRange = readonly [firstCodePoint: number, lastCodePoint: number]

function parsePapelizUnicodeRange(unicodeRangeText: string): PapelizUnicodeCodePointRange[] {
  return unicodeRangeText.split(',').map((unicodeRangePart) => {
    const [firstCodePointHex = '0', lastCodePointHex] = unicodeRangePart.trim().replace(/^U\+/i, '').split('-')
    const firstCodePoint = Number.parseInt(firstCodePointHex, 16)
    return [firstCodePoint, lastCodePointHex === undefined ? firstCodePoint : Number.parseInt(lastCodePointHex, 16)] as const
  })
}

// The ranges in @fontsource's stylesheets for every family's files.
const papelizPdfExportUnicodeRangesBySubset: Readonly<Record<PapelizPdfExportFontSubsetName, readonly PapelizUnicodeCodePointRange[]>> = {
  latin: parsePapelizUnicodeRange(
    'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  ),
  'latin-ext': parsePapelizUnicodeRange(
    'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
  ),
}

const papelizPdfExportFontSubsetNamesInOrder: readonly PapelizPdfExportFontSubsetName[] = ['latin', 'latin-ext']

function isCodePointInPapelizPdfExportFontSubset(codePoint: number, fontSubsetName: PapelizPdfExportFontSubsetName): boolean {
  return papelizPdfExportUnicodeRangesBySubset[fontSubsetName].some(([firstCodePoint, lastCodePoint]) => codePoint >= firstCodePoint && codePoint <= lastCodePoint)
}

function findGraphemeFontSubsetName(graphemeText: string): PapelizPdfExportFontSubsetName | null {
  const graphemeCodePoints = Array.from(graphemeText, (graphemeCharacter) => graphemeCharacter.codePointAt(0) ?? 0)
  return papelizPdfExportFontSubsetNamesInOrder.find((fontSubsetName) => graphemeCodePoints.every((codePoint) => isCodePointInPapelizPdfExportFontSubset(codePoint, fontSubsetName))) ?? null
}

export interface PapelizPdfExportTextSubsetSegment {
  segmentText: string
  // null: no bundled font has these characters.
  fontSubsetName: PapelizPdfExportFontSubsetName | null
}

const papelizPdfExportGraphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// "Łódź" -> "Ł" (latin-ext), "ód" (latin), "ź" (latin-ext): each character cluster with the file that has it,
// neighbours in the same file joined. A letter written with a separate accent ("e" + U+0301) is
// joined into one character when that one is in a file.
export function splitPapelizPdfExportTextBySubset(textToSplit: string): PapelizPdfExportTextSubsetSegment[] {
  const textSubsetSegments: PapelizPdfExportTextSubsetSegment[] = []
  for (const { segment: graphemeText } of papelizPdfExportGraphemeSegmenter.segment(textToSplit)) {
    let printedGraphemeText = graphemeText
    let graphemeFontSubsetName = findGraphemeFontSubsetName(graphemeText)
    if (graphemeFontSubsetName === null) {
      const composedGraphemeText = graphemeText.normalize('NFC')
      const composedFontSubsetName = findGraphemeFontSubsetName(composedGraphemeText)
      if (composedFontSubsetName !== null) {
        printedGraphemeText = composedGraphemeText
        graphemeFontSubsetName = composedFontSubsetName
      }
    }
    const lastTextSubsetSegment = textSubsetSegments.at(-1)
    if (lastTextSubsetSegment !== undefined && lastTextSubsetSegment.fontSubsetName === graphemeFontSubsetName) lastTextSubsetSegment.segmentText += printedGraphemeText
    else textSubsetSegments.push({ segmentText: printedGraphemeText, fontSubsetName: graphemeFontSubsetName })
  }
  return textSubsetSegments
}

// The files one piece of text needs in one style. The `latin` file always: a line's height and its
// underline come from it, and characters no file has are drawn with it (as a box) until they get a
// picture of their own.
export function listPapelizPdfExportFontFaceKeysForText(textToPrint: string, pdfExportFontStyle: PapelizPdfExportFontStyle): string[] {
  const fontSubsetNames = new Set<PapelizPdfExportFontSubsetName>(['latin'])
  for (const { fontSubsetName } of splitPapelizPdfExportTextBySubset(textToPrint)) fontSubsetNames.add(fontSubsetName ?? 'latin')
  return [...fontSubsetNames].map((fontSubsetName) => getPapelizPdfExportFontFaceKey({ ...pdfExportFontStyle, fontSubsetName }))
}

// Every file a note's PDF needs: its text, its code, list and footnote numbers, the properties' chips,
// and the footer (the note's name and the page numbers, in the note's family).
export function listPapelizPdfExportNoteFontFaceKeys(pdfExportNoteDocument: PapelizPdfExportNoteDocument, pdfExportFooterNoteName: string): string[] {
  const noteFontFamilyName = getPapelizPdfExportNoteFontFamilyName(pdfExportNoteDocument.noteFontFamily)
  const noteTextFontStyle: PapelizPdfExportFontStyle = { fontFamilyName: noteFontFamilyName, fontWeight: 400, isFontItalic: false }
  const fontFaceKeys = new Set<string>(listPapelizPdfExportFontFaceKeysForText(`${pdfExportFooterNoteName} 0123456789./`, noteTextFontStyle))
  const addFontFaceKeys = (textToPrint: string, pdfExportFontStyle: PapelizPdfExportFontStyle) => {
    for (const fontFaceKey of listPapelizPdfExportFontFaceKeysForText(textToPrint, pdfExportFontStyle)) fontFaceKeys.add(fontFaceKey)
  }
  visitPapelizPdfExportNoteBlocks(pdfExportNoteDocument.noteBlocks, (pdfExportNoteBlock) => {
    if (pdfExportNoteBlock.noteBlockKind === 'code-box') {
      addFontFaceKeys(pdfExportNoteBlock.codeBoxText, papelizPdfExportCodeBoxFontStyle)
      return
    }
    if (pdfExportNoteBlock.noteBlockKind === 'properties') {
      for (const { notePropertyName, notePropertyValuesText } of pdfExportNoteBlock.noteProperties) {
        addFontFaceKeys(notePropertyName, { ...noteTextFontStyle, fontWeight: choosePapelizPdfExportFontWeight(noteFontFamilyName, papelizPdfExportPropertyNameFontWeight) })
        addFontFaceKeys(notePropertyValuesText, noteTextFontStyle)
      }
      return
    }
    if (pdfExportNoteBlock.noteBlockKind !== 'heading' && pdfExportNoteBlock.noteBlockKind !== 'paragraph') return
    const blockFontWeight = getPapelizPdfExportBlockFontWeight(pdfExportNoteBlock)
    // The block's own face sets its lines' least height.
    fontFaceKeys.add(getPapelizPdfExportFontFaceKey({ fontFamilyName: noteFontFamilyName, fontWeight: choosePapelizPdfExportFontWeight(noteFontFamilyName, blockFontWeight), isFontItalic: false, fontSubsetName: 'latin' }))
    for (const blockInlineRun of listPapelizPdfExportNoteBlockInlineRuns(pdfExportNoteBlock)) {
      if (blockInlineRun.inlineRunKind === 'line-break') continue
      // An icon draws no text, yet its line still measures its face.
      addFontFaceKeys(
        blockInlineRun.inlineRunKind === 'text' ? blockInlineRun.textRunText : '',
        resolvePapelizPdfExportTextRunFontStyle(noteFontFamilyName, blockFontWeight, blockInlineRun.textRunLook),
      )
    }
  })
  return [...fontFaceKeys].sort()
}
