import type { PapelizNoteFontFamily } from '../workspace/papeliz-note-typography-store'
import {
  listPapelizPdfExportNoteBlockInlineRuns,
  visitPapelizPdfExportNoteBlocks,
  type PapelizPdfExportNoteBlock,
  type PapelizPdfExportNoteDocument,
  type PapelizPdfExportTextRunLook,
} from './papeliz-pdf-export-note-document'

// Which font file draws which text. The PDF embeds the app's own typefaces and Noto Sans (all SIL OFL
// 1.1, which allows embedding), each split by @fontsource into files per script (`latin`,
// `latin-ext`, `cyrillic` and so on) with the same Unicode ranges the app's CSS gives them. A
// character takes the first file whose range holds it: the run's own family first, then Noto Sans for
// Cyrillic, Greek and Vietnamese. One in no range has no bundled font. Used on the main thread (which
// files to read) and in the worker (which file draws each piece), so both agree.

export type PapelizPdfExportFontFamilyName = 'figtree' | 'charis-sil' | 'jetbrains-mono'
// The families with files in the PDF: the note fonts, and Noto Sans for the scripts they lack.
export type PapelizPdfExportFontFileFamilyName = PapelizPdfExportFontFamilyName | 'noto-sans'
export type PapelizPdfExportFontWeight = 400 | 500 | 600 | 700
export type PapelizPdfExportFontSubsetName = 'latin' | 'latin-ext' | 'cyrillic' | 'cyrillic-ext' | 'greek' | 'greek-ext' | 'vietnamese'

export interface PapelizPdfExportFontStyle {
  fontFamilyName: PapelizPdfExportFontFamilyName
  fontWeight: PapelizPdfExportFontWeight
  isFontItalic: boolean
}

export interface PapelizPdfExportFontFace {
  fontFamilyName: PapelizPdfExportFontFileFamilyName
  fontWeight: PapelizPdfExportFontWeight
  isFontItalic: boolean
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

// MD View's weights: text 400, the first heading 500, other headings and callout titles 600
// (papeliz-webapp.css).
export function getPapelizPdfExportBlockFontWeight(pdfExportNoteBlock: PapelizPdfExportNoteBlock): PapelizPdfExportFontWeight {
  if (pdfExportNoteBlock.noteBlockKind === 'callout') return 600
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

// The ranges in @fontsource's stylesheets, the same for every family's file of a script.
const papelizPdfExportUnicodeRangesBySubset: Readonly<Record<PapelizPdfExportFontSubsetName, readonly PapelizUnicodeCodePointRange[]>> = {
  latin: parsePapelizUnicodeRange(
    'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  ),
  'latin-ext': parsePapelizUnicodeRange(
    'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
  ),
  cyrillic: parsePapelizUnicodeRange('U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116'),
  'cyrillic-ext': parsePapelizUnicodeRange('U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F'),
  greek: parsePapelizUnicodeRange('U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF'),
  'greek-ext': parsePapelizUnicodeRange('U+1F00-1FFF'),
  vietnamese: parsePapelizUnicodeRange(
    'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB',
  ),
}

interface PapelizPdfExportFontFile {
  fontFamilyName: PapelizPdfExportFontFileFamilyName
  fontSubsetName: PapelizPdfExportFontSubsetName
}

// Each family's own files, then Noto Sans's for the scripts the family lacks, in the order a
// character tries them. Figtree has only Latin; Charis SIL adds Cyrillic and Vietnamese; JetBrains
// Mono adds Cyrillic, Greek and Vietnamese.
const papelizPdfExportOwnFontSubsetNamesByFamily: Readonly<Record<PapelizPdfExportFontFamilyName, readonly PapelizPdfExportFontSubsetName[]>> = {
  figtree: ['latin', 'latin-ext'],
  'charis-sil': ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext', 'vietnamese'],
  'jetbrains-mono': ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext', 'greek', 'vietnamese'],
}
const papelizPdfExportNotoSansFontSubsetNames: readonly PapelizPdfExportFontSubsetName[] = ['cyrillic', 'cyrillic-ext', 'greek', 'greek-ext', 'vietnamese']

const papelizPdfExportFontFilesInOrderByFamily = new Map<PapelizPdfExportFontFamilyName, PapelizPdfExportFontFile[]>(
  (Object.keys(papelizPdfExportOwnFontSubsetNamesByFamily) as PapelizPdfExportFontFamilyName[]).map((fontFamilyName) => [
    fontFamilyName,
    [
      ...papelizPdfExportOwnFontSubsetNamesByFamily[fontFamilyName].map((fontSubsetName): PapelizPdfExportFontFile => ({ fontFamilyName, fontSubsetName })),
      ...papelizPdfExportNotoSansFontSubsetNames.map((fontSubsetName): PapelizPdfExportFontFile => ({ fontFamilyName: 'noto-sans', fontSubsetName })),
    ],
  ]),
)

function isCodePointInPapelizPdfExportFontSubset(codePoint: number, fontSubsetName: PapelizPdfExportFontSubsetName): boolean {
  return papelizPdfExportUnicodeRangesBySubset[fontSubsetName].some(([firstCodePoint, lastCodePoint]) => codePoint >= firstCodePoint && codePoint <= lastCodePoint)
}

function findGraphemeFontFile(graphemeText: string, fontFamilyName: PapelizPdfExportFontFamilyName): PapelizPdfExportFontFile | null {
  const graphemeCodePoints = Array.from(graphemeText, (graphemeCharacter) => graphemeCharacter.codePointAt(0) ?? 0)
  const fontFilesInOrder = papelizPdfExportFontFilesInOrderByFamily.get(fontFamilyName) ?? []
  return fontFilesInOrder.find((fontFile) => graphemeCodePoints.every((codePoint) => isCodePointInPapelizPdfExportFontSubset(codePoint, fontFile.fontSubsetName))) ?? null
}

export interface PapelizPdfExportBundledFontSegment {
  segmentText: string
  // The file that draws it, in the run's weight and style; null: no bundled font has these characters.
  fontFaceKey: string | null
}

const papelizPdfExportGraphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// "Łódź" -> "Ł" (latin-ext), "ód" (latin), "ź" (latin-ext): each character cluster with the file that
// has it, neighbours in the same file joined. A letter written with a separate accent ("e" + U+0301)
// is joined into one character when that one is in a file.
export function splitPapelizPdfExportTextByBundledFontFile(textToSplit: string, pdfExportFontStyle: PapelizPdfExportFontStyle): PapelizPdfExportBundledFontSegment[] {
  const bundledFontSegments: PapelizPdfExportBundledFontSegment[] = []
  for (const { segment: graphemeText } of papelizPdfExportGraphemeSegmenter.segment(textToSplit)) {
    let printedGraphemeText = graphemeText
    let graphemeFontFile = findGraphemeFontFile(graphemeText, pdfExportFontStyle.fontFamilyName)
    if (graphemeFontFile === null) {
      const composedGraphemeText = graphemeText.normalize('NFC')
      const composedFontFile = findGraphemeFontFile(composedGraphemeText, pdfExportFontStyle.fontFamilyName)
      if (composedFontFile !== null) {
        printedGraphemeText = composedGraphemeText
        graphemeFontFile = composedFontFile
      }
    }
    const fontFaceKey = graphemeFontFile === null ? null : getPapelizPdfExportFontFaceKey({ ...pdfExportFontStyle, ...graphemeFontFile })
    const lastBundledFontSegment = bundledFontSegments.at(-1)
    if (lastBundledFontSegment !== undefined && lastBundledFontSegment.fontFaceKey === fontFaceKey) lastBundledFontSegment.segmentText += printedGraphemeText
    else bundledFontSegments.push({ segmentText: printedGraphemeText, fontFaceKey })
  }
  return bundledFontSegments
}

// The family's `latin` file, which sets a run's line height, its underline and its strike, and draws
// a character no font has (as a box) when it has no picture either.
export function getPapelizPdfExportLatinFontFaceKey(pdfExportFontStyle: PapelizPdfExportFontStyle): string {
  return getPapelizPdfExportFontFaceKey({ ...pdfExportFontStyle, fontSubsetName: 'latin' })
}

// The files one piece of text needs in one style: always the family's `latin` file, and each other
// file a character of it takes.
export function listPapelizPdfExportFontFaceKeysForText(textToPrint: string, pdfExportFontStyle: PapelizPdfExportFontStyle): string[] {
  const fontFaceKeys = new Set<string>([getPapelizPdfExportLatinFontFaceKey(pdfExportFontStyle)])
  for (const { fontFaceKey } of splitPapelizPdfExportTextByBundledFontFile(textToPrint, pdfExportFontStyle)) {
    if (fontFaceKey !== null) fontFaceKeys.add(fontFaceKey)
  }
  return [...fontFaceKeys]
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
    if (pdfExportNoteBlock.noteBlockKind === 'diagram') {
      // A diagram drawn as vectors has its labels in the note's typeface.
      for (const vectorTextRun of pdfExportNoteBlock.diagramVectorDrawing?.vectorTextRuns ?? []) {
        const labelFontFamilyName = vectorTextRun.vectorTextRunFontFamilyName
        addFontFaceKeys(vectorTextRun.vectorTextRunText, {
          fontFamilyName: labelFontFamilyName,
          fontWeight: choosePapelizPdfExportFontWeight(labelFontFamilyName, vectorTextRun.vectorTextRunFontWeight),
          isFontItalic: vectorTextRun.isVectorTextRunItalic,
        })
      }
      return
    }
    if (pdfExportNoteBlock.noteBlockKind === 'table') {
      for (const { isTableHeaderRow, tableCells } of pdfExportNoteBlock.tableRows) {
        const cellFontWeight: PapelizPdfExportFontWeight = isTableHeaderRow ? 600 : 400
        fontFaceKeys.add(getPapelizPdfExportFontFaceKey({ ...noteTextFontStyle, fontWeight: choosePapelizPdfExportFontWeight(noteFontFamilyName, cellFontWeight), fontSubsetName: 'latin' }))
        for (const { tableCellInlineRuns } of tableCells) {
          for (const cellInlineRun of tableCellInlineRuns) {
            if (cellInlineRun.inlineRunKind === 'line-break') continue
            addFontFaceKeys(cellInlineRun.inlineRunKind === 'text' ? cellInlineRun.textRunText : '', resolvePapelizPdfExportTextRunFontStyle(noteFontFamilyName, cellFontWeight, cellInlineRun.textRunLook))
          }
        }
      }
      return
    }
    if (pdfExportNoteBlock.noteBlockKind !== 'heading' && pdfExportNoteBlock.noteBlockKind !== 'paragraph' && pdfExportNoteBlock.noteBlockKind !== 'callout') return
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
