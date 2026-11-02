import { afterEach, describe, expect, it } from 'vitest'
import { createPapelizBrowserVault } from '../vault/papeliz-browser-vaults'
import { createPapelizFakeBrowserVaultEnvironment, getPapelizFakeBrowserVaultFolder } from '../vault/papeliz-fake-browser-vault-environment.test-support'
import type { PapelizVaultFolderPickResult } from '../vault/papeliz-open-vault'
import type { PapelizVaultFolderImportOptions, PapelizVaultFolderImportPlan } from '../vault/papeliz-vault-folder-import'
import type { PapelizTemplateGalleryRow, PapelizTemplateGalleryState, PapelizTemplateVaultFolderImporter } from './papeliz-template-gallery-contract'
import { createPapelizFakeTemplateNetwork, type PapelizFakeTemplateNetworkOptions, type PapelizFakeTemplateRepository } from './papeliz-template-gallery-fake-network.test-support'
import {
  createAgentWorkflowTemplateFiles,
  createGardenJournalTemplateFiles,
  gardenJournalRepositoryName,
  gardenJournalTemplateCommitSha,
  gardenJournalTemplateNewerCommitSha,
  type PapelizFixtureTemplateFiles,
} from './papeliz-template-gallery-fixtures.test-support'
import {
  papelizTemplateGalleryBuiltInFeaturedRows,
  resetPapelizTemplateGalleryStoreForTests,
  setPapelizTemplateGalleryRowsForTests,
  setPapelizTemplateGalleryStoreDependenciesForTests,
  usePapelizTemplateGalleryStore,
} from './papeliz-template-gallery-store'

const gardenJournalMadeAt = Date.parse('2026-11-02T09:30:00.000Z')

function createGardenJournalRepository(repositoryChanges: Partial<PapelizFakeTemplateRepository> = {}): PapelizFakeTemplateRepository {
  return {
    ...gardenJournalRepositoryName,
    templateFilesByCommitSha: { [gardenJournalTemplateCommitSha]: createGardenJournalTemplateFiles() },
    newestTemplateCommitSha: gardenJournalTemplateCommitSha,
    ...repositoryChanges,
  }
}

// The store against the fake network (and fake browser storage), with every state it passes through.
function useFakeTemplateNetwork(
  fakeTemplateRepositories: PapelizFakeTemplateRepository[],
  fakeNetworkOptions: PapelizFakeTemplateNetworkOptions = {},
  pickTemplateVaultPlaceFolder?: () => Promise<PapelizVaultFolderPickResult>,
) {
  const fakeTemplateNetwork = createPapelizFakeTemplateNetwork(fakeTemplateRepositories, fakeNetworkOptions)
  const fakeBrowserVaultEnvironment = createPapelizFakeBrowserVaultEnvironment()
  setPapelizTemplateGalleryStoreDependenciesForTests({
    templateGalleryFetch: fakeTemplateNetwork.templateGalleryFetch,
    waitTemplateReadMilliseconds: async () => undefined,
    browserVaultEnvironment: fakeBrowserVaultEnvironment.browserVaultEnvironment,
    readCurrentTime: () => gardenJournalMadeAt,
    pickTemplateVaultPlaceFolder,
  })
  const seenGalleryStates: PapelizTemplateGalleryState[] = []
  const stopWatchingGalleryStates = usePapelizTemplateGalleryStore.subscribe((galleryState) => seenGalleryStates.push(galleryState))
  stopWatchingGalleryStatesList.push(stopWatchingGalleryStates)
  return { ...fakeTemplateNetwork, ...fakeBrowserVaultEnvironment, seenGalleryStates }
}
const stopWatchingGalleryStatesList: Array<() => void> = []

// The listed row for Garden Journal at its first commit, with the fingerprint a Check records.
async function listGardenJournalRow(): Promise<PapelizTemplateGalleryRow> {
  await usePapelizTemplateGalleryStore.getState().checkTemplateRepositoryLink('garden-notes/Garden-Journal')
  const { templateCheckRunState } = usePapelizTemplateGalleryStore.getState()
  if (templateCheckRunState.templateCheckRunStage !== 'checked') throw new Error(`The check didn’t finish: ${JSON.stringify(templateCheckRunState)}`)
  usePapelizTemplateGalleryStore.getState().resetTemplateCheckRun()
  const { templateCheckReport } = templateCheckRunState
  const gardenJournalRow: PapelizTemplateGalleryRow = {
    papelizTemplateGalleryId: 'garden-notes/Garden-Journal',
    ...gardenJournalRepositoryName,
    templateCommitSha: gardenJournalTemplateCommitSha,
    templateIncludedFileListDigest: templateCheckReport.templateIncludedFileListDigest ?? '',
    templateName: 'Garden Journal',
    templateDescription: 'A season of planting notes, with a page per crop.',
    templateTags: ['gardening', 'journal'],
    templateFirstNotePath: 'Start here.md',
    templateLicenseId: 'MIT',
    templateThumbnailPictureUrl: null,
    templateIncludedFileCount: templateCheckReport.templateIncludedFileRelativePaths.length,
    templateIncludedByteCount: templateCheckReport.templateIncludedByteCount,
    isTemplateRunningCommands: templateCheckReport.templateRunCommands.length > 0,
    isTemplateFeatured: true,
    templateListedAt: null,
    templateCheckedAt: null,
    templateUpVoteCount: 0,
    templateDownVoteCount: 0,
    templateTopRank: null,
  }
  setPapelizTemplateGalleryRowsForTests([gardenJournalRow])
  return gardenJournalRow
}

function withNewerCommit(newerCommitFiles: PapelizFixtureTemplateFiles): Partial<PapelizFakeTemplateRepository> {
  return {
    templateFilesByCommitSha: { [gardenJournalTemplateCommitSha]: createGardenJournalTemplateFiles(), [gardenJournalTemplateNewerCommitSha]: newerCommitFiles },
    newestTemplateCommitSha: gardenJournalTemplateNewerCommitSha,
  }
}

afterEach(() => {
  for (const stopWatchingGalleryStates of stopWatchingGalleryStatesList.splice(0)) stopWatchingGalleryStates()
  resetPapelizTemplateGalleryStoreForTests()
})

describe('template gallery store', () => {
  it('opens on Featured, with the built-in templates, and keeps New and Top 100 waiting for the Templates Worker', async () => {
    await usePapelizTemplateGalleryStore.getState().openTemplateGallery()
    expect(usePapelizTemplateGalleryStore.getState()).toMatchObject({
      templateGalleryTab: 'featured',
      featuredTemplateGalleryRows: [...papelizTemplateGalleryBuiltInFeaturedRows],
      templateGallerySnapshotState: { templateGallerySnapshotStage: 'not-available-yet' },
    })
    usePapelizTemplateGalleryStore.getState().selectTemplateGalleryTab('top-100')
    expect(usePapelizTemplateGalleryStore.getState().templateGalleryTab).toBe('top-100')
  })

  it('checks a pasted link: GitHub first, then the files from jsDelivr with progress, then every check', async () => {
    const { seenGalleryStates } = useFakeTemplateNetwork([createGardenJournalRepository()])
    await usePapelizTemplateGalleryStore.getState().checkTemplateRepositoryLink('https://github.com/garden-notes/Garden-Journal')
    const seenCheckRunStages = seenGalleryStates.map((galleryState) => galleryState.templateCheckRunState.templateCheckRunStage)
    expect(seenCheckRunStages.at(0)).toBe('reading-github')
    expect(seenCheckRunStages).toContain('reading-files')
    const { templateCheckRunState } = usePapelizTemplateGalleryStore.getState()
    expect(templateCheckRunState).toMatchObject({ templateCheckRunStage: 'checked', papelizTemplateGalleryId: 'garden-notes/Garden-Journal', templateCommitSha: gardenJournalTemplateCommitSha })
    if (templateCheckRunState.templateCheckRunStage !== 'checked') return
    expect(templateCheckRunState.templateCheckReport.isEveryTemplateCheckPassed).toBe(true)
    const lastReadProgress = seenGalleryStates
      .map((galleryState) => (galleryState.templateCheckRunState.templateCheckRunStage === 'reading-files' ? galleryState.templateCheckRunState.templateFileReadProgress : null))
      .filter((templateFileReadProgress) => templateFileReadProgress !== null)
      .at(-1)
    // The manifest and LICENSE were read on the first look; the other 8 included files after it.
    expect(lastReadProgress).toEqual({ templateReadFileCount: 8, templateFileCount: 8 })
  })

  it('says why a link can’t be checked', async () => {
    useFakeTemplateNetwork([createGardenJournalRepository()], { gitHubLimitResetSeconds: 1_793_600_000 })
    await usePapelizTemplateGalleryStore.getState().checkTemplateRepositoryLink('not a link')
    expect(usePapelizTemplateGalleryStore.getState().templateCheckRunState).toEqual({
      templateCheckRunStage: 'failed-to-read',
      templateCheckRunProblemSentence: 'That isn’t a link to a GitHub repository. Paste one like https://github.com/owner/repository.',
    })
    await usePapelizTemplateGalleryStore.getState().checkTemplateRepositoryLink('garden-notes/Garden-Journal')
    expect(usePapelizTemplateGalleryStore.getState().templateCheckRunState).toMatchObject({
      templateCheckRunStage: 'failed-to-read',
      templateCheckRunProblemSentence: expect.stringMatching(/^GitHub’s limit for your network is used up until .+\. Try again then\.$/),
    })
  })

  it('turns down a template on its first look without reading the rest of its files', async () => {
    const gardenJournalRepository = createGardenJournalRepository()
    // An empty LICENSE fails the first look.
    gardenJournalRepository.templateFilesByCommitSha[gardenJournalTemplateCommitSha] = { ...createGardenJournalTemplateFiles(), LICENSE: '\n' }
    const { fakeRequestedUrls } = useFakeTemplateNetwork([gardenJournalRepository])
    await usePapelizTemplateGalleryStore.getState().checkTemplateRepositoryLink('garden-notes/Garden-Journal')
    const { templateCheckRunState } = usePapelizTemplateGalleryStore.getState()
    if (templateCheckRunState.templateCheckRunStage !== 'checked') throw new Error('The check didn’t finish')
    expect(templateCheckRunState.templateCheckReport.isEveryTemplateCheckPassed).toBe(false)
    expect(fakeRequestedUrls.filter((requestedUrl) => requestedUrl.startsWith('https://cdn.jsdelivr.net/')).sort()).toEqual([
      `https://cdn.jsdelivr.net/gh/garden-notes/Garden-Journal@${gardenJournalTemplateCommitSha}/LICENSE`,
      `https://cdn.jsdelivr.net/gh/garden-notes/Garden-Journal@${gardenJournalTemplateCommitSha}/papeliz-template.json`,
    ])
  })

  it('rechecks: up to date, then moved to a newer commit that passes', async () => {
    const gardenJournalRepository = createGardenJournalRepository()
    useFakeTemplateNetwork([gardenJournalRepository])
    const gardenJournalRow = await listGardenJournalRow()
    await usePapelizTemplateGalleryStore.getState().recheckTemplate(gardenJournalRow.papelizTemplateGalleryId)
    expect(usePapelizTemplateGalleryStore.getState().templateRecheckState).toEqual({
      templateRecheckStage: 'up-to-date',
      papelizTemplateGalleryId: 'garden-notes/Garden-Journal',
      templateRecheckedAt: gardenJournalMadeAt,
    })

    Object.assign(gardenJournalRepository, withNewerCommit({ ...createGardenJournalTemplateFiles(), 'Crops/Seeds.md': '# Seeds\n\nBeans too.\n', 'Crops/Beans.md': '# Beans\n' }))
    await usePapelizTemplateGalleryStore.getState().recheckTemplate(gardenJournalRow.papelizTemplateGalleryId)
    expect(usePapelizTemplateGalleryStore.getState().templateRecheckState).toEqual({
      templateRecheckStage: 'updated',
      papelizTemplateGalleryId: 'garden-notes/Garden-Journal',
      templateRecheckedAt: gardenJournalMadeAt,
      previousTemplateCommitSha: gardenJournalTemplateCommitSha,
      templateCommitSha: gardenJournalTemplateNewerCommitSha,
      templateChangedFileCount: 2,
    })
    const movedRow = usePapelizTemplateGalleryStore.getState().findTemplateGalleryRow('garden-notes/Garden-Journal')
    expect(movedRow).toMatchObject({ templateCommitSha: gardenJournalTemplateNewerCommitSha, templateIncludedFileCount: 10, templateCheckedAt: gardenJournalMadeAt })
    expect(movedRow?.templateIncludedFileListDigest).not.toBe(gardenJournalRow.templateIncludedFileListDigest)
  })

  it('keeps the commit it had when the newest one fails a check, and says when the repository is gone', async () => {
    const gardenJournalRepository = createGardenJournalRepository()
    useFakeTemplateNetwork([gardenJournalRepository])
    const gardenJournalRow = await listGardenJournalRow()
    Object.assign(gardenJournalRepository, withNewerCommit({ ...createGardenJournalTemplateFiles(), 'Crops/Beans.md': '<script>steal()</script>\n' }))
    await usePapelizTemplateGalleryStore.getState().recheckTemplate(gardenJournalRow.papelizTemplateGalleryId)
    expect(usePapelizTemplateGalleryStore.getState().templateRecheckState).toMatchObject({ templateRecheckStage: 'newest-fails', newestTemplateCommitSha: gardenJournalTemplateNewerCommitSha })
    expect(usePapelizTemplateGalleryStore.getState().findTemplateGalleryRow('garden-notes/Garden-Journal')?.templateCommitSha).toBe(gardenJournalTemplateCommitSha)

    const { 'papeliz-template.json': _manifest, ...filesWithoutManifest } = createGardenJournalTemplateFiles()
    Object.assign(gardenJournalRepository, withNewerCommit(filesWithoutManifest))
    await usePapelizTemplateGalleryStore.getState().recheckTemplate(gardenJournalRow.papelizTemplateGalleryId)
    expect(usePapelizTemplateGalleryStore.getState().templateRecheckState).toEqual({
      templateRecheckStage: 'repository-gone',
      papelizTemplateGalleryId: 'garden-notes/Garden-Journal',
      templateRecheckProblemSentence: 'The repository no longer has papeliz-template.json, so it isn’t a template any more.',
    })

    gardenJournalRepository.isTemplateRepositoryPrivate = true
    await usePapelizTemplateGalleryStore.getState().recheckTemplate(gardenJournalRow.papelizTemplateGalleryId)
    expect(usePapelizTemplateGalleryStore.getState().templateRecheckState).toMatchObject({ templateRecheckStage: 'repository-gone' })
  })

  it('prepares Use Template, waits for the commands to be read, then makes a browser vault from the commit it knows', async () => {
    const gardenJournalRepository = createGardenJournalRepository()
    gardenJournalRepository.templateFilesByCommitSha[gardenJournalTemplateCommitSha] = {
      ...createGardenJournalTemplateFiles(),
      '.claude/settings.json': JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'npm test' }] }] } }),
    }
    const { fakeOriginPrivateFileSystemRoot, fakeRequestedUrls } = useFakeTemplateNetwork([gardenJournalRepository])
    const gardenJournalRow = await listGardenJournalRow()
    fakeRequestedUrls.length = 0
    await usePapelizTemplateGalleryStore.getState().prepareTemplateUse(gardenJournalRow)
    // Use Template asks GitHub nothing.
    expect(fakeRequestedUrls.some((requestedUrl) => requestedUrl.startsWith('https://api.github.com/'))).toBe(false)
    const { templateUseState } = usePapelizTemplateGalleryStore.getState()
    expect(templateUseState).toMatchObject({
      templateUseStage: 'ready',
      templateRunCommands: [{ templateRunCommandKind: 'agent-setting-command', templateRunCommandSourceRelativePath: '.claude/settings.json', templateRunCommandText: 'npm test' }],
      isTemplateRunCommandsAcknowledged: false,
      templateHiddenFileRelativePaths: ['.claude/settings.json', '.gitignore'],
      templateLeftOutPictureRelativePaths: [],
    })

    const notAcknowledgedResult = await usePapelizTemplateGalleryStore.getState().makePapelizTemplateVault('My Garden', 'browser-vault-in-opfs')
    expect(notAcknowledgedResult).toEqual({
      openVaultOutcome: 'failed',
      openVaultFailureMessage: 'Read the commands this template brings, and tick that you have, before the vault is made.',
      templateFirstNotePath: null,
    })
    usePapelizTemplateGalleryStore.getState().acknowledgeTemplateRunCommands(true)
    const madeResult = await usePapelizTemplateGalleryStore.getState().makePapelizTemplateVault('My Garden', 'browser-vault-in-opfs')
    if (madeResult.openVaultOutcome !== 'opened') throw new Error(`The vault wasn’t made: ${JSON.stringify(madeResult)}`)
    expect(madeResult.templateFirstNotePath).toBe('Start here.md')
    expect(usePapelizTemplateGalleryStore.getState().templateUseState).toMatchObject({ templateUseStage: 'made', papelizVaultDisplayName: 'My Garden' })
    const madeVaultFolder = await getPapelizFakeBrowserVaultFolder(fakeOriginPrivateFileSystemRoot, madeResult.papelizOpenVault.papelizVaultId)
    const templateSourceFile = await (await (await madeVaultFolder.getDirectoryHandle('.papeliz')).getFileHandle('template-source.json')).getFile()
    expect(JSON.parse(await templateSourceFile.text())).toEqual({
      papelizTemplateSourceFileVersion: 1,
      papelizTemplateGalleryId: 'garden-notes/Garden-Journal',
      templateSourceCommitSha: gardenJournalTemplateCommitSha,
      templateSourceName: 'Garden Journal',
      templateSourceAuthor: 'garden-notes',
      templateSourceLicenseId: 'MIT',
      templateSourceVaultMadeAt: '2026-11-02T09:30:00.000Z',
      // Garden Journal has no optional paths, so every file came.
      templateSourceFilesChoice: 'all',
    })
    madeResult.papelizOpenVault.papelizVaultAdapter.closeVaultAdapter?.()
  })

  it('refuses files that aren’t the ones checked, and makes nothing', async () => {
    const gardenJournalRepository = createGardenJournalRepository()
    useFakeTemplateNetwork([gardenJournalRepository])
    const gardenJournalRow = await listGardenJournalRow()
    // The same commit now serving different files (as a fork's commit under the template's name would).
    gardenJournalRepository.templateFilesByCommitSha[gardenJournalTemplateCommitSha] = { ...createGardenJournalTemplateFiles(), 'Crops/Seeds.md': '# Not what was checked\n' }
    await usePapelizTemplateGalleryStore.getState().prepareTemplateUse(gardenJournalRow)
    const { templateUseState } = usePapelizTemplateGalleryStore.getState()
    expect(templateUseState).toMatchObject({
      templateUseStage: 'failed',
      templateUseProblemSentence: '“Garden Journal” fails a check at this commit, so Papeliz can’t make a vault from it.',
    })
    if (templateUseState.templateUseStage !== 'failed') return
    expect(templateUseState.templateCheckReport?.templateCheckResults.find((templateCheckResult) => templateCheckResult.templateCheckOutcome === 'failed')?.templateCheckId).toBe('included-file-list-digest')
    expect((await usePapelizTemplateGalleryStore.getState().makePapelizTemplateVault('My Garden', 'browser-vault-in-opfs')).openVaultOutcome).toBe('failed')
  })

  it('goes back to ready when the folder window is closed or the name is taken, and Cancel forgets it all', async () => {
    const { browserVaultEnvironment } = useFakeTemplateNetwork([createGardenJournalRepository()], {}, async () => ({ openVaultOutcome: 'cancelled' }))
    const gardenJournalRow = await listGardenJournalRow()
    await usePapelizTemplateGalleryStore.getState().prepareTemplateUse(gardenJournalRow)
    expect(await usePapelizTemplateGalleryStore.getState().makePapelizTemplateVault('My Garden', 'folder-on-disk')).toEqual({ openVaultOutcome: 'cancelled', templateFirstNotePath: null })
    expect(usePapelizTemplateGalleryStore.getState().templateUseState.templateUseStage).toBe('ready')

    await createPapelizBrowserVault('My Garden', browserVaultEnvironment)
    const takenNameResult = await usePapelizTemplateGalleryStore.getState().makePapelizTemplateVault('My Garden', 'browser-vault-in-opfs')
    expect(takenNameResult).toMatchObject({ openVaultOutcome: 'failed', openVaultFailureMessage: 'Couldn’t make “My Garden”. A vault named “My Garden” already exists. Pick another name.' })
    expect(usePapelizTemplateGalleryStore.getState().templateUseState.templateUseStage).toBe('ready')

    usePapelizTemplateGalleryStore.getState().cancelTemplateUse()
    expect(usePapelizTemplateGalleryStore.getState().templateUseState).toEqual({ templateUseStage: 'idle' })
    expect((await usePapelizTemplateGalleryStore.getState().makePapelizTemplateVault('My Garden 2', 'browser-vault-in-opfs')).openVaultOutcome).toBe('failed')
  })

  it('refreshes the list on the tab shown, and forgets a Recheck when its page closes', async () => {
    const gardenJournalRepository = createGardenJournalRepository()
    useFakeTemplateNetwork([gardenJournalRepository])
    const gardenJournalRow = await listGardenJournalRow()
    await usePapelizTemplateGalleryStore.getState().recheckTemplate(gardenJournalRow.papelizTemplateGalleryId)
    expect(usePapelizTemplateGalleryStore.getState().templateRecheckState.templateRecheckStage).toBe('up-to-date')
    usePapelizTemplateGalleryStore.getState().resetTemplateRecheck()
    expect(usePapelizTemplateGalleryStore.getState().templateRecheckState).toEqual({ templateRecheckStage: 'idle' })
    // A Recheck stopped partway leaves nothing behind.
    const rechecking = usePapelizTemplateGalleryStore.getState().recheckTemplate(gardenJournalRow.papelizTemplateGalleryId)
    usePapelizTemplateGalleryStore.getState().resetTemplateRecheck()
    await rechecking
    expect(usePapelizTemplateGalleryStore.getState().templateRecheckState).toEqual({ templateRecheckStage: 'idle' })

    // Refresh reads the built-in list again (the test's own row isn't on it) and stays on New.
    usePapelizTemplateGalleryStore.getState().selectTemplateGalleryTab('new')
    await usePapelizTemplateGalleryStore.getState().refreshTemplateGallery()
    expect(usePapelizTemplateGalleryStore.getState()).toMatchObject({ templateGalleryTab: 'new', featuredTemplateGalleryRows: [...papelizTemplateGalleryBuiltInFeaturedRows] })
  })

  it('reads the included files and one file’s text for Preview from jsDelivr at the row’s commit, asking GitHub nothing', async () => {
    const { fakeRequestedUrls } = useFakeTemplateNetwork([createGardenJournalRepository()])
    const gardenJournalRow = await listGardenJournalRow()
    fakeRequestedUrls.length = 0
    const { listTemplateIncludedFiles, readTemplateFileText, buildTemplatePictureUrl, buildTemplateAuthorPictureUrl } = usePapelizTemplateGalleryStore.getState()
    const includedFileListEntries = await listTemplateIncludedFiles(gardenJournalRow)
    expect(includedFileListEntries.map((includedFileListEntry) => includedFileListEntry.templateFileRelativePath)).toEqual([
      '.claude/settings.json',
      '.gitignore',
      '.papeliz/file-list-order.json',
      'Crops/Seeds.md',
      'Crops/Tomatoes.md',
      'LICENSE',
      'README.md',
      'Start here.md',
      'beds.png',
    ])
    expect(await readTemplateFileText(gardenJournalRow, 'Crops/Seeds.md')).toBe('# Seeds\n')
    await expect(readTemplateFileText(gardenJournalRow, 'drafts/Unfinished.md')).rejects.toThrow('“drafts/Unfinished.md” isn’t in this template.')
    // The file list is read once per commit.
    await listTemplateIncludedFiles(gardenJournalRow)
    expect(fakeRequestedUrls.filter((requestedUrl) => requestedUrl.startsWith('https://data.jsdelivr.com/'))).toHaveLength(1)
    expect(fakeRequestedUrls.some((requestedUrl) => requestedUrl.startsWith('https://api.github.com/'))).toBe(false)
    expect(buildTemplatePictureUrl(gardenJournalRow, 'beds.png')).toBe(`https://cdn.jsdelivr.net/gh/garden-notes/Garden-Journal@${gardenJournalTemplateCommitSha}/beds.png`)
    expect(buildTemplateAuthorPictureUrl('garden-notes', 36)).toBe('https://avatars.githubusercontent.com/garden-notes?s=36')
  })

  it('refuses Preview’s files when they aren’t the ones checked at the row’s commit', async () => {
    const gardenJournalRepository = createGardenJournalRepository()
    useFakeTemplateNetwork([gardenJournalRepository])
    const gardenJournalRow = await listGardenJournalRow()
    gardenJournalRepository.templateFilesByCommitSha[gardenJournalTemplateCommitSha] = { ...createGardenJournalTemplateFiles(), 'Crops/Seeds.md': '# Not what was checked\n' }
    await expect(usePapelizTemplateGalleryStore.getState().listTemplateIncludedFiles(gardenJournalRow)).rejects.toThrow('These files aren’t the ones Papeliz checked at this commit. Try again later.')
  })

  it('says the folder window is open while a folder vault waits for it', async () => {
    let pickFolder: (folderPickResult: PapelizVaultFolderPickResult) => void = () => undefined
    useFakeTemplateNetwork([createGardenJournalRepository()], {}, () => new Promise((resolvePick) => (pickFolder = resolvePick)))
    const gardenJournalRow = await listGardenJournalRow()
    await usePapelizTemplateGalleryStore.getState().prepareTemplateUse(gardenJournalRow)
    const making = usePapelizTemplateGalleryStore.getState().makePapelizTemplateVault('My Garden', 'folder-on-disk')
    expect(usePapelizTemplateGalleryStore.getState().templateUseState).toMatchObject({ templateUseStage: 'picking-folder', templateGalleryRow: { papelizTemplateGalleryId: 'garden-notes/Garden-Journal' } })
    pickFolder({ openVaultOutcome: 'cancelled' })
    expect(await making).toEqual({ openVaultOutcome: 'cancelled', templateFirstNotePath: null })
    expect(usePapelizTemplateGalleryStore.getState().templateUseState.templateUseStage).toBe('ready')
  })

  it('imports into a folder of the open vault: the checked files without its own .papeliz/, its source recorded, and its first note inside the folder', async () => {
    const gardenJournalRepository = createGardenJournalRepository()
    gardenJournalRepository.templateFilesByCommitSha[gardenJournalTemplateCommitSha] = {
      ...createGardenJournalTemplateFiles(),
      '.claude/settings.json': JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'npm test' }] }] } }),
    }
    useFakeTemplateNetwork([gardenJournalRepository])
    const gardenJournalRow = await listGardenJournalRow()
    await usePapelizTemplateGalleryStore.getState().prepareTemplateUse(gardenJournalRow)
    const receivedImports: Array<{ vaultFolderImportPlan: PapelizVaultFolderImportPlan; vaultFolderImportOptions: PapelizVaultFolderImportOptions }> = []
    const fakeVaultFolderImporter: PapelizTemplateVaultFolderImporter = async (vaultFolderImportPlan, vaultFolderImportOptions) => {
      receivedImports.push({ vaultFolderImportPlan, vaultFolderImportOptions })
      vaultFolderImportOptions.onVaultFolderImportProgress?.(1, vaultFolderImportPlan.vaultFolderImportFiles.length)
      expect(usePapelizTemplateGalleryStore.getState().templateUseState).toMatchObject({ templateUseStage: 'importing-into-vault', templateWrittenFileCount: 1 })
      return { vaultFolderImportOutcome: 'imported', importedVaultFolderRelativePath: 'Garden Journal 2', importedFileCount: vaultFolderImportPlan.importFileCount }
    }
    // The commands come first, as for a new vault.
    expect(await usePapelizTemplateGalleryStore.getState().importPapelizTemplateIntoVault(fakeVaultFolderImporter)).toMatchObject({ vaultFolderImportOutcome: 'failed' })
    expect(receivedImports).toEqual([])
    usePapelizTemplateGalleryStore.getState().acknowledgeTemplateRunCommands(true)

    const templateImportResult = await usePapelizTemplateGalleryStore.getState().importPapelizTemplateIntoVault(fakeVaultFolderImporter)
    expect(templateImportResult).toEqual({ vaultFolderImportOutcome: 'imported', importedVaultFolderRelativePath: 'Garden Journal 2', importedFileCount: 8, templateFirstNotePath: 'Garden Journal 2/Start here.md' })
    const [{ vaultFolderImportPlan, vaultFolderImportOptions }] = receivedImports as [(typeof receivedImports)[number]]
    expect(vaultFolderImportPlan.suggestedVaultFolderName).toBe('Garden Journal')
    expect(vaultFolderImportPlan.vaultFolderImportFiles.map((importFile) => importFile.importFileRelativePath)).toEqual([
      '.claude/settings.json',
      '.gitignore',
      'Crops/Seeds.md',
      'Crops/Tomatoes.md',
      'LICENSE',
      'README.md',
      'Start here.md',
      'beds.png',
    ])
    expect(vaultFolderImportOptions.importedTemplateFolderSource).toEqual({
      papelizTemplateGalleryId: 'garden-notes/Garden-Journal',
      templateSourceCommitSha: gardenJournalTemplateCommitSha,
      templateSourceName: 'Garden Journal',
      templateSourceAuthor: 'garden-notes',
      templateSourceLicenseId: 'MIT',
      templateSourceFilesChoice: 'all',
    })
    expect(usePapelizTemplateGalleryStore.getState().templateUseState).toMatchObject({ templateUseStage: 'imported-into-vault', importedVaultFolderRelativePath: 'Garden Journal 2' })
  })

  it('goes back to ready when the import into a folder fails', async () => {
    useFakeTemplateNetwork([createGardenJournalRepository()])
    const gardenJournalRow = await listGardenJournalRow()
    await usePapelizTemplateGalleryStore.getState().prepareTemplateUse(gardenJournalRow)
    const failedImportResult = await usePapelizTemplateGalleryStore
      .getState()
      .importPapelizTemplateIntoVault(async () => ({ vaultFolderImportOutcome: 'failed', vaultFolderImportFailureMessage: 'Couldn’t import into “Garden Journal”. The disk is full.' }))
    expect(failedImportResult).toEqual({ vaultFolderImportOutcome: 'failed', vaultFolderImportFailureMessage: 'Couldn’t import into “Garden Journal”. The disk is full.', templateFirstNotePath: null })
    expect(usePapelizTemplateGalleryStore.getState().templateUseState.templateUseStage).toBe('ready')
  })

  it('drops a read that Cancel stopped', async () => {
    useFakeTemplateNetwork([createGardenJournalRepository()])
    const gardenJournalRow = await listGardenJournalRow()
    const preparing = usePapelizTemplateGalleryStore.getState().prepareTemplateUse(gardenJournalRow)
    usePapelizTemplateGalleryStore.getState().cancelTemplateUse()
    await preparing
    expect(usePapelizTemplateGalleryStore.getState().templateUseState).toEqual({ templateUseStage: 'idle' })
  })
})

describe('template gallery store, Recommended or All', () => {
  const agentWorkflowRepositoryName = { templateRepositoryOwner: 'workflow-notes', templateRepositoryName: 'Agent-Workflow' }
  const agentWorkflowTemplateCommitSha = 'c3d4e5f60718293a4b5c6d7e8f9012345678abcd'
  const agentWorkflowRecommendedRunCommandSourcePaths = ['.agents/hooks/guard.mjs', '.claude/settings.json', '.codex/hooks.json', '.example-agent/hooks.json', '.github/hooks/guard.json']

  function createAgentWorkflowRepository(): PapelizFakeTemplateRepository {
    return { ...agentWorkflowRepositoryName, templateFilesByCommitSha: { [agentWorkflowTemplateCommitSha]: createAgentWorkflowTemplateFiles() }, newestTemplateCommitSha: agentWorkflowTemplateCommitSha }
  }

  // The listed row for Agent Workflow, from its own Check.
  async function listAgentWorkflowRow(): Promise<PapelizTemplateGalleryRow> {
    await usePapelizTemplateGalleryStore.getState().checkTemplateRepositoryLink('workflow-notes/Agent-Workflow')
    const { templateCheckRunState } = usePapelizTemplateGalleryStore.getState()
    if (templateCheckRunState.templateCheckRunStage !== 'checked') throw new Error(`The check didn’t finish: ${JSON.stringify(templateCheckRunState)}`)
    usePapelizTemplateGalleryStore.getState().resetTemplateCheckRun()
    const { templateCheckReport } = templateCheckRunState
    if (templateCheckReport.templateManifest === null) throw new Error('Agent Workflow’s manifest didn’t read.')
    const agentWorkflowRow: PapelizTemplateGalleryRow = {
      papelizTemplateGalleryId: 'workflow-notes/Agent-Workflow',
      ...agentWorkflowRepositoryName,
      templateCommitSha: agentWorkflowTemplateCommitSha,
      templateIncludedFileListDigest: templateCheckReport.templateIncludedFileListDigest ?? '',
      templateName: templateCheckReport.templateManifest.templateName,
      templateDescription: templateCheckReport.templateManifest.templateDescription,
      templateTags: templateCheckReport.templateManifest.templateTags,
      templateFirstNotePath: templateCheckReport.templateManifest.templateFirstNotePath,
      templateLicenseId: 'MIT',
      templateThumbnailPictureUrl: null,
      templateIncludedFileCount: templateCheckReport.templateIncludedFileRelativePaths.length,
      templateIncludedByteCount: templateCheckReport.templateIncludedByteCount,
      isTemplateRunningCommands: templateCheckReport.templateRunCommands.length > 0,
      isTemplateFeatured: true,
      templateListedAt: null,
      templateCheckedAt: null,
      templateUpVoteCount: 0,
      templateDownVoteCount: 0,
      templateTopRank: null,
    }
    setPapelizTemplateGalleryRowsForTests([agentWorkflowRow])
    return agentWorkflowRow
  }

  function readReadyTemplateUseState() {
    const { templateUseState } = usePapelizTemplateGalleryStore.getState()
    if (templateUseState.templateUseStage !== 'ready') throw new Error(`Use Template isn’t ready: ${JSON.stringify(templateUseState.templateUseStage)}`)
    return templateUseState
  }

  it('starts on Recommended, lists only its commands, and asks for the tick again when All brings more', async () => {
    useFakeTemplateNetwork([createAgentWorkflowRepository()])
    await usePapelizTemplateGalleryStore.getState().prepareTemplateUse(await listAgentWorkflowRow())
    const recommendedState = readReadyTemplateUseState()
    expect(recommendedState.templateFilesChoice).toBe('recommended')
    expect(recommendedState.templateFilesChoices).toMatchObject({
      defaultTemplateFilesChoice: 'recommended',
      hasTemplateOptionalFiles: true,
      recommendedTemplateFileCount: 11,
      allTemplateFileCount: 16,
      templateOptionalTopEntryNames: ['.agents', '.aider.conf.yml', '.gemini', '.qwen', 'opencode.json'],
    })
    expect(recommendedState.templateRunCommands.map(({ templateRunCommandSourceRelativePath }) => templateRunCommandSourceRelativePath)).toEqual(agentWorkflowRecommendedRunCommandSourcePaths)
    // The template's page keeps every included file's commands.
    expect(recommendedState.templateCheckReport.templateRunCommands).toHaveLength(10)
    expect(recommendedState.templateHiddenFileRelativePaths).not.toContain('.gemini/settings.json')

    usePapelizTemplateGalleryStore.getState().acknowledgeTemplateRunCommands(true)
    usePapelizTemplateGalleryStore.getState().chooseTemplateFilesChoice?.('all')
    const allState = readReadyTemplateUseState()
    expect(allState).toMatchObject({ templateFilesChoice: 'all', isTemplateRunCommandsAcknowledged: false })
    expect(allState.templateRunCommands).toEqual(allState.templateCheckReport.templateRunCommands)
    expect(allState.templateHiddenFileRelativePaths).toContain('.gemini/settings.json')

    // Back to fewer commands, all of them ticked: the tick stays.
    usePapelizTemplateGalleryStore.getState().acknowledgeTemplateRunCommands(true)
    usePapelizTemplateGalleryStore.getState().chooseTemplateFilesChoice?.('recommended')
    expect(readReadyTemplateUseState()).toMatchObject({ templateFilesChoice: 'recommended', isTemplateRunCommandsAcknowledged: true })
  })

  it('takes optional files ticked one by one as chosen, with their commands, and maps none and every one back', async () => {
    useFakeTemplateNetwork([createAgentWorkflowRepository()])
    await usePapelizTemplateGalleryStore.getState().prepareTemplateUse(await listAgentWorkflowRow())
    expect(readReadyTemplateUseState().chosenTemplateOptionalFileRelativePaths).toEqual([])
    const agentWorkflowOptionalFileRelativePaths = readReadyTemplateUseState().templateFilesChoices?.templateOptionalFileRelativePaths ?? []

    // Ticked: .gemini/settings.json brings one more command, so the tick asks again. A required file is ignored.
    usePapelizTemplateGalleryStore.getState().acknowledgeTemplateRunCommands(true)
    usePapelizTemplateGalleryStore.getState().chooseTemplateOptionalFiles?.(['.gemini/settings.json', 'AGENTS.md'])
    const chosenState = readReadyTemplateUseState()
    expect(chosenState).toMatchObject({ templateFilesChoice: 'chosen', chosenTemplateOptionalFileRelativePaths: ['.gemini/settings.json'], isTemplateRunCommandsAcknowledged: false })
    expect(chosenState.templateRunCommands.map(({ templateRunCommandSourceRelativePath }) => templateRunCommandSourceRelativePath)).toEqual(
      [...agentWorkflowRecommendedRunCommandSourcePaths, '.gemini/settings.json'].sort(),
    )
    expect(chosenState.templateHiddenFileRelativePaths).toContain('.gemini/settings.json')
    expect(chosenState.templateHiddenFileRelativePaths).not.toContain('.qwen/settings.json')

    // Chosen again keeps them; none is Recommended, and the tick stays with fewer commands.
    usePapelizTemplateGalleryStore.getState().acknowledgeTemplateRunCommands(true)
    usePapelizTemplateGalleryStore.getState().chooseTemplateFilesChoice?.('chosen')
    expect(readReadyTemplateUseState()).toMatchObject({ templateFilesChoice: 'chosen', chosenTemplateOptionalFileRelativePaths: ['.gemini/settings.json'] })
    usePapelizTemplateGalleryStore.getState().chooseTemplateOptionalFiles?.([])
    expect(readReadyTemplateUseState()).toMatchObject({ templateFilesChoice: 'recommended', chosenTemplateOptionalFileRelativePaths: [], isTemplateRunCommandsAcknowledged: true })

    // Every one ticked is All.
    usePapelizTemplateGalleryStore.getState().chooseTemplateOptionalFiles?.(agentWorkflowOptionalFileRelativePaths)
    expect(readReadyTemplateUseState()).toMatchObject({ templateFilesChoice: 'all', chosenTemplateOptionalFileRelativePaths: agentWorkflowOptionalFileRelativePaths })
  })

  it('makes a vault with the optional files ticked, and records them', async () => {
    const { fakeOriginPrivateFileSystemRoot } = useFakeTemplateNetwork([createAgentWorkflowRepository()])
    await usePapelizTemplateGalleryStore.getState().prepareTemplateUse(await listAgentWorkflowRow())
    usePapelizTemplateGalleryStore.getState().chooseTemplateOptionalFiles?.(['opencode.json', '.gemini/settings.json'])
    usePapelizTemplateGalleryStore.getState().acknowledgeTemplateRunCommands(true)
    const madeResult = await usePapelizTemplateGalleryStore.getState().makePapelizTemplateVault('My Chosen Workflow', 'browser-vault-in-opfs')
    if (madeResult.openVaultOutcome !== 'opened') throw new Error(`The vault wasn’t made: ${JSON.stringify(madeResult)}`)
    const madeVaultFolder = await getPapelizFakeBrowserVaultFolder(fakeOriginPrivateFileSystemRoot, madeResult.papelizOpenVault.papelizVaultId)
    const madeTopEntryNames = [...madeVaultFolder.fakeChildHandles.keys()].sort()
    expect(madeTopEntryNames).toContain('.gemini')
    expect(madeTopEntryNames).toContain('opencode.json')
    expect(madeTopEntryNames).not.toContain('.qwen')
    expect(madeTopEntryNames).not.toContain('.aider.conf.yml')
    const templateSourceFile = await (await (await madeVaultFolder.getDirectoryHandle('.papeliz')).getFileHandle('template-source.json')).getFile()
    expect(JSON.parse(await templateSourceFile.text())).toMatchObject({
      templateSourceFilesChoice: 'chosen',
      templateSourceChosenOptionalFileRelativePaths: ['.gemini/settings.json', 'opencode.json'],
    })
    madeResult.papelizOpenVault.papelizVaultAdapter.closeVaultAdapter?.()
  })

  it('makes a vault with Recommended’s files only, and records the choice', async () => {
    const { fakeOriginPrivateFileSystemRoot } = useFakeTemplateNetwork([createAgentWorkflowRepository()])
    await usePapelizTemplateGalleryStore.getState().prepareTemplateUse(await listAgentWorkflowRow())
    usePapelizTemplateGalleryStore.getState().acknowledgeTemplateRunCommands(true)
    const madeResult = await usePapelizTemplateGalleryStore.getState().makePapelizTemplateVault('My Workflow', 'browser-vault-in-opfs')
    if (madeResult.openVaultOutcome !== 'opened') throw new Error(`The vault wasn’t made: ${JSON.stringify(madeResult)}`)
    expect(madeResult.templateFirstNotePath).toBe('README.md')
    const madeVaultFolder = await getPapelizFakeBrowserVaultFolder(fakeOriginPrivateFileSystemRoot, madeResult.papelizOpenVault.papelizVaultId)
    const madeTopEntryNames = [...madeVaultFolder.fakeChildHandles.keys()].sort()
    expect(madeTopEntryNames).toEqual(['.agents', '.claude', '.codex', '.example-agent', '.github', '.gitignore', '.papeliz', 'AGENTS.md', 'LICENSE', 'README.md', 'workflow'])
    // `.agents/` holds the guard, which always comes, but not the optional `.agents/hooks.json`.
    expect([...(await madeVaultFolder.getDirectoryHandle('.agents')).fakeChildHandles.keys()]).toEqual(['hooks'])
    const templateSourceFile = await (await (await madeVaultFolder.getDirectoryHandle('.papeliz')).getFileHandle('template-source.json')).getFile()
    expect(JSON.parse(await templateSourceFile.text())).toMatchObject({ papelizTemplateGalleryId: 'workflow-notes/Agent-Workflow', templateSourceFilesChoice: 'recommended' })
    madeResult.papelizOpenVault.papelizVaultAdapter.closeVaultAdapter?.()
  })

  it('imports All’s files into a folder, and records the choice', async () => {
    useFakeTemplateNetwork([createAgentWorkflowRepository()])
    await usePapelizTemplateGalleryStore.getState().prepareTemplateUse(await listAgentWorkflowRow())
    usePapelizTemplateGalleryStore.getState().chooseTemplateFilesChoice?.('all')
    usePapelizTemplateGalleryStore.getState().acknowledgeTemplateRunCommands(true)
    const receivedImports: Array<{ vaultFolderImportPlan: PapelizVaultFolderImportPlan; vaultFolderImportOptions: PapelizVaultFolderImportOptions }> = []
    const templateImportResult = await usePapelizTemplateGalleryStore.getState().importPapelizTemplateIntoVault(async (vaultFolderImportPlan, vaultFolderImportOptions) => {
      receivedImports.push({ vaultFolderImportPlan, vaultFolderImportOptions })
      return { vaultFolderImportOutcome: 'imported', importedVaultFolderRelativePath: 'Agent Workflow', importedFileCount: vaultFolderImportPlan.importFileCount }
    })
    expect(templateImportResult).toMatchObject({ vaultFolderImportOutcome: 'imported', importedFileCount: 16, templateFirstNotePath: 'Agent Workflow/README.md' })
    const [{ vaultFolderImportPlan, vaultFolderImportOptions }] = receivedImports as [(typeof receivedImports)[number]]
    expect(vaultFolderImportPlan.vaultFolderImportFiles.map((importFile) => importFile.importFileRelativePath)).toContain('.gemini/settings.json')
    expect(vaultFolderImportOptions.importedTemplateFolderSource).toMatchObject({ papelizTemplateGalleryId: 'workflow-notes/Agent-Workflow', templateSourceFilesChoice: 'all' })
  })
})
