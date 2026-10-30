import { getVaultEntryName, getVaultEntryParentFolderRelativePath, splitVaultRelativePath } from '../vault/papeliz-vault-relative-paths'

// The vault's files that aren't notes, as an export meets them: a picture a note shows
// (`![Plan](pictures/plan.png)`, `![[plan.png]]`) or a file it links to (`[the brief](brief.pdf)`).

const papelizHtmlExportPictureMediaTypesByExtension: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
}

// "pictures/plan.PNG" -> "image/png"; null for a file a page can't show as a picture.
export function getPapelizHtmlExportPictureMediaType(vaultFileRelativePath: string): string | null {
  const fileExtension = /\.([^./]+)$/.exec(vaultFileRelativePath)?.[1]?.toLowerCase() ?? ''
  return papelizHtmlExportPictureMediaTypesByExtension[fileExtension] ?? null
}

export type PapelizHtmlExportVaultFileResolver = (vaultFileReference: string, fromVaultNoteRelativePath: string) => string | null

// Follows "." and "..": ["Projects"] + ["..", "pictures", "plan.png"] -> "pictures/plan.png";
// null when it would leave the vault.
function followRelativePathSegments(baseFolderSegments: readonly string[], referenceSegments: readonly string[]): string | null {
  const resolvedSegments = [...baseFolderSegments]
  for (const referenceSegment of referenceSegments) {
    if (referenceSegment === '.') continue
    if (referenceSegment === '..') {
      if (resolvedSegments.length === 0) return null
      resolvedSegments.pop()
    } else {
      resolvedSegments.push(referenceSegment)
    }
  }
  return resolvedSegments.join('/')
}

// Finds the file a note means, the way a wikilink finds its note: the path beside the note first,
// then from the vault's root, then any file with that name (the nearest to the note, then the
// shortest path). Names compare without case.
export function createPapelizHtmlExportVaultFileResolver(vaultAttachmentFileRelativePaths: readonly string[]): PapelizHtmlExportVaultFileResolver {
  const vaultFileRelativePathsByLowerCasePath = new Map<string, string>()
  const vaultFileRelativePathsByLowerCaseName = new Map<string, string[]>()
  for (const vaultFileRelativePath of vaultAttachmentFileRelativePaths) {
    vaultFileRelativePathsByLowerCasePath.set(vaultFileRelativePath.toLowerCase(), vaultFileRelativePath)
    const lowerCaseFileName = getVaultEntryName(vaultFileRelativePath).toLowerCase()
    vaultFileRelativePathsByLowerCaseName.set(lowerCaseFileName, [...(vaultFileRelativePathsByLowerCaseName.get(lowerCaseFileName) ?? []), vaultFileRelativePath])
  }

  return (vaultFileReference, fromVaultNoteRelativePath) => {
    const cleanedFileReference = vaultFileReference.replace(/\\/g, '/').trim()
    const referenceSegments = splitVaultRelativePath(cleanedFileReference)
    if (referenceSegments.length === 0) return null
    const findVaultFile = (candidatePath: string | null) => (candidatePath === null ? undefined : vaultFileRelativePathsByLowerCasePath.get(candidatePath.toLowerCase()))

    const fromFolderSegments = splitVaultRelativePath(getVaultEntryParentFolderRelativePath(fromVaultNoteRelativePath))
    const besideVaultFileRelativePath = cleanedFileReference.startsWith('/') ? undefined : findVaultFile(followRelativePathSegments(fromFolderSegments, referenceSegments))
    if (besideVaultFileRelativePath !== undefined) return besideVaultFileRelativePath
    const fromRootVaultFileRelativePath = findVaultFile(followRelativePathSegments([], referenceSegments))
    if (fromRootVaultFileRelativePath !== undefined) return fromRootVaultFileRelativePath

    const lowerCaseReferencePath = referenceSegments.filter((referenceSegment) => referenceSegment !== '.' && referenceSegment !== '..').join('/').toLowerCase()
    const sameNameVaultFileRelativePaths = (vaultFileRelativePathsByLowerCaseName.get(getVaultEntryName(lowerCaseReferencePath)) ?? []).filter((candidatePath) => {
      const lowerCaseCandidatePath = candidatePath.toLowerCase()
      return lowerCaseCandidatePath === lowerCaseReferencePath || lowerCaseCandidatePath.endsWith(`/${lowerCaseReferencePath}`)
    })
    const lowerCaseFromFolderPrefix = fromFolderSegments.length === 0 ? '' : `${fromFolderSegments.join('/').toLowerCase()}/`
    return (
      [...sameNameVaultFileRelativePaths].sort((firstCandidatePath, secondCandidatePath) => {
        const isFirstNearby = lowerCaseFromFolderPrefix !== '' && firstCandidatePath.toLowerCase().startsWith(lowerCaseFromFolderPrefix)
        const isSecondNearby = lowerCaseFromFolderPrefix !== '' && secondCandidatePath.toLowerCase().startsWith(lowerCaseFromFolderPrefix)
        if (isFirstNearby !== isSecondNearby) return isFirstNearby ? -1 : 1
        return firstCandidatePath.split('/').length - secondCandidatePath.split('/').length || (firstCandidatePath < secondCandidatePath ? -1 : 1)
      })[0] ?? null
    )
  }
}
