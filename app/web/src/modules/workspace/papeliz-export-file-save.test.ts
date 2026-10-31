import { afterEach, describe, expect, it, vi } from 'vitest'
import { PapelizVaultOperationError } from '../vault/papeliz-vault-adapter'
import { buildThenSavePapelizExportFile, type PapelizExportFileKind } from './papeliz-export-file-save'

const testExportFileKind: PapelizExportFileKind = { exportFileDescription: 'PDF document', exportFileMediaType: 'application/pdf', exportFileExtension: '.pdf' }

interface StubbedSaveDialog {
  // What happened, in order: "built", "dialog", "write …", "close", "abort", "download …".
  exportSaveSteps: string[]
}

// A Chrome-like page: `saveDialogAnswer` is what the save dialog does, `writeFailure` makes the
// chosen file's write fail. Without a dialog, the page downloads through a link.
function stubExportSavePage({
  saveDialogAnswer,
  writeFailure = null,
}: {
  saveDialogAnswer: 'choose-file' | 'close-dialog' | 'refuse-without-click' | 'no-dialog'
  writeFailure?: DOMException | null
}): StubbedSaveDialog {
  const stubbedSaveDialog: StubbedSaveDialog = { exportSaveSteps: [] }
  const exportSaveSteps = stubbedSaveDialog.exportSaveSteps
  const showSaveFilePicker = async () => {
    exportSaveSteps.push('dialog')
    if (saveDialogAnswer === 'close-dialog') throw new DOMException('The user aborted a request.', 'AbortError')
    if (saveDialogAnswer === 'refuse-without-click') throw new DOMException('Must be handling a user gesture to show a file picker.', 'SecurityError')
    return {
      createWritable: async () => ({
        write: async (writtenBlob: Blob) => {
          if (writeFailure !== null) throw writeFailure
          exportSaveSteps.push(`write ${await writtenBlob.text()}`)
        },
        close: async () => {
          exportSaveSteps.push('close')
        },
        abort: async () => {
          exportSaveSteps.push('abort')
        },
      }),
    }
  }
  vi.stubGlobal('window', { showSaveFilePicker: saveDialogAnswer === 'no-dialog' ? undefined : showSaveFilePicker, setTimeout: () => 0 })
  vi.stubGlobal('document', {
    body: { append: () => undefined },
    createElement: () => {
      const downloadLink = {
        href: '',
        download: '',
        click: () => exportSaveSteps.push(`download ${downloadLink.download}`),
        remove: () => undefined,
      }
      return downloadLink
    },
  })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:papeliz-test-export')
  return stubbedSaveDialog
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('building an export, then saving it', () => {
  it('opens the save dialog only once the file is built, and writes it there', async () => {
    const { exportSaveSteps } = stubExportSavePage({ saveDialogAnswer: 'choose-file' })
    const exportSaveResult = await buildThenSavePapelizExportFile('Start here.pdf', testExportFileKind, async () => {
      exportSaveSteps.push('built')
      return { exportFileBlob: new Blob(['%PDF-1.7']), exportNotices: ['one notice'] }
    })
    expect(exportSaveSteps).toEqual(['built', 'dialog', 'write %PDF-1.7', 'close'])
    expect(exportSaveResult).toEqual({ builtExport: { exportFileBlob: expect.any(Blob), exportNotices: ['one notice'] }, exportFileSaveOutcome: 'saved-to-chosen-file' })
  })

  it('never opens the save dialog when the build is cancelled or fails, so no file is made', async () => {
    const { exportSaveSteps } = stubExportSavePage({ saveDialogAnswer: 'choose-file' })
    const cancelledBuild = buildThenSavePapelizExportFile('Start here.pdf', testExportFileKind, async () => {
      throw new DOMException('The export was cancelled.', 'AbortError')
    })
    await expect(cancelledBuild).rejects.toThrow('The export was cancelled.')
    const failedBuild = buildThenSavePapelizExportFile('Start here.pdf', testExportFileKind, async () => {
      throw new PapelizVaultOperationError('a note couldn’t be read')
    })
    await expect(failedBuild).rejects.toThrow('a note couldn’t be read')
    expect(exportSaveSteps).toEqual([])
  })

  it('writes nothing when the person closes the save dialog', async () => {
    const { exportSaveSteps } = stubExportSavePage({ saveDialogAnswer: 'close-dialog' })
    const { exportFileSaveOutcome } = await buildThenSavePapelizExportFile('Start here.pdf', testExportFileKind, async () => ({ exportFileBlob: new Blob(['%PDF-1.7']) }))
    expect(exportFileSaveOutcome).toBe('save-dialog-closed')
    expect(exportSaveSteps).toEqual(['dialog'])
  })

  it('downloads when the click was too long ago for the dialog, or the browser has none', async () => {
    const { exportSaveSteps: refusedDialogSteps } = stubExportSavePage({ saveDialogAnswer: 'refuse-without-click' })
    const refusedDialogResult = await buildThenSavePapelizExportFile('Notes.zip', testExportFileKind, async () => ({ exportFileBlob: new Blob(['zip']) }))
    expect(refusedDialogResult.exportFileSaveOutcome).toBe('downloaded')
    expect(refusedDialogSteps).toEqual(['dialog', 'download Notes.zip'])

    vi.unstubAllGlobals()
    const { exportSaveSteps: noDialogSteps } = stubExportSavePage({ saveDialogAnswer: 'no-dialog' })
    const noDialogResult = await buildThenSavePapelizExportFile('Notes.zip', testExportFileKind, async () => ({ exportFileBlob: new Blob(['zip']) }))
    expect(noDialogResult.exportFileSaveOutcome).toBe('downloaded')
    expect(noDialogSteps).toEqual(['download Notes.zip'])
  })

  it('says plainly when the chosen file can’t be written, and stops the write', async () => {
    const { exportSaveSteps } = stubExportSavePage({ saveDialogAnswer: 'choose-file', writeFailure: new DOMException('Not enough space.', 'QuotaExceededError') })
    const failedWrite = buildThenSavePapelizExportFile('Start here.pdf', testExportFileKind, async () => ({ exportFileBlob: new Blob(['%PDF-1.7']) }))
    await expect(failedWrite).rejects.toThrow(new PapelizVaultOperationError('“Start here.pdf” couldn’t be written where you chose (Disk Full), so the file there may be empty'))
    expect(exportSaveSteps).toEqual(['dialog', 'abort'])
  })
})
