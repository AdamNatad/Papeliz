import { importPapelizBrowserVault, writePapelizVaultImportFiles, type PapelizBrowserVaultImportFile } from '../vault/papeliz-browser-vault-import'
import { getPapelizBrowserVaultEnvironment, openPapelizBrowserVault, type PapelizBrowserVaultEnvironment } from '../vault/papeliz-browser-vaults'
import { writeVaultFileContentsThroughWritableStream, type PapelizVaultFileContentsWriter } from '../vault/papeliz-directory-handle-vault-adapter'
import { describePapelizErrorSentence, describePapelizFailureMessage } from '../vault/papeliz-failure-code-words'
import {
  makePapelizNewFolderVaultFolder,
  openPapelizVaultFolderHandle,
  pickPapelizVaultFolderHandle,
  type PapelizOpenVaultResult,
  type PapelizVaultFolderPickResult,
} from '../vault/papeliz-open-vault'
import { isVaultFileRelativePathSyncable, papelizVaultSettingsFolderName } from '../vault/papeliz-vault-relative-paths'
import { papelizTemplateSourceFileName, type PapelizTemplateSourceFile } from './papeliz-template-gallery-contract'
import { findPapelizTemplatePictureFormatByName, stripPapelizTemplatePictureMetadata } from './papeliz-template-gallery-picture-metadata'

// Makes a new vault from a template's checked files, through New Vault's own steps: a browser vault
// is made and filled as an import is (taken back whole if it can't be finished), and a folder vault
// is a new folder, named after the vault, inside the folder picked. Every picture is stripped of its
// metadata on the way; a picture that can't be is left out. The vault also gets
// `.papeliz/template-source.json`, which says which template and commit it came from.

export interface PapelizTemplateVaultFile {
  templateFileRelativePath: string
  templateFileBytes: Uint8Array
}

export interface PapelizPreparedTemplateVaultFiles {
  // What goes into the vault, pictures stripped.
  preparedTemplateVaultFiles: PapelizTemplateVaultFile[]
  templateLeftOutPictureRelativePaths: string[]
  // Hidden files Sync doesn't carry (`.gitignore`, `.claude/settings.json`).
  templateHiddenFileRelativePaths: string[]
}

export interface PapelizTemplateVaultMakeOptions {
  onTemplateVaultWriteProgress?: (templateWrittenFileCount: number, templateFileCount: number) => void
  browserVaultEnvironment?: PapelizBrowserVaultEnvironment
  // The browser's folder window, or the tests' stand-in.
  pickTemplateVaultPlaceFolder?: () => Promise<PapelizVaultFolderPickResult>
  folderVaultFileContentsWriter?: PapelizVaultFileContentsWriter
}

// The template's included files as they go into a vault, in path order: pictures stripped, or left
// out when they can't be.
export function preparePapelizTemplateVaultFiles(includedTemplateFileBytesByRelativePath: ReadonlyMap<string, Uint8Array>): PapelizPreparedTemplateVaultFiles {
  const preparedTemplateVaultFiles: PapelizTemplateVaultFile[] = []
  const templateLeftOutPictureRelativePaths: string[] = []
  const includedTemplateFiles = [...includedTemplateFileBytesByRelativePath].sort(([firstRelativePath], [secondRelativePath]) => (firstRelativePath < secondRelativePath ? -1 : 1))
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
    preparedTemplateVaultFiles,
    templateLeftOutPictureRelativePaths,
    templateHiddenFileRelativePaths: includedTemplateFiles
      .map(([templateFileRelativePath]) => templateFileRelativePath)
      .filter((templateFileRelativePath) => !isVaultFileRelativePathSyncable(templateFileRelativePath)),
  }
}

// `.papeliz/template-source.json`, which says which template and commit the vault came from.
export function createPapelizTemplateSourceVaultFile(templateSourceFile: PapelizTemplateSourceFile): PapelizTemplateVaultFile {
  return {
    templateFileRelativePath: `${papelizVaultSettingsFolderName}/${papelizTemplateSourceFileName}`,
    templateFileBytes: new TextEncoder().encode(`${JSON.stringify(templateSourceFile, null, 2)}\n`),
  }
}

function listVaultImportFiles(preparedTemplateVaultFiles: readonly PapelizTemplateVaultFile[]): PapelizBrowserVaultImportFile[] {
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
  const browserVaultImportFiles = listVaultImportFiles(templateVaultFiles)
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
  const placeFolderPickResult = await (templateVaultMakeOptions.pickTemplateVaultPlaceFolder ?? pickPapelizVaultFolderHandle)()
  if (!('vaultFolderPickOutcome' in placeFolderPickResult)) return placeFolderPickResult
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
      listVaultImportFiles(templateVaultFiles),
      {
        onBrowserVaultImportProgress: (importedFileCount, importFileCount) => {
          templateWrittenFileCount = importedFileCount
          templateVaultMakeOptions.onTemplateVaultWriteProgress?.(importedFileCount, importFileCount)
        },
      },
      templateVaultMakeOptions.folderVaultFileContentsWriter ?? writeVaultFileContentsThroughWritableStream,
    )
  } catch (folderVaultWriteError) {
    const writtenFilesSentence =
      templateWrittenFileCount === 0
        ? 'Its folder is there, still empty.'
        : `The ${templateWrittenFileCount === 1 ? 'file' : `${templateWrittenFileCount} files`} written so far stay in its folder.`
    return {
      openVaultOutcome: 'failed',
      openVaultFailureMessage: `Couldn’t finish “${typedNewVaultName}”. ${describePapelizErrorSentence(folderVaultWriteError)} ${writtenFilesSentence}`,
    }
  }
  return openPapelizVaultFolderHandle(newVaultFolderHandle)
}
