import type { PapelizSyncEngineSnapshot, PapelizSyncVaultEncryptionKind } from '../sync/papeliz-sync-engine-contract'

// What each Recent Vaults row says about Sync: "Sync" with its encryption (Standard Encryption, or
// End-to-End Encryption), or "Local". A copy that won't sync isn't linked, so it's Local.

// The kind of every recent vault that syncs, by its ID; a vault missing from it is Local. Null
// while it isn't known, so a row shows neither badge rather than the wrong one:
// - On a device that has never used Sync, every vault is Local and the engine isn't loaded for it.
// - On one that has, the engine's linked vaults say, while signed in, once it has loaded. A vault is
//   shown as Sync only while this device is signed in, as it syncs only then.
export function readPapelizRecentVaultSyncEncryptionKinds({
  isPapelizSyncExpectedOnThisDevice,
  syncEngineSnapshot,
}: {
  // Signed in to Sync before (or the dev fake engine), so the start screen loads the engine.
  isPapelizSyncExpectedOnThisDevice: boolean
  // Null until the engine has loaded.
  syncEngineSnapshot: PapelizSyncEngineSnapshot | null
}): ReadonlyMap<string, PapelizSyncVaultEncryptionKind> | null {
  if (syncEngineSnapshot === null) return isPapelizSyncExpectedOnThisDevice ? null : new Map()
  if (syncEngineSnapshot.syncSignIn.syncSignInKind !== 'signed-in') return new Map()
  return new Map(syncEngineSnapshot.syncLinkedLocalVaults.map((syncLinkedLocalVault) => [syncLinkedLocalVault.papelizVaultId, syncLinkedLocalVault.syncVaultEncryptionKind]))
}
