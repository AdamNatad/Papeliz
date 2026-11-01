'use client'

import { useAuth } from '@clerk/react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { papelizSiteSyncPlans, type PapelizSiteSyncBillingPeriod, type PapelizSiteSyncPlanId } from '@/lib/papeliz-site-sync-plans'
import { papelizAccountCompactPrimaryButtonClassName, papelizAccountSecondaryButtonClassName } from './papeliz-account-card-frame'
import { papelizAccountStoragePlaceLabels, readPapelizAccountNearestStoragePlace } from './papeliz-account-config'
import { papelizAccountSyncUnreachableMessage } from './papeliz-account-devices-section'
import { PapelizAccountDialog } from './papeliz-account-dialog'
import { papelizSyncStoragePlaces, type PapelizSyncStoragePlace } from './papeliz-account-sync-hand-over'
import { isPapelizAccountSyncSubscriptionLive, type PapelizAccountSyncBilling, type PapelizAccountSyncService } from './papeliz-account-sync-service'

// The account page's billing: the subscription's state, read once and again after checkout comes
// back; Subscribe, which opens checkout in this tab (asking first where Sync keeps notes, for a new
// account); and Manage, which opens the payment provider's page for the subscription in a new tab.
// The page names no payment provider (DECISIONS 2026-10-31 "The account page's Profile and Billing").

export type PapelizAccountSyncBillingStage =
  | { syncBillingStageKind: 'loading' }
  | { syncBillingStageKind: 'read'; syncBilling: PapelizAccountSyncBilling }
  | { syncBillingStageKind: 'failed'; syncBillingFailureMessage: string }

export type PapelizAccountSyncCheckoutStage =
  | { syncCheckoutStageKind: 'idle' }
  | { syncCheckoutStageKind: 'choosing-storage-place'; chosenSyncPlanId: PapelizSiteSyncPlanId; chosenSyncBillingPeriod: PapelizSiteSyncBillingPeriod }
  | { syncCheckoutStageKind: 'opening'; chosenSyncPlanId: PapelizSiteSyncPlanId }
  | { syncCheckoutStageKind: 'failed'; syncCheckoutFailureMessage: string }

export interface PapelizAccountSyncBillingState {
  syncBillingStage: PapelizAccountSyncBillingStage
  // Back from checkout: the payment provider tells Sync within moments, so the page reads again until
  // the subscription shows.
  isSyncCheckoutReturnWaiting: boolean
  syncCheckoutStage: PapelizAccountSyncCheckoutStage
  syncBillingPortalFailureMessage: string | null
  loadPapelizAccountSyncBilling(): void
  startPapelizAccountSyncCheckout(
    chosenSyncPlanId: PapelizSiteSyncPlanId,
    chosenSyncBillingPeriod: PapelizSiteSyncBillingPeriod,
    papelizSyncStoragePlaceForNewAccount: PapelizSyncStoragePlace | null,
  ): void
  closePapelizAccountSyncCheckout(): void
  // Opens a tab, so it runs from a click.
  openPapelizAccountSyncBillingPortal(): void
}

// How often, and how many times, the page reads the subscription again after checkout comes back.
const papelizAccountSyncCheckoutReturnReadMilliseconds = 3000
const papelizAccountSyncCheckoutReturnReadCount = 10

export function usePapelizAccountSyncBilling(papelizAccountSyncService: PapelizAccountSyncService, isSyncCheckoutReturn: boolean): PapelizAccountSyncBillingState {
  const { getToken } = useAuth()
  const [syncBillingStage, setSyncBillingStage] = useState<PapelizAccountSyncBillingStage>({ syncBillingStageKind: 'loading' })
  const [isSyncCheckoutReturnWaiting, setIsSyncCheckoutReturnWaiting] = useState(isSyncCheckoutReturn)
  const [syncCheckoutStage, setSyncCheckoutStage] = useState<PapelizAccountSyncCheckoutStage>({ syncCheckoutStageKind: 'idle' })
  const [syncBillingPortalFailureMessage, setSyncBillingPortalFailureMessage] = useState<string | null>(null)
  const syncBillingReadCountRef = useRef(0)

  const readPapelizAccountSyncBilling = useCallback(async (): Promise<PapelizAccountSyncBilling | null> => {
    try {
      const papelizAccountSignInToken = await getToken({ skipCache: true })
      if (!papelizAccountSignInToken) {
        setSyncBillingStage({ syncBillingStageKind: 'failed', syncBillingFailureMessage: 'Sign in again to see your subscription.' })
        return null
      }
      const syncBillingOutcome = await papelizAccountSyncService.readPapelizSyncBilling(papelizAccountSignInToken)
      if (syncBillingOutcome.syncBillingOutcomeKind === 'refused') {
        setSyncBillingStage({ syncBillingStageKind: 'failed', syncBillingFailureMessage: syncBillingOutcome.syncBillingRefusalMessage })
        return null
      }
      setSyncBillingStage({ syncBillingStageKind: 'read', syncBilling: syncBillingOutcome.syncBilling })
      return syncBillingOutcome.syncBilling
    } catch {
      setSyncBillingStage({ syncBillingStageKind: 'failed', syncBillingFailureMessage: papelizAccountSyncUnreachableMessage })
      return null
    }
  }, [getToken, papelizAccountSyncService])

  const loadPapelizAccountSyncBilling = useCallback(() => {
    setSyncBillingStage({ syncBillingStageKind: 'loading' })
    void readPapelizAccountSyncBilling()
  }, [readPapelizAccountSyncBilling])

  useEffect(() => {
    let isSyncBillingReadingStopped = false
    let syncBillingReadTimer: ReturnType<typeof setTimeout> | undefined
    const readSyncBillingUntilSubscribed = async () => {
      const syncBilling = await readPapelizAccountSyncBilling()
      if (isSyncBillingReadingStopped) return
      syncBillingReadCountRef.current += 1
      const isSubscriptionShowing = syncBilling !== null && isPapelizAccountSyncSubscriptionLive(syncBilling.syncSubscriptionState)
      if (!isSyncCheckoutReturn || isSubscriptionShowing || syncBillingReadCountRef.current >= papelizAccountSyncCheckoutReturnReadCount) {
        setIsSyncCheckoutReturnWaiting(false)
        return
      }
      syncBillingReadTimer = setTimeout(() => void readSyncBillingUntilSubscribed(), papelizAccountSyncCheckoutReturnReadMilliseconds)
    }
    void readSyncBillingUntilSubscribed()
    return () => {
      isSyncBillingReadingStopped = true
      clearTimeout(syncBillingReadTimer)
    }
  }, [isSyncCheckoutReturn, readPapelizAccountSyncBilling])

  const startPapelizAccountSyncCheckout = useCallback(
    (chosenSyncPlanId: PapelizSiteSyncPlanId, chosenSyncBillingPeriod: PapelizSiteSyncBillingPeriod, papelizSyncStoragePlaceForNewAccount: PapelizSyncStoragePlace | null) => {
      // A new account chooses where Sync keeps its notes before its first checkout.
      if (papelizSyncStoragePlaceForNewAccount === null && syncBillingStage.syncBillingStageKind === 'read' && !syncBillingStage.syncBilling.hasPapelizSyncAccount) {
        setSyncCheckoutStage({ syncCheckoutStageKind: 'choosing-storage-place', chosenSyncPlanId, chosenSyncBillingPeriod })
        return
      }
      setSyncCheckoutStage({ syncCheckoutStageKind: 'opening', chosenSyncPlanId })
      void (async () => {
        try {
          const papelizAccountSignInToken = await getToken({ skipCache: true })
          if (!papelizAccountSignInToken) {
            setSyncCheckoutStage({ syncCheckoutStageKind: 'failed', syncCheckoutFailureMessage: 'Sign in again to subscribe.' })
            return
          }
          const syncCheckoutOutcome = await papelizAccountSyncService.createPapelizSyncCheckoutPage(
            papelizAccountSignInToken,
            chosenSyncPlanId,
            chosenSyncBillingPeriod,
            papelizSyncStoragePlaceForNewAccount,
          )
          if (syncCheckoutOutcome.syncCheckoutOutcomeKind === 'opened') {
            window.location.assign(syncCheckoutOutcome.syncCheckoutPageUrl)
            return
          }
          setSyncCheckoutStage(
            syncCheckoutOutcome.syncCheckoutOutcomeKind === 'storage-place-required'
              ? { syncCheckoutStageKind: 'choosing-storage-place', chosenSyncPlanId, chosenSyncBillingPeriod }
              : { syncCheckoutStageKind: 'failed', syncCheckoutFailureMessage: syncCheckoutOutcome.syncCheckoutRefusalMessage },
          )
        } catch {
          setSyncCheckoutStage({ syncCheckoutStageKind: 'failed', syncCheckoutFailureMessage: papelizAccountSyncUnreachableMessage })
        }
      })()
    },
    [getToken, papelizAccountSyncService, syncBillingStage],
  )

  const closePapelizAccountSyncCheckout = useCallback(() => setSyncCheckoutStage({ syncCheckoutStageKind: 'idle' }), [])

  const openPapelizAccountSyncBillingPortal = useCallback(() => {
    setSyncBillingPortalFailureMessage(null)
    // Opened now, from the click, so no pop-up blocker stops it; it goes to the page once its address
    // is back, and closes again when there is none.
    const syncBillingPortalTab = window.open('', '_blank')
    void (async () => {
      try {
        const papelizAccountSignInToken = await getToken({ skipCache: true })
        if (!papelizAccountSignInToken) {
          syncBillingPortalTab?.close()
          setSyncBillingPortalFailureMessage('Sign in again to manage your subscription.')
          return
        }
        const syncBillingPortalOutcome = await papelizAccountSyncService.createPapelizSyncBillingPortalPage(papelizAccountSignInToken)
        if (syncBillingPortalOutcome.syncBillingPortalOutcomeKind === 'opened') {
          if (syncBillingPortalTab === null) {
            window.location.assign(syncBillingPortalOutcome.syncBillingPortalUrl)
            return
          }
          syncBillingPortalTab.opener = null
          syncBillingPortalTab.location.href = syncBillingPortalOutcome.syncBillingPortalUrl
          return
        }
        syncBillingPortalTab?.close()
        setSyncBillingPortalFailureMessage(
          syncBillingPortalOutcome.syncBillingPortalOutcomeKind === 'not-subscribed'
            ? 'Your subscription’s page opens here after your first payment.'
            : syncBillingPortalOutcome.syncBillingPortalRefusalMessage,
        )
      } catch {
        syncBillingPortalTab?.close()
        setSyncBillingPortalFailureMessage(papelizAccountSyncUnreachableMessage)
      }
    })()
  }, [getToken, papelizAccountSyncService])

  return {
    syncBillingStage,
    isSyncCheckoutReturnWaiting,
    syncCheckoutStage,
    syncBillingPortalFailureMessage,
    loadPapelizAccountSyncBilling,
    startPapelizAccountSyncCheckout,
    closePapelizAccountSyncCheckout,
    openPapelizAccountSyncBillingPortal,
  }
}

// A day ahead or behind, as the Billing lines say it: "Nov 12", with the year when it isn't this year.
export function describePapelizAccountSyncBillingDay(billingTime: number, currentTime: number): string {
  const billingTimeIsThisYear = new Date(billingTime).getFullYear() === new Date(currentTime).getFullYear()
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: billingTimeIsThisYear ? undefined : 'numeric' }).format(billingTime)
}

export function readPapelizAccountSyncPlanName(papelizSiteSyncPlanId: PapelizSiteSyncPlanId): string {
  return papelizSiteSyncPlans.find((papelizSiteSyncPlan) => papelizSiteSyncPlan.papelizSiteSyncPlanId === papelizSiteSyncPlanId)?.papelizSiteSyncPlanName ?? 'Sync'
}

// A notice above a section, in the alert color for a failed payment or an ended subscription.
function PapelizAccountSyncBillingNoticeBox({ isAlert, children, noticeAction }: { isAlert: boolean; children: ReactNode; noticeAction?: ReactNode }) {
  return (
    <div
      role={isAlert ? 'alert' : 'status'}
      className={`mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm text-pretty ${
        isAlert ? 'border-papeliz-diff-removed-ink/40 bg-papeliz-diff-removed text-papeliz-ink' : 'border-papeliz-blue-line bg-papeliz-blue-soft text-papeliz-ink'
      }`}
    >
      <p className="min-w-0 flex-1">{children}</p>
      {noticeAction}
    </div>
  )
}

// What the subscription needs said, from its real state: a failed payment, an end coming, an end
// that came; and, back from checkout, that the payment is being confirmed.
export function PapelizAccountSyncSubscriptionNotice({ papelizAccountSyncBillingState }: { papelizAccountSyncBillingState: PapelizAccountSyncBillingState }) {
  const { syncBillingStage, isSyncCheckoutReturnWaiting, openPapelizAccountSyncBillingPortal } = papelizAccountSyncBillingState
  const [currentTime] = useState(() => Date.now())
  if (isSyncCheckoutReturnWaiting) {
    return <PapelizAccountSyncBillingNoticeBox isAlert={false}>Thanks! Your payment is being confirmed; your subscription shows here in a moment.</PapelizAccountSyncBillingNoticeBox>
  }
  if (syncBillingStage.syncBillingStageKind !== 'read') return null
  const { syncBilling } = syncBillingStage
  const manageButton = (manageButtonLabel: string) =>
    syncBilling.hasSyncPaymentCustomer ? (
      <button type="button" onClick={openPapelizAccountSyncBillingPortal} className={papelizAccountCompactPrimaryButtonClassName}>
        {manageButtonLabel}
      </button>
    ) : undefined
  switch (syncBilling.syncSubscriptionState) {
    case 'payment-past-due':
      return (
        <PapelizAccountSyncBillingNoticeBox isAlert noticeAction={manageButton('Update Payment')}>
          <b className="font-semibold">Your last payment didn’t go through.</b> Update your payment method to keep syncing. Your notes stay on your devices meanwhile.
        </PapelizAccountSyncBillingNoticeBox>
      )
    case 'ends-at-period-end':
      return (
        <PapelizAccountSyncBillingNoticeBox isAlert={false} noticeAction={manageButton('Manage')}>
          Your subscription ends
          {syncBilling.syncSubscriptionEndsAt === null ? ' at the end of this period' : ` on ${describePapelizAccountSyncBillingDay(syncBilling.syncSubscriptionEndsAt, currentTime)}`}.
          After that, your synced copy stays readable for a while.
        </PapelizAccountSyncBillingNoticeBox>
      )
    case 'ended-read-only':
      return (
        <PapelizAccountSyncBillingNoticeBox isAlert>
          <b className="font-semibold">Your subscription ended.</b> Your synced copy is read-only
          {syncBilling.syncReadOnlyUntil === null ? '' : ` until ${describePapelizAccountSyncBillingDay(syncBilling.syncReadOnlyUntil, currentTime)}`}
          {syncBilling.syncSyncedCopyDeletedAt === null ? '' : `, then kept until ${describePapelizAccountSyncBillingDay(syncBilling.syncSyncedCopyDeletedAt, currentTime)}`}. Subscribe again to keep
          syncing. The notes on your devices are untouched.
        </PapelizAccountSyncBillingNoticeBox>
      )
    case 'ended-held':
      return (
        <PapelizAccountSyncBillingNoticeBox isAlert>
          <b className="font-semibold">Your subscription ended.</b> Your synced copy is kept
          {syncBilling.syncSyncedCopyDeletedAt === null ? ' for now' : ` until ${describePapelizAccountSyncBillingDay(syncBilling.syncSyncedCopyDeletedAt, currentTime)}`}, then deleted. Subscribe
          again to sync it. The notes on your devices are untouched.
        </PapelizAccountSyncBillingNoticeBox>
      )
    case 'not-subscribed':
    case 'active':
      return null
  }
}

// Where Sync keeps the notes of a new account, chosen once before its first checkout. The same list
// as the hand-over to Papeliz, nearest first ticked.
export function PapelizAccountSyncStoragePlaceDialog({ papelizAccountSyncBillingState }: { papelizAccountSyncBillingState: PapelizAccountSyncBillingState }) {
  const { syncCheckoutStage, startPapelizAccountSyncCheckout, closePapelizAccountSyncCheckout } = papelizAccountSyncBillingState
  const [nearestPapelizSyncStoragePlace] = useState(readPapelizAccountNearestStoragePlace)
  const [chosenPapelizSyncStoragePlace, setChosenPapelizSyncStoragePlace] = useState<PapelizSyncStoragePlace>(nearestPapelizSyncStoragePlace)
  if (syncCheckoutStage.syncCheckoutStageKind !== 'choosing-storage-place') return null
  return (
    <PapelizAccountDialog
      papelizAccountDialogTitle="Where should Sync keep your notes?"
      onPapelizAccountDialogClose={closePapelizAccountSyncCheckout}
      papelizAccountDialogFooter={
        <>
          <button type="button" onClick={closePapelizAccountSyncCheckout} className={papelizAccountSecondaryButtonClassName}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => startPapelizAccountSyncCheckout(syncCheckoutStage.chosenSyncPlanId, syncCheckoutStage.chosenSyncBillingPeriod, chosenPapelizSyncStoragePlace)}
            className={papelizAccountCompactPrimaryButtonClassName}
          >
            Continue to Checkout
          </button>
        </>
      }
    >
      <p>
        Your notes are encrypted on your devices before they’re stored. <b className="font-semibold text-papeliz-ink">You can’t change this later.</b>
      </p>
      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <legend className="sr-only">Storage place</legend>
        {papelizSyncStoragePlaces.map((papelizSyncStoragePlace) => (
          <label
            key={papelizSyncStoragePlace}
            className={`flex cursor-pointer items-center gap-3 rounded-[10px] border px-3.5 py-2.5 ${
              chosenPapelizSyncStoragePlace === papelizSyncStoragePlace ? 'border-papeliz-blue bg-papeliz-blue-soft' : 'border-papeliz-line bg-papeliz-surface hover:bg-papeliz-surface-soft'
            }`}
          >
            <input
              type="radio"
              name="papeliz-account-sync-storage-place"
              value={papelizSyncStoragePlace}
              checked={chosenPapelizSyncStoragePlace === papelizSyncStoragePlace}
              onChange={() => setChosenPapelizSyncStoragePlace(papelizSyncStoragePlace)}
              className="size-4 accent-papeliz-gradient-start"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-papeliz-ink">{papelizAccountStoragePlaceLabels[papelizSyncStoragePlace].storagePlaceName}</span>
              <span className="block text-xs text-papeliz-ink-muted">{papelizAccountStoragePlaceLabels[papelizSyncStoragePlace].storagePlaceGuarantee}</span>
            </span>
            {papelizSyncStoragePlace === nearestPapelizSyncStoragePlace && <span className="text-[11px] font-bold text-papeliz-blue">Nearest</span>}
          </label>
        ))}
      </fieldset>
    </PapelizAccountDialog>
  )
}
