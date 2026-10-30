import { getVaultNoteTitle, splitVaultRelativePath } from '../vault/papeliz-vault-relative-paths'

// Where each note's page goes in an exported website: web-friendly names in the vault's own
// folders. "Projects/Launch plan.md" -> "projects/launch-plan" (then ".html" for the page and ".md"
// for its Markdown twin). Names that would clash get "-2", "-3". A folder and a note may share a
// name: "projects/" and "projects.html" sit side by side.

// The site's own names at its root: its home page, and the folders it keeps beside the notes.
const papelizHtmlExportSiteReservedRootNoteSlugs: readonly string[] = ['index']
const papelizHtmlExportSiteReservedRootFolderSlugs: readonly string[] = ['papeliz-site', 'attachments', 'astro-project']

function slugifyPapelizHtmlExportSitePathSegment(vaultPathSegment: string, emptySegmentSlug: string): string {
  const pathSegmentSlug = vaultPathSegment
    .normalize('NFC')
    .toLowerCase()
    // "What's next" -> "whats-next", as GitHub writes heading ids.
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}_ -]+/gu, ' ')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return pathSegmentSlug.length > 0 ? pathSegmentSlug : emptySegmentSlug
}

function pickFreePapelizHtmlExportSiteSlug(wantedSlug: string, takenSlugs: Set<string>): string {
  let freeSlug = wantedSlug
  for (let slugNumber = 2; takenSlugs.has(freeSlug); slugNumber += 1) freeSlug = `${wantedSlug}-${slugNumber}`
  takenSlugs.add(freeSlug)
  return freeSlug
}

// Each note's page path without its extension, by the note's vault path.
export function createPapelizHtmlExportSitePageBasePaths(vaultNoteRelativePaths: readonly string[]): Map<string, string> {
  const takenFolderSlugsByParentSlugPath = new Map<string, Set<string>>([['', new Set(papelizHtmlExportSiteReservedRootFolderSlugs)]])
  const takenNoteSlugsByFolderSlugPath = new Map<string, Set<string>>([['', new Set(papelizHtmlExportSiteReservedRootNoteSlugs)]])
  const folderSlugPathsByVaultFolderPath = new Map<string, string>([['', '']])
  const getTakenSlugs = (takenSlugsByFolderSlugPath: Map<string, Set<string>>, folderSlugPath: string) => {
    const takenSlugs = takenSlugsByFolderSlugPath.get(folderSlugPath) ?? new Set<string>()
    takenSlugsByFolderSlugPath.set(folderSlugPath, takenSlugs)
    return takenSlugs
  }
  const getFolderSlugPath = (vaultFolderPathSegments: readonly string[]): string => {
    const knownFolderSlugPath = folderSlugPathsByVaultFolderPath.get(vaultFolderPathSegments.join('/'))
    if (knownFolderSlugPath !== undefined) return knownFolderSlugPath
    const parentFolderSlugPath = getFolderSlugPath(vaultFolderPathSegments.slice(0, -1))
    const folderSlug = pickFreePapelizHtmlExportSiteSlug(
      slugifyPapelizHtmlExportSitePathSegment(vaultFolderPathSegments[vaultFolderPathSegments.length - 1] ?? '', 'folder'),
      getTakenSlugs(takenFolderSlugsByParentSlugPath, parentFolderSlugPath),
    )
    const folderSlugPath = parentFolderSlugPath === '' ? folderSlug : `${parentFolderSlugPath}/${folderSlug}`
    folderSlugPathsByVaultFolderPath.set(vaultFolderPathSegments.join('/'), folderSlugPath)
    return folderSlugPath
  }

  const pageBasePathsByVaultNoteRelativePath = new Map<string, string>()
  for (const vaultNoteRelativePath of vaultNoteRelativePaths) {
    const folderSlugPath = getFolderSlugPath(splitVaultRelativePath(vaultNoteRelativePath).slice(0, -1))
    const noteSlug = pickFreePapelizHtmlExportSiteSlug(
      slugifyPapelizHtmlExportSitePathSegment(getVaultNoteTitle(vaultNoteRelativePath), 'note'),
      getTakenSlugs(takenNoteSlugsByFolderSlugPath, folderSlugPath),
    )
    pageBasePathsByVaultNoteRelativePath.set(vaultNoteRelativePath, folderSlugPath === '' ? noteSlug : `${folderSlugPath}/${noteSlug}`)
  }
  return pageBasePathsByVaultNoteRelativePath
}

// "../" once per folder a page sits in: how a page reaches the site's root.
export function getPapelizHtmlExportSiteRootHref(sitePageFilePath: string): string {
  return '../'.repeat(splitVaultRelativePath(sitePageFilePath).length - 1)
}

// The link from one site file to another, relative, so it works opened from disk and under any
// web address: "projects/launch-plan.html" -> "guides/callouts.html" gives "../guides/callouts.html".
export function getPapelizHtmlExportSiteRelativeHref(fromSiteFilePath: string, toSiteFilePath: string): string {
  const fromFolderSegments = splitVaultRelativePath(fromSiteFilePath).slice(0, -1)
  const toPathSegments = splitVaultRelativePath(toSiteFilePath)
  let sharedSegmentCount = 0
  while (
    sharedSegmentCount < fromFolderSegments.length &&
    sharedSegmentCount < toPathSegments.length - 1 &&
    fromFolderSegments[sharedSegmentCount] === toPathSegments[sharedSegmentCount]
  ) {
    sharedSegmentCount += 1
  }
  const upSegments = fromFolderSegments.slice(sharedSegmentCount).map(() => '..')
  const downSegments = toPathSegments.slice(sharedSegmentCount).map((toPathSegment) => encodeURIComponent(toPathSegment))
  return [...upSegments, ...downSegments].join('/')
}
