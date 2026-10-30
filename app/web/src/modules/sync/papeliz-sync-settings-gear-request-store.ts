import { create } from 'zustand'
import { papelizSyncPlanNames, type PapelizSyncBillingPeriod, type PapelizSyncPlanName } from './papeliz-sync-engine-contract'

// Asks for the Settings gear on its Sync page: the status bar's Sync state when clicked, and a plan
// picked on the website's pricing page, which arrives in the address:
//
//   /app/?papeliz-sync-plan=plus&papeliz-sync-billing-period=yearly
//
// The address is read once, the two values are taken out of it, and nothing is sent anywhere.
// Unknown values are left out. The gear button follows these requests; this file stays small
// because the start page loads it.

export const papelizSyncPlanAddressParameterName = 'papeliz-sync-plan'
export const papelizSyncBillingPeriodAddressParameterName = 'papeliz-sync-billing-period'

const papelizSyncBillingPeriodsInAddress: readonly PapelizSyncBillingPeriod[] = ['monthly', 'yearly']

// What the address picked; either may be missing. The Sync page draws the plan picked and opens its
// plans on the billing period.
export interface PapelizSyncPlanPick {
  pickedSyncPlanName: PapelizSyncPlanName | null
  pickedSyncBillingPeriod: PapelizSyncBillingPeriod | null
}

interface PapelizSyncSettingsGearRequestState {
  // Goes up each time something asks for the gear on Sync; the gear on screen opens on Sync then.
  settingsGearSyncPageRequestCount: number
  syncPlanPickedFromAddress: PapelizSyncPlanPick | null
}

export const usePapelizSyncSettingsGearRequestStore = create<PapelizSyncSettingsGearRequestState>()(() => ({
  settingsGearSyncPageRequestCount: 0,
  syncPlanPickedFromAddress: null,
}))

export function requestPapelizSettingsGearSyncPage(): void {
  usePapelizSyncSettingsGearRequestStore.setState((requestState) => ({ settingsGearSyncPageRequestCount: requestState.settingsGearSyncPageRequestCount + 1 }))
}

function isPapelizSyncPlanName(addressValue: string | null): addressValue is PapelizSyncPlanName {
  return papelizSyncPlanNames.some((syncPlanName) => syncPlanName === addressValue)
}

function isPapelizSyncBillingPeriod(addressValue: string | null): addressValue is PapelizSyncBillingPeriod {
  return papelizSyncBillingPeriodsInAddress.some((syncBillingPeriod) => syncBillingPeriod === addressValue)
}

// The pick in an address's search part, or null when neither value is one Papeliz knows.
export function readPapelizSyncPlanPickFromAddressSearch(addressSearch: string): PapelizSyncPlanPick | null {
  const addressSearchParameters = new URLSearchParams(addressSearch)
  const syncPlanNameInAddress = addressSearchParameters.get(papelizSyncPlanAddressParameterName)
  const syncBillingPeriodInAddress = addressSearchParameters.get(papelizSyncBillingPeriodAddressParameterName)
  const pickedSyncPlanName = isPapelizSyncPlanName(syncPlanNameInAddress) ? syncPlanNameInAddress : null
  const pickedSyncBillingPeriod = isPapelizSyncBillingPeriod(syncBillingPeriodInAddress) ? syncBillingPeriodInAddress : null
  if (pickedSyncPlanName === null && pickedSyncBillingPeriod === null) return null
  return { pickedSyncPlanName, pickedSyncBillingPeriod }
}

// Takes a pick out of this tab's address, keeping everything else in it, and asks for the gear on
// Sync. Once taken it's gone from the address, so a later call finds nothing.
export function takePapelizSyncPlanPickFromAddress(): void {
  const addressSearchParameters = new URLSearchParams(window.location.search)
  if (!addressSearchParameters.has(papelizSyncPlanAddressParameterName) && !addressSearchParameters.has(papelizSyncBillingPeriodAddressParameterName)) return
  const syncPlanPick = readPapelizSyncPlanPickFromAddressSearch(window.location.search)
  addressSearchParameters.delete(papelizSyncPlanAddressParameterName)
  addressSearchParameters.delete(papelizSyncBillingPeriodAddressParameterName)
  const remainingAddressSearch = addressSearchParameters.toString()
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${remainingAddressSearch === '' ? '' : `?${remainingAddressSearch}`}${window.location.hash}`)
  if (syncPlanPick === null) return
  usePapelizSyncSettingsGearRequestStore.setState({ syncPlanPickedFromAddress: syncPlanPick })
  requestPapelizSettingsGearSyncPage()
}

// Tests start each case from nothing.
export function resetPapelizSyncSettingsGearRequestsForTests(): void {
  usePapelizSyncSettingsGearRequestStore.setState({ settingsGearSyncPageRequestCount: 0, syncPlanPickedFromAddress: null })
}
