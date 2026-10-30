// The sign-in hand-over between this page (`/account/`) and the app's tab (`/app/`), version 1.
// Both are on papeliz.com, so they talk over a BroadcastChannel. The shapes are copied from the
// Sync protocol's sign-in hand-over contract (the website is built apart from Sync and can't
// import it); keep the two in step.
//
// 1. The app's tab opens this page with a one-time state in the address, and optionally the place
//    for a new account and the device ID of a device signing in again.
// 2. This page signs the user in, then trades a fresh sign-in token for a device session
//    (papeliz-account-sync-service.ts).
// 3. It posts the device session on the channel every second until the app's tab acknowledges it
//    with the same state, then closes. With no acknowledgement within 30 seconds it stops, removes
//    the device it made, and says to sign in from Papeliz.

export const papelizSyncSignInHandOverChannelName = 'papeliz-sync-sign-in-hand-over'
export const papelizSyncSignInPageParameterNames = {
  papelizSyncSignInState: 'papeliz-sync-sign-in-state',
  papelizSyncStoragePlaceForNewAccount: 'papeliz-sync-storage-place',
  papelizSyncDeviceIdToSignInAgain: 'papeliz-sync-device-id',
} as const
export const papelizSyncSignInHandOverRepeatMilliseconds = 1000
export const papelizSyncSignInHandOverAcknowledgementTimeoutMilliseconds = 30_000

export const papelizSyncStoragePlaces = ['enam', 'wnam', 'eu', 'apac', 'oc'] as const
export type PapelizSyncStoragePlace = (typeof papelizSyncStoragePlaces)[number]
export type PapelizSyncSignInMethod = 'email-code' | 'google' | 'apple'
export type PapelizSyncSignInFailureReason = 'cancelled' | 'refused' | 'service-error'

export interface PapelizSyncDeviceSession {
  papelizSyncAccountId: string
  papelizSyncDeviceId: string
  papelizSyncDeviceRefreshToken: string
  papelizSyncGrant: string
  papelizSyncGrantExpiresAt: number
}

export interface PapelizSyncDeviceSessionReply {
  papelizSyncDeviceSession: PapelizSyncDeviceSession
  isNewPapelizSyncAccount: boolean
}

export interface PapelizSyncSignInPageParameters {
  papelizSyncSignInState: string
  papelizSyncStoragePlaceForNewAccount: PapelizSyncStoragePlace | null
  papelizSyncDeviceIdToSignInAgain: string | null
}

const papelizSyncSignInStatePattern = /^[A-Za-z0-9_-]{43}$/
const papelizSyncDeviceIdPattern = /^pzdev_[a-z2-7]{26}$/
const papelizSyncAccountIdPattern = /^pzacct_(enam|wnam|eu|apac|oc)_[a-z2-7]{26}$/
const papelizSyncDeviceRefreshTokenPattern = /^pzdrt_[A-Za-z0-9_-]{43}$/
const papelizSyncGrantPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

export function isPapelizSyncStoragePlace(storagePlaceCandidate: unknown): storagePlaceCandidate is PapelizSyncStoragePlace {
  return typeof storagePlaceCandidate === 'string' && (papelizSyncStoragePlaces as readonly string[]).includes(storagePlaceCandidate)
}

// What this page reads from its address; null without a valid state (then no device is signed in,
// because there is no tab to hand over to). An invalid place or device ID is dropped.
export function readPapelizSyncSignInPageParameters(signInPageSearchParameters: URLSearchParams): PapelizSyncSignInPageParameters | null {
  const papelizSyncSignInState = signInPageSearchParameters.get(papelizSyncSignInPageParameterNames.papelizSyncSignInState)
  if (papelizSyncSignInState === null || !papelizSyncSignInStatePattern.test(papelizSyncSignInState)) return null
  const papelizSyncStoragePlaceForNewAccount = signInPageSearchParameters.get(papelizSyncSignInPageParameterNames.papelizSyncStoragePlaceForNewAccount)
  const papelizSyncDeviceIdToSignInAgain = signInPageSearchParameters.get(papelizSyncSignInPageParameterNames.papelizSyncDeviceIdToSignInAgain)
  return {
    papelizSyncSignInState,
    papelizSyncStoragePlaceForNewAccount: isPapelizSyncStoragePlace(papelizSyncStoragePlaceForNewAccount) ? papelizSyncStoragePlaceForNewAccount : null,
    papelizSyncDeviceIdToSignInAgain:
      papelizSyncDeviceIdToSignInAgain !== null && papelizSyncDeviceIdPattern.test(papelizSyncDeviceIdToSignInAgain) ? papelizSyncDeviceIdToSignInAgain : null,
  }
}

export function isPapelizSyncDeviceSessionReply(deviceSessionReplyCandidate: unknown): deviceSessionReplyCandidate is PapelizSyncDeviceSessionReply {
  if (typeof deviceSessionReplyCandidate !== 'object' || deviceSessionReplyCandidate === null) return false
  const { papelizSyncDeviceSession, isNewPapelizSyncAccount } = deviceSessionReplyCandidate as Partial<PapelizSyncDeviceSessionReply>
  if (typeof isNewPapelizSyncAccount !== 'boolean' || typeof papelizSyncDeviceSession !== 'object' || papelizSyncDeviceSession === null) return false
  return (
    typeof papelizSyncDeviceSession.papelizSyncAccountId === 'string' &&
    papelizSyncAccountIdPattern.test(papelizSyncDeviceSession.papelizSyncAccountId) &&
    typeof papelizSyncDeviceSession.papelizSyncDeviceId === 'string' &&
    papelizSyncDeviceIdPattern.test(papelizSyncDeviceSession.papelizSyncDeviceId) &&
    typeof papelizSyncDeviceSession.papelizSyncDeviceRefreshToken === 'string' &&
    papelizSyncDeviceRefreshTokenPattern.test(papelizSyncDeviceSession.papelizSyncDeviceRefreshToken) &&
    typeof papelizSyncDeviceSession.papelizSyncGrant === 'string' &&
    papelizSyncDeviceSession.papelizSyncGrant.length <= 8192 &&
    papelizSyncGrantPattern.test(papelizSyncDeviceSession.papelizSyncGrant) &&
    Number.isInteger(papelizSyncDeviceSession.papelizSyncGrantExpiresAt) &&
    papelizSyncDeviceSession.papelizSyncGrantExpiresAt > 0
  )
}

type PapelizSyncSignInHandOverOutgoingMessage =
  | {
      papelizSyncHandOverMessageKind: 'device-session'
      papelizSyncHandOverVersion: 1
      papelizSyncSignInState: string
      papelizSyncDeviceSession: PapelizSyncDeviceSession
      isNewPapelizSyncAccount: boolean
      syncSignInEmailAddress: string | null
      syncSignInMethod: PapelizSyncSignInMethod | null
    }
  | {
      papelizSyncHandOverMessageKind: 'sign-in-failed'
      papelizSyncHandOverVersion: 1
      papelizSyncSignInState: string
      syncSignInFailureReason: PapelizSyncSignInFailureReason
      syncSignInFailureMessage: string
    }

function isPapelizSyncDeviceSessionReceivedMessage(handOverMessageCandidate: unknown, papelizSyncSignInState: string): boolean {
  if (typeof handOverMessageCandidate !== 'object' || handOverMessageCandidate === null) return false
  const handOverMessage = handOverMessageCandidate as Record<string, unknown>
  return (
    handOverMessage.papelizSyncHandOverMessageKind === 'device-session-received' &&
    handOverMessage.papelizSyncHandOverVersion === 1 &&
    handOverMessage.papelizSyncSignInState === papelizSyncSignInState
  )
}

export interface PapelizSyncDeviceSessionHandOverOptions {
  papelizSyncSignInState: string
  papelizSyncDeviceSessionReply: PapelizSyncDeviceSessionReply
  syncSignInEmailAddress: string | null
  syncSignInMethod: PapelizSyncSignInMethod | null
  onPapelizSyncDeviceSessionReceived: () => void
  onPapelizSyncHandOverTimedOut: () => void
}

// Posts the device session every second until the app's tab acknowledges it, or 30 seconds pass.
// Returns a function that stops posting.
export function startPapelizSyncDeviceSessionHandOver(handOverOptions: PapelizSyncDeviceSessionHandOverOptions): () => void {
  const papelizSyncSignInHandOverChannel = new BroadcastChannel(papelizSyncSignInHandOverChannelName)
  const deviceSessionMessage: PapelizSyncSignInHandOverOutgoingMessage = {
    papelizSyncHandOverMessageKind: 'device-session',
    papelizSyncHandOverVersion: 1,
    papelizSyncSignInState: handOverOptions.papelizSyncSignInState,
    papelizSyncDeviceSession: handOverOptions.papelizSyncDeviceSessionReply.papelizSyncDeviceSession,
    isNewPapelizSyncAccount: handOverOptions.papelizSyncDeviceSessionReply.isNewPapelizSyncAccount,
    syncSignInEmailAddress: handOverOptions.syncSignInEmailAddress,
    syncSignInMethod: handOverOptions.syncSignInMethod,
  }
  let isPapelizSyncHandOverStopped = false
  const stopPapelizSyncHandOver = () => {
    if (isPapelizSyncHandOverStopped) return
    isPapelizSyncHandOverStopped = true
    window.clearInterval(handOverRepeatTimer)
    window.clearTimeout(handOverTimeoutTimer)
    papelizSyncSignInHandOverChannel.close()
  }
  papelizSyncSignInHandOverChannel.onmessage = (handOverMessageEvent: MessageEvent<unknown>) => {
    if (!isPapelizSyncDeviceSessionReceivedMessage(handOverMessageEvent.data, handOverOptions.papelizSyncSignInState)) return
    stopPapelizSyncHandOver()
    handOverOptions.onPapelizSyncDeviceSessionReceived()
  }
  const postDeviceSessionMessage = () => papelizSyncSignInHandOverChannel.postMessage(deviceSessionMessage)
  const handOverRepeatTimer = window.setInterval(postDeviceSessionMessage, papelizSyncSignInHandOverRepeatMilliseconds)
  const handOverTimeoutTimer = window.setTimeout(() => {
    stopPapelizSyncHandOver()
    handOverOptions.onPapelizSyncHandOverTimedOut()
  }, papelizSyncSignInHandOverAcknowledgementTimeoutMilliseconds)
  postDeviceSessionMessage()
  return stopPapelizSyncHandOver
}

// Tells the app's tab the sign-in can't finish, once; the app shows the message as a detail line.
export function postPapelizSyncSignInFailure(
  papelizSyncSignInState: string,
  syncSignInFailureReason: PapelizSyncSignInFailureReason,
  syncSignInFailureMessage: string,
): void {
  const papelizSyncSignInHandOverChannel = new BroadcastChannel(papelizSyncSignInHandOverChannelName)
  const signInFailedMessage: PapelizSyncSignInHandOverOutgoingMessage = {
    papelizSyncHandOverMessageKind: 'sign-in-failed',
    papelizSyncHandOverVersion: 1,
    papelizSyncSignInState,
    syncSignInFailureReason,
    syncSignInFailureMessage: syncSignInFailureMessage.slice(0, 1000),
  }
  papelizSyncSignInHandOverChannel.postMessage(signInFailedMessage)
  papelizSyncSignInHandOverChannel.close()
}
