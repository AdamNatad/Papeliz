import { argon2idAsync } from '@noble/hashes/argon2.js'

// An End-to-end vault's key, wrapped with its passphrase: Papeliz Sync's format
// `papeliz-sync-vault-key-wrap-v2`, written out here so the account page can change a vault's
// passphrase on its own. It imports nothing from Sync's code, and its test checks it against Sync's
// published test vectors.
//
//   vault passphrase ──Argon2id──→ passphrase key ──AES-256-GCM──→ the vault's 32-byte key
//
// The wrapped copy carries the Argon2id settings and salt it was made with, the nonce, and the
// ciphertext with its tag. The associated data names the format, the account, the vault and every
// derivation setting, so a copy made for one vault never opens as another's. Changing the passphrase
// wraps the same vault key again, so nothing uploads again and devices that hold the key keep working.

export const papelizAccountSyncVaultKeyWrapFormat = 'papeliz-sync-vault-key-wrap-v2'

// The bounds a stored setting is held to, so a changed or broken reply can't make this page spend
// unbounded memory or time, or derive a weak key.
export const papelizAccountSyncArgon2idSettingBounds = {
  argon2idMemoryKibibytes: { minimumSetting: 19_456, maximumSetting: 1_048_576 },
  argon2idPassCount: { minimumSetting: 1, maximumSetting: 10 },
  argon2idParallelism: { minimumSetting: 1, maximumSetting: 4 },
} as const

// The settings every new wrapped copy gets: about a second on a phone.
export const papelizAccountSyncDefaultArgon2idSettings = {
  argon2idMemoryKibibytes: 65_536,
  argon2idPassCount: 3,
  argon2idParallelism: 1,
} as const

export const papelizAccountSyncMinimumPassphraseCharacterCount = 12

const papelizAccountSyncVaultKeyByteLength = 32
const papelizAccountSyncArgon2idSaltByteLength = 16
const papelizAccountSyncAesGcmNonceByteLength = 12
const papelizAccountSyncAesGcmTagByteLength = 16

export type PapelizAccountSyncArgon2idSettings = {
  argon2idMemoryKibibytes: number
  argon2idPassCount: number
  argon2idParallelism: number
}

export interface PapelizAccountSyncArgon2idKeyDerivation extends PapelizAccountSyncArgon2idSettings {
  syncKeyDerivationAlgorithm: 'argon2id'
  syncKeyDerivationSalt: string
}

export interface PapelizAccountSyncPassphraseWrappedVaultKey {
  syncVaultKeyWrapFormat: typeof papelizAccountSyncVaultKeyWrapFormat
  syncKeyDerivation: PapelizAccountSyncArgon2idKeyDerivation
  syncKeyWrapNonce: string
  wrappedSyncVaultKey: string
}

// - `wrong-passphrase`: the tag didn't match: a wrong passphrase, or a copy made for another account or
//   vault, or changed bytes. AES-GCM can't tell these apart.
// - `malformed`: the copy isn't laid out as the format says, or its settings are out of bounds.
// - `unsupported-format`: a format this page doesn't know.
export type PapelizAccountSyncVaultKeyWrapFailureKind = 'wrong-passphrase' | 'malformed' | 'unsupported-format'

export class PapelizAccountSyncVaultKeyWrapError extends Error {
  override readonly name = 'PapelizAccountSyncVaultKeyWrapError'
  readonly syncVaultKeyWrapFailureKind: PapelizAccountSyncVaultKeyWrapFailureKind

  constructor(syncVaultKeyWrapFailureKind: PapelizAccountSyncVaultKeyWrapFailureKind, syncVaultKeyWrapFailureMessage: string) {
    super(syncVaultKeyWrapFailureMessage)
    this.syncVaultKeyWrapFailureKind = syncVaultKeyWrapFailureKind
  }
}

// Bytes and text --------------------------------------------------------------------------------------

// WebCrypto takes byte views of a plain ArrayBuffer; a view of anything else is copied first.
function toPapelizAccountWebCryptoBytes(plainBytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return plainBytes.buffer instanceof ArrayBuffer ? (plainBytes as Uint8Array<ArrayBuffer>) : new Uint8Array(plainBytes)
}

const papelizAccountUtf8Encoder = new TextEncoder()

function encodePapelizAccountUtf8(plainText: string): Uint8Array<ArrayBuffer> {
  return toPapelizAccountWebCryptoBytes(papelizAccountUtf8Encoder.encode(plainText))
}

export function encodePapelizAccountSyncBase64Url(plainBytes: Uint8Array): string {
  let binaryText = ''
  for (const plainByte of plainBytes) binaryText += String.fromCharCode(plainByte)
  return btoa(binaryText).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

// Null when the text isn't base64url without padding.
export function decodePapelizAccountSyncBase64Url(base64UrlText: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(base64UrlText) || base64UrlText.length % 4 === 1) return null
  const binaryText = atob(base64UrlText.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (base64UrlText.length % 4)) % 4))
  return Uint8Array.from(binaryText, (binaryCharacter) => binaryCharacter.charCodeAt(0))
}

// Each field as its UTF-8 byte length (4 bytes, big-endian) and then its bytes, so no two lists encode alike.
function encodePapelizAccountSyncAssociatedData(associatedDataFields: readonly string[]): Uint8Array<ArrayBuffer> {
  const fieldByteParts = associatedDataFields.flatMap((associatedDataField) => {
    const fieldBytes = encodePapelizAccountUtf8(associatedDataField)
    const fieldLengthBytes = new Uint8Array(4)
    new DataView(fieldLengthBytes.buffer).setUint32(0, fieldBytes.length)
    return [fieldLengthBytes, fieldBytes]
  })
  const associatedDataBytes = new Uint8Array(fieldByteParts.reduce((joinedByteLength, fieldBytePart) => joinedByteLength + fieldBytePart.length, 0))
  let joinedByteOffset = 0
  for (const fieldBytePart of fieldByteParts) {
    associatedDataBytes.set(fieldBytePart, joinedByteOffset)
    joinedByteOffset += fieldBytePart.length
  }
  return associatedDataBytes
}

// The passphrase as stored and compared: Unicode NFC, so the same words typed on two systems match.
// Nothing is trimmed.
export function normalizePapelizAccountSyncPassphrase(syncVaultPassphrase: string): string {
  return syncVaultPassphrase.normalize('NFC')
}

export function isPapelizAccountSyncPassphraseLongEnough(syncVaultPassphrase: string): boolean {
  return [...normalizePapelizAccountSyncPassphrase(syncVaultPassphrase)].length >= papelizAccountSyncMinimumPassphraseCharacterCount
}

// Checking a wrapped copy -------------------------------------------------------------------------------

function isPapelizAccountSyncBase64UrlOfLength(candidateText: unknown, base64UrlCharacterCount: number): candidateText is string {
  return typeof candidateText === 'string' && candidateText.length === base64UrlCharacterCount && /^[A-Za-z0-9_-]*$/.test(candidateText)
}

function areObjectKeysExactly(candidateObject: object, expectedKeys: readonly string[]): boolean {
  const candidateKeys = Object.keys(candidateObject)
  return candidateKeys.length === expectedKeys.length && expectedKeys.every((expectedKey) => candidateKeys.includes(expectedKey))
}

export function areArgon2idSettingsWithinPapelizAccountSyncBounds(argon2idSettings: PapelizAccountSyncArgon2idSettings): boolean {
  return (Object.keys(papelizAccountSyncArgon2idSettingBounds) as (keyof typeof papelizAccountSyncArgon2idSettingBounds)[]).every((argon2idSettingName) => {
    const argon2idSetting = argon2idSettings[argon2idSettingName]
    const argon2idSettingBounds = papelizAccountSyncArgon2idSettingBounds[argon2idSettingName]
    return Number.isSafeInteger(argon2idSetting) && argon2idSetting >= argon2idSettingBounds.minimumSetting && argon2idSetting <= argon2idSettingBounds.maximumSetting
  })
}

// Exact keys, as Sync stores and hands back a wrapped copy: a 16-byte salt, a 12-byte nonce, and the
// 32-byte key with its 16-byte tag, each as base64url.
export function isPapelizAccountSyncPassphraseWrappedVaultKey(wrappedVaultKeyCandidate: unknown): wrappedVaultKeyCandidate is PapelizAccountSyncPassphraseWrappedVaultKey {
  if (typeof wrappedVaultKeyCandidate !== 'object' || wrappedVaultKeyCandidate === null) return false
  if (!areObjectKeysExactly(wrappedVaultKeyCandidate, ['syncVaultKeyWrapFormat', 'syncKeyDerivation', 'syncKeyWrapNonce', 'wrappedSyncVaultKey'])) return false
  const { syncVaultKeyWrapFormat, syncKeyDerivation, syncKeyWrapNonce, wrappedSyncVaultKey } = wrappedVaultKeyCandidate as Record<string, unknown>
  if (syncVaultKeyWrapFormat !== papelizAccountSyncVaultKeyWrapFormat) return false
  if (typeof syncKeyDerivation !== 'object' || syncKeyDerivation === null) return false
  if (
    !areObjectKeysExactly(syncKeyDerivation, ['syncKeyDerivationAlgorithm', 'argon2idMemoryKibibytes', 'argon2idPassCount', 'argon2idParallelism', 'syncKeyDerivationSalt'])
  ) {
    return false
  }
  const keyDerivation = syncKeyDerivation as Record<string, unknown>
  return (
    keyDerivation.syncKeyDerivationAlgorithm === 'argon2id' &&
    areArgon2idSettingsWithinPapelizAccountSyncBounds(keyDerivation as unknown as PapelizAccountSyncArgon2idSettings) &&
    isPapelizAccountSyncBase64UrlOfLength(keyDerivation.syncKeyDerivationSalt, 22) &&
    isPapelizAccountSyncBase64UrlOfLength(syncKeyWrapNonce, 16) &&
    isPapelizAccountSyncBase64UrlOfLength(wrappedSyncVaultKey, 64)
  )
}

// Deriving, wrapping and unwrapping ----------------------------------------------------------------------

// The 32-byte key that wraps the vault's key, from its passphrase. Slow on purpose.
export async function derivePapelizAccountSyncPassphraseKeyBytes(
  syncVaultPassphrase: string,
  argon2idSaltBytes: Uint8Array,
  argon2idSettings: PapelizAccountSyncArgon2idSettings,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!areArgon2idSettingsWithinPapelizAccountSyncBounds(argon2idSettings)) {
    throw new PapelizAccountSyncVaultKeyWrapError('malformed', 'The Argon2id settings are outside the allowed bounds.')
  }
  const passphraseKeyBytes = await argon2idAsync(encodePapelizAccountUtf8(normalizePapelizAccountSyncPassphrase(syncVaultPassphrase)), argon2idSaltBytes, {
    m: argon2idSettings.argon2idMemoryKibibytes,
    t: argon2idSettings.argon2idPassCount,
    p: argon2idSettings.argon2idParallelism,
    dkLen: papelizAccountSyncVaultKeyByteLength,
    maxmem: argon2idSettings.argon2idMemoryKibibytes * 1024 + 1024 * 1024,
    asyncTick: 10,
  })
  return toPapelizAccountWebCryptoBytes(passphraseKeyBytes)
}

function buildPapelizAccountSyncVaultKeyWrapAssociatedDataFields(
  papelizSyncAccountId: string,
  papelizSyncVaultId: string,
  wrappedVaultKeyParts: Omit<PapelizAccountSyncPassphraseWrappedVaultKey, 'wrappedSyncVaultKey'>,
): string[] {
  const syncKeyDerivation = wrappedVaultKeyParts.syncKeyDerivation
  return [
    wrappedVaultKeyParts.syncVaultKeyWrapFormat,
    papelizSyncAccountId,
    papelizSyncVaultId,
    'vault-passphrase',
    'argon2id',
    `m=${syncKeyDerivation.argon2idMemoryKibibytes}`,
    `t=${syncKeyDerivation.argon2idPassCount}`,
    `p=${syncKeyDerivation.argon2idParallelism}`,
    syncKeyDerivation.syncKeyDerivationSalt,
  ]
}

async function importPapelizAccountSyncAesGcmKey(aesGcmKeyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', toPapelizAccountWebCryptoBytes(aesGcmKeyBytes), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

// Fixed salt and nonce are for test vectors only; every real copy gets fresh random ones.
export interface PapelizAccountSyncKeyWrapFixedRandomness {
  syncKeyDerivationSaltBytes: Uint8Array
  syncKeyWrapNonceBytes: Uint8Array
}

export async function wrapPapelizAccountSyncVaultKeyWithPassphrase(passphraseWrapRequest: {
  papelizSyncAccountId: string
  papelizSyncVaultId: string
  syncVaultKeyBytes: Uint8Array
  syncVaultPassphrase: string
  argon2idSettings?: PapelizAccountSyncArgon2idSettings
  fixedRandomnessForTestVectors?: PapelizAccountSyncKeyWrapFixedRandomness
}): Promise<PapelizAccountSyncPassphraseWrappedVaultKey> {
  if (passphraseWrapRequest.syncVaultKeyBytes.length !== papelizAccountSyncVaultKeyByteLength) throw new Error('A vault key is 32 bytes')
  const argon2idSettings = passphraseWrapRequest.argon2idSettings ?? papelizAccountSyncDefaultArgon2idSettings
  const argon2idSaltBytes =
    passphraseWrapRequest.fixedRandomnessForTestVectors?.syncKeyDerivationSaltBytes ?? crypto.getRandomValues(new Uint8Array(papelizAccountSyncArgon2idSaltByteLength))
  const syncKeyWrapNonceBytes =
    passphraseWrapRequest.fixedRandomnessForTestVectors?.syncKeyWrapNonceBytes ?? crypto.getRandomValues(new Uint8Array(papelizAccountSyncAesGcmNonceByteLength))
  if (argon2idSaltBytes.length !== papelizAccountSyncArgon2idSaltByteLength || syncKeyWrapNonceBytes.length !== papelizAccountSyncAesGcmNonceByteLength) {
    throw new Error('The salt is 16 bytes and the nonce 12')
  }
  const passphraseKeyBytes = await derivePapelizAccountSyncPassphraseKeyBytes(passphraseWrapRequest.syncVaultPassphrase, argon2idSaltBytes, argon2idSettings)
  const wrappedVaultKeyParts: Omit<PapelizAccountSyncPassphraseWrappedVaultKey, 'wrappedSyncVaultKey'> = {
    syncVaultKeyWrapFormat: papelizAccountSyncVaultKeyWrapFormat,
    syncKeyDerivation: {
      syncKeyDerivationAlgorithm: 'argon2id',
      argon2idMemoryKibibytes: argon2idSettings.argon2idMemoryKibibytes,
      argon2idPassCount: argon2idSettings.argon2idPassCount,
      argon2idParallelism: argon2idSettings.argon2idParallelism,
      syncKeyDerivationSalt: encodePapelizAccountSyncBase64Url(argon2idSaltBytes),
    },
    syncKeyWrapNonce: encodePapelizAccountSyncBase64Url(syncKeyWrapNonceBytes),
  }
  const wrappedVaultKeyBytes = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toPapelizAccountWebCryptoBytes(syncKeyWrapNonceBytes),
      additionalData: encodePapelizAccountSyncAssociatedData(
        buildPapelizAccountSyncVaultKeyWrapAssociatedDataFields(passphraseWrapRequest.papelizSyncAccountId, passphraseWrapRequest.papelizSyncVaultId, wrappedVaultKeyParts),
      ),
      tagLength: papelizAccountSyncAesGcmTagByteLength * 8,
    },
    await importPapelizAccountSyncAesGcmKey(passphraseKeyBytes),
    toPapelizAccountWebCryptoBytes(passphraseWrapRequest.syncVaultKeyBytes),
  )
  return { ...wrappedVaultKeyParts, wrappedSyncVaultKey: encodePapelizAccountSyncBase64Url(new Uint8Array(wrappedVaultKeyBytes)) }
}

// Throws `wrong-passphrase` for a wrong passphrase (or a copy made for another account or vault).
export async function unwrapPapelizAccountSyncVaultKeyWithPassphrase(passphraseUnwrapRequest: {
  papelizSyncAccountId: string
  papelizSyncVaultId: string
  passphraseWrappedSyncVaultKey: PapelizAccountSyncPassphraseWrappedVaultKey
  syncVaultPassphrase: string
}): Promise<Uint8Array<ArrayBuffer>> {
  const passphraseWrappedSyncVaultKey: unknown = passphraseUnwrapRequest.passphraseWrappedSyncVaultKey
  if (
    typeof passphraseWrappedSyncVaultKey === 'object' &&
    passphraseWrappedSyncVaultKey !== null &&
    'syncVaultKeyWrapFormat' in passphraseWrappedSyncVaultKey &&
    passphraseWrappedSyncVaultKey.syncVaultKeyWrapFormat !== papelizAccountSyncVaultKeyWrapFormat
  ) {
    throw new PapelizAccountSyncVaultKeyWrapError('unsupported-format', 'The wrapped vault key has an unknown format.')
  }
  if (!isPapelizAccountSyncPassphraseWrappedVaultKey(passphraseWrappedSyncVaultKey)) {
    throw new PapelizAccountSyncVaultKeyWrapError('malformed', 'The wrapped vault key is not laid out as the format says.')
  }
  const syncKeyDerivation = passphraseWrappedSyncVaultKey.syncKeyDerivation
  const argon2idSaltBytes = decodePapelizAccountSyncBase64Url(syncKeyDerivation.syncKeyDerivationSalt)
  const syncKeyWrapNonceBytes = decodePapelizAccountSyncBase64Url(passphraseWrappedSyncVaultKey.syncKeyWrapNonce)
  const wrappedVaultKeyBytes = decodePapelizAccountSyncBase64Url(passphraseWrappedSyncVaultKey.wrappedSyncVaultKey)
  if (
    argon2idSaltBytes?.length !== papelizAccountSyncArgon2idSaltByteLength ||
    syncKeyWrapNonceBytes?.length !== papelizAccountSyncAesGcmNonceByteLength ||
    wrappedVaultKeyBytes?.length !== papelizAccountSyncVaultKeyByteLength + papelizAccountSyncAesGcmTagByteLength
  ) {
    throw new PapelizAccountSyncVaultKeyWrapError('malformed', 'The wrapped vault key is not base64url of the right lengths.')
  }
  const passphraseKeyBytes = await derivePapelizAccountSyncPassphraseKeyBytes(passphraseUnwrapRequest.syncVaultPassphrase, argon2idSaltBytes, syncKeyDerivation)
  let syncVaultKeyBuffer: ArrayBuffer
  try {
    syncVaultKeyBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: syncKeyWrapNonceBytes,
        additionalData: encodePapelizAccountSyncAssociatedData(
          buildPapelizAccountSyncVaultKeyWrapAssociatedDataFields(
            passphraseUnwrapRequest.papelizSyncAccountId,
            passphraseUnwrapRequest.papelizSyncVaultId,
            passphraseWrappedSyncVaultKey,
          ),
        ),
        tagLength: papelizAccountSyncAesGcmTagByteLength * 8,
      },
      await importPapelizAccountSyncAesGcmKey(passphraseKeyBytes),
      wrappedVaultKeyBytes,
    )
  } catch {
    throw new PapelizAccountSyncVaultKeyWrapError('wrong-passphrase', 'The passphrase is wrong, or the wrapped copy was made for another vault or changed.')
  }
  return new Uint8Array(syncVaultKeyBuffer)
}

// Change Passphrase: opens the vault's key with the current passphrase, then wraps the same key with
// the new one, with a fresh salt and nonce and the default settings. The vault key is never returned.
export async function rewrapPapelizAccountSyncVaultKeyWithNewPassphrase(passphraseRewrapRequest: {
  papelizSyncAccountId: string
  papelizSyncVaultId: string
  passphraseWrappedSyncVaultKey: PapelizAccountSyncPassphraseWrappedVaultKey
  currentSyncVaultPassphrase: string
  newSyncVaultPassphrase: string
}): Promise<PapelizAccountSyncPassphraseWrappedVaultKey> {
  if (!isPapelizAccountSyncPassphraseLongEnough(passphraseRewrapRequest.newSyncVaultPassphrase)) {
    throw new Error(`A passphrase has at least ${papelizAccountSyncMinimumPassphraseCharacterCount} characters`)
  }
  const syncVaultKeyBytes = await unwrapPapelizAccountSyncVaultKeyWithPassphrase({
    papelizSyncAccountId: passphraseRewrapRequest.papelizSyncAccountId,
    papelizSyncVaultId: passphraseRewrapRequest.papelizSyncVaultId,
    passphraseWrappedSyncVaultKey: passphraseRewrapRequest.passphraseWrappedSyncVaultKey,
    syncVaultPassphrase: passphraseRewrapRequest.currentSyncVaultPassphrase,
  })
  try {
    return await wrapPapelizAccountSyncVaultKeyWithPassphrase({
      papelizSyncAccountId: passphraseRewrapRequest.papelizSyncAccountId,
      papelizSyncVaultId: passphraseRewrapRequest.papelizSyncVaultId,
      syncVaultKeyBytes,
      syncVaultPassphrase: passphraseRewrapRequest.newSyncVaultPassphrase,
    })
  } finally {
    syncVaultKeyBytes.fill(0)
  }
}
