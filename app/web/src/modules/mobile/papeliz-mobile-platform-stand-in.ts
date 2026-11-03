import type { PapelizMobilePlatformLoadResult, PapelizMobileWorkspaceLayoutComponent } from './papeliz-mobile-platform-contract'

// `virtual:papeliz-mobile-platform` in the web and desktop builds: there is no Android or iOS app
// around the page, so the web app keeps its own layout everywhere, its phone view included.
export async function loadPapelizMobilePlatform(): Promise<PapelizMobilePlatformLoadResult> {
  return { papelizMobilePlatformAvailability: 'not-in-this-build' }
}

export const PapelizMobileWorkspaceLayout: PapelizMobileWorkspaceLayoutComponent | null = null
