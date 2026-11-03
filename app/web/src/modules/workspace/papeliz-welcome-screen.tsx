import { AppWindow, BookOpen, CloudCheck, CloudDownload, Code, Download, Ellipsis, Eye, EyeOff, FolderOpen, FolderPlus, HardDrive, History, KeyRound, LayoutTemplate, Lock, Pencil, RefreshCw, RotateCcw, Search, Trash2, type LucideIcon } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react'
import { isPapelizDesktopApp } from 'virtual:papeliz-desktop-platform-availability'
import { PapelizDesktopWindowControls, usePapelizDesktopWindowBarDragHandlers } from '../desktop/papeliz-desktop-window-controls'
import { isPapelizSyncEngineInThisBuild } from 'virtual:papeliz-sync-engine-availability'
import { isPapelizSyncUsedOnThisDevice, readPapelizSyncDevFakeEngineScenarioText, usePapelizSyncEngineSnapshot, usePapelizSyncEngineStore } from '../sync/papeliz-sync-engine-store'
import { PapelizSyncStartScreenDownloadProgressLines, readPapelizSyncStartScreenDownloadPercent } from '../sync/papeliz-sync-start-screen-download-progress'
import { returnPapelizSyncSyncedVaultsPageToLive, usePapelizSyncSyncedVaultsPagePreviewStore } from '../sync/papeliz-sync-synced-vaults-page-preview-store'
import { takePapelizTemplateGalleryIdFromAddress } from '../template-gallery/papeliz-template-gallery-address-request'
import { returnPapelizTemplateGalleryPageToLive, usePapelizTemplateGalleryPagePreviewStore } from '../template-gallery/papeliz-template-gallery-page-preview-store'
import { waitToTurnPapelizSyncOnForNewVault } from '../sync/papeliz-sync-new-vault-turn-on'
import {
  forgetPapelizSyncLinksOfDeletedVault,
  resumePapelizSyncStartScreenDownloads,
  retryPapelizSyncStartScreenDownload,
  usePapelizSyncStartScreenDownloadStore,
} from '../sync/papeliz-sync-start-screen-download-store'
import { PapelizIconButton, PapelizPillButton, papelizOutlineButtonColorClassName } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizConfirmDialog } from '../ui/papeliz-confirm-dialog'
import { PapelizHoverTooltip, PapelizTooltipBubble, PapelizTooltipLine } from '../ui/papeliz-hover-tooltip'
import { PapelizMark } from '../ui/papeliz-mark'
import { PapelizPopoverMenu, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import {
  describePapelizFolderAccessOffReason,
  detectPapelizFolderAccessSupport,
  type PapelizFolderAccessOffReason,
} from '../vault/papeliz-folder-access-support'
import { subscribeToPapelizBrowserVaultListChanges } from '../vault/papeliz-browser-vault-list-channel'
import {
  describePapelizBrowserVaultOffReason,
  detectPapelizBrowserVaultSupport,
  probePapelizBrowserVaultStorage,
  type PapelizBrowserVaultOffReason,
} from '../vault/papeliz-browser-vault-support'
import {
  createPapelizBrowserVault,
  openPapelizBrowserVault,
  pickFreePapelizBrowserVaultName,
  renamePapelizBrowserVault,
  type PapelizBrowserVaultRecord,
} from '../vault/papeliz-browser-vaults'
import {
  makeAndOpenNewPapelizFolderVault,
  openPapelizSampleVault,
  pickAndOpenPapelizVaultFolder,
  pickPapelizNewVaultParentFolder,
  type PapelizExistingVaultOpenResult,
  type PapelizNewVaultParentFolder,
  type PapelizOpenVault,
  type PapelizOpenVaultResult,
} from '../vault/papeliz-open-vault'
import { makePapelizEndToEndVault, unlockPapelizEndToEndVaultWithRememberedKey, type PapelizLockedEndToEndVault } from '../vault/papeliz-vault-encryption'
import {
  deletePapelizRecentVault,
  isPapelizRecentDesktopFolderVault,
  isPapelizRecentVaultHidden,
  listPapelizRecentVaults,
  reopenPapelizRecentVault,
  setPapelizRecentVaultHidden,
  type PapelizRecentVault,
  type PapelizStartScreenRecentVault,
} from '../vault/papeliz-recent-vaults'
import { isVaultFolderDeleteSupported } from '../vault/papeliz-remembered-vault-folders'
import { describePapelizFailureMessage } from '../vault/papeliz-failure-code-words'
import { papelizSampleVaultFirstNoteRelativePath, papelizSampleVaultNotes } from '../vault/papeliz-sample-vault-notes'
import { usePapelizBrowserStorageStore } from './papeliz-browser-storage-store'
import { downloadPapelizBrowserVaultBackupFromClick } from './papeliz-browser-vault-backup-reminder-store'
import { PapelizBrowserVaultNameDialog } from './papeliz-browser-vault-name-dialog'
import { PapelizNewVaultForm, type PapelizNewVaultConfirmDetails, type PapelizNewVaultPlace } from './papeliz-new-vault-form'
import { PapelizEndToEndVaultUnlockPanel, type PapelizEndToEndVaultUnlockReason } from './papeliz-end-to-end-vault-unlock-panel'
import { readPapelizRecentVaultSyncedVaultIds } from './papeliz-recent-vault-sync-badges'
import {
  describePapelizVaultEncryptionFailureMessage,
  papelizEndToEndVaultBadgeColorClassName,
  papelizVaultRowBadgeClassName,
  PapelizVaultLetterTile,
} from './papeliz-vault-encryption-parts'
import { papelizEndToEndVaultBadgeWords, papelizRememberedEndToEndVaultChipTooltipText, papelizRememberedEndToEndVaultChipWords } from './papeliz-vault-encryption-screen-words'
import { PapelizSettingsGearButton } from './papeliz-settings-gear-button'
import { usePapelizStartScreenEyePreviewStore, type PapelizStartScreenEyePreview } from './papeliz-start-screen-eye-preview-store'
import { PapelizWorkspaceNotice } from './papeliz-workspace-notice'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

// The Synced Vaults page loads with the rest of Sync's screens, only once it's pressed.
const PapelizSyncSyncedVaultsPage = lazy(() =>
  import('../sync/papeliz-sync-synced-vaults-page').then((syncedVaultsPageModule) => ({ default: syncedVaultsPageModule.PapelizSyncSyncedVaultsPage })),
)
// Templates' pages load the same way, once Templates is pressed.
const PapelizTemplateGalleryPage = lazy(() =>
  import('../template-gallery/papeliz-template-gallery-page').then((templateGalleryPageModule) => ({ default: templateGalleryPageModule.PapelizTemplateGalleryPage })),
)
// The previewer of both pages, floating at the bottom right, only in development builds: in a
// production build `import.meta.env.DEV` is false, so the button and its made-up account, vaults and
// templates are left out.
const PapelizStartScreenPreviewerButton = import.meta.env.DEV
  ? lazy(() =>
      import('./papeliz-start-screen-previewer-button').then((previewerButtonModule) => ({
        default: previewerButtonModule.PapelizStartScreenPreviewerButton,
      })),
    )
  : null

// Papeliz's code, on GitHub: the foot of the blue panel links to it.
const papelizPublicGitHubRepositoryUrl = 'https://github.com/AdamNatad/Papeliz'

const papelizRelativeTimeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
// The reload's ring stays at least this long, so a quick reload is still seen to happen.
const papelizRecentVaultListReloadMinimumMilliseconds = 600


// Restore and Delete in the Hidden list, and Delete All: Restore outlined like a Cancel, the two deletes
// outlined in red and filled soft red on hover, with a slight give when pressed. None is solid, so no
// delete reads as the page's main action.
const papelizHiddenVaultRestoreButtonClassName = joinPapelizClassNames(papelizOutlineButtonColorClassName, 'enabled:active:scale-[0.985]')
const papelizHiddenVaultDeleteButtonClassName =
  'border-papeliz-diff-removed-ink/35 bg-papeliz-surface text-papeliz-diff-removed-ink enabled:hover:border-papeliz-diff-removed-ink/55 enabled:hover:bg-papeliz-diff-removed enabled:active:scale-[0.985]'
const papelizHiddenVaultActionButtonClassName =
  'inline-flex flex-none items-center justify-center gap-1 rounded-md border font-semibold transition-[background-color,border-color,color,scale] duration-150 disabled:cursor-not-allowed disabled:opacity-50'
// A vault row's right end: when it was opened (or hidden), and its buttons. With a mouse on a wide screen
// the time sits at the far right, and the buttons take its place while the pointer is over the row or
// focus is in it: the two share one grid cell, as wide as the wider, so nothing moves. On a touch screen,
// or below 768px, the buttons always show, after the time.
const papelizVaultRowEndClassName = 'flex flex-none items-center gap-2.5 md:pointer-fine:grid md:pointer-fine:justify-items-end'
const papelizVaultRowEndTimeClassName =
  'text-[11.5px] whitespace-nowrap text-papeliz-ink-subtle transition-opacity duration-150 max-sm:hidden md:pointer-fine:col-start-1 md:pointer-fine:row-start-1 md:pointer-fine:group-focus-within:opacity-0 md:pointer-fine:group-hover:opacity-0'
const papelizVaultRowEndButtonsClassName =
  'flex items-center transition-opacity duration-150 md:pointer-fine:col-start-1 md:pointer-fine:row-start-1 md:pointer-fine:opacity-0 md:pointer-fine:group-focus-within:opacity-100 md:pointer-fine:group-hover:opacity-100'

// The words under a vault's name: where it's kept, whether it syncs (where Sync is in the build), and
// for an End-to-end vault its badge and whether this device remembers its key. Each has a tooltip; a
// vault row's button says them all to screen readers and shows them on keyboard focus. A Standard
// vault has no encryption badge: its files aren't encrypted.
type PapelizVaultRowWordKind = 'browser-storage' | 'folder-storage' | 'sync' | 'end-to-end-encryption' | 'remembered' | 'local'

const papelizVaultRowWordTooltips: Record<PapelizVaultRowWordKind, { vaultRowWordTitle: string; vaultRowWordTooltipText: string }> = {
  'browser-storage': { vaultRowWordTitle: 'Browser Storage', vaultRowWordTooltipText: 'Kept inside this browser. Download backups, since a browser can clear it.' },
  'folder-storage': { vaultRowWordTitle: 'Folder Storage', vaultRowWordTooltipText: 'Kept in a folder on this device.' },
  sync: { vaultRowWordTitle: 'Sync', vaultRowWordTooltipText: 'Kept in sync with your other devices through Papeliz Sync.' },
  'end-to-end-encryption': {
    vaultRowWordTitle: papelizEndToEndVaultBadgeWords,
    vaultRowWordTooltipText: 'Encrypted on this device with your passphrase. Only you can read it, and Papeliz can’t recover the passphrase.',
  },
  remembered: { vaultRowWordTitle: papelizRememberedEndToEndVaultChipWords, vaultRowWordTooltipText: papelizRememberedEndToEndVaultChipTooltipText },
  local: { vaultRowWordTitle: 'Local', vaultRowWordTooltipText: 'Only on this device. It doesn’t sync.' },
}

// A vault row's words, in order: where it's kept, then (where Sync is in the build) Sync or Local, then
// an End-to-end vault's badge and Remembered. `isRecentVaultSynced` is undefined where there are no
// sync badges.
function listVaultRowWordKinds(recentVault: PapelizStartScreenRecentVault, isRecentVaultSynced: boolean | undefined): PapelizVaultRowWordKind[] {
  const vaultRowWordKinds: PapelizVaultRowWordKind[] = [recentVault.papelizRecentVaultKind === 'browser-vault-in-opfs' ? 'browser-storage' : 'folder-storage']
  if (isRecentVaultSynced !== undefined) vaultRowWordKinds.push(isRecentVaultSynced ? 'sync' : 'local')
  if (isPapelizRecentVaultEndToEnd(recentVault)) {
    vaultRowWordKinds.push('end-to-end-encryption')
    if (recentVault.papelizRecentVaultEncryption?.isVaultEncryptionKeyRememberedOnThisDevice === true) vaultRowWordKinds.push('remembered')
  }
  return vaultRowWordKinds
}

// The vault's own kind, as this device last saw it.
function isPapelizRecentVaultEndToEnd(recentVault: PapelizStartScreenRecentVault): boolean {
  return recentVault.papelizRecentVaultEncryption?.papelizVaultEncryptionKind === 'end-to-end'
}

// Where an End-to-end vault is, on Unlock: its whole path in Papeliz for Windows, its storage on the web.
function describeEndToEndVaultPlace(recentVault: PapelizStartScreenRecentVault | undefined, papelizLockedEndToEndVault: PapelizLockedEndToEndVault): string {
  if (recentVault !== undefined && isPapelizRecentDesktopFolderVault(recentVault)) return recentVault.desktopVaultFolderPath
  const isBrowserVault =
    recentVault === undefined ? papelizLockedEndToEndVault.lockedStoredVaultAdapter.papelizVaultKind === 'browser-vault-in-opfs' : recentVault.papelizRecentVaultKind === 'browser-vault-in-opfs'
  return isBrowserVault ? 'Browser Storage' : 'Folder Storage'
}

// The row's words as one description, for screen readers.
function describeVaultRowWords(vaultRowWordKinds: readonly PapelizVaultRowWordKind[]): string {
  return vaultRowWordKinds
    .map((vaultRowWordKind) => `${papelizVaultRowWordTooltips[vaultRowWordKind].vaultRowWordTitle}: ${papelizVaultRowWordTooltips[vaultRowWordKind].vaultRowWordTooltipText}`)
    .join(' ')
}

// A word under a vault's name, with its tooltip on hover.
function PapelizVaultRowWord({ vaultRowWordKind, className, children }: { vaultRowWordKind: PapelizVaultRowWordKind; className: string; children: ReactNode }) {
  const { vaultRowWordTitle, vaultRowWordTooltipText } = papelizVaultRowWordTooltips[vaultRowWordKind]
  return (
    <PapelizHoverTooltip tooltipLineTitle={vaultRowWordTitle} tooltipLineText={vaultRowWordTooltipText} className={className}>
      {children}
    </PapelizHoverTooltip>
  )
}

// Where a recent vault is kept, under its name: Browser Storage or Folder Storage, New Vault's names.
function PapelizRecentVaultPlace({ recentVault }: { recentVault: PapelizStartScreenRecentVault }) {
  const isBrowserVault = recentVault.papelizRecentVaultKind === 'browser-vault-in-opfs'
  return (
    <PapelizVaultRowWord vaultRowWordKind={isBrowserVault ? 'browser-storage' : 'folder-storage'} className="inline-flex items-center gap-1">
      {isBrowserVault ? <AppWindow className="size-3 flex-none" aria-hidden="true" /> : <HardDrive className="size-3 flex-none" aria-hidden="true" />}
      {papelizVaultRowWordTooltips[isBrowserVault ? 'browser-storage' : 'folder-storage'].vaultRowWordTitle}
    </PapelizVaultRowWord>
  )
}

// The count of hidden vaults, in gray: beside the Hidden list's title, and on the eye's corner.
const papelizHiddenVaultCountBadgeClassName =
  'grid place-items-center rounded-full border border-papeliz-line bg-papeliz-surface leading-none font-bold text-papeliz-ink-muted tabular-nums'

// "Hidden 12 minutes ago", on a hidden vault's row.
function describeHiddenVaultTime(recentVault: PapelizStartScreenRecentVault): string {
  return `Hidden ${describeTimeSince(recentVault.papelizVaultHiddenAt ?? recentVault.papelizVaultLastOpenedAt).toLowerCase()}`
}

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
  // Lit while its panel shows in the start card (Recent Vaults, New Vault, Synced Vaults): a brighter
  // fill with a white left edge.
  isWelcomeActionCurrent?: boolean
  welcomeActionButtonRef?: Ref<HTMLButtonElement>
  onWelcomeActionSelect: () => void
}

// One of the start screen's actions, on the blue panel.
function PapelizWelcomeAction({
  WelcomeActionIcon,
  welcomeActionTitle,
  welcomeActionDescription,
  isWelcomeActionDisabled,
  welcomeActionOffReasonText = null,
  isWelcomeActionCurrent = false,
  welcomeActionButtonRef,
  onWelcomeActionSelect,
}: PapelizWelcomeActionProps) {
  const isWelcomeActionOff = welcomeActionOffReasonText !== null
  return (
    <div className="group/welcome-action relative">
      <button
        ref={welcomeActionButtonRef}
        type="button"
        disabled={isWelcomeActionDisabled}
        aria-disabled={isWelcomeActionOff || undefined}
        aria-current={isWelcomeActionCurrent || undefined}
        onClick={onWelcomeActionSelect}
        className={joinPapelizClassNames(
          'flex min-h-[42px] w-full min-w-0 items-center gap-2 rounded-[10px] border px-2 py-[7px] text-left text-white transition-[background-color,border-color,transform,box-shadow] duration-150 ease-out focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50',
          isWelcomeActionCurrent
            ? 'border-white/45 bg-white/[0.28] shadow-[inset_3px_0_0_#fff]'
            : joinPapelizClassNames(
                'border-white/15 bg-white/[0.07]',
                isWelcomeActionOff
                  ? 'cursor-not-allowed'
                  : 'enabled:hover:-translate-y-px enabled:hover:border-white/30 enabled:hover:bg-white/[0.14] enabled:active:scale-[0.99]',
              ),
        )}
      >
        <span className={joinPapelizClassNames('grid size-6 flex-none place-items-center rounded-md bg-white/[0.14]', isWelcomeActionOff && 'opacity-55')}>
          <WelcomeActionIcon className="size-3.5" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-col items-start leading-tight">
          <span className={joinPapelizClassNames('max-w-full truncate text-[12px] font-semibold', isWelcomeActionOff && 'opacity-55')}>{welcomeActionTitle}</span>
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

// A recent vault's sync badge after where it's kept: "Sync" (green), or "Local" (orange) for a vault
// that doesn't sync (a copy that won't sync among them).
function PapelizRecentVaultSyncBadge({ isRecentVaultSynced }: { isRecentVaultSynced: boolean }) {
  if (!isRecentVaultSynced) {
    return (
      <PapelizVaultRowWord vaultRowWordKind="local" className={joinPapelizClassNames(papelizVaultRowBadgeClassName, 'bg-papeliz-callout-orange-ground text-papeliz-callout-orange-ink')}>
        Local
      </PapelizVaultRowWord>
    )
  }
  return (
    <PapelizVaultRowWord vaultRowWordKind="sync" className={joinPapelizClassNames(papelizVaultRowBadgeClassName, 'bg-papeliz-callout-green-ground text-papeliz-callout-green-ink')}>
      <CloudCheck className="size-3" aria-hidden="true" />
      Sync
    </PapelizVaultRowWord>
  )
}

// An End-to-end vault's badges, in every build: End-to-End Encryption (purple, with a lock), and a grey
// "Remembered" when this device opens it without the passphrase.
function PapelizRecentVaultEncryptionBadges({ recentVault }: { recentVault: PapelizStartScreenRecentVault }) {
  if (!isPapelizRecentVaultEndToEnd(recentVault)) return null
  return (
    <>
      <PapelizVaultRowWord vaultRowWordKind="end-to-end-encryption" className={joinPapelizClassNames(papelizVaultRowBadgeClassName, papelizEndToEndVaultBadgeColorClassName)}>
        <Lock className="size-3" aria-hidden="true" />
        {papelizEndToEndVaultBadgeWords}
      </PapelizVaultRowWord>
      {recentVault.papelizRecentVaultEncryption?.isVaultEncryptionKeyRememberedOnThisDevice === true && (
        <PapelizVaultRowWord vaultRowWordKind="remembered" className={joinPapelizClassNames(papelizVaultRowBadgeClassName, 'bg-papeliz-surface-gray text-papeliz-ink-muted')}>
          <KeyRound className="size-3" aria-hidden="true" />
          {papelizRememberedEndToEndVaultChipWords}
        </PapelizVaultRowWord>
      )}
    </>
  )
}

// What the delete dialog is about to delete: one hidden vault, or every hidden vault (Delete All).
type PapelizRecentVaultDeleteRequest =
  | { recentVaultDeleteScope: 'one-vault'; recentVault: PapelizStartScreenRecentVault }
  | { recentVaultDeleteScope: 'all-hidden-vaults'; recentVaults: readonly PapelizStartScreenRecentVault[] }

// The delete dialog's first words: what goes, and from where. Nothing deleted goes to the Recycle Bin.
function describeRecentVaultDeleteRequest(recentVaultDeleteRequest: PapelizRecentVaultDeleteRequest): string {
  if (recentVaultDeleteRequest.recentVaultDeleteScope === 'one-vault') {
    const { recentVault } = recentVaultDeleteRequest
    return recentVault.papelizRecentVaultKind === 'browser-vault-in-opfs'
      ? `This deletes the vault “${recentVault.papelizVaultDisplayName}” and every note and file in it from this browser. It can’t be undone.`
      : `This deletes the folder “${recentVault.papelizVaultDisplayName}” and every note and file in it from your disk. It doesn’t go to the Recycle Bin, and it can’t be undone.`
  }
  const isBrowserVaultDeleted = recentVaultDeleteRequest.recentVaults.some((recentVault) => recentVault.papelizRecentVaultKind === 'browser-vault-in-opfs')
  return isBrowserVaultDeleted
    ? 'This deletes every vault in the Hidden list, with every note and file in it: folders from your disk, browser vaults from this browser. It can’t be undone.'
    : 'This deletes every vault in the Hidden list: each folder and every note and file in it, from your disk. It doesn’t go to the Recycle Bin, and it can’t be undone.'
}

// The start screen, shown when no vault is open: on the blue panel, Papeliz, the ways in (Recent
// Vaults; a new vault, an import into this browser, a folder already in use; Templates and, where the
// build has Sync, Synced Vaults at the foot) and who made it; beside it, the vaults opened
// before, to come back to in one click, each saying whether it syncs, and the Hidden list. Recent
// Vaults' button and the logo in the top bar bring that list back from any other panel. A new vault
// is a folder on the disk or a browser vault: Chrome and Edge ask which, other browsers keep it in
// the browser. Hide only takes a vault off Recent vaults; Delete in the Hidden list erases it, from
// the disk or from this browser, once its name is typed. In a browser that can keep neither kind, the
// actions say so on a badge, on hover and in a toast; where only folders are missing, Open Vault goes.
// In Papeliz for Windows every vault is a real folder, picked in Windows' own folder picker: New Vault
// makes no browser vault and the lists show none; the sample stays. In development builds the eye
// previewer in an open vault's file list can hold it in any of its states, with made-up vaults;
// nothing on the disk or in the browser's storage changes then.
export function PapelizWelcomeScreen() {
  const heldStartScreenEyePreview = usePapelizStartScreenEyePreviewStore((eyePreviewState) => eyePreviewState.heldStartScreenEyePreview)
  return (
    <PapelizWelcomeScreenContent
      key={heldStartScreenEyePreview?.startScreenEyePreviewNumber ?? 'live'}
      startScreenEyePreview={heldStartScreenEyePreview}
    />
  )
}

function findPreviewHiddenRecentVaults(startScreenEyePreview: PapelizStartScreenEyePreview): PapelizRecentVault[] {
  return startScreenEyePreview.previewRememberedVaultFolders.filter(isPapelizRecentVaultHidden)
}

function PapelizWelcomeScreenContent({ startScreenEyePreview }: { startScreenEyePreview: PapelizStartScreenEyePreview | null }) {
  const desktopWindowBarDragHandlers = usePapelizDesktopWindowBarDragHandlers()
  const openVaultInWorkspace = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVaultInWorkspace)
  const showWorkspaceNotice = usePapelizWorkspaceStore((workspaceState) => workspaceState.showWorkspaceNotice)
  const askBrowserToKeepStorage = usePapelizBrowserStorageStore((browserStorageState) => browserStorageState.askBrowserToKeepStorage)
  const [recentVaults, setRecentVaults] = useState<PapelizStartScreenRecentVault[]>(
    () => startScreenEyePreview?.previewRememberedVaultFolders ?? [],
  )
  const [recentVaultSearchText, setRecentVaultSearchText] = useState(startScreenEyePreview?.previewRecentVaultSearchText ?? '')
  const [isHiddenVaultListShown, setHiddenVaultListShown] = useState(startScreenEyePreview?.isPreviewHiddenVaultListShown ?? false)
  const [isRecentVaultListReloading, setRecentVaultListReloading] = useState(startScreenEyePreview?.isPreviewRecentVaultListReloading ?? false)
  const [recentVaultDeleteRequest, setRecentVaultDeleteRequest] = useState<PapelizRecentVaultDeleteRequest | null>(() => {
    if (startScreenEyePreview === null || startScreenEyePreview.previewVaultFolderDeleteScope === null) return null
    const previewHiddenRecentVaults = findPreviewHiddenRecentVaults(startScreenEyePreview)
    if (startScreenEyePreview.previewVaultFolderDeleteScope === 'all-hidden-vaults') {
      return { recentVaultDeleteScope: 'all-hidden-vaults', recentVaults: previewHiddenRecentVaults }
    }
    const firstPreviewHiddenRecentVault = previewHiddenRecentVaults[0]
    return firstPreviewHiddenRecentVault === undefined ? null : { recentVaultDeleteScope: 'one-vault', recentVault: firstPreviewHiddenRecentVault }
  })
  // New Vault's form, shown in the start card in place of Recent Vaults, with the name it suggests.
  const [newVaultFormRequest, setNewVaultFormRequest] = useState<{ suggestedNewVaultName: string; initialNewVaultPlace?: PapelizNewVaultPlace } | null>(null)
  // Why New Vault's last Create Vault (or Browse…) didn't work, shown in the form under Location.
  const [newVaultCreateFailureMessage, setNewVaultCreateFailureMessage] = useState<string | null>(null)
  // Unlock, shown there instead for an End-to-end vault opened from a row or Open Vault, or locked.
  const [endToEndVaultUnlockRequest, setEndToEndVaultUnlockRequest] = useState<{
    papelizLockedEndToEndVault: PapelizLockedEndToEndVault
    endToEndVaultPlaceLine: string
    endToEndVaultUnlockReason: PapelizEndToEndVaultUnlockReason
    endToEndVaultUnlockNoticeLine: string | null
  } | null>(null)
  // The Synced Vaults page, shown there instead, and why the sign-in its button started didn't happen.
  const [isSyncedVaultsPageShown, setSyncedVaultsPageShown] = useState(false)
  // A pick in the page's previewer (development builds only) shows the page in that state.
  const heldSyncedVaultsPagePreview = usePapelizSyncSyncedVaultsPagePreviewStore((syncedVaultsPagePreviewState) => syncedVaultsPagePreviewState.heldSyncedVaultsPagePreview)
  const isSyncedVaultsPageOnScreen = isSyncedVaultsPageShown || heldSyncedVaultsPagePreview !== null
  // Templates' pages, shown there instead, as Synced Vaults' is; its previewer can hold them too. The
  // website's Open in Papeliz opens them at once, on the template its address names.
  const [templateGalleryIdFromAddress, setTemplateGalleryIdFromAddress] = useState(takePapelizTemplateGalleryIdFromAddress)
  const [isTemplateGalleryPageShown, setTemplateGalleryPageShown] = useState(templateGalleryIdFromAddress !== null)
  const heldTemplateGalleryPagePreview = usePapelizTemplateGalleryPagePreviewStore((templateGalleryPagePreviewState) => templateGalleryPagePreviewState.heldTemplateGalleryPagePreview)
  const isTemplateGalleryPageOnScreen = !isSyncedVaultsPageOnScreen && (isTemplateGalleryPageShown || heldTemplateGalleryPagePreview !== null)
  const syncStartScreenDownloadsByVaultId = usePapelizSyncStartScreenDownloadStore((syncStartScreenDownloadState) => syncStartScreenDownloadState.syncStartScreenDownloadsByVaultId)
  // New Vault's button, where focus goes back when its form is cancelled.
  const newVaultActionButtonRef = useRef<HTMLButtonElement>(null)
  // Rename's dialog, for a browser vault, while it is open.
  const [browserVaultNameDialogRequest, setBrowserVaultNameDialogRequest] = useState<{ renamedBrowserVaultRecord: PapelizBrowserVaultRecord } | null>(null)
  // What has been typed in the delete dialog: the vault's name, or for Delete All the count.
  const [typedVaultDeleteConfirmation, setTypedVaultDeleteConfirmation] = useState('')
  const [deletingPapelizVaultIds, setDeletingPapelizVaultIds] = useState<ReadonlySet<string> | null>(() =>
    startScreenEyePreview?.isPreviewVaultFolderDeleting === true
      ? new Set(findPreviewHiddenRecentVaults(startScreenEyePreview).map((recentVault) => recentVault.papelizVaultId))
      : null,
  )
  const [isOpeningVault, setIsOpeningVault] = useState(false)
  // The system's folder window is open (Open Vault, or New Vault's Pick Folder): the list says so, in
  // case the window opened behind this one or on another screen.
  const [isVaultFolderWindowOpen, setVaultFolderWindowOpen] = useState(false)
  // The recent vault row a keyboard user is on: its words' tooltips show under them.
  const [keyboardFocusedVaultRowWords, setKeyboardFocusedVaultRowWords] = useState<{
    focusedPapelizVaultId: string
    vaultRowWordKinds: readonly PapelizVaultRowWordKind[]
    vaultRowWordsElement: HTMLElement
  } | null>(null)
  const hideKeyboardFocusedVaultRowWords = useCallback(() => setKeyboardFocusedVaultRowWords(null), [])
  // The start card's right-hand panel (Recent Vaults, New Vault, Synced Vaults). On a phone it sits under
  // the blue panel's buttons, so pressing one scrolls it to the top of the screen.
  const startPagePanelRef = useRef<HTMLElement>(null)
  // The recent vault whose menu is open (from a right-click or its "…" button), and where.
  const [recentVaultMenu, setRecentVaultMenu] = useState<{
    recentVault: PapelizStartScreenRecentVault
    recentVaultMenuPosition: PapelizPopoverMenuPosition
  } | null>(null)
  // The folder window failed to open from a click of the user's own: opening a folder is off for
  // this page until Try again.
  const [isFolderChooserUnavailable, setFolderChooserUnavailable] = useState(startScreenEyePreview?.previewFolderAccessOffReason === 'chooser-unavailable')

  // Papeliz for Windows opens folders through its native side, whatever its web view supports.
  const detectedFolderAccessSupport = useMemo(
    () => (isPapelizDesktopApp ? { isFolderAccessOn: true, folderAccessOffReason: null } : detectPapelizFolderAccessSupport()),
    [],
  )
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

  // Browser vaults: what the browser has, then whether it lets this page use its storage.
  const [browserVaultOffReason, setBrowserVaultOffReason] = useState<PapelizBrowserVaultOffReason | null>(
    () => detectPapelizBrowserVaultSupport().browserVaultOffReason,
  )
  useEffect(() => {
    let isProbeAnswerWanted = true
    void probePapelizBrowserVaultStorage().then((probedBrowserVaultSupport) => {
      if (isProbeAnswerWanted) setBrowserVaultOffReason(probedBrowserVaultSupport.browserVaultOffReason)
    })
    return () => {
      isProbeAnswerWanted = false
    }
  }, [])
  // Papeliz for Windows lists and makes no browser vault: every vault there is a real folder.
  const isBrowserVaultOn = !isPapelizDesktopApp && browserVaultOffReason === null
  const browserVaultOffReasonText = browserVaultOffReason === null ? null : describePapelizBrowserVaultOffReason(browserVaultOffReason)
  // New Vault: a folder, a browser vault, or (Chrome and Edge) a choice of the two.
  const isFolderVaultOn = folderAccessOffReason === null
  const isNewVaultPlaceChoiceShown = isFolderVaultOn && isBrowserVaultOn
  // Where folders can't be opened at all but browser vaults work, Open Vault would never work.
  const isOpenFolderVaultActionShown = !(folderAccessOffReason === 'unsupported' && isBrowserVaultOn)
  const browserVaultRecords = useMemo(
    () =>
      recentVaults.filter(
        (recentVault): recentVault is Extract<PapelizStartScreenRecentVault, { papelizRecentVaultKind: 'browser-vault-in-opfs' }> =>
          recentVault.papelizRecentVaultKind === 'browser-vault-in-opfs',
      ),
    [recentVaults],
  )

  // A preview keeps its made-up vaults: the real list is read only when live.
  const reloadRecentVaults = useCallback(() => {
    if (startScreenEyePreview !== null) return
    listPapelizRecentVaults(isBrowserVaultOn)
      .then(setRecentVaults)
      .catch(() => setRecentVaults([]))
  }, [startScreenEyePreview, isBrowserVaultOn])

  useEffect(reloadRecentVaults, [reloadRecentVaults])
  // Another tab made, renamed, hid or deleted a browser vault.
  useEffect(() => subscribeToPapelizBrowserVaultListChanges(reloadRecentVaults), [reloadRecentVaults])

  // A preview's toast shows once it opens.
  useEffect(() => {
    const previewStartScreenNotice = startScreenEyePreview?.previewStartScreenNotice
    if (previewStartScreenNotice === null || previewStartScreenNotice === undefined) return
    if (startScreenEyePreview?.previewFolderAccessOffReason === 'chooser-unavailable') {
      showWorkspaceNotice(previewStartScreenNotice.previewNoticeKind, previewStartScreenNotice.previewNoticeMessage, {
        workspaceNoticeActionLabel: 'Try Again',
        onWorkspaceNoticeAction: () => setFolderChooserUnavailable(false),
      })
      return
    }
    showWorkspaceNotice(previewStartScreenNotice.previewNoticeKind, previewStartScreenNotice.previewNoticeMessage)
  }, [startScreenEyePreview, showWorkspaceNotice])

  // In a preview, anything that would touch a folder or the remembered list says so instead.
  const showStartScreenPreviewOnlyNotice = () =>
    showWorkspaceNotice('info', 'Nothing changed: this is only a preview.')

  const recentListVaults = useMemo(
    () => recentVaults.filter((recentVault) => !isPapelizRecentVaultHidden(recentVault)),
    [recentVaults],
  )
  // Most recently hidden first.
  const hiddenRecentVaults = useMemo(
    () =>
      recentVaults
        .filter(isPapelizRecentVaultHidden)
        .sort((firstRecentVault, secondRecentVault) => (secondRecentVault.papelizVaultHiddenAt ?? 0) - (firstRecentVault.papelizVaultHiddenAt ?? 0)),
    [recentVaults],
  )
  const listedRecentVaults = isHiddenVaultListShown ? hiddenRecentVaults : recentListVaults
  // The Hidden list's eye: once there is a vault, hidden or not, and always in the Hidden list, the way back.
  const isHiddenVaultToggleShown = recentVaults.length > 0 || isHiddenVaultListShown

  const shownRecentVaults = useMemo(() => {
    const lowerCaseSearchText = recentVaultSearchText.trim().toLowerCase()
    if (lowerCaseSearchText.length === 0) return listedRecentVaults
    return listedRecentVaults.filter((recentVault) => recentVault.papelizVaultDisplayName.toLowerCase().includes(lowerCaseSearchText))
  }, [recentVaultSearchText, listedRecentVaults])

  // The toast for a folder action that is off: why, with Try Again when this page turned it off.
  // Try Again turns it back on and, for Open Vault, opens the folder window again at once, from its own
  // click (in a preview it only turns it back on). New Vault's form is back, for Pick Folder again.
  const showFolderAccessOffNotice = (offReason: PapelizFolderAccessOffReason, isNewVault: boolean) => {
    const isOffReasonRetryable = offReason === 'chooser-unavailable' && detectedFolderAccessOffReason === null
    showWorkspaceNotice(
      'error',
      describePapelizFolderAccessOffReason(offReason),
      isOffReasonRetryable
        ? {
            workspaceNoticeActionLabel: 'Try Again',
            onWorkspaceNoticeAction: () => {
              setFolderChooserUnavailable(false)
              if (startScreenEyePreview === null && !isNewVault) void pickAndOpenFolderVault(false)
            },
          }
        : undefined,
    )
  }

  // Opens a vault: a picked or remembered folder, or a browser vault. A new vault with no notes yet
  // starts its first note right away, named and ready to write in.
  // An End-to-end vault shows Unlock, saying how it was found.
  const finishOpeningVault = async (
    openVaultResult: PapelizExistingVaultOpenResult,
    isNewVault: boolean,
    endToEndVaultUnlockReason: PapelizEndToEndVaultUnlockReason = 'opened-from-recent-vaults',
  ) => {
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
    if (openVaultResult.openVaultOutcome === 'needs-unlock') {
      await startEndToEndVaultUnlock(openVaultResult.papelizLockedEndToEndVault, endToEndVaultUnlockReason)
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

  // An End-to-end vault found: a key this device remembers opens it at once (except after Lock Now,
  // which asks again); otherwise Unlock shows in the start card.
  const startEndToEndVaultUnlock = async (
    papelizLockedEndToEndVault: PapelizLockedEndToEndVault,
    endToEndVaultUnlockReason: PapelizEndToEndVaultUnlockReason,
    lockedRecentVault = recentVaults.find((recentVault) => recentVault.papelizVaultId === papelizLockedEndToEndVault.papelizVaultId),
  ) => {
    let endToEndVaultUnlockNoticeLine: string | null = null
    if (endToEndVaultUnlockReason !== 'locked-now') {
      const rememberedKeyUnlockResult = await unlockPapelizEndToEndVaultWithRememberedKey(papelizLockedEndToEndVault)
      if (rememberedKeyUnlockResult.endToEndVaultUnlockOutcome === 'unlocked') {
        await openUnlockedEndToEndVault(rememberedKeyUnlockResult.papelizOpenVault)
        return
      }
      if (rememberedKeyUnlockResult.endToEndVaultUnlockOutcome === 'failed') {
        endToEndVaultUnlockNoticeLine = describePapelizVaultEncryptionFailureMessage(
          `“${papelizLockedEndToEndVault.papelizVaultDisplayName}” didn’t open without its passphrase`,
          rememberedKeyUnlockResult.vaultEncryptionFailureCode,
        )
        reloadRecentVaults()
      }
    }
    closeSyncedVaultsPage()
    closeTemplateGalleryPage()
    setNewVaultFormRequest(null)
    setEndToEndVaultUnlockRequest({
      papelizLockedEndToEndVault,
      endToEndVaultPlaceLine: describeEndToEndVaultPlace(lockedRecentVault, papelizLockedEndToEndVault),
      endToEndVaultUnlockReason,
      endToEndVaultUnlockNoticeLine,
    })
    scrollStartPagePanelIntoViewOnPhone()
  }

  // Unlocked: the vault opens, and its row says whether it's remembered now.
  const openUnlockedEndToEndVault = async (unlockedOpenVault: PapelizOpenVault) => {
    setEndToEndVaultUnlockRequest(null)
    reloadRecentVaults()
    await openVaultInWorkspace(unlockedOpenVault, { firstVaultNoteRelativePathToOpen: null, firstNoteViewMode: 'md-code', expandAllTopLevelFolders: false })
  }

  const cancelEndToEndVaultUnlock = () => setEndToEndVaultUnlockRequest(null)

  // Lock Now just locked a vault: its Unlock shows, saying so. The vault is found again from its row.
  useEffect(() => {
    if (startScreenEyePreview !== null) return
    const lockedEndToEndVaultForUnlock = usePapelizWorkspaceStore.getState().takeLockedEndToEndVaultForUnlock()
    if (lockedEndToEndVaultForUnlock === null) return
    void (async () => {
      const lockedRecentVault = (await listPapelizRecentVaults(isBrowserVaultOn).catch(() => [])).find(
        (recentVault) => recentVault.papelizVaultId === lockedEndToEndVaultForUnlock.papelizVaultId,
      )
      if (lockedRecentVault === undefined) return
      const lockedVaultOpenResult = await reopenPapelizRecentVault(lockedRecentVault)
      if (lockedVaultOpenResult.openVaultOutcome === 'needs-unlock') await startEndToEndVaultUnlock(lockedVaultOpenResult.papelizLockedEndToEndVault, 'locked-now', lockedRecentVault)
    })()
    // Once, as the start screen appears after Lock Now.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Synced Vaults, at the panel's foot, only in a build with Sync's engine switched on (and in
  // development builds on the fake engine). It needs somewhere to put a vault.
  const isSyncedVaultsActionShown = useMemo(() => isPapelizSyncEngineInThisBuild || readPapelizSyncDevFakeEngineScenarioText() !== null, [])
  const syncedVaultsActionOffReasonText = isFolderVaultOn || isBrowserVaultOn ? null : (browserVaultOffReasonText ?? folderAccessOffReasonText)

  // A device signed in to Sync before (or the dev fake engine) loads the engine now, for the recent
  // vaults' "Sync" badge and the downloads left unfinished below.
  const loadPapelizSyncEngine = usePapelizSyncEngineStore((syncEngineState) => syncEngineState.loadPapelizSyncEngine)
  const isPapelizSyncExpectedOnThisDevice = useMemo(() => isPapelizSyncUsedOnThisDevice() || readPapelizSyncDevFakeEngineScenarioText() !== null, [])
  useEffect(() => {
    if (!isSyncedVaultsActionShown || startScreenEyePreview !== null) return
    if (isPapelizSyncExpectedOnThisDevice) void loadPapelizSyncEngine()
  }, [isSyncedVaultsActionShown, startScreenEyePreview, isPapelizSyncExpectedOnThisDevice, loadPapelizSyncEngine])

  // Once the engine has loaded: which recent vaults sync ("Sync" on their row, while signed in; "Local"
  // otherwise), and the first downloads closing the tab left unfinished, picked up once the list is
  // read. A build without Sync shows neither badge.
  const syncEngineReading = usePapelizSyncEngineSnapshot()
  const loadedSyncEngine = syncEngineReading?.papelizSyncEngine ?? null
  const syncEngineSnapshot = syncEngineReading?.syncEngineSnapshot ?? null
  const recentVaultSyncedVaultIds = useMemo(
    () => (isSyncedVaultsActionShown ? readPapelizRecentVaultSyncedVaultIds({ isPapelizSyncExpectedOnThisDevice, syncEngineSnapshot }) : null),
    [isSyncedVaultsActionShown, isPapelizSyncExpectedOnThisDevice, syncEngineSnapshot],
  )
  const unfinishedSyncDownloadVaultIdsText =
    syncEngineSnapshot?.syncLinkedLocalVaults
      .filter((syncLinkedLocalVault) => syncLinkedLocalVault.isFirstDownloadUnfinished)
      .map((syncLinkedLocalVault) => syncLinkedLocalVault.papelizVaultId)
      .join('\n') ?? ''
  // Sync's downloads go into a folder opened in the browser or a browser vault, never a folder by path.
  const syncDownloadRecentVaults = useMemo(
    () => recentVaults.filter((recentVault): recentVault is PapelizRecentVault => !isPapelizRecentDesktopFolderVault(recentVault)),
    [recentVaults],
  )
  useEffect(() => {
    if (loadedSyncEngine === null || startScreenEyePreview !== null || unfinishedSyncDownloadVaultIdsText === '') return
    void resumePapelizSyncStartScreenDownloads(loadedSyncEngine, syncDownloadRecentVaults)
  }, [loadedSyncEngine, startScreenEyePreview, unfinishedSyncDownloadVaultIdsText, syncDownloadRecentVaults])
  // Every vault this device holds, hidden ones too: the Synced Vaults page calls a synced vault copied into
  // one of them on this device.
  const recentVaultIds = useMemo(() => new Set(recentVaults.map((recentVault) => recentVault.papelizVaultId)), [recentVaults])

  // On a phone the right-hand panel sits under the blue panel's buttons: the page one of them chose
  // scrolls up to open at its top.
  const scrollStartPagePanelIntoViewOnPhone = () => {
    if (window.matchMedia('(min-width: 768px)').matches) return
    requestAnimationFrame(() => startPagePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  // Synced Vaults: only its page in the start card. Nothing of Sync loads or signs in until its
  // Fetch button is pressed.
  const openSyncedVaultsPage = () => {
    if (startScreenEyePreview !== null) {
      showStartScreenPreviewOnlyNotice()
      return
    }
    setNewVaultFormRequest(null)
    setEndToEndVaultUnlockRequest(null)
    closeTemplateGalleryPage()
    setSyncedVaultsPageShown(true)
    scrollStartPagePanelIntoViewOnPhone()
  }

  const closeSyncedVaultsPage = () => {
    setSyncedVaultsPageShown(false)
    returnPapelizSyncSyncedVaultsPageToLive()
  }

  // Templates: its pages in the start card. The gallery's list is read only once it's pressed.
  const openTemplateGalleryPage = () => {
    if (startScreenEyePreview !== null) {
      showStartScreenPreviewOnlyNotice()
      return
    }
    closeSyncedVaultsPage()
    setNewVaultFormRequest(null)
    setEndToEndVaultUnlockRequest(null)
    setTemplateGalleryPageShown(true)
    scrollStartPagePanelIntoViewOnPhone()
  }

  const closeTemplateGalleryPage = () => {
    setTemplateGalleryIdFromAddress(null)
    setTemplateGalleryPageShown(false)
    returnPapelizTemplateGalleryPageToLive()
  }

  // A vault made from a template opens on the template's first note, in MD View.
  const openTemplateVault = async (templateVault: PapelizOpenVault, templateFirstNotePath: string) => {
    await openVaultInWorkspace(templateVault, {
      firstVaultNoteRelativePathToOpen: templateFirstNotePath,
      firstNoteViewMode: 'md-view',
      expandAllTopLevelFolders: false,
    })
  }

  // Recent Vaults in the start card, from its button or the logo: Synced Vaults, Templates, New Vault's
  // form and the Hidden list give way to it. Its button stays lit in the Hidden list too, which its eye
  // opens.
  const isRecentVaultsPanelOnScreen = !isSyncedVaultsPageOnScreen && !isTemplateGalleryPageOnScreen && newVaultFormRequest === null && endToEndVaultUnlockRequest === null
  const showRecentVaults = () => {
    closeSyncedVaultsPage()
    closeTemplateGalleryPage()
    setNewVaultFormRequest(null)
    setEndToEndVaultUnlockRequest(null)
    if (isHiddenVaultListShown) {
      setHiddenVaultListShown(false)
      setRecentVaultSearchText('')
    }
  }

  // A synced vault already on this device, pressed on the Synced Vaults page, opens as its Recent
  // Vaults row does.
  const openVaultOnThisDeviceFromSyncedVaults = (papelizVaultId: string) => {
    if (heldSyncedVaultsPagePreview !== null) {
      showStartScreenPreviewOnlyNotice()
      return
    }
    const recentVaultToOpen = recentVaults.find((recentVault) => recentVault.papelizVaultId === papelizVaultId)
    if (recentVaultToOpen !== undefined && !isOpeningVault) void reopenRecentVault(recentVaultToOpen)
  }

  // New Vault: its form in the start card (the vault's name, and where to keep it).
  const startNewVault = () => {
    closeSyncedVaultsPage()
    closeTemplateGalleryPage()
    if (!isBrowserVaultOn && folderAccessOffReason === 'unsupported') {
      // Neither kind works here: the browser vault's reason says what to do.
      if (browserVaultOffReasonText !== null) showWorkspaceNotice('error', browserVaultOffReasonText)
      return
    }
    scrollStartPagePanelIntoViewOnPhone()
    setEndToEndVaultUnlockRequest(null)
    if (newVaultFormRequest !== null) return
    setNewVaultCreateFailureMessage(null)
    setNewVaultFormRequest({ suggestedNewVaultName: pickFreePapelizBrowserVaultName('Notes', browserVaultRecords) })
  }

  // New Vault's form cancelled: Recent Vaults again, and focus back on New Vault.
  const cancelNewVault = () => {
    setNewVaultFormRequest(null)
    setNewVaultCreateFailureMessage(null)
    newVaultActionButtonRef.current?.focus()
  }

  // New Vault's Browse…: the folder window picks where the vault's folder is made. Must run from a
  // click. Null when nothing was picked; a folder window that can't open, or a folder the browser won't
  // share, says so as Open Vault does.
  const pickNewVaultParentFolderFromForm = async (): Promise<PapelizNewVaultParentFolder | null> => {
    if (startScreenEyePreview !== null) {
      showStartScreenPreviewOnlyNotice()
      return null
    }
    setVaultFolderWindowOpen(true)
    let newVaultParentFolderPickResult: Awaited<ReturnType<typeof pickPapelizNewVaultParentFolder>>
    try {
      newVaultParentFolderPickResult = await pickPapelizNewVaultParentFolder()
    } finally {
      setVaultFolderWindowOpen(false)
    }
    if ('newVaultParentFolderPickOutcome' in newVaultParentFolderPickResult) {
      setNewVaultCreateFailureMessage(null)
      return newVaultParentFolderPickResult.pickedNewVaultParentFolder
    }
    if (newVaultParentFolderPickResult.openVaultOutcome === 'failed') setNewVaultCreateFailureMessage(newVaultParentFolderPickResult.openVaultFailureMessage)
    if (newVaultParentFolderPickResult.openVaultOutcome === 'chooser-unavailable') {
      setFolderChooserUnavailable(true)
      showFolderAccessOffNotice('chooser-unavailable', true)
    }
    return null
  }

  // New Vault's form confirmed. Runs from its click: the folder window and Firefox's question about
  // keeping storage need one. The form stays while the vault is made, and says under Location why it
  // couldn't be. End-to-end makes the new, empty vault End-to-end, and it opens unlocked for this
  // session. With "Sync This Vault" on, Sync is turned on for the vault once it opens.
  const finishNewVault = async (
    typedNewVaultName: string,
    chosenNewVaultPlace: PapelizNewVaultPlace,
    { newVaultParentFolder, newVaultEncryptionChoice, newVaultSyncVaultEncryptionChoice }: PapelizNewVaultConfirmDetails,
  ) => {
    if (startScreenEyePreview !== null) {
      showStartScreenPreviewOnlyNotice()
      return
    }
    setNewVaultCreateFailureMessage(null)
    const openNewVaultInWorkspace = async (madeVaultOpenResult: PapelizOpenVaultResult) => {
      const newVaultOpenResult = await makeNewVaultEndToEndWhenChosen(madeVaultOpenResult)
      if (newVaultOpenResult.openVaultOutcome === 'failed') {
        setNewVaultCreateFailureMessage(newVaultOpenResult.openVaultFailureMessage)
        return
      }
      if (newVaultOpenResult.openVaultOutcome === 'opened' && newVaultSyncVaultEncryptionChoice !== null) {
        waitToTurnPapelizSyncOnForNewVault(newVaultOpenResult.papelizOpenVault.papelizVaultId, newVaultSyncVaultEncryptionChoice)
      }
      if (newVaultOpenResult.openVaultOutcome === 'opened') setNewVaultFormRequest(null)
      await finishOpeningVault(newVaultOpenResult, true)
    }
    // The vault is made Standard and empty first, then End-to-end, which gives it back unlocked.
    const makeNewVaultEndToEndWhenChosen = async (madeVaultOpenResult: PapelizOpenVaultResult): Promise<PapelizOpenVaultResult> => {
      if (madeVaultOpenResult.openVaultOutcome !== 'opened' || newVaultEncryptionChoice.newVaultEncryptionKind !== 'end-to-end') return madeVaultOpenResult
      const endToEndVaultMakeResult = await makePapelizEndToEndVault({
        newVaultOpenVault: madeVaultOpenResult.papelizOpenVault,
        vaultPassphrase: newVaultEncryptionChoice.newEndToEndVaultPassphrase,
      })
      if (endToEndVaultMakeResult.endToEndVaultUnlockOutcome === 'unlocked') return { openVaultOutcome: 'opened', papelizOpenVault: endToEndVaultMakeResult.papelizOpenVault }
      madeVaultOpenResult.papelizOpenVault.papelizVaultAdapter.closeVaultAdapter?.()
      reloadRecentVaults()
      return {
        openVaultOutcome: 'failed',
        openVaultFailureMessage:
          endToEndVaultMakeResult.endToEndVaultUnlockOutcome === 'failed'
            ? describePapelizVaultEncryptionFailureMessage(`Couldn’t encrypt “${typedNewVaultName}”`, endToEndVaultMakeResult.vaultEncryptionFailureCode)
            : `Couldn’t encrypt “${typedNewVaultName}”.`,
      }
    }
    // Papeliz for Windows makes every new vault a folder. No folder picked yet: the folder window asks
    // now, from Create Vault's click.
    if (chosenNewVaultPlace === 'folder-on-disk' || isPapelizDesktopApp) {
      const pickedNewVaultParentFolder = newVaultParentFolder ?? (await pickNewVaultParentFolderFromForm())
      if (pickedNewVaultParentFolder === null) return
      setIsOpeningVault(true)
      try {
        await openNewVaultInWorkspace(await makeAndOpenNewPapelizFolderVault(pickedNewVaultParentFolder, typedNewVaultName))
      } finally {
        setIsOpeningVault(false)
      }
      return
    }
    askBrowserToKeepStorage()
    setIsOpeningVault(true)
    try {
      const createdBrowserVaultRecord = await createPapelizBrowserVault(typedNewVaultName)
      await openNewVaultInWorkspace(await openPapelizBrowserVault(createdBrowserVaultRecord))
    } catch (browserVaultCreateError) {
      setNewVaultCreateFailureMessage(
        describePapelizFailureMessage(`Couldn’t make “${typedNewVaultName}”`, browserVaultCreateError, { failedEntryName: typedNewVaultName, failedEntryKind: 'vault' }),
      )
      reloadRecentVaults()
    } finally {
      setIsOpeningVault(false)
    }
  }

  // Download backup for a browser vault in the list. Runs from its click: Chrome and Edge ask where.
  const downloadRecentBrowserVaultBackup = async (browserVaultRecord: PapelizBrowserVaultRecord) => {
    if (startScreenEyePreview !== null) {
      showStartScreenPreviewOnlyNotice()
      return
    }
    const browserVaultBackupDownloadResult = await downloadPapelizBrowserVaultBackupFromClick(browserVaultRecord)
    if (browserVaultBackupDownloadResult.browserVaultBackupDownloadOutcome === 'downloaded') {
      showWorkspaceNotice('info', `Backed up as “${browserVaultBackupDownloadResult.browserVaultBackupFileName}”.`)
    } else if (browserVaultBackupDownloadResult.browserVaultBackupDownloadOutcome === 'failed') {
      showWorkspaceNotice('error', browserVaultBackupDownloadResult.browserVaultBackupFailureMessage)
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
    setVaultFolderWindowOpen(true)
    try {
      let pickedVaultFolderOpenResult: PapelizExistingVaultOpenResult
      try {
        pickedVaultFolderOpenResult = await pickAndOpenPapelizVaultFolder()
      } finally {
        setVaultFolderWindowOpen(false)
      }
      await finishOpeningVault(pickedVaultFolderOpenResult, isNewVault, 'found-by-open-vault')
    } finally {
      setIsOpeningVault(false)
    }
  }

  const reopenRecentVault = async (recentVault: PapelizStartScreenRecentVault) => {
    if (startScreenEyePreview !== null) {
      showStartScreenPreviewOnlyNotice()
      return
    }
    if (recentVault.papelizRecentVaultKind === 'browser-vault-in-opfs') askBrowserToKeepStorage()
    setIsOpeningVault(true)
    try {
      await finishOpeningVault(await reopenPapelizRecentVault(recentVault), false)
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
    void listPapelizRecentVaults(isBrowserVaultOn)
      .then(setRecentVaults)
      .catch(() => setRecentVaults([]))
      .finally(() => {
        setTimeout(() => setRecentVaultListReloading(false), Math.max(0, papelizRecentVaultListReloadMinimumMilliseconds - (Date.now() - reloadStartedAt)))
      })
  }

  // Hides a vault into the Hidden list or restores it; the folder and its notes stay on the disk.
  const setRecentVaultHidden = (recentVault: PapelizStartScreenRecentVault, isVaultHidden: boolean) => {
    if (startScreenEyePreview !== null) {
      showStartScreenPreviewOnlyNotice()
      return
    }
    void setPapelizRecentVaultHidden(recentVault, isVaultHidden).finally(reloadRecentVaults)
  }

  // Runs straight from the dialog's click, so the browser can ask for permission to change a folder.
  // Delete All goes through the vaults in turn; one that can't be deleted now stays in the list.
  const deleteHiddenRecentVaults = async (confirmedRecentVaultDeleteRequest: PapelizRecentVaultDeleteRequest) => {
    const recentVaultsToDelete =
      confirmedRecentVaultDeleteRequest.recentVaultDeleteScope === 'one-vault'
        ? [confirmedRecentVaultDeleteRequest.recentVault]
        : confirmedRecentVaultDeleteRequest.recentVaults
    setRecentVaultDeleteRequest(null)
    if (startScreenEyePreview !== null) {
      showStartScreenPreviewOnlyNotice()
      return
    }
    setDeletingPapelizVaultIds(new Set(recentVaultsToDelete.map((recentVault) => recentVault.papelizVaultId)))
    try {
      const recentVaultDeleteFailureMessages: string[] = []
      for (const recentVault of recentVaultsToDelete) {
        const recentVaultDeleteResult = await deletePapelizRecentVault(recentVault)
        if (recentVaultDeleteResult.recentVaultDeleteOutcome === 'failed') recentVaultDeleteFailureMessages.push(recentVaultDeleteResult.recentVaultDeleteFailureMessage)
        else forgetPapelizSyncLinksOfDeletedVault(recentVault.papelizVaultId)
      }
      const deletedVaultCount = recentVaultsToDelete.length - recentVaultDeleteFailureMessages.length
      const keptVaultCount = recentVaultDeleteFailureMessages.length
      if (confirmedRecentVaultDeleteRequest.recentVaultDeleteScope === 'one-vault') {
        showWorkspaceNotice(
          keptVaultCount === 0 ? 'info' : 'error',
          recentVaultDeleteFailureMessages[0] ?? `Deleted “${confirmedRecentVaultDeleteRequest.recentVault.papelizVaultDisplayName}”.`,
        )
      } else if (keptVaultCount === 0) {
        showWorkspaceNotice('info', `Deleted ${deletedVaultCount} ${deletedVaultCount === 1 ? 'vault' : 'vaults'}.`)
      } else {
        // A vault that couldn't be deleted stays in the Hidden list.
        showWorkspaceNotice(
          'error',
          recentVaultsToDelete.length === 1
            ? (recentVaultDeleteFailureMessages[0] ?? '')
            : `Couldn’t delete ${keptVaultCount} of ${recentVaultsToDelete.length} vaults. They stay in Hidden Vaults, so you can try again.`,
        )
      }
    } finally {
      setDeletingPapelizVaultIds(null)
      reloadRecentVaults()
    }
  }

  const expectedVaultDeleteConfirmation =
    recentVaultDeleteRequest === null
      ? ''
      : recentVaultDeleteRequest.recentVaultDeleteScope === 'one-vault'
        ? recentVaultDeleteRequest.recentVault.papelizVaultDisplayName
        : String(recentVaultDeleteRequest.recentVaults.length)
  const isVaultDeleteConfirmationTyped = recentVaultDeleteRequest !== null && typedVaultDeleteConfirmation.trim() === expectedVaultDeleteConfirmation
  // A browser vault can always be deleted, and so can any folder in the desktop app (Papeliz for
  // Windows' native side erases it by its path); a folder opened in the browser only where the browser
  // can erase folders.
  const canDeleteRecentVault = (recentVault: PapelizStartScreenRecentVault) =>
    recentVault.papelizRecentVaultKind !== 'folder-on-disk' || isPapelizDesktopApp || isVaultFolderDeleteSupported()
  const canDeleteEveryHiddenRecentVault = hiddenRecentVaults.every(canDeleteRecentVault)
  const isFolderVaultListed = listedRecentVaults.some((recentVault) => recentVault.papelizRecentVaultKind !== 'browser-vault-in-opfs')
  const isBrowserVaultListed = listedRecentVaults.some((recentVault) => recentVault.papelizRecentVaultKind === 'browser-vault-in-opfs')

  // Rename's dialog confirmed, for a browser vault.
  const finishBrowserVaultRename = async (renamedBrowserVaultRecord: PapelizBrowserVaultRecord, typedBrowserVaultName: string) => {
    setBrowserVaultNameDialogRequest(null)
    if (startScreenEyePreview !== null) {
      showStartScreenPreviewOnlyNotice()
      return
    }
    try {
      await renamePapelizBrowserVault(renamedBrowserVaultRecord.papelizVaultId, typedBrowserVaultName)
    } catch (browserVaultRenameError) {
      showWorkspaceNotice(
        'error',
        describePapelizFailureMessage(`Couldn’t rename “${renamedBrowserVaultRecord.papelizVaultDisplayName}”`, browserVaultRenameError, {
          failedEntryName: typedBrowserVaultName,
          failedEntryKind: 'vault',
        }),
      )
    } finally {
      reloadRecentVaults()
    }
  }

  const openSampleVault = () =>
    openVaultInWorkspace(openPapelizSampleVault(), {
      firstVaultNoteRelativePathToOpen: papelizSampleVaultFirstNoteRelativePath,
      firstNoteViewMode: 'md-view',
      expandAllTopLevelFolders: true,
    })

  return (
    // The blue bar stays put and only the card's place scrolls on a short window, so Papeliz for
    // Windows' window buttons and the bar's drag area never scroll away.
    <div className="flex h-dvh flex-col overflow-hidden bg-papeliz-surface-soft">
      <header
        {...desktopWindowBarDragHandlers}
        className={joinPapelizClassNames(
          'flex h-12 flex-none items-center gap-2.5 bg-papeliz-topbar pl-3 text-white sm:pl-5',
          // In Papeliz for Windows the window buttons end the header, flush with the window's edge.
          isPapelizDesktopApp ? 'pr-0' : 'pr-3 sm:pr-5',
        )}
      >
        {/* The logo goes back to Recent Vaults from any panel. On hover it glows white, with no box behind it,
            and a press sinks it slightly. */}
        <button
          type="button"
          aria-label="Papeliz, back to Recent Vaults"
          title="Recent Vaults"
          onClick={showRecentVaults}
          className="-mx-1.5 flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-[filter,transform] duration-200 hover:drop-shadow-[0_0_12px_rgb(255_255_255/0.45)] focus-visible:outline-white active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          <PapelizMark papelizMarkSize={26} papelizMarkTone="on-blue" />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Papeliz</span>
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <PapelizSettingsGearButton settingsGearPlace="start-page" />
          <PapelizDesktopWindowControls />
        </div>
      </header>

      {/* The card is centered by its auto margins, which, unlike centering the row, never push its top
          out of reach when it's taller than the window. */}
      <main className="flex min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="papeliz-welcome-enter m-auto flex w-[750px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[14px] border border-papeliz-line bg-papeliz-surface shadow-papeliz-card max-md:flex-col md:h-[520px] md:max-h-[calc(100dvh-80px)] sm:max-w-[calc(100vw-48px)]">
          <section aria-label="Start" className="flex flex-none flex-col bg-papeliz-topbar p-3 text-white md:w-[190px] md:overflow-y-auto md:[scrollbar-width:none]">
            {/* On a short window the panel scrolls (wheel, touch or Tab), so its foot (Synced Vaults and the
                licence) stays reachable; a scrollbar would narrow the actions until their lines wrap. */}
            <div className="flex items-center gap-2.5">
              <PapelizMark papelizMarkSize={34} papelizMarkTone="on-blue" />
              <div className="flex flex-col">
                <h1 className="text-[24px] leading-none font-semibold tracking-[-0.02em]">Papeliz</h1>
                <span className="mt-1 self-end text-[10.5px] leading-none text-white/70">by Adam Natad</span>
              </div>
            </div>
            {/* The first sentence of the website's description, which follows "Papeliz is". */}
            <p className="mt-3 text-[11.5px] leading-[1.45] text-white/80">
              A free, open-source, cross-platform Markdown Editor and AI-powered note-taking app for building your personal knowledge base.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-[7px]">
              <PapelizWelcomeAction
                WelcomeActionIcon={History}
                welcomeActionTitle="Recent Vaults"
                welcomeActionDescription="Vaults opened before."
                isWelcomeActionDisabled={false}
                isWelcomeActionCurrent={isRecentVaultsPanelOnScreen}
                onWelcomeActionSelect={() => {
                  showRecentVaults()
                  scrollStartPagePanelIntoViewOnPhone()
                }}
              />
              <PapelizWelcomeAction
                WelcomeActionIcon={FolderPlus}
                welcomeActionTitle="New Vault"
                welcomeActionDescription={
                  isNewVaultPlaceChoiceShown ? 'On disk or in this browser.' : isBrowserVaultOn ? 'Kept in this browser.' : 'Start in a new folder.'
                }
                isWelcomeActionDisabled={isOpeningVault}
                welcomeActionOffReasonText={isBrowserVaultOn ? null : folderAccessOffReason === 'unsupported' ? browserVaultOffReasonText : folderAccessOffReasonText}
                isWelcomeActionCurrent={newVaultFormRequest !== null}
                welcomeActionButtonRef={newVaultActionButtonRef}
                onWelcomeActionSelect={startNewVault}
              />
              {isOpenFolderVaultActionShown && (
                <PapelizWelcomeAction
                  WelcomeActionIcon={FolderOpen}
                  welcomeActionTitle="Open Vault"
                  welcomeActionDescription="Use notes you have."
                  isWelcomeActionDisabled={isOpeningVault}
                  welcomeActionOffReasonText={folderAccessOffReasonText}
                  onWelcomeActionSelect={() => void openFolderVault(false)}
                />
              )}
            </div>

            {/* The panel's foot, pinned to its bottom on wide screens: Templates and Synced Vaults above
                the line, then the licence. Free space falls between Open Vault and it. */}
            <div className="md:mt-auto">
              <div className="mt-[11px]">
                <PapelizWelcomeAction
                  WelcomeActionIcon={LayoutTemplate}
                  welcomeActionTitle="Templates"
                  welcomeActionDescription="Start from a template."
                  isWelcomeActionDisabled={isOpeningVault}
                  isWelcomeActionCurrent={isTemplateGalleryPageOnScreen}
                  onWelcomeActionSelect={openTemplateGalleryPage}
                />
              </div>
              {isSyncedVaultsActionShown && (
                <div className="mt-[7px]">
                  <PapelizWelcomeAction
                    WelcomeActionIcon={CloudDownload}
                    welcomeActionTitle="Synced Vaults"
                    welcomeActionDescription="On all your devices."
                    isWelcomeActionDisabled={isOpeningVault}
                    welcomeActionOffReasonText={syncedVaultsActionOffReasonText}
                    isWelcomeActionCurrent={isSyncedVaultsPageOnScreen}
                    onWelcomeActionSelect={openSyncedVaultsPage}
                  />
                </div>
              )}
              <p className="mt-[9px] border-t border-white/15 pt-[9px]">
                <a
                  href={papelizPublicGitHubRepositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Papeliz on GitHub"
                  className="inline-flex items-center gap-2 rounded text-[11px] font-medium text-white/80 underline-offset-2 transition-colors hover:text-white hover:underline focus-visible:outline-white"
                >
                  <Code className="size-3.5 flex-none" aria-hidden="true" />
                  Open Source (MIT License)
                </a>
              </p>
            </div>
          </section>

          <section
            ref={startPagePanelRef}
            aria-labelledby={
              isSyncedVaultsPageOnScreen
                ? 'papeliz-synced-vaults-page-heading'
                : isTemplateGalleryPageOnScreen
                  ? 'papeliz-template-gallery-page-heading'
                  : endToEndVaultUnlockRequest !== null
                    ? 'papeliz-end-to-end-vault-unlock-heading'
                    : newVaultFormRequest === null
                      ? 'papeliz-welcome-recent-heading'
                      : 'papeliz-new-vault-form-heading'
            }
            className="flex min-h-[280px] min-w-0 flex-1 flex-col p-2.5"
          >
            {/* New Vault, Unlock, Synced Vaults or Templates takes Recent Vaults' place while its page shows. */}
            {isSyncedVaultsPageOnScreen ? (
              <Suspense fallback={null}>
                <PapelizSyncSyncedVaultsPage
                  key={heldSyncedVaultsPagePreview?.syncedVaultsPagePreviewNumber ?? 'live'}
                  syncedVaultsPageHeadingId="papeliz-synced-vaults-page-heading"
                  isFolderStorageOn={isFolderVaultOn}
                  isBrowserStorageOn={isBrowserVaultOn}
                  existingBrowserVaultRecords={browserVaultRecords}
                  papelizVaultIdsOnThisDevice={recentVaultIds}
                  onVaultOnThisDeviceOpen={openVaultOnThisDeviceFromSyncedVaults}
                  onSyncedVaultsPageClose={closeSyncedVaultsPage}
                  onSyncDownloadStarted={() => {
                    closeSyncedVaultsPage()
                    reloadRecentVaults()
                  }}
                />
              </Suspense>
            ) : isTemplateGalleryPageOnScreen ? (
              <Suspense fallback={null}>
                <PapelizTemplateGalleryPage
                  key={heldTemplateGalleryPagePreview?.templateGalleryPagePreviewNumber ?? 'live'}
                  templateGalleryPageHeadingId="papeliz-template-gallery-page-heading"
                  folderAccessOffReasonText={folderAccessOffReasonText}
                  browserVaultOffReasonText={browserVaultOffReasonText}
                  existingBrowserVaultRecords={browserVaultRecords}
                  onTemplateGalleryPageClose={closeTemplateGalleryPage}
                  initialPapelizTemplateGalleryId={templateGalleryIdFromAddress ?? undefined}
                  onTemplateVaultOpen={openTemplateVault}
                  onVaultFolderChooserUnavailable={() => {
                    setFolderChooserUnavailable(true)
                    showFolderAccessOffNotice('chooser-unavailable', true)
                  }}
                />
              </Suspense>
            ) : endToEndVaultUnlockRequest !== null ? (
              <PapelizEndToEndVaultUnlockPanel
                key={endToEndVaultUnlockRequest.papelizLockedEndToEndVault.papelizVaultId}
                endToEndVaultUnlockPanelHeadingId="papeliz-end-to-end-vault-unlock-heading"
                papelizLockedEndToEndVault={endToEndVaultUnlockRequest.papelizLockedEndToEndVault}
                endToEndVaultPlaceLine={endToEndVaultUnlockRequest.endToEndVaultPlaceLine}
                endToEndVaultUnlockReason={endToEndVaultUnlockRequest.endToEndVaultUnlockReason}
                endToEndVaultUnlockNoticeLine={endToEndVaultUnlockRequest.endToEndVaultUnlockNoticeLine}
                onEndToEndVaultUnlocked={(unlockedOpenVault) => void openUnlockedEndToEndVault(unlockedOpenVault)}
                onEndToEndVaultUnlockCancel={cancelEndToEndVaultUnlock}
              />
            ) : newVaultFormRequest !== null ? (
              <PapelizNewVaultForm
                newVaultFormHeadingId="papeliz-new-vault-form-heading"
                folderAccessOffReasonText={folderAccessOffReasonText}
                browserVaultOffReasonText={browserVaultOffReasonText}
                suggestedNewVaultName={newVaultFormRequest.suggestedNewVaultName}
                initialNewVaultPlace={newVaultFormRequest.initialNewVaultPlace}
                existingBrowserVaultRecords={browserVaultRecords}
                isNewVaultConfirmHeld={isOpeningVault}
                onNewVaultParentFolderPick={pickNewVaultParentFolderFromForm}
                areNewVaultEncryptionAndSyncPartsShown
                newVaultCreateFailureMessage={newVaultCreateFailureMessage}
                onNewVaultConfirm={(typedNewVaultName, chosenNewVaultPlace, newVaultConfirmDetails) =>
                  void finishNewVault(typedNewVaultName, chosenNewVaultPlace, newVaultConfirmDetails)
                }
                onNewVaultCancel={cancelNewVault}
              />
            ) : (
              <>
                {/* Heading, on one line in both lists so it stays put when they switch: the title (and in the
                    Hidden list its count) on the left; on the right, Try Sample (Recent Vaults only), the eye
                    previewer (development builds only), the Hidden list's eye, Reload, the search box and, in the
                    Hidden list, Delete All last. The search box gives way when the line is short. Before there is
                    a vault, only the title and the previewer show (the empty list has its own Try Sample): the eye
                    too while vaults are hidden, Try Sample, Reload and search once the list has one. */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 pt-[11px] pb-1.5 sm:flex-nowrap">
                  <div className="flex flex-none items-center gap-2">
                    <h2 id="papeliz-welcome-recent-heading" className="text-[18px] font-semibold tracking-[-0.01em]">
                      {isHiddenVaultListShown ? 'Hidden Vaults' : 'Recent Vaults'}
                    </h2>
                    {isHiddenVaultListShown && hiddenRecentVaults.length > 0 && (
                      <span className={joinPapelizClassNames(papelizHiddenVaultCountBadgeClassName, 'h-5 min-w-5 px-1.5 text-[11px]')}>{hiddenRecentVaults.length}</span>
                    )}
                  </div>
                  <div className="flex min-w-0 items-center justify-end gap-1.5 max-sm:w-full sm:flex-1">
                    {!isHiddenVaultListShown && listedRecentVaults.length > 0 && (
                      <PapelizPillButton
                        pillButtonVariant="outline"
                        pillButtonSize="small"
                        disabled={isOpeningVault}
                        title={`Open the sample vault: ${papelizSampleVaultNotes.length} notes, nothing saved`}
                        onClick={() => void openSampleVault()}
                        className="h-8 gap-1.5 px-3 text-[12.5px] max-sm:w-8 max-sm:px-0 pointer-coarse:h-10 max-sm:pointer-coarse:w-10"
                      >
                        <BookOpen className="size-3.5 flex-none" aria-hidden="true" />
                        {/* On a phone the book alone, so the search box keeps its room. */}
                        <span className="max-sm:sr-only">Try Sample</span>
                      </PapelizPillButton>
                    )}
                    {/* The eye follows the view: crossed out on Recent Vaults (the vaults hidden from it, counted on
                        its corner), open in the Hidden list (they are showing). */}
                    {isHiddenVaultToggleShown && (
                      <button
                        type="button"
                        aria-pressed={isHiddenVaultListShown}
                        aria-label={isHiddenVaultListShown ? 'Back to Recent Vaults' : `Hidden Vaults (${hiddenRecentVaults.length})`}
                        title={isHiddenVaultListShown ? 'Back to Recent Vaults' : `Hidden Vaults (${hiddenRecentVaults.length})`}
                        onClick={() => {
                          setHiddenVaultListShown(!isHiddenVaultListShown)
                          setRecentVaultSearchText('')
                        }}
                        className="relative grid size-8 flex-none place-items-center rounded-full border border-papeliz-line text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink aria-pressed:border-papeliz-blue-line aria-pressed:bg-papeliz-blue-soft aria-pressed:text-papeliz-blue"
                      >
                        {isHiddenVaultListShown ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}
                        {!isHiddenVaultListShown && hiddenRecentVaults.length > 0 && (
                          <span aria-hidden="true" className={joinPapelizClassNames(papelizHiddenVaultCountBadgeClassName, 'absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[9.5px]')}>
                            {hiddenRecentVaults.length}
                          </span>
                        )}
                      </button>
                    )}
                    {listedRecentVaults.length > 0 && (
                      <>
                        <button
                          type="button"
                          aria-label="Reload the List"
                          title="Reload the List"
                          aria-busy={isRecentVaultListReloading || undefined}
                          onClick={reloadRecentVaultList}
                          className="papeliz-recent-vaults-reload-button grid size-8 flex-none place-items-center rounded-full border border-papeliz-line text-papeliz-ink-muted hover:bg-papeliz-hover hover:text-papeliz-ink"
                        >
                          <RefreshCw
                            className={joinPapelizClassNames('size-4', isRecentVaultListReloading && 'papeliz-recent-vaults-reload-icon-turning')}
                            aria-hidden="true"
                          />
                        </button>
                        <label className="flex h-8 min-w-24 flex-1 items-center gap-2 rounded-full border border-papeliz-line bg-papeliz-surface px-3 text-papeliz-ink-subtle focus-within:border-papeliz-blue-line focus-within:shadow-[0_0_0_3px_var(--color-papeliz-blue-soft)] sm:max-w-[180px]">
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
                      </>
                    )}
                    {isHiddenVaultListShown && hiddenRecentVaults.length > 0 && (
                      <button
                        type="button"
                        disabled={deletingPapelizVaultIds !== null || !canDeleteEveryHiddenRecentVault}
                        title={canDeleteEveryHiddenRecentVault ? 'Delete every hidden vault for good' : 'This browser can’t delete folders'}
                        onClick={() => {
                          setTypedVaultDeleteConfirmation('')
                          setRecentVaultDeleteRequest({ recentVaultDeleteScope: 'all-hidden-vaults', recentVaults: hiddenRecentVaults })
                        }}
                        className={joinPapelizClassNames(papelizHiddenVaultActionButtonClassName, papelizHiddenVaultDeleteButtonClassName, 'h-8 px-2.5 text-[12.5px] pointer-coarse:h-10')}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        Delete All
                      </button>
                    )}
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
                  {isVaultFolderWindowOpen && (
                    <div role="status" className="papeliz-recent-vaults-reload-overlay px-6 text-center">
                      <span className="grid size-11 place-items-center rounded-xl bg-papeliz-blue-soft text-papeliz-blue">
                        <FolderOpen className="size-5" aria-hidden="true" />
                      </span>
                      <p className="text-[14px] font-semibold">Choose a folder in the window that opened</p>
                      <p className="-mt-1.5 max-w-[300px] text-[12.5px] text-papeliz-ink-muted">If you can’t see it, it may be behind this window.</p>
                    </div>
                  )}
                  {listedRecentVaults.length === 0 ? (
                    isHiddenVaultListShown ? (
                      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
                        <span className="grid size-11 place-items-center rounded-xl bg-papeliz-blue-soft text-papeliz-blue">
                          <EyeOff className="size-5" aria-hidden="true" />
                        </span>
                        <p className="mt-3 text-[14px] font-semibold">Nothing is hidden</p>
                        <p className="mt-1 max-w-[300px] text-[12.5px] text-papeliz-ink-muted">Use the hide button on a vault’s row, or its … menu.</p>
                      </div>
                    ) : (
                      // No vault on the list yet: the two ways to start, the sample first. Where this browser can
                      // keep no vault at all, it says why, and only the sample is offered.
                      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
                        <span className="grid size-11 place-items-center rounded-xl bg-papeliz-blue-soft text-papeliz-blue">
                          <FolderOpen className="size-5" aria-hidden="true" />
                        </span>
                        <p className="mt-3 text-[14px] font-semibold">{hiddenRecentVaults.length > 0 ? 'All your vaults are hidden' : 'No vaults yet'}</p>
                        <p className="mt-1 max-w-[300px] text-[12.5px] text-papeliz-ink-muted">
                          {!isBrowserVaultOn && !isFolderVaultOn
                            ? (browserVaultOffReasonText ?? folderAccessOffReasonText)
                            : hiddenRecentVaults.length > 0
                              ? 'Show them with the eye button, or start with the sample or a new vault.'
                              : 'Start with the sample, or make your own.'}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                          <PapelizPillButton pillButtonVariant="outline" disabled={isOpeningVault} onClick={() => void openSampleVault()} className="pointer-coarse:h-10">
                            Try Sample
                          </PapelizPillButton>
                          {(isBrowserVaultOn || isFolderVaultOn) && (
                            <PapelizPillButton pillButtonVariant="primary" disabled={isOpeningVault} onClick={startNewVault} className="pointer-coarse:h-10">
                              New Vault
                            </PapelizPillButton>
                          )}
                        </div>
                      </div>
                    )
                  ) : (
                    <ul className="mt-1.5 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pb-1">
                      {shownRecentVaults.length === 0 && (
                        <li className="px-1 py-6 text-center text-[12.5px] text-papeliz-ink-muted">
                          {isHiddenVaultListShown ? 'No hidden vault matches' : 'No recent vault matches'} “{recentVaultSearchText.trim()}”.
                        </li>
                      )}
                      {isHiddenVaultListShown
                        ? shownRecentVaults.map((recentVault) => {
                            const isThisVaultDeleting = deletingPapelizVaultIds?.has(recentVault.papelizVaultId) === true
                            return (
                              // A hidden vault's row: the same card, not clickable, with where it's kept, when it was
                              // hidden, and Restore and Delete (Delete asks first).
                              <li
                                key={recentVault.papelizVaultId}
                                aria-label={recentVault.papelizVaultDisplayName}
                                className="group flex items-center gap-3 rounded-xl border border-papeliz-line bg-papeliz-surface px-2.5 py-2 max-sm:flex-wrap max-sm:gap-y-2"
                              >
                                <span
                                  aria-hidden="true"
                                  className="grid size-9 flex-none place-items-center rounded-lg bg-papeliz-hover text-[15px] font-semibold text-papeliz-ink-muted"
                                >
                                  {recentVault.papelizVaultDisplayName.trim().charAt(0).toUpperCase() || '·'}
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                  <span className="truncate text-[13.5px] font-semibold">{recentVault.papelizVaultDisplayName}</span>
                                  <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] text-papeliz-ink-subtle">
                                    <PapelizRecentVaultPlace recentVault={recentVault} />
                                    {/* On a phone the time sits on its own line here. */}
                                    <span className="basis-full sm:hidden">{describeHiddenVaultTime(recentVault)}</span>
                                  </span>
                                </span>
                                {/* The time, then Restore and Delete, as tall as the toolbar's buttons (40px on a touch screen),
                                    inside the Recent Vaults row height. On a phone the buttons take a line of their own under
                                    the name. */}
                                <span className={joinPapelizClassNames(papelizVaultRowEndClassName, 'max-sm:w-full max-sm:justify-end')}>
                                  <span className={papelizVaultRowEndTimeClassName}>{describeHiddenVaultTime(recentVault)}</span>
                                  <span className={joinPapelizClassNames(papelizVaultRowEndButtonsClassName, 'gap-1.5')}>
                                  <button
                                    type="button"
                                    disabled={deletingPapelizVaultIds !== null}
                                    onClick={() => setRecentVaultHidden(recentVault, false)}
                                    className={joinPapelizClassNames(
                                      papelizHiddenVaultActionButtonClassName,
                                      papelizHiddenVaultRestoreButtonClassName,
                                      'h-8 px-2.5 text-[12px] pointer-coarse:h-10',
                                    )}
                                  >
                                    <RotateCcw className="size-3.5" aria-hidden="true" />
                                    Restore
                                  </button>
                                  <button
                                    type="button"
                                    disabled={deletingPapelizVaultIds !== null || !canDeleteRecentVault(recentVault)}
                                    title={
                                      !canDeleteRecentVault(recentVault)
                                        ? 'This browser can’t delete folders'
                                        : recentVault.papelizRecentVaultKind === 'browser-vault-in-opfs'
                                          ? `Delete “${recentVault.papelizVaultDisplayName}” and its notes from this browser`
                                          : `Delete “${recentVault.papelizVaultDisplayName}” and its notes from your disk`
                                    }
                                    onClick={() => {
                                      setTypedVaultDeleteConfirmation('')
                                      setRecentVaultDeleteRequest({ recentVaultDeleteScope: 'one-vault', recentVault })
                                    }}
                                    className={joinPapelizClassNames(
                                      papelizHiddenVaultActionButtonClassName,
                                      papelizHiddenVaultDeleteButtonClassName,
                                      'h-8 px-2.5 text-[12px] pointer-coarse:h-10',
                                    )}
                                  >
                                    <Trash2 className="size-3.5" aria-hidden="true" />
                                    {isThisVaultDeleting ? 'Deleting…' : 'Delete'}
                                  </button>
                                  </span>
                                </span>
                              </li>
                            )
                          })
                        : shownRecentVaults.map((recentVault) => {
                            // A vault the Synced Vaults page is filling: how far it is, or where it stopped. It opens once it's all here.
                            const syncStartScreenDownload = syncStartScreenDownloadsByVaultId[recentVault.papelizVaultId]
                            const isSyncDownloadStopped = syncStartScreenDownload?.syncStartScreenDownloadStage === 'stopped'
                            const syncDownloadPercent = syncStartScreenDownload === undefined ? null : readPapelizSyncStartScreenDownloadPercent(syncStartScreenDownload)
                            const vaultRowWordKinds = listVaultRowWordKinds(
                              recentVault,
                              recentVaultSyncedVaultIds === null ? undefined : recentVaultSyncedVaultIds.has(recentVault.papelizVaultId),
                            )
                            const vaultRowWordsDescriptionId = `papeliz-recent-vault-row-words-${recentVault.papelizVaultId}`
                            return (
                              <li
                                key={recentVault.papelizVaultId}
                                onContextMenu={(contextMenuEvent) => {
                                  contextMenuEvent.preventDefault()
                                  if (syncStartScreenDownload !== undefined) return
                                  setRecentVaultMenu({
                                    recentVault,
                                    recentVaultMenuPosition: { menuAnchorLeft: contextMenuEvent.clientX, menuAnchorTop: contextMenuEvent.clientY },
                                  })
                                }}
                                className={joinPapelizClassNames(
                                  'papeliz-recent-vault-row group flex items-center rounded-xl border bg-papeliz-surface transition-[border-color,background-color,box-shadow] duration-150',
                                  syncStartScreenDownload === undefined
                                    ? 'border-papeliz-line hover:border-papeliz-blue-line hover:bg-papeliz-blue-soft/40 hover:shadow-papeliz-card'
                                    : isSyncDownloadStopped
                                      ? 'border-papeliz-diff-removed-ink/35'
                                      : 'border-papeliz-blue-line',
                                )}
                              >
                                {/* The words under the name, with their tooltips' sentences, for screen readers. */}
                                <span id={vaultRowWordsDescriptionId} className="sr-only">
                                  {describeVaultRowWords(vaultRowWordKinds)}
                                </span>
                                <button
                                  type="button"
                                  disabled={isOpeningVault || syncStartScreenDownload !== undefined}
                                  aria-describedby={syncStartScreenDownload === undefined ? vaultRowWordsDescriptionId : undefined}
                                  onClick={() => void reopenRecentVault(recentVault)}
                                  onFocus={(focusEvent) => {
                                    // A keyboard user sees the words' tooltips, under them, while the row has focus.
                                    if (syncStartScreenDownload !== undefined || !focusEvent.currentTarget.matches(':focus-visible')) return
                                    const vaultRowWordsElement = focusEvent.currentTarget.querySelector<HTMLElement>('[data-papeliz-vault-row-words]')
                                    if (vaultRowWordsElement !== null) setKeyboardFocusedVaultRowWords({ focusedPapelizVaultId: recentVault.papelizVaultId, vaultRowWordKinds, vaultRowWordsElement })
                                  }}
                                  onBlur={() => setKeyboardFocusedVaultRowWords(null)}
                                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2 text-left disabled:cursor-default"
                                >
                                  <PapelizVaultLetterTile papelizVaultDisplayName={recentVault.papelizVaultDisplayName} isEndToEndVault={isPapelizRecentVaultEndToEnd(recentVault)} />
                                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="truncate text-[13.5px] font-semibold">{recentVault.papelizVaultDisplayName}</span>
                                    {syncStartScreenDownload === undefined ? (
                                      <span data-papeliz-vault-row-words className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] text-papeliz-ink-subtle">
                                        <PapelizRecentVaultPlace recentVault={recentVault} />
                                        {recentVaultSyncedVaultIds !== null && <PapelizRecentVaultSyncBadge isRecentVaultSynced={recentVaultSyncedVaultIds.has(recentVault.papelizVaultId)} />}
                                        <PapelizRecentVaultEncryptionBadges recentVault={recentVault} />
                                        {/* On a phone the time sits on its own line here, so the name keeps the width. */}
                                        <span className="basis-full sm:hidden">{describeTimeSince(recentVault.papelizVaultLastOpenedAt)}</span>
                                      </span>
                                    ) : (
                                      <PapelizSyncStartScreenDownloadProgressLines syncStartScreenDownload={syncStartScreenDownload} />
                                    )}
                                  </span>
                                  {syncStartScreenDownload !== undefined && !isSyncDownloadStopped && syncDownloadPercent !== null && (
                                    <span className="flex-none text-[11.5px] text-papeliz-ink-subtle tabular-nums">{syncDownloadPercent}%</span>
                                  )}
                                </button>
                                {isSyncDownloadStopped ? (
                                  <button
                                    type="button"
                                    onClick={() => void retryPapelizSyncStartScreenDownload(recentVault.papelizVaultId)}
                                    className="mr-2.5 inline-flex h-7 flex-none items-center gap-1.5 rounded-full border border-papeliz-line-strong px-3 text-[12.5px] font-semibold text-papeliz-ink hover:bg-papeliz-hover"
                                  >
                                    <RotateCcw className="size-3.5" aria-hidden="true" />
                                    Try Again
                                  </button>
                                ) : (
                                  syncStartScreenDownload === undefined && (
                                    // The time, then Hide and the row's menu (the right-click one), for a mouse, a keyboard or
                                    // a finger. On a touch screen the two grow to 40px side by side, so their hit areas never
                                    // overlap.
                                    <span className={joinPapelizClassNames(papelizVaultRowEndClassName, 'mr-2.5 pointer-coarse:mr-1')}>
                                      <span className={papelizVaultRowEndTimeClassName}>{describeTimeSince(recentVault.papelizVaultLastOpenedAt)}</span>
                                      <span className={papelizVaultRowEndButtonsClassName}>
                                        <PapelizIconButton
                                          iconButtonLabel={`Hide ${recentVault.papelizVaultDisplayName}`}
                                          iconButtonSize="small"
                                          className="pointer-coarse:size-10"
                                          onClick={() => setRecentVaultHidden(recentVault, true)}
                                        >
                                          <EyeOff className="size-[15px]" aria-hidden="true" />
                                        </PapelizIconButton>
                                        <PapelizIconButton
                                          iconButtonLabel={`More for ${recentVault.papelizVaultDisplayName}`}
                                          iconButtonSize="small"
                                          aria-haspopup="menu"
                                          className="pointer-coarse:size-10"
                                          onClick={(clickEvent) => {
                                            const moreButtonRect = clickEvent.currentTarget.getBoundingClientRect()
                                            setRecentVaultMenu({
                                              recentVault,
                                              recentVaultMenuPosition: { menuAnchorLeft: moreButtonRect.left, menuAnchorTop: moreButtonRect.bottom + 4 },
                                            })
                                          }}
                                        >
                                          <Ellipsis className="size-[15px]" aria-hidden="true" />
                                        </PapelizIconButton>
                                      </span>
                                    </span>
                                  )
                                )}
                              </li>
                            )
                          })}
                    </ul>
                  )}
                </div>

                {listedRecentVaults.length > 0 && (
                  <p className="mt-2 px-3 text-[11px] text-papeliz-ink-subtle">
                    {isHiddenVaultListShown
                      ? isBrowserVaultListed
                        ? isFolderVaultListed
                          ? 'Delete erases a folder from your disk, or a browser vault from this browser, with every note in it. It can’t be undone.'
                          : 'Delete erases the vault and every note in it from this browser. It can’t be undone.'
                        : 'Delete erases the folder and every note in it from your disk. It doesn’t go to the Recycle Bin.'
                      : isBrowserVaultListed
                        ? isFolderVaultListed
                          ? 'Folders stay on your disk and browser vaults in this browser. Hide only takes one off this list.'
                          : 'Browser vaults stay in this browser. Hide only takes one off this list.'
                        : 'The folders stay on your disk. Hide only takes one off this list.'}
                  </p>
                )}
              </>
            )}

            {keyboardFocusedVaultRowWords !== null && (
              <PapelizTooltipBubble
                key={keyboardFocusedVaultRowWords.focusedPapelizVaultId}
                tooltipAnchorElement={keyboardFocusedVaultRowWords.vaultRowWordsElement}
                tooltipBubbleContent={keyboardFocusedVaultRowWords.vaultRowWordKinds.map((vaultRowWordKind) => (
                  <PapelizTooltipLine
                    key={vaultRowWordKind}
                    tooltipLineTitle={papelizVaultRowWordTooltips[vaultRowWordKind].vaultRowWordTitle}
                    tooltipLineText={papelizVaultRowWordTooltips[vaultRowWordKind].vaultRowWordTooltipText}
                  />
                ))}
                onTooltipBubbleLeftBehind={hideKeyboardFocusedVaultRowWords}
              />
            )}

            {recentVaultMenu !== null && (
              <PapelizPopoverMenu
                menuLabel={recentVaultMenu.recentVault.papelizVaultDisplayName}
                menuPosition={recentVaultMenu.recentVaultMenuPosition}
                onMenuClose={() => setRecentVaultMenu(null)}
                menuItems={[
                  {
                    menuItemKey: 'open-recent-vault',
                    menuItemLabel: 'Open',
                    MenuItemIcon: FolderOpen,
                    onMenuItemSelect: () => void reopenRecentVault(recentVaultMenu.recentVault),
                  },
                  ...(recentVaultMenu.recentVault.papelizRecentVaultKind === 'browser-vault-in-opfs'
                    ? [
                        {
                          menuItemKey: 'rename-browser-vault',
                          menuItemLabel: 'Rename',
                          MenuItemIcon: Pencil,
                          onMenuItemSelect: () => {
                            const renamedRecentVault = recentVaultMenu.recentVault
                            if (renamedRecentVault.papelizRecentVaultKind === 'browser-vault-in-opfs') {
                              setBrowserVaultNameDialogRequest({ renamedBrowserVaultRecord: renamedRecentVault })
                            }
                          },
                        },
                        {
                          menuItemKey: 'download-browser-vault-backup',
                          menuItemLabel: 'Download Backup',
                          MenuItemIcon: Download,
                          onMenuItemSelect: () => {
                            const backedUpRecentVault = recentVaultMenu.recentVault
                            if (backedUpRecentVault.papelizRecentVaultKind === 'browser-vault-in-opfs') void downloadRecentBrowserVaultBackup(backedUpRecentVault)
                          },
                        },
                      ]
                    : []),
                  {
                    menuItemKey: 'hide-recent-vault',
                    menuItemLabel: 'Hide',
                    MenuItemIcon: EyeOff,
                    menuItemGroupHeading: ' ',
                    onMenuItemSelect: () => setRecentVaultHidden(recentVaultMenu.recentVault, true),
                  },
                ]}
              />
            )}

            {browserVaultNameDialogRequest !== null && (
              <PapelizBrowserVaultNameDialog
                renamedBrowserVaultRecord={browserVaultNameDialogRequest.renamedBrowserVaultRecord}
                existingBrowserVaultRecords={browserVaultRecords}
                onBrowserVaultRenameConfirm={(typedBrowserVaultName) =>
                  void finishBrowserVaultRename(browserVaultNameDialogRequest.renamedBrowserVaultRecord, typedBrowserVaultName)
                }
                onBrowserVaultRenameCancel={() => setBrowserVaultNameDialogRequest(null)}
              />
            )}

            {/* One confirmation for Delete and for Delete All: the same dialog, asking for the vault's name or,
                for Delete All, the number of vaults. */}
            {recentVaultDeleteRequest !== null && (
              <PapelizConfirmDialog
                confirmDialogTitle={
                  recentVaultDeleteRequest.recentVaultDeleteScope === 'one-vault'
                    ? `Delete “${recentVaultDeleteRequest.recentVault.papelizVaultDisplayName}”?`
                    : recentVaultDeleteRequest.recentVaults.length === 1
                      ? 'Delete 1 Hidden Vault?'
                      : `Delete All ${recentVaultDeleteRequest.recentVaults.length} Hidden Vaults?`
                }
                confirmDialogBody={
                  <>
                    <p>
                      {describeRecentVaultDeleteRequest(recentVaultDeleteRequest)}
                      {recentVaultDeleteRequest.recentVaultDeleteScope === 'one-vault' &&
                        recentVaultDeleteRequest.recentVault.papelizRecentVaultKind === 'browser-vault-in-opfs' && (
                          <>
                            {' '}
                            <button
                              type="button"
                              onClick={() => {
                                const deletedRecentVault = recentVaultDeleteRequest.recentVault
                                if (deletedRecentVault.papelizRecentVaultKind === 'browser-vault-in-opfs') void downloadRecentBrowserVaultBackup(deletedRecentVault)
                              }}
                              className="font-semibold text-papeliz-blue underline-offset-2 hover:underline"
                            >
                              Download a backup
                            </button>{' '}
                            first if you might want it back.
                          </>
                        )}
                    </p>
                    <label className="mt-4 block text-[13px] font-medium text-papeliz-ink">
                      Type <span className="papeliz-selectable-text font-semibold">{expectedVaultDeleteConfirmation}</span> to delete{' '}
                      {recentVaultDeleteRequest.recentVaultDeleteScope === 'one-vault' || recentVaultDeleteRequest.recentVaults.length === 1
                        ? 'it'
                        : 'them'}
                      <input
                        value={typedVaultDeleteConfirmation}
                        onChange={(changeEvent) => setTypedVaultDeleteConfirmation(changeEvent.target.value)}
                        onKeyDown={(keyDownEvent) => {
                          if (keyDownEvent.key !== 'Enter' || !isVaultDeleteConfirmationTyped) return
                          keyDownEvent.preventDefault()
                          void deleteHiddenRecentVaults(recentVaultDeleteRequest)
                        }}
                        autoComplete="off"
                        spellCheck={false}
                        className="mt-1.5 block h-9 w-full rounded-xl border border-papeliz-line bg-papeliz-surface px-3 text-[14px] font-normal text-papeliz-ink focus:border-papeliz-blue-line focus:shadow-[0_0_0_3px_var(--color-papeliz-blue-soft)] focus:outline-none"
                      />
                    </label>
                  </>
                }
                confirmButtonLabel={recentVaultDeleteRequest.recentVaultDeleteScope === 'one-vault' ? 'Delete Vault' : 'Delete All Vaults'}
                isConfirmActionDangerous
                isConfirmButtonDisabled={!isVaultDeleteConfirmationTyped}
                onConfirm={() => void deleteHiddenRecentVaults(recentVaultDeleteRequest)}
                onCancel={() => setRecentVaultDeleteRequest(null)}
              />
            )}
          </section>
        </div>
      </main>

      <PapelizWorkspaceNotice />
      {PapelizStartScreenPreviewerButton !== null && (
        <Suspense fallback={null}>
          <PapelizStartScreenPreviewerButton />
        </Suspense>
      )}
    </div>
  )
}
