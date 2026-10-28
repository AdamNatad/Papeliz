// Line-level Markdown formats for the lines a selection touches: headings, bulleted and numbered
// lists, checklists and quotes. A line holds one of them at a time, so applying one replaces
// another; applying the one every line already has takes it off. Plain text changes, shared by the
// editor's context menu and the tests.

import type { PapelizInlineMarkdownTextChange } from './papeliz-note-inline-formatting'

export type PapelizLineMarkdownFormat = 'heading-1' | 'heading-2' | 'heading-3' | 'bulleted-list' | 'numbered-list' | 'checklist' | 'quote'

interface PapelizLineMarkdownPrefix {
  lineIndentText: string
  lineFormatPrefixText: string
  // Headings 4 to 6 are kept apart: no menu format matches them, but applying one replaces them.
  lineMarkdownFormat: PapelizLineMarkdownFormat | 'heading-other' | null
}

interface PapelizNoteLine {
  noteLineFrom: number
  noteLineText: string
}

const papelizLineFormatPrefixPattern = /^([ \t]*)(#{1,6} |[-*+] \[[ xX]\] |[-*+] |\d+[.)] |> )?/

function readLineMarkdownPrefix(noteLineText: string): PapelizLineMarkdownPrefix {
  const prefixMatch = papelizLineFormatPrefixPattern.exec(noteLineText)
  const lineIndentText = prefixMatch?.[1] ?? ''
  const lineFormatPrefixText = prefixMatch?.[2] ?? ''
  let lineMarkdownFormat: PapelizLineMarkdownPrefix['lineMarkdownFormat'] = null
  if (lineFormatPrefixText.startsWith('#')) {
    const headingLevel = lineFormatPrefixText.trim().length
    lineMarkdownFormat = headingLevel === 1 ? 'heading-1' : headingLevel === 2 ? 'heading-2' : headingLevel === 3 ? 'heading-3' : 'heading-other'
  } else if (/^[-*+] \[/.test(lineFormatPrefixText)) {
    lineMarkdownFormat = 'checklist'
  } else if (/^[-*+] /.test(lineFormatPrefixText)) {
    lineMarkdownFormat = 'bulleted-list'
  } else if (/^\d/.test(lineFormatPrefixText)) {
    lineMarkdownFormat = 'numbered-list'
  } else if (lineFormatPrefixText === '> ') {
    lineMarkdownFormat = 'quote'
  }
  return { lineIndentText, lineFormatPrefixText, lineMarkdownFormat }
}

function describeLineFormatPrefix(lineMarkdownFormat: PapelizLineMarkdownFormat, lineNumberInList: number): string {
  switch (lineMarkdownFormat) {
    case 'heading-1':
      return '# '
    case 'heading-2':
      return '## '
    case 'heading-3':
      return '### '
    case 'bulleted-list':
      return '- '
    case 'numbered-list':
      return `${lineNumberInList}. `
    case 'checklist':
      return '- [ ] '
    case 'quote':
      return '> '
  }
}

// The lines a selection touches. A selection that ends at the very start of a line leaves that line
// out; when several lines are touched, blank ones are left out too (a list skips empty lines).
function listSelectedNoteLines(noteText: string, selectionFrom: number, selectionTo: number): PapelizNoteLine[] {
  const firstLineFrom = noteText.lastIndexOf('\n', selectionFrom - 1) + 1
  const effectiveSelectionTo = selectionTo > selectionFrom && noteText[selectionTo - 1] === '\n' ? selectionTo - 1 : selectionTo
  const selectedNoteLines: PapelizNoteLine[] = []
  let noteLineFrom = firstLineFrom
  while (noteLineFrom <= noteText.length) {
    const lineBreakIndex = noteText.indexOf('\n', noteLineFrom)
    const noteLineTo = lineBreakIndex === -1 ? noteText.length : lineBreakIndex
    selectedNoteLines.push({ noteLineFrom, noteLineText: noteText.slice(noteLineFrom, noteLineTo) })
    if (lineBreakIndex === -1 || noteLineTo >= effectiveSelectionTo) break
    noteLineFrom = noteLineTo + 1
  }
  return selectedNoteLines.length > 1 ? selectedNoteLines.filter((selectedNoteLine) => selectedNoteLine.noteLineText.trim().length > 0) : selectedNoteLines
}

// The format every touched line shares, or null when they differ or have none.
export function findPapelizLineMarkdownFormatOfSelection(noteText: string, selectionFrom: number, selectionTo: number): PapelizLineMarkdownFormat | null {
  const selectedLineFormats = listSelectedNoteLines(noteText, selectionFrom, selectionTo).map(
    (selectedNoteLine) => readLineMarkdownPrefix(selectedNoteLine.noteLineText).lineMarkdownFormat,
  )
  const firstLineFormat = selectedLineFormats[0] ?? null
  if (firstLineFormat === null || firstLineFormat === 'heading-other') return null
  return selectedLineFormats.every((selectedLineFormat) => selectedLineFormat === firstLineFormat) ? firstLineFormat : null
}

export interface PapelizNoteDividerInsertion {
  dividerTextChange: PapelizInlineMarkdownTextChange
  // Where the cursor goes: the line after the divider, ready to type.
  cursorPositionAfterDivider: number
}

// A divider (`---`, Markdown's horizontal rule) after the line the selection ends on, with a blank
// line above it, because `---` right under a line of text turns that text into a heading instead.
// On an empty line, the divider takes that line.
export function insertPapelizNoteDivider(noteText: string, selectionTo: number): PapelizNoteDividerInsertion {
  const newlineAfterSelection = noteText.indexOf('\n', selectionTo)
  const lineEnd = newlineAfterSelection === -1 ? noteText.length : newlineAfterSelection
  const lineStart = noteText.lastIndexOf('\n', lineEnd - 1) + 1
  if (noteText.slice(lineStart, lineEnd).trim().length === 0) {
    const previousLineEnd = lineStart - 1
    const previousLineStart = previousLineEnd <= 0 ? 0 : noteText.lastIndexOf('\n', previousLineEnd - 1) + 1
    const isTextRightAbove = previousLineEnd > 0 && noteText.slice(previousLineStart, previousLineEnd).trim().length > 0
    const dividerText = `${isTextRightAbove ? '\n' : ''}---\n`
    return {
      dividerTextChange: { changeFrom: lineStart, changeTo: lineEnd, insertedText: dividerText },
      cursorPositionAfterDivider: lineStart + dividerText.length,
    }
  }
  const dividerText = '\n\n---\n'
  return {
    dividerTextChange: { changeFrom: lineEnd, changeTo: lineEnd, insertedText: dividerText },
    cursorPositionAfterDivider: lineEnd + dividerText.length,
  }
}

// Turns the touched lines into `lineMarkdownFormat`, or back into plain lines when they all have it.
// Numbered lists count from 1; headings drop the line's indent, the others keep it.
export function togglePapelizLineMarkdownFormat(
  noteText: string,
  selectionFrom: number,
  selectionTo: number,
  lineMarkdownFormat: PapelizLineMarkdownFormat,
): PapelizInlineMarkdownTextChange[] {
  const isFormatOnEveryLine = findPapelizLineMarkdownFormatOfSelection(noteText, selectionFrom, selectionTo) === lineMarkdownFormat
  const isHeadingFormat = lineMarkdownFormat.startsWith('heading')
  return listSelectedNoteLines(noteText, selectionFrom, selectionTo).map((selectedNoteLine, selectedLineIndex) => {
    const { lineIndentText, lineFormatPrefixText } = readLineMarkdownPrefix(selectedNoteLine.noteLineText)
    const newLinePrefix = isFormatOnEveryLine
      ? lineIndentText
      : `${isHeadingFormat ? '' : lineIndentText}${describeLineFormatPrefix(lineMarkdownFormat, selectedLineIndex + 1)}`
    return {
      changeFrom: selectedNoteLine.noteLineFrom,
      changeTo: selectedNoteLine.noteLineFrom + lineIndentText.length + lineFormatPrefixText.length,
      insertedText: newLinePrefix,
    }
  })
}
