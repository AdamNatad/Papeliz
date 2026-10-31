'use client'

import { useAuth, useClerk, useSession, useUser } from '@clerk/react'
import { ArrowLeft, Check, ChevronRight, CreditCard, FingerprintPattern, Laptop, Mail, Power, RefreshCw, UserRound, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { IconType } from 'react-icons'
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
  papelizAccountDeleteAfterSignInParameterName,
  papelizAccountDeletedParameterName,
  papelizAccountFreshSignInMinutes,
  papelizAccountPagePath,
  papelizAccountSupportPath,
  readPapelizAccountPasskeysAreOn,
} from './papeliz-account-config'
import { PapelizAccountBillingSection } from './papeliz-account-billing-section'
import { PapelizAccountDevicesSection, usePapelizAccountSyncDeviceList, type PapelizAccountSyncDeviceList } from './papeliz-account-devices-section'
import { PapelizAccountDialog } from './papeliz-account-dialog'
import { PapelizAccountPhoneLaunchButtons, PapelizAccountSidebarLaunchButton } from './papeliz-account-launch-menu'
import { PapelizAccountRow, PapelizAccountRowGroup, papelizAccountPhoneChevronRowActionClassName } from './papeliz-account-rows'
import type { PapelizAccountSyncService } from './papeliz-account-sync-service'
import { PapelizAccountSyncPlansSection } from './papeliz-account-sync-plans-section'

type PapelizAccountSectionId = 'profile' | 'sync' | 'devices' | 'billing'

const papelizAccountSections: readonly { papelizAccountSectionId: PapelizAccountSectionId; papelizAccountSectionLabel: string; PapelizAccountSectionIcon: LucideIcon }[] = [
  { papelizAccountSectionId: 'profile', papelizAccountSectionLabel: 'Profile', PapelizAccountSectionIcon: UserRound },
  { papelizAccountSectionId: 'sync', papelizAccountSectionLabel: 'Sync', PapelizAccountSectionIcon: RefreshCw },
  { papelizAccountSectionId: 'devices', papelizAccountSectionLabel: 'Devices', PapelizAccountSectionIcon: Laptop },
  { papelizAccountSectionId: 'billing', papelizAccountSectionLabel: 'Billing', PapelizAccountSectionIcon: CreditCard },
]

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
  const closePapelizAccountDeleteDialog = () => setAccountDeleteStage({ accountDeleteStageKind: 'closed' })
  return (
    <>
      <PapelizAccountRow
        papelizAccountRowTitle="Delete Account"
        papelizAccountRowIsDanger
        papelizAccountRowAction={
          // A row like Contact Support on a phone, its label and a chevron; it confirms in a dialog
          // (Adam, 2026-10-31).
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setAccountDeleteStage({ accountDeleteStageKind: 'confirming' })}
            className={`${papelizAccountCompactDangerButtonClassName} ${papelizAccountRowActionWidthClassName} ${papelizAccountPhoneChevronRowActionClassName}`}
          >
            <span className="max-md:sr-only">Delete</span>
            <ChevronRight className="size-4 text-papeliz-ink-subtle md:hidden" aria-hidden="true" />
          </button>
        }
      />
      {accountDeleteStageKind !== 'closed' && (
        <PapelizAccountDialog
          papelizAccountDialogTitle={accountDeleteStageKind === 'fresh-sign-in-needed' ? 'Sign In Again to Continue' : 'Delete your account?'}
          onPapelizAccountDialogClose={() => {
            if (!accountDeleteIsRunning) closePapelizAccountDeleteDialog()
          }}
          papelizAccountDialogFooter={
            <>
              <button type="button" disabled={accountDeleteIsRunning} onClick={closePapelizAccountDeleteDialog} className={papelizAccountSecondaryButtonClassName}>
                Cancel
              </button>
              {accountDeleteStageKind === 'fresh-sign-in-needed' ? (
                <button type="button" onClick={signInAgainToDeletePapelizAccount} className={papelizAccountCompactPrimaryButtonClassName}>
                  Sign In Again
                </button>
              ) : (
                <button type="button" disabled={accountDeleteIsRunning} onClick={() => void deletePapelizAccount()} className={papelizAccountCompactDangerButtonClassName}>
                  {accountDeleteIsRunning ? 'Deleting…' : accountDeleteStageKind === 'failed' ? 'Try Again' : 'Delete Account'}
                </button>
              )}
            </>
          }
        >
          <p>
            {accountDeleteStageKind === 'fresh-sign-in-needed'
              ? 'Deleting your account can’t be undone, so it needs a sign-in from the last 10 minutes. Sign in again, and this opens again so you can finish.'
              : 'Deletes your account, your Sync subscription and every synced copy. The notes on your devices stay. This can’t be undone.'}
          </p>
          {accountDeleteStage.accountDeleteStageKind === 'failed' && (
            <p role="alert" className="text-papeliz-diff-removed-ink">
              {accountDeleteStage.accountDeleteFailureMessage}
            </p>
          )}
        </PapelizAccountDialog>
      )}
    </>
  )
}

// Connected, in muted green and the size of a row's button, so it lines up with Connect and Add
// (Adam, 2026-10-31). A status, not a button: there is nothing to press.
function PapelizAccountSignInWayConnectedStatus() {
  return (
    <span
      className={`inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-papeliz-diff-added px-3 text-[13px] font-semibold whitespace-nowrap text-papeliz-diff-added-ink ${papelizAccountRowActionWidthClassName}`}
    >
      <Check className="size-3.5" aria-hidden="true" />
      Connected
    </span>
  )
}

type PapelizAccountSignInProvider = 'google' | 'apple'

const papelizAccountSignInProviders: readonly { signInProvider: PapelizAccountSignInProvider; signInProviderName: string; SignInProviderIcon: IconType }[] = [
  { signInProvider: 'google', signInProviderName: 'Google', SignInProviderIcon: FcGoogle },
  { signInProvider: 'apple', signInProviderName: 'Apple', SignInProviderIcon: FaApple },
]

// One way to sign in: its icon, its name over what it uses, then Connected, Connect or Add on the right.
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
  papelizAccountPhoneLeaveCard,
}: {
  papelizAccountSyncService: PapelizAccountSyncService
  isPapelizAccountDeleteOpenedAfterSignIn: boolean
  // Back to Main Site and Sign Out, on a phone; on Profile it comes before Contact Support and
  // Delete Account (Adam, 2026-10-31).
  papelizAccountPhoneLeaveCard: ReactNode
}) {
  const papelizAccountClerk = useClerk()
  const { user } = useUser()
  const [passkeyMessage, setPasskeyMessage] = useState<string | null>(null)
  const [passkeyIsBeingAdded, setPasskeyIsBeingAdded] = useState(false)
  const [signInProviderBeingConnected, setSignInProviderBeingConnected] = useState<PapelizAccountSignInProvider | null>(null)
  const [signInProviderConnectMessages, setSignInProviderConnectMessages] = useState<Partial<Record<PapelizAccountSignInProvider, string>>>({})
  if (!user) return null
  const papelizAccountPrimaryEmailAddress = user.primaryEmailAddress?.emailAddress ?? null
  const papelizAccountEmailAddress = papelizAccountPrimaryEmailAddress ?? 'No email'
  const passkeyCount = user.passkeys.length
  const papelizAccountPasskeysAreOn = readPapelizAccountPasskeysAreOn(papelizAccountClerk)

  // Connect: Clerk links Google or Apple to this account, by way of the provider's own page, which
  // sends the browser back here. A link that never finished is tried again rather than made twice.
  async function connectPapelizAccountSignInProvider(signInProvider: PapelizAccountSignInProvider) {
    if (!user) return
    setSignInProviderBeingConnected(signInProvider)
    setSignInProviderConnectMessages((currentConnectMessages) => ({ ...currentConnectMessages, [signInProvider]: undefined }))
    try {
      const papelizAccountReturnAddress = new URL(papelizAccountPagePath, window.location.origin).href
      const unfinishedExternalAccount = user.externalAccounts.find((externalAccount) => externalAccount.provider === signInProvider)
      const linkingExternalAccount = unfinishedExternalAccount
        ? await unfinishedExternalAccount.reauthorize({ redirectUrl: papelizAccountReturnAddress })
        : await user.createExternalAccount({ strategy: `oauth_${signInProvider}`, redirectUrl: papelizAccountReturnAddress })
      const signInProviderAddress = linkingExternalAccount.verification?.externalVerificationRedirectURL
      if (!signInProviderAddress) throw new Error('Connecting didn’t start. Try again.')
      window.location.assign(signInProviderAddress.href)
    } catch (signInProviderConnectError) {
      setSignInProviderConnectMessages((currentConnectMessages) => ({
        ...currentConnectMessages,
        [signInProvider]: readPapelizAccountClerkError(signInProviderConnectError).clerkErrorMessage,
      }))
      setSignInProviderBeingConnected(null)
    }
  }

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
              {/* Google and Apple always show: Connected when linked, Connect when not (Adam, 2026-10-31). */}
              {papelizAccountSignInProviders.map(({ signInProvider, signInProviderName, SignInProviderIcon }) => {
                const connectedExternalAccount = user.externalAccounts.find(
                  (externalAccount) => externalAccount.provider === signInProvider && externalAccount.verification?.status === 'verified',
                )
                const signInProviderIsBeingConnected = signInProviderBeingConnected === signInProvider
                return (
                  <PapelizAccountSignInWayLine
                    key={signInProvider}
                    signInWayIcon={<SignInProviderIcon className="size-4" aria-hidden="true" />}
                    signInWayName={signInProviderName}
                    signInWayDetail={
                      connectedExternalAccount
                        ? connectedExternalAccount.emailAddress || papelizAccountPrimaryEmailAddress || `Your ${signInProviderName} account`
                        : (signInProviderConnectMessages[signInProvider] ?? 'Not connected')
                    }
                    signInWayDetailIsAnnounced={!connectedExternalAccount}
                    signInWayAction={
                      connectedExternalAccount ? (
                        <PapelizAccountSignInWayConnectedStatus />
                      ) : (
                        <button
                          type="button"
                          aria-label={`Connect ${signInProviderName}`}
                          disabled={signInProviderBeingConnected !== null}
                          onClick={() => void connectPapelizAccountSignInProvider(signInProvider)}
                          className={`${papelizAccountCompactPrimaryButtonClassName} ${papelizAccountRowActionWidthClassName}`}
                        >
                          {signInProviderIsBeingConnected ? 'Connecting…' : 'Connect'}
                        </button>
                      )
                    }
                  />
                )
              })}
              <PapelizAccountSignInWayLine
                signInWayIcon={<Mail className="size-4 text-papeliz-ink-muted" aria-hidden="true" />}
                signInWayName="Email code"
                signInWayDetail={papelizAccountPrimaryEmailAddress ? `A code sent to ${papelizAccountPrimaryEmailAddress}` : 'A code sent to your email'}
                signInWayAction={<PapelizAccountSignInWayConnectedStatus />}
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
      {papelizAccountPhoneLeaveCard}
      <PapelizAccountRowGroup>
        <PapelizAccountRow
          papelizAccountRowTitle="Contact Support"
          papelizAccountRowAction={
            <a
              href={papelizAccountSupportPath}
              className={`${papelizAccountCompactPrimaryButtonClassName} ${papelizAccountRowActionWidthClassName} ${papelizAccountPhoneChevronRowActionClassName}`}
            >
              <span className="max-md:sr-only">Contact Us</span>
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

// Sync shows the plans to buy; Devices lists the devices signed in to Sync, with Remove (Adam,
// 2026-10-31); Billing lists what it covers.
function PapelizAccountPlansDevicesAndBillingSection({
  papelizAccountSectionId,
  papelizAccountSyncService,
  papelizAccountSyncDeviceList,
}: {
  papelizAccountSectionId: Exclude<PapelizAccountSectionId, 'profile'>
  papelizAccountSyncService: PapelizAccountSyncService
  papelizAccountSyncDeviceList: PapelizAccountSyncDeviceList
}) {
  const papelizAccountSectionHeading = papelizAccountSectionId === 'sync' ? 'Sync' : papelizAccountSectionId === 'devices' ? 'Devices' : 'Billing'
  return (
    <>
      <h1 className="mt-[22px] mb-2.5 text-[22px] font-[650] tracking-[-0.02em] md:mt-0 md:mb-[22px] md:text-[29px]">{papelizAccountSectionHeading}</h1>
      {papelizAccountSectionId === 'sync' && <PapelizAccountSyncPlansSection />}
      {papelizAccountSectionId === 'devices' && (
        <PapelizAccountDevicesSection papelizAccountSyncService={papelizAccountSyncService} papelizAccountSyncDeviceList={papelizAccountSyncDeviceList} />
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
  const [chosenPapelizAccountSectionId, setChosenPapelizAccountSectionId] = useState<PapelizAccountSectionId>('profile')
  const [papelizAccountIsSigningOut, setPapelizAccountIsSigningOut] = useState(false)
  const papelizAccountSyncDeviceList = usePapelizAccountSyncDeviceList(papelizAccountSyncService)

  function signOutOfPapelizAccount() {
    setPapelizAccountIsSigningOut(true)
    void papelizAccountClerk.signOut({ redirectUrl: papelizAccountPagePath })
  }

  const papelizAccountPhoneCardActionClassName =
    'flex min-h-[52px] w-full cursor-pointer items-center gap-3 border-b border-papeliz-line px-3.5 text-left text-[14.5px] font-semibold text-papeliz-ink transition-colors last:border-b-0 hover:bg-papeliz-hover active:bg-papeliz-press disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-papeliz-blue'
  // Back to Main Site and Sign Out in a card of their own on a phone (Adam, 2026-10-31): before
  // Contact Support on Profile, under the section everywhere else.
  const papelizAccountPhoneLeaveCard = (
    <PapelizAccountRowGroup isPapelizAccountRowGroupPhoneOnly>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full page load leaves Clerk behind on this page */}
      <a href="/" className={papelizAccountPhoneCardActionClassName}>
        <ArrowLeft className="size-[18px] shrink-0 text-papeliz-ink-muted" aria-hidden="true" />
        Back to Main Site
      </a>
      <button type="button" disabled={papelizAccountIsSigningOut} onClick={signOutOfPapelizAccount} className={papelizAccountPhoneCardActionClassName}>
        <Power className="size-[18px] shrink-0 text-papeliz-ink-muted" aria-hidden="true" />
        {papelizAccountIsSigningOut ? 'Signing Out…' : 'Sign Out'}
      </button>
    </PapelizAccountRowGroup>
  )
  const papelizAccountSectionContent =
    chosenPapelizAccountSectionId === 'profile' ? (
      <PapelizAccountProfileSection
        papelizAccountSyncService={papelizAccountSyncService}
        isPapelizAccountDeleteOpenedAfterSignIn={isPapelizAccountDeleteOpenedAfterSignIn}
        papelizAccountPhoneLeaveCard={papelizAccountPhoneLeaveCard}
      />
    ) : (
      <PapelizAccountPlansDevicesAndBillingSection
        papelizAccountSectionId={chosenPapelizAccountSectionId}
        papelizAccountSyncService={papelizAccountSyncService}
        papelizAccountSyncDeviceList={papelizAccountSyncDeviceList}
      />
    )
  // On a computer: a light tint and shadow on hover, pressed in a little when clicked, and Sign Out
  // turns red on hover.
  const papelizAccountSidebarActionClassName =
    '-mx-2.5 flex min-h-[38px] cursor-pointer items-center gap-[9px] rounded-lg px-2.5 py-1 text-base font-medium text-papeliz-ink-muted transition-[color,background-color,box-shadow,scale] duration-150 ease-out hover:bg-papeliz-hover hover:shadow-[0_1px_3px_rgb(0_0_0/0.18)] active:scale-[0.99] active:bg-papeliz-press disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100'

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
            <a href="/" className={`${papelizAccountSidebarActionClassName} hover:text-papeliz-ink`}>
              <ArrowLeft className="size-[19px] shrink-0" aria-hidden="true" />
              Back to Main Site
            </a>
            <button
              type="button"
              disabled={papelizAccountIsSigningOut}
              onClick={signOutOfPapelizAccount}
              className={`${papelizAccountSidebarActionClassName} enabled:hover:text-papeliz-diff-removed-ink`}
            >
              <Power className="size-[19px] shrink-0" aria-hidden="true" />
              {papelizAccountIsSigningOut ? 'Signing Out…' : 'Sign Out'}
            </button>
          </div>
        </aside>
        <section className="min-w-0 pt-11 pb-16 pl-[52px]">{papelizAccountSectionContent}</section>
      </div>

      {/* A phone: the header, Launch and Download, the sections as tabs, then grouped rows. */}
      <div className="mx-auto max-w-[480px] px-4 pb-6 md:hidden">
        <div className="flex h-[62px] items-center">
          <PapelizAccountBrand papelizAccountBrandSize="small" />
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
        {chosenPapelizAccountSectionId !== 'profile' && <div className="mt-3 px-0.5">{papelizAccountPhoneLeaveCard}</div>}
      </div>
    </>
  )
}
