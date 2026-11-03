import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PapelizDesktopPlatform } from '../desktop/papeliz-desktop-platform-contract'
import { hasPapelizSyncVaultAdapterWholeFileAccess } from '../sync/papeliz-sync-local-vault-files'
import { PapelizBrowserVaultAdapter } from './papeliz-browser-vault-adapter'
import { importPapelizEndToEndBrowserVault, type PapelizBrowserVaultImportPlan } from './papeliz-browser-vault-import'
import type { PapelizEndToEndEncryptingVaultAdapter } from './papeliz-end-to-end-vault-adapter'
import { createPapelizDesktopFolderVaultAdapter } from './papeliz-desktop-folder-vault-adapter'
import { writeVaultFileContentsThroughWritableStream } from './papeliz-directory-handle-vault-adapter'
import { createPapelizFakeBrowserVaultEnvironment, getPapelizFakeBrowserVaultFolder } from './papeliz-fake-browser-vault-environment.test-support'
import { createPapelizFakeDesktopFileSystem } from './papeliz-fake-desktop-file-system.test-support'
import { createPapelizFakeVaultFolder, readPapelizFakeVaultFolder } from './papeliz-fake-file-system-access.test-support'
import { PapelizFolderOnDiskVaultAdapter } from './papeliz-folder-on-disk-vault-adapter'
import { PapelizInMemoryVaultAdapter } from './papeliz-in-memory-vault-adapter'
import type { PapelizOpenVault } from './papeliz-open-vault'
import { describePapelizVaultError, isPapelizVaultEntryMissingError, type PapelizVaultAdapter } from './papeliz-vault-adapter'
import {
  canPapelizVaultAdapterBeEndToEnd,
  changePapelizEndToEndVaultPassphrase,
  changePapelizVaultToEndToEnd,
  changePapelizVaultToStandard,
  describePapelizVaultEncryptionFailureCode,
  describePapelizWrongVaultPassphrase,
  findPapelizLockedEndToEndVault,
  finishPapelizVaultEncryptionKindChange,
  forgetPapelizVaultEncryptionKeyOnThisDevice,
  isPapelizEndToEndVaultAdapter,
  isPapelizVaultEncryptionKeyRememberedOnThisDevice,
  makePapelizEndToEndVault,
  readPapelizVaultEncryptionState,
  rememberPapelizVaultEncryptionKeyOnThisDevice,
  unlockPapelizEndToEndVault,
  unlockPapelizEndToEndVaultWithRememberedKey,
  writePapelizVaultImportFilesIntoEndToEndVault,
  type PapelizEndToEndVaultAdapter,
  type PapelizEndToEndVaultUnlockResult,
  type PapelizLockedEndToEndVault,
  type PapelizVaultEncryptionFailureCode,
  type PapelizVaultEncryptionKindChangeProgress,
} from './papeliz-vault-encryption'
import {
  readPapelizRecentVaultEncryptionKindRecords,
  rememberPapelizVaultEncryptionKeyBytes,
  usePapelizVaultEncryptionDeviceStoreForTests,
  type PapelizRecentVaultEncryptionKindRecord,
  type PapelizRememberedVaultEncryptionKeyRecord,
  type PapelizVaultEncryptionDeviceRecordStore,
} from './papeliz-vault-encryption-device-store'
import { usePapelizVaultArgon2idSettingsForTests } from './papeliz-vault-encryption-passphrase-key'
import type { PapelizVaultImportFile } from './papeliz-vault-folder-import'

// End-to-end vaults on every kind of vault that keeps files: a folder opened in the browser, a folder
// in Papeliz for Windows and a browser vault. Argon2id runs with small settings here, so each test is
// quick; the format itself is held to Sync's test vectors in papeliz-vault-encryption-format.test.ts.

const testVaultPassphrase = 'correct horse battery staple'
const otherTestVaultPassphrase = 'a different passphrase entirely'
const desktopTestVaultFolderPath = 'C:\\Users\\Ada\\Field Notes'

function createTestDeviceRecordStore(): PapelizVaultEncryptionDeviceRecordStore & {
  rememberedKeyRecords: Map<string, PapelizRememberedVaultEncryptionKeyRecord>
  recentKindRecords: Map<string, PapelizRecentVaultEncryptionKindRecord>
} {
  const rememberedKeyRecords = new Map<string, PapelizRememberedVaultEncryptionKeyRecord>()
  const recentKindRecords = new Map<string, PapelizRecentVaultEncryptionKindRecord>()
  return {
    rememberedKeyRecords,
    recentKindRecords,
    readRememberedVaultEncryptionKeyRecord: async (papelizEncryptedVaultId) => rememberedKeyRecords.get(papelizEncryptedVaultId),
    putRememberedVaultEncryptionKeyRecord: async (rememberedKeyRecord) => void rememberedKeyRecords.set(rememberedKeyRecord.papelizEncryptedVaultId, rememberedKeyRecord),
    deleteRememberedVaultEncryptionKeyRecord: async (papelizEncryptedVaultId) => void rememberedKeyRecords.delete(papelizEncryptedVaultId),
    readAllRecentVaultEncryptionKindRecords: async () => [...recentKindRecords.values()],
    putRecentVaultEncryptionKindRecord: async (recentKindRecord) => void recentKindRecords.set(recentKindRecord.papelizVaultId, recentKindRecord),
  }
}

let testDeviceRecordStore = createTestDeviceRecordStore()

beforeEach(() => {
  usePapelizVaultArgon2idSettingsForTests({ argon2idMemoryKibibytes: 64, argon2idPassCount: 1, argon2idParallelism: 1 })
  testDeviceRecordStore = createTestDeviceRecordStore()
  usePapelizVaultEncryptionDeviceStoreForTests(testDeviceRecordStore, null)
})

afterEach(() => {
  usePapelizVaultArgon2idSettingsForTests(null)
  usePapelizVaultEncryptionDeviceStoreForTests(null)
})

// One kind of vault: how to open it again (a new adapter on the same files, as reopening does) and how
// to read every stored file back as text, to look for anything left plain.
interface PapelizEncryptionTestVault {
  openStoredVaultAdapter: () => PapelizVaultAdapter
  readStoredVaultFiles: () => Promise<Record<string, string>>
}

async function createFolderOnDiskTestVault(storedVaultFiles: Record<string, string>): Promise<PapelizEncryptionTestVault> {
  const fakeVaultRootHandle = await createPapelizFakeVaultFolder('Field Notes', storedVaultFiles)
  return {
    openStoredVaultAdapter: () => new PapelizFolderOnDiskVaultAdapter(fakeVaultRootHandle.asFileSystemDirectoryHandle()),
    readStoredVaultFiles: () => readPapelizFakeVaultFolder(fakeVaultRootHandle),
  }
}

async function createDesktopFolderTestVault(storedVaultFiles: Record<string, string>): Promise<PapelizEncryptionTestVault> {
  const fakeDesktopFileSystem = createPapelizFakeDesktopFileSystem(desktopTestVaultFolderPath, storedVaultFiles)
  return {
    openStoredVaultAdapter: () => createPapelizDesktopFolderVaultAdapter(desktopTestVaultFolderPath, fakeDesktopFileSystem),
    readStoredVaultFiles: async () => fakeDesktopFileSystem.readFakeDesktopFolder(desktopTestVaultFolderPath),
  }
}

async function createBrowserVaultTestVault(storedVaultFiles: Record<string, string>): Promise<PapelizEncryptionTestVault> {
  const fakeBrowserVaultFolderHandle = await createPapelizFakeVaultFolder('pzbrowser', { '.papeliz/browser-vault.json': '{"browserVaultName":"Field Notes"}', ...storedVaultFiles })
  return {
    openStoredVaultAdapter: () =>
      new PapelizBrowserVaultAdapter(fakeBrowserVaultFolderHandle.asFileSystemDirectoryHandle(), {
        papelizVaultId: 'test-browser-vault',
        browserVaultLockManager: null,
        onBrowserVaultChanged: () => undefined,
        releaseBrowserVaultOpenLock: () => undefined,
        vaultFileContentsWriter: writeVaultFileContentsThroughWritableStream,
      }),
    readStoredVaultFiles: () => readPapelizFakeVaultFolder(fakeBrowserVaultFolderHandle),
  }
}

const papelizEncryptionTestVaultMakers: [string, (storedVaultFiles: Record<string, string>) => Promise<PapelizEncryptionTestVault>][] = [
  ['a folder on disk', createFolderOnDiskTestVault],
  ['a folder in Papeliz for Windows', createDesktopFolderTestVault],
  ['a browser vault', createBrowserVaultTestVault],
]

function makeTestOpenVault(papelizVaultAdapter: PapelizVaultAdapter): PapelizOpenVault {
  return { papelizVaultId: 'test-vault-row', papelizVaultDisplayName: 'Field Notes', papelizVaultAdapter }
}

function expectUnlocked(unlockResult: PapelizEndToEndVaultUnlockResult): PapelizEndToEndVaultAdapter {
  if (unlockResult.endToEndVaultUnlockOutcome !== 'unlocked') throw new Error(`The vault didn’t unlock: ${JSON.stringify(unlockResult)}`)
  return unlockResult.papelizOpenVault.papelizVaultAdapter
}

async function findLockedTestVault(testVault: PapelizEncryptionTestVault): Promise<PapelizLockedEndToEndVault> {
  const existingVaultOpenResult = await findPapelizLockedEndToEndVault({ openVaultOutcome: 'opened', papelizOpenVault: makeTestOpenVault(testVault.openStoredVaultAdapter()) })
  if (existingVaultOpenResult.openVaultOutcome !== 'needs-unlock') throw new Error(`The vault isn’t locked: ${existingVaultOpenResult.openVaultOutcome}`)
  return existingVaultOpenResult.papelizLockedEndToEndVault
}

async function unlockTestVault(testVault: PapelizEncryptionTestVault, vaultPassphrase = testVaultPassphrase): Promise<PapelizEndToEndVaultAdapter> {
  return expectUnlocked(await unlockPapelizEndToEndVault(await findLockedTestVault(testVault), { vaultPassphrase, isVaultKeyRememberedOnThisDevice: false }))
}

async function makeEndToEndTestVault(testVault: PapelizEncryptionTestVault): Promise<PapelizEndToEndVaultAdapter> {
  return expectUnlocked(await makePapelizEndToEndVault({ newVaultOpenVault: makeTestOpenVault(testVault.openStoredVaultAdapter()), vaultPassphrase: testVaultPassphrase }))
}

async function listTreeEntries(papelizVaultAdapter: PapelizVaultAdapter, isEveryHiddenVaultEntryListed = false): Promise<string[]> {
  return (await papelizVaultAdapter.listVaultTreeEntries({ isEveryHiddenVaultEntryListed })).map((treeEntry) => `${treeEntry.vaultEntryKind}:${treeEntry.vaultEntryRelativePath}`).sort()
}

async function readFailureCode(failingVaultCall: Promise<unknown>): Promise<string> {
  try {
    await failingVaultCall
  } catch (vaultCallError) {
    return describePapelizVaultError(vaultCallError)
  }
  throw new Error('The call didn’t fail.')
}

function createTestImportFile(importFileRelativePath: string, importFileText: string): PapelizVaultImportFile {
  return { importFileRelativePath, isImportFileFolder: false, importFileByteCount: importFileText.length, readImportFileBytes: async () => new TextEncoder().encode(importFileText) }
}

function expectNoPlainTextStored(storedVaultFiles: Record<string, string>, plainTexts: readonly string[]): void {
  const storedVaultText = Object.entries(storedVaultFiles)
    .map(([storedPath, storedText]) => `${storedPath}\n${storedText}`)
    .join('\n')
  for (const plainText of plainTexts) expect(storedVaultText).not.toContain(plainText)
}

function listStoredPaths(storedVaultFiles: Record<string, string>): string[] {
  return Object.keys(storedVaultFiles)
    .filter((storedPath) => !storedPath.startsWith('papeliz-encrypted-files/pzentry_'))
    .sort()
}

describe.each(papelizEncryptionTestVaultMakers)('an End-to-end vault in %s', (_vaultKindName, createTestVault) => {
  it('is made from an empty vault, opens only with its passphrase, and stores nothing plain', async () => {
    const testVault = await createTestVault({})
    const endToEndVaultAdapter = await makeEndToEndTestVault(testVault)
    expect(isPapelizEndToEndVaultAdapter(endToEndVaultAdapter)).toBe(true)
    await endToEndVaultAdapter.createVaultFolder('Ideas')
    await endToEndVaultAdapter.createVaultNote('Ideas/Secret plan.md', '# Secret plan\n\nThe launch is on Friday.')

    const storedVaultFiles = await testVault.readStoredVaultFiles()
    expectNoPlainTextStored(storedVaultFiles, ['Secret plan', 'launch is on Friday', 'Ideas'])
    expect(listStoredPaths(storedVaultFiles).filter((storedPath) => storedPath !== '.papeliz/browser-vault.json')).toEqual([
      '.papeliz/',
      '.papeliz/vault-encryption.json',
      'About this Papeliz vault.txt',
      'papeliz-encrypted-files/',
    ])
    expect(storedVaultFiles['About this Papeliz vault.txt']).toContain('They open only in Papeliz')
    expect(JSON.parse(storedVaultFiles['.papeliz/vault-encryption.json'] ?? '{}')).toMatchObject({
      papelizVaultEncryptionFormatVersion: 1,
      papelizVaultEncryptionKind: 'end-to-end',
      unfinishedVaultEncryptionKindChange: null,
    })

    expect((await unlockPapelizEndToEndVault(await findLockedTestVault(testVault), { vaultPassphrase: otherTestVaultPassphrase, isVaultKeyRememberedOnThisDevice: false })).endToEndVaultUnlockOutcome).toBe(
      'wrong-passphrase',
    )
    const reopenedVaultAdapter = await unlockTestVault(testVault)
    expect(await listTreeEntries(reopenedVaultAdapter)).toEqual(['folder:Ideas', 'note:Ideas/Secret plan.md'])
    expect(await reopenedVaultAdapter.readVaultNoteText('Ideas/Secret plan.md')).toBe('# Secret plan\n\nThe launch is on Friday.')
  })

  it('takes every adapter call through the encryption, with hidden names that come back as they went in', async () => {
    const testVault = await createTestVault({})
    const endToEndVaultAdapter = await makeEndToEndTestVault(testVault)
    await endToEndVaultAdapter.createVaultFolder('Projects')
    await endToEndVaultAdapter.createVaultFolder('Projects/Empty')
    await endToEndVaultAdapter.createVaultNote('Projects/Plan.md', 'first')
    await endToEndVaultAdapter.writeVaultNoteText('Projects/Plan.md', 'second')
    await endToEndVaultAdapter.createVaultNote('Inbox.md', '')
    expect(await readFailureCode(endToEndVaultAdapter.createVaultNote('projects/plan.md', 'x'))).toBe('Name Taken')
    expect(await readFailureCode(endToEndVaultAdapter.createVaultNote('Nowhere/Plan.md', 'x'))).toBe('Not In Vault')
    expect(await readFailureCode(endToEndVaultAdapter.createVaultNote('.git/config.md', 'x'))).toBe('Hidden Folder')

    const pictureBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 0, 255])
    await endToEndVaultAdapter.createVaultAttachmentFile('Projects/sketch.png', new Blob([pictureBytes]))
    expect(await endToEndVaultAdapter.listVaultAttachmentFileRelativePaths()).toEqual(['Projects/sketch.png'])
    const pictureBlob = await endToEndVaultAdapter.readVaultAttachmentFileBlob('Projects/sketch.png')
    expect(pictureBlob.type).toBe('image/png')
    expect(new Uint8Array(await pictureBlob.arrayBuffer())).toEqual(pictureBytes)
    const pictureObjectUrl = await endToEndVaultAdapter.createDecryptedVaultFileObjectUrl('Projects/sketch.png')
    expect(pictureObjectUrl.startsWith('blob:')).toBe(true)

    await endToEndVaultAdapter.createVaultFolder('.csessions')
    await endToEndVaultAdapter.writeVaultNoteText('.csessions/2026-11-03 chat.json', '{"chat":"hidden"}')
    await endToEndVaultAdapter.writePapelizVaultSettingsFile('file-order.json', '["Projects/Plan.md"]')
    expect(await endToEndVaultAdapter.readPapelizVaultSettingsFile('file-order.json')).toBe('["Projects/Plan.md"]')
    expect(await endToEndVaultAdapter.readPapelizVaultSettingsFile('not-there.json')).toBeNull()
    expect(await readFailureCode(endToEndVaultAdapter.writePapelizVaultSettingsFile('vault-encryption.json', '{}'))).toBe('Unknown Settings File')

    await endToEndVaultAdapter.renameVaultEntry('Projects/Plan.md', 'Projects/Roadmap.md')
    await endToEndVaultAdapter.renameVaultEntry('Projects/Roadmap.md', 'Projects/roadmap.md')
    await endToEndVaultAdapter.copyVaultEntry('Projects', 'Projects copy')
    await endToEndVaultAdapter.renameVaultEntry('Projects copy', 'Archive')
    expect(await readFailureCode(endToEndVaultAdapter.copyVaultEntry('Archive', 'Archive/Inside'))).toBe('Into Itself')
    const trashedPath = await endToEndVaultAdapter.moveVaultEntryToTrash('Archive')
    expect(trashedPath).toBe('.trash/Archive')
    expect(await endToEndVaultAdapter.moveVaultEntryToTrash('Projects/roadmap.md')).toBe('.trash/roadmap.md')
    await endToEndVaultAdapter.restoreVaultEntryFromTrash('.trash/roadmap.md', 'Projects/roadmap.md')
    expect(await endToEndVaultAdapter.takeBackEmptyNewVaultNote?.('Projects/roadmap.md')).toBe(false)
    expect(await endToEndVaultAdapter.takeBackEmptyNewVaultNote?.('Inbox.md')).toBe(true)
    const importedFolderName = await endToEndVaultAdapter.importVaultFilesIntoNewFolder('Projects', [
      createTestImportFile('Clipped/Recipe.md', '# Soup'),
      { importFileRelativePath: 'Clipped/Empty', isImportFileFolder: true, importFileByteCount: 0, readImportFileBytes: async () => new Uint8Array() },
    ])
    expect(importedFolderName).toBe('Projects 2')

    const expectedTreeEntries = [
      'folder:.csessions',
      'folder:Projects',
      'folder:Projects 2',
      'folder:Projects 2/Clipped',
      'folder:Projects 2/Clipped/Empty',
      'folder:Projects/Empty',
      'note:Projects 2/Clipped/Recipe.md',
      'note:Projects/roadmap.md',
      'text-file:.csessions/2026-11-03 chat.json',
    ]
    expect(await listTreeEntries(endToEndVaultAdapter)).toEqual(expectedTreeEntries)
    const expectedHiddenTreeEntries = [
      'folder:.trash',
      'folder:.trash/Archive',
      'folder:.trash/Archive/Empty',
      'note:.trash/Archive/roadmap.md',
      ...expectedTreeEntries,
    ].sort()
    expect(await listTreeEntries(endToEndVaultAdapter, true)).toEqual(expectedHiddenTreeEntries)

    const storedVaultFiles = await testVault.readStoredVaultFiles()
    expectNoPlainTextStored(storedVaultFiles, ['Projects', 'roadmap', 'Recipe', 'Soup', 'csessions', 'chat', 'file-order', 'Archive', 'sketch'])

    // Everything comes back from the files alone, under a new unlock.
    const reopenedVaultAdapter = await unlockTestVault(testVault)
    expect(await listTreeEntries(reopenedVaultAdapter, true)).toEqual(expectedHiddenTreeEntries)
    expect(await reopenedVaultAdapter.readVaultNoteText('Projects/roadmap.md')).toBe('second')
    expect(await reopenedVaultAdapter.readVaultNoteText('.trash/Archive/roadmap.md')).toBe('second')
    expect(await reopenedVaultAdapter.readVaultNoteText('.csessions/2026-11-03 chat.json')).toBe('{"chat":"hidden"}')
    expect(await reopenedVaultAdapter.readPapelizVaultSettingsFile('file-order.json')).toBe('["Projects/Plan.md"]')
    expect(new Uint8Array(await (await reopenedVaultAdapter.readVaultAttachmentFileBlob('Projects/sketch.png')).arrayBuffer())).toEqual(pictureBytes)
    expect(isPapelizVaultEntryMissingError(await reopenedVaultAdapter.readVaultNoteText('Gone.md').catch((missingError: unknown) => missingError))).toBe(true)
  })

  it('locks: the key, the names and the object URLs go, and every call fails', async () => {
    const testVault = await createTestVault({})
    const endToEndVaultAdapter = await makeEndToEndTestVault(testVault)
    await endToEndVaultAdapter.createVaultNote('Note.md', 'text')
    let lockNoticeCount = 0
    endToEndVaultAdapter.listenForEndToEndVaultLock(() => {
      lockNoticeCount += 1
    })
    endToEndVaultAdapter.lockEndToEndVault()
    endToEndVaultAdapter.lockEndToEndVault()
    expect(lockNoticeCount).toBe(1)
    expect(endToEndVaultAdapter.isEndToEndVaultLocked()).toBe(true)
    expect(await readFailureCode(endToEndVaultAdapter.readVaultNoteText('Note.md'))).toBe('Vault Locked')
    expect(await readFailureCode(endToEndVaultAdapter.listVaultTreeEntries())).toBe('Vault Locked')
    expect(await readFailureCode(endToEndVaultAdapter.writeVaultNoteText('Note.md', 'plain?'))).toBe('Vault Locked')
    expect((await rememberPapelizVaultEncryptionKeyOnThisDevice(endToEndVaultAdapter)).vaultEncryptionActionOutcome).toBe('failed')
  })

  it('refuses plain writes into the locked vault, and isn’t carried by Sync yet', async () => {
    const testVault = await createTestVault({})
    const endToEndVaultAdapter = await makeEndToEndTestVault(testVault)
    expect(hasPapelizSyncVaultAdapterWholeFileAccess(endToEndVaultAdapter)).toBe(false)
    const lockedEndToEndVault = await findLockedTestVault(testVault)
    const lockedStoredVaultAdapter = lockedEndToEndVault.lockedStoredVaultAdapter
    expect(await readFailureCode(lockedStoredVaultAdapter.createVaultNote('Plain.md', 'plain'))).toBe('Plain Write Refused')
    expect(await readFailureCode(lockedStoredVaultAdapter.writeVaultNoteText('Plain.md', 'plain'))).toBe('Plain Write Refused')
    expect(await readFailureCode(lockedStoredVaultAdapter.importVaultFilesIntoNewFolder('Clips', [createTestImportFile('a.md', 'plain')]))).toBe('Plain Write Refused')
    expect(await readFailureCode(lockedStoredVaultAdapter.writePapelizVaultSettingsFile('file-order.json', '[]'))).toBe('Plain Write Refused')
    expect(Object.keys(await testVault.readStoredVaultFiles()).some((storedPath) => storedPath.includes('Plain') || storedPath.startsWith('Clips'))).toBe(false)
  })

  it('changes from Standard to End-to-end and back, carrying the trash, hidden chats and empty folders, and leaving other apps’ folders', async () => {
    const standardVaultFiles = {
      'Inbox.md': '# Inbox\n\nBuy oat milk',
      'Projects/Plan.md': 'The plan',
      'Projects/Empty/': '',
      'Projects/notes.txt': 'plain text file',
      '.trash/Old idea.md': 'An old idea',
      '.csessions/chat.json': '{"chat":"about soup"}',
      '.papeliz/file-order.json': '["Inbox.md"]',
      '.git/config': '[core]',
    }
    const testVault = await createTestVault(standardVaultFiles)
    const standardVaultAdapter = testVault.openStoredVaultAdapter()
    // Another app's `.git/` stays plain, and an End-to-end vault lists only what it encrypted.
    const standardTreeEntries = (await listTreeEntries(standardVaultAdapter, true)).filter((treeEntry) => treeEntry !== 'folder:.git')
    const progressReports: PapelizVaultEncryptionKindChangeProgress[] = []
    const toEndToEndResult = await changePapelizVaultToEndToEnd({
      standardVaultAdapter,
      papelizVaultId: 'test-vault-row',
      vaultPassphrase: testVaultPassphrase,
      onVaultEncryptionKindChangeProgress: (progressReport) => progressReports.push(progressReport),
    })
    if (toEndToEndResult.vaultEncryptionKindChangeOutcome !== 'changed') throw new Error(JSON.stringify(toEndToEndResult))
    expect(progressReports.at(-1)).toEqual({ vaultEncryptionChangeFilesDone: 6, vaultEncryptionChangeFilesInAll: 6 })
    expect(testDeviceRecordStore.recentKindRecords.get('test-vault-row')?.papelizVaultEncryptionKind).toBe('end-to-end')

    const encryptedVaultFiles = await testVault.readStoredVaultFiles()
    expectNoPlainTextStored(encryptedVaultFiles, ['Inbox', 'oat milk', 'The plan', 'Old idea', 'about soup', 'file-order', 'Projects'])
    expect(listStoredPaths(encryptedVaultFiles).filter((storedPath) => storedPath !== '.papeliz/browser-vault.json')).toEqual([
      '.git/',
      '.git/config',
      '.papeliz/',
      '.papeliz/vault-encryption.json',
      'About this Papeliz vault.txt',
      'papeliz-encrypted-files/',
    ])

    const endToEndVaultAdapter = await unlockTestVault(testVault)
    expect(await listTreeEntries(endToEndVaultAdapter, true)).toEqual(standardTreeEntries)
    expect(await endToEndVaultAdapter.readVaultNoteText('.trash/Old idea.md')).toBe('An old idea')
    expect(await endToEndVaultAdapter.readPapelizVaultSettingsFile('file-order.json')).toBe('["Inbox.md"]')

    expect((await changePapelizVaultToStandard({ endToEndVaultAdapter, vaultPassphrase: otherTestVaultPassphrase })).vaultEncryptionKindChangeOutcome).toBe('wrong-passphrase')
    await rememberPapelizVaultEncryptionKeyOnThisDevice(endToEndVaultAdapter)
    expect(await isPapelizVaultEncryptionKeyRememberedOnThisDevice(endToEndVaultAdapter.papelizEncryptedVaultId)).toBe(true)
    const toStandardResult = await changePapelizVaultToStandard({ endToEndVaultAdapter, papelizVaultId: 'test-vault-row', vaultPassphrase: testVaultPassphrase })
    if (toStandardResult.vaultEncryptionKindChangeOutcome !== 'changed') throw new Error(JSON.stringify(toStandardResult))
    expect(endToEndVaultAdapter.isEndToEndVaultLocked()).toBe(true)
    expect(await isPapelizVaultEncryptionKeyRememberedOnThisDevice(endToEndVaultAdapter.papelizEncryptedVaultId)).toBe(false)
    expect(testDeviceRecordStore.recentKindRecords.get('test-vault-row')?.papelizVaultEncryptionKind).toBe('standard')

    const plainAgainVaultFiles = await testVault.readStoredVaultFiles()
    for (const [standardPath, standardText] of Object.entries(standardVaultFiles)) expect(plainAgainVaultFiles[standardPath]).toBe(standardText)
    expect(plainAgainVaultFiles['About this Papeliz vault.txt']).toBeUndefined()
    expect(plainAgainVaultFiles['papeliz-encrypted-files/']).toBeUndefined()
    expect(await readPapelizVaultEncryptionState(testVault.openStoredVaultAdapter())).toEqual({
      vaultEncryptionStateReadOutcome: 'read',
      papelizVaultEncryptionState: { vaultEncryptionKind: 'standard', papelizEncryptedVaultId: null, unfinishedVaultEncryptionKindChange: null },
    })
    expect((await findPapelizLockedEndToEndVault({ openVaultOutcome: 'opened', papelizOpenVault: makeTestOpenVault(toStandardResult.changedVaultAdapter) })).openVaultOutcome).toBe('opened')
  })

  it('carries on a change to End-to-end that stopped part-way, losing nothing', async () => {
    const testVault = await createTestVault({ 'A.md': 'alpha', 'B.md': 'bravo', 'C.md': 'charlie' })
    const failingStoredVaultAdapter = failStoredWritesAfter(testVault.openStoredVaultAdapter(), 3)
    const stoppedResult = await changePapelizVaultToEndToEnd({ standardVaultAdapter: failingStoredVaultAdapter, vaultPassphrase: testVaultPassphrase })
    if (stoppedResult.vaultEncryptionKindChangeOutcome !== 'stopped') throw new Error(JSON.stringify(stoppedResult))
    expect(stoppedResult.changedVaultAdapter.unfinishedVaultEncryptionKindChange).toBe('to-end-to-end')
    const halfwayVaultFiles = await testVault.readStoredVaultFiles()
    // Each plain note is either still there or encrypted; none is gone.
    expect(halfwayVaultFiles['A.md']).toBeUndefined()
    expect(halfwayVaultFiles['C.md']).toBe('charlie')

    const lockedEndToEndVault = await findLockedTestVault(testVault)
    expect(lockedEndToEndVault.unfinishedVaultEncryptionKindChange).toBe('to-end-to-end')
    const endToEndVaultAdapter = expectUnlocked(await unlockPapelizEndToEndVault(lockedEndToEndVault, { vaultPassphrase: testVaultPassphrase, isVaultKeyRememberedOnThisDevice: false }))
    const finishResult = await finishPapelizVaultEncryptionKindChange(endToEndVaultAdapter)
    expect(finishResult.vaultEncryptionKindChangeOutcome).toBe('changed')
    expect(endToEndVaultAdapter.unfinishedVaultEncryptionKindChange).toBeNull()
    expect(await listTreeEntries(endToEndVaultAdapter)).toEqual(['note:A.md', 'note:B.md', 'note:C.md'])
    expect(await endToEndVaultAdapter.readVaultNoteText('C.md')).toBe('charlie')
    expectNoPlainTextStored(await testVault.readStoredVaultFiles(), ['alpha', 'bravo', 'charlie'])
    expect((await findLockedTestVault(testVault)).unfinishedVaultEncryptionKindChange).toBeNull()
  })

  it('carries on a change to Standard that stopped part-way', async () => {
    const testVault = await createTestVault({})
    const madeVaultAdapter = await makeEndToEndTestVault(testVault)
    for (const noteName of ['A.md', 'B.md', 'C.md']) await madeVaultAdapter.createVaultNote(noteName, `text of ${noteName}`)
    const unlockedVaultAdapter = await unlockTestVault(testVault)
    // The stop comes from the vault's own adapter underneath, as a full disk would.
    const storedVaultAdapter = (unlockedVaultAdapter as unknown as { storedVaultAdapter: PapelizVaultAdapter & { writeStoredVaultFileBytes: (...writeArguments: unknown[]) => Promise<void> } }).storedVaultAdapter
    const keptWriteStoredVaultFileBytes = storedVaultAdapter.writeStoredVaultFileBytes.bind(storedVaultAdapter)
    let storedWriteCount = 0
    storedVaultAdapter.writeStoredVaultFileBytes = async (...writeArguments: unknown[]) => {
      storedWriteCount += 1
      if (storedWriteCount === 2) throw new DOMException('The disk is full.', 'QuotaExceededError')
      return (keptWriteStoredVaultFileBytes as (...keptArguments: unknown[]) => Promise<void>)(...writeArguments)
    }
    const stoppedResult = await changePapelizVaultToStandard({ endToEndVaultAdapter: unlockedVaultAdapter, vaultPassphrase: testVaultPassphrase })
    expect(stoppedResult).toMatchObject({ vaultEncryptionKindChangeOutcome: 'stopped', vaultEncryptionFailureCode: 'Disk Full' })

    const lockedEndToEndVault = await findLockedTestVault(testVault)
    expect(lockedEndToEndVault.unfinishedVaultEncryptionKindChange).toBe('to-standard')
    const resumedVaultAdapter = expectUnlocked(await unlockPapelizEndToEndVault(lockedEndToEndVault, { vaultPassphrase: testVaultPassphrase, isVaultKeyRememberedOnThisDevice: false }))
    const finishResult = await finishPapelizVaultEncryptionKindChange(resumedVaultAdapter)
    if (finishResult.vaultEncryptionKindChangeOutcome !== 'changed') throw new Error(JSON.stringify(finishResult))
    expect(await listTreeEntries(finishResult.changedVaultAdapter)).toEqual(['note:A.md', 'note:B.md', 'note:C.md'])
    const plainVaultFiles = await testVault.readStoredVaultFiles()
    for (const noteName of ['A.md', 'B.md', 'C.md']) expect(plainVaultFiles[noteName]).toBe(`text of ${noteName}`)
  })

  it('changes the passphrase by rewrapping the key alone, and a remembered key still opens it', async () => {
    const testVault = await createTestVault({})
    const endToEndVaultAdapter = await makeEndToEndTestVault(testVault)
    await endToEndVaultAdapter.createVaultNote('Note.md', 'kept')
    const encryptedFilesBefore = Object.entries(await testVault.readStoredVaultFiles()).filter(([storedPath]) => storedPath.startsWith('papeliz-encrypted-files/'))
    expect(await rememberPapelizVaultEncryptionKeyOnThisDevice(endToEndVaultAdapter)).toEqual({ vaultEncryptionActionOutcome: 'done' })

    expect(
      (await changePapelizEndToEndVaultPassphrase({ endToEndVaultAdapter, currentVaultPassphrase: otherTestVaultPassphrase, newVaultPassphrase: 'a brand new passphrase' }))
        .vaultPassphraseChangeOutcome,
    ).toBe('wrong-passphrase')
    expect(await changePapelizEndToEndVaultPassphrase({ endToEndVaultAdapter, currentVaultPassphrase: testVaultPassphrase, newVaultPassphrase: 'short' })).toEqual({
      vaultPassphraseChangeOutcome: 'failed',
      vaultEncryptionFailureCode: 'Passphrase Too Short',
    })
    expect(await changePapelizEndToEndVaultPassphrase({ endToEndVaultAdapter, currentVaultPassphrase: testVaultPassphrase, newVaultPassphrase: 'a brand new passphrase' })).toEqual({
      vaultPassphraseChangeOutcome: 'changed',
    })
    const encryptedFilesAfter = Object.entries(await testVault.readStoredVaultFiles()).filter(([storedPath]) => storedPath.startsWith('papeliz-encrypted-files/'))
    expect(encryptedFilesAfter).toEqual(encryptedFilesBefore)

    expect((await unlockPapelizEndToEndVault(await findLockedTestVault(testVault), { vaultPassphrase: testVaultPassphrase, isVaultKeyRememberedOnThisDevice: false })).endToEndVaultUnlockOutcome).toBe(
      'wrong-passphrase',
    )
    expect(await (await unlockTestVault(testVault, 'a brand new passphrase')).readVaultNoteText('Note.md')).toBe('kept')
    expect(await (expectUnlocked(await unlockPapelizEndToEndVaultWithRememberedKey(await findLockedTestVault(testVault)))).readVaultNoteText('Note.md')).toBe('kept')
  })
})

describe('making and finding End-to-end vaults', () => {
  it('needs an empty vault of its own and a long enough passphrase', async () => {
    const testVault = await createFolderOnDiskTestVault({ 'Already here.md': 'note' })
    expect(await makePapelizEndToEndVault({ newVaultOpenVault: makeTestOpenVault(testVault.openStoredVaultAdapter()), vaultPassphrase: testVaultPassphrase })).toEqual({
      endToEndVaultUnlockOutcome: 'failed',
      vaultEncryptionFailureCode: 'Vault Not Empty',
    })
    const emptyTestVault = await createFolderOnDiskTestVault({})
    expect(await makePapelizEndToEndVault({ newVaultOpenVault: makeTestOpenVault(emptyTestVault.openStoredVaultAdapter()), vaultPassphrase: 'too short' })).toEqual({
      endToEndVaultUnlockOutcome: 'failed',
      vaultEncryptionFailureCode: 'Passphrase Too Short',
    })
    const sampleVaultAdapter = new PapelizInMemoryVaultAdapter([])
    expect(canPapelizVaultAdapterBeEndToEnd(sampleVaultAdapter)).toBe(false)
    expect(await makePapelizEndToEndVault({ newVaultOpenVault: makeTestOpenVault(sampleVaultAdapter), vaultPassphrase: testVaultPassphrase })).toEqual({
      endToEndVaultUnlockOutcome: 'failed',
      vaultEncryptionFailureCode: 'Encryption Not Supported',
    })
  })

  it('reports an End-to-end vault as needing unlock, keeps its kind for Recent Vaults, and fails on a damaged settings file', async () => {
    const testVault = await createFolderOnDiskTestVault({})
    const endToEndVaultAdapter = await makeEndToEndTestVault(testVault)
    const lockedEndToEndVault = await findLockedTestVault(testVault)
    expect(lockedEndToEndVault).toMatchObject({ papelizVaultId: 'test-vault-row', papelizVaultDisplayName: 'Field Notes', papelizEncryptedVaultId: endToEndVaultAdapter.papelizEncryptedVaultId })
    expect((await readPapelizRecentVaultEncryptionKindRecords()).get('test-vault-row')).toEqual({
      papelizVaultId: 'test-vault-row',
      papelizVaultEncryptionKind: 'end-to-end',
      papelizEncryptedVaultId: endToEndVaultAdapter.papelizEncryptedVaultId,
    })

    const damagedTestVault = await createFolderOnDiskTestVault({ '.papeliz/vault-encryption.json': '{"papelizVaultEncryptionFormatVersion":1,"papelizVaultEncryptionKind":"end-to-end"}' })
    expect(await findPapelizLockedEndToEndVault({ openVaultOutcome: 'opened', papelizOpenVault: makeTestOpenVault(damagedTestVault.openStoredVaultAdapter()) })).toEqual({
      openVaultOutcome: 'failed',
      openVaultFailureMessage: `Couldn’t open “Field Notes”. ${describePapelizVaultEncryptionFailureCode('Encryption Settings Damaged')}`,
    })
    const newerTestVault = await createFolderOnDiskTestVault({ '.papeliz/vault-encryption.json': '{"papelizVaultEncryptionFormatVersion":2}' })
    expect(await readPapelizVaultEncryptionState(newerTestVault.openStoredVaultAdapter())).toEqual({ vaultEncryptionStateReadOutcome: 'failed', vaultEncryptionFailureCode: 'Made By Newer Papeliz' })
  })

  it('writes Import as a new vault’s files encrypted, at the vault’s top', async () => {
    const testVault = await createBrowserVaultTestVault({})
    const endToEndVaultAdapter = await makeEndToEndTestVault(testVault)
    await writePapelizVaultImportFilesIntoEndToEndVault(endToEndVaultAdapter, [createTestImportFile('Garden/Tomatoes.md', 'Water daily'), createTestImportFile('README.md', 'Read me')])
    expect(await listTreeEntries(endToEndVaultAdapter)).toEqual(['folder:Garden', 'note:Garden/Tomatoes.md', 'note:README.md'])
    expectNoPlainTextStored(await testVault.readStoredVaultFiles(), ['Garden', 'Tomatoes', 'Water daily', 'Read me'])
  })

  it('says a changed encrypted file is damaged, and keeps the rest of the vault open', async () => {
    const fakeVaultRootHandle = await createPapelizFakeVaultFolder('Field Notes', {})
    const testVault: PapelizEncryptionTestVault = {
      openStoredVaultAdapter: () => new PapelizFolderOnDiskVaultAdapter(fakeVaultRootHandle.asFileSystemDirectoryHandle()),
      readStoredVaultFiles: () => readPapelizFakeVaultFolder(fakeVaultRootHandle),
    }
    const endToEndVaultAdapter = await makeEndToEndTestVault(testVault)
    await endToEndVaultAdapter.createVaultNote('Good.md', 'good')
    await endToEndVaultAdapter.createVaultNote('Bad.md', 'bad')
    const encryptedFilesFolderHandle = await fakeVaultRootHandle.getDirectoryHandle('papeliz-encrypted-files')
    const encryptedFileHandles = [...encryptedFilesFolderHandle.fakeChildHandles.values()]
    const lastEncryptedFileHandle = encryptedFileHandles.at(-1)
    if (lastEncryptedFileHandle?.kind !== 'file') throw new Error('No encrypted file')
    const changedBytes = new Uint8Array(await lastEncryptedFileHandle.fakeFileContents.arrayBuffer())
    changedBytes[changedBytes.length - 1] = (changedBytes[changedBytes.length - 1] ?? 0) ^ 1
    lastEncryptedFileHandle.fakeFileContents = new Blob([changedBytes])
    const reopenedVaultAdapter = await unlockTestVault(testVault)
    expect(await listTreeEntries(reopenedVaultAdapter)).toEqual(['note:Bad.md', 'note:Good.md'])
    expect(await readFailureCode(reopenedVaultAdapter.readVaultNoteText('Bad.md'))).toBe('Encrypted File Damaged')
    expect(await reopenedVaultAdapter.readVaultNoteText('Good.md')).toBe('good')
  })
})

describe('Import as a new browser vault, End-to-end', () => {
  it('encrypts every file as it comes in, and takes the vault back whole when it can’t be made', async () => {
    const { browserVaultEnvironment, fakeOriginPrivateFileSystemRoot, fakeBrowserVaultRecordsById } = createPapelizFakeBrowserVaultEnvironment()
    const browserVaultImportPlan: PapelizBrowserVaultImportPlan = {
      suggestedBrowserVaultName: 'Garden',
      browserVaultImportFiles: [createTestImportFile('Beds/Tomatoes.md', 'Water daily'), createTestImportFile('README.md', 'Read me')],
      skippedImportFileCount: 0,
      importFileCount: 2,
      importTotalByteCount: 18,
    }
    const importedOpenVault = await importPapelizEndToEndBrowserVault('Garden', browserVaultImportPlan, { vaultPassphrase: testVaultPassphrase }, {}, browserVaultEnvironment)
    expect(await listTreeEntries(importedOpenVault.papelizVaultAdapter)).toEqual(['folder:Beds', 'note:Beds/Tomatoes.md', 'note:README.md'])
    expectNoPlainTextStored(await readPapelizFakeVaultFolder(await getPapelizFakeBrowserVaultFolder(fakeOriginPrivateFileSystemRoot, importedOpenVault.papelizVaultId)), [
      'Tomatoes',
      'Water daily',
      'Read me',
    ])

    await expect(importPapelizEndToEndBrowserVault('Too short', browserVaultImportPlan, { vaultPassphrase: 'short' }, {}, browserVaultEnvironment)).rejects.toThrow('Passphrase Too Short')
    expect([...fakeBrowserVaultRecordsById.values()].map((browserVaultRecord) => browserVaultRecord.papelizVaultDisplayName)).toEqual(['Garden'])
  })
})

describe('Remember on This Device', () => {
  it('on the web: seals the key by a non-extractable key, opens with it, and forgets it', async () => {
    const testVault = await createFolderOnDiskTestVault({})
    const endToEndVaultAdapter = await makeEndToEndTestVault(testVault)
    await endToEndVaultAdapter.createVaultNote('Note.md', 'remembered')
    const { papelizEncryptedVaultId } = endToEndVaultAdapter
    expect(await isPapelizVaultEncryptionKeyRememberedOnThisDevice(papelizEncryptedVaultId)).toBe(false)
    expect((await unlockPapelizEndToEndVaultWithRememberedKey(await findLockedTestVault(testVault))).endToEndVaultUnlockOutcome).toBe('key-not-remembered')

    const unlockResult = await unlockPapelizEndToEndVault(await findLockedTestVault(testVault), { vaultPassphrase: testVaultPassphrase, isVaultKeyRememberedOnThisDevice: true })
    expect(unlockResult).toMatchObject({ endToEndVaultUnlockOutcome: 'unlocked', isVaultKeyRememberedOnThisDevice: true })
    const rememberedKeyRecord = testDeviceRecordStore.rememberedKeyRecords.get(papelizEncryptedVaultId)
    expect(rememberedKeyRecord?.rememberingDeviceKey.extractable).toBe(false)
    expect(rememberedKeyRecord?.sealedVaultEncryptionKey.length).toBe(61)
    expect(await isPapelizVaultEncryptionKeyRememberedOnThisDevice(papelizEncryptedVaultId)).toBe(true)
    expect(await (expectUnlocked(await unlockPapelizEndToEndVaultWithRememberedKey(await findLockedTestVault(testVault)))).readVaultNoteText('Note.md')).toBe('remembered')

    expect(await forgetPapelizVaultEncryptionKeyOnThisDevice(papelizEncryptedVaultId)).toEqual({ vaultEncryptionActionOutcome: 'done' })
    expect(await isPapelizVaultEncryptionKeyRememberedOnThisDevice(papelizEncryptedVaultId)).toBe(false)
    expect((await unlockPapelizEndToEndVaultWithRememberedKey(await findLockedTestVault(testVault))).endToEndVaultUnlockOutcome).toBe('key-not-remembered')
  })

  it('forgets a remembered key that no longer opens the vault', async () => {
    const testVault = await createFolderOnDiskTestVault({})
    const { papelizEncryptedVaultId } = await makeEndToEndTestVault(testVault)
    const otherVaultAdapter = (await makeEndToEndTestVault(await createFolderOnDiskTestVault({}))) as PapelizEndToEndEncryptingVaultAdapter
    const otherVaultKeyBytes = otherVaultAdapter.readUnlockedVaultEncryptionKeyHolder().copyVaultEncryptionKeyBytes()
    if (otherVaultKeyBytes === null) throw new Error('No key')

    // Another vault's key, kept under this vault's ID: it unseals, but this vault's key check refuses it.
    await rememberPapelizVaultEncryptionKeyBytes(papelizEncryptedVaultId, otherVaultKeyBytes)
    expect(await unlockPapelizEndToEndVaultWithRememberedKey(await findLockedTestVault(testVault))).toEqual({
      endToEndVaultUnlockOutcome: 'failed',
      vaultEncryptionFailureCode: 'Remembered Key Wrong',
    })
    expect(await isPapelizVaultEncryptionKeyRememberedOnThisDevice(papelizEncryptedVaultId)).toBe(false)

    // A sealed copy moved from another vault's record doesn't even unseal: its seal names that vault.
    await rememberPapelizVaultEncryptionKeyOnThisDevice(otherVaultAdapter)
    const otherRememberedRecord = testDeviceRecordStore.rememberedKeyRecords.get(otherVaultAdapter.papelizEncryptedVaultId)
    if (otherRememberedRecord === undefined) throw new Error('Not remembered')
    testDeviceRecordStore.rememberedKeyRecords.set(papelizEncryptedVaultId, { ...otherRememberedRecord, papelizEncryptedVaultId })
    expect((await unlockPapelizEndToEndVaultWithRememberedKey(await findLockedTestVault(testVault))).endToEndVaultUnlockOutcome).toBe('key-not-remembered')
    expect(await isPapelizVaultEncryptionKeyRememberedOnThisDevice(papelizEncryptedVaultId)).toBe(false)
  })

  it('in Papeliz for Windows: goes through the desktop platform’s three calls', async () => {
    const desktopRememberedKeys = new Map<string, Uint8Array>()
    const desktopPlatform = {
      rememberDesktopVaultEncryptionKey: async (papelizVaultId: string, vaultEncryptionKeyBytes: Uint8Array) => void desktopRememberedKeys.set(papelizVaultId, vaultEncryptionKeyBytes.slice()),
      readRememberedDesktopVaultEncryptionKey: async (papelizVaultId: string) => desktopRememberedKeys.get(papelizVaultId)?.slice() ?? null,
      forgetRememberedDesktopVaultEncryptionKey: async (papelizVaultId: string) => void desktopRememberedKeys.delete(papelizVaultId),
    } as unknown as PapelizDesktopPlatform
    usePapelizVaultEncryptionDeviceStoreForTests(testDeviceRecordStore, desktopPlatform)
    const testVault = await createDesktopFolderTestVault({})
    const endToEndVaultAdapter = await makeEndToEndTestVault(testVault)
    await endToEndVaultAdapter.createVaultNote('Note.md', 'on Windows')
    expect(await rememberPapelizVaultEncryptionKeyOnThisDevice(endToEndVaultAdapter)).toEqual({ vaultEncryptionActionOutcome: 'done' })
    expect(desktopRememberedKeys.get(endToEndVaultAdapter.papelizEncryptedVaultId)?.length).toBe(32)
    // The ID the Windows key store is given fits what it takes: 1 to 128 ASCII letters, digits, hyphens
    // or underscores.
    for (const desktopKeyStoreVaultId of desktopRememberedKeys.keys()) expect(desktopKeyStoreVaultId).toMatch(/^[A-Za-z0-9_-]{1,128}$/)
    expect(testDeviceRecordStore.rememberedKeyRecords.size).toBe(0)
    expect(await (expectUnlocked(await unlockPapelizEndToEndVaultWithRememberedKey(await findLockedTestVault(testVault)))).readVaultNoteText('Note.md')).toBe('on Windows')
    await forgetPapelizVaultEncryptionKeyOnThisDevice(endToEndVaultAdapter.papelizEncryptedVaultId)
    expect(desktopRememberedKeys.size).toBe(0)
  })
})

describe('the words', () => {
  it('has a sentence for every failure code, and the wrong-passphrase line', () => {
    const vaultEncryptionFailureCodes: PapelizVaultEncryptionFailureCode[] = [
      'Passphrase Too Short',
      'Passphrases Differ',
      'Encryption Settings Damaged',
      'Made By Newer Papeliz',
      'Encrypted File Damaged',
      'Remembered Key Wrong',
      'Remember Not Available',
      'Vault Locked',
      'Vault Not Empty',
      'Already End-to-end',
      'Already Standard',
      'Encryption Not Supported',
      'Plain Write Refused',
      'Kind Change Stopped',
    ]
    for (const vaultEncryptionFailureCode of vaultEncryptionFailureCodes) expect(describePapelizVaultEncryptionFailureCode(vaultEncryptionFailureCode)).toMatch(/\.$/)
    expect(describePapelizVaultEncryptionFailureCode('Disk Full')).toBeNull()
    expect(describePapelizWrongVaultPassphrase('My Notes')).toBe('That passphrase doesn’t open My Notes.')
  })
})

// The vault's own adapter, failing every stored write after the first `allowedStoredWriteCount`, as a
// disk filling up would.
function failStoredWritesAfter(storedVaultAdapter: PapelizVaultAdapter, allowedStoredWriteCount: number): PapelizVaultAdapter {
  let storedWriteCount = 0
  return new Proxy(storedVaultAdapter, {
    get(proxiedVaultAdapter, vaultAdapterPropertyName, proxyReceiver) {
      const vaultAdapterProperty: unknown = Reflect.get(proxiedVaultAdapter, vaultAdapterPropertyName, proxyReceiver)
      if (typeof vaultAdapterProperty !== 'function') return vaultAdapterProperty
      if (vaultAdapterPropertyName !== 'writeStoredVaultFileBytes') return vaultAdapterProperty.bind(proxiedVaultAdapter)
      return async (...writeArguments: unknown[]) => {
        storedWriteCount += 1
        if (storedWriteCount > allowedStoredWriteCount) throw new DOMException('The disk is full.', 'QuotaExceededError')
        return (vaultAdapterProperty as (...keptArguments: unknown[]) => Promise<void>).apply(proxiedVaultAdapter, writeArguments)
      }
    },
  })
}
