import { describe, expect, it } from 'vitest'
import { createPapelizWikilinkTargetResolver, getPapelizWikilinkDisplayText, parsePapelizWikilinkInnerText } from './papeliz-wikilink-targets'

const resolveWikilinkTarget = createPapelizWikilinkTargetResolver([
  'Start here.md',
  'Guides/Callouts.md',
  'Projects/Garden plan.md',
  'Projects/Reading list.md',
  'Archive/Reading list.md',
])

describe('wikilinks', () => {
  it('splits a link into note, heading and label', () => {
    expect(parsePapelizWikilinkInnerText('Garden plan#To do|the to-do list')).toEqual({
      wikilinkTargetNoteName: 'Garden plan',
      wikilinkTargetHeading: 'To do',
      wikilinkLabel: 'the to-do list',
    })
    expect(parsePapelizWikilinkInnerText('Callouts\\|a label')).toMatchObject({ wikilinkTargetNoteName: 'Callouts', wikilinkLabel: 'a label' })
    expect(getPapelizWikilinkDisplayText(parsePapelizWikilinkInnerText('Guides/Callouts'))).toBe('Callouts')
    expect(getPapelizWikilinkDisplayText(parsePapelizWikilinkInnerText('Callouts#Tips'))).toBe('Callouts › Tips')
  })

  it('finds a note by name, by path, and without caring about case', () => {
    expect(resolveWikilinkTarget('Callouts', null)).toBe('Guides/Callouts.md')
    expect(resolveWikilinkTarget('guides/callouts', null)).toBe('Guides/Callouts.md')
    expect(resolveWikilinkTarget('Start here.md', null)).toBe('Start here.md')
  })

  it('prefers the note next to the linking note when two share a name', () => {
    expect(resolveWikilinkTarget('Reading list', 'Projects/Garden plan.md')).toBe('Projects/Reading list.md')
    expect(resolveWikilinkTarget('Reading list', 'Archive/Old.md')).toBe('Archive/Reading list.md')
  })

  it('returns null for a note that does not exist yet', () => {
    expect(resolveWikilinkTarget('An idea for later', null)).toBeNull()
  })
})
