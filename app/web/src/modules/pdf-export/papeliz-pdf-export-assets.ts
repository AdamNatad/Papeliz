import type { Element as HastElement, Root as HastRoot } from 'hast'
import {
  createPapelizDocxExportPagePictureTools,
  preparePapelizDocxExportNotePictures,
  type PapelizDocxExportNotePictures,
  type PapelizDocxExportPictureTools,
} from '../docx-export/papeliz-docx-export-pictures'
import type { PapelizHtmlExportVaultFileResolver } from '../html-export/papeliz-html-export-vault-files'
import type { PapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import type { PapelizNoteFontFamily } from '../workspace/papeliz-note-typography-store'
import type { PapelizPdfExportCharacterPicture, PapelizPdfExportCharacterPictureRequest } from './papeliz-pdf-export-character-pictures'
import type { PapelizPdfExportFontFamilyName } from './papeliz-pdf-export-fonts'
import { keepPapelizPdfExportPictureDrawingParts, type PapelizPdfExportPictureFile } from './papeliz-pdf-export-picture-check'
import type { PapelizPdfExportVectorDrawing } from './papeliz-pdf-export-vector-drawing'

// What a note's PDF needs from the page before the worker can write it: its pictures (read from the
// vault or the web and drawn again on the canvas, as Word export reads them), its Mermaid diagrams
// (MD View's print draw, as pictures), and pictures of the characters no font in the PDF has. The
// worker gets only bytes; nothing here runs in it.

export type PapelizPdfExportNotePictureEntry =
  | {
      notePictureEntryKind: 'shown'
      notePictureIndex: number
      pictureShownPixelWidth: number
      pictureShownPixelHeight: number
      // The alt text, or a diagram's Mermaid source.
      pictureDescription: string
      isMermaidDiagram: boolean
      // A diagram's drawing as vectors, when the page could walk it; its picture stays the fallback.
      diagramVectorDrawing: PapelizPdfExportVectorDrawing | null
    }
  // A picture that couldn't be read: MD View's chip with its alt text, and a web picture's address.
  | { notePictureEntryKind: 'missing'; pictureAltText: string; pictureWebAddress: string | null }
  | { notePictureEntryKind: 'diagram-error'; mermaidDiagramErrorMessage: string }

export interface PapelizPdfExportNotePictures {
  // By the tree element that shows each: an `<img>`, a `![[plan.png]]` embed, a ```mermaid `<pre>`.
  notePictureEntriesByElement: Map<HastElement, PapelizPdfExportNotePictureEntry>
  pdfExportPictures: PapelizPdfExportPictureFile[]
  pdfExportPictureNotices: string[]
}

export interface PapelizPdfExportNotePicturesOptions {
  noteHastRoot: HastRoot
  vaultNoteRelativePath: string
  pdfExportNoteName: string
  resolveWikilinkTarget: PapelizWikilinkTargetResolver
  resolveVaultFileReference: PapelizHtmlExportVaultFileResolver | null
  readVaultFileBlob: (vaultFileRelativePath: string) => Promise<Blob>
  pdfExportPictureTools: PapelizDocxExportPictureTools
  pdfExportNoteFontFamily: PapelizNoteFontFamily
  // The page's text area: the most room a picture can have.
  contentWidthPoints: number
  contentHeightPoints: number
  pdfExportAbortSignal?: AbortSignal
}

// The page's canvas, `fetch` and MD View's Mermaid, as Word export uses them.
export function createPapelizPdfExportPagePictureTools(): PapelizDocxExportPictureTools {
  return createPapelizDocxExportPagePictureTools()
}

// "Garden plan" with a web picture missing -> "Couldn’t load a picture from the web for “Garden plan”;
// it shows as its address."
function describePictureNotices(pdfExportNoteName: string, docxExportNotePictures: PapelizDocxExportNotePictures): string[] {
  const pictureNotices: string[] = []
  const { missingWebPictureCount, missingVaultPictureNames, undrawnMermaidDiagramCount } = docxExportNotePictures
  if (missingWebPictureCount > 0) {
    pictureNotices.push(
      missingWebPictureCount === 1
        ? `Couldn’t load a picture from the web for “${pdfExportNoteName}”; it shows as its address.`
        : `Couldn’t load ${missingWebPictureCount} pictures from the web for “${pdfExportNoteName}”; they show as their address.`,
    )
  }
  if (missingVaultPictureNames.length > 0) {
    const missingVaultPictureNamesText = missingVaultPictureNames.map((missingVaultPictureName) => `“${missingVaultPictureName}”`).join(', ')
    pictureNotices.push(`Couldn’t read ${missingVaultPictureNamesText} for “${pdfExportNoteName}”; ${missingVaultPictureNames.length === 1 ? 'it shows' : 'they show'} as a line.`)
  }
  if (undrawnMermaidDiagramCount > 0) {
    pictureNotices.push(
      undrawnMermaidDiagramCount === 1
        ? `Couldn’t draw a diagram in “${pdfExportNoteName}”; it shows as its source.`
        : `Couldn’t draw ${undrawnMermaidDiagramCount} diagrams in “${pdfExportNoteName}”; they show as their source.`,
    )
  }
  return pictureNotices
}

// Reads, draws and writes again each picture and diagram the note shows, one at a time.
export async function preparePapelizPdfExportNotePictures(notePicturesOptions: PapelizPdfExportNotePicturesOptions): Promise<PapelizPdfExportNotePictures> {
  const docxExportNotePictures = await preparePapelizDocxExportNotePictures({
    noteHastRoot: notePicturesOptions.noteHastRoot,
    vaultNoteRelativePath: notePicturesOptions.vaultNoteRelativePath,
    resolveWikilinkTarget: notePicturesOptions.resolveWikilinkTarget,
    resolveVaultFileReference: notePicturesOptions.resolveVaultFileReference,
    readVaultFileBlob: notePicturesOptions.readVaultFileBlob,
    docxExportPictureTools: notePicturesOptions.pdfExportPictureTools,
    docxExportNoteFontFamily: notePicturesOptions.pdfExportNoteFontFamily,
    docxExportTextWidthPoints: notePicturesOptions.contentWidthPoints,
    docxExportTextHeightPoints: notePicturesOptions.contentHeightPoints,
    ...(notePicturesOptions.pdfExportAbortSignal === undefined ? {} : { docxExportAbortSignal: notePicturesOptions.pdfExportAbortSignal }),
  })
  const notePictureEntriesByElement = new Map<HastElement, PapelizPdfExportNotePictureEntry>()
  const pdfExportPictures: PapelizPdfExportPictureFile[] = []
  for (const [hastElement, docxExportNotePicture] of docxExportNotePictures.docxExportNotePicturesByElement) {
    if ('docxExportShownPicture' in docxExportNotePicture) {
      const { docxExportPicture, pictureShownPixelWidth, pictureShownPixelHeight, pictureDescription, isMermaidDiagram } = docxExportNotePicture.docxExportShownPicture
      notePictureEntriesByElement.set(hastElement, {
        notePictureEntryKind: 'shown',
        notePictureIndex: pdfExportPictures.length,
        pictureShownPixelWidth,
        pictureShownPixelHeight,
        pictureDescription,
        isMermaidDiagram,
        diagramVectorDrawing: null,
      })
      pdfExportPictures.push(
        keepPapelizPdfExportPictureDrawingParts({
          pictureBytes: docxExportPicture.pictureBytes,
          pictureFormat: docxExportPicture.pictureType,
          picturePixelWidth: docxExportPicture.picturePixelWidth,
          picturePixelHeight: docxExportPicture.picturePixelHeight,
        }),
      )
    } else if ('docxExportMissingPicture' in docxExportNotePicture) {
      notePictureEntriesByElement.set(hastElement, { notePictureEntryKind: 'missing', ...docxExportNotePicture.docxExportMissingPicture })
    } else {
      notePictureEntriesByElement.set(hastElement, { notePictureEntryKind: 'diagram-error', mermaidDiagramErrorMessage: docxExportNotePicture.mermaidDiagramErrorMessage })
    }
  }
  return { notePictureEntriesByElement, pdfExportPictures, pdfExportPictureNotices: describePictureNotices(notePicturesOptions.pdfExportNoteName, docxExportNotePictures) }
}

// Draws pictures of characters; outside a page there are none, and those characters print as boxes.
export type PapelizPdfExportCharacterPictureDrawer = (characterPictureRequests: readonly PapelizPdfExportCharacterPictureRequest[]) => Promise<PapelizPdfExportCharacterPicture[]>

// Each character is drawn at 96 px, about 288 dpi at 24 pt, and scaled to its text's size.
const papelizPdfExportCharacterPictureFontSizePixels = 96

// MD View's typefaces for each print family: the note fonts' stacks from the app's stylesheet.
const papelizPdfExportCharacterFontStackVariables: Readonly<Record<PapelizPdfExportFontFamilyName, string>> = {
  figtree: '--font-sans',
  'charis-sil': '--font-serif',
  'jetbrains-mono': '--font-mono',
}

function decodeDataUrlBytes(pictureDataUrl: string): Uint8Array {
  return Uint8Array.from(atob(pictureDataUrl.slice(pictureDataUrl.indexOf(',') + 1)), (binaryCharacter) => binaryCharacter.charCodeAt(0))
}

// The page's canvas draws each character in its color and face, in MD View's font stack (so emoji
// come from the computer's emoji font), on a transparent ground, as PNG.
export const drawPapelizPdfExportCharacterPicturesOnCanvas: PapelizPdfExportCharacterPictureDrawer = async (characterPictureRequests) => {
  if (typeof document === 'undefined' || characterPictureRequests.length === 0) return []
  const characterCanvas = document.createElement('canvas')
  const characterCanvasContext = characterCanvas.getContext('2d')
  if (characterCanvasContext === null) return []
  const appStyle = getComputedStyle(document.documentElement)
  const fontSizePixels = papelizPdfExportCharacterPictureFontSizePixels
  const characterPictures: PapelizPdfExportCharacterPicture[] = []
  for (const { characterPictureKey, pictureCharactersText, textColor, fontStyle } of characterPictureRequests) {
    const fontStack = appStyle.getPropertyValue(papelizPdfExportCharacterFontStackVariables[fontStyle.fontFamilyName]).trim() || 'sans-serif'
    const canvasFont = `${fontStyle.isFontItalic ? 'italic ' : ''}${fontStyle.fontWeight} ${fontSizePixels}px ${fontStack}`
    characterCanvasContext.font = canvasFont
    const textMetrics = characterCanvasContext.measureText(pictureCharactersText)
    const ascentPixels = Math.ceil(Math.max(textMetrics.fontBoundingBoxAscent || fontSizePixels * 0.95, textMetrics.actualBoundingBoxAscent))
    const descentPixels = Math.ceil(Math.max(textMetrics.fontBoundingBoxDescent || fontSizePixels * 0.25, textMetrics.actualBoundingBoxDescent))
    const pictureWidthPixels = Math.max(1, Math.ceil(Math.max(textMetrics.width, textMetrics.actualBoundingBoxRight)))
    characterCanvas.width = pictureWidthPixels
    characterCanvas.height = Math.max(1, ascentPixels + descentPixels)
    characterCanvasContext.clearRect(0, 0, characterCanvas.width, characterCanvas.height)
    characterCanvasContext.font = canvasFont
    characterCanvasContext.textBaseline = 'alphabetic'
    characterCanvasContext.fillStyle = textColor
    characterCanvasContext.fillText(pictureCharactersText, 0, ascentPixels)
    characterPictures.push({
      characterPictureKey,
      pictureCharactersText,
      pictureFile: keepPapelizPdfExportPictureDrawingParts({
        pictureBytes: decodeDataUrlBytes(characterCanvas.toDataURL('image/png')),
        pictureFormat: 'png',
        picturePixelWidth: characterCanvas.width,
        picturePixelHeight: characterCanvas.height,
      }),
      advanceEm: Math.max(textMetrics.width, 1) / fontSizePixels,
      topAboveBaselineEm: ascentPixels / fontSizePixels,
      heightEm: characterCanvas.height / fontSizePixels,
    })
  }
  return characterPictures
}
