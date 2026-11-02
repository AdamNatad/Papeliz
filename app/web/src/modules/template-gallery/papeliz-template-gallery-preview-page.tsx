import type { EditorState } from '@codemirror/state'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { PapelizSyncFailureLine, PapelizSyncLoadingLine } from '../sync/papeliz-sync-page-parts'
import { PapelizVaultTextFileEditor } from '../text-file-view/papeliz-vault-text-file-editor'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { usePapelizFooterEqualButtonWidthRef } from '../ui/papeliz-footer-equal-button-width'
import { getVaultEntryName, getVaultEntryParentFolderRelativePath } from '../vault/papeliz-vault-relative-paths'
import { newVaultFormFooterActionButtonColorClassName, newVaultFormFooterButtonClassName, newVaultFormFooterCancelButtonColorClassName } from '../workspace/papeliz-new-vault-form'
import type { PapelizTemplateFileListEntry, PapelizTemplateGalleryRow } from './papeliz-template-gallery-contract'
import { PapelizTemplateGalleryNoteView } from './papeliz-template-gallery-note-view'
import {
  buildTemplateGalleryFileTree,
  classifyTemplateGalleryFile,
  isPapelizTemplateGalleryWorkerFeatureComingSoon,
  listTemplateGalleryFolderPathsTo,
  PapelizTemplateGalleryComingSoonPill,
  PapelizTemplateGalleryFileTree,
  PapelizTemplateGalleryRecheckButton,
  PapelizTemplateGalleryRecheckLine,
  papelizTemplateGalleryNoteSizeClassName,
  type PapelizTemplateGalleryScreenModel,
} from './papeliz-template-gallery-page-parts'

// A note's link to another file ("../TASKS.md", "notes/overview.md#rules") as a path in the template,
// from the folder of the note it's in; null for a link that leaves the template or isn't a path.
function resolveTemplateRelativeLink(linkHref: string, fromTemplateFilePath: string): string | null {
  let linkPathText: string
  try {
    linkPathText = decodeURIComponent(linkHref.split('#')[0] ?? '')
  } catch {
    return null
  }
  if (linkPathText.length === 0 || /^[a-z][a-z0-9+.-]*:/i.test(linkPathText) || linkPathText.startsWith('/')) return null
  const resolvedPathSegments = getVaultEntryParentFolderRelativePath(fromTemplateFilePath).split('/').filter((pathSegment) => pathSegment.length > 0)
  for (const linkPathSegment of linkPathText.split('/')) {
    if (linkPathSegment === '' || linkPathSegment === '.') continue
    if (linkPathSegment === '..') {
      if (resolvedPathSegments.length === 0) return null
      resolvedPathSegments.pop()
    } else {
      resolvedPathSegments.push(linkPathSegment)
    }
  }
  return resolvedPathSegments.join('/')
}

type PapelizTemplatePreviewFileRead =
  | { templatePreviewFileReadState: 'reading' }
  | { templatePreviewFileReadState: 'failed' }
  | { templatePreviewFileReadState: 'read'; templatePreviewFileText: string }

interface PapelizTemplateGalleryPreviewPageProps {
  templateGalleryPageHeadingId: string
  isTemplateGalleryPageHeadingFocusedFirst: boolean
  templateGalleryRow: PapelizTemplateGalleryRow
  templateGalleryScreenModel: PapelizTemplateGalleryScreenModel
  templateGalleryOpenedAt: number
  onTemplatePreviewClose: () => void
  onTemplateUse: () => void
}

// Preview: the template's files, read-only, at the commit Papeliz checked, before anything is made. The
// file tree on the left (above, on a phone) and the chosen file beside it, as the vault will open it:
// a note in MD View (its pictures only from where a template's may come), JSON and other text in MD
// Code, a picture as itself. It opens on the first note.
// "Checked … · commit …" and Recheck sit under the title; Cancel and Use Template in the footer.
// Nothing is saved until Use Template. Esc goes back.
export function PapelizTemplateGalleryPreviewPage({
  templateGalleryPageHeadingId,
  isTemplateGalleryPageHeadingFocusedFirst,
  templateGalleryRow,
  templateGalleryScreenModel,
  templateGalleryOpenedAt,
  onTemplatePreviewClose,
  onTemplateUse,
}: PapelizTemplateGalleryPreviewPageProps) {
  const { listTemplateIncludedFiles, readTemplateFileText, buildTemplatePictureUrl } = templateGalleryScreenModel
  const templatePreviewFooterRef = usePapelizFooterEqualButtonWidthRef(128)
  const templatePreviewHeadingRef = useRef<HTMLHeadingElement>(null)
  const [templateFileListEntries, setTemplateFileListEntries] = useState<readonly PapelizTemplateFileListEntry[] | 'reading' | 'failed'>('reading')
  const [chosenTemplateFilePath, setChosenTemplateFilePath] = useState(templateGalleryRow.templateFirstNotePath)
  const [templatePreviewFileReadsByPath, setTemplatePreviewFileReadsByPath] = useState<Readonly<Record<string, PapelizTemplatePreviewFileRead>>>({})
  // The read-only MD Code editors' states, one per text file opened here.
  const [templatePreviewEditorStatesByFileIndex] = useState(() => new Map<number, EditorState>())

  useEffect(() => {
    if (isTemplateGalleryPageHeadingFocusedFirst) templatePreviewHeadingRef.current?.focus({ preventScroll: true })
  }, [isTemplateGalleryPageHeadingFocusedFirst])

  useEffect(() => {
    let isTemplateFileListWanted = true
    void listTemplateIncludedFiles(templateGalleryRow).then(
      (includedFileListEntries) => {
        if (isTemplateFileListWanted) setTemplateFileListEntries(includedFileListEntries)
      },
      () => {
        if (isTemplateFileListWanted) setTemplateFileListEntries('failed')
      },
    )
    return () => {
      isTemplateFileListWanted = false
    }
  }, [templateGalleryRow, listTemplateIncludedFiles])

  const chosenTemplateFileKind = classifyTemplateGalleryFile(chosenTemplateFilePath)
  const chosenTemplateFileRead = templatePreviewFileReadsByPath[chosenTemplateFilePath]
  // A text file is read the first time it's chosen, and kept.
  useEffect(() => {
    if (chosenTemplateFileKind === 'picture' || chosenTemplateFileRead !== undefined) return
    let isTemplateFileTextWanted = true
    void readTemplateFileText(templateGalleryRow, chosenTemplateFilePath).then(
      (templatePreviewFileText) => {
        if (isTemplateFileTextWanted) {
          setTemplatePreviewFileReadsByPath((previousFileReads) => ({ ...previousFileReads, [chosenTemplateFilePath]: { templatePreviewFileReadState: 'read', templatePreviewFileText } }))
        }
      },
      () => {
        if (isTemplateFileTextWanted) setTemplatePreviewFileReadsByPath((previousFileReads) => ({ ...previousFileReads, [chosenTemplateFilePath]: { templatePreviewFileReadState: 'failed' } }))
      },
    )
    return () => {
      isTemplateFileTextWanted = false
    }
  }, [chosenTemplateFileKind, chosenTemplateFilePath, chosenTemplateFileRead, templateGalleryRow, readTemplateFileText])

  const readTemplateFileListEntries = typeof templateFileListEntries === 'string' ? null : templateFileListEntries
  const templateFileTree = useMemo(() => (readTemplateFileListEntries === null ? null : buildTemplateGalleryFileTree(readTemplateFileListEntries)), [readTemplateFileListEntries])
  const templateFilePaths = useMemo(() => new Set((readTemplateFileListEntries ?? []).map((templateFileListEntry) => templateFileListEntry.templateFileRelativePath)), [readTemplateFileListEntries])
  const resolveTemplateWikilinkTarget = useMemo(
    () => createPapelizWikilinkTargetResolver([...templateFilePaths].filter((templateFilePath) => classifyTemplateGalleryFile(templateFilePath) === 'note')),
    [templateFilePaths],
  )
  const chooseLinkedTemplateFile = (linkedTemplateFilePath: string | null) => {
    if (linkedTemplateFilePath !== null && templateFilePaths.has(linkedTemplateFilePath)) setChosenTemplateFilePath(linkedTemplateFilePath)
  }

  let chosenTemplateFileView: ReactNode
  if (chosenTemplateFileKind === 'picture') {
    chosenTemplateFileView = (
      <img
        src={buildTemplatePictureUrl(templateGalleryRow, chosenTemplateFilePath)}
        alt={getVaultEntryName(chosenTemplateFilePath)}
        referrerPolicy="no-referrer"
        className="max-h-[420px] max-w-full rounded-lg border border-papeliz-line object-contain"
      />
    )
  } else if (chosenTemplateFileRead === undefined || chosenTemplateFileRead.templatePreviewFileReadState === 'reading') {
    chosenTemplateFileView = <PapelizSyncLoadingLine>Reading the file…</PapelizSyncLoadingLine>
  } else if (chosenTemplateFileRead.templatePreviewFileReadState === 'failed') {
    chosenTemplateFileView = <PapelizSyncFailureLine>Couldn’t read this file. Check your connection, then choose it again.</PapelizSyncFailureLine>
  } else if (chosenTemplateFileKind === 'note') {
    chosenTemplateFileView = (
      <PapelizTemplateGalleryNoteView
        templateGalleryRow={templateGalleryRow}
        templateNoteText={chosenTemplateFileRead.templatePreviewFileText}
        templateNoteRelativePath={chosenTemplateFilePath}
        templateIncludedFileRelativePaths={readTemplateFileListEntries === null ? null : templateFilePaths}
        buildTemplatePictureUrl={buildTemplatePictureUrl}
        resolveWikilinkTarget={resolveTemplateWikilinkTarget}
        onWikilinkActivate={(wikilinkTargetNoteName) => chooseLinkedTemplateFile(resolveTemplateWikilinkTarget(wikilinkTargetNoteName, chosenTemplateFilePath))}
        onRelativeNoteLinkActivate={(linkHref) => chooseLinkedTemplateFile(resolveTemplateRelativeLink(linkHref, chosenTemplateFilePath))}
      />
    )
  } else {
    chosenTemplateFileView = (
      <PapelizVaultTextFileEditor
        key={chosenTemplateFilePath}
        loadedNoteSessionId={(readTemplateFileListEntries ?? []).findIndex((templateFileListEntry) => templateFileListEntry.templateFileRelativePath === chosenTemplateFilePath)}
        vaultTextFileText={chosenTemplateFileRead.templatePreviewFileText}
        vaultTextFileLanguage={chosenTemplateFileKind === 'json' ? 'json' : 'plain-text'}
        editorStatesByLoadedNoteSessionId={templatePreviewEditorStatesByFileIndex}
        isVaultTextFileEditingLocked
        onVaultTextFileTextChange={() => undefined}
      />
    )
  }

  return (
    <div
      onKeyDown={(keyDownEvent) => {
        if (keyDownEvent.key !== 'Escape' || keyDownEvent.defaultPrevented) return
        keyDownEvent.preventDefault()
        onTemplatePreviewClose()
      }}
      className="papeliz-welcome-enter flex min-h-0 flex-1 flex-col"
    >
      <div className="px-3 pt-[11px] pb-1">
        {/* The title, with Recheck at the top right, as on the template's page. */}
        <div className="flex min-w-0 items-center justify-between gap-2">
          <h2 ref={templatePreviewHeadingRef} id={templateGalleryPageHeadingId} tabIndex={-1} className="min-w-0 truncate text-[18px] font-semibold tracking-[-0.01em] focus:outline-none">
            Preview · {templateGalleryRow.templateName}
          </h2>
          <span className="flex flex-none items-center gap-2">
            {isPapelizTemplateGalleryWorkerFeatureComingSoon && <PapelizTemplateGalleryComingSoonPill />}
            <PapelizTemplateGalleryRecheckButton
              templateGalleryRow={templateGalleryRow}
              templateRecheckState={templateGalleryScreenModel.templateRecheckState}
              onTemplateRecheck={() => void templateGalleryScreenModel.recheckTemplate(templateGalleryRow.papelizTemplateGalleryId)}
              recheckButtonSize="page"
            />
          </span>
        </div>
        <p className="mt-0.5 mb-1 text-[12.5px] text-papeliz-ink-muted">Read-only. Nothing is saved until Use Template.</p>
        <PapelizTemplateGalleryRecheckLine
          templateGalleryRow={templateGalleryRow}
          templateRecheckState={templateGalleryScreenModel.templateRecheckState}
          templateGalleryOpenedAt={templateGalleryOpenedAt}
          onTemplateRecheck={() => void templateGalleryScreenModel.recheckTemplate(templateGalleryRow.papelizTemplateGalleryId)}
          isTemplateRecheckButtonInLine={false}
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto px-3 pt-2 pb-3 max-sm:grid-rows-[auto_minmax(0,1fr)] sm:grid-cols-[190px_minmax(0,1fr)] sm:overflow-hidden">
        <nav aria-label="Files" className="min-h-0 overflow-y-auto rounded-xl border border-papeliz-line bg-papeliz-surface p-1 max-sm:max-h-[184px]">
          {templateFileListEntries === 'reading' && (
            <div className="px-2">
              <PapelizSyncLoadingLine>Reading the files…</PapelizSyncLoadingLine>
            </div>
          )}
          {templateFileListEntries === 'failed' && <PapelizSyncFailureLine className="px-2 py-2">Couldn’t read the file list. Check your connection, then try again.</PapelizSyncFailureLine>}
          {templateFileTree !== null && (
            <PapelizTemplateGalleryFileTree
              templateFileTree={templateFileTree}
              chosenTemplateFileRelativePath={chosenTemplateFilePath}
              onTemplateFileChoose={setChosenTemplateFilePath}
              initiallyOpenTemplateFolderRelativePaths={listTemplateGalleryFolderPathsTo(templateGalleryRow.templateFirstNotePath)}
            />
          )}
        </nav>
        <section aria-label={`${chosenTemplateFilePath}, read-only`} className="min-h-[220px] min-w-0 overflow-y-auto rounded-xl border border-papeliz-line bg-papeliz-surface px-4 py-3 sm:min-h-0">
          <p className="mb-2 truncate font-mono text-[11px] text-papeliz-ink-subtle">{chosenTemplateFilePath}</p>
          <div className={joinPapelizClassNames(papelizTemplateGalleryNoteSizeClassName, chosenTemplateFileKind !== 'note' && '-mx-2')}>{chosenTemplateFileView}</div>
        </section>
      </div>

      <div ref={templatePreviewFooterRef} className="flex items-center justify-between gap-2 border-t border-papeliz-line p-3">
        <button type="button" onClick={onTemplatePreviewClose} className={joinPapelizClassNames(newVaultFormFooterButtonClassName, newVaultFormFooterCancelButtonColorClassName)}>
          Cancel
        </button>
        <button type="button" onClick={onTemplateUse} className={joinPapelizClassNames(newVaultFormFooterButtonClassName, newVaultFormFooterActionButtonColorClassName)}>
          Use Template
        </button>
      </div>
    </div>
  )
}
