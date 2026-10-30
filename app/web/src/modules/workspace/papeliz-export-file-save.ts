// Saving an export where the person chooses. Chrome and Edge show their save dialog, but only right
// after a click, so the place is chosen first and the file written when the export is done. Other
// browsers download it.

export type PapelizExportFileDestination = { exportFileDestinationKind: 'chosen-file'; exportFileHandle: FileSystemFileHandle } | { exportFileDestinationKind: 'download' }

export interface PapelizExportFileKind {
  exportFileDescription: string
  exportFileMediaType: string
  exportFileExtension: string
}

// Null when the person closes the save dialog.
export async function choosePapelizExportFileDestination(exportFileName: string, exportFileKind: PapelizExportFileKind): Promise<PapelizExportFileDestination | null> {
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

export async function writePapelizExportFile(exportFileDestination: PapelizExportFileDestination, exportFileName: string, exportFileBlob: Blob): Promise<void> {
  if (exportFileDestination.exportFileDestinationKind === 'chosen-file') {
    const exportFileWritableStream = await exportFileDestination.exportFileHandle.createWritable()
    await exportFileWritableStream.write(exportFileBlob)
    await exportFileWritableStream.close()
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
