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

// The footer's "Made with ❤️" links: every page, since phones reach most of them only from here, with About
// and Adam Natad first.
export const papelizSiteFooterLinks: PapelizSiteNavigationLink[] = [
  { papelizSiteNavigationHref: '/about/', papelizSiteNavigationLabel: 'About' },
  { papelizSiteNavigationHref: '/adam-natad/', papelizSiteNavigationLabel: 'Adam Natad' },
  papelizSiteHeaderCommunityLink,
  { papelizSiteNavigationHref: '/features/', papelizSiteNavigationLabel: 'Features' },
  { papelizSiteNavigationHref: '/providers/', papelizSiteNavigationLabel: 'AI Providers' },
  { papelizSiteNavigationHref: '/roadmap/', papelizSiteNavigationLabel: 'Roadmap' },
  { papelizSiteNavigationHref: '/changelog/', papelizSiteNavigationLabel: 'Changelog' },
  ...(papelizSiteHelpUrl
    ? [{ papelizSiteNavigationHref: papelizSiteHelpUrl, papelizSiteNavigationLabel: 'Help', papelizSiteNavigationIsExternal: true }]
    : []),
  { papelizSiteNavigationHref: '/privacy/', papelizSiteNavigationLabel: 'Privacy' },
  { papelizSiteNavigationHref: '/terms/', papelizSiteNavigationLabel: 'Terms' },
  { papelizSiteNavigationHref: '/license/', papelizSiteNavigationLabel: 'MIT License' },
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
