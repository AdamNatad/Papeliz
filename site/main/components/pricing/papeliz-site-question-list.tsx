import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { papelizSiteQuestionsHelpUrl, type PapelizSiteQuestion } from '@/lib/papeliz-site-sync-questions'
import styles from './papeliz-site-question-list.module.css'

type PapelizSiteQuestionListProps = {
  papelizSiteQuestionListAnchor: string
  papelizSiteQuestionListHeading: string
  papelizSiteQuestionListLead?: string
  papelizSiteQuestions: PapelizSiteQuestion[]
}

const papelizSiteQuestionLinkClassName = 'font-medium text-papeliz-blue underline-offset-3 hover:underline'

// Questions and answers: a centered heading, then one answer open at a time
// (the details share a name), and where to ask more.
export function PapelizSiteQuestionList({
  papelizSiteQuestionListAnchor,
  papelizSiteQuestionListHeading,
  papelizSiteQuestionListLead,
  papelizSiteQuestions,
}: PapelizSiteQuestionListProps) {
  const papelizSiteQuestionListHeadingId = `${papelizSiteQuestionListAnchor}-title`
  return (
    <section id={papelizSiteQuestionListAnchor} aria-labelledby={papelizSiteQuestionListHeadingId} className="mx-auto mt-20 max-w-[672px] scroll-mt-31 md:scroll-mt-20">
      <header className="text-center">
        <h2 id={papelizSiteQuestionListHeadingId} className="text-3xl leading-tight font-normal tracking-tight sm:text-4xl">
          {papelizSiteQuestionListHeading}
        </h2>
        {papelizSiteQuestionListLead && <p className="mt-4 text-lg text-papeliz-ink-muted sm:text-[22px]">{papelizSiteQuestionListLead}</p>}
      </header>
      <div className="mt-8">
        {papelizSiteQuestions.map((papelizSiteQuestion) => (
          <details key={papelizSiteQuestion.papelizSiteQuestionAnchor} name={papelizSiteQuestionListAnchor} className={`${styles.question} border-b border-papeliz-line`}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-base leading-snug font-semibold sm:text-xl [&::-webkit-details-marker]:hidden">
              {papelizSiteQuestion.papelizSiteQuestionText}
              <ChevronDown className="size-5 shrink-0 text-papeliz-ink-subtle" aria-hidden="true" />
            </summary>
            <p className="pr-6 pb-6 text-base leading-[1.7] text-papeliz-ink-muted">
              {papelizSiteQuestion.papelizSiteQuestionAnswerParts.map((papelizSiteQuestionAnswerPart) =>
                typeof papelizSiteQuestionAnswerPart === 'string' ? (
                  papelizSiteQuestionAnswerPart
                ) : (
                  <Link
                    key={papelizSiteQuestionAnswerPart.papelizSiteQuestionAnswerLinkHref}
                    href={papelizSiteQuestionAnswerPart.papelizSiteQuestionAnswerLinkHref}
                    className={papelizSiteQuestionLinkClassName}
                  >
                    {papelizSiteQuestionAnswerPart.papelizSiteQuestionAnswerLinkLabel}
                  </Link>
                ),
              )}
            </p>
          </details>
        ))}
      </div>
      <p className="mt-8 text-center text-sm leading-[1.7] text-papeliz-ink-muted">
        More questions?{' '}
        {papelizSiteQuestionsHelpUrl && (
          <>
            Read the{' '}
            <a href={papelizSiteQuestionsHelpUrl} className={papelizSiteQuestionLinkClassName}>
              Help guides
            </a>{' '}
            or ask the{' '}
          </>
        )}
        {!papelizSiteQuestionsHelpUrl && 'Ask the '}
        <Link href="/community/" className={papelizSiteQuestionLinkClassName}>
          Community
        </Link>
        .
      </p>
    </section>
  )
}
