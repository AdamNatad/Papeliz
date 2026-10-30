import type { PapelizSyncStoragePlace } from './papeliz-account-sync-hand-over'

// Clerk's publishable keys name a Clerk instance and are public by design: every page that signs
// people in ships one. The production instance answers only on papeliz.com, so every other host
// (the 127.0.0.1 previews) uses the development instance.
export const papelizAccountProductionHostname = 'papeliz.com'
const papelizAccountClerkProductionPublishableKey = 'pk_live_Y2xlcmsucGFwZWxpei5jb20k'
const papelizAccountClerkDevelopmentPublishableKey = 'pk_test_Y2VydGFpbi1jdWItOTM2MC5jbGVyay5hY2NvdW50cy5kZXYk'

export function isPapelizAccountProductionHost(papelizAccountPageHostname: string): boolean {
  return papelizAccountPageHostname === papelizAccountProductionHostname
}

export function selectPapelizAccountClerkPublishableKey(papelizAccountPageHostname: string): string {
  return isPapelizAccountProductionHost(papelizAccountPageHostname) ? papelizAccountClerkProductionPublishableKey : papelizAccountClerkDevelopmentPublishableKey
}

export const papelizAccountPagePath = '/account/'
export const papelizAccountAppPath = '/app/'
export const papelizAccountSupportPath = '/community/'

// Where Google or Apple sends the browser back to; the page finishes the sign-in there.
export const papelizAccountSsoCallbackParameterName = 'papeliz-account-sso-callback'
// Google or Apple made a sign-up that still needs a username (or a field this page doesn't ask for).
export const papelizAccountSignUpNeedsMoreParameterName = 'papeliz-account-sign-up-needs-more'
// Delete account: the address it lands on once the account is gone, and the flag that opens it again
// after the fresh sign-in it needs (the Account Worker accepts a sign-in from the last 10 minutes).
export const papelizAccountDeletedParameterName = 'papeliz-account-deleted'
export const papelizAccountDeleteAfterSignInParameterName = 'papeliz-account-delete-after-sign-in'
export const papelizAccountFreshSignInMinutes = 10
// The way in last used on this tab, for the hand-over's sign-in method and the hand-back's wording.
export const papelizAccountSignInWayStorageKey = 'papelizAccountSignInWay'
export type PapelizAccountSignInWay = 'email-code' | 'google' | 'apple' | 'passkey'

// Passkeys show only when the browser has them and Clerk's instance has them on; the development
// instance has them off. Clerk's public types don't list the loaded instance settings, so this
// reads the field the pinned Clerk keeps them in.
type PapelizAccountClerkWithInstanceSettings = {
  __internal_environment?: { userSettings?: { attributes?: { passkey?: { enabled?: boolean } } } } | null
}

export function readPapelizAccountPasskeysAreOn(papelizAccountClerk: object): boolean {
  if (typeof window === 'undefined' || typeof window.PublicKeyCredential !== 'function') return false
  return (papelizAccountClerk as PapelizAccountClerkWithInstanceSettings).__internal_environment?.userSettings?.attributes?.passkey?.enabled === true
}

export const papelizAccountStoragePlaceLabels: Record<PapelizSyncStoragePlace, { storagePlaceName: string; storagePlaceGuarantee: string }> = {
  enam: { storagePlaceName: 'North America, East', storagePlaceGuarantee: 'Stored in eastern North America.' },
  wnam: { storagePlaceName: 'North America, West', storagePlaceGuarantee: 'Stored in western North America.' },
  eu: { storagePlaceName: 'Europe', storagePlaceGuarantee: 'Guaranteed to stay in the EU.' },
  apac: { storagePlaceName: 'Asia-Pacific', storagePlaceGuarantee: 'Stored in Asia-Pacific.' },
  oc: { storagePlaceName: 'Oceania', storagePlaceGuarantee: 'Stored in Oceania.' },
}

// The nearest place from the browser's time zone, without a request.
export function readPapelizAccountNearestStoragePlace(): PapelizSyncStoragePlace {
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
  const browserTimeZoneRegion = browserTimeZone.split('/')[0]
  if (browserTimeZoneRegion === 'Europe' || browserTimeZoneRegion === 'Africa') return 'eu'
  if (browserTimeZoneRegion === 'Australia' || browserTimeZone.startsWith('Pacific/Auckland')) return 'oc'
  if (browserTimeZoneRegion === 'Asia' || browserTimeZoneRegion === 'Indian') return 'apac'
  if (browserTimeZoneRegion === 'Pacific') return 'oc'
  if (browserTimeZoneRegion === 'America') {
    const westernNorthAmericaTimeZones = ['America/Los_Angeles', 'America/Vancouver', 'America/Denver', 'America/Phoenix', 'America/Edmonton', 'America/Boise', 'America/Anchorage', 'America/Juneau', 'America/Tijuana', 'America/Whitehorse']
    return westernNorthAmericaTimeZones.includes(browserTimeZone) ? 'wnam' : 'enam'
  }
  return 'enam'
}
