import { describe, expect, it } from 'vitest'
import { findPapelizInlineMarkdownFormatWrap, togglePapelizInlineMarkdownFormat, type PapelizInlineMarkdownFormat } from './papeliz-note-inline-formatting'

// Applies a format to the first `[selected]` stretch of `noteTextWithSelection` and gives back the
// new text with the resulting selection marked the same way.
function applyFormat(noteTextWithSelection: string, inlineMarkdownFormat: PapelizInlineMarkdownFormat): string {
  const selectionFrom = noteTextWithSelection.indexOf('{')
  const selectionTo = noteTextWithSelection.indexOf('}') - 1
  const noteText = noteTextWithSelection.replace('{', '').replace('}', '')
  const formatResult = togglePapelizInlineMarkdownFormat(noteText, selectionFrom, selectionTo, inlineMarkdownFormat)
  let formattedNoteText = noteText
  for (const textChange of [...formatResult.textChanges].sort((firstChange, secondChange) => secondChange.changeFrom - firstChange.changeFrom)) {
    formattedNoteText = formattedNoteText.slice(0, textChange.changeFrom) + textChange.insertedText + formattedNoteText.slice(textChange.changeTo)
  }
  return (
    formattedNoteText.slice(0, formatResult.formattedSelectionFrom) +
    '{' +
    formattedNoteText.slice(formatResult.formattedSelectionFrom, formatResult.formattedSelectionTo) +
    '}' +
    formattedNoteText.slice(formatResult.formattedSelectionTo)
  )
}

describe('inline formatting of a selection', () => {
  it('underlines with <u> tags and takes them off again', () => {
    expect(applyFormat('Plant {tomatoes} early.', 'underline')).toBe('Plant <u>{tomatoes}</u> early.')
    expect(applyFormat('Plant <u>{tomatoes}</u> early.', 'underline')).toBe('Plant {tomatoes} early.')
    expect(applyFormat('Plant {<u>tomatoes</u>} early.', 'underline')).toBe('Plant {tomatoes} early.')
  })

  it('wraps and unwraps bold, keeping the words selected', () => {
    expect(applyFormat('Plant {tomatoes} early.', 'bold')).toBe('Plant **{tomatoes}** early.')
    expect(applyFormat('Plant **{tomatoes}** early.', 'bold')).toBe('Plant {tomatoes} early.')
    expect(applyFormat('Plant {**tomatoes**} early.', 'bold')).toBe('Plant {tomatoes} early.')
  })

  it('leaves the spaces at the ends of a selection outside the markers', () => {
    expect(applyFormat('Plant{ tomatoes }early.', 'italic')).toBe('Plant *{tomatoes}* early.')
  })

  it('tells italic and bold apart, and stacks them', () => {
    expect(applyFormat('**{tomatoes}**', 'italic')).toBe('***{tomatoes}***')
    expect(applyFormat('***{tomatoes}***', 'italic')).toBe('**{tomatoes}**')
    expect(applyFormat('***{tomatoes}***', 'bold')).toBe('*{tomatoes}*')
    expect(applyFormat('*{tomatoes}*', 'italic')).toBe('{tomatoes}')
  })

  it('handles strikethrough and inline code', () => {
    expect(applyFormat('{done}', 'strikethrough')).toBe('~~{done}~~')
    expect(applyFormat('~~{done}~~', 'strikethrough')).toBe('{done}')
    expect(applyFormat('Run {pnpm test} now', 'inline-code')).toBe('Run `{pnpm test}` now')
    expect(applyFormat('Run `{pnpm test}` now', 'inline-code')).toBe('Run {pnpm test} now')
  })

  it('makes and removes a wikilink', () => {
    expect(applyFormat('See {Garden plan} for beds.', 'wikilink')).toBe('See [[{Garden plan}]] for beds.')
    expect(applyFormat('See [[{Garden plan}]] for beds.', 'wikilink')).toBe('See {Garden plan} for beds.')
    expect(applyFormat('See {[[Garden plan]]} for beds.', 'wikilink')).toBe('See {Garden plan} for beds.')
  })

  it('makes a link with its address selected, and removes it again', () => {
    expect(applyFormat('Read {the guide} first.', 'link')).toBe('Read [the guide]({url}) first.')
    expect(applyFormat('Read [{the guide}](https://example.com/guide) first.', 'link')).toBe('Read {the guide} first.')
  })

  it('places the cursor between new markers when nothing is selected', () => {
    expect(applyFormat('Plant {} early.', 'bold')).toBe('Plant **{}** early.')
    expect(applyFormat('Plant **{}** early.', 'bold')).toBe('Plant {} early.')
  })

  it('reports which formats are already on', () => {
    expect(findPapelizInlineMarkdownFormatWrap('a **b** c', 4, 5, 'bold')).not.toBeNull()
    expect(findPapelizInlineMarkdownFormatWrap('a **b** c', 4, 5, 'italic')).toBeNull()
    expect(findPapelizInlineMarkdownFormatWrap('a *b* c', 3, 4, 'italic')).not.toBeNull()
    expect(findPapelizInlineMarkdownFormatWrap('a b c', 2, 3, 'wikilink')).toBeNull()
  })
})
