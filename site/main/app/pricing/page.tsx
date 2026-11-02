import Link from 'next/link'
import { PapelizSiteCenteredPageHero } from '@/components/marketing/papeliz-site-centered-page-hero'
import { PapelizSiteQuestionList } from '@/components/pricing/papeliz-site-question-list'
import { PapelizSiteSyncPlanGrid } from '@/components/pricing/papeliz-site-sync-plan-grid'
import { createPapelizSitePageMetadata } from '@/lib/papeliz-site-seo'
import { formatPapelizSiteSyncUsd, readPapelizSiteSyncStartingYearlyMonthlyRateUsd } from '@/lib/papeliz-site-sync-plans'
import { papelizSitePricingQuestions } from '@/lib/papeliz-site-sync-questions'

export const metadata = createPapelizSitePageMetadata({
  papelizSitePageTitle: 'Pricing',
  papelizSitePageDescription: `Papeliz is free without limits, with no sign-up. Papeliz Sync, the optional add-on, keeps your notes on every device, with end-to-end encryption for the vaults you choose, on a Free plan or from ${formatPapelizSiteSyncUsd(readPapelizSiteSyncStartingYearlyMonthlyRateUsd())} a month billed yearly.`,
  papelizSitePagePath: '/pricing/',
})

// Pricing (Adam, 2026-10-31): Papeliz is free without limits; then Papeliz Sync, the one add-on, with
// every plan as the Sync page shows it (Adam, 2026-11-02: "A · Four cards"); then the questions.
export default function PapelizSitePricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
      <PapelizSiteCenteredPageHero papelizSiteCenteredPageHeroHeading="Free without limits." papelizSiteCenteredPageHeroHeadingIsUnderlined>
        <p>
          No sign-up required.
          <br />
          Open source, on your own AI key.
        </p>
      </PapelizSiteCenteredPageHero>

      {/* The heading shows, so the Free card reads as Sync's Free plan, not the free app above. */}
      <section id="sync" aria-labelledby="papeliz-site-pricing-sync-title" className="mt-16 scroll-mt-31 md:scroll-mt-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="papeliz-site-pricing-sync-title" className="text-3xl leading-tight font-normal tracking-tight sm:text-4xl">
            Papeliz Sync
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-papeliz-ink-muted sm:text-lg">
            An optional add-on that keeps your notes in sync on every device.
          </p>
        </div>
        <PapelizSiteSyncPlanGrid />
        <p className="mt-8 text-center text-[15px]">
          <Link href="/sync/" className="font-medium text-papeliz-blue underline-offset-3 hover:underline">
            How Sync works
          </Link>
        </p>
      </section>

      <PapelizSiteQuestionList
        papelizSiteQuestionListAnchor="pricing-questions"
        papelizSiteQuestionListHeading="FAQ"
        papelizSiteQuestionListLead="Frequently asked questions about pricing"
        papelizSiteQuestions={papelizSitePricingQuestions}
      />
    </div>
  )
}
