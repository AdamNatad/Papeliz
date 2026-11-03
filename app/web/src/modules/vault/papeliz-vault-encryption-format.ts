import {
  concatenatePapelizVaultEncryptionBytes,
  createPapelizVaultEncryptionRandomBytes,
  createPapelizVaultEncryptionRandomIdentifierPart,
  decodePapelizVaultEncryptionHex,
  decryptPapelizVaultEncryptionAesGcm,
  derivePapelizVaultEncryptionSubkeyBytes,
  encodePapelizVaultEncryptionAssociatedData,
  encodePapelizVaultEncryptionHex,
  encodePapelizVaultEncryptionUtf8,
  encryptPapelizVaultEncryptionAesGcm,
  importPapelizVaultEncryptionAesGcmKey,
  openPapelizVaultEncryptionSealedValue,
  padPapelizVaultEncryptionText,
  PapelizVaultDecryptionError,
  papelizVaultEncryptionAesGcmNonceByteLength,
  papelizVaultEncryptionAesGcmTagByteLength,
  papelizVaultEncryptionSymmetricKeyByteLength,
  sealPapelizVaultEncryptionValue,
  toPapelizVaultEncryptionWebCryptoBytes,
  unpadPapelizVaultEncryptionText,
} from './papeliz-vault-encryption-primitives'

// An End-to-end vault's files, format version 1.
//
// Each vault has its own random 32-byte key, and from it, by HKDF-SHA-256 with Papeliz Sync's own
// labels, as Sync's End-to-end files are made, so a later Sync can carry these files as they are,
// without decrypting them:
//
// - the content address key: a file's content address is HMAC-SHA-256 of its plain bytes under it;
// - the file path key: each file's vault path is sealed with it, with the content address of what the
//   file holds, bound to the vault and the file's own entry ID;
// - one file content key per file: HKDF with the file's own random 32-byte salt.
//
// The vault's ID (`pzvault_…`) and each file's entry ID (`pzentry_…`) are Sync's identifier formats,
// made on this device.
//
// One file in `papeliz-encrypted-files/`, named `<entry ID>.papeliz-encrypted`:
//
//   1 byte   container format version (0x01)
//   1 byte   what it holds: 0x01 a file, 0x02 an empty folder
//   2 bytes  the sealed path's length (big-endian)
//   ...      the sealed path: Sync's sealed file path for a file; for a folder, its padded path sealed
//            under the label `papeliz-vault-encryption-folder-path-v1`
//   ...      a file only: its stored object, exactly as Sync stores one: 1 byte format version (0x01),
//            32 bytes file key salt, then the padded stream in 1 MiB chunks, each AES-256-GCM encrypted
//            with its tag, the chunk's index as its nonce, and associated data naming the vault, the
//            content address, the index and whether it is the last chunk
//
// The padded stream: a 1-byte payload form and a 7-byte payload length, the payload (the plain bytes
// as they are, or Sync's deflate-raw form, which this reader also takes), then zeros to Padmé's length
// and never under 1 KiB. A changed byte, a file renamed by hand or moved to another vault fails to
// open.

export const papelizVaultEncryptionHkdfInfos = {
  contentAddressKey: 'papeliz-sync-v1/vault/content-address',
  filePathKey: 'papeliz-sync-v1/vault/file-path',
  fileContentKey: 'papeliz-sync-v1/vault/file-content',
  // The free app's own: the key check in `.papeliz/vault-encryption.json`.
  vaultKeyCheckKey: 'papeliz-vault-encryption-v1/key-check',
} as const

const papelizVaultFileContentLabel = 'papeliz-sync-vault-file-content-v1'
const papelizVaultFilePathLabel = 'papeliz-sync-file-path-v1'
const papelizVaultFolderPathLabel = 'papeliz-vault-encryption-folder-path-v1'
const papelizVaultKeyCheckLabel = 'papeliz-vault-encryption-key-check-v1'

// Where an End-to-end vault's files sit in its folder, beside its plain words for other apps.
export const papelizEncryptedVaultFilesFolderName = 'papeliz-encrypted-files'
export const papelizEncryptedVaultAboutFileName = 'About this Papeliz vault.txt'

export const papelizEncryptedVaultFileExtension = '.papeliz-encrypted'
export const papelizEncryptedVaultFileContainerFormatVersion = 0x01
const papelizEncryptedVaultFileContainerHeaderByteLength = 4
const papelizEncryptedVaultEntryKindBytes = { file: 0x01, folder: 0x02 } as const
export type PapelizEncryptedVaultEntryKind = keyof typeof papelizEncryptedVaultEntryKindBytes

export const papelizVaultStoredFileFormatVersion = 0x01
const papelizVaultFileKeySaltByteLength = 32
const papelizVaultStoredFileHeaderByteLength = 1 + papelizVaultFileKeySaltByteLength
const papelizVaultFileContentChunkByteLength = 1024 * 1024
const papelizVaultMinimumPaddedStreamByteLength = 1024
const papelizVaultPayloadPrefixByteLength = 8
const papelizVaultDeflatedPlainLengthByteLength = 8
const papelizVaultPayloadFormBytes = { 'as-is': 0x00, 'deflate-raw': 0x01 } as const

export const papelizVaultMaximumFileRelativePathByteLength = 4096
const papelizVaultFilePathPaddingBlockByteLength = 64

// The largest plain file a deflate-raw payload may state: what this app ever reads whole.
const papelizVaultInflatedFileByteLimit = 2 * 1024 * 1024 * 1024

// Identifiers ------------------------------------------------------------------------------------------

const papelizEncryptedVaultIdPattern = /^pzvault_[a-z2-7]{26}$/
const papelizEncryptedVaultEntryIdPattern = /^pzentry_[a-z2-7]{26}$/

export function createPapelizEncryptedVaultId(): string {
  return `pzvault_${createPapelizVaultEncryptionRandomIdentifierPart()}`
}

export function isPapelizEncryptedVaultId(papelizEncryptedVaultId: unknown): papelizEncryptedVaultId is string {
  return typeof papelizEncryptedVaultId === 'string' && papelizEncryptedVaultIdPattern.test(papelizEncryptedVaultId)
}

export function createPapelizEncryptedVaultEntryId(): string {
  return `pzentry_${createPapelizVaultEncryptionRandomIdentifierPart()}`
}

// `pzentry_….papeliz-encrypted` -> `pzentry_…`, or null for any other name.
export function readPapelizEncryptedVaultEntryIdFromFileName(encryptedVaultFileName: string): string | null {
  if (!encryptedVaultFileName.endsWith(papelizEncryptedVaultFileExtension)) return null
  const encryptedVaultEntryId = encryptedVaultFileName.slice(0, -papelizEncryptedVaultFileExtension.length)
  return papelizEncryptedVaultEntryIdPattern.test(encryptedVaultEntryId) ? encryptedVaultEntryId : null
}

export function makePapelizEncryptedVaultFileName(encryptedVaultEntryId: string): string {
  return `${encryptedVaultEntryId}${papelizEncryptedVaultFileExtension}`
}

// Keys ---------------------------------------------------------------------------------------------------

// What an unlocked vault holds in memory, all non-extractable.
export interface PapelizEndToEndVaultKeys {
  papelizEncryptedVaultId: string
  contentAddressHmacKey: CryptoKey
  filePathKey: CryptoKey
  fileContentHkdfKey: CryptoKey
  vaultKeyCheckKey: CryptoKey
}

export async function derivePapelizEndToEndVaultKeys(papelizEncryptedVaultId: string, vaultEncryptionKeyBytes: Uint8Array): Promise<PapelizEndToEndVaultKeys> {
  if (vaultEncryptionKeyBytes.length !== papelizVaultEncryptionSymmetricKeyByteLength) throw new Error('A vault key is 32 bytes')
  const emptyHkdfSalt = new Uint8Array(0)
  const contentAddressKeyBytes = await derivePapelizVaultEncryptionSubkeyBytes(vaultEncryptionKeyBytes, emptyHkdfSalt, papelizVaultEncryptionHkdfInfos.contentAddressKey)
  const filePathKeyBytes = await derivePapelizVaultEncryptionSubkeyBytes(vaultEncryptionKeyBytes, emptyHkdfSalt, papelizVaultEncryptionHkdfInfos.filePathKey)
  const vaultKeyCheckKeyBytes = await derivePapelizVaultEncryptionSubkeyBytes(vaultEncryptionKeyBytes, emptyHkdfSalt, papelizVaultEncryptionHkdfInfos.vaultKeyCheckKey)
  try {
    return {
      papelizEncryptedVaultId,
      contentAddressHmacKey: await crypto.subtle.importKey('raw', contentAddressKeyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
      filePathKey: await importPapelizVaultEncryptionAesGcmKey(filePathKeyBytes),
      fileContentHkdfKey: await crypto.subtle.importKey('raw', toPapelizVaultEncryptionWebCryptoBytes(vaultEncryptionKeyBytes), 'HKDF', false, ['deriveKey']),
      vaultKeyCheckKey: await importPapelizVaultEncryptionAesGcmKey(vaultKeyCheckKeyBytes),
    }
  } finally {
    contentAddressKeyBytes.fill(0)
    filePathKeyBytes.fill(0)
    vaultKeyCheckKeyBytes.fill(0)
  }
}

// The key check: a sealed empty value that only this vault's key opens, so a remembered key is known
// good (or not) before any file is read.
export function sealPapelizVaultKeyCheck(vaultKeys: PapelizEndToEndVaultKeys): Promise<Uint8Array<ArrayBuffer>> {
  return sealPapelizVaultEncryptionValue(vaultKeys.vaultKeyCheckKey, new Uint8Array(0), [papelizVaultKeyCheckLabel, vaultKeys.papelizEncryptedVaultId])
}

export async function isPapelizVaultKeyCheckOpened(vaultKeys: PapelizEndToEndVaultKeys, sealedVaultKeyCheckBytes: Uint8Array): Promise<boolean> {
  try {
    await openPapelizVaultEncryptionSealedValue(vaultKeys.vaultKeyCheckKey, sealedVaultKeyCheckBytes, [papelizVaultKeyCheckLabel, vaultKeys.papelizEncryptedVaultId])
    return true
  } catch {
    return false
  }
}

async function derivePapelizVaultFileContentKey(vaultKeys: PapelizEndToEndVaultKeys, fileKeySaltBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: toPapelizVaultEncryptionWebCryptoBytes(fileKeySaltBytes),
      info: encodePapelizVaultEncryptionUtf8(papelizVaultEncryptionHkdfInfos.fileContentKey),
    },
    vaultKeys.fileContentHkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function computePapelizVaultContentAddress(vaultKeys: PapelizEndToEndVaultKeys, plainBytes: Uint8Array): Promise<string> {
  return encodePapelizVaultEncryptionHex(new Uint8Array(await crypto.subtle.sign('HMAC', vaultKeys.contentAddressHmacKey, toPapelizVaultEncryptionWebCryptoBytes(plainBytes))))
}

// Sizes --------------------------------------------------------------------------------------------------

// Padmé (Nikitin et al., "Reducing Metadata Leakage from Encrypted Files and Communication with PURBs"):
// keep the top bits of the length, round the rest up.
function padPapelizVaultStreamByteLength(unpaddedByteLength: number): number {
  if (unpaddedByteLength < 2) return unpaddedByteLength
  const highestBitIndex = readHighestBitIndex(unpaddedByteLength)
  const roundedBitCount = highestBitIndex - (readHighestBitIndex(highestBitIndex) + 1)
  const roundingStep = 2 ** roundedBitCount
  return Math.ceil(unpaddedByteLength / roundingStep) * roundingStep
}

function readHighestBitIndex(positiveInteger: number): number {
  let highestBitIndex = Math.floor(Math.log2(positiveInteger))
  if (2 ** highestBitIndex > positiveInteger) highestBitIndex -= 1
  if (2 ** (highestBitIndex + 1) <= positiveInteger) highestBitIndex += 1
  return highestBitIndex
}

function measurePapelizVaultPaddedStreamByteLength(payloadByteLength: number): number {
  return Math.max(papelizVaultMinimumPaddedStreamByteLength, padPapelizVaultStreamByteLength(papelizVaultPayloadPrefixByteLength + payloadByteLength))
}

function listPapelizVaultChunkByteLengths(paddedStreamByteLength: number): number[] {
  const fileChunkCount = Math.ceil(paddedStreamByteLength / papelizVaultFileContentChunkByteLength)
  return Array.from({ length: fileChunkCount }, (_unused, chunkIndex) =>
    Math.min(papelizVaultFileContentChunkByteLength, paddedStreamByteLength - chunkIndex * papelizVaultFileContentChunkByteLength),
  )
}

// The padded stream's length from a stored object's size, or null when no file stores at that size.
function readPapelizVaultPaddedStreamByteLength(storedObjectByteLength: number): number | null {
  const chunkedByteLength = storedObjectByteLength - papelizVaultStoredFileHeaderByteLength
  if (!Number.isSafeInteger(chunkedByteLength) || chunkedByteLength <= papelizVaultEncryptionAesGcmTagByteLength) return null
  const fileChunkCount = Math.ceil(chunkedByteLength / (papelizVaultFileContentChunkByteLength + papelizVaultEncryptionAesGcmTagByteLength))
  const paddedStreamByteLength = chunkedByteLength - fileChunkCount * papelizVaultEncryptionAesGcmTagByteLength
  if (paddedStreamByteLength < papelizVaultMinimumPaddedStreamByteLength) return null
  return Math.ceil(paddedStreamByteLength / papelizVaultFileContentChunkByteLength) === fileChunkCount ? paddedStreamByteLength : null
}

function buildPapelizVaultChunkNonce(chunkIndex: number): Uint8Array<ArrayBuffer> {
  const chunkNonce = new Uint8Array(papelizVaultEncryptionAesGcmNonceByteLength)
  new DataView(chunkNonce.buffer).setBigUint64(4, BigInt(chunkIndex))
  return chunkNonce
}

function buildPapelizVaultChunkAssociatedData(papelizEncryptedVaultId: string, contentAddress: string, chunkIndex: number, isFinalChunk: boolean): Uint8Array<ArrayBuffer> {
  return encodePapelizVaultEncryptionAssociatedData([papelizVaultFileContentLabel, papelizEncryptedVaultId, contentAddress, String(chunkIndex), isFinalChunk ? 'final' : 'more'])
}

// Stored objects ----------------------------------------------------------------------------------------

// A file's plain bytes as Sync's stored object, with the payload as it is.
export async function encryptPapelizVaultStoredObject(vaultKeys: PapelizEndToEndVaultKeys, plainBytes: Uint8Array, contentAddress: string): Promise<Uint8Array<ArrayBuffer>> {
  const paddedStreamByteLength = measurePapelizVaultPaddedStreamByteLength(plainBytes.length)
  const paddedStreamBytes = new Uint8Array(paddedStreamByteLength)
  const payloadPrefixView = new DataView(paddedStreamBytes.buffer, 0, papelizVaultPayloadPrefixByteLength)
  // A payload length fits in 7 bytes (it is a safe integer), so the form takes the prefix's first byte.
  payloadPrefixView.setBigUint64(0, BigInt(plainBytes.length))
  paddedStreamBytes[0] = papelizVaultPayloadFormBytes['as-is']
  paddedStreamBytes.set(plainBytes, papelizVaultPayloadPrefixByteLength)

  const fileKeySaltBytes = createPapelizVaultEncryptionRandomBytes(papelizVaultFileKeySaltByteLength)
  const fileContentKey = await derivePapelizVaultFileContentKey(vaultKeys, fileKeySaltBytes)
  const storedPieces: Uint8Array[] = [Uint8Array.of(papelizVaultStoredFileFormatVersion), fileKeySaltBytes]
  const chunkByteLengths = listPapelizVaultChunkByteLengths(paddedStreamByteLength)
  let chunkStreamOffset = 0
  for (const [chunkIndex, chunkByteLength] of chunkByteLengths.entries()) {
    storedPieces.push(
      await encryptPapelizVaultEncryptionAesGcm(
        fileContentKey,
        buildPapelizVaultChunkNonce(chunkIndex),
        paddedStreamBytes.subarray(chunkStreamOffset, chunkStreamOffset + chunkByteLength),
        buildPapelizVaultChunkAssociatedData(vaultKeys.papelizEncryptedVaultId, contentAddress, chunkIndex, chunkIndex === chunkByteLengths.length - 1),
      ),
    )
    chunkStreamOffset += chunkByteLength
  }
  paddedStreamBytes.fill(0)
  return concatenatePapelizVaultEncryptionBytes(storedPieces)
}

async function inflatePapelizVaultDeflatedPayload(deflatedPayloadBytes: Uint8Array): Promise<Uint8Array> {
  if (deflatedPayloadBytes.length < papelizVaultDeflatedPlainLengthByteLength) throw new PapelizVaultDecryptionError('malformed', 'The compressed payload is too short.')
  const statedPlainByteLength = Number(new DataView(deflatedPayloadBytes.buffer, deflatedPayloadBytes.byteOffset, deflatedPayloadBytes.byteLength).getBigUint64(0))
  if (!Number.isSafeInteger(statedPlainByteLength) || statedPlainByteLength > papelizVaultInflatedFileByteLimit) {
    throw new PapelizVaultDecryptionError('malformed', 'The compressed file states a length past the largest file taken.')
  }
  const inflatedPlainBytes = new Uint8Array(statedPlainByteLength)
  let inflatedByteLength = 0
  try {
    const inflatingStream = new Blob([toPapelizVaultEncryptionWebCryptoBytes(deflatedPayloadBytes.slice(papelizVaultDeflatedPlainLengthByteLength))])
      .stream()
      .pipeThrough(new DecompressionStream('deflate-raw'))
    for await (const inflatedPiece of inflatingStream as unknown as AsyncIterable<Uint8Array>) {
      if (inflatedByteLength + inflatedPiece.length > statedPlainByteLength) throw new Error('Inflates past its stated length')
      inflatedPlainBytes.set(inflatedPiece, inflatedByteLength)
      inflatedByteLength += inflatedPiece.length
    }
  } catch {
    throw new PapelizVaultDecryptionError('malformed', 'The compressed file does not inflate within the length it states.')
  }
  if (inflatedByteLength !== statedPlainByteLength) throw new PapelizVaultDecryptionError('malformed', 'The compressed file does not inflate to the length it states.')
  return inflatedPlainBytes
}

// The plain bytes, checked whole: every chunk's tag, the padding, the length, and the content address.
export async function decryptPapelizVaultStoredObject(vaultKeys: PapelizEndToEndVaultKeys, storedObjectBytes: Uint8Array, contentAddress: string): Promise<Uint8Array<ArrayBuffer>> {
  const paddedStreamByteLength = readPapelizVaultPaddedStreamByteLength(storedObjectBytes.length)
  if (paddedStreamByteLength === null) throw new PapelizVaultDecryptionError('malformed', 'No stored file has this length.')
  if (storedObjectBytes[0] !== papelizVaultStoredFileFormatVersion) throw new PapelizVaultDecryptionError('unsupported-format', 'The stored file has an unknown format version.')
  const fileContentKey = await derivePapelizVaultFileContentKey(vaultKeys, storedObjectBytes.subarray(1, papelizVaultStoredFileHeaderByteLength))
  const paddedStreamBytes = new Uint8Array(paddedStreamByteLength)
  const chunkByteLengths = listPapelizVaultChunkByteLengths(paddedStreamByteLength)
  let storedOffset = papelizVaultStoredFileHeaderByteLength
  let chunkStreamOffset = 0
  for (const [chunkIndex, chunkByteLength] of chunkByteLengths.entries()) {
    const sealedChunkByteLength = chunkByteLength + papelizVaultEncryptionAesGcmTagByteLength
    paddedStreamBytes.set(
      await decryptPapelizVaultEncryptionAesGcm(
        fileContentKey,
        buildPapelizVaultChunkNonce(chunkIndex),
        storedObjectBytes.subarray(storedOffset, storedOffset + sealedChunkByteLength),
        buildPapelizVaultChunkAssociatedData(vaultKeys.papelizEncryptedVaultId, contentAddress, chunkIndex, chunkIndex === chunkByteLengths.length - 1),
      ),
      chunkStreamOffset,
    )
    storedOffset += sealedChunkByteLength
    chunkStreamOffset += chunkByteLength
  }
  const payloadPrefixView = new DataView(paddedStreamBytes.buffer, 0, papelizVaultPayloadPrefixByteLength)
  const payloadFormByte = payloadPrefixView.getUint8(0)
  if (payloadFormByte !== papelizVaultPayloadFormBytes['as-is'] && payloadFormByte !== papelizVaultPayloadFormBytes['deflate-raw']) {
    throw new PapelizVaultDecryptionError('unsupported-format', 'The stored file has an unknown payload form.')
  }
  const payloadByteLength = Number(payloadPrefixView.getBigUint64(0) & 0x00ff_ffff_ffff_ffffn)
  if (!Number.isSafeInteger(payloadByteLength) || measurePapelizVaultPaddedStreamByteLength(payloadByteLength) !== paddedStreamByteLength) {
    throw new PapelizVaultDecryptionError('malformed', 'The file length inside does not match its stored length.')
  }
  const payloadEndOffset = papelizVaultPayloadPrefixByteLength + payloadByteLength
  if (paddedStreamBytes.subarray(payloadEndOffset).some((paddingByte) => paddingByte !== 0)) throw new PapelizVaultDecryptionError('malformed', 'The padding is not zeros.')
  const payloadBytes = paddedStreamBytes.slice(papelizVaultPayloadPrefixByteLength, payloadEndOffset)
  paddedStreamBytes.fill(0)
  const plainBytes = payloadFormByte === papelizVaultPayloadFormBytes['deflate-raw'] ? await inflatePapelizVaultDeflatedPayload(payloadBytes) : payloadBytes
  if ((await computePapelizVaultContentAddress(vaultKeys, plainBytes)) !== contentAddress) {
    throw new PapelizVaultDecryptionError('content-address-mismatch', 'The file is not what its content address names.')
  }
  return toPapelizVaultEncryptionWebCryptoBytes(plainBytes)
}

// Paths --------------------------------------------------------------------------------------------------

// Relative, with `/` between folders: no leading `/`, no `\`, no empty, `.` or `..` part, no NUL, as
// Sync's rule. Hidden names (`.trash/Inbox.md`, `.papeliz/file-order.json`) are paths like any other.
export function isPapelizEncryptedVaultRelativePathSafe(vaultEntryRelativePath: string): boolean {
  if (vaultEntryRelativePath === '' || vaultEntryRelativePath.includes('\\') || vaultEntryRelativePath.includes('\0')) return false
  if (encodePapelizVaultEncryptionUtf8(vaultEntryRelativePath).length > papelizVaultMaximumFileRelativePathByteLength) return false
  return vaultEntryRelativePath.split('/').every((pathPart) => pathPart !== '' && pathPart !== '.' && pathPart !== '..')
}

// Sync's sealed file path: the content address (32 bytes), then the path padded to 64-byte steps.
async function sealPapelizVaultFilePath(vaultKeys: PapelizEndToEndVaultKeys, encryptedVaultEntryId: string, vaultFileRelativePath: string, contentAddress: string): Promise<Uint8Array<ArrayBuffer>> {
  return sealPapelizVaultEncryptionValue(
    vaultKeys.filePathKey,
    concatenatePapelizVaultEncryptionBytes([
      decodePapelizVaultEncryptionHex(contentAddress),
      padPapelizVaultEncryptionText(vaultFileRelativePath, papelizVaultMaximumFileRelativePathByteLength, papelizVaultFilePathPaddingBlockByteLength),
    ]),
    [papelizVaultFilePathLabel, vaultKeys.papelizEncryptedVaultId, encryptedVaultEntryId],
  )
}

async function sealPapelizVaultFolderPath(vaultKeys: PapelizEndToEndVaultKeys, encryptedVaultEntryId: string, vaultFolderRelativePath: string): Promise<Uint8Array<ArrayBuffer>> {
  return sealPapelizVaultEncryptionValue(
    vaultKeys.filePathKey,
    padPapelizVaultEncryptionText(vaultFolderRelativePath, papelizVaultMaximumFileRelativePathByteLength, papelizVaultFilePathPaddingBlockByteLength),
    [papelizVaultFolderPathLabel, vaultKeys.papelizEncryptedVaultId, encryptedVaultEntryId],
  )
}

// Encrypted vault files ----------------------------------------------------------------------------------

// What one encrypted file says once its path is opened. A file's contents are opened only when read.
export type PapelizEncryptedVaultEntryHeader =
  | { encryptedVaultEntryKind: 'file'; vaultEntryRelativePath: string; vaultFileContentAddress: string; storedObjectBytes: Uint8Array }
  | { encryptedVaultEntryKind: 'folder'; vaultEntryRelativePath: string }

function buildPapelizEncryptedVaultFileBytes(encryptedVaultEntryKind: PapelizEncryptedVaultEntryKind, sealedPathBytes: Uint8Array, storedObjectBytes: Uint8Array | null): Uint8Array<ArrayBuffer> {
  const containerHeaderBytes = new Uint8Array(papelizEncryptedVaultFileContainerHeaderByteLength)
  containerHeaderBytes[0] = papelizEncryptedVaultFileContainerFormatVersion
  containerHeaderBytes[1] = papelizEncryptedVaultEntryKindBytes[encryptedVaultEntryKind]
  new DataView(containerHeaderBytes.buffer).setUint16(2, sealedPathBytes.length)
  return concatenatePapelizVaultEncryptionBytes(storedObjectBytes === null ? [containerHeaderBytes, sealedPathBytes] : [containerHeaderBytes, sealedPathBytes, storedObjectBytes])
}

// A whole encrypted file for a note or any other file at that path.
export async function encryptPapelizVaultFile(
  vaultKeys: PapelizEndToEndVaultKeys,
  encryptedVaultEntryId: string,
  vaultFileRelativePath: string,
  plainBytes: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!isPapelizEncryptedVaultRelativePathSafe(vaultFileRelativePath)) throw new Error('Not a safe vault file path')
  const contentAddress = await computePapelizVaultContentAddress(vaultKeys, plainBytes)
  const storedObjectBytes = await encryptPapelizVaultStoredObject(vaultKeys, plainBytes, contentAddress)
  return buildPapelizEncryptedVaultFileBytes('file', await sealPapelizVaultFilePath(vaultKeys, encryptedVaultEntryId, vaultFileRelativePath, contentAddress), storedObjectBytes)
}

// The same file at a new path (a rename, a move into `.trash/`) or under a new entry ID (a copy): the
// stored object is bound to the vault and its content address only, so it is kept as it is.
export async function resealPapelizEncryptedVaultFile(
  vaultKeys: PapelizEndToEndVaultKeys,
  encryptedVaultEntryId: string,
  vaultFileRelativePath: string,
  encryptedVaultFileHeader: Extract<PapelizEncryptedVaultEntryHeader, { encryptedVaultEntryKind: 'file' }>,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!isPapelizEncryptedVaultRelativePathSafe(vaultFileRelativePath)) throw new Error('Not a safe vault file path')
  return buildPapelizEncryptedVaultFileBytes(
    'file',
    await sealPapelizVaultFilePath(vaultKeys, encryptedVaultEntryId, vaultFileRelativePath, encryptedVaultFileHeader.vaultFileContentAddress),
    encryptedVaultFileHeader.storedObjectBytes,
  )
}

// An empty folder's marker: a folder holding anything is known from its files' paths.
export async function encryptPapelizVaultFolderMarker(vaultKeys: PapelizEndToEndVaultKeys, encryptedVaultEntryId: string, vaultFolderRelativePath: string): Promise<Uint8Array<ArrayBuffer>> {
  if (!isPapelizEncryptedVaultRelativePathSafe(vaultFolderRelativePath)) throw new Error('Not a safe vault folder path')
  return buildPapelizEncryptedVaultFileBytes('folder', await sealPapelizVaultFolderPath(vaultKeys, encryptedVaultEntryId, vaultFolderRelativePath), null)
}

// Opens an encrypted file's path. Throws a `PapelizVaultDecryptionError` for a file that isn't one of
// this vault's, or was changed or renamed by hand.
export async function openPapelizEncryptedVaultFileHeader(
  vaultKeys: PapelizEndToEndVaultKeys,
  encryptedVaultEntryId: string,
  encryptedVaultFileBytes: Uint8Array,
): Promise<PapelizEncryptedVaultEntryHeader> {
  if (encryptedVaultFileBytes.length < papelizEncryptedVaultFileContainerHeaderByteLength) throw new PapelizVaultDecryptionError('malformed', 'The encrypted file is too short.')
  if (encryptedVaultFileBytes[0] !== papelizEncryptedVaultFileContainerFormatVersion) {
    throw new PapelizVaultDecryptionError('unsupported-format', 'The encrypted file has an unknown format version.')
  }
  const containerView = new DataView(encryptedVaultFileBytes.buffer, encryptedVaultFileBytes.byteOffset, encryptedVaultFileBytes.byteLength)
  const sealedPathByteLength = containerView.getUint16(2)
  const sealedPathEndOffset = papelizEncryptedVaultFileContainerHeaderByteLength + sealedPathByteLength
  if (sealedPathEndOffset > encryptedVaultFileBytes.length) throw new PapelizVaultDecryptionError('malformed', 'The encrypted file is cut short.')
  const sealedPathBytes = encryptedVaultFileBytes.subarray(papelizEncryptedVaultFileContainerHeaderByteLength, sealedPathEndOffset)
  const encryptedVaultEntryKindByte = encryptedVaultFileBytes[1]

  if (encryptedVaultEntryKindByte === papelizEncryptedVaultEntryKindBytes.folder) {
    if (sealedPathEndOffset !== encryptedVaultFileBytes.length) throw new PapelizVaultDecryptionError('malformed', 'A folder marker holds more than its path.')
    const vaultFolderRelativePath = unpadPapelizVaultEncryptionText(
      await openPapelizVaultEncryptionSealedValue(vaultKeys.filePathKey, sealedPathBytes, [papelizVaultFolderPathLabel, vaultKeys.papelizEncryptedVaultId, encryptedVaultEntryId]),
    )
    if (!isPapelizEncryptedVaultRelativePathSafe(vaultFolderRelativePath)) throw new PapelizVaultDecryptionError('malformed', 'The path is not a safe vault path.')
    return { encryptedVaultEntryKind: 'folder', vaultEntryRelativePath: vaultFolderRelativePath }
  }
  if (encryptedVaultEntryKindByte !== papelizEncryptedVaultEntryKindBytes.file) throw new PapelizVaultDecryptionError('unsupported-format', 'The encrypted file holds an unknown kind of entry.')

  const { vaultFileRelativePath, vaultFileContentAddress } = await openPapelizVaultSealedFilePath(vaultKeys, encryptedVaultEntryId, sealedPathBytes)
  return {
    encryptedVaultEntryKind: 'file',
    vaultEntryRelativePath: vaultFileRelativePath,
    vaultFileContentAddress,
    storedObjectBytes: encryptedVaultFileBytes.subarray(sealedPathEndOffset),
  }
}

// Sync's sealed file path, opened: the path and the content address it was sealed with.
export async function openPapelizVaultSealedFilePath(
  vaultKeys: PapelizEndToEndVaultKeys,
  encryptedVaultEntryId: string,
  sealedPathBytes: Uint8Array,
): Promise<{ vaultFileRelativePath: string; vaultFileContentAddress: string }> {
  const filePathPlainBytes = await openPapelizVaultEncryptionSealedValue(vaultKeys.filePathKey, sealedPathBytes, [
    papelizVaultFilePathLabel,
    vaultKeys.papelizEncryptedVaultId,
    encryptedVaultEntryId,
  ])
  if (filePathPlainBytes.length < papelizVaultEncryptionSymmetricKeyByteLength + 2) throw new PapelizVaultDecryptionError('malformed', 'The encrypted path is too short.')
  const vaultFileRelativePath = unpadPapelizVaultEncryptionText(filePathPlainBytes.subarray(papelizVaultEncryptionSymmetricKeyByteLength))
  if (!isPapelizEncryptedVaultRelativePathSafe(vaultFileRelativePath)) throw new PapelizVaultDecryptionError('malformed', 'The path is not a safe vault path.')
  return { vaultFileRelativePath, vaultFileContentAddress: encodePapelizVaultEncryptionHex(filePathPlainBytes.subarray(0, papelizVaultEncryptionSymmetricKeyByteLength)) }
}

export function decryptPapelizEncryptedVaultFileContents(
  vaultKeys: PapelizEndToEndVaultKeys,
  encryptedVaultFileHeader: Extract<PapelizEncryptedVaultEntryHeader, { encryptedVaultEntryKind: 'file' }>,
): Promise<Uint8Array<ArrayBuffer>> {
  return decryptPapelizVaultStoredObject(vaultKeys, encryptedVaultFileHeader.storedObjectBytes, encryptedVaultFileHeader.vaultFileContentAddress)
}
