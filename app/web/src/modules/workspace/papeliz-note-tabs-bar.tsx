import { CopyX, Eye, ListX, Lock, LockOpen, Plus, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizPopoverMenu, type PapelizPopoverMenuItem, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import { getVaultEntryName, getVaultEntryParentFolderRelativePath, getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import { usePapelizNoteTabsLayoutStore } from './papeliz-note-tabs-layout-store'
import { describePapelizNoteSaveFailure } from './papeliz-note-save-failure-words'
import { findVaultNoteEditingLock, type PapelizVaultNoteEditingLock } from './papeliz-vault-entry-locks'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

// How far the pointer travels before a pressed tab lifts and follows it.
const papelizNoteTabDragStartDistance = 6
// The room kept between the open tab and the strip's edges when it is scrolled into sight.
const papelizActiveNoteTabScrollMargin = 12
const papelizNoteTabKeysDescriptionId = 'papeliz-note-tab-keys-description'
// The gap between two tabs, where the strip shows through (Tailwind `gap-0.5`).
const papelizNoteTabGap = 2
const papelizNoteTabSlideTransition = 'transform 180ms var(--ease-papeliz-out), background-color 150ms ease, color 150ms ease'
// How long the strip's scrollbar stays in sight after the tabs stop scrolling.
const papelizNoteTabsScrollbarShownAfterScrollMilliseconds = 800

interface PapelizNoteTabDrag {
  draggedVaultNoteRelativePath: string
  draggedNoteTabStartIndex: number
  noteTabSlotWidth: number
  // How far the dragged tab has moved, kept within the strip.
  draggedNoteTabTravelX: number
  // Stacked rows only: how far down or up the tab has moved (it follows the pointer freely), where
  // it will land, and the tab beside which a blue line marks that place.
  stackedDraggedNoteTabTravelY?: number
  stackedDropNoteTabIndex?: number
  stackedDropIndicator?: { indicatedVaultNoteRelativePath: string; indicatedSide: 'before' | 'after' } | null
}

interface PapelizNoteTabMenuState {
  menuVaultNoteRelativePath: string
  menuPosition: PapelizPopoverMenuPosition
}

interface PapelizNoteTabPress {
  pressedVaultNoteRelativePath: string
  pressedNoteTabIndex: number
  pressedNoteTabElement: HTMLElement
  pointerStartX: number
  pointerStartY: number
  pointerId: number
}

// The tab lock's words: what a click does, given what keeps the note from being edited.
function describeNoteTabLock(vaultNoteEditingLock: PapelizVaultNoteEditingLock | null, vaultNoteRelativePath: string, vaultNoteTabTitle: string) {
  if (vaultNoteEditingLock === null) return { noteTabLockLabel: `Lock ${vaultNoteTabTitle}`, noteTabLockTitle: 'Lock This Note' }
  if (vaultNoteEditingLock.vaultNoteEditingLockKind === 'hidden-folder') {
    return { noteTabLockLabel: `${vaultNoteTabTitle} is read-only`, noteTabLockTitle: 'Notes in hidden folders open read-only.' }
  }
  if (vaultNoteEditingLock.vaultNoteEditingLockKind === 'whole-vault') {
    return { noteTabLockLabel: 'All notes are locked', noteTabLockTitle: 'All notes are locked. Turn off Lock All Notes in the Settings gear.' }
  }
  if (vaultNoteEditingLock.lockingVaultEntryRelativePath === vaultNoteRelativePath) {
    return { noteTabLockLabel: `Unlock ${vaultNoteTabTitle}`, noteTabLockTitle: 'Locked. Click to unlock.' }
  }
  const lockingFolderName = getVaultEntryName(vaultNoteEditingLock.lockingVaultEntryRelativePath)
  return {
    noteTabLockLabel: `Unlock the Folder “${lockingFolderName}”`,
    noteTabLockTitle: `Locked with the folder “${lockingFolderName}”. Click to unlock the folder.`,
  }
}

function getNoteTabDragTargetIndex(noteTabDrag: PapelizNoteTabDrag, openNoteTabCount: number): number {
  const unclampedTargetIndex = Math.round(noteTabDrag.draggedNoteTabStartIndex + noteTabDrag.draggedNoteTabTravelX / noteTabDrag.noteTabSlotWidth)
  return Math.max(0, Math.min(openNoteTabCount - 1, unclampedTargetIndex))
}

// Where a tab is drawn during a drag: the dragged one under the pointer, the ones it has passed
// moved one slot toward the gap it left.
function getNoteTabDragShiftX(noteTabIndex: number, noteTabDrag: PapelizNoteTabDrag | null, openNoteTabCount: number): number {
  if (noteTabDrag === null) return 0
  const { draggedNoteTabStartIndex, noteTabSlotWidth } = noteTabDrag
  if (noteTabIndex === draggedNoteTabStartIndex) return noteTabDrag.draggedNoteTabTravelX
  const noteTabDragTargetIndex = getNoteTabDragTargetIndex(noteTabDrag, openNoteTabCount)
  if (draggedNoteTabStartIndex < noteTabDragTargetIndex && noteTabIndex > draggedNoteTabStartIndex && noteTabIndex <= noteTabDragTargetIndex) {
    return -noteTabSlotWidth
  }
  if (noteTabDragTargetIndex < draggedNoteTabStartIndex && noteTabIndex >= noteTabDragTargetIndex && noteTabIndex < draggedNoteTabStartIndex) {
    return noteTabSlotWidth
  }
  return 0
}

// The open notes, as a strip at the top of the note column. Tabs have rounded tops and a small gap
// between them, on a darker strip, so each reads as its own tab; the open one takes the note's own
// background (with a blue line on top) and joins the page below. The close button shows on hover; a note with changes on their
// way to disk shows a blue dot in its place, and one whose save failed a red dot. A tab is dragged
// sideways to reorder (it lifts after a few pixels, the others make room, Esc puts it back), or moved
// with Alt+Shift+Left/Right. A right-click, Shift+F10 or the menu key opens a tab's menu: Close, Close
// Others and Close All.
export function PapelizNoteTabsBar() {
  const openNoteTabRelativePaths = usePapelizWorkspaceStore((workspaceState) => workspaceState.openNoteTabRelativePaths)
  const activeVaultNoteRelativePath = usePapelizWorkspaceStore((workspaceState) => workspaceState.activeVaultNoteRelativePath)
  // An AI Assistant proposal shown whole has a read-only tab of its own, after the notes' tabs.
  const assistantProposalPreview = usePapelizWorkspaceStore((workspaceState) => workspaceState.assistantProposalPreview)
  const closeAssistantProposalPreview = usePapelizWorkspaceStore((workspaceState) => workspaceState.closeAssistantProposalPreview)
  const loadedVaultNotesByRelativePath = usePapelizWorkspaceStore((workspaceState) => workspaceState.loadedVaultNotesByRelativePath)
  const lockedVaultEntryRelativePaths = usePapelizWorkspaceStore((workspaceState) => workspaceState.lockedVaultEntryRelativePaths)
  const isWholeVaultEditingLocked = usePapelizWorkspaceStore((workspaceState) => workspaceState.isWholeVaultEditingLocked)
  const noteTabsLayout = usePapelizNoteTabsLayoutStore((noteTabsLayoutState) => noteTabsLayoutState.noteTabsLayout)
  const isNoteTabsStacked = noteTabsLayout === 'stack'
  const setVaultEntryEditingLocked = usePapelizWorkspaceStore((workspaceState) => workspaceState.setVaultEntryEditingLocked)
  const showWorkspaceNotice = usePapelizWorkspaceStore((workspaceState) => workspaceState.showWorkspaceNotice)

  // The lock at the front of a tab: open when the note can be edited, closed when it (or its
  // folder, or the whole vault) is locked. A click locks the note, or unlocks whatever locks it;
  // the whole vault's lock is lifted with Lock All Notes in the Settings gear.
  const toggleVaultNoteTabLock = (vaultNoteRelativePath: string) => {
    const vaultNoteEditingLock = findVaultNoteEditingLock(isWholeVaultEditingLocked, lockedVaultEntryRelativePaths, vaultNoteRelativePath)
    if (vaultNoteEditingLock === null) {
      setVaultEntryEditingLocked(vaultNoteRelativePath, true)
      return
    }
    if (vaultNoteEditingLock.vaultNoteEditingLockKind === 'hidden-folder') {
      showWorkspaceNotice('info', 'This note is in a hidden folder, which Papeliz only reads.')
      return
    }
    if (vaultNoteEditingLock.vaultNoteEditingLockKind === 'whole-vault') {
      showWorkspaceNotice('info', 'All notes are locked. Turn off Lock All Notes in the Settings gear.')
      return
    }
    const lockingVaultEntryRelativePath = vaultNoteEditingLock.lockingVaultEntryRelativePath
    setVaultEntryEditingLocked(lockingVaultEntryRelativePath, false)
    if (lockingVaultEntryRelativePath !== vaultNoteRelativePath) {
      showWorkspaceNotice('info', `Unlocked “${getVaultEntryName(lockingVaultEntryRelativePath)}”.`)
    }
  }
  const openVaultNote = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVaultNote)
  const closeVaultNoteTab = usePapelizWorkspaceStore((workspaceState) => workspaceState.closeVaultNoteTab)
  const closeOtherVaultNoteTabs = usePapelizWorkspaceStore((workspaceState) => workspaceState.closeOtherVaultNoteTabs)
  const closeAllVaultNoteTabs = usePapelizWorkspaceStore((workspaceState) => workspaceState.closeAllVaultNoteTabs)
  const moveVaultNoteTab = usePapelizWorkspaceStore((workspaceState) => workspaceState.moveVaultNoteTab)
  const createVaultNoteInFolder = usePapelizWorkspaceStore((workspaceState) => workspaceState.createVaultNoteInFolder)

  const vaultNoteTabTitles = openNoteTabRelativePaths.map(getVaultNoteTitle)
  const noteTabsNavRef = useRef<HTMLElement>(null)
  // The tabs are one stop for Tab: the open note's tab (or the first) takes focus, the arrow keys move
  // between tabs, Delete closes one and L locks or unlocks it. Each tab's lock and close are for the
  // pointer only.
  const rovingFocusVaultNoteRelativePath =
    activeVaultNoteRelativePath !== null && openNoteTabRelativePaths.includes(activeVaultNoteRelativePath) ? activeVaultNoteRelativePath : (openNoteTabRelativePaths[0] ?? null)
  const focusNoteTabTitleButton = (noteTabIndex: number) => {
    noteTabsNavRef.current?.querySelectorAll<HTMLButtonElement>('[data-papeliz-note-tab-title]')[noteTabIndex]?.focus()
  }
  // The strip is found through its keys description, not its ref, so the tab menu's items (made
  // during render, where a ref may not be read) can use this too.
  const focusRovingNoteTabAfterClose = () =>
    requestAnimationFrame(() => {
      if (document.activeElement !== null && document.activeElement !== document.body) return
      document
        .getElementById(papelizNoteTabKeysDescriptionId)
        ?.closest('nav')
        ?.querySelector<HTMLButtonElement>('[data-papeliz-note-tab-title][tabindex="0"]')
        ?.focus()
    })
  const [noteTabMenuState, setNoteTabMenuState] = useState<PapelizNoteTabMenuState | null>(null)
  // A tab closed some other way takes its menu with it.
  if (noteTabMenuState !== null && !openNoteTabRelativePaths.includes(noteTabMenuState.menuVaultNoteRelativePath)) setNoteTabMenuState(null)
  const getNoteTabMenuItems = (menuVaultNoteRelativePath: string): PapelizPopoverMenuItem[] => [
    {
      menuItemKey: 'close-note-tab',
      menuItemLabel: 'Close',
      MenuItemIcon: X,
      onMenuItemSelect: () => void closeVaultNoteTab(menuVaultNoteRelativePath).then(focusRovingNoteTabAfterClose),
    },
    {
      menuItemKey: 'close-other-note-tabs',
      menuItemLabel: 'Close Others',
      MenuItemIcon: ListX,
      isMenuItemDisabled: openNoteTabRelativePaths.length < 2,
      onMenuItemSelect: () => void closeOtherVaultNoteTabs(menuVaultNoteRelativePath),
    },
    {
      menuItemKey: 'close-all-note-tabs',
      menuItemLabel: 'Close All',
      MenuItemIcon: CopyX,
      onMenuItemSelect: () => void closeAllVaultNoteTabs(),
    },
  ]
  const openNoteTabMenuUnderNoteTab = (menuVaultNoteRelativePath: string, noteTabElement: Element) => {
    const noteTabRect = noteTabElement.getBoundingClientRect()
    setNoteTabMenuState({ menuVaultNoteRelativePath, menuPosition: { menuAnchorLeft: noteTabRect.left, menuAnchorTop: noteTabRect.bottom + 4 } })
  }
  const [noteTabDrag, setNoteTabDrag] = useState<PapelizNoteTabDrag | null>(null)
  // True for the frame after a drop: the tabs swap places in the list then, so nothing may slide.
  const [isNoteTabDropSettling, setNoteTabDropSettling] = useState(false)
  const noteTabDropSettleRef = useRef<{
    settlingVaultNoteRelativePath: string
    settleFromOffsetX: number
    // Stacked rows: where the dropped tab was drawn, so it glides from there into its new place.
    settleFromRect?: DOMRect
  } | null>(null)
  const stopListeningToNoteTabPressRef = useRef<(() => void) | null>(null)
  const noteTabsScrollbarHideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    // Keep the open tab wholly in sight, clear of the strip's edges (and so of New note beside it):
    // when it changes, and whenever the strip changes width (the Assistant opening, a phone turning).
    // Measured from the layout, not the screen, so a tab still growing in (papeliz-tab-enter) or
    // sliding during a drag is placed where it ends up.
    const noteTabsNavElement = noteTabsNavRef.current
    if (noteTabsNavElement === null || isNoteTabsStacked) return
    const scrollActiveNoteTabIntoView = () => {
      const activeNoteTabElement = noteTabsNavElement.querySelector<HTMLElement>('[aria-current="page"]')?.parentElement
      if (!activeNoteTabElement) return
      const activeNoteTabStart = activeNoteTabElement.offsetLeft - papelizActiveNoteTabScrollMargin
      const activeNoteTabEnd = activeNoteTabElement.offsetLeft + activeNoteTabElement.offsetWidth + papelizActiveNoteTabScrollMargin
      if (activeNoteTabStart < noteTabsNavElement.scrollLeft) noteTabsNavElement.scrollLeft = activeNoteTabStart
      else if (activeNoteTabEnd > noteTabsNavElement.scrollLeft + noteTabsNavElement.clientWidth) {
        noteTabsNavElement.scrollLeft = activeNoteTabEnd - noteTabsNavElement.clientWidth
      }
    }
    scrollActiveNoteTabIntoView()
    const noteTabsNavResizeObserver = new ResizeObserver(scrollActiveNoteTabIntoView)
    noteTabsNavResizeObserver.observe(noteTabsNavElement)
    return () => noteTabsNavResizeObserver.disconnect()
  }, [activeVaultNoteRelativePath, openNoteTabRelativePaths, assistantProposalPreview, isNoteTabsStacked])

  useEffect(() => () => stopListeningToNoteTabPressRef.current?.(), [])
  useEffect(() => () => clearTimeout(noteTabsScrollbarHideTimerRef.current), [])

  useLayoutEffect(() => {
    if (!isNoteTabDropSettling) return
    // The dropped tab glides the last bit into its slot.
    const noteTabDropSettle = noteTabDropSettleRef.current
    noteTabDropSettleRef.current = null
    const droppedNoteTabElement =
      noteTabDropSettle === null
        ? null
        : noteTabsNavRef.current?.querySelector<HTMLElement>(`[data-papeliz-note-tab-path="${CSS.escape(noteTabDropSettle.settlingVaultNoteRelativePath)}"]`)
    if (noteTabDropSettle?.settleFromRect !== undefined && droppedNoteTabElement) {
      const settledNoteTabRect = droppedNoteTabElement.getBoundingClientRect()
      const settleFromOffsetX = noteTabDropSettle.settleFromRect.left - settledNoteTabRect.left
      const settleFromOffsetY = noteTabDropSettle.settleFromRect.top - settledNoteTabRect.top
      droppedNoteTabElement.animate([{ transform: `translate(${settleFromOffsetX}px, ${settleFromOffsetY}px)` }, { transform: 'translate(0, 0)' }], {
        duration: 200,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      })
    } else if (noteTabDropSettle !== null && noteTabDropSettle.settleFromOffsetX !== 0) {
      droppedNoteTabElement?.animate([{ transform: `translateX(${noteTabDropSettle.settleFromOffsetX}px)` }, { transform: 'translateX(0)' }], {
        duration: 160,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      })
    }
    const settleFrame = requestAnimationFrame(() => setNoteTabDropSettling(false))
    return () => cancelAnimationFrame(settleFrame)
  }, [isNoteTabDropSettling])

  const startListeningToNoteTabPress = (noteTabPress: PapelizNoteTabPress) => {
    stopListeningToNoteTabPressRef.current?.()
    const openNoteTabCount = openNoteTabRelativePaths.length
    let currentNoteTabDrag: PapelizNoteTabDrag | null = null

    const finishNoteTabPress = (shouldDropNoteTab: boolean) => {
      stopListeningToNoteTabPress()
      if (currentNoteTabDrag === null) return
      const finishedNoteTabDrag = currentNoteTabDrag
      currentNoteTabDrag = null
      delete document.documentElement.dataset.papelizNoteTabDragging
      const noteTabDragTargetIndex = !shouldDropNoteTab
        ? finishedNoteTabDrag.draggedNoteTabStartIndex
        : finishedNoteTabDrag.stackedDropNoteTabIndex !== undefined
          ? finishedNoteTabDrag.stackedDropNoteTabIndex
          : getNoteTabDragTargetIndex(finishedNoteTabDrag, openNoteTabCount)
      noteTabDropSettleRef.current = {
        settlingVaultNoteRelativePath: finishedNoteTabDrag.draggedVaultNoteRelativePath,
        settleFromOffsetX:
          finishedNoteTabDrag.stackedDropNoteTabIndex !== undefined
            ? 0
            : finishedNoteTabDrag.draggedNoteTabTravelX -
              (noteTabDragTargetIndex - finishedNoteTabDrag.draggedNoteTabStartIndex) * finishedNoteTabDrag.noteTabSlotWidth,
        // Where the dragged tab was drawn under the pointer, for its glide into place.
        settleFromRect: finishedNoteTabDrag.stackedDropNoteTabIndex !== undefined ? noteTabPress.pressedNoteTabElement.getBoundingClientRect() : undefined,
      }
      setNoteTabDrag(null)
      setNoteTabDropSettling(true)
      if (shouldDropNoteTab) moveVaultNoteTab(finishedNoteTabDrag.draggedVaultNoteRelativePath, noteTabDragTargetIndex)
    }

    const followPointer = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== noteTabPress.pointerId) return
      const pointerTravelX = pointerEvent.clientX - noteTabPress.pointerStartX
      if (isNoteTabsStacked) {
        // Stacked rows, as in VS Code: the tab lifts and follows the pointer across rows, and a blue
        // line marks where it will land: before the tab under the pointer, or after it past its middle.
        const pointerTravelY = pointerEvent.clientY - noteTabPress.pointerStartY
        if (currentNoteTabDrag === null && Math.hypot(pointerTravelX, pointerTravelY) < papelizNoteTabDragStartDistance) return
        if (currentNoteTabDrag === null) document.documentElement.dataset.papelizNoteTabDragging = 'true'
        // The dragged tab lets the pointer through, so this is the tab beneath it.
        const hoveredNoteTabElement = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)?.closest<HTMLElement>('[data-papeliz-note-tab-path]')
        const hoveredNoteTabPath = hoveredNoteTabElement?.dataset.papelizNoteTabPath
        let stackedDropNoteTabIndex = currentNoteTabDrag?.stackedDropNoteTabIndex ?? noteTabPress.pressedNoteTabIndex
        let stackedDropIndicator = currentNoteTabDrag?.stackedDropIndicator ?? null
        if (hoveredNoteTabElement && hoveredNoteTabPath !== undefined && hoveredNoteTabPath !== noteTabPress.pressedVaultNoteRelativePath) {
          const hoveredNoteTabIndex = openNoteTabRelativePaths.indexOf(hoveredNoteTabPath)
          const hoveredNoteTabRect = hoveredNoteTabElement.getBoundingClientRect()
          const isDropAfterHoveredTab = pointerEvent.clientX > hoveredNoteTabRect.left + hoveredNoteTabRect.width / 2
          // Counted with the dragged tab still in its old place, then without it.
          const insertionNoteTabIndex = hoveredNoteTabIndex + (isDropAfterHoveredTab ? 1 : 0)
          stackedDropNoteTabIndex = insertionNoteTabIndex > noteTabPress.pressedNoteTabIndex ? insertionNoteTabIndex - 1 : insertionNoteTabIndex
          stackedDropIndicator = { indicatedVaultNoteRelativePath: hoveredNoteTabPath, indicatedSide: isDropAfterHoveredTab ? 'after' : 'before' }
        }
        currentNoteTabDrag = {
          draggedVaultNoteRelativePath: noteTabPress.pressedVaultNoteRelativePath,
          draggedNoteTabStartIndex: noteTabPress.pressedNoteTabIndex,
          noteTabSlotWidth: noteTabPress.pressedNoteTabElement.offsetWidth + papelizNoteTabGap,
          draggedNoteTabTravelX: pointerTravelX,
          stackedDraggedNoteTabTravelY: pointerTravelY,
          stackedDropNoteTabIndex,
          stackedDropIndicator,
        }
        setNoteTabDrag(currentNoteTabDrag)
        return
      }
      if (currentNoteTabDrag === null) {
        if (Math.abs(pointerTravelX) < papelizNoteTabDragStartDistance) return
        document.documentElement.dataset.papelizNoteTabDragging = 'true'
        currentNoteTabDrag = {
          draggedVaultNoteRelativePath: noteTabPress.pressedVaultNoteRelativePath,
          draggedNoteTabStartIndex: noteTabPress.pressedNoteTabIndex,
          noteTabSlotWidth: noteTabPress.pressedNoteTabElement.offsetWidth + papelizNoteTabGap,
          draggedNoteTabTravelX: 0,
        }
      }
      const { draggedNoteTabStartIndex, noteTabSlotWidth } = currentNoteTabDrag
      currentNoteTabDrag = {
        ...currentNoteTabDrag,
        draggedNoteTabTravelX: Math.max(
          -draggedNoteTabStartIndex * noteTabSlotWidth,
          Math.min((openNoteTabCount - 1 - draggedNoteTabStartIndex) * noteTabSlotWidth, pointerTravelX),
        ),
      }
      setNoteTabDrag(currentNoteTabDrag)
    }
    const dropOnPointerUp = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId === noteTabPress.pointerId) finishNoteTabPress(true)
    }
    const cancelOnPointerCancel = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId === noteTabPress.pointerId) finishNoteTabPress(false)
    }
    const cancelOnEscape = (keyboardEvent: globalThis.KeyboardEvent) => {
      if (keyboardEvent.key !== 'Escape' || currentNoteTabDrag === null) return
      keyboardEvent.preventDefault()
      keyboardEvent.stopPropagation()
      finishNoteTabPress(false)
    }
    const stopListeningToNoteTabPress = () => {
      window.removeEventListener('pointermove', followPointer)
      window.removeEventListener('pointerup', dropOnPointerUp)
      window.removeEventListener('pointercancel', cancelOnPointerCancel)
      window.removeEventListener('keydown', cancelOnEscape, true)
      stopListeningToNoteTabPressRef.current = null
    }
    window.addEventListener('pointermove', followPointer)
    window.addEventListener('pointerup', dropOnPointerUp)
    window.addEventListener('pointercancel', cancelOnPointerCancel)
    window.addEventListener('keydown', cancelOnEscape, true)
    stopListeningToNoteTabPressRef.current = () => {
      stopListeningToNoteTabPress()
      if (currentNoteTabDrag !== null) delete document.documentElement.dataset.papelizNoteTabDragging
    }
  }

  // New note: after the strip in Scroll, right after the last tab in Stack.
  const newNoteTabButton = (
    <button
      type="button"
      aria-label="New Note"
      title="New Note"
      onClick={() =>
        void createVaultNoteInFolder(activeVaultNoteRelativePath === null ? '' : getVaultEntryParentFolderRelativePath(activeVaultNoteRelativePath))
      }
      // A solid blue button with a white plus, so it is easy to see. On touch screens it keeps the
      // same 28 px, centred on the tab row, with no shadow; an invisible 44 × 40 px area around it
      // (the strip's full height) takes the tap.
      className={joinPapelizClassNames(
        'relative grid size-7 flex-none place-items-center rounded-md bg-papeliz-gradient-start text-white shadow-papeliz-card transition-[filter,transform] duration-150 hover:brightness-[1.12] active:scale-[.94] pointer-coarse:ml-2 pointer-coarse:shadow-none pointer-coarse:before:absolute pointer-coarse:before:-inset-x-2 pointer-coarse:before:-inset-y-1.5',
        isNoteTabsStacked ? 'mx-0.5' : 'mx-1 mb-[3px] self-end',
      )}
    >
      <Plus className="size-4" aria-hidden="true" />
    </button>
  )

  return (
    // The strip's bottom line is an inset shadow, so the open tab can cover it and join the page.
    <div
      className={joinPapelizClassNames(
        'flex flex-none items-end bg-papeliz-tab-strip pl-1.5 shadow-[inset_0_-1px_0_var(--color-papeliz-line)]',
        isNoteTabsStacked ? 'min-h-10' : 'h-10',
      )}
    >
      {/* Scroll: when the tabs don't fit, a thin blue scrollbar runs under them, shown only while the
          pointer is over the tabs or they scroll; the tabs keep their height and rise into the gap
          above them to make room, and a mouse wheel scrolls the strip sideways. Stack
          (Accessibility): the tabs wrap onto more rows, so every one shows. */}
      <nav
        ref={noteTabsNavRef}
        aria-label="Open notes"
        onWheel={(wheelEvent) => {
          if (isNoteTabsStacked) return
          if (Math.abs(wheelEvent.deltaY) > Math.abs(wheelEvent.deltaX)) wheelEvent.currentTarget.scrollLeft += wheelEvent.deltaY
        }}
        // The scrollbar shows while a mouse is over the tabs, and while they move (a finger has no
        // hover). Both are marked on the strip, not left to :hover, which Chrome doesn't redraw a
        // scrollbar for.
        onPointerEnter={(pointerEnterEvent) => {
          if (pointerEnterEvent.pointerType !== 'touch') pointerEnterEvent.currentTarget.dataset['papelizNoteTabsPointerOver'] = 'true'
        }}
        onPointerLeave={(pointerLeaveEvent) => {
          delete pointerLeaveEvent.currentTarget.dataset['papelizNoteTabsPointerOver']
        }}
        onScroll={(scrollEvent) => {
          const noteTabsNavElement = scrollEvent.currentTarget
          noteTabsNavElement.dataset['papelizNoteTabsScrolling'] = 'true'
          clearTimeout(noteTabsScrollbarHideTimerRef.current)
          noteTabsScrollbarHideTimerRef.current = setTimeout(() => {
            delete noteTabsNavElement.dataset['papelizNoteTabsScrolling']
          }, papelizNoteTabsScrollbarShownAfterScrollMilliseconds)
        }}
        className={joinPapelizClassNames(
          // Relative, so each tab's offsetLeft is measured from the strip (the scroll into sight above).
          'relative flex min-w-0 items-end',
          isNoteTabsStacked ? 'flex-1 pt-1.5' : 'papeliz-note-tabs-scroller h-10 overflow-x-auto overflow-y-hidden',
        )}
      >
        <span id={papelizNoteTabKeysDescriptionId} className="sr-only">
          Left and Right move between tabs, Delete closes a tab, L locks or unlocks its note, and Shift+F10 opens its menu.
        </span>
        <div className={isNoteTabsStacked ? 'flex flex-wrap gap-x-0.5 gap-y-1 [&>*]:h-[34px]' : 'flex h-[34px] flex-none items-stretch gap-0.5'}>
          {openNoteTabRelativePaths.map((vaultNoteRelativePath, vaultNoteTabIndex) => {
            const isActiveTab = vaultNoteRelativePath === activeVaultNoteRelativePath && assistantProposalPreview === null
            const isDraggedTab = noteTabDrag?.draggedVaultNoteRelativePath === vaultNoteRelativePath
            const vaultNoteTabTitle = vaultNoteTabTitles[vaultNoteTabIndex] ?? vaultNoteRelativePath
            const vaultNoteEditingLock = findVaultNoteEditingLock(isWholeVaultEditingLocked, lockedVaultEntryRelativePaths, vaultNoteRelativePath)
            const { noteTabLockLabel, noteTabLockTitle } = describeNoteTabLock(vaultNoteEditingLock, vaultNoteRelativePath, vaultNoteTabTitle)
            const stackedDropIndicatorSide =
              noteTabDrag?.stackedDropIndicator?.indicatedVaultNoteRelativePath === vaultNoteRelativePath ? noteTabDrag.stackedDropIndicator.indicatedSide : null
            const loadedVaultNote = loadedVaultNotesByRelativePath[vaultNoteRelativePath]
            const noteSaveState = loadedVaultNote?.noteSaveState
            // A save that failed or clashed marks the tab red, so it is seen from any note.
            const isNoteNotSaved = noteSaveState === 'save-failed' || noteSaveState === 'save-conflict'
            const hasChangesOnTheirWay = noteSaveState === 'unsaved' || noteSaveState === 'saving' || isNoteNotSaved
            const noteNotSavedReason =
              noteSaveState === 'save-failed'
                ? describePapelizNoteSaveFailure(loadedVaultNote?.noteSaveErrorMessage ?? null).noteSaveFailureShortReason
                : 'Changed elsewhere, press Settle in the status bar'
            // Two tabs with the same title show their folder, so they can be told apart.
            const hasSameTitleTab = vaultNoteTabTitles.filter((otherTabTitle) => otherTabTitle === vaultNoteTabTitle).length > 1
            return (
              <div
                key={vaultNoteRelativePath}
                data-papeliz-note-tab-path={vaultNoteRelativePath}
                className={joinPapelizClassNames(
                  'papeliz-tab-enter group relative flex w-[168px] flex-none items-center rounded-t-lg text-[13px]',
                  isActiveTab
                    ? // The blue line is an inset shadow, so it follows the tab's rounded corners exactly.
                      'bg-papeliz-surface text-papeliz-ink shadow-[inset_0_2px_0_var(--color-papeliz-blue),1px_0_0_var(--color-papeliz-line),-1px_0_0_var(--color-papeliz-line)]'
                    : 'bg-papeliz-tab text-papeliz-ink-muted hover:bg-papeliz-tab-hover hover:text-papeliz-ink',
                  // A thin outline on its top and sides, so each tab that isn't open reads as its own.
                  !isActiveTab &&
                    !isDraggedTab &&
                    'shadow-[inset_0_1px_0_var(--color-papeliz-line-strong),inset_1px_0_0_var(--color-papeliz-line-strong),inset_-1px_0_0_var(--color-papeliz-line-strong)]',
                  isDraggedTab && 'z-10 bg-papeliz-surface text-papeliz-ink shadow-papeliz-pop',
                  // In stacked rows, a blue line beside a tab marks where the dragged one will land.
                  stackedDropIndicatorSide !== null && `papeliz-note-tab-drop-indicator-${stackedDropIndicatorSide}`,
                )}
                style={
                  isNoteTabsStacked
                    ? isDraggedTab && noteTabDrag !== null
                      ? {
                          transform: `translate(${noteTabDrag.draggedNoteTabTravelX}px, ${noteTabDrag.stackedDraggedNoteTabTravelY ?? 0}px) scale(1.02)`,
                          pointerEvents: 'none',
                        }
                      : undefined
                    : {
                        transform: `translateX(${getNoteTabDragShiftX(vaultNoteTabIndex, noteTabDrag, openNoteTabRelativePaths.length)}px)`,
                        transition: isDraggedTab || isNoteTabDropSettling ? 'none' : papelizNoteTabSlideTransition,
                      }
                }
                onPointerDown={(pointerEvent: ReactPointerEvent<HTMLDivElement>) => {
                  // Touch keeps scrolling the strip; the close button keeps its own click.
                  if (pointerEvent.button !== 0 || pointerEvent.pointerType === 'touch') return
                  if ((pointerEvent.target as HTMLElement).closest('[data-papeliz-note-tab-close], [data-papeliz-note-tab-lock]') !== null) return
                  startListeningToNoteTabPress({
                    pressedVaultNoteRelativePath: vaultNoteRelativePath,
                    pressedNoteTabIndex: vaultNoteTabIndex,
                    pressedNoteTabElement: pointerEvent.currentTarget,
                    pointerStartX: pointerEvent.clientX,
                    pointerStartY: pointerEvent.clientY,
                    pointerId: pointerEvent.pointerId,
                  })
                }}
                onAuxClick={(auxClickEvent: MouseEvent) => {
                  if (auxClickEvent.button === 1) void closeVaultNoteTab(vaultNoteRelativePath)
                }}
                // A right-click opens the menu at the pointer. The menu key reaches here as the same
                // event, placed on the focused tab or nowhere, so the menu opens under the tab.
                onContextMenu={(contextMenuEvent: MouseEvent<HTMLDivElement>) => {
                  contextMenuEvent.preventDefault()
                  const noteTabRect = contextMenuEvent.currentTarget.getBoundingClientRect()
                  const isContextMenuPointOnNoteTab =
                    contextMenuEvent.clientX > noteTabRect.left &&
                    contextMenuEvent.clientX < noteTabRect.right &&
                    contextMenuEvent.clientY > noteTabRect.top &&
                    contextMenuEvent.clientY < noteTabRect.bottom
                  if (!isContextMenuPointOnNoteTab) {
                    openNoteTabMenuUnderNoteTab(vaultNoteRelativePath, contextMenuEvent.currentTarget)
                    return
                  }
                  setNoteTabMenuState({
                    menuVaultNoteRelativePath: vaultNoteRelativePath,
                    menuPosition: { menuAnchorLeft: contextMenuEvent.clientX, menuAnchorTop: contextMenuEvent.clientY },
                  })
                }}
              >
                <button
                  type="button"
                  data-papeliz-note-tab-lock=""
                  tabIndex={-1}
                  aria-pressed={vaultNoteEditingLock !== null}
                  aria-label={noteTabLockLabel}
                  title={noteTabLockTitle}
                  onClick={() => toggleVaultNoteTabLock(vaultNoteRelativePath)}
                  className={joinPapelizClassNames(
                    // 32 px on touch screens, so a finger finds it; the tab's title keeps its own width.
                    'ml-1.5 grid size-5 flex-none place-items-center rounded-md transition-colors pointer-coarse:ml-0.5 pointer-coarse:size-8 hover:bg-papeliz-press focus-visible:outline-offset-[-1px]',
                    vaultNoteEditingLock !== null ? 'text-papeliz-blue' : 'text-papeliz-ink-subtle hover:text-papeliz-ink',
                  )}
                >
                  {vaultNoteEditingLock === null ? <LockOpen className="size-3.5" aria-hidden="true" /> : <Lock className="size-3.5" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  data-papeliz-note-tab-title=""
                  tabIndex={vaultNoteRelativePath === rovingFocusVaultNoteRelativePath ? 0 : -1}
                  aria-current={isActiveTab ? 'page' : undefined}
                  aria-describedby={papelizNoteTabKeysDescriptionId}
                  title={isNoteNotSaved ? `${vaultNoteRelativePath}\nNot saved: ${noteNotSavedReason}` : vaultNoteRelativePath}
                  onClick={() => void openVaultNote(vaultNoteRelativePath)}
                  onKeyDown={(keyboardEvent: KeyboardEvent<HTMLButtonElement>) => {
                    const hasNoModifierKey = !keyboardEvent.altKey && !keyboardEvent.ctrlKey && !keyboardEvent.metaKey
                    if (keyboardEvent.key === 'Delete') {
                      keyboardEvent.preventDefault()
                      void closeVaultNoteTab(vaultNoteRelativePath).then(focusRovingNoteTabAfterClose)
                    } else if (keyboardEvent.altKey && keyboardEvent.shiftKey && (keyboardEvent.key === 'ArrowLeft' || keyboardEvent.key === 'ArrowRight')) {
                      keyboardEvent.preventDefault()
                      moveVaultNoteTab(vaultNoteRelativePath, vaultNoteTabIndex + (keyboardEvent.key === 'ArrowLeft' ? -1 : 1))
                    } else if (hasNoModifierKey && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(keyboardEvent.key)) {
                      keyboardEvent.preventDefault()
                      const lastNoteTabIndex = openNoteTabRelativePaths.length - 1
                      focusNoteTabTitleButton(
                        keyboardEvent.key === 'Home'
                          ? 0
                          : keyboardEvent.key === 'End'
                            ? lastNoteTabIndex
                            : keyboardEvent.key === 'ArrowLeft'
                              ? Math.max(0, vaultNoteTabIndex - 1)
                              : Math.min(lastNoteTabIndex, vaultNoteTabIndex + 1),
                      )
                    } else if (hasNoModifierKey && (keyboardEvent.key === 'l' || keyboardEvent.key === 'L')) {
                      keyboardEvent.preventDefault()
                      toggleVaultNoteTabLock(vaultNoteRelativePath)
                    } else if (hasNoModifierKey && keyboardEvent.shiftKey && keyboardEvent.key === 'F10') {
                      // Handled here: Safari has no Shift+F10 menu of its own.
                      keyboardEvent.preventDefault()
                      openNoteTabMenuUnderNoteTab(vaultNoteRelativePath, keyboardEvent.currentTarget.closest('[data-papeliz-note-tab-path]') ?? keyboardEvent.currentTarget)
                    }
                  }}
                  className="flex h-full min-w-0 flex-1 items-center gap-2 pr-1 pl-1.5 text-left focus-visible:outline-offset-[-3px]"
                >
                  <span className={joinPapelizClassNames('min-w-0 flex-1 truncate', isActiveTab && 'font-medium')}>
                    {vaultNoteTabTitle}
                    {hasSameTitleTab && (
                      <span className="font-normal text-papeliz-ink-subtle"> · {getVaultEntryParentFolderRelativePath(vaultNoteRelativePath) || 'vault'}</span>
                    )}
                  </span>
                </button>
                <span className="relative mr-2 grid size-5 flex-none place-items-center pointer-coarse:mr-0.5 pointer-coarse:size-8">
                  {hasChangesOnTheirWay && (
                    <span
                      aria-label={isNoteNotSaved ? `Not saved: ${noteNotSavedReason}` : 'Unsaved changes'}
                      className={joinPapelizClassNames(
                        'pointer-events-none absolute rounded-full transition-opacity group-hover:opacity-0 group-focus-within:opacity-0',
                        isNoteNotSaved ? 'size-2.5 bg-papeliz-error-notice-icon' : 'papeliz-saving-dot size-2 bg-papeliz-blue',
                      )}
                    />
                  )}
                  <button
                    type="button"
                    data-papeliz-note-tab-close=""
                    tabIndex={-1}
                    aria-label={`Close ${vaultNoteTabTitle}`}
                    title={`Close ${vaultNoteTabTitle}`}
                    onClick={() => void closeVaultNoteTab(vaultNoteRelativePath)}
                    className={joinPapelizClassNames(
                      'grid size-5 place-items-center rounded-md text-papeliz-ink-subtle transition-[opacity,background-color,color] pointer-coarse:size-8 hover:bg-papeliz-press hover:text-papeliz-ink focus-visible:opacity-100',
                      isActiveTab && !hasChangesOnTheirWay ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
                    )}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </span>
              </div>
            )
          })}
          {assistantProposalPreview !== null && (
            <div
              className="papeliz-tab-enter relative flex w-[188px] flex-none items-center rounded-t-lg bg-papeliz-surface text-[13px] text-papeliz-ink shadow-[inset_0_2px_0_var(--color-papeliz-blue),1px_0_0_var(--color-papeliz-line),-1px_0_0_var(--color-papeliz-line)]"
              title={`${assistantProposalPreview.previewedVaultNoteRelativePath}, as the AI Assistant proposes it (read-only)`}
            >
              <Eye className="ml-2 size-3.5 flex-none text-papeliz-blue" aria-hidden="true" />
              <span aria-current="page" className="min-w-0 flex-1 truncate pr-1 pl-1.5 font-medium">
                {getVaultNoteTitle(assistantProposalPreview.previewedVaultNoteRelativePath)}
                <span className="font-normal text-papeliz-ink-subtle"> · proposed</span>
              </span>
              <button
                type="button"
                aria-label="Close the Proposal Preview"
                title="Close the Proposal Preview"
                onClick={closeAssistantProposalPreview}
                className="mr-2 grid size-5 flex-none place-items-center rounded-md text-papeliz-ink-subtle transition-colors hover:bg-papeliz-press hover:text-papeliz-ink"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
          {/* Stacked, New note sits right after the last tab, on its row. */}
          {isNoteTabsStacked && <span className="flex items-center">{newNoteTabButton}</span>}
        </div>
      </nav>
      {!isNoteTabsStacked && newNoteTabButton}
      {noteTabMenuState !== null && (
        <PapelizPopoverMenu
          menuLabel={getVaultNoteTitle(noteTabMenuState.menuVaultNoteRelativePath)}
          menuPosition={noteTabMenuState.menuPosition}
          menuItems={getNoteTabMenuItems(noteTabMenuState.menuVaultNoteRelativePath)}
          onMenuClose={() => setNoteTabMenuState(null)}
        />
      )}
    </div>
  )
}
