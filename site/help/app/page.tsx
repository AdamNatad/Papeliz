import Link from 'next/link'
import { BookMarked, FolderTree, MessageSquare, PenLine, Rocket, ShieldCheck, type LucideIcon } from 'lucide-react'
import { findPapelizHelpArticle, listPapelizHelpGroupArticles, papelizHelpGroups } from '@/lib/papeliz-help-content'
import type { PapelizHelpGroupSlug } from '@/lib/papeliz-help-content-blocks'

const papelizHelpGroupIcons: Record<PapelizHelpGroupSlug, LucideIcon> = {
  'getting-started': Rocket,
  writing: PenLine,
  files: FolderTree,
  assistant: MessageSquare,
  privacy: ShieldCheck,
  reference: BookMarked,
}

const papelizHelpStartHereArticleSlugs = ['what-is-papeliz', 'try-the-sample-vault', 'open-a-folder']

export default function PapelizHelpHomePage() {
  const papelizHelpStartHereArticles = papelizHelpStartHereArticleSlugs.map((startHereArticleSlug) => {
    const startHereArticle = findPapelizHelpArticle(startHereArticleSlug)
    if (!startHereArticle) throw new Error(`The help home links to an unknown guide: ${startHereArticleSlug}`)
    return startHereArticle
  })

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
      <h1 className="text-3xl leading-tight font-normal tracking-tight text-balance sm:text-5xl">Guides for Papeliz</h1>
      <p className="mt-4 max-w-2xl text-lg text-papeliz-ink-muted">
        How to write, link and keep your Markdown notes in Papeliz, and how the assistant works on your own key. Press{' '}
        <kbd className="rounded-md border border-papeliz-line-strong bg-papeliz-surface px-1.5 font-mono text-[15px] text-papeliz-ink">/</kbd> to search.
      </p>

      <section aria-labelledby="papeliz-help-start-here" className="mt-10">
        <h2 id="papeliz-help-start-here" className="text-sm font-semibold text-papeliz-ink-subtle">
          Start here
        </h2>
        <ol className="mt-3 grid gap-3 md:grid-cols-3">
          {papelizHelpStartHereArticles.map((startHereArticle, startHereIndex) => (
            <li key={startHereArticle.papelizHelpArticleSlug}>
              <Link
                href={`/${startHereArticle.papelizHelpArticleSlug}/`}
                className="flex h-full gap-3 rounded-2xl border border-papeliz-line p-4 transition-colors hover:border-papeliz-blue-line hover:bg-papeliz-blue-soft/50"
              >
                <span className="grid size-7 flex-none place-items-center rounded-full bg-papeliz-gradient-start text-[13px] font-semibold text-white">
                  {startHereIndex + 1}
                </span>
                <span>
                  <span className="block font-semibold text-papeliz-ink">{startHereArticle.articleTitle}</span>
                  <span className="mt-1 block text-[14px] leading-snug text-papeliz-ink-muted">{startHereArticle.articleSummary}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {papelizHelpGroups.map((papelizHelpGroup) => {
          const PapelizHelpGroupIcon = papelizHelpGroupIcons[papelizHelpGroup.papelizHelpGroupSlug]
          return (
            <section
              key={papelizHelpGroup.papelizHelpGroupSlug}
              id={papelizHelpGroup.papelizHelpGroupSlug}
              aria-labelledby={`${papelizHelpGroup.papelizHelpGroupSlug}-heading`}
              className="rounded-3xl border border-papeliz-line p-6"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-10 flex-none place-items-center rounded-full bg-papeliz-blue-soft text-papeliz-blue">
                  <PapelizHelpGroupIcon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 id={`${papelizHelpGroup.papelizHelpGroupSlug}-heading`} className="text-lg font-semibold">
                    {papelizHelpGroup.groupTitle}
                  </h2>
                  <p className="text-[14px] text-papeliz-ink-muted">{papelizHelpGroup.groupSummary}</p>
                </div>
              </div>
              <ul className="mt-4 divide-y divide-papeliz-line">
                {listPapelizHelpGroupArticles(papelizHelpGroup.papelizHelpGroupSlug).map((papelizHelpArticle) => (
                  <li key={papelizHelpArticle.papelizHelpArticleSlug}>
                    <Link
                      href={`/${papelizHelpArticle.papelizHelpArticleSlug}/`}
                      className="group flex flex-wrap items-center gap-x-2 gap-y-1 py-2.5 text-[15px]"
                    >
                      <span className="font-medium text-papeliz-ink group-hover:text-papeliz-blue">{papelizHelpArticle.articleTitle}</span>
                      {papelizHelpArticle.papelizHelpArticleAvailability === 'in-development' && (
                        <span className="rounded-full bg-papeliz-warning px-2 py-0.5 text-[12px] font-medium text-papeliz-warning-ink">In development</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
