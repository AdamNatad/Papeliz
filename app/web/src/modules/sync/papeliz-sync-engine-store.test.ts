import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PapelizSyncEngineLoadResult } from './papeliz-sync-engine-stand-in'
import { createPapelizSyncFakeEngine, type PapelizSyncFakeEngine } from './papeliz-sync-fake-engine'

// Loading the engine: once, only when asked, and with nothing sent to any server when the build has
// no engine. `virtual:papeliz-sync-engine` is replaced by each case's own answer.

let papelizSyncTestEngineLoadResult: PapelizSyncEngineLoadResult = { papelizSyncEngineAvailability: 'not-in-this-build' }
let papelizSyncTestEngineLoadCount = 0

vi.mock('virtual:papeliz-sync-engine', () => ({
  loadPapelizSyncEngine: async () => {
    papelizSyncTestEngineLoadCount += 1
    return papelizSyncTestEngineLoadResult
  },
}))

const papelizSyncTestStorage = new Map<string, string>()

beforeEach(() => {
  vi.resetModules()
  papelizSyncTestEngineLoadCount = 0
  papelizSyncTestStorage.clear()
  vi.stubGlobal('window', { location: { origin: 'https://papeliz.test', search: '' } })
  vi.stubGlobal('localStorage', {
    getItem: (storageKey: string) => papelizSyncTestStorage.get(storageKey) ?? null,
    setItem: (storageKey: string, storageValue: string) => papelizSyncTestStorage.set(storageKey, storageValue),
    removeItem: (storageKey: string) => papelizSyncTestStorage.delete(storageKey),
  })
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loading the Sync engine', () => {
  it('in a build without it, says so, and sends nothing anywhere', async () => {
    papelizSyncTestEngineLoadResult = { papelizSyncEngineAvailability: 'not-in-this-build' }
    const { usePapelizSyncEngineStore } = await import('./papeliz-sync-engine-store')
    expect(usePapelizSyncEngineStore.getState().syncEngineLoadState).toBe('not-loaded')
    expect(await usePapelizSyncEngineStore.getState().loadPapelizSyncEngine()).toBeNull()
    expect(usePapelizSyncEngineStore.getState()).toMatchObject({ syncEngineLoadState: 'not-in-this-build', papelizSyncEngine: null })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('starts the engine once with the platform’s parts, however often it is asked', async () => {
    const papelizSyncFakeEngine: PapelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'signed-out' })
    papelizSyncTestEngineLoadResult = { papelizSyncEngineAvailability: 'in-this-build', papelizSyncEngine: papelizSyncFakeEngine }
    const { usePapelizSyncEngineStore } = await import('./papeliz-sync-engine-store')
    const [firstLoadedEngine, secondLoadedEngine] = await Promise.all([
      usePapelizSyncEngineStore.getState().loadPapelizSyncEngine(),
      usePapelizSyncEngineStore.getState().loadPapelizSyncEngine(),
    ])
    expect(firstLoadedEngine).toBe(papelizSyncFakeEngine)
    expect(secondLoadedEngine).toBe(papelizSyncFakeEngine)
    expect(papelizSyncTestEngineLoadCount).toBe(1)
    expect(papelizSyncFakeEngine.fakeEngineCallNames.filter((fakeEngineCallName) => fakeEngineCallName === 'startSyncEngine')).toHaveLength(1)
    expect(papelizSyncFakeEngine.fakeStartedSyncEnginePlatform).toMatchObject({ papelizSyncServiceOrigin: 'https://papeliz.test', syncDevicePlatform: 'web' })
    // Loading and starting calls nothing else on the engine.
    expect(papelizSyncFakeEngine.fakeEngineCallNames).toEqual(['startSyncEngine'])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('remembers a sign-in on this device, so the next start loads the engine; only Sign out forgets it', async () => {
    const papelizSyncFakeEngine = createPapelizSyncFakeEngine({ fakeEngineScenario: 'signed-out' })
    papelizSyncTestEngineLoadResult = { papelizSyncEngineAvailability: 'in-this-build', papelizSyncEngine: papelizSyncFakeEngine }
    const { isPapelizSyncUsedOnThisDevice, rememberPapelizSyncUsedOnThisDevice, usePapelizSyncEngineStore } = await import('./papeliz-sync-engine-store')
    await usePapelizSyncEngineStore.getState().loadPapelizSyncEngine()
    expect(isPapelizSyncUsedOnThisDevice()).toBe(false)

    vi.stubGlobal('window', { location: { origin: 'https://papeliz.test', search: '' }, open: () => null })
    const signInAttempt = papelizSyncFakeEngine.startSyncSignIn({ papelizSyncStoragePlaceForNewAccount: 'eu' })
    papelizSyncFakeEngine.finishFakeSyncSignIn()
    await signInAttempt.syncSignInOutcome
    expect(isPapelizSyncUsedOnThisDevice()).toBe(true)

    await papelizSyncFakeEngine.signOutOfSync()
    expect(isPapelizSyncUsedOnThisDevice()).toBe(true)
    rememberPapelizSyncUsedOnThisDevice(false)
    expect(isPapelizSyncUsedOnThisDevice()).toBe(false)
  })
})
