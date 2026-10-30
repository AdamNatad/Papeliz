import type { Element as HastElement, ElementContent as HastElementContent, Root as HastRoot } from 'hast'
import { visit } from 'unist-util-visit'
import { getPapelizExportPrintColor, type PapelizExportPrintColorToken, papelizExportPrintColorsByToken } from '../export-print-style/papeliz-export-print-style'
import { createPapelizHtmlExportHeadingIdMaker } from '../html-export/papeliz-html-export-heading-ids'
import type { PapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { readPapelizNoteFrontmatterProperties } from '../md-view/papeliz-note-frontmatter-properties'
import { papelizMdViewCalloutClassName } from '../md-view/papeliz-remark-callouts'
import { papelizMdViewTagClassName } from '../md-view/papeliz-remark-tags'
import { papelizMdViewStyledTextClassName } from '../md-view/papeliz-remark-text-styles'
import { papelizMdViewUnresolvedWikilinkClassName } from '../md-view/papeliz-remark-wikilinks'
import { isPapelizTextColorValue, isPapelizTextSizeValue } from '../note-editor/papeliz-note-text-style'
import { parsePapelizHexColor } from '../ui/papeliz-color-values'
import type { PapelizNoteFontFamily } from '../workspace/papeliz-note-typography-store'
import {
  checkPapelizPdfExportWebLinkAddress,
  createPapelizPdfExportFootnoteDestinationName,
  createPapelizPdfExportFootnoteReferenceDestinationName,
  createPapelizPdfExportHeadingDestinationName,
} from './papeliz-pdf-export-links'
import {
  listPapelizPdfExportNoteBlockInlineRuns,
  visitPapelizPdfExportNoteBlocks,
  type PapelizPdfExportFootnote,
  type PapelizPdfExportHeadingLevel,
  type PapelizPdfExportInlineRun,
  type PapelizPdfExportLinkTarget,
  type PapelizPdfExportListItem,
  type PapelizPdfExportNoteBlock,
  type PapelizPdfExportNoteDocument,
  type PapelizPdfExportTextRunChip,
  type PapelizPdfExportTextRunLink,
  type PapelizPdfExportTextRunLook,
} from './papeliz-pdf-export-note-document'

// MD View's sanitized tree -> the note document the PDF worker lays out. Headings, paragraphs, lists,
// task lists, quotes, code blocks, rules, footnotes and the note's properties keep MD View's look;
// links lead to the web or to their place in the note. A block the PDF doesn't draw yet (a table, a
// callout) prints as its Markdown source in a code box, so nothing is left out.

export interface PapelizPdfExportNoteDocumentOptions {
  noteHastRoot: HastRoot
  // The text the tree's positions point into (the note's text with wikilink pipes in tables escaped).
  noteParsedText: string
  noteFrontmatterText: string | null
  noteFontFamily: PapelizNoteFontFamily
  // The note's own path and the vault's links, so a link to this note's heading finds its place.
  vaultNoteRelativePath: string
  resolveWikilinkTarget: PapelizWikilinkTargetResolver
}

const papelizPdfExportBlockTagNames: ReadonlySet<string> = new Set([
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

const papelizPdfExportHeadingLevelsByTagName: ReadonlyMap<string, PapelizPdfExportHeadingLevel> = new Map([
  ['h1', 1],
  ['h2', 2],
  ['h3', 3],
  ['h4', 4],
  ['h5', 5],
  ['h6', 6],
])

// Inline code: 0.86em of the text around it, on MD View's gray, with 1px × 5px padding and 6px
// corners at 0.86 × 17px.
const papelizPdfExportInlineCodeSizeRatio = 0.86
const papelizPdfExportInlineCodeChip: PapelizPdfExportTextRunChip = {
  chipGroundColor: papelizExportPrintColorsByToken['--color-papeliz-surface-gray'],
  chipPaddingHorizontalEm: 5 / (17 * papelizPdfExportInlineCodeSizeRatio),
  chipPaddingVerticalEm: 1 / (17 * papelizPdfExportInlineCodeSizeRatio),
  chipCornerRadiusEm: 6 / (17 * papelizPdfExportInlineCodeSizeRatio),
  chipHeightEm: null,
}

// A tag: 13px text, 500, in a round 24px chip with 9px sides.
const papelizPdfExportTagTextSizePoints = (13 * 11) / 17
const papelizPdfExportTagChip: PapelizPdfExportTextRunChip = {
  chipGroundColor: papelizExportPrintColorsByToken['--color-papeliz-blue-soft'],
  chipPaddingHorizontalEm: 9 / 13,
  chipPaddingVerticalEm: 0,
  chipCornerRadiusEm: 12 / 13,
  chipHeightEm: 24 / 13,
}

// A picture shown as a line: MD View's gray chip with the muted ink.
const papelizPdfExportPictureLineChip: PapelizPdfExportTextRunChip = { ...papelizPdfExportInlineCodeChip, chipPaddingHorizontalEm: 5 / 17, chipPaddingVerticalEm: 1 / 17, chipCornerRadiusEm: 6 / 17 }

// Superscript and subscript text, as the browser draws <sup> and <sub>.
const papelizPdfExportShiftedTextSizeRatio = 0.83

// The arrow at a footnote's end that leads back to its reference (MD View's "↩").
const papelizPdfExportFootnoteBackArrowText = '↩'

function getPrintColor(printColorToken: PapelizExportPrintColorToken): string {
  return papelizExportPrintColorsByToken[printColorToken]
}

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
  return hastNode.type === 'element' && papelizPdfExportBlockTagNames.has(hastNode.tagName)
}

function decodeLinkHrefPart(linkHrefPart: string): string {
  try {
    return decodeURIComponent(linkHrefPart)
  } catch {
    return linkHrefPart
  }
}

// "user-content-user-content-fn-first" -> "fn-first": the sanitizer prefixes ids again, so a
// reference's link and its footnote's id are compared without the prefixes.
function normalizeFootnoteId(footnoteIdText: string): string {
  return footnoteIdText.replace(/^#/, '').replace(/^(user-content-)+/, '')
}

// A styled text color (a card color's name or a hex), as MD View draws it on the light theme.
function readStyledTextColor(hastElement: HastElement): string | null {
  const textColorValue = getHastStringProperty(hastElement, 'dataPapelizTextColor')
  if (textColorValue === null || !isPapelizTextColorValue(textColorValue)) return null
  return parsePapelizHexColor(textColorValue) ?? getPapelizExportPrintColor(`--color-papeliz-callout-${textColorValue}-ink`)
}

// "1.25em": a styled size, relative to the text around it.
function readStyledTextSizeRatio(hastElement: HastElement): number | null {
  const textSizeValue = getHastStringProperty(hastElement, 'dataPapelizTextSize')
  return textSizeValue !== null && isPapelizTextSizeValue(textSizeValue) ? Number.parseFloat(textSizeValue) : null
}

function createPlainTextRunLook(): PapelizPdfExportTextRunLook {
  return {
    textRunFontWeight: null,
    isTextRunItalic: false,
    isTextRunMonospace: false,
    textRunColor: null,
    textRunSizeRatio: 1,
    textRunFixedSizePoints: null,
    textRunUnderline: null,
    isTextRunStruck: false,
    textRunBaselineShift: null,
    textRunChip: null,
  }
}

interface PapelizPdfExportNoteWalk {
  noteDocumentOptions: PapelizPdfExportNoteDocumentOptions
  headingIdsByElement: Map<HastElement, string>
  headingDestinationNamesByHeadingId: Map<string, string>
  footnoteDestinationNamesByFootnoteId: Map<string, string>
  // Filled as references are read: a footnote links back only to a reference the PDF shows.
  referenceDestinationNamesByReferenceId: Map<string, string>
  nextNoteLinkNumber: number
}

// How inline content is read: its look, and the link it is part of.
interface PapelizPdfExportInlineWalk {
  noteWalk: PapelizPdfExportNoteWalk
  textRunLook: PapelizPdfExportTextRunLook
  textRunLink: PapelizPdfExportTextRunLink | null
}

function createTextRunLink(noteLinkTarget: PapelizPdfExportLinkTarget, noteLinkDescription: string, noteWalk: PapelizPdfExportNoteWalk): PapelizPdfExportTextRunLink {
  const noteLinkNumber = noteWalk.nextNoteLinkNumber
  noteWalk.nextNoteLinkNumber += 1
  return { noteLinkNumber, noteLinkTarget, noteLinkDescription: noteLinkDescription.replace(/\s+/g, ' ').trim() }
}

function pushTextRun(textRunText: string, inlineWalk: PapelizPdfExportInlineWalk, inlineRuns: PapelizPdfExportInlineRun[], textRunDestinationName: string | null = null): void {
  if (textRunText.length > 0) inlineRuns.push({ inlineRunKind: 'text', textRunText, textRunLook: inlineWalk.textRunLook, textRunLink: inlineWalk.textRunLink, textRunDestinationName })
}

function appendInlineRuns(hastNodes: readonly HastElementContent[], inlineWalk: PapelizPdfExportInlineWalk, inlineRuns: PapelizPdfExportInlineRun[]): void {
  for (const hastNode of hastNodes) {
    if (hastNode.type === 'text') {
      pushTextRun(hastNode.value, inlineWalk, inlineRuns)
      continue
    }
    if (hastNode.type === 'element') appendInlineElement(hastNode, inlineWalk, inlineRuns)
  }
}

function appendInlineElement(hastElement: HastElement, inlineWalk: PapelizPdfExportInlineWalk, inlineRuns: PapelizPdfExportInlineRun[]): void {
  const { textRunLook } = inlineWalk
  const appendChildren = (childTextRunLook: PapelizPdfExportTextRunLook) => appendInlineRuns(hastElement.children, { ...inlineWalk, textRunLook: childTextRunLook }, inlineRuns)
  switch (hastElement.tagName) {
    case 'strong':
    case 'b':
      appendChildren({ ...textRunLook, textRunFontWeight: 600 })
      return
    case 'em':
    case 'i':
      appendChildren({ ...textRunLook, isTextRunItalic: true })
      return
    case 'del':
    case 's':
      appendChildren({ ...textRunLook, isTextRunStruck: true })
      return
    case 'u':
      appendChildren({ ...textRunLook, textRunUnderline: { underlineColor: null, isUnderlineDashed: false } })
      return
    case 'sup':
    case 'sub':
      appendChildren({
        ...textRunLook,
        textRunSizeRatio: textRunLook.textRunSizeRatio * papelizPdfExportShiftedTextSizeRatio,
        textRunBaselineShift: hastElement.tagName === 'sup' ? 'superscript' : 'subscript',
      })
      return
    case 'code':
    case 'kbd':
      appendChildren({
        ...textRunLook,
        isTextRunMonospace: true,
        textRunSizeRatio: textRunLook.textRunSizeRatio * papelizPdfExportInlineCodeSizeRatio,
        textRunChip: papelizPdfExportInlineCodeChip,
      })
      return
    case 'br':
      inlineRuns.push({ inlineRunKind: 'line-break' })
      return
    case 'input':
      // A task's box is drawn beside its list item.
      return
    case 'img': {
      const pictureLabel = getHastStringProperty(hastElement, 'alt') || getHastStringProperty(hastElement, 'src') || 'untitled'
      pushTextRun(`Picture: ${pictureLabel}`, { ...inlineWalk, textRunLook: { ...textRunLook, textRunColor: getPrintColor('--color-papeliz-ink-muted'), textRunChip: papelizPdfExportPictureLineChip } }, inlineRuns)
      return
    }
    case 'a':
      appendLink(hastElement, inlineWalk, inlineRuns)
      return
    case 'span':
      if (hasHastClassName(hastElement, papelizMdViewTagClassName)) {
        appendChildren({
          ...textRunLook,
          textRunColor: getPrintColor('--color-papeliz-blue'),
          textRunFontWeight: 500,
          textRunFixedSizePoints: papelizPdfExportTagTextSizePoints,
          textRunChip: papelizPdfExportTagChip,
        })
        return
      }
      if (hasHastClassName(hastElement, papelizMdViewStyledTextClassName)) {
        const styledTextSizeRatio = readStyledTextSizeRatio(hastElement)
        appendChildren({
          ...textRunLook,
          textRunColor: readStyledTextColor(hastElement) ?? textRunLook.textRunColor,
          textRunSizeRatio: styledTextSizeRatio === null ? textRunLook.textRunSizeRatio : textRunLook.textRunSizeRatio * styledTextSizeRatio,
        })
        return
      }
      appendChildren(textRunLook)
      return
    default:
      appendChildren(textRunLook)
  }
}

// The place in this note a link names: one of its headings, by id or (for a wikilink) by text.
function findHeadingDestinationName(headingId: string, noteWalk: PapelizPdfExportNoteWalk): string | null {
  const { headingDestinationNamesByHeadingId } = noteWalk
  return headingDestinationNamesByHeadingId.get(headingId) ?? headingDestinationNamesByHeadingId.get(headingId.toLowerCase()) ?? null
}

// What a link leads to: a checked web address, a place in this note, or nothing (another note, a
// heading that isn't there, an address that isn't a web link).
function resolveLinkTarget(hastAnchorElement: HastElement, noteWalk: PapelizPdfExportNoteWalk): PapelizPdfExportLinkTarget | null {
  const { resolveWikilinkTarget, vaultNoteRelativePath } = noteWalk.noteDocumentOptions
  const toNotePlace = (noteDestinationName: string | null): PapelizPdfExportLinkTarget | null =>
    noteDestinationName === null ? null : { linkTargetKind: 'note-place', noteDestinationName }
  const wikilinkTargetNoteName = getHastStringProperty(hastAnchorElement, 'dataPapelizWikilinkTarget')
  if (wikilinkTargetNoteName !== null) {
    const wikilinkTargetHeading = getHastStringProperty(hastAnchorElement, 'dataPapelizWikilinkHeading')
    if (wikilinkTargetHeading === null || resolveWikilinkTarget(wikilinkTargetNoteName, vaultNoteRelativePath) !== vaultNoteRelativePath) return null
    return toNotePlace(findHeadingDestinationName(createPapelizHtmlExportHeadingIdMaker()(wikilinkTargetHeading), noteWalk))
  }
  const linkHref = getHastStringProperty(hastAnchorElement, 'href')
  if (linkHref === null) return null
  if (/^[a-z][a-z0-9+.-]*:/i.test(linkHref)) {
    const webLinkAddress = checkPapelizPdfExportWebLinkAddress(linkHref)
    return webLinkAddress === null ? null : { linkTargetKind: 'web', webLinkAddress }
  }
  // `[text](#part)` and `[text](This note.md#part)`: MD View opens them as it opens wikilinks.
  const linkHrefFragmentIndex = linkHref.indexOf('#')
  if (linkHrefFragmentIndex === -1) return null
  const linkTargetName = decodeLinkHrefPart(linkHref.slice(0, linkHrefFragmentIndex))
  const isLinkToThisNote = linkTargetName.length === 0 || resolveWikilinkTarget(linkTargetName.replace(/\.md$/i, ''), vaultNoteRelativePath) === vaultNoteRelativePath
  return isLinkToThisNote ? toNotePlace(findHeadingDestinationName(decodeLinkHrefPart(linkHref.slice(linkHrefFragmentIndex + 1)), noteWalk)) : null
}

function appendLink(hastAnchorElement: HastElement, inlineWalk: PapelizPdfExportInlineWalk, inlineRuns: PapelizPdfExportInlineRun[]): void {
  const { noteWalk, textRunLook } = inlineWalk
  if (hasHastProperty(hastAnchorElement, 'dataFootnoteBackref')) {
    appendFootnoteBackLink(hastAnchorElement, inlineWalk, inlineRuns)
    return
  }
  if (hasHastClassName(hastAnchorElement, papelizMdViewUnresolvedWikilinkClassName)) {
    // A note that doesn't exist yet: muted, dashed underneath, as in MD View.
    appendInlineRuns(
      hastAnchorElement.children,
      {
        ...inlineWalk,
        textRunLook: { ...textRunLook, textRunColor: getPrintColor('--color-papeliz-ink-muted'), textRunUnderline: { underlineColor: getPrintColor('--color-papeliz-line-strong'), isUnderlineDashed: true } },
      },
      inlineRuns,
    )
    return
  }
  const linkTextRunLook: PapelizPdfExportTextRunLook = { ...textRunLook, textRunColor: getPrintColor('--color-papeliz-blue'), textRunFontWeight: 500 }
  // A link inside a link (a link in a footnote's reference) stays the outer one.
  if (inlineWalk.textRunLink !== null) {
    appendInlineRuns(hastAnchorElement.children, { ...inlineWalk, textRunLook: linkTextRunLook }, inlineRuns)
    return
  }
  const linkText = collectHastText(hastAnchorElement).trim()
  if (hasHastProperty(hastAnchorElement, 'dataFootnoteRef')) {
    // `[^first]`: a raised number that leads to the footnote, and the place its footnote leads back to.
    const footnoteDestinationName = noteWalk.footnoteDestinationNamesByFootnoteId.get(normalizeFootnoteId(getHastStringProperty(hastAnchorElement, 'href') ?? ''))
    const referenceId = getHastStringProperty(hastAnchorElement, 'id')
    let referenceDestinationName: string | null = null
    if (referenceId !== null) {
      referenceDestinationName = createPapelizPdfExportFootnoteReferenceDestinationName(noteWalk.referenceDestinationNamesByReferenceId.size + 1)
      noteWalk.referenceDestinationNamesByReferenceId.set(normalizeFootnoteId(referenceId), referenceDestinationName)
    }
    const footnoteReferenceWalk: PapelizPdfExportInlineWalk = {
      ...inlineWalk,
      textRunLook: linkTextRunLook,
      textRunLink: footnoteDestinationName === undefined ? null : createTextRunLink({ linkTargetKind: 'note-place', noteDestinationName: footnoteDestinationName }, `Footnote ${linkText}`, noteWalk),
    }
    pushTextRun(linkText, footnoteReferenceWalk, inlineRuns, referenceDestinationName)
    return
  }
  const linkTarget = resolveLinkTarget(hastAnchorElement, noteWalk)
  const linkDescription = linkText.length > 0 ? linkText : linkTarget?.linkTargetKind === 'web' ? linkTarget.webLinkAddress : ''
  appendInlineRuns(
    hastAnchorElement.children,
    { ...inlineWalk, textRunLook: linkTextRunLook, textRunLink: linkTarget === null ? null : createTextRunLink(linkTarget, linkDescription, noteWalk) },
    inlineRuns,
  )
}

// "↩" (and "↩²" for a second reference): a drawn arrow back to the footnote's reference. Left out
// when that reference isn't in the PDF (it sits in a block printed as its source).
function appendFootnoteBackLink(hastBackLinkElement: HastElement, inlineWalk: PapelizPdfExportInlineWalk, inlineRuns: PapelizPdfExportInlineRun[]): void {
  const { noteWalk } = inlineWalk
  const referenceDestinationName = noteWalk.referenceDestinationNamesByReferenceId.get(normalizeFootnoteId(getHastStringProperty(hastBackLinkElement, 'href') ?? ''))
  if (referenceDestinationName === undefined) return
  const backLinkWalk: PapelizPdfExportInlineWalk = {
    ...inlineWalk,
    textRunLook: { ...inlineWalk.textRunLook, textRunColor: getPrintColor('--color-papeliz-blue'), textRunFontWeight: 500 },
    textRunLink: createTextRunLink(
      { linkTargetKind: 'note-place', noteDestinationName: referenceDestinationName },
      getHastStringProperty(hastBackLinkElement, 'ariaLabel') ?? 'Back to the reference',
      noteWalk,
    ),
  }
  for (const hastChild of hastBackLinkElement.children) {
    if (hastChild.type === 'text') {
      hastChild.value.split(papelizPdfExportFootnoteBackArrowText).forEach((backLinkTextPart, backLinkTextPartIndex) => {
        if (backLinkTextPartIndex > 0) inlineRuns.push({ inlineRunKind: 'icon', inlineIconName: 'footnote-back-arrow', textRunLook: backLinkWalk.textRunLook, textRunLink: backLinkWalk.textRunLink })
        pushTextRun(backLinkTextPart, backLinkWalk, inlineRuns)
      })
      continue
    }
    if (hastChild.type === 'element') appendInlineElement(hastChild, backLinkWalk, inlineRuns)
  }
}

function isSameTextRunKind(firstInlineRun: PapelizPdfExportInlineRun, secondInlineRun: PapelizPdfExportInlineRun): boolean {
  if (firstInlineRun.inlineRunKind !== 'text' || secondInlineRun.inlineRunKind !== 'text' || secondInlineRun.textRunDestinationName !== null) return false
  return JSON.stringify([firstInlineRun.textRunLook, firstInlineRun.textRunLink]) === JSON.stringify([secondInlineRun.textRunLook, secondInlineRun.textRunLink])
}

// HTML's white space: runs of spaces and line ends are one space, none at a line's start or end.
// Neighbouring runs that look the same and share a link are joined. A no-break space (U+00A0) is kept.
function normalizePapelizPdfExportInlineRuns(inlineRuns: readonly PapelizPdfExportInlineRun[]): PapelizPdfExportInlineRun[] {
  const normalizedInlineRuns: PapelizPdfExportInlineRun[] = []
  let isAtLineStart = true
  let endsWithSpace = false
  const trimLastRunEnd = () => {
    const lastInlineRun = normalizedInlineRuns.at(-1)
    if (lastInlineRun?.inlineRunKind !== 'text') return
    lastInlineRun.textRunText = lastInlineRun.textRunText.replace(/ $/, '')
    if (lastInlineRun.textRunText.length === 0) normalizedInlineRuns.pop()
  }
  for (const inlineRun of inlineRuns) {
    if (inlineRun.inlineRunKind === 'line-break') {
      trimLastRunEnd()
      normalizedInlineRuns.push(inlineRun)
      isAtLineStart = true
      endsWithSpace = false
      continue
    }
    if (inlineRun.inlineRunKind === 'icon') {
      normalizedInlineRuns.push(inlineRun)
      isAtLineStart = false
      endsWithSpace = false
      continue
    }
    let runText = inlineRun.textRunText.replace(/[ \t\n\r\f]+/g, ' ')
    if ((isAtLineStart || endsWithSpace) && runText.startsWith(' ')) runText = runText.slice(1)
    if (runText.length === 0) continue
    const normalizedInlineRun: PapelizPdfExportInlineRun = { ...inlineRun, textRunText: runText }
    const lastInlineRun = normalizedInlineRuns.at(-1)
    if (lastInlineRun?.inlineRunKind === 'text' && isSameTextRunKind(lastInlineRun, normalizedInlineRun)) lastInlineRun.textRunText += runText
    else normalizedInlineRuns.push(normalizedInlineRun)
    isAtLineStart = false
    endsWithSpace = runText.endsWith(' ')
  }
  trimLastRunEnd()
  while (normalizedInlineRuns.at(-1)?.inlineRunKind === 'line-break') normalizedInlineRuns.pop()
  return normalizedInlineRuns
}

function buildInlineRuns(hastNodes: readonly HastElementContent[], noteWalk: PapelizPdfExportNoteWalk): PapelizPdfExportInlineRun[] {
  const inlineRuns: PapelizPdfExportInlineRun[] = []
  appendInlineRuns(hastNodes, { noteWalk, textRunLook: createPlainTextRunLook(), textRunLink: null }, inlineRuns)
  return normalizePapelizPdfExportInlineRuns(inlineRuns)
}

function pushParagraph(inlineRuns: PapelizPdfExportInlineRun[], hasParagraphSpacing: boolean, noteBlocks: PapelizPdfExportNoteBlock[]): void {
  if (inlineRuns.length > 0) noteBlocks.push({ noteBlockKind: 'paragraph', paragraphInlineRuns: inlineRuns, paragraphTextColor: null, hasParagraphSpacing })
}

// Code keeps its characters; a tab is four spaces, as code boxes print them.
function pushCodeBox(codeBoxText: string, noteBlocks: PapelizPdfExportNoteBlock[]): void {
  noteBlocks.push({ noteBlockKind: 'code-box', codeBoxText: codeBoxText.replace(/\r\n?/g, '\n').replace(/\t/g, '    ') })
}

// A block shown as its Markdown source. The tree keeps where each block came from; a block made by
// the Markdown reader itself has no source and is read for its blocks instead.
function appendBlockAsSource(hastElement: HastElement, noteWalk: PapelizPdfExportNoteWalk, noteBlocks: PapelizPdfExportNoteBlock[]): void {
  const sourceStartOffset = hastElement.position?.start.offset
  const sourceEndOffset = hastElement.position?.end.offset
  if (sourceStartOffset === undefined || sourceEndOffset === undefined) {
    appendBlocks(hastElement.children, noteWalk, noteBlocks)
    return
  }
  // Lines after the first carry the indent of the list the block sits in.
  const sourceIndentLength = (hastElement.position?.start.column ?? 1) - 1
  const blockSourceText = noteWalk.noteDocumentOptions.noteParsedText
    .slice(sourceStartOffset, sourceEndOffset)
    .split('\n')
    .map((sourceLine, sourceLineIndex) => (sourceLineIndex === 0 ? sourceLine : sourceLine.slice(Math.min(sourceIndentLength, sourceLine.length - sourceLine.trimStart().length))))
    .join('\n')
  pushCodeBox(blockSourceText, noteBlocks)
}

// Block content. Inline content between blocks (a tight list item's text) becomes a paragraph of its
// own, without a paragraph's gap, as MD View draws it.
function appendBlocks(hastNodes: readonly HastElementContent[], noteWalk: PapelizPdfExportNoteWalk, noteBlocks: PapelizPdfExportNoteBlock[]): void {
  let inlineHastNodes: HastElementContent[] = []
  const pushInlineHastNodes = () => {
    pushParagraph(buildInlineRuns(inlineHastNodes, noteWalk), false, noteBlocks)
    inlineHastNodes = []
  }
  for (const hastNode of hastNodes) {
    if (!isBlockHastNode(hastNode)) {
      inlineHastNodes.push(hastNode)
      continue
    }
    pushInlineHastNodes()
    appendBlockElement(hastNode as HastElement, noteWalk, noteBlocks)
  }
  pushInlineHastNodes()
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

function appendList(hastListElement: HastElement, noteWalk: PapelizPdfExportNoteWalk, noteBlocks: PapelizPdfExportNoteBlock[]): void {
  const isTaskList = hasHastClassName(hastListElement, 'contains-task-list')
  const listItems: PapelizPdfExportListItem[] = []
  for (const hastListItemElement of hastListElement.children) {
    if (hastListItemElement.type !== 'element' || hastListItemElement.tagName !== 'li') continue
    const taskCheckbox = isTaskList ? findTaskCheckbox(hastListItemElement) : null
    const listItemBlocks: PapelizPdfExportNoteBlock[] = []
    appendBlocks(hastListItemElement.children, noteWalk, listItemBlocks)
    listItems.push({ listItemBlocks, listItemTaskState: taskCheckbox === null ? null : hasHastProperty(taskCheckbox, 'checked') ? 'done' : 'to-do' })
  }
  if (listItems.length === 0) return
  noteBlocks.push({
    noteBlockKind: 'list',
    listKind: hastListElement.tagName === 'ol' ? 'numbered' : isTaskList ? 'task' : 'bullet',
    listStartNumber: hastListElement.tagName === 'ol' ? readNumberedListStart(hastListElement) : 1,
    listItems,
  })
}

// The section GitHub Markdown adds at the end: each footnote with its number, in the list's order.
function appendFootnotes(hastFootnotesElement: HastElement, noteWalk: PapelizPdfExportNoteWalk, noteBlocks: PapelizPdfExportNoteBlock[]): void {
  const noteFootnotes: PapelizPdfExportFootnote[] = []
  visit(hastFootnotesElement, 'element', (hastFootnoteElement: HastElement) => {
    const footnoteId = getHastStringProperty(hastFootnoteElement, 'id')
    if (hastFootnoteElement.tagName !== 'li' || footnoteId === null) return
    const footnoteDestinationName = noteWalk.footnoteDestinationNamesByFootnoteId.get(normalizeFootnoteId(footnoteId))
    if (footnoteDestinationName === undefined) return
    const footnoteBlocks: PapelizPdfExportNoteBlock[] = []
    appendBlocks(hastFootnoteElement.children, noteWalk, footnoteBlocks)
    noteFootnotes.push({ footnoteNumber: noteFootnotes.length + 1, footnoteDestinationName, footnoteBlocks })
  })
  if (noteFootnotes.length > 0) noteBlocks.push({ noteBlockKind: 'footnotes', noteFootnotes })
}

function appendBlockElement(hastElement: HastElement, noteWalk: PapelizPdfExportNoteWalk, noteBlocks: PapelizPdfExportNoteBlock[]): void {
  const headingLevel = papelizPdfExportHeadingLevelsByTagName.get(hastElement.tagName)
  if (headingLevel !== undefined) {
    // The footnotes' label is for screen readers; MD View doesn't show it.
    if (hasHastClassName(hastElement, 'sr-only')) return
    const headingInlineRuns = buildInlineRuns(hastElement.children, noteWalk)
    if (headingInlineRuns.length === 0) return
    const headingId = noteWalk.headingIdsByElement.get(hastElement) ?? ''
    noteBlocks.push({
      noteBlockKind: 'heading',
      headingLevel,
      headingId,
      headingDestinationName: noteWalk.headingDestinationNamesByHeadingId.get(headingId) ?? null,
      headingInlineRuns,
    })
    return
  }
  switch (hastElement.tagName) {
    case 'p':
      pushParagraph(buildInlineRuns(hastElement.children, noteWalk), true, noteBlocks)
      return
    case 'pre': {
      const hastCodeElement = findHastChildElement(hastElement, (hastChildElement) => hastChildElement.tagName === 'code')
      pushCodeBox(collectHastText(hastCodeElement ?? hastElement).replace(/\n$/, ''), noteBlocks)
      return
    }
    case 'ul':
    case 'ol':
      appendList(hastElement, noteWalk, noteBlocks)
      return
    case 'blockquote': {
      const quoteBlocks: PapelizPdfExportNoteBlock[] = []
      appendBlocks(hastElement.children, noteWalk, quoteBlocks)
      if (quoteBlocks.length > 0) noteBlocks.push({ noteBlockKind: 'quote', quoteBlocks })
      return
    }
    case 'hr':
      noteBlocks.push({ noteBlockKind: 'rule' })
      return
    case 'section':
      if (hasHastProperty(hastElement, 'dataFootnotes')) appendFootnotes(hastElement, noteWalk, noteBlocks)
      else appendBlocks(hastElement.children, noteWalk, noteBlocks)
      return
    case 'li':
      appendBlocks(hastElement.children, noteWalk, noteBlocks)
      return
    case 'div':
      // Callouts get MD View's cards in a later phase; until then they print as their source.
      if (hasHastClassName(hastElement, papelizMdViewCalloutClassName)) appendBlockAsSource(hastElement, noteWalk, noteBlocks)
      else appendBlocks(hastElement.children, noteWalk, noteBlocks)
      return
    default:
      appendBlockAsSource(hastElement, noteWalk, noteBlocks)
  }
}

// Every heading's GitHub-style id, as the HTML and Word exports give them, so `#launch-plan` means
// the same heading in all three.
function collectHeadingIds(noteHastRoot: HastRoot): Map<HastElement, string> {
  const makeHeadingId = createPapelizHtmlExportHeadingIdMaker()
  const headingIdsByElement = new Map<HastElement, string>()
  visit(noteHastRoot, 'element', (hastElement: HastElement) => {
    if (!papelizPdfExportHeadingLevelsByTagName.has(hastElement.tagName) || hastElement.properties['id'] !== undefined) return
    const headingId = makeHeadingId(collectHastText(hastElement))
    if (headingId.length > 0) headingIdsByElement.set(hastElement, headingId)
  })
  return headingIdsByElement
}

// Each footnote's place, by its id ("fn-first"), numbered in the footnotes' order.
function collectFootnoteDestinationNames(noteHastRoot: HastRoot): Map<string, string> {
  const footnoteDestinationNamesByFootnoteId = new Map<string, string>()
  visit(noteHastRoot, 'element', (hastElement: HastElement) => {
    if (hastElement.tagName !== 'section' || !hasHastProperty(hastElement, 'dataFootnotes')) return
    visit(hastElement, 'element', (hastFootnoteElement: HastElement) => {
      const footnoteId = getHastStringProperty(hastFootnoteElement, 'id')
      if (hastFootnoteElement.tagName !== 'li' || footnoteId === null) return
      footnoteDestinationNamesByFootnoteId.set(normalizeFootnoteId(footnoteId), createPapelizPdfExportFootnoteDestinationName(footnoteDestinationNamesByFootnoteId.size + 1))
    })
  })
  return footnoteDestinationNamesByFootnoteId
}

// A link to a place the PDF doesn't show (a heading inside a block printed as its source) keeps its
// look and loses its link.
function removeLinksWithoutPlace(noteBlocks: readonly PapelizPdfExportNoteBlock[]): void {
  const shownDestinationNames = new Set<string>()
  visitPapelizPdfExportNoteBlocks(noteBlocks, (noteBlock) => {
    if (noteBlock.noteBlockKind === 'heading' && noteBlock.headingDestinationName !== null) shownDestinationNames.add(noteBlock.headingDestinationName)
    if (noteBlock.noteBlockKind === 'footnotes') for (const noteFootnote of noteBlock.noteFootnotes) shownDestinationNames.add(noteFootnote.footnoteDestinationName)
    for (const inlineRun of listPapelizPdfExportNoteBlockInlineRuns(noteBlock)) {
      if (inlineRun.inlineRunKind === 'text' && inlineRun.textRunDestinationName !== null) shownDestinationNames.add(inlineRun.textRunDestinationName)
    }
  })
  visitPapelizPdfExportNoteBlocks(noteBlocks, (noteBlock) => {
    for (const inlineRun of listPapelizPdfExportNoteBlockInlineRuns(noteBlock)) {
      if (inlineRun.inlineRunKind === 'line-break') continue
      const noteLinkTarget = inlineRun.textRunLink?.noteLinkTarget
      if (noteLinkTarget?.linkTargetKind === 'note-place' && !shownDestinationNames.has(noteLinkTarget.noteDestinationName)) inlineRun.textRunLink = null
    }
  })
}

export function buildPapelizPdfExportNoteDocument(noteDocumentOptions: PapelizPdfExportNoteDocumentOptions): PapelizPdfExportNoteDocument {
  const noteBlocks: PapelizPdfExportNoteBlock[] = []
  if (noteDocumentOptions.noteFrontmatterText !== null) {
    const noteProperties = readPapelizNoteFrontmatterProperties(noteDocumentOptions.noteFrontmatterText).map(({ frontmatterPropertyName, frontmatterPropertyValues }) => ({
      notePropertyName: frontmatterPropertyName,
      notePropertyValuesText: frontmatterPropertyValues.join(', '),
    }))
    if (noteProperties.length > 0) noteBlocks.push({ noteBlockKind: 'properties', noteProperties })
  }
  const headingIdsByElement = collectHeadingIds(noteDocumentOptions.noteHastRoot)
  const headingDestinationNamesByHeadingId = new Map<string, string>()
  for (const headingId of headingIdsByElement.values()) {
    headingDestinationNamesByHeadingId.set(headingId, createPapelizPdfExportHeadingDestinationName(headingDestinationNamesByHeadingId.size + 1, headingId))
  }
  const noteWalk: PapelizPdfExportNoteWalk = {
    noteDocumentOptions,
    headingIdsByElement,
    headingDestinationNamesByHeadingId,
    footnoteDestinationNamesByFootnoteId: collectFootnoteDestinationNames(noteDocumentOptions.noteHastRoot),
    referenceDestinationNamesByReferenceId: new Map(),
    nextNoteLinkNumber: 1,
  }
  appendBlocks(noteDocumentOptions.noteHastRoot.children as HastElementContent[], noteWalk, noteBlocks)
  removeLinksWithoutPlace(noteBlocks)
  if (noteBlocks.length === 0) {
    noteBlocks.push({
      noteBlockKind: 'paragraph',
      paragraphInlineRuns: [{ inlineRunKind: 'text', textRunText: 'This note is empty.', textRunLook: createPlainTextRunLook(), textRunLink: null, textRunDestinationName: null }],
      paragraphTextColor: getPrintColor('--color-papeliz-ink-subtle'),
      hasParagraphSpacing: true,
    })
  }
  return { noteFontFamily: noteDocumentOptions.noteFontFamily, noteBlocks }
}
