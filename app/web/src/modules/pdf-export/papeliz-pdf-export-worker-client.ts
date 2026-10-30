import { cleanPapelizPdfExportErrorMessage, isPapelizPdfExportErrorCode, PapelizPdfExportError } from './papeliz-pdf-export-errors'
import type { PapelizPdfExportNotePdf, PapelizPdfExportNotePdfJob } from './papeliz-pdf-export-note-pdf'
import type { PapelizPdfExportWorkerReply, PapelizPdfExportWriteNoteRequest } from './papeliz-pdf-export-worker-messages'

// The page's side of the PDF worker: one worker for a whole export, notes one at a time. The worker
// owns pdfkit, so it never loads on the page's thread. Cancel and the time limits end the worker;
// a later export starts a new one.

export interface PapelizPdfExportNotePdfWriter {
  writeNotePdf(
    notePdfJob: PapelizPdfExportNotePdfJob,
    onNotePdfProgress: (drawnPageCount: number, pdfPageCount: number) => void,
    pdfExportAbortSignal: AbortSignal | undefined,
  ): Promise<PapelizPdfExportNotePdf>
  closeNotePdfWriter(): void
}

// The worker must answer within this long each time, and finish a note within the other.
export const papelizPdfExportWorkerQuietLimitMilliseconds = 30_000
export const papelizPdfExportWorkerNoteLimitMilliseconds = 5 * 60_000

export function createPapelizPdfExportAbortError(): DOMException {
  return new DOMException('The PDF export was cancelled.', 'AbortError')
}

function createWorkerNotePdfWriter(): PapelizPdfExportNotePdfWriter {
  let pdfExportWorker: Worker | null = null
  let nextPdfExportRequestNumber = 1
  const closeWorker = () => {
    pdfExportWorker?.terminate()
    pdfExportWorker = null
  }
  return {
    writeNotePdf: (notePdfJob, onNotePdfProgress, pdfExportAbortSignal) =>
      new Promise<PapelizPdfExportNotePdf>((resolveNotePdf, rejectNotePdf) => {
        if (pdfExportAbortSignal?.aborted) {
          rejectNotePdf(createPapelizPdfExportAbortError())
          return
        }
        pdfExportWorker ??= new Worker(new URL('./papeliz-pdf-export-worker.ts', import.meta.url), { type: 'module', name: 'papeliz-pdf-export' })
        const activePdfExportWorker = pdfExportWorker
        const pdfExportRequestId = `note-${nextPdfExportRequestNumber++}`
        let quietTimer = 0
        const finishRequest = () => {
          window.clearTimeout(quietTimer)
          window.clearTimeout(noteTimer)
          activePdfExportWorker.removeEventListener('message', onWorkerMessage)
          activePdfExportWorker.removeEventListener('error', onWorkerError)
          activePdfExportWorker.removeEventListener('messageerror', onWorkerMessageError)
          pdfExportAbortSignal?.removeEventListener('abort', onExportAbort)
        }
        const failRequest = (requestError: Error) => {
          finishRequest()
          closeWorker()
          rejectNotePdf(requestError)
        }
        const restartQuietTimer = () => {
          window.clearTimeout(quietTimer)
          quietTimer = window.setTimeout(
            () => failRequest(new PapelizPdfExportError('pdf-export-worker-timed-out', 'The PDF worker stopped answering.')),
            papelizPdfExportWorkerQuietLimitMilliseconds,
          )
        }
        const noteTimer = window.setTimeout(
          () => failRequest(new PapelizPdfExportError('pdf-export-worker-timed-out', 'One note took longer than its time limit.')),
          papelizPdfExportWorkerNoteLimitMilliseconds,
        )
        const onWorkerMessage = (messageEvent: MessageEvent<PapelizPdfExportWorkerReply>) => {
          const workerReply = messageEvent.data
          if (workerReply?.pdfExportRequestId !== pdfExportRequestId) return
          restartQuietTimer()
          if (workerReply.pdfExportMessageKind === 'note-pdf-progress') {
            onNotePdfProgress(workerReply.drawnPageCount, workerReply.pdfPageCount)
            return
          }
          finishRequest()
          if (workerReply.pdfExportMessageKind === 'note-pdf-written') {
            resolveNotePdf({ pdfFileBytes: workerReply.pdfFileBytes, pdfPageCount: workerReply.pdfPageCount, pdfExportNoteNotices: workerReply.pdfExportNoteNotices })
            return
          }
          const pdfExportErrorCode = isPapelizPdfExportErrorCode(workerReply.pdfExportErrorCode) ? workerReply.pdfExportErrorCode : 'pdf-export-worker-failed'
          rejectNotePdf(new PapelizPdfExportError(pdfExportErrorCode, cleanPapelizPdfExportErrorMessage(String(workerReply.pdfExportErrorMessage))))
        }
        const onWorkerError = (errorEvent: ErrorEvent) => failRequest(new PapelizPdfExportError('pdf-export-worker-failed', cleanPapelizPdfExportErrorMessage(errorEvent.message || 'The PDF worker failed.')))
        const onWorkerMessageError = () => failRequest(new PapelizPdfExportError('pdf-export-worker-failed', 'A reply from the PDF worker couldn’t be read.'))
        const onExportAbort = () => failRequest(createPapelizPdfExportAbortError())
        activePdfExportWorker.addEventListener('message', onWorkerMessage)
        activePdfExportWorker.addEventListener('error', onWorkerError)
        activePdfExportWorker.addEventListener('messageerror', onWorkerMessageError)
        pdfExportAbortSignal?.addEventListener('abort', onExportAbort)
        restartQuietTimer()
        const writeNoteRequest: PapelizPdfExportWriteNoteRequest = { pdfExportMessageKind: 'write-note-pdf', pdfExportRequestId, pdfExportNotePdfJob: notePdfJob }
        // The font bytes are copied per note, since the next note needs them too; the note's own
        // PDF comes back without a copy.
        activePdfExportWorker.postMessage(writeNoteRequest)
      }),
    closeNotePdfWriter: closeWorker,
  }
}

export function createPapelizPdfExportNotePdfWriter(): PapelizPdfExportNotePdfWriter {
  return createWorkerNotePdfWriter()
}
