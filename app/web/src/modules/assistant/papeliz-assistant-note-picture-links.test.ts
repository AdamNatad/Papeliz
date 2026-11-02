import { describe, expect, it } from 'vitest'
import { findPapelizNotePictureLinkAround, replacePapelizPictureLinkAltText } from './papeliz-assistant-note-picture-links'

describe('Pictures in a note, for Describe Picture and Edit Picture', () => {
  const noteText = 'Intro line\nHere: ![Old fox](../Attachments/fox.png) and text\n![[map.webp|Map]]\nLast'

  it('finds the picture link the cursor is in, or the one on the cursor’s line', () => {
    const linkInside = findPapelizNotePictureLinkAround(noteText, noteText.indexOf('Old'), noteText.indexOf('Old'))
    expect(linkInside).toMatchObject({ pictureAltText: 'Old fox', pictureAddress: '../Attachments/fox.png', pictureLinkKind: 'markdown-image' })
    expect(noteText.slice(linkInside?.pictureLinkFrom, linkInside?.pictureLinkTo)).toBe('![Old fox](../Attachments/fox.png)')
    expect(findPapelizNotePictureLinkAround(noteText, noteText.indexOf('Here'), noteText.indexOf('Here'))?.pictureAltText).toBe('Old fox')
    expect(findPapelizNotePictureLinkAround(noteText, noteText.indexOf('map'), noteText.indexOf('map'))).toMatchObject({ pictureAddress: 'map.webp', pictureLinkKind: 'wikilink-embed' })
    expect(findPapelizNotePictureLinkAround(noteText, 0, 0)).toBeNull()
  })

  it('finds a picture inside a selected passage', () => {
    const passageText = 'See ![Chart](<My Pictures/chart 1.png> "Q3") below'
    expect(findPapelizNotePictureLinkAround(passageText, 0, passageText.length)).toMatchObject({ pictureAltText: 'Chart', pictureAddress: 'My Pictures/chart 1.png' })
  })

  it('gives a picture new alt text and keeps its address', () => {
    const markdownLink = findPapelizNotePictureLinkAround(noteText, noteText.indexOf('Old'), noteText.indexOf('Old'))!
    expect(replacePapelizPictureLinkAltText(markdownLink, 'A red fox [asleep]\nin snow')).toBe('![A red fox asleep in snow](../Attachments/fox.png)')
    const embedLink = findPapelizNotePictureLinkAround(noteText, noteText.indexOf('map'), noteText.indexOf('map'))!
    expect(replacePapelizPictureLinkAltText(embedLink, 'Trail map')).toBe('![[map.webp|Trail map]]')
  })
})
