import {
  PapelizAccountSyncVaultKeyWrapError,
  rewrapPapelizAccountSyncVaultKeyWithNewPassphrase,
  type PapelizAccountSyncPassphraseWrappedVaultKey,
} from './papeliz-account-sync-vault-key-wrap'
import type { PapelizAccountSyncVaultKeyRewrapWorkerReply, PapelizAccountSyncVaultKeyRewrapWorkerRequest } from './papeliz-account-sync-vault-key-rewrap-worker'

// Change Passphrase's rewrap, in a fresh module worker that ends with it (the account page's policy
// allows workers from this site). Where a worker can't start or load, it runs on the page instead,
// which answers less smoothly but gives the same copy. Throws `PapelizAccountSyncVaultKeyWrapError` as
// the wrap does.
export async function rewrapPapelizAccountSyncVaultKeyOffMainThread(
  rewrapRequest: PapelizAccountSyncVaultKeyRewrapWorkerRequest,
): Promise<PapelizAccountSyncPassphraseWrappedVaultKey> {
  let rewrapWorker: Worker
  try {
    rewrapWorker = new Worker(new URL('./papeliz-account-sync-vault-key-rewrap-worker.ts', import.meta.url), {
      type: 'module',
      name: 'papeliz-account-sync-vault-key-rewrap',
    })
  } catch {
    return rewrapPapelizAccountSyncVaultKeyWithNewPassphrase(rewrapRequest)
  }
  try {
    // The worker answers every rewrap, failed ones included, so an error event means it never ran.
    const rewrapWorkerReply = await new Promise<PapelizAccountSyncVaultKeyRewrapWorkerReply | null>((resolveRewrap) => {
      rewrapWorker.addEventListener('message', (rewrapReplyEvent: MessageEvent<PapelizAccountSyncVaultKeyRewrapWorkerReply>) => resolveRewrap(rewrapReplyEvent.data))
      rewrapWorker.addEventListener('error', (rewrapWorkerErrorEvent) => {
        rewrapWorkerErrorEvent.preventDefault()
        resolveRewrap(null)
      })
      rewrapWorker.postMessage(rewrapRequest)
    })
    if (rewrapWorkerReply === null) return await rewrapPapelizAccountSyncVaultKeyWithNewPassphrase(rewrapRequest)
    if (rewrapWorkerReply.syncVaultKeyRewrapReplyKind === 'rewrapped') return rewrapWorkerReply.passphraseWrappedSyncVaultKey
    if (rewrapWorkerReply.syncVaultKeyWrapFailureKind === 'unexpected') throw new Error(rewrapWorkerReply.syncVaultKeyRewrapFailureMessage)
    throw new PapelizAccountSyncVaultKeyWrapError(rewrapWorkerReply.syncVaultKeyWrapFailureKind, rewrapWorkerReply.syncVaultKeyRewrapFailureMessage)
  } finally {
    rewrapWorker.terminate()
  }
}
