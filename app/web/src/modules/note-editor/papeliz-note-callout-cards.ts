// Callout cards (`> [!note] Title`) from the note's context menu: putting one in, changing the one
// the cursor is in, and turning it back into plain lines. A new card takes the selected lines as its
// body, or comes in on the cursor's line (or after it) with its title selected and ready to type
// over. A blank line keeps the paragraph after a card from being pulled into it.

import type { PapelizInlineMarkdownFormatResult } from './papeliz-note-inline-formatting'

export type PapelizNoteCalloutKind = 'note' | 'tip' | 'success' | 'warning' | 'danger' | 'quote'

// The colors a card can be given in its Markdown, as `> [!note|purple]`.
export const papelizNoteCalloutColors = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'gray'] as const
export type PapelizNoteCalloutColor = (typeof papelizNoteCalloutColors)[number]

const papelizCalloutTitlePlaceholder = 'Title'

function findNoteLineBounds(noteText: string, notePosition: number): { noteLineFrom: number; noteLineTo: number } {
  const noteLineFrom = noteText.lastIndexOf('\n', notePosition - 1) + 1
  const lineBreakIndex = noteText.indexOf('\n', notePosition)
  return { noteLineFrom, noteLineTo: lineBreakIndex === -1 ? noteText.length : lineBreakIndex }
}

// A blank line after the card unless the note ends there or a blank line already follows.
function needsBlankLineAfter(noteText: string, cardEnd: number): boolean {
  if (cardEnd >= noteText.length) return false
  const { noteLineTo: followingLineTo } = findNoteLineBounds(noteText, cardEnd + 1)
  return noteText.slice(cardEnd + 1, followingLineTo).trim().length > 0
}

export function insertPapelizNoteCallout(
  noteText: string,
  selectionFrom: number,
  selectionTo: number,
  calloutKind: PapelizNoteCalloutKind,
  // A card color by name, or any hex color such as #7c3aed.
  calloutColor: PapelizNoteCalloutColor | string | null = null,
): PapelizInlineMarkdownFormatResult {
  const calloutFirstLine = calloutColor === null ? `> [!${calloutKind}]` : `> [!${calloutKind}|${calloutColor}]`
  const hasSelectedText = selectionTo > selectionFrom && noteText.slice(selectionFrom, selectionTo).trim().length > 0

  if (hasSelectedText) {
    const effectiveSelectionTo = noteText[selectionTo - 1] === '\n' ? selectionTo - 1 : selectionTo
    const { noteLineFrom: firstLineFrom } = findNoteLineBounds(noteText, selectionFrom)
    const { noteLineTo: lastLineTo } = findNoteLineBounds(noteText, effectiveSelectionTo)
    const calloutBodyLines = noteText
      .slice(firstLineFrom, lastLineTo)
      .split('\n')
      .map((selectedLine) => (selectedLine.length === 0 ? '>' : `> ${selectedLine}`))
    const calloutText = `${calloutFirstLine}\n${calloutBodyLines.join('\n')}${needsBlankLineAfter(noteText, lastLineTo) ? '\n' : ''}`
    // The cursor waits at the end of the first line, where a title can be typed.
    return {
      textChanges: [{ changeFrom: firstLineFrom, changeTo: lastLineTo, insertedText: calloutText }],
      formattedSelectionFrom: firstLineFrom + calloutFirstLine.length,
      formattedSelectionTo: firstLineFrom + calloutFirstLine.length,
    }
  }

  const { noteLineFrom, noteLineTo } = findNoteLineBounds(noteText, selectionFrom)
  const isCursorLineBlank = noteText.slice(noteLineFrom, noteLineTo).trim().length === 0
  const newCardText = `${calloutFirstLine} ${papelizCalloutTitlePlaceholder}\n> `
  const insertedText = isCursorLineBlank
    ? `${newCardText}${needsBlankLineAfter(noteText, noteLineTo) ? '\n' : ''}`
    : `\n\n${newCardText}${needsBlankLineAfter(noteText, noteLineTo) ? '\n' : ''}`
  const cardStart = isCursorLineBlank ? noteLineFrom : noteLineTo + 2
  const titleFrom = cardStart + calloutFirstLine.length + 1
  return {
    textChanges: [{ changeFrom: isCursorLineBlank ? noteLineFrom : noteLineTo, changeTo: noteLineTo, insertedText }],
    formattedSelectionFrom: titleFrom,
    formattedSelectionTo: titleFrom + papelizCalloutTitlePlaceholder.length,
  }
}

// The card a position is in: the quote block it belongs to, when that block's first line is a
// `> [!kind]` or `> [!kind|color]` header.
export interface PapelizNoteCalloutCard {
  calloutCardFrom: number
  calloutCardTo: number
  calloutKind: string
  calloutColor: string | null
  // Where `[!kind|color]` sits on the first line.
  calloutHeaderFrom: number
  calloutHeaderTo: number
}

const papelizQuoteLinePattern = /^[ \t]*>/
const papelizCalloutHeaderLinePattern = /^([ \t]*> ?)(\[!([A-Za-z][\w-]*)(?:\|([^\]]+))?\][+-]?)/

export function findPapelizNoteCalloutCard(noteText: string, notePosition: number): PapelizNoteCalloutCard | null {
  let { noteLineFrom: cardFirstLineFrom, noteLineTo: cardFirstLineTo } = findNoteLineBounds(noteText, notePosition)
  if (!papelizQuoteLinePattern.test(noteText.slice(cardFirstLineFrom, cardFirstLineTo))) return null
  // Up to the quote's first line.
  while (cardFirstLineFrom > 0) {
    const previousLine = findNoteLineBounds(noteText, cardFirstLineFrom - 1)
    if (!papelizQuoteLinePattern.test(noteText.slice(previousLine.noteLineFrom, previousLine.noteLineTo))) break
    cardFirstLineFrom = previousLine.noteLineFrom
    cardFirstLineTo = previousLine.noteLineTo
  }
  const headerMatch = papelizCalloutHeaderLinePattern.exec(noteText.slice(cardFirstLineFrom, cardFirstLineTo))
  if (headerMatch === null) return null
  // Down to its last line.
  let cardLastLineTo = cardFirstLineTo
  while (cardLastLineTo < noteText.length) {
    const nextLine = findNoteLineBounds(noteText, cardLastLineTo + 1)
    if (!papelizQuoteLinePattern.test(noteText.slice(nextLine.noteLineFrom, nextLine.noteLineTo))) break
    cardLastLineTo = nextLine.noteLineTo
  }
  const calloutHeaderFrom = cardFirstLineFrom + (headerMatch[1] ?? '').length
  return {
    calloutCardFrom: cardFirstLineFrom,
    calloutCardTo: cardLastLineTo,
    calloutKind: (headerMatch[3] ?? 'note').toLowerCase(),
    calloutColor: headerMatch[4]?.toLowerCase() ?? null,
    calloutHeaderFrom,
    calloutHeaderTo: calloutHeaderFrom + (headerMatch[2] ?? '').length,
  }
}

// Gives the card the cursor is in another kind or color; null when the cursor is in no card.
export function changePapelizNoteCalloutCard(
  noteText: string,
  notePosition: number,
  calloutKind: PapelizNoteCalloutKind,
  calloutColor: PapelizNoteCalloutColor | string | null = null,
): PapelizInlineMarkdownFormatResult | null {
  const calloutCard = findPapelizNoteCalloutCard(noteText, notePosition)
  if (calloutCard === null) return null
  const newCalloutHeader = calloutColor === null ? `[!${calloutKind}]` : `[!${calloutKind}|${calloutColor}]`
  const headerLengthChange = newCalloutHeader.length - (calloutCard.calloutHeaderTo - calloutCard.calloutHeaderFrom)
  const cursorAfterChange = notePosition >= calloutCard.calloutHeaderTo ? notePosition + headerLengthChange : calloutCard.calloutHeaderFrom
  return {
    textChanges: [{ changeFrom: calloutCard.calloutHeaderFrom, changeTo: calloutCard.calloutHeaderTo, insertedText: newCalloutHeader }],
    formattedSelectionFrom: cursorAfterChange,
    formattedSelectionTo: cursorAfterChange,
  }
}

// Turns the card the cursor is in back into plain lines: the quote marks go, the header goes, and
// the title stays as an ordinary first line (or goes too when there is none). Null outside a card.
export function removePapelizNoteCalloutCard(noteText: string, notePosition: number): PapelizInlineMarkdownFormatResult | null {
  const calloutCard = findPapelizNoteCalloutCard(noteText, notePosition)
  if (calloutCard === null) return null
  const cardLines = noteText.slice(calloutCard.calloutCardFrom, calloutCard.calloutCardTo).split('\n')
  const unquotedLines = cardLines.map((cardLine) => cardLine.replace(/^[ \t]*> ?/, ''))
  const titleText = (unquotedLines[0] ?? '').replace(/^\[![^\]]+\][+-]?[ \t]*/, '')
  const plainLines = titleText.trim().length > 0 ? [titleText, ...unquotedLines.slice(1)] : unquotedLines.slice(1)
  const plainText = plainLines.join('\n')
  return {
    textChanges: [{ changeFrom: calloutCard.calloutCardFrom, changeTo: calloutCard.calloutCardTo, insertedText: plainText }],
    formattedSelectionFrom: calloutCard.calloutCardFrom,
    formattedSelectionTo: calloutCard.calloutCardFrom,
  }
}
