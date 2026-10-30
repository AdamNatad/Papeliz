import type { PapelizNoteFontFamily } from '../workspace/papeliz-note-typography-store'

// A note as the PDF worker receives it: plain data, built on the main thread from the sanitized tree
// MD View's locked page draws (papeliz-pdf-export-note-document-from-hast.ts). Colors are print
// colors already; sizes are relative to the block, whose own size the layout takes from the print
// style. Nothing in it can run, and it holds only what the PDF shows.

export interface PapelizPdfExportTextRunChip {
  // MD View's ground behind inline code, a tag or a picture's line.
  chipGroundColor: string
  // In ems of the run's own text size.
  chipPaddingHorizontalEm: number
  chipPaddingVerticalEm: number
  chipCornerRadiusEm: number
  // A tag's chip has a fixed height; null fits the text.
  chipHeightEm: number | null
}

export interface PapelizPdfExportTextRunUnderline {
  // null: the text's own color.
  underlineColor: string | null
  isUnderlineDashed: boolean
}

export interface PapelizPdfExportTextRunLook {
  // 600 for bold, 500 for links and tags; null keeps the block's weight (a heading's).
  textRunFontWeight: 400 | 500 | 600 | null
  isTextRunItalic: boolean
  // Inline code, in JetBrains Mono.
  isTextRunMonospace: boolean
  // "#rrggbb"; null keeps the block's color.
  textRunColor: string | null
  // Times the block's text size (0.86 for inline code, a styled size); a tag's size is fixed instead.
  textRunSizeRatio: number
  textRunFixedSizePoints: number | null
  textRunUnderline: PapelizPdfExportTextRunUnderline | null
  isTextRunStruck: boolean
  textRunBaselineShift: 'superscript' | 'subscript' | null
  textRunChip: PapelizPdfExportTextRunChip | null
}

// Where a link leads: a checked web address, or a named place in this PDF (a heading, a footnote, a
// footnote's reference). Links to other notes carry no link: a PDF reader doesn't reliably open
// another file, and Papeliz writes no action that opens files.
export type PapelizPdfExportLinkTarget = { linkTargetKind: 'web'; webLinkAddress: string } | { linkTargetKind: 'note-place'; noteDestinationName: string }

export interface PapelizPdfExportTextRunLink {
  // One per link in the note, so the runs of one link (a bold word inside it) stay one link.
  noteLinkNumber: number
  noteLinkTarget: PapelizPdfExportLinkTarget
  // What a screen reader says for it.
  noteLinkDescription: string
}

// The drawn pictures a line can hold in place of text.
export type PapelizPdfExportInlineIconName = 'footnote-back-arrow'

export type PapelizPdfExportInlineRun =
  | {
      inlineRunKind: 'text'
      textRunText: string
      textRunLook: PapelizPdfExportTextRunLook
      textRunLink: PapelizPdfExportTextRunLink | null
      // A named place at the run's start (a footnote's reference, which its footnote links back to).
      textRunDestinationName: string | null
    }
  | { inlineRunKind: 'icon'; inlineIconName: PapelizPdfExportInlineIconName; textRunLook: PapelizPdfExportTextRunLook; textRunLink: PapelizPdfExportTextRunLink | null }
  | { inlineRunKind: 'line-break' }

export type PapelizPdfExportHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export type PapelizPdfExportListKind = 'bullet' | 'numbered' | 'task'

export interface PapelizPdfExportListItem {
  listItemBlocks: PapelizPdfExportNoteBlock[]
  // A task's box; null in a bullet or numbered list, and for an item of a task list without a box.
  listItemTaskState: 'to-do' | 'done' | null
}

export interface PapelizPdfExportNoteProperty {
  notePropertyName: string
  // "export, test"
  notePropertyValuesText: string
}

export interface PapelizPdfExportFootnote {
  footnoteNumber: number
  footnoteDestinationName: string
  footnoteBlocks: PapelizPdfExportNoteBlock[]
}

export type PapelizPdfExportNoteBlock =
  | {
      noteBlockKind: 'heading'
      headingLevel: PapelizPdfExportHeadingLevel
      headingId: string
      // Where links to the heading and its bookmark land; null for a heading without an id.
      headingDestinationName: string | null
      headingInlineRuns: PapelizPdfExportInlineRun[]
    }
  | {
      noteBlockKind: 'paragraph'
      paragraphInlineRuns: PapelizPdfExportInlineRun[]
      paragraphTextColor: string | null
      // A `<p>` has MD View's paragraph gap below it; the text of a tight list item has none.
      hasParagraphSpacing: boolean
    }
  // Monospace text in MD View's code box: a code block, or a block the PDF doesn't draw yet, as its
  // Markdown source, so nothing is left out.
  | { noteBlockKind: 'code-box'; codeBoxText: string }
  | { noteBlockKind: 'list'; listKind: PapelizPdfExportListKind; listStartNumber: number; listItems: PapelizPdfExportListItem[] }
  | { noteBlockKind: 'quote'; quoteBlocks: PapelizPdfExportNoteBlock[] }
  | { noteBlockKind: 'rule' }
  // The note's properties (its frontmatter) as MD View's chips, above the note.
  | { noteBlockKind: 'properties'; noteProperties: PapelizPdfExportNoteProperty[] }
  // The footnotes at the note's end, each with its number and a way back to its reference.
  | { noteBlockKind: 'footnotes'; noteFootnotes: PapelizPdfExportFootnote[] }

export interface PapelizPdfExportNoteDocument {
  noteFontFamily: PapelizNoteFontFamily
  noteBlocks: PapelizPdfExportNoteBlock[]
}

// Every block in reading order, the blocks inside lists, quotes and footnotes included.
export function visitPapelizPdfExportNoteBlocks(noteBlocks: readonly PapelizPdfExportNoteBlock[], visitNoteBlock: (noteBlock: PapelizPdfExportNoteBlock) => void): void {
  for (const noteBlock of noteBlocks) {
    visitNoteBlock(noteBlock)
    switch (noteBlock.noteBlockKind) {
      case 'list':
        for (const listItem of noteBlock.listItems) visitPapelizPdfExportNoteBlocks(listItem.listItemBlocks, visitNoteBlock)
        break
      case 'quote':
        visitPapelizPdfExportNoteBlocks(noteBlock.quoteBlocks, visitNoteBlock)
        break
      case 'footnotes':
        for (const noteFootnote of noteBlock.noteFootnotes) visitPapelizPdfExportNoteBlocks(noteFootnote.footnoteBlocks, visitNoteBlock)
        break
      default:
        break
    }
  }
}

// A heading's or a paragraph's runs; none for other blocks.
export function listPapelizPdfExportNoteBlockInlineRuns(noteBlock: PapelizPdfExportNoteBlock): PapelizPdfExportInlineRun[] {
  if (noteBlock.noteBlockKind === 'heading') return noteBlock.headingInlineRuns
  if (noteBlock.noteBlockKind === 'paragraph') return noteBlock.paragraphInlineRuns
  return []
}
