import { describe, expect, it } from 'vitest'
import { createPapelizHtmlExportHeadingIdMaker } from './papeliz-html-export-heading-ids'

describe('exported heading ids', () => {
  it('are lower case with hyphens and no punctuation, as GitHub writes them', () => {
    const makeHeadingId = createPapelizHtmlExportHeadingIdMaker()
    expect(makeHeadingId('Launch plan')).toBe('launch-plan')
    expect(makeHeadingId('What’s next? (Draft)')).toBe('whats-next-draft')
    expect(makeHeadingId('Café crème_2 -- notes')).toBe('café-crème_2----notes')
  })

  it('number repeats from 1, and skip an id a heading already took', () => {
    const makeHeadingId = createPapelizHtmlExportHeadingIdMaker()
    expect(['Notes', 'Notes', 'Notes-1', 'Notes'].map(makeHeadingId)).toEqual(['notes', 'notes-1', 'notes-1-1', 'notes-2'])
  })

  it('start again for each page', () => {
    expect(createPapelizHtmlExportHeadingIdMaker()('Notes')).toBe('notes')
    expect(createPapelizHtmlExportHeadingIdMaker()('Notes')).toBe('notes')
  })
})
