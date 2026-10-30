import { Code, Eye, Minimize2, WandSparkles } from 'lucide-react'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
import { PapelizFileListToggleIcon } from '../ui/papeliz-file-list-toggle-icon'
import { PapelizMark } from '../ui/papeliz-mark'
import { usePapelizKeyBindingShortcutLabel } from './papeliz-key-bindings-store'
import { PapelizSettingsGearButton } from './papeliz-settings-gear-button'
import { usePapelizWorkspaceStore, type PapelizNoteViewMode } from './papeliz-workspace-store'

const papelizNoteViewChoices = [
  { noteViewMode: 'md-code', noteViewLabel: 'MD Code', NoteViewIcon: Code },
  { noteViewMode: 'md-view', noteViewLabel: 'MD View', NoteViewIcon: Eye },
] as const satisfies ReadonlyArray<{ noteViewMode: PapelizNoteViewMode; noteViewLabel: string; NoteViewIcon: typeof Code }>

// The MD Code | MD View switch, centered in the topbar. The white pill's two edges ease on their
// own, the leading edge first, so it stretches toward the new view and then settles; pressing the
// other view leans it that way before the click lands. The motion lives in papeliz-webapp.css
// (.papeliz-note-view-switch).
function PapelizNoteViewSwitch() {
  const noteViewMode = usePapelizWorkspaceStore((workspaceState) => workspaceState.noteViewMode)
  const setNoteViewMode = usePapelizWorkspaceStore((workspaceState) => workspaceState.setNoteViewMode)
  const noteViewSwitchShortcutLabel = usePapelizKeyBindingShortcutLabel('note-view-switch')
  return (
    <div role="group" aria-label="Note view" className="papeliz-note-view-switch" data-papeliz-chosen-note-view={noteViewMode}>
      <span aria-hidden="true" className="papeliz-note-view-switch-pill" />
      {papelizNoteViewChoices.map(({ noteViewMode: choiceNoteViewMode, noteViewLabel, NoteViewIcon }) => (
        <button
          key={choiceNoteViewMode}
          type="button"
          aria-pressed={noteViewMode === choiceNoteViewMode}
          aria-label={noteViewLabel}
          title={`${noteViewLabel} (${noteViewSwitchShortcutLabel} switches)`}
          onClick={() => setNoteViewMode(choiceNoteViewMode)}
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
// on the left, the view switch in the middle, the Assistant panel and then the Settings gear on the
// right (in focus mode Exit focus takes the Assistant's place; the gear stays at the edge). Closing
// the vault lives in the gear. Its two sides share the leftover width equally,
// so the switch stays centered in the window. Below md the left side never gets narrower than the
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

  return (
    <header className="grid h-12 flex-none grid-cols-[1fr_auto_1fr] items-center gap-1 bg-papeliz-topbar px-2 text-white sm:gap-2 sm:px-3">
      <div className="flex min-w-0 items-center gap-1 max-md:min-w-max max-sm:pr-1 sm:gap-1.5">
        {!isFocusModeOn && (
          <PapelizIconButton
            iconButtonLabel={isExplorerPanelOpen ? 'Hide the file list' : 'Show the file list'}
            iconButtonTone="topbar"
            onClick={() => setExplorerPanelOpen(!isExplorerPanelOpen)}
          >
            <PapelizFileListToggleIcon isFileListOpen={isExplorerPanelOpen} className="size-[18px]" />
          </PapelizIconButton>
        )}
        <PapelizMark papelizMarkSize={26} papelizMarkTone="on-blue" className="flex-none sm:ml-1" />
        <span className="text-[15px] font-semibold tracking-[-0.01em]">Papeliz</span>
        {openVault !== null && (
          <span className="min-w-0 truncate text-sm text-white/80 max-md:hidden">
            <span className="mx-1.5 text-white/50" aria-hidden="true">
              /
            </span>
            {openVault.papelizVaultDisplayName}
          </span>
        )}
      </div>

      <PapelizNoteViewSwitch />

      <div className="flex min-w-0 items-center justify-end gap-0.5">
        {isFocusModeOn ? (
          <PapelizPillButton pillButtonVariant="on-topbar" pillButtonSize="small" className="mr-1" onClick={() => setFocusModeOn(false)} title="Exit focus (Esc)">
            <Minimize2 className="size-[14px]" aria-hidden="true" />
            <span className="max-sm:sr-only">Exit focus</span>
          </PapelizPillButton>
        ) : (
          <PapelizIconButton
            iconButtonLabel="AI Assistant"
            iconButtonTone="topbar"
            aria-pressed={isAssistantPanelOpen}
            onClick={() => setAssistantPanelOpen(!isAssistantPanelOpen)}
          >
            <WandSparkles className="size-[18px]" aria-hidden="true" />
          </PapelizIconButton>
        )}
        <PapelizSettingsGearButton settingsGearPlace="workspace" />
      </div>
    </header>
  )
}
