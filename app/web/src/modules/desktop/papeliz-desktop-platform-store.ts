import { isPapelizDesktopApp } from 'virtual:papeliz-desktop-platform-availability'
import { create } from 'zustand'
import type { PapelizDesktopPlatform } from './papeliz-desktop-platform-contract'

// Papeliz for Windows' native side, loaded once when the desktop app starts. In the web app it stays
// null and nothing is loaded, so every caller keeps the browser's own way when it is null.
interface PapelizDesktopPlatformStoreState {
  papelizDesktopPlatform: PapelizDesktopPlatform | null
}

export const usePapelizDesktopPlatformStore = create<PapelizDesktopPlatformStoreState>()(() => ({ papelizDesktopPlatform: null }))

let papelizDesktopPlatformLoad: Promise<PapelizDesktopPlatform | null> | null = null

export function loadPapelizDesktopPlatformOnce(): Promise<PapelizDesktopPlatform | null> {
  if (!isPapelizDesktopApp) return Promise.resolve(null)
  papelizDesktopPlatformLoad ??= import('virtual:papeliz-desktop-platform').then(async (desktopPlatformModule) => {
    const desktopPlatformLoadResult = await desktopPlatformModule.loadPapelizDesktopPlatform()
    const papelizDesktopPlatform =
      desktopPlatformLoadResult.papelizDesktopPlatformAvailability === 'in-the-desktop-app' ? desktopPlatformLoadResult.papelizDesktopPlatform : null
    usePapelizDesktopPlatformStore.setState({ papelizDesktopPlatform })
    return papelizDesktopPlatform
  })
  return papelizDesktopPlatformLoad
}
