import type { PapelizSyncEngineSnapshot, PapelizSyncVaultEncryptionKind } from '../sync/papeliz-sync-engine-contract'

// What each Recent Vaults row says about Sync: "Synced" with its kind (Standard, or End-to-end), or
// "Local only". A copy that won't sync isn't linked, so it's Local only.

// The kind of every recent vault that syncs, by its ID; a vault missing from it is Local only. Null
// while it isn't known, so a row shows neither badge rather than the wrong one:
// - On a device that has never used Sync, every vault is Local only and the engine isn't loaded for it.
// - On one that has, the engine's linked vaults say, while signed in, once it has loaded. A vault is
//   Synced only while this device is signed in, as it syncs only then.
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
