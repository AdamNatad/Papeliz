import { ThumbsDown, ThumbsUp } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  PapelizSiteTemplateCategoryBadge,
  PapelizSiteTemplateLetterTile,
  PapelizSiteTemplateLicenseBadge,
  PapelizSiteTemplateStatusBadges,
} from './papeliz-site-template-badges'
import {
  createPapelizSiteTemplateGitHubHref,
  createPapelizSiteTemplateOpenInPapelizHref,
  createPapelizSiteTemplateOwnerGitHubHref,
  formatPapelizSiteTemplateByteCount,
  formatPapelizSiteTemplateDay,
  describePapelizSiteTemplateLicenseName,
  readPapelizSiteTemplateCategoryNames,
  type PapelizSiteTemplatesSnapshotRow,
} from '@/lib/papeliz-site-templates'

function PapelizSiteTemplateDetail({ papelizSiteTemplateDetailLabel, children }: { papelizSiteTemplateDetailLabel: string; children: ReactNode }) {
  return (
    <div className="border-t border-papeliz-line py-3.5 sm:grid sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-sm font-semibold text-papeliz-ink">{papelizSiteTemplateDetailLabel}</dt>
      <dd className="mt-0.5 min-w-0 text-[15px] text-papeliz-ink-muted break-words sm:mt-0">{children}</dd>
    </div>
  )
}

const papelizSiteTemplateTextLinkClassName = 'font-medium text-papeliz-blue hover:underline'

// One template's page (/templates/<owner>/<repository>/): what it is, who shares it, its Category and tags, its license, whether it
// runs commands, and the commit Papeliz checked, with Open in Papeliz and View on GitHub. Every word
// of its name, description and tags is the author's, shown as text.
export function PapelizSiteTemplatePage({
  papelizSiteTemplateRow,
  templateGallerySnapshotBuiltAt,
}: {
  papelizSiteTemplateRow: PapelizSiteTemplatesSnapshotRow
  templateGallerySnapshotBuiltAt: number | null
}) {
  const { templateCategoryDisplayName, templateSubcategoryDisplayName, templateExtraTagDisplayNames } = readPapelizSiteTemplateCategoryNames(papelizSiteTemplateRow)
  const papelizSiteTemplateOpenInPapelizHref = createPapelizSiteTemplateOpenInPapelizHref(papelizSiteTemplateRow)

  return (
    <article className="mx-auto max-w-4xl px-4 pt-10 pb-16 sm:px-6 sm:pt-14 sm:pb-20">
      <nav aria-label="Breadcrumb" className="text-sm text-papeliz-ink-muted">
        <Link href="/templates/" className={papelizSiteTemplateTextLinkClassName}>
          Templates
        </Link>
        <span aria-hidden="true" className="px-2">
          /
        </span>
        <span aria-current="page" className="break-words">
          {papelizSiteTemplateRow.templateName}
        </span>
      </nav>

      <header className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start">
        <PapelizSiteTemplateLetterTile papelizSiteTemplateRow={papelizSiteTemplateRow} papelizSiteTemplateLetterTileSize="page" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[clamp(2rem,6vw,3rem)] leading-[1.1] font-normal tracking-tight break-words">{papelizSiteTemplateRow.templateName}</h1>
          <p className="mt-2 text-base text-papeliz-ink-muted">
            by{' '}
            <a href={createPapelizSiteTemplateOwnerGitHubHref(papelizSiteTemplateRow)} rel="noopener noreferrer" className={papelizSiteTemplateTextLinkClassName}>
              {papelizSiteTemplateRow.templateRepositoryOwner}
            </a>{' '}
            on GitHub
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <PapelizSiteTemplateCategoryBadge papelizSiteTemplateRow={papelizSiteTemplateRow} />
            <PapelizSiteTemplateLicenseBadge papelizSiteTemplateRow={papelizSiteTemplateRow} />
            <PapelizSiteTemplateStatusBadges
              papelizSiteTemplateRow={papelizSiteTemplateRow}
              templateGallerySnapshotBuiltAt={templateGallerySnapshotBuiltAt}
            />
          </div>
        </div>
      </header>

      <p className="mt-8 text-lg leading-relaxed text-papeliz-ink break-words">{papelizSiteTemplateRow.templateDescription}</p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {papelizSiteTemplateOpenInPapelizHref && (
          <a
            href={papelizSiteTemplateOpenInPapelizHref}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-papeliz-blue px-6 text-base font-medium text-papeliz-on-blue transition-colors hover:bg-papeliz-blue-hover"
          >
            Open in Papeliz
          </a>
        )}
        <a
          href={createPapelizSiteTemplateGitHubHref(papelizSiteTemplateRow)}
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-papeliz-blue bg-papeliz-surface px-6 text-base font-medium text-papeliz-blue transition-colors hover:bg-papeliz-blue-soft"
        >
          View on GitHub
        </a>
      </div>

      {papelizSiteTemplateRow.isTemplateRunningCommands && (
        <p className="mt-8 rounded-2xl border border-papeliz-line bg-papeliz-surface-soft px-5 py-4 text-[15px] leading-relaxed text-papeliz-ink-muted">
          <b className="font-semibold text-papeliz-ink">Runs commands.</b> This template brings agent settings or scripts that name commands
          for tools on your computer. Papeliz never runs them; before it makes the vault, it lists every one for you to read.
        </p>
      )}

      <dl className="mt-10 border-b border-papeliz-line">
        <PapelizSiteTemplateDetail papelizSiteTemplateDetailLabel="Category">{templateCategoryDisplayName}</PapelizSiteTemplateDetail>
        {templateSubcategoryDisplayName !== null && (
          <PapelizSiteTemplateDetail papelizSiteTemplateDetailLabel="Subcategory">{templateSubcategoryDisplayName}</PapelizSiteTemplateDetail>
        )}
        {templateExtraTagDisplayNames.length > 0 && (
          <PapelizSiteTemplateDetail papelizSiteTemplateDetailLabel="Tags">{templateExtraTagDisplayNames.join(', ')}</PapelizSiteTemplateDetail>
        )}
        <PapelizSiteTemplateDetail papelizSiteTemplateDetailLabel="License">
          {describePapelizSiteTemplateLicenseName(papelizSiteTemplateRow.templateLicenseId)}
        </PapelizSiteTemplateDetail>
        {papelizSiteTemplateRow.templateIncludedFileCount !== null && (
          <PapelizSiteTemplateDetail papelizSiteTemplateDetailLabel="What’s inside">
            {papelizSiteTemplateRow.templateIncludedFileCount.toLocaleString('en-US')} {papelizSiteTemplateRow.templateIncludedFileCount === 1 ? 'file' : 'files'}
            {papelizSiteTemplateRow.templateIncludedByteCount !== null && `, ${formatPapelizSiteTemplateByteCount(papelizSiteTemplateRow.templateIncludedByteCount)}`}
          </PapelizSiteTemplateDetail>
        )}
        {papelizSiteTemplateRow.templateCommitSha !== null && (
          <PapelizSiteTemplateDetail papelizSiteTemplateDetailLabel="Checked">
            {papelizSiteTemplateRow.templateCheckedAt !== null && `${formatPapelizSiteTemplateDay(papelizSiteTemplateRow.templateCheckedAt)} · `}
            commit{' '}
            <a href={createPapelizSiteTemplateGitHubHref(papelizSiteTemplateRow)} rel="noopener noreferrer" className={`${papelizSiteTemplateTextLinkClassName} font-mono text-sm`}>
              {papelizSiteTemplateRow.templateCommitSha.slice(0, 7)}
            </a>
          </PapelizSiteTemplateDetail>
        )}
        <PapelizSiteTemplateDetail papelizSiteTemplateDetailLabel="Votes">
          <span className="inline-flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <ThumbsUp className="size-4" aria-hidden="true" />
              {papelizSiteTemplateRow.templateUpVoteCount.toLocaleString('en-US')} up
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ThumbsDown className="size-4" aria-hidden="true" />
              {papelizSiteTemplateRow.templateDownVoteCount.toLocaleString('en-US')} down
            </span>
          </span>
          <span className="mt-1 block text-sm">Vote in Papeliz, signed in with a free account.</span>
        </PapelizSiteTemplateDetail>
      </dl>
    </article>
  )
}
