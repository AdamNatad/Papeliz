import { findPapelizHelpGroup, papelizHelpArticles } from './papeliz-help-content'
import type { PapelizHelpArticle, PapelizHelpContentBlock } from './papeliz-help-content-blocks'
import { describePapelizHelpInlineTextAsPlain } from './papeliz-help-inline-text'

export interface PapelizHelpSearchResult {
  papelizHelpArticleSlug: string
  articleTitle: string
  groupTitle: string
  // The section whose heading matched, so the result can open at it.
  matchedSectionHeading: string | null
  matchedSectionAnchor: string | null
  articleSummary: string
}

interface PapelizHelpSearchEntry {
  papelizHelpArticle: PapelizHelpArticle
  groupTitle: string
  lowercaseTitle: string
  lowercaseSummary: string
  lowercaseSections: ReadonlyArray<{ sectionHeading: string; sectionAnchor: string; lowercaseHeading: string; lowercaseBody: string }>
}

function describeHelpBlockAsPlain(papelizHelpContentBlock: PapelizHelpContentBlock): string {
  switch (papelizHelpContentBlock.papelizHelpBlockKind) {
    case 'paragraph':
      return describePapelizHelpInlineTextAsPlain(papelizHelpContentBlock.paragraphText)
    case 'note':
      return describePapelizHelpInlineTextAsPlain(papelizHelpContentBlock.noteText)
    case 'bullet-list':
      return papelizHelpContentBlock.bulletTexts.map(describePapelizHelpInlineTextAsPlain).join(' ')
    case 'numbered-steps':
      return papelizHelpContentBlock.stepTexts.map(describePapelizHelpInlineTextAsPlain).join(' ')
    case 'shortcut-table':
      return papelizHelpContentBlock.shortcutRows
        .map((shortcutRow) => `${shortcutRow.shortcutKeyCombinations.join(' ')} ${shortcutRow.shortcutActionText}`)
        .join(' ')
    case 'detail-list':
      return papelizHelpContentBlock.detailRows
        .map((detailRow) => `${detailRow.detailLabel} ${describePapelizHelpInlineTextAsPlain(detailRow.detailValueText)}`)
        .join(' ')
    case 'code-sample':
      return papelizHelpContentBlock.codeSampleText
  }
}

let papelizHelpSearchEntries: readonly PapelizHelpSearchEntry[] | null = null

// Built on the first search, then kept.
function getPapelizHelpSearchEntries(): readonly PapelizHelpSearchEntry[] {
  papelizHelpSearchEntries ??= papelizHelpArticles.map((papelizHelpArticle) => ({
    papelizHelpArticle,
    groupTitle: findPapelizHelpGroup(papelizHelpArticle.papelizHelpGroupSlug).groupTitle,
    lowercaseTitle: papelizHelpArticle.articleTitle.toLowerCase(),
    lowercaseSummary: papelizHelpArticle.articleSummary.toLowerCase(),
    lowercaseSections: papelizHelpArticle.articleSections.map((articleSection) => ({
      sectionHeading: articleSection.sectionHeading,
      sectionAnchor: articleSection.sectionAnchor,
      lowercaseHeading: articleSection.sectionHeading.toLowerCase(),
      lowercaseBody: articleSection.sectionBlocks.map(describeHelpBlockAsPlain).join(' ').toLowerCase(),
    })),
  }))
  return papelizHelpSearchEntries
}

// Every word of the query must appear somewhere in the article. Title matches rank first, then
// section headings, the summary and the body.
export function searchPapelizHelpArticles(searchQueryText: string, maximumResultCount = 8): PapelizHelpSearchResult[] {
  const lowercaseQuery = searchQueryText.trim().toLowerCase()
  const queryWords = lowercaseQuery.split(/\s+/).filter((queryWord) => queryWord.length > 0)
  if (queryWords.length === 0) return []

  const scoredResults: Array<{ searchResult: PapelizHelpSearchResult; searchScore: number; catalogIndex: number }> = []
  getPapelizHelpSearchEntries().forEach((searchEntry, catalogIndex) => {
    let searchScore = searchEntry.lowercaseTitle.includes(lowercaseQuery) ? 100 : 0
    let bestSection: (typeof searchEntry.lowercaseSections)[number] | null = null
    let bestSectionScore = 0
    for (const queryWord of queryWords) {
      const isInTitle = searchEntry.lowercaseTitle.includes(queryWord)
      const isInSummary = searchEntry.lowercaseSummary.includes(queryWord)
      const isInHeading = searchEntry.lowercaseSections.some((articleSection) => articleSection.lowercaseHeading.includes(queryWord))
      const isInBody = searchEntry.lowercaseSections.some((articleSection) => articleSection.lowercaseBody.includes(queryWord))
      if (!isInTitle && !isInSummary && !isInHeading && !isInBody) return
      searchScore += (isInTitle ? 20 : 0) + (isInHeading ? 8 : 0) + (isInSummary ? 6 : 0) + (isInBody ? 2 : 0)
    }
    for (const articleSection of searchEntry.lowercaseSections) {
      const sectionScore = queryWords.filter((queryWord) => articleSection.lowercaseHeading.includes(queryWord)).length
      if (sectionScore > bestSectionScore) {
        bestSection = articleSection
        bestSectionScore = sectionScore
      }
    }
    scoredResults.push({
      searchScore,
      catalogIndex,
      searchResult: {
        papelizHelpArticleSlug: searchEntry.papelizHelpArticle.papelizHelpArticleSlug,
        articleTitle: searchEntry.papelizHelpArticle.articleTitle,
        groupTitle: searchEntry.groupTitle,
        matchedSectionHeading: bestSection?.sectionHeading ?? null,
        matchedSectionAnchor: bestSection?.sectionAnchor ?? null,
        articleSummary: searchEntry.papelizHelpArticle.articleSummary,
      },
    })
  })

  return scoredResults
    .sort((firstResult, secondResult) => secondResult.searchScore - firstResult.searchScore || firstResult.catalogIndex - secondResult.catalogIndex)
    .slice(0, maximumResultCount)
    .map((scoredResult) => scoredResult.searchResult)
}
