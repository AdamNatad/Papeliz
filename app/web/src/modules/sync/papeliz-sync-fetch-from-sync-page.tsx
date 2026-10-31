import { AppWindow, Check, Cloud, CloudCheck, CloudDownload, CloudOff, Ellipsis, FolderOpen, KeyRound, LoaderCircle, Lock, RefreshCw, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { PapelizConfirmDialog } from '../ui/papeliz-confirm-dialog'
import { usePapelizFooterEqualButtonWidthRef } from '../ui/papeliz-footer-equal-button-width'
import { PapelizPopoverMenu, type PapelizPopoverMenuPosition } from '../ui/papeliz-popover-menu'
import { PapelizSolidCircleCheckIcon, PapelizSolidCircleXIcon } from '../ui/papeliz-solid-circle-icons'
import { createPapelizBrowserVault, openPapelizBrowserVault, pickFreePapelizBrowserVaultName, type PapelizBrowserVaultRecord } from '../vault/papeliz-browser-vaults'
import type { PapelizOpenVault } from '../vault/papeliz-open-vault'
import { describePapelizVaultError } from '../vault/papeliz-vault-adapter'
import { usePapelizBrowserStorageStore } from '../workspace/papeliz-browser-storage-store'
import { newVaultFormFooterButtonClassName } from '../workspace/papeliz-new-vault-form'
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
import { usePapelizSyncFetchFromSyncPagePreviewStore, type PapelizSyncFetchFromSyncStep } from './papeliz-sync-fetch-from-sync-page-preview-store'
import { PapelizSyncFailureLine, PapelizSyncLoadingLine, PapelizSyncTextButton } from './papeliz-sync-page-parts'
import { PapelizSyncPassphraseField } from './papeliz-sync-passphrase-fields'
import { describePapelizSyncActionFailureNow, describePapelizSyncDay, formatPapelizSyncByteSize } from './papeliz-sync-screen-words'
import { listPapelizSyncVaultIdsCopiedHere } from './papeliz-sync-fetched-copies'
import { requestPapelizSettingsGearSyncPage } from './papeliz-sync-settings-gear-request-store'
import { pickEmptyPapelizVaultFolderForSyncDownload, startPapelizSyncStartScreenDownload } from './papeliz-sync-start-screen-download-store'

// Fetch from Sync, in the start card in place of Recent Vaults (as New Vault's form is). On a device
// not signed in to Sync it opens on a Fetch button and reads nothing before it's pressed; signed in,
// it reads the account's vaults at once. Signed out it waits for the sign-in tab Fetch opened, locked
// it asks for the Sync passphrase, and unlocked it lists the account's vaults to download one into a
// new folder or browser vault. A downloaded vault keeps syncing; the "…" menu at the top right can
// make it a copy that won't sync, after a warning. Refresh beside it reads the account and its vaults
// again. In development builds its previewer can hold any step with a made-up account and vaults.

type PapelizSyncFetchDownloadPlace = 'folder-on-disk' | 'browser-vault-in-opfs'

// The steps before the account is signed in, where Refresh has nothing to read.
const papelizSyncFetchFromSyncStepsBeforeSignIn: ReadonlySet<PapelizSyncFetchFromSyncStep> = new Set([
  'waiting-for-fetch',
  'loading-engine',
  'engine-not-loaded',
  'signed-out',
  'device-removed',
  'waiting-for-sign-in',
])

function readFetchFromSyncStep(
  isSyncedVaultFetchStarted: boolean,
  syncEngineLoadState: PapelizSyncEngineLoadState,
  syncEngineSnapshot: PapelizSyncEngineSnapshot | null,
): PapelizSyncFetchFromSyncStep {
  if (!isSyncedVaultFetchStarted) return 'waiting-for-fetch'
  if (syncEngineLoadState === 'failed-to-load' || syncEngineLoadState === 'not-in-this-build') return 'engine-not-loaded'
  if (syncEngineSnapshot === null) return 'loading-engine'
  const { syncSignIn, syncAccount, syncAccountKeyState } = syncEngineSnapshot
  if (syncSignIn.syncSignInKind === 'device-removed') return 'device-removed'
  if (syncSignIn.syncSignInKind === 'waiting-for-sign-in-page') return 'waiting-for-sign-in'
  if (syncSignIn.syncSignInKind === 'signed-out') return 'signed-out'
  if (syncAccount === null) return 'reading-account'
  const syncSubscriptionState = syncAccount.syncSubscriptionState
  // Read-only after a subscription ended still downloads.
  if (syncSubscriptionState === 'ended-held') return 'subscription-held'
  if (!isPapelizSyncSubscriptionCurrent(syncSubscriptionState) && syncSubscriptionState !== 'ended-read-only') return 'no-subscription'
  if (syncAccountKeyState === 'unknown') return 'cannot-reach-sync'
  if (syncAccountKeyState === 'not-set-up') return 'keys-not-set-up'
  if (syncAccountKeyState === 'locked') return 'locked'
  return 'synced-vault-list'
}

function PapelizSyncFetchCenteredStep({ FetchStepIcon, fetchStepTitle, children }: { FetchStepIcon: LucideIcon; fetchStepTitle: string; children?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-2 pb-3 text-center">
      <span className="grid size-[52px] place-items-center rounded-full bg-papeliz-blue-soft text-papeliz-blue">
        <FetchStepIcon className="size-6" aria-hidden="true" />
      </span>
      <p className="mt-1 text-[15px] font-semibold">{fetchStepTitle}</p>
      {children}
    </div>
  )
}

function PapelizSyncFetchStepText({ children }: { children: ReactNode }) {
  return <p className="max-w-[310px] text-[12.5px] leading-[1.5] text-papeliz-ink-muted">{children}</p>
}

// The "…" button at the top right of the vault list: its tooltip says what it's for, and its menu
// picks whether the vault keeps syncing or comes down as a copy (which asks first).
function PapelizSyncFetchOptionsButton({ isSyncFetchCopyOnly, onKeepInSyncChoose, onCopyOnlyChoose }: { isSyncFetchCopyOnly: boolean; onKeepInSyncChoose: () => void; onCopyOnlyChoose: () => void }) {
  const syncFetchOptionsButtonRef = useRef<HTMLButtonElement>(null)
  const syncFetchOptionsTooltipId = useId()
  const [syncFetchOptionsMenuPosition, setSyncFetchOptionsMenuPosition] = useState<PapelizPopoverMenuPosition | null>(null)
  return (
    <div className="group/fetch-options relative flex-none">
      <button
        ref={syncFetchOptionsButtonRef}
        type="button"
        aria-label="Sync options"
        aria-describedby={syncFetchOptionsTooltipId}
        aria-haspopup="menu"
        aria-expanded={syncFetchOptionsMenuPosition !== null}
        onClick={() => {
          const syncFetchOptionsButtonRect = syncFetchOptionsButtonRef.current?.getBoundingClientRect()
          if (syncFetchOptionsButtonRect === undefined) return
          setSyncFetchOptionsMenuPosition({ menuAnchorLeft: syncFetchOptionsButtonRect.right - 236, menuAnchorTop: syncFetchOptionsButtonRect.bottom + 6 })
        }}
        className="grid size-8 place-items-center rounded-full border border-papeliz-line text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink aria-expanded:border-papeliz-blue-line aria-expanded:bg-papeliz-blue-soft aria-expanded:text-papeliz-blue"
      >
        <Ellipsis className="size-4" aria-hidden="true" />
      </button>
      {syncFetchOptionsMenuPosition === null && (
        <span
          id={syncFetchOptionsTooltipId}
          role="tooltip"
          className="pointer-events-none absolute top-full right-0 z-20 mt-1.5 w-[220px] rounded-lg bg-papeliz-ink px-2.5 py-1.5 text-[11.5px] leading-snug text-papeliz-surface opacity-0 shadow-papeliz-pop transition-opacity duration-150 group-focus-within/fetch-options:opacity-100 group-hover/fetch-options:opacity-100"
        >
          <b className="block font-semibold">Sync options</b>
          It keeps syncing after it downloads. Choose Download a copy only to keep it off Sync.
        </span>
      )}
      {syncFetchOptionsMenuPosition !== null && (
        <PapelizPopoverMenu
          menuLabel="Sync options"
          menuPosition={syncFetchOptionsMenuPosition}
          onMenuClose={() => setSyncFetchOptionsMenuPosition(null)}
          menuItems={[
            { menuItemKey: 'keep-synced-vault-in-sync', menuItemLabel: 'Keep it in sync', MenuItemIcon: CloudCheck, isMenuItemChecked: !isSyncFetchCopyOnly, onMenuItemSelect: onKeepInSyncChoose },
            { menuItemKey: 'download-synced-vault-copy-only', menuItemLabel: 'Download a copy only', MenuItemIcon: CloudOff, isMenuItemChecked: isSyncFetchCopyOnly, onMenuItemSelect: onCopyOnlyChoose },
          ]}
        />
      )}
    </div>
  )
}

interface PapelizSyncFetchFromSyncPageProps {
  fetchFromSyncPageHeadingId: string
  // Where a vault can go in this browser. With both (Chrome and Edge) the page asks; with one it
  // uses that one.
  isFolderStorageOn: boolean
  isBrowserStorageOn: boolean
  existingBrowserVaultRecords: readonly PapelizBrowserVaultRecord[]
  // Every vault on this device, hidden ones too: a synced vault downloaded into one of them as a copy
  // shows as on this device.
  papelizVaultIdsOnThisDevice: ReadonlySet<string>
  onFetchFromSyncPageClose: () => void
  // A download started: back to Recent Vaults, where its row shows how far it is.
  onSyncDownloadStarted: () => void
}

export function PapelizSyncFetchFromSyncPage({
  fetchFromSyncPageHeadingId,
  isFolderStorageOn,
  isBrowserStorageOn,
  existingBrowserVaultRecords,
  papelizVaultIdsOnThisDevice,
  onFetchFromSyncPageClose,
  onSyncDownloadStarted,
}: PapelizSyncFetchFromSyncPageProps) {
  const syncEngineLoadState = usePapelizSyncEngineStore((syncEngineState) => syncEngineState.syncEngineLoadState)
  const loadPapelizSyncEngine = usePapelizSyncEngineStore((syncEngineState) => syncEngineState.loadPapelizSyncEngine)
  const askBrowserToKeepStorage = usePapelizBrowserStorageStore((browserStorageState) => browserStorageState.askBrowserToKeepStorage)
  const syncEngineReading = usePapelizSyncEngineSnapshot()
  const fetchFromSyncFooterRef = usePapelizFooterEqualButtonWidthRef(128)
  const fetchFromSyncIdPrefix = useId()
  // A held preview (development builds only) stands in for the engine: the page shows its step,
  // account and vaults, and its buttons reach no engine.
  const heldFetchFromSyncPagePreview = usePapelizSyncFetchFromSyncPagePreviewStore((fetchFromSyncPagePreviewState) => fetchFromSyncPagePreviewState.heldFetchFromSyncPagePreview)
  // Fetch pressed since the page opened, or not needed: a device signed in to Sync before (or on the
  // dev fake engine) reads its vaults at once. Until then the page reads nothing.
  const [isSyncedVaultFetchStarted, setSyncedVaultFetchStarted] = useState(() => isPapelizSyncUsedOnThisDevice() || readPapelizSyncDevFakeEngineScenarioText() !== null)
  const fetchFromSyncStep =
    heldFetchFromSyncPagePreview?.previewFetchFromSyncStep ?? readFetchFromSyncStep(isSyncedVaultFetchStarted, syncEngineLoadState, syncEngineReading?.syncEngineSnapshot ?? null)

  const syncClockTime = usePapelizSyncClockTime()
  // Why the sign-in Fetch started didn't happen, when it didn't.
  const [fetchFromSyncSignInFailureWords, setFetchFromSyncSignInFailureWords] = useState<string | null>(null)
  const [fetchFromSyncActionWords, setFetchFromSyncActionWords] = useState<string | null>(null)
  const [isFetchFromSyncActionRunning, setFetchFromSyncActionRunning] = useState(false)
  const [isSyncAccountRefreshRunning, setSyncAccountRefreshRunning] = useState(false)
  const [typedSyncPassphrase, setTypedSyncPassphrase] = useState('')
  // The account's vaults, with the read they answer; an earlier read's answer isn't shown.
  const [accountVaultsReading, setAccountVaultsReading] = useState<{
    accountVaultsReadCount: number
    accountVaultsOutcome: PapelizSyncActionOutcome<PapelizSyncAccountVaultReading[]>
  } | null>(null)
  const [accountVaultsReadCount, setAccountVaultsReadCount] = useState(0)
  const [chosenPapelizSyncVaultId, setChosenPapelizSyncVaultId] = useState<string | null>(null)
  const [chosenDownloadPlace, setChosenDownloadPlace] = useState<PapelizSyncFetchDownloadPlace>(isFolderStorageOn ? 'folder-on-disk' : 'browser-vault-in-opfs')
  const [isSyncFetchCopyOnly, setSyncFetchCopyOnly] = useState(false)
  const [isCopyOnlyWarningShown, setCopyOnlyWarningShown] = useState(false)

  // Once fetching, the engine loads; also when the browser blocked Fetch's tab, so the page goes on to
  // Sign in or the vaults.
  useEffect(() => {
    if (isSyncedVaultFetchStarted && heldFetchFromSyncPagePreview === null) void loadPapelizSyncEngine()
  }, [isSyncedVaultFetchStarted, heldFetchFromSyncPagePreview, loadPapelizSyncEngine])

  // The account's vaults, read when the list shows and again on Try again or Refresh.
  const papelizSyncEngine = heldFetchFromSyncPagePreview === null ? (syncEngineReading?.papelizSyncEngine ?? null) : null
  const isSyncedVaultListShown = fetchFromSyncStep === 'synced-vault-list'
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
  const accountVaultsOutcome = heldFetchFromSyncPagePreview === null ? liveAccountVaultsOutcome : heldFetchFromSyncPagePreview.previewAccountVaultsOutcome
  const accountVaults = accountVaultsOutcome?.syncActionOutcome === 'done' ? accountVaultsOutcome.syncActionDoneValue : null
  // A synced vault is never offered again once it's here: syncing, or downloaded as a copy (which
  // isn't linked to Sync, so only this device's own record knows it).
  const syncVaultIdsCopiedHere = useMemo(() => listPapelizSyncVaultIdsCopiedHere(papelizVaultIdsOnThisDevice), [papelizVaultIdsOnThisDevice])
  const isAccountVaultCopiedHere = (accountVault: PapelizSyncAccountVaultReading) =>
    accountVault.papelizVaultIdOnThisDevice === null && syncVaultIdsCopiedHere.has(accountVault.papelizSyncVaultId)
  const accountVaultsToDownload = accountVaults?.filter((accountVault) => accountVault.papelizVaultIdOnThisDevice === null && !isAccountVaultCopiedHere(accountVault)) ?? []
  // The first one to download is picked until another is.
  const chosenAccountVault = accountVaultsToDownload.find((accountVault) => accountVault.papelizSyncVaultId === chosenPapelizSyncVaultId) ?? accountVaultsToDownload[0] ?? null
  const isDownloadPlaceChoiceShown = isFolderStorageOn && isBrowserStorageOn
  const syncAccount = heldFetchFromSyncPagePreview === null ? (syncEngineReading?.syncEngineSnapshot.syncAccount ?? null) : heldFetchFromSyncPagePreview.previewSyncAccount

  const closeFetchFromSyncPage = () => {
    if (fetchFromSyncStep === 'waiting-for-sign-in') cancelPapelizSyncSignIn()
    onFetchFromSyncPageClose()
  }

  const signInFromClick = () => {
    if (papelizSyncEngine === null) return
    setFetchFromSyncActionWords(null)
    void startPapelizSyncSignInFromClick(papelizSyncEngine, null).then((signInFromClickOutcome) =>
      setFetchFromSyncActionWords(describePapelizSyncSignInFromClickFailure(signInFromClickOutcome)),
    )
  }

  // Fetch, on a device not signed in here: the sign-in page opens in a new tab from this click (before
  // the engine has loaded, a blank tab that goes there once it has, and closes if it finds this device
  // signed in after all), then the engine loads and the account's vaults are read once the list shows.
  // Only the click itself may open the tab.
  const fetchSyncedVaultsFromClick = () => {
    if (heldFetchFromSyncPagePreview !== null) return
    setSyncedVaultFetchStarted(true)
    setFetchFromSyncSignInFailureWords(null)
    setFetchFromSyncActionWords(null)
    const followSignInFromClick = (signInFromClick: Promise<PapelizSyncSignInFromClickOutcome>) =>
      void signInFromClick.then((signInFromClickOutcome) => setFetchFromSyncSignInFailureWords(describePapelizSyncSignInFromClickFailure(signInFromClickOutcome)))
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
    setFetchFromSyncActionWords(null)
    setSyncAccountRefreshRunning(true)
    void papelizSyncEngine
      .refreshSyncAccountReading()
      .then((accountRefreshOutcome) => {
        if (accountRefreshOutcome.syncActionOutcome === 'failed') setFetchFromSyncActionWords(describePapelizSyncActionFailureNow(accountRefreshOutcome))
        setAccountVaultsReadCount((readCount) => readCount + 1)
      })
      .finally(() => setSyncAccountRefreshRunning(false))
  }

  const runFetchFromSyncAction = async (fetchFromSyncAction: () => Promise<string | null>) => {
    setFetchFromSyncActionWords(null)
    setFetchFromSyncActionRunning(true)
    try {
      setFetchFromSyncActionWords(await fetchFromSyncAction())
    } finally {
      setFetchFromSyncActionRunning(false)
    }
  }

  const unlockWithPassphrase = () => {
    if (papelizSyncEngine === null || typedSyncPassphrase === '') return
    const syncPassphrase = typedSyncPassphrase
    void runFetchFromSyncAction(async () => {
      const unlockOutcome = await papelizSyncEngine.unlockSyncWithPassphrase(syncPassphrase)
      if (unlockOutcome.syncActionOutcome === 'failed') return describePapelizSyncActionFailureNow(unlockOutcome)
      setTypedSyncPassphrase('')
      return null
    })
  }

  // Makes the new vault, then hands it to the download store. Runs from Pick Folder's or Download's
  // click: the folder window needs it.
  const downloadChosenAccountVault = (chosenSyncEngine: PapelizSyncEngine, accountVaultToDownload: PapelizSyncAccountVaultReading) => {
    const syncVaultName = accountVaultToDownload.syncVaultName ?? 'Synced vault'
    void runFetchFromSyncAction(async () => {
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
          return `Couldn’t make “${syncVaultName}” (${describePapelizVaultError(browserVaultCreateError)})`
        }
      }
      void startPapelizSyncStartScreenDownload({ papelizSyncEngine: chosenSyncEngine, papelizOpenVault, papelizSyncVaultId: accountVaultToDownload.papelizSyncVaultId, isSyncFetchCopyOnly })
      onSyncDownloadStarted()
      return null
    })
  }

  // The page's heading line, body and footer action, for the step it's on.
  let fetchFromSyncSubtitle = 'Download a vault from your Papeliz Sync account.'
  let fetchFromSyncBody: ReactNode = null
  let fetchFromSyncPrimaryAction: { primaryActionLabel: string; isPrimaryActionDisabled?: boolean; onPrimaryActionSelect: () => void } | null = null
  let fetchFromSyncCancelLabel = 'Cancel'

  switch (fetchFromSyncStep) {
    case 'waiting-for-fetch':
      fetchFromSyncBody = (
        <PapelizSyncFetchCenteredStep FetchStepIcon={CloudDownload} fetchStepTitle="Fetch your synced vaults">
          <PapelizSyncFetchStepText>Fetch opens the Sync sign-in page in a new tab, then reads your vaults.</PapelizSyncFetchStepText>
          <button
            type="button"
            onClick={fetchSyncedVaultsFromClick}
            className={joinPapelizClassNames(newVaultFormFooterButtonClassName, 'mt-2.5 min-w-[128px] bg-papeliz-chosen-tab-ground')}
          >
            <CloudDownload className="size-[15px] flex-none" aria-hidden="true" />
            Fetch
          </button>
        </PapelizSyncFetchCenteredStep>
      )
      break
    case 'loading-engine':
      fetchFromSyncBody = <PapelizSyncLoadingLine>Loading Sync…</PapelizSyncLoadingLine>
      break
    case 'engine-not-loaded':
      fetchFromSyncBody = (
        <PapelizSyncFetchCenteredStep FetchStepIcon={CloudOff} fetchStepTitle="Papeliz Sync didn’t load">
          <PapelizSyncFetchStepText>Check your connection, then try again.</PapelizSyncFetchStepText>
        </PapelizSyncFetchCenteredStep>
      )
      fetchFromSyncPrimaryAction = {
        primaryActionLabel: 'Try again',
        onPrimaryActionSelect: () => {
          if (heldFetchFromSyncPagePreview === null) void loadPapelizSyncEngine()
        },
      }
      break
    case 'signed-out':
    case 'device-removed':
      fetchFromSyncBody = (
        <PapelizSyncFetchCenteredStep FetchStepIcon={Cloud} fetchStepTitle="Sign in to see your synced vaults">
          <PapelizSyncFetchStepText>
            {fetchFromSyncStep === 'device-removed' ? 'This device was signed out of Sync. ' : ''}The sign-in page opens in a new tab.
          </PapelizSyncFetchStepText>
          <p className="mt-1 text-[12px] text-papeliz-ink-subtle">
            No subscription? Sync is a paid add-on. <PapelizSyncTextButton onClick={requestPapelizSettingsGearSyncPage}>See plans</PapelizSyncTextButton>
          </p>
        </PapelizSyncFetchCenteredStep>
      )
      fetchFromSyncPrimaryAction = { primaryActionLabel: 'Sign in', onPrimaryActionSelect: signInFromClick }
      break
    case 'waiting-for-sign-in':
      fetchFromSyncBody = (
        <PapelizSyncFetchCenteredStep FetchStepIcon={Cloud} fetchStepTitle="Finish signing in in the new tab">
          <PapelizSyncFetchStepText>Papeliz carries on here once you’re signed in.</PapelizSyncFetchStepText>
          <p className="mt-1 text-[12px] text-papeliz-ink-subtle">
            Tab didn’t open? <PapelizSyncTextButton onClick={signInFromClick}>Open the sign-in page</PapelizSyncTextButton>
          </p>
        </PapelizSyncFetchCenteredStep>
      )
      break
    case 'reading-account':
      fetchFromSyncBody = <PapelizSyncLoadingLine>Reading your account…</PapelizSyncLoadingLine>
      break
    case 'no-subscription':
      fetchFromSyncBody = (
        <PapelizSyncFetchCenteredStep FetchStepIcon={Cloud} fetchStepTitle="No Sync subscription on this account">
          <PapelizSyncFetchStepText>Papeliz Sync is a paid add-on. Choose a plan, then turn Sync on for a vault on another device to fetch it here.</PapelizSyncFetchStepText>
        </PapelizSyncFetchCenteredStep>
      )
      fetchFromSyncPrimaryAction = { primaryActionLabel: 'See plans', onPrimaryActionSelect: requestPapelizSettingsGearSyncPage }
      break
    case 'subscription-held':
      fetchFromSyncBody = (
        <PapelizSyncFetchCenteredStep FetchStepIcon={CloudOff} fetchStepTitle="Your subscription ended">
          <PapelizSyncFetchStepText>
            {syncAccount?.syncSyncedCopyDeletedAt == null
              ? 'The synced copy is kept for a while, then deleted.'
              : `The synced copy is kept until ${describePapelizSyncDay(syncAccount.syncSyncedCopyDeletedAt, syncClockTime)}, then deleted.`}{' '}
            Subscribe again to download it.
          </PapelizSyncFetchStepText>
        </PapelizSyncFetchCenteredStep>
      )
      fetchFromSyncPrimaryAction = { primaryActionLabel: 'See plans', onPrimaryActionSelect: requestPapelizSettingsGearSyncPage }
      break
    case 'cannot-reach-sync':
      fetchFromSyncBody = (
        <PapelizSyncFetchCenteredStep FetchStepIcon={CloudOff} fetchStepTitle="Can’t reach Sync right now">
          <PapelizSyncFetchStepText>Papeliz couldn’t read your account yet. Check your connection, then try again.</PapelizSyncFetchStepText>
        </PapelizSyncFetchCenteredStep>
      )
      fetchFromSyncPrimaryAction = { primaryActionLabel: 'Try again', onPrimaryActionSelect: () => void papelizSyncEngine?.refreshSyncAccountReading() }
      break
    case 'keys-not-set-up':
      fetchFromSyncBody = (
        <PapelizSyncFetchCenteredStep FetchStepIcon={KeyRound} fetchStepTitle="No synced vaults yet">
          <PapelizSyncFetchStepText>Finish setting up Sync, then turn it on for a vault in Settings.</PapelizSyncFetchStepText>
        </PapelizSyncFetchCenteredStep>
      )
      fetchFromSyncPrimaryAction = { primaryActionLabel: 'Set up Sync', onPrimaryActionSelect: requestPapelizSettingsGearSyncPage }
      break
    case 'locked':
      fetchFromSyncBody = (
        <PapelizSyncFetchCenteredStep FetchStepIcon={Lock} fetchStepTitle="Unlock Sync on this device">
          <PapelizSyncFetchStepText>Your vault names are encrypted. Enter your Sync passphrase once on this device.</PapelizSyncFetchStepText>
          <form
            className="mt-2 w-full max-w-[300px] text-left"
            onSubmit={(submitEvent) => {
              submitEvent.preventDefault()
              if (!isFetchFromSyncActionRunning) unlockWithPassphrase()
            }}
          >
            <PapelizSyncPassphraseField
              syncPassphraseFieldLabel="Sync passphrase"
              syncPassphrase={typedSyncPassphrase}
              onSyncPassphraseChange={setTypedSyncPassphrase}
              isSyncPassphraseShown={false}
              syncPassphraseAutoComplete="current-password"
              isSyncPassphraseFieldFocusedFirst
            />
            <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
          </form>
          <p className="mt-1 text-[12px] text-papeliz-ink-subtle">
            Forgot it? <PapelizSyncTextButton onClick={requestPapelizSettingsGearSyncPage}>Use your Recovery Key in Settings</PapelizSyncTextButton>
          </p>
        </PapelizSyncFetchCenteredStep>
      )
      fetchFromSyncPrimaryAction = { primaryActionLabel: 'Unlock', isPrimaryActionDisabled: typedSyncPassphrase === '' || isFetchFromSyncActionRunning, onPrimaryActionSelect: unlockWithPassphrase }
      break
    case 'synced-vault-list': {
      if (accountVaultsOutcome === null) {
        fetchFromSyncBody = <PapelizSyncLoadingLine>Reading your synced vaults…</PapelizSyncLoadingLine>
        break
      }
      if (accountVaultsOutcome.syncActionOutcome === 'failed') {
        fetchFromSyncBody = <PapelizSyncFailureLine>{describePapelizSyncActionFailureNow(accountVaultsOutcome)}</PapelizSyncFailureLine>
        fetchFromSyncPrimaryAction = { primaryActionLabel: 'Try again', onPrimaryActionSelect: () => setAccountVaultsReadCount((readCount) => readCount + 1) }
        break
      }
      const accountVaultCount = accountVaultsOutcome.syncActionDoneValue.length
      if (accountVaultCount === 0) {
        fetchFromSyncSubtitle = 'No synced vaults on your account yet.'
        fetchFromSyncBody = (
          <PapelizSyncFetchCenteredStep FetchStepIcon={Cloud} fetchStepTitle="No synced vaults yet">
            <PapelizSyncFetchStepText>Turn Sync on for a vault in Settings, on this device or another one.</PapelizSyncFetchStepText>
          </PapelizSyncFetchCenteredStep>
        )
        fetchFromSyncCancelLabel = 'Close'
        break
      }
      const isEveryAccountVaultHere = accountVaultsToDownload.length === 0
      fetchFromSyncSubtitle = isEveryAccountVaultHere
        ? 'Every vault on your account is on this device.'
        : `${accountVaultCount} ${accountVaultCount === 1 ? 'vault' : 'vaults'} on your account. ${isSyncFetchCopyOnly ? 'Pick one to download as a copy that won’t sync.' : 'Pick one to download; it stays in sync.'}`
      if (isEveryAccountVaultHere) fetchFromSyncCancelLabel = 'Close'
      fetchFromSyncBody = (
        <>
          {syncAccount?.syncSubscriptionState === 'ended-read-only' && (
            <p className="rounded-xl bg-papeliz-warning px-3 py-2 text-[12.5px] leading-[1.45] text-papeliz-warning-ink">
              Your subscription ended, so the synced copy is read-only
              {syncAccount.syncReadOnlyUntil === null ? '' : ` until ${describePapelizSyncDay(syncAccount.syncReadOnlyUntil, syncClockTime)}`}. You can still download it.
            </p>
          )}
          <p id={`${fetchFromSyncIdPrefix}-vault-label`} className="px-0.5 text-[12px] font-semibold text-papeliz-ink-muted">
            Vault
          </p>
          <div role="radiogroup" aria-labelledby={`${fetchFromSyncIdPrefix}-vault-label`} className="flex flex-col gap-1.5">
            {accountVaultsOutcome.syncActionDoneValue.map((accountVault) => {
              const isAccountVaultCopy = isAccountVaultCopiedHere(accountVault)
              const isAccountVaultHere = accountVault.papelizVaultIdOnThisDevice !== null || isAccountVaultCopy
              const isAccountVaultChosen = !isAccountVaultHere && accountVault.papelizSyncVaultId === chosenAccountVault?.papelizSyncVaultId
              const accountVaultName = accountVault.syncVaultName ?? 'Synced vault'
              return (
                <label
                  key={accountVault.papelizSyncVaultId}
                  className={joinPapelizClassNames(
                    'flex items-center gap-2.5 rounded-xl border px-2.5 py-[7px] transition-colors',
                    isAccountVaultChosen ? 'border-papeliz-blue-line bg-papeliz-blue-soft' : 'border-papeliz-line bg-papeliz-surface',
                    isAccountVaultHere ? 'cursor-default' : 'cursor-pointer hover:bg-papeliz-hover',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={joinPapelizClassNames(
                      'grid size-8 flex-none place-items-center rounded-lg text-[14px] font-semibold text-papeliz-blue',
                      isAccountVaultHere ? 'bg-papeliz-blue-soft' : 'border-[1.5px] border-dashed border-papeliz-blue-line',
                    )}
                  >
                    {accountVaultName.trim().charAt(0).toUpperCase() || '·'}
                  </span>
                  <span className={joinPapelizClassNames('flex min-w-0 flex-1 flex-col gap-0.5', isAccountVaultHere && 'opacity-60')}>
                    <span className="truncate text-[13.5px] font-semibold">{accountVaultName}</span>
                    <span className="text-[11.5px] text-papeliz-ink-subtle tabular-nums">
                      {accountVault.syncVaultFileCount.toLocaleString('en-US')} files · {formatPapelizSyncByteSize(accountVault.syncVaultStoredByteLength)}
                    </span>
                  </span>
                  {isAccountVaultHere ? (
                    <span className="inline-flex h-5 flex-none items-center gap-1 rounded-full bg-papeliz-surface-gray px-2 text-[11px] font-semibold text-papeliz-ink-muted">
                      {isAccountVaultCopy ? <CloudOff className="size-3" aria-hidden="true" /> : <Check className="size-3" aria-hidden="true" />}
                      {isAccountVaultCopy ? 'Copy on this device' : 'On this device'}
                    </span>
                  ) : (
                    <input
                      type="radio"
                      name={`${fetchFromSyncIdPrefix}-synced-vault`}
                      checked={isAccountVaultChosen}
                      onChange={() => setChosenPapelizSyncVaultId(accountVault.papelizSyncVaultId)}
                      className="size-4 flex-none cursor-pointer accent-papeliz-blue"
                    />
                  )}
                </label>
              )
            })}
          </div>
          {!isEveryAccountVaultHere && isDownloadPlaceChoiceShown && (
            <>
              <p id={`${fetchFromSyncIdPrefix}-place-label`} className="mt-1 px-0.5 text-[12px] font-semibold text-papeliz-ink-muted">
                Keep it in
              </p>
              <div role="radiogroup" aria-labelledby={`${fetchFromSyncIdPrefix}-place-label`} className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                {(
                  [
                    { downloadPlace: 'folder-on-disk', DownloadPlaceIcon: FolderOpen, downloadPlaceTitle: 'Folder Storage', downloadPlaceLine: 'An empty folder on your machine', isDownloadPlaceRecommended: true },
                    { downloadPlace: 'browser-vault-in-opfs', DownloadPlaceIcon: AppWindow, downloadPlaceTitle: 'Browser Storage', downloadPlaceLine: 'Inside this browser', isDownloadPlaceRecommended: false },
                  ] as const
                ).map(({ downloadPlace, DownloadPlaceIcon, downloadPlaceTitle, downloadPlaceLine, isDownloadPlaceRecommended }) => {
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
                        name={`${fetchFromSyncIdPrefix}-download-place`}
                        checked={isDownloadPlaceChosen}
                        onChange={() => setChosenDownloadPlace(downloadPlace)}
                        className="sr-only"
                      />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 text-[13px] leading-tight font-semibold whitespace-nowrap">
                          {downloadPlaceTitle}
                          {isDownloadPlaceRecommended && (
                            <span className="rounded-full border border-papeliz-diff-added-ink/30 bg-papeliz-diff-added px-1.5 py-px text-[10px] leading-snug font-semibold text-papeliz-diff-added-ink">
                              Recommended
                            </span>
                          )}
                        </span>
                        <span className="truncate text-[11.5px] text-papeliz-ink-subtle">{downloadPlaceLine}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </>
          )}
          {!isEveryAccountVaultHere && !isFolderStorageOn && (
            <p className="mt-1 flex items-center gap-1.5 px-0.5 text-[12px] text-papeliz-ink-muted">
              <AppWindow className="size-3.5 flex-none" aria-hidden="true" />
              It’s kept in this browser, and Sync is its backup.
            </p>
          )}
        </>
      )
      const isFolderPickedNext = chosenDownloadPlace === 'folder-on-disk' && isFolderStorageOn
      fetchFromSyncPrimaryAction = {
        primaryActionLabel: isFolderPickedNext ? 'Pick Folder' : 'Download',
        isPrimaryActionDisabled: chosenAccountVault === null || isFetchFromSyncActionRunning,
        onPrimaryActionSelect: () => {
          if (chosenAccountVault !== null && papelizSyncEngine !== null) downloadChosenAccountVault(papelizSyncEngine, chosenAccountVault)
        },
      }
      break
    }
  }

  const isSyncFetchOptionsButtonShown = isSyncedVaultListShown && accountVaultsToDownload.length > 0
  // Refresh shows once signed in; its icon turns while the account or its vaults are read.
  const isSyncFetchRefreshButtonShown = !papelizSyncFetchFromSyncStepsBeforeSignIn.has(fetchFromSyncStep)
  const isSyncFetchRefreshTurning = isSyncAccountRefreshRunning || fetchFromSyncStep === 'reading-account' || (isSyncedVaultListShown && accountVaultsOutcome === null)
  // The sign-in the button started counts only while the page still waits on signing in.
  const isSignInStepShown = fetchFromSyncStep === 'signed-out' || fetchFromSyncStep === 'device-removed' || fetchFromSyncStep === 'waiting-for-sign-in'
  const shownFetchFromSyncFailureWords = fetchFromSyncActionWords ?? (isSignInStepShown ? fetchFromSyncSignInFailureWords : null)
  const chosenAccountVaultName = chosenAccountVault?.syncVaultName ?? 'This vault'

  return (
    <div
      onKeyDown={(keyDownEvent) => {
        if (keyDownEvent.key !== 'Escape' || keyDownEvent.defaultPrevented) return
        keyDownEvent.preventDefault()
        closeFetchFromSyncPage()
      }}
      className="papeliz-welcome-enter flex min-h-0 flex-1 flex-col"
    >
      <div className="flex items-start justify-between gap-2 px-3 pt-[11px] pb-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 id={fetchFromSyncPageHeadingId} className="text-[18px] font-semibold tracking-[-0.01em]">
              Synced Vaults
            </h2>
            {isSyncFetchOptionsButtonShown && isSyncFetchCopyOnly && (
              <span className="inline-flex h-5 items-center gap-1 rounded-full bg-papeliz-surface-gray px-2 text-[11px] font-semibold text-papeliz-ink-muted">
                <CloudOff className="size-3" aria-hidden="true" />
                Copy only
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12.5px] text-papeliz-ink-muted">{fetchFromSyncSubtitle}</p>
        </div>
        <div className="flex flex-none items-center gap-2">
          {isSyncFetchRefreshButtonShown && (
            <button
              type="button"
              aria-label="Refresh"
              title="Refresh"
              aria-busy={isSyncFetchRefreshTurning || undefined}
              onClick={refreshSyncAccountAndVaults}
              className="grid size-8 flex-none place-items-center rounded-full border border-papeliz-line text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink"
            >
              <RefreshCw className={joinPapelizClassNames('size-4', isSyncFetchRefreshTurning && 'animate-spin')} aria-hidden="true" />
            </button>
          )}
          {isSyncFetchOptionsButtonShown && (
            <PapelizSyncFetchOptionsButton
              isSyncFetchCopyOnly={isSyncFetchCopyOnly}
              onKeepInSyncChoose={() => setSyncFetchCopyOnly(false)}
              onCopyOnlyChoose={() => {
                if (!isSyncFetchCopyOnly) setCopyOnlyWarningShown(true)
              }}
            />
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pt-2.5 pb-3">
        {fetchFromSyncBody}
        {shownFetchFromSyncFailureWords !== null && <PapelizSyncFailureLine className="mt-1 px-0.5">{shownFetchFromSyncFailureWords}</PapelizSyncFailureLine>}
      </div>

      {/* Cancel at the left edge, the action at the right, as in New Vault's form. */}
      <div ref={fetchFromSyncFooterRef} className="flex items-center justify-between gap-2 border-t border-papeliz-line p-3">
        <button type="button" onClick={closeFetchFromSyncPage} className={joinPapelizClassNames(newVaultFormFooterButtonClassName, 'bg-papeliz-red-gradient-start')}>
          <PapelizSolidCircleXIcon className="size-[15px] flex-none" />
          {fetchFromSyncCancelLabel}
        </button>
        {fetchFromSyncPrimaryAction !== null && (
          <button
            type="button"
            disabled={fetchFromSyncPrimaryAction.isPrimaryActionDisabled}
            onClick={fetchFromSyncPrimaryAction.onPrimaryActionSelect}
            className={joinPapelizClassNames(newVaultFormFooterButtonClassName, 'bg-papeliz-chosen-tab-ground')}
          >
            {isFetchFromSyncActionRunning ? <LoaderCircle className="size-[15px] flex-none animate-spin" aria-hidden="true" /> : <PapelizSolidCircleCheckIcon className="size-[15px] flex-none" />}
            {fetchFromSyncPrimaryAction.primaryActionLabel}
          </button>
        )}
      </div>

      {isCopyOnlyWarningShown && (
        <PapelizConfirmDialog
          confirmDialogTitle="Download a copy only?"
          confirmDialogBody={
            <>
              <p>“{chosenAccountVaultName}” comes down as a copy that won’t sync.</p>
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-papeliz-warning px-3 py-2.5 text-[13px] leading-[1.45] text-papeliz-warning-ink">
                <TriangleAlert className="mt-0.5 size-[15px] flex-none" aria-hidden="true" />
                <span>Changes you make here stay on this device, and changes from your other devices won’t come here. You can turn Sync on for it later in Settings.</span>
              </p>
            </>
          }
          confirmButtonLabel="Download a copy"
          onConfirm={() => {
            setSyncFetchCopyOnly(true)
            setCopyOnlyWarningShown(false)
          }}
          onCancel={() => setCopyOnlyWarningShown(false)}
        />
      )}
    </div>
  )
}
