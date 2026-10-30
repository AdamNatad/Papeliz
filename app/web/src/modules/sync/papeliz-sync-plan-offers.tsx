import { useEffect, useRef, useState } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizSlidingChoiceGroup } from '../ui/papeliz-sliding-choice-group'
import type { PapelizSyncBillingPeriod, PapelizSyncEngine, PapelizSyncEngineSnapshot, PapelizSyncPlanOfferReading } from './papeliz-sync-engine-contract'
import { choosePapelizSyncPlan } from './papeliz-sync-flow-store'
import { PapelizSyncFailureLine, PapelizSyncLoadingLine, PapelizSyncPageSmallText, PapelizSyncTextButton } from './papeliz-sync-page-parts'
import { describePapelizSyncActionFailureNow, describePapelizSyncPlanLimitLines, describePapelizSyncPlanPrice, papelizSyncPlanDisplayNames } from './papeliz-sync-screen-words'
import { usePapelizSyncSettingsGearRequestStore } from './papeliz-sync-settings-gear-request-store'

// The plans in the gear (A): each with its limits, its price as the engine gives it, and Choose,
// which goes on to checkout. The engine reads them from its own table, with no request, so they
// show as soon as the Sync page opens, signed out or offline. A plan picked on the website's pricing
// page (in the address) is drawn picked, on its billing period, and scrolled to.

type PapelizSyncPlanOffersState =
  | { planOffersStateKind: 'loading' }
  | { planOffersStateKind: 'loaded'; syncPlanOffers: readonly PapelizSyncPlanOfferReading[] }
  | { planOffersStateKind: 'failed'; planOffersFailureWords: string }

// The plan the gear's mockup draws picked, in blue, when the address picked none.
const papelizSyncDefaultHighlightedPlanName = 'plus'

interface PapelizSyncPlanOffersSectionProps {
  papelizSyncEngine: PapelizSyncEngine
  syncEngineSnapshot: PapelizSyncEngineSnapshot
}

export function PapelizSyncPlanOffersSection({ papelizSyncEngine, syncEngineSnapshot }: PapelizSyncPlanOffersSectionProps) {
  const [planOffersState, setPlanOffersState] = useState<PapelizSyncPlanOffersState>({ planOffersStateKind: 'loading' })
  // Goes up with Try again, to read the plans once more.
  const [planOffersReadCount, setPlanOffersReadCount] = useState(0)
  const syncPlanPickedFromAddress = usePapelizSyncSettingsGearRequestStore((requestState) => requestState.syncPlanPickedFromAddress)
  const [chosenSyncBillingPeriod, setChosenSyncBillingPeriod] = useState<PapelizSyncBillingPeriod>(syncPlanPickedFromAddress?.pickedSyncBillingPeriod ?? 'yearly')
  const highlightedSyncPlanName = syncPlanPickedFromAddress?.pickedSyncPlanName ?? papelizSyncDefaultHighlightedPlanName
  const pickedSyncPlanOfferRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    let isPlanListLeft = false
    void papelizSyncEngine.listSyncPlanOffers().then((planOffersOutcome) => {
      if (isPlanListLeft) return
      setPlanOffersState(
        planOffersOutcome.syncActionOutcome === 'done'
          ? { planOffersStateKind: 'loaded', syncPlanOffers: planOffersOutcome.syncActionDoneValue }
          : { planOffersStateKind: 'failed', planOffersFailureWords: describePapelizSyncActionFailureNow(planOffersOutcome) },
      )
    })
    return () => {
      isPlanListLeft = true
    }
  }, [papelizSyncEngine, planOffersReadCount])

  const isPlanOffersListShown = planOffersState.planOffersStateKind === 'loaded'
  const isPlanPickedFromAddress = (syncPlanPickedFromAddress?.pickedSyncPlanName ?? null) !== null
  useEffect(() => {
    if (isPlanOffersListShown && isPlanPickedFromAddress) pickedSyncPlanOfferRef.current?.scrollIntoView({ block: 'nearest' })
  }, [isPlanOffersListShown, isPlanPickedFromAddress])

  if (planOffersState.planOffersStateKind === 'failed') {
    return (
      <PapelizSyncFailureLine className="mt-3">
        {planOffersState.planOffersFailureWords}{' '}
        <PapelizSyncTextButton
          onClick={() => {
            setPlanOffersState({ planOffersStateKind: 'loading' })
            setPlanOffersReadCount(planOffersReadCount + 1)
          }}
        >
          Try again
        </PapelizSyncTextButton>
      </PapelizSyncFailureLine>
    )
  }
  if (planOffersState.planOffersStateKind === 'loading') return <PapelizSyncLoadingLine>Loading the plans…</PapelizSyncLoadingLine>

  const shownSyncPlanOffers = planOffersState.syncPlanOffers.filter((syncPlanOffer) => syncPlanOffer.syncBillingPeriod === chosenSyncBillingPeriod)
  return (
    <div className="mt-3">
      <PapelizSlidingChoiceGroup<PapelizSyncBillingPeriod>
        slidingChoiceGroupLabel="Billing"
        slidingChoiceGroupRole="radiogroup"
        chosenSlidingChoiceValue={chosenSyncBillingPeriod}
        onSlidingChoiceSelect={setChosenSyncBillingPeriod}
        slidingChoices={[
          { slidingChoiceValue: 'yearly', slidingChoiceContent: 'Yearly' },
          { slidingChoiceValue: 'monthly', slidingChoiceContent: 'Monthly' },
        ]}
      />
      <ul className="mt-2.5 flex flex-col gap-2">
        {shownSyncPlanOffers.map((syncPlanOffer) => {
          const isPlanHighlighted = syncPlanOffer.syncPlanName === highlightedSyncPlanName
          const syncPlanDisplayName = papelizSyncPlanDisplayNames[syncPlanOffer.syncPlanName]
          return (
            <li
              key={`${syncPlanOffer.syncPlanName}-${syncPlanOffer.syncBillingPeriod}`}
              ref={isPlanHighlighted ? pickedSyncPlanOfferRef : undefined}
              className={joinPapelizClassNames('rounded-xl border px-3 py-2.5', isPlanHighlighted ? 'border-papeliz-blue bg-papeliz-blue-soft/60' : 'border-papeliz-line bg-papeliz-surface')}
            >
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">{syncPlanDisplayName}</p>
                  <p className="text-[12px] text-papeliz-ink-muted">{describePapelizSyncPlanPrice(syncPlanOffer.syncDisplayPrice, syncPlanOffer.syncBillingPeriod)}</p>
                </div>
                <PapelizPillButton
                  pillButtonVariant={isPlanHighlighted ? 'primary' : 'line'}
                  pillButtonSize="small"
                  aria-label={`Choose ${syncPlanDisplayName}`}
                  onClick={() =>
                    choosePapelizSyncPlan(papelizSyncEngine, syncEngineSnapshot, { syncPlanName: syncPlanOffer.syncPlanName, syncBillingPeriod: syncPlanOffer.syncBillingPeriod })
                  }
                >
                  Choose
                </PapelizPillButton>
              </div>
              <ul className="mt-1.5 list-disc pl-4 text-[12px] leading-[1.5] text-papeliz-ink-muted marker:text-papeliz-ink-subtle">
                {describePapelizSyncPlanLimitLines(syncPlanOffer.syncVisiblePlanLimits).map((planLimitLine) => (
                  <li key={planLimitLine}>{planLimitLine}</li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
      <PapelizSyncPageSmallText className="mt-2.5">Yearly or monthly. Full refund within 7 days. Checkout opens in a new tab.</PapelizSyncPageSmallText>
    </div>
  )
}
