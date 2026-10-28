import { describe, expect, it } from 'vitest'
import {
  applyPapelizTextStyle,
  describePapelizTextStyleCss,
  findPapelizTextStyleAround,
  matchPapelizTextStyleOpenTag,
  type PapelizNoteTextStyle,
} from './papeliz-note-text-style'

// Applies a style change to the selection marked `{…}` and returns the new text with the resulting
// selection marked the same way.
function applyStyle(noteTextWithSelection: string, textStyleChange: Partial<PapelizNoteTextStyle>): string {
  const selectionFrom = noteTextWithSelection.indexOf('{')
  const selectionTo = noteTextWithSelection.indexOf('}') - 1
  const noteText = noteTextWithSelection.replace('{', '').replace('}', '')
  const styleResult = applyPapelizTextStyle(noteText, selectionFrom, selectionTo, textStyleChange)
  if (styleResult === null) return 'unchanged'
  let changedNoteText = noteText
  for (const textChange of [...styleResult.textChanges].sort((firstChange, secondChange) => secondChange.changeFrom - firstChange.changeFrom)) {
    changedNoteText = changedNoteText.slice(0, textChange.changeFrom) + textChange.insertedText + changedNoteText.slice(textChange.changeTo)
  }
  return (
    changedNoteText.slice(0, styleResult.formattedSelectionFrom) +
    '{' +
    changedNoteText.slice(styleResult.formattedSelectionFrom, styleResult.formattedSelectionTo) +
    '}' +
    changedNoteText.slice(styleResult.formattedSelectionTo)
  )
}

describe('text color and size', () => {
  it('colors the selection, keeping it selected', () => {
    expect(applyStyle('Plant {tomatoes} early.', { textColor: 'red' })).toBe('Plant <span style="color: red">{tomatoes}</span> early.')
    expect(applyStyle('# {Garden plan}', { textColor: '#7c3aed' })).toBe('# <span style="color: #7c3aed">{Garden plan}</span>')
  })

  it('styles the word under the cursor when nothing is selected', () => {
    expect(applyStyle('Plant toma{}toes early.', { textColor: 'green' })).toBe('Plant <span style="color: green">{tomatoes}</span> early.')
    expect(applyStyle('Plant toma{}toes early.', { textSize: '1.5em' })).toBe('Plant <span style="font-size: 1.5em">{tomatoes}</span> early.')
  })

  it('keeps color and size in one span, and changes or takes off each on its own', () => {
    expect(applyStyle('Plant <span style="color: red">tom{}atoes</span>.', { textSize: '1.25em' })).toBe(
      'Plant <span style="color: red; font-size: 1.25em">{tomatoes}</span>.',
    )
    expect(applyStyle('Plant <span style="color: red; font-size: 1.25em">{tomatoes}</span>.', { textColor: 'blue' })).toBe(
      'Plant <span style="color: blue; font-size: 1.25em">{tomatoes}</span>.',
    )
    expect(applyStyle('Plant <span style="color: red; font-size: 1.25em">{tomatoes}</span>.', { textColor: null })).toBe(
      'Plant <span style="font-size: 1.25em">{tomatoes}</span>.',
    )
    expect(applyStyle('Plant <span style="font-size: 1.25em">{tomatoes}</span>.', { textSize: null })).toBe('Plant {tomatoes}.')
    expect(applyStyle('Plant {tomatoes}.', { textColor: null })).toBe('unchanged')
  })

  it('gives each selected line its own span, with list, task, heading and quote markers outside', () => {
    expect(applyStyle('{Seeds\nCompost}', { textColor: 'teal' })).toBe('<span style="color: teal">{Seeds</span>\n<span style="color: teal">Compost}</span>')
    expect(applyStyle('{- [ ] Order seeds}', { textColor: 'red' })).toBe('- [ ] <span style="color: red">{Order seeds}</span>')
    expect(applyStyle('{## Garden plan}', { textSize: '2em' })).toBe('## <span style="font-size: 2em">{Garden plan}</span>')
    expect(applyStyle('{1. First\n- Second}', { textColor: 'green' })).toBe(
      '1. <span style="color: green">{First</span>\n- <span style="color: green">Second}</span>',
    )
    expect(applyStyle('{> [!tip] Your own folder}', { textColor: 'purple' })).toBe('> [!tip] <span style="color: purple">{Your own folder}</span>')
  })

  it('reads only its own exact opening tag', () => {
    expect(matchPapelizTextStyleOpenTag('<span style="color: purple">')).toEqual({ textColor: 'purple', textSize: null })
    expect(matchPapelizTextStyleOpenTag('<span style="font-size: 1.5em; color: #7C3AED">')).toEqual({ textColor: '#7c3aed', textSize: '1.5em' })
    expect(matchPapelizTextStyleOpenTag('<span style="color: red; background: url(x)">')).toBeNull()
    expect(matchPapelizTextStyleOpenTag('<span style="color: chartreuse">')).toBeNull()
    expect(matchPapelizTextStyleOpenTag('<span style="font-size: 40px">')).toBeNull()
    expect(matchPapelizTextStyleOpenTag('<span style="color: red; color: blue">')).toBeNull()
  })

  it('draws card colors in the theme shade, and reports the style around the cursor', () => {
    expect(describePapelizTextStyleCss({ textColor: 'purple', textSize: '1.25em' })).toBe('color: var(--color-papeliz-callout-purple-ink); font-size: 1.25em')
    expect(describePapelizTextStyleCss({ textColor: '#7c3aed', textSize: null })).toBe('color: #7c3aed')
    expect(findPapelizTextStyleAround('A <span style="font-size: 2em">big</span> word', 5, 6)).toEqual({ textColor: null, textSize: '2em' })
  })
})
