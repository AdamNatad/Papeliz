import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createPapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import type { PapelizNoteFontFamily } from '../workspace/papeliz-note-typography-store'
import { buildPapelizPdfExportNotePdfJob } from './papeliz-pdf-export'
import type { PapelizPdfExportCharacterPictureDrawer } from './papeliz-pdf-export-assets'
import type { PapelizPdfExportComputerFontSource, PapelizPdfExportLocalFontData } from './papeliz-pdf-export-computer-fonts'
import { buildPapelizPdfExportGlyphlessFont } from './papeliz-pdf-export-glyphless-font'
import { planPapelizPdfExportNotePages, writePapelizPdfExportNotePdf, type PapelizPdfExportNotePdfJob } from './papeliz-pdf-export-note-pdf'
import type { PapelizPdfExportPageLayoutPlan, PapelizPdfExportPictureOperation, PapelizPdfExportTextRunOperation } from './papeliz-pdf-export-page-layout-plan'
import {
  createPapelizPdfExportTestPngBytes,
  papelizPdfExportTestDate,
  readPapelizPdfExportBodyText,
  readPapelizPdfExportFileLatin1Text,
  readPapelizPdfExportFileWithPdfJs,
  readPapelizPdfExportTestFontFile,
  removePapelizPdfExportTestWhitespace,
} from './papeliz-pdf-export.test-support'

// Phase 5 of the PDF export: text in every script. Noto Sans for Cyrillic, Greek and Vietnamese; the
// computer's fonts (given here by a stand-in for the browser's Local Font Access) for the rest, with
// their embedding rules kept; right-to-left lines in display order.

// Every character picture a 12 × 12 PNG; the requests are kept to look at.
function createTestCharacterPictureDrawer(drawnPictureTexts: string[]): PapelizPdfExportCharacterPictureDrawer {
  return async (characterPictureRequests) =>
    characterPictureRequests.map((characterPictureRequest) => {
      drawnPictureTexts.push(characterPictureRequest.pictureCharactersText)
      return {
        characterPictureKey: characterPictureRequest.characterPictureKey,
        pictureCharactersText: characterPictureRequest.pictureCharactersText,
        pictureFile: { pictureBytes: createPapelizPdfExportTestPngBytes(12, 12), pictureFormat: 'png', picturePixelWidth: 12, picturePixelHeight: 12 },
        advanceEm: 0.6 * Array.from(characterPictureRequest.pictureCharactersText).length,
        topAboveBaselineEm: 0.95,
        heightEm: 1.2,
      }
    })
}

function createTestComputerFontSource(localFonts: readonly PapelizPdfExportLocalFontData[] | null): PapelizPdfExportComputerFontSource & { askedNoteNames: string[] } {
  const askedNoteNames: string[] = []
  return {
    askedNoteNames,
    listComputerFonts: async (pdfExportNoteName) => {
      askedNoteNames.push(pdfExportNoteName)
      return localFonts
    },
  }
}

function createTestLocalFont(family: string, style: string, postscriptName: string, fontFileBytes: Uint8Array): PapelizPdfExportLocalFontData {
  return { family, style, postscriptName, blob: async () => new Blob([fontFileBytes as BlobPart]) }
}

// Noto Sans's Devanagari file stands in for a computer's font.
const devanagariTestFontBytes = new Uint8Array(readFileSync(new URL('../../../node_modules/@fontsource/noto-sans/files/noto-sans-devanagari-400-normal.woff', import.meta.url)))

// A font with an empty glyph for each of these characters, as wide as 0.6 em, with its embedding bits
// set to `fsType`.
function createTestOutlineFreeFont(fontCharacters: string, embeddingBits: number): Uint8Array {
  const fontBytes = buildPapelizPdfExportGlyphlessFont(Array.from(new Set(fontCharacters), (fontCharacter) => ({ pictureCharactersText: fontCharacter, advanceEm: 0.6 })))
  const fontView = new DataView(fontBytes.buffer, fontBytes.byteOffset, fontBytes.byteLength)
  for (let tableIndex = 0; tableIndex < fontView.getUint16(4); tableIndex += 1) {
    const tableRecordOffset = 12 + 16 * tableIndex
    if (String.fromCharCode(...fontBytes.subarray(tableRecordOffset, tableRecordOffset + 4)) === 'OS/2') fontView.setUint16(fontView.getUint32(tableRecordOffset + 8) + 8, embeddingBits)
  }
  return fontBytes
}

// The same font inside a one-face font collection (`.ttc`).
function wrapTestFontInCollection(fontBytes: Uint8Array): Uint8Array {
  const collectionBytes = new Uint8Array(16 + fontBytes.byteLength)
  const collectionView = new DataView(collectionBytes.buffer)
  collectionBytes.set([0x74, 0x74, 0x63, 0x66], 0)
  collectionView.setUint16(4, 1)
  collectionView.setUint32(8, 1)
  collectionView.setUint32(12, 16)
  collectionBytes.set(fontBytes, 16)
  // Its tables' offsets count from the collection's start.
  for (let tableIndex = 0; tableIndex < collectionView.getUint16(16 + 4); tableIndex += 1) {
    const tableOffsetPosition = 16 + 12 + 16 * tableIndex + 8
    collectionView.setUint32(tableOffsetPosition, collectionView.getUint32(tableOffsetPosition) + 16)
  }
  return collectionBytes
}

async function buildScriptsTestJob(
  vaultNoteRelativePath: string,
  vaultNoteText: string,
  testOptions: { pdfExportComputerFontSource?: PapelizPdfExportComputerFontSource; drawnPictureTexts?: string[]; noteFontFamily?: PapelizNoteFontFamily },
): Promise<PapelizPdfExportNotePdfJob> {
  return buildPapelizPdfExportNotePdfJob({
    vaultNoteRelativePath,
    vaultNoteText,
    resolveWikilinkTarget: createPapelizWikilinkTargetResolver([vaultNoteRelativePath]),
    pdfExportPageSize: 'a4',
    pdfExportNoteFontFamily: testOptions.noteFontFamily ?? 'sans',
    readPdfExportFontFile: readPapelizPdfExportTestFontFile,
    pdfExportFontFilesByFaceKey: new Map(),
    pdfExportCreationDate: papelizPdfExportTestDate,
    drawPdfExportCharacterPictures: createTestCharacterPictureDrawer(testOptions.drawnPictureTexts ?? []),
    ...(testOptions.pdfExportComputerFontSource === undefined ? {} : { pdfExportComputerFontSource: testOptions.pdfExportComputerFontSource }),
  })
}

function listPlanTextRuns(pageLayoutPlan: PapelizPdfExportPageLayoutPlan): PapelizPdfExportTextRunOperation[] {
  return pageLayoutPlan.pdfExportPages.flatMap((pagePlan) => pagePlan.pageOperations).filter((pageOperation): pageOperation is PapelizPdfExportTextRunOperation => pageOperation.pageOperationKind === 'text-run')
}

function listPlanCharacterPictures(pageLayoutPlan: PapelizPdfExportPageLayoutPlan): PapelizPdfExportPictureOperation[] {
  return pageLayoutPlan.pdfExportPages
    .flatMap((pagePlan) => pagePlan.pageOperations)
    .filter((pageOperation): pageOperation is PapelizPdfExportPictureOperation => pageOperation.pageOperationKind === 'picture' && pageOperation.pictureSource.pictureSourceKind === 'character-picture')
}

describe('PDF export text in every script', () => {
  it('prints Cyrillic, Greek and Vietnamese as real text: in Noto Sans in a Sans note, in Charis SIL where it has them in a Serif note', async () => {
    const scriptsNoteText = '# Скрипты\n\nCyrillic: Съешь же ещё этих мягких французских булок.\n\nGreek: **Ξεσκεπάζω** *την ψυχοφθόρα βδελυγμία*.\n\nVietnamese: Tiếng Việt có dấu.'
    for (const noteFontFamily of ['sans', 'serif'] as const) {
      const drawnPictureTexts: string[] = []
      const notePdfJob = await buildScriptsTestJob('Scripts.md', scriptsNoteText, { drawnPictureTexts, noteFontFamily })
      // No character needs a picture or a computer font.
      expect(drawnPictureTexts, noteFontFamily).toEqual([])
      const { pdfFileBytes, pdfExportNoteNotices } = await writePapelizPdfExportNotePdf(notePdfJob)
      expect(pdfExportNoteNotices, noteFontFamily).toEqual([])
      const fontFaceKeys = notePdfJob.pdfExportFontFiles.map(({ fontFaceKey }) => fontFaceKey)
      // Bold is 600 in Figtree, 700 in Charis SIL; Noto Sans has both.
      expect(fontFaceKeys, noteFontFamily).toContain(noteFontFamily === 'sans' ? 'noto-sans-greek-600-normal' : 'noto-sans-greek-700-normal')
      expect(fontFaceKeys, noteFontFamily).toContain(noteFontFamily === 'sans' ? 'noto-sans-cyrillic-400-normal' : 'charis-sil-cyrillic-400-normal')
      expect(fontFaceKeys, noteFontFamily).toContain(noteFontFamily === 'sans' ? 'noto-sans-vietnamese-400-normal' : 'charis-sil-vietnamese-400-normal')
      const pdfText = removePapelizPdfExportTestWhitespace(readPapelizPdfExportBodyText(await readPapelizPdfExportFileWithPdfJs(pdfFileBytes)))
      expect(pdfText, noteFontFamily).toBe(removePapelizPdfExportTestWhitespace(scriptsNoteText.replace(/[#*]/g, '')))
      expect(readPapelizPdfExportFileLatin1Text(pdfFileBytes), noteFontFamily).toMatch(/\/BaseFont \/[A-Z]{6}\+NotoSans/)
    }
  })

  it('draws a script no bundled font has in a computer font, slanted or thickened where the font lacks the face', async () => {
    const devanagariNoteText = '# भारत\n\nनमस्ते भारत, **भारत** और *भारत*.'
    const computerFontSource = createTestComputerFontSource([createTestLocalFont('Nirmala UI', 'Regular', 'NirmalaUI', devanagariTestFontBytes)])
    const notePdfJob = await buildScriptsTestJob('Devanagari.md', devanagariNoteText, { pdfExportComputerFontSource: computerFontSource })
    expect(computerFontSource.askedNoteNames).toEqual(['Devanagari'])
    expect(notePdfJob.pdfExportComputerFonts.map(({ computerFontFaceKey, computerFontFamilyName }) => `${computerFontFaceKey} ${computerFontFamilyName}`)).toEqual([
      'computer-font-0-400-normal Nirmala UI',
    ])
    const computerTextRuns = listPlanTextRuns(planPapelizPdfExportNotePages(notePdfJob).pageLayoutPlan).filter((textRun) => textRun.fontFaceKey === 'computer-font-0-400-normal')
    expect(computerTextRuns.map((textRun) => `${textRun.textRunText} ${JSON.stringify(textRun.textSynthesis)}`)).toEqual([
      'भारत null',
      'नमस्ते null',
      'भारत null',
      // Thickened by a 24th of 11 pt, a little less above 9 pt.
      'भारत {"textSlantDegrees":0,"textStrokeWidthPoints":0.45}',
      'और null',
      'भारत {"textSlantDegrees":12,"textStrokeWidthPoints":0}',
    ])
    const { pdfFileBytes, pdfExportNoteNotices } = await writePapelizPdfExportNotePdf(notePdfJob)
    expect(pdfExportNoteNotices).toEqual([])
    expect(readPapelizPdfExportFileLatin1Text(pdfFileBytes)).not.toMatch(/PapelizCharacterPictures/)
    const pdfText = removePapelizPdfExportTestWhitespace(readPapelizPdfExportBodyText(await readPapelizPdfExportFileWithPdfJs(pdfFileBytes)))
    expect(pdfText).toBe(removePapelizPdfExportTestWhitespace(devanagariNoteText.replace(/[#*]/g, '')))
  })

  it('never embeds a computer font whose maker forbids it, and reads a face out of a font collection', async () => {
    const kanaNoteText = 'Kana: あいう.'
    // fsType 2, "restricted license": its characters print as pictures.
    const restrictedPictureTexts: string[] = []
    const restrictedFontSource = createTestComputerFontSource([createTestLocalFont('Yu Gothic', 'Regular', 'PapelizCharacterPictures', createTestOutlineFreeFont('あいう', 0x0002))])
    const restrictedJob = await buildScriptsTestJob('Kana.md', kanaNoteText, { pdfExportComputerFontSource: restrictedFontSource, drawnPictureTexts: restrictedPictureTexts })
    expect(restrictedPictureTexts).toEqual(['あ', 'い', 'う'])
    const restrictedPlan = planPapelizPdfExportNotePages(restrictedJob).pageLayoutPlan
    expect(listPlanTextRuns(restrictedPlan).some((textRun) => textRun.fontFaceKey.startsWith('computer-font'))).toBe(false)
    expect(listPlanCharacterPictures(restrictedPlan)).toHaveLength(3)
    // fsType 4, "preview and print", inside a `.ttc`: drawn as text, no pictures.
    const collectionFontSource = createTestComputerFontSource([createTestLocalFont('Yu Gothic', 'Regular', 'PapelizCharacterPictures', wrapTestFontInCollection(createTestOutlineFreeFont('あいう', 0x0004)))])
    const collectionJob = await buildScriptsTestJob('Kana.md', kanaNoteText, { pdfExportComputerFontSource: collectionFontSource })
    const collectionPlan = planPapelizPdfExportNotePages(collectionJob).pageLayoutPlan
    expect(listPlanTextRuns(collectionPlan).filter((textRun) => textRun.fontFaceKey === 'computer-font-0-400-normal').map((textRun) => textRun.textRunText)).toEqual(['あいう'])
    expect(listPlanCharacterPictures(collectionPlan)).toHaveLength(0)
    const { pdfFileBytes } = await writePapelizPdfExportNotePdf(collectionJob)
    expect(removePapelizPdfExportTestWhitespace(readPapelizPdfExportBodyText(await readPapelizPdfExportFileWithPdfJs(pdfFileBytes)))).toBe('Kana:あいう.')
  })

  it('asks for the computer fonts only when a note has characters no bundled font has, and keeps emoji as pictures', async () => {
    const computerFontSource = createTestComputerFontSource([])
    await buildScriptsTestJob('Plain.md', 'Plain text, Ελληνικά and 🙂.', { pdfExportComputerFontSource: computerFontSource })
    expect(computerFontSource.askedNoteNames).toEqual([])
  })

  it('sets a right-to-left run right to left, a word of a joining script as one picture, and writes it in reading order', async () => {
    const drawnPictureTexts: string[] = []
    const hebrewNoteText = 'Hebrew: שלום עולם (טוב).\n\nArabic: أنا قادر.'
    const notePdfJob = await buildScriptsTestJob('Hebrew.md', hebrewNoteText, { drawnPictureTexts })
    // Each word is one picture, so the canvas shapes it.
    expect(drawnPictureTexts).toEqual(['שלום', 'עולם', 'טוב', 'أنا', 'قادر'])
    const pageLayoutPlan = planPapelizPdfExportNotePages(notePdfJob).pageLayoutPlan
    const pictureTextsByKey = new Map(notePdfJob.pdfExportCharacterPictures.map((characterPicture) => [characterPicture.characterPictureKey, characterPicture.pictureCharactersText]))
    const picturesLeftToRight = listPlanCharacterPictures(pageLayoutPlan)
      .sort((firstPicture, secondPicture) => firstPicture.pictureTopPoints - secondPicture.pictureTopPoints || firstPicture.pictureLeftPoints - secondPicture.pictureLeftPoints)
      .map((pictureOperation) => (pictureOperation.pictureSource.pictureSourceKind === 'character-picture' ? pictureTextsByKey.get(pictureOperation.pictureSource.characterPictureKey) : ''))
    expect(picturesLeftToRight).toEqual(['טוב', 'עולם', 'שלום', 'قادر', 'أنا'])
    // The brackets are mirrored: the run's last character, ")", shows first, as "(".
    const hebrewLineTextRuns = listPlanTextRuns(pageLayoutPlan).filter((textRun) => /[()]/.test(textRun.textRunText))
    expect([...hebrewLineTextRuns].sort((firstRun, secondRun) => firstRun.textLeftPoints - secondRun.textLeftPoints).map((textRun) => textRun.textRunText.trim())).toEqual(['(', ')'])
    // Written in reading order, each word in display order as a right-to-left font writes it; a reader
    // turns each back.
    const { pdfFileBytes } = await writePapelizPdfExportNotePdf(notePdfJob)
    const pdfText = removePapelizPdfExportTestWhitespace(readPapelizPdfExportBodyText(await readPapelizPdfExportFileWithPdfJs(pdfFileBytes)))
    expect(pdfText).toContain('Hebrew:שלוםעולם')
    expect(pdfText).toContain('טוב')
    expect(pdfText).toContain('Arabic:أناقادر.')
  })

  it('sets right-to-left words drawn in a computer font right to left too', async () => {
    const hebrewFontSource = createTestComputerFontSource([createTestLocalFont('Segoe UI', 'Regular', 'PapelizCharacterPictures', createTestOutlineFreeFont('שלוםעולם', 0))])
    const notePdfJob = await buildScriptsTestJob('Hebrew.md', 'Hebrew: שלום עולם.', { pdfExportComputerFontSource: hebrewFontSource })
    const computerTextRuns = listPlanTextRuns(planPapelizPdfExportNotePages(notePdfJob).pageLayoutPlan).filter((textRun) => textRun.fontFaceKey.startsWith('computer-font'))
    // Written in reading order, placed right to left; this font has no layout tables, so each word is
    // given in display order.
    expect(computerTextRuns.map((textRun) => textRun.textRunText)).toEqual(['םולש', 'םלוע'])
    expect((computerTextRuns[0]?.textLeftPoints ?? 0) > (computerTextRuns[1]?.textLeftPoints ?? 0)).toBe(true)
    const { pdfFileBytes } = await writePapelizPdfExportNotePdf(notePdfJob)
    expect(removePapelizPdfExportTestWhitespace(readPapelizPdfExportBodyText(await readPapelizPdfExportFileWithPdfJs(pdfFileBytes)))).toBe('Hebrew:שלוםעולם.')
  })
})
