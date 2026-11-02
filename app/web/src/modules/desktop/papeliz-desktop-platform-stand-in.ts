import type { PapelizDesktopPlatformLoadResult } from './papeliz-desktop-platform-contract'

// `virtual:papeliz-desktop-platform` in the web build: a browser has no desktop app around it, so the
// web app keeps its own behaviour everywhere and carries nothing of Papeliz for Windows.
export async function loadPapelizDesktopPlatform(): Promise<PapelizDesktopPlatformLoadResult> {
  return { papelizDesktopPlatformAvailability: 'not-in-this-build' }
}
