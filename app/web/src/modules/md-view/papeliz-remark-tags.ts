import type { Parent, PhrasingContent, Root, Text } from 'mdast'
import type { Plugin } from 'unified'
import { SKIP, visit } from 'unist-util-visit'

// `#tag` and `#nested/tag` in running text become a `papelizTag` node, shown as a chip. A tag needs
// at least one letter, so "#1" and "C#" stay plain text.
export interface PapelizTagMdastNode {
  type: 'papelizTag'
  papelizTagName: string
  data?: {
    hName?: string
    hProperties?: Record<string, string | string[]>
    hChildren?: Array<{ type: 'text'; value: string }>
  }
}

declare module 'mdast' {
  interface PhrasingContentMap {
    papelizTag: PapelizTagMdastNode
  }
  interface RootContentMap {
    papelizTag: PapelizTagMdastNode
  }
}

export const papelizMdViewTagClassName = 'papeliz-md-view-tag'

const papelizTagPattern = /(^|[\s(])#([\p{L}\p{N}_\-/]*[\p{L}_][\p{L}\p{N}_\-/]*)/gu

export function splitTextIntoTagNodes(textValue: string): PhrasingContent[] | null {
  const splitPhrasingNodes: PhrasingContent[] = []
  let textCursorIndex = 0
  for (const tagMatch of textValue.matchAll(papelizTagPattern)) {
    const tagLeadingText = tagMatch[1] ?? ''
    const papelizTagName = (tagMatch[2] ?? '').replace(/\/+$/, '')
    const tagStartIndex = (tagMatch.index ?? 0) + tagLeadingText.length
    if (papelizTagName.length === 0) continue
    if (tagStartIndex > textCursorIndex) splitPhrasingNodes.push({ type: 'text', value: textValue.slice(textCursorIndex, tagStartIndex) })
    splitPhrasingNodes.push({
      type: 'papelizTag',
      papelizTagName,
      data: {
        hName: 'span',
        hProperties: { className: [papelizMdViewTagClassName], dataPapelizTagName: papelizTagName },
        hChildren: [{ type: 'text', value: `#${papelizTagName}` }],
      },
    })
    textCursorIndex = tagStartIndex + 1 + papelizTagName.length
  }
  if (splitPhrasingNodes.length === 0) return null
  if (textCursorIndex < textValue.length) splitPhrasingNodes.push({ type: 'text', value: textValue.slice(textCursorIndex) })
  return splitPhrasingNodes
}

export const remarkPapelizTags: Plugin<[], Root> = () => (mdastRoot) => {
  visit(mdastRoot, 'text', (textNode: Text, textNodeIndex, textNodeParent: Parent | undefined) => {
    if (textNodeParent === undefined || textNodeIndex === undefined) return
    if (textNodeParent.type === 'link' || textNodeParent.type === 'linkReference' || textNodeParent.type === 'heading') return
    const splitPhrasingNodes = splitTextIntoTagNodes(textNode.value)
    if (splitPhrasingNodes === null) return
    textNodeParent.children.splice(textNodeIndex, 1, ...splitPhrasingNodes)
    return [SKIP, textNodeIndex + splitPhrasingNodes.length]
  })
}
