// Test support only: everything a browser vault reaches outside itself, in memory. The Origin
// Private File System is a fake folder (papeliz-fake-file-system-access.test-support.ts), the list of
// browser vaults a map, Web Locks a fake lock manager that grants in order as browsers do, and the
// clock moves only when a test says so. One environment can serve several "tabs".

import { createPapelizBrowserVaultFileContentsWriter } from './papeliz-browser-vault-file-writer'
import type { PapelizBrowserVaultLockManager, PapelizBrowserVaultLockMode } from './papeliz-browser-vault-locks'
import { writePapelizVaultFileThroughSyncAccessHandle, type PapelizFileHandleWithSyncAccess } from './papeliz-browser-vault-sync-access-write'
import type { PapelizBrowserVaultEnvironment, PapelizBrowserVaultRecord } from './papeliz-browser-vaults'
import { PapelizFakeDirectoryHandle } from './papeliz-fake-file-system-access.test-support'

interface PapelizFakeHeldLock {
  fakeLockName: string
  fakeLockMode: PapelizBrowserVaultLockMode
}

interface PapelizFakeWaitingLockRequest extends PapelizFakeHeldLock {
  grantFakeLock: () => void
}

export class PapelizFakeLockManager implements PapelizBrowserVaultLockManager {
  readonly fakeHeldLocks: PapelizFakeHeldLock[] = []
  private readonly fakeWaitingLockRequests: PapelizFakeWaitingLockRequest[] = []

  private canGrantFakeLock(fakeLockName: string, fakeLockMode: PapelizBrowserVaultLockMode): boolean {
    const heldLocksOfName = this.fakeHeldLocks.filter((fakeHeldLock) => fakeHeldLock.fakeLockName === fakeLockName)
    return fakeLockMode === 'exclusive' ? heldLocksOfName.length === 0 : heldLocksOfName.every((fakeHeldLock) => fakeHeldLock.fakeLockMode === 'shared')
  }

  private grantWaitingFakeLocks(): void {
    const blockedFakeLockNames = new Set<string>()
    for (const fakeWaitingLockRequest of [...this.fakeWaitingLockRequests]) {
      if (blockedFakeLockNames.has(fakeWaitingLockRequest.fakeLockName)) continue
      if (!this.canGrantFakeLock(fakeWaitingLockRequest.fakeLockName, fakeWaitingLockRequest.fakeLockMode)) {
        blockedFakeLockNames.add(fakeWaitingLockRequest.fakeLockName)
        continue
      }
      this.fakeWaitingLockRequests.splice(this.fakeWaitingLockRequests.indexOf(fakeWaitingLockRequest), 1)
      fakeWaitingLockRequest.grantFakeLock()
    }
  }

  async request<LockedTaskResult>(
    fakeLockName: string,
    fakeLockOptions: { mode: PapelizBrowserVaultLockMode },
    lockedTask: () => Promise<LockedTaskResult>,
  ): Promise<LockedTaskResult> {
    const fakeHeldLock: PapelizFakeHeldLock = { fakeLockName, fakeLockMode: fakeLockOptions.mode }
    await new Promise<void>((resolveFakeLockGrant) => {
      this.fakeWaitingLockRequests.push({
        ...fakeHeldLock,
        grantFakeLock: () => {
          this.fakeHeldLocks.push(fakeHeldLock)
          resolveFakeLockGrant()
        },
      })
      this.grantWaitingFakeLocks()
    })
    try {
      return await lockedTask()
    } finally {
      this.fakeHeldLocks.splice(this.fakeHeldLocks.indexOf(fakeHeldLock), 1)
      this.grantWaitingFakeLocks()
    }
  }

  async query(): Promise<{ held: Array<{ name: string; mode: PapelizBrowserVaultLockMode }> }> {
    return { held: this.fakeHeldLocks.map((fakeHeldLock) => ({ name: fakeHeldLock.fakeLockName, mode: fakeHeldLock.fakeLockMode })) }
  }
}

export interface PapelizFakeBrowserVaultEnvironmentOptions {
  // Safari before 26: no createWritable(), so files go through sync access handles.
  isWritableStreamMissing?: boolean
}

export function createPapelizFakeBrowserVaultEnvironment(fakeEnvironmentOptions: PapelizFakeBrowserVaultEnvironmentOptions = {}) {
  const fakeOriginPrivateFileSystemRoot = new PapelizFakeDirectoryHandle('')
  const fakeBrowserVaultRecordsById = new Map<string, PapelizBrowserVaultRecord>()
  const fakeLockManager = new PapelizFakeLockManager()
  const fakeClock = { fakeCurrentTime: 1_800_000_000_000 }
  let nextFakePapelizVaultNumber = 1
  const browserVaultEnvironment: PapelizBrowserVaultEnvironment = {
    browserVaultRecordStore: {
      readAllBrowserVaultRecords: async () => [...fakeBrowserVaultRecordsById.values()].map((browserVaultRecord) => ({ ...browserVaultRecord })),
      readBrowserVaultRecord: async (papelizVaultId) => {
        const browserVaultRecord = fakeBrowserVaultRecordsById.get(papelizVaultId)
        return browserVaultRecord === undefined ? undefined : { ...browserVaultRecord }
      },
      putBrowserVaultRecord: async (browserVaultRecord) => {
        fakeBrowserVaultRecordsById.set(browserVaultRecord.papelizVaultId, { ...browserVaultRecord })
      },
      deleteBrowserVaultRecord: async (papelizVaultId) => {
        fakeBrowserVaultRecordsById.delete(papelizVaultId)
      },
    },
    getOriginPrivateFileSystemRoot: async () => fakeOriginPrivateFileSystemRoot.asFileSystemDirectoryHandle(),
    browserVaultLockManager: fakeLockManager,
    vaultFileContentsWriter: createPapelizBrowserVaultFileContentsWriter(
      fakeEnvironmentOptions.isWritableStreamMissing === true
        ? {
            isWritableStreamOnFileHandle: () => false,
            // The worker's own write, run in place.
            writeVaultFileThroughWorker: (vaultFileHandle, vaultFileBytes) =>
              writePapelizVaultFileThroughSyncAccessHandle(vaultFileHandle as unknown as PapelizFileHandleWithSyncAccess, vaultFileBytes),
          }
        : {},
    ),
    createPapelizVaultId: () => `fake-browser-vault-${nextFakePapelizVaultNumber++}`,
    readCurrentTime: () => fakeClock.fakeCurrentTime,
  }
  return { browserVaultEnvironment, fakeOriginPrivateFileSystemRoot, fakeBrowserVaultRecordsById, fakeLockManager, fakeClock }
}

// The vault's own fake folder: `papeliz-browser-vaults/<papelizVaultId>/`.
export async function getPapelizFakeBrowserVaultFolder(fakeOriginPrivateFileSystemRoot: PapelizFakeDirectoryHandle, papelizVaultId: string): Promise<PapelizFakeDirectoryHandle> {
  return (await fakeOriginPrivateFileSystemRoot.getDirectoryHandle('papeliz-browser-vaults')).getDirectoryHandle(papelizVaultId)
}
