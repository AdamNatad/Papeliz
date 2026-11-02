import { ExternalLink, Eye, Flag, SquareTerminal } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPapelizWikilinkTargetResolver } from '../links/papeliz-wikilink-targets'
import { PapelizSyncFailureLine, PapelizSyncLoadingLine } from '../sync/papeliz-sync-page-parts'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { usePapelizFooterEqualButtonWidthRef } from '../ui/papeliz-footer-equal-button-width'
import { newVaultFormFooterActionButtonColorClassName, newVaultFormFooterButtonClassName, newVaultFormFooterCancelButtonColorClassName } from '../workspace/papeliz-new-vault-form'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import type { PapelizTemplateFileListEntry, PapelizTemplateGalleryRow } from './papeliz-template-gallery-contract'
import { PapelizTemplateGalleryNoteView } from './papeliz-template-gallery-note-view'
import {
  buildTemplateGalleryFileTree,
  buildTemplateGalleryGitHubCommitUrl,
  classifyTemplateGalleryFile,
  describeTemplateGalleryFileCount,
  describeTemplateGalleryTag,
  formatTemplateGalleryByteSize,
  PapelizTemplateGalleryAuthorPicture,
  PapelizTemplateGalleryFileTree,
  PapelizTemplateGalleryLicenseTag,
  PapelizTemplateGalleryRecheckButton,
  PapelizTemplateGalleryRecheckLine,
  PapelizTemplateGalleryRowTags,
  PapelizTemplateGalleryThumbnail,
  PapelizTemplateGalleryVotePill,
  papelizTemplateGalleryNoteSizeClassName,
  type PapelizTemplateGalleryScreenModel,
} from './papeliz-template-gallery-page-parts'

// Reporting comes with the Templates server and a free Papeliz account.
const papelizTemplateGalleryReportingOffText = 'Reporting opens with the Templates server, with a free Papeliz account.'

// A read of the template's files, or of its first note.
type PapelizTemplatePageRead<TemplatePageReadValue> =
  | { templatePageReadState: 'reading' }
  | { templatePageReadState: 'failed' }
  | { templatePageReadState: 'read'; templatePageReadValue: TemplatePageReadValue }

interface PapelizTemplateGalleryTemplatePageProps {
  templateGalleryPageHeadingId: string
  isTemplateGalleryPageHeadingFocusedFirst: boolean
  templateGalleryRow: PapelizTemplateGalleryRow
  templateGalleryScreenModel: PapelizTemplateGalleryScreenModel
  templateGalleryOpenedAt: number
  onTemplatePageClose: () => void
  onTemplatePreviewOpen: () => void
  onTemplateUse: () => void
}

// A template's page, in place of the gallery: its name and tags, the author's picture and name, license
// and tags, the votes; "Checked … · commit …" with Recheck; the thumbnail, larger; its first note
// rendered read-only, with pictures only from where a template's may come;
// "What's inside", the file tree with each folder's count and size; View on GitHub, Preview and
// Report. Cancel at the left edge, Use Template at the right. Esc goes back.
export function PapelizTemplateGalleryTemplatePage({
  templateGalleryPageHeadingId,
  isTemplateGalleryPageHeadingFocusedFirst,
  templateGalleryRow,
  templateGalleryScreenModel,
  templateGalleryOpenedAt,
  onTemplatePageClose,
  onTemplatePreviewOpen,
  onTemplateUse,
}: PapelizTemplateGalleryTemplatePageProps) {
  const showWorkspaceNotice = usePapelizWorkspaceStore((workspaceState) => workspaceState.showWorkspaceNotice)
  const templatePageFooterRef = usePapelizFooterEqualButtonWidthRef(128)
  const templatePageHeadingRef = useRef<HTMLHeadingElement>(null)
  const [templateFilesRead, setTemplateFilesRead] = useState<PapelizTemplatePageRead<readonly PapelizTemplateFileListEntry[]>>({ templatePageReadState: 'reading' })
  const [templateFirstNoteRead, setTemplateFirstNoteRead] = useState<PapelizTemplatePageRead<string>>({ templatePageReadState: 'reading' })
  const { listTemplateIncludedFiles, readTemplateFileText } = templateGalleryScreenModel

  useEffect(() => {
    if (isTemplateGalleryPageHeadingFocusedFirst) templatePageHeadingRef.current?.focus({ preventScroll: true })
  }, [isTemplateGalleryPageHeadingFocusedFirst])

  // The files and the first note, read once the page opens (and again after Recheck moves the commit).
  useEffect(() => {
    let isTemplatePageReadWanted = true
    void listTemplateIncludedFiles(templateGalleryRow).then(
      (templateFileListEntries) => {
        if (isTemplatePageReadWanted) setTemplateFilesRead({ templatePageReadState: 'read', templatePageReadValue: templateFileListEntries })
      },
      () => {
        if (isTemplatePageReadWanted) setTemplateFilesRead({ templatePageReadState: 'failed' })
      },
    )
    void readTemplateFileText(templateGalleryRow, templateGalleryRow.templateFirstNotePath).then(
      (templateFirstNoteText) => {
        if (isTemplatePageReadWanted) setTemplateFirstNoteRead({ templatePageReadState: 'read', templatePageReadValue: templateFirstNoteText })
      },
      () => {
        if (isTemplatePageReadWanted) setTemplateFirstNoteRead({ templatePageReadState: 'failed' })
      },
    )
    return () => {
      isTemplatePageReadWanted = false
    }
  }, [templateGalleryRow, listTemplateIncludedFiles, readTemplateFileText])

  const templateFileListEntries = templateFilesRead.templatePageReadState === 'read' ? templateFilesRead.templatePageReadValue : null
  const templateFileTree = useMemo(() => (templateFileListEntries === null ? null : buildTemplateGalleryFileTree(templateFileListEntries)), [templateFileListEntries])
  const templateIncludedFileRelativePaths = useMemo(
    () => (templateFileListEntries === null ? null : new Set(templateFileListEntries.map((templateFileListEntry) => templateFileListEntry.templateFileRelativePath))),
    [templateFileListEntries],
  )
  const resolveTemplateWikilinkTarget = useMemo(
    () =>
      createPapelizWikilinkTargetResolver(
        (templateFileListEntries ?? [])
          .map((templateFileListEntry) => templateFileListEntry.templateFileRelativePath)
          .filter((templateFileRelativePath) => classifyTemplateGalleryFile(templateFileRelativePath) === 'note'),
      ),
    [templateFileListEntries],
  )
  const templateTagLine = templateGalleryRow.templateTags.map(describeTemplateGalleryTag).join(', ')

  return (
    <div
      onKeyDown={(keyDownEvent) => {
        if (keyDownEvent.key !== 'Escape' || keyDownEvent.defaultPrevented) return
        keyDownEvent.preventDefault()
        onTemplatePageClose()
      }}
      className="papeliz-welcome-enter flex min-h-0 flex-1 flex-col"
    >
      <div className="flex items-start justify-between gap-2 px-3 pt-[11px] pb-1">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h2 ref={templatePageHeadingRef} id={templateGalleryPageHeadingId} tabIndex={-1} className="min-w-0 truncate text-[18px] font-semibold tracking-[-0.01em] focus:outline-none">
              {templateGalleryRow.templateName}
            </h2>
            <PapelizTemplateGalleryRowTags templateGalleryRow={templateGalleryRow} currentTime={templateGalleryOpenedAt} />
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-papeliz-ink-muted">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <PapelizTemplateGalleryAuthorPicture
                templateRepositoryOwner={templateGalleryRow.templateRepositoryOwner}
                authorPictureSize={18}
                buildTemplateAuthorPictureUrl={templateGalleryScreenModel.buildTemplateAuthorPictureUrl}
              />
              <span className="truncate">{templateGalleryRow.templateRepositoryOwner}</span>
            </span>
            <span aria-hidden="true">·</span>
            <PapelizTemplateGalleryLicenseTag templateLicenseId={templateGalleryRow.templateLicenseId} />
            {templateTagLine.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>{templateTagLine}</span>
              </>
            )}
          </p>
        </div>
        {/* Recheck and the votes, together at the top right. */}
        <div className="flex flex-none items-center gap-2">
          <PapelizTemplateGalleryRecheckButton
            templateGalleryRow={templateGalleryRow}
            templateRecheckState={templateGalleryScreenModel.templateRecheckState}
            onTemplateRecheck={() => void templateGalleryScreenModel.recheckTemplate(templateGalleryRow.papelizTemplateGalleryId)}
            recheckButtonSize="page"
          />
          <PapelizTemplateGalleryVotePill templateGalleryRow={templateGalleryRow} votePillSize="page" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pt-2 pb-3">
        <PapelizTemplateGalleryRecheckLine
          templateGalleryRow={templateGalleryRow}
          templateRecheckState={templateGalleryScreenModel.templateRecheckState}
          templateGalleryOpenedAt={templateGalleryOpenedAt}
          onTemplateRecheck={() => void templateGalleryScreenModel.recheckTemplate(templateGalleryRow.papelizTemplateGalleryId)}
          isTemplateRecheckButtonInLine={false}
        />
        {templateGalleryRow.isTemplateRunningCommands && (
          <p className="flex items-start gap-2 rounded-xl bg-papeliz-warning px-3 py-2 text-[12px] leading-[1.45] text-papeliz-warning-ink">
            <SquareTerminal className="mt-px size-3.5 flex-none" aria-hidden="true" />
            Its agent settings or scripts name commands. Papeliz never runs them, and Use Template shows each one before the vault is made.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_210px]">
          <div className="flex min-w-0 flex-col gap-2.5">
            <PapelizTemplateGalleryThumbnail templateGalleryRow={templateGalleryRow} templateThumbnailSize="page" />
            {templateGalleryRow.templateDescription.length > 0 && <p className="text-[13px] leading-[1.5] text-papeliz-ink">{templateGalleryRow.templateDescription}</p>}
            <section aria-label={`${templateGalleryRow.templateFirstNotePath}, read-only`} className="rounded-xl border border-papeliz-line bg-papeliz-surface px-4 py-3">
              <p className="mb-2 truncate font-mono text-[11px] text-papeliz-ink-subtle">{templateGalleryRow.templateFirstNotePath}</p>
              {templateFirstNoteRead.templatePageReadState === 'reading' && <PapelizSyncLoadingLine>Reading the note…</PapelizSyncLoadingLine>}
              {templateFirstNoteRead.templatePageReadState === 'failed' && <PapelizSyncFailureLine>Couldn’t read this note. Check your connection, then try again.</PapelizSyncFailureLine>}
              {templateFirstNoteRead.templatePageReadState === 'read' && (
                <div className={papelizTemplateGalleryNoteSizeClassName}>
                  <PapelizTemplateGalleryNoteView
                    templateGalleryRow={templateGalleryRow}
                    templateNoteText={templateFirstNoteRead.templatePageReadValue}
                    templateNoteRelativePath={templateGalleryRow.templateFirstNotePath}
                    templateIncludedFileRelativePaths={templateIncludedFileRelativePaths}
                    buildTemplatePictureUrl={templateGalleryScreenModel.buildTemplatePictureUrl}
                    resolveWikilinkTarget={resolveTemplateWikilinkTarget}
                    onWikilinkActivate={onTemplatePreviewOpen}
                    onRelativeNoteLinkActivate={onTemplatePreviewOpen}
                  />
                </div>
              )}
            </section>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] font-semibold">
              <a
                href={buildTemplateGalleryGitHubCommitUrl(templateGalleryRow)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded text-papeliz-blue underline-offset-2 hover:underline pointer-coarse:py-2"
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                View on GitHub
              </a>
              <button type="button" onClick={onTemplatePreviewOpen} className="inline-flex items-center gap-1.5 rounded text-papeliz-blue underline-offset-2 hover:underline pointer-coarse:py-2">
                <Eye className="size-3.5" aria-hidden="true" />
                Preview
              </button>
              <button
                type="button"
                title={papelizTemplateGalleryReportingOffText}
                onClick={() => showWorkspaceNotice('info', papelizTemplateGalleryReportingOffText)}
                className="inline-flex items-center gap-1.5 rounded text-papeliz-ink-muted underline-offset-2 hover:text-papeliz-ink hover:underline pointer-coarse:py-2"
              >
                <Flag className="size-3.5" aria-hidden="true" />
                Report
              </button>
            </div>
          </div>
          <section aria-labelledby={`${templateGalleryPageHeadingId}-whats-inside`} className="h-fit rounded-xl border border-papeliz-line bg-papeliz-surface px-1.5 py-2">
            <h3 id={`${templateGalleryPageHeadingId}-whats-inside`} className="px-1.5 pb-1 text-[12.5px] font-semibold">
              What’s inside
              <span className="block text-[11.5px] font-normal text-papeliz-ink-subtle tabular-nums">
                {describeTemplateGalleryFileCount(templateFileListEntries?.length ?? templateGalleryRow.templateIncludedFileCount)} ·{' '}
                {formatTemplateGalleryByteSize(
                  templateFileListEntries?.reduce((templateByteTotal, templateFileListEntry) => templateByteTotal + templateFileListEntry.templateFileByteCount, 0) ??
                    templateGalleryRow.templateIncludedByteCount,
                )}
              </span>
            </h3>
            {templateFilesRead.templatePageReadState === 'reading' && (
              <div className="px-1.5">
                <PapelizSyncLoadingLine>Reading the files…</PapelizSyncLoadingLine>
              </div>
            )}
            {templateFilesRead.templatePageReadState === 'failed' && <PapelizSyncFailureLine className="px-1.5">Couldn’t read the file list.</PapelizSyncFailureLine>}
            {templateFileTree !== null && <PapelizTemplateGalleryFileTree templateFileTree={templateFileTree} initiallyOpenTemplateFolderRelativePaths={new Set()} />}
          </section>
        </div>
      </div>

      {/* Cancel at the left edge, Use Template at the right, as in New Vault's form. */}
      <div ref={templatePageFooterRef} className="flex items-center justify-between gap-2 border-t border-papeliz-line p-3">
        <button type="button" onClick={onTemplatePageClose} className={joinPapelizClassNames(newVaultFormFooterButtonClassName, newVaultFormFooterCancelButtonColorClassName)}>
          Cancel
        </button>
        <button type="button" onClick={onTemplateUse} className={joinPapelizClassNames(newVaultFormFooterButtonClassName, newVaultFormFooterActionButtonColorClassName)}>
          Use Template
        </button>
      </div>
    </div>
  )
}
