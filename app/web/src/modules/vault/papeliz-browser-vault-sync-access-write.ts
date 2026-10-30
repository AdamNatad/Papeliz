// Writing a file through a sync access handle, the only way Safari before 26 writes into the Origin
// Private File System. Only a dedicated worker has these handles
// (papeliz-browser-vault-file-writer-worker.ts). The app's TypeScript setup uses the page's DOM
// types, so the handle is described here by what Papeliz uses. Safari before 16.4 returned promises
// from truncate, flush and close; awaiting each covers both.

export interface PapelizFileSyncAccessHandle {
  getSize(): number | Promise<number>
  read(readIntoBytes: Uint8Array, readOptions?: { at?: number }): number
  truncate(newFileByteCount: number): void | Promise<void>
  write(writtenBytes: Uint8Array, writeOptions?: { at?: number }): number
  flush(): void | Promise<void>
  close(): void | Promise<void>
}

export interface PapelizFileHandleWithSyncAccess {
  createSyncAccessHandle(): Promise<PapelizFileSyncAccessHandle>
}

// Replaces the file's contents with `vaultFileBytes`. The handle locks the file until it closes, so
// another handle or writable on it fails meanwhile; the vault's write lock keeps tabs from meeting
// here. It isn't atomic, so a write that fails (a full storage) puts the old bytes back, and the
// note's recovery copy covers a crash between truncate and write.
export async function writePapelizVaultFileThroughSyncAccessHandle(vaultFileHandle: PapelizFileHandleWithSyncAccess, vaultFileBytes: Uint8Array): Promise<void> {
  const vaultFileSyncAccessHandle = await vaultFileHandle.createSyncAccessHandle()
  try {
    const previousVaultFileBytes = new Uint8Array(await vaultFileSyncAccessHandle.getSize())
    vaultFileSyncAccessHandle.read(previousVaultFileBytes, { at: 0 })
    try {
      await replaceVaultFileBytes(vaultFileSyncAccessHandle, vaultFileBytes)
    } catch (vaultFileWriteError) {
      await replaceVaultFileBytes(vaultFileSyncAccessHandle, previousVaultFileBytes).catch(() => undefined)
      throw vaultFileWriteError
    }
  } finally {
    await vaultFileSyncAccessHandle.close()
  }
}

async function replaceVaultFileBytes(vaultFileSyncAccessHandle: PapelizFileSyncAccessHandle, vaultFileBytes: Uint8Array): Promise<void> {
  await vaultFileSyncAccessHandle.truncate(0)
  let writtenByteCount = 0
  while (writtenByteCount < vaultFileBytes.length) {
    const justWrittenByteCount = vaultFileSyncAccessHandle.write(vaultFileBytes.subarray(writtenByteCount), { at: writtenByteCount })
    if (justWrittenByteCount <= 0) throw new DOMException('The file took no more bytes.', 'QuotaExceededError')
    writtenByteCount += justWrittenByteCount
  }
  await vaultFileSyncAccessHandle.flush()
}
