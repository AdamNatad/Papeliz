import { PapelizDirectoryHandleVaultAdapter, type PapelizVaultFileContentsWriter } from './papeliz-directory-handle-vault-adapter'
import { createPapelizBrowserVaultFileContentsWriter } from './papeliz-browser-vault-file-writer'
import { runPapelizBrowserVaultChangeExclusively, type PapelizBrowserVaultLockManager } from './papeliz-browser-vault-locks'

export interface PapelizBrowserVaultAdapterOptions {
  papelizVaultId: string
  browserVaultLockManager: PapelizBrowserVaultLockManager | null
  // Called after every change written into the vault, so the backup reminder knows.
  onBrowserVaultChanged: () => void
  // Lets go of the vault's open lock (papeliz-browser-vault-locks.ts).
  releaseBrowserVaultOpenLock: () => void
  // Tests give their own; the browser's choice otherwise (papeliz-browser-vault-file-writer.ts).
  vaultFileContentsWriter?: PapelizVaultFileContentsWriter
}

// A browser vault: a vault kept in this browser's Origin Private File System, in the folder
// `papeliz-browser-vaults/<papelizVaultId>/` (papeliz-browser-vaults.ts). It is laid out exactly like a
// folder on disk, so everything but writing files is shared with the folder vault. Changes run under
// the vault's writes lock, so the tabs of this browser take turns.
export class PapelizBrowserVaultAdapter extends PapelizDirectoryHandleVaultAdapter {
  override readonly papelizVaultKind = 'browser-vault-in-opfs' as const

  constructor(
    browserVaultRootFolderHandle: FileSystemDirectoryHandle,
    private readonly browserVaultAdapterOptions: PapelizBrowserVaultAdapterOptions,
  ) {
    super(browserVaultRootFolderHandle, browserVaultAdapterOptions.vaultFileContentsWriter ?? createPapelizBrowserVaultFileContentsWriter())
  }

  protected override noteVaultChanged(): void {
    this.browserVaultAdapterOptions.onBrowserVaultChanged()
  }

  runVaultChangeExclusively<VaultChangeResult>(vaultChange: () => Promise<VaultChangeResult>): Promise<VaultChangeResult> {
    return runPapelizBrowserVaultChangeExclusively(this.browserVaultAdapterOptions.browserVaultLockManager, this.browserVaultAdapterOptions.papelizVaultId, vaultChange)
  }

  closeVaultAdapter(): void {
    this.browserVaultAdapterOptions.releaseBrowserVaultOpenLock()
  }
}
