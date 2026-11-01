'use client'

import { useAuth, useClerk } from '@clerk/react'
import { Globe, Laptop, Smartphone, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { papelizSiteSyncConnectedDeviceLimit } from '@/lib/papeliz-site-sync-plans'
import {
  papelizAccountCompactDangerButtonClassName,
  papelizAccountCompactPrimaryButtonClassName,
  papelizAccountRowActionWidthClassName,
  papelizAccountSecondaryButtonClassName,
} from './papeliz-account-card-frame'
import { papelizAccountPagePath } from './papeliz-account-config'
import { PapelizAccountDialog } from './papeliz-account-dialog'
import { PapelizAccountRowGroup, PapelizAccountSectionIntro } from './papeliz-account-rows'
import type { PapelizAccountSyncDevicePlatform, PapelizAccountSyncDeviceRecord, PapelizAccountSyncService } from './papeliz-account-sync-service'
import { describePapelizAccountPastDay, describePapelizAccountTimeAgo } from './papeliz-account-time-descriptions'

export type PapelizAccountSyncDeviceListStage =
  | { syncDeviceListStageKind: 'not-loaded' }
  | { syncDeviceListStageKind: 'loading' }
  | { syncDeviceListStageKind: 'listed'; syncDeviceRecords: PapelizAccountSyncDeviceRecord[] }
  | { syncDeviceListStageKind: 'failed'; syncDeviceListFailureMessage: string }

export interface PapelizAccountSyncDeviceList {
  syncDeviceListStage: PapelizAccountSyncDeviceListStage
  loadPapelizAccountSyncDevices: () => void
  forgetRemovedPapelizAccountSyncDevice: (papelizSyncDeviceId: string) => void
}

export const papelizAccountSyncUnreachableMessage = 'Couldn’t reach Papeliz Sync. Check your connection, then try again.'

// The most recently synced first; a device that never synced goes last.
function sortPapelizAccountSyncDeviceRecords(syncDeviceRecords: PapelizAccountSyncDeviceRecord[]): PapelizAccountSyncDeviceRecord[] {
  return [...syncDeviceRecords].sort(
    (firstSyncDeviceRecord, secondSyncDeviceRecord) => (secondSyncDeviceRecord.syncDeviceLastSeenAt ?? 0) - (firstSyncDeviceRecord.syncDeviceLastSeenAt ?? 0),
  )
}

// Held by the dashboard, which shows the section twice (a computer's layout and a phone's), so the
// list loads once and a removal shows in both.
export function usePapelizAccountSyncDeviceList(papelizAccountSyncService: PapelizAccountSyncService): PapelizAccountSyncDeviceList {
  const { getToken } = useAuth()
  const [syncDeviceListStage, setSyncDeviceListStage] = useState<PapelizAccountSyncDeviceListStage>({ syncDeviceListStageKind: 'not-loaded' })
  const syncDeviceListRequestIsRunningRef = useRef(false)

  const loadPapelizAccountSyncDevices = useCallback(() => {
    if (syncDeviceListRequestIsRunningRef.current) return
    syncDeviceListRequestIsRunningRef.current = true
    setSyncDeviceListStage({ syncDeviceListStageKind: 'loading' })
    void (async () => {
      try {
        const papelizAccountSignInToken = await getToken({ skipCache: true })
        if (!papelizAccountSignInToken) {
          setSyncDeviceListStage({ syncDeviceListStageKind: 'failed', syncDeviceListFailureMessage: 'Sign in again to see your devices.' })
          return
        }
        const syncDeviceListOutcome = await papelizAccountSyncService.listPapelizSyncDevices(papelizAccountSignInToken)
        setSyncDeviceListStage(
          syncDeviceListOutcome.syncDeviceListOutcomeKind === 'listed'
            ? { syncDeviceListStageKind: 'listed', syncDeviceRecords: sortPapelizAccountSyncDeviceRecords(syncDeviceListOutcome.syncDeviceRecords) }
            : { syncDeviceListStageKind: 'failed', syncDeviceListFailureMessage: syncDeviceListOutcome.syncDeviceListRefusalMessage },
        )
      } catch {
        setSyncDeviceListStage({ syncDeviceListStageKind: 'failed', syncDeviceListFailureMessage: papelizAccountSyncUnreachableMessage })
      } finally {
        syncDeviceListRequestIsRunningRef.current = false
      }
    })()
  }, [getToken, papelizAccountSyncService])

  const forgetRemovedPapelizAccountSyncDevice = useCallback((papelizSyncDeviceId: string) => {
    setSyncDeviceListStage((currentSyncDeviceListStage) =>
      currentSyncDeviceListStage.syncDeviceListStageKind === 'listed'
        ? {
            ...currentSyncDeviceListStage,
            syncDeviceRecords: currentSyncDeviceListStage.syncDeviceRecords.filter((syncDeviceRecord) => syncDeviceRecord.papelizSyncDeviceId !== papelizSyncDeviceId),
          }
        : currentSyncDeviceListStage,
    )
  }, [])

  return { syncDeviceListStage, loadPapelizAccountSyncDevices, forgetRemovedPapelizAccountSyncDevice }
}

// Each kind's icon, and its name for a device that has no name of its own.
const papelizAccountSyncDevicePlatformLabels: Record<PapelizAccountSyncDevicePlatform, { syncDevicePlatformName: string; SyncDevicePlatformIcon: LucideIcon }> = {
  web: { syncDevicePlatformName: 'Browser', SyncDevicePlatformIcon: Globe },
  desktop: { syncDevicePlatformName: 'Computer', SyncDevicePlatformIcon: Laptop },
  mobile: { syncDevicePlatformName: 'Phone or tablet', SyncDevicePlatformIcon: Smartphone },
}

// The device's own name, or its kind when it has none.
function namePapelizAccountSyncDevice(syncDeviceRecord: PapelizAccountSyncDeviceRecord): string {
  return syncDeviceRecord.syncDeviceName ?? papelizAccountSyncDevicePlatformLabels[syncDeviceRecord.syncDevicePlatform].syncDevicePlatformName
}

// The removal dialog's title: "Remove “Work laptop”?", or "Remove this browser?" for a device named by its kind.
function titlePapelizAccountSyncDeviceRemoval(syncDeviceRecord: PapelizAccountSyncDeviceRecord): string {
  return syncDeviceRecord.syncDeviceName === null
    ? `Remove this ${papelizAccountSyncDevicePlatformLabels[syncDeviceRecord.syncDevicePlatform].syncDevicePlatformName.toLowerCase()}?`
    : `Remove “${syncDeviceRecord.syncDeviceName}”?`
}

function describePapelizAccountSyncDevice(syncDeviceRecord: PapelizAccountSyncDeviceRecord, currentTime: number): string {
  const syncDeviceLastSeenText =
    syncDeviceRecord.syncDeviceLastSeenAt === null ? 'Not synced yet' : `Synced ${describePapelizAccountTimeAgo(syncDeviceRecord.syncDeviceLastSeenAt, currentTime)}`
  return `${syncDeviceLastSeenText} · Added ${describePapelizAccountPastDay(syncDeviceRecord.syncDeviceAddedAt, currentTime)}`
}

type PapelizAccountSyncDeviceRemoval = {
  syncDeviceRecord: PapelizAccountSyncDeviceRecord
  // `sign-in-ended`: the page's sign-in itself has ended. Remove needs no recent sign-in, only a live one.
  syncDeviceRemovalStageKind: 'confirming' | 'removing' | 'sign-in-ended' | 'failed'
  syncDeviceRemovalFailureMessage?: string
}

// One line of the list, or of its loading, failed and empty states: an icon tile, a title over a
// detail, and an action on the right.
function PapelizAccountSyncDeviceLine({
  SyncDeviceLineIcon,
  syncDeviceLineTitle,
  syncDeviceLineDetail,
  syncDeviceLineAction,
}: {
  SyncDeviceLineIcon: LucideIcon
  syncDeviceLineTitle: string
  syncDeviceLineDetail: string
  syncDeviceLineAction?: ReactNode
}) {
  return (
    <div className="flex min-h-[58px] items-center gap-3 border-b border-papeliz-line px-3.5 py-2.5 last:border-b-0 md:gap-4 md:px-0 md:py-4 md:last:border-b">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-papeliz-line bg-papeliz-surface-soft">
        <SyncDeviceLineIcon className="size-[18px] text-papeliz-ink-muted" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[14.5px] font-semibold break-words md:text-base">{syncDeviceLineTitle}</h2>
        <p className="mt-0.5 text-[13px] text-pretty text-papeliz-ink-muted md:text-sm">{syncDeviceLineDetail}</p>
      </div>
      {syncDeviceLineAction}
    </div>
  )
}

// The account page's Devices section: every device signed in to Sync, and Remove, which signs one
// out. Its notes stay on it.
export function PapelizAccountDevicesSection({
  papelizAccountSyncService,
  papelizAccountSyncDeviceList,
}: {
  papelizAccountSyncService: PapelizAccountSyncService
  papelizAccountSyncDeviceList: PapelizAccountSyncDeviceList
}) {
  const papelizAccountClerk = useClerk()
  const { getToken } = useAuth()
  const { syncDeviceListStage, loadPapelizAccountSyncDevices, forgetRemovedPapelizAccountSyncDevice } = papelizAccountSyncDeviceList
  const [currentTime] = useState(() => Date.now())
  const [syncDeviceRemoval, setSyncDeviceRemoval] = useState<PapelizAccountSyncDeviceRemoval | null>(null)

  useEffect(() => {
    if (syncDeviceListStage.syncDeviceListStageKind === 'not-loaded') loadPapelizAccountSyncDevices()
  }, [syncDeviceListStage.syncDeviceListStageKind, loadPapelizAccountSyncDevices])

  async function removeChosenPapelizAccountSyncDevice(syncDeviceRecord: PapelizAccountSyncDeviceRecord) {
    const papelizSyncDeviceId = syncDeviceRecord.papelizSyncDeviceId
    // Only while this device's dialog is still open: closing it mid-request leaves the list to the outcome.
    const showSyncDeviceRemovalStage = (nextSyncDeviceRemoval: PapelizAccountSyncDeviceRemoval | null) =>
      setSyncDeviceRemoval((currentSyncDeviceRemoval) =>
        currentSyncDeviceRemoval?.syncDeviceRecord.papelizSyncDeviceId === papelizSyncDeviceId ? nextSyncDeviceRemoval : currentSyncDeviceRemoval,
      )
    showSyncDeviceRemovalStage({ syncDeviceRecord, syncDeviceRemovalStageKind: 'removing' })
    try {
      const papelizAccountSignInToken = await getToken({ skipCache: true })
      if (!papelizAccountSignInToken) {
        showSyncDeviceRemovalStage({ syncDeviceRecord, syncDeviceRemovalStageKind: 'sign-in-ended' })
        return
      }
      const syncDeviceRemovalOutcome = await papelizAccountSyncService.removePapelizSyncDeviceFromSignInPage(papelizAccountSignInToken, papelizSyncDeviceId)
      if (syncDeviceRemovalOutcome.syncDeviceRemovalOutcomeKind === 'removed') {
        forgetRemovedPapelizAccountSyncDevice(papelizSyncDeviceId)
        showSyncDeviceRemovalStage(null)
      } else {
        showSyncDeviceRemovalStage({
          syncDeviceRecord,
          syncDeviceRemovalStageKind: 'failed',
          syncDeviceRemovalFailureMessage: syncDeviceRemovalOutcome.syncDeviceRemovalRefusalMessage,
        })
      }
    } catch {
      showSyncDeviceRemovalStage({ syncDeviceRecord, syncDeviceRemovalStageKind: 'failed', syncDeviceRemovalFailureMessage: papelizAccountSyncUnreachableMessage })
    }
  }

  const listedSyncDeviceRecords = syncDeviceListStage.syncDeviceListStageKind === 'listed' ? syncDeviceListStage.syncDeviceRecords : null
  const syncDeviceRemovalIsRunning = syncDeviceRemoval?.syncDeviceRemovalStageKind === 'removing'

  return (
    <>
      <PapelizAccountSectionIntro>
        {listedSyncDeviceRecords && listedSyncDeviceRecords.length > 0
          ? `${listedSyncDeviceRecords.length} of ${papelizSiteSyncConnectedDeviceLimit} devices signed in to Sync.`
          : 'Devices signed in to Sync.'}{' '}
        Removing one signs it out; its notes stay on it.
      </PapelizAccountSectionIntro>
      <PapelizAccountRowGroup>
        {(syncDeviceListStage.syncDeviceListStageKind === 'not-loaded' || syncDeviceListStage.syncDeviceListStageKind === 'loading') && (
          <div role="status" aria-label="Loading your devices">
            {[0, 1].map((loadingLineIndex) => (
              <div
                key={loadingLineIndex}
                className="flex min-h-[58px] items-center gap-3 border-b border-papeliz-line px-3.5 py-2.5 last:border-b-0 md:gap-4 md:px-0 md:py-4 md:last:border-b"
                aria-hidden="true"
              >
                <span className="size-9 shrink-0 animate-pulse rounded-lg bg-papeliz-surface-gray motion-reduce:animate-none" />
                <div className="grid flex-1 gap-2">
                  <span className="h-3.5 w-32 animate-pulse rounded bg-papeliz-surface-gray motion-reduce:animate-none" />
                  <span className="h-3 w-56 max-w-full animate-pulse rounded bg-papeliz-surface-gray motion-reduce:animate-none" />
                </div>
              </div>
            ))}
          </div>
        )}
        {syncDeviceListStage.syncDeviceListStageKind === 'failed' && (
          <PapelizAccountSyncDeviceLine
            SyncDeviceLineIcon={Laptop}
            syncDeviceLineTitle="Couldn’t load your devices"
            syncDeviceLineDetail={syncDeviceListStage.syncDeviceListFailureMessage}
            syncDeviceLineAction={
              <button type="button" onClick={loadPapelizAccountSyncDevices} className={`${papelizAccountCompactPrimaryButtonClassName} ${papelizAccountRowActionWidthClassName}`}>
                Try again
              </button>
            }
          />
        )}
        {listedSyncDeviceRecords && listedSyncDeviceRecords.length === 0 && (
          <PapelizAccountSyncDeviceLine
            SyncDeviceLineIcon={Laptop}
            syncDeviceLineTitle="No devices signed in"
            syncDeviceLineDetail="A device shows here once you turn on Sync in Papeliz on it."
          />
        )}
        {listedSyncDeviceRecords?.map((syncDeviceRecord) => {
          const { SyncDevicePlatformIcon } = papelizAccountSyncDevicePlatformLabels[syncDeviceRecord.syncDevicePlatform]
          const syncDeviceShownName = namePapelizAccountSyncDevice(syncDeviceRecord)
          return (
            <PapelizAccountSyncDeviceLine
              key={syncDeviceRecord.papelizSyncDeviceId}
              SyncDeviceLineIcon={SyncDevicePlatformIcon}
              syncDeviceLineTitle={syncDeviceShownName}
              syncDeviceLineDetail={describePapelizAccountSyncDevice(syncDeviceRecord, currentTime)}
              syncDeviceLineAction={
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-label={`Remove ${syncDeviceRecord.syncDeviceName === null ? syncDeviceShownName.toLowerCase() : syncDeviceShownName}, ${describePapelizAccountSyncDevice(syncDeviceRecord, currentTime)}`}
                  onClick={() => setSyncDeviceRemoval({ syncDeviceRecord, syncDeviceRemovalStageKind: 'confirming' })}
                  className={`${papelizAccountSecondaryButtonClassName} ${papelizAccountRowActionWidthClassName}`}
                >
                  Remove
                </button>
              }
            />
          )
        })}
      </PapelizAccountRowGroup>
      {syncDeviceRemoval && (
        <PapelizAccountDialog
          papelizAccountDialogTitle={
            syncDeviceRemoval.syncDeviceRemovalStageKind === 'sign-in-ended'
              ? 'Sign In Again to Continue'
              : titlePapelizAccountSyncDeviceRemoval(syncDeviceRemoval.syncDeviceRecord)
          }
          onPapelizAccountDialogClose={() => setSyncDeviceRemoval(null)}
          papelizAccountDialogClosesOnlyFromItsButtons={syncDeviceRemoval.syncDeviceRemovalStageKind === 'sign-in-ended'}
          papelizAccountDialogFooter={
            <>
              <button type="button" disabled={syncDeviceRemovalIsRunning} onClick={() => setSyncDeviceRemoval(null)} className={papelizAccountSecondaryButtonClassName}>
                Cancel
              </button>
              {syncDeviceRemoval.syncDeviceRemovalStageKind === 'sign-in-ended' ? (
                <button
                  type="button"
                  onClick={() => void papelizAccountClerk.signOut({ redirectUrl: papelizAccountPagePath })}
                  className={papelizAccountCompactPrimaryButtonClassName}
                >
                  Sign In Again
                </button>
              ) : (
                <button
                  type="button"
                  disabled={syncDeviceRemovalIsRunning}
                  onClick={() => void removeChosenPapelizAccountSyncDevice(syncDeviceRemoval.syncDeviceRecord)}
                  className={papelizAccountCompactDangerButtonClassName}
                >
                  {syncDeviceRemovalIsRunning ? 'Removing…' : syncDeviceRemoval.syncDeviceRemovalStageKind === 'failed' ? 'Try again' : 'Remove'}
                </button>
              )}
            </>
          }
        >
          {syncDeviceRemoval.syncDeviceRemovalStageKind === 'sign-in-ended' ? (
            <p>Your sign-in on this page has ended. Sign in again, then remove the device.</p>
          ) : (
            <>
              <p>{describePapelizAccountSyncDevice(syncDeviceRemoval.syncDeviceRecord, currentTime)}.</p>
              <p>It signs out of Sync and stops syncing. Its notes stay on it.</p>
            </>
          )}
          {syncDeviceRemoval.syncDeviceRemovalStageKind === 'failed' && (
            <p role="alert" className="text-papeliz-diff-removed-ink">
              {syncDeviceRemoval.syncDeviceRemovalFailureMessage}
            </p>
          )}
        </PapelizAccountDialog>
      )}
    </>
  )
}
