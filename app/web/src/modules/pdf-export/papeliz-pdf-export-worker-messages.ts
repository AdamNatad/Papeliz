import type { PapelizPdfExportErrorCode } from './papeliz-pdf-export-errors'
import type { PapelizPdfExportNotePdfJob } from './papeliz-pdf-export-note-pdf'

// The messages between the Export page's thread and the PDF worker. One request per note, each with
// its own id; bytes travel as transferred buffers both ways, never copied.

export interface PapelizPdfExportWriteNoteRequest {
  pdfExportMessageKind: 'write-note-pdf'
  pdfExportRequestId: string
  pdfExportNotePdfJob: PapelizPdfExportNotePdfJob
}

export type PapelizPdfExportWorkerReply =
  | { pdfExportMessageKind: 'note-pdf-progress'; pdfExportRequestId: string; drawnPageCount: number; pdfPageCount: number }
  | { pdfExportMessageKind: 'note-pdf-written'; pdfExportRequestId: string; pdfFileBytes: Uint8Array; pdfPageCount: number; pdfExportNoteNotices: string[] }
  | { pdfExportMessageKind: 'note-pdf-failed'; pdfExportRequestId: string; pdfExportErrorCode: PapelizPdfExportErrorCode; pdfExportErrorMessage: string }
