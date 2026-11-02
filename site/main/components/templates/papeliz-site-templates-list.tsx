'use client'

import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  createPapelizSiteTemplateOpenInPapelizHref,
  createPapelizSiteTemplatePagePath,
  formatPapelizSiteTemplateTagDisplayName,
  orderPapelizSiteTemplatesForList,
  listPapelizSiteTemplateCategoryTags,
  describePapelizSiteTemplateLicenseName,
  papelizSiteTemplatesSnapshotPath,
  readPapelizSiteTemplatesSnapshot,
  type PapelizSiteTemplateCategoryTag,
  type PapelizSiteTemplatesSnapshot,
} from '@/lib/papeliz-site-templates'
import { PapelizSiteTemplateCategoryBadge, PapelizSiteTemplateLetterTile, PapelizSiteTemplateStatusBadges } from './papeliz-site-template-badges'

type PapelizSiteTemplatesListProps = {
  // The list the site build read, so the page has its templates before any script runs.
  papelizSiteTemplatesBuildSnapshot: PapelizSiteTemplatesSnapshot
  // Templates with a page of their own: the ones the build knew. One listed since then shows here
  // with Open in Papeliz, and gets its page at the next build.
  papelizSiteTemplateIdsWithPages: string[]
}

type PapelizSiteTemplatesCategoryChoice = PapelizSiteTemplateCategoryTag | 'all'

const papelizSiteTemplatesCategoryChipClassName = 'inline-flex min-h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors'

// The Templates list: chips for the categories (Papeliz's first three, then any other a template has),
// then a row per template, Featured first. Once on the
// page it reads the same hourly list the app reads, from this site's own address, so the counts and
// any template listed since the build show without a new build. If that read fails, the build's list
// stays.
export function PapelizSiteTemplatesList({ papelizSiteTemplatesBuildSnapshot, papelizSiteTemplateIdsWithPages }: PapelizSiteTemplatesListProps) {
  const [papelizSiteTemplatesSnapshot, setPapelizSiteTemplatesSnapshot] = useState(papelizSiteTemplatesBuildSnapshot)
  const [papelizSiteTemplatesCategoryChoice, setPapelizSiteTemplatesCategoryChoice] = useState<PapelizSiteTemplatesCategoryChoice>('all')

  useEffect(() => {
    const snapshotReadController = new AbortController()
    void (async () => {
      try {
        const snapshotResponse = await fetch(papelizSiteTemplatesSnapshotPath, { headers: { accept: 'application/json' }, signal: snapshotReadController.signal })
        if (!snapshotResponse.ok || !(snapshotResponse.headers.get('content-type') ?? '').includes('application/json')) return
        const freshPapelizSiteTemplatesSnapshot = readPapelizSiteTemplatesSnapshot(await snapshotResponse.json())
        if (freshPapelizSiteTemplatesSnapshot !== null) setPapelizSiteTemplatesSnapshot(freshPapelizSiteTemplatesSnapshot)
      } catch {
        // Offline, or no Templates Worker on this host: the build's list stays.
      }
    })()
    return () => snapshotReadController.abort()
  }, [])

  const papelizSiteTemplateIdsWithPagesSet = new Set(papelizSiteTemplateIdsWithPages)
  const papelizSiteTemplatesShown = orderPapelizSiteTemplatesForList(papelizSiteTemplatesSnapshot).filter(
    (papelizSiteTemplateRow) => papelizSiteTemplatesCategoryChoice === 'all' || papelizSiteTemplateRow.templateTags[0] === papelizSiteTemplatesCategoryChoice,
  )
  const papelizSiteTemplatesCategoryChoices: PapelizSiteTemplatesCategoryChoice[] = ['all', ...listPapelizSiteTemplateCategoryTags(papelizSiteTemplatesSnapshot.templateGallerySnapshotRows)]

  return (
    <div className="mx-auto max-w-4xl">
      <div role="group" aria-label="Category" className="flex flex-wrap justify-center gap-2">
        {papelizSiteTemplatesCategoryChoices.map((papelizSiteTemplatesCategoryChoiceOption) => {
          const isPapelizSiteTemplatesCategoryChosen = papelizSiteTemplatesCategoryChoiceOption === papelizSiteTemplatesCategoryChoice
          return (
            <button
              key={papelizSiteTemplatesCategoryChoiceOption}
              type="button"
              aria-pressed={isPapelizSiteTemplatesCategoryChosen}
              onClick={() => setPapelizSiteTemplatesCategoryChoice(papelizSiteTemplatesCategoryChoiceOption)}
              className={`${papelizSiteTemplatesCategoryChipClassName} ${
                isPapelizSiteTemplatesCategoryChosen
                  ? 'border-papeliz-blue bg-papeliz-blue text-papeliz-on-blue'
                  : 'border-papeliz-line-strong bg-papeliz-surface text-papeliz-ink hover:bg-papeliz-hover'
              }`}
            >
              {papelizSiteTemplatesCategoryChoiceOption === 'all' ? 'All' : formatPapelizSiteTemplateTagDisplayName(papelizSiteTemplatesCategoryChoiceOption)}
            </button>
          )
        })}
      </div>

      {papelizSiteTemplatesShown.length === 0 ? (
        <p className="mt-10 rounded-3xl border border-dashed border-papeliz-line-strong px-6 py-10 text-center text-base text-papeliz-ink-muted">
          {papelizSiteTemplatesCategoryChoice === 'all'
            ? 'No templates are listed yet.'
            : `No ${formatPapelizSiteTemplateTagDisplayName(papelizSiteTemplatesCategoryChoice)} templates are listed yet.`}
        </p>
      ) : (
        <ul className="mt-8 grid gap-3">
          {papelizSiteTemplatesShown.map((papelizSiteTemplateRow) => {
            const papelizSiteTemplateHasPage = papelizSiteTemplateIdsWithPagesSet.has(papelizSiteTemplateRow.papelizTemplateGalleryId)
            const papelizSiteTemplateOpenInPapelizHref = createPapelizSiteTemplateOpenInPapelizHref(papelizSiteTemplateRow)
            return (
              <li
                key={papelizSiteTemplateRow.papelizTemplateGalleryId}
                data-papeliz-template-gallery-id={papelizSiteTemplateRow.papelizTemplateGalleryId}
                className="flex flex-col gap-4 rounded-3xl border border-papeliz-line bg-papeliz-surface-soft p-5 sm:flex-row sm:items-center sm:p-6"
              >
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <PapelizSiteTemplateLetterTile papelizSiteTemplateRow={papelizSiteTemplateRow} papelizSiteTemplateLetterTileSize="row" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h2 className="min-w-0 text-lg leading-7 font-semibold tracking-tight break-words">
                        {papelizSiteTemplateHasPage ? (
                          // A plain link, not next/link: Next drops the trailing slash from a repository name with a dot
                          // ("notes.site"), which the page's exported folder needs.
                          <a href={createPapelizSiteTemplatePagePath(papelizSiteTemplateRow)} className="hover:text-papeliz-blue hover:underline">
                            {papelizSiteTemplateRow.templateName}
                          </a>
                        ) : (
                          papelizSiteTemplateRow.templateName
                        )}
                      </h2>
                      <PapelizSiteTemplateStatusBadges
                        papelizSiteTemplateRow={papelizSiteTemplateRow}
                        templateGallerySnapshotBuiltAt={papelizSiteTemplatesSnapshot.templateGallerySnapshotBuiltAt}
                      />
                    </div>
                    <p className="mt-0.5 text-sm text-papeliz-ink-muted">
                      by {papelizSiteTemplateRow.templateRepositoryOwner} · {describePapelizSiteTemplateLicenseName(papelizSiteTemplateRow.templateLicenseId)}
                      {papelizSiteTemplateRow.templateIncludedFileCount !== null &&
                        ` · ${papelizSiteTemplateRow.templateIncludedFileCount.toLocaleString('en-US')} ${papelizSiteTemplateRow.templateIncludedFileCount === 1 ? 'file' : 'files'}`}
                    </p>
                    <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-papeliz-ink-muted break-words">{papelizSiteTemplateRow.templateDescription}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <PapelizSiteTemplateCategoryBadge papelizSiteTemplateRow={papelizSiteTemplateRow} />
                      <span className="inline-flex items-center gap-3 text-sm text-papeliz-ink-muted">
                        <span className="inline-flex items-center gap-1">
                          <ThumbsUp className="size-3.5" aria-hidden="true" />
                          <span className="sr-only">Up votes:</span>
                          {papelizSiteTemplateRow.templateUpVoteCount.toLocaleString('en-US')}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <ThumbsDown className="size-3.5" aria-hidden="true" />
                          <span className="sr-only">Down votes:</span>
                          {papelizSiteTemplateRow.templateDownVoteCount.toLocaleString('en-US')}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
                {papelizSiteTemplateOpenInPapelizHref && (
                  <a
                    href={papelizSiteTemplateOpenInPapelizHref}
                    aria-label={`Open ${papelizSiteTemplateRow.templateName} in Papeliz`}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center self-start rounded-full bg-papeliz-blue px-5 text-[15px] font-medium text-papeliz-on-blue transition-colors hover:bg-papeliz-blue-hover sm:self-center"
                  >
                    Open in Papeliz
                  </a>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
