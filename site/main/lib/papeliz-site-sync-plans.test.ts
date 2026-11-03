import { describe, expect, it } from 'vitest'
import {
  createPapelizSiteSyncSignUpHref,
  describePapelizSiteSyncFreePlanLimits,
  describePapelizSiteSyncPlanLimits,
  papelizSiteSyncBillingPeriodAddressParameterName,
  papelizSiteSyncConnectedDeviceLimit,
  papelizSiteSyncFreePlan,
  papelizSiteSyncFreeSignUpHref,
  papelizSiteSyncPlanAddressParameterName,
  papelizSiteSyncPlanEncryptionLine,
  papelizSiteSyncPlans,
  papelizSiteSyncPreselectedBillingPeriod,
  readPapelizSiteSyncChosenPlan,
  readPapelizSiteSyncPlanMonthlyRateUsd,
  readPapelizSiteSyncPlanYearlyDiscountPercent,
  readPapelizSiteSyncPlanYearlyMonthsSaved,
  readPapelizSiteSyncStartingYearlyMonthlyRateUsd,
} from './papeliz-site-sync-plans'

function readPapelizSiteTestSignUpHrefParameters(papelizSiteSyncSignUpHref: string | null): URLSearchParams {
  expect(papelizSiteSyncSignUpHref).not.toBeNull()
  return new URLSearchParams(papelizSiteSyncSignUpHref!.split('?')[1])
}

describe('yearly billing chosen first', () => {
  it('preselects yearly', () => {
    expect(papelizSiteSyncPreselectedBillingPeriod).toBe('yearly')
  })

  it("starts a paid plan's Sign up on yearly when no period is chosen", () => {
    const papelizSiteTestSignUpHrefParameters = readPapelizSiteTestSignUpHrefParameters(createPapelizSiteSyncSignUpHref('plus'))
    expect(papelizSiteTestSignUpHrefParameters.get(papelizSiteSyncPlanAddressParameterName)).toBe('plus')
    expect(papelizSiteTestSignUpHrefParameters.get(papelizSiteSyncBillingPeriodAddressParameterName)).toBe('yearly')
  })

  it("keeps Monthly on a paid plan's Sign up when Monthly was chosen", () => {
    expect(readPapelizSiteTestSignUpHrefParameters(createPapelizSiteSyncSignUpHref('pro', 'monthly')).get(papelizSiteSyncBillingPeriodAddressParameterName)).toBe('monthly')
  })

  it("leaves the Free card's Sign up on the account page with no plan or period", () => {
    expect(papelizSiteSyncFreeSignUpHref).toBe('/account/')
  })

  it('opens the account page on yearly for a plan chosen in the address without a period', () => {
    expect(readPapelizSiteSyncChosenPlan(new URLSearchParams({ [papelizSiteSyncPlanAddressParameterName]: 'standard' }))).toEqual({
      chosenSyncPlanId: 'standard',
      chosenSyncBillingPeriod: 'yearly',
    })
  })

  it('keeps the period an address chose', () => {
    expect(
      readPapelizSiteSyncChosenPlan(
        new URLSearchParams({ [papelizSiteSyncPlanAddressParameterName]: 'plus', [papelizSiteSyncBillingPeriodAddressParameterName]: 'monthly' }),
      ),
    ).toEqual({ chosenSyncPlanId: 'plus', chosenSyncBillingPeriod: 'monthly' })
  })

  it("chooses nothing for a plan or period that isn't sold, or a period with no plan", () => {
    expect(readPapelizSiteSyncChosenPlan(new URLSearchParams({ [papelizSiteSyncPlanAddressParameterName]: 'gold' }))).toBeNull()
    expect(readPapelizSiteSyncChosenPlan(new URLSearchParams({ [papelizSiteSyncPlanAddressParameterName]: 'free' }))).toBeNull()
    expect(
      readPapelizSiteSyncChosenPlan(
        new URLSearchParams({ [papelizSiteSyncPlanAddressParameterName]: 'plus', [papelizSiteSyncBillingPeriodAddressParameterName]: 'weekly' }),
      ),
    ).toBeNull()
    expect(readPapelizSiteSyncChosenPlan(new URLSearchParams({ [papelizSiteSyncBillingPeriodAddressParameterName]: 'yearly' }))).toBeNull()
    expect(readPapelizSiteSyncChosenPlan(new URLSearchParams())).toBeNull()
  })
})

describe("every plan's lines", () => {
  it('count old versions in storage, and name the devices and both kinds of encryption, on Free', () => {
    const papelizSiteTestFreePlanLines = describePapelizSiteSyncFreePlanLimits()
    expect(papelizSiteTestFreePlanLines[0]).toBe(`${papelizSiteSyncFreePlan.papelizSiteSyncFreePlanStorageLabel} storage`)
    expect(papelizSiteTestFreePlanLines).toContain(`${papelizSiteSyncFreePlan.papelizSiteSyncFreePlanConnectedDeviceLimit} devices`)
    expect(papelizSiteTestFreePlanLines.at(-1)).toBe(papelizSiteSyncPlanEncryptionLine)
  })

  it('count old versions in storage, and name the devices and both kinds of encryption, on every paid plan', () => {
    for (const papelizSiteSyncPlan of papelizSiteSyncPlans) {
      const papelizSiteTestPaidPlanLines = describePapelizSiteSyncPlanLimits(papelizSiteSyncPlan)
      expect(papelizSiteTestPaidPlanLines[0]).toBe(`${papelizSiteSyncPlan.papelizSiteSyncPlanStorageLabel} storage`)
      expect(papelizSiteTestPaidPlanLines).toContain(`${papelizSiteSyncConnectedDeviceLimit} devices`)
      expect(papelizSiteTestPaidPlanLines.at(-1)).toBe(papelizSiteSyncPlanEncryptionLine)
    }
  })

  it('say "1 month" of version history for one month, and "months" for more', () => {
    const papelizSiteTestStandardPlan = papelizSiteSyncPlans.find((papelizSiteSyncPlan) => papelizSiteSyncPlan.papelizSiteSyncPlanId === 'standard')
    if (papelizSiteTestStandardPlan === undefined) throw new Error('No Standard plan')
    expect(describePapelizSiteSyncPlanLimits({ ...papelizSiteTestStandardPlan, papelizSiteSyncPlanNoteHistoryMonthCount: 1 })).toContain('1 month of version history')
    expect(describePapelizSiteSyncPlanLimits({ ...papelizSiteTestStandardPlan, papelizSiteSyncPlanNoteHistoryMonthCount: 12 })).toContain('12 months of version history')
  })
})

describe('yearly savings', () => {
  it('are the same share and the same months on every paid plan, as the badge and the FAQ say once for all', () => {
    const papelizSiteTestYearlyDiscountPercents = new Set(papelizSiteSyncPlans.map(readPapelizSiteSyncPlanYearlyDiscountPercent))
    const papelizSiteTestYearlyMonthsSaved = new Set(papelizSiteSyncPlans.map(readPapelizSiteSyncPlanYearlyMonthsSaved))
    expect(papelizSiteTestYearlyDiscountPercents.size).toBe(1)
    expect(papelizSiteTestYearlyMonthsSaved.size).toBe(1)
  })

  it('start at the first plan, with the plans listed cheapest first', () => {
    const papelizSiteTestYearlyMonthlyRates = papelizSiteSyncPlans.map((papelizSiteSyncPlan) => readPapelizSiteSyncPlanMonthlyRateUsd(papelizSiteSyncPlan, 'yearly'))
    expect(papelizSiteTestYearlyMonthlyRates).toEqual([...papelizSiteTestYearlyMonthlyRates].sort((papelizSiteTestRateA, papelizSiteTestRateB) => papelizSiteTestRateA - papelizSiteTestRateB))
    expect(readPapelizSiteSyncStartingYearlyMonthlyRateUsd()).toBe(papelizSiteTestYearlyMonthlyRates[0])
  })
})
