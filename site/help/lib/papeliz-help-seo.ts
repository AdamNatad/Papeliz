import type { Metadata } from 'next'

// Search and link-preview facts for the help site, served at papeliz.com/help/. It shares the
// website's banner and structured data: the same Natad Corporation, Adam Natad and website @ids as
// site/main/lib/papeliz-site-jsonld.ts, so search engines see one set. Metadata URLs don't get the
// /help base path that pages and next/link do, so every path here is written with it.

export const papelizHelpCanonicalOrigin = 'https://papeliz.com'
export const papelizHelpHomePath = '/help/'
const papelizHelpSiteName = 'Papeliz'
const papelizHelpTitle = 'Papeliz Help'

export const papelizHelpDescription =
  'Guides for Papeliz, the free, open-source, cross-platform Markdown editor and AI-powered note-taking app for building your personal knowledge base.'

// The website's link-preview banner, at the top of the domain.
const papelizHelpSocialBannerImage = {
  url: `${papelizHelpCanonicalOrigin}/papeliz-social-banner-1200x630.png`,
  width: 1200,
  height: 630,
  alt: 'Papeliz: Making Notes Simple.',
  type: 'image/png',
}

const papelizHelpOrganizationJsonLdId = 'https://natad.ai/#organization'
const papelizHelpAuthorJsonLdId = `${papelizHelpCanonicalOrigin}/adam-natad/#person`
const papelizHelpWebsiteJsonLdId = `${papelizHelpCanonicalOrigin}/#website`

export function papelizHelpAbsoluteUrl(papelizHelpPagePath: string): string {
  return new URL(papelizHelpPagePath, papelizHelpCanonicalOrigin).toString()
}

// Title, description, canonical link and the banner card for one help page.
export function createPapelizHelpPageMetadata(papelizHelpPageTitle: string, papelizHelpPageDescription: string, papelizHelpPagePath: string): Metadata {
  const papelizHelpSocialCardTitle = papelizHelpPageTitle === papelizHelpTitle ? papelizHelpTitle : `${papelizHelpPageTitle} - ${papelizHelpTitle}`
  return {
    description: papelizHelpPageDescription,
    alternates: { canonical: papelizHelpPagePath },
    openGraph: {
      title: papelizHelpSocialCardTitle,
      description: papelizHelpPageDescription,
      url: papelizHelpPagePath,
      siteName: papelizHelpSiteName,
      type: 'website',
      locale: 'en_US',
      images: [papelizHelpSocialBannerImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: papelizHelpSocialCardTitle,
      description: papelizHelpPageDescription,
      images: [papelizHelpSocialBannerImage],
    },
  }
}

// The help site as part of the Papeliz website, published by Natad Corporation and written by
// Adam Natad. A guide adds itself as an article.
export function createPapelizHelpJsonLdGraph(papelizHelpPageJsonLdNodes: readonly object[] = []) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${papelizHelpAbsoluteUrl(papelizHelpHomePath)}#webpage`,
        url: papelizHelpAbsoluteUrl(papelizHelpHomePath),
        name: papelizHelpTitle,
        description: papelizHelpDescription,
        inLanguage: 'en',
        image: papelizHelpSocialBannerImage.url,
        isPartOf: { '@id': papelizHelpWebsiteJsonLdId },
        publisher: { '@id': papelizHelpOrganizationJsonLdId },
        author: { '@id': papelizHelpAuthorJsonLdId },
      },
      {
        '@type': 'WebSite',
        '@id': papelizHelpWebsiteJsonLdId,
        url: papelizHelpAbsoluteUrl('/'),
        name: papelizHelpSiteName,
        publisher: { '@id': papelizHelpOrganizationJsonLdId },
      },
      {
        '@type': 'Organization',
        '@id': papelizHelpOrganizationJsonLdId,
        name: 'Natad Corporation',
        url: 'https://natad.ai/',
        logo: `${papelizHelpCanonicalOrigin}/images/adam-natad/natad-corporation-icon.png`,
        founder: { '@id': papelizHelpAuthorJsonLdId },
      },
      {
        '@type': 'Person',
        '@id': papelizHelpAuthorJsonLdId,
        name: 'Adam Natad',
        alternateName: 'Jose Adam Climaco Natad',
        url: papelizHelpAbsoluteUrl('/adam-natad/'),
        worksFor: { '@id': papelizHelpOrganizationJsonLdId },
      },
      ...papelizHelpPageJsonLdNodes,
    ],
  }
}

// One guide as a technical article.
export function createPapelizHelpArticleJsonLd(papelizHelpArticleTitle: string, papelizHelpArticleSummary: string, papelizHelpArticlePath: string) {
  return {
    '@type': 'TechArticle',
    '@id': `${papelizHelpAbsoluteUrl(papelizHelpArticlePath)}#article`,
    url: papelizHelpAbsoluteUrl(papelizHelpArticlePath),
    headline: papelizHelpArticleTitle,
    description: papelizHelpArticleSummary,
    inLanguage: 'en',
    image: papelizHelpSocialBannerImage.url,
    isPartOf: { '@id': `${papelizHelpAbsoluteUrl(papelizHelpHomePath)}#webpage` },
    author: { '@id': papelizHelpAuthorJsonLdId },
    publisher: { '@id': papelizHelpOrganizationJsonLdId },
    about: { '@type': 'SoftwareApplication', name: papelizHelpSiteName, url: papelizHelpAbsoluteUrl('/') },
  }
}

// JSON for a <script type="application/ld+json">, with "<" escaped so it cannot close the tag.
export function serializePapelizHelpJsonLd(papelizHelpJsonLd: object): string {
  return JSON.stringify(papelizHelpJsonLd).replace(/</g, '\\u003c')
}
