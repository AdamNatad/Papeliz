import type { PapelizSyncActionOutcome } from './papeliz-sync-engine-contract'

// Sync's pages on other sites (the sign-in page, checkout, the subscription's own page) open in a new
// tab, and a browser allows that only from the click itself. Each new tab loses its link back to
// Papeliz (`opener`), so the page there can't reach into this one.

export type PapelizSyncNewTabOutcome = { syncNewTabOutcome: 'opened' } | { syncNewTabOutcome: 'blocked' } | { syncNewTabOutcome: 'failed'; syncNewTabFailedOutcome: Extract<PapelizSyncActionOutcome<unknown>, { syncActionOutcome: 'failed' }> }

// Opens an address already known, from the click. False when the browser blocked the tab.
export function openPapelizSyncNewTabFromClick(syncNewTabUrl: string): boolean {
  const syncNewTab = window.open(syncNewTabUrl, '_blank')
  if (syncNewTab === null) return false
  syncNewTab.opener = null
  return true
}

// Opens the tab from the click, then sends it to the address once the service has made it (a
// checkout or the subscription's page). The tab closes again when that fails.
export async function openPapelizSyncNewTabWhenAddressIsReady(createSyncNewTabUrl: () => Promise<PapelizSyncActionOutcome<string>>): Promise<PapelizSyncNewTabOutcome> {
  const syncNewTab = window.open('about:blank', '_blank')
  if (syncNewTab === null) return { syncNewTabOutcome: 'blocked' }
  syncNewTab.opener = null
  const syncNewTabUrlOutcome = await createSyncNewTabUrl()
  if (syncNewTabUrlOutcome.syncActionOutcome === 'failed') {
    syncNewTab.close()
    return { syncNewTabOutcome: 'failed', syncNewTabFailedOutcome: syncNewTabUrlOutcome }
  }
  syncNewTab.location.replace(syncNewTabUrlOutcome.syncActionDoneValue)
  return { syncNewTabOutcome: 'opened' }
}

export const papelizSyncBlockedNewTabWords = 'Your browser blocked the new tab. Allow pop-ups for Papeliz, then try again.'
