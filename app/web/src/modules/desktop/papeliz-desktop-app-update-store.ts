import { create } from 'zustand'
import { hasUnsavedPapelizVaultNotes, usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import type { PapelizDesktopAppUpdate, PapelizDesktopPlatform } from './papeliz-desktop-platform-contract'

// Papeliz for Windows' update check, for a direct download: once at start (unless switched off in
// the gear's Updates page) and on Check Now there. A newer version found is only downloaded,
// checked and installed when the person presses Restart to Update, in the toast, the gear's menu row
// or the status bar; Papeliz then restarts into it. The Microsoft Store package is updated by the
// Store, so none of this shows there.
export type PapelizDesktopAppUpdateCheckState = 'not-checked' | 'checking' | 'newest' | 'update-ready' | 'check-failed' | 'installing' | 'install-failed'

interface PapelizDesktopAppUpdateStoreState {
  desktopAppUpdateCheckState: PapelizDesktopAppUpdateCheckState
  // The newer version found, while one is waiting to be installed.
  readyDesktopAppUpdate: PapelizDesktopAppUpdate | null
  isDesktopAppUpdateCheckAtStartOn: boolean
  // The update toast, once per start; closing it leaves the gear's row and the status bar's line.
  isDesktopAppUpdateToastClosed: boolean
  checkForDesktopAppUpdateNow: (papelizDesktopPlatform: PapelizDesktopPlatform) => Promise<void>
  installReadyDesktopAppUpdate: () => Promise<void>
  setDesktopAppUpdateCheckAtStartOn: (isDesktopAppUpdateCheckAtStartOn: boolean) => void
  closeDesktopAppUpdateToast: () => void
}

const papelizDesktopAppUpdateCheckAtStartStorageKey = 'papeliz:desktop-app-update-check-at-start:v1'

function readPapelizDesktopAppUpdateCheckAtStartOn(): boolean {
  try {
    return localStorage.getItem(papelizDesktopAppUpdateCheckAtStartStorageKey) !== 'off'
  } catch {
    return true
  }
}

export const usePapelizDesktopAppUpdateStore = create<PapelizDesktopAppUpdateStoreState>()((setDesktopAppUpdateState, getDesktopAppUpdateState) => ({
  desktopAppUpdateCheckState: 'not-checked',
  readyDesktopAppUpdate: null,
  isDesktopAppUpdateCheckAtStartOn: readPapelizDesktopAppUpdateCheckAtStartOn(),
  isDesktopAppUpdateToastClosed: false,
  checkForDesktopAppUpdateNow: async (papelizDesktopPlatform) => {
    if (papelizDesktopPlatform.desktopAppDistribution !== 'direct-download') return
    const currentCheckState = getDesktopAppUpdateState().desktopAppUpdateCheckState
    if (currentCheckState === 'checking' || currentCheckState === 'installing') return
    setDesktopAppUpdateState({ desktopAppUpdateCheckState: 'checking' })
    try {
      const foundDesktopAppUpdate = await papelizDesktopPlatform.checkForDesktopAppUpdate()
      setDesktopAppUpdateState(
        foundDesktopAppUpdate === null
          ? { desktopAppUpdateCheckState: 'newest', readyDesktopAppUpdate: null }
          : { desktopAppUpdateCheckState: 'update-ready', readyDesktopAppUpdate: foundDesktopAppUpdate },
      )
    } catch {
      setDesktopAppUpdateState({ desktopAppUpdateCheckState: 'check-failed' })
    }
  },
  installReadyDesktopAppUpdate: async () => {
    const { readyDesktopAppUpdate } = getDesktopAppUpdateState()
    if (readyDesktopAppUpdate === null || getDesktopAppUpdateState().desktopAppUpdateCheckState === 'installing') return
    setDesktopAppUpdateState({ desktopAppUpdateCheckState: 'installing' })
    try {
      // The restart skips the window's close, so every note is saved first; one still unsaved stops
      // the update, with the save's own failure showing.
      await usePapelizWorkspaceStore.getState().saveAllVaultNotesNow()
      if (hasUnsavedPapelizVaultNotes()) throw new Error('A note isn’t saved yet, so the update waits.')
      // Papeliz restarts into the new version once it is installed, so nothing follows on success.
      await readyDesktopAppUpdate.installDesktopAppUpdate()
    } catch {
      setDesktopAppUpdateState({ desktopAppUpdateCheckState: 'install-failed' })
    }
  },
  setDesktopAppUpdateCheckAtStartOn: (isDesktopAppUpdateCheckAtStartOn) => {
    setDesktopAppUpdateState({ isDesktopAppUpdateCheckAtStartOn })
    try {
      localStorage.setItem(papelizDesktopAppUpdateCheckAtStartStorageKey, isDesktopAppUpdateCheckAtStartOn ? 'on' : 'off')
    } catch {
      // No storage: the switch holds for this run only.
    }
  },
  closeDesktopAppUpdateToast: () => setDesktopAppUpdateState({ isDesktopAppUpdateToastClosed: true }),
}))
