import { formatPapelizJsdelivrFileUrl } from './papeliz-template-gallery-jsdelivr-reader'
import type { PapelizTemplateRepositoryName } from './papeliz-template-gallery-network-reading'
import { findPapelizTemplatePictureFormatByName } from './papeliz-template-gallery-picture-metadata'

// Where a template's pictures may come from, so that showing one tells no other host who is looking:
// jsDelivr at the commit Papeliz knows, the repository's own raw files on GitHub, and GitHub's own
// picture hosts (pictures attached on GitHub, and people's GitHub pictures). Every one is shown with
// <img> only, with no referrer. A picture anywhere else isn't shown. Pure, so the Templates Worker can
// check a thumbnail's address with it too.

export interface PapelizTemplatePictureSource extends PapelizTemplateRepositoryName {
  templateCommitSha: string
}

const papelizGitHubAuthorPictureOrigin = 'https://avatars.githubusercontent.com'

// The repository owner's GitHub picture, `authorPictureSize` pixels square.
export function buildPapelizTemplateAuthorPictureUrl(templateRepositoryOwner: string, authorPictureSize: number): string {
  return `${papelizGitHubAuthorPictureOrigin}/${encodeURIComponent(templateRepositoryOwner)}?s=${Math.round(authorPictureSize)}`
}

function decodeTemplatePictureUrlPath(pictureUrlPath: string): string | null {
  try {
    return decodeURIComponent(pictureUrlPath)
  } catch {
    return null
  }
}

// Whether a web picture's address is on a host the template may show pictures from: jsDelivr at this
// repository and commit, this repository's raw files, a picture attached on GitHub, or a GitHub
// person's picture. Owner and repository names compare in any case, as GitHub's do.
export function isPapelizTemplatePictureUrlAllowed(templatePictureSource: PapelizTemplatePictureSource, templatePictureUrl: string): boolean {
  let parsedPictureUrl: URL
  try {
    parsedPictureUrl = new URL(templatePictureUrl)
  } catch {
    return false
  }
  if (parsedPictureUrl.protocol !== 'https:' || parsedPictureUrl.username !== '' || parsedPictureUrl.password !== '' || parsedPictureUrl.port !== '') return false
  const decodedPicturePath = decodeTemplatePictureUrlPath(parsedPictureUrl.pathname)
  if (decodedPicturePath === null || decodedPicturePath.split('/').some((picturePathSegment) => picturePathSegment === '..' || picturePathSegment === '.')) return false
  const lowerCasePicturePath = decodedPicturePath.toLowerCase()
  const lowerCaseRepositoryPath = `/${templatePictureSource.templateRepositoryOwner}/${templatePictureSource.templateRepositoryName}/`.toLowerCase()
  switch (parsedPictureUrl.hostname) {
    case 'cdn.jsdelivr.net':
      return lowerCasePicturePath.startsWith(`/gh${lowerCaseRepositoryPath.slice(0, -1)}@${templatePictureSource.templateCommitSha}/`)
    case 'raw.githubusercontent.com':
      return lowerCasePicturePath.startsWith(lowerCaseRepositoryPath)
    case 'github.com':
      return lowerCasePicturePath.startsWith('/user-attachments/assets/') || lowerCasePicturePath.startsWith(`${lowerCaseRepositoryPath}raw/`)
    case 'user-images.githubusercontent.com':
    case 'avatars.githubusercontent.com':
      return true
    default:
      return false
  }
}

// A picture in one of the template's notes, as the page shows it: a web address on an allowed host as
// it is; a path in the repository ("beds.png", "../pictures/a.webp", "/pictures/a.webp" from the
// root), when the template includes that PNG, JPEG or WebP picture, at the address
// `buildTemplateFilePictureUrl` gives (jsDelivr at the commit, unless given another); null for
// anything else, which the page shows as the picture's name.
export function resolvePapelizTemplateNotePictureUrl(
  templatePictureSource: PapelizTemplatePictureSource,
  templateNoteRelativePath: string,
  notePictureAddress: string,
  isTemplateFileIncluded: (templateFileRelativePath: string) => boolean,
  buildTemplateFilePictureUrl: (pictureRelativePath: string) => string = (pictureRelativePath) =>
    formatPapelizJsdelivrFileUrl(templatePictureSource, templatePictureSource.templateCommitSha, pictureRelativePath),
): string | null {
  const trimmedPictureAddress = notePictureAddress.trim()
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmedPictureAddress) || trimmedPictureAddress.startsWith('//')) {
    return isPapelizTemplatePictureUrlAllowed(templatePictureSource, trimmedPictureAddress) ? trimmedPictureAddress : null
  }
  const decodedPicturePath = decodeTemplatePictureUrlPath(trimmedPictureAddress.replace(/[?#].*$/, ''))
  if (decodedPicturePath === null || decodedPicturePath.length === 0) return null
  const resolvedPathSegments = decodedPicturePath.startsWith('/') ? [] : templateNoteRelativePath.split('/').slice(0, -1)
  for (const picturePathSegment of decodedPicturePath.split('/')) {
    if (picturePathSegment === '' || picturePathSegment === '.') continue
    if (picturePathSegment === '..') {
      if (resolvedPathSegments.length === 0) return null
      resolvedPathSegments.pop()
    } else {
      resolvedPathSegments.push(picturePathSegment)
    }
  }
  const pictureRelativePath = resolvedPathSegments.join('/')
  if (findPapelizTemplatePictureFormatByName(pictureRelativePath) === null || !isTemplateFileIncluded(pictureRelativePath)) return null
  return buildTemplateFilePictureUrl(pictureRelativePath)
}
