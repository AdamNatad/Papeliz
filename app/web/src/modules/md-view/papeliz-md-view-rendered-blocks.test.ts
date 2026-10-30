import { GFM, parser as papelizMarkdownBaseParser } from '@lezer/markdown'
import { describe, expect, it } from 'vitest'
import { papelizNoteEditorFrontmatterSyntax, papelizNoteEditorWikilinkSyntax } from '../note-editor/papeliz-note-editor-markdown-syntax'
import { findPapelizMdViewRenderedBlocks } from './papeliz-md-view-rendered-blocks'

// The note editor's Markdown, as far as tables and code blocks go.
const papelizTestMarkdownParser = papelizMarkdownBaseParser.configure([GFM, papelizNoteEditorFrontmatterSyntax, papelizNoteEditorWikilinkSyntax])

function findRenderedBlocks(vaultNoteText: string) {
  return findPapelizMdViewRenderedBlocks(papelizTestMarkdownParser.parse(vaultNoteText), (textFrom, textTo) => vaultNoteText.slice(textFrom, textTo))
}

describe('finding the blocks MD View draws', () => {
  it('finds a table, with the text of all its rows', () => {
    const vaultNoteText = '# Budget\n\n| Item | Cost |\n| --- | --- |\n| Rent | $2,800 |\n\nAfter.'
    const [tableBlock, ...otherBlocks] = findRenderedBlocks(vaultNoteText)
    expect(otherBlocks).toEqual([])
    expect(tableBlock?.renderedBlockKind).toBe('table')
    expect(vaultNoteText.slice(tableBlock?.renderedBlockFrom, tableBlock?.renderedBlockTo)).toBe('| Item | Cost |\n| --- | --- |\n| Rent | $2,800 |')
  })

  it('finds ```mermaid and ~~~mermaid blocks, with their source', () => {
    const vaultNoteText = 'Plan:\n\n```mermaid\nflowchart LR\n  A --> B\n```\n\n~~~ Mermaid title\ngraph TD\n~~~\n'
    expect(findRenderedBlocks(vaultNoteText)).toEqual([
      { renderedBlockKind: 'mermaid-diagram', renderedBlockFrom: 7, renderedBlockTo: 44, mermaidDiagramSource: 'flowchart LR\n  A --> B' },
      { renderedBlockKind: 'mermaid-diagram', renderedBlockFrom: 46, renderedBlockTo: 76, mermaidDiagramSource: 'graph TD' },
    ])
  })

  it('reads an empty or unclosed mermaid block', () => {
    expect(findRenderedBlocks('```mermaid\n```')).toMatchObject([{ renderedBlockKind: 'mermaid-diagram', mermaidDiagramSource: '' }])
    expect(findRenderedBlocks('```mermaid\npie\n  "A" : 1')).toMatchObject([{ renderedBlockKind: 'mermaid-diagram', mermaidDiagramSource: 'pie\n  "A" : 1' }])
  })

  it('leaves other code, and blocks inside quotes or lists, alone', () => {
    expect(findRenderedBlocks('```js\nconst a = 1\n```\n\n```\nflowchart LR\n```\n\n```mermaidish\nx\n```')).toEqual([])
    expect(findRenderedBlocks('> | a | b |\n> | - | - |\n\n- item\n\n  ```mermaid\n  graph TD\n  ```')).toEqual([])
  })

  it('does not take a table-looking frontmatter or a row without a delimiter for a table', () => {
    expect(findRenderedBlocks('---\ntags: [a]\n---\n| not | a table |\nhere')).toEqual([])
  })
})
