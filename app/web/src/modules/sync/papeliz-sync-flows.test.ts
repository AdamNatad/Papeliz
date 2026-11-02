import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPapelizBrowserVaultWritesLockName } from '../vault/papeliz-browser-vault-locks'
import { createPapelizBrowserVault, openPapelizBrowserVault } from '../vault/papeliz-browser-vaults'
import { createPapelizFakeBrowserVaultEnvironment } from '../vault/papeliz-fake-browser-vault-environment.test-support'
import { PapelizInMemoryVaultAdapter } from '../vault/papeliz-in-memory-vault-adapter'
import { createPapelizSyncFakeEngine, papelizSyncFakeEngineVaultPassphrase, readPapelizSyncFakeEngineStoragePlaceForNewAccount, type PapelizSyncFakeEngine } from './papeliz-sync-fake-engine'
import {
  cancelPapelizSyncSignIn,
  choosePapelizSyncPlan,
  continuePapelizSyncSubscribeToCheckout,
  continuePapelizSyncSubscribeToSignIn,
  describePapelizSyncSignInFromClickFailure,
  followPapelizSyncSnapshotInFlows,
  goBackInPapelizSyncSubscribeFlow,
  putOffPapelizSyncMissingFiles,
  putOffPapelizSyncNoteClash,
  readPapelizSyncSetUpDialogRequestAfterSubscribing,
  resetPapelizSyncFlowsForTests,
  showPapelizSyncMissingFiles,
  showPapelizSyncNoteClash,
  startPapelizSyncSignInFromClick,
  startPapelizSyncSignInFromClickBeforeEngineLoads,
  usePapelizSyncFlowStore,
  choosePapelizSyncStoragePlace,
} from './papeliz-sync-flow-store'
import { createPapelizSyncLocalVaultFiles } from './papeliz-sync-local-vault-files'
import { mergePapelizSyncNoteText } from './papeliz-sync-note-merge'
import { usePapelizSyncEngineStore } from './papeliz-sync-engine-store'
import {
  reportPapelizSyncVaultEntryMovedToTrash,
  reportPapelizSyncVaultEntryRenamed,
  reportPapelizSyncVaultFileSaved,
  reportPapelizSyncVaultFolderCopied,
} from './papeliz-sync-workspace-reports'
import { createPapelizFakeVaultFolder } from '../vault/papeliz-fake-file-system-access.test-support'
import { PapelizFolderOnDiskVaultAdapter } from '../vault/papeliz-folder-on-disk-vault-adapter'
import type { PapelizSyncAccountVaultReading, PapelizSyncActionOutcome } from './papeliz-sync-engine-contract'
import {
  canPapelizSyncVaultPassphraseChange,
  isPapelizSyncVaultCurrentPassphraseAskedForChange,
  isPapelizSyncVaultDeleteConfirmationTyped,
  isPapelizSyncVaultLockedHere,
  readPapelizSyncAccountVaultPlace,
} from './papeliz-sync-synced-vaults-section'
import { readPapelizSyncSyncedVaultsPageStep } from './papeliz-sync-synced-vaults-page'
import { describePapelizSyncPlanCardLine, describePapelizSyncPlanDetailLines } from './papeliz-sync-screen-words'

// The screens' flows, run against the fake engine. The browser's new tabs are stood in for by a
// fake `window.open` that records what each tab was sent to.

interface PapelizSyncTestTab {
  openedUrl: string
  replacedUrl: string | null
  isClosed: boolean
  opener: unknown
}

let papelizSyncTestTabs: PapelizSyncTestTab[] = []
let isPapelizSyncTestTabBlocked = false

beforeEach(() => {
  resetPapelizSyncFlowsForTests()
  papelizSyncTestTabs = []
  isPapelizSyncTestTabBlocked = false
  vi.stubGlobal('window', {
    open: (openedUrl: string) => {
      if (isPapelizSyncTestTabBlocked) return null
      const papelizSyncTestTab: PapelizSyncTestTab = { openedUrl, replacedUrl: null, isClosed: false, opener: 'the app' }
      papelizSyncTestTabs.push(papelizSyncTestTab)
      return {
        set opener(newOpener: unknown) {
          papelizSyncTestTab.opener = newOpener
        },
        location: { replace: (replacedUrl: string) => (papelizSyncTestTab.replacedUrl = replacedUrl) },
        close: () => (papelizSyncTestTab.isClosed = true),
      }
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const settleFakeCalls = () => new Promise((resolveSettled) => setTimeout(resolveSettled, 0))

// A vault opened in the workspace, as the fake engine sees it.
function attachTestVaultToFakeEngine(papelizSyncFakeEngine: PapelizSyncFakeEngine, papelizVaultId: string, papelizVaultDisplayName: string): void {
  papelizSyncFakeEngine.attachSyncToOpenVault({
    papelizVaultId,
    papelizVaultKind: 'browser-vault-in-opfs',
    papelizVaultDisplayName,
    syncLocalVaultFiles: createPapelizSyncLocalVaultFiles(new PapelizInMemoryVaultAdapter([])),
  })
}

function readFakeLocalVault(papelizSyncFakeEngine: PapelizSyncFakeEngine, papelizVaultId: string) {
  return papelizSyncFakeEngine.getSyncEngineSnapshot().syncLocalVaults.find((syncLocalVault) => syncLocalVault.papelizVaultId === papelizVaultId)
}

function expectFakeDone(syncActionOutcome: PapelizSyncActionOutcome): void {
  expect(syncActionOutcome).toEqual({ syncActionOutcome: 'done', syncActionDoneValue: null })
}

describe('the subscribe flow', () => {
  it('goes Choose a plan → storage place → sign in in a new tab → checkout in a new tab → Turn on Sync', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'signed-out' })

    choosePapelizSyncPlan(papelizSyncFakeEngine, papelizSyncFakeEngine.getSyncEngineSnapshot(), { syncPlanName: 'plus', syncBillingPeriod: 'yearly' })
    expect(usePapelizSyncFlowStore.getState().syncSubscribeStep?.syncSubscribeStepKind).toBe('storage-place')
    // Nothing opens, and nothing is asked of the service, before the place is chosen.
    expect(papelizSyncTestTabs).toHaveLength(0)
    expect(papelizSyncFakeEngine.fakeEngineCallNames).not.toContain('startSyncSignIn')

    choosePapelizSyncStoragePlace('eu')
    const signInStep = continuePapelizSyncSubscribeToSignIn(papelizSyncFakeEngine)
    // The sign-in page opens from the click itself, with the place for a new account.
    expect(papelizSyncTestTabs).toHaveLength(1)
    expect(papelizSyncTestTabs[0]).toMatchObject({ openedUrl: 'about:blank#papeliz-sync-fake-sign-in', opener: null })
    expect(readPapelizSyncFakeEngineStoragePlaceForNewAccount(papelizSyncFakeEngine)).toBe('eu')
    expect(usePapelizSyncFlowStore.getState().syncSubscribeStep?.syncSubscribeStepKind).toBe('signing-in')

    papelizSyncFakeEngine.finishFakeSyncSignIn()
    await signInStep
    expect(usePapelizSyncFlowStore.getState().syncSubscribeStep?.syncSubscribeStepKind).toBe('ready-for-checkout')

    continuePapelizSyncSubscribeToCheckout(papelizSyncFakeEngine)
    // The checkout tab opens from this click, then goes to the address once the service made it.
    expect(papelizSyncTestTabs).toHaveLength(2)
    expect(papelizSyncTestTabs[1]).toMatchObject({ openedUrl: 'about:blank', opener: null })
    await settleFakeCalls()
    expect(papelizSyncTestTabs[1]?.replacedUrl).toBe('about:blank#papeliz-sync-fake-checkout')
    expect(usePapelizSyncFlowStore.getState().syncSubscribeStep?.syncSubscribeStepKind).toBe('checking-out')

    papelizSyncFakeEngine.finishFakeSyncCheckout()
    followPapelizSyncSnapshotInFlows(papelizSyncFakeEngine.getSyncEngineSnapshot())
    expect(usePapelizSyncFlowStore.getState().syncSubscribeStep).toBeNull()
    expect(usePapelizSyncFlowStore.getState().syncSetUpDialogRequest).toEqual({ syncSetUpDialogKind: 'turn-on-vault-sync' })
  })

  it('opens checkout straight from Choose when already signed in', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'not-subscribed' })
    choosePapelizSyncPlan(papelizSyncFakeEngine, papelizSyncFakeEngine.getSyncEngineSnapshot(), { syncPlanName: 'standard', syncBillingPeriod: 'monthly' })
    expect(papelizSyncTestTabs).toHaveLength(1)
    await settleFakeCalls()
    expect(papelizSyncTestTabs[0]?.replacedUrl).toBe('about:blank#papeliz-sync-fake-checkout')
    expect(papelizSyncFakeEngine.fakeEngineCallNames).not.toContain('startSyncSignIn')
  })

  it('keeps the sign-in waiting when the browser blocks its tab, with the address to press or copy, and goes on once signed in', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'signed-out' })
    isPapelizSyncTestTabBlocked = true
    choosePapelizSyncPlan(papelizSyncFakeEngine, papelizSyncFakeEngine.getSyncEngineSnapshot(), { syncPlanName: 'pro', syncBillingPeriod: 'yearly' })
    choosePapelizSyncStoragePlace('apac')
    const signInStep = continuePapelizSyncSubscribeToSignIn(papelizSyncFakeEngine)
    expect(papelizSyncTestTabs).toHaveLength(0)
    expect(usePapelizSyncFlowStore.getState()).toMatchObject({
      syncSubscribeStep: { syncSubscribeStepKind: 'signing-in' },
      syncSubscribeFailureWords: null,
      blockedSyncSignInPageUrl: 'about:blank#papeliz-sync-fake-sign-in',
    })
    // The person pressed Sign In (or pasted the copied address) and signed in there.
    papelizSyncFakeEngine.finishFakeSyncSignIn()
    await signInStep
    expect(usePapelizSyncFlowStore.getState().syncSubscribeStep?.syncSubscribeStepKind).toBe('ready-for-checkout')
    expect(usePapelizSyncFlowStore.getState().blockedSyncSignInPageUrl).toBeNull()
  })

  it('goes back from waiting for sign-in to the place, cancelling the sign-in', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'signed-out' })
    choosePapelizSyncPlan(papelizSyncFakeEngine, papelizSyncFakeEngine.getSyncEngineSnapshot(), { syncPlanName: 'plus', syncBillingPeriod: 'yearly' })
    choosePapelizSyncStoragePlace('oc')
    const signInStep = continuePapelizSyncSubscribeToSignIn(papelizSyncFakeEngine)
    goBackInPapelizSyncSubscribeFlow()
    await signInStep
    expect(usePapelizSyncFlowStore.getState().syncSubscribeStep).toMatchObject({ syncSubscribeStepKind: 'storage-place', chosenSyncStoragePlace: 'oc' })
    expect(papelizSyncFakeEngine.getSyncEngineSnapshot().syncSignIn.syncSignInKind).toBe('signed-out')
  })
})

describe('the set-up a subscription opens', () => {
  it('is Turn on Sync for this vault, only while no vault syncs on the account yet', async () => {
    const readSetUpRequest = (papelizSyncFakeEngine: PapelizSyncFakeEngine) => readPapelizSyncSetUpDialogRequestAfterSubscribing(papelizSyncFakeEngine.getSyncEngineSnapshot())
    expect(readSetUpRequest(createPapelizSyncFakeEngine({ fakeEngineScenario: 'signed-out' }))).toBeNull()
    expect(readSetUpRequest(createPapelizSyncFakeEngine({ fakeEngineScenario: 'not-subscribed' }))).toBeNull()
    expect(readSetUpRequest(createPapelizSyncFakeEngine({ fakeEngineScenario: 'nothing-synced-yet' }))).toEqual({ syncSetUpDialogKind: 'turn-on-vault-sync' })
    // A device that syncs a vault already, or a new device whose account has synced vaults to download.
    const syncingFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'on' })
    attachTestVaultToFakeEngine(syncingFakeEngine, 'vault-work', 'Work')
    expect(readSetUpRequest(syncingFakeEngine)).toBeNull()
    expect(readSetUpRequest(createPapelizSyncFakeEngine({ fakeEngineScenario: 'download-stops' }))).toBeNull()
  })
})

describe('the fake engine, as Turn on Sync and the Sync page drive it', () => {
  it('turns Sync on as Standard with no passphrase, or End-to-end with one of 12 characters or more', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'nothing-synced-yet' })
    attachTestVaultToFakeEngine(papelizSyncFakeEngine, 'vault-work', 'Work')
    attachTestVaultToFakeEngine(papelizSyncFakeEngine, 'vault-journal', 'Journal')
    // Opening a vault doesn't sync it in this scenario.
    expect(papelizSyncFakeEngine.getSyncEngineSnapshot().syncLocalVaults).toEqual([])

    expect(await papelizSyncFakeEngine.turnSyncOnForVault('vault-work', { syncVaultEncryptionKind: 'standard' })).toMatchObject({ syncActionOutcome: 'done' })
    expect(readFakeLocalVault(papelizSyncFakeEngine, 'vault-work')).toMatchObject({ syncVaultEncryptionKind: 'standard', syncVaultLockState: 'unlocked' })

    expect(await papelizSyncFakeEngine.turnSyncOnForVault('vault-journal', { syncVaultEncryptionKind: 'end-to-end', syncVaultPassphrase: 'too short' })).toMatchObject({
      syncActionFailureKind: 'passphrase-too-short',
    })
    expect(readFakeLocalVault(papelizSyncFakeEngine, 'vault-journal')).toBeUndefined()
    const journalPassphrase = 'maple river cloud lantern'
    expect(await papelizSyncFakeEngine.turnSyncOnForVault('vault-journal', { syncVaultEncryptionKind: 'end-to-end', syncVaultPassphrase: journalPassphrase })).toMatchObject({
      syncActionOutcome: 'done',
    })
    // The key is made on this device, so it holds it from the start.
    expect(readFakeLocalVault(papelizSyncFakeEngine, 'vault-journal')).toMatchObject({ syncVaultEncryptionKind: 'end-to-end', syncVaultLockState: 'unlocked' })
    expect(papelizSyncFakeEngine.fakeTurnedOnSyncVaultEncryptionChoices).toEqual([
      { papelizVaultId: 'vault-work', syncVaultEncryptionChoice: { syncVaultEncryptionKind: 'standard' } },
      { papelizVaultId: 'vault-journal', syncVaultEncryptionChoice: { syncVaultEncryptionKind: 'end-to-end', syncVaultPassphrase: journalPassphrase } },
    ])
    const listedOutcome = await papelizSyncFakeEngine.listSyncedVaultsOnAccount()
    expect(listedOutcome.syncActionOutcome === 'done' && listedOutcome.syncActionDoneValue.map((accountVault) => [accountVault.syncVaultName, accountVault.syncVaultEncryptionKind])).toEqual([
      ['Work', 'standard'],
      ['Journal', 'end-to-end'],
    ])
  })

  it('unlocks an End-to-end vault that is locked here with its passphrase only, and it syncs again', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'locked' })
    attachTestVaultToFakeEngine(papelizSyncFakeEngine, 'vault-work', 'Work')
    const lockedLocalVault = readFakeLocalVault(papelizSyncFakeEngine, 'vault-work')
    expect(lockedLocalVault).toMatchObject({ syncVaultEncryptionKind: 'end-to-end', syncVaultLockState: 'locked', syncVaultStatus: { syncStatusKind: 'locked' } })
    const papelizSyncVaultId = lockedLocalVault?.papelizSyncVaultId ?? ''
    expect(await papelizSyncFakeEngine.listSyncFileVersions('vault-work', 'Plan.md')).toMatchObject({ syncActionFailureKind: 'locked' })
    // The account's other End-to-end vault has a name of its own, apart from the new device's vaults.
    const listedOutcome = await papelizSyncFakeEngine.listSyncedVaultsOnAccount()
    expect(listedOutcome.syncActionOutcome === 'done' && listedOutcome.syncActionDoneValue.map((accountVault) => [accountVault.syncVaultName, accountVault.syncVaultLockState])).toEqual([
      ['Work', 'locked'],
      ['Travel journal', 'locked'],
    ])

    expect(await papelizSyncFakeEngine.unlockSyncedVaultWithPassphrase(papelizSyncVaultId, 'not the passphrase')).toMatchObject({ syncActionFailureKind: 'wrong-passphrase' })
    expect(readFakeLocalVault(papelizSyncFakeEngine, 'vault-work')?.syncVaultLockState).toBe('locked')
    expect(await papelizSyncFakeEngine.unlockSyncedVaultWithPassphrase(papelizSyncVaultId, papelizSyncFakeEngineVaultPassphrase)).toMatchObject({ syncActionOutcome: 'done' })
    expect(readFakeLocalVault(papelizSyncFakeEngine, 'vault-work')).toMatchObject({ syncVaultLockState: 'unlocked', syncVaultStatus: { syncStatusKind: 'synced' } })
  })

  it('changes an End-to-end vault’s passphrase after a fresh sign-in, and has none to change for a Standard one', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'nothing-synced-yet' })
    attachTestVaultToFakeEngine(papelizSyncFakeEngine, 'vault-journal', 'Journal')
    attachTestVaultToFakeEngine(papelizSyncFakeEngine, 'vault-work', 'Work')
    const journalTurnOnOutcome = await papelizSyncFakeEngine.turnSyncOnForVault('vault-journal', { syncVaultEncryptionKind: 'end-to-end', syncVaultPassphrase: 'maple river cloud lantern' })
    const workTurnOnOutcome = await papelizSyncFakeEngine.turnSyncOnForVault('vault-work', { syncVaultEncryptionKind: 'standard' })
    if (journalTurnOnOutcome.syncActionOutcome !== 'done' || workTurnOnOutcome.syncActionOutcome !== 'done') throw new Error('The fake didn’t turn Sync on')
    const journalSyncVaultId = journalTurnOnOutcome.syncActionDoneValue.papelizSyncVaultId

    // The key is here, so no current passphrase is needed.
    expect(await papelizSyncFakeEngine.changeSyncVaultPassphrase(journalSyncVaultId, 'a newer passphrase here', null)).toMatchObject({ syncActionFailureKind: 'fresh-sign-in-required' })
    const freshSignIn = startPapelizSyncSignInFromClick(papelizSyncFakeEngine, null)
    papelizSyncFakeEngine.finishFakeSyncSignIn()
    expect(await freshSignIn).toEqual({ syncSignInOutcome: 'signed-in' })
    expect(await papelizSyncFakeEngine.changeSyncVaultPassphrase(journalSyncVaultId, 'short', null)).toMatchObject({ syncActionFailureKind: 'passphrase-too-short' })
    expect(await papelizSyncFakeEngine.changeSyncVaultPassphrase(journalSyncVaultId, 'a newer passphrase here', null)).toMatchObject({ syncActionOutcome: 'done' })
    expect(await papelizSyncFakeEngine.changeSyncVaultPassphrase(workTurnOnOutcome.syncActionDoneValue.papelizSyncVaultId, 'a newer passphrase here', null)).toMatchObject({
      syncActionFailureKind: 'not-found',
    })
  })

  it('changes the passphrase of an End-to-end vault not on this device with its current one, and keeps no key here', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'download-stops' })
    const researchSyncVaultId = 'pzvault_dddddddddddddddddddddddddd'
    const freshSignIn = startPapelizSyncSignInFromClick(papelizSyncFakeEngine, null)
    papelizSyncFakeEngine.finishFakeSyncSignIn()
    await freshSignIn
    expect(await papelizSyncFakeEngine.changeSyncVaultPassphrase(researchSyncVaultId, 'a newer passphrase here', null)).toMatchObject({ syncActionFailureKind: 'locked' })
    expect(await papelizSyncFakeEngine.changeSyncVaultPassphrase(researchSyncVaultId, 'a newer passphrase here', 'not the passphrase')).toMatchObject({
      syncActionFailureKind: 'wrong-passphrase',
    })
    expectFakeDone(await papelizSyncFakeEngine.changeSyncVaultPassphrase(researchSyncVaultId, 'a newer passphrase here', papelizSyncFakeEngineVaultPassphrase))
    // Still locked here: the vault isn't on this device, so its key wasn't kept.
    const listedOutcome = await papelizSyncFakeEngine.listSyncedVaultsOnAccount()
    expect(listedOutcome.syncActionOutcome === 'done' && listedOutcome.syncActionDoneValue.find((accountVault) => accountVault.papelizSyncVaultId === researchSyncVaultId)?.syncVaultLockState).toBe('locked')
    // A new device downloading it asks the new passphrase.
    expect(await papelizSyncFakeEngine.unlockSyncedVaultWithPassphrase(researchSyncVaultId, papelizSyncFakeEngineVaultPassphrase)).toMatchObject({ syncActionFailureKind: 'wrong-passphrase' })
    expectFakeDone(await papelizSyncFakeEngine.unlockSyncedVaultWithPassphrase(researchSyncVaultId, 'a newer passphrase here'))
  })

  it('meets a change made on another device first, and takes the passphrase that device set on the next try', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'download-stops' })
    const researchSyncVaultId = 'pzvault_dddddddddddddddddddddddddd'
    const freshSignIn = startPapelizSyncSignInFromClick(papelizSyncFakeEngine, null)
    papelizSyncFakeEngine.finishFakeSyncSignIn()
    await freshSignIn
    papelizSyncFakeEngine.changeFakeSyncVaultPassphraseElsewhere(researchSyncVaultId, 'set on the phone just now')
    expect(await papelizSyncFakeEngine.changeSyncVaultPassphrase(researchSyncVaultId, 'a newer passphrase here', 'set on the phone just now')).toMatchObject({
      syncActionFailureKind: 'changed-elsewhere',
    })
    expect(await papelizSyncFakeEngine.changeSyncVaultPassphrase(researchSyncVaultId, 'a newer passphrase here', papelizSyncFakeEngineVaultPassphrase)).toMatchObject({
      syncActionFailureKind: 'wrong-passphrase',
    })
    expectFakeDone(await papelizSyncFakeEngine.changeSyncVaultPassphrase(researchSyncVaultId, 'a newer passphrase here', 'set on the phone just now'))
  })

  it('asks for a fresh sign-in before Start over, then deletes every synced vault', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'download-stops' })
    expect(await papelizSyncFakeEngine.startSyncOver()).toMatchObject({ syncActionFailureKind: 'fresh-sign-in-required' })
    const freshSignIn = startPapelizSyncSignInFromClick(papelizSyncFakeEngine, null)
    papelizSyncFakeEngine.finishFakeSyncSignIn()
    expect(await freshSignIn).toEqual({ syncSignInOutcome: 'signed-in' })
    expect(await papelizSyncFakeEngine.startSyncOver()).toMatchObject({ syncActionOutcome: 'done' })
    expect(await papelizSyncFakeEngine.listSyncedVaultsOnAccount()).toEqual({ syncActionOutcome: 'done', syncActionDoneValue: [] })
  })

  it('offers plans only in the test currency', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'signed-out' })
    expect(papelizSyncFakeEngine.fakeEngineCallNames).toEqual([])
    const planOffersOutcome = await papelizSyncFakeEngine.listSyncPlanOffers()
    if (planOffersOutcome.syncActionOutcome !== 'done') throw new Error('The fake refused the plans')
    expect(new Set(planOffersOutcome.syncActionDoneValue.map((syncPlanOffer) => syncPlanOffer.syncDisplayPrice))).toEqual(new Set(['0.00 XTS']))
    expect(planOffersOutcome.syncActionDoneValue).toHaveLength(6)
  })

  it('puts each plan’s synced vaults on its card, and its other details in its tooltip, from its own limits', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'signed-out' })
    const planOffersOutcome = await papelizSyncFakeEngine.listSyncPlanOffers()
    if (planOffersOutcome.syncActionOutcome !== 'done') throw new Error('The fake refused the plans')
    const yearlyPlusOffer = planOffersOutcome.syncActionDoneValue.find((syncPlanOffer) => syncPlanOffer.syncPlanName === 'plus' && syncPlanOffer.syncBillingPeriod === 'yearly')
    if (yearlyPlusOffer === undefined) throw new Error('The fake has no yearly Plus')
    expect(describePapelizSyncPlanCardLine(yearlyPlusOffer.syncVisiblePlanLimits)).toBe('20 Vaults · Version History')
    expect(describePapelizSyncPlanDetailLines(yearlyPlusOffer.syncVisiblePlanLimits)).toEqual([
      '100 GB of storage.',
      '20 synced vaults.',
      'Up to 20 devices.',
      'Files up to 1 GB each.',
      'Notes keep 12 months of version history.',
      'Attachments keep 2 weeks of version history.',
    ])
    const freePlanLimits = papelizSyncFakeEngine.readSyncFreePlanLimits()
    expect(describePapelizSyncPlanCardLine(freePlanLimits)).toBe('1 Vault · Version History')
    expect(describePapelizSyncPlanDetailLines(freePlanLimits)).toEqual([
      '10 MB of storage.',
      '1 synced vault.',
      'Up to 2 devices.',
      'Files up to 5 MB each.',
      'Notes keep 7 days of version history.',
      'Attachments keep 7 days of version history.',
    ])
    // Storage is in the tooltip only, never on a card's line.
    for (const syncPlanOffer of planOffersOutcome.syncActionDoneValue) {
      expect(describePapelizSyncPlanCardLine(syncPlanOffer.syncVisiblePlanLimits)).not.toMatch(/\b(KB|MB|GB|TB)\b/)
    }
  })
})

describe('clashes', () => {
  it('put off with Later until Settle on the Sync page', () => {
    showPapelizSyncNoteClash('pzclash-1')
    expect(usePapelizSyncFlowStore.getState().shownSyncNoteClashId).toBe('pzclash-1')
    putOffPapelizSyncNoteClash('pzclash-1')
    expect(usePapelizSyncFlowStore.getState()).toMatchObject({ shownSyncNoteClashId: null, laterSyncNoteClashIds: ['pzclash-1'] })
    showPapelizSyncNoteClash('pzclash-1')
    expect(usePapelizSyncFlowStore.getState()).toMatchObject({ shownSyncNoteClashId: 'pzclash-1', laterSyncNoteClashIds: [] })
  })

  it('close once the engine has settled them', () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'on' })
    const syncNoteClash = papelizSyncFakeEngine.addFakeSyncNoteClash('vault-a', 'Plan.md')
    showPapelizSyncNoteClash(syncNoteClash.papelizSyncClashId)
    followPapelizSyncSnapshotInFlows(papelizSyncFakeEngine.getSyncEngineSnapshot())
    expect(usePapelizSyncFlowStore.getState().shownSyncNoteClashId).toBe(syncNoteClash.papelizSyncClashId)
    void papelizSyncFakeEngine.settleSyncNoteClash(syncNoteClash.papelizSyncClashId, 'settled')
    return settleFakeCalls().then(() => {
      followPapelizSyncSnapshotInFlows(papelizSyncFakeEngine.getSyncEngineSnapshot())
      expect(usePapelizSyncFlowStore.getState().shownSyncNoteClashId).toBeNull()
    })
  })

  it('merge by themselves when the devices changed different lines', () => {
    expect(mergePapelizSyncNoteText('a\nb\nc\n', 'A\nb\nc\n', 'a\nb\nC\n')).toEqual({ syncNoteMergeOutcome: 'merged', mergedNoteText: 'A\nb\nC\n' })
    expect(mergePapelizSyncNoteText('a\nb\nc\n', 'a\nX\nc\n', 'a\nY\nc\n')).toEqual({ syncNoteMergeOutcome: 'clash' })
  })
})

describe('files missing here', () => {
  it('put off with Not now until the status bar or the Sync page opens them again', () => {
    showPapelizSyncMissingFiles('vault-a')
    expect(usePapelizSyncFlowStore.getState().shownMissingSyncFilesVaultId).toBe('vault-a')
    putOffPapelizSyncMissingFiles('vault-a')
    expect(usePapelizSyncFlowStore.getState()).toMatchObject({ shownMissingSyncFilesVaultId: null, laterMissingSyncFilesVaultIds: ['vault-a'] })
    showPapelizSyncMissingFiles('vault-a')
    expect(usePapelizSyncFlowStore.getState()).toMatchObject({ shownMissingSyncFilesVaultId: 'vault-a', laterMissingSyncFilesVaultIds: [] })
  })

  it('read files-missing in the fake scenario until Download them again or They were deleted', async () => {
    for (const missingFilesChoice of ['download-again', 'deleted'] as const) {
      const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'files-missing' })
      attachTestVaultToFakeEngine(papelizSyncFakeEngine, 'vault-a', 'Field Notes')
      expect(readFakeLocalVault(papelizSyncFakeEngine, 'vault-a')?.syncVaultStatus).toEqual({ syncStatusKind: 'files-missing', syncMissingFileCount: 14 })
      expectFakeDone(
        missingFilesChoice === 'download-again'
          ? await papelizSyncFakeEngine.downloadMissingSyncFilesAgain('vault-a')
          : await papelizSyncFakeEngine.confirmMissingSyncFilesDeleted('vault-a'),
      )
      expect(readFakeLocalVault(papelizSyncFakeEngine, 'vault-a')?.syncVaultStatus.syncStatusKind).toBe('synced')
      expect(await papelizSyncFakeEngine.downloadMissingSyncFilesAgain('vault-a')).toMatchObject({ syncActionOutcome: 'failed' })
    }
  })
})

describe('the open vault’s files, as Sync reads them', () => {
  it('rename and trash through the vault’s own adapter, and refuse whole-file reads it can’t do yet', async () => {
    const vaultAdapter = new PapelizInMemoryVaultAdapter([{ vaultNoteRelativePath: 'Plan.md', vaultNoteText: '# Plan\n' }])
    const syncLocalVaultFiles = createPapelizSyncLocalVaultFiles(vaultAdapter)
    await syncLocalVaultFiles.renameVaultFile('Plan.md', 'Plans/Plan.md')
    expect((await vaultAdapter.listVaultTreeEntries()).map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath)).toContain('Plans/Plan.md')
    expect(await syncLocalVaultFiles.moveVaultFileToTrash('Plans/Plan.md')).toMatch(/^\.trash\//)
    await expect(syncLocalVaultFiles.listSyncableVaultFileStats()).rejects.toThrow('Not Supported Yet')
  })

  it('write a browser vault’s file only once its writes lock is free, as a save in another tab does', async () => {
    const { browserVaultEnvironment, fakeLockManager } = createPapelizFakeBrowserVaultEnvironment()
    const browserVaultRecord = await createPapelizBrowserVault('Research notes', browserVaultEnvironment)
    const openVaultResult = await openPapelizBrowserVault(browserVaultRecord, browserVaultEnvironment)
    if (openVaultResult.openVaultOutcome !== 'opened') throw new Error('The test vault didn’t open.')
    const browserVaultAdapter = openVaultResult.papelizOpenVault.papelizVaultAdapter
    const syncLocalVaultFiles = createPapelizSyncLocalVaultFiles(browserVaultAdapter)
    // Another tab's save holds the writes lock until the test lets it go.
    let finishOtherTabSave: () => void = () => undefined
    const otherTabSave = fakeLockManager.request(
      buildPapelizBrowserVaultWritesLockName(browserVaultRecord.papelizVaultId),
      { mode: 'exclusive' },
      () => new Promise<void>((resolveOtherTabSave) => (finishOtherTabSave = resolveOtherTabSave)),
    )
    const syncWrite = syncLocalVaultFiles.writeVaultFileBytes('Sources/Interviews.md', new TextEncoder().encode('# Interviews\n'))
    await new Promise((resolveTurn) => setTimeout(resolveTurn, 10))
    expect((await browserVaultAdapter.listVaultTreeEntries()).map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath)).not.toContain('Sources/Interviews.md')
    finishOtherTabSave()
    await Promise.all([otherTabSave, syncWrite])
    expect(await browserVaultAdapter.readVaultNoteText('Sources/Interviews.md')).toBe('# Interviews\n')
    // The vault's own name file in this browser never reaches Sync.
    expect((await syncLocalVaultFiles.listSyncableVaultFileStats()).map((syncableVaultFileStat) => syncableVaultFileStat.vaultFileRelativePath)).toEqual(['Sources/Interviews.md'])
  })
})

describe('signing in from Synced Vaults, before the engine has loaded', () => {
  it('opens a blank tab from the click, then sends it to the sign-in page', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'new-device' })
    const signInFromClick = startPapelizSyncSignInFromClickBeforeEngineLoads(async () => papelizSyncFakeEngine)
    expect(papelizSyncTestTabs).toHaveLength(1)
    expect(papelizSyncTestTabs[0]?.openedUrl).toBe('about:blank')
    expect(papelizSyncTestTabs[0]?.opener).toBeNull()
    await settleFakeCalls()
    expect(papelizSyncTestTabs[0]?.replacedUrl).toBe('about:blank#papeliz-sync-fake-sign-in')
    papelizSyncFakeEngine.finishFakeSyncSignIn()
    expect(await signInFromClick).toEqual({ syncSignInOutcome: 'signed-in' })
  })

  it('closes the tab when the engine doesn’t load, or this device is signed in already', async () => {
    expect(await startPapelizSyncSignInFromClickBeforeEngineLoads(async () => null)).toMatchObject({ syncSignInOutcome: 'failed' })
    expect(papelizSyncTestTabs[0]?.isClosed).toBe(true)
    const signedInFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'on' })
    expect(await startPapelizSyncSignInFromClickBeforeEngineLoads(async () => signedInFakeEngine)).toEqual({ syncSignInOutcome: 'signed-in' })
    expect(papelizSyncTestTabs[1]?.isClosed).toBe(true)
  })

  it('keeps the sign-in waiting when the browser blocks the tab, with the address to press or copy, once the engine is there', async () => {
    isPapelizSyncTestTabBlocked = true
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'new-device' })
    const signInFromClick = startPapelizSyncSignInFromClickBeforeEngineLoads(async () => papelizSyncFakeEngine)
    await settleFakeCalls()
    expect(papelizSyncTestTabs).toHaveLength(0)
    expect(usePapelizSyncFlowStore.getState().blockedSyncSignInPageUrl).toBe('about:blank#papeliz-sync-fake-sign-in')
    // The page shows that step: Sign In and Copy Sign-In URL to Clipboard in the middle.
    const syncEngineSnapshot = papelizSyncFakeEngine.getSyncEngineSnapshot()
    expect(readPapelizSyncSyncedVaultsPageStep(true, 'in-this-build', syncEngineSnapshot)).toBe('waiting-for-sign-in')
    papelizSyncFakeEngine.finishFakeSyncSignIn()
    expect(await signInFromClick).toEqual({ syncSignInOutcome: 'signed-in' })
    expect(usePapelizSyncFlowStore.getState().blockedSyncSignInPageUrl).toBeNull()
    // With no engine, nothing waits.
    expect(await startPapelizSyncSignInFromClickBeforeEngineLoads(async () => null)).toMatchObject({ syncSignInOutcome: 'failed' })
    expect(usePapelizSyncFlowStore.getState().blockedSyncSignInPageUrl).toBeNull()
  })
})

describe('signing in from Settings › Sync and Settings › Account', () => {
  it('keeps a blocked sign-in waiting with its address, until it is cancelled or a tab opens for a new one', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'signed-out' })
    isPapelizSyncTestTabBlocked = true
    const blockedSignIn = startPapelizSyncSignInFromClick(papelizSyncFakeEngine, null)
    expect(papelizSyncTestTabs).toHaveLength(0)
    expect(usePapelizSyncFlowStore.getState().blockedSyncSignInPageUrl).toBe('about:blank#papeliz-sync-fake-sign-in')
    expect(papelizSyncFakeEngine.getSyncEngineSnapshot().syncSignIn.syncSignInKind).toBe('waiting-for-sign-in-page')
    // A blocked sign-in has nothing to say in words: the link and the copy button stand in for them.
    cancelPapelizSyncSignIn()
    expect(await blockedSignIn).toEqual({ syncSignInOutcome: 'cancelled' })
    expect(describePapelizSyncSignInFromClickFailure(await blockedSignIn)).toBeNull()
    expect(usePapelizSyncFlowStore.getState().blockedSyncSignInPageUrl).toBeNull()

    void startPapelizSyncSignInFromClick(papelizSyncFakeEngine, null)
    expect(usePapelizSyncFlowStore.getState().blockedSyncSignInPageUrl).not.toBeNull()
    isPapelizSyncTestTabBlocked = false
    const openedSignIn = startPapelizSyncSignInFromClick(papelizSyncFakeEngine, null)
    expect(papelizSyncTestTabs).toHaveLength(1)
    expect(usePapelizSyncFlowStore.getState().blockedSyncSignInPageUrl).toBeNull()
    papelizSyncFakeEngine.finishFakeSyncSignIn()
    expect(await openedSignIn).toEqual({ syncSignInOutcome: 'signed-in' })
  })
})

describe('what the workspace reports to Sync', () => {
  afterEach(() => {
    usePapelizSyncEngineStore.setState({ papelizSyncEngine: null })
  })

  it('goes nowhere, and loads nothing, while the engine isn’t loaded', () => {
    usePapelizSyncEngineStore.setState({ papelizSyncEngine: null })
    reportPapelizSyncVaultFileSaved('vault-a', 'Plan.md')
    reportPapelizSyncVaultEntryRenamed('vault-a', 'Plan.md', 'Plans/Plan.md')
    reportPapelizSyncVaultEntryMovedToTrash('vault-a', 'Plans/Plan.md', '.trash/Plan.md')
    reportPapelizSyncVaultFolderCopied('vault-a', new PapelizInMemoryVaultAdapter([]), 'Plans copy')
    expect(usePapelizSyncEngineStore.getState().syncEngineLoadState).toBe('not-loaded')
  })

  it('reaches the engine once it’s loaded, with the paths as given', () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'on' })
    usePapelizSyncEngineStore.setState({ papelizSyncEngine: papelizSyncFakeEngine })
    reportPapelizSyncVaultFileSaved('vault-a', 'Plan.md')
    reportPapelizSyncVaultEntryRenamed('vault-a', 'Plan.md', 'Plans/Plan.md')
    reportPapelizSyncVaultEntryMovedToTrash('vault-a', 'Plans/Plan.md', '.trash/Plan.md')
    expect(papelizSyncFakeEngine.fakeReportedSyncVaultFileSaves).toEqual([{ papelizVaultId: 'vault-a', vaultFileRelativePath: 'Plan.md' }])
    expect(papelizSyncFakeEngine.fakeReportedSyncVaultEntryRenames).toEqual([{ papelizVaultId: 'vault-a', fromVaultEntryRelativePath: 'Plan.md', toVaultEntryRelativePath: 'Plans/Plan.md' }])
    expect(papelizSyncFakeEngine.fakeReportedSyncVaultEntryTrashMoves).toEqual([{ papelizVaultId: 'vault-a', vaultEntryRelativePath: 'Plans/Plan.md', vaultTrashRelativePath: '.trash/Plan.md' }])
  })

  it('names every file Sync carries in a copied folder, and none outside it or in a hidden folder', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'on' })
    usePapelizSyncEngineStore.setState({ papelizSyncEngine: papelizSyncFakeEngine })
    const fakeVaultRootHandle = await createPapelizFakeVaultFolder('Copies', {
      'Plans/Plan.md': '# Plan',
      'Plans copy/Plan.md': '# Plan',
      'Plans copy/chart.png': 'picture',
      'Plans copy/.drafts/Old.md': 'hidden',
      'Inbox.md': '',
    })
    reportPapelizSyncVaultFolderCopied('vault-a', new PapelizFolderOnDiskVaultAdapter(fakeVaultRootHandle.asFileSystemDirectoryHandle()), 'Plans copy')
    await vi.waitFor(() => expect(papelizSyncFakeEngine.fakeReportedSyncVaultFileSaves).toHaveLength(2))
    expect(papelizSyncFakeEngine.fakeReportedSyncVaultFileSaves.map((reportedSave) => reportedSave.vaultFileRelativePath).sort()).toEqual(['Plans copy/Plan.md', 'Plans copy/chart.png'])
  })
})

describe('Remove from Sync on the Sync page', () => {
  const workAccountVault: PapelizSyncAccountVaultReading = {
    papelizSyncVaultId: 'pzvault_eeeeeeeeeeeeeeeeeeeeeeeeee',
    syncVaultName: 'Work',
    syncVaultEncryptionKind: 'standard',
    syncVaultLockState: 'unlocked',
    syncVaultFileCount: 2140,
    syncVaultStoredByteLength: 1.2e9,
    syncVaultCreatedAt: 0,
    papelizVaultIdOnThisDevice: 'vault-work',
  }

  it('says whether each synced vault is this vault, on this device, or elsewhere', () => {
    expect(readPapelizSyncAccountVaultPlace(workAccountVault, 'vault-work')).toBe('this-vault')
    expect(readPapelizSyncAccountVaultPlace(workAccountVault, 'vault-other')).toBe('on-this-device')
    expect(readPapelizSyncAccountVaultPlace(workAccountVault, null)).toBe('on-this-device')
    expect(readPapelizSyncAccountVaultPlace({ ...workAccountVault, papelizVaultIdOnThisDevice: null }, 'vault-work')).toBe('not-on-this-device')
  })

  it('asks for the vault’s name before deleting', () => {
    expect(isPapelizSyncVaultDeleteConfirmationTyped('', workAccountVault)).toBe(false)
    expect(isPapelizSyncVaultDeleteConfirmationTyped('work', workAccountVault)).toBe(false)
    expect(isPapelizSyncVaultDeleteConfirmationTyped(' Work ', workAccountVault)).toBe(true)
  })

  it('offers Change passphrase for every End-to-end vault, asking the current one without the key here, and Unlock only for one here that lost it', () => {
    const endToEndAccountVault: PapelizSyncAccountVaultReading = { ...workAccountVault, syncVaultEncryptionKind: 'end-to-end' }
    const accountOnlyLockedVault: PapelizSyncAccountVaultReading = { ...endToEndAccountVault, syncVaultLockState: 'locked', papelizVaultIdOnThisDevice: null }
    expect(canPapelizSyncVaultPassphraseChange(workAccountVault)).toBe(false)
    expect(canPapelizSyncVaultPassphraseChange(endToEndAccountVault)).toBe(true)
    expect(canPapelizSyncVaultPassphraseChange(accountOnlyLockedVault)).toBe(true)
    expect(isPapelizSyncVaultCurrentPassphraseAskedForChange(endToEndAccountVault)).toBe(false)
    expect(isPapelizSyncVaultCurrentPassphraseAskedForChange(accountOnlyLockedVault)).toBe(true)
    expect(isPapelizSyncVaultCurrentPassphraseAskedForChange({ ...endToEndAccountVault, syncVaultLockState: 'locked' })).toBe(true)
    expect(isPapelizSyncVaultLockedHere(endToEndAccountVault)).toBe(false)
    expect(isPapelizSyncVaultLockedHere({ ...endToEndAccountVault, syncVaultLockState: 'locked' })).toBe(true)
    // Not on this device: its passphrase is asked when it's downloaded, not here.
    expect(isPapelizSyncVaultLockedHere({ ...endToEndAccountVault, syncVaultLockState: 'locked', papelizVaultIdOnThisDevice: null })).toBe(false)
  })

  it('takes the vault off the account and stops this device syncing it, leaving the others', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'on' })
    attachTestVaultToFakeEngine(papelizSyncFakeEngine, 'vault-work', 'Work')
    attachTestVaultToFakeEngine(papelizSyncFakeEngine, 'vault-home', 'Home')
    const listedBeforeOutcome = await papelizSyncFakeEngine.listSyncedVaultsOnAccount()
    if (listedBeforeOutcome.syncActionOutcome !== 'done') throw new Error('The fake didn’t list the vaults')
    const workSyncVaultId = listedBeforeOutcome.syncActionDoneValue.find((accountVault) => accountVault.syncVaultName === 'Work')?.papelizSyncVaultId ?? ''
    expect(await papelizSyncFakeEngine.deleteSyncedVaultFromAccount(workSyncVaultId)).toMatchObject({ syncActionOutcome: 'done' })
    const listedAfterOutcome = await papelizSyncFakeEngine.listSyncedVaultsOnAccount()
    expect(listedAfterOutcome.syncActionOutcome === 'done' && listedAfterOutcome.syncActionDoneValue.map((accountVault) => accountVault.syncVaultName)).toEqual(['Home'])
    expect(papelizSyncFakeEngine.getSyncEngineSnapshot().syncLinkedLocalVaults.map((syncLinkedLocalVault) => syncLinkedLocalVault.papelizVaultId)).toEqual(['vault-home'])
  })

  it('takes a vault no device here syncs off the account list too', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'download-stops' })
    expect(await papelizSyncFakeEngine.deleteSyncedVaultFromAccount('pzvault_ffffffffffffffffffffffffff')).toMatchObject({ syncActionOutcome: 'done' })
    const listedAfterOutcome = await papelizSyncFakeEngine.listSyncedVaultsOnAccount()
    expect(listedAfterOutcome.syncActionOutcome === 'done' && listedAfterOutcome.syncActionDoneValue.map((accountVault) => accountVault.syncVaultName)).toEqual(['Research notes', 'Work'])
  })
})

describe('Synced Vaults, vault by vault', () => {
  it('lists each vault’s kind, and an End-to-end one locked until its passphrase opens it', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'download-stops' })
    const listedOutcome = await papelizSyncFakeEngine.listSyncedVaultsOnAccount()
    expect(
      listedOutcome.syncActionOutcome === 'done' &&
        listedOutcome.syncActionDoneValue.map((accountVault) => [accountVault.syncVaultName, accountVault.syncVaultEncryptionKind, accountVault.syncVaultLockState]),
    ).toEqual([
      ['Research notes', 'end-to-end', 'locked'],
      ['Work', 'standard', 'unlocked'],
      ['Recipes', 'standard', 'unlocked'],
    ])
  })

  it('downloads an End-to-end vault only once its passphrase is in, and a Standard one straight away', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'download-stops' })
    const researchSyncVaultId = 'pzvault_dddddddddddddddddddddddddd'
    attachTestVaultToFakeEngine(papelizSyncFakeEngine, 'vault-research', 'Research notes')
    expect(await papelizSyncFakeEngine.downloadSyncedVaultInto(researchSyncVaultId, 'vault-research')).toMatchObject({ syncActionFailureKind: 'locked' })
    expect(await papelizSyncFakeEngine.unlockSyncedVaultWithPassphrase(researchSyncVaultId, 'not the passphrase')).toMatchObject({ syncActionFailureKind: 'wrong-passphrase' })
    expect(await papelizSyncFakeEngine.unlockSyncedVaultWithPassphrase(researchSyncVaultId, papelizSyncFakeEngineVaultPassphrase)).toMatchObject({ syncActionOutcome: 'done' })
    expect(await papelizSyncFakeEngine.downloadSyncedVaultInto(researchSyncVaultId, 'vault-research')).toMatchObject({ syncActionOutcome: 'done' })
    await vi.waitFor(() => expect(readFakeLocalVault(papelizSyncFakeEngine, 'vault-research')?.syncVaultTransferProgress).toBeNull())
    expect(readFakeLocalVault(papelizSyncFakeEngine, 'vault-research')).toMatchObject({ syncVaultEncryptionKind: 'end-to-end', syncVaultLockState: 'unlocked' })

    attachTestVaultToFakeEngine(papelizSyncFakeEngine, 'vault-work', 'Work')
    expect(await papelizSyncFakeEngine.downloadSyncedVaultInto('pzvault_eeeeeeeeeeeeeeeeeeeeeeeeee', 'vault-work')).toMatchObject({ syncActionOutcome: 'done' })
  })
})

describe('deleting old versions to free storage', () => {
  it("deletes one of a note's old versions, then every old one, never the newest, and storage drops each time", async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'on' })
    attachTestVaultToFakeEngine(papelizSyncFakeEngine, 'vault-a', 'Field Notes')
    const readFakeStorageUsed = () => papelizSyncFakeEngine.getSyncEngineSnapshot().syncAccount?.syncStorageUsedByteLength ?? 0
    const listVersionNumbers = async () => {
      const listedOutcome = await papelizSyncFakeEngine.listSyncFileVersions('vault-a', 'Garden.md')
      return listedOutcome.syncActionOutcome === 'done' ? listedOutcome.syncActionDoneValue.map((fileVersion) => fileVersion.syncFileVersion) : []
    }
    const storageBefore = readFakeStorageUsed()
    expect(await papelizSyncFakeEngine.deleteSyncFileVersion('vault-a', 'Garden.md', 2)).toEqual({
      syncActionOutcome: 'done',
      syncActionDoneValue: { syncOldVersionCount: 1, syncFreedStoredByteLength: 2048 },
    })
    expect(await listVersionNumbers()).toEqual([3, 1])
    expect(readFakeStorageUsed()).toBe(storageBefore - 2048)
    expect(await papelizSyncFakeEngine.deleteSyncFileVersion('vault-a', 'Garden.md', 3)).toMatchObject({ syncActionOutcome: 'failed', syncActionFailureKind: 'not-found' })
    expect(await papelizSyncFakeEngine.deleteSyncFileOldVersions('vault-a', 'Garden.md')).toEqual({
      syncActionOutcome: 'done',
      syncActionDoneValue: { syncOldVersionCount: 1, syncFreedStoredByteLength: 1024 },
    })
    expect(await listVersionNumbers()).toEqual([3])
  })

  it('reads what Free Up Space frees for each age, frees it, and clears the storage-full state', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'over-storage' })
    attachTestVaultToFakeEngine(papelizSyncFakeEngine, 'vault-a', 'Field Notes')
    const syncAccount = papelizSyncFakeEngine.getSyncEngineSnapshot().syncAccount
    const papelizSyncVaultId = readFakeLocalVault(papelizSyncFakeEngine, 'vault-a')?.papelizSyncVaultId ?? ''
    expect(syncAccount?.syncStorageUsedByteLength).toBe(syncAccount?.syncVisiblePlanLimits?.syncStorageByteLimit)
    expect(readFakeLocalVault(papelizSyncFakeEngine, 'vault-a')?.syncVaultStatus).toMatchObject({ syncStatusKind: 'waiting', syncWaitingReason: 'over-storage' })
    const readSpace = async (syncOldVersionsOlderThanDayCount: number | null) => {
      const spaceOutcome = await papelizSyncFakeEngine.readSyncVaultOldVersionSpace(papelizSyncVaultId, syncOldVersionsOlderThanDayCount)
      return spaceOutcome.syncActionOutcome === 'done' ? spaceOutcome.syncActionDoneValue : null
    }
    expect(await readSpace(365)).toEqual({ syncOldVersionCount: 31, syncFreedStoredByteLength: 2.2e6 })
    expect(await readSpace(30)).toEqual({ syncOldVersionCount: 260, syncFreedStoredByteLength: 21.3e6 })
    expect(await papelizSyncFakeEngine.deleteSyncVaultOldVersions(papelizSyncVaultId, 30)).toEqual({
      syncActionOutcome: 'done',
      syncActionDoneValue: { syncOldVersionCount: 260, syncFreedStoredByteLength: 21.3e6 },
    })
    // Storage is under the limit again, so the page no longer says it's full.
    const syncAccountAfter = papelizSyncFakeEngine.getSyncEngineSnapshot().syncAccount
    expect((syncAccountAfter?.syncStorageUsedByteLength ?? 0) < (syncAccountAfter?.syncVisiblePlanLimits?.syncStorageByteLimit ?? 0)).toBe(true)
    expect(readFakeLocalVault(papelizSyncFakeEngine, 'vault-a')?.syncVaultStatus.syncStatusKind).toBe('synced')
    // What is left: nothing older than 30 days, and the newer ones for All.
    expect(await readSpace(90)).toEqual({ syncOldVersionCount: 0, syncFreedStoredByteLength: 0 })
    expect(await readSpace(null)).toEqual({ syncOldVersionCount: 152, syncFreedStoredByteLength: 38.4e6 - 21.3e6 })
  })

  it('needs a signed-in device', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'signed-out' })
    expect(await papelizSyncFakeEngine.readSyncVaultOldVersionSpace('pzvault_dddddddddddddddddddddddddd', null)).toMatchObject({ syncActionFailureKind: 'signed-out' })
  })
})

describe('Synced Vaults on the start page', () => {
  it('lists the vaults of a Free account, which needs no subscription, and asks a plan only of an account with none', () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'on' })
    const syncEngineSnapshot = papelizSyncFakeEngine.getSyncEngineSnapshot()
    const syncAccount = syncEngineSnapshot.syncAccount
    if (syncAccount === null) throw new Error('The on scenario is signed in')
    const readStepFor = (accountChanges: Partial<typeof syncAccount>) =>
      readPapelizSyncSyncedVaultsPageStep(true, 'in-this-build', { ...syncEngineSnapshot, syncAccount: { ...syncAccount, ...accountChanges } })
    expect(readStepFor({ syncPlanName: 'free', syncSubscriptionState: 'not-subscribed' })).toBe('synced-vault-list')
    expect(readStepFor({ syncPlanName: 'standard', syncSubscriptionState: 'active' })).toBe('synced-vault-list')
    expect(readStepFor({ syncPlanName: 'standard', syncSubscriptionState: 'ended-read-only' })).toBe('synced-vault-list')
    expect(readStepFor({ syncPlanName: null, syncSubscriptionState: 'not-subscribed' })).toBe('no-subscription')
    expect(readStepFor({ syncPlanName: 'standard', syncSubscriptionState: 'ended-held' })).toBe('subscription-held')
  })
})
