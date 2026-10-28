import type { MetadataRoute } from 'next'
import { papelizSiteAbsoluteUrl } from '@/lib/papeliz-site-seo'

export const dynamic = 'force-static'

export default function papelizSiteRobots(): MetadataRoute.Robots {
  const papelizSiteSitemapUrl = papelizSiteAbsoluteUrl('/sitemap.xml')
  return {
    rules: { userAgent: '*', allow: '/' },
    ...(papelizSiteSitemapUrl ? { sitemap: papelizSiteSitemapUrl } : {}),
  }
}
