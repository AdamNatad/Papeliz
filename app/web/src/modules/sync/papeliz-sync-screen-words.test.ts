import { describe, expect, it } from 'vitest'
import type { PapelizSyncStatusReading } from './papeliz-sync-engine-contract'
import {
  countPapelizSyncPassphraseCharacters,
  describePapelizSyncPlanLimitLines,
  describePapelizSyncPlanPrice,
  describePapelizSyncStatusForStatusBar,
  describePapelizSyncStoragePlaceLine,
  formatPapelizSyncByteSize,
  groupPapelizSyncRecoveryKeyText,
  isPapelizSyncPassphraseLongEnough,
  pickNearestPapelizSyncStoragePlace,
  ratePapelizSyncPassphraseStrength,
  tidyPapelizSyncRecoveryKeyText,
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

describe('the Recovery Key', () => {
  it('reads back in any case, with or without dashes and spaces', () => {
    expect(tidyPapelizSyncRecoveryKeyText(' abcd-efgh jkmn-pqrs tvwx-yz23 ')).toBe('ABCDEFGHJKMNPQRSTVWXYZ23')
  })

  it('shows in six groups of four', () => {
    expect(groupPapelizSyncRecoveryKeyText('ABCD-EFGH-JKMN-PQRS-TVWX-YZ23')).toBe('ABCD EFGH JKMN PQRS TVWX YZ23')
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
  it('lists the visible limits in decimal units, as the plans count them', () => {
    expect(
      describePapelizSyncPlanLimitLines({
        syncStorageByteLimit: 100e9,
        syncedVaultLimit: 20,
        syncFilesPerVaultLimit: 250_000,
        syncLargestFileByteLimit: 1e9,
        syncNoteHistoryMonthCount: 24,
        syncAttachmentHistoryDayCount: 30,
        syncConnectedDeviceLimit: 20,
      }),
    ).toEqual(['100 GB, old versions included', '20 vaults · files up to 1 GB', '24 months of versions'])
    expect(formatPapelizSyncByteSize(24.31e9)).toBe('24.3 GB')
    expect(formatPapelizSyncByteSize(512)).toBe('512 B')
  })

  it('shows the price exactly as the engine gives it, with the period added', () => {
    expect(describePapelizSyncPlanPrice('0.00 XTS', 'monthly')).toBe('0.00 XTS a month')
    expect(describePapelizSyncPlanPrice('0.00 XTS', 'yearly')).toBe('0.00 XTS a year')
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

  it('counts a first upload as it goes', () => {
    expect(describePapelizSyncStatusForStatusBar({ syncStatusKind: 'syncing', syncingFileCount: 1362 }, 120, 1482, testCurrentTime).syncStatusWord).toBe('Syncing 120 of 1,482…')
  })
})
