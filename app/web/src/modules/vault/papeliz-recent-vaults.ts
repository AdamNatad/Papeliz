import { deletePapelizBrowserVault, listPapelizBrowserVaults, openPapelizBrowserVault, setPapelizBrowserVaultHidden, type PapelizBrowserVaultRecord } from './papeliz-browser-vaults'
import { reopenRememberedPapelizVaultFolder, type PapelizExistingVaultOpenResult } from './papeliz-open-vault'
import {
  deleteRememberedVaultFolderFromDisk,
  isRememberedDesktopPathVaultFolder,
  listRememberedVaultFolders,
  setRememberedVaultFolderHidden,
  type PapelizRememberedBrowserHandleVaultFolder,
  type PapelizRememberedDesktopPathVaultFolder,
  type PapelizRememberedVaultFolder,
} from './papeliz-remembered-vault-folders'
import { findPapelizLockedEndToEndVault, isPapelizVaultEncryptionKeyRememberedOnThisDevice, type PapelizVaultEncryptionKind } from './papeliz-vault-encryption'
import { readPapelizRecentVaultEncryptionKindRecords } from './papeliz-vault-encryption-device-store'

// The start screen's Recent vaults and Hidden list hold every kind of vault: folders on disk and
// browser vaults, and in Papeliz for Windows folders by path. Each row carries what its own kind
// needs, and these functions send each to its own.

// A row's encryption as this device last saw it (papeliz-vault-encryption.ts), kept here since the
// vault's own `.papeliz/vault-encryption.json` can't be read before the folder is opened again. A row
// without it is a Standard vault, or one not opened since Papeliz knew about encryption.
export interface PapelizRecentVaultEncryption {
  papelizVaultEncryptionKind: PapelizVaultEncryptionKind
  // An End-to-end vault's own ID; null for a Standard one.
  papelizEncryptedVaultId: string | null
  // An End-to-end vault whose key this device remembers: the start screen's "Remembered" chip.
  isVaultEncryptionKeyRememberedOnThisDevice: boolean
}

interface PapelizRecentVaultEncryptionListing {
  papelizRecentVaultEncryption?: PapelizRecentVaultEncryption
}

// A folder opened in the browser, or a browser vault: what the browser's own flows (Sync's downloads
// among them) work with.
export type PapelizRecentVault =
  | (PapelizRememberedBrowserHandleVaultFolder & PapelizRecentVaultEncryptionListing & { papelizRecentVaultKind: 'folder-on-disk' })
  | (PapelizBrowserVaultRecord & PapelizRecentVaultEncryptionListing & { papelizRecentVaultKind: 'browser-vault-in-opfs' })

// A folder opened in Papeliz for Windows, remembered by its path.
export type PapelizRecentDesktopFolderVault = PapelizRememberedDesktopPathVaultFolder &
  PapelizRecentVaultEncryptionListing & { papelizRecentVaultKind: 'desktop-folder-on-disk' }

// Any row of the start screen's lists.
export type PapelizStartScreenRecentVault = PapelizRecentVault | PapelizRecentDesktopFolderVault

export function isPapelizRecentDesktopFolderVault(recentVault: PapelizStartScreenRecentVault): recentVault is PapelizRecentDesktopFolderVault {
  return recentVault.papelizRecentVaultKind === 'desktop-folder-on-disk'
}

export function isPapelizRecentVaultHidden(recentVault: PapelizStartScreenRecentVault): boolean {
  return (recentVault.papelizVaultHiddenAt ?? null) !== null
}

function describeRememberedVaultFolderAsRecentVault(rememberedVaultFolder: PapelizRememberedVaultFolder): PapelizStartScreenRecentVault {
  return isRememberedDesktopPathVaultFolder(rememberedVaultFolder)
    ? { ...rememberedVaultFolder, papelizRecentVaultKind: 'desktop-folder-on-disk' }
    : { ...rememberedVaultFolder, papelizRecentVaultKind: 'folder-on-disk' }
}

// Every kind, most recently opened first. A kind that can't be read here (no folder access, browser
// storage off, a folder by path outside Papeliz for Windows) adds nothing.
export async function listPapelizRecentVaults(isBrowserVaultListRead: boolean): Promise<PapelizStartScreenRecentVault[]> {
  const [rememberedVaultFolders, browserVaultRecords] = await Promise.all([
    listRememberedVaultFolders().catch((): PapelizRememberedVaultFolder[] => []),
    isBrowserVaultListRead ? listPapelizBrowserVaults().catch((): PapelizBrowserVaultRecord[] => []) : Promise.resolve([]),
  ])
  const recentVaults: PapelizStartScreenRecentVault[] = [
    ...rememberedVaultFolders.map(describeRememberedVaultFolderAsRecentVault),
    ...browserVaultRecords.map((browserVaultRecord) => ({ ...browserVaultRecord, papelizRecentVaultKind: 'browser-vault-in-opfs' as const })),
  ]
  const recentVaultsWithEncryption = await addPapelizRecentVaultEncryption(recentVaults)
  return recentVaultsWithEncryption.sort((firstRecentVault, secondRecentVault) => secondRecentVault.papelizVaultLastOpenedAt - firstRecentVault.papelizVaultLastOpenedAt)
}

// Each row's kind as this device last found it, and whether an End-to-end vault's key is remembered.
async function addPapelizRecentVaultEncryption(recentVaults: PapelizStartScreenRecentVault[]): Promise<PapelizStartScreenRecentVault[]> {
  const recentVaultEncryptionKindRecords = await readPapelizRecentVaultEncryptionKindRecords()
  return Promise.all(
    recentVaults.map(async (recentVault): Promise<PapelizStartScreenRecentVault> => {
      const recentVaultEncryptionKindRecord = recentVaultEncryptionKindRecords.get(recentVault.papelizVaultId)
      if (recentVaultEncryptionKindRecord === undefined) return recentVault
      const { papelizVaultEncryptionKind, papelizEncryptedVaultId } = recentVaultEncryptionKindRecord
      return {
        ...recentVault,
        papelizRecentVaultEncryption: {
          papelizVaultEncryptionKind,
          papelizEncryptedVaultId,
          isVaultEncryptionKeyRememberedOnThisDevice: papelizEncryptedVaultId !== null && (await isPapelizVaultEncryptionKeyRememberedOnThisDevice(papelizEncryptedVaultId)),
        },
      }
    }),
  )
}

// Hides a vault from Recent vaults into the Hidden list, or restores it; its notes stay.
export function setPapelizRecentVaultHidden(recentVault: PapelizStartScreenRecentVault, isRecentVaultHidden: boolean): Promise<void> {
  return recentVault.papelizRecentVaultKind === 'browser-vault-in-opfs'
    ? setPapelizBrowserVaultHidden(recentVault, isRecentVaultHidden)
    : setRememberedVaultFolderHidden(recentVault, isRecentVaultHidden)
}

// Opens a vault from the list. A folder may ask for permission again, so run it from a click.
export async function reopenPapelizRecentVault(recentVault: PapelizStartScreenRecentVault): Promise<PapelizExistingVaultOpenResult> {
  return recentVault.papelizRecentVaultKind === 'browser-vault-in-opfs'
    ? findPapelizLockedEndToEndVault(await openPapelizBrowserVault(recentVault))
    : reopenRememberedPapelizVaultFolder(recentVault)
}

export type PapelizRecentVaultDeleteResult =
  | { recentVaultDeleteOutcome: 'deleted' }
  | { recentVaultDeleteOutcome: 'failed'; recentVaultDeleteFailureMessage: string }

// Delete in the Hidden list: a folder is erased from the disk, a browser vault from this browser.
export async function deletePapelizRecentVault(recentVault: PapelizStartScreenRecentVault): Promise<PapelizRecentVaultDeleteResult> {
  if (recentVault.papelizRecentVaultKind !== 'browser-vault-in-opfs') {
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
