import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Eye,
  EyeOff,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Ellipsis,
  FilePlus,
  FileText,
  FolderPlus,
  GripVertical,
  Lock,
  LockOpen,
  PanelLeftClose,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import type { PapelizVaultSearchResult } from '../search/papeliz-vault-search-core'
import { PapelizIconButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizConfirmDialog } from '../ui/papeliz-confirm-dialog'
import { PapelizPopoverMenu, type PapelizPopoverMenuItem, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import type { PapelizVaultEntryKind, PapelizVaultTreeEntry } from '../vault/papeliz-vault-adapter'
import {
  getVaultEntryName,
  getVaultEntryParentFolderRelativePath,
  getVaultNoteTitle,
  isVaultRelativePathHidden,
  papelizVaultRootFolderRelativePath,
} from '../vault/papeliz-vault-relative-paths'
import { getPapelizVaultSearchClient } from './papeliz-vault-knowledge-store'
import { listVaultFolderEntryNamesInOrder, sortVaultFolderEntries, type PapelizVaultEntryOrder, type PapelizVaultEntryPlacement } from './papeliz-vault-entry-order'
import { PapelizWorkspaceEyePreviewerSlot } from './papeliz-workspace-eye-previewer-slot'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

interface PapelizFileExplorerTreeNode {
  vaultEntryRelativePath: string
  vaultEntryKind: PapelizVaultEntryKind
  childTreeNodes: PapelizFileExplorerTreeNode[]
}

function buildFileExplorerTree(vaultTreeEntries: readonly PapelizVaultTreeEntry[], vaultEntryOrder: PapelizVaultEntryOrder): PapelizFileExplorerTreeNode[] {
  const rootTreeNodes: PapelizFileExplorerTreeNode[] = []
  const folderTreeNodesByRelativePath = new Map<string, PapelizFileExplorerTreeNode>()
  // Parents sort before their children, so every folder exists before its entries arrive.
  const vaultTreeEntriesByDepth = [...vaultTreeEntries].sort(
    (firstEntry, secondEntry) => firstEntry.vaultEntryRelativePath.split('/').length - secondEntry.vaultEntryRelativePath.split('/').length,
  )
  for (const vaultTreeEntry of vaultTreeEntriesByDepth) {
    const treeNode: PapelizFileExplorerTreeNode = { ...vaultTreeEntry, childTreeNodes: [] }
    if (vaultTreeEntry.vaultEntryKind === 'folder') folderTreeNodesByRelativePath.set(vaultTreeEntry.vaultEntryRelativePath, treeNode)
    const parentFolderRelativePath = getVaultEntryParentFolderRelativePath(vaultTreeEntry.vaultEntryRelativePath)
    const parentTreeNode = folderTreeNodesByRelativePath.get(parentFolderRelativePath)
    if (parentFolderRelativePath !== papelizVaultRootFolderRelativePath && parentTreeNode !== undefined) parentTreeNode.childTreeNodes.push(treeNode)
    else rootTreeNodes.push(treeNode)
  }
  // Each folder in the order the file list keeps for it (folders first, then by name, by default).
  const sortTreeNodes = (treeNodes: PapelizFileExplorerTreeNode[], vaultFolderRelativePath: string): PapelizFileExplorerTreeNode[] =>
    sortVaultFolderEntries(treeNodes, vaultFolderRelativePath, vaultEntryOrder).map((treeNode) => ({
      ...treeNode,
      childTreeNodes: sortTreeNodes(treeNode.childTreeNodes, treeNode.vaultEntryRelativePath),
    }))
  return sortTreeNodes(rootTreeNodes, papelizVaultRootFolderRelativePath)
}

function getVaultEntryDisplayName(vaultEntryRelativePath: string, vaultEntryKind: PapelizVaultEntryKind): string {
  return vaultEntryKind === 'note' ? getVaultNoteTitle(vaultEntryRelativePath) : getVaultEntryName(vaultEntryRelativePath)
}

function focusNoteEditorText(): void {
  requestAnimationFrame(() => document.querySelector<HTMLElement>('.papeliz-note-editor .cm-content')?.focus())
}

function focusFileExplorerRow(vaultEntryRelativePath: string): void {
  requestAnimationFrame(() =>
    document.querySelector<HTMLElement>(`[data-papeliz-vault-entry-path="${CSS.escape(vaultEntryRelativePath)}"]`)?.focus(),
  )
}

// The drag data of a note or folder moved inside the file list.
const papelizVaultEntryDragDataType = 'application/x-papeliz-vault-entry'
// How long a drag rests on a closed folder before it opens.
const papelizFolderAutoExpandDelayMilliseconds = 700
// How long a folder's rows take to slide open or shut.
const papelizFolderChildrenSlideMilliseconds = 280

// Where a dragged entry would land, and how the list shows it: a line before or after a row, a
// folder lit up, or (no row) the whole list for the top of the vault.
interface PapelizVaultEntryDropTarget {
  targetVaultFolderRelativePath: string
  vaultEntryPlacement: PapelizVaultEntryPlacement
  dropIndicatorVaultEntryRelativePath: string | null
  dropIndicatorKind: 'line-before' | 'line-after' | 'into-folder'
}

interface PapelizFileExplorerMenuState {
  menuPosition: PapelizPopoverMenuPosition
  menuVaultEntry: PapelizVaultTreeEntry
}

interface PapelizFileExplorerProps {
  // Shown between the notes and the count: This note (papeliz-file-list-this-note-section.tsx).
  fileListFootSection?: ReactNode
}

// The file list on the left: the vault's name with New note, New folder and Hide; then folders
// and notes, with create, rename and move-to-trash.
export function PapelizFileExplorer({ fileListFootSection }: PapelizFileExplorerProps) {
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)
  const listedVaultTreeEntries = usePapelizWorkspaceStore((workspaceState) => workspaceState.vaultTreeEntries)
  const areHiddenVaultEntriesShown = usePapelizWorkspaceStore((workspaceState) => workspaceState.areHiddenVaultEntriesShown)
  const setHiddenVaultEntriesShown = usePapelizWorkspaceStore((workspaceState) => workspaceState.setHiddenVaultEntriesShown)
  // Hidden folders and notes (the AI Assistant's `.csessions`, `.trash`, …) show only with Show Hidden.
  const vaultTreeEntries = useMemo(
    () =>
      areHiddenVaultEntriesShown
        ? listedVaultTreeEntries
        : listedVaultTreeEntries.filter((listedVaultTreeEntry) => !isVaultRelativePathHidden(listedVaultTreeEntry.vaultEntryRelativePath)),
    [areHiddenVaultEntriesShown, listedVaultTreeEntries],
  )
  const vaultTreeLoadState = usePapelizWorkspaceStore((workspaceState) => workspaceState.vaultTreeLoadState)
  const activeVaultNoteRelativePath = usePapelizWorkspaceStore((workspaceState) => workspaceState.activeVaultNoteRelativePath)
  const openVaultNote = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVaultNote)
  const createVaultNoteInFolder = usePapelizWorkspaceStore((workspaceState) => workspaceState.createVaultNoteInFolder)
  const createVaultFolderInFolder = usePapelizWorkspaceStore((workspaceState) => workspaceState.createVaultFolderInFolder)
  const moveVaultEntryToTrash = usePapelizWorkspaceStore((workspaceState) => workspaceState.moveVaultEntryToTrash)
  const startRenamingVaultEntry = usePapelizWorkspaceStore((workspaceState) => workspaceState.startRenamingVaultEntry)
  const setExplorerPanelOpen = usePapelizWorkspaceStore((workspaceState) => workspaceState.setExplorerPanelOpen)

  const [noteNameFilterText, setNoteNameFilterText] = useState('')
  const [fileExplorerMenuState, setFileExplorerMenuState] = useState<PapelizFileExplorerMenuState | null>(null)
  const [vaultEntryAwaitingTrash, setVaultEntryAwaitingTrash] = useState<PapelizVaultTreeEntry | null>(null)
  // A note or folder being dragged, and the folder it would land in ('' is the top of the vault).
  const [draggedVaultEntry, setDraggedVaultEntry] = useState<PapelizVaultTreeEntry | null>(null)
  const [vaultEntryDropTarget, setVaultEntryDropTarget] = useState<PapelizVaultEntryDropTarget | null>(null)
  const vaultEntryOrder = usePapelizWorkspaceStore((workspaceState) => workspaceState.vaultEntryOrder)
  const placeVaultEntryInFolder = usePapelizWorkspaceStore((workspaceState) => workspaceState.placeVaultEntryInFolder)
  const lockedVaultEntryRelativePaths = usePapelizWorkspaceStore((workspaceState) => workspaceState.lockedVaultEntryRelativePaths)
  const setVaultEntryEditingLocked = usePapelizWorkspaceStore((workspaceState) => workspaceState.setVaultEntryEditingLocked)
  const copiedVaultEntry = usePapelizWorkspaceStore((workspaceState) => workspaceState.copiedVaultEntry)
  const duplicateVaultEntry = usePapelizWorkspaceStore((workspaceState) => workspaceState.duplicateVaultEntry)
  const copyVaultEntryForPaste = usePapelizWorkspaceStore((workspaceState) => workspaceState.copyVaultEntryForPaste)
  const pasteCopiedVaultEntry = usePapelizWorkspaceStore((workspaceState) => workspaceState.pasteCopiedVaultEntry)
  const moveVaultEntryUpOrDown = usePapelizWorkspaceStore((workspaceState) => workspaceState.moveVaultEntryUpOrDown)
  const folderAutoExpandRef = useRef<{ autoExpandVaultFolderRelativePath: string; autoExpandTimer: ReturnType<typeof setTimeout> } | null>(null)
  const fileExplorerNotesNavRef = useRef<HTMLElement>(null)
  const activeNoteHighlightRef = useRef<HTMLSpanElement>(null)
  const highlightedVaultNoteRelativePathRef = useRef<string | null>(null)

  useEffect(() => () => clearTimeout(folderAutoExpandRef.current?.autoExpandTimer), [])

  const fileExplorerTreeNodes = useMemo(() => buildFileExplorerTree(vaultTreeEntries, vaultEntryOrder), [vaultTreeEntries, vaultEntryOrder])
  const vaultNoteCount = useMemo(() => vaultTreeEntries.filter((vaultTreeEntry) => vaultTreeEntry.vaultEntryKind === 'note').length, [vaultTreeEntries])
  const filteredVaultNoteEntries = useMemo(() => {
    const lowerCaseFilterText = noteNameFilterText.trim().toLowerCase()
    if (lowerCaseFilterText.length === 0) return null
    return vaultTreeEntries.filter(
      (vaultTreeEntry) =>
        vaultTreeEntry.vaultEntryKind === 'note' && getVaultNoteTitle(vaultTreeEntry.vaultEntryRelativePath).toLowerCase().includes(lowerCaseFilterText),
    )
  }, [noteNameFilterText, vaultTreeEntries])
  const [noteTextSearchResults, setNoteTextSearchResults] = useState<PapelizVaultSearchResult[]>([])

  useEffect(() => {
    // Full-text search runs a moment after typing stops; notes already matched by name are left out.
    const searchQueryText = noteNameFilterText.trim()
    if (searchQueryText.length < 2) return
    let isSearchStillWanted = true
    const searchTimer = setTimeout(() => {
      void getPapelizVaultSearchClient()
        .searchVaultNotes(searchQueryText, 20)
        .then((vaultSearchResults) => {
          if (isSearchStillWanted) setNoteTextSearchResults(vaultSearchResults)
        })
    }, 150)
    return () => {
      isSearchStillWanted = false
      clearTimeout(searchTimer)
    }
  }, [noteNameFilterText])

  // The open note's highlight: one pill behind the rows that glides to the note opened next. When
  // the note's own row moves (a folder above sliding open or shut, the panel resized) the pill
  // follows it at once, and it hides while the note's folder slides shut. Placed straight on the
  // element, so a move never re-renders the list; it shows without gliding the first time.
  useLayoutEffect(() => {
    const notesNavElement = fileExplorerNotesNavRef.current
    const activeNoteHighlightElement = activeNoteHighlightRef.current
    if (notesNavElement === null || activeNoteHighlightElement === null) return
    const placeActiveNoteHighlight = () => {
      const activeNoteRowButton = notesNavElement.querySelector<HTMLElement>('button[aria-current="page"][data-papeliz-vault-entry-path]')
      const activeNoteRowElement = activeNoteRowButton?.parentElement
      if (
        activeNoteRowButton === null ||
        activeNoteRowElement === null ||
        activeNoteRowElement === undefined ||
        activeNoteRowElement.closest('[data-papeliz-folder-children-drawn-shut="true"]') !== null
      ) {
        activeNoteHighlightElement.dataset.papelizActiveNoteHighlightShown = 'false'
        activeNoteHighlightElement.dataset.papelizActiveNoteHighlightGliding = 'false'
        highlightedVaultNoteRelativePathRef.current = null
        return
      }
      const activeNoteRowRelativePath = activeNoteRowButton.dataset.papelizVaultEntryPath ?? null
      if (activeNoteHighlightElement.dataset.papelizActiveNoteHighlightShown === 'true') {
        activeNoteHighlightElement.dataset.papelizActiveNoteHighlightGliding =
          highlightedVaultNoteRelativePathRef.current === activeNoteRowRelativePath ? 'false' : 'true'
      }
      highlightedVaultNoteRelativePathRef.current = activeNoteRowRelativePath
      const notesNavRect = notesNavElement.getBoundingClientRect()
      const activeNoteRowRect = activeNoteRowElement.getBoundingClientRect()
      const highlightLeft = activeNoteRowRect.left - notesNavRect.left + notesNavElement.scrollLeft
      const highlightTop = activeNoteRowRect.top - notesNavRect.top + notesNavElement.scrollTop
      activeNoteHighlightElement.style.transform = `translate(${highlightLeft}px, ${highlightTop}px)`
      activeNoteHighlightElement.style.width = `${activeNoteRowRect.width}px`
      activeNoteHighlightElement.style.height = `${activeNoteRowRect.height}px`
      if (activeNoteHighlightElement.dataset.papelizActiveNoteHighlightShown !== 'true') {
        activeNoteHighlightElement.dataset.papelizActiveNoteHighlightShown = 'true'
        // The first place is set without gliding; reading the size makes the browser take it as the
        // start before gliding is turned on.
        void activeNoteHighlightElement.offsetWidth
        activeNoteHighlightElement.dataset.papelizActiveNoteHighlightGliding = 'true'
      }
    }
    placeActiveNoteHighlight()
    // Rows move while a folder slides open or shut (the list's height changes on every frame), when
    // rows come and go, and when the panel is resized.
    const notesListResizeObserver = new ResizeObserver(placeActiveNoteHighlight)
    notesListResizeObserver.observe(notesNavElement)
    for (const notesListElement of notesNavElement.querySelectorAll('ul')) notesListResizeObserver.observe(notesListElement)
    const notesListMutationObserver = new MutationObserver(placeActiveNoteHighlight)
    notesListMutationObserver.observe(notesNavElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-papeliz-folder-children-drawn-shut'],
    })
    return () => {
      notesListResizeObserver.disconnect()
      notesListMutationObserver.disconnect()
    }
  }, [activeVaultNoteRelativePath, fileExplorerTreeNodes, filteredVaultNoteEntries])

  if (openVault === null) return null
  const noteNameMatchRelativePaths = new Set(filteredVaultNoteEntries?.map((filteredVaultNoteEntry) => filteredVaultNoteEntry.vaultEntryRelativePath))
  const noteTextOnlySearchResults =
    noteNameFilterText.trim().length < 2
      ? []
      : noteTextSearchResults.filter(
          (vaultSearchResult) =>
            !noteNameMatchRelativePaths.has(vaultSearchResult.vaultNoteRelativePath) &&
            (areHiddenVaultEntriesShown || !isVaultRelativePathHidden(vaultSearchResult.vaultNoteRelativePath)),
        )

  const folderForNewEntries =
    activeVaultNoteRelativePath === null ? papelizVaultRootFolderRelativePath : getVaultEntryParentFolderRelativePath(activeVaultNoteRelativePath)

  const openVaultEntryMenu = (menuVaultEntry: PapelizVaultTreeEntry, menuPosition: PapelizPopoverMenuPosition) =>
    setFileExplorerMenuState({ menuPosition, menuVaultEntry })

  const getVaultEntryMenuItems = (menuVaultEntry: PapelizVaultTreeEntry): PapelizPopoverMenuItem[] => {
    const vaultEntryMenuItems: PapelizPopoverMenuItem[] = []
    if (menuVaultEntry.vaultEntryKind === 'folder') {
      vaultEntryMenuItems.push(
        {
          menuItemKey: 'new-note-here',
          menuItemLabel: 'New note here',
          MenuItemIcon: FilePlus,
          onMenuItemSelect: () => void createVaultNoteInFolder(menuVaultEntry.vaultEntryRelativePath),
        },
        {
          menuItemKey: 'new-folder-here',
          menuItemLabel: 'New folder here',
          MenuItemIcon: FolderPlus,
          onMenuItemSelect: () => void createVaultFolderInFolder(menuVaultEntry.vaultEntryRelativePath),
        },
      )
    }
    // Rename, then the lock, the order, the copies, and the trash last.
    vaultEntryMenuItems.push({
      menuItemKey: 'rename',
      menuItemLabel: 'Rename',
      MenuItemIcon: Pencil,
      onMenuItemSelect: () => startRenamingVaultEntry(menuVaultEntry.vaultEntryRelativePath),
    })
    // A locked note can be read but not changed; a locked folder locks every note in it.
    const isMenuVaultEntryLocked = lockedVaultEntryRelativePaths.includes(menuVaultEntry.vaultEntryRelativePath)
    vaultEntryMenuItems.push({
      menuItemKey: 'editing-lock',
      menuItemLabel: isMenuVaultEntryLocked ? 'Unlock editing' : menuVaultEntry.vaultEntryKind === 'folder' ? 'Lock editing of its notes' : 'Lock editing',
      MenuItemIcon: isMenuVaultEntryLocked ? LockOpen : Lock,
      onMenuItemSelect: () => setVaultEntryEditingLocked(menuVaultEntry.vaultEntryRelativePath, !isMenuVaultEntryLocked),
    })
    const siblingVaultEntryNames = listVaultFolderEntryNamesInOrder(
      vaultTreeEntries,
      getVaultEntryParentFolderRelativePath(menuVaultEntry.vaultEntryRelativePath),
      vaultEntryOrder,
    )
    const menuVaultEntryIndex = siblingVaultEntryNames.indexOf(getVaultEntryName(menuVaultEntry.vaultEntryRelativePath))
    if (menuVaultEntryIndex > 0) {
      vaultEntryMenuItems.push({
        menuItemKey: 'move-up',
        menuItemLabel: 'Move up',
        MenuItemIcon: ArrowUp,
        menuItemGroupHeading: 'Order',
        onMenuItemSelect: () => moveVaultEntryUpOrDown(menuVaultEntry.vaultEntryRelativePath, 'up'),
      })
    }
    if (menuVaultEntryIndex !== -1 && menuVaultEntryIndex < siblingVaultEntryNames.length - 1) {
      vaultEntryMenuItems.push({
        menuItemKey: 'move-down',
        menuItemLabel: 'Move down',
        MenuItemIcon: ArrowDown,
        menuItemGroupHeading: menuVaultEntryIndex > 0 ? undefined : 'Order',
        onMenuItemSelect: () => moveVaultEntryUpOrDown(menuVaultEntry.vaultEntryRelativePath, 'down'),
      })
    }
    // A paste goes into the folder, or beside the note.
    const pasteTargetVaultFolderRelativePath =
      menuVaultEntry.vaultEntryKind === 'folder' ? menuVaultEntry.vaultEntryRelativePath : getVaultEntryParentFolderRelativePath(menuVaultEntry.vaultEntryRelativePath)
    vaultEntryMenuItems.push(
      {
        menuItemKey: 'duplicate',
        menuItemLabel: 'Duplicate',
        MenuItemIcon: CopyPlus,
        menuItemGroupHeading: 'Copies',
        onMenuItemSelect: () => void duplicateVaultEntry(menuVaultEntry.vaultEntryRelativePath),
      },
      { menuItemKey: 'copy', menuItemLabel: 'Copy', MenuItemIcon: Copy, onMenuItemSelect: () => copyVaultEntryForPaste(menuVaultEntry) },
    )
    if (copiedVaultEntry !== null) {
      vaultEntryMenuItems.push({
        menuItemKey: 'paste',
        menuItemLabel: `Paste “${getVaultEntryDisplayName(copiedVaultEntry.vaultEntryRelativePath, copiedVaultEntry.vaultEntryKind)}” here`,
        MenuItemIcon: ClipboardPaste,
        onMenuItemSelect: () => void pasteCopiedVaultEntry(pasteTargetVaultFolderRelativePath),
      })
    }
    vaultEntryMenuItems.push({
      menuItemKey: 'move-to-trash',
      menuItemLabel: 'Move to trash',
      MenuItemIcon: Trash2,
      isDangerousMenuItem: true,
      menuItemGroupHeading: ' ',
      onMenuItemSelect: () => setVaultEntryAwaitingTrash(menuVaultEntry),
    })
    return vaultEntryMenuItems
  }

  // A folder never goes into itself, and an entry is never placed against itself.
  const canDropAtTarget = (proposedDropTarget: PapelizVaultEntryDropTarget): boolean => {
    if (draggedVaultEntry === null) return false
    const { vaultEntryRelativePath: draggedVaultEntryRelativePath, vaultEntryKind: draggedVaultEntryKind } = draggedVaultEntry
    const { targetVaultFolderRelativePath, dropIndicatorVaultEntryRelativePath } = proposedDropTarget
    if (dropIndicatorVaultEntryRelativePath === draggedVaultEntryRelativePath) return false
    return !(
      draggedVaultEntryKind === 'folder' &&
      (targetVaultFolderRelativePath === draggedVaultEntryRelativePath || targetVaultFolderRelativePath.startsWith(`${draggedVaultEntryRelativePath}/`))
    )
  }

  const showVaultEntryDropTarget = (proposedDropTarget: PapelizVaultEntryDropTarget | null) => {
    setVaultEntryDropTarget(proposedDropTarget)
    // A drag resting on a closed folder opens it.
    const autoExpandVaultFolderRelativePath =
      proposedDropTarget?.dropIndicatorKind === 'into-folder' ? proposedDropTarget.dropIndicatorVaultEntryRelativePath : null
    if (folderAutoExpandRef.current?.autoExpandVaultFolderRelativePath === autoExpandVaultFolderRelativePath) return
    clearTimeout(folderAutoExpandRef.current?.autoExpandTimer)
    folderAutoExpandRef.current = null
    if (autoExpandVaultFolderRelativePath === null) return
    folderAutoExpandRef.current = {
      autoExpandVaultFolderRelativePath,
      autoExpandTimer: setTimeout(() => {
        const workspaceState = usePapelizWorkspaceStore.getState()
        if (workspaceState.expandedVaultFolderRelativePaths[autoExpandVaultFolderRelativePath] !== true) {
          workspaceState.toggleVaultFolderExpanded(autoExpandVaultFolderRelativePath)
        }
      }, papelizFolderAutoExpandDelayMilliseconds),
    }
  }

  const finishVaultEntryDrag = () => {
    setDraggedVaultEntry(null)
    showVaultEntryDropTarget(null)
  }

  const dropDraggedVaultEntry = (proposedDropTarget: PapelizVaultEntryDropTarget) => {
    const droppedVaultEntry = draggedVaultEntry
    const isDropAllowed = canDropAtTarget(proposedDropTarget)
    finishVaultEntryDrag()
    if (droppedVaultEntry === null || !isDropAllowed) return
    void placeVaultEntryInFolder(droppedVaultEntry.vaultEntryRelativePath, proposedDropTarget.targetVaultFolderRelativePath, proposedDropTarget.vaultEntryPlacement)
  }

  const vaultRootDropTarget: PapelizVaultEntryDropTarget = {
    targetVaultFolderRelativePath: papelizVaultRootFolderRelativePath,
    vaultEntryPlacement: { vaultEntryPlacementKind: 'last' },
    dropIndicatorVaultEntryRelativePath: null,
    dropIndicatorKind: 'into-folder',
  }

  const fileExplorerRowActions: PapelizFileExplorerRowActions = {
    openVaultEntryMenu,
    requestVaultEntryTrash: setVaultEntryAwaitingTrash,
    draggedVaultEntryRelativePath: draggedVaultEntry?.vaultEntryRelativePath ?? null,
    vaultEntryDropTarget,
    startVaultEntryDrag: setDraggedVaultEntry,
    canDropAtTarget,
    showVaultEntryDropTarget,
    dropDraggedVaultEntry,
    finishVaultEntryDrag,
  }

  return (
    <aside aria-label="Files" className="flex h-full min-h-0 flex-col bg-papeliz-surface-soft">
      {/* The same 40 px band as the open-notes tabs and the Assistant's header, its content on the tabs' center line. */}
      <div className="flex h-10 flex-none items-center gap-1 bg-papeliz-tab-strip pt-1.5 pr-1.5 pl-4 shadow-[inset_0_-1px_0_var(--color-papeliz-line)]">
        <h2 className="min-w-0 truncate text-[14px] font-semibold" title={openVault.papelizVaultDisplayName}>
          {openVault.papelizVaultDisplayName}
        </h2>
        <span className="ml-auto" />
        <PapelizWorkspaceEyePreviewerSlot />
        <PapelizIconButton iconButtonLabel="New note" iconButtonSize="small" onClick={() => void createVaultNoteInFolder(folderForNewEntries)}>
          <FilePlus className="size-[15px]" aria-hidden="true" />
        </PapelizIconButton>
        <PapelizIconButton iconButtonLabel="New folder" iconButtonSize="small" onClick={() => void createVaultFolderInFolder(folderForNewEntries)}>
          <FolderPlus className="size-[15px]" aria-hidden="true" />
        </PapelizIconButton>
        {/* Hide panel, docked or as a drawer. The vault closes from Home (Start page) in the top bar. */}
        <PapelizIconButton iconButtonLabel="Hide the file list" iconButtonSize="small" onClick={() => setExplorerPanelOpen(false)}>
          <PanelLeftClose className="size-[15px]" aria-hidden="true" />
        </PapelizIconButton>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-2.5 pt-2.5 pb-2.5">

      <label className="mb-3 flex h-[38px] items-center gap-2 rounded-full border border-papeliz-line bg-papeliz-surface px-3.5 text-papeliz-ink-subtle focus-within:border-papeliz-blue-line focus-within:shadow-[0_0_0_3px_var(--color-papeliz-blue-soft)]">
        <Search className="size-[15px] flex-none" aria-hidden="true" />
        <span className="sr-only">Find a note by name or text</span>
        <input
          type="search"
          value={noteNameFilterText}
          onChange={(changeEvent) => setNoteNameFilterText(changeEvent.target.value)}
          placeholder="Search notes"
          className="min-w-0 flex-1 bg-transparent text-sm text-papeliz-ink placeholder:text-papeliz-ink-subtle focus:outline-none"
        />
      </label>

      <nav
        ref={fileExplorerNotesNavRef}
        aria-label="Notes"
        className={joinPapelizClassNames(
          'relative -mx-1 min-h-0 flex-1 overflow-y-auto rounded-2xl px-1 pb-2 transition-[background-color,box-shadow] duration-150',
          vaultEntryDropTarget !== null &&
            vaultEntryDropTarget.dropIndicatorVaultEntryRelativePath === null &&
            'bg-papeliz-blue-soft/60 shadow-[inset_0_0_0_2px_var(--color-papeliz-blue-line)]',
        )}
        // Space outside the rows is the top of the vault.
        onDragOver={(dragEvent) => {
          if (!canDropAtTarget(vaultRootDropTarget)) return
          dragEvent.preventDefault()
          dragEvent.dataTransfer.dropEffect = 'move'
          showVaultEntryDropTarget(vaultRootDropTarget)
        }}
        onDragLeave={(dragEvent) => {
          if (!dragEvent.currentTarget.contains(dragEvent.relatedTarget as Node | null)) showVaultEntryDropTarget(null)
        }}
        onDrop={(dragEvent) => {
          if (draggedVaultEntry === null) return
          dragEvent.preventDefault()
          dropDraggedVaultEntry(vaultRootDropTarget)
        }}
      >
        <span aria-hidden="true" ref={activeNoteHighlightRef} className="papeliz-file-explorer-active-note-highlight" />
        {vaultTreeLoadState === 'loading' && <p className="px-2.5 py-2 text-[13px] text-papeliz-ink-subtle">Reading the folder…</p>}
        {vaultTreeLoadState === 'load-failed' && <p className="px-2.5 py-2 text-[13px] text-papeliz-diff-removed-ink">The notes could not be listed.</p>}
        {vaultTreeLoadState === 'loaded' && vaultTreeEntries.length === 0 && (
          <div className="px-2.5 py-2 text-[13px] text-papeliz-ink-subtle">
            <p>No Markdown notes here yet.</p>
            <button type="button" className="mt-1 font-medium text-papeliz-blue hover:underline" onClick={() => void createVaultNoteInFolder('')}>
              Create the first note
            </button>
          </div>
        )}
        {filteredVaultNoteEntries !== null ? (
          filteredVaultNoteEntries.length === 0 && noteTextOnlySearchResults.length === 0 ? (
            <p className="px-2.5 py-2 text-[13px] text-papeliz-ink-subtle">No notes match “{noteNameFilterText.trim()}”.</p>
          ) : (
            <>
            <ul className="flex flex-col gap-px">
              {filteredVaultNoteEntries.map((filteredVaultNoteEntry) => (
                <PapelizFileExplorerRow
                  key={filteredVaultNoteEntry.vaultEntryRelativePath}
                  fileExplorerTreeNode={{ ...filteredVaultNoteEntry, childTreeNodes: [] }}
                  fileExplorerRowDepth={0}
                  treeGuideAncestorContinuations={noTreeGuideAncestorContinuations}
                  isLastTreeSibling
                  fileExplorerRowSecondaryText={getVaultEntryParentFolderRelativePath(filteredVaultNoteEntry.vaultEntryRelativePath)}
                  fileExplorerRowActions={fileExplorerRowActions}
                />
              ))}
            </ul>
            {noteTextOnlySearchResults.length > 0 && (
              <section aria-label="Notes whose text matches" className="mt-3">
                <h3 className="px-2.5 pb-1 text-[12px] font-semibold text-papeliz-ink-subtle">In note text</h3>
                <ul className="flex flex-col gap-px">
                  {noteTextOnlySearchResults.map((vaultSearchResult) => (
                    <li key={vaultSearchResult.vaultNoteRelativePath} className="papeliz-pop-enter">
                      <button
                        type="button"
                        onClick={() => void openVaultNote(vaultSearchResult.vaultNoteRelativePath)}
                        className="block w-full rounded-2xl px-2.5 py-1.5 text-left transition-colors hover:bg-papeliz-hover"
                      >
                        <span className="flex items-center gap-2 text-sm text-papeliz-ink">
                          <FileText className="size-[15px] flex-none text-papeliz-ink-subtle" aria-hidden="true" />
                          <span className="truncate">{vaultSearchResult.vaultNoteTitle}</span>
                        </span>
                        <span className="line-clamp-2 pl-[23px] text-xs text-papeliz-ink-subtle">{vaultSearchResult.searchResultSnippet}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            </>
          )
        ) : (
          <ul className="flex flex-col">
            {fileExplorerTreeNodes.map((fileExplorerTreeNode, treeNodeIndex) => (
              <PapelizFileExplorerRow
                key={fileExplorerTreeNode.vaultEntryRelativePath}
                fileExplorerTreeNode={fileExplorerTreeNode}
                fileExplorerRowDepth={0}
                treeGuideAncestorContinuations={noTreeGuideAncestorContinuations}
                isLastTreeSibling={treeNodeIndex === fileExplorerTreeNodes.length - 1}
                fileExplorerRowActions={fileExplorerRowActions}
              />
            ))}
          </ul>
        )}
      </nav>

      {fileListFootSection}

      {/* The note count, and Show Hidden: hidden folders and notes, such as the Assistant's saved
          chats in `.csessions`, the trash and other apps' folders. Notes in a hidden folder open
          read-only, except Papeliz's own saved chats. */}
      <div className="mt-auto flex items-center justify-between gap-2 px-2.5 pt-2.5 pb-0.5 text-[12.5px] text-papeliz-ink-subtle">
        <span>
          {vaultNoteCount} {vaultNoteCount === 1 ? 'note' : 'notes'}
        </span>
        <button
          type="button"
          aria-pressed={areHiddenVaultEntriesShown}
          title={areHiddenVaultEntriesShown ? 'Hide hidden folders and notes again' : 'Show hidden folders and notes, such as saved chats and the trash'}
          onClick={() => setHiddenVaultEntriesShown(!areHiddenVaultEntriesShown)}
          className="flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink aria-pressed:bg-papeliz-blue-soft aria-pressed:text-papeliz-blue"
        >
          {areHiddenVaultEntriesShown ? <Eye className="size-3.5" aria-hidden="true" /> : <EyeOff className="size-3.5" aria-hidden="true" />}
          Show Hidden
        </button>
      </div>

      </div>

      {fileExplorerMenuState !== null && (
        <PapelizPopoverMenu
          menuLabel={getVaultEntryDisplayName(fileExplorerMenuState.menuVaultEntry.vaultEntryRelativePath, fileExplorerMenuState.menuVaultEntry.vaultEntryKind)}
          menuPosition={fileExplorerMenuState.menuPosition}
          menuItems={getVaultEntryMenuItems(fileExplorerMenuState.menuVaultEntry)}
          onMenuClose={() => setFileExplorerMenuState(null)}
        />
      )}

      {vaultEntryAwaitingTrash !== null && (
        <PapelizConfirmDialog
          confirmDialogTitle="Move to trash?"
          confirmDialogBody={
            <p>
              “{getVaultEntryDisplayName(vaultEntryAwaitingTrash.vaultEntryRelativePath, vaultEntryAwaitingTrash.vaultEntryKind)}”
              {vaultEntryAwaitingTrash.vaultEntryKind === 'folder' ? ' and everything in it move' : ' moves'} into this vault’s{' '}
              <code className="rounded-md bg-papeliz-surface-gray px-1.5 font-mono text-[13px]">.trash</code> folder. Nothing is erased.
            </p>
          }
          confirmButtonLabel="Move to trash"
          onCancel={() => setVaultEntryAwaitingTrash(null)}
          onConfirm={() => {
            const vaultEntryToTrash = vaultEntryAwaitingTrash
            setVaultEntryAwaitingTrash(null)
            void moveVaultEntryToTrash(vaultEntryToTrash.vaultEntryRelativePath)
          }}
        />
      )}
    </aside>
  )
}

interface PapelizFileExplorerRowActions {
  openVaultEntryMenu: (menuVaultEntry: PapelizVaultTreeEntry, menuPosition: PapelizPopoverMenuPosition) => void
  requestVaultEntryTrash: (vaultEntry: PapelizVaultTreeEntry) => void
  draggedVaultEntryRelativePath: string | null
  vaultEntryDropTarget: PapelizVaultEntryDropTarget | null
  startVaultEntryDrag: (draggedVaultEntry: PapelizVaultTreeEntry) => void
  canDropAtTarget: (proposedDropTarget: PapelizVaultEntryDropTarget) => boolean
  showVaultEntryDropTarget: (proposedDropTarget: PapelizVaultEntryDropTarget | null) => void
  dropDraggedVaultEntry: (proposedDropTarget: PapelizVaultEntryDropTarget) => void
  finishVaultEntryDrag: () => void
}

interface PapelizFileExplorerRowProps {
  fileExplorerTreeNode: PapelizFileExplorerTreeNode
  fileExplorerRowDepth: number
  // One entry per ancestor level above the parent: whether that level's guide line runs on past
  // this row (its folder still has siblings below).
  treeGuideAncestorContinuations: readonly boolean[]
  isLastTreeSibling: boolean
  fileExplorerRowSecondaryText?: string
  fileExplorerRowActions: PapelizFileExplorerRowActions
}

const noTreeGuideAncestorContinuations: readonly boolean[] = []
const fileExplorerTreeIndentBase = 10
const fileExplorerTreeIndentStep = 16
// Half the 32 px row: where a row's elbow meets it.
const fileExplorerRowMidline = 16

function getFileExplorerRowIndent(fileExplorerRowDepth: number): number {
  return fileExplorerTreeIndentBase + fileExplorerRowDepth * fileExplorerTreeIndentStep
}

// The guide line under a folder's chevron, which its children's elbows hang from.
function getFileExplorerTreeGuideLeft(treeGuideLevel: number): number {
  return getFileExplorerRowIndent(treeGuideLevel) + 7
}

interface PapelizFileExplorerTreeGuidesProps {
  fileExplorerRowDepth: number
  treeGuideAncestorContinuations: readonly boolean[]
  isLastTreeSibling: boolean
  isActiveNote: boolean
}

// The tree lines of one row: the guides of ancestors that carry on below, and this row's own
// elbow from its folder's guide. The last child's guide stops at its elbow. The open note's elbow
// is blue.
function PapelizFileExplorerTreeGuides({ fileExplorerRowDepth, treeGuideAncestorContinuations, isLastTreeSibling, isActiveNote }: PapelizFileExplorerTreeGuidesProps) {
  if (fileExplorerRowDepth === 0) return null
  const parentTreeGuideLeft = getFileExplorerTreeGuideLeft(fileExplorerRowDepth - 1)
  const ownGuideColorClassName = isActiveNote ? 'bg-papeliz-blue' : 'bg-papeliz-line-strong'
  return (
    <>
      {treeGuideAncestorContinuations.map((isAncestorGuideContinuing, treeGuideLevel) =>
        isAncestorGuideContinuing ? (
          <span
            key={treeGuideLevel}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-px bg-papeliz-line-strong"
            style={{ left: getFileExplorerTreeGuideLeft(treeGuideLevel) }}
          />
        ) : null,
      )}
      {!isLastTreeSibling && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-papeliz-line-strong" style={{ left: parentTreeGuideLeft }} />
      )}
      <span
        aria-hidden="true"
        className={joinPapelizClassNames('pointer-events-none absolute top-0 w-px transition-colors duration-300', ownGuideColorClassName)}
        style={{ left: parentTreeGuideLeft, height: fileExplorerRowMidline }}
      />
      <span
        aria-hidden="true"
        className={joinPapelizClassNames('pointer-events-none absolute h-px transition-colors duration-300', ownGuideColorClassName)}
        style={{
          left: parentTreeGuideLeft,
          top: fileExplorerRowMidline,
          width: getFileExplorerRowIndent(fileExplorerRowDepth) - 3 - parentTreeGuideLeft,
        }}
      />
    </>
  )
}

function PapelizFileExplorerRow({
  fileExplorerTreeNode,
  fileExplorerRowDepth,
  treeGuideAncestorContinuations,
  isLastTreeSibling,
  fileExplorerRowSecondaryText,
  fileExplorerRowActions,
}: PapelizFileExplorerRowProps) {
  const { vaultEntryRelativePath, vaultEntryKind } = fileExplorerTreeNode
  const isExpandedFolder = usePapelizWorkspaceStore((workspaceState) => workspaceState.expandedVaultFolderRelativePaths[vaultEntryRelativePath] === true)
  const isActiveNote = usePapelizWorkspaceStore((workspaceState) => workspaceState.activeVaultNoteRelativePath === vaultEntryRelativePath)
  const isBeingRenamed = usePapelizWorkspaceStore((workspaceState) => workspaceState.vaultEntryBeingRenamedRelativePath === vaultEntryRelativePath)
  const openVaultNote = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVaultNote)
  const toggleVaultFolderExpanded = usePapelizWorkspaceStore((workspaceState) => workspaceState.toggleVaultFolderExpanded)
  const startRenamingVaultEntry = usePapelizWorkspaceStore((workspaceState) => workspaceState.startRenamingVaultEntry)
  const moveVaultEntryUpOrDown = usePapelizWorkspaceStore((workspaceState) => workspaceState.moveVaultEntryUpOrDown)

  const vaultEntryDisplayName = getVaultEntryDisplayName(vaultEntryRelativePath, vaultEntryKind)
  const rowIndentStyle = { paddingLeft: getFileExplorerRowIndent(fileExplorerRowDepth) }
  const childTreeGuideAncestorContinuations = useMemo(
    () => (fileExplorerRowDepth === 0 ? noTreeGuideAncestorContinuations : [...treeGuideAncestorContinuations, !isLastTreeSibling]),
    [fileExplorerRowDepth, treeGuideAncestorContinuations, isLastTreeSibling],
  )
  const vaultTreeEntry: PapelizVaultTreeEntry = { vaultEntryRelativePath, vaultEntryKind }
  const isDraggedRow = fileExplorerRowActions.draggedVaultEntryRelativePath === vaultEntryRelativePath
  const isVaultEntryLocked = usePapelizWorkspaceStore((workspaceState) => workspaceState.lockedVaultEntryRelativePaths.includes(vaultEntryRelativePath))
  const rowDropIndicatorKind =
    fileExplorerRowActions.vaultEntryDropTarget?.dropIndicatorVaultEntryRelativePath === vaultEntryRelativePath
      ? fileExplorerRowActions.vaultEntryDropTarget.dropIndicatorKind
      : null

  // The top of a row puts the dragged entry before it and the bottom after it; the middle of a
  // folder puts it inside. Below an open folder's row is the top of that folder.
  const readRowDropTarget = (dragEvent: DragEvent<HTMLDivElement>): PapelizVaultEntryDropTarget => {
    const rowRect = dragEvent.currentTarget.getBoundingClientRect()
    const pointerShareDown = (dragEvent.clientY - rowRect.top) / Math.max(1, rowRect.height)
    const vaultParentFolderRelativePath = getVaultEntryParentFolderRelativePath(vaultEntryRelativePath)
    const vaultEntryName = getVaultEntryName(vaultEntryRelativePath)
    if (vaultEntryKind === 'folder' && pointerShareDown > 0.25 && pointerShareDown < 0.75) {
      return {
        targetVaultFolderRelativePath: vaultEntryRelativePath,
        vaultEntryPlacement: { vaultEntryPlacementKind: 'last' },
        dropIndicatorVaultEntryRelativePath: vaultEntryRelativePath,
        dropIndicatorKind: 'into-folder',
      }
    }
    if (pointerShareDown < 0.5) {
      return {
        targetVaultFolderRelativePath: vaultParentFolderRelativePath,
        vaultEntryPlacement: { vaultEntryPlacementKind: 'before', anchorVaultEntryName: vaultEntryName },
        dropIndicatorVaultEntryRelativePath: vaultEntryRelativePath,
        dropIndicatorKind: 'line-before',
      }
    }
    if (vaultEntryKind === 'folder' && isExpandedFolder) {
      return {
        targetVaultFolderRelativePath: vaultEntryRelativePath,
        vaultEntryPlacement: { vaultEntryPlacementKind: 'first' },
        dropIndicatorVaultEntryRelativePath: vaultEntryRelativePath,
        dropIndicatorKind: 'line-after',
      }
    }
    return {
      targetVaultFolderRelativePath: vaultParentFolderRelativePath,
      vaultEntryPlacement: { vaultEntryPlacementKind: 'after', anchorVaultEntryName: vaultEntryName },
      dropIndicatorVaultEntryRelativePath: vaultEntryRelativePath,
      dropIndicatorKind: 'line-after',
    }
  }

  const openRowMenuAtPointer = (contextMenuEvent: MouseEvent) => {
    contextMenuEvent.preventDefault()
    fileExplorerRowActions.openVaultEntryMenu(vaultTreeEntry, { menuAnchorLeft: contextMenuEvent.clientX, menuAnchorTop: contextMenuEvent.clientY })
  }

  const handleRowKeyDown = (keyboardEvent: KeyboardEvent<HTMLButtonElement>) => {
    if (keyboardEvent.key === 'F2') {
      keyboardEvent.preventDefault()
      startRenamingVaultEntry(vaultEntryRelativePath)
    } else if (keyboardEvent.key === 'Delete') {
      keyboardEvent.preventDefault()
      fileExplorerRowActions.requestVaultEntryTrash(vaultTreeEntry)
    } else if (vaultEntryKind === 'folder' && keyboardEvent.key === 'ArrowRight' && !isExpandedFolder) {
      keyboardEvent.preventDefault()
      toggleVaultFolderExpanded(vaultEntryRelativePath)
    } else if ((keyboardEvent.ctrlKey || keyboardEvent.metaKey) && !keyboardEvent.shiftKey && keyboardEvent.key.toLowerCase() === 'c') {
      keyboardEvent.preventDefault()
      usePapelizWorkspaceStore.getState().copyVaultEntryForPaste(vaultTreeEntry)
    } else if ((keyboardEvent.ctrlKey || keyboardEvent.metaKey) && !keyboardEvent.shiftKey && keyboardEvent.key.toLowerCase() === 'v') {
      keyboardEvent.preventDefault()
      void usePapelizWorkspaceStore
        .getState()
        .pasteCopiedVaultEntry(vaultEntryKind === 'folder' ? vaultEntryRelativePath : getVaultEntryParentFolderRelativePath(vaultEntryRelativePath))
    } else if (keyboardEvent.altKey && (keyboardEvent.key === 'ArrowUp' || keyboardEvent.key === 'ArrowDown')) {
      keyboardEvent.preventDefault()
      moveVaultEntryUpOrDown(vaultEntryRelativePath, keyboardEvent.key === 'ArrowUp' ? 'up' : 'down')
      focusFileExplorerRow(vaultEntryRelativePath)
    } else if (vaultEntryKind === 'folder' && keyboardEvent.key === 'ArrowLeft' && isExpandedFolder) {
      keyboardEvent.preventDefault()
      toggleVaultFolderExpanded(vaultEntryRelativePath)
    }
  }

  const VaultEntryIcon = vaultEntryKind === 'folder' ? ChevronRight : FileText

  return (
    <li>
      {isBeingRenamed ? (
        <PapelizFileExplorerRenameField
          vaultEntryRelativePath={vaultEntryRelativePath}
          vaultEntryKind={vaultEntryKind}
          vaultEntryDisplayName={vaultEntryDisplayName}
          rowIndentStyle={rowIndentStyle}
        />
      ) : (
        <div
          className={joinPapelizClassNames(
            'group relative flex h-8 items-center rounded-full text-sm text-papeliz-ink-muted transition-[background-color,color,opacity,box-shadow] duration-150 hover:bg-papeliz-hover hover:text-papeliz-ink',
            vaultEntryKind === 'folder' && 'font-medium text-papeliz-ink',
            // The open note's background is the list's gliding highlight, drawn behind the rows.
            isActiveNote && 'font-medium text-papeliz-chosen-row-ink hover:text-papeliz-chosen-row-ink',
            isDraggedRow && 'opacity-45',
            rowDropIndicatorKind === 'into-folder' &&
              'bg-papeliz-blue-soft text-papeliz-blue shadow-[inset_0_0_0_1.5px_var(--color-papeliz-blue)] hover:bg-papeliz-blue-soft',
          )}
          onContextMenu={openRowMenuAtPointer}
          // Dragged to reorder it or move it into another folder; a note dropped into a note's text
          // becomes a link.
          draggable
          onDragStart={(dragEvent) => {
            dragEvent.dataTransfer.effectAllowed = 'copyMove'
            dragEvent.dataTransfer.setData(papelizVaultEntryDragDataType, vaultEntryRelativePath)
            if (vaultEntryKind === 'note') dragEvent.dataTransfer.setData('text/plain', `[[${vaultEntryDisplayName}]]`)
            fileExplorerRowActions.startVaultEntryDrag(vaultTreeEntry)
          }}
          onDragEnd={fileExplorerRowActions.finishVaultEntryDrag}
          onDragOver={(dragEvent) => {
            if (fileExplorerRowActions.draggedVaultEntryRelativePath === null) return
            dragEvent.stopPropagation()
            const rowDropTarget = readRowDropTarget(dragEvent)
            if (!fileExplorerRowActions.canDropAtTarget(rowDropTarget)) {
              fileExplorerRowActions.showVaultEntryDropTarget(null)
              return
            }
            dragEvent.preventDefault()
            dragEvent.dataTransfer.dropEffect = 'move'
            const shownDropTarget = fileExplorerRowActions.vaultEntryDropTarget
            if (
              shownDropTarget?.dropIndicatorVaultEntryRelativePath !== rowDropTarget.dropIndicatorVaultEntryRelativePath ||
              shownDropTarget.dropIndicatorKind !== rowDropTarget.dropIndicatorKind
            ) {
              fileExplorerRowActions.showVaultEntryDropTarget(rowDropTarget)
            }
          }}
          onDrop={(dragEvent) => {
            if (fileExplorerRowActions.draggedVaultEntryRelativePath === null) return
            dragEvent.preventDefault()
            dragEvent.stopPropagation()
            fileExplorerRowActions.dropDraggedVaultEntry(readRowDropTarget(dragEvent))
          }}
        >
          {(rowDropIndicatorKind === 'line-before' || rowDropIndicatorKind === 'line-after') && (
            <span
              aria-hidden="true"
              className={joinPapelizClassNames(
                'pointer-events-none absolute right-2 z-10 h-0.5 rounded-full bg-papeliz-blue before:absolute before:top-1/2 before:-left-1 before:size-2 before:-translate-y-1/2 before:rounded-full before:border-2 before:border-papeliz-blue before:bg-papeliz-surface',
                rowDropIndicatorKind === 'line-before' ? '-top-px' : '-bottom-px',
              )}
              style={{
                left:
                  rowDropIndicatorKind === 'line-after' && vaultEntryKind === 'folder' && isExpandedFolder
                    ? getFileExplorerRowIndent(fileExplorerRowDepth + 1)
                    : getFileExplorerRowIndent(fileExplorerRowDepth),
              }}
            />
          )}
          <PapelizFileExplorerTreeGuides
            fileExplorerRowDepth={fileExplorerRowDepth}
            treeGuideAncestorContinuations={treeGuideAncestorContinuations}
            isLastTreeSibling={isLastTreeSibling}
            isActiveNote={isActiveNote}
          />
          <button
            type="button"
            data-papeliz-vault-entry-path={vaultEntryRelativePath}
            aria-expanded={vaultEntryKind === 'folder' ? isExpandedFolder : undefined}
            aria-current={isActiveNote ? 'page' : undefined}
            onClick={() => (vaultEntryKind === 'folder' ? toggleVaultFolderExpanded(vaultEntryRelativePath) : void openVaultNote(vaultEntryRelativePath))}
            onKeyDown={handleRowKeyDown}
            className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-full pr-1 text-left focus-visible:outline-offset-[-2px]"
            style={rowIndentStyle}
          >
            <VaultEntryIcon
              className={joinPapelizClassNames(
                'size-[15px] flex-none transition-transform duration-200 ease-[var(--ease-papeliz-out)]',
                isActiveNote ? 'text-papeliz-chosen-row-ink' : 'text-papeliz-ink-subtle',
                vaultEntryKind === 'folder' && isExpandedFolder && 'rotate-90',
              )}
              aria-hidden="true"
            />
            <span className="truncate">{vaultEntryDisplayName}</span>
            {isVaultEntryLocked && (
              <Lock
                className="size-3 flex-none text-papeliz-ink-subtle"
                aria-label={vaultEntryKind === 'folder' ? 'Its notes are locked' : 'Locked'}
              />
            )}
            {fileExplorerRowSecondaryText !== undefined && fileExplorerRowSecondaryText.length > 0 && (
              <span className="truncate text-xs font-normal text-papeliz-ink-subtle">{fileExplorerRowSecondaryText}</span>
            )}
          </button>
          <PapelizIconButton
            iconButtonLabel={`More for ${vaultEntryDisplayName}`}
            iconButtonSize="extra-small"
            aria-haspopup="menu"
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
            onClick={(clickEvent) => {
              const moreButtonRect = clickEvent.currentTarget.getBoundingClientRect()
              fileExplorerRowActions.openVaultEntryMenu(vaultTreeEntry, { menuAnchorLeft: moreButtonRect.left, menuAnchorTop: moreButtonRect.bottom + 4 })
            }}
          >
            <Ellipsis className="size-[14px]" aria-hidden="true" />
          </PapelizIconButton>
          {/* The drag grip, at the row's right end on hover; the whole row drags, the grip shows where to hold. */}
          <span
            aria-hidden="true"
            title="Drag to move"
            className="mr-1 grid h-[22px] w-4 flex-none cursor-grab place-items-center rounded-md text-papeliz-ink-subtle opacity-0 transition-opacity duration-150 group-hover:opacity-80 hover:bg-papeliz-hover active:cursor-grabbing max-md:hidden"
          >
            <GripVertical className="size-3.5" />
          </span>
        </div>
      )}
      {vaultEntryKind === 'folder' && fileExplorerTreeNode.childTreeNodes.length > 0 && (
        <PapelizFileExplorerFolderChildrenSlide isFolderExpanded={isExpandedFolder}>
          <ul className="flex flex-col">
            {fileExplorerTreeNode.childTreeNodes.map((childTreeNode, childTreeNodeIndex) => (
              <PapelizFileExplorerRow
                key={childTreeNode.vaultEntryRelativePath}
                fileExplorerTreeNode={childTreeNode}
                fileExplorerRowDepth={fileExplorerRowDepth + 1}
                treeGuideAncestorContinuations={childTreeGuideAncestorContinuations}
                isLastTreeSibling={childTreeNodeIndex === fileExplorerTreeNode.childTreeNodes.length - 1}
                fileExplorerRowActions={fileExplorerRowActions}
              />
            ))}
          </ul>
        </PapelizFileExplorerFolderChildrenSlide>
      )}
    </li>
  )
}

// A folder's rows: off, sliding open, open, sliding shut. Opening plays a keyframe from shut, so it
// needs no frame drawn shut first; shutting slides to shut, then the rows go.
type PapelizFolderChildrenSlidePhase = 'hidden' | 'opening' | 'shown' | 'closing'

// A folder's rows slide down out of it when it opens and back up into it when it closes, and the
// rows below move with them. The slide grows one grid row from nothing to the rows' height (0fr to
// 1fr), so no height is measured and a row added while the folder is open is never cut off.
function PapelizFileExplorerFolderChildrenSlide({ isFolderExpanded, children }: { isFolderExpanded: boolean; children: ReactNode }) {
  const [folderChildrenSlidePhase, setFolderChildrenSlidePhase] = useState<PapelizFolderChildrenSlidePhase>(isFolderExpanded ? 'shown' : 'hidden')
  const [wasFolderExpanded, setWasFolderExpanded] = useState(isFolderExpanded)
  if (wasFolderExpanded !== isFolderExpanded) {
    setWasFolderExpanded(isFolderExpanded)
    setFolderChildrenSlidePhase(isFolderExpanded ? 'opening' : 'closing')
  }

  useEffect(() => {
    if (folderChildrenSlidePhase === 'opening' || folderChildrenSlidePhase === 'closing') {
      const slideEndTimer = window.setTimeout(
        () => setFolderChildrenSlidePhase(folderChildrenSlidePhase === 'opening' ? 'shown' : 'hidden'),
        papelizFolderChildrenSlideMilliseconds,
      )
      return () => window.clearTimeout(slideEndTimer)
    }
  }, [folderChildrenSlidePhase])

  if (folderChildrenSlidePhase === 'hidden') return null
  const areFolderChildrenDrawnShut = folderChildrenSlidePhase === 'closing'
  return (
    <div
      className={joinPapelizClassNames(
        'papeliz-file-explorer-folder-children',
        folderChildrenSlidePhase === 'opening' && 'papeliz-file-explorer-folder-children-opening',
      )}
      data-papeliz-folder-children-drawn-shut={areFolderChildrenDrawnShut}
      inert={areFolderChildrenDrawnShut}
    >
      {children}
    </div>
  )
}

interface PapelizFileExplorerRenameFieldProps {
  vaultEntryRelativePath: string
  vaultEntryKind: PapelizVaultEntryKind
  vaultEntryDisplayName: string
  rowIndentStyle: { paddingLeft: number }
}

function PapelizFileExplorerRenameField({ vaultEntryRelativePath, vaultEntryKind, vaultEntryDisplayName, rowIndentStyle }: PapelizFileExplorerRenameFieldProps) {
  const renameVaultEntry = usePapelizWorkspaceStore((workspaceState) => workspaceState.renameVaultEntry)
  const stopRenamingVaultEntry = usePapelizWorkspaceStore((workspaceState) => workspaceState.stopRenamingVaultEntry)
  const showWorkspaceNotice = usePapelizWorkspaceStore((workspaceState) => workspaceState.showWorkspaceNotice)
  const [typedVaultEntryName, setTypedVaultEntryName] = useState(vaultEntryDisplayName)
  const [renameProblemMessage, setRenameProblemMessage] = useState<string | null>(null)
  const isRenameSubmittingRef = useRef(false)
  const renameProblemMessageId = `papeliz-rename-problem-${vaultEntryRelativePath}`

  const finishRename = async (renameTrigger: 'enter' | 'blur') => {
    if (isRenameSubmittingRef.current) return
    isRenameSubmittingRef.current = true
    const vaultEntryRenameResult = await renameVaultEntry(vaultEntryRelativePath, typedVaultEntryName)
    isRenameSubmittingRef.current = false
    if (vaultEntryRenameResult.vaultEntryRenameOutcome === 'refused') {
      if (renameTrigger === 'enter') {
        setRenameProblemMessage(vaultEntryRenameResult.vaultEntryRenameProblem)
        return
      }
      showWorkspaceNotice('error', `Not renamed: ${vaultEntryRenameResult.vaultEntryRenameProblem}`)
    }
    stopRenamingVaultEntry()
    if (renameTrigger === 'blur' || vaultEntryRenameResult.vaultEntryRenameOutcome === 'refused') return
    const workspaceState = usePapelizWorkspaceStore.getState()
    const renamedVaultEntryRelativePath = vaultEntryRenameResult.renamedVaultEntryRelativePath
    const renamedLoadedVaultNote = workspaceState.loadedVaultNotesByRelativePath[renamedVaultEntryRelativePath]
    // A brand-new, empty note: go straight to writing it, in MD Code or MD View.
    if (
      workspaceState.activeVaultNoteRelativePath === renamedVaultEntryRelativePath &&
      renamedLoadedVaultNote?.draftVaultNoteText.length === 0
    ) {
      focusNoteEditorText()
    } else {
      focusFileExplorerRow(renamedVaultEntryRelativePath)
    }
  }

  return (
    <div className="py-0.5" style={{ paddingLeft: rowIndentStyle.paddingLeft - 6 }}>
      <input
        autoFocus
        aria-label={vaultEntryKind === 'folder' ? 'Folder name' : 'Note name'}
        aria-invalid={renameProblemMessage !== null}
        aria-describedby={renameProblemMessage !== null ? renameProblemMessageId : undefined}
        value={typedVaultEntryName}
        onFocus={(focusEvent) => focusEvent.currentTarget.select()}
        onChange={(changeEvent) => {
          setTypedVaultEntryName(changeEvent.target.value)
          setRenameProblemMessage(null)
        }}
        onKeyDown={(keyboardEvent) => {
          if (keyboardEvent.key === 'Enter') {
            keyboardEvent.preventDefault()
            void finishRename('enter')
          } else if (keyboardEvent.key === 'Escape') {
            keyboardEvent.preventDefault()
            keyboardEvent.stopPropagation()
            isRenameSubmittingRef.current = true
            stopRenamingVaultEntry()
            focusFileExplorerRow(vaultEntryRelativePath)
          }
        }}
        onBlur={() => void finishRename('blur')}
        className="h-8 w-full rounded-full border border-papeliz-blue-line bg-papeliz-surface px-3 text-sm text-papeliz-ink shadow-[0_0_0_3px_var(--color-papeliz-blue-soft)] outline-none"
      />
      {renameProblemMessage !== null && (
        <p id={renameProblemMessageId} role="alert" className="px-3 pt-1 text-xs text-papeliz-diff-removed-ink">
          {renameProblemMessage}
        </p>
      )}
    </div>
  )
}
