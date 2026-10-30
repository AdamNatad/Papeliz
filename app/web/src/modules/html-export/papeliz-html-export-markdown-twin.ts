import type { Definition, Image, Link, Root as MdastRoot } from 'mdast'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { getPapelizWikilinkDisplayText, parsePapelizWikilinkInnerText, type PapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { getVaultEntryName } from '../vault/papeliz-vault-relative-paths'
import { createPapelizHtmlExportHeadingIdMaker } from './papeliz-html-export-heading-ids'
import { getPapelizHtmlExportPictureMediaType, type PapelizHtmlExportVaultFileResolver } from './papeliz-html-export-vault-files'

// Each page of an exported website has a Markdown twin beside it (`launch-plan.html` and
// `launch-plan.md`), so search engines and AI tools can read the note as plain Markdown. A twin is
// the note as written, made portable: wikilinks become ordinary Markdown links to the other twins,
// links to `.md` notes point at their twins, and pictures and files point at their copies. A link
// to a note that isn't in the export becomes its text. Code, frontmatter and diagrams stay exactly
// as written.

export interface PapelizHtmlExportMarkdownTwinOptions {
  vaultNoteRelativePath: string
  vaultNoteText: string
  resolveWikilinkTarget: PapelizWikilinkTargetResolver
  // The link from this twin to a note's twin (this note's own included), or null when that note
  // isn't in the export.
  getHtmlExportNoteTwinHref: (targetVaultNoteRelativePath: string) => string | null
  // The vault's files that aren't notes; null leaves links to them as written.
  resolveVaultFileReference: PapelizHtmlExportVaultFileResolver | null
  // The link from this twin to a vault file's copy.
  getHtmlExportVaultFileTwinHref: (vaultFileRelativePath: string) => string
}

// The same wikilink pattern MD View reads (papeliz-remark-wikilinks.ts).
const papelizMarkdownTwinWikilinkPattern = /(!?)\[\[([^[\]\n]+?)\]\]/g
// "300" or "300x200" after the bar in `![[plan.png|300]]`: a size, not words for the picture.
const papelizMarkdownTwinPictureSizePattern = /^\d{1,5}(x\d{1,5})?$/

interface PapelizMarkdownTwinTextEdit {
  editStartOffset: number
  editEndOffset: number
  replacementText: string
}

// What a link's name or path leads to: a note (its twin, or null when it isn't exported) or a
// vault file (its copy).
type PapelizMarkdownTwinLinkTarget = { linkTargetKind: 'note'; noteTwinHref: string | null } | { linkTargetKind: 'file'; vaultFileRelativePath: string; vaultFileHref: string }

function escapeMarkdownLinkText(linkText: string): string {
  return linkText.replace(/[\\`*_[\]|<>]/g, '\\$&')
}

// Site paths are already URL-encoded; a destination with a space or a parenthesis (from a note's
// own `#part`) goes in angle brackets.
function formatMarkdownLinkDestination(linkHref: string): string {
  return /[\s()<>]/.test(linkHref) ? `<${linkHref.replace(/[<>]/g, encodeURIComponent)}>` : linkHref
}

function isExternalLinkHref(linkHref: string): boolean {
  return /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(linkHref)
}

function decodeLinkHrefPart(linkHrefPart: string): string {
  try {
    return decodeURIComponent(linkHrefPart)
  } catch {
    return linkHrefPart
  }
}

// Where a parsed node sits in the note's text. (MD View's own node types, such as tags, may carry
// no position type, so any node is taken.)
function getNodeOffsets(mdastNode: object): [number, number] | null {
  const nodePosition = (mdastNode as { position?: { start: { offset?: number }; end: { offset?: number } } }).position
  const nodeStartOffset = nodePosition?.start.offset
  const nodeEndOffset = nodePosition?.end.offset
  return nodeStartOffset === undefined || nodeEndOffset === undefined ? null : [nodeStartOffset, nodeEndOffset]
}

export function buildPapelizHtmlExportMarkdownTwin(twinOptions: PapelizHtmlExportMarkdownTwinOptions): string {
  const { vaultNoteText } = twinOptions
  const noteMdastRoot: MdastRoot = unified().use(remarkParse).use(remarkFrontmatter, ['yaml']).use(remarkGfm).parse(vaultNoteText)
  const textEdits: PapelizMarkdownTwinTextEdit[] = []

  const findVaultFileTarget = (vaultFileReference: string): PapelizMarkdownTwinLinkTarget | null => {
    const targetVaultFileRelativePath = twinOptions.resolveVaultFileReference?.(vaultFileReference, twinOptions.vaultNoteRelativePath) ?? null
    if (targetVaultFileRelativePath === null) return null
    return { linkTargetKind: 'file', vaultFileRelativePath: targetVaultFileRelativePath, vaultFileHref: twinOptions.getHtmlExportVaultFileTwinHref(targetVaultFileRelativePath) }
  }
  // A note first, as MD View opens links, then a vault file; null when neither is there.
  const findLinkTarget = (linkTargetName: string, linkHrefFragment: string): PapelizMarkdownTwinLinkTarget | null => {
    const targetVaultNoteRelativePath = twinOptions.resolveWikilinkTarget(linkTargetName, twinOptions.vaultNoteRelativePath)
    if (targetVaultNoteRelativePath === null) return findVaultFileTarget(linkTargetName)
    const targetTwinHref = twinOptions.getHtmlExportNoteTwinHref(targetVaultNoteRelativePath)
    return { linkTargetKind: 'note', noteTwinHref: targetTwinHref === null ? null : `${targetTwinHref}${linkHrefFragment}` }
  }

  // Wikilinks anywhere but in code, raw HTML, the frontmatter or a link's label, as in MD View.
  const untouchedRanges: Array<[number, number]> = []
  const untouchedNodeTypes: ReadonlySet<string> = new Set(['code', 'inlineCode', 'html', 'yaml', 'link', 'linkReference'])
  visit(noteMdastRoot, (mdastNode) => {
    if (!untouchedNodeTypes.has(mdastNode.type)) return
    const nodeOffsets = getNodeOffsets(mdastNode)
    if (nodeOffsets !== null) untouchedRanges.push(nodeOffsets)
  })
  for (const wikilinkMatch of vaultNoteText.matchAll(papelizMarkdownTwinWikilinkPattern)) {
    const wikilinkStartOffset = wikilinkMatch.index ?? 0
    const wikilinkEndOffset = wikilinkStartOffset + wikilinkMatch[0].length
    if (untouchedRanges.some(([rangeStartOffset, rangeEndOffset]) => wikilinkStartOffset < rangeEndOffset && wikilinkEndOffset > rangeStartOffset)) continue
    const wikilinkParts = parsePapelizWikilinkInnerText(wikilinkMatch[2] ?? '')
    const wikilinkHeadingFragment = wikilinkParts.wikilinkTargetHeading === null ? '' : `#${createPapelizHtmlExportHeadingIdMaker()(wikilinkParts.wikilinkTargetHeading)}`
    const wikilinkDisplayText = getPapelizWikilinkDisplayText(wikilinkParts)
    const wikilinkTarget = findLinkTarget(wikilinkParts.wikilinkTargetNoteName, wikilinkHeadingFragment)
    let replacementText = escapeMarkdownLinkText(wikilinkDisplayText)
    if (wikilinkTarget?.linkTargetKind === 'note' && wikilinkTarget.noteTwinHref !== null) {
      replacementText = `[${replacementText}](${formatMarkdownLinkDestination(wikilinkTarget.noteTwinHref)})`
    } else if (wikilinkTarget?.linkTargetKind === 'file') {
      const isShownPicture = wikilinkMatch[1] === '!' && getPapelizHtmlExportPictureMediaType(wikilinkTarget.vaultFileRelativePath) !== null
      const pictureAltText = papelizMarkdownTwinPictureSizePattern.test(wikilinkDisplayText) ? getVaultEntryName(wikilinkTarget.vaultFileRelativePath) : wikilinkDisplayText
      replacementText = isShownPicture
        ? `![${escapeMarkdownLinkText(pictureAltText)}](${formatMarkdownLinkDestination(wikilinkTarget.vaultFileHref)})`
        : `[${replacementText}](${formatMarkdownLinkDestination(wikilinkTarget.vaultFileHref)})`
    }
    textEdits.push({ editStartOffset: wikilinkStartOffset, editEndOffset: wikilinkEndOffset, replacementText })
  }

  // `[text](Other note.md#part)`, `[ref]: Other note.md` and `![alt](pictures/plan.png)`: MD View
  // opens a link as it opens a wikilink to the same name; a picture points at its copy.
  const pointDestinationAtTarget = (mdastLinkNode: Link | Definition | Image, destinationSearchStartOffset: number, destinationPattern: RegExp): void => {
    const linkHref = mdastLinkNode.url
    if (linkHref.length === 0 || linkHref.startsWith('#') || isExternalLinkHref(linkHref)) return
    const nodeOffsets = getNodeOffsets(mdastLinkNode)
    if (nodeOffsets === null) return
    const linkHrefFragmentIndex = linkHref.indexOf('#')
    const linkHrefPath = linkHrefFragmentIndex === -1 ? linkHref : linkHref.slice(0, linkHrefFragmentIndex)
    const linkHrefFragment = linkHrefFragmentIndex === -1 ? '' : linkHref.slice(linkHrefFragmentIndex)
    const linkTarget =
      mdastLinkNode.type === 'image' ? findVaultFileTarget(decodeLinkHrefPart(linkHrefPath.replace(/\?.*$/, ''))) : findLinkTarget(decodeLinkHrefPart(linkHrefPath), linkHrefFragment)
    const targetHref = linkTarget === null ? null : linkTarget.linkTargetKind === 'note' ? linkTarget.noteTwinHref : linkTarget.vaultFileHref
    if (targetHref === null) {
      // A link to a note outside the export keeps only its text; a picture stays as written.
      if (mdastLinkNode.type === 'link') {
        const firstLabelOffsets = mdastLinkNode.children[0] === undefined ? null : getNodeOffsets(mdastLinkNode.children[0])
        const lastLabelOffsets = mdastLinkNode.children.at(-1) === undefined ? null : getNodeOffsets(mdastLinkNode.children.at(-1) as Link['children'][number])
        const labelSourceText = firstLabelOffsets === null || lastLabelOffsets === null ? '' : vaultNoteText.slice(firstLabelOffsets[0], lastLabelOffsets[1])
        textEdits.push({ editStartOffset: nodeOffsets[0], editEndOffset: nodeOffsets[1], replacementText: labelSourceText })
      }
      return
    }
    const destinationMatch = destinationPattern.exec(vaultNoteText.slice(destinationSearchStartOffset, nodeOffsets[1]))
    if (destinationMatch === null) return
    const destinationStartOffset = destinationSearchStartOffset + destinationMatch.index + (destinationMatch[1]?.length ?? 0)
    textEdits.push({
      editStartOffset: destinationStartOffset,
      editEndOffset: destinationStartOffset + (destinationMatch[2]?.length ?? 0),
      replacementText: formatMarkdownLinkDestination(linkTarget?.linkTargetKind === 'note' ? targetHref : `${targetHref}${linkHrefFragment}`),
    })
  }
  visit(noteMdastRoot, 'link', (mdastLinkNode: Link) => {
    const nodeOffsets = getNodeOffsets(mdastLinkNode)
    if (nodeOffsets === null) return
    const lastLabelOffsets = mdastLinkNode.children.at(-1) === undefined ? null : getNodeOffsets(mdastLinkNode.children.at(-1) as Link['children'][number])
    // The destination follows the label's "](" (an empty label is just "[]").
    pointDestinationAtTarget(mdastLinkNode, lastLabelOffsets?.[1] ?? nodeOffsets[0] + 1, /^(\]\(\s*)(<[^>\n]*>|[^\s)]+)/)
  })
  visit(noteMdastRoot, 'definition', (mdastDefinitionNode: Definition) => {
    const nodeOffsets = getNodeOffsets(mdastDefinitionNode)
    if (nodeOffsets !== null) pointDestinationAtTarget(mdastDefinitionNode, nodeOffsets[0], /^(\s*\[[^\]]*\]:\s*)(<[^>\n]*>|\S+)/)
  })
  visit(noteMdastRoot, 'image', (mdastImageNode: Image) => {
    const nodeOffsets = getNodeOffsets(mdastImageNode)
    // The destination follows the alt text's "](", the alt text written with its own escapes.
    if (nodeOffsets !== null) pointDestinationAtTarget(mdastImageNode, nodeOffsets[0], /^(!\[(?:\\.|[^\]\\])*\]\(\s*)(<[^>\n]*>|[^\s)]+)/)
  })

  // Applied from the end, so earlier offsets stay right; an edit overlapping one already made is
  // skipped.
  let twinText = vaultNoteText
  let previousEditStartOffset = Number.POSITIVE_INFINITY
  for (const textEdit of [...textEdits].sort((firstEdit, secondEdit) => secondEdit.editStartOffset - firstEdit.editStartOffset)) {
    if (textEdit.editEndOffset > previousEditStartOffset) continue
    twinText = `${twinText.slice(0, textEdit.editStartOffset)}${textEdit.replacementText}${twinText.slice(textEdit.editEndOffset)}`
    previousEditStartOffset = textEdit.editStartOffset
  }
  return twinText
}
