// Papeliz for Android and iOS, from the build: the mobile app's own module when the mobile build sets
// it, otherwise the stand-in (papeliz-mobile-platform-stand-in.ts), which has no mobile app and no
// phone layout.
declare module 'virtual:papeliz-mobile-platform' {
  export function loadPapelizMobilePlatform(): Promise<import('./papeliz-mobile-platform-contract').PapelizMobilePlatformLoadResult>

  // The Android and iOS app's phone layout, or null in the web and desktop builds.
  export const PapelizMobileWorkspaceLayout: import('./papeliz-mobile-platform-contract').PapelizMobileWorkspaceLayoutComponent | null
}

// Whether this build is the Android and iOS app's, known at build time without loading its native side.
declare module 'virtual:papeliz-mobile-platform-availability' {
  export const isPapelizMobileApp: boolean
}
