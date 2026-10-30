import type { Element as HastElement, ElementContent as HastElementContent, Root as HastRoot } from 'hast'
import { visit } from 'unist-util-visit'
import { getPapelizExportPrintColor, scalePapelizMdViewPixelsToPrintPoints } from '../export-print-style/papeliz-export-print-style'
import {
  buildPapelizHtmlExportFontFaceCss,
  choosePapelizHtmlExportFontFaces,
  encodePapelizBytesAsBase64,
  readPapelizHtmlExportFontFileBytes,
} from '../html-export/papeliz-html-export-fonts'
import { papelizHtmlExportIconShapesByName, type PapelizHtmlExportIconName } from '../html-export/papeliz-html-export-icons'
import { getPapelizHtmlExportPictureMediaType, type PapelizHtmlExportVaultFileResolver } from '../html-export/papeliz-html-export-vault-files'
import type { PapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { drawPapelizMermaidDiagramPngForPrint } from '../md-view/papeliz-md-view-mermaid-diagrams'
import { getVaultEntryName } from '../vault/papeliz-vault-relative-paths'
import type { PapelizNoteFontFamily } from '../workspace/papeliz-note-typography-store'

// Pictures for a Word file, prepared on the main thread before the document is built: the note's
// pictures, read from the vault or the web and written again; its Mermaid diagrams, drawn as PNG;
// and the icons MD View shows beside callout titles. Every picture is decoded and drawn on a canvas,
// so none keeps its source's metadata (EXIF with GPS, XMP, content credentials), and the file never
// asks Word to fetch anything when it opens.

export interface PapelizDocxExportPicture {
  pictureBytes: Uint8Array
  pictureType: 'png' | 'jpg'
  picturePixelWidth: number
  picturePixelHeight: number
}

// Word places pictures in pixels at 96 to the inch.
export const papelizDocxExportPicturePixelsPerPoint = 96 / 72
// A picture leaves this much of the page's height for the lines around it, so it never gets cut off.
export const papelizDocxExportPictureHeightMarginPoints = 24

// Draws one of MD View's icons in a print color ("#0064d4"); null when it can't be drawn here.
export type PapelizDocxExportIconPngDrawer = (iconName: PapelizHtmlExportIconName, iconInkColor: string) => Promise<PapelizDocxExportPicture | null>

// How many pixels a picture gets in the file, from its own size and whether it can be drawn larger
// than that (SVG).
export type PapelizDocxExportPictureBitmapSizeChooser = (
  pictureNaturalPixelWidth: number,
  pictureNaturalPixelHeight: number,
  isPictureScalable: boolean,
) => { bitmapPixelWidth: number; bitmapPixelHeight: number }

export interface PapelizDocxExportRewrittenPicture {
  docxExportPicture: PapelizDocxExportPicture
  pictureNaturalPixelWidth: number
  pictureNaturalPixelHeight: number
}

// Decodes a picture and writes it again; null when it can't be decoded.
export type PapelizDocxExportPictureRewriter = (
  pictureBlob: Blob,
  pictureMediaType: string,
  choosePictureBitmapSize: PapelizDocxExportPictureBitmapSizeChooser,
) => Promise<PapelizDocxExportRewrittenPicture | null>

// Fetches a picture from the web; null when it doesn't arrive.
export type PapelizDocxExportWebPictureFetcher = (pictureWebAddress: string, docxExportAbortSignal: AbortSignal | undefined) => Promise<Blob | null>

export type PapelizDocxExportMermaidDiagramPng =
  | { docxExportPicture: PapelizDocxExportPicture; mermaidDiagramPixelWidth: number; mermaidDiagramPixelHeight: number }
  | { mermaidDiagramErrorMessage: string }

// Draws a ```mermaid block as a PNG for paper; null when diagrams can't be drawn here, so they stay
// as their code.
export type PapelizDocxExportMermaidDiagramPngDrawer = (mermaidDiagramSource: string, docxExportNoteFontFamily: PapelizNoteFontFamily) => Promise<PapelizDocxExportMermaidDiagramPng | null>

export interface PapelizDocxExportPictureTools {
  drawDocxExportIconPng: PapelizDocxExportIconPngDrawer
  rewriteDocxExportPicture: PapelizDocxExportPictureRewriter
  fetchDocxExportWebPicture: PapelizDocxExportWebPictureFetcher
  drawDocxExportMermaidDiagramPng: PapelizDocxExportMermaidDiagramPngDrawer
}

// A picture ready to place, with the size MD View shows it at in CSS pixels, before it fits its place.
export interface PapelizDocxExportShownPicture {
  docxExportPicture: PapelizDocxExportPicture
  pictureShownPixelWidth: number
  pictureShownPixelHeight: number
  // The alt text, or a diagram's Mermaid source: the picture's description in Word.
  pictureDescription: string
  isMermaidDiagram: boolean
}

// A picture that couldn't be read: a line with its alt text, and a web picture's address as a link.
export interface PapelizDocxExportMissingPicture {
  pictureAltText: string
  pictureWebAddress: string | null
}

export type PapelizDocxExportNotePicture =
  | { docxExportShownPicture: PapelizDocxExportShownPicture }
  | { docxExportMissingPicture: PapelizDocxExportMissingPicture }
  | { mermaidDiagramErrorMessage: string }

export interface PapelizDocxExportNotePicturesOptions {
  noteHastRoot: HastRoot
  vaultNoteRelativePath: string
  resolveWikilinkTarget: PapelizWikilinkTargetResolver
  // Finds a file the note names in the vault; null when the export has no vault files.
  resolveVaultFileReference: PapelizHtmlExportVaultFileResolver | null
  readVaultFileBlob: (vaultFileRelativePath: string) => Promise<Blob>
  docxExportPictureTools: PapelizDocxExportPictureTools
  docxExportNoteFontFamily: PapelizNoteFontFamily
  // The page's text area, the most room a picture can have.
  docxExportTextWidthPoints: number
  docxExportTextHeightPoints: number
  docxExportAbortSignal?: AbortSignal
}

export interface PapelizDocxExportNotePictures {
  // Each picture by the tree element that shows it: an `<img>`, a `![[plan.png]]` embed, or a
  // ```mermaid block's `<pre>`. An element with none keeps MD View's look.
  docxExportNotePicturesByElement: Map<HastElement, PapelizDocxExportNotePicture>
  missingWebPictureCount: number
  missingVaultPictureNames: string[]
  undrawnMermaidDiagramCount: number
}

// MD View's 16 px icon, drawn at 3× so it stays sharp on paper.
const papelizDocxExportIconPixelSize = 48
// A picture gets at most twice the pixels it prints at, enough for paper and small for Notion's limit
// of 5 MB per file on its free plan.
const papelizDocxExportPicturePixelDensity = 2
const papelizDocxExportJpegQuality = 0.9
// A picture file larger than this is left out rather than decoded.
const papelizDocxExportPictureFileByteLimit = 50 * 1024 * 1024
const papelizDocxExportWebPictureWaitMilliseconds = 20_000
// "300" or "300x200" after the bar in `![[plan.png|300]]`: the picture's size, as notes write it.
const papelizDocxExportPictureSizePattern = /^(\d{1,5})(?:x(\d{1,5}))?$/
// The typefaces the Word file names for each note font (papeliz-docx-export-styles.ts), as CSS.
const papelizDocxExportDiagramFontFamilies: Readonly<Record<PapelizNoteFontFamily, string>> = {
  sans: "'Figtree', sans-serif",
  serif: 'Georgia, serif',
  mono: "'JetBrains Mono', monospace",
}

function getHastStringProperty(hastElement: HastElement, hastPropertyName: string): string | null {
  const hastPropertyValue = hastElement.properties[hastPropertyName]
  return typeof hastPropertyValue === 'string' ? hastPropertyValue : null
}

function hasHastClassName(hastElement: HastElement, hastClassName: string): boolean {
  const hastClassNames = hastElement.properties['className']
  return Array.isArray(hastClassNames) && hastClassNames.includes(hastClassName)
}

function collectHastText(hastNode: HastElementContent | HastRoot): string {
  if (hastNode.type === 'text') return hastNode.value
  if (hastNode.type === 'element' || hastNode.type === 'root') return hastNode.children.map((hastChild) => collectHastText(hastChild as HastElementContent)).join('')
  return ''
}

function decodeLinkHrefPart(linkHrefPart: string): string {
  try {
    return decodeURIComponent(linkHrefPart)
  } catch {
    return linkHrefPart
  }
}

function decodePapelizDocxExportDataUrlBytes(pictureDataUrl: string): Uint8Array {
  const pictureBinaryText = atob(pictureDataUrl.slice(pictureDataUrl.indexOf(',') + 1))
  const pictureBytes = new Uint8Array(pictureBinaryText.length)
  for (let pictureByteIndex = 0; pictureByteIndex < pictureBinaryText.length; pictureByteIndex += 1) pictureBytes[pictureByteIndex] = pictureBinaryText.charCodeAt(pictureByteIndex)
  return pictureBytes
}

// The source of a ```mermaid block (`<pre><code class="language-mermaid">`), or null for other code.
export function readPapelizDocxExportMermaidDiagramSource(hastPreElement: HastElement): string | null {
  const hastCodeElement = hastPreElement.children.find((hastChild): hastChild is HastElement => hastChild.type === 'element' && hastChild.tagName === 'code')
  if (hastCodeElement === undefined || !hasHastClassName(hastCodeElement, 'language-mermaid')) return null
  return collectHastText(hastCodeElement).replace(/\n$/, '')
}

// The size MD View shows a picture at, in CSS pixels: its own, or the size the note gives it.
export function getPapelizDocxExportPictureShownPixelSize(
  pictureNaturalPixelWidth: number,
  pictureNaturalPixelHeight: number,
  requestedPixelWidth: number | null,
  requestedPixelHeight: number | null,
): { pictureShownPixelWidth: number; pictureShownPixelHeight: number } {
  if (requestedPixelWidth === null || requestedPixelWidth <= 0) return { pictureShownPixelWidth: pictureNaturalPixelWidth, pictureShownPixelHeight: pictureNaturalPixelHeight }
  if (requestedPixelHeight !== null && requestedPixelHeight > 0) return { pictureShownPixelWidth: requestedPixelWidth, pictureShownPixelHeight: requestedPixelHeight }
  return { pictureShownPixelWidth: requestedPixelWidth, pictureShownPixelHeight: (pictureNaturalPixelHeight * requestedPixelWidth) / pictureNaturalPixelWidth }
}

// The size a picture prints at, in points: its size on screen scaled as MD View's text is, made
// smaller to fit the room it has, its shape kept.
export function fitPapelizDocxExportPictureSizePoints(
  pictureShownPixelWidth: number,
  pictureShownPixelHeight: number,
  roomWidthPoints: number,
  roomHeightPoints: number,
): { printedWidthPoints: number; printedHeightPoints: number } {
  const scaledWidthPoints = scalePapelizMdViewPixelsToPrintPoints(Math.max(1, pictureShownPixelWidth))
  const scaledHeightPoints = scalePapelizMdViewPixelsToPrintPoints(Math.max(1, pictureShownPixelHeight))
  const fitScale = Math.min(1, roomWidthPoints / scaledWidthPoints, roomHeightPoints / scaledHeightPoints)
  return { printedWidthPoints: scaledWidthPoints * fitScale, printedHeightPoints: scaledHeightPoints * fitScale }
}

// At most twice the pixels the picture prints at with the whole text area, and never more than a
// photo has: a raster picture is only made smaller.
function createPictureBitmapSizeChooser(
  requestedPixelWidth: number | null,
  requestedPixelHeight: number | null,
  docxExportTextWidthPoints: number,
  docxExportTextHeightPoints: number,
): PapelizDocxExportPictureBitmapSizeChooser {
  return (pictureNaturalPixelWidth, pictureNaturalPixelHeight, isPictureScalable) => {
    const { pictureShownPixelWidth, pictureShownPixelHeight } = getPapelizDocxExportPictureShownPixelSize(pictureNaturalPixelWidth, pictureNaturalPixelHeight, requestedPixelWidth, requestedPixelHeight)
    const { printedWidthPoints, printedHeightPoints } = fitPapelizDocxExportPictureSizePoints(
      pictureShownPixelWidth,
      pictureShownPixelHeight,
      docxExportTextWidthPoints,
      docxExportTextHeightPoints - papelizDocxExportPictureHeightMarginPoints,
    )
    const densePixelWidth = printedWidthPoints * papelizDocxExportPicturePixelsPerPoint * papelizDocxExportPicturePixelDensity
    const densePixelHeight = printedHeightPoints * papelizDocxExportPicturePixelsPerPoint * papelizDocxExportPicturePixelDensity
    const bitmapScale = Math.min(densePixelWidth / pictureNaturalPixelWidth, densePixelHeight / pictureNaturalPixelHeight, isPictureScalable ? Number.POSITIVE_INFINITY : 1)
    return {
      bitmapPixelWidth: Math.max(1, Math.round(pictureNaturalPixelWidth * bitmapScale)),
      bitmapPixelHeight: Math.max(1, Math.round(pictureNaturalPixelHeight * bitmapScale)),
    }
  }
}

function hasTransparentPixel(pictureCanvasContext: CanvasRenderingContext2D, bitmapPixelWidth: number, bitmapPixelHeight: number): boolean {
  const pictureImageData = pictureCanvasContext.getImageData(0, 0, bitmapPixelWidth, bitmapPixelHeight).data
  for (let alphaIndex = 3; alphaIndex < pictureImageData.length; alphaIndex += 4) {
    if ((pictureImageData[alphaIndex] ?? 255) < 255) return true
  }
  return false
}

// The page's canvas: SVG through an `<img>` (it runs nothing and loads nothing from outside), other
// pictures through `createImageBitmap`, which turns photos upright as their EXIF says. Written as
// JPEG at 0.9 when every pixel is opaque, else as PNG.
export const rewritePapelizDocxExportPictureOnCanvas: PapelizDocxExportPictureRewriter = async (pictureBlob, pictureMediaType, choosePictureBitmapSize) => {
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return null
  let pictureImageBitmap: ImageBitmap | null = null
  try {
    let pictureCanvasSource: CanvasImageSource
    let pictureNaturalPixelWidth: number
    let pictureNaturalPixelHeight: number
    const isSvgPicture = pictureMediaType === 'image/svg+xml'
    if (isSvgPicture) {
      const svgPictureImage = new Image()
      svgPictureImage.src = `data:image/svg+xml;base64,${encodePapelizBytesAsBase64(new Uint8Array(await pictureBlob.arrayBuffer()))}`
      await svgPictureImage.decode()
      // An SVG with no size of its own gets the browser's default for one.
      pictureNaturalPixelWidth = svgPictureImage.naturalWidth || 300
      pictureNaturalPixelHeight = svgPictureImage.naturalHeight || 150
      pictureCanvasSource = svgPictureImage
    } else {
      pictureImageBitmap = await createImageBitmap(pictureBlob)
      pictureNaturalPixelWidth = pictureImageBitmap.width
      pictureNaturalPixelHeight = pictureImageBitmap.height
      pictureCanvasSource = pictureImageBitmap
    }
    if (pictureNaturalPixelWidth <= 0 || pictureNaturalPixelHeight <= 0) return null
    const { bitmapPixelWidth, bitmapPixelHeight } = choosePictureBitmapSize(pictureNaturalPixelWidth, pictureNaturalPixelHeight, isSvgPicture)
    const pictureCanvas = document.createElement('canvas')
    pictureCanvas.width = bitmapPixelWidth
    pictureCanvas.height = bitmapPixelHeight
    const pictureCanvasContext = pictureCanvas.getContext('2d', { willReadFrequently: true })
    if (pictureCanvasContext === null) return null
    pictureCanvasContext.imageSmoothingQuality = 'high'
    pictureCanvasContext.drawImage(pictureCanvasSource, 0, 0, bitmapPixelWidth, bitmapPixelHeight)
    const isPictureOpaque = pictureMediaType === 'image/jpeg' || !hasTransparentPixel(pictureCanvasContext, bitmapPixelWidth, bitmapPixelHeight)
    // `toBlob` waits for the page to be idle, a second at a time while it draws no frames.
    const pictureDataUrl = isPictureOpaque ? pictureCanvas.toDataURL('image/jpeg', papelizDocxExportJpegQuality) : pictureCanvas.toDataURL('image/png')
    return {
      docxExportPicture: {
        pictureBytes: decodePapelizDocxExportDataUrlBytes(pictureDataUrl),
        pictureType: isPictureOpaque ? 'jpg' : 'png',
        picturePixelWidth: bitmapPixelWidth,
        picturePixelHeight: bitmapPixelHeight,
      },
      pictureNaturalPixelWidth,
      pictureNaturalPixelHeight,
    }
  } catch {
    return null
  } finally {
    pictureImageBitmap?.close()
  }
}

// From the page, as a visitor with no cookies and no referrer, the way MD View shows web pictures.
// A site that doesn't let pages read its pictures, or one that doesn't answer in time, gives null.
export const fetchPapelizDocxExportWebPictureFromPage: PapelizDocxExportWebPictureFetcher = async (pictureWebAddress, docxExportAbortSignal) => {
  if (typeof document === 'undefined' || !/^https:/i.test(pictureWebAddress)) return null
  try {
    const waitSignal = AbortSignal.timeout(papelizDocxExportWebPictureWaitMilliseconds)
    const pictureResponse = await fetch(pictureWebAddress, {
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: docxExportAbortSignal === undefined ? waitSignal : AbortSignal.any([docxExportAbortSignal, waitSignal]),
    })
    if (!pictureResponse.ok) return null
    const pictureBlob = await pictureResponse.blob()
    return pictureBlob.size > papelizDocxExportPictureFileByteLimit ? null : pictureBlob
  } catch {
    return null
  }
}

// The fonts a diagram's labels need inside its picture, as `data:` URLs; none for Georgia, which
// computers have.
async function buildDocxExportDiagramFontFaceCss(docxExportNoteFontFamily: PapelizNoteFontFamily): Promise<string> {
  const diagramFontFaces = choosePapelizHtmlExportFontFaces(docxExportNoteFontFamily, { hasCodeText: false, hasSiteChrome: false })
  const diagramFontFileBytes = await Promise.all(diagramFontFaces.map((diagramFontFace) => readPapelizHtmlExportFontFileBytes(diagramFontFace.fontFileUrl)))
  const diagramFontFaceSources = new Map(diagramFontFaces.map((diagramFontFace, diagramFontFaceIndex) => [diagramFontFace, `data:font/woff2;base64,${encodePapelizBytesAsBase64(diagramFontFileBytes[diagramFontFaceIndex] ?? new Uint8Array())}`]))
  return buildPapelizHtmlExportFontFaceCss(diagramFontFaces, (diagramFontFace) => diagramFontFaceSources.get(diagramFontFace) ?? '')
}

// Mermaid's print drawing at twice its size, in the note's typeface, through MD View's queue.
export function createPapelizDocxExportMermaidDiagramPngDrawerOnPage(): PapelizDocxExportMermaidDiagramPngDrawer {
  const diagramFontFaceCssByFontFamily = new Map<PapelizNoteFontFamily, Promise<string>>()
  return async (mermaidDiagramSource, docxExportNoteFontFamily) => {
    if (typeof document === 'undefined' || typeof Image === 'undefined') return null
    let diagramFontFaceCss = diagramFontFaceCssByFontFamily.get(docxExportNoteFontFamily)
    if (diagramFontFaceCss === undefined) {
      // Without the font files, labels are drawn in the browser's own typeface.
      diagramFontFaceCss = buildDocxExportDiagramFontFaceCss(docxExportNoteFontFamily).catch(() => '')
      diagramFontFaceCssByFontFamily.set(docxExportNoteFontFamily, diagramFontFaceCss)
    }
    const mermaidDiagramPngResult = await drawPapelizMermaidDiagramPngForPrint(mermaidDiagramSource, {
      readPrintColor: getPapelizExportPrintColor,
      printFontFamily: papelizDocxExportDiagramFontFamilies[docxExportNoteFontFamily],
      printFontFaceCss: await diagramFontFaceCss,
      pngPixelScale: papelizDocxExportPicturePixelDensity,
    })
    if ('mermaidDiagramErrorMessage' in mermaidDiagramPngResult) return mermaidDiagramPngResult
    return {
      docxExportPicture: {
        pictureBytes: mermaidDiagramPngResult.mermaidDiagramPngBytes,
        pictureType: 'png',
        picturePixelWidth: mermaidDiagramPngResult.mermaidDiagramPngPixelWidth,
        picturePixelHeight: mermaidDiagramPngResult.mermaidDiagramPngPixelHeight,
      },
      mermaidDiagramPixelWidth: mermaidDiagramPngResult.mermaidDiagramPixelWidth,
      mermaidDiagramPixelHeight: mermaidDiagramPngResult.mermaidDiagramPixelHeight,
    }
  }
}

function escapeSvgAttributeValue(svgAttributeValue: string): string {
  return svgAttributeValue.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

// The icon as a standalone SVG file, stroked in the ink color, as MD View draws it.
export function buildPapelizDocxExportIconSvgText(iconName: PapelizHtmlExportIconName, iconInkColor: string): string {
  const iconShapesSvgText = papelizHtmlExportIconShapesByName[iconName]
    .map(([svgShapeTagName, svgShapeAttributes]) => {
      const svgShapeAttributesText = Object.entries(svgShapeAttributes)
        .map(([svgAttributeName, svgAttributeValue]) => ` ${svgAttributeName}="${escapeSvgAttributeValue(svgAttributeValue === 'currentColor' ? iconInkColor : svgAttributeValue)}"`)
        .join('')
      return `<${svgShapeTagName}${svgShapeAttributesText}/>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${papelizDocxExportIconPixelSize}" height="${papelizDocxExportIconPixelSize}" viewBox="0 0 24 24" fill="none" stroke="${escapeSvgAttributeValue(iconInkColor)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconShapesSvgText}</svg>`
}

// The icon as a PNG, through an `<img>` of its SVG and a canvas. Outside a page (in tests, or where
// a canvas isn't allowed) there is no picture, and the callout keeps its card and title.
export const drawPapelizDocxExportIconPngOnCanvas: PapelizDocxExportIconPngDrawer = async (iconName, iconInkColor) => {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null
  try {
    const iconImage = new Image(papelizDocxExportIconPixelSize, papelizDocxExportIconPixelSize)
    iconImage.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildPapelizDocxExportIconSvgText(iconName, iconInkColor))}`
    await iconImage.decode()
    const iconCanvas = document.createElement('canvas')
    iconCanvas.width = papelizDocxExportIconPixelSize
    iconCanvas.height = papelizDocxExportIconPixelSize
    const iconCanvasContext = iconCanvas.getContext('2d')
    if (iconCanvasContext === null) return null
    iconCanvasContext.drawImage(iconImage, 0, 0, papelizDocxExportIconPixelSize, papelizDocxExportIconPixelSize)
    // `toBlob` waits for the page to be idle, a second at a time while it draws no frames; a small
    // icon encodes at once this way.
    return {
      pictureBytes: decodePapelizDocxExportDataUrlBytes(iconCanvas.toDataURL('image/png')),
      pictureType: 'png',
      picturePixelWidth: papelizDocxExportIconPixelSize,
      picturePixelHeight: papelizDocxExportIconPixelSize,
    }
  } catch {
    return null
  }
}

// Each icon in each color is drawn once per export, however many callouts show it.
export function createPapelizDocxExportCachedIconDrawer(drawDocxExportIconPng: PapelizDocxExportIconPngDrawer): PapelizDocxExportIconPngDrawer {
  const iconPictureDrawsByKey = new Map<string, Promise<PapelizDocxExportPicture | null>>()
  return (iconName, iconInkColor) => {
    const iconPictureKey = `${iconName} ${iconInkColor}`
    const cachedIconPictureDraw = iconPictureDrawsByKey.get(iconPictureKey)
    if (cachedIconPictureDraw !== undefined) return cachedIconPictureDraw
    const iconPictureDraw = drawDocxExportIconPng(iconName, iconInkColor)
    iconPictureDrawsByKey.set(iconPictureKey, iconPictureDraw)
    return iconPictureDraw
  }
}

// The page's own tools: its canvas, `fetch` and MD View's Mermaid. Each export makes its own, so the
// icons and diagram fonts it prepares are kept for that export only.
export function createPapelizDocxExportPagePictureTools(): PapelizDocxExportPictureTools {
  return {
    drawDocxExportIconPng: drawPapelizDocxExportIconPngOnCanvas,
    rewriteDocxExportPicture: rewritePapelizDocxExportPictureOnCanvas,
    fetchDocxExportWebPicture: fetchPapelizDocxExportWebPictureFromPage,
    drawDocxExportMermaidDiagramPng: createPapelizDocxExportMermaidDiagramPngDrawerOnPage(),
  }
}

type PapelizDocxExportPictureRequest =
  | { pictureRequestKind: 'web'; pictureWebAddress: string; pictureAltText: string }
  | {
      pictureRequestKind: 'vault'
      vaultFileRelativePath: string
      pictureAltText: string
      requestedPixelWidth: number | null
      requestedPixelHeight: number | null
    }
  | { pictureRequestKind: 'mermaid'; mermaidDiagramSource: string }

// What MD View's tree shows as pictures, in the note's order: `![alt](https://…)`, a picture kept in
// the vault (`![alt](pictures/plan.png)`, `![[plan.png|300]]`) and ```mermaid blocks. Other pictures
// (an `http:` address, a file that isn't in the vault) keep MD View's "Image: …" line.
function listDocxExportPictureRequests(notePicturesOptions: PapelizDocxExportNotePicturesOptions): Map<HastElement, PapelizDocxExportPictureRequest> {
  const { resolveVaultFileReference, vaultNoteRelativePath } = notePicturesOptions
  const findVaultPicture = (vaultFileReference: string) => {
    const vaultFileRelativePath = resolveVaultFileReference?.(vaultFileReference, vaultNoteRelativePath) ?? null
    return vaultFileRelativePath !== null && getPapelizHtmlExportPictureMediaType(vaultFileRelativePath) !== null ? vaultFileRelativePath : null
  }
  const pictureRequestsByElement = new Map<HastElement, PapelizDocxExportPictureRequest>()
  visit(notePicturesOptions.noteHastRoot, 'element', (hastElement: HastElement) => {
    if (hastElement.tagName === 'img') {
      const pictureSource = getHastStringProperty(hastElement, 'src')
      const pictureAltText = getHastStringProperty(hastElement, 'alt') ?? ''
      if (pictureSource === null) return
      if (/^https:/i.test(pictureSource)) {
        pictureRequestsByElement.set(hastElement, { pictureRequestKind: 'web', pictureWebAddress: pictureSource, pictureAltText })
        return
      }
      const vaultFileRelativePath = findVaultPicture(decodeLinkHrefPart(pictureSource.replace(/[?#].*$/, '')))
      if (vaultFileRelativePath !== null) pictureRequestsByElement.set(hastElement, { pictureRequestKind: 'vault', vaultFileRelativePath, pictureAltText, requestedPixelWidth: null, requestedPixelHeight: null })
      return
    }
    if (hastElement.tagName === 'a' && getHastStringProperty(hastElement, 'dataPapelizWikilinkEmbed') === 'true') {
      // `![[Other note]]` stays a link; `![[plan.png]]` shows the picture.
      const wikilinkTargetName = getHastStringProperty(hastElement, 'dataPapelizWikilinkTarget')
      if (wikilinkTargetName === null || notePicturesOptions.resolveWikilinkTarget(wikilinkTargetName, vaultNoteRelativePath) !== null) return
      const vaultFileRelativePath = findVaultPicture(wikilinkTargetName)
      if (vaultFileRelativePath === null) return
      const wikilinkLabelText = collectHastText(hastElement).trim()
      const pictureSizeMatch = papelizDocxExportPictureSizePattern.exec(wikilinkLabelText)
      pictureRequestsByElement.set(hastElement, {
        pictureRequestKind: 'vault',
        vaultFileRelativePath,
        pictureAltText: pictureSizeMatch === null ? wikilinkLabelText : getVaultEntryName(vaultFileRelativePath),
        requestedPixelWidth: pictureSizeMatch === null ? null : Number(pictureSizeMatch[1]),
        requestedPixelHeight: pictureSizeMatch?.[2] === undefined ? null : Number(pictureSizeMatch[2]),
      })
      return
    }
    if (hastElement.tagName === 'pre') {
      const mermaidDiagramSource = readPapelizDocxExportMermaidDiagramSource(hastElement)
      if (mermaidDiagramSource !== null) pictureRequestsByElement.set(hastElement, { pictureRequestKind: 'mermaid', mermaidDiagramSource })
    }
  })
  return pictureRequestsByElement
}

async function readVaultPictureBlob(notePicturesOptions: PapelizDocxExportNotePicturesOptions, vaultFileRelativePath: string): Promise<Blob | null> {
  try {
    const vaultPictureBlob = await notePicturesOptions.readVaultFileBlob(vaultFileRelativePath)
    return vaultPictureBlob.size > papelizDocxExportPictureFileByteLimit ? null : vaultPictureBlob
  } catch {
    return null
  }
}

// Reads, draws and writes again each picture the note shows, one at a time in the note's order.
export async function preparePapelizDocxExportNotePictures(notePicturesOptions: PapelizDocxExportNotePicturesOptions): Promise<PapelizDocxExportNotePictures> {
  const { docxExportPictureTools, docxExportAbortSignal, docxExportTextWidthPoints, docxExportTextHeightPoints } = notePicturesOptions
  const notePictures: PapelizDocxExportNotePictures = {
    docxExportNotePicturesByElement: new Map(),
    missingWebPictureCount: 0,
    missingVaultPictureNames: [],
    undrawnMermaidDiagramCount: 0,
  }
  for (const [hastElement, pictureRequest] of listDocxExportPictureRequests(notePicturesOptions)) {
    docxExportAbortSignal?.throwIfAborted()
    if (pictureRequest.pictureRequestKind === 'mermaid') {
      const mermaidDiagramPng = await docxExportPictureTools.drawDocxExportMermaidDiagramPng(pictureRequest.mermaidDiagramSource, notePicturesOptions.docxExportNoteFontFamily)
      if (mermaidDiagramPng === null) continue
      if ('mermaidDiagramErrorMessage' in mermaidDiagramPng) {
        notePictures.undrawnMermaidDiagramCount += 1
        notePictures.docxExportNotePicturesByElement.set(hastElement, mermaidDiagramPng)
        continue
      }
      notePictures.docxExportNotePicturesByElement.set(hastElement, {
        docxExportShownPicture: {
          docxExportPicture: mermaidDiagramPng.docxExportPicture,
          pictureShownPixelWidth: mermaidDiagramPng.mermaidDiagramPixelWidth,
          pictureShownPixelHeight: mermaidDiagramPng.mermaidDiagramPixelHeight,
          pictureDescription: pictureRequest.mermaidDiagramSource,
          isMermaidDiagram: true,
        },
      })
      continue
    }
    const isWebPicture = pictureRequest.pictureRequestKind === 'web'
    const pictureBlob = isWebPicture
      ? await docxExportPictureTools.fetchDocxExportWebPicture(pictureRequest.pictureWebAddress, docxExportAbortSignal)
      : await readVaultPictureBlob(notePicturesOptions, pictureRequest.vaultFileRelativePath)
    docxExportAbortSignal?.throwIfAborted()
    // "image/svg+xml; charset=utf-8" -> "image/svg+xml"
    const pictureMediaType = isWebPicture
      ? (pictureBlob?.type.split(';')[0]?.trim().toLowerCase() ?? '')
      : (getPapelizHtmlExportPictureMediaType(pictureRequest.vaultFileRelativePath) ?? '')
    const requestedPixelWidth = isWebPicture ? null : pictureRequest.requestedPixelWidth
    const requestedPixelHeight = isWebPicture ? null : pictureRequest.requestedPixelHeight
    const rewrittenPicture =
      pictureBlob === null
        ? null
        : await docxExportPictureTools.rewriteDocxExportPicture(
            pictureBlob,
            pictureMediaType,
            createPictureBitmapSizeChooser(requestedPixelWidth, requestedPixelHeight, docxExportTextWidthPoints, docxExportTextHeightPoints),
          )
    if (rewrittenPicture === null) {
      if (isWebPicture) notePictures.missingWebPictureCount += 1
      else notePictures.missingVaultPictureNames.push(getVaultEntryName(pictureRequest.vaultFileRelativePath))
      notePictures.docxExportNotePicturesByElement.set(hastElement, {
        docxExportMissingPicture: { pictureAltText: pictureRequest.pictureAltText, pictureWebAddress: isWebPicture ? pictureRequest.pictureWebAddress : null },
      })
      continue
    }
    const { pictureShownPixelWidth, pictureShownPixelHeight } = getPapelizDocxExportPictureShownPixelSize(
      rewrittenPicture.pictureNaturalPixelWidth,
      rewrittenPicture.pictureNaturalPixelHeight,
      requestedPixelWidth,
      requestedPixelHeight,
    )
    notePictures.docxExportNotePicturesByElement.set(hastElement, {
      docxExportShownPicture: {
        docxExportPicture: rewrittenPicture.docxExportPicture,
        pictureShownPixelWidth,
        pictureShownPixelHeight,
        pictureDescription: pictureRequest.pictureAltText,
        isMermaidDiagram: false,
      },
    })
  }
  return notePictures
}
