import { describe, expect, it } from 'vitest'
import type { PapelizSyncStatusReading } from './papeliz-sync-engine-contract'
import {
  countPapelizSyncPassphraseCharacters,
  describePapelizSyncFileCount,
  describePapelizSyncMissingFilesNotice,
  describePapelizSyncOldVersionCount,
  describePapelizSyncOldVersionDeletion,
  describePapelizSyncOldVersionSpace,
  describePapelizSyncPlanCardLine,
  describePapelizSyncPlanDetailLines,
  describePapelizSyncPlanPrice,
  describePapelizSyncStatusForStatusBar,
  describePapelizSyncStoragePlaceLine,
  describePapelizSyncVaultPassphraseChangedElsewhere,
  formatPapelizSyncByteSize,
  introducePapelizSyncMissingFilesDialog,
  isPapelizSyncPassphraseLongEnough,
  papelizSyncMissingFilesDialogWords,
  papelizSyncOldVersionAgeChoices,
  papelizSyncVaultEncryptionKindDisplayNames,
  papelizSyncVaultEncryptionKindReaderLines,
  papelizSyncVaultNameReadableLine,
  papelizSyncVaultPassphraseChangeCurrentAskedLine,
  papelizSyncVaultPassphraseChangeIntro,
  papelizSyncVaultPassphraseNotRecoverableLine,
  pickNearestPapelizSyncStoragePlace,
  ratePapelizSyncPassphraseStrength,
  titlePapelizSyncMissingFilesDeleteConfirm,
  titlePapelizSyncMissingFilesDialog,
} from './papeliz-sync-screen-words'

const testCurrentTime = new Date(2026, 9, 30, 15, 0).getTime()

describe('the Sync passphrase rule', () => {
  it('needs 12 characters, counted after NFC as the engine counts them', () => {
    expect(isPapelizSyncPassphraseLongEnough('eleven-char')).toBe(false)
    expect(isPapelizSyncPassphraseLongEnough('twelve-chars')).toBe(true)
    // "é" typed as e + a combining accent is one character once composed.
    const decomposedAccentedPassphrase = 'é'.repeat(11)
    expect(decomposedAccentedPassphrase.length).toBe(22)
    expect(countPapelizSyncPassphraseCharacters(decomposedAccentedPassphrase)).toBe(11)
    expect(isPapelizSyncPassphraseLongEnough(decomposedAccentedPassphrase)).toBe(false)
    expect(isPapelizSyncPassphraseLongEnough(`${decomposedAccentedPassphrase}x`)).toBe(true)
    // A character outside the Basic Multilingual Plane counts once, not as two UTF-16 units.
    expect(isPapelizSyncPassphraseLongEnough('🌊'.repeat(11))).toBe(false)
    expect(isPapelizSyncPassphraseLongEnough('🌊'.repeat(12))).toBe(true)
  })

  it('rates longer and more varied passphrases higher, and anything under the minimum as too short', () => {
    expect(ratePapelizSyncPassphraseStrength('short')).toBe(0)
    expect(ratePapelizSyncPassphraseStrength('aaaaaaaaaaaa')).toBe(1)
    expect(ratePapelizSyncPassphraseStrength('maple river cloud lantern')).toBe(4)
    expect(ratePapelizSyncPassphraseStrength('Maple7river!')).toBe(3)
  })
})

describe('encryption, vault by vault', () => {
  it('names both kinds and says plainly who can read each one', () => {
    expect(papelizSyncVaultEncryptionKindDisplayNames).toEqual({ standard: 'Standard', 'end-to-end': 'End-to-end' })
    expect(papelizSyncVaultEncryptionKindReaderLines.standard).toContain('Papeliz keeps the key, so it could read them')
    expect(papelizSyncVaultEncryptionKindReaderLines['end-to-end']).toContain('Papeliz never sees it')
  })

  it('says what Change passphrase keeps, and asks the current one, or the newer one set elsewhere, when needed', () => {
    expect(papelizSyncVaultPassphraseChangeIntro).toContain('Devices that already have this vault keep working')
    expect(papelizSyncVaultPassphraseChangeIntro).toContain('a new device asks the new passphrase')
    expect(papelizSyncVaultPassphraseChangeCurrentAskedLine).toContain('current passphrase')
    expect(describePapelizSyncVaultPassphraseChangedElsewhere(true)).toContain('Enter the passphrase it set as the current one')
    expect(describePapelizSyncVaultPassphraseChangedElsewhere(false)).toContain('Try again to set yours')
  })

  it('says the vault name is readable, and that an End-to-end passphrase can’t be recovered', () => {
    expect(papelizSyncVaultNameReadableLine).toContain('isn’t encrypted')
    expect(papelizSyncVaultPassphraseNotRecoverableLine).toMatch(/^Papeliz can’t recover it\./)
  })
})

describe('the storage place', () => {
  it('ticks the place nearest the time zone, with no request', () => {
    expect(pickNearestPapelizSyncStoragePlace('Asia/Manila', 8 * 60)).toBe('apac')
    expect(pickNearestPapelizSyncStoragePlace('Asia/Kolkata', 5.5 * 60)).toBe('apac')
    expect(pickNearestPapelizSyncStoragePlace('Asia/Dubai', 4 * 60)).toBe('eu')
    expect(pickNearestPapelizSyncStoragePlace('Europe/Berlin', 60)).toBe('eu')
    expect(pickNearestPapelizSyncStoragePlace('Africa/Lagos', 60)).toBe('eu')
    expect(pickNearestPapelizSyncStoragePlace('America/New_York', -5 * 60)).toBe('enam')
    expect(pickNearestPapelizSyncStoragePlace('America/Chicago', -6 * 60)).toBe('enam')
    expect(pickNearestPapelizSyncStoragePlace('America/Denver', -7 * 60)).toBe('wnam')
    expect(pickNearestPapelizSyncStoragePlace('America/Los_Angeles', -8 * 60)).toBe('wnam')
    expect(pickNearestPapelizSyncStoragePlace('Pacific/Honolulu', -10 * 60)).toBe('wnam')
    expect(pickNearestPapelizSyncStoragePlace('Australia/Sydney', 10 * 60)).toBe('oc')
    expect(pickNearestPapelizSyncStoragePlace('Pacific/Auckland', 12 * 60)).toBe('oc')
    expect(pickNearestPapelizSyncStoragePlace('Etc/UTC', 0)).toBeNull()
  })

  it('says "guaranteed" only for Europe', () => {
    expect(describePapelizSyncStoragePlaceLine('eu')).toBe('Stored in Europe, guaranteed to stay in the European Union')
    expect(describePapelizSyncStoragePlaceLine('apac')).toBe('Stored in Asia-Pacific')
    expect(describePapelizSyncStoragePlaceLine('wnam')).not.toContain('guaranteed')
  })
})

describe('the plans', () => {
  const examplePaidPlanLimits = {
    syncStorageByteLimit: 100e9,
    syncedVaultLimit: 5,
    syncFilesPerVaultLimit: 250_000,
    syncLargestFileByteLimit: 1e9,
    syncNoteHistoryMonthCount: 12,
    syncNoteHistoryDayCount: 360,
    syncAttachmentHistoryDayCount: 14,
    syncConnectedDeviceLimit: 20,
  }
  const exampleFreePlanLimits = {
    syncStorageByteLimit: 10e6,
    syncedVaultLimit: 1,
    syncFilesPerVaultLimit: 10_000,
    syncLargestFileByteLimit: 5e6,
    syncNoteHistoryMonthCount: 0,
    syncNoteHistoryDayCount: 7,
    syncAttachmentHistoryDayCount: 7,
    syncConnectedDeviceLimit: 2,
  }

  it('puts the synced vaults on the card, with a capital V and no storage', () => {
    expect(describePapelizSyncPlanCardLine(examplePaidPlanLimits)).toBe('5 Vaults · Version History')
    expect(describePapelizSyncPlanCardLine(exampleFreePlanLimits)).toBe('1 Vault · Version History')
  })

  it('lists the details in the plan’s tooltip, in decimal units, as the plans count them', () => {
    expect(describePapelizSyncPlanDetailLines(examplePaidPlanLimits)).toEqual([
      '100 GB of storage.',
      '5 synced vaults.',
      'Up to 20 devices.',
      'Files up to 1 GB each.',
      'Notes keep 12 months of version history.',
      'Attachments keep 2 weeks of version history.',
    ])
    expect(describePapelizSyncPlanDetailLines({ ...exampleFreePlanLimits, syncConnectedDeviceLimit: 1 })).toEqual([
      '10 MB of storage.',
      '1 synced vault.',
      'Up to 1 device.',
      'Files up to 5 MB each.',
      'Notes keep 7 days of version history.',
      'Attachments keep 7 days of version history.',
    ])
    expect(describePapelizSyncPlanDetailLines({ ...examplePaidPlanLimits, syncNoteHistoryMonthCount: 1, syncNoteHistoryDayCount: 30 })).toContain(
      'Notes keep 1 month of version history.',
    )
    expect(formatPapelizSyncByteSize(24.31e9)).toBe('24.3 GB')
    expect(formatPapelizSyncByteSize(512)).toBe('512 B')
  })

  it('counts files the same way everywhere: "1 file", "2 files"', () => {
    expect(describePapelizSyncFileCount(0)).toBe('0 files')
    expect(describePapelizSyncFileCount(1)).toBe('1 file')
    expect(describePapelizSyncFileCount(1482)).toBe('1,482 files')
  })

  it('shows the price exactly as the engine gives it, with the period added', () => {
    expect(describePapelizSyncPlanPrice('0.00 XTS', 'monthly')).toBe('0.00 XTS a month')
    expect(describePapelizSyncPlanPrice('0.00 XTS', 'yearly')).toBe('0.00 XTS a month, billed yearly')
  })
})

describe('the status bar', () => {
  const describeStatus = (syncVaultStatus: PapelizSyncStatusReading) => describePapelizSyncStatusForStatusBar(syncVaultStatus, null, null, testCurrentTime)

  it('has a word for every sync state', () => {
    expect(describeStatus({ syncStatusKind: 'synced', syncLastSyncedAt: testCurrentTime - 5 * 60_000 })).toMatchObject({
      syncStatusWord: 'Synced',
      syncStatusTitle: 'Synced 5 minutes ago',
      isSyncStatusAttention: false,
    })
    expect(describeStatus({ syncStatusKind: 'syncing', syncingFileCount: 3 }).syncStatusWord).toBe('Syncing 3…')
    expect(describeStatus({ syncStatusKind: 'offline', syncWaitingFileCount: 2 }).syncStatusWord).toBe('Offline · 2 waiting')
    expect(describeStatus({ syncStatusKind: 'offline', syncWaitingFileCount: 0 }).syncStatusWord).toBe('Offline')
    expect(describeStatus({ syncStatusKind: 'to-settle', syncClashToSettleCount: 1 })).toMatchObject({ syncStatusWord: 'Sync: 1 to settle', isSyncStatusAttention: true })
    expect(describeStatus({ syncStatusKind: 'paused-on-this-device', syncWaitingFileCount: 4 }).syncStatusWord).toBe('Sync paused')
    expect(describeStatus({ syncStatusKind: 'subscription-ended', syncReadOnlyUntil: testCurrentTime + 86_400_000 })).toMatchObject({
      syncStatusWord: 'Sync ended',
      isSyncStatusAttention: true,
    })
    expect(describeStatus({ syncStatusKind: 'locked' })).toMatchObject({ syncStatusWord: 'Sync locked', isSyncStatusAttention: true })
    expect(describeStatus({ syncStatusKind: 'signed-out' })).toMatchObject({ syncStatusWord: 'Sync signed out', isSyncStatusAttention: true })
  })

  it('names why changes wait, and promises none are lost', () => {
    const waitingStatus = (syncWaitingReason: Extract<PapelizSyncStatusReading, { syncStatusKind: 'waiting' }>['syncWaitingReason'], syncResumesAt: number | null = null) =>
      describeStatus({ syncStatusKind: 'waiting', syncWaitingFileCount: 12, syncWaitingReason, syncResumesAt })
    expect(waitingStatus('pacing-to-allowance').syncStatusWord).toBe('12 waiting')
    expect(waitingStatus('limit-reached', testCurrentTime + 10 * 60_000).syncStatusWord).toMatch(/^Sync resumes /)
    expect(waitingStatus('over-storage')).toMatchObject({ syncStatusWord: 'Sync: storage full', isSyncStatusAttention: true })
    expect(waitingStatus('paused-for-maintenance')).toMatchObject({ syncStatusWord: 'Sync paused', isSyncStatusAttention: false })
    expect(waitingStatus('account-paused')).toMatchObject({ syncStatusWord: 'Sync paused', isSyncStatusAttention: true })
    for (const syncWaitingReason of ['pacing-to-allowance', 'limit-reached', 'over-storage', 'paused-for-maintenance', 'account-paused'] as const) {
      expect(waitingStatus(syncWaitingReason).syncStatusTitle).toContain('none are lost')
    }
  })

  it('says how many synced files are missing here, and that they are still on Sync', () => {
    expect(describeStatus({ syncStatusKind: 'files-missing', syncMissingFileCount: 14 })).toEqual({
      syncStatusIconKind: 'files-missing',
      syncStatusWord: 'Sync: 14 missing',
      syncStatusTitle: '14 synced files are missing from this device. They’re still on Sync, and nothing is deleted until you choose what to do.',
      isSyncStatusAttention: true,
    })
    expect(describeStatus({ syncStatusKind: 'files-missing', syncMissingFileCount: 1 }).syncStatusTitle).toMatch(/^1 synced file is missing/)
  })

  it('counts a first upload as it goes', () => {
    expect(describePapelizSyncStatusForStatusBar({ syncStatusKind: 'syncing', syncingFileCount: 1362 }, 120, 1482, testCurrentTime).syncStatusWord).toBe('Syncing 120 of 1,482…')
  })
})

describe('the missing-files dialog', () => {
  it('says the files are still on Sync and what each choice does', () => {
    expect(titlePapelizSyncMissingFilesDialog(14)).toBe('14 Synced Files Are Missing Here')
    expect(titlePapelizSyncMissingFilesDialog(1)).toBe('1 Synced File Is Missing Here')
    expect(introducePapelizSyncMissingFilesDialog(14, 'Field Notes')).toBe('They were gone from “Field Notes” when it opened on this device. They’re still on Sync, and nothing has been deleted.')
    expect(introducePapelizSyncMissingFilesDialog(1, 'Field Notes')).toBe('It was gone from “Field Notes” when it opened on this device. It’s still on Sync, and nothing has been deleted.')
    expect(papelizSyncMissingFilesDialogWords.downloadAgainChoiceText).toBe('puts them back on this device, from Sync.')
    expect(papelizSyncMissingFilesDialogWords.deletedChoiceText).toBe('removes them from Sync and from your other devices, which move them to their trash.')
    expect(titlePapelizSyncMissingFilesDeleteConfirm(14)).toBe('Delete 14 Files from Sync?')
    expect(describePapelizSyncMissingFilesNotice(2, 'Field Notes')).toBe('2 synced files are missing from “Field Notes” on this device. They’re still on Sync, and nothing is deleted until you choose.')
  })
})

describe('Free Up Space and deleting old versions', () => {
  it('offers over 30 days, over 90 days, over a year and all, and says what each deletes and frees before it is confirmed', () => {
    expect(papelizSyncOldVersionAgeChoices.map((ageChoice) => [ageChoice.oldVersionAgeChoiceLabel, ageChoice.syncOldVersionsOlderThanDayCount])).toEqual([
      ['Over 30 Days', 30],
      ['Over 90 Days', 90],
      ['Over a Year', 365],
      ['All', null],
    ])
    expect(describePapelizSyncOldVersionSpace({ syncOldVersionCount: 260, syncFreedStoredByteLength: 21.3e6 }, 30)).toBe(
      'Deletes 260 old versions saved more than 30 days ago and frees 21.3 MB.',
    )
    expect(describePapelizSyncOldVersionSpace({ syncOldVersionCount: 1, syncFreedStoredByteLength: 2048 }, 365)).toBe('Deletes 1 old version saved more than a year ago and frees 2 KB.')
    expect(describePapelizSyncOldVersionSpace({ syncOldVersionCount: 412, syncFreedStoredByteLength: 38.4e6 }, null)).toBe('Deletes all 412 old versions and frees 38.4 MB.')
    expect(describePapelizSyncOldVersionSpace({ syncOldVersionCount: 0, syncFreedStoredByteLength: 0 }, 90)).toBe('There are no old versions saved more than 90 days ago to delete.')
    // Contents another file still holds stay.
    expect(describePapelizSyncOldVersionSpace({ syncOldVersionCount: 3, syncFreedStoredByteLength: 0 }, null)).toBe(
      'Deletes all 3 old versions. Other files still hold the same contents, so this frees no storage.',
    )
  })

  it('says what a delete did', () => {
    expect(describePapelizSyncOldVersionDeletion({ syncOldVersionCount: 260, syncFreedStoredByteLength: 21.3e6 })).toBe('Freed 21.3 MB: 260 old versions deleted.')
    expect(describePapelizSyncOldVersionDeletion({ syncOldVersionCount: 0, syncFreedStoredByteLength: 0 })).toBe('There were no old versions to delete.')
    expect(describePapelizSyncOldVersionDeletion({ syncOldVersionCount: 2, syncFreedStoredByteLength: 0 })).toBe(
      'Deleted 2 old versions. Other files still hold the same contents, so no storage was freed.',
    )
    expect(describePapelizSyncOldVersionCount(1)).toBe('1 old version')
  })
})
