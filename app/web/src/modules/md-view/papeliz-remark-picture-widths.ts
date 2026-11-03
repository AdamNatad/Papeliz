import type { Image, Root } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import { readPapelizMdViewImageAltTextSize } from './papeliz-md-view-media-sources'

// A picture's width for the rendered page and every export: `![Garden plan|300](plan.png)` loses its
// `|300` from the description, and the width (with the height of `|300x200`) goes on the picture as
// its `width` and `height`, which the sanitizer keeps. A `![[plan.png|300]]` embed carries its size in
// its label, read where the embed is drawn.
export const remarkPapelizPictureWidths: Plugin<[], Root> = () => (mdastRoot) => {
  visit(mdastRoot, 'image', (imageNode: Image) => {
    const imageAltText = imageNode.alt ?? ''
    const imageAltTextSize = readPapelizMdViewImageAltTextSize(imageAltText)
    if (imageAltTextSize.mediaAlternativeText === imageAltText) return
    imageNode.alt = imageAltTextSize.mediaAlternativeText
    const pictureSizeProperties: Record<string, string> = {}
    if (imageAltTextSize.mediaWidthPixels !== null) pictureSizeProperties['width'] = String(imageAltTextSize.mediaWidthPixels)
    if (imageAltTextSize.mediaHeightPixels !== null) pictureSizeProperties['height'] = String(imageAltTextSize.mediaHeightPixels)
    imageNode.data = { ...imageNode.data, hProperties: { ...imageNode.data?.hProperties, ...pictureSizeProperties } }
  })
}
