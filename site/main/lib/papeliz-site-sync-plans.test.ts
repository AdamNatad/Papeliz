import { describe, expect, it } from 'vitest'
import {
  createPapelizSiteSyncSignUpHref,
  papelizSiteSyncBillingPeriodAddressParameterName,
  papelizSiteSyncFreeSignUpHref,
  papelizSiteSyncPlanAddressParameterName,
  papelizSiteSyncPreselectedBillingPeriod,
  readPapelizSiteSyncChosenPlan,
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
