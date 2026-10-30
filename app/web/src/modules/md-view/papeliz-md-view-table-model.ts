import { GFM, parser as papelizMarkdownBaseParser, type MarkdownConfig } from '@lezer/markdown'
import { getPapelizWikilinkDisplayText, parsePapelizWikilinkInnerText } from '../links/papeliz-wikilink-targets'
import { papelizNoteEditorWikilinkSyntax } from '../note-editor/papeliz-note-editor-markdown-syntax'

// A GitHub-flavored Markdown table, read from its text for MD View to draw as a real table:
//
//   | Item | Cost |
//   | --- | ---: |
//   | [[Hiring|Two baristas]] | $4,400 |
//
// Cells split on `|` as on GitHub (`\|` is a pipe inside a cell), except that the `|` of a
// `[[wikilink|label]]` stays in its link. Each cell's text is read as inline Markdown.

export type PapelizMdViewTableColumnAlignment = 'left' | 'center' | 'right' | null

// One cell of a table row: its text, and where its trimmed text sits in the row's line.
export interface PapelizMarkdownTableRowCell {
  tableCellText: string
  tableCellSourceFrom: number
  tableCellSourceTo: number
}

export type PapelizMdViewInlineContent =
  | { inlineContentKind: 'text'; inlineText: string }
  | { inlineContentKind: 'inline-code'; inlineText: string }
  | { inlineContentKind: 'strong' | 'emphasis' | 'strikethrough'; inlineChildren: PapelizMdViewInlineContent[] }
  | { inlineContentKind: 'link'; linkHref: string; inlineChildren: PapelizMdViewInlineContent[] }
  | { inlineContentKind: 'wikilink'; wikilinkTargetNoteName: string; wikilinkDisplayText: string }

export interface PapelizMdViewTableModel {
  tableColumnAlignments: PapelizMdViewTableColumnAlignment[]
  // Every row has exactly one cell per column, as on GitHub: missing cells are empty, extra ones dropped.
  tableHeaderCells: PapelizMdViewInlineContent[][]
  tableBodyRows: PapelizMdViewInlineContent[][][]
}

const papelizTableDelimiterCellPattern = /^:?-+:?$/

function findWikilinkEnd(tableRowText: string, wikilinkStart: number): number {
  const wikilinkCloseIndex = tableRowText.indexOf(']]', wikilinkStart + 2)
  if (wikilinkCloseIndex <= wikilinkStart + 2 || tableRowText.slice(wikilinkStart + 2, wikilinkCloseIndex).includes('[')) return -1
  return wikilinkCloseIndex + 2
}

export function splitPapelizMarkdownTableRow(tableRowText: string): PapelizMarkdownTableRowCell[] {
  // First the stretches between the pipes that split cells, with `\|` read as a pipe.
  const rowSegments: Array<{ segmentText: string; segmentRawFrom: number; segmentRawTo: number }> = []
  let segmentText = ''
  let segmentRawFrom = 0
  for (let characterIndex = 0; characterIndex < tableRowText.length; characterIndex += 1) {
    const rowCharacter = tableRowText.charAt(characterIndex)
    if (rowCharacter === '\\' && characterIndex + 1 < tableRowText.length) {
      const escapedCharacter = tableRowText.charAt(characterIndex + 1)
      // `\|` is a pipe in the cell; other escapes stay for the inline Markdown.
      segmentText += escapedCharacter === '|' ? '|' : `\\${escapedCharacter}`
      characterIndex += 1
      continue
    }
    if (tableRowText.startsWith('[[', characterIndex)) {
      const wikilinkEnd = findWikilinkEnd(tableRowText, characterIndex)
      if (wikilinkEnd !== -1) {
        segmentText += tableRowText.slice(characterIndex, wikilinkEnd).replace(/\\\|/g, '|')
        characterIndex = wikilinkEnd - 1
        continue
      }
    }
    if (rowCharacter === '|') {
      rowSegments.push({ segmentText, segmentRawFrom, segmentRawTo: characterIndex })
      segmentText = ''
      segmentRawFrom = characterIndex + 1
      continue
    }
    segmentText += rowCharacter
  }
  rowSegments.push({ segmentText, segmentRawFrom, segmentRawTo: tableRowText.length })

  // A pipe at the start or the end of the row only frames the cells.
  if (rowSegments.length > 1 && rowSegments[0]?.segmentText.trim() === '') rowSegments.shift()
  if (rowSegments.length > 1 && rowSegments[rowSegments.length - 1]?.segmentText.trim() === '') rowSegments.pop()
  else if (rowSegments.length === 1 && tableRowText.includes('|') && rowSegments[0]?.segmentText.trim() === '') rowSegments.pop()

  return rowSegments.map(({ segmentText: rowSegmentText, segmentRawFrom: rowSegmentRawFrom, segmentRawTo: rowSegmentRawTo }) => {
    const rawSegmentText = tableRowText.slice(rowSegmentRawFrom, rowSegmentRawTo)
    const tableCellSourceFrom = rowSegmentRawFrom + rawSegmentText.length - rawSegmentText.trimStart().length
    return {
      tableCellText: rowSegmentText.trim(),
      tableCellSourceFrom,
      tableCellSourceTo: tableCellSourceFrom + rawSegmentText.trim().length,
    }
  })
}

const papelizCodeFenceLinePattern = /^ {0,3}(`{3,}|~{3,})(.*)$/

// For a parser that splits cells as GitHub does (the locked page's): the `|` of a wikilink in a table
// row is written `\|`, so that parser keeps the link in one cell too. Code blocks stay as they are.
export function escapePapelizWikilinkPipesInTableRows(vaultNoteText: string): string {
  if (!vaultNoteText.includes('[[')) return vaultNoteText
  let openCodeFence: string | null = null
  return vaultNoteText
    .split('\n')
    .map((noteLine) => {
      const codeFenceMatch = papelizCodeFenceLinePattern.exec(noteLine)
      if (codeFenceMatch !== null) {
        const codeFence = codeFenceMatch[1] ?? ''
        if (openCodeFence === null) openCodeFence = codeFence
        else if (codeFence.charAt(0) === openCodeFence.charAt(0) && codeFence.length >= openCodeFence.length && (codeFenceMatch[2] ?? '').trim() === '') openCodeFence = null
        return noteLine
      }
      if (openCodeFence !== null || !/^\s*\|/.test(noteLine)) return noteLine
      return noteLine.replace(
        /\[\[([^[\]\n]+)\]\]/g,
        (_wikilinkText, wikilinkInnerText: string) => `[[${wikilinkInnerText.replace(/\\?\|/g, (pipeText) => (pipeText.length === 2 ? pipeText : '\\|'))}]]`,
      )
    })
    .join('\n')
}

export function readPapelizMarkdownTableColumnAlignment(delimiterCellText: string): PapelizMdViewTableColumnAlignment {
  const trimmedDelimiterCellText = delimiterCellText.trim()
  const startsWithColon = trimmedDelimiterCellText.startsWith(':')
  const endsWithColon = trimmedDelimiterCellText.endsWith(':') && trimmedDelimiterCellText.length > 1
  if (startsWithColon && endsWithColon) return 'center'
  if (endsWithColon) return 'right'
  if (startsWithColon) return 'left'
  return null
}

// The cell's text as the only paragraph of a document, so a cell such as `# 1` or `- none` is read
// as inline text, never as a heading or a list.
const papelizMdViewTableCellInlineSyntax: MarkdownConfig = {
  parseBlock: [
    {
      name: 'PapelizMdViewTableCellText',
      before: 'LinkReference',
      parse(blockContext, markdownLine) {
        const tableCellTextFrom = blockContext.lineStart
        blockContext.addElement(
          blockContext.elt(
            'Paragraph',
            tableCellTextFrom,
            tableCellTextFrom + markdownLine.text.length,
            blockContext.parser.parseInline(markdownLine.text, tableCellTextFrom),
          ),
        )
        blockContext.nextLine()
        return true
      },
    },
  ],
}

const papelizMdViewTableCellParser = papelizMarkdownBaseParser.configure([GFM, papelizNoteEditorWikilinkSyntax, papelizMdViewTableCellInlineSyntax])

type PapelizMdViewTableCellSyntaxNode = ReturnType<typeof papelizMdViewTableCellParser.parse>['topNode']

const papelizMdViewHiddenInlineMarkNodeNames = new Set(['EmphasisMark', 'StrikethroughMark', 'CodeMark', 'LinkMark', 'PapelizWikilinkMark', 'HTMLTag', 'Comment'])

function readInlineContentBetween(
  parentSyntaxNode: PapelizMdViewTableCellSyntaxNode,
  contentFrom: number,
  contentTo: number,
  tableCellText: string,
): PapelizMdViewInlineContent[] {
  const inlineContents: PapelizMdViewInlineContent[] = []
  const appendText = (appendedText: string) => {
    const previousInlineContent = inlineContents[inlineContents.length - 1]
    if (previousInlineContent?.inlineContentKind === 'text') previousInlineContent.inlineText += appendedText
    else inlineContents.push({ inlineContentKind: 'text', inlineText: appendedText })
  }
  let plainTextFrom = contentFrom
  const pushPlainText = (plainTextTo: number) => {
    if (plainTextTo > plainTextFrom) appendText(tableCellText.slice(plainTextFrom, plainTextTo))
  }
  for (let childSyntaxNode = parentSyntaxNode.firstChild; childSyntaxNode !== null; childSyntaxNode = childSyntaxNode.nextSibling) {
    if (childSyntaxNode.to <= contentFrom || childSyntaxNode.from >= contentTo) continue
    pushPlainText(childSyntaxNode.from)
    plainTextFrom = childSyntaxNode.to
    const { name: childNodeName, from: childFrom, to: childTo } = childSyntaxNode
    if (papelizMdViewHiddenInlineMarkNodeNames.has(childNodeName)) continue
    switch (childNodeName) {
      case 'Escape': {
        appendText(tableCellText.slice(childFrom + 1, childTo))
        break
      }
      case 'StrongEmphasis':
      case 'Emphasis':
      case 'Strikethrough': {
        const emphasisMarkNodes = childSyntaxNode.getChildren(childNodeName === 'Strikethrough' ? 'StrikethroughMark' : 'EmphasisMark')
        const openingMarkNode = emphasisMarkNodes[0]
        const closingMarkNode = emphasisMarkNodes[emphasisMarkNodes.length - 1]
        inlineContents.push({
          inlineContentKind: childNodeName === 'StrongEmphasis' ? 'strong' : childNodeName === 'Emphasis' ? 'emphasis' : 'strikethrough',
          inlineChildren: readInlineContentBetween(childSyntaxNode, openingMarkNode?.to ?? childFrom, closingMarkNode?.from ?? childTo, tableCellText),
        })
        break
      }
      case 'InlineCode': {
        const codeMarkNodes = childSyntaxNode.getChildren('CodeMark')
        const inlineCodeText = tableCellText.slice(codeMarkNodes[0]?.to ?? childFrom, codeMarkNodes[codeMarkNodes.length - 1]?.from ?? childTo)
        // As on GitHub: one space just inside each backtick is padding.
        const isPaddedInlineCode = inlineCodeText.length > 2 && inlineCodeText.startsWith(' ') && inlineCodeText.endsWith(' ') && inlineCodeText.trim().length > 0
        inlineContents.push({ inlineContentKind: 'inline-code', inlineText: isPaddedInlineCode ? inlineCodeText.slice(1, -1) : inlineCodeText })
        break
      }
      case 'Link':
      case 'Autolink': {
        const linkUrlNode = childSyntaxNode.getChild('URL')
        const linkMarkNodes = childSyntaxNode.getChildren('LinkMark')
        if (linkUrlNode === null) {
          // A reference link with no URL here stays as its text.
          appendText(tableCellText.slice(childFrom, childTo))
          break
        }
        const linkHref = tableCellText.slice(linkUrlNode.from, linkUrlNode.to)
        inlineContents.push({
          inlineContentKind: 'link',
          linkHref,
          inlineChildren:
            childNodeName === 'Autolink'
              ? [{ inlineContentKind: 'text', inlineText: linkHref }]
              : readInlineContentBetween(childSyntaxNode, linkMarkNodes[0]?.to ?? childFrom, linkMarkNodes[1]?.from ?? childTo, tableCellText),
        })
        break
      }
      case 'URL': {
        const bareUrlText = tableCellText.slice(childFrom, childTo)
        inlineContents.push({
          inlineContentKind: 'link',
          linkHref: /^www\./i.test(bareUrlText) ? `https://${bareUrlText}` : bareUrlText,
          inlineChildren: [{ inlineContentKind: 'text', inlineText: bareUrlText }],
        })
        break
      }
      case 'Image': {
        // An image in a table shows its description.
        const imageMarkNodes = childSyntaxNode.getChildren('LinkMark')
        appendText(tableCellText.slice(imageMarkNodes[0]?.to ?? childFrom, imageMarkNodes[1]?.from ?? childTo))
        break
      }
      case 'PapelizWikilink': {
        const wikilinkParts = parsePapelizWikilinkInnerText(tableCellText.slice(childFrom + 2, childTo - 2))
        inlineContents.push({
          inlineContentKind: 'wikilink',
          wikilinkTargetNoteName: wikilinkParts.wikilinkTargetNoteName,
          wikilinkDisplayText: getPapelizWikilinkDisplayText(wikilinkParts),
        })
        break
      }
      default: {
        plainTextFrom = childFrom
        break
      }
    }
  }
  pushPlainText(contentTo)
  return inlineContents
}

export function parsePapelizMdViewInlineMarkdown(tableCellText: string): PapelizMdViewInlineContent[] {
  if (tableCellText.length === 0) return []
  const tableCellParagraphNode = papelizMdViewTableCellParser.parse(tableCellText).topNode.firstChild
  if (tableCellParagraphNode === null) return [{ inlineContentKind: 'text', inlineText: tableCellText }]
  return readInlineContentBetween(tableCellParagraphNode, 0, tableCellText.length, tableCellText)
}

function fitTableRowToColumns(tableRowCells: readonly PapelizMarkdownTableRowCell[], tableColumnCount: number): PapelizMdViewInlineContent[][] {
  return Array.from({ length: tableColumnCount }, (_unusedValue, tableColumnIndex) =>
    parsePapelizMdViewInlineMarkdown(tableRowCells[tableColumnIndex]?.tableCellText ?? ''),
  )
}

// Null when the text is not a table: a header row, then a delimiter row such as `| --- | :-: |`.
export function parsePapelizMarkdownTable(tableMarkdownText: string): PapelizMdViewTableModel | null {
  const [tableHeaderLine, tableDelimiterLine, ...tableBodyLines] = tableMarkdownText.split('\n')
  if (tableHeaderLine === undefined || tableDelimiterLine === undefined) return null
  const tableDelimiterCells = splitPapelizMarkdownTableRow(tableDelimiterLine)
  if (tableDelimiterCells.length === 0 || !tableDelimiterCells.every((delimiterCell) => papelizTableDelimiterCellPattern.test(delimiterCell.tableCellText))) {
    return null
  }
  const tableHeaderRowCells = splitPapelizMarkdownTableRow(tableHeaderLine)
  const tableColumnCount = tableHeaderRowCells.length
  return {
    tableColumnAlignments: Array.from({ length: tableColumnCount }, (_unusedValue, tableColumnIndex) =>
      readPapelizMarkdownTableColumnAlignment(tableDelimiterCells[tableColumnIndex]?.tableCellText ?? ''),
    ),
    tableHeaderCells: fitTableRowToColumns(tableHeaderRowCells, tableColumnCount),
    tableBodyRows: tableBodyLines.map((tableBodyLine) => fitTableRowToColumns(splitPapelizMarkdownTableRow(tableBodyLine), tableColumnCount)),
  }
}

// MD View draws the visible tables again on every cursor move, so each table's text is read once.
const papelizMdViewTableModelsByMarkdownText = new Map<string, PapelizMdViewTableModel | null>()
const papelizMdViewTableModelCacheLimit = 64

export function readPapelizMdViewTableModel(tableMarkdownText: string): PapelizMdViewTableModel | null {
  if (papelizMdViewTableModelsByMarkdownText.has(tableMarkdownText)) return papelizMdViewTableModelsByMarkdownText.get(tableMarkdownText) ?? null
  const tableModel = parsePapelizMarkdownTable(tableMarkdownText)
  if (papelizMdViewTableModelsByMarkdownText.size >= papelizMdViewTableModelCacheLimit) {
    const oldestTableMarkdownText = papelizMdViewTableModelsByMarkdownText.keys().next().value
    if (oldestTableMarkdownText !== undefined) papelizMdViewTableModelsByMarkdownText.delete(oldestTableMarkdownText)
  }
  papelizMdViewTableModelsByMarkdownText.set(tableMarkdownText, tableModel)
  return tableModel
}

export function collectPapelizMdViewTableWikilinkTargets(tableModel: PapelizMdViewTableModel): string[] {
  const wikilinkTargetNoteNames: string[] = []
  const collectFromInlineContents = (inlineContents: readonly PapelizMdViewInlineContent[]) => {
    for (const inlineContent of inlineContents) {
      if (inlineContent.inlineContentKind === 'wikilink') wikilinkTargetNoteNames.push(inlineContent.wikilinkTargetNoteName)
      else if ('inlineChildren' in inlineContent) collectFromInlineContents(inlineContent.inlineChildren)
    }
  }
  for (const tableRow of [tableModel.tableHeaderCells, ...tableModel.tableBodyRows]) {
    for (const tableCellContents of tableRow) collectFromInlineContents(tableCellContents)
  }
  return wikilinkTargetNoteNames
}
