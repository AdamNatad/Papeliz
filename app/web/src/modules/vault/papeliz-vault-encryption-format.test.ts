import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  computePapelizVaultContentAddress,
  createPapelizEncryptedVaultEntryId,
  createPapelizEncryptedVaultId,
  isPapelizEncryptedVaultId,
  makePapelizEncryptedVaultFileName,
  readPapelizEncryptedVaultEntryIdFromFileName,
  decryptPapelizEncryptedVaultFileContents,
  decryptPapelizVaultStoredObject,
  derivePapelizEndToEndVaultKeys,
  encryptPapelizVaultFile,
  encryptPapelizVaultFolderMarker,
  openPapelizEncryptedVaultFileHeader,
  openPapelizVaultSealedFilePath,
  papelizVaultEncryptionHkdfInfos,
  resealPapelizEncryptedVaultFile,
} from './papeliz-vault-encryption-format'
import {
  decodePapelizVaultEncryptionBase64Url,
  decodePapelizVaultEncryptionHex,
  derivePapelizVaultEncryptionSubkeyBytes,
  encodePapelizVaultEncryptionHex,
  PapelizVaultDecryptionError,
} from './papeliz-vault-encryption-primitives'
import papelizVaultEncryptionSyncTestVectors from './papeliz-vault-encryption-sync-test-vectors.json'

// The End-to-end file format, byte for byte Papeliz Sync's: the subkeys, the stored objects and the
// sealed paths are held to Sync's own test vectors, so a later Sync carries these files as they are.
// Then the container around them, and what a changed byte, a renamed file or another vault does.

const testVaultId = 'pzvault_abcdefghijklmnopqrstuvwxyz'
const testEntryId = 'pzentry_abcdefghijklmnopqrstuvwxyz'
const testVaultKeyBytes = Uint8Array.from({ length: 32 }, (_unused, byteIndex) => byteIndex + 1)

async function expectDecryptionFailure(decryptingCall: Promise<unknown>): Promise<string> {
  try {
    await decryptingCall
  } catch (decryptionError) {
    if (decryptionError instanceof PapelizVaultDecryptionError) return decryptionError.vaultDecryptionFailureKind
    throw decryptionError
  }
  throw new Error('It decrypted.')
}

describe('the format, against Sync’s test vectors', () => {
  it('derives the same vault subkeys', async () => {
    const { vaultSubkeyVector } = papelizVaultEncryptionSyncTestVectors
    const vaultKeyBytes = decodePapelizVaultEncryptionHex(vaultSubkeyVector.syncVaultKeyHex)
    const emptyHkdfSalt = new Uint8Array(0)
    expect(encodePapelizVaultEncryptionHex(await derivePapelizVaultEncryptionSubkeyBytes(vaultKeyBytes, emptyHkdfSalt, papelizVaultEncryptionHkdfInfos.contentAddressKey))).toBe(
      vaultSubkeyVector.contentAddressKeyHex,
    )
    expect(encodePapelizVaultEncryptionHex(await derivePapelizVaultEncryptionSubkeyBytes(vaultKeyBytes, emptyHkdfSalt, papelizVaultEncryptionHkdfInfos.filePathKey))).toBe(
      vaultSubkeyVector.filePathKeyHex,
    )
  })

  it.each(papelizVaultEncryptionSyncTestVectors.fileContentVectors.map((fileContentVector) => [fileContentVector.testVectorName, fileContentVector] as const))(
    'decrypts Sync’s stored object: %s',
    async (_testVectorName, fileContentVector) => {
      const vaultKeys = await derivePapelizEndToEndVaultKeys(fileContentVector.papelizSyncVaultId, decodePapelizVaultEncryptionHex(fileContentVector.syncVaultKeyHex))
      const plainBytes = await decryptPapelizVaultStoredObject(vaultKeys, decodePapelizVaultEncryptionHex(fileContentVector.storedBytesHex), fileContentVector.syncFileContentAddress)
      expect(new TextDecoder().decode(plainBytes)).toBe(fileContentVector.plainBytes.plainUtf8Text)
      expect(await computePapelizVaultContentAddress(vaultKeys, plainBytes)).toBe(fileContentVector.syncFileContentAddress)
    },
  )

  it.each(papelizVaultEncryptionSyncTestVectors.filePathVectors.map((filePathVector) => [filePathVector.testVectorName, filePathVector] as const))(
    'opens Sync’s sealed path: %s',
    async (_testVectorName, filePathVector) => {
      const vaultKeys = await derivePapelizEndToEndVaultKeys(filePathVector.papelizSyncVaultId, decodePapelizVaultEncryptionHex(filePathVector.syncVaultKeyHex))
      const sealedPathBytes = decodePapelizVaultEncryptionBase64Url(filePathVector.encryptedSyncFileRelativePath)
      if (sealedPathBytes === null) throw new Error('Not base64url')
      expect(await openPapelizVaultSealedFilePath(vaultKeys, filePathVector.papelizSyncFileEntryId, sealedPathBytes)).toEqual({
        vaultFileRelativePath: filePathVector.vaultFileRelativePath,
        vaultFileContentAddress: filePathVector.syncFileContentAddress,
      })
    },
  )
})

describe('the IDs', () => {
  it('makes vault and entry IDs in Sync’s formats, and a vault ID the Windows key store takes', () => {
    for (let createdIdCount = 0; createdIdCount < 200; createdIdCount += 1) {
      const papelizEncryptedVaultId = createPapelizEncryptedVaultId()
      expect(papelizEncryptedVaultId).toMatch(/^pzvault_[a-z2-7]{26}$/)
      expect(isPapelizEncryptedVaultId(papelizEncryptedVaultId)).toBe(true)
      // Windows Credential Manager's key name takes 1 to 128 ASCII letters, digits, hyphens or underscores.
      expect(papelizEncryptedVaultId).toMatch(/^[A-Za-z0-9_-]{1,128}$/)
      const encryptedVaultEntryId = createPapelizEncryptedVaultEntryId()
      expect(readPapelizEncryptedVaultEntryIdFromFileName(makePapelizEncryptedVaultFileName(encryptedVaultEntryId))).toBe(encryptedVaultEntryId)
    }
    expect(readPapelizEncryptedVaultEntryIdFromFileName('Notes.md')).toBeNull()
    expect(readPapelizEncryptedVaultEntryIdFromFileName('pzentry_short.papeliz-encrypted')).toBeNull()
  })
})

describe('an encrypted vault file', () => {
  it('carries its path and contents, and keeps the contents as they are when sealed at a new path', async () => {
    const vaultKeys = await derivePapelizEndToEndVaultKeys(testVaultId, testVaultKeyBytes)
    const plainBytes = new TextEncoder().encode('# Hello\n\nÜnïcödé ✓')
    const encryptedFileBytes = await encryptPapelizVaultFile(vaultKeys, testEntryId, 'Notes/Hello.md', plainBytes)
    // At least 1 KiB of padding, so a short note's size says little.
    expect(encryptedFileBytes.length).toBeGreaterThan(1024)
    const fileHeader = await openPapelizEncryptedVaultFileHeader(vaultKeys, testEntryId, encryptedFileBytes)
    if (fileHeader.encryptedVaultEntryKind !== 'file') throw new Error('Not a file')
    expect(fileHeader.vaultEntryRelativePath).toBe('Notes/Hello.md')
    expect(await decryptPapelizEncryptedVaultFileContents(vaultKeys, fileHeader)).toEqual(plainBytes)

    const resealedFileBytes = await resealPapelizEncryptedVaultFile(vaultKeys, testEntryId, '.trash/Hello.md', fileHeader)
    const resealedHeader = await openPapelizEncryptedVaultFileHeader(vaultKeys, testEntryId, resealedFileBytes)
    if (resealedHeader.encryptedVaultEntryKind !== 'file') throw new Error('Not a file')
    expect(resealedHeader.vaultEntryRelativePath).toBe('.trash/Hello.md')
    expect(resealedHeader.storedObjectBytes).toEqual(fileHeader.storedObjectBytes)

    const folderMarkerBytes = await encryptPapelizVaultFolderMarker(vaultKeys, testEntryId, 'Notes/Empty')
    expect(await openPapelizEncryptedVaultFileHeader(vaultKeys, testEntryId, folderMarkerBytes)).toEqual({ encryptedVaultEntryKind: 'folder', vaultEntryRelativePath: 'Notes/Empty' })
  })

  it('doesn’t open once changed, renamed, moved to another vault or opened with another key', async () => {
    const vaultKeys = await derivePapelizEndToEndVaultKeys(testVaultId, testVaultKeyBytes)
    const encryptedFileBytes = await encryptPapelizVaultFile(vaultKeys, testEntryId, 'Plan.md', new TextEncoder().encode('the plan'))

    const changedPathBytes = encryptedFileBytes.slice()
    changedPathBytes[20] = (changedPathBytes[20] ?? 0) ^ 1
    expect(await expectDecryptionFailure(openPapelizEncryptedVaultFileHeader(vaultKeys, testEntryId, changedPathBytes))).toBe('wrong-key-or-tampered')

    const changedContentsBytes = encryptedFileBytes.slice()
    changedContentsBytes[changedContentsBytes.length - 1] = (changedContentsBytes[changedContentsBytes.length - 1] ?? 0) ^ 1
    const changedContentsHeader = await openPapelizEncryptedVaultFileHeader(vaultKeys, testEntryId, changedContentsBytes)
    if (changedContentsHeader.encryptedVaultEntryKind !== 'file') throw new Error('Not a file')
    expect(await expectDecryptionFailure(decryptPapelizEncryptedVaultFileContents(vaultKeys, changedContentsHeader))).toBe('wrong-key-or-tampered')

    expect(await expectDecryptionFailure(openPapelizEncryptedVaultFileHeader(vaultKeys, 'pzentry_zzzzzzzzzzzzzzzzzzzzzzzzzz', encryptedFileBytes))).toBe('wrong-key-or-tampered')
    const otherVaultKeys = await derivePapelizEndToEndVaultKeys('pzvault_zzzzzzzzzzzzzzzzzzzzzzzzzz', testVaultKeyBytes)
    expect(await expectDecryptionFailure(openPapelizEncryptedVaultFileHeader(otherVaultKeys, testEntryId, encryptedFileBytes))).toBe('wrong-key-or-tampered')
    const otherKeyVaultKeys = await derivePapelizEndToEndVaultKeys(testVaultId, new Uint8Array(32))
    expect(await expectDecryptionFailure(openPapelizEncryptedVaultFileHeader(otherKeyVaultKeys, testEntryId, encryptedFileBytes))).toBe('wrong-key-or-tampered')

    expect(await expectDecryptionFailure(openPapelizEncryptedVaultFileHeader(vaultKeys, testEntryId, encryptedFileBytes.subarray(0, 40)))).toBe('malformed')
    const newerContainerBytes = encryptedFileBytes.slice()
    newerContainerBytes[0] = 2
    expect(await expectDecryptionFailure(openPapelizEncryptedVaultFileHeader(vaultKeys, testEntryId, newerContainerBytes))).toBe('unsupported-format')
  })
})

// Argon2id is in `@noble/hashes`, which a Standard vault never needs: the only way into it is the
// dynamic import that turns a passphrase into its key, so the free build keeps it in a chunk of its
// own, loaded only when an End-to-end vault is made or opened.
describe('the free build', () => {
  it('reaches @noble/hashes only through one dynamic import', () => {
    const webappSourceFolderPath = fileURLToPath(new URL('../../', import.meta.url))
    const listSourceFilePaths = (sourceFolderPath: string): string[] =>
      readdirSync(sourceFolderPath).flatMap((sourceEntryName) => {
        const sourceEntryPath = join(sourceFolderPath, sourceEntryName)
        if (statSync(sourceEntryPath).isDirectory()) return listSourceFilePaths(sourceEntryPath)
        return /\.(ts|tsx)$/.test(sourceEntryName) && !/\.test\.tsx?$/.test(sourceEntryName) ? [sourceEntryPath] : []
      })
    const nobleHashesImportLines = listSourceFilePaths(webappSourceFolderPath).flatMap((sourceFilePath) =>
      readFileSync(sourceFilePath, 'utf8')
        .split('\n')
        .filter((sourceLine) => sourceLine.includes('@noble/hashes'))
        .map((sourceLine) => `${sourceFilePath.slice(webappSourceFolderPath.length).replaceAll('\\', '/')}: ${sourceLine.trim()}`),
    )
    expect(nobleHashesImportLines).toEqual([
      "modules/vault/papeliz-vault-encryption-passphrase-key.ts: // Argon2id comes from `@noble/hashes`, loaded here only, through a dynamic import, so a Standard vault",
      "modules/vault/papeliz-vault-encryption-passphrase-key.ts: const { argon2idAsync } = await import('@noble/hashes/argon2.js')",
    ])
  })
})
