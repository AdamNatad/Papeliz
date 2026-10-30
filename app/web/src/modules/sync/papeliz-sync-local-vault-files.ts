import { PapelizVaultOperationError, type PapelizVaultAdapter } from '../vault/papeliz-vault-adapter'
import type { PapelizSyncLocalVaultFiles, PapelizSyncLocalVaultFileStat } from './papeliz-sync-engine-contract'

// What a vault adapter adds so Sync can read and write any of its files whole, with their sizes and
// times (the same names as the engine's own `PapelizSyncLocalVaultFiles`). An adapter that lacks them
// can't sync yet: the engine's reads fail with "Not Supported Yet".
interface PapelizSyncVaultAdapterWholeFileAccess {
  listSyncableVaultFileStats(): Promise<PapelizSyncLocalVaultFileStat[]>
  readVaultFileBytes(vaultFileRelativePath: string): Promise<Uint8Array>
  writeVaultFileBytes(vaultFileRelativePath: string, vaultFileBytes: Uint8Array): Promise<void>
}

export function hasPapelizSyncVaultAdapterWholeFileAccess(
  papelizVaultAdapter: PapelizVaultAdapter,
): papelizVaultAdapter is PapelizVaultAdapter & PapelizSyncVaultAdapterWholeFileAccess {
  const vaultAdapterMethods = papelizVaultAdapter as Partial<PapelizSyncVaultAdapterWholeFileAccess>
  return (
    typeof vaultAdapterMethods.listSyncableVaultFileStats === 'function' &&
    typeof vaultAdapterMethods.readVaultFileBytes === 'function' &&
    typeof vaultAdapterMethods.writeVaultFileBytes === 'function'
  )
}

function rejectWithoutWholeFileAccess(): Promise<never> {
  return Promise.reject(new PapelizVaultOperationError('Not Supported Yet'))
}

// The open vault's files as the engine reads and writes them: through the vault's own adapter, so
// open notes and other tabs see Sync's writes like any other change. Renames and the trash use the
// adapter's own.
export function createPapelizSyncLocalVaultFiles(papelizVaultAdapter: PapelizVaultAdapter): PapelizSyncLocalVaultFiles {
  if (!hasPapelizSyncVaultAdapterWholeFileAccess(papelizVaultAdapter)) {
    return {
      listSyncableVaultFileStats: rejectWithoutWholeFileAccess,
      readVaultFileBytes: rejectWithoutWholeFileAccess,
      writeVaultFileBytes: rejectWithoutWholeFileAccess,
      renameVaultFile: (fromVaultFileRelativePath, toVaultFileRelativePath) => papelizVaultAdapter.renameVaultEntry(fromVaultFileRelativePath, toVaultFileRelativePath),
      moveVaultFileToTrash: (vaultFileRelativePath) => papelizVaultAdapter.moveVaultEntryToTrash(vaultFileRelativePath),
    }
  }
  return {
    listSyncableVaultFileStats: () => papelizVaultAdapter.listSyncableVaultFileStats(),
    readVaultFileBytes: (vaultFileRelativePath) => papelizVaultAdapter.readVaultFileBytes(vaultFileRelativePath),
    writeVaultFileBytes: (vaultFileRelativePath, vaultFileBytes) => papelizVaultAdapter.writeVaultFileBytes(vaultFileRelativePath, vaultFileBytes),
    renameVaultFile: (fromVaultFileRelativePath, toVaultFileRelativePath) => papelizVaultAdapter.renameVaultEntry(fromVaultFileRelativePath, toVaultFileRelativePath),
    moveVaultFileToTrash: (vaultFileRelativePath) => papelizVaultAdapter.moveVaultEntryToTrash(vaultFileRelativePath),
  }
}
