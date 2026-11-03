// The building blocks of an End-to-end vault's encryption, on WebCrypto alone: HKDF-SHA-256 for
// subkeys, HMAC-SHA-256 for content addresses, AES-256-GCM for everything encrypted, and one way to
// write associated data. They are byte for byte Papeliz Sync's own End-to-end primitives, kept here so
// the free web build needs nothing of Sync's; papeliz-vault-encryption-format.test.ts holds them to
// Sync's test vectors (papeliz-vault-encryption-sync-test-vectors.json).
//
// Associated data is a list of text fields, the first naming what is encrypted and its format version.
// Each field is written as its UTF-8 byte length (4 bytes, big-endian) and then its bytes, so no two
// lists encode alike.
//
// A sealed value (an encrypted path, a remembered key) is one byte string: the format version (1 byte,
// 0x01), a random 12-byte nonce, then the AES-256-GCM ciphertext with its 16-byte tag.

export const papelizVaultEncryptionSealedValueFormatVersion = 0x01
export const papelizVaultEncryptionAesGcmNonceByteLength = 12
export const papelizVaultEncryptionAesGcmTagByteLength = 16
export const papelizVaultEncryptionSymmetricKeyByteLength = 32

// - `wrong-key-or-tampered`: the tag didn't match. A wrong passphrase, a key from another vault, or
//   bytes changed or moved by someone: AES-GCM can't tell these apart.
// - `malformed`: the bytes aren't laid out as the format says.
// - `unsupported-format`: a format version this code doesn't know.
// - `content-address-mismatch`: the contents decrypted, but aren't what their content address names.
export type PapelizVaultDecryptionFailureKind = 'wrong-key-or-tampered' | 'malformed' | 'unsupported-format' | 'content-address-mismatch'

export class PapelizVaultDecryptionError extends Error {
  override readonly name = 'PapelizVaultDecryptionError'
  readonly vaultDecryptionFailureKind: PapelizVaultDecryptionFailureKind

  constructor(vaultDecryptionFailureKind: PapelizVaultDecryptionFailureKind, vaultDecryptionFailureMessage: string) {
    super(vaultDecryptionFailureMessage)
    this.vaultDecryptionFailureKind = vaultDecryptionFailureKind
  }
}

// WebCrypto takes byte views of a plain ArrayBuffer; a view of anything else is copied first.
export function toPapelizVaultEncryptionWebCryptoBytes(plainBytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return plainBytes.buffer instanceof ArrayBuffer ? (plainBytes as Uint8Array<ArrayBuffer>) : new Uint8Array(plainBytes)
}

export function createPapelizVaultEncryptionRandomBytes(randomByteLength: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(randomByteLength))
}

const papelizVaultEncryptionUtf8Encoder = new TextEncoder()
const papelizVaultEncryptionUtf8Decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

export function encodePapelizVaultEncryptionUtf8(plainText: string): Uint8Array<ArrayBuffer> {
  return toPapelizVaultEncryptionWebCryptoBytes(papelizVaultEncryptionUtf8Encoder.encode(plainText))
}

// Throws `malformed` for bytes that aren't UTF-8.
export function decodePapelizVaultEncryptionUtf8(utf8Bytes: Uint8Array): string {
  try {
    return papelizVaultEncryptionUtf8Decoder.decode(utf8Bytes)
  } catch {
    throw new PapelizVaultDecryptionError('malformed', 'The decrypted text is not UTF-8.')
  }
}

export function concatenatePapelizVaultEncryptionBytes(byteParts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const joinedBytes = new Uint8Array(byteParts.reduce((joinedByteLength, bytePart) => joinedByteLength + bytePart.length, 0))
  let joinedByteOffset = 0
  for (const bytePart of byteParts) {
    joinedBytes.set(bytePart, joinedByteOffset)
    joinedByteOffset += bytePart.length
  }
  return joinedBytes
}

export function arePapelizVaultEncryptionBytesEqual(firstBytes: Uint8Array, secondBytes: Uint8Array): boolean {
  if (firstBytes.length !== secondBytes.length) return false
  for (let byteIndex = 0; byteIndex < firstBytes.length; byteIndex += 1) if (firstBytes[byteIndex] !== secondBytes[byteIndex]) return false
  return true
}

export function encodePapelizVaultEncryptionHex(plainBytes: Uint8Array): string {
  return Array.from(plainBytes, (plainByte) => plainByte.toString(16).padStart(2, '0')).join('')
}

// Lowercase or uppercase hex; throws for anything else.
export function decodePapelizVaultEncryptionHex(hexText: string): Uint8Array<ArrayBuffer> {
  if (!/^([0-9a-fA-F]{2})*$/.test(hexText)) throw new Error('Not hex text')
  return Uint8Array.from(hexText.match(/../g) ?? [], (hexPair) => Number.parseInt(hexPair, 16))
}

export function encodePapelizVaultEncryptionBase64Url(plainBytes: Uint8Array): string {
  let binaryText = ''
  for (const plainByte of plainBytes) binaryText += String.fromCharCode(plainByte)
  return btoa(binaryText).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

// Null when the text isn't base64url without padding.
export function decodePapelizVaultEncryptionBase64Url(base64UrlText: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(base64UrlText) || base64UrlText.length % 4 === 1) return null
  const binaryText = atob(base64UrlText.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (base64UrlText.length % 4)) % 4))
  return Uint8Array.from(binaryText, (binaryCharacter) => binaryCharacter.charCodeAt(0))
}

// 26 characters of lowercase base32 from the platform's secure random source (130 bits), the random
// part of Sync's identifiers: an End-to-end vault's `pzvault_…` and each encrypted file's `pzentry_…`.
const papelizVaultEncryptionRandomBase32Alphabet = 'abcdefghijklmnopqrstuvwxyz234567'
const papelizVaultEncryptionRandomIdentifierPartLength = 26

export function createPapelizVaultEncryptionRandomIdentifierPart(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(papelizVaultEncryptionRandomIdentifierPartLength))
  // 256 is a multiple of 32, so masking keeps every character equally likely.
  return Array.from(randomBytes, (randomByte) => papelizVaultEncryptionRandomBase32Alphabet[randomByte & 31]).join('')
}

export function encodePapelizVaultEncryptionAssociatedData(associatedDataFields: readonly string[]): Uint8Array<ArrayBuffer> {
  return concatenatePapelizVaultEncryptionBytes(
    associatedDataFields.flatMap((associatedDataField) => {
      const fieldBytes = encodePapelizVaultEncryptionUtf8(associatedDataField)
      const fieldLengthBytes = new Uint8Array(4)
      new DataView(fieldLengthBytes.buffer).setUint32(0, fieldBytes.length)
      return [fieldLengthBytes, fieldBytes]
    }),
  )
}

// HKDF-SHA-256 (RFC 5869), as bytes, so test vectors can show them; they are imported as
// non-extractable keys before use.
export async function derivePapelizVaultEncryptionSubkeyBytes(
  inputKeyBytes: Uint8Array,
  hkdfSaltBytes: Uint8Array,
  hkdfInfoText: string,
  subkeyByteLength: number = papelizVaultEncryptionSymmetricKeyByteLength,
): Promise<Uint8Array<ArrayBuffer>> {
  const hkdfInputKey = await crypto.subtle.importKey('raw', toPapelizVaultEncryptionWebCryptoBytes(inputKeyBytes), 'HKDF', false, ['deriveBits'])
  const subkeyBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: toPapelizVaultEncryptionWebCryptoBytes(hkdfSaltBytes), info: encodePapelizVaultEncryptionUtf8(hkdfInfoText) },
    hkdfInputKey,
    subkeyByteLength * 8,
  )
  return new Uint8Array(subkeyBits)
}

export async function importPapelizVaultEncryptionAesGcmKey(aesGcmKeyBytes: Uint8Array): Promise<CryptoKey> {
  if (aesGcmKeyBytes.length !== papelizVaultEncryptionSymmetricKeyByteLength) throw new Error('An AES-256-GCM key is 32 bytes')
  return crypto.subtle.importKey('raw', toPapelizVaultEncryptionWebCryptoBytes(aesGcmKeyBytes), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function encryptPapelizVaultEncryptionAesGcm(
  aesGcmKey: CryptoKey,
  aesGcmNonce: Uint8Array,
  plainBytes: Uint8Array,
  associatedDataBytes: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  if (aesGcmNonce.length !== papelizVaultEncryptionAesGcmNonceByteLength) throw new Error('An AES-GCM nonce is 12 bytes')
  const cipherBytes = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toPapelizVaultEncryptionWebCryptoBytes(aesGcmNonce),
      additionalData: toPapelizVaultEncryptionWebCryptoBytes(associatedDataBytes),
      tagLength: 128,
    },
    aesGcmKey,
    toPapelizVaultEncryptionWebCryptoBytes(plainBytes),
  )
  return new Uint8Array(cipherBytes)
}

// Throws `wrong-key-or-tampered` when the tag doesn't match.
export async function decryptPapelizVaultEncryptionAesGcm(
  aesGcmKey: CryptoKey,
  aesGcmNonce: Uint8Array,
  cipherBytes: Uint8Array,
  associatedDataBytes: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  if (aesGcmNonce.length !== papelizVaultEncryptionAesGcmNonceByteLength || cipherBytes.length < papelizVaultEncryptionAesGcmTagByteLength) {
    throw new PapelizVaultDecryptionError('malformed', 'The encrypted bytes are too short.')
  }
  try {
    const plainBytes = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: toPapelizVaultEncryptionWebCryptoBytes(aesGcmNonce),
        additionalData: toPapelizVaultEncryptionWebCryptoBytes(associatedDataBytes),
        tagLength: 128,
      },
      aesGcmKey,
      toPapelizVaultEncryptionWebCryptoBytes(cipherBytes),
    )
    return new Uint8Array(plainBytes)
  } catch {
    throw new PapelizVaultDecryptionError('wrong-key-or-tampered', 'The key is wrong, or the encrypted bytes were changed or moved.')
  }
}

// A fixed nonce is for test vectors only; everything else gets a fresh random one.
export async function sealPapelizVaultEncryptionValue(
  aesGcmKey: CryptoKey,
  plainBytes: Uint8Array,
  associatedDataFields: readonly string[],
  fixedNonceForTestVectors?: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  const aesGcmNonce = fixedNonceForTestVectors ?? createPapelizVaultEncryptionRandomBytes(papelizVaultEncryptionAesGcmNonceByteLength)
  const cipherBytes = await encryptPapelizVaultEncryptionAesGcm(aesGcmKey, aesGcmNonce, plainBytes, encodePapelizVaultEncryptionAssociatedData(associatedDataFields))
  return concatenatePapelizVaultEncryptionBytes([Uint8Array.of(papelizVaultEncryptionSealedValueFormatVersion), aesGcmNonce, cipherBytes])
}

export async function openPapelizVaultEncryptionSealedValue(
  aesGcmKey: CryptoKey,
  sealedBytes: Uint8Array,
  associatedDataFields: readonly string[],
): Promise<Uint8Array<ArrayBuffer>> {
  if (sealedBytes.length < 1 + papelizVaultEncryptionAesGcmNonceByteLength + papelizVaultEncryptionAesGcmTagByteLength) {
    throw new PapelizVaultDecryptionError('malformed', 'The sealed value is too short.')
  }
  if (sealedBytes[0] !== papelizVaultEncryptionSealedValueFormatVersion) {
    throw new PapelizVaultDecryptionError('unsupported-format', 'The sealed value has an unknown format version.')
  }
  return decryptPapelizVaultEncryptionAesGcm(
    aesGcmKey,
    sealedBytes.subarray(1, 1 + papelizVaultEncryptionAesGcmNonceByteLength),
    sealedBytes.subarray(1 + papelizVaultEncryptionAesGcmNonceByteLength),
    encodePapelizVaultEncryptionAssociatedData(associatedDataFields),
  )
}

// Short text (a path) before sealing: its UTF-8 length (2 bytes, big-endian), its bytes, then zeros up
// to a multiple of `paddingBlockByteLength`, so a sealed path says little about its length.
export function padPapelizVaultEncryptionText(plainText: string, maximumTextByteLength: number, paddingBlockByteLength: number): Uint8Array<ArrayBuffer> {
  const textBytes = encodePapelizVaultEncryptionUtf8(plainText)
  if (textBytes.length > maximumTextByteLength || textBytes.length > 0xffff) throw new Error(`The text is longer than ${maximumTextByteLength} bytes`)
  const paddedByteLength = Math.ceil((2 + textBytes.length) / paddingBlockByteLength) * paddingBlockByteLength
  const paddedBytes = new Uint8Array(paddedByteLength)
  new DataView(paddedBytes.buffer).setUint16(0, textBytes.length)
  paddedBytes.set(textBytes, 2)
  return paddedBytes
}

export function unpadPapelizVaultEncryptionText(paddedBytes: Uint8Array): string {
  if (paddedBytes.length < 2) throw new PapelizVaultDecryptionError('malformed', 'The padded text is too short.')
  const textByteLength = new DataView(paddedBytes.buffer, paddedBytes.byteOffset, paddedBytes.byteLength).getUint16(0)
  if (2 + textByteLength > paddedBytes.length || paddedBytes.subarray(2 + textByteLength).some((paddingByte) => paddingByte !== 0)) {
    throw new PapelizVaultDecryptionError('malformed', 'The padded text is not laid out as the format says.')
  }
  return decodePapelizVaultEncryptionUtf8(paddedBytes.subarray(2, 2 + textByteLength))
}
