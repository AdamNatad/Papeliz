import {
  createPapelizVaultEncryptionRandomBytes,
  decodePapelizVaultEncryptionBase64Url,
  decryptPapelizVaultEncryptionAesGcm,
  encodePapelizVaultEncryptionAssociatedData,
  encodePapelizVaultEncryptionBase64Url,
  encodePapelizVaultEncryptionUtf8,
  encryptPapelizVaultEncryptionAesGcm,
  importPapelizVaultEncryptionAesGcmKey,
  PapelizVaultDecryptionError,
  papelizVaultEncryptionAesGcmNonceByteLength,
  papelizVaultEncryptionSymmetricKeyByteLength,
  toPapelizVaultEncryptionWebCryptoBytes,
} from './papeliz-vault-encryption-primitives'

// An End-to-end vault's passphrase and the key it wraps, as Papeliz Sync's End-to-end vault does it:
//
//   vault passphrase ──Argon2id──→ passphrase key ──AES-256-GCM wraps──→ vault key
//
// The wrapped copy sits in `.papeliz/vault-encryption.json`. Its associated data names the format, the
// vault and every derivation setting, so a copy can't be moved to another vault or have its settings
// lowered. Unlike Sync's copy it names no account: the vault may never sync.
//
// Argon2id comes from `@noble/hashes`, loaded here only, through a dynamic import, so a Standard vault
// never loads it.

export const papelizVaultKeyWrapFormat = 'papeliz-vault-encryption-key-wrap-v1'

// Sync's settings: tuned so a phone needs about a second. Stored with each wrapped copy, so they can
// change later without breaking older vaults.
export const papelizVaultDefaultArgon2idSettings = {
  argon2idMemoryKibibytes: 65_536,
  argon2idPassCount: 3,
  argon2idParallelism: 1,
} as const

// The bounds a stored setting is held to, so a changed file can't make Papeliz spend unbounded memory
// or time, or derive a weak key. Sync's own.
export const papelizVaultArgon2idSettingBounds = {
  argon2idMemoryKibibytes: { minimumSetting: 19_456, maximumSetting: 1_048_576 },
  argon2idPassCount: { minimumSetting: 1, maximumSetting: 10 },
  argon2idParallelism: { minimumSetting: 1, maximumSetting: 4 },
} as const

export interface PapelizVaultArgon2idSettings {
  argon2idMemoryKibibytes: number
  argon2idPassCount: number
  argon2idParallelism: number
}

export const papelizVaultArgon2idSaltByteLength = 16

// 12 characters or more, counted after Unicode NFC, with nothing trimmed, as Sync's passphrase.
export const papelizVaultPassphraseMinimumCharacterCount = 12

export interface PapelizVaultArgon2idKeyDerivation extends PapelizVaultArgon2idSettings {
  vaultKeyDerivationAlgorithm: 'argon2id'
  // 16 bytes, base64url.
  vaultKeyDerivationSalt: string
}

export interface PapelizVaultPassphraseWrappedKey {
  vaultKeyWrapFormat: typeof papelizVaultKeyWrapFormat
  vaultKeyDerivation: PapelizVaultArgon2idKeyDerivation
  // 12 bytes, base64url.
  vaultKeyWrapNonce: string
  // The 32-byte vault key encrypted, with its 16-byte tag: 48 bytes, base64url.
  wrappedVaultEncryptionKey: string
}

// The passphrase as stored and compared: Unicode NFC, so the same words typed on two systems match.
// Nothing is trimmed.
export function normalizePapelizVaultPassphrase(vaultPassphrase: string): string {
  return vaultPassphrase.normalize('NFC')
}

export function countPapelizVaultPassphraseCharacters(vaultPassphrase: string): number {
  return [...normalizePapelizVaultPassphrase(vaultPassphrase)].length
}

export function arePapelizVaultArgon2idSettingsWithinBounds(argon2idSettings: PapelizVaultArgon2idSettings): boolean {
  return (Object.keys(papelizVaultArgon2idSettingBounds) as (keyof typeof papelizVaultArgon2idSettingBounds)[]).every((argon2idSettingName) => {
    const argon2idSetting = argon2idSettings[argon2idSettingName]
    const argon2idSettingBounds = papelizVaultArgon2idSettingBounds[argon2idSettingName]
    return Number.isSafeInteger(argon2idSetting) && argon2idSetting >= argon2idSettingBounds.minimumSetting && argon2idSetting <= argon2idSettingBounds.maximumSetting
  })
}

// Tests turn the passphrase into its key with small settings; nothing else changes them.
let papelizVaultArgon2idSettingsForTests: PapelizVaultArgon2idSettings | null = null

export function usePapelizVaultArgon2idSettingsForTests(argon2idSettings: PapelizVaultArgon2idSettings | null): void {
  papelizVaultArgon2idSettingsForTests = argon2idSettings
}

// The 32-byte key that wraps the vault's key, from its passphrase. Slow on purpose.
async function derivePapelizVaultPassphraseKeyBytes(
  vaultPassphrase: string,
  argon2idSaltBytes: Uint8Array,
  argon2idSettings: PapelizVaultArgon2idSettings,
  onArgon2idProgress?: (argon2idProgressFraction: number) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!arePapelizVaultArgon2idSettingsWithinBounds(argon2idSettings) && papelizVaultArgon2idSettingsForTests === null) {
    throw new PapelizVaultDecryptionError('malformed', 'The Argon2id settings are outside the allowed bounds.')
  }
  const { argon2idAsync } = await import('@noble/hashes/argon2.js')
  const passphraseKeyBytes = await argon2idAsync(encodePapelizVaultEncryptionUtf8(normalizePapelizVaultPassphrase(vaultPassphrase)), argon2idSaltBytes, {
    m: argon2idSettings.argon2idMemoryKibibytes,
    t: argon2idSettings.argon2idPassCount,
    p: argon2idSettings.argon2idParallelism,
    dkLen: papelizVaultEncryptionSymmetricKeyByteLength,
    maxmem: argon2idSettings.argon2idMemoryKibibytes * 1024 + 1024 * 1024,
    asyncTick: 10,
    ...(onArgon2idProgress ? { onProgress: onArgon2idProgress } : {}),
  })
  return toPapelizVaultEncryptionWebCryptoBytes(passphraseKeyBytes)
}

function buildPapelizVaultKeyWrapAssociatedDataFields(papelizEncryptedVaultId: string, vaultKeyDerivation: PapelizVaultArgon2idKeyDerivation): string[] {
  return [
    papelizVaultKeyWrapFormat,
    papelizEncryptedVaultId,
    'vault-passphrase',
    'argon2id',
    `m=${vaultKeyDerivation.argon2idMemoryKibibytes}`,
    `t=${vaultKeyDerivation.argon2idPassCount}`,
    `p=${vaultKeyDerivation.argon2idParallelism}`,
    vaultKeyDerivation.vaultKeyDerivationSalt,
  ]
}

export async function wrapPapelizVaultKeyWithPassphrase(passphraseWrapRequest: {
  papelizEncryptedVaultId: string
  vaultEncryptionKeyBytes: Uint8Array
  vaultPassphrase: string
  onArgon2idProgress?: (argon2idProgressFraction: number) => void
}): Promise<PapelizVaultPassphraseWrappedKey> {
  if (passphraseWrapRequest.vaultEncryptionKeyBytes.length !== papelizVaultEncryptionSymmetricKeyByteLength) throw new Error('A vault key is 32 bytes')
  const argon2idSettings = papelizVaultArgon2idSettingsForTests ?? papelizVaultDefaultArgon2idSettings
  const argon2idSaltBytes = createPapelizVaultEncryptionRandomBytes(papelizVaultArgon2idSaltByteLength)
  const passphraseKeyBytes = await derivePapelizVaultPassphraseKeyBytes(
    passphraseWrapRequest.vaultPassphrase,
    argon2idSaltBytes,
    argon2idSettings,
    passphraseWrapRequest.onArgon2idProgress,
  )
  const vaultKeyWrapNonceBytes = createPapelizVaultEncryptionRandomBytes(papelizVaultEncryptionAesGcmNonceByteLength)
  const vaultKeyDerivation: PapelizVaultArgon2idKeyDerivation = {
    vaultKeyDerivationAlgorithm: 'argon2id',
    argon2idMemoryKibibytes: argon2idSettings.argon2idMemoryKibibytes,
    argon2idPassCount: argon2idSettings.argon2idPassCount,
    argon2idParallelism: argon2idSettings.argon2idParallelism,
    vaultKeyDerivationSalt: encodePapelizVaultEncryptionBase64Url(argon2idSaltBytes),
  }
  const wrappedVaultKeyBytes = await encryptPapelizVaultEncryptionAesGcm(
    await importPapelizVaultEncryptionAesGcmKey(passphraseKeyBytes),
    vaultKeyWrapNonceBytes,
    passphraseWrapRequest.vaultEncryptionKeyBytes,
    encodePapelizVaultEncryptionAssociatedData(buildPapelizVaultKeyWrapAssociatedDataFields(passphraseWrapRequest.papelizEncryptedVaultId, vaultKeyDerivation)),
  )
  passphraseKeyBytes.fill(0)
  return {
    vaultKeyWrapFormat: papelizVaultKeyWrapFormat,
    vaultKeyDerivation,
    vaultKeyWrapNonce: encodePapelizVaultEncryptionBase64Url(vaultKeyWrapNonceBytes),
    wrappedVaultEncryptionKey: encodePapelizVaultEncryptionBase64Url(wrappedVaultKeyBytes),
  }
}

// Throws `wrong-key-or-tampered` for a wrong passphrase (or a copy made for another vault).
export async function unwrapPapelizVaultKeyWithPassphrase(passphraseUnwrapRequest: {
  papelizEncryptedVaultId: string
  vaultPassphraseWrappedKey: PapelizVaultPassphraseWrappedKey
  vaultPassphrase: string
  onArgon2idProgress?: (argon2idProgressFraction: number) => void
}): Promise<Uint8Array<ArrayBuffer>> {
  const { vaultPassphraseWrappedKey } = passphraseUnwrapRequest
  if (vaultPassphraseWrappedKey.vaultKeyWrapFormat !== papelizVaultKeyWrapFormat) {
    throw new PapelizVaultDecryptionError('unsupported-format', 'The wrapped vault key has an unknown format.')
  }
  const { vaultKeyDerivation } = vaultPassphraseWrappedKey
  const argon2idSaltBytes = decodePapelizVaultEncryptionBase64Url(vaultKeyDerivation.vaultKeyDerivationSalt)
  const vaultKeyWrapNonceBytes = decodePapelizVaultEncryptionBase64Url(vaultPassphraseWrappedKey.vaultKeyWrapNonce)
  const wrappedVaultKeyBytes = decodePapelizVaultEncryptionBase64Url(vaultPassphraseWrappedKey.wrappedVaultEncryptionKey)
  if (!argon2idSaltBytes || argon2idSaltBytes.length !== papelizVaultArgon2idSaltByteLength || !vaultKeyWrapNonceBytes || !wrappedVaultKeyBytes) {
    throw new PapelizVaultDecryptionError('malformed', 'The wrapped vault key is not laid out as the format says.')
  }
  const passphraseKeyBytes = await derivePapelizVaultPassphraseKeyBytes(
    passphraseUnwrapRequest.vaultPassphrase,
    argon2idSaltBytes,
    vaultKeyDerivation,
    passphraseUnwrapRequest.onArgon2idProgress,
  )
  try {
    const vaultEncryptionKeyBytes = await decryptPapelizVaultEncryptionAesGcm(
      await importPapelizVaultEncryptionAesGcmKey(passphraseKeyBytes),
      vaultKeyWrapNonceBytes,
      wrappedVaultKeyBytes,
      encodePapelizVaultEncryptionAssociatedData(buildPapelizVaultKeyWrapAssociatedDataFields(passphraseUnwrapRequest.papelizEncryptedVaultId, vaultKeyDerivation)),
    )
    if (vaultEncryptionKeyBytes.length !== papelizVaultEncryptionSymmetricKeyByteLength) throw new PapelizVaultDecryptionError('malformed', 'The vault key is not 32 bytes.')
    return vaultEncryptionKeyBytes
  } finally {
    passphraseKeyBytes.fill(0)
  }
}
