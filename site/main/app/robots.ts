import type { MetadataRoute } from 'next'
import { papelizSiteHelpUrl } from '@/lib/papeliz-site-config'
import { papelizSiteAbsoluteUrl } from '@/lib/papeliz-site-seo'

export const dynamic = 'force-static'

// Every crawler may read everything; the site's sitemap and the help site's are both listed.
export default function papelizSiteRobots(): MetadataRoute.Robots {
  const papelizSiteSitemapUrls = ['/sitemap.xml', ...(papelizSiteHelpUrl ? [`${papelizSiteHelpUrl}sitemap.xml`] : [])]
    .map((papelizSiteSitemapPath) => papelizSiteAbsoluteUrl(papelizSiteSitemapPath))
    .filter((papelizSiteSitemapUrl): papelizSiteSitemapUrl is string => papelizSiteSitemapUrl !== null)
  return {
    rules: { userAgent: '*', allow: '/' },
    ...(papelizSiteSitemapUrls.length > 0 ? { sitemap: papelizSiteSitemapUrls } : {}),
  }
}
