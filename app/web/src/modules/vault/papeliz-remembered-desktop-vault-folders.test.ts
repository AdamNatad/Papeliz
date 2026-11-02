import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { papelizVaultFolderHandlesStoreName } from '../browser-database/papeliz-browser-database'
import type { PapelizDesktopPlatform } from '../desktop/papeliz-desktop-platform-contract'
import { usePapelizDesktopPlatformStore } from '../desktop/papeliz-desktop-platform-store'
import { PapelizFakeDesktopFileSystem } from './papeliz-fake-desktop-file-system.test-support'
import { createPapelizFakeVaultFolder } from './papeliz-fake-file-system-access.test-support'
import {
  findPapelizNewFolderVaultNameProblem,
  makePapelizNewDesktopFolderVaultFolder,
  papelizNewVaultDesktopFolderPickerTitle,
  papelizOpenVaultDesktopFolderPickerTitle,
  pickAndOpenPapelizVaultFolder,
  pickPlaceAndOpenNewPapelizFolderVault,
} from './papeliz-open-vault'
import {
  deletePapelizRecentVault,
  isPapelizRecentVaultHidden,
  listPapelizRecentVaults,
  reopenPapelizRecentVault,
  setPapelizRecentVaultHidden,
  type PapelizStartScreenRecentVault,
} from './papeliz-recent-vaults'
import { forgetRememberedVaultFolder, readDesktopVaultFolderName } from './papeliz-remembered-vault-folders'

// Recent Vaults in Papeliz for Windows: folders picked in Windows' own folder picker, opened and
// remembered by path, against a fake native side; and what a browser keeps seeing.

// The browser's IndexedDB, as plain maps: one per store, every row keyed by its vault id.
const testBrowserDatabaseStores = vi.hoisted(() => new Map<string, Map<string, Record<string, unknown>>>())
vi.mock('../browser-database/papeliz-browser-database', async (importOriginal) => {
  const originalBrowserDatabaseModule = await importOriginal<typeof import('../browser-database/papeliz-browser-database')>()
  const readTestStore = (objectStoreName: string) => {
    if (!testBrowserDatabaseStores.has(objectStoreName)) testBrowserDatabaseStores.set(objectStoreName, new Map())
    return testBrowserDatabaseStores.get(objectStoreName)!
  }
  return {
    ...originalBrowserDatabaseModule,
    isPapelizBrowserDatabaseAvailable: () => true,
    readPapelizBrowserDatabaseRecord: async (objectStoreName: string, storedRecordKey: string) => {
      const storedRecord = readTestStore(objectStoreName).get(storedRecordKey)
      return storedRecord === undefined ? undefined : { ...storedRecord }
    },
    readAllPapelizBrowserDatabaseRecords: async (objectStoreName: string) => [...readTestStore(objectStoreName).values()].map((storedRecord) => ({ ...storedRecord })),
    putPapelizBrowserDatabaseRecord: async (objectStoreName: string, storedRecord: Record<string, unknown>) => {
      readTestStore(objectStoreName).set(String(storedRecord.papelizVaultId), { ...storedRecord })
    },
    deletePapelizBrowserDatabaseRecord: async (objectStoreName: string, storedRecordKey: string) => {
      readTestStore(objectStoreName).delete(storedRecordKey)
    },
  }
})

const desktopTestHomeFolderPath = 'C:\\Users\\Ada'
const desktopTestVaultFolderPath = 'C:\\Users\\Ada\\Field Notes'
const desktopTestPlaceFolderPath = 'C:\\Users\\Ada\\Documents'
const movedDesktopTestVaultFailureMessage = 'Couldn’t open “Field Notes”. The folder was moved, renamed or deleted. Find it on your disk and open it again.'

// The desktop app's native side, as far as Recent Vaults reaches it: the files under the home folder
// (picked earlier, so every call there works), the folder picker, which gives back what the test
// says it picks and keeps each title it was shown, and the call that lets a folder go.
function createTestDesktopPlatform() {
  const fakeDesktopFileSystem = new PapelizFakeDesktopFileSystem([desktopTestHomeFolderPath])
  fakeDesktopFileSystem.addFakeDesktopFiles(desktopTestHomeFolderPath, {})
  const testDesktopPlatform = {
    fakeDesktopFileSystem,
    nextPickedDesktopFolderPath: null as string | null,
    shownDesktopFolderPickerTitles: [] as string[],
    forgottenDesktopVaultFolderPaths: [] as string[],
    nativelyRememberedDesktopVaultFolderPaths: [] as string[],
  }
  const papelizDesktopPlatform: Pick<
    PapelizDesktopPlatform,
    'desktopFileSystem' | 'pickDesktopFolderPath' | 'rememberDesktopVaultFolderPath' | 'forgetDesktopVaultFolderPath'
  > = {
    desktopFileSystem: fakeDesktopFileSystem,
    pickDesktopFolderPath: async (desktopFolderPickerTitle) => {
      testDesktopPlatform.shownDesktopFolderPickerTitles.push(desktopFolderPickerTitle)
      return testDesktopPlatform.nextPickedDesktopFolderPath
    },
    rememberDesktopVaultFolderPath: async (desktopVaultFolderPath) => {
      testDesktopPlatform.nativelyRememberedDesktopVaultFolderPaths.push(desktopVaultFolderPath)
    },
    forgetDesktopVaultFolderPath: async (desktopVaultFolderPath) => {
      testDesktopPlatform.forgottenDesktopVaultFolderPaths.push(desktopVaultFolderPath)
    },
  }
  usePapelizDesktopPlatformStore.setState({ papelizDesktopPlatform: papelizDesktopPlatform as PapelizDesktopPlatform })
  return testDesktopPlatform
}

// Open Vault on the test vault folder, which holds one note.
async function openDesktopTestVaultFolder(testDesktopPlatform: ReturnType<typeof createTestDesktopPlatform>) {
  testDesktopPlatform.fakeDesktopFileSystem.addFakeDesktopFiles(desktopTestVaultFolderPath, { 'Inbox.md': '# Inbox' })
  testDesktopPlatform.nextPickedDesktopFolderPath = desktopTestVaultFolderPath
  const openVaultResult = await pickAndOpenPapelizVaultFolder()
  if (openVaultResult.openVaultOutcome !== 'opened') throw new Error(`The test vault folder didn’t open: ${openVaultResult.openVaultOutcome}`)
  return openVaultResult.papelizOpenVault
}

async function readOnlyRecentVault(): Promise<PapelizStartScreenRecentVault> {
  const recentVaults = await listPapelizRecentVaults(false)
  expect(recentVaults).toHaveLength(1)
  return recentVaults[0]!
}

beforeEach(() => {
  testBrowserDatabaseStores.clear()
})

afterEach(() => {
  usePapelizDesktopPlatformStore.setState({ papelizDesktopPlatform: null })
})

describe('a folder opened in Papeliz for Windows', () => {
  it('opens from Windows’ folder picker by its path, named after its last segment, and joins Recent Vaults', async () => {
    const testDesktopPlatform = createTestDesktopPlatform()
    const papelizOpenVault = await openDesktopTestVaultFolder(testDesktopPlatform)
    expect(testDesktopPlatform.shownDesktopFolderPickerTitles).toEqual([papelizOpenVaultDesktopFolderPickerTitle])
    expect(testDesktopPlatform.nativelyRememberedDesktopVaultFolderPaths).toEqual([desktopTestVaultFolderPath])
    expect(papelizOpenVault.papelizVaultDisplayName).toBe('Field Notes')
    expect(papelizOpenVault.papelizVaultAdapter.papelizVaultKind).toBe('folder-on-disk')
    expect(await papelizOpenVault.papelizVaultAdapter.readVaultNoteText('Inbox.md')).toBe('# Inbox')
    expect(await readOnlyRecentVault()).toMatchObject({
      papelizRecentVaultKind: 'desktop-folder-on-disk',
      papelizRememberedVaultFolderKind: 'desktop-folder-path',
      papelizVaultId: papelizOpenVault.papelizVaultId,
      papelizVaultDisplayName: 'Field Notes',
      desktopVaultFolderPath: desktopTestVaultFolderPath,
      papelizVaultHiddenAt: null,
    })
  })

  it('stays one row with one vault id when opened again, however its path is written', async () => {
    const testDesktopPlatform = createTestDesktopPlatform()
    const firstOpenVault = await openDesktopTestVaultFolder(testDesktopPlatform)
    testDesktopPlatform.nextPickedDesktopFolderPath = 'c:/users/ada/field notes/'
    const secondOpenVaultResult = await pickAndOpenPapelizVaultFolder()
    expect(secondOpenVaultResult.openVaultOutcome === 'opened' && secondOpenVaultResult.papelizOpenVault.papelizVaultId).toBe(firstOpenVault.papelizVaultId)
    expect((await readOnlyRecentVault()).papelizVaultId).toBe(firstOpenVault.papelizVaultId)
  })

  it('opens and remembers nothing when the folder picker is closed', async () => {
    createTestDesktopPlatform()
    expect(await pickAndOpenPapelizVaultFolder()).toEqual({ openVaultOutcome: 'cancelled' })
    expect(await listPapelizRecentVaults(false)).toEqual([])
  })

  it('reopens from Recent Vaults by its path, with no picker and no permission to ask for', async () => {
    const testDesktopPlatform = createTestDesktopPlatform()
    const papelizOpenVault = await openDesktopTestVaultFolder(testDesktopPlatform)
    const reopenVaultResult = await reopenPapelizRecentVault(await readOnlyRecentVault())
    expect(reopenVaultResult.openVaultOutcome).toBe('opened')
    // Already remembered when it was picked; reopening asks the native side for nothing more.
    expect(testDesktopPlatform.nativelyRememberedDesktopVaultFolderPaths).toEqual([desktopTestVaultFolderPath])
    if (reopenVaultResult.openVaultOutcome !== 'opened') return
    expect(reopenVaultResult.papelizOpenVault.papelizVaultId).toBe(papelizOpenVault.papelizVaultId)
    expect(await reopenVaultResult.papelizOpenVault.papelizVaultAdapter.readVaultNoteText('Inbox.md')).toBe('# Inbox')
    expect(testDesktopPlatform.shownDesktopFolderPickerTitles).toHaveLength(1)
  })

  it('fails to reopen as a moved folder does once nothing is at its path, or a file is, and stays on the list', async () => {
    const testDesktopPlatform = createTestDesktopPlatform()
    await openDesktopTestVaultFolder(testDesktopPlatform)
    const rememberedRecentVault = await readOnlyRecentVault()
    await testDesktopPlatform.fakeDesktopFileSystem.removeDesktopEntry(desktopTestVaultFolderPath)
    expect(await reopenPapelizRecentVault(rememberedRecentVault)).toEqual({ openVaultOutcome: 'failed', openVaultFailureMessage: movedDesktopTestVaultFailureMessage })
    testDesktopPlatform.fakeDesktopFileSystem.addFakeDesktopFiles(desktopTestHomeFolderPath, { 'Field Notes': 'a file now' })
    expect(await reopenPapelizRecentVault(rememberedRecentVault)).toEqual({ openVaultOutcome: 'failed', openVaultFailureMessage: movedDesktopTestVaultFailureMessage })
    expect((await readOnlyRecentVault()).papelizVaultId).toBe(rememberedRecentVault.papelizVaultId)
  })

  it('hides into the Hidden list and comes back, keeping its path', async () => {
    const testDesktopPlatform = createTestDesktopPlatform()
    await openDesktopTestVaultFolder(testDesktopPlatform)
    await setPapelizRecentVaultHidden(await readOnlyRecentVault(), true)
    const hiddenRecentVault = await readOnlyRecentVault()
    expect(isPapelizRecentVaultHidden(hiddenRecentVault)).toBe(true)
    expect(hiddenRecentVault).toMatchObject({ papelizRecentVaultKind: 'desktop-folder-on-disk', desktopVaultFolderPath: desktopTestVaultFolderPath })
    await setPapelizRecentVaultHidden(hiddenRecentVault, false)
    expect(isPapelizRecentVaultHidden(await readOnlyRecentVault())).toBe(false)
  })

  it('is let go on the native side too when forgotten, and the folder stays on the disk', async () => {
    const testDesktopPlatform = createTestDesktopPlatform()
    const papelizOpenVault = await openDesktopTestVaultFolder(testDesktopPlatform)
    await forgetRememberedVaultFolder(papelizOpenVault.papelizVaultId)
    expect(await listPapelizRecentVaults(false)).toEqual([])
    expect(testDesktopPlatform.forgottenDesktopVaultFolderPaths).toEqual([desktopTestVaultFolderPath])
    expect(testDesktopPlatform.fakeDesktopFileSystem.readFakeDesktopFolder(desktopTestVaultFolderPath)).toEqual({ 'Inbox.md': '# Inbox' })
  })

  it('is erased from the disk by Delete in the Hidden list, through the native side, then forgotten', async () => {
    const testDesktopPlatform = createTestDesktopPlatform()
    await openDesktopTestVaultFolder(testDesktopPlatform)
    expect(await deletePapelizRecentVault(await readOnlyRecentVault())).toEqual({ recentVaultDeleteOutcome: 'deleted' })
    expect(await testDesktopPlatform.fakeDesktopFileSystem.readDesktopEntry(desktopTestVaultFolderPath)).toBeNull()
    expect(testDesktopPlatform.fakeDesktopFileSystem.fakeDesktopCalls).toContainEqual({ desktopCallName: 'removeDesktopEntry', desktopCallPaths: [desktopTestVaultFolderPath] })
    expect(testDesktopPlatform.forgottenDesktopVaultFolderPaths).toEqual([desktopTestVaultFolderPath])
    expect(await listPapelizRecentVaults(false)).toEqual([])
  })

  it('only leaves the list on Delete when the folder is already gone from the disk', async () => {
    const testDesktopPlatform = createTestDesktopPlatform()
    await openDesktopTestVaultFolder(testDesktopPlatform)
    await testDesktopPlatform.fakeDesktopFileSystem.removeDesktopEntry(desktopTestVaultFolderPath)
    testDesktopPlatform.fakeDesktopFileSystem.fakeDesktopCalls.length = 0
    expect(await deletePapelizRecentVault(await readOnlyRecentVault())).toEqual({ recentVaultDeleteOutcome: 'deleted' })
    expect(testDesktopPlatform.fakeDesktopFileSystem.fakeDesktopCalls.map((fakeDesktopCall) => fakeDesktopCall.desktopCallName)).not.toContain('removeDesktopEntry')
    expect(await listPapelizRecentVaults(false)).toEqual([])
  })

  it('takes its name from the path’s last segment, as a folder handle’s name', () => {
    expect(readDesktopVaultFolderName('C:\\Users\\Ada\\Field Notes')).toBe('Field Notes')
    expect(readDesktopVaultFolderName('C:\\Users\\Ada\\Field Notes\\')).toBe('Field Notes')
    expect(readDesktopVaultFolderName('D:\\')).toBe('D:')
  })
})

describe('making a new vault in a folder in Papeliz for Windows', () => {
  it('makes a folder named after the vault in the place picked, then opens and remembers it', async () => {
    const testDesktopPlatform = createTestDesktopPlatform()
    testDesktopPlatform.fakeDesktopFileSystem.addFakeDesktopFiles(desktopTestPlaceFolderPath, { 'Taxes.pdf': 'pdf' })
    testDesktopPlatform.nextPickedDesktopFolderPath = desktopTestPlaceFolderPath
    const openVaultResult = await pickPlaceAndOpenNewPapelizFolderVault('Field Notes')
    expect(testDesktopPlatform.shownDesktopFolderPickerTitles).toEqual([papelizNewVaultDesktopFolderPickerTitle])
    expect(openVaultResult.openVaultOutcome === 'opened' && openVaultResult.papelizOpenVault.papelizVaultDisplayName).toBe('Field Notes')
    expect(testDesktopPlatform.fakeDesktopFileSystem.readFakeDesktopFolder(desktopTestPlaceFolderPath)).toEqual({ 'Taxes.pdf': 'pdf', 'Field Notes/': '' })
    expect(await readOnlyRecentVault()).toMatchObject({ papelizVaultDisplayName: 'Field Notes', desktopVaultFolderPath: `${desktopTestPlaceFolderPath}\\Field Notes` })
    // The vault's own folder is remembered on the native side, never the place picked for it.
    expect(testDesktopPlatform.nativelyRememberedDesktopVaultFolderPaths).toEqual([`${desktopTestPlaceFolderPath}\\Field Notes`])
  })

  it('checks the name as the browser does', () => {
    expect(findPapelizNewFolderVaultNameProblem('Work/Home')).toBe('Has A Blocked Character')
    expect(findPapelizNewFolderVaultNameProblem('Notes.')).toBe('Ends With A Dot')
    expect(findPapelizNewFolderVaultNameProblem('Field Notes')).toBeNull()
  })

  it('uses an empty folder of that name already there', async () => {
    const testDesktopPlatform = createTestDesktopPlatform()
    testDesktopPlatform.fakeDesktopFileSystem.addFakeDesktopFiles(desktopTestPlaceFolderPath, { 'Field Notes/': '' })
    testDesktopPlatform.fakeDesktopFileSystem.fakeDesktopCalls.length = 0
    expect(await makePapelizNewDesktopFolderVaultFolder(desktopTestPlaceFolderPath, 'Field Notes', testDesktopPlatform.fakeDesktopFileSystem)).toEqual({
      newFolderVaultFolderOutcome: 'ready',
      desktopVaultFolderPath: `${desktopTestPlaceFolderPath}\\Field Notes`,
    })
    expect(testDesktopPlatform.fakeDesktopFileSystem.fakeDesktopCalls.map((fakeDesktopCall) => fakeDesktopCall.desktopCallName)).not.toContain('makeDesktopFolder')
  })

  it('refuses a folder of that name with something in it, and a file of that name, leaving both and remembering nothing', async () => {
    const testDesktopPlatform = createTestDesktopPlatform()
    testDesktopPlatform.fakeDesktopFileSystem.addFakeDesktopFiles(desktopTestPlaceFolderPath, { 'Field Notes/Inbox.md': '# Inbox', 'Reading List': 'a file' })
    testDesktopPlatform.nextPickedDesktopFolderPath = desktopTestPlaceFolderPath
    expect(await pickPlaceAndOpenNewPapelizFolderVault('Field Notes')).toEqual({
      openVaultOutcome: 'failed',
      openVaultFailureMessage: 'A folder named “Field Notes” is already there. Pick another name or another place.',
    })
    expect(await pickPlaceAndOpenNewPapelizFolderVault('Reading List')).toEqual({
      openVaultOutcome: 'failed',
      openVaultFailureMessage: 'A file named “Reading List” is already there. Pick another name or another place.',
    })
    expect(testDesktopPlatform.fakeDesktopFileSystem.readFakeDesktopFolder(desktopTestPlaceFolderPath)).toEqual({
      'Field Notes/': '',
      'Field Notes/Inbox.md': '# Inbox',
      'Reading List': 'a file',
    })
    expect(await listPapelizRecentVaults(false)).toEqual([])
  })

  it('makes nothing when the folder picker is closed', async () => {
    const testDesktopPlatform = createTestDesktopPlatform()
    testDesktopPlatform.fakeDesktopFileSystem.addFakeDesktopFiles(desktopTestPlaceFolderPath, {})
    expect(await pickPlaceAndOpenNewPapelizFolderVault('Field Notes')).toEqual({ openVaultOutcome: 'cancelled' })
    expect(testDesktopPlatform.fakeDesktopFileSystem.readFakeDesktopFolder(desktopTestPlaceFolderPath)).toEqual({})
  })
})

describe('remembered folders in a browser', () => {
  async function storeOldHandleRow() {
    const oldVaultFolderHandle = (await createPapelizFakeVaultFolder('Old Notes', {})).asFileSystemDirectoryHandle()
    // As an older Papeliz saved it: no kind, a handle.
    testBrowserDatabaseStores.set(
      papelizVaultFolderHandlesStoreName,
      new Map([['old-vault-id', { papelizVaultId: 'old-vault-id', papelizVaultDisplayName: 'Old Notes', papelizVaultFolderHandle: oldVaultFolderHandle, papelizVaultLastOpenedAt: 1 }]]),
    )
    return oldVaultFolderHandle
  }

  it('reads a row saved before folders were kept by path as a folder handle, in either app', async () => {
    const oldVaultFolderHandle = await storeOldHandleRow()
    expect(await listPapelizRecentVaults(false)).toEqual([
      expect.objectContaining({ papelizRecentVaultKind: 'folder-on-disk', papelizVaultId: 'old-vault-id', papelizVaultFolderHandle: oldVaultFolderHandle }),
    ])
    createTestDesktopPlatform()
    expect((await readOnlyRecentVault()).papelizRecentVaultKind).toBe('folder-on-disk')
  })

  it('never lists a folder by path, which only Papeliz for Windows can open', async () => {
    createTestDesktopPlatform()
    await storeOldHandleRow()
    testBrowserDatabaseStores.get(papelizVaultFolderHandlesStoreName)!.set('desktop-vault-id', {
      papelizRememberedVaultFolderKind: 'desktop-folder-path',
      papelizVaultId: 'desktop-vault-id',
      papelizVaultDisplayName: 'Field Notes',
      desktopVaultFolderPath: desktopTestVaultFolderPath,
      papelizVaultLastOpenedAt: 2,
    })
    expect((await listPapelizRecentVaults(false)).map((recentVault) => recentVault.papelizRecentVaultKind)).toEqual(['desktop-folder-on-disk', 'folder-on-disk'])
    usePapelizDesktopPlatformStore.setState({ papelizDesktopPlatform: null })
    expect((await listPapelizRecentVaults(false)).map((recentVault) => recentVault.papelizVaultId)).toEqual(['old-vault-id'])
  })
})
