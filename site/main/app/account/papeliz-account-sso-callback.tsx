'use client'

import { AuthenticateWithRedirectCallback } from '@clerk/react'
import { Component, type ReactNode } from 'react'
import { papelizAccountSignUpNeedsMoreParameterName, papelizAccountSsoCallbackParameterName } from './papeliz-account-config'
import { PapelizAccountStateScreen } from './papeliz-account-state-screen'

// Set just before the page leaves for Google or Apple; cleared once the page is back and signed
// in. Still set on a signed-out return means the provider didn't finish.
export const papelizAccountSsoPendingProviderStorageKey = 'papelizAccountSsoPendingProvider'

export function readPapelizAccountSsoPendingProvider(): string | null {
  try {
    return window.sessionStorage.getItem(papelizAccountSsoPendingProviderStorageKey)
  } catch {
    return null
  }
}

export function forgetPapelizAccountSsoPendingProvider(): void {
  try {
    window.sessionStorage.removeItem(papelizAccountSsoPendingProviderStorageKey)
  } catch {
    // Nothing to forget without session storage.
  }
}

class PapelizAccountSsoCallbackBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { ssoCallbackFailed: boolean }> {
  state = { ssoCallbackFailed: false }
  static getDerivedStateFromError() {
    return { ssoCallbackFailed: true }
  }
  render() {
    return this.state.ssoCallbackFailed ? this.props.fallback : this.props.children
  }
}

// The page Google or Apple sends the browser back to. Clerk finishes the sign-in (or makes the
// account) and the page goes back to its own address, with the app's hand-over state kept.
export function PapelizAccountSsoCallback() {
  const papelizAccountSsoProviderName = readPapelizAccountSsoPendingProvider() ?? 'Google or Apple'
  const papelizAccountReturnUrl = new URL(window.location.href)
  papelizAccountReturnUrl.searchParams.delete(papelizAccountSsoCallbackParameterName)
  const papelizAccountSignUpNeedsMoreUrl = new URL(papelizAccountReturnUrl)
  papelizAccountSignUpNeedsMoreUrl.searchParams.set(papelizAccountSignUpNeedsMoreParameterName, '1')
  const papelizAccountReturnPath = `${papelizAccountReturnUrl.pathname}${papelizAccountReturnUrl.search}`
  return (
    <PapelizAccountSsoCallbackBoundary
      fallback={
        <PapelizAccountStateScreen
          papelizAccountStateKind="error"
          papelizAccountStateTitle="Couldn't sign you in"
          papelizAccountStateText={`${papelizAccountSsoProviderName} didn't finish signing you in.`}
          papelizAccountStateActionLabel="Try again"
          papelizAccountStateActionHref={papelizAccountReturnPath}
        />
      }
    >
      <PapelizAccountStateScreen
        papelizAccountStateKind="loading"
        papelizAccountStateTitle="Signing you in"
        papelizAccountStateText={`Finishing with ${papelizAccountSsoProviderName}…`}
      />
      <AuthenticateWithRedirectCallback
        signInUrl={papelizAccountReturnPath}
        signUpUrl={papelizAccountReturnPath}
        signInForceRedirectUrl={papelizAccountReturnPath}
        signUpForceRedirectUrl={papelizAccountReturnPath}
        continueSignUpUrl={`${papelizAccountSignUpNeedsMoreUrl.pathname}${papelizAccountSignUpNeedsMoreUrl.search}`}
      />
    </PapelizAccountSsoCallbackBoundary>
  )
}
