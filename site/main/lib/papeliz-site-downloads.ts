import type { ComponentType } from 'react'
import { FaAndroid, FaApple, FaLinux, FaWindows } from 'react-icons/fa6'
import { SiHarmonyos } from 'react-icons/si'

export type PapelizSiteDownloadTargetId = 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'harmonyos'

export type PapelizSiteDownloadTarget = {
  papelizSiteDownloadTargetId: PapelizSiteDownloadTargetId
  papelizSiteDownloadTargetLabel: string
  papelizSiteDownloadTargetDetail: string
  // Where this app downloads from. While it is null the row shows, but is not a link.
  papelizSiteDownloadTargetUrl: string | null
  PapelizSiteDownloadTargetLogo: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>
}

// Every app Papeliz offers, as the Download page lists them (Adam, 2026-10-31: "just add it all we will
// add the links later"). Fill in each app's link as it is published. The page gives each one the anchor
// papeliz-download-<id>, which the account page's download menu links to.
export const papelizSiteDownloadTargets: readonly PapelizSiteDownloadTarget[] = [
  {
    papelizSiteDownloadTargetId: 'windows',
    papelizSiteDownloadTargetLabel: 'Windows',
    papelizSiteDownloadTargetDetail: 'Windows 10 and 11',
    papelizSiteDownloadTargetUrl: null,
    PapelizSiteDownloadTargetLogo: FaWindows,
  },
  {
    papelizSiteDownloadTargetId: 'macos',
    papelizSiteDownloadTargetLabel: 'macOS',
    papelizSiteDownloadTargetDetail: 'Apple silicon and Intel',
    papelizSiteDownloadTargetUrl: null,
    PapelizSiteDownloadTargetLogo: FaApple,
  },
  {
    papelizSiteDownloadTargetId: 'linux',
    papelizSiteDownloadTargetLabel: 'Linux',
    papelizSiteDownloadTargetDetail: 'AppImage and .deb',
    papelizSiteDownloadTargetUrl: null,
    PapelizSiteDownloadTargetLogo: FaLinux,
  },
  {
    papelizSiteDownloadTargetId: 'ios',
    papelizSiteDownloadTargetLabel: 'iPhone and iPad',
    papelizSiteDownloadTargetDetail: 'App Store',
    papelizSiteDownloadTargetUrl: null,
    PapelizSiteDownloadTargetLogo: FaApple,
  },
  {
    papelizSiteDownloadTargetId: 'android',
    papelizSiteDownloadTargetLabel: 'Android',
    papelizSiteDownloadTargetDetail: 'Google Play',
    papelizSiteDownloadTargetUrl: null,
    PapelizSiteDownloadTargetLogo: FaAndroid,
  },
  {
    papelizSiteDownloadTargetId: 'harmonyos',
    papelizSiteDownloadTargetLabel: 'HarmonyOS',
    papelizSiteDownloadTargetDetail: 'AppGallery',
    papelizSiteDownloadTargetUrl: null,
    PapelizSiteDownloadTargetLogo: SiHarmonyos,
  },
]
