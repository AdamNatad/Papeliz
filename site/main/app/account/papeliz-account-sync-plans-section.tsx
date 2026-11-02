'use client'

import { useState, type ReactNode } from 'react'
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
import {
  papelizAccountCompactPrimaryButtonClassName,
  papelizAccountRowActionWidthClassName,
  papelizAccountSecondaryButtonClassName,
  papelizAccountTextLinkClassName,
} from './papeliz-account-card-frame'
import { PapelizAccountSyncSubscriptionNotice, readPapelizAccountSyncPlanName, type PapelizAccountSyncBillingState } from './papeliz-account-sync-billing'
import { PapelizAccountSyncPlanInfoTip } from './papeliz-account-sync-plan-info-tip'
import { isPapelizAccountSyncPaidSubscriptionLive } from './papeliz-account-sync-service'

// A plan row's short line, the app's words: "5 Vaults · Version History".
function describePapelizAccountSyncPlanShortLine(syncedVaultLimit: number): string {
  return `${syncedVaultLimit.toLocaleString('en-US')} ${syncedVaultLimit === 1 ? 'Vault' : 'Vaults'} · Version History`
}

// One plan as the app's Plans tab draws it: the name with an info icon whose tip holds the plan's
// limits, the price line and the short line, and the plan's button on the right.
function PapelizAccountSyncPlanRow({
  syncPlanRowPlanId,
  syncPlanRowName,
  syncPlanRowPriceLine,
  syncPlanRowShortLine,
  syncPlanRowLimitLines,
  isSyncPlanRowHighlighted,
  syncPlanRowAction,
}: {
  syncPlanRowPlanId: string
  syncPlanRowName: string
  syncPlanRowPriceLine: string
  syncPlanRowShortLine: string
  syncPlanRowLimitLines: readonly string[]
  isSyncPlanRowHighlighted: boolean
  syncPlanRowAction: ReactNode
}) {
  return (
    <li
      data-papeliz-account-sync-plan={syncPlanRowPlanId}
      className={`flex min-w-0 items-center gap-3 rounded-xl border px-3.5 py-2.5 ${isSyncPlanRowHighlighted ? 'border-papeliz-blue bg-papeliz-blue-soft/60' : 'border-papeliz-line bg-papeliz-surface'}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center">
          <h2 className="text-[15px] leading-tight font-semibold">{syncPlanRowName}</h2>
          <PapelizAccountSyncPlanInfoTip
            syncPlanInfoTipButtonLabel={`About ${syncPlanRowName}`}
            syncPlanInfoTipTitle={`${syncPlanRowName} plan`}
            syncPlanInfoTipLines={syncPlanRowLimitLines}
          />
        </div>
        <p className="text-[13px] text-papeliz-ink-muted">{syncPlanRowPriceLine}</p>
        <p className="mt-0.5 text-xs text-papeliz-ink-subtle">{syncPlanRowShortLine}</p>
      </div>
      {syncPlanRowAction}
    </li>
  )
}

// The current plan's button: the solid blue button's own shape and size, muted, and not pressable. It
// stays a see-through blue with white text, since a pale blue fill vanishes on the blue row.
function PapelizAccountSyncCurrentPlanMark() {
  return (
    <button
      type="button"
      disabled
      className={`inline-flex min-h-[38px] shrink-0 cursor-default items-center justify-center rounded-lg bg-papeliz-blue/60 px-3.5 text-[13px] font-semibold whitespace-nowrap text-papeliz-on-blue ${papelizAccountRowActionWidthClassName}`}
    >
      Current
    </button>
  )
}

// The account page's Sync section: what Sync is, the Monthly / Yearly switch, then Free and the three
// paid plans. The plans are rows like the app's Plans tab, each plan's limits in its info tip. The
// blue row is the account's own plan, marked Current: its live paid plan, or else Free, which every
// account has without a checkout; the other plans read Upgrade. Upgrade opens checkout
// here, after asking a new account where Sync keeps its notes. With a live paid plan the others read
// Change Plan, which opens the subscription's own page, and Free that it comes with every account; a
// failed payment or an ended subscription shows above the plans. The storage place dialog is the
// dashboard's, once for both layouts.
export function PapelizAccountSyncPlansSection({
  papelizAccountSyncBillingState,
  papelizAccountSyncChosenPlan,
}: {
  papelizAccountSyncBillingState: PapelizAccountSyncBillingState
  papelizAccountSyncChosenPlan: PapelizSiteSyncChosenPlan | null
}) {
  // Null until the switch is pressed. The page shows what is current, not always Yearly, so the switch
  // opens on the live paid plan's period;
  // otherwise on a plan chosen on the website's, and on Yearly for Free.
  const [pressedPapelizAccountSyncBillingPeriod, setPressedPapelizAccountSyncBillingPeriod] = useState<PapelizSiteSyncBillingPeriod | null>(null)
  const [isChosenPlanPromptDismissed, setIsChosenPlanPromptDismissed] = useState(false)
  const {
    syncBillingStage,
    syncCheckoutStage,
    isSyncChosenPlanCheckoutStarted,
    syncBillingPortalFailureMessage,
    startPapelizAccountSyncCheckout,
    openPapelizAccountSyncBillingPortal,
    loadPapelizAccountSyncBilling,
  } = papelizAccountSyncBillingState
  const syncBilling = syncBillingStage.syncBillingStageKind === 'read' ? syncBillingStage.syncBilling : null
  const isSyncSubscriptionLive = syncBilling !== null && isPapelizAccountSyncPaidSubscriptionLive(syncBilling)
  // Free is the account's plan whenever no paid plan is live, a new account's included.
  const isSyncOnFreePlan = syncBilling !== null && !isSyncSubscriptionLive
  const liveSyncPlanBillingPeriod = isSyncSubscriptionLive ? syncBilling.syncBillingPeriod : null
  const chosenPapelizAccountSyncBillingPeriod =
    pressedPapelizAccountSyncBillingPeriod ??
    liveSyncPlanBillingPeriod ??
    papelizAccountSyncChosenPlan?.chosenSyncBillingPeriod ??
    papelizSiteSyncPreselectedBillingPeriod
  const isSyncCheckoutOpening = syncCheckoutStage.syncCheckoutStageKind === 'opening'
  // The chosen plan's checkout starts by itself (usePapelizAccountSyncBilling); this prompt shows it
  // opening, and stays as the way back to it when the start fails or the storage place is closed.
  const isChosenPlanPromptShown =
    papelizAccountSyncChosenPlan !== null && isSyncChosenPlanCheckoutStarted && !isChosenPlanPromptDismissed && syncBilling !== null && !isSyncSubscriptionLive

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
          <button type="button" disabled={isSyncCheckoutOpening} onClick={() => setIsChosenPlanPromptDismissed(true)} className={papelizAccountSecondaryButtonClassName}>
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
          onPapelizSiteBillingPeriodChoose={setPressedPapelizAccountSyncBillingPeriod}
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
      <ul className="flex max-w-[560px] min-w-0 flex-col gap-1.5">
        <PapelizAccountSyncPlanRow
          syncPlanRowPlanId={papelizSiteSyncFreePlan.papelizSiteSyncFreePlanId}
          syncPlanRowName={papelizSiteSyncFreePlan.papelizSiteSyncFreePlanName}
          syncPlanRowPriceLine="No card needed"
          syncPlanRowShortLine={describePapelizAccountSyncPlanShortLine(papelizSiteSyncFreePlan.papelizSiteSyncFreePlanVaultLimit)}
          syncPlanRowLimitLines={describePapelizSiteSyncFreePlanLimits()}
          isSyncPlanRowHighlighted={isSyncOnFreePlan}
          syncPlanRowAction={
            isSyncOnFreePlan ? (
              <PapelizAccountSyncCurrentPlanMark />
            ) : (
              <p className="max-w-[9rem] shrink-0 text-right text-xs text-papeliz-ink-muted">Comes with every account</p>
            )
          }
        />
        {papelizSiteSyncPlans.map((papelizSiteSyncPlan) => {
          // Current only in the plan's own period; the same plan's other period reads Change Plan. A
          // live plan whose period Sync doesn't know is Current in both.
          const isCurrentSyncPlan =
            isSyncSubscriptionLive &&
            syncBilling.syncPlanName === papelizSiteSyncPlan.papelizSiteSyncPlanId &&
            (liveSyncPlanBillingPeriod === null || liveSyncPlanBillingPeriod === chosenPapelizAccountSyncBillingPeriod)
          const isThisPlanCheckoutOpening = isSyncCheckoutOpening && syncCheckoutStage.chosenSyncPlanId === papelizSiteSyncPlan.papelizSiteSyncPlanId
          const syncPlanMonthlyRate = formatPapelizSiteSyncUsd(readPapelizSiteSyncPlanMonthlyRateUsd(papelizSiteSyncPlan, chosenPapelizAccountSyncBillingPeriod))
          return (
            <PapelizAccountSyncPlanRow
              key={papelizSiteSyncPlan.papelizSiteSyncPlanId}
              syncPlanRowPlanId={papelizSiteSyncPlan.papelizSiteSyncPlanId}
              syncPlanRowName={papelizSiteSyncPlan.papelizSiteSyncPlanName}
              syncPlanRowPriceLine={chosenPapelizAccountSyncBillingPeriod === 'yearly' ? `${syncPlanMonthlyRate} a month, billed yearly` : `${syncPlanMonthlyRate} a month`}
              syncPlanRowShortLine={describePapelizAccountSyncPlanShortLine(papelizSiteSyncPlan.papelizSiteSyncPlanVaultLimit)}
              syncPlanRowLimitLines={describePapelizSiteSyncPlanLimits(papelizSiteSyncPlan)}
              isSyncPlanRowHighlighted={isCurrentSyncPlan}
              syncPlanRowAction={
                isCurrentSyncPlan ? (
                  <PapelizAccountSyncCurrentPlanMark />
                ) : isSyncSubscriptionLive ? (
                  <button
                    type="button"
                    onClick={openPapelizAccountSyncBillingPortal}
                    aria-label={`Change to ${papelizSiteSyncPlan.papelizSiteSyncPlanName}, billed ${chosenPapelizAccountSyncBillingPeriod}`}
                    className={`${papelizAccountSecondaryButtonClassName} ${papelizAccountRowActionWidthClassName}`}
                  >
                    Change Plan
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={syncBilling === null || isSyncCheckoutOpening}
                    onClick={() => startPapelizAccountSyncCheckout(papelizSiteSyncPlan.papelizSiteSyncPlanId, chosenPapelizAccountSyncBillingPeriod, null)}
                    aria-label={`Upgrade to ${papelizSiteSyncPlan.papelizSiteSyncPlanName}`}
                    className={`${papelizAccountSecondaryButtonClassName} ${papelizAccountRowActionWidthClassName}`}
                  >
                    {isThisPlanCheckoutOpening ? 'Opening Checkout…' : 'Upgrade'}
                  </button>
                )
              }
            />
          )
        })}
      </ul>
    </>
  )
}
