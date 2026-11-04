// Remove Metadata in the Imagine tab: strips C2PA content credentials, EXIF, XMP, IPTC, text chunks and
// comments from a PNG, JPEG or WebP picture, in the browser, before it is saved into the vault. It
// removes what the repository's own image tool removes
// (build_tools/shared/image-metadata/papeliz-strip-image-metadata.mjs): the pixels and the color
// profile stay byte for byte, and the result is read back to check that no metadata is left and the
// image data is unchanged. A damaged or unknown file is refused rather than saved half cleaned.

export type PapelizAssistantImageFileFormat = 'png' | 'jpeg' | 'webp'

export interface PapelizAssistantImageMetadataStripResult {
  imageFileFormat: PapelizAssistantImageFileFormat
  strippedImageFileBytes: Uint8Array<ArrayBuffer>
  // One name per piece removed, in file order: "C2PA (caBX)", "EXIF", "tEXt" and so on.
  removedImageMetadataNames: string[]
}

export class PapelizAssistantImageMetadataStripError extends Error {
  override readonly name = 'PapelizAssistantImageMetadataStripError'
}

export const papelizAssistantImageFileMimeTypes: Readonly<Record<PapelizAssistantImageFileFormat, string>> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export const papelizAssistantImageFileExtensions: Readonly<Record<PapelizAssistantImageFileFormat, string>> = {
  png: '.png',
  jpeg: '.jpg',
  webp: '.webp',
}

const pngSignatureBytes: readonly number[] = [137, 80, 78, 71, 13, 10, 26, 10]

function readLatin1Text(fileBytes: Uint8Array, startOffset: number, endOffset: number): string {
  let latin1Text = ''
  for (let byteOffset = startOffset; byteOffset < Math.min(endOffset, fileBytes.length); byteOffset += 1) latin1Text += String.fromCharCode(fileBytes[byteOffset]!)
  return latin1Text
}

function readUint32BigEndian(fileBytes: Uint8Array, byteOffset: number): number {
  return new DataView(fileBytes.buffer, fileBytes.byteOffset, fileBytes.byteLength).getUint32(byteOffset, false)
}

function readUint32LittleEndian(fileBytes: Uint8Array, byteOffset: number): number {
  return new DataView(fileBytes.buffer, fileBytes.byteOffset, fileBytes.byteLength).getUint32(byteOffset, true)
}

function readUint16BigEndian(fileBytes: Uint8Array, byteOffset: number): number {
  return new DataView(fileBytes.buffer, fileBytes.byteOffset, fileBytes.byteLength).getUint16(byteOffset, false)
}

function joinByteParts(byteParts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const joinedBytes = new Uint8Array(byteParts.reduce((totalLength, bytePart) => totalLength + bytePart.length, 0))
  let writeOffset = 0
  for (const bytePart of byteParts) {
    joinedBytes.set(bytePart, writeOffset)
    writeOffset += bytePart.length
  }
  return joinedBytes
}

function areBytesEqual(firstBytes: Uint8Array, secondBytes: Uint8Array): boolean {
  if (firstBytes.length !== secondBytes.length) return false
  for (let byteOffset = 0; byteOffset < firstBytes.length; byteOffset += 1) if (firstBytes[byteOffset] !== secondBytes[byteOffset]) return false
  return true
}

export function detectPapelizAssistantImageFileFormat(imageFileBytes: Uint8Array): PapelizAssistantImageFileFormat | null {
  if (pngSignatureBytes.every((signatureByte, byteOffset) => imageFileBytes[byteOffset] === signatureByte)) return 'png'
  if (imageFileBytes[0] === 0xff && imageFileBytes[1] === 0xd8 && imageFileBytes[2] === 0xff) return 'jpeg'
  if (readLatin1Text(imageFileBytes, 0, 4) === 'RIFF' && readLatin1Text(imageFileBytes, 8, 12) === 'WEBP') return 'webp'
  return null
}

// ---------------------------------------------------------------- PNG

// Chunks that draw the picture or set its color; every other chunk (tEXt, zTXt, iTXt, eXIf, tIME,
// caBX for C2PA, and anything unknown) is metadata.
const pngImageChunkTypes: ReadonlySet<string> = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'pHYs', 'bKGD', 'acTL', 'fcTL', 'fdAT'])

interface PapelizPngChunk {
  pngChunkType: string
  wholePngChunkBytes: Uint8Array
}

function readPngChunks(pngFileBytes: Uint8Array): PapelizPngChunk[] {
  const pngChunks: PapelizPngChunk[] = []
  let chunkOffset = 8
  while (chunkOffset < pngFileBytes.length) {
    if (chunkOffset + 12 > pngFileBytes.length) throw new PapelizAssistantImageMetadataStripError('The PNG file ends in the middle of a chunk.')
    const chunkDataLength = readUint32BigEndian(pngFileBytes, chunkOffset)
    const chunkEndOffset = chunkOffset + 12 + chunkDataLength
    if (chunkEndOffset > pngFileBytes.length) throw new PapelizAssistantImageMetadataStripError('The PNG file is cut short.')
    const pngChunkType = readLatin1Text(pngFileBytes, chunkOffset + 4, chunkOffset + 8)
    pngChunks.push({ pngChunkType, wholePngChunkBytes: pngFileBytes.subarray(chunkOffset, chunkEndOffset) })
    chunkOffset = chunkEndOffset
    if (pngChunkType === 'IEND') return pngChunks
  }
  throw new PapelizAssistantImageMetadataStripError('The PNG file has no end chunk.')
}

function describePngMetadataChunk(pngChunkType: string, wholePngChunkBytes: Uint8Array): string {
  if (pngChunkType === 'caBX') return 'C2PA (caBX)'
  if (pngChunkType === 'iTXt' && readLatin1Text(wholePngChunkBytes, 8, 26) === 'XML:com.adobe.xmp\0') return 'XMP (iTXt)'
  return pngChunkType
}

function stripPngMetadata(pngFileBytes: Uint8Array): { strippedImageFileBytes: Uint8Array<ArrayBuffer>; removedImageMetadataNames: string[] } {
  const keptByteParts: Uint8Array[] = [Uint8Array.from(pngSignatureBytes)]
  const removedImageMetadataNames: string[] = []
  for (const { pngChunkType, wholePngChunkBytes } of readPngChunks(pngFileBytes)) {
    if (pngImageChunkTypes.has(pngChunkType)) keptByteParts.push(wholePngChunkBytes)
    else removedImageMetadataNames.push(describePngMetadataChunk(pngChunkType, wholePngChunkBytes))
  }
  return { strippedImageFileBytes: joinByteParts(keptByteParts), removedImageMetadataNames }
}

function readPngImageDataBytes(pngFileBytes: Uint8Array): Uint8Array {
  return joinByteParts(
    readPngChunks(pngFileBytes)
      .filter(({ pngChunkType }) => pngChunkType === 'IDAT' || pngChunkType === 'fdAT')
      .map(({ wholePngChunkBytes }) => wholePngChunkBytes),
  )
}

// ---------------------------------------------------------------- JPEG

// Segments before the scan are kept unless they are metadata: APP1 (EXIF, XMP), APP11 (JUMBF, where
// C2PA lives), APP13 (IPTC), COM comments and other APPn. Kept APPn: JFIF/JFXX (APP0), the ICC color
// profile (APP2) and Adobe color transform (APP14). Everything from the first scan on is copied as is.
function isJpegAppSegmentImageData(jpegMarkerByte: number, jpegSegmentPayload: Uint8Array): boolean {
  const jpegSegmentSignature = readLatin1Text(jpegSegmentPayload, 0, 12)
  if (jpegMarkerByte === 0xe0) return jpegSegmentSignature.startsWith('JFIF\0') || jpegSegmentSignature.startsWith('JFXX\0')
  if (jpegMarkerByte === 0xe2) return jpegSegmentSignature.startsWith('ICC_PROFILE\0')
  if (jpegMarkerByte === 0xee) return jpegSegmentSignature.startsWith('Adobe')
  return false
}

function describeJpegMetadataSegment(jpegMarkerByte: number, jpegSegmentPayload: Uint8Array): string {
  const jpegSegmentSignature = readLatin1Text(jpegSegmentPayload, 0, 32)
  if (jpegMarkerByte === 0xfe) return 'comment'
  if (jpegMarkerByte === 0xe1 && jpegSegmentSignature.startsWith('Exif')) return 'EXIF'
  if (jpegMarkerByte === 0xe1 && jpegSegmentSignature.includes('ns.adobe.com/xap')) return 'XMP'
  if (jpegMarkerByte === 0xeb) return 'C2PA (JUMBF)'
  if (jpegMarkerByte === 0xed) return 'IPTC'
  return `APP${jpegMarkerByte - 0xe0}`
}

interface PapelizJpegHeaderSegments {
  keptJpegHeaderParts: Uint8Array[]
  removedImageMetadataNames: string[]
  jpegScanBytes: Uint8Array
}

function readJpegHeaderSegments(jpegFileBytes: Uint8Array): PapelizJpegHeaderSegments {
  const keptJpegHeaderParts: Uint8Array[] = [jpegFileBytes.subarray(0, 2)]
  const removedImageMetadataNames: string[] = []
  let segmentOffset = 2
  while (segmentOffset < jpegFileBytes.length) {
    if (jpegFileBytes[segmentOffset] !== 0xff) throw new PapelizAssistantImageMetadataStripError('The JPEG file has an unexpected byte before its picture.')
    let markerOffset = segmentOffset
    while (jpegFileBytes[markerOffset + 1] === 0xff) markerOffset += 1 // fill bytes
    const jpegMarkerByte = jpegFileBytes[markerOffset + 1]
    if (jpegMarkerByte === undefined) break
    if (jpegMarkerByte === 0xda) return { keptJpegHeaderParts, removedImageMetadataNames, jpegScanBytes: jpegFileBytes.subarray(markerOffset) }
    if (jpegMarkerByte === 0xd9 || (jpegMarkerByte >= 0xd0 && jpegMarkerByte <= 0xd7) || jpegMarkerByte === 0x01) {
      keptJpegHeaderParts.push(jpegFileBytes.subarray(markerOffset, markerOffset + 2))
      segmentOffset = markerOffset + 2
      continue
    }
    if (markerOffset + 4 > jpegFileBytes.length) break
    const jpegSegmentLength = readUint16BigEndian(jpegFileBytes, markerOffset + 2)
    const segmentEndOffset = markerOffset + 2 + jpegSegmentLength
    if (jpegSegmentLength < 2 || segmentEndOffset > jpegFileBytes.length) throw new PapelizAssistantImageMetadataStripError('The JPEG file is cut short.')
    const jpegSegmentPayload = jpegFileBytes.subarray(markerOffset + 4, segmentEndOffset)
    const isMetadataSegment = jpegMarkerByte === 0xfe || (jpegMarkerByte >= 0xe0 && jpegMarkerByte <= 0xef && !isJpegAppSegmentImageData(jpegMarkerByte, jpegSegmentPayload))
    if (isMetadataSegment) removedImageMetadataNames.push(describeJpegMetadataSegment(jpegMarkerByte, jpegSegmentPayload))
    else keptJpegHeaderParts.push(jpegFileBytes.subarray(markerOffset, segmentEndOffset))
    segmentOffset = segmentEndOffset
  }
  throw new PapelizAssistantImageMetadataStripError('The JPEG file has no picture data.')
}

function stripJpegMetadata(jpegFileBytes: Uint8Array): { strippedImageFileBytes: Uint8Array<ArrayBuffer>; removedImageMetadataNames: string[] } {
  const { keptJpegHeaderParts, removedImageMetadataNames, jpegScanBytes } = readJpegHeaderSegments(jpegFileBytes)
  return { strippedImageFileBytes: joinByteParts([...keptJpegHeaderParts, jpegScanBytes]), removedImageMetadataNames }
}

// ---------------------------------------------------------------- WebP

// RIFF chunks EXIF, XMP and C2PA are metadata; the VP8X header's EXIF and XMP flags are cleared to match.
const webpImageChunkTypes: ReadonlySet<string> = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF', 'ICCP'])
const webpVp8xExifFlag = 0x08
const webpVp8xXmpFlag = 0x04

interface PapelizWebpChunk {
  webpChunkType: string
  wholeWebpChunkBytes: Uint8Array
}

function readWebpChunks(webpFileBytes: Uint8Array): PapelizWebpChunk[] {
  const webpChunks: PapelizWebpChunk[] = []
  let chunkOffset = 12
  while (chunkOffset + 8 <= webpFileBytes.length) {
    const webpChunkType = readLatin1Text(webpFileBytes, chunkOffset, chunkOffset + 4)
    const chunkDataLength = readUint32LittleEndian(webpFileBytes, chunkOffset + 4)
    const paddedChunkEndOffset = chunkOffset + 8 + chunkDataLength + (chunkDataLength % 2)
    // An odd last chunk may leave out its padding byte.
    if (chunkOffset + 8 + chunkDataLength > webpFileBytes.length) throw new PapelizAssistantImageMetadataStripError('The WebP file is cut short.')
    webpChunks.push({ webpChunkType, wholeWebpChunkBytes: webpFileBytes.subarray(chunkOffset, Math.min(paddedChunkEndOffset, webpFileBytes.length)) })
    chunkOffset = paddedChunkEndOffset
  }
  return webpChunks
}

function stripWebpMetadata(webpFileBytes: Uint8Array): { strippedImageFileBytes: Uint8Array<ArrayBuffer>; removedImageMetadataNames: string[] } {
  const keptChunkParts: Uint8Array[] = []
  const removedImageMetadataNames: string[] = []
  for (const { webpChunkType, wholeWebpChunkBytes } of readWebpChunks(webpFileBytes)) {
    if (!webpImageChunkTypes.has(webpChunkType)) {
      removedImageMetadataNames.push(webpChunkType.trim())
      continue
    }
    const keptChunkBytes = Uint8Array.from(wholeWebpChunkBytes)
    if (webpChunkType === 'VP8X' && keptChunkBytes.length > 8) keptChunkBytes[8] = keptChunkBytes[8]! & ~(webpVp8xExifFlag | webpVp8xXmpFlag)
    // Every chunk written whole, padding byte included.
    keptChunkParts.push(keptChunkBytes.length % 2 === 1 ? joinByteParts([keptChunkBytes, new Uint8Array(1)]) : keptChunkBytes)
  }
  const keptChunkBytes = joinByteParts(keptChunkParts)
  const riffHeaderBytes = Uint8Array.from(webpFileBytes.subarray(0, 12))
  new DataView(riffHeaderBytes.buffer).setUint32(4, keptChunkBytes.length + 4, true)
  return { strippedImageFileBytes: joinByteParts([riffHeaderBytes, keptChunkBytes]), removedImageMetadataNames }
}

function readWebpImageDataBytes(webpFileBytes: Uint8Array): Uint8Array {
  return joinByteParts(
    readWebpChunks(webpFileBytes)
      .filter(({ webpChunkType }) => webpImageChunkTypes.has(webpChunkType) && webpChunkType !== 'VP8X')
      .map(({ wholeWebpChunkBytes }) => wholeWebpChunkBytes.subarray(0, 8 + readUint32LittleEndian(wholeWebpChunkBytes, 4))),
  )
}

// ---------------------------------------------------------------- All three

function stripImageMetadataByFormat(imageFileFormat: PapelizAssistantImageFileFormat, imageFileBytes: Uint8Array) {
  if (imageFileFormat === 'png') return stripPngMetadata(imageFileBytes)
  if (imageFileFormat === 'jpeg') return stripJpegMetadata(imageFileBytes)
  return stripWebpMetadata(imageFileBytes)
}

function readImageDataBytesByFormat(imageFileFormat: PapelizAssistantImageFileFormat, imageFileBytes: Uint8Array): Uint8Array {
  if (imageFileFormat === 'png') return readPngImageDataBytes(imageFileBytes)
  if (imageFileFormat === 'jpeg') return readJpegHeaderSegments(imageFileBytes).jpegScanBytes
  return readWebpImageDataBytes(imageFileBytes)
}

// The metadata a picture carries, without changing it: what Remove Metadata would take out.
export function listPapelizAssistantImageMetadataNames(imageFileBytes: Uint8Array): string[] {
  return stripPapelizAssistantImageMetadata(imageFileBytes).removedImageMetadataNames
}

export function stripPapelizAssistantImageMetadata(imageFileBytes: Uint8Array): PapelizAssistantImageMetadataStripResult {
  const imageFileFormat = detectPapelizAssistantImageFileFormat(imageFileBytes)
  if (imageFileFormat === null) throw new PapelizAssistantImageMetadataStripError('This picture isn’t a PNG, JPEG or WebP file, so it couldn’t be saved.')
  const { strippedImageFileBytes, removedImageMetadataNames } = stripImageMetadataByFormat(imageFileFormat, imageFileBytes)
  // Read back: nothing left to remove, and the image data exactly as it was.
  const strippedAgain = stripImageMetadataByFormat(imageFileFormat, strippedImageFileBytes)
  if (strippedAgain.removedImageMetadataNames.length > 0) throw new PapelizAssistantImageMetadataStripError('This picture couldn’t be saved. Draw it again, or bring in another.')
  if (!areBytesEqual(readImageDataBytesByFormat(imageFileFormat, imageFileBytes), readImageDataBytesByFormat(imageFileFormat, strippedImageFileBytes))) {
    throw new PapelizAssistantImageMetadataStripError('Saving would have changed the picture itself, so it wasn’t saved.')
  }
  return { imageFileFormat, strippedImageFileBytes, removedImageMetadataNames }
}
