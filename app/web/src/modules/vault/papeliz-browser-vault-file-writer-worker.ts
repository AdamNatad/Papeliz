import type { PapelizBrowserVaultFileWriteRequest, PapelizBrowserVaultFileWriteResponse } from './papeliz-browser-vault-file-writer-messages'
import { writePapelizVaultFileThroughSyncAccessHandle, type PapelizFileHandleWithSyncAccess } from './papeliz-browser-vault-sync-access-write'

// Writes browser vault files where the page can't (Safari before 26 has no createWritable()): it
// finds the file from the Origin Private File System's root and writes it through a sync access
// handle. The app's TypeScript setup uses the page's DOM types, so the worker's own scope is
// described here by what it uses.
interface PapelizBrowserVaultFileWriterWorkerScope {
  addEventListener(eventType: 'message', messageListener: (messageEvent: MessageEvent<PapelizBrowserVaultFileWriteRequest>) => void): void
  postMessage(browserVaultFileWriteResponse: PapelizBrowserVaultFileWriteResponse): void
}

const papelizBrowserVaultFileWriterWorkerScope = self as unknown as PapelizBrowserVaultFileWriterWorkerScope

async function writeRequestedBrowserVaultFile(browserVaultFileWriteRequest: PapelizBrowserVaultFileWriteRequest): Promise<void> {
  const browserVaultFileName = browserVaultFileWriteRequest.browserVaultFilePathSegments.at(-1)
  if (browserVaultFileName === undefined) throw new DOMException('No file was named.', 'NotFoundError')
  let browserVaultFolderHandle = await navigator.storage.getDirectory()
  for (const browserVaultFolderName of browserVaultFileWriteRequest.browserVaultFilePathSegments.slice(0, -1)) {
    browserVaultFolderHandle = await browserVaultFolderHandle.getDirectoryHandle(browserVaultFolderName)
  }
  const browserVaultFileHandle = await browserVaultFolderHandle.getFileHandle(browserVaultFileName, { create: true })
  await writePapelizVaultFileThroughSyncAccessHandle(
    browserVaultFileHandle as unknown as PapelizFileHandleWithSyncAccess,
    new Uint8Array(browserVaultFileWriteRequest.browserVaultFileBytes),
  )
}

papelizBrowserVaultFileWriterWorkerScope.addEventListener('message', (messageEvent) => {
  const browserVaultFileWriteRequest = messageEvent.data
  writeRequestedBrowserVaultFile(browserVaultFileWriteRequest).then(
    () =>
      papelizBrowserVaultFileWriterWorkerScope.postMessage({
        browserVaultFileWriteRequestId: browserVaultFileWriteRequest.browserVaultFileWriteRequestId,
        browserVaultFileWriteErrorName: null,
        browserVaultFileWriteErrorMessage: null,
      }),
    (browserVaultFileWriteError: unknown) =>
      papelizBrowserVaultFileWriterWorkerScope.postMessage({
        browserVaultFileWriteRequestId: browserVaultFileWriteRequest.browserVaultFileWriteRequestId,
        browserVaultFileWriteErrorName: browserVaultFileWriteError instanceof Error ? browserVaultFileWriteError.name : 'UnknownError',
        browserVaultFileWriteErrorMessage: browserVaultFileWriteError instanceof Error ? browserVaultFileWriteError.message : String(browserVaultFileWriteError),
      }),
  )
})
