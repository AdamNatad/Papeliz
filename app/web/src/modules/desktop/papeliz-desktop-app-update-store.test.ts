import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { usePapelizDesktopAppUpdateStore } from './papeliz-desktop-app-update-store'
import type { PapelizDesktopAppUpdate, PapelizDesktopPlatform } from './papeliz-desktop-platform-contract'

function createTestDesktopPlatform(
  desktopAppDistribution: PapelizDesktopPlatform['desktopAppDistribution'],
  checkForDesktopAppUpdate: () => Promise<PapelizDesktopAppUpdate | null>,
): PapelizDesktopPlatform {
  return { desktopAppDistribution, checkForDesktopAppUpdate } as unknown as PapelizDesktopPlatform
}

const initialDesktopAppUpdateState = usePapelizDesktopAppUpdateStore.getState()

describe('Papeliz for Windows’ update check', () => {
  const testLocalStorageItems = new Map<string, string>()

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: (storageKey: string) => testLocalStorageItems.get(storageKey) ?? null,
      setItem: (storageKey: string, storageValue: string) => testLocalStorageItems.set(storageKey, storageValue),
    })
  })

  afterEach(() => {
    usePapelizDesktopAppUpdateStore.setState(initialDesktopAppUpdateState, true)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    testLocalStorageItems.clear()
  })

  it('finds a newer version in a direct download, and says so when this one is the newest', async () => {
    const readyDesktopAppUpdate: PapelizDesktopAppUpdate = { desktopAppUpdateVersion: '0.2.0', installDesktopAppUpdate: async () => undefined }
    await usePapelizDesktopAppUpdateStore.getState().checkForDesktopAppUpdateNow(createTestDesktopPlatform('direct-download', async () => readyDesktopAppUpdate))
    expect(usePapelizDesktopAppUpdateStore.getState()).toMatchObject({ desktopAppUpdateCheckState: 'update-ready', readyDesktopAppUpdate })
    await usePapelizDesktopAppUpdateStore.getState().checkForDesktopAppUpdateNow(createTestDesktopPlatform('direct-download', async () => null))
    expect(usePapelizDesktopAppUpdateStore.getState()).toMatchObject({ desktopAppUpdateCheckState: 'newest', readyDesktopAppUpdate: null })
  })

  it('never checks in the Microsoft Store package, and says when a check fails', async () => {
    const checkForDesktopAppUpdate = vi.fn(async () => null)
    await usePapelizDesktopAppUpdateStore.getState().checkForDesktopAppUpdateNow(createTestDesktopPlatform('microsoft-store', checkForDesktopAppUpdate))
    expect(checkForDesktopAppUpdate).not.toHaveBeenCalled()
    expect(usePapelizDesktopAppUpdateStore.getState().desktopAppUpdateCheckState).toBe('not-checked')
    await usePapelizDesktopAppUpdateStore.getState().checkForDesktopAppUpdateNow(
      createTestDesktopPlatform('direct-download', async () => {
        throw new Error('offline')
      }),
    )
    expect(usePapelizDesktopAppUpdateStore.getState().desktopAppUpdateCheckState).toBe('check-failed')
  })

  it('saves every note before it installs the update', async () => {
    const desktopAppUpdateSteps: string[] = []
    const readyDesktopAppUpdate: PapelizDesktopAppUpdate = {
      desktopAppUpdateVersion: '0.2.0',
      installDesktopAppUpdate: async () => {
        desktopAppUpdateSteps.push('install')
      },
    }
    usePapelizWorkspaceStore.setState({
      saveAllVaultNotesNow: async () => {
        desktopAppUpdateSteps.push('save')
      },
    })
    usePapelizDesktopAppUpdateStore.setState({ desktopAppUpdateCheckState: 'update-ready', readyDesktopAppUpdate })
    await usePapelizDesktopAppUpdateStore.getState().installReadyDesktopAppUpdate()
    expect(desktopAppUpdateSteps).toEqual(['save', 'install'])
  })

  it('remembers the check-at-start switch', () => {
    usePapelizDesktopAppUpdateStore.getState().setDesktopAppUpdateCheckAtStartOn(false)
    expect(usePapelizDesktopAppUpdateStore.getState().isDesktopAppUpdateCheckAtStartOn).toBe(false)
    expect(testLocalStorageItems.get('papeliz:desktop-app-update-check-at-start:v1')).toBe('off')
    usePapelizDesktopAppUpdateStore.getState().setDesktopAppUpdateCheckAtStartOn(true)
    expect(testLocalStorageItems.get('papeliz:desktop-app-update-check-at-start:v1')).toBe('on')
  })
})
