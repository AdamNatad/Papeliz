// The Sync engine, from the build (build_tools/webapp/papeliz-sync-engine-vite-plugin.mjs): the
// engine itself when the build has it, otherwise the stand-in (papeliz-sync-engine-stand-in.ts),
// which reports Sync as not part of this build. Import it with `import('virtual:papeliz-sync-engine')`,
// so it loads as its own chunk only when the screens need it.
declare module 'virtual:papeliz-sync-engine' {
  export type PapelizSyncEngineLoadResult = import('./papeliz-sync-engine-stand-in').PapelizSyncEngineLoadResult

  export function loadPapelizSyncEngine(): Promise<PapelizSyncEngineLoadResult>
}
