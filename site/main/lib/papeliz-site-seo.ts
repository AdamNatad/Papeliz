import type { Metadata } from 'next'
import { papelizSiteCanonicalOrigin, papelizSiteName } from './papeliz-site-config'

type PapelizSitePageMetadataInput = {
  papelizSitePageTitle: string
  papelizSitePageDescription: string
  papelizSitePagePath: string
}

type PapelizSiteSocialCardInput = {
  papelizSiteSocialCardTitle: string
  papelizSiteSocialCardDescription: string
  papelizSiteSocialCardPagePath: string
}

// The link-preview banner in public/ (branding/social-banner/ holds every size and WebP copies).
export const papelizSiteSocialBannerPath = '/papeliz-social-banner-1200x630.png'
const papelizSiteSocialBannerImage = {
  url: papelizSiteSocialBannerPath,
  width: 1200,
  height: 630,
  alt: 'Papeliz: Making Notes Simple.',
  type: 'image/png',
}

// Open Graph and X cards. Social sites need absolute URLs, so the page URL and the banner are added
// only once the site has a public origin; until then the card is a plain summary.
export function createPapelizSiteSocialCardMetadata({
  papelizSiteSocialCardTitle,
  papelizSiteSocialCardDescription,
  papelizSiteSocialCardPagePath,
}: PapelizSiteSocialCardInput): Pick<Metadata, 'openGraph' | 'twitter'> {
  return {
    openGraph: {
      title: papelizSiteSocialCardTitle,
      description: papelizSiteSocialCardDescription,
      siteName: papelizSiteName,
      type: 'website',
      locale: 'en_US',
      ...(papelizSiteCanonicalOrigin ? { url: papelizSiteSocialCardPagePath, images: [papelizSiteSocialBannerImage] } : {}),
    },
    twitter: {
      card: papelizSiteCanonicalOrigin ? 'summary_large_image' : 'summary',
      title: papelizSiteSocialCardTitle,
      description: papelizSiteSocialCardDescription,
      ...(papelizSiteCanonicalOrigin ? { images: [papelizSiteSocialBannerImage] } : {}),
    },
  }
}

// Title, description and social cards for one page. Canonical and Open Graph URLs are added only
// once the site has a public origin.
export function createPapelizSitePageMetadata({
  papelizSitePageTitle,
  papelizSitePageDescription,
  papelizSitePagePath,
}: PapelizSitePageMetadataInput): Metadata {
  return {
    title: papelizSitePageTitle,
    description: papelizSitePageDescription,
    ...(papelizSiteCanonicalOrigin ? { alternates: { canonical: papelizSitePagePath } } : {}),
    ...createPapelizSiteSocialCardMetadata({
      papelizSiteSocialCardTitle: `${papelizSitePageTitle} - ${papelizSiteName}`,
      papelizSiteSocialCardDescription: papelizSitePageDescription,
      papelizSiteSocialCardPagePath: papelizSitePagePath,
    }),
  }
}

// Turns a site path into an absolute URL, or null while the origin is unknown.
export function papelizSiteAbsoluteUrl(papelizSitePagePath: string): string | null {
  return papelizSiteCanonicalOrigin ? new URL(papelizSitePagePath, papelizSiteCanonicalOrigin).toString() : null
}
