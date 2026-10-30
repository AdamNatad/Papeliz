import { papelizSiteAppUrl } from './papeliz-site-config'

// Papeliz Sync's plans as the Pricing and Sync pages show them: each plan's prices and the limits
// people see. They match the prices at checkout and the plans in the app's Settings › Sync; a price
// changes in all three together.

export type PapelizSiteSyncPlanId = 'standard' | 'plus' | 'pro'
export type PapelizSiteSyncBillingPeriod = 'monthly' | 'yearly'

export type PapelizSiteSyncPlan = {
  papelizSiteSyncPlanId: PapelizSiteSyncPlanId
  papelizSiteSyncPlanName: string
  // In US dollars: a month billed monthly, and a whole year billed yearly.
  papelizSiteSyncPlanMonthlyPriceUsd: number
  papelizSiteSyncPlanYearlyPriceUsd: number
  papelizSiteSyncPlanStorageLabel: string
  papelizSiteSyncPlanVaultLimit: number
  papelizSiteSyncPlanFilesPerVaultLimit: number
  papelizSiteSyncPlanLargestFileLabel: string
  papelizSiteSyncPlanNoteHistoryMonthCount: number
}

export const papelizSiteSyncPlans: readonly PapelizSiteSyncPlan[] = [
  {
    papelizSiteSyncPlanId: 'standard',
    papelizSiteSyncPlanName: 'Standard',
    papelizSiteSyncPlanMonthlyPriceUsd: 5,
    papelizSiteSyncPlanYearlyPriceUsd: 48,
    papelizSiteSyncPlanStorageLabel: '10 GB',
    papelizSiteSyncPlanVaultLimit: 5,
    papelizSiteSyncPlanFilesPerVaultLimit: 100_000,
    papelizSiteSyncPlanLargestFileLabel: '50 MB',
    papelizSiteSyncPlanNoteHistoryMonthCount: 6,
  },
  {
    papelizSiteSyncPlanId: 'plus',
    papelizSiteSyncPlanName: 'Plus',
    papelizSiteSyncPlanMonthlyPriceUsd: 10,
    papelizSiteSyncPlanYearlyPriceUsd: 96,
    papelizSiteSyncPlanStorageLabel: '100 GB',
    papelizSiteSyncPlanVaultLimit: 20,
    papelizSiteSyncPlanFilesPerVaultLimit: 250_000,
    papelizSiteSyncPlanLargestFileLabel: '1 GB',
    papelizSiteSyncPlanNoteHistoryMonthCount: 24,
  },
  {
    papelizSiteSyncPlanId: 'pro',
    papelizSiteSyncPlanName: 'Pro',
    papelizSiteSyncPlanMonthlyPriceUsd: 20,
    papelizSiteSyncPlanYearlyPriceUsd: 192,
    papelizSiteSyncPlanStorageLabel: '250 GB',
    papelizSiteSyncPlanVaultLimit: 100,
    papelizSiteSyncPlanFilesPerVaultLimit: 500_000,
    papelizSiteSyncPlanLargestFileLabel: '2 GB',
    papelizSiteSyncPlanNoteHistoryMonthCount: 36,
  },
]

// The same on every plan.
export const papelizSiteSyncConnectedDeviceLimit = 20
export const papelizSiteSyncEducationAndNonProfitDiscountPercent = 40
export const papelizSiteSyncRefundWindowDayCount = 7

// The app opens Settings › Sync with a plan and billing period chosen when its address carries these
// two parameters. They must match papelizSyncPlanAddressParameterName and
// papelizSyncBillingPeriodAddressParameterName in
// app/web/src/modules/sync/papeliz-sync-settings-gear-request-store.ts.
export const papelizSiteSyncPlanAddressParameterName = 'papeliz-sync-plan'
export const papelizSiteSyncBillingPeriodAddressParameterName = 'papeliz-sync-billing-period'

// Sign up's address: the app, opening on Settings › Sync with this plan and period chosen. Null while
// the app has no address, and Sign up is then left out.
export function createPapelizSiteSyncSignUpHref(
  papelizSiteSyncPlanId: PapelizSiteSyncPlanId,
  papelizSiteSyncBillingPeriod: PapelizSiteSyncBillingPeriod,
): string | null {
  if (!papelizSiteAppUrl) return null
  const papelizSiteSyncSignUpAddressParameters = new URLSearchParams({
    [papelizSiteSyncPlanAddressParameterName]: papelizSiteSyncPlanId,
    [papelizSiteSyncBillingPeriodAddressParameterName]: papelizSiteSyncBillingPeriod,
  })
  return `${papelizSiteAppUrl}?${papelizSiteSyncSignUpAddressParameters.toString()}`
}

// A plan's price for a month: the monthly price, or the yearly price spread over 12 months.
export function readPapelizSiteSyncPlanMonthlyRateUsd(papelizSiteSyncPlan: PapelizSiteSyncPlan, papelizSiteSyncBillingPeriod: PapelizSiteSyncBillingPeriod): number {
  return papelizSiteSyncBillingPeriod === 'monthly'
    ? papelizSiteSyncPlan.papelizSiteSyncPlanMonthlyPriceUsd
    : papelizSiteSyncPlan.papelizSiteSyncPlanYearlyPriceUsd / 12
}

// What a year billed yearly saves over twelve months billed monthly.
export function readPapelizSiteSyncPlanYearlySavingUsd(papelizSiteSyncPlan: PapelizSiteSyncPlan): number {
  return papelizSiteSyncPlan.papelizSiteSyncPlanMonthlyPriceUsd * 12 - papelizSiteSyncPlan.papelizSiteSyncPlanYearlyPriceUsd
}

// The yearly saving counted in months at the yearly rate: $12 saved at $4 a month is 3 months.
export function readPapelizSiteSyncPlanYearlyMonthsSaved(papelizSiteSyncPlan: PapelizSiteSyncPlan): number {
  const papelizSiteSyncPlanYearlyMonthlyRateUsd = readPapelizSiteSyncPlanMonthlyRateUsd(papelizSiteSyncPlan, 'yearly')
  return Math.round((readPapelizSiteSyncPlanYearlySavingUsd(papelizSiteSyncPlan) / papelizSiteSyncPlanYearlyMonthlyRateUsd) * 10) / 10
}

// Whole dollars without cents ("$4"), otherwise two decimals ("$4.50").
export function formatPapelizSiteSyncUsd(papelizSiteSyncAmountUsd: number): string {
  const papelizSiteSyncAmountIsWholeDollars = Number.isInteger(papelizSiteSyncAmountUsd)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: papelizSiteSyncAmountIsWholeDollars ? 0 : 2,
    maximumFractionDigits: papelizSiteSyncAmountIsWholeDollars ? 0 : 2,
  }).format(papelizSiteSyncAmountUsd)
}

// A plan card's lines, the limits people see.
export function describePapelizSiteSyncPlanLimits(papelizSiteSyncPlan: PapelizSiteSyncPlan): string[] {
  return [
    `${papelizSiteSyncPlan.papelizSiteSyncPlanStorageLabel} storage`,
    `${papelizSiteSyncPlan.papelizSiteSyncPlanVaultLimit} synced vaults`,
    `${papelizSiteSyncPlan.papelizSiteSyncPlanFilesPerVaultLimit.toLocaleString('en-US')} files in each vault`,
    `Files up to ${papelizSiteSyncPlan.papelizSiteSyncPlanLargestFileLabel}`,
    `${papelizSiteSyncPlan.papelizSiteSyncPlanNoteHistoryMonthCount} months of note history`,
  ]
}
