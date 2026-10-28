import Link from 'next/link'
import { ArrowLeft, ArrowRight, Info, Wrench } from 'lucide-react'
import { findPapelizHelpArticle, findPapelizHelpGroup, findPapelizHelpNeighborArticles } from '@/lib/papeliz-help-content'
import type { PapelizHelpArticle, PapelizHelpContentBlock } from '@/lib/papeliz-help-content-blocks'
import { PapelizHelpInlineText } from './papeliz-help-inline-text'

function PapelizHelpKeyCombination({ shortcutKeyCombination }: { shortcutKeyCombination: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {shortcutKeyCombination.split('+').map((shortcutKeyName, shortcutKeyIndex) => (
        <kbd
          key={shortcutKeyIndex}
          className="inline-flex min-w-7 justify-center rounded-md border border-papeliz-line-strong bg-papeliz-surface px-1.5 py-0.5 font-mono text-[13px] leading-5 text-papeliz-ink shadow-[inset_0_-1px_0_var(--color-papeliz-line-strong)]"
        >
          {shortcutKeyName}
        </kbd>
      ))}
    </span>
  )
}

function PapelizHelpContentBlockView({ papelizHelpContentBlock }: { papelizHelpContentBlock: PapelizHelpContentBlock }) {
  switch (papelizHelpContentBlock.papelizHelpBlockKind) {
    case 'paragraph':
      return (
        <p>
          <PapelizHelpInlineText articleText={papelizHelpContentBlock.paragraphText} />
        </p>
      )
    case 'bullet-list':
      return (
        <ul className="list-disc space-y-2 pl-5 marker:text-papeliz-ink-subtle">
          {papelizHelpContentBlock.bulletTexts.map((bulletText) => (
            <li key={bulletText} className="pl-1">
              <PapelizHelpInlineText articleText={bulletText} />
            </li>
          ))}
        </ul>
      )
    case 'numbered-steps':
      return (
        <ol className="list-decimal space-y-2 pl-5 marker:font-semibold marker:text-papeliz-blue">
          {papelizHelpContentBlock.stepTexts.map((stepText) => (
            <li key={stepText} className="pl-1">
              <PapelizHelpInlineText articleText={stepText} />
            </li>
          ))}
        </ol>
      )
    case 'shortcut-table':
      return (
        <div className="overflow-x-auto rounded-2xl border border-papeliz-line">
          <table className="w-full border-collapse text-left text-[15px]">
            <thead className="bg-papeliz-surface-soft text-[13px] text-papeliz-ink-subtle">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Keys</th>
                <th scope="col" className="px-4 py-2 font-semibold">What it does</th>
              </tr>
            </thead>
            <tbody>
              {papelizHelpContentBlock.shortcutRows.map((shortcutRow) => (
                <tr key={shortcutRow.shortcutKeyCombinations.join(' ')} className="border-t border-papeliz-line align-top">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {shortcutRow.shortcutKeyCombinations.map((shortcutKeyCombination, combinationIndex) => (
                        <span key={shortcutKeyCombination} className="inline-flex items-center gap-2">
                          {combinationIndex > 0 && <span className="text-[13px] text-papeliz-ink-subtle">or</span>}
                          <PapelizHelpKeyCombination shortcutKeyCombination={shortcutKeyCombination} />
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-papeliz-ink">{shortcutRow.shortcutActionText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'detail-list':
      return (
        <dl className="grid gap-x-6 gap-y-1 rounded-2xl border border-papeliz-line p-4 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-y-2">
          {papelizHelpContentBlock.detailRows.map((detailRow) => (
            <div key={detailRow.detailLabel} className="contents">
              <dt className="text-[14px] text-papeliz-ink-subtle max-sm:mt-2 max-sm:first:mt-0">{detailRow.detailLabel}</dt>
              <dd className="min-w-0 break-words text-papeliz-ink">
                <PapelizHelpInlineText articleText={detailRow.detailValueText} />
              </dd>
            </div>
          ))}
        </dl>
      )
    case 'code-sample':
      return (
        <pre className="overflow-x-auto rounded-2xl border border-papeliz-line bg-papeliz-surface-soft p-4 font-mono text-[13.5px] leading-6 text-papeliz-ink">
          <code>{papelizHelpContentBlock.codeSampleText}</code>
        </pre>
      )
    case 'note':
      return (
        <div className="flex gap-3 rounded-2xl border border-papeliz-blue-line bg-papeliz-blue-soft px-4 py-3 text-[15px] text-papeliz-ink">
          <Info className="mt-0.5 size-4 flex-none text-papeliz-blue" aria-hidden="true" />
          <p>
            <PapelizHelpInlineText articleText={papelizHelpContentBlock.noteText} />
          </p>
        </div>
      )
  }
}

export function PapelizHelpArticleView({ papelizHelpArticle }: { papelizHelpArticle: PapelizHelpArticle }) {
  const papelizHelpGroup = findPapelizHelpGroup(papelizHelpArticle.papelizHelpGroupSlug)
  const { previousPapelizHelpArticle, nextPapelizHelpArticle } = findPapelizHelpNeighborArticles(papelizHelpArticle.papelizHelpArticleSlug)
  const relatedPapelizHelpArticles = papelizHelpArticle.relatedArticleSlugs.map((relatedArticleSlug) => {
    const relatedPapelizHelpArticle = findPapelizHelpArticle(relatedArticleSlug)
    if (!relatedPapelizHelpArticle) throw new Error(`“${papelizHelpArticle.papelizHelpArticleSlug}” lists an unknown related guide: ${relatedArticleSlug}`)
    return relatedPapelizHelpArticle
  })

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-10 sm:px-8 sm:py-14 xl:grid-cols-[minmax(0,1fr)_190px]">
      <article className="min-w-0">
        <Link href={`/#${papelizHelpGroup.papelizHelpGroupSlug}`} className="text-sm font-semibold text-papeliz-blue hover:underline">
          {papelizHelpGroup.groupTitle}
        </Link>
        <h1 className="mt-2 text-3xl leading-tight font-normal tracking-tight text-balance sm:text-4xl">{papelizHelpArticle.articleTitle}</h1>
        <p className="mt-3 text-lg text-papeliz-ink-muted">{papelizHelpArticle.articleSummary}</p>

        {papelizHelpArticle.papelizHelpArticleAvailability === 'in-development' && (
          <div className="mt-6 flex gap-3 rounded-2xl bg-papeliz-warning px-4 py-3 text-[15px] text-papeliz-warning-ink">
            <Wrench className="mt-0.5 size-4 flex-none" aria-hidden="true" />
            <p>
              <strong className="font-semibold">In development.</strong> This part of Papeliz is still being built. This guide describes how
              it is designed to work, and details may change before launch.
            </p>
          </div>
        )}

        {papelizHelpArticle.articleSections.map((articleSection) => (
          <section key={articleSection.sectionAnchor} aria-labelledby={articleSection.sectionAnchor} className="mt-10">
            <h2 id={articleSection.sectionAnchor} className="group text-xl font-semibold tracking-tight">
              {articleSection.sectionHeading}
              <a
                href={`#${articleSection.sectionAnchor}`}
                aria-label={`Link to “${articleSection.sectionHeading}”`}
                className="ml-2 font-normal text-papeliz-ink-subtle opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                #
              </a>
            </h2>
            <div className="mt-3 space-y-4 text-[16px] leading-relaxed text-papeliz-ink-muted">
              {articleSection.sectionBlocks.map((papelizHelpContentBlock, blockIndex) => (
                <PapelizHelpContentBlockView key={blockIndex} papelizHelpContentBlock={papelizHelpContentBlock} />
              ))}
            </div>
          </section>
        ))}

        {relatedPapelizHelpArticles.length > 0 && (
          <section aria-labelledby="papeliz-help-related-guides" className="mt-14">
            <h2 id="papeliz-help-related-guides" className="text-sm font-semibold text-papeliz-ink-subtle">
              Related guides
            </h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {relatedPapelizHelpArticles.map((relatedPapelizHelpArticle) => (
                <li key={relatedPapelizHelpArticle.papelizHelpArticleSlug}>
                  <Link
                    href={`/${relatedPapelizHelpArticle.papelizHelpArticleSlug}/`}
                    className="block h-full rounded-2xl border border-papeliz-line p-4 transition-colors hover:border-papeliz-blue-line hover:bg-papeliz-blue-soft/50"
                  >
                    <span className="font-semibold text-papeliz-ink">{relatedPapelizHelpArticle.articleTitle}</span>
                    <span className="mt-1 block text-[14px] leading-snug text-papeliz-ink-muted">{relatedPapelizHelpArticle.articleSummary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav aria-label="Previous and next guides" className="mt-12 grid gap-3 border-t border-papeliz-line pt-6 sm:grid-cols-2">
          {previousPapelizHelpArticle ? (
            <Link
              href={`/${previousPapelizHelpArticle.papelizHelpArticleSlug}/`}
              className="group flex flex-col rounded-2xl p-3 transition-colors hover:bg-papeliz-surface-soft"
            >
              <span className="flex items-center gap-1.5 text-[13px] text-papeliz-ink-subtle">
                <ArrowLeft className="size-3.5" aria-hidden="true" /> Previous
              </span>
              <span className="mt-0.5 font-medium text-papeliz-ink group-hover:text-papeliz-blue">{previousPapelizHelpArticle.articleTitle}</span>
            </Link>
          ) : (
            <span />
          )}
          {nextPapelizHelpArticle && (
            <Link
              href={`/${nextPapelizHelpArticle.papelizHelpArticleSlug}/`}
              className="group flex flex-col rounded-2xl p-3 transition-colors hover:bg-papeliz-surface-soft sm:items-end sm:text-right"
            >
              <span className="flex items-center gap-1.5 text-[13px] text-papeliz-ink-subtle">
                Next <ArrowRight className="size-3.5" aria-hidden="true" />
              </span>
              <span className="mt-0.5 font-medium text-papeliz-ink group-hover:text-papeliz-blue">{nextPapelizHelpArticle.articleTitle}</span>
            </Link>
          )}
        </nav>
      </article>

      <aside className="hidden xl:block">
        <nav aria-label="On this page" className="sticky top-20">
          <p className="text-[13px] font-semibold text-papeliz-ink-subtle">On this page</p>
          <ul className="mt-3 space-y-2 border-l border-papeliz-line text-[14px]">
            {papelizHelpArticle.articleSections.map((articleSection) => (
              <li key={articleSection.sectionAnchor}>
                <a
                  href={`#${articleSection.sectionAnchor}`}
                  className="-ml-px block border-l border-transparent pl-3 leading-snug text-papeliz-ink-muted hover:border-papeliz-blue hover:text-papeliz-ink"
                >
                  {articleSection.sectionHeading}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </div>
  )
}
