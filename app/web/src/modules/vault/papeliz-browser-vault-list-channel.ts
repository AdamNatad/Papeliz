// Tabs of one browser tell each other when the list of browser vaults changes: one made, renamed,
// hidden, restored or deleted. A message carries nothing but that; the tab that hears it reads the
// list again itself.

const papelizBrowserVaultListChannelName = 'papeliz:browser-vaults:v1'

interface PapelizBrowserVaultListChangeMessage {
  browserVaultListChangeMessageVersion: 1
  browserVaultListChangeSenderId: string
}

const papelizBrowserVaultListChangeSenderId =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `papeliz-tab-${Math.random().toString(36).slice(2)}`

let papelizBrowserVaultListChannel: BroadcastChannel | null | undefined
const browserVaultListChangeListeners = new Set<() => void>()

function openBrowserVaultListChannel(): BroadcastChannel | null {
  if (papelizBrowserVaultListChannel !== undefined) return papelizBrowserVaultListChannel
  if (typeof BroadcastChannel === 'undefined') {
    papelizBrowserVaultListChannel = null
    return papelizBrowserVaultListChannel
  }
  papelizBrowserVaultListChannel = new BroadcastChannel(papelizBrowserVaultListChannelName)
  // Node (the tests) keeps a process alive for an open channel.
  ;(papelizBrowserVaultListChannel as BroadcastChannel & { unref?: () => void }).unref?.()
  papelizBrowserVaultListChannel.onmessage = (messageEvent: MessageEvent<unknown>) => {
    const browserVaultListChangeMessage = messageEvent.data as Partial<PapelizBrowserVaultListChangeMessage> | null
    if (browserVaultListChangeMessage?.browserVaultListChangeMessageVersion !== 1) return
    if (browserVaultListChangeMessage.browserVaultListChangeSenderId === papelizBrowserVaultListChangeSenderId) return
    for (const browserVaultListChangeListener of [...browserVaultListChangeListeners]) browserVaultListChangeListener()
  }
  return papelizBrowserVaultListChannel
}

export function announcePapelizBrowserVaultListChange(): void {
  try {
    openBrowserVaultListChannel()?.postMessage({
      browserVaultListChangeMessageVersion: 1,
      browserVaultListChangeSenderId: papelizBrowserVaultListChangeSenderId,
    } satisfies PapelizBrowserVaultListChangeMessage)
  } catch {
    // A closed channel only means the other tabs see the change when they read the list again.
  }
}

// Hears the other tabs' changes to the list. Gives back the function that stops listening.
export function subscribeToPapelizBrowserVaultListChanges(browserVaultListChangeListener: () => void): () => void {
  openBrowserVaultListChannel()
  browserVaultListChangeListeners.add(browserVaultListChangeListener)
  return () => {
    browserVaultListChangeListeners.delete(browserVaultListChangeListener)
  }
}
