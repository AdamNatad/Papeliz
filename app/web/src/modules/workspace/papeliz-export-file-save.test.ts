import { afterEach, describe, expect, it, vi } from 'vitest'
import { PapelizVaultOperationError } from '../vault/papeliz-vault-adapter'
import { buildThenSavePapelizExportFile, describePapelizExportErrorSentence, type PapelizExportFileKind } from './papeliz-export-file-save'

const testExportFileKind: PapelizExportFileKind = { exportFileDescription: 'PDF document', exportFileMediaType: 'application/pdf', exportFileExtension: '.pdf' }

interface StubbedSaveDialog {
  // What happened, in order: "built", "dialog", "write …", "close", "abort", "download …".
  exportSaveSteps: string[]
}

// A Chrome-like page: `saveDialogAnswer` is what the save dialog does, `openWritableFailure` makes
// opening the chosen file for writing fail, `writeFailure` makes its write fail. Without a dialog,
// the page downloads through a link. The page's storage starts empty.
function stubExportSavePage({
  saveDialogAnswer,
  openWritableFailure = null,
  writeFailure = null,
}: {
  saveDialogAnswer: 'choose-file' | 'close-dialog' | 'refuse-without-click' | 'no-dialog'
  openWritableFailure?: DOMException | null
  writeFailure?: DOMException | null
}): StubbedSaveDialog {
  const stubbedSaveDialog: StubbedSaveDialog = { exportSaveSteps: [] }
  const exportSaveSteps = stubbedSaveDialog.exportSaveSteps
  const showSaveFilePicker = async () => {
    exportSaveSteps.push('dialog')
    if (saveDialogAnswer === 'close-dialog') throw new DOMException('The user aborted a request.', 'AbortError')
    if (saveDialogAnswer === 'refuse-without-click') throw new DOMException('Must be handling a user gesture to show a file picker.', 'SecurityError')
    return {
      createWritable: async () => {
        if (openWritableFailure !== null) throw openWritableFailure
        return {
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
        }
      },
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
  const storedTexts = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (storageKey: string) => storedTexts.get(storageKey) ?? null,
    setItem: (storageKey: string, storedText: string) => storedTexts.set(storageKey, storedText),
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

  it('writes and downloads nothing when the person closes the save dialog', async () => {
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

  it('downloads the same file when the chosen file’s write fails, after stopping the write, and asks again next time', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { exportSaveSteps } = stubExportSavePage({ saveDialogAnswer: 'choose-file', writeFailure: new DOMException('Not enough space.', 'QuotaExceededError') })
    const { exportFileSaveOutcome } = await buildThenSavePapelizExportFile('Start here.pdf', testExportFileKind, async () => ({ exportFileBlob: new Blob(['%PDF-1.7']) }))
    expect(exportFileSaveOutcome).toBe('downloaded-instead-of-chosen-file')
    expect(exportSaveSteps).toEqual(['dialog', 'abort', 'download Start here.pdf'])
    await buildThenSavePapelizExportFile('Start here.pdf', testExportFileKind, async () => ({ exportFileBlob: new Blob(['%PDF-1.7']) }))
    expect(exportSaveSteps.slice(3)).toEqual(['dialog', 'abort', 'download Start here.pdf'])
  })

  it('downloads the same file when the browser won’t let Papeliz write where the person chose, and then downloads without asking', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { exportSaveSteps } = stubExportSavePage({ saveDialogAnswer: 'choose-file', openWritableFailure: new DOMException('The request is not allowed.', 'NotAllowedError') })
    const { exportFileSaveOutcome } = await buildThenSavePapelizExportFile('Start here.pdf', testExportFileKind, async () => ({ exportFileBlob: new Blob(['%PDF-1.7']) }))
    expect(exportFileSaveOutcome).toBe('downloaded-instead-of-chosen-file')
    expect(exportSaveSteps).toEqual(['dialog', 'download Start here.pdf'])
    // The refused dialog had made an empty file; the next export doesn't open it to make another.
    const { exportFileSaveOutcome: nextExportFileSaveOutcome } = await buildThenSavePapelizExportFile('Inbox.pdf', testExportFileKind, async () => ({
      exportFileBlob: new Blob(['%PDF-1.7']),
    }))
    expect(nextExportFileSaveOutcome).toBe('downloaded')
    expect(exportSaveSteps.slice(2)).toEqual(['download Inbox.pdf'])
  })
})

describe('the sentence a failed export shows', () => {
  it('never uses the vault folder’s sentences for a refused permission or a missing file', () => {
    const permissionSentence = describePapelizExportErrorSentence(new DOMException('The request is not allowed.', 'NotAllowedError'))
    const missingFileSentence = describePapelizExportErrorSentence(new DOMException('A requested file could not be found.', 'NotFoundError'))
    expect(permissionSentence).toBe('The browser didn’t let Papeliz finish the export. Try again.')
    expect(missingFileSentence).toBe('A note was moved or deleted while it was exported. Try again.')
    for (const exportFailureSentence of [permissionSentence, missingFileSentence]) {
      expect(exportFailureSentence).not.toMatch(/folder|Recent Vaults/)
    }
  })

  it('keeps a full disk’s sentence and an export’s own reason as they are', () => {
    expect(describePapelizExportErrorSentence(new DOMException('Not enough space.', 'QuotaExceededError'))).toBe('The disk is full. Free some space, then try again.')
    expect(describePapelizExportErrorSentence(new PapelizVaultOperationError('a picture couldn’t be read'))).toBe('a picture couldn’t be read')
  })
})
