import { Code, Eye, FileText, FolderTree, Settings, WandSparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PapelizAssistantPanel } from '../../web/src/modules/assistant/papeliz-assistant-panel'
import { PapelizAssistantProposalPreview } from '../../web/src/modules/assistant/papeliz-assistant-proposal-preview'
import type { PapelizMobileWorkspaceLayoutProps } from '../../web/src/modules/mobile/papeliz-mobile-platform-contract'
import { PapelizMark } from '../../web/src/modules/ui/papeliz-mark'
import { getVaultNoteTitle } from '../../web/src/modules/vault/papeliz-vault-relative-paths'
import { PapelizFileExplorer } from '../../web/src/modules/workspace/papeliz-file-explorer'
import { PapelizFileListThisNoteSection } from '../../web/src/modules/workspace/papeliz-file-list-this-note-section'
import { PapelizNoteArea } from '../../web/src/modules/workspace/papeliz-note-area'
import { PapelizNoteTabsBar } from '../../web/src/modules/workspace/papeliz-note-tabs-bar'
import { selectShownNoteViewMode, usePapelizWorkspaceStore } from '../../web/src/modules/workspace/papeliz-workspace-store'
import { usePapelizMobileBackStep } from './papeliz-mobile-back-steps'
import { PapelizMobileNoteMoreMenu } from './papeliz-mobile-note-more-menu'
import { PapelizMobileSettingsPlace } from './papeliz-mobile-settings-place'
import './papeliz-mobile-workspace-layout.css'

// The four places along the bottom bar, in its order.
type PapelizMobilePlace = 'files' | 'note' | 'assistant' | 'settings'

const papelizMobileBottomBarPlaces: ReadonlyArray<{ mobilePlace: PapelizMobilePlace; mobilePlaceLabel: string; MobilePlaceIcon: typeof FileText }> = [
  { mobilePlace: 'files', mobilePlaceLabel: 'Files', MobilePlaceIcon: FolderTree },
  { mobilePlace: 'note', mobilePlaceLabel: 'Note', MobilePlaceIcon: FileText },
  { mobilePlace: 'assistant', mobilePlaceLabel: 'Assistant', MobilePlaceIcon: WandSparkles },
  { mobilePlace: 'settings', mobilePlaceLabel: 'Settings', MobilePlaceIcon: Settings },
]

// A phone app's page doesn't zoom: a pinch would zoom its bars along with the note. The note's own
// text size (Settings, Accessibility) is the way to read larger.
function keepPapelizMobilePageUnzoomed(): void {
  const viewportMetaElement = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  viewportMetaElement?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover')
}

// The Android and iOS app's phone layout, drawn the same on both phones: the blue top bar with the mark,
// Papeliz and where you are under it, one place at a time, and the bottom bar that moves between the
// places. papeliz.com, its phone view included, never loads this file (virtual:papeliz-mobile-platform).
export function PapelizMobileWorkspaceLayout({ noteEditorSessionCache, children }: PapelizMobileWorkspaceLayoutProps) {
  const [chosenMobilePlace, setChosenMobilePlace] = useState<PapelizMobilePlace>('note')
  const openVaultDisplayName = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault?.papelizVaultDisplayName ?? '')
  const activeVaultNoteRelativePath = usePapelizWorkspaceStore((workspaceState) => workspaceState.activeVaultNoteRelativePath)
  const shownNoteViewMode = usePapelizWorkspaceStore(selectShownNoteViewMode)
  const setNoteViewMode = usePapelizWorkspaceStore((workspaceState) => workspaceState.setNoteViewMode)
  const setVaultCloseConfirmationShown = usePapelizWorkspaceStore((workspaceState) => workspaceState.setVaultCloseConfirmationShown)
  const isAssistantProposalPreviewShown = usePapelizWorkspaceStore((workspaceState) => workspaceState.assistantProposalPreview !== null)

  useEffect(keepPapelizMobilePageUnzoomed, [])
  // Back from Files, the Assistant or Settings goes to Note; Back on Note leaves the app.
  usePapelizMobileBackStep(chosenMobilePlace !== 'note', () => setChosenMobilePlace('note'))

  // What the rest of the app asks for leads to its place: a note opened (from the file list, a link or
  // the Assistant) shows on Note, and the app's own requests to open the file list or the Assistant
  // panel open those places instead.
  useEffect(
    () =>
      usePapelizWorkspaceStore.subscribe((workspaceState, earlierWorkspaceState) => {
        if (workspaceState.activeVaultNoteRelativePath !== earlierWorkspaceState.activeVaultNoteRelativePath && workspaceState.activeVaultNoteRelativePath !== null) {
          setChosenMobilePlace('note')
        }
        if (workspaceState.isAssistantPanelOpen && !earlierWorkspaceState.isAssistantPanelOpen) setChosenMobilePlace('assistant')
        if (workspaceState.isExplorerPanelOpen && !earlierWorkspaceState.isExplorerPanelOpen) setChosenMobilePlace('files')
        if (workspaceState.assistantProposalPreview !== null && earlierWorkspaceState.assistantProposalPreview === null) setChosenMobilePlace('note')
      }),
    [],
  )

  const mobileTopBarSubtitle = chosenMobilePlace === 'note' && activeVaultNoteRelativePath !== null ? getVaultNoteTitle(activeVaultNoteRelativePath) : openVaultDisplayName

  return (
    <div className="papeliz-mobile-workspace">
      <header className="papeliz-mobile-top-bar">
        <PapelizMark papelizMarkSize={30} papelizMarkTone="on-blue" />
        {chosenMobilePlace === 'files' ? (
          // On Files the vault's name is the way back to the start screen, through Close Vault.
          <button type="button" className="papeliz-mobile-top-bar-title" onClick={() => setVaultCloseConfirmationShown(true)} aria-label={`Close ${openVaultDisplayName}`}>
            <b>Papeliz</b>
            <small>{mobileTopBarSubtitle}</small>
          </button>
        ) : (
          <span className="papeliz-mobile-top-bar-title">
            <b>Papeliz</b>
            <small>{mobileTopBarSubtitle}</small>
          </span>
        )}
        {chosenMobilePlace === 'note' && activeVaultNoteRelativePath !== null && (
          <>
            <span role="group" aria-label="Note view" className="papeliz-mobile-note-view-switch">
              <button type="button" aria-label="MD Code" aria-pressed={shownNoteViewMode === 'md-code'} onClick={() => setNoteViewMode('md-code')}>
                <Code aria-hidden="true" />
              </button>
              <button type="button" aria-label="MD View" aria-pressed={shownNoteViewMode === 'md-view'} onClick={() => setNoteViewMode('md-view')}>
                <Eye aria-hidden="true" />
              </button>
            </span>
            <PapelizMobileNoteMoreMenu vaultNoteRelativePath={activeVaultNoteRelativePath} onRenameInFileList={() => setChosenMobilePlace('files')} />
          </>
        )}
      </header>

      <main className="papeliz-mobile-place">
        {chosenMobilePlace === 'files' && (
          <div className="papeliz-mobile-files-place">
            <PapelizFileExplorer fileListFootSection={<PapelizFileListThisNoteSection noteEditorSessionCache={noteEditorSessionCache} />} />
          </div>
        )}
        {/* The note stays mounted while another place shows, so its editor keeps the caret and undo. */}
        <div className={chosenMobilePlace === 'note' ? 'papeliz-mobile-note-place' : 'papeliz-mobile-note-place is-hidden'}>
          <PapelizNoteTabsBar />
          {isAssistantProposalPreviewShown && <PapelizAssistantProposalPreview />}
          <div className={isAssistantProposalPreviewShown ? 'is-hidden' : 'papeliz-mobile-note-area'}>
            <PapelizNoteArea noteEditorSessionCache={noteEditorSessionCache} />
          </div>
        </div>
        {chosenMobilePlace === 'assistant' && (
          <div className="papeliz-mobile-assistant-place">
            <PapelizAssistantPanel onAssistantPanelClose={() => setChosenMobilePlace('note')} />
          </div>
        )}
        {chosenMobilePlace === 'settings' && <PapelizMobileSettingsPlace />}
      </main>

      <nav className="papeliz-mobile-bottom-bar" aria-label="Places">
        {papelizMobileBottomBarPlaces.map(({ mobilePlace, mobilePlaceLabel, MobilePlaceIcon }) => (
          <button
            key={mobilePlace}
            type="button"
            className="papeliz-mobile-bottom-bar-item"
            aria-current={chosenMobilePlace === mobilePlace ? 'page' : undefined}
            onClick={() => setChosenMobilePlace(mobilePlace)}
          >
            <span className="papeliz-mobile-bottom-bar-icon">
              <MobilePlaceIcon aria-hidden="true" />
            </span>
            {mobilePlaceLabel}
          </button>
        ))}
      </nav>

      {children}
    </div>
  )
}
