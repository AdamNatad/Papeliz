import { describe, expect, it } from 'vitest'
import { isPapelizAccountEmailAddressWellFormed } from './papeliz-account-email-address-check'

describe('isPapelizAccountEmailAddressWellFormed', () => {
  it('takes an address with a name, an @ and a domain with a dot', () => {
    expect(isPapelizAccountEmailAddressWellFormed('name@example.com')).toBe(true)
    expect(isPapelizAccountEmailAddressWellFormed('first.last+notes@mail.example.co')).toBe(true)
  })

  it('turns down an address missing a part, or with a space', () => {
    expect(isPapelizAccountEmailAddressWellFormed('')).toBe(false)
    expect(isPapelizAccountEmailAddressWellFormed('name@')).toBe(false)
    expect(isPapelizAccountEmailAddressWellFormed('name@example')).toBe(false)
    expect(isPapelizAccountEmailAddressWellFormed('@example.com')).toBe(false)
    expect(isPapelizAccountEmailAddressWellFormed('name @example.com')).toBe(false)
  })
})
