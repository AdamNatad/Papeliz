import { describe, expect, it } from 'vitest'
import {
  findPapelizLineMarkdownFormatOfSelection,
  insertPapelizNoteDivider,
  togglePapelizLineMarkdownFormat,
  type PapelizLineMarkdownFormat,
} from './papeliz-note-line-formatting'

// Inserts a divider at the cursor `|` and returns the new text with the cursor marked again.
function insertDivider(noteTextWithCursor: string): string {
  const cursorPosition = noteTextWithCursor.indexOf('|')
  const noteText = noteTextWithCursor.replace('|', '')
  const { dividerTextChange, cursorPositionAfterDivider } = insertPapelizNoteDivider(noteText, cursorPosition)
  const dividedNoteText = noteText.slice(0, dividerTextChange.changeFrom) + dividerTextChange.insertedText + noteText.slice(dividerTextChange.changeTo)
  return `${dividedNoteText.slice(0, cursorPositionAfterDivider)}|${dividedNoteText.slice(cursorPositionAfterDivider)}`
}

// Applies a line format to the selection marked `{…}` in `noteTextWithSelection` and returns the
// new text (without the marks).
function applyLineFormat(noteTextWithSelection: string, lineMarkdownFormat: PapelizLineMarkdownFormat): string {
  const selectionFrom = noteTextWithSelection.indexOf('{')
  const selectionTo = noteTextWithSelection.indexOf('}') - 1
  const noteText = noteTextWithSelection.replace('{', '').replace('}', '')
  let formattedNoteText = noteText
  const textChanges = togglePapelizLineMarkdownFormat(noteText, selectionFrom, selectionTo, lineMarkdownFormat)
  for (const textChange of [...textChanges].sort((firstChange, secondChange) => secondChange.changeFrom - firstChange.changeFrom)) {
    formattedNoteText = formattedNoteText.slice(0, textChange.changeFrom) + textChange.insertedText + formattedNoteText.slice(textChange.changeTo)
  }
  return formattedNoteText
}

describe('dividers', () => {
  it('puts the divider under the line, with a blank line above so the text stays a paragraph', () => {
    expect(insertDivider('Water ear|ly.\nMulch.')).toBe('Water early.\n\n---\n|\nMulch.')
    expect(insertDivider('Water early.|')).toBe('Water early.\n\n---\n|')
  })

  it('takes an empty line, adding the blank line only when text is right above', () => {
    expect(insertDivider('Water early.\n|\nMulch.')).toBe('Water early.\n\n---\n|\nMulch.')
    expect(insertDivider('Water early.\n\n|')).toBe('Water early.\n\n---\n|')
    expect(insertDivider('|')).toBe('---\n|')
  })
})

describe('line formats', () => {
  it('turns the cursor line into a heading, swaps the level, and takes it off', () => {
    expect(applyLineFormat('Garden {}plan', 'heading-1')).toBe('# Garden plan')
    expect(applyLineFormat('# Garden {}plan', 'heading-2')).toBe('## Garden plan')
    expect(applyLineFormat('## Garden {}plan', 'heading-2')).toBe('Garden plan')
  })

  it('makes every selected line a list item and skips blank lines', () => {
    expect(applyLineFormat('{Seeds\n\nCompost\nStakes}', 'bulleted-list')).toBe('- Seeds\n\n- Compost\n- Stakes')
    expect(applyLineFormat('{Seeds\nCompost\nStakes}', 'numbered-list')).toBe('1. Seeds\n2. Compost\n3. Stakes')
  })

  it('replaces one list kind with another and keeps indents', () => {
    expect(applyLineFormat('{- Seeds\n  - Compost}', 'checklist')).toBe('- [ ] Seeds\n  - [ ] Compost')
    expect(applyLineFormat('{- [x] Seeds\n- [ ] Compost}', 'checklist')).toBe('Seeds\nCompost')
    expect(applyLineFormat('{1. Seeds\n2) Compost}', 'bulleted-list')).toBe('- Seeds\n- Compost')
  })

  it('quotes lines and unquotes them', () => {
    expect(applyLineFormat('{Water early.\nMulch.}', 'quote')).toBe('> Water early.\n> Mulch.')
    expect(applyLineFormat('{> Water early.\n> Mulch.}', 'quote')).toBe('Water early.\nMulch.')
  })

  it('leaves out a line the selection only touches at its very start', () => {
    expect(applyLineFormat('{Seeds\n}Compost', 'bulleted-list')).toBe('- Seeds\nCompost')
  })

  it('reports the format all selected lines share', () => {
    expect(findPapelizLineMarkdownFormatOfSelection('- a\n- b', 0, 6)).toBe('bulleted-list')
    expect(findPapelizLineMarkdownFormatOfSelection('- a\n1. b', 0, 7)).toBeNull()
    expect(findPapelizLineMarkdownFormatOfSelection('#### Deep', 2, 2)).toBeNull()
  })
})
