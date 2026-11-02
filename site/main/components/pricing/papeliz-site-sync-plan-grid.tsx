'use client'

import { Check } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import {
  describePapelizSiteSyncFreePlanLimits,
  describePapelizSiteSyncPlanLimits,
  formatPapelizSiteSyncUsd,
  createPapelizSiteSyncSignUpHref,
  papelizSiteSyncFreePlan,
  papelizSiteSyncFreeSignUpHref,
  papelizSiteSyncPlans,
  readPapelizSiteSyncPlanMonthlyRateUsd,
  type PapelizSiteSyncBillingPeriod,
  type PapelizSiteSyncFreePlanId,
  type PapelizSiteSyncPlan,
  type PapelizSiteSyncPlanId,
} from '@/lib/papeliz-site-sync-plans'
import { PapelizSiteBillingPeriodSwitch } from './papeliz-site-billing-period-switch'
import { createPapelizSiteYearlySavingsBadgeInfo, papelizSiteSyncYearlyMonthsSaved } from './papeliz-site-yearly-savings-info'

// What Pricing's paid Sync card lists: what the add-on does, with the plans themselves on the Sync
// page. Free has its own card beside it.
const papelizSiteSyncAddOnCardLines = [
  'Sync notes across web, desktop and mobile',
  'End-to-end encryption for the vaults you choose',
  'Edits from every device merge',
  'Choose where your notes are stored',
  'Standard, Plus and Pro plans',
]

type PapelizSiteSyncPlanCardProps = {
  papelizSiteSyncPlanCardPlanId: PapelizSiteSyncPlanId | PapelizSiteSyncFreePlanId
  papelizSiteSyncPlanCardTitle: string
  papelizSiteSyncPlanCardPriceUsd: number
  // Under the price: how a paid plan is billed, or that Free needs no card.
  papelizSiteSyncPlanCardPriceNote: string
  papelizSiteSyncPlanCardSignUpHref: string | null
  papelizSiteSyncPlanCardLines: string[]
  // Pricing's card links to the Sync page; the Sync page's own cards do not.
  papelizSiteSyncPlanCardShowsLearnMore: boolean
}

// One card: the name, the price for a month, how it is billed, Sign up (and Learn more on Pricing),
// then its lines with green checks.
function PapelizSiteSyncPlanCard({
  papelizSiteSyncPlanCardPlanId,
  papelizSiteSyncPlanCardTitle,
  papelizSiteSyncPlanCardPriceUsd,
  papelizSiteSyncPlanCardPriceNote,
  papelizSiteSyncPlanCardSignUpHref,
  papelizSiteSyncPlanCardLines,
  papelizSiteSyncPlanCardShowsLearnMore,
}: PapelizSiteSyncPlanCardProps) {
  const papelizSiteSyncPlanButtonClassName =
    'flex min-h-12 items-center justify-center rounded-full px-3 py-2 text-base font-medium transition-colors'
  return (
    <article
      data-papeliz-site-sync-plan={papelizSiteSyncPlanCardPlanId}
      className="flex min-w-0 flex-col rounded-3xl border border-papeliz-line bg-papeliz-surface-soft p-7 sm:p-8"
    >
      <h3 className="text-xl leading-7 font-semibold tracking-tight">{papelizSiteSyncPlanCardTitle}</h3>
      <div className="mt-6 flex items-baseline gap-1">
        <span className="text-5xl leading-[1.15] font-semibold tracking-[-0.04em]">{formatPapelizSiteSyncUsd(papelizSiteSyncPlanCardPriceUsd)}</span>
        <span className="text-sm text-papeliz-ink-subtle">USD</span>
      </div>
      {/* "USD" alone beside the price (Adam, 2026-10-31); the line under it says how it is billed, or that Free needs no card. */}
      <p className="mt-2 min-h-6 text-base text-papeliz-ink-muted">{papelizSiteSyncPlanCardPriceNote}</p>
      <div className="mt-10 grid gap-3">
        {papelizSiteSyncPlanCardSignUpHref && (
          <a
            href={papelizSiteSyncPlanCardSignUpHref}
            className={`${papelizSiteSyncPlanButtonClassName} bg-papeliz-blue text-papeliz-on-blue hover:bg-papeliz-blue-hover`}
          >
            Sign up
          </a>
        )}
        {papelizSiteSyncPlanCardShowsLearnMore && (
          <Link
            href="/sync/"
            className={`${papelizSiteSyncPlanButtonClassName} border-[1.5px] border-papeliz-blue bg-papeliz-surface text-papeliz-blue hover:bg-papeliz-blue-soft`}
          >
            Learn more
          </Link>
        )}
      </div>
      <ul className="mt-8 grid gap-2 text-base leading-6">
        {papelizSiteSyncPlanCardLines.map((papelizSiteSyncPlanCardLine) => (
          <li key={papelizSiteSyncPlanCardLine} className="flex items-start gap-2.5">
            <Check className="mt-[3px] size-[18px] shrink-0 text-papeliz-diff-added-ink" aria-hidden="true" />
            <span>{papelizSiteSyncPlanCardLine}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}

type PapelizSiteSyncPlanGridProps = {
  // Pricing shows the Free card and one Sync card at the starting price, as an add-on, each linking
  // to the Sync page; the Sync page shows every plan with its limits.
  papelizSiteSyncPlanGridShows: 'add-on-card' | 'every-plan'
}

// The Free plan's card: no price, no checkout, and the same on every billing period.
function PapelizSiteSyncFreePlanCard({ papelizSiteSyncPlanCardShowsLearnMore }: { papelizSiteSyncPlanCardShowsLearnMore: boolean }) {
  return (
    <PapelizSiteSyncPlanCard
      papelizSiteSyncPlanCardPlanId={papelizSiteSyncFreePlan.papelizSiteSyncFreePlanId}
      papelizSiteSyncPlanCardTitle={papelizSiteSyncFreePlan.papelizSiteSyncFreePlanName}
      papelizSiteSyncPlanCardPriceUsd={0}
      papelizSiteSyncPlanCardPriceNote="No card needed"
      papelizSiteSyncPlanCardSignUpHref={papelizSiteSyncFreeSignUpHref}
      papelizSiteSyncPlanCardLines={describePapelizSiteSyncFreePlanLimits()}
      papelizSiteSyncPlanCardShowsLearnMore={papelizSiteSyncPlanCardShowsLearnMore}
    />
  )
}

// A paid plan's card, at its price for the billing period chosen.
function PapelizSiteSyncPaidPlanCard({
  papelizSiteSyncPlanCardTitle,
  papelizSiteSyncPlan,
  papelizSiteSyncBillingPeriod,
  papelizSiteSyncPlanCardLines,
  papelizSiteSyncPlanCardShowsLearnMore,
}: {
  papelizSiteSyncPlanCardTitle: string
  papelizSiteSyncPlan: PapelizSiteSyncPlan
  papelizSiteSyncBillingPeriod: PapelizSiteSyncBillingPeriod
  papelizSiteSyncPlanCardLines: string[]
  papelizSiteSyncPlanCardShowsLearnMore: boolean
}) {
  return (
    <PapelizSiteSyncPlanCard
      papelizSiteSyncPlanCardPlanId={papelizSiteSyncPlan.papelizSiteSyncPlanId}
      papelizSiteSyncPlanCardTitle={papelizSiteSyncPlanCardTitle}
      papelizSiteSyncPlanCardPriceUsd={readPapelizSiteSyncPlanMonthlyRateUsd(papelizSiteSyncPlan, papelizSiteSyncBillingPeriod)}
      papelizSiteSyncPlanCardPriceNote={papelizSiteSyncBillingPeriod === 'yearly' ? 'Per month, billed yearly' : 'Billed monthly'}
      papelizSiteSyncPlanCardSignUpHref={createPapelizSiteSyncSignUpHref(papelizSiteSyncPlan.papelizSiteSyncPlanId, papelizSiteSyncBillingPeriod)}
      papelizSiteSyncPlanCardLines={papelizSiteSyncPlanCardLines}
      papelizSiteSyncPlanCardShowsLearnMore={papelizSiteSyncPlanCardShowsLearnMore}
    />
  )
}

// Papeliz Sync under the Monthly / Yearly switch. Yearly is chosen first; its badge counts the
// saving in months, and its info mark opens the table behind it.
export function PapelizSiteSyncPlanGrid({ papelizSiteSyncPlanGridShows }: PapelizSiteSyncPlanGridProps) {
  const [papelizSiteChosenSyncBillingPeriod, setPapelizSiteChosenSyncBillingPeriod] = useState<PapelizSiteSyncBillingPeriod>('yearly')
  return (
    <>
      <div className="mt-6 mb-8">
        <PapelizSiteBillingPeriodSwitch
          papelizSiteBillingPeriodSwitchLabel="Billing period"
          papelizSiteChosenBillingPeriod={papelizSiteChosenSyncBillingPeriod}
          onPapelizSiteBillingPeriodChoose={setPapelizSiteChosenSyncBillingPeriod}
          papelizSiteBillingPeriodChoices={[
            { papelizSiteBillingPeriodChoiceValue: 'monthly', papelizSiteBillingPeriodChoiceLabel: 'Monthly' },
            {
              papelizSiteBillingPeriodChoiceValue: 'yearly',
              papelizSiteBillingPeriodChoiceLabel: 'Yearly',
              papelizSiteBillingPeriodChoiceBadge: `Save ${papelizSiteSyncYearlyMonthsSaved} Months`,
            },
          ]}
          papelizSiteBillingPeriodBadgeInfo={createPapelizSiteYearlySavingsBadgeInfo()}
        />
      </div>
      {papelizSiteSyncPlanGridShows === 'add-on-card' ? (
        // Free beside the paid Sync card (Adam, 2026-11-02), stacked on a phone.
        <div className="mx-auto grid max-w-sm grid-cols-1 gap-6 sm:max-w-3xl sm:grid-cols-2">
          <PapelizSiteSyncFreePlanCard papelizSiteSyncPlanCardShowsLearnMore />
          <PapelizSiteSyncPaidPlanCard
            papelizSiteSyncPlanCardTitle="Sync"
            papelizSiteSyncPlan={papelizSiteSyncPlans[0]!}
            papelizSiteSyncBillingPeriod={papelizSiteChosenSyncBillingPeriod}
            papelizSiteSyncPlanCardLines={papelizSiteSyncAddOnCardLines}
            papelizSiteSyncPlanCardShowsLearnMore
          />
        </div>
      ) : (
        // Free first, then the paid plans: two by two on a tablet, four across on a wide screen.
        <div className="mx-auto grid max-w-md grid-cols-1 gap-6 md:max-w-3xl md:grid-cols-2 xl:max-w-none xl:grid-cols-4">
          <PapelizSiteSyncFreePlanCard papelizSiteSyncPlanCardShowsLearnMore={false} />
          {papelizSiteSyncPlans.map((papelizSiteSyncPlan) => (
            <PapelizSiteSyncPaidPlanCard
              key={papelizSiteSyncPlan.papelizSiteSyncPlanId}
              papelizSiteSyncPlanCardTitle={papelizSiteSyncPlan.papelizSiteSyncPlanName}
              papelizSiteSyncPlan={papelizSiteSyncPlan}
              papelizSiteSyncBillingPeriod={papelizSiteChosenSyncBillingPeriod}
              papelizSiteSyncPlanCardLines={describePapelizSiteSyncPlanLimits(papelizSiteSyncPlan)}
              papelizSiteSyncPlanCardShowsLearnMore={false}
            />
          ))}
        </div>
      )}
    </>
  )
}
