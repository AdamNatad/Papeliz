import Link from 'next/link'
import { Check } from 'lucide-react'
import { PapelizSitePageIntro } from '@/components/marketing/papeliz-site-page-intro'
import { papelizSiteAfterLaunchFeatures, papelizSiteFeatureGroups } from '@/lib/papeliz-site-features'
import { createPapelizSitePageMetadata } from '@/lib/papeliz-site-seo'

export const metadata = createPapelizSitePageMetadata({
  papelizSitePageTitle: 'Features',
  papelizSitePageDescription:
    'Everything in the Papeliz launch build: a vault of plain Markdown files, MD Code and MD View, and an assistant that edits on your own key.',
  papelizSitePagePath: '/features/',
})

export default function PapelizSiteFeaturesPage() {
  return (
    <>
      <PapelizSitePageIntro papelizSitePageHeading="Everything Papeliz does at launch">
        <p>
          Papeliz is in development. This page lists what the first public release includes; the
          last section lists what comes after it.
        </p>
      </PapelizSitePageIntro>

      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="hidden lg:block">
          <ul className="sticky top-24 space-y-1 text-[15px]">
            {papelizSiteFeatureGroups.map((papelizSiteFeatureGroup) => (
              <li key={papelizSiteFeatureGroup.papelizSiteFeatureGroupAnchor}>
                <a
                  href={`#${papelizSiteFeatureGroup.papelizSiteFeatureGroupAnchor}`}
                  className="block rounded-full px-3 py-1.5 text-papeliz-ink-muted hover:bg-papeliz-hover hover:text-papeliz-ink"
                >
                  {papelizSiteFeatureGroup.papelizSiteFeatureGroupTitle}
                </a>
              </li>
            ))}
            <li>
              <a href="#after-launch" className="block rounded-full px-3 py-1.5 text-papeliz-ink-muted hover:bg-papeliz-hover hover:text-papeliz-ink">
                After launch
              </a>
            </li>
          </ul>
        </nav>

        <div className="space-y-16">
          {papelizSiteFeatureGroups.map((papelizSiteFeatureGroup) => (
            <section key={papelizSiteFeatureGroup.papelizSiteFeatureGroupAnchor} id={papelizSiteFeatureGroup.papelizSiteFeatureGroupAnchor} className="scroll-mt-35 md:scroll-mt-24">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-papeliz-blue-soft text-papeliz-blue">
                  <papelizSiteFeatureGroup.papelizSiteFeatureGroupIcon className="size-5" aria-hidden="true" />
                </span>
                <h2 className="text-2xl font-semibold tracking-tight">{papelizSiteFeatureGroup.papelizSiteFeatureGroupTitle}</h2>
              </div>
              <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-papeliz-ink-muted">{papelizSiteFeatureGroup.papelizSiteFeatureGroupSummary}</p>
              <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {papelizSiteFeatureGroup.papelizSiteFeatureGroupPoints.map((papelizSiteFeaturePoint) => (
                  <div key={papelizSiteFeaturePoint.papelizSiteFeaturePointTitle} className="border-t border-papeliz-line pt-4">
                    <dt className="font-semibold">{papelizSiteFeaturePoint.papelizSiteFeaturePointTitle}</dt>
                    <dd className="mt-1 text-[15px] leading-relaxed text-papeliz-ink-muted">{papelizSiteFeaturePoint.papelizSiteFeaturePointBody}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}

          <section id="after-launch" className="scroll-mt-35 md:scroll-mt-24 rounded-3xl bg-papeliz-surface-soft p-6 sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight">After launch</h2>
            <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-papeliz-ink-muted">
              Planned for later and not scheduled yet. The <Link href="/roadmap/" className="font-medium text-papeliz-blue hover:underline">roadmap</Link> shows the order.
            </p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {papelizSiteAfterLaunchFeatures.map((papelizSiteAfterLaunchFeature) => (
                <li key={papelizSiteAfterLaunchFeature} className="flex gap-2.5 text-[15px]">
                  <Check className="mt-1 size-4 shrink-0 text-papeliz-ink-subtle" aria-hidden="true" />
                  {papelizSiteAfterLaunchFeature}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}
