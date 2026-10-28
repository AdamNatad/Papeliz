import {
  getVaultEntryParentFolderRelativePath,
  getVaultNoteTitle,
  isVaultNoteFileName,
  joinVaultRelativePath,
  papelizVaultNoteFileExtension,
} from '../vault/papeliz-vault-relative-paths'

// The parts of `[[Folder/Note#Heading|Label]]`.
export interface PapelizWikilinkParts {
  wikilinkTargetNoteName: string
  wikilinkTargetHeading: string | null
  wikilinkLabel: string | null
}

export function parsePapelizWikilinkInnerText(wikilinkInnerText: string): PapelizWikilinkParts {
  const labelSeparatorIndex = wikilinkInnerText.indexOf('|')
  // Inside a table the separator is written `\|`, so the pipe doesn't end the cell.
  const wikilinkTargetText = (labelSeparatorIndex === -1 ? wikilinkInnerText : wikilinkInnerText.slice(0, labelSeparatorIndex)).replace(/\\$/, '')
  const wikilinkLabelText = labelSeparatorIndex === -1 ? '' : wikilinkInnerText.slice(labelSeparatorIndex + 1).trim()
  const headingSeparatorIndex = wikilinkTargetText.indexOf('#')
  const wikilinkTargetNoteName = (headingSeparatorIndex === -1 ? wikilinkTargetText : wikilinkTargetText.slice(0, headingSeparatorIndex)).trim()
  const wikilinkTargetHeadingText = headingSeparatorIndex === -1 ? '' : wikilinkTargetText.slice(headingSeparatorIndex + 1).trim()
  return {
    wikilinkTargetNoteName,
    wikilinkTargetHeading: wikilinkTargetHeadingText.length > 0 ? wikilinkTargetHeadingText : null,
    wikilinkLabel: wikilinkLabelText.length > 0 ? wikilinkLabelText : null,
  }
}

export function getPapelizWikilinkDisplayText(wikilinkParts: PapelizWikilinkParts): string {
  if (wikilinkParts.wikilinkLabel !== null) return wikilinkParts.wikilinkLabel
  const wikilinkTargetTitle = getVaultNoteTitle(wikilinkParts.wikilinkTargetNoteName) || wikilinkParts.wikilinkTargetNoteName
  if (wikilinkParts.wikilinkTargetHeading === null) return wikilinkTargetTitle
  return wikilinkTargetTitle ? `${wikilinkTargetTitle} › ${wikilinkParts.wikilinkTargetHeading}` : wikilinkParts.wikilinkTargetHeading
}

function normalizeWikilinkTargetPath(wikilinkTargetNoteName: string): string {
  const withoutLeadingSlashes = wikilinkTargetNoteName.replace(/\\/g, '/').replace(/^(\.\/|\/)+/, '')
  return isVaultNoteFileName(withoutLeadingSlashes) ? withoutLeadingSlashes : `${withoutLeadingSlashes}${papelizVaultNoteFileExtension}`
}

export type PapelizWikilinkTargetResolver = (wikilinkTargetNoteName: string, fromVaultNoteRelativePath: string | null) => string | null

// Finds the note a wikilink points to, the way most Markdown vault apps do: an exact path first,
// then a path next to the linking note, then any note with that name (the nearest, then the
// shortest path). Names compare without case.
export function createPapelizWikilinkTargetResolver(vaultNoteRelativePaths: readonly string[]): PapelizWikilinkTargetResolver {
  const vaultNoteRelativePathsByLowerCasePath = new Map<string, string>()
  const vaultNoteRelativePathsByLowerCaseTitle = new Map<string, string[]>()
  for (const vaultNoteRelativePath of vaultNoteRelativePaths) {
    vaultNoteRelativePathsByLowerCasePath.set(vaultNoteRelativePath.toLowerCase(), vaultNoteRelativePath)
    const lowerCaseVaultNoteTitle = getVaultNoteTitle(vaultNoteRelativePath).toLowerCase()
    const sameTitleVaultNoteRelativePaths = vaultNoteRelativePathsByLowerCaseTitle.get(lowerCaseVaultNoteTitle) ?? []
    sameTitleVaultNoteRelativePaths.push(vaultNoteRelativePath)
    vaultNoteRelativePathsByLowerCaseTitle.set(lowerCaseVaultNoteTitle, sameTitleVaultNoteRelativePaths)
  }

  return (wikilinkTargetNoteName, fromVaultNoteRelativePath) => {
    if (wikilinkTargetNoteName.trim().length === 0) return fromVaultNoteRelativePath
    const lowerCaseTargetPath = normalizeWikilinkTargetPath(wikilinkTargetNoteName.trim()).toLowerCase()

    const exactVaultNoteRelativePath = vaultNoteRelativePathsByLowerCasePath.get(lowerCaseTargetPath)
    if (exactVaultNoteRelativePath !== undefined) return exactVaultNoteRelativePath

    const fromVaultFolderRelativePath = fromVaultNoteRelativePath === null ? '' : getVaultEntryParentFolderRelativePath(fromVaultNoteRelativePath)
    const besideVaultNoteRelativePath = vaultNoteRelativePathsByLowerCasePath.get(
      joinVaultRelativePath(fromVaultFolderRelativePath.toLowerCase(), lowerCaseTargetPath),
    )
    if (besideVaultNoteRelativePath !== undefined) return besideVaultNoteRelativePath

    const sameTitleVaultNoteRelativePaths = (vaultNoteRelativePathsByLowerCaseTitle.get(getVaultNoteTitle(lowerCaseTargetPath)) ?? []).filter(
      (candidateVaultNoteRelativePath) => {
        const lowerCaseCandidatePath = candidateVaultNoteRelativePath.toLowerCase()
        return lowerCaseCandidatePath === lowerCaseTargetPath || lowerCaseCandidatePath.endsWith(`/${lowerCaseTargetPath}`)
      },
    )
    if (sameTitleVaultNoteRelativePaths.length === 0) return null
    const lowerCaseFromFolderPrefix = fromVaultFolderRelativePath === '' ? '' : `${fromVaultFolderRelativePath.toLowerCase()}/`
    return [...sameTitleVaultNoteRelativePaths].sort((firstCandidatePath, secondCandidatePath) => {
      const firstIsNearby = lowerCaseFromFolderPrefix !== '' && firstCandidatePath.toLowerCase().startsWith(lowerCaseFromFolderPrefix)
      const secondIsNearby = lowerCaseFromFolderPrefix !== '' && secondCandidatePath.toLowerCase().startsWith(lowerCaseFromFolderPrefix)
      if (firstIsNearby !== secondIsNearby) return firstIsNearby ? -1 : 1
      return firstCandidatePath.split('/').length - secondCandidatePath.split('/').length || firstCandidatePath.localeCompare(secondCandidatePath)
    })[0] ?? null
  }
}

// Where a note created from an unresolved link goes: "[[Ideas/New thing]]" -> "Ideas/New thing.md".
export function getVaultNoteRelativePathForNewWikilinkTarget(wikilinkTargetNoteName: string): string {
  return normalizeWikilinkTargetPath(wikilinkTargetNoteName.trim())
}
