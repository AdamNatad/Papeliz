import { createPapelizHtmlExportVaultFileResolver, type PapelizHtmlExportVaultFileResolver } from '../html-export/papeliz-html-export-vault-files'
import type { PapelizVaultAdapter } from '../vault/papeliz-vault-adapter'
import { isPapelizEndToEndVaultAdapter } from '../vault/papeliz-vault-encryption'
import { usePapelizWorkspaceStore } from '../workspace/papeliz-workspace-store'
import { getPapelizMdViewVaultMediaType } from './papeliz-md-view-media-sources'

// The vault's pictures and videos, as MD View shows them. A file is found the way the exports find
// it (beside the note, then from the vault's top, then any file with that name), read through the
// open vault's adapter, which works the same for a folder, a browser vault and Papeliz for Windows,
// and shown from a blob: URL. Each URL is held while a picture shows it and freed shortly after the
// last one is gone, so scrolling past a picture and back doesn't read it again.
//
// An End-to-end vault's files are decrypted into those blobs in memory, never onto the disk, and every
// URL made from them is revoked the moment the vault locks, not when its picture is released.
//
// An SVG picture is shown from a data: URL instead. A blob: URL belongs to the app's own origin, so
// an SVG opened from one in a new tab would be a page of the app; a data: URL has no origin, and the
// browser won't open it as a page.

const papelizMdViewVaultFileRelistAfterMilliseconds = 2_000
const papelizMdViewVaultMediaUrlKeptAfterReleaseMilliseconds = 20_000

interface PapelizMdViewVaultFileListing {
  vaultFileListedAtMilliseconds: number
  vaultFileResolverPromise: Promise<PapelizHtmlExportVaultFileResolver>
}

const vaultFileListingsByVaultAdapter = new WeakMap<PapelizVaultAdapter, PapelizMdViewVaultFileListing>()

function listVaultMediaFiles(vaultAdapter: PapelizVaultAdapter): PapelizMdViewVaultFileListing {
  const vaultFileListing: PapelizMdViewVaultFileListing = {
    vaultFileListedAtMilliseconds: Date.now(),
    vaultFileResolverPromise: vaultAdapter.listVaultAttachmentFileRelativePaths().then(
      (vaultAttachmentFileRelativePaths) => createPapelizHtmlExportVaultFileResolver(vaultAttachmentFileRelativePaths),
      () => createPapelizHtmlExportVaultFileResolver([]),
    ),
  }
  vaultFileListingsByVaultAdapter.set(vaultAdapter, vaultFileListing)
  return vaultFileListing
}

// The vault file a note's picture means, or null. The vault's file list is read once and read again
// when a picture isn't in it, at most every two seconds, so a picture added since then is found.
export async function findPapelizMdViewVaultMediaFile(
  vaultAdapter: PapelizVaultAdapter,
  vaultMediaReference: string,
  fromVaultNoteRelativePath: string | null,
): Promise<string | null> {
  const searchedVaultFileListing = vaultFileListingsByVaultAdapter.get(vaultAdapter) ?? listVaultMediaFiles(vaultAdapter)
  const foundVaultFileRelativePath = (await searchedVaultFileListing.vaultFileResolverPromise)(vaultMediaReference, fromVaultNoteRelativePath ?? '')
  if (foundVaultFileRelativePath !== null) return foundVaultFileRelativePath
  // Not in the list: search a newer list another picture asked for meanwhile, or read the list again.
  const latestVaultFileListing = vaultFileListingsByVaultAdapter.get(vaultAdapter)
  const isSearchedListingRecent = Date.now() - searchedVaultFileListing.vaultFileListedAtMilliseconds < papelizMdViewVaultFileRelistAfterMilliseconds
  const nextVaultFileListing =
    latestVaultFileListing !== undefined && latestVaultFileListing !== searchedVaultFileListing
      ? latestVaultFileListing
      : isSearchedListingRecent
        ? null
        : listVaultMediaFiles(vaultAdapter)
  if (nextVaultFileListing === null) return null
  return (await nextVaultFileListing.vaultFileResolverPromise)(vaultMediaReference, fromVaultNoteRelativePath ?? '')
}

// How long a picture that wasn't found waits before looking once more, by when the vault's list is
// read again.
export const papelizMdViewVaultMediaRetryAfterMilliseconds = papelizMdViewVaultFileRelistAfterMilliseconds + 500

async function readBlobAsDataUrl(mediaBlob: Blob): Promise<string> {
  const mediaBytes = new Uint8Array(await mediaBlob.arrayBuffer())
  const base64ChunkByteCount = 0x8000
  let mediaBinaryText = ''
  for (let chunkStartIndex = 0; chunkStartIndex < mediaBytes.length; chunkStartIndex += base64ChunkByteCount) {
    mediaBinaryText += String.fromCharCode(...mediaBytes.subarray(chunkStartIndex, chunkStartIndex + base64ChunkByteCount))
  }
  return `data:${mediaBlob.type};base64,${btoa(mediaBinaryText)}`
}

// A shown file's URL, typed by its extension: a browser vault's files carry no type of their own,
// and a browser shows an SVG picture only when its type says so.
async function createVaultMediaUrl(vaultAdapter: PapelizVaultAdapter, vaultMediaFileRelativePath: string): Promise<string | null> {
  const vaultMediaType = getPapelizMdViewVaultMediaType(vaultMediaFileRelativePath)
  if (vaultMediaType === null) return null
  const vaultMediaBlob = await vaultAdapter.readVaultAttachmentFileBlob(vaultMediaFileRelativePath)
  const typedVaultMediaBlob = new Blob([vaultMediaBlob], { type: vaultMediaType })
  return vaultMediaType === 'image/svg+xml' ? readBlobAsDataUrl(typedVaultMediaBlob) : URL.createObjectURL(typedVaultMediaBlob)
}

interface PapelizMdViewVaultMediaUrlEntry {
  vaultMediaUrlPromise: Promise<string | null>
  vaultMediaUrlHolderCount: number
  vaultMediaUrlReleaseTimer: ReturnType<typeof setTimeout> | null
}

const vaultMediaUrlEntriesByVaultAdapter = new WeakMap<PapelizVaultAdapter, Map<string, PapelizMdViewVaultMediaUrlEntry>>()

function freeVaultMediaUrl(vaultMediaUrlPromise: Promise<string | null>): void {
  void vaultMediaUrlPromise.then((vaultMediaUrl) => {
    if (vaultMediaUrl?.startsWith('blob:')) URL.revokeObjectURL(vaultMediaUrl)
  })
}

// When an End-to-end vault locks (Lock Now, Close Vault, a change of kind): every URL made from its
// decrypted files is revoked, and its file list is forgotten.
const vaultAdaptersFollowedForLock = new WeakSet<PapelizVaultAdapter>()
function forgetVaultMediaUrlsWhenVaultLocks(vaultAdapter: PapelizVaultAdapter): void {
  if (vaultAdaptersFollowedForLock.has(vaultAdapter) || !isPapelizEndToEndVaultAdapter(vaultAdapter)) return
  vaultAdaptersFollowedForLock.add(vaultAdapter)
  vaultAdapter.listenForEndToEndVaultLock(() => {
    const lockedVaultMediaUrlEntries = vaultMediaUrlEntriesByVaultAdapter.get(vaultAdapter)
    vaultMediaUrlEntriesByVaultAdapter.delete(vaultAdapter)
    vaultFileListingsByVaultAdapter.delete(vaultAdapter)
    for (const lockedVaultMediaUrlEntry of lockedVaultMediaUrlEntries?.values() ?? []) {
      if (lockedVaultMediaUrlEntry.vaultMediaUrlReleaseTimer !== null) clearTimeout(lockedVaultMediaUrlEntry.vaultMediaUrlReleaseTimer)
      freeVaultMediaUrl(lockedVaultMediaUrlEntry.vaultMediaUrlPromise)
    }
  })
}

export interface PapelizMdViewVaultMediaUrlHold {
  // The URL to show, or null when the file isn't in the vault or can't be read.
  vaultMediaUrlPromise: Promise<string | null>
  releaseVaultMediaUrl: () => void
}

// Holds the URL of the vault file a picture or video means, until released.
export function holdPapelizMdViewVaultMediaUrl(
  vaultAdapter: PapelizVaultAdapter,
  vaultMediaReference: string,
  fromVaultNoteRelativePath: string | null,
): PapelizMdViewVaultMediaUrlHold {
  let isVaultMediaUrlReleased = false
  let heldVaultMediaUrlEntry: PapelizMdViewVaultMediaUrlEntry | null = null

  const vaultMediaUrlPromise = findPapelizMdViewVaultMediaFile(vaultAdapter, vaultMediaReference, fromVaultNoteRelativePath).then((vaultMediaFileRelativePath) => {
    if (vaultMediaFileRelativePath === null || isVaultMediaUrlReleased) return null
    forgetVaultMediaUrlsWhenVaultLocks(vaultAdapter)
    const vaultMediaUrlEntries = vaultMediaUrlEntriesByVaultAdapter.get(vaultAdapter) ?? new Map<string, PapelizMdViewVaultMediaUrlEntry>()
    vaultMediaUrlEntriesByVaultAdapter.set(vaultAdapter, vaultMediaUrlEntries)
    let vaultMediaUrlEntry = vaultMediaUrlEntries.get(vaultMediaFileRelativePath)
    if (vaultMediaUrlEntry === undefined) {
      vaultMediaUrlEntry = {
        vaultMediaUrlPromise: createVaultMediaUrl(vaultAdapter, vaultMediaFileRelativePath).catch(() => null),
        vaultMediaUrlHolderCount: 0,
        vaultMediaUrlReleaseTimer: null,
      }
      vaultMediaUrlEntries.set(vaultMediaFileRelativePath, vaultMediaUrlEntry)
    }
    if (vaultMediaUrlEntry.vaultMediaUrlReleaseTimer !== null) clearTimeout(vaultMediaUrlEntry.vaultMediaUrlReleaseTimer)
    vaultMediaUrlEntry.vaultMediaUrlReleaseTimer = null
    vaultMediaUrlEntry.vaultMediaUrlHolderCount += 1
    heldVaultMediaUrlEntry = vaultMediaUrlEntry
    const entryVaultMediaUrlPromise = vaultMediaUrlEntry.vaultMediaUrlPromise
    // A file that couldn't be read is tried again by the next picture that shows it.
    void entryVaultMediaUrlPromise.then((vaultMediaUrl) => {
      if (vaultMediaUrl === null && vaultMediaUrlEntries.get(vaultMediaFileRelativePath)?.vaultMediaUrlPromise === entryVaultMediaUrlPromise) {
        vaultMediaUrlEntries.delete(vaultMediaFileRelativePath)
      }
    })
    return entryVaultMediaUrlPromise
  })

  const releaseVaultMediaUrl = () => {
    if (isVaultMediaUrlReleased) return
    isVaultMediaUrlReleased = true
    const releasedVaultMediaUrlEntry = heldVaultMediaUrlEntry
    if (releasedVaultMediaUrlEntry === null) return
    releasedVaultMediaUrlEntry.vaultMediaUrlHolderCount -= 1
    if (releasedVaultMediaUrlEntry.vaultMediaUrlHolderCount > 0) return
    releasedVaultMediaUrlEntry.vaultMediaUrlReleaseTimer = setTimeout(() => {
      const vaultMediaUrlEntries = vaultMediaUrlEntriesByVaultAdapter.get(vaultAdapter)
      for (const [vaultMediaFileRelativePath, vaultMediaUrlEntry] of vaultMediaUrlEntries ?? []) {
        if (vaultMediaUrlEntry === releasedVaultMediaUrlEntry) vaultMediaUrlEntries?.delete(vaultMediaFileRelativePath)
      }
      freeVaultMediaUrl(releasedVaultMediaUrlEntry.vaultMediaUrlPromise)
    }, papelizMdViewVaultMediaUrlKeptAfterReleaseMilliseconds)
  }

  return { vaultMediaUrlPromise, releaseVaultMediaUrl }
}

// The vault open in the workspace, whose files the note on screen shows.
export function readPapelizMdViewOpenVaultAdapter(): PapelizVaultAdapter | null {
  return usePapelizWorkspaceStore.getState().openVault?.papelizVaultAdapter ?? null
}

// The note on screen, whose folder a picture's address starts from.
export function readPapelizMdViewActiveVaultNoteRelativePath(): string | null {
  return usePapelizWorkspaceStore.getState().activeVaultNoteRelativePath
}
