import { describe, expect, it } from 'vitest'
import {
  clampPapelizMdViewPictureWidthPixels,
  papelizMdViewPictureSmallestWidthPixels,
  writePapelizMdViewImageAltTextWidth,
  writePapelizMdViewWikilinkEmbedInnerTextWidth,
} from './papeliz-md-view-picture-width'

describe('a picture’s width in its Markdown', () => {
  it('writes and takes away the width in a picture link’s description', () => {
    expect(writePapelizMdViewImageAltTextWidth('Garden plan', 300)).toBe('Garden plan|300')
    expect(writePapelizMdViewImageAltTextWidth('Garden plan|120x80', 300)).toBe('Garden plan|300')
    expect(writePapelizMdViewImageAltTextWidth('', 300)).toBe('|300')
    expect(writePapelizMdViewImageAltTextWidth('Garden plan|300', null)).toBe('Garden plan')
    expect(writePapelizMdViewImageAltTextWidth('|300', null)).toBe('')
    expect(writePapelizMdViewImageAltTextWidth('A|B', 200)).toBe('A|B|200')
  })

  it('writes and takes away the width inside an embed, keeping the file’s name and description', () => {
    expect(writePapelizMdViewWikilinkEmbedInnerTextWidth('dot.png', 300)).toBe('dot.png|300')
    expect(writePapelizMdViewWikilinkEmbedInnerTextWidth('Pictures/dot.png|40', 300)).toBe('Pictures/dot.png|300')
    expect(writePapelizMdViewWikilinkEmbedInnerTextWidth('dot.png|The dot', 300)).toBe('dot.png|The dot|300')
    expect(writePapelizMdViewWikilinkEmbedInnerTextWidth('dot.png|The dot|300x200', 120)).toBe('dot.png|The dot|120')
    expect(writePapelizMdViewWikilinkEmbedInnerTextWidth('dot.png|The dot|300', null)).toBe('dot.png|The dot')
    expect(writePapelizMdViewWikilinkEmbedInnerTextWidth('dot.png|300', null)).toBe('dot.png')
    expect(writePapelizMdViewWikilinkEmbedInnerTextWidth('dot.png|', 300)).toBe('dot.png|300')
  })

  it('keeps a dragged width in whole pixels, between the smallest width and the note’s column', () => {
    expect(clampPapelizMdViewPictureWidthPixels(300.6, 700)).toBe(301)
    expect(clampPapelizMdViewPictureWidthPixels(900, 700.8)).toBe(700)
    expect(clampPapelizMdViewPictureWidthPixels(10, 700)).toBe(papelizMdViewPictureSmallestWidthPixels)
    // A column narrower than the smallest width still allows the smallest width.
    expect(clampPapelizMdViewPictureWidthPixels(300, 30)).toBe(papelizMdViewPictureSmallestWidthPixels)
  })
})
