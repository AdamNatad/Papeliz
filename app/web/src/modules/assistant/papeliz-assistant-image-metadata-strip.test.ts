import { describe, expect, it } from 'vitest'
import {
  detectPapelizAssistantImageFileFormat,
  listPapelizAssistantImageMetadataNames,
  PapelizAssistantImageMetadataStripError,
  stripPapelizAssistantImageMetadata,
} from './papeliz-assistant-image-metadata-strip'

// Every picture here is built byte by byte while the test runs, metadata included, so no picture
// carrying C2PA or other metadata is ever stored in the repository. The "C2PA" pieces are shaped as
// the C2PA specification places them (a PNG caBX chunk, a JPEG APP11 JUMBF segment, a WebP C2PA
// chunk); their contents are made-up bytes, which is all a stripper looks at.

const textEncoder = new TextEncoder()

function latin1Bytes(latin1Text: string): Uint8Array {
  return Uint8Array.from(latin1Text, (latin1Character) => latin1Character.charCodeAt(0))
}

function joinTestBytes(...byteParts: Uint8Array[]): Uint8Array {
  const joinedBytes = new Uint8Array(byteParts.reduce((totalLength, bytePart) => totalLength + bytePart.length, 0))
  let writeOffset = 0
  for (const bytePart of byteParts) {
    joinedBytes.set(bytePart, writeOffset)
    writeOffset += bytePart.length
  }
  return joinedBytes
}

function containsBytes(searchedBytes: Uint8Array, wantedBytes: Uint8Array): boolean {
  outer: for (let startOffset = 0; startOffset + wantedBytes.length <= searchedBytes.length; startOffset += 1) {
    for (let wantedOffset = 0; wantedOffset < wantedBytes.length; wantedOffset += 1) if (searchedBytes[startOffset + wantedOffset] !== wantedBytes[wantedOffset]) continue outer
    return true
  }
  return false
}

const pngCrcTable = Array.from({ length: 256 }, (_, tableIndex) => {
  let crcValue = tableIndex
  for (let bitIndex = 0; bitIndex < 8; bitIndex += 1) crcValue = crcValue & 1 ? 0xedb88320 ^ (crcValue >>> 1) : crcValue >>> 1
  return crcValue >>> 0
})

function computePngCrc(crcInputBytes: Uint8Array): number {
  let crcValue = 0xffffffff
  for (const crcInputByte of crcInputBytes) crcValue = pngCrcTable[(crcValue ^ crcInputByte) & 0xff]! ^ (crcValue >>> 8)
  return (crcValue ^ 0xffffffff) >>> 0
}

function buildPngChunk(pngChunkType: string, pngChunkData: Uint8Array): Uint8Array {
  const chunkTypeAndData = joinTestBytes(latin1Bytes(pngChunkType), pngChunkData)
  const lengthBytes = new Uint8Array(4)
  new DataView(lengthBytes.buffer).setUint32(0, pngChunkData.length)
  const crcBytes = new Uint8Array(4)
  new DataView(crcBytes.buffer).setUint32(0, computePngCrc(chunkTypeAndData))
  return joinTestBytes(lengthBytes, chunkTypeAndData, crcBytes)
}

const testPngSignature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])
// A 1×1 picture's header and its compressed pixels.
const testPngHeaderChunk = buildPngChunk('IHDR', Uint8Array.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]))
const testPngColorChunk = buildPngChunk('sRGB', Uint8Array.from([0]))
const testPngImageDataChunk = buildPngChunk('IDAT', Uint8Array.from([0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0xf0, 0x1f, 0x00, 0x05, 0x00, 0x01, 0xff, 0x56, 0xb7, 0x07, 0xd4]))
const testPngEndChunk = buildPngChunk('IEND', new Uint8Array())
const testC2paManifestBytes = textEncoder.encode('jumb c2pa manifest store: made with a picture generator, signed by a test issuer')

function buildTestPngWithMetadata(): Uint8Array {
  return joinTestBytes(
    testPngSignature,
    testPngHeaderChunk,
    testPngColorChunk,
    buildPngChunk('caBX', testC2paManifestBytes),
    buildPngChunk('tEXt', latin1Bytes('Software\0A picture generator')),
    buildPngChunk('iTXt', latin1Bytes('XML:com.adobe.xmp\0\0\0\0\0<x:xmpmeta xmlns:x="adobe:ns:meta/"/>')),
    buildPngChunk('eXIf', latin1Bytes('MM\0*\0\0\0\b')),
    testPngImageDataChunk,
    buildPngChunk('tIME', Uint8Array.from([7, 234, 11, 3, 6, 3, 0])),
    testPngEndChunk,
  )
}

function buildJpegSegment(jpegMarkerByte: number, jpegSegmentPayload: Uint8Array): Uint8Array {
  const segmentHeader = new Uint8Array(4)
  segmentHeader[0] = 0xff
  segmentHeader[1] = jpegMarkerByte
  new DataView(segmentHeader.buffer).setUint16(2, jpegSegmentPayload.length + 2)
  return joinTestBytes(segmentHeader, jpegSegmentPayload)
}

const testJpegFrameSegment = buildJpegSegment(0xc0, Uint8Array.from([8, 0, 1, 0, 1, 1, 1, 0x11, 0]))
const testJpegIccSegment = buildJpegSegment(0xe2, joinTestBytes(latin1Bytes('ICC_PROFILE\0'), Uint8Array.from([1, 1, 9, 9, 9])))
const testJpegJfifSegment = buildJpegSegment(0xe0, latin1Bytes('JFIF\0\x01\x01\0\0\x01\0\x01\0\0'))
// The scan: its header, made-up entropy bytes (with a stuffed 0xFF 0x00) and the end marker.
const testJpegScanBytes = joinTestBytes(buildJpegSegment(0xda, Uint8Array.from([1, 1, 0, 0, 0x3f, 0])), Uint8Array.from([0x12, 0xff, 0x00, 0x34, 0x56, 0xff, 0xd9]))

function buildTestJpegWithMetadata(): Uint8Array {
  return joinTestBytes(
    Uint8Array.from([0xff, 0xd8]),
    testJpegJfifSegment,
    buildJpegSegment(0xe1, latin1Bytes('Exif\0\0MM\0*\0\0\0\b')),
    buildJpegSegment(0xe1, latin1Bytes('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta xmlns:x="adobe:ns:meta/"/>')),
    testJpegIccSegment,
    buildJpegSegment(0xeb, joinTestBytes(latin1Bytes('JP\0\x01\0\0\0\x01'), testC2paManifestBytes)),
    buildJpegSegment(0xed, latin1Bytes('Photoshop 3.0\x008BIM')),
    buildJpegSegment(0xfe, latin1Bytes('Made with a picture generator')),
    testJpegFrameSegment,
    testJpegScanBytes,
  )
}

function buildWebpChunk(webpChunkType: string, webpChunkData: Uint8Array): Uint8Array {
  const chunkHeader = joinTestBytes(latin1Bytes(webpChunkType), new Uint8Array(4))
  new DataView(chunkHeader.buffer).setUint32(4, webpChunkData.length, true)
  return joinTestBytes(chunkHeader, webpChunkData, webpChunkData.length % 2 === 1 ? new Uint8Array(1) : new Uint8Array())
}

function buildWebpFile(...webpChunks: Uint8Array[]): Uint8Array {
  const chunkBytes = joinTestBytes(...webpChunks)
  const riffHeader = joinTestBytes(latin1Bytes('RIFF'), new Uint8Array(4), latin1Bytes('WEBP'))
  new DataView(riffHeader.buffer).setUint32(4, chunkBytes.length + 4, true)
  return joinTestBytes(riffHeader, chunkBytes)
}

// VP8X flags: ICC (0x20), EXIF (0x08) and XMP (0x04); the canvas is 1×1.
const testWebpExtendedHeaderData = Uint8Array.from([0x2c, 0, 0, 0, 0, 0, 0, 0, 0, 0])
const testWebpIccChunk = buildWebpChunk('ICCP', Uint8Array.from([1, 2, 3, 4]))
// An odd-length lossless image, so its padding byte is exercised.
const testWebpImageChunk = buildWebpChunk('VP8L', Uint8Array.from([0x2f, 0, 0, 0, 0x10, 0x07, 0x10, 0x11, 0x11]))

function buildTestWebpWithMetadata(): Uint8Array {
  return buildWebpFile(
    buildWebpChunk('VP8X', testWebpExtendedHeaderData),
    testWebpIccChunk,
    testWebpImageChunk,
    buildWebpChunk('EXIF', latin1Bytes('MM\0*\0\0\0\b')),
    buildWebpChunk('XMP ', latin1Bytes('<x:xmpmeta xmlns:x="adobe:ns:meta/"/>')),
    buildWebpChunk('C2PA', testC2paManifestBytes),
  )
}

describe('Remove Metadata', () => {
  it('finds the picture format from its first bytes', () => {
    expect(detectPapelizAssistantImageFileFormat(buildTestPngWithMetadata())).toBe('png')
    expect(detectPapelizAssistantImageFileFormat(buildTestJpegWithMetadata())).toBe('jpeg')
    expect(detectPapelizAssistantImageFileFormat(buildTestWebpWithMetadata())).toBe('webp')
    expect(detectPapelizAssistantImageFileFormat(latin1Bytes('GIF89a'))).toBeNull()
  })

  it('takes C2PA, text, XMP, EXIF and the date out of a PNG and keeps its picture and color', () => {
    const testPngBytes = buildTestPngWithMetadata()
    const pngStripResult = stripPapelizAssistantImageMetadata(testPngBytes)
    expect(pngStripResult.imageFileFormat).toBe('png')
    expect(pngStripResult.removedImageMetadataNames).toEqual(['C2PA (caBX)', 'tEXt', 'XMP (iTXt)', 'eXIf', 'tIME'])
    expect(pngStripResult.strippedImageFileBytes).toEqual(joinTestBytes(testPngSignature, testPngHeaderChunk, testPngColorChunk, testPngImageDataChunk, testPngEndChunk))
    expect(containsBytes(pngStripResult.strippedImageFileBytes, testC2paManifestBytes)).toBe(false)
    expect(listPapelizAssistantImageMetadataNames(pngStripResult.strippedImageFileBytes)).toEqual([])
  })

  it('takes C2PA, EXIF, XMP, IPTC and the comment out of a JPEG and keeps JFIF, the color profile and the scan', () => {
    const jpegStripResult = stripPapelizAssistantImageMetadata(buildTestJpegWithMetadata())
    expect(jpegStripResult.removedImageMetadataNames).toEqual(['EXIF', 'XMP', 'C2PA (JUMBF)', 'IPTC', 'comment'])
    expect(jpegStripResult.strippedImageFileBytes).toEqual(
      joinTestBytes(Uint8Array.from([0xff, 0xd8]), testJpegJfifSegment, testJpegIccSegment, testJpegFrameSegment, testJpegScanBytes),
    )
    expect(containsBytes(jpegStripResult.strippedImageFileBytes, testC2paManifestBytes)).toBe(false)
  })

  it('takes C2PA, EXIF and XMP out of a WebP, clears their flags and fixes the file length', () => {
    const webpStripResult = stripPapelizAssistantImageMetadata(buildTestWebpWithMetadata())
    expect(webpStripResult.removedImageMetadataNames).toEqual(['EXIF', 'XMP', 'C2PA'])
    expect(webpStripResult.strippedImageFileBytes).toEqual(
      buildWebpFile(buildWebpChunk('VP8X', Uint8Array.from([0x20, 0, 0, 0, 0, 0, 0, 0, 0, 0])), testWebpIccChunk, testWebpImageChunk),
    )
    const strippedRiffLength = new DataView(webpStripResult.strippedImageFileBytes.buffer).getUint32(4, true)
    expect(strippedRiffLength).toBe(webpStripResult.strippedImageFileBytes.length - 8)
    expect(containsBytes(webpStripResult.strippedImageFileBytes, testC2paManifestBytes)).toBe(false)
  })

  it('leaves a clean picture as it is', () => {
    const cleanPngBytes = joinTestBytes(testPngSignature, testPngHeaderChunk, testPngImageDataChunk, testPngEndChunk)
    const cleanStripResult = stripPapelizAssistantImageMetadata(cleanPngBytes)
    expect(cleanStripResult.removedImageMetadataNames).toEqual([])
    expect(cleanStripResult.strippedImageFileBytes).toEqual(cleanPngBytes)
  })

  it('refuses a damaged or unknown file instead of saving it half cleaned', () => {
    const testPngBytes = buildTestPngWithMetadata()
    expect(() => stripPapelizAssistantImageMetadata(testPngBytes.subarray(0, testPngBytes.length - 20))).toThrow(PapelizAssistantImageMetadataStripError)
    const testJpegBytes = buildTestJpegWithMetadata()
    expect(() => stripPapelizAssistantImageMetadata(testJpegBytes.subarray(0, 30))).toThrow(PapelizAssistantImageMetadataStripError)
    const testWebpBytes = buildTestWebpWithMetadata()
    expect(() => stripPapelizAssistantImageMetadata(testWebpBytes.subarray(0, testWebpBytes.length - 30))).toThrow(PapelizAssistantImageMetadataStripError)
    expect(() => stripPapelizAssistantImageMetadata(latin1Bytes('GIF89a not a supported picture'))).toThrow('isn’t a PNG, JPEG or WebP file')
  })
})
