import { cleanPapelizPdfExportErrorMessage, PapelizPdfExportError } from './papeliz-pdf-export-errors'
import { writePapelizPdfExportNotePdf } from './papeliz-pdf-export-note-pdf'
import type { PapelizPdfExportWorkerReply, PapelizPdfExportWriteNoteRequest } from './papeliz-pdf-export-worker-messages'

// The PDF worker: lays out and writes one note's PDF per request, off the page's thread, so the app
// keeps answering. It receives everything as bytes and makes no request of its own. Cancel ends the
// whole worker (papeliz-pdf-export-worker-client.ts).

const papelizPdfExportWorkerScope = self as unknown as {
  addEventListener(eventName: 'message', onMessage: (messageEvent: MessageEvent<PapelizPdfExportWriteNoteRequest>) => void): void
  postMessage(workerReply: PapelizPdfExportWorkerReply, transferredObjects?: Transferable[]): void
}

function replyToPage(workerReply: PapelizPdfExportWorkerReply, transferredObjects: Transferable[] = []): void {
  papelizPdfExportWorkerScope.postMessage(workerReply, transferredObjects)
}

papelizPdfExportWorkerScope.addEventListener('message', (messageEvent) => {
  const writeNoteRequest = messageEvent.data
  if (writeNoteRequest?.pdfExportMessageKind !== 'write-note-pdf') return
  const { pdfExportRequestId } = writeNoteRequest
  void writePapelizPdfExportNotePdf(writeNoteRequest.pdfExportNotePdfJob, {
    onPdfExportNoteProgress: (drawnPageCount, pdfPageCount) => replyToPage({ pdfExportMessageKind: 'note-pdf-progress', pdfExportRequestId, drawnPageCount, pdfPageCount }),
  }).then(
    ({ pdfFileBytes, pdfPageCount, pdfExportNoteNotices }) =>
      replyToPage({ pdfExportMessageKind: 'note-pdf-written', pdfExportRequestId, pdfFileBytes, pdfPageCount, pdfExportNoteNotices }, [pdfFileBytes.buffer as ArrayBuffer]),
    (notePdfError: unknown) =>
      replyToPage({
        pdfExportMessageKind: 'note-pdf-failed',
        pdfExportRequestId,
        pdfExportErrorCode: notePdfError instanceof PapelizPdfExportError ? notePdfError.pdfExportErrorCode : 'pdf-export-writer-failed',
        pdfExportErrorMessage: cleanPapelizPdfExportErrorMessage(notePdfError instanceof Error ? notePdfError.message : String(notePdfError)),
      }),
  )
})
