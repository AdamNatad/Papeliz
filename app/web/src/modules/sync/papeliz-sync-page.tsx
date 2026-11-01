import { Check, CirclePause, CloudOff, FolderOpen, History, Play, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import type { PapelizSyncAccountReading, PapelizSyncAccountVaultReading, PapelizSyncActionOutcome, PapelizSyncEngine, PapelizSyncEngineSnapshot, PapelizSyncWhatSyncsChoices } from './papeliz-sync-engine-contract'
import { PapelizSyncEngineGate } from './papeliz-sync-engine-gate'
import {
  cancelPapelizSyncSignIn,
  describePapelizSyncSignInFromClickFailure,
  isPapelizSyncSubscriptionCurrent,
  openPapelizSyncSetUpDialog,
  setPapelizSyncOldVersionsDialogShown,
  showPapelizSyncNoteClash,
  startPapelizSyncSignInFromClick,
} from './papeliz-sync-flow-store'
import { openPapelizSyncNewTabWhenAddressIsReady, papelizSyncBlockedNewTabWords } from './papeliz-sync-new-tab'
import {
  PapelizSyncChip,
  PapelizSyncFailureLine,
  PapelizSyncLoadingLine,
  PapelizSyncPageBox,
  PapelizSyncPageLabel,
  PapelizSyncPageNotice,
  PapelizSyncPageRow,
  PapelizSyncPageSmallText,
  PapelizSyncPageText,
  PapelizSyncPageTitle,
  PapelizSyncProgressBar,
  PapelizSyncSwitch,
  PapelizSyncTextButton,
} from './papeliz-sync-page-parts'
import { PapelizSyncPlanOffersSection } from './papeliz-sync-plan-offers'
import {
  describePapelizSyncActionFailureNow,
  describePapelizSyncDay,
  describePapelizSyncFileCount,
  describePapelizSyncStatusForStatusBar,
  describePapelizSyncStoragePlaceLine,
  describePapelizSyncTimeAgo,
  formatPapelizSyncByteSize,
  papelizSyncPageIntro,
  papelizSyncPlanDisplayNames,
  papelizSyncVaultEncryptionKindDisplayNames,
} from './papeliz-sync-screen-words'
import { papelizSyncStatusIcons } from './papeliz-sync-status-icons'
import { PapelizSyncSyncedVaultsSection, type PapelizSyncAccountVaultDialogRequest } from './papeliz-sync-synced-vaults-section'
import { usePapelizSyncClockTime } from './papeliz-sync-clock'
import { getVaultNoteTitle } from '../vault/papeliz-vault-relative-paths'

// The gear's Sync page in each of its states: the plans before subscribing (A), and on: this vault's
// switch (turning it on opens Turn on Sync, which asks Standard or End-to-end), the synced vaults
// with their kinds, what syncs, storage, Old versions and Pause on this device, with what to do when
// storage is full, a payment failed, the subscription ended or an End-to-end vault is locked here.

function PapelizSyncManageSubscriptionButton({ papelizSyncEngine, manageButtonLabel = 'Manage subscription' }: { papelizSyncEngine: PapelizSyncEngine; manageButtonLabel?: string }) {
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

// Before subscribing, and after a subscription ended: the plans, with Choose.
function PapelizSyncPlansState({ papelizSyncEngine, syncEngineSnapshot, plansStateNotice }: { papelizSyncEngine: PapelizSyncEngine; syncEngineSnapshot: PapelizSyncEngineSnapshot; plansStateNotice?: ReactNode }) {
  const [signInFailureWords, setSignInFailureWords] = useState<string | null>(null)
  const syncSignInKind = syncEngineSnapshot.syncSignIn.syncSignInKind
  return (
    <div>
      <PapelizSyncPageTitle pageTitleChip={<PapelizSyncChip syncChipTone="paid">Paid Add-on</PapelizSyncChip>}>Sync</PapelizSyncPageTitle>
      <PapelizSyncPageText className="mt-1">{papelizSyncPageIntro}</PapelizSyncPageText>
      {plansStateNotice}
      <PapelizSyncPlanOffersSection papelizSyncEngine={papelizSyncEngine} syncEngineSnapshot={syncEngineSnapshot} />
      {syncSignInKind === 'waiting-for-sign-in-page' ? (
        <PapelizSyncPageSmallText className="mt-1.5">
          Finish signing in in the new tab.{' '}
          <PapelizSyncTextButton onClick={cancelPapelizSyncSignIn}>Cancel</PapelizSyncTextButton>
        </PapelizSyncPageSmallText>
      ) : (
        syncSignInKind !== 'signed-in' && (
          <PapelizSyncPageSmallText className="mt-1.5">
            Already subscribed?{' '}
            <PapelizSyncTextButton
              onClick={() => {
                setSignInFailureWords(null)
                void startPapelizSyncSignInFromClick(papelizSyncEngine, null).then((signInFromClickOutcome) =>
                  setSignInFailureWords(describePapelizSyncSignInFromClickFailure(signInFromClickOutcome)),
                )
              }}
            >
              Sign in
            </PapelizSyncTextButton>
          </PapelizSyncPageSmallText>
        )
      )}
      {signInFailureWords !== null && <PapelizSyncFailureLine className="mt-1.5">{signInFailureWords}</PapelizSyncFailureLine>}
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
  { whatSyncsChoiceName: 'isAssistantChatSyncOn', whatSyncsTitle: 'Assistant chats' },
]

// Sync on: this account is subscribed (or its subscription ended with vaults syncing here).
function PapelizSyncOnState({ papelizSyncEngine, syncEngineSnapshot, syncAccount }: { papelizSyncEngine: PapelizSyncEngine; syncEngineSnapshot: PapelizSyncEngineSnapshot; syncAccount: PapelizSyncAccountReading }) {
  const openVault = usePapelizWorkspaceStore((workspaceState) => workspaceState.openVault)
  const activeVaultNoteRelativePath = usePapelizWorkspaceStore((workspaceState) => workspaceState.activeVaultNoteRelativePath)
  const [syncPageActionFailureWords, setSyncPageActionFailureWords] = useState<string | null>(null)
  const [isVaultSwitchBusy, setIsVaultSwitchBusy] = useState(false)
  const [accountVaultsOutcome, setAccountVaultsOutcome] = useState<PapelizSyncActionOutcome<PapelizSyncAccountVaultReading[]> | null>(null)
  const [accountVaultDialogRequest, setAccountVaultDialogRequest] = useState<PapelizSyncAccountVaultDialogRequest | null>(null)
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

  return (
    <div>
      <PapelizSyncPageTitle pageTitleChip={syncAccount.syncPlanName !== null && <PapelizSyncChip syncChipTone="plan">{papelizSyncPlanDisplayNames[syncAccount.syncPlanName]}</PapelizSyncChip>}>
        Sync
      </PapelizSyncPageTitle>
      {openVaultStatusDescription !== null && OpenVaultStatusIcon !== null ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px]" title={openVaultStatusDescription.syncStatusTitle}>
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
        <PapelizSyncPageNotice syncPageNoticeAction={<PapelizSyncManageSubscriptionButton papelizSyncEngine={papelizSyncEngine} manageButtonLabel="Update payment" />}>
          Your last payment didn’t go through. Update it to keep syncing; your changes are saved here meanwhile.
        </PapelizSyncPageNotice>
      )}
      {syncAccount.syncSubscriptionState === 'ends-at-period-end' && syncAccount.syncSubscriptionEndsAt !== null && (
        <PapelizSyncPageNotice syncPageNoticeAction={<PapelizSyncManageSubscriptionButton papelizSyncEngine={papelizSyncEngine} />}>
          Your subscription ends on {describePapelizSyncDay(syncAccount.syncSubscriptionEndsAt, currentTime)}. After that the synced copy stays readable for a while.
        </PapelizSyncPageNotice>
      )}
      {isReadOnly && (
        <>
          {readSyncEndedNotice(syncAccount, currentTime)}
          <PapelizSyncPlanOffersSection papelizSyncEngine={papelizSyncEngine} syncEngineSnapshot={syncEngineSnapshot} />
        </>
      )}
      {isOverStorage && !isReadOnly && (
        <PapelizSyncPageNotice syncPageNoticeAction={<PapelizSyncManageSubscriptionButton papelizSyncEngine={papelizSyncEngine} manageButtonLabel="Change plan" />}>
          <b>Your Sync storage is full.</b> Uploads wait until there’s room; downloads go on, and every change stays saved on this device. Old versions count toward storage and
          are thinned as they age, which frees room over time. To sync again now, move to a bigger plan.
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

      {openVaultClashes.length > 0 && (
        <>
          <PapelizSyncPageLabel>To settle</PapelizSyncPageLabel>
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

      <PapelizSyncPageLabel>What syncs</PapelizSyncPageLabel>
      <PapelizSyncPageBox>
        <PapelizSyncPageRow syncPageRowTitle="Notes and attachments" syncPageRowDetail="Always" syncPageRowEnd={<Check className="size-4 flex-none text-papeliz-ok" aria-label="Always on" />} />
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
        </>
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
          Old versions
        </PapelizPillButton>
        <PapelizPillButton
          pillButtonVariant="gray"
          pillButtonSize="small"
          onClick={() => void papelizSyncEngine.setSyncPausedOnThisDevice(!syncEngineSnapshot.isSyncPausedOnThisDevice)}
        >
          {syncEngineSnapshot.isSyncPausedOnThisDevice ? <Play className="size-3.5" aria-hidden="true" /> : <CirclePause className="size-3.5" aria-hidden="true" />}
          {syncEngineSnapshot.isSyncPausedOnThisDevice ? 'Resume on this device' : 'Pause on this device'}
        </PapelizPillButton>
      </div>
    </div>
  )
}

function PapelizSyncPageForSnapshot({ papelizSyncEngine, syncEngineSnapshot }: { papelizSyncEngine: PapelizSyncEngine; syncEngineSnapshot: PapelizSyncEngineSnapshot }) {
  const currentTime = usePapelizSyncClockTime()
  const { syncSignIn, syncAccount, syncLinkedLocalVaults } = syncEngineSnapshot
  if (syncSignIn.syncSignInKind === 'device-removed') {
    return (
      <PapelizSyncCenteredStep SyncStepIcon={CloudOff} syncStepTitle="This device is signed out of Sync">
        <PapelizSyncPageText className="max-w-[240px]">It was removed on another device, or its sign-in stopped working. Its notes are untouched.</PapelizSyncPageText>
        <PapelizPillButton pillButtonVariant="primary" pillButtonSize="small" onClick={() => void startPapelizSyncSignInFromClick(papelizSyncEngine, null)}>
          Sign in again
        </PapelizPillButton>
      </PapelizSyncCenteredStep>
    )
  }
  if (syncSignIn.syncSignInKind !== 'signed-in') return <PapelizSyncPlansState papelizSyncEngine={papelizSyncEngine} syncEngineSnapshot={syncEngineSnapshot} />
  if (syncAccount === null) return <PapelizSyncLoadingLine>Reading your account…</PapelizSyncLoadingLine>
  const isSubscriptionEnded = syncAccount.syncSubscriptionState === 'ended-read-only' || syncAccount.syncSubscriptionState === 'ended-held'
  // After a subscription ended, a device that syncs vaults still shows them, read-only.
  if (!isPapelizSyncSubscriptionCurrent(syncAccount.syncSubscriptionState) && !(isSubscriptionEnded && syncLinkedLocalVaults.length > 0)) {
    return (
      <PapelizSyncPlansState
        papelizSyncEngine={papelizSyncEngine}
        syncEngineSnapshot={syncEngineSnapshot}
        plansStateNotice={isSubscriptionEnded ? readSyncEndedNotice(syncAccount, currentTime) : undefined}
      />
    )
  }
  return <PapelizSyncOnState papelizSyncEngine={papelizSyncEngine} syncEngineSnapshot={syncEngineSnapshot} syncAccount={syncAccount} />
}

export function PapelizSyncPage() {
  return (
    <PapelizSyncEngineGate
      renderSyncEnginePage={(papelizSyncEngine, syncEngineSnapshot) => <PapelizSyncPageForSnapshot papelizSyncEngine={papelizSyncEngine} syncEngineSnapshot={syncEngineSnapshot} />}
    />
  )
}
