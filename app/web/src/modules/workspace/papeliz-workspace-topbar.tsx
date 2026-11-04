import { Code, Ellipsis, Eye, Minimize2, Settings, Share, WandSparkles } from 'lucide-react'
import { isPapelizDesktopApp } from 'virtual:papeliz-desktop-platform-availability'
import { useLayoutEffect, useRef, useState } from 'react'
import { PapelizDesktopAppUpdateGearDot } from '../desktop/papeliz-desktop-app-update-parts'
import { PapelizDesktopWindowControls, usePapelizDesktopWindowBarDragHandlers } from '../desktop/papeliz-desktop-window-controls'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizFileListToggleIcon } from '../ui/papeliz-file-list-toggle-icon'
import { PapelizMark } from '../ui/papeliz-mark'
import { PapelizPopoverMenu, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import { usePapelizKeyBindingShortcutLabel } from './papeliz-key-bindings-store'
import { PapelizSettingsGearButton } from './papeliz-settings-gear-button'
import { PapelizTopbarExportButton } from './papeliz-topbar-export-button'
import { PapelizTopbarFrostedSquareButton } from './papeliz-topbar-frosted-square-button'
import { papelizTopbarMoreButtonAttributeName } from './papeliz-topbar-panel-anchor'
import { selectIsVaultTextFileTabInFront, selectShownNoteViewMode, usePapelizWorkspaceStore, type PapelizNoteViewMode } from './papeliz-workspace-store'

const papelizNoteViewChoices = [
  { noteViewMode: 'md-code', noteViewLabel: 'MD Code', NoteViewIcon: Code },
  { noteViewMode: 'md-view', noteViewLabel: 'MD View', NoteViewIcon: Eye },
] as const satisfies ReadonlyArray<{ noteViewMode: PapelizNoteViewMode; noteViewLabel: string; NoteViewIcon: typeof Code }>

// What the bar gives up, in this order, when its parts don't fit the room it has. That room is the
// bar's own width, less whatever else stands in it (Papeliz for Windows' window buttons), so the web
// and the desktop give way at the same usable width: first the vault's name, then the view switch's
// labels (and Exit Focus's), then the word Papeliz beside the mark, then the gaps tighten, and last
// Export and Settings fold into one More menu. Each step is a data attribute on the bar, which its
// parts' classes read.
export const papelizTopbarGiveWayAttributeNames = [
  'data-papeliz-topbar-vault-name-hidden',
  'data-papeliz-topbar-switch-labels-hidden',
  'data-papeliz-topbar-papeliz-word-hidden',
  'data-papeliz-topbar-gaps-tight',
  'data-papeliz-topbar-export-and-settings-folded',
] as const

// Narrower than this, the vault's name is cut too short to read, so it goes.
const papelizTopbarVaultNameShortestReadableWidth = 64

function doesPapelizTopbarFit(topbarElement: HTMLElement): boolean {
  if (topbarElement.scrollWidth > topbarElement.clientWidth + 0.5) return false
  for (const topbarSideElement of topbarElement.querySelectorAll<HTMLElement>('[data-papeliz-topbar-side]')) {
    if (topbarSideElement.scrollWidth > topbarSideElement.clientWidth + 0.5) return false
  }
  const vaultNameElement = topbarElement.querySelector<HTMLElement>('[data-papeliz-topbar-vault-name]')
  return vaultNameElement === null || vaultNameElement.getClientRects().length === 0 || vaultNameElement.clientWidth >= papelizTopbarVaultNameShortestReadableWidth
}

// Takes the fewest steps that make the bar fit, measuring after each; when even the last isn't enough,
// every step stays taken.
function fitPapelizTopbarToItsRoom(topbarElement: HTMLElement): void {
  for (const giveWayAttributeName of papelizTopbarGiveWayAttributeNames) topbarElement.removeAttribute(giveWayAttributeName)
  for (const giveWayAttributeName of papelizTopbarGiveWayAttributeNames) {
    if (doesPapelizTopbarFit(topbarElement)) return
    topbarElement.setAttribute(giveWayAttributeName, '')
  }
}

// The menu More opens is a little wider than its widest item, as the app's other menus are.
const papelizTopbarMoreMenuWidth = 192

// Export and Settings in one menu, for a bar with no room for both (the bar's last step). Each item
// presses its button, still in the bar but without a box, so its panel opens as it always does, hanging
// from More. Settings' update dot shows on More while it stands in for the gear.
function PapelizTopbarMoreButton() {
  const [topbarMoreMenuPosition, setTopbarMoreMenuPosition] = useState<PapelizPopoverMenuPosition | null>(null)
  const topbarMoreButtonRef = useRef<HTMLButtonElement>(null)
  const pressFoldedTopbarButton = (foldedTopbarButtonLabel: 'Export' | 'Settings') =>
    topbarMoreButtonRef.current
      ?.closest('[data-papeliz-topbar-side]')
      ?.querySelector<HTMLButtonElement>(`[data-papeliz-topbar-folded-buttons] button[aria-label="${foldedTopbarButtonLabel}"]`)
      ?.click()
  return (
    <>
      <PapelizTopbarFrostedSquareButton
        ref={topbarMoreButtonRef}
        topbarFrostedSquareButtonLabel="More"
        {...{ [papelizTopbarMoreButtonAttributeName]: '' }}
        aria-haspopup="menu"
        aria-expanded={topbarMoreMenuPosition !== null}
        onClick={(clickEvent) => {
          const topbarMoreButtonRect = clickEvent.currentTarget.getBoundingClientRect()
          setTopbarMoreMenuPosition({ menuAnchorLeft: topbarMoreButtonRect.right - papelizTopbarMoreMenuWidth, menuAnchorTop: topbarMoreButtonRect.bottom + 6 })
        }}
        className="hidden group-data-[papeliz-topbar-export-and-settings-folded]/papeliz-topbar:grid"
      >
        <span className="relative">
          <Ellipsis className="size-[17px]" aria-hidden="true" />
          <PapelizDesktopAppUpdateGearDot />
        </span>
      </PapelizTopbarFrostedSquareButton>
      {topbarMoreMenuPosition !== null && (
        <PapelizPopoverMenu
          menuLabel="More"
          menuPosition={topbarMoreMenuPosition}
          menuItems={[
            { menuItemKey: 'export', menuItemLabel: 'Export…', MenuItemIcon: Share, onMenuItemSelect: () => pressFoldedTopbarButton('Export') },
            { menuItemKey: 'settings', menuItemLabel: 'Settings', MenuItemIcon: Settings, onMenuItemSelect: () => pressFoldedTopbarButton('Settings') },
          ]}
          onMenuClose={() => setTopbarMoreMenuPosition(null)}
        />
      )}
    </>
  )
}

// The MD Code | MD View switch, centered in the topbar. The white pill's two edges ease on their
// own, the leading edge first, so it stretches toward the new view and then settles; pressing the
// other view leans it that way before the click lands. The motion lives in papeliz-webapp.css
// (.papeliz-note-view-switch). When the bar has no room for its labels it shows the icons alone, each
// still named, with its tooltip.
// A text file (JSON, `.gitignore`, a script) has only MD Code: while one is in front the switch shows
// MD Code and MD View is greyed out, and the view picked for notes comes back on a note's tab.
// The Android and iOS app's top bar shows this same switch, sized for a thumb.
export function PapelizNoteViewSwitch() {
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
          <span className="group-data-[papeliz-topbar-switch-labels-hidden]/papeliz-topbar:sr-only">{noteViewLabel}</span>
        </button>
      ))}
    </div>
  )
}

// The blue bar across the top of the workspace: the file list toggle, Papeliz and the vault's name
// on the left, the view switch in the middle, and on the right the Assistant panel, Export and the
// Settings gear (in focus mode Exit focus takes the Assistant's place; the gear stays at the edge), or
// More in place of Export and Settings when the bar is at its narrowest. The mark
// and Papeliz are only a name: pressing them does nothing (the gear's Close Vault closes the vault).
// Its two sides share the leftover width equally, so the switch stays centered in the window while
// there's room; when the right side needs more (Papeliz for Windows' window buttons), the switch moves
// left of center rather than anything overlapping. The bar measures what fits whenever its width or
// its words change, and gives way in the order above.
export function PapelizWorkspaceTopbar() {
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)
  const isExplorerPanelOpen = usePapelizWorkspaceStore((workspaceState) => workspaceState.isExplorerPanelOpen)
  const isAssistantPanelOpen = usePapelizWorkspaceStore((workspaceState) => workspaceState.isAssistantPanelOpen)
  const isFocusModeOn = usePapelizWorkspaceStore((workspaceState) => workspaceState.isFocusModeOn)
  const setExplorerPanelOpen = usePapelizWorkspaceStore((workspaceState) => workspaceState.setExplorerPanelOpen)
  const setAssistantPanelOpen = usePapelizWorkspaceStore((workspaceState) => workspaceState.setAssistantPanelOpen)
  const setFocusModeOn = usePapelizWorkspaceStore((workspaceState) => workspaceState.setFocusModeOn)
  const desktopWindowBarDragHandlers = usePapelizDesktopWindowBarDragHandlers()
  const topbarRef = useRef<HTMLElement>(null)
  const openVaultDisplayName = openVault?.papelizVaultDisplayName ?? null

  // Measured before the bar is painted, again whenever its width changes, and once the fonts have
  // loaded, since the words' widths change with them. A width change refits in the next frame, not in
  // the resize observer's own call, where changing the bar's layout would loop the observer.
  useLayoutEffect(() => {
    const topbarElement = topbarRef.current
    if (topbarElement === null) return
    fitPapelizTopbarToItsRoom(topbarElement)
    let measuredTopbarWidth = topbarElement.clientWidth
    let topbarRefitFrame = 0
    const topbarResizeObserver = new ResizeObserver(() => {
      if (topbarElement.clientWidth === measuredTopbarWidth) return
      measuredTopbarWidth = topbarElement.clientWidth
      cancelAnimationFrame(topbarRefitFrame)
      topbarRefitFrame = requestAnimationFrame(() => fitPapelizTopbarToItsRoom(topbarElement))
    })
    topbarResizeObserver.observe(topbarElement)
    let isTopbarGone = false
    void document.fonts?.ready.then(() => {
      if (!isTopbarGone) fitPapelizTopbarToItsRoom(topbarElement)
    })
    return () => {
      isTopbarGone = true
      cancelAnimationFrame(topbarRefitFrame)
      topbarResizeObserver.disconnect()
    }
  }, [openVaultDisplayName, isFocusModeOn])

  return (
    <header
      ref={topbarRef}
      {...desktopWindowBarDragHandlers}
      className={joinPapelizClassNames(
        'group/papeliz-topbar grid h-12 flex-none grid-cols-[1fr_auto_1fr] items-center gap-2 overflow-hidden bg-papeliz-topbar pl-3 text-white data-[papeliz-topbar-gaps-tight]:gap-1 data-[papeliz-topbar-gaps-tight]:pl-2',
        // In Papeliz for Windows the window buttons end the bar, flush with the window's edge.
        isPapelizDesktopApp ? 'pr-0' : 'pr-3 data-[papeliz-topbar-gaps-tight]:pr-2',
      )}
    >
      {/* The left side may shrink: the vault's name cuts short, and the bar's steps take what can't. */}
      <div
        data-papeliz-topbar-side=""
        className="flex min-w-0 items-center gap-1.5 group-data-[papeliz-topbar-gaps-tight]/papeliz-topbar:gap-1"
      >
        {!isFocusModeOn && (
          <PapelizIconButton
            iconButtonLabel={isExplorerPanelOpen ? 'Hide the File List' : 'Show the File List'}
            iconButtonTone="topbar"
            className="flex-none"
            onClick={() => setExplorerPanelOpen(!isExplorerPanelOpen)}
          >
            <PapelizFileListToggleIcon isFileListOpen={isExplorerPanelOpen} className="size-[18px]" />
          </PapelizIconButton>
        )}
        <div className="flex flex-none items-center gap-1.5 px-1 py-1 select-none group-data-[papeliz-topbar-gaps-tight]/papeliz-topbar:gap-1">
          <PapelizMark papelizMarkSize={26} papelizMarkTone="on-blue" className="ml-0.5 flex-none group-data-[papeliz-topbar-gaps-tight]/papeliz-topbar:ml-0" />
          <span className="text-[15px] font-semibold tracking-[-0.01em] group-data-[papeliz-topbar-papeliz-word-hidden]/papeliz-topbar:sr-only">Papeliz</span>
        </div>
        {openVault !== null && (
          <span
            data-papeliz-topbar-vault-name=""
            className="min-w-0 truncate text-sm text-white/95 group-data-[papeliz-topbar-vault-name-hidden]/papeliz-topbar:hidden"
          >
            <span className="mx-1 text-white/60" aria-hidden="true">
              /
            </span>
            {openVault.papelizVaultDisplayName}
          </span>
        )}
      </div>

      <PapelizNoteViewSwitch />

      {/* The right side never shrinks below its buttons: the switch moves aside first. */}
      <div data-papeliz-topbar-side="" className="flex items-center justify-end gap-1.5 group-data-[papeliz-topbar-gaps-tight]/papeliz-topbar:gap-1">
        {isFocusModeOn ? (
          <PapelizPillButton pillButtonVariant="on-topbar" pillButtonSize="small" className="mr-1 flex-none" onClick={() => setFocusModeOn(false)} title="Exit Focus (Esc)">
            <Minimize2 className="size-[14px]" aria-hidden="true" />
            <span className="group-data-[papeliz-topbar-switch-labels-hidden]/papeliz-topbar:sr-only">Exit Focus</span>
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
        {/* Folded into More at the narrowest, their buttons keep no box, and their panels open from More. */}
        <span data-papeliz-topbar-folded-buttons="" className="contents group-data-[papeliz-topbar-export-and-settings-folded]/papeliz-topbar:hidden">
          <PapelizTopbarExportButton />
          <PapelizSettingsGearButton settingsGearPlace="workspace" />
        </span>
        <PapelizTopbarMoreButton />
        <PapelizDesktopWindowControls />
      </div>
    </header>
  )
}
