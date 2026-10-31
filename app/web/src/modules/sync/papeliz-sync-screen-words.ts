import type {
  PapelizSyncActionFailureKind,
  PapelizSyncActionOutcome,
  PapelizSyncBillingPeriod,
  PapelizSyncPlanName,
  PapelizSyncSignInMethod,
  PapelizSyncStatusReading,
  PapelizSyncStoragePlace,
  PapelizSyncVisiblePlanLimits,
  PapelizSyncWaitingReason,
} from './papeliz-sync-engine-contract'

// The words Papeliz Sync's screens use, kept apart from the screens so tests can read them.

export const papelizSyncPlanDisplayNames: Record<PapelizSyncPlanName, string> = {
  standard: 'Standard',
  plus: 'Plus',
  pro: 'Pro',
}

export const papelizSyncSignInMethodDisplayNames: Record<PapelizSyncSignInMethod, string> = {
  'email-code': 'Signed in with an email code',
  google: 'Signed in with Google',
  apple: 'Signed in with Apple',
}

export interface PapelizSyncStoragePlaceDescription {
  papelizSyncStoragePlace: PapelizSyncStoragePlace
  storagePlaceDisplayName: string
  // Only the EU is a guarantee (its jurisdiction); the others are where the data is made and stays.
  isStoragePlaceGuaranteed: boolean
}

export const papelizSyncStoragePlaceDescriptions: readonly PapelizSyncStoragePlaceDescription[] = [
  { papelizSyncStoragePlace: 'enam', storagePlaceDisplayName: 'North America, East', isStoragePlaceGuaranteed: false },
  { papelizSyncStoragePlace: 'wnam', storagePlaceDisplayName: 'North America, West', isStoragePlaceGuaranteed: false },
  { papelizSyncStoragePlace: 'eu', storagePlaceDisplayName: 'Europe', isStoragePlaceGuaranteed: true },
  { papelizSyncStoragePlace: 'apac', storagePlaceDisplayName: 'Asia-Pacific', isStoragePlaceGuaranteed: false },
  { papelizSyncStoragePlace: 'oc', storagePlaceDisplayName: 'Oceania', isStoragePlaceGuaranteed: false },
]

export function describePapelizSyncStoragePlace(papelizSyncStoragePlace: PapelizSyncStoragePlace): PapelizSyncStoragePlaceDescription {
  return (
    papelizSyncStoragePlaceDescriptions.find((storagePlaceDescription) => storagePlaceDescription.papelizSyncStoragePlace === papelizSyncStoragePlace) ?? {
      papelizSyncStoragePlace,
      storagePlaceDisplayName: papelizSyncStoragePlace,
      isStoragePlaceGuaranteed: false,
    }
  )
}

// "Stored in Asia-Pacific"; Europe says what it promises.
export function describePapelizSyncStoragePlaceLine(papelizSyncStoragePlace: PapelizSyncStoragePlace): string {
  const storagePlaceDescription = describePapelizSyncStoragePlace(papelizSyncStoragePlace)
  return storagePlaceDescription.isStoragePlaceGuaranteed
    ? `Stored in ${storagePlaceDescription.storagePlaceDisplayName}, guaranteed to stay in the European Union`
    : `Stored in ${storagePlaceDescription.storagePlaceDisplayName}`
}

// The place nearest to the browser's time zone, worked out on the device with no request. The
// standard-time offset (minutes east of UTC, as in winter) splits the Americas and Asia. Null when
// the zone says nothing about where the device is (UTC, say): then no place is ticked.
export function pickNearestPapelizSyncStoragePlace(ianaTimeZoneName: string, standardUtcOffsetMinutesEast: number): PapelizSyncStoragePlace | null {
  const timeZoneArea = ianaTimeZoneName.split('/')[0]
  if (timeZoneArea === 'Europe' || timeZoneArea === 'Africa' || timeZoneArea === 'Atlantic') return 'eu'
  if (timeZoneArea === 'America' || timeZoneArea === 'US' || timeZoneArea === 'Canada') return standardUtcOffsetMinutesEast <= -7 * 60 ? 'wnam' : 'enam'
  if (timeZoneArea === 'Asia') return standardUtcOffsetMinutesEast >= 5 * 60 ? 'apac' : 'eu'
  if (timeZoneArea === 'Indian') return 'apac'
  if (timeZoneArea === 'Australia' || timeZoneArea === 'Antarctica') return 'oc'
  if (timeZoneArea === 'Pacific') return standardUtcOffsetMinutesEast < 0 ? 'wnam' : 'oc'
  return null
}

// The browser's own time zone, read with no request.
export function pickNearestPapelizSyncStoragePlaceForThisDevice(): PapelizSyncStoragePlace | null {
  const ianaTimeZoneName = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
  const thisYear = new Date().getFullYear()
  // getTimezoneOffset counts minutes west of UTC; standard time has the larger of the two.
  const standardUtcOffsetMinutesWest = Math.max(new Date(thisYear, 0, 1).getTimezoneOffset(), new Date(thisYear, 6, 1).getTimezoneOffset())
  return pickNearestPapelizSyncStoragePlace(ianaTimeZoneName, -standardUtcOffsetMinutesWest)
}

// Sizes in decimal units, as the plans count them: "10 GB", "24.3 GB", "512 KB".
export function formatPapelizSyncByteSize(syncByteLength: number): string {
  const byteSizeUnits = ['B', 'KB', 'MB', 'GB', 'TB'] as const
  let byteSizeValue = Math.max(0, syncByteLength)
  let byteSizeUnitIndex = 0
  while (byteSizeValue >= 1000 && byteSizeUnitIndex < byteSizeUnits.length - 1) {
    byteSizeValue /= 1000
    byteSizeUnitIndex += 1
  }
  const roundedByteSizeValue = byteSizeUnitIndex === 0 || byteSizeValue >= 100 ? Math.round(byteSizeValue) : Math.round(byteSizeValue * 10) / 10
  return `${roundedByteSizeValue.toLocaleString('en-US')} ${byteSizeUnits[byteSizeUnitIndex]}`
}

// A plan's visible limits as the plan list shows them, three lines.
export function describePapelizSyncPlanLimitLines(syncVisiblePlanLimits: PapelizSyncVisiblePlanLimits): string[] {
  return [
    `${formatPapelizSyncByteSize(syncVisiblePlanLimits.syncStorageByteLimit)}, old versions included`,
    `${syncVisiblePlanLimits.syncedVaultLimit.toLocaleString('en-US')} vaults · files up to ${formatPapelizSyncByteSize(syncVisiblePlanLimits.syncLargestFileByteLimit)}`,
    `${syncVisiblePlanLimits.syncNoteHistoryMonthCount} months of versions`,
  ]
}

// The engine's formatted price, shown as it is, with the period added.
export function describePapelizSyncPlanPrice(syncDisplayPrice: string, syncBillingPeriod: PapelizSyncBillingPeriod): string {
  return `${syncDisplayPrice} ${syncBillingPeriod === 'monthly' ? 'a month' : 'a year'}`
}

const papelizSyncDayFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const papelizSyncDayWithYearFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const papelizSyncClockFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

// "Nov 30", or "Nov 30, 2027" in another year.
export function describePapelizSyncDay(syncTime: number, currentTime: number): string {
  return new Date(syncTime).getFullYear() === new Date(currentTime).getFullYear() ? papelizSyncDayFormat.format(syncTime) : papelizSyncDayWithYearFormat.format(syncTime)
}

// "3:10 PM" today, otherwise "Nov 30, 3:10 PM".
export function describePapelizSyncClockTime(syncTime: number, currentTime: number): string {
  const syncClockTime = papelizSyncClockFormat.format(syncTime)
  return new Date(syncTime).toDateString() === new Date(currentTime).toDateString() ? syncClockTime : `${describePapelizSyncDay(syncTime, currentTime)}, ${syncClockTime}`
}

// "just now", "5 minutes ago", "3 hours ago", "Yesterday", "Oct 29".
export function describePapelizSyncTimeAgo(syncTime: number, currentTime: number): string {
  const elapsedMilliseconds = Math.max(0, currentTime - syncTime)
  if (elapsedMilliseconds < 60_000) return 'just now'
  const elapsedMinutes = Math.floor(elapsedMilliseconds / 60_000)
  if (elapsedMinutes < 60) return elapsedMinutes === 1 ? '1 minute ago' : `${elapsedMinutes} minutes ago`
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24 && new Date(syncTime).toDateString() === new Date(currentTime).toDateString()) return elapsedHours === 1 ? '1 hour ago' : `${elapsedHours} hours ago`
  const yesterdayAtThisTime = new Date(currentTime)
  yesterdayAtThisTime.setDate(yesterdayAtThisTime.getDate() - 1)
  if (new Date(syncTime).toDateString() === yesterdayAtThisTime.toDateString()) return 'Yesterday'
  return describePapelizSyncDay(syncTime, currentTime)
}

function countWithNoun(itemCount: number, singularNoun: string, pluralNoun: string): string {
  return `${itemCount.toLocaleString('en-US')} ${itemCount === 1 ? singularNoun : pluralNoun}`
}

// What the status bar shows for the open vault: an icon, one word (icon only below 640 px) and a
// longer title. The attention states are underlined, like the save state's Settle.
export type PapelizSyncStatusIconKind = 'synced' | 'syncing' | 'offline' | 'waiting' | 'attention' | 'paused' | 'locked'

export interface PapelizSyncStatusBarDescription {
  syncStatusIconKind: PapelizSyncStatusIconKind
  syncStatusWord: string
  syncStatusTitle: string
  isSyncStatusAttention: boolean
}

function describeSyncWaitingReason(syncWaitingReason: PapelizSyncWaitingReason, syncResumesAt: number | null, currentTime: number): string {
  if (syncWaitingReason === 'pacing-to-allowance') return 'Sync is pacing itself to your plan’s allowance, so changes go up a little later.'
  if (syncWaitingReason === 'limit-reached')
    return syncResumesAt === null ? 'Your plan’s limit for now is reached.' : `Your plan’s limit for now is reached. Sync resumes at ${describePapelizSyncClockTime(syncResumesAt, currentTime)}.`
  if (syncWaitingReason === 'over-storage') return 'Your Sync storage is full, so uploads are paused. Downloads go on.'
  if (syncWaitingReason === 'paused-for-maintenance') return 'Papeliz paused uploads for maintenance for a while.'
  return 'Papeliz paused uploads for this account.'
}

export function describePapelizSyncStatusForStatusBar(
  syncVaultStatus: PapelizSyncStatusReading,
  syncTransferredFileCount: number | null,
  syncTransferFileCount: number | null,
  currentTime: number,
): PapelizSyncStatusBarDescription {
  const savedHereLine = 'Your changes are saved on this device and go up later; none are lost.'
  switch (syncVaultStatus.syncStatusKind) {
    case 'synced':
      return {
        syncStatusIconKind: 'synced',
        syncStatusWord: 'Synced',
        syncStatusTitle:
          syncVaultStatus.syncLastSyncedAt === null ? 'Synced' : `Synced ${describePapelizSyncTimeAgo(syncVaultStatus.syncLastSyncedAt, currentTime)}`,
        isSyncStatusAttention: false,
      }
    case 'syncing': {
      const isFirstTransferShown = syncTransferredFileCount !== null && syncTransferFileCount !== null && syncTransferFileCount > 0
      return {
        syncStatusIconKind: 'syncing',
        syncStatusWord: isFirstTransferShown
          ? `Syncing ${syncTransferredFileCount.toLocaleString('en-US')} of ${syncTransferFileCount.toLocaleString('en-US')}…`
          : `Syncing ${syncVaultStatus.syncingFileCount.toLocaleString('en-US')}…`,
        syncStatusTitle: isFirstTransferShown
          ? `Syncing: ${syncTransferredFileCount.toLocaleString('en-US')} of ${countWithNoun(syncTransferFileCount, 'file', 'files')}`
          : `Syncing ${countWithNoun(syncVaultStatus.syncingFileCount, 'file', 'files')}`,
        isSyncStatusAttention: false,
      }
    }
    case 'offline':
      return {
        syncStatusIconKind: 'offline',
        syncStatusWord: syncVaultStatus.syncWaitingFileCount > 0 ? `Offline · ${syncVaultStatus.syncWaitingFileCount.toLocaleString('en-US')} waiting` : 'Offline',
        syncStatusTitle: syncVaultStatus.syncWaitingFileCount > 0 ? `Offline. ${savedHereLine}` : 'Offline. Sync goes on when this device is back online.',
        isSyncStatusAttention: false,
      }
    case 'waiting': {
      const isWaitingForAttention = syncVaultStatus.syncWaitingReason === 'over-storage' || syncVaultStatus.syncWaitingReason === 'account-paused'
      const syncWaitingWord =
        syncVaultStatus.syncWaitingReason === 'over-storage'
          ? 'Sync: storage full'
          : syncVaultStatus.syncWaitingReason === 'limit-reached' && syncVaultStatus.syncResumesAt !== null
            ? `Sync resumes ${describePapelizSyncClockTime(syncVaultStatus.syncResumesAt, currentTime)}`
            : syncVaultStatus.syncWaitingReason === 'paused-for-maintenance' || syncVaultStatus.syncWaitingReason === 'account-paused'
              ? 'Sync paused'
              : `${syncVaultStatus.syncWaitingFileCount.toLocaleString('en-US')} waiting`
      return {
        syncStatusIconKind: isWaitingForAttention ? 'attention' : 'waiting',
        syncStatusWord: syncWaitingWord,
        syncStatusTitle: `${describeSyncWaitingReason(syncVaultStatus.syncWaitingReason, syncVaultStatus.syncResumesAt, currentTime)} ${savedHereLine}`,
        isSyncStatusAttention: isWaitingForAttention,
      }
    }
    case 'to-settle':
      return {
        syncStatusIconKind: 'attention',
        syncStatusWord: `Sync: ${syncVaultStatus.syncClashToSettleCount.toLocaleString('en-US')} to settle`,
        syncStatusTitle: `${countWithNoun(syncVaultStatus.syncClashToSettleCount, 'note was', 'notes were')} changed on two devices in the same lines. Open Sync to settle.`,
        isSyncStatusAttention: true,
      }
    case 'paused-on-this-device':
      return {
        syncStatusIconKind: 'paused',
        syncStatusWord: 'Sync paused',
        syncStatusTitle:
          syncVaultStatus.syncWaitingFileCount > 0
            ? `Sync is paused on this device. ${countWithNoun(syncVaultStatus.syncWaitingFileCount, 'change waits', 'changes wait')} here until you resume it.`
            : 'Sync is paused on this device.',
        isSyncStatusAttention: false,
      }
    case 'subscription-ended':
      return {
        syncStatusIconKind: 'attention',
        syncStatusWord: 'Sync ended',
        syncStatusTitle:
          syncVaultStatus.syncReadOnlyUntil === null
            ? 'Your Sync subscription ended. Your notes on this device are untouched.'
            : `Your Sync subscription ended. The synced copy can be read until ${describePapelizSyncDay(syncVaultStatus.syncReadOnlyUntil, currentTime)}; your notes on this device are untouched.`,
        isSyncStatusAttention: true,
      }
    case 'locked':
      return {
        syncStatusIconKind: 'locked',
        syncStatusWord: 'Sync locked',
        syncStatusTitle: 'Enter your Sync passphrase on this device to sync.',
        isSyncStatusAttention: true,
      }
    case 'signed-out':
      return {
        syncStatusIconKind: 'offline',
        syncStatusWord: 'Sync signed out',
        syncStatusTitle: 'This device is signed out of Sync. Sign in again to sync; your notes here are untouched.',
        isSyncStatusAttention: true,
      }
  }
}

// Each failure in the screen's own words.
const papelizSyncActionFailureWords: Record<PapelizSyncActionFailureKind, string> = {
  offline: 'You’re offline. Try again once you’re back online.',
  'signed-out': 'Sign in to Papeliz Sync first.',
  'fresh-sign-in-required': 'Sign in again to confirm it’s you.',
  locked: 'Unlock Sync on this device first.',
  'subscription-required': 'This needs a Papeliz Sync subscription.',
  'read-only': 'Your subscription ended, so Sync can only be read.',
  'limit-reached': 'Your plan’s limit is reached.',
  'wrong-passphrase': 'That passphrase doesn’t open your synced notes.',
  'wrong-recovery-key': 'That Recovery Key doesn’t open your synced notes.',
  'passphrase-too-short': 'Use at least 12 characters.',
  'changed-elsewhere': 'Another device changed this first. Try again.',
  'not-found': 'That isn’t there any more.',
  'service-error': 'Papeliz Sync didn’t answer. Try again in a moment.',
}

export function describePapelizSyncActionFailure(failedOutcome: Extract<PapelizSyncActionOutcome<unknown>, { syncActionOutcome: 'failed' }>, currentTime: number): string {
  const failureWords = papelizSyncActionFailureWords[failedOutcome.syncActionFailureKind]
  return failedOutcome.syncRetryAt === null ? failureWords : `${failureWords} Try again at ${describePapelizSyncClockTime(failedOutcome.syncRetryAt, currentTime)}.`
}

// The same, at the moment it failed: for a click's or a call's outcome, not for drawing.
export function describePapelizSyncActionFailureNow(failedOutcome: Extract<PapelizSyncActionOutcome<unknown>, { syncActionOutcome: 'failed' }>): string {
  return describePapelizSyncActionFailure(failedOutcome, Date.now())
}

// The passphrase rule: at least 12 characters, counted after NFC, as the engine counts them.
export const papelizSyncMinimumPassphraseCharacterCount = 12

export function countPapelizSyncPassphraseCharacters(syncPassphrase: string): number {
  return [...syncPassphrase.normalize('NFC')].length
}

export function isPapelizSyncPassphraseLongEnough(syncPassphrase: string): boolean {
  return countPapelizSyncPassphraseCharacters(syncPassphrase) >= papelizSyncMinimumPassphraseCharacterCount
}

// A rough strength for the meter: 0 under the minimum, then 1 to 4 for length and variety. It only
// guides; the minimum is the one rule.
export function ratePapelizSyncPassphraseStrength(syncPassphrase: string): 0 | 1 | 2 | 3 | 4 {
  const passphraseCharacterCount = countPapelizSyncPassphraseCharacters(syncPassphrase)
  if (passphraseCharacterCount < papelizSyncMinimumPassphraseCharacterCount) return 0
  const passphraseCharacterKindCount = [/\p{Ll}/u, /\p{Lu}/u, /\p{N}/u, /[^\p{L}\p{N}]/u].filter((characterKindPattern) => characterKindPattern.test(syncPassphrase)).length
  const hasSeveralWords = syncPassphrase.trim().split(/\s+/).length >= 4
  if (passphraseCharacterCount >= 24 || (passphraseCharacterCount >= 18 && (hasSeveralWords || passphraseCharacterKindCount >= 3))) return 4
  if (passphraseCharacterCount >= 16 || passphraseCharacterKindCount >= 3) return 3
  return passphraseCharacterKindCount >= 2 ? 2 : 1
}

export const papelizSyncPassphraseStrengthWords = ['Too short. Use 12 characters or more.', 'Weak', 'Fair', 'Good', 'Strong'] as const

// A Recovery Key as typed or pasted: any case, with or without dashes or spaces.
export function tidyPapelizSyncRecoveryKeyText(typedRecoveryKeyText: string): string {
  return typedRecoveryKeyText.replace(/[\s-]+/g, '').toUpperCase()
}

// "7H3Q K9WD P2MX 4TBR VN6C 8JFE": the engine's text, shown in groups of four.
export function groupPapelizSyncRecoveryKeyText(syncRecoveryKeyText: string): string {
  return (tidyPapelizSyncRecoveryKeyText(syncRecoveryKeyText).match(/.{1,4}/g) ?? []).join(' ')
}

// The Recovery Kit as a note, which Papeliz's PDF engine prints as the Recovery Kit's PDF
// (papeliz-sync-recovery-kit-pdf.ts). The key sits in a code block, so it prints in a monospace font
// where 0 and O, 1 and I can't be mixed up.
export function buildPapelizSyncRecoveryKitNoteText(syncRecoveryKeyText: string, accountLabel: string | null, recoveryKitMadeAt: Date): string {
  const recoveryKitMadeDay = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(recoveryKitMadeAt)
  return [
    '# Papeliz Sync Recovery Kit',
    '',
    'Your Recovery Key:',
    '',
    '```text',
    groupPapelizSyncRecoveryKeyText(syncRecoveryKeyText),
    '```',
    '',
    accountLabel === null ? null : `- Account: ${accountLabel}`,
    `- Made on ${recoveryKitMadeDay}`,
    '',
    'This key opens your synced notes if you forget your Sync passphrase. Papeliz can’t reset it or your passphrase: without both, the synced copy can’t be opened. The notes on your devices are never affected.',
    '',
    'Keep it somewhere safe, away from your devices: printed, or in a password manager.',
    '',
  ]
    .filter((recoveryKitLine): recoveryKitLine is string => recoveryKitLine !== null)
    .join('\n')
}

// The Recovery Kit as a text file, for when the PDF can't be made.
export function buildPapelizSyncRecoveryKitText(syncRecoveryKeyText: string, accountLabel: string | null): string {
  return [
    'Papeliz Sync Recovery Kit',
    '',
    accountLabel === null ? null : `Account: ${accountLabel}`,
    `Recovery Key: ${groupPapelizSyncRecoveryKeyText(syncRecoveryKeyText)}`,
    '',
    'This key opens your synced notes if you forget your Sync passphrase.',
    'Papeliz can’t reset it or your passphrase: without both, the synced copy can’t be opened.',
    'The notes on your devices are never affected.',
    'Keep it somewhere safe, away from your devices.',
    '',
  ]
    .filter((recoveryKitLine): recoveryKitLine is string => recoveryKitLine !== null)
    .join('\n')
}
