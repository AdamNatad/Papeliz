// The vaults Fetch from Sync brought down as copies that won't sync, each with the synced vault it came
// from. A copy isn't linked to Sync, so the engine doesn't know it; this record lets Fetch from Sync
// show that synced vault as on this device instead of offering it again, and keeps a copy a copy when
// its download picks up after the tab was closed. It lives in this browser only, as the vaults do.

export interface PapelizSyncFetchedCopy {
  papelizVaultId: string
  papelizSyncVaultId: string
}

const papelizSyncFetchedCopiesStorageKey = 'papeliz:sync-fetched-copies:v1'

function isPapelizSyncFetchedCopy(candidateFetchedCopy: unknown): candidateFetchedCopy is PapelizSyncFetchedCopy {
  if (typeof candidateFetchedCopy !== 'object' || candidateFetchedCopy === null) return false
  const { papelizVaultId, papelizSyncVaultId } = candidateFetchedCopy as Partial<PapelizSyncFetchedCopy>
  return typeof papelizVaultId === 'string' && typeof papelizSyncVaultId === 'string'
}

export function listPapelizSyncFetchedCopies(): PapelizSyncFetchedCopy[] {
  try {
    const fetchedCopiesText = localStorage.getItem(papelizSyncFetchedCopiesStorageKey)
    const parsedFetchedCopies: unknown = fetchedCopiesText === null ? [] : JSON.parse(fetchedCopiesText)
    return Array.isArray(parsedFetchedCopies) ? parsedFetchedCopies.filter(isPapelizSyncFetchedCopy) : []
  } catch {
    return []
  }
}

function writePapelizSyncFetchedCopies(fetchedCopies: readonly PapelizSyncFetchedCopy[]): void {
  try {
    if (fetchedCopies.length === 0) localStorage.removeItem(papelizSyncFetchedCopiesStorageKey)
    else localStorage.setItem(papelizSyncFetchedCopiesStorageKey, JSON.stringify(fetchedCopies))
  } catch {
    // Storage blocked: Fetch from Sync then offers the copy's synced vault again.
  }
}

export function rememberPapelizSyncFetchedCopy(fetchedCopy: PapelizSyncFetchedCopy): void {
  writePapelizSyncFetchedCopies([...listPapelizSyncFetchedCopies().filter((otherFetchedCopy) => otherFetchedCopy.papelizVaultId !== fetchedCopy.papelizVaultId), fetchedCopy])
}

// The copy was deleted from this device.
export function forgetPapelizSyncFetchedCopy(papelizVaultId: string): void {
  const fetchedCopies = listPapelizSyncFetchedCopies()
  if (fetchedCopies.some((fetchedCopy) => fetchedCopy.papelizVaultId === papelizVaultId)) {
    writePapelizSyncFetchedCopies(fetchedCopies.filter((fetchedCopy) => fetchedCopy.papelizVaultId !== papelizVaultId))
  }
}

// The synced vaults this device holds a copy of, counting only the copies still here.
export function listPapelizSyncVaultIdsCopiedHere(papelizVaultIdsOnThisDevice: ReadonlySet<string>): Set<string> {
  return new Set(
    listPapelizSyncFetchedCopies()
      .filter((fetchedCopy) => papelizVaultIdsOnThisDevice.has(fetchedCopy.papelizVaultId))
      .map((fetchedCopy) => fetchedCopy.papelizSyncVaultId),
  )
}
