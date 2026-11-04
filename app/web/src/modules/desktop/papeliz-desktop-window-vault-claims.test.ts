import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PapelizOpenVault } from '../vault/papeliz-open-vault'
import type { PapelizVaultKind } from '../vault/papeliz-vault-adapter'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import type { PapelizDesktopPlatform, PapelizDesktopWindow } from './papeliz-desktop-platform-contract'
import { isPapelizDesktopNewWindowShortcut } from './papeliz-desktop-new-window-shortcut'
import { startPapelizDesktopWindowVaultClaims } from './papeliz-desktop-window-vault-claims'

// The open vault as the workspace store holds it, with only what the claims read.
function makeTestOpenVault(papelizVaultId: string, papelizVaultKind: PapelizVaultKind): PapelizOpenVault {
  return { papelizVaultId, papelizVaultDisplayName: papelizVaultId, papelizVaultAdapter: { papelizVaultKind } } as unknown as PapelizOpenVault
}

function makeTestDesktopWindow(isClaimGranted: boolean) {
  return {
    claimDesktopWindowVault: vi.fn(async (_papelizVaultId: string) => isClaimGranted),
    releaseDesktopWindowVault: vi.fn(async () => undefined),
    openNewDesktopWindow: vi.fn(async () => undefined),
  }
}

const waitForWindowVaultClaims = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('each Papeliz for Windows window claims the folder vault it shows', () => {
  const closeVaultInWorkspaceBeforeTests = usePapelizWorkspaceStore.getState().closeVaultInWorkspace
  let stopWindowVaultClaims: () => void = () => undefined

  beforeEach(() => usePapelizWorkspaceStore.setState({ openVault: null }))
  afterEach(() => {
    stopWindowVaultClaims()
    usePapelizWorkspaceStore.setState({ openVault: null, closeVaultInWorkspace: closeVaultInWorkspaceBeforeTests })
  })

  function startTestClaims(testDesktopWindow: ReturnType<typeof makeTestDesktopWindow>, newWindowShortcutTarget = new EventTarget()) {
    const testDesktopPlatform = { desktopWindow: testDesktopWindow as unknown as PapelizDesktopWindow } as PapelizDesktopPlatform
    stopWindowVaultClaims = startPapelizDesktopWindowVaultClaims(testDesktopPlatform, newWindowShortcutTarget)
  }

  it('claims a folder vault when it opens, never the sample vault, and lets it go when it closes', async () => {
    const testDesktopWindow = makeTestDesktopWindow(true)
    startTestClaims(testDesktopWindow)
    usePapelizWorkspaceStore.setState({ openVault: makeTestOpenVault('vault-garden', 'folder-on-disk') })
    await waitForWindowVaultClaims()
    expect(testDesktopWindow.claimDesktopWindowVault.mock.calls).toEqual([['vault-garden']])

    // A renamed vault is a new object with the same id: nothing is claimed again.
    usePapelizWorkspaceStore.setState({ openVault: makeTestOpenVault('vault-garden', 'folder-on-disk') })
    await waitForWindowVaultClaims()
    expect(testDesktopWindow.claimDesktopWindowVault).toHaveBeenCalledTimes(1)

    usePapelizWorkspaceStore.setState({ openVault: null })
    await waitForWindowVaultClaims()
    expect(testDesktopWindow.releaseDesktopWindowVault).toHaveBeenCalledTimes(1)

    usePapelizWorkspaceStore.setState({ openVault: makeTestOpenVault('sample', 'sample-vault-in-memory') })
    await waitForWindowVaultClaims()
    expect(testDesktopWindow.claimDesktopWindowVault).toHaveBeenCalledTimes(1)
    expect(testDesktopWindow.releaseDesktopWindowVault).toHaveBeenCalledTimes(1)
  })

  it('closes the vault again when another window already shows it', async () => {
    const closeVaultInWorkspace = vi.fn(async () => usePapelizWorkspaceStore.setState({ openVault: null }))
    usePapelizWorkspaceStore.setState({ closeVaultInWorkspace })
    const testDesktopWindow = makeTestDesktopWindow(false)
    startTestClaims(testDesktopWindow)
    usePapelizWorkspaceStore.setState({ openVault: makeTestOpenVault('vault-research', 'folder-on-disk') })
    await waitForWindowVaultClaims()
    expect(testDesktopWindow.claimDesktopWindowVault.mock.calls).toEqual([['vault-research']])
    expect(closeVaultInWorkspace).toHaveBeenCalledTimes(1)
    expect(usePapelizWorkspaceStore.getState().openVault).toBeNull()
  })

  it('opens a new window on Ctrl+Shift+N, and on nothing else', async () => {
    const testDesktopWindow = makeTestDesktopWindow(true)
    const newWindowShortcutTarget = new EventTarget()
    startTestClaims(testDesktopWindow, newWindowShortcutTarget)
    const pressKeys = (keyboardEventFields: Partial<KeyboardEvent>) => {
      const keydownEvent = Object.assign(new Event('keydown', { cancelable: true }), { ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, repeat: false, key: '' }, keyboardEventFields)
      newWindowShortcutTarget.dispatchEvent(keydownEvent)
      return keydownEvent
    }
    expect(pressKeys({ ctrlKey: true, shiftKey: true, key: 'N' }).defaultPrevented).toBe(true)
    pressKeys({ ctrlKey: true, key: 'n' })
    pressKeys({ ctrlKey: true, shiftKey: true, altKey: true, key: 'N' })
    pressKeys({ ctrlKey: true, shiftKey: true, key: 'N', repeat: true })
    expect(testDesktopWindow.openNewDesktopWindow).toHaveBeenCalledTimes(1)
    expect(isPapelizDesktopNewWindowShortcut({ key: 'n', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, repeat: false })).toBe(true)
  })
})
