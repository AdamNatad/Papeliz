import {
  AlignmentType,
  BorderStyle,
  Footer,
  LevelFormat,
  LineRuleType,
  PageNumber,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
  convertMillimetersToTwip,
  type INumberingOptions,
  type ISectionPropertiesOptions,
  type IStylesOptions,
} from 'docx'
import {
  papelizExportBodyLineHeight,
  papelizExportBodyTextSizePoints,
  papelizExportFooterDistanceFromPageEdgeMillimeters,
  papelizExportFooterTextSizePoints,
  papelizExportPageMarginsInMillimeters,
  papelizExportPageSizesInPoints,
  papelizExportPrintColorsByToken,
  papelizExportPrintLineHeights,
  papelizExportPrintSpacingInPoints,
  papelizExportPrintTextSizesInPoints,
  type PapelizExportPageSize,
  type PapelizExportPrintColorToken,
} from '../export-print-style/papeliz-export-print-style'
import type { PapelizNoteFontFamily } from '../workspace/papeliz-note-typography-store'

// A Word file's styles, lists, page and footer, from the shared print values. Headings are Word's own
// Heading 1–6 with outline levels, so Word's navigation pane and Google Docs' outline list them.
// Fonts are named, not embedded: Google Docs has Figtree and JetBrains Mono, and Word uses its own
// font where one isn't installed. The file stays editable either way.

// Characters a Word file's XML can't hold: control characters (except tab and line breaks), lone
// surrogates and U+FFFE/U+FFFF.
const papelizDocxExportUnwritableCharacterPattern = /[^\t\n\r -퟿-�\u{10000}-\u{10FFFF}]/gu

export function removePapelizDocxExportUnwritableCharacters(docxExportText: string): string {
  return docxExportText.replace(papelizDocxExportUnwritableCharacterPattern, '')
}

// Word measures text in half points, spacing and indents in twentieths of a point (twips), line
// spacing in 240ths of a line and borders in eighths of a point.
export function toDocxHalfPoints(printPoints: number): number {
  return Math.round(printPoints * 2)
}

export function toDocxTwips(printPoints: number): number {
  return Math.round(printPoints * 20)
}

export function fromDocxTwips(docxTwips: number): number {
  return docxTwips / 20
}

function toDocxLineSpacing(printLineHeight: number): number {
  return Math.round(printLineHeight * 240)
}

// Word draws borders from 1/4 pt (2 eighths) up.
export function toDocxBorderEighthPoints(printPoints: number): number {
  return Math.max(2, Math.round(printPoints * 8))
}

// "#0064d4" -> "0064D4"
export function toDocxHexColor(printColor: string): string {
  return printColor.replace(/^#/, '').toUpperCase()
}

export function getDocxExportPrintColor(papelizColorToken: PapelizExportPrintColorToken): string {
  return toDocxHexColor(papelizExportPrintColorsByToken[papelizColorToken])
}

const papelizDocxExportNoteFontNamesByFamily: Readonly<Record<PapelizNoteFontFamily, string>> = {
  sans: 'Figtree',
  // Windows, macOS and Google Docs all have Georgia.
  serif: 'Georgia',
  mono: 'JetBrains Mono',
}

export const papelizDocxExportCodeFontName = 'JetBrains Mono'

export const papelizDocxExportCodeCharacterStyleId = 'PapelizCode'
export const papelizDocxExportCodeBlockParagraphStyleId = 'PapelizCodeBlock'
export const papelizDocxExportHyperlinkCharacterStyleId = 'Hyperlink'
export const papelizDocxExportFootnoteTextParagraphStyleId = 'FootnoteText'
const papelizDocxExportFooterParagraphStyleId = 'PapelizFooter'

export const papelizDocxExportHeadingLevelCount = 6

export function getPapelizDocxExportHeadingTextSizePoints(headingLevel: number): number {
  if (headingLevel === 1) return papelizExportPrintTextSizesInPoints.heading1TextSizePoints
  if (headingLevel === 2) return papelizExportPrintTextSizesInPoints.heading2TextSizePoints
  if (headingLevel === 3) return papelizExportPrintTextSizesInPoints.heading3TextSizePoints
  return papelizExportPrintTextSizesInPoints.heading4To6TextSizePoints
}

function describePapelizDocxExportHeadingStyle(headingLevel: number): NonNullable<NonNullable<IStylesOptions['default']>['heading1']> {
  const { heading1LineHeight, heading2LineHeight, heading3LineHeight } = papelizExportPrintLineHeights
  const spacing = papelizExportPrintSpacingInPoints
  const [spaceAbovePoints, spaceBelowPoints, headingLineHeight] =
    headingLevel === 1
      ? [0, spacing.heading1SpaceBelowPoints, heading1LineHeight]
      : headingLevel === 2
        ? [spacing.heading2SpaceAbovePoints, spacing.heading2SpaceBelowPoints, heading2LineHeight]
        : headingLevel === 3
          ? [spacing.heading3SpaceAbovePoints, spacing.heading3SpaceBelowPoints, heading3LineHeight]
          : [spacing.heading4To6SpaceAbovePoints, spacing.heading4To6SpaceBelowPoints, heading3LineHeight]
  return {
    run: {
      size: toDocxHalfPoints(getPapelizDocxExportHeadingTextSizePoints(headingLevel)),
      // MD View's first heading is Medium (500), which Word can't name; the others are SemiBold.
      bold: headingLevel !== 1,
      color: getDocxExportPrintColor('--color-papeliz-ink'),
    },
    paragraph: {
      outlineLevel: headingLevel - 1,
      keepNext: true,
      keepLines: true,
      spacing: { before: toDocxTwips(spaceAbovePoints), after: toDocxTwips(spaceBelowPoints), line: toDocxLineSpacing(headingLineHeight), lineRule: LineRuleType.AUTO },
    },
  }
}

export function buildPapelizDocxExportStyles(noteFontFamily: PapelizNoteFontFamily, noteLanguageTag: string): IStylesOptions {
  const { codeBlockPaddingHorizontalPoints, codeBlockPaddingVerticalPoints, hairlineWidthPoints } = papelizExportPrintSpacingInPoints
  const codeBlockBorder = {
    style: BorderStyle.SINGLE,
    color: getDocxExportPrintColor('--color-papeliz-line'),
    size: toDocxBorderEighthPoints(hairlineWidthPoints),
  }
  return {
    default: {
      document: {
        run: {
          font: papelizDocxExportNoteFontNamesByFamily[noteFontFamily],
          size: toDocxHalfPoints(papelizExportBodyTextSizePoints),
          color: getDocxExportPrintColor('--color-papeliz-ink'),
          // Spelling and grammar checks use the note's language.
          language: { value: noteLanguageTag },
        },
        paragraph: {
          spacing: { after: toDocxTwips(papelizExportPrintSpacingInPoints.paragraphSpaceBelowPoints), line: toDocxLineSpacing(papelizExportBodyLineHeight), lineRule: LineRuleType.AUTO },
        },
      },
      heading1: describePapelizDocxExportHeadingStyle(1),
      heading2: describePapelizDocxExportHeadingStyle(2),
      heading3: describePapelizDocxExportHeadingStyle(3),
      heading4: describePapelizDocxExportHeadingStyle(4),
      heading5: describePapelizDocxExportHeadingStyle(5),
      heading6: describePapelizDocxExportHeadingStyle(6),
      // MD View's links: blue, without an underline.
      hyperlink: { run: { color: getDocxExportPrintColor('--color-papeliz-blue') } },
      // MD View's footnotes: smaller and muted, with blue references.
      footnoteText: {
        run: { size: toDocxHalfPoints(papelizExportPrintTextSizesInPoints.footnotesTextSizePoints), color: getDocxExportPrintColor('--color-papeliz-ink-muted') },
        paragraph: { spacing: { after: 0, line: toDocxLineSpacing(1.4), lineRule: LineRuleType.AUTO } },
      },
      footnoteReference: { run: { superScript: true, color: getDocxExportPrintColor('--color-papeliz-blue') } },
    },
    characterStyles: [
      {
        id: papelizDocxExportCodeCharacterStyleId,
        name: 'Papeliz Code',
        basedOn: 'DefaultParagraphFont',
        run: {
          font: papelizDocxExportCodeFontName,
          shading: { fill: getDocxExportPrintColor('--color-papeliz-surface-gray') },
          noProof: true,
        },
      },
    ],
    paragraphStyles: [
      {
        id: papelizDocxExportCodeBlockParagraphStyleId,
        name: 'Papeliz Code Block',
        basedOn: 'Normal',
        run: {
          font: papelizDocxExportCodeFontName,
          size: toDocxHalfPoints(papelizExportPrintTextSizesInPoints.codeBlockTextSizePoints),
          noProof: true,
        },
        paragraph: {
          spacing: { before: 0, after: 0, line: toDocxLineSpacing(papelizExportPrintLineHeights.codeBlockLineHeight), lineRule: LineRuleType.AUTO },
          shading: { fill: getDocxExportPrintColor('--color-papeliz-surface-soft') },
          // Lines in a row share one box: Word joins paragraphs with the same borders.
          border: {
            top: { ...codeBlockBorder, space: Math.round(codeBlockPaddingVerticalPoints / 2) },
            bottom: { ...codeBlockBorder, space: Math.round(codeBlockPaddingVerticalPoints / 2) },
            left: { ...codeBlockBorder, space: Math.round(codeBlockPaddingHorizontalPoints / 2) },
            right: { ...codeBlockBorder, space: Math.round(codeBlockPaddingHorizontalPoints / 2) },
          },
          indent: { left: toDocxTwips(codeBlockPaddingHorizontalPoints / 2 + hairlineWidthPoints), right: toDocxTwips(codeBlockPaddingHorizontalPoints / 2 + hairlineWidthPoints) },
        },
      },
      {
        id: papelizDocxExportFooterParagraphStyleId,
        name: 'Papeliz Footer',
        basedOn: 'Normal',
        run: { size: toDocxHalfPoints(papelizExportFooterTextSizePoints), color: getDocxExportPrintColor('--color-papeliz-ink-subtle') },
        paragraph: { spacing: { before: 0, after: 0, line: 240, lineRule: LineRuleType.AUTO } },
      },
    ],
  }
}

// Bullets by depth, as MD View's lists go: •, ◦, ▪, then again.
const papelizDocxExportBulletCharacters = ['•', '◦', '▪'] as const
const papelizDocxExportListLevelCount = 9
export const papelizDocxExportBulletNumberingReference = 'papeliz-docx-export-bullets'

export function getPapelizDocxExportListLevelIndentTwips(listLevel: number): number {
  return toDocxTwips(papelizExportPrintSpacingInPoints.listIndentPoints * (listLevel + 1))
}

function describePapelizDocxExportListLevelIndent(listLevel: number) {
  return { indent: { left: getPapelizDocxExportListLevelIndentTwips(listLevel), hanging: toDocxTwips(papelizExportPrintSpacingInPoints.listIndentPoints) } }
}

// "papeliz-docx-export-numbers-from-3": a numbered list that counts from 3.
export function getPapelizDocxExportNumberedListReference(numberedListStart: number): string {
  return `papeliz-docx-export-numbers-from-${numberedListStart}`
}

// The bullet list, and one numbered list for each start a note's numbered lists use. Each Markdown
// list is its own Word list (an instance), so every list counts from its own start.
export function buildPapelizDocxExportNumbering(numberedListStarts: ReadonlySet<number>): INumberingOptions {
  const listLevelIndexes = Array.from({ length: papelizDocxExportListLevelCount }, (_unused, listLevel) => listLevel)
  return {
    config: [
      {
        reference: papelizDocxExportBulletNumberingReference,
        levels: listLevelIndexes.map((listLevel) => ({
          level: listLevel,
          format: LevelFormat.BULLET,
          text: papelizDocxExportBulletCharacters[listLevel % papelizDocxExportBulletCharacters.length],
          alignment: AlignmentType.LEFT,
          style: { paragraph: describePapelizDocxExportListLevelIndent(listLevel) },
        })),
      },
      ...[...numberedListStarts].map((numberedListStart) => ({
        reference: getPapelizDocxExportNumberedListReference(numberedListStart),
        levels: listLevelIndexes.map((listLevel) => ({
          level: listLevel,
          format: LevelFormat.DECIMAL,
          text: `%${listLevel + 1}.`,
          start: numberedListStart,
          alignment: AlignmentType.LEFT,
          style: { paragraph: describePapelizDocxExportListLevelIndent(listLevel) },
        })),
      })),
    ],
  }
}

// The page's text width, for the footer's right tab and tables at full width.
export function getPapelizDocxExportTextWidthTwips(docxExportPageSize: PapelizExportPageSize): number {
  const { leftMillimeters, rightMillimeters } = papelizExportPageMarginsInMillimeters
  return toDocxTwips(papelizExportPageSizesInPoints[docxExportPageSize].pageWidthPoints) - convertMillimetersToTwip(leftMillimeters) - convertMillimetersToTwip(rightMillimeters)
}

export function getPapelizDocxExportTextHeightTwips(docxExportPageSize: PapelizExportPageSize): number {
  const { topMillimeters, bottomMillimeters } = papelizExportPageMarginsInMillimeters
  return toDocxTwips(papelizExportPageSizesInPoints[docxExportPageSize].pageHeightPoints) - convertMillimetersToTwip(topMillimeters) - convertMillimetersToTwip(bottomMillimeters)
}

export function buildPapelizDocxExportPageProperties(docxExportPageSize: PapelizExportPageSize): ISectionPropertiesOptions {
  const { pageWidthPoints, pageHeightPoints } = papelizExportPageSizesInPoints[docxExportPageSize]
  const { topMillimeters, rightMillimeters, bottomMillimeters, leftMillimeters } = papelizExportPageMarginsInMillimeters
  return {
    page: {
      size: { width: toDocxTwips(pageWidthPoints), height: toDocxTwips(pageHeightPoints) },
      margin: {
        top: convertMillimetersToTwip(topMillimeters),
        right: convertMillimetersToTwip(rightMillimeters),
        bottom: convertMillimetersToTwip(bottomMillimeters),
        left: convertMillimetersToTwip(leftMillimeters),
        header: convertMillimetersToTwip(papelizExportFooterDistanceFromPageEdgeMillimeters),
        footer: convertMillimetersToTwip(papelizExportFooterDistanceFromPageEdgeMillimeters),
      },
    },
  }
}

// The note's name on the left; "2 / 9" on the right, as Word fields Word fills in.
export function buildPapelizDocxExportFooter(docxExportNoteName: string, docxExportPageSize: PapelizExportPageSize): Footer {
  return new Footer({
    children: [
      new Paragraph({
        style: papelizDocxExportFooterParagraphStyleId,
        tabStops: [{ type: TabStopType.RIGHT, position: getPapelizDocxExportTextWidthTwips(docxExportPageSize) }],
        children: [new TextRun({ text: docxExportNoteName }), new TextRun({ children: [new Tab(), PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES] })],
      }),
    ],
  })
}
