import { PapelizPdfExportError } from './papeliz-pdf-export-errors'
import type { PapelizPdfExportLimits } from './papeliz-pdf-export-limits'
import { checkPapelizPdfExportWebLinkAddress, papelizPdfExportDestinationNamePattern } from './papeliz-pdf-export-links'
import type { PapelizPdfExportLinkTarget } from './papeliz-pdf-export-note-document'
import { findPapelizPdfExportVectorDrawingProblem, type PapelizPdfExportVectorDrawing } from './papeliz-pdf-export-vector-drawing'

// The pages as plain data: what the layout produces and the only thing the writer draws. Positions
// are in points from the page's top left, rounded to 0.001 pt, so the same note always gives the same
// plan. Before drawing, the plan is checked: a plan that fails is never written.

// Body text uses the fonts' standard features (kerning, Figtree's ligatures); code turns ligatures
// off so its characters stay exact.
export type PapelizPdfExportOpenTypeFeatureSet = 'standard' | 'no-ligatures'

export const papelizPdfExportOpenTypeFeaturesBySet: Readonly<Record<PapelizPdfExportOpenTypeFeatureSet, Readonly<Record<string, boolean>> | undefined>> = {
  standard: undefined,
  'no-ligatures': { liga: false, clig: false, calt: false, dlig: false, rclt: false },
}

// Text belongs to a block of the document's structure; shapes and the footer are page furniture.
export type PapelizPdfExportOperationTagging =
  | { operationTaggingKind: 'structure'; structureElementKey: string }
  | { operationTaggingKind: 'artifact'; artifactType: 'Layout' | 'Pagination' }

export interface PapelizPdfExportTextRunOperation {
  pageOperationKind: 'text-run'
  textRunText: string
  fontFaceKey: string
  textSizePoints: number
  textColor: string
  characterSpacingPoints: number
  openTypeFeatureSet: PapelizPdfExportOpenTypeFeatureSet
  textLeftPoints: number
  textBaselinePoints: number
  // As measured with the font that draws it.
  textWidthPoints: number
  // A computer font's upright face standing in for its italic or bold: slanted, thickened.
  textSynthesis: PapelizPdfExportTextSynthesis | null
  operationTagging: PapelizPdfExportOperationTagging
}

export interface PapelizPdfExportTextSynthesis {
  // 12 for italic, 0 for upright.
  textSlantDegrees: number
  // Its outline stroked this wide too, for bold; 0 for none.
  textStrokeWidthPoints: number
}

export interface PapelizPdfExportRectangleOperation {
  pageOperationKind: 'rectangle'
  rectangleLeftPoints: number
  rectangleTopPoints: number
  rectangleWidthPoints: number
  rectangleHeightPoints: number
  rectangleCornerRadiusPoints: number
  rectangleFillColor: string | null
  // Drawn inside the rectangle's edge, as CSS draws a border.
  rectangleStrokeColor: string | null
  rectangleStrokeWidthPoints: number
}

export interface PapelizPdfExportLineOperation {
  pageOperationKind: 'line'
  lineFromLeftPoints: number
  lineFromTopPoints: number
  lineToLeftPoints: number
  lineToTopPoints: number
  lineColor: string
  lineWidthPoints: number
  // A dash and its gap; null for a solid line.
  lineDashPoints: number | null
}

// A drawn shape in SVG path syntax (a task's check, a footnote's back arrow), in its own units: placed
// at its top left and scaled to points.
export interface PapelizPdfExportPathOperation {
  pageOperationKind: 'path'
  pathData: string
  pathLeftPoints: number
  pathTopPoints: number
  pathScale: number
  pathFillColor: string | null
  pathStrokeColor: string | null
  // In the path's own units.
  pathStrokeWidth: number
}

// The clickable area of one line piece of a link, with no border. Not drawn: an annotation on the page.
export interface PapelizPdfExportLinkAreaOperation {
  pageOperationKind: 'link-area'
  linkAreaLeftPoints: number
  linkAreaTopPoints: number
  linkAreaWidthPoints: number
  linkAreaHeightPoints: number
  linkAreaTarget: PapelizPdfExportLinkTarget
  linkAreaDescription: string
  // The link's structure element, which holds its text and this area.
  structureElementKey: string
}

// A drawing made of SVG paths (an icon, later a diagram), placed at its top left and scaled from its
// own units to points. Its labels are drawn in the face each names.
export interface PapelizPdfExportVectorDrawingOperation {
  pageOperationKind: 'vector-drawing'
  vectorDrawing: PapelizPdfExportVectorDrawing
  // The face key of each label, in the drawing's order.
  vectorTextRunFontFaceKeys: string[]
  drawingLeftPoints: number
  drawingTopPoints: number
  drawingScale: number
  operationTagging: PapelizPdfExportOperationTagging
}

// A picture: one of the note's (by its place in the job's list) or a picture of a character (by its
// key), drawn into its box with rounded corners when MD View rounds them.
export type PapelizPdfExportPictureSource = { pictureSourceKind: 'note-picture'; notePictureIndex: number } | { pictureSourceKind: 'character-picture'; characterPictureKey: string }

export interface PapelizPdfExportPictureOperation {
  pageOperationKind: 'picture'
  pictureSource: PapelizPdfExportPictureSource
  pictureLeftPoints: number
  pictureTopPoints: number
  pictureWidthPoints: number
  pictureHeightPoints: number
  pictureCornerRadiusPoints: number
  operationTagging: PapelizPdfExportOperationTagging
}

// A named place links and bookmarks lead to: the page, and how far down it the view opens.
export interface PapelizPdfExportDestinationOperation {
  pageOperationKind: 'destination'
  destinationName: string
  destinationTopPoints: number
}

export type PapelizPdfExportPageOperation =
  | PapelizPdfExportTextRunOperation
  | PapelizPdfExportRectangleOperation
  | PapelizPdfExportLineOperation
  | PapelizPdfExportPathOperation
  | PapelizPdfExportVectorDrawingOperation
  | PapelizPdfExportPictureOperation
  | PapelizPdfExportLinkAreaOperation
  | PapelizPdfExportDestinationOperation

export interface PapelizPdfExportPagePlan {
  pageOperations: PapelizPdfExportPageOperation[]
}

export type PapelizPdfExportStructureRole =
  | 'H1'
  | 'H2'
  | 'H3'
  | 'H4'
  | 'H5'
  | 'H6'
  | 'P'
  | 'Code'
  | 'L'
  | 'LI'
  | 'Lbl'
  | 'LBody'
  | 'BlockQuote'
  | 'Link'
  | 'Note'
  | 'Div'
  | 'Table'
  | 'TR'
  | 'TH'
  | 'TD'
  | 'Figure'

export interface PapelizPdfExportStructureElement {
  structureElementKey: string
  structureRole: PapelizPdfExportStructureRole
  // A list item in its list, a link in its paragraph; null for a child of the document.
  parentStructureElementKey: string | null
  // A figure's description: a picture's alt text, a diagram's Mermaid source.
  structureAlternateText: string | null
}

// One heading's bookmark: its plain text, its depth in the outline (a skipped heading level hangs
// under the nearest higher heading, so depths never jump), and the heading's named place.
export interface PapelizPdfExportBookmark {
  bookmarkTitle: string
  bookmarkDepth: number
  bookmarkDestinationName: string
}

export interface PapelizPdfExportPageLayoutPlan {
  pdfExportDocumentTitle: string
  pdfExportDocumentLanguageTag: string
  pdfExportPageWidthPoints: number
  pdfExportPageHeightPoints: number
  pdfExportFontFaceKeys: string[]
  // In reading order, each after its parent.
  pdfExportStructureElements: PapelizPdfExportStructureElement[]
  pdfExportPages: PapelizPdfExportPagePlan[]
  // In the note's order.
  pdfExportBookmarks: PapelizPdfExportBookmark[]
  // How many of the note's pictures the job holds, and the keys of its pictures of characters.
  pdfExportNotePictureCount: number
  pdfExportCharacterPictureKeys: string[]
}

export function roundPapelizPdfExportPoints(pointsValue: number): number {
  return Math.round(pointsValue * 1_000) / 1_000
}

const papelizPdfExportPlanColorPattern = /^#[0-9a-f]{6}$/
// SVG path data: commands and numbers only, so nothing else reaches pdfkit's path reader.
const papelizPdfExportPlanPathDataPattern = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]{1,4096}$/
const papelizPdfExportPlanDescriptionLength = 1_024
const papelizPdfExportPlanBookmarkTitleLength = 1_024
// Text may reach a hair past its line, as a font's own glyph edges do.
const papelizPdfExportPlanToleranceInPoints = 0.01

function failPapelizPdfExportPlanCheck(planCheckFailure: string): never {
  throw new PapelizPdfExportError('pdf-export-layout-failed', `The page layout plan failed its check: ${planCheckFailure}.`)
}

function checkPlanNumber(planNumber: number, planNumberName: string, smallestPlanNumber: number, largestPlanNumber: number): void {
  if (!Number.isFinite(planNumber) || planNumber < smallestPlanNumber - papelizPdfExportPlanToleranceInPoints || planNumber > largestPlanNumber + papelizPdfExportPlanToleranceInPoints) {
    failPapelizPdfExportPlanCheck(`${planNumberName} is ${planNumber}, outside ${smallestPlanNumber}–${largestPlanNumber}`)
  }
}

function checkPlanColor(planColor: string | null, planColorName: string): void {
  if (planColor !== null && !papelizPdfExportPlanColorPattern.test(planColor)) failPapelizPdfExportPlanCheck(`${planColorName} "${planColor}" isn't a #rrggbb color`)
}

// Every operation on its page, every font registered, every structure element known and after its
// parent, every color and number well formed, every web link a checked address, every internal link
// and bookmark leading to a place that exists, bookmark depths never jumping, and the limits kept.
export function checkPapelizPdfExportPageLayoutPlan(pageLayoutPlan: PapelizPdfExportPageLayoutPlan, pdfExportLimits: PapelizPdfExportLimits): void {
  const { pdfExportPageWidthPoints: pageWidthPoints, pdfExportPageHeightPoints: pageHeightPoints } = pageLayoutPlan
  checkPlanNumber(pageWidthPoints, 'The page width', 72, 14_400)
  checkPlanNumber(pageHeightPoints, 'The page height', 72, 14_400)
  if (pageLayoutPlan.pdfExportPages.length === 0) failPapelizPdfExportPlanCheck('it has no pages')
  if (pageLayoutPlan.pdfExportPages.length > pdfExportLimits.maximumPdfPageCountPerNote) {
    throw new PapelizPdfExportError('pdf-export-limit-reached', `The note needs more than ${pdfExportLimits.maximumPdfPageCountPerNote.toLocaleString('en-US')} pages.`)
  }
  const registeredFontFaceKeys = new Set(pageLayoutPlan.pdfExportFontFaceKeys)
  const structureElementKeys = new Set<string>()
  for (const { structureElementKey, parentStructureElementKey } of pageLayoutPlan.pdfExportStructureElements) {
    if (structureElementKeys.has(structureElementKey)) failPapelizPdfExportPlanCheck(`the structure element ${structureElementKey} is listed twice`)
    if (parentStructureElementKey !== null && !structureElementKeys.has(parentStructureElementKey)) {
      failPapelizPdfExportPlanCheck(`the structure element ${structureElementKey} comes before its parent ${parentStructureElementKey}`)
    }
    structureElementKeys.add(structureElementKey)
  }
  const destinationNames = new Set<string>()
  const linkedDestinationNames = new Set<string>()
  const characterPictureKeys = new Set(pageLayoutPlan.pdfExportCharacterPictureKeys)
  pageLayoutPlan.pdfExportPages.forEach((pagePlan, pageIndex) => {
    const pageName = `page ${pageIndex + 1}`
    if (pagePlan.pageOperations.length > pdfExportLimits.maximumPageOperationCount) {
      throw new PapelizPdfExportError('pdf-export-limit-reached', `Page ${pageIndex + 1} holds more than ${pdfExportLimits.maximumPageOperationCount.toLocaleString('en-US')} drawings.`)
    }
    for (const pageOperation of pagePlan.pageOperations) {
      switch (pageOperation.pageOperationKind) {
        case 'text-run':
          if (!registeredFontFaceKeys.has(pageOperation.fontFaceKey)) failPapelizPdfExportPlanCheck(`text on ${pageName} uses the unregistered font ${pageOperation.fontFaceKey}`)
          if (pageOperation.textRunText.length === 0 || pageOperation.textRunText.length > pdfExportLimits.maximumTextRunCodeUnitCount) failPapelizPdfExportPlanCheck(`text on ${pageName} is empty or too long`)
          if (pageOperation.operationTagging.operationTaggingKind === 'structure' && !structureElementKeys.has(pageOperation.operationTagging.structureElementKey)) {
            failPapelizPdfExportPlanCheck(`text on ${pageName} belongs to the unknown structure element ${pageOperation.operationTagging.structureElementKey}`)
          }
          checkPlanNumber(pageOperation.textSizePoints, `A text size on ${pageName}`, 1, 400)
          checkPlanNumber(pageOperation.characterSpacingPoints, `A character spacing on ${pageName}`, -10, 10)
          checkPlanNumber(pageOperation.textLeftPoints, `A text's left edge on ${pageName}`, 0, pageWidthPoints)
          checkPlanNumber(pageOperation.textLeftPoints + pageOperation.textWidthPoints, `A text's right edge on ${pageName}`, 0, pageWidthPoints)
          checkPlanNumber(pageOperation.textBaselinePoints, `A text's baseline on ${pageName}`, 0, pageHeightPoints)
          checkPlanColor(pageOperation.textColor, `A text color on ${pageName}`)
          if (pageOperation.textSynthesis !== null) {
            checkPlanNumber(pageOperation.textSynthesis.textSlantDegrees, `A text's slant on ${pageName}`, 0, 20)
            checkPlanNumber(pageOperation.textSynthesis.textStrokeWidthPoints, `A text's thickening on ${pageName}`, 0, 5)
          }
          break
        case 'rectangle':
          checkPlanNumber(pageOperation.rectangleLeftPoints, `A box's left edge on ${pageName}`, 0, pageWidthPoints)
          checkPlanNumber(pageOperation.rectangleTopPoints, `A box's top edge on ${pageName}`, 0, pageHeightPoints)
          checkPlanNumber(pageOperation.rectangleLeftPoints + pageOperation.rectangleWidthPoints, `A box's right edge on ${pageName}`, 0, pageWidthPoints)
          checkPlanNumber(pageOperation.rectangleTopPoints + pageOperation.rectangleHeightPoints, `A box's bottom edge on ${pageName}`, 0, pageHeightPoints)
          checkPlanNumber(pageOperation.rectangleCornerRadiusPoints, `A box's corner on ${pageName}`, 0, pageWidthPoints)
          checkPlanNumber(pageOperation.rectangleStrokeWidthPoints, `A box's border on ${pageName}`, 0, 72)
          checkPlanColor(pageOperation.rectangleFillColor, `A box's color on ${pageName}`)
          checkPlanColor(pageOperation.rectangleStrokeColor, `A box's border color on ${pageName}`)
          break
        case 'line':
          checkPlanNumber(pageOperation.lineFromLeftPoints, `A line's start on ${pageName}`, 0, pageWidthPoints)
          checkPlanNumber(pageOperation.lineToLeftPoints, `A line's end on ${pageName}`, 0, pageWidthPoints)
          checkPlanNumber(pageOperation.lineFromTopPoints, `A line's start on ${pageName}`, 0, pageHeightPoints)
          checkPlanNumber(pageOperation.lineToTopPoints, `A line's end on ${pageName}`, 0, pageHeightPoints)
          checkPlanNumber(pageOperation.lineWidthPoints, `A line's width on ${pageName}`, 0, 72)
          checkPlanColor(pageOperation.lineColor, `A line's color on ${pageName}`)
          break
        case 'path':
          if (!papelizPdfExportPlanPathDataPattern.test(pageOperation.pathData)) failPapelizPdfExportPlanCheck(`a shape on ${pageName} isn't plain path data`)
          checkPlanNumber(pageOperation.pathLeftPoints, `A shape's left edge on ${pageName}`, 0, pageWidthPoints)
          checkPlanNumber(pageOperation.pathTopPoints, `A shape's top edge on ${pageName}`, 0, pageHeightPoints)
          checkPlanNumber(pageOperation.pathScale, `A shape's scale on ${pageName}`, 0.001, 10)
          checkPlanNumber(pageOperation.pathStrokeWidth, `A shape's line width on ${pageName}`, 0, 100)
          checkPlanColor(pageOperation.pathFillColor, `A shape's color on ${pageName}`)
          checkPlanColor(pageOperation.pathStrokeColor, `A shape's line color on ${pageName}`)
          break
        case 'vector-drawing': {
          const vectorDrawingProblem = findPapelizPdfExportVectorDrawingProblem(pageOperation.vectorDrawing)
          if (vectorDrawingProblem !== null) failPapelizPdfExportPlanCheck(`a drawing on ${pageName} can't be drawn: ${vectorDrawingProblem}`)
          checkPlanNumber(pageOperation.drawingScale, `A drawing's scale on ${pageName}`, 0.0001, 100)
          checkPlanNumber(pageOperation.drawingLeftPoints, `A drawing's left edge on ${pageName}`, 0, pageWidthPoints)
          checkPlanNumber(pageOperation.drawingTopPoints, `A drawing's top edge on ${pageName}`, 0, pageHeightPoints)
          checkPlanNumber(pageOperation.drawingLeftPoints + pageOperation.vectorDrawing.vectorDrawingWidth * pageOperation.drawingScale, `A drawing's right edge on ${pageName}`, 0, pageWidthPoints)
          checkPlanNumber(pageOperation.drawingTopPoints + pageOperation.vectorDrawing.vectorDrawingHeight * pageOperation.drawingScale, `A drawing's bottom edge on ${pageName}`, 0, pageHeightPoints)
          if (pageOperation.vectorTextRunFontFaceKeys.length !== pageOperation.vectorDrawing.vectorTextRuns.length) failPapelizPdfExportPlanCheck(`a drawing's labels on ${pageName} have no faces`)
          for (const vectorTextRunFontFaceKey of pageOperation.vectorTextRunFontFaceKeys) {
            if (!registeredFontFaceKeys.has(vectorTextRunFontFaceKey)) failPapelizPdfExportPlanCheck(`a drawing's label on ${pageName} uses the unregistered font ${vectorTextRunFontFaceKey}`)
          }
          const { operationTagging } = pageOperation
          if (operationTagging.operationTaggingKind === 'structure' && !structureElementKeys.has(operationTagging.structureElementKey)) {
            failPapelizPdfExportPlanCheck(`a drawing on ${pageName} belongs to the unknown structure element ${operationTagging.structureElementKey}`)
          }
          break
        }
        case 'picture': {
          const { pictureSource } = pageOperation
          const isKnownPicture =
            pictureSource.pictureSourceKind === 'note-picture'
              ? Number.isSafeInteger(pictureSource.notePictureIndex) && pictureSource.notePictureIndex >= 0 && pictureSource.notePictureIndex < pageLayoutPlan.pdfExportNotePictureCount
              : characterPictureKeys.has(pictureSource.characterPictureKey)
          if (!isKnownPicture) failPapelizPdfExportPlanCheck(`a picture on ${pageName} isn't one the job holds`)
          checkPlanNumber(pageOperation.pictureLeftPoints, `A picture's left edge on ${pageName}`, 0, pageWidthPoints)
          checkPlanNumber(pageOperation.pictureTopPoints, `A picture's top edge on ${pageName}`, 0, pageHeightPoints)
          checkPlanNumber(pageOperation.pictureLeftPoints + pageOperation.pictureWidthPoints, `A picture's right edge on ${pageName}`, 0, pageWidthPoints)
          checkPlanNumber(pageOperation.pictureTopPoints + pageOperation.pictureHeightPoints, `A picture's bottom edge on ${pageName}`, 0, pageHeightPoints)
          checkPlanNumber(pageOperation.pictureWidthPoints, `A picture's width on ${pageName}`, 0.01, pageWidthPoints)
          checkPlanNumber(pageOperation.pictureHeightPoints, `A picture's height on ${pageName}`, 0.01, pageHeightPoints)
          checkPlanNumber(pageOperation.pictureCornerRadiusPoints, `A picture's corners on ${pageName}`, 0, pageWidthPoints)
          const { operationTagging } = pageOperation
          if (operationTagging.operationTaggingKind === 'structure' && !structureElementKeys.has(operationTagging.structureElementKey)) {
            failPapelizPdfExportPlanCheck(`a picture on ${pageName} belongs to the unknown structure element ${operationTagging.structureElementKey}`)
          }
          break
        }
        case 'link-area': {
          checkPlanNumber(pageOperation.linkAreaLeftPoints, `A link's left edge on ${pageName}`, 0, pageWidthPoints)
          checkPlanNumber(pageOperation.linkAreaTopPoints, `A link's top edge on ${pageName}`, 0, pageHeightPoints)
          checkPlanNumber(pageOperation.linkAreaLeftPoints + pageOperation.linkAreaWidthPoints, `A link's right edge on ${pageName}`, 0, pageWidthPoints)
          checkPlanNumber(pageOperation.linkAreaTopPoints + pageOperation.linkAreaHeightPoints, `A link's bottom edge on ${pageName}`, 0, pageHeightPoints)
          if (!structureElementKeys.has(pageOperation.structureElementKey)) failPapelizPdfExportPlanCheck(`a link on ${pageName} belongs to the unknown structure element ${pageOperation.structureElementKey}`)
          if (pageOperation.linkAreaDescription.length > papelizPdfExportPlanDescriptionLength) failPapelizPdfExportPlanCheck(`a link's description on ${pageName} is too long`)
          const { linkAreaTarget } = pageOperation
          if (linkAreaTarget.linkTargetKind === 'web') {
            if (checkPapelizPdfExportWebLinkAddress(linkAreaTarget.webLinkAddress) !== linkAreaTarget.webLinkAddress) failPapelizPdfExportPlanCheck(`a web link on ${pageName} isn't a checked address`)
          } else {
            linkedDestinationNames.add(linkAreaTarget.noteDestinationName)
          }
          break
        }
        case 'destination':
          if (!papelizPdfExportDestinationNamePattern.test(pageOperation.destinationName)) failPapelizPdfExportPlanCheck(`a place on ${pageName} has the name "${pageOperation.destinationName}"`)
          if (destinationNames.has(pageOperation.destinationName)) failPapelizPdfExportPlanCheck(`the place ${pageOperation.destinationName} is named twice`)
          destinationNames.add(pageOperation.destinationName)
          checkPlanNumber(pageOperation.destinationTopPoints, `A place's top on ${pageName}`, 0, pageHeightPoints)
          break
      }
    }
  })
  for (const linkedDestinationName of linkedDestinationNames) {
    if (!destinationNames.has(linkedDestinationName)) failPapelizPdfExportPlanCheck(`a link leads to the missing place ${linkedDestinationName}`)
  }
  let previousBookmarkDepth = 0
  for (const { bookmarkTitle, bookmarkDepth, bookmarkDestinationName } of pageLayoutPlan.pdfExportBookmarks) {
    if (!Number.isSafeInteger(bookmarkDepth) || bookmarkDepth < 1 || bookmarkDepth > previousBookmarkDepth + 1) failPapelizPdfExportPlanCheck(`the bookmark "${bookmarkTitle}" jumps to depth ${bookmarkDepth}`)
    if (bookmarkTitle.trim().length === 0 || bookmarkTitle.length > papelizPdfExportPlanBookmarkTitleLength) failPapelizPdfExportPlanCheck('a bookmark has no title, or one too long')
    if (!destinationNames.has(bookmarkDestinationName)) failPapelizPdfExportPlanCheck(`the bookmark "${bookmarkTitle}" leads to the missing place ${bookmarkDestinationName}`)
    previousBookmarkDepth = bookmarkDepth
  }
}
