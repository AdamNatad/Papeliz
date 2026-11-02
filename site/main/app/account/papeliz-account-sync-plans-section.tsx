'use client'

import { useState } from 'react'
import { PapelizSiteBillingPeriodSwitch } from '@/components/pricing/papeliz-site-billing-period-switch'
import { createPapelizSiteYearlySavingsBadgeInfo, papelizSiteSyncYearlyMonthsSaved } from '@/components/pricing/papeliz-site-yearly-savings-info'
import {
  describePapelizSiteSyncFreePlanLimits,
  describePapelizSiteSyncPlanLimits,
  formatPapelizSiteSyncUsd,
  papelizSiteSyncFreePlan,
  papelizSiteSyncPlans,
  papelizSiteSyncPreselectedBillingPeriod,
  readPapelizSiteSyncPlanMonthlyRateUsd,
  type PapelizSiteSyncBillingPeriod,
  type PapelizSiteSyncChosenPlan,
} from '@/lib/papeliz-site-sync-plans'
import { papelizAccountCompactPrimaryButtonClassName, papelizAccountSecondaryButtonClassName, papelizAccountTextLinkClassName } from './papeliz-account-card-frame'
import { PapelizAccountSyncSubscriptionNotice, readPapelizAccountSyncPlanName, type PapelizAccountSyncBillingState } from './papeliz-account-sync-billing'
import { isPapelizAccountSyncOnFreePlan, isPapelizAccountSyncPaidSubscriptionLive } from './papeliz-account-sync-service'

// A plan card's lines, as dots.
function PapelizAccountSyncPlanLimitLines({ papelizAccountSyncPlanLimitLines }: { papelizAccountSyncPlanLimitLines: string[] }) {
  return (
    <ul className="mt-4 grid gap-0.5 text-[13px] leading-normal">
      {papelizAccountSyncPlanLimitLines.map((papelizAccountSyncPlanLimitLine) => (
        <li key={papelizAccountSyncPlanLimitLine} className="flex items-start gap-2 before:shrink-0 before:text-papeliz-ink-subtle before:content-['•']">
          {papelizAccountSyncPlanLimitLine}
        </li>
      ))}
    </ul>
  )
}

// The account page's Sync section: what Sync is, the Monthly / Yearly switch, then Free and the three
// paid plans, each paid plan with its own Subscribe (Adam, 2026-10-31). Free has no checkout: an
// account the Account Worker reports on Free sees it as Current Plan, and any other sees that it
// comes with every account. Subscribe opens checkout here, after asking a new
// account where Sync keeps its notes. With a live subscription its plan reads Current Plan and the
// others Change Plan, which opens the subscription's own page; a failed payment or an ended
// subscription shows above the plans. The storage place dialog is the dashboard's, once for both layouts.
export function PapelizAccountSyncPlansSection({
  papelizAccountSyncBillingState,
  papelizAccountSyncChosenPlan,
}: {
  papelizAccountSyncBillingState: PapelizAccountSyncBillingState
  papelizAccountSyncChosenPlan: PapelizSiteSyncChosenPlan | null
}) {
  const [chosenPapelizAccountSyncBillingPeriod, setChosenPapelizAccountSyncBillingPeriod] = useState<PapelizSiteSyncBillingPeriod>(
    papelizAccountSyncChosenPlan?.chosenSyncBillingPeriod ?? papelizSiteSyncPreselectedBillingPeriod,
  )
  const [isChosenPlanPromptDismissed, setIsChosenPlanPromptDismissed] = useState(false)
  const { syncBillingStage, syncCheckoutStage, syncBillingPortalFailureMessage, startPapelizAccountSyncCheckout, openPapelizAccountSyncBillingPortal, loadPapelizAccountSyncBilling } =
    papelizAccountSyncBillingState
  const syncBilling = syncBillingStage.syncBillingStageKind === 'read' ? syncBillingStage.syncBilling : null
  const isSyncSubscriptionLive = syncBilling !== null && isPapelizAccountSyncPaidSubscriptionLive(syncBilling)
  const isSyncOnFreePlan = syncBilling !== null && isPapelizAccountSyncOnFreePlan(syncBilling)
  const isSyncCheckoutOpening = syncCheckoutStage.syncCheckoutStageKind === 'opening'
  const isChosenPlanPromptShown = papelizAccountSyncChosenPlan !== null && !isChosenPlanPromptDismissed && syncBilling !== null && !isSyncSubscriptionLive

  return (
    <>
      <p className="-mt-1 mb-5 max-w-[560px] text-sm text-pretty text-papeliz-ink-muted md:-mt-2.5 md:text-[15px]">
        Your vaults on every device, with end-to-end encryption for the ones you choose.{' '}
        <a href="/sync/" className={papelizAccountTextLinkClassName}>
          Learn more.
        </a>
      </p>
      <PapelizAccountSyncSubscriptionNotice papelizAccountSyncBillingState={papelizAccountSyncBillingState} />
      {isChosenPlanPromptShown && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-papeliz-blue-line bg-papeliz-blue-soft px-4 py-3 text-sm text-papeliz-ink">
          <p className="min-w-0 flex-1 text-pretty">
            Subscribe to <b className="font-semibold">{readPapelizAccountSyncPlanName(papelizAccountSyncChosenPlan.chosenSyncPlanId)}</b>, billed{' '}
            {papelizAccountSyncChosenPlan.chosenSyncBillingPeriod}? Checkout opens on our payment provider’s secure page.
          </p>
          <button type="button" onClick={() => setIsChosenPlanPromptDismissed(true)} className={papelizAccountSecondaryButtonClassName}>
            Not Now
          </button>
          <button
            type="button"
            disabled={isSyncCheckoutOpening}
            onClick={() => startPapelizAccountSyncCheckout(papelizAccountSyncChosenPlan.chosenSyncPlanId, papelizAccountSyncChosenPlan.chosenSyncBillingPeriod, null)}
            className={papelizAccountCompactPrimaryButtonClassName}
          >
            {isSyncCheckoutOpening ? 'Opening Checkout…' : 'Continue to Checkout'}
          </button>
        </div>
      )}
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
      {syncCheckoutStage.syncCheckoutStageKind === 'failed' && (
        <p role="alert" className="mb-3 text-sm text-papeliz-diff-removed-ink">
          {syncCheckoutStage.syncCheckoutFailureMessage}
        </p>
      )}
      {syncBillingPortalFailureMessage !== null && (
        <p role="alert" className="mb-3 text-sm text-papeliz-diff-removed-ink">
          {syncBillingPortalFailureMessage}
        </p>
      )}
      {syncBillingStage.syncBillingStageKind === 'failed' && (
        <p role="alert" className="mb-3 flex flex-wrap items-center gap-2 text-sm text-papeliz-diff-removed-ink">
          {syncBillingStage.syncBillingFailureMessage}
          <button type="button" onClick={loadPapelizAccountSyncBilling} className={papelizAccountTextLinkClassName}>
            Try again
          </button>
        </p>
      )}
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <article
          data-papeliz-account-sync-plan={papelizSiteSyncFreePlan.papelizSiteSyncFreePlanId}
          className={`flex min-w-0 flex-col rounded-xl border bg-papeliz-surface p-4 ${isSyncOnFreePlan ? 'border-papeliz-blue' : 'border-papeliz-line'}`}
        >
          <h2 className="text-[15px] font-semibold">{papelizSiteSyncFreePlan.papelizSiteSyncFreePlanName}</h2>
          <p className="mt-0.5 text-[26px] leading-[1.35] font-semibold tracking-[-0.02em]">
            {formatPapelizSiteSyncUsd(0)} <span className="text-sm font-normal tracking-normal text-papeliz-ink-muted">USD</span>
          </p>
          <p className="mt-0.5 text-[13px] text-papeliz-ink-muted">No card needed</p>
          {isSyncOnFreePlan ? (
            <button type="button" disabled className={`${papelizAccountSecondaryButtonClassName} mt-4 w-full`}>
              Current Plan
            </button>
          ) : (
            <p className="mt-4 flex min-h-[38px] items-center justify-center text-center text-[13px] text-papeliz-ink-muted">Comes with every account</p>
          )}
          <PapelizAccountSyncPlanLimitLines papelizAccountSyncPlanLimitLines={describePapelizSiteSyncFreePlanLimits()} />
        </article>
        {papelizSiteSyncPlans.map((papelizSiteSyncPlan) => {
          const isCurrentSyncPlan = isSyncSubscriptionLive && syncBilling?.syncPlanName === papelizSiteSyncPlan.papelizSiteSyncPlanId
          const isThisPlanCheckoutOpening = isSyncCheckoutOpening && syncCheckoutStage.chosenSyncPlanId === papelizSiteSyncPlan.papelizSiteSyncPlanId
          return (
            <article
              key={papelizSiteSyncPlan.papelizSiteSyncPlanId}
              data-papeliz-account-sync-plan={papelizSiteSyncPlan.papelizSiteSyncPlanId}
              className={`flex min-w-0 flex-col rounded-xl border bg-papeliz-surface p-4 ${isCurrentSyncPlan ? 'border-papeliz-blue' : 'border-papeliz-line'}`}
            >
              <h2 className="text-[15px] font-semibold">{papelizSiteSyncPlan.papelizSiteSyncPlanName}</h2>
              <p className="mt-0.5 text-[26px] leading-[1.35] font-semibold tracking-[-0.02em]">
                {formatPapelizSiteSyncUsd(readPapelizSiteSyncPlanMonthlyRateUsd(papelizSiteSyncPlan, chosenPapelizAccountSyncBillingPeriod))}{' '}
                <span className="text-sm font-normal tracking-normal text-papeliz-ink-muted">USD</span>
              </p>
              {/* "USD" alone beside the price, as on the Pricing and Sync pages; this line says it is a month's price. */}
              <p className="mt-0.5 text-[13px] text-papeliz-ink-muted">{chosenPapelizAccountSyncBillingPeriod === 'yearly' ? 'Per month, billed yearly' : 'Billed monthly'}</p>
              {isCurrentSyncPlan ? (
                <button type="button" disabled className={`${papelizAccountSecondaryButtonClassName} mt-4 w-full`}>
                  Current Plan
                </button>
              ) : isSyncSubscriptionLive ? (
                <button
                  type="button"
                  onClick={openPapelizAccountSyncBillingPortal}
                  aria-label={`Change to ${papelizSiteSyncPlan.papelizSiteSyncPlanName}`}
                  className={`${papelizAccountSecondaryButtonClassName} mt-4 w-full`}
                >
                  Change Plan
                </button>
              ) : (
                <button
                  type="button"
                  disabled={syncBilling === null || isSyncCheckoutOpening}
                  onClick={() => startPapelizAccountSyncCheckout(papelizSiteSyncPlan.papelizSiteSyncPlanId, chosenPapelizAccountSyncBillingPeriod, null)}
                  aria-label={`Subscribe to ${papelizSiteSyncPlan.papelizSiteSyncPlanName}`}
                  className={`${papelizAccountCompactPrimaryButtonClassName} mt-4 w-full`}
                >
                  {isThisPlanCheckoutOpening ? 'Opening Checkout…' : 'Subscribe'}
                </button>
              )}
              <PapelizAccountSyncPlanLimitLines papelizAccountSyncPlanLimitLines={describePapelizSiteSyncPlanLimits(papelizSiteSyncPlan)} />
            </article>
          )
        })}
      </div>
    </>
  )
}
