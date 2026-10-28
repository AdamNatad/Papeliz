import {
  papelizSiteAppUrl,
  papelizSiteAuthorName,
  papelizSiteCopyrightHolder,
  papelizSiteDescription,
  papelizSiteGitHubRepositoryUrl,
  papelizSiteName,
  papelizSitePlatformNames,
} from './papeliz-site-config'
import { papelizSiteAbsoluteUrl, papelizSiteSocialBannerPath } from './papeliz-site-seo'

// Structured data for search engines: Papeliz as free software on every platform it names.
export function createPapelizSiteSoftwareJsonLd() {
  const papelizSiteHomeUrl = papelizSiteAbsoluteUrl('/')
  const papelizSiteSocialBannerUrl = papelizSiteAbsoluteUrl(papelizSiteSocialBannerPath)
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: papelizSiteName,
    description: papelizSiteDescription,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: papelizSitePlatformNames.join(', '),
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    license: 'https://opensource.org/license/mit',
    author: { '@type': 'Person', name: papelizSiteAuthorName },
    publisher: { '@type': 'Organization', name: papelizSiteCopyrightHolder },
    ...(papelizSiteHomeUrl ? { url: papelizSiteHomeUrl } : {}),
    ...(papelizSiteSocialBannerUrl ? { image: papelizSiteSocialBannerUrl } : {}),
    ...(papelizSiteAppUrl && papelizSiteHomeUrl ? { installUrl: new URL(papelizSiteAppUrl, papelizSiteHomeUrl).toString() } : {}),
    ...(papelizSiteGitHubRepositoryUrl ? { codeRepository: papelizSiteGitHubRepositoryUrl } : {}),
  }
}

// JSON for a <script type="application/ld+json">, with "<" escaped so it cannot close the tag.
export function serializePapelizSiteJsonLd(papelizSiteJsonLd: object): string {
  return JSON.stringify(papelizSiteJsonLd).replace(/</g, '\\u003c')
}
