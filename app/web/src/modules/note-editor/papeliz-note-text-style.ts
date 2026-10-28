// Styled text in a note: a color, a size, or both, written as
//   <span style="color: purple; font-size: 1.25em">words</span>
// so other Markdown apps show them too. A color is one of the card colors by name (drawn in the
// theme's own shade of it) or a hex color such as #7c3aed; a size is one of Papeliz's sizes. Papeliz
// reads only this exact form, with nothing else in the style.

import { parsePapelizHexColor } from '../ui/papeliz-color-values'
import { papelizNoteCalloutColors } from './papeliz-note-callout-cards'
import type { PapelizInlineMarkdownFormatResult, PapelizInlineMarkdownTextChange } from './papeliz-note-inline-formatting'

export interface PapelizNoteTextStyle {
  // A card color name or a hex color; null for the text's own color.
  textColor: string | null
  // One of the sizes below; null for the text's own size.
  textSize: string | null
}

// The sizes the context menu offers, relative to the text around them.
export const papelizNoteTextSizes = [
  { textSize: '0.85em', textSizeLabel: 'Small' },
  { textSize: '1.25em', textSizeLabel: 'Large' },
  { textSize: '1.5em', textSizeLabel: 'Larger' },
  { textSize: '2em', textSizeLabel: 'Huge' },
] as const

const papelizTextStyleOpenTagPattern = /^<span style="([^"<>]*)">$/
const papelizTextStyleSpanPattern = /<span style="[^"<>]*">(.*?)<\/span>/g
const papelizTextStyleCloseTag = '</span>'
// What starts a line and stays outside the style: indent, a heading's #, a list or task marker, a
// number, quote marks and a callout's [!kind].
const papelizLineMarkerPattern = /^[ \t]*(?:#{1,6} |[-*+] \[[ xX]\] |[-*+] |\d+[.)] |(?:> ?)+(?:\[![^\]]+\][+-]? *)?)?/

export function isPapelizTextColorValue(textColorValue: string): boolean {
  return (papelizNoteCalloutColors as readonly string[]).includes(textColorValue) || parsePapelizHexColor(textColorValue) === textColorValue.toLowerCase()
}

export function isPapelizTextSizeValue(textSizeValue: string): boolean {
  return papelizNoteTextSizes.some(({ textSize }) => textSize === textSizeValue)
}

// The style of an opening `<span style="…">` tag, or null for any other tag, including a span whose
// style holds anything but one color and one size.
export function matchPapelizTextStyleOpenTag(htmlTagText: string): PapelizNoteTextStyle | null {
  const openTagMatch = papelizTextStyleOpenTagPattern.exec(htmlTagText.trim())
  if (openTagMatch === null) return null
  const textStyle: PapelizNoteTextStyle = { textColor: null, textSize: null }
  const styleDeclarations = (openTagMatch[1] ?? '').split(';').map((styleDeclaration) => styleDeclaration.trim()).filter((styleDeclaration) => styleDeclaration.length > 0)
  if (styleDeclarations.length === 0) return null
  for (const styleDeclaration of styleDeclarations) {
    const declarationMatch = /^(color|font-size)\s*:\s*(\S+)$/.exec(styleDeclaration)
    const styleValue = declarationMatch?.[2]?.toLowerCase()
    if (declarationMatch === null || styleValue === undefined) return null
    if (declarationMatch[1] === 'color') {
      if (textStyle.textColor !== null || !isPapelizTextColorValue(styleValue)) return null
      textStyle.textColor = parsePapelizHexColor(styleValue) ?? styleValue
    } else {
      if (textStyle.textSize !== null || !isPapelizTextSizeValue(styleValue)) return null
      textStyle.textSize = styleValue
    }
  }
  return textStyle
}

// The CSS to draw: a card color in the theme's shade (readable in light and dark), or the hex; and
// the size.
export function describePapelizTextStyleCss({ textColor, textSize }: PapelizNoteTextStyle): string {
  const cssDeclarations: string[] = []
  if (textColor !== null) {
    cssDeclarations.push(`color: ${(papelizNoteCalloutColors as readonly string[]).includes(textColor) ? `var(--color-papeliz-callout-${textColor}-ink)` : textColor}`)
  }
  if (textSize !== null) cssDeclarations.push(`font-size: ${textSize}`)
  return cssDeclarations.join('; ')
}

function buildTextStyleOpenTag({ textColor, textSize }: PapelizNoteTextStyle): string {
  const styleDeclarations: string[] = []
  if (textColor !== null) styleDeclarations.push(`color: ${textColor}`)
  if (textSize !== null) styleDeclarations.push(`font-size: ${textSize}`)
  return `<span style="${styleDeclarations.join('; ')}">`
}

interface PapelizTextStyleSpan extends PapelizNoteTextStyle {
  openTagFrom: number
  openTagTo: number
  closeTagFrom: number
  closeTagTo: number
}

function findTextStyleSpanAround(noteText: string, selectionFrom: number, selectionTo: number): PapelizTextStyleSpan | null {
  const lineFrom = noteText.lastIndexOf('\n', selectionFrom - 1) + 1
  const lineBreakIndex = noteText.indexOf('\n', selectionFrom)
  const lineText = noteText.slice(lineFrom, lineBreakIndex === -1 ? noteText.length : lineBreakIndex)
  for (const spanMatch of lineText.matchAll(papelizTextStyleSpanPattern)) {
    const openTagFrom = lineFrom + (spanMatch.index ?? 0)
    const closeTagTo = openTagFrom + spanMatch[0].length
    const openTagTo = closeTagTo - papelizTextStyleCloseTag.length - (spanMatch[1] ?? '').length
    const spanStyle = matchPapelizTextStyleOpenTag(noteText.slice(openTagFrom, openTagTo))
    if (spanStyle !== null && openTagFrom <= selectionFrom && selectionTo <= closeTagTo) {
      return { ...spanStyle, openTagFrom, openTagTo, closeTagFrom: closeTagTo - papelizTextStyleCloseTag.length, closeTagTo }
    }
  }
  return null
}

// The style of the styled stretch the selection sits in (what the menu shows as chosen), or null.
export function findPapelizTextStyleAround(noteText: string, selectionFrom: number, selectionTo: number): PapelizNoteTextStyle | null {
  const textStyleSpan = findTextStyleSpanAround(noteText, selectionFrom, selectionTo)
  return textStyleSpan === null ? null : { textColor: textStyleSpan.textColor, textSize: textStyleSpan.textSize }
}

// The word under a cursor, for styling it without selecting it first.
function findWordAround(noteText: string, cursorPosition: number): [number, number] {
  let wordFrom = cursorPosition
  let wordTo = cursorPosition
  while (wordFrom > 0 && /[\p{L}\p{N}_'-]/u.test(noteText[wordFrom - 1] ?? '')) wordFrom -= 1
  while (wordTo < noteText.length && /[\p{L}\p{N}_'-]/u.test(noteText[wordTo] ?? '')) wordTo += 1
  return [wordFrom, wordTo]
}

// Changes the color and/or size of the selection (a field left out keeps what is there; null takes
// it off). Inside a styled stretch, that stretch changes; otherwise each selected line gets its own
// span, around its words, with list and heading markers kept outside. Gives back null when there is
// nothing to do.
export function applyPapelizTextStyle(
  noteText: string,
  selectionFrom: number,
  selectionTo: number,
  textStyleChange: Partial<PapelizNoteTextStyle>,
): PapelizInlineMarkdownFormatResult | null {
  const existingStyleSpan = findTextStyleSpanAround(noteText, selectionFrom, selectionTo)
  if (existingStyleSpan !== null) {
    const changedTextStyle: PapelizNoteTextStyle = {
      textColor: textStyleChange.textColor === undefined ? existingStyleSpan.textColor : textStyleChange.textColor,
      textSize: textStyleChange.textSize === undefined ? existingStyleSpan.textSize : textStyleChange.textSize,
    }
    const innerTextLength = existingStyleSpan.closeTagFrom - existingStyleSpan.openTagTo
    if (changedTextStyle.textColor === null && changedTextStyle.textSize === null) {
      return {
        textChanges: [
          { changeFrom: existingStyleSpan.openTagFrom, changeTo: existingStyleSpan.openTagTo, insertedText: '' },
          { changeFrom: existingStyleSpan.closeTagFrom, changeTo: existingStyleSpan.closeTagTo, insertedText: '' },
        ],
        formattedSelectionFrom: existingStyleSpan.openTagFrom,
        formattedSelectionTo: existingStyleSpan.openTagFrom + innerTextLength,
      }
    }
    const newOpenTag = buildTextStyleOpenTag(changedTextStyle)
    return {
      textChanges: [{ changeFrom: existingStyleSpan.openTagFrom, changeTo: existingStyleSpan.openTagTo, insertedText: newOpenTag }],
      formattedSelectionFrom: existingStyleSpan.openTagFrom + newOpenTag.length,
      formattedSelectionTo: existingStyleSpan.openTagFrom + newOpenTag.length + innerTextLength,
    }
  }

  const newTextStyle: PapelizNoteTextStyle = { textColor: textStyleChange.textColor ?? null, textSize: textStyleChange.textSize ?? null }
  if (newTextStyle.textColor === null && newTextStyle.textSize === null) return null
  const openTag = buildTextStyleOpenTag(newTextStyle)
  const [styledFrom, styledTo] = selectionFrom === selectionTo ? findWordAround(noteText, selectionFrom) : [selectionFrom, selectionTo]
  const textChanges: PapelizInlineMarkdownTextChange[] = []
  let lineFrom = styledFrom
  while (lineFrom <= styledTo) {
    const lineBreakIndex = noteText.indexOf('\n', lineFrom)
    const lineTo = Math.min(styledTo, lineBreakIndex === -1 ? noteText.length : lineBreakIndex)
    let textFrom = lineFrom
    let textTo = lineTo
    // A list's marker, a heading's # and the like stay outside the style, so the line keeps its kind.
    const lineStart = noteText.lastIndexOf('\n', lineFrom - 1) + 1
    const lineContentStart = lineStart + (papelizLineMarkerPattern.exec(noteText.slice(lineStart, lineTo))?.[0].length ?? 0)
    if (textFrom < lineContentStart) textFrom = Math.min(lineContentStart, textTo)
    while (textFrom < textTo && /\s/.test(noteText[textFrom] ?? '')) textFrom += 1
    while (textTo > textFrom && /\s/.test(noteText[textTo - 1] ?? '')) textTo -= 1
    if (textTo > textFrom || styledFrom === styledTo) {
      textChanges.push({ changeFrom: textFrom, changeTo: textFrom, insertedText: openTag })
      textChanges.push({ changeFrom: textTo, changeTo: textTo, insertedText: papelizTextStyleCloseTag })
    }
    if (lineBreakIndex === -1 || lineBreakIndex >= styledTo) break
    lineFrom = lineBreakIndex + 1
  }
  if (textChanges.length === 0) return null
  const firstOpenTagAt = textChanges[0]?.changeFrom ?? styledFrom
  const lastCloseTagAt = textChanges[textChanges.length - 1]?.changeFrom ?? styledTo
  const spanCount = textChanges.length / 2
  const addedBeforeLastClose = spanCount * openTag.length + (spanCount - 1) * papelizTextStyleCloseTag.length
  return {
    textChanges,
    formattedSelectionFrom: firstOpenTagAt + openTag.length,
    formattedSelectionTo: lastCloseTagAt + addedBeforeLastClose,
  }
}
