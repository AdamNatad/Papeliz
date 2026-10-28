import type { Parent, PhrasingContent, Root } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import { papelizUnderlineCloseTag, papelizUnderlineOpenTag } from '../note-editor/papeliz-note-inline-formatting'

// Underlined text for the rendered page. Raw HTML in a note is dropped, except this exact form,
// `<u>words</u>` (Markdown has no underline mark), which becomes a plain `u` element with no
// attributes.
export const remarkPapelizUnderlines: Plugin<[], Root> = () => (mdastRoot) => {
  visit(mdastRoot, (mdastNode) => {
    if (!('children' in mdastNode) || !Array.isArray(mdastNode.children)) return
    const parentChildren = (mdastNode as Parent).children as PhrasingContent[]
    for (let childIndex = 0; childIndex < parentChildren.length; childIndex += 1) {
      const openingChild = parentChildren[childIndex]
      if (openingChild?.type !== 'html' || openingChild.value.trim().toLowerCase() !== papelizUnderlineOpenTag) continue
      const closingIndex = parentChildren.findIndex(
        (laterChild, laterIndex) => laterIndex > childIndex && laterChild.type === 'html' && laterChild.value.trim().toLowerCase() === papelizUnderlineCloseTag,
      )
      if (closingIndex === -1) continue
      const underlinedText: PhrasingContent = {
        type: 'emphasis',
        children: parentChildren.slice(childIndex + 1, closingIndex),
        data: { hName: 'u', hProperties: {} },
      }
      parentChildren.splice(childIndex, closingIndex - childIndex + 1, underlinedText)
    }
  })
}
