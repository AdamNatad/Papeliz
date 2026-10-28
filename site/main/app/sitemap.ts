import type { MetadataRoute } from 'next'
import { papelizSitePagePaths } from '@/lib/papeliz-site-navigation'
import { papelizSiteAbsoluteUrl } from '@/lib/papeliz-site-seo'

export const dynamic = 'force-static'

// A sitemap needs absolute URLs, so it stays empty until the site has a public origin.
export default function papelizSiteSitemap(): MetadataRoute.Sitemap {
  return papelizSitePagePaths.flatMap((papelizSitePagePath) => {
    const papelizSitePageUrl = papelizSiteAbsoluteUrl(papelizSitePagePath)
    return papelizSitePageUrl ? [{ url: papelizSitePageUrl }] : []
  })
}
