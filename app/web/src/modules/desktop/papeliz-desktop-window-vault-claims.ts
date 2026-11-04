import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { isPapelizDesktopNewWindowShortcut } from './papeliz-desktop-new-window-shortcut'
import type { PapelizDesktopPlatform } from './papeliz-desktop-platform-contract'

// Papeliz for Windows opens several windows, one folder vault each. Each window tells the native side
// which folder vault it shows, so a vault shown here is never opened in another window too (the native
// side brings this window forward instead). The sample vault is each window's own, so it is never
// claimed. Ctrl+Shift+N opens a new window from any screen.

// Starts once, when the desktop platform loads; gives back the call that stops it.
export function startPapelizDesktopWindowVaultClaims(
  papelizDesktopPlatform: PapelizDesktopPlatform,
  newWindowShortcutTarget: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> = window,
): () => void {
  const { desktopWindow } = papelizDesktopPlatform
  let claimedFolderVaultId: string | null = null
  // One claim at a time, in the order the open vault changes.
  let windowVaultClaimQueue: Promise<void> = Promise.resolve()

  const followShownFolderVault = () => {
    windowVaultClaimQueue = windowVaultClaimQueue
      .then(async () => {
        const shownOpenVault = usePapelizWorkspaceStore.getState().openVault
        const shownFolderVaultId = shownOpenVault?.papelizVaultAdapter.papelizVaultKind === 'folder-on-disk' ? shownOpenVault.papelizVaultId : null
        if (shownFolderVaultId === claimedFolderVaultId) return
        if (shownFolderVaultId === null) {
          claimedFolderVaultId = null
          await desktopWindow.releaseDesktopWindowVault()
          return
        }
        if (await desktopWindow.claimDesktopWindowVault(shownFolderVaultId)) {
          claimedFolderVaultId = shownFolderVaultId
          return
        }
        // Another window opened it a moment sooner and has come forward, so this window lets it go.
        if (usePapelizWorkspaceStore.getState().openVault?.papelizVaultId === shownFolderVaultId) await usePapelizWorkspaceStore.getState().closeVaultInWorkspace()
      })
      .catch(() => undefined)
  }
  const stopFollowingOpenVault = usePapelizWorkspaceStore.subscribe((workspaceState, previousWorkspaceState) => {
    if (workspaceState.openVault !== previousWorkspaceState.openVault) followShownFolderVault()
  })
  followShownFolderVault()

  const openNewWindowOnShortcut = (shortcutEvent: Event) => {
    if (!isPapelizDesktopNewWindowShortcut(shortcutEvent as KeyboardEvent)) return
    shortcutEvent.preventDefault()
    void desktopWindow.openNewDesktopWindow()
  }
  newWindowShortcutTarget.addEventListener('keydown', openNewWindowOnShortcut)

  return () => {
    stopFollowingOpenVault()
    newWindowShortcutTarget.removeEventListener('keydown', openNewWindowOnShortcut)
  }
}
