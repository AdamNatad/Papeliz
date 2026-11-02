import { afterEach, describe, expect, it, vi } from 'vitest'
import { papelizSyncStoragePlaces, type PapelizSyncStoragePlace } from './papeliz-account-sync-hand-over'
import {
  papelizAccountLocalFakeSyncService,
  papelizAccountSyncAccountFromSignInPagePath,
  papelizAccountSyncBillingFromSignInPagePath,
  selectPapelizAccountSyncService,
} from './papeliz-account-sync-service'

// The account's Sync account made at sign-up, in the storage place chosen on the "Choose a username"
// card, where the place is asked once: the place goes to the Account Worker exactly as chosen, an
// account that has one keeps its own, and the stand-in does the same. Then the billing period the
// account page reads, to show the plan as it is.

function createPapelizAccountTestSignInToken(signInSubject: string): string {
  const signInTokenPayload = Buffer.from(JSON.stringify({ sub: signInSubject })).toString('base64url')
  return `test-header.${signInTokenPayload}.test-signature`
}

function stubPapelizAccountTestBrowserStorage(): Map<string, string> {
  const testBrowserStorage = new Map<string, string>()
  vi.stubGlobal('window', {
    location: { origin: 'http://127.0.0.1:14203' },
    localStorage: {
      getItem: (storageKey: string) => testBrowserStorage.get(storageKey) ?? null,
      setItem: (storageKey: string, storageValue: string) => void testBrowserStorage.set(storageKey, storageValue),
      removeItem: (storageKey: string) => void testBrowserStorage.delete(storageKey),
    },
  })
  return testBrowserStorage
}

function readPapelizAccountTestFakeAccountId(testBrowserStorage: Map<string, string>, signInSubject: string): string | undefined {
  const localFakeSyncAccounts = JSON.parse(testBrowserStorage.get('papelizAccountLocalFakeSyncAccounts') ?? '{}') as Record<string, { papelizSyncAccountId: string }>
  return localFakeSyncAccounts[signInSubject]?.papelizSyncAccountId
}

// The Account Worker's answer to every request, and the requests it got.
function stubPapelizAccountTestAccountWorker(replyStatus: number, replyBody: unknown): { requestPath: string; requestInit: RequestInit }[] {
  const accountWorkerRequests: { requestPath: string; requestInit: RequestInit }[] = []
  vi.stubGlobal('fetch', async (requestPath: string, requestInit: RequestInit) => {
    accountWorkerRequests.push({ requestPath, requestInit })
    return new Response(replyBody === undefined ? '' : JSON.stringify(replyBody), { status: replyStatus })
  })
  return accountWorkerRequests
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the Sync account made at sign-up', () => {
  it.each(papelizSyncStoragePlaces)('sends %s to the Account Worker exactly as chosen', async (chosenPapelizSyncStoragePlace: PapelizSyncStoragePlace) => {
    const accountWorkerRequests = stubPapelizAccountTestAccountWorker(200, { papelizSyncStoragePlace: chosenPapelizSyncStoragePlace, isNewPapelizSyncAccount: true })
    const syncAccountCreationOutcome = await selectPapelizAccountSyncService(true).createPapelizSyncAccount('test-token', chosenPapelizSyncStoragePlace)
    expect(syncAccountCreationOutcome).toEqual({ syncAccountCreationOutcomeKind: 'created', papelizSyncStoragePlace: chosenPapelizSyncStoragePlace })
    expect(accountWorkerRequests).toHaveLength(1)
    expect(accountWorkerRequests[0]?.requestPath).toBe(papelizAccountSyncAccountFromSignInPagePath)
    expect(accountWorkerRequests[0]?.requestInit.method).toBe('POST')
    expect(new Headers(accountWorkerRequests[0]?.requestInit.headers).get('Authorization')).toBe('Bearer test-token')
    expect(JSON.parse(String(accountWorkerRequests[0]?.requestInit.body))).toEqual({ papelizSyncStoragePlaceForNewAccount: chosenPapelizSyncStoragePlace })
  })

  it('reports the place an account already has, not the one sent', async () => {
    stubPapelizAccountTestAccountWorker(200, { papelizSyncStoragePlace: 'enam', isNewPapelizSyncAccount: false })
    expect(await selectPapelizAccountSyncService(true).createPapelizSyncAccount('test-token', 'eu')).toEqual({
      syncAccountCreationOutcomeKind: 'created',
      papelizSyncStoragePlace: 'enam',
    })
  })

  it('passes on a refusal, and an answer without a known place, as refused', async () => {
    stubPapelizAccountTestAccountWorker(403, { syncErrorCode: 'origin-not-allowed', syncErrorMessage: 'Sign-ins are accepted only from Papeliz' })
    expect(await selectPapelizAccountSyncService(true).createPapelizSyncAccount('test-token', 'eu')).toEqual({
      syncAccountCreationOutcomeKind: 'refused',
      syncAccountCreationRefusalMessage: 'Sign-ins are accepted only from Papeliz',
    })
    stubPapelizAccountTestAccountWorker(200, { papelizSyncStoragePlace: 'mars', isNewPapelizSyncAccount: true })
    expect((await selectPapelizAccountSyncService(true).createPapelizSyncAccount('test-token', 'eu')).syncAccountCreationOutcomeKind).toBe('refused')
  })

  it.each(papelizSyncStoragePlaces)('makes the stand-in account in %s with no device, and keeps it on a second call', async (chosenPapelizSyncStoragePlace: PapelizSyncStoragePlace) => {
    const testBrowserStorage = stubPapelizAccountTestBrowserStorage()
    const signInToken = createPapelizAccountTestSignInToken(`user_test_${chosenPapelizSyncStoragePlace}`)
    expect(await papelizAccountLocalFakeSyncService.createPapelizSyncAccount(signInToken, chosenPapelizSyncStoragePlace)).toEqual({
      syncAccountCreationOutcomeKind: 'created',
      papelizSyncStoragePlace: chosenPapelizSyncStoragePlace,
    })
    const papelizSyncAccountId = readPapelizAccountTestFakeAccountId(testBrowserStorage, `user_test_${chosenPapelizSyncStoragePlace}`)
    expect(papelizSyncAccountId).toMatch(new RegExp(`^pzacct_${chosenPapelizSyncStoragePlace}_`))
    const otherPapelizSyncStoragePlace = chosenPapelizSyncStoragePlace === 'oc' ? 'eu' : 'oc'
    expect(await papelizAccountLocalFakeSyncService.createPapelizSyncAccount(signInToken, otherPapelizSyncStoragePlace)).toEqual({
      syncAccountCreationOutcomeKind: 'created',
      papelizSyncStoragePlace: chosenPapelizSyncStoragePlace,
    })
    expect(readPapelizAccountTestFakeAccountId(testBrowserStorage, `user_test_${chosenPapelizSyncStoragePlace}`)).toBe(papelizSyncAccountId)
    const syncDeviceListOutcome = await papelizAccountLocalFakeSyncService.listPapelizSyncDevices(signInToken)
    expect(syncDeviceListOutcome).toEqual({ syncDeviceListOutcomeKind: 'listed', syncDeviceRecords: [] })
  })

  it('uses the stand-in where no Account Worker answers', async () => {
    const testBrowserStorage = stubPapelizAccountTestBrowserStorage()
    stubPapelizAccountTestAccountWorker(404, undefined)
    const signInToken = createPapelizAccountTestSignInToken('user_test_no_worker')
    const papelizAccountSyncService = selectPapelizAccountSyncService(false)
    expect(await papelizAccountSyncService.createPapelizSyncAccount(signInToken, 'wnam')).toEqual({ syncAccountCreationOutcomeKind: 'created', papelizSyncStoragePlace: 'wnam' })
    expect(papelizAccountSyncService.papelizAccountSyncServiceIsLocalFake).toBe(true)
    expect(readPapelizAccountTestFakeAccountId(testBrowserStorage, 'user_test_no_worker')).toMatch(/^pzacct_wnam_/)
  })
})

describe('the billing period the account page reads', () => {
  const syncBillingReplyOnPlusMonthly = {
    hasPapelizSyncAccount: true,
    syncPlanName: 'plus',
    syncBillingPeriod: 'monthly',
    syncSubscriptionState: 'active',
    syncSubscriptionRenewsAt: 1_800_000_000_000,
    syncSubscriptionEndsAt: null,
    syncReadOnlyUntil: null,
    syncSyncedCopyDeletedAt: null,
    hasSyncPaymentCustomer: true,
  }

  it('reads the period from the Account Worker, and a missing one (an older Worker) as unknown', async () => {
    const accountWorkerRequests = stubPapelizAccountTestAccountWorker(200, syncBillingReplyOnPlusMonthly)
    const syncBillingOutcome = await selectPapelizAccountSyncService(true).readPapelizSyncBilling('test-token')
    expect(accountWorkerRequests[0]?.requestPath).toBe(papelizAccountSyncBillingFromSignInPagePath)
    expect(syncBillingOutcome).toEqual({ syncBillingOutcomeKind: 'read', syncBilling: syncBillingReplyOnPlusMonthly })
    const syncBillingReplyWithoutPeriod: Record<string, unknown> = { ...syncBillingReplyOnPlusMonthly }
    delete syncBillingReplyWithoutPeriod['syncBillingPeriod']
    stubPapelizAccountTestAccountWorker(200, syncBillingReplyWithoutPeriod)
    expect(await selectPapelizAccountSyncService(true).readPapelizSyncBilling('test-token')).toEqual({
      syncBillingOutcomeKind: 'read',
      syncBilling: { ...syncBillingReplyWithoutPeriod, syncBillingPeriod: null },
    })
  })

  it('refuses a period Sync doesn’t have', async () => {
    stubPapelizAccountTestAccountWorker(200, { ...syncBillingReplyOnPlusMonthly, syncBillingPeriod: 'weekly' })
    expect((await selectPapelizAccountSyncService(true).readPapelizSyncBilling('test-token')).syncBillingOutcomeKind).toBe('refused')
  })

  it('keeps the period the stand-in’s checkout was opened with, and none on Free', async () => {
    stubPapelizAccountTestBrowserStorage()
    const signInToken = createPapelizAccountTestSignInToken('user_test_billing_period')
    await papelizAccountLocalFakeSyncService.createPapelizSyncAccount(signInToken, 'eu')
    const readStandInBilling = async () => {
      const syncBillingOutcome = await papelizAccountLocalFakeSyncService.readPapelizSyncBilling(signInToken)
      return syncBillingOutcome.syncBillingOutcomeKind === 'read' ? syncBillingOutcome.syncBilling : null
    }
    expect(await readStandInBilling()).toEqual(expect.objectContaining({ syncPlanName: 'free', syncBillingPeriod: null }))
    await papelizAccountLocalFakeSyncService.createPapelizSyncCheckoutPage(signInToken, 'plus', 'monthly', null)
    expect(await readStandInBilling()).toEqual(expect.objectContaining({ syncPlanName: 'plus', syncBillingPeriod: 'monthly', syncSubscriptionState: 'active' }))
  })
})
