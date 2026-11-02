// The webapp's `virtual:papeliz-sync-engine` module: the Papeliz Sync engine
// (sync/papeliz-sync-client/src/papeliz-sync-engine-entry.ts) when the checkout has it, otherwise
// the webapp's stand-in (app/web/src/modules/sync/papeliz-sync-engine-stand-in.ts), which reports
// Sync as not part of this build. Both export the same `loadPapelizSyncEngine()`, so the webapp
// installs, builds and tests the same either way. `sync/` is its own pnpm workspace, so the engine's
// packages come from `sync/node_modules`.
//
// It also serves `virtual:papeliz-sync-engine-availability`: whether the engine is in this build and
// switched on (sync/papeliz-sync-client/src/papeliz-sync-engine-switch.ts), known without loading it.
//
// The dev server only: `webapp start sync-local` (build_tools/shared/launcher/papeliz-launcher.mjs)
// sets the two variables below. The dev server then serves the real engine, switched on whatever the
// switch says, and lays out its origin as papeliz.com does: the app at `/app/`, Sync's routes on the
// local Account and Sync Workers, and every other address, `/account/` included, from the site's dev
// server. A build never reads them, so a built app reports Sync as the switch does and carries neither
// the engine nor this.
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const papelizSyncEngineModuleId = 'virtual:papeliz-sync-engine'
const papelizSyncEngineAvailabilityModuleId = 'virtual:papeliz-sync-engine-availability'
const papelizSyncEngineAvailabilityResolvedModuleId = `\0${papelizSyncEngineAvailabilityModuleId}`
const papelizSyncLocalWorkersEngineResolvedModuleId = '\0papeliz-sync-engine-against-local-workers'

// The local Workers' router (build_tools/webapp/papeliz-sync-local-workers-router.mjs), and the site's
// dev server, which serves the website and `/account/`.
export const papelizSyncLocalWorkersOriginVariableName = 'PAPELIZ_WEBAPP_DEV_SYNC_LOCAL_WORKERS_ORIGIN'
export const papelizSyncSignInPageDevServerOriginVariableName = 'PAPELIZ_WEBAPP_DEV_SYNC_SIGN_IN_PAGE_DEV_SERVER_ORIGIN'

// Where the app lives on papeliz.com (its build's `base`, app/web/vite.config.ts), and so on this dev
// server too.
const papelizWebappBasePath = '/app/'

// What the dev server hands to each server; the first match wins. Every path keeps its Host, so the
// Workers see the app's origin: the sign-in page's `Origin` check and the rewritten storage links both
// rely on it.
function buildPapelizSyncLocalWorkersDevProxy(papelizSyncLocalWorkersOrigin, papelizSyncSignInPageDevServerOrigin) {
  return {
    '/api/account/': { target: papelizSyncLocalWorkersOrigin },
    // The live connection is a WebSocket on this route.
    '/api/sync/': { target: papelizSyncLocalWorkersOrigin, ws: true },
    // Papeliz Templates' list, Submit, Recheck, votes and reports, on the local Templates Worker.
    '/api/templates/': { target: papelizSyncLocalWorkersOrigin },
    '/papeliz-sync-local-r2-storage/': { target: papelizSyncLocalWorkersOrigin },
    '/papeliz-sync-local-workers/': { target: papelizSyncLocalWorkersOrigin },
    // Everything but `/app` is the website, as on papeliz.com: its pages (the Sync and Pricing pages,
    // whose plans' Sign up opens `/account/` here, next to the Workers, and `/account/` itself), its
    // files under `/_next/` and `/images/`, and its hot reload.
    '^/(?!app(?:/|\\?|$))': { target: papelizSyncSignInPageDevServerOrigin, ws: true },
  }
}

export function papelizSyncEnginePlugin() {
  let papelizSyncEngineEntryFilePath = ''
  let papelizSyncEngineSwitchFilePath = ''
  let papelizSyncBrowserEngineFilePath = ''
  let papelizSyncEngineStandInFilePath = ''
  let papelizSyncWorkspacePackagesFolderPath = ''
  let isPapelizSyncEngineServedAgainstLocalWorkers = false
  return {
    name: 'papeliz-sync-engine',
    config(_userViteConfig, { command }) {
      const papelizSyncLocalWorkersOrigin = process.env[papelizSyncLocalWorkersOriginVariableName]
      if (command !== 'serve' || !papelizSyncLocalWorkersOrigin) return undefined
      const papelizSyncSignInPageDevServerOrigin = process.env[papelizSyncSignInPageDevServerOriginVariableName]
      if (!papelizSyncSignInPageDevServerOrigin) throw new Error(`${papelizSyncLocalWorkersOriginVariableName} needs ${papelizSyncSignInPageDevServerOriginVariableName} too.`)
      isPapelizSyncEngineServedAgainstLocalWorkers = true
      return {
        base: papelizWebappBasePath,
        server: { proxy: buildPapelizSyncLocalWorkersDevProxy(papelizSyncLocalWorkersOrigin, papelizSyncSignInPageDevServerOrigin) },
      }
    },
    configureServer(papelizWebappDevServer) {
      if (!isPapelizSyncEngineServedAgainstLocalWorkers) return
      const papelizSyncLocalLoopbackHost = papelizWebappDevServer.config.server.host
      papelizWebappDevServer.middlewares.use((webappDevRequest, webappDevResponse, nextWebappDevMiddleware) => {
        const webappDevRequestUrl = webappDevRequest.url ?? ''
        // The payment provider refuses an IP address in a checkout's return address, so a local checkout
        // comes back on localhost, while the sign-in and the local Account Worker know only the loopback
        // IP. Every address goes back to it, /api/ included.
        const localhostRequestHostMatch = /^localhost(:\d+)?$/i.exec(webappDevRequest.headers.host ?? '')
        if (localhostRequestHostMatch) {
          webappDevResponse.writeHead(307, { Location: `http://${papelizSyncLocalLoopbackHost}${localhostRequestHostMatch[1] ?? ''}${webappDevRequestUrl}` }).end()
          return
        }
        // papeliz.com sends `/app` to `/app/`; Vite would answer with a "did you mean" page.
        const webappDevRequestPath = webappDevRequestUrl.split('?')[0]
        if (`${webappDevRequestPath}/` !== papelizWebappBasePath) return nextWebappDevMiddleware()
        webappDevResponse.writeHead(307, { Location: `${papelizWebappBasePath}${webappDevRequestUrl.slice(webappDevRequestPath.length)}` }).end()
      })
    },
    configResolved(resolvedViteConfig) {
      const papelizRepositoryRootFolder = join(resolvedViteConfig.root, '../..')
      papelizSyncEngineEntryFilePath = join(papelizRepositoryRootFolder, 'sync/papeliz-sync-client/src/papeliz-sync-engine-entry.ts')
      papelizSyncEngineSwitchFilePath = join(papelizRepositoryRootFolder, 'sync/papeliz-sync-client/src/papeliz-sync-engine-switch.ts')
      papelizSyncBrowserEngineFilePath = join(papelizRepositoryRootFolder, 'sync/papeliz-sync-client/src/papeliz-sync-browser-engine.ts')
      papelizSyncEngineStandInFilePath = join(resolvedViteConfig.root, 'src/modules/sync/papeliz-sync-engine-stand-in.ts')
      papelizSyncWorkspacePackagesFolderPath = join(papelizRepositoryRootFolder, 'sync/node_modules')
      if (isPapelizSyncEngineServedAgainstLocalWorkers) {
        resolvedViteConfig.logger.info(`  Papeliz Sync: the real engine, against the local Workers at ${process.env[papelizSyncLocalWorkersOriginVariableName]}`)
      }
    },
    load(loadedModuleId) {
      if (loadedModuleId === papelizSyncLocalWorkersEngineResolvedModuleId) {
        // The entry's switched-on return (papeliz-sync-engine-entry.ts), for this dev server only.
        return [
          `import { createPapelizSyncBrowserEngine } from ${JSON.stringify(papelizSyncBrowserEngineFilePath.replaceAll('\\', '/'))}`,
          'export async function loadPapelizSyncEngine() {',
          "  return { papelizSyncEngineAvailability: 'in-this-build', papelizSyncEngine: createPapelizSyncBrowserEngine() }",
          '}',
          '',
        ].join('\n')
      }
      if (loadedModuleId !== papelizSyncEngineAvailabilityResolvedModuleId) return undefined
      if (isPapelizSyncEngineServedAgainstLocalWorkers) return 'export const isPapelizSyncEngineInThisBuild = true\n'
      if (!existsSync(papelizSyncEngineEntryFilePath) || !existsSync(papelizSyncEngineSwitchFilePath)) return 'export const isPapelizSyncEngineInThisBuild = false\n'
      return `export { isPapelizSyncEngineSwitchedOn as isPapelizSyncEngineInThisBuild } from ${JSON.stringify(papelizSyncEngineSwitchFilePath.replaceAll('\\', '/'))}\n`
    },
    resolveId(importedModuleId) {
      if (importedModuleId === papelizSyncEngineAvailabilityModuleId) return papelizSyncEngineAvailabilityResolvedModuleId
      if (importedModuleId !== papelizSyncEngineModuleId) return undefined
      if (!existsSync(papelizSyncEngineEntryFilePath)) {
        if (isPapelizSyncEngineServedAgainstLocalWorkers) this.error('`webapp start sync-local` needs the Sync engine, and this checkout has no sync/ folder.')
        return papelizSyncEngineStandInFilePath
      }
      if (!existsSync(papelizSyncWorkspacePackagesFolderPath)) {
        this.error(`The Sync engine is in this checkout but its packages aren't installed: run \`pnpm --dir sync install\` (${papelizSyncWorkspacePackagesFolderPath} is missing).`)
      }
      return isPapelizSyncEngineServedAgainstLocalWorkers ? papelizSyncLocalWorkersEngineResolvedModuleId : papelizSyncEngineEntryFilePath
    },
  }
}
