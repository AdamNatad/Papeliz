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
    eyePreviewerChoiceLabel: 'No folder access (Firefox, Safari)',
    EyePreviewerChoiceIcon: Globe,
    eyePreviewerGroupHeading: 'Start · Folders',
  },
  { workspaceEyePreviewerState: 'start-folder-access-writes-blocked', eyePreviewerChoiceLabel: 'Folder saving blocked', EyePreviewerChoiceIcon: ShieldOff },
  { workspaceEyePreviewerState: 'start-folder-access-chooser-unavailable', eyePreviewerChoiceLabel: 'Folder window won’t open', EyePreviewerChoiceIcon: Frame },
  { workspaceEyePreviewerState: 'start-open-vault-permission-refused', eyePreviewerChoiceLabel: 'Open Vault · permission refused', EyePreviewerChoiceIcon: FolderLock },
  { workspaceEyePreviewerState: 'start-open-vault-folder-gone', eyePreviewerChoiceLabel: 'Open Vault · folder gone', EyePreviewerChoiceIcon: FolderX },
  { workspaceEyePreviewerState: 'start-recent-vaults-empty', eyePreviewerChoiceLabel: 'No recent vaults', EyePreviewerChoiceIcon: FolderOpen, eyePreviewerGroupHeading: 'Start · Recent Vaults' },
  { workspaceEyePreviewerState: 'start-recent-vaults-listed', eyePreviewerChoiceLabel: 'A few vaults', EyePreviewerChoiceIcon: Files },
  { workspaceEyePreviewerState: 'start-recent-vaults-many', eyePreviewerChoiceLabel: 'Many vaults', EyePreviewerChoiceIcon: ListChecks },
  { workspaceEyePreviewerState: 'start-recent-vaults-search-no-match', eyePreviewerChoiceLabel: 'Search finds nothing', EyePreviewerChoiceIcon: SearchX },
  { workspaceEyePreviewerState: 'start-recent-vaults-reloading', eyePreviewerChoiceLabel: 'Reloading', EyePreviewerChoiceIcon: RefreshCw },
  { workspaceEyePreviewerState: 'start-hidden-vaults-empty', eyePreviewerChoiceLabel: 'Nothing hidden', EyePreviewerChoiceIcon: EyeOff, eyePreviewerGroupHeading: 'Start · Hidden Vaults' },
  { workspaceEyePreviewerState: 'start-hidden-vaults-listed', eyePreviewerChoiceLabel: 'Hidden vaults', EyePreviewerChoiceIcon: EyeOff },
  { workspaceEyePreviewerState: 'start-hidden-vault-delete-one', eyePreviewerChoiceLabel: 'Delete one: type its name', EyePreviewerChoiceIcon: Trash2 },
  { workspaceEyePreviewerState: 'start-hidden-vaults-delete-all', eyePreviewerChoiceLabel: 'Delete All: type the count', EyePreviewerChoiceIcon: Trash2 },
  { workspaceEyePreviewerState: 'start-hidden-vaults-deleting', eyePreviewerChoiceLabel: 'Deleting', EyePreviewerChoiceIcon: Hourglass },
  { workspaceEyePreviewerState: 'start-hidden-vault-deleted', eyePreviewerChoiceLabel: 'Deleted', EyePreviewerChoiceIcon: Check },
  { workspaceEyePreviewerState: 'start-hidden-vaults-delete-partly-failed', eyePreviewerChoiceLabel: 'Some couldn’t be deleted', EyePreviewerChoiceIcon: ListX },
  { workspaceEyePreviewerState: 'note-md-code', eyePreviewerChoiceLabel: 'Note open · MD Code', EyePreviewerChoiceIcon: Code, eyePreviewerGroupHeading: 'Vault · Notes' },
  { workspaceEyePreviewerState: 'note-md-view', eyePreviewerChoiceLabel: 'Note open · MD View', EyePreviewerChoiceIcon: Eye },
  { workspaceEyePreviewerState: 'note-loading', eyePreviewerChoiceLabel: 'Note opening', EyePreviewerChoiceIcon: Hourglass },
  { workspaceEyePreviewerState: 'note-load-failed', eyePreviewerChoiceLabel: 'Note couldn’t be opened', EyePreviewerChoiceIcon: FileX },
  { workspaceEyePreviewerState: 'note-unsaved', eyePreviewerChoiceLabel: 'Unsaved changes', EyePreviewerChoiceIcon: PenLine },
  { workspaceEyePreviewerState: 'note-saving', eyePreviewerChoiceLabel: 'Saving', EyePreviewerChoiceIcon: Save },
  { workspaceEyePreviewerState: 'note-save-failed', eyePreviewerChoiceLabel: 'Not saved · Try again', EyePreviewerChoiceIcon: FileWarning },
  { workspaceEyePreviewerState: 'note-locked', eyePreviewerChoiceLabel: 'Note locked', EyePreviewerChoiceIcon: Lock },
  { workspaceEyePreviewerState: 'note-locked-by-folder', eyePreviewerChoiceLabel: 'Locked with its folder', EyePreviewerChoiceIcon: FolderLock },
  { workspaceEyePreviewerState: 'no-note-open', eyePreviewerChoiceLabel: 'No note open', EyePreviewerChoiceIcon: BookOpen },
  { workspaceEyePreviewerState: 'many-notes-open', eyePreviewerChoiceLabel: 'Many notes open', EyePreviewerChoiceIcon: Files },
  { workspaceEyePreviewerState: 'file-list-reading', eyePreviewerChoiceLabel: 'Reading the folder', EyePreviewerChoiceIcon: FolderSearch, eyePreviewerGroupHeading: 'Vault · File list' },
  { workspaceEyePreviewerState: 'file-list-failed', eyePreviewerChoiceLabel: 'Notes couldn’t be listed', EyePreviewerChoiceIcon: FolderX },
  { workspaceEyePreviewerState: 'vault-empty', eyePreviewerChoiceLabel: 'Empty vault', EyePreviewerChoiceIcon: FolderOpen },
  { workspaceEyePreviewerState: 'assistant-not-set-up', eyePreviewerChoiceLabel: 'Not set up', EyePreviewerChoiceIcon: KeyRound, eyePreviewerGroupHeading: 'Vault · Assistant' },
  { workspaceEyePreviewerState: 'assistant-ready', eyePreviewerChoiceLabel: 'Ready, no chat yet', EyePreviewerChoiceIcon: Sparkles },
  { workspaceEyePreviewerState: 'assistant-answered', eyePreviewerChoiceLabel: 'Answer, with notes it read', EyePreviewerChoiceIcon: MessageSquare },
  { workspaceEyePreviewerState: 'assistant-writing', eyePreviewerChoiceLabel: 'Writing an answer', EyePreviewerChoiceIcon: RotateCw },
  { workspaceEyePreviewerState: 'assistant-changes-waiting', eyePreviewerChoiceLabel: 'Changes waiting', EyePreviewerChoiceIcon: ListChecks },
  { workspaceEyePreviewerState: 'assistant-provider-error', eyePreviewerChoiceLabel: 'Provider refused the key', EyePreviewerChoiceIcon: Ban },
  { workspaceEyePreviewerState: 'toast-info', eyePreviewerChoiceLabel: 'Info toast', EyePreviewerChoiceIcon: BellRing, eyePreviewerGroupHeading: 'Vault · Toasts' },
  { workspaceEyePreviewerState: 'toast-error', eyePreviewerChoiceLabel: 'Error toast', EyePreviewerChoiceIcon: CircleAlert },
  { workspaceEyePreviewerState: 'toast-error-try-again', eyePreviewerChoiceLabel: 'Error toast · Try again', EyePreviewerChoiceIcon: RotateCw },
  { workspaceEyePreviewerState: 'focus-mode', eyePreviewerChoiceLabel: 'Focus mode', EyePreviewerChoiceIcon: Maximize2, eyePreviewerGroupHeading: 'Vault · Window' },
  { workspaceEyePreviewerState: 'close-vault-question', eyePreviewerChoiceLabel: 'Close vault question', EyePreviewerChoiceIcon: LogOut },
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
