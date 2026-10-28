import type { MetadataRoute } from 'next'
import { papelizHelpArticles } from '@/lib/papeliz-help-content'
import { papelizHelpAbsoluteUrl, papelizHelpHomePath } from '@/lib/papeliz-help-seo'

export const dynamic = 'force-static'

// The help home and every guide, served as /help/sitemap.xml; the website's robots file lists it.
export default function papelizHelpSitemap(): MetadataRoute.Sitemap {
  return [
    { url: papelizHelpAbsoluteUrl(papelizHelpHomePath) },
    ...papelizHelpArticles.map((papelizHelpArticle) => ({
      url: papelizHelpAbsoluteUrl(`${papelizHelpHomePath}${papelizHelpArticle.papelizHelpArticleSlug}/`),
    })),
  ]
}
