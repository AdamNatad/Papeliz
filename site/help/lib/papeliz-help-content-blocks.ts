// The building blocks of a help article. Article text may use three inline marks, read by
// papeliz-help-inline-text.ts: `code`, **bold**, and [[article-slug]] or [[article-slug|label]]
// for a link to another guide.

export type PapelizHelpArticleAvailability = 'available' | 'in-development'

export type PapelizHelpGroupSlug = 'getting-started' | 'writing' | 'files' | 'assistant' | 'privacy' | 'reference'

export interface PapelizHelpShortcutRow {
  // Each combination is written with "+" between keys, such as "Ctrl+Shift+F". Several
  // combinations do the same thing in one row.
  shortcutKeyCombinations: readonly string[]
  shortcutActionText: string
}

export interface PapelizHelpDetailRow {
  detailLabel: string
  detailValueText: string
}

export type PapelizHelpContentBlock =
  | { papelizHelpBlockKind: 'paragraph'; paragraphText: string }
  | { papelizHelpBlockKind: 'bullet-list'; bulletTexts: readonly string[] }
  | { papelizHelpBlockKind: 'numbered-steps'; stepTexts: readonly string[] }
  | { papelizHelpBlockKind: 'shortcut-table'; shortcutRows: readonly PapelizHelpShortcutRow[] }
  | { papelizHelpBlockKind: 'detail-list'; detailRows: readonly PapelizHelpDetailRow[] }
  | { papelizHelpBlockKind: 'code-sample'; codeSampleText: string }
  | { papelizHelpBlockKind: 'note'; noteText: string }

export interface PapelizHelpArticleSection {
  sectionHeading: string
  sectionAnchor: string
  sectionBlocks: readonly PapelizHelpContentBlock[]
}

export interface PapelizHelpArticle {
  papelizHelpArticleSlug: string
  articleTitle: string
  articleSummary: string
  papelizHelpGroupSlug: PapelizHelpGroupSlug
  papelizHelpArticleAvailability: PapelizHelpArticleAvailability
  articleSections: readonly PapelizHelpArticleSection[]
  relatedArticleSlugs: readonly string[]
}

// "Where your key goes" -> "where-your-key-goes"
export function makePapelizHelpAnchor(headingText: string): string {
  return headingText
    .toLowerCase()
    .replace(/[`*’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function helpSection(sectionHeading: string, sectionBlocks: readonly PapelizHelpContentBlock[]): PapelizHelpArticleSection {
  return { sectionHeading, sectionAnchor: makePapelizHelpAnchor(sectionHeading), sectionBlocks }
}

export function helpParagraph(paragraphText: string): PapelizHelpContentBlock {
  return { papelizHelpBlockKind: 'paragraph', paragraphText }
}

export function helpBulletList(bulletTexts: readonly string[]): PapelizHelpContentBlock {
  return { papelizHelpBlockKind: 'bullet-list', bulletTexts }
}

export function helpNumberedSteps(stepTexts: readonly string[]): PapelizHelpContentBlock {
  return { papelizHelpBlockKind: 'numbered-steps', stepTexts }
}

export function helpShortcutTable(shortcutRows: ReadonlyArray<readonly [string | readonly string[], string]>): PapelizHelpContentBlock {
  return {
    papelizHelpBlockKind: 'shortcut-table',
    shortcutRows: shortcutRows.map(([shortcutKeys, shortcutActionText]) => ({
      shortcutKeyCombinations: typeof shortcutKeys === 'string' ? [shortcutKeys] : shortcutKeys,
      shortcutActionText,
    })),
  }
}

export function helpDetailList(detailRows: ReadonlyArray<readonly [string, string]>): PapelizHelpContentBlock {
  return {
    papelizHelpBlockKind: 'detail-list',
    detailRows: detailRows.map(([detailLabel, detailValueText]) => ({ detailLabel, detailValueText })),
  }
}

export function helpCodeSample(codeSampleText: string): PapelizHelpContentBlock {
  return { papelizHelpBlockKind: 'code-sample', codeSampleText }
}

export function helpNote(noteText: string): PapelizHelpContentBlock {
  return { papelizHelpBlockKind: 'note', noteText }
}
