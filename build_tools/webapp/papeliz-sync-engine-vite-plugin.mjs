// The webapp's `virtual:papeliz-sync-engine` module: the Papeliz Sync engine
// (sync/papeliz-sync-client/src/papeliz-sync-engine-entry.ts) when the checkout has it, otherwise
// the webapp's stand-in (app/web/src/modules/sync/papeliz-sync-engine-stand-in.ts), which reports
// Sync as not part of this build. Both export the same `loadPapelizSyncEngine()`, so the webapp
// installs, builds and tests the same either way. `sync/` is its own pnpm workspace, so the engine's
// packages come from `sync/node_modules`.
//
// It also serves `virtual:papeliz-sync-engine-availability`: whether the engine is in this build and
// switched on (sync/papeliz-sync-client/src/papeliz-sync-engine-switch.ts), known without loading it.
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const papelizSyncEngineModuleId = 'virtual:papeliz-sync-engine'
const papelizSyncEngineAvailabilityModuleId = 'virtual:papeliz-sync-engine-availability'
const papelizSyncEngineAvailabilityResolvedModuleId = `\0${papelizSyncEngineAvailabilityModuleId}`

export function papelizSyncEnginePlugin() {
  let papelizSyncEngineEntryFilePath = ''
  let papelizSyncEngineSwitchFilePath = ''
  let papelizSyncEngineStandInFilePath = ''
  let papelizSyncWorkspacePackagesFolderPath = ''
  return {
    name: 'papeliz-sync-engine',
    configResolved(resolvedViteConfig) {
      const papelizRepositoryRootFolder = join(resolvedViteConfig.root, '../..')
      papelizSyncEngineEntryFilePath = join(papelizRepositoryRootFolder, 'sync/papeliz-sync-client/src/papeliz-sync-engine-entry.ts')
      papelizSyncEngineSwitchFilePath = join(papelizRepositoryRootFolder, 'sync/papeliz-sync-client/src/papeliz-sync-engine-switch.ts')
      papelizSyncEngineStandInFilePath = join(resolvedViteConfig.root, 'src/modules/sync/papeliz-sync-engine-stand-in.ts')
      papelizSyncWorkspacePackagesFolderPath = join(papelizRepositoryRootFolder, 'sync/node_modules')
    },
    load(loadedModuleId) {
      if (loadedModuleId !== papelizSyncEngineAvailabilityResolvedModuleId) return undefined
      if (!existsSync(papelizSyncEngineEntryFilePath) || !existsSync(papelizSyncEngineSwitchFilePath)) return 'export const isPapelizSyncEngineInThisBuild = false\n'
      return `export { isPapelizSyncEngineSwitchedOn as isPapelizSyncEngineInThisBuild } from ${JSON.stringify(papelizSyncEngineSwitchFilePath.replaceAll('\\', '/'))}\n`
    },
    resolveId(importedModuleId) {
      if (importedModuleId === papelizSyncEngineAvailabilityModuleId) return papelizSyncEngineAvailabilityResolvedModuleId
      if (importedModuleId !== papelizSyncEngineModuleId) return undefined
      if (!existsSync(papelizSyncEngineEntryFilePath)) return papelizSyncEngineStandInFilePath
      if (!existsSync(papelizSyncWorkspacePackagesFolderPath)) {
        this.error(`The Sync engine is in this checkout but its packages aren't installed: run \`pnpm --dir sync install\` (${papelizSyncWorkspacePackagesFolderPath} is missing).`)
      }
      return papelizSyncEngineEntryFilePath
    },
  }
}
