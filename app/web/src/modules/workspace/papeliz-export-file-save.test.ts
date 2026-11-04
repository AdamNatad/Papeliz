import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PapelizDesktopPlatform, PapelizDesktopSaveFileRequest } from '../desktop/papeliz-desktop-platform-contract'
import { usePapelizDesktopPlatformStore } from '../desktop/papeliz-desktop-platform-store'
import type { PapelizMobilePlatform, PapelizMobileSaveFileRequest } from '../mobile/papeliz-mobile-platform-contract'
import { PapelizVaultOperationError } from '../vault/papeliz-vault-adapter'
import { buildThenSavePapelizExportFile, describePapelizExportErrorSentence, type PapelizExportFileKind } from './papeliz-export-file-save'

// The phone app's seam, as the web build has it unless a test turns the phone app on.
const testMobileSeam = vi.hoisted(() => ({ isPapelizMobileApp: false, papelizMobilePlatform: null as PapelizMobilePlatform | null }))
vi.mock('virtual:papeliz-mobile-platform-availability', () => ({
  get isPapelizMobileApp() {
    return testMobileSeam.isPapelizMobileApp
  },
}))
vi.mock('virtual:papeliz-mobile-platform', () => ({
  PapelizMobileWorkspaceLayout: null,
  loadPapelizMobilePlatform: async () =>
    testMobileSeam.papelizMobilePlatform === null
      ? { papelizMobilePlatformAvailability: 'not-in-this-build' }
      : { papelizMobilePlatformAvailability: 'in-the-mobile-app', papelizMobilePlatform: testMobileSeam.papelizMobilePlatform },
}))

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

describe('an export in Papeliz for Windows', () => {
  afterEach(() => {
    usePapelizDesktopPlatformStore.setState({ papelizDesktopPlatform: null })
  })

  function setTestDesktopSaveDialog(chosenDesktopFilePath: string | null, desktopWriteFailure: Error | null = null) {
    const desktopSaveSteps: string[] = []
    usePapelizDesktopPlatformStore.setState({
      papelizDesktopPlatform: {
        pickDesktopSaveFilePath: async (desktopSaveFileRequest: PapelizDesktopSaveFileRequest) => {
          desktopSaveSteps.push(`dialog ${desktopSaveFileRequest.suggestedDesktopFileName} ${desktopSaveFileRequest.desktopFileTypeFilters[0]?.desktopFileExtensions.join(',')}`)
          return chosenDesktopFilePath
        },
        desktopFileSystem: {
          writeDesktopFileBytes: async (desktopFilePath: string, desktopFileBytes: Uint8Array) => {
            if (desktopWriteFailure !== null) throw desktopWriteFailure
            desktopSaveSteps.push(`write ${desktopFilePath} ${desktopFileBytes.length}`)
          },
        },
      } as unknown as PapelizDesktopPlatform,
    })
    return desktopSaveSteps
  }

  it('saves through Windows’ Save dialog, once the file is built', async () => {
    const desktopSaveSteps = setTestDesktopSaveDialog('C:\\Users\\Ana\\Notes.pdf')
    const { exportFileSaveOutcome } = await buildThenSavePapelizExportFile('Notes.pdf', testExportFileKind, async () => ({ exportFileBlob: new Blob(['%PDF']) }))
    expect(exportFileSaveOutcome).toBe('saved-to-chosen-file')
    expect(desktopSaveSteps).toEqual(['dialog Notes.pdf pdf', 'write C:\\Users\\Ana\\Notes.pdf 4'])
  })

  it('saves nothing when the dialog is closed, and fails the export when the file can’t be written', async () => {
    setTestDesktopSaveDialog(null)
    expect((await buildThenSavePapelizExportFile('Notes.pdf', testExportFileKind, async () => ({ exportFileBlob: new Blob(['%PDF']) }))).exportFileSaveOutcome).toBe(
      'save-dialog-closed',
    )
    setTestDesktopSaveDialog('C:\\Locked\\Notes.pdf',Object.assign(new Error('Access is denied. (os error 5)'), { desktopFileSystemFailureKind: 'no-permission' }))
    await expect(buildThenSavePapelizExportFile('Notes.pdf', testExportFileKind, async () => ({ exportFileBlob: new Blob(['%PDF']) }))).rejects.toThrow('Access is denied')
  })
})

describe('an export in Papeliz for Android', () => {
  afterEach(() => {
    testMobileSeam.isPapelizMobileApp = false
    testMobileSeam.papelizMobilePlatform = null
  })

  // `saveScreenAnswer` is what the person does in the phone's save screen; `mobileWriteFailure` makes
  // writing the picked file fail.
  function setTestMobileSaveScreen(saveScreenAnswer: 'pick-place' | 'close-screen', mobileWriteFailure: Error | null = null) {
    const mobileSaveSteps: string[] = []
    testMobileSeam.isPapelizMobileApp = true
    testMobileSeam.papelizMobilePlatform = {
      saveFileWithMobileSaveScreen: async (mobileSaveFileRequest: PapelizMobileSaveFileRequest) => {
        mobileSaveSteps.push(`save screen ${mobileSaveFileRequest.suggestedMobileFileName} ${mobileSaveFileRequest.mobileFileMediaType}`)
        if (saveScreenAnswer === 'close-screen') return 'save-screen-closed'
        if (mobileWriteFailure !== null) throw mobileWriteFailure
        mobileSaveSteps.push(`write ${await mobileSaveFileRequest.mobileFileBlob.text()}`)
        return 'saved-to-chosen-file'
      },
    } as unknown as PapelizMobilePlatform
    return mobileSaveSteps
  }

  it('saves through the phone’s save screen once the file is built, never through the web view’s dialog', async () => {
    const { exportSaveSteps } = stubExportSavePage({ saveDialogAnswer: 'close-dialog' })
    const mobileSaveSteps = setTestMobileSaveScreen('pick-place')
    const { exportFileSaveOutcome } = await buildThenSavePapelizExportFile('Notes.pdf', testExportFileKind, async () => {
      mobileSaveSteps.push('built')
      return { exportFileBlob: new Blob(['%PDF']) }
    })
    expect(exportFileSaveOutcome).toBe('saved-to-chosen-file')
    expect(mobileSaveSteps).toEqual(['built', 'save screen Notes.pdf application/pdf', 'write %PDF'])
    expect(exportSaveSteps).toEqual([])
  })

  it('saves and downloads nothing when the save screen is closed, and fails the export when the phone can’t write the file', async () => {
    const { exportSaveSteps } = stubExportSavePage({ saveDialogAnswer: 'choose-file' })
    setTestMobileSaveScreen('close-screen')
    expect((await buildThenSavePapelizExportFile('Notes.pdf', testExportFileKind, async () => ({ exportFileBlob: new Blob(['%PDF']) }))).exportFileSaveOutcome).toBe(
      'save-dialog-closed',
    )
    setTestMobileSaveScreen('pick-place', Object.assign(new Error('Permission denied (os error 13)'), { desktopFileSystemFailureKind: 'no-permission' }))
    await expect(buildThenSavePapelizExportFile('Notes.pdf', testExportFileKind, async () => ({ exportFileBlob: new Blob(['%PDF']) }))).rejects.toThrow('Permission denied')
    expect(exportSaveSteps).toEqual([])
  })

  it('names the phone, and the place picked, when the phone refuses the save', () => {
    testMobileSeam.isPapelizMobileApp = true
    expect(describePapelizExportErrorSentence(Object.assign(new Error('Permission denied (os error 13)'), { desktopFileSystemFailureKind: 'no-permission' }))).toBe(
      'The phone didn’t let Papeliz save there. Pick another place, then try again.',
    )
  })
})
