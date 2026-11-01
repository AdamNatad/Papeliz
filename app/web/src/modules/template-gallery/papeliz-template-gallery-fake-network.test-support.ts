import { computePapelizTemplateFileGitBlobSha1Hex, computePapelizTemplateFileSha256Base64 } from './papeliz-template-gallery-checks'
import type { PapelizTemplateGalleryFetch } from './papeliz-template-gallery-network-reading'
import type { PapelizFixtureTemplateFiles } from './papeliz-template-gallery-fixtures.test-support'

// Test support only: GitHub's API, jsDelivr and raw files in memory, answering the same addresses the
// readers ask, so nothing in the tests reaches the network. Each repository has commits, each a set of
// files; its default branch (HEAD) points at the newest.

export interface PapelizFakeTemplateRepository {
  templateRepositoryOwner: string
  templateRepositoryName: string
  templateFilesByCommitSha: Record<string, PapelizFixtureTemplateFiles>
  newestTemplateCommitSha: string
  isTemplateRepositoryPrivate?: boolean
}

export interface PapelizFakeTemplateNetworkOptions {
  isJsdelivrDataDown?: boolean
  isJsdelivrFilesDown?: boolean
  isGitHubRawDown?: boolean
  // jsDelivr gives these files with their bytes changed.
  changedJsdelivrFileRelativePaths?: string[]
  // jsDelivr's files answer 429 with `retry-after: 2` this many times before answering.
  busyJsdelivrFileAnswerCount?: number
  // GitHub's API answers 403 with its limit used up, resetting at this time (seconds since 1970).
  gitHubLimitResetSeconds?: number
}

export interface PapelizFakeTemplateNetwork {
  templateGalleryFetch: PapelizTemplateGalleryFetch
  fakeRequestedUrls: string[]
}

function toFixtureBytes(fixtureFileContents: string | Uint8Array): Uint8Array {
  return typeof fixtureFileContents === 'string' ? new TextEncoder().encode(fixtureFileContents) : fixtureFileContents
}

function answerJson(answerBody: unknown, answerStatus = 200): Response {
  return new Response(JSON.stringify(answerBody), { status: answerStatus, headers: { 'content-type': 'application/json' } })
}

export function createPapelizFakeTemplateNetwork(
  fakeTemplateRepositories: readonly PapelizFakeTemplateRepository[],
  fakeNetworkOptions: PapelizFakeTemplateNetworkOptions = {},
): PapelizFakeTemplateNetwork {
  const fakeRequestedUrls: string[] = []
  let busyJsdelivrFileAnswersLeft = fakeNetworkOptions.busyJsdelivrFileAnswerCount ?? 0
  const findFakeRepository = (repositoryOwner: string, repositoryName: string) =>
    fakeTemplateRepositories.find(
      (fakeTemplateRepository) =>
        fakeTemplateRepository.templateRepositoryOwner.toLowerCase() === decodeURIComponent(repositoryOwner).toLowerCase() &&
        fakeTemplateRepository.templateRepositoryName.toLowerCase() === decodeURIComponent(repositoryName).toLowerCase(),
    )
  const findFakeFile = (fakeTemplateRepository: PapelizFakeTemplateRepository | undefined, templateCommitSha: string, encodedFilePath: string): Uint8Array | null => {
    const fixtureFileContents = fakeTemplateRepository?.templateFilesByCommitSha[templateCommitSha]?.[encodedFilePath.split('/').map(decodeURIComponent).join('/')]
    return fixtureFileContents === undefined ? null : toFixtureBytes(fixtureFileContents)
  }

  const templateGalleryFetch: PapelizTemplateGalleryFetch = async (requestUrl) => {
    fakeRequestedUrls.push(requestUrl)
    const parsedRequestUrl = new URL(requestUrl)
    const requestPath = parsedRequestUrl.pathname

    if (parsedRequestUrl.host === 'api.github.com') {
      if (fakeNetworkOptions.gitHubLimitResetSeconds !== undefined) {
        return new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
          status: 403,
          headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': `${fakeNetworkOptions.gitHubLimitResetSeconds}` },
        })
      }
      const repositoryMatch = /^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/.exec(requestPath)
      const fakeTemplateRepository = repositoryMatch === null ? undefined : findFakeRepository(repositoryMatch[1] ?? '', repositoryMatch[2] ?? '')
      if (fakeTemplateRepository === undefined || fakeTemplateRepository.isTemplateRepositoryPrivate === true) return answerJson({ message: 'Not Found' }, 404)
      const repositoryApiRest = repositoryMatch?.[3] ?? ''
      if (repositoryApiRest === '/commits/HEAD') return new Response(fakeTemplateRepository.newestTemplateCommitSha, { status: 200 })
      const treeMatch = /^\/git\/trees\/([0-9a-f]{40})$/.exec(repositoryApiRest)
      const treeFiles = treeMatch === null ? undefined : fakeTemplateRepository.templateFilesByCommitSha[treeMatch[1] ?? '']
      if (treeFiles === undefined) return answerJson({ message: 'Not Found' }, 404)
      const treeItems = []
      for (const [treeFileRelativePath, treeFileContents] of Object.entries(treeFiles)) {
        const treeFileBytes = toFixtureBytes(treeFileContents)
        treeItems.push({
          path: treeFileRelativePath,
          mode: '100644',
          type: 'blob',
          sha: await computePapelizTemplateFileGitBlobSha1Hex(treeFileBytes),
          size: treeFileBytes.length,
        })
      }
      return answerJson({ tree: treeItems, truncated: false })
    }

    if (parsedRequestUrl.host === 'data.jsdelivr.com') {
      if (fakeNetworkOptions.isJsdelivrDataDown === true) return new Response('down', { status: 502 })
      const fileListMatch = /^\/v1\/packages\/gh\/([^/]+)\/([^@/]+)@([0-9a-f]{40})$/.exec(requestPath)
      const fakeTemplateRepository = fileListMatch === null ? undefined : findFakeRepository(fileListMatch[1] ?? '', fileListMatch[2] ?? '')
      const listedFiles = fakeTemplateRepository?.templateFilesByCommitSha[fileListMatch?.[3] ?? '']
      if (listedFiles === undefined || parsedRequestUrl.searchParams.get('structure') !== 'flat') return answerJson({ status: 404, message: 'Not Found' }, 404)
      const jsdelivrListedFiles = []
      for (const [listedFileRelativePath, listedFileContents] of Object.entries(listedFiles)) {
        const listedFileBytes = toFixtureBytes(listedFileContents)
        jsdelivrListedFiles.push({ name: `/${listedFileRelativePath}`, hash: await computePapelizTemplateFileSha256Base64(listedFileBytes), time: '2026-11-01T00:00:00.000Z', size: listedFileBytes.length })
      }
      return answerJson({ default: null, files: jsdelivrListedFiles })
    }

    if (parsedRequestUrl.host === 'cdn.jsdelivr.net') {
      if (fakeNetworkOptions.isJsdelivrFilesDown === true) throw new TypeError('Failed to fetch')
      if (busyJsdelivrFileAnswersLeft > 0) {
        busyJsdelivrFileAnswersLeft -= 1
        return new Response('slow down', { status: 429, headers: { 'retry-after': '2' } })
      }
      const cdnFileMatch = /^\/gh\/([^/]+)\/([^@/]+)@([0-9a-f]{40})\/(.+)$/.exec(requestPath)
      const cdnFileBytes = cdnFileMatch === null ? null : findFakeFile(findFakeRepository(cdnFileMatch[1] ?? '', cdnFileMatch[2] ?? ''), cdnFileMatch[3] ?? '', cdnFileMatch[4] ?? '')
      if (cdnFileBytes === null) return new Response('Not Found', { status: 404 })
      const cdnFileRelativePath = (cdnFileMatch?.[4] ?? '').split('/').map(decodeURIComponent).join('/')
      if (fakeNetworkOptions.changedJsdelivrFileRelativePaths?.includes(cdnFileRelativePath) === true) {
        return new Response(new Uint8Array([...cdnFileBytes, 0x21]), { status: 200 })
      }
      return new Response(cdnFileBytes as Uint8Array<ArrayBuffer>, { status: 200 })
    }

    if (parsedRequestUrl.host === 'raw.githubusercontent.com') {
      if (fakeNetworkOptions.isGitHubRawDown === true) throw new TypeError('Failed to fetch')
      const rawFileMatch = /^\/([^/]+)\/([^/]+)\/([0-9a-f]{40})\/(.+)$/.exec(requestPath)
      const rawFileBytes = rawFileMatch === null ? null : findFakeFile(findFakeRepository(rawFileMatch[1] ?? '', rawFileMatch[2] ?? ''), rawFileMatch[3] ?? '', rawFileMatch[4] ?? '')
      return rawFileBytes === null ? new Response('404: Not Found', { status: 404 }) : new Response(rawFileBytes as Uint8Array<ArrayBuffer>, { status: 200 })
    }

    throw new Error(`The tests reached for the network: ${requestUrl}`)
  }
  return { templateGalleryFetch, fakeRequestedUrls }
}
