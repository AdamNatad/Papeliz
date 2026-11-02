'use client'

import { useAuth, useUser } from '@clerk/react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { papelizAccountSyncUnreachableMessage } from './papeliz-account-devices-section'
import { createPapelizSignedUpSyncAccountWithQuietRetries, readPapelizAccountSignedUpStoragePlace } from './papeliz-account-sign-up-sync-account-creation'
import { PapelizAccountAfterLoadingBar, PapelizAccountStateScreen } from './papeliz-account-state-screen'
import type { PapelizSyncStoragePlace } from './papeliz-account-sync-hand-over'
import type { PapelizAccountSyncBilling, PapelizAccountSyncService } from './papeliz-account-sync-service'

// Before the dashboard, the account's Sync account. Every account comes with Sync Free, its username and
// its place picked together, once, on the sign-up card, and saved together with the account; the place
// can't change after. A new account gets its Sync account here, in the place saved with it, while the
// loading bar runs, trying again by itself before it ever says it couldn't; there is no second place
// question. If it still can't, Try again does it again in the same place. The subscription is read here
// too, and handed to the dashboard so it isn't read twice; when it can't be read, the dashboard opens
// and says so in Sync.

type PapelizAccountSyncAccountGateStage =
  | { syncAccountGateStageKind: 'reading' }
  // The place saved at sign-up couldn't be used yet; Try again uses the same place, never another.
  | { syncAccountGateStageKind: 'signed-up-storage-place-failed'; signedUpPapelizSyncStoragePlace: PapelizSyncStoragePlace; syncAccountCreationFailureMessage: string }
  | { syncAccountGateStageKind: 'open'; syncBillingReadBeforeDashboard: PapelizAccountSyncBilling | null }

export function PapelizAccountSyncAccountGate({
  papelizAccountSyncService,
  renderPapelizAccountDashboard,
}: {
  papelizAccountSyncService: PapelizAccountSyncService
  renderPapelizAccountDashboard: (syncBillingReadBeforeDashboard: PapelizAccountSyncBilling | null) => ReactNode
}) {
  const { getToken } = useAuth()
  const { user } = useUser()
  const [syncAccountGateStage, setSyncAccountGateStage] = useState<PapelizAccountSyncAccountGateStage>({ syncAccountGateStageKind: 'reading' })
  const syncAccountGateReadHasStartedRef = useRef(false)

  // A new account's Sync account, made in the place saved with it at sign-up.
  const makeSignedUpPapelizSyncAccount = useCallback(
    async (signedUpPapelizSyncStoragePlace: PapelizSyncStoragePlace) => {
      const signUpSyncAccountCreationResult = await createPapelizSignedUpSyncAccountWithQuietRetries({
        readPapelizAccountSignInToken: () => getToken({ skipCache: true }),
        papelizAccountSyncService,
        signedUpPapelizSyncStoragePlace,
      })
      if (signUpSyncAccountCreationResult.signUpSyncAccountCreationResultKind === 'created') {
        setSyncAccountGateStage({ syncAccountGateStageKind: 'open', syncBillingReadBeforeDashboard: null })
        return
      }
      setSyncAccountGateStage({
        syncAccountGateStageKind: 'signed-up-storage-place-failed',
        signedUpPapelizSyncStoragePlace,
        syncAccountCreationFailureMessage: signUpSyncAccountCreationResult.syncAccountCreationFailureMessage ?? papelizAccountSyncUnreachableMessage,
      })
    },
    [getToken, papelizAccountSyncService],
  )

  useEffect(() => {
    // Once per page, even when React runs effects twice while developing, and once the user is known.
    if (syncAccountGateReadHasStartedRef.current || !user) return
    syncAccountGateReadHasStartedRef.current = true
    void (async () => {
      let syncBillingRead: PapelizAccountSyncBilling | null = null
      try {
        const papelizAccountSignInToken = await getToken({ skipCache: true })
        const syncBillingOutcome = papelizAccountSignInToken ? await papelizAccountSyncService.readPapelizSyncBilling(papelizAccountSignInToken) : null
        syncBillingRead = syncBillingOutcome?.syncBillingOutcomeKind === 'read' ? syncBillingOutcome.syncBilling : null
      } catch {
        syncBillingRead = null
      }
      // Made unless Sync already has it. When the subscription couldn't be read it's made anyway: for an
      // account that has it already, the Worker answers with the place it kept.
      const signedUpPapelizSyncStoragePlace = readPapelizAccountSignedUpStoragePlace(user.unsafeMetadata)
      if (signedUpPapelizSyncStoragePlace !== null && !syncBillingRead?.hasPapelizSyncAccount) {
        await makeSignedUpPapelizSyncAccount(signedUpPapelizSyncStoragePlace)
        return
      }
      setSyncAccountGateStage({ syncAccountGateStageKind: 'open', syncBillingReadBeforeDashboard: syncBillingRead })
    })()
  }, [getToken, papelizAccountSyncService, user, makeSignedUpPapelizSyncAccount])

  if (syncAccountGateStage.syncAccountGateStageKind === 'reading') {
    return <PapelizAccountStateScreen papelizAccountStateKind="loading" papelizAccountStateTitle="Loading your account" papelizAccountLoadingStep="clerk-loaded" />
  }
  if (syncAccountGateStage.syncAccountGateStageKind === 'signed-up-storage-place-failed') {
    const { signedUpPapelizSyncStoragePlace, syncAccountCreationFailureMessage } = syncAccountGateStage
    return (
      <PapelizAccountStateScreen
        papelizAccountStateKind="error"
        papelizAccountStateTitle="Couldn't set up Sync"
        papelizAccountStateText={syncAccountCreationFailureMessage}
        papelizAccountStateActionLabel="Try again"
        onPapelizAccountStateAction={() => {
          setSyncAccountGateStage({ syncAccountGateStageKind: 'reading' })
          void makeSignedUpPapelizSyncAccount(signedUpPapelizSyncStoragePlace)
        }}
      />
    )
  }
  return <PapelizAccountAfterLoadingBar>{renderPapelizAccountDashboard(syncAccountGateStage.syncBillingReadBeforeDashboard)}</PapelizAccountAfterLoadingBar>
}
