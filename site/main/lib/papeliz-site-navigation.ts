import { papelizSiteDiscordUrl, papelizSiteGitHubRepositoryUrl, papelizSiteHelpUrl } from './papeliz-site-config'

export type PapelizSiteNavigationLink = {
  papelizSiteNavigationHref: string
  papelizSiteNavigationLabel: string
  papelizSiteNavigationIsExternal?: boolean
}

// A round community button in the footer. While its address is null it shows, but is not a link.
export type PapelizSiteFooterSocialLink = {
  papelizSiteFooterSocialChannel: 'github' | 'discord'
  papelizSiteFooterSocialLabel: string
  papelizSiteFooterSocialUrl: string | null
}

export const papelizSiteHeaderLinks: PapelizSiteNavigationLink[] = [
  { papelizSiteNavigationHref: '/features/', papelizSiteNavigationLabel: 'Features' },
  { papelizSiteNavigationHref: '/providers/', papelizSiteNavigationLabel: 'AI Providers' },
  { papelizSiteNavigationHref: '/roadmap/', papelizSiteNavigationLabel: 'Roadmap' },
  { papelizSiteNavigationHref: '/about/', papelizSiteNavigationLabel: 'About' },
  ...(papelizSiteHelpUrl
    ? [{ papelizSiteNavigationHref: papelizSiteHelpUrl, papelizSiteNavigationLabel: 'Help', papelizSiteNavigationIsExternal: true }]
    : []),
]

// The header shows Community at the right, beside Accessibility and Use App, not among the page links.
export const papelizSiteHeaderCommunityLink: PapelizSiteNavigationLink = {
  papelizSiteNavigationHref: '/community/',
  papelizSiteNavigationLabel: 'Community',
}

// Phones show the page links and Community together, in one row under the bar.
export const papelizSiteHeaderPhoneRowLinks: PapelizSiteNavigationLink[] = [...papelizSiteHeaderLinks, papelizSiteHeaderCommunityLink]

// The footer's "Made with ❤️" links: only pages the top menu does not already show (Adam, 2026-10-28: "remove
// redundants thats already on the Top Menu"), the legal ones named as in their Legal menu.
export const papelizSiteFooterLinks: PapelizSiteNavigationLink[] = [
  { papelizSiteNavigationHref: '/adam-natad/', papelizSiteNavigationLabel: 'Adam Natad' },
  { papelizSiteNavigationHref: '/changelog/', papelizSiteNavigationLabel: 'Changelog' },
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
