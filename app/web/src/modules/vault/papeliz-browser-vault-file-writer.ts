import type { PapelizVaultFileContentsWriter } from './papeliz-directory-handle-vault-adapter'
import { writeVaultFileContentsThroughWritableStream } from './papeliz-directory-handle-vault-adapter'
import type { PapelizBrowserVaultFileWriteRequest, PapelizBrowserVaultFileWriteResponse } from './papeliz-browser-vault-file-writer-messages'
import { PapelizVaultOperationError } from './papeliz-vault-adapter'

// How a browser vault writes a file. Chrome, Edge, Firefox and Safari 26 and later use
// createWritable(), which swaps the new contents in whole on close(). Safari 16.4 to 18 have no
// createWritable(): a worker writes the file through a sync access handle instead.

export type PapelizBrowserVaultWorkerFileWriter = (vaultFileHandle: FileSystemFileHandle, vaultFileBytes: Uint8Array) => Promise<void>

export interface PapelizBrowserVaultFileContentsWriterOptions {
  // Whether this file handle has createWritable(); tests turn it off to take the worker's path.
  isWritableStreamOnFileHandle?: (vaultFileHandle: FileSystemFileHandle) => boolean
  writeVaultFileThroughWorker?: PapelizBrowserVaultWorkerFileWriter
}

export function isWritableStreamOnPapelizFileHandle(vaultFileHandle: FileSystemFileHandle): boolean {
  return typeof (vaultFileHandle as Partial<FileSystemFileHandle>).createWritable === 'function'
}

let papelizBrowserVaultFileWriterWorker: Worker | null = null
let nextBrowserVaultFileWriteRequestId = 1
const pendingBrowserVaultFileWritesByRequestId = new Map<number, { resolveFileWrite: () => void; rejectFileWrite: (fileWriteError: unknown) => void }>()

function getPapelizBrowserVaultFileWriterWorker(): Worker {
  if (papelizBrowserVaultFileWriterWorker !== null) return papelizBrowserVaultFileWriterWorker
  papelizBrowserVaultFileWriterWorker = new Worker(new URL('./papeliz-browser-vault-file-writer-worker.ts', import.meta.url), { type: 'module' })
  papelizBrowserVaultFileWriterWorker.addEventListener('message', (messageEvent: MessageEvent<PapelizBrowserVaultFileWriteResponse>) => {
    const browserVaultFileWriteResponse = messageEvent.data
    const pendingBrowserVaultFileWrite = pendingBrowserVaultFileWritesByRequestId.get(browserVaultFileWriteResponse.browserVaultFileWriteRequestId)
    pendingBrowserVaultFileWritesByRequestId.delete(browserVaultFileWriteResponse.browserVaultFileWriteRequestId)
    if (pendingBrowserVaultFileWrite === undefined) return
    if (browserVaultFileWriteResponse.browserVaultFileWriteErrorName === null) pendingBrowserVaultFileWrite.resolveFileWrite()
    else {
      pendingBrowserVaultFileWrite.rejectFileWrite(
        new DOMException(browserVaultFileWriteResponse.browserVaultFileWriteErrorMessage ?? '', browserVaultFileWriteResponse.browserVaultFileWriteErrorName),
      )
    }
  })
  return papelizBrowserVaultFileWriterWorker
}

// The worker finds the file again from the Origin Private File System's root, by the path
// `resolve()` gives.
const writePapelizBrowserVaultFileThroughWorker: PapelizBrowserVaultWorkerFileWriter = async (vaultFileHandle, vaultFileBytes) => {
  const originPrivateFileSystemRoot = await navigator.storage.getDirectory()
  const browserVaultFilePathSegments = await originPrivateFileSystemRoot.resolve(vaultFileHandle)
  if (browserVaultFilePathSegments === null) throw new PapelizVaultOperationError('File Not Found')
  const browserVaultFileBytes = vaultFileBytes.slice().buffer
  await new Promise<void>((resolveFileWrite, rejectFileWrite) => {
    const browserVaultFileWriteRequestId = nextBrowserVaultFileWriteRequestId++
    pendingBrowserVaultFileWritesByRequestId.set(browserVaultFileWriteRequestId, { resolveFileWrite, rejectFileWrite })
    const browserVaultFileWriteRequest: PapelizBrowserVaultFileWriteRequest = { browserVaultFileWriteRequestId, browserVaultFilePathSegments, browserVaultFileBytes }
    getPapelizBrowserVaultFileWriterWorker().postMessage(browserVaultFileWriteRequest, [browserVaultFileBytes])
  })
}

// A full browser storage says so in the browser's own words ("Browser Storage Full"), not a full disk.
function describeBrowserVaultWriteError(browserVaultWriteError: unknown): unknown {
  const browserVaultWriteErrorName = (browserVaultWriteError as { name?: unknown } | null)?.name
  return browserVaultWriteErrorName === 'QuotaExceededError' ? new PapelizVaultOperationError('Browser Storage Full') : browserVaultWriteError
}

export function createPapelizBrowserVaultFileContentsWriter(writerOptions: PapelizBrowserVaultFileContentsWriterOptions = {}): PapelizVaultFileContentsWriter {
  const isWritableStreamOnFileHandle = writerOptions.isWritableStreamOnFileHandle ?? isWritableStreamOnPapelizFileHandle
  const writeVaultFileThroughWorker = writerOptions.writeVaultFileThroughWorker ?? writePapelizBrowserVaultFileThroughWorker
  return async (vaultFileHandle, vaultFileContents) => {
    try {
      if (isWritableStreamOnFileHandle(vaultFileHandle)) {
        await writeVaultFileContentsThroughWritableStream(vaultFileHandle, vaultFileContents)
        return
      }
      const vaultFileBytes =
        typeof vaultFileContents === 'string' ? new TextEncoder().encode(vaultFileContents) : new Uint8Array(await vaultFileContents.arrayBuffer())
      await writeVaultFileThroughWorker(vaultFileHandle, vaultFileBytes)
    } catch (browserVaultWriteError) {
      throw describeBrowserVaultWriteError(browserVaultWriteError)
    }
  }
}
