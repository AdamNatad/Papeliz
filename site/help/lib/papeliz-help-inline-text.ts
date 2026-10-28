import { findPapelizHelpArticle } from './papeliz-help-content'

// The three inline marks article text may use: `code`, **bold**, and [[article-slug]] or
// [[article-slug|label]] for a link to another guide. Code is matched first, so marks inside
// backticks stay literal text.
export type PapelizHelpInlineSegment =
  | { inlineSegmentKind: 'plain'; inlineSegmentText: string }
  | { inlineSegmentKind: 'code'; inlineSegmentText: string }
  | { inlineSegmentKind: 'bold'; inlineSegmentText: string }
  | { inlineSegmentKind: 'article-link'; inlineSegmentText: string; linkedPapelizHelpArticleSlug: string }

const papelizHelpInlineMarkPattern = /`([^`]+)`|\*\*([^*]+)\*\*|\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

export function splitPapelizHelpInlineText(articleText: string): PapelizHelpInlineSegment[] {
  const inlineSegments: PapelizHelpInlineSegment[] = []
  let plainTextStart = 0
  for (const inlineMarkMatch of articleText.matchAll(papelizHelpInlineMarkPattern)) {
    const inlineMarkStart = inlineMarkMatch.index
    if (inlineMarkStart > plainTextStart) {
      inlineSegments.push({ inlineSegmentKind: 'plain', inlineSegmentText: articleText.slice(plainTextStart, inlineMarkStart) })
    }
    const [, codeText, boldText, linkedArticleSlug, linkLabel] = inlineMarkMatch
    if (codeText !== undefined) {
      inlineSegments.push({ inlineSegmentKind: 'code', inlineSegmentText: codeText })
    } else if (boldText !== undefined) {
      inlineSegments.push({ inlineSegmentKind: 'bold', inlineSegmentText: boldText })
    } else {
      const linkedPapelizHelpArticle = findPapelizHelpArticle(linkedArticleSlug)
      // A link to a guide that doesn't exist fails the build instead of shipping a dead link.
      if (!linkedPapelizHelpArticle) throw new Error(`Help text links to an unknown guide: [[${linkedArticleSlug}]]`)
      inlineSegments.push({
        inlineSegmentKind: 'article-link',
        inlineSegmentText: linkLabel ?? linkedPapelizHelpArticle.articleTitle,
        linkedPapelizHelpArticleSlug: linkedArticleSlug,
      })
    }
    plainTextStart = inlineMarkStart + inlineMarkMatch[0].length
  }
  if (plainTextStart < articleText.length) {
    inlineSegments.push({ inlineSegmentKind: 'plain', inlineSegmentText: articleText.slice(plainTextStart) })
  }
  return inlineSegments
}

// The text as a reader sees it, without the marks, for search.
export function describePapelizHelpInlineTextAsPlain(articleText: string): string {
  return splitPapelizHelpInlineText(articleText)
    .map((inlineSegment) => inlineSegment.inlineSegmentText)
    .join('')
}
