import { FolderOpen, Minus, Plus } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizPopoverMenu, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import { getVaultEntryName } from '../vault/papeliz-vault-relative-paths'
import { papelizNoteZoomPercentChoices, papelizNoteZoomPercentLimits, usePapelizNoteTypographyStore } from './papeliz-note-typography-store'
import type { PapelizVaultNoteEditingLock } from './papeliz-vault-entry-locks'
import { usePapelizActiveVaultNoteEditingLock, usePapelizWorkspaceStore, type PapelizNoteSaveState } from './papeliz-workspace-store'

const papelizWordSegmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'word' }) : null
const papelizFrontmatterBlockPattern = /^---\r?\n[\s\S]*?\r?\n(---|\.\.\.)\s*(\r?\n|$)/

export function countVaultNoteWords(vaultNoteText: string): number {
  const noteTextWithoutFrontmatter = vaultNoteText.replace(papelizFrontmatterBlockPattern, '')
  if (papelizWordSegmenter === null) return noteTextWithoutFrontmatter.split(/\s+/).filter((noteWord) => /\w/.test(noteWord)).length
  let vaultNoteWordCount = 0
  for (const wordSegment of papelizWordSegmenter.segment(noteTextWithoutFrontmatter)) {
    if (wordSegment.isWordLike) vaultNoteWordCount += 1
  }
  return vaultNoteWordCount
}

function describeNoteSaveState(noteSaveState: PapelizNoteSaveState, isFolderOnDisk: boolean): string {
  if (noteSaveState === 'saving') return 'Saving…'
  if (noteSaveState === 'unsaved') return 'Unsaved changes'
  if (noteSaveState === 'save-failed') return 'Not saved'
  return isFolderOnDisk ? 'Saved to disk' : 'Saved in this tab'
}

function describeVaultNoteEditingLock(vaultNoteEditingLock: PapelizVaultNoteEditingLock | null, vaultNoteRelativePath: string | null): string {
  if (vaultNoteEditingLock === null) return ''
  if (vaultNoteEditingLock.vaultNoteEditingLockKind === 'hidden-folder') return ' · Read-only (hidden folder)'
  if (vaultNoteEditingLock.vaultNoteEditingLockKind === 'whole-vault') return ' · All notes locked'
  return vaultNoteEditingLock.lockingVaultEntryRelativePath === vaultNoteRelativePath
    ? ' · Locked'
    : ` · Locked with “${getVaultEntryName(vaultNoteEditingLock.lockingVaultEntryRelativePath)}”`
}

// The note's zoom, at the status bar's right end: - 100% +, and a click on the percentage lists the
// usual sizes. Ctrl+scroll over the note zooms too (papeliz-note-area.tsx).
function PapelizNoteZoomControl() {
  const noteZoomPercent = usePapelizNoteTypographyStore((typographyState) => typographyState.noteZoomPercent)
  const setNoteZoomPercent = usePapelizNoteTypographyStore((typographyState) => typographyState.setNoteZoomPercent)
  const stepNoteZoomPercent = usePapelizNoteTypographyStore((typographyState) => typographyState.stepNoteZoomPercent)
  const [noteZoomMenuPosition, setNoteZoomMenuPosition] = useState<PapelizPopoverMenuPosition | null>(null)
  return (
    <span className="flex flex-none items-center gap-0.5" role="group" aria-label="Zoom">
      <button
        type="button"
        aria-label="Zoom out"
        title="Zoom out (Ctrl+scroll down)"
        disabled={noteZoomPercent <= papelizNoteZoomPercentLimits.minimumNoteZoomPercent}
        onClick={() => stepNoteZoomPercent('out')}
        className="papeliz-note-zoom-button"
      >
        <Minus className="size-3" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={`Zoom ${noteZoomPercent}%. Choose a size`}
        title="Zoom (Ctrl+scroll)"
        aria-haspopup="menu"
        aria-expanded={noteZoomMenuPosition !== null}
        onClick={(clickEvent) => {
          const zoomPercentButtonRect = clickEvent.currentTarget.getBoundingClientRect()
          setNoteZoomMenuPosition({ menuAnchorLeft: zoomPercentButtonRect.left - 40, menuAnchorTop: zoomPercentButtonRect.top - 6 - 9 * 36 - 8 })
        }}
        className="min-w-[42px] rounded-full px-1.5 text-center font-medium text-white tabular-nums hover:bg-white/18"
      >
        {noteZoomPercent}%
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        title="Zoom in (Ctrl+scroll up)"
        disabled={noteZoomPercent >= papelizNoteZoomPercentLimits.maximumNoteZoomPercent}
        onClick={() => stepNoteZoomPercent('in')}
        className="papeliz-note-zoom-button"
      >
        <Plus className="size-3" aria-hidden="true" />
      </button>
      {noteZoomMenuPosition !== null && (
        <PapelizPopoverMenu
          menuLabel="Zoom"
          menuPosition={noteZoomMenuPosition}
          onMenuClose={() => setNoteZoomMenuPosition(null)}
          menuItems={papelizNoteZoomPercentChoices.map((noteZoomPercentChoice) => ({
            menuItemKey: `note-zoom-${noteZoomPercentChoice}`,
            menuItemLabel: `${noteZoomPercentChoice}%`,
            isMenuItemChecked: noteZoomPercentChoice === noteZoomPercent,
            onMenuItemSelect: () => setNoteZoomPercent(noteZoomPercentChoice),
          }))}
        />
      )}
    </span>
  )
}

// The blue bar across the bottom of the workspace: the vault and the open note's path on the left;
// whether the note is saved, how many words it has, which view is showing, and the zoom on the right.
export function PapelizStatusBar() {
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)
  const activeVaultNoteRelativePath = usePapelizWorkspaceStore((workspaceState) => workspaceState.activeVaultNoteRelativePath)
  const activeLoadedVaultNote = usePapelizWorkspaceStore((workspaceState) =>
    workspaceState.activeVaultNoteRelativePath === null ? undefined : workspaceState.loadedVaultNotesByRelativePath[workspaceState.activeVaultNoteRelativePath],
  )
  const noteViewMode = usePapelizWorkspaceStore((workspaceState) => workspaceState.noteViewMode)
  const activeVaultNoteEditingLock = usePapelizActiveVaultNoteEditingLock()
  const saveVaultNoteNow = usePapelizWorkspaceStore((workspaceState) => workspaceState.saveVaultNoteNow)

  const deferredVaultNoteText = useDeferredValue(activeLoadedVaultNote?.draftVaultNoteText ?? '')
  const vaultNoteWordCount = useMemo(() => countVaultNoteWords(deferredVaultNoteText), [deferredVaultNoteText])

  if (openVault === null) return null
  const isFolderOnDisk = openVault.papelizVaultAdapter.papelizVaultKind === 'folder-on-disk'
  const isNoteReady = activeLoadedVaultNote !== undefined && activeLoadedVaultNote.noteLoadState === 'loaded'

  return (
    <footer className="flex h-7 flex-none items-center gap-4 overflow-hidden bg-papeliz-topbar px-3 text-[12px] whitespace-nowrap text-white/85 sm:px-4">
      <span
        className="flex min-w-0 items-center gap-1.5"
        title={isFolderOnDisk ? 'A folder on this device' : 'Kept in this browser tab only'}
      >
        <FolderOpen className="size-[13px] flex-none opacity-80" aria-hidden="true" />
        <span className="truncate font-medium text-white">{openVault.papelizVaultDisplayName}</span>
        {activeVaultNoteRelativePath !== null && <span className="truncate text-white/70 max-sm:hidden">/ {activeVaultNoteRelativePath}</span>}
      </span>
      <span className="ml-auto flex flex-none items-center gap-4">
        {isNoteReady && activeVaultNoteRelativePath !== null && (
          <>
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={joinPapelizClassNames(
                  'size-[7px] rounded-full',
                  activeLoadedVaultNote.noteSaveState === 'saved' && 'bg-white/85',
                  activeLoadedVaultNote.noteSaveState === 'unsaved' && 'bg-white/40',
                  activeLoadedVaultNote.noteSaveState === 'saving' && 'papeliz-saving-dot bg-white',
                  activeLoadedVaultNote.noteSaveState === 'save-failed' && 'bg-red-300',
                )}
              />
              <span className={activeLoadedVaultNote.noteSaveState === 'save-failed' ? 'font-medium text-white' : undefined}>
                {describeNoteSaveState(activeLoadedVaultNote.noteSaveState, isFolderOnDisk)}
              </span>
            </span>
            {activeLoadedVaultNote.noteSaveState === 'save-failed' && (
              <>
                <span role="alert" className="max-w-[40vw] truncate text-white" title={activeLoadedVaultNote.noteSaveErrorMessage ?? undefined}>
                  {activeLoadedVaultNote.noteSaveErrorMessage}
                </span>
                <button
                  type="button"
                  className="font-semibold text-white underline-offset-2 hover:underline focus-visible:outline-white"
                  onClick={() => void saveVaultNoteNow(activeVaultNoteRelativePath)}
                >
                  Try again
                </button>
              </>
            )}
            <span className="max-sm:hidden">
              {vaultNoteWordCount.toLocaleString()} {vaultNoteWordCount === 1 ? 'word' : 'words'}
            </span>
          </>
        )}
        <span className="max-sm:hidden">
          {noteViewMode === 'md-code' ? 'MD Code' : 'MD View'}
          {describeVaultNoteEditingLock(activeVaultNoteEditingLock, activeVaultNoteRelativePath)}
        </span>
        <PapelizNoteZoomControl />
      </span>
    </footer>
  )
}
