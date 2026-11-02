import { papelizSiteAppUrl } from './papeliz-site-config'

// Papeliz Templates on the website: the public list, the Templates Worker's hourly snapshot at
// /api/templates/gallery, as the Templates pages show it. A template is someone's own public GitHub
// repository, "<owner>/<repository>", and every word in a row comes from that repository. So a row
// is read as untrusted data: one of the wrong shape is left out, never shown.

export const papelizSiteTemplatesSnapshotPath = '/api/templates/gallery'

// A template stays New for its first 14 days, as in the app.
const papelizSiteTemplateNewDayCount = 14
const papelizSiteTemplateDayMilliseconds = 24 * 60 * 60 * 1000

export type PapelizSiteTemplateLicenseId = 'CC0-1.0' | 'CC-BY-4.0' | 'MIT'
export const papelizSiteTemplateLicenseDisplayNames: Readonly<Record<PapelizSiteTemplateLicenseId, string>> = {
  'CC0-1.0': 'CC0 1.0',
  'CC-BY-4.0': 'CC BY 4.0',
  MIT: 'MIT',
}

// A template's first tag is its Category, one of these; the second is its subcategory; any more are
// extra labels (Adam, 2026-11-02).
export type PapelizSiteTemplateCategoryTag = 'coding' | 'education' | 'research'
export const papelizSiteTemplateCategoryTags: readonly PapelizSiteTemplateCategoryTag[] = ['coding', 'education', 'research']

export interface PapelizSiteTemplatesSnapshotRow {
  // "<owner>/<repository>", as GitHub writes it.
  papelizTemplateGalleryId: string
  templateRepositoryOwner: string
  templateRepositoryName: string
  // The commit Papeliz checked; null only in the build's stand-in list, which knows no commit.
  templateCommitSha: string | null
  templateName: string
  templateDescription: string
  templateTags: string[]
  templateLicenseId: PapelizSiteTemplateLicenseId
  // Null when not known, as in the build's stand-in list.
  templateIncludedFileCount: number | null
  templateIncludedByteCount: number | null
  isTemplateRunningCommands: boolean
  isTemplateFeatured: boolean
  templateListedAt: number | null
  templateCheckedAt: number | null
  templateUpVoteCount: number
  templateDownVoteCount: number
  templateTopRank: number | null
}

export interface PapelizSiteTemplatesSnapshot {
  // When the Worker built the list; New is counted from it, so the build and the browser agree.
  templateGallerySnapshotBuiltAt: number | null
  // Papeliz's picks, in their order.
  featuredPapelizTemplateGalleryIds: string[]
  // Every listed template, newest first.
  templateGallerySnapshotRows: PapelizSiteTemplatesSnapshotRow[]
}

// GitHub's own rules: an owner is letters, digits and single hyphens, up to 39; a repository is
// letters, digits, ".", "-" and "_", up to 100, and never "." or "..". Both are safe in an address.
const papelizSiteTemplateRepositoryOwnerPattern = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/
const papelizSiteTemplateRepositoryNamePattern = /^[A-Za-z0-9._-]{1,100}$/
const papelizSiteTemplateCommitShaPattern = /^[0-9a-f]{40}$/
// The shape of every tag: lower-case words of letters and digits, joined by single hyphens.
const papelizSiteTemplateTagPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const papelizSiteTemplateMostTagCount = 5
const papelizSiteTemplateNameMostLength = 100
const papelizSiteTemplateDescriptionMostLength = 500

function isPapelizSiteTemplateCount(countCandidate: unknown): countCandidate is number {
  return Number.isSafeInteger(countCandidate) && (countCandidate as number) >= 0
}

function isPapelizSiteTemplateCountOrNull(countCandidate: unknown): countCandidate is number | null {
  return countCandidate === null || isPapelizSiteTemplateCount(countCandidate)
}

function isPapelizSiteTemplateText(textCandidate: unknown, textMostLength: number): textCandidate is string {
  return typeof textCandidate === 'string' && textCandidate.trim().length > 0 && textCandidate.length <= textMostLength
}

export function isPapelizSiteTemplateCategoryTag(templateTag: string): templateTag is PapelizSiteTemplateCategoryTag {
  return (papelizSiteTemplateCategoryTags as readonly string[]).includes(templateTag)
}

function isPapelizSiteTemplateRepositoryName(repositoryNameCandidate: unknown): repositoryNameCandidate is string {
  return (
    typeof repositoryNameCandidate === 'string' &&
    papelizSiteTemplateRepositoryNamePattern.test(repositoryNameCandidate) &&
    repositoryNameCandidate !== '.' &&
    repositoryNameCandidate !== '..'
  )
}

// One row, or null for anything not laid out as the snapshot's rows are.
export function readPapelizSiteTemplatesSnapshotRow(rowCandidate: unknown): PapelizSiteTemplatesSnapshotRow | null {
  if (typeof rowCandidate !== 'object' || rowCandidate === null) return null
  const row = rowCandidate as Record<string, unknown>
  const { templateRepositoryOwner, templateRepositoryName, templateTags, templateLicenseId } = row
  if (typeof templateRepositoryOwner !== 'string' || !papelizSiteTemplateRepositoryOwnerPattern.test(templateRepositoryOwner)) return null
  if (!isPapelizSiteTemplateRepositoryName(templateRepositoryName)) return null
  if (row.papelizTemplateGalleryId !== `${templateRepositoryOwner}/${templateRepositoryName}`) return null
  if (row.templateCommitSha !== null && (typeof row.templateCommitSha !== 'string' || !papelizSiteTemplateCommitShaPattern.test(row.templateCommitSha))) return null
  if (!isPapelizSiteTemplateText(row.templateName, papelizSiteTemplateNameMostLength)) return null
  if (!isPapelizSiteTemplateText(row.templateDescription, papelizSiteTemplateDescriptionMostLength)) return null
  if (
    !Array.isArray(templateTags) ||
    templateTags.length === 0 ||
    templateTags.length > papelizSiteTemplateMostTagCount ||
    !templateTags.every((templateTag) => typeof templateTag === 'string' && papelizSiteTemplateTagPattern.test(templateTag)) ||
    !isPapelizSiteTemplateCategoryTag(templateTags[0] as string)
  ) {
    return null
  }
  if (typeof templateLicenseId !== 'string' || !Object.hasOwn(papelizSiteTemplateLicenseDisplayNames, templateLicenseId)) return null
  if (typeof row.isTemplateRunningCommands !== 'boolean' || typeof row.isTemplateFeatured !== 'boolean') return null
  if (
    !isPapelizSiteTemplateCountOrNull(row.templateIncludedFileCount) ||
    !isPapelizSiteTemplateCountOrNull(row.templateIncludedByteCount) ||
    !isPapelizSiteTemplateCountOrNull(row.templateListedAt) ||
    !isPapelizSiteTemplateCountOrNull(row.templateCheckedAt) ||
    !isPapelizSiteTemplateCount(row.templateUpVoteCount) ||
    !isPapelizSiteTemplateCount(row.templateDownVoteCount) ||
    !isPapelizSiteTemplateCountOrNull(row.templateTopRank)
  ) {
    return null
  }
  return {
    papelizTemplateGalleryId: row.papelizTemplateGalleryId,
    templateRepositoryOwner,
    templateRepositoryName,
    templateCommitSha: row.templateCommitSha,
    templateName: row.templateName,
    templateDescription: row.templateDescription,
    templateTags: templateTags as string[],
    templateLicenseId: templateLicenseId as PapelizSiteTemplateLicenseId,
    templateIncludedFileCount: row.templateIncludedFileCount,
    templateIncludedByteCount: row.templateIncludedByteCount,
    isTemplateRunningCommands: row.isTemplateRunningCommands,
    isTemplateFeatured: row.isTemplateFeatured,
    templateListedAt: row.templateListedAt,
    templateCheckedAt: row.templateCheckedAt,
    templateUpVoteCount: row.templateUpVoteCount,
    templateDownVoteCount: row.templateDownVoteCount,
    templateTopRank: row.templateTopRank,
  }
}

// The snapshot as the Worker sends it, or null when it isn't one. Rows of the wrong shape, and a
// repository listed twice, are left out; the rest stay.
export function readPapelizSiteTemplatesSnapshot(snapshotCandidate: unknown): PapelizSiteTemplatesSnapshot | null {
  if (typeof snapshotCandidate !== 'object' || snapshotCandidate === null) return null
  const snapshot = snapshotCandidate as Record<string, unknown>
  if (snapshot.papelizTemplateGallerySnapshotVersion !== 1) return null
  if (!Array.isArray(snapshot.templateGallerySnapshotRows) || !Array.isArray(snapshot.featuredPapelizTemplateGalleryIds)) return null
  if (!isPapelizSiteTemplateCountOrNull(snapshot.templateGallerySnapshotBuiltAt ?? null)) return null
  const templateGallerySnapshotRows: PapelizSiteTemplatesSnapshotRow[] = []
  const seenTemplateRepositoryKeys = new Set<string>()
  for (const rowCandidate of snapshot.templateGallerySnapshotRows) {
    const snapshotRow = readPapelizSiteTemplatesSnapshotRow(rowCandidate)
    // GitHub names ignore case, so one repository is one template whatever its case.
    const templateRepositoryKey = snapshotRow?.papelizTemplateGalleryId.toLowerCase()
    if (snapshotRow === null || templateRepositoryKey === undefined || seenTemplateRepositoryKeys.has(templateRepositoryKey)) continue
    seenTemplateRepositoryKeys.add(templateRepositoryKey)
    templateGallerySnapshotRows.push(snapshotRow)
  }
  const listedTemplateGalleryIds = new Set(templateGallerySnapshotRows.map((snapshotRow) => snapshotRow.papelizTemplateGalleryId))
  return {
    templateGallerySnapshotBuiltAt: (snapshot.templateGallerySnapshotBuiltAt as number | null | undefined) ?? null,
    featuredPapelizTemplateGalleryIds: snapshot.featuredPapelizTemplateGalleryIds.filter(
      (featuredTemplateGalleryId): featuredTemplateGalleryId is string =>
        typeof featuredTemplateGalleryId === 'string' && listedTemplateGalleryIds.has(featuredTemplateGalleryId),
    ),
    templateGallerySnapshotRows,
  }
}

// Featured first, in Papeliz's order, then every other template newest first.
export function orderPapelizSiteTemplatesForList(papelizSiteTemplatesSnapshot: PapelizSiteTemplatesSnapshot): PapelizSiteTemplatesSnapshotRow[] {
  const snapshotRowsById = new Map(papelizSiteTemplatesSnapshot.templateGallerySnapshotRows.map((snapshotRow) => [snapshotRow.papelizTemplateGalleryId, snapshotRow]))
  const featuredSnapshotRows = papelizSiteTemplatesSnapshot.featuredPapelizTemplateGalleryIds.flatMap((featuredTemplateGalleryId) => {
    const featuredSnapshotRow = snapshotRowsById.get(featuredTemplateGalleryId)
    return featuredSnapshotRow ? [featuredSnapshotRow] : []
  })
  const featuredTemplateGalleryIds = new Set(featuredSnapshotRows.map((featuredSnapshotRow) => featuredSnapshotRow.papelizTemplateGalleryId))
  return [
    ...featuredSnapshotRows,
    ...papelizSiteTemplatesSnapshot.templateGallerySnapshotRows.filter((snapshotRow) => !featuredTemplateGalleryIds.has(snapshotRow.papelizTemplateGalleryId)),
  ]
}

// Short forms a tag's words keep in capitals, the same as in the app's tag names.
const papelizSiteTemplateTagAllCapsWords: ReadonlySet<string> = new Set(['ai', 'api', 'ui', 'ux', 'sql', 'css', 'html', 'json', 'cli', 'sdk'])

// A tag as the pages show it: every word with a capital first letter and the hyphens as spaces, with
// short forms in capitals ("project-workflow" -> "Project Workflow", "ai-agents" -> "AI Agents").
export function formatPapelizSiteTemplateTagDisplayName(templateTag: string): string {
  return templateTag
    .split('-')
    .filter((templateTagWord) => templateTagWord.length > 0)
    .map((templateTagWord) =>
      papelizSiteTemplateTagAllCapsWords.has(templateTagWord) ? templateTagWord.toUpperCase() : templateTagWord.charAt(0).toUpperCase() + templateTagWord.slice(1),
    )
    .join(' ')
}

export interface PapelizSiteTemplateCategoryNames {
  templateCategoryTag: PapelizSiteTemplateCategoryTag
  templateCategoryDisplayName: string
  templateSubcategoryDisplayName: string | null
  templateExtraTagDisplayNames: string[]
}

export function readPapelizSiteTemplateCategoryNames(snapshotRow: PapelizSiteTemplatesSnapshotRow): PapelizSiteTemplateCategoryNames {
  const [templateCategoryTag, templateSubcategoryTag, ...templateExtraTags] = snapshotRow.templateTags
  return {
    templateCategoryTag: templateCategoryTag as PapelizSiteTemplateCategoryTag,
    templateCategoryDisplayName: formatPapelizSiteTemplateTagDisplayName(templateCategoryTag ?? ''),
    templateSubcategoryDisplayName: templateSubcategoryTag === undefined ? null : formatPapelizSiteTemplateTagDisplayName(templateSubcategoryTag),
    templateExtraTagDisplayNames: templateExtraTags.map(formatPapelizSiteTemplateTagDisplayName),
  }
}

export function isPapelizSiteTemplateNew(snapshotRow: PapelizSiteTemplatesSnapshotRow, templateGallerySnapshotBuiltAt: number | null): boolean {
  if (snapshotRow.templateListedAt === null || templateGallerySnapshotBuiltAt === null) return false
  return templateGallerySnapshotBuiltAt - snapshotRow.templateListedAt < papelizSiteTemplateNewDayCount * papelizSiteTemplateDayMilliseconds
}

// The template's own page on this site, one per template the build knew.
export function createPapelizSiteTemplatePagePath(snapshotRow: Pick<PapelizSiteTemplatesSnapshotRow, 'templateRepositoryOwner' | 'templateRepositoryName'>): string {
  return `/templates/${snapshotRow.templateRepositoryOwner}/${snapshotRow.templateRepositoryName}/`
}

// Open in Papeliz: the app opens that template's page. The address holds only the template's public ID.
export function createPapelizSiteTemplateOpenInPapelizHref(snapshotRow: Pick<PapelizSiteTemplatesSnapshotRow, 'papelizTemplateGalleryId'>): string | null {
  if (!papelizSiteAppUrl) return null
  return `${papelizSiteAppUrl}?${new URLSearchParams({ papelizTemplateGalleryId: snapshotRow.papelizTemplateGalleryId }).toString()}`
}

// The repository on GitHub at the commit Papeliz checked, or the repository itself when no commit is known.
export function createPapelizSiteTemplateGitHubHref(snapshotRow: PapelizSiteTemplatesSnapshotRow): string {
  const templateRepositoryUrl = `https://github.com/${snapshotRow.templateRepositoryOwner}/${snapshotRow.templateRepositoryName}`
  return snapshotRow.templateCommitSha === null ? templateRepositoryUrl : `${templateRepositoryUrl}/tree/${snapshotRow.templateCommitSha}`
}

export function createPapelizSiteTemplateOwnerGitHubHref(snapshotRow: PapelizSiteTemplatesSnapshotRow): string {
  return `https://github.com/${snapshotRow.templateRepositoryOwner}`
}

// "120 KB", "3.4 MB": the way the app sizes a template.
export function formatPapelizSiteTemplateByteCount(templateByteCount: number): string {
  if (templateByteCount < 1000) return `${templateByteCount} B`
  if (templateByteCount < 1_000_000) return `${Math.round(templateByteCount / 1000)} KB`
  return `${(templateByteCount / 1_000_000).toFixed(1).replace(/\.0$/, '')} MB`
}

// "Nov 2, 2026", in UTC, so the build and every browser write the same day.
export function formatPapelizSiteTemplateDay(templateTime: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(templateTime)
}
