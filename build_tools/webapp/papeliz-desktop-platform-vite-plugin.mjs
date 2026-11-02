// The webapp's `virtual:papeliz-desktop-platform` module: Papeliz for Windows' native side when the
// desktop build names its entry file in PAPELIZ_WEBAPP_DESKTOP_PLATFORM_ENTRY
// (app/desktop/papeliz-desktop-platform/papeliz-desktop-platform-tauri.ts, set by the desktop's
// build and dev commands), otherwise the webapp's stand-in
// (app/web/src/modules/desktop/papeliz-desktop-platform-stand-in.ts), which says there is no desktop.
// Both export the same `loadPapelizDesktopPlatform()`. The entry's Tauri packages come from
// app/desktop/node_modules, so the web build, which never names it, carries none of them.
//
// It also serves `virtual:papeliz-desktop-platform-availability`: whether this build is the desktop
// app's, known without loading the native side.
import { existsSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'

export const papelizDesktopPlatformEntryVariableName = 'PAPELIZ_WEBAPP_DESKTOP_PLATFORM_ENTRY'

const papelizDesktopPlatformModuleId = 'virtual:papeliz-desktop-platform'
const papelizDesktopPlatformAvailabilityModuleId = 'virtual:papeliz-desktop-platform-availability'
const papelizDesktopPlatformAvailabilityResolvedModuleId = `\0${papelizDesktopPlatformAvailabilityModuleId}`

// The desktop entry's absolute path, or null in the web build.
export function readPapelizDesktopPlatformEntryFilePath() {
  const papelizDesktopPlatformEntryFilePath = process.env[papelizDesktopPlatformEntryVariableName]?.trim() ?? ''
  return papelizDesktopPlatformEntryFilePath.length > 0 ? papelizDesktopPlatformEntryFilePath : null
}

export function papelizDesktopPlatformPlugin() {
  const papelizDesktopPlatformEntryFilePath = readPapelizDesktopPlatformEntryFilePath()
  let papelizDesktopPlatformStandInFilePath = ''
  return {
    name: 'papeliz-desktop-platform',
    configResolved(resolvedViteConfig) {
      papelizDesktopPlatformStandInFilePath = join(resolvedViteConfig.root, 'src/modules/desktop/papeliz-desktop-platform-stand-in.ts')
      if (papelizDesktopPlatformEntryFilePath === null) return
      if (!isAbsolute(papelizDesktopPlatformEntryFilePath) || !existsSync(papelizDesktopPlatformEntryFilePath)) {
        throw new Error(`${papelizDesktopPlatformEntryVariableName} must name the desktop platform's entry file by its absolute path; ${papelizDesktopPlatformEntryFilePath} isn't one.`)
      }
      resolvedViteConfig.logger.info(`  Papeliz for Windows: the desktop platform from ${papelizDesktopPlatformEntryFilePath}`)
    },
    resolveId(importedModuleId) {
      if (importedModuleId === papelizDesktopPlatformAvailabilityModuleId) return papelizDesktopPlatformAvailabilityResolvedModuleId
      if (importedModuleId === papelizDesktopPlatformModuleId) return papelizDesktopPlatformEntryFilePath ?? papelizDesktopPlatformStandInFilePath
      return undefined
    },
    load(loadedModuleId) {
      if (loadedModuleId !== papelizDesktopPlatformAvailabilityResolvedModuleId) return undefined
      return `export const isPapelizDesktopApp = ${papelizDesktopPlatformEntryFilePath !== null}\n`
    },
  }
}
