import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createPapelizAccountSignUpStoragePlaceMetadata,
  createPapelizSignedUpSyncAccountWithQuietRetries,
  papelizAccountSignUpStoragePlaceMetadataKey,
  readPapelizAccountSignedUpStoragePlace,
} from './papeliz-account-sign-up-sync-account-creation'
import { papelizSyncStoragePlaces, type PapelizSyncStoragePlace } from './papeliz-account-sync-hand-over'
import { papelizAccountLocalFakeSyncService, type PapelizAccountSyncAccountCreationOutcome } from './papeliz-account-sync-service'

// A new account's username and place are saved together at sign-up, and its Sync account is made in
// that place without failing on a late token, a dropped connection or a server's bad moment.

afterEach(() => {
  vi.unstubAllGlobals()
})

// One step of a scripted Account Worker: an answer, a throw (no connection), or no token yet.
type PapelizAccountTestSyncAccountCreationStep = PapelizAccountSyncAccountCreationOutcome | 'connection-dropped' | 'token-not-ready'

function createPapelizAccountTestSignUpSyncAccountCreation(testSyncAccountCreationSteps: PapelizAccountTestSyncAccountCreationStep[]) {
  const remainingTestSteps = [...testSyncAccountCreationSteps]
  let currentTestStep: PapelizAccountTestSyncAccountCreationStep | undefined
  const placesSentToAccountWorker: PapelizSyncStoragePlace[] = []
  const quietRetryWaitsMs: number[] = []
  return {
    placesSentToAccountWorker,
    quietRetryWaitsMs,
    createSignedUpSyncAccount: (signedUpPapelizSyncStoragePlace: PapelizSyncStoragePlace) =>
      createPapelizSignedUpSyncAccountWithQuietRetries({
        readPapelizAccountSignInToken: async () => {
          currentTestStep = remainingTestSteps.shift()
          return currentTestStep === 'token-not-ready' ? null : 'test-sign-in-token'
        },
        papelizAccountSyncService: {
          async createPapelizSyncAccount(_signInToken, papelizSyncStoragePlaceForNewAccount) {
            placesSentToAccountWorker.push(papelizSyncStoragePlaceForNewAccount)
            if (currentTestStep === 'connection-dropped' || currentTestStep === undefined || currentTestStep === 'token-not-ready') throw new TypeError('Failed to fetch')
            return currentTestStep
          },
        },
        signedUpPapelizSyncStoragePlace,
        waitBeforeQuietRetry: async (retryDelayMs) => void quietRetryWaitsMs.push(retryDelayMs),
      }),
  }
}

const papelizAccountTestCreatedInEurope: PapelizAccountSyncAccountCreationOutcome = { syncAccountCreationOutcomeKind: 'created', papelizSyncStoragePlace: 'eu' }
const papelizAccountTestServerRefusal: PapelizAccountSyncAccountCreationOutcome = { syncAccountCreationOutcomeKind: 'refused', syncAccountCreationRefusalMessage: 'Papeliz Sync answered 503.' }

describe('the place saved with the account at sign-up', () => {
  it.each(papelizSyncStoragePlaces)('reads back %s from the account', (chosenPapelizSyncStoragePlace: PapelizSyncStoragePlace) => {
    expect(readPapelizAccountSignedUpStoragePlace(createPapelizAccountSignUpStoragePlaceMetadata(chosenPapelizSyncStoragePlace))).toBe(chosenPapelizSyncStoragePlace)
  })

  it('reads nothing from an account made without one, or from something that is not a place', () => {
    expect(readPapelizAccountSignedUpStoragePlace(undefined)).toBeNull()
    expect(readPapelizAccountSignedUpStoragePlace(null)).toBeNull()
    expect(readPapelizAccountSignedUpStoragePlace({})).toBeNull()
    expect(readPapelizAccountSignedUpStoragePlace({ [papelizAccountSignUpStoragePlaceMetadataKey]: 'mars' })).toBeNull()
    expect(readPapelizAccountSignedUpStoragePlace({ [papelizAccountSignUpStoragePlaceMetadataKey]: 3 })).toBeNull()
  })
})

describe('making the Sync account in the signed-up place', () => {
  it('makes it at once when nothing goes wrong', async () => {
    const testCreation = createPapelizAccountTestSignUpSyncAccountCreation([papelizAccountTestCreatedInEurope])
    expect(await testCreation.createSignedUpSyncAccount('eu')).toEqual({ signUpSyncAccountCreationResultKind: 'created' })
    expect(testCreation.quietRetryWaitsMs).toEqual([])
  })

  it('waits for a token that is late right after sign-up', async () => {
    const testCreation = createPapelizAccountTestSignUpSyncAccountCreation(['token-not-ready', papelizAccountTestCreatedInEurope])
    expect(await testCreation.createSignedUpSyncAccount('eu')).toEqual({ signUpSyncAccountCreationResultKind: 'created' })
    expect(testCreation.quietRetryWaitsMs).toEqual([1000])
    expect(testCreation.placesSentToAccountWorker).toEqual(['eu'])
  })

  it('tries again by itself after a dropped connection and a server error, in the same place', async () => {
    const testCreation = createPapelizAccountTestSignUpSyncAccountCreation(['connection-dropped', papelizAccountTestServerRefusal, papelizAccountTestCreatedInEurope])
    expect(await testCreation.createSignedUpSyncAccount('eu')).toEqual({ signUpSyncAccountCreationResultKind: 'created' })
    expect(testCreation.quietRetryWaitsMs).toEqual([1000, 2000])
    expect(testCreation.placesSentToAccountWorker).toEqual(['eu', 'eu', 'eu'])
  })

  it('reports the last refusal only after every quiet retry', async () => {
    const testCreation = createPapelizAccountTestSignUpSyncAccountCreation(Array(4).fill(papelizAccountTestServerRefusal))
    expect(await testCreation.createSignedUpSyncAccount('apac')).toEqual({
      signUpSyncAccountCreationResultKind: 'failed',
      syncAccountCreationFailureMessage: 'Papeliz Sync answered 503.',
    })
    expect(testCreation.quietRetryWaitsMs).toEqual([1000, 2000, 4000])
    expect(testCreation.placesSentToAccountWorker).toEqual(['apac', 'apac', 'apac', 'apac'])
  })

  it('reports no message of its own when Sync could never be reached', async () => {
    const testCreation = createPapelizAccountTestSignUpSyncAccountCreation(Array(4).fill('connection-dropped'))
    expect(await testCreation.createSignedUpSyncAccount('eu')).toEqual({ signUpSyncAccountCreationResultKind: 'failed', syncAccountCreationFailureMessage: null })
  })

  it('asks to sign in again when the token never comes', async () => {
    const testCreation = createPapelizAccountTestSignUpSyncAccountCreation(Array(4).fill('token-not-ready'))
    expect(await testCreation.createSignedUpSyncAccount('eu')).toEqual({ signUpSyncAccountCreationResultKind: 'failed', syncAccountCreationFailureMessage: 'Sign in again to continue.' })
    expect(testCreation.placesSentToAccountWorker).toEqual([])
  })

  it('is safe to repeat: an account that has its Sync account keeps its first place', async () => {
    const testBrowserStorage = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (storageKey: string) => testBrowserStorage.get(storageKey) ?? null,
        setItem: (storageKey: string, storageValue: string) => void testBrowserStorage.set(storageKey, storageValue),
        removeItem: (storageKey: string) => void testBrowserStorage.delete(storageKey),
      },
    })
    const testSignInToken = `test-header.${Buffer.from(JSON.stringify({ sub: 'user_signed_up_twice' })).toString('base64url')}.test-signature`
    const createInPlace = (signedUpPapelizSyncStoragePlace: PapelizSyncStoragePlace) =>
      createPapelizSignedUpSyncAccountWithQuietRetries({
        readPapelizAccountSignInToken: async () => testSignInToken,
        papelizAccountSyncService: papelizAccountLocalFakeSyncService,
        signedUpPapelizSyncStoragePlace,
      })
    expect(await createInPlace('eu')).toEqual({ signUpSyncAccountCreationResultKind: 'created' })
    expect(await createInPlace('eu')).toEqual({ signUpSyncAccountCreationResultKind: 'created' })
    expect(await papelizAccountLocalFakeSyncService.createPapelizSyncAccount(testSignInToken, 'apac')).toEqual({
      syncAccountCreationOutcomeKind: 'created',
      papelizSyncStoragePlace: 'eu',
    })
  })
})
