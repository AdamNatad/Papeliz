// Whether this browser can keep browser vaults, and if not, why. Detection checks features, never
// the browser's name: the Origin Private File System, a way to write into it (createWritable(), or a
// worker for Safari before 26), Web Locks for the tabs to take turns, and the `deflate-raw` streams
// that backups and zip imports use. That is Chrome and Edge 103, Firefox 113, Safari 16.4 and later.

export type PapelizBrowserVaultOffReason =
  // Something above is missing, or the page isn't secure.
  | 'unsupported'
  // It is all there, but the browser refuses its storage here (some private windows, storage
  // turned off for the site).
  | 'storage-off'

export interface PapelizBrowserVaultSupport {
  isBrowserVaultOn: boolean
  browserVaultOffReason: PapelizBrowserVaultOffReason | null
}

function isDeflateRawStreamAvailable(): boolean {
  if (typeof CompressionStream === 'undefined' || typeof DecompressionStream === 'undefined') return false
  try {
    new CompressionStream('deflate-raw')
    new DecompressionStream('deflate-raw')
    return true
  } catch {
    return false
  }
}

function isBrowserVaultFileWriteAvailable(): boolean {
  const isWritableStreamAvailable = typeof FileSystemFileHandle !== 'undefined' && typeof FileSystemFileHandle.prototype.createWritable === 'function'
  return isWritableStreamAvailable || typeof Worker === 'function'
}

export function detectPapelizBrowserVaultSupport(): PapelizBrowserVaultSupport {
  const isEveryFeatureAvailable =
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof navigator.storage?.getDirectory === 'function' &&
    navigator.locks !== undefined &&
    isBrowserVaultFileWriteAvailable() &&
    isDeflateRawStreamAvailable()
  return isEveryFeatureAvailable ? { isBrowserVaultOn: true, browserVaultOffReason: null } : { isBrowserVaultOn: false, browserVaultOffReason: 'unsupported' }
}

// Asks for the Origin Private File System once: a browser that refuses it here keeps no vaults.
export async function probePapelizBrowserVaultStorage(): Promise<PapelizBrowserVaultSupport> {
  const detectedBrowserVaultSupport = detectPapelizBrowserVaultSupport()
  if (!detectedBrowserVaultSupport.isBrowserVaultOn) return detectedBrowserVaultSupport
  try {
    await navigator.storage.getDirectory()
    return detectedBrowserVaultSupport
  } catch {
    return { isBrowserVaultOn: false, browserVaultOffReason: 'storage-off' }
  }
}

// The toast's and the tooltip's words: why browser vaults are off, with what to do in the brackets.
export function describePapelizBrowserVaultOffReason(browserVaultOffReason: PapelizBrowserVaultOffReason): string {
  switch (browserVaultOffReason) {
    case 'unsupported':
      return 'Couldn’t keep vaults in this browser (Update It, Or Use Chrome, Edge Or Firefox)'
    case 'storage-off':
      return 'Couldn’t keep vaults in this browser (Storage Off)'
  }
}
