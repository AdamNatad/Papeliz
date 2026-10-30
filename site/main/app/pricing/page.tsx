import { PapelizSiteCenteredPageHero } from '@/components/marketing/papeliz-site-centered-page-hero'
import { PapelizSiteQuestionList } from '@/components/pricing/papeliz-site-question-list'
import { PapelizSiteSyncPlanGrid } from '@/components/pricing/papeliz-site-sync-plan-grid'
import { createPapelizSitePageMetadata } from '@/lib/papeliz-site-seo'
import { papelizSitePricingQuestions } from '@/lib/papeliz-site-sync-questions'

export const metadata = createPapelizSitePageMetadata({
  papelizSitePageTitle: 'Pricing',
  papelizSitePageDescription:
    'Papeliz is free without limits, with no sign-up. Papeliz Sync, the optional add-on, keeps your notes end-to-end encrypted on every device, from $4 a month billed yearly.',
  papelizSitePagePath: '/pricing/',
})

// Pricing (Adam, 2026-10-31): Papeliz is free without limits; Papeliz Sync, the one add-on, as one card at
// its starting price (every plan is on the Sync page); then the questions.
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

      <section id="sync" aria-labelledby="papeliz-site-pricing-sync-title" className="mt-16 scroll-mt-31 md:scroll-mt-20">
        <h2 id="papeliz-site-pricing-sync-title" className="sr-only">
          Papeliz Sync
        </h2>
        <p className="mx-auto max-w-[460px] text-center text-[21px] leading-[1.35] tracking-tight sm:text-2xl">
          An optional add-on keeps your notes in sync on every device.
        </p>
        <PapelizSiteSyncPlanGrid papelizSiteSyncPlanGridShows="add-on-card" />
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
