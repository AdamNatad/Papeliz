// The email check every account form makes before it asks Clerk: something@something.something,
// with no spaces. Clerk checks it again.

const papelizAccountEmailAddressPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const papelizAccountEmailAddressMalformedMessage = 'Enter an email address, like name@example.com.'

export function isPapelizAccountEmailAddressWellFormed(typedEmailAddress: string): boolean {
  return papelizAccountEmailAddressPattern.test(typedEmailAddress)
}
