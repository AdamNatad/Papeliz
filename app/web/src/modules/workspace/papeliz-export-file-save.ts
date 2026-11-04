import { isPapelizDesktopApp } from 'virtual:papeliz-desktop-platform-availability'
import { loadPapelizMobilePlatform } from 'virtual:papeliz-mobile-platform'
import { isPapelizMobileApp } from 'virtual:papeliz-mobile-platform-availability'
import type { PapelizDesktopPlatform } from '../desktop/papeliz-desktop-platform-contract'
import { usePapelizDesktopPlatformStore } from '../desktop/papeliz-desktop-platform-store'
import type { PapelizMobilePlatform } from '../mobile/papeliz-mobile-platform-contract'
import { describePapelizFailureCode } from '../vault/papeliz-failure-code-words'
import { describePapelizVaultError } from '../vault/papeliz-vault-adapter'

// Saving an export where the person chooses. The file is built first and the save dialog opens when
// it is done: Chrome creates the chosen file as soon as its dialog closes, so a cancelled or failed
// export never leaves an empty file behind. Chrome and Edge open the dialog only shortly after a
// click; an export that takes longer downloads instead, as it does in browsers with no dialog, and so
// does one the browser won't let Papeliz write where the person chose. A browser that refused once
// isn't asked again: its dialog had already made the file, empty. Also the safe names every export's
// files get, and the sentences a failed export shows.

// Characters a file name can't hold on Windows, macOS or Linux.
const papelizFileNameUnsafeCharacterPattern = /[<>:"/\\|?*\p{Cc}]/gu

// A name any computer accepts as a file name, before its extension.
export function getPapelizSafeFileNameStem(fileNameText: string, fallbackFileNameStem: string): string {
  const safeFileNameStem = fileNameText.replace(papelizFileNameUnsafeCharacterPattern, '-').replace(/[. ]+$/, '').trim()
  return safeFileNameStem.length > 0 ? safeFileNameStem : fallbackFileNameStem
}

type PapelizExportFileDestination = { exportFileDestinationKind: 'chosen-file'; exportFileHandle: FileSystemFileHandle } | { exportFileDestinationKind: 'download' }

// Set once this browser shows the save dialog but then refuses Papeliz the file (as some apps built on
// Chrome do). The dialog makes the chosen file the moment it closes, so asking again would leave
// another empty file next to the download; from then on exports download straight away.
const papelizExportChosenFileWriteRefusedStorageKey = 'papeliz:export-chosen-file-write-refused:v1'

function readPapelizExportChosenFileWriteRefused(): boolean {
  try {
    return localStorage.getItem(papelizExportChosenFileWriteRefusedStorageKey) === 'refused'
  } catch {
    return false
  }
}

function notePapelizExportChosenFileWriteRefused(): void {
  try {
    localStorage.setItem(papelizExportChosenFileWriteRefusedStorageKey, 'refused')
  } catch {
    // No storage (as in some private windows): the dialog shows again next time.
  }
}

export interface PapelizExportFileKind {
  exportFileDescription: string
  exportFileMediaType: string
  exportFileExtension: string
}

// Where a built export went: the file chosen in the save dialog, the downloads (also when the chosen
// file couldn't be written), or nowhere because the person closed the dialog.
export type PapelizExportFileSaveOutcome = 'saved-to-chosen-file' | 'downloaded' | 'downloaded-instead-of-chosen-file' | 'save-dialog-closed'

// The sentence for a failed export. An export reads the vault and writes one new file, so the vault
// folder's sentences ("this folder", "Recent Vaults") would point the wrong way; these name the export.
// In the desktop app the refusal is Windows', for the folder picked in its save dialog, and in the
// phone app the phone's, for the place picked in its save screen.
export function describePapelizExportErrorSentence(exportError: unknown): string {
  const exportFailureCode = describePapelizVaultError(exportError)
  if (exportFailureCode === 'No Permission') {
    if (isPapelizDesktopApp) return 'Windows didn’t let Papeliz save there. Pick another folder, then try again.'
    if (isPapelizMobileApp) return 'The phone didn’t let Papeliz save there. Pick another place, then try again.'
    return 'The browser didn’t let Papeliz finish the export. Try again.'
  }
  if (exportFailureCode === 'File Not Found') return 'A note was moved or deleted while it was exported. Try again.'
  return describePapelizFailureCode(exportFailureCode)
}

// Null when the person closes the save dialog.
async function choosePapelizExportFileDestination(exportFileName: string, exportFileKind: PapelizExportFileKind): Promise<PapelizExportFileDestination | null> {
  if (window.showSaveFilePicker === undefined || readPapelizExportChosenFileWriteRefused()) return { exportFileDestinationKind: 'download' }
  try {
    const exportFileHandle = await window.showSaveFilePicker({
      suggestedName: exportFileName,
      types: [{ description: exportFileKind.exportFileDescription, accept: { [exportFileKind.exportFileMediaType]: [exportFileKind.exportFileExtension] } }],
    })
    return { exportFileDestinationKind: 'chosen-file', exportFileHandle }
  } catch (savePickerError) {
    if (savePickerError instanceof DOMException && savePickerError.name === 'AbortError') return null
    // No dialog after all (the click was too long ago, or the browser refused): download instead.
    return { exportFileDestinationKind: 'download' }
  }
}

// Writes the export into the file chosen in the save dialog; false when the browser didn't let it.
async function writePapelizExportFileToChosenFile(exportFileHandle: FileSystemFileHandle, exportFileBlob: Blob): Promise<boolean> {
  let exportFileWritableStream: FileSystemWritableFileStream | null = null
  try {
    exportFileWritableStream = await exportFileHandle.createWritable()
    await exportFileWritableStream.write(exportFileBlob)
    await exportFileWritableStream.close()
    return true
  } catch (exportFileWriteError) {
    // The write stops unfinished; the file the dialog created stays as it was, maybe empty.
    await exportFileWritableStream?.abort().catch(() => undefined)
    console.warn('Papeliz export file write:', exportFileWriteError)
    if (exportFileWriteError instanceof DOMException && exportFileWriteError.name === 'NotAllowedError') notePapelizExportChosenFileWriteRefused()
    return false
  }
}

function downloadPapelizExportFile(exportFileName: string, exportFileBlob: Blob): void {
  const exportFileObjectUrl = URL.createObjectURL(exportFileBlob)
  const exportFileDownloadLink = document.createElement('a')
  exportFileDownloadLink.href = exportFileObjectUrl
  exportFileDownloadLink.download = exportFileName
  document.body.append(exportFileDownloadLink)
  exportFileDownloadLink.click()
  exportFileDownloadLink.remove()
  // The browser starts the download from the link; the address can go once it has.
  window.setTimeout(() => URL.revokeObjectURL(exportFileObjectUrl), 60_000)
}

// Papeliz for Windows saves through Windows' own Save dialog and writes the file there itself, with no
// time limit after the click. A file it can't write fails the export, as nothing downloads in the app.
async function savePapelizExportFileWithDesktopDialog(
  papelizDesktopPlatform: PapelizDesktopPlatform,
  exportFileName: string,
  exportFileKind: PapelizExportFileKind,
  exportFileBlob: Blob,
): Promise<PapelizExportFileSaveOutcome> {
  const chosenDesktopFilePath = await papelizDesktopPlatform.pickDesktopSaveFilePath({
    suggestedDesktopFileName: exportFileName,
    desktopFileTypeFilters: [{ desktopFileTypeName: exportFileKind.exportFileDescription, desktopFileExtensions: [exportFileKind.exportFileExtension.replace(/^\./, '')] }],
  })
  if (chosenDesktopFilePath === null) return 'save-dialog-closed'
  await papelizDesktopPlatform.desktopFileSystem.writeDesktopFileBytes(chosenDesktopFilePath, new Uint8Array(await exportFileBlob.arrayBuffer()))
  return 'saved-to-chosen-file'
}

// Papeliz for Android saves through the phone's own save screen (Create Document), which writes the file
// where the person picks, with no time limit after the click. The web view's own save dialog closes at
// once there and nothing downloads, so a file the phone can't write fails the export.
async function savePapelizExportFileWithMobileSaveScreen(
  papelizMobilePlatform: PapelizMobilePlatform,
  exportFileName: string,
  exportFileKind: PapelizExportFileKind,
  exportFileBlob: Blob,
): Promise<PapelizExportFileSaveOutcome> {
  const mobileSaveFileOutcome = await papelizMobilePlatform.saveFileWithMobileSaveScreen({
    suggestedMobileFileName: exportFileName,
    mobileFileMediaType: exportFileKind.exportFileMediaType,
    mobileFileBlob: exportFileBlob,
  })
  return mobileSaveFileOutcome === 'saved-to-chosen-file' ? 'saved-to-chosen-file' : 'save-dialog-closed'
}

// Builds the export, then saves it: the save dialog opens only once the file is ready, so stopping
// or failing while it is built creates no file. When the chosen file can't be written, the same file
// downloads instead, so the export still lands.
export async function buildThenSavePapelizExportFile<PapelizBuiltExport extends { exportFileBlob: Blob }>(
  exportFileName: string,
  exportFileKind: PapelizExportFileKind,
  buildExportFile: () => Promise<PapelizBuiltExport>,
): Promise<{ builtExport: PapelizBuiltExport; exportFileSaveOutcome: PapelizExportFileSaveOutcome }> {
  const builtExport = await buildExportFile()
  const papelizDesktopPlatform = usePapelizDesktopPlatformStore.getState().papelizDesktopPlatform
  if (papelizDesktopPlatform !== null) {
    return {
      builtExport,
      exportFileSaveOutcome: await savePapelizExportFileWithDesktopDialog(papelizDesktopPlatform, exportFileName, exportFileKind, builtExport.exportFileBlob),
    }
  }
  if (isPapelizMobileApp) {
    const papelizMobilePlatformLoadResult = await loadPapelizMobilePlatform()
    if (papelizMobilePlatformLoadResult.papelizMobilePlatformAvailability === 'in-the-mobile-app') {
      return {
        builtExport,
        exportFileSaveOutcome: await savePapelizExportFileWithMobileSaveScreen(
          papelizMobilePlatformLoadResult.papelizMobilePlatform,
          exportFileName,
          exportFileKind,
          builtExport.exportFileBlob,
        ),
      }
    }
  }
  const exportFileDestination = await choosePapelizExportFileDestination(exportFileName, exportFileKind)
  if (exportFileDestination === null) return { builtExport, exportFileSaveOutcome: 'save-dialog-closed' }
  if (exportFileDestination.exportFileDestinationKind === 'chosen-file') {
    if (await writePapelizExportFileToChosenFile(exportFileDestination.exportFileHandle, builtExport.exportFileBlob)) {
      return { builtExport, exportFileSaveOutcome: 'saved-to-chosen-file' }
    }
    downloadPapelizExportFile(exportFileName, builtExport.exportFileBlob)
    return { builtExport, exportFileSaveOutcome: 'downloaded-instead-of-chosen-file' }
  }
  downloadPapelizExportFile(exportFileName, builtExport.exportFileBlob)
  return { builtExport, exportFileSaveOutcome: 'downloaded' }
}
