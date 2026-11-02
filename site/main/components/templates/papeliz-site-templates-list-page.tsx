import { PapelizSiteCenteredPageHero } from '@/components/marketing/papeliz-site-centered-page-hero'
import { isPapelizSiteTemplatesOpen } from '@/lib/papeliz-site-config'
import type { PapelizSiteTemplatesSnapshot } from '@/lib/papeliz-site-templates'
import { PapelizSiteTemplatesList } from './papeliz-site-templates-list'

export const papelizSiteTemplatesListPageTitle = 'Templates'
export const papelizSiteTemplatesListPageDescription =
  'Start a Papeliz vault from a template: a public GitHub repository shared by its author, checked by Papeliz, and opened in Papeliz in one step.'

// The Templates list page (/templates/): the list the site build read, one row per template with
// Open in Papeliz, refreshed in the browser from the same hourly list. Submitting and voting stay in
// the app. While Templates are closed, a line above the list says they open with Sync, and the line under
// it leaves out Submit Template.
export function PapelizSiteTemplatesListPage({ papelizSiteTemplatesBuildSnapshot }: { papelizSiteTemplatesBuildSnapshot: PapelizSiteTemplatesSnapshot }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
      <PapelizSiteCenteredPageHero papelizSiteCenteredPageHeroHeading="Start from a template.">
        <p>Vaults people share from their own GitHub repositories. Papeliz checks each one, then makes it a new vault for you.</p>
      </PapelizSiteCenteredPageHero>

      <section aria-label="Templates" className="mt-12">
        {!isPapelizSiteTemplatesOpen && (
          <p className="mx-auto mb-8 max-w-4xl rounded-2xl border border-papeliz-blue-line bg-papeliz-blue-soft px-5 py-3 text-center text-[15px] leading-relaxed text-papeliz-ink">
            <b className="font-semibold text-papeliz-blue">Templates open with Sync.</b> Here’s the first one.
          </p>
        )}
        <PapelizSiteTemplatesList
          papelizSiteTemplatesBuildSnapshot={papelizSiteTemplatesBuildSnapshot}
          papelizSiteTemplateIdsWithPages={papelizSiteTemplatesBuildSnapshot.templateGallerySnapshotRows.map((snapshotRow) => snapshotRow.papelizTemplateGalleryId)}
        />
      </section>

      <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-papeliz-ink-muted">
        {isPapelizSiteTemplatesOpen
          ? 'Make your own with Export as Template in Papeliz, put it in a public GitHub repository, and check it with Submit Template on the start screen’s Templates. Submitting and voting are coming, with a free Papeliz account; using a template needs none.'
          : 'Make your own with Export as Template in Papeliz and put it in a public GitHub repository. Submitting and voting come after Templates open.'}
      </p>
    </div>
  )
}
