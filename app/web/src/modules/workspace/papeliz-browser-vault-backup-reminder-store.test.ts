import { describe, expect, it } from 'vitest'
import { papelizBrowserVaultDefaultBackupReminderIntervalMinutes, type PapelizBrowserVaultRecord } from '../vault/papeliz-browser-vaults'
import { isPapelizBrowserVaultBackupOverdue, isPapelizBrowserVaultBackupReminderDue } from './papeliz-browser-vault-backup-reminder-store'

const minuteMilliseconds = 60_000

function createTestBrowserVaultRecord(browserVaultRecordChanges: Partial<PapelizBrowserVaultRecord> = {}): PapelizBrowserVaultRecord {
  return {
    papelizVaultId: 'reminder-test-vault',
    papelizVaultDisplayName: 'Field Notes',
    papelizBrowserVaultCreatedAt: 0,
    papelizVaultLastOpenedAt: 0,
    papelizVaultHiddenAt: null,
    papelizBrowserVaultLastBackupAt: null,
    papelizBrowserVaultFirstChangeSinceBackupAt: null,
    papelizBrowserVaultBackupReminderOn: true,
    papelizBrowserVaultBackupReminderIntervalMinutes: papelizBrowserVaultDefaultBackupReminderIntervalMinutes,
    papelizBrowserVaultBackupReminderShownAt: null,
    ...browserVaultRecordChanges,
  }
}

describe('the backup reminder', () => {
  it('never nags a vault with no changes since its last backup', () => {
    expect(isPapelizBrowserVaultBackupReminderDue(createTestBrowserVaultRecord(), 1000 * minuteMilliseconds)).toBe(false)
    expect(isPapelizBrowserVaultBackupOverdue(createTestBrowserVaultRecord(), 1000 * minuteMilliseconds)).toBe(false)
  })

  it('is due once the interval has passed since the first change', () => {
    const changedBrowserVaultRecord = createTestBrowserVaultRecord({ papelizBrowserVaultFirstChangeSinceBackupAt: 0 })
    expect(isPapelizBrowserVaultBackupReminderDue(changedBrowserVaultRecord, 29 * minuteMilliseconds)).toBe(false)
    expect(isPapelizBrowserVaultBackupReminderDue(changedBrowserVaultRecord, 30 * minuteMilliseconds)).toBe(true)
    expect(isPapelizBrowserVaultBackupOverdue(changedBrowserVaultRecord, 30 * minuteMilliseconds)).toBe(true)
  })

  it('waits another interval after it showed, while Backup due stays', () => {
    const shownBrowserVaultRecord = createTestBrowserVaultRecord({
      papelizBrowserVaultFirstChangeSinceBackupAt: 0,
      papelizBrowserVaultBackupReminderShownAt: 30 * minuteMilliseconds,
      papelizBrowserVaultBackupReminderIntervalMinutes: 30,
    })
    expect(isPapelizBrowserVaultBackupReminderDue(shownBrowserVaultRecord, 45 * minuteMilliseconds)).toBe(false)
    expect(isPapelizBrowserVaultBackupOverdue(shownBrowserVaultRecord, 45 * minuteMilliseconds)).toBe(true)
    expect(isPapelizBrowserVaultBackupReminderDue(shownBrowserVaultRecord, 60 * minuteMilliseconds)).toBe(true)
  })

  it('follows the chosen interval, and stays quiet when turned off', () => {
    const tenMinuteBrowserVaultRecord = createTestBrowserVaultRecord({ papelizBrowserVaultFirstChangeSinceBackupAt: 0, papelizBrowserVaultBackupReminderIntervalMinutes: 10 })
    expect(isPapelizBrowserVaultBackupReminderDue(tenMinuteBrowserVaultRecord, 10 * minuteMilliseconds)).toBe(true)
    const turnedOffBrowserVaultRecord = { ...tenMinuteBrowserVaultRecord, papelizBrowserVaultBackupReminderOn: false }
    expect(isPapelizBrowserVaultBackupReminderDue(turnedOffBrowserVaultRecord, 600 * minuteMilliseconds)).toBe(false)
    expect(isPapelizBrowserVaultBackupOverdue(turnedOffBrowserVaultRecord, 600 * minuteMilliseconds)).toBe(false)
  })
})
