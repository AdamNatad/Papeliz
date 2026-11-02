import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PapelizSiteTemplatePage } from '@/components/templates/papeliz-site-template-page'
import {
  PapelizSiteTemplatesListPage,
  papelizSiteTemplatesListPageDescription,
  papelizSiteTemplatesListPageTitle,
} from '@/components/templates/papeliz-site-templates-list-page'
import { createPapelizSitePageMetadata } from '@/lib/papeliz-site-seo'
import { createPapelizSiteTemplatePagePath, type PapelizSiteTemplatesSnapshotRow } from '@/lib/papeliz-site-templates'
import { readPapelizSiteTemplatesBuildSnapshot } from '@/lib/papeliz-site-templates-build-snapshot'

// Papeliz Templates on the website (the Templates plan's phase 8), as one route: /templates/ is the
// list, and /templates/<owner>/<repository>/ is each template the build knew. One route, so the list
// page is always there to build even while no template is listed: a static export refuses a route
// with no pages.
type PapelizSiteTemplatesRouteParams = { templateRepositoryPath?: string[] }

// Only the list and the templates the build knew get a page; any other address is the 404 page.
export const dynamicParams = false

export async function generateStaticParams(): Promise<PapelizSiteTemplatesRouteParams[]> {
  const papelizSiteTemplatesBuildSnapshot = await readPapelizSiteTemplatesBuildSnapshot()
  return [
    { templateRepositoryPath: [] },
    ...papelizSiteTemplatesBuildSnapshot.templateGallerySnapshotRows.map((snapshotRow) => ({
      templateRepositoryPath: [snapshotRow.templateRepositoryOwner, snapshotRow.templateRepositoryName],
    })),
  ]
}

// The template an address names, null for the list, or undefined for an address that is neither.
async function readPapelizSiteTemplatesRouteTemplate(
  papelizSiteTemplatesRouteParams: Promise<PapelizSiteTemplatesRouteParams>,
): Promise<PapelizSiteTemplatesSnapshotRow | null | undefined> {
  const { templateRepositoryPath = [] } = await papelizSiteTemplatesRouteParams
  if (templateRepositoryPath.length === 0) return null
  if (templateRepositoryPath.length !== 2) return undefined
  const [templateRepositoryOwner, templateRepositoryName] = templateRepositoryPath
  const papelizSiteTemplatesBuildSnapshot = await readPapelizSiteTemplatesBuildSnapshot()
  return papelizSiteTemplatesBuildSnapshot.templateGallerySnapshotRows.find(
    (snapshotRow) => snapshotRow.templateRepositoryOwner === templateRepositoryOwner && snapshotRow.templateRepositoryName === templateRepositoryName,
  )
}

// A search result's description is about 160 characters; a longer one is cut at a word.
function shortenPapelizSiteTemplateDescription(templateDescription: string): string {
  if (templateDescription.length <= 160) return templateDescription
  return `${templateDescription.slice(0, 157).replace(/\s+\S*$/, '')}…`
}

export async function generateMetadata({ params }: { params: Promise<PapelizSiteTemplatesRouteParams> }): Promise<Metadata> {
  const papelizSiteTemplateRow = await readPapelizSiteTemplatesRouteTemplate(params)
  if (papelizSiteTemplateRow === undefined) return {}
  if (papelizSiteTemplateRow === null) {
    return createPapelizSitePageMetadata({
      papelizSitePageTitle: papelizSiteTemplatesListPageTitle,
      papelizSitePageDescription: papelizSiteTemplatesListPageDescription,
      papelizSitePagePath: '/templates/',
    })
  }
  return createPapelizSitePageMetadata({
    papelizSitePageTitle: `${papelizSiteTemplateRow.templateName} Template`,
    papelizSitePageDescription: shortenPapelizSiteTemplateDescription(papelizSiteTemplateRow.templateDescription),
    papelizSitePagePath: createPapelizSiteTemplatePagePath(papelizSiteTemplateRow),
  })
}

export default async function PapelizSiteTemplatesRoutePage({ params }: { params: Promise<PapelizSiteTemplatesRouteParams> }) {
  const papelizSiteTemplateRow = await readPapelizSiteTemplatesRouteTemplate(params)
  if (papelizSiteTemplateRow === undefined) notFound()
  const papelizSiteTemplatesBuildSnapshot = await readPapelizSiteTemplatesBuildSnapshot()
  if (papelizSiteTemplateRow === null) return <PapelizSiteTemplatesListPage papelizSiteTemplatesBuildSnapshot={papelizSiteTemplatesBuildSnapshot} />
  return (
    <PapelizSiteTemplatePage
      papelizSiteTemplateRow={papelizSiteTemplateRow}
      templateGallerySnapshotBuiltAt={papelizSiteTemplatesBuildSnapshot.templateGallerySnapshotBuiltAt}
    />
  )
}
