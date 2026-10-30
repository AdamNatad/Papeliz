import {
  AlignmentType,
  BorderStyle,
  LineRuleType,
  Paragraph,
  Table,
  TableBorders,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from 'docx'
import { papelizExportPrintSpacingInPoints, papelizExportPrintTextSizesInPoints } from '../export-print-style/papeliz-export-print-style'
import type { PapelizNoteFrontmatterProperty } from '../md-view/papeliz-note-frontmatter-properties'
import type { PapelizDocxExportBlock } from './papeliz-docx-export-document-from-hast'
import { getDocxExportPrintColor, removePapelizDocxExportUnwritableCharacters, toDocxBorderEighthPoints, toDocxHalfPoints, toDocxHexColor, toDocxTwips } from './papeliz-docx-export-styles'

// Tables in a Word file: the note's Markdown tables, its callout cards (one shaded cell each), and
// its properties above the note.

// Where a table goes: its width and how far it is indented (inside a list item).
export interface PapelizDocxExportTablePlacement {
  tableWidthTwips: number
  tableIndentTwips: number
}

export type PapelizDocxExportCellAlignment = 'left' | 'center' | 'right'

export interface PapelizDocxExportMarkdownTableCell {
  cellParagraphChildren: ParagraphChild[]
  cellAlignment: PapelizDocxExportCellAlignment | null
  // The cell's text length, for its column's share of the width.
  cellTextLength: number
  // A picture's column takes the largest share, and its line has single spacing.
  cellHasShownPicture: boolean
}

export interface PapelizDocxExportMarkdownTableRow {
  isHeaderRow: boolean
  markdownTableCells: PapelizDocxExportMarkdownTableCell[]
}

// A column takes a share of the width by its longest cell, between these numbers of characters.
const papelizDocxExportTableColumnShortestShare = 4
const papelizDocxExportTableColumnLongestShare = 40

const papelizDocxExportCellAlignmentTypes: Readonly<Record<PapelizDocxExportCellAlignment, (typeof AlignmentType)[keyof typeof AlignmentType]>> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
}

function describeTablePlacement(tablePlacement: PapelizDocxExportTablePlacement) {
  return {
    width: { size: tablePlacement.tableWidthTwips, type: WidthType.DXA },
    ...(tablePlacement.tableIndentTwips > 0 ? { indent: { size: tablePlacement.tableIndentTwips, type: WidthType.DXA } } : {}),
    layout: TableLayoutType.FIXED,
  }
}

// Column widths that add up to the table's width, each by its share.
function shareTableWidth(tableWidthTwips: number, columnShares: readonly number[]): number[] {
  const columnShareTotal = columnShares.reduce((shareTotal, columnShare) => shareTotal + columnShare, 0)
  const columnWidthsTwips = columnShares.map((columnShare) => Math.floor((tableWidthTwips * columnShare) / columnShareTotal))
  const lastColumnIndex = columnWidthsTwips.length - 1
  columnWidthsTwips[lastColumnIndex] = (columnWidthsTwips[lastColumnIndex] ?? 0) + tableWidthTwips - columnWidthsTwips.reduce((widthTotal, columnWidthTwips) => widthTotal + columnWidthTwips, 0)
  return columnWidthsTwips
}

// A Markdown table as MD View draws it: a thin line around it and under each row, the header row
// shaded and repeated at the top of each page, rows that never split across pages, and each
// column aligned as its delimiter row says.
export function buildPapelizDocxExportMarkdownTable(markdownTableRows: readonly PapelizDocxExportMarkdownTableRow[], tablePlacement: PapelizDocxExportTablePlacement): Table {
  const tableColumnCount = Math.max(1, ...markdownTableRows.map((markdownTableRow) => markdownTableRow.markdownTableCells.length))
  const columnShares = Array.from({ length: tableColumnCount }, (_unused, tableColumnIndex) =>
    Math.min(
      papelizDocxExportTableColumnLongestShare,
      Math.max(
        papelizDocxExportTableColumnShortestShare,
        ...markdownTableRows.map((markdownTableRow) => {
          const markdownTableCell = markdownTableRow.markdownTableCells[tableColumnIndex]
          return markdownTableCell?.cellHasShownPicture === true ? papelizDocxExportTableColumnLongestShare : (markdownTableCell?.cellTextLength ?? 0)
        }),
      ),
    ),
  )
  const columnWidthsTwips = shareTableWidth(tablePlacement.tableWidthTwips, columnShares)
  const tableLine = { style: BorderStyle.SINGLE, color: getDocxExportPrintColor('--color-papeliz-line'), size: toDocxBorderEighthPoints(papelizExportPrintSpacingInPoints.hairlineWidthPoints) }
  const noTableLine = { style: BorderStyle.NONE, size: 0, color: 'auto' }
  // MD View's cells: 9 × 14 px of padding.
  const cellPaddingVerticalTwips = toDocxTwips(papelizExportPrintSpacingInPoints.tableCellPaddingVerticalPoints)
  const cellPaddingHorizontalTwips = toDocxTwips(papelizExportPrintSpacingInPoints.tableCellPaddingHorizontalPoints)
  return new Table({
    ...describeTablePlacement(tablePlacement),
    columnWidths: columnWidthsTwips,
    borders: { top: tableLine, bottom: tableLine, left: tableLine, right: tableLine, insideHorizontal: tableLine, insideVertical: noTableLine },
    margins: { top: cellPaddingVerticalTwips, bottom: cellPaddingVerticalTwips, left: cellPaddingHorizontalTwips, right: cellPaddingHorizontalTwips },
    rows: markdownTableRows.map(
      (markdownTableRow) =>
        new TableRow({
          cantSplit: true,
          ...(markdownTableRow.isHeaderRow ? { tableHeader: true } : {}),
          children: columnWidthsTwips.map((columnWidthTwips, tableColumnIndex) => {
            const markdownTableCell = markdownTableRow.markdownTableCells[tableColumnIndex]
            const cellAlignment = markdownTableCell?.cellAlignment ?? null
            return new TableCell({
              width: { size: columnWidthTwips, type: WidthType.DXA },
              ...(markdownTableRow.isHeaderRow ? { shading: { fill: getDocxExportPrintColor('--color-papeliz-surface-soft') } } : {}),
              children: [
                new Paragraph({
                  children: markdownTableCell?.cellParagraphChildren ?? [],
                  spacing: { before: 0, after: 0, ...(markdownTableCell?.cellHasShownPicture === true ? { line: 240, lineRule: LineRuleType.AUTO } : {}) },
                  ...(cellAlignment === null ? {} : { alignment: papelizDocxExportCellAlignmentTypes[cellAlignment] }),
                }),
              ],
            })
          }),
        }),
    ),
  })
}

export interface PapelizDocxExportCalloutCardOptions {
  // A print color, "#eaf2fe".
  calloutGroundColor: string
  calloutCellChildren: Array<Paragraph | Table>
  tablePlacement: PapelizDocxExportTablePlacement
}

// A callout as a card: one cell in the callout's ground color, with no lines around it, so its
// title, lists and code keep their shape inside.
export function buildPapelizDocxExportCalloutCard({ calloutGroundColor, calloutCellChildren, tablePlacement }: PapelizDocxExportCalloutCardOptions): Table {
  const calloutPaddingVerticalTwips = toDocxTwips(papelizExportPrintSpacingInPoints.calloutPaddingVerticalPoints)
  const calloutPaddingHorizontalTwips = toDocxTwips(papelizExportPrintSpacingInPoints.calloutPaddingHorizontalPoints)
  return new Table({
    ...describeTablePlacement(tablePlacement),
    columnWidths: [tablePlacement.tableWidthTwips],
    borders: TableBorders.NONE,
    margins: { top: calloutPaddingVerticalTwips, bottom: calloutPaddingVerticalTwips, left: calloutPaddingHorizontalTwips, right: calloutPaddingHorizontalTwips },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: tablePlacement.tableWidthTwips, type: WidthType.DXA },
            shading: { fill: toDocxHexColor(calloutGroundColor) },
            // Word needs a paragraph at the end of a cell.
            children: calloutCellChildren.at(-1) instanceof Paragraph ? calloutCellChildren : [...calloutCellChildren, createPapelizDocxExportGapParagraph(0)],
          }),
        ],
      }),
    ],
  })
}

// An empty line of exactly this height: the space MD View leaves after a block, and the paragraph
// Word needs between two tables (two tables in a row would join into one).
export function createPapelizDocxExportGapParagraph(gapPoints: number): Paragraph {
  return new Paragraph(describePapelizDocxExportGapParagraph(gapPoints))
}

export function describePapelizDocxExportGapParagraph(gapPoints: number) {
  return { spacing: { before: 0, after: 0, line: Math.max(20, toDocxTwips(gapPoints)), lineRule: LineRuleType.EXACT }, run: { size: 2 } }
}

// The properties column never takes more than this share of the text width.
const papelizDocxExportPropertyNameColumnLargestShare = 0.4
const papelizDocxExportPropertyNameColumnSmallestTwips = 1440
// A rough width of one character of the properties' text, for the name column.
const papelizDocxExportPropertyCharacterWidthTwips = 100

// The properties as a small table without borders: the property's name in bold, then its values.
// It ends with MD View's space below the chips.
export function buildPapelizDocxExportPropertiesBlocks(noteFrontmatterProperties: readonly PapelizNoteFrontmatterProperty[], docxExportTextWidthTwips: number): PapelizDocxExportBlock[] {
  const longestPropertyNameLength = Math.max(...noteFrontmatterProperties.map((noteFrontmatterProperty) => noteFrontmatterProperty.frontmatterPropertyName.length))
  const propertyNameColumnTwips = Math.round(
    Math.min(
      docxExportTextWidthTwips * papelizDocxExportPropertyNameColumnLargestShare,
      Math.max(papelizDocxExportPropertyNameColumnSmallestTwips, longestPropertyNameLength * papelizDocxExportPropertyCharacterWidthTwips + 360),
    ),
  )
  const propertyValuesColumnTwips = docxExportTextWidthTwips - propertyNameColumnTwips
  const propertyTextSize = toDocxHalfPoints(papelizExportPrintTextSizesInPoints.propertyTextSizePoints)
  const propertyCellParagraphSpacing = { before: 0, after: 0, line: Math.round(1.4 * 240), lineRule: LineRuleType.AUTO }
  const propertiesTable = new Table({
    width: { size: docxExportTextWidthTwips, type: WidthType.DXA },
    columnWidths: [propertyNameColumnTwips, propertyValuesColumnTwips],
    layout: TableLayoutType.FIXED,
    borders: TableBorders.NONE,
    margins: { top: 20, bottom: 20, left: 0, right: 120 },
    rows: noteFrontmatterProperties.map(
      (noteFrontmatterProperty) =>
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: propertyNameColumnTwips, type: WidthType.DXA },
              children: [
                new Paragraph({
                  spacing: propertyCellParagraphSpacing,
                  children: [
                    new TextRun({
                      text: removePapelizDocxExportUnwritableCharacters(noteFrontmatterProperty.frontmatterPropertyName),
                      bold: true,
                      size: propertyTextSize,
                      color: getDocxExportPrintColor('--color-papeliz-ink'),
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: propertyValuesColumnTwips, type: WidthType.DXA },
              children: [
                new Paragraph({
                  spacing: propertyCellParagraphSpacing,
                  children: [
                    new TextRun({
                      text: removePapelizDocxExportUnwritableCharacters(noteFrontmatterProperty.frontmatterPropertyValues.join(', ')),
                      size: propertyTextSize,
                      color: getDocxExportPrintColor('--color-papeliz-ink-muted'),
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
    ),
  })
  return [{ docxExportTable: propertiesTable }, { docxExportParagraphOptions: describePapelizDocxExportGapParagraph(papelizExportPrintSpacingInPoints.propertiesSpaceBelowPoints) }]
}
