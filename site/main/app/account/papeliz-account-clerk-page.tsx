'use client'

import { Clerk } from '@clerk/clerk-js'
import { ClerkFailed, ClerkLoaded, ClerkLoading, ClerkProvider, useAuth } from '@clerk/react'
import { useEffect, useState } from 'react'
import {
  isPapelizAccountProductionHost,
  papelizAccountDeleteAfterSignInParameterName,
  papelizAccountDeletedParameterName,
  papelizAccountPagePath,
  papelizAccountSignUpNeedsMoreParameterName,
  papelizAccountSsoCallbackParameterName,
  selectPapelizAccountClerkPublishableKey,
} from './papeliz-account-config'
import { PapelizAccountDashboard } from './papeliz-account-dashboard'
import { PapelizAccountSignInCard } from './papeliz-account-sign-in-card'
import { forgetPapelizAccountSsoPendingProvider, PapelizAccountSsoCallback, readPapelizAccountSsoPendingProvider } from './papeliz-account-sso-callback'
import { PapelizAccountChooseUsernameStep } from './papeliz-account-choose-username-step'
import { PapelizAccountStateScreen } from './papeliz-account-state-screen'
import { readPapelizSyncSignInPageParameters } from './papeliz-account-sync-hand-over'
import { PapelizAccountSyncHandOverScreen } from './papeliz-account-sync-hand-over-screen'
import { selectPapelizAccountSyncService } from './papeliz-account-sync-service'

// Clerk runs from the copy bundled into this page (`@clerk/clerk-js`, pinned), never from Clerk's
// servers, and no Clerk screens load: every screen here is Papeliz's own. Its telemetry is off, so
// the page talks to Clerk's Frontend API alone.
export function PapelizAccountClerkPage() {
  const papelizAccountPageHostname = window.location.hostname
  return (
    <ClerkProvider
      Clerk={Clerk}
      publishableKey={selectPapelizAccountClerkPublishableKey(papelizAccountPageHostname)}
      prefetchUI={false}
      telemetry={false}
      signInUrl={papelizAccountPagePath}
      signUpUrl={papelizAccountPagePath}
      afterSignOutUrl={papelizAccountPagePath}
    >
      <ClerkLoading>
        <PapelizAccountStateScreen papelizAccountStateKind="loading" papelizAccountStateTitle="Loading your account" />
      </ClerkLoading>
      <ClerkFailed>
        <PapelizAccountStateScreen
          papelizAccountStateKind="error"
          papelizAccountStateTitle="Couldn't load sign-in"
          papelizAccountStateText="Check your connection, then try again."
          papelizAccountStateActionLabel="Try again"
          onPapelizAccountStateAction={() => window.location.reload()}
        />
      </ClerkFailed>
      <ClerkLoaded>
        <PapelizAccountPageContent isPapelizAccountProductionHost={isPapelizAccountProductionHost(papelizAccountPageHostname)} />
      </ClerkLoaded>
    </ClerkProvider>
  )
}

function PapelizAccountPageContent({ isPapelizAccountProductionHost }: { isPapelizAccountProductionHost: boolean }) {
  const { isSignedIn } = useAuth()
  const [papelizAccountPageSearchParameters] = useState(() => new URLSearchParams(window.location.search))
  const [papelizSyncSignInPageParameters] = useState(() => readPapelizSyncSignInPageParameters(papelizAccountPageSearchParameters))
  const [papelizAccountSyncService] = useState(() => selectPapelizAccountSyncService(isPapelizAccountProductionHost))
  // A Google or Apple attempt that came back without signing in.
  const [papelizAccountFailedSsoProviderName, setPapelizAccountFailedSsoProviderName] = useState(() =>
    papelizAccountPageSearchParameters.has(papelizAccountSsoCallbackParameterName) ? null : readPapelizAccountSsoPendingProvider(),
  )

  // Delete account sent the user to sign in again; once signed in, it opens again, and only once.
  const [isPapelizAccountDeleteOpenedAfterSignIn] = useState(() => papelizAccountPageSearchParameters.has(papelizAccountDeleteAfterSignInParameterName))

  useEffect(() => {
    if (isSignedIn) forgetPapelizAccountSsoPendingProvider()
  }, [isSignedIn])

  useEffect(() => {
    if (!isSignedIn || !isPapelizAccountDeleteOpenedAfterSignIn) return
    const papelizAccountAddressWithoutDeleteFlag = new URL(window.location.href)
    papelizAccountAddressWithoutDeleteFlag.searchParams.delete(papelizAccountDeleteAfterSignInParameterName)
    window.history.replaceState(window.history.state, '', papelizAccountAddressWithoutDeleteFlag.href)
  }, [isSignedIn, isPapelizAccountDeleteOpenedAfterSignIn])

  if (papelizAccountPageSearchParameters.has(papelizAccountSsoCallbackParameterName)) return <PapelizAccountSsoCallback />

  if (!isSignedIn && papelizAccountPageSearchParameters.has(papelizAccountDeletedParameterName)) {
    return (
      <PapelizAccountStateScreen
        papelizAccountStateKind="done"
        papelizAccountStateTitle="Your account is deleted"
        papelizAccountStateText="The notes on your devices are untouched."
        papelizAccountStateActionLabel="Back to Papeliz"
        papelizAccountStateActionHref="/"
      />
    )
  }

  // A new account from Google or Apple that still needs a username.
  if (!isSignedIn && papelizAccountPageSearchParameters.has(papelizAccountSignUpNeedsMoreParameterName)) {
    return <PapelizAccountChooseUsernameStep papelizAccountVerifiedByProviderName={readPapelizAccountSsoPendingProvider()} />
  }

  if (!isSignedIn && papelizAccountFailedSsoProviderName) {
    return (
      <PapelizAccountStateScreen
        papelizAccountStateKind="error"
        papelizAccountStateTitle="Couldn't sign you in"
        papelizAccountStateText={`${papelizAccountFailedSsoProviderName} didn't finish signing you in.`}
        papelizAccountStateActionLabel="Try again"
        onPapelizAccountStateAction={() => {
          forgetPapelizAccountSsoPendingProvider()
          setPapelizAccountFailedSsoProviderName(null)
        }}
      />
    )
  }

  if (!isSignedIn) return <PapelizAccountSignInCard />

  // Opened by the app with a one-time state: sign this device in to Sync and hand it back.
  if (papelizSyncSignInPageParameters) {
    return <PapelizAccountSyncHandOverScreen papelizSyncSignInPageParameters={papelizSyncSignInPageParameters} papelizAccountSyncService={papelizAccountSyncService} />
  }

  return (
    <PapelizAccountDashboard
      papelizAccountSyncService={papelizAccountSyncService}
      isPapelizAccountDeleteOpenedAfterSignIn={isPapelizAccountDeleteOpenedAfterSignIn}
    />
  )
}
