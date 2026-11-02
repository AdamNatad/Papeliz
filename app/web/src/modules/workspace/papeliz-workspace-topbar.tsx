import { Code, Eye, Minimize2, WandSparkles } from 'lucide-react'
import { isPapelizDesktopApp } from 'virtual:papeliz-desktop-platform-availability'
import { PapelizDesktopWindowControls, usePapelizDesktopWindowBarDragHandlers } from '../desktop/papeliz-desktop-window-controls'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizFileListToggleIcon } from '../ui/papeliz-file-list-toggle-icon'
import { PapelizMark } from '../ui/papeliz-mark'
import { usePapelizKeyBindingShortcutLabel } from './papeliz-key-bindings-store'
import { PapelizSettingsGearButton } from './papeliz-settings-gear-button'
import { PapelizTopbarExportButton } from './papeliz-topbar-export-button'
import { PapelizTopbarFrostedSquareButton } from './papeliz-topbar-frosted-square-button'
import { selectIsVaultTextFileTabInFront, selectShownNoteViewMode, usePapelizWorkspaceStore, type PapelizNoteViewMode } from './papeliz-workspace-store'

const papelizNoteViewChoices = [
  { noteViewMode: 'md-code', noteViewLabel: 'MD Code', NoteViewIcon: Code },
  { noteViewMode: 'md-view', noteViewLabel: 'MD View', NoteViewIcon: Eye },
] as const satisfies ReadonlyArray<{ noteViewMode: PapelizNoteViewMode; noteViewLabel: string; NoteViewIcon: typeof Code }>

// The MD Code | MD View switch, centered in the topbar. The white pill's two edges ease on their
// own, the leading edge first, so it stretches toward the new view and then settles; pressing the
// other view leans it that way before the click lands. The motion lives in papeliz-webapp.css
// (.papeliz-note-view-switch).
// A text file (JSON, `.gitignore`, a script) has only MD Code: while one is in front the switch shows
// MD Code and MD View is greyed out, and the view picked for notes comes back on a note's tab.
function PapelizNoteViewSwitch() {
  const shownNoteViewMode = usePapelizWorkspaceStore(selectShownNoteViewMode)
  const isVaultTextFileTabInFront = usePapelizWorkspaceStore(selectIsVaultTextFileTabInFront)
  const setNoteViewMode = usePapelizWorkspaceStore((workspaceState) => workspaceState.setNoteViewMode)
  const noteViewSwitchShortcutLabel = usePapelizKeyBindingShortcutLabel('note-view-switch')
  return (
    <div role="group" aria-label="Note view" className="papeliz-note-view-switch" data-papeliz-chosen-note-view={shownNoteViewMode}>
      <span aria-hidden="true" className="papeliz-note-view-switch-pill" />
      {papelizNoteViewChoices.map(({ noteViewMode: choiceNoteViewMode, noteViewLabel, NoteViewIcon }) => (
        <button
          key={choiceNoteViewMode}
          type="button"
          aria-pressed={shownNoteViewMode === choiceNoteViewMode}
          aria-disabled={isVaultTextFileTabInFront && choiceNoteViewMode === 'md-view' ? true : undefined}
          aria-label={noteViewLabel}
          title={
            isVaultTextFileTabInFront && choiceNoteViewMode === 'md-view'
              ? 'MD View is for notes. This file opens in MD Code only.'
              : `${noteViewLabel} (${noteViewSwitchShortcutLabel} switches)`
          }
          onClick={() => {
            if (!(isVaultTextFileTabInFront && choiceNoteViewMode === 'md-view')) setNoteViewMode(choiceNoteViewMode)
          }}
          className="papeliz-note-view-switch-option"
        >
          <NoteViewIcon className="size-[14px]" aria-hidden="true" />
          <span className="max-sm:sr-only">{noteViewLabel}</span>
        </button>
      ))}
    </div>
  )
}

// The blue bar across the top of the workspace: the file list toggle, Papeliz and the vault's name
// on the left, the view switch in the middle, and on the right the Assistant panel, Export and the
// Settings gear (in focus mode Exit focus takes the Assistant's place; the gear stays at the edge). The mark
// and Papeliz are only a name: pressing them does nothing (the gear's Close Vault closes the vault).
// Its two sides share the leftover width equally, so the switch stays centered in the window. Below md the left side never gets narrower than the
// toggle, the mark and the name, so on the narrowest phones the switch sits a few pixels right of
// center rather than crowding the name.
export function PapelizWorkspaceTopbar() {
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)
  const isExplorerPanelOpen = usePapelizWorkspaceStore((workspaceState) => workspaceState.isExplorerPanelOpen)
  const isAssistantPanelOpen = usePapelizWorkspaceStore((workspaceState) => workspaceState.isAssistantPanelOpen)
  const isFocusModeOn = usePapelizWorkspaceStore((workspaceState) => workspaceState.isFocusModeOn)
  const setExplorerPanelOpen = usePapelizWorkspaceStore((workspaceState) => workspaceState.setExplorerPanelOpen)
  const setAssistantPanelOpen = usePapelizWorkspaceStore((workspaceState) => workspaceState.setAssistantPanelOpen)
  const setFocusModeOn = usePapelizWorkspaceStore((workspaceState) => workspaceState.setFocusModeOn)
  const desktopWindowBarDragHandlers = usePapelizDesktopWindowBarDragHandlers()

  return (
    <header
      {...desktopWindowBarDragHandlers}
      className={joinPapelizClassNames(
        'grid h-12 flex-none grid-cols-[1fr_auto_1fr] items-center gap-1 bg-papeliz-topbar pl-2 text-white sm:gap-2 sm:pl-3',
        // In Papeliz for Windows the window buttons end the bar, flush with the window's edge.
        isPapelizDesktopApp ? 'pr-0' : 'pr-2 sm:pr-3',
      )}
    >
      <div className="flex min-w-0 items-center gap-1 max-md:min-w-max max-sm:pr-1 sm:gap-1.5">
        {!isFocusModeOn && (
          <PapelizIconButton
            iconButtonLabel={isExplorerPanelOpen ? 'Hide the File List' : 'Show the File List'}
            iconButtonTone="topbar"
            onClick={() => setExplorerPanelOpen(!isExplorerPanelOpen)}
          >
            <PapelizFileListToggleIcon isFileListOpen={isExplorerPanelOpen} className="size-[18px]" />
          </PapelizIconButton>
        )}
        <div className="flex flex-none items-center gap-1 px-1 py-1 select-none sm:gap-1.5">
          <PapelizMark papelizMarkSize={26} papelizMarkTone="on-blue" className="flex-none sm:ml-0.5" />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Papeliz</span>
        </div>
        {openVault !== null && (
          <span className="min-w-0 truncate text-sm text-white/95 max-md:hidden">
            <span className="mx-1 text-white/60" aria-hidden="true">
              /
            </span>
            {openVault.papelizVaultDisplayName}
          </span>
        )}
      </div>

      <PapelizNoteViewSwitch />

      <div className="flex min-w-0 items-center justify-end gap-1.5">
        {isFocusModeOn ? (
          <PapelizPillButton pillButtonVariant="on-topbar" pillButtonSize="small" className="mr-1" onClick={() => setFocusModeOn(false)} title="Exit Focus (Esc)">
            <Minimize2 className="size-[14px]" aria-hidden="true" />
            <span className="max-sm:sr-only">Exit Focus</span>
          </PapelizPillButton>
        ) : (
          <PapelizTopbarFrostedSquareButton
            topbarFrostedSquareButtonLabel="AI Assistant"
            aria-pressed={isAssistantPanelOpen}
            onClick={() => setAssistantPanelOpen(!isAssistantPanelOpen)}
          >
            <WandSparkles className="size-[17px]" aria-hidden="true" />
          </PapelizTopbarFrostedSquareButton>
        )}
        <PapelizTopbarExportButton />
        <PapelizSettingsGearButton settingsGearPlace="workspace" />
        <PapelizDesktopWindowControls />
      </div>
    </header>
  )
}
