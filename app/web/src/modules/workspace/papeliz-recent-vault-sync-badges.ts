import type { PapelizSyncEngineSnapshot } from '../sync/papeliz-sync-engine-contract'

// Whether each Recent Vaults row says "Sync" or "Local". A copy that won't sync isn't linked, so it's
// Local. A vault's encryption badge comes from the vault's own kind (papeliz-recent-vaults.ts), in
// every build, not from Sync.

// The IDs of every recent vault that syncs; a vault missing from it is Local. Null while it isn't
// known, so a row shows neither badge rather than the wrong one:
// - On a device that has never used Sync, every vault is Local and the engine isn't loaded for it.
// - On one that has, the engine's linked vaults say, while signed in, once it has loaded. A vault is
//   shown as Sync only while this device is signed in, as it syncs only then.
export function readPapelizRecentVaultSyncedVaultIds({
  isPapelizSyncExpectedOnThisDevice,
  syncEngineSnapshot,
}: {
  // Signed in to Sync before (or the dev fake engine), so the start screen loads the engine.
  isPapelizSyncExpectedOnThisDevice: boolean
  // Null until the engine has loaded.
  syncEngineSnapshot: PapelizSyncEngineSnapshot | null
}): ReadonlySet<string> | null {
  if (syncEngineSnapshot === null) return isPapelizSyncExpectedOnThisDevice ? null : new Set()
  if (syncEngineSnapshot.syncSignIn.syncSignInKind !== 'signed-in') return new Set()
  return new Set(syncEngineSnapshot.syncLinkedLocalVaults.map((syncLinkedLocalVault) => syncLinkedLocalVault.papelizVaultId))
}
