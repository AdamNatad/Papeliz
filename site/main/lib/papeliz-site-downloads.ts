import type { ComponentType } from 'react'
import { FaAndroid, FaApple, FaLinux, FaWindows } from 'react-icons/fa6'
import { SiHarmonyos } from 'react-icons/si'

export type PapelizSiteDownloadTargetId = 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'harmonyos'

// The file an app downloads, straight from its GitHub release.
export type PapelizSiteDownloadTargetFile = {
  papelizSiteDownloadTargetFileUrl: string
  // Its kind and size, as the button shows them: ".exe · 8.4 MB".
  papelizSiteDownloadTargetFileDescription: string
}

export type PapelizSiteDownloadTarget = {
  papelizSiteDownloadTargetId: PapelizSiteDownloadTargetId
  papelizSiteDownloadTargetLabel: string
  papelizSiteDownloadTargetDetail: string
  // While it is null the app has no build yet, and the page shows it muted, under Coming soon.
  papelizSiteDownloadTargetFile: PapelizSiteDownloadTargetFile | null
  PapelizSiteDownloadTargetLogo: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>
}

// The release the Download page offers, and its GitHub page with every file and the SHA-256 checksums.
export const papelizSiteDownloadReleaseName = '1.0.0 Preview 1'
export const papelizSiteDownloadReleasePageUrl = 'https://github.com/AdamNatad/Papeliz/releases/tag/v1.0.0-preview.1'
const papelizSiteDownloadReleaseFilesUrl = 'https://github.com/AdamNatad/Papeliz/releases/download/v1.0.0-preview.1'

// Every app Papeliz offers, as the Download page lists them, each listed before its build exists. Fill
// in each app's file as it is published. The page gives each one the anchor papeliz-download-<id>,
// which the account page's download menu links to.
export const papelizSiteDownloadTargets: readonly PapelizSiteDownloadTarget[] = [
  {
    papelizSiteDownloadTargetId: 'windows',
    papelizSiteDownloadTargetLabel: 'Windows',
    papelizSiteDownloadTargetDetail: 'Windows 10 and 11',
    papelizSiteDownloadTargetFile: {
      papelizSiteDownloadTargetFileUrl: `${papelizSiteDownloadReleaseFilesUrl}/Papeliz-1.0.0-preview.1-windows-x64-setup.exe`,
      papelizSiteDownloadTargetFileDescription: '.exe · 8.4 MB',
    },
    PapelizSiteDownloadTargetLogo: FaWindows,
  },
  {
    papelizSiteDownloadTargetId: 'macos',
    papelizSiteDownloadTargetLabel: 'macOS',
    papelizSiteDownloadTargetDetail: 'Apple silicon and Intel',
    papelizSiteDownloadTargetFile: null,
    PapelizSiteDownloadTargetLogo: FaApple,
  },
  {
    papelizSiteDownloadTargetId: 'linux',
    papelizSiteDownloadTargetLabel: 'Linux',
    papelizSiteDownloadTargetDetail: 'AppImage and .deb',
    papelizSiteDownloadTargetFile: null,
    PapelizSiteDownloadTargetLogo: FaLinux,
  },
  {
    papelizSiteDownloadTargetId: 'ios',
    papelizSiteDownloadTargetLabel: 'iPhone and iPad',
    papelizSiteDownloadTargetDetail: 'App Store',
    papelizSiteDownloadTargetFile: null,
    PapelizSiteDownloadTargetLogo: FaApple,
  },
  {
    papelizSiteDownloadTargetId: 'android',
    papelizSiteDownloadTargetLabel: 'Android',
    papelizSiteDownloadTargetDetail: 'Android',
    papelizSiteDownloadTargetFile: {
      papelizSiteDownloadTargetFileUrl: `${papelizSiteDownloadReleaseFilesUrl}/Papeliz-1.0.0-preview.1-android.apk`,
      papelizSiteDownloadTargetFileDescription: '.apk · 46.7 MB',
    },
    PapelizSiteDownloadTargetLogo: FaAndroid,
  },
  {
    papelizSiteDownloadTargetId: 'harmonyos',
    papelizSiteDownloadTargetLabel: 'HarmonyOS',
    papelizSiteDownloadTargetDetail: 'AppGallery',
    papelizSiteDownloadTargetFile: null,
    PapelizSiteDownloadTargetLogo: SiHarmonyos,
  },
]
