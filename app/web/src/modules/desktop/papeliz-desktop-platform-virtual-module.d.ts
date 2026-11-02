// Papeliz for Windows' native side, from the build: the desktop app's own module when the desktop
// build sets it, otherwise the stand-in (papeliz-desktop-platform-stand-in.ts), which says there is no
// desktop. Import it with `import('virtual:papeliz-desktop-platform')`, so it loads as its own chunk.
declare module 'virtual:papeliz-desktop-platform' {
  export type PapelizDesktopPlatformLoadResult = import('./papeliz-desktop-platform-contract').PapelizDesktopPlatformLoadResult

  export function loadPapelizDesktopPlatform(): Promise<PapelizDesktopPlatformLoadResult>
}

// Whether this build is the desktop app's, known at build time without loading its native side. The
// title bar's window buttons and the desktop's own words show only then.
declare module 'virtual:papeliz-desktop-platform-availability' {
  export const isPapelizDesktopApp: boolean
}
