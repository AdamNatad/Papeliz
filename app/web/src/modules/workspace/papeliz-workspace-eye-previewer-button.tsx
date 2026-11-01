import {
  Ban,
  BellRing,
  BookOpen,
  Check,
  EyeOff,
  Frame,
  Globe,
  ListX,
  RefreshCw,
  SearchX,
  ShieldOff,
  Trash2,
  CircleAlert,
  Code,
  Eye,
  FileWarning,
  FileX,
  Files,
  FolderLock,
  FolderOpen,
  FolderSearch,
  FolderX,
  Hourglass,
  KeyRound,
  ListChecks,
  Lock,
  LogOut,
  Maximize2,
  MessageSquare,
  PenLine,
  RotateCw,
  Save,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { PapelizPopoverMenu, type PapelizPopoverMenuItem, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import {
  holdPapelizWorkspaceEyePreviewerState,
  returnPapelizWorkspaceEyePreviewerToLive,
  usePapelizWorkspaceEyePreviewerStore,
  type PapelizWorkspaceEyePreviewerState,
} from './papeliz-workspace-eye-previewer'

// Each state's menu row: its group, words and icon.
const papelizWorkspaceEyePreviewerChoices: ReadonlyArray<{
  workspaceEyePreviewerState: PapelizWorkspaceEyePreviewerState
  eyePreviewerChoiceLabel: string
  EyePreviewerChoiceIcon: LucideIcon
  eyePreviewerGroupHeading?: string
}> = [
  {
    workspaceEyePreviewerState: 'start-folder-access-unsupported',
    eyePreviewerChoiceLabel: 'No Folder Access (Firefox, Safari)',
    EyePreviewerChoiceIcon: Globe,
    eyePreviewerGroupHeading: 'Start · Folders',
  },
  { workspaceEyePreviewerState: 'start-folder-access-writes-blocked', eyePreviewerChoiceLabel: 'Folder Saving Blocked', EyePreviewerChoiceIcon: ShieldOff },
  { workspaceEyePreviewerState: 'start-folder-access-chooser-unavailable', eyePreviewerChoiceLabel: 'Folder Window Won’t Open', EyePreviewerChoiceIcon: Frame },
  { workspaceEyePreviewerState: 'start-open-vault-permission-refused', eyePreviewerChoiceLabel: 'Open Vault · Permission Refused', EyePreviewerChoiceIcon: FolderLock },
  { workspaceEyePreviewerState: 'start-open-vault-folder-gone', eyePreviewerChoiceLabel: 'Open Vault · Folder Gone', EyePreviewerChoiceIcon: FolderX },
  { workspaceEyePreviewerState: 'start-recent-vaults-empty', eyePreviewerChoiceLabel: 'No Recent Vaults', EyePreviewerChoiceIcon: FolderOpen, eyePreviewerGroupHeading: 'Start · Recent Vaults' },
  { workspaceEyePreviewerState: 'start-recent-vaults-all-hidden', eyePreviewerChoiceLabel: 'Every Vault Hidden', EyePreviewerChoiceIcon: EyeOff },
  { workspaceEyePreviewerState: 'start-recent-vaults-listed', eyePreviewerChoiceLabel: 'A Few Vaults', EyePreviewerChoiceIcon: Files },
  { workspaceEyePreviewerState: 'start-recent-vaults-many', eyePreviewerChoiceLabel: 'Many Vaults', EyePreviewerChoiceIcon: ListChecks },
  { workspaceEyePreviewerState: 'start-recent-vaults-search-no-match', eyePreviewerChoiceLabel: 'Search Finds Nothing', EyePreviewerChoiceIcon: SearchX },
  { workspaceEyePreviewerState: 'start-recent-vaults-reloading', eyePreviewerChoiceLabel: 'Reloading', EyePreviewerChoiceIcon: RefreshCw },
  { workspaceEyePreviewerState: 'start-hidden-vaults-empty', eyePreviewerChoiceLabel: 'Nothing Hidden', EyePreviewerChoiceIcon: EyeOff, eyePreviewerGroupHeading: 'Start · Hidden Vaults' },
  { workspaceEyePreviewerState: 'start-hidden-vaults-listed', eyePreviewerChoiceLabel: 'Hidden Vaults', EyePreviewerChoiceIcon: EyeOff },
  { workspaceEyePreviewerState: 'start-hidden-vault-delete-one', eyePreviewerChoiceLabel: 'Delete One: Type Its Name', EyePreviewerChoiceIcon: Trash2 },
  { workspaceEyePreviewerState: 'start-hidden-vaults-delete-all', eyePreviewerChoiceLabel: 'Delete All: Type the Count', EyePreviewerChoiceIcon: Trash2 },
  { workspaceEyePreviewerState: 'start-hidden-vaults-deleting', eyePreviewerChoiceLabel: 'Deleting', EyePreviewerChoiceIcon: Hourglass },
  { workspaceEyePreviewerState: 'start-hidden-vault-deleted', eyePreviewerChoiceLabel: 'Deleted', EyePreviewerChoiceIcon: Check },
  { workspaceEyePreviewerState: 'start-hidden-vaults-delete-partly-failed', eyePreviewerChoiceLabel: 'Some Couldn’t Be Deleted', EyePreviewerChoiceIcon: ListX },
  { workspaceEyePreviewerState: 'note-md-code', eyePreviewerChoiceLabel: 'Note Open · MD Code', EyePreviewerChoiceIcon: Code, eyePreviewerGroupHeading: 'Vault · Notes' },
  { workspaceEyePreviewerState: 'note-md-view', eyePreviewerChoiceLabel: 'Note Open · MD View', EyePreviewerChoiceIcon: Eye },
  { workspaceEyePreviewerState: 'note-loading', eyePreviewerChoiceLabel: 'Note Opening', EyePreviewerChoiceIcon: Hourglass },
  { workspaceEyePreviewerState: 'note-load-failed', eyePreviewerChoiceLabel: 'Note Couldn’t Be Opened', EyePreviewerChoiceIcon: FileX },
  { workspaceEyePreviewerState: 'note-unsaved', eyePreviewerChoiceLabel: 'Unsaved Changes', EyePreviewerChoiceIcon: PenLine },
  { workspaceEyePreviewerState: 'note-saving', eyePreviewerChoiceLabel: 'Saving', EyePreviewerChoiceIcon: Save },
  { workspaceEyePreviewerState: 'note-save-failed', eyePreviewerChoiceLabel: 'Not Saved · Try Again', EyePreviewerChoiceIcon: FileWarning },
  { workspaceEyePreviewerState: 'note-locked', eyePreviewerChoiceLabel: 'Note Locked', EyePreviewerChoiceIcon: Lock },
  { workspaceEyePreviewerState: 'note-locked-by-folder', eyePreviewerChoiceLabel: 'Locked with Its Folder', EyePreviewerChoiceIcon: FolderLock },
  { workspaceEyePreviewerState: 'no-note-open', eyePreviewerChoiceLabel: 'No Note Open', EyePreviewerChoiceIcon: BookOpen },
  { workspaceEyePreviewerState: 'many-notes-open', eyePreviewerChoiceLabel: 'Many Notes Open', EyePreviewerChoiceIcon: Files },
  { workspaceEyePreviewerState: 'file-list-reading', eyePreviewerChoiceLabel: 'Reading the Folder', EyePreviewerChoiceIcon: FolderSearch, eyePreviewerGroupHeading: 'Vault · File List' },
  { workspaceEyePreviewerState: 'file-list-failed', eyePreviewerChoiceLabel: 'Notes Couldn’t Be Listed', EyePreviewerChoiceIcon: FolderX },
  { workspaceEyePreviewerState: 'vault-empty', eyePreviewerChoiceLabel: 'Empty Vault', EyePreviewerChoiceIcon: FolderOpen },
  { workspaceEyePreviewerState: 'assistant-not-set-up', eyePreviewerChoiceLabel: 'Not Set Up', EyePreviewerChoiceIcon: KeyRound, eyePreviewerGroupHeading: 'Vault · Assistant' },
  { workspaceEyePreviewerState: 'assistant-ready', eyePreviewerChoiceLabel: 'Ready, No Chat Yet', EyePreviewerChoiceIcon: Sparkles },
  { workspaceEyePreviewerState: 'assistant-answered', eyePreviewerChoiceLabel: 'Answer, with Notes It Read', EyePreviewerChoiceIcon: MessageSquare },
  { workspaceEyePreviewerState: 'assistant-writing', eyePreviewerChoiceLabel: 'Writing an Answer', EyePreviewerChoiceIcon: RotateCw },
  { workspaceEyePreviewerState: 'assistant-changes-waiting', eyePreviewerChoiceLabel: 'Changes Waiting', EyePreviewerChoiceIcon: ListChecks },
  { workspaceEyePreviewerState: 'assistant-provider-error', eyePreviewerChoiceLabel: 'Provider Refused the Key', EyePreviewerChoiceIcon: Ban },
  { workspaceEyePreviewerState: 'toast-info', eyePreviewerChoiceLabel: 'Info Toast', EyePreviewerChoiceIcon: BellRing, eyePreviewerGroupHeading: 'Vault · Toasts' },
  { workspaceEyePreviewerState: 'toast-error', eyePreviewerChoiceLabel: 'Error Toast', EyePreviewerChoiceIcon: CircleAlert },
  { workspaceEyePreviewerState: 'toast-error-try-again', eyePreviewerChoiceLabel: 'Error Toast · Try Again', EyePreviewerChoiceIcon: RotateCw },
  { workspaceEyePreviewerState: 'focus-mode', eyePreviewerChoiceLabel: 'Focus Mode', EyePreviewerChoiceIcon: Maximize2, eyePreviewerGroupHeading: 'Vault · Window' },
  { workspaceEyePreviewerState: 'close-vault-question', eyePreviewerChoiceLabel: 'Close Vault Question', EyePreviewerChoiceIcon: LogOut },
]

const papelizWorkspaceEyePreviewerMenuWidth = 268

// The eye button: a small dark square in the start screen's Recent Vaults heading and in a vault's
// file list header, development builds only. Its menu holds Live and every state, the start
// screen's first; a dot on the button says a preview is held.
export function PapelizWorkspaceEyePreviewerButton() {
  const heldWorkspaceEyePreviewerState = usePapelizWorkspaceEyePreviewerStore((eyePreviewerState) => eyePreviewerState.heldWorkspaceEyePreviewerState)
  const [eyePreviewerMenuPosition, setEyePreviewerMenuPosition] = useState<PapelizPopoverMenuPosition | null>(null)

  const eyePreviewerMenuItems: PapelizPopoverMenuItem[] = [
    {
      menuItemKey: 'live',
      menuItemLabel: 'Live',
      MenuItemIcon: Eye,
      isMenuItemChecked: heldWorkspaceEyePreviewerState === null,
      onMenuItemSelect: () => void returnPapelizWorkspaceEyePreviewerToLive(),
    },
    ...papelizWorkspaceEyePreviewerChoices.map(
      (eyePreviewerChoice): PapelizPopoverMenuItem => ({
        menuItemKey: eyePreviewerChoice.workspaceEyePreviewerState,
        menuItemLabel: eyePreviewerChoice.eyePreviewerChoiceLabel,
        MenuItemIcon: eyePreviewerChoice.EyePreviewerChoiceIcon,
        menuItemGroupHeading: eyePreviewerChoice.eyePreviewerGroupHeading,
        isMenuItemChecked: heldWorkspaceEyePreviewerState === eyePreviewerChoice.workspaceEyePreviewerState,
        onMenuItemSelect: () => void holdPapelizWorkspaceEyePreviewerState(eyePreviewerChoice.workspaceEyePreviewerState),
      }),
    ),
  ]

  return (
    <>
      <button
        type="button"
        aria-label="Preview app states"
        title="Preview app states (development builds only)"
        aria-haspopup="menu"
        aria-expanded={eyePreviewerMenuPosition !== null}
        data-papeliz-workspace-eye-previewer-state={heldWorkspaceEyePreviewerState ?? 'live'}
        onClick={(clickEvent) => {
          const eyePreviewerButtonRect = clickEvent.currentTarget.getBoundingClientRect()
          setEyePreviewerMenuPosition({
            menuAnchorLeft: eyePreviewerButtonRect.right - papelizWorkspaceEyePreviewerMenuWidth,
            menuAnchorTop: eyePreviewerButtonRect.bottom + 6,
          })
        }}
        className="relative grid size-7 flex-none place-items-center rounded-md border border-[#0A2552] bg-[#0E3270] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14)] transition-[background-color,transform] duration-150 hover:bg-[#123C85] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-blue active:scale-[0.94]"
      >
        <Eye className="size-[15px]" aria-hidden="true" />
        {heldWorkspaceEyePreviewerState !== null && (
          <span aria-hidden="true" className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-papeliz-surface bg-[#F2B53A]" />
        )}
      </button>
      {eyePreviewerMenuPosition !== null && (
        <PapelizPopoverMenu
          menuLabel="Preview app states"
          menuPosition={eyePreviewerMenuPosition}
          menuItems={eyePreviewerMenuItems}
          onMenuClose={() => setEyePreviewerMenuPosition(null)}
        />
      )}
    </>
  )
}
