import { FolderOpen, FolderPlus, TriangleAlert } from 'lucide-react'
import { useId, useState } from 'react'
import { PapelizSyncFailureLine, PapelizSyncLoadingLine } from '../sync/papeliz-sync-page-parts'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { usePapelizFooterEqualButtonWidthRef } from '../ui/papeliz-footer-equal-button-width'
import { usePapelizLoadingStartedAtMilliseconds } from '../ui/papeliz-loading-clock'
import type { PapelizLoadingStep } from '../ui/papeliz-loading-progress-count'
import { PapelizLoadingReadout } from '../ui/papeliz-loading-readout'
import { PapelizSolidCircleCheckIcon } from '../ui/papeliz-solid-circle-icons'
import { newVaultFormFooterActionButtonColorClassName, newVaultFormFooterButtonClassName, newVaultFormFooterCancelButtonColorClassName, type PapelizNewVaultPlace } from '../workspace/papeliz-new-vault-form'
import { describePapelizTemplateHiddenCharacter, splitPapelizTemplateTextAtHiddenCharacters } from './papeliz-template-gallery-checks'
import { PapelizTemplateGalleryFilesChoice } from './papeliz-template-gallery-files-choice'
import type { PapelizTemplateGalleryRow, PapelizTemplateRunCommand, PapelizTemplateUseState } from './papeliz-template-gallery-contract'
import {
  describeTemplateFileReadProgress,
  describeTemplateGalleryFileCount,
  describeTemplateGalleryRowDetail,
  PapelizTemplateGalleryCenteredStep,
  PapelizTemplateGalleryCheckResultList,
  PapelizTemplateGalleryThumbnail,
} from './papeliz-template-gallery-page-parts'

// Use Template's own pages and lines: the commands a template names, to read before going on; how
// reading and checking its files is going, at the top of New Vault's form; and the vault being made.

// A template's files written, counted, then what opens once they are all written.
function describeTemplateWritingSteps(areTemplateFilesWritten: boolean, templateWrittenFileCount: number, templateFileCount: number, openingStepLabel: string): PapelizLoadingStep[] {
  return [
    {
      loadingStepLabel: 'Writing the files',
      loadingStepState: areTemplateFilesWritten ? 'done' : 'running',
      loadingStepWeight: 9,
      loadingStepDoneUnitCount: templateWrittenFileCount,
      loadingStepUnitCount: templateFileCount,
      loadingStepUnitWord: templateFileCount === 1 ? 'file' : 'files',
    },
    { loadingStepLabel: openingStepLabel, loadingStepState: areTemplateFilesWritten ? 'running' : 'waiting' },
  ]
}

// "Reading and checking the files… 12 of 40 files", while Use Template prepares.
function PapelizTemplateUsePreparingLine({ templateUseState }: { templateUseState: Extract<PapelizTemplateUseState, { templateUseStage: 'preparing' }> }) {
  const templateFileReadProgressText = describeTemplateFileReadProgress(templateUseState.templateFileReadProgress)
  return <PapelizSyncLoadingLine>Reading and checking the files…{templateFileReadProgressText.length > 0 && ` ${templateFileReadProgressText}`}</PapelizSyncLoadingLine>
}

// Why no vault can be made from the template, with the checks that failed.
function PapelizTemplateUseFailedLines({ templateUseState }: { templateUseState: Extract<PapelizTemplateUseState, { templateUseStage: 'failed' }> }) {
  return (
    <div className="flex flex-col gap-2">
      <PapelizSyncFailureLine>{templateUseState.templateUseProblemSentence}</PapelizSyncFailureLine>
      {templateUseState.templateCheckReport !== null && <PapelizTemplateGalleryCheckResultList templateCheckResults={templateUseState.templateCheckReport.templateCheckResults} isOnlyFailedCheckShown />}
    </div>
  )
}

// Under "From …" in New Vault's form and on Import from Template: reading and checking, then, for a
// template with optional files, Recommended, All or Choose over its folder tree, then what goes in
// (with the hidden files Sync won't carry and any picture left out), or why it can't.
export function PapelizTemplateGalleryNewVaultTemplateStatus({
  templateUseState,
  onTemplateOptionalFilesChoose,
}: {
  templateUseState: PapelizTemplateUseState
  onTemplateOptionalFilesChoose?: (chosenTemplateOptionalFileRelativePaths: readonly string[]) => void
}) {
  switch (templateUseState.templateUseStage) {
    case 'idle':
      return null
    case 'preparing':
      return <PapelizTemplateUsePreparingLine templateUseState={templateUseState} />
    case 'failed':
      return <PapelizTemplateUseFailedLines templateUseState={templateUseState} />
    case 'picking-folder':
    case 'making-vault':
    case 'made':
    case 'importing-into-vault':
    case 'imported-into-vault':
      return null
    case 'ready': {
      const { templateHiddenFileRelativePaths, templateLeftOutPictureRelativePaths, templateFilesChoices, templateCheckReport } = templateUseState
      // A ready state without the choice (a made-up screen) means All.
      const chosenTemplateOptionalFileRelativePaths = templateUseState.chosenTemplateOptionalFileRelativePaths ?? templateFilesChoices?.templateOptionalFileRelativePaths ?? []
      const incomingTemplateFileCount =
        templateFilesChoices === undefined
          ? templateCheckReport.templateIncludedFileRelativePaths.length
          : templateFilesChoices.recommendedTemplateFileCount + chosenTemplateOptionalFileRelativePaths.length
      return (
        <div className="flex flex-col gap-2">
          {templateFilesChoices?.hasTemplateOptionalFiles === true && onTemplateOptionalFilesChoose !== undefined && (
            <PapelizTemplateGalleryFilesChoice
              templateName={templateUseState.templateGalleryRow.templateName}
              templateIncludedFileRelativePaths={templateCheckReport.templateIncludedFileRelativePaths}
              templateOptionalFileRelativePaths={templateFilesChoices.templateOptionalFileRelativePaths}
              chosenTemplateOptionalFileRelativePaths={chosenTemplateOptionalFileRelativePaths}
              onChosenTemplateOptionalFilesChange={onTemplateOptionalFilesChoose}
            />
          )}
          <div className="flex flex-col gap-1 text-[12px] leading-[1.45] text-papeliz-ink-muted">
            <p className="flex items-center gap-1.5">
              <PapelizSolidCircleCheckIcon className="size-3.5 flex-none text-papeliz-ok" />
              Checked: {describeTemplateGalleryFileCount(incomingTemplateFileCount)} go into the vault.
            </p>
            {templateHiddenFileRelativePaths.length > 0 && (
              <p>
                {templateHiddenFileRelativePaths.join(', ')} {templateHiddenFileRelativePaths.length === 1 ? 'stays' : 'stay'} on this device. Sync doesn’t carry hidden files.
              </p>
            )}
            {templateLeftOutPictureRelativePaths.length > 0 && (
              <p>
                Left out, since its information couldn’t be removed: {templateLeftOutPictureRelativePaths.join(', ')}.
              </p>
            )}
          </div>
        </div>
      )
    }
  }
}

// Where a command comes from, at the left of its line.
function describeTemplateRunCommandSource(templateRunCommand: PapelizTemplateRunCommand): string {
  const { templateRunCommandSourceRelativePath } = templateRunCommand
  switch (templateRunCommand.templateRunCommandKind) {
    case 'script-file':
      return 'Script'
    case 'agent-command-file':
      return 'Agent commands file'
    case 'agent-setting-command':
      return `${templateRunCommandSourceRelativePath} · command`
    case 'agent-setting-environment':
      return `${templateRunCommandSourceRelativePath} · environment`
    case 'agent-setting-permission':
      return `${templateRunCommandSourceRelativePath} · allows`
    case 'agent-setting-plugin':
      return `${templateRunCommandSourceRelativePath} · plugin`
  }
}

// A command's text with every hidden character shown as a small amber mark with its code ("U+202E")
// in its place, so nothing in it is invisible or turned around.
function PapelizTemplateRunCommandMarkedText({ templateRunCommandText }: { templateRunCommandText: string }) {
  return (
    <>
      {splitPapelizTemplateTextAtHiddenCharacters(templateRunCommandText).map((templateTextPiece, templateTextPieceIndex) =>
        templateTextPiece.isTemplateTextPieceHiddenCharacter ? (
          <mark
            key={templateTextPieceIndex}
            title={`A hidden character, ${describePapelizTemplateHiddenCharacter(templateTextPiece.templateTextPieceText)}`}
            className="mx-px rounded-[3px] bg-papeliz-warning px-[3px] font-sans text-[10px] font-bold text-papeliz-warning-ink"
          >
            {describePapelizTemplateHiddenCharacter(templateTextPiece.templateTextPieceText)}
          </mark>
        ) : (
          <span key={templateTextPieceIndex}>{templateTextPiece.templateTextPieceText}</span>
        ),
      )}
    </>
  )
}

interface PapelizTemplateGalleryCommandsPageProps {
  templateGalleryPageHeadingId: string
  templateGalleryRow: PapelizTemplateGalleryRow
  templateUseState: PapelizTemplateUseState
  onTemplateCommandsCancel: () => void
  // Read and ticked: New Vault's form comes next.
  onTemplateCommandsAccept: () => void
}

// "This template runs commands": every command its agent settings name and every script it brings,
// with where each is, once its files are read and checked. Papeliz runs none of them. Continue stays
// off until "I've read these commands" is ticked. Esc goes back.
export function PapelizTemplateGalleryCommandsPage({ templateGalleryPageHeadingId, templateGalleryRow, templateUseState, onTemplateCommandsCancel, onTemplateCommandsAccept }: PapelizTemplateGalleryCommandsPageProps) {
  const templateCommandsFooterRef = usePapelizFooterEqualButtonWidthRef(128)
  const templateCommandsTickId = useId()
  const [isTemplateCommandsReadTicked, setTemplateCommandsReadTicked] = useState(false)
  const readyTemplateUseState = templateUseState.templateUseStage === 'ready' ? templateUseState : null

  return (
    <div
      onKeyDown={(keyDownEvent) => {
        if (keyDownEvent.key !== 'Escape' || keyDownEvent.defaultPrevented) return
        keyDownEvent.preventDefault()
        onTemplateCommandsCancel()
      }}
      className="papeliz-welcome-enter flex min-h-0 flex-1 flex-col"
    >
      <div className="px-3 pt-[11px] pb-1">
        <div className="flex items-center gap-2">
          <h2 id={templateGalleryPageHeadingId} className="text-[18px] font-semibold tracking-[-0.01em]">
            This template runs commands
          </h2>
        </div>
        <p className="mt-0.5 text-[12.5px] text-papeliz-ink-muted">
          {templateGalleryRow.templateName} · {templateGalleryRow.templateRepositoryOwner}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 pt-2.5 pb-3">
        <p className="flex items-start gap-2 rounded-xl bg-papeliz-warning px-3 py-2.5 text-[12.5px] leading-[1.45] text-papeliz-warning-ink">
          <TriangleAlert className="mt-px size-4 flex-none" aria-hidden="true" />
          Papeliz never runs these. A coding agent you open this vault with may run them on your computer. Read each one before you go on.
        </p>
        {templateUseState.templateUseStage === 'preparing' && <PapelizTemplateUsePreparingLine templateUseState={templateUseState} />}
        {templateUseState.templateUseStage === 'failed' && <PapelizTemplateUseFailedLines templateUseState={templateUseState} />}
        {readyTemplateUseState !== null && (
          <>
            {readyTemplateUseState.templateRunCommands.length === 0 ? (
              <p className="px-0.5 text-[12.5px] text-papeliz-ink-muted">Its files, checked just now, name no commands.</p>
            ) : (
              <ul aria-label="Commands" className="divide-y divide-papeliz-line rounded-xl border border-papeliz-line bg-papeliz-surface">
                {readyTemplateUseState.templateRunCommands.map((templateRunCommand, templateRunCommandIndex) => (
                  <li
                    key={`${templateRunCommandIndex}\n${templateRunCommand.templateRunCommandSourceRelativePath}\n${templateRunCommand.templateRunCommandText}`}
                    className="grid gap-x-3 gap-y-0.5 px-3 py-2 text-[12px] sm:grid-cols-[minmax(0,190px)_minmax(0,1fr)] sm:items-center"
                  >
                    <span className="truncate text-papeliz-ink-muted" dir="ltr" title={describeTemplateRunCommandSource(templateRunCommand)}>
                      <PapelizTemplateRunCommandMarkedText templateRunCommandText={describeTemplateRunCommandSource(templateRunCommand)} />
                    </span>
                    <code dir="ltr" className="papeliz-selectable-text font-mono text-[11.5px] whitespace-pre-wrap [overflow-wrap:anywhere] [unicode-bidi:isolate] text-papeliz-ink">
                      <PapelizTemplateRunCommandMarkedText
                        templateRunCommandText={
                          templateRunCommand.templateRunCommandKind === 'script-file' ? templateRunCommand.templateRunCommandSourceRelativePath : templateRunCommand.templateRunCommandText
                        }
                      />
                    </code>
                    {templateRunCommand.hasTemplateRunCommandHiddenCharacters && (
                      <p className="flex items-start gap-1.5 text-[11.5px] leading-[1.4] font-medium text-papeliz-warning-ink sm:col-start-2">
                        <TriangleAlert className="mt-px size-3.5 flex-none" aria-hidden="true" />
                        It holds hidden characters, marked in it, that can make it read as something else.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <label htmlFor={templateCommandsTickId} className="flex cursor-pointer items-center gap-2 px-0.5 text-[12.5px] font-medium pointer-coarse:py-1.5">
              <input
                id={templateCommandsTickId}
                type="checkbox"
                checked={isTemplateCommandsReadTicked}
                onChange={(changeEvent) => setTemplateCommandsReadTicked(changeEvent.target.checked)}
                className="size-4 flex-none cursor-pointer accent-papeliz-blue"
              />
              I’ve read these commands.
            </label>
          </>
        )}
      </div>

      <div ref={templateCommandsFooterRef} className="flex items-center justify-between gap-2 border-t border-papeliz-line p-3">
        <button type="button" onClick={onTemplateCommandsCancel} className={joinPapelizClassNames(newVaultFormFooterButtonClassName, newVaultFormFooterCancelButtonColorClassName)}>
          Cancel
        </button>
        <button
          type="button"
          disabled={readyTemplateUseState === null || !isTemplateCommandsReadTicked}
          onClick={onTemplateCommandsAccept}
          className={joinPapelizClassNames(newVaultFormFooterButtonClassName, newVaultFormFooterActionButtonColorClassName)}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

interface PapelizTemplateGalleryImportIntoVaultPageProps {
  templateGalleryPageHeadingId: string
  templateGalleryRow: PapelizTemplateGalleryRow
  importingVaultDisplayName: string
  templateUseState: PapelizTemplateUseState
  // Why the last Import into This Vault didn't import; null before one fails.
  templateVaultImportFailureMessage: string | null
  // Recommended, All or the optional files ticked one by one, for a template with optional files.
  onTemplateOptionalFilesChoose?: (chosenTemplateOptionalFileRelativePaths: readonly string[]) => void
  onTemplateImportCancel: () => void
  onTemplateImportConfirm: () => void
}

// Import from Template, in an open vault: the template, where it goes (a new folder named after it at
// the vault's top), how reading and checking its files is going, then Import into This Vault, which
// waits until they're checked. Esc goes back.
export function PapelizTemplateGalleryImportIntoVaultPage({
  templateGalleryPageHeadingId,
  templateGalleryRow,
  importingVaultDisplayName,
  templateUseState,
  templateVaultImportFailureMessage,
  onTemplateOptionalFilesChoose,
  onTemplateImportCancel,
  onTemplateImportConfirm,
}: PapelizTemplateGalleryImportIntoVaultPageProps) {
  const templateImportFooterRef = usePapelizFooterEqualButtonWidthRef(128)
  const isTemplateImportReady = templateUseState.templateUseStage === 'ready'
  return (
    <div
      onKeyDown={(keyDownEvent) => {
        if (keyDownEvent.key !== 'Escape' || keyDownEvent.defaultPrevented) return
        keyDownEvent.preventDefault()
        onTemplateImportCancel()
      }}
      className="papeliz-welcome-enter flex min-h-0 flex-1 flex-col"
    >
      <div className="px-3 pt-[11px] pb-1">
        <div className="flex items-center gap-2">
          <h2 id={templateGalleryPageHeadingId} className="text-[18px] font-semibold tracking-[-0.01em]">
            Import from Template
          </h2>
        </div>
        <p className="mt-0.5 truncate text-[12.5px] text-papeliz-ink-muted">Into {importingVaultDisplayName}</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pt-2.5 pb-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-papeliz-line bg-papeliz-surface px-2.5 py-2">
          <PapelizTemplateGalleryThumbnail templateGalleryRow={templateGalleryRow} templateThumbnailSize="row" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[13.5px] font-semibold">From {templateGalleryRow.templateName}</span>
            <span className="truncate text-[11.5px] text-papeliz-ink-subtle">{describeTemplateGalleryRowDetail(templateGalleryRow)}</span>
          </span>
        </div>
        <p className="flex items-start gap-2 px-0.5 text-[12.5px] leading-[1.5] text-papeliz-ink-muted">
          <FolderPlus className="mt-0.5 size-4 flex-none text-papeliz-blue" aria-hidden="true" />
          <span>
            It goes into a new folder, “{templateGalleryRow.templateName}”, at the top of this vault, or “{templateGalleryRow.templateName} 2” if that name is taken. Nothing
            else in the vault changes, and you can rename or move the folder afterwards.
          </span>
        </p>
        <PapelizTemplateGalleryNewVaultTemplateStatus templateUseState={templateUseState} onTemplateOptionalFilesChoose={onTemplateOptionalFilesChoose} />
        {templateVaultImportFailureMessage !== null && (
          <div role="alert">
            <PapelizSyncFailureLine>{templateVaultImportFailureMessage}</PapelizSyncFailureLine>
          </div>
        )}
      </div>

      <div ref={templateImportFooterRef} className="flex items-center justify-between gap-2 border-t border-papeliz-line p-3">
        <button type="button" onClick={onTemplateImportCancel} className={joinPapelizClassNames(newVaultFormFooterButtonClassName, newVaultFormFooterCancelButtonColorClassName)}>
          Cancel
        </button>
        <button
          type="button"
          disabled={!isTemplateImportReady}
          onClick={onTemplateImportConfirm}
          className={joinPapelizClassNames(newVaultFormFooterButtonClassName, newVaultFormFooterActionButtonColorClassName)}
        >
          Import into This Vault
        </button>
      </div>
    </div>
  )
}

interface PapelizTemplateGalleryVaultImportingPageProps {
  templateGalleryPageHeadingId: string
  templateGalleryRow: PapelizTemplateGalleryRow
  importingVaultDisplayName: string
  templateUseState: PapelizTemplateUseState
}

// The template's files being written into the vault's new folder, counted on a bar.
export function PapelizTemplateGalleryVaultImportingPage({ templateGalleryPageHeadingId, templateGalleryRow, importingVaultDisplayName, templateUseState }: PapelizTemplateGalleryVaultImportingPageProps) {
  const templateImportingStartedAtMilliseconds = usePapelizLoadingStartedAtMilliseconds()
  const templateWrittenFileCount = templateUseState.templateUseStage === 'importing-into-vault' ? templateUseState.templateWrittenFileCount : 0
  const templateFileCount = templateUseState.templateUseStage === 'importing-into-vault' ? templateUseState.templateFileCount : 0
  const isTemplateImported = templateUseState.templateUseStage === 'imported-into-vault'
  return (
    <div className="papeliz-welcome-enter flex min-h-0 flex-1 flex-col">
      <div className="px-3 pt-[11px] pb-1">
        <h2 id={templateGalleryPageHeadingId} className="truncate text-[18px] font-semibold tracking-[-0.01em]">
          Importing “{templateGalleryRow.templateName}”
        </h2>
        <p className="mt-0.5 truncate text-[12.5px] text-papeliz-ink-muted">Into {importingVaultDisplayName}</p>
      </div>
      <div role="status" className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
        <PapelizTemplateGalleryThumbnail templateGalleryRow={templateGalleryRow} templateThumbnailSize="row" />
        <PapelizLoadingReadout
          className="max-w-[300px]"
          loadingWords={isTemplateImported ? 'Opening its first note' : 'Writing the files'}
          loadingStartedAtMilliseconds={templateImportingStartedAtMilliseconds}
          loadingSteps={describeTemplateWritingSteps(isTemplateImported, templateWrittenFileCount, templateFileCount, 'Opening its first note')}
        />
      </div>
    </div>
  )
}

interface PapelizTemplateGalleryVaultMakingPageProps {
  templateGalleryPageHeadingId: string
  templateGalleryRow: PapelizTemplateGalleryRow
  newVaultName: string
  newVaultPlace: PapelizNewVaultPlace
  templateUseState: PapelizTemplateUseState
}

// The vault being made from a template: for a folder, where to look for the folder window while it's
// open; then its files written, counted on a bar. The vault opens once it's made.
export function PapelizTemplateGalleryVaultMakingPage({ templateGalleryPageHeadingId, templateGalleryRow, newVaultName, newVaultPlace, templateUseState }: PapelizTemplateGalleryVaultMakingPageProps) {
  const templateVaultMakingStartedAtMilliseconds = usePapelizLoadingStartedAtMilliseconds()
  const templateWrittenFileCount = templateUseState.templateUseStage === 'making-vault' ? templateUseState.templateWrittenFileCount : 0
  const templateFileCount = templateUseState.templateUseStage === 'making-vault' ? templateUseState.templateFileCount : 0
  const isVaultFolderWindowOpen = newVaultPlace === 'folder-on-disk' && templateUseState.templateUseStage === 'picking-folder'
  const isTemplateVaultMade = templateUseState.templateUseStage === 'made'
  return (
    <div className="papeliz-welcome-enter flex min-h-0 flex-1 flex-col">
      <div className="px-3 pt-[11px] pb-1">
        <h2 id={templateGalleryPageHeadingId} className="truncate text-[18px] font-semibold tracking-[-0.01em]">
          Making “{newVaultName}”
        </h2>
        <p className="mt-0.5 text-[12.5px] text-papeliz-ink-muted">From {templateGalleryRow.templateName}</p>
      </div>
      {isVaultFolderWindowOpen ? (
        <PapelizTemplateGalleryCenteredStep
          TemplateGalleryStepIcon={FolderOpen}
          templateGalleryStepTitle="Choose a folder in the window that opened"
          templateGalleryStepText={`Papeliz makes a folder named “${newVaultName}” in it. If you can’t see the window, it may be behind this one.`}
        />
      ) : (
        <div role="status" className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
          <PapelizTemplateGalleryThumbnail templateGalleryRow={templateGalleryRow} templateThumbnailSize="row" />
          <PapelizLoadingReadout
            className="max-w-[300px]"
            loadingWords={isTemplateVaultMade ? 'Opening the vault' : 'Writing the files'}
            loadingStartedAtMilliseconds={templateVaultMakingStartedAtMilliseconds}
            loadingSteps={describeTemplateWritingSteps(isTemplateVaultMade, templateWrittenFileCount, templateFileCount, 'Opening the vault')}
          />
        </div>
      )}
    </div>
  )
}
