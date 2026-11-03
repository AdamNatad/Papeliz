import type { syntaxTree } from '@codemirror/language'
import { parsePapelizWikilinkInnerText } from '../links/papeliz-wikilink-targets'
import {
  readPapelizMdViewImageAltTextSize,
  readPapelizMdViewMediaSource,
  readPapelizMdViewVaultMediaSource,
  readPapelizMdViewWikilinkEmbedLabel,
  readPapelizYouTubeVideoId,
  type PapelizMdViewMediaSource,
} from './papeliz-md-view-media-sources'
import { writePapelizMdViewImageAltTextWidth, writePapelizMdViewWikilinkEmbedInnerTextWidth } from './papeliz-md-view-picture-width'

// What the editable MD View reads from the note's Markdown to draw its pictures and videos: a
// picture's address, description, title and width, a `![[picture.png]]` embed, and a YouTube link
// alone on its line. Also where a new width goes when a picture is resized.

type PapelizMdViewSyntaxNode = ReturnType<ReturnType<typeof syntaxTree>['resolveInner']>

export interface PapelizMdViewImageSyntax {
  mdViewMediaSource: PapelizMdViewMediaSource
  mediaAlternativeText: string
  mediaTitle: string | null
  mediaWidthPixels: number | null
  mediaHeightPixels: number | null
}

// Where a picture's description sits: between `![` and `]`.
function findImageAltTextRange(imageNode: PapelizMdViewSyntaxNode): { imageAltTextFrom: number; imageAltTextTo: number } | null {
  const imageMarkNodes = imageNode.getChildren('LinkMark')
  const imageAltTextFrom = imageMarkNodes[0]?.to
  const imageAltTextTo = imageMarkNodes[1]?.from
  return imageAltTextFrom === undefined || imageAltTextTo === undefined ? null : { imageAltTextFrom, imageAltTextTo }
}

// `![description|300](address "title")`, or null when it isn't a whole picture (`![description][ref]`).
export function readPapelizMdViewImageSyntax(imageNode: PapelizMdViewSyntaxNode, readNoteText: (textFrom: number, textTo: number) => string): PapelizMdViewImageSyntax | null {
  const imageUrlNode = imageNode.getChild('URL')
  const imageAltTextRange = findImageAltTextRange(imageNode)
  if (imageUrlNode === null || imageAltTextRange === null) return null
  const imageTitleNode = imageNode.getChild('LinkTitle')
  return {
    mdViewMediaSource: readPapelizMdViewMediaSource(readNoteText(imageUrlNode.from, imageUrlNode.to)),
    ...readPapelizMdViewImageAltTextSize(readNoteText(imageAltTextRange.imageAltTextFrom, imageAltTextRange.imageAltTextTo)),
    mediaTitle: imageTitleNode === null ? null : readNoteText(imageTitleNode.from + 1, imageTitleNode.to - 1),
  }
}

export interface PapelizMdViewWikilinkEmbedSyntax {
  mdViewMediaSource: PapelizMdViewMediaSource
  mediaAlternativeText: string
  mediaWidthPixels: number | null
  mediaHeightPixels: number | null
}

const papelizMdViewWikilinkEmbedPattern = /^!\[\[([^[\]\n]+?)\]\]$/

// `![[picture.png]]`, `![[clip.mp4|480]]` or `![[plan.png|The plan]]`, which the Markdown parser reads
// as a picture with no address: the vault file it shows, or null for any other embed (a note's).
export function readPapelizMdViewWikilinkEmbedSyntax(imageText: string): PapelizMdViewWikilinkEmbedSyntax | null {
  const wikilinkEmbedMatch = papelizMdViewWikilinkEmbedPattern.exec(imageText)
  if (wikilinkEmbedMatch === null) return null
  const embedWikilinkParts = parsePapelizWikilinkInnerText(wikilinkEmbedMatch[1] ?? '')
  const embeddedMediaSource = readPapelizMdViewVaultMediaSource(embedWikilinkParts.wikilinkTargetNoteName)
  if (embeddedMediaSource.mediaSourceKind === 'not-shown') return null
  const wikilinkEmbedLabel = readPapelizMdViewWikilinkEmbedLabel(embedWikilinkParts.wikilinkLabel)
  return {
    mdViewMediaSource: embeddedMediaSource,
    mediaAlternativeText: wikilinkEmbedLabel.mediaAlternativeText ?? embedWikilinkParts.wikilinkTargetNoteName,
    mediaWidthPixels: wikilinkEmbedLabel.mediaWidthPixels,
    mediaHeightPixels: wikilinkEmbedLabel.mediaHeightPixels,
  }
}

export interface PapelizMdViewPictureWidthChange {
  from: number
  to: number
  insert: string
}

// The one edit that gives a picture a new width, or takes its width away (null): the text inside
// `![[ ]]`, or the description of `![description](address)`. Null when the text already says it, or
// when the node isn't a picture with a place for a width.
export function describePapelizMdViewPictureWidthChange(
  imageNode: PapelizMdViewSyntaxNode,
  readNoteText: (textFrom: number, textTo: number) => string,
  pictureWidthPixels: number | null,
): PapelizMdViewPictureWidthChange | null {
  const wikilinkEmbedMatch = papelizMdViewWikilinkEmbedPattern.exec(readNoteText(imageNode.from, imageNode.to))
  let pictureWidthChange: PapelizMdViewPictureWidthChange
  if (wikilinkEmbedMatch !== null) {
    // Inside `![[` and `]]`.
    pictureWidthChange = { from: imageNode.from + 3, to: imageNode.to - 2, insert: writePapelizMdViewWikilinkEmbedInnerTextWidth(wikilinkEmbedMatch[1] ?? '', pictureWidthPixels) }
  } else {
    const imageAltTextRange = findImageAltTextRange(imageNode)
    if (imageAltTextRange === null || imageNode.getChild('URL') === null) return null
    const { imageAltTextFrom, imageAltTextTo } = imageAltTextRange
    pictureWidthChange = { from: imageAltTextFrom, to: imageAltTextTo, insert: writePapelizMdViewImageAltTextWidth(readNoteText(imageAltTextFrom, imageAltTextTo), pictureWidthPixels) }
  }
  return readNoteText(pictureWidthChange.from, pictureWidthChange.to) === pictureWidthChange.insert ? null : pictureWidthChange
}

export interface PapelizMdViewLoneYouTubeLinkSyntax {
  youTubeVideoId: string
  // A Markdown link's text, or '' for a bare address.
  youTubeLinkText: string
}

// The YouTube video a paragraph is, when it holds nothing but one link to one: `[title](address)`,
// `<address>` or the bare address.
export function readPapelizMdViewLoneYouTubeLinkSyntax(
  paragraphNode: PapelizMdViewSyntaxNode,
  readNoteText: (textFrom: number, textTo: number) => string,
): PapelizMdViewLoneYouTubeLinkSyntax | null {
  const paragraphLinkNode = paragraphNode.firstChild
  if (paragraphLinkNode === null || paragraphLinkNode.nextSibling !== null) return null
  if (readNoteText(paragraphNode.from, paragraphNode.to).trim() !== readNoteText(paragraphLinkNode.from, paragraphLinkNode.to)) return null
  const linkUrlNode =
    paragraphLinkNode.name === 'URL' ? paragraphLinkNode : paragraphLinkNode.name === 'Link' || paragraphLinkNode.name === 'Autolink' ? paragraphLinkNode.getChild('URL') : null
  if (linkUrlNode === null) return null
  const youTubeVideoId = readPapelizYouTubeVideoId(readNoteText(linkUrlNode.from, linkUrlNode.to))
  if (youTubeVideoId === null) return null
  const linkMarkNodes = paragraphLinkNode.name === 'Link' ? paragraphLinkNode.getChildren('LinkMark') : []
  const linkTextFrom = linkMarkNodes[0]?.to
  const linkTextTo = linkMarkNodes[1]?.from
  const youTubeLinkText = linkTextFrom === undefined || linkTextTo === undefined ? '' : readNoteText(linkTextFrom, linkTextTo).trim()
  return { youTubeVideoId, youTubeLinkText }
}
