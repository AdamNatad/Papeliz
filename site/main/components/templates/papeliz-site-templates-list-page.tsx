import { PapelizSiteCenteredPageHero } from '@/components/marketing/papeliz-site-centered-page-hero'
import type { PapelizSiteTemplatesSnapshot } from '@/lib/papeliz-site-templates'
import { PapelizSiteTemplatesList } from './papeliz-site-templates-list'

export const papelizSiteTemplatesListPageTitle = 'Templates'
export const papelizSiteTemplatesListPageDescription =
  'Start a Papeliz vault from a template: a public GitHub repository shared by its author, checked by Papeliz, and opened in Papeliz in one step.'

// The Templates list page (/templates/): the list the site build read, one row per template with
// Open in Papeliz, refreshed in the browser from the same hourly list. Submitting and voting stay in
// the app.
export function PapelizSiteTemplatesListPage({ papelizSiteTemplatesBuildSnapshot }: { papelizSiteTemplatesBuildSnapshot: PapelizSiteTemplatesSnapshot }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
      <PapelizSiteCenteredPageHero papelizSiteCenteredPageHeroHeading="Start from a template.">
        <p>Vaults people share from their own GitHub repositories. Papeliz checks each one, then makes it a new vault for you.</p>
      </PapelizSiteCenteredPageHero>

      <section aria-label="Templates" className="mt-12">
        <PapelizSiteTemplatesList
          papelizSiteTemplatesBuildSnapshot={papelizSiteTemplatesBuildSnapshot}
          papelizSiteTemplateIdsWithPages={papelizSiteTemplatesBuildSnapshot.templateGallerySnapshotRows.map((snapshotRow) => snapshotRow.papelizTemplateGalleryId)}
        />
      </section>

      <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-papeliz-ink-muted">
        Share your own from Papeliz: open Templates on the start screen, then Submit Template. Submitting and voting need a free Papeliz
        account; using a template needs none.
      </p>
    </div>
  )
}
