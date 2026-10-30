import { describe, expect, it } from 'vitest'
import {
  collectPapelizMdViewTableWikilinkTargets,
  escapePapelizWikilinkPipesInTableRows,
  parsePapelizMarkdownTable,
  parsePapelizMdViewInlineMarkdown,
  readPapelizMarkdownTableColumnAlignment,
  splitPapelizMarkdownTableRow,
} from './papeliz-md-view-table-model'

function readCellTexts(tableRowText: string): string[] {
  return splitPapelizMarkdownTableRow(tableRowText).map((tableRowCell) => tableRowCell.tableCellText)
}

describe('splitting a table row', () => {
  it('reads the cells between the pipes, with or without the outer pipes', () => {
    expect(readCellTexts('| Item | Cost |')).toEqual(['Item', 'Cost'])
    expect(readCellTexts('Item | Cost')).toEqual(['Item', 'Cost'])
    expect(readCellTexts('|  Counter and shelving  |$6,500|')).toEqual(['Counter and shelving', '$6,500'])
    expect(readCellTexts('| a | |')).toEqual(['a', ''])
  })

  it('keeps the pipe of a wikilink label in its cell, and reads \\| as a pipe', () => {
    expect(readCellTexts('| [[Hiring|Two part-time baristas]] | $4,400 |')).toEqual(['[[Hiring|Two part-time baristas]]', '$4,400'])
    expect(readCellTexts('| [[Callouts\\|a label]] | x |')).toEqual(['[[Callouts|a label]]', 'x'])
    expect(readCellTexts('| a \\| b | c |')).toEqual(['a | b', 'c'])
    // An unfinished wikilink does not swallow the rest of the row.
    expect(readCellTexts('| [[open | shut |')).toEqual(['[[open', 'shut'])
  })

  it('says where each cell sits in the row, for placing the cursor', () => {
    const tableRowText = '| Grinder | $1,400 |'
    const [firstCell, secondCell] = splitPapelizMarkdownTableRow(tableRowText)
    expect(tableRowText.slice(firstCell?.tableCellSourceFrom, firstCell?.tableCellSourceTo)).toBe('Grinder')
    expect(tableRowText.slice(secondCell?.tableCellSourceFrom, secondCell?.tableCellSourceTo)).toBe('$1,400')
  })
})

describe('reading a table', () => {
  it('reads the column alignment from the colons of the delimiter row', () => {
    expect(readPapelizMarkdownTableColumnAlignment(':---:')).toBe('center')
    expect(readPapelizMarkdownTableColumnAlignment('---:')).toBe('right')
    expect(readPapelizMarkdownTableColumnAlignment(':--')).toBe('left')
    expect(readPapelizMarkdownTableColumnAlignment('---')).toBeNull()
    expect(parsePapelizMarkdownTable('| a | b | c | d |\n| :-: | --: | :-- | --- |')?.tableColumnAlignments).toEqual(['center', 'right', 'left', null])
  })

  it('gives every row one cell per header column, as GitHub does', () => {
    const tableModel = parsePapelizMarkdownTable('| Item | Cost |\n| --- | --- |\n| Rent |\n| Beans | $2,100 | extra |')
    expect(tableModel?.tableHeaderCells).toHaveLength(2)
    expect(tableModel?.tableBodyRows.map((tableBodyRow) => tableBodyRow.length)).toEqual([2, 2])
    expect(tableModel?.tableBodyRows[0]?.[1]).toEqual([])
    expect(tableModel?.tableBodyRows[1]?.[1]).toEqual([{ inlineContentKind: 'text', inlineText: '$2,100' }])
  })

  it('is not a table without a delimiter row', () => {
    expect(parsePapelizMarkdownTable('| Item | Cost |')).toBeNull()
    expect(parsePapelizMarkdownTable('| Item | Cost |\n| Rent | $2,800 |')).toBeNull()
  })

  it('collects the notes its wikilinks point to', () => {
    const tableModel = parsePapelizMarkdownTable('| Who | Cost |\n| --- | --- |\n| [[Hiring|Two part-time baristas]] | **[[Budget]]** |')
    expect(tableModel === null ? [] : collectPapelizMdViewTableWikilinkTargets(tableModel)).toEqual(['Hiring', 'Budget'])
  })
})

describe('the inline Markdown of a cell', () => {
  it('reads bold, italics, strikethrough and code', () => {
    expect(parsePapelizMdViewInlineMarkdown('**Rent** and *milk*, ~~cake~~, `Ctrl+E`')).toEqual([
      { inlineContentKind: 'strong', inlineChildren: [{ inlineContentKind: 'text', inlineText: 'Rent' }] },
      { inlineContentKind: 'text', inlineText: ' and ' },
      { inlineContentKind: 'emphasis', inlineChildren: [{ inlineContentKind: 'text', inlineText: 'milk' }] },
      { inlineContentKind: 'text', inlineText: ', ' },
      { inlineContentKind: 'strikethrough', inlineChildren: [{ inlineContentKind: 'text', inlineText: 'cake' }] },
      { inlineContentKind: 'text', inlineText: ', ' },
      { inlineContentKind: 'inline-code', inlineText: 'Ctrl+E' },
    ])
  })

  it('reads links and web addresses', () => {
    expect(parsePapelizMdViewInlineMarkdown('[the site](https://example.com "Example")')).toEqual([
      { inlineContentKind: 'link', linkHref: 'https://example.com', inlineChildren: [{ inlineContentKind: 'text', inlineText: 'the site' }] },
    ])
    expect(parsePapelizMdViewInlineMarkdown('see https://example.com')).toEqual([
      { inlineContentKind: 'text', inlineText: 'see ' },
      { inlineContentKind: 'link', linkHref: 'https://example.com', inlineChildren: [{ inlineContentKind: 'text', inlineText: 'https://example.com' }] },
    ])
  })

  it('reads wikilinks with their label', () => {
    expect(parsePapelizMdViewInlineMarkdown('[[Hiring|Two part-time baristas]]')).toEqual([
      { inlineContentKind: 'wikilink', wikilinkTargetNoteName: 'Hiring', wikilinkDisplayText: 'Two part-time baristas' },
    ])
    expect(parsePapelizMdViewInlineMarkdown('[[Projects/Garden plan]]')).toEqual([
      { inlineContentKind: 'wikilink', wikilinkTargetNoteName: 'Projects/Garden plan', wikilinkDisplayText: 'Garden plan' },
    ])
  })

  it('keeps a cell that looks like a heading or a list as text, and drops raw HTML tags', () => {
    expect(parsePapelizMdViewInlineMarkdown('# 1')).toEqual([{ inlineContentKind: 'text', inlineText: '# 1' }])
    expect(parsePapelizMdViewInlineMarkdown('- none')).toEqual([{ inlineContentKind: 'text', inlineText: '- none' }])
    expect(parsePapelizMdViewInlineMarkdown('\\*not bold\\*')).toEqual([{ inlineContentKind: 'text', inlineText: '*not bold*' }])
    expect(parsePapelizMdViewInlineMarkdown('<u>early</u>')).toEqual([{ inlineContentKind: 'text', inlineText: 'early' }])
  })
})

describe('wikilink pipes for the locked page', () => {
  it('escapes the pipe of a wikilink in a table row only', () => {
    expect(escapePapelizWikilinkPipesInTableRows('| [[Hiring|Two baristas]] | $4,400 |')).toBe('| [[Hiring\\|Two baristas]] | $4,400 |')
    expect(escapePapelizWikilinkPipesInTableRows('| [[Callouts\\|a label]] | x |')).toBe('| [[Callouts\\|a label]] | x |')
    expect(escapePapelizWikilinkPipesInTableRows('See [[Hiring|the hiring plan]].')).toBe('See [[Hiring|the hiring plan]].')
  })

  it('leaves code blocks as they are', () => {
    const fencedNoteText = '```md\n| [[Hiring|Two baristas]] |\n```\n| [[Hiring|Two baristas]] |'
    expect(escapePapelizWikilinkPipesInTableRows(fencedNoteText)).toBe('```md\n| [[Hiring|Two baristas]] |\n```\n| [[Hiring\\|Two baristas]] |')
  })
})
