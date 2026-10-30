'use client'

import { useAuth, useClerk, useSession, useUser } from '@clerk/react'
import { ArrowLeft, ChevronRight, CreditCard, Laptop, Mail, Power, RefreshCw, UserRound, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { FaApple } from 'react-icons/fa6'
import { FcGoogle } from 'react-icons/fc'
import { PapelizAccountBrand, papelizAccountCompactPrimaryButtonClassName, papelizAccountSecondaryButtonClassName } from './papeliz-account-card-frame'
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
import { PapelizAccountPhoneLaunchButtons, PapelizAccountSidebarLaunchButton } from './papeliz-account-launch-menu'
import type { PapelizAccountSyncService } from './papeliz-account-sync-service'

type PapelizAccountSectionId = 'profile' | 'sync' | 'devices' | 'billing'

const papelizAccountSections: readonly { papelizAccountSectionId: PapelizAccountSectionId; papelizAccountSectionLabel: string; PapelizAccountSectionIcon: LucideIcon }[] = [
  { papelizAccountSectionId: 'profile', papelizAccountSectionLabel: 'Profile', PapelizAccountSectionIcon: UserRound },
  { papelizAccountSectionId: 'sync', papelizAccountSectionLabel: 'Sync', PapelizAccountSectionIcon: RefreshCw },
  { papelizAccountSectionId: 'devices', papelizAccountSectionLabel: 'Devices', PapelizAccountSectionIcon: Laptop },
  { papelizAccountSectionId: 'billing', papelizAccountSectionLabel: 'Billing', PapelizAccountSectionIcon: CreditCard },
]

// One account row. On a computer: the title over a muted value, the action on the right, and a
// line under it. On a phone: a small label over the value, inside a grouped card.
function PapelizAccountRow({
  papelizAccountRowTitle,
  papelizAccountRowValue,
  papelizAccountRowAction,
  papelizAccountRowExtra,
  papelizAccountRowIsDanger = false,
}: {
  papelizAccountRowTitle: string
  papelizAccountRowValue?: ReactNode
  papelizAccountRowAction?: ReactNode
  papelizAccountRowExtra?: ReactNode
  papelizAccountRowIsDanger?: boolean
}) {
  return (
    <div className="flex min-h-[58px] items-center gap-3 border-b border-papeliz-line px-3.5 py-2.5 last:border-b-0 md:gap-6 md:px-0 md:py-5 md:last:border-b">
      <div className="min-w-0 flex-1">
        <h2
          className={`${papelizAccountRowValue ? 'text-xs font-medium text-papeliz-ink-subtle' : `text-[14.5px] font-semibold ${papelizAccountRowIsDanger ? 'text-papeliz-diff-removed-ink' : ''}`} md:text-base md:font-semibold md:text-papeliz-ink`}
        >
          {papelizAccountRowTitle}
        </h2>
        {papelizAccountRowValue && (
          <p className="truncate text-[14.5px] font-semibold md:mt-1 md:text-sm md:font-normal md:whitespace-normal md:text-papeliz-ink-muted">{papelizAccountRowValue}</p>
        )}
        {papelizAccountRowExtra}
      </div>
      {papelizAccountRowAction}
    </div>
  )
}

// Rows that belong together; a separate card on a phone, one continuous list on a computer.
function PapelizAccountRowGroup({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-papeliz-line bg-papeliz-surface [&+&]:mt-3 md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:[&+&]:mt-0">
      {children}
    </div>
  )
}

function PapelizAccountSectionIntro({ children }: { children: ReactNode }) {
  return <p className="-mt-1 mb-4 max-w-[560px] text-sm text-pretty text-papeliz-ink-muted md:-mt-2.5 md:mb-2 md:text-[15px]">{children}</p>
}

function PapelizAccountOpenAppAction({ papelizAccountOpenAppLabel = 'Open Papeliz' }: { papelizAccountOpenAppLabel?: string }) {
  return (
    <a href={papelizAccountAppPath} target="_blank" rel="noopener" className={papelizAccountCompactPrimaryButtonClassName}>
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
                  className="inline-flex min-h-[38px] shrink-0 cursor-pointer items-center justify-center rounded-lg bg-papeliz-diff-removed-ink px-3.5 text-[13px] font-semibold whitespace-nowrap text-papeliz-surface transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-papeliz-diff-removed-ink"
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
            className={`${papelizAccountSecondaryButtonClassName} border-papeliz-diff-removed-ink/40 bg-transparent text-papeliz-diff-removed-ink hover:bg-papeliz-diff-removed`}
          >
            Delete
          </button>
        )
      }
    />
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
  const papelizAccountEmailAddress = user.primaryEmailAddress?.emailAddress ?? 'No email'
  const connectedProviders = new Set(user.externalAccounts.map((externalAccount) => externalAccount.provider))
  const signInWayNames = [connectedProviders.has('google') ? 'Google' : null, connectedProviders.has('apple') ? 'Apple' : null, 'Email code'].filter(
    (signInWayName): signInWayName is string => signInWayName !== null,
  )
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
        <PapelizAccountRow
          papelizAccountRowTitle="Ways to sign in"
          papelizAccountRowValue={signInWayNames.join(' · ')}
          papelizAccountRowExtra={
            <div className="mt-2 hidden flex-wrap gap-1.5 md:flex">
              {connectedProviders.has('google') && (
                <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-papeliz-line bg-papeliz-surface px-2.5 text-xs font-semibold">
                  <FcGoogle className="size-[13px]" aria-hidden="true" />
                  Google
                </span>
              )}
              {connectedProviders.has('apple') && (
                <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-papeliz-line bg-papeliz-surface px-2.5 text-xs font-semibold">
                  <FaApple className="size-[13px]" aria-hidden="true" />
                  Apple
                </span>
              )}
              <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-papeliz-line bg-papeliz-surface px-2.5 text-xs font-semibold">
                <Mail className="size-[13px]" aria-hidden="true" />
                Email code
              </span>
            </div>
          }
        />
        {papelizAccountPasskeysAreOn && (
          <PapelizAccountRow
            papelizAccountRowTitle="Passkeys"
            papelizAccountRowValue={passkeyMessage ?? (passkeyCount === 0 ? 'None yet' : passkeyCount === 1 ? '1 passkey' : `${passkeyCount} passkeys`)}
            papelizAccountRowAction={
              <button type="button" disabled={passkeyIsBeingAdded} onClick={() => void addPapelizAccountPasskey()} className={papelizAccountSecondaryButtonClassName}>
                {passkeyIsBeingAdded ? 'Adding…' : 'Add'}
              </button>
            }
          />
        )}
      </PapelizAccountRowGroup>
      <PapelizAccountRowGroup>
        <PapelizAccountRow
          papelizAccountRowTitle="Contact support"
          papelizAccountRowAction={
            <a href={papelizAccountSupportPath} className={`${papelizAccountSecondaryButtonClassName} max-md:border-0 max-md:bg-transparent max-md:px-0`}>
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

// Sync, devices and billing are run from the app, where a signed-in device holds Sync's keys.
function PapelizAccountAppManagedSection({ papelizAccountSectionId }: { papelizAccountSectionId: Exclude<PapelizAccountSectionId, 'profile'> }) {
  const papelizAccountSectionHeading = papelizAccountSectionId === 'sync' ? 'Sync' : papelizAccountSectionId === 'devices' ? 'Devices' : 'Billing'
  return (
    <>
      <h1 className="mt-[22px] mb-2.5 text-[22px] font-[650] tracking-[-0.02em] md:mt-0 md:mb-[22px] md:text-[29px]">{papelizAccountSectionHeading}</h1>
      {papelizAccountSectionId === 'sync' && (
        <>
          <PapelizAccountSectionIntro>Your vaults on every device, encrypted before they leave it.</PapelizAccountSectionIntro>
          <PapelizAccountRowGroup>
            <PapelizAccountRow
              papelizAccountRowTitle="Plan and storage"
              papelizAccountRowValue="Choose a plan and set up Sync in Papeliz: Settings › Sync. Papeliz keeps working without it."
              papelizAccountRowAction={<PapelizAccountOpenAppAction />}
            />
          </PapelizAccountRowGroup>
        </>
      )}
      {papelizAccountSectionId === 'devices' && (
        <>
          <PapelizAccountSectionIntro>Devices signed in to Sync. Removing one signs it out; its notes stay on it.</PapelizAccountSectionIntro>
          <PapelizAccountRowGroup>
            <PapelizAccountRow
              papelizAccountRowTitle="Your devices"
              papelizAccountRowValue="See, rename and remove devices in Papeliz: Settings › Account."
              papelizAccountRowAction={<PapelizAccountOpenAppAction />}
            />
            <PapelizAccountRow
              papelizAccountRowTitle="Add a device"
              papelizAccountRowValue="Get Papeliz for your computer or phone with Download, then sign in to Sync there."
            />
          </PapelizAccountRowGroup>
        </>
      )}
      {papelizAccountSectionId === 'billing' && (
        <PapelizAccountRowGroup>
          <PapelizAccountRow
            papelizAccountRowTitle="Billing"
            papelizAccountRowValue="Invoices and your payment method open from Papeliz: Settings › Sync › Manage billing."
            papelizAccountRowAction={<PapelizAccountOpenAppAction />}
          />
        </PapelizAccountRowGroup>
      )}
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
      <PapelizAccountAppManagedSection papelizAccountSectionId={chosenPapelizAccountSectionId} />
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
