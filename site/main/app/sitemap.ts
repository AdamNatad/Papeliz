import type { MetadataRoute } from 'next'
import { papelizSiteAppUrl } from '@/lib/papeliz-site-config'
import { papelizSitePagePaths } from '@/lib/papeliz-site-navigation'
import { papelizSiteAbsoluteUrl } from '@/lib/papeliz-site-seo'
import { createPapelizSiteTemplatePagePath } from '@/lib/papeliz-site-templates'
import { readPapelizSiteTemplatesBuildSnapshot } from '@/lib/papeliz-site-templates-build-snapshot'

export const dynamic = 'force-static'

// Every page of the site, each template's page from the build's Templates list, and the webapp's
// page. A sitemap needs absolute URLs, so it stays empty until the site has a public origin. The help
// site lists its guides in /help/sitemap.xml.
export default async function papelizSiteSitemap(): Promise<MetadataRoute.Sitemap> {
  const papelizSiteTemplatesBuildSnapshot = await readPapelizSiteTemplatesBuildSnapshot()
  const papelizSiteTemplatePagePaths = papelizSiteTemplatesBuildSnapshot.templateGallerySnapshotRows.map(createPapelizSiteTemplatePagePath)
  return [...papelizSitePagePaths, ...papelizSiteTemplatePagePaths, ...(papelizSiteAppUrl ? [papelizSiteAppUrl] : [])].flatMap((papelizSitePagePath) => {
    const papelizSitePageUrl = papelizSiteAbsoluteUrl(papelizSitePagePath)
    return papelizSitePageUrl ? [{ url: papelizSitePageUrl }] : []
  })
}
