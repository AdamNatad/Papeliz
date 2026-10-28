import { lazy, Suspense, useEffect } from 'react'
import { PapelizWelcomeScreen } from './modules/workspace/papeliz-welcome-screen'
import { hasUnsavedPapelizVaultNotes, usePapelizWorkspaceStore } from './modules/workspace/papeliz-workspace-store'

// The workspace (MD Code, MD View and their parsers) loads only once a vault opens, so the
// start page stays small.
const PapelizWorkspace = lazy(() =>
  import('./modules/workspace/papeliz-workspace').then((workspaceModule) => ({ default: workspaceModule.PapelizWorkspace })),
)

// The whole app: the start page until a vault is open, then the workspace.
export function PapelizWebapp() {
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)

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
    <Suspense fallback={<p className="grid h-dvh place-items-center text-papeliz-ink-subtle">Opening {openVault.papelizVaultDisplayName}…</p>}>
      <PapelizWorkspace key={openVault.papelizVaultId} />
    </Suspense>
  )
}
