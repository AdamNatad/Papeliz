'use client'

import { useAuth, useClerk, useSession } from '@clerk/react'
import { ChevronRight, Cloud, KeyRound, Lock, Trash2, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type Ref } from 'react'
import { PapelizSitePillSwitch } from '@/components/controls/papeliz-site-pill-switch'
import {
  papelizAccountCompactDangerButtonClassName,
  papelizAccountCompactPrimaryButtonClassName,
  papelizAccountFieldLabelClassName,
  papelizAccountRowActionWidthClassName,
  papelizAccountSecondaryButtonClassName,
  papelizAccountTextFieldClassName,
} from './papeliz-account-card-frame'
import { isPapelizAccountSignInFresh, papelizAccountChangePassphraseAfterSignInParameterName, papelizAccountPagePath } from './papeliz-account-config'
import { papelizAccountSyncUnreachableMessage } from './papeliz-account-devices-section'
import { PapelizAccountDialog } from './papeliz-account-dialog'
import { PapelizAccountRowGroup, PapelizAccountSectionIntro } from './papeliz-account-rows'
import type { PapelizAccountSyncService, PapelizAccountSyncVaultEncryptionKind, PapelizAccountSyncVaultRecord } from './papeliz-account-sync-service'
import { rewrapPapelizAccountSyncVaultKeyOffMainThread } from './papeliz-account-sync-vault-key-rewrap-client'
import {
  isPapelizAccountSyncPassphraseLongEnough,
  normalizePapelizAccountSyncPassphrase,
  PapelizAccountSyncVaultKeyWrapError,
  papelizAccountSyncMinimumPassphraseCharacterCount,
} from './papeliz-account-sync-vault-key-wrap'
import { describePapelizAccountPastDay } from './papeliz-account-time-descriptions'

// The account page's Vaults section (Adam, 2026-11-01: rows like Devices, under a Standard /
// End-to-end tab switch; "on our account page just call them Vaults"): every vault synced with
// Papeliz Sync, Delete from Sync on each, and Change Passphrase on an End-to-end one, which runs in
// this browser. The passphrases never leave it.

export type PapelizAccountSyncVaultListStage =
  | { syncVaultListStageKind: 'not-loaded' }
  | { syncVaultListStageKind: 'loading' }
  | { syncVaultListStageKind: 'listed'; papelizSyncAccountId: string | null; syncVaultRecords: PapelizAccountSyncVaultRecord[] }
  | { syncVaultListStageKind: 'failed'; syncVaultListFailureMessage: string }

// The one dialog the section has open. `actions` is a phone's: a tap on a row opens the vault's
// actions, as the chevron rows elsewhere on the page do.
export type PapelizAccountSyncVaultDialogChoice = { syncVaultDialogKind: 'actions' | 'change-passphrase' | 'delete'; papelizSyncVaultId: string }

export interface PapelizAccountSyncedVaults {
  syncVaultListStage: PapelizAccountSyncVaultListStage
  loadPapelizAccountSyncVaults: () => void
  forgetDeletedPapelizAccountSyncVault: (papelizSyncVaultId: string) => void
  replaceChangedPapelizAccountSyncVault: (changedSyncVaultRecord: PapelizAccountSyncVaultRecord) => void
  chosenSyncVaultEncryptionKind: PapelizAccountSyncVaultEncryptionKind
  chooseSyncVaultEncryptionKind: (syncVaultEncryptionKind: PapelizAccountSyncVaultEncryptionKind) => void
  syncVaultDialogChoice: PapelizAccountSyncVaultDialogChoice | null
  chooseSyncVaultDialog: (syncVaultDialogChoice: PapelizAccountSyncVaultDialogChoice | null) => void
}

// Held by the dashboard, which shows the section twice (a computer's layout and a phone's): the list
// loads once, the tab stays the same in both, and the dialogs show once. Change Passphrase's sign-in
// again comes back with the vault's ID, and its dialog opens again on the End-to-end tab.
export function usePapelizAccountSyncedVaults(
  papelizAccountSyncService: PapelizAccountSyncService,
  papelizSyncVaultIdToChangePassphraseAfterSignIn: string | null,
): PapelizAccountSyncedVaults {
  const { getToken } = useAuth()
  const [syncVaultListStage, setSyncVaultListStage] = useState<PapelizAccountSyncVaultListStage>({ syncVaultListStageKind: 'not-loaded' })
  const [chosenSyncVaultEncryptionKind, chooseSyncVaultEncryptionKind] = useState<PapelizAccountSyncVaultEncryptionKind>(
    papelizSyncVaultIdToChangePassphraseAfterSignIn ? 'end-to-end' : 'standard',
  )
  const [syncVaultDialogChoice, chooseSyncVaultDialog] = useState<PapelizAccountSyncVaultDialogChoice | null>(
    papelizSyncVaultIdToChangePassphraseAfterSignIn ? { syncVaultDialogKind: 'change-passphrase', papelizSyncVaultId: papelizSyncVaultIdToChangePassphraseAfterSignIn } : null,
  )
  const syncVaultListRequestIsRunningRef = useRef(false)

  const loadPapelizAccountSyncVaults = useCallback(() => {
    if (syncVaultListRequestIsRunningRef.current) return
    syncVaultListRequestIsRunningRef.current = true
    setSyncVaultListStage({ syncVaultListStageKind: 'loading' })
    void (async () => {
      try {
        const papelizAccountSignInToken = await getToken({ skipCache: true })
        if (!papelizAccountSignInToken) {
          setSyncVaultListStage({ syncVaultListStageKind: 'failed', syncVaultListFailureMessage: 'Sign in again to see your vaults.' })
          return
        }
        const syncVaultListOutcome = await papelizAccountSyncService.listPapelizSyncVaults(papelizAccountSignInToken)
        setSyncVaultListStage(
          syncVaultListOutcome.syncVaultListOutcomeKind === 'listed'
            ? {
                syncVaultListStageKind: 'listed',
                papelizSyncAccountId: syncVaultListOutcome.papelizSyncAccountId,
                syncVaultRecords: [...syncVaultListOutcome.syncVaultRecords].sort((firstSyncVaultRecord, secondSyncVaultRecord) =>
                  firstSyncVaultRecord.syncVaultName.localeCompare(secondSyncVaultRecord.syncVaultName, 'en', { sensitivity: 'base', numeric: true }),
                ),
              }
            : { syncVaultListStageKind: 'failed', syncVaultListFailureMessage: syncVaultListOutcome.syncVaultListRefusalMessage },
        )
      } catch {
        setSyncVaultListStage({ syncVaultListStageKind: 'failed', syncVaultListFailureMessage: papelizAccountSyncUnreachableMessage })
      } finally {
        syncVaultListRequestIsRunningRef.current = false
      }
    })()
  }, [getToken, papelizAccountSyncService])

  const forgetDeletedPapelizAccountSyncVault = useCallback((papelizSyncVaultId: string) => {
    setSyncVaultListStage((currentSyncVaultListStage) =>
      currentSyncVaultListStage.syncVaultListStageKind === 'listed'
        ? {
            ...currentSyncVaultListStage,
            syncVaultRecords: currentSyncVaultListStage.syncVaultRecords.filter((syncVaultRecord) => syncVaultRecord.papelizSyncVaultId !== papelizSyncVaultId),
          }
        : currentSyncVaultListStage,
    )
  }, [])

  const replaceChangedPapelizAccountSyncVault = useCallback((changedSyncVaultRecord: PapelizAccountSyncVaultRecord) => {
    setSyncVaultListStage((currentSyncVaultListStage) =>
      currentSyncVaultListStage.syncVaultListStageKind === 'listed'
        ? {
            ...currentSyncVaultListStage,
            syncVaultRecords: currentSyncVaultListStage.syncVaultRecords.map((syncVaultRecord) =>
              syncVaultRecord.papelizSyncVaultId === changedSyncVaultRecord.papelizSyncVaultId ? changedSyncVaultRecord : syncVaultRecord,
            ),
          }
        : currentSyncVaultListStage,
    )
  }, [])

  return {
    syncVaultListStage,
    loadPapelizAccountSyncVaults,
    forgetDeletedPapelizAccountSyncVault,
    replaceChangedPapelizAccountSyncVault,
    chosenSyncVaultEncryptionKind,
    chooseSyncVaultEncryptionKind,
    syncVaultDialogChoice,
    chooseSyncVaultDialog,
  }
}

// Each kind's tab, row icon, and one line on who holds the key, for the tab's vaults and for one.
const papelizAccountSyncVaultEncryptionKindLabels: Record<
  PapelizAccountSyncVaultEncryptionKind,
  {
    syncVaultEncryptionKindName: string
    SyncVaultEncryptionKindIcon: LucideIcon
    syncVaultEncryptionKindExplanation: string
    syncVaultEncryptionKindExplanationForOneVault: string
    syncVaultEncryptionKindEmptyText: string
  }
> = {
  standard: {
    syncVaultEncryptionKindName: 'Standard',
    SyncVaultEncryptionKindIcon: Cloud,
    syncVaultEncryptionKindExplanation: 'No passphrase. Papeliz keeps their key, so they open on any device you sign in on.',
    syncVaultEncryptionKindExplanationForOneVault: 'No passphrase. Papeliz keeps its key, so it opens on any device you sign in on.',
    syncVaultEncryptionKindEmptyText: 'A vault shows here once you turn on Sync for it in Papeliz and choose Standard.',
  },
  'end-to-end': {
    syncVaultEncryptionKindName: 'End-to-end',
    SyncVaultEncryptionKindIcon: Lock,
    syncVaultEncryptionKindExplanation: 'Each has its own passphrase, which Papeliz never receives and can’t recover.',
    syncVaultEncryptionKindExplanationForOneVault: 'It has its own passphrase, which Papeliz never receives and can’t recover.',
    syncVaultEncryptionKindEmptyText: 'A vault shows here once you turn on Sync for it in Papeliz and choose End-to-end.',
  },
}

const papelizAccountSyncVaultEncryptionKinds: readonly PapelizAccountSyncVaultEncryptionKind[] = ['standard', 'end-to-end']

const papelizAccountSyncVaultByteSizeUnits = ['KB', 'MB', 'GB', 'TB'] as const

// "2.3 KB", "4.2 MB", "18 MB", in steps of 1,000.
function describePapelizAccountSyncVaultByteSize(syncVaultStoredByteLength: number): string {
  if (syncVaultStoredByteLength < 1000) return `${syncVaultStoredByteLength} ${syncVaultStoredByteLength === 1 ? 'byte' : 'bytes'}`
  let syncVaultByteSize = syncVaultStoredByteLength / 1000
  let syncVaultByteSizeUnitIndex = 0
  while (syncVaultByteSize >= 999.5 && syncVaultByteSizeUnitIndex < papelizAccountSyncVaultByteSizeUnits.length - 1) {
    syncVaultByteSize /= 1000
    syncVaultByteSizeUnitIndex += 1
  }
  const syncVaultByteSizeNumberText = new Intl.NumberFormat('en', { maximumFractionDigits: syncVaultByteSize < 10 ? 1 : 0 }).format(syncVaultByteSize)
  return `${syncVaultByteSizeNumberText} ${papelizAccountSyncVaultByteSizeUnits[syncVaultByteSizeUnitIndex]}`
}

// "128 files · 4.2 MB · Syncing since Oct 2". Sync keeps no last-sync time for a vault, only when it
// was made.
function describePapelizAccountSyncVault(syncVaultRecord: PapelizAccountSyncVaultRecord, currentTime: number): string {
  const syncVaultFileCountText = `${syncVaultRecord.syncVaultFileCount.toLocaleString('en-US')} ${syncVaultRecord.syncVaultFileCount === 1 ? 'file' : 'files'}`
  const syncVaultByteSizeText = describePapelizAccountSyncVaultByteSize(syncVaultRecord.syncVaultStoredByteLength)
  return `${syncVaultFileCountText} · ${syncVaultByteSizeText} · Syncing since ${describePapelizAccountPastDay(syncVaultRecord.syncVaultCreatedAt, currentTime)}`
}

// One line of the list, or of its loading, failed and empty states: an icon tile, a title over a
// detail, and the actions on the right. A line with `onSyncVaultLinePhoneTap` is one tap target on a
// phone, with a chevron, and shows its actions only on a computer.
function PapelizAccountSyncVaultLine({
  SyncVaultLineIcon,
  syncVaultLineTitle,
  syncVaultLineDetail,
  syncVaultLineActions,
  syncVaultLinePhoneTapLabel,
  onSyncVaultLinePhoneTap,
}: {
  SyncVaultLineIcon: LucideIcon
  syncVaultLineTitle: string
  syncVaultLineDetail: string
  syncVaultLineActions?: ReactNode
  syncVaultLinePhoneTapLabel?: string
  onSyncVaultLinePhoneTap?: () => void
}) {
  return (
    <div className="relative flex min-h-[58px] items-center gap-3 border-b border-papeliz-line px-3.5 py-2.5 last:border-b-0 md:gap-4 md:px-0 md:py-4 md:last:border-b">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-papeliz-line bg-papeliz-surface-soft">
        <SyncVaultLineIcon className="size-[18px] text-papeliz-ink-muted" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[14.5px] font-semibold break-words md:text-base">{syncVaultLineTitle}</h2>
        <p className="mt-0.5 text-[13px] text-pretty text-papeliz-ink-muted md:text-sm">{syncVaultLineDetail}</p>
      </div>
      {onSyncVaultLinePhoneTap ? (
        <>
          <div className="flex shrink-0 items-center gap-2 max-md:hidden">{syncVaultLineActions}</div>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={syncVaultLinePhoneTapLabel}
            onClick={onSyncVaultLinePhoneTap}
            className="grid shrink-0 cursor-pointer place-items-center after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-[inherit] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-papeliz-blue md:hidden"
          >
            <ChevronRight className="size-4 text-papeliz-ink-subtle" aria-hidden="true" />
          </button>
        </>
      ) : (
        syncVaultLineActions
      )}
    </div>
  )
}

export function PapelizAccountSyncedVaultsSection({ papelizAccountSyncedVaults }: { papelizAccountSyncedVaults: PapelizAccountSyncedVaults }) {
  const { syncVaultListStage, loadPapelizAccountSyncVaults, chosenSyncVaultEncryptionKind, chooseSyncVaultEncryptionKind, chooseSyncVaultDialog } =
    papelizAccountSyncedVaults
  const [currentTime] = useState(() => Date.now())
  const syncVaultTabIdPrefix = useId()

  useEffect(() => {
    if (syncVaultListStage.syncVaultListStageKind === 'not-loaded') loadPapelizAccountSyncVaults()
  }, [syncVaultListStage.syncVaultListStageKind, loadPapelizAccountSyncVaults])

  const listedSyncVaultRecords = syncVaultListStage.syncVaultListStageKind === 'listed' ? syncVaultListStage.syncVaultRecords : null
  const chosenSyncVaultRecords = listedSyncVaultRecords?.filter((syncVaultRecord) => syncVaultRecord.syncVaultEncryptionKind === chosenSyncVaultEncryptionKind) ?? null
  const chosenSyncVaultEncryptionKindLabels = papelizAccountSyncVaultEncryptionKindLabels[chosenSyncVaultEncryptionKind]

  return (
    <>
      <PapelizAccountSectionIntro>The vaults synced to your account. Deleting one from Sync leaves its notes on your devices.</PapelizAccountSectionIntro>
      {/* The site's pill switch, as tabs, with its bounce (Adam, 2026-11-01: "standard to end to end
          swatch on accounts should have our swatch bounce animation"). */}
      <div className="mb-3 md:mt-4 md:mb-1 md:w-[340px]">
        <PapelizSitePillSwitch
          papelizSitePillSwitchLabel="Kind of vault"
          papelizSitePillSwitchVariant="compact"
          papelizSitePillSwitchOptionWidths="equal"
          papelizSitePillSwitchRole={{
            papelizSitePillSwitchRoleKind: 'tabs',
            papelizSitePillSwitchTabIdPrefix: syncVaultTabIdPrefix,
            papelizSitePillSwitchTabPanelId: `${syncVaultTabIdPrefix}-panel`,
          }}
          papelizSitePillSwitchChosenValue={chosenSyncVaultEncryptionKind}
          onPapelizSitePillSwitchChoose={chooseSyncVaultEncryptionKind}
          papelizSitePillSwitchOptions={papelizAccountSyncVaultEncryptionKinds.map((syncVaultEncryptionKind) => {
            const { syncVaultEncryptionKindName, SyncVaultEncryptionKindIcon } = papelizAccountSyncVaultEncryptionKindLabels[syncVaultEncryptionKind]
            const syncVaultKindCount = listedSyncVaultRecords?.filter((syncVaultRecord) => syncVaultRecord.syncVaultEncryptionKind === syncVaultEncryptionKind).length
            return {
              papelizSitePillSwitchOptionValue: syncVaultEncryptionKind,
              papelizSitePillSwitchOptionLabel: (
                <>
                  <SyncVaultEncryptionKindIcon className="size-[15px] shrink-0" aria-hidden="true" />
                  {syncVaultEncryptionKindName}
                </>
              ),
              // The count follows the option's color: white over the pill, muted beside it.
              papelizSitePillSwitchOptionExtra:
                syncVaultKindCount === undefined ? undefined : (
                  <span
                    className={`min-w-5 rounded-full px-1.5 text-center text-[11.5px] leading-[18px] tabular-nums transition-colors duration-300 motion-reduce:transition-none ${
                      syncVaultEncryptionKind === chosenSyncVaultEncryptionKind ? 'bg-white/20' : 'bg-papeliz-surface'
                    }`}
                  >
                    <span className="sr-only">, </span>
                    {syncVaultKindCount}
                    <span className="sr-only">{syncVaultKindCount === 1 ? ' vault' : ' vaults'}</span>
                  </span>
                ),
            }
          })}
        />
      </div>
      <div role="tabpanel" id={`${syncVaultTabIdPrefix}-panel`} aria-labelledby={`${syncVaultTabIdPrefix}-${chosenSyncVaultEncryptionKind}-tab`}>
        <p className="mb-3 px-0.5 text-[13px] text-pretty text-papeliz-ink-muted md:mt-3 md:mb-0 md:px-0 md:text-sm">
          {chosenSyncVaultEncryptionKindLabels.syncVaultEncryptionKindExplanation}
        </p>
        <PapelizAccountRowGroup>
          {(syncVaultListStage.syncVaultListStageKind === 'not-loaded' || syncVaultListStage.syncVaultListStageKind === 'loading') && (
            <div role="status" aria-label="Loading your vaults">
              {[0, 1].map((loadingLineIndex) => (
                <div
                  key={loadingLineIndex}
                  className="flex min-h-[58px] items-center gap-3 border-b border-papeliz-line px-3.5 py-2.5 last:border-b-0 md:gap-4 md:px-0 md:py-4 md:last:border-b"
                  aria-hidden="true"
                >
                  <span className="size-9 shrink-0 animate-pulse rounded-lg bg-papeliz-surface-gray motion-reduce:animate-none" />
                  <div className="grid flex-1 gap-2">
                    <span className="h-3.5 w-28 animate-pulse rounded bg-papeliz-surface-gray motion-reduce:animate-none" />
                    <span className="h-3 w-60 max-w-full animate-pulse rounded bg-papeliz-surface-gray motion-reduce:animate-none" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {syncVaultListStage.syncVaultListStageKind === 'failed' && (
            <PapelizAccountSyncVaultLine
              SyncVaultLineIcon={chosenSyncVaultEncryptionKindLabels.SyncVaultEncryptionKindIcon}
              syncVaultLineTitle="Couldn’t load your vaults"
              syncVaultLineDetail={syncVaultListStage.syncVaultListFailureMessage}
              syncVaultLineActions={
                <button type="button" onClick={loadPapelizAccountSyncVaults} className={`${papelizAccountCompactPrimaryButtonClassName} ${papelizAccountRowActionWidthClassName}`}>
                  Try Again
                </button>
              }
            />
          )}
          {/* No vault at all, or none of this tab's kind. */}
          {chosenSyncVaultRecords && chosenSyncVaultRecords.length === 0 && (
            <PapelizAccountSyncVaultLine
              SyncVaultLineIcon={chosenSyncVaultEncryptionKindLabels.SyncVaultEncryptionKindIcon}
              syncVaultLineTitle={listedSyncVaultRecords?.length === 0 ? 'No vaults synced yet' : `No ${chosenSyncVaultEncryptionKindLabels.syncVaultEncryptionKindName} vaults`}
              syncVaultLineDetail={
                listedSyncVaultRecords?.length === 0
                  ? 'A vault shows here once you turn on Sync for it in Papeliz.'
                  : chosenSyncVaultEncryptionKindLabels.syncVaultEncryptionKindEmptyText
              }
            />
          )}
          {chosenSyncVaultRecords?.map((syncVaultRecord) => {
            const syncVaultIsEndToEnd = syncVaultRecord.syncVaultEncryptionKind === 'end-to-end'
            const syncVaultDetail = describePapelizAccountSyncVault(syncVaultRecord, currentTime)
            const papelizSyncVaultId = syncVaultRecord.papelizSyncVaultId
            return (
              <PapelizAccountSyncVaultLine
                key={papelizSyncVaultId}
                SyncVaultLineIcon={chosenSyncVaultEncryptionKindLabels.SyncVaultEncryptionKindIcon}
                syncVaultLineTitle={syncVaultRecord.syncVaultName}
                syncVaultLineDetail={syncVaultDetail}
                syncVaultLinePhoneTapLabel={`${syncVaultRecord.syncVaultName}, ${syncVaultDetail}: ${syncVaultIsEndToEnd ? 'Change Passphrase or Delete from Sync' : 'Delete from Sync'}`}
                onSyncVaultLinePhoneTap={() => chooseSyncVaultDialog({ syncVaultDialogKind: 'actions', papelizSyncVaultId })}
                syncVaultLineActions={
                  <>
                    {syncVaultIsEndToEnd && (
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        aria-label={`Change Passphrase for ${syncVaultRecord.syncVaultName}`}
                        onClick={() => chooseSyncVaultDialog({ syncVaultDialogKind: 'change-passphrase', papelizSyncVaultId })}
                        className={papelizAccountSecondaryButtonClassName}
                      >
                        Change Passphrase
                      </button>
                    )}
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      aria-label={`Delete ${syncVaultRecord.syncVaultName} from Sync`}
                      onClick={() => chooseSyncVaultDialog({ syncVaultDialogKind: 'delete', papelizSyncVaultId })}
                      className={`${papelizAccountCompactDangerButtonClassName} ${papelizAccountRowActionWidthClassName}`}
                    >
                      Delete from Sync
                    </button>
                  </>
                }
              />
            )
          })}
        </PapelizAccountRowGroup>
      </div>
    </>
  )
}

// The dialogs, shown once by the dashboard for whichever layout opened them ---------------------------

export function PapelizAccountSyncedVaultsDialogs({
  papelizAccountSyncService,
  papelizAccountSyncedVaults,
}: {
  papelizAccountSyncService: PapelizAccountSyncService
  papelizAccountSyncedVaults: PapelizAccountSyncedVaults
}) {
  const { syncVaultListStage, syncVaultDialogChoice, chooseSyncVaultDialog } = papelizAccountSyncedVaults
  const [currentTime] = useState(() => Date.now())
  const chosenSyncVaultRecord =
    syncVaultListStage.syncVaultListStageKind === 'listed' && syncVaultDialogChoice
      ? syncVaultListStage.syncVaultRecords.find((syncVaultRecord) => syncVaultRecord.papelizSyncVaultId === syncVaultDialogChoice.papelizSyncVaultId)
      : undefined

  // A vault that left the list (deleted elsewhere, or a sign-in again that named one no longer
  // synced) closes its dialog.
  const syncVaultListIsSettled = syncVaultListStage.syncVaultListStageKind === 'listed' || syncVaultListStage.syncVaultListStageKind === 'failed'
  useEffect(() => {
    if (syncVaultDialogChoice && syncVaultListIsSettled && !chosenSyncVaultRecord) chooseSyncVaultDialog(null)
  }, [syncVaultDialogChoice, syncVaultListIsSettled, chosenSyncVaultRecord, chooseSyncVaultDialog])

  if (!syncVaultDialogChoice || !chosenSyncVaultRecord || syncVaultListStage.syncVaultListStageKind !== 'listed') return null
  const closeSyncVaultDialog = () => chooseSyncVaultDialog(null)
  if (syncVaultDialogChoice.syncVaultDialogKind === 'actions') {
    return (
      <PapelizAccountSyncVaultActionsDialog
        key={`actions-${chosenSyncVaultRecord.papelizSyncVaultId}`}
        syncVaultRecord={chosenSyncVaultRecord}
        syncVaultDetail={describePapelizAccountSyncVault(chosenSyncVaultRecord, currentTime)}
        chooseSyncVaultDialog={chooseSyncVaultDialog}
      />
    )
  }
  if (syncVaultDialogChoice.syncVaultDialogKind === 'change-passphrase' && chosenSyncVaultRecord.syncVaultEncryptionKind === 'end-to-end') {
    return (
      <PapelizAccountSyncVaultPassphraseChangeDialog
        key={`change-passphrase-${chosenSyncVaultRecord.papelizSyncVaultId}`}
        papelizAccountSyncService={papelizAccountSyncService}
        papelizSyncAccountId={syncVaultListStage.papelizSyncAccountId}
        syncVaultRecord={chosenSyncVaultRecord}
        papelizAccountSyncedVaults={papelizAccountSyncedVaults}
        closeSyncVaultDialog={closeSyncVaultDialog}
      />
    )
  }
  if (syncVaultDialogChoice.syncVaultDialogKind === 'delete') {
    return (
      <PapelizAccountSyncVaultDeletionDialog
        key={`delete-${chosenSyncVaultRecord.papelizSyncVaultId}`}
        papelizAccountSyncService={papelizAccountSyncService}
        syncVaultRecord={chosenSyncVaultRecord}
        papelizAccountSyncedVaults={papelizAccountSyncedVaults}
        closeSyncVaultDialog={closeSyncVaultDialog}
      />
    )
  }
  return null
}

const papelizAccountSyncVaultActionButtonClassName =
  'flex min-h-[48px] w-full cursor-pointer items-center gap-3 rounded-[10px] border border-papeliz-line bg-papeliz-surface px-3.5 text-left text-[14.5px] font-semibold transition-colors hover:bg-papeliz-surface-soft active:bg-papeliz-press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-blue'

// A phone's tap on a row: the vault, what it holds, and its actions.
function PapelizAccountSyncVaultActionsDialog({
  syncVaultRecord,
  syncVaultDetail,
  chooseSyncVaultDialog,
}: {
  syncVaultRecord: PapelizAccountSyncVaultRecord
  syncVaultDetail: string
  chooseSyncVaultDialog: (syncVaultDialogChoice: PapelizAccountSyncVaultDialogChoice | null) => void
}) {
  const { syncVaultEncryptionKindName, syncVaultEncryptionKindExplanationForOneVault } = papelizAccountSyncVaultEncryptionKindLabels[syncVaultRecord.syncVaultEncryptionKind]
  const papelizSyncVaultId = syncVaultRecord.papelizSyncVaultId
  return (
    <PapelizAccountDialog
      papelizAccountDialogTitle={syncVaultRecord.syncVaultName}
      onPapelizAccountDialogClose={() => chooseSyncVaultDialog(null)}
      papelizAccountDialogFooter={
        <button type="button" onClick={() => chooseSyncVaultDialog(null)} className={papelizAccountSecondaryButtonClassName}>
          Close
        </button>
      }
    >
      <p>
        <span className="font-semibold text-papeliz-ink">{syncVaultEncryptionKindName}</span> · {syncVaultDetail}
      </p>
      <p>{syncVaultEncryptionKindExplanationForOneVault}</p>
      <div className="mt-1 grid gap-2">
        {syncVaultRecord.syncVaultEncryptionKind === 'end-to-end' && (
          <button
            type="button"
            onClick={() => chooseSyncVaultDialog({ syncVaultDialogKind: 'change-passphrase', papelizSyncVaultId })}
            className={`${papelizAccountSyncVaultActionButtonClassName} text-papeliz-ink`}
          >
            <KeyRound className="size-[18px] shrink-0 text-papeliz-ink-muted" aria-hidden="true" />
            Change Passphrase
          </button>
        )}
        <button
          type="button"
          onClick={() => chooseSyncVaultDialog({ syncVaultDialogKind: 'delete', papelizSyncVaultId })}
          className={`${papelizAccountSyncVaultActionButtonClassName} text-papeliz-diff-removed-ink`}
        >
          <Trash2 className="size-[18px] shrink-0" aria-hidden="true" />
          Delete from Sync
        </button>
      </div>
    </PapelizAccountDialog>
  )
}

function PapelizAccountSyncVaultPassphraseField({
  syncVaultPassphraseFieldLabel,
  syncVaultPassphraseFieldValue,
  onSyncVaultPassphraseFieldChange,
  syncVaultPassphraseFieldAutoComplete,
  syncVaultPassphraseFieldError,
  syncVaultPassphraseFieldIsDisabled,
  syncVaultPassphraseFieldRef,
}: {
  syncVaultPassphraseFieldLabel: string
  syncVaultPassphraseFieldValue: string
  onSyncVaultPassphraseFieldChange: (syncVaultPassphraseFieldValue: string) => void
  syncVaultPassphraseFieldAutoComplete: 'current-password' | 'new-password'
  syncVaultPassphraseFieldError: string | null
  syncVaultPassphraseFieldIsDisabled: boolean
  syncVaultPassphraseFieldRef?: Ref<HTMLInputElement>
}) {
  const syncVaultPassphraseFieldId = useId()
  return (
    <div>
      <label htmlFor={syncVaultPassphraseFieldId} className={papelizAccountFieldLabelClassName}>
        {syncVaultPassphraseFieldLabel}
      </label>
      <input
        ref={syncVaultPassphraseFieldRef}
        id={syncVaultPassphraseFieldId}
        type="password"
        value={syncVaultPassphraseFieldValue}
        onChange={(passphraseChangeEvent) => onSyncVaultPassphraseFieldChange(passphraseChangeEvent.target.value)}
        autoComplete={syncVaultPassphraseFieldAutoComplete}
        spellCheck={false}
        disabled={syncVaultPassphraseFieldIsDisabled}
        aria-invalid={syncVaultPassphraseFieldError ? true : undefined}
        aria-describedby={syncVaultPassphraseFieldError ? `${syncVaultPassphraseFieldId}-error` : undefined}
        className={`${papelizAccountTextFieldClassName} disabled:opacity-60`}
      />
      {syncVaultPassphraseFieldError && (
        <p id={`${syncVaultPassphraseFieldId}-error`} className="mt-1.5 text-[13px] text-papeliz-diff-removed-ink">
          {syncVaultPassphraseFieldError}
        </p>
      )}
    </div>
  )
}

type PapelizAccountSyncVaultPassphraseChangeStage =
  | { syncVaultPassphraseChangeStageKind: 'editing' }
  | { syncVaultPassphraseChangeStageKind: 'changing' }
  | { syncVaultPassphraseChangeStageKind: 'fresh-sign-in-needed' }
  | { syncVaultPassphraseChangeStageKind: 'list-out-of-date' }
  | { syncVaultPassphraseChangeStageKind: 'changed' }
  | { syncVaultPassphraseChangeStageKind: 'failed'; syncVaultPassphraseChangeFailureMessage: string }

type PapelizAccountSyncVaultPassphraseFieldErrors = { currentSyncVaultPassphrase?: string; newSyncVaultPassphrase?: string; repeatedSyncVaultPassphrase?: string }

// Change Passphrase: the current passphrase opens the vault's key in this browser, the same key is
// wrapped with the new one, and only that new wrapped copy goes to Sync, with the revision it
// replaces. It needs a sign-in from the last 10 minutes.
function PapelizAccountSyncVaultPassphraseChangeDialog({
  papelizAccountSyncService,
  papelizSyncAccountId,
  syncVaultRecord,
  papelizAccountSyncedVaults,
  closeSyncVaultDialog,
}: {
  papelizAccountSyncService: PapelizAccountSyncService
  papelizSyncAccountId: string | null
  syncVaultRecord: PapelizAccountSyncVaultRecord
  papelizAccountSyncedVaults: PapelizAccountSyncedVaults
  closeSyncVaultDialog: () => void
}) {
  const papelizAccountClerk = useClerk()
  const { getToken } = useAuth()
  const { session } = useSession()
  const [currentSyncVaultPassphrase, setCurrentSyncVaultPassphrase] = useState('')
  const [newSyncVaultPassphrase, setNewSyncVaultPassphrase] = useState('')
  const [repeatedSyncVaultPassphrase, setRepeatedSyncVaultPassphrase] = useState('')
  const [syncVaultPassphraseFieldErrors, setSyncVaultPassphraseFieldErrors] = useState<PapelizAccountSyncVaultPassphraseFieldErrors>({})
  const [syncVaultPassphraseChangeStage, setSyncVaultPassphraseChangeStage] = useState<PapelizAccountSyncVaultPassphraseChangeStage>({
    syncVaultPassphraseChangeStageKind: 'editing',
  })
  const currentSyncVaultPassphraseFieldRef = useRef<HTMLInputElement>(null)
  const syncVaultPassphraseChangeFormId = useId()
  const syncVaultPassphraseChangeStageKind = syncVaultPassphraseChangeStage.syncVaultPassphraseChangeStageKind
  const syncVaultPassphraseChangeIsRunning = syncVaultPassphraseChangeStageKind === 'changing'
  const syncVaultName = syncVaultRecord.syncVaultName

  // A field's message goes once the field is typed in again.
  function forgetSyncVaultPassphraseFieldError(syncVaultPassphraseFieldName: keyof PapelizAccountSyncVaultPassphraseFieldErrors) {
    setSyncVaultPassphraseFieldErrors((currentFieldErrors) =>
      currentFieldErrors[syncVaultPassphraseFieldName] === undefined ? currentFieldErrors : { ...currentFieldErrors, [syncVaultPassphraseFieldName]: undefined },
    )
  }

  async function changePapelizAccountSyncVaultPassphrase(syncVaultPassphraseChangeSubmitEvent?: FormEvent) {
    syncVaultPassphraseChangeSubmitEvent?.preventDefault()
    if (syncVaultPassphraseChangeIsRunning) return
    const nextSyncVaultPassphraseFieldErrors: PapelizAccountSyncVaultPassphraseFieldErrors = {}
    if (currentSyncVaultPassphrase === '') nextSyncVaultPassphraseFieldErrors.currentSyncVaultPassphrase = 'Enter the vault’s current passphrase.'
    if (!isPapelizAccountSyncPassphraseLongEnough(newSyncVaultPassphrase)) {
      nextSyncVaultPassphraseFieldErrors.newSyncVaultPassphrase = `Use at least ${papelizAccountSyncMinimumPassphraseCharacterCount} characters.`
    } else if (normalizePapelizAccountSyncPassphrase(repeatedSyncVaultPassphrase) !== normalizePapelizAccountSyncPassphrase(newSyncVaultPassphrase)) {
      nextSyncVaultPassphraseFieldErrors.repeatedSyncVaultPassphrase = 'The new passphrases don’t match.'
    }
    setSyncVaultPassphraseFieldErrors(nextSyncVaultPassphraseFieldErrors)
    if (Object.keys(nextSyncVaultPassphraseFieldErrors).length > 0) return
    // Asked before the slow part, so a stale sign-in doesn't wait through it first.
    if (!isPapelizAccountSignInFresh(session?.factorVerificationAge)) {
      setSyncVaultPassphraseChangeStage({ syncVaultPassphraseChangeStageKind: 'fresh-sign-in-needed' })
      return
    }
    if (papelizSyncAccountId === null || syncVaultRecord.passphraseWrappedSyncVaultKey === null) {
      setSyncVaultPassphraseChangeStage({
        syncVaultPassphraseChangeStageKind: 'failed',
        syncVaultPassphraseChangeFailureMessage: 'This page can’t change this vault’s passphrase right now. Change it in Papeliz instead.',
      })
      return
    }
    setSyncVaultPassphraseChangeStage({ syncVaultPassphraseChangeStageKind: 'changing' })
    try {
      const newPassphraseWrappedSyncVaultKey = await rewrapPapelizAccountSyncVaultKeyOffMainThread({
        papelizSyncAccountId,
        papelizSyncVaultId: syncVaultRecord.papelizSyncVaultId,
        passphraseWrappedSyncVaultKey: syncVaultRecord.passphraseWrappedSyncVaultKey,
        currentSyncVaultPassphrase,
        newSyncVaultPassphrase,
      })
      const papelizAccountSignInToken = await getToken({ skipCache: true })
      if (!papelizAccountSignInToken) {
        setSyncVaultPassphraseChangeStage({ syncVaultPassphraseChangeStageKind: 'fresh-sign-in-needed' })
        return
      }
      const syncVaultPassphraseChangeOutcome = await papelizAccountSyncService.replacePapelizSyncVaultPassphraseWrappedKey(
        papelizAccountSignInToken,
        syncVaultRecord.papelizSyncVaultId,
        { syncVaultKeyWrapBaseRevision: syncVaultRecord.syncVaultKeyWrapRevision, passphraseWrappedSyncVaultKey: newPassphraseWrappedSyncVaultKey },
      )
      const syncVaultPassphraseChangeOutcomeKind = syncVaultPassphraseChangeOutcome.syncVaultPassphraseChangeOutcomeKind
      if (syncVaultPassphraseChangeOutcomeKind === 'changed') {
        papelizAccountSyncedVaults.replaceChangedPapelizAccountSyncVault(syncVaultPassphraseChangeOutcome.syncVaultRecord)
        setSyncVaultPassphraseChangeStage({ syncVaultPassphraseChangeStageKind: 'changed' })
      } else if (syncVaultPassphraseChangeOutcomeKind === 'refused') {
        setSyncVaultPassphraseChangeStage({
          syncVaultPassphraseChangeStageKind: 'failed',
          syncVaultPassphraseChangeFailureMessage: syncVaultPassphraseChangeOutcome.syncVaultPassphraseChangeRefusalMessage,
        })
      } else {
        setSyncVaultPassphraseChangeStage({
          syncVaultPassphraseChangeStageKind: syncVaultPassphraseChangeOutcomeKind === 'fresh-sign-in-required' ? 'fresh-sign-in-needed' : 'list-out-of-date',
        })
      }
    } catch (syncVaultPassphraseChangeError) {
      if (syncVaultPassphraseChangeError instanceof PapelizAccountSyncVaultKeyWrapError && syncVaultPassphraseChangeError.syncVaultKeyWrapFailureKind === 'wrong-passphrase') {
        setSyncVaultPassphraseFieldErrors({ currentSyncVaultPassphrase: 'That passphrase doesn’t open this vault.' })
        setSyncVaultPassphraseChangeStage({ syncVaultPassphraseChangeStageKind: 'editing' })
        window.setTimeout(() => currentSyncVaultPassphraseFieldRef.current?.focus())
        return
      }
      setSyncVaultPassphraseChangeStage({
        syncVaultPassphraseChangeStageKind: 'failed',
        syncVaultPassphraseChangeFailureMessage:
          syncVaultPassphraseChangeError instanceof PapelizAccountSyncVaultKeyWrapError
            ? 'Papeliz Sync sent this vault’s passphrase copy in a form this page can’t read. Change the passphrase in Papeliz instead.'
            : papelizAccountSyncUnreachableMessage,
      })
    }
  }

  // Signs out and back in, then this dialog opens again; what was typed here isn't kept.
  function signInAgainToChangePapelizAccountSyncVaultPassphrase() {
    const papelizAccountAddressAfterSignIn = new URL(papelizAccountPagePath, window.location.origin)
    papelizAccountAddressAfterSignIn.searchParams.set(papelizAccountChangePassphraseAfterSignInParameterName, syncVaultRecord.papelizSyncVaultId)
    void papelizAccountClerk.signOut({ redirectUrl: `${papelizAccountAddressAfterSignIn.pathname}${papelizAccountAddressAfterSignIn.search}` })
  }

  const closePassphraseChangeDialog = () => {
    if (!syncVaultPassphraseChangeIsRunning) closeSyncVaultDialog()
  }

  if (syncVaultPassphraseChangeStageKind === 'fresh-sign-in-needed') {
    return (
      <PapelizAccountDialog
        papelizAccountDialogTitle="Confirm It’s You"
        onPapelizAccountDialogClose={closeSyncVaultDialog}
        papelizAccountDialogClosesOnlyFromItsButtons
        papelizAccountDialogFooter={
          <>
            <button type="button" onClick={closeSyncVaultDialog} className={papelizAccountSecondaryButtonClassName}>
              Cancel
            </button>
            <button type="button" onClick={signInAgainToChangePapelizAccountSyncVaultPassphrase} className={papelizAccountCompactPrimaryButtonClassName}>
              Sign In Again
            </button>
          </>
        }
      >
        <p>Changing a passphrase needs a sign-in from the last 10 minutes. Sign in again, and this opens again so you can finish.</p>
      </PapelizAccountDialog>
    )
  }

  if (syncVaultPassphraseChangeStageKind === 'changed') {
    return (
      <PapelizAccountDialog
        papelizAccountDialogTitle="Passphrase Changed"
        onPapelizAccountDialogClose={closeSyncVaultDialog}
        papelizAccountDialogFooter={
          <button type="button" onClick={closeSyncVaultDialog} className={papelizAccountCompactPrimaryButtonClassName}>
            Done
          </button>
        }
      >
        <p role="status">
          “{syncVaultName}” now opens with the new passphrase on a new device. Devices that already have it keep working without asking.
        </p>
      </PapelizAccountDialog>
    )
  }

  if (syncVaultPassphraseChangeStageKind === 'list-out-of-date') {
    return (
      <PapelizAccountDialog
        papelizAccountDialogTitle={`Change Passphrase for “${syncVaultName}”`}
        onPapelizAccountDialogClose={closeSyncVaultDialog}
        papelizAccountDialogFooter={
          <>
            <button type="button" onClick={closeSyncVaultDialog} className={papelizAccountSecondaryButtonClassName}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                closeSyncVaultDialog()
                papelizAccountSyncedVaults.loadPapelizAccountSyncVaults()
              }}
              className={papelizAccountCompactPrimaryButtonClassName}
            >
              Reload List
            </button>
          </>
        }
      >
        <p role="alert">
          This vault changed on another device after the list loaded, so the passphrase didn’t change. Reload the list, then try again with its current passphrase.
        </p>
      </PapelizAccountDialog>
    )
  }

  return (
    <PapelizAccountDialog
      papelizAccountDialogTitle={`Change Passphrase for “${syncVaultName}”`}
      onPapelizAccountDialogClose={closePassphraseChangeDialog}
      papelizAccountDialogFooter={
        <>
          <button type="button" disabled={syncVaultPassphraseChangeIsRunning} onClick={closePassphraseChangeDialog} className={papelizAccountSecondaryButtonClassName}>
            Cancel
          </button>
          <button type="submit" form={syncVaultPassphraseChangeFormId} disabled={syncVaultPassphraseChangeIsRunning} className={papelizAccountCompactPrimaryButtonClassName}>
            {syncVaultPassphraseChangeIsRunning ? 'Changing…' : syncVaultPassphraseChangeStageKind === 'failed' ? 'Try Again' : 'Change Passphrase'}
          </button>
        </>
      }
    >
      <form id={syncVaultPassphraseChangeFormId} noValidate onSubmit={(submitEvent) => void changePapelizAccountSyncVaultPassphrase(submitEvent)} className="grid gap-3.5">
        <PapelizAccountSyncVaultPassphraseField
          syncVaultPassphraseFieldLabel="Current Passphrase"
          syncVaultPassphraseFieldValue={currentSyncVaultPassphrase}
          onSyncVaultPassphraseFieldChange={(typedSyncVaultPassphrase) => {
            setCurrentSyncVaultPassphrase(typedSyncVaultPassphrase)
            forgetSyncVaultPassphraseFieldError('currentSyncVaultPassphrase')
          }}
          syncVaultPassphraseFieldAutoComplete="current-password"
          syncVaultPassphraseFieldError={syncVaultPassphraseFieldErrors.currentSyncVaultPassphrase ?? null}
          syncVaultPassphraseFieldIsDisabled={syncVaultPassphraseChangeIsRunning}
          syncVaultPassphraseFieldRef={currentSyncVaultPassphraseFieldRef}
        />
        <PapelizAccountSyncVaultPassphraseField
          syncVaultPassphraseFieldLabel="New Passphrase"
          syncVaultPassphraseFieldValue={newSyncVaultPassphrase}
          onSyncVaultPassphraseFieldChange={(typedSyncVaultPassphrase) => {
            setNewSyncVaultPassphrase(typedSyncVaultPassphrase)
            forgetSyncVaultPassphraseFieldError('newSyncVaultPassphrase')
          }}
          syncVaultPassphraseFieldAutoComplete="new-password"
          syncVaultPassphraseFieldError={syncVaultPassphraseFieldErrors.newSyncVaultPassphrase ?? null}
          syncVaultPassphraseFieldIsDisabled={syncVaultPassphraseChangeIsRunning}
        />
        <PapelizAccountSyncVaultPassphraseField
          syncVaultPassphraseFieldLabel="Repeat New Passphrase"
          syncVaultPassphraseFieldValue={repeatedSyncVaultPassphrase}
          onSyncVaultPassphraseFieldChange={(typedSyncVaultPassphrase) => {
            setRepeatedSyncVaultPassphrase(typedSyncVaultPassphrase)
            forgetSyncVaultPassphraseFieldError('repeatedSyncVaultPassphrase')
          }}
          syncVaultPassphraseFieldAutoComplete="new-password"
          syncVaultPassphraseFieldError={syncVaultPassphraseFieldErrors.repeatedSyncVaultPassphrase ?? null}
          syncVaultPassphraseFieldIsDisabled={syncVaultPassphraseChangeIsRunning}
        />
      </form>
      <div className="rounded-[10px] border border-papeliz-blue-line bg-papeliz-blue-soft px-3.5 py-2.5 text-[13.5px] leading-snug text-papeliz-ink">
        At least {papelizAccountSyncMinimumPassphraseCharacterCount} characters. Papeliz can’t recover it. Devices that already have this vault keep working, and a new
        device asks for the new passphrase. The change happens in this browser, and the passphrases are never sent.
      </div>
      {syncVaultPassphraseChangeIsRunning && (
        <p role="status" className="text-[13.5px]">
          Changing the passphrase. This takes a few seconds.
        </p>
      )}
      {syncVaultPassphraseChangeStage.syncVaultPassphraseChangeStageKind === 'failed' && (
        <p role="alert" className="text-papeliz-diff-removed-ink">
          {syncVaultPassphraseChangeStage.syncVaultPassphraseChangeFailureMessage}
        </p>
      )}
    </PapelizAccountDialog>
  )
}

type PapelizAccountSyncVaultDeletionStageKind = 'confirming' | 'deleting' | 'sign-in-ended' | 'failed'

// Delete from Sync: the synced copy, its old versions and its stored key go; every device keeps its
// files. The vault's name is typed first. Any live sign-in will do; no recent one is needed.
function PapelizAccountSyncVaultDeletionDialog({
  papelizAccountSyncService,
  syncVaultRecord,
  papelizAccountSyncedVaults,
  closeSyncVaultDialog,
}: {
  papelizAccountSyncService: PapelizAccountSyncService
  syncVaultRecord: PapelizAccountSyncVaultRecord
  papelizAccountSyncedVaults: PapelizAccountSyncedVaults
  closeSyncVaultDialog: () => void
}) {
  const papelizAccountClerk = useClerk()
  const { getToken } = useAuth()
  const [typedSyncVaultName, setTypedSyncVaultName] = useState('')
  const [syncVaultDeletionStageKind, setSyncVaultDeletionStageKind] = useState<PapelizAccountSyncVaultDeletionStageKind>('confirming')
  const [syncVaultDeletionFailureMessage, setSyncVaultDeletionFailureMessage] = useState('')
  const typedSyncVaultNameFieldId = useId()
  const syncVaultDeletionIsRunning = syncVaultDeletionStageKind === 'deleting'
  const syncVaultName = syncVaultRecord.syncVaultName
  const typedSyncVaultNameMatches = typedSyncVaultName.trim().normalize('NFC') === syncVaultName.trim().normalize('NFC')

  async function deletePapelizAccountSyncVault() {
    if (!typedSyncVaultNameMatches || syncVaultDeletionIsRunning) return
    setSyncVaultDeletionStageKind('deleting')
    try {
      const papelizAccountSignInToken = await getToken({ skipCache: true })
      if (!papelizAccountSignInToken) {
        setSyncVaultDeletionStageKind('sign-in-ended')
        return
      }
      const syncVaultDeletionOutcome = await papelizAccountSyncService.deletePapelizSyncVaultFromSignInPage(papelizAccountSignInToken, syncVaultRecord.papelizSyncVaultId)
      if (syncVaultDeletionOutcome.syncVaultDeletionOutcomeKind === 'deleted') {
        papelizAccountSyncedVaults.forgetDeletedPapelizAccountSyncVault(syncVaultRecord.papelizSyncVaultId)
        closeSyncVaultDialog()
        return
      }
      setSyncVaultDeletionFailureMessage(syncVaultDeletionOutcome.syncVaultDeletionRefusalMessage)
      setSyncVaultDeletionStageKind('failed')
    } catch {
      setSyncVaultDeletionFailureMessage(papelizAccountSyncUnreachableMessage)
      setSyncVaultDeletionStageKind('failed')
    }
  }

  const closeDeletionDialog = () => {
    if (!syncVaultDeletionIsRunning) closeSyncVaultDialog()
  }

  if (syncVaultDeletionStageKind === 'sign-in-ended') {
    return (
      <PapelizAccountDialog
        papelizAccountDialogTitle="Sign In Again to Continue"
        onPapelizAccountDialogClose={closeSyncVaultDialog}
        papelizAccountDialogClosesOnlyFromItsButtons
        papelizAccountDialogFooter={
          <>
            <button type="button" onClick={closeSyncVaultDialog} className={papelizAccountSecondaryButtonClassName}>
              Cancel
            </button>
            <button type="button" onClick={() => void papelizAccountClerk.signOut({ redirectUrl: papelizAccountPagePath })} className={papelizAccountCompactPrimaryButtonClassName}>
              Sign In Again
            </button>
          </>
        }
      >
        <p>Your sign-in on this page has ended. Sign in again, then delete the vault from Sync.</p>
      </PapelizAccountDialog>
    )
  }

  return (
    <PapelizAccountDialog
      papelizAccountDialogTitle={`Delete “${syncVaultName}” from Sync?`}
      onPapelizAccountDialogClose={closeDeletionDialog}
      papelizAccountDialogFooter={
        <>
          <button type="button" disabled={syncVaultDeletionIsRunning} onClick={closeDeletionDialog} className={papelizAccountSecondaryButtonClassName}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!typedSyncVaultNameMatches || syncVaultDeletionIsRunning}
            onClick={() => void deletePapelizAccountSyncVault()}
            className={papelizAccountCompactDangerButtonClassName}
          >
            {syncVaultDeletionIsRunning ? 'Deleting…' : syncVaultDeletionStageKind === 'failed' ? 'Try Again' : 'Delete from Sync'}
          </button>
        </>
      }
    >
      <p>The synced copy and its old versions go, and every device keeps its files. This can’t be undone.</p>
      <form
        noValidate
        onSubmit={(deletionSubmitEvent) => {
          deletionSubmitEvent.preventDefault()
          void deletePapelizAccountSyncVault()
        }}
      >
        <label htmlFor={typedSyncVaultNameFieldId} className={papelizAccountFieldLabelClassName}>
          Type the vault’s name to confirm
        </label>
        <input
          id={typedSyncVaultNameFieldId}
          type="text"
          value={typedSyncVaultName}
          onChange={(typedNameChangeEvent) => setTypedSyncVaultName(typedNameChangeEvent.target.value)}
          placeholder={syncVaultName}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={syncVaultDeletionIsRunning}
          className={`${papelizAccountTextFieldClassName} disabled:opacity-60`}
        />
      </form>
      {syncVaultDeletionStageKind === 'failed' && (
        <p role="alert" className="text-papeliz-diff-removed-ink">
          {syncVaultDeletionFailureMessage}
        </p>
      )}
    </PapelizAccountDialog>
  )
}
