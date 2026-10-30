import { useCallback, useSyncExternalStore } from 'react'
import { create } from 'zustand'
import type { PapelizSyncEngine, PapelizSyncEngineSnapshot } from './papeliz-sync-engine-contract'
import { mergePapelizSyncNoteText } from './papeliz-sync-note-merge'

// Loads the Papeliz Sync engine the first time the screens need it, and starts it once. Nothing of
// Sync loads with the app: the engine's chunk (`virtual:papeliz-sync-engine`) loads when someone opens
// the gear's Account or Sync page, or at start when this device has signed in to Sync before. Even
// then the engine sends nothing until someone signs in.

// - `not-in-this-build`: this build has no Sync engine; the pages say so and no indicator shows.
// - `failed-to-load`: the chunk didn't load (offline, say); opening the page again tries again.
export type PapelizSyncEngineLoadState = 'not-loaded' | 'loading' | 'not-in-this-build' | 'in-this-build' | 'failed-to-load'

interface PapelizSyncEngineStoreState {
  syncEngineLoadState: PapelizSyncEngineLoadState
  papelizSyncEngine: PapelizSyncEngine | null
  // Loads and starts the engine once; later calls wait for the same load. Null when this build has
  // no engine or it didn't load.
  loadPapelizSyncEngine: () => Promise<PapelizSyncEngine | null>
}

// Set once this device has signed in to Sync, so the next start loads the engine and syncs; cleared
// when it signs out. Never set by just looking at the pages.
const papelizSyncUsedOnThisDeviceStorageKey = 'papeliz:sync-used-on-this-device:v1'

export function isPapelizSyncUsedOnThisDevice(): boolean {
  try {
    return localStorage.getItem(papelizSyncUsedOnThisDeviceStorageKey) === 'signed-in'
  } catch {
    return false
  }
}

// Cleared only by Sign out (papeliz-sync-account-page.tsx), never because a
// snapshot says signed out: the engine may say so for a moment while it starts.
export function rememberPapelizSyncUsedOnThisDevice(isPapelizSyncUsedOnThisDevice: boolean): void {
  try {
    if (isPapelizSyncUsedOnThisDevice) localStorage.setItem(papelizSyncUsedOnThisDeviceStorageKey, 'signed-in')
    else localStorage.removeItem(papelizSyncUsedOnThisDeviceStorageKey)
  } catch {
    // Storage blocked: the engine then loads only when the pages are opened.
  }
}

// The dev server's switch to the fake engine (papeliz-sync-fake-engine.ts):
// `?papeliz-sync-fake-engine=<scenario>` starts it for this tab, `=off` turns it off. A build has no
// such switch: `import.meta.env.DEV` is false there, so this code and the fake are left out of it.
const papelizSyncDevFakeEngineScenarioStorageKey = 'papeliz:sync-dev-fake-engine-scenario:v1'

export function readPapelizSyncDevFakeEngineScenarioText(): string | null {
  if (!import.meta.env.DEV) return null
  try {
    const fakeEngineScenarioParameter = new URLSearchParams(window.location.search).get('papeliz-sync-fake-engine')
    if (fakeEngineScenarioParameter === 'off') sessionStorage.removeItem(papelizSyncDevFakeEngineScenarioStorageKey)
    else if (fakeEngineScenarioParameter !== null) sessionStorage.setItem(papelizSyncDevFakeEngineScenarioStorageKey, fakeEngineScenarioParameter)
    return sessionStorage.getItem(papelizSyncDevFakeEngineScenarioStorageKey)
  } catch {
    return null
  }
}

async function loadPapelizSyncEngineFromBuild(): Promise<PapelizSyncEngine | null> {
  if (import.meta.env.DEV) {
    const devFakeEngineScenarioText = readPapelizSyncDevFakeEngineScenarioText()
    if (devFakeEngineScenarioText !== null) {
      const { createPapelizSyncFakeEngine, isPapelizSyncFakeEngineScenario } = await import('./papeliz-sync-fake-engine')
      if (isPapelizSyncFakeEngineScenario(devFakeEngineScenarioText)) {
        return createPapelizSyncFakeEngine({ fakeEngineScenario: devFakeEngineScenarioText, fakeCallDelayMilliseconds: 350, fakeOtherTabFinishMilliseconds: 2500 })
      }
    }
  }
  const { loadPapelizSyncEngine } = await import('virtual:papeliz-sync-engine')
  const syncEngineLoadResult = await loadPapelizSyncEngine()
  return syncEngineLoadResult.papelizSyncEngineAvailability === 'in-this-build' ? syncEngineLoadResult.papelizSyncEngine : null
}

let papelizSyncEngineLoad: Promise<PapelizSyncEngine | null> | null = null

export const usePapelizSyncEngineStore = create<PapelizSyncEngineStoreState>()((setSyncEngineState) => ({
  syncEngineLoadState: 'not-loaded',
  papelizSyncEngine: null,
  loadPapelizSyncEngine: () => {
    if (papelizSyncEngineLoad !== null) return papelizSyncEngineLoad
    setSyncEngineState({ syncEngineLoadState: 'loading' })
    papelizSyncEngineLoad = (async () => {
      try {
        const papelizSyncEngine = await loadPapelizSyncEngineFromBuild()
        if (papelizSyncEngine === null) {
          setSyncEngineState({ syncEngineLoadState: 'not-in-this-build' })
          return null
        }
        await papelizSyncEngine.startSyncEngine({
          // `/api/account/v1/` and `/api/sync/v1/` sit beside the app: papeliz.com, or the dev origin.
          papelizSyncServiceOrigin: window.location.origin,
          syncDevicePlatform: 'web',
          mergeSyncNoteText: mergePapelizSyncNoteText,
        })
        const rememberSignInOnThisDevice = () => {
          if (papelizSyncEngine.getSyncEngineSnapshot().syncSignIn.syncSignInKind === 'signed-in') rememberPapelizSyncUsedOnThisDevice(true)
        }
        rememberSignInOnThisDevice()
        papelizSyncEngine.subscribeToSyncEngineSnapshot(rememberSignInOnThisDevice)
        setSyncEngineState({ syncEngineLoadState: 'in-this-build', papelizSyncEngine })
        return papelizSyncEngine
      } catch (syncEngineLoadError) {
        console.warn('Papeliz Sync engine did not load:', syncEngineLoadError)
        papelizSyncEngineLoad = null
        setSyncEngineState({ syncEngineLoadState: 'failed-to-load' })
        return null
      }
    })()
    return papelizSyncEngineLoad
  },
}))

// The engine's snapshot, for the screens; null until the engine is loaded (and in a build without it).
export function usePapelizSyncEngineSnapshot(): { papelizSyncEngine: PapelizSyncEngine; syncEngineSnapshot: PapelizSyncEngineSnapshot } | null {
  const papelizSyncEngine = usePapelizSyncEngineStore((syncEngineState) => syncEngineState.papelizSyncEngine)
  const subscribeToSnapshot = useCallback(
    (onSnapshotChange: () => void) => (papelizSyncEngine === null ? () => undefined : papelizSyncEngine.subscribeToSyncEngineSnapshot(onSnapshotChange)),
    [papelizSyncEngine],
  )
  const syncEngineSnapshot = useSyncExternalStore(subscribeToSnapshot, () => papelizSyncEngine?.getSyncEngineSnapshot() ?? null)
  return papelizSyncEngine === null || syncEngineSnapshot === null ? null : { papelizSyncEngine, syncEngineSnapshot }
}
