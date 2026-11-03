import { beforeEach, describe, expect, it } from 'vitest'
import { describePapelizImagineGalleryPicture } from './papeliz-assistant-imagine-gallery'
import { papelizImagineSectionChoices, readPapelizImagineSectionLabel, usePapelizImagineSectionStore } from './papeliz-assistant-imagine-sections'
import type { PapelizImaginePicture, PapelizImagineThreadEntry } from './papeliz-assistant-imagine-store'

// The Imagine view's switch (Ask, Draw and Gallery), the moves between its sections, and the line
// under each picture in Gallery.

function buildTestPicture(imaginePictureId: string, imaginePictureOrigin: PapelizImaginePicture['imaginePictureOrigin'], imaginePictureDescriptionText: string): PapelizImaginePicture {
  return {
    imaginePictureId,
    imaginePictureOrigin,
    imaginePictureBlob: new Blob([]),
    imaginePicturePreviewUrl: 'blob:papeliz-test-picture',
    imaginePictureFormat: 'png',
    imaginePictureMetadataNames: [],
    isRemoveC2paOn: true,
    imaginePictureDescriptionText,
    imaginePictureModelLabel: imaginePictureOrigin === 'generated' ? 'muse-image-1.0 · Meta Model API' : null,
    savedVaultFileRelativePath: null,
    removedMetadataNamesWhenSaved: null,
    imaginePictureProblem: null,
  }
}

const testImagineThreadEntries: PapelizImagineThreadEntry[] = [
  {
    imagineThreadEntryId: 'brought-in-entry',
    imagineThreadEntryKind: 'brought-in',
    broughtInPictureFileName: 'whiteboard.png',
    broughtInPictureProblem: null,
    imaginePictureIds: ['brought-in-picture'],
  },
  {
    imagineThreadEntryId: 'prompt-entry',
    imagineThreadEntryKind: 'prompt',
    imaginePromptText: 'A red fox curled up in fresh snow',
    imaginePromptPlace: 'imagine',
    imageModelLabel: 'muse-image-1.0 · Meta Model API',
    requestedPictureCount: 1,
    imaginePromptStage: 'made',
    imaginePromptProblem: null,
    imaginePictureIds: ['made-picture'],
  },
]

beforeEach(() => {
  usePapelizImagineSectionStore.setState({ chosenImagineSection: 'draw', drawThreadEntryIdToShow: null, isDrawBoxFocusPending: false })
})

describe('the Imagine switch', () => {
  it('names Ask, Draw and Gallery in one list, in that order', () => {
    expect(papelizImagineSectionChoices.map((imagineSectionChoice) => imagineSectionChoice.imagineSectionLabel)).toEqual(['Ask', 'Draw', 'Gallery'])
    expect(readPapelizImagineSectionLabel('draw')).toBe('Draw')
  })

  it('opens on Draw; Show in Draw and Draw This go there, and leaving Draw drops an entry waiting to be shown', () => {
    expect(usePapelizImagineSectionStore.getState().chosenImagineSection).toBe('draw')
    usePapelizImagineSectionStore.getState().chooseImagineSection('gallery')
    usePapelizImagineSectionStore.getState().showDrawThreadEntry('prompt-entry')
    expect(usePapelizImagineSectionStore.getState()).toMatchObject({ chosenImagineSection: 'draw', drawThreadEntryIdToShow: 'prompt-entry' })
    usePapelizImagineSectionStore.getState().chooseImagineSection('ask')
    expect(usePapelizImagineSectionStore.getState().drawThreadEntryIdToShow).toBeNull()
    usePapelizImagineSectionStore.getState().openDrawWithBoxFocused()
    expect(usePapelizImagineSectionStore.getState()).toMatchObject({ chosenImagineSection: 'draw', isDrawBoxFocusPending: true })
  })
})

describe('the line under a picture in Gallery', () => {
  it('is the prompt it came from, or the name it was brought in under, with its Draw entry', () => {
    expect(describePapelizImagineGalleryPicture(buildTestPicture('made-picture', 'generated', 'A red fox curled up in fresh snow'), testImagineThreadEntries)).toEqual({
      galleryPictureCaption: 'A red fox curled up in fresh snow',
      drawThreadEntryId: 'prompt-entry',
    })
    expect(describePapelizImagineGalleryPicture(buildTestPicture('brought-in-picture', 'brought-in', 'whiteboard.png'), testImagineThreadEntries)).toEqual({
      galleryPictureCaption: 'Brought in: whiteboard.png',
      drawThreadEntryId: 'brought-in-entry',
    })
  })

  it('falls back to the picture’s own words when no Draw entry holds it', () => {
    expect(describePapelizImagineGalleryPicture(buildTestPicture('loose-picture', 'brought-in', 'scan.jpg'), [])).toEqual({ galleryPictureCaption: 'Brought in: scan.jpg', drawThreadEntryId: null })
  })
})
