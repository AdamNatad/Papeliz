import { EditorView } from '@codemirror/view'
import { ChevronRight, FileText, Link2, List } from 'lucide-react'
import { useMemo, useSyncExternalStore } from 'react'
import { findPapelizVaultNoteBacklinks } from '../links/papeliz-vault-note-index'
import type { PapelizNoteEditorSessionCache } from '../note-editor/papeliz-note-editor'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizSlidingChoiceGroup } from '../ui/papeliz-sliding-choice-group'
import { getVaultEntryParentFolderRelativePath, getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import { usePapelizFileListThisNoteStore, type PapelizFileListThisNoteView } from './papeliz-file-list-this-note-store'
import { usePapelizVaultKnowledgeStore } from './papeliz-vault-knowledge-store'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

interface PapelizFileListThisNoteSectionProps {
  noteEditorSessionCache: PapelizNoteEditorSessionCache
}

function subscribeToDocumentSelectionChange(onDocumentSelectionChange: () => void): () => void {
  document.addEventListener('selectionchange', onDocumentSelectionChange)
  return () => document.removeEventListener('selectionchange', onDocumentSelectionChange)
}

// The open note's headings. The heading the cursor is under is marked, and a click moves there.
function PapelizThisNoteOutlineList({ noteEditorSessionCache }: PapelizFileListThisNoteSectionProps) {
  const activeVaultNoteRelativePath = usePapelizWorkspaceStore((workspaceState) => workspaceState.activeVaultNoteRelativePath)
  const vaultNoteHeadings = usePapelizVaultKnowledgeStore((knowledgeState) =>
    activeVaultNoteRelativePath === null ? undefined : knowledgeState.vaultNoteIndexEntriesByRelativePath[activeVaultNoteRelativePath]?.vaultNoteHeadings,
  )
  // The cursor's line in the note being edited; none on the locked page.
  const cursorLineNumber = useSyncExternalStore(subscribeToDocumentSelectionChange, () => {
    const activeNoteEditorView = noteEditorSessionCache.activeNoteEditorView.current
    return activeNoteEditorView === null ? null : activeNoteEditorView.state.doc.lineAt(activeNoteEditorView.state.selection.main.head).number
  })

  const goToNoteHeading = (noteHeadingIndex: number, noteHeadingLineNumber: number) => {
    const activeNoteEditorView = noteEditorSessionCache.activeNoteEditorView.current
    if (activeNoteEditorView !== null && noteHeadingLineNumber <= activeNoteEditorView.state.doc.lines) {
      const headingLineStart = activeNoteEditorView.state.doc.line(noteHeadingLineNumber).from
      activeNoteEditorView.dispatch({ selection: { anchor: headingLineStart }, effects: EditorView.scrollIntoView(headingLineStart, { y: 'start', yMargin: 32 }) })
      activeNoteEditorView.focus()
      return
    }
    // MD View with the lock on: the page's headings, in the same order.
    const renderedPageHeadings = document.querySelectorAll<HTMLElement>(
      '.papeliz-md-view-article h1, .papeliz-md-view-article h2, .papeliz-md-view-article h3, .papeliz-md-view-article h4, .papeliz-md-view-article h5, .papeliz-md-view-article h6',
    )
    renderedPageHeadings[noteHeadingIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (vaultNoteHeadings === undefined || vaultNoteHeadings.length === 0) {
    return <p className="px-2.5 py-1.5 text-[13px] text-papeliz-ink-subtle">No headings yet. Lines starting with # become the outline.</p>
  }
  const shallowestHeadingDepth = Math.min(...vaultNoteHeadings.map((noteHeading) => noteHeading.noteHeadingDepth))
  let headingIndexAtCursor = -1
  if (cursorLineNumber !== null) {
    vaultNoteHeadings.forEach((noteHeading, noteHeadingIndex) => {
      if (noteHeading.noteHeadingLineNumber <= cursorLineNumber) headingIndexAtCursor = noteHeadingIndex
    })
  }
  return (
    <nav aria-label="Outline">
      <ul className="flex flex-col gap-px">
        {vaultNoteHeadings.map((noteHeading, noteHeadingIndex) => {
          const isHeadingAtCursor = noteHeadingIndex === headingIndexAtCursor
          return (
            <li key={`${noteHeading.noteHeadingLineNumber}-${noteHeading.noteHeadingText}`}>
              <button
                type="button"
                aria-current={isHeadingAtCursor ? 'location' : undefined}
                onClick={() => goToNoteHeading(noteHeadingIndex, noteHeading.noteHeadingLineNumber)}
                className={joinPapelizClassNames(
                  'block w-full truncate rounded-full py-1 pr-3 text-left text-[13.5px] transition-colors',
                  isHeadingAtCursor ? 'bg-papeliz-chosen-row-ground text-papeliz-chosen-row-ink' : 'hover:bg-papeliz-hover',
                )}
                style={{ paddingLeft: 10 + (noteHeading.noteHeadingDepth - shallowestHeadingDepth) * 14 }}
              >
                <span
                  className={joinPapelizClassNames(
                    noteHeading.noteHeadingDepth === shallowestHeadingDepth && 'font-semibold',
                    noteHeading.noteHeadingDepth !== shallowestHeadingDepth && !isHeadingAtCursor && 'text-papeliz-ink-muted',
                  )}
                >
                  {noteHeading.noteHeadingText || '(untitled heading)'}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// Every note that links to the open one. A click opens it.
function PapelizThisNoteBacklinksList({ vaultNoteBacklinks }: { vaultNoteBacklinks: ReturnType<typeof findPapelizVaultNoteBacklinks> }) {
  const activeVaultNoteRelativePath = usePapelizWorkspaceStore((workspaceState) => workspaceState.activeVaultNoteRelativePath)
  const openVaultNote = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVaultNote)
  if (vaultNoteBacklinks.length === 0) {
    return (
      <p className="px-2.5 py-1.5 text-[13px] text-papeliz-ink-subtle">
        No notes link to {activeVaultNoteRelativePath === null ? 'this note' : getVaultNoteTitle(activeVaultNoteRelativePath)} yet.
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-px">
      {vaultNoteBacklinks.map((vaultNoteBacklink) => (
        <li key={vaultNoteBacklink.linkingVaultNoteRelativePath}>
          <button
            type="button"
            onClick={() => void openVaultNote(vaultNoteBacklink.linkingVaultNoteRelativePath)}
            className="flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-1.5 text-left transition-colors hover:bg-papeliz-hover"
          >
            <FileText className="size-4 flex-none text-papeliz-ink-subtle" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium">{getVaultNoteTitle(vaultNoteBacklink.linkingVaultNoteRelativePath)}</span>
              <span className="block truncate text-xs text-papeliz-ink-subtle">
                {getVaultEntryParentFolderRelativePath(vaultNoteBacklink.linkingVaultNoteRelativePath) || 'Vault'}
              </span>
            </span>
            {vaultNoteBacklink.linkCount > 1 && <span className="text-xs text-papeliz-ink-subtle">{vaultNoteBacklink.linkCount} links</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}

// This note, at the foot of the file list: the open note's Outline and its Backlinks, which are
// about the note rather than the AI. It folds down to its heading, and the fold is remembered.
export function PapelizFileListThisNoteSection({ noteEditorSessionCache }: PapelizFileListThisNoteSectionProps) {
  const activeVaultNoteRelativePath = usePapelizWorkspaceStore((workspaceState) => workspaceState.activeVaultNoteRelativePath)
  const vaultNoteIndexEntriesByRelativePath = usePapelizVaultKnowledgeStore((knowledgeState) => knowledgeState.vaultNoteIndexEntriesByRelativePath)
  const isThisNoteSectionFolded = usePapelizFileListThisNoteStore((thisNoteState) => thisNoteState.isThisNoteSectionFolded)
  const thisNoteSectionView = usePapelizFileListThisNoteStore((thisNoteState) => thisNoteState.thisNoteSectionView)
  const setThisNoteSectionFolded = usePapelizFileListThisNoteStore((thisNoteState) => thisNoteState.setThisNoteSectionFolded)
  const setThisNoteSectionView = usePapelizFileListThisNoteStore((thisNoteState) => thisNoteState.setThisNoteSectionView)
  const vaultNoteBacklinks = useMemo(
    () =>
      activeVaultNoteRelativePath === null ? [] : findPapelizVaultNoteBacklinks(Object.values(vaultNoteIndexEntriesByRelativePath), activeVaultNoteRelativePath),
    [activeVaultNoteRelativePath, vaultNoteIndexEntriesByRelativePath],
  )

  if (activeVaultNoteRelativePath === null) return null
  const backlinksLabel = vaultNoteBacklinks.length > 0 ? `Backlinks ${vaultNoteBacklinks.length}` : 'Backlinks'
  return (
    <section aria-label="This note" className="-mx-2.5 flex-none border-t border-papeliz-line px-2.5 pt-1.5">
      <button
        type="button"
        aria-expanded={!isThisNoteSectionFolded}
        onClick={() => setThisNoteSectionFolded(!isThisNoteSectionFolded)}
        className="flex h-8 w-full items-center gap-1.5 rounded-full px-2 text-left text-[13px] font-semibold text-papeliz-ink transition-colors hover:bg-papeliz-hover"
      >
        <ChevronRight
          className={joinPapelizClassNames(
            'size-[15px] flex-none text-papeliz-ink-subtle transition-transform duration-200 ease-[var(--ease-papeliz-out)]',
            !isThisNoteSectionFolded && 'rotate-90',
          )}
          aria-hidden="true"
        />
        This note
        {isThisNoteSectionFolded && <span className="ml-auto truncate text-[12px] font-normal text-papeliz-ink-subtle">Outline · {backlinksLabel}</span>}
      </button>
      <div className="papeliz-file-list-this-note-body" data-papeliz-this-note-folded={isThisNoteSectionFolded} inert={isThisNoteSectionFolded}>
        <div>
          <div className="pt-1.5 pb-1.5">
            <PapelizSlidingChoiceGroup<PapelizFileListThisNoteView>
              slidingChoiceGroupLabel="This note"
              slidingChoiceGroupRole="tablist"
              slidingChoiceGroupTone="solid-blue"
              chosenSlidingChoiceValue={thisNoteSectionView}
              onSlidingChoiceSelect={setThisNoteSectionView}
              slidingChoices={[
                {
                  slidingChoiceValue: 'outline',
                  slidingChoiceContent: (
                    <>
                      <List className="size-3.5" aria-hidden="true" />
                      <span className="truncate">Outline</span>
                    </>
                  ),
                },
                {
                  slidingChoiceValue: 'backlinks',
                  slidingChoiceContent: (
                    <>
                      <Link2 className="size-3.5" aria-hidden="true" />
                      <span className="truncate">{backlinksLabel}</span>
                    </>
                  ),
                },
              ]}
            />
          </div>
          <div className="max-h-[min(240px,30vh)] overflow-y-auto pb-1">
            {thisNoteSectionView === 'outline' ? (
              <PapelizThisNoteOutlineList noteEditorSessionCache={noteEditorSessionCache} />
            ) : (
              <PapelizThisNoteBacklinksList vaultNoteBacklinks={vaultNoteBacklinks} />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
