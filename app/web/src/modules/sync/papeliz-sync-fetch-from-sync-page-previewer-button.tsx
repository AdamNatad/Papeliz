import {
  CircleAlert,
  Cloud,
  CloudCheck,
  CloudDownload,
  CloudOff,
  Eye,
  FolderCheck,
  FolderX,
  Hourglass,
  KeyRound,
  ListChecks,
  Lock,
  LogIn,
  LogOut,
  ReceiptText,
  TimerOff,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { PapelizPopoverMenu, type PapelizPopoverMenuItem, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import type { PapelizSyncAccountReading, PapelizSyncSubscriptionState } from './papeliz-sync-engine-contract'
import { listPapelizSyncFakeNewDeviceAccountVaultReadings } from './papeliz-sync-fake-engine'
import {
  returnPapelizSyncFetchFromSyncPageToLive,
  usePapelizSyncFetchFromSyncPagePreviewStore,
  type PapelizSyncFetchFromSyncPagePreview,
  type PapelizSyncFetchFromSyncStep,
} from './papeliz-sync-fetch-from-sync-page-preview-store'

type PapelizSyncFetchFromSyncPagePreviewVaultList = 'reading' | 'to-download' | 'all-on-this-device' | 'none-yet' | 'read-failed'

// Each state's menu row: its group, words and icon, and what the page needs to show it.
const papelizSyncFetchFromSyncPagePreviewerChoices: ReadonlyArray<{
  fetchFromSyncPagePreviewChoiceKey: string
  fetchFromSyncPagePreviewChoiceLabel: string
  FetchFromSyncPagePreviewChoiceIcon: LucideIcon
  fetchFromSyncPagePreviewGroupHeading?: string
  previewFetchFromSyncStep: PapelizSyncFetchFromSyncStep
  previewSyncSubscriptionState?: PapelizSyncSubscriptionState
  previewVaultList?: PapelizSyncFetchFromSyncPagePreviewVaultList
}> = [
  {
    fetchFromSyncPagePreviewChoiceKey: 'waiting-for-fetch',
    fetchFromSyncPagePreviewChoiceLabel: 'Fetch (not signed in here)',
    FetchFromSyncPagePreviewChoiceIcon: CloudDownload,
    fetchFromSyncPagePreviewGroupHeading: 'Synced Vaults · Signing in',
    previewFetchFromSyncStep: 'waiting-for-fetch',
  },
  { fetchFromSyncPagePreviewChoiceKey: 'loading-engine', fetchFromSyncPagePreviewChoiceLabel: 'Loading Sync', FetchFromSyncPagePreviewChoiceIcon: Hourglass, previewFetchFromSyncStep: 'loading-engine' },
  { fetchFromSyncPagePreviewChoiceKey: 'engine-not-loaded', fetchFromSyncPagePreviewChoiceLabel: 'Sync didn’t load', FetchFromSyncPagePreviewChoiceIcon: CloudOff, previewFetchFromSyncStep: 'engine-not-loaded' },
  { fetchFromSyncPagePreviewChoiceKey: 'signed-out', fetchFromSyncPagePreviewChoiceLabel: 'Signed out', FetchFromSyncPagePreviewChoiceIcon: LogIn, previewFetchFromSyncStep: 'signed-out' },
  { fetchFromSyncPagePreviewChoiceKey: 'device-removed', fetchFromSyncPagePreviewChoiceLabel: 'Device signed out', FetchFromSyncPagePreviewChoiceIcon: LogOut, previewFetchFromSyncStep: 'device-removed' },
  { fetchFromSyncPagePreviewChoiceKey: 'waiting-for-sign-in', fetchFromSyncPagePreviewChoiceLabel: 'Waiting for sign-in', FetchFromSyncPagePreviewChoiceIcon: Cloud, previewFetchFromSyncStep: 'waiting-for-sign-in' },
  { fetchFromSyncPagePreviewChoiceKey: 'reading-account', fetchFromSyncPagePreviewChoiceLabel: 'Reading the account', FetchFromSyncPagePreviewChoiceIcon: Hourglass, previewFetchFromSyncStep: 'reading-account' },
  {
    fetchFromSyncPagePreviewChoiceKey: 'no-subscription',
    fetchFromSyncPagePreviewChoiceLabel: 'No subscription',
    FetchFromSyncPagePreviewChoiceIcon: ReceiptText,
    fetchFromSyncPagePreviewGroupHeading: 'Synced Vaults · Account',
    previewFetchFromSyncStep: 'no-subscription',
    previewSyncSubscriptionState: 'not-subscribed',
  },
  {
    fetchFromSyncPagePreviewChoiceKey: 'subscription-held',
    fetchFromSyncPagePreviewChoiceLabel: 'Subscription ended',
    FetchFromSyncPagePreviewChoiceIcon: TimerOff,
    previewFetchFromSyncStep: 'subscription-held',
    previewSyncSubscriptionState: 'ended-held',
  },
  {
    fetchFromSyncPagePreviewChoiceKey: 'cannot-reach-sync',
    fetchFromSyncPagePreviewChoiceLabel: 'Can’t reach Sync',
    FetchFromSyncPagePreviewChoiceIcon: WifiOff,
    previewFetchFromSyncStep: 'cannot-reach-sync',
    previewSyncSubscriptionState: 'active',
  },
  {
    fetchFromSyncPagePreviewChoiceKey: 'keys-not-set-up',
    fetchFromSyncPagePreviewChoiceLabel: 'Keys not set up',
    FetchFromSyncPagePreviewChoiceIcon: KeyRound,
    previewFetchFromSyncStep: 'keys-not-set-up',
    previewSyncSubscriptionState: 'active',
  },
  { fetchFromSyncPagePreviewChoiceKey: 'locked', fetchFromSyncPagePreviewChoiceLabel: 'Locked', FetchFromSyncPagePreviewChoiceIcon: Lock, previewFetchFromSyncStep: 'locked', previewSyncSubscriptionState: 'active' },
  {
    fetchFromSyncPagePreviewChoiceKey: 'vault-list-reading',
    fetchFromSyncPagePreviewChoiceLabel: 'Reading the vaults',
    FetchFromSyncPagePreviewChoiceIcon: Hourglass,
    fetchFromSyncPagePreviewGroupHeading: 'Synced Vaults · Vault list',
    previewFetchFromSyncStep: 'synced-vault-list',
    previewSyncSubscriptionState: 'active',
    previewVaultList: 'reading',
  },
  {
    fetchFromSyncPagePreviewChoiceKey: 'vault-list-to-download',
    fetchFromSyncPagePreviewChoiceLabel: 'Several to download',
    FetchFromSyncPagePreviewChoiceIcon: ListChecks,
    previewFetchFromSyncStep: 'synced-vault-list',
    previewSyncSubscriptionState: 'active',
    previewVaultList: 'to-download',
  },
  {
    fetchFromSyncPagePreviewChoiceKey: 'vault-list-read-only',
    fetchFromSyncPagePreviewChoiceLabel: 'Read-only after it ended',
    FetchFromSyncPagePreviewChoiceIcon: CloudCheck,
    previewFetchFromSyncStep: 'synced-vault-list',
    previewSyncSubscriptionState: 'ended-read-only',
    previewVaultList: 'to-download',
  },
  {
    fetchFromSyncPagePreviewChoiceKey: 'vault-list-all-on-this-device',
    fetchFromSyncPagePreviewChoiceLabel: 'All on this device',
    FetchFromSyncPagePreviewChoiceIcon: FolderCheck,
    previewFetchFromSyncStep: 'synced-vault-list',
    previewSyncSubscriptionState: 'active',
    previewVaultList: 'all-on-this-device',
  },
  {
    fetchFromSyncPagePreviewChoiceKey: 'vault-list-none-yet',
    fetchFromSyncPagePreviewChoiceLabel: 'No synced vaults yet',
    FetchFromSyncPagePreviewChoiceIcon: FolderX,
    previewFetchFromSyncStep: 'synced-vault-list',
    previewSyncSubscriptionState: 'active',
    previewVaultList: 'none-yet',
  },
  {
    fetchFromSyncPagePreviewChoiceKey: 'vault-list-read-failed',
    fetchFromSyncPagePreviewChoiceLabel: 'Couldn’t read the vaults',
    FetchFromSyncPagePreviewChoiceIcon: CircleAlert,
    previewFetchFromSyncStep: 'synced-vault-list',
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

function buildPreviewAccountVaultsOutcome(previewVaultList: PapelizSyncFetchFromSyncPagePreviewVaultList | undefined, currentTime: number): PapelizSyncFetchFromSyncPagePreview['previewAccountVaultsOutcome'] {
  if (previewVaultList === undefined || previewVaultList === 'reading') return null
  if (previewVaultList === 'read-failed') {
    return { syncActionOutcome: 'failed', syncActionFailureKind: 'offline', syncActionFailureMessage: 'Preview: offline', syncRetryAt: null }
  }
  if (previewVaultList === 'none-yet') return { syncActionOutcome: 'done', syncActionDoneValue: [] }
  return { syncActionOutcome: 'done', syncActionDoneValue: listPapelizSyncFakeNewDeviceAccountVaultReadings(currentTime, previewVaultList === 'all-on-this-device') }
}

let fetchFromSyncPagePreviewCount = 0
const papelizSyncFetchFromSyncPagePreviewerMenuWidth = 252

// The Synced Vaults page's previewer: a small dark button floating at the start screen's bottom
// right, development builds only. Its menu holds Live and each of the page's states; a pick opens the
// page in that state with made-up account and vaults, and a dot on the button says one is held.
export function PapelizSyncFetchFromSyncPagePreviewerButton() {
  const heldFetchFromSyncPagePreview = usePapelizSyncFetchFromSyncPagePreviewStore((fetchFromSyncPagePreviewState) => fetchFromSyncPagePreviewState.heldFetchFromSyncPagePreview)
  const [fetchFromSyncPagePreviewerMenuPosition, setFetchFromSyncPagePreviewerMenuPosition] = useState<PapelizPopoverMenuPosition | null>(null)

  const fetchFromSyncPagePreviewerMenuItems: PapelizPopoverMenuItem[] = [
    {
      menuItemKey: 'live',
      menuItemLabel: 'Live',
      MenuItemIcon: Eye,
      isMenuItemChecked: heldFetchFromSyncPagePreview === null,
      onMenuItemSelect: returnPapelizSyncFetchFromSyncPageToLive,
    },
    ...papelizSyncFetchFromSyncPagePreviewerChoices.map(
      (previewerChoice): PapelizPopoverMenuItem => ({
        menuItemKey: previewerChoice.fetchFromSyncPagePreviewChoiceKey,
        menuItemLabel: previewerChoice.fetchFromSyncPagePreviewChoiceLabel,
        MenuItemIcon: previewerChoice.FetchFromSyncPagePreviewChoiceIcon,
        menuItemGroupHeading: previewerChoice.fetchFromSyncPagePreviewGroupHeading,
        isMenuItemChecked: heldFetchFromSyncPagePreview?.fetchFromSyncPagePreviewChoiceKey === previewerChoice.fetchFromSyncPagePreviewChoiceKey,
        onMenuItemSelect: () => {
          const currentTime = Date.now()
          fetchFromSyncPagePreviewCount += 1
          usePapelizSyncFetchFromSyncPagePreviewStore.setState({
            heldFetchFromSyncPagePreview: {
              fetchFromSyncPagePreviewNumber: fetchFromSyncPagePreviewCount,
              fetchFromSyncPagePreviewChoiceKey: previewerChoice.fetchFromSyncPagePreviewChoiceKey,
              previewFetchFromSyncStep: previewerChoice.previewFetchFromSyncStep,
              previewSyncAccount:
                previewerChoice.previewSyncSubscriptionState === undefined ? null : buildPreviewSyncAccountReading(previewerChoice.previewSyncSubscriptionState, currentTime),
              previewAccountVaultsOutcome: buildPreviewAccountVaultsOutcome(previewerChoice.previewVaultList, currentTime),
            },
          })
        },
      }),
    ),
  ]

  return (
    <>
      <button
        type="button"
        aria-label="Preview Synced Vaults states"
        title="Preview Synced Vaults states (development builds only)"
        aria-haspopup="menu"
        aria-expanded={fetchFromSyncPagePreviewerMenuPosition !== null}
        data-papeliz-sync-fetch-from-sync-page-preview={heldFetchFromSyncPagePreview?.fetchFromSyncPagePreviewChoiceKey ?? 'live'}
        onClick={(clickEvent) => {
          // The menu opens to the button's left, as low as it fits.
          const previewerButtonRect = clickEvent.currentTarget.getBoundingClientRect()
          setFetchFromSyncPagePreviewerMenuPosition({
            menuAnchorLeft: previewerButtonRect.left - papelizSyncFetchFromSyncPagePreviewerMenuWidth - 8,
            menuAnchorTop: previewerButtonRect.bottom,
          })
        }}
        className="fixed right-4 bottom-4 z-40 grid size-9 place-items-center rounded-lg border border-[#0A2552] bg-[#0E3270] text-white shadow-papeliz-pop transition-[background-color,transform] duration-150 hover:bg-[#123C85] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-blue active:scale-[0.94]"
      >
        <CloudDownload className="size-[17px]" aria-hidden="true" />
        {heldFetchFromSyncPagePreview !== null && (
          <span aria-hidden="true" className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-papeliz-surface bg-[#F2B53A]" />
        )}
      </button>
      {fetchFromSyncPagePreviewerMenuPosition !== null && (
        <PapelizPopoverMenu
          menuLabel="Preview Synced Vaults states"
          menuPosition={fetchFromSyncPagePreviewerMenuPosition}
          menuItems={fetchFromSyncPagePreviewerMenuItems}
          onMenuClose={() => setFetchFromSyncPagePreviewerMenuPosition(null)}
        />
      )}
    </>
  )
}
