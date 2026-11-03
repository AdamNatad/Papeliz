// The webapp's `virtual:papeliz-mobile-platform` module: the Android and iOS app's side when the mobile
// build names its entry file in PAPELIZ_WEBAPP_MOBILE_PLATFORM_ENTRY
// (app/mobile/papeliz-mobile-platform/papeliz-mobile-platform-tauri.ts, set by the mobile build's
// command), otherwise the webapp's stand-in (app/web/src/modules/mobile/papeliz-mobile-platform-stand-in.ts),
// which says there is no mobile app and has no phone layout. Both export the same
// `loadPapelizMobilePlatform()` and `PapelizMobileWorkspaceLayout`. The entry's own packages come from
// app/mobile/node_modules, so the web build, which never names it, carries none of them.
//
// It also serves `virtual:papeliz-mobile-platform-availability`: whether this build is the mobile app's,
// known without loading its native side.
import { existsSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'

export const papelizMobilePlatformEntryVariableName = 'PAPELIZ_WEBAPP_MOBILE_PLATFORM_ENTRY'

const papelizMobilePlatformModuleId = 'virtual:papeliz-mobile-platform'
const papelizMobilePlatformAvailabilityModuleId = 'virtual:papeliz-mobile-platform-availability'
const papelizMobilePlatformAvailabilityResolvedModuleId = `\0${papelizMobilePlatformAvailabilityModuleId}`

// The mobile entry's absolute path, or null in the web and desktop builds.
export function readPapelizMobilePlatformEntryFilePath() {
  const papelizMobilePlatformEntryFilePath = process.env[papelizMobilePlatformEntryVariableName]?.trim() ?? ''
  return papelizMobilePlatformEntryFilePath.length > 0 ? papelizMobilePlatformEntryFilePath : null
}

export function papelizMobilePlatformPlugin() {
  const papelizMobilePlatformEntryFilePath = readPapelizMobilePlatformEntryFilePath()
  let papelizMobilePlatformStandInFilePath = ''
  return {
    name: 'papeliz-mobile-platform',
    configResolved(resolvedViteConfig) {
      papelizMobilePlatformStandInFilePath = join(resolvedViteConfig.root, 'src/modules/mobile/papeliz-mobile-platform-stand-in.ts')
      if (papelizMobilePlatformEntryFilePath === null) return
      if (!isAbsolute(papelizMobilePlatformEntryFilePath) || !existsSync(papelizMobilePlatformEntryFilePath)) {
        throw new Error(`${papelizMobilePlatformEntryVariableName} must name the mobile platform's entry file by its absolute path; ${papelizMobilePlatformEntryFilePath} isn't one.`)
      }
      resolvedViteConfig.logger.info(`  Papeliz for Android and iOS: the mobile platform from ${papelizMobilePlatformEntryFilePath}`)
    },
    resolveId(importedModuleId) {
      if (importedModuleId === papelizMobilePlatformAvailabilityModuleId) return papelizMobilePlatformAvailabilityResolvedModuleId
      if (importedModuleId === papelizMobilePlatformModuleId) return papelizMobilePlatformEntryFilePath ?? papelizMobilePlatformStandInFilePath
      return undefined
    },
    load(loadedModuleId) {
      if (loadedModuleId !== papelizMobilePlatformAvailabilityResolvedModuleId) return undefined
      return `export const isPapelizMobileApp = ${papelizMobilePlatformEntryFilePath !== null}\n`
    },
  }
}
