import { ChevronDown, Files, FileText, Folder, Library, ListChecks, Search, X, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/react/shallow'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizPopoverMenu, type PapelizPopoverMenuItem, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import { getVaultEntryName, getVaultEntryParentFolderRelativePath, getVaultNoteTitle, isVaultRelativePathInsideFolder } from '../vault/papeliz-vault-relative-paths'
import { selectActiveVaultMarkdownNoteRelativePath, usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { papelizComposerRowGiveWayClassNames } from './papeliz-assistant-composer-row-fit'
import {
  describePapelizAssistantContextChoiceButtonWords,
  describePapelizAssistantContextChoiceTooltip,
  type PapelizAssistantContextMode,
} from './papeliz-assistant-context-choice'
import {
  listPapelizAssistantConversationContextNoteRelativePaths,
  selectPapelizAssistantContextChoice,
  usePapelizAssistantConversationStore,
} from './papeliz-assistant-conversation-store'

// What the assistant sees, in the chat box's row: a quiet button naming the choice ("This Note", "3
// Notes", "Projects"), its icon alone when the row is narrow, opening a menu of the five choices with
// what each covers and how many notes. Selected Notes… and A Folder… open a sheet over the box to pick
// them. The choice is kept with the conversation.

// The menu's five rows, each with its second line, its group heading and its frame, so it can open
// above the button before it is drawn.
const papelizAssistantContextMenuHeight = 5 * 44 + 26 + 10

export const papelizAssistantContextModeIcons: Record<PapelizAssistantContextMode, LucideIcon> = {
  'active-note': FileText,
  'open-notes': Files,
  'selected-notes': ListChecks,
  folder: Folder,
  'whole-vault': Library,
}

// A folder or note the lists leave out: anything inside a hidden folder (saved chats, the trash, Papeliz's
// own settings).
function isInsidePapelizHiddenFolder(vaultEntryRelativePath: string): boolean {
  return vaultEntryRelativePath.split('/').some((vaultPathSegment) => vaultPathSegment.startsWith('.'))
}

// The vault's notes and folders the pickers offer, read from the file list.
function usePapelizAssistantContextVaultEntries(): { vaultNoteRelativePaths: string[]; vaultFolderRelativePaths: string[] } {
  const vaultTreeEntries = usePapelizWorkspaceStore((workspaceState) => workspaceState.vaultTreeEntries)
  return useMemo(() => {
    const shownVaultTreeEntries = vaultTreeEntries.filter((vaultTreeEntry) => !isInsidePapelizHiddenFolder(vaultTreeEntry.vaultEntryRelativePath))
    return {
      vaultNoteRelativePaths: shownVaultTreeEntries.filter((vaultTreeEntry) => vaultTreeEntry.vaultEntryKind === 'note').map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath),
      vaultFolderRelativePaths: shownVaultTreeEntries.filter((vaultTreeEntry) => vaultTreeEntry.vaultEntryKind === 'folder').map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath),
    }
  }, [vaultTreeEntries])
}

function countNotesInFolder(vaultNoteRelativePaths: readonly string[], vaultFolderRelativePath: string): number {
  return vaultNoteRelativePaths.filter((vaultNoteRelativePath) => isVaultRelativePathInsideFolder(vaultNoteRelativePath, vaultFolderRelativePath)).length
}

type PapelizAssistantContextPickerKind = 'notes' | 'folder'

interface PapelizAssistantContextChoiceButtonProps {
  // The row's quiet button look, shared with its other buttons.
  contextChoiceButtonClassName: string
  // Where the pickers open: a strip along the chat box's top edge, outside the box so its focus ring
  // stays off while a picker has focus.
  contextPickerSheetHostElement: HTMLElement | null
}

export function PapelizAssistantContextChoiceButton({ contextChoiceButtonClassName, contextPickerSheetHostElement }: PapelizAssistantContextChoiceButtonProps) {
  const contextChoiceButtonRef = useRef<HTMLButtonElement>(null)
  // The same choice object while nothing in it changes, so the memo below holds.
  const assistantContextChoice = usePapelizAssistantConversationStore(useShallow(selectPapelizAssistantContextChoice))
  const setAssistantContextChoice = usePapelizAssistantConversationStore((conversationState) => conversationState.setAssistantContextChoice)
  const activeVaultMarkdownNoteRelativePath = usePapelizWorkspaceStore(selectActiveVaultMarkdownNoteRelativePath)
  const openNoteTabRelativePaths = usePapelizWorkspaceStore((workspaceState) => workspaceState.openNoteTabRelativePaths)
  const { vaultNoteRelativePaths, vaultFolderRelativePaths } = usePapelizAssistantContextVaultEntries()
  const [contextMenuPosition, setContextMenuPosition] = useState<PapelizPopoverMenuPosition | null>(null)
  const [openContextPickerKind, setOpenContextPickerKind] = useState<PapelizAssistantContextPickerKind | null>(null)
  // Read again whenever the workspace's notes or tabs change.
  const contextNoteRelativePaths = useMemo(
    () => listPapelizAssistantConversationContextNoteRelativePaths(assistantContextChoice),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assistantContextChoice, activeVaultMarkdownNoteRelativePath, openNoteTabRelativePaths, vaultNoteRelativePaths],
  )
  const contextChoiceButtonWords = describePapelizAssistantContextChoiceButtonWords(assistantContextChoice, contextNoteRelativePaths.length)
  const ContextChoiceIcon = papelizAssistantContextModeIcons[assistantContextChoice.assistantContextMode]
  const openNoteCount = listPapelizAssistantConversationContextNoteRelativePaths({ ...assistantContextChoice, assistantContextMode: 'open-notes' }).length

  const chooseContextMode = (assistantContextMode: PapelizAssistantContextMode) => setAssistantContextChoice({ ...assistantContextChoice, assistantContextMode })
  const contextMenuItems: PapelizPopoverMenuItem[] = [
    {
      menuItemKey: 'active-note',
      menuItemLabel: 'This Note',
      MenuItemIcon: FileText,
      menuItemDetailText: activeVaultMarkdownNoteRelativePath === null ? 'The note in front' : getVaultNoteTitle(activeVaultMarkdownNoteRelativePath),
      isMenuItemChecked: assistantContextChoice.assistantContextMode === 'active-note',
      menuItemGroupHeading: 'The assistant sees',
      onMenuItemSelect: () => chooseContextMode('active-note'),
    },
    {
      menuItemKey: 'open-notes',
      menuItemLabel: 'Open Notes',
      MenuItemIcon: Files,
      menuItemDetailText: 'Every open tab',
      menuItemTrailingText: String(openNoteCount),
      isMenuItemChecked: assistantContextChoice.assistantContextMode === 'open-notes',
      onMenuItemSelect: () => chooseContextMode('open-notes'),
    },
    {
      menuItemKey: 'selected-notes',
      menuItemLabel: 'Selected Notes…',
      MenuItemIcon: ListChecks,
      menuItemDetailText:
        assistantContextChoice.contextSelectedNoteRelativePaths.length === 0
          ? 'Pick from the file list'
          : assistantContextChoice.contextSelectedNoteRelativePaths.slice(0, 2).map(getVaultNoteTitle).join(', ') +
            (assistantContextChoice.contextSelectedNoteRelativePaths.length > 2 ? '…' : ''),
      ...(assistantContextChoice.contextSelectedNoteRelativePaths.length === 0 ? {} : { menuItemTrailingText: String(assistantContextChoice.contextSelectedNoteRelativePaths.length) }),
      isMenuItemChecked: assistantContextChoice.assistantContextMode === 'selected-notes',
      onMenuItemSelect: () => setOpenContextPickerKind('notes'),
    },
    {
      menuItemKey: 'folder',
      menuItemLabel: 'A Folder…',
      MenuItemIcon: Folder,
      menuItemDetailText: assistantContextChoice.contextFolderRelativePath === null ? 'One folder and its subfolders' : getVaultEntryName(assistantContextChoice.contextFolderRelativePath),
      ...(assistantContextChoice.contextFolderRelativePath === null
        ? {}
        : { menuItemTrailingText: String(countNotesInFolder(vaultNoteRelativePaths, assistantContextChoice.contextFolderRelativePath)) }),
      isMenuItemChecked: assistantContextChoice.assistantContextMode === 'folder',
      onMenuItemSelect: () => setOpenContextPickerKind('folder'),
    },
    {
      menuItemKey: 'whole-vault',
      menuItemLabel: 'Whole Vault',
      MenuItemIcon: Library,
      menuItemDetailText: 'Searches every note',
      menuItemTrailingText: String(vaultNoteRelativePaths.length),
      isMenuItemChecked: assistantContextChoice.assistantContextMode === 'whole-vault',
      onMenuItemSelect: () => chooseContextMode('whole-vault'),
    },
  ]

  const openContextMenu = (clickEvent: MouseEvent<HTMLButtonElement>) => {
    const contextChoiceButtonRect = clickEvent.currentTarget.getBoundingClientRect()
    setOpenContextPickerKind(null)
    // Opens above the button; the popover keeps it inside the window.
    setContextMenuPosition({ menuAnchorLeft: contextChoiceButtonRect.left, menuAnchorTop: contextChoiceButtonRect.top - papelizAssistantContextMenuHeight - 6 })
  }
  // A picker that closes gives focus back to the button.
  const closeContextPicker = () => {
    setOpenContextPickerKind(null)
    contextChoiceButtonRef.current?.focus({ preventScroll: true })
  }

  return (
    <>
      <button
        ref={contextChoiceButtonRef}
        type="button"
        data-papeliz-assistant-context-choice-button
        aria-haspopup="menu"
        aria-expanded={contextMenuPosition !== null}
        aria-label={`Sees ${contextChoiceButtonWords}`}
        title={`${describePapelizAssistantContextChoiceTooltip(assistantContextChoice, contextNoteRelativePaths)} Click to choose.`}
        onClick={openContextMenu}
        className={contextChoiceButtonClassName}
      >
        <ContextChoiceIcon className="size-3.5 flex-none" aria-hidden="true" />
        <span data-papeliz-composer-give-way-label="sees" className={joinPapelizClassNames('truncate', papelizComposerRowGiveWayClassNames.contextChoiceLabel)}>
          {contextChoiceButtonWords}
        </span>
        <ChevronDown
          data-papeliz-composer-give-way-chevron
          className={joinPapelizClassNames('size-3 flex-none opacity-70', papelizComposerRowGiveWayClassNames.chipChevron)}
          aria-hidden="true"
        />
      </button>
      {contextMenuPosition !== null && (
        <PapelizPopoverMenu menuLabel="What the Assistant Sees" menuPosition={contextMenuPosition} menuItems={contextMenuItems} onMenuClose={() => setContextMenuPosition(null)} />
      )}
      {openContextPickerKind === 'notes' &&
        contextPickerSheetHostElement !== null &&
        createPortal(
        <PapelizAssistantChooseNotesSheet
          vaultNoteRelativePaths={vaultNoteRelativePaths}
          initialChosenNoteRelativePaths={
            assistantContextChoice.contextSelectedNoteRelativePaths.length > 0
              ? assistantContextChoice.contextSelectedNoteRelativePaths
              : activeVaultMarkdownNoteRelativePath === null
                ? []
                : [activeVaultMarkdownNoteRelativePath]
          }
          onChosenNotesUse={(chosenNoteRelativePaths) => {
            setAssistantContextChoice({ ...assistantContextChoice, assistantContextMode: 'selected-notes', contextSelectedNoteRelativePaths: chosenNoteRelativePaths })
            closeContextPicker()
          }}
          onContextPickerClose={closeContextPicker}
        />,
        contextPickerSheetHostElement,
      )}
      {openContextPickerKind === 'folder' &&
        contextPickerSheetHostElement !== null &&
        createPortal(
        <PapelizAssistantChooseFolderSheet
          vaultNoteRelativePaths={vaultNoteRelativePaths}
          vaultFolderRelativePaths={vaultFolderRelativePaths}
          initialChosenFolderRelativePath={assistantContextChoice.contextFolderRelativePath}
          onChosenFolderUse={(chosenFolderRelativePath) => {
            setAssistantContextChoice({ ...assistantContextChoice, assistantContextMode: 'folder', contextFolderRelativePath: chosenFolderRelativePath })
            closeContextPicker()
          }}
          onContextPickerClose={closeContextPicker}
        />,
        contextPickerSheetHostElement,
      )}
    </>
  )
}

// A sheet over the chat box: its title and close, what it lists, and its foot. Esc closes it, and
// focus goes into it as it opens.
function PapelizAssistantContextPickerSheet({
  contextPickerTitle,
  onContextPickerClose,
  children,
  contextPickerFoot,
}: {
  contextPickerTitle: string
  onContextPickerClose: () => void
  children: ReactNode
  contextPickerFoot: ReactNode
}) {
  const contextPickerTitleId = useId()
  const contextPickerSheetRef = useRef<HTMLDivElement>(null)
  const onContextPickerCloseRef = useRef(onContextPickerClose)
  useEffect(() => {
    onContextPickerCloseRef.current = onContextPickerClose
  })
  useEffect(() => {
    contextPickerSheetRef.current?.querySelector<HTMLElement>('input')?.focus({ preventScroll: true })
    // A press anywhere else puts it away, as a menu does.
    const closeOnOutsidePointer = (pointerEvent: PointerEvent) => {
      if (!contextPickerSheetRef.current?.contains(pointerEvent.target as Node)) onContextPickerCloseRef.current()
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer, true)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer, true)
  }, [])
  return (
    <div
      ref={contextPickerSheetRef}
      role="dialog"
      aria-labelledby={contextPickerTitleId}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key !== 'Escape') return
        keyboardEvent.preventDefault()
        keyboardEvent.stopPropagation()
        onContextPickerClose()
      }}
      className="papeliz-pop-enter absolute right-0 bottom-0 left-0 mb-2 flex max-h-[min(420px,60dvh)] flex-col overflow-hidden rounded-[18px] border border-papeliz-line bg-papeliz-surface shadow-papeliz-pop"
    >
      <div className="flex flex-none items-center gap-2 py-1.5 pr-1.5 pl-3.5">
        <h3 id={contextPickerTitleId} className="min-w-0 flex-1 text-[14px] font-semibold">
          {contextPickerTitle}
        </h3>
        <PapelizIconButton iconButtonLabel={`Close ${contextPickerTitle}`} iconButtonSize="small" onClick={onContextPickerClose}>
          <X className="size-4" aria-hidden="true" />
        </PapelizIconButton>
      </div>
      {children}
      <div className="flex flex-none flex-wrap items-center gap-2 border-t border-papeliz-line px-3.5 py-2.5">{contextPickerFoot}</div>
    </div>
  )
}

// Choose Notes: every note, under its folder, each with a checkbox; search narrows the list by title.
function PapelizAssistantChooseNotesSheet({
  vaultNoteRelativePaths,
  initialChosenNoteRelativePaths,
  onChosenNotesUse,
  onContextPickerClose,
}: {
  vaultNoteRelativePaths: readonly string[]
  initialChosenNoteRelativePaths: readonly string[]
  onChosenNotesUse: (chosenNoteRelativePaths: string[]) => void
  onContextPickerClose: () => void
}) {
  const [noteSearchText, setNoteSearchText] = useState('')
  const [chosenNoteRelativePaths, setChosenNoteRelativePaths] = useState<string[]>(() =>
    initialChosenNoteRelativePaths.filter((chosenNoteRelativePath) => vaultNoteRelativePaths.includes(chosenNoteRelativePath)),
  )
  const lowerCaseNoteSearchText = noteSearchText.trim().toLowerCase()
  const shownNotesByFolder = useMemo(() => {
    const notesByFolder = new Map<string, string[]>()
    for (const vaultNoteRelativePath of vaultNoteRelativePaths) {
      if (lowerCaseNoteSearchText.length > 0 && !getVaultNoteTitle(vaultNoteRelativePath).toLowerCase().includes(lowerCaseNoteSearchText)) continue
      const noteFolderRelativePath = getVaultEntryParentFolderRelativePath(vaultNoteRelativePath)
      notesByFolder.set(noteFolderRelativePath, [...(notesByFolder.get(noteFolderRelativePath) ?? []), vaultNoteRelativePath])
    }
    return [...notesByFolder.entries()].sort(([firstFolder], [secondFolder]) => firstFolder.localeCompare(secondFolder))
  }, [vaultNoteRelativePaths, lowerCaseNoteSearchText])
  const toggleChosenNote = (vaultNoteRelativePath: string) =>
    setChosenNoteRelativePaths((currentChosenNoteRelativePaths) =>
      currentChosenNoteRelativePaths.includes(vaultNoteRelativePath)
        ? currentChosenNoteRelativePaths.filter((chosenNoteRelativePath) => chosenNoteRelativePath !== vaultNoteRelativePath)
        : [...currentChosenNoteRelativePaths, vaultNoteRelativePath],
    )
  const chosenNoteCountWords = chosenNoteRelativePaths.length === 1 ? '1 Note' : `${chosenNoteRelativePaths.length} Notes`

  return (
    <PapelizAssistantContextPickerSheet
      contextPickerTitle="Choose Notes"
      onContextPickerClose={onContextPickerClose}
      contextPickerFoot={
        <>
          <span className="text-[12.5px] text-papeliz-ink-subtle tabular-nums">{chosenNoteRelativePaths.length} selected</span>
          <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" className="ml-auto" disabled={chosenNoteRelativePaths.length === 0} onClick={() => onChosenNotesUse(chosenNoteRelativePaths)}>
            Use {chosenNoteCountWords}
          </PapelizPillButton>
        </>
      }
    >
      <label className="mx-3.5 mb-1.5 flex h-8 flex-none items-center gap-2 rounded-full border border-papeliz-line px-3 focus-within:border-papeliz-blue-line">
        <Search className="size-3.5 flex-none text-papeliz-ink-subtle" aria-hidden="true" />
        <span className="sr-only">Search notes</span>
        <input
          type="search"
          value={noteSearchText}
          placeholder="Search notes"
          onChange={(changeEvent) => setNoteSearchText(changeEvent.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-papeliz-ink-subtle"
        />
      </label>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {shownNotesByFolder.length === 0 && <p className="px-2 py-3 text-[13px] text-papeliz-ink-subtle">No note matches “{noteSearchText.trim()}”.</p>}
        {shownNotesByFolder.map(([noteFolderRelativePath, folderNoteRelativePaths]) => (
          <div key={noteFolderRelativePath} role="group" aria-label={noteFolderRelativePath.length === 0 ? 'Top of the vault' : noteFolderRelativePath}>
            {noteFolderRelativePath.length > 0 && (
              <p className="mt-1.5 flex items-center gap-1.5 px-2 py-1 text-[11.5px] font-semibold text-papeliz-ink-subtle">
                <Folder className="size-3 flex-none" aria-hidden="true" />
                <span className="truncate">{noteFolderRelativePath}</span>
              </p>
            )}
            {folderNoteRelativePaths.map((vaultNoteRelativePath) => (
              <label key={vaultNoteRelativePath} title={vaultNoteRelativePath} className="flex min-h-8 cursor-pointer items-center gap-2.5 rounded-[10px] px-2 text-[13px] hover:bg-papeliz-hover pointer-coarse:min-h-10">
                <input
                  type="checkbox"
                  checked={chosenNoteRelativePaths.includes(vaultNoteRelativePath)}
                  onChange={() => toggleChosenNote(vaultNoteRelativePath)}
                  className="size-4 flex-none accent-papeliz-blue"
                />
                <span className="min-w-0 truncate">{getVaultNoteTitle(vaultNoteRelativePath)}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </PapelizAssistantContextPickerSheet>
  )
}

// Choose a Folder: every folder, indented under its parent, with how many notes it holds (its subfolders
// counted too).
function PapelizAssistantChooseFolderSheet({
  vaultNoteRelativePaths,
  vaultFolderRelativePaths,
  initialChosenFolderRelativePath,
  onChosenFolderUse,
  onContextPickerClose,
}: {
  vaultNoteRelativePaths: readonly string[]
  vaultFolderRelativePaths: readonly string[]
  initialChosenFolderRelativePath: string | null
  onChosenFolderUse: (chosenFolderRelativePath: string) => void
  onContextPickerClose: () => void
}) {
  const sortedVaultFolderRelativePaths = useMemo(() => [...vaultFolderRelativePaths].sort((firstFolder, secondFolder) => firstFolder.localeCompare(secondFolder)), [vaultFolderRelativePaths])
  const [chosenFolderRelativePath, setChosenFolderRelativePath] = useState<string | null>(() =>
    initialChosenFolderRelativePath !== null && vaultFolderRelativePaths.includes(initialChosenFolderRelativePath) ? initialChosenFolderRelativePath : null,
  )
  const folderChoiceGroupName = useId()
  return (
    <PapelizAssistantContextPickerSheet
      contextPickerTitle="Choose a Folder"
      onContextPickerClose={onContextPickerClose}
      contextPickerFoot={
        <>
          <span className="text-[12.5px] text-papeliz-ink-subtle">Notes in its subfolders count too</span>
          <PapelizPillButton
            pillButtonVariant="primary"
            pillButtonSize="small"
            className="ml-auto max-w-[60%]"
            disabled={chosenFolderRelativePath === null}
            onClick={() => chosenFolderRelativePath !== null && onChosenFolderUse(chosenFolderRelativePath)}
          >
            <span className="truncate">Use {chosenFolderRelativePath === null ? 'Folder' : getVaultEntryName(chosenFolderRelativePath)}</span>
          </PapelizPillButton>
        </>
      }
    >
      <div role="radiogroup" aria-label="Folders" className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {sortedVaultFolderRelativePaths.length === 0 && <p className="px-2 py-3 text-[13px] text-papeliz-ink-subtle">This vault has no folders yet.</p>}
        {sortedVaultFolderRelativePaths.map((vaultFolderRelativePath) => {
          const folderDepth = vaultFolderRelativePath.split('/').length - 1
          const folderNoteCount = countNotesInFolder(vaultNoteRelativePaths, vaultFolderRelativePath)
          return (
            <label
              key={vaultFolderRelativePath}
              title={vaultFolderRelativePath}
              style={{ paddingLeft: `${8 + folderDepth * 14}px` }}
              className={joinPapelizClassNames(
                'flex min-h-8 cursor-pointer items-center gap-2.5 rounded-[10px] pr-2 text-[13px] pointer-coarse:min-h-10',
                chosenFolderRelativePath === vaultFolderRelativePath ? 'bg-papeliz-blue-soft' : 'hover:bg-papeliz-hover',
              )}
            >
              <input
                type="radio"
                name={folderChoiceGroupName}
                checked={chosenFolderRelativePath === vaultFolderRelativePath}
                onChange={() => setChosenFolderRelativePath(vaultFolderRelativePath)}
                className="size-4 flex-none accent-papeliz-blue"
              />
              <Folder className="size-3.5 flex-none text-papeliz-ink-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{getVaultEntryName(vaultFolderRelativePath)}</span>
              <span className="flex-none text-[12px] text-papeliz-ink-subtle tabular-nums">
                {folderNoteCount} {folderNoteCount === 1 ? 'note' : 'notes'}
              </span>
            </label>
          )
        })}
      </div>
    </PapelizAssistantContextPickerSheet>
  )
}
