import type { Element as HastElement, ElementContent as HastElementContent, Root as HastRoot } from 'hast'
import {
  AlignmentType,
  Bookmark,
  BorderStyle,
  ExternalHyperlink,
  FootnoteReferenceRun,
  HeadingLevel,
  ImageRun,
  InternalHyperlink,
  LineRuleType,
  Paragraph,
  Tab,
  Table,
  TextRun,
  UnderlineType,
  type IParagraphOptions,
  type ParagraphChild,
} from 'docx'
import { visit } from 'unist-util-visit'
import {
  getPapelizExportCalloutPrintColors,
  getPapelizExportPrintColor,
  papelizExportBodyTextSizePoints,
  papelizExportPrintSpacingInPoints,
  papelizExportPrintTextSizesInPoints,
} from '../export-print-style/papeliz-export-print-style'
import { createPapelizHtmlExportHeadingIdMaker } from '../html-export/papeliz-html-export-heading-ids'
import type { PapelizHtmlExportIconName } from '../html-export/papeliz-html-export-icons'
import { papelizHtmlExportCalloutIconNamesByKind } from '../html-export/papeliz-html-export-note-article'
import type { PapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { papelizMdViewCalloutBodyClassName, papelizMdViewCalloutClassName, papelizMdViewCalloutTitleClassName } from '../md-view/papeliz-remark-callouts'
import { papelizMdViewTagClassName } from '../md-view/papeliz-remark-tags'
import { papelizMdViewStyledTextClassName } from '../md-view/papeliz-remark-text-styles'
import { papelizMdViewUnresolvedWikilinkClassName } from '../md-view/papeliz-remark-wikilinks'
import { isPapelizTextColorValue, isPapelizTextSizeValue } from '../note-editor/papeliz-note-text-style'
import { parsePapelizHexColor } from '../ui/papeliz-color-values'
import {
  fitPapelizDocxExportPictureSizePoints,
  papelizDocxExportPictureHeightMarginPoints,
  papelizDocxExportPicturePixelsPerPoint,
  readPapelizDocxExportMermaidDiagramSource,
  type PapelizDocxExportMissingPicture,
  type PapelizDocxExportNotePicture,
  type PapelizDocxExportPicture,
  type PapelizDocxExportShownPicture,
} from './papeliz-docx-export-pictures'
import {
  fromDocxTwips,
  getDocxExportPrintColor,
  getPapelizDocxExportHeadingTextSizePoints,
  getPapelizDocxExportNumberedListReference,
  papelizDocxExportBulletNumberingReference,
  papelizDocxExportCodeBlockParagraphStyleId,
  papelizDocxExportCodeCharacterStyleId,
  papelizDocxExportFootnoteTextParagraphStyleId,
  papelizDocxExportHyperlinkCharacterStyleId,
  removePapelizDocxExportUnwritableCharacters,
  toDocxBorderEighthPoints,
  toDocxHalfPoints,
  toDocxHexColor,
  toDocxTwips,
} from './papeliz-docx-export-styles'
import {
  buildPapelizDocxExportCalloutCard,
  buildPapelizDocxExportMarkdownTable,
  describePapelizDocxExportGapParagraph,
  type PapelizDocxExportCellAlignment,
  type PapelizDocxExportMarkdownTableRow,
} from './papeliz-docx-export-tables'

// The sanitized tree MD View's locked page draws (`renderPapelizMdViewNote`), as Word paragraphs,
// runs, tables, links, bookmarks, footnotes and pictures. A Word file shows what MD View shows and
// can hold nothing the sanitizer removed: every run is built from the tree's text, every picture was
// prepared beforehand and is held in the file, and the only outside links are web links and, in a
// `.zip`, links to the other notes' files beside it.

// A body block before it becomes a `Paragraph`: its options can still change (a list's last item
// gets the list's space below), or a table built whole.
export type PapelizDocxExportBlock = { docxExportParagraphOptions: IParagraphOptions } | { docxExportTable: Table }

export interface PapelizDocxExportBody {
  docxExportBlocks: PapelizDocxExportBlock[]
  // The starts of the note's numbered lists ("3." for `3. item`), each a numbering definition.
  docxExportNumberedListStarts: Set<number>
  // Each heading's bookmark, by its GitHub-style id ("launch-plan").
  docxExportBookmarkNamesByHeadingId: Map<string, string>
}

export interface PapelizDocxExportBodyOptions {
  noteHastRoot: HastRoot
  // The text the Markdown parser read, for blocks shown as their source.
  noteParsedText: string
  vaultNoteRelativePath: string
  resolveWikilinkTarget: PapelizWikilinkTargetResolver
  // The link from this note's file to another note's file, or null when that note isn't exported with it.
  getDocxExportNoteFileHref: (targetVaultNoteRelativePath: string) => string | null
  docxExportTextWidthTwips: number
  docxExportTextHeightTwips: number
  // The callout icons, drawn before the walk, by getPapelizDocxExportCalloutIconKey.
  docxExportCalloutIconPictures: ReadonlyMap<string, PapelizDocxExportPicture>
  // The note's pictures and diagrams, prepared before the walk, by the element that shows each.
  docxExportNotePicturesByElement: ReadonlyMap<HastElement, PapelizDocxExportNotePicture>
}

// What a run's text looks like, passed down the tree as it is read.
interface PapelizDocxExportRunLook {
  isBold: boolean
  isItalic: boolean
  isStruck: boolean
  isUnderlined: boolean
  isDashedUnderlined: boolean
  isSuperscript: boolean
  isSubscript: boolean
  // A hex color without "#"; null for the paragraph's own color.
  runTextColor: string | null
  runShadingColor: string | null
  // An explicit size; null for the paragraph's own size.
  runTextSizePoints: number | null
  // The size of the text around the run, for sizes relative to it (inline code, styled text).
  surroundingTextSizePoints: number
  runCharacterStyleId: string | null
  // Word footnotes can't hold other footnotes or tables.
  isInsideFootnote: boolean
  // Word links can't hold other links.
  isInsideLink: boolean
  // The widest a picture in the run may be: its block's width, or its table column's.
  pictureRoomWidthTwips: number
  // A table row stays on one page, so its pictures are kept small.
  isInsideTableCell: boolean
}

// Where a block sits: inside lists and quotes it is indented and takes their color and size; inside
// a callout card its width is the card's.
interface PapelizDocxExportBlockPlace {
  blockIndentTwips: number
  // The width from the container's left edge, before the indent.
  blockWidthTwips: number
  quoteDepth: number
  listLevel: number
  blockTextColor: string | null
  blockTextSizePoints: number | null
  isInsideFootnote: boolean
}

const papelizDocxExportBlockTagNames: ReadonlySet<string> = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'details',
  'div',
  'dl',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'ol',
  'p',
  'pre',
  'section',
  'summary',
  'table',
  'ul',
])

const papelizDocxExportHeadingLevelsByTagName: ReadonlyMap<string, 1 | 2 | 3 | 4 | 5 | 6> = new Map([
  ['h1', 1],
  ['h2', 2],
  ['h3', 3],
  ['h4', 4],
  ['h5', 5],
  ['h6', 6],
])

const papelizDocxExportHeadingStyleIds = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6] as const

// A code block of this many lines or fewer stays on one page.
const papelizDocxExportKeptTogetherCodeLineCount = 12
// Word's own border widths include 2.25 pt, the closest to MD View's quote bar.
const papelizDocxExportQuoteBarWidthPoints = 2.25
const papelizDocxExportUncheckedTaskCharacter = '☐'
const papelizDocxExportCheckedTaskCharacter = '☑'
// Word bookmark names: at most 40 characters, letters, digits and "_"; a leading "_" hides them.
const papelizDocxExportBookmarkNameLength = 40
// In a table row or a footnote, a picture takes at most this share of the page's height.
const papelizDocxExportSmallPictureHeightShare = 1 / 3
// A paragraph that shows a picture has single line spacing: Word multiplies the tallest thing on a
// line, so 1.6 lines would open a gap above the picture.
const papelizDocxExportSingleLineSpacing = 240

function getHastStringProperty(hastElement: HastElement, hastPropertyName: string): string | null {
  const hastPropertyValue = hastElement.properties[hastPropertyName]
  return typeof hastPropertyValue === 'string' ? hastPropertyValue : null
}

function hasHastClassName(hastElement: HastElement, hastClassName: string): boolean {
  const hastClassNames = hastElement.properties['className']
  return Array.isArray(hastClassNames) && hastClassNames.includes(hastClassName)
}

function hasHastProperty(hastElement: HastElement, hastPropertyName: string): boolean {
  const hastPropertyValue = hastElement.properties[hastPropertyName]
  return hastPropertyValue !== undefined && hastPropertyValue !== null && hastPropertyValue !== false
}

function collectHastText(hastNode: HastElementContent | HastRoot): string {
  if (hastNode.type === 'text') return hastNode.value
  if (hastNode.type === 'element' || hastNode.type === 'root') return hastNode.children.map((hastChild) => collectHastText(hastChild as HastElementContent)).join('')
  return ''
}

function findHastChildElement(hastElement: HastElement, isWantedChildElement: (hastChildElement: HastElement) => boolean): HastElement | undefined {
  return hastElement.children.find((hastChild): hastChild is HastElement => hastChild.type === 'element' && isWantedChildElement(hastChild))
}

function isBlockHastNode(hastNode: HastElementContent): boolean {
  return hastNode.type === 'element' && papelizDocxExportBlockTagNames.has(hastNode.tagName)
}

function isWhitespaceHastText(hastNode: HastElementContent): boolean {
  return hastNode.type === 'text' && hastNode.value.trim().length === 0
}

function isExternalLinkHref(linkHref: string): boolean {
  return /^(https?:|mailto:)/i.test(linkHref)
}

function decodeLinkHrefPart(linkHrefPart: string): string {
  try {
    return decodeURIComponent(linkHrefPart)
  } catch {
    return linkHrefPart
  }
}

// "_h3_launch_plan": hidden in Word's bookmark list, unique by the heading's place in the note.
export function createPapelizDocxExportBookmarkName(headingNumber: number, headingId: string): string {
  const bookmarkNamePrefix = `_h${headingNumber}`
  const asciiHeadingId = headingId
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return (asciiHeadingId.length > 0 ? `${bookmarkNamePrefix}_${asciiHeadingId}` : bookmarkNamePrefix).slice(0, papelizDocxExportBookmarkNameLength)
}

// A styled text color (a card color's name or a hex), as MD View draws it on the light theme.
function readStyledTextColor(hastElement: HastElement): string | null {
  const textColorValue = getHastStringProperty(hastElement, 'dataPapelizTextColor')
  if (textColorValue === null || !isPapelizTextColorValue(textColorValue)) return null
  const hexTextColor = parsePapelizHexColor(textColorValue)
  if (hexTextColor !== null) return toDocxHexColor(hexTextColor)
  // A card color's name: its ink, as MD View draws styled text.
  const calloutInkPrintColor = getPapelizExportPrintColor(`--color-papeliz-callout-${textColorValue}-ink`)
  return calloutInkPrintColor === null ? null : toDocxHexColor(calloutInkPrintColor)
}

// "1.25em" of the text around it.
function readStyledTextSizePoints(hastElement: HastElement, surroundingTextSizePoints: number): number | null {
  const textSizeValue = getHastStringProperty(hastElement, 'dataPapelizTextSize')
  if (textSizeValue === null || !isPapelizTextSizeValue(textSizeValue)) return null
  return Number.parseFloat(textSizeValue) * surroundingTextSizePoints
}

function createDocxExportTextRun(runText: string, runLook: PapelizDocxExportRunLook): TextRun {
  const runTextParts = removePapelizDocxExportUnwritableCharacters(runText).split('\t')
  const runChildren: Array<string | Tab> = []
  runTextParts.forEach((runTextPart, runTextPartIndex) => {
    if (runTextPartIndex > 0) runChildren.push(new Tab())
    if (runTextPart.length > 0) runChildren.push(runTextPart)
  })
  return new TextRun({
    children: runChildren,
    ...(runLook.runCharacterStyleId === null ? {} : { style: runLook.runCharacterStyleId }),
    ...(runLook.isBold ? { bold: true } : {}),
    ...(runLook.isItalic ? { italics: true } : {}),
    ...(runLook.isStruck ? { strike: true } : {}),
    ...(runLook.isDashedUnderlined
      ? { underline: { type: UnderlineType.DASH, color: getDocxExportPrintColor('--color-papeliz-line-strong') } }
      : runLook.isUnderlined
        ? { underline: { type: UnderlineType.SINGLE } }
        : {}),
    ...(runLook.isSuperscript ? { superScript: true } : runLook.isSubscript ? { subScript: true } : {}),
    ...(runLook.runTextColor === null ? {} : { color: runLook.runTextColor }),
    ...(runLook.runShadingColor === null ? {} : { shading: { fill: runLook.runShadingColor } }),
    ...(runLook.runTextSizePoints === null ? {} : { size: toDocxHalfPoints(runLook.runTextSizePoints) }),
  })
}

interface PapelizDocxExportNoteWalk {
  bodyOptions: PapelizDocxExportBodyOptions
  headingIdsByElement: Map<HastElement, string>
  docxExportBookmarkNamesByHeadingId: Map<string, string>
  footnoteDefinitionsById: Map<string, HastElement>
  // Footnotes written as Word footnotes; any other stays at the end of the note.
  placedFootnoteIds: Set<string>
  docxExportNumberedListStarts: Set<number>
  nextDocxExportListInstance: number
  // Pictures placed so far, to name each ("Picture 3").
  placedPictureCount: number
}

function createRunLook(blockPlace: PapelizDocxExportBlockPlace, paragraphTextSizePoints: number): PapelizDocxExportRunLook {
  return {
    isBold: false,
    isItalic: false,
    isStruck: false,
    isUnderlined: false,
    isDashedUnderlined: false,
    isSuperscript: false,
    isSubscript: false,
    runTextColor: blockPlace.blockTextColor,
    runShadingColor: null,
    runTextSizePoints: blockPlace.blockTextSizePoints,
    surroundingTextSizePoints: blockPlace.blockTextSizePoints ?? paragraphTextSizePoints,
    runCharacterStyleId: null,
    isInsideFootnote: blockPlace.isInsideFootnote,
    isInsideLink: false,
    pictureRoomWidthTwips: blockPlace.blockWidthTwips - blockPlace.blockIndentTwips,
    isInsideTableCell: false,
  }
}

// Inline content as runs. Text keeps MD View's look; links lead to the web, to the note's own
// headings, and to the other notes' files beside it in a `.zip`.
function appendDocxExportInlineRuns(
  hastNodes: readonly HastElementContent[],
  runLook: PapelizDocxExportRunLook,
  noteWalk: PapelizDocxExportNoteWalk,
  paragraphChildren: ParagraphChild[],
): void {
  for (const hastNode of hastNodes) {
    if (hastNode.type === 'text') {
      // Line breaks inside a paragraph are spaces, as on MD View's page.
      const runText = hastNode.value.replace(/[ \t]*\n[ \t]*/g, ' ')
      if (runText.length > 0) paragraphChildren.push(createDocxExportTextRun(runText, runLook))
      continue
    }
    if (hastNode.type !== 'element') continue
    appendDocxExportInlineElement(hastNode, runLook, noteWalk, paragraphChildren)
  }
}

function appendDocxExportInlineElement(hastElement: HastElement, runLook: PapelizDocxExportRunLook, noteWalk: PapelizDocxExportNoteWalk, paragraphChildren: ParagraphChild[]): void {
  const appendChildren = (childRunLook: PapelizDocxExportRunLook) => appendDocxExportInlineRuns(hastElement.children, childRunLook, noteWalk, paragraphChildren)
  switch (hastElement.tagName) {
    case 'strong':
    case 'b':
      appendChildren({ ...runLook, isBold: true })
      return
    case 'em':
    case 'i':
      appendChildren({ ...runLook, isItalic: true })
      return
    case 'del':
    case 's':
      appendChildren({ ...runLook, isStruck: true })
      return
    case 'u':
      appendChildren({ ...runLook, isUnderlined: true })
      return
    case 'sup': {
      // A footnote's reference is a Word footnote, which Word numbers and raises itself.
      const footnoteReferenceRun = runLook.isInsideFootnote ? null : createDocxExportFootnoteReferenceRun(hastElement, noteWalk)
      if (footnoteReferenceRun !== null) paragraphChildren.push(footnoteReferenceRun)
      else appendChildren({ ...runLook, isSuperscript: true })
      return
    }
    case 'sub':
      appendChildren({ ...runLook, isSubscript: true })
      return
    case 'code':
    case 'kbd':
      appendChildren({
        ...runLook,
        runCharacterStyleId: papelizDocxExportCodeCharacterStyleId,
        runTextSizePoints: (runLook.runTextSizePoints ?? runLook.surroundingTextSizePoints) * papelizExportPrintTextSizesInPoints.inlineCodeTextSizeRatio,
      })
      return
    case 'br':
      paragraphChildren.push(new TextRun({ break: 1 }))
      return
    case 'input':
      // Task boxes are written at the start of their list item.
      return
    case 'img': {
      const notePicture = noteWalk.bodyOptions.docxExportNotePicturesByElement.get(hastElement)
      if (notePicture !== undefined) {
        appendDocxExportNotePicture(notePicture, runLook, noteWalk, paragraphChildren)
        return
      }
      // A picture MD View doesn't show either: its placeholder line.
      const pictureLabel = getHastStringProperty(hastElement, 'alt') || getHastStringProperty(hastElement, 'src') || 'untitled'
      paragraphChildren.push(createDocxExportTextRun(`Image: ${pictureLabel}`, createPicturePlaceholderRunLook(runLook)))
      return
    }
    case 'a':
      appendDocxExportLink(hastElement, runLook, noteWalk, paragraphChildren)
      return
    case 'span':
      if (hasHastClassName(hastElement, papelizMdViewTagClassName)) {
        // Word has no round chips: blue text on the chip's color.
        appendChildren({
          ...runLook,
          runTextColor: getDocxExportPrintColor('--color-papeliz-blue'),
          runShadingColor: getDocxExportPrintColor('--color-papeliz-blue-soft'),
          runTextSizePoints: papelizExportPrintTextSizesInPoints.tagTextSizePoints,
        })
        return
      }
      if (hasHastClassName(hastElement, papelizMdViewStyledTextClassName)) {
        const styledTextSizePoints = readStyledTextSizePoints(hastElement, runLook.runTextSizePoints ?? runLook.surroundingTextSizePoints)
        appendChildren({
          ...runLook,
          runTextColor: readStyledTextColor(hastElement) ?? runLook.runTextColor,
          ...(styledTextSizePoints === null ? {} : { runTextSizePoints: styledTextSizePoints, surroundingTextSizePoints: styledTextSizePoints }),
        })
        return
      }
      appendChildren(runLook)
      return
    default:
      appendChildren(runLook)
  }
}

// MD View's gray chip, for a picture shown as a line.
function createPicturePlaceholderRunLook(runLook: PapelizDocxExportRunLook): PapelizDocxExportRunLook {
  return {
    ...runLook,
    runTextColor: getDocxExportPrintColor('--color-papeliz-ink-muted'),
    runShadingColor: getDocxExportPrintColor('--color-papeliz-surface-gray'),
    runTextSizePoints: papelizExportPrintTextSizesInPoints.tagTextSizePoints,
  }
}

// A picture inline, at MD View's size on paper's scale, never wider than its place or taller than the
// room a page (or a table row) has. Its description is its alt text, or a diagram's Mermaid source.
function createDocxExportPictureRun(shownPicture: PapelizDocxExportShownPicture, runLook: PapelizDocxExportRunLook, noteWalk: PapelizDocxExportNoteWalk): ImageRun {
  const textHeightPoints = fromDocxTwips(noteWalk.bodyOptions.docxExportTextHeightTwips)
  const roomHeightPoints =
    runLook.isInsideTableCell || runLook.isInsideFootnote ? textHeightPoints * papelizDocxExportSmallPictureHeightShare : textHeightPoints - papelizDocxExportPictureHeightMarginPoints
  const { printedWidthPoints, printedHeightPoints } = fitPapelizDocxExportPictureSizePoints(
    shownPicture.pictureShownPixelWidth,
    shownPicture.pictureShownPixelHeight,
    fromDocxTwips(runLook.pictureRoomWidthTwips),
    roomHeightPoints,
  )
  noteWalk.placedPictureCount += 1
  return new ImageRun({
    type: shownPicture.docxExportPicture.pictureType,
    data: shownPicture.docxExportPicture.pictureBytes,
    transformation: {
      width: Math.max(1, Math.round(printedWidthPoints * papelizDocxExportPicturePixelsPerPoint)),
      height: Math.max(1, Math.round(printedHeightPoints * papelizDocxExportPicturePixelsPerPoint)),
    },
    altText: {
      name: `${shownPicture.isMermaidDiagram ? 'Diagram' : 'Picture'} ${noteWalk.placedPictureCount}`,
      description: removePapelizDocxExportUnwritableCharacters(shownPicture.pictureDescription).replace(/\r\n?/g, '\n'),
    },
  })
}

// "Picture: A blue square" in MD View's chip, then a web picture's address: what the picture was, and
// where to find it. Inside a link the address is text, since Word links can't hold links.
function appendDocxExportMissingPicture(missingPicture: PapelizDocxExportMissingPicture, runLook: PapelizDocxExportRunLook, paragraphChildren: ParagraphChild[]): void {
  paragraphChildren.push(createDocxExportTextRun(`Picture: ${missingPicture.pictureAltText}`.trimEnd(), createPicturePlaceholderRunLook(runLook)))
  const pictureWebAddress = missingPicture.pictureWebAddress
  if (pictureWebAddress === null) return
  paragraphChildren.push(createDocxExportTextRun(' ', runLook))
  const addressRunLook = { ...runLook, runTextColor: getDocxExportPrintColor('--color-papeliz-blue'), runCharacterStyleId: runLook.runCharacterStyleId ?? papelizDocxExportHyperlinkCharacterStyleId }
  if (runLook.isInsideLink) paragraphChildren.push(createDocxExportTextRun(pictureWebAddress, addressRunLook))
  else paragraphChildren.push(new ExternalHyperlink({ link: pictureWebAddress, children: [createDocxExportTextRun(pictureWebAddress, { ...addressRunLook, isInsideLink: true })] }))
}

function appendDocxExportNotePicture(notePicture: PapelizDocxExportNotePicture, runLook: PapelizDocxExportRunLook, noteWalk: PapelizDocxExportNoteWalk, paragraphChildren: ParagraphChild[]): void {
  if ('docxExportShownPicture' in notePicture) paragraphChildren.push(createDocxExportPictureRun(notePicture.docxExportShownPicture, runLook, noteWalk))
  else if ('docxExportMissingPicture' in notePicture) appendDocxExportMissingPicture(notePicture.docxExportMissingPicture, runLook, paragraphChildren)
}

function containsDocxExportShownPicture(hastNodes: readonly HastElementContent[], noteWalk: PapelizDocxExportNoteWalk): boolean {
  return hastNodes.some((hastNode) => {
    if (hastNode.type !== 'element') return false
    const notePicture = noteWalk.bodyOptions.docxExportNotePicturesByElement.get(hastNode)
    return (notePicture !== undefined && 'docxExportShownPicture' in notePicture) || containsDocxExportShownPicture(hastNode.children, noteWalk)
  })
}

// Single line spacing for a paragraph that shows a picture.
function describePictureParagraphSpacing(hastNodes: readonly HastElementContent[], noteWalk: PapelizDocxExportNoteWalk): Partial<IParagraphOptions> {
  return containsDocxExportShownPicture(hastNodes, noteWalk) ? { spacing: { line: papelizDocxExportSingleLineSpacing, lineRule: LineRuleType.AUTO } } : {}
}

// `<sup><a data-footnote-ref href="#user-content-fn-1">1</a></sup>` as a Word footnote holding the
// footnote's text; null when it isn't a footnote's reference.
function createDocxExportFootnoteReferenceRun(hastSuperscriptElement: HastElement, noteWalk: PapelizDocxExportNoteWalk): FootnoteReferenceRun | null {
  const hastFootnoteLinkElement = findHastChildElement(hastSuperscriptElement, (hastChildElement) => hastChildElement.tagName === 'a' && hasHastProperty(hastChildElement, 'dataFootnoteRef'))
  const footnoteHref = hastFootnoteLinkElement === undefined ? null : getHastStringProperty(hastFootnoteLinkElement, 'href')
  const footnoteId = footnoteHref === null ? null : normalizeFootnoteId(decodeLinkHrefPart(footnoteHref.replace(/^#/, '')))
  const hastFootnoteDefinition = footnoteId === null ? undefined : noteWalk.footnoteDefinitionsById.get(footnoteId)
  if (footnoteId === null || hastFootnoteDefinition === undefined) return null
  noteWalk.placedFootnoteIds.add(footnoteId)
  const footnoteBlocks: PapelizDocxExportBlock[] = []
  appendDocxExportBlocks(
    hastFootnoteDefinition.children,
    {
      blockIndentTwips: 0,
      blockWidthTwips: noteWalk.bodyOptions.docxExportTextWidthTwips,
      quoteDepth: 0,
      listLevel: 0,
      blockTextColor: null,
      blockTextSizePoints: null,
      isInsideFootnote: true,
    },
    noteWalk,
    footnoteBlocks,
  )
  const footnoteParagraphs = footnoteBlocks.map((footnoteBlock) =>
    'docxExportTable' in footnoteBlock
      ? new Paragraph({ style: papelizDocxExportFootnoteTextParagraphStyleId })
      : new Paragraph({ style: papelizDocxExportFootnoteTextParagraphStyleId, ...footnoteBlock.docxExportParagraphOptions }),
  )
  return new FootnoteReferenceRun({ children: footnoteParagraphs.length > 0 ? footnoteParagraphs : [new Paragraph({ style: papelizDocxExportFootnoteTextParagraphStyleId })] })
}

function findHeadingBookmarkName(headingId: string, noteWalk: PapelizDocxExportNoteWalk): string | null {
  return noteWalk.docxExportBookmarkNamesByHeadingId.get(headingId) ?? noteWalk.docxExportBookmarkNamesByHeadingId.get(headingId.toLowerCase()) ?? null
}

// A link to a note: to one of this note's headings, a Word link to its bookmark; to another note
// exported beside it, a link to that note's file. A link that leads nowhere keeps MD View's blue.
function appendDocxExportNoteLink(
  hastLinkChildren: readonly HastElementContent[],
  linkRunLook: PapelizDocxExportRunLook,
  targetVaultNoteRelativePath: string,
  targetHeadingId: string | null,
  noteWalk: PapelizDocxExportNoteWalk,
  paragraphChildren: ParagraphChild[],
): void {
  const linkRuns: ParagraphChild[] = []
  appendDocxExportInlineRuns(hastLinkChildren, { ...linkRunLook, runCharacterStyleId: linkRunLook.runCharacterStyleId ?? papelizDocxExportHyperlinkCharacterStyleId, isInsideLink: true }, noteWalk, linkRuns)
  if (targetVaultNoteRelativePath === noteWalk.bodyOptions.vaultNoteRelativePath) {
    const headingBookmarkName = targetHeadingId === null ? null : findHeadingBookmarkName(targetHeadingId, noteWalk)
    if (headingBookmarkName !== null) {
      paragraphChildren.push(new InternalHyperlink({ anchor: headingBookmarkName, children: linkRuns }))
      return
    }
  } else {
    const targetNoteFileHref = noteWalk.bodyOptions.getDocxExportNoteFileHref(targetVaultNoteRelativePath)
    if (targetNoteFileHref !== null) {
      paragraphChildren.push(new ExternalHyperlink({ link: targetNoteFileHref, children: linkRuns }))
      return
    }
  }
  appendDocxExportInlineRuns(hastLinkChildren, linkRunLook, noteWalk, paragraphChildren)
}

function appendDocxExportLink(hastAnchorElement: HastElement, runLook: PapelizDocxExportRunLook, noteWalk: PapelizDocxExportNoteWalk, paragraphChildren: ParagraphChild[]): void {
  // A footnote's way back to its reference only moves around a web page.
  if (hasHastProperty(hastAnchorElement, 'dataFootnoteBackref')) return
  // `![[plan.png]]`: the picture it shows.
  const embeddedNotePicture = noteWalk.bodyOptions.docxExportNotePicturesByElement.get(hastAnchorElement)
  if (embeddedNotePicture !== undefined) {
    appendDocxExportNotePicture(embeddedNotePicture, runLook, noteWalk, paragraphChildren)
    return
  }
  const { resolveWikilinkTarget, vaultNoteRelativePath } = noteWalk.bodyOptions
  const blueRunLook = { ...runLook, runTextColor: getDocxExportPrintColor('--color-papeliz-blue') }
  const wikilinkTargetNoteName = getHastStringProperty(hastAnchorElement, 'dataPapelizWikilinkTarget')
  if (wikilinkTargetNoteName !== null) {
    const targetVaultNoteRelativePath = hasHastClassName(hastAnchorElement, papelizMdViewUnresolvedWikilinkClassName) ? null : resolveWikilinkTarget(wikilinkTargetNoteName, vaultNoteRelativePath)
    if (targetVaultNoteRelativePath === null) {
      // A note that doesn't exist yet: muted, dashed underneath, as in MD View.
      appendDocxExportInlineRuns(hastAnchorElement.children, { ...runLook, runTextColor: getDocxExportPrintColor('--color-papeliz-ink-muted'), isDashedUnderlined: true }, noteWalk, paragraphChildren)
      return
    }
    const wikilinkTargetHeading = getHastStringProperty(hastAnchorElement, 'dataPapelizWikilinkHeading')
    const targetHeadingId = wikilinkTargetHeading === null ? null : createPapelizHtmlExportHeadingIdMaker()(wikilinkTargetHeading)
    appendDocxExportNoteLink(hastAnchorElement.children, blueRunLook, targetVaultNoteRelativePath, targetHeadingId, noteWalk, paragraphChildren)
    return
  }
  const linkHref = getHastStringProperty(hastAnchorElement, 'href')
  if (linkHref === null) {
    appendDocxExportInlineRuns(hastAnchorElement.children, runLook, noteWalk, paragraphChildren)
    return
  }
  if (isExternalLinkHref(linkHref)) {
    const linkRuns: ParagraphChild[] = []
    appendDocxExportInlineRuns(hastAnchorElement.children, { ...blueRunLook, runCharacterStyleId: runLook.runCharacterStyleId ?? papelizDocxExportHyperlinkCharacterStyleId, isInsideLink: true }, noteWalk, linkRuns)
    paragraphChildren.push(new ExternalHyperlink({ link: linkHref, children: linkRuns }))
    return
  }
  // `[text](#part)` and `[text](Other note.md#part)`: MD View opens them as it opens wikilinks.
  const linkHrefFragmentIndex = linkHref.indexOf('#')
  const linkTargetName = decodeLinkHrefPart(linkHrefFragmentIndex === -1 ? linkHref : linkHref.slice(0, linkHrefFragmentIndex))
  const linkHeadingId = linkHrefFragmentIndex === -1 ? null : decodeLinkHrefPart(linkHref.slice(linkHrefFragmentIndex + 1))
  const targetVaultNoteRelativePath = linkTargetName.length === 0 ? vaultNoteRelativePath : resolveWikilinkTarget(linkTargetName.replace(/\.md$/i, ''), vaultNoteRelativePath)
  if (targetVaultNoteRelativePath === null) {
    appendDocxExportInlineRuns(hastAnchorElement.children, blueRunLook, noteWalk, paragraphChildren)
    return
  }
  appendDocxExportNoteLink(hastAnchorElement.children, blueRunLook, targetVaultNoteRelativePath, linkHeadingId, noteWalk, paragraphChildren)
}

// Leading and trailing whitespace of a run of inline nodes, which HTML doesn't show. A task's box
// goes before the text on its own, so it is left out here.
function trimInlineHastNodes(hastNodes: readonly HastElementContent[]): HastElementContent[] {
  const trimmedHastNodes = hastNodes.filter((hastNode) => hastNode.type !== 'element' || hastNode.tagName !== 'input')
  while (trimmedHastNodes.length > 0 && isWhitespaceHastText(trimmedHastNodes[0] as HastElementContent)) trimmedHastNodes.shift()
  while (trimmedHastNodes.length > 0 && isWhitespaceHastText(trimmedHastNodes[trimmedHastNodes.length - 1] as HastElementContent)) trimmedHastNodes.pop()
  const firstHastNode = trimmedHastNodes[0]
  if (firstHastNode?.type === 'text') trimmedHastNodes[0] = { ...firstHastNode, value: firstHastNode.value.trimStart() }
  const lastHastNode = trimmedHastNodes[trimmedHastNodes.length - 1]
  if (lastHastNode?.type === 'text') trimmedHastNodes[trimmedHastNodes.length - 1] = { ...lastHastNode, value: lastHastNode.value.trimEnd() }
  return trimmedHastNodes
}

function describeBlockPlaceParagraph(blockPlace: PapelizDocxExportBlockPlace): Partial<IParagraphOptions> {
  const quoteBorder =
    blockPlace.quoteDepth > 0
      ? {
          border: {
            left: {
              style: BorderStyle.SINGLE,
              color: getDocxExportPrintColor('--color-papeliz-line-strong'),
              size: toDocxBorderEighthPoints(papelizDocxExportQuoteBarWidthPoints),
              space: Math.round(papelizExportPrintSpacingInPoints.quoteIndentPoints),
            },
          },
        }
      : {}
  return { ...(blockPlace.blockIndentTwips > 0 ? { indent: { left: blockPlace.blockIndentTwips } } : {}), ...quoteBorder }
}

function describeBlockPlaceTable(blockPlace: PapelizDocxExportBlockPlace) {
  return { tableWidthTwips: blockPlace.blockWidthTwips - blockPlace.blockIndentTwips, tableIndentTwips: blockPlace.blockIndentTwips }
}

function pushDocxExportParagraph(docxExportBlocks: PapelizDocxExportBlock[], docxExportParagraphOptions: IParagraphOptions): void {
  docxExportBlocks.push({ docxExportParagraphOptions })
}

// A table, then MD View's space below it. The empty line also keeps two tables in a row apart,
// which Word would otherwise join into one.
function pushDocxExportTable(docxExportBlocks: PapelizDocxExportBlock[], docxExportTable: Table): void {
  docxExportBlocks.push({ docxExportTable }, { docxExportParagraphOptions: describePapelizDocxExportGapParagraph(papelizExportPrintSpacingInPoints.blockSpaceBelowPoints) })
}

export function createPapelizDocxExportBodyElement(docxExportBlock: PapelizDocxExportBlock): Paragraph | Table {
  return 'docxExportTable' in docxExportBlock ? docxExportBlock.docxExportTable : new Paragraph(docxExportBlock.docxExportParagraphOptions)
}

// Block content: headings, paragraphs, lists, quotes, code, tables, callouts and rules. Inline
// content between blocks (a tight list item's text) becomes a paragraph of its own.
function appendDocxExportBlocks(
  hastNodes: readonly HastElementContent[],
  blockPlace: PapelizDocxExportBlockPlace,
  noteWalk: PapelizDocxExportNoteWalk,
  docxExportBlocks: PapelizDocxExportBlock[],
): void {
  let inlineHastNodes: HastElementContent[] = []
  const writeInlineHastNodes = () => {
    const trimmedInlineHastNodes = trimInlineHastNodes(inlineHastNodes)
    inlineHastNodes = []
    if (trimmedInlineHastNodes.length === 0) return
    const paragraphChildren: ParagraphChild[] = []
    appendDocxExportInlineRuns(trimmedInlineHastNodes, createRunLook(blockPlace, papelizExportBodyTextSizePoints), noteWalk, paragraphChildren)
    pushDocxExportParagraph(docxExportBlocks, { children: paragraphChildren, ...describeBlockPlaceParagraph(blockPlace), ...describePictureParagraphSpacing(trimmedInlineHastNodes, noteWalk) })
  }
  for (const hastNode of hastNodes) {
    if (!isBlockHastNode(hastNode)) {
      inlineHastNodes.push(hastNode)
      continue
    }
    writeInlineHastNodes()
    appendDocxExportBlockElement(hastNode as HastElement, blockPlace, noteWalk, docxExportBlocks)
  }
  writeInlineHastNodes()
}

function appendDocxExportBlockElement(
  hastElement: HastElement,
  blockPlace: PapelizDocxExportBlockPlace,
  noteWalk: PapelizDocxExportNoteWalk,
  docxExportBlocks: PapelizDocxExportBlock[],
): void {
  const headingLevel = papelizDocxExportHeadingLevelsByTagName.get(hastElement.tagName)
  if (headingLevel !== undefined) {
    // The footnotes' label is for screen readers; MD View doesn't show it.
    if (hasHastClassName(hastElement, 'sr-only')) return
    appendDocxExportHeading(hastElement, headingLevel, blockPlace, noteWalk, docxExportBlocks)
    return
  }
  switch (hastElement.tagName) {
    case 'p': {
      const paragraphChildren: ParagraphChild[] = []
      appendDocxExportInlineRuns(trimInlineHastNodes(hastElement.children), createRunLook(blockPlace, papelizExportBodyTextSizePoints), noteWalk, paragraphChildren)
      pushDocxExportParagraph(docxExportBlocks, { children: paragraphChildren, ...describeBlockPlaceParagraph(blockPlace), ...describePictureParagraphSpacing(hastElement.children, noteWalk) })
      return
    }
    case 'ul':
    case 'ol':
      appendDocxExportList(hastElement, blockPlace, noteWalk, docxExportBlocks)
      return
    case 'blockquote':
      appendDocxExportBlocks(
        hastElement.children,
        {
          ...blockPlace,
          blockIndentTwips: blockPlace.blockIndentTwips + toDocxTwips(papelizExportPrintSpacingInPoints.quoteIndentPoints + papelizDocxExportQuoteBarWidthPoints),
          quoteDepth: blockPlace.quoteDepth + 1,
          blockTextColor: blockPlace.blockTextColor ?? getDocxExportPrintColor('--color-papeliz-ink-muted'),
        },
        noteWalk,
        docxExportBlocks,
      )
      return
    case 'pre': {
      const mermaidDiagramPicture = noteWalk.bodyOptions.docxExportNotePicturesByElement.get(hastElement)
      if (mermaidDiagramPicture !== undefined && !('docxExportMissingPicture' in mermaidDiagramPicture)) {
        appendDocxExportMermaidDiagram(hastElement, mermaidDiagramPicture, blockPlace, noteWalk, docxExportBlocks)
        return
      }
      const hastCodeElement = findHastChildElement(hastElement, (hastChildElement) => hastChildElement.tagName === 'code')
      appendDocxExportCodeBlock(collectHastText(hastCodeElement ?? hastElement).replace(/\n$/, ''), blockPlace, docxExportBlocks)
      return
    }
    case 'hr':
      pushDocxExportParagraph(docxExportBlocks, {
        ...describeBlockPlaceParagraph(blockPlace),
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            color: getDocxExportPrintColor('--color-papeliz-line'),
            size: toDocxBorderEighthPoints(papelizExportPrintSpacingInPoints.hairlineWidthPoints),
            space: 1,
          },
        },
        spacing: { before: toDocxTwips(papelizExportPrintSpacingInPoints.ruleSpaceAbovePoints / 2), after: toDocxTwips(papelizExportPrintSpacingInPoints.ruleSpaceBelowPoints), line: 20, lineRule: LineRuleType.EXACT },
        run: { size: 2 },
      })
      return
    case 'table':
      // A Word footnote holds paragraphs only.
      if (blockPlace.isInsideFootnote) appendDocxExportBlockAsSource(hastElement, blockPlace, noteWalk, docxExportBlocks)
      else appendDocxExportMarkdownTable(hastElement, blockPlace, noteWalk, docxExportBlocks)
      return
    case 'section':
      // Footnotes are Word footnotes, at the foot of the page that refers to them.
      if (hasHastProperty(hastElement, 'dataFootnotes')) return
      appendDocxExportBlocks(hastElement.children, blockPlace, noteWalk, docxExportBlocks)
      return
    case 'div':
      if (hasHastClassName(hastElement, papelizMdViewCalloutClassName)) {
        if (blockPlace.isInsideFootnote) appendDocxExportBlockAsSource(hastElement, blockPlace, noteWalk, docxExportBlocks)
        else appendDocxExportCallout(hastElement, blockPlace, noteWalk, docxExportBlocks)
        return
      }
      appendDocxExportBlocks(hastElement.children, blockPlace, noteWalk, docxExportBlocks)
      return
    default:
      appendDocxExportBlocks(hastElement.children, blockPlace, noteWalk, docxExportBlocks)
  }
}

function appendDocxExportHeading(
  hastHeadingElement: HastElement,
  headingLevel: 1 | 2 | 3 | 4 | 5 | 6,
  blockPlace: PapelizDocxExportBlockPlace,
  noteWalk: PapelizDocxExportNoteWalk,
  docxExportBlocks: PapelizDocxExportBlock[],
): void {
  const headingRuns: ParagraphChild[] = []
  appendDocxExportInlineRuns(
    trimInlineHastNodes(hastHeadingElement.children),
    createRunLook({ ...blockPlace, blockTextSizePoints: null }, getPapelizDocxExportHeadingTextSizePoints(headingLevel)),
    noteWalk,
    headingRuns,
  )
  const headingId = noteWalk.headingIdsByElement.get(hastHeadingElement)
  const bookmarkName = headingId === undefined ? undefined : noteWalk.docxExportBookmarkNamesByHeadingId.get(headingId)
  pushDocxExportParagraph(docxExportBlocks, {
    heading: papelizDocxExportHeadingStyleIds[headingLevel - 1],
    children: bookmarkName === undefined ? headingRuns : [new Bookmark({ id: bookmarkName, children: headingRuns })],
    ...describeBlockPlaceParagraph(blockPlace),
  })
}

// A ```mermaid block as MD View draws it: the diagram centered, with a block's space above and below.
// One Mermaid can't draw is its source, with MD View's error line under it.
function appendDocxExportMermaidDiagram(
  hastPreElement: HastElement,
  mermaidDiagramPicture: Exclude<PapelizDocxExportNotePicture, { docxExportMissingPicture: PapelizDocxExportMissingPicture }>,
  blockPlace: PapelizDocxExportBlockPlace,
  noteWalk: PapelizDocxExportNoteWalk,
  docxExportBlocks: PapelizDocxExportBlock[],
): void {
  const { blockSpaceAbovePoints, blockSpaceBelowPoints } = papelizExportPrintSpacingInPoints
  if ('docxExportShownPicture' in mermaidDiagramPicture) {
    pushDocxExportParagraph(docxExportBlocks, {
      children: [createDocxExportPictureRun(mermaidDiagramPicture.docxExportShownPicture, createRunLook(blockPlace, papelizExportBodyTextSizePoints), noteWalk)],
      ...describeBlockPlaceParagraph(blockPlace),
      alignment: AlignmentType.CENTER,
      spacing: { before: toDocxTwips(blockSpaceAbovePoints), after: toDocxTwips(blockSpaceBelowPoints), line: papelizDocxExportSingleLineSpacing, lineRule: LineRuleType.AUTO },
    })
    return
  }
  appendDocxExportCodeBlock(readPapelizDocxExportMermaidDiagramSource(hastPreElement) ?? collectHastText(hastPreElement), blockPlace, docxExportBlocks)
  // The source's box closes on the error line, which stays with it.
  const lastCodeLineBlock = docxExportBlocks.at(-1)
  if (lastCodeLineBlock !== undefined && 'docxExportParagraphOptions' in lastCodeLineBlock) {
    lastCodeLineBlock.docxExportParagraphOptions = { ...lastCodeLineBlock.docxExportParagraphOptions, keepNext: true, spacing: { ...lastCodeLineBlock.docxExportParagraphOptions.spacing, after: 0 } }
  }
  const errorNoticeLine = { style: BorderStyle.SINGLE, color: getDocxExportPrintColor('--color-papeliz-error-notice-line'), size: toDocxBorderEighthPoints(papelizExportPrintSpacingInPoints.hairlineWidthPoints), space: 4 }
  const codeBlockIndentTwips = getDocxExportCodeBlockIndentTwips()
  pushDocxExportParagraph(docxExportBlocks, {
    children: [
      createDocxExportTextRun(`This diagram can’t be drawn: ${mermaidDiagramPicture.mermaidDiagramErrorMessage}`, {
        ...createRunLook({ ...blockPlace, blockTextColor: null, blockTextSizePoints: null }, papelizExportPrintTextSizesInPoints.codeBlockTextSizePoints),
        runTextColor: getDocxExportPrintColor('--color-papeliz-error-notice-ink'),
        runTextSizePoints: papelizExportPrintTextSizesInPoints.codeBlockTextSizePoints,
      }),
    ],
    shading: { fill: getDocxExportPrintColor('--color-papeliz-error-notice-ground') },
    border: { left: errorNoticeLine, right: errorNoticeLine, bottom: errorNoticeLine },
    indent: { left: blockPlace.blockIndentTwips + codeBlockIndentTwips, right: codeBlockIndentTwips },
    spacing: { before: 0, after: toDocxTwips(blockSpaceBelowPoints) },
    keepLines: true,
  })
}

// A code block's box sits half its padding in from the text, as its border's space takes the rest.
function getDocxExportCodeBlockIndentTwips(): number {
  return toDocxTwips(papelizExportPrintSpacingInPoints.codeBlockPaddingHorizontalPoints / 2 + papelizExportPrintSpacingInPoints.hairlineWidthPoints)
}

// One paragraph per line in the code block style, tabs kept. Lines in a row share one box.
function appendDocxExportCodeBlock(codeBlockText: string, blockPlace: PapelizDocxExportBlockPlace, docxExportBlocks: PapelizDocxExportBlock[]): void {
  const codeBlockLines = removePapelizDocxExportUnwritableCharacters(codeBlockText).split(/\r?\n/)
  const isKeptTogether = codeBlockLines.length <= papelizDocxExportKeptTogetherCodeLineCount
  const codeBlockIndentTwips = getDocxExportCodeBlockIndentTwips()
  codeBlockLines.forEach((codeBlockLine, codeBlockLineIndex) => {
    const isFirstCodeLine = codeBlockLineIndex === 0
    const isLastCodeLine = codeBlockLineIndex === codeBlockLines.length - 1
    pushDocxExportParagraph(docxExportBlocks, {
      style: papelizDocxExportCodeBlockParagraphStyleId,
      children: [createDocxExportTextRun(codeBlockLine, createRunLook({ ...blockPlace, blockTextColor: null, blockTextSizePoints: null }, papelizExportPrintTextSizesInPoints.codeBlockTextSizePoints))],
      indent: { left: blockPlace.blockIndentTwips + codeBlockIndentTwips, right: codeBlockIndentTwips },
      spacing: {
        before: isFirstCodeLine ? toDocxTwips(papelizExportPrintSpacingInPoints.blockSpaceAbovePoints) : 0,
        after: isLastCodeLine ? toDocxTwips(papelizExportPrintSpacingInPoints.blockSpaceBelowPoints) : 0,
      },
      keepLines: true,
      ...(isKeptTogether && !isLastCodeLine ? { keepNext: true } : {}),
    })
  })
}

// A block shown as its Markdown source, as a code block. The tree keeps where each block came from.
function appendDocxExportBlockAsSource(
  hastElement: HastElement,
  blockPlace: PapelizDocxExportBlockPlace,
  noteWalk: PapelizDocxExportNoteWalk,
  docxExportBlocks: PapelizDocxExportBlock[],
): void {
  const sourceStartOffset = hastElement.position?.start.offset
  const sourceEndOffset = hastElement.position?.end.offset
  if (sourceStartOffset === undefined || sourceEndOffset === undefined) {
    appendDocxExportCodeBlock(collectHastText(hastElement).trim(), blockPlace, docxExportBlocks)
    return
  }
  // Lines after the first carry the indent of the list the block sits in.
  const sourceIndentLength = (hastElement.position?.start.column ?? 1) - 1
  const blockSourceText = noteWalk.bodyOptions.noteParsedText
    .slice(sourceStartOffset, sourceEndOffset)
    .split('\n')
    .map((sourceLine, sourceLineIndex) => (sourceLineIndex === 0 ? sourceLine : sourceLine.slice(Math.min(sourceIndentLength, sourceLine.length - sourceLine.trimStart().length))))
    .join('\n')
  appendDocxExportCodeBlock(blockSourceText, blockPlace, docxExportBlocks)
}

function readCellAlignment(hastCellElement: HastElement): PapelizDocxExportCellAlignment | null {
  const cellAlignment = getHastStringProperty(hastCellElement, 'align')
  return cellAlignment === 'left' || cellAlignment === 'center' || cellAlignment === 'right' ? cellAlignment : null
}

// A Markdown table: header cells bold, every cell in the table's smaller size, with their links.
function appendDocxExportMarkdownTable(
  hastTableElement: HastElement,
  blockPlace: PapelizDocxExportBlockPlace,
  noteWalk: PapelizDocxExportNoteWalk,
  docxExportBlocks: PapelizDocxExportBlock[],
): void {
  const markdownTableRows: PapelizDocxExportMarkdownTableRow[] = []
  const { tableWidthTwips } = describeBlockPlaceTable(blockPlace)
  const tableColumnCount = Math.max(
    1,
    ...hastTableElement.children.flatMap((hastTableSection) =>
      hastTableSection.type !== 'element'
        ? []
        : (hastTableSection.tagName === 'tr' ? [hastTableSection] : hastTableSection.children).map((hastTableRow) =>
            hastTableRow.type === 'element' ? hastTableRow.children.filter((hastChild) => hastChild.type === 'element' && (hastChild.tagName === 'th' || hastChild.tagName === 'td')).length : 0,
          ),
    ),
  )
  const tableRunLook: PapelizDocxExportRunLook = {
    ...createRunLook(blockPlace, papelizExportPrintTextSizesInPoints.tableTextSizePoints),
    runTextSizePoints: papelizExportPrintTextSizesInPoints.tableTextSizePoints,
    surroundingTextSizePoints: papelizExportPrintTextSizesInPoints.tableTextSizePoints,
    // A column with a picture takes the largest share of the width, so it is never narrower than
    // an even share.
    pictureRoomWidthTwips: Math.floor(tableWidthTwips / tableColumnCount) - 2 * toDocxTwips(papelizExportPrintSpacingInPoints.tableCellPaddingHorizontalPoints),
    isInsideTableCell: true,
  }
  for (const hastTableSection of hastTableElement.children) {
    if (hastTableSection.type !== 'element') continue
    const hastTableRows = hastTableSection.tagName === 'tr' ? [hastTableSection] : hastTableSection.children.filter((hastChild): hastChild is HastElement => hastChild.type === 'element' && hastChild.tagName === 'tr')
    for (const hastTableRow of hastTableRows) {
      const hastTableCells = hastTableRow.children.filter((hastChild): hastChild is HastElement => hastChild.type === 'element' && (hastChild.tagName === 'th' || hastChild.tagName === 'td'))
      markdownTableRows.push({
        isHeaderRow: hastTableSection.tagName === 'thead',
        markdownTableCells: hastTableCells.map((hastTableCell) => {
          const cellParagraphChildren: ParagraphChild[] = []
          appendDocxExportInlineRuns(trimInlineHastNodes(hastTableCell.children), { ...tableRunLook, isBold: hastTableCell.tagName === 'th' }, noteWalk, cellParagraphChildren)
          return {
            cellParagraphChildren,
            cellAlignment: readCellAlignment(hastTableCell),
            cellTextLength: collectHastText(hastTableCell).trim().length,
            cellHasShownPicture: containsDocxExportShownPicture(hastTableCell.children, noteWalk),
          }
        }),
      })
    }
  }
  pushDocxExportTable(docxExportBlocks, buildPapelizDocxExportMarkdownTable(markdownTableRows, describeBlockPlaceTable(blockPlace)))
}

function readCalloutKindAndColor(hastCalloutElement: HastElement): { calloutKind: string; calloutColor: string | null } {
  return { calloutKind: getHastStringProperty(hastCalloutElement, 'dataPapelizCalloutKind') ?? 'note', calloutColor: getHastStringProperty(hastCalloutElement, 'dataPapelizCalloutColor') }
}

function getCalloutIconName(calloutKind: string): PapelizHtmlExportIconName {
  return (Object.hasOwn(papelizHtmlExportCalloutIconNamesByKind, calloutKind) ? papelizHtmlExportCalloutIconNamesByKind[calloutKind] : undefined) ?? 'Info'
}

export function getPapelizDocxExportCalloutIconKey(calloutIconName: PapelizHtmlExportIconName, calloutInkColor: string): string {
  return `${calloutIconName} ${calloutInkColor}`
}

// Every icon the note's callouts show, in its callout's ink, to draw before the walk.
export function listPapelizDocxExportCalloutIcons(noteHastRoot: HastRoot): Array<{ calloutIconName: PapelizHtmlExportIconName; calloutInkColor: string }> {
  const calloutIconsByKey = new Map<string, { calloutIconName: PapelizHtmlExportIconName; calloutInkColor: string }>()
  visit(noteHastRoot, 'element', (hastElement: HastElement) => {
    if (hastElement.tagName !== 'div' || !hasHastClassName(hastElement, papelizMdViewCalloutClassName)) return
    const { calloutKind, calloutColor } = readCalloutKindAndColor(hastElement)
    const calloutIconName = getCalloutIconName(calloutKind)
    const { calloutInkColor } = getPapelizExportCalloutPrintColors(calloutKind, calloutColor)
    calloutIconsByKey.set(getPapelizDocxExportCalloutIconKey(calloutIconName, calloutInkColor), { calloutIconName, calloutInkColor })
  })
  return [...calloutIconsByKey.values()]
}

// A callout as MD View's card: its icon and bold title in the kind's ink, then its body, inside one
// shaded cell, so lists and code blocks in it keep their shape.
function appendDocxExportCallout(
  hastCalloutElement: HastElement,
  blockPlace: PapelizDocxExportBlockPlace,
  noteWalk: PapelizDocxExportNoteWalk,
  docxExportBlocks: PapelizDocxExportBlock[],
): void {
  const { calloutKind, calloutColor } = readCalloutKindAndColor(hastCalloutElement)
  const { calloutGroundColor, calloutInkColor } = getPapelizExportCalloutPrintColors(calloutKind, calloutColor)
  const hastCalloutTitleElement = findHastChildElement(hastCalloutElement, (hastChildElement) => hasHastClassName(hastChildElement, papelizMdViewCalloutTitleClassName))
  const hastCalloutBodyElement = findHastChildElement(hastCalloutElement, (hastChildElement) => hasHastClassName(hastChildElement, papelizMdViewCalloutBodyClassName))
  const { calloutIconSizePoints, calloutIconGapPoints, calloutTitleSpaceBelowPoints, calloutPaddingHorizontalPoints } = papelizExportPrintSpacingInPoints
  const calloutTitleSizePoints = papelizExportPrintTextSizesInPoints.calloutTitleTextSizePoints
  const { tableWidthTwips: calloutCardWidthTwips, tableIndentTwips: calloutCardIndentTwips } = describeBlockPlaceTable(blockPlace)

  const calloutTitleChildren: ParagraphChild[] = []
  const calloutIconPicture = noteWalk.bodyOptions.docxExportCalloutIconPictures.get(getPapelizDocxExportCalloutIconKey(getCalloutIconName(calloutKind), calloutInkColor))
  if (calloutIconPicture !== undefined) {
    const calloutIconPixelSize = Math.round(calloutIconSizePoints * papelizDocxExportPicturePixelsPerPoint)
    calloutTitleChildren.push(
      new ImageRun({
        type: calloutIconPicture.pictureType,
        data: calloutIconPicture.pictureBytes,
        transformation: { width: calloutIconPixelSize, height: calloutIconPixelSize },
        // The icon repeats the callout's kind; screen readers skip it.
        decorative: true,
        // Sits on the title's middle rather than its baseline.
        run: { position: `-${Math.round((calloutIconSizePoints - calloutTitleSizePoints) / 2 + 1)}pt` as const },
      }),
      new TextRun({ text: ' ', size: toDocxHalfPoints(calloutIconGapPoints * 1.4) }),
    )
  }
  appendDocxExportInlineRuns(
    trimInlineHastNodes(hastCalloutTitleElement?.children ?? []),
    {
      ...createRunLook(blockPlace, calloutTitleSizePoints),
      isBold: true,
      runTextColor: toDocxHexColor(calloutInkColor),
      runTextSizePoints: calloutTitleSizePoints,
      surroundingTextSizePoints: calloutTitleSizePoints,
    },
    noteWalk,
    calloutTitleChildren,
  )

  const calloutBodyBlocks: PapelizDocxExportBlock[] = []
  if (hastCalloutBodyElement !== undefined) {
    appendDocxExportBlocks(
      hastCalloutBodyElement.children,
      {
        blockIndentTwips: 0,
        blockWidthTwips: calloutCardWidthTwips - 2 * toDocxTwips(calloutPaddingHorizontalPoints),
        quoteDepth: 0,
        listLevel: 0,
        blockTextColor: blockPlace.blockTextColor,
        blockTextSizePoints: papelizExportPrintTextSizesInPoints.calloutBodyTextSizePoints,
        isInsideFootnote: false,
      },
      noteWalk,
      calloutBodyBlocks,
    )
  }
  // The card's padding is the space below its last line.
  const lastCalloutBodyBlock = calloutBodyBlocks.at(-1)
  if (lastCalloutBodyBlock !== undefined && 'docxExportParagraphOptions' in lastCalloutBodyBlock) {
    lastCalloutBodyBlock.docxExportParagraphOptions = { ...lastCalloutBodyBlock.docxExportParagraphOptions, spacing: { ...lastCalloutBodyBlock.docxExportParagraphOptions.spacing, after: 0 } }
  }
  const calloutTitleParagraph = new Paragraph({
    children: calloutTitleChildren,
    keepNext: calloutBodyBlocks.length > 0,
    spacing: { before: 0, after: calloutBodyBlocks.length > 0 ? toDocxTwips(calloutTitleSpaceBelowPoints) : 0 },
  })
  pushDocxExportTable(
    docxExportBlocks,
    buildPapelizDocxExportCalloutCard({
      calloutGroundColor,
      calloutCellChildren: [calloutTitleParagraph, ...calloutBodyBlocks.map(createPapelizDocxExportBodyElement)],
      tablePlacement: { tableWidthTwips: calloutCardWidthTwips, tableIndentTwips: calloutCardIndentTwips },
    }),
  )
}

function readNumberedListStart(hastListElement: HastElement): number {
  const listStartValue = hastListElement.properties['start']
  const numberedListStart = typeof listStartValue === 'number' ? listStartValue : typeof listStartValue === 'string' ? Number.parseInt(listStartValue, 10) : 1
  return Number.isSafeInteger(numberedListStart) && numberedListStart >= 0 ? numberedListStart : 1
}

// A task list item's box: the `<input type="checkbox">` at its start, or in its first paragraph.
function findTaskCheckbox(hastListItemElement: HastElement): HastElement | null {
  for (const hastChild of hastListItemElement.children) {
    if (hastChild.type !== 'element') continue
    if (hastChild.tagName === 'input') return hastChild
    if (hastChild.tagName === 'p') return findHastChildElement(hastChild, (hastParagraphChild) => hastParagraphChild.tagName === 'input') ?? null
    return null
  }
  return null
}

function appendDocxExportList(
  hastListElement: HastElement,
  blockPlace: PapelizDocxExportBlockPlace,
  noteWalk: PapelizDocxExportNoteWalk,
  docxExportBlocks: PapelizDocxExportBlock[],
): void {
  const isNumberedList = hastListElement.tagName === 'ol'
  const isTaskList = hasHastClassName(hastListElement, 'contains-task-list')
  const docxExportListInstance = noteWalk.nextDocxExportListInstance
  noteWalk.nextDocxExportListInstance += 1
  const numberedListStart = isNumberedList ? readNumberedListStart(hastListElement) : null
  if (numberedListStart !== null) noteWalk.docxExportNumberedListStarts.add(numberedListStart)
  const listNumberingReference = numberedListStart === null ? papelizDocxExportBulletNumberingReference : getPapelizDocxExportNumberedListReference(numberedListStart)
  const listItemIndentTwips = toDocxTwips(isTaskList ? papelizExportPrintSpacingInPoints.taskListItemIndentPoints : papelizExportPrintSpacingInPoints.listIndentPoints)
  const listItemTextIndentTwips = blockPlace.blockIndentTwips + listItemIndentTwips
  const listItemSpaceBelowTwips = toDocxTwips(papelizExportPrintSpacingInPoints.listItemSpaceBelowPoints)
  const firstListBlockIndex = docxExportBlocks.length

  for (const hastListItemElement of hastListElement.children) {
    if (hastListItemElement.type !== 'element' || hastListItemElement.tagName !== 'li') continue
    const taskCheckbox = isTaskList ? findTaskCheckbox(hastListItemElement) : null
    const isTaskDone = taskCheckbox !== null && hasHastProperty(taskCheckbox, 'checked')
    const listItemPlace: PapelizDocxExportBlockPlace = {
      ...blockPlace,
      blockIndentTwips: listItemTextIndentTwips,
      listLevel: blockPlace.listLevel + 1,
      // A done task's text is gray, nested lists included, as in MD View.
      blockTextColor: isTaskDone ? getDocxExportPrintColor('--color-papeliz-ink-subtle') : blockPlace.blockTextColor,
    }
    const listItemBlocks: PapelizDocxExportBlock[] = []
    appendDocxExportBlocks(hastListItemElement.children, listItemPlace, noteWalk, listItemBlocks)
    const firstListItemBlock = listItemBlocks[0]
    // An item that starts with a code block or a table still shows its bullet or box.
    if (firstListItemBlock === undefined || !('docxExportParagraphOptions' in firstListItemBlock) || firstListItemBlock.docxExportParagraphOptions.style !== undefined) {
      listItemBlocks.unshift({ docxExportParagraphOptions: { children: [], ...describeBlockPlaceParagraph(listItemPlace) } })
    }
    const listItemParagraph = listItemBlocks[0] as { docxExportParagraphOptions: IParagraphOptions }
    const listItemParagraphOptions = listItemParagraph.docxExportParagraphOptions
    // A task list shows no bullets: a task's box, or nothing for an item without one.
    const listItemMarker: Partial<IParagraphOptions> = !isTaskList
      ? { numbering: { reference: listNumberingReference, level: Math.min(blockPlace.listLevel, 8), instance: docxExportListInstance } }
      : taskCheckbox === null
        ? {}
        : {
            children: [
              createDocxExportTextRun(`${isTaskDone ? papelizDocxExportCheckedTaskCharacter : papelizDocxExportUncheckedTaskCharacter}\t`, createRunLook(listItemPlace, papelizExportBodyTextSizePoints)),
              ...(listItemParagraphOptions.children ?? []),
            ],
          }
    listItemParagraph.docxExportParagraphOptions = { ...listItemParagraphOptions, ...listItemMarker, indent: { left: listItemTextIndentTwips, hanging: listItemIndentTwips } }
    for (const listItemBlock of listItemBlocks) {
      if ('docxExportParagraphOptions' in listItemBlock && listItemBlock.docxExportParagraphOptions.style === undefined && listItemBlock.docxExportParagraphOptions.heading === undefined) {
        listItemBlock.docxExportParagraphOptions = { ...listItemBlock.docxExportParagraphOptions, spacing: { after: listItemSpaceBelowTwips, ...listItemBlock.docxExportParagraphOptions.spacing } }
      }
    }
    docxExportBlocks.push(...listItemBlocks)
  }

  // A list ends with MD View's space below it.
  const lastListBlock = docxExportBlocks.at(-1)
  if (blockPlace.listLevel === 0 && docxExportBlocks.length > firstListBlockIndex && lastListBlock !== undefined && 'docxExportParagraphOptions' in lastListBlock) {
    lastListBlock.docxExportParagraphOptions = {
      ...lastListBlock.docxExportParagraphOptions,
      spacing: { ...lastListBlock.docxExportParagraphOptions.spacing, after: toDocxTwips(papelizExportPrintSpacingInPoints.listSpaceBelowPoints) },
    }
  }
}

// Every heading's GitHub-style id, in the note's order, as the HTML export gives them, so a link
// to `#launch-plan` means the same heading in both.
function collectHeadingIds(noteHastRoot: HastRoot): Map<HastElement, string> {
  const makeHeadingId = createPapelizHtmlExportHeadingIdMaker()
  const headingIdsByElement = new Map<HastElement, string>()
  visit(noteHastRoot, 'element', (hastElement: HastElement) => {
    if (!papelizDocxExportHeadingLevelsByTagName.has(hastElement.tagName) || hastElement.properties['id'] !== undefined) return
    const headingId = makeHeadingId(collectHastText(hastElement))
    if (headingId.length > 0) headingIdsByElement.set(hastElement, headingId)
  })
  return headingIdsByElement
}

// "user-content-user-content-fn-first" -> "fn-first": the sanitizer prefixes ids again, so a
// reference's link and its footnote's id are compared without the prefixes.
function normalizeFootnoteId(footnoteIdText: string): string {
  return footnoteIdText.replace(/^(user-content-)+/, '')
}

// The footnotes' definitions, the items of the section GitHub Markdown adds at the end, by their id.
function collectFootnoteDefinitions(noteHastRoot: HastRoot): Map<string, HastElement> {
  const footnoteDefinitionsById = new Map<string, HastElement>()
  visit(noteHastRoot, 'element', (hastElement: HastElement) => {
    if (hastElement.tagName !== 'section' || !hasHastProperty(hastElement, 'dataFootnotes')) return
    visit(hastElement, 'element', (hastFootnoteElement: HastElement) => {
      const footnoteId = getHastStringProperty(hastFootnoteElement, 'id')
      if (hastFootnoteElement.tagName === 'li' && footnoteId !== null) footnoteDefinitionsById.set(normalizeFootnoteId(footnoteId), hastFootnoteElement)
    })
  })
  return footnoteDefinitionsById
}

export function buildPapelizDocxExportBody(bodyOptions: PapelizDocxExportBodyOptions): PapelizDocxExportBody {
  const headingIdsByElement = collectHeadingIds(bodyOptions.noteHastRoot)
  const docxExportBookmarkNamesByHeadingId = new Map<string, string>()
  let headingNumber = 0
  for (const headingId of headingIdsByElement.values()) {
    headingNumber += 1
    docxExportBookmarkNamesByHeadingId.set(headingId, createPapelizDocxExportBookmarkName(headingNumber, headingId))
  }
  const noteWalk: PapelizDocxExportNoteWalk = {
    bodyOptions,
    headingIdsByElement,
    docxExportBookmarkNamesByHeadingId,
    footnoteDefinitionsById: collectFootnoteDefinitions(bodyOptions.noteHastRoot),
    placedFootnoteIds: new Set(),
    docxExportNumberedListStarts: new Set(),
    nextDocxExportListInstance: 1,
    placedPictureCount: 0,
  }
  const bodyBlockPlace: PapelizDocxExportBlockPlace = {
    blockIndentTwips: 0,
    blockWidthTwips: bodyOptions.docxExportTextWidthTwips,
    quoteDepth: 0,
    listLevel: 0,
    blockTextColor: null,
    blockTextSizePoints: null,
    isInsideFootnote: false,
  }
  const docxExportBlocks: PapelizDocxExportBlock[] = []
  appendDocxExportBlocks(bodyOptions.noteHastRoot.children as HastElementContent[], bodyBlockPlace, noteWalk, docxExportBlocks)
  // A footnote no reference led to stays as MD View shows it: at the end, smaller and muted.
  for (const [footnoteId, hastFootnoteDefinition] of noteWalk.footnoteDefinitionsById) {
    if (noteWalk.placedFootnoteIds.has(footnoteId)) continue
    appendDocxExportBlocks(
      hastFootnoteDefinition.children,
      { ...bodyBlockPlace, blockTextColor: getDocxExportPrintColor('--color-papeliz-ink-muted'), blockTextSizePoints: papelizExportPrintTextSizesInPoints.footnotesTextSizePoints },
      noteWalk,
      docxExportBlocks,
    )
  }
  return { docxExportBlocks, docxExportNumberedListStarts: noteWalk.docxExportNumberedListStarts, docxExportBookmarkNamesByHeadingId }
}
