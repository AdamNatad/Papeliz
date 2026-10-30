'use client'

import dynamic from 'next/dynamic'
import { PapelizAccountStateScreen } from './papeliz-account-state-screen'

// Loads the account page, and with it Clerk, only in the browser. The static HTML carries just
// this loading screen.
const PapelizAccountClerkPage = dynamic(() => import('./papeliz-account-clerk-page').then((clerkPageModule) => clerkPageModule.PapelizAccountClerkPage), {
  ssr: false,
  loading: () => <PapelizAccountStateScreen papelizAccountStateKind="loading" papelizAccountStateTitle="Loading your account" />,
})

export function PapelizAccountPageLoader() {
  return <PapelizAccountClerkPage />
}
