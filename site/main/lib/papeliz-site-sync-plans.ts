import { papelizSiteAccountUrl } from './papeliz-site-config'

// Papeliz Sync's plans as the Pricing and Sync pages show them: each plan's prices and the limits
// people see. They match the prices at checkout and the plans in the app's Settings › Sync; a price
// changes in all three together.

export type PapelizSiteSyncPlanId = 'standard' | 'plus' | 'pro'
export type PapelizSiteSyncBillingPeriod = 'monthly' | 'yearly'

// Yearly is chosen first wherever a paid plan is offered, with Monthly one click away (Adam,
// 2026-11-02): the Monthly / Yearly switches, the paid plans' Sign up and a plan chosen in an address.
export const papelizSiteSyncPreselectedBillingPeriod: PapelizSiteSyncBillingPeriod = 'yearly'

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
    papelizSiteSyncPlanNoteHistoryMonthCount: 1,
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
    papelizSiteSyncPlanNoteHistoryMonthCount: 12,
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
    papelizSiteSyncPlanNoteHistoryMonthCount: 12,
  },
]

// The Free plan: no price and no checkout, since a free Papeliz account gets it at sign-in. It sits
// beside the paid plans, not among them, so nothing that sells a plan ever offers it.
export type PapelizSiteSyncFreePlanId = 'free'

export const papelizSiteSyncFreePlan = {
  papelizSiteSyncFreePlanId: 'free' as PapelizSiteSyncFreePlanId,
  papelizSiteSyncFreePlanName: 'Free',
  papelizSiteSyncFreePlanStorageLabel: '10 MB',
  papelizSiteSyncFreePlanVaultLimit: 1,
  papelizSiteSyncFreePlanConnectedDeviceLimit: 2,
  papelizSiteSyncFreePlanLargestFileLabel: '5 MB',
  papelizSiteSyncFreePlanNoteHistoryDayCount: 7,
} as const

// Every plan, Free included, offers both kinds of vault.
export const papelizSiteSyncPlanEncryptionLine = 'Standard and End-to-end encryption'

// A storage line: old versions count toward storage, as the app's Settings › Sync says.
function describePapelizSiteSyncPlanStorageLine(papelizSiteSyncPlanStorageLabel: string): string {
  return `${papelizSiteSyncPlanStorageLabel} storage, old versions included`
}

// The Free card's lines, in the paid cards' order. Free's file count in a vault is a hidden limit, so
// it has no line.
export function describePapelizSiteSyncFreePlanLimits(): string[] {
  return [
    describePapelizSiteSyncPlanStorageLine(papelizSiteSyncFreePlan.papelizSiteSyncFreePlanStorageLabel),
    `${papelizSiteSyncFreePlan.papelizSiteSyncFreePlanVaultLimit} synced vault`,
    `${papelizSiteSyncFreePlan.papelizSiteSyncFreePlanConnectedDeviceLimit} devices`,
    `${papelizSiteSyncFreePlan.papelizSiteSyncFreePlanLargestFileLabel} per file`,
    `${papelizSiteSyncFreePlan.papelizSiteSyncFreePlanNoteHistoryDayCount} days of version history`,
    papelizSiteSyncPlanEncryptionLine,
  ]
}

// The same on every paid plan.
export const papelizSiteSyncConnectedDeviceLimit = 20
export const papelizSiteSyncEducationAndNonProfitDiscountPercent = 40
export const papelizSiteSyncRefundWindowDayCount = 7

// A plan and billing period chosen in an address: the account page reads them to open Sync ready for
// checkout, and the app reads the same two to open Settings › Sync with the plan chosen. They must
// match papelizSyncPlanAddressParameterName and papelizSyncBillingPeriodAddressParameterName in
// app/web/src/modules/sync/papeliz-sync-settings-gear-request-store.ts.
export const papelizSiteSyncPlanAddressParameterName = 'papeliz-sync-plan'
export const papelizSiteSyncBillingPeriodAddressParameterName = 'papeliz-sync-billing-period'

export interface PapelizSiteSyncChosenPlan {
  chosenSyncPlanId: PapelizSiteSyncPlanId
  chosenSyncBillingPeriod: PapelizSiteSyncBillingPeriod
}

// The plan and period an address chose, or null when it chose none or one that isn't sold. A plan
// with no period starts on the preselected one.
export function readPapelizSiteSyncChosenPlan(papelizSiteAddressParameters: URLSearchParams): PapelizSiteSyncChosenPlan | null {
  const chosenSyncPlanId = papelizSiteAddressParameters.get(papelizSiteSyncPlanAddressParameterName)
  const chosenSyncBillingPeriod = papelizSiteAddressParameters.get(papelizSiteSyncBillingPeriodAddressParameterName) ?? papelizSiteSyncPreselectedBillingPeriod
  const isChosenSyncPlanSold = papelizSiteSyncPlans.some((papelizSiteSyncPlan) => papelizSiteSyncPlan.papelizSiteSyncPlanId === chosenSyncPlanId)
  if (!isChosenSyncPlanSold || (chosenSyncBillingPeriod !== 'monthly' && chosenSyncBillingPeriod !== 'yearly')) return null
  return { chosenSyncPlanId: chosenSyncPlanId as PapelizSiteSyncPlanId, chosenSyncBillingPeriod }
}

// Sign up's address: the account page, where the visitor signs in and checks out with this plan and
// period chosen, yearly unless Monthly was chosen. Null while the account page has no address, and
// Sign up is then left out.
export function createPapelizSiteSyncSignUpHref(
  papelizSiteSyncPlanId: PapelizSiteSyncPlanId,
  papelizSiteSyncBillingPeriod: PapelizSiteSyncBillingPeriod = papelizSiteSyncPreselectedBillingPeriod,
): string | null {
  if (!papelizSiteAccountUrl) return null
  const papelizSiteSyncSignUpAddressParameters = new URLSearchParams({
    [papelizSiteSyncPlanAddressParameterName]: papelizSiteSyncPlanId,
    [papelizSiteSyncBillingPeriodAddressParameterName]: papelizSiteSyncBillingPeriod,
  })
  return `${papelizSiteAccountUrl}?${papelizSiteSyncSignUpAddressParameters.toString()}`
}

// The Free card's Sign up: the account page with no plan chosen, since signing in is all Free needs.
export const papelizSiteSyncFreeSignUpHref: string | null = papelizSiteAccountUrl

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

// How much less a year billed yearly costs than twelve months billed monthly, in whole percent.
export function readPapelizSiteSyncPlanYearlyDiscountPercent(papelizSiteSyncPlan: PapelizSiteSyncPlan): number {
  return Math.round((readPapelizSiteSyncPlanYearlySavingUsd(papelizSiteSyncPlan) / (papelizSiteSyncPlan.papelizSiteSyncPlanMonthlyPriceUsd * 12)) * 100)
}

// The lowest price for a month on any paid plan, billed yearly: where the paid plans start.
export function readPapelizSiteSyncStartingYearlyMonthlyRateUsd(): number {
  return Math.min(...papelizSiteSyncPlans.map((papelizSiteSyncPlan) => readPapelizSiteSyncPlanMonthlyRateUsd(papelizSiteSyncPlan, 'yearly')))
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

// A plan card's lines, the limits people see, the same on the Pricing, Sync and account pages. The
// largest file reads "50 MB per file", number first like the lines around it (Adam, 2026-11-01: "we
// need to clairfy on Files up to 50mb").
export function describePapelizSiteSyncPlanLimits(papelizSiteSyncPlan: PapelizSiteSyncPlan): string[] {
  return [
    describePapelizSiteSyncPlanStorageLine(papelizSiteSyncPlan.papelizSiteSyncPlanStorageLabel),
    `${papelizSiteSyncPlan.papelizSiteSyncPlanVaultLimit} synced vaults`,
    `${papelizSiteSyncPlan.papelizSiteSyncPlanFilesPerVaultLimit.toLocaleString('en-US')} files in each vault`,
    `${papelizSiteSyncConnectedDeviceLimit} devices`,
    `${papelizSiteSyncPlan.papelizSiteSyncPlanLargestFileLabel} per file`,
    `${papelizSiteSyncPlan.papelizSiteSyncPlanNoteHistoryMonthCount} ${papelizSiteSyncPlan.papelizSiteSyncPlanNoteHistoryMonthCount === 1 ? 'month' : 'months'} of version history`,
    papelizSiteSyncPlanEncryptionLine,
  ]
}
