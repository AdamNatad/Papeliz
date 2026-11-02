'use client'

import { useClerk, useSignIn, useSignUp } from '@clerk/react'
import { Fingerprint } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { FaApple } from 'react-icons/fa6'
import { FcGoogle } from 'react-icons/fc'
import {
  PapelizAccountCardFrame,
  PapelizAccountCardMark,
  PapelizAccountCardNotice,
  PapelizAccountFieldError,
  PapelizAccountLegalLine,
  papelizAccountFieldLabelClassName,
  papelizAccountPrimaryButtonClassName,
  papelizAccountTextFieldClassName,
  papelizAccountTextLinkClassName,
} from './papeliz-account-card-frame'
import { papelizAccountClerkErrorCodes, readPapelizAccountClerkError } from './papeliz-account-clerk-errors'
import {
  PapelizAccountCodeBoxes,
  papelizAccountEmailCodeIncompleteMessage,
  papelizAccountEmailCodeLength,
  readPapelizAccountEmailCodeFieldErrorMessage,
} from './papeliz-account-code-boxes'
import {
  papelizAccountSignInWayStorageKey,
  papelizAccountSsoCallbackParameterName,
  readPapelizAccountPasskeysAreOn,
  type PapelizAccountSignInWay,
} from './papeliz-account-config'
import { isPapelizAccountSignUpWaitingOnlyForUsername, PapelizAccountChooseUsernameStep } from './papeliz-account-choose-username-step'
import { isPapelizAccountEmailAddressWellFormed, papelizAccountEmailAddressMalformedMessage } from './papeliz-account-email-address-check'
import { papelizAccountSsoPendingProviderStorageKey } from './papeliz-account-sso-callback'
import papelizAccountStyles from './papeliz-account.module.css'

type PapelizAccountSignInCardView = 'sign-in' | 'create' | 'sign-in-code' | 'create-code' | 'create-username'
type PapelizAccountSsoStrategy = 'oauth_google' | 'oauth_apple'

const papelizAccountResendWaitMilliseconds = 30_000

const papelizAccountSignInIdentifierErrorId = 'papeliz-account-sign-in-identifier-error'
const papelizAccountEmailCodeErrorId = 'papeliz-account-email-code-error'

function rememberPapelizAccountSignInWay(papelizAccountSignInWay: PapelizAccountSignInWay): void {
  try {
    window.sessionStorage.setItem(papelizAccountSignInWayStorageKey, papelizAccountSignInWay)
  } catch {
    // Without session storage the hand-over just doesn't name the way in.
  }
}

// Changes the card's step inside a view transition, so the parts both steps share glide to their
// new place instead of jumping. Without view transitions, or with reduced motion, it just changes.
function morphPapelizAccountSignInCard(signInCardUpdate: () => void) {
  if (
    typeof document.startViewTransition !== 'function' ||
    document.visibilityState !== 'visible' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    signInCardUpdate()
    return
  }
  let signInCardUpdateIsApplied = false
  const applySignInCardUpdateOnce = () => {
    if (signInCardUpdateIsApplied) return
    signInCardUpdateIsApplied = true
    signInCardUpdate()
  }
  const signInCardViewTransition = document.startViewTransition(() => flushSync(applySignInCardUpdateOnce))
  // A skipped transition still applies the change; only the animation is lost.
  void signInCardViewTransition.ready.catch(() => undefined)
  // A transition waits for the page's next frame. A page that isn't drawing any (a background tab)
  // would leave the card on its old step, so after a moment the step changes without the morph.
  window.setTimeout(() => {
    if (signInCardUpdateIsApplied) return
    signInCardViewTransition.skipTransition()
    applySignInCardUpdateOnce()
  }, 300)
}

// The page's address without the callback flags, so a finished sign-in lands back here with the
// app's hand-over state still in it.
function readPapelizAccountReturnUrl(): URL {
  const papelizAccountReturnUrl = new URL(window.location.href)
  papelizAccountReturnUrl.searchParams.delete(papelizAccountSsoCallbackParameterName)
  papelizAccountReturnUrl.hash = ''
  return papelizAccountReturnUrl
}

// Signed out: sign in, or create an account, with Google, Apple, a passkey, or a code by email.
// Passwords are off. Drawn by Papeliz on Clerk's custom-flow hooks. A new account's last step keeps
// the place it picked; the account page then makes its Sync account there.
export function PapelizAccountSignInCard() {
  const papelizAccountClerk = useClerk()
  const { signIn, fetchStatus: signInFetchStatus } = useSignIn()
  const { signUp, fetchStatus: signUpFetchStatus } = useSignUp()
  const [signInCardView, setSignInCardView] = useState<PapelizAccountSignInCardView>('sign-in')
  // Sign in takes an email or a username; Create takes an email, and the username after the code.
  const [signInIdentifier, setSignInIdentifier] = useState('')
  const [emailCodeSentToAddress, setEmailCodeSentToAddress] = useState('')
  const [signInEmailCode, setSignInEmailCode] = useState('')
  const [signInErrorMessage, setSignInErrorMessage] = useState<string | null>(null)
  const [signInNoticeMessage, setSignInNoticeMessage] = useState<string | null>(null)
  // The email-or-username field's own error and the code's, each drawn on its field (red, with its
  // line under it) instead of in the card's notice.
  const [signInIdentifierFieldErrorMessage, setSignInIdentifierFieldErrorMessage] = useState<string | null>(null)
  const [signInEmailCodeFieldErrorMessage, setSignInEmailCodeFieldErrorMessage] = useState<string | null>(null)
  const signInIdentifierFieldRef = useRef<HTMLInputElement>(null)
  const signInEmailCodeFieldRef = useRef<HTMLInputElement>(null)
  const [signInIsWorking, setSignInIsWorking] = useState(false)
  const [emailCodeResendAvailableAt, setEmailCodeResendAvailableAt] = useState(0)
  const [currentTimeMilliseconds, setCurrentTimeMilliseconds] = useState(() => Date.now())
  const signInOperationIsRunningRef = useRef(false)
  const papelizAccountPasskeysAreOn = readPapelizAccountPasskeysAreOn(papelizAccountClerk)
  const signInCardIsBusy = signInIsWorking || signInFetchStatus === 'fetching' || signUpFetchStatus === 'fetching'
  const signInCardIsCreating = signInCardView === 'create' || signInCardView === 'create-code'
  const signInCardIsCode = signInCardView === 'sign-in-code' || signInCardView === 'create-code'
  const emailCodeResendSecondsLeft = Math.max(0, Math.ceil((emailCodeResendAvailableAt - currentTimeMilliseconds) / 1000))

  useEffect(() => {
    if (emailCodeResendAvailableAt <= Date.now()) return
    const resendCountdownTimer = window.setInterval(() => setCurrentTimeMilliseconds(Date.now()), 1000)
    return () => window.clearInterval(resendCountdownTimer)
  }, [emailCodeResendAvailableAt])

  // A field can't take focus while the card is busy, so an error Clerk answered with moves focus to
  // its field once the card takes input again.
  useEffect(() => {
    if (signInCardIsBusy) return
    if (signInIdentifierFieldErrorMessage) signInIdentifierFieldRef.current?.focus()
    else if (signInEmailCodeFieldErrorMessage) signInEmailCodeFieldRef.current?.focus()
  }, [signInCardIsBusy, signInIdentifierFieldErrorMessage, signInEmailCodeFieldErrorMessage])

  function showPapelizAccountSignInIdentifierFieldError(signInIdentifierFieldError: string) {
    setSignInIdentifierFieldErrorMessage(signInIdentifierFieldError)
    signInIdentifierFieldRef.current?.focus()
  }

  function showPapelizAccountSignInEmailCodeFieldError(signInEmailCodeFieldError: string) {
    setSignInEmailCodeFieldErrorMessage(signInEmailCodeFieldError)
    signInEmailCodeFieldRef.current?.focus()
  }

  async function runPapelizAccountSignInStep(signInStep: () => Promise<void>) {
    if (signInOperationIsRunningRef.current) return
    signInOperationIsRunningRef.current = true
    setSignInIsWorking(true)
    setSignInErrorMessage(null)
    setSignInNoticeMessage(null)
    setSignInIdentifierFieldErrorMessage(null)
    setSignInEmailCodeFieldErrorMessage(null)
    try {
      await signInStep()
    } catch (signInStepError) {
      setSignInErrorMessage(readPapelizAccountClerkError(signInStepError).clerkErrorMessage)
    } finally {
      signInOperationIsRunningRef.current = false
      setSignInIsWorking(false)
    }
  }

  async function expectPapelizAccountClerkSuccess(clerkResultPromise: Promise<{ error: unknown }>) {
    const clerkResult = await clerkResultPromise
    if (clerkResult.error) throw clerkResult.error
  }

  // False when Clerk turned the code down as wrong or expired, which the boxes then show.
  async function expectPapelizAccountEmailCodeAccepted(emailCodeVerifyResultPromise: Promise<{ error: unknown }>): Promise<boolean> {
    const emailCodeVerifyResult = await emailCodeVerifyResultPromise
    if (!emailCodeVerifyResult.error) return true
    const emailCodeFieldErrorMessage = readPapelizAccountEmailCodeFieldErrorMessage(emailCodeVerifyResult.error)
    if (emailCodeFieldErrorMessage === null) throw emailCodeVerifyResult.error
    setSignInEmailCodeFieldErrorMessage(emailCodeFieldErrorMessage)
    return false
  }

  // Makes the new session active, then reloads this address so the page starts signed in.
  function navigateAfterPapelizAccountSignIn({ decorateUrl }: { decorateUrl: (papelizAccountUrl: string) => string }) {
    window.location.assign(decorateUrl(readPapelizAccountReturnUrl().href))
  }

  function startPapelizAccountEmailCodeWait() {
    setSignInEmailCode('')
    setEmailCodeResendAvailableAt(Date.now() + papelizAccountResendWaitMilliseconds)
    setCurrentTimeMilliseconds(Date.now())
  }

  async function sendPapelizAccountSignInEmailCode(signInIdentifierToUse: string) {
    const signInIdentifierIsEmailAddress = signInIdentifierToUse.includes('@')
    const signInCreateResult = await signIn.create({ identifier: signInIdentifierToUse })
    if (signInCreateResult.error) {
      const { clerkErrorCode } = readPapelizAccountClerkError(signInCreateResult.error)
      if (clerkErrorCode === papelizAccountClerkErrorCodes.identifierNotFound) {
        if (!signInIdentifierIsEmailAddress) {
          setSignInIdentifierFieldErrorMessage('No account uses this username. Check it, or sign in with your email.')
          return
        }
        morphPapelizAccountSignInCard(() => {
          setSignInCardView('create')
          // No "above" or "below" to get wrong.
          setSignInNoticeMessage('New here? Create your account with this email.')
        })
        return
      }
      throw signInCreateResult.error
    }
    await expectPapelizAccountClerkSuccess(signIn.emailCode.sendCode())
    // Signing in with a username, the code goes to the account's email, which Clerk shows masked.
    const emailCodeFirstFactor = signIn.supportedFirstFactors.find((signInFirstFactor) => signInFirstFactor.strategy === 'email_code')
    setEmailCodeSentToAddress(
      signInIdentifierIsEmailAddress
        ? signInIdentifierToUse
        : emailCodeFirstFactor && 'safeIdentifier' in emailCodeFirstFactor
          ? emailCodeFirstFactor.safeIdentifier
          : 'your email',
    )
    rememberPapelizAccountSignInWay('email-code')
    morphPapelizAccountSignInCard(() => {
      startPapelizAccountEmailCodeWait()
      setSignInCardView('sign-in-code')
    })
  }

  async function sendPapelizAccountSignUpEmailCode(signUpEmailAddressToUse: string) {
    const signUpCreateResult = await signUp.create({ emailAddress: signUpEmailAddressToUse, legalAccepted: true })
    if (signUpCreateResult.error) {
      const { clerkErrorCode } = readPapelizAccountClerkError(signUpCreateResult.error)
      if (clerkErrorCode === papelizAccountClerkErrorCodes.identifierAlreadyUsed) {
        morphPapelizAccountSignInCard(() => {
          setSignInCardView('sign-in')
          setSignInNoticeMessage('This email already has an account. Sign in below.')
        })
        return
      }
      throw signUpCreateResult.error
    }
    await expectPapelizAccountClerkSuccess(signUp.verifications.sendEmailCode())
    setEmailCodeSentToAddress(signUpEmailAddressToUse)
    rememberPapelizAccountSignInWay('email-code')
    morphPapelizAccountSignInCard(() => {
      startPapelizAccountEmailCodeWait()
      setSignInCardView('create-code')
    })
  }

  async function verifyPapelizAccountEmailCode(emailCodeToVerify: string) {
    if (signInCardView === 'sign-in-code') {
      if (!(await expectPapelizAccountEmailCodeAccepted(signIn.emailCode.verifyCode({ code: emailCodeToVerify })))) return
      if (signIn.status !== 'complete') throw new Error('Your account needs a check this page doesn’t offer yet. Try Google or Apple.')
      await expectPapelizAccountClerkSuccess(signIn.finalize({ navigate: navigateAfterPapelizAccountSignIn }))
      return
    }
    if (!(await expectPapelizAccountEmailCodeAccepted(signUp.verifications.verifyEmailCode({ code: emailCodeToVerify })))) return
    // The email is verified; the username comes next.
    if (isPapelizAccountSignUpWaitingOnlyForUsername(signUp)) {
      morphPapelizAccountSignInCard(() => setSignInCardView('create-username'))
      return
    }
    if (signUp.status !== 'complete') {
      throw new Error('Papeliz needs only your email and a username, but the sign-in service asked for more. Please contact support.')
    }
    await expectPapelizAccountClerkSuccess(signUp.finalize({ navigate: navigateAfterPapelizAccountSignIn }))
  }

  // The card checks its field before asking Clerk, and shows what's missing on the field itself.
  function submitPapelizAccountSignInCard(submitEvent: FormEvent) {
    submitEvent.preventDefault()
    if (signInOperationIsRunningRef.current) return
    if (signInCardIsCode) {
      const typedSignInEmailCode = signInEmailCode.trim()
      if (typedSignInEmailCode.length !== papelizAccountEmailCodeLength) {
        setSignInErrorMessage(null)
        showPapelizAccountSignInEmailCodeFieldError(papelizAccountEmailCodeIncompleteMessage)
        return
      }
      void runPapelizAccountSignInStep(() => verifyPapelizAccountEmailCode(typedSignInEmailCode))
      return
    }
    const trimmedSignInIdentifier = signInIdentifier.trim()
    // An identifier with an @ is an email to Clerk; a username can't have one.
    const signInIdentifierFieldError =
      trimmedSignInIdentifier === ''
        ? signInCardIsCreating
          ? 'Enter your email.'
          : 'Enter your email or username.'
        : (signInCardIsCreating || trimmedSignInIdentifier.includes('@')) && !isPapelizAccountEmailAddressWellFormed(trimmedSignInIdentifier)
          ? papelizAccountEmailAddressMalformedMessage
          : null
    if (signInIdentifierFieldError) {
      setSignInErrorMessage(null)
      showPapelizAccountSignInIdentifierFieldError(signInIdentifierFieldError)
      return
    }
    void runPapelizAccountSignInStep(async () => {
      if (signInCardIsCreating) await sendPapelizAccountSignUpEmailCode(trimmedSignInIdentifier)
      else await sendPapelizAccountSignInEmailCode(trimmedSignInIdentifier)
    })
  }

  function resendPapelizAccountEmailCode() {
    void runPapelizAccountSignInStep(async () => {
      if (signInCardView === 'sign-in-code') await expectPapelizAccountClerkSuccess(signIn.emailCode.sendCode())
      else await expectPapelizAccountClerkSuccess(signUp.verifications.sendEmailCode())
      startPapelizAccountEmailCodeWait()
      setSignInNoticeMessage('A new code is on its way.')
    })
  }

  function startPapelizAccountSso(papelizAccountSsoStrategy: PapelizAccountSsoStrategy) {
    void runPapelizAccountSignInStep(async () => {
      const papelizAccountSsoProviderName = papelizAccountSsoStrategy === 'oauth_google' ? 'Google' : 'Apple'
      rememberPapelizAccountSignInWay(papelizAccountSsoStrategy === 'oauth_google' ? 'google' : 'apple')
      try {
        window.sessionStorage.setItem(papelizAccountSsoPendingProviderStorageKey, papelizAccountSsoProviderName)
      } catch {
        // Without session storage a failed hand-back shows the plain sign-in card again.
      }
      const papelizAccountSsoReturnUrl = readPapelizAccountReturnUrl()
      const papelizAccountSsoCallbackUrl = new URL(papelizAccountSsoReturnUrl)
      papelizAccountSsoCallbackUrl.searchParams.set(papelizAccountSsoCallbackParameterName, '1')
      if (!papelizAccountClerk.client) throw new Error('Sign-in is still loading. Please try again.')
      // Google and Apple make a new account when there isn't one, so both cards use the same call.
      await papelizAccountClerk.client.signIn.authenticateWithRedirect({
        strategy: papelizAccountSsoStrategy,
        redirectUrl: papelizAccountSsoCallbackUrl.href,
        redirectUrlComplete: papelizAccountSsoReturnUrl.href,
      })
    })
  }

  function startPapelizAccountPasskeySignIn() {
    void runPapelizAccountSignInStep(async () => {
      rememberPapelizAccountSignInWay('passkey')
      await expectPapelizAccountClerkSuccess(signIn.passkey({ flow: 'discoverable' }))
      if (signIn.status !== 'complete') throw new Error('That passkey didn’t finish signing you in. Try another way.')
      await expectPapelizAccountClerkSuccess(signIn.finalize({ navigate: navigateAfterPapelizAccountSignIn }))
    })
  }

  function switchPapelizAccountSignInCardView(nextSignInCardView: PapelizAccountSignInCardView) {
    void runPapelizAccountSignInStep(async () => {
      if (signInCardIsCode) {
        await signIn.reset()
        await signUp.reset()
      }
      morphPapelizAccountSignInCard(() => {
        setSignInEmailCode('')
        // A username typed into Sign in isn't an email for Create.
        if (nextSignInCardView === 'create' && !signInIdentifier.includes('@')) setSignInIdentifier('')
        setSignInCardView(nextSignInCardView)
      })
    })
  }

  const signInCardHeading = signInCardIsCode ? 'Check your email' : signInCardIsCreating ? 'Create an account' : 'Sign in to your account'
  const signInProviderButtonClassName =
    'flex min-h-[42px] min-w-0 cursor-pointer items-center justify-center gap-2 px-2 text-[12.5px] font-semibold whitespace-nowrap text-papeliz-ink transition-[background-color,scale] duration-150 ease-out enabled:hover:bg-papeliz-surface-gray enabled:active:scale-[0.98] enabled:active:bg-papeliz-surface-gray-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-papeliz-blue'

  if (signInCardView === 'create-username') {
    return <PapelizAccountChooseUsernameStep papelizAccountVerifiedByProviderName={null} />
  }

  return (
    <PapelizAccountCardFrame>
      <PapelizAccountCardMark />
      <header className={`${papelizAccountStyles.papelizAccountMorphHeading} text-center`}>
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] text-balance">{signInCardHeading}</h1>
        {signInCardIsCode && (
          <p className="mx-auto mt-2 mb-[22px] max-w-[320px] text-[13px] text-balance text-papeliz-ink-muted">
            Enter the 6-digit code sent to <b className="font-semibold text-papeliz-ink">{emailCodeSentToAddress}</b>.
          </p>
        )}
        {signInCardView === 'sign-in' && (
          <p className="mx-auto mt-2 mb-[22px] max-w-[320px] text-[13px] text-balance text-papeliz-ink-muted">Keep your notes in sync on all your devices.</p>
        )}
        {signInCardView === 'create' && (
          <p className="mx-auto mt-2 mb-[22px] max-w-[320px] text-xs leading-[1.6] text-balance text-papeliz-ink-muted">A Papeliz account keeps your notes in sync.</p>
        )}
      </header>

      {!signInCardIsCode && (
        <>
          <div
            role="group"
            aria-label="Ways to sign in"
            className={`grid overflow-hidden rounded-[10px] border border-papeliz-line-strong bg-papeliz-surface-soft ${
              signInCardView === 'sign-in' && papelizAccountPasskeysAreOn ? 'grid-cols-3' : 'grid-cols-2'
            } [&>button+button]:border-l [&>button+button]:border-papeliz-line-strong`}
          >
            <button type="button" disabled={signInCardIsBusy} onClick={() => startPapelizAccountSso('oauth_google')} className={signInProviderButtonClassName}>
              <FcGoogle className="size-4 shrink-0" aria-hidden="true" />
              Google
            </button>
            <button type="button" disabled={signInCardIsBusy} onClick={() => startPapelizAccountSso('oauth_apple')} className={signInProviderButtonClassName}>
              <FaApple className="size-4 shrink-0" aria-hidden="true" />
              Apple
            </button>
            {signInCardView === 'sign-in' && papelizAccountPasskeysAreOn && (
              <button type="button" disabled={signInCardIsBusy} onClick={startPapelizAccountPasskeySignIn} className={signInProviderButtonClassName}>
                <Fingerprint className="size-4 shrink-0" aria-hidden="true" />
                Passkey
              </button>
            )}
          </div>
          <div
            className="my-4 flex items-center gap-3 text-[10px] font-bold tracking-[0.14em] text-papeliz-ink-subtle before:h-px before:flex-1 before:bg-papeliz-line after:h-px after:flex-1 after:bg-papeliz-line"
            aria-hidden="true"
          >
            OR
          </div>
        </>
      )}

      <form noValidate onSubmit={submitPapelizAccountSignInCard}>
        <fieldset disabled={signInCardIsBusy} className="m-0 min-w-0 border-0 p-0">
          {signInCardIsCode ? (
            <>
              <label htmlFor="papeliz-account-email-code" className={`${papelizAccountStyles.papelizAccountMorphFieldLabel} ${papelizAccountFieldLabelClassName}`}>
                Code
              </label>
              <PapelizAccountCodeBoxes
                papelizAccountCodeBoxesClassName={papelizAccountStyles.papelizAccountMorphField}
                papelizAccountEmailCodeInputId="papeliz-account-email-code"
                papelizAccountEmailCodeInputRef={signInEmailCodeFieldRef}
                papelizAccountEmailCode={signInEmailCode}
                papelizAccountEmailCodeErrorId={signInEmailCodeFieldErrorMessage ? papelizAccountEmailCodeErrorId : null}
                onPapelizAccountEmailCodeChange={(nextEmailCode) => {
                  setSignInEmailCode(nextEmailCode)
                  if (signInEmailCodeFieldErrorMessage) setSignInEmailCodeFieldErrorMessage(null)
                  if (nextEmailCode.length === papelizAccountEmailCodeLength && !signInOperationIsRunningRef.current) {
                    void runPapelizAccountSignInStep(() => verifyPapelizAccountEmailCode(nextEmailCode))
                  }
                }}
              />
              {signInEmailCodeFieldErrorMessage && (
                <PapelizAccountFieldError papelizAccountFieldErrorId={papelizAccountEmailCodeErrorId}>{signInEmailCodeFieldErrorMessage}</PapelizAccountFieldError>
              )}
            </>
          ) : (
            <>
              <label htmlFor="papeliz-account-sign-in-identifier" className={`${papelizAccountStyles.papelizAccountMorphFieldLabel} ${papelizAccountFieldLabelClassName}`}>
                {signInCardIsCreating ? 'Email' : 'Email or username'}
              </label>
              <input
                ref={signInIdentifierFieldRef}
                id="papeliz-account-sign-in-identifier"
                type={signInCardIsCreating ? 'email' : 'text'}
                inputMode="email"
                required
                autoComplete={signInCardIsCreating ? 'email' : 'username'}
                autoCapitalize="none"
                spellCheck={false}
                placeholder={signInCardIsCreating ? 'name@example.com' : 'Email or username'}
                value={signInIdentifier}
                aria-invalid={signInIdentifierFieldErrorMessage ? true : undefined}
                aria-describedby={signInIdentifierFieldErrorMessage ? papelizAccountSignInIdentifierErrorId : undefined}
                onChange={(changeEvent) => {
                  setSignInIdentifier(changeEvent.target.value)
                  if (signInIdentifierFieldErrorMessage) setSignInIdentifierFieldErrorMessage(null)
                }}
                className={`${papelizAccountStyles.papelizAccountMorphField} ${papelizAccountTextFieldClassName}`}
              />
              {signInIdentifierFieldErrorMessage && (
                <PapelizAccountFieldError papelizAccountFieldErrorId={papelizAccountSignInIdentifierErrorId}>{signInIdentifierFieldErrorMessage}</PapelizAccountFieldError>
              )}
            </>
          )}
          <button type="submit" className={`${papelizAccountStyles.papelizAccountMorphSubmit} ${papelizAccountPrimaryButtonClassName} mt-3`}>
            {signInCardIsBusy ? 'Please wait…' : signInCardIsCode ? 'Continue' : signInCardIsCreating ? 'Create account' : 'Continue with email'}
          </button>
        </fieldset>
      </form>

      {signInErrorMessage && <PapelizAccountCardNotice papelizAccountNoticeTone="error">{signInErrorMessage}</PapelizAccountCardNotice>}
      {signInNoticeMessage && <PapelizAccountCardNotice papelizAccountNoticeTone="notice">{signInNoticeMessage}</PapelizAccountCardNotice>}

      {signInCardIsCode ? (
        <>
          <button
            type="button"
            disabled={signInCardIsBusy || emailCodeResendSecondsLeft > 0}
            onClick={resendPapelizAccountEmailCode}
            className={`${papelizAccountStyles.papelizAccountSlidingUnderline} mt-2 ml-auto block w-fit cursor-pointer text-xs text-papeliz-ink-muted transition-colors hover:text-papeliz-ink disabled:cursor-default disabled:hover:text-papeliz-ink-muted`}
          >
            {emailCodeResendSecondsLeft > 0 ? `Send a new code in 0:${String(emailCodeResendSecondsLeft).padStart(2, '0')}` : 'Send a new code'}
          </button>
          <p className="mt-4 text-center text-xs text-papeliz-ink-subtle">
            Wrong email?{' '}
            <button
              type="button"
              disabled={signInCardIsBusy}
              onClick={() => switchPapelizAccountSignInCardView(signInCardView === 'create-code' ? 'create' : 'sign-in')}
              className={papelizAccountTextLinkClassName}
            >
              Use another one
            </button>
          </p>
        </>
      ) : (
        <>
          <p className="mt-5 text-center text-xs text-papeliz-ink-subtle">
            {signInCardIsCreating ? 'Already have an account? ' : 'New to Papeliz? '}
            <button
              type="button"
              disabled={signInCardIsBusy}
              onClick={() => switchPapelizAccountSignInCardView(signInCardIsCreating ? 'sign-in' : 'create')}
              className={papelizAccountTextLinkClassName}
            >
              {signInCardIsCreating ? 'Sign in' : 'Create an account'}
            </button>
          </p>
          <PapelizAccountLegalLine />
        </>
      )}
      {/* Clerk's bot check draws itself here when the sign-in service asks for one. */}
      <div id="clerk-captcha" />
    </PapelizAccountCardFrame>
  )
}
