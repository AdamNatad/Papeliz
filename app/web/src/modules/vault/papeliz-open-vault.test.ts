import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPapelizFakeVaultFolder, PapelizFakeDirectoryHandle } from './papeliz-fake-file-system-access.test-support'
import { papelizFolderWindowShortestHumanCancelMilliseconds, pickAndOpenPapelizVaultFolder, reopenRememberedPapelizVaultFolder } from './papeliz-open-vault'

function stubBrowserWithFolderPicker(showDirectoryPicker: (() => Promise<FileSystemDirectoryHandle>) | undefined) {
  vi.stubGlobal('window', { isSecureContext: true, showDirectoryPicker })
}

function rememberedVaultFolderFor(fakeVaultRootHandle: PapelizFakeDirectoryHandle) {
  return {
    papelizVaultId: 'remembered-vault-id',
    papelizVaultDisplayName: fakeVaultRootHandle.name,
    papelizVaultFolderHandle: fakeVaultRootHandle.asFileSystemDirectoryHandle(),
    papelizVaultLastOpenedAt: 0,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('opening a folder', () => {
  it('opens the picked folder as a vault on disk', async () => {
    const fakeVaultRootHandle = await createPapelizFakeVaultFolder('Field Notes', { 'Inbox.md': '# Inbox' })
    stubBrowserWithFolderPicker(async () => fakeVaultRootHandle.asFileSystemDirectoryHandle())
    const openVaultResult = await pickAndOpenPapelizVaultFolder()
    expect(openVaultResult.openVaultOutcome).toBe('opened')
    if (openVaultResult.openVaultOutcome !== 'opened') return
    expect(openVaultResult.papelizOpenVault.papelizVaultDisplayName).toBe('Field Notes')
    expect(openVaultResult.papelizOpenVault.papelizVaultAdapter.papelizVaultKind).toBe('folder-on-disk')
    expect(await openVaultResult.papelizOpenVault.papelizVaultAdapter.readVaultNoteText('Inbox.md')).toBe('# Inbox')
    expect(fakeVaultRootHandle.requestPermissionCallCount).toBe(0)
  })

  it('reports a folder window closed by hand as cancelled', async () => {
    let performanceNowMilliseconds = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => performanceNowMilliseconds)
    stubBrowserWithFolderPicker(async () => {
      performanceNowMilliseconds += papelizFolderWindowShortestHumanCancelMilliseconds + 900
      throw new DOMException('The user aborted a request.', 'AbortError')
    })
    expect(await pickAndOpenPapelizVaultFolder()).toEqual({ openVaultOutcome: 'cancelled' })
    vi.restoreAllMocks()
  })

  it('reports a folder window that aborted at once, unseen, as one that won’t open here', async () => {
    let performanceNowMilliseconds = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => performanceNowMilliseconds)
    stubBrowserWithFolderPicker(async () => {
      performanceNowMilliseconds += 38
      throw new DOMException('The user aborted a request.', 'AbortError')
    })
    expect(await pickAndOpenPapelizVaultFolder()).toEqual({ openVaultOutcome: 'chooser-unavailable' })
    vi.restoreAllMocks()
  })

  it('reports a folder window that would not open, so the page can turn opening a folder off', async () => {
    stubBrowserWithFolderPicker(async () => {
      throw new DOMException('Not allowed here.', 'SecurityError')
    })
    expect(await pickAndOpenPapelizVaultFolder()).toEqual({ openVaultOutcome: 'chooser-unavailable' })
  })

  it('explains a refused permission', async () => {
    stubBrowserWithFolderPicker(async () => {
      throw new DOMException('Permission denied.', 'NotAllowedError')
    })
    const openVaultResult = await pickAndOpenPapelizVaultFolder()
    expect(openVaultResult.openVaultOutcome === 'failed' && openVaultResult.openVaultFailureMessage).toBe('Couldn’t open the folder (No Permission)')
  })

  it('says plainly when the browser cannot open folders', async () => {
    stubBrowserWithFolderPicker(undefined)
    const openVaultResult = await pickAndOpenPapelizVaultFolder()
    expect(openVaultResult.openVaultOutcome === 'failed' && openVaultResult.openVaultFailureMessage).toBe('Couldn’t open folders (Use Chrome, Edge Or Brave)')
  })
})

describe('reopening a recent folder', () => {
  it('asks for permission again when the browser no longer has it', async () => {
    const fakeVaultRootHandle = await createPapelizFakeVaultFolder('Field Notes', { 'Inbox.md': '# Inbox' })
    fakeVaultRootHandle.fakePermissionStates = { queryPermissionState: 'prompt', requestPermissionState: 'granted' }
    stubBrowserWithFolderPicker(undefined)
    const openVaultResult = await reopenRememberedPapelizVaultFolder(rememberedVaultFolderFor(fakeVaultRootHandle))
    expect(fakeVaultRootHandle.requestPermissionCallCount).toBe(1)
    expect(openVaultResult.openVaultOutcome).toBe('opened')
  })

  it('does not open the folder when permission is refused', async () => {
    const fakeVaultRootHandle = await createPapelizFakeVaultFolder('Field Notes', {})
    fakeVaultRootHandle.fakePermissionStates = { queryPermissionState: 'prompt', requestPermissionState: 'denied' }
    const openVaultResult = await reopenRememberedPapelizVaultFolder(rememberedVaultFolderFor(fakeVaultRootHandle))
    expect(openVaultResult.openVaultOutcome === 'failed' && openVaultResult.openVaultFailureMessage).toBe('Couldn’t open the folder (No Permission)')
  })

  it('explains a folder that has been moved or deleted since', async () => {
    const fakeVaultRootHandle = await createPapelizFakeVaultFolder('Field Notes', {})
    fakeVaultRootHandle.queryPermission = async () => {
      throw new DOMException('The folder is gone.', 'NotFoundError')
    }
    const openVaultResult = await reopenRememberedPapelizVaultFolder(rememberedVaultFolderFor(fakeVaultRootHandle))
    expect(openVaultResult.openVaultOutcome === 'failed' && openVaultResult.openVaultFailureMessage).toBe('Couldn’t open “Field Notes” (Folder Not Found)')
  })
})
