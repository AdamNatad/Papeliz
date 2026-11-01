import type {
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
  PapelizSyncLinkedLocalVaultReading,
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
  PapelizSyncVaultEncryptionChoice,
  PapelizSyncVaultEncryptionKind,
  PapelizSyncVaultLockState,
  PapelizSyncVisiblePlanLimits,
  PapelizSyncWhatSyncsChoices,
} from './papeliz-sync-engine-contract'
import { isPapelizSyncPassphraseLongEnough } from './papeliz-sync-screen-words'

// A stand-in for the Papeliz Sync engine that keeps everything in memory and talks to no server,
// for the screens' tests and for the dev server's switch (papeliz-sync-engine-store.ts, dev builds
// only). Each scenario starts the fake in one of the states the Sync and Account pages show. Its
// prices are the ISO 4217 test currency, never a real one.

export type PapelizSyncFakeEngineScenario =
  | 'signed-out'
  | 'not-subscribed'
  // Subscribed, and no vault syncs yet: the open vault waits for Turn on Sync.
  | 'nothing-synced-yet'
  // The open vault syncs End-to-end, and this device lost its key: its passphrase opens it again.
  | 'locked'
  | 'on'
  | 'paused-on-this-device'
  | 'over-storage'
  | 'subscription-ended'
  | 'to-settle'
  // The open vault syncs, and most of its files went missing on this device while it was closed: its
  // status reads `files-missing` until Download them again or They were deleted.
  | 'files-missing'
  // A new device: signed out, and once signed in, three synced vaults on the account and none of them
  // here (the start screen's Synced Vaults page). "Research notes" is End-to-end, so it asks its
  // passphrase before downloading; "Work" and "Recipes" are Standard.
  | 'new-device'
  // Signed in with the same three vaults; a download stops halfway once, as if the connection
  // dropped, and goes on when tried again.
  | 'download-stops'

export const papelizSyncFakeEngineScenarios: readonly PapelizSyncFakeEngineScenario[] = [
  'signed-out',
  'not-subscribed',
  'nothing-synced-yet',
  'locked',
  'on',
  'paused-on-this-device',
  'over-storage',
  'subscription-ended',
  'to-settle',
  'files-missing',
  'new-device',
  'download-stops',
]

export function isPapelizSyncFakeEngineScenario(fakeEngineScenarioText: string): fakeEngineScenarioText is PapelizSyncFakeEngineScenario {
  return (papelizSyncFakeEngineScenarios as readonly string[]).includes(fakeEngineScenarioText)
}

// The passphrase of every End-to-end vault the fake starts with.
export const papelizSyncFakeEngineVaultPassphrase = 'papeliz fake passphrase'
export const papelizSyncFakeEngineDisplayPrice = '0.00 XTS'

// The scenarios where this device already syncs whatever vault it opens (Standard, or End-to-end and
// locked); the others sync only what is turned on or downloaded.
const papelizSyncFakeEngineScenariosSyncingEveryOpenVault: ReadonlySet<PapelizSyncFakeEngineScenario> = new Set([
  'locked',
  'on',
  'paused-on-this-device',
  'over-storage',
  'subscription-ended',
  'to-settle',
  'files-missing',
])

// The files the `files-missing` scenario's open vault is missing here.
const papelizSyncFakeEngineMissingFileCount = 14

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
  // Where the fake keeps its sign-in, the End-to-end vaults it unlocked and its linked vaults between
  // page loads, as a real engine keeps them on the device: the tab's session storage in the dev
  // server, nothing in tests unless a test passes its own.
  fakeEngineKeptStateStorage?: Pick<Storage, 'getItem' | 'setItem'> | null
}

// The dev server's tab keeps the fake's device state, so a reload shows what a real engine would
// remember: the start screen's "Synced" rows, and a first download picking up where it was.
function readPapelizSyncFakeEngineDevServerStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  if (import.meta.env.MODE === 'test' || typeof sessionStorage === 'undefined') return null
  return sessionStorage
}

const papelizSyncFakeEngineKeptStateStorageKeyPrefix = 'papeliz:sync-dev-fake-engine-kept-state:v2:'

// A linked vault as the fake keeps it; the counts are set while its first download is unfinished.
interface PapelizSyncFakeKeptLinkedVault {
  papelizVaultId: string
  papelizSyncVaultId: string
  syncVaultEncryptionKind: PapelizSyncVaultEncryptionKind
  syncTransferredFileCount: number | null
  syncTransferFileCount: number | null
}

interface PapelizSyncFakeEngineKeptState {
  isFakeSignedIn: boolean
  // The End-to-end vaults whose key this device holds.
  fakeUnlockedSyncVaultIds: string[]
  isFakeDownloadStopUsed: boolean
  fakeKeptLinkedVaults: PapelizSyncFakeKeptLinkedVault[]
}

function readPapelizSyncFakeEngineKeptState(
  fakeEngineKeptStateStorage: Pick<Storage, 'getItem' | 'setItem'> | null,
  fakeEngineScenario: PapelizSyncFakeEngineScenario,
): PapelizSyncFakeEngineKeptState | null {
  try {
    const keptStateText = fakeEngineKeptStateStorage?.getItem(`${papelizSyncFakeEngineKeptStateStorageKeyPrefix}${fakeEngineScenario}`) ?? null
    return keptStateText === null ? null : (JSON.parse(keptStateText) as PapelizSyncFakeEngineKeptState)
  } catch {
    return null
  }
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
  syncVaultEncryptionKind: PapelizSyncVaultEncryptionKind
  syncVaultFileCount: number
  syncVaultStoredByteLength: number
  syncVaultCreatedDaysAgo: number
  syncVaultFakeNoteTextsByRelativePath: Readonly<Record<string, string>>
}

const papelizSyncFakeEngineNewDeviceAccountVaults: readonly PapelizSyncFakeAccountOnlyVault[] = [
  {
    papelizSyncVaultId: 'pzvault_dddddddddddddddddddddddddd',
    syncVaultName: 'Research notes',
    syncVaultEncryptionKind: 'end-to-end',
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
    syncVaultEncryptionKind: 'standard',
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
    syncVaultEncryptionKind: 'standard',
    syncVaultFileCount: 64,
    syncVaultStoredByteLength: 3.1e6,
    syncVaultCreatedDaysAgo: 12,
    syncVaultFakeNoteTextsByRelativePath: {
      'Breakfast/Pancakes.md': '# Pancakes\n\nDownloaded by the fake engine.\n',
      'Dinner/Adobo.md': '# Adobo\n\nDownloaded by the fake engine.\n',
    },
  },
]

// The locked scenario's account has one more End-to-end vault, not on this device. Its name is its own,
// so it isn't mistaken for a new device's vault downloaded here before and opened.
const papelizSyncFakeEngineLockedScenarioAccountVault: PapelizSyncFakeAccountOnlyVault = {
  papelizSyncVaultId: 'pzvault_gggggggggggggggggggggggggg',
  syncVaultName: 'Travel journal',
  syncVaultEncryptionKind: 'end-to-end',
  syncVaultFileCount: 318,
  syncVaultStoredByteLength: 96e6,
  syncVaultCreatedDaysAgo: 90,
  syncVaultFakeNoteTextsByRelativePath: {
    'Lisbon.md': '# Lisbon\n\nDownloaded by the fake engine.\n',
  },
}

function listPapelizSyncFakeAccountOnlyVaults(fakeEngineScenario: PapelizSyncFakeEngineScenario): PapelizSyncFakeAccountOnlyVault[] {
  if (fakeEngineScenario === 'new-device' || fakeEngineScenario === 'download-stops') return [...papelizSyncFakeEngineNewDeviceAccountVaults]
  if (fakeEngineScenario === 'locked') return [papelizSyncFakeEngineLockedScenarioAccountVault]
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

// The new device's synced vaults as the account lists them, for the Synced Vaults page's previewer:
// none of them on this device (the End-to-end one locked), or every one of them.
export function listPapelizSyncFakeNewDeviceAccountVaultReadings(currentTime: number, isEveryFakeVaultOnThisDevice: boolean): PapelizSyncAccountVaultReading[] {
  return papelizSyncFakeEngineNewDeviceAccountVaults.map((fakeAccountOnlyVault) => ({
    papelizSyncVaultId: fakeAccountOnlyVault.papelizSyncVaultId,
    syncVaultName: fakeAccountOnlyVault.syncVaultName,
    syncVaultEncryptionKind: fakeAccountOnlyVault.syncVaultEncryptionKind,
    syncVaultLockState: isEveryFakeVaultOnThisDevice || fakeAccountOnlyVault.syncVaultEncryptionKind === 'standard' ? 'unlocked' : 'locked',
    syncVaultFileCount: fakeAccountOnlyVault.syncVaultFileCount,
    syncVaultStoredByteLength: fakeAccountOnlyVault.syncVaultStoredByteLength,
    syncVaultCreatedAt: currentTime - fakeAccountOnlyVault.syncVaultCreatedDaysAgo * 24 * 60 * 60_000,
    papelizVaultIdOnThisDevice: isEveryFakeVaultOnThisDevice ? `${fakeAccountOnlyVault.papelizSyncVaultId}-on-this-device` : null,
  }))
}

export class PapelizSyncFakeEngine implements PapelizSyncEngine {
  // Every call, in order, so tests can check what the screens asked for (and what they didn't).
  readonly fakeEngineCallNames: string[] = []
  readonly fakeReportedSyncVaultFileSaves: Array<{ papelizVaultId: string; vaultFileRelativePath: string }> = []
  readonly fakeReportedSyncVaultNoteLeaves: Array<{ papelizVaultId: string; vaultNoteRelativePath: string }> = []
  readonly fakeReportedSyncVaultEntryRenames: Array<{ papelizVaultId: string; fromVaultEntryRelativePath: string; toVaultEntryRelativePath: string }> = []
  readonly fakeReportedSyncVaultEntryTrashMoves: Array<{ papelizVaultId: string; vaultEntryRelativePath: string; vaultTrashRelativePath: string }> = []
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
  // Each synced vault's kind and, for End-to-end, its passphrase, by its synced vault; the account's
  // own vaults read theirs from the list when they aren't here.
  private readonly fakeVaultEncryptionKindsBySyncVaultId = new Map<string, PapelizSyncVaultEncryptionKind>()
  private readonly fakeVaultPassphrasesBySyncVaultId = new Map<string, string>()
  // The End-to-end vaults whose key this device holds; a Standard vault's key always comes when needed.
  private readonly fakeUnlockedSyncVaultIds = new Set<string>()
  private fakeSignedInAt: number
  private fakePendingSignIn: { resolveSignIn: (signInOutcome: PapelizSyncSignInOutcome) => void } | null = null
  private fakePendingCheckoutPlanName: PapelizSyncPlanName | null = null
  private fakeThisDeviceName: string | null = null
  // Files missing on this device, by the synced vault: held until Download them again or They were deleted.
  private readonly fakeMissingFileCountsBySyncVaultId = new Map<string, number>()
  private fakeRemovedDeviceIds = new Set<string>()
  private readonly fakeAccountOnlyVaults: PapelizSyncFakeAccountOnlyVault[]
  // A synced vault downloaded here, by its synced vault: the vault on this device that syncs with it.
  private readonly fakeDownloadedPapelizVaultIdsBySyncVaultId = new Map<string, string>()
  // `download-stops` stops one download halfway, once.
  private isFakeDownloadStopUsed = false
  private readonly fakeEngineKeptStateStorage: Pick<Storage, 'getItem' | 'setItem'> | null
  // Linked vaults kept from the last page load that haven't been attached since.
  private readonly fakeKeptLinkedVaultsById = new Map<string, PapelizSyncFakeKeptLinkedVault>()

  constructor({
    fakeEngineScenario,
    fakeCallDelayMilliseconds = 0,
    fakeOtherTabFinishMilliseconds = null,
    fakeCurrentTime = () => Date.now(),
    fakeEngineKeptStateStorage = readPapelizSyncFakeEngineDevServerStorage(),
  }: PapelizSyncFakeEngineOptions) {
    this.fakeEngineScenario = fakeEngineScenario
    this.fakeCallDelayMilliseconds = fakeCallDelayMilliseconds
    this.fakeOtherTabFinishMilliseconds = fakeOtherTabFinishMilliseconds
    this.fakeCurrentTime = fakeCurrentTime
    this.fakeEngineKeptStateStorage = fakeEngineKeptStateStorage
    this.fakeAccountOnlyVaults = listPapelizSyncFakeAccountOnlyVaults(fakeEngineScenario)
    const isSignedIn = fakeEngineScenario !== 'signed-out' && fakeEngineScenario !== 'new-device'
    // Long enough ago that changing a passphrase, Start over and Delete account ask to sign in again.
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
      isSyncPausedOnThisDevice: fakeEngineScenario === 'paused-on-this-device',
      syncWhatSyncsChoices: { isAssistantChatSyncOn: true, isAppSettingSyncOn: true },
      syncLocalVaults: [],
      syncLinkedLocalVaults: [],
      syncNoteClashesToSettle: [],
    }
    const fakeEngineKeptState = readPapelizSyncFakeEngineKeptState(fakeEngineKeptStateStorage, fakeEngineScenario)
    if (fakeEngineKeptState !== null) this.applyFakeEngineKeptState(fakeEngineKeptState)
  }

  // What the last page load kept: signed in or out, the vaults it unlocked, and its linked vaults.
  private applyFakeEngineKeptState(fakeEngineKeptState: PapelizSyncFakeEngineKeptState): void {
    this.isFakeDownloadStopUsed = fakeEngineKeptState.isFakeDownloadStopUsed
    for (const fakeKeptLinkedVault of fakeEngineKeptState.fakeKeptLinkedVaults) {
      this.fakeKeptLinkedVaultsById.set(fakeKeptLinkedVault.papelizVaultId, fakeKeptLinkedVault)
      this.fakeVaultEncryptionKindsBySyncVaultId.set(fakeKeptLinkedVault.papelizSyncVaultId, fakeKeptLinkedVault.syncVaultEncryptionKind)
      if (this.fakeAccountOnlyVaults.some((accountOnlyVault) => accountOnlyVault.papelizSyncVaultId === fakeKeptLinkedVault.papelizSyncVaultId)) {
        this.fakeDownloadedPapelizVaultIdsBySyncVaultId.set(fakeKeptLinkedVault.papelizSyncVaultId, fakeKeptLinkedVault.papelizVaultId)
      }
    }
    if (fakeEngineKeptState.isFakeSignedIn) for (const papelizSyncVaultId of fakeEngineKeptState.fakeUnlockedSyncVaultIds) this.fakeUnlockedSyncVaultIds.add(papelizSyncVaultId)
    this.fakeEngineSnapshot = fakeEngineKeptState.isFakeSignedIn
      ? {
          ...this.fakeEngineSnapshot,
          syncSignIn: {
            syncSignInKind: 'signed-in',
            papelizSyncAccountId: papelizSyncFakeEngineAccountId,
            papelizSyncDeviceId: papelizSyncFakeEngineThisDeviceId,
            syncSignInEmailAddress: 'you@example.com',
            syncSignInMethod: 'email-code',
          },
          // A new device signed in to an account that already has a plan.
          syncAccount: this.fakeEngineSnapshot.syncAccount ?? this.buildFakeAccountReading(isPapelizSyncFakeNewDeviceScenario(this.fakeEngineScenario) ? 'plus' : null),
        }
      : { ...this.fakeEngineSnapshot, syncSignIn: { syncSignInKind: 'signed-out' }, syncAccount: null }
    this.fakeEngineSnapshot = { ...this.fakeEngineSnapshot, syncLinkedLocalVaults: this.listFakeLinkedLocalVaults(this.fakeEngineSnapshot.syncLocalVaults) }
  }

  private readFakeVaultEncryptionKind(papelizSyncVaultId: string): PapelizSyncVaultEncryptionKind {
    return (
      this.fakeVaultEncryptionKindsBySyncVaultId.get(papelizSyncVaultId) ??
      this.fakeAccountOnlyVaults.find((accountOnlyVault) => accountOnlyVault.papelizSyncVaultId === papelizSyncVaultId)?.syncVaultEncryptionKind ??
      'standard'
    )
  }

  private readFakeVaultLockState(papelizSyncVaultId: string): PapelizSyncVaultLockState {
    return this.readFakeVaultEncryptionKind(papelizSyncVaultId) === 'standard' || this.fakeUnlockedSyncVaultIds.has(papelizSyncVaultId) ? 'unlocked' : 'locked'
  }

  private readFakeVaultPassphrase(papelizSyncVaultId: string): string {
    return this.fakeVaultPassphrasesBySyncVaultId.get(papelizSyncVaultId) ?? papelizSyncFakeEngineVaultPassphrase
  }

  // Every vault the fake syncs here, attached or not: its local vaults, and those kept from the last
  // page load that haven't been attached yet.
  private listFakeLinkedLocalVaults(syncLocalVaults: readonly PapelizSyncLocalVaultReading[]): PapelizSyncLinkedLocalVaultReading[] {
    const syncLinkedLocalVaults: PapelizSyncLinkedLocalVaultReading[] = syncLocalVaults.map((syncLocalVault) => ({
      papelizVaultId: syncLocalVault.papelizVaultId,
      papelizSyncVaultId: syncLocalVault.papelizSyncVaultId,
      syncVaultEncryptionKind: syncLocalVault.syncVaultEncryptionKind,
      syncVaultLockState: syncLocalVault.syncVaultLockState,
      isFirstDownloadUnfinished: syncLocalVault.syncVaultTransferProgress?.syncVaultTransferKind === 'first-download',
    }))
    for (const fakeKeptLinkedVault of this.fakeKeptLinkedVaultsById.values()) {
      if (syncLinkedLocalVaults.some((syncLinkedLocalVault) => syncLinkedLocalVault.papelizVaultId === fakeKeptLinkedVault.papelizVaultId)) continue
      syncLinkedLocalVaults.push({
        papelizVaultId: fakeKeptLinkedVault.papelizVaultId,
        papelizSyncVaultId: fakeKeptLinkedVault.papelizSyncVaultId,
        syncVaultEncryptionKind: fakeKeptLinkedVault.syncVaultEncryptionKind,
        syncVaultLockState: this.readFakeVaultLockState(fakeKeptLinkedVault.papelizSyncVaultId),
        isFirstDownloadUnfinished: fakeKeptLinkedVault.syncTransferFileCount !== null,
      })
    }
    return syncLinkedLocalVaults
  }

  private keepFakeEngineState(): void {
    if (this.fakeEngineKeptStateStorage === null) return
    const { syncLocalVaults, syncLinkedLocalVaults } = this.fakeEngineSnapshot
    const fakeKeptLinkedVaults = syncLinkedLocalVaults.map((syncLinkedLocalVault): PapelizSyncFakeKeptLinkedVault => {
      const syncVaultTransferProgress = syncLocalVaults.find((syncLocalVault) => syncLocalVault.papelizVaultId === syncLinkedLocalVault.papelizVaultId)?.syncVaultTransferProgress ?? null
      const fakeKeptLinkedVault = this.fakeKeptLinkedVaultsById.get(syncLinkedLocalVault.papelizVaultId)
      return {
        papelizVaultId: syncLinkedLocalVault.papelizVaultId,
        papelizSyncVaultId: syncLinkedLocalVault.papelizSyncVaultId,
        syncVaultEncryptionKind: syncLinkedLocalVault.syncVaultEncryptionKind,
        syncTransferredFileCount: syncLinkedLocalVault.isFirstDownloadUnfinished
          ? (syncVaultTransferProgress?.syncTransferredFileCount ?? fakeKeptLinkedVault?.syncTransferredFileCount ?? 0)
          : null,
        syncTransferFileCount: syncLinkedLocalVault.isFirstDownloadUnfinished ? (syncVaultTransferProgress?.syncTransferFileCount ?? fakeKeptLinkedVault?.syncTransferFileCount ?? 0) : null,
      }
    })
    const fakeEngineKeptState: PapelizSyncFakeEngineKeptState = {
      isFakeSignedIn: this.isFakeSignedIn(),
      fakeUnlockedSyncVaultIds: [...this.fakeUnlockedSyncVaultIds],
      isFakeDownloadStopUsed: this.isFakeDownloadStopUsed,
      fakeKeptLinkedVaults,
    }
    try {
      this.fakeEngineKeptStateStorage.setItem(`${papelizSyncFakeEngineKeptStateStorageKeyPrefix}${this.fakeEngineScenario}`, JSON.stringify(fakeEngineKeptState))
    } catch {
      // Storage full or blocked: the next load starts from the scenario.
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
      // The account's own vaults; the ones synced here are counted as they're added.
      syncedVaultCount: this.fakeAccountOnlyVaults.length,
      isSyncAccountPaused: false,
      syncAccountReadAt: currentTime,
    }
  }

  // The account's synced vaults: those only on the account, and those synced here (a downloaded one
  // counts once).
  private countFakeSyncedVaults(): number {
    const accountOnlySyncVaultIds = new Set(this.fakeAccountOnlyVaults.map((accountOnlyVault) => accountOnlyVault.papelizSyncVaultId))
    return this.fakeAccountOnlyVaults.length + this.fakeEngineSnapshot.syncLocalVaults.filter((syncLocalVault) => !accountOnlySyncVaultIds.has(syncLocalVault.papelizSyncVaultId)).length
  }

  private async waitForFakeCall(fakeEngineCallName: string): Promise<void> {
    this.fakeEngineCallNames.push(fakeEngineCallName)
    if (this.fakeCallDelayMilliseconds > 0) await new Promise((resolveFakeDelay) => setTimeout(resolveFakeDelay, this.fakeCallDelayMilliseconds))
  }

  private changeFakeSnapshot(fakeSnapshotChange: Partial<PapelizSyncEngineSnapshot>): void {
    const nextFakeEngineSnapshot = { ...this.fakeEngineSnapshot, ...fakeSnapshotChange }
    this.fakeEngineSnapshot = { ...nextFakeEngineSnapshot, syncLinkedLocalVaults: this.listFakeLinkedLocalVaults(nextFakeEngineSnapshot.syncLocalVaults) }
    this.keepFakeEngineState()
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
  private readFakeSteadySyncVaultStatus(papelizSyncVaultId: string): PapelizSyncStatusReading {
    const currentTime = this.fakeCurrentTime()
    if (!this.isFakeSignedIn()) return { syncStatusKind: 'signed-out' }
    if (this.readFakeVaultLockState(papelizSyncVaultId) === 'locked') return { syncStatusKind: 'locked' }
    if (this.fakeEngineSnapshot.isSyncPausedOnThisDevice) return { syncStatusKind: 'paused-on-this-device', syncWaitingFileCount: 2 }
    const fakeMissingFileCount = this.fakeMissingFileCountsBySyncVaultId.get(papelizSyncVaultId) ?? 0
    if (fakeMissingFileCount > 0) return { syncStatusKind: 'files-missing', syncMissingFileCount: fakeMissingFileCount }
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
      syncLocalVaults: this.fakeEngineSnapshot.syncLocalVaults.map((syncLocalVault) => ({
        ...syncLocalVault,
        syncVaultLockState: this.readFakeVaultLockState(syncLocalVault.papelizSyncVaultId),
        syncVaultStatus: syncLocalVault.syncVaultTransferProgress === null ? this.readFakeSteadySyncVaultStatus(syncLocalVault.papelizSyncVaultId) : syncLocalVault.syncVaultStatus,
      })),
    })
  }

  // The synced vault a vault here syncs with: the account's vault it was downloaded from, the one it
  // was linked to before the last page load, or a new one named after it.
  private readFakeSyncVaultIdForLocalVault(papelizVaultId: string): string {
    const downloadedSyncVaultId = [...this.fakeDownloadedPapelizVaultIdsBySyncVaultId].find(([, downloadedPapelizVaultId]) => downloadedPapelizVaultId === papelizVaultId)?.[0]
    return (
      this.fakeEngineSnapshot.syncLocalVaults.find((syncLocalVault) => syncLocalVault.papelizVaultId === papelizVaultId)?.papelizSyncVaultId ??
      downloadedSyncVaultId ??
      this.fakeKeptLinkedVaultsById.get(papelizVaultId)?.papelizSyncVaultId ??
      `pzvault_${papelizVaultId.replace(/[^a-z2-7]/g, '').padEnd(26, 'a').slice(0, 26)}`
    )
  }

  private addFakeLocalVault(papelizVaultId: string, syncVaultTransferProgress: PapelizSyncLocalVaultReading['syncVaultTransferProgress']): PapelizSyncLocalVaultReading {
    const papelizSyncVaultId = this.readFakeSyncVaultIdForLocalVault(papelizVaultId)
    const syncLocalVault: PapelizSyncLocalVaultReading = {
      papelizVaultId,
      papelizSyncVaultId,
      syncVaultEncryptionKind: this.readFakeVaultEncryptionKind(papelizSyncVaultId),
      syncVaultLockState: this.readFakeVaultLockState(papelizSyncVaultId),
      syncVaultStatus:
        syncVaultTransferProgress === null
          ? this.readFakeSteadySyncVaultStatus(papelizSyncVaultId)
          : { syncStatusKind: 'syncing', syncingFileCount: syncVaultTransferProgress.syncTransferFileCount - syncVaultTransferProgress.syncTransferredFileCount },
      syncVaultTransferProgress,
    }
    this.changeFakeSnapshot({
      syncLocalVaults: [...this.fakeEngineSnapshot.syncLocalVaults.filter((otherLocalVault) => otherLocalVault.papelizVaultId !== papelizVaultId), syncLocalVault],
    })
    this.changeFakeAccount({ syncedVaultCount: this.countFakeSyncedVaults() })
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
        // A new device signs in to an account that already has a plan.
        syncAccount: wasSignedInBefore ? this.fakeEngineSnapshot.syncAccount : this.buildFakeAccountReading(this.fakeEngineScenario === 'new-device' ? 'plus' : null),
      })
      this.refreshFakeLocalVaultStatuses()
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
    this.fakeUnlockedSyncVaultIds.clear()
    this.changeFakeSnapshot({
      syncSignIn: { syncSignInKind: 'signed-out' },
      syncAccount: null,
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
      // A browser that has no name: it shows as its kind.
      {
        papelizSyncDeviceId: 'pzdev_dddddddddddddddddddddddddd',
        syncDeviceName: null,
        syncDevicePlatform: 'web',
        syncDeviceAddedAt: currentTime - 5 * 24 * 60 * 60_000,
        syncDeviceLastSeenAt: currentTime - 3 * 24 * 60 * 60_000,
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
    this.forgetFakeSyncedVaults()
    this.changeFakeSnapshot({ syncSignIn: { syncSignInKind: 'signed-out' }, syncAccount: null, syncLocalVaults: [], syncNoteClashesToSettle: [] })
    return createFakeDoneOutcome(null)
  }

  // Every synced vault gone: the account's, and what this device kept of them.
  private forgetFakeSyncedVaults(): void {
    this.fakeKeptLinkedVaultsById.clear()
    this.fakeDownloadedPapelizVaultIdsBySyncVaultId.clear()
    this.fakeUnlockedSyncVaultIds.clear()
    this.fakeVaultEncryptionKindsBySyncVaultId.clear()
    this.fakeVaultPassphrasesBySyncVaultId.clear()
    this.fakeAccountOnlyVaults.splice(0, this.fakeAccountOnlyVaults.length)
  }

  async startSyncOver(): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('startSyncOver')
    if (!this.isFakeSignInFresh()) return createFakeFailedOutcome('fresh-sign-in-required')
    this.forgetFakeSyncedVaults()
    this.changeFakeSnapshot({ syncLocalVaults: [], syncNoteClashesToSettle: [] })
    this.changeFakeAccount({ syncStorageUsedByteLength: 0, syncedVaultCount: 0 })
    return createFakeDoneOutcome(null)
  }

  // The synced vault on the account, here or not; undefined when the account has none by that ID.
  private findFakeAccountVaultName(papelizSyncVaultId: string): string | undefined {
    const syncLocalVault = this.fakeEngineSnapshot.syncLocalVaults.find((otherLocalVault) => otherLocalVault.papelizSyncVaultId === papelizSyncVaultId)
    if (syncLocalVault !== undefined) return this.fakeAttachedVaultsById.get(syncLocalVault.papelizVaultId)?.papelizVaultDisplayName ?? 'Synced vault'
    return this.fakeAccountOnlyVaults.find((accountOnlyVault) => accountOnlyVault.papelizSyncVaultId === papelizSyncVaultId)?.syncVaultName
  }

  async unlockSyncedVaultWithPassphrase(papelizSyncVaultId: string, syncVaultPassphrase: string): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('unlockSyncedVaultWithPassphrase')
    if (!this.isFakeSignedIn()) return createFakeFailedOutcome('signed-out')
    if (this.findFakeAccountVaultName(papelizSyncVaultId) === undefined) return createFakeFailedOutcome('not-found')
    if (this.readFakeVaultLockState(papelizSyncVaultId) === 'unlocked') return createFakeDoneOutcome(null)
    if (syncVaultPassphrase.normalize('NFC') !== this.readFakeVaultPassphrase(papelizSyncVaultId).normalize('NFC')) return createFakeFailedOutcome('wrong-passphrase')
    this.fakeUnlockedSyncVaultIds.add(papelizSyncVaultId)
    this.refreshFakeLocalVaultStatuses()
    // A first download that waited on the passphrase goes on, as the real engine's does.
    for (const syncLocalVault of this.fakeEngineSnapshot.syncLocalVaults) {
      const syncVaultTransferProgress = syncLocalVault.syncVaultTransferProgress
      if (syncLocalVault.papelizSyncVaultId !== papelizSyncVaultId || syncVaultTransferProgress === null || syncLocalVault.syncVaultStatus.syncStatusKind !== 'locked') continue
      if (this.fakeAttachedVaultsById.has(syncLocalVault.papelizVaultId)) {
        this.runFakeFirstTransfer(syncLocalVault.papelizVaultId, syncVaultTransferProgress.syncVaultTransferKind, syncVaultTransferProgress.syncTransferFileCount, syncVaultTransferProgress.syncTransferredFileCount)
      }
    }
    return createFakeDoneOutcome(null)
  }

  // In the same order as the real engine: the new passphrase, the vault, its key (held here, or opened
  // with the current passphrase), then the account's answer (a recent sign-in, the revision).
  async changeSyncVaultPassphrase(papelizSyncVaultId: string, newSyncVaultPassphrase: string, currentSyncVaultPassphrase: string | null): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('changeSyncVaultPassphrase')
    if (!this.isFakeSignedIn()) return createFakeFailedOutcome('signed-out')
    if (!isPapelizSyncPassphraseLongEnough(newSyncVaultPassphrase)) return createFakeFailedOutcome('passphrase-too-short')
    if (this.findFakeAccountVaultName(papelizSyncVaultId) === undefined || this.readFakeVaultEncryptionKind(papelizSyncVaultId) !== 'end-to-end') return createFakeFailedOutcome('not-found')
    if (this.readFakeVaultLockState(papelizSyncVaultId) === 'locked') {
      if (currentSyncVaultPassphrase === null) return createFakeFailedOutcome('locked')
      if (currentSyncVaultPassphrase.normalize('NFC') !== this.readFakeVaultPassphrase(papelizSyncVaultId).normalize('NFC')) return createFakeFailedOutcome('wrong-passphrase')
    }
    if (!this.isFakeSignInFresh()) return createFakeFailedOutcome('fresh-sign-in-required')
    // Another device changed it after this one read the vault: the next try reads it again.
    if (this.fakeVaultPassphraseChangedElsewhereSyncVaultIds.delete(papelizSyncVaultId)) return createFakeFailedOutcome('changed-elsewhere')
    this.fakeVaultPassphrasesBySyncVaultId.set(papelizSyncVaultId, newSyncVaultPassphrase)
    return createFakeDoneOutcome(null)
  }

  // Test and dev control: another device changes a vault's passphrase while this one has the vault
  // read; this device's next change meets the newer revision once.
  private readonly fakeVaultPassphraseChangedElsewhereSyncVaultIds = new Set<string>()

  changeFakeSyncVaultPassphraseElsewhere(papelizSyncVaultId: string, otherDeviceSyncVaultPassphrase: string): void {
    this.fakeVaultPassphrasesBySyncVaultId.set(papelizSyncVaultId, otherDeviceSyncVaultPassphrase)
    this.fakeVaultPassphraseChangedElsewhereSyncVaultIds.add(papelizSyncVaultId)
  }

  attachSyncToOpenVault(openLocalVault: PapelizSyncOpenLocalVault): () => void {
    this.fakeEngineCallNames.push('attachSyncToOpenVault')
    const { papelizVaultId, papelizVaultDisplayName, syncLocalVaultFiles } = openLocalVault
    this.fakeAttachedVaultsById.set(papelizVaultId, { papelizVaultId, papelizVaultDisplayName, syncLocalVaultFiles })
    const detachSyncFromOpenVault = () => {
      this.fakeEngineCallNames.push('detachSyncFromOpenVault')
      this.fakeAttachedVaultsById.delete(papelizVaultId)
    }
    // Some scenarios start with this device already syncing whatever vault it opens (End-to-end and
    // locked in `locked`, Standard in the others); the rest sync only what is turned on or downloaded.
    const isSyncedInScenario = this.isFakeSignedIn() && papelizSyncFakeEngineScenariosSyncingEveryOpenVault.has(this.fakeEngineScenario)
    const attachedLocalVault = this.fakeEngineSnapshot.syncLocalVaults.find((syncLocalVault) => syncLocalVault.papelizVaultId === papelizVaultId)
    // A vault linked before the last page load syncs again; its unfinished first download picks up
    // where it was once its key is here, as the real engine's does.
    const fakeKeptLinkedVault = this.fakeKeptLinkedVaultsById.get(papelizVaultId)
    if (fakeKeptLinkedVault !== undefined && attachedLocalVault === undefined) {
      const { syncTransferredFileCount, syncTransferFileCount } = fakeKeptLinkedVault
      if (syncTransferFileCount === null) this.addFakeLocalVault(papelizVaultId, null)
      else if (this.isFakeSignedIn() && this.readFakeVaultLockState(fakeKeptLinkedVault.papelizSyncVaultId) === 'unlocked') {
        this.runFakeFirstTransfer(papelizVaultId, 'first-download', syncTransferFileCount, syncTransferredFileCount ?? 0)
      } else {
        this.setFakeSyncVaultStatus(papelizVaultId, this.isFakeSignedIn() ? { syncStatusKind: 'locked' } : { syncStatusKind: 'signed-out' }, {
          syncVaultTransferKind: 'first-download',
          syncTransferredFileCount: syncTransferredFileCount ?? 0,
          syncTransferFileCount,
        })
      }
      this.fakeKeptLinkedVaultsById.delete(papelizVaultId)
      return detachSyncFromOpenVault
    }
    if (isSyncedInScenario && attachedLocalVault === undefined) {
      if (this.fakeEngineScenario === 'locked') this.fakeVaultEncryptionKindsBySyncVaultId.set(this.readFakeSyncVaultIdForLocalVault(papelizVaultId), 'end-to-end')
      if (this.fakeEngineScenario === 'files-missing') this.fakeMissingFileCountsBySyncVaultId.set(this.readFakeSyncVaultIdForLocalVault(papelizVaultId), papelizSyncFakeEngineMissingFileCount)
      this.addFakeLocalVault(papelizVaultId, null)
      if (this.fakeEngineScenario === 'to-settle' && this.fakeEngineSnapshot.syncNoteClashesToSettle.length === 0) this.addFakeSyncNoteClash(papelizVaultId, 'Welcome.md')
    }
    // A download that stopped (offline, or locked or signed out and unlocked since) goes on when its
    // vault is attached again, as the real engine's does.
    const stoppedSyncStatusKind = attachedLocalVault?.syncVaultStatus.syncStatusKind
    const isStoppedTransferGoingOn =
      stoppedSyncStatusKind === 'offline' ||
      ((stoppedSyncStatusKind === 'locked' || stoppedSyncStatusKind === 'signed-out') &&
        this.isFakeSignedIn() &&
        attachedLocalVault !== undefined &&
        this.readFakeVaultLockState(attachedLocalVault.papelizSyncVaultId) === 'unlocked')
    const stoppedTransferProgress = isStoppedTransferGoingOn ? attachedLocalVault?.syncVaultTransferProgress : null
    if (stoppedTransferProgress !== null && stoppedTransferProgress !== undefined) {
      this.runFakeFirstTransfer(papelizVaultId, stoppedTransferProgress.syncVaultTransferKind, stoppedTransferProgress.syncTransferFileCount, stoppedTransferProgress.syncTransferredFileCount)
    }
    return detachSyncFromOpenVault
  }

  async listSyncedVaultsOnAccount(): Promise<PapelizSyncActionOutcome<PapelizSyncAccountVaultReading[]>> {
    await this.waitForFakeCall('listSyncedVaultsOnAccount')
    if (!this.isFakeSignedIn()) return createFakeFailedOutcome('signed-out')
    const currentTime = this.fakeCurrentTime()
    const downloadedPapelizVaultIds = new Set(this.fakeDownloadedPapelizVaultIdsBySyncVaultId.values())
    const fakeAccountVaults: PapelizSyncAccountVaultReading[] = this.fakeEngineSnapshot.syncLocalVaults
      .filter((syncLocalVault) => !downloadedPapelizVaultIds.has(syncLocalVault.papelizVaultId))
      .map((syncLocalVault) => ({
        papelizSyncVaultId: syncLocalVault.papelizSyncVaultId,
        syncVaultName: this.fakeAttachedVaultsById.get(syncLocalVault.papelizVaultId)?.papelizVaultDisplayName ?? 'Synced vault',
        syncVaultEncryptionKind: syncLocalVault.syncVaultEncryptionKind,
        syncVaultLockState: this.readFakeVaultLockState(syncLocalVault.papelizSyncVaultId),
        syncVaultFileCount: 128,
        syncVaultStoredByteLength: 42e6,
        syncVaultCreatedAt: currentTime - 30 * 24 * 60 * 60_000,
        papelizVaultIdOnThisDevice: syncLocalVault.papelizVaultId,
      }))
    for (const fakeAccountOnlyVault of this.fakeAccountOnlyVaults) {
      fakeAccountVaults.push({
        papelizSyncVaultId: fakeAccountOnlyVault.papelizSyncVaultId,
        syncVaultName: fakeAccountOnlyVault.syncVaultName,
        syncVaultEncryptionKind: fakeAccountOnlyVault.syncVaultEncryptionKind,
        syncVaultLockState: this.readFakeVaultLockState(fakeAccountOnlyVault.papelizSyncVaultId),
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
    const finishFakeFirstTransfer = () =>
      void this.writeFakeDownloadedVaultFiles(papelizVaultId).then(() =>
        this.setFakeSyncVaultStatus(papelizVaultId, this.readFakeSteadySyncVaultStatus(this.readFakeSyncVaultIdForLocalVault(papelizVaultId)), null),
      )
    if (this.fakeCallDelayMilliseconds === 0) {
      if (syncVaultTransferKind !== 'first-download') {
        this.addFakeLocalVault(papelizVaultId, null)
        return
      }
      this.addFakeLocalVault(papelizVaultId, { syncVaultTransferKind, syncTransferredFileCount: syncAlreadyTransferredFileCount, syncTransferFileCount })
      finishFakeFirstTransfer()
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
        finishFakeFirstTransfer()
        return
      }
      this.setFakeSyncVaultStatus(
        papelizVaultId,
        { syncStatusKind: 'syncing', syncingFileCount: syncTransferFileCount - syncTransferredFileCount },
        { syncVaultTransferKind, syncTransferredFileCount, syncTransferFileCount },
      )
    }, 400)
  }

  // The vault turned on here, with what was passed for its kind (the passphrases the fake was given,
  // so tests can check the screens passed the one typed).
  readonly fakeTurnedOnSyncVaultEncryptionChoices: Array<{ papelizVaultId: string; syncVaultEncryptionChoice: PapelizSyncVaultEncryptionChoice }> = []

  async turnSyncOnForVault(papelizVaultId: string, syncVaultEncryptionChoice: PapelizSyncVaultEncryptionChoice): Promise<PapelizSyncActionOutcome<{ papelizSyncVaultId: string }>> {
    await this.waitForFakeCall('turnSyncOnForVault')
    if (!this.isFakeSignedIn()) return createFakeFailedOutcome('signed-out')
    const syncAccount = this.fakeEngineSnapshot.syncAccount
    if (syncAccount === null || syncAccount.syncSubscriptionState === 'not-subscribed') return createFakeFailedOutcome('subscription-required')
    if (syncAccount.syncSubscriptionState === 'ended-read-only' || syncAccount.syncSubscriptionState === 'ended-held') return createFakeFailedOutcome('read-only')
    if (syncVaultEncryptionChoice.syncVaultEncryptionKind === 'end-to-end' && !isPapelizSyncPassphraseLongEnough(syncVaultEncryptionChoice.syncVaultPassphrase)) {
      return createFakeFailedOutcome('passphrase-too-short')
    }
    const existingLocalVault = this.fakeEngineSnapshot.syncLocalVaults.find((otherLocalVault) => otherLocalVault.papelizVaultId === papelizVaultId)
    if (existingLocalVault !== undefined) return createFakeDoneOutcome({ papelizSyncVaultId: existingLocalVault.papelizSyncVaultId })
    this.fakeTurnedOnSyncVaultEncryptionChoices.push({ papelizVaultId, syncVaultEncryptionChoice })
    const papelizSyncVaultId = this.readFakeSyncVaultIdForLocalVault(papelizVaultId)
    this.fakeVaultEncryptionKindsBySyncVaultId.set(papelizSyncVaultId, syncVaultEncryptionChoice.syncVaultEncryptionKind)
    if (syncVaultEncryptionChoice.syncVaultEncryptionKind === 'end-to-end') {
      // The vault's key is made here, so this device holds it from the start.
      this.fakeVaultPassphrasesBySyncVaultId.set(papelizSyncVaultId, syncVaultEncryptionChoice.syncVaultPassphrase)
      this.fakeUnlockedSyncVaultIds.add(papelizSyncVaultId)
    }
    this.runFakeFirstTransfer(papelizVaultId, 'first-upload')
    return createFakeDoneOutcome({ papelizSyncVaultId })
  }

  async downloadSyncedVaultInto(papelizSyncVaultId: string, papelizVaultId: string): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('downloadSyncedVaultInto')
    if (!this.isFakeSignedIn()) return createFakeFailedOutcome('signed-out')
    if (this.readFakeVaultLockState(papelizSyncVaultId) === 'locked') return createFakeFailedOutcome('locked')
    const fakeAccountOnlyVault = this.fakeAccountOnlyVaults.find((accountOnlyVault) => accountOnlyVault.papelizSyncVaultId === papelizSyncVaultId)
    if (fakeAccountOnlyVault !== undefined) this.fakeDownloadedPapelizVaultIdsBySyncVaultId.set(papelizSyncVaultId, papelizVaultId)
    this.runFakeFirstTransfer(papelizVaultId, 'first-download', fakeAccountOnlyVault?.syncVaultFileCount)
    return createFakeDoneOutcome(null)
  }

  async connectVaultToSyncedVault(papelizVaultId: string, papelizSyncVaultId: string): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('connectVaultToSyncedVault')
    if (!this.isFakeSignedIn()) return createFakeFailedOutcome('signed-out')
    if (this.readFakeVaultLockState(papelizSyncVaultId) === 'locked') return createFakeFailedOutcome('locked')
    if (this.fakeAccountOnlyVaults.some((accountOnlyVault) => accountOnlyVault.papelizSyncVaultId === papelizSyncVaultId)) {
      this.fakeDownloadedPapelizVaultIdsBySyncVaultId.set(papelizSyncVaultId, papelizVaultId)
    }
    this.runFakeFirstTransfer(papelizVaultId, 'connect')
    return createFakeDoneOutcome(null)
  }

  async turnSyncOffForVault(papelizVaultId: string): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('turnSyncOffForVault')
    for (const [papelizSyncVaultId, downloadedPapelizVaultId] of this.fakeDownloadedPapelizVaultIdsBySyncVaultId) {
      if (downloadedPapelizVaultId === papelizVaultId) this.fakeDownloadedPapelizVaultIdsBySyncVaultId.delete(papelizSyncVaultId)
    }
    this.fakeKeptLinkedVaultsById.delete(papelizVaultId)
    this.changeFakeSnapshot({ syncLocalVaults: this.fakeEngineSnapshot.syncLocalVaults.filter((syncLocalVault) => syncLocalVault.papelizVaultId !== papelizVaultId) })
    this.changeFakeAccount({ syncedVaultCount: this.countFakeSyncedVaults() })
    return createFakeDoneOutcome(null)
  }

  async deleteSyncedVaultFromAccount(papelizSyncVaultId: string): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('deleteSyncedVaultFromAccount')
    if (!this.isFakeSignedIn()) return createFakeFailedOutcome('signed-out')
    // Gone from the account: no device syncs it any more, and the Synced Vaults page no longer lists it.
    this.fakeDownloadedPapelizVaultIdsBySyncVaultId.delete(papelizSyncVaultId)
    this.fakeUnlockedSyncVaultIds.delete(papelizSyncVaultId)
    this.fakeVaultEncryptionKindsBySyncVaultId.delete(papelizSyncVaultId)
    this.fakeVaultPassphrasesBySyncVaultId.delete(papelizSyncVaultId)
    for (const [papelizVaultId, fakeKeptLinkedVault] of this.fakeKeptLinkedVaultsById) {
      if (fakeKeptLinkedVault.papelizSyncVaultId === papelizSyncVaultId) this.fakeKeptLinkedVaultsById.delete(papelizVaultId)
    }
    const deletedAccountOnlyVaultIndex = this.fakeAccountOnlyVaults.findIndex((accountOnlyVault) => accountOnlyVault.papelizSyncVaultId === papelizSyncVaultId)
    if (deletedAccountOnlyVaultIndex !== -1) this.fakeAccountOnlyVaults.splice(deletedAccountOnlyVaultIndex, 1)
    this.changeFakeSnapshot({
      syncLocalVaults: this.fakeEngineSnapshot.syncLocalVaults.filter((syncLocalVault) => syncLocalVault.papelizSyncVaultId !== papelizSyncVaultId),
    })
    this.changeFakeAccount({ syncedVaultCount: this.countFakeSyncedVaults() })
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

  reportSyncVaultEntryRenamed(papelizVaultId: string, fromVaultEntryRelativePath: string, toVaultEntryRelativePath: string): void {
    this.fakeEngineCallNames.push('reportSyncVaultEntryRenamed')
    this.fakeReportedSyncVaultEntryRenames.push({ papelizVaultId, fromVaultEntryRelativePath, toVaultEntryRelativePath })
  }

  reportSyncVaultEntryMovedToTrash(papelizVaultId: string, vaultEntryRelativePath: string, vaultTrashRelativePath: string): void {
    this.fakeEngineCallNames.push('reportSyncVaultEntryMovedToTrash')
    this.fakeReportedSyncVaultEntryTrashMoves.push({ papelizVaultId, vaultEntryRelativePath, vaultTrashRelativePath })
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

  // Download them again shows Syncing while the files come back (at once in tests); They were deleted
  // clears them at once.
  async downloadMissingSyncFilesAgain(papelizVaultId: string): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('downloadMissingSyncFilesAgain')
    const papelizSyncVaultId = this.readFakeMissingFilesSyncVaultId(papelizVaultId)
    if (papelizSyncVaultId === null) return createFakeFailedOutcome('not-found')
    const fakeMissingFileCount = this.fakeMissingFileCountsBySyncVaultId.get(papelizSyncVaultId) ?? 0
    this.fakeMissingFileCountsBySyncVaultId.delete(papelizSyncVaultId)
    if (this.fakeCallDelayMilliseconds === 0) {
      this.refreshFakeLocalVaultStatuses()
      return createFakeDoneOutcome(null)
    }
    this.setFakeSyncVaultStatus(papelizVaultId, { syncStatusKind: 'syncing', syncingFileCount: fakeMissingFileCount }, null)
    setTimeout(() => this.refreshFakeLocalVaultStatuses(), 4 * this.fakeCallDelayMilliseconds)
    return createFakeDoneOutcome(null)
  }

  async confirmMissingSyncFilesDeleted(papelizVaultId: string): Promise<PapelizSyncActionOutcome> {
    await this.waitForFakeCall('confirmMissingSyncFilesDeleted')
    const papelizSyncVaultId = this.readFakeMissingFilesSyncVaultId(papelizVaultId)
    if (papelizSyncVaultId === null) return createFakeFailedOutcome('not-found')
    this.fakeMissingFileCountsBySyncVaultId.delete(papelizSyncVaultId)
    this.refreshFakeLocalVaultStatuses()
    return createFakeDoneOutcome(null)
  }

  // The synced vault of an attached vault with files missing here, or null.
  private readFakeMissingFilesSyncVaultId(papelizVaultId: string): string | null {
    const papelizSyncVaultId = this.fakeEngineSnapshot.syncLocalVaults.find((syncLocalVault) => syncLocalVault.papelizVaultId === papelizVaultId)?.papelizSyncVaultId
    return papelizSyncVaultId !== undefined && this.fakeMissingFileCountsBySyncVaultId.has(papelizSyncVaultId) ? papelizSyncVaultId : null
  }

  async listSyncFileVersions(papelizVaultId: string, _vaultFileRelativePath: string): Promise<PapelizSyncActionOutcome<PapelizSyncFileVersionReading[]>> {
    await this.waitForFakeCall('listSyncFileVersions')
    const syncLocalVault = this.fakeEngineSnapshot.syncLocalVaults.find((otherLocalVault) => otherLocalVault.papelizVaultId === papelizVaultId)
    if (syncLocalVault === undefined) return createFakeFailedOutcome('not-found')
    if (syncLocalVault.syncVaultLockState === 'locked') return createFakeFailedOutcome('locked')
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
