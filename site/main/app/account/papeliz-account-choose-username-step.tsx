'use client'

import { useSignUp } from '@clerk/react'
import { useRef, useState, type FormEvent } from 'react'
import {
  PapelizAccountCardFrame,
  PapelizAccountCardMark,
  PapelizAccountCardNotice,
  PapelizAccountLegalLine,
  papelizAccountFieldLabelClassName,
  papelizAccountPrimaryButtonClassName,
  papelizAccountTextFieldClassName,
  papelizAccountTextLinkClassName,
} from './papeliz-account-card-frame'
import { papelizAccountClerkErrorCodes, readPapelizAccountClerkError } from './papeliz-account-clerk-errors'
import { papelizAccountSignUpNeedsMoreParameterName, papelizAccountSsoCallbackParameterName } from './papeliz-account-config'
import { forgetPapelizAccountSsoPendingProvider } from './papeliz-account-sso-callback'
import { PapelizAccountStateScreen } from './papeliz-account-state-screen'
import papelizAccountStyles from './papeliz-account.module.css'

// The only fields a sign-up may still need once its email is verified; anything else means
// Clerk's settings ask for more than Papeliz collects.
const papelizAccountSignUpFieldsThisPageCollects = ['username', 'legal_accepted']

export function isPapelizAccountSignUpWaitingOnlyForUsername(papelizAccountSignUp: { status: string | null; missingFields: readonly string[] }): boolean {
  return (
    papelizAccountSignUp.status === 'missing_requirements' &&
    papelizAccountSignUp.missingFields.includes('username') &&
    papelizAccountSignUp.missingFields.every((missingSignUpField) => papelizAccountSignUpFieldsThisPageCollects.includes(missingSignUpField))
  )
}

// This page's address without the sign-up flags, keeping the app's hand-over state.
function readPapelizAccountAddressAfterSignUp(): string {
  const papelizAccountAddressAfterSignUp = new URL(window.location.href)
  papelizAccountAddressAfterSignUp.searchParams.delete(papelizAccountSignUpNeedsMoreParameterName)
  papelizAccountAddressAfterSignUp.searchParams.delete(papelizAccountSsoCallbackParameterName)
  papelizAccountAddressAfterSignUp.hash = ''
  return `${papelizAccountAddressAfterSignUp.pathname}${papelizAccountAddressAfterSignUp.search}`
}

// The last step of every new account: its email is verified (by a code, or by Google or Apple),
// and a username makes the account.
export function PapelizAccountChooseUsernameStep({ papelizAccountVerifiedByProviderName }: { papelizAccountVerifiedByProviderName: string | null }) {
  const { signUp } = useSignUp()
  const [chosenSignUpUsername, setChosenSignUpUsername] = useState(() => signUp.username ?? '')
  const [chooseUsernameErrorMessage, setChooseUsernameErrorMessage] = useState<string | null>(null)
  const [chooseUsernameIsWorking, setChooseUsernameIsWorking] = useState(false)
  const chooseUsernameOperationIsRunningRef = useRef(false)

  function returnToPapelizAccountSignIn() {
    forgetPapelizAccountSsoPendingProvider()
    void signUp.reset().finally(() => window.location.assign(readPapelizAccountAddressAfterSignUp()))
  }

  if (!isPapelizAccountSignUpWaitingOnlyForUsername(signUp)) {
    return (
      <PapelizAccountStateScreen
        papelizAccountStateKind="error"
        papelizAccountStateTitle="Couldn't create your account"
        papelizAccountStateText="Papeliz needs only your email and a username, but the sign-in service asked for more. Please contact support."
        papelizAccountStateActionLabel="Back to sign in"
        onPapelizAccountStateAction={returnToPapelizAccountSignIn}
      />
    )
  }

  async function submitPapelizAccountChosenUsername(submitEvent: FormEvent) {
    submitEvent.preventDefault()
    if (chooseUsernameOperationIsRunningRef.current) return
    chooseUsernameOperationIsRunningRef.current = true
    setChooseUsernameIsWorking(true)
    setChooseUsernameErrorMessage(null)
    try {
      const signUpUpdateResult = await signUp.update({ username: chosenSignUpUsername.trim(), legalAccepted: true })
      if (signUpUpdateResult.error) {
        const { clerkErrorCode } = readPapelizAccountClerkError(signUpUpdateResult.error)
        if (clerkErrorCode === papelizAccountClerkErrorCodes.identifierAlreadyUsed) throw new Error('That username is taken. Try another.')
        throw signUpUpdateResult.error
      }
      if (signUp.status !== 'complete') {
        throw new Error('Papeliz needs only your email and a username, but the sign-in service asked for more. Please contact support.')
      }
      const signUpFinalizeResult = await signUp.finalize({
        navigate: ({ decorateUrl }) => window.location.assign(decorateUrl(readPapelizAccountAddressAfterSignUp())),
      })
      if (signUpFinalizeResult.error) throw signUpFinalizeResult.error
    } catch (chooseUsernameError) {
      setChooseUsernameErrorMessage(readPapelizAccountClerkError(chooseUsernameError).clerkErrorMessage)
    } finally {
      chooseUsernameOperationIsRunningRef.current = false
      setChooseUsernameIsWorking(false)
    }
  }

  return (
    <PapelizAccountCardFrame>
      <PapelizAccountCardMark />
      <header className={`${papelizAccountStyles.papelizAccountMorphHeading} text-center`}>
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] text-balance">Choose a username</h1>
        <p className="mx-auto mt-2 mb-[22px] max-w-[320px] text-xs leading-[1.6] text-papeliz-ink-muted">
          <span className="block text-balance">
            {papelizAccountVerifiedByProviderName ? `${papelizAccountVerifiedByProviderName} has verified your email.` : 'Your email is verified.'}
          </span>
          <span className="block text-balance">One last step to create your account.</span>
        </p>
      </header>
      <form onSubmit={(submitEvent) => void submitPapelizAccountChosenUsername(submitEvent)}>
        <fieldset disabled={chooseUsernameIsWorking} className="m-0 min-w-0 border-0 p-0">
          <label htmlFor="papeliz-account-sign-up-username" className={`${papelizAccountStyles.papelizAccountMorphFieldLabel} ${papelizAccountFieldLabelClassName}`}>
            Username
          </label>
          <input
            id="papeliz-account-sign-up-username"
            type="text"
            required
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Choose a username"
            value={chosenSignUpUsername}
            onChange={(changeEvent) => setChosenSignUpUsername(changeEvent.target.value)}
            className={`${papelizAccountStyles.papelizAccountMorphField} ${papelizAccountTextFieldClassName}`}
          />
          <button type="submit" className={`${papelizAccountStyles.papelizAccountMorphSubmit} ${papelizAccountPrimaryButtonClassName} mt-3`}>
            {chooseUsernameIsWorking ? 'Please wait…' : 'Create account'}
          </button>
        </fieldset>
      </form>
      {chooseUsernameErrorMessage && <PapelizAccountCardNotice papelizAccountNoticeTone="error">{chooseUsernameErrorMessage}</PapelizAccountCardNotice>}
      <p className="mt-5 text-center text-xs text-papeliz-ink-subtle">
        Already have an account?{' '}
        <button type="button" disabled={chooseUsernameIsWorking} onClick={returnToPapelizAccountSignIn} className={papelizAccountTextLinkClassName}>
          Sign in
        </button>
      </p>
      <PapelizAccountLegalLine />
    </PapelizAccountCardFrame>
  )
}
