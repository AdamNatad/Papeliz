import { papelizHtmlExportIconShapesByName, type PapelizHtmlExportIconName } from '../html-export/papeliz-html-export-icons'
import type { PapelizPdfExportFontFamilyName } from './papeliz-pdf-export-fonts'

// Papeliz's own SVG drawing: a drawing as plain data the PDF worker draws with pdfkit's paths, made
// on the main thread or from Papeliz's own shapes. Every shape is SVG path data with its transform to
// the drawing's units and its paint; text is a run in an embedded face. The worker never reads SVG:
// it checks this data (finite, bounded numbers, path data in the SVG path grammar, #rrggbb colors,
// limits) and draws it. The callout and property icons are drawn this way, and Mermaid diagrams
// (papeliz-pdf-export-diagram-drawing.ts).

export type PapelizPdfExportVectorTransform = readonly [scaleX: number, skewY: number, skewX: number, scaleY: number, translateX: number, translateY: number]

// A linear gradient in the shape's own units, from its start point to its end point, padded past both.
export interface PapelizPdfExportVectorGradient {
  gradientStartX: number
  gradientStartY: number
  gradientEndX: number
  gradientEndY: number
  gradientStops: Array<{ stopOffset: number; stopColor: string; stopOpacity: number }>
}

export interface PapelizPdfExportVectorShape {
  vectorShapePathData: string
  vectorShapeTransform: PapelizPdfExportVectorTransform
  vectorShapeFillColor: string | null
  // Painted with a gradient instead of the color, when set.
  vectorShapeFillGradient: PapelizPdfExportVectorGradient | null
  vectorShapeStrokeGradient: PapelizPdfExportVectorGradient | null
  vectorShapeFillOpacity: number
  vectorShapeFillRule: 'nonzero' | 'evenodd'
  vectorShapeStrokeColor: string | null
  vectorShapeStrokeOpacity: number
  vectorShapeStrokeWidth: number
  vectorShapeLineCap: 'butt' | 'round' | 'square'
  vectorShapeLineJoin: 'miter' | 'round' | 'bevel'
  vectorShapeMiterLimit: number
  // Empty for a solid line.
  vectorShapeDashArray: number[]
  vectorShapeDashOffset: number
}

// A label: its text from its start point on the baseline, in a face the worker embeds.
export interface PapelizPdfExportVectorTextRun {
  vectorTextRunText: string
  vectorTextRunFontFamilyName: PapelizPdfExportFontFamilyName
  vectorTextRunFontWeight: 400 | 500 | 600 | 700
  isVectorTextRunItalic: boolean
  vectorTextRunSize: number
  vectorTextRunColor: string
  vectorTextRunOpacity: number
  vectorTextRunTransform: PapelizPdfExportVectorTransform
  vectorTextRunLeft: number
  vectorTextRunBaseline: number
}

export interface PapelizPdfExportVectorDrawing {
  // In the drawing's own units (an icon's 24, a diagram's view box).
  vectorDrawingWidth: number
  vectorDrawingHeight: number
  vectorShapes: PapelizPdfExportVectorShape[]
  vectorTextRuns: PapelizPdfExportVectorTextRun[]
}

export const papelizPdfExportIdentityVectorTransform: PapelizPdfExportVectorTransform = [1, 0, 0, 1, 0, 0]

// SVG path data: commands and numbers only, so nothing else reaches pdfkit's path reader.
export const papelizPdfExportSvgPathDataPattern = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\seE+-]+$/
const papelizPdfExportVectorColorPattern = /^#[0-9a-f]{6}$/
// The most a drawing may hold, and the largest number any of its values may be.
export const papelizPdfExportVectorDrawingLimits = Object.freeze({
  maximumVectorShapeCount: 10_000,
  maximumVectorTextRunCount: 2_000,
  maximumPathDataLength: 200_000,
  maximumVectorTextRunLength: 1_000,
  largestVectorNumber: 1_000_000,
})

function formatPathNumber(pathNumber: number): string {
  return String(Math.round(pathNumber * 1_000) / 1_000)
}

function readShapeNumber(svgShapeAttributes: Readonly<Record<string, string>>, attributeName: string): number {
  const attributeValue = Number.parseFloat(svgShapeAttributes[attributeName] ?? '0')
  return Number.isFinite(attributeValue) ? attributeValue : 0
}

// An ellipse as two arcs, which pdfkit's path reader draws as curves.
function describeEllipsePathData(centerX: number, centerY: number, radiusX: number, radiusY: number): string | null {
  if (radiusX <= 0 || radiusY <= 0) return null
  const [left, right, middle, horizontalRadius, verticalRadius] = [centerX - radiusX, centerX + radiusX, centerY, radiusX, radiusY].map(formatPathNumber)
  return `M${left} ${middle}A${horizontalRadius} ${verticalRadius} 0 1 0 ${right} ${middle}A${horizontalRadius} ${verticalRadius} 0 1 0 ${left} ${middle}Z`
}

// SVG's own rounding: a rectangle's corner radii are each at most half its side.
export function describePapelizPdfExportRectanglePathData(rectangleLeft: number, rectangleTop: number, rectangleWidth: number, rectangleHeight: number, cornerRadiusX: number, cornerRadiusY: number): string | null {
  if (rectangleWidth <= 0 || rectangleHeight <= 0) return null
  const radiusX = Math.min(Math.max(0, cornerRadiusX), rectangleWidth / 2)
  const radiusY = Math.min(Math.max(0, cornerRadiusY), rectangleHeight / 2)
  const [x, y, width, height, rx, ry] = [rectangleLeft, rectangleTop, rectangleWidth, rectangleHeight, radiusX, radiusY]
  const n = formatPathNumber
  if (rx === 0 || ry === 0) return `M${n(x)} ${n(y)}H${n(x + width)}V${n(y + height)}H${n(x)}Z`
  return (
    `M${n(x + rx)} ${n(y)}H${n(x + width - rx)}A${n(rx)} ${n(ry)} 0 0 1 ${n(x + width)} ${n(y + ry)}V${n(y + height - ry)}` +
    `A${n(rx)} ${n(ry)} 0 0 1 ${n(x + width - rx)} ${n(y + height)}H${n(x + rx)}A${n(rx)} ${n(ry)} 0 0 1 ${n(x)} ${n(y + height - ry)}` +
    `V${n(y + ry)}A${n(rx)} ${n(ry)} 0 0 1 ${n(x + rx)} ${n(y)}Z`
  )
}

function describePointsPathData(pointsText: string, isClosed: boolean): string | null {
  const pointNumbers = pointsText
    .trim()
    .split(/[\s,]+/)
    .map((pointNumberText) => Number.parseFloat(pointNumberText))
  if (pointNumbers.length < 4 || pointNumbers.some((pointNumber) => !Number.isFinite(pointNumber))) return null
  const pathParts: string[] = []
  for (let pointIndex = 0; pointIndex + 1 < pointNumbers.length; pointIndex += 2) {
    pathParts.push(`${pointIndex === 0 ? 'M' : 'L'}${formatPathNumber(pointNumbers[pointIndex] ?? 0)} ${formatPathNumber(pointNumbers[pointIndex + 1] ?? 0)}`)
  }
  return `${pathParts.join('')}${isClosed ? 'Z' : ''}`
}

// One SVG shape element as path data, from its attributes; null for an element that isn't a shape
// or draws nothing.
export function convertPapelizPdfExportSvgShapeToPathData(svgShapeTagName: string, svgShapeAttributes: Readonly<Record<string, string>>): string | null {
  const shapeNumber = (attributeName: string) => readShapeNumber(svgShapeAttributes, attributeName)
  switch (svgShapeTagName) {
    case 'path': {
      const pathData = (svgShapeAttributes['d'] ?? '').trim()
      return pathData.length > 0 && papelizPdfExportSvgPathDataPattern.test(pathData) ? pathData : null
    }
    case 'circle':
      return describeEllipsePathData(shapeNumber('cx'), shapeNumber('cy'), shapeNumber('r'), shapeNumber('r'))
    case 'ellipse':
      return describeEllipsePathData(shapeNumber('cx'), shapeNumber('cy'), shapeNumber('rx'), shapeNumber('ry'))
    case 'rect': {
      const hasRadiusX = svgShapeAttributes['rx'] !== undefined
      const hasRadiusY = svgShapeAttributes['ry'] !== undefined
      const cornerRadiusX = hasRadiusX ? shapeNumber('rx') : shapeNumber('ry')
      const cornerRadiusY = hasRadiusY ? shapeNumber('ry') : cornerRadiusX
      return describePapelizPdfExportRectanglePathData(shapeNumber('x'), shapeNumber('y'), shapeNumber('width'), shapeNumber('height'), cornerRadiusX, cornerRadiusY)
    }
    case 'line':
      return `M${formatPathNumber(shapeNumber('x1'))} ${formatPathNumber(shapeNumber('y1'))}L${formatPathNumber(shapeNumber('x2'))} ${formatPathNumber(shapeNumber('y2'))}`
    case 'polyline':
      return describePointsPathData(svgShapeAttributes['points'] ?? '', false)
    case 'polygon':
      return describePointsPathData(svgShapeAttributes['points'] ?? '', true)
    default:
      return null
  }
}

export type PapelizPdfExportIconName = PapelizHtmlExportIconName

// A lucide icon, as MD View draws it: 24 units square, stroked 2 units wide in the given color with
// round ends and corners, and a filled shape where lucide fills one.
export function createPapelizPdfExportIconVectorDrawing(iconName: PapelizPdfExportIconName, iconColor: string): PapelizPdfExportVectorDrawing {
  const vectorShapes: PapelizPdfExportVectorShape[] = []
  for (const [svgShapeTagName, svgShapeAttributes] of papelizHtmlExportIconShapesByName[iconName]) {
    const vectorShapePathData = convertPapelizPdfExportSvgShapeToPathData(svgShapeTagName, svgShapeAttributes)
    if (vectorShapePathData === null) continue
    vectorShapes.push({
      vectorShapePathData,
      vectorShapeTransform: papelizPdfExportIdentityVectorTransform,
      vectorShapeFillColor: svgShapeAttributes['fill'] === 'currentColor' ? iconColor : null,
      vectorShapeFillOpacity: 1,
      vectorShapeFillRule: 'nonzero',
      vectorShapeStrokeColor: iconColor,
      vectorShapeStrokeOpacity: 1,
      vectorShapeStrokeWidth: 2,
      vectorShapeLineCap: 'round',
      vectorShapeLineJoin: 'round',
      vectorShapeMiterLimit: 4,
      vectorShapeDashArray: [],
      vectorShapeDashOffset: 0,
      vectorShapeFillGradient: null,
      vectorShapeStrokeGradient: null,
    })
  }
  return { vectorDrawingWidth: 24, vectorDrawingHeight: 24, vectorShapes, vectorTextRuns: [] }
}

// The icon MD View shows on a property chip (papeliz-note-frontmatter-property-chips.tsx).
export function getPapelizPdfExportPropertyIconName(notePropertyName: string): PapelizPdfExportIconName {
  const lowerCasePropertyName = notePropertyName.toLowerCase()
  if (lowerCasePropertyName === 'tags' || lowerCasePropertyName === 'tag') return 'Hash'
  if (lowerCasePropertyName === 'aliases' || lowerCasePropertyName === 'alias') return 'Link'
  if (/date|created|updated|modified|due/.test(lowerCasePropertyName)) return 'Calendar'
  return 'Tag'
}

// Why a drawing can't be drawn, or null when it can.
export function findPapelizPdfExportVectorDrawingProblem(vectorDrawing: PapelizPdfExportVectorDrawing): string | null {
  const limits = papelizPdfExportVectorDrawingLimits
  const isBoundedNumber = (vectorNumber: number) => Number.isFinite(vectorNumber) && Math.abs(vectorNumber) <= limits.largestVectorNumber
  const isOpacity = (opacity: number) => Number.isFinite(opacity) && opacity >= 0 && opacity <= 1
  const isColor = (vectorColor: string | null) => vectorColor === null || papelizPdfExportVectorColorPattern.test(vectorColor)
  if (!isBoundedNumber(vectorDrawing.vectorDrawingWidth) || !isBoundedNumber(vectorDrawing.vectorDrawingHeight) || vectorDrawing.vectorDrawingWidth <= 0 || vectorDrawing.vectorDrawingHeight <= 0) {
    return 'its size is out of bounds'
  }
  if (vectorDrawing.vectorShapes.length > limits.maximumVectorShapeCount) return 'it has too many shapes'
  if (vectorDrawing.vectorTextRuns.length > limits.maximumVectorTextRunCount) return 'it has too many labels'
  for (const vectorShape of vectorDrawing.vectorShapes) {
    if (vectorShape.vectorShapePathData.length > limits.maximumPathDataLength || !papelizPdfExportSvgPathDataPattern.test(vectorShape.vectorShapePathData)) return 'a shape isn’t plain path data'
    if (!/^[\s,]*[Mm]/.test(vectorShape.vectorShapePathData)) return 'a shape doesn’t start with a move'
    const pathNumbers = vectorShape.vectorShapePathData.match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? []
    if (!pathNumbers.every((pathNumber) => isBoundedNumber(Number(pathNumber)))) return 'a shape has a number out of bounds'
    if (!vectorShape.vectorShapeTransform.every(isBoundedNumber) || vectorShape.vectorShapeTransform.length !== 6) return 'a shape’s transform is out of bounds'
    if (!isColor(vectorShape.vectorShapeFillColor) || !isColor(vectorShape.vectorShapeStrokeColor)) return 'a shape’s color isn’t #rrggbb'
    if (!isOpacity(vectorShape.vectorShapeFillOpacity) || !isOpacity(vectorShape.vectorShapeStrokeOpacity)) return 'a shape’s opacity is out of bounds'
    if (!isBoundedNumber(vectorShape.vectorShapeStrokeWidth) || vectorShape.vectorShapeStrokeWidth < 0) return 'a shape’s line width is out of bounds'
    if (!isBoundedNumber(vectorShape.vectorShapeMiterLimit) || vectorShape.vectorShapeMiterLimit < 1) return 'a shape’s miter limit is out of bounds'
    if (vectorShape.vectorShapeDashArray.length > 1_024 || !vectorShape.vectorShapeDashArray.every((dashLength) => isBoundedNumber(dashLength) && dashLength > 0) || !isBoundedNumber(vectorShape.vectorShapeDashOffset)) {
      return 'a shape’s dashes are out of bounds'
    }
    for (const vectorGradient of [vectorShape.vectorShapeFillGradient, vectorShape.vectorShapeStrokeGradient]) {
      if (vectorGradient === null) continue
      const { gradientStops } = vectorGradient
      if (![vectorGradient.gradientStartX, vectorGradient.gradientStartY, vectorGradient.gradientEndX, vectorGradient.gradientEndY].every(isBoundedNumber)) return 'a gradient’s place is out of bounds'
      if (gradientStops.length < 1 || gradientStops.length > 16) return 'a gradient has no stops or too many'
      if (!gradientStops.every((gradientStop, stopIndex) => gradientStop.stopOffset >= (gradientStops[stopIndex - 1]?.stopOffset ?? 0) && gradientStop.stopOffset <= 1)) return 'a gradient’s stops are out of order'
      if (!gradientStops.every((gradientStop) => isColor(gradientStop.stopColor) && isOpacity(gradientStop.stopOpacity))) return 'a gradient’s colors are out of bounds'
    }
    if (!['nonzero', 'evenodd'].includes(vectorShape.vectorShapeFillRule) || !['butt', 'round', 'square'].includes(vectorShape.vectorShapeLineCap) || !['miter', 'round', 'bevel'].includes(vectorShape.vectorShapeLineJoin)) {
      return 'a shape’s paint is unknown'
    }
  }
  for (const vectorTextRun of vectorDrawing.vectorTextRuns) {
    if (vectorTextRun.vectorTextRunText.length === 0 || vectorTextRun.vectorTextRunText.length > limits.maximumVectorTextRunLength) return 'a label is empty or too long'
    if (![vectorTextRun.vectorTextRunSize, vectorTextRun.vectorTextRunLeft, vectorTextRun.vectorTextRunBaseline, ...vectorTextRun.vectorTextRunTransform].every(isBoundedNumber) || vectorTextRun.vectorTextRunSize <= 0) {
      return 'a label’s place is out of bounds'
    }
    if (!isColor(vectorTextRun.vectorTextRunColor) || !isOpacity(vectorTextRun.vectorTextRunOpacity)) return 'a label’s color is out of bounds'
    if (![400, 500, 600, 700].includes(vectorTextRun.vectorTextRunFontWeight)) return 'a label’s weight is unknown'
    if (!['figtree', 'charis-sil', 'jetbrains-mono'].includes(vectorTextRun.vectorTextRunFontFamilyName)) return 'a label’s typeface is unknown'
  }
  return null
}
