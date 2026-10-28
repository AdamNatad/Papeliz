import { papelizHelpAssistantArticles } from './papeliz-help-articles-assistant'
import { papelizHelpFilesArticles } from './papeliz-help-articles-files'
import { papelizHelpGettingStartedArticles } from './papeliz-help-articles-getting-started'
import { papelizHelpPrivacyArticles } from './papeliz-help-articles-privacy'
import { papelizHelpReferenceArticles } from './papeliz-help-articles-reference'
import { papelizHelpWritingArticles } from './papeliz-help-articles-writing'
import type { PapelizHelpArticle, PapelizHelpGroupSlug } from './papeliz-help-content-blocks'

export interface PapelizHelpGroup {
  papelizHelpGroupSlug: PapelizHelpGroupSlug
  groupTitle: string
  groupSummary: string
}

// Groups in reading order; the sidebar, the home page and previous/next all follow it.
export const papelizHelpGroups: readonly PapelizHelpGroup[] = [
  { papelizHelpGroupSlug: 'getting-started', groupTitle: 'Getting started', groupSummary: 'What Papeliz is, and your first vault.' },
  { papelizHelpGroupSlug: 'writing', groupTitle: 'Writing', groupSummary: 'MD Code, MD View, links, tags and formatting.' },
  { papelizHelpGroupSlug: 'files', groupTitle: 'Files', groupSummary: 'The file list, tabs, saving and the vault’s trash.' },
  { papelizHelpGroupSlug: 'assistant', groupTitle: 'The assistant', groupSummary: 'Your own key, then chat, edits and focus mode.' },
  { papelizHelpGroupSlug: 'privacy', groupTitle: 'Privacy and security', groupSummary: 'Where your notes and your key go.' },
  { papelizHelpGroupSlug: 'reference', groupTitle: 'Reference', groupSummary: 'Shortcuts, Markdown syntax and fixes.' },
]

const papelizHelpArticlesInCatalogOrder: readonly PapelizHelpArticle[] = [
  ...papelizHelpGettingStartedArticles,
  ...papelizHelpWritingArticles,
  ...papelizHelpFilesArticles,
  ...papelizHelpAssistantArticles,
  ...papelizHelpPrivacyArticles,
  ...papelizHelpReferenceArticles,
]

// Every article, ordered by group, then as written within its group.
export const papelizHelpArticles: readonly PapelizHelpArticle[] = papelizHelpGroups.flatMap((papelizHelpGroup) =>
  papelizHelpArticlesInCatalogOrder.filter(
    (papelizHelpArticle) => papelizHelpArticle.papelizHelpGroupSlug === papelizHelpGroup.papelizHelpGroupSlug,
  ),
)

const papelizHelpArticlesBySlug = new Map(
  papelizHelpArticles.map((papelizHelpArticle) => [papelizHelpArticle.papelizHelpArticleSlug, papelizHelpArticle]),
)

export function findPapelizHelpArticle(papelizHelpArticleSlug: string): PapelizHelpArticle | undefined {
  return papelizHelpArticlesBySlug.get(papelizHelpArticleSlug)
}

export function findPapelizHelpGroup(papelizHelpGroupSlug: PapelizHelpGroupSlug): PapelizHelpGroup {
  const papelizHelpGroup = papelizHelpGroups.find((candidateGroup) => candidateGroup.papelizHelpGroupSlug === papelizHelpGroupSlug)
  if (!papelizHelpGroup) throw new Error(`Unknown help group: ${papelizHelpGroupSlug}`)
  return papelizHelpGroup
}

export function listPapelizHelpGroupArticles(papelizHelpGroupSlug: PapelizHelpGroupSlug): readonly PapelizHelpArticle[] {
  return papelizHelpArticles.filter((papelizHelpArticle) => papelizHelpArticle.papelizHelpGroupSlug === papelizHelpGroupSlug)
}

// The articles just before and after this one in reading order, across groups.
export function findPapelizHelpNeighborArticles(papelizHelpArticleSlug: string): {
  previousPapelizHelpArticle: PapelizHelpArticle | undefined
  nextPapelizHelpArticle: PapelizHelpArticle | undefined
} {
  const articleIndex = papelizHelpArticles.findIndex((papelizHelpArticle) => papelizHelpArticle.papelizHelpArticleSlug === papelizHelpArticleSlug)
  return {
    previousPapelizHelpArticle: articleIndex > 0 ? papelizHelpArticles[articleIndex - 1] : undefined,
    nextPapelizHelpArticle: articleIndex >= 0 ? papelizHelpArticles[articleIndex + 1] : undefined,
  }
}

// Slugs must be unique; a duplicate would make two articles share one page.
if (papelizHelpArticlesBySlug.size !== papelizHelpArticles.length) {
  throw new Error('Two help articles share a slug.')
}
