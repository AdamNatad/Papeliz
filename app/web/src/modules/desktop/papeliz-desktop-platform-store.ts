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
    // Each window tells the native side which folder vault it shows (papeliz-desktop-window-vault-claims.ts).
    // Loaded here, after the workspace, which itself reads this store.
    if (papelizDesktopPlatform !== null) {
      void import('./papeliz-desktop-window-vault-claims').then((windowVaultClaimsModule) =>
        windowVaultClaimsModule.startPapelizDesktopWindowVaultClaims(papelizDesktopPlatform),
      )
    }
    return papelizDesktopPlatform
  })
  return papelizDesktopPlatformLoad
}
