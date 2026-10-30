import type { Parent, PhrasingContent, Root, Text } from 'mdast'
import type { Plugin } from 'unified'
import { SKIP, visit } from 'unist-util-visit'
import {
  getPapelizWikilinkDisplayText,
  parsePapelizWikilinkInnerText,
  type PapelizWikilinkParts,
  type PapelizWikilinkTargetResolver,
} from '../links/papeliz-wikilink-targets'

// `[[Note]]`, `[[Folder/Note#Heading|Label]]` and `![[Embed]]` become one `papelizWikilink` node,
// rendered as a link the MD View opens inside Papeliz. Embeds show as links until embeds arrive.
export interface PapelizWikilinkMdastNode extends PapelizWikilinkParts {
  type: 'papelizWikilink'
  wikilinkTargetVaultNoteRelativePath: string | null
  isWikilinkEmbed: boolean
  data?: {
    hName?: string
    hProperties?: Record<string, string | string[]>
    hChildren?: Array<{ type: 'text'; value: string }>
  }
}

declare module 'mdast' {
  interface PhrasingContentMap {
    papelizWikilink: PapelizWikilinkMdastNode
  }
  interface RootContentMap {
    papelizWikilink: PapelizWikilinkMdastNode
  }
}

export interface PapelizRemarkWikilinksOptions {
  resolveWikilinkTarget: PapelizWikilinkTargetResolver
  fromVaultNoteRelativePath: string | null
}

const papelizWikilinkPattern = /(!?)\[\[([^[\]\n]+?)\]\]/g

export const papelizMdViewWikilinkClassName = 'papeliz-md-view-wikilink'
export const papelizMdViewUnresolvedWikilinkClassName = 'papeliz-md-view-wikilink-unresolved'

export function createPapelizWikilinkMdastNode(
  wikilinkInnerText: string,
  isWikilinkEmbed: boolean,
  wikilinkOptions: PapelizRemarkWikilinksOptions,
): PapelizWikilinkMdastNode {
  const wikilinkParts = parsePapelizWikilinkInnerText(wikilinkInnerText)
  const wikilinkTargetVaultNoteRelativePath = wikilinkOptions.resolveWikilinkTarget(
    wikilinkParts.wikilinkTargetNoteName,
    wikilinkOptions.fromVaultNoteRelativePath,
  )
  const wikilinkHastProperties: Record<string, string | string[]> = {
    className:
      wikilinkTargetVaultNoteRelativePath === null
        ? [papelizMdViewWikilinkClassName, papelizMdViewUnresolvedWikilinkClassName]
        : [papelizMdViewWikilinkClassName],
    dataPapelizWikilinkTarget: wikilinkParts.wikilinkTargetNoteName,
  }
  // For an export: the part of the note a link points to, and whether `![[…]]` shows the target.
  if (wikilinkParts.wikilinkTargetHeading !== null) wikilinkHastProperties['dataPapelizWikilinkHeading'] = wikilinkParts.wikilinkTargetHeading
  if (isWikilinkEmbed) wikilinkHastProperties['dataPapelizWikilinkEmbed'] = 'true'
  return {
    type: 'papelizWikilink',
    ...wikilinkParts,
    wikilinkTargetVaultNoteRelativePath,
    isWikilinkEmbed,
    data: {
      hName: 'a',
      hProperties: wikilinkHastProperties,
      hChildren: [{ type: 'text', value: getPapelizWikilinkDisplayText(wikilinkParts) }],
    },
  }
}

export function splitTextIntoWikilinkNodes(textValue: string, wikilinkOptions: PapelizRemarkWikilinksOptions): PhrasingContent[] | null {
  const splitPhrasingNodes: PhrasingContent[] = []
  let textCursorIndex = 0
  for (const wikilinkMatch of textValue.matchAll(papelizWikilinkPattern)) {
    const wikilinkMatchIndex = wikilinkMatch.index ?? 0
    if (wikilinkMatchIndex > textCursorIndex) {
      splitPhrasingNodes.push({ type: 'text', value: textValue.slice(textCursorIndex, wikilinkMatchIndex) })
    }
    splitPhrasingNodes.push(createPapelizWikilinkMdastNode(wikilinkMatch[2] ?? '', wikilinkMatch[1] === '!', wikilinkOptions))
    textCursorIndex = wikilinkMatchIndex + wikilinkMatch[0].length
  }
  if (splitPhrasingNodes.length === 0) return null
  if (textCursorIndex < textValue.length) splitPhrasingNodes.push({ type: 'text', value: textValue.slice(textCursorIndex) })
  return splitPhrasingNodes
}

export const remarkPapelizWikilinks: Plugin<[PapelizRemarkWikilinksOptions], Root> = (wikilinkOptions) => (mdastRoot) => {
  visit(mdastRoot, 'text', (textNode: Text, textNodeIndex, textNodeParent: Parent | undefined) => {
    if (textNodeParent === undefined || textNodeIndex === undefined) return
    // Text that is already a link's label stays as it is.
    if (textNodeParent.type === 'link' || textNodeParent.type === 'linkReference') return
    const splitPhrasingNodes = splitTextIntoWikilinkNodes(textNode.value, wikilinkOptions)
    if (splitPhrasingNodes === null) return
    textNodeParent.children.splice(textNodeIndex, 1, ...splitPhrasingNodes)
    return [SKIP, textNodeIndex + splitPhrasingNodes.length]
  })
}
