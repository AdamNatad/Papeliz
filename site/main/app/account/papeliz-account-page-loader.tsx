'use client'

import dynamic from 'next/dynamic'
import { isPapelizAccountSignInOpen } from './papeliz-account-config'
import { PapelizAccountSignInClosedNotice } from './papeliz-account-sign-in-closed-notice'
import { PapelizAccountStateScreen } from './papeliz-account-state-screen'

// Loads the account page, and with it Clerk, only in the browser. The static HTML carries just
// this loading screen. While signing in is closed, the notice is the page, and the build leaves
// Clerk's code out.
const PapelizAccountClerkPage = isPapelizAccountSignInOpen
  ? dynamic(() => import('./papeliz-account-clerk-page').then((clerkPageModule) => clerkPageModule.PapelizAccountClerkPage), {
      ssr: false,
      loading: () => <PapelizAccountStateScreen papelizAccountStateKind="loading" papelizAccountStateTitle="Loading your account" />,
    })
  : null

export function PapelizAccountPageLoader() {
  if (PapelizAccountClerkPage === null) return <PapelizAccountSignInClosedNotice />
  return <PapelizAccountClerkPage />
}
