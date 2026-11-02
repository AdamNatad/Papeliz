'use client'

import { useAuth, useUser } from '@clerk/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PapelizAccountCardFrame, PapelizAccountCardMark, papelizAccountPrimaryButtonClassName, papelizAccountTextLinkClassName } from './papeliz-account-card-frame'
import { papelizAccountAppPath, papelizAccountSignInWayStorageKey, readPapelizAccountNearestStoragePlace } from './papeliz-account-config'
import { PapelizAccountAfterLoadingBar, PapelizAccountStateScreen } from './papeliz-account-state-screen'
import {
  postPapelizSyncSignInFailure,
  startPapelizSyncDeviceSessionHandOver,
  type PapelizSyncSignInMethod,
  type PapelizSyncSignInPageParameters,
  type PapelizSyncStoragePlace,
} from './papeliz-account-sync-hand-over'
import type { PapelizAccountSyncService } from './papeliz-account-sync-service'
import { usePapelizAccountSyncStoragePlaceChoice } from './papeliz-account-sync-storage-place-choice-store'
import { PapelizAccountSyncStoragePlaceChoices } from './papeliz-account-sync-storage-place-choices'

// The hand-over card's storage place radio group.
const papelizAccountSyncHandOverStoragePlaceGroupName = 'papeliz-sync-storage-place'

type PapelizSyncHandOverStage =
  | { syncHandOverStageKind: 'creating-device-session' }
  | { syncHandOverStageKind: 'choosing-storage-place' }
  | { syncHandOverStageKind: 'handing-over' }
  | { syncHandOverStageKind: 'handed-over' }
  | { syncHandOverStageKind: 'timed-out' }
  | { syncHandOverStageKind: 'cancelled' }
  | { syncHandOverStageKind: 'failed'; syncHandOverFailureMessage: string }

function readPapelizSyncSignInMethod(): PapelizSyncSignInMethod | null {
  try {
    const papelizAccountSignInWay = window.sessionStorage.getItem(papelizAccountSignInWayStorageKey)
    return papelizAccountSignInWay === 'email-code' || papelizAccountSignInWay === 'google' || papelizAccountSignInWay === 'apple' ? papelizAccountSignInWay : null
  } catch {
    return null
  }
}

type PapelizAccountSyncHandOverScreenProps = {
  papelizSyncSignInPageParameters: PapelizSyncSignInPageParameters
  papelizAccountSyncService: PapelizAccountSyncService
}

// Signed in, and opened by the app's Settings › Account: trades a fresh Clerk token for a device
// session, asks for the storage place if this is a new account, hands the session to the app's
// tab and closes.
export function PapelizAccountSyncHandOverScreen({ papelizSyncSignInPageParameters, papelizAccountSyncService }: PapelizAccountSyncHandOverScreenProps) {
  const { getToken } = useAuth()
  const { user } = useUser()
  const [syncHandOverStage, setSyncHandOverStage] = useState<PapelizSyncHandOverStage>({ syncHandOverStageKind: 'creating-device-session' })
  const [nearestPapelizSyncStoragePlace] = useState(readPapelizAccountNearestStoragePlace)
  const [chosenPapelizSyncStoragePlace, setChosenPapelizSyncStoragePlace] = usePapelizAccountSyncStoragePlaceChoice(
    papelizAccountSyncHandOverStoragePlaceGroupName,
    papelizSyncSignInPageParameters.papelizSyncStoragePlaceForNewAccount ?? nearestPapelizSyncStoragePlace,
  )
  const syncHandOverHasStartedRef = useRef(false)
  const stopSyncHandOverRef = useRef<(() => void) | null>(null)
  const syncSignInEmailAddress = user?.primaryEmailAddress?.emailAddress ?? null

  const failPapelizSyncHandOver = useCallback(
    (syncHandOverFailureReason: 'refused' | 'service-error', syncHandOverFailureMessage: string) => {
      postPapelizSyncSignInFailure(papelizSyncSignInPageParameters.papelizSyncSignInState, syncHandOverFailureReason, syncHandOverFailureMessage)
      setSyncHandOverStage({ syncHandOverStageKind: 'failed', syncHandOverFailureMessage })
    },
    [papelizSyncSignInPageParameters.papelizSyncSignInState],
  )

  const createPapelizSyncDeviceSession = useCallback(
    async (papelizSyncStoragePlaceForNewAccount: PapelizSyncStoragePlace | null) => {
      setSyncHandOverStage({ syncHandOverStageKind: 'creating-device-session' })
      try {
        const papelizAccountSignInToken = await getToken({ skipCache: true })
        if (!papelizAccountSignInToken) {
          failPapelizSyncHandOver('service-error', 'The sign-in ended before Papeliz could finish. Please sign in again.')
          return
        }
        const syncDeviceSessionOutcome = await papelizAccountSyncService.createPapelizSyncDeviceSession(papelizAccountSignInToken, {
          papelizSyncStoragePlaceForNewAccount,
          papelizSyncDeviceIdToSignInAgain: papelizSyncSignInPageParameters.papelizSyncDeviceIdToSignInAgain,
        })
        if (syncDeviceSessionOutcome.syncDeviceSessionOutcomeKind === 'storage-place-required') {
          setSyncHandOverStage({ syncHandOverStageKind: 'choosing-storage-place' })
          return
        }
        if (syncDeviceSessionOutcome.syncDeviceSessionOutcomeKind === 'refused') {
          failPapelizSyncHandOver('refused', syncDeviceSessionOutcome.syncDeviceSessionRefusalMessage)
          return
        }
        const { papelizSyncDeviceSessionReply } = syncDeviceSessionOutcome
        setSyncHandOverStage({ syncHandOverStageKind: 'handing-over' })
        stopSyncHandOverRef.current = startPapelizSyncDeviceSessionHandOver({
          papelizSyncSignInState: papelizSyncSignInPageParameters.papelizSyncSignInState,
          papelizSyncDeviceSessionReply,
          syncSignInEmailAddress,
          syncSignInMethod: readPapelizSyncSignInMethod(),
          onPapelizSyncDeviceSessionReceived: () => {
            setSyncHandOverStage({ syncHandOverStageKind: 'handed-over' })
            // The app's tab opened this one, so the browser lets it close itself.
            window.close()
          },
          onPapelizSyncHandOverTimedOut: () => {
            setSyncHandOverStage({ syncHandOverStageKind: 'timed-out' })
            void papelizAccountSyncService.removePapelizSyncDevice(papelizSyncDeviceSessionReply.papelizSyncDeviceSession).catch(() => undefined)
          },
        })
      } catch {
        failPapelizSyncHandOver('service-error', 'Papeliz Sync couldn’t be reached. Check your connection, then try again.')
      }
    },
    [failPapelizSyncHandOver, getToken, papelizAccountSyncService, papelizSyncSignInPageParameters, syncSignInEmailAddress],
  )

  useEffect(() => {
    // Once per page, even when React runs effects twice while developing.
    if (syncHandOverHasStartedRef.current) return
    syncHandOverHasStartedRef.current = true
    void createPapelizSyncDeviceSession(papelizSyncSignInPageParameters.papelizSyncStoragePlaceForNewAccount)
  }, [createPapelizSyncDeviceSession, papelizSyncSignInPageParameters.papelizSyncStoragePlaceForNewAccount])

  useEffect(() => () => stopSyncHandOverRef.current?.(), [])

  // Each finished screen first fills the loading bar to the end, then shows.
  if (syncHandOverStage.syncHandOverStageKind === 'choosing-storage-place') {
    return (
      <PapelizAccountAfterLoadingBar>
        <PapelizAccountCardFrame>
          <PapelizAccountCardMark />
          <h1 className="text-center text-[26px] leading-tight font-semibold tracking-[-0.02em] text-balance">Where should Sync keep your notes?</h1>
          <p className="mt-3.5 mb-5 text-sm leading-relaxed text-pretty text-papeliz-ink-muted">
            Your notes are encrypted on your devices before they&rsquo;re stored. <b className="font-semibold text-papeliz-ink">You can&rsquo;t change this later.</b>
          </p>
          <form
            onSubmit={(submitEvent) => {
              submitEvent.preventDefault()
              void createPapelizSyncDeviceSession(chosenPapelizSyncStoragePlace)
            }}
          >
            <PapelizAccountSyncStoragePlaceChoices
              syncStoragePlaceChoicesGroupName={papelizAccountSyncHandOverStoragePlaceGroupName}
              chosenPapelizSyncStoragePlace={chosenPapelizSyncStoragePlace}
              nearestPapelizSyncStoragePlace={nearestPapelizSyncStoragePlace}
              onPapelizSyncStoragePlaceChoose={setChosenPapelizSyncStoragePlace}
            />
            <button type="submit" className={`${papelizAccountPrimaryButtonClassName} mt-4`}>
              Continue
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-papeliz-ink-subtle">
            <button
              type="button"
              onClick={() => {
                postPapelizSyncSignInFailure(papelizSyncSignInPageParameters.papelizSyncSignInState, 'cancelled', 'Sign-in was cancelled before choosing where Sync keeps notes.')
                setSyncHandOverStage({ syncHandOverStageKind: 'cancelled' })
              }}
              className={papelizAccountTextLinkClassName}
            >
              Cancel
            </button>
          </p>
        </PapelizAccountCardFrame>
      </PapelizAccountAfterLoadingBar>
    )
  }

  if (syncHandOverStage.syncHandOverStageKind === 'handed-over') {
    return (
      <PapelizAccountAfterLoadingBar>
        <PapelizAccountStateScreen papelizAccountStateKind="done" papelizAccountStateTitle="You're signed in" papelizAccountStateText="Papeliz has your sign-in. You can close this tab." />
      </PapelizAccountAfterLoadingBar>
    )
  }
  if (syncHandOverStage.syncHandOverStageKind === 'cancelled') {
    return (
      <PapelizAccountAfterLoadingBar>
        <PapelizAccountStateScreen papelizAccountStateKind="done" papelizAccountStateTitle="Sign-in cancelled" papelizAccountStateText="Nothing was set up. You can close this tab." />
      </PapelizAccountAfterLoadingBar>
    )
  }
  if (syncHandOverStage.syncHandOverStageKind === 'timed-out') {
    return (
      <PapelizAccountAfterLoadingBar>
        <PapelizAccountStateScreen
          papelizAccountStateKind="error"
          papelizAccountStateTitle="Papeliz didn't answer"
          papelizAccountStateText="Its tab may have closed. Sign in again from Papeliz: Settings › Account."
          papelizAccountStateActionLabel="Open Papeliz"
          papelizAccountStateActionHref={papelizAccountAppPath}
        />
      </PapelizAccountAfterLoadingBar>
    )
  }
  if (syncHandOverStage.syncHandOverStageKind === 'failed') {
    return (
      <PapelizAccountAfterLoadingBar>
        <PapelizAccountStateScreen
          papelizAccountStateKind="error"
          papelizAccountStateTitle="Couldn't sign Papeliz in"
          papelizAccountStateText={syncHandOverStage.syncHandOverFailureMessage}
          papelizAccountStateActionLabel="Try again"
          onPapelizAccountStateAction={() => void createPapelizSyncDeviceSession(papelizSyncSignInPageParameters.papelizSyncStoragePlaceForNewAccount)}
        />
      </PapelizAccountAfterLoadingBar>
    )
  }
  return (
    <PapelizAccountStateScreen
      papelizAccountStateKind="loading"
      papelizAccountLoadingStep={syncHandOverStage.syncHandOverStageKind === 'handing-over' ? 'handing-over' : 'signing-in'}
      papelizAccountStateTitle="Signing Papeliz in"
      papelizAccountStateText={syncHandOverStage.syncHandOverStageKind === 'handing-over' ? 'Handing your sign-in to Papeliz' : 'Setting up Sync on this device'}
    />
  )
}
