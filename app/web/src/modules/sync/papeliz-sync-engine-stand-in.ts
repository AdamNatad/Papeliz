import type { PapelizSyncEngine } from './papeliz-sync-engine-contract'

// What `loadPapelizSyncEngine()` from `virtual:papeliz-sync-engine` returns, in every build: the
// engine when the build has it. The type lives here, in a checked file, and the module's
// declaration (papeliz-sync-engine-virtual-module.d.ts) points to it.
export type PapelizSyncEngineLoadResult =
  | { papelizSyncEngineAvailability: 'not-in-this-build' }
  | { papelizSyncEngineAvailability: 'in-this-build'; papelizSyncEngine: PapelizSyncEngine }

// `virtual:papeliz-sync-engine` in a build without the Sync engine: the screens then say Sync isn't
// part of this build, and nothing is sent to any Papeliz server.
export async function loadPapelizSyncEngine(): Promise<PapelizSyncEngineLoadResult> {
  return { papelizSyncEngineAvailability: 'not-in-this-build' }
}
