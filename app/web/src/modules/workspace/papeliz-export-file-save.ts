import { describePapelizVaultError, PapelizVaultOperationError } from '../vault/papeliz-vault-adapter'

// Saving an export where the person chooses. The file is built first and the save dialog opens when
// it is done: Chrome creates the chosen file as soon as its dialog closes, so a cancelled or failed
// export never leaves an empty file behind. Chrome and Edge open the dialog only shortly after a
// click; an export that takes longer downloads instead, as it does in browsers with no dialog. Also
// the safe names every export's files get.

// Characters a file name can't hold on Windows, macOS or Linux.
const papelizFileNameUnsafeCharacterPattern = /[<>:"/\\|?*\p{Cc}]/gu

// A name any computer accepts as a file name, before its extension.
export function getPapelizSafeFileNameStem(fileNameText: string, fallbackFileNameStem: string): string {
  const safeFileNameStem = fileNameText.replace(papelizFileNameUnsafeCharacterPattern, '-').replace(/[. ]+$/, '').trim()
  return safeFileNameStem.length > 0 ? safeFileNameStem : fallbackFileNameStem
}

type PapelizExportFileDestination = { exportFileDestinationKind: 'chosen-file'; exportFileHandle: FileSystemFileHandle } | { exportFileDestinationKind: 'download' }

export interface PapelizExportFileKind {
  exportFileDescription: string
  exportFileMediaType: string
  exportFileExtension: string
}

// Where a built export went: the file chosen in the save dialog, the downloads, or nowhere because
// the person closed the dialog.
export type PapelizExportFileSaveOutcome = 'saved-to-chosen-file' | 'downloaded' | 'save-dialog-closed'

// Null when the person closes the save dialog.
async function choosePapelizExportFileDestination(exportFileName: string, exportFileKind: PapelizExportFileKind): Promise<PapelizExportFileDestination | null> {
  if (window.showSaveFilePicker === undefined) return { exportFileDestinationKind: 'download' }
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

async function writePapelizExportFile(exportFileDestination: PapelizExportFileDestination, exportFileName: string, exportFileBlob: Blob): Promise<void> {
  if (exportFileDestination.exportFileDestinationKind === 'chosen-file') {
    let exportFileWritableStream: FileSystemWritableFileStream | null = null
    try {
      exportFileWritableStream = await exportFileDestination.exportFileHandle.createWritable()
      await exportFileWritableStream.write(exportFileBlob)
      await exportFileWritableStream.close()
    } catch (exportFileWriteError) {
      // The write stops unfinished; the file the dialog created stays as it was, maybe empty.
      await exportFileWritableStream?.abort().catch(() => undefined)
      throw new PapelizVaultOperationError(`“${exportFileName}” couldn’t be written where you chose (${describePapelizVaultError(exportFileWriteError)}), so the file there may be empty`)
    }
    return
  }
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

// Builds the export, then saves it: the save dialog opens only once the file is ready, so stopping
// or failing while it is built creates no file. A failed write after the dialog says so plainly.
export async function buildThenSavePapelizExportFile<PapelizBuiltExport extends { exportFileBlob: Blob }>(
  exportFileName: string,
  exportFileKind: PapelizExportFileKind,
  buildExportFile: () => Promise<PapelizBuiltExport>,
): Promise<{ builtExport: PapelizBuiltExport; exportFileSaveOutcome: PapelizExportFileSaveOutcome }> {
  const builtExport = await buildExportFile()
  const exportFileDestination = await choosePapelizExportFileDestination(exportFileName, exportFileKind)
  if (exportFileDestination === null) return { builtExport, exportFileSaveOutcome: 'save-dialog-closed' }
  await writePapelizExportFile(exportFileDestination, exportFileName, builtExport.exportFileBlob)
  return { builtExport, exportFileSaveOutcome: exportFileDestination.exportFileDestinationKind === 'chosen-file' ? 'saved-to-chosen-file' : 'downloaded' }
}
