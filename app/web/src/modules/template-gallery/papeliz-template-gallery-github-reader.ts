import type { PapelizTemplateFileList, PapelizTemplateFileListEntry } from './papeliz-template-gallery-contract'
import {
  isPapelizTemplateCommitSha,
  PapelizTemplateGalleryReadError,
  throwIfPapelizTemplateReadStopped,
  type PapelizTemplateGalleryReadOptions,
  type PapelizTemplateRepositoryName,
} from './papeliz-template-gallery-network-reading'

// GitHub's public API, asked without signing in and with no token, only when someone presses Check or
// Recheck: the default branch's newest commit, in 1 call from the person's own address, of the 60 an
// hour GitHub allows it. Files never come from here; they come from jsDelivr at that commit
// (papeliz-template-gallery-jsdelivr-reader.ts). The one other call is the file list from GitHub's
// tree, when jsDelivr's list can't be read at all.

const papelizGitHubApiOrigin = 'https://api.github.com'

export interface PapelizTemplateRepositoryNewestCommit extends PapelizTemplateRepositoryName {
  templateNewestCommitSha: string
}

// The time GitHub's limit resets, as people read a clock: "3:42 PM".
function formatGitHubLimitResetTime(gitHubLimitResetTime: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(gitHubLimitResetTime))
}

// GitHub's answer as a sentence, when it isn't the one wanted.
export function describePapelizGitHubAnswerProblem(gitHubResponse: Response, templateRepositoryName: PapelizTemplateRepositoryName): PapelizTemplateGalleryReadError {
  const quotedRepositoryName = `“${templateRepositoryName.templateRepositoryOwner}/${templateRepositoryName.templateRepositoryName}”`
  if (gitHubResponse.status === 403 || gitHubResponse.status === 429) {
    const gitHubLimitResetSeconds = Number(gitHubResponse.headers.get('x-ratelimit-reset'))
    if (gitHubResponse.headers.get('x-ratelimit-remaining') === '0' && Number.isFinite(gitHubLimitResetSeconds) && gitHubLimitResetSeconds > 0) {
      return new PapelizTemplateGalleryReadError(
        `GitHub’s limit for your network is used up until ${formatGitHubLimitResetTime(gitHubLimitResetSeconds * 1000)}. Try again then.`,
        'limit-reached',
      )
    }
    const retryAfterSeconds = Number(gitHubResponse.headers.get('retry-after'))
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return new PapelizTemplateGalleryReadError(`GitHub asked Papeliz to slow down. Try again in ${Math.ceil(retryAfterSeconds)} seconds.`, 'limit-reached')
    }
    return new PapelizTemplateGalleryReadError('GitHub refused to answer just now. Try again in a few minutes.', 'limit-reached')
  }
  if (gitHubResponse.status === 404 || gitHubResponse.status === 451) {
    return new PapelizTemplateGalleryReadError(`GitHub has no public repository named ${quotedRepositoryName}. Check the link, and that the repository is public.`, 'repository-gone')
  }
  if (gitHubResponse.status === 409 || gitHubResponse.status === 422) return new PapelizTemplateGalleryReadError(`${quotedRepositoryName} has no commits yet.`, 'not-a-template')
  return new PapelizTemplateGalleryReadError(`GitHub answered with an error (${gitHubResponse.status}). Try again later.`, 'unreachable')
}

async function fetchFromGitHub(
  gitHubApiPath: string,
  gitHubAcceptHeader: string,
  templateRepositoryName: PapelizTemplateRepositoryName,
  templateGalleryReadOptions: PapelizTemplateGalleryReadOptions,
): Promise<Response> {
  const templateGalleryFetch = templateGalleryReadOptions.templateGalleryFetch ?? ((fetchUrl, fetchInit) => fetch(fetchUrl, fetchInit))
  throwIfPapelizTemplateReadStopped(templateGalleryReadOptions.templateReadAbortSignal)
  let gitHubResponse: Response
  try {
    // Only a CORS-safe Accept header, so the browser sends no preflight first.
    gitHubResponse = await templateGalleryFetch(`${papelizGitHubApiOrigin}${gitHubApiPath}`, {
      headers: { Accept: gitHubAcceptHeader },
      signal: templateGalleryReadOptions.templateReadAbortSignal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
  } catch {
    throwIfPapelizTemplateReadStopped(templateGalleryReadOptions.templateReadAbortSignal)
    throw new PapelizTemplateGalleryReadError('Papeliz couldn’t reach GitHub. Check your connection, then try again.', 'unreachable')
  }
  if (!gitHubResponse.ok) throw describePapelizGitHubAnswerProblem(gitHubResponse, templateRepositoryName)
  return gitHubResponse
}

function encodeRepositoryApiPath(templateRepositoryName: PapelizTemplateRepositoryName): string {
  return `/repos/${encodeURIComponent(templateRepositoryName.templateRepositoryOwner)}/${encodeURIComponent(templateRepositoryName.templateRepositoryName)}`
}

// The default branch's newest commit, as a full SHA. A private or missing repository answers 404.
export async function readPapelizTemplateRepositoryNewestCommit(
  templateRepositoryName: PapelizTemplateRepositoryName,
  templateGalleryReadOptions: PapelizTemplateGalleryReadOptions = {},
): Promise<PapelizTemplateRepositoryNewestCommit> {
  const commitResponse = await fetchFromGitHub(`${encodeRepositoryApiPath(templateRepositoryName)}/commits/HEAD`, 'application/vnd.github.sha', templateRepositoryName, templateGalleryReadOptions)
  const templateNewestCommitSha = (await commitResponse.text()).trim()
  if (!isPapelizTemplateCommitSha(templateNewestCommitSha)) throw new PapelizTemplateGalleryReadError('GitHub’s answer about the newest commit didn’t read. Try again later.', 'unreachable')
  return { ...templateRepositoryName, templateNewestCommitSha }
}

// The file list from GitHub's tree at a commit, with each file's size and blob SHA-1. Used only when
// jsDelivr's list can't be read. A submodule has no files here either, as in jsDelivr's list.
export async function readPapelizTemplateFileListFromGitHubTree(
  templateRepositoryName: PapelizTemplateRepositoryName,
  templateCommitSha: string,
  templateGalleryReadOptions: PapelizTemplateGalleryReadOptions = {},
): Promise<PapelizTemplateFileList> {
  const treeResponse = await fetchFromGitHub(
    `${encodeRepositoryApiPath(templateRepositoryName)}/git/trees/${templateCommitSha}?recursive=1`,
    'application/vnd.github+json',
    templateRepositoryName,
    templateGalleryReadOptions,
  )
  const treeAnswer = (await treeResponse.json().catch(() => null)) as { tree?: unknown; truncated?: unknown } | null
  if (!Array.isArray(treeAnswer?.tree)) throw new PapelizTemplateGalleryReadError('GitHub’s file list didn’t read. Try again later.', 'unreachable')
  const templateFileListEntries: PapelizTemplateFileListEntry[] = []
  for (const treeItem of treeAnswer.tree as Array<{ path?: unknown; type?: unknown; sha?: unknown; size?: unknown }>) {
    if (treeItem.type !== 'blob' || typeof treeItem.path !== 'string' || typeof treeItem.sha !== 'string') continue
    templateFileListEntries.push({
      templateFileRelativePath: treeItem.path,
      templateFileByteCount: typeof treeItem.size === 'number' ? treeItem.size : 0,
      templateFileSha256Base64: null,
      templateFileGitBlobSha1Hex: treeItem.sha,
    })
  }
  return { templateFileListEntries, isTemplateFileListTruncated: treeAnswer.truncated === true, templateFileListSource: 'github-tree' }
}
