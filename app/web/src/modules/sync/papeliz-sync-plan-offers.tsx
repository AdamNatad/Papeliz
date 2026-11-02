import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizSlidingChoiceGroup } from '../ui/papeliz-sliding-choice-group'
import type { PapelizSyncBillingPeriod, PapelizSyncEngine, PapelizSyncEngineSnapshot, PapelizSyncPlanOfferReading } from './papeliz-sync-engine-contract'
import { choosePapelizSyncPlan, describePapelizSyncSignInFromClickFailure, isPapelizSyncSubscriptionCurrent, startPapelizSyncSignInFromClick } from './papeliz-sync-flow-store'
import { PapelizSyncChip, PapelizSyncFailureLine, PapelizSyncLoadingLine, PapelizSyncTextButton } from './papeliz-sync-page-parts'
import { describePapelizSyncActionFailureNow, describePapelizSyncPlanCardLine, describePapelizSyncPlanPrice, papelizSyncPlanDisplayNames } from './papeliz-sync-screen-words'
import { findPapelizSyncPlanOffersFirstBillingPeriod, usePapelizSyncSettingsGearRequestStore } from './papeliz-sync-settings-gear-request-store'

// The Sync page's Plans tab: Yearly | Monthly, then Free and each paid plan as a short card (its name,
// its price for a month, one line of what it holds) with Sign In, Choose or "Current Plan". The engine
// reads the plans from its own table, with no request, so they show at once, signed out or offline.
// The details (version history's length, devices, file sizes) are in the help guide, not here. A plan
// picked on the website's pricing page (in the address) is drawn picked, on its billing period, and
// scrolled to.

type PapelizSyncPlanOffersState =
  | { planOffersStateKind: 'loading' }
  | { planOffersStateKind: 'loaded'; syncPlanOffers: readonly PapelizSyncPlanOfferReading[] }
  | { planOffersStateKind: 'failed'; planOffersFailureWords: string }

// The plan drawn picked, in blue, when the address picked none and no paid plan is current.
const papelizSyncDefaultHighlightedPlanName = 'plus'

interface PapelizSyncPlanCardProps {
  syncPlanCardName: string
  syncPlanCardPriceLine: string
  syncPlanCardLimitLine: string
  isSyncPlanCardHighlighted: boolean
  syncPlanCardAction: ReactNode
  syncPlanCardRef?: Ref<HTMLLIElement>
  children?: ReactNode
}

function PapelizSyncPlanCard({ syncPlanCardName, syncPlanCardPriceLine, syncPlanCardLimitLine, isSyncPlanCardHighlighted, syncPlanCardAction, syncPlanCardRef, children }: PapelizSyncPlanCardProps) {
  return (
    <li
      ref={syncPlanCardRef}
      className={joinPapelizClassNames('rounded-xl border px-3 py-2', isSyncPlanCardHighlighted ? 'border-papeliz-blue bg-papeliz-blue-soft/60' : 'border-papeliz-line bg-papeliz-surface')}
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-tight font-semibold">{syncPlanCardName}</p>
          <p className="text-[12px] text-papeliz-ink-muted">{syncPlanCardPriceLine}</p>
        </div>
        {syncPlanCardAction}
      </div>
      <p className="mt-0.5 text-[11.5px] text-papeliz-ink-subtle">{syncPlanCardLimitLine}</p>
      {children}
    </li>
  )
}

interface PapelizSyncPlanOffersSectionProps {
  papelizSyncEngine: PapelizSyncEngine
  syncEngineSnapshot: PapelizSyncEngineSnapshot
  // Under the cards while a paid plan is current: how to change it.
  planOffersFooter?: ReactNode
}

export function PapelizSyncPlanOffersSection({ papelizSyncEngine, syncEngineSnapshot, planOffersFooter }: PapelizSyncPlanOffersSectionProps) {
  const [planOffersState, setPlanOffersState] = useState<PapelizSyncPlanOffersState>({ planOffersStateKind: 'loading' })
  // Goes up with Try again, to read the plans once more.
  const [planOffersReadCount, setPlanOffersReadCount] = useState(0)
  const [freePlanSignInFailureWords, setFreePlanSignInFailureWords] = useState<string | null>(null)
  const syncPlanPickedFromAddress = usePapelizSyncSettingsGearRequestStore((requestState) => requestState.syncPlanPickedFromAddress)
  const [chosenSyncBillingPeriod, setChosenSyncBillingPeriod] = useState<PapelizSyncBillingPeriod>(() => findPapelizSyncPlanOffersFirstBillingPeriod(syncPlanPickedFromAddress))
  const pickedSyncPlanOfferRef = useRef<HTMLLIElement>(null)
  const syncSignInKind = syncEngineSnapshot.syncSignIn.syncSignInKind
  const syncAccount = syncSignInKind === 'signed-in' ? syncEngineSnapshot.syncAccount : null
  // A paid plan being paid for: its card says so, and the others change through the footer.
  const currentPaidSyncPlanName = syncAccount !== null && isPapelizSyncSubscriptionCurrent(syncAccount.syncSubscriptionState) ? syncAccount.syncPlanName : null
  const isSyncAccountOnFreePlan = syncAccount?.syncPlanName === 'free' && currentPaidSyncPlanName === null
  const highlightedSyncPlanName = currentPaidSyncPlanName ?? syncPlanPickedFromAddress?.pickedSyncPlanName ?? papelizSyncDefaultHighlightedPlanName

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
          Try Again
        </PapelizSyncTextButton>
      </PapelizSyncFailureLine>
    )
  }
  if (planOffersState.planOffersStateKind === 'loading') return <PapelizSyncLoadingLine>Loading the plans…</PapelizSyncLoadingLine>

  const shownSyncPlanOffers = planOffersState.syncPlanOffers.filter((syncPlanOffer) => syncPlanOffer.syncBillingPeriod === chosenSyncBillingPeriod)
  const currentPlanChip = <PapelizSyncChip syncChipTone="plan">Current Plan</PapelizSyncChip>
  return (
    <div>
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
      <ul className="mt-2 flex flex-col gap-1.5">
        {/* Free, on both billing periods: no price and no checkout, since every account gets it at sign-in. */}
        <PapelizSyncPlanCard
          syncPlanCardName={papelizSyncPlanDisplayNames.free}
          syncPlanCardPriceLine="No card needed"
          syncPlanCardLimitLine={describePapelizSyncPlanCardLine(papelizSyncEngine.readSyncFreePlanLimits())}
          isSyncPlanCardHighlighted={false}
          syncPlanCardAction={
            isSyncAccountOnFreePlan
              ? currentPlanChip
              : syncSignInKind !== 'signed-in' && (
                  <PapelizPillButton
                    pillButtonVariant="line"
                    pillButtonSize="small"
                    aria-label={`Sign In for ${papelizSyncPlanDisplayNames.free}`}
                    disabled={syncSignInKind === 'waiting-for-sign-in-page'}
                    onClick={() => {
                      setFreePlanSignInFailureWords(null)
                      void startPapelizSyncSignInFromClick(papelizSyncEngine, null).then((signInFromClickOutcome) =>
                        setFreePlanSignInFailureWords(describePapelizSyncSignInFromClickFailure(signInFromClickOutcome)),
                      )
                    }}
                  >
                    Sign In
                  </PapelizPillButton>
                )
          }
        >
          {freePlanSignInFailureWords !== null && <PapelizSyncFailureLine className="mt-1">{freePlanSignInFailureWords}</PapelizSyncFailureLine>}
        </PapelizSyncPlanCard>
        {shownSyncPlanOffers.map((syncPlanOffer) => {
          const isPlanHighlighted = syncPlanOffer.syncPlanName === highlightedSyncPlanName
          const syncPlanDisplayName = papelizSyncPlanDisplayNames[syncPlanOffer.syncPlanName]
          return (
            <PapelizSyncPlanCard
              key={`${syncPlanOffer.syncPlanName}-${syncPlanOffer.syncBillingPeriod}`}
              syncPlanCardRef={isPlanHighlighted ? pickedSyncPlanOfferRef : undefined}
              syncPlanCardName={syncPlanDisplayName}
              syncPlanCardPriceLine={describePapelizSyncPlanPrice(syncPlanOffer.syncDisplayPricePerMonth, syncPlanOffer.syncBillingPeriod)}
              syncPlanCardLimitLine={describePapelizSyncPlanCardLine(syncPlanOffer.syncVisiblePlanLimits)}
              isSyncPlanCardHighlighted={isPlanHighlighted}
              syncPlanCardAction={
                currentPaidSyncPlanName !== null ? (
                  syncPlanOffer.syncPlanName === currentPaidSyncPlanName && currentPlanChip
                ) : (
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
                )
              }
            />
          )
        })}
      </ul>
      {currentPaidSyncPlanName !== null && planOffersFooter}
    </div>
  )
}
