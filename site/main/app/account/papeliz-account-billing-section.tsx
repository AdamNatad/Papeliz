'use client'

import { useState } from 'react'
import { papelizSiteSyncRefundWindowDayCount } from '@/lib/papeliz-site-sync-plans'
import { papelizAccountCompactPrimaryButtonClassName, papelizAccountRowActionWidthClassName, papelizAccountSecondaryButtonClassName } from './papeliz-account-card-frame'
import { papelizAccountSupportPath } from './papeliz-account-config'
import { PapelizAccountDialog } from './papeliz-account-dialog'
import { PapelizAccountRow, PapelizAccountRowDescription, PapelizAccountRowGroup } from './papeliz-account-rows'
import {
  describePapelizAccountSyncBillingDay,
  PapelizAccountSyncSubscriptionNotice,
  readPapelizAccountSyncPlanName,
  type PapelizAccountSyncBillingState,
} from './papeliz-account-sync-billing'
import type { PapelizAccountSyncBilling } from './papeliz-account-sync-service'

type PapelizAccountBillingRow = {
  billingRowKey: 'subscription-and-payment-method' | 'invoices-and-refunds'
  billingRowTitle: string
  billingRowDescription: string
  billingRowActionLabel: string
  billingRowActionAccessibleLabel: string
  billingDialogTitle: string
  billingDialogAvailability: string
  billingDialogSupport: string
}

// Payments go through a merchant of record, which charges the sales tax or VAT and runs the
// subscription's own page: the plan, the card, cancelling and the orders. Refunds are issued by
// Papeliz on request. Before the first payment each row's button explains that and offers support;
// after it, both open the subscription's own page in a new tab.
const papelizAccountBillingRows: readonly PapelizAccountBillingRow[] = [
  {
    billingRowKey: 'subscription-and-payment-method',
    billingRowTitle: 'Subscription and payment method',
    billingRowDescription: 'Change or cancel your plan, and update your card, on our payment provider’s secure page.',
    billingRowActionLabel: 'Manage',
    billingRowActionAccessibleLabel: 'Manage subscription and payment method',
    billingDialogTitle: 'Subscription and payment method',
    billingDialogAvailability: 'Your plan, your card and cancelling are managed on our payment provider’s secure page, which opens from here once you subscribe.',
    billingDialogSupport: 'Choose a plan under Sync, or contact us with any question about a subscription.',
  },
  {
    billingRowKey: 'invoices-and-refunds',
    billingRowTitle: 'Invoices and refunds',
    billingRowDescription: `Every payment is emailed to you. A full refund within ${papelizSiteSyncRefundWindowDayCount} days of subscribing.`,
    billingRowActionLabel: 'View',
    billingRowActionAccessibleLabel: 'View invoices and refunds',
    billingDialogTitle: 'Invoices and refunds',
    billingDialogAvailability:
      'After every payment, you get an email with your order. Your orders and invoices are on our payment provider’s secure page, which opens from here once you subscribe.',
    billingDialogSupport: `For a full refund within ${papelizSiteSyncRefundWindowDayCount} days of subscribing, or help with an invoice, contact us.`,
  },
]

// The subscription row's line, from the subscription's real state.
function describePapelizAccountSyncSubscription(syncBilling: PapelizAccountSyncBilling, currentTime: number): string | null {
  const syncPlanName = syncBilling.syncPlanName === null ? 'Sync' : `Sync ${readPapelizAccountSyncPlanName(syncBilling.syncPlanName)}`
  switch (syncBilling.syncSubscriptionState) {
    case 'active':
      return syncBilling.syncSubscriptionRenewsAt === null ? `${syncPlanName}.` : `${syncPlanName}, renews on ${describePapelizAccountSyncBillingDay(syncBilling.syncSubscriptionRenewsAt, currentTime)}.`
    case 'ends-at-period-end':
      return syncBilling.syncSubscriptionEndsAt === null ? `${syncPlanName}, ending.` : `${syncPlanName}, ends on ${describePapelizAccountSyncBillingDay(syncBilling.syncSubscriptionEndsAt, currentTime)}.`
    case 'payment-past-due':
      return `${syncPlanName}. Your last payment didn’t go through.`
    case 'ended-read-only':
    case 'ended-held':
      return syncBilling.syncSubscriptionEndsAt === null ? `${syncPlanName} ended.` : `${syncPlanName} ended on ${describePapelizAccountSyncBillingDay(syncBilling.syncSubscriptionEndsAt, currentTime)}.`
    case 'not-subscribed':
      return null
  }
}

// The account page's Billing section: one row for the subscription and payment method, one for
// invoices and refunds, with what the subscription needs said above them.
export function PapelizAccountBillingSection({ papelizAccountSyncBillingState }: { papelizAccountSyncBillingState: PapelizAccountSyncBillingState }) {
  const [openPapelizAccountBillingRow, setOpenPapelizAccountBillingRow] = useState<PapelizAccountBillingRow | null>(null)
  const [currentTime] = useState(() => Date.now())
  const closePapelizAccountBillingDialog = () => setOpenPapelizAccountBillingRow(null)
  const { syncBillingStage, syncBillingPortalFailureMessage, openPapelizAccountSyncBillingPortal } = papelizAccountSyncBillingState
  const syncBilling = syncBillingStage.syncBillingStageKind === 'read' ? syncBillingStage.syncBilling : null
  const isSyncBillingPortalOpenable = syncBilling?.hasSyncPaymentCustomer === true
  const syncSubscriptionDescription = syncBilling === null ? null : describePapelizAccountSyncSubscription(syncBilling, currentTime)

  return (
    <>
      <PapelizAccountSyncSubscriptionNotice papelizAccountSyncBillingState={papelizAccountSyncBillingState} />
      {syncBillingPortalFailureMessage !== null && (
        <p role="alert" className="mb-3 text-sm text-papeliz-diff-removed-ink">
          {syncBillingPortalFailureMessage}
        </p>
      )}
      <PapelizAccountRowGroup>
        {papelizAccountBillingRows.map((papelizAccountBillingRow) => (
          <PapelizAccountRow
            key={papelizAccountBillingRow.billingRowKey}
            papelizAccountRowTitle={papelizAccountBillingRow.billingRowTitle}
            papelizAccountRowExtra={
              <>
                {papelizAccountBillingRow.billingRowKey === 'subscription-and-payment-method' && syncSubscriptionDescription !== null && (
                  <PapelizAccountRowDescription>
                    <b className="font-semibold text-papeliz-ink">{syncSubscriptionDescription}</b>
                  </PapelizAccountRowDescription>
                )}
                <PapelizAccountRowDescription>{papelizAccountBillingRow.billingRowDescription}</PapelizAccountRowDescription>
              </>
            }
            papelizAccountRowAction={
              <button
                type="button"
                aria-label={papelizAccountBillingRow.billingRowActionAccessibleLabel}
                aria-haspopup={isSyncBillingPortalOpenable ? undefined : 'dialog'}
                onClick={() => (isSyncBillingPortalOpenable ? openPapelizAccountSyncBillingPortal() : setOpenPapelizAccountBillingRow(papelizAccountBillingRow))}
                className={`${papelizAccountCompactPrimaryButtonClassName} ${papelizAccountRowActionWidthClassName}`}
              >
                {papelizAccountBillingRow.billingRowActionLabel}
              </button>
            }
          />
        ))}
      </PapelizAccountRowGroup>
      {openPapelizAccountBillingRow && (
        <PapelizAccountDialog
          papelizAccountDialogTitle={openPapelizAccountBillingRow.billingDialogTitle}
          onPapelizAccountDialogClose={closePapelizAccountBillingDialog}
          papelizAccountDialogFooter={
            <>
              <button type="button" onClick={closePapelizAccountBillingDialog} className={papelizAccountSecondaryButtonClassName}>
                Close
              </button>
              <a href={papelizAccountSupportPath} className={papelizAccountCompactPrimaryButtonClassName}>
                Contact support
              </a>
            </>
          }
        >
          <p>{openPapelizAccountBillingRow.billingDialogAvailability}</p>
          <p>{openPapelizAccountBillingRow.billingDialogSupport}</p>
        </PapelizAccountDialog>
      )}
    </>
  )
}
