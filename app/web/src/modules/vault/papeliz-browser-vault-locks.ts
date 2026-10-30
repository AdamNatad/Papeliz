// Web Locks keep the tabs of one browser out of each other's way on a browser vault. Every Papeliz
// tab of this browser sees the same locks; a tab that closes or crashes lets go of its own.
//
// - The writes lock (exclusive) is held around each change: a save's read, merge and write, a
//   rename, a move. Two tabs never both read the old text and both write.
// - The open lock (shared) is held by each tab that has the vault open, so a vault open in another
//   tab is never renamed or deleted from under it.

export type PapelizBrowserVaultLockMode = 'exclusive' | 'shared'

// The parts of the browser's LockManager that Papeliz uses (tests give a fake one).
export interface PapelizBrowserVaultLockManager {
  request<LockedTaskResult>(
    browserVaultLockName: string,
    browserVaultLockOptions: { mode: PapelizBrowserVaultLockMode },
    lockedTask: () => Promise<LockedTaskResult>,
  ): Promise<LockedTaskResult>
  query(): Promise<{ held?: ReadonlyArray<{ name?: string }> }>
}

export function buildPapelizBrowserVaultWritesLockName(papelizVaultId: string): string {
  return `papeliz-browser-vault-writes:${papelizVaultId}`
}

export function buildPapelizBrowserVaultOpenLockName(papelizVaultId: string): string {
  return `papeliz-browser-vault-open:${papelizVaultId}`
}

export function getPapelizBrowserLockManager(): PapelizBrowserVaultLockManager | null {
  if (typeof navigator === 'undefined' || navigator.locks === undefined) return null
  return navigator.locks as unknown as PapelizBrowserVaultLockManager
}

export function runPapelizBrowserVaultChangeExclusively<VaultChangeResult>(
  browserVaultLockManager: PapelizBrowserVaultLockManager | null,
  papelizVaultId: string,
  vaultChange: () => Promise<VaultChangeResult>,
): Promise<VaultChangeResult> {
  if (browserVaultLockManager === null) return vaultChange()
  return browserVaultLockManager.request(buildPapelizBrowserVaultWritesLockName(papelizVaultId), { mode: 'exclusive' }, vaultChange)
}

// Takes the vault's open lock and holds it until the returned function is called.
export function holdPapelizBrowserVaultOpenLock(browserVaultLockManager: PapelizBrowserVaultLockManager | null, papelizVaultId: string): () => void {
  if (browserVaultLockManager === null) return () => undefined
  let releaseBrowserVaultOpenLock: (() => void) | null = null
  let isReleaseAsked = false
  void browserVaultLockManager
    .request(
      buildPapelizBrowserVaultOpenLockName(papelizVaultId),
      { mode: 'shared' },
      () =>
        new Promise<void>((resolveHeldLock) => {
          releaseBrowserVaultOpenLock = resolveHeldLock
          if (isReleaseAsked) resolveHeldLock()
        }),
    )
    .catch(() => undefined)
  return () => {
    isReleaseAsked = true
    releaseBrowserVaultOpenLock?.()
  }
}

// Whether any tab of this browser (this one included) has the vault open.
export async function isPapelizBrowserVaultOpenInSomeTab(browserVaultLockManager: PapelizBrowserVaultLockManager | null, papelizVaultId: string): Promise<boolean> {
  if (browserVaultLockManager === null) return false
  const browserVaultOpenLockName = buildPapelizBrowserVaultOpenLockName(papelizVaultId)
  const browserLockSnapshot = await browserVaultLockManager.query()
  return (browserLockSnapshot.held ?? []).some((heldBrowserLock) => heldBrowserLock.name === browserVaultOpenLockName)
}
