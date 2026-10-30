// The worker's look at each picture before it goes into a PDF. Every picture was drawn again on the
// page's canvas, which writes no metadata; this check makes sure of it, byte by byte. A JPEG may hold
// only what a canvas writes: JFIF (APP0) and the sRGB color profile (APP2) besides its image data, so
// EXIF and XMP (APP1), any other application segment and comments are refused. A PNG may hold only
// IHDR, PLTE, tRNS, IDAT and IEND, each with a valid CRC. Its size must be the size that was planned.

export type PapelizPdfExportPictureFormat = 'png' | 'jpg'

export interface PapelizPdfExportPictureFile {
  pictureBytes: Uint8Array
  pictureFormat: PapelizPdfExportPictureFormat
  picturePixelWidth: number
  picturePixelHeight: number
}

const papelizPdfExportPngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const papelizPdfExportAllowedPngChunkTypes: ReadonlySet<string> = new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND'])
// JPEG markers that carry no data of their own: the start, the end, and restart markers.
const papelizPdfExportStandaloneJpegMarkers: ReadonlySet<number> = new Set([0xd8, 0xd9, 0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7])
// The start-of-frame markers, which hold the picture's size.
const papelizPdfExportJpegFrameMarkers: ReadonlySet<number> = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

let papelizPdfExportCrcTable: Uint32Array | null = null

function getCrcTable(): Uint32Array {
  if (papelizPdfExportCrcTable !== null) return papelizPdfExportCrcTable
  const crcTable = new Uint32Array(256)
  for (let tableIndex = 0; tableIndex < 256; tableIndex += 1) {
    let crcValue = tableIndex
    for (let bitIndex = 0; bitIndex < 8; bitIndex += 1) crcValue = crcValue & 1 ? 0xedb88320 ^ (crcValue >>> 1) : crcValue >>> 1
    crcTable[tableIndex] = crcValue >>> 0
  }
  papelizPdfExportCrcTable = crcTable
  return crcTable
}

// PNG's CRC-32 over a chunk's type and data.
export function computePapelizPdfExportCrc32(crcBytes: Uint8Array): number {
  const crcTable = getCrcTable()
  let crcValue = 0xffffffff
  for (const crcByte of crcBytes) crcValue = (crcTable[(crcValue ^ crcByte) & 0xff] ?? 0) ^ (crcValue >>> 8)
  return (crcValue ^ 0xffffffff) >>> 0
}

function readUint32(pictureBytes: Uint8Array, byteOffset: number): number {
  return (((pictureBytes[byteOffset] ?? 0) << 24) | ((pictureBytes[byteOffset + 1] ?? 0) << 16) | ((pictureBytes[byteOffset + 2] ?? 0) << 8) | (pictureBytes[byteOffset + 3] ?? 0)) >>> 0
}

function readUint16(pictureBytes: Uint8Array, byteOffset: number): number {
  return ((pictureBytes[byteOffset] ?? 0) << 8) | (pictureBytes[byteOffset + 1] ?? 0)
}

function findPngProblem(pictureBytes: Uint8Array, expectedPixelWidth: number, expectedPixelHeight: number): string | null {
  if (!papelizPdfExportPngSignature.every((signatureByte, signatureIndex) => pictureBytes[signatureIndex] === signatureByte)) return 'it isn’t a PNG'
  let byteOffset = papelizPdfExportPngSignature.length
  let isFirstChunk = true
  let hasEnd = false
  while (byteOffset + 12 <= pictureBytes.length) {
    const chunkLength = readUint32(pictureBytes, byteOffset)
    const chunkType = String.fromCharCode(...pictureBytes.subarray(byteOffset + 4, byteOffset + 8))
    const chunkEndOffset = byteOffset + 12 + chunkLength
    if (chunkEndOffset > pictureBytes.length) return 'a chunk runs past the file’s end'
    if (!papelizPdfExportAllowedPngChunkTypes.has(chunkType)) return `it holds a ${chunkType.replace(/[^\x20-\x7e]/g, '?')} chunk`
    if (computePapelizPdfExportCrc32(pictureBytes.subarray(byteOffset + 4, byteOffset + 8 + chunkLength)) !== readUint32(pictureBytes, byteOffset + 8 + chunkLength)) return `its ${chunkType} chunk has a wrong CRC`
    if (isFirstChunk) {
      if (chunkType !== 'IHDR' || chunkLength !== 13) return 'it doesn’t start with its header'
      if (readUint32(pictureBytes, byteOffset + 8) !== expectedPixelWidth || readUint32(pictureBytes, byteOffset + 12) !== expectedPixelHeight) return 'its size isn’t the planned size'
      isFirstChunk = false
    }
    byteOffset = chunkEndOffset
    if (chunkType === 'IEND') {
      hasEnd = true
      break
    }
  }
  if (!hasEnd || byteOffset !== pictureBytes.length) return 'it doesn’t end where its last chunk ends'
  return null
}

function findJpegProblem(pictureBytes: Uint8Array, expectedPixelWidth: number, expectedPixelHeight: number): string | null {
  if (pictureBytes[0] !== 0xff || pictureBytes[1] !== 0xd8) return 'it isn’t a JPEG'
  let byteOffset = 2
  let hasFrameSize = false
  while (byteOffset + 2 <= pictureBytes.length) {
    if (pictureBytes[byteOffset] !== 0xff) return 'a segment is malformed'
    const segmentMarker = pictureBytes[byteOffset + 1] ?? 0
    if (segmentMarker === 0xff) {
      byteOffset += 1
      continue
    }
    if (papelizPdfExportStandaloneJpegMarkers.has(segmentMarker)) {
      if (segmentMarker === 0xd9) return hasFrameSize ? null : 'it has no picture size'
      byteOffset += 2
      continue
    }
    const segmentLength = readUint16(pictureBytes, byteOffset + 2)
    if (byteOffset + 4 > pictureBytes.length || segmentLength < 2 || byteOffset + 2 + segmentLength > pictureBytes.length) return 'a segment runs past the file’s end'
    if (segmentMarker === 0xfe) return 'it holds a comment'
    if (segmentMarker >= 0xe0 && segmentMarker <= 0xef) {
      const segmentLabel = String.fromCharCode(...pictureBytes.subarray(byteOffset + 4, byteOffset + Math.min(16, 2 + segmentLength)))
      const isJfif = segmentMarker === 0xe0 && segmentLabel.startsWith('JFIF\0')
      const isColorProfile = segmentMarker === 0xe2 && segmentLabel.startsWith('ICC_PROFILE\0')
      if (!isJfif && !isColorProfile) return `it holds an APP${segmentMarker - 0xe0} segment`
    }
    if (papelizPdfExportJpegFrameMarkers.has(segmentMarker)) {
      if (readUint16(pictureBytes, byteOffset + 5) !== expectedPixelHeight || readUint16(pictureBytes, byteOffset + 7) !== expectedPixelWidth) return 'its size isn’t the planned size'
      hasFrameSize = true
    }
    if (segmentMarker === 0xda) {
      // The image data follows its header up to the end marker; inside it, 0xFF is followed by 0x00
      // or a restart marker.
      byteOffset += 2 + segmentLength
      while (byteOffset + 1 < pictureBytes.length) {
        if (pictureBytes[byteOffset] === 0xff && pictureBytes[byteOffset + 1] !== 0x00 && !(((pictureBytes[byteOffset + 1] ?? 0) >= 0xd0 && (pictureBytes[byteOffset + 1] ?? 0) <= 0xd7))) break
        byteOffset += 1
      }
      continue
    }
    byteOffset += 2 + segmentLength
  }
  return 'it has no end marker'
}

// A picture with only the parts that draw it, as the page hands it to the worker. Browsers' canvases
// add color chunks (`sRGB`, `gAMA`, `iCCP`, `pHYs`) to a PNG, and may add segments to a JPEG, that
// pdfkit doesn't read; they are left out here, so the worker's check above can stay strict. A picture
// that can't be read is returned as it is, for the check to refuse.
export function keepPapelizPdfExportPictureDrawingParts(pictureFile: PapelizPdfExportPictureFile): PapelizPdfExportPictureFile {
  const { pictureBytes } = pictureFile
  const keptPictureParts: Uint8Array[] = []
  if (pictureFile.pictureFormat === 'png') {
    if (!papelizPdfExportPngSignature.every((signatureByte, signatureIndex) => pictureBytes[signatureIndex] === signatureByte)) return pictureFile
    keptPictureParts.push(pictureBytes.subarray(0, papelizPdfExportPngSignature.length))
    let byteOffset = papelizPdfExportPngSignature.length
    while (byteOffset + 12 <= pictureBytes.length) {
      const chunkEndOffset = byteOffset + 12 + readUint32(pictureBytes, byteOffset)
      if (chunkEndOffset > pictureBytes.length) return pictureFile
      const chunkType = String.fromCharCode(...pictureBytes.subarray(byteOffset + 4, byteOffset + 8))
      if (papelizPdfExportAllowedPngChunkTypes.has(chunkType)) keptPictureParts.push(pictureBytes.subarray(byteOffset, chunkEndOffset))
      byteOffset = chunkEndOffset
      if (chunkType === 'IEND') break
    }
  } else {
    if (pictureBytes[0] !== 0xff || pictureBytes[1] !== 0xd8) return pictureFile
    keptPictureParts.push(pictureBytes.subarray(0, 2))
    let byteOffset = 2
    while (byteOffset + 4 <= pictureBytes.length) {
      if (pictureBytes[byteOffset] !== 0xff) return pictureFile
      const segmentMarker = pictureBytes[byteOffset + 1] ?? 0
      // From the image data on, the rest is kept as it is.
      if (segmentMarker === 0xda) {
        keptPictureParts.push(pictureBytes.subarray(byteOffset))
        break
      }
      const segmentEndOffset = byteOffset + 2 + readUint16(pictureBytes, byteOffset + 2)
      if (segmentEndOffset > pictureBytes.length) return pictureFile
      const segmentLabel = String.fromCharCode(...pictureBytes.subarray(byteOffset + 4, Math.min(segmentEndOffset, byteOffset + 16)))
      const isMetadataSegment =
        segmentMarker === 0xfe ||
        (segmentMarker >= 0xe0 && segmentMarker <= 0xef && !(segmentMarker === 0xe0 && segmentLabel.startsWith('JFIF\0')) && !(segmentMarker === 0xe2 && segmentLabel.startsWith('ICC_PROFILE\0')))
      if (!isMetadataSegment) keptPictureParts.push(pictureBytes.subarray(byteOffset, segmentEndOffset))
      byteOffset = segmentEndOffset
    }
  }
  const keptPictureBytes = new Uint8Array(keptPictureParts.reduce((keptByteCount, keptPicturePart) => keptByteCount + keptPicturePart.byteLength, 0))
  let keptByteOffset = 0
  for (const keptPicturePart of keptPictureParts) {
    keptPictureBytes.set(keptPicturePart, keptByteOffset)
    keptByteOffset += keptPicturePart.byteLength
  }
  return { ...pictureFile, pictureBytes: keptPictureBytes }
}

// Why a picture can't go into the PDF, or null when it can.
export function findPapelizPdfExportPictureProblem(pictureFile: PapelizPdfExportPictureFile): string | null {
  const { pictureBytes, picturePixelWidth, picturePixelHeight } = pictureFile
  if (!Number.isSafeInteger(picturePixelWidth) || !Number.isSafeInteger(picturePixelHeight) || picturePixelWidth < 1 || picturePixelHeight < 1 || picturePixelWidth > 16_384 || picturePixelHeight > 16_384) {
    return 'its size is out of bounds'
  }
  return pictureFile.pictureFormat === 'png' ? findPngProblem(pictureBytes, picturePixelWidth, picturePixelHeight) : findJpegProblem(pictureBytes, picturePixelWidth, picturePixelHeight)
}
