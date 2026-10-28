import {
  papelizSiteAppUrl,
  papelizSiteAuthorAlternateName,
  papelizSiteAuthorJobTitle,
  papelizSiteAuthorName,
  papelizSiteAuthorPagePath,
  papelizSiteAuthorPortraitPath,
  papelizSiteAuthorProfileUrls,
  papelizSiteCopyrightHolder,
  papelizSiteCopyrightYear,
  papelizSiteDescription,
  papelizSiteGitHubRepositoryUrl,
  papelizSiteName,
  papelizSiteOrganizationLogoPath,
  papelizSiteOrganizationUrl,
  papelizSitePlatformNames,
} from './papeliz-site-config'
import { papelizSiteAbsoluteUrl, papelizSiteSocialBannerPath } from './papeliz-site-seo'

// Structured data for search engines, as one linked set: the website, Natad Corporation (the
// organization behind Papeliz), Adam Natad (who made it) and Papeliz the software. Each has an @id,
// so every page, the help site and the webapp point at the same three instead of repeating them.
// The webapp's page (app/web/index.html) and the help site (site/help/lib/papeliz-help-seo.ts) use
// the same @ids. Absolute URLs need the public origin, so they are left out until it is set.

export const papelizSiteOrganizationJsonLdId = new URL('#organization', papelizSiteOrganizationUrl).toString()

export function papelizSiteAuthorJsonLdId(): string | null {
  const papelizSiteAuthorPageUrl = papelizSiteAbsoluteUrl(papelizSiteAuthorPagePath)
  return papelizSiteAuthorPageUrl ? `${papelizSiteAuthorPageUrl}#person` : null
}

export function papelizSiteWebsiteJsonLdId(): string | null {
  const papelizSiteHomeUrl = papelizSiteAbsoluteUrl('/')
  return papelizSiteHomeUrl ? `${papelizSiteHomeUrl}#website` : null
}

function papelizSiteJsonLdReference(papelizSiteJsonLdId: string | null) {
  return papelizSiteJsonLdId ? { '@id': papelizSiteJsonLdId } : {}
}

// Natad Corporation: the publisher and copyright holder, founded by Adam Natad.
export function createPapelizSiteOrganizationJsonLd() {
  const papelizSiteOrganizationLogoUrl = papelizSiteAbsoluteUrl(papelizSiteOrganizationLogoPath)
  const papelizSiteAuthorId = papelizSiteAuthorJsonLdId()
  return {
    '@type': 'Organization',
    '@id': papelizSiteOrganizationJsonLdId,
    name: papelizSiteCopyrightHolder,
    url: papelizSiteOrganizationUrl,
    ...(papelizSiteOrganizationLogoUrl ? { logo: papelizSiteOrganizationLogoUrl } : {}),
    ...(papelizSiteAuthorId ? { founder: { '@id': papelizSiteAuthorId } } : {}),
  }
}

// Adam Natad, with the profiles that name him; his own page on this site is his URL.
export function createPapelizSiteAuthorJsonLd() {
  const papelizSiteAuthorPageUrl = papelizSiteAbsoluteUrl(papelizSiteAuthorPagePath)
  const papelizSiteAuthorPortraitUrl = papelizSiteAbsoluteUrl(papelizSiteAuthorPortraitPath)
  return {
    '@type': 'Person',
    ...papelizSiteJsonLdReference(papelizSiteAuthorJsonLdId()),
    name: papelizSiteAuthorName,
    alternateName: papelizSiteAuthorAlternateName,
    jobTitle: papelizSiteAuthorJobTitle,
    ...(papelizSiteAuthorPageUrl ? { url: papelizSiteAuthorPageUrl } : {}),
    ...(papelizSiteAuthorPortraitUrl ? { image: papelizSiteAuthorPortraitUrl } : {}),
    worksFor: { '@id': papelizSiteOrganizationJsonLdId },
    sameAs: papelizSiteAuthorProfileUrls,
  }
}

export function createPapelizSiteWebsiteJsonLd() {
  const papelizSiteHomeUrl = papelizSiteAbsoluteUrl('/')
  const papelizSiteSocialBannerUrl = papelizSiteAbsoluteUrl(papelizSiteSocialBannerPath)
  return {
    '@type': 'WebSite',
    ...papelizSiteJsonLdReference(papelizSiteWebsiteJsonLdId()),
    name: papelizSiteName,
    description: papelizSiteDescription,
    inLanguage: 'en',
    ...(papelizSiteHomeUrl ? { url: papelizSiteHomeUrl } : {}),
    ...(papelizSiteSocialBannerUrl ? { image: papelizSiteSocialBannerUrl } : {}),
    publisher: { '@id': papelizSiteOrganizationJsonLdId },
    ...papelizSiteCreatorReference(),
  }
}

function papelizSiteCreatorReference() {
  const papelizSiteAuthorId = papelizSiteAuthorJsonLdId()
  return papelizSiteAuthorId ? { creator: { '@id': papelizSiteAuthorId } } : {}
}

// Papeliz as free software on every platform it names.
export function createPapelizSiteSoftwareJsonLd() {
  const papelizSiteHomeUrl = papelizSiteAbsoluteUrl('/')
  const papelizSiteSocialBannerUrl = papelizSiteAbsoluteUrl(papelizSiteSocialBannerPath)
  const papelizSiteAuthorId = papelizSiteAuthorJsonLdId()
  return {
    '@type': 'SoftwareApplication',
    ...(papelizSiteHomeUrl ? { '@id': `${papelizSiteHomeUrl}#software`, url: papelizSiteHomeUrl } : {}),
    name: papelizSiteName,
    description: papelizSiteDescription,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: papelizSitePlatformNames.join(', '),
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    license: 'https://opensource.org/license/mit',
    ...(papelizSiteAuthorId ? { author: { '@id': papelizSiteAuthorId }, creator: { '@id': papelizSiteAuthorId } } : {}),
    publisher: { '@id': papelizSiteOrganizationJsonLdId },
    copyrightHolder: { '@id': papelizSiteOrganizationJsonLdId },
    copyrightYear: papelizSiteCopyrightYear,
    ...(papelizSiteSocialBannerUrl ? { image: papelizSiteSocialBannerUrl } : {}),
    ...(papelizSiteAppUrl && papelizSiteHomeUrl ? { installUrl: new URL(papelizSiteAppUrl, papelizSiteHomeUrl).toString() } : {}),
    ...(papelizSiteGitHubRepositoryUrl ? { codeRepository: papelizSiteGitHubRepositoryUrl } : {}),
  }
}

// The set every page carries: the website, the organization and the author. A page adds its own
// nodes (the home page adds the software).
export function createPapelizSiteJsonLdGraph(papelizSitePageJsonLdNodes: readonly object[] = []) {
  return {
    '@context': 'https://schema.org',
    '@graph': [createPapelizSiteWebsiteJsonLd(), createPapelizSiteOrganizationJsonLd(), createPapelizSiteAuthorJsonLd(), ...papelizSitePageJsonLdNodes],
  }
}

// JSON for a <script type="application/ld+json">, with "<" escaped so it cannot close the tag.
export function serializePapelizSiteJsonLd(papelizSiteJsonLd: object): string {
  return JSON.stringify(papelizSiteJsonLd).replace(/</g, '\\u003c')
}
