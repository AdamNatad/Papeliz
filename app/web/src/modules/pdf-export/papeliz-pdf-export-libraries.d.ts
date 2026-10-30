// The parts of pdfkit, fontkit and linebreak the PDF export calls. None of the three ships its own
// types, so these name exactly what Papeliz uses and nothing more. They load only in the PDF worker.

declare module 'pdfkit' {
  export interface PapelizPdfKitTextOptions {
    lineBreak?: false
    baseline?: 'alphabetic'
    features?: Readonly<Record<string, boolean>>
    characterSpacing?: number
    // Slanted this many degrees.
    oblique?: number
    // Both true: filled and stroked (text render mode 2).
    fill?: boolean
    stroke?: boolean
  }

  export interface PapelizPdfKitDocumentInfo {
    Title?: string
    Creator?: string
    Producer?: string
    CreationDate?: Date
    ModDate?: Date
    [pdfKitInfoKey: string]: string | Date | undefined
  }

  export interface PapelizPdfKitDocumentOptions {
    pdfVersion: '1.7'
    autoFirstPage: false
    compress: boolean
    tagged: boolean
    lang: string
    displayTitle: boolean
    // null keeps pdfkit from creating its built-in Helvetica.
    font: null
    info: PapelizPdfKitDocumentInfo
  }

  export interface PapelizPdfKitStructureElement {
    add(structureElementChild: PapelizPdfKitStructureElement | (() => void)): this
    // The element's own dictionary, for entries `struct()` doesn't take: a table header's `/A`
    // attributes and a note's `/ID`.
    dictionary: { data: Record<string, unknown> }
    end(): void
  }

  // pdfkit writes a JavaScript `String` object as a PDF text string, and a plain string as a name.
  export interface PapelizPdfKitTextString {
    readonly length: number
    valueOf(): string
  }

  export interface PapelizPdfKitAnnotationOptions {
    structParent: PapelizPdfKitStructureElement
    Contents: PapelizPdfKitTextString
  }

  // A linear gradient, placed in the user space it is applied in.
  export interface PapelizPdfKitLinearGradient {
    stop(stopOffset: number, stopColor: string, stopOpacity: number): this
  }

  // A picture pdfkit has read, embedded once however often it is drawn.
  export interface PapelizPdfKitImage {
    width: number
    height: number
  }

  export interface PapelizPdfKitOutline {
    addItem(outlineTitle: string, outlineItemOptions: { pageNumber: number }): PapelizPdfKitOutline
    // The item's dictionary as pdfkit writes it at the end; `Count` stays as set when not `expanded`.
    outlineData: { Dest?: unknown; Count?: number }
  }

  export default class PDFDocument {
    constructor(pdfKitDocumentOptions: PapelizPdfKitDocumentOptions)
    info: PapelizPdfKitDocumentInfo
    on(pdfKitEventName: 'data', onPdfKitData: (pdfKitChunk: Uint8Array) => void): this
    on(pdfKitEventName: 'end', onPdfKitEnd: () => void): this
    // `fontCollectionFaceName`: the PostScript name of the face to take from a font collection.
    registerFont(fontName: string, fontFileBytes: Uint8Array, fontCollectionFaceName?: string): this
    font(fontName: string): this
    fontSize(fontSizePoints: number): this
    fillColor(fillColor: string | PapelizPdfKitLinearGradient, fillOpacity?: number): this
    strokeColor(strokeColor: string | PapelizPdfKitLinearGradient, strokeOpacity?: number): this
    linearGradient(startX: number, startY: number, endX: number, endY: number): PapelizPdfKitLinearGradient
    lineWidth(lineWidthPoints: number): this
    // One length (with its gap) or a whole dash array, from `phase` on.
    dash(dashLengths: number | number[], dashOptions: { space?: number; phase?: number }): this
    undash(): this
    text(textToDraw: string, leftPoints: number, topPoints: number, textOptions: PapelizPdfKitTextOptions): this
    widthOfString(textToMeasure: string, textOptions: PapelizPdfKitTextOptions): number
    addPage(pageOptions: { size: [number, number]; margin: 0 }): this
    save(): this
    restore(): this
    rect(leftPoints: number, topPoints: number, widthPoints: number, heightPoints: number): this
    roundedRect(leftPoints: number, topPoints: number, widthPoints: number, heightPoints: number, cornerRadiusPoints: number): this
    moveTo(leftPoints: number, topPoints: number): this
    lineTo(leftPoints: number, topPoints: number): this
    path(svgPathData: string): this
    translate(leftPoints: number, topPoints: number): this
    scale(scaleFactor: number): this
    lineCap(lineCapStyle: 'butt' | 'round' | 'square'): this
    lineJoin(lineJoinStyle: 'miter' | 'round' | 'bevel'): this
    miterLimit(miterLimit: number): this
    transform(scaleX: number, skewY: number, skewX: number, scaleY: number, translateX: number, translateY: number): this
    // A color, or a fill rule ('nonzero', 'evenodd') to fill in the current color.
    fill(fillColorOrRule: string): this
    fillAndStroke(fillRule: 'nonzero' | 'evenodd'): this
    stroke(strokeColor?: string): this
    // A web address, or a page's link (`goTo`) to a named place.
    link(leftPoints: number, topPoints: number, widthPoints: number, heightPoints: number, webLinkAddress: string, annotationOptions: PapelizPdfKitAnnotationOptions): this
    goTo(leftPoints: number, topPoints: number, widthPoints: number, heightPoints: number, destinationName: string, annotationOptions: PapelizPdfKitAnnotationOptions): this
    // On the current page; `top` from the page's top edge.
    addNamedDestination(destinationName: string, fitType: 'XYZ', leftPoints: null, topPoints: number, zoom: null): void
    outline: PapelizPdfKitOutline
    _root: { data: { PageMode?: string } }
    struct(structureRole: string, structureOptions?: { alt?: string }): PapelizPdfKitStructureElement
    openImage(pictureBytes: Uint8Array): PapelizPdfKitImage
    image(pdfKitImage: PapelizPdfKitImage, leftPoints: number, topPoints: number, imageOptions: { width: number; height: number }): this
    clip(): this
    addStructure(structureElement: PapelizPdfKitStructureElement): this
    markContent(markedContentTag: 'Artifact', markedContentOptions: { type: 'Layout' | 'Pagination' }): this
    endMarkedContent(): this
    end(): void
    // Writes the XMP metadata from `info`; called once, by `end()`.
    _addInfo(): void
  }
}

declare module 'fontkit' {
  export interface PapelizFontkitGlyph {
    id: number
  }

  export interface PapelizFontkitFont {
    unitsPerEm: number
    ascent: number
    descent: number
    underlinePosition: number
    underlineThickness: number
    numGlyphs: number
    postscriptName: string | null
    // The layout tables; with any of them, fontkit shapes text and puts right-to-left glyphs in display order.
    GSUB?: unknown
    GPOS?: unknown
    morx?: unknown
    'OS/2':
      | {
          yStrikeoutPosition: number
          yStrikeoutSize: number
          // The embedding bits of `fsType`.
          fsType: { noEmbedding: boolean; viewOnly: boolean; editable: boolean; noSubsetting: boolean; bitmapOnly: boolean }
        }
      | undefined
    layout(textToShape: string, openTypeFeatures?: Readonly<Record<string, boolean>>): { glyphs: PapelizFontkitGlyph[] }
    hasGlyphForCodePoint(codePoint: number): boolean
  }

  // With a PostScript name, the face of that name in a font collection (null when it holds none).
  export function create(fontFileBytes: Uint8Array, fontCollectionFaceName?: string): PapelizFontkitFont | null
}

declare module 'linebreak' {
  export default class LineBreaker {
    constructor(textToBreak: string)
    nextBreak(): { position: number; required: boolean } | null
  }
}
