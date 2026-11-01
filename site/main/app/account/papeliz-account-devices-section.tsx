'use client'

import { useAuth, useClerk } from '@clerk/react'
import { ChevronRight, Globe, Laptop, Pencil, Smartphone, Trash2, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { papelizSiteSyncConnectedDeviceLimit } from '@/lib/papeliz-site-sync-plans'
import {
  papelizAccountCompactDangerButtonClassName,
  papelizAccountCompactPrimaryButtonClassName,
  papelizAccountFieldLabelClassName,
  papelizAccountRowActionWidthClassName,
  papelizAccountSecondaryButtonClassName,
  papelizAccountTextFieldClassName,
} from './papeliz-account-card-frame'
import { papelizAccountPagePath } from './papeliz-account-config'
import { PapelizAccountDialog } from './papeliz-account-dialog'
import { PapelizAccountManageMenu, papelizAccountRowActionsDialogButtonClassName } from './papeliz-account-manage-menu'
import { PapelizAccountRowGroup, PapelizAccountSectionIntro } from './papeliz-account-rows'
import {
  papelizAccountSyncDeviceNameMaximumCharacterCount,
  type PapelizAccountSyncDevicePlatform,
  type PapelizAccountSyncDeviceRecord,
  type PapelizAccountSyncService,
} from './papeliz-account-sync-service'
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
  rememberRenamedPapelizAccountSyncDevice: (renamedSyncDeviceRecord: PapelizAccountSyncDeviceRecord) => void
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

  const rememberRenamedPapelizAccountSyncDevice = useCallback((renamedSyncDeviceRecord: PapelizAccountSyncDeviceRecord) => {
    setSyncDeviceListStage((currentSyncDeviceListStage) =>
      currentSyncDeviceListStage.syncDeviceListStageKind === 'listed'
        ? {
            ...currentSyncDeviceListStage,
            syncDeviceRecords: currentSyncDeviceListStage.syncDeviceRecords.map((syncDeviceRecord) =>
              syncDeviceRecord.papelizSyncDeviceId === renamedSyncDeviceRecord.papelizSyncDeviceId ? { ...syncDeviceRecord, syncDeviceName: renamedSyncDeviceRecord.syncDeviceName } : syncDeviceRecord,
            ),
          }
        : currentSyncDeviceListStage,
    )
  }, [])

  return { syncDeviceListStage, loadPapelizAccountSyncDevices, forgetRemovedPapelizAccountSyncDevice, rememberRenamedPapelizAccountSyncDevice }
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

type PapelizAccountSyncDeviceRename = {
  syncDeviceRecord: PapelizAccountSyncDeviceRecord
  syncDeviceRenameStageKind: 'naming' | 'renaming' | 'sign-in-ended' | 'failed'
  syncDeviceRenameFailureMessage?: string
}

// One line of the list, or of its loading, failed and empty states: an icon tile, a title over a
// detail, and an action on the right. A line with `onSyncDeviceLinePhoneTap` is one tap target on a
// phone, with a chevron, and shows its action only on a computer, like a vault's line.
function PapelizAccountSyncDeviceLine({
  SyncDeviceLineIcon,
  syncDeviceLineTitle,
  syncDeviceLineDetail,
  syncDeviceLineAction,
  syncDeviceLinePhoneTapLabel,
  onSyncDeviceLinePhoneTap,
}: {
  SyncDeviceLineIcon: LucideIcon
  syncDeviceLineTitle: string
  syncDeviceLineDetail: string
  syncDeviceLineAction?: ReactNode
  syncDeviceLinePhoneTapLabel?: string
  onSyncDeviceLinePhoneTap?: () => void
}) {
  return (
    <div className="relative flex min-h-[58px] items-center gap-3 border-b border-papeliz-line px-3.5 py-2.5 last:border-b-0 md:gap-4 md:px-0 md:py-4 md:last:border-b">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-papeliz-line bg-papeliz-surface-soft">
        <SyncDeviceLineIcon className="size-[18px] text-papeliz-ink-muted" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[14.5px] font-semibold break-words md:text-base">{syncDeviceLineTitle}</h2>
        <p className="mt-0.5 text-[13px] text-pretty text-papeliz-ink-muted md:text-sm">{syncDeviceLineDetail}</p>
      </div>
      {onSyncDeviceLinePhoneTap ? (
        <>
          <div className="shrink-0 max-md:hidden">{syncDeviceLineAction}</div>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={syncDeviceLinePhoneTapLabel}
            onClick={onSyncDeviceLinePhoneTap}
            className="grid shrink-0 cursor-pointer place-items-center after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-[inherit] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-papeliz-blue md:hidden"
          >
            <ChevronRight className="size-4 text-papeliz-ink-subtle" aria-hidden="true" />
          </button>
        </>
      ) : (
        syncDeviceLineAction
      )}
    </div>
  )
}

// The account page's Devices section: every device signed in to Sync, with Rename and Remove under
// Manage, like a vault's row (Adam, 2026-11-01: "make it Manage too like our Vault with option to
// rename such device"). Remove signs a device out; its notes stay on it.
export function PapelizAccountDevicesSection({
  papelizAccountSyncService,
  papelizAccountSyncDeviceList,
}: {
  papelizAccountSyncService: PapelizAccountSyncService
  papelizAccountSyncDeviceList: PapelizAccountSyncDeviceList
}) {
  const papelizAccountClerk = useClerk()
  const { getToken } = useAuth()
  const { syncDeviceListStage, loadPapelizAccountSyncDevices, forgetRemovedPapelizAccountSyncDevice, rememberRenamedPapelizAccountSyncDevice } = papelizAccountSyncDeviceList
  const [currentTime] = useState(() => Date.now())
  const [syncDeviceRemoval, setSyncDeviceRemoval] = useState<PapelizAccountSyncDeviceRemoval | null>(null)
  const [syncDeviceRename, setSyncDeviceRename] = useState<PapelizAccountSyncDeviceRename | null>(null)
  const [syncDeviceWithActionsOpen, setSyncDeviceWithActionsOpen] = useState<PapelizAccountSyncDeviceRecord | null>(null)
  const [typedSyncDeviceName, setTypedSyncDeviceName] = useState('')
  const syncDeviceNameFieldId = useId()
  const syncDeviceRenameFormId = useId()

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

  async function renameChosenPapelizAccountSyncDevice(syncDeviceRecord: PapelizAccountSyncDeviceRecord, newSyncDeviceName: string) {
    const papelizSyncDeviceId = syncDeviceRecord.papelizSyncDeviceId
    // Only while this device's dialog is still open, as with Remove.
    const showSyncDeviceRenameStage = (nextSyncDeviceRename: PapelizAccountSyncDeviceRename | null) =>
      setSyncDeviceRename((currentSyncDeviceRename) =>
        currentSyncDeviceRename?.syncDeviceRecord.papelizSyncDeviceId === papelizSyncDeviceId ? nextSyncDeviceRename : currentSyncDeviceRename,
      )
    showSyncDeviceRenameStage({ syncDeviceRecord, syncDeviceRenameStageKind: 'renaming' })
    try {
      const papelizAccountSignInToken = await getToken({ skipCache: true })
      if (!papelizAccountSignInToken) {
        showSyncDeviceRenameStage({ syncDeviceRecord, syncDeviceRenameStageKind: 'sign-in-ended' })
        return
      }
      const syncDeviceRenameOutcome = await papelizAccountSyncService.renamePapelizSyncDeviceFromSignInPage(papelizAccountSignInToken, papelizSyncDeviceId, newSyncDeviceName)
      if (syncDeviceRenameOutcome.syncDeviceRenameOutcomeKind === 'renamed') {
        rememberRenamedPapelizAccountSyncDevice(syncDeviceRenameOutcome.syncDeviceRecord)
        showSyncDeviceRenameStage(null)
      } else if (syncDeviceRenameOutcome.syncDeviceRenameOutcomeKind === 'device-gone') {
        forgetRemovedPapelizAccountSyncDevice(papelizSyncDeviceId)
        showSyncDeviceRenameStage(null)
      } else {
        showSyncDeviceRenameStage({
          syncDeviceRecord,
          syncDeviceRenameStageKind: 'failed',
          syncDeviceRenameFailureMessage: syncDeviceRenameOutcome.syncDeviceRenameRefusalMessage,
        })
      }
    } catch {
      showSyncDeviceRenameStage({ syncDeviceRecord, syncDeviceRenameStageKind: 'failed', syncDeviceRenameFailureMessage: papelizAccountSyncUnreachableMessage })
    }
  }

  function openPapelizAccountSyncDeviceRename(syncDeviceRecord: PapelizAccountSyncDeviceRecord) {
    setTypedSyncDeviceName(syncDeviceRecord.syncDeviceName ?? '')
    setSyncDeviceRename({ syncDeviceRecord, syncDeviceRenameStageKind: 'naming' })
  }

  const listedSyncDeviceRecords = syncDeviceListStage.syncDeviceListStageKind === 'listed' ? syncDeviceListStage.syncDeviceRecords : null
  const syncDeviceRemovalIsRunning = syncDeviceRemoval?.syncDeviceRemovalStageKind === 'removing'
  const syncDeviceRenameIsRunning = syncDeviceRename?.syncDeviceRenameStageKind === 'renaming'
  const newSyncDeviceName = typedSyncDeviceName.trim()
  const newSyncDeviceNameIsUnchanged = newSyncDeviceName === (syncDeviceRename?.syncDeviceRecord.syncDeviceName ?? '')

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
          const syncDeviceDetail = describePapelizAccountSyncDevice(syncDeviceRecord, currentTime)
          return (
            <PapelizAccountSyncDeviceLine
              key={syncDeviceRecord.papelizSyncDeviceId}
              SyncDeviceLineIcon={SyncDevicePlatformIcon}
              syncDeviceLineTitle={syncDeviceShownName}
              syncDeviceLineDetail={syncDeviceDetail}
              syncDeviceLinePhoneTapLabel={`${syncDeviceShownName}, ${syncDeviceDetail}: Rename or Remove`}
              onSyncDeviceLinePhoneTap={() => setSyncDeviceWithActionsOpen(syncDeviceRecord)}
              syncDeviceLineAction={
                <PapelizAccountManageMenu
                  manageMenuLabel={`Manage ${syncDeviceShownName}`}
                  manageMenuChoices={[
                    { manageMenuChoiceLabel: 'Rename', ManageMenuChoiceIcon: Pencil, onManageMenuChoose: () => openPapelizAccountSyncDeviceRename(syncDeviceRecord) },
                    {
                      manageMenuChoiceLabel: 'Remove',
                      ManageMenuChoiceIcon: Trash2,
                      manageMenuChoiceIsDanger: true,
                      onManageMenuChoose: () => setSyncDeviceRemoval({ syncDeviceRecord, syncDeviceRemovalStageKind: 'confirming' }),
                    },
                  ]}
                />
              }
            />
          )
        })}
      </PapelizAccountRowGroup>
      {/* A phone's tap on a row: the device, when it last synced, and Rename and Remove. */}
      {syncDeviceWithActionsOpen && (
        <PapelizAccountDialog
          papelizAccountDialogTitle={namePapelizAccountSyncDevice(syncDeviceWithActionsOpen)}
          onPapelizAccountDialogClose={() => setSyncDeviceWithActionsOpen(null)}
          papelizAccountDialogFooter={
            <button type="button" onClick={() => setSyncDeviceWithActionsOpen(null)} className={papelizAccountSecondaryButtonClassName}>
              Close
            </button>
          }
        >
          <p>{describePapelizAccountSyncDevice(syncDeviceWithActionsOpen, currentTime)}.</p>
          <div className="mt-1 grid gap-2">
            <button
              type="button"
              onClick={() => {
                setSyncDeviceWithActionsOpen(null)
                openPapelizAccountSyncDeviceRename(syncDeviceWithActionsOpen)
              }}
              className={`${papelizAccountRowActionsDialogButtonClassName} text-papeliz-ink`}
            >
              <Pencil className="size-[18px] shrink-0 text-papeliz-ink-muted" aria-hidden="true" />
              Rename
            </button>
            <button
              type="button"
              onClick={() => {
                setSyncDeviceWithActionsOpen(null)
                setSyncDeviceRemoval({ syncDeviceRecord: syncDeviceWithActionsOpen, syncDeviceRemovalStageKind: 'confirming' })
              }}
              className={`${papelizAccountRowActionsDialogButtonClassName} text-papeliz-diff-removed-ink`}
            >
              <Trash2 className="size-[18px] shrink-0" aria-hidden="true" />
              Remove
            </button>
          </div>
        </PapelizAccountDialog>
      )}
      {syncDeviceRename && (
        <PapelizAccountDialog
          papelizAccountDialogTitle={syncDeviceRename.syncDeviceRenameStageKind === 'sign-in-ended' ? 'Sign In Again to Continue' : 'Rename Device'}
          onPapelizAccountDialogClose={() => {
            if (!syncDeviceRenameIsRunning) setSyncDeviceRename(null)
          }}
          papelizAccountDialogClosesOnlyFromItsButtons={syncDeviceRename.syncDeviceRenameStageKind === 'sign-in-ended'}
          papelizAccountDialogFooter={
            <>
              <button type="button" disabled={syncDeviceRenameIsRunning} onClick={() => setSyncDeviceRename(null)} className={papelizAccountSecondaryButtonClassName}>
                Cancel
              </button>
              {syncDeviceRename.syncDeviceRenameStageKind === 'sign-in-ended' ? (
                <button
                  type="button"
                  onClick={() => void papelizAccountClerk.signOut({ redirectUrl: papelizAccountPagePath })}
                  className={papelizAccountCompactPrimaryButtonClassName}
                >
                  Sign In Again
                </button>
              ) : (
                <button
                  type="submit"
                  form={syncDeviceRenameFormId}
                  disabled={syncDeviceRenameIsRunning || !newSyncDeviceName || newSyncDeviceNameIsUnchanged}
                  className={papelizAccountCompactPrimaryButtonClassName}
                >
                  {syncDeviceRenameIsRunning ? 'Saving…' : syncDeviceRename.syncDeviceRenameStageKind === 'failed' ? 'Try Again' : 'Save'}
                </button>
              )}
            </>
          }
        >
          {syncDeviceRename.syncDeviceRenameStageKind === 'sign-in-ended' ? (
            <p>Your sign-in on this page has ended. Sign in again, then rename the device.</p>
          ) : (
            <>
              <p>A name you’ll recognize, like Work laptop.</p>
              <form
                id={syncDeviceRenameFormId}
                noValidate
                onSubmit={(renameSubmitEvent: FormEvent) => {
                  renameSubmitEvent.preventDefault()
                  if (syncDeviceRenameIsRunning || !newSyncDeviceName || newSyncDeviceNameIsUnchanged) return
                  void renameChosenPapelizAccountSyncDevice(syncDeviceRename.syncDeviceRecord, newSyncDeviceName)
                }}
              >
                <label htmlFor={syncDeviceNameFieldId} className={papelizAccountFieldLabelClassName}>
                  Name
                </label>
                <input
                  id={syncDeviceNameFieldId}
                  type="text"
                  required
                  autoFocus
                  autoComplete="off"
                  maxLength={papelizAccountSyncDeviceNameMaximumCharacterCount}
                  placeholder={papelizAccountSyncDevicePlatformLabels[syncDeviceRename.syncDeviceRecord.syncDevicePlatform].syncDevicePlatformName}
                  value={typedSyncDeviceName}
                  disabled={syncDeviceRenameIsRunning}
                  onChange={(nameChangeEvent) => setTypedSyncDeviceName(nameChangeEvent.target.value)}
                  className={`${papelizAccountTextFieldClassName} disabled:opacity-60`}
                />
              </form>
            </>
          )}
          {syncDeviceRename.syncDeviceRenameStageKind === 'failed' && (
            <p role="alert" className="text-papeliz-diff-removed-ink">
              {syncDeviceRename.syncDeviceRenameFailureMessage}
            </p>
          )}
        </PapelizAccountDialog>
      )}
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
