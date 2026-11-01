// What the jsDelivr and GitHub readers share: a template's repository name from a pasted link, the
// commit's shape, the error every read fails with (its message is a plain sentence), and a fetch that
// waits as long as a busy host asks (`retry-after`) before trying again.

export interface PapelizTemplateRepositoryName {
  templateRepositoryOwner: string
  templateRepositoryName: string
}

export type PapelizTemplateGalleryFetch = (requestUrl: string, requestInit?: RequestInit) => Promise<Response>

export interface PapelizTemplateGalleryReadOptions {
  // The page's fetch, or the tests' stand-in.
  templateGalleryFetch?: PapelizTemplateGalleryFetch
  templateReadAbortSignal?: AbortSignal
  // How a wait for `retry-after` passes; the tests pass time at once.
  waitTemplateReadMilliseconds?: (waitMilliseconds: number) => Promise<void>
}

// - `stopped`: the read was cancelled.
// - `repository-gone`: GitHub has no public repository by that name (private, deleted or renamed away).
// - `limit-reached`: GitHub's limit for this network is used up.
// - `unreachable`: the host couldn't be reached, or answered with an error.
// - `not-a-template`: what was read can't be a template (no commits, a bad link).
export type PapelizTemplateGalleryReadProblemKind = 'stopped' | 'repository-gone' | 'limit-reached' | 'unreachable' | 'not-a-template'

export class PapelizTemplateGalleryReadError extends Error {
  override readonly name = 'PapelizTemplateGalleryReadError'

  constructor(
    templateGalleryReadProblemSentence: string,
    readonly templateGalleryReadProblemKind: PapelizTemplateGalleryReadProblemKind,
  ) {
    super(templateGalleryReadProblemSentence)
  }
}

export const papelizTemplateReadStoppedSentence = 'Stopped.'

// GitHub's rules for names: an owner is letters, digits and single hyphens, up to 39 characters; a
// repository is letters, digits, ".", "-" and "_", up to 100.
const papelizGitHubOwnerNamePattern = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/
const papelizGitHubRepositoryNamePattern = /^[A-Za-z0-9._-]{1,100}$/
const papelizTemplateCommitShaPattern = /^[0-9a-f]{40}$/

export function isPapelizTemplateRepositoryName(templateRepositoryOwner: string, templateRepositoryName: string): boolean {
  return (
    papelizGitHubOwnerNamePattern.test(templateRepositoryOwner) &&
    papelizGitHubRepositoryNamePattern.test(templateRepositoryName) &&
    templateRepositoryName !== '.' &&
    templateRepositoryName !== '..'
  )
}

// A full 40-character commit SHA, the only kind jsDelivr caches for good.
export function isPapelizTemplateCommitSha(templateCommitSha: string): boolean {
  return papelizTemplateCommitShaPattern.test(templateCommitSha)
}

// "https://github.com/AdamNatad/P1-Workflow", "github.com/AdamNatad/P1-Workflow.git",
// "https://github.com/AdamNatad/P1-Workflow/tree/main/Guides" or "AdamNatad/P1-Workflow" ->
// AdamNatad and P1-Workflow; null for anything that isn't a GitHub repository.
export function parsePapelizTemplateRepositoryLink(typedTemplateRepositoryLink: string): PapelizTemplateRepositoryName | null {
  const trimmedRepositoryLink = typedTemplateRepositoryLink.trim()
  const repositoryPathText = /^(?:https?:\/\/)?(?:www\.)?github\.com\//i.test(trimmedRepositoryLink)
    ? trimmedRepositoryLink.replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '').replace(/[?#].*$/, '')
    : /^[^/\s:]+\/[^/\s:]+\/?$/.test(trimmedRepositoryLink)
      ? trimmedRepositoryLink
      : null
  if (repositoryPathText === null) return null
  const [templateRepositoryOwner = '', repositoryNameText = ''] = repositoryPathText.split('/')
  const templateRepositoryName = repositoryNameText.replace(/\.git$/i, '')
  return isPapelizTemplateRepositoryName(templateRepositoryOwner, templateRepositoryName) ? { templateRepositoryOwner, templateRepositoryName } : null
}

export function formatPapelizTemplateGalleryId(templateRepositoryName: PapelizTemplateRepositoryName): string {
  return `${templateRepositoryName.templateRepositoryOwner}/${templateRepositoryName.templateRepositoryName}`
}

// "AdamNatad/P1-Workflow" -> its owner and name; null for anything else.
export function splitPapelizTemplateGalleryId(papelizTemplateGalleryId: string): PapelizTemplateRepositoryName | null {
  const [templateRepositoryOwner = '', templateRepositoryName = '', ...extraIdParts] = papelizTemplateGalleryId.split('/')
  if (extraIdParts.length > 0 || !isPapelizTemplateRepositoryName(templateRepositoryOwner, templateRepositoryName)) return null
  return { templateRepositoryOwner, templateRepositoryName }
}

// A path's folders and name, each encoded for a URL: "Guides/Start here.md" -> "Guides/Start%20here.md".
export function encodePapelizTemplateFilePathForUrl(templateFileRelativePath: string): string {
  return templateFileRelativePath.split('/').map(encodeURIComponent).join('/')
}

export function throwIfPapelizTemplateReadStopped(templateReadAbortSignal: AbortSignal | undefined): void {
  if (templateReadAbortSignal?.aborted === true) throw new PapelizTemplateGalleryReadError(papelizTemplateReadStoppedSentence, 'stopped')
}

const papelizTemplateReadLongestRetryWaitMilliseconds = 60_000
const papelizTemplateReadMostAttemptCount = 3

function waitTemplateReadMillisecondsByTimer(waitMilliseconds: number): Promise<void> {
  return new Promise((resolveWait) => setTimeout(resolveWait, waitMilliseconds))
}

// `retry-after` in seconds, or as a date; null when it says neither.
export function readPapelizRetryAfterMilliseconds(retryAfterHeaderText: string | null, currentTime: number = Date.now()): number | null {
  if (retryAfterHeaderText === null) return null
  const retryAfterSeconds = Number(retryAfterHeaderText)
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) return retryAfterSeconds * 1000
  const retryAfterTime = Date.parse(retryAfterHeaderText)
  return Number.isNaN(retryAfterTime) ? null : Math.max(0, retryAfterTime - currentTime)
}

// One GET from jsDelivr or raw files. A 429 or 503 waits as long as `retry-after` says (a minute at
// most) and tries again, three times in all. A network failure throws `unreachable`; a cancelled
// read throws `stopped`. Any other answer comes back as it is.
export async function fetchPapelizTemplateGalleryResource(requestUrl: string, templateGalleryReadOptions: PapelizTemplateGalleryReadOptions): Promise<Response> {
  const templateGalleryFetch = templateGalleryReadOptions.templateGalleryFetch ?? ((fetchUrl, fetchInit) => fetch(fetchUrl, fetchInit))
  const waitTemplateReadMilliseconds = templateGalleryReadOptions.waitTemplateReadMilliseconds ?? waitTemplateReadMillisecondsByTimer
  for (let attemptNumber = 1; ; attemptNumber += 1) {
    throwIfPapelizTemplateReadStopped(templateGalleryReadOptions.templateReadAbortSignal)
    let templateResourceResponse: Response
    try {
      templateResourceResponse = await templateGalleryFetch(requestUrl, { signal: templateGalleryReadOptions.templateReadAbortSignal, credentials: 'omit', referrerPolicy: 'no-referrer' })
    } catch {
      throwIfPapelizTemplateReadStopped(templateGalleryReadOptions.templateReadAbortSignal)
      throw new PapelizTemplateGalleryReadError('Papeliz couldn’t reach the template’s files. Check your connection, then try again.', 'unreachable')
    }
    const isBusyAnswer = templateResourceResponse.status === 429 || templateResourceResponse.status === 503
    const retryAfterMilliseconds = readPapelizRetryAfterMilliseconds(templateResourceResponse.headers.get('retry-after'))
    if (!isBusyAnswer || attemptNumber >= papelizTemplateReadMostAttemptCount || retryAfterMilliseconds === null) return templateResourceResponse
    await waitTemplateReadMilliseconds(Math.min(retryAfterMilliseconds, papelizTemplateReadLongestRetryWaitMilliseconds))
  }
}
