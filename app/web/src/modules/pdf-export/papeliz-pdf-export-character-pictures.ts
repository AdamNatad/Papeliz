import { papelizExportPrintColorsByToken } from '../export-print-style/papeliz-export-print-style'
import {
  choosePapelizPdfExportFontWeight,
  getPapelizPdfExportBlockFontWeight,
  getPapelizPdfExportNoteFontFamilyName,
  papelizPdfExportCodeBoxFontStyle,
  papelizPdfExportPropertyNameFontWeight,
  resolvePapelizPdfExportTextRunFontStyle,
  splitPapelizPdfExportTextByBundledFontFile,
  type PapelizPdfExportFontFamilyName,
  type PapelizPdfExportFontStyle,
  type PapelizPdfExportFontWeight,
} from './papeliz-pdf-export-fonts'
import type { PapelizPdfExportInlineRun, PapelizPdfExportNoteBlock, PapelizPdfExportNoteDocument } from './papeliz-pdf-export-note-document'
import type { PapelizPdfExportPictureFile } from './papeliz-pdf-export-picture-check'

// Characters no font in the PDF has (emoji, and scripts no bundled font covers) print as pictures,
// drawn by the page's canvas in the note's typeface, each character in each color and face once. A
// word of a script whose letters join or run right to left (Arabic, Hebrew and the like) is one
// picture, so the canvas shapes it and it moves as a whole in a right-to-left line. The worker draws
// each picture where its text goes and writes the text over it in an outline-free font
// (papeliz-pdf-export-glyphless-font.ts), so it copies as itself. Which characters need a picture, and
// in which color, is read here from the note document, by the same color rules the layout follows.

export interface PapelizPdfExportCharacterPicture {
  characterPictureKey: string
  // One character cluster, or a word of a joining or right-to-left script.
  pictureCharactersText: string
  // A PNG, drawn again by the canvas like every picture.
  pictureFile: PapelizPdfExportPictureFile
  // Its box in ems of the text size: as wide as the character's advance, from this far above the
  // baseline, this tall.
  advanceEm: number
  topAboveBaselineEm: number
  heightEm: number
}

export interface PapelizPdfExportCharacterPictureRequest {
  characterPictureKey: string
  pictureCharactersText: string
  textColor: string
  fontStyle: PapelizPdfExportFontStyle
}

// The face key of the outline-free font the characters' text is written in.
export const papelizPdfExportCharacterPictureFontFaceKey = 'papeliz-character-pictures'

export function getPapelizPdfExportCharacterPictureKey(pictureCharactersText: string, textColor: string, fontStyle: PapelizPdfExportFontStyle): string {
  return `${pictureCharactersText}\u0000${textColor}\u0000${fontStyle.fontFamilyName}-${fontStyle.fontWeight}-${fontStyle.isFontItalic ? 'italic' : 'normal'}`
}

const papelizPdfExportGraphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// Scripts whose letters join or run right to left. U+0640 (the Arabic stretching line) belongs with
// them inside a word.
const papelizPdfExportWordPictureScriptPattern =
  /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Samaritan}\p{Script=Mandaic}\p{Script=Adlam}\p{Script=Hanifi_Rohingya}\p{Script=Mongolian}\u0640]/u

export function isPapelizPdfExportWordPictureGrapheme(graphemeText: string): boolean {
  return papelizPdfExportWordPictureScriptPattern.test(graphemeText)
}

// Right-to-left letters, marks and explicit direction characters.
export const papelizPdfExportRightToLeftTextPattern =
  /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Samaritan}\p{Script=Mandaic}\p{Script=Adlam}\p{Script=Hanifi_Rohingya}\u061c\u200f\u202b\u202e\u2067]/u

// The text written over a picture in the outline-free font. A right-to-left word goes in display
// order, last character first, as a right-to-left font's glyphs do, so a reader turns it back into
// reading order the same way.
export function getPapelizPdfExportGlyphlessText(pictureCharactersText: string): string {
  return papelizPdfExportRightToLeftTextPattern.test(pictureCharactersText) ? Array.from(pictureCharactersText).reverse().join('') : pictureCharactersText
}

// Color emoji: what a PDF font can't hold. A pictograph drawn as text by default (↔, ☺ without
// U+FE0F) isn't one; a computer font may draw it.
export function isPapelizPdfExportColorEmoji(pictureCharactersText: string): boolean {
  return /[\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Regional_Indicator}\u{FE0F}\u{20E3}]/u.test(pictureCharactersText)
}

// "שלום עולם!" -> "שלום", " ", "עולם", " ", "!": a word of a joining or right-to-left script as one
// unit, every other character cluster as its own.
export function splitPapelizPdfExportTextIntoPictureUnits(textToSplit: string): string[] {
  const pictureUnits: string[] = []
  let isLastUnitWordPicture = false
  for (const { segment: graphemeText } of papelizPdfExportGraphemeSegmenter.segment(textToSplit)) {
    const isWordPictureGrapheme = isPapelizPdfExportWordPictureGrapheme(graphemeText)
    if (isWordPictureGrapheme && isLastUnitWordPicture) pictureUnits[pictureUnits.length - 1] += graphemeText
    else pictureUnits.push(graphemeText)
    isLastUnitWordPicture = isWordPictureGrapheme
  }
  return pictureUnits
}

// Spaces and invisible characters need no picture.
export function isPapelizPdfExportInvisibleText(textToCheck: string): boolean {
  return /^[\s\p{Cc}\p{Cf}]*$/u.test(textToCheck)
}

// The units of a text in one style that no bundled font file has.
export function listPapelizPdfExportUnprintedPictureUnits(textToPrint: string, fontStyle: PapelizPdfExportFontStyle): string[] {
  const unprintedPictureUnits: string[] = []
  for (const { segmentText, fontFaceKey } of splitPapelizPdfExportTextByBundledFontFile(textToPrint, fontStyle)) {
    if (fontFaceKey !== null) continue
    for (const pictureUnit of splitPapelizPdfExportTextIntoPictureUnits(segmentText)) {
      if (!isPapelizPdfExportInvisibleText(pictureUnit)) unprintedPictureUnits.push(pictureUnit)
    }
  }
  return unprintedPictureUnits
}

const { '--color-papeliz-ink': papelizPdfExportInkColor, '--color-papeliz-ink-muted': papelizPdfExportMutedInkColor, '--color-papeliz-ink-subtle': papelizPdfExportSubtleInkColor } =
  papelizExportPrintColorsByToken

// Every character that needs a picture, in its color and face, each once, at most `largestRequestCount`.
export function listPapelizPdfExportCharacterPictureRequests(
  pdfExportNoteDocument: PapelizPdfExportNoteDocument,
  pdfExportFooterNoteName: string,
  largestRequestCount: number,
): PapelizPdfExportCharacterPictureRequest[] {
  const noteFontFamilyName: PapelizPdfExportFontFamilyName = getPapelizPdfExportNoteFontFamilyName(pdfExportNoteDocument.noteFontFamily)
  const noteTextFontStyle = (wantedFontWeight: PapelizPdfExportFontWeight = 400): PapelizPdfExportFontStyle => ({
    fontFamilyName: noteFontFamilyName,
    fontWeight: choosePapelizPdfExportFontWeight(noteFontFamilyName, wantedFontWeight),
    isFontItalic: false,
  })
  const requestsByKey = new Map<string, PapelizPdfExportCharacterPictureRequest>()
  const addText = (textToPrint: string, textColor: string, fontStyle: PapelizPdfExportFontStyle) => {
    for (const pictureCharactersText of listPapelizPdfExportUnprintedPictureUnits(textToPrint, fontStyle)) {
      if (requestsByKey.size >= largestRequestCount) return
      const characterPictureKey = getPapelizPdfExportCharacterPictureKey(pictureCharactersText, textColor, fontStyle)
      if (!requestsByKey.has(characterPictureKey)) requestsByKey.set(characterPictureKey, { characterPictureKey, pictureCharactersText, textColor, fontStyle })
    }
  }
  const addInlineRuns = (inlineRuns: readonly PapelizPdfExportInlineRun[], blockTextColor: string, blockFontWeight: PapelizPdfExportFontWeight) => {
    for (const inlineRun of inlineRuns) {
      if (inlineRun.inlineRunKind !== 'text') continue
      addText(inlineRun.textRunText, inlineRun.textRunLook.textRunColor ?? blockTextColor, resolvePapelizPdfExportTextRunFontStyle(noteFontFamilyName, blockFontWeight, inlineRun.textRunLook))
    }
  }
  const addBlocks = (noteBlocks: readonly PapelizPdfExportNoteBlock[], placeTextColor: string | null) => {
    for (const noteBlock of noteBlocks) {
      switch (noteBlock.noteBlockKind) {
        case 'heading':
          addInlineRuns(noteBlock.headingInlineRuns, placeTextColor ?? papelizPdfExportInkColor, getPapelizPdfExportBlockFontWeight(noteBlock))
          break
        case 'paragraph':
          addInlineRuns(noteBlock.paragraphInlineRuns, noteBlock.paragraphTextColor ?? placeTextColor ?? papelizPdfExportInkColor, 400)
          break
        case 'code-box':
          addText(noteBlock.codeBoxText, placeTextColor ?? papelizPdfExportInkColor, papelizPdfExportCodeBoxFontStyle)
          break
        case 'list':
          for (const listItem of noteBlock.listItems) addBlocks(listItem.listItemBlocks, listItem.listItemTaskState === 'done' ? papelizPdfExportSubtleInkColor : placeTextColor)
          break
        case 'quote':
          addBlocks(noteBlock.quoteBlocks, placeTextColor ?? papelizPdfExportMutedInkColor)
          break
        case 'footnotes':
          for (const noteFootnote of noteBlock.noteFootnotes) addBlocks(noteFootnote.footnoteBlocks, placeTextColor ?? papelizPdfExportMutedInkColor)
          break
        case 'callout':
          addInlineRuns(noteBlock.calloutTitleInlineRuns, noteBlock.calloutInkColor, 600)
          addBlocks(noteBlock.calloutBlocks, placeTextColor)
          break
        case 'table':
          for (const { isTableHeaderRow, tableCells } of noteBlock.tableRows) {
            for (const { tableCellInlineRuns } of tableCells) addInlineRuns(tableCellInlineRuns, placeTextColor ?? papelizPdfExportInkColor, isTableHeaderRow ? 600 : 400)
          }
          break
        case 'properties':
          for (const { notePropertyName, notePropertyValuesText } of noteBlock.noteProperties) {
            addText(notePropertyName, papelizPdfExportInkColor, noteTextFontStyle(papelizPdfExportPropertyNameFontWeight))
            addText(notePropertyValuesText, papelizPdfExportMutedInkColor, noteTextFontStyle())
          }
          break
        default:
          break
      }
    }
  }
  addText(pdfExportFooterNoteName, papelizPdfExportSubtleInkColor, noteTextFontStyle())
  addBlocks(pdfExportNoteDocument.noteBlocks, null)
  return [...requestsByKey.values()]
}
