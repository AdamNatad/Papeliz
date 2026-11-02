import { papelizSyncStoragePlaces, type PapelizSyncStoragePlace } from './papeliz-account-sync-hand-over'
import type { PapelizAccountSyncService } from './papeliz-account-sync-service'

// A new account's username and its Sync place are saved together, in the one sign-up call that sets
// the username: the place goes into the sign-up's unsafe metadata, which Clerk copies to the user it
// makes. Both are saved, or neither is, and there is no second place question to fall back on. The
// place is then on the account itself, in every tab and on every device, until the account page makes
// the Sync account in it. The person could change it from the
// browser before that, but only their own pick: the Account Worker keeps an account's first place and
// refuses another.
export const papelizAccountSignUpStoragePlaceMetadataKey = 'papelizSyncStoragePlace'

export function createPapelizAccountSignUpStoragePlaceMetadata(chosenPapelizSyncStoragePlace: PapelizSyncStoragePlace): Record<string, unknown> {
  return { [papelizAccountSignUpStoragePlaceMetadataKey]: chosenPapelizSyncStoragePlace }
}

// The place saved with the account at sign-up, or null (an account made before this, or anything
// that isn't a place).
export function readPapelizAccountSignedUpStoragePlace(userUnsafeMetadata: Record<string, unknown> | null | undefined): PapelizSyncStoragePlace | null {
  const signedUpStoragePlaceValue = userUnsafeMetadata?.[papelizAccountSignUpStoragePlaceMetadataKey]
  return papelizSyncStoragePlaces.find((papelizSyncStoragePlace) => papelizSyncStoragePlace === signedUpStoragePlaceValue) ?? null
}

// The waits before each quiet retry: right after sign-up the session's token can be a moment late, and
// a dropped connection or a server's bad moment passes. A repeat is safe: for an account that has its
// Sync account already, the Worker answers with the place it kept.
export const papelizAccountSignUpSyncAccountCreationRetryDelaysMs = [1000, 2000, 4000] as const

export type PapelizAccountSignUpSyncAccountCreationResult =
  | { signUpSyncAccountCreationResultKind: 'created' }
  // `syncAccountCreationFailureMessage` is null when Papeliz Sync couldn't be reached at all.
  | { signUpSyncAccountCreationResultKind: 'failed'; syncAccountCreationFailureMessage: string | null }

function waitPapelizAccountSignUpSyncAccountCreationRetryDelay(retryDelayMs: number): Promise<void> {
  return new Promise((resolveRetryDelay) => setTimeout(resolveRetryDelay, retryDelayMs))
}

// Makes the account's Sync account in its signed-up place, trying again by itself after each wait
// before it ever reports a failure.
export async function createPapelizSignedUpSyncAccountWithQuietRetries({
  readPapelizAccountSignInToken,
  papelizAccountSyncService,
  signedUpPapelizSyncStoragePlace,
  waitBeforeQuietRetry = waitPapelizAccountSignUpSyncAccountCreationRetryDelay,
}: {
  readPapelizAccountSignInToken: () => Promise<string | null>
  papelizAccountSyncService: Pick<PapelizAccountSyncService, 'createPapelizSyncAccount'>
  signedUpPapelizSyncStoragePlace: PapelizSyncStoragePlace
  waitBeforeQuietRetry?: (retryDelayMs: number) => Promise<void>
}): Promise<PapelizAccountSignUpSyncAccountCreationResult> {
  let syncAccountCreationFailureMessage: string | null = null
  for (const retryDelayMs of [0, ...papelizAccountSignUpSyncAccountCreationRetryDelaysMs]) {
    if (retryDelayMs > 0) await waitBeforeQuietRetry(retryDelayMs)
    try {
      const papelizAccountSignInToken = await readPapelizAccountSignInToken()
      if (!papelizAccountSignInToken) {
        syncAccountCreationFailureMessage = 'Sign in again to continue.'
        continue
      }
      const syncAccountCreationOutcome = await papelizAccountSyncService.createPapelizSyncAccount(papelizAccountSignInToken, signedUpPapelizSyncStoragePlace)
      if (syncAccountCreationOutcome.syncAccountCreationOutcomeKind === 'created') return { signUpSyncAccountCreationResultKind: 'created' }
      syncAccountCreationFailureMessage = syncAccountCreationOutcome.syncAccountCreationRefusalMessage
    } catch {
      syncAccountCreationFailureMessage = null
    }
  }
  return { signUpSyncAccountCreationResultKind: 'failed', syncAccountCreationFailureMessage }
}
