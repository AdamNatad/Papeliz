import { Info, LifeBuoy, Milestone, ScrollText, Sparkles, type LucideIcon } from 'lucide-react'
import { papelizSiteDiscordUrl, papelizSiteGitHubRepositoryUrl, papelizSiteHelpUrl } from './papeliz-site-config'

export type PapelizSiteNavigationLink = {
  papelizSiteNavigationHref: string
  papelizSiteNavigationLabel: string
  papelizSiteNavigationIsExternal?: boolean
}

// A page in the header's Resources menu: its link, a one-line description and an icon.
export type PapelizSiteHeaderResourcesMenuItem = PapelizSiteNavigationLink & {
  papelizSiteHeaderResourcesMenuItemDescription: string
  PapelizSiteHeaderResourcesMenuItemIcon: LucideIcon
}

// A round community button in the footer. While its address is null it shows, but is not a link.
export type PapelizSiteFooterSocialLink = {
  papelizSiteFooterSocialChannel: 'github' | 'discord'
  papelizSiteFooterSocialLabel: string
  papelizSiteFooterSocialUrl: string | null
}

const papelizSiteHelpNavigationLinks: PapelizSiteNavigationLink[] = papelizSiteHelpUrl
  ? [{ papelizSiteNavigationHref: papelizSiteHelpUrl, papelizSiteNavigationLabel: 'Help', papelizSiteNavigationIsExternal: true }]
  : []

// The top menu (Adam, 2026-10-31, "Menu 1"): Pricing, Sync and
// Features as links, then the Resources menu.
export const papelizSiteHeaderLinks: PapelizSiteNavigationLink[] = [
  { papelizSiteNavigationHref: '/pricing/', papelizSiteNavigationLabel: 'Pricing' },
  { papelizSiteNavigationHref: '/sync/', papelizSiteNavigationLabel: 'Sync' },
  { papelizSiteNavigationHref: '/features/', papelizSiteNavigationLabel: 'Features' },
]

export const papelizSiteHeaderResourcesMenuLabel = 'Resources'

export const papelizSiteHeaderResourcesMenuItems: PapelizSiteHeaderResourcesMenuItem[] = [
  {
    papelizSiteNavigationHref: '/roadmap/',
    papelizSiteNavigationLabel: 'Roadmap',
    papelizSiteHeaderResourcesMenuItemDescription: 'What Papeliz is building next.',
    PapelizSiteHeaderResourcesMenuItemIcon: Milestone,
  },
  {
    papelizSiteNavigationHref: '/changelog/',
    papelizSiteNavigationLabel: 'Changelog',
    papelizSiteHeaderResourcesMenuItemDescription: 'What changed in each release.',
    PapelizSiteHeaderResourcesMenuItemIcon: ScrollText,
  },
  ...papelizSiteHelpNavigationLinks.map((papelizSiteHelpNavigationLink) => ({
    ...papelizSiteHelpNavigationLink,
    papelizSiteHeaderResourcesMenuItemDescription: 'Guides for every part of Papeliz.',
    PapelizSiteHeaderResourcesMenuItemIcon: LifeBuoy,
  })),
  {
    papelizSiteNavigationHref: '/about/',
    papelizSiteNavigationLabel: 'About',
    papelizSiteHeaderResourcesMenuItemDescription: 'Why Papeliz exists and who makes it.',
    PapelizSiteHeaderResourcesMenuItemIcon: Info,
  },
  {
    papelizSiteNavigationHref: '/providers/',
    papelizSiteNavigationLabel: 'AI Providers',
    papelizSiteHeaderResourcesMenuItemDescription: 'The providers the assistant works with.',
    PapelizSiteHeaderResourcesMenuItemIcon: Sparkles,
  },
]

// The header shows Community at the right, beside Accessibility and Use App, not among the page links.
export const papelizSiteHeaderCommunityLink: PapelizSiteNavigationLink = {
  papelizSiteNavigationHref: '/community/',
  papelizSiteNavigationLabel: 'Community',
}

// Phones show one flat row under the bar instead of the Resources menu: the page links, the
// Resources pages people look for most, and Community.
export const papelizSiteHeaderPhoneRowLinks: PapelizSiteNavigationLink[] = [
  ...papelizSiteHeaderLinks,
  { papelizSiteNavigationHref: '/roadmap/', papelizSiteNavigationLabel: 'Roadmap' },
  ...papelizSiteHelpNavigationLinks,
  { papelizSiteNavigationHref: '/about/', papelizSiteNavigationLabel: 'About' },
  papelizSiteHeaderCommunityLink,
]

// The footer's "Made with ❤️" links: only pages the top bar's links and the phone row do not show (Adam,
// 2026-10-28: "remove redundants thats already on the Top Menu"), the legal ones named as in their Legal
// menu. Changelog and AI Providers stay here for phones, which have no Resources menu.
export const papelizSiteFooterLinks: PapelizSiteNavigationLink[] = [
  { papelizSiteNavigationHref: '/adam-natad/', papelizSiteNavigationLabel: 'Adam Natad' },
  { papelizSiteNavigationHref: '/changelog/', papelizSiteNavigationLabel: 'Changelog' },
  { papelizSiteNavigationHref: '/providers/', papelizSiteNavigationLabel: 'AI Providers' },
  { papelizSiteNavigationHref: '/privacy/', papelizSiteNavigationLabel: 'Privacy Policy' },
  { papelizSiteNavigationHref: '/terms/', papelizSiteNavigationLabel: 'Terms of Service' },
  { papelizSiteNavigationHref: '/license/', papelizSiteNavigationLabel: 'License Overview' },
]

// The footer's community buttons, the same places as the Community page.
export const papelizSiteFooterSocialLinks: PapelizSiteFooterSocialLink[] = [
  { papelizSiteFooterSocialChannel: 'github', papelizSiteFooterSocialLabel: 'Papeliz on GitHub', papelizSiteFooterSocialUrl: papelizSiteGitHubRepositoryUrl },
  { papelizSiteFooterSocialChannel: 'discord', papelizSiteFooterSocialLabel: 'Papeliz on Discord', papelizSiteFooterSocialUrl: papelizSiteDiscordUrl },
]

// Every exported page, for the sitemap and the export check.
export const papelizSitePagePaths = [
  '/',
  '/pricing/',
  '/sync/',
  '/download/',
  '/features/',
  '/providers/',
  '/roadmap/',
  '/changelog/',
  '/about/',
  '/adam-natad/',
  '/community/',
  '/privacy/',
  '/terms/',
  '/license/',
]
