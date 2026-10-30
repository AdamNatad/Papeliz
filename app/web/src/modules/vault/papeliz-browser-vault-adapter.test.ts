import { describe, expect, it, vi } from 'vitest'
import { describePapelizDirectoryHandleVaultAdapterCases, papelizDirectoryHandleTestVaultFiles } from './papeliz-directory-handle-vault-adapter.test-support'
import { createPapelizBrowserVault, openPapelizBrowserVault, readPapelizBrowserVaultRecord } from './papeliz-browser-vaults'
import {
  createPapelizFakeBrowserVaultEnvironment,
  getPapelizFakeBrowserVaultFolder,
  type PapelizFakeBrowserVaultEnvironmentOptions,
} from './papeliz-fake-browser-vault-environment.test-support'
import { addPapelizFakeVaultFiles, readPapelizFakeVaultFolder } from './papeliz-fake-file-system-access.test-support'
import { buildPapelizBrowserVaultOpenLockName } from './papeliz-browser-vault-locks'

async function createTestBrowserVault(fakeEnvironmentOptions: PapelizFakeBrowserVaultEnvironmentOptions = {}) {
  const fakeBrowserVaultSetup = createPapelizFakeBrowserVaultEnvironment(fakeEnvironmentOptions)
  const { browserVaultEnvironment, fakeOriginPrivateFileSystemRoot } = fakeBrowserVaultSetup
  const browserVaultRecord = await createPapelizBrowserVault('Field Notes', browserVaultEnvironment)
  const fakeVaultRootHandle = await getPapelizFakeBrowserVaultFolder(fakeOriginPrivateFileSystemRoot, browserVaultRecord.papelizVaultId)
  await addPapelizFakeVaultFiles(fakeVaultRootHandle, papelizDirectoryHandleTestVaultFiles)
  const openVaultResult = await openPapelizBrowserVault(browserVaultRecord, browserVaultEnvironment)
  if (openVaultResult.openVaultOutcome !== 'opened') throw new Error('The test vault didn’t open.')
  return { ...fakeBrowserVaultSetup, browserVaultRecord, fakeVaultRootHandle, browserVaultAdapter: openVaultResult.papelizOpenVault.papelizVaultAdapter }
}

describePapelizDirectoryHandleVaultAdapterCases('a browser vault written with createWritable()', async () => {
  const { fakeVaultRootHandle, browserVaultAdapter } = await createTestBrowserVault()
  return { fakeVaultRootHandle, directoryHandleVaultAdapter: browserVaultAdapter as never }
})

describePapelizDirectoryHandleVaultAdapterCases('a browser vault written through a worker (Safari before 26)', async () => {
  const { fakeVaultRootHandle, browserVaultAdapter } = await createTestBrowserVault({ isWritableStreamMissing: true })
  return { fakeVaultRootHandle, directoryHandleVaultAdapter: browserVaultAdapter as never }
})

describe('a browser vault', () => {
  it('is a browser vault, kept in its own folder named by its id', async () => {
    const { browserVaultAdapter, browserVaultRecord, fakeOriginPrivateFileSystemRoot } = await createTestBrowserVault()
    expect(browserVaultAdapter.papelizVaultKind).toBe('browser-vault-in-opfs')
    const vaultFolderContents = await readPapelizFakeVaultFolder(fakeOriginPrivateFileSystemRoot)
    expect(JSON.parse(vaultFolderContents[`papeliz-browser-vaults/${browserVaultRecord.papelizVaultId}/.papeliz/browser-vault.json`] ?? '')).toMatchObject({
      papelizBrowserVaultName: 'Field Notes',
    })
  })

  it('writes through a sync access handle where createWritable() is missing, and lets go of the file', async () => {
    const { browserVaultAdapter, fakeVaultRootHandle } = await createTestBrowserVault({ isWritableStreamMissing: true })
    await browserVaultAdapter.writeVaultNoteText('Inbox.md', '# Inbox\n\nFrom Safari.')
    const inboxFileHandle = await fakeVaultRootHandle.getFileHandle('Inbox.md')
    expect(await inboxFileHandle.fakeFileContents.text()).toBe('# Inbox\n\nFrom Safari.')
    expect(inboxFileHandle.syncAccessHandleOpenCount).toBe(1)
    expect(inboxFileHandle.isFakeFileLockedBySyncAccessHandle).toBe(false)
  })

  it('says the browser’s storage is full, not the disk', async () => {
    for (const isWritableStreamMissing of [false, true]) {
      const { browserVaultAdapter, fakeVaultRootHandle } = await createTestBrowserVault({ isWritableStreamMissing })
      ;(await fakeVaultRootHandle.getFileHandle('Inbox.md')).shouldFailNextWriteClose = true
      await expect(browserVaultAdapter.writeVaultNoteText('Inbox.md', 'too much')).rejects.toThrow('Browser Storage Full')
      expect(await browserVaultAdapter.readVaultNoteText('Inbox.md')).toBe('# Inbox')
    }
  })

  it('notes the first change after the last backup, and only the first', async () => {
    const { browserVaultAdapter, browserVaultRecord, browserVaultEnvironment, fakeClock } = await createTestBrowserVault()
    expect((await readPapelizBrowserVaultRecord(browserVaultRecord.papelizVaultId, browserVaultEnvironment))?.papelizBrowserVaultFirstChangeSinceBackupAt).toBeNull()
    const firstChangeTime = fakeClock.fakeCurrentTime
    await browserVaultAdapter.writeVaultNoteText('Inbox.md', 'first')
    await vi.waitFor(async () =>
      expect((await readPapelizBrowserVaultRecord(browserVaultRecord.papelizVaultId, browserVaultEnvironment))?.papelizBrowserVaultFirstChangeSinceBackupAt).toBe(firstChangeTime),
    )
    fakeClock.fakeCurrentTime += 60_000
    await browserVaultAdapter.createVaultFolder('Later')
    await new Promise((resolveWait) => setTimeout(resolveWait, 10))
    expect((await readPapelizBrowserVaultRecord(browserVaultRecord.papelizVaultId, browserVaultEnvironment))?.papelizBrowserVaultFirstChangeSinceBackupAt).toBe(firstChangeTime)
  })

  it('runs one change at a time across tabs, under its writes lock', async () => {
    const { browserVaultAdapter } = await createTestBrowserVault()
    const changeSteps: string[] = []
    let finishFirstChange: () => void = () => undefined
    const firstChange = browserVaultAdapter.runVaultChangeExclusively!(async () => {
      changeSteps.push('first starts')
      await new Promise<void>((resolveFirstChange) => {
        finishFirstChange = resolveFirstChange
      })
      changeSteps.push('first ends')
    })
    const secondChange = browserVaultAdapter.runVaultChangeExclusively!(async () => {
      changeSteps.push('second starts')
    })
    await new Promise((resolveWait) => setTimeout(resolveWait, 10))
    expect(changeSteps).toEqual(['first starts'])
    finishFirstChange()
    await Promise.all([firstChange, secondChange])
    expect(changeSteps).toEqual(['first starts', 'first ends', 'second starts'])
  })

  it('holds its open lock until the workspace closes it', async () => {
    const { browserVaultAdapter, browserVaultRecord, fakeLockManager } = await createTestBrowserVault()
    const browserVaultOpenLockName = buildPapelizBrowserVaultOpenLockName(browserVaultRecord.papelizVaultId)
    await vi.waitFor(async () => expect((await fakeLockManager.query()).held.map((heldLock) => heldLock.name)).toContain(browserVaultOpenLockName))
    browserVaultAdapter.closeVaultAdapter!()
    await vi.waitFor(async () => expect((await fakeLockManager.query()).held.map((heldLock) => heldLock.name)).not.toContain(browserVaultOpenLockName))
  })
})
