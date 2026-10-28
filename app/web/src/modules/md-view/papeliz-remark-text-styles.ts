import type { Parent, PhrasingContent, Root } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import { matchPapelizTextStyleOpenTag } from '../note-editor/papeliz-note-text-style'

// Styled text (a color and/or a size) for the rendered page. Raw HTML in a note is dropped, except
// this one exact form, `<span style="color: purple; font-size: 1.25em">words</span>`, which becomes
// a span carrying only the checked color and size as data attributes; the style itself is written
// after the sanitizer (see the render pipeline).

export const papelizMdViewStyledTextClassName = 'papeliz-md-view-styled-text'

export const remarkPapelizTextStyles: Plugin<[], Root> = () => (mdastRoot) => {
  visit(mdastRoot, (mdastNode) => {
    if (!('children' in mdastNode) || !Array.isArray(mdastNode.children)) return
    const parentChildren = (mdastNode as Parent).children as PhrasingContent[]
    for (let childIndex = 0; childIndex < parentChildren.length; childIndex += 1) {
      const openingChild = parentChildren[childIndex]
      if (openingChild?.type !== 'html') continue
      const textStyle = matchPapelizTextStyleOpenTag(openingChild.value)
      if (textStyle === null) continue
      const closingIndex = parentChildren.findIndex(
        (laterChild, laterIndex) => laterIndex > childIndex && laterChild.type === 'html' && laterChild.value.trim() === '</span>',
      )
      if (closingIndex === -1) continue
      const styledSpan: PhrasingContent = {
        type: 'emphasis',
        children: parentChildren.slice(childIndex + 1, closingIndex),
        data: {
          hName: 'span',
          hProperties: {
            className: [papelizMdViewStyledTextClassName],
            ...(textStyle.textColor === null ? {} : { dataPapelizTextColor: textStyle.textColor }),
            ...(textStyle.textSize === null ? {} : { dataPapelizTextSize: textStyle.textSize }),
          },
        },
      }
      parentChildren.splice(childIndex, closingIndex - childIndex + 1, styledSpan)
    }
  })
}
