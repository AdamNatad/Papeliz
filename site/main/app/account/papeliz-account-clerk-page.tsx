'use client'

import { Clerk } from '@clerk/clerk-js'
import { ClerkFailed, ClerkLoaded, ClerkLoading, ClerkProvider, useAuth } from '@clerk/react'
import { useEffect, useState } from 'react'
import {
  isPapelizAccountProductionHost,
  papelizAccountChangePassphraseAfterSignInParameterName,
  papelizAccountChangeProfileDetailAfterSignInParameterName,
  papelizAccountDeleteAfterSignInParameterName,
  papelizAccountDeletedParameterName,
  papelizAccountPagePath,
  papelizAccountSignUpNeedsMoreParameterName,
  papelizAccountSsoCallbackParameterName,
  readPapelizAccountProfileDetailToChangeAfterSignIn,
  selectPapelizAccountClerkPublishableKey,
} from './papeliz-account-config'
import { PapelizAccountDashboard } from './papeliz-account-dashboard'
import { PapelizAccountSignInCard } from './papeliz-account-sign-in-card'
import { forgetPapelizAccountSsoPendingProvider, PapelizAccountSsoCallback, readPapelizAccountSsoPendingProvider } from './papeliz-account-sso-callback'
import { PapelizAccountChooseUsernameStep } from './papeliz-account-choose-username-step'
import { PapelizAccountAfterLoadingBar, PapelizAccountStateScreen } from './papeliz-account-state-screen'
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
        <PapelizAccountStateScreen papelizAccountStateKind="loading" papelizAccountStateTitle="Loading your account" papelizAccountLoadingStep="code-loaded" />
      </ClerkLoading>
      <ClerkFailed>
        <PapelizAccountAfterLoadingBar>
          <PapelizAccountStateScreen
            papelizAccountStateKind="error"
            papelizAccountStateTitle="Couldn't load sign-in"
            papelizAccountStateText="Check your connection, then try again."
            papelizAccountStateActionLabel="Try again"
            onPapelizAccountStateAction={() => window.location.reload()}
          />
        </PapelizAccountAfterLoadingBar>
      </ClerkFailed>
      <ClerkLoaded>
        <PapelizAccountPageContent isPapelizAccountProductionHost={isPapelizAccountProductionHost(papelizAccountPageHostname)} />
      </ClerkLoaded>
    </ClerkProvider>
  )
}

// Clerk is ready. A screen that is still waiting (Google's or Apple's return, the hand-over to the
// app) carries the loading bar on; any other first fills the bar to the end, then shows.
function PapelizAccountPageContent({ isPapelizAccountProductionHost }: { isPapelizAccountProductionHost: boolean }) {
  const [papelizAccountPageSearchParameters] = useState(() => new URLSearchParams(window.location.search))
  const { isSignedIn } = useAuth()
  if (papelizAccountPageSearchParameters.has(papelizAccountSsoCallbackParameterName)) return <PapelizAccountSsoCallback />
  if (isSignedIn && readPapelizSyncSignInPageParameters(papelizAccountPageSearchParameters)) {
    return <PapelizAccountPageScreen isPapelizAccountProductionHost={isPapelizAccountProductionHost} />
  }
  return (
    <PapelizAccountAfterLoadingBar>
      <PapelizAccountPageScreen isPapelizAccountProductionHost={isPapelizAccountProductionHost} />
    </PapelizAccountAfterLoadingBar>
  )
}

function PapelizAccountPageScreen({ isPapelizAccountProductionHost }: { isPapelizAccountProductionHost: boolean }) {
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
  // Change Passphrase did the same for one vault; its dialog opens again, and only once.
  const [papelizSyncVaultIdToChangePassphraseAfterSignIn] = useState(() => papelizAccountPageSearchParameters.get(papelizAccountChangePassphraseAfterSignInParameterName))
  // And Change Email or Change Username, for Profile.
  const [papelizAccountProfileDetailToChangeAfterSignIn] = useState(() => readPapelizAccountProfileDetailToChangeAfterSignIn(papelizAccountPageSearchParameters))

  useEffect(() => {
    if (isSignedIn) forgetPapelizAccountSsoPendingProvider()
  }, [isSignedIn])

  useEffect(() => {
    if (
      !isSignedIn ||
      (!isPapelizAccountDeleteOpenedAfterSignIn && papelizSyncVaultIdToChangePassphraseAfterSignIn === null && papelizAccountProfileDetailToChangeAfterSignIn === null)
    ) {
      return
    }
    const papelizAccountAddressWithoutAfterSignInFlags = new URL(window.location.href)
    papelizAccountAddressWithoutAfterSignInFlags.searchParams.delete(papelizAccountDeleteAfterSignInParameterName)
    papelizAccountAddressWithoutAfterSignInFlags.searchParams.delete(papelizAccountChangePassphraseAfterSignInParameterName)
    papelizAccountAddressWithoutAfterSignInFlags.searchParams.delete(papelizAccountChangeProfileDetailAfterSignInParameterName)
    window.history.replaceState(window.history.state, '', papelizAccountAddressWithoutAfterSignInFlags.href)
  }, [isSignedIn, isPapelizAccountDeleteOpenedAfterSignIn, papelizSyncVaultIdToChangePassphraseAfterSignIn, papelizAccountProfileDetailToChangeAfterSignIn])

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
      papelizSyncVaultIdToChangePassphraseAfterSignIn={papelizSyncVaultIdToChangePassphraseAfterSignIn}
      papelizAccountProfileDetailToChangeAfterSignIn={papelizAccountProfileDetailToChangeAfterSignIn}
    />
  )
}
