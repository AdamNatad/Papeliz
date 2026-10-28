import { BookOpen, Code, Eye, EyeOff, FolderOpen, FolderPlus, RefreshCw, RotateCcw, Search, Trash2, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PapelizIconButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizConfirmDialog } from '../ui/papeliz-confirm-dialog'
import { PapelizMark } from '../ui/papeliz-mark'
import { PapelizPopoverMenu, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import {
  describePapelizFolderAccessOffReason,
  detectPapelizFolderAccessSupport,
  type PapelizFolderAccessOffReason,
} from '../vault/papeliz-folder-access-support'
import {
  openPapelizSampleVault,
  pickAndOpenPapelizVaultFolder,
  reopenRememberedPapelizVaultFolder,
  type PapelizOpenVaultResult,
} from '../vault/papeliz-open-vault'
import {
  deleteRememberedVaultFolderFromDisk,
  isRememberedVaultFolderHidden,
  isVaultFolderDeleteSupported,
  listRememberedVaultFolders,
  setRememberedVaultFolderHidden,
  type PapelizRememberedVaultFolder,
} from '../vault/papeliz-remembered-vault-folders'
import { papelizSampleVaultFirstNoteRelativePath, papelizSampleVaultNotes } from '../vault/papeliz-sample-vault-notes'
import { PapelizAccessibilityMenuButton } from './papeliz-accessibility-menu-button'
import { usePapelizStartScreenEyePreviewStore, type PapelizStartScreenEyePreview } from './papeliz-start-screen-eye-preview-store'
import { PapelizWorkspaceEyePreviewerSlot } from './papeliz-workspace-eye-previewer-slot'
import { PapelizWorkspaceNotice } from './papeliz-workspace-notice'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

const papelizRelativeTimeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
// The reload's ring stays at least this long, so a quick reload is still seen to happen.
const papelizRecentVaultListReloadMinimumMilliseconds = 600

// Restore and Delete in the Hidden list, in green and red: their own color a shade darker on hover
// and pressed, the edge unchanged, and a slight give when pressed.
const papelizHiddenVaultRestoreButtonClassName =
  'border-[#3F644F] bg-[#4E7A63] text-white hover:bg-[#4C7660] active:bg-[#49735D] active:scale-[0.985]'
const papelizHiddenVaultDeleteButtonClassName =
  'border-[#8A2E27] bg-[#9E352D] text-white hover:bg-[#99332C] active:bg-[#95322A] active:scale-[0.985]'
const papelizHiddenVaultActionButtonClassName =
  'inline-flex flex-none items-center justify-center gap-1 rounded-md border font-semibold transition-[background-color,scale] duration-150 disabled:cursor-not-allowed disabled:opacity-50'

function describeTimeSince(papelizEventTime: number): string {
  const elapsedMinutes = Math.round((papelizEventTime - Date.now()) / 60_000)
  if (Math.abs(elapsedMinutes) < 1) return 'Just now'
  if (Math.abs(elapsedMinutes) < 60) return papelizRelativeTimeFormat.format(elapsedMinutes, 'minute')
  const elapsedHours = Math.round(elapsedMinutes / 60)
  if (Math.abs(elapsedHours) < 24) return papelizRelativeTimeFormat.format(elapsedHours, 'hour')
  return papelizRelativeTimeFormat.format(Math.round(elapsedHours / 24), 'day')
}

interface PapelizWelcomeActionProps {
  WelcomeActionIcon: LucideIcon
  welcomeActionTitle: string
  welcomeActionDescription: string
  isWelcomeActionDisabled: boolean
  // Why the action is off in this browser. It then shows an "Off in this browser" badge, says why
  // on hover, and pressing it shows the reason as a toast instead of running.
  welcomeActionOffReasonText?: string | null
  onWelcomeActionSelect: () => void
}

// One of the start screen's actions, on the blue panel.
function PapelizWelcomeAction({
  WelcomeActionIcon,
  welcomeActionTitle,
  welcomeActionDescription,
  isWelcomeActionDisabled,
  welcomeActionOffReasonText = null,
  onWelcomeActionSelect,
}: PapelizWelcomeActionProps) {
  const isWelcomeActionOff = welcomeActionOffReasonText !== null
  return (
    <div className="group/welcome-action relative">
      <button
        type="button"
        disabled={isWelcomeActionDisabled}
        aria-disabled={isWelcomeActionOff || undefined}
        onClick={onWelcomeActionSelect}
        className={joinPapelizClassNames(
          'flex min-h-[42px] w-full min-w-0 items-center gap-2 rounded-[10px] border border-white/15 bg-white/[0.07] px-2 py-[7px] text-left text-white transition-[background-color,border-color,transform] duration-150 ease-out focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50',
          isWelcomeActionOff
            ? 'cursor-not-allowed'
            : 'enabled:hover:-translate-y-px enabled:hover:border-white/30 enabled:hover:bg-white/[0.14] enabled:active:scale-[0.99]',
        )}
      >
        <span className={joinPapelizClassNames('grid size-6 flex-none place-items-center rounded-md bg-white/[0.14]', isWelcomeActionOff && 'opacity-55')}>
          <WelcomeActionIcon className="size-3.5" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-col items-start leading-tight">
          <span className={joinPapelizClassNames('truncate text-[12px] font-semibold', isWelcomeActionOff && 'opacity-55')}>{welcomeActionTitle}</span>
          {isWelcomeActionOff ? (
            <span className="mt-0.5 rounded-full border border-papeliz-diff-removed-ink/30 bg-papeliz-diff-removed px-1.5 py-px text-[9.5px] leading-snug font-semibold text-papeliz-diff-removed-ink">
              Off in this browser
            </span>
          ) : (
            <span className="mt-px text-[10px] leading-snug text-white/75">{welcomeActionDescription}</span>
          )}
        </span>
      </button>
      {isWelcomeActionOff && (
        <span
          role="tooltip"
          className="pointer-events-none absolute inset-x-0 top-full z-20 mt-1 rounded-lg bg-papeliz-ink px-2 py-1.5 text-[10.5px] leading-snug text-papeliz-surface opacity-0 shadow-papeliz-pop transition-opacity duration-150 group-focus-within/welcome-action:opacity-100 group-hover/welcome-action:opacity-100"
        >
          {welcomeActionOffReasonText}
        </span>
      )}
    </div>
  )
}

// What the delete dialog is about to delete: one hidden vault, or every hidden vault (Delete All).
type PapelizVaultFolderDeleteRequest =
  | { vaultFolderDeleteScope: 'one-vault'; rememberedVaultFolder: PapelizRememberedVaultFolder }
  | { vaultFolderDeleteScope: 'all-hidden-vaults'; rememberedVaultFolders: readonly PapelizRememberedVaultFolder[] }

// The start screen, shown when no vault is open: on the blue panel, Papeliz, the ways in (a new
// vault, a folder already in use, the sample vault) and who made it; beside it, the vaults opened
// before, to come back to in one click, and the Hidden list. Hide only takes a vault off Recent
// vaults; Delete in the Hidden list erases its folder from the disk, once its name is typed. In a
// browser that can't open folders, the folder actions say so on a badge, on hover and in a toast.
// In development builds the eye previewer in the Recent Vaults heading can hold it in any of its
// states, with made-up vaults; nothing on the disk or in the browser's storage changes then.
export function PapelizWelcomeScreen() {
  const heldStartScreenEyePreview = usePapelizStartScreenEyePreviewStore((eyePreviewState) => eyePreviewState.heldStartScreenEyePreview)
  return (
    <PapelizWelcomeScreenContent
      key={heldStartScreenEyePreview?.startScreenEyePreviewNumber ?? 'live'}
      startScreenEyePreview={heldStartScreenEyePreview}
    />
  )
}

function findPreviewHiddenVaultFolders(startScreenEyePreview: PapelizStartScreenEyePreview): PapelizRememberedVaultFolder[] {
  return startScreenEyePreview.previewRememberedVaultFolders.filter(isRememberedVaultFolderHidden)
}

function PapelizWelcomeScreenContent({ startScreenEyePreview }: { startScreenEyePreview: PapelizStartScreenEyePreview | null }) {
  const openVaultInWorkspace = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVaultInWorkspace)
  const showWorkspaceNotice = usePapelizWorkspaceStore((workspaceState) => workspaceState.showWorkspaceNotice)
  const [rememberedVaultFolders, setRememberedVaultFolders] = useState<PapelizRememberedVaultFolder[]>(
    () => startScreenEyePreview?.previewRememberedVaultFolders ?? [],
  )
  const [recentVaultSearchText, setRecentVaultSearchText] = useState(startScreenEyePreview?.previewRecentVaultSearchText ?? '')
  const [isHiddenVaultListShown, setHiddenVaultListShown] = useState(startScreenEyePreview?.isPreviewHiddenVaultListShown ?? false)
  const [isRecentVaultListReloading, setRecentVaultListReloading] = useState(startScreenEyePreview?.isPreviewRecentVaultListReloading ?? false)
  const [vaultFolderDeleteRequest, setVaultFolderDeleteRequest] = useState<PapelizVaultFolderDeleteRequest | null>(() => {
    if (startScreenEyePreview === null || startScreenEyePreview.previewVaultFolderDeleteScope === null) return null
    const previewHiddenVaultFolders = findPreviewHiddenVaultFolders(startScreenEyePreview)
    if (startScreenEyePreview.previewVaultFolderDeleteScope === 'all-hidden-vaults') {
      return { vaultFolderDeleteScope: 'all-hidden-vaults', rememberedVaultFolders: previewHiddenVaultFolders }
    }
    const firstPreviewHiddenVaultFolder = previewHiddenVaultFolders[0]
    return firstPreviewHiddenVaultFolder === undefined ? null : { vaultFolderDeleteScope: 'one-vault', rememberedVaultFolder: firstPreviewHiddenVaultFolder }
  })
  // What has been typed in the delete dialog: the vault's name, or for Delete All the count.
  const [typedVaultDeleteConfirmation, setTypedVaultDeleteConfirmation] = useState('')
  const [deletingPapelizVaultIds, setDeletingPapelizVaultIds] = useState<ReadonlySet<string> | null>(() =>
    startScreenEyePreview?.isPreviewVaultFolderDeleting === true
      ? new Set(findPreviewHiddenVaultFolders(startScreenEyePreview).map((rememberedVaultFolder) => rememberedVaultFolder.papelizVaultId))
      : null,
  )
  const [isOpeningVault, setIsOpeningVault] = useState(false)
  // The recent vault whose right-click menu is open, and where.
  const [recentVaultMenu, setRecentVaultMenu] = useState<{
    rememberedVaultFolder: PapelizRememberedVaultFolder
    recentVaultMenuPosition: PapelizPopoverMenuPosition
  } | null>(null)
  // The folder window failed to open from a click of the user's own: opening a folder is off for
  // this page until Try again.
  const [isFolderChooserUnavailable, setFolderChooserUnavailable] = useState(startScreenEyePreview?.previewFolderAccessOffReason === 'chooser-unavailable')

  const detectedFolderAccessSupport = useMemo(() => detectPapelizFolderAccessSupport(), [])
  // In a preview, what the browser is said to support; a closed folder window is this page's own,
  // so Try again turns it back on as it does for real.
  const detectedFolderAccessOffReason =
    startScreenEyePreview === null
      ? detectedFolderAccessSupport.folderAccessOffReason
      : startScreenEyePreview.previewFolderAccessOffReason === 'chooser-unavailable'
        ? null
        : startScreenEyePreview.previewFolderAccessOffReason
  const folderAccessOffReason: PapelizFolderAccessOffReason | null =
    detectedFolderAccessOffReason ?? (isFolderChooserUnavailable ? 'chooser-unavailable' : null)
  const folderAccessOffReasonText = folderAccessOffReason === null ? null : describePapelizFolderAccessOffReason(folderAccessOffReason)

  // A preview keeps its made-up vaults: the real list is read only when live.
  const reloadRememberedVaultFolders = useCallback(() => {
    if (startScreenEyePreview !== null) return
    listRememberedVaultFolders()
      .then(setRememberedVaultFolders)
      .catch(() => setRememberedVaultFolders([]))
  }, [startScreenEyePreview])

  useEffect(reloadRememberedVaultFolders, [reloadRememberedVaultFolders])

  // A preview's toast shows once it opens.
  useEffect(() => {
    const previewStartScreenNotice = startScreenEyePreview?.previewStartScreenNotice
    if (previewStartScreenNotice === null || previewStartScreenNotice === undefined) return
    if (startScreenEyePreview?.previewFolderAccessOffReason === 'chooser-unavailable') {
      showWorkspaceNotice(previewStartScreenNotice.previewNoticeKind, previewStartScreenNotice.previewNoticeMessage, {
        workspaceNoticeActionLabel: 'Try again',
        onWorkspaceNoticeAction: () => setFolderChooserUnavailable(false),
      })
      return
    }
    showWorkspaceNotice(previewStartScreenNotice.previewNoticeKind, previewStartScreenNotice.previewNoticeMessage)
  }, [startScreenEyePreview, showWorkspaceNotice])

  // In a preview, anything that would touch a folder or the remembered list says so instead.
  const showStartScreenPreviewOnlyNotice = () =>
    showWorkspaceNotice('info', 'Nothing changed (Preview Only).')

  const recentVaultFolders = useMemo(
    () => rememberedVaultFolders.filter((rememberedVaultFolder) => !isRememberedVaultFolderHidden(rememberedVaultFolder)),
    [rememberedVaultFolders],
  )
  // Most recently hidden first.
  const hiddenVaultFolders = useMemo(
    () =>
      rememberedVaultFolders
        .filter(isRememberedVaultFolderHidden)
        .sort((firstVaultFolder, secondVaultFolder) => (secondVaultFolder.papelizVaultHiddenAt ?? 0) - (firstVaultFolder.papelizVaultHiddenAt ?? 0)),
    [rememberedVaultFolders],
  )
  const listedVaultFolders = isHiddenVaultListShown ? hiddenVaultFolders : recentVaultFolders

  const shownVaultFolders = useMemo(() => {
    const lowerCaseSearchText = recentVaultSearchText.trim().toLowerCase()
    if (lowerCaseSearchText.length === 0) return listedVaultFolders
    return listedVaultFolders.filter((rememberedVaultFolder) => rememberedVaultFolder.papelizVaultDisplayName.toLowerCase().includes(lowerCaseSearchText))
  }, [recentVaultSearchText, listedVaultFolders])

  // The toast for a folder action that is off: why, with Try again when this page turned it off.
  // Try again turns it back on and opens the folder window again at once, from its own click (in a
  // preview it only turns it back on).
  const showFolderAccessOffNotice = (offReason: PapelizFolderAccessOffReason, isNewVault: boolean) => {
    const isOffReasonRetryable = offReason === 'chooser-unavailable' && detectedFolderAccessOffReason === null
    showWorkspaceNotice(
      'error',
      describePapelizFolderAccessOffReason(offReason),
      isOffReasonRetryable
        ? {
            workspaceNoticeActionLabel: 'Try again',
            onWorkspaceNoticeAction: () => {
              setFolderChooserUnavailable(false)
              if (startScreenEyePreview === null) void pickAndOpenFolderVault(isNewVault)
            },
          }
        : undefined,
    )
  }

  // Opens a picked or remembered folder. A new vault whose folder has no notes yet starts its first
  // note right away, named and ready to write in.
  const finishOpeningFolderVault = async (openVaultResult: PapelizOpenVaultResult, isNewVault: boolean) => {
    // Closing the folder window and a browser refusing to let Papeliz edit the picked folder (the user
    // turned its question down, or it doesn't ask at all) look the same.
    if (openVaultResult.openVaultOutcome === 'cancelled') {
      showWorkspaceNotice('info', 'No folder opened.')
      return
    }
    if (openVaultResult.openVaultOutcome === 'chooser-unavailable') {
      setFolderChooserUnavailable(true)
      showFolderAccessOffNotice('chooser-unavailable', isNewVault)
      return
    }
    if (openVaultResult.openVaultOutcome === 'failed') {
      showWorkspaceNotice('error', openVaultResult.openVaultFailureMessage)
      return
    }
    await openVaultInWorkspace(openVaultResult.papelizOpenVault, {
      firstVaultNoteRelativePathToOpen: null,
      firstNoteViewMode: 'md-code',
      expandAllTopLevelFolders: false,
    })
    if (!isNewVault) return
    const workspaceState = usePapelizWorkspaceStore.getState()
    if (workspaceState.vaultTreeEntries.some((vaultTreeEntry) => vaultTreeEntry.vaultEntryKind === 'note')) {
      workspaceState.showWorkspaceNotice('info', `Opened “${openVaultResult.papelizOpenVault.papelizVaultDisplayName}” as it is.`)
    } else {
      await workspaceState.createVaultNoteInFolder('')
    }
  }

  const openFolderVault = async (isNewVault: boolean) => {
    if (folderAccessOffReason !== null) {
      showFolderAccessOffNotice(folderAccessOffReason, isNewVault)
      return
    }
    if (startScreenEyePreview !== null) {
      showStartScreenPreviewOnlyNotice()
      return
    }
    await pickAndOpenFolderVault(isNewVault)
  }

  // Shows the folder window and opens the folder picked. Must run from a click.
  const pickAndOpenFolderVault = async (isNewVault: boolean) => {
    setIsOpeningVault(true)
    try {
      await finishOpeningFolderVault(await pickAndOpenPapelizVaultFolder(), isNewVault)
    } finally {
      setIsOpeningVault(false)
    }
  }

  const reopenRememberedFolderVault = async (rememberedVaultFolder: PapelizRememberedVaultFolder) => {
    if (startScreenEyePreview !== null) {
      showStartScreenPreviewOnlyNotice()
      return
    }
    setIsOpeningVault(true)
    try {
      await finishOpeningFolderVault(await reopenRememberedPapelizVaultFolder(rememberedVaultFolder), false)
    } finally {
      setIsOpeningVault(false)
    }
  }

  // Reload: the list is read again while the button's icon turns and a ring turns over the list.
  // Pressing it again during a reload does nothing.
  const reloadRecentVaultList = () => {
    if (isRecentVaultListReloading) return
    setRecentVaultListReloading(true)
    const reloadStartedAt = Date.now()
    if (startScreenEyePreview !== null) {
      setTimeout(() => setRecentVaultListReloading(false), papelizRecentVaultListReloadMinimumMilliseconds)
      return
    }
    void listRememberedVaultFolders()
      .then(setRememberedVaultFolders)
      .catch(() => setRememberedVaultFolders([]))
      .finally(() => {
        setTimeout(() => setRecentVaultListReloading(false), Math.max(0, papelizRecentVaultListReloadMinimumMilliseconds - (Date.now() - reloadStartedAt)))
      })
  }

  // Hides a vault into the Hidden list or restores it; the folder and its notes stay on the disk.
  const setVaultFolderHidden = (rememberedVaultFolder: PapelizRememberedVaultFolder, isVaultHidden: boolean) => {
    if (startScreenEyePreview !== null) {
      showStartScreenPreviewOnlyNotice()
      return
    }
    void setRememberedVaultFolderHidden(rememberedVaultFolder, isVaultHidden).finally(reloadRememberedVaultFolders)
  }

  // Runs straight from the dialog's click, so the browser can ask for permission to change a folder.
  // Delete All goes through the vaults in turn; one that can't be deleted now stays in the list.
  const deleteHiddenVaultFolders = async (confirmedVaultFolderDeleteRequest: PapelizVaultFolderDeleteRequest) => {
    const vaultFoldersToDelete =
      confirmedVaultFolderDeleteRequest.vaultFolderDeleteScope === 'one-vault'
        ? [confirmedVaultFolderDeleteRequest.rememberedVaultFolder]
        : confirmedVaultFolderDeleteRequest.rememberedVaultFolders
    setVaultFolderDeleteRequest(null)
    if (startScreenEyePreview !== null) {
      showStartScreenPreviewOnlyNotice()
      return
    }
    setDeletingPapelizVaultIds(new Set(vaultFoldersToDelete.map((rememberedVaultFolder) => rememberedVaultFolder.papelizVaultId)))
    try {
      const vaultFolderDeleteFailureMessages: string[] = []
      for (const rememberedVaultFolder of vaultFoldersToDelete) {
        const vaultFolderDeleteResult = await deleteRememberedVaultFolderFromDisk(rememberedVaultFolder)
        if (vaultFolderDeleteResult.vaultFolderDeleteOutcome === 'failed') vaultFolderDeleteFailureMessages.push(vaultFolderDeleteResult.vaultFolderDeleteFailureMessage)
      }
      const deletedVaultCount = vaultFoldersToDelete.length - vaultFolderDeleteFailureMessages.length
      const keptVaultCount = vaultFolderDeleteFailureMessages.length
      if (confirmedVaultFolderDeleteRequest.vaultFolderDeleteScope === 'one-vault') {
        showWorkspaceNotice(
          keptVaultCount === 0 ? 'info' : 'error',
          vaultFolderDeleteFailureMessages[0] ?? `Deleted “${confirmedVaultFolderDeleteRequest.rememberedVaultFolder.papelizVaultDisplayName}”.`,
        )
      } else if (keptVaultCount === 0) {
        showWorkspaceNotice('info', `Deleted ${deletedVaultCount} ${deletedVaultCount === 1 ? 'vault' : 'vaults'}.`)
      } else {
        // A vault that couldn't be deleted stays in the Hidden list.
        showWorkspaceNotice(
          'error',
          vaultFoldersToDelete.length === 1
            ? (vaultFolderDeleteFailureMessages[0] ?? '')
            : `Couldn’t delete ${keptVaultCount} of ${vaultFoldersToDelete.length} vaults (Still Hidden)`,
        )
      }
    } finally {
      setDeletingPapelizVaultIds(null)
      reloadRememberedVaultFolders()
    }
  }

  const expectedVaultDeleteConfirmation =
    vaultFolderDeleteRequest === null
      ? ''
      : vaultFolderDeleteRequest.vaultFolderDeleteScope === 'one-vault'
        ? vaultFolderDeleteRequest.rememberedVaultFolder.papelizVaultDisplayName
        : String(vaultFolderDeleteRequest.rememberedVaultFolders.length)
  const isVaultDeleteConfirmationTyped = vaultFolderDeleteRequest !== null && typedVaultDeleteConfirmation.trim() === expectedVaultDeleteConfirmation
  const canDeleteVaultFolders = isVaultFolderDeleteSupported()

  const openSampleVault = () =>
    openVaultInWorkspace(openPapelizSampleVault(), {
      firstVaultNoteRelativePathToOpen: papelizSampleVaultFirstNoteRelativePath,
      firstNoteViewMode: 'md-view',
      expandAllTopLevelFolders: true,
    })

  return (
    <div className="flex min-h-full flex-col bg-papeliz-surface-soft">
      <header className="flex h-12 flex-none items-center gap-2.5 bg-papeliz-topbar px-3 text-white sm:px-5">
        <PapelizMark papelizMarkSize={26} papelizMarkTone="on-blue" />
        <span className="text-[15px] font-semibold tracking-[-0.01em]">Papeliz</span>
        <div className="ml-auto flex items-center gap-1.5">
          <PapelizAccessibilityMenuButton isNoteDisplaySettingsShown={false} />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-3 sm:p-4">
        <div className="papeliz-welcome-enter flex w-[750px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[14px] border border-papeliz-line bg-papeliz-surface shadow-papeliz-card max-md:flex-col md:h-[520px] md:max-h-[calc(100dvh-80px)] sm:max-w-[calc(100vw-48px)]">
          <section aria-label="Start" className="flex flex-none flex-col bg-papeliz-topbar p-3 text-white md:w-[190px]">
            <div className="flex items-center gap-2.5">
              <PapelizMark papelizMarkSize={34} papelizMarkTone="on-blue" />
              <div className="flex flex-col">
                <h1 className="text-[24px] leading-none font-semibold tracking-[-0.02em]">Papeliz</h1>
                <span className="mt-1 self-end text-[10.5px] leading-none text-white/70">by Adam Natad</span>
              </div>
            </div>
            {/* The first sentence of the website's description, which follows "Papeliz is". */}
            <p className="mt-3 text-[11.5px] leading-[1.45] text-white/80">
              A free, open-source, cross-platform Markdown editor and AI-powered note-taking app for building your personal knowledge base.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-[7px]">
              <PapelizWelcomeAction
                WelcomeActionIcon={FolderPlus}
                welcomeActionTitle="New Vault"
                welcomeActionDescription="Start in a new folder."
                isWelcomeActionDisabled={isOpeningVault}
                welcomeActionOffReasonText={folderAccessOffReasonText}
                onWelcomeActionSelect={() => void openFolderVault(true)}
              />
              <PapelizWelcomeAction
                WelcomeActionIcon={FolderOpen}
                welcomeActionTitle="Open Vault"
                welcomeActionDescription="Use notes you have."
                isWelcomeActionDisabled={isOpeningVault}
                welcomeActionOffReasonText={folderAccessOffReasonText}
                onWelcomeActionSelect={() => void openFolderVault(false)}
              />
              <PapelizWelcomeAction
                WelcomeActionIcon={BookOpen}
                welcomeActionTitle="Try Sample"
                welcomeActionDescription={`${papelizSampleVaultNotes.length} notes, nothing saved.`}
                isWelcomeActionDisabled={isOpeningVault}
                onWelcomeActionSelect={() => void openSampleVault()}
              />
            </div>

            <p className="mt-[9px] flex items-center gap-2 border-t border-white/15 pt-[9px] text-[11px] font-medium text-white/80 md:mt-auto">
              <Code className="size-3.5 flex-none" aria-hidden="true" />
              Open Source (MIT License)
            </p>
          </section>

          <section aria-labelledby="papeliz-welcome-recent-heading" className="flex min-h-[280px] min-w-0 flex-1 flex-col p-2.5">
            {/* Heading: the title on the left; Delete All (in the Hidden list), the eye previewer (development
                builds only), the Hidden list's eye, Reload and the search box on the right. */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 pt-[11px] pb-1.5">
              <h2 id="papeliz-welcome-recent-heading" className="text-[18px] font-semibold tracking-[-0.01em]">
                {isHiddenVaultListShown ? 'Hidden Vaults' : 'Recent Vaults'}
              </h2>
              <div className="flex min-w-0 items-center gap-2 max-sm:w-full">
                {isHiddenVaultListShown && hiddenVaultFolders.length > 0 && (
                  <button
                    type="button"
                    disabled={deletingPapelizVaultIds !== null || !canDeleteVaultFolders}
                    title={canDeleteVaultFolders ? 'Delete every hidden vault from your disk' : 'This browser can’t delete folders'}
                    onClick={() => {
                      setTypedVaultDeleteConfirmation('')
                      setVaultFolderDeleteRequest({ vaultFolderDeleteScope: 'all-hidden-vaults', rememberedVaultFolders: hiddenVaultFolders })
                    }}
                    className={joinPapelizClassNames(papelizHiddenVaultActionButtonClassName, papelizHiddenVaultDeleteButtonClassName, 'h-8 px-3 text-[12.5px]')}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Delete All
                  </button>
                )}
                <PapelizWorkspaceEyePreviewerSlot />
                {/* The eye follows the view: crossed out on Recent Vaults (the vaults hidden from it), open in
                    the Hidden list (they are showing). */}
                <button
                  type="button"
                  aria-pressed={isHiddenVaultListShown}
                  aria-label={isHiddenVaultListShown ? 'Back to Recent Vaults' : `Hidden Vaults (${hiddenVaultFolders.length})`}
                  title={isHiddenVaultListShown ? 'Back to Recent Vaults' : `Hidden Vaults (${hiddenVaultFolders.length})`}
                  onClick={() => {
                    setHiddenVaultListShown(!isHiddenVaultListShown)
                    setRecentVaultSearchText('')
                  }}
                  className="relative grid size-8 flex-none place-items-center rounded-full border border-papeliz-line text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink aria-pressed:border-papeliz-blue-line aria-pressed:bg-papeliz-blue-soft aria-pressed:text-papeliz-blue"
                >
                  {isHiddenVaultListShown ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}
                  {hiddenVaultFolders.length > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#C0524A] px-1 text-[9.5px] leading-none font-bold text-white"
                    >
                      {hiddenVaultFolders.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Reload the list"
                  title="Reload the list"
                  aria-busy={isRecentVaultListReloading || undefined}
                  onClick={reloadRecentVaultList}
                  className="papeliz-recent-vaults-reload-button grid size-8 flex-none place-items-center rounded-full border border-papeliz-line text-papeliz-ink-muted hover:bg-papeliz-hover hover:text-papeliz-ink"
                >
                  <RefreshCw
                    className={joinPapelizClassNames('size-4', isRecentVaultListReloading && 'papeliz-recent-vaults-reload-icon-turning')}
                    aria-hidden="true"
                  />
                </button>
                <label className="flex h-8 w-[min(300px,100%)] items-center gap-2 rounded-full border border-papeliz-line bg-papeliz-surface px-3 text-papeliz-ink-subtle focus-within:border-papeliz-blue-line focus-within:shadow-[0_0_0_3px_var(--color-papeliz-blue-soft)] max-sm:flex-1 sm:w-[180px]">
                  <Search className="size-3.5 flex-none" aria-hidden="true" />
                  <span className="sr-only">{isHiddenVaultListShown ? 'Find a hidden vault' : 'Find a recent vault'}</span>
                  <input
                    type="search"
                    value={recentVaultSearchText}
                    onChange={(changeEvent) => setRecentVaultSearchText(changeEvent.target.value)}
                    placeholder={isHiddenVaultListShown ? 'Search hidden' : 'Search vaults'}
                    className="min-w-0 flex-1 bg-transparent text-[12.5px] text-papeliz-ink placeholder:text-papeliz-ink-subtle focus:outline-none"
                  />
                </label>
              </div>
            </div>

            {/* The list and, while it reloads, a ring turning over it. */}
            <div className="relative flex min-h-0 flex-1 flex-col">
              {isRecentVaultListReloading && (
                <div role="status" className="papeliz-recent-vaults-reload-overlay">
                  <span className="papeliz-recent-vaults-reload-ring" aria-hidden="true" />
                  <span className="text-[12.5px] font-semibold text-papeliz-ink-muted">Reloading…</span>
                </div>
              )}
              {listedVaultFolders.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
                  <span className="grid size-11 place-items-center rounded-xl bg-papeliz-blue-soft text-papeliz-blue">
                    {isHiddenVaultListShown ? <EyeOff className="size-5" aria-hidden="true" /> : <FolderOpen className="size-5" aria-hidden="true" />}
                  </span>
                  <p className="mt-3 text-[14px] font-semibold">{isHiddenVaultListShown ? 'Nothing is hidden' : 'No recent vaults yet'}</p>
                  <p className="mt-1 max-w-[300px] text-[12.5px] text-papeliz-ink-muted">
                    {isHiddenVaultListShown
                      ? 'Right-click a vault and choose Hide.'
                      : (folderAccessOffReasonText ?? 'Folders you open show up here, so you can come back to them in one click.')}
                  </p>
                </div>
              ) : (
                <ul className="mt-1.5 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pb-1">
                  {shownVaultFolders.length === 0 && (
                    <li className="px-1 py-6 text-center text-[12.5px] text-papeliz-ink-muted">
                      {isHiddenVaultListShown ? 'No hidden vault matches' : 'No recent vault matches'} “{recentVaultSearchText.trim()}”.
                    </li>
                  )}
                  {isHiddenVaultListShown
                    ? shownVaultFolders.map((rememberedVaultFolder) => {
                        const isThisVaultDeleting = deletingPapelizVaultIds?.has(rememberedVaultFolder.papelizVaultId) === true
                        return (
                          // A hidden vault's row: the same card, not clickable, with Restore and Delete (Delete
                          // asks first).
                          <li
                            key={rememberedVaultFolder.papelizVaultId}
                            aria-label={rememberedVaultFolder.papelizVaultDisplayName}
                            className="flex items-center gap-3 rounded-xl border border-papeliz-line bg-papeliz-surface px-2.5 py-2"
                          >
                            <span
                              aria-hidden="true"
                              className="grid size-9 flex-none place-items-center rounded-lg bg-papeliz-hover text-[15px] font-semibold text-papeliz-ink-muted"
                            >
                              {rememberedVaultFolder.papelizVaultDisplayName.trim().charAt(0).toUpperCase() || '·'}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="truncate text-[13.5px] font-semibold">{rememberedVaultFolder.papelizVaultDisplayName}</span>
                              <span className="text-[11.5px] text-papeliz-ink-subtle">
                                Hidden {describeTimeSince(rememberedVaultFolder.papelizVaultHiddenAt ?? rememberedVaultFolder.papelizVaultLastOpenedAt).toLowerCase()}
                              </span>
                            </span>
                            {/* Restore and Delete stack at the far right, hanging from a zero-height column centred on
                                the row, so the row keeps the Recent Vaults height. */}
                            <span className="flex h-0 flex-none flex-col justify-center gap-1 self-center">
                              <button
                                type="button"
                                disabled={deletingPapelizVaultIds !== null}
                                onClick={() => setVaultFolderHidden(rememberedVaultFolder, false)}
                                className={joinPapelizClassNames(
                                  papelizHiddenVaultActionButtonClassName,
                                  papelizHiddenVaultRestoreButtonClassName,
                                  'h-6 px-2.5 text-[11.5px]',
                                )}
                              >
                                <RotateCcw className="size-3" aria-hidden="true" />
                                Restore
                              </button>
                              <button
                                type="button"
                                disabled={deletingPapelizVaultIds !== null || !canDeleteVaultFolders}
                                title={
                                  canDeleteVaultFolders
                                    ? `Delete “${rememberedVaultFolder.papelizVaultDisplayName}” and its notes from your disk`
                                    : 'This browser can’t delete folders'
                                }
                                onClick={() => {
                                  setTypedVaultDeleteConfirmation('')
                                  setVaultFolderDeleteRequest({ vaultFolderDeleteScope: 'one-vault', rememberedVaultFolder })
                                }}
                                className={joinPapelizClassNames(
                                  papelizHiddenVaultActionButtonClassName,
                                  papelizHiddenVaultDeleteButtonClassName,
                                  'h-6 px-2.5 text-[11.5px]',
                                )}
                              >
                                <Trash2 className="size-3" aria-hidden="true" />
                                {isThisVaultDeleting ? 'Deleting…' : 'Delete'}
                              </button>
                            </span>
                          </li>
                        )
                      })
                    : shownVaultFolders.map((rememberedVaultFolder) => (
                        <li
                          key={rememberedVaultFolder.papelizVaultId}
                          onContextMenu={(contextMenuEvent) => {
                            contextMenuEvent.preventDefault()
                            setRecentVaultMenu({
                              rememberedVaultFolder,
                              recentVaultMenuPosition: { menuAnchorLeft: contextMenuEvent.clientX, menuAnchorTop: contextMenuEvent.clientY },
                            })
                          }}
                          className="group flex items-center rounded-xl border border-papeliz-line bg-papeliz-surface transition-[border-color,background-color,box-shadow] duration-150 hover:border-papeliz-blue-line hover:bg-papeliz-blue-soft/40 hover:shadow-papeliz-card"
                        >
                          <button
                            type="button"
                            disabled={isOpeningVault}
                            onClick={() => void reopenRememberedFolderVault(rememberedVaultFolder)}
                            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2 text-left"
                          >
                            <span
                              aria-hidden="true"
                              className="grid size-9 flex-none place-items-center rounded-lg bg-papeliz-blue-soft text-[15px] font-semibold text-papeliz-blue"
                            >
                              {rememberedVaultFolder.papelizVaultDisplayName.trim().charAt(0).toUpperCase() || '·'}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="truncate text-[13.5px] font-semibold">{rememberedVaultFolder.papelizVaultDisplayName}</span>
                              <span className="text-[11.5px] text-papeliz-ink-subtle">Folder on this device</span>
                            </span>
                            <span className="flex-none text-[11.5px] text-papeliz-ink-subtle">{describeTimeSince(rememberedVaultFolder.papelizVaultLastOpenedAt)}</span>
                          </button>
                          <PapelizIconButton
                            iconButtonLabel={`Hide ${rememberedVaultFolder.papelizVaultDisplayName}`}
                            iconButtonSize="small"
                            className="mr-2.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
                            onClick={() => setVaultFolderHidden(rememberedVaultFolder, true)}
                          >
                            <EyeOff className="size-[15px]" aria-hidden="true" />
                          </PapelizIconButton>
                        </li>
                      ))}
                </ul>
              )}
            </div>

            {listedVaultFolders.length > 0 && (
              <p className="mt-2 px-3 text-[11px] text-papeliz-ink-subtle">
                {isHiddenVaultListShown
                  ? 'Delete erases the folder and every note in it from your disk. It doesn’t go to the Recycle Bin.'
                  : 'The folders stay on your disk. Hide only takes one off this list.'}
              </p>
            )}

            {recentVaultMenu !== null && (
              <PapelizPopoverMenu
                menuLabel={recentVaultMenu.rememberedVaultFolder.papelizVaultDisplayName}
                menuPosition={recentVaultMenu.recentVaultMenuPosition}
                onMenuClose={() => setRecentVaultMenu(null)}
                menuItems={[
                  {
                    menuItemKey: 'open-recent-vault',
                    menuItemLabel: 'Open',
                    MenuItemIcon: FolderOpen,
                    onMenuItemSelect: () => void reopenRememberedFolderVault(recentVaultMenu.rememberedVaultFolder),
                  },
                  {
                    menuItemKey: 'hide-recent-vault',
                    menuItemLabel: 'Hide',
                    MenuItemIcon: EyeOff,
                    menuItemGroupHeading: ' ',
                    onMenuItemSelect: () => setVaultFolderHidden(recentVaultMenu.rememberedVaultFolder, true),
                  },
                ]}
              />
            )}

            {/* One confirmation for Delete and for Delete All: the same dialog, asking for the vault's name or,
                for Delete All, the number of vaults. */}
            {vaultFolderDeleteRequest !== null && (
              <PapelizConfirmDialog
                confirmDialogTitle={
                  vaultFolderDeleteRequest.vaultFolderDeleteScope === 'one-vault'
                    ? `Delete “${vaultFolderDeleteRequest.rememberedVaultFolder.papelizVaultDisplayName}”?`
                    : vaultFolderDeleteRequest.rememberedVaultFolders.length === 1
                      ? 'Delete 1 hidden vault?'
                      : `Delete all ${vaultFolderDeleteRequest.rememberedVaultFolders.length} hidden vaults?`
                }
                confirmDialogBody={
                  <>
                    <p>
                      {vaultFolderDeleteRequest.vaultFolderDeleteScope === 'one-vault'
                        ? `This deletes the folder “${vaultFolderDeleteRequest.rememberedVaultFolder.papelizVaultDisplayName}” and every note and file in it from your disk.`
                        : 'This deletes every vault in the Hidden list: each folder and every note and file in it, from your disk.'}{' '}
                      It doesn’t go to the Recycle Bin, and it can’t be undone.
                    </p>
                    <label className="mt-4 block text-[13px] font-medium text-papeliz-ink">
                      Type <span className="papeliz-selectable-text font-semibold">{expectedVaultDeleteConfirmation}</span> to delete{' '}
                      {vaultFolderDeleteRequest.vaultFolderDeleteScope === 'one-vault' || vaultFolderDeleteRequest.rememberedVaultFolders.length === 1
                        ? 'it'
                        : 'them'}
                      <input
                        value={typedVaultDeleteConfirmation}
                        onChange={(changeEvent) => setTypedVaultDeleteConfirmation(changeEvent.target.value)}
                        onKeyDown={(keyDownEvent) => {
                          if (keyDownEvent.key !== 'Enter' || !isVaultDeleteConfirmationTyped) return
                          keyDownEvent.preventDefault()
                          void deleteHiddenVaultFolders(vaultFolderDeleteRequest)
                        }}
                        autoComplete="off"
                        spellCheck={false}
                        className="mt-1.5 block h-9 w-full rounded-xl border border-papeliz-line bg-papeliz-surface px-3 text-[14px] font-normal text-papeliz-ink focus:border-papeliz-blue-line focus:shadow-[0_0_0_3px_var(--color-papeliz-blue-soft)] focus:outline-none"
                      />
                    </label>
                  </>
                }
                confirmButtonLabel={vaultFolderDeleteRequest.vaultFolderDeleteScope === 'one-vault' ? 'Delete Vault' : 'Delete All Vaults'}
                isConfirmActionDangerous
                isConfirmButtonDisabled={!isVaultDeleteConfirmationTyped}
                onConfirm={() => void deleteHiddenVaultFolders(vaultFolderDeleteRequest)}
                onCancel={() => setVaultFolderDeleteRequest(null)}
              />
            )}
          </section>
        </div>
      </main>

      <PapelizWorkspaceNotice />
    </div>
  )
}
