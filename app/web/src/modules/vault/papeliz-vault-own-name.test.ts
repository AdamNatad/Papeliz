import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PapelizDesktopPlatform } from '../desktop/papeliz-desktop-platform-contract'
import { usePapelizDesktopPlatformStore } from '../desktop/papeliz-desktop-platform-store'
import { createPapelizBrowserVault, openPapelizBrowserVault } from './papeliz-browser-vaults'
import { createPapelizFakeBrowserVaultEnvironment } from './papeliz-fake-browser-vault-environment.test-support'
import { PapelizFakeDesktopFileSystem } from './papeliz-fake-desktop-file-system.test-support'
import {
  createPapelizFakeVaultFolder,
  readPapelizFakeVaultFolder,
  type PapelizFakeDirectoryHandle,
  type PapelizFakeFileHandle,
} from './papeliz-fake-file-system-access.test-support'
import {
  makeAndOpenNewPapelizFolderVault,
  openPapelizDesktopVaultFolderPath,
  openPapelizVaultFolderHandle,
  renameOpenPapelizFolderVault,
  type PapelizOpenVault,
} from './papeliz-open-vault'
import { listPapelizRecentVaults, reopenPapelizRecentVault, type PapelizStartScreenRecentVault } from './papeliz-recent-vaults'
import { describePapelizVaultError } from './papeliz-vault-adapter'
import {
  changePapelizVaultToEndToEnd,
  changePapelizVaultToStandard,
  findPapelizLockedEndToEndVault,
  isPapelizEndToEndVaultAdapter,
  makePapelizEndToEndVault,
  unlockPapelizEndToEndVault,
  type PapelizLockedEndToEndVault,
} from './papeliz-vault-encryption'
import {
  usePapelizVaultEncryptionDeviceStoreForTests,
  type PapelizRecentVaultEncryptionKindRecord,
  type PapelizRememberedVaultEncryptionKeyRecord,
} from './papeliz-vault-encryption-device-store'
import { usePapelizVaultArgon2idSettingsForTests } from './papeliz-vault-encryption-passphrase-key'
import { findPapelizVaultOwnNameProblem, readPapelizVaultOwnName, writePapelizVaultOwnName } from './papeliz-vault-own-name'

// A folder vault's own name, kept in the vault: plain in a Standard vault's `.papeliz/vault-name.json`,
// sealed with an End-to-end vault's files and read once it is unlocked, and the folder's name when none
// is saved. Recent Vaults keeps the name each vault last showed; a browser vault keeps its own as before.

// The browser's IndexedDB, as plain maps: one per store, every row keyed by its vault id. Clearing it is
// a device that has never opened the vault.
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

const testVaultPassphrase = 'correct horse battery staple'
const vaultOwnNameSettingsFileRelativePath = '.papeliz/vault-name.json'

function describeVaultOwnNameSettingsFileText(papelizVaultOwnName: string): string {
  return `{\n  "papelizVaultName": "${papelizVaultOwnName}"\n}\n`
}

// This device's remembered End-to-end keys and the kind each vault last had, kept apart from the
// remembered folders so a test can be a second device for one and not the other.
function useTestVaultEncryptionDeviceStore() {
  const rememberedKeyRecords = new Map<string, PapelizRememberedVaultEncryptionKeyRecord>()
  const recentKindRecords = new Map<string, PapelizRecentVaultEncryptionKindRecord>()
  usePapelizVaultEncryptionDeviceStoreForTests(
    {
      readRememberedVaultEncryptionKeyRecord: async (papelizEncryptedVaultId) => rememberedKeyRecords.get(papelizEncryptedVaultId),
      putRememberedVaultEncryptionKeyRecord: async (rememberedKeyRecord) => void rememberedKeyRecords.set(rememberedKeyRecord.papelizEncryptedVaultId, rememberedKeyRecord),
      deleteRememberedVaultEncryptionKeyRecord: async (papelizEncryptedVaultId) => void rememberedKeyRecords.delete(papelizEncryptedVaultId),
      readAllRecentVaultEncryptionKindRecords: async () => [...recentKindRecords.values()],
      putRecentVaultEncryptionKindRecord: async (recentKindRecord) => void recentKindRecords.set(recentKindRecord.papelizVaultId, recentKindRecord),
    },
    null,
  )
}

beforeEach(() => {
  testBrowserDatabaseStores.clear()
  usePapelizVaultArgon2idSettingsForTests({ argon2idMemoryKibibytes: 64, argon2idPassCount: 1, argon2idParallelism: 1 })
  useTestVaultEncryptionDeviceStore()
})

afterEach(() => {
  usePapelizVaultArgon2idSettingsForTests(null)
  usePapelizVaultEncryptionDeviceStoreForTests(null)
  usePapelizDesktopPlatformStore.setState({ papelizDesktopPlatform: null })
})

async function openTestVaultFolder(fakeVaultRootHandle: PapelizFakeDirectoryHandle): Promise<PapelizOpenVault> {
  const openVaultResult = await openPapelizVaultFolderHandle(fakeVaultRootHandle.asFileSystemDirectoryHandle())
  if (openVaultResult.openVaultOutcome !== 'opened') throw new Error(`The test folder didn’t open: ${JSON.stringify(openVaultResult)}`)
  return openVaultResult.papelizOpenVault
}

async function readOnlyRecentVault(): Promise<PapelizStartScreenRecentVault> {
  const recentVaults = await listPapelizRecentVaults(false)
  expect(recentVaults).toHaveLength(1)
  return recentVaults[0]!
}

// A folder opened again, as Recent Vaults or Open Vault does: locked when it is End-to-end.
async function findTestVaultFolderLocked(fakeVaultRootHandle: PapelizFakeDirectoryHandle): Promise<PapelizLockedEndToEndVault> {
  const existingVaultOpenResult = await findPapelizLockedEndToEndVault(await openPapelizVaultFolderHandle(fakeVaultRootHandle.asFileSystemDirectoryHandle()))
  if (existingVaultOpenResult.openVaultOutcome !== 'needs-unlock') throw new Error(`The test folder isn’t locked: ${existingVaultOpenResult.openVaultOutcome}`)
  return existingVaultOpenResult.papelizLockedEndToEndVault
}

async function writeTestVaultSettingsFile(vaultSettingsFileHandle: PapelizFakeFileHandle, vaultSettingsFileText: string): Promise<void> {
  const vaultSettingsFileWritable = await vaultSettingsFileHandle.createWritable()
  await vaultSettingsFileWritable.write(vaultSettingsFileText)
  await vaultSettingsFileWritable.close()
}

async function unlockTestVault(lockedEndToEndVault: PapelizLockedEndToEndVault): Promise<PapelizOpenVault> {
  const endToEndVaultUnlockResult = await unlockPapelizEndToEndVault(lockedEndToEndVault, { vaultPassphrase: testVaultPassphrase, isVaultKeyRememberedOnThisDevice: false })
  if (endToEndVaultUnlockResult.endToEndVaultUnlockOutcome !== 'unlocked') throw new Error(`The test vault didn’t unlock: ${JSON.stringify(endToEndVaultUnlockResult)}`)
  return endToEndVaultUnlockResult.papelizOpenVault
}

describe('a folder vault’s own name, in a Standard vault', () => {
  it('is the folder’s name while none is saved', async () => {
    const fakeVaultRootHandle = await createPapelizFakeVaultFolder('Field Notes', { 'Inbox.md': '# Inbox' })
    const papelizOpenVault = await openTestVaultFolder(fakeVaultRootHandle)
    expect(papelizOpenVault.papelizVaultDisplayName).toBe('Field Notes')
    expect(await readPapelizVaultOwnName(papelizOpenVault.papelizVaultAdapter)).toBeNull()
    expect(await readOnlyRecentVault()).toMatchObject({ papelizVaultDisplayName: 'Field Notes' })
  })

  it('is saved plain in .papeliz, shows in Recent Vaults, opens again with the vault, and leaves the folder’s name', async () => {
    const fakeVaultRootHandle = await createPapelizFakeVaultFolder('Field Notes', { 'Inbox.md': '# Inbox' })
    const papelizOpenVault = await openTestVaultFolder(fakeVaultRootHandle)
    expect(await renameOpenPapelizFolderVault(papelizOpenVault, '  Garden Journal ')).toBe('Garden Journal')
    expect(await readPapelizFakeVaultFolder(fakeVaultRootHandle)).toEqual({
      'Inbox.md': '# Inbox',
      '.papeliz/': '',
      [vaultOwnNameSettingsFileRelativePath]: describeVaultOwnNameSettingsFileText('Garden Journal'),
    })
    expect(fakeVaultRootHandle.name).toBe('Field Notes')

    const recentVault = await readOnlyRecentVault()
    expect(recentVault).toMatchObject({ papelizVaultId: papelizOpenVault.papelizVaultId, papelizVaultDisplayName: 'Garden Journal' })
    const reopenedVaultResult = await reopenPapelizRecentVault(recentVault)
    expect(reopenedVaultResult.openVaultOutcome === 'opened' && reopenedVaultResult.papelizOpenVault.papelizVaultDisplayName).toBe('Garden Journal')

    // Another device, which has never opened the folder, shows the same name: it travels with the vault.
    testBrowserDatabaseStores.clear()
    expect((await openTestVaultFolder(fakeVaultRootHandle)).papelizVaultDisplayName).toBe('Garden Journal')
  })

  it('goes back to the folder’s name when the saved one is gone or can’t be used', async () => {
    const fakeVaultRootHandle = await createPapelizFakeVaultFolder('Field Notes', { [vaultOwnNameSettingsFileRelativePath]: '{"papelizVaultName":"Work/Home"}' })
    expect((await openTestVaultFolder(fakeVaultRootHandle)).papelizVaultDisplayName).toBe('Field Notes')
    const damagedFakeVaultRootHandle = await createPapelizFakeVaultFolder('Reading List', { [vaultOwnNameSettingsFileRelativePath]: 'not json' })
    expect((await openTestVaultFolder(damagedFakeVaultRootHandle)).papelizVaultDisplayName).toBe('Reading List')
  })

  it('refuses a name that can’t be a vault’s, and writes nothing', async () => {
    const fakeVaultRootHandle = await createPapelizFakeVaultFolder('Field Notes', { 'Inbox.md': '# Inbox' })
    const papelizOpenVault = await openTestVaultFolder(fakeVaultRootHandle)
    expect(findPapelizVaultOwnNameProblem('   ')).toBe('Name Empty')
    expect(findPapelizVaultOwnNameProblem('Garden Journal')).toBeNull()
    await expect(renameOpenPapelizFolderVault(papelizOpenVault, '   ')).rejects.toThrow('Name Empty')
    await expect(renameOpenPapelizFolderVault(papelizOpenVault, 'Work/Home')).rejects.toThrow('Has A Blocked Character')
    await expect(renameOpenPapelizFolderVault(papelizOpenVault, '.notes')).rejects.toThrow('Starts With A Dot')
    expect(await readPapelizFakeVaultFolder(fakeVaultRootHandle)).toEqual({ 'Inbox.md': '# Inbox' })
    expect(await readOnlyRecentVault()).toMatchObject({ papelizVaultDisplayName: 'Field Notes' })
  })

  it('is saved and read back in a folder in Papeliz for Windows too', async () => {
    const desktopTestVaultFolderPath = 'C:\\Users\\Ada\\Field Notes'
    const fakeDesktopFileSystem = new PapelizFakeDesktopFileSystem(['C:\\Users\\Ada'])
    fakeDesktopFileSystem.addFakeDesktopFiles(desktopTestVaultFolderPath, { 'Inbox.md': '# Inbox' })
    const papelizDesktopPlatform = { desktopFileSystem: fakeDesktopFileSystem, rememberDesktopVaultFolderPath: async () => undefined }
    usePapelizDesktopPlatformStore.setState({ papelizDesktopPlatform: papelizDesktopPlatform as unknown as PapelizDesktopPlatform })
    const openVaultResult = await openPapelizDesktopVaultFolderPath(desktopTestVaultFolderPath, papelizDesktopPlatform as unknown as PapelizDesktopPlatform, {
      isDesktopVaultFolderJustPicked: true,
    })
    if (openVaultResult.openVaultOutcome !== 'opened') throw new Error(JSON.stringify(openVaultResult))
    expect(openVaultResult.papelizOpenVault.papelizVaultDisplayName).toBe('Field Notes')
    await renameOpenPapelizFolderVault(openVaultResult.papelizOpenVault, 'Garden Journal')
    expect(fakeDesktopFileSystem.readFakeDesktopFolder(desktopTestVaultFolderPath)[vaultOwnNameSettingsFileRelativePath]).toBe(describeVaultOwnNameSettingsFileText('Garden Journal'))

    const recentVault = await readOnlyRecentVault()
    expect(recentVault).toMatchObject({ papelizVaultDisplayName: 'Garden Journal', desktopVaultFolderPath: desktopTestVaultFolderPath })
    const reopenedVaultResult = await reopenPapelizRecentVault(recentVault)
    expect(reopenedVaultResult.openVaultOutcome === 'opened' && reopenedVaultResult.papelizOpenVault.papelizVaultDisplayName).toBe('Garden Journal')
  })
})

describe('a folder vault’s own name, in an End-to-end vault', () => {
  // New Vault, End-to-end: the folder is made and named, the typed name saved, then the vault made End-to-end.
  async function makeNewEndToEndTestVault(newVaultName: string) {
    const pickedPlaceHandle = await createPapelizFakeVaultFolder('Vaults', {})
    const madeVaultOpenResult = await makeAndOpenNewPapelizFolderVault(
      { newVaultParentFolderKind: 'browser-folder-handle', browserParentFolderHandle: pickedPlaceHandle.asFileSystemDirectoryHandle() },
      newVaultName,
    )
    if (madeVaultOpenResult.openVaultOutcome !== 'opened') throw new Error(JSON.stringify(madeVaultOpenResult))
    const endToEndVaultMakeResult = await makePapelizEndToEndVault({ newVaultOpenVault: madeVaultOpenResult.papelizOpenVault, vaultPassphrase: testVaultPassphrase })
    if (endToEndVaultMakeResult.endToEndVaultUnlockOutcome !== 'unlocked') throw new Error(JSON.stringify(endToEndVaultMakeResult))
    const fakeVaultRootHandle = await pickedPlaceHandle.getDirectoryHandle(newVaultName)
    return { fakeVaultRootHandle, papelizOpenVault: endToEndVaultMakeResult.papelizOpenVault }
  }

  it('is sealed when New Vault makes the vault End-to-end, and nothing plain is left', async () => {
    const { fakeVaultRootHandle, papelizOpenVault } = await makeNewEndToEndTestVault('Garden Journal')
    expect(papelizOpenVault.papelizVaultDisplayName).toBe('Garden Journal')
    expect(await readPapelizVaultOwnName(papelizOpenVault.papelizVaultAdapter)).toBe('Garden Journal')
    const storedVaultFiles = await readPapelizFakeVaultFolder(fakeVaultRootHandle)
    expect(storedVaultFiles[vaultOwnNameSettingsFileRelativePath]).toBeUndefined()
    expect(Object.values(storedVaultFiles).some((storedVaultFileText) => storedVaultFileText.includes('Garden Journal'))).toBe(false)
  })

  it('shows the name this device last saw before unlock, then its own sealed name', async () => {
    const { fakeVaultRootHandle, papelizOpenVault } = await makeNewEndToEndTestVault('Field Notes')
    expect(await renameOpenPapelizFolderVault(papelizOpenVault, 'Secret Garden Plans')).toBe('Secret Garden Plans')
    const storedVaultFiles = await readPapelizFakeVaultFolder(fakeVaultRootHandle)
    expect(storedVaultFiles[vaultOwnNameSettingsFileRelativePath]).toBeUndefined()
    expect(Object.values(storedVaultFiles).some((storedVaultFileText) => storedVaultFileText.includes('Secret Garden Plans'))).toBe(false)
    expect(await readOnlyRecentVault()).toMatchObject({ papelizVaultDisplayName: 'Secret Garden Plans' })

    // This device: locked, it shows the name it last saw.
    const lockedEndToEndVault = await findTestVaultFolderLocked(fakeVaultRootHandle)
    expect(lockedEndToEndVault.papelizVaultDisplayName).toBe('Secret Garden Plans')
    expect(await readOnlyRecentVault()).toMatchObject({ papelizVaultDisplayName: 'Secret Garden Plans' })

    // Another device: locked, it shows the folder's name; unlocked, the vault's own, which its Recent
    // Vaults keeps from then on.
    testBrowserDatabaseStores.clear()
    useTestVaultEncryptionDeviceStore()
    const otherDeviceLockedVault = await findTestVaultFolderLocked(fakeVaultRootHandle)
    expect(otherDeviceLockedVault.papelizVaultDisplayName).toBe('Field Notes')
    expect(await readOnlyRecentVault()).toMatchObject({ papelizVaultDisplayName: 'Field Notes' })
    const unlockedOpenVault = await unlockTestVault(otherDeviceLockedVault)
    expect(unlockedOpenVault.papelizVaultDisplayName).toBe('Secret Garden Plans')
    expect(await readOnlyRecentVault()).toMatchObject({ papelizVaultDisplayName: 'Secret Garden Plans' })
  })

  it('takes the folder’s name once unlocked when none is sealed in it', async () => {
    const fakeVaultRootHandle = await createPapelizFakeVaultFolder('Field Notes', { 'Inbox.md': '# Inbox' })
    const standardOpenVault = await openTestVaultFolder(fakeVaultRootHandle)
    const toEndToEndResult = await changePapelizVaultToEndToEnd({
      standardVaultAdapter: standardOpenVault.papelizVaultAdapter,
      papelizVaultId: standardOpenVault.papelizVaultId,
      vaultPassphrase: testVaultPassphrase,
    })
    expect(toEndToEndResult.vaultEncryptionKindChangeOutcome).toBe('changed')
    // This device last saw another name (a folder renamed on disk since, say).
    const rememberedFolderRows = testBrowserDatabaseStores.get('papelizVaultFolderHandles')!
    const rememberedFolderRow = rememberedFolderRows.get(standardOpenVault.papelizVaultId)!
    rememberedFolderRows.set(standardOpenVault.papelizVaultId, { ...rememberedFolderRow, papelizVaultDisplayName: 'Old Notes' })
    const lockedEndToEndVault = await findTestVaultFolderLocked(fakeVaultRootHandle)
    expect(lockedEndToEndVault.papelizVaultDisplayName).toBe('Old Notes')
    expect((await unlockTestVault(lockedEndToEndVault)).papelizVaultDisplayName).toBe('Field Notes')
    expect(await readOnlyRecentVault()).toMatchObject({ papelizVaultDisplayName: 'Field Notes' })
  })

  it('is read plain once unlocked when a change of kind stopped before it was sealed', async () => {
    const fakeVaultRootHandle = await createPapelizFakeVaultFolder('Field Notes', { 'Inbox.md': '# Inbox' })
    const standardOpenVault = await openTestVaultFolder(fakeVaultRootHandle)
    const toEndToEndResult = await changePapelizVaultToEndToEnd({
      standardVaultAdapter: standardOpenVault.papelizVaultAdapter,
      papelizVaultId: standardOpenVault.papelizVaultId,
      vaultPassphrase: testVaultPassphrase,
    })
    expect(toEndToEndResult.vaultEncryptionKindChangeOutcome).toBe('changed')
    // As a change to End-to-end leaves the vault when it stops before the name: still plain, and the
    // change unfinished.
    const vaultSettingsFolderHandle = await fakeVaultRootHandle.getDirectoryHandle('.papeliz')
    const vaultEncryptionSettingsFileHandle = await vaultSettingsFolderHandle.getFileHandle('vault-encryption.json')
    const vaultEncryptionSettings = JSON.parse(await (await vaultEncryptionSettingsFileHandle.getFile()).text()) as Record<string, unknown>
    await writeTestVaultSettingsFile(vaultEncryptionSettingsFileHandle, `${JSON.stringify({ ...vaultEncryptionSettings, unfinishedVaultEncryptionKindChange: 'to-end-to-end' }, null, 2)}\n`)
    await writeTestVaultSettingsFile(await vaultSettingsFolderHandle.getFileHandle('vault-name.json', { create: true }), describeVaultOwnNameSettingsFileText('Garden Journal'))

    const unlockedOpenVault = await unlockTestVault(await findTestVaultFolderLocked(fakeVaultRootHandle))
    expect(unlockedOpenVault.papelizVaultDisplayName).toBe('Garden Journal')
    expect(await readOnlyRecentVault()).toMatchObject({ papelizVaultDisplayName: 'Garden Journal' })
  })

  it('is carried by a change of kind both ways: sealed going End-to-end, plain again going Standard', async () => {
    const fakeVaultRootHandle = await createPapelizFakeVaultFolder('Field Notes', { 'Inbox.md': '# Inbox' })
    const standardOpenVault = await openTestVaultFolder(fakeVaultRootHandle)
    await renameOpenPapelizFolderVault(standardOpenVault, 'Garden Journal')
    const toEndToEndResult = await changePapelizVaultToEndToEnd({
      standardVaultAdapter: standardOpenVault.papelizVaultAdapter,
      papelizVaultId: standardOpenVault.papelizVaultId,
      vaultPassphrase: testVaultPassphrase,
    })
    if (toEndToEndResult.vaultEncryptionKindChangeOutcome !== 'changed') throw new Error(JSON.stringify(toEndToEndResult))
    const endToEndVaultAdapter = toEndToEndResult.changedVaultAdapter
    if (!isPapelizEndToEndVaultAdapter(endToEndVaultAdapter)) throw new Error('The vault isn’t End-to-end')
    expect(await readPapelizVaultOwnName(endToEndVaultAdapter)).toBe('Garden Journal')
    const encryptedVaultFiles = await readPapelizFakeVaultFolder(fakeVaultRootHandle)
    expect(encryptedVaultFiles[vaultOwnNameSettingsFileRelativePath]).toBeUndefined()
    expect(Object.values(encryptedVaultFiles).some((storedVaultFileText) => storedVaultFileText.includes('Garden Journal'))).toBe(false)

    const toStandardResult = await changePapelizVaultToStandard({ endToEndVaultAdapter, papelizVaultId: standardOpenVault.papelizVaultId, vaultPassphrase: testVaultPassphrase })
    if (toStandardResult.vaultEncryptionKindChangeOutcome !== 'changed') throw new Error(JSON.stringify(toStandardResult))
    expect((await readPapelizFakeVaultFolder(fakeVaultRootHandle))[vaultOwnNameSettingsFileRelativePath]).toBe(describeVaultOwnNameSettingsFileText('Garden Journal'))
    expect((await openTestVaultFolder(fakeVaultRootHandle)).papelizVaultDisplayName).toBe('Garden Journal')
  })
})

describe('a browser vault’s name', () => {
  it('stays the one in its browser-vault.json, and Rename for a folder vault refuses it', async () => {
    const { browserVaultEnvironment } = createPapelizFakeBrowserVaultEnvironment()
    const browserVaultRecord = await createPapelizBrowserVault('Recipes', browserVaultEnvironment)
    const openVaultResult = await openPapelizBrowserVault(browserVaultRecord, browserVaultEnvironment)
    if (openVaultResult.openVaultOutcome !== 'opened') throw new Error(JSON.stringify(openVaultResult))
    const browserOpenVault = openVaultResult.papelizOpenVault
    // A vault-name.json brought in with a folder's files changes nothing.
    await writePapelizVaultOwnName(browserOpenVault.papelizVaultAdapter, 'Garden Journal')
    await expect(renameOpenPapelizFolderVault(browserOpenVault, 'Desserts')).rejects.toSatisfy(
      (folderVaultRenameError: unknown) => describePapelizVaultError(folderVaultRenameError) === 'Not Supported Yet',
    )
    browserOpenVault.papelizVaultAdapter.closeVaultAdapter?.()
    const reopenedVaultResult = await openPapelizBrowserVault(browserVaultRecord, browserVaultEnvironment)
    expect(reopenedVaultResult.openVaultOutcome === 'opened' && reopenedVaultResult.papelizOpenVault.papelizVaultDisplayName).toBe('Recipes')
  })

  it('stays its own when it is End-to-end and unlocked', async () => {
    const { browserVaultEnvironment } = createPapelizFakeBrowserVaultEnvironment()
    const browserVaultRecord = await createPapelizBrowserVault('Recipes', browserVaultEnvironment)
    const openVaultResult = await openPapelizBrowserVault(browserVaultRecord, browserVaultEnvironment)
    if (openVaultResult.openVaultOutcome !== 'opened') throw new Error(JSON.stringify(openVaultResult))
    const endToEndVaultMakeResult = await makePapelizEndToEndVault({ newVaultOpenVault: openVaultResult.papelizOpenVault, vaultPassphrase: testVaultPassphrase })
    if (endToEndVaultMakeResult.endToEndVaultUnlockOutcome !== 'unlocked') throw new Error(JSON.stringify(endToEndVaultMakeResult))
    await writePapelizVaultOwnName(endToEndVaultMakeResult.papelizOpenVault.papelizVaultAdapter, 'Garden Journal')
    endToEndVaultMakeResult.papelizOpenVault.papelizVaultAdapter.closeVaultAdapter?.()

    const existingVaultOpenResult = await findPapelizLockedEndToEndVault(await openPapelizBrowserVault(browserVaultRecord, browserVaultEnvironment))
    if (existingVaultOpenResult.openVaultOutcome !== 'needs-unlock') throw new Error(existingVaultOpenResult.openVaultOutcome)
    expect(existingVaultOpenResult.papelizLockedEndToEndVault.papelizVaultDisplayName).toBe('Recipes')
    expect((await unlockTestVault(existingVaultOpenResult.papelizLockedEndToEndVault)).papelizVaultDisplayName).toBe('Recipes')
  })
})
