import {
  PapelizAccountSyncVaultKeyWrapError,
  rewrapPapelizAccountSyncVaultKeyWithNewPassphrase,
  type PapelizAccountSyncPassphraseWrappedVaultKey,
  type PapelizAccountSyncVaultKeyWrapFailureKind,
} from './papeliz-account-sync-vault-key-wrap'

// Change Passphrase's Argon2id runs here, in a module worker, so the page keeps answering while the
// two derivations run. The vault's plain key exists only inside this worker: the page sends the
// wrapped copy and both passphrases, and gets back only the new wrapped copy.

export interface PapelizAccountSyncVaultKeyRewrapWorkerRequest {
  papelizSyncAccountId: string
  papelizSyncVaultId: string
  passphraseWrappedSyncVaultKey: PapelizAccountSyncPassphraseWrappedVaultKey
  currentSyncVaultPassphrase: string
  newSyncVaultPassphrase: string
}

export type PapelizAccountSyncVaultKeyRewrapWorkerReply =
  | { syncVaultKeyRewrapReplyKind: 'rewrapped'; passphraseWrappedSyncVaultKey: PapelizAccountSyncPassphraseWrappedVaultKey }
  | { syncVaultKeyRewrapReplyKind: 'failed'; syncVaultKeyWrapFailureKind: PapelizAccountSyncVaultKeyWrapFailureKind | 'unexpected'; syncVaultKeyRewrapFailureMessage: string }

// The site's types describe a page, not a worker; this is the part of the worker's scope used here.
const papelizAccountSyncVaultKeyRewrapWorkerScope = globalThis as unknown as {
  addEventListener(eventName: 'message', onMessage: (messageEvent: MessageEvent<PapelizAccountSyncVaultKeyRewrapWorkerRequest>) => void): void
  postMessage(rewrapWorkerReply: PapelizAccountSyncVaultKeyRewrapWorkerReply): void
}

papelizAccountSyncVaultKeyRewrapWorkerScope.addEventListener('message', (rewrapRequestEvent) => {
  void (async () => {
    try {
      const passphraseWrappedSyncVaultKey = await rewrapPapelizAccountSyncVaultKeyWithNewPassphrase(rewrapRequestEvent.data)
      papelizAccountSyncVaultKeyRewrapWorkerScope.postMessage({ syncVaultKeyRewrapReplyKind: 'rewrapped', passphraseWrappedSyncVaultKey })
    } catch (rewrapError) {
      papelizAccountSyncVaultKeyRewrapWorkerScope.postMessage({
        syncVaultKeyRewrapReplyKind: 'failed',
        syncVaultKeyWrapFailureKind: rewrapError instanceof PapelizAccountSyncVaultKeyWrapError ? rewrapError.syncVaultKeyWrapFailureKind : 'unexpected',
        syncVaultKeyRewrapFailureMessage: rewrapError instanceof Error ? rewrapError.message : String(rewrapError),
      })
    }
  })()
})
