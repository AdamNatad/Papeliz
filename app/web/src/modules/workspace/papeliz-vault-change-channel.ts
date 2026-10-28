// Tabs of one browser tell each other when they change a vault: which notes were saved, or that its
// list of notes and folders changed. A message carries no content, only what changed; the tab that
// hears it reads the vault again itself, so a lost or forged message can never change what a tab
// shows. Another browser or another app can't hear it; for those a tab looks again when it comes
// back into view, and every few seconds while it is in view.

const papelizVaultChangeChannelName = 'papeliz:vault-changes:v1'

export interface PapelizVaultChangeMessage {
  vaultChangeMessageVersion: 1
  papelizVaultId: string
  // The notes saved, or null when the list of notes and folders (or Papeliz's own files) changed.
  changedVaultNoteRelativePaths: string[] | null
  vaultChangeSenderId: string
}

const papelizVaultChangeSenderId =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `papeliz-tab-${Math.random().toString(36).slice(2)}`

let papelizVaultChangeChannel: BroadcastChannel | null | undefined
const vaultChangeListeners = new Set<(vaultChangeMessage: PapelizVaultChangeMessage) => void>()

function openVaultChangeChannel(): BroadcastChannel | null {
  if (papelizVaultChangeChannel !== undefined) return papelizVaultChangeChannel
  if (typeof BroadcastChannel === 'undefined') {
    papelizVaultChangeChannel = null
    return papelizVaultChangeChannel
  }
  papelizVaultChangeChannel = new BroadcastChannel(papelizVaultChangeChannelName)
  // Node (the tests) keeps a process alive for an open channel.
  ;(papelizVaultChangeChannel as BroadcastChannel & { unref?: () => void }).unref?.()
  papelizVaultChangeChannel.onmessage = (messageEvent: MessageEvent<unknown>) => {
    const vaultChangeMessage = messageEvent.data as Partial<PapelizVaultChangeMessage> | null
    if (vaultChangeMessage?.vaultChangeMessageVersion !== 1 || typeof vaultChangeMessage.papelizVaultId !== 'string') return
    if (vaultChangeMessage.vaultChangeSenderId === papelizVaultChangeSenderId) return
    const changedVaultNoteRelativePaths = Array.isArray(vaultChangeMessage.changedVaultNoteRelativePaths)
      ? vaultChangeMessage.changedVaultNoteRelativePaths.filter((changedPath): changedPath is string => typeof changedPath === 'string')
      : null
    for (const vaultChangeListener of [...vaultChangeListeners]) {
      vaultChangeListener({ ...(vaultChangeMessage as PapelizVaultChangeMessage), changedVaultNoteRelativePaths })
    }
  }
  return papelizVaultChangeChannel
}

// Tells the vault's other tabs in this browser that this tab changed it.
export function announcePapelizVaultChange(papelizVaultId: string, changedVaultNoteRelativePaths: string[] | null): void {
  try {
    openVaultChangeChannel()?.postMessage({
      vaultChangeMessageVersion: 1,
      papelizVaultId,
      changedVaultNoteRelativePaths,
      vaultChangeSenderId: papelizVaultChangeSenderId,
    } satisfies PapelizVaultChangeMessage)
  } catch {
    // A closed channel only means the other tabs notice later, when they come into view.
  }
}

// Hears the other tabs' changes. Gives back the function that stops listening.
export function subscribeToPapelizVaultChanges(vaultChangeListener: (vaultChangeMessage: PapelizVaultChangeMessage) => void): () => void {
  openVaultChangeChannel()
  vaultChangeListeners.add(vaultChangeListener)
  return () => {
    vaultChangeListeners.delete(vaultChangeListener)
  }
}

// Gathers the changes heard over a short quiet time, then reads the vault again once: for the notes
// named, or for everything when any change named none.
export function createPapelizVaultChangeReloadScheduler(
  reloadVaultChangedElsewhere: (changedVaultNoteRelativePaths: string[] | null) => void,
  quietMilliseconds = 150,
): { scheduleVaultReload: (changedVaultNoteRelativePaths: string[] | null) => void; cancelVaultReload: () => void } {
  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  let pendingVaultNoteRelativePaths: Set<string> | null = new Set()
  return {
    scheduleVaultReload: (changedVaultNoteRelativePaths) => {
      if (pendingVaultNoteRelativePaths !== null && changedVaultNoteRelativePaths !== null) {
        for (const changedPath of changedVaultNoteRelativePaths) pendingVaultNoteRelativePaths.add(changedPath)
      } else {
        pendingVaultNoteRelativePaths = null
      }
      if (reloadTimer !== null) clearTimeout(reloadTimer)
      reloadTimer = setTimeout(() => {
        reloadTimer = null
        const reloadedVaultNoteRelativePaths = pendingVaultNoteRelativePaths
        pendingVaultNoteRelativePaths = new Set()
        reloadVaultChangedElsewhere(reloadedVaultNoteRelativePaths === null ? null : [...reloadedVaultNoteRelativePaths])
      }, quietMilliseconds)
    },
    cancelVaultReload: () => {
      if (reloadTimer !== null) clearTimeout(reloadTimer)
      reloadTimer = null
      pendingVaultNoteRelativePaths = new Set()
    },
  }
}

// How often a tab in view looks for changes made by another browser or app.
export const papelizVaultChangePollMilliseconds = 3000
