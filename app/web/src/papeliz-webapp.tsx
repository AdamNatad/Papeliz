import { lazy, Suspense, useEffect, useState } from 'react'
import { loadPapelizDesktopPlatformOnce } from './modules/desktop/papeliz-desktop-platform-store'
import { usePapelizDesktopAppUpdateStore } from './modules/desktop/papeliz-desktop-app-update-store'
import { sendPapelizDesktopExternalLinksToSystemBrowser } from './modules/desktop/papeliz-desktop-external-links'
import { usePapelizLoadingStartedAtMilliseconds } from './modules/ui/papeliz-loading-clock'
import { PapelizLoadingOpeningScreen } from './modules/ui/papeliz-loading-opening-screen'
import type { PapelizLoadingStep } from './modules/ui/papeliz-loading-progress-count'
import { PapelizWelcomeScreen } from './modules/workspace/papeliz-welcome-screen'
import { hasUnsavedPapelizVaultNotes, usePapelizWorkspaceStore } from './modules/workspace/papeliz-workspace-store'

// The workspace (MD Code, MD View and their parsers) loads only once a vault opens, so the
// start page stays small.
const PapelizWorkspace = lazy(() =>
  import('./modules/workspace/papeliz-workspace').then((workspaceModule) => ({ default: workspaceModule.PapelizWorkspace })),
)

type PapelizWebappOpeningScreenStage = 'shown' | 'leaving' | 'gone'

// How long the opening screen takes to fade (papeliz-webapp.css, .papeliz-loading-opening-screen).
const papelizWebappOpeningScreenFadeMilliseconds = 180

interface PapelizWebappStartProps {
  isPapelizThemePreferenceRead: boolean
  papelizWebappStartedAtMilliseconds: number
}

// The app's start: the opening screen and its steps until the saved theme is read and the start page
// has drawn under it; then it fades away over the start page.
export function PapelizWebappStart({ isPapelizThemePreferenceRead, papelizWebappStartedAtMilliseconds }: PapelizWebappStartProps) {
  const [openingScreenStage, setOpeningScreenStage] = useState<PapelizWebappOpeningScreenStage>('shown')

  useEffect(() => {
    if (!isPapelizThemePreferenceRead) return
    // The start page has drawn: the last step shows done for a frame, then the screen fades.
    let openingScreenFadeTimeout = 0
    const openingScreenLeaveFrame = window.requestAnimationFrame(() => {
      setOpeningScreenStage('leaving')
      openingScreenFadeTimeout = window.setTimeout(() => setOpeningScreenStage('gone'), papelizWebappOpeningScreenFadeMilliseconds)
    })
    return () => {
      window.cancelAnimationFrame(openingScreenLeaveFrame)
      window.clearTimeout(openingScreenFadeTimeout)
    }
  }, [isPapelizThemePreferenceRead])

  const papelizWebappStartSteps: PapelizLoadingStep[] = [
    { loadingStepLabel: 'Loading Papeliz', loadingStepState: 'done' },
    { loadingStepLabel: 'Reading your theme', loadingStepState: isPapelizThemePreferenceRead ? 'done' : 'running' },
    {
      loadingStepLabel: 'Opening the start page',
      loadingStepState: openingScreenStage !== 'shown' ? 'done' : isPapelizThemePreferenceRead ? 'running' : 'waiting',
    },
  ]

  return (
    <>
      {isPapelizThemePreferenceRead && <PapelizWebapp />}
      {openingScreenStage !== 'gone' && (
        <PapelizLoadingOpeningScreen
          loadingWords="Starting Papeliz"
          loadingSteps={papelizWebappStartSteps}
          loadingStartedAtMilliseconds={papelizWebappStartedAtMilliseconds}
          isOpeningScreenLeaving={openingScreenStage === 'leaving'}
        />
      )}
    </>
  )
}

// Opening a vault while the workspace's code loads.
function PapelizWorkspaceOpeningScreen({ vaultDisplayName }: { vaultDisplayName: string }) {
  const workspaceOpeningStartedAtMilliseconds = usePapelizLoadingStartedAtMilliseconds()
  return (
    <PapelizLoadingOpeningScreen
      loadingWords={`Opening ${vaultDisplayName}`}
      loadingSteps={[{ loadingStepLabel: 'Loading MD Code and MD View', loadingStepState: 'running' }]}
      loadingStartedAtMilliseconds={workspaceOpeningStartedAtMilliseconds}
    />
  )
}

// The whole app: the start page until a vault is open, then the workspace.
export function PapelizWebapp() {
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)

  // Papeliz for Windows' native side starts loading at once (in a browser this does nothing). Flows
  // that need it wait for it, so nothing runs before it is there; one that fails to load leaves the
  // browser's own way in place. Once it is there, web links go to the person's browser, and closing
  // the window (its close button, Alt+F4) first saves every note: if one still isn't saved, the window
  // stays open, with the save's own failure showing.
  useEffect(() => {
    let stopSendingExternalLinksToSystemBrowser: (() => void) | null = null
    let stopSavingBeforeDesktopWindowCloses: (() => void) | null = null
    let isPapelizWebappShown = true
    void loadPapelizDesktopPlatformOnce()
      .then((papelizDesktopPlatform) => {
        if (papelizDesktopPlatform === null || !isPapelizWebappShown) return
        stopSendingExternalLinksToSystemBrowser = sendPapelizDesktopExternalLinksToSystemBrowser(papelizDesktopPlatform)
        stopSavingBeforeDesktopWindowCloses = papelizDesktopPlatform.desktopWindow.setDesktopWindowCloseRequestHandler(async () => {
          await usePapelizWorkspaceStore.getState().saveAllVaultNotesNow()
          if (hasUnsavedPapelizVaultNotes()) throw new Error('A note isn’t saved yet, so the window stays open.')
        })
        // A direct download looks for a newer version once, unless that's switched off in Updates.
        const { isDesktopAppUpdateCheckAtStartOn, checkForDesktopAppUpdateNow } = usePapelizDesktopAppUpdateStore.getState()
        if (isDesktopAppUpdateCheckAtStartOn) void checkForDesktopAppUpdateNow(papelizDesktopPlatform)
      })
      .catch(() => null)
    return () => {
      isPapelizWebappShown = false
      stopSendingExternalLinksToSystemBrowser?.()
      stopSavingBeforeDesktopWindowCloses?.()
    }
  }, [])

  useEffect(() => {
    document.title = openVault === null ? 'Papeliz' : `${openVault.papelizVaultDisplayName} · Papeliz`
  }, [openVault])

  useEffect(() => {
    // The browser's own right-click menu is off: Papeliz has its own. Plain text boxes keep it (Paste,
    // spelling), and so does Shift+right-click in a note, which the note editor leaves to the
    // browser for spelling suggestions.
    const blockBrowserContextMenu = (contextMenuEvent: MouseEvent) => {
      const contextMenuTarget = contextMenuEvent.target
      if (contextMenuTarget instanceof Element && contextMenuTarget.closest('input, textarea') !== null) return
      if (contextMenuEvent.shiftKey && contextMenuTarget instanceof Element && contextMenuTarget.closest('[contenteditable="true"]') !== null) return
      contextMenuEvent.preventDefault()
    }
    document.addEventListener('contextmenu', blockBrowserContextMenu)
    return () => document.removeEventListener('contextmenu', blockBrowserContextMenu)
  }, [])

  useEffect(() => {
    // Ask before leaving while a note still has changes on their way to disk.
    const warnAboutUnsavedNotes = (beforeUnloadEvent: BeforeUnloadEvent) => {
      if (!hasUnsavedPapelizVaultNotes()) return
      void usePapelizWorkspaceStore.getState().saveAllVaultNotesNow()
      beforeUnloadEvent.preventDefault()
    }
    // Save as soon as the tab is hidden, so switching away never loses a pending autosave.
    const saveWhenTabHidden = () => {
      if (document.visibilityState === 'hidden') void usePapelizWorkspaceStore.getState().saveAllVaultNotesNow()
    }
    window.addEventListener('beforeunload', warnAboutUnsavedNotes)
    document.addEventListener('visibilitychange', saveWhenTabHidden)
    return () => {
      window.removeEventListener('beforeunload', warnAboutUnsavedNotes)
      document.removeEventListener('visibilitychange', saveWhenTabHidden)
    }
  }, [])

  if (openVault === null) return <PapelizWelcomeScreen />
  return (
    <Suspense fallback={<PapelizWorkspaceOpeningScreen vaultDisplayName={openVault.papelizVaultDisplayName} />}>
      <PapelizWorkspace key={openVault.papelizVaultId} />
    </Suspense>
  )
}
