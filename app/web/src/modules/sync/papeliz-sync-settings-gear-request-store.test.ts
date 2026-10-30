import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readPapelizSyncPlanPickFromAddressSearch,
  requestPapelizSettingsGearSyncPage,
  resetPapelizSyncSettingsGearRequestsForTests,
  takePapelizSyncPlanPickFromAddress,
  usePapelizSyncSettingsGearRequestStore,
} from './papeliz-sync-settings-gear-request-store'

// Asking for the gear on Sync, and the plan the website's pricing page puts in the address. The tab's
// address is stood in for by a fake `location` and `history.replaceState`.

let papelizSyncTestAddress = new URL('https://papeliz.test/app/')
const replacePapelizSyncTestAddress = vi.fn((_historyState: unknown, _historyTitle: string, replacedAddress: string) => {
  papelizSyncTestAddress = new URL(replacedAddress, papelizSyncTestAddress)
})

function openPapelizSyncTestAddress(openedAddress: string): void {
  papelizSyncTestAddress = new URL(openedAddress)
  vi.stubGlobal('window', {
    get location() {
      return papelizSyncTestAddress
    },
    history: { state: null, replaceState: replacePapelizSyncTestAddress },
  })
}

beforeEach(() => {
  resetPapelizSyncSettingsGearRequestsForTests()
  replacePapelizSyncTestAddress.mockClear()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('a plan picked in the address', () => {
  it('reads the plan and the billing period, and leaves out values Papeliz doesn’t know', () => {
    expect(readPapelizSyncPlanPickFromAddressSearch('?papeliz-sync-plan=plus&papeliz-sync-billing-period=yearly')).toEqual({
      pickedSyncPlanName: 'plus',
      pickedSyncBillingPeriod: 'yearly',
    })
    expect(readPapelizSyncPlanPickFromAddressSearch('?papeliz-sync-plan=pro')).toEqual({ pickedSyncPlanName: 'pro', pickedSyncBillingPeriod: null })
    expect(readPapelizSyncPlanPickFromAddressSearch('?papeliz-sync-plan=gold&papeliz-sync-billing-period=monthly')).toEqual({
      pickedSyncPlanName: null,
      pickedSyncBillingPeriod: 'monthly',
    })
    expect(readPapelizSyncPlanPickFromAddressSearch('?papeliz-sync-plan=Plus&papeliz-sync-billing-period=weekly')).toBeNull()
    expect(readPapelizSyncPlanPickFromAddressSearch('')).toBeNull()
  })

  it('opens the gear on Sync once, takes the pick out of the address, keeps the rest, and sends nothing', () => {
    openPapelizSyncTestAddress('https://papeliz.test/app/?papeliz-sync-plan=standard&papeliz-sync-billing-period=monthly&papeliz-sync-fake-engine=on#start')
    takePapelizSyncPlanPickFromAddress()
    expect(usePapelizSyncSettingsGearRequestStore.getState()).toEqual({
      settingsGearSyncPageRequestCount: 1,
      syncPlanPickedFromAddress: { pickedSyncPlanName: 'standard', pickedSyncBillingPeriod: 'monthly' },
    })
    expect(papelizSyncTestAddress.href).toBe('https://papeliz.test/app/?papeliz-sync-fake-engine=on#start')
    // Read once: the address no longer holds it, so the next gear to appear finds nothing.
    takePapelizSyncPlanPickFromAddress()
    expect(usePapelizSyncSettingsGearRequestStore.getState().settingsGearSyncPageRequestCount).toBe(1)
    expect(replacePapelizSyncTestAddress).toHaveBeenCalledTimes(1)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('takes unknown values out of the address too, without opening anything', () => {
    openPapelizSyncTestAddress('https://papeliz.test/app/?papeliz-sync-plan=gold')
    takePapelizSyncPlanPickFromAddress()
    expect(papelizSyncTestAddress.href).toBe('https://papeliz.test/app/')
    expect(usePapelizSyncSettingsGearRequestStore.getState()).toEqual({ settingsGearSyncPageRequestCount: 0, syncPlanPickedFromAddress: null })
  })

  it('leaves an address without a pick alone', () => {
    openPapelizSyncTestAddress('https://papeliz.test/app/?papeliz-sync-fake-engine=on')
    takePapelizSyncPlanPickFromAddress()
    expect(replacePapelizSyncTestAddress).not.toHaveBeenCalled()
    expect(usePapelizSyncSettingsGearRequestStore.getState().settingsGearSyncPageRequestCount).toBe(0)
  })
})

describe('the status bar asking for the gear on Sync', () => {
  it('asks again on every click, with no plan picked', () => {
    requestPapelizSettingsGearSyncPage()
    requestPapelizSettingsGearSyncPage()
    expect(usePapelizSyncSettingsGearRequestStore.getState()).toEqual({ settingsGearSyncPageRequestCount: 2, syncPlanPickedFromAddress: null })
  })
})
