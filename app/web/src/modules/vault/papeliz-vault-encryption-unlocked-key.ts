import { derivePapelizEndToEndVaultKeys, type PapelizEndToEndVaultKeys } from './papeliz-vault-encryption-format'
import { papelizVaultEncryptionSymmetricKeyByteLength } from './papeliz-vault-encryption-primitives'

// An End-to-end vault's key once it is open: the keys its files need, as non-extractable CryptoKeys,
// and the key's own 32 bytes, kept only so Remember on This Device can seal them. Dropping it (Lock
// Now, Close Vault) zeroes the bytes and lets go of the keys; anything still holding the holder then
// fails with 'Vault Locked'.
export class PapelizUnlockedVaultEncryptionKeyHolder {
  private vaultEncryptionKeyBytes: Uint8Array<ArrayBuffer> | null
  private endToEndVaultKeys: PapelizEndToEndVaultKeys | null

  private constructor(
    readonly papelizEncryptedVaultId: string,
    vaultEncryptionKeyBytes: Uint8Array<ArrayBuffer>,
    endToEndVaultKeys: PapelizEndToEndVaultKeys,
  ) {
    this.vaultEncryptionKeyBytes = vaultEncryptionKeyBytes
    this.endToEndVaultKeys = endToEndVaultKeys
  }

  // Takes the bytes as its own: the caller keeps no other copy.
  static async holdVaultEncryptionKey(papelizEncryptedVaultId: string, vaultEncryptionKeyBytes: Uint8Array<ArrayBuffer>): Promise<PapelizUnlockedVaultEncryptionKeyHolder> {
    if (vaultEncryptionKeyBytes.length !== papelizVaultEncryptionSymmetricKeyByteLength) throw new Error('A vault key is 32 bytes')
    return new PapelizUnlockedVaultEncryptionKeyHolder(papelizEncryptedVaultId, vaultEncryptionKeyBytes, await derivePapelizEndToEndVaultKeys(papelizEncryptedVaultId, vaultEncryptionKeyBytes))
  }

  isVaultEncryptionKeyDropped(): boolean {
    return this.endToEndVaultKeys === null
  }

  // Null once dropped.
  readEndToEndVaultKeys(): PapelizEndToEndVaultKeys | null {
    return this.endToEndVaultKeys
  }

  // A copy of the key's bytes, for remembering it; null once dropped.
  copyVaultEncryptionKeyBytes(): Uint8Array<ArrayBuffer> | null {
    return this.vaultEncryptionKeyBytes === null ? null : this.vaultEncryptionKeyBytes.slice()
  }

  dropVaultEncryptionKey(): void {
    this.vaultEncryptionKeyBytes?.fill(0)
    this.vaultEncryptionKeyBytes = null
    this.endToEndVaultKeys = null
  }
}
