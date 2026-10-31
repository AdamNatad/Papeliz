import PDFDocument, { type PapelizPdfKitImage, type PapelizPdfKitOutline, type PapelizPdfKitStructureElement } from 'pdfkit'
import { PapelizPdfExportError } from './papeliz-pdf-export-errors'
import type { PapelizPdfExportLimits } from './papeliz-pdf-export-limits'
import {
  papelizPdfExportOpenTypeFeaturesBySet,
  type PapelizPdfExportBookmark,
  type PapelizPdfExportDestinationOperation,
  type PapelizPdfExportLinkAreaOperation,
  type PapelizPdfExportOperationTagging,
  type PapelizPdfExportPageLayoutPlan,
  type PapelizPdfExportPageOperation,
  type PapelizPdfExportPictureSource,
  type PapelizPdfExportVectorDrawingOperation,
} from './papeliz-pdf-export-page-layout-plan'
import type { PapelizPdfExportPictureFile } from './papeliz-pdf-export-picture-check'
import type { PapelizPdfExportVectorGradient } from './papeliz-pdf-export-vector-drawing'

// The pictures a plan draws: the note's, by their place, and pictures of characters, by their key.
export interface PapelizPdfExportPictureFiles {
  notePictureFiles: readonly PapelizPdfExportPictureFile[]
  characterPictureFilesByKey: ReadonlyMap<string, PapelizPdfExportPictureFile>
}

// Each picture read by pdfkit once, however many times it is drawn.
type PapelizPdfExportPictureOpener = (pictureSource: PapelizPdfExportPictureSource) => PapelizPdfKitImage

// Draws a checked page layout plan with pdfkit and collects the file's bytes. Every font is an
// embedded subset with a map back to its characters; each block is a structure element, nested as
// the note is (a list's items, a quote's paragraphs, a paragraph's links), so a screen reader reads
// the note in order, and grounds, lines and the footer are marked as page furniture. Links are
// annotations inside their structure element; headings, footnotes and references are named places,
// and the headings are the bookmarks. The document information holds the note's name and nothing
// else about the person.

export interface PapelizPdfExportDocumentDetails {
  pdfExportDocumentTitle: string
  pdfExportDocumentLanguageTag: string
  pdfExportCreationDate: Date
}

// pdfkit 0.20 writes `info` into its XMP metadata without XML escaping, so a note named "R&D notes"
// would break the packet. The values are escaped while the XMP is written; the document information
// keeps them as they are.
const papelizPdfExportXmpInfoKeys = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer'] as const

function escapePapelizPdfExportXmpText(xmpText: string): string {
  return xmpText.replace(/&/g, '&amp;').replace(/\r/g, '&#xD;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

// Whether the file says it meets PDF/UA-1. veraPDF's check passes; the claim waits for a screen
// reader read-through. The claim is written here, not with pdfkit's `subset: 'PDF/UA'`: pdfkit 0.20
// numbers that subset 1, as it does PDF/A-1, and so also writes PDF/A-1's CIDSet, which lists only
// the glyphs used and breaks PDF/UA's font rule.
const isPapelizPdfExportPdfUaClaimed = false

class PapelizPdfExportPdfKitDocument extends PDFDocument {
  override _addInfo(): void {
    const rawPdfKitInfo = this.info
    const escapedPdfKitInfo = { ...rawPdfKitInfo }
    for (const xmpInfoKey of papelizPdfExportXmpInfoKeys) {
      const xmpInfoValue = rawPdfKitInfo[xmpInfoKey]
      if (typeof xmpInfoValue === 'string') escapedPdfKitInfo[xmpInfoKey] = escapePapelizPdfExportXmpText(xmpInfoValue)
    }
    this.info = escapedPdfKitInfo
    try {
      super._addInfo()
    } finally {
      this.info = rawPdfKitInfo
    }
    if (isPapelizPdfExportPdfUaClaimed) {
      this.appendXML('<rdf:Description rdf:about="" xmlns:pdfuaid="http://www.aiim.org/pdfua/ns/id/"><pdfuaid:part>1</pdfuaid:part></rdf:Description>')
    }
  }
}

// The file's bytes as pdfkit writes them, refused once they pass the size limit.
export class PapelizPdfExportOutputCollector {
  readonly pdfFileBytesPromise: Promise<Uint8Array>
  hasPassedSizeLimit = false
  private readonly collectedPdfChunks: Uint8Array[] = []
  private collectedByteCount = 0
  private readonly largestPdfFileByteCount: number

  constructor(pdfKitDocument: PDFDocument, largestPdfFileByteCount: number) {
    this.largestPdfFileByteCount = largestPdfFileByteCount
    this.pdfFileBytesPromise = new Promise((resolvePdfFileBytes) => {
      pdfKitDocument.on('end', () => resolvePdfFileBytes(this.joinCollectedChunks()))
    })
    pdfKitDocument.on('data', (pdfKitChunk) => {
      if (this.hasPassedSizeLimit) return
      this.collectedByteCount += pdfKitChunk.byteLength
      if (this.collectedByteCount > this.largestPdfFileByteCount) {
        this.hasPassedSizeLimit = true
        this.collectedPdfChunks.length = 0
        return
      }
      this.collectedPdfChunks.push(Uint8Array.from(pdfKitChunk))
    })
  }

  throwIfPastSizeLimit(): void {
    if (this.hasPassedSizeLimit) throw new PapelizPdfExportError('pdf-export-limit-reached', `The PDF is larger than ${Math.round(this.largestPdfFileByteCount / (1024 * 1024))} MB.`)
  }

  private joinCollectedChunks(): Uint8Array {
    const pdfFileBytes = new Uint8Array(this.collectedPdfChunks.reduce((byteCount, pdfChunk) => byteCount + pdfChunk.byteLength, 0))
    let pdfFileOffset = 0
    for (const pdfChunk of this.collectedPdfChunks) {
      pdfFileBytes.set(pdfChunk, pdfFileOffset)
      pdfFileOffset += pdfChunk.byteLength
    }
    this.collectedPdfChunks.length = 0
    return pdfFileBytes
  }
}

export interface PapelizPdfExportOpenDocument {
  pdfKitDocument: PDFDocument
  outputCollector: PapelizPdfExportOutputCollector
}

// The document, with its fonts registered under their face keys so the layout can measure with them.
// Its information is complete here, since pdfkit derives the file's ID from it when it is created.
export function openPapelizPdfExportDocument(
  documentDetails: PapelizPdfExportDocumentDetails,
  fontFilesByFaceKey: ReadonlyMap<string, Uint8Array>,
  pdfExportLimits: PapelizPdfExportLimits,
  // A face inside a font collection (`.ttc`) is picked by its PostScript name.
  fontCollectionFaceNamesByFaceKey: ReadonlyMap<string, string> = new Map(),
): PapelizPdfExportOpenDocument {
  const pdfKitDocument = new PapelizPdfExportPdfKitDocument({
    pdfVersion: '1.7',
    autoFirstPage: false,
    compress: true,
    tagged: true,
    lang: documentDetails.pdfExportDocumentLanguageTag,
    displayTitle: true,
    font: null,
    info: {
      Title: documentDetails.pdfExportDocumentTitle,
      Creator: 'Papeliz',
      Producer: 'Papeliz',
      CreationDate: documentDetails.pdfExportCreationDate,
      ModDate: documentDetails.pdfExportCreationDate,
    },
  })
  const outputCollector = new PapelizPdfExportOutputCollector(pdfKitDocument, pdfExportLimits.maximumPdfFileByteCount)
  for (const [fontFaceKey, fontFileBytes] of fontFilesByFaceKey) {
    const fontCollectionFaceName = fontCollectionFaceNamesByFaceKey.get(fontFaceKey)
    if (fontCollectionFaceName === undefined) pdfKitDocument.registerFont(fontFaceKey, fontFileBytes)
    else pdfKitDocument.registerFont(fontFaceKey, fontFileBytes, fontCollectionFaceName)
  }
  return { pdfKitDocument, outputCollector }
}

function drawPageOperation(pdfKitDocument: PDFDocument, pageOperation: PapelizPdfExportPageOperation, openPicture: PapelizPdfExportPictureOpener): void {
  switch (pageOperation.pageOperationKind) {
    case 'text-run': {
      const openTypeFeatures = papelizPdfExportOpenTypeFeaturesBySet[pageOperation.openTypeFeatureSet]
      const { textSynthesis } = pageOperation
      pdfKitDocument.font(pageOperation.fontFaceKey).fontSize(pageOperation.textSizePoints).fillColor(pageOperation.textColor)
      const isTextThickened = textSynthesis !== null && textSynthesis.textStrokeWidthPoints > 0
      // Thickened: filled and stroked in its own color (text render mode 2), as browsers draw a bold
      // the font lacks; the stroke's color and width are put back after it.
      if (isTextThickened) pdfKitDocument.save().strokeColor(pageOperation.textColor).lineWidth(textSynthesis.textStrokeWidthPoints)
      pdfKitDocument.text(pageOperation.textRunText, pageOperation.textLeftPoints, pageOperation.textBaselinePoints, {
        lineBreak: false,
        baseline: 'alphabetic',
        characterSpacing: pageOperation.characterSpacingPoints,
        ...(openTypeFeatures === undefined ? {} : { features: openTypeFeatures }),
        ...(textSynthesis !== null && textSynthesis.textSlantDegrees > 0 ? { oblique: textSynthesis.textSlantDegrees } : {}),
        ...(isTextThickened ? { fill: true, stroke: true } : {}),
      })
      if (isTextThickened) pdfKitDocument.restore()
      return
    }
    case 'rectangle': {
      const { rectangleLeftPoints, rectangleTopPoints, rectangleWidthPoints, rectangleHeightPoints, rectangleCornerRadiusPoints, rectangleStrokeWidthPoints } = pageOperation
      const drawRectanglePath = (insetPoints: number) => {
        const insetCornerRadiusPoints = Math.max(0, rectangleCornerRadiusPoints - insetPoints)
        const [pathLeftPoints, pathTopPoints, pathWidthPoints, pathHeightPoints] = [rectangleLeftPoints + insetPoints, rectangleTopPoints + insetPoints, rectangleWidthPoints - 2 * insetPoints, rectangleHeightPoints - 2 * insetPoints]
        if (insetCornerRadiusPoints > 0) pdfKitDocument.roundedRect(pathLeftPoints, pathTopPoints, pathWidthPoints, pathHeightPoints, insetCornerRadiusPoints)
        else pdfKitDocument.rect(pathLeftPoints, pathTopPoints, pathWidthPoints, pathHeightPoints)
      }
      pdfKitDocument.save()
      if (pageOperation.rectangleFillColor !== null) {
        drawRectanglePath(0)
        pdfKitDocument.fill(pageOperation.rectangleFillColor)
      }
      if (pageOperation.rectangleStrokeColor !== null && rectangleStrokeWidthPoints > 0) {
        drawRectanglePath(rectangleStrokeWidthPoints / 2)
        pdfKitDocument.lineWidth(rectangleStrokeWidthPoints).stroke(pageOperation.rectangleStrokeColor)
      }
      pdfKitDocument.restore()
      return
    }
    case 'line':
      pdfKitDocument.save().lineWidth(pageOperation.lineWidthPoints).strokeColor(pageOperation.lineColor)
      if (pageOperation.lineDashPoints !== null) pdfKitDocument.dash(pageOperation.lineDashPoints, { space: pageOperation.lineDashPoints })
      pdfKitDocument.moveTo(pageOperation.lineFromLeftPoints, pageOperation.lineFromTopPoints).lineTo(pageOperation.lineToLeftPoints, pageOperation.lineToTopPoints).stroke()
      pdfKitDocument.restore()
      return
    case 'path':
      // Papeliz's own shapes, all drawn with round ends and corners.
      pdfKitDocument.save().translate(pageOperation.pathLeftPoints, pageOperation.pathTopPoints).scale(pageOperation.pathScale)
      if (pageOperation.pathFillColor !== null) pdfKitDocument.path(pageOperation.pathData).fill(pageOperation.pathFillColor)
      if (pageOperation.pathStrokeColor !== null && pageOperation.pathStrokeWidth > 0) {
        pdfKitDocument.path(pageOperation.pathData).lineWidth(pageOperation.pathStrokeWidth).lineCap('round').lineJoin('round').stroke(pageOperation.pathStrokeColor)
      }
      pdfKitDocument.restore()
      return
    case 'vector-drawing':
      drawVectorDrawing(pdfKitDocument, pageOperation)
      return
    case 'picture': {
      const { pictureLeftPoints, pictureTopPoints, pictureWidthPoints, pictureHeightPoints, pictureCornerRadiusPoints } = pageOperation
      pdfKitDocument.save()
      // MD View's rounded corners, as a clip around the picture.
      if (pictureCornerRadiusPoints > 0) pdfKitDocument.roundedRect(pictureLeftPoints, pictureTopPoints, pictureWidthPoints, pictureHeightPoints, pictureCornerRadiusPoints).clip()
      pdfKitDocument.image(openPicture(pageOperation.pictureSource), pictureLeftPoints, pictureTopPoints, { width: pictureWidthPoints, height: pictureHeightPoints })
      pdfKitDocument.restore()
      return
    }
    case 'link-area':
    case 'destination':
      return
  }
}

// A drawing's shapes, each in its own transform and paint, scaled from the drawing's units to points;
// then its labels over them, each in its face from its start on the baseline.
function drawVectorDrawing(pdfKitDocument: PDFDocument, vectorDrawingOperation: PapelizPdfExportVectorDrawingOperation): void {
  pdfKitDocument.save().translate(vectorDrawingOperation.drawingLeftPoints, vectorDrawingOperation.drawingTopPoints).scale(vectorDrawingOperation.drawingScale)
  for (const vectorShape of vectorDrawingOperation.vectorDrawing.vectorShapes) {
    const hasFill = vectorShape.vectorShapeFillColor !== null
    const hasStroke = vectorShape.vectorShapeStrokeColor !== null && vectorShape.vectorShapeStrokeWidth > 0
    if (!hasFill && !hasStroke) continue
    pdfKitDocument.save().transform(...vectorShape.vectorShapeTransform)
    // A gradient is placed in the shape's own units, so it is made after its transform.
    const createGradient = (vectorGradient: PapelizPdfExportVectorGradient) => {
      const pdfKitGradient = pdfKitDocument.linearGradient(vectorGradient.gradientStartX, vectorGradient.gradientStartY, vectorGradient.gradientEndX, vectorGradient.gradientEndY)
      for (const { stopOffset, stopColor, stopOpacity } of vectorGradient.gradientStops) pdfKitGradient.stop(stopOffset, stopColor, stopOpacity)
      return pdfKitGradient
    }
    if (vectorShape.vectorShapeFillColor !== null) {
      const fillPaint = vectorShape.vectorShapeFillGradient === null ? vectorShape.vectorShapeFillColor : createGradient(vectorShape.vectorShapeFillGradient)
      pdfKitDocument.fillColor(fillPaint, vectorShape.vectorShapeFillOpacity)
    }
    if (hasStroke && vectorShape.vectorShapeStrokeColor !== null) {
      pdfKitDocument
        .strokeColor(vectorShape.vectorShapeStrokeGradient === null ? vectorShape.vectorShapeStrokeColor : createGradient(vectorShape.vectorShapeStrokeGradient), vectorShape.vectorShapeStrokeOpacity)
        .lineWidth(vectorShape.vectorShapeStrokeWidth)
        .lineCap(vectorShape.vectorShapeLineCap)
        .lineJoin(vectorShape.vectorShapeLineJoin)
        .miterLimit(vectorShape.vectorShapeMiterLimit)
      if (vectorShape.vectorShapeDashArray.length > 0) pdfKitDocument.dash(vectorShape.vectorShapeDashArray, { phase: vectorShape.vectorShapeDashOffset })
    }
    pdfKitDocument.path(vectorShape.vectorShapePathData)
    if (hasFill && hasStroke) pdfKitDocument.fillAndStroke(vectorShape.vectorShapeFillRule)
    else if (hasFill) pdfKitDocument.fill(vectorShape.vectorShapeFillRule)
    else pdfKitDocument.stroke()
    pdfKitDocument.restore()
  }
  vectorDrawingOperation.vectorDrawing.vectorTextRuns.forEach((vectorTextRun, vectorTextRunIndex) => {
    const vectorTextRunFontFaceKey = vectorDrawingOperation.vectorTextRunFontFaceKeys[vectorTextRunIndex]
    if (vectorTextRunFontFaceKey === undefined) return
    pdfKitDocument
      .save()
      .transform(...vectorTextRun.vectorTextRunTransform)
      .font(vectorTextRunFontFaceKey)
      .fontSize(vectorTextRun.vectorTextRunSize)
      .fillColor(vectorTextRun.vectorTextRunColor, vectorTextRun.vectorTextRunOpacity)
      .text(vectorTextRun.vectorTextRunText, vectorTextRun.vectorTextRunLeft, vectorTextRun.vectorTextRunBaseline, { lineBreak: false, baseline: 'alphabetic' })
      .restore()
  })
  pdfKitDocument.restore()
}

// Links and named places hold no drawing: they are annotations and entries of the file, made where
// their page is current.
function isMarkedContentOperation(pageOperation: PapelizPdfExportPageOperation): boolean {
  return pageOperation.pageOperationKind !== 'link-area' && pageOperation.pageOperationKind !== 'destination'
}

function addLinkArea(pdfKitDocument: PDFDocument, linkAreaOperation: PapelizPdfExportLinkAreaOperation, linkStructureElement: PapelizPdfKitStructureElement): void {
  const { linkAreaLeftPoints, linkAreaTopPoints, linkAreaWidthPoints, linkAreaHeightPoints, linkAreaTarget } = linkAreaOperation
  // A link names what it leads to, for screen readers.
  const annotationOptions = { structParent: linkStructureElement, Contents: new String(linkAreaOperation.linkAreaDescription) }
  if (linkAreaTarget.linkTargetKind === 'web') pdfKitDocument.link(linkAreaLeftPoints, linkAreaTopPoints, linkAreaWidthPoints, linkAreaHeightPoints, linkAreaTarget.webLinkAddress, annotationOptions)
  else pdfKitDocument.goTo(linkAreaLeftPoints, linkAreaTopPoints, linkAreaWidthPoints, linkAreaHeightPoints, linkAreaTarget.noteDestinationName, annotationOptions)
}

function addDestination(pdfKitDocument: PDFDocument, destinationOperation: PapelizPdfExportDestinationOperation): void {
  pdfKitDocument.addNamedDestination(destinationOperation.destinationName, 'XYZ', null, destinationOperation.destinationTopPoints, null)
}

interface PapelizPdfExportOutlineEntry {
  outlineItem: PapelizPdfKitOutline
  bookmarkDepth: number
  childOutlineEntries: PapelizPdfExportOutlineEntry[]
}

// The bookmarks open to two levels.
const papelizPdfExportOpenBookmarkDepth = 2

function isOutlineEntryOpen(outlineEntry: PapelizPdfExportOutlineEntry): boolean {
  return outlineEntry.bookmarkDepth <= papelizPdfExportOpenBookmarkDepth
}

// How many items show under an entry while it is open: its children, and theirs while open.
function countVisibleOutlineEntries(outlineEntries: readonly PapelizPdfExportOutlineEntry[]): number {
  return outlineEntries.reduce(
    (visibleEntryCount, outlineEntry) => visibleEntryCount + 1 + (isOutlineEntryOpen(outlineEntry) ? countVisibleOutlineEntries(outlineEntry.childOutlineEntries) : 0),
    0,
  )
}

function setOutlineCounts(outlineEntries: readonly PapelizPdfExportOutlineEntry[]): void {
  for (const outlineEntry of outlineEntries) {
    if (outlineEntry.childOutlineEntries.length === 0) continue
    const visibleChildCount = countVisibleOutlineEntries(outlineEntry.childOutlineEntries)
    outlineEntry.outlineItem.outlineData.Count = isOutlineEntryOpen(outlineEntry) ? visibleChildCount : -visibleChildCount
    setOutlineCounts(outlineEntry.childOutlineEntries)
  }
}

// One bookmark per heading, nested by depth, each leading to its heading's named place. A note with
// two or more opens with the bookmarks shown; with one, the page alone.
function addBookmarks(pdfKitDocument: PDFDocument, pdfExportBookmarks: readonly PapelizPdfExportBookmark[], destinationPageIndexes: ReadonlyMap<string, number>): void {
  const rootOutlineEntries: PapelizPdfExportOutlineEntry[] = []
  const openOutlineEntries: PapelizPdfExportOutlineEntry[] = []
  for (const { bookmarkTitle, bookmarkDepth, bookmarkDestinationName } of pdfExportBookmarks) {
    while (openOutlineEntries.length >= bookmarkDepth) openOutlineEntries.pop()
    const parentOutlineEntry = openOutlineEntries.at(-1)
    const outlineItem = (parentOutlineEntry?.outlineItem ?? pdfKitDocument.outline).addItem(bookmarkTitle, { pageNumber: destinationPageIndexes.get(bookmarkDestinationName) ?? 0 })
    outlineItem.outlineData.Dest = new String(bookmarkDestinationName)
    const outlineEntry: PapelizPdfExportOutlineEntry = { outlineItem, bookmarkDepth, childOutlineEntries: [] }
    ;(parentOutlineEntry?.childOutlineEntries ?? rootOutlineEntries).push(outlineEntry)
    openOutlineEntries.push(outlineEntry)
  }
  setOutlineCounts(rootOutlineEntries)
  if (rootOutlineEntries.length > 0) pdfKitDocument.outline.outlineData.Count = countVisibleOutlineEntries(rootOutlineEntries)
  if (pdfExportBookmarks.length === 1) pdfKitDocument._root.data.PageMode = 'UseNone'
}

function getOperationTaggingKey(operationTagging: PapelizPdfExportOperationTagging): string {
  return operationTagging.operationTaggingKind === 'structure' ? `structure:${operationTagging.structureElementKey}` : `artifact:${operationTagging.artifactType}`
}

function getPageOperationTagging(pageOperation: PapelizPdfExportPageOperation): PapelizPdfExportOperationTagging {
  return pageOperation.pageOperationKind === 'text-run' || pageOperation.pageOperationKind === 'vector-drawing' || pageOperation.pageOperationKind === 'picture'
    ? pageOperation.operationTagging
    : { operationTaggingKind: 'artifact', artifactType: 'Layout' }
}

export interface PapelizPdfExportDrawingProgress {
  onPdfPageDrawn: (drawnPageCount: number, pdfPageCount: number) => void
  throwIfPdfExportCancelled: () => void
}

// Draws every page and finishes the file. Consecutive drawings of one structure element go into one
// marked piece of content; an element that runs onto the next page gets another piece there. An
// element is made when its first drawing is, inside its parent, so the structure keeps reading order.
export async function drawPapelizPdfExportPageLayoutPlan(
  openDocument: PapelizPdfExportOpenDocument,
  pageLayoutPlan: PapelizPdfExportPageLayoutPlan,
  pictureFiles: PapelizPdfExportPictureFiles,
  drawingProgress: PapelizPdfExportDrawingProgress,
): Promise<Uint8Array> {
  const { pdfKitDocument, outputCollector } = openDocument
  const openedPicturesByKey = new Map<string, PapelizPdfKitImage>()
  const openPicture: PapelizPdfExportPictureOpener = (pictureSource) => {
    const pictureKey = pictureSource.pictureSourceKind === 'note-picture' ? `note ${pictureSource.notePictureIndex}` : `character ${pictureSource.characterPictureKey}`
    const openedPicture = openedPicturesByKey.get(pictureKey)
    if (openedPicture !== undefined) return openedPicture
    const pictureFile = pictureSource.pictureSourceKind === 'note-picture' ? pictureFiles.notePictureFiles[pictureSource.notePictureIndex] : pictureFiles.characterPictureFilesByKey.get(pictureSource.characterPictureKey)
    if (pictureFile === undefined) throw new PapelizPdfExportError('pdf-export-writer-failed', 'A planned picture is missing.')
    const pdfKitImage = pdfKitDocument.openImage(pictureFile.pictureBytes)
    openedPicturesByKey.set(pictureKey, pdfKitImage)
    return pdfKitImage
  }
  const documentStructureElement = pdfKitDocument.struct('Document')
  pdfKitDocument.addStructure(documentStructureElement)
  const plannedStructureElementsByKey = new Map(pageLayoutPlan.pdfExportStructureElements.map((plannedStructureElement) => [plannedStructureElement.structureElementKey, plannedStructureElement]))
  const structureElementsByKey = new Map<string, PapelizPdfKitStructureElement>()
  const getStructureElement = (structureElementKey: string): PapelizPdfKitStructureElement => {
    const knownStructureElement = structureElementsByKey.get(structureElementKey)
    if (knownStructureElement !== undefined) return knownStructureElement
    const plannedStructureElement = plannedStructureElementsByKey.get(structureElementKey)
    const parentStructureElementKey = plannedStructureElement?.parentStructureElementKey ?? null
    const parentStructureElement = parentStructureElementKey === null ? documentStructureElement : getStructureElement(parentStructureElementKey)
    const structureAlternateText = plannedStructureElement?.structureAlternateText ?? null
    const structureRole = plannedStructureElement?.structureRole ?? 'P'
    const structureElement = pdfKitDocument.struct(structureRole, structureAlternateText === null ? {} : { alt: structureAlternateText })
    // PDF/UA asks a table header cell to say what it heads (its column), and a note for an ID of its
    // own.
    if (structureRole === 'TH') structureElement.dictionary.data['A'] = { O: 'Table', Scope: 'Column' }
    if (structureRole === 'Note') structureElement.dictionary.data['ID'] = new String(`papeliz-note-${structureElementKey}`)
    parentStructureElement.add(structureElement)
    structureElementsByKey.set(structureElementKey, structureElement)
    return structureElement
  }
  const destinationPageIndexes = new Map<string, number>()
  const pdfPageCount = pageLayoutPlan.pdfExportPages.length
  for (const [pageIndex, pagePlan] of pageLayoutPlan.pdfExportPages.entries()) {
    drawingProgress.throwIfPdfExportCancelled()
    pdfKitDocument.addPage({ size: [pageLayoutPlan.pdfExportPageWidthPoints, pageLayoutPlan.pdfExportPageHeightPoints], margin: 0 })
    let operationGroupStartIndex = 0
    while (operationGroupStartIndex < pagePlan.pageOperations.length) {
      const groupStartOperation = pagePlan.pageOperations[operationGroupStartIndex] as PapelizPdfExportPageOperation
      if (groupStartOperation.pageOperationKind === 'link-area') {
        addLinkArea(pdfKitDocument, groupStartOperation, getStructureElement(groupStartOperation.structureElementKey))
        operationGroupStartIndex += 1
        continue
      }
      if (groupStartOperation.pageOperationKind === 'destination') {
        addDestination(pdfKitDocument, groupStartOperation)
        destinationPageIndexes.set(groupStartOperation.destinationName, pageIndex)
        operationGroupStartIndex += 1
        continue
      }
      const groupTagging = getPageOperationTagging(groupStartOperation)
      let operationGroupEndIndex = operationGroupStartIndex + 1
      while (
        operationGroupEndIndex < pagePlan.pageOperations.length &&
        isMarkedContentOperation(pagePlan.pageOperations[operationGroupEndIndex] as PapelizPdfExportPageOperation) &&
        getOperationTaggingKey(getPageOperationTagging(pagePlan.pageOperations[operationGroupEndIndex] as PapelizPdfExportPageOperation)) === getOperationTaggingKey(groupTagging)
      ) {
        operationGroupEndIndex += 1
      }
      const groupOperations = pagePlan.pageOperations.slice(operationGroupStartIndex, operationGroupEndIndex)
      const drawGroupOperations = () => {
        for (const groupOperation of groupOperations) drawPageOperation(pdfKitDocument, groupOperation, openPicture)
      }
      if (groupTagging.operationTaggingKind === 'structure') {
        getStructureElement(groupTagging.structureElementKey).add(drawGroupOperations)
      } else {
        pdfKitDocument.markContent('Artifact', { type: groupTagging.artifactType })
        drawGroupOperations()
        pdfKitDocument.endMarkedContent()
      }
      operationGroupStartIndex = operationGroupEndIndex
    }
    outputCollector.throwIfPastSizeLimit()
    drawingProgress.onPdfPageDrawn(pageIndex + 1, pdfPageCount)
  }
  addBookmarks(pdfKitDocument, pageLayoutPlan.pdfExportBookmarks, destinationPageIndexes)
  documentStructureElement.end()
  pdfKitDocument.end()
  const pdfFileBytes = await outputCollector.pdfFileBytesPromise
  outputCollector.throwIfPastSizeLimit()
  return pdfFileBytes
}
