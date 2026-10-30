import {
  isPapelizSyncDeviceSessionReply,
  type PapelizSyncDeviceSession,
  type PapelizSyncDeviceSessionReply,
  type PapelizSyncStoragePlace,
} from './papeliz-account-sync-hand-over'

// How this page reaches Papeliz Sync's Account Worker (`/api/account/v1/` on the same origin). On
// papeliz.com it calls the Worker. Everywhere else it calls the Worker too when this origin has one
// (the Workers run locally behind the same origin as the app and this page); on an origin without
// one (the site's own 127.0.0.1 previews) it uses a local fake that keeps its accounts in this
// browser, so the screens can be checked without the Workers.

export const papelizAccountSyncDeviceSessionsPath = '/api/account/v1/device-sessions'
export const papelizAccountSyncDevicesPath = '/api/account/v1/devices'
export const papelizAccountSyncAccountDeletionFromSignInPagePath = '/api/account/v1/account/deletion-from-sign-in-page'
// The word the deletion routes ask for in the body, so no request deletes an account by accident.
const papelizAccountSyncAccountDeletionConfirmation = 'delete-my-papeliz-sync-account'

export interface PapelizAccountSyncDeviceSessionRequest {
  papelizSyncStoragePlaceForNewAccount: PapelizSyncStoragePlace | null
  papelizSyncDeviceIdToSignInAgain: string | null
}

export type PapelizAccountSyncDeviceSessionOutcome =
  | { syncDeviceSessionOutcomeKind: 'created'; papelizSyncDeviceSessionReply: PapelizSyncDeviceSessionReply }
  | { syncDeviceSessionOutcomeKind: 'storage-place-required' }
  | { syncDeviceSessionOutcomeKind: 'refused'; syncDeviceSessionRefusalMessage: string }

// `deleted` also when the sign-in never set up Sync: the Account Worker answers both the same, so it
// never tells whether an account exists.
export type PapelizAccountSyncAccountDeletionOutcome =
  | { syncAccountDeletionOutcomeKind: 'deleted' }
  | { syncAccountDeletionOutcomeKind: 'fresh-sign-in-required' }
  | { syncAccountDeletionOutcomeKind: 'refused'; syncAccountDeletionRefusalMessage: string }

export interface PapelizAccountSyncService {
  papelizAccountSyncServiceIsLocalFake: boolean
  // `signInToken` is a fresh session token from Clerk, sent in `Authorization: Bearer`.
  createPapelizSyncDeviceSession(signInToken: string, deviceSessionRequest: PapelizAccountSyncDeviceSessionRequest): Promise<PapelizAccountSyncDeviceSessionOutcome>
  // Removes a device this page made when the app's tab never took its session.
  removePapelizSyncDevice(papelizSyncDeviceSession: PapelizSyncDeviceSession): Promise<void>
  // Delete account: the subscription, every synced copy and its history, from a sign-in in the last
  // 10 minutes. Notes on devices stay.
  deletePapelizSyncAccount(signInToken: string): Promise<PapelizAccountSyncAccountDeletionOutcome>
}

function readPapelizSyncErrorReplyMessage(errorReplyCandidate: unknown): { syncErrorCode: string | null; syncErrorMessage: string | null } {
  if (typeof errorReplyCandidate !== 'object' || errorReplyCandidate === null) return { syncErrorCode: null, syncErrorMessage: null }
  const { syncErrorCode, syncErrorMessage } = errorReplyCandidate as Record<string, unknown>
  return {
    syncErrorCode: typeof syncErrorCode === 'string' ? syncErrorCode : null,
    syncErrorMessage: typeof syncErrorMessage === 'string' ? syncErrorMessage : null,
  }
}

// The Account Worker's answer, or null when nothing on this origin answers the route as Sync does:
// a 404 without a Sync error reply (the site's own previews have no Workers).
async function requestPapelizSyncDeviceSessionFromAccountWorker(
  signInToken: string,
  deviceSessionRequest: PapelizAccountSyncDeviceSessionRequest,
): Promise<PapelizAccountSyncDeviceSessionOutcome | null> {
  const deviceSessionResponse = await fetch(papelizAccountSyncDeviceSessionsPath, {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    headers: { Authorization: `Bearer ${signInToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      syncDevicePlatform: 'web',
      papelizSyncStoragePlaceForNewAccount: deviceSessionRequest.papelizSyncStoragePlaceForNewAccount,
      papelizSyncDeviceIdToSignInAgain: deviceSessionRequest.papelizSyncDeviceIdToSignInAgain,
    }),
  })
  const deviceSessionReplyBody: unknown = await deviceSessionResponse.json().catch(() => null)
  if (deviceSessionResponse.ok && isPapelizSyncDeviceSessionReply(deviceSessionReplyBody)) {
    return { syncDeviceSessionOutcomeKind: 'created', papelizSyncDeviceSessionReply: deviceSessionReplyBody }
  }
  const { syncErrorCode, syncErrorMessage } = readPapelizSyncErrorReplyMessage(deviceSessionReplyBody)
  if (deviceSessionResponse.status === 404 && syncErrorCode === null) return null
  if (deviceSessionResponse.status === 409 && syncErrorCode === 'storage-place-required') return { syncDeviceSessionOutcomeKind: 'storage-place-required' }
  return {
    syncDeviceSessionOutcomeKind: 'refused',
    syncDeviceSessionRefusalMessage: syncErrorMessage ?? `Papeliz Sync answered ${deviceSessionResponse.status}.`,
  }
}

// The Account Worker's answer, or null when no Account Worker is on this origin (as above).
async function requestPapelizSyncAccountDeletionFromAccountWorker(signInToken: string): Promise<PapelizAccountSyncAccountDeletionOutcome | null> {
  const accountDeletionResponse = await fetch(papelizAccountSyncAccountDeletionFromSignInPagePath, {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    headers: { Authorization: `Bearer ${signInToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ syncAccountDeletionConfirmation: papelizAccountSyncAccountDeletionConfirmation }),
  })
  if (accountDeletionResponse.ok) return { syncAccountDeletionOutcomeKind: 'deleted' }
  const { syncErrorCode, syncErrorMessage } = readPapelizSyncErrorReplyMessage(await accountDeletionResponse.json().catch(() => null))
  if (accountDeletionResponse.status === 404 && syncErrorCode === null) return null
  if (syncErrorCode === 'fresh-sign-in-required') return { syncAccountDeletionOutcomeKind: 'fresh-sign-in-required' }
  return {
    syncAccountDeletionOutcomeKind: 'refused',
    syncAccountDeletionRefusalMessage: syncErrorMessage ?? `Papeliz Sync answered ${accountDeletionResponse.status}.`,
  }
}

const papelizAccountSyncWorkerService: PapelizAccountSyncService = {
  papelizAccountSyncServiceIsLocalFake: false,
  async createPapelizSyncDeviceSession(signInToken, deviceSessionRequest) {
    return (
      (await requestPapelizSyncDeviceSessionFromAccountWorker(signInToken, deviceSessionRequest)) ?? {
        syncDeviceSessionOutcomeKind: 'refused',
        syncDeviceSessionRefusalMessage: 'Papeliz Sync answered 404.',
      }
    )
  },
  async deletePapelizSyncAccount(signInToken) {
    return (
      (await requestPapelizSyncAccountDeletionFromAccountWorker(signInToken)) ?? {
        syncAccountDeletionOutcomeKind: 'refused',
        syncAccountDeletionRefusalMessage: 'Papeliz Sync answered 404.',
      }
    )
  },
  async removePapelizSyncDevice(papelizSyncDeviceSession) {
    await fetch(`${papelizAccountSyncDevicesPath}/${encodeURIComponent(papelizSyncDeviceSession.papelizSyncDeviceId)}`, {
      method: 'DELETE',
      credentials: 'omit',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${papelizSyncDeviceSession.papelizSyncGrant}` },
    })
  },
}

// ---- The local fake ----------------------------------------------------------------------------

const papelizAccountLocalFakeSyncAccountsStorageKey = 'papelizAccountLocalFakeSyncAccounts'
const papelizAccountLocalFakeBase32Alphabet = 'abcdefghijklmnopqrstuvwxyz234567'

interface PapelizAccountLocalFakeSyncAccount {
  papelizSyncAccountId: string
  papelizSyncDeviceIds: string[]
}

function createPapelizAccountLocalFakeBase32Part(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(26)), (randomByte) => papelizAccountLocalFakeBase32Alphabet[randomByte & 31]).join('')
}

function encodePapelizAccountLocalFakeBase64Url(plainBytes: Uint8Array): string {
  return btoa(String.fromCharCode(...plainBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// The fake knows a user by the `sub` claim of Clerk's token; it checks nothing else.
function readPapelizAccountLocalFakeSignInSubject(signInToken: string): string {
  const signInTokenPayloadPart = signInToken.split('.')[1] ?? ''
  try {
    const signInTokenPayload = JSON.parse(atob(signInTokenPayloadPart.replace(/-/g, '+').replace(/_/g, '/'))) as { sub?: unknown }
    return typeof signInTokenPayload.sub === 'string' ? signInTokenPayload.sub : 'papeliz-account-local-fake-user'
  } catch {
    return 'papeliz-account-local-fake-user'
  }
}

function readPapelizAccountLocalFakeSyncAccounts(): Record<string, PapelizAccountLocalFakeSyncAccount> {
  try {
    return JSON.parse(window.localStorage.getItem(papelizAccountLocalFakeSyncAccountsStorageKey) ?? '{}') as Record<string, PapelizAccountLocalFakeSyncAccount>
  } catch {
    return {}
  }
}

function writePapelizAccountLocalFakeSyncAccounts(localFakeSyncAccounts: Record<string, PapelizAccountLocalFakeSyncAccount>): void {
  try {
    window.localStorage.setItem(papelizAccountLocalFakeSyncAccountsStorageKey, JSON.stringify(localFakeSyncAccounts))
  } catch {
    // A private window without storage: the fake forgets its accounts, which is fine for previews.
  }
}

export const papelizAccountLocalFakeSyncService: PapelizAccountSyncService = {
  papelizAccountSyncServiceIsLocalFake: true,
  async createPapelizSyncDeviceSession(signInToken, deviceSessionRequest) {
    const localFakeSignInSubject = readPapelizAccountLocalFakeSignInSubject(signInToken)
    const localFakeSyncAccounts = readPapelizAccountLocalFakeSyncAccounts()
    let localFakeSyncAccount = localFakeSyncAccounts[localFakeSignInSubject]
    const isNewPapelizSyncAccount = localFakeSyncAccount === undefined
    if (localFakeSyncAccount === undefined) {
      if (deviceSessionRequest.papelizSyncStoragePlaceForNewAccount === null) return { syncDeviceSessionOutcomeKind: 'storage-place-required' }
      localFakeSyncAccount = {
        papelizSyncAccountId: `pzacct_${deviceSessionRequest.papelizSyncStoragePlaceForNewAccount}_${createPapelizAccountLocalFakeBase32Part()}`,
        papelizSyncDeviceIds: [],
      }
    }
    const papelizSyncDeviceId =
      deviceSessionRequest.papelizSyncDeviceIdToSignInAgain !== null &&
      localFakeSyncAccount.papelizSyncDeviceIds.includes(deviceSessionRequest.papelizSyncDeviceIdToSignInAgain)
        ? deviceSessionRequest.papelizSyncDeviceIdToSignInAgain
        : `pzdev_${createPapelizAccountLocalFakeBase32Part()}`
    if (!localFakeSyncAccount.papelizSyncDeviceIds.includes(papelizSyncDeviceId)) localFakeSyncAccount.papelizSyncDeviceIds.push(papelizSyncDeviceId)
    localFakeSyncAccounts[localFakeSignInSubject] = localFakeSyncAccount
    writePapelizAccountLocalFakeSyncAccounts(localFakeSyncAccounts)
    const papelizSyncGrantExpiresAt = Date.now() + 60 * 60 * 1000
    const localFakeGrantClaims = { sub: localFakeSyncAccount.papelizSyncAccountId, dev: papelizSyncDeviceId, exp: Math.floor(papelizSyncGrantExpiresAt / 1000) }
    const localFakeTextEncoder = new TextEncoder()
    return {
      syncDeviceSessionOutcomeKind: 'created',
      papelizSyncDeviceSessionReply: {
        isNewPapelizSyncAccount,
        papelizSyncDeviceSession: {
          papelizSyncAccountId: localFakeSyncAccount.papelizSyncAccountId,
          papelizSyncDeviceId,
          papelizSyncDeviceRefreshToken: `pzdrt_${encodePapelizAccountLocalFakeBase64Url(crypto.getRandomValues(new Uint8Array(32)))}`,
          // Shaped like a grant (a compact JWS); the signature is random, so nothing real accepts it.
          papelizSyncGrant: [
            encodePapelizAccountLocalFakeBase64Url(localFakeTextEncoder.encode(JSON.stringify({ alg: 'EdDSA', typ: 'papeliz-sync-local-fake' }))),
            encodePapelizAccountLocalFakeBase64Url(localFakeTextEncoder.encode(JSON.stringify(localFakeGrantClaims))),
            encodePapelizAccountLocalFakeBase64Url(crypto.getRandomValues(new Uint8Array(64))),
          ].join('.'),
          papelizSyncGrantExpiresAt,
        },
      },
    }
  },
  async removePapelizSyncDevice(papelizSyncDeviceSession) {
    const localFakeSyncAccounts = readPapelizAccountLocalFakeSyncAccounts()
    for (const localFakeSyncAccount of Object.values(localFakeSyncAccounts)) {
      localFakeSyncAccount.papelizSyncDeviceIds = localFakeSyncAccount.papelizSyncDeviceIds.filter(
        (papelizSyncDeviceId) => papelizSyncDeviceId !== papelizSyncDeviceSession.papelizSyncDeviceId,
      )
    }
    writePapelizAccountLocalFakeSyncAccounts(localFakeSyncAccounts)
  },
  async deletePapelizSyncAccount(signInToken) {
    const localFakeSignInSubject = readPapelizAccountLocalFakeSignInSubject(signInToken)
    const localFakeSyncAccounts = readPapelizAccountLocalFakeSyncAccounts()
    delete localFakeSyncAccounts[localFakeSignInSubject]
    writePapelizAccountLocalFakeSyncAccounts(localFakeSyncAccounts)
    return { syncAccountDeletionOutcomeKind: 'deleted' }
  },
}

// Away from papeliz.com: asks the Worker first, and only when nothing on this origin answers the
// route as Sync does (a 404 without a Sync error reply) uses the local fake, for the rest of the page.
function createPapelizAccountSyncServiceWithLocalFakeFallback(): PapelizAccountSyncService {
  let papelizAccountChosenSyncService: PapelizAccountSyncService | null = null
  return {
    get papelizAccountSyncServiceIsLocalFake() {
      return papelizAccountChosenSyncService === papelizAccountLocalFakeSyncService
    },
    async createPapelizSyncDeviceSession(signInToken, deviceSessionRequest) {
      if (papelizAccountChosenSyncService !== null) return papelizAccountChosenSyncService.createPapelizSyncDeviceSession(signInToken, deviceSessionRequest)
      const accountWorkerOutcome = await requestPapelizSyncDeviceSessionFromAccountWorker(signInToken, deviceSessionRequest)
      papelizAccountChosenSyncService = accountWorkerOutcome === null ? papelizAccountLocalFakeSyncService : papelizAccountSyncWorkerService
      return accountWorkerOutcome ?? papelizAccountLocalFakeSyncService.createPapelizSyncDeviceSession(signInToken, deviceSessionRequest)
    },
    removePapelizSyncDevice: (papelizSyncDeviceSession) => (papelizAccountChosenSyncService ?? papelizAccountSyncWorkerService).removePapelizSyncDevice(papelizSyncDeviceSession),
    async deletePapelizSyncAccount(signInToken) {
      if (papelizAccountChosenSyncService !== null) return papelizAccountChosenSyncService.deletePapelizSyncAccount(signInToken)
      const accountWorkerOutcome = await requestPapelizSyncAccountDeletionFromAccountWorker(signInToken)
      papelizAccountChosenSyncService = accountWorkerOutcome === null ? papelizAccountLocalFakeSyncService : papelizAccountSyncWorkerService
      return accountWorkerOutcome ?? papelizAccountLocalFakeSyncService.deletePapelizSyncAccount(signInToken)
    },
  }
}

export function selectPapelizAccountSyncService(isPapelizAccountProductionHost: boolean): PapelizAccountSyncService {
  return isPapelizAccountProductionHost ? papelizAccountSyncWorkerService : createPapelizAccountSyncServiceWithLocalFakeFallback()
}
