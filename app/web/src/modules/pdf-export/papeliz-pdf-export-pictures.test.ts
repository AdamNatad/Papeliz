import { describe, expect, it } from 'vitest'
import type { PapelizDocxExportPictureTools } from '../docx-export/papeliz-docx-export-pictures'
import { PapelizInMemoryVaultAdapter } from '../vault/papeliz-in-memory-vault-adapter'
import { exportPapelizNotesAsPdf } from './papeliz-pdf-export'
import type { PapelizPdfExportCharacterPictureDrawer } from './papeliz-pdf-export-assets'
import { listPapelizPdfExportCharacterPictureRequests } from './papeliz-pdf-export-character-pictures'
import { writePapelizPdfExportNotePdf } from './papeliz-pdf-export-note-pdf'
import { findPapelizPdfExportPictureProblem, keepPapelizPdfExportPictureDrawingParts } from './papeliz-pdf-export-picture-check'
import {
  buildPapelizPdfExportTestNotePdfJob,
  createPapelizPdfExportTestPngBytes,
  getPapelizPdfExportTestNoteText,
  papelizPdfExportInPlaceNotePdfWriter,
  readPapelizPdfExportFileLatin1Text,
  readPapelizPdfExportFileWithPdfJs,
  readPapelizPdfExportTestFontFile,
  removePapelizPdfExportTestWhitespace,
  type PapelizPdfExportPdfJsStructureNode,
} from './papeliz-pdf-export.test-support'

// Phase 4 of the PDF export: pictures, Mermaid diagrams as pictures, and pictures of the characters
// no font has, with the characters written over them.

// A JPEG's segments, enough for the check: the start, the given segments, a frame of the given size,
// image data and the end.
function createTestJpegBytes(pixelWidth: number, pixelHeight: number, extraSegments: Array<[number, number[]]>): Uint8Array {
  const jpegBytes = [0xff, 0xd8]
  const pushSegment = (segmentMarker: number, segmentData: readonly number[]) => jpegBytes.push(0xff, segmentMarker, ((segmentData.length + 2) >>> 8) & 0xff, (segmentData.length + 2) & 0xff, ...segmentData)
  pushSegment(0xe0, [...Array.from('JFIF\0', (labelCharacter) => labelCharacter.charCodeAt(0)), 1, 1, 0, 0, 1, 0, 1, 0, 0])
  for (const [segmentMarker, segmentData] of extraSegments) pushSegment(segmentMarker, segmentData)
  pushSegment(0xc0, [8, (pixelHeight >>> 8) & 0xff, pixelHeight & 0xff, (pixelWidth >>> 8) & 0xff, pixelWidth & 0xff, 1, 1, 0x11, 0])
  pushSegment(0xda, [1, 1, 0, 0, 0x3f, 0])
  jpegBytes.push(0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd9)
  return Uint8Array.from(jpegBytes)
}

const papelizTestPictureTools: PapelizDocxExportPictureTools = {
  drawDocxExportIconPng: async () => null,
  // Every picture "drawn again" as a 40 × 20 PNG; a web picture only when it is the one that arrives.
  rewriteDocxExportPicture: async () => ({ docxExportPicture: { pictureBytes: createPapelizPdfExportTestPngBytes(40, 20), pictureType: 'png', picturePixelWidth: 40, picturePixelHeight: 20 }, pictureNaturalPixelWidth: 400, pictureNaturalPixelHeight: 200 }),
  fetchDocxExportWebPicture: async (pictureWebAddress) => (pictureWebAddress.includes('pictures.example') ? new Blob([new Uint8Array(4)], { type: 'image/png' }) : null),
  drawDocxExportMermaidDiagramPng: async (mermaidDiagramSource) =>
    mermaidDiagramSource.includes('A -->\n') || mermaidDiagramSource.trim().endsWith('A -->')
      ? { mermaidDiagramErrorMessage: 'Parse error on line 2' }
      : { docxExportPicture: { pictureBytes: createPapelizPdfExportTestPngBytes(60, 30), pictureType: 'png', picturePixelWidth: 60, picturePixelHeight: 30 }, mermaidDiagramPixelWidth: 600, mermaidDiagramPixelHeight: 300 },
}

function collectStructureNodes(structureNode: PapelizPdfExportPdfJsStructureNode | null, structureNodes: Array<PapelizPdfExportPdfJsStructureNode & { alt?: string }>): void {
  if (structureNode === null) return
  structureNodes.push(structureNode)
  for (const structureChild of structureNode.children ?? []) collectStructureNodes(structureChild, structureNodes)
}

describe('PDF export picture check', () => {
  it('passes what a canvas writes and refuses metadata, bad CRCs and a wrong size', () => {
    expect(findPapelizPdfExportPictureProblem({ pictureBytes: createPapelizPdfExportTestPngBytes(4, 2), pictureFormat: 'png', picturePixelWidth: 4, picturePixelHeight: 2 })).toBeNull()
    expect(findPapelizPdfExportPictureProblem({ pictureBytes: createPapelizPdfExportTestPngBytes(4, 2, [['tEXt', [0x41, 0, 0x42]]]), pictureFormat: 'png', picturePixelWidth: 4, picturePixelHeight: 2 })).toMatch(/tEXt/)
    expect(findPapelizPdfExportPictureProblem({ pictureBytes: createPapelizPdfExportTestPngBytes(4, 2, [['eXIf', [0x4d, 0x4d]]]), pictureFormat: 'png', picturePixelWidth: 4, picturePixelHeight: 2 })).toMatch(/eXIf/)
    expect(findPapelizPdfExportPictureProblem({ pictureBytes: createPapelizPdfExportTestPngBytes(4, 2), pictureFormat: 'png', picturePixelWidth: 5, picturePixelHeight: 2 })).toMatch(/planned size/)
    const brokenCrcPngBytes = createPapelizPdfExportTestPngBytes(4, 2)
    brokenCrcPngBytes[30] = (brokenCrcPngBytes[30] ?? 0) ^ 0xff
    expect(findPapelizPdfExportPictureProblem({ pictureBytes: brokenCrcPngBytes, pictureFormat: 'png', picturePixelWidth: 4, picturePixelHeight: 2 })).toMatch(/CRC/)
    expect(findPapelizPdfExportPictureProblem({ pictureBytes: createTestJpegBytes(8, 6, []), pictureFormat: 'jpg', picturePixelWidth: 8, picturePixelHeight: 6 })).toBeNull()
    const iccProfileSegment: [number, number[]] = [0xe2, [...Array.from('ICC_PROFILE\0', (labelCharacter) => labelCharacter.charCodeAt(0)), 1, 1]]
    expect(findPapelizPdfExportPictureProblem({ pictureBytes: createTestJpegBytes(8, 6, [iccProfileSegment]), pictureFormat: 'jpg', picturePixelWidth: 8, picturePixelHeight: 6 })).toBeNull()
    const exifSegment: [number, number[]] = [0xe1, [...Array.from('Exif\0\0', (labelCharacter) => labelCharacter.charCodeAt(0)), 0x4d, 0x4d]]
    expect(findPapelizPdfExportPictureProblem({ pictureBytes: createTestJpegBytes(8, 6, [exifSegment]), pictureFormat: 'jpg', picturePixelWidth: 8, picturePixelHeight: 6 })).toMatch(/APP1/)
    const xmpSegment: [number, number[]] = [0xe1, Array.from('http://ns.adobe.com/xap/1.0/\0', (labelCharacter) => labelCharacter.charCodeAt(0))]
    expect(findPapelizPdfExportPictureProblem({ pictureBytes: createTestJpegBytes(8, 6, [xmpSegment]), pictureFormat: 'jpg', picturePixelWidth: 8, picturePixelHeight: 6 })).toMatch(/APP1/)
    expect(findPapelizPdfExportPictureProblem({ pictureBytes: createTestJpegBytes(8, 6, [[0xfe, [0x41]]]), pictureFormat: 'jpg', picturePixelWidth: 8, picturePixelHeight: 6 })).toMatch(/comment/)
    expect(findPapelizPdfExportPictureProblem({ pictureBytes: createTestJpegBytes(8, 6, []), pictureFormat: 'jpg', picturePixelWidth: 9, picturePixelHeight: 6 })).toMatch(/planned size/)
  })

  it('leaves out the parts a page’s canvas adds that don’t draw the picture, before the check', () => {
    // WebKit's canvas writes color and density chunks into its PNGs.
    const canvasPngFile = { pictureBytes: createPapelizPdfExportTestPngBytes(4, 2, [['sRGB', [0]], ['pHYs', [0, 0, 11, 19, 0, 0, 11, 19, 1]]]), pictureFormat: 'png' as const, picturePixelWidth: 4, picturePixelHeight: 2 }
    expect(findPapelizPdfExportPictureProblem(canvasPngFile)).toMatch(/sRGB/)
    const keptPngFile = keepPapelizPdfExportPictureDrawingParts(canvasPngFile)
    expect(findPapelizPdfExportPictureProblem(keptPngFile)).toBeNull()
    expect(keptPngFile.pictureBytes).toEqual(createPapelizPdfExportTestPngBytes(4, 2))
    const exifSegment: [number, number[]] = [0xe1, [...Array.from('Exif\0\0', (labelCharacter) => labelCharacter.charCodeAt(0)), 0x4d, 0x4d]]
    const keptJpegFile = keepPapelizPdfExportPictureDrawingParts({ pictureBytes: createTestJpegBytes(8, 6, [exifSegment, [0xfe, [0x41]]]), pictureFormat: 'jpg', picturePixelWidth: 8, picturePixelHeight: 6 })
    expect(findPapelizPdfExportPictureProblem(keptJpegFile)).toBeNull()
    expect(keptJpegFile.pictureBytes).toEqual(createTestJpegBytes(8, 6, []))
  })
})

describe('PDF export pictures and diagrams', () => {
  it('places the note’s pictures and diagrams, describes them, and keeps the ones that fail as MD View’s lines', async () => {
    const vaultAdapter = new PapelizInMemoryVaultAdapter([{ vaultNoteRelativePath: 'Pictures and diagrams.md', vaultNoteText: getPapelizPdfExportTestNoteText('Pictures and diagrams.md') }])
    for (const pictureName of ['garden-plan.png', 'wide-photo.jpg', 'tall-picture.png', 'small-drawing.svg', 'small-icon.png']) {
      await vaultAdapter.createVaultAttachmentFile(`pictures/${pictureName}`, new Blob([new Uint8Array(8)]))
    }
    // The vault's broken picture is 3 bytes no canvas can decode.
    await vaultAdapter.createVaultAttachmentFile('pictures/broken.png', new Blob([new Uint8Array(3)]))
    const pictureTools: PapelizDocxExportPictureTools = {
      ...papelizTestPictureTools,
      rewriteDocxExportPicture: async (pictureBlob, pictureMediaType, choosePictureBitmapSize) =>
        pictureBlob.size === 3 ? null : papelizTestPictureTools.rewriteDocxExportPicture(pictureBlob, pictureMediaType, choosePictureBitmapSize),
    }
    const pdfExportResult = await exportPapelizNotesAsPdf({
      pdfExportVault: { vaultAdapter, vaultDisplayName: 'Pictures' },
      pdfExportVaultNoteRelativePaths: ['Pictures and diagrams.md'],
      pdfExportEveryVaultNoteRelativePath: ['Pictures and diagrams.md'],
      pdfExportPageSize: 'a4',
      pdfExportNoteFontFamily: 'sans',
      readPdfExportFontFile: readPapelizPdfExportTestFontFile,
      pdfExportNotePdfWriter: papelizPdfExportInPlaceNotePdfWriter,
      pdfExportPictureTools: pictureTools,
    })
    const pdfFileBytes = new Uint8Array(await pdfExportResult.pdfExportFileBlob.arrayBuffer())
    const pdfLatin1Text = readPapelizPdfExportFileLatin1Text(pdfFileBytes)
    // Each picture is embedded once however often it is drawn: the 40 × 20 and the 60 × 30 PNG, each
    // drawn again for every place it shows, and one diagram that failed.
    expect((pdfLatin1Text.match(/\/Subtype \/Image/g) ?? []).length).toBeGreaterThan(5)
    expect(pdfExportResult.pdfExportNotices).toEqual([
      'Couldn’t load a picture from the web for “Pictures and diagrams”; it shows as its address.',
      'Couldn’t read “broken.png” for “Pictures and diagrams”; it shows as a line.',
      'Couldn’t draw a diagram in “Pictures and diagrams”; it shows as its source.',
    ])
    const pdfJsReading = await readPapelizPdfExportFileWithPdfJs(pdfFileBytes)
    const structureNodes: Array<PapelizPdfExportPdfJsStructureNode & { alt?: string }> = []
    for (const pageStructureTree of pdfJsReading.pdfJsStructureTreesByPage) collectStructureNodes(pageStructureTree, structureNodes)
    const figureDescriptions = structureNodes.filter((structureNode) => structureNode.role === 'Figure').map((structureNode) => structureNode.alt ?? '')
    expect(figureDescriptions).toContain('A plan of the garden')
    expect(figureDescriptions.some((figureDescription) => figureDescription.startsWith('flowchart LR'))).toBe(true)
    expect(figureDescriptions.some((figureDescription) => figureDescription.startsWith('sequenceDiagram'))).toBe(true)
    const bodyText = removePapelizPdfExportTestWhitespace(pdfJsReading.pdfJsTextItemsByPage.flat().map((pdfJsTextItem) => pdfJsTextItem.pdfJsText).join(''))
    // The picture that didn't arrive is its chip and its address; the diagram Mermaid couldn't draw is
    // its source and MD View's error line; the picture the vault doesn't have keeps MD View's chip.
    expect(bodyText).toContain('Picture:Abluesquarehttps://papeliz.com/missing-square.png')
    expect(bodyText).toContain('Thisdiagramcan’tbedrawn:Parseerroronline2')
    expect(bodyText).toContain('Picture:Notinthevault')
    expect(pdfJsReading.pdfJsLinks.map((pdfJsLink) => pdfJsLink.pdfJsLinkAddress)).toContain('https://papeliz.com/missing-square.png')
  })

  it('leaves out a picture that fails the worker’s check, with a notice', async () => {
    // A note with code, so its source can print in the code font.
    const notePdfJob = await buildPapelizPdfExportTestNotePdfJob('Refused.md', 'Text.\n\n```\nflowchart\n```')
    const refusedPictureJob = {
      ...notePdfJob,
      pdfExportNoteDocument: {
        ...notePdfJob.pdfExportNoteDocument,
        noteBlocks: [{ noteBlockKind: 'diagram' as const, notePictureIndex: 0, pictureShownPixelWidth: 100, pictureShownPixelHeight: 50, diagramAlternateText: 'flowchart LR\n  A --> B', diagramVectorDrawing: null }],
      },
      pdfExportPictures: [{ pictureBytes: createPapelizPdfExportTestPngBytes(4, 2, [['tEXt', [0x47, 0x50, 0x53]]]), pictureFormat: 'png' as const, picturePixelWidth: 4, picturePixelHeight: 2 }],
    }
    const { pdfFileBytes, pdfExportNoteNotices } = await writePapelizPdfExportNotePdf(refusedPictureJob)
    expect(pdfExportNoteNotices).toEqual(['A picture in “Refused” didn’t pass its check, so it shows as a line.'])
    expect(readPapelizPdfExportFileLatin1Text(pdfFileBytes)).not.toMatch(/\/Subtype \/Image/)
    expect(removePapelizPdfExportTestWhitespace((await readPapelizPdfExportFileWithPdfJs(pdfFileBytes)).pdfJsTextItemsByPage.flat().map((pdfJsTextItem) => pdfJsTextItem.pdfJsText).join(''))).toContain('flowchartLRA-->B')
  })
})

describe('PDF export pictures of characters', () => {
  it('draws emoji as pictures with the characters written over them, so they copy as emoji', async () => {
    const emojiNoteText = '# Emoji 🙂\n\nA thumbs up 👍🏽, a coder 👩‍💻, a flag 🇵🇭 and a heart ❤️ in **bold 🙂**.'
    const drawnRequests: string[] = []
    const drawTestCharacterPictures: PapelizPdfExportCharacterPictureDrawer = async (characterPictureRequests) =>
      characterPictureRequests.map((characterPictureRequest) => {
        drawnRequests.push(characterPictureRequest.pictureCharactersText)
        return {
          characterPictureKey: characterPictureRequest.characterPictureKey,
          pictureCharactersText: characterPictureRequest.pictureCharactersText,
          pictureFile: { pictureBytes: createPapelizPdfExportTestPngBytes(12, 12), pictureFormat: 'png', picturePixelWidth: 12, picturePixelHeight: 12 },
          advanceEm: 1.2,
          topAboveBaselineEm: 0.95,
          heightEm: 1.2,
        }
      })
    const notePdfJob = await buildPapelizPdfExportTestNotePdfJob('Emoji.md', emojiNoteText)
    const pictureJob = await (async () => {
      const { buildPapelizPdfExportNotePdfJob } = await import('./papeliz-pdf-export')
      const { createPapelizWikilinkTargetResolver } = await import('../links/papeliz-wikilink-targets')
      return buildPapelizPdfExportNotePdfJob({
        vaultNoteRelativePath: 'Emoji.md',
        vaultNoteText: emojiNoteText,
        resolveWikilinkTarget: createPapelizWikilinkTargetResolver(['Emoji.md']),
        pdfExportPageSize: 'a4',
        pdfExportNoteFontFamily: 'sans',
        readPdfExportFontFile: readPapelizPdfExportTestFontFile,
        pdfExportFontFilesByFaceKey: new Map(),
        pdfExportCreationDate: new Date(notePdfJob.pdfExportCreationDateIso),
        drawPdfExportCharacterPictures: drawTestCharacterPictures,
      })
    })()
    // One picture per character, color and face: 🙂 in the heading and in bold are two.
    expect(drawnRequests.filter((drawnRequest) => drawnRequest === '🙂')).toHaveLength(2)
    expect(new Set(drawnRequests)).toEqual(new Set(['🙂', '👍🏽', '👩‍💻', '🇵🇭', '❤️']))
    const { pdfFileBytes, pdfExportNoteNotices } = await writePapelizPdfExportNotePdf(pictureJob)
    expect(pdfExportNoteNotices).toEqual([])
    const pdfJsReading = await readPapelizPdfExportFileWithPdfJs(pdfFileBytes)
    const pdfText = pdfJsReading.pdfJsTextItemsByPage.flat().map((pdfJsTextItem) => pdfJsTextItem.pdfJsText).join('')
    // A cluster with a joiner reads back whole: it is one glyph whose map holds every character.
    for (const emojiText of ['🙂', '👍🏽', '👩‍💻', '🇵🇭', '❤️']) expect(pdfText, emojiText).toContain(emojiText)
    expect(readPapelizPdfExportFileLatin1Text(pdfFileBytes)).toMatch(/\/BaseFont \/[A-Z]{6}\+PapelizCharacterPictures/)
    // A box would read back as nothing; every character is there.
    expect(removePapelizPdfExportTestWhitespace(pdfText)).toContain('Athumbsup👍🏽,acoder👩‍💻,aflag🇵🇭andaheart❤️inbold🙂.')
  })

  it('asks for each character in the color and face it prints in', async () => {
    const notePdfJob = await buildPapelizPdfExportTestNotePdfJob('Colors.md', '> A quote 🙂\n\n- [x] Done 🙂\n\n[A link 🙂](https://example.com)')
    const characterPictureRequests = listPapelizPdfExportCharacterPictureRequests(notePdfJob.pdfExportNoteDocument, 'Colors', 100)
    expect(characterPictureRequests.map((characterPictureRequest) => `${characterPictureRequest.textColor} ${characterPictureRequest.fontStyle.fontWeight}`)).toEqual([
      '#55595f 400',
      '#686c73 400',
      '#0064d4 500',
    ])
  })
})
