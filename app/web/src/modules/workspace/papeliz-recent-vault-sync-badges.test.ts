import { describe, expect, it } from 'vitest'
import type { PapelizSyncEngineSnapshot, PapelizSyncSignInReading } from '../sync/papeliz-sync-engine-contract'
import { readPapelizRecentVaultSyncEncryptionKinds } from './papeliz-recent-vault-sync-badges'

function createTestSyncEngineSnapshot(syncSignIn: PapelizSyncSignInReading): PapelizSyncEngineSnapshot {
  return {
    syncSignIn,
    syncAccount: null,
    isSyncPausedOnThisDevice: false,
    syncWhatSyncsChoices: { isAssistantChatSyncOn: true, isAppSettingSyncOn: true },
    syncLocalVaults: [],
    syncLinkedLocalVaults: [
      { papelizVaultId: 'work-vault', papelizSyncVaultId: 'pzvault_work', syncVaultEncryptionKind: 'standard', syncVaultLockState: 'unlocked', isFirstDownloadUnfinished: false },
      { papelizVaultId: 'journal-vault', papelizSyncVaultId: 'pzvault_journal', syncVaultEncryptionKind: 'end-to-end', syncVaultLockState: 'locked', isFirstDownloadUnfinished: false },
    ],
    syncNoteClashesToSettle: [],
  }
}

const testSignedInReading: PapelizSyncSignInReading = {
  syncSignInKind: 'signed-in',
  papelizSyncAccountId: 'pzacct_test',
  papelizSyncDeviceId: 'pzdev_test',
  syncSignInEmailAddress: null,
  syncSignInMethod: null,
}

describe('the Recent Vaults sync badges', () => {
  it('calls every vault Local on a device that has never used Sync, without the engine', () => {
    expect(readPapelizRecentVaultSyncEncryptionKinds({ isPapelizSyncExpectedOnThisDevice: false, syncEngineSnapshot: null })).toEqual(new Map())
  })

  it('shows no badge while the engine loads on a device that uses Sync', () => {
    expect(readPapelizRecentVaultSyncEncryptionKinds({ isPapelizSyncExpectedOnThisDevice: true, syncEngineSnapshot: null })).toBeNull()
  })

  it('reads the linked vaults and their kinds while signed in', () => {
    expect(readPapelizRecentVaultSyncEncryptionKinds({ isPapelizSyncExpectedOnThisDevice: true, syncEngineSnapshot: createTestSyncEngineSnapshot(testSignedInReading) })).toEqual(
      new Map([
        ['work-vault', 'standard'],
        ['journal-vault', 'end-to-end'],
      ]),
    )
  })

  it('calls every vault Local while this device is signed out of Sync', () => {
    expect(readPapelizRecentVaultSyncEncryptionKinds({ isPapelizSyncExpectedOnThisDevice: true, syncEngineSnapshot: createTestSyncEngineSnapshot({ syncSignInKind: 'device-removed' }) })).toEqual(
      new Map(),
    )
  })
})
