// What the page and the browser vault's file-writing worker say to each other.

export interface PapelizBrowserVaultFileWriteRequest {
  browserVaultFileWriteRequestId: number
  // From the Origin Private File System's root to the file, as `resolve()` gives them.
  browserVaultFilePathSegments: string[]
  browserVaultFileBytes: ArrayBuffer
}

export interface PapelizBrowserVaultFileWriteResponse {
  browserVaultFileWriteRequestId: number
  // Null when the file was written; else the DOMException's name and message, rebuilt on the page.
  browserVaultFileWriteErrorName: string | null
  browserVaultFileWriteErrorMessage: string | null
}
