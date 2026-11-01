import {
  CircleAlert,
  Cloud,
  CloudCheck,
  CloudDownload,
  CloudOff,
  FolderCheck,
  FolderX,
  Hourglass,
  ListChecks,
  Lock,
  LockOpen,
  LogIn,
  LogOut,
  ReceiptText,
  TimerOff,
  type LucideIcon,
} from 'lucide-react'
import type { PapelizPopoverMenuItem } from '../ui/papeliz-popover-menu'
import type { PapelizSyncAccountReading, PapelizSyncSubscriptionState } from './papeliz-sync-engine-contract'
import { listPapelizSyncFakeNewDeviceAccountVaultReadings } from './papeliz-sync-fake-engine'
import {
  usePapelizSyncSyncedVaultsPagePreviewStore,
  type PapelizSyncSyncedVaultsPagePreview,
  type PapelizSyncSyncedVaultsPageStep,
} from './papeliz-sync-synced-vaults-page-preview-store'

// The made-up vault list: none of it here (its End-to-end vault locked, or unlocked here already),
// all of it here, empty, or a failed read.
type PapelizSyncSyncedVaultsPagePreviewVaultList = 'reading' | 'to-download' | 'to-download-end-to-end-unlocked' | 'all-on-this-device' | 'none-yet' | 'read-failed'

// Each state's menu row: its group, words and icon, and what the page needs to show it.
const papelizSyncSyncedVaultsPagePreviewerChoices: ReadonlyArray<{
  syncedVaultsPagePreviewChoiceKey: string
  syncedVaultsPagePreviewChoiceLabel: string
  SyncedVaultsPagePreviewChoiceIcon: LucideIcon
  syncedVaultsPagePreviewGroupHeading?: string
  previewSyncedVaultsPageStep: PapelizSyncSyncedVaultsPageStep
  previewSyncSubscriptionState?: PapelizSyncSubscriptionState
  previewVaultList?: PapelizSyncSyncedVaultsPagePreviewVaultList
  // The End-to-end vault is picked at first, rather than the page's own pick.
  isPreviewEndToEndVaultChosen?: boolean
}> = [
  {
    syncedVaultsPagePreviewChoiceKey: 'waiting-for-fetch',
    syncedVaultsPagePreviewChoiceLabel: 'Fetch (Not Signed In Here)',
    SyncedVaultsPagePreviewChoiceIcon: CloudDownload,
    syncedVaultsPagePreviewGroupHeading: 'Synced Vaults · Signing In',
    previewSyncedVaultsPageStep: 'waiting-for-fetch',
  },
  { syncedVaultsPagePreviewChoiceKey: 'loading-engine', syncedVaultsPagePreviewChoiceLabel: 'Loading Sync', SyncedVaultsPagePreviewChoiceIcon: Hourglass, previewSyncedVaultsPageStep: 'loading-engine' },
  { syncedVaultsPagePreviewChoiceKey: 'engine-not-loaded', syncedVaultsPagePreviewChoiceLabel: 'Sync Didn’t Load', SyncedVaultsPagePreviewChoiceIcon: CloudOff, previewSyncedVaultsPageStep: 'engine-not-loaded' },
  { syncedVaultsPagePreviewChoiceKey: 'signed-out', syncedVaultsPagePreviewChoiceLabel: 'Signed Out', SyncedVaultsPagePreviewChoiceIcon: LogIn, previewSyncedVaultsPageStep: 'signed-out' },
  { syncedVaultsPagePreviewChoiceKey: 'device-removed', syncedVaultsPagePreviewChoiceLabel: 'Device Signed Out', SyncedVaultsPagePreviewChoiceIcon: LogOut, previewSyncedVaultsPageStep: 'device-removed' },
  { syncedVaultsPagePreviewChoiceKey: 'waiting-for-sign-in', syncedVaultsPagePreviewChoiceLabel: 'Waiting for Sign-In', SyncedVaultsPagePreviewChoiceIcon: Cloud, previewSyncedVaultsPageStep: 'waiting-for-sign-in' },
  { syncedVaultsPagePreviewChoiceKey: 'reading-account', syncedVaultsPagePreviewChoiceLabel: 'Reading the Account', SyncedVaultsPagePreviewChoiceIcon: Hourglass, previewSyncedVaultsPageStep: 'reading-account' },
  {
    syncedVaultsPagePreviewChoiceKey: 'no-subscription',
    syncedVaultsPagePreviewChoiceLabel: 'No Subscription',
    SyncedVaultsPagePreviewChoiceIcon: ReceiptText,
    syncedVaultsPagePreviewGroupHeading: 'Synced Vaults · Account',
    previewSyncedVaultsPageStep: 'no-subscription',
    previewSyncSubscriptionState: 'not-subscribed',
  },
  {
    syncedVaultsPagePreviewChoiceKey: 'subscription-held',
    syncedVaultsPagePreviewChoiceLabel: 'Subscription Ended',
    SyncedVaultsPagePreviewChoiceIcon: TimerOff,
    previewSyncedVaultsPageStep: 'subscription-held',
    previewSyncSubscriptionState: 'ended-held',
  },
  {
    syncedVaultsPagePreviewChoiceKey: 'vault-list-reading',
    syncedVaultsPagePreviewChoiceLabel: 'Reading the Vaults',
    SyncedVaultsPagePreviewChoiceIcon: Hourglass,
    syncedVaultsPagePreviewGroupHeading: 'Synced Vaults · Vault List',
    previewSyncedVaultsPageStep: 'synced-vault-list',
    previewSyncSubscriptionState: 'active',
    previewVaultList: 'reading',
  },
  {
    syncedVaultsPagePreviewChoiceKey: 'vault-list-to-download',
    syncedVaultsPagePreviewChoiceLabel: 'Several to Download',
    SyncedVaultsPagePreviewChoiceIcon: ListChecks,
    previewSyncedVaultsPageStep: 'synced-vault-list',
    previewSyncSubscriptionState: 'active',
    previewVaultList: 'to-download',
  },
  {
    syncedVaultsPagePreviewChoiceKey: 'vault-list-end-to-end-passphrase',
    syncedVaultsPagePreviewChoiceLabel: 'End-to-end Asks Its Passphrase',
    SyncedVaultsPagePreviewChoiceIcon: Lock,
    previewSyncedVaultsPageStep: 'synced-vault-list',
    previewSyncSubscriptionState: 'active',
    previewVaultList: 'to-download',
    isPreviewEndToEndVaultChosen: true,
  },
  {
    syncedVaultsPagePreviewChoiceKey: 'vault-list-end-to-end-unlocked',
    syncedVaultsPagePreviewChoiceLabel: 'End-to-end Unlocked Here',
    SyncedVaultsPagePreviewChoiceIcon: LockOpen,
    previewSyncedVaultsPageStep: 'synced-vault-list',
    previewSyncSubscriptionState: 'active',
    previewVaultList: 'to-download-end-to-end-unlocked',
    isPreviewEndToEndVaultChosen: true,
  },
  {
    syncedVaultsPagePreviewChoiceKey: 'vault-list-read-only',
    syncedVaultsPagePreviewChoiceLabel: 'Read-Only After It Ended',
    SyncedVaultsPagePreviewChoiceIcon: CloudCheck,
    previewSyncedVaultsPageStep: 'synced-vault-list',
    previewSyncSubscriptionState: 'ended-read-only',
    previewVaultList: 'to-download',
  },
  {
    syncedVaultsPagePreviewChoiceKey: 'vault-list-all-on-this-device',
    syncedVaultsPagePreviewChoiceLabel: 'All on This Device',
    SyncedVaultsPagePreviewChoiceIcon: FolderCheck,
    previewSyncedVaultsPageStep: 'synced-vault-list',
    previewSyncSubscriptionState: 'active',
    previewVaultList: 'all-on-this-device',
  },
  {
    syncedVaultsPagePreviewChoiceKey: 'vault-list-none-yet',
    syncedVaultsPagePreviewChoiceLabel: 'No Synced Vaults Yet',
    SyncedVaultsPagePreviewChoiceIcon: FolderX,
    previewSyncedVaultsPageStep: 'synced-vault-list',
    previewSyncSubscriptionState: 'active',
    previewVaultList: 'none-yet',
  },
  {
    syncedVaultsPagePreviewChoiceKey: 'vault-list-read-failed',
    syncedVaultsPagePreviewChoiceLabel: 'Couldn’t Read the Vaults',
    SyncedVaultsPagePreviewChoiceIcon: CircleAlert,
    previewSyncedVaultsPageStep: 'synced-vault-list',
    previewSyncSubscriptionState: 'active',
    previewVaultList: 'read-failed',
  },
]

const papelizSyncPreviewDayMilliseconds = 24 * 60 * 60_000

function buildPreviewSyncAccountReading(previewSyncSubscriptionState: PapelizSyncSubscriptionState, currentTime: number): PapelizSyncAccountReading {
  return {
    papelizSyncAccountId: 'preview-sync-account',
    papelizSyncStoragePlace: 'apac',
    syncPlanName: previewSyncSubscriptionState === 'not-subscribed' ? null : 'plus',
    syncSubscriptionState: previewSyncSubscriptionState,
    syncSubscriptionRenewsAt: previewSyncSubscriptionState === 'active' ? currentTime + 20 * papelizSyncPreviewDayMilliseconds : null,
    syncSubscriptionEndsAt: previewSyncSubscriptionState.startsWith('ended-') ? currentTime - 3 * papelizSyncPreviewDayMilliseconds : null,
    syncReadOnlyUntil: previewSyncSubscriptionState === 'ended-read-only' ? currentTime + 27 * papelizSyncPreviewDayMilliseconds : null,
    syncSyncedCopyDeletedAt: previewSyncSubscriptionState === 'ended-held' ? currentTime + 57 * papelizSyncPreviewDayMilliseconds : null,
    syncVisiblePlanLimits: null,
    syncStorageUsedByteLength: 0,
    syncedVaultCount: 3,
    isSyncAccountPaused: false,
    syncAccountReadAt: currentTime,
  }
}

function buildPreviewAccountVaultsOutcome(previewVaultList: PapelizSyncSyncedVaultsPagePreviewVaultList | undefined, currentTime: number): PapelizSyncSyncedVaultsPagePreview['previewAccountVaultsOutcome'] {
  if (previewVaultList === undefined || previewVaultList === 'reading') return null
  if (previewVaultList === 'read-failed') {
    return { syncActionOutcome: 'failed', syncActionFailureKind: 'offline', syncActionFailureMessage: 'Preview: offline', syncRetryAt: null }
  }
  if (previewVaultList === 'none-yet') return { syncActionOutcome: 'done', syncActionDoneValue: [] }
  const previewAccountVaults = listPapelizSyncFakeNewDeviceAccountVaultReadings(currentTime, previewVaultList === 'all-on-this-device')
  return {
    syncActionOutcome: 'done',
    syncActionDoneValue:
      previewVaultList === 'to-download-end-to-end-unlocked' ? previewAccountVaults.map((accountVault) => ({ ...accountVault, syncVaultLockState: 'unlocked' })) : previewAccountVaults,
  }
}

// The made-up list's End-to-end vault, for the choices that pick it.
function readPreviewEndToEndVaultId(previewAccountVaultsOutcome: PapelizSyncSyncedVaultsPagePreview['previewAccountVaultsOutcome']): string | null {
  if (previewAccountVaultsOutcome?.syncActionOutcome !== 'done') return null
  return previewAccountVaultsOutcome.syncActionDoneValue.find((accountVault) => accountVault.syncVaultEncryptionKind === 'end-to-end')?.papelizSyncVaultId ?? null
}

let syncedVaultsPagePreviewCount = 0

// The Synced Vaults page's rows in the start screen's previewer (development builds only,
// papeliz-start-screen-previewer-button.tsx): each of the page's states, under its group headings. A
// pick opens the page in that state with made-up account and vaults, after `onSyncedVaultsPagePreviewHold`
// lets the previewer put any other page it holds back to live.
export function usePapelizSyncSyncedVaultsPagePreviewerMenuItems(onSyncedVaultsPagePreviewHold: () => void): PapelizPopoverMenuItem[] {
  const heldSyncedVaultsPagePreview = usePapelizSyncSyncedVaultsPagePreviewStore((syncedVaultsPagePreviewState) => syncedVaultsPagePreviewState.heldSyncedVaultsPagePreview)
  return papelizSyncSyncedVaultsPagePreviewerChoices.map(
    (previewerChoice): PapelizPopoverMenuItem => ({
      menuItemKey: previewerChoice.syncedVaultsPagePreviewChoiceKey,
      menuItemLabel: previewerChoice.syncedVaultsPagePreviewChoiceLabel,
      MenuItemIcon: previewerChoice.SyncedVaultsPagePreviewChoiceIcon,
      menuItemGroupHeading: previewerChoice.syncedVaultsPagePreviewGroupHeading,
      isMenuItemChecked: heldSyncedVaultsPagePreview?.syncedVaultsPagePreviewChoiceKey === previewerChoice.syncedVaultsPagePreviewChoiceKey,
      onMenuItemSelect: () => {
        onSyncedVaultsPagePreviewHold()
        const currentTime = Date.now()
        syncedVaultsPagePreviewCount += 1
        const previewAccountVaultsOutcome = buildPreviewAccountVaultsOutcome(previewerChoice.previewVaultList, currentTime)
        usePapelizSyncSyncedVaultsPagePreviewStore.setState({
          heldSyncedVaultsPagePreview: {
            syncedVaultsPagePreviewNumber: syncedVaultsPagePreviewCount,
            syncedVaultsPagePreviewChoiceKey: previewerChoice.syncedVaultsPagePreviewChoiceKey,
            previewSyncedVaultsPageStep: previewerChoice.previewSyncedVaultsPageStep,
            previewSyncAccount:
              previewerChoice.previewSyncSubscriptionState === undefined ? null : buildPreviewSyncAccountReading(previewerChoice.previewSyncSubscriptionState, currentTime),
            previewAccountVaultsOutcome,
            previewChosenPapelizSyncVaultId: previewerChoice.isPreviewEndToEndVaultChosen === true ? readPreviewEndToEndVaultId(previewAccountVaultsOutcome) : null,
          },
        })
      },
    }),
  )
}
