import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PapelizInMemoryVaultAdapter } from '../vault/papeliz-in-memory-vault-adapter'
import { createPapelizSyncFakeEngine, papelizSyncFakeEnginePassphrase, papelizSyncFakeEngineRecoveryKeyText, readPapelizSyncFakeEngineStoragePlaceForNewAccount } from './papeliz-sync-fake-engine'
import {
  choosePapelizSyncPlan,
  continuePapelizSyncSubscribeToCheckout,
  continuePapelizSyncSubscribeToSignIn,
  followPapelizSyncSnapshotInFlows,
  goBackInPapelizSyncSubscribeFlow,
  putOffPapelizSyncNoteClash,
  readPapelizSyncSetUpDialogModeNeeded,
  resetPapelizSyncFlowsForTests,
  showPapelizSyncNoteClash,
  startPapelizSyncSignInFromClick,
  startPapelizSyncSignInFromClickBeforeEngineLoads,
  usePapelizSyncFlowStore,
  choosePapelizSyncStoragePlace,
} from './papeliz-sync-flow-store'
import { createPapelizSyncLocalVaultFiles } from './papeliz-sync-local-vault-files'
import { mergePapelizSyncNoteText } from './papeliz-sync-note-merge'

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

describe('the subscribe flow', () => {
  it('goes Choose a plan → storage place → sign in in a new tab → checkout in a new tab → set-up', async () => {
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
    expect(usePapelizSyncFlowStore.getState().syncSetUpDialogMode).toBe('set-up')
  })

  it('opens checkout straight from Choose when already signed in', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'not-subscribed' })
    choosePapelizSyncPlan(papelizSyncFakeEngine, papelizSyncFakeEngine.getSyncEngineSnapshot(), { syncPlanName: 'standard', syncBillingPeriod: 'monthly' })
    expect(papelizSyncTestTabs).toHaveLength(1)
    await settleFakeCalls()
    expect(papelizSyncTestTabs[0]?.replacedUrl).toBe('about:blank#papeliz-sync-fake-checkout')
    expect(papelizSyncFakeEngine.fakeEngineCallNames).not.toContain('startSyncSignIn')
  })

  it('says so when the browser blocks the new tab, and opens nothing', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'signed-out' })
    isPapelizSyncTestTabBlocked = true
    choosePapelizSyncPlan(papelizSyncFakeEngine, papelizSyncFakeEngine.getSyncEngineSnapshot(), { syncPlanName: 'pro', syncBillingPeriod: 'yearly' })
    choosePapelizSyncStoragePlace('apac')
    await continuePapelizSyncSubscribeToSignIn(papelizSyncFakeEngine)
    expect(usePapelizSyncFlowStore.getState().syncSubscribeStep?.syncSubscribeStepKind).toBe('storage-place')
    expect(usePapelizSyncFlowStore.getState().syncSubscribeFailureWords).toMatch(/blocked the new tab/)
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

describe('which set-up a device needs', () => {
  it('follows the account and this device’s keys', () => {
    const readModeNeeded = (fakeEngineScenario: Parameters<typeof createPapelizSyncFakeEngine>[0]['fakeEngineScenario']) =>
      readPapelizSyncSetUpDialogModeNeeded(createPapelizSyncFakeEngine({ fakeEngineScenario }).getSyncEngineSnapshot())
    expect(readModeNeeded('signed-out')).toBeNull()
    expect(readModeNeeded('not-subscribed')).toBeNull()
    expect(readModeNeeded('set-up-unfinished')).toBe('set-up')
    expect(readModeNeeded('locked')).toBe('unlock')
    expect(readModeNeeded('on')).toBeNull()
  })
})

describe('the fake engine, as the set-up dialog drives it', () => {
  it('makes keys only after the Recovery Key is confirmed, and refuses a short passphrase', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'set-up-unfinished' })
    expect(await papelizSyncFakeEngine.prepareSyncAccountKeys('too short')).toMatchObject({ syncActionOutcome: 'failed', syncActionFailureKind: 'passphrase-too-short' })
    const keyDraftOutcome = await papelizSyncFakeEngine.prepareSyncAccountKeys('maple river cloud lantern')
    if (keyDraftOutcome.syncActionOutcome !== 'done') throw new Error('The fake refused a good passphrase')
    expect(papelizSyncFakeEngine.getSyncEngineSnapshot().syncAccountKeyState).toBe('not-set-up')
    expect(await papelizSyncFakeEngine.confirmSyncAccountKeys(keyDraftOutcome.syncActionDoneValue.syncAccountKeyDraftId)).toMatchObject({ syncActionOutcome: 'done' })
    expect(papelizSyncFakeEngine.getSyncEngineSnapshot().syncAccountKeyState).toBe('unlocked')
  })

  it('unlocks a second device with the passphrase, or with the Recovery Key in any case', async () => {
    const lockedFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'locked' })
    expect(await lockedFakeEngine.unlockSyncWithPassphrase('not the passphrase')).toMatchObject({ syncActionFailureKind: 'wrong-passphrase' })
    expect(await lockedFakeEngine.unlockSyncWithPassphrase(papelizSyncFakeEnginePassphrase)).toMatchObject({ syncActionOutcome: 'done' })

    const otherLockedFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'locked' })
    const typedRecoveryKeyText = papelizSyncFakeEngineRecoveryKeyText.toLowerCase().replaceAll('-', ' ')
    expect(await otherLockedFakeEngine.unlockSyncWithRecoveryKey(typedRecoveryKeyText, 'a new passphrase here')).toMatchObject({ syncActionOutcome: 'done' })
  })

  it('asks for a fresh sign-in before Start over, then lets it through', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'locked' })
    expect(await papelizSyncFakeEngine.startSyncOver('a brand new passphrase')).toMatchObject({ syncActionFailureKind: 'fresh-sign-in-required' })
    const freshSignIn = startPapelizSyncSignInFromClick(papelizSyncFakeEngine, null)
    papelizSyncFakeEngine.finishFakeSyncSignIn()
    expect(await freshSignIn).toEqual({ syncSignInOutcome: 'signed-in' })
    expect(await papelizSyncFakeEngine.startSyncOver('a brand new passphrase')).toMatchObject({ syncActionOutcome: 'done' })
  })

  it('offers plans only in the test currency', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'signed-out' })
    expect(papelizSyncFakeEngine.fakeEngineCallNames).toEqual([])
    const planOffersOutcome = await papelizSyncFakeEngine.listSyncPlanOffers()
    if (planOffersOutcome.syncActionOutcome !== 'done') throw new Error('The fake refused the plans')
    expect(new Set(planOffersOutcome.syncActionDoneValue.map((syncPlanOffer) => syncPlanOffer.syncDisplayPrice))).toEqual(new Set(['0.00 XTS']))
    expect(planOffersOutcome.syncActionDoneValue).toHaveLength(6)
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

describe('the open vault’s files, as Sync reads them', () => {
  it('rename and trash through the vault’s own adapter, and refuse whole-file reads it can’t do yet', async () => {
    const vaultAdapter = new PapelizInMemoryVaultAdapter([{ vaultNoteRelativePath: 'Plan.md', vaultNoteText: '# Plan\n' }])
    const syncLocalVaultFiles = createPapelizSyncLocalVaultFiles(vaultAdapter)
    await syncLocalVaultFiles.renameVaultFile('Plan.md', 'Plans/Plan.md')
    expect((await vaultAdapter.listVaultTreeEntries()).map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath)).toContain('Plans/Plan.md')
    expect(await syncLocalVaultFiles.moveVaultFileToTrash('Plans/Plan.md')).toMatch(/^\.trash\//)
    await expect(syncLocalVaultFiles.listSyncableVaultFileStats()).rejects.toThrow('Not Supported Yet')
  })
})

describe('signing in from Fetch from Sync, before the engine has loaded', () => {
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

  it('says so when the browser blocks the tab', async () => {
    isPapelizSyncTestTabBlocked = true
    expect(await startPapelizSyncSignInFromClickBeforeEngineLoads(async () => null)).toEqual({ syncSignInOutcome: 'blocked' })
  })
})
