import { deletePapelizBrowserVault, listPapelizBrowserVaults, openPapelizBrowserVault, setPapelizBrowserVaultHidden, type PapelizBrowserVaultRecord } from './papeliz-browser-vaults'
import { reopenRememberedPapelizVaultFolder, type PapelizOpenVaultResult } from './papeliz-open-vault'
import {
  deleteRememberedVaultFolderFromDisk,
  listRememberedVaultFolders,
  setRememberedVaultFolderHidden,
  type PapelizRememberedVaultFolder,
} from './papeliz-remembered-vault-folders'

// The start screen's Recent vaults and Hidden list hold both kinds of vault: folders on disk and
// browser vaults. Each row carries what its own kind needs, and these functions send each to its own.

export type PapelizRecentVault =
  | (PapelizRememberedVaultFolder & { papelizRecentVaultKind: 'folder-on-disk' })
  | (PapelizBrowserVaultRecord & { papelizRecentVaultKind: 'browser-vault-in-opfs' })

export function isPapelizRecentVaultHidden(recentVault: PapelizRecentVault): boolean {
  return (recentVault.papelizVaultHiddenAt ?? null) !== null
}

// Both kinds, most recently opened first. A kind that can't be read here (no folder access, browser
// storage off) adds nothing.
export async function listPapelizRecentVaults(isBrowserVaultListRead: boolean): Promise<PapelizRecentVault[]> {
  const [rememberedVaultFolders, browserVaultRecords] = await Promise.all([
    listRememberedVaultFolders().catch((): PapelizRememberedVaultFolder[] => []),
    isBrowserVaultListRead ? listPapelizBrowserVaults().catch((): PapelizBrowserVaultRecord[] => []) : Promise.resolve([]),
  ])
  const recentVaults: PapelizRecentVault[] = [
    ...rememberedVaultFolders.map((rememberedVaultFolder) => ({ ...rememberedVaultFolder, papelizRecentVaultKind: 'folder-on-disk' as const })),
    ...browserVaultRecords.map((browserVaultRecord) => ({ ...browserVaultRecord, papelizRecentVaultKind: 'browser-vault-in-opfs' as const })),
  ]
  return recentVaults.sort((firstRecentVault, secondRecentVault) => secondRecentVault.papelizVaultLastOpenedAt - firstRecentVault.papelizVaultLastOpenedAt)
}

// Hides a vault from Recent vaults into the Hidden list, or restores it; its notes stay.
export function setPapelizRecentVaultHidden(recentVault: PapelizRecentVault, isRecentVaultHidden: boolean): Promise<void> {
  return recentVault.papelizRecentVaultKind === 'folder-on-disk'
    ? setRememberedVaultFolderHidden(recentVault, isRecentVaultHidden)
    : setPapelizBrowserVaultHidden(recentVault, isRecentVaultHidden)
}

// Opens a vault from the list. A folder may ask for permission again, so run it from a click.
export function reopenPapelizRecentVault(recentVault: PapelizRecentVault): Promise<PapelizOpenVaultResult> {
  return recentVault.papelizRecentVaultKind === 'folder-on-disk' ? reopenRememberedPapelizVaultFolder(recentVault) : openPapelizBrowserVault(recentVault)
}

export type PapelizRecentVaultDeleteResult =
  | { recentVaultDeleteOutcome: 'deleted' }
  | { recentVaultDeleteOutcome: 'failed'; recentVaultDeleteFailureMessage: string }

// Delete in the Hidden list: a folder is erased from the disk, a browser vault from this browser.
export async function deletePapelizRecentVault(recentVault: PapelizRecentVault): Promise<PapelizRecentVaultDeleteResult> {
  if (recentVault.papelizRecentVaultKind === 'folder-on-disk') {
    const vaultFolderDeleteResult = await deleteRememberedVaultFolderFromDisk(recentVault)
    return vaultFolderDeleteResult.vaultFolderDeleteOutcome === 'deleted'
      ? { recentVaultDeleteOutcome: 'deleted' }
      : { recentVaultDeleteOutcome: 'failed', recentVaultDeleteFailureMessage: vaultFolderDeleteResult.vaultFolderDeleteFailureMessage }
  }
  const browserVaultDeleteResult = await deletePapelizBrowserVault(recentVault)
  return browserVaultDeleteResult.browserVaultDeleteOutcome === 'deleted'
    ? { recentVaultDeleteOutcome: 'deleted' }
    : { recentVaultDeleteOutcome: 'failed', recentVaultDeleteFailureMessage: browserVaultDeleteResult.browserVaultDeleteFailureMessage }
}
