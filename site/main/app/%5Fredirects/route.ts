import { createPapelizSiteTemplateShortNameRedirects, papelizSiteTemplateGalleryIdByShortName } from '@/lib/papeliz-site-template-short-names'
import { readPapelizSiteTemplatesBuildSnapshot } from '@/lib/papeliz-site-templates-build-snapshot'

// The export's _redirects file, which Cloudflare's static assets read: the short addresses of
// Featured templates (lib/papeliz-site-template-short-names.ts), each a permanent redirect to the
// template's own page. The folder is "%5Fredirects" because the App Router keeps folders that start
// with "_" out of routing; %5F is "_" in an address, so the file is written as out/_redirects.
//
// It reads the same Templates list the pages are built from: the build stops when a short name
// equals an owner on it, and a short name whose template isn't on it is left out, since its page
// isn't built. scripts/verify-papeliz-site-export.mjs checks that every line points at a page.
export const dynamic = 'force-static'

export async function GET(): Promise<Response> {
  const papelizSiteTemplatesBuildSnapshot = await readPapelizSiteTemplatesBuildSnapshot()
  const { templateShortNameRedirectLines, templateShortNamesWithoutPage } = createPapelizSiteTemplateShortNameRedirects(
    papelizSiteTemplateGalleryIdByShortName,
    papelizSiteTemplatesBuildSnapshot.templateGallerySnapshotRows,
  )
  for (const templateShortNameWithoutPage of templateShortNamesWithoutPage) {
    console.log(` [templates] /templates/${templateShortNameWithoutPage}/ left out of _redirects: its template isn't on this build's list.`)
  }
  const papelizSiteRedirectsLines = ['# Short addresses for Featured templates (site/main/lib/papeliz-site-template-short-names.ts).', ...templateShortNameRedirectLines]
  return new Response(`${papelizSiteRedirectsLines.join('\n')}\n`, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
