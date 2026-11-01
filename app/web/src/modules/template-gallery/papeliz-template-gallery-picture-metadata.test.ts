import { describe, expect, it } from 'vitest'
import {
  createJpegPictureWithMetadata,
  createJpegPictureWithoutMetadata,
  createPngPictureWithMetadata,
  createPngPictureWithoutMetadata,
  createWebpPictureWithMetadata,
  createWebpPictureWithoutMetadata,
} from './papeliz-template-gallery-fixtures.test-support'
import { detectPapelizTemplatePictureFormat, findPapelizTemplatePictureFormatByName, stripPapelizTemplatePictureMetadata } from './papeliz-template-gallery-picture-metadata'

describe('template picture metadata', () => {
  it('knows a picture by its first bytes and by its name', () => {
    expect(detectPapelizTemplatePictureFormat(createPngPictureWithMetadata())).toBe('png')
    expect(detectPapelizTemplatePictureFormat(createJpegPictureWithMetadata())).toBe('jpeg')
    expect(detectPapelizTemplatePictureFormat(createWebpPictureWithMetadata())).toBe('webp')
    expect(detectPapelizTemplatePictureFormat(new TextEncoder().encode('# not a picture'))).toBeNull()
    expect(findPapelizTemplatePictureFormatByName('Plans/beds.JPG')).toBe('jpeg')
    expect(findPapelizTemplatePictureFormatByName('diagram.svg')).toBeNull()
  })

  it('takes text, EXIF and C2PA chunks out of a PNG and keeps what draws it', () => {
    expect(stripPapelizTemplatePictureMetadata(createPngPictureWithMetadata(), 'png')).toEqual(createPngPictureWithoutMetadata())
  })

  it('takes EXIF, XMP, IPTC, C2PA and comments out of a JPEG, keeping its color profile and picture data', () => {
    expect(stripPapelizTemplatePictureMetadata(createJpegPictureWithMetadata(), 'jpeg')).toEqual(createJpegPictureWithoutMetadata())
  })

  it('takes EXIF and XMP out of a WebP and clears the header flags that announced them', () => {
    expect(stripPapelizTemplatePictureMetadata(createWebpPictureWithMetadata(), 'webp')).toEqual(createWebpPictureWithoutMetadata())
  })

  it('leaves a clean picture as it was', () => {
    expect(stripPapelizTemplatePictureMetadata(createPngPictureWithoutMetadata(), 'png')).toEqual(createPngPictureWithoutMetadata())
  })

  it('refuses a picture that isn’t what its name says, or whose parts run past its end', () => {
    expect(() => stripPapelizTemplatePictureMetadata(createJpegPictureWithMetadata(), 'png')).toThrow()
    expect(() => stripPapelizTemplatePictureMetadata(createPngPictureWithMetadata().subarray(0, 40), 'png')).toThrow()
    expect(() => stripPapelizTemplatePictureMetadata(createJpegPictureWithMetadata().subarray(0, 30), 'jpeg')).toThrow()
    expect(() => stripPapelizTemplatePictureMetadata(createWebpPictureWithMetadata().subarray(0, 24), 'webp')).toThrow()
  })
})
