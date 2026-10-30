// Whether the browser keeps its storage (and so the browser vaults in it), and how full it is.
//
// - `navigator.storage.persist()` asks the browser to keep this site's storage. Papeliz asks from the
//   click that creates or opens a browser vault. Firefox shows its own prompt; Chrome, Edge and
//   Safari decide by themselves (how much the site is used, a bookmark, an installed app, a Home
//   Screen web app).
// - Storage that isn't kept can be cleared when the disk runs low; Safari also clears a site's data
//   after 7 days of Safari use without opening it.
// - `navigator.storage.estimate()` says how much is used and allowed (Safari 17 and later).

export type PapelizBrowserStorageKeptState = 'kept' | 'not-kept' | 'unknown'

export interface PapelizBrowserStorageEstimate {
  browserStorageUsedByteCount: number
  browserStorageQuotaByteCount: number
}

// From this share of the quota on, the vault says storage is nearly full.
export const papelizBrowserStorageNearlyFullShare = 0.9

export async function readPapelizBrowserStorageKeptState(): Promise<PapelizBrowserStorageKeptState> {
  if (typeof navigator === 'undefined' || typeof navigator.storage?.persisted !== 'function') return 'unknown'
  try {
    return (await navigator.storage.persisted()) ? 'kept' : 'not-kept'
  } catch {
    return 'unknown'
  }
}

// Asks the browser to keep this site's storage, unless it does already. Run it from a click.
export async function requestPapelizBrowserStorageKept(): Promise<PapelizBrowserStorageKeptState> {
  const currentBrowserStorageKeptState = await readPapelizBrowserStorageKeptState()
  if (currentBrowserStorageKeptState !== 'not-kept' || typeof navigator.storage.persist !== 'function') return currentBrowserStorageKeptState
  try {
    return (await navigator.storage.persist()) ? 'kept' : 'not-kept'
  } catch {
    return 'not-kept'
  }
}

export async function readPapelizBrowserStorageEstimate(): Promise<PapelizBrowserStorageEstimate | null> {
  if (typeof navigator === 'undefined' || typeof navigator.storage?.estimate !== 'function') return null
  try {
    const browserStorageEstimate = await navigator.storage.estimate()
    if (typeof browserStorageEstimate.usage !== 'number' || typeof browserStorageEstimate.quota !== 'number' || browserStorageEstimate.quota <= 0) return null
    return { browserStorageUsedByteCount: browserStorageEstimate.usage, browserStorageQuotaByteCount: browserStorageEstimate.quota }
  } catch {
    return null
  }
}

export function isPapelizBrowserStorageNearlyFull(browserStorageEstimate: PapelizBrowserStorageEstimate | null): boolean {
  if (browserStorageEstimate === null) return false
  return browserStorageEstimate.browserStorageUsedByteCount >= browserStorageEstimate.browserStorageQuotaByteCount * papelizBrowserStorageNearlyFullShare
}

// "12 MB", "1.9 GB": decimal units, as file managers on macOS and phones show them.
export function formatPapelizStorageByteCount(storageByteCount: number): string {
  const storageByteUnits = ['bytes', 'KB', 'MB', 'GB', 'TB'] as const
  let shownStorageAmount = storageByteCount
  let storageByteUnitIndex = 0
  while (shownStorageAmount >= 1000 && storageByteUnitIndex < storageByteUnits.length - 1) {
    shownStorageAmount /= 1000
    storageByteUnitIndex += 1
  }
  const shownStorageAmountText = storageByteUnitIndex === 0 || shownStorageAmount >= 10 ? String(Math.round(shownStorageAmount)) : shownStorageAmount.toFixed(1)
  return `${shownStorageAmountText} ${storageByteUnits[storageByteUnitIndex]}`
}

// Safari alone clears a site's data after 7 days without a visit, so only its words say so. This is
// wording only: what Papeliz does never depends on the browser's name.
export function isPapelizBrowserSafari(): boolean {
  return typeof navigator !== 'undefined' && navigator.vendor === 'Apple Computer, Inc.'
}
