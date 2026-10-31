'use client'

import { useAuth, useClerk, useSession, useUser } from '@clerk/react'
import { ArrowLeft, Check, ChevronRight, CreditCard, FingerprintPattern, Laptop, Mail, Power, RefreshCw, UserRound, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { FaApple } from 'react-icons/fa6'
import { FcGoogle } from 'react-icons/fc'
import {
  PapelizAccountBrand,
  papelizAccountCompactDangerButtonClassName,
  papelizAccountCompactPrimaryButtonClassName,
  papelizAccountRowActionWidthClassName,
  papelizAccountSecondaryButtonClassName,
} from './papeliz-account-card-frame'
import { papelizAccountClerkErrorCodes, readPapelizAccountClerkError } from './papeliz-account-clerk-errors'
import {
  papelizAccountAppPath,
  papelizAccountDeleteAfterSignInParameterName,
  papelizAccountDeletedParameterName,
  papelizAccountFreshSignInMinutes,
  papelizAccountPagePath,
  papelizAccountSupportPath,
  readPapelizAccountPasskeysAreOn,
} from './papeliz-account-config'
import { PapelizAccountBillingSection } from './papeliz-account-billing-section'
import { PapelizAccountPhoneLaunchButtons, PapelizAccountSidebarLaunchButton } from './papeliz-account-launch-menu'
import { PapelizAccountRow, PapelizAccountRowDescription, PapelizAccountRowGroup } from './papeliz-account-rows'
import type { PapelizAccountSyncService } from './papeliz-account-sync-service'
import { PapelizAccountSyncPlansSection } from './papeliz-account-sync-plans-section'

type PapelizAccountSectionId = 'profile' | 'sync' | 'devices' | 'billing'

const papelizAccountSections: readonly { papelizAccountSectionId: PapelizAccountSectionId; papelizAccountSectionLabel: string; PapelizAccountSectionIcon: LucideIcon }[] = [
  { papelizAccountSectionId: 'profile', papelizAccountSectionLabel: 'Profile', PapelizAccountSectionIcon: UserRound },
  { papelizAccountSectionId: 'sync', papelizAccountSectionLabel: 'Sync', PapelizAccountSectionIcon: RefreshCw },
  { papelizAccountSectionId: 'devices', papelizAccountSectionLabel: 'Devices', PapelizAccountSectionIcon: Laptop },
  { papelizAccountSectionId: 'billing', papelizAccountSectionLabel: 'Billing', PapelizAccountSectionIcon: CreditCard },
]

function PapelizAccountSectionIntro({ children }: { children: ReactNode }) {
  return <p className="-mt-1 mb-4 max-w-[560px] text-sm text-pretty text-papeliz-ink-muted md:-mt-2.5 md:mb-2 md:text-[15px]">{children}</p>
}

function PapelizAccountOpenAppAction({ papelizAccountOpenAppLabel = 'Open Papeliz' }: { papelizAccountOpenAppLabel?: string }) {
  return (
    <a href={papelizAccountAppPath} target="_blank" rel="noopener" className={`${papelizAccountCompactPrimaryButtonClassName} ${papelizAccountRowActionWidthClassName}`}>
      {papelizAccountOpenAppLabel}
    </a>
  )
}

type PapelizAccountDeleteStage =
  | { accountDeleteStageKind: 'closed' }
  | { accountDeleteStageKind: 'confirming' }
  | { accountDeleteStageKind: 'deleting' }
  | { accountDeleteStageKind: 'fresh-sign-in-needed' }
  | { accountDeleteStageKind: 'failed'; accountDeleteFailureMessage: string }

// Deleting needs a sign-in from the last 10 minutes: Clerk's session says how many minutes ago the
// first factor was verified (-1 for never).
function isPapelizAccountSignInFresh(factorVerificationAge: [number, number] | null | undefined): boolean {
  const firstFactorVerificationAgeMinutes = factorVerificationAge?.[0] ?? -1
  return firstFactorVerificationAgeMinutes >= 0 && firstFactorVerificationAgeMinutes < papelizAccountFreshSignInMinutes
}

// Delete account, run here and only here: first Papeliz Sync (the subscription, every synced copy and
// its history), then the sign-in itself. Notes on devices stay.
function PapelizAccountDeleteAccountRow({
  papelizAccountSyncService,
  isPapelizAccountDeleteOpenedAfterSignIn,
}: {
  papelizAccountSyncService: PapelizAccountSyncService
  isPapelizAccountDeleteOpenedAfterSignIn: boolean
}) {
  const papelizAccountClerk = useClerk()
  const { getToken } = useAuth()
  const { session } = useSession()
  const { user } = useUser()
  const [accountDeleteStage, setAccountDeleteStage] = useState<PapelizAccountDeleteStage>(() =>
    isPapelizAccountDeleteOpenedAfterSignIn ? { accountDeleteStageKind: 'confirming' } : { accountDeleteStageKind: 'closed' },
  )
  const accountDeleteIsRunning = accountDeleteStage.accountDeleteStageKind === 'deleting'

  async function deletePapelizAccount() {
    if (!user || !isPapelizAccountSignInFresh(session?.factorVerificationAge)) {
      setAccountDeleteStage({ accountDeleteStageKind: 'fresh-sign-in-needed' })
      return
    }
    setAccountDeleteStage({ accountDeleteStageKind: 'deleting' })
    try {
      const papelizAccountSignInToken = await getToken({ skipCache: true })
      if (!papelizAccountSignInToken) {
        setAccountDeleteStage({ accountDeleteStageKind: 'fresh-sign-in-needed' })
        return
      }
      const syncAccountDeletionOutcome = await papelizAccountSyncService.deletePapelizSyncAccount(papelizAccountSignInToken)
      if (syncAccountDeletionOutcome.syncAccountDeletionOutcomeKind === 'fresh-sign-in-required') {
        setAccountDeleteStage({ accountDeleteStageKind: 'fresh-sign-in-needed' })
        return
      }
      if (syncAccountDeletionOutcome.syncAccountDeletionOutcomeKind === 'refused') {
        setAccountDeleteStage({ accountDeleteStageKind: 'failed', accountDeleteFailureMessage: syncAccountDeletionOutcome.syncAccountDeletionRefusalMessage })
        return
      }
      await user.delete()
      // A full load, so the page starts again with Clerk signed out.
      const papelizAccountDeletedAddress = new URL(papelizAccountPagePath, window.location.origin)
      papelizAccountDeletedAddress.searchParams.set(papelizAccountDeletedParameterName, '1')
      window.location.assign(papelizAccountDeletedAddress.href)
    } catch (accountDeleteError) {
      const { clerkErrorCode, clerkErrorMessage } = readPapelizAccountClerkError(accountDeleteError)
      setAccountDeleteStage(
        clerkErrorCode === papelizAccountClerkErrorCodes.reverificationRequired
          ? { accountDeleteStageKind: 'fresh-sign-in-needed' }
          : { accountDeleteStageKind: 'failed', accountDeleteFailureMessage: clerkErrorMessage },
      )
    }
  }

  // Signs out and back in, then this row opens again.
  function signInAgainToDeletePapelizAccount() {
    void papelizAccountClerk.signOut({ redirectUrl: `${papelizAccountPagePath}?${papelizAccountDeleteAfterSignInParameterName}=1` })
  }

  const accountDeleteStageKind = accountDeleteStage.accountDeleteStageKind
  return (
    <PapelizAccountRow
      papelizAccountRowTitle="Delete account"
      papelizAccountRowIsDanger
      papelizAccountRowExtra={
        accountDeleteStageKind !== 'closed' && (
          <div className="mt-1.5 max-w-[520px]">
            <p className="text-[13px] text-pretty text-papeliz-ink-muted md:text-sm">
              {accountDeleteStageKind === 'fresh-sign-in-needed'
                ? 'To delete your account, sign in again first.'
                : 'Deletes your account, your Sync subscription and every synced copy. The notes on your devices stay. This can’t be undone.'}
            </p>
            {accountDeleteStage.accountDeleteStageKind === 'failed' && (
              <p role="alert" className="mt-1.5 text-[13px] text-pretty text-papeliz-diff-removed-ink md:text-sm">
                {accountDeleteStage.accountDeleteFailureMessage}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {accountDeleteStageKind === 'fresh-sign-in-needed' ? (
                <button type="button" onClick={signInAgainToDeletePapelizAccount} className={papelizAccountCompactPrimaryButtonClassName}>
                  Sign in again
                </button>
              ) : (
                <button
                  type="button"
                  disabled={accountDeleteIsRunning}
                  onClick={() => void deletePapelizAccount()}
                  className={papelizAccountCompactDangerButtonClassName}
                >
                  {accountDeleteIsRunning ? 'Deleting…' : accountDeleteStageKind === 'failed' ? 'Try again' : 'Delete account'}
                </button>
              )}
              <button
                type="button"
                disabled={accountDeleteIsRunning}
                onClick={() => setAccountDeleteStage({ accountDeleteStageKind: 'closed' })}
                className={papelizAccountSecondaryButtonClassName}
              >
                Cancel
              </button>
            </div>
          </div>
        )
      }
      papelizAccountRowAction={
        accountDeleteStageKind === 'closed' && (
          <button
            type="button"
            onClick={() => setAccountDeleteStage({ accountDeleteStageKind: 'confirming' })}
            className={`${papelizAccountCompactDangerButtonClassName} ${papelizAccountRowActionWidthClassName}`}
          >
            Delete
          </button>
        )
      }
    />
  )
}

function PapelizAccountSignInWayConnectedBadge() {
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-papeliz-diff-added px-2.5 text-xs font-semibold text-papeliz-diff-added-ink">
      <Check className="size-3.5" aria-hidden="true" />
      Connected
    </span>
  )
}

// One way to sign in: its icon, its name over what it uses, then Connected or Add on the right.
function PapelizAccountSignInWayLine({
  signInWayIcon,
  signInWayName,
  signInWayDetail,
  signInWayAction,
  signInWayDetailIsAnnounced = false,
}: {
  signInWayIcon: ReactNode
  signInWayName: string
  signInWayDetail: string
  signInWayAction: ReactNode
  signInWayDetailIsAnnounced?: boolean
}) {
  return (
    <li className="flex items-center gap-3 border-t border-papeliz-line py-2.5 first:border-t-0 md:py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-papeliz-line bg-papeliz-surface-soft">{signInWayIcon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{signInWayName}</p>
        <p aria-live={signInWayDetailIsAnnounced ? 'polite' : undefined} className="text-[13px] text-pretty [overflow-wrap:anywhere] text-papeliz-ink-muted">
          {signInWayDetail}
        </p>
      </div>
      {signInWayAction}
    </li>
  )
}

function PapelizAccountProfileSection({
  papelizAccountSyncService,
  isPapelizAccountDeleteOpenedAfterSignIn,
}: {
  papelizAccountSyncService: PapelizAccountSyncService
  isPapelizAccountDeleteOpenedAfterSignIn: boolean
}) {
  const papelizAccountClerk = useClerk()
  const { user } = useUser()
  const [passkeyMessage, setPasskeyMessage] = useState<string | null>(null)
  const [passkeyIsBeingAdded, setPasskeyIsBeingAdded] = useState(false)
  if (!user) return null
  const papelizAccountPrimaryEmailAddress = user.primaryEmailAddress?.emailAddress ?? null
  const papelizAccountEmailAddress = papelizAccountPrimaryEmailAddress ?? 'No email'
  const connectedGoogleAccount = user.externalAccounts.find((externalAccount) => externalAccount.provider === 'google')
  const connectedAppleAccount = user.externalAccounts.find((externalAccount) => externalAccount.provider === 'apple')
  const passkeyCount = user.passkeys.length
  const papelizAccountPasskeysAreOn = readPapelizAccountPasskeysAreOn(papelizAccountClerk)

  async function addPapelizAccountPasskey() {
    if (!user) return
    setPasskeyIsBeingAdded(true)
    setPasskeyMessage(null)
    try {
      await user.createPasskey()
      setPasskeyMessage('Passkey added. Next time, sign in with Passkey.')
    } catch (passkeyError) {
      setPasskeyMessage(readPapelizAccountClerkError(passkeyError).clerkErrorMessage)
    } finally {
      setPasskeyIsBeingAdded(false)
    }
  }

  return (
    <>
      <h1 className="mt-[22px] mb-2.5 text-[22px] font-[650] tracking-[-0.02em] md:mt-0 md:mb-[22px] md:text-[29px]">Your profile</h1>
      <PapelizAccountRowGroup>
        <PapelizAccountRow papelizAccountRowTitle="Email" papelizAccountRowValue={papelizAccountEmailAddress} />
        {user.username && <PapelizAccountRow papelizAccountRowTitle="Username" papelizAccountRowValue={user.username} />}
        {/* Every way to sign in on one list, passkeys included (Adam, 2026-10-31). */}
        <PapelizAccountRow
          papelizAccountRowTitle="Ways to sign in"
          papelizAccountRowExtra={
            <ul className="mt-1.5 md:mt-2.5">
              {connectedGoogleAccount && (
                <PapelizAccountSignInWayLine
                  signInWayIcon={<FcGoogle className="size-4" aria-hidden="true" />}
                  signInWayName="Google"
                  signInWayDetail={connectedGoogleAccount.emailAddress || papelizAccountPrimaryEmailAddress || 'Your Google account'}
                  signInWayAction={<PapelizAccountSignInWayConnectedBadge />}
                />
              )}
              {connectedAppleAccount && (
                <PapelizAccountSignInWayLine
                  signInWayIcon={<FaApple className="size-4" aria-hidden="true" />}
                  signInWayName="Apple"
                  signInWayDetail={connectedAppleAccount.emailAddress || papelizAccountPrimaryEmailAddress || 'Your Apple Account'}
                  signInWayAction={<PapelizAccountSignInWayConnectedBadge />}
                />
              )}
              <PapelizAccountSignInWayLine
                signInWayIcon={<Mail className="size-4 text-papeliz-ink-muted" aria-hidden="true" />}
                signInWayName="Email code"
                signInWayDetail={papelizAccountPrimaryEmailAddress ? `A code sent to ${papelizAccountPrimaryEmailAddress}` : 'A code sent to your email'}
                signInWayAction={<PapelizAccountSignInWayConnectedBadge />}
              />
              {papelizAccountPasskeysAreOn && (
                <PapelizAccountSignInWayLine
                  signInWayIcon={<FingerprintPattern className="size-4 text-papeliz-ink-muted" aria-hidden="true" />}
                  signInWayName="Passkey"
                  signInWayDetail={
                    passkeyMessage ??
                    (passkeyCount === 0
                      ? 'Sign in with your fingerprint, face or screen lock'
                      : passkeyCount === 1
                        ? '1 passkey added'
                        : `${passkeyCount} passkeys added`)
                  }
                  signInWayDetailIsAnnounced
                  signInWayAction={
                    <button
                      type="button"
                      aria-label="Add a passkey"
                      disabled={passkeyIsBeingAdded}
                      onClick={() => void addPapelizAccountPasskey()}
                      className={`${papelizAccountCompactPrimaryButtonClassName} ${papelizAccountRowActionWidthClassName}`}
                    >
                      {passkeyIsBeingAdded ? 'Adding…' : 'Add'}
                    </button>
                  }
                />
              )}
            </ul>
          }
        />
      </PapelizAccountRowGroup>
      <PapelizAccountRowGroup>
        <PapelizAccountRow
          papelizAccountRowTitle="Contact support"
          papelizAccountRowAction={
            <a
              href={papelizAccountSupportPath}
              className={`${papelizAccountCompactPrimaryButtonClassName} ${papelizAccountRowActionWidthClassName} max-md:min-w-0 max-md:bg-transparent max-md:px-0 max-md:shadow-none`}
            >
              <span className="max-md:sr-only">Contact us</span>
              <ChevronRight className="size-4 text-papeliz-ink-subtle md:hidden" aria-hidden="true" />
            </a>
          }
        />
        <PapelizAccountDeleteAccountRow
          papelizAccountSyncService={papelizAccountSyncService}
          isPapelizAccountDeleteOpenedAfterSignIn={isPapelizAccountDeleteOpenedAfterSignIn}
        />
      </PapelizAccountRowGroup>
    </>
  )
}

// Sync shows the plans to buy; Devices points to the app, where a signed-in device holds Sync's
// keys; Billing lists what it covers.
function PapelizAccountPlansDevicesAndBillingSection({ papelizAccountSectionId }: { papelizAccountSectionId: Exclude<PapelizAccountSectionId, 'profile'> }) {
  const papelizAccountSectionHeading = papelizAccountSectionId === 'sync' ? 'Sync' : papelizAccountSectionId === 'devices' ? 'Devices' : 'Billing'
  return (
    <>
      <h1 className="mt-[22px] mb-2.5 text-[22px] font-[650] tracking-[-0.02em] md:mt-0 md:mb-[22px] md:text-[29px]">{papelizAccountSectionHeading}</h1>
      {papelizAccountSectionId === 'sync' && <PapelizAccountSyncPlansSection />}
      {papelizAccountSectionId === 'devices' && (
        <>
          <PapelizAccountSectionIntro>Devices signed in to Sync. Removing one signs it out; its notes stay on it.</PapelizAccountSectionIntro>
          <PapelizAccountRowGroup>
            <PapelizAccountRow
              papelizAccountRowTitle="Your devices"
              papelizAccountRowExtra={<PapelizAccountRowDescription>See, rename and remove devices in Papeliz: Settings › Account.</PapelizAccountRowDescription>}
              papelizAccountRowAction={<PapelizAccountOpenAppAction />}
            />
            <PapelizAccountRow
              papelizAccountRowTitle="Add a device"
              papelizAccountRowExtra={
                <PapelizAccountRowDescription>Get Papeliz for your computer or phone with Download, then sign in to Sync there.</PapelizAccountRowDescription>
              }
            />
          </PapelizAccountRowGroup>
        </>
      )}
      {papelizAccountSectionId === 'billing' && <PapelizAccountBillingSection />}
    </>
  )
}

// Signed in, opened directly: Launch Papeliz with the downloads, then the account's sections.
export function PapelizAccountDashboard({
  papelizAccountSyncService,
  isPapelizAccountDeleteOpenedAfterSignIn = false,
}: {
  papelizAccountSyncService: PapelizAccountSyncService
  isPapelizAccountDeleteOpenedAfterSignIn?: boolean
}) {
  const papelizAccountClerk = useClerk()
  const { user } = useUser()
  const [chosenPapelizAccountSectionId, setChosenPapelizAccountSectionId] = useState<PapelizAccountSectionId>('profile')
  const [papelizAccountIsSigningOut, setPapelizAccountIsSigningOut] = useState(false)
  const papelizAccountInitial = (user?.primaryEmailAddress?.emailAddress ?? '?').charAt(0).toUpperCase()

  function signOutOfPapelizAccount() {
    setPapelizAccountIsSigningOut(true)
    void papelizAccountClerk.signOut({ redirectUrl: papelizAccountPagePath })
  }

  const papelizAccountSectionContent =
    chosenPapelizAccountSectionId === 'profile' ? (
      <PapelizAccountProfileSection papelizAccountSyncService={papelizAccountSyncService} isPapelizAccountDeleteOpenedAfterSignIn={isPapelizAccountDeleteOpenedAfterSignIn} />
    ) : (
      <PapelizAccountPlansDevicesAndBillingSection papelizAccountSectionId={chosenPapelizAccountSectionId} />
    )
  const papelizAccountSidebarActionClassName =
    '-mx-2.5 flex min-h-[38px] cursor-pointer items-center gap-[9px] rounded-lg px-2.5 py-1 text-base font-medium text-papeliz-ink-muted transition-colors hover:bg-papeliz-hover hover:text-papeliz-ink disabled:cursor-wait disabled:opacity-60'

  return (
    <>
      {/* A computer: the sidebar beside the section. */}
      <div className="mx-auto hidden min-h-svh max-w-[1080px] grid-cols-[250px_minmax(0,1fr)] px-10 md:grid">
        <aside className="border-r border-papeliz-line py-8 pr-7">
          <div className="mb-[26px]">
            <PapelizAccountBrand />
          </div>
          <PapelizAccountSidebarLaunchButton />
          <nav aria-label="Account sections" className="grid gap-[3px]">
            {papelizAccountSections.map(({ papelizAccountSectionId, papelizAccountSectionLabel, PapelizAccountSectionIcon }) => (
              <button
                key={papelizAccountSectionId}
                type="button"
                aria-current={chosenPapelizAccountSectionId === papelizAccountSectionId ? 'page' : undefined}
                onClick={() => setChosenPapelizAccountSectionId(papelizAccountSectionId)}
                className={`-mx-2.5 flex min-h-[38px] cursor-pointer items-center gap-[9px] rounded-lg px-2.5 py-1 text-left text-base transition-colors ${
                  chosenPapelizAccountSectionId === papelizAccountSectionId
                    ? 'bg-papeliz-gradient-start font-semibold text-white'
                    : 'font-medium text-papeliz-ink-muted hover:bg-papeliz-hover hover:text-papeliz-ink'
                }`}
              >
                <PapelizAccountSectionIcon className="size-[19px] shrink-0" aria-hidden="true" />
                {papelizAccountSectionLabel}
              </button>
            ))}
          </nav>
          <div className="mt-7 grid gap-[3px]">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full page load leaves Clerk behind on this page */}
            <a href="/" className={papelizAccountSidebarActionClassName}>
              <ArrowLeft className="size-[19px] shrink-0" aria-hidden="true" />
              Back to main site
            </a>
            <button type="button" disabled={papelizAccountIsSigningOut} onClick={signOutOfPapelizAccount} className={papelizAccountSidebarActionClassName}>
              <Power className="size-[19px] shrink-0" aria-hidden="true" />
              {papelizAccountIsSigningOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </aside>
        <section className="min-w-0 pt-11 pb-16 pl-[52px]">{papelizAccountSectionContent}</section>
      </div>

      {/* A phone: the header, Launch and Download, the sections as tabs, then grouped rows. */}
      <div className="mx-auto max-w-[480px] px-4 pb-6 md:hidden">
        <div className="flex h-[62px] items-center justify-between">
          <PapelizAccountBrand papelizAccountBrandSize="small" />
          <span
            className="grid size-[34px] place-items-center rounded-full bg-papeliz-gradient-start text-sm font-bold text-white"
            title={user?.primaryEmailAddress?.emailAddress}
            aria-hidden="true"
          >
            {papelizAccountInitial}
          </span>
        </div>
        <PapelizAccountPhoneLaunchButtons />
        <nav aria-label="Account sections" className="grid grid-cols-4 gap-0.5 rounded-[11px] bg-papeliz-surface-gray p-[3px] shadow-[inset_0_0_0_1px_var(--color-papeliz-line)]">
          {papelizAccountSections.map(({ papelizAccountSectionId, papelizAccountSectionLabel }) => (
            <button
              key={papelizAccountSectionId}
              type="button"
              aria-current={chosenPapelizAccountSectionId === papelizAccountSectionId ? 'page' : undefined}
              onClick={() => setChosenPapelizAccountSectionId(papelizAccountSectionId)}
              className={`h-[34px] cursor-pointer rounded-lg text-[13px] font-semibold transition-colors ${
                chosenPapelizAccountSectionId === papelizAccountSectionId ? 'bg-papeliz-gradient-start text-white' : 'text-papeliz-ink-muted hover:text-papeliz-ink'
              }`}
            >
              {papelizAccountSectionLabel}
            </button>
          ))}
        </nav>
        <div className="px-0.5">{papelizAccountSectionContent}</div>
        <div className="mt-[18px] flex justify-between px-1 text-[13px] text-papeliz-ink-muted">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full page load leaves Clerk behind on this page */}
          <a href="/" className="inline-flex items-center gap-1.5 hover:text-papeliz-ink">
            <ArrowLeft className="size-[15px]" aria-hidden="true" />
            Back to main site
          </a>
          <button type="button" disabled={papelizAccountIsSigningOut} onClick={signOutOfPapelizAccount} className="inline-flex cursor-pointer items-center gap-1.5 hover:text-papeliz-ink">
            <Power className="size-[15px]" aria-hidden="true" />
            {papelizAccountIsSigningOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </>
  )
}
