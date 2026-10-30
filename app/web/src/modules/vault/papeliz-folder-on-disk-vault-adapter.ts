import { PapelizDirectoryHandleVaultAdapter, writeVaultFileContentsThroughWritableStream } from './papeliz-directory-handle-vault-adapter'

// A vault that is a real folder on the user's disk, opened with the File System Access API
// (Chrome and Edge). Notes are written in place with createWritable(); the rest is shared with the
// browser vault (papeliz-directory-handle-vault-adapter.ts).
export class PapelizFolderOnDiskVaultAdapter extends PapelizDirectoryHandleVaultAdapter {
  override readonly papelizVaultKind = 'folder-on-disk' as const

  constructor(vaultRootFolderHandle: FileSystemDirectoryHandle) {
    super(vaultRootFolderHandle, writeVaultFileContentsThroughWritableStream)
  }
}
