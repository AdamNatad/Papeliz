import { isPapelizDesktopApp } from 'virtual:papeliz-desktop-platform-availability'
import type { PapelizDesktopFileSystem } from '../desktop/papeliz-desktop-platform-contract'
import { importPapelizBrowserVault } from '../vault/papeliz-browser-vault-import'
import { getPapelizBrowserVaultEnvironment, openPapelizBrowserVault, type PapelizBrowserVaultEnvironment } from '../vault/papeliz-browser-vaults'
import { writeVaultFileContentsThroughWritableStream, type PapelizVaultFileContentsWriter } from '../vault/papeliz-directory-handle-vault-adapter'
import { describePapelizErrorSentence, describePapelizFailureCodeMessage, describePapelizFailureMessage } from '../vault/papeliz-failure-code-words'
import {
  describeNewFolderVaultNameTakenMessage,
  makePapelizNewDesktopFolderVaultFolder,
  makePapelizNewFolderVaultFolder,
  openPapelizDesktopVaultFolderPath,
  openPapelizVaultFolderHandle,
  pickPapelizNewVaultParentFolder,
  pickPapelizVaultFolderHandle,
  readPapelizNewVaultDefaultParentFolder,
  type PapelizNewDesktopFolderVaultFolderResult,
  type PapelizNewVaultParentFolder,
  type PapelizOpenVaultResult,
  type PapelizVaultFolderPickResult,
} from '../vault/papeliz-open-vault'
import { waitForPapelizDesktopPlatform } from '../vault/papeliz-remembered-vault-folders'
import {
  writePapelizVaultImportFiles,
  writePapelizVaultImportFilesThroughFolderWriter,
  type PapelizVaultImportFile,
  type PapelizVaultImportFolderWriter,
} from '../vault/papeliz-vault-folder-import'
import { isVaultFileRelativePathSyncable, papelizVaultSettingsFolderName } from '../vault/papeliz-vault-relative-paths'
import { findPapelizTemplateDefaultFilesChoice, selectPapelizTemplateChosenFileRelativePaths } from './papeliz-template-gallery-checks'
import {
  papelizTemplateSourceFileName,
  type PapelizTemplateFilesChoice,
  type PapelizTemplateManifest,
  type PapelizTemplateSourceFile,
} from './papeliz-template-gallery-contract'
import { findPapelizTemplatePictureFormatByName, stripPapelizTemplatePictureMetadata } from './papeliz-template-gallery-picture-metadata'

// Makes a new vault from a template's checked files, through New Vault's own steps: a browser vault
// is made and filled as an import is (taken back whole if it can't be finished), and a folder vault
// is a new folder, named after the vault, inside the folder picked (in Papeliz for Windows, by its path
// inside the form's Location, which starts at `<Documents>\Papeliz`). Only the files of the person's
// choice go in, Recommended or All. Every picture is stripped of its metadata on the way; a picture
// that can't be is left out. The vault also gets `.papeliz/template-source.json`, which says which
// template, commit and choice it came from.

export interface PapelizTemplateVaultFile {
  templateFileRelativePath: string
  templateFileBytes: Uint8Array
}

// Which of the included files a vault gets: the manifest's optional paths, and the choice, which is
// the manifest's default (`findPapelizTemplateDefaultFilesChoice`) when left out. With `chosen`, the
// optional files ticked one by one.
export interface PapelizTemplateVaultFilesChoiceSelection {
  templateManifest: PapelizTemplateManifest
  templateFilesChoice?: PapelizTemplateFilesChoice
  chosenTemplateOptionalFileRelativePaths?: readonly string[]
}

export interface PapelizPreparedTemplateVaultFiles {
  // The choice the files follow: All when no manifest was given.
  templateFilesChoice: PapelizTemplateFilesChoice
  // What goes into the vault, pictures stripped.
  preparedTemplateVaultFiles: PapelizTemplateVaultFile[]
  templateLeftOutPictureRelativePaths: string[]
  // Hidden files Sync doesn't carry (`.gitignore`, `.claude/settings.json`).
  templateHiddenFileRelativePaths: string[]
}

export interface PapelizTemplateVaultMakeOptions {
  onTemplateVaultWriteProgress?: (templateWrittenFileCount: number, templateFileCount: number) => void
  // A folder vault's folder was picked and the folder window has closed.
  onTemplateVaultPlaceFolderPicked?: () => void
  browserVaultEnvironment?: PapelizBrowserVaultEnvironment
  // The browser's folder window, or the tests' stand-in.
  pickTemplateVaultPlaceFolder?: () => Promise<PapelizVaultFolderPickResult>
  folderVaultFileContentsWriter?: PapelizVaultFileContentsWriter
  // Where a folder vault's folder is made, when New Vault's form already shows one: in Papeliz for
  // Windows, its Location row. Null or left out: in a browser the folder window asks; in Papeliz for
  // Windows it's New Vault's starting place, or Windows' folder picker when that can't be found.
  templateVaultParentFolder?: PapelizNewVaultParentFolder | null
}

// The template's included files of one choice as they go into a vault, in path order: pictures
// stripped, or left out when they can't be. Without a choice selection, every included file.
export function preparePapelizTemplateVaultFiles(
  includedTemplateFileBytesByRelativePath: ReadonlyMap<string, Uint8Array>,
  templateVaultFilesChoiceSelection?: PapelizTemplateVaultFilesChoiceSelection,
): PapelizPreparedTemplateVaultFiles {
  const preparedTemplateVaultFiles: PapelizTemplateVaultFile[] = []
  const templateLeftOutPictureRelativePaths: string[] = []
  const templateFilesChoice: PapelizTemplateFilesChoice =
    templateVaultFilesChoiceSelection === undefined
      ? 'all'
      : (templateVaultFilesChoiceSelection.templateFilesChoice ?? findPapelizTemplateDefaultFilesChoice(templateVaultFilesChoiceSelection.templateManifest))
  const chosenTemplateFileRelativePaths = new Set(
    templateVaultFilesChoiceSelection === undefined
      ? includedTemplateFileBytesByRelativePath.keys()
      : selectPapelizTemplateChosenFileRelativePaths(
          [...includedTemplateFileBytesByRelativePath.keys()],
          templateVaultFilesChoiceSelection.templateManifest,
          templateFilesChoice,
          templateVaultFilesChoiceSelection.chosenTemplateOptionalFileRelativePaths,
        ),
  )
  const includedTemplateFiles = [...includedTemplateFileBytesByRelativePath]
    .filter(([templateFileRelativePath]) => chosenTemplateFileRelativePaths.has(templateFileRelativePath))
    .sort(([firstRelativePath], [secondRelativePath]) => (firstRelativePath < secondRelativePath ? -1 : 1))
  for (const [templateFileRelativePath, templateFileBytes] of includedTemplateFiles) {
    const pictureFormat = findPapelizTemplatePictureFormatByName(templateFileRelativePath)
    if (pictureFormat === null) {
      preparedTemplateVaultFiles.push({ templateFileRelativePath, templateFileBytes })
      continue
    }
    try {
      preparedTemplateVaultFiles.push({ templateFileRelativePath, templateFileBytes: stripPapelizTemplatePictureMetadata(templateFileBytes, pictureFormat) })
    } catch {
      templateLeftOutPictureRelativePaths.push(templateFileRelativePath)
    }
  }
  return {
    templateFilesChoice,
    preparedTemplateVaultFiles,
    templateLeftOutPictureRelativePaths,
    templateHiddenFileRelativePaths: includedTemplateFiles
      .map(([templateFileRelativePath]) => templateFileRelativePath)
      .filter((templateFileRelativePath) => !isVaultFileRelativePathSyncable(templateFileRelativePath)),
  }
}

// `.papeliz/template-source.json`, which says which template, commit and choice the vault came from.
export function createPapelizTemplateSourceVaultFile(templateSourceFile: PapelizTemplateSourceFile): PapelizTemplateVaultFile {
  return {
    templateFileRelativePath: `${papelizVaultSettingsFolderName}/${papelizTemplateSourceFileName}`,
    templateFileBytes: new TextEncoder().encode(`${JSON.stringify(templateSourceFile, null, 2)}\n`),
  }
}

// The prepared files as the vault's import writer takes them.
export function listPapelizTemplateVaultImportFiles(preparedTemplateVaultFiles: readonly PapelizTemplateVaultFile[]): PapelizVaultImportFile[] {
  return preparedTemplateVaultFiles.map(({ templateFileRelativePath, templateFileBytes }) => ({
    importFileRelativePath: templateFileRelativePath,
    isImportFileFolder: false,
    importFileByteCount: templateFileBytes.length,
    readImportFileBytes: async () => templateFileBytes,
  }))
}

// A new browser vault holding the template's files (prepared, with the source file), opened.
export async function makePapelizTemplateBrowserVault(
  typedNewVaultName: string,
  templateVaultFiles: readonly PapelizTemplateVaultFile[],
  templateVaultMakeOptions: PapelizTemplateVaultMakeOptions = {},
): Promise<PapelizOpenVaultResult> {
  const browserVaultEnvironment = templateVaultMakeOptions.browserVaultEnvironment ?? getPapelizBrowserVaultEnvironment()
  const browserVaultImportFiles = listPapelizTemplateVaultImportFiles(templateVaultFiles)
  try {
    const madeBrowserVaultRecord = await importPapelizBrowserVault(
      typedNewVaultName,
      {
        suggestedBrowserVaultName: typedNewVaultName,
        browserVaultImportFiles,
        skippedImportFileCount: 0,
        importFileCount: browserVaultImportFiles.length,
        importTotalByteCount: browserVaultImportFiles.reduce((importTotalByteCount, browserVaultImportFile) => importTotalByteCount + browserVaultImportFile.importFileByteCount, 0),
      },
      { onBrowserVaultImportProgress: templateVaultMakeOptions.onTemplateVaultWriteProgress },
      browserVaultEnvironment,
    )
    return await openPapelizBrowserVault(madeBrowserVaultRecord, browserVaultEnvironment)
  } catch (browserVaultMakeError) {
    return {
      openVaultOutcome: 'failed',
      openVaultFailureMessage: describePapelizFailureMessage(`Couldn’t make “${typedNewVaultName}”`, browserVaultMakeError, { failedEntryName: typedNewVaultName, failedEntryKind: 'vault' }),
    }
  }
}

// A new folder vault holding the template's files, opened and remembered for Recent Vaults. The
// browser's folder window comes first, so this must run from a click. A folder whose writing stops
// partway keeps the files written so far, and the failure says so.
export async function makePapelizTemplateFolderVault(
  typedNewVaultName: string,
  templateVaultFiles: readonly PapelizTemplateVaultFile[],
  templateVaultMakeOptions: PapelizTemplateVaultMakeOptions = {},
): Promise<PapelizOpenVaultResult> {
  const templateVaultParentFolder = templateVaultMakeOptions.templateVaultParentFolder ?? null
  if (templateVaultParentFolder?.newVaultParentFolderKind === 'desktop-folder-path' || (templateVaultParentFolder === null && isPapelizDesktopApp)) {
    return makePapelizTemplateDesktopFolderVault(
      typedNewVaultName,
      templateVaultFiles,
      templateVaultMakeOptions,
      templateVaultParentFolder?.newVaultParentFolderKind === 'desktop-folder-path' ? templateVaultParentFolder.desktopParentFolderPath : null,
    )
  }
  const placeFolderPickResult: PapelizVaultFolderPickResult =
    templateVaultParentFolder?.newVaultParentFolderKind === 'browser-folder-handle'
      ? { vaultFolderPickOutcome: 'picked', papelizVaultFolderHandle: templateVaultParentFolder.browserParentFolderHandle }
      : await (templateVaultMakeOptions.pickTemplateVaultPlaceFolder ?? pickPapelizVaultFolderHandle)()
  if (!('vaultFolderPickOutcome' in placeFolderPickResult)) return placeFolderPickResult
  templateVaultMakeOptions.onTemplateVaultPlaceFolderPicked?.()
  let newVaultFolderHandle: FileSystemDirectoryHandle
  try {
    const newFolderVaultFolderResult = await makePapelizNewFolderVaultFolder(placeFolderPickResult.papelizVaultFolderHandle, typedNewVaultName)
    if (newFolderVaultFolderResult.newFolderVaultFolderOutcome !== 'ready') {
      const takenNameEntryKind = newFolderVaultFolderResult.newFolderVaultFolderOutcome === 'folder-not-empty' ? 'folder' : 'file'
      return { openVaultOutcome: 'failed', openVaultFailureMessage: `A ${takenNameEntryKind} named “${typedNewVaultName}” is already there. Pick another name or another place.` }
    }
    newVaultFolderHandle = newFolderVaultFolderResult.papelizVaultFolderHandle
  } catch (newVaultFolderError) {
    return {
      openVaultOutcome: 'failed',
      openVaultFailureMessage: describePapelizFailureMessage(`Couldn’t make “${typedNewVaultName}”`, newVaultFolderError, { failedEntryName: typedNewVaultName, failedEntryKind: 'folder' }),
    }
  }
  let templateWrittenFileCount = 0
  try {
    await writePapelizVaultImportFiles(
      newVaultFolderHandle,
      listPapelizTemplateVaultImportFiles(templateVaultFiles),
      {
        onBrowserVaultImportProgress: (importedFileCount, importFileCount) => {
          templateWrittenFileCount = importedFileCount
          templateVaultMakeOptions.onTemplateVaultWriteProgress?.(importedFileCount, importFileCount)
        },
      },
      templateVaultMakeOptions.folderVaultFileContentsWriter ?? writeVaultFileContentsThroughWritableStream,
    )
  } catch (folderVaultWriteError) {
    return { openVaultOutcome: 'failed', openVaultFailureMessage: describeTemplateFolderVaultWriteFailure(typedNewVaultName, folderVaultWriteError, templateWrittenFileCount) }
  }
  return openPapelizVaultFolderHandle(newVaultFolderHandle)
}

// Why a folder vault's writing stopped, and how far it got: its folder keeps the files written so far.
function describeTemplateFolderVaultWriteFailure(typedNewVaultName: string, folderVaultWriteError: unknown, templateWrittenFileCount: number): string {
  const writtenFilesSentence =
    templateWrittenFileCount === 0
      ? 'Its folder is there, still empty.'
      : `The ${templateWrittenFileCount === 1 ? 'file' : `${templateWrittenFileCount} files`} written so far stay in its folder.`
  return `Couldn’t finish “${typedNewVaultName}”. ${describePapelizErrorSentence(folderVaultWriteError)} ${writtenFilesSentence}`
}

// The template's folders and files written by absolute path, through Papeliz for Windows' native side.
function createTemplateDesktopVaultFolderWriter(desktopFileSystem: PapelizDesktopFileSystem): PapelizVaultImportFolderWriter<string> {
  return {
    makeVaultImportSubfolder: async (vaultImportParentDesktopFolderPath, vaultImportSubfolderName) => {
      const vaultImportSubfolderDesktopPath = desktopFileSystem.joinDesktopPath(vaultImportParentDesktopFolderPath, vaultImportSubfolderName)
      await desktopFileSystem.makeDesktopFolder(vaultImportSubfolderDesktopPath)
      return vaultImportSubfolderDesktopPath
    },
    writeVaultImportFile: async (vaultImportDesktopFolderPath, vaultImportFileName, readImportFileBytes) =>
      desktopFileSystem.writeDesktopFileBytes(desktopFileSystem.joinDesktopPath(vaultImportDesktopFolderPath, vaultImportFileName), await readImportFileBytes()),
  }
}

// The folder vault in Papeliz for Windows: made by its path inside the Location folder, as New Vault
// makes one there, written through the native side, then opened and remembered by its path. With no
// Location given, New Vault's starting place, and Windows' folder picker only when that can't be found.
async function makePapelizTemplateDesktopFolderVault(
  typedNewVaultName: string,
  templateVaultFiles: readonly PapelizTemplateVaultFile[],
  templateVaultMakeOptions: PapelizTemplateVaultMakeOptions,
  givenDesktopParentFolderPath: string | null,
): Promise<PapelizOpenVaultResult> {
  const papelizDesktopPlatform = await waitForPapelizDesktopPlatform()
  if (papelizDesktopPlatform === null) {
    return { openVaultOutcome: 'failed', openVaultFailureMessage: describePapelizFailureCodeMessage(`Couldn’t make “${typedNewVaultName}”`, 'Not Supported Yet') }
  }
  let desktopParentFolderPath = givenDesktopParentFolderPath
  if (desktopParentFolderPath === null) {
    const newVaultDefaultParentFolder = await readPapelizNewVaultDefaultParentFolder()
    if (newVaultDefaultParentFolder?.newVaultParentFolderKind === 'desktop-folder-path') desktopParentFolderPath = newVaultDefaultParentFolder.desktopParentFolderPath
  }
  if (desktopParentFolderPath === null) {
    const newVaultParentFolderPickResult = await pickPapelizNewVaultParentFolder()
    if (!('newVaultParentFolderPickOutcome' in newVaultParentFolderPickResult)) return newVaultParentFolderPickResult
    const { pickedNewVaultParentFolder } = newVaultParentFolderPickResult
    if (pickedNewVaultParentFolder.newVaultParentFolderKind !== 'desktop-folder-path') return { openVaultOutcome: 'cancelled' }
    desktopParentFolderPath = pickedNewVaultParentFolder.desktopParentFolderPath
  }
  templateVaultMakeOptions.onTemplateVaultPlaceFolderPicked?.()
  const { desktopFileSystem } = papelizDesktopPlatform
  let newDesktopFolderVaultFolderResult: PapelizNewDesktopFolderVaultFolderResult
  try {
    newDesktopFolderVaultFolderResult = await makePapelizNewDesktopFolderVaultFolder(desktopParentFolderPath, typedNewVaultName, desktopFileSystem)
  } catch (newVaultFolderError) {
    return {
      openVaultOutcome: 'failed',
      openVaultFailureMessage: describePapelizFailureMessage(`Couldn’t make “${typedNewVaultName}”`, newVaultFolderError, { failedEntryName: typedNewVaultName, failedEntryKind: 'folder' }),
    }
  }
  if (newDesktopFolderVaultFolderResult.newFolderVaultFolderOutcome !== 'ready') {
    return { openVaultOutcome: 'failed', openVaultFailureMessage: describeNewFolderVaultNameTakenMessage(newDesktopFolderVaultFolderResult.newFolderVaultFolderOutcome, typedNewVaultName) }
  }
  const { desktopVaultFolderPath } = newDesktopFolderVaultFolderResult
  let templateWrittenFileCount = 0
  try {
    await writePapelizVaultImportFilesThroughFolderWriter(
      desktopVaultFolderPath,
      listPapelizTemplateVaultImportFiles(templateVaultFiles),
      {
        onBrowserVaultImportProgress: (importedFileCount, importFileCount) => {
          templateWrittenFileCount = importedFileCount
          templateVaultMakeOptions.onTemplateVaultWriteProgress?.(importedFileCount, importFileCount)
        },
      },
      createTemplateDesktopVaultFolderWriter(desktopFileSystem),
    )
  } catch (folderVaultWriteError) {
    return { openVaultOutcome: 'failed', openVaultFailureMessage: describeTemplateFolderVaultWriteFailure(typedNewVaultName, folderVaultWriteError, templateWrittenFileCount) }
  }
  return openPapelizDesktopVaultFolderPath(desktopVaultFolderPath, papelizDesktopPlatform, { isDesktopVaultFolderJustPicked: true })
}
