import { afterEach, describe, expect, it, vi } from 'vitest'
import { papelizSyncStoragePlaces, type PapelizSyncStoragePlace } from './papeliz-account-sync-hand-over'
import { papelizAccountLocalFakeSyncService, papelizAccountSyncCheckoutSessionsFromSignInPagePath, selectPapelizAccountSyncService } from './papeliz-account-sync-service'
import {
  forgetPapelizAccountSyncStoragePlaceChoices,
  readPapelizAccountSyncStoragePlaceChoice,
  rememberPapelizAccountSyncStoragePlaceChoice,
} from './papeliz-account-sync-storage-place-choice-store'

// The storage place a person picks is the one checkout sends and the one the account is made in,
// never the nearest place picked for them. The picker itself draws its blue row and sends from the
// same state; this checks the rest of the way, from the place handed to checkout to the Account
// Worker's request and to the stand-in's new account.

// A sign-in token the stand-in reads only for its subject.
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

afterEach(() => {
  vi.unstubAllGlobals()
  forgetPapelizAccountSyncStoragePlaceChoices()
})

// A list drawn again reads its choice from the store: the place picked before, or its first place.
describe('the storage place picked, through a list drawn again', () => {
  it('opens on its first place until a place is picked', () => {
    expect(readPapelizAccountSyncStoragePlaceChoice('papeliz-account-sync-storage-place', 'apac')).toBe('apac')
  })

  it.each(papelizSyncStoragePlaces)('keeps %s after the list is drawn again, not the nearest place', (chosenPapelizSyncStoragePlace: PapelizSyncStoragePlace) => {
    rememberPapelizAccountSyncStoragePlaceChoice('papeliz-account-sync-storage-place', chosenPapelizSyncStoragePlace)
    // The remounted list asks again with its first place, the nearest.
    expect(readPapelizAccountSyncStoragePlaceChoice('papeliz-account-sync-storage-place', 'apac')).toBe(chosenPapelizSyncStoragePlace)
  })

  it('keeps each list on its own choice', () => {
    rememberPapelizAccountSyncStoragePlaceChoice('papeliz-account-sync-storage-place', 'eu')
    expect(readPapelizAccountSyncStoragePlaceChoice('papeliz-account-sign-up-storage-place', 'apac')).toBe('apac')
    expect(readPapelizAccountSyncStoragePlaceChoice('papeliz-sync-storage-place', 'wnam')).toBe('wnam')
  })

  it('sends the remembered place, Europe, to checkout after the list is drawn again', async () => {
    const checkoutRequestBodies: unknown[] = []
    vi.stubGlobal('fetch', async (_requestPath: string, requestInit: RequestInit) => {
      checkoutRequestBodies.push(JSON.parse(String(requestInit.body)))
      return new Response(JSON.stringify({ syncCheckoutPageUrl: 'https://checkout.papeliz.test/session' }), { status: 200 })
    })
    rememberPapelizAccountSyncStoragePlaceChoice('papeliz-account-sync-storage-place', 'eu')
    const placeSentAfterRemount = readPapelizAccountSyncStoragePlaceChoice('papeliz-account-sync-storage-place', 'apac')
    await selectPapelizAccountSyncService(true).createPapelizSyncCheckoutPage('test-token', 'standard', 'yearly', placeSentAfterRemount)
    expect(checkoutRequestBodies).toEqual([{ syncPlanName: 'standard', syncBillingPeriod: 'yearly', papelizSyncStoragePlaceForNewAccount: 'eu' }])
  })
})

describe('the storage place from the picker to the account', () => {
  it.each(papelizSyncStoragePlaces)('sends %s to the Account Worker exactly as chosen', async (chosenPapelizSyncStoragePlace: PapelizSyncStoragePlace) => {
    const checkoutRequests: { requestPath: string; requestBody: unknown }[] = []
    vi.stubGlobal('fetch', async (requestPath: string, requestInit: RequestInit) => {
      checkoutRequests.push({ requestPath, requestBody: JSON.parse(String(requestInit.body)) })
      return new Response(JSON.stringify({ syncCheckoutPageUrl: 'https://checkout.papeliz.test/session' }), { status: 200 })
    })
    const papelizAccountSyncWorkerService = selectPapelizAccountSyncService(true)
    const syncCheckoutOutcome = await papelizAccountSyncWorkerService.createPapelizSyncCheckoutPage('test-token', 'standard', 'yearly', chosenPapelizSyncStoragePlace)
    expect(syncCheckoutOutcome.syncCheckoutOutcomeKind).toBe('opened')
    expect(checkoutRequests).toEqual([
      {
        requestPath: papelizAccountSyncCheckoutSessionsFromSignInPagePath,
        requestBody: { syncPlanName: 'standard', syncBillingPeriod: 'yearly', papelizSyncStoragePlaceForNewAccount: chosenPapelizSyncStoragePlace },
      },
    ])
  })

  it.each(papelizSyncStoragePlaces)('makes the stand-in account in %s, the place chosen', async (chosenPapelizSyncStoragePlace: PapelizSyncStoragePlace) => {
    const testBrowserStorage = stubPapelizAccountTestBrowserStorage()
    const syncCheckoutOutcome = await papelizAccountLocalFakeSyncService.createPapelizSyncCheckoutPage(
      createPapelizAccountTestSignInToken(`user_test_${chosenPapelizSyncStoragePlace}`),
      'standard',
      'yearly',
      chosenPapelizSyncStoragePlace,
    )
    expect(syncCheckoutOutcome.syncCheckoutOutcomeKind).toBe('opened')
    const localFakeSyncAccounts = JSON.parse(testBrowserStorage.get('papelizAccountLocalFakeSyncAccounts') ?? '{}') as Record<string, { papelizSyncAccountId: string }>
    expect(localFakeSyncAccounts[`user_test_${chosenPapelizSyncStoragePlace}`]?.papelizSyncAccountId).toMatch(new RegExp(`^pzacct_${chosenPapelizSyncStoragePlace}_`))
  })

  it('asks a new account for its place instead of picking one for it', async () => {
    stubPapelizAccountTestBrowserStorage()
    const syncCheckoutOutcome = await papelizAccountLocalFakeSyncService.createPapelizSyncCheckoutPage(
      createPapelizAccountTestSignInToken('user_test_no_place'),
      'standard',
      'yearly',
      null,
    )
    expect(syncCheckoutOutcome).toEqual({ syncCheckoutOutcomeKind: 'storage-place-required' })
  })
})
