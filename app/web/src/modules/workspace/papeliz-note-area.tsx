import { ChevronRight, FilePlus, RotateCw } from 'lucide-react'
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
import {
  getVaultEntryParentFolderRelativePath,
  getVaultNoteTitle,
  splitVaultRelativePath,
} from '../vault/papeliz-vault-relative-paths'
import { usePapelizNoteTypographyStore } from './papeliz-note-typography-store'
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
  const isNoteEditingLocked = usePapelizActiveVaultNoteEditingLock() !== null
  const isFocusModeOn = usePapelizWorkspaceStore((workspaceState) => workspaceState.isFocusModeOn)
  const inlineEditEditorView = usePapelizInlineEditStore((inlineEditState) => inlineEditState.inlineEditEditorView)
  const openVaultNote = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVaultNote)
  const revealVaultEntryInFileList = usePapelizWorkspaceStore((workspaceState) => workspaceState.revealVaultEntryInFileList)
  const openOrCreateVaultNoteForWikilinkTarget = usePapelizWorkspaceStore((workspaceState) => workspaceState.openOrCreateVaultNoteForWikilinkTarget)
  const updateVaultNoteDraftText = usePapelizWorkspaceStore((workspaceState) => workspaceState.updateVaultNoteDraftText)
  const createVaultNoteInFolder = usePapelizWorkspaceStore((workspaceState) => workspaceState.createVaultNoteInFolder)
  const showWorkspaceNotice = usePapelizWorkspaceStore((workspaceState) => workspaceState.showWorkspaceNotice)
  // The open context menu, tied to the note and view it opened on, so it is gone after a switch.
  const [noteContextMenuRequest, setNoteContextMenuRequest] = useState<{
    noteEditorView: EditorView
    menuAnchorLeft: number
    menuAnchorTop: number
    requestedVaultNoteRelativePath: string | null
    requestedNoteViewMode: PapelizNoteViewMode
  } | null>(null)

  const vaultNoteRelativePaths = useMemo(
    () => vaultTreeEntries.filter((vaultTreeEntry) => vaultTreeEntry.vaultEntryKind === 'note').map((vaultTreeEntry) => vaultTreeEntry.vaultEntryRelativePath),
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
        showWorkspaceNotice('error', `Couldn’t open “${linkHref.replace(/\.md$/i, '')}” (Note Not Found)`)
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

  if (openVault === null) return null

  if (activeVaultNoteRelativePath === null || activeLoadedVaultNote === undefined) {
    return (
      <div id="papeliz-note-panel" className="grid flex-1 place-items-center overflow-auto px-6 py-10 text-center">
        <div className="max-w-sm">
          <h2 className="text-[22px] font-medium tracking-[-0.01em]">No note open</h2>
          <p className="mt-2 text-papeliz-ink-muted">Pick a note from the list, or start a new one.</p>
          <PapelizPillButton pillButtonVariant="primary" className="mt-5" onClick={() => void createVaultNoteInFolder('')}>
            <FilePlus className="size-4" aria-hidden="true" />
            New note
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

  return (
    // Keyed by note, so each note opens scrolled to its top.
    <div
      key={activeLoadedVaultNote.loadedNoteSessionId}
      id="papeliz-note-panel"
      className={`min-h-0 flex-1 overflow-y-auto px-4 pt-6 sm:px-10 sm:pt-[30px] ${isFocusModeOn ? 'pb-64' : 'pb-24'}`}
    >
      <nav
        aria-label="Where this note is"
        className="mx-auto mb-[18px] flex flex-wrap items-center gap-0.5 text-[13px] text-papeliz-ink-subtle"
        style={{ maxWidth: 'calc(var(--papeliz-note-column-width) + 60px)' }}
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
          <PapelizPillButton pillButtonSize="small" className="mt-3 bg-papeliz-surface" onClick={() => void openVaultNote(activeVaultNoteRelativePath)}>
            <RotateCw className="size-[13px]" aria-hidden="true" />
            Try again
          </PapelizPillButton>
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
            // The text width from the "Aa" button; MD Code adds room for its line numbers.
            style={{ maxWidth: noteViewMode === 'md-code' ? 'calc(var(--papeliz-note-column-width) + 60px)' : 'var(--papeliz-note-column-width)' }}
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
