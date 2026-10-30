import type { syntaxTree } from '@codemirror/language'

// The blocks MD View draws in place of their Markdown when the cursor is elsewhere: GitHub-flavored
// tables and ```mermaid diagrams. Only blocks at the top level of the note count; one inside a quote
// or a list keeps its Markdown look.

type PapelizMdViewNoteSyntaxTree = ReturnType<typeof syntaxTree>

export type PapelizMdViewRenderedBlock =
  | { renderedBlockKind: 'table'; renderedBlockFrom: number; renderedBlockTo: number }
  | {
      renderedBlockKind: 'mermaid-diagram'
      renderedBlockFrom: number
      renderedBlockTo: number
      mermaidDiagramSource: string
    }

// ```mermaid, or ~~~mermaid, with anything after the word (a title) allowed.
const papelizMermaidFenceInfoPattern = /^mermaid(\s|$)/i

export function findPapelizMdViewRenderedBlocks(
  noteSyntaxTree: PapelizMdViewNoteSyntaxTree,
  readNoteText: (textFrom: number, textTo: number) => string,
): PapelizMdViewRenderedBlock[] {
  const renderedBlocks: PapelizMdViewRenderedBlock[] = []
  for (let topLevelNode = noteSyntaxTree.topNode.firstChild; topLevelNode !== null; topLevelNode = topLevelNode.nextSibling) {
    if (topLevelNode.name === 'Table') {
      renderedBlocks.push({ renderedBlockKind: 'table', renderedBlockFrom: topLevelNode.from, renderedBlockTo: topLevelNode.to })
      continue
    }
    if (topLevelNode.name !== 'FencedCode') continue
    const codeInfoNode = topLevelNode.getChild('CodeInfo')
    if (codeInfoNode === null || !papelizMermaidFenceInfoPattern.test(readNoteText(codeInfoNode.from, codeInfoNode.to).trim())) continue
    const codeTextNode = topLevelNode.getChild('CodeText')
    renderedBlocks.push({
      renderedBlockKind: 'mermaid-diagram',
      renderedBlockFrom: topLevelNode.from,
      renderedBlockTo: topLevelNode.to,
      mermaidDiagramSource: codeTextNode === null ? '' : readNoteText(codeTextNode.from, codeTextNode.to),
    })
  }
  return renderedBlocks
}
