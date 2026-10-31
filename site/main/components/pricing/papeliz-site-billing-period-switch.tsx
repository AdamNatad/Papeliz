'use client'

import { useId, type ReactNode } from 'react'
import { PapelizSitePillSwitch } from '@/components/controls/papeliz-site-pill-switch'
import type { PapelizSiteSyncBillingPeriod } from '@/lib/papeliz-site-sync-plans'
import styles from './papeliz-site-billing-period-switch.module.css'

export type PapelizSiteBillingPeriodChoice = {
  papelizSiteBillingPeriodChoiceValue: PapelizSiteSyncBillingPeriod
  papelizSiteBillingPeriodChoiceLabel: string
  papelizSiteBillingPeriodChoiceBadge?: string
}

type PapelizSiteBillingPeriodSwitchProps = {
  papelizSiteChosenBillingPeriod: PapelizSiteSyncBillingPeriod
  papelizSiteBillingPeriodChoices: readonly PapelizSiteBillingPeriodChoice[]
  onPapelizSiteBillingPeriodChoose: (papelizSiteBillingPeriod: PapelizSiteSyncBillingPeriod) => void
  papelizSiteBillingPeriodSwitchLabel: string
  // Round and centered on the Pricing and Sync pages; compact and left-aligned inside the account page.
  papelizSiteBillingPeriodSwitchVariant?: 'round' | 'compact'
  // Explains the badge: the trigger sits inside the badge, the description is read with its choice.
  papelizSiteBillingPeriodBadgeInfo?: { papelizSiteBillingPeriodBadgeInfoTrigger: ReactNode; papelizSiteBillingPeriodBadgeInfoDescription: string }
}

// The Monthly / Yearly switch above Papeliz Sync's plans: the site's pill switch, with the yearly
// saving as a badge beside its choice.
export function PapelizSiteBillingPeriodSwitch({
  papelizSiteChosenBillingPeriod,
  papelizSiteBillingPeriodChoices,
  onPapelizSiteBillingPeriodChoose,
  papelizSiteBillingPeriodSwitchLabel,
  papelizSiteBillingPeriodSwitchVariant = 'round',
  papelizSiteBillingPeriodBadgeInfo,
}: PapelizSiteBillingPeriodSwitchProps) {
  const papelizSiteBillingPeriodBadgeInfoId = useId()
  return (
    <PapelizSitePillSwitch
      papelizSitePillSwitchLabel={papelizSiteBillingPeriodSwitchLabel}
      papelizSitePillSwitchVariant={papelizSiteBillingPeriodSwitchVariant}
      papelizSitePillSwitchChosenValue={papelizSiteChosenBillingPeriod}
      onPapelizSitePillSwitchChoose={onPapelizSiteBillingPeriodChoose}
      papelizSitePillSwitchOptions={papelizSiteBillingPeriodChoices.map((papelizSiteBillingPeriodChoice) => ({
        papelizSitePillSwitchOptionValue: papelizSiteBillingPeriodChoice.papelizSiteBillingPeriodChoiceValue,
        papelizSitePillSwitchOptionLabel: papelizSiteBillingPeriodChoice.papelizSiteBillingPeriodChoiceLabel,
        papelizSitePillSwitchOptionExtra: papelizSiteBillingPeriodChoice.papelizSiteBillingPeriodChoiceBadge ? (
          <span className={styles.badge}>
            {papelizSiteBillingPeriodChoice.papelizSiteBillingPeriodChoiceBadge}
            {papelizSiteBillingPeriodBadgeInfo?.papelizSiteBillingPeriodBadgeInfoTrigger}
          </span>
        ) : undefined,
        papelizSitePillSwitchOptionDescribedById:
          papelizSiteBillingPeriodChoice.papelizSiteBillingPeriodChoiceBadge && papelizSiteBillingPeriodBadgeInfo ? papelizSiteBillingPeriodBadgeInfoId : undefined,
      }))}
      papelizSitePillSwitchAfterOptions={
        papelizSiteBillingPeriodBadgeInfo ? (
          <span id={papelizSiteBillingPeriodBadgeInfoId} className={styles.srOnly}>
            {papelizSiteBillingPeriodBadgeInfo.papelizSiteBillingPeriodBadgeInfoDescription}
          </span>
        ) : null
      }
    />
  )
}
