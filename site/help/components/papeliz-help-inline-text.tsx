import Link from 'next/link'
import { Fragment } from 'react'
import { splitPapelizHelpInlineText } from '@/lib/papeliz-help-inline-text'

// Article text with its `code`, **bold** and [[guide]] marks drawn.
export function PapelizHelpInlineText({ articleText }: { articleText: string }) {
  return (
    <>
      {splitPapelizHelpInlineText(articleText).map((inlineSegment, inlineSegmentIndex) => {
        switch (inlineSegment.inlineSegmentKind) {
          case 'code':
            return (
              <code
                key={inlineSegmentIndex}
                className="rounded-md bg-papeliz-surface-gray px-1.5 py-0.5 font-mono text-[0.875em] break-words text-papeliz-ink"
              >
                {inlineSegment.inlineSegmentText}
              </code>
            )
          case 'bold':
            return (
              <strong key={inlineSegmentIndex} className="font-semibold text-papeliz-ink">
                {inlineSegment.inlineSegmentText}
              </strong>
            )
          case 'article-link':
            return (
              <Link
                key={inlineSegmentIndex}
                href={`/${inlineSegment.linkedPapelizHelpArticleSlug}/`}
                className="font-medium text-papeliz-blue underline decoration-papeliz-blue-line underline-offset-2 hover:decoration-papeliz-blue"
              >
                {inlineSegment.inlineSegmentText}
              </Link>
            )
          default:
            return <Fragment key={inlineSegmentIndex}>{inlineSegment.inlineSegmentText}</Fragment>
        }
      })}
    </>
  )
}
