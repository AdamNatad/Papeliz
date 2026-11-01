import { computePapelizTemplateFileGitBlobSha1Hex, computePapelizTemplateFileSha256Base64 } from './papeliz-template-gallery-checks'
import type { PapelizTemplateFileList, PapelizTemplateFileListEntry, PapelizTemplateFileReadProgress } from './papeliz-template-gallery-contract'
import { readPapelizTemplateFileListFromGitHubTree } from './papeliz-template-gallery-github-reader'
import {
  encodePapelizTemplateFilePathForUrl,
  fetchPapelizTemplateGalleryResource,
  isPapelizTemplateCommitSha,
  PapelizTemplateGalleryReadError,
  throwIfPapelizTemplateReadStopped,
  type PapelizTemplateGalleryReadOptions,
  type PapelizTemplateRepositoryName,
} from './papeliz-template-gallery-network-reading'

// A template's file list and files, read from jsDelivr at the commit Papeliz knows, never by branch
// name: jsDelivr keeps a commit's files unchanged for good, with no GitHub limit. Each file is checked
// against the list's SHA-256 as it arrives. When jsDelivr can't be reached, or gives a file that
// doesn't match, the same commit is read from raw.githubusercontent.com; when jsDelivr's list can't be
// read, the list comes from GitHub's tree at that commit.

const papelizJsdelivrDataOrigin = 'https://data.jsdelivr.com'
const papelizJsdelivrFilesOrigin = 'https://cdn.jsdelivr.net'
const papelizGitHubRawFilesOrigin = 'https://raw.githubusercontent.com'
// Files read at the same time.
const papelizTemplateFileReadConcurrency = 4

export interface PapelizTemplateFileReadOptions extends PapelizTemplateGalleryReadOptions {
  onTemplateFileReadProgress?: (templateFileReadProgress: PapelizTemplateFileReadProgress) => void
}

function assertTemplateCommitSha(templateCommitSha: string): void {
  if (!isPapelizTemplateCommitSha(templateCommitSha)) throw new PapelizTemplateGalleryReadError('That isn’t a full commit, so Papeliz can’t read the template at it.', 'not-a-template')
}

function formatRepositoryAtCommit(templateRepositoryName: PapelizTemplateRepositoryName, templateCommitSha: string): string {
  return `${encodeURIComponent(templateRepositoryName.templateRepositoryOwner)}/${encodeURIComponent(templateRepositoryName.templateRepositoryName)}@${templateCommitSha}`
}

export function formatPapelizJsdelivrFileUrl(templateRepositoryName: PapelizTemplateRepositoryName, templateCommitSha: string, templateFileRelativePath: string): string {
  return `${papelizJsdelivrFilesOrigin}/gh/${formatRepositoryAtCommit(templateRepositoryName, templateCommitSha)}/${encodePapelizTemplateFilePathForUrl(templateFileRelativePath)}`
}

export function formatPapelizGitHubRawFileUrl(templateRepositoryName: PapelizTemplateRepositoryName, templateCommitSha: string, templateFileRelativePath: string): string {
  return `${papelizGitHubRawFilesOrigin}/${encodeURIComponent(templateRepositoryName.templateRepositoryOwner)}/${encodeURIComponent(templateRepositoryName.templateRepositoryName)}/${templateCommitSha}/${encodePapelizTemplateFilePathForUrl(templateFileRelativePath)}`
}

// jsDelivr's flat list: every file at the commit with its size and SHA-256 (base64), hidden files too.
async function readFileListFromJsdelivr(
  templateRepositoryName: PapelizTemplateRepositoryName,
  templateCommitSha: string,
  templateGalleryReadOptions: PapelizTemplateGalleryReadOptions,
): Promise<PapelizTemplateFileList | null> {
  const fileListResponse = await fetchPapelizTemplateGalleryResource(
    `${papelizJsdelivrDataOrigin}/v1/packages/gh/${formatRepositoryAtCommit(templateRepositoryName, templateCommitSha)}?structure=flat`,
    templateGalleryReadOptions,
  )
  if (!fileListResponse.ok) return null
  const fileListAnswer = (await fileListResponse.json().catch(() => null)) as { files?: unknown } | null
  if (!Array.isArray(fileListAnswer?.files)) return null
  const templateFileListEntries: PapelizTemplateFileListEntry[] = []
  for (const listedFile of fileListAnswer.files as Array<{ name?: unknown; hash?: unknown; size?: unknown }>) {
    if (typeof listedFile.name !== 'string' || !listedFile.name.startsWith('/') || typeof listedFile.hash !== 'string' || typeof listedFile.size !== 'number') return null
    templateFileListEntries.push({
      templateFileRelativePath: listedFile.name.slice(1),
      templateFileByteCount: listedFile.size,
      templateFileSha256Base64: listedFile.hash,
      templateFileGitBlobSha1Hex: null,
    })
  }
  return { templateFileListEntries, isTemplateFileListTruncated: false, templateFileListSource: 'jsdelivr' }
}

// The file list at a commit: jsDelivr's, or GitHub's tree when jsDelivr can't give it.
export async function readPapelizTemplateFileList(
  templateRepositoryName: PapelizTemplateRepositoryName,
  templateCommitSha: string,
  templateGalleryReadOptions: PapelizTemplateGalleryReadOptions = {},
): Promise<PapelizTemplateFileList> {
  assertTemplateCommitSha(templateCommitSha)
  let jsdelivrFileList: PapelizTemplateFileList | null = null
  try {
    jsdelivrFileList = await readFileListFromJsdelivr(templateRepositoryName, templateCommitSha, templateGalleryReadOptions)
  } catch (jsdelivrFileListError) {
    if (jsdelivrFileListError instanceof PapelizTemplateGalleryReadError && jsdelivrFileListError.templateGalleryReadProblemKind === 'stopped') throw jsdelivrFileListError
  }
  return jsdelivrFileList ?? readPapelizTemplateFileListFromGitHubTree(templateRepositoryName, templateCommitSha, templateGalleryReadOptions)
}

async function isTemplateFileAsListed(templateFileBytes: Uint8Array, templateFileListEntry: PapelizTemplateFileListEntry): Promise<boolean> {
  if (templateFileBytes.length !== templateFileListEntry.templateFileByteCount) return false
  if (templateFileListEntry.templateFileSha256Base64 !== null) return (await computePapelizTemplateFileSha256Base64(templateFileBytes)) === templateFileListEntry.templateFileSha256Base64
  if (templateFileListEntry.templateFileGitBlobSha1Hex !== null) return (await computePapelizTemplateFileGitBlobSha1Hex(templateFileBytes)) === templateFileListEntry.templateFileGitBlobSha1Hex
  return false
}

// One file's bytes from one host, or null when that host can't give the listed file.
async function readTemplateFileFromHost(
  templateFileUrl: string,
  templateFileListEntry: PapelizTemplateFileListEntry,
  templateGalleryReadOptions: PapelizTemplateGalleryReadOptions,
): Promise<Uint8Array | null> {
  let templateFileResponse: Response
  try {
    templateFileResponse = await fetchPapelizTemplateGalleryResource(templateFileUrl, templateGalleryReadOptions)
  } catch (templateFileReadError) {
    if (templateFileReadError instanceof PapelizTemplateGalleryReadError && templateFileReadError.templateGalleryReadProblemKind === 'stopped') throw templateFileReadError
    return null
  }
  if (!templateFileResponse.ok) return null
  const templateFileBytes = new Uint8Array(await templateFileResponse.arrayBuffer())
  return (await isTemplateFileAsListed(templateFileBytes, templateFileListEntry)) ? templateFileBytes : null
}

// The listed files' bytes at the commit, a few at a time, each checked against the list. Fails with
// a sentence when a file can't be read from jsDelivr or raw files.
export async function readPapelizTemplateFiles(
  templateRepositoryName: PapelizTemplateRepositoryName,
  templateCommitSha: string,
  templateFileListEntries: readonly PapelizTemplateFileListEntry[],
  templateFileReadOptions: PapelizTemplateFileReadOptions = {},
): Promise<Map<string, Uint8Array>> {
  assertTemplateCommitSha(templateCommitSha)
  const templateFileBytesByRelativePath = new Map<string, Uint8Array>()
  const templateFileCount = templateFileListEntries.length
  let nextTemplateFileIndex = 0
  // After jsDelivr fails once, the rest come from raw files straight away.
  let isJsdelivrSkipped = false
  // Once one file fails, the others stop taking new files.
  let hasTemplateFileReadFailed = false
  templateFileReadOptions.onTemplateFileReadProgress?.({ templateReadFileCount: 0, templateFileCount })
  const readNextTemplateFiles = async (): Promise<void> => {
    while (nextTemplateFileIndex < templateFileCount && !hasTemplateFileReadFailed) {
      throwIfPapelizTemplateReadStopped(templateFileReadOptions.templateReadAbortSignal)
      const templateFileListEntry = templateFileListEntries[nextTemplateFileIndex]
      nextTemplateFileIndex += 1
      if (templateFileListEntry === undefined) continue
      const { templateFileRelativePath } = templateFileListEntry
      let templateFileBytes: Uint8Array | null = null
      if (!isJsdelivrSkipped) {
        templateFileBytes = await readTemplateFileFromHost(formatPapelizJsdelivrFileUrl(templateRepositoryName, templateCommitSha, templateFileRelativePath), templateFileListEntry, templateFileReadOptions)
        if (templateFileBytes === null) isJsdelivrSkipped = true
      }
      templateFileBytes ??= await readTemplateFileFromHost(formatPapelizGitHubRawFileUrl(templateRepositoryName, templateCommitSha, templateFileRelativePath), templateFileListEntry, templateFileReadOptions)
      if (templateFileBytes === null) {
        hasTemplateFileReadFailed = true
        throw new PapelizTemplateGalleryReadError(`Papeliz couldn’t read “${templateFileRelativePath}” as listed at this commit, from jsDelivr or GitHub. Try again later.`, 'unreachable')
      }
      templateFileBytesByRelativePath.set(templateFileRelativePath, templateFileBytes)
      templateFileReadOptions.onTemplateFileReadProgress?.({ templateReadFileCount: templateFileBytesByRelativePath.size, templateFileCount })
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(papelizTemplateFileReadConcurrency, templateFileCount) }, () =>
      readNextTemplateFiles().catch((templateFileReadError: unknown) => {
        hasTemplateFileReadFailed = true
        throw templateFileReadError
      }),
    ),
  )
  return templateFileBytesByRelativePath
}
