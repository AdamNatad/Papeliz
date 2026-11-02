import { AppWindow, Check, ChevronRight, Cloud, CloudCheck, CloudDownload, CloudOff, Ellipsis, FolderOpen, LoaderCircle, Lock, LockOpen, RefreshCw, RotateCcw, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizConfirmDialog } from '../ui/papeliz-confirm-dialog'
import { usePapelizFooterEqualButtonWidthRef } from '../ui/papeliz-footer-equal-button-width'
import { PapelizPopoverMenu, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import { createPapelizBrowserVault, openPapelizBrowserVault, pickFreePapelizBrowserVaultName, type PapelizBrowserVaultRecord } from '../vault/papeliz-browser-vaults'
import type { PapelizOpenVault } from '../vault/papeliz-open-vault'
import { describePapelizFailureMessage } from '../vault/papeliz-failure-code-words'
import { usePapelizBrowserStorageStore } from '../workspace/papeliz-browser-storage-store'
import {
  newVaultFormFooterActionButtonColorClassName,
  newVaultFormFooterButtonClassName,
  newVaultFormFooterCancelButtonColorClassName,
} from '../workspace/papeliz-new-vault-form'
import type { PapelizSyncAccountVaultReading, PapelizSyncActionOutcome, PapelizSyncEngine, PapelizSyncEngineSnapshot } from './papeliz-sync-engine-contract'
import {
  isPapelizSyncUsedOnThisDevice,
  readPapelizSyncDevFakeEngineScenarioText,
  usePapelizSyncEngineSnapshot,
  usePapelizSyncEngineStore,
  type PapelizSyncEngineLoadState,
} from './papeliz-sync-engine-store'
import {
  cancelPapelizSyncSignIn,
  describePapelizSyncSignInFromClickFailure,
  isPapelizSyncSubscriptionCurrent,
  startPapelizSyncSignInFromClick,
  startPapelizSyncSignInFromClickBeforeEngineLoads,
  type PapelizSyncSignInFromClickOutcome,
} from './papeliz-sync-flow-store'
import { usePapelizSyncClockTime } from './papeliz-sync-clock'
import { usePapelizSyncSyncedVaultsPagePreviewStore, type PapelizSyncSyncedVaultsPageStep } from './papeliz-sync-synced-vaults-page-preview-store'
import { PapelizSyncDetailPieces, PapelizSyncFailureLine, PapelizSyncLoadingLine, PapelizSyncTextButton } from './papeliz-sync-page-parts'
import { PapelizSyncPassphraseField } from './papeliz-sync-passphrase-fields'
import {
  describePapelizSyncActionFailureNow,
  describePapelizSyncDay,
  describePapelizSyncFileCount,
  formatPapelizSyncByteSize,
  papelizSyncVaultEncryptionKindDisplayNames,
} from './papeliz-sync-screen-words'
import { isPapelizSyncVaultCopiedHere, mapPapelizSyncVaultIdsToCopiesHere } from './papeliz-sync-fetched-copies'
import { requestPapelizSettingsGearSyncPage } from './papeliz-sync-settings-gear-request-store'
import { PapelizSyncStartScreenDownloadProgressLines, readPapelizSyncStartScreenDownloadPercent } from './papeliz-sync-start-screen-download-progress'
import {
  pickEmptyPapelizVaultFolderForSyncDownload,
  retryPapelizSyncStartScreenDownload,
  startPapelizSyncStartScreenDownload,
  usePapelizSyncStartScreenDownloadStore,
  type PapelizSyncStartScreenDownload,
} from './papeliz-sync-start-screen-download-store'

// Synced Vaults, in the start card in place of Recent Vaults (as New Vault's form is). On a device
// not signed in to Sync it opens on a Fetch button and reads nothing before it's pressed; signed in,
// it reads the account's vaults at once. Signed out it waits for the sign-in tab Fetch opened; signed
// in it lists the account's vaults, each with its kind (a lock for End-to-end), to download one into
// a new folder or browser vault. One already on this device opens on click; one downloading shows how
// far it is. An End-to-end vault asks its passphrase first, once on this device. A
// downloaded vault keeps syncing; the "…" menu at the top right can make it a copy that won't sync,
// after a warning. Refresh beside it reads the account and its vaults again. In development builds
// its previewer can hold any step with a made-up account and vaults.

type PapelizSyncDownloadPlace = 'folder-on-disk' | 'browser-vault-in-opfs'

// The steps before the account is signed in, where Refresh has nothing to read.
const papelizSyncSyncedVaultsPageStepsBeforeSignIn: ReadonlySet<PapelizSyncSyncedVaultsPageStep> = new Set([
  'waiting-for-fetch',
  'loading-engine',
  'engine-not-loaded',
  'signed-out',
  'device-removed',
  'waiting-for-sign-in',
])

function readSyncedVaultsPageStep(
  isSyncedVaultFetchStarted: boolean,
  syncEngineLoadState: PapelizSyncEngineLoadState,
  syncEngineSnapshot: PapelizSyncEngineSnapshot | null,
): PapelizSyncSyncedVaultsPageStep {
  if (!isSyncedVaultFetchStarted) return 'waiting-for-fetch'
  if (syncEngineLoadState === 'failed-to-load' || syncEngineLoadState === 'not-in-this-build') return 'engine-not-loaded'
  if (syncEngineSnapshot === null) return 'loading-engine'
  const { syncSignIn, syncAccount } = syncEngineSnapshot
  if (syncSignIn.syncSignInKind === 'device-removed') return 'device-removed'
  if (syncSignIn.syncSignInKind === 'waiting-for-sign-in-page') return 'waiting-for-sign-in'
  if (syncSignIn.syncSignInKind === 'signed-out') return 'signed-out'
  if (syncAccount === null) return 'reading-account'
  const syncSubscriptionState = syncAccount.syncSubscriptionState
  // Read-only after a subscription ended still downloads.
  if (syncSubscriptionState === 'ended-held') return 'subscription-held'
  if (!isPapelizSyncSubscriptionCurrent(syncSubscriptionState) && syncSubscriptionState !== 'ended-read-only') return 'no-subscription'
  return 'synced-vault-list'
}

function PapelizSyncSyncedVaultsPageCenteredStep({ SyncedVaultsPageStepIcon, syncedVaultsPageStepTitle, children }: { SyncedVaultsPageStepIcon: LucideIcon; syncedVaultsPageStepTitle: string; children?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-2 pb-3 text-center">
      <span className="grid size-[52px] place-items-center rounded-full bg-papeliz-blue-soft text-papeliz-blue">
        <SyncedVaultsPageStepIcon className="size-6" aria-hidden="true" />
      </span>
      <p className="mt-1 text-[15px] font-semibold">{syncedVaultsPageStepTitle}</p>
      {children}
    </div>
  )
}

function PapelizSyncSyncedVaultsPageStepText({ children }: { children: ReactNode }) {
  return <p className="max-w-[310px] text-[12.5px] leading-[1.5] text-papeliz-ink-muted">{children}</p>
}

// The "…" button at the top right of the vault list: its tooltip says what it's for, and its menu
// picks whether the vault keeps syncing or comes down as a copy (which asks first).
function PapelizSyncDownloadOptionsButton({ isSyncDownloadCopyOnly, onKeepInSyncChoose, onCopyOnlyChoose }: { isSyncDownloadCopyOnly: boolean; onKeepInSyncChoose: () => void; onCopyOnlyChoose: () => void }) {
  const syncDownloadOptionsButtonRef = useRef<HTMLButtonElement>(null)
  const syncDownloadOptionsTooltipId = useId()
  const [syncDownloadOptionsMenuPosition, setSyncDownloadOptionsMenuPosition] = useState<PapelizPopoverMenuPosition | null>(null)
  return (
    <div className="group/download-options relative flex-none">
      <button
        ref={syncDownloadOptionsButtonRef}
        type="button"
        aria-label="Sync Options"
        aria-describedby={syncDownloadOptionsTooltipId}
        aria-haspopup="menu"
        aria-expanded={syncDownloadOptionsMenuPosition !== null}
        onClick={() => {
          const syncDownloadOptionsButtonRect = syncDownloadOptionsButtonRef.current?.getBoundingClientRect()
          if (syncDownloadOptionsButtonRect === undefined) return
          setSyncDownloadOptionsMenuPosition({ menuAnchorLeft: syncDownloadOptionsButtonRect.right - 236, menuAnchorTop: syncDownloadOptionsButtonRect.bottom + 6 })
        }}
        className="grid size-8 place-items-center rounded-full border border-papeliz-line text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink aria-expanded:border-papeliz-blue-line aria-expanded:bg-papeliz-blue-soft aria-expanded:text-papeliz-blue"
      >
        <Ellipsis className="size-4" aria-hidden="true" />
      </button>
      {syncDownloadOptionsMenuPosition === null && (
        <span
          id={syncDownloadOptionsTooltipId}
          role="tooltip"
          className="pointer-events-none absolute top-full right-0 z-20 mt-1.5 w-[220px] rounded-lg bg-papeliz-ink px-2.5 py-1.5 text-[11.5px] leading-snug text-papeliz-surface opacity-0 shadow-papeliz-pop transition-opacity duration-150 group-focus-within/download-options:opacity-100 group-hover/download-options:opacity-100"
        >
          <b className="block font-semibold">Sync Options</b>
          It keeps syncing after it downloads. Choose Download a copy only to keep it off Sync.
        </span>
      )}
      {syncDownloadOptionsMenuPosition !== null && (
        <PapelizPopoverMenu
          menuLabel="Sync Options"
          menuPosition={syncDownloadOptionsMenuPosition}
          onMenuClose={() => setSyncDownloadOptionsMenuPosition(null)}
          menuItems={[
            { menuItemKey: 'keep-synced-vault-in-sync', menuItemLabel: 'Keep It in Sync', MenuItemIcon: CloudCheck, isMenuItemChecked: !isSyncDownloadCopyOnly, onMenuItemSelect: onKeepInSyncChoose },
            { menuItemKey: 'download-synced-vault-copy-only', menuItemLabel: 'Download a Copy Only', MenuItemIcon: CloudOff, isMenuItemChecked: isSyncDownloadCopyOnly, onMenuItemSelect: onCopyOnlyChoose },
          ]}
        />
      )}
    </div>
  )
}

interface PapelizSyncSyncedVaultsPageProps {
  syncedVaultsPageHeadingId: string
  // Where a vault can go in this browser. With both (Chrome and Edge) the page asks; with one it
  // uses that one.
  isFolderStorageOn: boolean
  isBrowserStorageOn: boolean
  existingBrowserVaultRecords: readonly PapelizBrowserVaultRecord[]
  // Every vault on this device, hidden ones too: a synced vault downloaded into one of them as a copy
  // shows as on this device.
  papelizVaultIdsOnThisDevice: ReadonlySet<string>
  // A synced vault already on this device was pressed: it opens, by its vault on this device.
  onVaultOnThisDeviceOpen: (papelizVaultId: string) => void
  onSyncedVaultsPageClose: () => void
  // A download started: back to Recent Vaults, where its row shows how far it is.
  onSyncDownloadStarted: () => void
}

export function PapelizSyncSyncedVaultsPage({
  syncedVaultsPageHeadingId,
  isFolderStorageOn,
  isBrowserStorageOn,
  existingBrowserVaultRecords,
  papelizVaultIdsOnThisDevice,
  onVaultOnThisDeviceOpen,
  onSyncedVaultsPageClose,
  onSyncDownloadStarted,
}: PapelizSyncSyncedVaultsPageProps) {
  const syncEngineLoadState = usePapelizSyncEngineStore((syncEngineState) => syncEngineState.syncEngineLoadState)
  const loadPapelizSyncEngine = usePapelizSyncEngineStore((syncEngineState) => syncEngineState.loadPapelizSyncEngine)
  const askBrowserToKeepStorage = usePapelizBrowserStorageStore((browserStorageState) => browserStorageState.askBrowserToKeepStorage)
  const syncEngineReading = usePapelizSyncEngineSnapshot()
  const syncedVaultsPageFooterRef = usePapelizFooterEqualButtonWidthRef(128)
  const syncedVaultsPageIdPrefix = useId()
  // A held preview (development builds only) stands in for the engine: the page shows its step,
  // account and vaults, and its buttons reach no engine.
  const heldSyncedVaultsPagePreview = usePapelizSyncSyncedVaultsPagePreviewStore((syncedVaultsPagePreviewState) => syncedVaultsPagePreviewState.heldSyncedVaultsPagePreview)
  // Fetch pressed since the page opened, or not needed: a device signed in to Sync before (or on the
  // dev fake engine) reads its vaults at once. Until then the page reads nothing.
  const [isSyncedVaultFetchStarted, setSyncedVaultFetchStarted] = useState(() => isPapelizSyncUsedOnThisDevice() || readPapelizSyncDevFakeEngineScenarioText() !== null)
  const syncedVaultsPageStep =
    heldSyncedVaultsPagePreview?.previewSyncedVaultsPageStep ?? readSyncedVaultsPageStep(isSyncedVaultFetchStarted, syncEngineLoadState, syncEngineReading?.syncEngineSnapshot ?? null)

  const syncClockTime = usePapelizSyncClockTime()
  // Why the sign-in Fetch started didn't happen, when it didn't.
  const [syncedVaultsPageSignInFailureWords, setSyncedVaultsPageSignInFailureWords] = useState<string | null>(null)
  const [syncedVaultsPageActionWords, setSyncedVaultsPageActionWords] = useState<string | null>(null)
  const [isSyncedVaultsPageActionRunning, setSyncedVaultsPageActionRunning] = useState(false)
  const [isSyncAccountRefreshRunning, setSyncAccountRefreshRunning] = useState(false)
  // The chosen End-to-end vault's passphrase, kept only while typed.
  const [typedSyncVaultPassphrase, setTypedSyncVaultPassphrase] = useState('')
  // End-to-end vaults unlocked on this page since the list was read, so they read as unlocked without
  // reading the list again.
  const [syncVaultIdsUnlockedHere, setSyncVaultIdsUnlockedHere] = useState<ReadonlySet<string>>(() => new Set())
  // The account's vaults, with the read they answer; an earlier read's answer isn't shown.
  const [accountVaultsReading, setAccountVaultsReading] = useState<{
    accountVaultsReadCount: number
    accountVaultsOutcome: PapelizSyncActionOutcome<PapelizSyncAccountVaultReading[]>
  } | null>(null)
  const [accountVaultsReadCount, setAccountVaultsReadCount] = useState(0)
  const [chosenPapelizSyncVaultId, setChosenPapelizSyncVaultId] = useState<string | null>(() => heldSyncedVaultsPagePreview?.previewChosenPapelizSyncVaultId ?? null)
  const [chosenDownloadPlace, setChosenDownloadPlace] = useState<PapelizSyncDownloadPlace>(isFolderStorageOn ? 'folder-on-disk' : 'browser-vault-in-opfs')
  const [isSyncDownloadCopyOnly, setSyncDownloadCopyOnly] = useState(false)
  const [isCopyOnlyWarningShown, setCopyOnlyWarningShown] = useState(false)

  // Once fetching, the engine loads; also when the browser blocked Fetch's tab, so the page goes on to
  // Sign in or the vaults.
  useEffect(() => {
    if (isSyncedVaultFetchStarted && heldSyncedVaultsPagePreview === null) void loadPapelizSyncEngine()
  }, [isSyncedVaultFetchStarted, heldSyncedVaultsPagePreview, loadPapelizSyncEngine])

  // The account's vaults, read when the list shows and again on Try again or Refresh.
  const papelizSyncEngine = heldSyncedVaultsPagePreview === null ? (syncEngineReading?.papelizSyncEngine ?? null) : null
  const isSyncedVaultListShown = syncedVaultsPageStep === 'synced-vault-list'
  useEffect(() => {
    if (!isSyncedVaultListShown || papelizSyncEngine === null) return
    let isVaultListLeft = false
    void papelizSyncEngine.listSyncedVaultsOnAccount().then((listedAccountVaultsOutcome) => {
      if (!isVaultListLeft) setAccountVaultsReading({ accountVaultsReadCount, accountVaultsOutcome: listedAccountVaultsOutcome })
    })
    return () => {
      isVaultListLeft = true
    }
  }, [isSyncedVaultListShown, papelizSyncEngine, accountVaultsReadCount])

  const liveAccountVaultsOutcome = accountVaultsReading?.accountVaultsReadCount === accountVaultsReadCount ? accountVaultsReading.accountVaultsOutcome : null
  const accountVaultsOutcome = heldSyncedVaultsPagePreview === null ? liveAccountVaultsOutcome : heldSyncedVaultsPagePreview.previewAccountVaultsOutcome
  const accountVaults = accountVaultsOutcome?.syncActionOutcome === 'done' ? accountVaultsOutcome.syncActionDoneValue : null
  // A synced vault is never offered again once it's here: syncing, downloaded as a copy (which isn't
  // linked to Sync, so only this device's own record knows it), or downloading now.
  const syncVaultCopiesHere = useMemo(() => mapPapelizSyncVaultIdsToCopiesHere(papelizVaultIdsOnThisDevice), [papelizVaultIdsOnThisDevice])
  // A copy whose download finished while the page was open reads as a copy at once, without Refresh.
  const isAccountVaultCopiedHere = (accountVault: PapelizSyncAccountVaultReading) =>
    isPapelizSyncVaultCopiedHere(accountVault.papelizSyncVaultId, accountVault.papelizVaultIdOnThisDevice, syncVaultCopiesHere)
  // The downloads from the start screen, as their Recent Vaults rows show them, by the synced vault.
  const syncStartScreenDownloadsByVaultId = usePapelizSyncStartScreenDownloadStore((syncStartScreenDownloadState) => syncStartScreenDownloadState.syncStartScreenDownloadsByVaultId)
  const syncStartScreenDownloadsBySyncVaultId = useMemo(
    () =>
      new Map<string, PapelizSyncStartScreenDownload>(
        Object.values(syncStartScreenDownloadsByVaultId).map((syncStartScreenDownload) => [syncStartScreenDownload.papelizSyncVaultId, syncStartScreenDownload]),
      ),
    [syncStartScreenDownloadsByVaultId],
  )
  const accountVaultsToDownload =
    accountVaults?.filter(
      (accountVault) =>
        accountVault.papelizVaultIdOnThisDevice === null && !isAccountVaultCopiedHere(accountVault) && !syncStartScreenDownloadsBySyncVaultId.has(accountVault.papelizSyncVaultId),
    ) ?? []
  const isAccountVaultLockedHere = (accountVault: PapelizSyncAccountVaultReading) => accountVault.syncVaultLockState === 'locked' && !syncVaultIdsUnlockedHere.has(accountVault.papelizSyncVaultId)
  // The first one to download is picked until another is, one that needs no passphrase if any.
  const chosenAccountVault =
    accountVaultsToDownload.find((accountVault) => accountVault.papelizSyncVaultId === chosenPapelizSyncVaultId) ??
    accountVaultsToDownload.find((accountVault) => !isAccountVaultLockedHere(accountVault)) ??
    accountVaultsToDownload[0] ??
    null
  // An End-to-end vault this device has no key for asks its passphrase before anything downloads.
  const isChosenVaultPassphraseAsked = chosenAccountVault !== null && isAccountVaultLockedHere(chosenAccountVault)
  const isDownloadPlaceChoiceShown = isFolderStorageOn && isBrowserStorageOn
  const syncAccount = heldSyncedVaultsPagePreview === null ? (syncEngineReading?.syncEngineSnapshot.syncAccount ?? null) : heldSyncedVaultsPagePreview.previewSyncAccount

  // Leaving the page while it waits for a sign-in cancels that sign-in, whichever way it's left: Close,
  // Esc, the sidebar, the logo or a vault opening. The check runs just after the page
  // goes, so a page that comes straight back (React's development double mount) keeps its sign-in.
  const isSyncedVaultsPageWaitingForSignInRef = useRef(false)
  const isSyncedVaultsPageMountedRef = useRef(false)
  useEffect(() => {
    isSyncedVaultsPageWaitingForSignInRef.current = syncedVaultsPageStep === 'waiting-for-sign-in' && heldSyncedVaultsPagePreview === null
  }, [syncedVaultsPageStep, heldSyncedVaultsPagePreview])
  useEffect(() => {
    isSyncedVaultsPageMountedRef.current = true
    return () => {
      isSyncedVaultsPageMountedRef.current = false
      if (!isSyncedVaultsPageWaitingForSignInRef.current) return
      queueMicrotask(() => {
        if (!isSyncedVaultsPageMountedRef.current) cancelPapelizSyncSignIn()
      })
    }
  }, [])

  const signInFromClick = () => {
    if (papelizSyncEngine === null) return
    setSyncedVaultsPageActionWords(null)
    void startPapelizSyncSignInFromClick(papelizSyncEngine, null).then((signInFromClickOutcome) =>
      setSyncedVaultsPageActionWords(describePapelizSyncSignInFromClickFailure(signInFromClickOutcome)),
    )
  }

  // Fetch, on a device not signed in here: the sign-in page opens in a new tab from this click (before
  // the engine has loaded, a blank tab that goes there once it has, and closes if it finds this device
  // signed in after all), then the engine loads and the account's vaults are read once the list shows.
  // Only the click itself may open the tab.
  const fetchSyncedVaultsFromClick = () => {
    if (heldSyncedVaultsPagePreview !== null) return
    setSyncedVaultFetchStarted(true)
    setSyncedVaultsPageSignInFailureWords(null)
    setSyncedVaultsPageActionWords(null)
    const followSignInFromClick = (signInFromClick: Promise<PapelizSyncSignInFromClickOutcome>) =>
      void signInFromClick.then((signInFromClickOutcome) => setSyncedVaultsPageSignInFailureWords(describePapelizSyncSignInFromClickFailure(signInFromClickOutcome)))
    if (papelizSyncEngine === null) {
      followSignInFromClick(startPapelizSyncSignInFromClickBeforeEngineLoads(loadPapelizSyncEngine))
      return
    }
    const syncSignInKind = papelizSyncEngine.getSyncEngineSnapshot().syncSignIn.syncSignInKind
    if (syncSignInKind === 'signed-out' || syncSignInKind === 'device-removed') followSignInFromClick(startPapelizSyncSignInFromClick(papelizSyncEngine, null))
  }

  // Refresh, once signed in: the account is read again, then its vaults. Pressing it again while it
  // reads does nothing.
  const refreshSyncAccountAndVaults = () => {
    if (papelizSyncEngine === null || isSyncAccountRefreshRunning) return
    setSyncedVaultsPageActionWords(null)
    setSyncAccountRefreshRunning(true)
    void papelizSyncEngine
      .refreshSyncAccountReading()
      .then((accountRefreshOutcome) => {
        if (accountRefreshOutcome.syncActionOutcome === 'failed') setSyncedVaultsPageActionWords(describePapelizSyncActionFailureNow(accountRefreshOutcome))
        setAccountVaultsReadCount((readCount) => readCount + 1)
      })
      .finally(() => setSyncAccountRefreshRunning(false))
  }

  const runSyncedVaultsPageAction = async (syncedVaultsPageAction: () => Promise<string | null>) => {
    setSyncedVaultsPageActionWords(null)
    setSyncedVaultsPageActionRunning(true)
    try {
      setSyncedVaultsPageActionWords(await syncedVaultsPageAction())
    } finally {
      setSyncedVaultsPageActionRunning(false)
    }
  }

  // Unlock, for the chosen End-to-end vault: its key comes to this device, then Pick Folder or
  // Download shows (the folder window needs a click of its own).
  const unlockChosenAccountVault = () => {
    if (papelizSyncEngine === null || chosenAccountVault === null || typedSyncVaultPassphrase === '') return
    const syncVaultPassphrase = typedSyncVaultPassphrase
    const papelizSyncVaultIdToUnlock = chosenAccountVault.papelizSyncVaultId
    void runSyncedVaultsPageAction(async () => {
      const unlockOutcome = await papelizSyncEngine.unlockSyncedVaultWithPassphrase(papelizSyncVaultIdToUnlock, syncVaultPassphrase)
      if (unlockOutcome.syncActionOutcome === 'failed') return describePapelizSyncActionFailureNow(unlockOutcome)
      setTypedSyncVaultPassphrase('')
      setSyncVaultIdsUnlockedHere((unlockedSyncVaultIds) => new Set([...unlockedSyncVaultIds, papelizSyncVaultIdToUnlock]))
      return null
    })
  }

  // Makes the new vault, then hands it to the download store. Runs from Pick Folder's or Download's
  // click: the folder window needs it.
  const downloadChosenAccountVault = (chosenSyncEngine: PapelizSyncEngine, accountVaultToDownload: PapelizSyncAccountVaultReading) => {
    const syncVaultName = accountVaultToDownload.syncVaultName
    void runSyncedVaultsPageAction(async () => {
      let papelizOpenVault: PapelizOpenVault
      if (chosenDownloadPlace === 'folder-on-disk') {
        const syncDownloadFolderPickResult = await pickEmptyPapelizVaultFolderForSyncDownload()
        if ('syncDownloadFolderRefusalWords' in syncDownloadFolderPickResult) return syncDownloadFolderPickResult.syncDownloadFolderRefusalWords
        papelizOpenVault = syncDownloadFolderPickResult.papelizOpenVault
      } else {
        askBrowserToKeepStorage()
        try {
          const createdBrowserVaultRecord = await createPapelizBrowserVault(pickFreePapelizBrowserVaultName(syncVaultName, existingBrowserVaultRecords))
          const openVaultResult = await openPapelizBrowserVault(createdBrowserVaultRecord)
          if (openVaultResult.openVaultOutcome !== 'opened') return openVaultResult.openVaultOutcome === 'failed' ? openVaultResult.openVaultFailureMessage : 'Couldn’t open the new vault.'
          papelizOpenVault = openVaultResult.papelizOpenVault
        } catch (browserVaultCreateError) {
          return describePapelizFailureMessage(`Couldn’t make “${syncVaultName}”`, browserVaultCreateError, { failedEntryName: syncVaultName, failedEntryKind: 'vault' })
        }
      }
      void startPapelizSyncStartScreenDownload({ papelizSyncEngine: chosenSyncEngine, papelizOpenVault, papelizSyncVaultId: accountVaultToDownload.papelizSyncVaultId, isSyncDownloadCopyOnly })
      onSyncDownloadStarted()
      return null
    })
  }

  // The page's heading line, body and footer action, for the step it's on.
  let syncedVaultsPageSubtitle = 'Download a vault from your Papeliz Sync account.'
  let syncedVaultsPageBody: ReactNode = null
  // Its icon is the solid check for an action that confirms a choice (Sign in, Pick Folder, Download,
  // Unlock); Try again and See plans have their own.
  let syncedVaultsPagePrimaryAction: { primaryActionLabel: string; isPrimaryActionDisabled?: boolean; onPrimaryActionSelect: () => void } | null = null

  switch (syncedVaultsPageStep) {
    case 'waiting-for-fetch':
      syncedVaultsPageBody = (
        <PapelizSyncSyncedVaultsPageCenteredStep SyncedVaultsPageStepIcon={CloudDownload} syncedVaultsPageStepTitle="Fetch your synced vaults">
          <PapelizSyncSyncedVaultsPageStepText>Fetch opens the Sync sign-in page in a new tab, then reads your vaults.</PapelizSyncSyncedVaultsPageStepText>
          <button
            type="button"
            onClick={fetchSyncedVaultsFromClick}
            className={joinPapelizClassNames(newVaultFormFooterButtonClassName, newVaultFormFooterActionButtonColorClassName, 'mt-2.5 min-w-[128px]')}
          >
            <CloudDownload className="size-[15px] flex-none" aria-hidden="true" />
            Fetch
          </button>
        </PapelizSyncSyncedVaultsPageCenteredStep>
      )
      break
    case 'loading-engine':
      syncedVaultsPageBody = <PapelizSyncLoadingLine>Loading Sync…</PapelizSyncLoadingLine>
      break
    case 'engine-not-loaded':
      syncedVaultsPageBody = (
        <PapelizSyncSyncedVaultsPageCenteredStep SyncedVaultsPageStepIcon={CloudOff} syncedVaultsPageStepTitle="Papeliz Sync didn’t load">
          <PapelizSyncSyncedVaultsPageStepText>Check your connection, then try again.</PapelizSyncSyncedVaultsPageStepText>
        </PapelizSyncSyncedVaultsPageCenteredStep>
      )
      syncedVaultsPagePrimaryAction = {
        primaryActionLabel: 'Try Again',
        onPrimaryActionSelect: () => {
          if (heldSyncedVaultsPagePreview === null) void loadPapelizSyncEngine()
        },
      }
      break
    case 'signed-out':
    case 'device-removed':
      syncedVaultsPageBody = (
        <PapelizSyncSyncedVaultsPageCenteredStep SyncedVaultsPageStepIcon={Cloud} syncedVaultsPageStepTitle="Sign in to see your synced vaults">
          <PapelizSyncSyncedVaultsPageStepText>
            {syncedVaultsPageStep === 'device-removed' ? 'This device was signed out of Sync. ' : ''}The sign-in page opens in a new tab.
          </PapelizSyncSyncedVaultsPageStepText>
          <p className="mt-1 text-[12px] text-papeliz-ink-subtle">
            No subscription? Sync is a paid add-on. <PapelizSyncTextButton onClick={requestPapelizSettingsGearSyncPage}>See Plans</PapelizSyncTextButton>
          </p>
        </PapelizSyncSyncedVaultsPageCenteredStep>
      )
      syncedVaultsPagePrimaryAction = { primaryActionLabel: 'Sign In', onPrimaryActionSelect: signInFromClick }
      break
    case 'waiting-for-sign-in':
      syncedVaultsPageBody = (
        <PapelizSyncSyncedVaultsPageCenteredStep SyncedVaultsPageStepIcon={Cloud} syncedVaultsPageStepTitle="Finish signing in in the new tab">
          <PapelizSyncSyncedVaultsPageStepText>Papeliz carries on here once you’re signed in.</PapelizSyncSyncedVaultsPageStepText>
          <p className="mt-1 text-[12px] text-papeliz-ink-subtle">
            Tab didn’t open? <PapelizSyncTextButton onClick={signInFromClick}>Open the Sign-In Page</PapelizSyncTextButton>
          </p>
        </PapelizSyncSyncedVaultsPageCenteredStep>
      )
      break
    case 'reading-account':
      syncedVaultsPageBody = <PapelizSyncLoadingLine>Reading your account…</PapelizSyncLoadingLine>
      break
    case 'no-subscription':
      syncedVaultsPageBody = (
        <PapelizSyncSyncedVaultsPageCenteredStep SyncedVaultsPageStepIcon={Cloud} syncedVaultsPageStepTitle="No Sync subscription on this account">
          <PapelizSyncSyncedVaultsPageStepText>Papeliz Sync is a paid add-on. Choose a plan, then turn Sync on for a vault on another device to fetch it here.</PapelizSyncSyncedVaultsPageStepText>
        </PapelizSyncSyncedVaultsPageCenteredStep>
      )
      syncedVaultsPagePrimaryAction = { primaryActionLabel: 'See Plans', onPrimaryActionSelect: requestPapelizSettingsGearSyncPage }
      break
    case 'subscription-held':
      syncedVaultsPageBody = (
        <PapelizSyncSyncedVaultsPageCenteredStep SyncedVaultsPageStepIcon={CloudOff} syncedVaultsPageStepTitle="Your subscription ended">
          <PapelizSyncSyncedVaultsPageStepText>
            {syncAccount?.syncSyncedCopyDeletedAt == null
              ? 'The synced copy is kept for a while, then deleted.'
              : `The synced copy is kept until ${describePapelizSyncDay(syncAccount.syncSyncedCopyDeletedAt, syncClockTime)}, then deleted.`}{' '}
            Subscribe again to download it.
          </PapelizSyncSyncedVaultsPageStepText>
        </PapelizSyncSyncedVaultsPageCenteredStep>
      )
      syncedVaultsPagePrimaryAction = { primaryActionLabel: 'See Plans', onPrimaryActionSelect: requestPapelizSettingsGearSyncPage }
      break
    case 'synced-vault-list': {
      if (accountVaultsOutcome === null) {
        syncedVaultsPageBody = <PapelizSyncLoadingLine>Reading your synced vaults…</PapelizSyncLoadingLine>
        break
      }
      if (accountVaultsOutcome.syncActionOutcome === 'failed') {
        syncedVaultsPageBody = (
          <PapelizSyncSyncedVaultsPageCenteredStep SyncedVaultsPageStepIcon={CloudOff} syncedVaultsPageStepTitle="Couldn’t read your synced vaults">
            <PapelizSyncSyncedVaultsPageStepText>{describePapelizSyncActionFailureNow(accountVaultsOutcome)}</PapelizSyncSyncedVaultsPageStepText>
          </PapelizSyncSyncedVaultsPageCenteredStep>
        )
        syncedVaultsPagePrimaryAction = { primaryActionLabel: 'Try Again', onPrimaryActionSelect: () => setAccountVaultsReadCount((readCount) => readCount + 1) }
        break
      }
      const accountVaultCount = accountVaultsOutcome.syncActionDoneValue.length
      if (accountVaultCount === 0) {
        syncedVaultsPageSubtitle = 'No synced vaults on your account yet.'
        syncedVaultsPageBody = (
          <PapelizSyncSyncedVaultsPageCenteredStep SyncedVaultsPageStepIcon={Cloud} syncedVaultsPageStepTitle="No synced vaults yet">
            <PapelizSyncSyncedVaultsPageStepText>Turn Sync on for a vault in Settings, on this device or another one.</PapelizSyncSyncedVaultsPageStepText>
          </PapelizSyncSyncedVaultsPageCenteredStep>
        )
        break
      }
      const isEveryAccountVaultHere = accountVaultsToDownload.length === 0
      syncedVaultsPageSubtitle = isEveryAccountVaultHere
        ? 'Every vault on your account is on this device.'
        : `${accountVaultCount} ${accountVaultCount === 1 ? 'vault' : 'vaults'} on your account. ${isSyncDownloadCopyOnly ? 'Pick one to download as a copy that won’t sync.' : 'Pick one to download; it stays in sync.'}`
      syncedVaultsPageBody = (
        <>
          {syncAccount?.syncSubscriptionState === 'ended-read-only' && (
            <p className="rounded-xl bg-papeliz-warning px-3 py-2 text-[12.5px] leading-[1.45] text-papeliz-warning-ink">
              Your subscription ended, so the synced copy is read-only
              {syncAccount.syncReadOnlyUntil === null ? '' : ` until ${describePapelizSyncDay(syncAccount.syncReadOnlyUntil, syncClockTime)}`}. You can still download it.
            </p>
          )}
          <p id={`${syncedVaultsPageIdPrefix}-vault-label`} className="px-0.5 text-[12px] font-semibold text-papeliz-ink-muted">
            Vault
          </p>
          {/* One group for every vault: the radios pick one to download; a vault already here is a button
              that opens it; one downloading shows how far it is. */}
          <div role="group" aria-labelledby={`${syncedVaultsPageIdPrefix}-vault-label`} className="flex flex-col gap-1.5">
            {accountVaultsOutcome.syncActionDoneValue.map((accountVault) => {
              const syncStartScreenDownload = syncStartScreenDownloadsBySyncVaultId.get(accountVault.papelizSyncVaultId)
              const isAccountVaultCopy = isAccountVaultCopiedHere(accountVault)
              // The vault on this device it syncs with, or the copy it came down as.
              const papelizVaultIdOfAccountVaultHere = accountVault.papelizVaultIdOnThisDevice ?? syncVaultCopiesHere.get(accountVault.papelizSyncVaultId) ?? null
              const isAccountVaultHere = papelizVaultIdOfAccountVaultHere !== null || syncStartScreenDownload !== undefined
              // A held preview's made-up vaults open too, to its Preview Only notice.
              const isAccountVaultOpenable =
                syncStartScreenDownload === undefined &&
                papelizVaultIdOfAccountVaultHere !== null &&
                (heldSyncedVaultsPagePreview !== null || papelizVaultIdsOnThisDevice.has(papelizVaultIdOfAccountVaultHere))
              const isAccountVaultChosen = !isAccountVaultHere && accountVault.papelizSyncVaultId === chosenAccountVault?.papelizSyncVaultId
              const accountVaultName = accountVault.syncVaultName
              const isAccountVaultEndToEnd = accountVault.syncVaultEncryptionKind === 'end-to-end'
              const AccountVaultLockIcon = isAccountVaultLockedHere(accountVault) ? Lock : LockOpen
              const accountVaultRowClassName = 'flex items-center gap-2.5 rounded-xl border px-2.5 py-[7px] transition-colors'
              const accountVaultNameAndLine = (
                <>
                  <span
                    aria-hidden="true"
                    className={joinPapelizClassNames(
                      'grid size-8 flex-none place-items-center rounded-lg text-[14px] font-semibold text-papeliz-blue',
                      isAccountVaultHere ? 'bg-papeliz-blue-soft' : 'border-[1.5px] border-dashed border-papeliz-blue-line',
                    )}
                  >
                    {accountVaultName.trim().charAt(0).toUpperCase() || '·'}
                  </span>
                  {/* Dimmed only when it's here but can't open from this page (its vault isn't in Recent Vaults). */}
                  <span
                    className={joinPapelizClassNames(
                      'flex min-w-0 flex-1 flex-col gap-0.5',
                      isAccountVaultHere && !isAccountVaultOpenable && syncStartScreenDownload === undefined && 'opacity-60',
                    )}
                  >
                    <span className="truncate text-[13.5px] font-semibold">{accountVaultName}</span>
                    {syncStartScreenDownload !== undefined ? (
                      <PapelizSyncStartScreenDownloadProgressLines syncStartScreenDownload={syncStartScreenDownload} />
                    ) : (
                      <span className="flex flex-wrap items-center gap-x-1 text-[11.5px] text-papeliz-ink-subtle tabular-nums">
                        <PapelizSyncDetailPieces
                          syncDetailPieces={[
                            {
                              syncDetailPieceKey: 'encryption-kind',
                              syncDetailPieceContent: (
                                <span
                                  className="inline-flex items-center gap-1"
                                  title={isAccountVaultEndToEnd ? (isAccountVaultLockedHere(accountVault) ? 'End-to-end: its passphrase is asked once on this device' : 'End-to-end, unlocked on this device') : undefined}
                                >
                                  {isAccountVaultEndToEnd && <AccountVaultLockIcon className="size-3 flex-none" aria-hidden="true" />}
                                  {papelizSyncVaultEncryptionKindDisplayNames[accountVault.syncVaultEncryptionKind]}
                                </span>
                              ),
                              syncDetailPieceClassName: isAccountVaultEndToEnd ? 'font-medium text-papeliz-ink-muted' : undefined,
                            },
                            { syncDetailPieceKey: 'file-count', syncDetailPieceContent: describePapelizSyncFileCount(accountVault.syncVaultFileCount) },
                            { syncDetailPieceKey: 'stored-size', syncDetailPieceContent: formatPapelizSyncByteSize(accountVault.syncVaultStoredByteLength) },
                          ]}
                        />
                      </span>
                    )}
                  </span>
                </>
              )
              const accountVaultHereBadge = (
                <span className="inline-flex h-5 flex-none items-center gap-1 rounded-full bg-papeliz-surface-gray px-2 text-[11px] font-semibold text-papeliz-ink-muted">
                  {isAccountVaultCopy ? <CloudOff className="size-3" aria-hidden="true" /> : <Check className="size-3" aria-hidden="true" />}
                  {isAccountVaultCopy ? 'Copy on this device' : 'On this device'}
                </span>
              )
              if (syncStartScreenDownload !== undefined) {
                const syncDownloadPercent = readPapelizSyncStartScreenDownloadPercent(syncStartScreenDownload)
                const isSyncDownloadStopped = syncStartScreenDownload.syncStartScreenDownloadStage === 'stopped'
                return (
                  <div
                    key={accountVault.papelizSyncVaultId}
                    className={joinPapelizClassNames(accountVaultRowClassName, 'bg-papeliz-surface', isSyncDownloadStopped ? 'border-papeliz-diff-removed-ink/35' : 'border-papeliz-blue-line')}
                  >
                    {accountVaultNameAndLine}
                    {isSyncDownloadStopped ? (
                      <button
                        type="button"
                        onClick={() => void retryPapelizSyncStartScreenDownload(syncStartScreenDownload.papelizVaultId)}
                        className="inline-flex h-7 flex-none items-center gap-1.5 rounded-full border border-papeliz-line-strong px-3 text-[12.5px] font-semibold text-papeliz-ink hover:bg-papeliz-hover"
                      >
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                        Try Again
                      </button>
                    ) : (
                      syncDownloadPercent !== null && <span className="flex-none text-[11.5px] text-papeliz-ink-subtle tabular-nums">{syncDownloadPercent}%</span>
                    )}
                  </div>
                )
              }
              if (isAccountVaultOpenable && papelizVaultIdOfAccountVaultHere !== null) {
                return (
                  <button
                    key={accountVault.papelizSyncVaultId}
                    type="button"
                    title={`Open “${accountVaultName}”`}
                    onClick={() => onVaultOnThisDeviceOpen(papelizVaultIdOfAccountVaultHere)}
                    className={joinPapelizClassNames(
                      accountVaultRowClassName,
                      'group w-full border-papeliz-line bg-papeliz-surface text-left hover:border-papeliz-blue-line hover:bg-papeliz-blue-soft/40',
                    )}
                  >
                    {accountVaultNameAndLine}
                    {accountVaultHereBadge}
                    <ChevronRight className="-ml-1 size-4 flex-none text-papeliz-ink-subtle transition-colors group-hover:text-papeliz-blue" aria-hidden="true" />
                  </button>
                )
              }
              if (isAccountVaultHere) {
                return (
                  <div key={accountVault.papelizSyncVaultId} className={joinPapelizClassNames(accountVaultRowClassName, 'border-papeliz-line bg-papeliz-surface')}>
                    {accountVaultNameAndLine}
                    {accountVaultHereBadge}
                  </div>
                )
              }
              return (
                <label
                  key={accountVault.papelizSyncVaultId}
                  className={joinPapelizClassNames(
                    accountVaultRowClassName,
                    'cursor-pointer',
                    isAccountVaultChosen ? 'border-papeliz-blue-line bg-papeliz-blue-soft' : 'border-papeliz-line bg-papeliz-surface hover:bg-papeliz-hover',
                  )}
                >
                  {accountVaultNameAndLine}
                  <input
                    type="radio"
                    name={`${syncedVaultsPageIdPrefix}-synced-vault`}
                    checked={isAccountVaultChosen}
                    onChange={() => {
                      setChosenPapelizSyncVaultId(accountVault.papelizSyncVaultId)
                      setTypedSyncVaultPassphrase('')
                      setSyncedVaultsPageActionWords(null)
                    }}
                    className="size-4 flex-none cursor-pointer accent-papeliz-blue"
                  />
                </label>
              )
            })}
          </div>
          {isChosenVaultPassphraseAsked && chosenAccountVault !== null && (
            <form
              className="mt-1"
              onSubmit={(submitEvent) => {
                submitEvent.preventDefault()
                if (!isSyncedVaultsPageActionRunning) unlockChosenAccountVault()
              }}
            >
              <PapelizSyncPassphraseField
                key={chosenAccountVault.papelizSyncVaultId}
                syncPassphraseFieldLabel={`Passphrase for “${chosenAccountVault.syncVaultName}”`}
                syncPassphrase={typedSyncVaultPassphrase}
                onSyncPassphraseChange={setTypedSyncVaultPassphrase}
                isSyncPassphraseShown={false}
                syncPassphraseAutoComplete="current-password"
                isSyncPassphraseFieldFocusedFirst
              />
              <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
              <p className="mt-1.5 px-0.5 text-[12px] leading-[1.45] text-papeliz-ink-subtle">
                It’s End-to-end, so it’s asked once on this device. Forgot it? Papeliz can’t recover it:{' '}
                <PapelizSyncTextButton onClick={requestPapelizSettingsGearSyncPage}>remove it from Sync in Settings</PapelizSyncTextButton>.
              </p>
            </form>
          )}
          {!isEveryAccountVaultHere && !isChosenVaultPassphraseAsked && isDownloadPlaceChoiceShown && (
            <>
              <p id={`${syncedVaultsPageIdPrefix}-place-label`} className="mt-1 px-0.5 text-[12px] font-semibold text-papeliz-ink-muted">
                Keep it in
              </p>
              <div role="radiogroup" aria-labelledby={`${syncedVaultsPageIdPrefix}-place-label`} className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                {(
                  [
                    { downloadPlace: 'folder-on-disk', DownloadPlaceIcon: FolderOpen, downloadPlaceTitle: 'Folder Storage', downloadPlaceLine: 'An empty folder on your machine', downloadPlaceBadgeTone: 'recommended' },
                    { downloadPlace: 'browser-vault-in-opfs', DownloadPlaceIcon: AppWindow, downloadPlaceTitle: 'Browser Storage', downloadPlaceLine: 'Inside this browser', downloadPlaceBadgeTone: 'risky' },
                  ] as const
                ).map(({ downloadPlace, DownloadPlaceIcon, downloadPlaceTitle, downloadPlaceLine, downloadPlaceBadgeTone }) => {
                  const isDownloadPlaceChosen = downloadPlace === chosenDownloadPlace
                  return (
                    <label
                      key={downloadPlace}
                      className={joinPapelizClassNames(
                        'flex cursor-pointer items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors',
                        isDownloadPlaceChosen ? 'border-papeliz-blue-line bg-papeliz-blue-soft' : 'border-papeliz-line bg-papeliz-surface hover:bg-papeliz-hover',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={joinPapelizClassNames(
                          'grid size-8 flex-none place-items-center rounded-lg transition-colors',
                          isDownloadPlaceChosen ? 'bg-papeliz-chosen-tab-ground text-white' : 'bg-papeliz-surface-gray text-papeliz-ink-muted',
                        )}
                      >
                        <DownloadPlaceIcon className="size-4" />
                      </span>
                      <input
                        type="radio"
                        name={`${syncedVaultsPageIdPrefix}-download-place`}
                        checked={isDownloadPlaceChosen}
                        onChange={() => setChosenDownloadPlace(downloadPlace)}
                        className="sr-only"
                      />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 text-[13px] leading-tight font-semibold whitespace-nowrap">
                          {downloadPlaceTitle}
                          {/* The same tags as New Vault's form. */}
                          <span
                            className={joinPapelizClassNames(
                              'rounded-full border px-1.5 py-px text-[10px] leading-snug font-semibold',
                              downloadPlaceBadgeTone === 'recommended'
                                ? 'border-papeliz-diff-added-ink/30 bg-papeliz-diff-added text-papeliz-diff-added-ink'
                                : 'border-papeliz-diff-removed-ink/30 bg-papeliz-diff-removed text-papeliz-diff-removed-ink',
                            )}
                          >
                            {downloadPlaceBadgeTone === 'recommended' ? 'Recommended' : 'Risky'}
                          </span>
                        </span>
                        <span className="truncate text-[11.5px] text-papeliz-ink-subtle">{downloadPlaceLine}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </>
          )}
          {!isEveryAccountVaultHere && !isChosenVaultPassphraseAsked && !isFolderStorageOn && (
            <p className="mt-1 flex items-center gap-1.5 px-0.5 text-[12px] text-papeliz-ink-muted">
              <AppWindow className="size-3.5 flex-none" aria-hidden="true" />
              It’s kept in this browser, and Sync is its backup.
            </p>
          )}
        </>
      )
      // Nothing left to download: no action, only Close.
      if (isEveryAccountVaultHere) break
      if (isChosenVaultPassphraseAsked) {
        syncedVaultsPagePrimaryAction = {
          primaryActionLabel: 'Unlock',
          isPrimaryActionDisabled: typedSyncVaultPassphrase === '' || isSyncedVaultsPageActionRunning,
          onPrimaryActionSelect: unlockChosenAccountVault,
        }
        break
      }
      const isFolderPickedNext = chosenDownloadPlace === 'folder-on-disk' && isFolderStorageOn
      syncedVaultsPagePrimaryAction = {
        primaryActionLabel: isFolderPickedNext ? 'Pick Folder' : 'Download',
        isPrimaryActionDisabled: chosenAccountVault === null || isSyncedVaultsPageActionRunning,
        onPrimaryActionSelect: () => {
          if (chosenAccountVault !== null && papelizSyncEngine !== null) downloadChosenAccountVault(papelizSyncEngine, chosenAccountVault)
        },
      }
      break
    }
  }

  const isSyncDownloadOptionsButtonShown = isSyncedVaultListShown && accountVaultsToDownload.length > 0
  // Refresh shows once signed in (not beside Try again when the vaults couldn't be read); its icon turns
  // while the account or its vaults are read.
  const isSyncedVaultsRefreshButtonShown = !papelizSyncSyncedVaultsPageStepsBeforeSignIn.has(syncedVaultsPageStep) && accountVaultsOutcome?.syncActionOutcome !== 'failed'
  const isSyncedVaultsRefreshTurning = isSyncAccountRefreshRunning || syncedVaultsPageStep === 'reading-account' || (isSyncedVaultListShown && accountVaultsOutcome === null)
  // The sign-in the button started counts only while the page still waits on signing in.
  const isSignInStepShown = syncedVaultsPageStep === 'signed-out' || syncedVaultsPageStep === 'device-removed' || syncedVaultsPageStep === 'waiting-for-sign-in'
  const shownSyncedVaultsPageFailureWords = syncedVaultsPageActionWords ?? (isSignInStepShown ? syncedVaultsPageSignInFailureWords : null)
  const chosenAccountVaultName = chosenAccountVault?.syncVaultName ?? 'This vault'

  return (
    <div
      onKeyDown={(keyDownEvent) => {
        if (keyDownEvent.key !== 'Escape' || keyDownEvent.defaultPrevented) return
        keyDownEvent.preventDefault()
        onSyncedVaultsPageClose()
      }}
      className="papeliz-welcome-enter flex min-h-0 flex-1 flex-col"
    >
      <div className="flex items-start justify-between gap-2 px-3 pt-[11px] pb-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 id={syncedVaultsPageHeadingId} className="text-[18px] font-semibold tracking-[-0.01em]">
              Synced Vaults
            </h2>
            {isSyncDownloadOptionsButtonShown && isSyncDownloadCopyOnly && (
              <span className="inline-flex h-5 items-center gap-1 rounded-full bg-papeliz-surface-gray px-2 text-[11px] font-semibold text-papeliz-ink-muted">
                <CloudOff className="size-3" aria-hidden="true" />
                Copy only
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12.5px] text-papeliz-ink-muted">{syncedVaultsPageSubtitle}</p>
        </div>
        <div className="flex flex-none items-center gap-2">
          {isSyncedVaultsRefreshButtonShown && (
            <button
              type="button"
              aria-label="Refresh"
              title="Refresh"
              aria-busy={isSyncedVaultsRefreshTurning || undefined}
              onClick={refreshSyncAccountAndVaults}
              className="grid size-8 flex-none place-items-center rounded-full border border-papeliz-line text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink"
            >
              <RefreshCw className={joinPapelizClassNames('size-4', isSyncedVaultsRefreshTurning && 'animate-spin')} aria-hidden="true" />
            </button>
          )}
          {isSyncDownloadOptionsButtonShown && (
            <PapelizSyncDownloadOptionsButton
              isSyncDownloadCopyOnly={isSyncDownloadCopyOnly}
              onKeepInSyncChoose={() => setSyncDownloadCopyOnly(false)}
              onCopyOnlyChoose={() => {
                if (!isSyncDownloadCopyOnly) setCopyOnlyWarningShown(true)
              }}
            />
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pt-2.5 pb-3">
        {syncedVaultsPageBody}
        {shownSyncedVaultsPageFailureWords !== null && <PapelizSyncFailureLine className="mt-1 px-0.5">{shownSyncedVaultsPageFailureWords}</PapelizSyncFailureLine>}
      </div>

      {/* Close at the left edge in every step, the action at the right, as in New Vault's form. */}
      <div ref={syncedVaultsPageFooterRef} className="flex items-center justify-between gap-2 border-t border-papeliz-line p-3">
        <button type="button" onClick={onSyncedVaultsPageClose} className={joinPapelizClassNames(newVaultFormFooterButtonClassName, newVaultFormFooterCancelButtonColorClassName)}>
          Close
        </button>
        {syncedVaultsPagePrimaryAction !== null && (
          <button
            type="button"
            disabled={syncedVaultsPagePrimaryAction.isPrimaryActionDisabled}
            onClick={syncedVaultsPagePrimaryAction.onPrimaryActionSelect}
            className={joinPapelizClassNames(newVaultFormFooterButtonClassName, newVaultFormFooterActionButtonColorClassName)}
          >
            {isSyncedVaultsPageActionRunning && <LoaderCircle className="size-[15px] flex-none animate-spin" aria-hidden="true" />}
            {syncedVaultsPagePrimaryAction.primaryActionLabel}
          </button>
        )}
      </div>

      {isCopyOnlyWarningShown && (
        <PapelizConfirmDialog
          confirmDialogTitle="Download a Copy Only?"
          confirmDialogBody={
            <>
              <p>“{chosenAccountVaultName}” comes down as a copy that won’t sync.</p>
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-papeliz-warning px-3 py-2.5 text-[13px] leading-[1.45] text-papeliz-warning-ink">
                <TriangleAlert className="mt-0.5 size-[15px] flex-none" aria-hidden="true" />
                <span>Changes you make here stay on this device, and changes from your other devices won’t come here. You can turn Sync on for it later in Settings.</span>
              </p>
            </>
          }
          confirmButtonLabel="Download a Copy"
          onConfirm={() => {
            setSyncDownloadCopyOnly(true)
            setCopyOnlyWarningShown(false)
          }}
          onCancel={() => setCopyOnlyWarningShown(false)}
        />
      )}
    </div>
  )
}
