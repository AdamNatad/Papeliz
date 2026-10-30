import { Check, CreditCard, Globe, LoaderCircle } from 'lucide-react'
import { useEffect } from 'react'
import { PapelizPillButton } from '../ui/papeliz-buttons'
import { joinPapelizClassNames } from '../ui/papeliz-class-names'
import type { PapelizSyncEngine, PapelizSyncEngineSnapshot } from './papeliz-sync-engine-contract'
import {
  choosePapelizSyncStoragePlace,
  closePapelizSyncSubscribeFlow,
  continuePapelizSyncSubscribeToCheckout,
  continuePapelizSyncSubscribeToSignIn,
  goBackInPapelizSyncSubscribeFlow,
  type PapelizSyncSubscribeStep,
} from './papeliz-sync-flow-store'
import { PapelizSyncDialogFrame, PapelizSyncFailureLine } from './papeliz-sync-page-parts'
import { papelizSyncPlanDisplayNames, papelizSyncStoragePlaceDescriptions, pickNearestPapelizSyncStoragePlaceForThisDevice } from './papeliz-sync-screen-words'

// The subscribe flow after Choose: where the synced data is stored (A: every place listed, the
// nearest ticked), signing in in a new tab, then checkout in a new tab. Set-up follows once the
// subscription is on (papeliz-sync-set-up-dialog.tsx).

interface PapelizSyncSubscribeDialogProps {
  papelizSyncEngine: PapelizSyncEngine
  syncEngineSnapshot: PapelizSyncEngineSnapshot
  syncSubscribeStep: PapelizSyncSubscribeStep
  syncSubscribeFailureWords: string | null
  isSyncDialogDrawnInPlace: boolean
}

export function PapelizSyncSubscribeDialog({ papelizSyncEngine, syncEngineSnapshot, syncSubscribeStep, syncSubscribeFailureWords, isSyncDialogDrawnInPlace }: PapelizSyncSubscribeDialogProps) {
  const isCheckingOut = syncSubscribeStep.syncSubscribeStepKind === 'checking-out'

  // Back from checkout's tab: read the account again, so a finished checkout shows at once.
  useEffect(() => {
    if (!isCheckingOut) return
    const readAccountOnReturn = () => {
      if (document.visibilityState === 'visible') void papelizSyncEngine.refreshSyncAccountReading()
    }
    document.addEventListener('visibilitychange', readAccountOnReturn)
    window.addEventListener('focus', readAccountOnReturn)
    return () => {
      document.removeEventListener('visibilitychange', readAccountOnReturn)
      window.removeEventListener('focus', readAccountOnReturn)
    }
  }, [isCheckingOut, papelizSyncEngine])

  const chosenPlanName = papelizSyncPlanDisplayNames[syncSubscribeStep.syncChosenPlan.syncPlanName]
  const chosenPlanLine = `${chosenPlanName}, billed ${syncSubscribeStep.syncChosenPlan.syncBillingPeriod === 'yearly' ? 'yearly' : 'monthly'}`
  const failureLine = syncSubscribeFailureWords === null ? null : <PapelizSyncFailureLine className="mt-3">{syncSubscribeFailureWords}</PapelizSyncFailureLine>

  if (syncSubscribeStep.syncSubscribeStepKind === 'storage-place' || syncSubscribeStep.syncSubscribeStepKind === 'signing-in') {
    const isSigningIn = syncSubscribeStep.syncSubscribeStepKind === 'signing-in'
    const nearestSyncStoragePlace = pickNearestPapelizSyncStoragePlaceForThisDevice()
    return (
      <PapelizSyncDialogFrame
        syncDialogTitleId="papeliz-sync-subscribe-dialog-title"
        SyncDialogIcon={Globe}
        isSyncDialogDrawnInPlace={isSyncDialogDrawnInPlace}
        onSyncDialogCancel={closePapelizSyncSubscribeFlow}
        syncDialogTitle="Where should your synced notes be stored?"
        syncDialogIntro={
          <>
            They are encrypted wherever they are. Pick the place nearest to you, or the one your work requires. <b className="text-papeliz-ink">You can’t change this later.</b>
          </>
        }
        syncDialogFooter={
          <>
            <PapelizPillButton pillButtonVariant="gray" onClick={goBackInPapelizSyncSubscribeFlow}>
              {isSigningIn ? 'Back' : 'Cancel'}
            </PapelizPillButton>
            <PapelizPillButton
              pillButtonVariant="primary"
              disabled={syncSubscribeStep.chosenSyncStoragePlace === null || isSigningIn}
              onClick={() => void continuePapelizSyncSubscribeToSignIn(papelizSyncEngine)}
            >
              {isSigningIn && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
              {isSigningIn ? 'Waiting for sign-in…' : 'Continue to sign in'}
            </PapelizPillButton>
          </>
        }
      >
        <div role="radiogroup" aria-label="Storage place" className="mt-4 divide-y divide-papeliz-line overflow-hidden rounded-2xl border border-papeliz-line">
          {papelizSyncStoragePlaceDescriptions.map((storagePlaceDescription) => {
            const isStoragePlaceChosen = syncSubscribeStep.chosenSyncStoragePlace === storagePlaceDescription.papelizSyncStoragePlace
            const storagePlaceDetails = [
              storagePlaceDescription.isStoragePlaceGuaranteed ? 'Stays in the European Union, guaranteed' : null,
              storagePlaceDescription.papelizSyncStoragePlace === nearestSyncStoragePlace ? 'Nearest to you' : null,
            ].filter((storagePlaceDetail): storagePlaceDetail is string => storagePlaceDetail !== null)
            return (
              <label
                key={storagePlaceDescription.papelizSyncStoragePlace}
                className={joinPapelizClassNames('flex cursor-pointer items-center gap-2.5 px-3 py-2.5', isStoragePlaceChosen && 'bg-papeliz-blue-soft', isSigningIn && 'pointer-events-none opacity-70')}
              >
                <input
                  type="radio"
                  name="papeliz-sync-storage-place"
                  checked={isStoragePlaceChosen}
                  disabled={isSigningIn}
                  onChange={() => choosePapelizSyncStoragePlace(storagePlaceDescription.papelizSyncStoragePlace)}
                  className="size-[15px] flex-none accent-papeliz-blue"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium">{storagePlaceDescription.storagePlaceDisplayName}</span>
                  {storagePlaceDetails.length > 0 && <span className="block text-[12px] text-papeliz-ink-subtle">{storagePlaceDetails.join(' · ')}</span>}
                </span>
              </label>
            )
          })}
        </div>
        <p className="mt-3 text-[12px] leading-[1.45] text-papeliz-ink-subtle">
          {isSigningIn
            ? 'Finish signing in on the page that opened in a new tab. It comes back here by itself.'
            : `${chosenPlanLine}. Next you sign in or create your account in a new tab, then check out. Already have an account? It keeps the place it has.`}
        </p>
        {failureLine}
      </PapelizSyncDialogFrame>
    )
  }

  const signInEmailAddress = syncEngineSnapshot.syncSignIn.syncSignInKind === 'signed-in' ? syncEngineSnapshot.syncSignIn.syncSignInEmailAddress : null
  return (
    <PapelizSyncDialogFrame
      syncDialogTitleId="papeliz-sync-subscribe-dialog-title"
      SyncDialogIcon={CreditCard}
      isSyncDialogDrawnInPlace={isSyncDialogDrawnInPlace}
      onSyncDialogCancel={closePapelizSyncSubscribeFlow}
      syncDialogTitle={isCheckingOut ? 'Finish checkout in the new tab' : 'Signed in. Now check out'}
      syncDialogIntro={
        isCheckingOut
          ? 'Checkout runs on the payment provider’s own page. When it’s done, come back here: Papeliz sets up Sync on this device next.'
          : `${signInEmailAddress === null ? 'You’re signed in.' : `You’re signed in as ${signInEmailAddress}.`} Checkout opens in a new tab, on the payment provider’s own page.`
      }
      syncDialogFooter={
        <>
          <PapelizPillButton pillButtonVariant="gray" onClick={closePapelizSyncSubscribeFlow}>
            Cancel
          </PapelizPillButton>
          <PapelizPillButton pillButtonVariant={isCheckingOut ? 'line' : 'primary'} onClick={() => continuePapelizSyncSubscribeToCheckout(papelizSyncEngine)}>
            {isCheckingOut ? 'Open checkout again' : 'Continue to checkout'}
          </PapelizPillButton>
        </>
      }
    >
      <p className="mt-4 flex items-center gap-2 rounded-xl bg-papeliz-surface-soft px-3 py-2.5 text-[13px]">
        <Check className="size-4 flex-none text-papeliz-ok" aria-hidden="true" />
        <span className="min-w-0 flex-1">{chosenPlanLine}</span>
      </p>
      {isCheckingOut && (
        <p className="mt-3 flex items-center gap-2 text-[12px] text-papeliz-ink-subtle" role="status">
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
          Waiting for checkout to finish…
        </p>
      )}
      {failureLine}
    </PapelizSyncDialogFrame>
  )
}
