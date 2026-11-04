import { create } from 'zustand'
import type { PapelizBrowserVaultEnvironment } from '../vault/papeliz-browser-vaults'
import type { PapelizVaultFileContentsWriter } from '../vault/papeliz-directory-handle-vault-adapter'
import type { PapelizVaultFolderPickResult } from '../vault/papeliz-open-vault'
import {
  computePapelizTemplateIncludedFileListDigest,
  describePapelizTemplateFilesChoices,
  hasNoFailedPapelizTemplateCheck,
  listPapelizTemplateChosenRunCommands,
  listPapelizTemplateFirstLookRelativePaths,
  papelizTemplatePathPatternsTooSlowSentence,
  parsePapelizTemplateManifest,
  resolvePapelizTemplateOptionalFilesChoice,
  runPapelizTemplateChecks,
  selectPapelizTemplateChosenFileRelativePaths,
  selectPapelizTemplateIncludedFileListEntries,
} from './papeliz-template-gallery-checks'
import {
  papelizTemplateManifestFileName,
  type PapelizTemplateCheckReport,
  type PapelizTemplateFileList,
  type PapelizTemplateFileListEntry,
  type PapelizTemplateFileReadProgress,
  type PapelizTemplateFilesChoice,
  type PapelizTemplateGalleryActions,
  type PapelizTemplateGalleryRow,
  type PapelizTemplateGalleryState,
  type PapelizTemplateManifest,
  type PapelizTemplateRunCommand,
  type PapelizTemplateVaultFolderImportResult,
} from './papeliz-template-gallery-contract'
import { readPapelizTemplateRepositoryNewestCommit } from './papeliz-template-gallery-github-reader'
import { formatPapelizJsdelivrFileUrl, readPapelizTemplateFileList, readPapelizTemplateFiles } from './papeliz-template-gallery-jsdelivr-reader'
import {
  formatPapelizTemplateGalleryId,
  PapelizTemplateGalleryReadError,
  parsePapelizTemplateRepositoryLink,
  type PapelizTemplateGalleryFetch,
  type PapelizTemplateRepositoryName,
} from './papeliz-template-gallery-network-reading'
import { buildPapelizTemplateAuthorPictureUrl } from './papeliz-template-gallery-picture-hosts'
import { papelizTemplateGalleryStaticListRows } from './papeliz-template-gallery-static-list'
import {
  createPapelizTemplateSourceVaultFile,
  listPapelizTemplateVaultImportFiles,
  makePapelizTemplateBrowserVault,
  makePapelizTemplateFolderVault,
  preparePapelizTemplateVaultFiles,
  type PapelizPreparedTemplateVaultFiles,
  type PapelizTemplateVaultFile,
} from './papeliz-template-gallery-vault-maker'
import { describePapelizFailureMessage } from '../vault/papeliz-failure-code-words'
import { planPapelizVaultFolderImport, type PapelizVaultFolderImportPlan } from '../vault/papeliz-vault-folder-import'
import { joinVaultRelativePath } from '../vault/papeliz-vault-relative-paths'

// Papeliz Templates' data: the gallery's tabs, Submit's Check, Recheck, Preview's and a template page's
// reads, and Use Template's steps, which New Vault's form drives. The screens read the state and call
// the actions the contract names (papeliz-template-gallery-contract.ts).

// The Featured templates built into the app (papeliz-template-gallery-static-list.ts), read from jsDelivr
// at their commits. They are the whole gallery while the Templates Worker is switched off.
export const papelizTemplateGalleryBuiltInFeaturedRows: readonly PapelizTemplateGalleryRow[] = papelizTemplateGalleryStaticListRows

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

// The files Use Template read and checked, ready to write once New Vault's form is confirmed: every
// included file and the manifest, so the choice can change, and the chosen files, prepared.
interface PapelizPreparedTemplateUse {
  templateGalleryRow: PapelizTemplateGalleryRow
  templateCheckReport: PapelizTemplateCheckReport
  templateManifest: PapelizTemplateManifest
  includedTemplateFileBytesByRelativePath: ReadonlyMap<string, Uint8Array>
  // The included optional files, in path order, and those the choice brings.
  templateOptionalFileRelativePaths: string[]
  templateFilesChoice: PapelizTemplateFilesChoice
  chosenTemplateOptionalFileRelativePaths: string[]
  preparedTemplateVaultFiles: PapelizTemplateVaultFile[]
  templateFirstNotePath: string
}
let preparedTemplateUse: PapelizPreparedTemplateUse | null = null

// One choice's files as they go into the vault, and the commands those files bring.
function prepareTemplateUseFilesChoice(
  templateCheckReport: PapelizTemplateCheckReport,
  templateManifest: PapelizTemplateManifest,
  includedTemplateFileBytesByRelativePath: ReadonlyMap<string, Uint8Array>,
  templateFilesChoice: PapelizTemplateFilesChoice,
  chosenTemplateOptionalFileRelativePaths: readonly string[],
): { preparedTemplateVaultFiles: PapelizPreparedTemplateVaultFiles; templateRunCommands: PapelizTemplateRunCommand[] } {
  const chosenTemplateFileRelativePaths = selectPapelizTemplateChosenFileRelativePaths(
    templateCheckReport.templateIncludedFileRelativePaths,
    templateManifest,
    templateFilesChoice,
    chosenTemplateOptionalFileRelativePaths,
  )
  return {
    preparedTemplateVaultFiles: preparePapelizTemplateVaultFiles(includedTemplateFileBytesByRelativePath, { templateManifest, templateFilesChoice, chosenTemplateOptionalFileRelativePaths }),
    templateRunCommands: listPapelizTemplateChosenRunCommands(templateCheckReport.templateRunCommands, chosenTemplateFileRelativePaths),
  }
}

// The choice a made vault or an imported folder records: with chosen, the optional files it got.
function describeTemplateSourceFilesChoice(
  templateUseToRecord: PapelizPreparedTemplateUse,
): { templateSourceFilesChoice: PapelizTemplateFilesChoice; templateSourceChosenOptionalFileRelativePaths?: string[] } {
  return templateUseToRecord.templateFilesChoice === 'chosen'
    ? { templateSourceFilesChoice: 'chosen', templateSourceChosenOptionalFileRelativePaths: templateUseToRecord.chosenTemplateOptionalFileRelativePaths }
    : { templateSourceFilesChoice: templateUseToRecord.templateFilesChoice }
}

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

// The included files Preview and a template's page show, read once per commit (by "<id>@<commit>");
// a read that fails is tried again next time.
const templateIncludedFileReadsByCommitKey = new Map<string, Promise<readonly PapelizTemplateFileListEntry[]>>()

// The files a vault made from the row would get: the file list at its commit, narrowed by its
// manifest. With jsDelivr's hashes they must give back the fingerprint Papeliz checked, so Preview
// shows the files Use Template would write.
function listPapelizTemplateIncludedFilesAtCommit(templateGalleryRow: PapelizTemplateGalleryRow): Promise<readonly PapelizTemplateFileListEntry[]> {
  const templateCommitKey = `${templateGalleryRow.papelizTemplateGalleryId}@${templateGalleryRow.templateCommitSha}`
  const earlierTemplateIncludedFileRead = templateIncludedFileReadsByCommitKey.get(templateCommitKey)
  if (earlierTemplateIncludedFileRead !== undefined) return earlierTemplateIncludedFileRead
  const templateReadOptions = {
    templateGalleryFetch: papelizTemplateGalleryStoreDependencies.templateGalleryFetch,
    waitTemplateReadMilliseconds: papelizTemplateGalleryStoreDependencies.waitTemplateReadMilliseconds,
  }
  const templateIncludedFileRead = (async () => {
    const templateFileList = await readPapelizTemplateFileList(templateGalleryRow, templateGalleryRow.templateCommitSha, templateReadOptions)
    const manifestListEntry = templateFileList.templateFileListEntries.find((templateFileListEntry) => templateFileListEntry.templateFileRelativePath === papelizTemplateManifestFileName)
    const manifestBytes =
      manifestListEntry === undefined
        ? undefined
        : (await readPapelizTemplateFiles(templateGalleryRow, templateGalleryRow.templateCommitSha, [manifestListEntry], templateReadOptions)).get(papelizTemplateManifestFileName)
    const { templateManifest } = parsePapelizTemplateManifest(manifestBytes === undefined ? '' : new TextDecoder().decode(manifestBytes))
    if (templateManifest === null) throw new PapelizTemplateGalleryReadError(`${papelizTemplateManifestFileName} is missing or doesn’t read at this commit.`, 'not-a-template')
    const includedFileListEntries = selectPapelizTemplateIncludedFileListEntries(templateFileList, templateManifest)
    if (includedFileListEntries === null) throw new PapelizTemplateGalleryReadError(papelizTemplatePathPatternsTooSlowSentence, 'not-a-template')
    const includedSha256Base64ByRelativePath = new Map(
      includedFileListEntries.flatMap((includedFileListEntry) =>
        includedFileListEntry.templateFileSha256Base64 === null ? [] : [[includedFileListEntry.templateFileRelativePath, includedFileListEntry.templateFileSha256Base64] as const],
      ),
    )
    if (
      includedSha256Base64ByRelativePath.size === includedFileListEntries.length &&
      (await computePapelizTemplateIncludedFileListDigest(includedSha256Base64ByRelativePath)) !== templateGalleryRow.templateIncludedFileListDigest
    ) {
      throw new PapelizTemplateGalleryReadError('These files aren’t the ones Papeliz checked at this commit. Try again later.', 'not-a-template')
    }
    return includedFileListEntries
  })()
  templateIncludedFileReadsByCommitKey.set(templateCommitKey, templateIncludedFileRead)
  void templateIncludedFileRead.catch(() => templateIncludedFileReadsByCommitKey.delete(templateCommitKey))
  return templateIncludedFileRead
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

  // The gallery's lists, read again; the tab shown stays. New and Top 100 wait for the Templates
  // Worker's snapshot, which this build doesn't read (papeliz-template-gallery-worker-switch.ts), so
  // nothing here reaches the network.
  const readTemplateGalleryLists = async () => {
    set({
      featuredTemplateGalleryRows: papelizTemplateGalleryBuiltInFeaturedRows.map(
        (builtInTemplateGalleryRow) => recheckedTemplateGalleryRowsById.get(builtInTemplateGalleryRow.papelizTemplateGalleryId) ?? builtInTemplateGalleryRow,
      ),
      templateGallerySnapshotState: { templateGallerySnapshotStage: 'not-available-yet' },
    })
  }

  // Use Template's files, while ready, as the optional files ticked: Recommended for none, All for
  // every one, chosen for some. A tick covers the commands it was given (both lists hold the check
  // report's own entries): files with fewer keep it, files that bring another ask again.
  const changeTemplateUseOptionalFiles = (requestedTemplateOptionalFileRelativePaths: readonly string[]) => {
    const { templateUseState } = get()
    const templateUseToChange = preparedTemplateUse
    if (templateUseState.templateUseStage !== 'ready' || templateUseToChange === null) return
    const { templateFilesChoice, chosenTemplateOptionalFileRelativePaths } = resolvePapelizTemplateOptionalFilesChoice(
      templateUseToChange.templateOptionalFileRelativePaths,
      requestedTemplateOptionalFileRelativePaths,
    )
    const isTemplateUseFilesChoiceUnchanged =
      templateUseToChange.templateFilesChoice === templateFilesChoice &&
      templateUseToChange.chosenTemplateOptionalFileRelativePaths.length === chosenTemplateOptionalFileRelativePaths.length &&
      templateUseToChange.chosenTemplateOptionalFileRelativePaths.every(
        (optionalRelativePath, optionalPathIndex) => optionalRelativePath === chosenTemplateOptionalFileRelativePaths[optionalPathIndex],
      )
    if (isTemplateUseFilesChoiceUnchanged) return
    const { preparedTemplateVaultFiles, templateRunCommands } = prepareTemplateUseFilesChoice(
      templateUseToChange.templateCheckReport,
      templateUseToChange.templateManifest,
      templateUseToChange.includedTemplateFileBytesByRelativePath,
      templateFilesChoice,
      chosenTemplateOptionalFileRelativePaths,
    )
    preparedTemplateUse = {
      ...templateUseToChange,
      templateFilesChoice,
      chosenTemplateOptionalFileRelativePaths,
      preparedTemplateVaultFiles: preparedTemplateVaultFiles.preparedTemplateVaultFiles,
    }
    const isEveryRunCommandAcknowledged =
      templateUseState.isTemplateRunCommandsAcknowledged && templateRunCommands.every((templateRunCommand) => templateUseState.templateRunCommands.includes(templateRunCommand))
    set({
      templateUseState: {
        ...templateUseState,
        templateRunCommands,
        isTemplateRunCommandsAcknowledged: isEveryRunCommandAcknowledged,
        templateHiddenFileRelativePaths: preparedTemplateVaultFiles.templateHiddenFileRelativePaths,
        templateLeftOutPictureRelativePaths: preparedTemplateVaultFiles.templateLeftOutPictureRelativePaths,
        templateFilesChoice,
        chosenTemplateOptionalFileRelativePaths,
      },
    })
  }

  return {
    ...papelizTemplateGalleryInitialState,

    openTemplateGallery: async () => {
      set({ templateGalleryTab: 'featured' })
      await readTemplateGalleryLists()
    },

    refreshTemplateGallery: readTemplateGalleryLists,

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

    resetTemplateRecheck: () => {
      templateRecheckAbortController?.abort()
      templateRecheckAbortController = null
      set({ templateRecheckState: { templateRecheckStage: 'idle' } })
    },

    listTemplateIncludedFiles: listPapelizTemplateIncludedFilesAtCommit,

    readTemplateFileText: async (templateGalleryRow, templateFileRelativePath) => {
      const templateFileListEntry = (await listPapelizTemplateIncludedFilesAtCommit(templateGalleryRow)).find(
        (includedFileListEntry) => includedFileListEntry.templateFileRelativePath === templateFileRelativePath,
      )
      if (templateFileListEntry === undefined) throw new PapelizTemplateGalleryReadError(`“${templateFileRelativePath}” isn’t in this template.`, 'not-a-template')
      const templateFileBytes = await readPapelizTemplateFiles(templateGalleryRow, templateGalleryRow.templateCommitSha, [templateFileListEntry], {
        templateGalleryFetch: papelizTemplateGalleryStoreDependencies.templateGalleryFetch,
        waitTemplateReadMilliseconds: papelizTemplateGalleryStoreDependencies.waitTemplateReadMilliseconds,
      })
      return new TextDecoder().decode(templateFileBytes.get(templateFileRelativePath))
    },

    buildTemplatePictureUrl: (templateGalleryRow, templateFileRelativePath) => formatPapelizJsdelivrFileUrl(templateGalleryRow, templateGalleryRow.templateCommitSha, templateFileRelativePath),

    buildTemplateAuthorPictureUrl: buildPapelizTemplateAuthorPictureUrl,

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
        // Recommended when the manifest has optional paths, All when it has none.
        const templateFilesChoices = describePapelizTemplateFilesChoices(templateCheckReport.templateIncludedFileRelativePaths, templateManifest)
        const templateFilesChoice = templateFilesChoices.defaultTemplateFilesChoice
        const chosenTemplateOptionalFileRelativePaths = templateFilesChoice === 'all' ? templateFilesChoices.templateOptionalFileRelativePaths : []
        const { preparedTemplateVaultFiles, templateRunCommands } = prepareTemplateUseFilesChoice(
          templateCheckReport,
          templateManifest,
          includedTemplateFileBytesByRelativePath,
          templateFilesChoice,
          chosenTemplateOptionalFileRelativePaths,
        )
        preparedTemplateUse = {
          templateGalleryRow,
          templateCheckReport,
          templateManifest,
          includedTemplateFileBytesByRelativePath,
          templateOptionalFileRelativePaths: templateFilesChoices.templateOptionalFileRelativePaths,
          templateFilesChoice,
          chosenTemplateOptionalFileRelativePaths,
          preparedTemplateVaultFiles: preparedTemplateVaultFiles.preparedTemplateVaultFiles,
          templateFirstNotePath: templateManifest.templateFirstNotePath,
        }
        set({
          templateUseState: {
            templateUseStage: 'ready',
            templateGalleryRow,
            templateCheckReport,
            templateRunCommands,
            isTemplateRunCommandsAcknowledged: false,
            templateHiddenFileRelativePaths: preparedTemplateVaultFiles.templateHiddenFileRelativePaths,
            templateLeftOutPictureRelativePaths: preparedTemplateVaultFiles.templateLeftOutPictureRelativePaths,
            templateFilesChoice,
            templateFilesChoices,
            chosenTemplateOptionalFileRelativePaths,
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

    readTemplateUseFileText: (templateFileRelativePath) => {
      if (get().templateUseState.templateUseStage !== 'ready' || preparedTemplateUse === null) return null
      const templateFileBytes = preparedTemplateUse.includedTemplateFileBytesByRelativePath.get(templateFileRelativePath)
      return templateFileBytes === undefined ? null : new TextDecoder().decode(templateFileBytes)
    },

    acknowledgeTemplateRunCommands: (isTemplateRunCommandsAcknowledged) => {
      const { templateUseState } = get()
      if (templateUseState.templateUseStage === 'ready') set({ templateUseState: { ...templateUseState, isTemplateRunCommandsAcknowledged } })
    },

    chooseTemplateFilesChoice: (templateFilesChoice) => {
      const templateUseToChange = preparedTemplateUse
      if (templateUseToChange === null) return
      // Chosen keeps the files ticked; with none ticked yet it stays Recommended until one is.
      changeTemplateUseOptionalFiles(
        templateFilesChoice === 'all'
          ? templateUseToChange.templateOptionalFileRelativePaths
          : templateFilesChoice === 'chosen'
            ? templateUseToChange.chosenTemplateOptionalFileRelativePaths
            : [],
      )
    },

    chooseTemplateOptionalFiles: (requestedTemplateOptionalFileRelativePaths) => changeTemplateUseOptionalFiles(requestedTemplateOptionalFileRelativePaths),

    makePapelizTemplateVault: async (typedNewVaultName, chosenNewVaultPlace, templateVaultParentFolder = null) => {
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
          ...describeTemplateSourceFilesChoice(templateUseToMake),
        }),
      ]
      const showTemplateVaultWriteProgress = (templateWrittenFileCount: number, templateFileCount: number) => {
        if (preparedTemplateUse === templateUseToMake) set({ templateUseState: { templateUseStage: 'making-vault', templateGalleryRow, templateWrittenFileCount, templateFileCount } })
      }
      const templateVaultMakeOptions = {
        browserVaultEnvironment: papelizTemplateGalleryStoreDependencies.browserVaultEnvironment,
        pickTemplateVaultPlaceFolder: papelizTemplateGalleryStoreDependencies.pickTemplateVaultPlaceFolder,
        folderVaultFileContentsWriter: papelizTemplateGalleryStoreDependencies.folderVaultFileContentsWriter,
        templateVaultParentFolder,
        onTemplateVaultWriteProgress: showTemplateVaultWriteProgress,
        onTemplateVaultPlaceFolderPicked: () => showTemplateVaultWriteProgress(0, templateVaultFiles.length),
      }
      // A folder vault's folder window opens first, while the click still counts; `picking-folder`
      // lasts until it closes. A folder the form's Location already shows needs no window.
      const isFolderVaultMade = chosenNewVaultPlace === 'folder-on-disk'
      const templateVaultMaking = isFolderVaultMade
        ? makePapelizTemplateFolderVault(typedNewVaultName, templateVaultFiles, templateVaultMakeOptions)
        : makePapelizTemplateBrowserVault(typedNewVaultName, templateVaultFiles, templateVaultMakeOptions)
      set({
        templateUseState: isFolderVaultMade && templateVaultParentFolder === null
          ? { templateUseStage: 'picking-folder', templateGalleryRow }
          : { templateUseStage: 'making-vault', templateGalleryRow, templateWrittenFileCount: 0, templateFileCount: templateVaultFiles.length },
      })
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

    importPapelizTemplateIntoVault: async (templateVaultFolderImporter) => {
      const readyTemplateUseState = get().templateUseState
      const templateUseToImport = preparedTemplateUse
      const importNotReady = (importFailureMessage: string): PapelizTemplateVaultFolderImportResult => ({
        vaultFolderImportOutcome: 'failed',
        vaultFolderImportFailureMessage: importFailureMessage,
        templateFirstNotePath: null,
      })
      if (readyTemplateUseState.templateUseStage !== 'ready' || templateUseToImport === null) {
        return importNotReady('The template isn’t ready yet. Wait for its files to be read and checked.')
      }
      if (readyTemplateUseState.templateRunCommands.length > 0 && !readyTemplateUseState.isTemplateRunCommandsAcknowledged) {
        return importNotReady('Read the commands this template brings, and tick that you have, before it’s imported.')
      }
      const { templateGalleryRow } = templateUseToImport
      let vaultFolderImportPlan: PapelizVaultFolderImportPlan
      try {
        vaultFolderImportPlan = planPapelizVaultFolderImport(templateGalleryRow.templateName, listPapelizTemplateVaultImportFiles(templateUseToImport.preparedTemplateVaultFiles))
      } catch (templateImportPlanError) {
        return importNotReady(describePapelizFailureMessage(`Couldn’t import “${templateGalleryRow.templateName}”`, templateImportPlanError))
      }
      const showTemplateImportProgress = (templateWrittenFileCount: number, templateFileCount: number) => {
        if (preparedTemplateUse === templateUseToImport) set({ templateUseState: { templateUseStage: 'importing-into-vault', templateGalleryRow, templateWrittenFileCount, templateFileCount } })
      }
      showTemplateImportProgress(0, vaultFolderImportPlan.vaultFolderImportFiles.length)
      const vaultFolderImportResult = await templateVaultFolderImporter(vaultFolderImportPlan, {
        onVaultFolderImportProgress: showTemplateImportProgress,
        importedTemplateFolderSource: {
          papelizTemplateGalleryId: templateGalleryRow.papelizTemplateGalleryId,
          templateSourceCommitSha: templateGalleryRow.templateCommitSha,
          templateSourceName: templateGalleryRow.templateName,
          templateSourceAuthor: templateGalleryRow.templateRepositoryOwner,
          templateSourceLicenseId: templateGalleryRow.templateLicenseId,
          ...describeTemplateSourceFilesChoice(templateUseToImport),
        },
      })
      if (preparedTemplateUse !== templateUseToImport) return { ...vaultFolderImportResult, templateFirstNotePath: null }
      if (vaultFolderImportResult.vaultFolderImportOutcome !== 'imported') {
        set({ templateUseState: readyTemplateUseState })
        return { ...vaultFolderImportResult, templateFirstNotePath: null }
      }
      preparedTemplateUse = null
      const { importedVaultFolderRelativePath } = vaultFolderImportResult
      set({ templateUseState: { templateUseStage: 'imported-into-vault', templateGalleryRow, importedVaultFolderRelativePath } })
      return { ...vaultFolderImportResult, templateFirstNotePath: joinVaultRelativePath(importedVaultFolderRelativePath, templateUseToImport.templateFirstNotePath) }
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
  templateIncludedFileReadsByCommitKey.clear()
  papelizTemplateGalleryStoreDependencies = {}
  usePapelizTemplateGalleryStore.setState(papelizTemplateGalleryInitialState)
}

// The tests' own rows, put in as if the gallery listed them.
export function setPapelizTemplateGalleryRowsForTests(featuredTemplateGalleryRows: PapelizTemplateGalleryRow[]): void {
  usePapelizTemplateGalleryStore.setState({ featuredTemplateGalleryRows })
}
