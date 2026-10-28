import type { Blockquote, Paragraph, PhrasingContent, Root } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

// A quote whose first line is `[!kind]` (with an optional title after it) becomes a callout:
//   > [!tip] Keep it short
//   > The body of the callout.
// `[!kind|color]` picks the card's color: red, orange, yellow, green, teal, blue, purple, pink, gray,
// or any hex color such as #7c3aed.
// In the Markdown it stays an ordinary quote, so the note reads fine in any Markdown app.

export const papelizMdViewCalloutClassName = 'papeliz-md-view-callout'
export const papelizMdViewCalloutTitleClassName = 'papeliz-md-view-callout-title'
export const papelizMdViewCalloutBodyClassName = 'papeliz-md-view-callout-body'

const papelizCalloutFirstLinePattern = /^\[!([A-Za-z][\w-]*)(?:\|([A-Za-z-]+|#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}))?\][+-]?[ \t]*/

function getDefaultCalloutTitle(papelizCalloutKind: string): string {
  return papelizCalloutKind.charAt(0).toUpperCase() + papelizCalloutKind.slice(1).replace(/-/g, ' ')
}

function trimTrailingWhitespace(calloutTitleChildren: PhrasingContent[]): PhrasingContent[] {
  const lastTitleChild = calloutTitleChildren[calloutTitleChildren.length - 1]
  if (lastTitleChild?.type === 'text') {
    const trimmedValue = lastTitleChild.value.trimEnd()
    return trimmedValue.length > 0
      ? [...calloutTitleChildren.slice(0, -1), { ...lastTitleChild, value: trimmedValue }]
      : calloutTitleChildren.slice(0, -1)
  }
  return calloutTitleChildren
}

export const remarkPapelizCallouts: Plugin<[], Root> = () => (mdastRoot) => {
  visit(mdastRoot, 'blockquote', (blockquoteNode: Blockquote) => {
    const firstParagraph = blockquoteNode.children[0]
    if (firstParagraph?.type !== 'paragraph') return
    const firstPhrasingNode = firstParagraph.children[0]
    if (firstPhrasingNode?.type !== 'text') return
    const calloutFirstLineMatch = papelizCalloutFirstLinePattern.exec(firstPhrasingNode.value)
    if (calloutFirstLineMatch === null) return
    const papelizCalloutKind = (calloutFirstLineMatch[1] ?? 'note').toLowerCase()
    const papelizCalloutColor = calloutFirstLineMatch[2]?.toLowerCase().replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/, '#$1$1$2$2$3$3')

    // The title is the rest of the first line; everything after the first line break is the body.
    let calloutTitleChildren: PhrasingContent[] = []
    const calloutBodyFirstChildren: PhrasingContent[] = []
    let isReadingCalloutTitle = true
    firstParagraph.children.forEach((paragraphChild, paragraphChildIndex) => {
      const currentChild: PhrasingContent =
        paragraphChildIndex === 0 ? { type: 'text', value: firstPhrasingNode.value.slice(calloutFirstLineMatch[0].length) } : paragraphChild
      if (!isReadingCalloutTitle) {
        calloutBodyFirstChildren.push(currentChild)
        return
      }
      if (currentChild.type === 'break') {
        isReadingCalloutTitle = false
        return
      }
      if (currentChild.type === 'text') {
        const lineBreakIndex = currentChild.value.indexOf('\n')
        if (lineBreakIndex === -1) {
          if (currentChild.value.length > 0) calloutTitleChildren.push(currentChild)
          return
        }
        if (lineBreakIndex > 0) calloutTitleChildren.push({ type: 'text', value: currentChild.value.slice(0, lineBreakIndex) })
        const bodyText = currentChild.value.slice(lineBreakIndex + 1)
        if (bodyText.length > 0) calloutBodyFirstChildren.push({ type: 'text', value: bodyText })
        isReadingCalloutTitle = false
        return
      }
      calloutTitleChildren.push(currentChild)
    })
    calloutTitleChildren = trimTrailingWhitespace(calloutTitleChildren)

    const calloutTitleParagraph: Paragraph = {
      type: 'paragraph',
      children: calloutTitleChildren.length > 0 ? calloutTitleChildren : [{ type: 'text', value: getDefaultCalloutTitle(papelizCalloutKind) }],
      data: {
        hName: 'div',
        hProperties: { className: [papelizMdViewCalloutTitleClassName], dataPapelizCalloutKind: papelizCalloutKind },
      },
    }
    const calloutBodyBlocks: Blockquote['children'] = []
    if (calloutBodyFirstChildren.length > 0) calloutBodyBlocks.push({ ...firstParagraph, children: calloutBodyFirstChildren })
    calloutBodyBlocks.push(...blockquoteNode.children.slice(1))

    blockquoteNode.children =
      calloutBodyBlocks.length > 0
        ? [
            calloutTitleParagraph,
            {
              type: 'blockquote',
              children: calloutBodyBlocks,
              data: { hName: 'div', hProperties: { className: [papelizMdViewCalloutBodyClassName] } },
            },
          ]
        : [calloutTitleParagraph]
    blockquoteNode.data = {
      ...blockquoteNode.data,
      hName: 'div',
      hProperties: {
        className: [papelizMdViewCalloutClassName],
        dataPapelizCalloutKind: papelizCalloutKind,
        ...(papelizCalloutColor === undefined ? {} : { dataPapelizCalloutColor: papelizCalloutColor }),
      },
    }
  })
}
