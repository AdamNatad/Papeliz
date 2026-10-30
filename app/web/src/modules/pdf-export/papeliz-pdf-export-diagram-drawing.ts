import { getPapelizExportPrintColor } from '../export-print-style/papeliz-export-print-style'
import { drawPapelizMermaidDiagramForPrint } from '../md-view/papeliz-md-view-mermaid-diagrams'
import type { PapelizNoteFontFamily } from '../workspace/papeliz-note-typography-store'
import { splitPapelizPdfExportTextByBundledFontFile, type PapelizPdfExportFontFamilyName, type PapelizPdfExportFontWeight } from './papeliz-pdf-export-fonts'
import {
  convertPapelizPdfExportSvgShapeToPathData,
  findPapelizPdfExportVectorDrawingProblem,
  papelizPdfExportIdentityVectorTransform,
  papelizPdfExportVectorDrawingLimits,
  type PapelizPdfExportVectorDrawing,
  type PapelizPdfExportVectorGradient,
  type PapelizPdfExportVectorShape,
  type PapelizPdfExportVectorTextRun,
  type PapelizPdfExportVectorTransform,
} from './papeliz-pdf-export-vector-drawing'

// A Mermaid diagram as a vector drawing for the PDF: MD View's print draw (light print colors, plain
// SVG labels in the note's typeface) is mounted out of sight, where the browser has laid it out, and
// walked element by element. Each shape becomes path data with its full transform to the drawing
// (`getCTM()`) and its paint from the computed style; each label a text run from its start point on
// the baseline, drawn by the worker in the embedded face; each arrowhead the marker's shapes at the
// line's end, turned to its direction. Mermaid's own drop shadow under a node is drawn as a copy of
// the shape, offset, in the shadow's color with a soft edge (a PDF can't blur), and a group's
// `brightness()` lightens its colors; a linear gradient (Mermaid's "neo" borders) is drawn as one.
// Anything the walk doesn't know (HTML labels, pictures, `use`, clipping, masks, other filters,
// radial gradients and patterns, a label in another typeface or with characters no bundled font has)
// leaves the diagram to its picture: a diagram is never half drawn. A Serif note's diagrams keep
// their pictures, since their labels are measured in Georgia, which the PDF doesn't embed.

export type PapelizPdfExportVectorDiagramDrawer = (mermaidDiagramSource: string, noteFontFamily: PapelizNoteFontFamily) => Promise<PapelizPdfExportVectorDrawing | null>

// The typefaces the print draw lays labels out in, which the PDF embeds.
const papelizPdfExportDiagramFontFamilies: Partial<Readonly<Record<PapelizNoteFontFamily, { printFontFamily: string; firstFontFamilyName: string; fontFamilyName: PapelizPdfExportFontFamilyName }>>> = {
  sans: { printFontFamily: "'Figtree', sans-serif", firstFontFamilyName: 'figtree', fontFamilyName: 'figtree' },
  mono: { printFontFamily: "'JetBrains Mono', monospace", firstFontFamilyName: 'jetbrains mono', fontFamilyName: 'jetbrains-mono' },
}

class PapelizUndrawableDiagramError extends Error {}

function failDiagramWalk(undrawnReason: string): never {
  throw new PapelizUndrawableDiagramError(undrawnReason)
}

// Elements that draw nothing themselves (their content is drawn where it is used, or never).
const papelizDiagramUndrawnTagNames: ReadonlySet<string> = new Set(['defs', 'marker', 'clippath', 'mask', 'pattern', 'lineargradient', 'radialgradient', 'symbol', 'style', 'title', 'desc', 'metadata'])
const papelizDiagramShapeTagNames: ReadonlySet<string> = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'])

function multiplyTransforms(firstTransform: PapelizPdfExportVectorTransform, secondTransform: PapelizPdfExportVectorTransform): PapelizPdfExportVectorTransform {
  const [a1, b1, c1, d1, e1, f1] = firstTransform
  const [a2, b2, c2, d2, e2, f2] = secondTransform
  return [a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2, b1 * c2 + d1 * d2, a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1]
}

function readMatrixTransform(domMatrix: DOMMatrix | SVGMatrix | null): PapelizPdfExportVectorTransform {
  if (domMatrix === null) failDiagramWalk('a shape has no transform')
  return [domMatrix.a, domMatrix.b, domMatrix.c, domMatrix.d, domMatrix.e, domMatrix.f]
}

// A local `transform` attribute, for marker content, which isn't laid out on the page.
function readLocalTransform(svgElement: Element): PapelizPdfExportVectorTransform {
  if (!(svgElement instanceof SVGGraphicsElement)) return papelizPdfExportIdentityVectorTransform
  const consolidatedTransform = svgElement.transform.baseVal.consolidate()
  return consolidatedTransform === null ? papelizPdfExportIdentityVectorTransform : readMatrixTransform(consolidatedTransform.matrix)
}

// "rgb(0, 100, 212)" -> #0064d4 and its alpha; "none" or transparent -> null. Gradients and patterns
// (`url(...)`) are left to the picture.
function readCssPaint(cssPaintValue: string): { paintColor: string; paintAlpha: number } | null {
  const trimmedPaintValue = cssPaintValue.trim()
  if (trimmedPaintValue === 'none' || trimmedPaintValue === 'transparent' || trimmedPaintValue === '') return null
  const colorMatch = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(trimmedPaintValue)
  if (colorMatch === null) failDiagramWalk(`a paint isn’t a plain color (${trimmedPaintValue.slice(0, 40)})`)
  const [red, green, blue] = [colorMatch[1], colorMatch[2], colorMatch[3]].map((colorChannelText) => Math.min(255, Math.max(0, Math.round(Number(colorChannelText)))))
  const alphaText = colorMatch[4]
  const paintAlpha = alphaText === undefined ? 1 : alphaText.endsWith('%') ? Number.parseFloat(alphaText) / 100 : Number(alphaText)
  if (paintAlpha <= 0) return null
  return { paintColor: `#${[red, green, blue].map((colorChannel) => (colorChannel ?? 0).toString(16).padStart(2, '0')).join('')}`, paintAlpha: Math.min(1, paintAlpha) }
}

function readCssLength(cssLengthValue: string, lengthName: string): number {
  if (/%|em|vw|vh/.test(cssLengthValue)) failDiagramWalk(`a ${lengthName} isn’t in pixels`)
  const lengthNumber = Number.parseFloat(cssLengthValue)
  return Number.isFinite(lengthNumber) ? lengthNumber : 0
}

function readCssNumber(cssNumberValue: string, defaultNumber: number): number {
  const parsedNumber = Number.parseFloat(cssNumberValue)
  return Number.isFinite(parsedNumber) ? parsedNumber : defaultNumber
}

function readShapeAttributes(svgShapeElement: Element): Record<string, string> {
  return Object.fromEntries(Array.from(svgShapeElement.attributes, (shapeAttribute) => [shapeAttribute.name, shapeAttribute.value]))
}

// A color in any CSS form ("hsl(217.5, 0%, 82.5%)", "#FFFFFF") as #rrggbb and its alpha, through the
// page's own color parser.
let papelizDiagramColorCanvasContext: CanvasRenderingContext2D | null = null

function readAnyCssColor(cssColorText: string): { paintColor: string; paintAlpha: number } | null {
  papelizDiagramColorCanvasContext ??= document.createElement('canvas').getContext('2d')
  if (papelizDiagramColorCanvasContext === null) failDiagramWalk('colors can’t be read here')
  papelizDiagramColorCanvasContext.fillStyle = '#000000'
  papelizDiagramColorCanvasContext.fillStyle = cssColorText
  const normalizedColor = String(papelizDiagramColorCanvasContext.fillStyle)
  if (/^#[0-9a-f]{6}$/i.test(normalizedColor)) return { paintColor: normalizedColor.toLowerCase(), paintAlpha: 1 }
  return readCssPaint(normalizedColor)
}

// "50%" -> 0.5, "0.25" -> 0.25.
function readGradientFraction(fractionText: string | null, defaultFraction: number): number {
  if (fractionText === null || fractionText.trim() === '') return defaultFraction
  const fractionNumber = Number.parseFloat(fractionText)
  if (!Number.isFinite(fractionNumber)) return defaultFraction
  return fractionText.trim().endsWith('%') ? fractionNumber / 100 : fractionNumber
}

// A `linearGradient` a shape is painted with, in the shape's own units: across its box
// (`objectBoundingBox`, the default) or in user space. Its stops come from it or the one it links to.
function readLinearGradient(gradientId: string, paintedElement: SVGGraphicsElement, paintOpacity: number, diagramWalk: PapelizDiagramWalk): PapelizPdfExportVectorGradient {
  const gradientElement = diagramWalk.diagramSvg.querySelector(`#${CSS.escape(gradientId)}`)
  if (!(gradientElement instanceof SVGLinearGradientElement)) failDiagramWalk('a paint is a radial gradient or a pattern')
  if ((gradientElement.getAttribute('gradientTransform') ?? '').trim() !== '' || !['', 'pad'].includes((gradientElement.getAttribute('spreadMethod') ?? '').trim())) failDiagramWalk('a gradient is turned or repeats')
  const linkedGradientId = /^#(.+)$/.exec(gradientElement.getAttribute('href') ?? gradientElement.getAttribute('xlink:href') ?? '')?.[1]
  const linkedGradientElement = linkedGradientId === undefined ? null : diagramWalk.diagramSvg.querySelector(`#${CSS.escape(linkedGradientId)}`)
  const ownStopElements = Array.from(gradientElement.querySelectorAll('stop'))
  const stopElements = ownStopElements.length > 0 || linkedGradientElement === null ? ownStopElements : Array.from(linkedGradientElement.querySelectorAll('stop'))
  if (stopElements.length === 0) failDiagramWalk('a gradient has no stops')
  let lastStopOffset = 0
  const gradientStops = stopElements.slice(0, 16).map((stopElement) => {
    const stopStyle = getComputedStyle(stopElement)
    const stopPaint = readAnyCssColor(stopStyle.stopColor || (stopElement.getAttribute('stop-color') ?? '#000000'))
    lastStopOffset = Math.min(1, Math.max(lastStopOffset, readGradientFraction(stopElement.getAttribute('offset'), 0)))
    return {
      stopOffset: lastStopOffset,
      stopColor: stopPaint?.paintColor ?? '#000000',
      stopOpacity: Math.min(1, (stopPaint?.paintAlpha ?? 0) * readCssNumber(stopStyle.stopOpacity, 1) * paintOpacity),
    }
  })
  const isUserSpace = (gradientElement.getAttribute('gradientUnits') ?? 'objectBoundingBox') === 'userSpaceOnUse'
  const startX = readGradientFraction(gradientElement.getAttribute('x1'), 0)
  const startY = readGradientFraction(gradientElement.getAttribute('y1'), 0)
  const endX = readGradientFraction(gradientElement.getAttribute('x2'), 1)
  const endY = readGradientFraction(gradientElement.getAttribute('y2'), 0)
  if (isUserSpace) {
    if (['x1', 'y1', 'x2', 'y2'].some((coordinateName) => (gradientElement.getAttribute(coordinateName) ?? '').includes('%'))) failDiagramWalk('a gradient is placed in percent of the page')
    return { gradientStartX: startX, gradientStartY: startY, gradientEndX: endX, gradientEndY: endY, gradientStops }
  }
  const paintedBox = paintedElement.getBBox()
  return {
    gradientStartX: paintedBox.x + startX * paintedBox.width,
    gradientStartY: paintedBox.y + startY * paintedBox.height,
    gradientEndX: paintedBox.x + endX * paintedBox.width,
    gradientEndY: paintedBox.y + endY * paintedBox.height,
    gradientStops,
  }
}

// What a group's CSS filter does to everything in it: a drop shadow, and a brightness factor.
interface PapelizDiagramFilterEffects {
  dropShadow: { shadowColor: string; shadowAlpha: number; shadowOffsetX: number; shadowOffsetY: number; shadowBlur: number } | null
  colorBrightness: number
}

const papelizDiagramNoFilterEffects: PapelizDiagramFilterEffects = { dropShadow: null, colorBrightness: 1 }

// "drop-shadow(rgb(185, 185, 185) 1px 2px 2px)" and "brightness(1.2)", alone or together, on top of
// what the element's groups already do; anything else is left to the picture.
function readFilterEffects(cssFilterValue: string, inheritedEffects: PapelizDiagramFilterEffects, elementTagName: string, diagramSvg: SVGSVGElement): PapelizDiagramFilterEffects {
  if (cssFilterValue === 'none') return inheritedEffects
  // An SVG `<filter>` holding one `feDropShadow` is the same drop shadow.
  const filterReferenceMatch = /^url\(\s*["']?#([^"')]+)["']?\s*\)$/.exec(cssFilterValue.trim())
  if (filterReferenceMatch !== null) {
    const filterElement = diagramSvg.querySelector(`#${CSS.escape(filterReferenceMatch[1] ?? '')}`)
    const filterPrimitives = filterElement === null ? [] : Array.from(filterElement.children)
    const dropShadowPrimitive = filterPrimitives[0]
    if (filterPrimitives.length !== 1 || dropShadowPrimitive?.localName !== 'feDropShadow') failDiagramWalk(`a ${elementTagName} is filtered by an SVG filter`)
    const shadowPaint = readAnyCssColor(dropShadowPrimitive.getAttribute('flood-color') ?? '#000000')
    const shadowAlpha = (shadowPaint?.paintAlpha ?? 0) * readGradientFraction(dropShadowPrimitive.getAttribute('flood-opacity'), 1)
    return {
      ...inheritedEffects,
      dropShadow:
        shadowPaint === null || shadowAlpha <= 0
          ? null
          : {
              shadowColor: shadowPaint.paintColor,
              shadowAlpha,
              shadowOffsetX: readCssNumber(dropShadowPrimitive.getAttribute('dx') ?? '2', 2),
              shadowOffsetY: readCssNumber(dropShadowPrimitive.getAttribute('dy') ?? '2', 2),
              shadowBlur: 2 * readCssNumber(dropShadowPrimitive.getAttribute('stdDeviation') ?? '2', 2),
            },
    }
  }
  let remainingFilterText = cssFilterValue.trim()
  const filterEffects: PapelizDiagramFilterEffects = { ...inheritedEffects }
  while (remainingFilterText.length > 0) {
    const dropShadowMatch = /^drop-shadow\(\s*(rgba?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+([\d.]+)px)?\s*\)\s*/.exec(remainingFilterText)
    const brightnessMatch = /^brightness\(\s*([\d.]+)(%?)\s*\)\s*/.exec(remainingFilterText)
    if (dropShadowMatch !== null) {
      const shadowPaint = readCssPaint(dropShadowMatch[1] ?? '')
      filterEffects.dropShadow =
        shadowPaint === null
          ? null
          : {
              shadowColor: shadowPaint.paintColor,
              shadowAlpha: shadowPaint.paintAlpha,
              shadowOffsetX: Number(dropShadowMatch[2]),
              shadowOffsetY: Number(dropShadowMatch[3]),
              shadowBlur: Number(dropShadowMatch[4] ?? 0),
            }
      remainingFilterText = remainingFilterText.slice(dropShadowMatch[0].length)
    } else if (brightnessMatch !== null) {
      const brightnessNumber = Number(brightnessMatch[1])
      filterEffects.colorBrightness *= brightnessMatch[2] === '%' ? brightnessNumber / 100 : brightnessNumber
      remainingFilterText = remainingFilterText.slice(brightnessMatch[0].length)
    } else {
      failDiagramWalk(`a ${elementTagName} is filtered (${cssFilterValue.slice(0, 80)})`)
    }
  }
  return filterEffects
}

// A color made brighter by a factor, as CSS's brightness() does.
function brightenColor(paintColor: string, colorBrightness: number): string {
  if (colorBrightness === 1) return paintColor
  const colorChannels = [1, 3, 5].map((channelOffset) => Math.min(255, Math.round(Number.parseInt(paintColor.slice(channelOffset, channelOffset + 2), 16) * colorBrightness)))
  return `#${colorChannels.map((colorChannel) => colorChannel.toString(16).padStart(2, '0')).join('')}`
}

interface PapelizDiagramWalk {
  diagramSvg: SVGSVGElement
  diagramFontFamily: { firstFontFamilyName: string; fontFamilyName: PapelizPdfExportFontFamilyName }
  vectorShapes: PapelizPdfExportVectorShape[]
  vectorTextRuns: PapelizPdfExportVectorTextRun[]
}

// A dash list as it draws: an odd list doubled (SVG's rule), dash-and-gap pairs of nothing dropped,
// and a list that repeats itself cut to its shortest period. Mermaid fits dashes to each line this way
// ("0px, 0px, 42px, 4px" stops a line short of its arrowhead; a dotted line is a run of "2px, 2px"
// as long as the line, ending in a wider gap), so a list that doesn't repeat is kept whole.
function simplifyDashLengths(dashLengths: readonly number[]): number[] {
  const evenDashLengths = dashLengths.length % 2 === 1 ? [...dashLengths, ...dashLengths] : [...dashLengths]
  const keptDashLengths: number[] = []
  for (let dashIndex = 0; dashIndex + 1 < evenDashLengths.length; dashIndex += 2) {
    const [dashLength = 0, gapLength = 0] = [evenDashLengths[dashIndex], evenDashLengths[dashIndex + 1]]
    if (dashLength > 0 || gapLength > 0) keptDashLengths.push(dashLength, gapLength)
  }
  for (let periodLength = 2; periodLength < keptDashLengths.length; periodLength += 2) {
    if (keptDashLengths.length % periodLength !== 0) continue
    if (keptDashLengths.every((dashLength, dashIndex) => Math.abs(dashLength - (keptDashLengths[dashIndex % periodLength] ?? 0)) < 0.01)) return keptDashLengths.slice(0, periodLength)
  }
  if (keptDashLengths.length > 1_024) failDiagramWalk('a line has too many dashes')
  return keptDashLengths
}

// A shape's path data and paint, or null when it paints nothing.
function createVectorShape(
  svgShapeElement: Element,
  shapeStyle: CSSStyleDeclaration,
  groupOpacity: number,
  shapeTransform: PapelizPdfExportVectorTransform,
  diagramWalk: PapelizDiagramWalk,
  colorBrightness = 1,
): PapelizPdfExportVectorShape | null {
  if (shapeStyle.getPropertyValue('vector-effect') === 'non-scaling-stroke') failDiagramWalk('a line keeps its width when scaled')
  const vectorShapePathData = convertPapelizPdfExportSvgShapeToPathData(svgShapeElement.localName, readShapeAttributes(svgShapeElement))
  if (vectorShapePathData === null) return null
  const isLineShape = svgShapeElement.localName === 'line' || svgShapeElement.localName === 'polyline'
  // A paint is a color, nothing, or a linear gradient (drawn with its first stop's color as its color).
  const readShapePaint = (cssPaintValue: string, paintOpacity: number): { paintColor: string; paintAlpha: number; paintGradient: PapelizPdfExportVectorGradient | null } | null => {
    const gradientId = /^url\(\s*["']?#([^"')]+)["']?\s*\)/.exec(cssPaintValue.trim())?.[1]
    if (gradientId === undefined) {
      const plainPaint = readCssPaint(cssPaintValue)
      return plainPaint === null ? null : { ...plainPaint, paintGradient: null }
    }
    if (!(svgShapeElement instanceof SVGGraphicsElement)) failDiagramWalk('a gradient paints something without a box')
    const paintGradient = readLinearGradient(gradientId, svgShapeElement, paintOpacity, diagramWalk)
    const brightenedGradient = { ...paintGradient, gradientStops: paintGradient.gradientStops.map((gradientStop) => ({ ...gradientStop, stopColor: brightenColor(gradientStop.stopColor, colorBrightness) })) }
    return { paintColor: brightenedGradient.gradientStops[0]?.stopColor ?? '#000000', paintAlpha: 1, paintGradient: brightenedGradient }
  }
  const fillPaint = isLineShape ? null : readShapePaint(shapeStyle.fill, 1)
  const strokePaint = readShapePaint(shapeStyle.stroke, 1)
  const strokeWidth = strokePaint === null ? 0 : readCssLength(shapeStyle.strokeWidth, 'line width')
  if (fillPaint === null && (strokePaint === null || strokeWidth <= 0)) return null
  const dashLengths = simplifyDashLengths(shapeStyle.strokeDasharray === 'none' ? [] : shapeStyle.strokeDasharray.split(/[\s,]+/).filter(Boolean).map((dashLengthText) => readCssLength(dashLengthText, 'dash')))
  const lineCap = shapeStyle.strokeLinecap
  const lineJoin = shapeStyle.strokeLinejoin
  return {
    vectorShapePathData,
    vectorShapeTransform: shapeTransform,
    vectorShapeFillColor: fillPaint === null ? null : brightenColor(fillPaint.paintColor, colorBrightness),
    vectorShapeFillGradient: fillPaint?.paintGradient ?? null,
    vectorShapeStrokeGradient: strokePaint === null || strokeWidth <= 0 ? null : strokePaint.paintGradient,
    vectorShapeFillOpacity: Math.min(1, (fillPaint?.paintAlpha ?? 1) * readCssNumber(shapeStyle.fillOpacity, 1) * groupOpacity),
    vectorShapeFillRule: shapeStyle.fillRule === 'evenodd' ? 'evenodd' : 'nonzero',
    vectorShapeStrokeColor: strokePaint === null || strokeWidth <= 0 ? null : brightenColor(strokePaint.paintColor, colorBrightness),
    vectorShapeStrokeOpacity: Math.min(1, (strokePaint?.paintAlpha ?? 1) * readCssNumber(shapeStyle.strokeOpacity, 1) * groupOpacity),
    vectorShapeStrokeWidth: strokeWidth,
    vectorShapeLineCap: lineCap === 'round' || lineCap === 'square' ? lineCap : 'butt',
    vectorShapeLineJoin: lineJoin === 'round' || lineJoin === 'bevel' ? lineJoin : 'miter',
    vectorShapeMiterLimit: Math.max(1, readCssNumber(shapeStyle.strokeMiterlimit, 4)),
    // A dash list of zeros, or of nothing but gaps, is a solid line.
    vectorShapeDashArray: dashLengths.some((dashLength) => dashLength > 0) && dashLengths.every((dashLength) => dashLength >= 0) ? dashLengths.map((dashLength) => Math.max(dashLength, 0.001)) : [],
    vectorShapeDashOffset: readCssLength(shapeStyle.strokeDashoffset, 'dash offset'),
  }
}

// A drop shadow under a shape: the shape again, offset, in the shadow's color, filled where the shape
// is filled and a little wider for the blur, softer at its edge.
function createShadowShapes(vectorShape: PapelizPdfExportVectorShape, filterEffects: PapelizDiagramFilterEffects, groupOpacity: number): PapelizPdfExportVectorShape[] {
  const { dropShadow } = filterEffects
  if (dropShadow === null) return []
  const shadowTransform = multiplyTransforms(vectorShape.vectorShapeTransform, [1, 0, 0, 1, dropShadow.shadowOffsetX, dropShadow.shadowOffsetY])
  const shadowEdgeWidth = vectorShape.vectorShapeStrokeWidth + dropShadow.shadowBlur
  const shadowShape: PapelizPdfExportVectorShape = {
    ...vectorShape,
    vectorShapeTransform: shadowTransform,
    vectorShapeFillColor: vectorShape.vectorShapeFillColor === null ? null : dropShadow.shadowColor,
    vectorShapeFillGradient: null,
    vectorShapeStrokeGradient: null,
    vectorShapeFillOpacity: Math.min(1, dropShadow.shadowAlpha * 0.55 * groupOpacity),
    vectorShapeStrokeColor: shadowEdgeWidth > 0 ? dropShadow.shadowColor : null,
    vectorShapeStrokeOpacity: Math.min(1, dropShadow.shadowAlpha * 0.3 * groupOpacity),
    vectorShapeStrokeWidth: shadowEdgeWidth,
    vectorShapeLineJoin: 'round',
    vectorShapeLineCap: 'round',
    vectorShapeDashArray: [],
  }
  return [shadowShape]
}

// The marker's shapes at one end of a line: placed on the end, turned to the line's direction there
// (`orient="auto"`), scaled by the line's width (`markerUnits="strokeWidth"`) and the marker's
// `viewBox` into `markerWidth` × `markerHeight`, its `refX`, `refY` on the end.
function addMarkerShapes(
  markerElement: SVGMarkerElement,
  markerPlacement: { lineTransform: PapelizPdfExportVectorTransform; vertexX: number; vertexY: number; directionDegrees: number; isLineStart: boolean; lineStrokeWidth: number },
  diagramWalk: PapelizDiagramWalk,
): void {
  const orientValue = (markerElement.getAttribute('orient') ?? '0').trim()
  const markerAngleDegrees =
    orientValue === 'auto' ? markerPlacement.directionDegrees : orientValue === 'auto-start-reverse' ? markerPlacement.directionDegrees + (markerPlacement.isLineStart ? 180 : 0) : readCssNumber(orientValue, 0)
  const unitScale = (markerElement.getAttribute('markerUnits') ?? 'strokeWidth') === 'userSpaceOnUse' ? 1 : markerPlacement.lineStrokeWidth
  const markerWidth = readCssNumber(markerElement.getAttribute('markerWidth') ?? '3', 3)
  const markerHeight = readCssNumber(markerElement.getAttribute('markerHeight') ?? '3', 3)
  const viewBoxNumbers = (markerElement.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).filter(Boolean).map(Number)
  let [viewBoxScaleX, viewBoxScaleY] = [1, 1]
  if (viewBoxNumbers.length === 4) {
    const [, , viewBoxWidth = 0, viewBoxHeight = 0] = viewBoxNumbers
    if (!(viewBoxWidth > 0 && viewBoxHeight > 0)) return
    viewBoxScaleX = markerWidth / viewBoxWidth
    viewBoxScaleY = markerHeight / viewBoxHeight
    if ((markerElement.getAttribute('preserveAspectRatio') ?? '').trim() !== 'none') viewBoxScaleX = viewBoxScaleY = Math.min(viewBoxScaleX, viewBoxScaleY)
  }
  const angleRadians = (markerAngleDegrees * Math.PI) / 180
  const markerTransform = [
    markerPlacement.lineTransform,
    [1, 0, 0, 1, markerPlacement.vertexX, markerPlacement.vertexY] as const,
    [Math.cos(angleRadians), Math.sin(angleRadians), -Math.sin(angleRadians), Math.cos(angleRadians), 0, 0] as const,
    [unitScale * viewBoxScaleX, 0, 0, unitScale * viewBoxScaleY, 0, 0] as const,
    [1, 0, 0, 1, -readCssNumber(markerElement.getAttribute('refX') ?? '0', 0), -readCssNumber(markerElement.getAttribute('refY') ?? '0', 0)] as const,
  ].reduce<PapelizPdfExportVectorTransform>((combinedTransform, nextTransform) => multiplyTransforms(combinedTransform, nextTransform), papelizPdfExportIdentityVectorTransform)
  const walkMarkerContent = (markerContentElement: Element, parentTransform: PapelizPdfExportVectorTransform, parentOpacity: number) => {
    for (const markerChildElement of Array.from(markerContentElement.children)) {
      const childTagName = markerChildElement.localName.toLowerCase()
      if (papelizDiagramUndrawnTagNames.has(childTagName)) continue
      const childStyle = getComputedStyle(markerChildElement)
      if (childStyle.display === 'none') continue
      const childTransform = multiplyTransforms(parentTransform, readLocalTransform(markerChildElement))
      const childOpacity = parentOpacity * readCssNumber(childStyle.opacity, 1)
      if (childTagName === 'g') walkMarkerContent(markerChildElement, childTransform, childOpacity)
      else if (papelizDiagramShapeTagNames.has(childTagName)) {
        const markerShape = createVectorShape(markerChildElement, childStyle, childOpacity, childTransform, diagramWalk)
        if (markerShape !== null) diagramWalk.vectorShapes.push(markerShape)
      } else failDiagramWalk(`an arrowhead holds a ${childTagName}`)
    }
  }
  walkMarkerContent(markerElement, markerTransform, 1)
}

function addShapeMarkers(svgShapeElement: SVGGeometryElement, shapeStyle: CSSStyleDeclaration, lineTransform: PapelizPdfExportVectorTransform, diagramWalk: PapelizDiagramWalk): void {
  const markerReferences = { start: shapeStyle.getPropertyValue('marker-start'), mid: shapeStyle.getPropertyValue('marker-mid'), end: shapeStyle.getPropertyValue('marker-end') }
  if (markerReferences.mid !== '' && markerReferences.mid !== 'none') failDiagramWalk('a line has markers along it')
  const lineLength = svgShapeElement.getTotalLength()
  const stepLength = Math.min(0.5, lineLength / 2)
  for (const isLineStart of [true, false]) {
    const markerReference = isLineStart ? markerReferences.start : markerReferences.end
    if (markerReference === '' || markerReference === 'none') continue
    const markerId = /url\(\s*["']?#([^"')]+)["']?\s*\)/.exec(markerReference)?.[1]
    const markerElement = markerId === undefined ? null : diagramWalk.diagramSvg.querySelector(`#${CSS.escape(markerId)}`)
    if (!(markerElement instanceof SVGMarkerElement)) failDiagramWalk('an arrowhead can’t be found')
    const vertexPoint = svgShapeElement.getPointAtLength(isLineStart ? 0 : lineLength)
    const [fromPoint, toPoint] = isLineStart
      ? [vertexPoint, svgShapeElement.getPointAtLength(stepLength)]
      : [svgShapeElement.getPointAtLength(Math.max(0, lineLength - stepLength)), vertexPoint]
    const directionDegrees = lineLength > 0 ? (Math.atan2(toPoint.y - fromPoint.y, toPoint.x - fromPoint.x) * 180) / Math.PI : 0
    addMarkerShapes(
      markerElement,
      { lineTransform, vertexX: vertexPoint.x, vertexY: vertexPoint.y, directionDegrees, isLineStart, lineStrokeWidth: readCssLength(shapeStyle.strokeWidth, 'line width') },
      diagramWalk,
    )
  }
}

// MD View's weights for a label's computed weight: 400, 500, 600 or 700.
function readLabelFontWeight(cssFontWeight: string): PapelizPdfExportFontWeight {
  const numericWeight = cssFontWeight === 'bold' ? 700 : cssFontWeight === 'normal' ? 400 : readCssNumber(cssFontWeight, 400)
  return numericWeight >= 650 ? 700 : numericWeight >= 550 ? 600 : numericWeight >= 450 ? 500 : 400
}

// The parts of a label that hold its text: the `text` itself, or each innermost `tspan` (Mermaid
// writes a `tspan` per line holding a `tspan` per word).
function collectLabelElements(labelPartElement: SVGTextContentElement, labelElements: SVGTextContentElement[]): void {
  const partChildElements = Array.from(labelPartElement.children).filter((partChildElement) => !['title', 'desc'].includes(partChildElement.localName.toLowerCase()))
  if (partChildElements.length === 0) {
    labelElements.push(labelPartElement)
    return
  }
  if (Array.from(labelPartElement.childNodes).some((childNode) => childNode.nodeType === Node.TEXT_NODE && (childNode.textContent ?? '').trim().length > 0)) failDiagramWalk('a label mixes text and parts')
  for (const partChildElement of partChildElements) {
    if (!(partChildElement instanceof SVGTSpanElement)) failDiagramWalk(`a label holds a ${partChildElement.localName}`)
    collectLabelElements(partChildElement, labelElements)
  }
}

// A label (`text`, or each `tspan` in it): its string, its start on the baseline, its face and color.
function addTextRuns(textElement: SVGTextElement, groupOpacity: number, colorBrightness: number, diagramWalk: PapelizDiagramWalk): void {
  const labelElements: SVGTextContentElement[] = []
  collectLabelElements(textElement, labelElements)
  const textTransform = readMatrixTransform(textElement.getCTM())
  for (const labelElement of labelElements) {
    const characterCount = labelElement.getNumberOfChars()
    if (characterCount === 0) continue
    const labelStyle = getComputedStyle(labelElement)
    if (labelStyle.display === 'none' || labelStyle.visibility === 'hidden') continue
    for (const positionAttributeName of ['x', 'y', 'dx', 'dy']) {
      if ((labelElement.getAttribute(positionAttributeName) ?? '').trim().split(/[\s,]+/).length > 1) failDiagramWalk('a label places its letters one by one')
    }
    if (labelElement.hasAttribute('rotate') || labelElement.hasAttribute('textLength')) failDiagramWalk('a label turns or stretches its letters')
    if (!labelStyle.writingMode.startsWith('horizontal') && labelStyle.writingMode !== 'lr' && labelStyle.writingMode !== 'lr-tb') failDiagramWalk('a label runs vertically')
    if (labelStyle.letterSpacing !== 'normal' && readCssNumber(labelStyle.letterSpacing, 0) !== 0) failDiagramWalk('a label spaces its letters')
    if (readCssPaint(labelStyle.stroke) !== null) failDiagramWalk('a label is outlined')
    const firstFontFamilyName = (labelStyle.fontFamily.split(',')[0] ?? '').trim().replace(/^["']|["']$/g, '').toLowerCase()
    if (firstFontFamilyName !== diagramWalk.diagramFontFamily.firstFontFamilyName) failDiagramWalk(`a label is in ${firstFontFamilyName}`)
    const fillPaint = readCssPaint(labelStyle.fill)
    if (fillPaint === null) continue
    // The browser's own count of what it lays out: the text without the spaces it collapses.
    const collapsedText = (labelElement.textContent ?? '').replace(/[\n\r\t]/g, ' ').replace(/ {2,}/g, ' ')
    const labelText = collapsedText.length === characterCount ? collapsedText : collapsedText.trim().length === characterCount ? collapsedText.trim() : null
    if (labelText === null) failDiagramWalk('a label’s spaces can’t be matched')
    if (labelText.trim().length === 0) continue
    const fontWeight = readLabelFontWeight(labelStyle.fontWeight)
    const isFontItalic = labelStyle.fontStyle === 'italic' || labelStyle.fontStyle.startsWith('oblique')
    const labelFontStyle = { fontFamilyName: diagramWalk.diagramFontFamily.fontFamilyName, fontWeight, isFontItalic }
    if (splitPapelizPdfExportTextByBundledFontFile(labelText, labelFontStyle).some((bundledFontSegment) => bundledFontSegment.fontFaceKey === null)) failDiagramWalk('a label has characters no bundled font has')
    const labelStartPoint = labelElement.getStartPositionOfChar(0)
    diagramWalk.vectorTextRuns.push({
      vectorTextRunText: labelText,
      vectorTextRunFontFamilyName: diagramWalk.diagramFontFamily.fontFamilyName,
      vectorTextRunFontWeight: fontWeight,
      isVectorTextRunItalic: isFontItalic,
      vectorTextRunSize: readCssLength(labelStyle.fontSize, 'text size'),
      vectorTextRunColor: brightenColor(fillPaint.paintColor, colorBrightness),
      vectorTextRunOpacity: Math.min(1, fillPaint.paintAlpha * readCssNumber(labelStyle.fillOpacity, 1) * groupOpacity),
      vectorTextRunTransform: textTransform,
      vectorTextRunLeft: labelStartPoint.x,
      vectorTextRunBaseline: labelStartPoint.y,
    })
  }
}

function walkDiagramElement(diagramElement: Element, parentOpacity: number, parentEffects: PapelizDiagramFilterEffects, diagramWalk: PapelizDiagramWalk): void {
  for (const childElement of Array.from(diagramElement.children)) {
    const childTagName = childElement.localName.toLowerCase()
    if (papelizDiagramUndrawnTagNames.has(childTagName)) continue
    const childStyle = getComputedStyle(childElement)
    if (childStyle.display === 'none') continue
    if (childStyle.clipPath !== 'none' || childStyle.mask !== 'none') failDiagramWalk(`a ${childTagName} is clipped or masked`)
    const childEffects = readFilterEffects(childStyle.filter, parentEffects, childTagName, diagramWalk.diagramSvg)
    const childOpacity = parentOpacity * readCssNumber(childStyle.opacity, 1)
    if (childOpacity <= 0) continue
    if (childTagName === 'g' || childTagName === 'a') {
      walkDiagramElement(childElement, childOpacity, childEffects, diagramWalk)
      continue
    }
    if (childTagName === 'text' && childElement instanceof SVGTextElement) {
      addTextRuns(childElement, childOpacity, childEffects.colorBrightness, diagramWalk)
      continue
    }
    if (!papelizDiagramShapeTagNames.has(childTagName) || !(childElement instanceof SVGGeometryElement)) failDiagramWalk(`the diagram holds a ${childTagName}`)
    if (childStyle.visibility === 'hidden') continue
    const shapeTransform = readMatrixTransform(childElement.getCTM())
    const vectorShape = createVectorShape(childElement, childStyle, childOpacity, shapeTransform, diagramWalk, childEffects.colorBrightness)
    if (vectorShape !== null) diagramWalk.vectorShapes.push(...createShadowShapes(vectorShape, childEffects, childOpacity), vectorShape)
    addShapeMarkers(childElement, childStyle, shapeTransform, diagramWalk)
    if (diagramWalk.vectorShapes.length > papelizPdfExportVectorDrawingLimits.maximumVectorShapeCount) failDiagramWalk('the diagram has too many shapes')
  }
}

// The vector drawing of a diagram, or null when it keeps its picture. `undrawnReasons` collects why.
export async function drawPapelizPdfExportVectorDiagramOnPage(mermaidDiagramSource: string, noteFontFamily: PapelizNoteFontFamily, undrawnReasons: string[] = []): Promise<PapelizPdfExportVectorDrawing | null> {
  const diagramFontFamily = papelizPdfExportDiagramFontFamilies[noteFontFamily]
  if (diagramFontFamily === undefined || typeof document === 'undefined') {
    undrawnReasons.push('its labels aren’t in a face the PDF embeds')
    return null
  }
  const printDrawing = await drawPapelizMermaidDiagramForPrint(mermaidDiagramSource, { readPrintColor: getPapelizExportPrintColor, printFontFamily: diagramFontFamily.printFontFamily })
  if (!('mermaidDiagramSvgText' in printDrawing)) {
    undrawnReasons.push(printDrawing.mermaidDiagramErrorMessage)
    return null
  }
  // Read first in an inert template, where nothing loads or runs. A drawing with HTML, pictures or
  // reused parts keeps its picture without ever being mounted; the rest loses any event handler and
  // `javascript:` link before it goes on the page.
  const diagramTemplate = document.createElement('template')
  diagramTemplate.innerHTML = printDrawing.mermaidDiagramSvgText
  const diagramSvg = diagramTemplate.content.querySelector('svg')
  if (diagramSvg === null || diagramSvg.querySelector('svg, foreignObject, image, use, switch, script, iframe, object, embed') !== null) {
    undrawnReasons.push(diagramSvg === null ? 'the drawing has no SVG' : 'the diagram holds HTML, pictures or reused parts')
    return null
  }
  for (const diagramPartElement of [diagramSvg, ...Array.from(diagramSvg.querySelectorAll('*'))]) {
    for (const partAttribute of Array.from(diagramPartElement.attributes)) {
      const isEventHandler = partAttribute.name.toLowerCase().startsWith('on')
      const isScriptLink = /href$/i.test(partAttribute.name) && /^\s*javascript:/i.test(partAttribute.value)
      if (isEventHandler || isScriptLink) diagramPartElement.removeAttribute(partAttribute.name)
    }
  }
  diagramSvg.setAttribute('width', String(printDrawing.mermaidDiagramPixelWidth))
  diagramSvg.setAttribute('height', String(printDrawing.mermaidDiagramPixelHeight))
  diagramSvg.removeAttribute('style')
  diagramSvg.setAttribute('font-family', diagramFontFamily.printFontFamily)
  // Out of sight but laid out, one CSS pixel to one drawing unit.
  const mountElement = document.createElement('div')
  mountElement.setAttribute('aria-hidden', 'true')
  mountElement.style.cssText = 'position: fixed; left: -100000px; top: 0; pointer-events: none; contain: layout'
  mountElement.append(diagramSvg)
  document.body.append(mountElement)
  try {
    const diagramWalk: PapelizDiagramWalk = { diagramSvg, diagramFontFamily, vectorShapes: [], vectorTextRuns: [] }
    walkDiagramElement(diagramSvg, 1, papelizDiagramNoFilterEffects, diagramWalk)
    const vectorDrawing: PapelizPdfExportVectorDrawing = {
      vectorDrawingWidth: printDrawing.mermaidDiagramPixelWidth,
      vectorDrawingHeight: printDrawing.mermaidDiagramPixelHeight,
      vectorShapes: diagramWalk.vectorShapes,
      vectorTextRuns: diagramWalk.vectorTextRuns,
    }
    const vectorDrawingProblem = findPapelizPdfExportVectorDrawingProblem(vectorDrawing)
    if (vectorDrawingProblem !== null) failDiagramWalk(vectorDrawingProblem)
    return vectorDrawing
  } catch (diagramWalkError) {
    undrawnReasons.push(diagramWalkError instanceof PapelizUndrawableDiagramError ? diagramWalkError.message : `the walk failed: ${String(diagramWalkError)}`)
    return null
  } finally {
    mountElement.remove()
  }
}
