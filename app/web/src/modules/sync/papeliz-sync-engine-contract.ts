// The interface between Papeliz Sync's screens and its engine. The gear's Account and Sync pages,
// the set-up dialog, the status bar and the clash dialog call only this; the engine implements it.
// The screens get the engine from `loadPapelizSyncEngine()` in `virtual:papeliz-sync-engine`, which
// says when the engine is not part of a build (papeliz-sync-engine-stand-in.ts).
//
// - The engine works off the page's main thread (the sync thread, a Web Worker), so every call that
//   reaches the service, the keys or the vault returns a promise.
// - Readings come as one snapshot the screens subscribe to (it suits React's useSyncExternalStore),
//   plus one-off events for notices.
// - The platform passes in what only it has, once, through `startSyncEngine`: the three-way merge for
//   notes and the service's origin. Each open vault's files come through `attachSyncToOpenVault`.
// - The Sync passphrase and the Recovery Key pass through here on their way into the engine; the
//   screens never keep them. No key ever leaves the engine.
//
// This file imports nothing, so the engine can implement it without the rest of the app. Times are
// milliseconds since 1970 (Date.now()), sizes are bytes.

// Where an account's synced data is stored, chosen once when the account is made. Only `eu` is a
// guarantee (the EU jurisdiction); the others are where the data is placed and stays.
export type PapelizSyncStoragePlace = 'enam' | 'wnam' | 'eu' | 'apac' | 'oc'
export const papelizSyncStoragePlaces: readonly PapelizSyncStoragePlace[] = ['enam', 'wnam', 'eu', 'apac', 'oc']

export type PapelizSyncPlanName = 'standard' | 'plus' | 'pro'
export const papelizSyncPlanNames: readonly PapelizSyncPlanName[] = ['standard', 'plus', 'pro']

export type PapelizSyncBillingPeriod = 'monthly' | 'yearly'

export type PapelizSyncDevicePlatform = 'web' | 'desktop' | 'mobile'

export type PapelizSyncSignInMethod = 'email-code' | 'google' | 'apple'

// - `ends-at-period-end`: cancelled, still active until `syncSubscriptionEndsAt`.
// - `ended-read-only`: uploads stopped; every device can still download and restore old versions until
//   `syncReadOnlyUntil`.
// - `ended-held`: nothing can be read; the synced copy is kept until `syncSyncedCopyDeletedAt`, then
//   deleted. Subscribing again brings it back. Notes on devices are never touched.
export type PapelizSyncSubscriptionState =
  | 'not-subscribed'
  | 'active'
  | 'ends-at-period-end'
  | 'payment-past-due'
  | 'ended-read-only'
  | 'ended-held'

// What the plan allows, as the Sync page shows it. The hidden fair-use limits are not here; the
// engine paces itself to them and reports only when sync waits.
export interface PapelizSyncVisiblePlanLimits {
  syncStorageByteLimit: number
  syncedVaultLimit: number
  syncFilesPerVaultLimit: number
  syncLargestFileByteLimit: number
  syncNoteHistoryMonthCount: number
  syncAttachmentHistoryDayCount: number
  syncConnectedDeviceLimit: number
}

// A plan as the Sync page offers it before subscribing. The prices are part of the engine, not of this
// app: a build without the engine shows no prices.
export interface PapelizSyncPlanOfferReading {
  syncPlanName: PapelizSyncPlanName
  syncBillingPeriod: PapelizSyncBillingPeriod
  // Formatted by the engine with Intl.NumberFormat in the reader's own number format, for the whole
  // billing period. The screen shows it as it is and adds "a month" or "a year" from the billing period.
  syncDisplayPrice: string
  syncPriceCurrencyCode: string
  syncVisiblePlanLimits: PapelizSyncVisiblePlanLimits
}

export interface PapelizSyncAccountReading {
  papelizSyncAccountId: string
  papelizSyncStoragePlace: PapelizSyncStoragePlace
  syncPlanName: PapelizSyncPlanName | null
  syncSubscriptionState: PapelizSyncSubscriptionState
  // The next renewal while active, or the last day of a cancelled subscription.
  syncSubscriptionRenewsAt: number | null
  syncSubscriptionEndsAt: number | null
  syncReadOnlyUntil: number | null
  syncSyncedCopyDeletedAt: number | null
  syncVisiblePlanLimits: PapelizSyncVisiblePlanLimits | null
  // Old versions count toward storage.
  syncStorageUsedByteLength: number
  syncedVaultCount: number
  // Paused by Papeliz (Pause one account): uploads wait, downloads go on.
  isSyncAccountPaused: boolean
  syncAccountReadAt: number
}

export type PapelizSyncSignInReading =
  | { syncSignInKind: 'signed-out' }
  // The sign-in page is open in another tab; the device session arrives from it.
  | { syncSignInKind: 'waiting-for-sign-in-page' }
  | {
      syncSignInKind: 'signed-in'
      papelizSyncAccountId: string
      papelizSyncDeviceId: string
      // From the sign-in page, kept on this device only, for the Account page. Papeliz's servers never
      // store an email address.
      syncSignInEmailAddress: string | null
      syncSignInMethod: PapelizSyncSignInMethod | null
    }
  // This device was removed on another device, or its device session stopped working: Sign in again.
  // Its notes are untouched.
  | { syncSignInKind: 'device-removed' }

// - `unknown`: not read yet (signed out, or offline since signing in).
// - `not-set-up`: the account has no keys yet; the set-up dialog makes them.
// - `locked`: keys exist, this device needs the passphrase or the Recovery Key once.
export type PapelizSyncAccountKeyState = 'unknown' | 'not-set-up' | 'locked' | 'unlocked'

// Why changes are waiting while the device is online.
// - `pacing-to-allowance`: near the plan's fair-use allowance, sync slows to its refill rate.
// - `limit-reached`: the service answered 429; sync resumes at `syncResumesAt`.
// - `over-storage`: uploads pause until storage is freed or the plan grows; downloads go on.
// - `paused-for-maintenance`: Papeliz paused all uploads for a while.
// - `account-paused`: Papeliz paused this account's uploads.
export type PapelizSyncWaitingReason =
  | 'pacing-to-allowance'
  | 'limit-reached'
  | 'over-storage'
  | 'paused-for-maintenance'
  | 'account-paused'

// One vault's state, as the status bar and the Sync page show it. Changes are always saved on the
// device first, so every state with waiting files sends them later and drops none.
export type PapelizSyncStatusReading =
  | { syncStatusKind: 'synced'; syncLastSyncedAt: number | null }
  | { syncStatusKind: 'syncing'; syncingFileCount: number }
  | { syncStatusKind: 'offline'; syncWaitingFileCount: number }
  | {
      syncStatusKind: 'waiting'
      syncWaitingFileCount: number
      syncWaitingReason: PapelizSyncWaitingReason
      syncResumesAt: number | null
    }
  | { syncStatusKind: 'to-settle'; syncClashToSettleCount: number }
  | { syncStatusKind: 'paused-on-this-device'; syncWaitingFileCount: number }
  | { syncStatusKind: 'subscription-ended'; syncReadOnlyUntil: number | null }
  | { syncStatusKind: 'locked' }
  | { syncStatusKind: 'signed-out' }

// A first upload, a first download into a new folder or browser vault, or Connect's merge.
export interface PapelizSyncVaultTransferProgress {
  syncVaultTransferKind: 'first-upload' | 'first-download' | 'connect'
  syncTransferredFileCount: number
  syncTransferFileCount: number
}

// A vault on this device that syncs.
export interface PapelizSyncLocalVaultReading {
  papelizVaultId: string
  papelizSyncVaultId: string
  syncVaultStatus: PapelizSyncStatusReading
  syncVaultTransferProgress: PapelizSyncVaultTransferProgress | null
}

// A vault on this device linked to a synced vault, open or not: the start screen marks its row
// "Synced", and picks up a first download that closing the tab left unfinished.
export interface PapelizSyncLinkedLocalVaultReading {
  papelizVaultId: string
  papelizSyncVaultId: string
  isFirstDownloadUnfinished: boolean
}

// A synced vault on the account, for a new device's Download and Connect.
export interface PapelizSyncAccountVaultReading {
  papelizSyncVaultId: string
  // Decrypted on this device; null while locked.
  syncVaultName: string | null
  syncVaultFileCount: number
  syncVaultStoredByteLength: number
  syncVaultCreatedAt: number
  // The vault on this device that syncs with it, if one does.
  papelizVaultIdOnThisDevice: string | null
}

export interface PapelizSyncDeviceReading {
  papelizSyncDeviceId: string
  // Decrypted on this device; null until named, and while locked.
  syncDeviceName: string | null
  syncDevicePlatform: PapelizSyncDevicePlatform
  syncDeviceAddedAt: number
  syncDeviceLastSeenAt: number | null
  isThisSyncDevice: boolean
}

// What syncs besides notes, attachments and the vault's own `.papeliz/` files (which always sync).
export interface PapelizSyncWhatSyncsChoices {
  isAssistantChatSyncOn: boolean
  isAppSettingSyncOn: boolean
  // Off until the user turns it on; then encrypted like a note.
  isAiProviderKeySyncOn: boolean
}

// A note both this device and another changed on the same lines. The clash dialog settles it.
export interface PapelizSyncNoteClashSummary {
  papelizSyncClashId: string
  papelizVaultId: string
  vaultNoteRelativePath: string
  // "On Phone": decrypted on this device; null when the other device has no name yet.
  otherSyncDeviceName: string | null
  otherSyncDevicePlatform: PapelizSyncDevicePlatform | null
  syncClashFoundAt: number
}

export interface PapelizSyncNoteClashTexts {
  // The last text both devices had.
  baseNoteText: string
  otherDeviceNoteText: string
  thisDeviceNoteText: string
}

export interface PapelizSyncEngineSnapshot {
  syncSignIn: PapelizSyncSignInReading
  syncAccount: PapelizSyncAccountReading | null
  syncAccountKeyState: PapelizSyncAccountKeyState
  isSyncPausedOnThisDevice: boolean
  syncWhatSyncsChoices: PapelizSyncWhatSyncsChoices
  // The vaults attached now (open in the workspace, or downloading from the start screen) that sync.
  syncLocalVaults: readonly PapelizSyncLocalVaultReading[]
  // Every vault on this device that syncs, attached or not.
  syncLinkedLocalVaults: readonly PapelizSyncLinkedLocalVaultReading[]
  syncNoteClashesToSettle: readonly PapelizSyncNoteClashSummary[]
}

// Notices the screens may show once; everything lasting is in the snapshot.
export type PapelizSyncEngineEvent =
  | { syncEngineEventKind: 'signed-in' }
  // A file that can't merge (a picture, a PDF) changed on two devices: both copies were kept.
  | {
      syncEngineEventKind: 'attachment-kept-both'
      papelizVaultId: string
      vaultFileRelativePath: string
      keptOtherCopyRelativePath: string
    }
  // Another device deleted a note this device had edited: the edit wins and the note stays.
  | { syncEngineEventKind: 'edit-kept-over-delete'; papelizVaultId: string; vaultFileRelativePath: string }
  // Another device moved a file to the trash; this device moved it into its own `.trash/` too.
  | {
      syncEngineEventKind: 'moved-to-trash-by-other-device'
      papelizVaultId: string
      vaultFileRelativePath: string
      vaultTrashRelativePath: string
    }
  // A file over the plan's largest file size stays on this device only.
  | { syncEngineEventKind: 'file-too-large-to-sync'; papelizVaultId: string; vaultFileRelativePath: string }

// Why an action didn't happen. Screens map each to their own words.
// - `fresh-sign-in-required`: changing the passphrase, Start over and Delete account need a sign-in
//   from the last few minutes; the screen starts one and tries again.
// - `changed-elsewhere`: another device changed the same thing first (set up the keys, say).
export type PapelizSyncActionFailureKind =
  | 'offline'
  | 'signed-out'
  | 'fresh-sign-in-required'
  | 'locked'
  | 'subscription-required'
  | 'read-only'
  | 'limit-reached'
  | 'wrong-passphrase'
  | 'wrong-recovery-key'
  | 'passphrase-too-short'
  | 'changed-elsewhere'
  | 'not-found'
  | 'service-error'

export type PapelizSyncActionOutcome<SyncActionDoneValue = null> =
  | { syncActionOutcome: 'done'; syncActionDoneValue: SyncActionDoneValue }
  | {
      syncActionOutcome: 'failed'
      syncActionFailureKind: PapelizSyncActionFailureKind
      // English, for a log or a detail line; screens lead with their own words for the kind.
      syncActionFailureMessage: string
      // When the service said to try again (a limit).
      syncRetryAt: number | null
    }

export type PapelizSyncSignInOutcome =
  | { syncSignInOutcome: 'signed-in' }
  // The tab was closed, or the sign-in was cancelled from the screen.
  | { syncSignInOutcome: 'cancelled' }
  | { syncSignInOutcome: 'failed'; syncSignInFailureMessage: string }

export interface PapelizSyncSignInAttempt {
  // Open this in a new tab from the click itself, so the browser allows it.
  syncSignInPageUrl: string
  syncSignInOutcome: Promise<PapelizSyncSignInOutcome>
  cancelSyncSignIn(): void
}

export interface PapelizSyncSignInOptions {
  // A new account is made in this place. Null when the screen hasn't asked: then the sign-in page asks
  // a new user itself. An existing account keeps its place.
  papelizSyncStoragePlaceForNewAccount: PapelizSyncStoragePlace | null
}

// Made on this device and not sent anywhere until confirmed, so leaving set-up before the Recovery
// Key is saved leaves nothing behind.
export interface PapelizSyncAccountKeyDraft {
  syncAccountKeyDraftId: string
  // 24 characters in six groups of four, shown once (and in the Recovery Kit).
  syncRecoveryKeyText: string
}

export interface PapelizSyncFileVersionReading {
  syncFileVersion: number
  syncFileChangedAt: number
  // "On Phone": decrypted on this device; null when unnamed or locked.
  syncFileChangedOnDeviceName: string | null
  syncFileStoredByteLength: number
  isSyncFileDeletedInVersion: boolean
}

// The three-way merge the platform passes in (the app's own, for two tabs and other apps): the text
// both sides started from, the other device's and this device's. `clash` when the same lines changed
// differently; the clash dialog then settles the note with the same merge.
export type PapelizSyncNoteMergeOutcome =
  | { syncNoteMergeOutcome: 'merged'; mergedNoteText: string }
  | { syncNoteMergeOutcome: 'clash' }

export type PapelizSyncNoteThreeWayMerge = (baseNoteText: string, otherDeviceNoteText: string, thisDeviceNoteText: string) => PapelizSyncNoteMergeOutcome

export interface PapelizSyncLocalVaultFileStat {
  vaultFileRelativePath: string
  vaultFileByteLength: number
  vaultFileModifiedAt: number
}

// One open vault's files, as the engine reads and writes them. The platform implements it on its own
// vault (on the web, the app's vault adapter, so open notes and other tabs see Sync's writes like any
// save). Paths use `/`, relative to the vault.
export interface PapelizSyncLocalVaultFiles {
  // Every file that syncs: notes, attachments, `.papeliz/`, `.csessions/`. Never `.trash/` or any other
  // hidden folder.
  listSyncableVaultFileStats(): Promise<PapelizSyncLocalVaultFileStat[]>
  readVaultFileBytes(vaultFileRelativePath: string): Promise<Uint8Array>
  // Writes the whole file, making its folders.
  writeVaultFileBytes(vaultFileRelativePath: string, vaultFileBytes: Uint8Array): Promise<void>
  renameVaultFile(fromVaultFileRelativePath: string, toVaultFileRelativePath: string): Promise<void>
  // Into the vault's `.trash/`, never deleted. Returns where it went.
  moveVaultFileToTrash(vaultFileRelativePath: string): Promise<string>
}

export interface PapelizSyncOpenLocalVault {
  papelizVaultId: string
  // The sample vault never syncs.
  papelizVaultKind: 'folder-on-disk' | 'browser-vault-in-opfs'
  papelizVaultDisplayName: string
  syncLocalVaultFiles: PapelizSyncLocalVaultFiles
}

export interface PapelizSyncEnginePlatform {
  // Where `/api/account/v1/` and `/api/sync/v1/` live: `https://papeliz.com`, or the local dev origin.
  papelizSyncServiceOrigin: string
  syncDevicePlatform: PapelizSyncDevicePlatform
  mergeSyncNoteText: PapelizSyncNoteThreeWayMerge
}

export interface PapelizSyncEngine {
  // Once, before anything else. Makes no request until the user signs in (or was signed in before).
  startSyncEngine(syncEnginePlatform: PapelizSyncEnginePlatform): Promise<void>
  // Ends the sync thread; the engine can't be used again.
  stopSyncEngine(): void

  getSyncEngineSnapshot(): PapelizSyncEngineSnapshot
  // Returns the unsubscribe function. The listener runs after each new snapshot.
  subscribeToSyncEngineSnapshot(syncEngineSnapshotListener: () => void): () => void
  subscribeToSyncEngineEvents(syncEngineEventListener: (syncEngineEvent: PapelizSyncEngineEvent) => void): () => void

  // Account: plans, sign in, devices.
  // From the engine's built-in table: no request, so it works signed out and offline.
  listSyncPlanOffers(): Promise<PapelizSyncActionOutcome<PapelizSyncPlanOfferReading[]>>
  startSyncSignIn(syncSignInOptions: PapelizSyncSignInOptions): PapelizSyncSignInAttempt
  // Ends this device's session on the service and forgets the keys here. Notes stay.
  signOutOfSync(): Promise<PapelizSyncActionOutcome>
  refreshSyncAccountReading(): Promise<PapelizSyncActionOutcome<PapelizSyncAccountReading>>
  listSyncDevices(): Promise<PapelizSyncActionOutcome<PapelizSyncDeviceReading[]>>
  nameThisSyncDevice(syncDeviceName: string): Promise<PapelizSyncActionOutcome>
  // Its session ends now and its last grant within the hour; its notes stay on it.
  removeSyncDevice(papelizSyncDeviceId: string): Promise<PapelizSyncActionOutcome>
  // The checkout and the subscription's own page, each to open in a new tab.
  createSyncCheckoutPageUrl(syncPlanName: PapelizSyncPlanName, syncBillingPeriod: PapelizSyncBillingPeriod): Promise<PapelizSyncActionOutcome<string>>
  createSyncBillingPortalUrl(): Promise<PapelizSyncActionOutcome<string>>
  // Deletes the subscription, every synced copy and the version history; notes on devices stay.
  deleteSyncAccount(): Promise<PapelizSyncActionOutcome>

  // Keys: set-up, unlock, change, Start over.
  prepareSyncAccountKeys(syncPassphrase: string): Promise<PapelizSyncActionOutcome<PapelizSyncAccountKeyDraft>>
  // After the user has saved the Recovery Key: stores both wrapped copies and unlocks this device.
  confirmSyncAccountKeys(syncAccountKeyDraftId: string): Promise<PapelizSyncActionOutcome>
  unlockSyncWithPassphrase(syncPassphrase: string): Promise<PapelizSyncActionOutcome>
  // A lost passphrase: the Recovery Key unlocks and sets a new passphrase.
  unlockSyncWithRecoveryKey(syncRecoveryKeyText: string, newSyncPassphrase: string): Promise<PapelizSyncActionOutcome>
  // Re-wraps only the account key; nothing is uploaded again.
  changeSyncPassphrase(newSyncPassphrase: string): Promise<PapelizSyncActionOutcome>
  // With neither the passphrase nor the Recovery Key: deletes the synced copy and its history, makes
  // new keys (a new draft to confirm), and every device uploads its vaults again.
  startSyncOver(newSyncPassphrase: string): Promise<PapelizSyncActionOutcome<PapelizSyncAccountKeyDraft>>

  // Vaults. The workspace attaches each vault it opens and calls the returned function when it closes.
  attachSyncToOpenVault(openLocalVault: PapelizSyncOpenLocalVault): () => void
  listSyncedVaultsOnAccount(): Promise<PapelizSyncActionOutcome<PapelizSyncAccountVaultReading[]>>
  // An attached vault becomes a synced vault on the account and starts its first upload.
  turnSyncOnForVault(papelizVaultId: string): Promise<PapelizSyncActionOutcome<{ papelizSyncVaultId: string }>>
  // An attached vault (new and empty) is filled from a synced vault.
  downloadSyncedVaultInto(papelizSyncVaultId: string, papelizVaultId: string): Promise<PapelizSyncActionOutcome>
  // An attached vault with notes of its own joins a synced vault; the two are merged.
  connectVaultToSyncedVault(papelizVaultId: string, papelizSyncVaultId: string): Promise<PapelizSyncActionOutcome>
  // This device stops syncing the vault; the synced copy and other devices are untouched.
  turnSyncOffForVault(papelizVaultId: string): Promise<PapelizSyncActionOutcome>
  // Deletes the synced copy and its history from the account; every device keeps its files.
  deleteSyncedVaultFromAccount(papelizSyncVaultId: string): Promise<PapelizSyncActionOutcome>
  setSyncPausedOnThisDevice(isSyncPausedOnThisDevice: boolean): Promise<void>
  setSyncWhatSyncsChoices(syncWhatSyncsChoices: PapelizSyncWhatSyncsChoices): Promise<PapelizSyncActionOutcome>

  // What the workspace tells the engine, so uploads go 10 seconds after typing stops, at least once a
  // minute while typing, and right away on leaving a note or the tab. Each is cheap and never waits.
  reportSyncVaultFileSaved(papelizVaultId: string, vaultFileRelativePath: string): void
  reportSyncVaultNoteLeft(papelizVaultId: string, vaultNoteRelativePath: string): void
  // Renames and moves made in Papeliz are sent as renames.
  reportSyncVaultEntryRenamed(papelizVaultId: string, fromVaultEntryRelativePath: string, toVaultEntryRelativePath: string): void
  reportSyncVaultEntryMovedToTrash(papelizVaultId: string, vaultEntryRelativePath: string, vaultTrashRelativePath: string): void
  // Leaving the tab or closing Papeliz.
  sendWaitingSyncChangesNow(): Promise<void>

  // Clashes to settle.
  readSyncNoteClashTexts(papelizSyncClashId: string): Promise<PapelizSyncNoteClashTexts | null>
  // The note's text once the user settled it in the clash dialog (Keep both by default).
  settleSyncNoteClash(papelizSyncClashId: string, settledNoteText: string): Promise<PapelizSyncActionOutcome>

  // Old versions (they count toward storage).
  listSyncFileVersions(papelizVaultId: string, vaultFileRelativePath: string): Promise<PapelizSyncActionOutcome<PapelizSyncFileVersionReading[]>>
  readSyncFileVersionBytes(papelizVaultId: string, vaultFileRelativePath: string, syncFileVersion: number): Promise<PapelizSyncActionOutcome<Uint8Array>>
  // Writes that version back as the newest, on every device.
  restoreSyncFileVersion(papelizVaultId: string, vaultFileRelativePath: string, syncFileVersion: number): Promise<PapelizSyncActionOutcome>
}
