import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { holdPapelizMdViewVaultMediaUrl } from '../md-view/papeliz-md-view-vault-media-files'
import { createPapelizFakeVaultFolder } from '../vault/papeliz-fake-file-system-access.test-support'
import { PapelizFolderOnDiskVaultAdapter } from '../vault/papeliz-folder-on-disk-vault-adapter'
import type { PapelizOpenVault } from '../vault/papeliz-open-vault'
import { makePapelizEndToEndVault, type PapelizEndToEndVaultAdapter } from '../vault/papeliz-vault-encryption'
import {
  usePapelizVaultEncryptionDeviceStoreForTests,
  type PapelizRecentVaultEncryptionKindRecord,
  type PapelizRememberedVaultEncryptionKeyRecord,
} from '../vault/papeliz-vault-encryption-device-store'
import { usePapelizVaultArgon2idSettingsForTests } from '../vault/papeliz-vault-encryption-passphrase-key'
import { usePapelizWorkspaceStore } from './papeliz-workspace-store'

// An End-to-end vault in the workspace: its open tabs and recovery copies of unsaved typing never go
// to the browser's database (they're note names and text in plain), Lock Now saves, closes and locks
// it and asks the start screen for its Unlock, and MD View's pictures are revoked as it locks. A
// Standard vault beside it still remembers both. Argon2id runs with small settings here.

// What the workspace hands the browser's database, kept here in place of it.
const browserDatabaseTestWrites = vi.hoisted(() => ({ rememberedNoteTabPaths: [] as string[], recoveryDraftNotePaths: [] as string[] }))

vi.mock('../vault/papeliz-remembered-note-tabs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../vault/papeliz-remembered-note-tabs')>()),
  readPapelizRememberedNoteTabs: async () => null,
  writePapelizRememberedNoteTabs: async (...[, rememberedNoteTabRelativePaths]: [string, readonly string[]]) => {
    browserDatabaseTestWrites.rememberedNoteTabPaths.push(...rememberedNoteTabRelativePaths)
  },
}))

vi.mock('./papeliz-note-recovery-drafts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./papeliz-note-recovery-drafts')>()),
  readPapelizNoteRecoveryDraft: async () => null,
  writePapelizNoteRecoveryDraft: async (...[, vaultNoteRelativePath]: [string, string]) => {
    browserDatabaseTestWrites.recoveryDraftNotePaths.push(vaultNoteRelativePath)
  },
}))

const testVaultPassphrase = 'correct horse battery staple'

beforeEach(() => {
  browserDatabaseTestWrites.rememberedNoteTabPaths.length = 0
  browserDatabaseTestWrites.recoveryDraftNotePaths.length = 0
  usePapelizVaultArgon2idSettingsForTests({ argon2idMemoryKibibytes: 64, argon2idPassCount: 1, argon2idParallelism: 1 })
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
})

afterEach(async () => {
  await usePapelizWorkspaceStore.getState().closeVaultInWorkspace()
  usePapelizWorkspaceStore.getState().takeLockedEndToEndVaultForUnlock()
  usePapelizVaultArgon2idSettingsForTests(null)
  usePapelizVaultEncryptionDeviceStoreForTests(null)
  vi.restoreAllMocks()
})

async function makeTestFolderVault(papelizVaultDisplayName: string): Promise<PapelizOpenVault> {
  const fakeVaultRootHandle = await createPapelizFakeVaultFolder(papelizVaultDisplayName, {})
  return {
    papelizVaultId: `test-${papelizVaultDisplayName}`,
    papelizVaultDisplayName,
    papelizVaultAdapter: new PapelizFolderOnDiskVaultAdapter(fakeVaultRootHandle.asFileSystemDirectoryHandle()),
  }
}

async function makeTestEndToEndVault(papelizVaultDisplayName: string): Promise<PapelizOpenVault & { papelizVaultAdapter: PapelizEndToEndVaultAdapter }> {
  const endToEndVaultMakeResult = await makePapelizEndToEndVault({ newVaultOpenVault: await makeTestFolderVault(papelizVaultDisplayName), vaultPassphrase: testVaultPassphrase })
  if (endToEndVaultMakeResult.endToEndVaultUnlockOutcome !== 'unlocked') throw new Error(`The vault wasn’t made: ${JSON.stringify(endToEndVaultMakeResult)}`)
  return endToEndVaultMakeResult.papelizOpenVault
}

async function openInWorkspaceAndType(papelizOpenVault: PapelizOpenVault, vaultNoteRelativePath: string, typedVaultNoteText: string) {
  if (vaultNoteRelativePath.includes('/')) await papelizOpenVault.papelizVaultAdapter.createVaultFolder(vaultNoteRelativePath.slice(0, vaultNoteRelativePath.lastIndexOf('/')))
  await papelizOpenVault.papelizVaultAdapter.createVaultNote(vaultNoteRelativePath, '# Plan\n')
  await usePapelizWorkspaceStore.getState().openVaultInWorkspace(papelizOpenVault, { firstVaultNoteRelativePathToOpen: vaultNoteRelativePath, firstNoteViewMode: 'md-code', expandAllTopLevelFolders: false })
  const loadedVaultNote = usePapelizWorkspaceStore.getState().loadedVaultNotesByRelativePath[vaultNoteRelativePath]
  if (loadedVaultNote === undefined) throw new Error(`${vaultNoteRelativePath} didn’t open`)
  // Typing on for longer than two seconds: autosave waits for a pause, and a recovery copy is written at
  // least every two seconds meanwhile.
  for (let typedCharacterCount = 1; typedCharacterCount <= typedVaultNoteText.length; typedCharacterCount += Math.ceil(typedVaultNoteText.length / 9)) {
    usePapelizWorkspaceStore.getState().updateVaultNoteDraftText(loadedVaultNote.loadedNoteSessionId, typedVaultNoteText.slice(0, typedCharacterCount))
    await new Promise((resolveWait) => setTimeout(resolveWait, 300))
  }
  usePapelizWorkspaceStore.getState().updateVaultNoteDraftText(loadedVaultNote.loadedNoteSessionId, typedVaultNoteText)
}

describe('what an End-to-end vault keeps outside itself', () => {
  it('remembers no tabs and writes no recovery copy in the browser, while a Standard vault does', { timeout: 20_000 }, async () => {
    await openInWorkspaceAndType(await makeTestFolderVault('Standard Notes'), 'Projects/Plan.md', '# Plan\n\nThe secret garden.')
    expect(browserDatabaseTestWrites.rememberedNoteTabPaths).toContain('Projects/Plan.md')
    expect(browserDatabaseTestWrites.recoveryDraftNotePaths).toContain('Projects/Plan.md')
    await usePapelizWorkspaceStore.getState().closeVaultInWorkspace()

    browserDatabaseTestWrites.rememberedNoteTabPaths.length = 0
    browserDatabaseTestWrites.recoveryDraftNotePaths.length = 0
    await openInWorkspaceAndType(await makeTestEndToEndVault('Private Notes'), 'Projects/Plan.md', '# Plan\n\nThe secret garden.')
    expect(usePapelizWorkspaceStore.getState().activeVaultNoteRelativePath).toBe('Projects/Plan.md')
    expect(browserDatabaseTestWrites.rememberedNoteTabPaths).toEqual([])
    expect(browserDatabaseTestWrites.recoveryDraftNotePaths).toEqual([])
  })
})

describe('Lock Now', () => {
  it('saves every note, closes the vault, drops its key and asks the start screen for its Unlock', async () => {
    const privateOpenVault = await makeTestEndToEndVault('Private Notes')
    await openInWorkspaceAndType(privateOpenVault, 'Plan.md', '# Plan\n\nSaved before the lock.')
    await usePapelizWorkspaceStore.getState().lockOpenEndToEndVault()

    expect(usePapelizWorkspaceStore.getState().openVault).toBeNull()
    expect(usePapelizWorkspaceStore.getState().loadedVaultNotesByRelativePath).toEqual({})
    expect(privateOpenVault.papelizVaultAdapter.isEndToEndVaultLocked()).toBe(true)
    expect(usePapelizWorkspaceStore.getState().takeLockedEndToEndVaultForUnlock()).toEqual({ papelizVaultId: 'test-Private Notes', papelizVaultDisplayName: 'Private Notes' })
    // Taken once: the start screen shows it a single time.
    expect(usePapelizWorkspaceStore.getState().takeLockedEndToEndVaultForUnlock()).toBeNull()
  })

  it('does nothing in a Standard vault', async () => {
    const standardOpenVault = await makeTestFolderVault('Standard Notes')
    await usePapelizWorkspaceStore.getState().openVaultInWorkspace(standardOpenVault, { firstVaultNoteRelativePathToOpen: null, firstNoteViewMode: 'md-code', expandAllTopLevelFolders: false })
    await usePapelizWorkspaceStore.getState().lockOpenEndToEndVault()
    expect(usePapelizWorkspaceStore.getState().openVault).toBe(standardOpenVault)
    expect(usePapelizWorkspaceStore.getState().lockedEndToEndVaultForUnlock).toBeNull()
  })
})

describe('MD View’s pictures in an End-to-end vault', () => {
  it('are decrypted into blob URLs that are revoked the moment the vault locks', async () => {
    const createdObjectUrls: string[] = []
    const revokedObjectUrls: string[] = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      createdObjectUrls.push(`blob:papeliz-test/${createdObjectUrls.length + 1}`)
      return createdObjectUrls.at(-1) ?? ''
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((revokedObjectUrl) => void revokedObjectUrls.push(revokedObjectUrl))
    const privateOpenVault = await makeTestEndToEndVault('Picture Notes')
    await privateOpenVault.papelizVaultAdapter.createVaultAttachmentFile('plan.png', new Blob([new Uint8Array([137, 80, 78, 71])]))

    const vaultMediaUrlHold = holdPapelizMdViewVaultMediaUrl(privateOpenVault.papelizVaultAdapter, 'plan.png', null)
    const heldVaultMediaUrl = await vaultMediaUrlHold.vaultMediaUrlPromise
    expect(heldVaultMediaUrl).toMatch(/^blob:/)
    expect(revokedObjectUrls).not.toContain(heldVaultMediaUrl)

    // Still held by the picture on screen, it is revoked as the vault locks, not 20 seconds after.
    privateOpenVault.papelizVaultAdapter.lockEndToEndVault()
    await vi.waitFor(() => expect(revokedObjectUrls).toContain(heldVaultMediaUrl))
    vaultMediaUrlHold.releaseVaultMediaUrl()
  })
})
