import { create } from 'zustand'
import type {
  PapelizSyncAccountReading,
  PapelizSyncBillingPeriod,
  PapelizSyncEngine,
  PapelizSyncEngineSnapshot,
  PapelizSyncPaidPlanName,
  PapelizSyncSignInAttempt,
  PapelizSyncSignInOutcome,
  PapelizSyncStoragePlace,
  PapelizSyncSubscriptionState,
  PapelizSyncVaultEncryptionKind,
} from './papeliz-sync-engine-contract'
import { openPapelizSyncNewTabFromClick, openPapelizSyncNewTabWhenAddressIsReady, papelizSyncBlockedNewTabWords } from './papeliz-sync-new-tab'
import { describePapelizSyncActionFailure, pickNearestPapelizSyncStoragePlaceForThisDevice } from './papeliz-sync-screen-words'

// Where Papeliz Sync's flows stand, outside any one screen, so closing the Settings gear midway
// loses nothing: the subscribe flow (Choose a plan → storage place → sign in → checkout), a sign-in
// whose tab the browser blocked, the set-up dialog and the note clash dialog. Requests for the gear on Sync are in
// papeliz-sync-settings-gear-request-store.ts.

export interface PapelizSyncChosenPlan {
  syncPlanName: PapelizSyncPaidPlanName
  syncBillingPeriod: PapelizSyncBillingPeriod
}

export type PapelizSyncSubscribeStep =
  // Signed out: where the account's synced data goes, picked once, before the account is made.
  | { syncSubscribeStepKind: 'storage-place'; syncChosenPlan: PapelizSyncChosenPlan; chosenSyncStoragePlace: PapelizSyncStoragePlace | null }
  | { syncSubscribeStepKind: 'signing-in'; syncChosenPlan: PapelizSyncChosenPlan; chosenSyncStoragePlace: PapelizSyncStoragePlace | null }
  // Signed in: one more click opens checkout, since a browser opens a tab only from a click.
  | { syncSubscribeStepKind: 'ready-for-checkout'; syncChosenPlan: PapelizSyncChosenPlan }
  | { syncSubscribeStepKind: 'checking-out'; syncChosenPlan: PapelizSyncChosenPlan }

// What the set-up dialog is for:
// - `turn-on-vault-sync`: Turn on Sync for the open vault: Standard or End-to-end, a passphrase for
//   End-to-end, then the first upload.
// - `change-vault-passphrase`: a new passphrase for any End-to-end vault on the account, and its
//   current one too when this device doesn't hold its key.
// - `change-vault-encryption`: the open vault's other kind, by deleting its synced copy and turning
//   Sync on again (papeliz-sync-change-encryption-dialog.tsx).
export type PapelizSyncSetUpDialogRequest =
  | { syncSetUpDialogKind: 'turn-on-vault-sync' }
  | { syncSetUpDialogKind: 'change-vault-passphrase'; papelizSyncVaultId: string; syncVaultName: string; isCurrentSyncVaultPassphraseAsked: boolean }
  | {
      syncSetUpDialogKind: 'change-vault-encryption'
      papelizVaultId: string
      papelizSyncVaultId: string
      syncVaultName: string
      currentSyncVaultEncryptionKind: PapelizSyncVaultEncryptionKind
    }

interface PapelizSyncFlowState {
  syncSubscribeStep: PapelizSyncSubscribeStep | null
  syncSubscribeFailureWords: string | null
  // A sign-in whose new tab the browser blocked: the sign-in page's address, for a Sign In link the person
  // presses themselves (browsers don't block those) and Copy Sign-In URL to Clipboard. The sign-in waits on it
  // as on a tab that opened. Null while no sign-in is blocked.
  blockedSyncSignInPageUrl: string | null
  syncSetUpDialogRequest: PapelizSyncSetUpDialogRequest | null
  // The clash the dialog shows, and the ones put off with Later (until Settle on the Sync page).
  shownSyncNoteClashId: string | null
  laterSyncNoteClashIds: readonly string[]
  isSyncOldVersionsDialogShown: boolean
  // The open vault whose missing-files dialog shows, and the vaults put off with Not now (until the
  // status bar or the Sync page opens it again).
  shownMissingSyncFilesVaultId: string | null
  laterMissingSyncFilesVaultIds: readonly string[]
}

export const usePapelizSyncFlowStore = create<PapelizSyncFlowState>()(() => ({
  syncSubscribeStep: null,
  syncSubscribeFailureWords: null,
  blockedSyncSignInPageUrl: null,
  syncSetUpDialogRequest: null,
  shownSyncNoteClashId: null,
  laterSyncNoteClashIds: [],
  isSyncOldVersionsDialogShown: false,
  shownMissingSyncFilesVaultId: null,
  laterMissingSyncFilesVaultIds: [],
}))

const setSyncFlowState = usePapelizSyncFlowStore.setState
const getSyncFlowState = usePapelizSyncFlowStore.getState

export function isPapelizSyncSubscriptionCurrent(syncSubscriptionState: PapelizSyncSubscriptionState | undefined): boolean {
  return syncSubscriptionState === 'active' || syncSubscriptionState === 'ends-at-period-end' || syncSubscriptionState === 'payment-past-due'
}

// An account that syncs now: on a paid plan whose subscription is current, or on Free, which every
// account gets at sign-in and needs no subscription. Checkout still asks only about the subscription.
export function canPapelizSyncAccountSync(syncAccount: Pick<PapelizSyncAccountReading, 'syncPlanName' | 'syncSubscriptionState'>): boolean {
  return isPapelizSyncSubscriptionCurrent(syncAccount.syncSubscriptionState) || (syncAccount.syncPlanName === 'free' && syncAccount.syncSubscriptionState === 'not-subscribed')
}

// The sign-in started from a click, waiting for the other tab. One at a time: a new one replaces it.
let currentSyncSignInAttempt: PapelizSyncSignInAttempt | null = null

export type PapelizSyncSignInFromClickOutcome = PapelizSyncSignInOutcome

// Waits for the attempt to hand the sign-in back. When the browser blocked its tab, the sign-in page's
// address waits in the store for the person to open it themselves; it goes once the attempt ends.
function followPapelizSyncSignInAttempt(syncSignInAttempt: PapelizSyncSignInAttempt, isSyncSignInTabBlocked: boolean): Promise<PapelizSyncSignInFromClickOutcome> {
  currentSyncSignInAttempt = syncSignInAttempt
  setSyncFlowState({ blockedSyncSignInPageUrl: isSyncSignInTabBlocked ? syncSignInAttempt.syncSignInPageUrl : null })
  return syncSignInAttempt.syncSignInOutcome.finally(() => {
    if (currentSyncSignInAttempt !== syncSignInAttempt) return
    currentSyncSignInAttempt = null
    setSyncFlowState({ blockedSyncSignInPageUrl: null })
  })
}

// Opens the sign-in page in a new tab from the click, and waits for it to hand the sign-in back. A
// blocked tab leaves the sign-in waiting, with its address for a link (blockedSyncSignInPageUrl).
export function startPapelizSyncSignInFromClick(
  papelizSyncEngine: PapelizSyncEngine,
  papelizSyncStoragePlaceForNewAccount: PapelizSyncStoragePlace | null,
): Promise<PapelizSyncSignInFromClickOutcome> {
  currentSyncSignInAttempt?.cancelSyncSignIn()
  const syncSignInAttempt = papelizSyncEngine.startSyncSignIn({ papelizSyncStoragePlaceForNewAccount })
  return followPapelizSyncSignInAttempt(syncSignInAttempt, !openPapelizSyncNewTabFromClick(syncSignInAttempt.syncSignInPageUrl))
}

export function cancelPapelizSyncSignIn(): void {
  currentSyncSignInAttempt?.cancelSyncSignIn()
  currentSyncSignInAttempt = null
  setSyncFlowState({ blockedSyncSignInPageUrl: null })
}

// The same from a click made before the engine has loaded (Synced Vaults on the start screen): a
// blank tab opens from the click, then goes to the sign-in page once the engine is there. The tab
// closes again when the engine doesn't load, or finds this device signed in already. A blocked blank
// tab leaves the sign-in waiting on its address, as above, once the engine is there.
export async function startPapelizSyncSignInFromClickBeforeEngineLoads(
  loadPapelizSyncEngine: () => Promise<PapelizSyncEngine | null>,
): Promise<PapelizSyncSignInFromClickOutcome> {
  const syncSignInTab = window.open('about:blank', '_blank')
  if (syncSignInTab !== null) syncSignInTab.opener = null
  const papelizSyncEngine = await loadPapelizSyncEngine()
  if (papelizSyncEngine === null) {
    syncSignInTab?.close()
    return { syncSignInOutcome: 'failed', syncSignInFailureMessage: 'Papeliz Sync didn’t load. Check your connection, then try again.' }
  }
  if (papelizSyncEngine.getSyncEngineSnapshot().syncSignIn.syncSignInKind === 'signed-in') {
    syncSignInTab?.close()
    return { syncSignInOutcome: 'signed-in' }
  }
  currentSyncSignInAttempt?.cancelSyncSignIn()
  const syncSignInAttempt = papelizSyncEngine.startSyncSignIn({ papelizSyncStoragePlaceForNewAccount: null })
  syncSignInTab?.location.replace(syncSignInAttempt.syncSignInPageUrl)
  return followPapelizSyncSignInAttempt(syncSignInAttempt, syncSignInTab === null)
}

export function describePapelizSyncSignInFromClickFailure(signInFromClickOutcome: PapelizSyncSignInFromClickOutcome): string | null {
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
  // A returning subscriber needs no checkout: straight on to turning Sync on, if nothing syncs here yet.
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

// What set-up to show once a subscription starts here: Turn on Sync for this vault, while no vault on
// this device syncs yet. A device that already syncs, or a new device with synced vaults to download,
// goes on from the Sync page or Synced Vaults instead.
export function readPapelizSyncSetUpDialogRequestAfterSubscribing(syncEngineSnapshot: PapelizSyncEngineSnapshot): PapelizSyncSetUpDialogRequest | null {
  if (syncEngineSnapshot.syncSignIn.syncSignInKind !== 'signed-in') return null
  if (!isPapelizSyncSubscriptionCurrent(syncEngineSnapshot.syncAccount?.syncSubscriptionState)) return null
  if (syncEngineSnapshot.syncLinkedLocalVaults.length > 0 || (syncEngineSnapshot.syncAccount?.syncedVaultCount ?? 0) > 0) return null
  return { syncSetUpDialogKind: 'turn-on-vault-sync' }
}

function finishPapelizSyncSubscribeFlow(syncEngineSnapshot: PapelizSyncEngineSnapshot): void {
  setSyncFlowState({ syncSubscribeStep: null, syncSubscribeFailureWords: null, syncSetUpDialogRequest: readPapelizSyncSetUpDialogRequestAfterSubscribing(syncEngineSnapshot) })
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

export function openPapelizSyncSetUpDialog(syncSetUpDialogRequest: PapelizSyncSetUpDialogRequest): void {
  setSyncFlowState({ syncSetUpDialogRequest })
}

export function closePapelizSyncSetUpDialog(): void {
  setSyncFlowState({ syncSetUpDialogRequest: null })
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

// Files missing here: the dialog opens by itself once for the open vault. Not now, or a choice, puts it
// off until the status bar or the Sync page opens it again.
export function showPapelizSyncMissingFiles(papelizVaultId: string): void {
  setSyncFlowState((syncFlowState) => ({
    shownMissingSyncFilesVaultId: papelizVaultId,
    laterMissingSyncFilesVaultIds: syncFlowState.laterMissingSyncFilesVaultIds.filter((laterVaultId) => laterVaultId !== papelizVaultId),
  }))
}

export function putOffPapelizSyncMissingFiles(papelizVaultId: string): void {
  setSyncFlowState((syncFlowState) => ({
    shownMissingSyncFilesVaultId: null,
    laterMissingSyncFilesVaultIds: syncFlowState.laterMissingSyncFilesVaultIds.includes(papelizVaultId)
      ? syncFlowState.laterMissingSyncFilesVaultIds
      : [...syncFlowState.laterMissingSyncFilesVaultIds, papelizVaultId],
  }))
}

// Tests start each case from nothing.
export function resetPapelizSyncFlowsForTests(): void {
  cancelPapelizSyncSignIn()
  setSyncFlowState({
    syncSubscribeStep: null,
    syncSubscribeFailureWords: null,
    blockedSyncSignInPageUrl: null,
    syncSetUpDialogRequest: null,
    shownSyncNoteClashId: null,
    laterSyncNoteClashIds: [],
    isSyncOldVersionsDialogShown: false,
    shownMissingSyncFilesVaultId: null,
    laterMissingSyncFilesVaultIds: [],
  })
}
