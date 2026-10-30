import { ExternalLink, Globe, Laptop, LoaderCircle, LogOut, Pencil, RefreshCw, Smartphone, User, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { PapelizConfirmDialog } from '../ui/papeliz-confirm-dialog'
import { PapelizMark } from '../ui/papeliz-mark'
import type {
  PapelizSyncAccountReading,
  PapelizSyncActionOutcome,
  PapelizSyncDevicePlatform,
  PapelizSyncDeviceReading,
  PapelizSyncEngine,
  PapelizSyncEngineSnapshot,
} from './papeliz-sync-engine-contract'
import { rememberPapelizSyncUsedOnThisDevice } from './papeliz-sync-engine-store'
import { cancelPapelizSyncSignIn, describePapelizSyncSignInFromClickFailure, startPapelizSyncSignInFromClick } from './papeliz-sync-flow-store'
import { openPapelizSyncNewTabWhenAddressIsReady, papelizSyncBlockedNewTabWords } from './papeliz-sync-new-tab'
import { PapelizSyncFailureLine, PapelizSyncLoadingLine, PapelizSyncPageBox, PapelizSyncPageLabel, PapelizSyncPageRow, PapelizSyncPageSmallText, PapelizSyncPageText } from './papeliz-sync-page-parts'
import { papelizSyncTextFieldClassName } from './papeliz-sync-passphrase-fields'
import { PapelizSyncEngineGate } from './papeliz-sync-engine-gate'
import {
  describePapelizSyncActionFailure,
  describePapelizSyncActionFailureNow,
  describePapelizSyncDay,
  describePapelizSyncTimeAgo,
  papelizSyncPlanDisplayNames,
  papelizSyncSignInMethodDisplayNames,
} from './papeliz-sync-screen-words'
import { usePapelizSyncClockTime } from './papeliz-sync-clock'

// The gear's Account page. Signed out (B, 2026-10-31): the Papeliz tile, a title, one line and a
// full-width Sign in, like the sign-in page it opens in a new tab. Signed in: the email, the
// subscription with Manage, the devices with Remove, and Sign out. An account is only for Papeliz
// Sync, and it is deleted on papeliz.com/account, not here.

const papelizSyncDevicePlatformIcons: Record<PapelizSyncDevicePlatform, LucideIcon> = { web: Globe, desktop: Laptop, mobile: Smartphone }

function PapelizSyncAccountCenteredState({ accountStateTitle, children }: { accountStateTitle: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-1 pt-2 pb-1 text-center">
      <span
        className="mb-2.5 grid size-10 place-items-center rounded-[10px] bg-linear-to-br from-papeliz-gradient-start to-papeliz-gradient-end shadow-[0_4px_12px_rgb(0_64_160/0.2)]"
        aria-hidden="true"
      >
        <PapelizMark papelizMarkSize={28} papelizMarkTone="on-blue" />
      </span>
      <p className="text-[15.5px] font-semibold">{accountStateTitle}</p>
      {children}
    </div>
  )
}

// Sign in from the click; the page follows the engine's snapshot from there.
function PapelizSyncAccountSignInButton({ papelizSyncEngine, signInButtonLabel }: { papelizSyncEngine: PapelizSyncEngine; signInButtonLabel: string }) {
  const [signInFailureWords, setSignInFailureWords] = useState<string | null>(null)
  return (
    <>
      <PapelizPillButton
        pillButtonVariant="primary"
        className="mt-3.5 w-full"
        onClick={() => {
          setSignInFailureWords(null)
          void startPapelizSyncSignInFromClick(papelizSyncEngine, null).then((signInFromClickOutcome) => setSignInFailureWords(describePapelizSyncSignInFromClickFailure(signInFromClickOutcome)))
        }}
      >
        {signInButtonLabel}
      </PapelizPillButton>
      {signInFailureWords !== null && <PapelizSyncFailureLine className="mt-2 max-w-[240px]">{signInFailureWords}</PapelizSyncFailureLine>}
    </>
  )
}

function describeSyncSubscriptionLine(syncAccount: PapelizSyncAccountReading, currentTime: number): { syncSubscriptionTitle: string; syncSubscriptionDetail: string } {
  const syncPlanDisplayName = syncAccount.syncPlanName === null ? 'Papeliz Sync' : papelizSyncPlanDisplayNames[syncAccount.syncPlanName]
  switch (syncAccount.syncSubscriptionState) {
    case 'not-subscribed':
      return { syncSubscriptionTitle: 'No subscription', syncSubscriptionDetail: 'Choose a plan on the Sync page.' }
    case 'active':
      return {
        syncSubscriptionTitle: `${syncPlanDisplayName} · Active`,
        syncSubscriptionDetail: syncAccount.syncSubscriptionRenewsAt === null ? 'Active' : `Renews on ${describePapelizSyncDay(syncAccount.syncSubscriptionRenewsAt, currentTime)}`,
      }
    case 'ends-at-period-end':
      return {
        syncSubscriptionTitle: `${syncPlanDisplayName} · Cancelled`,
        syncSubscriptionDetail: syncAccount.syncSubscriptionEndsAt === null ? 'Ends at the end of this period' : `Ends on ${describePapelizSyncDay(syncAccount.syncSubscriptionEndsAt, currentTime)}`,
      }
    case 'payment-past-due':
      return { syncSubscriptionTitle: `${syncPlanDisplayName} · Payment due`, syncSubscriptionDetail: 'The last payment didn’t go through. Update it to keep syncing.' }
    case 'ended-read-only':
      return {
        syncSubscriptionTitle: 'Ended',
        syncSubscriptionDetail:
          syncAccount.syncReadOnlyUntil === null ? 'The synced copy can still be read.' : `The synced copy can be read until ${describePapelizSyncDay(syncAccount.syncReadOnlyUntil, currentTime)}.`,
      }
    case 'ended-held':
      return {
        syncSubscriptionTitle: 'Ended',
        syncSubscriptionDetail:
          syncAccount.syncSyncedCopyDeletedAt === null
            ? 'The synced copy is kept for a while. Subscribe again to bring it back.'
            : `The synced copy is kept until ${describePapelizSyncDay(syncAccount.syncSyncedCopyDeletedAt, currentTime)}. Subscribe again to bring it back.`,
      }
  }
}

function PapelizSyncThisDeviceNameRow({ papelizSyncEngine, syncDevice, onSyncDeviceNamed }: { papelizSyncEngine: PapelizSyncEngine; syncDevice: PapelizSyncDeviceReading; onSyncDeviceNamed: () => void }) {
  const [typedSyncDeviceName, setTypedSyncDeviceName] = useState<string | null>(null)
  const [deviceNameFailureWords, setDeviceNameFailureWords] = useState<string | null>(null)
  const SyncDevicePlatformIcon = papelizSyncDevicePlatformIcons[syncDevice.syncDevicePlatform]
  if (typedSyncDeviceName === null) {
    return (
      <PapelizSyncPageRow
        SyncPageRowIcon={SyncDevicePlatformIcon}
        syncPageRowTitle={syncDevice.syncDeviceName ?? 'This browser'}
        syncPageRowDetail={deviceNameFailureWords ?? 'This device'}
        syncPageRowEnd={
          <PapelizPillButton pillButtonVariant="gray" pillButtonSize="small" aria-label="Rename this device" title="Rename this device" onClick={() => setTypedSyncDeviceName(syncDevice.syncDeviceName ?? '')}>
            <Pencil className="size-3.5" aria-hidden="true" />
          </PapelizPillButton>
        }
      />
    )
  }
  const saveSyncDeviceName = () => {
    const newSyncDeviceName = typedSyncDeviceName.trim()
    if (newSyncDeviceName === '') return
    setTypedSyncDeviceName(null)
    void papelizSyncEngine.nameThisSyncDevice(newSyncDeviceName).then((nameOutcome) => {
      setDeviceNameFailureWords(nameOutcome.syncActionOutcome === 'failed' ? describePapelizSyncActionFailureNow(nameOutcome) : null)
      onSyncDeviceNamed()
    })
  }
  return (
    <form
      className="flex items-center gap-2 px-3 py-2"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault()
        saveSyncDeviceName()
      }}
    >
      <input
        type="text"
        value={typedSyncDeviceName}
        onChange={(changeEvent) => setTypedSyncDeviceName(changeEvent.target.value)}
        aria-label="This device’s name"
        placeholder="Name, such as Work laptop"
        maxLength={60}
        autoFocus
        className={`${papelizSyncTextFieldClassName} h-8 text-[12.5px]`}
      />
      <PapelizPillButton type="submit" pillButtonVariant="primary" pillButtonSize="small" disabled={typedSyncDeviceName.trim() === ''}>
        Save
      </PapelizPillButton>
    </form>
  )
}

type PapelizSyncAccountConfirmation = { accountConfirmationKind: 'remove-device'; syncDevice: PapelizSyncDeviceReading }

function PapelizSyncSignedInAccount({ papelizSyncEngine, syncEngineSnapshot }: { papelizSyncEngine: PapelizSyncEngine; syncEngineSnapshot: PapelizSyncEngineSnapshot }) {
  const [syncDevicesOutcome, setSyncDevicesOutcome] = useState<PapelizSyncActionOutcome<PapelizSyncDeviceReading[]> | null>(null)
  const [syncDevicesReadCount, setSyncDevicesReadCount] = useState(0)
  const [accountConfirmation, setAccountConfirmation] = useState<PapelizSyncAccountConfirmation | null>(null)
  const [accountActionFailureWords, setAccountActionFailureWords] = useState<string | null>(null)
  const [isAccountActionRunning, setIsAccountActionRunning] = useState(false)
  const currentTime = usePapelizSyncClockTime()
  const syncSignIn = syncEngineSnapshot.syncSignIn
  const syncAccount = syncEngineSnapshot.syncAccount

  useEffect(() => {
    let isDeviceListLeft = false
    void papelizSyncEngine.listSyncDevices().then((listedSyncDevicesOutcome) => {
      if (!isDeviceListLeft) setSyncDevicesOutcome(listedSyncDevicesOutcome)
    })
    return () => {
      isDeviceListLeft = true
    }
  }, [papelizSyncEngine, syncDevicesReadCount])

  if (syncSignIn.syncSignInKind !== 'signed-in') return null
  const signInEmailAddress = syncSignIn.syncSignInEmailAddress
  const syncSubscriptionLine = syncAccount === null ? null : describeSyncSubscriptionLine(syncAccount, currentTime)
  const hasSubscriptionPage = syncAccount !== null && syncAccount.syncSubscriptionState !== 'not-subscribed'

  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 flex-none place-items-center rounded-full bg-papeliz-blue-soft text-[14px] font-semibold text-papeliz-blue uppercase" aria-hidden="true">
          {signInEmailAddress?.charAt(0) ?? <User className="size-4" />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">{signInEmailAddress ?? 'Signed in'}</p>
          {syncSignIn.syncSignInMethod !== null && <PapelizSyncPageSmallText>{papelizSyncSignInMethodDisplayNames[syncSignIn.syncSignInMethod]}</PapelizSyncPageSmallText>}
        </div>
      </div>

      <PapelizSyncPageLabel>Papeliz Sync</PapelizSyncPageLabel>
      <PapelizSyncPageBox>
        {syncSubscriptionLine === null ? (
          <div className="px-3">
            <PapelizSyncLoadingLine>Reading your subscription…</PapelizSyncLoadingLine>
          </div>
        ) : (
          <PapelizSyncPageRow
            SyncPageRowIcon={RefreshCw}
            syncPageRowTitle={syncSubscriptionLine.syncSubscriptionTitle}
            syncPageRowDetail={syncSubscriptionLine.syncSubscriptionDetail}
            syncPageRowEnd={
              hasSubscriptionPage && (
                <PapelizPillButton
                  pillButtonVariant="line"
                  pillButtonSize="small"
                  title="Opens your subscription’s page in a new tab"
                  onClick={() => {
                    setAccountActionFailureWords(null)
                    void openPapelizSyncNewTabWhenAddressIsReady(() => papelizSyncEngine.createSyncBillingPortalUrl()).then((billingTabOutcome) => {
                      if (billingTabOutcome.syncNewTabOutcome === 'blocked') setAccountActionFailureWords(papelizSyncBlockedNewTabWords)
                      if (billingTabOutcome.syncNewTabOutcome === 'failed') setAccountActionFailureWords(describePapelizSyncActionFailureNow(billingTabOutcome.syncNewTabFailedOutcome))
                    })
                  }}
                >
                  Manage
                  <ExternalLink className="size-3" aria-hidden="true" />
                </PapelizPillButton>
              )
            }
          />
        )}
      </PapelizSyncPageBox>

      <PapelizSyncPageLabel>Devices</PapelizSyncPageLabel>
      <PapelizSyncPageBox>
        {syncDevicesOutcome === null ? (
          <div className="px-3">
            <PapelizSyncLoadingLine>Reading your devices…</PapelizSyncLoadingLine>
          </div>
        ) : syncDevicesOutcome.syncActionOutcome === 'failed' ? (
          <div className="px-3 py-2.5">
            <PapelizSyncFailureLine>{describePapelizSyncActionFailure(syncDevicesOutcome, currentTime)}</PapelizSyncFailureLine>
          </div>
        ) : (
          syncDevicesOutcome.syncActionDoneValue.map((syncDevice) =>
            syncDevice.isThisSyncDevice ? (
              <PapelizSyncThisDeviceNameRow
                key={syncDevice.papelizSyncDeviceId}
                papelizSyncEngine={papelizSyncEngine}
                syncDevice={syncDevice}
                onSyncDeviceNamed={() => setSyncDevicesReadCount(syncDevicesReadCount + 1)}
              />
            ) : (
              <PapelizSyncPageRow
                key={syncDevice.papelizSyncDeviceId}
                SyncPageRowIcon={papelizSyncDevicePlatformIcons[syncDevice.syncDevicePlatform]}
                syncPageRowTitle={syncDevice.syncDeviceName ?? 'Unnamed device'}
                syncPageRowDetail={syncDevice.syncDeviceLastSeenAt === null ? 'Not seen yet' : describePapelizSyncTimeAgo(syncDevice.syncDeviceLastSeenAt, currentTime)}
                syncPageRowEnd={
                  <PapelizPillButton pillButtonVariant="gray" pillButtonSize="small" onClick={() => setAccountConfirmation({ accountConfirmationKind: 'remove-device', syncDevice })}>
                    Remove
                  </PapelizPillButton>
                }
              />
            ),
          )
        )}
      </PapelizSyncPageBox>

      {accountActionFailureWords !== null && <PapelizSyncFailureLine className="mt-2">{accountActionFailureWords}</PapelizSyncFailureLine>}

      <div className="mt-3 flex">
        <PapelizPillButton
          pillButtonVariant="gray"
          pillButtonSize="small"
          disabled={isAccountActionRunning}
          onClick={() => {
            setIsAccountActionRunning(true)
            void papelizSyncEngine.signOutOfSync().then((signOutOutcome) => {
              setIsAccountActionRunning(false)
              if (signOutOutcome.syncActionOutcome === 'done') rememberPapelizSyncUsedOnThisDevice(false)
              else setAccountActionFailureWords(describePapelizSyncActionFailureNow(signOutOutcome))
            })
          }}
        >
          <LogOut className="size-3.5" aria-hidden="true" />
          Sign out
        </PapelizPillButton>
      </div>

      {accountConfirmation?.accountConfirmationKind === 'remove-device' && (
        <PapelizConfirmDialog
          confirmDialogTitle={`Remove “${accountConfirmation.syncDevice.syncDeviceName ?? 'Unnamed device'}”?`}
          confirmDialogBody={<p>It’s signed out of Sync within the hour. Its notes stay on it; it just stops syncing.</p>}
          confirmButtonLabel="Remove"
          onCancel={() => setAccountConfirmation(null)}
          onConfirm={() => {
            const removedSyncDevice = accountConfirmation.syncDevice
            setAccountConfirmation(null)
            void papelizSyncEngine.removeSyncDevice(removedSyncDevice.papelizSyncDeviceId).then((removeOutcome) => {
              if (removeOutcome.syncActionOutcome === 'failed') setAccountActionFailureWords(describePapelizSyncActionFailureNow(removeOutcome))
              setSyncDevicesReadCount(syncDevicesReadCount + 1)
            })
          }}
        />
      )}
    </div>
  )
}

export function PapelizSyncAccountPage() {
  return (
    <PapelizSyncEngineGate
      renderSyncEnginePage={(papelizSyncEngine, syncEngineSnapshot) => {
        const syncSignIn = syncEngineSnapshot.syncSignIn
        if (syncSignIn.syncSignInKind === 'signed-in') return <PapelizSyncSignedInAccount papelizSyncEngine={papelizSyncEngine} syncEngineSnapshot={syncEngineSnapshot} />
        if (syncSignIn.syncSignInKind === 'waiting-for-sign-in-page') {
          return (
            <PapelizSyncAccountCenteredState accountStateTitle="Finish in the new tab">
              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-papeliz-ink-subtle" role="status">
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                Waiting for sign-in…
              </p>
              <PapelizPillButton pillButtonVariant="gray" className="mt-3.5 w-full" onClick={cancelPapelizSyncSignIn}>
                Cancel
              </PapelizPillButton>
            </PapelizSyncAccountCenteredState>
          )
        }
        if (syncSignIn.syncSignInKind === 'device-removed') {
          return (
            <PapelizSyncAccountCenteredState accountStateTitle="Signed out of Sync">
              <PapelizSyncPageText className="mt-0.5 max-w-[230px]">Your notes on this device are untouched.</PapelizSyncPageText>
              <PapelizSyncAccountSignInButton papelizSyncEngine={papelizSyncEngine} signInButtonLabel="Sign in again" />
            </PapelizSyncAccountCenteredState>
          )
        }
        return (
          <PapelizSyncAccountCenteredState accountStateTitle="Sign in to Papeliz">
            <PapelizSyncPageText className="mt-0.5 max-w-[230px]">Sync your notes on all your devices.</PapelizSyncPageText>
            <PapelizSyncAccountSignInButton papelizSyncEngine={papelizSyncEngine} signInButtonLabel="Sign in" />
          </PapelizSyncAccountCenteredState>
        )
      }}
    />
  )
}
