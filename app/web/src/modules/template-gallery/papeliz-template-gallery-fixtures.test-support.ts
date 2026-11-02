// Test support only: small, made-up templates and the pictures in them, built byte by byte so each
// carries exactly the metadata a test strips. "Garden Journal" is the good one; each bad one changes a
// single thing about it.

export const gardenJournalTemplateCommitSha = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'
export const gardenJournalTemplateNewerCommitSha = 'b2c3d4e5f60718293a4b5c6d7e8f901234567890'
export const gardenJournalRepositoryName = { templateRepositoryOwner: 'garden-notes', templateRepositoryName: 'Garden-Journal' }

export type PapelizFixtureTemplateFiles = Record<string, string | Uint8Array>

function joinFixtureBytes(fixtureByteParts: ReadonlyArray<Uint8Array | readonly number[] | string>): Uint8Array {
  const fixtureByteArrays = fixtureByteParts.map((fixtureBytePart) =>
    typeof fixtureBytePart === 'string' ? new TextEncoder().encode(fixtureBytePart) : fixtureBytePart instanceof Uint8Array ? fixtureBytePart : Uint8Array.from(fixtureBytePart),
  )
  const joinedFixtureBytes = new Uint8Array(fixtureByteArrays.reduce((joinedByteCount, fixtureByteArray) => joinedByteCount + fixtureByteArray.length, 0))
  let joinedByteOffset = 0
  for (const fixtureByteArray of fixtureByteArrays) {
    joinedFixtureBytes.set(fixtureByteArray, joinedByteOffset)
    joinedByteOffset += fixtureByteArray.length
  }
  return joinedFixtureBytes
}

function writeUint32BigEndian(uint32Value: number): number[] {
  return [(uint32Value >>> 24) & 0xff, (uint32Value >>> 16) & 0xff, (uint32Value >>> 8) & 0xff, uint32Value & 0xff]
}

function writeUint32LittleEndian(uint32Value: number): number[] {
  return [uint32Value & 0xff, (uint32Value >>> 8) & 0xff, (uint32Value >>> 16) & 0xff, (uint32Value >>> 24) & 0xff]
}

// A PNG chunk; the CRC is left as zeros, which nothing here reads.
function writePngChunk(pngChunkType: string, pngChunkData: Uint8Array | readonly number[] | string): Uint8Array {
  const pngChunkDataBytes = joinFixtureBytes([pngChunkData])
  return joinFixtureBytes([writeUint32BigEndian(pngChunkDataBytes.length), pngChunkType, pngChunkDataBytes, [0, 0, 0, 0]])
}

const fixturePngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const fixturePngHeaderChunk = writePngChunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0])
const fixturePngPictureDataChunk = writePngChunk('IDAT', [0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01])
const fixturePngColorChunk = writePngChunk('sRGB', [0])
const fixturePngEndChunk = writePngChunk('IEND', [])

// A one-pixel PNG with a text chunk, EXIF and C2PA content credentials.
export function createPngPictureWithMetadata(): Uint8Array {
  return joinFixtureBytes([
    fixturePngSignature,
    fixturePngHeaderChunk,
    writePngChunk('tEXt', 'Author\0Someone'),
    writePngChunk('eXIf', 'MM\0*'),
    fixturePngColorChunk,
    writePngChunk('caBX', 'c2pa manifest'),
    fixturePngPictureDataChunk,
    fixturePngEndChunk,
  ])
}

// The same PNG as it should be once stripped.
export function createPngPictureWithoutMetadata(): Uint8Array {
  return joinFixtureBytes([fixturePngSignature, fixturePngHeaderChunk, fixturePngColorChunk, fixturePngPictureDataChunk, fixturePngEndChunk])
}

function writeJpegSegment(jpegMarker: number, jpegSegmentPayload: Uint8Array | readonly number[] | string): Uint8Array {
  const jpegSegmentPayloadBytes = joinFixtureBytes([jpegSegmentPayload])
  const jpegSegmentLength = jpegSegmentPayloadBytes.length + 2
  return joinFixtureBytes([[0xff, jpegMarker, (jpegSegmentLength >>> 8) & 0xff, jpegSegmentLength & 0xff], jpegSegmentPayloadBytes])
}

const fixtureJpegFileHeader = writeJpegSegment(0xe0, 'JFIF\0\x01\x01\0\0\x01\0\x01\0\0')
const fixtureJpegColorProfile = writeJpegSegment(0xe2, 'ICC_PROFILE\0\x01\x01profile')
const fixtureJpegQuantizationTable = writeJpegSegment(0xdb, [0, ...new Array<number>(64).fill(1)])
const fixtureJpegScanAndEnd = joinFixtureBytes([writeJpegSegment(0xda, [1, 1, 0, 0, 0x3f, 0]), [0x12, 0x34, 0xff, 0x00, 0x56], [0xff, 0xd9]])

// A JPEG with EXIF, XMP, IPTC, C2PA (JUMBF) and a comment.
export function createJpegPictureWithMetadata(): Uint8Array {
  return joinFixtureBytes([
    [0xff, 0xd8],
    fixtureJpegFileHeader,
    writeJpegSegment(0xe1, 'Exif\0\0MM\0*'),
    writeJpegSegment(0xe1, 'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>'),
    fixtureJpegColorProfile,
    writeJpegSegment(0xed, 'Photoshop 3.0\0'),
    writeJpegSegment(0xeb, 'JP\0\0c2pa'),
    writeJpegSegment(0xfe, 'a comment'),
    fixtureJpegQuantizationTable,
    fixtureJpegScanAndEnd,
  ])
}

export function createJpegPictureWithoutMetadata(): Uint8Array {
  return joinFixtureBytes([[0xff, 0xd8], fixtureJpegFileHeader, fixtureJpegColorProfile, fixtureJpegQuantizationTable, fixtureJpegScanAndEnd])
}

function writeWebpChunk(webpChunkType: string, webpChunkData: Uint8Array | readonly number[] | string): Uint8Array {
  const webpChunkDataBytes = joinFixtureBytes([webpChunkData])
  return joinFixtureBytes([webpChunkType, writeUint32LittleEndian(webpChunkDataBytes.length), webpChunkDataBytes, webpChunkDataBytes.length % 2 === 1 ? [0] : []])
}

function writeWebpFile(webpChunks: readonly Uint8Array[]): Uint8Array {
  const webpChunkBytes = joinFixtureBytes(webpChunks)
  return joinFixtureBytes(['RIFF', writeUint32LittleEndian(webpChunkBytes.length + 4), 'WEBP', webpChunkBytes])
}

const fixtureWebpPictureChunk = writeWebpChunk('VP8L', [0x2f, 0, 0, 0, 0x10, 0x07, 0x10, 0x11, 0x11, 0x88, 0x88, 0xfe, 0x07, 0])

// A WebP whose extended header says EXIF and XMP follow (flags 0x08 and 0x04), with both.
export function createWebpPictureWithMetadata(): Uint8Array {
  return writeWebpFile([writeWebpChunk('VP8X', [0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0]), fixtureWebpPictureChunk, writeWebpChunk('EXIF', 'MM\0*'), writeWebpChunk('XMP ', '<x:xmpmeta/>')])
}

export function createWebpPictureWithoutMetadata(): Uint8Array {
  return writeWebpFile([writeWebpChunk('VP8X', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), fixtureWebpPictureChunk])
}

// The MIT License's standard text, wrapped as GitHub's template wraps it.
export const gardenJournalMitLicenseText = `MIT License

Copyright (c) 2026 Garden Notes

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`

// The opening lines of the CC0 1.0 and CC BY 4.0 legal codes, and of another license, as a LICENSE
// file starts.
export const gardenJournalCc0LicenseText =
  'Creative Commons Legal Code\n\nCC0 1.0 Universal\n\nStatement of Purpose\n\nThe laws of most jurisdictions throughout the world ...\n\n2. Waiver. To the greatest extent permitted by ...\n'
export const gardenJournalCcByLicenseText =
  'Attribution 4.0 International\n\nCreative Commons Attribution 4.0 International Public License\n\nBy exercising the Licensed Rights (defined below), You accept and agree ...\n'
export const gardenJournalCcBySaLicenseText =
  'Attribution-ShareAlike 4.0 International\n\nCreative Commons Attribution-ShareAlike 4.0 International Public License\n\nBy exercising the Licensed Rights ... ShareAlike ...\n'
export const gardenJournalOtherLicenseText = 'GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007\n\nEveryone is permitted to copy and distribute verbatim copies ...\n'

export const gardenJournalManifest = {
  papelizTemplateManifestVersion: 1,
  templateName: 'Garden Journal',
  templateDescription: 'A season of planting notes, with a page per crop.',
  templateTags: ['education', 'gardening', 'journal'],
  templateFirstNotePath: 'Start here.md',
  templateIncludedPaths: ['**'],
  templateExcludedPaths: ['drafts/**'],
}

// The good template: notes, a picture, a hidden settings file that runs nothing, and its license.
export function createGardenJournalTemplateFiles(): PapelizFixtureTemplateFiles {
  return {
    'papeliz-template.json': JSON.stringify(gardenJournalManifest, null, 2),
    'README.md': '# Garden Journal\n\n![The beds in May](beds.png)\n',
    'Start here.md': '# Start here\n\nOne note per crop lives in Crops/. Use `<script>` tags only in code:\n\n```html\n<script>alert(1)</script>\n```\n',
    'Crops/Tomatoes.md': '# Tomatoes\n\n[Seed list](Seeds.md) and <span title="ok">a span</span>.\n',
    'Crops/Seeds.md': '# Seeds\n',
    'beds.png': createPngPictureWithMetadata(),
    '.gitignore': 'drafts/\n',
    '.claude/settings.json': JSON.stringify({ permissions: { deny: ['Bash(rm:*)'] } }, null, 2),
    '.papeliz/file-list-order.json': JSON.stringify({ order: ['Start here.md', 'Crops'] }),
    'drafts/Unfinished.md': '# Not part of the template\n',
    LICENSE: gardenJournalMitLicenseText,
  }
}
