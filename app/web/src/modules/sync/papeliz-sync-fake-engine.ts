import type {
  PapelizSyncAccountKeyDraft,
  PapelizSyncAccountReading,
  PapelizSyncAccountVaultReading,
  PapelizSyncActionFailureKind,
  PapelizSyncActionOutcome,
  PapelizSyncBillingPeriod,
  PapelizSyncDeviceReading,
  PapelizSyncEngine,
  PapelizSyncEngineEvent,
  PapelizSyncEnginePlatform,
  PapelizSyncEngineSnapshot,
  PapelizSyncFileVersionReading,
  PapelizSyncLocalVaultFiles,
  PapelizSyncLocalVaultReading,
  PapelizSyncNoteClashSummary,
  PapelizSyncNoteClashTexts,
  PapelizSyncOpenLocalVault,
  PapelizSyncPlanName,
  PapelizSyncPlanOfferReading,
  PapelizSyncSignInAttempt,
  PapelizSyncSignInOptions,
  PapelizSyncSignInOutcome,
  PapelizSyncStatusReading,
  PapelizSyncStoragePlace,
  PapelizSyncSubscriptionState,
  PapelizSyncVisiblePlanLimits,
  PapelizSyncWhatSyncsChoices,
} from './papeliz-sync-engine-contract'
import { isPapelizSyncPassphraseLongEnough, tidyPapelizSyncRecoveryKeyText } from './papeliz-sync-screen-words'

// A stand-in for the Papeliz Sync engine that keeps everything in memory and talks to no server,
// for the screens' tests and for the dev server's switch (papeliz-sync-engine-store.ts, dev builds
// only). Each scenario starts the fake in one of the states the Sync and Account pages show. Its
// prices are the ISO 4217 test currency, never a real one.

export type PapelizSyncFakeEngineScenario =
  | 'signed-out'
  | 'not-subscribed'
  | 'set-up-unfinished'
  | 'locked'
  | 'on'
  | 'paused-on-this-device'
  | 'over-storage'
  | 'subscription-ended'
  | 'to-settle'
  // A new device: signed out, and once signed in, locked, with three synced vaults on the account and
  // none of them here (Fetch from Sync on the start screen).
  | 'new-device'
  // Signed in and unlocked with the same three vaults; a download stops halfway once, as if the
  // connection dropped, and goes on when tried again.
  | 'download-stops'

export const papelizSyncFakeEngineScenarios: readonly PapelizSyncFakeEngineScenario[] = [
  'signed-out',
  'not-subscribed',
  'set-up-unfinished',
  'locked',
  'on',
  'paused-on-this-device',
  'over-storage',
  'subscription-ended',
  'to-settle',
  'new-device',
  'download-stops',
]

export function isPapelizSyncFakeEngineScenario(fakeEngineScenarioText: string): fakeEngineScenarioText is PapelizSyncFakeEngineScenario {
  return (papelizSyncFakeEngineScenarios as readonly string[]).includes(fakeEngineScenarioText)
}

// The fake's own passphrase and Recovery Key for the scenarios that start with keys made.
export const papelizSyncFakeEnginePassphrase = 'papeliz fake passphrase'
export const papelizSyncFakeEngineRecoveryKeyText = 'ABCD-EFGH-JKMN-PQRS-TVWX-YZ23'
export const papelizSyncFakeEngineDisplayPrice = '0.00 XTS'

const papelizSyncFakeEngineAccountId = 'pzacct_apac_aaaaaaaaaaaaaaaaaaaaaaaaaa'
const papelizSyncFakeEngineThisDeviceId = 'pzdev_aaaaaaaaaaaaaaaaaaaaaaaaaa'
const papelizSyncFakeEngineFreshSignInMilliseconds = 10 * 60_000

const papelizSyncFakeEnginePlanLimits: Record<PapelizSyncPlanName, PapelizSyncVisiblePlanLimits> = {
  standard: {
    syncStorageByteLimit: 10e9,
    syncedVaultLimit: 5,
    syncFilesPerVaultLimit: 100_000,
    syncLargestFileByteLimit: 50e6,
    syncNoteHistoryMonthCount: 6,
    syncAttachmentHistoryDayCount: 30,
    syncConnectedDeviceLimit: 20,
  },
  plus: {
    syncStorageByteLimit: 100e9,
    syncedVaultLimit: 20,
    syncFilesPerVaultLimit: 250_000,
    syncLargestFileByteLimit: 1e9,
    syncNoteHistoryMonthCount: 24,
    syncAttachmentHistoryDayCount: 30,
    syncConnectedDeviceLimit: 20,
  },
  pro: {
    syncStorageByteLimit: 250e9,
    syncedVaultLimit: 100,
    syncFilesPerVaultLimit: 500_000,
    syncLargestFileByteLimit: 2e9,
    syncNoteHistoryMonthCount: 36,
    syncAttachmentHistoryDayCount: 30,
    syncConnectedDeviceLimit: 20,
  },
}

export interface PapelizSyncFakeEngineOptions {
  fakeEngineScenario: PapelizSyncFakeEngineScenario
  // How long each call takes, so the screens' waiting states can be seen. 0 in tests.
  fakeCallDelayMilliseconds?: number
  // In the dev server the sign-in page and the checkout "finish" by themselves after this long; tests
  // finish them with finishFakeSyncSignIn and finishFakeSyncCheckout. Null: never by themselves.
  fakeOtherTabFinishMilliseconds?: number | null
  fakeCurrentTime?: () => number
}

interface PapelizSyncFakeAttachedVault {
  papelizVaultId: string
  papelizVaultDisplayName: string
  syncLocalVaultFiles: PapelizSyncLocalVaultFiles
}

// A synced vault on the fake account that no vault on this device syncs with yet. A download writes
// its few notes into the vault, through the vault's own files, as the real engine writes every file.
interface PapelizSyncFakeAccountOnlyVault {
  papelizSyncVaultId: string
  syncVaultName: string
  syncVaultFileCount: number
  syncVaultStoredByteLength: number
  syncVaultCreatedDaysAgo: number
  syncVaultFakeNoteTextsByRelativePath: Readonly<Record<string, string>>
}

const papelizSyncFakeEngineNewDeviceAccountVaults: readonly PapelizSyncFakeAccountOnlyVault[] = [
  {
    papelizSyncVaultId: 'pzvault_dddddddddddddddddddddddddd',
    syncVaultName: 'Research notes',
    syncVaultFileCount: 1482,
    syncVaultStoredByteLength: 310e6,
    syncVaultCreatedDaysAgo: 60,
    syncVaultFakeNoteTextsByRelativePath: {
      'Reading list.md': '# Reading list\n\n- [[Sources/Interviews]]\n',
      'Sources/Interviews.md': '# Interviews\n\nDownloaded by the fake engine.\n',
    },
  },
  {
    papelizSyncVaultId: 'pzvault_eeeeeeeeeeeeeeeeeeeeeeeeee',
    syncVaultName: 'Work',
    syncVaultFileCount: 2140,
    syncVaultStoredByteLength: 1.2e9,
    syncVaultCreatedDaysAgo: 45,
    syncVaultFakeNoteTextsByRelativePath: {
      'Projects/Launch plan.md': '# Launch plan\n\nDownloaded by the fake engine.\n',
      'Meetings/Weekly.md': '# Weekly\n\nDownloaded by the fake engine.\n',
    },
  },
  {
    papelizSyncVaultId: 'pzvault_ffffffffffffffffffffffffff',
    syncVaultName: 'Recipes',
    syncVaultFileCount: 64,
    syncVaultStoredByteLength: 3.1e6,
    syncVaultCreatedDaysAgo: 12,
    syncVaultFakeNoteTextsByRelativePath: {
      'Breakfast/Pancakes.md': '# Pancakes\n\nDownloaded by the fake engine.\n',
      'Dinner/Adobo.md': '# Adobo\n\nDownloaded by the fake engine.\n',
    },
  },
]

function listPapelizSyncFakeAccountOnlyVaults(fakeEngineScenario: PapelizSyncFakeEngineScenario): PapelizSyncFakeAccountOnlyVault[] {
  if (fakeEngineScenario === 'new-device' || fakeEngineScenario === 'download-stops') return [...papelizSyncFakeEngineNewDeviceAccountVaults]
  // The Sync page's locked state lists one vault to connect once unlocked.
  if (fakeEngineScenario === 'locked') return papelizSyncFakeEngineNewDeviceAccountVaults.slice(0, 1)
  return []
}

function isPapelizSyncFakeNewDeviceScenario(fakeEngineScenario: PapelizSyncFakeEngineScenario): boolean {
  return fakeEngineScenario === 'new-device' || fakeEngineScenario === 'download-stops'
}

function createFakeDoneOutcome<SyncActionDoneValue>(syncActionDoneValue: SyncActionDoneValue): PapelizSyncActionOutcome<SyncActionDoneValue> {
  return { syncActionOutcome: 'done', syncActionDoneValue }
}

function createFakeFailedOutcome<SyncActionDoneValue>(syncActionFailureKind: PapelizSyncActionFailureKind): PapelizSyncActionOutcome<SyncActionDoneValue> {
  return { syncActionOutcome: 'failed', syncActionFailureKind, syncActionFailureMessage: `Fake engine: ${syncActionFailureKind}`, syncRetryAt: null }
}

export class PapelizSyncFakeEngine implements PapelizSyncEngine {
  // Every call, in order, so tests can check what the screens asked for (and what they didn't).
  readonly fakeEngineCallNames: string[] = []
  readonly fakeReportedSyncVaultFileSaves: Array<{ papelizVaultId: string; vaultFileRelativePath: string }> = []
  readonly fakeReportedSyncVaultNoteLeaves: Array<{ papelizVaultId: string; vaultNoteRelativePath: string }> = []
  fakeStartedSyncEnginePlatform: PapelizSyncEnginePlatform | null = null
  fakeLastSignInOptions: PapelizSyncSignInOptions | null = null

  private fakeEngineSnapshot: PapelizSyncEngineSnapshot
  private readonly fakeSnapshotListeners = new Set<() => void>()
  private readonly fakeEventListeners = new Set<(syncEngineEvent: PapelizSyncEngineEvent) => void>()
  private readonly fakeCallDelayMilliseconds: number
  private readonly fakeOtherTabFinishMilliseconds: number | null
  private readonly fakeCurrentTime: () => number
  private readonly fakeEngineScenario: PapelizSyncFakeEngineScenario
  private readonly fakeAttachedVaultsById = new Map<string, PapelizSyncFakeAttachedVault>()
  private fakeSyncPassphrase: string | null
  private fakeSyncRecoveryKeyText: string | null
  private fakePendingKeyDraft: { syncAccountKeyDraftId: string; syncPassphrase: string; syncRecoveryKeyText: string } | null = null
  private fakeSignedInAt: number
  private fakePendingSignIn: { resolveSignIn: (signInOutcome: PapelizSyncSignInOutcome) => void } | null = null
  private fakePendingCheckoutPlanName: PapelizSyncPlanName | null = null
  private fakeKeyDraftCount = 0
  private fakeThisDeviceName: string | null = null
  private fakeRemovedDeviceIds = new Set<string>()
  private readonly fakeAccountOnlyVaults: PapelizSyncFakeAccountOnlyVault[]
  // A synced vault downloaded here, by its synced vault: the vault on this device that syncs with it.
  private readonly fakeDownloadedPapelizVaultIdsBySyncVaultId = new Map<string, string>()
  // `download-stops` stops one download halfway, once.
  private isFakeDownloadStopUsed = false

  constructor({ fakeEngineScenario, fakeCallDelayMilliseconds = 0, fakeOtherTabFinishMilliseconds = null, fakeCurrentTime = () => Date.now() }: PapelizSyncFakeEngineOptions) {
    this.fakeEngineScenario = fakeEngineScenario
    this.fakeCallDelayMilliseconds = fakeCallDelayMilliseconds
    this.fakeOtherTabFinishMilliseconds = fakeOtherTabFinishMilliseconds
    this.fakeCurrentTime = fakeCurrentTime
    this.fakeAccountOnlyVaults = listPapelizSyncFakeAccountOnlyVaults(fakeEngineScenario)
    const isSignedIn = fakeEngineScenario !== 'signed-out' && fakeEngineScenario !== 'new-device'
    const hasKeys = !['signed-out', 'not-subscribed', 'set-up-unfinished'].includes(fakeEngineScenario)
    this.fakeSyncPassphrase = hasKeys ? papelizSyncFakeEnginePassphrase : null
    this.fakeSyncRecoveryKeyText = hasKeys ? papelizSyncFakeEngineRecoveryKeyText : null
    // Long enough ago that changing the passphrase, Start over and Delete account ask to sign in again.
    this.fakeSignedInAt = fakeCurrentTime() - 2 * 60 * 60_000
    this.fakeEngineSnapshot = {
      syncSignIn: isSignedIn
        ? {
            syncSignInKind: 'signed-in',
            papelizSyncAccountId: papelizSyncFakeEngineAccountId,
            papelizSyncDeviceId: papelizSyncFakeEngineThisDeviceId,
            syncSignInEmailAddress: 'you@example.com',
            syncSignInMethod: 'google',
          }
        : { syncSignInKind: 'signed-out' },
      syncAccount: isSignedIn ? this.buildFakeAccountReading(fakeEngineScenario === 'not-subscribed' ? null : 'plus') : null,
      syncAccountKeyState: !isSignedIn ? 'unknown' : fakeEngineScenario === 'locked' ? 'locked' : hasKeys ? 'unlocked' : 'not-set-up',
      isSyncPausedOnThisDevice: fakeEngineScenario === 'paused-on-this-device',
      syncWhatSyncsChoices: { isAssistantChatSyncOn: true, isAppSettingSyncOn: true, isAiProviderKeySyncOn: false },
      syncLocalVaults: [],
      syncNoteClashesToSettle: [],
    }
  }

  private buildFakeAccountReading(syncPlanName: PapelizSyncPlanName | null): PapelizSyncAccountReading {
    const currentTime = this.fakeCurrentTime()
    const syncSubscriptionState: PapelizSyncSubscriptionState =
      syncPlanName === null ? 'not-subscribed' : this.fakeEngineScenario === 'subscription-ended' ? 'ended-read-only' : 'active'
    const syncVisiblePlanLimits = syncPlanName === null ? null : papelizSyncFakeEnginePlanLimits[syncPlanName]
    return {
      papelizSyncAccountId: papelizSyncFakeEngineAccountId,
      papelizSyncStoragePlace: 'apac',
      syncPlanName,
      syncSubscriptionState,
      syncSubscriptionRenewsAt: syncSubscriptionState === 'active' ? currentTime + 30 * 24 * 60 * 60_000 : null,
      syncSubscriptionEndsAt: syncSubscriptionState === 'ended-read-only' ? currentTime - 2 * 24 * 60 * 60_000 : null,
      syncReadOnlyUntil: syncSubscriptionState === 'ended-read-only' ? currentTime + 28 * 24 * 60 * 60_000 : null,
      syncSyncedCopyDeletedAt: syncSubscriptionState === 'ended-read-only' ? currentTime + 88 * 24 * 60 * 60_000 : null,
      syncVisiblePlanLimits,
      syncStorageUsedByteLength:
        syncVisiblePlanLimits === null ? 0 : this.fakeEngineScenario === 'over-storage' ? syncVisiblePlanLimits.syncStorageByteLimit : 0.24 * syncVisiblePlanLimits.syncStorageByteLimit,
      syncedVaultCount: 0,
      isSyncAccountPaused: false,
      syncAccountReadAt: currentTime,
    }
  }

  private async waitForFakeCall(fakeEngineCallName: string): Promise<void> {
    this.fakeEngineCallNames.push(fakeEngineCallName)
    if (this.fakeCallDelayMilliseconds > 0) await new Promise((resolveFakeDelay) => setTimeout(resolveFakeDelay, this.fakeCallDelayMilliseconds))
  }

  private changeFakeSnapshot(fakeSnapshotChange: Partial<PapelizSyncEngineSnapshot>): void {
    this.fakeEngineSnapshot = { ...this.fakeEngineSnapshot, ...fakeSnapshotChange }
    for (const fakeSnapshotListener of [...this.fakeSnapshotListeners]) fakeSnapshotListener()
  }

  private changeFakeAccount(fakeAccountChange: Partial<PapelizSyncAccountReading>): void {
    const syncAccount = this.fakeEngineSnapshot.syncAccount
    if (syncAccount === null) return
    this.changeFakeSnapshot({ syncAccount: { ...syncAccount, ...fakeAccountChange, syncAccountReadAt: this.fakeCurrentTime() } })
  }

  private isFakeSignedIn(): boolean {
    return this.fakeEngineSnapshot.syncSignIn.syncSignInKind === 'signed-in'
  }

  // The status a vault shows once the fake syncs it, following the scenario.
  private readFakeSteadySyncVaultStatus(): PapelizSyncStatusReading {
    const currentTime = this.fakeCurrentTime()
    if (this.fakeEngineSnapshot.syncAccountKeyState === 'locked') return { syncStatusKind: 'locked' }
    if (this.fakeEngineSnapshot.isSyncPausedOnThisDevice) return { syncStatusKind: 'paused-on-this-device', syncWaitingFileCount: 2 }
    if (this.fakeEngineSnapshot.syncAccount?.syncSubscriptionState === 'ended-read-only') {
      return { syncStatusKind: 'subscription-ended', syncReadOnlyUntil: this.fakeEngineSnapshot.syncAccount.syncReadOnlyUntil }
    }
    if (this.fakeEngineScenario === 'over-storage') {
      return { syncStatusKind: 'waiting', syncWaitingFileCount: 3, syncWaitingReason: 'over-storage', syncResumesAt: null }
    }
    if (this.fakeEngineSnapshot.syncNoteClashesToSettle.length > 0) {
      return { syncStatusKind: 'to-settle', syncClashToSettleCount: this.fakeEngineSnapshot.syncNoteClashesToSettle.length }
    }
    return { syncStatusKind: 'synced', syncLastSyncedAt: currentTime }
  }

  private refreshFakeLocalVaultStatuses(): void {
    this.changeFakeSnapshot({
      syncLocalVaults: this.fakeEngineSnapshot.syncLocalVaults.map((syncLocalVault) =>
        syncLocalVault.syncVaultTransferProgress === null ? { ...syncLocalVault, syncVaultStatus: this.readFakeSteadySyncVaultStatus() } : syncLocalVault,
      ),
    })
  }

  private addFakeLocalVault(papelizVaultId: string, syncVaultTransferProgress: PapelizSyncLocalVaultReading['syncVaultTransferProgress']): PapelizSyncLocalVaultReading {
    const syncLocalVault: PapelizSyncLocalVaultReading = {
      papelizVaultId,
      papelizSyncVaultId: `pzvault_${papelizVaultId.replace(/[^a-z2-7]/g, '').padEnd(26, 'a').slice(0, 26)}`,
      syncVaultStatus:
        syncVaultTransferProgress === null
          ? this.readFakeSteadySyncVaultStatus()
          : { syncStatusKind: 'syncing', syncingFileCount: syncVaultTransferProgress.syncTransferFileCount - syncVaultTransferProgress.syncTransferredFileCount },
      syncVaultTransferProgress,
    }
    this.changeFakeSnapshot({
      syncLocalVaults: [...this.fakeEngineSnapshot.syncLocalVaults.filter((otherLocalVault) => otherLocalVault.papelizVaultId !== papelizVaultId), syncLocalVault],
    })
    this.changeFakeAccount({ syncedVaultCount: this.fakeEngineSnapshot.syncLocalVaults.length })
    return syncLocalVault
  }

  // Test and dev controls ------------------------------------------------------------------------

  finishFakeSyncSignIn(signInOutcome: PapelizSyncSignInOutcome = { syncSignInOutcome: 'signed-in' }): void {
    const fakePendingSignIn = this.fakePendingSignIn
    if (fakePendingSignIn === null) return
    this.fakePendingSignIn = null
    if (signInOutcome.syncSignInOutcome === 'signed-in') {
      this.fakeSignedInAt = this.fakeCurrentTime()
      const wasSignedInBefore = this.fakeEngineSnapshot.syncAccount !== null
      this.changeFakeSnapshot({
        syncSignIn: {
          syncSignInKind: 'signed-in',
          papelizSyncAccountId: papelizSyncFakeEngineAccountId,
          papelizSyncDeviceId: papelizSyncFakeEngineThisDeviceId,
          syncSignInEmailAddress: 'you@example.com',
          syncSignInMethod: 'email-code',
        },
        // A new device signs in to an account that already has a plan and keys.
        syncAccount: wasSignedInBefore ? this.fakeEngineSnapshot.syncAccount : this.buildFakeAccountReading(this.fakeEngineScenario === 'new-device' ? 'plus' : null),
        syncAccountKeyState: this.fakeSyncPassphrase === null ? 'not-set-up' : this.fakeEngineSnapshot.syncAccountKeyState === 'unlocked' ? 'unlocked' : 'locked',
      })
      for (const fakeEventListener of [...this.fakeEventListeners]) fakeEventListener({ syncEngineEventKind: 'signed-in' })
    } else {
      this.changeFakeSnapshot({ syncSignIn: this.fakeEngineSnapshot.syncAccount === null ? { syncSignInKind: 'signed-out' } : this.fakeEngineSnapshot.syncSignIn })
    }
    fakePendingSignIn.resolveSignIn(signInOutcome)
  }

  finishFakeSyncCheckout(): void {
    const fakePendingCheckoutPlanName = this.fakePendingCheckoutPlanName
    if (fakePendingCheckoutPlanName === null) return
    this.fakePendingCheckoutPlanName = null
    const syncPlanName = fakePendingCheckoutPlanName
    this.changeFakeAccount({
      syncPlanName,
      syncSubscriptionState: 'active',
      syncVisiblePlanLimits: papelizSyncFakeEnginePlanLimits[syncPlanName],
      syncSubscriptionRenewsAt: this.fakeCurrentTime() + 30 * 24 * 60 * 60_000,
    })
  }

  setFakeSyncVaultStatus(papelizVaultId: string, syncVaultStatus: PapelizSyncStatusReading, syncVaultTransferProgress: PapelizSyncLocalVaultReading['syncVaultTransferProgress'] = null): void {
    const hasFakeLocalVault = this.fakeEngineSnapshot.syncLocalVaults.some((syncLocalVault) => syncLocalVault.papelizVaultId === papelizVaultId)
    if (!hasFakeLocalVault) this.addFakeLocalVault(papelizVaultId, null)
    this.changeFakeSnapshot({
      syncLocalVaults: this.fakeEngineSnapshot.syncLocalVaults.map((syncLocalVault) =>
        syncLocalVault.papelizVaultId === papelizVaultId ? { ...syncLocalVault, syncVaultStatus, syncVaultTransferProgress } : syncLocalVault,
      ),
    })
  }

  addFakeSyncNoteClash(papelizVaultId: string, vaultNoteRelativePath: string): PapelizSyncNoteClashSummary {
    const syncNoteClash: PapelizSyncNoteClashSummary = {
      papelizSyncClashId: `pzclash-fake-${this.fakeEngineSnapshot.syncNoteClashesToSettle.length + 1}`,
      papelizVaultId,
      vaultNoteRelativePath,
      otherSyncDeviceName: 'Phone',
      otherSyncDevicePlatform: 'mobile',
      syncClashFoundAt: this.fakeCurrentTime(),
    }
    this.changeFakeSnapshot({ syncNoteClashesToSettle: [...this.fakeEngineSnapshot.syncNoteClashesToSettle, syncNoteClash] })
    this.refreshFakeLocalVaultStatuses()
    return syncNoteClash
  }

  emitFakeSyncEngineEvent(syncEngineEvent: PapelizSyncEngineEvent): void {
    for (const fakeEventListener of [...this.fakeEventListeners]) fakeEventListener(syncEngineEvent)
  }

  // The engine ---------------------------------------------------------------------------------

  async startSyncEngine(syncEnginePlatform: PapelizSyncEnginePlatform): Promise<void> {
    this.fakeEngineCallNames.push('startSyncEngine')
    this.fakeStartedSyncEnginePlatform = syncEnginePlatform
  }

  stopSyncEngine(): void {
    this.fakeEngineCallNames.push('stopSyncEngine')
    this.fakeSnapshotListeners.clear()
    this.fakeEventListeners.clear()
  }

  getSyncEngineSnapshot(): PapelizSyncEngineSnapshot {
    return this.fakeEngineSnapshot
  }

  subscribeToSyncEngineSnapshot(syncEngineSnapshotListener: () => void): () => void {
    this.fakeSnapshotListeners.add(syncEngineSnapshotListener)
    return () => this.fakeSnapshotListeners.delete(syncEngineSnapshotListener)
  }

  subscribeToSyncEngineEvents(syncEngineEventListener: (syncEngineEvent: PapelizSyncEngineEvent) => void): () => void {
    this.fakeEventListeners.add(syncEngineEventListener)
    return () => this.fakeEventListeners.delete(syncEngineEventListener)
  }

  async listSyncPlanOffers(): Promise<PapelizSyncActionOutcome<PapelizSyncPlanOfferReading[]>> {
    await this.waitForFakeCall('listSyncPlanOffers')
    const syncPlanOffers: PapelizSyncPlanOfferReading[] = []
    for (const syncPlanName of ['standard', 'plus', 'pro'] as const) {
      for (const syncBillingPeriod of ['yearly', 'monthly'] as const) {
        syncPlanOffers.push({
          syncPlanName,
          syncBillingPeriod,
          syncDisplayPrice: papelizSyncFakeEngineDisplayPrice,
          syncPriceCurrencyCode: 'XTS',
          syncVisiblePlanLimits: papelizSyncFakeEnginePlanLimits[syncPlanName],
        })
      }
    }
    return createFakeDoneOutcome(syncPlanOffers)
  }

  startSyncSignIn(syncSignInOptions: PapelizSyncSignInOptions): PapelizSyncSignInAttempt {
    this.fakeEngineCallNames.push('startSyncSignIn')
    this.fakeLastSignInOptions = syncSignInOptions
    this.fakePendingSignIn?.resolveSignIn({ syncSignInOutcome: 'cancelled' })
    const syncSignInOutcome = new Promise<PapelizSyncSignInOutcome>((resolveSignIn) => {
      this.fakePendingSignIn = { resolveSignIn }
    })
    if (this.fakeEngineSnapshot.syncSignIn.syncSignInKind !== 'signed-in') this.changeFakeSnapshot({ syncSignIn: { syncSignInKind: 'waiting-for-sign-in-page' } })
    if (this.fakeOtherTabFinishMilliseconds !== null) setTimeout(() => this.finishFakeSyncSignIn(), this.fakeOtherTabFinishMilliseconds)
    return {
      syncSignInPageUrl: 'about:blank#papeliz-sync-fake-sign-in',
      syncSignInOutcome,
      cancelSyncSignIn: () => this.finishFakeSyncSignIn({ syncSignInOutcome: 'cancelled' }),
    }
  }

  async signOutOfSync(): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('signOutOfSync')
    this.changeFakeSnapshot({
      syncSignIn: { syncSignInKind: 'signed-out' },
      syncAccount: null,
      syncAccountKeyState: 'unknown',
      syncLocalVaults: this.fakeEngineSnapshot.syncLocalVaults.map((syncLocalVault) => ({ ...syncLocalVault, syncVaultStatus: { syncStatusKind: 'signed-out' } })),
    })
    return createFakeDoneOutcome(null)
  }

  async refreshSyncAccountReading(): Promise<PapelizSyncActionOutcome<PapelizSyncAccountReading>> {
    await this.waitForFakeCall('refreshSyncAccountReading')
    const syncAccount = this.fakeEngineSnapshot.syncAccount
    if (syncAccount === null) return createFakeFailedOutcome('signed-out')
    this.changeFakeAccount({})
    return createFakeDoneOutcome(this.fakeEngineSnapshot.syncAccount ?? syncAccount)
  }

  async listSyncDevices(): Promise<PapelizSyncActionOutcome<PapelizSyncDeviceReading[]>> {
    await this.waitForFakeCall('listSyncDevices')
    if (!this.isFakeSignedIn()) return createFakeFailedOutcome('signed-out')
    const currentTime = this.fakeCurrentTime()
    const fakeSyncDevices: PapelizSyncDeviceReading[] = [
      {
        papelizSyncDeviceId: papelizSyncFakeEngineThisDeviceId,
        syncDeviceName: this.fakeThisDeviceName,
        syncDevicePlatform: 'web',
        syncDeviceAddedAt: currentTime - 40 * 24 * 60 * 60_000,
        syncDeviceLastSeenAt: currentTime,
        isThisSyncDevice: true,
      },
      {
        papelizSyncDeviceId: 'pzdev_bbbbbbbbbbbbbbbbbbbbbbbbbb',
        syncDeviceName: 'Phone',
        syncDevicePlatform: 'mobile',
        syncDeviceAddedAt: currentTime - 20 * 24 * 60 * 60_000,
        syncDeviceLastSeenAt: currentTime - 2 * 60 * 60_000,
        isThisSyncDevice: false,
      },
      {
        papelizSyncDeviceId: 'pzdev_cccccccccccccccccccccccccc',
        syncDeviceName: 'Laptop',
        syncDevicePlatform: 'desktop',
        syncDeviceAddedAt: currentTime - 10 * 24 * 60 * 60_000,
        syncDeviceLastSeenAt: currentTime - 26 * 60 * 60_000,
        isThisSyncDevice: false,
      },
    ]
    return createFakeDoneOutcome(fakeSyncDevices.filter((fakeSyncDevice) => !this.fakeRemovedDeviceIds.has(fakeSyncDevice.papelizSyncDeviceId)))
  }

  async nameThisSyncDevice(syncDeviceName: string): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('nameThisSyncDevice')
    this.fakeThisDeviceName = syncDeviceName
    return createFakeDoneOutcome(null)
  }

  async removeSyncDevice(papelizSyncDeviceId: string): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('removeSyncDevice')
    this.fakeRemovedDeviceIds.add(papelizSyncDeviceId)
    return createFakeDoneOutcome(null)
  }

  async createSyncCheckoutPageUrl(syncPlanName: PapelizSyncPlanName, _syncBillingPeriod: PapelizSyncBillingPeriod): Promise<PapelizSyncActionOutcome<string>> {
    await this.waitForFakeCall('createSyncCheckoutPageUrl')
    if (!this.isFakeSignedIn()) return createFakeFailedOutcome('signed-out')
    this.fakePendingCheckoutPlanName = syncPlanName
    if (this.fakeOtherTabFinishMilliseconds !== null) setTimeout(() => this.finishFakeSyncCheckout(), this.fakeOtherTabFinishMilliseconds)
    return createFakeDoneOutcome('about:blank#papeliz-sync-fake-checkout')
  }

  async createSyncBillingPortalUrl(): Promise<PapelizSyncActionOutcome<string>> {
    await this.waitForFakeCall('createSyncBillingPortalUrl')
    return this.isFakeSignedIn() ? createFakeDoneOutcome('about:blank#papeliz-sync-fake-billing') : createFakeFailedOutcome('signed-out')
  }

  private isFakeSignInFresh(): boolean {
    return this.fakeCurrentTime() - this.fakeSignedInAt <= papelizSyncFakeEngineFreshSignInMilliseconds
  }

  async deleteSyncAccount(): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('deleteSyncAccount')
    if (!this.isFakeSignInFresh()) return createFakeFailedOutcome('fresh-sign-in-required')
    this.fakeSyncPassphrase = null
    this.fakeSyncRecoveryKeyText = null
    this.changeFakeSnapshot({ syncSignIn: { syncSignInKind: 'signed-out' }, syncAccount: null, syncAccountKeyState: 'unknown', syncLocalVaults: [], syncNoteClashesToSettle: [] })
    return createFakeDoneOutcome(null)
  }

  private makeFakeKeyDraft(syncPassphrase: string): PapelizSyncAccountKeyDraft {
    this.fakeKeyDraftCount += 1
    const syncAccountKeyDraftId = `fake-key-draft-${this.fakeKeyDraftCount}`
    this.fakePendingKeyDraft = { syncAccountKeyDraftId, syncPassphrase, syncRecoveryKeyText: papelizSyncFakeEngineRecoveryKeyText }
    return { syncAccountKeyDraftId, syncRecoveryKeyText: papelizSyncFakeEngineRecoveryKeyText }
  }

  async prepareSyncAccountKeys(syncPassphrase: string): Promise<PapelizSyncActionOutcome<PapelizSyncAccountKeyDraft>> {
    await this.waitForFakeCall('prepareSyncAccountKeys')
    if (!isPapelizSyncPassphraseLongEnough(syncPassphrase)) return createFakeFailedOutcome('passphrase-too-short')
    if (this.fakeEngineSnapshot.syncAccountKeyState !== 'not-set-up') return createFakeFailedOutcome('changed-elsewhere')
    return createFakeDoneOutcome(this.makeFakeKeyDraft(syncPassphrase))
  }

  async confirmSyncAccountKeys(syncAccountKeyDraftId: string): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('confirmSyncAccountKeys')
    if (this.fakePendingKeyDraft?.syncAccountKeyDraftId !== syncAccountKeyDraftId) return createFakeFailedOutcome('not-found')
    this.fakeSyncPassphrase = this.fakePendingKeyDraft.syncPassphrase
    this.fakeSyncRecoveryKeyText = this.fakePendingKeyDraft.syncRecoveryKeyText
    this.fakePendingKeyDraft = null
    this.changeFakeSnapshot({ syncAccountKeyState: 'unlocked' })
    this.refreshFakeLocalVaultStatuses()
    return createFakeDoneOutcome(null)
  }

  async unlockSyncWithPassphrase(syncPassphrase: string): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('unlockSyncWithPassphrase')
    if (this.fakeSyncPassphrase === null) return createFakeFailedOutcome('not-found')
    if (syncPassphrase.normalize('NFC') !== this.fakeSyncPassphrase.normalize('NFC')) return createFakeFailedOutcome('wrong-passphrase')
    this.changeFakeSnapshot({ syncAccountKeyState: 'unlocked' })
    this.refreshFakeLocalVaultStatuses()
    return createFakeDoneOutcome(null)
  }

  async unlockSyncWithRecoveryKey(syncRecoveryKeyText: string, newSyncPassphrase: string): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('unlockSyncWithRecoveryKey')
    if (this.fakeSyncRecoveryKeyText === null) return createFakeFailedOutcome('not-found')
    if (tidyPapelizSyncRecoveryKeyText(syncRecoveryKeyText) !== tidyPapelizSyncRecoveryKeyText(this.fakeSyncRecoveryKeyText)) return createFakeFailedOutcome('wrong-recovery-key')
    if (!isPapelizSyncPassphraseLongEnough(newSyncPassphrase)) return createFakeFailedOutcome('passphrase-too-short')
    this.fakeSyncPassphrase = newSyncPassphrase
    this.changeFakeSnapshot({ syncAccountKeyState: 'unlocked' })
    this.refreshFakeLocalVaultStatuses()
    return createFakeDoneOutcome(null)
  }

  async changeSyncPassphrase(newSyncPassphrase: string): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('changeSyncPassphrase')
    if (!this.isFakeSignInFresh()) return createFakeFailedOutcome('fresh-sign-in-required')
    if (!isPapelizSyncPassphraseLongEnough(newSyncPassphrase)) return createFakeFailedOutcome('passphrase-too-short')
    this.fakeSyncPassphrase = newSyncPassphrase
    return createFakeDoneOutcome(null)
  }

  async startSyncOver(newSyncPassphrase: string): Promise<PapelizSyncActionOutcome<PapelizSyncAccountKeyDraft>> {
    await this.waitForFakeCall('startSyncOver')
    if (!this.isFakeSignInFresh()) return createFakeFailedOutcome('fresh-sign-in-required')
    if (!isPapelizSyncPassphraseLongEnough(newSyncPassphrase)) return createFakeFailedOutcome('passphrase-too-short')
    this.fakeSyncPassphrase = null
    this.fakeSyncRecoveryKeyText = null
    this.changeFakeSnapshot({ syncAccountKeyState: 'not-set-up', syncLocalVaults: [], syncNoteClashesToSettle: [] })
    this.changeFakeAccount({ syncStorageUsedByteLength: 0, syncedVaultCount: 0 })
    return createFakeDoneOutcome(this.makeFakeKeyDraft(newSyncPassphrase))
  }

  attachSyncToOpenVault(openLocalVault: PapelizSyncOpenLocalVault): () => void {
    this.fakeEngineCallNames.push('attachSyncToOpenVault')
    const { papelizVaultId, papelizVaultDisplayName, syncLocalVaultFiles } = openLocalVault
    this.fakeAttachedVaultsById.set(papelizVaultId, { papelizVaultId, papelizVaultDisplayName, syncLocalVaultFiles })
    // The scenarios past set-up start with this device already syncing whatever vault it opens; a new
    // device syncs only what it downloads.
    const isSyncedInScenario =
      (this.fakeEngineSnapshot.syncAccountKeyState === 'unlocked' || this.fakeEngineSnapshot.syncAccountKeyState === 'locked') && !isPapelizSyncFakeNewDeviceScenario(this.fakeEngineScenario)
    const attachedLocalVault = this.fakeEngineSnapshot.syncLocalVaults.find((syncLocalVault) => syncLocalVault.papelizVaultId === papelizVaultId)
    if (isSyncedInScenario && attachedLocalVault === undefined) {
      this.addFakeLocalVault(papelizVaultId, null)
      if (this.fakeEngineScenario === 'to-settle' && this.fakeEngineSnapshot.syncNoteClashesToSettle.length === 0) this.addFakeSyncNoteClash(papelizVaultId, 'Welcome.md')
    }
    // A download that stopped goes on when its vault is attached again, as the real engine's does.
    const stoppedTransferProgress = attachedLocalVault?.syncVaultStatus.syncStatusKind === 'offline' ? attachedLocalVault.syncVaultTransferProgress : null
    if (stoppedTransferProgress !== null && stoppedTransferProgress !== undefined) {
      this.runFakeFirstTransfer(papelizVaultId, stoppedTransferProgress.syncVaultTransferKind, stoppedTransferProgress.syncTransferFileCount, stoppedTransferProgress.syncTransferredFileCount)
    }
    return () => {
      this.fakeEngineCallNames.push('detachSyncFromOpenVault')
      this.fakeAttachedVaultsById.delete(papelizVaultId)
    }
  }

  async listSyncedVaultsOnAccount(): Promise<PapelizSyncActionOutcome<PapelizSyncAccountVaultReading[]>> {
    await this.waitForFakeCall('listSyncedVaultsOnAccount')
    if (!this.isFakeSignedIn()) return createFakeFailedOutcome('signed-out')
    const isLocked = this.fakeEngineSnapshot.syncAccountKeyState !== 'unlocked'
    const currentTime = this.fakeCurrentTime()
    const downloadedPapelizVaultIds = new Set(this.fakeDownloadedPapelizVaultIdsBySyncVaultId.values())
    const fakeAccountVaults: PapelizSyncAccountVaultReading[] = this.fakeEngineSnapshot.syncLocalVaults
      .filter((syncLocalVault) => !downloadedPapelizVaultIds.has(syncLocalVault.papelizVaultId))
      .map((syncLocalVault) => ({
        papelizSyncVaultId: syncLocalVault.papelizSyncVaultId,
        syncVaultName: isLocked ? null : (this.fakeAttachedVaultsById.get(syncLocalVault.papelizVaultId)?.papelizVaultDisplayName ?? 'Synced vault'),
        syncVaultFileCount: 128,
        syncVaultStoredByteLength: 42e6,
        syncVaultCreatedAt: currentTime - 30 * 24 * 60 * 60_000,
        papelizVaultIdOnThisDevice: syncLocalVault.papelizVaultId,
      }))
    for (const fakeAccountOnlyVault of this.fakeAccountOnlyVaults) {
      fakeAccountVaults.push({
        papelizSyncVaultId: fakeAccountOnlyVault.papelizSyncVaultId,
        syncVaultName: isLocked ? null : fakeAccountOnlyVault.syncVaultName,
        syncVaultFileCount: fakeAccountOnlyVault.syncVaultFileCount,
        syncVaultStoredByteLength: fakeAccountOnlyVault.syncVaultStoredByteLength,
        syncVaultCreatedAt: currentTime - fakeAccountOnlyVault.syncVaultCreatedDaysAgo * 24 * 60 * 60_000,
        papelizVaultIdOnThisDevice: this.fakeDownloadedPapelizVaultIdsBySyncVaultId.get(fakeAccountOnlyVault.papelizSyncVaultId) ?? null,
      })
    }
    return createFakeDoneOutcome(fakeAccountVaults)
  }

  // A download's few notes, written into the vault before it reads as synced. A vault whose files
  // can't be written (one without whole-file access) still finishes, with a warning.
  private async writeFakeDownloadedVaultFiles(papelizVaultId: string): Promise<void> {
    const syncLocalVaultFiles = this.fakeAttachedVaultsById.get(papelizVaultId)?.syncLocalVaultFiles
    const downloadedSyncVaultId = [...this.fakeDownloadedPapelizVaultIdsBySyncVaultId].find(([, downloadedPapelizVaultId]) => downloadedPapelizVaultId === papelizVaultId)?.[0]
    const fakeAccountOnlyVault = this.fakeAccountOnlyVaults.find((accountOnlyVault) => accountOnlyVault.papelizSyncVaultId === downloadedSyncVaultId)
    if (syncLocalVaultFiles === undefined || fakeAccountOnlyVault === undefined) return
    try {
      for (const [vaultNoteRelativePath, vaultNoteText] of Object.entries(fakeAccountOnlyVault.syncVaultFakeNoteTextsByRelativePath)) {
        await syncLocalVaultFiles.writeVaultFileBytes(vaultNoteRelativePath, new TextEncoder().encode(vaultNoteText))
      }
    } catch (fakeVaultWriteError) {
      console.warn('Papeliz Sync fake engine: the downloaded notes weren’t written.', fakeVaultWriteError)
    }
  }

  // The fake's first upload or download: the progress counts up in the dev server (ten steps), or
  // finishes as soon as a download's notes are written in tests. `download-stops` stops one download
  // halfway, offline, once.
  private runFakeFirstTransfer(
    papelizVaultId: string,
    syncVaultTransferKind: 'first-upload' | 'first-download' | 'connect',
    syncTransferFileCount = 40,
    syncAlreadyTransferredFileCount = 0,
  ): void {
    if (this.fakeCallDelayMilliseconds === 0) {
      if (syncVaultTransferKind !== 'first-download') {
        this.addFakeLocalVault(papelizVaultId, null)
        return
      }
      this.addFakeLocalVault(papelizVaultId, { syncVaultTransferKind, syncTransferredFileCount: syncAlreadyTransferredFileCount, syncTransferFileCount })
      void this.writeFakeDownloadedVaultFiles(papelizVaultId).then(() => this.setFakeSyncVaultStatus(papelizVaultId, this.readFakeSteadySyncVaultStatus(), null))
      return
    }
    this.addFakeLocalVault(papelizVaultId, { syncVaultTransferKind, syncTransferredFileCount: syncAlreadyTransferredFileCount, syncTransferFileCount })
    let syncTransferredFileCount = syncAlreadyTransferredFileCount
    const syncTransferStepFileCount = Math.max(4, Math.ceil(syncTransferFileCount / 10))
    const fakeTransferTimer = setInterval(() => {
      syncTransferredFileCount = Math.min(syncTransferFileCount, syncTransferredFileCount + syncTransferStepFileCount)
      if (this.fakeEngineScenario === 'download-stops' && !this.isFakeDownloadStopUsed && syncTransferredFileCount >= syncTransferFileCount / 2) {
        this.isFakeDownloadStopUsed = true
        clearInterval(fakeTransferTimer)
        this.setFakeSyncVaultStatus(
          papelizVaultId,
          { syncStatusKind: 'offline', syncWaitingFileCount: syncTransferFileCount - syncTransferredFileCount },
          { syncVaultTransferKind, syncTransferredFileCount, syncTransferFileCount },
        )
        return
      }
      if (syncTransferredFileCount >= syncTransferFileCount) {
        clearInterval(fakeTransferTimer)
        void this.writeFakeDownloadedVaultFiles(papelizVaultId).then(() => this.setFakeSyncVaultStatus(papelizVaultId, this.readFakeSteadySyncVaultStatus(), null))
        return
      }
      this.setFakeSyncVaultStatus(
        papelizVaultId,
        { syncStatusKind: 'syncing', syncingFileCount: syncTransferFileCount - syncTransferredFileCount },
        { syncVaultTransferKind, syncTransferredFileCount, syncTransferFileCount },
      )
    }, 400)
  }

  async turnSyncOnForVault(papelizVaultId: string): Promise<PapelizSyncActionOutcome<{ papelizSyncVaultId: string }>> {
    await this.waitForFakeCall('turnSyncOnForVault')
    if (this.fakeEngineSnapshot.syncAccountKeyState !== 'unlocked') return createFakeFailedOutcome('locked')
    const syncAccount = this.fakeEngineSnapshot.syncAccount
    if (syncAccount === null || syncAccount.syncSubscriptionState === 'not-subscribed') return createFakeFailedOutcome('subscription-required')
    if (syncAccount.syncSubscriptionState === 'ended-read-only' || syncAccount.syncSubscriptionState === 'ended-held') return createFakeFailedOutcome('read-only')
    this.runFakeFirstTransfer(papelizVaultId, 'first-upload')
    const syncLocalVault = this.fakeEngineSnapshot.syncLocalVaults.find((otherLocalVault) => otherLocalVault.papelizVaultId === papelizVaultId)
    return createFakeDoneOutcome({ papelizSyncVaultId: syncLocalVault?.papelizSyncVaultId ?? '' })
  }

  async downloadSyncedVaultInto(papelizSyncVaultId: string, papelizVaultId: string): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('downloadSyncedVaultInto')
    if (!this.isFakeSignedIn()) return createFakeFailedOutcome('signed-out')
    if (this.fakeEngineSnapshot.syncAccountKeyState !== 'unlocked') return createFakeFailedOutcome('locked')
    const fakeAccountOnlyVault = this.fakeAccountOnlyVaults.find((accountOnlyVault) => accountOnlyVault.papelizSyncVaultId === papelizSyncVaultId)
    if (fakeAccountOnlyVault !== undefined) this.fakeDownloadedPapelizVaultIdsBySyncVaultId.set(papelizSyncVaultId, papelizVaultId)
    this.runFakeFirstTransfer(papelizVaultId, 'first-download', fakeAccountOnlyVault?.syncVaultFileCount)
    return createFakeDoneOutcome(null)
  }

  async connectVaultToSyncedVault(papelizVaultId: string, _papelizSyncVaultId: string): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('connectVaultToSyncedVault')
    if (this.fakeEngineSnapshot.syncAccountKeyState !== 'unlocked') return createFakeFailedOutcome('locked')
    this.runFakeFirstTransfer(papelizVaultId, 'connect')
    return createFakeDoneOutcome(null)
  }

  async turnSyncOffForVault(papelizVaultId: string): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('turnSyncOffForVault')
    for (const [papelizSyncVaultId, downloadedPapelizVaultId] of this.fakeDownloadedPapelizVaultIdsBySyncVaultId) {
      if (downloadedPapelizVaultId === papelizVaultId) this.fakeDownloadedPapelizVaultIdsBySyncVaultId.delete(papelizSyncVaultId)
    }
    this.changeFakeSnapshot({ syncLocalVaults: this.fakeEngineSnapshot.syncLocalVaults.filter((syncLocalVault) => syncLocalVault.papelizVaultId !== papelizVaultId) })
    this.changeFakeAccount({ syncedVaultCount: this.fakeEngineSnapshot.syncLocalVaults.length })
    return createFakeDoneOutcome(null)
  }

  async deleteSyncedVaultFromAccount(papelizSyncVaultId: string): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('deleteSyncedVaultFromAccount')
    this.changeFakeSnapshot({
      syncLocalVaults: this.fakeEngineSnapshot.syncLocalVaults.filter((syncLocalVault) => syncLocalVault.papelizSyncVaultId !== papelizSyncVaultId),
    })
    return createFakeDoneOutcome(null)
  }

  async setSyncPausedOnThisDevice(isSyncPausedOnThisDevice: boolean): Promise<void> {
    await this.waitForFakeCall('setSyncPausedOnThisDevice')
    this.changeFakeSnapshot({ isSyncPausedOnThisDevice })
    this.refreshFakeLocalVaultStatuses()
  }

  async setSyncWhatSyncsChoices(syncWhatSyncsChoices: PapelizSyncWhatSyncsChoices): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('setSyncWhatSyncsChoices')
    this.changeFakeSnapshot({ syncWhatSyncsChoices })
    return createFakeDoneOutcome(null)
  }

  reportSyncVaultFileSaved(papelizVaultId: string, vaultFileRelativePath: string): void {
    this.fakeEngineCallNames.push('reportSyncVaultFileSaved')
    this.fakeReportedSyncVaultFileSaves.push({ papelizVaultId, vaultFileRelativePath })
  }

  reportSyncVaultNoteLeft(papelizVaultId: string, vaultNoteRelativePath: string): void {
    this.fakeEngineCallNames.push('reportSyncVaultNoteLeft')
    this.fakeReportedSyncVaultNoteLeaves.push({ papelizVaultId, vaultNoteRelativePath })
  }

  reportSyncVaultEntryRenamed(_papelizVaultId: string, _fromVaultEntryRelativePath: string, _toVaultEntryRelativePath: string): void {
    this.fakeEngineCallNames.push('reportSyncVaultEntryRenamed')
  }

  reportSyncVaultEntryMovedToTrash(_papelizVaultId: string, _vaultEntryRelativePath: string, _vaultTrashRelativePath: string): void {
    this.fakeEngineCallNames.push('reportSyncVaultEntryMovedToTrash')
  }

  async sendWaitingSyncChangesNow(): Promise<void> {
    this.fakeEngineCallNames.push('sendWaitingSyncChangesNow')
  }

  async readSyncNoteClashTexts(papelizSyncClashId: string): Promise<PapelizSyncNoteClashTexts | null> {
    await this.waitForFakeCall('readSyncNoteClashTexts')
    if (!this.fakeEngineSnapshot.syncNoteClashesToSettle.some((syncNoteClash) => syncNoteClash.papelizSyncClashId === papelizSyncClashId)) return null
    return {
      baseNoteText: '# Plan\n\nGoals for the quarter.\n\nLaunch the beta.\n',
      otherDeviceNoteText: '# Plan\n\nGoals for the quarter.\n\nLaunch the beta in the second week.\n',
      thisDeviceNoteText: '# Plan\n\nGoals for the quarter, the beta and the review.\n\nLaunch the beta after the security review.\n',
    }
  }

  readonly fakeSettledSyncNoteTexts: Array<{ papelizSyncClashId: string; settledNoteText: string }> = []

  async settleSyncNoteClash(papelizSyncClashId: string, settledNoteText: string): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('settleSyncNoteClash')
    this.fakeSettledSyncNoteTexts.push({ papelizSyncClashId, settledNoteText })
    this.changeFakeSnapshot({
      syncNoteClashesToSettle: this.fakeEngineSnapshot.syncNoteClashesToSettle.filter((syncNoteClash) => syncNoteClash.papelizSyncClashId !== papelizSyncClashId),
    })
    this.refreshFakeLocalVaultStatuses()
    return createFakeDoneOutcome(null)
  }

  async listSyncFileVersions(_papelizVaultId: string, _vaultFileRelativePath: string): Promise<PapelizSyncActionOutcome<PapelizSyncFileVersionReading[]>> {
    await this.waitForFakeCall('listSyncFileVersions')
    if (this.fakeEngineSnapshot.syncAccountKeyState !== 'unlocked') return createFakeFailedOutcome('locked')
    const currentTime = this.fakeCurrentTime()
    return createFakeDoneOutcome([
      { syncFileVersion: 3, syncFileChangedAt: currentTime - 5 * 60_000, syncFileChangedOnDeviceName: null, syncFileStoredByteLength: 2048, isSyncFileDeletedInVersion: false },
      { syncFileVersion: 2, syncFileChangedAt: currentTime - 3 * 60 * 60_000, syncFileChangedOnDeviceName: 'Phone', syncFileStoredByteLength: 2048, isSyncFileDeletedInVersion: false },
      { syncFileVersion: 1, syncFileChangedAt: currentTime - 3 * 24 * 60 * 60_000, syncFileChangedOnDeviceName: 'Laptop', syncFileStoredByteLength: 1024, isSyncFileDeletedInVersion: false },
    ])
  }

  async readSyncFileVersionBytes(_papelizVaultId: string, _vaultFileRelativePath: string, syncFileVersion: number): Promise<PapelizSyncActionOutcome<Uint8Array>> {
    await this.waitForFakeCall('readSyncFileVersionBytes')
    return createFakeDoneOutcome(new TextEncoder().encode(`Version ${syncFileVersion} of this note, from the fake engine.\n`))
  }

  async restoreSyncFileVersion(_papelizVaultId: string, _vaultFileRelativePath: string, _syncFileVersion: number): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('restoreSyncFileVersion')
    return createFakeDoneOutcome(null)
  }
}

export function createPapelizSyncFakeEngine(fakeEngineOptions: PapelizSyncFakeEngineOptions): PapelizSyncFakeEngine {
  return new PapelizSyncFakeEngine(fakeEngineOptions)
}

// The fake's storage place for a new account, as the screens passed it.
export function readPapelizSyncFakeEngineStoragePlaceForNewAccount(papelizSyncFakeEngine: PapelizSyncFakeEngine): PapelizSyncStoragePlace | null {
  return papelizSyncFakeEngine.fakeLastSignInOptions?.papelizSyncStoragePlaceForNewAccount ?? null
}
