import { describe, expect, it } from 'vitest'
import {
  changePapelizNoteCalloutCard,
  findPapelizNoteCalloutCard,
  insertPapelizNoteCallout,
  removePapelizNoteCalloutCard,
  type PapelizNoteCalloutColor,
  type PapelizNoteCalloutKind,
} from './papeliz-note-callout-cards'

// Inserts a callout at the selection marked `{…}` and returns the new text with the resulting
// selection marked the same way.
function insertCallout(noteTextWithSelection: string, calloutKind: PapelizNoteCalloutKind, calloutColor: PapelizNoteCalloutColor | null = null): string {
  const selectionFrom = noteTextWithSelection.indexOf('{')
  const selectionTo = noteTextWithSelection.indexOf('}') - 1
  const noteText = noteTextWithSelection.replace('{', '').replace('}', '')
  const calloutResult = insertPapelizNoteCallout(noteText, selectionFrom, selectionTo, calloutKind, calloutColor)
  let changedNoteText = noteText
  for (const textChange of calloutResult.textChanges) {
    changedNoteText = changedNoteText.slice(0, textChange.changeFrom) + textChange.insertedText + changedNoteText.slice(textChange.changeTo)
  }
  return (
    changedNoteText.slice(0, calloutResult.formattedSelectionFrom) +
    '{' +
    changedNoteText.slice(calloutResult.formattedSelectionFrom, calloutResult.formattedSelectionTo) +
    '}' +
    changedNoteText.slice(calloutResult.formattedSelectionTo)
  )
}

describe('callout cards', () => {
  it('turns a blank line into a new card with its title selected', () => {
    expect(insertCallout('Intro\n{}\nOutro', 'tip')).toBe('Intro\n> [!tip] {Title}\n> \n\nOutro')
  })

  it('adds a new card after a line with text, set apart by a blank line', () => {
    expect(insertCallout('Water ea{}rly.', 'warning')).toBe('Water early.\n\n> [!warning] {Title}\n> ')
  })

  it('wraps the selected lines into a card and waits on its first line', () => {
    expect(insertCallout('{When you are ready,\n\nopen a folder.}', 'note')).toBe('> [!note]{}\n> When you are ready,\n>\n> open a folder.')
  })

  it('writes a chosen color into the card, as Markdown apps read it', () => {
    expect(insertCallout('{}', 'note', 'purple')).toBe('> [!note|purple] {Title}\n> ')
  })

  it('keeps the next paragraph out of the card', () => {
    expect(insertCallout('{Careful here.}\nNext paragraph.', 'danger')).toBe('> [!danger]{}\n> Careful here.\n\nNext paragraph.')
  })
})

// Applies a card change at the cursor marked `{}` and returns the new text (without the mark).
function applyAtCursor(noteTextWithCursor: string, cardChange: (noteText: string, notePosition: number) => ReturnType<typeof removePapelizNoteCalloutCard>): string {
  const notePosition = noteTextWithCursor.indexOf('{}')
  const noteText = noteTextWithCursor.replace('{}', '')
  const cardResult = cardChange(noteText, notePosition)
  if (cardResult === null) return 'unchanged'
  let changedNoteText = noteText
  for (const textChange of [...cardResult.textChanges].sort((firstChange, secondChange) => secondChange.changeFrom - firstChange.changeFrom)) {
    changedNoteText = changedNoteText.slice(0, textChange.changeFrom) + textChange.insertedText + changedNoteText.slice(textChange.changeTo)
  }
  return changedNoteText
}

describe('the card the cursor is in', () => {
  const sampleNote = 'Intro\n\n> [!tip] Your own folder\n> When you are ready,\n> open a folder.\n\nOutro'

  it('finds the whole card from any of its lines, with its kind and color', () => {
    const calloutCard = findPapelizNoteCalloutCard('A\n> [!note|#7c3aed] Mine\n> Body', 20)
    expect(calloutCard).toMatchObject({ calloutKind: 'note', calloutColor: '#7c3aed', calloutCardFrom: 2 })
    expect(findPapelizNoteCalloutCard('> Just a quote', 3)).toBeNull()
    expect(findPapelizNoteCalloutCard('Plain line', 3)).toBeNull()
  })

  it('turns a card back into plain lines, keeping its title', () => {
    expect(applyAtCursor(sampleNote.replace('open a', 'open {}a'), removePapelizNoteCalloutCard)).toBe(
      'Intro\n\nYour own folder\nWhen you are ready,\nopen a folder.\n\nOutro',
    )
    expect(applyAtCursor('> [!warning]\n> Care{}ful.', removePapelizNoteCalloutCard)).toBe('Careful.')
    expect(applyAtCursor('Plain{} line', removePapelizNoteCalloutCard)).toBe('unchanged')
  })

  it('changes the kind or color of the card', () => {
    expect(applyAtCursor(sampleNote.replace('When', '{}When'), (noteText, notePosition) => changePapelizNoteCalloutCard(noteText, notePosition, 'warning'))).toBe(
      sampleNote.replace('[!tip]', '[!warning]'),
    )
    expect(applyAtCursor('> [!note]{} Mine', (noteText, notePosition) => changePapelizNoteCalloutCard(noteText, notePosition, 'note', 'purple'))).toBe(
      '> [!note|purple] Mine',
    )
  })
})
