'use client'

import { useClerk, useUser } from '@clerk/react'
import { ChevronRight } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  papelizAccountCompactPrimaryButtonClassName,
  papelizAccountFieldLabelClassName,
  papelizAccountRowActionWidthClassName,
  papelizAccountSecondaryButtonClassName,
  papelizAccountTextFieldClassName,
  papelizAccountTextLinkClassName,
} from './papeliz-account-card-frame'
import { PapelizAccountCodeBoxes, papelizAccountEmailCodeLength } from './papeliz-account-code-boxes'
import { papelizAccountClerkErrorCodes, readPapelizAccountClerkError } from './papeliz-account-clerk-errors'
import { papelizAccountChangeProfileDetailAfterSignInParameterName, papelizAccountPagePath, type PapelizAccountProfileDetailKind } from './papeliz-account-config'
import { PapelizAccountDialog } from './papeliz-account-dialog'
import { PapelizAccountRow, papelizAccountPhoneChevronRowActionClassName } from './papeliz-account-rows'

// Profile's Email and Username rows, each with Change (Adam, 2026-11-01: "can we make changing email
// and Username available? … does clerk has some kind of option to send an otp to the new mail?"). A
// new email gets a 6-digit code from Clerk and replaces the old one only once the code is entered; a
// username follows the same rules as at sign-up. When Clerk asks for a recent sign-in first, the
// dialog says so, and it opens again after signing in.

type PapelizAccountUser = NonNullable<ReturnType<typeof useUser>['user']>
type PapelizAccountUserEmailAddress = PapelizAccountUser['emailAddresses'][number]

const papelizAccountProfileDetailNames: Record<PapelizAccountProfileDetailKind, string> = { email: 'Email', username: 'Username' }

// The wait before Send a new code works again, as on the sign-in card.
const papelizAccountEmailChangeResendWaitMilliseconds = 30_000

const papelizAccountEmailAddressPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// A row's Change: a white button on a computer; on a phone the row's chevron, the whole row taking
// the tap, like Contact Support and Delete Account.
function PapelizAccountProfileDetailChangeButton({
  profileDetailKind,
  onProfileDetailChangeOpen,
}: {
  profileDetailKind: PapelizAccountProfileDetailKind
  onProfileDetailChangeOpen: () => void
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={`Change ${papelizAccountProfileDetailNames[profileDetailKind]}`}
      onClick={onProfileDetailChangeOpen}
      className={`${papelizAccountSecondaryButtonClassName} ${papelizAccountRowActionWidthClassName} ${papelizAccountPhoneChevronRowActionClassName} max-md:border-0`}
    >
      <span className="max-md:sr-only">Change</span>
      <ChevronRight className="size-4 text-papeliz-ink-subtle md:hidden" aria-hidden="true" />
    </button>
  )
}

// Clerk asked for a recent sign-in: sign out and back in, then this change opens again.
function PapelizAccountProfileDetailFreshSignInDialog({
  profileDetailKind,
  closeProfileDetailDialog,
}: {
  profileDetailKind: PapelizAccountProfileDetailKind
  closeProfileDetailDialog: () => void
}) {
  const papelizAccountClerk = useClerk()
  return (
    <PapelizAccountDialog
      papelizAccountDialogTitle="Confirm It’s You"
      onPapelizAccountDialogClose={closeProfileDetailDialog}
      papelizAccountDialogClosesOnlyFromItsButtons
      papelizAccountDialogFooter={
        <>
          <button type="button" onClick={closeProfileDetailDialog} className={papelizAccountSecondaryButtonClassName}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              void papelizAccountClerk.signOut({ redirectUrl: `${papelizAccountPagePath}?${papelizAccountChangeProfileDetailAfterSignInParameterName}=${profileDetailKind}` })
            }
            className={papelizAccountCompactPrimaryButtonClassName}
          >
            Sign In Again
          </button>
        </>
      }
    >
      <p>
        Changing your {profileDetailKind === 'email' ? 'email' : 'username'} needs a recent sign-in. Sign in again, and this opens again so you can finish.
      </p>
    </PapelizAccountDialog>
  )
}

function PapelizAccountProfileDetailFailure({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-papeliz-diff-removed-ink">
      {children}
    </p>
  )
}

type PapelizAccountEmailChangeStage =
  | { emailChangeStageKind: 'entering' }
  | { emailChangeStageKind: 'verifying'; newEmailAddressRecord: PapelizAccountUserEmailAddress }
  | { emailChangeStageKind: 'changed'; newEmailAddress: string; oldEmailAddressStays: boolean }
  | { emailChangeStageKind: 'fresh-sign-in-needed' }

// Change Email: the new address, then the code Clerk sends it, then it becomes the account's email and
// the old address goes. An old address a connected Google or Apple account uses stays as a second one.
function PapelizAccountEmailChangeDialog({ user, closeEmailChangeDialog }: { user: PapelizAccountUser; closeEmailChangeDialog: () => void }) {
  const [emailChangeStage, setEmailChangeStage] = useState<PapelizAccountEmailChangeStage>({ emailChangeStageKind: 'entering' })
  const [typedNewEmailAddress, setTypedNewEmailAddress] = useState('')
  const [typedEmailChangeCode, setTypedEmailChangeCode] = useState('')
  const [emailChangeFailureMessage, setEmailChangeFailureMessage] = useState<string | null>(null)
  const [emailChangeIsWorking, setEmailChangeIsWorking] = useState(false)
  const emailChangeIsWorkingRef = useRef(false)
  const [emailChangeResendAvailableAt, setEmailChangeResendAvailableAt] = useState(0)
  const [emailChangeCurrentTime, setEmailChangeCurrentTime] = useState(() => Date.now())
  const newEmailAddressFieldId = useId()
  const emailChangeCodeFieldId = useId()
  const emailChangeFormId = useId()
  const currentEmailAddress = user.primaryEmailAddress?.emailAddress ?? null
  const emailChangeResendSecondsLeft = Math.max(0, Math.ceil((emailChangeResendAvailableAt - emailChangeCurrentTime) / 1000))

  useEffect(() => {
    if (emailChangeResendAvailableAt <= Date.now()) return
    const emailChangeResendTimer = window.setInterval(() => setEmailChangeCurrentTime(Date.now()), 1000)
    return () => window.clearInterval(emailChangeResendTimer)
  }, [emailChangeResendAvailableAt])

  // One step at a time; Clerk's answers become this dialog's words.
  async function runPapelizAccountEmailChangeStep(emailChangeStep: () => Promise<void>) {
    if (emailChangeIsWorkingRef.current) return
    emailChangeIsWorkingRef.current = true
    setEmailChangeIsWorking(true)
    setEmailChangeFailureMessage(null)
    try {
      await emailChangeStep()
    } catch (emailChangeError) {
      const { clerkErrorCode, clerkErrorMessage } = readPapelizAccountClerkError(emailChangeError)
      if (clerkErrorCode === papelizAccountClerkErrorCodes.reverificationRequired) {
        setEmailChangeStage({ emailChangeStageKind: 'fresh-sign-in-needed' })
      } else {
        setEmailChangeFailureMessage(
          clerkErrorCode === papelizAccountClerkErrorCodes.identifierAlreadyUsed
            ? 'Another account already uses that email.'
            : clerkErrorCode === papelizAccountClerkErrorCodes.codeIncorrect
              ? 'That code isn’t right. Check it and try again.'
              : clerkErrorCode === papelizAccountClerkErrorCodes.codeExpired
                ? 'That code has expired. Send a new one.'
                : clerkErrorMessage,
        )
      }
    } finally {
      emailChangeIsWorkingRef.current = false
      setEmailChangeIsWorking(false)
    }
  }

  async function makePapelizAccountEmailAddressPrimary(newEmailAddressRecord: PapelizAccountUserEmailAddress) {
    const oldEmailAddressRecord = user.primaryEmailAddress
    await user.update({ primaryEmailAddressId: newEmailAddressRecord.id })
    let oldEmailAddressStays = false
    if (oldEmailAddressRecord && oldEmailAddressRecord.id !== newEmailAddressRecord.id) {
      if (oldEmailAddressRecord.linkedTo.length > 0) {
        oldEmailAddressStays = true
      } else {
        await oldEmailAddressRecord.destroy().catch(() => {
          oldEmailAddressStays = true
        })
      }
    }
    setEmailChangeStage({ emailChangeStageKind: 'changed', newEmailAddress: newEmailAddressRecord.emailAddress, oldEmailAddressStays })
  }

  function sendPapelizAccountEmailChangeCode(submitEvent?: FormEvent) {
    submitEvent?.preventDefault()
    const newEmailAddress = typedNewEmailAddress.trim()
    if (!papelizAccountEmailAddressPattern.test(newEmailAddress)) {
      setEmailChangeFailureMessage('Enter an email address, like name@example.com.')
      return
    }
    if (currentEmailAddress && newEmailAddress.toLowerCase() === currentEmailAddress.toLowerCase()) {
      setEmailChangeFailureMessage('That’s already your email.')
      return
    }
    void runPapelizAccountEmailChangeStep(async () => {
      // An address left from an earlier try is used again rather than added twice.
      const newEmailAddressRecord =
        user.emailAddresses.find((userEmailAddressRecord) => userEmailAddressRecord.emailAddress.toLowerCase() === newEmailAddress.toLowerCase()) ??
        (await user.createEmailAddress({ email: newEmailAddress }))
      if (newEmailAddressRecord.verification.status === 'verified') {
        await makePapelizAccountEmailAddressPrimary(newEmailAddressRecord)
        return
      }
      await newEmailAddressRecord.prepareVerification({ strategy: 'email_code' })
      setTypedEmailChangeCode('')
      setEmailChangeResendAvailableAt(Date.now() + papelizAccountEmailChangeResendWaitMilliseconds)
      setEmailChangeCurrentTime(Date.now())
      setEmailChangeStage({ emailChangeStageKind: 'verifying', newEmailAddressRecord })
    })
  }

  function confirmPapelizAccountEmailChangeCode(emailChangeCode: string, submitEvent?: FormEvent) {
    submitEvent?.preventDefault()
    if (emailChangeStage.emailChangeStageKind !== 'verifying' || emailChangeCode.length !== papelizAccountEmailCodeLength) return
    const { newEmailAddressRecord } = emailChangeStage
    void runPapelizAccountEmailChangeStep(async () => {
      const verifiedEmailAddressRecord = await newEmailAddressRecord.attemptVerification({ code: emailChangeCode })
      if (verifiedEmailAddressRecord.verification.status !== 'verified') throw new Error('That code didn’t confirm the email. Try again.')
      await makePapelizAccountEmailAddressPrimary(verifiedEmailAddressRecord)
    })
  }

  function resendPapelizAccountEmailChangeCode() {
    if (emailChangeStage.emailChangeStageKind !== 'verifying') return
    const { newEmailAddressRecord } = emailChangeStage
    void runPapelizAccountEmailChangeStep(async () => {
      await newEmailAddressRecord.prepareVerification({ strategy: 'email_code' })
      setTypedEmailChangeCode('')
      setEmailChangeResendAvailableAt(Date.now() + papelizAccountEmailChangeResendWaitMilliseconds)
      setEmailChangeCurrentTime(Date.now())
    })
  }

  const closeUnlessWorking = () => {
    if (!emailChangeIsWorking) closeEmailChangeDialog()
  }

  if (emailChangeStage.emailChangeStageKind === 'fresh-sign-in-needed') {
    return <PapelizAccountProfileDetailFreshSignInDialog profileDetailKind="email" closeProfileDetailDialog={closeEmailChangeDialog} />
  }

  if (emailChangeStage.emailChangeStageKind === 'changed') {
    return (
      <PapelizAccountDialog
        papelizAccountDialogTitle="Email Changed"
        onPapelizAccountDialogClose={closeEmailChangeDialog}
        papelizAccountDialogFooter={
          <button type="button" onClick={closeEmailChangeDialog} className={papelizAccountCompactPrimaryButtonClassName}>
            Done
          </button>
        }
      >
        <p role="status">
          From now on, sign in and get codes at <b className="font-semibold break-all text-papeliz-ink">{emailChangeStage.newEmailAddress}</b>.
        </p>
        {emailChangeStage.oldEmailAddressStays && <p>Your old address stays on the account as a second email, because a connected Google or Apple account uses it.</p>}
      </PapelizAccountDialog>
    )
  }

  if (emailChangeStage.emailChangeStageKind === 'verifying') {
    return (
      <PapelizAccountDialog
        papelizAccountDialogTitle="Change Email"
        onPapelizAccountDialogClose={closeUnlessWorking}
        papelizAccountDialogFooter={
          <>
            <button type="button" disabled={emailChangeIsWorking} onClick={closeEmailChangeDialog} className={papelizAccountSecondaryButtonClassName}>
              Cancel
            </button>
            <button
              type="submit"
              form={emailChangeFormId}
              disabled={emailChangeIsWorking || typedEmailChangeCode.length !== papelizAccountEmailCodeLength}
              className={papelizAccountCompactPrimaryButtonClassName}
            >
              {emailChangeIsWorking ? 'Confirming…' : 'Confirm'}
            </button>
          </>
        }
      >
        <p>
          Enter the 6-digit code sent to <b className="font-semibold break-all text-papeliz-ink">{emailChangeStage.newEmailAddressRecord.emailAddress}</b>.
        </p>
        <form id={emailChangeFormId} noValidate onSubmit={(submitEvent) => confirmPapelizAccountEmailChangeCode(typedEmailChangeCode, submitEvent)}>
          <label htmlFor={emailChangeCodeFieldId} className="sr-only">
            Code
          </label>
          <PapelizAccountCodeBoxes
            papelizAccountEmailCodeInputId={emailChangeCodeFieldId}
            papelizAccountEmailCode={typedEmailChangeCode}
            onPapelizAccountEmailCodeChange={(nextEmailChangeCode) => {
              setTypedEmailChangeCode(nextEmailChangeCode)
              if (emailChangeFailureMessage) setEmailChangeFailureMessage(null)
              if (nextEmailChangeCode.length === papelizAccountEmailCodeLength) confirmPapelizAccountEmailChangeCode(nextEmailChangeCode)
            }}
          />
        </form>
        {emailChangeFailureMessage && <PapelizAccountProfileDetailFailure>{emailChangeFailureMessage}</PapelizAccountProfileDetailFailure>}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[13px]">
          <button
            type="button"
            disabled={emailChangeIsWorking}
            onClick={() => {
              setEmailChangeFailureMessage(null)
              setEmailChangeStage({ emailChangeStageKind: 'entering' })
            }}
            className={papelizAccountTextLinkClassName}
          >
            Use a different email
          </button>
          <button
            type="button"
            disabled={emailChangeIsWorking || emailChangeResendSecondsLeft > 0}
            onClick={resendPapelizAccountEmailChangeCode}
            className={papelizAccountTextLinkClassName}
          >
            {emailChangeResendSecondsLeft > 0 ? `Send a new code in 0:${String(emailChangeResendSecondsLeft).padStart(2, '0')}` : 'Send a new code'}
          </button>
        </div>
      </PapelizAccountDialog>
    )
  }

  return (
    <PapelizAccountDialog
      papelizAccountDialogTitle="Change Email"
      onPapelizAccountDialogClose={closeUnlessWorking}
      papelizAccountDialogFooter={
        <>
          <button type="button" disabled={emailChangeIsWorking} onClick={closeEmailChangeDialog} className={papelizAccountSecondaryButtonClassName}>
            Cancel
          </button>
          <button type="submit" form={emailChangeFormId} disabled={emailChangeIsWorking} className={papelizAccountCompactPrimaryButtonClassName}>
            {emailChangeIsWorking ? 'Sending…' : 'Send Code'}
          </button>
        </>
      }
    >
      <p>
        {currentEmailAddress ? (
          <>
            Your email is <b className="font-semibold break-all text-papeliz-ink">{currentEmailAddress}</b>.{' '}
          </>
        ) : null}
        A 6-digit code goes to the new address, and it replaces your email once you enter the code.
      </p>
      <form id={emailChangeFormId} noValidate onSubmit={sendPapelizAccountEmailChangeCode}>
        <label htmlFor={newEmailAddressFieldId} className={papelizAccountFieldLabelClassName}>
          New Email
        </label>
        <input
          id={newEmailAddressFieldId}
          type="email"
          required
          autoFocus
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="name@example.com"
          value={typedNewEmailAddress}
          disabled={emailChangeIsWorking}
          onChange={(changeEvent) => {
            setTypedNewEmailAddress(changeEvent.target.value)
            if (emailChangeFailureMessage) setEmailChangeFailureMessage(null)
          }}
          className={`${papelizAccountTextFieldClassName} disabled:opacity-60`}
        />
      </form>
      {emailChangeFailureMessage && <PapelizAccountProfileDetailFailure>{emailChangeFailureMessage}</PapelizAccountProfileDetailFailure>}
    </PapelizAccountDialog>
  )
}

// Change Username: Clerk checks it as at sign-up, and a taken one is refused.
function PapelizAccountUsernameChangeDialog({ user, closeUsernameChangeDialog }: { user: PapelizAccountUser; closeUsernameChangeDialog: () => void }) {
  const [typedNewUsername, setTypedNewUsername] = useState(() => user.username ?? '')
  const [usernameChangeFailureMessage, setUsernameChangeFailureMessage] = useState<string | null>(null)
  const [usernameChangeIsWorking, setUsernameChangeIsWorking] = useState(false)
  const [usernameChangeNeedsFreshSignIn, setUsernameChangeNeedsFreshSignIn] = useState(false)
  const newUsernameFieldId = useId()
  const usernameChangeFormId = useId()
  const newUsername = typedNewUsername.trim()
  const newUsernameIsUnchanged = newUsername === (user.username ?? '')

  async function savePapelizAccountUsername(submitEvent: FormEvent) {
    submitEvent.preventDefault()
    if (usernameChangeIsWorking || !newUsername || newUsernameIsUnchanged) return
    setUsernameChangeIsWorking(true)
    setUsernameChangeFailureMessage(null)
    try {
      await user.update({ username: newUsername })
      closeUsernameChangeDialog()
    } catch (usernameChangeError) {
      const { clerkErrorCode, clerkErrorMessage } = readPapelizAccountClerkError(usernameChangeError)
      if (clerkErrorCode === papelizAccountClerkErrorCodes.reverificationRequired) setUsernameChangeNeedsFreshSignIn(true)
      else setUsernameChangeFailureMessage(clerkErrorCode === papelizAccountClerkErrorCodes.identifierAlreadyUsed ? 'That username is taken. Try another.' : clerkErrorMessage)
      setUsernameChangeIsWorking(false)
    }
  }

  if (usernameChangeNeedsFreshSignIn) {
    return <PapelizAccountProfileDetailFreshSignInDialog profileDetailKind="username" closeProfileDetailDialog={closeUsernameChangeDialog} />
  }

  return (
    <PapelizAccountDialog
      papelizAccountDialogTitle="Change Username"
      onPapelizAccountDialogClose={() => {
        if (!usernameChangeIsWorking) closeUsernameChangeDialog()
      }}
      papelizAccountDialogFooter={
        <>
          <button type="button" disabled={usernameChangeIsWorking} onClick={closeUsernameChangeDialog} className={papelizAccountSecondaryButtonClassName}>
            Cancel
          </button>
          <button
            type="submit"
            form={usernameChangeFormId}
            disabled={usernameChangeIsWorking || !newUsername || newUsernameIsUnchanged}
            className={papelizAccountCompactPrimaryButtonClassName}
          >
            {usernameChangeIsWorking ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <p>You can sign in with your username or your email.</p>
      <form id={usernameChangeFormId} noValidate onSubmit={(submitEvent) => void savePapelizAccountUsername(submitEvent)}>
        <label htmlFor={newUsernameFieldId} className={papelizAccountFieldLabelClassName}>
          New Username
        </label>
        <input
          id={newUsernameFieldId}
          type="text"
          required
          autoFocus
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={typedNewUsername}
          disabled={usernameChangeIsWorking}
          onChange={(changeEvent) => {
            setTypedNewUsername(changeEvent.target.value)
            if (usernameChangeFailureMessage) setUsernameChangeFailureMessage(null)
          }}
          className={`${papelizAccountTextFieldClassName} disabled:opacity-60`}
        />
      </form>
      {usernameChangeFailureMessage && <PapelizAccountProfileDetailFailure>{usernameChangeFailureMessage}</PapelizAccountProfileDetailFailure>}
    </PapelizAccountDialog>
  )
}

export function PapelizAccountEmailRow({ isEmailChangeOpenedAfterSignIn }: { isEmailChangeOpenedAfterSignIn: boolean }) {
  const { user } = useUser()
  const [emailChangeDialogIsOpen, setEmailChangeDialogIsOpen] = useState(isEmailChangeOpenedAfterSignIn)
  if (!user) return null
  return (
    <>
      <PapelizAccountRow
        papelizAccountRowTitle="Email"
        papelizAccountRowValue={user.primaryEmailAddress?.emailAddress ?? 'No email'}
        papelizAccountRowAction={<PapelizAccountProfileDetailChangeButton profileDetailKind="email" onProfileDetailChangeOpen={() => setEmailChangeDialogIsOpen(true)} />}
      />
      {emailChangeDialogIsOpen && <PapelizAccountEmailChangeDialog user={user} closeEmailChangeDialog={() => setEmailChangeDialogIsOpen(false)} />}
    </>
  )
}

export function PapelizAccountUsernameRow({ isUsernameChangeOpenedAfterSignIn }: { isUsernameChangeOpenedAfterSignIn: boolean }) {
  const { user } = useUser()
  const [usernameChangeDialogIsOpen, setUsernameChangeDialogIsOpen] = useState(isUsernameChangeOpenedAfterSignIn)
  if (!user?.username) return null
  return (
    <>
      <PapelizAccountRow
        papelizAccountRowTitle="Username"
        papelizAccountRowValue={user.username}
        papelizAccountRowAction={<PapelizAccountProfileDetailChangeButton profileDetailKind="username" onProfileDetailChangeOpen={() => setUsernameChangeDialogIsOpen(true)} />}
      />
      {usernameChangeDialogIsOpen && <PapelizAccountUsernameChangeDialog user={user} closeUsernameChangeDialog={() => setUsernameChangeDialogIsOpen(false)} />}
    </>
  )
}
