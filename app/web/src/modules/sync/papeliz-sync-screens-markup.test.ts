import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PapelizSyncSignInPageLinks } from './papeliz-sync-blocked-sign-in-links'
import { PapelizSyncPlanCard } from './papeliz-sync-plan-offers'
import { isPapelizSyncSyncedVaultsPageFooterShown, PapelizSyncSyncedVaultsSignInStep } from './papeliz-sync-synced-vaults-page'

// The start page's Synced Vaults before sign-in, the links a blocked sign-in tab leaves, and a plan card on
// the Plans tab, as markup.

const exampleSyncSignInPageUrl = 'https://papeliz.com/account/?papeliz-sync-sign-in=example'

function renderSyncedVaultsSignInStep(
  syncedVaultsSignInStep: 'waiting-for-fetch' | 'signed-out' | 'device-removed' | 'waiting-for-sign-in',
  blockedSyncSignInPageUrl: string | null = null,
): string {
  return renderToStaticMarkup(createElement(PapelizSyncSyncedVaultsSignInStep, { syncedVaultsSignInStep, blockedSyncSignInPageUrl, onSignInClick: () => undefined }))
}

describe('Synced Vaults before sign-in', () => {
  it('has Sign In in the middle under the heading, with no extra lines, on the first step and when signed out', () => {
    for (const syncedVaultsSignInStep of ['waiting-for-fetch', 'signed-out', 'device-removed'] as const) {
      const signInStepMarkup = renderSyncedVaultsSignInStep(syncedVaultsSignInStep)
      expect(signInStepMarkup).toContain('>Sign In</button>')
      expect(signInStepMarkup).not.toContain('>Fetch</button>')
      expect(signInStepMarkup).not.toContain('in a new tab')
      expect(signInStepMarkup).not.toContain('No subscription')
    }
    expect(renderSyncedVaultsSignInStep('waiting-for-fetch')).toContain('>Synced Vaults<')
    expect(renderSyncedVaultsSignInStep('signed-out')).toContain('Sign in to see your synced vaults')
    expect(renderSyncedVaultsSignInStep('device-removed')).toContain('This device was signed out of Sync.')
  })

  it('has no footer, so no Close, before sign-in, and Close in the footer once signed in', () => {
    for (const syncedVaultsPageStep of ['waiting-for-fetch', 'signed-out', 'device-removed', 'waiting-for-sign-in'] as const) {
      expect(isPapelizSyncSyncedVaultsPageFooterShown(syncedVaultsPageStep)).toBe(false)
    }
    for (const syncedVaultsPageStep of ['engine-not-loaded', 'reading-account', 'no-subscription', 'subscription-held', 'synced-vault-list'] as const) {
      expect(isPapelizSyncSyncedVaultsPageFooterShown(syncedVaultsPageStep)).toBe(true)
    }
  })

  it('shows the sign-in link and Copy Sign-In URL to Clipboard in the middle while a blocked sign-in waits, on either step', () => {
    for (const syncedVaultsSignInStep of ['waiting-for-sign-in', 'signed-out'] as const) {
      const blockedStepMarkup = renderSyncedVaultsSignInStep(syncedVaultsSignInStep, exampleSyncSignInPageUrl)
      expect(blockedStepMarkup).toContain('Sign in to see your synced vaults')
      expect(blockedStepMarkup).toContain('>Copy Sign-In URL to Clipboard</button>')
      expect(blockedStepMarkup).not.toContain('>Sign In</button>')
    }
    // A tab that opened: the page waits for it.
    expect(renderSyncedVaultsSignInStep('waiting-for-sign-in')).toContain('Finish signing in in the new tab')
  })
})

describe('a blocked sign-in tab', () => {
  it('leaves a Sign In link the person presses, and Copy Sign-In URL to Clipboard, in place of asking to allow pop-ups', () => {
    const signInLinksMarkup = renderToStaticMarkup(createElement(PapelizSyncSignInPageLinks, { syncSignInPageUrl: exampleSyncSignInPageUrl }))
    expect(signInLinksMarkup).toMatch(/<a href="https:\/\/papeliz\.com\/account\/\?papeliz-sync-sign-in=example" target="_blank" rel="noopener"[^>]*>Sign In<\/a>/)
    expect(signInLinksMarkup).toContain('>Copy Sign-In URL to Clipboard</button>')
    expect(signInLinksMarkup).not.toContain('Allow pop-ups')
    // The copy button on the left, Sign In on the right, as in every footer.
    expect(signInLinksMarkup.indexOf('>Copy Sign-In URL to Clipboard</button>')).toBeLessThan(signInLinksMarkup.indexOf('>Sign In</a>'))
  })
})

describe('a plan card', () => {
  it('has an info icon by the plan’s name whose details screen readers get too, and no storage on its line', () => {
    const planCardMarkup = renderToStaticMarkup(
      createElement(PapelizSyncPlanCard, {
        syncPlanCardName: 'Plus',
        syncPlanCardPriceLine: '0.00 XTS a month, billed yearly',
        syncPlanCardLimitLine: '20 Vaults · Version History',
        syncPlanCardDetailLines: ['100 GB of storage.', '20 synced vaults.', 'Up to 20 devices.'],
        isSyncPlanCardHighlighted: true,
        syncPlanCardAction: null,
      }),
    )
    expect(planCardMarkup).toContain('aria-label="About Plus"')
    expect(planCardMarkup).toContain('Plus plan. 100 GB of storage. 20 synced vaults. Up to 20 devices.')
    expect(planCardMarkup).toContain('>20 Vaults · Version History</p>')
  })
})
