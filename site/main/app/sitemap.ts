import type { MetadataRoute } from 'next'
import { papelizSiteAppUrl } from '@/lib/papeliz-site-config'
import { papelizSitePagePaths } from '@/lib/papeliz-site-navigation'
import { papelizSiteAbsoluteUrl } from '@/lib/papeliz-site-seo'

export const dynamic = 'force-static'

// Every page of the site and the webapp's page. A sitemap needs absolute URLs, so it stays empty
// until the site has a public origin. The help site lists its guides in /help/sitemap.xml.
export default function papelizSiteSitemap(): MetadataRoute.Sitemap {
  return [...papelizSitePagePaths, ...(papelizSiteAppUrl ? [papelizSiteAppUrl] : [])].flatMap((papelizSitePagePath) => {
    const papelizSitePageUrl = papelizSiteAbsoluteUrl(papelizSitePagePath)
    return papelizSitePageUrl ? [{ url: papelizSitePageUrl }] : []
  })
}
