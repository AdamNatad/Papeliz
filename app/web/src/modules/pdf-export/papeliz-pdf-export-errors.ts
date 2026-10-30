// Why a PDF export stopped. The message of a PapelizPdfExportError is the plain line the Export page
// shows; the technical detail goes to the console only, cleaned first.

export type PapelizPdfExportErrorCode =
  | 'pdf-export-cancelled'
  | 'pdf-export-limit-reached'
  | 'pdf-export-font-unreadable'
  | 'pdf-export-layout-failed'
  | 'pdf-export-writer-failed'
  | 'pdf-export-file-check-failed'
  | 'pdf-export-worker-failed'
  | 'pdf-export-worker-timed-out'

export const papelizPdfExportErrorCodes: ReadonlySet<string> = new Set<PapelizPdfExportErrorCode>([
  'pdf-export-cancelled',
  'pdf-export-limit-reached',
  'pdf-export-font-unreadable',
  'pdf-export-layout-failed',
  'pdf-export-writer-failed',
  'pdf-export-file-check-failed',
  'pdf-export-worker-failed',
  'pdf-export-worker-timed-out',
])

export class PapelizPdfExportError extends Error {
  override readonly name = 'PapelizPdfExportError'
  readonly pdfExportErrorCode: PapelizPdfExportErrorCode

  constructor(pdfExportErrorCode: PapelizPdfExportErrorCode, pdfExportErrorMessage: string) {
    super(pdfExportErrorMessage)
    this.pdfExportErrorCode = pdfExportErrorCode
  }
}

export function isPapelizPdfExportErrorCode(pdfExportErrorCodeText: unknown): pdfExportErrorCodeText is PapelizPdfExportErrorCode {
  return typeof pdfExportErrorCodeText === 'string' && papelizPdfExportErrorCodes.has(pdfExportErrorCodeText)
}

const papelizPdfExportErrorMessageLength = 1_024

// A message from the worker or a library, made safe for the console: file paths and addresses become
// [path] and [url], control characters become spaces, and it is cut without splitting a character.
export function cleanPapelizPdfExportErrorMessage(pdfExportErrorMessage: string): string {
  const cleanedErrorMessage = pdfExportErrorMessage
    .replace(/\b(?:https?|blob|file):\/\/?\S+/gi, '[url]')
    .replace(/\b[A-Za-z]:[\\/][^\s'"]*/g, '[path]')
    .replace(/(?:^|\s)\/(?:[^\s/'"]+\/)+[^\s'"]*/g, ' [path]')
    .replace(/[\p{Cc}\p{Cf}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const errorMessageCharacters = Array.from(cleanedErrorMessage)
  return errorMessageCharacters.length <= papelizPdfExportErrorMessageLength
    ? cleanedErrorMessage
    : `${errorMessageCharacters.slice(0, papelizPdfExportErrorMessageLength - 1).join('')}…`
}

// The plain line the Export page shows after "The export stopped: ".
export function describePapelizPdfExportFailure(pdfExportErrorCode: PapelizPdfExportErrorCode, pdfExportFileName: string): string {
  switch (pdfExportErrorCode) {
    case 'pdf-export-cancelled':
      return 'it was cancelled'
    case 'pdf-export-limit-reached':
      return `“${pdfExportFileName}” is larger than one PDF can hold`
    case 'pdf-export-font-unreadable':
      return `a font for “${pdfExportFileName}” couldn’t be read; try again`
    case 'pdf-export-worker-timed-out':
      return `writing “${pdfExportFileName}” took too long`
    default:
      return `couldn’t write “${pdfExportFileName}”; try again, or export it as Word`
  }
}
