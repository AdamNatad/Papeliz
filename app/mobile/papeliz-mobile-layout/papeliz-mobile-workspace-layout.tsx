import { ChartNoAxesColumn, FileText, FolderTree, History, Settings, SquarePen, WandSparkles } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePapelizAssistantConversationStore } from '../../web/src/modules/assistant/papeliz-assistant-conversation-store'
import { PapelizAssistantPanel } from '../../web/src/modules/assistant/papeliz-assistant-panel'
import { usePapelizAssistantPanelUiStore } from '../../web/src/modules/assistant/papeliz-assistant-panel-ui-store'
import { PapelizAssistantProposalPreview } from '../../web/src/modules/assistant/papeliz-assistant-proposal-preview'
import type { PapelizMobileWorkspaceLayoutProps } from '../../web/src/modules/mobile/papeliz-mobile-platform-contract'
import { PapelizMark } from '../../web/src/modules/ui/papeliz-mark'
import { getVaultNoteTitle } from '../../web/src/modules/vault/papeliz-vault-relative-paths'
import { PapelizBrowserVaultBackupStatus } from '../../web/src/modules/workspace/papeliz-browser-vault-backup-status'
import { PapelizFileExplorer } from '../../web/src/modules/workspace/papeliz-file-explorer'
import { PapelizFileListThisNoteSection } from '../../web/src/modules/workspace/papeliz-file-list-this-note-section'
import { PapelizNoteArea } from '../../web/src/modules/workspace/papeliz-note-area'
import { PapelizNoteTabsBar } from '../../web/src/modules/workspace/papeliz-note-tabs-bar'
import { usePapelizWorkspaceStore } from '../../web/src/modules/workspace/papeliz-workspace-store'
import { PapelizNoteViewSwitch, type papelizTopbarGiveWayAttributeNames } from '../../web/src/modules/workspace/papeliz-workspace-topbar'
import { usePapelizMobileBackStep, usePapelizMobileModalDialogBackStep } from './papeliz-mobile-back-steps'
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

// The note's MD Code | MD View switch is the web's own (its sliding pill, timing and reduced motion), with
// its words beside the icons. On a phone too narrow for both the words and the whole word Papeliz, the
// words fold away through the web bar's own attribute for that, and each choice keeps its name for
// screen readers. The top bar carries the web bar's group name so the switch reads that attribute.
const papelizMobileTopBarSwitchWordsFoldedAttributeName: (typeof papelizTopbarGiveWayAttributeNames)[number] = 'data-papeliz-topbar-switch-labels-hidden'

function foldPapelizMobileTopBarSwitchWordsWhenTight(mobileTopBarElement: HTMLElement): void {
  mobileTopBarElement.removeAttribute(papelizMobileTopBarSwitchWordsFoldedAttributeName)
  const mobileTopBarTitleElement = mobileTopBarElement.querySelector<HTMLElement>('.papeliz-mobile-top-bar-title')
  if (mobileTopBarTitleElement !== null && mobileTopBarTitleElement.scrollWidth > mobileTopBarTitleElement.clientWidth + 0.5) {
    mobileTopBarElement.setAttribute(papelizMobileTopBarSwitchWordsFoldedAttributeName, '')
  }
}

// A phone app's page doesn't zoom: a pinch would zoom its bars along with the note. The note's own
// text size (Settings, Accessibility) is the way to read larger.
function keepPapelizMobilePageUnzoomed(): void {
  const viewportMetaElement = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  viewportMetaElement?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover')
}

// On the Assistant the panel's own head moves up into the top bar: New Conversation, Sessions and Usage.
// The bottom bar does what its Close did. Sessions and Usage open in place of the page and, pressed
// again or with Back, go back to the conversation, as in the panel.
function PapelizMobileAssistantTopBarButtons() {
  const assistantPanelTab = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.assistantPanelTab)
  const setAssistantPanelTab = usePapelizAssistantPanelUiStore((panelUiState) => panelUiState.setAssistantPanelTab)
  const startNewAssistantChat = usePapelizAssistantConversationStore((conversationState) => conversationState.startNewAssistantChat)
  const toggleAssistantPanelView = (assistantPanelView: 'sessions' | 'usage') => setAssistantPanelTab(assistantPanelTab === assistantPanelView ? 'chat' : assistantPanelView)
  usePapelizMobileBackStep(assistantPanelTab === 'sessions' || assistantPanelTab === 'usage', () => setAssistantPanelTab('chat'))

  return (
    <>
      <button
        type="button"
        className="papeliz-mobile-top-bar-button"
        aria-label="New Conversation"
        onClick={() => {
          startNewAssistantChat()
          setAssistantPanelTab('chat')
        }}
      >
        <SquarePen aria-hidden="true" />
      </button>
      <button type="button" className="papeliz-mobile-top-bar-button" aria-label="Sessions" aria-pressed={assistantPanelTab === 'sessions'} onClick={() => toggleAssistantPanelView('sessions')}>
        <History aria-hidden="true" />
      </button>
      <button type="button" className="papeliz-mobile-top-bar-button" aria-label="Usage" aria-pressed={assistantPanelTab === 'usage'} onClick={() => toggleAssistantPanelView('usage')}>
        <ChartNoAxesColumn aria-hidden="true" />
      </button>
    </>
  )
}

// The Android and iOS app's phone layout, drawn the same on both phones: the blue top bar with the mark,
// Papeliz and where you are under it, one place at a time, and the bottom bar that moves between the
// places. papeliz.com, its phone view included, never loads this file (virtual:papeliz-mobile-platform).
export function PapelizMobileWorkspaceLayout({ noteEditorSessionCache, children }: PapelizMobileWorkspaceLayoutProps) {
  const [chosenMobilePlace, setChosenMobilePlace] = useState<PapelizMobilePlace>('note')
  const openVaultDisplayName = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault?.papelizVaultDisplayName ?? '')
  const activeVaultNoteRelativePath = usePapelizWorkspaceStore((workspaceState) => workspaceState.activeVaultNoteRelativePath)
  const setVaultCloseConfirmationShown = usePapelizWorkspaceStore((workspaceState) => workspaceState.setVaultCloseConfirmationShown)
  const isAssistantProposalPreviewShown = usePapelizWorkspaceStore((workspaceState) => workspaceState.assistantProposalPreview !== null)
  const openBrowserVaultId = usePapelizWorkspaceStore((workspaceState) =>
    workspaceState.openVault?.papelizVaultAdapter.papelizVaultKind === 'browser-vault-in-opfs' ? workspaceState.openVault.papelizVaultId : null,
  )

  useEffect(keepPapelizMobilePageUnzoomed, [])
  // Back from Files, the Assistant or Settings goes to Note; Back on Note leaves the app. An open dialog
  // closes first, wherever it opened.
  usePapelizMobileBackStep(chosenMobilePlace !== 'note', () => setChosenMobilePlace('note'))
  usePapelizMobileModalDialogBackStep()

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
  const isNoteViewSwitchShown = chosenMobilePlace === 'note' && activeVaultNoteRelativePath !== null

  // Measured before the bar is painted, again when its width changes (the phone turned, or the app shown
  // beside another), and once the fonts have loaded, since the words' widths change with them.
  const mobileTopBarRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const mobileTopBarElement = mobileTopBarRef.current
    if (mobileTopBarElement === null || !isNoteViewSwitchShown) return
    foldPapelizMobileTopBarSwitchWordsWhenTight(mobileTopBarElement)
    let measuredMobileTopBarWidth = mobileTopBarElement.clientWidth
    let mobileTopBarRefitFrame = 0
    const mobileTopBarResizeObserver = new ResizeObserver(() => {
      if (mobileTopBarElement.clientWidth === measuredMobileTopBarWidth) return
      measuredMobileTopBarWidth = mobileTopBarElement.clientWidth
      cancelAnimationFrame(mobileTopBarRefitFrame)
      mobileTopBarRefitFrame = requestAnimationFrame(() => foldPapelizMobileTopBarSwitchWordsWhenTight(mobileTopBarElement))
    })
    mobileTopBarResizeObserver.observe(mobileTopBarElement)
    let isMobileTopBarSwitchGone = false
    void document.fonts?.ready.then(() => {
      if (!isMobileTopBarSwitchGone) foldPapelizMobileTopBarSwitchWordsWhenTight(mobileTopBarElement)
    })
    return () => {
      isMobileTopBarSwitchGone = true
      cancelAnimationFrame(mobileTopBarRefitFrame)
      mobileTopBarResizeObserver.disconnect()
    }
  }, [isNoteViewSwitchShown])

  return (
    <div className="papeliz-mobile-workspace">
      <header ref={mobileTopBarRef} className="papeliz-mobile-top-bar group/papeliz-topbar">
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
        {isNoteViewSwitchShown && (
          <>
            <PapelizNoteViewSwitch />
            <PapelizMobileNoteMoreMenu vaultNoteRelativePath={activeVaultNoteRelativePath} onRenameInFileList={() => setChosenMobilePlace('files')} />
          </>
        )}
        {chosenMobilePlace === 'assistant' && <PapelizMobileAssistantTopBarButtons />}
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
        {/* The web's status bar isn't drawn on the phone, but its backup state for a Browser Storage
            vault still runs, unseen: it reads the vault's last backup for Settings, Reminder (which
            shows the same), and shows the backup reminder when one is due. */}
        {openBrowserVaultId !== null && (
          <div className="is-hidden">
            <PapelizBrowserVaultBackupStatus papelizVaultId={openBrowserVaultId} />
          </div>
        )}
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
