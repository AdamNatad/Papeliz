import { ArrowLeft, Link } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PapelizSyncFailureLine, PapelizSyncLoadingLine } from '../sync/papeliz-sync-page-parts'
import { PapelizIconButton, PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { usePapelizFooterEqualButtonWidthRef } from '../ui/papeliz-footer-equal-button-width'
import { PapelizSolidCircleCheckIcon, PapelizSolidCircleXIcon } from '../ui/papeliz-solid-circle-icons'
import { newVaultFormFooterActionButtonColorClassName, newVaultFormFooterButtonClassName, newVaultFormFooterCancelButtonColorClassName } from '../workspace/papeliz-new-vault-form'
import type { PapelizTemplateCheckRunState } from './papeliz-template-gallery-contract'
import { describeTemplateFileReadProgress, PapelizTemplateGalleryCheckResultList } from './papeliz-template-gallery-page-parts'

// Submitting comes with the Templates server and a free Papeliz account.
const papelizTemplateGallerySubmitOffText = 'Submitting opens with the Templates server, with a free Papeliz account. Every check passed, so this repository is ready for then.'

interface PapelizTemplateGallerySubmitPageProps {
  templateGalleryPageHeadingId: string
  templateCheckRunState: PapelizTemplateCheckRunState
  onTemplateRepositoryLinkCheck: (typedTemplateRepositoryLink: string) => void
  // The link changed after a Check: its results no longer apply.
  onTemplateCheckRunReset: () => void
  onSubmitTemplatePageClose: () => void
}

// Submit Template: paste a public GitHub repository's link (or "owner/repository") and press Check.
// Papeliz asks GitHub for its newest commit, reads its files there from jsDelivr, and shows each check
// passed or failed in a plain sentence. Submit turns on once every check passes. Esc goes back.
export function PapelizTemplateGallerySubmitPage({
  templateGalleryPageHeadingId,
  templateCheckRunState,
  onTemplateRepositoryLinkCheck,
  onTemplateCheckRunReset,
  onSubmitTemplatePageClose,
}: PapelizTemplateGallerySubmitPageProps) {
  const submitTemplateFooterRef = usePapelizFooterEqualButtonWidthRef(128)
  const submitTemplateLinkInputRef = useRef<HTMLInputElement>(null)
  const [typedSubmitTemplateLink, setTypedSubmitTemplateLink] = useState(() =>
    templateCheckRunState.templateCheckRunStage === 'idle' || templateCheckRunState.templateCheckRunStage === 'failed-to-read'
      ? ''
      : `https://github.com/${templateCheckRunState.papelizTemplateGalleryId}`,
  )
  const [isSubmitTemplateWordsShown, setSubmitTemplateWordsShown] = useState(false)

  // The link field opens ready to paste in.
  useEffect(() => {
    submitTemplateLinkInputRef.current?.focus()
  }, [])

  const isTemplateCheckRunning = templateCheckRunState.templateCheckRunStage === 'reading-github' || templateCheckRunState.templateCheckRunStage === 'reading-files'
  const isEveryTemplateCheckPassed = templateCheckRunState.templateCheckRunStage === 'checked' && templateCheckRunState.templateCheckReport.isEveryTemplateCheckPassed

  return (
    <div
      onKeyDown={(keyDownEvent) => {
        if (keyDownEvent.key !== 'Escape' || keyDownEvent.defaultPrevented) return
        keyDownEvent.preventDefault()
        onSubmitTemplatePageClose()
      }}
      className="papeliz-welcome-enter flex min-h-0 flex-1 flex-col"
    >
      <div className="px-3 pt-[11px] pb-1">
        <div className="flex items-center gap-2">
          <PapelizIconButton iconButtonLabel="Back to Templates" iconButtonSize="small" className="-my-0.5 -ml-1.5" onClick={onSubmitTemplatePageClose}>
            <ArrowLeft className="size-[15px]" aria-hidden="true" />
          </PapelizIconButton>
          <h2 id={templateGalleryPageHeadingId} className="text-[18px] font-semibold tracking-[-0.01em]">
            Submit Template
          </h2>
        </div>
        <p className="mt-0.5 text-[12.5px] text-papeliz-ink-muted">A public GitHub repository with papeliz-template.json at its root.</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 pt-2.5 pb-3">
        <form
          className="flex gap-2"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault()
            setSubmitTemplateWordsShown(false)
            onTemplateRepositoryLinkCheck(typedSubmitTemplateLink)
          }}
        >
          <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-papeliz-line bg-papeliz-surface px-3 text-papeliz-ink-subtle focus-within:border-papeliz-blue-line focus-within:shadow-[0_0_0_3px_var(--color-papeliz-blue-soft)] pointer-coarse:h-10">
            <Link className="size-3.5 flex-none" aria-hidden="true" />
            <span className="sr-only">Repository link</span>
            <input
              ref={submitTemplateLinkInputRef}
              type="text"
              inputMode="url"
              value={typedSubmitTemplateLink}
              autoComplete="off"
              spellCheck={false}
              placeholder="https://github.com/owner/repository"
              onChange={(changeEvent) => {
                setTypedSubmitTemplateLink(changeEvent.target.value)
                setSubmitTemplateWordsShown(false)
                if (templateCheckRunState.templateCheckRunStage !== 'idle') onTemplateCheckRunReset()
              }}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-papeliz-ink placeholder:text-papeliz-ink-subtle focus:outline-none"
            />
          </label>
          <PapelizPillButton type="submit" pillButtonVariant="outline" disabled={isTemplateCheckRunning || typedSubmitTemplateLink.trim().length === 0} className="h-9 pointer-coarse:h-10">
            Check
          </PapelizPillButton>
        </form>

        {templateCheckRunState.templateCheckRunStage === 'reading-github' && <PapelizSyncLoadingLine>Asking GitHub for {templateCheckRunState.papelizTemplateGalleryId}…</PapelizSyncLoadingLine>}
        {templateCheckRunState.templateCheckRunStage === 'reading-files' && (
          <PapelizSyncLoadingLine>
            Reading its files at commit {templateCheckRunState.templateCommitSha.slice(0, 7)}…
            {templateCheckRunState.templateFileReadProgress !== null && ` ${describeTemplateFileReadProgress(templateCheckRunState.templateFileReadProgress)}`}
          </PapelizSyncLoadingLine>
        )}
        {templateCheckRunState.templateCheckRunStage === 'failed-to-read' && <PapelizSyncFailureLine className="px-0.5">{templateCheckRunState.templateCheckRunProblemSentence}</PapelizSyncFailureLine>}
        {templateCheckRunState.templateCheckRunStage === 'checked' && (
          <>
            <p className="px-0.5 text-[12px] text-papeliz-ink-subtle">
              {templateCheckRunState.papelizTemplateGalleryId}, at commit {templateCheckRunState.templateCommitSha.slice(0, 7)}
            </p>
            <div className="rounded-xl border border-papeliz-line bg-papeliz-surface px-3 py-2.5">
              <PapelizTemplateGalleryCheckResultList templateCheckResults={templateCheckRunState.templateCheckReport.templateCheckResults} />
            </div>
            {!isEveryTemplateCheckPassed && <PapelizSyncFailureLine className="px-0.5">Fix what failed, push the change, and press Check again.</PapelizSyncFailureLine>}
          </>
        )}
        {isSubmitTemplateWordsShown && (
          <p role="status" className="rounded-xl bg-papeliz-blue-soft px-3 py-2 text-[12px] leading-[1.45] text-papeliz-ink">
            {papelizTemplateGallerySubmitOffText}
          </p>
        )}
        <p className="mt-auto px-0.5 pt-1 text-[11.5px] leading-[1.45] text-papeliz-ink-subtle">
          No ads or spam, no personal data, nothing hateful, sexual, violent or illegal, and honest names and previews. Anyone can report a template.
        </p>
      </div>

      <div ref={submitTemplateFooterRef} className="flex items-center justify-between gap-2 border-t border-papeliz-line p-3">
        <button type="button" onClick={onSubmitTemplatePageClose} className={joinPapelizClassNames(newVaultFormFooterButtonClassName, newVaultFormFooterCancelButtonColorClassName)}>
          <PapelizSolidCircleXIcon className="size-[15px] flex-none" />
          Cancel
        </button>
        <button
          type="button"
          disabled={!isEveryTemplateCheckPassed}
          onClick={() => setSubmitTemplateWordsShown(true)}
          className={joinPapelizClassNames(newVaultFormFooterButtonClassName, newVaultFormFooterActionButtonColorClassName)}
        >
          <PapelizSolidCircleCheckIcon className="size-[15px] flex-none" />
          Submit
        </button>
      </div>
    </div>
  )
}
