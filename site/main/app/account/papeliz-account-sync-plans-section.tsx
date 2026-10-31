'use client'

import { useState } from 'react'
import { PapelizSiteBillingPeriodSwitch } from '@/components/pricing/papeliz-site-billing-period-switch'
import { createPapelizSiteYearlySavingsBadgeInfo, papelizSiteSyncYearlyMonthsSaved } from '@/components/pricing/papeliz-site-yearly-savings-info'
import {
  createPapelizSiteSyncSignUpHref,
  describePapelizSiteSyncPlanLimits,
  formatPapelizSiteSyncUsd,
  papelizSiteSyncPlans,
  readPapelizSiteSyncPlanMonthlyRateUsd,
  type PapelizSiteSyncBillingPeriod,
} from '@/lib/papeliz-site-sync-plans'
import { papelizAccountCompactPrimaryButtonClassName, papelizAccountTextLinkClassName } from './papeliz-account-card-frame'

// The account page's Sync section: what Sync is, the Monthly / Yearly switch, then the three plans,
// each with its own Subscribe (Adam, 2026-10-31). Subscribe opens Papeliz on Settings › Sync with
// that plan and period chosen, where the storage place, the passphrase and checkout happen.
export function PapelizAccountSyncPlansSection() {
  const [chosenPapelizAccountSyncBillingPeriod, setChosenPapelizAccountSyncBillingPeriod] = useState<PapelizSiteSyncBillingPeriod>('yearly')

  return (
    <>
      <p className="-mt-1 mb-5 max-w-[560px] text-sm text-pretty text-papeliz-ink-muted md:-mt-2.5 md:text-[15px]">
        Your vaults on every device, end-to-end encrypted.{' '}
        <a href="/sync/" className={papelizAccountTextLinkClassName}>
          Learn more.
        </a>
      </p>
      <div className="mb-4">
        <PapelizSiteBillingPeriodSwitch
          papelizSiteBillingPeriodSwitchVariant="compact"
          papelizSiteBillingPeriodSwitchLabel="Billing period"
          papelizSiteChosenBillingPeriod={chosenPapelizAccountSyncBillingPeriod}
          onPapelizSiteBillingPeriodChoose={setChosenPapelizAccountSyncBillingPeriod}
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
      <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-3">
        {papelizSiteSyncPlans.map((papelizSiteSyncPlan) => {
          const papelizAccountSyncSubscribeHref = createPapelizSiteSyncSignUpHref(papelizSiteSyncPlan.papelizSiteSyncPlanId, chosenPapelizAccountSyncBillingPeriod)
          return (
            <article
              key={papelizSiteSyncPlan.papelizSiteSyncPlanId}
              data-papeliz-account-sync-plan={papelizSiteSyncPlan.papelizSiteSyncPlanId}
              className="flex min-w-0 flex-col rounded-xl border border-papeliz-line bg-papeliz-surface p-4"
            >
              <h2 className="text-[15px] font-semibold">{papelizSiteSyncPlan.papelizSiteSyncPlanName}</h2>
              <p className="mt-0.5 text-[26px] leading-[1.35] font-semibold tracking-[-0.02em]">
                {formatPapelizSiteSyncUsd(readPapelizSiteSyncPlanMonthlyRateUsd(papelizSiteSyncPlan, chosenPapelizAccountSyncBillingPeriod))}{' '}
                <span className="text-sm font-normal tracking-normal text-papeliz-ink-muted">USD</span>
              </p>
              {/* "USD" alone beside the price, as on the Pricing and Sync pages; this line says it is a month's price. */}
              <p className="mt-0.5 text-[13px] text-papeliz-ink-muted">{chosenPapelizAccountSyncBillingPeriod === 'yearly' ? 'Per month, billed yearly' : 'Billed monthly'}</p>
              {papelizAccountSyncSubscribeHref && (
                <a
                  href={papelizAccountSyncSubscribeHref}
                  target="_blank"
                  rel="noopener"
                  aria-label={`Subscribe to ${papelizSiteSyncPlan.papelizSiteSyncPlanName}`}
                  className={`${papelizAccountCompactPrimaryButtonClassName} mt-4 w-full`}
                >
                  Subscribe
                </a>
              )}
              <ul className="mt-4 grid gap-0.5 text-[13px] leading-normal">
                {describePapelizSiteSyncPlanLimits(papelizSiteSyncPlan).map((papelizSiteSyncPlanLimitLine) => (
                  <li key={papelizSiteSyncPlanLimitLine} className="flex items-start gap-2 before:shrink-0 before:text-papeliz-ink-subtle before:content-['•']">
                    {papelizSiteSyncPlanLimitLine}
                  </li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>
    </>
  )
}
