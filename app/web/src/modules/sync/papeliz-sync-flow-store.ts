import { create } from 'zustand'
import type {
  PapelizSyncBillingPeriod,
  PapelizSyncEngine,
  PapelizSyncEngineSnapshot,
  PapelizSyncPlanName,
  PapelizSyncSignInAttempt,
  PapelizSyncSignInOutcome,
  PapelizSyncStoragePlace,
  PapelizSyncSubscriptionState,
} from './papeliz-sync-engine-contract'
import { openPapelizSyncNewTabFromClick, openPapelizSyncNewTabWhenAddressIsReady, papelizSyncBlockedNewTabWords } from './papeliz-sync-new-tab'
import { describePapelizSyncActionFailure, pickNearestPapelizSyncStoragePlaceForThisDevice } from './papeliz-sync-screen-words'

// Where Papeliz Sync's flows stand, outside any one screen, so closing the Settings gear midway
// loses nothing: the subscribe flow (Choose a plan → storage place → sign in → checkout), the set-up
// dialog and the note clash dialog. Requests for the gear on Sync are in
// papeliz-sync-settings-gear-request-store.ts.

export interface PapelizSyncChosenPlan {
  syncPlanName: PapelizSyncPlanName
  syncBillingPeriod: PapelizSyncBillingPeriod
}

export type PapelizSyncSubscribeStep =
  // Signed out: where the account's synced data goes, picked once, before the account is made.
  | { syncSubscribeStepKind: 'storage-place'; syncChosenPlan: PapelizSyncChosenPlan; chosenSyncStoragePlace: PapelizSyncStoragePlace | null }
  | { syncSubscribeStepKind: 'signing-in'; syncChosenPlan: PapelizSyncChosenPlan; chosenSyncStoragePlace: PapelizSyncStoragePlace | null }
  // Signed in: one more click opens checkout, since a browser opens a tab only from a click.
  | { syncSubscribeStepKind: 'ready-for-checkout'; syncChosenPlan: PapelizSyncChosenPlan }
  | { syncSubscribeStepKind: 'checking-out'; syncChosenPlan: PapelizSyncChosenPlan }

// - `set-up`: the account has no keys yet: passphrase, Recovery Key, vaults, first upload.
// - `unlock`: keys exist; this device needs the passphrase (or the Recovery Key) once.
// - `start-over`: neither is known any more: a new passphrase and Recovery Key, the synced copy goes.
// - `change-passphrase`: a new passphrase on an unlocked device.
export type PapelizSyncSetUpDialogMode = 'set-up' | 'unlock' | 'start-over' | 'change-passphrase'

interface PapelizSyncFlowState {
  syncSubscribeStep: PapelizSyncSubscribeStep | null
  syncSubscribeFailureWords: string | null
  syncSetUpDialogMode: PapelizSyncSetUpDialogMode | null
  // The clash the dialog shows, and the ones put off with Later (until Settle on the Sync page).
  shownSyncNoteClashId: string | null
  laterSyncNoteClashIds: readonly string[]
  isSyncOldVersionsDialogShown: boolean
}

export const usePapelizSyncFlowStore = create<PapelizSyncFlowState>()(() => ({
  syncSubscribeStep: null,
  syncSubscribeFailureWords: null,
  syncSetUpDialogMode: null,
  shownSyncNoteClashId: null,
  laterSyncNoteClashIds: [],
  isSyncOldVersionsDialogShown: false,
}))

const setSyncFlowState = usePapelizSyncFlowStore.setState
const getSyncFlowState = usePapelizSyncFlowStore.getState

export function isPapelizSyncSubscriptionCurrent(syncSubscriptionState: PapelizSyncSubscriptionState | undefined): boolean {
  return syncSubscriptionState === 'active' || syncSubscriptionState === 'ends-at-period-end' || syncSubscriptionState === 'payment-past-due'
}

// The sign-in started from a click, waiting for the other tab. One at a time: a new one replaces it.
let currentSyncSignInAttempt: PapelizSyncSignInAttempt | null = null

export type PapelizSyncSignInFromClickOutcome = PapelizSyncSignInOutcome | { syncSignInOutcome: 'blocked' }

// Opens the sign-in page in a new tab from the click, and waits for it to hand the sign-in back.
export function startPapelizSyncSignInFromClick(
  papelizSyncEngine: PapelizSyncEngine,
  papelizSyncStoragePlaceForNewAccount: PapelizSyncStoragePlace | null,
): Promise<PapelizSyncSignInFromClickOutcome> {
  currentSyncSignInAttempt?.cancelSyncSignIn()
  const syncSignInAttempt = papelizSyncEngine.startSyncSignIn({ papelizSyncStoragePlaceForNewAccount })
  currentSyncSignInAttempt = syncSignInAttempt
  if (!openPapelizSyncNewTabFromClick(syncSignInAttempt.syncSignInPageUrl)) {
    syncSignInAttempt.cancelSyncSignIn()
    currentSyncSignInAttempt = null
    return Promise.resolve({ syncSignInOutcome: 'blocked' })
  }
  return syncSignInAttempt.syncSignInOutcome.finally(() => {
    if (currentSyncSignInAttempt === syncSignInAttempt) currentSyncSignInAttempt = null
  })
}

export function cancelPapelizSyncSignIn(): void {
  currentSyncSignInAttempt?.cancelSyncSignIn()
  currentSyncSignInAttempt = null
}

// The same from a click made before the engine has loaded (Fetch from Sync on the start screen): a
// blank tab opens from the click, then goes to the sign-in page once the engine is there. The tab
// closes again when the engine doesn't load, or finds this device signed in already.
export async function startPapelizSyncSignInFromClickBeforeEngineLoads(
  loadPapelizSyncEngine: () => Promise<PapelizSyncEngine | null>,
): Promise<PapelizSyncSignInFromClickOutcome> {
  const syncSignInTab = window.open('about:blank', '_blank')
  if (syncSignInTab === null) return { syncSignInOutcome: 'blocked' }
  syncSignInTab.opener = null
  const papelizSyncEngine = await loadPapelizSyncEngine()
  if (papelizSyncEngine === null) {
    syncSignInTab.close()
    return { syncSignInOutcome: 'failed', syncSignInFailureMessage: 'Papeliz Sync didn’t load. Check your connection, then try again.' }
  }
  if (papelizSyncEngine.getSyncEngineSnapshot().syncSignIn.syncSignInKind === 'signed-in') {
    syncSignInTab.close()
    return { syncSignInOutcome: 'signed-in' }
  }
  currentSyncSignInAttempt?.cancelSyncSignIn()
  const syncSignInAttempt = papelizSyncEngine.startSyncSignIn({ papelizSyncStoragePlaceForNewAccount: null })
  currentSyncSignInAttempt = syncSignInAttempt
  syncSignInTab.location.replace(syncSignInAttempt.syncSignInPageUrl)
  return syncSignInAttempt.syncSignInOutcome.finally(() => {
    if (currentSyncSignInAttempt === syncSignInAttempt) currentSyncSignInAttempt = null
  })
}

export function describePapelizSyncSignInFromClickFailure(signInFromClickOutcome: PapelizSyncSignInFromClickOutcome): string | null {
  if (signInFromClickOutcome.syncSignInOutcome === 'blocked') return papelizSyncBlockedNewTabWords
  if (signInFromClickOutcome.syncSignInOutcome === 'failed') return `Signing in didn’t finish: ${signInFromClickOutcome.syncSignInFailureMessage}`
  return null
}

// The subscribe flow -----------------------------------------------------------------------------

async function openPapelizSyncCheckoutFromClick(papelizSyncEngine: PapelizSyncEngine, syncChosenPlan: PapelizSyncChosenPlan): Promise<void> {
  setSyncFlowState({ syncSubscribeStep: { syncSubscribeStepKind: 'checking-out', syncChosenPlan }, syncSubscribeFailureWords: null })
  const checkoutTabOutcome = await openPapelizSyncNewTabWhenAddressIsReady(() =>
    papelizSyncEngine.createSyncCheckoutPageUrl(syncChosenPlan.syncPlanName, syncChosenPlan.syncBillingPeriod),
  )
  if (checkoutTabOutcome.syncNewTabOutcome === 'opened') return
  setSyncFlowState({
    syncSubscribeStep: { syncSubscribeStepKind: 'ready-for-checkout', syncChosenPlan },
    syncSubscribeFailureWords:
      checkoutTabOutcome.syncNewTabOutcome === 'blocked'
        ? papelizSyncBlockedNewTabWords
        : describePapelizSyncActionFailure(checkoutTabOutcome.syncNewTabFailedOutcome, Date.now()),
  })
}

// Choose on a plan. Signed in, checkout opens from this click; signed out, the storage place comes
// first, with the place nearest this device ticked.
export function choosePapelizSyncPlan(papelizSyncEngine: PapelizSyncEngine, syncEngineSnapshot: PapelizSyncEngineSnapshot, syncChosenPlan: PapelizSyncChosenPlan): void {
  if (syncEngineSnapshot.syncSignIn.syncSignInKind === 'signed-in') {
    void openPapelizSyncCheckoutFromClick(papelizSyncEngine, syncChosenPlan)
    return
  }
  setSyncFlowState({
    syncSubscribeStep: { syncSubscribeStepKind: 'storage-place', syncChosenPlan, chosenSyncStoragePlace: pickNearestPapelizSyncStoragePlaceForThisDevice() },
    syncSubscribeFailureWords: null,
  })
}

export function choosePapelizSyncStoragePlace(chosenSyncStoragePlace: PapelizSyncStoragePlace): void {
  const syncSubscribeStep = getSyncFlowState().syncSubscribeStep
  if (syncSubscribeStep?.syncSubscribeStepKind !== 'storage-place') return
  setSyncFlowState({ syncSubscribeStep: { ...syncSubscribeStep, chosenSyncStoragePlace } })
}

// Continue on the storage place step: the sign-in page opens from this click, with the place for a
// new account. An account that already exists keeps its own place.
export async function continuePapelizSyncSubscribeToSignIn(papelizSyncEngine: PapelizSyncEngine): Promise<void> {
  const syncSubscribeStep = getSyncFlowState().syncSubscribeStep
  if (syncSubscribeStep?.syncSubscribeStepKind !== 'storage-place' || syncSubscribeStep.chosenSyncStoragePlace === null) return
  const { syncChosenPlan, chosenSyncStoragePlace } = syncSubscribeStep
  setSyncFlowState({ syncSubscribeStep: { syncSubscribeStepKind: 'signing-in', syncChosenPlan, chosenSyncStoragePlace }, syncSubscribeFailureWords: null })
  const signInFromClickOutcome = await startPapelizSyncSignInFromClick(papelizSyncEngine, chosenSyncStoragePlace)
  if (getSyncFlowState().syncSubscribeStep?.syncSubscribeStepKind !== 'signing-in') return
  if (signInFromClickOutcome.syncSignInOutcome !== 'signed-in') {
    setSyncFlowState({
      syncSubscribeStep: { syncSubscribeStepKind: 'storage-place', syncChosenPlan, chosenSyncStoragePlace },
      syncSubscribeFailureWords: describePapelizSyncSignInFromClickFailure(signInFromClickOutcome),
    })
    return
  }
  // A returning subscriber needs no checkout: straight on to unlocking this device.
  const syncEngineSnapshot = papelizSyncEngine.getSyncEngineSnapshot()
  if (isPapelizSyncSubscriptionCurrent(syncEngineSnapshot.syncAccount?.syncSubscriptionState)) {
    finishPapelizSyncSubscribeFlow(syncEngineSnapshot)
    return
  }
  setSyncFlowState({ syncSubscribeStep: { syncSubscribeStepKind: 'ready-for-checkout', syncChosenPlan } })
}

export function continuePapelizSyncSubscribeToCheckout(papelizSyncEngine: PapelizSyncEngine): void {
  const syncSubscribeStep = getSyncFlowState().syncSubscribeStep
  if (syncSubscribeStep?.syncSubscribeStepKind !== 'ready-for-checkout' && syncSubscribeStep?.syncSubscribeStepKind !== 'checking-out') return
  void openPapelizSyncCheckoutFromClick(papelizSyncEngine, syncSubscribeStep.syncChosenPlan)
}

export function goBackInPapelizSyncSubscribeFlow(): void {
  const syncSubscribeStep = getSyncFlowState().syncSubscribeStep
  if (syncSubscribeStep?.syncSubscribeStepKind === 'signing-in') {
    cancelPapelizSyncSignIn()
    setSyncFlowState({ syncSubscribeStep: { ...syncSubscribeStep, syncSubscribeStepKind: 'storage-place' }, syncSubscribeFailureWords: null })
    return
  }
  closePapelizSyncSubscribeFlow()
}

export function closePapelizSyncSubscribeFlow(): void {
  if (getSyncFlowState().syncSubscribeStep?.syncSubscribeStepKind === 'signing-in') cancelPapelizSyncSignIn()
  setSyncFlowState({ syncSubscribeStep: null, syncSubscribeFailureWords: null })
}

// Which set-up the account needs on this device now, if any.
export function readPapelizSyncSetUpDialogModeNeeded(syncEngineSnapshot: PapelizSyncEngineSnapshot): PapelizSyncSetUpDialogMode | null {
  if (syncEngineSnapshot.syncSignIn.syncSignInKind !== 'signed-in') return null
  if (!isPapelizSyncSubscriptionCurrent(syncEngineSnapshot.syncAccount?.syncSubscriptionState)) return null
  if (syncEngineSnapshot.syncAccountKeyState === 'not-set-up') return 'set-up'
  if (syncEngineSnapshot.syncAccountKeyState === 'locked') return 'unlock'
  return null
}

function finishPapelizSyncSubscribeFlow(syncEngineSnapshot: PapelizSyncEngineSnapshot): void {
  setSyncFlowState({ syncSubscribeStep: null, syncSubscribeFailureWords: null, syncSetUpDialogMode: readPapelizSyncSetUpDialogModeNeeded(syncEngineSnapshot) })
}

// Each new snapshot moves the flow on: checkout done (the subscription is current) closes the
// subscribe dialog and opens set-up.
export function followPapelizSyncSnapshotInFlows(syncEngineSnapshot: PapelizSyncEngineSnapshot): void {
  const syncSubscribeStep = getSyncFlowState().syncSubscribeStep
  if (syncSubscribeStep?.syncSubscribeStepKind === 'checking-out' && isPapelizSyncSubscriptionCurrent(syncEngineSnapshot.syncAccount?.syncSubscriptionState)) {
    finishPapelizSyncSubscribeFlow(syncEngineSnapshot)
  }
  const shownSyncNoteClashId = getSyncFlowState().shownSyncNoteClashId
  if (shownSyncNoteClashId !== null && !syncEngineSnapshot.syncNoteClashesToSettle.some((syncNoteClash) => syncNoteClash.papelizSyncClashId === shownSyncNoteClashId)) {
    setSyncFlowState({ shownSyncNoteClashId: null })
  }
}

export function openPapelizSyncSetUpDialog(syncSetUpDialogMode: PapelizSyncSetUpDialogMode): void {
  setSyncFlowState({ syncSetUpDialogMode })
}

export function closePapelizSyncSetUpDialog(): void {
  setSyncFlowState({ syncSetUpDialogMode: null })
}

// Clashes: the dialog opens by itself for each new one; Later puts it off until Settle.
export function showPapelizSyncNoteClash(papelizSyncClashId: string): void {
  setSyncFlowState((syncFlowState) => ({
    shownSyncNoteClashId: papelizSyncClashId,
    laterSyncNoteClashIds: syncFlowState.laterSyncNoteClashIds.filter((laterSyncNoteClashId) => laterSyncNoteClashId !== papelizSyncClashId),
  }))
}

export function putOffPapelizSyncNoteClash(papelizSyncClashId: string): void {
  setSyncFlowState((syncFlowState) => ({
    shownSyncNoteClashId: null,
    laterSyncNoteClashIds: syncFlowState.laterSyncNoteClashIds.includes(papelizSyncClashId) ? syncFlowState.laterSyncNoteClashIds : [...syncFlowState.laterSyncNoteClashIds, papelizSyncClashId],
  }))
}

export function setPapelizSyncOldVersionsDialogShown(isSyncOldVersionsDialogShown: boolean): void {
  setSyncFlowState({ isSyncOldVersionsDialogShown })
}

// Tests start each case from nothing.
export function resetPapelizSyncFlowsForTests(): void {
  cancelPapelizSyncSignIn()
  setSyncFlowState({
    syncSubscribeStep: null,
    syncSubscribeFailureWords: null,
    syncSetUpDialogMode: null,
    shownSyncNoteClashId: null,
    laterSyncNoteClashIds: [],
    isSyncOldVersionsDialogShown: false,
  })
}
