'use client'

import { useSignUp } from '@clerk/react'
import { useRef, useState, type FormEvent } from 'react'
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
import { papelizAccountSignUpNeedsMoreParameterName, papelizAccountSsoCallbackParameterName, readPapelizAccountNearestStoragePlace } from './papeliz-account-config'
import { forgetPapelizAccountSsoPendingProvider } from './papeliz-account-sso-callback'
import { createPapelizAccountSignUpStoragePlaceMetadata } from './papeliz-account-sign-up-sync-account-creation'
import { PapelizAccountStateScreen } from './papeliz-account-state-screen'
import { usePapelizAccountSyncStoragePlaceChoice } from './papeliz-account-sync-storage-place-choice-store'
import {
  PapelizAccountSyncFreeComesWithEveryAccountText,
  PapelizAccountSyncStoragePlaceChoices,
  PapelizAccountSyncStoragePlaceLockedLine,
} from './papeliz-account-sync-storage-place-choices'
import papelizAccountStyles from './papeliz-account.module.css'

// The only fields a sign-up may still need once its email is verified; anything else means
// Clerk's settings ask for more than Papeliz collects.
const papelizAccountSignUpFieldsThisPageCollects = ['username', 'legal_accepted']

// The sign-up card's storage place radio group.
const papelizAccountSignUpStoragePlaceGroupName = 'papeliz-account-sign-up-storage-place'

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

// The last step of every new account: its email is verified (by a code, or by Google or Apple), and
// a username and the place Sync keeps its notes make the account. Every account comes with Sync Free,
// so its place is asked here, once, in a place list on this same card. Create account saves the username
// and the place together, in one sign-up call, and finishes the sign-up; the account page then makes
// the Sync account in that place by itself.
export function PapelizAccountChooseUsernameStep({ papelizAccountVerifiedByProviderName }: { papelizAccountVerifiedByProviderName: string | null }) {
  const { signUp } = useSignUp()
  const [chosenSignUpUsername, setChosenSignUpUsername] = useState(() => signUp.username ?? '')
  const [nearestPapelizSyncStoragePlace] = useState(readPapelizAccountNearestStoragePlace)
  const [chosenPapelizSyncStoragePlace, setChosenPapelizSyncStoragePlace] = usePapelizAccountSyncStoragePlaceChoice(
    papelizAccountSignUpStoragePlaceGroupName,
    nearestPapelizSyncStoragePlace,
  )
  const [chooseUsernameErrorMessage, setChooseUsernameErrorMessage] = useState<string | null>(null)
  // The username field's own error, drawn on the field (red, with its line under it).
  const [signUpUsernameFieldErrorMessage, setSignUpUsernameFieldErrorMessage] = useState<string | null>(null)
  const signUpUsernameFieldRef = useRef<HTMLInputElement>(null)
  const [chooseUsernameIsWorking, setChooseUsernameIsWorking] = useState(false)
  const chooseUsernameOperationIsRunningRef = useRef(false)

  function showPapelizAccountSignUpUsernameFieldError(signUpUsernameFieldError: string) {
    setSignUpUsernameFieldErrorMessage(signUpUsernameFieldError)
    signUpUsernameFieldRef.current?.focus()
  }

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
    if (chosenSignUpUsername.trim() === '') {
      showPapelizAccountSignUpUsernameFieldError('Choose a username to continue.')
      return
    }
    chooseUsernameOperationIsRunningRef.current = true
    setChooseUsernameIsWorking(true)
    setChooseUsernameErrorMessage(null)
    setSignUpUsernameFieldErrorMessage(null)
    try {
      // The username and the place in one call: both are saved with the account, or neither is.
      const signUpUpdateResult = await signUp.update({
        username: chosenSignUpUsername.trim(),
        legalAccepted: true,
        unsafeMetadata: createPapelizAccountSignUpStoragePlaceMetadata(chosenPapelizSyncStoragePlace),
      })
      if (signUpUpdateResult.error) {
        const { clerkErrorCode } = readPapelizAccountClerkError(signUpUpdateResult.error)
        if (clerkErrorCode === papelizAccountClerkErrorCodes.identifierAlreadyUsed) {
          showPapelizAccountSignUpUsernameFieldError('That username is taken. Try another.')
          return
        }
        throw signUpUpdateResult.error
      }
      if (signUp.status !== 'complete') {
        throw new Error('Papeliz needs only your email and a username, but the sign-in service asked for more. Please contact support.')
      }
      // The Sync account is made by the account page once this new account is signed in, from the place
      // saved with it (`PapelizAccountSyncAccountGate`): Clerk doesn't always call `navigate`, nor with a
      // session whose token is ready, so nothing here depends on it.
      const signUpFinalizeResult = await signUp.finalize({
        navigate: ({ decorateUrl }) => {
          window.location.assign(decorateUrl(readPapelizAccountAddressAfterSignUp()))
        },
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
        {/* Verified in green, a little closer to the title, and the last step in blue. */}
        <p className="mx-auto mt-[3px] mb-[22px] max-w-[320px] text-xs leading-[1.6]">
          <span className="block font-semibold text-balance text-papeliz-diff-added-ink">
            {papelizAccountVerifiedByProviderName ? `${papelizAccountVerifiedByProviderName} has verified your email.` : 'Your email is verified.'}
          </span>
          <span className="block text-balance text-papeliz-blue">One last step to create your account.</span>
        </p>
      </header>
      <form noValidate onSubmit={(submitEvent) => void submitPapelizAccountChosenUsername(submitEvent)}>
        <fieldset disabled={chooseUsernameIsWorking} className="m-0 min-w-0 border-0 p-0">
          <label htmlFor="papeliz-account-sign-up-username" className={`${papelizAccountStyles.papelizAccountMorphFieldLabel} ${papelizAccountFieldLabelClassName}`}>
            Username
          </label>
          <input
            ref={signUpUsernameFieldRef}
            id="papeliz-account-sign-up-username"
            type="text"
            required
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Choose a username"
            value={chosenSignUpUsername}
            aria-invalid={signUpUsernameFieldErrorMessage ? true : undefined}
            aria-describedby={signUpUsernameFieldErrorMessage ? 'papeliz-account-sign-up-username-error' : undefined}
            onChange={(changeEvent) => {
              setChosenSignUpUsername(changeEvent.target.value)
              if (signUpUsernameFieldErrorMessage) setSignUpUsernameFieldErrorMessage(null)
            }}
            className={`${papelizAccountStyles.papelizAccountMorphField} ${papelizAccountTextFieldClassName}`}
          />
          {signUpUsernameFieldErrorMessage && (
            <PapelizAccountFieldError papelizAccountFieldErrorId="papeliz-account-sign-up-username-error">{signUpUsernameFieldErrorMessage}</PapelizAccountFieldError>
          )}
          <div className="mt-4 mb-2">
            <p className="text-[13px] leading-snug font-semibold text-papeliz-ink">Where should Sync keep your notes?</p>
            <p className="mt-0.5 text-xs leading-normal text-pretty text-papeliz-ink-muted">
              <PapelizAccountSyncFreeComesWithEveryAccountText />
            </p>
          </div>
          <PapelizAccountSyncStoragePlaceChoices
            syncStoragePlaceChoicesGroupName={papelizAccountSignUpStoragePlaceGroupName}
            chosenPapelizSyncStoragePlace={chosenPapelizSyncStoragePlace}
            nearestPapelizSyncStoragePlace={nearestPapelizSyncStoragePlace}
            onPapelizSyncStoragePlaceChoose={setChosenPapelizSyncStoragePlace}
            isSyncStoragePlaceChoicesCompact
          />
          {/* Right above Create account, the button that sets the place for good. */}
          <PapelizAccountSyncStoragePlaceLockedLine />
          <button type="submit" className={`${papelizAccountStyles.papelizAccountMorphSubmit} ${papelizAccountPrimaryButtonClassName} mt-2`}>
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
