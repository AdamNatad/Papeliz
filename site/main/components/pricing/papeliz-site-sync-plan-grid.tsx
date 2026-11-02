'use client'

import { Check } from 'lucide-react'
import { useState } from 'react'
import {
  describePapelizSiteSyncFreePlanLimits,
  describePapelizSiteSyncPlanLimits,
  formatPapelizSiteSyncUsd,
  createPapelizSiteSyncSignUpHref,
  papelizSiteSyncFreePlan,
  papelizSiteSyncFreeSignUpHref,
  papelizSiteSyncPlans,
  papelizSiteSyncPreselectedBillingPeriod,
  readPapelizSiteSyncPlanMonthlyRateUsd,
  type PapelizSiteSyncBillingPeriod,
  type PapelizSiteSyncFreePlanId,
  type PapelizSiteSyncPlanId,
} from '@/lib/papeliz-site-sync-plans'
import { PapelizSiteBillingPeriodSwitch } from './papeliz-site-billing-period-switch'
import { createPapelizSiteYearlySavingsBadgeInfo, papelizSiteSyncYearlyMonthsSaved } from './papeliz-site-yearly-savings-info'

type PapelizSiteSyncPlanCardProps = {
  papelizSiteSyncPlanCardPlanId: PapelizSiteSyncPlanId | PapelizSiteSyncFreePlanId
  papelizSiteSyncPlanCardTitle: string
  papelizSiteSyncPlanCardPriceUsd: number
  // Under the price: how a paid plan is billed, or that Free needs no card. The card shows no whole
  // year's price (Adam, 2026-11-02: "dont show the total year price on the cards").
  papelizSiteSyncPlanCardPriceNote: string
  papelizSiteSyncPlanCardSignUpHref: string | null
  papelizSiteSyncPlanCardLines: string[]
}

// One card: the name, the price for a month, how it is billed, Sign up, then its lines with green checks.
function PapelizSiteSyncPlanCard({
  papelizSiteSyncPlanCardPlanId,
  papelizSiteSyncPlanCardTitle,
  papelizSiteSyncPlanCardPriceUsd,
  papelizSiteSyncPlanCardPriceNote,
  papelizSiteSyncPlanCardSignUpHref,
  papelizSiteSyncPlanCardLines,
}: PapelizSiteSyncPlanCardProps) {
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
      {papelizSiteSyncPlanCardSignUpHref && (
        <a
          href={papelizSiteSyncPlanCardSignUpHref}
          className="mt-10 flex min-h-12 items-center justify-center rounded-full bg-papeliz-blue px-3 py-2 text-base font-medium text-papeliz-on-blue transition-colors hover:bg-papeliz-blue-hover"
        >
          Sign up
        </a>
      )}
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

// Papeliz Sync's plans, the same block on the Pricing and Sync pages (Adam, 2026-11-02: "A · Four
// cards"): the Monthly / Yearly switch, then Free and the three paid plans, each with every limit.
// Yearly is chosen on load; its badge counts the saving in months, and its info mark opens the table
// behind it.
export function PapelizSiteSyncPlanGrid() {
  const [papelizSiteChosenSyncBillingPeriod, setPapelizSiteChosenSyncBillingPeriod] = useState<PapelizSiteSyncBillingPeriod>(papelizSiteSyncPreselectedBillingPeriod)
  return (
    <>
      <div className="mt-6 mb-8">
        <PapelizSiteBillingPeriodSwitch
          papelizSiteBillingPeriodSwitchLabel="Billing period"
          papelizSiteChosenBillingPeriod={papelizSiteChosenSyncBillingPeriod}
          onPapelizSiteBillingPeriodChoose={setPapelizSiteChosenSyncBillingPeriod}
          // Monthly on the left, Yearly on the right and chosen (Adam, 2026-11-02), as on the account page.
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
      {/* Free first, then the paid plans: two by two on a tablet, four across on a wide screen. */}
      <div className="mx-auto grid max-w-md grid-cols-1 gap-6 md:max-w-3xl md:grid-cols-2 xl:max-w-none xl:grid-cols-4">
        <PapelizSiteSyncPlanCard
          papelizSiteSyncPlanCardPlanId={papelizSiteSyncFreePlan.papelizSiteSyncFreePlanId}
          papelizSiteSyncPlanCardTitle={papelizSiteSyncFreePlan.papelizSiteSyncFreePlanName}
          papelizSiteSyncPlanCardPriceUsd={0}
          papelizSiteSyncPlanCardPriceNote="No card needed"
          papelizSiteSyncPlanCardSignUpHref={papelizSiteSyncFreeSignUpHref}
          papelizSiteSyncPlanCardLines={describePapelizSiteSyncFreePlanLimits()}
        />
        {papelizSiteSyncPlans.map((papelizSiteSyncPlan) => (
          <PapelizSiteSyncPlanCard
            key={papelizSiteSyncPlan.papelizSiteSyncPlanId}
            papelizSiteSyncPlanCardPlanId={papelizSiteSyncPlan.papelizSiteSyncPlanId}
            papelizSiteSyncPlanCardTitle={papelizSiteSyncPlan.papelizSiteSyncPlanName}
            papelizSiteSyncPlanCardPriceUsd={readPapelizSiteSyncPlanMonthlyRateUsd(papelizSiteSyncPlan, papelizSiteChosenSyncBillingPeriod)}
            papelizSiteSyncPlanCardPriceNote={papelizSiteChosenSyncBillingPeriod === 'yearly' ? 'Per month, billed yearly' : 'Billed monthly'}
            papelizSiteSyncPlanCardSignUpHref={createPapelizSiteSyncSignUpHref(papelizSiteSyncPlan.papelizSiteSyncPlanId, papelizSiteChosenSyncBillingPeriod)}
            papelizSiteSyncPlanCardLines={describePapelizSiteSyncPlanLimits(papelizSiteSyncPlan)}
          />
        ))}
      </div>
    </>
  )
}
