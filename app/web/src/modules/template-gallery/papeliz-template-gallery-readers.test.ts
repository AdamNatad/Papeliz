import { describe, expect, it } from 'vitest'
import { createPapelizFakeTemplateNetwork, type PapelizFakeTemplateRepository } from './papeliz-template-gallery-fake-network.test-support'
import {
  createGardenJournalTemplateFiles,
  gardenJournalRepositoryName,
  gardenJournalTemplateCommitSha,
  gardenJournalTemplateNewerCommitSha,
} from './papeliz-template-gallery-fixtures.test-support'
import { readPapelizTemplateRepositoryNewestCommit } from './papeliz-template-gallery-github-reader'
import { readPapelizTemplateFileList, readPapelizTemplateFiles } from './papeliz-template-gallery-jsdelivr-reader'
import {
  fetchPapelizTemplateGalleryResource,
  parsePapelizTemplateRepositoryLink,
  PapelizTemplateGalleryReadError,
  readPapelizRetryAfterMilliseconds,
  splitPapelizTemplateGalleryId,
} from './papeliz-template-gallery-network-reading'

function createGardenJournalRepository(repositoryChanges: Partial<PapelizFakeTemplateRepository> = {}): PapelizFakeTemplateRepository {
  return {
    ...gardenJournalRepositoryName,
    templateFilesByCommitSha: { [gardenJournalTemplateCommitSha]: createGardenJournalTemplateFiles() },
    newestTemplateCommitSha: gardenJournalTemplateCommitSha,
    ...repositoryChanges,
  }
}

const passTimeAtOnce = async () => undefined

describe('template repository links', () => {
  it('reads a pasted GitHub link in its usual shapes', () => {
    const expectedRepositoryName = { templateRepositoryOwner: 'garden-notes', templateRepositoryName: 'Garden-Journal' }
    for (const pastedRepositoryLink of [
      'https://github.com/garden-notes/Garden-Journal',
      'github.com/garden-notes/Garden-Journal.git',
      'https://www.github.com/garden-notes/Garden-Journal/tree/main/Crops?tab=readme',
      '  garden-notes/Garden-Journal/ ',
    ]) {
      expect(parsePapelizTemplateRepositoryLink(pastedRepositoryLink), pastedRepositoryLink).toEqual(expectedRepositoryName)
    }
    for (const notARepositoryLink of ['https://gitlab.com/a/b', 'garden-notes', 'https://github.com/garden-notes', '-bad/name', 'a/..', 'javascript:alert(1)/x']) {
      expect(parsePapelizTemplateRepositoryLink(notARepositoryLink), notARepositoryLink).toBeNull()
    }
    expect(splitPapelizTemplateGalleryId('garden-notes/Garden-Journal')).toEqual(expectedRepositoryName)
    expect(splitPapelizTemplateGalleryId('garden-notes/Garden-Journal/extra')).toBeNull()
  })

  it('reads retry-after in seconds or as a date', () => {
    expect(readPapelizRetryAfterMilliseconds('3')).toBe(3000)
    expect(readPapelizRetryAfterMilliseconds('Wed, 21 Oct 2026 07:28:10 GMT', Date.parse('Wed, 21 Oct 2026 07:28:00 GMT'))).toBe(10_000)
    expect(readPapelizRetryAfterMilliseconds(null)).toBeNull()
  })

  it('waits as long as a busy host asks, then tries again', async () => {
    const requestedWaits: number[] = []
    let answerCount = 0
    const busyThenFineResponse = await fetchPapelizTemplateGalleryResource('https://cdn.jsdelivr.net/gh/a/b@x/c', {
      templateGalleryFetch: async () => (++answerCount < 3 ? new Response('', { status: 429, headers: { 'retry-after': '5' } }) : new Response('ok')),
      waitTemplateReadMilliseconds: async (waitMilliseconds) => {
        requestedWaits.push(waitMilliseconds)
      },
    })
    expect(await busyThenFineResponse.text()).toBe('ok')
    expect(requestedWaits).toEqual([5000, 5000])
  })
})

describe('GitHub reader', () => {
  it('asks once, for the default branch’s newest commit', async () => {
    const { templateGalleryFetch, fakeRequestedUrls } = createPapelizFakeTemplateNetwork([createGardenJournalRepository()])
    const repositoryNewestCommit = await readPapelizTemplateRepositoryNewestCommit(gardenJournalRepositoryName, { templateGalleryFetch })
    expect(repositoryNewestCommit).toEqual({ ...gardenJournalRepositoryName, templateNewestCommitSha: gardenJournalTemplateCommitSha })
    expect(fakeRequestedUrls).toEqual(['https://api.github.com/repos/garden-notes/Garden-Journal/commits/HEAD'])
  })

  it('says when GitHub’s limit is used up, with the time it resets', async () => {
    const gitHubLimitResetSeconds = Math.floor(Date.parse('2026-11-02T07:42:00Z') / 1000)
    const { templateGalleryFetch } = createPapelizFakeTemplateNetwork([createGardenJournalRepository()], { gitHubLimitResetSeconds })
    const expectedResetTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(gitHubLimitResetSeconds * 1000))
    await expect(readPapelizTemplateRepositoryNewestCommit(gardenJournalRepositoryName, { templateGalleryFetch })).rejects.toMatchObject({
      message: `GitHub’s limit for your network is used up until ${expectedResetTime}. Try again then.`,
      templateGalleryReadProblemKind: 'limit-reached',
    })
  })

  it('says a private or missing repository isn’t there', async () => {
    const { templateGalleryFetch } = createPapelizFakeTemplateNetwork([createGardenJournalRepository({ isTemplateRepositoryPrivate: true })])
    await expect(readPapelizTemplateRepositoryNewestCommit(gardenJournalRepositoryName, { templateGalleryFetch })).rejects.toMatchObject({
      message: 'GitHub has no public repository named “garden-notes/Garden-Journal”. Check the link, and that the repository is public.',
      templateGalleryReadProblemKind: 'repository-gone',
    })
  })

  it('says when GitHub can’t be reached', async () => {
    const readError = await readPapelizTemplateRepositoryNewestCommit(gardenJournalRepositoryName, {
      templateGalleryFetch: async () => {
        throw new TypeError('Failed to fetch')
      },
    }).catch((caughtError: unknown) => caughtError)
    expect(readError).toBeInstanceOf(PapelizTemplateGalleryReadError)
    expect((readError as Error).message).toBe('Papeliz couldn’t reach GitHub. Check your connection, then try again.')
  })
})

describe('jsDelivr reader', () => {
  it('reads the file list and the files at the commit, never by branch name, telling how far it got', async () => {
    const { templateGalleryFetch, fakeRequestedUrls } = createPapelizFakeTemplateNetwork([createGardenJournalRepository()])
    const templateFileList = await readPapelizTemplateFileList(gardenJournalRepositoryName, gardenJournalTemplateCommitSha, { templateGalleryFetch })
    expect(templateFileList.templateFileListSource).toBe('jsdelivr')
    expect(templateFileList.templateFileListEntries.map((templateFileListEntry) => templateFileListEntry.templateFileRelativePath)).toContain('.claude/settings.json')
    const readProgressSteps: string[] = []
    const templateFileBytesByRelativePath = await readPapelizTemplateFiles(gardenJournalRepositoryName, gardenJournalTemplateCommitSha, templateFileList.templateFileListEntries, {
      templateGalleryFetch,
      onTemplateFileReadProgress: ({ templateReadFileCount, templateFileCount }) => readProgressSteps.push(`${templateReadFileCount} of ${templateFileCount}`),
    })
    expect(new TextDecoder().decode(templateFileBytesByRelativePath.get('Start here.md'))).toContain('# Start here')
    expect(readProgressSteps.at(0)).toBe('0 of 11')
    expect(readProgressSteps.at(-1)).toBe('11 of 11')
    expect(fakeRequestedUrls).toContain(`https://data.jsdelivr.com/v1/packages/gh/garden-notes/Garden-Journal@${gardenJournalTemplateCommitSha}?structure=flat`)
    expect(fakeRequestedUrls).toContain(`https://cdn.jsdelivr.net/gh/garden-notes/Garden-Journal@${gardenJournalTemplateCommitSha}/Start%20here.md`)
    expect(fakeRequestedUrls.every((requestedUrl) => requestedUrl.includes(gardenJournalTemplateCommitSha))).toBe(true)
  })

  it('reads the same commit from raw files when jsDelivr can’t be reached, or gives a file that doesn’t match', async () => {
    const { templateGalleryFetch, fakeRequestedUrls } = createPapelizFakeTemplateNetwork([createGardenJournalRepository()], { isJsdelivrFilesDown: true })
    const templateFileList = await readPapelizTemplateFileList(gardenJournalRepositoryName, gardenJournalTemplateCommitSha, { templateGalleryFetch })
    const templateFileBytesByRelativePath = await readPapelizTemplateFiles(gardenJournalRepositoryName, gardenJournalTemplateCommitSha, templateFileList.templateFileListEntries, { templateGalleryFetch })
    expect(templateFileBytesByRelativePath.size).toBe(11)
    expect(fakeRequestedUrls).toContain(`https://raw.githubusercontent.com/garden-notes/Garden-Journal/${gardenJournalTemplateCommitSha}/Crops/Tomatoes.md`)

    const changingNetwork = createPapelizFakeTemplateNetwork([createGardenJournalRepository()], { changedJsdelivrFileRelativePaths: ['Crops/Seeds.md'] })
    const seedsListEntry = templateFileList.templateFileListEntries.filter((templateFileListEntry) => templateFileListEntry.templateFileRelativePath === 'Crops/Seeds.md')
    const seedsBytes = await readPapelizTemplateFiles(gardenJournalRepositoryName, gardenJournalTemplateCommitSha, seedsListEntry, { templateGalleryFetch: changingNetwork.templateGalleryFetch })
    expect(new TextDecoder().decode(seedsBytes.get('Crops/Seeds.md'))).toBe('# Seeds\n')
    expect(changingNetwork.fakeRequestedUrls.at(-1)).toContain('raw.githubusercontent.com')
  })

  it('fails with a sentence when neither jsDelivr nor raw files give the file', async () => {
    const { templateGalleryFetch } = createPapelizFakeTemplateNetwork([createGardenJournalRepository()], { isJsdelivrFilesDown: true, isGitHubRawDown: true })
    const templateFileList = await readPapelizTemplateFileList(gardenJournalRepositoryName, gardenJournalTemplateCommitSha, { templateGalleryFetch })
    await expect(
      readPapelizTemplateFiles(gardenJournalRepositoryName, gardenJournalTemplateCommitSha, templateFileList.templateFileListEntries.slice(0, 1), { templateGalleryFetch }),
    ).rejects.toThrow(/^Papeliz couldn’t read “.+” as listed at this commit, from jsDelivr or GitHub\. Try again later\.$/)
  })

  it('takes the file list from GitHub’s tree when jsDelivr’s list can’t be read, with each file’s blob id', async () => {
    const { templateGalleryFetch, fakeRequestedUrls } = createPapelizFakeTemplateNetwork([createGardenJournalRepository()], { isJsdelivrDataDown: true })
    const templateFileList = await readPapelizTemplateFileList(gardenJournalRepositoryName, gardenJournalTemplateCommitSha, { templateGalleryFetch })
    expect(templateFileList.templateFileListSource).toBe('github-tree')
    expect(fakeRequestedUrls.at(-1)).toBe(`https://api.github.com/repos/garden-notes/Garden-Journal/git/trees/${gardenJournalTemplateCommitSha}?recursive=1`)
    const seedsListEntry = templateFileList.templateFileListEntries.find((templateFileListEntry) => templateFileListEntry.templateFileRelativePath === 'Crops/Seeds.md')
    expect(seedsListEntry).toMatchObject({ templateFileSha256Base64: null, templateFileGitBlobSha1Hex: expect.stringMatching(/^[0-9a-f]{40}$/) })
    // Files listed by the tree are checked against their blob ids.
    const templateFileBytesByRelativePath = await readPapelizTemplateFiles(gardenJournalRepositoryName, gardenJournalTemplateCommitSha, templateFileList.templateFileListEntries, { templateGalleryFetch })
    expect(templateFileBytesByRelativePath.size).toBe(11)
  })

  it('waits for jsDelivr’s retry-after before asking again', async () => {
    const requestedWaits: number[] = []
    const { templateGalleryFetch } = createPapelizFakeTemplateNetwork([createGardenJournalRepository()], { busyJsdelivrFileAnswerCount: 2 })
    const templateFileList = await readPapelizTemplateFileList(gardenJournalRepositoryName, gardenJournalTemplateCommitSha, { templateGalleryFetch })
    const readmeListEntry = templateFileList.templateFileListEntries.filter((templateFileListEntry) => templateFileListEntry.templateFileRelativePath === 'README.md')
    const readmeBytes = await readPapelizTemplateFiles(gardenJournalRepositoryName, gardenJournalTemplateCommitSha, readmeListEntry, {
      templateGalleryFetch,
      waitTemplateReadMilliseconds: async (waitMilliseconds) => {
        requestedWaits.push(waitMilliseconds)
      },
    })
    expect(readmeBytes.size).toBe(1)
    expect(requestedWaits).toEqual([2000, 2000])
  })

  it('refuses anything but a full commit, and stops when cancelled', async () => {
    const { templateGalleryFetch } = createPapelizFakeTemplateNetwork([createGardenJournalRepository()])
    await expect(readPapelizTemplateFileList(gardenJournalRepositoryName, 'main', { templateGalleryFetch })).rejects.toMatchObject({ templateGalleryReadProblemKind: 'not-a-template' })
    await expect(readPapelizTemplateFileList(gardenJournalRepositoryName, gardenJournalTemplateNewerCommitSha.slice(0, 7), { templateGalleryFetch })).rejects.toBeInstanceOf(PapelizTemplateGalleryReadError)
    const stoppedReadController = new AbortController()
    stoppedReadController.abort()
    await expect(
      readPapelizTemplateFileList(gardenJournalRepositoryName, gardenJournalTemplateCommitSha, { templateGalleryFetch, templateReadAbortSignal: stoppedReadController.signal, waitTemplateReadMilliseconds: passTimeAtOnce }),
    ).rejects.toMatchObject({ templateGalleryReadProblemKind: 'stopped' })
  })
})
