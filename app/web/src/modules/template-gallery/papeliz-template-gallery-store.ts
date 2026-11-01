import { create } from 'zustand'
import type { PapelizBrowserVaultEnvironment } from '../vault/papeliz-browser-vaults'
import type { PapelizVaultFileContentsWriter } from '../vault/papeliz-directory-handle-vault-adapter'
import type { PapelizVaultFolderPickResult } from '../vault/papeliz-open-vault'
import { hasNoFailedPapelizTemplateCheck, listPapelizTemplateFirstLookRelativePaths, runPapelizTemplateChecks } from './papeliz-template-gallery-checks'
import {
  papelizTemplateManifestFileName,
  type PapelizTemplateCheckReport,
  type PapelizTemplateFileList,
  type PapelizTemplateFileReadProgress,
  type PapelizTemplateGalleryActions,
  type PapelizTemplateGalleryRow,
  type PapelizTemplateGalleryState,
} from './papeliz-template-gallery-contract'
import { readPapelizTemplateRepositoryNewestCommit } from './papeliz-template-gallery-github-reader'
import { readPapelizTemplateFileList, readPapelizTemplateFiles } from './papeliz-template-gallery-jsdelivr-reader'
import {
  formatPapelizTemplateGalleryId,
  PapelizTemplateGalleryReadError,
  parsePapelizTemplateRepositoryLink,
  type PapelizTemplateGalleryFetch,
  type PapelizTemplateRepositoryName,
} from './papeliz-template-gallery-network-reading'
import {
  createPapelizTemplateSourceVaultFile,
  makePapelizTemplateBrowserVault,
  makePapelizTemplateFolderVault,
  preparePapelizTemplateVaultFiles,
  type PapelizTemplateVaultFile,
} from './papeliz-template-gallery-vault-maker'

// Papeliz Templates' data: the gallery's tabs, Submit's Check, Recheck, and Use Template's steps,
// which New Vault's form drives. The screens read the state and call the actions the contract names
// (papeliz-template-gallery-contract.ts).

// The Featured templates built into the app, read from jsDelivr at their commits when the Templates
// Worker can't be reached. P1-Workflow (`AdamNatad/P1-Workflow`) goes first here once its repository
// exists: its row, with the commit and the files' fingerprint Papeliz checked, refreshed when the app
// is built.
export const papelizTemplateGalleryBuiltInFeaturedRows: readonly PapelizTemplateGalleryRow[] = []

// What the store reaches outside itself, so the tests can give their own. Each is the page's own
// when left out.
export interface PapelizTemplateGalleryStoreDependencies {
  templateGalleryFetch?: PapelizTemplateGalleryFetch
  waitTemplateReadMilliseconds?: (waitMilliseconds: number) => Promise<void>
  browserVaultEnvironment?: PapelizBrowserVaultEnvironment
  pickTemplateVaultPlaceFolder?: () => Promise<PapelizVaultFolderPickResult>
  folderVaultFileContentsWriter?: PapelizVaultFileContentsWriter
  readCurrentTime?: () => number
}

let papelizTemplateGalleryStoreDependencies: PapelizTemplateGalleryStoreDependencies = {}

function readTemplateGalleryCurrentTime(): number {
  return (papelizTemplateGalleryStoreDependencies.readCurrentTime ?? Date.now)()
}

// Rows a Recheck in this tab moved to a newer commit, by id, so the gallery keeps them when it opens
// again. The Worker's snapshot carries them for everyone once it exists.
const recheckedTemplateGalleryRowsById = new Map<string, PapelizTemplateGalleryRow>()

// The files Use Template read and checked, ready to write once New Vault's form is confirmed.
interface PapelizPreparedTemplateUse {
  templateGalleryRow: PapelizTemplateGalleryRow
  preparedTemplateVaultFiles: PapelizTemplateVaultFile[]
  templateFirstNotePath: string
}
let preparedTemplateUse: PapelizPreparedTemplateUse | null = null

// Each read under way, so a new one (or Cancel) stops the last.
let templateCheckRunAbortController: AbortController | null = null
let templateRecheckAbortController: AbortController | null = null
let templateUseAbortController: AbortController | null = null

const papelizTemplateGalleryInitialState: PapelizTemplateGalleryState = {
  templateGalleryTab: 'featured',
  featuredTemplateGalleryRows: [...papelizTemplateGalleryBuiltInFeaturedRows],
  newTemplateGalleryRows: [],
  topTemplateGalleryRows: [],
  templateGallerySnapshotState: { templateGallerySnapshotStage: 'not-available-yet' },
  templateCheckRunState: { templateCheckRunStage: 'idle' },
  templateRecheckState: { templateRecheckStage: 'idle' },
  templateUseState: { templateUseStage: 'idle' },
}

function describeTemplateReadProblem(templateReadError: unknown): string {
  if (templateReadError instanceof PapelizTemplateGalleryReadError) return templateReadError.message
  console.warn('Papeliz template read error:', templateReadError)
  return 'Something went wrong while reading the template. Try again, and reload Papeliz if it keeps failing.'
}

function isTemplateReadStopped(templateReadError: unknown): boolean {
  return templateReadError instanceof PapelizTemplateGalleryReadError && templateReadError.templateGalleryReadProblemKind === 'stopped'
}

interface PapelizTemplateReadAndCheckResult {
  templateCheckReport: PapelizTemplateCheckReport
  templateFileList: PapelizTemplateFileList
  // Empty when a first look, with only the manifest read, already failed a check.
  includedTemplateFileBytesByRelativePath: Map<string, Uint8Array>
}

// Reads a template at a commit and runs every check on what was read. A first look with only the
// manifest and the license file read runs the checks that need no other file, so a template that is
// too large, has another license or names a file Windows refuses is turned down before the rest of
// its files are read.
export async function readAndCheckPapelizTemplateAtCommit(
  templateRepositoryName: PapelizTemplateRepositoryName,
  templateCommitSha: string,
  expectedTemplateIncludedFileListDigest: string | null,
  templateReadAbortSignal: AbortSignal,
  onTemplateFileReadProgress: (templateFileReadProgress: PapelizTemplateFileReadProgress) => void,
): Promise<PapelizTemplateReadAndCheckResult> {
  const templateReadOptions = {
    templateGalleryFetch: papelizTemplateGalleryStoreDependencies.templateGalleryFetch,
    waitTemplateReadMilliseconds: papelizTemplateGalleryStoreDependencies.waitTemplateReadMilliseconds,
    templateReadAbortSignal,
  }
  const templateFileList = await readPapelizTemplateFileList(templateRepositoryName, templateCommitSha, templateReadOptions)
  const firstLookRelativePaths = new Set(listPapelizTemplateFirstLookRelativePaths(templateFileList))
  const firstLookFileBytesByRelativePath = await readPapelizTemplateFiles(
    templateRepositoryName,
    templateCommitSha,
    templateFileList.templateFileListEntries.filter((templateFileListEntry) => firstLookRelativePaths.has(templateFileListEntry.templateFileRelativePath)),
    templateReadOptions,
  )
  const firstLookCheckReport = await runPapelizTemplateChecks({ templateFileList, templateFileBytesByRelativePath: firstLookFileBytesByRelativePath, expectedTemplateIncludedFileListDigest })
  if (!hasNoFailedPapelizTemplateCheck(firstLookCheckReport)) {
    return { templateCheckReport: firstLookCheckReport, templateFileList, includedTemplateFileBytesByRelativePath: new Map() }
  }
  // The license file is included too; it isn't read twice.
  const includedRelativePaths = new Set(firstLookCheckReport.templateIncludedFileRelativePaths)
  const includedTemplateFileBytesByRelativePath = new Map([...firstLookFileBytesByRelativePath].filter(([firstLookRelativePath]) => includedRelativePaths.has(firstLookRelativePath)))
  const restOfIncludedFileBytesByRelativePath = await readPapelizTemplateFiles(
    templateRepositoryName,
    templateCommitSha,
    templateFileList.templateFileListEntries.filter(
      (templateFileListEntry) => includedRelativePaths.has(templateFileListEntry.templateFileRelativePath) && !includedTemplateFileBytesByRelativePath.has(templateFileListEntry.templateFileRelativePath),
    ),
    { ...templateReadOptions, onTemplateFileReadProgress },
  )
  for (const [includedRelativePath, includedFileBytes] of restOfIncludedFileBytesByRelativePath) includedTemplateFileBytesByRelativePath.set(includedRelativePath, includedFileBytes)
  const templateCheckReport = await runPapelizTemplateChecks({
    templateFileList,
    templateFileBytesByRelativePath: new Map([...firstLookFileBytesByRelativePath, ...includedTemplateFileBytesByRelativePath]),
    expectedTemplateIncludedFileListDigest,
  })
  return { templateCheckReport, templateFileList, includedTemplateFileBytesByRelativePath }
}

// Files whose contents differ between two lists of the same repository (added, removed or changed).
function countChangedTemplateFiles(earlierTemplateFileList: PapelizTemplateFileList, laterTemplateFileList: PapelizTemplateFileList): number {
  const readFileFingerprints = (templateFileList: PapelizTemplateFileList) =>
    new Map(
      templateFileList.templateFileListEntries.map((templateFileListEntry) => [
        templateFileListEntry.templateFileRelativePath,
        templateFileListEntry.templateFileSha256Base64 ?? templateFileListEntry.templateFileGitBlobSha1Hex ?? `${templateFileListEntry.templateFileByteCount}`,
      ]),
    )
  const earlierFileFingerprints = readFileFingerprints(earlierTemplateFileList)
  const laterFileFingerprints = readFileFingerprints(laterTemplateFileList)
  const everyRelativePath = new Set([...earlierFileFingerprints.keys(), ...laterFileFingerprints.keys()])
  return [...everyRelativePath].filter((templateFileRelativePath) => earlierFileFingerprints.get(templateFileRelativePath) !== laterFileFingerprints.get(templateFileRelativePath)).length
}

function replaceTemplateGalleryRow(templateGalleryRows: readonly PapelizTemplateGalleryRow[], updatedTemplateGalleryRow: PapelizTemplateGalleryRow): PapelizTemplateGalleryRow[] {
  return templateGalleryRows.map((templateGalleryRow) =>
    templateGalleryRow.papelizTemplateGalleryId === updatedTemplateGalleryRow.papelizTemplateGalleryId ? updatedTemplateGalleryRow : templateGalleryRow,
  )
}

export const usePapelizTemplateGalleryStore = create<PapelizTemplateGalleryState & PapelizTemplateGalleryActions>()((set, get) => {
  // Puts a row a Recheck moved everywhere the gallery shows it.
  const keepRecheckedTemplateGalleryRow = (recheckedTemplateGalleryRow: PapelizTemplateGalleryRow) => {
    recheckedTemplateGalleryRowsById.set(recheckedTemplateGalleryRow.papelizTemplateGalleryId, recheckedTemplateGalleryRow)
    set((galleryState) => ({
      featuredTemplateGalleryRows: replaceTemplateGalleryRow(galleryState.featuredTemplateGalleryRows, recheckedTemplateGalleryRow),
      newTemplateGalleryRows: replaceTemplateGalleryRow(galleryState.newTemplateGalleryRows, recheckedTemplateGalleryRow),
      topTemplateGalleryRows: replaceTemplateGalleryRow(galleryState.topTemplateGalleryRows, recheckedTemplateGalleryRow),
    }))
  }

  return {
    ...papelizTemplateGalleryInitialState,

    openTemplateGallery: async () => {
      // New and Top 100 wait for the Templates Worker's snapshot, which this build doesn't read yet.
      set({
        templateGalleryTab: 'featured',
        featuredTemplateGalleryRows: papelizTemplateGalleryBuiltInFeaturedRows.map(
          (builtInTemplateGalleryRow) => recheckedTemplateGalleryRowsById.get(builtInTemplateGalleryRow.papelizTemplateGalleryId) ?? builtInTemplateGalleryRow,
        ),
        templateGallerySnapshotState: { templateGallerySnapshotStage: 'not-available-yet' },
      })
    },

    selectTemplateGalleryTab: (templateGalleryTab) => set({ templateGalleryTab }),

    findTemplateGalleryRow: (papelizTemplateGalleryId) => {
      const { featuredTemplateGalleryRows, newTemplateGalleryRows, topTemplateGalleryRows } = get()
      return (
        [...featuredTemplateGalleryRows, ...newTemplateGalleryRows, ...topTemplateGalleryRows].find(
          (templateGalleryRow) => templateGalleryRow.papelizTemplateGalleryId === papelizTemplateGalleryId,
        ) ?? null
      )
    },

    checkTemplateRepositoryLink: async (typedTemplateRepositoryLink) => {
      templateCheckRunAbortController?.abort()
      const checkRunAbortController = new AbortController()
      templateCheckRunAbortController = checkRunAbortController
      const isThisCheckRunCurrent = () => templateCheckRunAbortController === checkRunAbortController
      const templateRepositoryName = parsePapelizTemplateRepositoryLink(typedTemplateRepositoryLink)
      if (templateRepositoryName === null) {
        set({
          templateCheckRunState: {
            templateCheckRunStage: 'failed-to-read',
            templateCheckRunProblemSentence: 'That isn’t a link to a GitHub repository. Paste one like https://github.com/owner/repository.',
          },
        })
        return
      }
      set({ templateCheckRunState: { templateCheckRunStage: 'reading-github', papelizTemplateGalleryId: formatPapelizTemplateGalleryId(templateRepositoryName) } })
      try {
        const repositoryNewestCommit = await readPapelizTemplateRepositoryNewestCommit(templateRepositoryName, {
          templateGalleryFetch: papelizTemplateGalleryStoreDependencies.templateGalleryFetch,
          templateReadAbortSignal: checkRunAbortController.signal,
        })
        if (!isThisCheckRunCurrent()) return
        const papelizTemplateGalleryId = formatPapelizTemplateGalleryId(repositoryNewestCommit)
        const templateCommitSha = repositoryNewestCommit.templateNewestCommitSha
        set({ templateCheckRunState: { templateCheckRunStage: 'reading-files', papelizTemplateGalleryId, templateCommitSha, templateFileReadProgress: null } })
        const { templateCheckReport } = await readAndCheckPapelizTemplateAtCommit(
          repositoryNewestCommit,
          templateCommitSha,
          null,
          checkRunAbortController.signal,
          (templateFileReadProgress) => {
            if (isThisCheckRunCurrent()) set({ templateCheckRunState: { templateCheckRunStage: 'reading-files', papelizTemplateGalleryId, templateCommitSha, templateFileReadProgress } })
          },
        )
        if (!isThisCheckRunCurrent()) return
        set({ templateCheckRunState: { templateCheckRunStage: 'checked', papelizTemplateGalleryId, templateCommitSha, templateCheckReport } })
      } catch (templateCheckRunError) {
        if (!isThisCheckRunCurrent() || isTemplateReadStopped(templateCheckRunError)) return
        set({ templateCheckRunState: { templateCheckRunStage: 'failed-to-read', templateCheckRunProblemSentence: describeTemplateReadProblem(templateCheckRunError) } })
      } finally {
        if (isThisCheckRunCurrent()) templateCheckRunAbortController = null
      }
    },

    resetTemplateCheckRun: () => {
      templateCheckRunAbortController?.abort()
      templateCheckRunAbortController = null
      set({ templateCheckRunState: { templateCheckRunStage: 'idle' } })
    },

    recheckTemplate: async (papelizTemplateGalleryId) => {
      const templateGalleryRow = get().findTemplateGalleryRow(papelizTemplateGalleryId)
      if (templateGalleryRow === null) return
      templateRecheckAbortController?.abort()
      const recheckAbortController = new AbortController()
      templateRecheckAbortController = recheckAbortController
      const isThisRecheckCurrent = () => templateRecheckAbortController === recheckAbortController
      const templateReadOptions = {
        templateGalleryFetch: papelizTemplateGalleryStoreDependencies.templateGalleryFetch,
        waitTemplateReadMilliseconds: papelizTemplateGalleryStoreDependencies.waitTemplateReadMilliseconds,
        templateReadAbortSignal: recheckAbortController.signal,
      }
      set({ templateRecheckState: { templateRecheckStage: 'rechecking', papelizTemplateGalleryId, templateFileReadProgress: null } })
      try {
        const repositoryNewestCommit = await readPapelizTemplateRepositoryNewestCommit(templateGalleryRow, templateReadOptions)
        if (!isThisRecheckCurrent()) return
        const templateRecheckedAt = readTemplateGalleryCurrentTime()
        if (repositoryNewestCommit.templateNewestCommitSha === templateGalleryRow.templateCommitSha) {
          keepRecheckedTemplateGalleryRow({ ...templateGalleryRow, templateCheckedAt: templateRecheckedAt })
          set({ templateRecheckState: { templateRecheckStage: 'up-to-date', papelizTemplateGalleryId, templateRecheckedAt } })
          return
        }
        const newestTemplateCommitSha = repositoryNewestCommit.templateNewestCommitSha
        const { templateCheckReport, templateFileList } = await readAndCheckPapelizTemplateAtCommit(
          repositoryNewestCommit,
          newestTemplateCommitSha,
          null,
          recheckAbortController.signal,
          (templateFileReadProgress) => {
            if (isThisRecheckCurrent()) set({ templateRecheckState: { templateRecheckStage: 'rechecking', papelizTemplateGalleryId, templateFileReadProgress } })
          },
        )
        if (!isThisRecheckCurrent()) return
        const hasLostManifest = !templateFileList.templateFileListEntries.some((templateFileListEntry) => templateFileListEntry.templateFileRelativePath === papelizTemplateManifestFileName)
        if (hasLostManifest) {
          set({
            templateRecheckState: {
              templateRecheckStage: 'repository-gone',
              papelizTemplateGalleryId,
              templateRecheckProblemSentence: `The repository no longer has ${papelizTemplateManifestFileName}, so it isn’t a template any more.`,
            },
          })
          return
        }
        const { templateManifest, templateLicenseId } = templateCheckReport
        if (!templateCheckReport.isEveryTemplateCheckPassed || templateManifest === null || templateLicenseId === null || templateCheckReport.templateIncludedFileListDigest === null) {
          set({ templateRecheckState: { templateRecheckStage: 'newest-fails', papelizTemplateGalleryId, templateRecheckedAt, newestTemplateCommitSha, templateCheckReport } })
          return
        }
        const earlierTemplateFileList = await readPapelizTemplateFileList(templateGalleryRow, templateGalleryRow.templateCommitSha, templateReadOptions).catch(() => null)
        if (!isThisRecheckCurrent()) return
        keepRecheckedTemplateGalleryRow({
          ...templateGalleryRow,
          templateRepositoryOwner: repositoryNewestCommit.templateRepositoryOwner,
          templateRepositoryName: repositoryNewestCommit.templateRepositoryName,
          templateCommitSha: newestTemplateCommitSha,
          templateIncludedFileListDigest: templateCheckReport.templateIncludedFileListDigest,
          templateName: templateManifest.templateName,
          templateDescription: templateManifest.templateDescription,
          templateTags: templateManifest.templateTags,
          templateFirstNotePath: templateManifest.templateFirstNotePath,
          templateLicenseId,
          templateIncludedFileCount: templateCheckReport.templateIncludedFileRelativePaths.length,
          templateIncludedByteCount: templateCheckReport.templateIncludedByteCount,
          isTemplateRunningCommands: templateCheckReport.templateRunCommands.length > 0,
          templateCheckedAt: templateRecheckedAt,
        })
        set({
          templateRecheckState: {
            templateRecheckStage: 'updated',
            papelizTemplateGalleryId,
            templateRecheckedAt,
            previousTemplateCommitSha: templateGalleryRow.templateCommitSha,
            templateCommitSha: newestTemplateCommitSha,
            templateChangedFileCount: earlierTemplateFileList === null ? null : countChangedTemplateFiles(earlierTemplateFileList, templateFileList),
          },
        })
      } catch (templateRecheckError) {
        if (!isThisRecheckCurrent() || isTemplateReadStopped(templateRecheckError)) return
        const templateRecheckProblemSentence = describeTemplateReadProblem(templateRecheckError)
        const isRepositoryGone = templateRecheckError instanceof PapelizTemplateGalleryReadError && templateRecheckError.templateGalleryReadProblemKind === 'repository-gone'
        set({
          templateRecheckState: isRepositoryGone
            ? { templateRecheckStage: 'repository-gone', papelizTemplateGalleryId, templateRecheckProblemSentence }
            : { templateRecheckStage: 'failed-to-read', papelizTemplateGalleryId, templateRecheckProblemSentence },
        })
      } finally {
        if (isThisRecheckCurrent()) templateRecheckAbortController = null
      }
    },

    prepareTemplateUse: async (templateGalleryRow) => {
      templateUseAbortController?.abort()
      preparedTemplateUse = null
      const templateUseReadAbortController = new AbortController()
      templateUseAbortController = templateUseReadAbortController
      const isThisTemplateUseCurrent = () => templateUseAbortController === templateUseReadAbortController
      set({ templateUseState: { templateUseStage: 'preparing', templateGalleryRow, templateFileReadProgress: null } })
      try {
        // Use Template asks GitHub nothing: it reads the commit Papeliz knows from jsDelivr.
        const { templateCheckReport, includedTemplateFileBytesByRelativePath } = await readAndCheckPapelizTemplateAtCommit(
          templateGalleryRow,
          templateGalleryRow.templateCommitSha,
          templateGalleryRow.templateIncludedFileListDigest,
          templateUseReadAbortController.signal,
          (templateFileReadProgress) => {
            if (isThisTemplateUseCurrent()) set({ templateUseState: { templateUseStage: 'preparing', templateGalleryRow, templateFileReadProgress } })
          },
        )
        if (!isThisTemplateUseCurrent()) return
        const { templateManifest } = templateCheckReport
        if (!templateCheckReport.isEveryTemplateCheckPassed || templateManifest === null) {
          set({
            templateUseState: {
              templateUseStage: 'failed',
              templateGalleryRow,
              templateUseProblemSentence: `“${templateGalleryRow.templateName}” fails a check at this commit, so Papeliz can’t make a vault from it.`,
              templateCheckReport,
            },
          })
          return
        }
        const preparedTemplateVaultFiles = preparePapelizTemplateVaultFiles(includedTemplateFileBytesByRelativePath)
        preparedTemplateUse = {
          templateGalleryRow,
          preparedTemplateVaultFiles: preparedTemplateVaultFiles.preparedTemplateVaultFiles,
          templateFirstNotePath: templateManifest.templateFirstNotePath,
        }
        set({
          templateUseState: {
            templateUseStage: 'ready',
            templateGalleryRow,
            templateCheckReport,
            templateRunCommands: templateCheckReport.templateRunCommands,
            isTemplateRunCommandsAcknowledged: false,
            templateHiddenFileRelativePaths: preparedTemplateVaultFiles.templateHiddenFileRelativePaths,
            templateLeftOutPictureRelativePaths: preparedTemplateVaultFiles.templateLeftOutPictureRelativePaths,
          },
        })
      } catch (templateUseReadError) {
        if (!isThisTemplateUseCurrent() || isTemplateReadStopped(templateUseReadError)) return
        set({
          templateUseState: { templateUseStage: 'failed', templateGalleryRow, templateUseProblemSentence: describeTemplateReadProblem(templateUseReadError), templateCheckReport: null },
        })
      } finally {
        if (isThisTemplateUseCurrent()) templateUseAbortController = null
      }
    },

    acknowledgeTemplateRunCommands: (isTemplateRunCommandsAcknowledged) => {
      const { templateUseState } = get()
      if (templateUseState.templateUseStage === 'ready') set({ templateUseState: { ...templateUseState, isTemplateRunCommandsAcknowledged } })
    },

    makePapelizTemplateVault: async (typedNewVaultName, chosenNewVaultPlace) => {
      const readyTemplateUseState = get().templateUseState
      const templateUseToMake = preparedTemplateUse
      if (readyTemplateUseState.templateUseStage !== 'ready' || templateUseToMake === null) {
        return { openVaultOutcome: 'failed', openVaultFailureMessage: 'The template isn’t ready yet. Wait for its files to be read and checked.', templateFirstNotePath: null }
      }
      if (readyTemplateUseState.templateRunCommands.length > 0 && !readyTemplateUseState.isTemplateRunCommandsAcknowledged) {
        return { openVaultOutcome: 'failed', openVaultFailureMessage: 'Read the commands this template brings, and tick that you have, before the vault is made.', templateFirstNotePath: null }
      }
      const { templateGalleryRow } = templateUseToMake
      const templateVaultFiles = [
        ...templateUseToMake.preparedTemplateVaultFiles,
        createPapelizTemplateSourceVaultFile({
          papelizTemplateSourceFileVersion: 1,
          papelizTemplateGalleryId: templateGalleryRow.papelizTemplateGalleryId,
          templateSourceCommitSha: templateGalleryRow.templateCommitSha,
          templateSourceName: templateGalleryRow.templateName,
          templateSourceAuthor: templateGalleryRow.templateRepositoryOwner,
          templateSourceLicenseId: templateGalleryRow.templateLicenseId,
          templateSourceVaultMadeAt: new Date(readTemplateGalleryCurrentTime()).toISOString(),
        }),
      ]
      const templateVaultMakeOptions = {
        browserVaultEnvironment: papelizTemplateGalleryStoreDependencies.browserVaultEnvironment,
        pickTemplateVaultPlaceFolder: papelizTemplateGalleryStoreDependencies.pickTemplateVaultPlaceFolder,
        folderVaultFileContentsWriter: papelizTemplateGalleryStoreDependencies.folderVaultFileContentsWriter,
        onTemplateVaultWriteProgress: (templateWrittenFileCount: number, templateFileCount: number) => {
          if (preparedTemplateUse === templateUseToMake) set({ templateUseState: { templateUseStage: 'making-vault', templateGalleryRow, templateWrittenFileCount, templateFileCount } })
        },
      }
      // A folder vault's folder window opens first, while the click still counts.
      const templateVaultMaking =
        chosenNewVaultPlace === 'folder-on-disk'
          ? makePapelizTemplateFolderVault(typedNewVaultName, templateVaultFiles, templateVaultMakeOptions)
          : makePapelizTemplateBrowserVault(typedNewVaultName, templateVaultFiles, templateVaultMakeOptions)
      set({ templateUseState: { templateUseStage: 'making-vault', templateGalleryRow, templateWrittenFileCount: 0, templateFileCount: templateVaultFiles.length } })
      const openVaultResult = await templateVaultMaking
      if (preparedTemplateUse !== templateUseToMake) return { ...openVaultResult, templateFirstNotePath: null }
      if (openVaultResult.openVaultOutcome !== 'opened') {
        set({ templateUseState: readyTemplateUseState })
        return { ...openVaultResult, templateFirstNotePath: null }
      }
      preparedTemplateUse = null
      set({ templateUseState: { templateUseStage: 'made', templateGalleryRow, papelizVaultDisplayName: openVaultResult.papelizOpenVault.papelizVaultDisplayName } })
      return { ...openVaultResult, templateFirstNotePath: templateUseToMake.templateFirstNotePath }
    },

    cancelTemplateUse: () => {
      templateUseAbortController?.abort()
      templateUseAbortController = null
      preparedTemplateUse = null
      set({ templateUseState: { templateUseStage: 'idle' } })
    },
  }
})

export function setPapelizTemplateGalleryStoreDependenciesForTests(templateGalleryStoreDependencies: PapelizTemplateGalleryStoreDependencies): void {
  papelizTemplateGalleryStoreDependencies = templateGalleryStoreDependencies
}

export function resetPapelizTemplateGalleryStoreForTests(): void {
  for (const templateReadAbortController of [templateCheckRunAbortController, templateRecheckAbortController, templateUseAbortController]) templateReadAbortController?.abort()
  templateCheckRunAbortController = null
  templateRecheckAbortController = null
  templateUseAbortController = null
  preparedTemplateUse = null
  recheckedTemplateGalleryRowsById.clear()
  papelizTemplateGalleryStoreDependencies = {}
  usePapelizTemplateGalleryStore.setState(papelizTemplateGalleryInitialState)
}

// The tests' own rows, put in as if the gallery listed them.
export function setPapelizTemplateGalleryRowsForTests(featuredTemplateGalleryRows: PapelizTemplateGalleryRow[]): void {
  usePapelizTemplateGalleryStore.setState({ featuredTemplateGalleryRows })
}
