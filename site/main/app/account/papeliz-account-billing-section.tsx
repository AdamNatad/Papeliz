'use client'

import { useState } from 'react'
import { papelizSiteSyncEducationAndNonProfitDiscountPercent, papelizSiteSyncRefundWindowDayCount } from '@/lib/papeliz-site-sync-plans'
import { papelizAccountCompactPrimaryButtonClassName, papelizAccountRowActionWidthClassName, papelizAccountSecondaryButtonClassName } from './papeliz-account-card-frame'
import { papelizAccountSupportPath } from './papeliz-account-config'
import { PapelizAccountDialog } from './papeliz-account-dialog'
import { PapelizAccountRow, PapelizAccountRowDescription, PapelizAccountRowGroup } from './papeliz-account-rows'

type PapelizAccountBillingRow = {
  billingRowKey: 'subscription-and-payment-method' | 'invoices-and-refunds' | 'education-and-non-profit-discount'
  billingRowTitle: string
  billingRowDescription: string
  billingRowActionLabel: string
  billingRowActionAccessibleLabel: string
  billingDialogTitle: string
  billingDialogAvailability: string
  billingDialogSupport: string
}

// Payments go through a merchant of record, which charges the sales tax or VAT and runs the
// customer portal: the plan, the card, cancelling and the orders. Refunds are issued by Papeliz on
// request. Until checkout and the portal are live, each row's button says so and offers support.
const papelizAccountBillingRows: readonly PapelizAccountBillingRow[] = [
  {
    billingRowKey: 'subscription-and-payment-method',
    billingRowTitle: 'Subscription and payment method',
    billingRowDescription: 'Change or cancel your plan, and update your card, on our payment provider’s secure page.',
    billingRowActionLabel: 'Manage',
    billingRowActionAccessibleLabel: 'Manage subscription and payment method',
    billingDialogTitle: 'Subscription and payment method',
    billingDialogAvailability: 'Your plan, your card and cancelling are managed on our payment provider’s secure page, which opens from here once Sync launches.',
    billingDialogSupport: 'Until then, contact us with any question about a subscription.',
  },
  {
    billingRowKey: 'invoices-and-refunds',
    billingRowTitle: 'Invoices and refunds',
    billingRowDescription: `Every payment is emailed to you. A full refund within ${papelizSiteSyncRefundWindowDayCount} days of subscribing.`,
    billingRowActionLabel: 'View',
    billingRowActionAccessibleLabel: 'View invoices and refunds',
    billingDialogTitle: 'Invoices and refunds',
    billingDialogAvailability:
      'After every payment, you get an email with your order. Your orders and invoices are on our payment provider’s secure page, which opens from Subscription and payment method once Sync launches.',
    billingDialogSupport: `For a full refund within ${papelizSiteSyncRefundWindowDayCount} days of subscribing, or help with an invoice, contact us.`,
  },
  {
    billingRowKey: 'education-and-non-profit-discount',
    billingRowTitle: 'Education and non-profit discount',
    billingRowDescription: `${papelizSiteSyncEducationAndNonProfitDiscountPercent}% off any plan, as a code after a short check.`,
    billingRowActionLabel: 'Apply',
    billingRowActionAccessibleLabel: 'Apply for the education and non-profit discount',
    billingDialogTitle: 'Education and non-profit discount',
    billingDialogAvailability: 'Applying for the discount isn’t available here yet.',
    billingDialogSupport: 'Contact us before you subscribe. After a short check, you get a code to use at checkout.',
  },
]

// The account page's Billing section: one row each for the subscription and payment method,
// invoices and refunds, and the discount.
export function PapelizAccountBillingSection() {
  const [openPapelizAccountBillingRow, setOpenPapelizAccountBillingRow] = useState<PapelizAccountBillingRow | null>(null)
  const closePapelizAccountBillingDialog = () => setOpenPapelizAccountBillingRow(null)

  return (
    <>
      <PapelizAccountRowGroup>
        {papelizAccountBillingRows.map((papelizAccountBillingRow) => (
          <PapelizAccountRow
            key={papelizAccountBillingRow.billingRowKey}
            papelizAccountRowTitle={papelizAccountBillingRow.billingRowTitle}
            papelizAccountRowExtra={<PapelizAccountRowDescription>{papelizAccountBillingRow.billingRowDescription}</PapelizAccountRowDescription>}
            papelizAccountRowAction={
              <button
                type="button"
                aria-label={papelizAccountBillingRow.billingRowActionAccessibleLabel}
                aria-haspopup="dialog"
                onClick={() => setOpenPapelizAccountBillingRow(papelizAccountBillingRow)}
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
