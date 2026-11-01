import { ChevronRight, FilePlus, Lock, RotateCw, X } from 'lucide-react'
import type { EditorView } from '@codemirror/view'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { usePapelizAssistantConversationStore } from '../assistant/papeliz-assistant-conversation-store'
import { canOfferPapelizInlineEdit, openPapelizInlineEditForSelection } from '../assistant/papeliz-assistant-inline-edit-extension'
import { PapelizAssistantInlineEditCard } from '../assistant/papeliz-assistant-inline-edit-card'
import { usePapelizInlineEditStore } from '../assistant/papeliz-assistant-inline-edit-store'
import { usePapelizAssistantPanelUiStore } from '../assistant/papeliz-assistant-panel-ui-store'
import { PapelizMdViewRenderedPage } from '../md-view/papeliz-md-view-rendered-page'
import { PapelizNoteContextMenu } from '../note-editor/papeliz-note-context-menu'
import {
  PapelizNoteEditor,
  setPapelizNoteEditorContextMenuHandlers,
  setPapelizNoteEditorInlineEditHandlers,
  setPapelizNoteEditorMdViewWikilinkHandlers,
  setPapelizNoteEditorWikilinkCompletionTitles,
  type PapelizNoteEditorSessionCache,
  type PapelizNoteViewMode,
} from '../note-editor/papeliz-note-editor'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { describePapelizFailureCodeMessage } from '../vault/papeliz-failure-code-words'
import {
  getVaultEntryName,
  getVaultEntryParentFolderRelativePath,
  getVaultNoteTitle,
  isVaultRelativePathHidden,
  isVaultRelativePathInTrash,
  splitVaultRelativePath,
} from '../vault/papeliz-vault-relative-paths'
import { usePapelizNoteTypographyStore } from './papeliz-note-typography-store'
import type { PapelizVaultNoteEditingLock } from './papeliz-vault-entry-locks'
import { usePapelizActiveVaultNoteEditingLock, usePapelizWorkspaceStore } from './papeliz-workspace-store'

// After a breadcrumb opens the file list, scrolls the matching row into view and puts focus on it.
function showVaultEntryRowSoon(vaultEntryRelativePath: string): void {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const vaultEntryRow = document.querySelector<HTMLElement>(`[data-papeliz-vault-entry-path="${CSS.escape(vaultEntryRelativePath)}"]`)
      vaultEntryRow?.scrollIntoView({ block: 'nearest' })
      vaultEntryRow?.focus({ preventScroll: true })
    }),
  )
}

// "Guides/Links.md" + "../Start here.md" -> "Start here.md"; null when the link leaves the vault.
function resolveRelativeNoteLinkHref(fromVaultNoteRelativePath: string, linkHref: string): string | null {
  let decodedLinkHref: string
  try {
    decodedLinkHref = decodeURIComponent(linkHref.split('#')[0] ?? '')
  } catch {
    return null
  }
  const startingVaultPathSegments = decodedLinkHref.startsWith('/') ? [] : splitVaultRelativePath(getVaultEntryParentFolderRelativePath(fromVaultNoteRelativePath))
  const resolvedVaultPathSegments = [...startingVaultPathSegments]
  for (const linkPathSegment of splitVaultRelativePath(decodedLinkHref)) {
    if (linkPathSegment === '.') continue
    if (linkPathSegment === '..') {
      if (resolvedVaultPathSegments.length === 0) return null
      resolvedVaultPathSegments.pop()
      continue
    }
    resolvedVaultPathSegments.push(linkPathSegment)
  }
  return resolvedVaultPathSegments.length === 0 ? null : resolvedVaultPathSegments.join('/')
}

// A key that would type into the note: a character (not a space, which also scrolls a page), Enter,
// Backspace or Delete, with no Ctrl, Cmd or Alt.
function isNoteTypingKey(keyboardEvent: KeyboardEvent): boolean {
  if (keyboardEvent.ctrlKey || keyboardEvent.metaKey || keyboardEvent.altKey || keyboardEvent.isComposing) return false
  return (keyboardEvent.key.length === 1 && keyboardEvent.key !== ' ') || ['Enter', 'Backspace', 'Delete'].includes(keyboardEvent.key)
}

// What typing into a note that can't be changed says, and how to change it.
function describeLockedNoteTyping(vaultNoteEditingLock: PapelizVaultNoteEditingLock, vaultNoteRelativePath: string): string {
  if (vaultNoteEditingLock.vaultNoteEditingLockKind === 'hidden-folder') return 'Notes in hidden folders open read-only.'
  if (vaultNoteEditingLock.vaultNoteEditingLockKind === 'whole-vault') return 'All notes are locked. Turn off Lock All Notes in the Settings gear.'
  const vaultNoteTitle = getVaultNoteTitle(vaultNoteRelativePath)
  if (vaultNoteEditingLock.lockingVaultEntryRelativePath === vaultNoteRelativePath) return `“${vaultNoteTitle}” is locked. Press the lock on its tab to edit it.`
  return `“${vaultNoteTitle}” is locked with the folder “${getVaultEntryName(vaultNoteEditingLock.lockingVaultEntryRelativePath)}”. Press the lock on its tab to unlock the folder.`
}

// The short words on the path line of a locked note in MD Code, as in the status bar.
function describeLockedNoteLabel(vaultNoteEditingLock: PapelizVaultNoteEditingLock, vaultNoteRelativePath: string): string {
  if (vaultNoteEditingLock.vaultNoteEditingLockKind === 'hidden-folder') return 'Read-only'
  if (vaultNoteEditingLock.vaultNoteEditingLockKind === 'whole-vault') return 'All notes locked'
  return vaultNoteEditingLock.lockingVaultEntryRelativePath === vaultNoteRelativePath
    ? 'Locked'
    : `Locked with “${getVaultEntryName(vaultNoteEditingLock.lockingVaultEntryRelativePath)}”`
}

// How long after one "locked" message typing may show it again.
const papelizLockedNoteTypingNoticeGapMilliseconds = 4000

interface PapelizNoteAreaProps {
  noteEditorSessionCache: PapelizNoteEditorSessionCache
}

// The note column: where the note is, then the note itself. MD Code and MD View both edit the
// Markdown in place; MD View with the lock on is the clean rendered page.
// How much Ctrl+scroll adds up to one zoom step: one notch of a mouse wheel, or a short pinch.
const papelizNoteZoomWheelStepDelta = 50

export function PapelizNoteArea({ noteEditorSessionCache }: PapelizNoteAreaProps) {
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)
  const vaultTreeEntries = usePapelizWorkspaceStore((workspaceState) => workspaceState.vaultTreeEntries)
  const activeVaultNoteRelativePath = usePapelizWorkspaceStore((workspaceState) => workspaceState.activeVaultNoteRelativePath)
  const activeLoadedVaultNote = usePapelizWorkspaceStore((workspaceState) =>
    workspaceState.activeVaultNoteRelativePath === null ? undefined : workspaceState.loadedVaultNotesByRelativePath[workspaceState.activeVaultNoteRelativePath],
  )
  const noteViewMode = usePapelizWorkspaceStore((workspaceState) => workspaceState.noteViewMode)
  // The open note is locked by itself or by a folder it is in.
  const activeVaultNoteEditingLock = usePapelizActiveVaultNoteEditingLock()
  const isNoteEditingLocked = activeVaultNoteEditingLock !== null
  const isFocusModeOn = usePapelizWorkspaceStore((workspaceState) => workspaceState.isFocusModeOn)
  const inlineEditEditorView = usePapelizInlineEditStore((inlineEditState) => inlineEditState.inlineEditEditorView)
  const openVaultNote = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVaultNote)
  const revealVaultEntryInFileList = usePapelizWorkspaceStore((workspaceState) => workspaceState.revealVaultEntryInFileList)
  const openOrCreateVaultNoteForWikilinkTarget = usePapelizWorkspaceStore((workspaceState) => workspaceState.openOrCreateVaultNoteForWikilinkTarget)
  const updateVaultNoteDraftText = usePapelizWorkspaceStore((workspaceState) => workspaceState.updateVaultNoteDraftText)
  const createVaultNoteInFolder = usePapelizWorkspaceStore((workspaceState) => workspaceState.createVaultNoteInFolder)
  const closeVaultNoteTab = usePapelizWorkspaceStore((workspaceState) => workspaceState.closeVaultNoteTab)
  const vaultTreeLoadState = usePapelizWorkspaceStore((workspaceState) => workspaceState.vaultTreeLoadState)
  const showWorkspaceNotice = usePapelizWorkspaceStore((workspaceState) => workspaceState.showWorkspaceNotice)
  // The open context menu, tied to the note and view it opened on, so it is gone after a switch.
  const [noteContextMenuRequest, setNoteContextMenuRequest] = useState<{
    noteEditorView: EditorView
    menuAnchorLeft: number
    menuAnchorTop: number
    requestedVaultNoteRelativePath: string | null
    requestedNoteViewMode: PapelizNoteViewMode
  } | null>(null)

  // The notes a link can point to and `[[` offers: never one in the trash.
  const vaultNoteRelativePaths = useMemo(
    () =>
      vaultTreeEntries
        .filter((vaultTreeEntry) => vaultTreeEntry.vaultEntryKind === 'note' && !isVaultRelativePathInTrash(vaultTreeEntry.vaultEntryRelativePath))
        .map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath),
    [vaultTreeEntries],
  )
  const resolveWikilinkTarget = useMemo(() => createPapelizWikilinkTargetResolver(vaultNoteRelativePaths), [vaultNoteRelativePaths])

  useEffect(() => {
    // The `[[` list offers each note once, by title; notes that share a title also offer their path.
    const vaultNoteTitleCounts = new Map<string, number>()
    for (const vaultNoteRelativePath of vaultNoteRelativePaths) {
      const vaultNoteTitle = getVaultNoteTitle(vaultNoteRelativePath)
      vaultNoteTitleCounts.set(vaultNoteTitle, (vaultNoteTitleCounts.get(vaultNoteTitle) ?? 0) + 1)
    }
    setPapelizNoteEditorWikilinkCompletionTitles(
      noteEditorSessionCache,
      vaultNoteRelativePaths
        .map((vaultNoteRelativePath) => {
          const vaultNoteTitle = getVaultNoteTitle(vaultNoteRelativePath)
          return (vaultNoteTitleCounts.get(vaultNoteTitle) ?? 0) > 1 ? vaultNoteRelativePath.replace(/\.md$/i, '') : vaultNoteTitle
        })
        .sort((firstTitle, secondTitle) => firstTitle.localeCompare(secondTitle, undefined, { sensitivity: 'base', numeric: true })),
    )
  }, [noteEditorSessionCache, vaultNoteRelativePaths])

  const activateWikilink = useCallback(
    (wikilinkTargetNoteName: string) => {
      void openOrCreateVaultNoteForWikilinkTarget(resolveWikilinkTarget(wikilinkTargetNoteName, activeVaultNoteRelativePath), wikilinkTargetNoteName)
    },
    [activeVaultNoteRelativePath, openOrCreateVaultNoteForWikilinkTarget, resolveWikilinkTarget],
  )

  useEffect(() => {
    // MD View draws wikilinks itself; it asks here whether a link's note exists and what a click does.
    setPapelizNoteEditorMdViewWikilinkHandlers(noteEditorSessionCache, {
      isWikilinkTargetResolved: (wikilinkTargetNoteName) => resolveWikilinkTarget(wikilinkTargetNoteName, activeVaultNoteRelativePath) !== null,
      activateWikilinkTarget: activateWikilink,
    })
  }, [activateWikilink, activeVaultNoteRelativePath, noteEditorSessionCache, resolveWikilinkTarget])

  useEffect(() => {
    // Opening an inline edit from the editor: remember the passage and the note it is in.
    setPapelizNoteEditorInlineEditHandlers(noteEditorSessionCache, {
      openInlineEdit: (editorView, inlineEditRange) =>
        usePapelizInlineEditStore
          .getState()
          .openInlineEdit(
            editorView,
            editorView.state.sliceDoc(inlineEditRange.inlineEditFrom, inlineEditRange.inlineEditTo),
            activeVaultNoteRelativePath === null ? '' : getVaultNoteTitle(activeVaultNoteRelativePath),
          ),
    })
  }, [activeVaultNoteRelativePath, noteEditorSessionCache])

  useEffect(() => {
    // A right-click in the note opens its context menu here.
    setPapelizNoteEditorContextMenuHandlers(noteEditorSessionCache, {
      openNoteContextMenu: (noteEditorView, menuAnchorLeft, menuAnchorTop) => {
        const workspaceState = usePapelizWorkspaceStore.getState()
        setNoteContextMenuRequest({
          noteEditorView,
          menuAnchorLeft,
          menuAnchorTop,
          requestedVaultNoteRelativePath: workspaceState.activeVaultNoteRelativePath,
          requestedNoteViewMode: workspaceState.noteViewMode,
        })
      },
    })
  }, [noteEditorSessionCache])

  const askAssistantAboutSelectionInPanel = useCallback(
    (selectedText: string) => {
      if (activeVaultNoteRelativePath === null) return
      // With text selected, the question is about that text; otherwise about the note.
      if (selectedText.trim().length > 0) {
        usePapelizAssistantConversationStore.getState().setPendingSelectionContext({ vaultNoteRelativePath: activeVaultNoteRelativePath, selectedText })
      }
      usePapelizWorkspaceStore.getState().setAssistantPanelOpen(true)
      usePapelizAssistantPanelUiStore.getState().setAssistantPanelTab('chat')
      usePapelizAssistantPanelUiStore.getState().requestComposerFocus()
    },
    [activeVaultNoteRelativePath],
  )

  useEffect(() => {
    // An inline edit belongs to one note in one view; switching away closes it.
    return () => usePapelizInlineEditStore.getState().closeInlineEdit()
  }, [activeVaultNoteRelativePath, noteViewMode, isNoteEditingLocked])

  const activateRelativeNoteLink = useCallback(
    (linkHref: string) => {
      if (activeVaultNoteRelativePath === null) return
      const linkedVaultEntryRelativePath = resolveRelativeNoteLinkHref(activeVaultNoteRelativePath, linkHref)
      const linkedVaultNoteRelativePath =
        linkedVaultEntryRelativePath === null
          ? undefined
          : vaultNoteRelativePaths.find(
              (vaultNoteRelativePath) =>
                vaultNoteRelativePath.toLowerCase() === linkedVaultEntryRelativePath.toLowerCase() ||
                vaultNoteRelativePath.toLowerCase() === `${linkedVaultEntryRelativePath.toLowerCase()}.md`,
            )
      if (linkedVaultNoteRelativePath === undefined) {
        showWorkspaceNotice('error', describePapelizFailureCodeMessage(`Couldn’t open “${linkHref.replace(/\.md$/i, '')}”`, 'Note Not Found'))
        return
      }
      void openVaultNote(linkedVaultNoteRelativePath)
    },
    [activeVaultNoteRelativePath, openVaultNote, showWorkspaceNotice, vaultNoteRelativePaths],
  )

  // Ctrl+scroll over the note zooms it, as in a document editor, instead of zooming the whole page
  // (Cmd+scroll on a Mac; a trackpad pinch arrives as Ctrl+scroll). A pinch sends many small steps,
  // added up into whole zoom steps.
  useEffect(() => {
    let accumulatedNoteZoomWheelDelta = 0
    const zoomNoteOnModifiedWheel = (wheelEvent: WheelEvent) => {
      if (!(wheelEvent.ctrlKey || wheelEvent.metaKey)) return
      if (!(wheelEvent.target instanceof Element) || wheelEvent.target.closest('#papeliz-note-panel') === null) return
      wheelEvent.preventDefault()
      accumulatedNoteZoomWheelDelta += wheelEvent.deltaY
      if (Math.abs(accumulatedNoteZoomWheelDelta) < papelizNoteZoomWheelStepDelta) return
      usePapelizNoteTypographyStore.getState().stepNoteZoomPercent(accumulatedNoteZoomWheelDelta < 0 ? 'in' : 'out')
      accumulatedNoteZoomWheelDelta = 0
    }
    window.addEventListener('wheel', zoomNoteOnModifiedWheel, { passive: false })
    return () => window.removeEventListener('wheel', zoomNoteOnModifiedWheel)
  }, [])

  // Typing into a note that can't be changed says why, at most every few seconds: in MD Code's
  // read-only editor, or after a click in MD View's locked page, which takes no focus.
  useEffect(() => {
    if (activeVaultNoteEditingLock === null || activeVaultNoteRelativePath === null) return
    let wasLastPointerDownInNote = false
    let lockedNoteTypingNoticeShownAt = Number.NEGATIVE_INFINITY
    const rememberPointerDownPlace = (pointerEvent: PointerEvent) => {
      wasLastPointerDownInNote = pointerEvent.target instanceof Element && pointerEvent.target.closest('#papeliz-note-panel') !== null
    }
    const explainLockedNoteTyping = (keyboardEvent: KeyboardEvent) => {
      if (!isNoteTypingKey(keyboardEvent)) return
      const keyTarget = keyboardEvent.target
      const isTypingIntoNote =
        keyTarget instanceof Element && keyTarget.closest('#papeliz-note-panel') !== null && keyTarget.closest('input, textarea, select') === null
      if (!isTypingIntoNote && !(keyTarget === document.body && wasLastPointerDownInNote)) return
      if (performance.now() - lockedNoteTypingNoticeShownAt < papelizLockedNoteTypingNoticeGapMilliseconds) return
      lockedNoteTypingNoticeShownAt = performance.now()
      showWorkspaceNotice('info', describeLockedNoteTyping(activeVaultNoteEditingLock, activeVaultNoteRelativePath))
    }
    window.addEventListener('pointerdown', rememberPointerDownPlace, true)
    window.addEventListener('keydown', explainLockedNoteTyping, true)
    return () => {
      window.removeEventListener('pointerdown', rememberPointerDownPlace, true)
      window.removeEventListener('keydown', explainLockedNoteTyping, true)
    }
  }, [activeVaultNoteEditingLock, activeVaultNoteRelativePath, showWorkspaceNotice])

  if (openVault === null) return null

  if (activeVaultNoteRelativePath === null || activeLoadedVaultNote === undefined) {
    // An empty vault has nothing in the list to pick.
    const isVaultWithoutNotes =
      vaultTreeLoadState === 'loaded' &&
      !vaultTreeEntries.some((vaultTreeEntry) => vaultTreeEntry.vaultEntryKind === 'note' && !isVaultRelativePathHidden(vaultTreeEntry.vaultEntryRelativePath))
    return (
      <div id="papeliz-note-panel" className="grid flex-1 place-items-center overflow-auto px-6 py-10 text-center">
        <div className="max-w-sm">
          <h2 className="text-[22px] font-medium tracking-[-0.01em]">{isVaultWithoutNotes ? 'This vault has no notes yet' : 'No note open'}</h2>
          <p className="mt-2 text-papeliz-ink-muted">{isVaultWithoutNotes ? 'Start the first one here.' : 'Pick a note from the list, or start a new one.'}</p>
          <PapelizPillButton pillButtonVariant="primary" className="mt-5" onClick={() => void createVaultNoteInFolder('')}>
            <FilePlus className="size-4" aria-hidden="true" />
            New Note
          </PapelizPillButton>
        </div>
      </div>
    )
  }

  // The note's folders and its title; the vault's name is already in the topbar and the file list.
  // Each one shows that folder (or the note) in the file list.
  const notePathSegments = splitVaultRelativePath(activeVaultNoteRelativePath)
  const breadcrumbs = notePathSegments.map((notePathSegment, notePathSegmentIndex) => {
    const isNoteBreadcrumb = notePathSegmentIndex === notePathSegments.length - 1
    return {
      breadcrumbVaultEntryRelativePath: notePathSegments.slice(0, notePathSegmentIndex + 1).join('/'),
      breadcrumbVaultEntryKind: isNoteBreadcrumb ? ('note' as const) : ('folder' as const),
      breadcrumbLabel: isNoteBreadcrumb ? getVaultNoteTitle(activeVaultNoteRelativePath) : notePathSegment,
    }
  })

  // The note's text column (the "Aa" button's text width); MD Code adds room for its line numbers.
  const noteColumnMaxWidth = noteViewMode === 'md-code' ? 'calc(var(--papeliz-note-column-width) + 60px)' : 'var(--papeliz-note-column-width)'
  // A note gone from the folder can't be read again; any other failure may pass.
  const isFailedNoteStillListed = vaultTreeEntries.some((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath === activeVaultNoteRelativePath)

  return (
    // Keyed by note, so each note opens scrolled to its top.
    <div
      key={activeLoadedVaultNote.loadedNoteSessionId}
      id="papeliz-note-panel"
      className={`min-h-0 flex-1 overflow-y-auto px-4 pt-6 sm:px-10 sm:pt-[30px] ${isFocusModeOn ? 'pb-64' : 'pb-24'}`}
    >
      {/* The path line takes the text column's width, in MD Code too (past its line numbers), and
          moves left by its buttons' padding, so its words start where the note's text does. */}
      <nav
        aria-label="Where this note is"
        className="relative -left-1 mx-auto mb-[18px] flex flex-wrap items-center gap-0.5 text-[13px] text-papeliz-ink-subtle"
        style={{ maxWidth: 'var(--papeliz-note-column-width)' }}
      >
        {breadcrumbs.map((breadcrumb, breadcrumbIndex) => (
          <span key={breadcrumb.breadcrumbVaultEntryRelativePath} className="flex min-w-0 items-center gap-0.5">
            {breadcrumbIndex > 0 && <ChevronRight className="size-[13px] flex-none opacity-70" aria-hidden="true" />}
            <button
              type="button"
              aria-current={breadcrumb.breadcrumbVaultEntryKind === 'note' ? 'page' : undefined}
              title={breadcrumb.breadcrumbVaultEntryKind === 'folder' ? `Show the “${breadcrumb.breadcrumbLabel}” folder in the file list` : 'Show this note in the file list'}
              onClick={() => {
                revealVaultEntryInFileList(breadcrumb.breadcrumbVaultEntryRelativePath, breadcrumb.breadcrumbVaultEntryKind)
                showVaultEntryRowSoon(breadcrumb.breadcrumbVaultEntryRelativePath)
              }}
              className={`max-w-[240px] truncate rounded-md px-1.5 py-0.5 transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink ${
                breadcrumb.breadcrumbVaultEntryKind === 'note' ? 'font-medium text-papeliz-ink-muted' : ''
              }`}
            >
              {breadcrumb.breadcrumbLabel}
            </button>
          </span>
        ))}
        {/* MD Code looks the same locked or not, so the path line says it is locked. */}
        {activeVaultNoteEditingLock !== null && noteViewMode === 'md-code' && (
          <span className="ml-auto flex min-w-0 items-center gap-1 pl-3" title={describeLockedNoteTyping(activeVaultNoteEditingLock, activeVaultNoteRelativePath)}>
            <Lock className="size-[13px] flex-none" aria-hidden="true" />
            <span className="truncate">{describeLockedNoteLabel(activeVaultNoteEditingLock, activeVaultNoteRelativePath)}</span>
          </span>
        )}
      </nav>

      {activeLoadedVaultNote.noteLoadState === 'loading' && (
        <p className="mx-auto text-papeliz-ink-subtle" style={{ maxWidth: 'var(--papeliz-note-column-width)' }}>
          Opening the note…
        </p>
      )}

      {activeLoadedVaultNote.noteLoadState === 'load-failed' && (
        <div role="alert" className="mx-auto max-w-[720px] rounded-2xl bg-papeliz-diff-removed px-5 py-4 text-papeliz-diff-removed-ink">
          <p className="font-semibold">This note couldn’t be opened.</p>
          <p className="mt-1 text-sm">{activeLoadedVaultNote.noteLoadErrorMessage}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {isFailedNoteStillListed && (
              <PapelizPillButton pillButtonSize="small" className="bg-papeliz-surface" onClick={() => void openVaultNote(activeVaultNoteRelativePath)}>
                <RotateCw className="size-[13px]" aria-hidden="true" />
                Try Again
              </PapelizPillButton>
            )}
            <PapelizPillButton pillButtonSize="small" className="bg-papeliz-surface" onClick={() => void closeVaultNoteTab(activeVaultNoteRelativePath)}>
              <X className="size-[13px]" aria-hidden="true" />
              Close Tab
            </PapelizPillButton>
          </div>
        </div>
      )}

      {activeLoadedVaultNote.noteLoadState === 'loaded' &&
        (noteViewMode === 'md-view' && isNoteEditingLocked ? (
          <div className="papeliz-note-view-enter">
            <PapelizMdViewRenderedPage
              vaultNoteText={activeLoadedVaultNote.draftVaultNoteText}
              vaultNoteRelativePath={activeVaultNoteRelativePath}
              resolveWikilinkTarget={resolveWikilinkTarget}
              onWikilinkActivate={activateWikilink}
              onRelativeNoteLinkActivate={activateRelativeNoteLink}
            />
          </div>
        ) : (
          <div
            key={noteViewMode}
            className="papeliz-note-view-enter mx-auto"
            style={{ maxWidth: noteColumnMaxWidth }}
          >
            <PapelizNoteEditor
              loadedNoteSessionId={activeLoadedVaultNote.loadedNoteSessionId}
              vaultNoteText={activeLoadedVaultNote.draftVaultNoteText}
              noteEditorSessionCache={noteEditorSessionCache}
              noteViewMode={noteViewMode}
              isNoteEditingLocked={isNoteEditingLocked}
              onVaultNoteTextChange={updateVaultNoteDraftText}
            />
            {inlineEditEditorView !== null && inlineEditEditorView === noteEditorSessionCache.activeNoteEditorView.current && (
              <PapelizAssistantInlineEditCard
                inlineEditHostElement={noteEditorSessionCache.inlineEditHostElement}
                vaultNoteRelativePath={activeVaultNoteRelativePath}
              />
            )}
            {noteContextMenuRequest !== null &&
              noteContextMenuRequest.requestedVaultNoteRelativePath === activeVaultNoteRelativePath &&
              noteContextMenuRequest.requestedNoteViewMode === noteViewMode && (
              <PapelizNoteContextMenu
                noteEditorView={noteContextMenuRequest.noteEditorView}
                menuAnchorLeft={noteContextMenuRequest.menuAnchorLeft}
                menuAnchorTop={noteContextMenuRequest.menuAnchorTop}
                isEditWithAssistantAvailable={canOfferPapelizInlineEdit(noteContextMenuRequest.noteEditorView.state)}
                onEditWithAssistant={() =>
                  void openPapelizInlineEditForSelection(noteContextMenuRequest.noteEditorView, noteEditorSessionCache.inlineEditHandlers)
                }
                onAskAssistantInPanel={askAssistantAboutSelectionInPanel}
                onNoteContextMenuProblem={(problemMessage) => showWorkspaceNotice('error', problemMessage)}
                onNoteContextMenuClose={() => setNoteContextMenuRequest(null)}
              />
            )}
          </div>
        ))}
    </div>
  )
}
