// Removes every kind of metadata from a template's pictures in the browser, before they go into a
// vault: C2PA content credentials, EXIF, XMP, IPTC, text chunks, comments and editor data. The rules
// are the repository's own image metadata remover's, so pixels and color profiles stay exactly as
// they were. A picture whose parts don't add up throws, and Use Template leaves it out.
//
// Plain bytes in and out, with nothing from the page, so the Templates Worker can bundle it too.

export type PapelizTemplatePictureFormat = 'png' | 'jpeg' | 'webp'

const papelizTemplatePngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

// Chunks that draw the picture or set its color; every other chunk (tEXt, zTXt, iTXt, eXIf, tIME,
// caBX for C2PA, and anything unknown) is metadata.
const papelizTemplatePngPictureChunkTypes: ReadonlySet<string> = new Set([
  'IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'pHYs', 'bKGD', 'acTL', 'fcTL', 'fdAT',
])

// RIFF chunks that draw a WebP or set its color; EXIF, XMP and C2PA are metadata.
const papelizTemplateWebpPictureChunkTypes: ReadonlySet<string> = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF', 'ICCP'])
// The VP8X header's flags that say EXIF or XMP follow, cleared once those chunks are gone.
const papelizTemplateWebpExifAndXmpFlags = 0x08 | 0x04

function readAsciiText(pictureBytes: Uint8Array, startOffset: number, endOffset: number): string {
  return String.fromCharCode(...pictureBytes.subarray(startOffset, Math.min(endOffset, pictureBytes.length)))
}

function readUint32BigEndian(pictureBytes: Uint8Array, byteOffset: number): number {
  return (((pictureBytes[byteOffset] ?? 0) << 24) | ((pictureBytes[byteOffset + 1] ?? 0) << 16) | ((pictureBytes[byteOffset + 2] ?? 0) << 8) | (pictureBytes[byteOffset + 3] ?? 0)) >>> 0
}

function readUint32LittleEndian(pictureBytes: Uint8Array, byteOffset: number): number {
  return ((pictureBytes[byteOffset] ?? 0) | ((pictureBytes[byteOffset + 1] ?? 0) << 8) | ((pictureBytes[byteOffset + 2] ?? 0) << 16) | ((pictureBytes[byteOffset + 3] ?? 0) << 24)) >>> 0
}

function joinPictureParts(pictureParts: readonly Uint8Array[]): Uint8Array {
  const joinedPictureBytes = new Uint8Array(pictureParts.reduce((joinedByteCount, picturePart) => joinedByteCount + picturePart.byteLength, 0))
  let joinedByteOffset = 0
  for (const picturePart of pictureParts) {
    joinedPictureBytes.set(picturePart, joinedByteOffset)
    joinedByteOffset += picturePart.byteLength
  }
  return joinedPictureBytes
}

// What a picture's first bytes say it is, or null for anything else.
export function detectPapelizTemplatePictureFormat(pictureBytes: Uint8Array): PapelizTemplatePictureFormat | null {
  if (papelizTemplatePngSignature.every((signatureByte, signatureIndex) => pictureBytes[signatureIndex] === signatureByte)) return 'png'
  if (pictureBytes[0] === 0xff && pictureBytes[1] === 0xd8 && pictureBytes[2] === 0xff) return 'jpeg'
  if (readAsciiText(pictureBytes, 0, 4) === 'RIFF' && readAsciiText(pictureBytes, 8, 12) === 'WEBP') return 'webp'
  return null
}

// "Plans/garden.JPG" -> 'jpeg'; null for a name that isn't a template picture's.
export function findPapelizTemplatePictureFormatByName(templateFileRelativePath: string): PapelizTemplatePictureFormat | null {
  const pictureFileExtension = templateFileRelativePath.slice(templateFileRelativePath.lastIndexOf('.') + 1).toLowerCase()
  if (pictureFileExtension === 'png') return 'png'
  if (pictureFileExtension === 'jpg' || pictureFileExtension === 'jpeg') return 'jpeg'
  if (pictureFileExtension === 'webp') return 'webp'
  return null
}

function stripPngMetadata(pngBytes: Uint8Array): Uint8Array {
  const keptPngParts: Uint8Array[] = [pngBytes.subarray(0, papelizTemplatePngSignature.length)]
  let chunkOffset = papelizTemplatePngSignature.length
  let hasPictureData = false
  let hasEndChunk = false
  while (chunkOffset + 12 <= pngBytes.length) {
    const chunkEndOffset = chunkOffset + 12 + readUint32BigEndian(pngBytes, chunkOffset)
    if (chunkEndOffset > pngBytes.length) throw new Error('a PNG chunk runs past the end')
    const chunkType = readAsciiText(pngBytes, chunkOffset + 4, chunkOffset + 8)
    if (chunkOffset === papelizTemplatePngSignature.length && chunkType !== 'IHDR') throw new Error('the PNG doesn’t start with its header')
    if (papelizTemplatePngPictureChunkTypes.has(chunkType)) keptPngParts.push(pngBytes.subarray(chunkOffset, chunkEndOffset))
    if (chunkType === 'IDAT' || chunkType === 'fdAT') hasPictureData = true
    chunkOffset = chunkEndOffset
    if (chunkType === 'IEND') {
      hasEndChunk = true
      break
    }
  }
  if (!hasPictureData || !hasEndChunk) throw new Error('the PNG has no picture data or no end')
  return joinPictureParts(keptPngParts)
}

// Segments before the scan are kept unless they are metadata: APP1 (EXIF, XMP), APP11 (JUMBF, where
// C2PA lives), APP13 (IPTC), COM comments and any other APPn. Kept: JFIF/JFXX (APP0), the ICC color
// profile (APP2) and Adobe's color transform (APP14). Everything from the first scan on is kept as is.
function isJpegAppSegmentPictureData(segmentMarker: number, segmentLabel: string): boolean {
  if (segmentMarker === 0xe0) return segmentLabel.startsWith('JFIF\0') || segmentLabel.startsWith('JFXX\0')
  if (segmentMarker === 0xe2) return segmentLabel.startsWith('ICC_PROFILE\0')
  if (segmentMarker === 0xee) return segmentLabel.startsWith('Adobe')
  return false
}

function stripJpegMetadata(jpegBytes: Uint8Array): Uint8Array {
  const keptJpegParts: Uint8Array[] = [jpegBytes.subarray(0, 2)]
  let segmentOffset = 2
  while (segmentOffset + 1 < jpegBytes.length) {
    if (jpegBytes[segmentOffset] !== 0xff) throw new Error('a JPEG segment is malformed')
    // Fill bytes before a marker.
    let markerOffset = segmentOffset
    while (jpegBytes[markerOffset + 1] === 0xff) markerOffset += 1
    const segmentMarker = jpegBytes[markerOffset + 1] ?? 0
    if (segmentMarker === 0xda) {
      keptJpegParts.push(jpegBytes.subarray(markerOffset))
      return joinPictureParts(keptJpegParts)
    }
    if (segmentMarker === 0xd9) throw new Error('the JPEG ends before its picture data')
    if ((segmentMarker >= 0xd0 && segmentMarker <= 0xd7) || segmentMarker === 0x01) {
      keptJpegParts.push(jpegBytes.subarray(markerOffset, markerOffset + 2))
      segmentOffset = markerOffset + 2
      continue
    }
    const segmentLength = ((jpegBytes[markerOffset + 2] ?? 0) << 8) | (jpegBytes[markerOffset + 3] ?? 0)
    const segmentEndOffset = markerOffset + 2 + segmentLength
    if (segmentLength < 2 || segmentEndOffset > jpegBytes.length) throw new Error('a JPEG segment runs past the end')
    const segmentLabel = readAsciiText(jpegBytes, markerOffset + 4, Math.min(segmentEndOffset, markerOffset + 16))
    const isMetadataSegment = segmentMarker === 0xfe || (segmentMarker >= 0xe0 && segmentMarker <= 0xef && !isJpegAppSegmentPictureData(segmentMarker, segmentLabel))
    if (!isMetadataSegment) keptJpegParts.push(jpegBytes.subarray(markerOffset, segmentEndOffset))
    segmentOffset = segmentEndOffset
  }
  throw new Error('the JPEG has no picture data')
}

function stripWebpMetadata(webpBytes: Uint8Array): Uint8Array {
  const riffEndOffset = 8 + readUint32LittleEndian(webpBytes, 4)
  if (riffEndOffset > webpBytes.length || riffEndOffset < 12) throw new Error('the WebP’s size doesn’t match')
  const keptWebpChunks: Uint8Array[] = []
  let chunkOffset = 12
  let hasPictureData = false
  while (chunkOffset + 8 <= riffEndOffset) {
    const chunkType = readAsciiText(webpBytes, chunkOffset, chunkOffset + 4)
    const chunkLength = readUint32LittleEndian(webpBytes, chunkOffset + 4)
    const paddedChunkEndOffset = chunkOffset + 8 + chunkLength + (chunkLength % 2)
    if (paddedChunkEndOffset > riffEndOffset) throw new Error('a WebP chunk runs past the end')
    if (papelizTemplateWebpPictureChunkTypes.has(chunkType)) {
      const keptWebpChunk = webpBytes.slice(chunkOffset, paddedChunkEndOffset)
      if (chunkType === 'VP8X' && keptWebpChunk.length > 8) keptWebpChunk[8] = (keptWebpChunk[8] ?? 0) & ~papelizTemplateWebpExifAndXmpFlags
      keptWebpChunks.push(keptWebpChunk)
      if (chunkType === 'VP8 ' || chunkType === 'VP8L' || chunkType === 'ANMF') hasPictureData = true
    }
    chunkOffset = paddedChunkEndOffset
  }
  if (!hasPictureData) throw new Error('the WebP has no picture data')
  const keptChunkBytes = joinPictureParts(keptWebpChunks)
  const riffHeaderBytes = webpBytes.slice(0, 12)
  new DataView(riffHeaderBytes.buffer).setUint32(4, keptChunkBytes.length + 4, true)
  return joinPictureParts([riffHeaderBytes, keptChunkBytes])
}

// The picture without its metadata. Throws when the bytes aren't the format named, or don't hold
// together.
export function stripPapelizTemplatePictureMetadata(pictureBytes: Uint8Array, pictureFormat: PapelizTemplatePictureFormat): Uint8Array {
  if (detectPapelizTemplatePictureFormat(pictureBytes) !== pictureFormat) throw new Error(`the picture isn’t a ${pictureFormat}`)
  if (pictureFormat === 'png') return stripPngMetadata(pictureBytes)
  if (pictureFormat === 'jpeg') return stripJpegMetadata(pictureBytes)
  return stripWebpMetadata(pictureBytes)
}
