import { Check, CirclePause, CloudOff, FolderOpen, History, Lock, Play, ShieldCheck, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { PapelizSlidingChoiceGroup } from '../ui/papeliz-sliding-choice-group'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import type {
  PapelizSyncAccountReading,
  PapelizSyncAccountVaultReading,
  PapelizSyncActionOutcome,
  PapelizSyncEngine,
  PapelizSyncEngineSnapshot,
  PapelizSyncOldVersionDeletionReading,
  PapelizSyncWhatSyncsChoices,
} from './papeliz-sync-engine-contract'
import { PapelizSyncEngineGate } from './papeliz-sync-engine-gate'
import { PapelizSyncFreeUpSpaceDialog } from './papeliz-sync-free-up-space-dialog'
import {
  cancelPapelizSyncSignIn,
  canPapelizSyncAccountSync,
  describePapelizSyncSignInFromClickFailure,
  openPapelizSyncSetUpDialog,
  setPapelizSyncOldVersionsDialogShown,
  showPapelizSyncMissingFiles,
  showPapelizSyncNoteClash,
  startPapelizSyncSignInFromClick,
  usePapelizSyncFlowStore,
} from './papeliz-sync-flow-store'
import { PapelizSyncBlockedSignInLinks } from './papeliz-sync-blocked-sign-in-links'
import { openPapelizSyncNewTabWhenAddressIsReady, papelizSyncBlockedNewTabWords } from './papeliz-sync-new-tab'
import {
  PapelizSyncFailureLine,
  PapelizSyncLoadingLine,
  PapelizSyncPageBox,
  PapelizSyncPageLabel,
  PapelizSyncPageNotice,
  PapelizSyncPageRow,
  PapelizSyncPageSmallText,
  PapelizSyncPageText,
  PapelizSyncProgressBar,
  PapelizSyncSwitch,
  PapelizSyncTextButton,
} from './papeliz-sync-page-parts'
import { PapelizSyncPlanOffersSection } from './papeliz-sync-plan-offers'
import {
  describePapelizSyncActionFailureNow,
  describePapelizSyncDay,
  describePapelizSyncFileCount,
  describePapelizSyncMissingFilesNotice,
  describePapelizSyncOldVersionDeletion,
  describePapelizSyncStatusForStatusBar,
  describePapelizSyncStoragePlaceLine,
  describePapelizSyncTimeAgo,
  formatPapelizSyncByteSize,
  papelizSyncMissingFilesDialogWords,
  papelizSyncVaultEncryptionKindDisplayNames,
  papelizSyncVaultEncryptionKindReaderLines,
} from './papeliz-sync-screen-words'
import { papelizSyncStatusIcons } from './papeliz-sync-status-icons'
import { PapelizSyncSyncedVaultsSection, type PapelizSyncAccountVaultDialogRequest } from './papeliz-sync-synced-vaults-section'
import { usePapelizSyncClockTime } from './papeliz-sync-clock'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'
import { usePapelizSyncSettingsGearRequestStore } from './papeliz-sync-settings-gear-request-store'
import { readPapelizSyncVaultOtherEncryptionKind } from './papeliz-sync-vault-encryption-change'

// The gear's Sync page, in two tabs. Plans: Free and the paid plans, with Sign In, Choose or Current
// Plan. Settings: signed out, Sign In; signed in on Free or a plan, this vault's switch (turning it on
// opens Turn on Sync, which asks Standard or End-to-end), the synced vaults with their kinds, what
// syncs, storage with Free Up Space, Old versions and Pause on this device, with what to do when storage is
// full (Free Up Space, and Change Plan or See Plans), a payment failed, the subscription ended or an
// End-to-end vault is locked here. It opens on Settings once signed in, on Plans otherwise, or when a plan
// in the address asks.

function PapelizSyncManageSubscriptionButton({ papelizSyncEngine, manageButtonLabel = 'Manage Subscription' }: { papelizSyncEngine: PapelizSyncEngine; manageButtonLabel?: string }) {
  const [manageFailureWords, setManageFailureWords] = useState<string | null>(null)
  return (
    <>
      <PapelizPillButton
        pillButtonVariant="line"
        pillButtonSize="small"
        onClick={() => {
          setManageFailureWords(null)
          void openPapelizSyncNewTabWhenAddressIsReady(() => papelizSyncEngine.createSyncBillingPortalUrl()).then((billingTabOutcome) => {
            if (billingTabOutcome.syncNewTabOutcome === 'blocked') setManageFailureWords(papelizSyncBlockedNewTabWords)
            if (billingTabOutcome.syncNewTabOutcome === 'failed') setManageFailureWords(describePapelizSyncActionFailureNow(billingTabOutcome.syncNewTabFailedOutcome))
          })
        }}
      >
        {manageButtonLabel}
      </PapelizPillButton>
      {manageFailureWords !== null && <PapelizSyncFailureLine className="w-full">{manageFailureWords}</PapelizSyncFailureLine>}
    </>
  )
}

// While a sign-in waits: on the tab that opened, or, when the browser blocked it, on its Sign In link and
// Copy Sign-In URL to Clipboard. Cancel lets it go either way.
function PapelizSyncSignInWaitingLine({ className }: { className?: string }) {
  const isSyncSignInTabBlocked = usePapelizSyncFlowStore((syncFlowState) => syncFlowState.blockedSyncSignInPageUrl !== null)
  if (!isSyncSignInTabBlocked) {
    return (
      <PapelizSyncPageSmallText className={className}>
        Finish signing in in the new tab. <PapelizSyncTextButton onClick={cancelPapelizSyncSignIn}>Cancel</PapelizSyncTextButton>
      </PapelizSyncPageSmallText>
    )
  }
  return (
    <div className={className}>
      <PapelizSyncBlockedSignInLinks signInLinksAlignment="from-left-edge" />
      <PapelizSyncPageSmallText className="mt-1.5">
        <PapelizSyncTextButton onClick={cancelPapelizSyncSignIn}>Cancel</PapelizSyncTextButton>
      </PapelizSyncPageSmallText>
    </div>
  )
}

// The Plans tab: the plan cards, and, while a sign-in started from Free's card waits, how to cancel it.
// A paid plan being paid for changes through the billing page.
function PapelizSyncPlansTab({ papelizSyncEngine, syncEngineSnapshot }: { papelizSyncEngine: PapelizSyncEngine; syncEngineSnapshot: PapelizSyncEngineSnapshot }) {
  return (
    <div>
      <PapelizSyncPlanOffersSection
        papelizSyncEngine={papelizSyncEngine}
        syncEngineSnapshot={syncEngineSnapshot}
        planOffersFooter={
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <PapelizSyncManageSubscriptionButton papelizSyncEngine={papelizSyncEngine} manageButtonLabel="Change Plan" />
          </div>
        }
      />
      {syncEngineSnapshot.syncSignIn.syncSignInKind === 'waiting-for-sign-in-page' && <PapelizSyncSignInWaitingLine className="mt-1.5" />}
    </div>
  )
}

function PapelizSyncCenteredStep({ SyncStepIcon, syncStepTitle, children }: { SyncStepIcon: LucideIcon; syncStepTitle: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-5 text-center">
      <span className="grid size-[52px] place-items-center rounded-full bg-papeliz-blue-soft text-papeliz-blue">
        <SyncStepIcon className="size-6" aria-hidden="true" />
      </span>
      <p className="text-[15px] font-semibold">{syncStepTitle}</p>
      {children}
    </div>
  )
}

function readSyncEndedNotice(syncAccount: PapelizSyncAccountReading, currentTime: number): ReactNode {
  if (syncAccount.syncSubscriptionState === 'ended-read-only') {
    return (
      <PapelizSyncPageNotice>
        Your subscription ended, so uploads have stopped.{' '}
        {syncAccount.syncReadOnlyUntil === null
          ? 'The synced copy can still be read and downloaded for a while.'
          : `The synced copy can still be read and downloaded until ${describePapelizSyncDay(syncAccount.syncReadOnlyUntil, currentTime)}.`}{' '}
        The notes on your devices are untouched. Subscribe again to keep syncing.
      </PapelizSyncPageNotice>
    )
  }
  if (syncAccount.syncSubscriptionState === 'ended-held') {
    return (
      <PapelizSyncPageNotice>
        Your subscription ended.{' '}
        {syncAccount.syncSyncedCopyDeletedAt === null
          ? 'The synced copy is kept for a while, then deleted.'
          : `The synced copy is kept until ${describePapelizSyncDay(syncAccount.syncSyncedCopyDeletedAt, currentTime)}, then deleted.`}{' '}
        Subscribe again to bring it back. The notes on your devices are untouched.
      </PapelizSyncPageNotice>
    )
  }
  return undefined
}

// Each follows its vault's kind. AI provider keys never sync; they're pasted on each device.
const papelizSyncWhatSyncsSwitchRows: ReadonlyArray<{ whatSyncsChoiceName: keyof PapelizSyncWhatSyncsChoices; whatSyncsTitle: string; whatSyncsDetail?: string }> = [
  { whatSyncsChoiceName: 'isAppSettingSyncOn', whatSyncsTitle: 'Settings', whatSyncsDetail: 'Theme, text, key bindings' },
  { whatSyncsChoiceName: 'isAssistantChatSyncOn', whatSyncsTitle: 'Assistant Chats' },
]

// Sync on: this account is subscribed (or its subscription ended with vaults syncing here).
function PapelizSyncOnState({
  papelizSyncEngine,
  syncEngineSnapshot,
  syncAccount,
  onSyncPlansTabShow,
}: {
  papelizSyncEngine: PapelizSyncEngine
  syncEngineSnapshot: PapelizSyncEngineSnapshot
  syncAccount: PapelizSyncAccountReading
  onSyncPlansTabShow: () => void
}) {
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)
  const activeVaultNoteRelativePath = usePapelizWorkspaceStore((workspaceState) => workspaceState.activeVaultNoteRelativePath)
  const [syncPageActionFailureWords, setSyncPageActionFailureWords] = useState<string | null>(null)
  const [isVaultSwitchBusy, setIsVaultSwitchBusy] = useState(false)
  const [accountVaultsOutcome, setAccountVaultsOutcome] = useState<PapelizSyncActionOutcome<PapelizSyncAccountVaultReading[]> | null>(null)
  const [accountVaultDialogRequest, setAccountVaultDialogRequest] = useState<PapelizSyncAccountVaultDialogRequest | null>(null)
  const [isFreeUpSpaceDialogShown, setIsFreeUpSpaceDialogShown] = useState(false)
  const [freeUpSpaceOutcome, setFreeUpSpaceOutcome] = useState<PapelizSyncActionOutcome<PapelizSyncOldVersionDeletionReading> | null>(null)
  const currentTime = usePapelizSyncClockTime()
  const isOpenVaultSyncable = openVault !== null && openVault.papelizVaultAdapter.papelizVaultKind !== 'sample-vault-in-memory'
  const openVaultSyncReading = openVault === null ? undefined : syncEngineSnapshot.syncLocalVaults.find((syncLocalVault) => syncLocalVault.papelizVaultId === openVault.papelizVaultId)
  const openVaultSyncedVaultId = openVaultSyncReading?.papelizSyncVaultId ?? null
  const isReadOnly = syncAccount.syncSubscriptionState === 'ended-read-only' || syncAccount.syncSubscriptionState === 'ended-held'

  // The account's vaults: the open vault's size for its row, and the Synced vaults list. Read when the
  // page opens, again when this device's synced vaults change, when the open vault's first upload or
  // download ends, and after a delete. The account is read again with them, so Storage used counts what
  // was uploaded since it was last read (at sign-in, say, before the first upload).
  const [accountVaultsReadCount, setAccountVaultsReadCount] = useState(0)
  const linkedSyncVaultIdsText = syncEngineSnapshot.syncLinkedLocalVaults.map((syncLinkedLocalVault) => syncLinkedLocalVault.papelizSyncVaultId).join('\n')
  const isOpenVaultTransferUnderway = openVaultSyncReading?.syncVaultTransferProgress != null
  useEffect(() => {
    let isSyncPageLeft = false
    void papelizSyncEngine.listSyncedVaultsOnAccount().then((listedAccountVaultsOutcome) => {
      if (!isSyncPageLeft) setAccountVaultsOutcome(listedAccountVaultsOutcome)
    })
    void papelizSyncEngine.refreshSyncAccountReading()
    return () => {
      isSyncPageLeft = true
    }
  }, [papelizSyncEngine, openVaultSyncedVaultId, linkedSyncVaultIdsText, isOpenVaultTransferUnderway, accountVaultsReadCount])

  const openAccountVault =
    accountVaultsOutcome?.syncActionOutcome === 'done' && openVaultSyncedVaultId !== null
      ? accountVaultsOutcome.syncActionDoneValue.find((accountVault) => accountVault.papelizSyncVaultId === openVaultSyncedVaultId)
      : undefined
  const syncVisiblePlanLimits = syncAccount.syncVisiblePlanLimits
  const isOverStorage =
    (syncVisiblePlanLimits !== null && syncAccount.syncStorageUsedByteLength >= syncVisiblePlanLimits.syncStorageByteLimit) ||
    syncEngineSnapshot.syncLocalVaults.some(
      (syncLocalVault) => syncLocalVault.syncVaultStatus.syncStatusKind === 'waiting' && syncLocalVault.syncVaultStatus.syncWaitingReason === 'over-storage',
    )
  const openVaultStatusDescription =
    openVaultSyncReading === undefined
      ? null
      : describePapelizSyncStatusForStatusBar(
          openVaultSyncReading.syncVaultStatus,
          openVaultSyncReading.syncVaultTransferProgress?.syncTransferredFileCount ?? null,
          openVaultSyncReading.syncVaultTransferProgress?.syncTransferFileCount ?? null,
          currentTime,
        )
  const OpenVaultStatusIcon = openVaultStatusDescription === null ? null : papelizSyncStatusIcons[openVaultStatusDescription.syncStatusIconKind]
  const openVaultClashes = openVault === null ? [] : syncEngineSnapshot.syncNoteClashesToSettle.filter((syncNoteClash) => syncNoteClash.papelizVaultId === openVault.papelizVaultId)

  const reportSyncPageActionOutcome = (syncPageActionOutcome: PapelizSyncActionOutcome<unknown>) =>
    setSyncPageActionFailureWords(syncPageActionOutcome.syncActionOutcome === 'failed' ? describePapelizSyncActionFailureNow(syncPageActionOutcome) : null)

  // On opens Turn on Sync, which asks Standard or End-to-end; off stops syncing it on this device.
  const toggleOpenVaultSync = async () => {
    if (openVault === null) return
    setSyncPageActionFailureWords(null)
    if (openVaultSyncReading === undefined) {
      openPapelizSyncSetUpDialog({ syncSetUpDialogKind: 'turn-on-vault-sync' })
      return
    }
    setIsVaultSwitchBusy(true)
    const vaultSwitchOutcome = await papelizSyncEngine.turnSyncOffForVault(openVault.papelizVaultId)
    setIsVaultSwitchBusy(false)
    reportSyncPageActionOutcome(vaultSwitchOutcome)
  }
  const isOpenVaultLockedHere = openVaultSyncReading?.syncVaultLockState === 'locked'
  // Deleting old versions is a change to the synced copy, so a read-only or paused account can't.
  const accountVaultsForFreeUpSpace = accountVaultsOutcome?.syncActionOutcome === 'done' ? accountVaultsOutcome.syncActionDoneValue : []
  const isFreeUpSpaceOffered = !isReadOnly && !syncAccount.isSyncAccountPaused && accountVaultsForFreeUpSpace.length > 0
  const openFreeUpSpaceDialog = () => {
    setFreeUpSpaceOutcome(null)
    setIsFreeUpSpaceDialogShown(true)
  }
  const freeUpSpaceButton = (
    <PapelizPillButton pillButtonVariant="line" pillButtonSize="small" onClick={openFreeUpSpaceDialog}>
      Free Up Space
    </PapelizPillButton>
  )

  return (
    <div>
      {openVaultStatusDescription !== null && OpenVaultStatusIcon !== null ? (
        <p className="flex items-center gap-1.5 text-[12.5px]" title={openVaultStatusDescription.syncStatusTitle}>
          <OpenVaultStatusIcon
            className={joinPapelizClassNames(
              'size-4 flex-none',
              openVaultStatusDescription.syncStatusIconKind === 'synced' ? 'text-papeliz-ok' : openVaultStatusDescription.isSyncStatusAttention ? 'text-papeliz-warning-ink' : 'text-papeliz-ink-muted',
              openVaultStatusDescription.syncStatusIconKind === 'syncing' && 'animate-spin [animation-duration:2s]',
            )}
            aria-hidden="true"
          />
          <span className="font-semibold">{openVaultStatusDescription.syncStatusIconKind === 'synced' ? 'Up to date' : openVaultStatusDescription.syncStatusWord}</span>
          {openVaultSyncReading?.syncVaultStatus.syncStatusKind === 'synced' && openVaultSyncReading.syncVaultStatus.syncLastSyncedAt !== null && (
            <span className="text-papeliz-ink-subtle">· {describePapelizSyncTimeAgo(openVaultSyncReading.syncVaultStatus.syncLastSyncedAt, currentTime)}</span>
          )}
        </p>
      ) : null}
      <PapelizSyncPageSmallText className="mt-0.5">{describePapelizSyncStoragePlaceLine(syncAccount.papelizSyncStoragePlace)}</PapelizSyncPageSmallText>

      {syncAccount.syncSubscriptionState === 'payment-past-due' && (
        <PapelizSyncPageNotice syncPageNoticeAction={<PapelizSyncManageSubscriptionButton papelizSyncEngine={papelizSyncEngine} manageButtonLabel="Update Payment" />}>
          Your last payment didn’t go through. Update it to keep syncing; your changes are saved here meanwhile.
        </PapelizSyncPageNotice>
      )}
      {syncAccount.syncSubscriptionState === 'ends-at-period-end' && syncAccount.syncSubscriptionEndsAt !== null && (
        <PapelizSyncPageNotice syncPageNoticeAction={<PapelizSyncManageSubscriptionButton papelizSyncEngine={papelizSyncEngine} />}>
          Your subscription ends on {describePapelizSyncDay(syncAccount.syncSubscriptionEndsAt, currentTime)}. After that the synced copy stays readable for a while.
        </PapelizSyncPageNotice>
      )}
      {isReadOnly && readSyncEndedNotice(syncAccount, currentTime)}
      {isOverStorage && !isReadOnly && (
        <PapelizSyncPageNotice
          syncPageNoticeAction={
            <>
              {isFreeUpSpaceOffered && freeUpSpaceButton}
              {syncAccount.syncPlanName === 'free' ? (
                <PapelizPillButton pillButtonVariant="line" pillButtonSize="small" onClick={onSyncPlansTabShow}>
                  See Plans
                </PapelizPillButton>
              ) : (
                <PapelizSyncManageSubscriptionButton papelizSyncEngine={papelizSyncEngine} manageButtonLabel="Change Plan" />
              )}
            </>
          }
        >
          <b>Your Sync storage is full.</b> Uploads wait until there’s room; downloads go on, and every change stays saved on this device. Old versions count toward storage and
          are thinned as they age. To sync again now, free up space by deleting old versions, or move to a bigger plan.
        </PapelizSyncPageNotice>
      )}
      {syncAccount.isSyncAccountPaused && (
        <PapelizSyncPageNotice>Papeliz paused uploads for this account. Your changes are saved here and go up once it’s lifted.</PapelizSyncPageNotice>
      )}
      {syncEngineSnapshot.isSyncPausedOnThisDevice && (
        <PapelizSyncPageNotice
          syncPageNoticeAction={
            <PapelizPillButton pillButtonVariant="line" pillButtonSize="small" onClick={() => void papelizSyncEngine.setSyncPausedOnThisDevice(false)}>
              <Play className="size-3.5" aria-hidden="true" />
              Resume
            </PapelizPillButton>
          }
        >
          Sync is paused on this device. Changes wait here; other devices go on syncing.
        </PapelizSyncPageNotice>
      )}
      {isOpenVaultLockedHere && openVaultSyncReading !== undefined && openVault !== null && (
        <PapelizSyncPageNotice
          syncPageNoticeAction={
            <PapelizPillButton
              pillButtonVariant="line"
              pillButtonSize="small"
              onClick={() => setAccountVaultDialogRequest({ accountVaultDialogKind: 'unlock', papelizSyncVaultId: openVaultSyncReading.papelizSyncVaultId })}
            >
              Unlock
            </PapelizPillButton>
          }
        >
          “{openVault.papelizVaultDisplayName}” is End-to-end and locked on this device. Enter its passphrase to sync it here; your changes are saved on this device meanwhile.
        </PapelizSyncPageNotice>
      )}
      {openVaultSyncReading?.syncVaultStatus.syncStatusKind === 'files-missing' && openVault !== null && (
        <PapelizSyncPageNotice
          syncPageNoticeAction={
            <PapelizPillButton pillButtonVariant="line" pillButtonSize="small" onClick={() => showPapelizSyncMissingFiles(openVault.papelizVaultId)}>
              {papelizSyncMissingFilesDialogWords.noticeButtonLabel}
            </PapelizPillButton>
          }
        >
          {describePapelizSyncMissingFilesNotice(openVaultSyncReading.syncVaultStatus.syncMissingFileCount, openVault.papelizVaultDisplayName)}
        </PapelizSyncPageNotice>
      )}

      {openVaultClashes.length > 0 && (
        <>
          <PapelizSyncPageLabel>To Settle</PapelizSyncPageLabel>
          <PapelizSyncPageBox>
            {openVaultClashes.map((syncNoteClash) => (
              <PapelizSyncPageRow
                key={syncNoteClash.papelizSyncClashId}
                SyncPageRowIcon={TriangleAlert}
                syncPageRowTitle={getVaultNoteTitle(syncNoteClash.vaultNoteRelativePath)}
                syncPageRowDetail={`Changed on ${syncNoteClash.otherSyncDeviceName ?? 'another device'} too, in the same lines`}
                syncPageRowEnd={
                  <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" onClick={() => showPapelizSyncNoteClash(syncNoteClash.papelizSyncClashId)}>
                    Settle
                  </PapelizPillButton>
                }
              />
            ))}
          </PapelizSyncPageBox>
        </>
      )}

      <PapelizSyncPageBox className="mt-3">
        {isOpenVaultSyncable && openVault !== null ? (
          <PapelizSyncPageRow
            SyncPageRowIcon={FolderOpen}
            syncPageRowTitle="Sync this vault"
            syncPageRowDetail={[
              openVault.papelizVaultDisplayName,
              openVaultSyncReading === undefined ? null : papelizSyncVaultEncryptionKindDisplayNames[openVaultSyncReading.syncVaultEncryptionKind],
              openAccountVault === undefined ? null : describePapelizSyncFileCount(openAccountVault.syncVaultFileCount),
            ]
              .filter((syncPageRowDetailPart) => syncPageRowDetailPart !== null)
              .join(' · ')}
            syncPageRowEnd={
              <PapelizSyncSwitch
                syncSwitchLabel={`Sync “${openVault.papelizVaultDisplayName}”`}
                isSyncSwitchOn={openVaultSyncReading !== undefined}
                isSyncSwitchDisabled={isVaultSwitchBusy || (isReadOnly && openVaultSyncReading === undefined)}
                onSyncSwitchToggle={() => void toggleOpenVaultSync()}
              />
            }
          />
        ) : (
          <PapelizSyncPageRow
            SyncPageRowIcon={FolderOpen}
            syncPageRowTitle={openVault === null ? 'No vault open' : 'The sample vault never syncs'}
            syncPageRowDetail="Open a folder or a browser vault to sync it."
          />
        )}
        {openVaultSyncReading !== undefined && openVault !== null && (
          // Change Encryption deletes the synced copy and uploads this device's notes again, so it waits
          // until this device is up to date: nothing from another device is lost with the copy.
          // The button goes under the words when the gear is narrow, so neither is squeezed.
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 px-3 py-2">
            {openVaultSyncReading.syncVaultEncryptionKind === 'end-to-end' ? (
              <Lock className="size-4 flex-none text-papeliz-ink-muted" aria-hidden="true" />
            ) : (
              <ShieldCheck className="size-4 flex-none text-papeliz-ink-muted" aria-hidden="true" />
            )}
            <div className="min-w-[12rem] flex-1">
              <div className="text-[12.5px] font-medium">Encryption: {papelizSyncVaultEncryptionKindDisplayNames[openVaultSyncReading.syncVaultEncryptionKind]}</div>
              <div className="text-[11.5px] leading-[1.35] text-papeliz-ink-subtle">
                {openVaultSyncReading.syncVaultStatus.syncStatusKind === 'synced' || isReadOnly
                  ? papelizSyncVaultEncryptionKindReaderLines[openVaultSyncReading.syncVaultEncryptionKind]
                  : 'It can change once this vault is up to date here.'}
              </div>
            </div>
            <PapelizPillButton
              pillButtonVariant="line"
              pillButtonSize="small"
              disabled={openVaultSyncReading.syncVaultStatus.syncStatusKind !== 'synced' || isReadOnly || syncAccount.isSyncAccountPaused}
              onClick={() =>
                openPapelizSyncSetUpDialog({
                  syncSetUpDialogKind: 'change-vault-encryption',
                  papelizVaultId: openVault.papelizVaultId,
                  papelizSyncVaultId: openVaultSyncReading.papelizSyncVaultId,
                  syncVaultName: openVault.papelizVaultDisplayName,
                  currentSyncVaultEncryptionKind: openVaultSyncReading.syncVaultEncryptionKind,
                })
              }
            >
              Change to {papelizSyncVaultEncryptionKindDisplayNames[readPapelizSyncVaultOtherEncryptionKind(openVaultSyncReading.syncVaultEncryptionKind)]}…
            </PapelizPillButton>
          </div>
        )}
        {openVaultSyncReading?.syncVaultTransferProgress != null && (
          <div className="px-3 py-2.5">
            <PapelizSyncProgressBar
              syncProgressLabel="First upload"
              syncProgressFraction={
                openVaultSyncReading.syncVaultTransferProgress.syncTransferFileCount === 0
                  ? 1
                  : openVaultSyncReading.syncVaultTransferProgress.syncTransferredFileCount / openVaultSyncReading.syncVaultTransferProgress.syncTransferFileCount
              }
            />
            <PapelizSyncPageSmallText className="mt-1 tabular-nums">
              {openVaultSyncReading.syncVaultTransferProgress.syncVaultTransferKind === 'first-upload' ? 'Uploading' : openVaultSyncReading.syncVaultTransferProgress.syncVaultTransferKind === 'first-download' ? 'Downloading' : 'Merging'}{' '}
              {openVaultSyncReading.syncVaultTransferProgress.syncTransferredFileCount.toLocaleString('en-US')} of{' '}
              {describePapelizSyncFileCount(openVaultSyncReading.syncVaultTransferProgress.syncTransferFileCount)}
            </PapelizSyncPageSmallText>
          </div>
        )}
      </PapelizSyncPageBox>
      {syncPageActionFailureWords !== null && <PapelizSyncFailureLine className="mt-2">{syncPageActionFailureWords}</PapelizSyncFailureLine>}

      <PapelizSyncSyncedVaultsSection
        papelizSyncEngine={papelizSyncEngine}
        accountVaultsOutcome={accountVaultsOutcome}
        openPapelizVaultId={openVault?.papelizVaultId ?? null}
        onAccountVaultsReadAgain={() => setAccountVaultsReadCount((readCount) => readCount + 1)}
        accountVaultDialogRequest={accountVaultDialogRequest}
        onAccountVaultDialogRequest={setAccountVaultDialogRequest}
      />

      <PapelizSyncPageLabel>What Syncs</PapelizSyncPageLabel>
      <PapelizSyncPageBox>
        <PapelizSyncPageRow syncPageRowTitle="Notes and Attachments" syncPageRowDetail="Always" syncPageRowEnd={<Check className="size-4 flex-none text-papeliz-ok" aria-label="Always on" />} />
        {papelizSyncWhatSyncsSwitchRows.map((whatSyncsSwitchRow) => (
          <PapelizSyncPageRow
            key={whatSyncsSwitchRow.whatSyncsChoiceName}
            syncPageRowTitle={whatSyncsSwitchRow.whatSyncsTitle}
            syncPageRowDetail={whatSyncsSwitchRow.whatSyncsDetail}
            syncPageRowEnd={
              <PapelizSyncSwitch
                syncSwitchLabel={whatSyncsSwitchRow.whatSyncsTitle}
                isSyncSwitchOn={syncEngineSnapshot.syncWhatSyncsChoices[whatSyncsSwitchRow.whatSyncsChoiceName]}
                onSyncSwitchToggle={() =>
                  void papelizSyncEngine
                    .setSyncWhatSyncsChoices({
                      ...syncEngineSnapshot.syncWhatSyncsChoices,
                      [whatSyncsSwitchRow.whatSyncsChoiceName]: !syncEngineSnapshot.syncWhatSyncsChoices[whatSyncsSwitchRow.whatSyncsChoiceName],
                    })
                    .then(reportSyncPageActionOutcome)
                }
              />
            }
          />
        ))}
      </PapelizSyncPageBox>

      {syncVisiblePlanLimits !== null && (
        <>
          <PapelizSyncPageLabel>Storage</PapelizSyncPageLabel>
          <PapelizSyncProgressBar syncProgressLabel="Storage used" syncProgressFraction={syncAccount.syncStorageUsedByteLength / syncVisiblePlanLimits.syncStorageByteLimit} />
          <PapelizSyncPageSmallText className="mt-1">
            {formatPapelizSyncByteSize(syncAccount.syncStorageUsedByteLength)} of {formatPapelizSyncByteSize(syncVisiblePlanLimits.syncStorageByteLimit)}, old versions included
          </PapelizSyncPageSmallText>
          {isFreeUpSpaceOffered && <div className="mt-2">{freeUpSpaceButton}</div>}
          {freeUpSpaceOutcome !== null &&
            (freeUpSpaceOutcome.syncActionOutcome === 'done' ? (
              <PapelizSyncPageSmallText className="mt-1.5">{describePapelizSyncOldVersionDeletion(freeUpSpaceOutcome.syncActionDoneValue)}</PapelizSyncPageSmallText>
            ) : (
              <PapelizSyncFailureLine className="mt-1.5">{describePapelizSyncActionFailureNow(freeUpSpaceOutcome)}</PapelizSyncFailureLine>
            ))}
        </>
      )}
      {isFreeUpSpaceDialogShown && (
        <PapelizSyncFreeUpSpaceDialog
          papelizSyncEngine={papelizSyncEngine}
          accountVaults={accountVaultsForFreeUpSpace}
          initialPapelizSyncVaultId={openVaultSyncedVaultId}
          onFreeUpSpaceDone={(doneFreeUpSpaceOutcome) => {
            setIsFreeUpSpaceDialogShown(false)
            setFreeUpSpaceOutcome(doneFreeUpSpaceOutcome)
            // Each vault's size changed with it.
            setAccountVaultsReadCount((readCount) => readCount + 1)
          }}
          onFreeUpSpaceCancel={() => setIsFreeUpSpaceDialogShown(false)}
        />
      )}

      <div className="mt-3 flex flex-wrap justify-between gap-1.5">
        <PapelizPillButton
          pillButtonVariant="gray"
          pillButtonSize="small"
          disabled={openVaultSyncReading === undefined || activeVaultNoteRelativePath === null}
          title={activeVaultNoteRelativePath === null ? 'Open a note to see its old versions' : 'The open note’s old versions'}
          onClick={() => setPapelizSyncOldVersionsDialogShown(true)}
        >
          <History className="size-3.5" aria-hidden="true" />
          Old Versions
        </PapelizPillButton>
        <PapelizPillButton
          pillButtonVariant="gray"
          pillButtonSize="small"
          onClick={() => void papelizSyncEngine.setSyncPausedOnThisDevice(!syncEngineSnapshot.isSyncPausedOnThisDevice)}
        >
          {syncEngineSnapshot.isSyncPausedOnThisDevice ? <Play className="size-3.5" aria-hidden="true" /> : <CirclePause className="size-3.5" aria-hidden="true" />}
          {syncEngineSnapshot.isSyncPausedOnThisDevice ? 'Resume on This Device' : 'Pause on This Device'}
        </PapelizPillButton>
      </div>
    </div>
  )
}

type PapelizSyncPageTab = 'plans' | 'settings'

// The Settings tab for each sign-in state.
function PapelizSyncSettingsTab({
  papelizSyncEngine,
  syncEngineSnapshot,
  onSyncPlansTabShow,
}: {
  papelizSyncEngine: PapelizSyncEngine
  syncEngineSnapshot: PapelizSyncEngineSnapshot
  onSyncPlansTabShow: () => void
}) {
  const currentTime = usePapelizSyncClockTime()
  const [signInFailureWords, setSignInFailureWords] = useState<string | null>(null)
  const { syncSignIn, syncAccount, syncLinkedLocalVaults } = syncEngineSnapshot
  if (syncSignIn.syncSignInKind === 'device-removed') {
    return (
      <PapelizSyncCenteredStep SyncStepIcon={CloudOff} syncStepTitle="This device is signed out of Sync">
        <PapelizSyncPageText className="max-w-[240px]">It was removed on another device, or its sign-in stopped working. Its notes are untouched.</PapelizSyncPageText>
        <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" onClick={() => void startPapelizSyncSignInFromClick(papelizSyncEngine, null)}>
          Sign In Again
        </PapelizPillButton>
      </PapelizSyncCenteredStep>
    )
  }
  if (syncSignIn.syncSignInKind !== 'signed-in') {
    return (
      <div>
        <PapelizSyncPageText>Sign in to sync your vaults. Every account comes with Free.</PapelizSyncPageText>
        {syncSignIn.syncSignInKind === 'waiting-for-sign-in-page' ? (
          <PapelizSyncSignInWaitingLine className="mt-2" />
        ) : (
          <PapelizPillButton
            pillButtonVariant="primary"
            pillButtonSize="small"
            className="mt-2.5"
            onClick={() => {
              setSignInFailureWords(null)
              void startPapelizSyncSignInFromClick(papelizSyncEngine, null).then((signInFromClickOutcome) =>
                setSignInFailureWords(describePapelizSyncSignInFromClickFailure(signInFromClickOutcome)),
              )
            }}
          >
            Sign In
          </PapelizPillButton>
        )}
        {signInFailureWords !== null && <PapelizSyncFailureLine className="mt-1.5">{signInFailureWords}</PapelizSyncFailureLine>}
      </div>
    )
  }
  if (syncAccount === null) return <PapelizSyncLoadingLine>Reading your account…</PapelizSyncLoadingLine>
  const isSubscriptionEnded = syncAccount.syncSubscriptionState === 'ended-read-only' || syncAccount.syncSubscriptionState === 'ended-held'
  // After a subscription ended, a device that syncs vaults still shows them, read-only.
  if (!canPapelizSyncAccountSync(syncAccount) && !(isSubscriptionEnded && syncLinkedLocalVaults.length > 0)) {
    return (
      <div>
        {isSubscriptionEnded && readSyncEndedNotice(syncAccount, currentTime)}
        <PapelizSyncPageText className="mt-1">
          Choose a plan to start syncing. <PapelizSyncTextButton onClick={onSyncPlansTabShow}>See Plans</PapelizSyncTextButton>
        </PapelizSyncPageText>
      </div>
    )
  }
  return <PapelizSyncOnState papelizSyncEngine={papelizSyncEngine} syncEngineSnapshot={syncEngineSnapshot} syncAccount={syncAccount} onSyncPlansTabShow={onSyncPlansTabShow} />
}

function PapelizSyncPageForSnapshot({ papelizSyncEngine, syncEngineSnapshot }: { papelizSyncEngine: PapelizSyncEngine; syncEngineSnapshot: PapelizSyncEngineSnapshot }) {
  const syncSignInKind = syncEngineSnapshot.syncSignIn.syncSignInKind
  const isPlanPickedFromAddress = usePapelizSyncSettingsGearRequestStore((requestState) => (requestState.syncPlanPickedFromAddress?.pickedSyncPlanName ?? null) !== null)
  const [chosenSyncPageTab, setChosenSyncPageTab] = useState<PapelizSyncPageTab>(() =>
    (syncSignInKind === 'signed-in' || syncSignInKind === 'device-removed') && !isPlanPickedFromAddress ? 'settings' : 'plans',
  )
  // Signing in from Free's card or Settings goes on to Settings, where the account now shows.
  const [lastSeenSyncSignInKind, setLastSeenSyncSignInKind] = useState(syncSignInKind)
  if (syncSignInKind !== lastSeenSyncSignInKind) {
    setLastSeenSyncSignInKind(syncSignInKind)
    if (syncSignInKind === 'signed-in') setChosenSyncPageTab('settings')
  }
  return (
    <div>
      <PapelizSlidingChoiceGroup<PapelizSyncPageTab>
        slidingChoiceGroupLabel="Sync"
        slidingChoiceGroupRole="tablist"
        slidingChoiceGroupTone="solid-blue"
        slidingChoices={[
          { slidingChoiceValue: 'plans', slidingChoiceContent: 'Plans' },
          { slidingChoiceValue: 'settings', slidingChoiceContent: 'Settings' },
        ]}
        chosenSlidingChoiceValue={chosenSyncPageTab}
        onSlidingChoiceSelect={setChosenSyncPageTab}
        slidingChoiceGroupClassName="mb-2.5"
      />
      <div role="tabpanel" aria-label={chosenSyncPageTab === 'plans' ? 'Plans' : 'Settings'}>
        {chosenSyncPageTab === 'plans' ? (
          <PapelizSyncPlansTab papelizSyncEngine={papelizSyncEngine} syncEngineSnapshot={syncEngineSnapshot} />
        ) : (
          <PapelizSyncSettingsTab papelizSyncEngine={papelizSyncEngine} syncEngineSnapshot={syncEngineSnapshot} onSyncPlansTabShow={() => setChosenSyncPageTab('plans')} />
        )}
      </div>
    </div>
  )
}

export function PapelizSyncPage() {
  return (
    <PapelizSyncEngineGate
      renderSyncEnginePage={(papelizSyncEngine, syncEngineSnapshot) => <PapelizSyncPageForSnapshot papelizSyncEngine={papelizSyncEngine} syncEngineSnapshot={syncEngineSnapshot} />}
    />
  )
}
