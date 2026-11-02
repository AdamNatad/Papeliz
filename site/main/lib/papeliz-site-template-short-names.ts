import { createPapelizSiteTemplatePagePath, type PapelizSiteTemplatesSnapshotRow } from './papeliz-site-templates'

// Short addresses for Featured templates: papeliz.com/templates/<short name>, with or without the
// trailing slash, sends a visitor with a permanent redirect to the template's own page,
// /templates/<owner>/<repository>/. The site build writes them into the export's _redirects
// (app/%5Fredirects/route.ts), which Cloudflare's static assets honor. The template page's
// canonical address stays the full one, and the sitemap lists only that.
//
// Each short name maps to a template's gallery ID, `<owner>/<repository>`.
export const papelizSiteTemplateGalleryIdByShortName: Readonly<Record<string, string>> = {
  'p1-workflow': 'AdamNatad/P1-Workflow',
}

// Lowercase words joined by single hyphens, as a short name is typed.
const papelizSiteTemplateShortNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const papelizSiteTemplateGalleryIdPattern = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/
// Moved for good, so search engines and bookmarks take the full address.
const papelizSiteTemplateShortNameRedirectStatus = 301

export type PapelizSiteTemplateShortNameRedirects = {
  // Two _redirects lines per short name: without and with the trailing slash.
  templateShortNameRedirectLines: string[]
  // Short names whose template isn't on this build's list, so it has no page to send them to.
  templateShortNamesWithoutPage: string[]
}

// The _redirects lines for the short names whose template is on the build's Templates list. Throws,
// and so stops the build, when a short name isn't one, when it points at no `<owner>/<repository>`,
// or when it equals an owner on the list (GitHub owner names ignore case), since /templates/<owner>/
// belongs to that owner's templates.
export function createPapelizSiteTemplateShortNameRedirects(
  templateGalleryIdByShortName: Readonly<Record<string, string>>,
  templateGallerySnapshotRows: readonly Pick<PapelizSiteTemplatesSnapshotRow, 'papelizTemplateGalleryId' | 'templateRepositoryOwner' | 'templateRepositoryName'>[],
): PapelizSiteTemplateShortNameRedirects {
  const templateRepositoryOwnersLowercase = new Set(templateGallerySnapshotRows.map((snapshotRow) => snapshotRow.templateRepositoryOwner.toLowerCase()))
  const templateShortNameRedirects: PapelizSiteTemplateShortNameRedirects = { templateShortNameRedirectLines: [], templateShortNamesWithoutPage: [] }
  for (const [templateShortName, papelizTemplateGalleryId] of Object.entries(templateGalleryIdByShortName)) {
    if (!papelizSiteTemplateShortNamePattern.test(templateShortName)) {
      throw new Error(`The template short name "${templateShortName}" must be lowercase words joined by hyphens.`)
    }
    if (!papelizSiteTemplateGalleryIdPattern.test(papelizTemplateGalleryId)) {
      throw new Error(`The template short name "${templateShortName}" points at "${papelizTemplateGalleryId}", which is not <owner>/<repository>.`)
    }
    if (templateRepositoryOwnersLowercase.has(templateShortName)) {
      throw new Error(`The template short name "${templateShortName}" is also an owner on the Templates list, whose /templates/${templateShortName}/ it would shadow.`)
    }
    const templateSnapshotRow = templateGallerySnapshotRows.find((snapshotRow) => snapshotRow.papelizTemplateGalleryId === papelizTemplateGalleryId)
    if (!templateSnapshotRow) {
      templateShortNameRedirects.templateShortNamesWithoutPage.push(templateShortName)
      continue
    }
    const templatePagePath = createPapelizSiteTemplatePagePath(templateSnapshotRow)
    templateShortNameRedirects.templateShortNameRedirectLines.push(
      `/templates/${templateShortName} ${templatePagePath} ${papelizSiteTemplateShortNameRedirectStatus}`,
      `/templates/${templateShortName}/ ${templatePagePath} ${papelizSiteTemplateShortNameRedirectStatus}`,
    )
  }
  return templateShortNameRedirects
}
