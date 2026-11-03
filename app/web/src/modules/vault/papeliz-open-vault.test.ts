import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPapelizFakeVaultFolder, PapelizFakeDirectoryHandle, readPapelizFakeVaultFolder } from './papeliz-fake-file-system-access.test-support'
import {
  findPapelizNewFolderVaultNameProblem,
  findPapelizNewVaultFolderNameTaken,
  makeAndOpenNewPapelizFolderVault,
  makePapelizNewFolderVaultFolder,
  papelizFolderWindowShortestHumanCancelMilliseconds,
  pickAndOpenPapelizVaultFolder,
  pickPapelizNewVaultParentFolder,
  pickPlaceAndOpenNewPapelizFolderVault,
  readPapelizNewVaultDefaultParentFolder,
  reopenRememberedPapelizVaultFolder,
} from './papeliz-open-vault'

// What New Vault saves in the vault it makes: the name typed, as the vault's own (papeliz-vault-own-name.ts).
const newFieldNotesVaultOwnNameFiles = {
  'Field Notes/.papeliz/': '',
  'Field Notes/.papeliz/vault-name.json': '{\n  "papelizVaultName": "Field Notes"\n}\n',
}

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
    expect(openVaultResult.openVaultOutcome === 'failed' && openVaultResult.openVaultFailureMessage).toBe(
      'Couldn’t open the folder. Papeliz needs your permission to change this folder. Try again, and allow it when the browser asks.',
    )
  })

  it('says plainly when the browser cannot open folders', async () => {
    stubBrowserWithFolderPicker(undefined)
    const openVaultResult = await pickAndOpenPapelizVaultFolder()
    expect(openVaultResult.openVaultOutcome === 'failed' && openVaultResult.openVaultFailureMessage).toBe('This browser can’t open folders. Open Papeliz in Chrome, Edge or Brave on a computer.')
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
    expect(openVaultResult.openVaultOutcome === 'failed' && openVaultResult.openVaultFailureMessage).toBe(
      'Couldn’t open the folder. Papeliz needs your permission to change this folder. Try again, and allow it when the browser asks.',
    )
  })

  it('explains a folder that has been moved or deleted since', async () => {
    const fakeVaultRootHandle = await createPapelizFakeVaultFolder('Field Notes', {})
    fakeVaultRootHandle.queryPermission = async () => {
      throw new DOMException('The folder is gone.', 'NotFoundError')
    }
    const openVaultResult = await reopenRememberedPapelizVaultFolder(rememberedVaultFolderFor(fakeVaultRootHandle))
    expect(openVaultResult.openVaultOutcome === 'failed' && openVaultResult.openVaultFailureMessage).toBe('Couldn’t open “Field Notes”. The folder was moved, renamed or deleted. Find it on your disk and open it again.')
  })
})

describe('New Vault’s place in a browser, picked before Create Vault', () => {
  it('has no starting place, since a browser reaches no folder until one is picked', async () => {
    expect(await readPapelizNewVaultDefaultParentFolder()).toBeNull()
  })

  it('picks the folder it goes in from the folder window, and makes nothing yet', async () => {
    const pickedPlaceHandle = await createPapelizFakeVaultFolder('Vaults', {})
    stubBrowserWithFolderPicker(async () => pickedPlaceHandle.asFileSystemDirectoryHandle())
    const newVaultParentFolderPickResult = await pickPapelizNewVaultParentFolder()
    expect('newVaultParentFolderPickOutcome' in newVaultParentFolderPickResult && newVaultParentFolderPickResult.pickedNewVaultParentFolder.newVaultParentFolderKind).toBe(
      'browser-folder-handle',
    )
    expect(await readPapelizFakeVaultFolder(pickedPlaceHandle)).toEqual({})
  })

  it('finds the name taken in the folder picked, by the same rule as making it', async () => {
    const pickedPlaceHandle = await createPapelizFakeVaultFolder('Vaults', { 'Field Notes/Inbox.md': '# Inbox', 'Reading List': 'a file', 'Empty/': '' })
    const pickedParentFolder = { newVaultParentFolderKind: 'browser-folder-handle' as const, browserParentFolderHandle: pickedPlaceHandle.asFileSystemDirectoryHandle() }
    expect(await findPapelizNewVaultFolderNameTaken(pickedParentFolder, 'Field Notes')).toBe('folder-not-empty')
    expect(await findPapelizNewVaultFolderNameTaken(pickedParentFolder, 'Reading List')).toBe('file-has-the-name')
    expect(await findPapelizNewVaultFolderNameTaken(pickedParentFolder, 'Empty')).toBeNull()
    expect(await findPapelizNewVaultFolderNameTaken(pickedParentFolder, 'Garden')).toBeNull()
  })

  it('makes the vault’s folder in the folder picked and opens it, with no second folder window', async () => {
    const pickedPlaceHandle = await createPapelizFakeVaultFolder('Vaults', {})
    let folderWindowCount = 0
    stubBrowserWithFolderPicker(async () => {
      folderWindowCount += 1
      return pickedPlaceHandle.asFileSystemDirectoryHandle()
    })
    const openVaultResult = await makeAndOpenNewPapelizFolderVault(
      { newVaultParentFolderKind: 'browser-folder-handle', browserParentFolderHandle: pickedPlaceHandle.asFileSystemDirectoryHandle() },
      'Field Notes',
    )
    expect(openVaultResult.openVaultOutcome === 'opened' && openVaultResult.papelizOpenVault.papelizVaultDisplayName).toBe('Field Notes')
    expect(await readPapelizFakeVaultFolder(pickedPlaceHandle)).toEqual({ 'Field Notes/': '', ...newFieldNotesVaultOwnNameFiles })
    expect(folderWindowCount).toBe(0)
  })
})

describe('making a new vault in a folder', () => {
  it('needs a name that can be a folder’s name', () => {
    expect(findPapelizNewFolderVaultNameProblem('')).toBe('Name Empty')
    expect(findPapelizNewFolderVaultNameProblem('   ')).toBe('Name Empty')
    expect(findPapelizNewFolderVaultNameProblem('.notes')).toBe('Starts With A Dot')
    expect(findPapelizNewFolderVaultNameProblem('Work/Home')).toBe('Has A Blocked Character')
    expect(findPapelizNewFolderVaultNameProblem('Notes.')).toBe('Ends With A Dot')
    expect(findPapelizNewFolderVaultNameProblem('x'.repeat(201))).toBe('Name Too Long')
    expect(findPapelizNewFolderVaultNameProblem('Field Notes')).toBeNull()
  })

  it('makes a folder named after the vault inside the place picked, and opens it', async () => {
    const pickedPlaceHandle = await createPapelizFakeVaultFolder('Documents', { 'Taxes.pdf': 'pdf' })
    stubBrowserWithFolderPicker(async () => pickedPlaceHandle.asFileSystemDirectoryHandle())
    const openVaultResult = await pickPlaceAndOpenNewPapelizFolderVault('Field Notes')
    expect(openVaultResult.openVaultOutcome).toBe('opened')
    if (openVaultResult.openVaultOutcome !== 'opened') return
    expect(openVaultResult.papelizOpenVault.papelizVaultDisplayName).toBe('Field Notes')
    expect(openVaultResult.papelizOpenVault.papelizVaultAdapter.papelizVaultKind).toBe('folder-on-disk')
    expect(await readPapelizFakeVaultFolder(pickedPlaceHandle)).toEqual({ 'Taxes.pdf': 'pdf', 'Field Notes/': '', ...newFieldNotesVaultOwnNameFiles })
  })

  it('uses an empty folder of that name already there', async () => {
    const pickedPlaceHandle = await createPapelizFakeVaultFolder('Documents', { 'Field Notes/': '' })
    const emptyVaultFolderHandle = await pickedPlaceHandle.getDirectoryHandle('Field Notes')
    expect(await makePapelizNewFolderVaultFolder(pickedPlaceHandle.asFileSystemDirectoryHandle(), 'Field Notes')).toEqual({
      newFolderVaultFolderOutcome: 'ready',
      papelizVaultFolderHandle: emptyVaultFolderHandle,
    })
    expect(await readPapelizFakeVaultFolder(pickedPlaceHandle)).toEqual({ 'Field Notes/': '' })
  })

  it('refuses a folder of that name with something in it, and leaves it as it was', async () => {
    const pickedPlaceHandle = await createPapelizFakeVaultFolder('Documents', { 'Field Notes/Inbox.md': '# Inbox' })
    stubBrowserWithFolderPicker(async () => pickedPlaceHandle.asFileSystemDirectoryHandle())
    expect(await pickPlaceAndOpenNewPapelizFolderVault('Field Notes')).toEqual({
      openVaultOutcome: 'failed',
      openVaultFailureMessage: 'A folder named “Field Notes” is already there. Pick another name or another place.',
    })
    expect(await readPapelizFakeVaultFolder(pickedPlaceHandle)).toEqual({ 'Field Notes/': '', 'Field Notes/Inbox.md': '# Inbox' })
  })

  it('refuses a file of that name', async () => {
    const pickedPlaceHandle = await createPapelizFakeVaultFolder('Documents', { 'Field Notes': 'a file' })
    stubBrowserWithFolderPicker(async () => pickedPlaceHandle.asFileSystemDirectoryHandle())
    expect(await pickPlaceAndOpenNewPapelizFolderVault('Field Notes')).toEqual({
      openVaultOutcome: 'failed',
      openVaultFailureMessage: 'A file named “Field Notes” is already there. Pick another name or another place.',
    })
  })

  it('makes nothing when the folder window is closed', async () => {
    let performanceNowMilliseconds = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => performanceNowMilliseconds)
    stubBrowserWithFolderPicker(async () => {
      performanceNowMilliseconds += papelizFolderWindowShortestHumanCancelMilliseconds + 900
      throw new DOMException('The user aborted a request.', 'AbortError')
    })
    expect(await pickPlaceAndOpenNewPapelizFolderVault('Field Notes')).toEqual({ openVaultOutcome: 'cancelled' })
    vi.restoreAllMocks()
  })
})
